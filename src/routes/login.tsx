import { createFileRoute, redirect } from "@tanstack/react-router";

// Aquafulness has no sign-in. soarfulness.app.spacify.se briefly served the
// Spacify app, which sent visitors to /login; browsers still open that URL
// from tabs, history and bookmarks, so send it to the front page instead of
// a 404.
export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true });
  },
});
