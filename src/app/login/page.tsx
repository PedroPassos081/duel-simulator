"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/deck-builder";
  const verified = searchParams.get("verified") === "1";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      identifier,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError(
        "E-mail, usuário ou senha inválidos. Confirme também se o e-mail foi verificado."
      );
      return;
    }
    router.push(callbackUrl);
  }

  return (
    <main className="relative isolate flex min-h-[calc(100vh-3rem)] items-center justify-center overflow-hidden px-4 py-12">
      <div className="absolute left-1/2 top-0 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-edison-gold/10 blur-3xl" />

      <section className="w-full max-w-md rounded-2xl border border-edison-border bg-edison-panel/90 p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-8">
        <div className="mb-7 text-center">
          <Image
            src="/icon.png"
            alt="Logo Master Duelist"
            width={128}
            height={128}
            priority
            className="mx-auto mb-2 h-28 w-28 object-contain drop-shadow-[0_0_24px_rgba(212,175,55,0.28)]"
          />
          <div className="mb-5 leading-none">
            <p className="text-3xl font-black uppercase tracking-[0.14em] text-edison-gold drop-shadow-[0_2px_10px_rgba(212,175,55,0.28)]">
              Master
            </p>
            <p className="mt-1 text-xl font-semibold uppercase tracking-[0.32em] text-gray-100">
              Duelist
            </p>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Bem-vindo de volta
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Entre para continuar no Master Duelist
          </p>
        </div>

        {verified && (
          <p className="mb-5 rounded-lg border border-green-800 bg-green-950/40 p-3 text-sm text-green-400">
            E-mail confirmado. Agora você já pode entrar.
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm font-medium text-gray-200">
            E-mail ou nome de usuário
            <input
              type="text"
              placeholder="Digite seu e-mail ou usuário"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoComplete="username"
              className="h-11 rounded-lg border border-edison-border bg-black/20 px-3 font-normal outline-none transition placeholder:text-gray-600 focus:border-edison-gold focus:ring-2 focus:ring-edison-gold/15"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium text-gray-200">
            Senha
            <input
              type="password"
              placeholder="Digite sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="h-11 rounded-lg border border-edison-border bg-black/20 px-3 font-normal outline-none transition placeholder:text-gray-600 focus:border-edison-gold focus:ring-2 focus:ring-edison-gold/15"
            />
          </label>

          {error && (
            <p className="rounded-lg border border-red-900/70 bg-red-950/30 p-3 text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 h-11 rounded-lg bg-edison-gold px-4 font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-gray-600">
          <span className="h-px flex-1 bg-edison-border" />
          ou
          <span className="h-px flex-1 bg-edison-border" />
        </div>

        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl })}
          className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-edison-border bg-white px-4 font-medium text-gray-900 transition hover:bg-gray-100"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full font-bold text-blue-600">
            G
          </span>
          Continuar com Google
        </button>

        <p className="mt-7 text-center text-sm text-gray-400">
          Ainda não possui conta?{" "}
          <Link
            href="/register"
            className="font-medium text-edison-gold hover:underline"
          >
            Criar conta
          </Link>
        </p>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[calc(100vh-3rem)] items-center justify-center text-sm text-gray-400">
          Carregando login...
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
