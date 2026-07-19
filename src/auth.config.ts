import type { NextAuthConfig } from "next-auth";

export const authConfig = {
    pages: {
        signIn: "/login",
    },

    providers: [], // Injetados no arquivo principal (com argon2)

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

        async jwt({ token, user }) {
            if (user?.id) {
                token.userId = user.id;
            }
            return token;
        },

        async session({ session, token }) {
            if (session.user && typeof token.userId === "string") {
                session.user.id = token.userId;
            }
            return session;
        },
    },
} satisfies NextAuthConfig;