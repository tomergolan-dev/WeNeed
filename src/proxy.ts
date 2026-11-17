import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

// Picks the language for each page request (see src/i18n/routing.ts).
export default createMiddleware(routing);

export const config = {
  // Pages only: not API routes, Next's own files, or files like /og.png.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
