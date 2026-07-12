import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const PROTECTED_PATHS = ["/deck-builder", "/shop", "/api/decks", "/api/shop", "/api/wallet"];

export default auth((req) => {
  const isProtected = PROTECTED_PATHS.some((p) => req.nextUrl.pathname.startsWith(p));
  if (isProtected && !req.auth?.user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/deck-builder/:path*", "/shop/:path*", "/api/decks/:path*", "/api/shop/:path*", "/api/wallet/:path*"],
};
