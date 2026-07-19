import type { NextAuthConfig } from "next-auth";

export const authConfig = {
    pages: {
        signIn: "/login",
    },

    providers: [],

    callbacks: {
        authorized({ auth, request }) {
            const isLoggedIn = Boolean(auth?.user);
            const pathname = request.nextUrl.pathname;

            const protectedPaths = [
                "/deck-builder",
                "/shop",
                "/api/decks",
                "/api/shop",
                "/api/wallet",
            ];

            const isProtected = protectedPaths.some((path) =>
                pathname.startsWith(path)
            );

            if (isProtected) {
                return isLoggedIn;
            }

            return true;
        },
    },
} satisfies NextAuthConfig;