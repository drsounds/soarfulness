// "Bath link" sharing: turns a JSON-serializable snapshot of the app's
// settings (+ camera pose + title/description) into a URL-safe base62
// string embedded directly in the URL path (see routes/bathing.$payload.tsx)
// — no server-side storage at all, the link itself *is* the saved state.
// Framework-agnostic: no React here, just encode/decode.

const BASE62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE62_LOOKUP = new Map(Array.from(BASE62_ALPHABET).map((c, i) => [c, i]));

// Base62-encodes an arbitrary byte string, big-integer style (like base58
// Bitcoin addresses): leading zero bytes would otherwise vanish once folded
// into a big integer, so they're preserved up front as autoproc leading
// "0" digits, one per zero byte.
export function encodeBase62(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let digits = "";
  while (n > 0n) {
    digits = BASE62_ALPHABET[Number(n % 62n)] + digits;
    n /= 62n;
  }
  return BASE62_ALPHABET[0].repeat(zeros) + digits;
}

export function decodeBase62(str: string): Uint8Array {
  if (str.length === 0) return new Uint8Array(0);
  let zeros = 0;
  while (zeros < str.length && str[zeros] === BASE62_ALPHABET[0]) zeros++;
  let n = 0n;
  for (let i = zeros; i < str.length; i++) {
    const v = BASE62_LOOKUP.get(str[i]);
    if (v === undefined) throw new Error("invalid base62 character");
    n = n * 62n + BigInt(v);
  }
  const rev: number[] = [];
  while (n > 0n) {
    rev.push(Number(n & 0xffn));
    n >>= 8n;
  }
  const out = new Uint8Array(zeros + rev.length);
  for (let i = 0; i < rev.length; i++) out[zeros + i] = rev[rev.length - 1 - i];
  return out;
}

async function readAllChunks(readable: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

// CompressionStream/DecompressionStream are available in every modern
// browser and in the Node/Cloudflare Workers runtimes this app ships to —
// but not universally, so both directions fall back to storing the bytes
// uncompressed (see the format byte in encode/decodeStateToBase62 below)
// rather than throwing on an older runtime.
async function gzip(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined") return null;
  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  void writer.write(bytes as BufferSource);
  void writer.close();
  return readAllChunks(cs.readable);
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("gzip decompression is not supported in this environment");
  }
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  void writer.write(bytes as BufferSource);
  void writer.close();
  return readAllChunks(ds.readable);
}

const FORMAT_RAW = 1;
const FORMAT_GZIP = 2;

// Serializes `value` to JSON, gzip-compresses it when possible (falling
// back to the raw JSON bytes otherwise), and base62-encodes the result —
// the full round trip behind a shared "bathing" link.
export async function encodeStateToBase62(value: unknown): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(value));
  const compressed = await gzip(raw);
  const useGzip = compressed !== null && compressed.length < raw.length;
  const body = useGzip ? (compressed as Uint8Array) : raw;
  const framed = new Uint8Array(body.length + 1);
  framed[0] = useGzip ? FORMAT_GZIP : FORMAT_RAW;
  framed.set(body, 1);
  return encodeBase62(framed);
}

export async function decodeStateFromBase62(encoded: string): Promise<unknown> {
  const framed = decodeBase62(encoded);
  if (framed.length === 0) throw new Error("empty bath link payload");
  const [format, ...rest] = framed;
  const body = Uint8Array.from(rest);
  let bytes: Uint8Array;
  if (format === FORMAT_GZIP) {
    bytes = await gunzip(body);
  } else if (format === FORMAT_RAW) {
    bytes = body;
  } else {
    throw new Error("unrecognized bath link payload format");
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

// The shape encoded into a "bathing" link: a subset of Persisted settings
// (kept as a loose record here — src/lib/settingsShared.ts owns the real
// Persisted type, and routes/index.tsx is responsible for only ever putting
// recognized fields into `s`), the camera pose, and the user-supplied
// title/description shown in Open Graph previews when the link is shared.
export type BathPayload = {
  v: 1;
  s: Record<string, unknown>;
  c?: { x: number; y: number; z: number; yaw: number; pitch: number };
  t?: string;
  d?: string;
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function isValidBathPayload(value: unknown): value is BathPayload {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  if (o.v !== 1) return false;
  if (!o.s || typeof o.s !== "object") return false;
  if (o.t !== undefined && typeof o.t !== "string") return false;
  if (o.d !== undefined && typeof o.d !== "string") return false;
  if (o.c !== undefined) {
    const c = o.c;
    if (
      !c ||
      typeof c !== "object" ||
      !isFiniteNumber((c as Record<string, unknown>).x) ||
      !isFiniteNumber((c as Record<string, unknown>).y) ||
      !isFiniteNumber((c as Record<string, unknown>).z) ||
      !isFiniteNumber((c as Record<string, unknown>).yaw) ||
      !isFiniteNumber((c as Record<string, unknown>).pitch)
    ) {
      return false;
    }
  }
  return true;
}

// Bath links are capped at a reasonable title/description length before
// encoding — long enough for a real sentence, short enough that a careless
// paste of an entire article doesn't balloon the URL.
export const BATH_TITLE_MAX_LENGTH = 80;
export const BATH_DESCRIPTION_MAX_LENGTH = 200;

export function buildBathUrl(origin: string, encodedPayload: string): string {
  return `${origin.replace(/\/+$/, "")}/bathing/${encodedPayload}`;
}
