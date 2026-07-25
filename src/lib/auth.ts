import "server-only";

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import argon2 from "argon2";

import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  adapter: PrismaAdapter(prisma),

  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7,
  },

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      name: "credentials",

      credentials: {
        identifier: {
          label: "E-mail ou usuário",
          type: "text",
        },
        password: {
          label: "Senha",
          type: "password",
        },
      },

      async authorize(rawCredentials) {
        const parsed = loginSchema.safeParse(rawCredentials);

        if (!parsed.success) {
          return null;
        }

        const { identifier, password } = parsed.data;
        const normalizedIdentifier = identifier.trim().toLowerCase();

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: normalizedIdentifier },
              { username: normalizedIdentifier },
            ],
          },
        });

        if (!user?.passwordHash) {
          return null;
        }

        const passwordValid = await argon2.verify(
          user.passwordHash,
          password
        );

        if (!passwordValid) {
          return null;
        }

        if (!user.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED");
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
        };
      },
    }),
  ],

  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email.toLowerCase() },
        });

        if (dbUser) {
          await prisma.$transaction([
            prisma.user.update({
              where: { id: dbUser.id },
              data: { emailVerified: dbUser.emailVerified ?? new Date() },
            }),
            prisma.wallet.upsert({
              where: { userId: dbUser.id },
              update: {},
              create: { userId: dbUser.id },
            }),
          ]);
        }
      }

      return true;
    },
  },

  events: {
    async createUser({ user }) {
      if (!user.id) return;

      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: user.email ? new Date() : null },
        }),
        prisma.wallet.upsert({
          where: { userId: user.id },
          update: {},
          create: { userId: user.id },
        }),
      ]);
    },
  },
});
