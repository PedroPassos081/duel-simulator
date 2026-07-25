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
    <div className="mx-auto max-w-sm py-12">
      <h1 className="mb-2 text-2xl font-semibold">
        {step === "register" ? "Criar conta" : "Confirmar e-mail"}
      </h1>
      <p className="mb-6 text-sm text-gray-400">
        {step === "register"
          ? "Crie sua conta ou continue com o Google."
          : `Digite o código enviado para ${email}.`}
      </p>

      {step === "register" ? (
        <>
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/deck-builder" })}
            className="mb-5 w-full rounded border border-edison-border bg-white px-4 py-2 font-medium text-black hover:bg-gray-100"
          >
            Continuar com Google
          </button>

          <div className="mb-5 flex items-center gap-3 text-xs text-gray-500">
            <span className="h-px flex-1 bg-edison-border" />
            ou use seus dados
            <span className="h-px flex-1 bg-edison-border" />
          </div>

          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              className="rounded border border-edison-border bg-edison-panel px-3 py-2"
            />
            <input
              type="text"
              placeholder="Nome de usuário"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))
              }
              required
              autoComplete="username"
              className="rounded border border-edison-border bg-edison-panel px-3 py-2"
            />
            <input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="rounded border border-edison-border bg-edison-panel px-3 py-2"
            />
            <input
              type="password"
              placeholder="Senha (mín. 8 caracteres, letras e números)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="rounded border border-edison-border bg-edison-panel px-3 py-2"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-edison-gold px-4 py-2 font-medium text-black hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Criando..." : "Criar conta"}
            </button>
          </form>
        </>
      ) : (
        <form onSubmit={handleVerify} className="flex flex-col gap-4">
          {message && <p className="text-sm text-green-400">{message}</p>}
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            required
            autoComplete="one-time-code"
            className="rounded border border-edison-border bg-edison-panel px-3 py-3 text-center text-2xl tracking-[0.5em]"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="rounded bg-edison-gold px-4 py-2 font-medium text-black hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Confirmando..." : "Confirmar e-mail"}
          </button>
          <button
            type="button"
            onClick={resendCode}
            disabled={loading}
            className="text-sm text-edison-gold hover:underline disabled:opacity-50"
          >
            Reenviar código
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-gray-400">
        Já possui conta?{" "}
        <Link href="/login" className="text-edison-gold hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
