import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import argon2 from "argon2";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";

// NOTA DE SEGURANÇA:
// O provider "Credentials" do Auth.js exige estratégia de sessão JWT (não dá
// para usar sessão em banco diretamente com login por senha, é uma limitação
// da própria lib). Para revogar sessões antes da expiração (ex: usuário troca
// a senha porque suspeita de invasão), implemente uma "denylist" de tokens no
// Redis, checada no callback `jwt` abaixo. Deixei o gancho pronto.

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 }, // 7 dias
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) return null;

        const passwordValid = await argon2.verify(user.passwordHash, password);
        if (!passwordValid) return null;

        // Bloqueia login se e-mail não confirmado — obrigatório antes de qualquer
        // ação que envolva a loja / cash real.
        if (!user.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED");
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.userId = user.id;
      // gancho para checar denylist de tokens revogados no Redis, se implementado:
      // const revoked = await redis.get(`revoked:${token.userId}`);
      // if (revoked) throw new Error("SESSION_REVOKED");
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        (session.user as { id?: string }).id = token.userId as string;
      }
      return session;
    },
  },
});
