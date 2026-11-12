// Response headers for every page and API response. Used by next.config.ts (pages
// and assets served by Next.js) and by server.ts (its own /api/session responses).
export const SECURITY_HEADERS: Record<string, string> = {
  // Only this site may embed the app in a frame (clickjacking).
  "Content-Security-Policy": "frame-ancestors 'self'",
  // The page needs the microphone, and nothing else.
  "Permissions-Policy": "microphone=(self), camera=()",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};
