import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Public routes — no auth required
  if (
    pathname === "/" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const user = req.auth?.user;

  // No session → redirect to login
  if (!user) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (user as any).role as string | undefined;

  // Admin-only routes (uses cached JWT role — acceptable since role changes are rare)
  if (pathname.startsWith("/admin") && role !== "SUPER_ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Role & trial freshness checks are done in dashboard layout (Node.js Server Component)
  // because Prisma cannot run in Edge Runtime (middleware).
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
