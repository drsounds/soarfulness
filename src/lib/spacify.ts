import { useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";

// Optional "Sign in with Spacify": Spacify (app.spacify.se) is an OAuth 2
// provider for apps like this one (its app API, docs/app-api.md in the
// spacify repo). Signing in lets the saved states, presets and scenery
// presets sync to the user's Spacify account (its Soarfulness app,
// src/apps/soarfulness there) — see src/lib/spacifySync.ts. Everything
// works exactly as before for anyone who never signs in.
//
// A browser app can't keep a client secret, so this is the authorization
// code flow with PKCE: the code verifier stays in this tab's sessionStorage
// and only its SHA-256 goes to the consent page. Tokens stay in
// localStorage: an access token (an hour) and a refresh token (90 days,
// rotated on every use).

const API_URL = (
  (import.meta.env.VITE_SPACIFY_API_URL as string | undefined) ||
  "https://db.spacify.se/functions/v1/app-api"
).replace(/\/$/, "");
// The OAuth credential's public client id, created at app.spacify.se/oauth
// with the redirect URI below. Left unset, the sign-in button stays hidden.
const CLIENT_ID = (import.meta.env.VITE_SPACIFY_CLIENT_ID as string | undefined) || "";
// `profile` is for GET /me: who signed in, so a different account starts a fresh sync.
const SCOPES = ["profile", "soarfulness:read", "soarfulness:write"];
export const SPACIFY_CALLBACK_PATH = "/auth/spacify";

const SESSION_KEY = "aquafulness:spacify:session:v1";
const PENDING_KEY = "aquafulness:spacify:pending:v1";

export type SpacifySession = {
  accessToken: string;
  refreshToken: string | null;
  /** Epoch ms when the access token stops working. */
  expiresAt: number;
  /** The Spacify user the tokens act for (GET /me). */
  userId: string;
};

export type SpacifySyncStatus = "idle" | "syncing" | "synced" | "error";

type State = {
  session: SpacifySession | null;
  status: SpacifySyncStatus;
  error: string | null;
};

// ── Store ────────────────────────────────────────────────────────────────

function readSession(): SpacifySession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<SpacifySession>;
    if (typeof s.accessToken !== "string" || typeof s.userId !== "string") return null;
    return {
      accessToken: s.accessToken,
      refreshToken: typeof s.refreshToken === "string" ? s.refreshToken : null,
      expiresAt: typeof s.expiresAt === "number" ? s.expiresAt : 0,
      userId: s.userId,
    };
  } catch {
    return null;
  }
}

let state: State = { session: null, status: "idle", error: null };
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  state = { ...state, session: readSession() };
}

function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function saveSession(session: SpacifySession | null) {
  try {
    if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* quota or privacy mode: the session just won't survive a reload */
  }
  setState({ session });
}

function subscribe(listener: () => void) {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const SERVER_STATE: State = { session: null, status: "idle", error: null };

export function useSpacify(): State {
  return useSyncExternalStore(
    subscribe,
    () => {
      hydrate();
      return state;
    },
    () => SERVER_STATE,
  );
}

export function setSpacifySyncStatus(status: SpacifySyncStatus, error: string | null = null) {
  if (state.status === status && state.error === error) return;
  setState({ status, error });
}

// Registered by use-spacify-sync.ts while it's mounted and signed in.
let syncHandler: (() => void) | null = null;

export function setSpacifySyncHandler(handler: (() => void) | null) {
  syncHandler = handler;
}

export function requestSpacifySync() {
  syncHandler?.();
}

export function getSpacifySession(): SpacifySession | null {
  hydrate();
  return state.session;
}

// Hidden in the Capacitor app: the consent page would open in the system
// browser and only come back through a verified App Link (see
// CAPACITOR_APP.md), which isn't set up yet.
export function isSpacifyAvailable(): boolean {
  return CLIENT_ID !== "" && !Capacitor.isNativePlatform();
}

// ── Sign in / out ────────────────────────────────────────────────────────

function base64Url(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomString(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

function redirectUri(): string {
  return `${window.location.origin}${SPACIFY_CALLBACK_PATH}`;
}

/** Sends the browser to Spacify's consent page; it comes back to /auth/spacify. */
export async function signInWithSpacify(): Promise<void> {
  const verifier = randomString();
  const oauthState = randomString();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.sessionStorage.setItem(
    PENDING_KEY,
    JSON.stringify({ verifier, state: oauthState, returnTo }),
  );
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(),
    scope: SCOPES.join(" "),
    state: oauthState,
    code_challenge: base64Url(new Uint8Array(digest)),
    code_challenge_method: "S256",
  });
  window.location.assign(`${API_URL}/oauth/authorize?${params}`);
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

async function postToken(form: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(`${API_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form),
  });
  const body = (await response.json().catch(() => ({}))) as TokenResponse;
  if (!response.ok && !body.error) body.error = `HTTP ${response.status}`;
  return body;
}

function sessionFrom(body: TokenResponse, userId: string, previous?: SpacifySession) {
  return {
    accessToken: body.access_token!,
    refreshToken: body.refresh_token ?? previous?.refreshToken ?? null,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
    userId,
  };
}

/**
 * Finishes the sign-in on /auth/spacify: checks `state`, trades the code
 * for tokens and asks who they act for. Returns where to go next.
 */
export async function completeSpacifySignIn(search: URLSearchParams): Promise<string> {
  const raw = window.sessionStorage.getItem(PENDING_KEY);
  window.sessionStorage.removeItem(PENDING_KEY);
  const pending = raw
    ? (JSON.parse(raw) as { verifier: string; state: string; returnTo: string })
    : null;
  const returnTo = pending?.returnTo && pending.returnTo.startsWith("/") ? pending.returnTo : "/";

  const error = search.get("error");
  if (error) throw new Error(search.get("error_description") || error);
  const code = search.get("code");
  if (!pending || !code) throw new Error("The sign-in didn't start here. Try again.");
  if (search.get("state") !== pending.state)
    throw new Error("The sign-in answer doesn't match. Try again.");

  const body = await postToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
    client_id: CLIENT_ID,
    code_verifier: pending.verifier,
  });
  if (!body.access_token) throw new Error(body.error_description || body.error || "Sign-in failed");

  const me = await fetch(`${API_URL}/me`, {
    headers: { Authorization: `Bearer ${body.access_token}` },
  });
  const userId = me.ok ? String(((await me.json()) as { id?: string }).id ?? "") : "";
  if (!userId) throw new Error("Spacify didn't say who signed in. Try again.");
  saveSession(sessionFrom(body, userId));
  setSpacifySyncStatus("idle");
  return returnTo;
}

export async function signOutOfSpacify(): Promise<void> {
  const session = getSpacifySession();
  saveSession(null);
  setSpacifySyncStatus("idle");
  const token = session?.refreshToken ?? session?.accessToken;
  if (!token) return;
  // Best effort: the tokens are already forgotten here either way.
  await fetch(`${API_URL}/oauth/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token, client_id: CLIENT_ID }),
  }).catch(() => {});
}

// ── API calls ────────────────────────────────────────────────────────────

export class SpacifySignedOutError extends Error {}

let refreshing: Promise<SpacifySession> | null = null;

function refreshSession(session: SpacifySession): Promise<SpacifySession> {
  if (!refreshing) {
    refreshing = (async () => {
      if (!session.refreshToken) throw new SpacifySignedOutError("Signed out");
      const body = await postToken({
        grant_type: "refresh_token",
        refresh_token: session.refreshToken,
        client_id: CLIENT_ID,
      });
      if (!body.access_token) {
        // A refresh token that's expired or revoked (disconnected under
        // Spacify's /oauth › Connected apps) won't come back.
        if (body.error === "invalid_grant") {
          saveSession(null);
          throw new SpacifySignedOutError("Signed out");
        }
        throw new Error(body.error_description || body.error || "Couldn't refresh the sign-in");
      }
      const next = sessionFrom(body, session.userId, session);
      saveSession(next);
      return next;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

async function accessToken(): Promise<SpacifySession> {
  const session = getSpacifySession();
  if (!session) throw new SpacifySignedOutError("Signed out");
  if (session.expiresAt - 60_000 > Date.now()) return session;
  return refreshSession(session);
}

/** A JSON call to the app API as the signed-in user. */
export async function spacifyApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const call = (token: string) =>
    fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  let session = await accessToken();
  let response = await call(session.accessToken);
  if (response.status === 401) {
    session = await refreshSession(session);
    response = await call(session.accessToken);
  }
  if (response.status === 401) {
    saveSession(null);
    throw new SpacifySignedOutError("Signed out");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const problem = body as { detail?: string; title?: string } | null;
    throw new Error(problem?.detail || problem?.title || `HTTP ${response.status}`);
  }
  return body as T;
}
