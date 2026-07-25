"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
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
    <div className="mx-auto max-w-sm py-12">
      <h1 className="mb-2 text-2xl font-semibold">Entrar</h1>
      <p className="mb-6 text-sm text-gray-400">
        Acesse com sua conta ou continue com o Google.
      </p>

      {verified && (
        <p className="mb-4 rounded border border-green-800 bg-green-950/40 p-3 text-sm text-green-400">
          E-mail confirmado. Agora você já pode entrar.
        </p>
      )}

      <button
        type="button"
        onClick={() => signIn("google", { callbackUrl })}
        className="mb-5 w-full rounded border border-edison-border bg-white px-4 py-2 font-medium text-black hover:bg-gray-100"
      >
        Continuar com Google
      </button>

      <div className="mb-5 flex items-center gap-3 text-xs text-gray-500">
        <span className="h-px flex-1 bg-edison-border" />
        ou use sua senha
        <span className="h-px flex-1 bg-edison-border" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="E-mail ou nome de usuário"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          autoComplete="username"
          className="rounded border border-edison-border bg-edison-panel px-3 py-2"
        />
        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="rounded border border-edison-border bg-edison-panel px-3 py-2"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-edison-gold px-4 py-2 font-medium text-black hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-400">
        Ainda não possui conta?{" "}
        <Link href="/register" className="text-edison-gold hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
