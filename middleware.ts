import { trackApiUsage } from "./src/tracking/api-usage.js";

/**
 * Vercel Edge Middleware: counts requests to the JSON API and the llms.txt
 * companion files as Web Analytics custom events. Middleware runs before the
 * CDN cache, so cached responses are counted too. What gets recorded is
 * documented in src/tracking/api-usage.ts.
 */
export const config = {
  matcher: ["/api/:path*", "/llms.txt", "/llms-full.txt"],
};

interface MiddlewareContext {
  waitUntil(promise: Promise<unknown>): void;
}

export default function middleware(request: Request, context: MiddlewareContext): void {
  const pending = trackApiUsage(request);
  if (pending) context.waitUntil(pending);
  // Returning nothing lets the request fall through to the static files.
}
