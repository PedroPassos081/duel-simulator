import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";

// Inicializa o auth compatível com o Edge Runtime
const { auth: edgeAuth } = NextAuth(authConfig);

const PROTECTED_PATHS = ["/deck-builder", "/shop", "/account", "/random", "/duel", "/cla", "/api/decks", "/api/shop", "/api/wallet", "/api/account", "/api/random", "/api/duel", "/api/clans"];

export default edgeAuth((req) => {
  const isProtected = PROTECTED_PATHS.some((p) => req.nextUrl.pathname.startsWith(p));

  if (isProtected && !req.auth?.user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/deck-builder/:path*", "/shop/:path*", "/account/:path*", "/random/:path*", "/duel/:path*", "/cla/:path*", "/api/clans/:path*", "/api/decks/:path*", "/api/shop/:path*", "/api/wallet/:path*", "/api/account/:path*", "/api/random/:path*", "/api/duel/:path*"],
};