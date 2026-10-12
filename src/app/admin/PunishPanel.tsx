"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Ban, Gavel, KeyRound, Layers, Search, ShieldOff, Trash2 } from "lucide-react";
import { GoldIcon, CreditIcon } from "@/components/theme/CurrencyIcons";
import { Avatar } from "@/components/Avatar";
import { PlayerName } from "@/components/PlayerName";
import { formatDate, formatRelative } from "@/lib/dates";
import { CREDIT_LABEL } from "@/lib/shop-rules";

type ActionType = "warning" | "suspension" | "unsuspend" | "remove_gold" | "remove_cash" | "remove_cards" | "wipe_cards";

interface PlayerStatus {
  username: string;
  role: string;
  createdAt: string;
  avatar: { image: string | null; name: string | null; frameUrl: string | null };
  playerName: { name: string | null; effect: string | null };
  gold: number;
  cash: number;
  cardCount: number;
  distinctCards: number;
  suspendedUntil: string | null;
  suspensionReason: string | null;
  punishments: { id: string; type: string; summary: string; reason: string; admin: string; acknowledged: boolean; createdAt: string }[];
}

const ACTIONS: { id: ActionType; label: string; icon: React.ComponentType<{ className?: string }>; danger?: boolean }[] = [
  { id: "warning", label: "Advertência", icon: AlertTriangle },
  { id: "suspension", label: "Suspender conta", icon: Ban },
  { id: "remove_gold", label: "Retirar gold", icon: GoldIcon },
  { id: "remove_cash", label: `Retirar ${CREDIT_LABEL.toLowerCase()}`, icon: CreditIcon },
  { id: "remove_cards", label: "Retirar cartas", icon: Layers },
  { id: "wipe_cards", label: "Zerar cartas", icon: Trash2, danger: true },
];

const DURATIONS: { label: string; hours: number | null }[] = [
  { label: "1 hora", hours: 1 },
  { label: "1 dia", hours: 24 },
  { label: "3 dias", hours: 72 },
  { label: "7 dias", hours: 168 },
  { label: "30 dias", hours: 720 },
  { label: "Permanente", hours: null },
];

const inputClass =
  "w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-red-500/50 focus:outline-none";
const chip = (active: boolean) =>
  `rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
    active ? "border-red-500 bg-red-500/10 text-red-200" : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
  }`;

const PERMANENT_YEAR = 9999;

export function PunishPanel({ initialUsername }: { initialUsername?: string } = {}) {
  const [lookup, setLookup] = useState(initialUsername ?? "");
  const [player, setPlayer] = useState<PlayerStatus | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [action, setAction] = useState<ActionType>("warning");
  const [hours, setHours] = useState<number | null>(24);
  const [customDays, setCustomDays] = useState(0);
  const [amount, setAmount] = useState(0);
  const [card, setCard] = useState<{ id: number; name: string } | null>(null);
  const [cardQty, setCardQty] = useState(1);
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [applying, setApplying] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  async function loadPlayer(username = lookup) {
    setLookupError(null);
    const res = await fetch(`/api/admin/player?u=${encodeURIComponent(username.trim().replace(/^@/, ""))}`);
    const json = await res.json();
    if (res.ok) setPlayer(json);
    else {
      setPlayer(null);
      setLookupError(json.error ?? "Jogador não encontrado.");
    }
  }

  // Vindo de uma denúncia: já abre o jogador denunciado
  useEffect(() => {
    if (initialUsername) loadPlayer(initialUsername);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUsername]);

  const suspended = Boolean(player?.suspendedUntil);
  const effectiveHours = customDays > 0 ? customDays * 24 : hours;
  const payload =
    action === "suspension"
      ? { type: action, hours: effectiveHours }
      : action === "remove_gold" || action === "remove_cash"
        ? { type: action, amount }
        : action === "remove_cards"
          ? card && { type: action, cardId: card.id, quantity: cardQty }
          : { type: action };
  const ready =
    player && player.role !== "admin" && payload && reason.trim().length >= 3 && password &&
    (action !== "remove_gold" && action !== "remove_cash" ? true : amount > 0);

  async function apply(overrideAction?: { type: "unsuspend" }) {
    if (!player) return;
    const finalAction = overrideAction ?? payload;
    const label = overrideAction ? "Remover a suspensão" : ACTIONS.find((a) => a.id === action)?.label;
    if (!confirm(`${label} de @${player.username}?\n\nMotivo: ${reason}`)) return;
    setApplying(true);
    setFeedback(null);
    const res = await fetch("/api/admin/punish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: player.username, reason, password, action: finalAction }),
    });
    const json = await res.json();
    setApplying(false);
    setFeedback({ ok: res.ok, text: res.ok ? json.message : json.error ?? "Erro." });
    if (res.ok) {
      setPassword("");
      loadPlayer(player.username ?? "");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 1. JOGADOR */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-3 text-base font-bold text-zinc-100">1. Jogador</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadPlayer();
          }}
          className="flex gap-2"
        >
          <input value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="@usuario" className={inputClass} />
          <button className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-4 text-sm text-zinc-200 hover:bg-zinc-800">
            <Search className="h-4 w-4" /> Buscar
          </button>
        </form>
        {lookupError && <p className="mt-2 text-sm text-red-400">{lookupError}</p>}

        {player && (
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar {...player.avatar} size={48} />
              <div className="min-w-0 flex-1">
                <PlayerName {...player.playerName} className="text-lg font-bold text-zinc-100" />
                <p className="text-xs text-zinc-500">Conta criada em {formatDate(new Date(player.createdAt), { day: "2-digit", month: "short", year: "numeric" })}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Stat label="Gold" value={player.gold} />
                <Stat label={CREDIT_LABEL} value={player.cash} />
                <Stat label="Cartas" value={`${player.cardCount} (${player.distinctCards} diferentes)`} />
              </div>
            </div>

            {player.role === "admin" && <p className="text-sm text-amber-300">Esta é uma conta Admin e não pode ser punida.</p>}

            {suspended && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm">
                <span className="text-red-200">
                  <Ban className="mr-1.5 inline h-4 w-4" />
                  Suspensa{" "}
                  {new Date(player.suspendedUntil!).getUTCFullYear() === PERMANENT_YEAR
                    ? "permanentemente"
                    : `até ${formatDate(new Date(player.suspendedUntil!), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`}
                  {player.suspensionReason && <span className="text-red-300/80"> · {player.suspensionReason}</span>}
                </span>
                <button
                  onClick={() => apply({ type: "unsuspend" })}
                  disabled={!password || reason.trim().length < 3 || applying}
                  title="Preencha o motivo e a senha abaixo"
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-500/50 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-40"
                >
                  <ShieldOff className="h-3.5 w-3.5" /> Remover suspensão
                </button>
              </div>
            )}

            {player.punishments.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-zinc-500">Histórico de punições</p>
                <ul className="flex max-h-44 flex-col gap-1 overflow-y-auto text-xs">
                  {player.punishments.map((p) => (
                    <li key={p.id} className="flex flex-wrap justify-between gap-2 border-b border-zinc-800/60 pb-1">
                      <span className="text-zinc-300">
                        <strong className="text-zinc-100">{p.summary}</strong> · {p.reason}
                        {p.type === "warning" && <span className="text-zinc-500"> ({p.acknowledged ? "lida" : "não lida"})</span>}
                      </span>
                      <span className="text-zinc-500">
                        @{p.admin} · {formatRelative(new Date(p.createdAt))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 2. PUNIÇÃO */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-3 text-base font-bold text-zinc-100">2. Punição</h2>
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ACTIONS.map(({ id, label, icon: Icon, danger }) => (
            <button
              key={id}
              onClick={() => setAction(id)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                action === id
                  ? "border-red-500 bg-red-500/10 text-red-200"
                  : `border-zinc-800 bg-zinc-950/60 hover:text-zinc-200 ${danger ? "text-red-400/80" : "text-zinc-400"}`
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {action === "warning" && <p className="text-sm text-zinc-400">O jogador vê um aviso no topo da tela, com o motivo, até clicar em &quot;Entendi&quot;.</p>}

        {action === "suspension" && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.label}
                  onClick={() => {
                    setHours(d.hours);
                    setCustomDays(0);
                  }}
                  className={chip(customDays === 0 && hours === d.hours)}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              Ou quantos dias:
              <input
                type="number"
                min={1}
                value={customDays || ""}
                onChange={(e) => setCustomDays(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                className="w-24 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-200"
              />
            </label>
            <p className="text-sm text-zinc-400">A conta não consegue entrar e quem estiver logado é desconectado na hora.</p>
          </div>
        )}

        {(action === "remove_gold" || action === "remove_cash") && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              value={amount || ""}
              onChange={(e) => setAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              placeholder="Quantidade"
              className="w-40 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
            />
            {player && (
              <button onClick={() => setAmount(action === "remove_gold" ? player.gold : player.cash)} className={chip(false)}>
                Tudo ({action === "remove_gold" ? player.gold : player.cash})
              </button>
            )}
            <p className="w-full text-xs text-zinc-500">O saldo nunca fica negativo: se pedir mais do que ele tem, retira só o que houver.</p>
          </div>
        )}

        {action === "remove_cards" && <CardSearch card={card} onPick={setCard} quantity={cardQty} setQuantity={setCardQty} />}

        {action === "wipe_cards" && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            Remove <strong>todas</strong> as cartas da Maleta do jogador, inclusive as evoluídas. Não dá para desfazer.
          </p>
        )}
      </section>

      {/* 3. MOTIVO E SENHA */}
      <section className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
        <h2 className="mb-3 text-base font-bold text-zinc-100">3. Motivo e senha</h2>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={300}
          rows={2}
          placeholder="Motivo (o jogador vê na advertência e fica no histórico)"
          className={inputClass}
        />
        <div className="relative mt-3">
          <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha de punição"
            className={`${inputClass} pl-9`}
          />
        </div>
        <button
          onClick={() => apply()}
          disabled={!ready || applying}
          className="mt-4 flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-600"
        >
          <Gavel className="h-4 w-4" /> {applying ? "Aplicando..." : "Aplicar punição"}
        </button>
        {feedback && <p className={`mt-3 text-sm ${feedback.ok ? "text-emerald-400" : "text-red-400"}`}>{feedback.text}</p>}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-1.5">
      <span className="text-zinc-500">{label}: </span>
      <strong className="text-zinc-100">{value}</strong>
    </span>
  );
}

function CardSearch({
  card,
  onPick,
  quantity,
  setQuantity,
}: {
  card: { id: number; name: string } | null;
  onPick: (c: { id: number; name: string }) => void;
  quantity: number;
  setQuantity: (q: number) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/admin/cards?q=${encodeURIComponent(q.trim())}`);
      if (res.ok) setResults(await res.json());
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <div className="flex flex-col gap-2">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar a carta (nome em inglês)..." className={inputClass} />
      {results.length > 0 && (
        <ul className="max-h-44 overflow-y-auto rounded-lg border border-zinc-800">
          {results.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => onPick(c)}
                className={`w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-800 ${card?.id === c.id ? "bg-red-500/10 text-red-200" : "text-zinc-300"}`}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {card && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-300">
          Retirar <strong className="text-zinc-100">{card.name}</strong>
          <input
            type="number"
            min={1}
            value={quantity || ""}
            onChange={(e) => setQuantity(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            className="w-20 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-200"
          />
          cópia(s)
        </div>
      )}
    </div>
  );
}
