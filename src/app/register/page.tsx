"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

function apiError(data: unknown, fallback: string) {
  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    typeof data.error === "string"
  ) {
    return data.error;
  }
  return fallback;
}

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<"register" | "verify">("register");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username, email, password }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok && !data.requiresVerification) {
      setError(apiError(data, "Não foi possível criar a conta."));
      return;
    }

    setEmail((data.email ?? email).toLowerCase());
    setStep("verify");
    setMessage(
      res.ok
        ? "Enviamos um código de 6 dígitos para o seu e-mail."
        : data.error
    );
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(apiError(data, "Não foi possível confirmar o código."));
      return;
    }

    router.push("/login?verified=1");
  }

  async function resendCode() {
    setLoading(true);
    setError(null);
    setMessage(null);

    const res = await fetch("/api/auth/resend-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(apiError(data, "Não foi possível reenviar o código."));
      return;
    }
    setMessage(data.message);
  }

  return (
    <main className="relative isolate flex min-h-[calc(100vh-64px)] items-center justify-center overflow-hidden px-4 py-12">
      <div className="absolute left-1/2 top-0 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-edison-gold/10 blur-3xl" />

      <section className="w-full max-w-md rounded-2xl border border-edison-border bg-edison-panel/90 p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-8">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-edison-gold/30 bg-edison-gold/10 text-xl font-bold text-edison-gold">
            E
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {step === "register" ? "Crie sua conta" : "Confirme seu e-mail"}
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            {step === "register"
              ? "Comece agora no Edison Duel Simulator"
              : `Digite o código de 6 dígitos enviado para ${email}`}
          </p>
        </div>

        {step === "register" ? (
          <>
          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <label className="flex flex-col gap-2 text-sm font-medium text-gray-200">
              Nome
              <input
                type="text"
                placeholder="Digite seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                className="h-11 rounded-lg border border-edison-border bg-black/20 px-3 font-normal outline-none transition placeholder:text-gray-600 focus:border-edison-gold focus:ring-2 focus:ring-edison-gold/15"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-gray-200">
              Nome de usuário
              <input
                type="text"
                placeholder="Escolha seu nome de usuário"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))
                }
                required
                autoComplete="username"
                className="h-11 rounded-lg border border-edison-border bg-black/20 px-3 font-normal outline-none transition placeholder:text-gray-600 focus:border-edison-gold focus:ring-2 focus:ring-edison-gold/15"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-gray-200">
              E-mail
              <input
                type="email"
                placeholder="Digite seu e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-11 rounded-lg border border-edison-border bg-black/20 px-3 font-normal outline-none transition placeholder:text-gray-600 focus:border-edison-gold focus:ring-2 focus:ring-edison-gold/15"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-gray-200">
              Senha
              <input
                type="password"
                placeholder="Mínimo de 8 caracteres, letras e números"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
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
              {loading ? "Criando..." : "Criar conta"}
            </button>
          </form>

            <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-gray-600">
              <span className="h-px flex-1 bg-edison-border" />
              ou
              <span className="h-px flex-1 bg-edison-border" />
            </div>

            <button
              type="button"
              onClick={() =>
                signIn("google", { callbackUrl: "/deck-builder" })
              }
              className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-edison-border bg-white px-4 font-medium text-gray-900 transition hover:bg-gray-100"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full font-bold text-blue-600">
                G
              </span>
              Continuar com Google
            </button>
          </>
        ) : (
          <form onSubmit={handleVerify} className="flex flex-col gap-4">
            {message && (
              <p className="rounded-lg border border-green-800 bg-green-950/40 p-3 text-sm text-green-400">
                {message}
              </p>
            )}
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
              autoComplete="one-time-code"
              aria-label="Código de confirmação"
              className="h-14 rounded-lg border border-edison-border bg-black/20 px-3 text-center text-2xl tracking-[0.5em] outline-none transition placeholder:text-gray-700 focus:border-edison-gold focus:ring-2 focus:ring-edison-gold/15"
            />
            {error && (
              <p className="rounded-lg border border-red-900/70 bg-red-950/30 p-3 text-sm text-red-400">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="h-11 rounded-lg bg-edison-gold px-4 font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Confirmando..." : "Confirmar e-mail"}
            </button>
            <button
              type="button"
              onClick={resendCode}
              disabled={loading}
              className="text-sm font-medium text-edison-gold hover:underline disabled:opacity-50"
            >
              Reenviar código
            </button>
          </form>
        )}

        <p className="mt-7 text-center text-sm text-gray-400">
          Já possui conta?{" "}
          <Link
            href="/login"
            className="font-medium text-edison-gold hover:underline"
          >
            Entrar
          </Link>
        </p>
      </section>
    </main>
  );
}
