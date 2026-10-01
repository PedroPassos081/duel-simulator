"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, CalendarDays, Crown, Rocket, Coins, Flag, Gavel, Gift, Layers, Palette, Plus, Search, Send, Settings, Tags, Trophy } from "lucide-react";
import { GoldIcon, CreditIcon } from "@/components/theme/CurrencyIcons";
import { MillenniumPouch } from "@/components/theme/EgyptIcons";
import { PunishPanel } from "./PunishPanel";
import { SaleSettingsForm } from "./SaleSettingsForm";
import { PricingPanel } from "./PricingPanel";
import { SeasonPanel } from "./SeasonPanel";
import { TournamentsPanel } from "./TournamentsPanel";
import { EventsPanel } from "./EventsPanel";
import { ReportsPanel } from "./ReportsPanel";
import { BanlistsPanel } from "./BanlistsPanel";
import { ReleasesPanel } from "./ReleasesPanel";
import { BattlePassPanel } from "./BattlePassPanel";
import { BoxIcon } from "@/components/theme/BoxIcon";
import { FoilCard } from "@/components/FoilCard";
import { PlayerName } from "@/components/PlayerName";
import { BORDERS, FINISHES, ITEMS, variantLabel, type Border, type Finish, type ItemKey } from "@/lib/card-finish";
import { COSMETIC_TYPES, NAME_EFFECTS, RARITY_LABELS } from "@/lib/cosmetic-types";
import { formatRelative } from "@/lib/dates";
import { CREDIT_LABEL } from "@/lib/shop-rules";

type Kind = "currency" | "card" | "cosmetic" | "item" | "structure" | "vip";
type TargetMode = "users" | "all" | "clan";
type Reason = "prize" | "event" | "compensation" | "gift";

interface Cosmetic {
  id: string;
  type: string;
  name: string;
  imageUrl: string | null;
  effect: string | null;
  rarity: string;
  structureDeckId: string | null;
}

interface AdminData {
  cosmetics: Cosmetic[];
  grants: { id: string; kind: string; summary: string; reason: string; note: string | null; admin: string; target: string; createdAt: string }[];
}

interface CatalogCard {
  id: number;
  name: string;
  type: string;
  imageUrl: string | null;
}

const REASONS: { id: Reason; label: string; hint: string }[] = [
  { id: "prize", label: "Prêmio", hint: "Gold/crédito rende +10% ao clã" },
  { id: "event", label: "Evento", hint: "Recompensa de evento" },
  { id: "compensation", label: "Compensação", hint: "Manutenção, erro, reembolso" },
  { id: "gift", label: "Presente", hint: "Presente da equipe" },
];

const KINDS: { id: Kind; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "currency", label: "Gold / Crédito", icon: GoldIcon },
  { id: "card", label: "Cartas", icon: Layers },
  { id: "cosmetic", label: "Cosméticos", icon: Palette },
  { id: "item", label: "Itens", icon: MillenniumPouch },
  { id: "structure", label: "Structure Deck", icon: BoxIcon },
  { id: "vip", label: "VIP", icon: Crown },
];

const inputClass =
  "w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none";
const chip = (active: boolean) =>
  `rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
    active ? "border-amber-500 bg-amber-500/10 text-amber-200" : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
  }`;

export function AdminPanel({ salePercent }: { salePercent: number }) {
  const [mode, setMode] = useState<"send" | "reports" | "punish" | "banlists" | "releases" | "pass" | "pricing" | "season" | "tournaments" | "events" | "settings">("send");
  // Denúncias abertas (número na aba) e o jogador que o "Punir" da denúncia abre
  const [openReports, setOpenReports] = useState(0);
  const [punishTarget, setPunishTarget] = useState<string | undefined>(undefined);
  useEffect(() => {
    fetch("/api/admin/reports")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setOpenReports(d.open))
      .catch(() => {});
  }, [mode]);
  const [data, setData] = useState<AdminData | null>(null);
  const [recipients, setRecipients] = useState("");
  const [reason, setReason] = useState<Reason>("prize");
  const [note, setNote] = useState("");
  const [kind, setKind] = useState<Kind>("currency");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);

  // O que será enviado (cada aba preenche o seu)
  const [currency, setCurrency] = useState<"gold" | "cash">("gold");
  const [amount, setAmount] = useState(0);
  const [card, setCard] = useState<CatalogCard | null>(null);
  const [finish, setFinish] = useState<Finish>("normal");
  const [border, setBorder] = useState<Border>("none");
  const [cardQty, setCardQty] = useState(1);
  const [cosmeticId, setCosmeticId] = useState<string | null>(null);
  const [itemKey, setItemKey] = useState<ItemKey>("po_milenio_raro");
  const [itemQty, setItemQty] = useState(1);
  const [structureId, setStructureId] = useState<string | null>(null);
  const [edition, setEdition] = useState<"base" | "premium">("premium");
  const [vipDays, setVipDays] = useState(30);
  // Para quem: @jogadores, todos ou um clã
  const [targetMode, setTargetMode] = useState<TargetMode>("users");
  const [clanId, setClanId] = useState<string | null>(null);
  const [options, setOptions] = useState<{ clans: { id: string; name: string; members: number }[]; structures: { id: string; name: string }[] }>({
    clans: [],
    structures: [],
  });
  useEffect(() => {
    fetch("/api/admin/options")
      .then((r) => (r.ok ? r.json() : null))
      .then((o) => o && setOptions(o))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin");
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const payload =
    kind === "currency"
      ? amount > 0 && { kind, currency, amount }
      : kind === "card"
        ? card && cardQty > 0 && { kind, cardId: card.id, quantity: cardQty, variant: { finish, border } }
        : kind === "cosmetic"
          ? cosmeticId && { kind, cosmeticId }
          : kind === "item"
            ? itemQty > 0 && { kind, itemKey, quantity: itemQty }
            : kind === "vip"
              ? vipDays > 0 && { kind, days: vipDays }
              : structureId && { kind, structureDeckId: structureId, edition };

  const summary =
    kind === "currency"
      ? `${amount} ${currency === "gold" ? "gold" : CREDIT_LABEL.toLowerCase()}`
      : kind === "card"
        ? card
          ? `${cardQty}x ${card.name} (${variantLabel({ finish, border })})`
          : "escolha uma carta"
        : kind === "cosmetic"
          ? data?.cosmetics.find((c) => c.id === cosmeticId)?.name ?? "escolha um cosmético"
          : kind === "item"
            ? `${itemQty}x ${ITEMS[itemKey].name}`
            : kind === "vip"
              ? `VIP por ${vipDays} dia(s)`
              : structureId
              ? `Structure Deck ${options.structures.find((d) => d.id === structureId)?.name} (${edition === "premium" ? "Premium" : "Base"})`
              : "escolha um Structure Deck";

  const recipientCount = recipients.split(/[\s,;]+/).filter(Boolean).length;
  const target =
    targetMode === "all" ? { mode: "all" as const } : targetMode === "clan" ? clanId && { mode: "clan" as const, clanId } : recipientCount > 0 && { mode: "users" as const, input: recipients };
  const targetLabel =
    targetMode === "all"
      ? "TODOS os jogadores"
      : targetMode === "clan"
        ? clanId
          ? `o clã ${options.clans.find((c) => c.id === clanId)?.name} (${options.clans.find((c) => c.id === clanId)?.members} membros)`
          : "escolha um clã"
        : `${recipientCount || "nenhum"} jogador(es)`;

  async function send() {
    if (!payload) return;
    if (!target) return;
    if (!confirm(`Enviar ${summary} para ${targetLabel}?`)) return;
    setSending(true);
    setFeedback(null);
    const res = await fetch("/api/admin/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, reason, note: note || undefined, payload }),
    });
    const json = await res.json();
    setSending(false);
    setFeedback({ ok: res.ok, text: res.ok ? json.message : json.error ?? "Erro ao enviar." });
    if (res.ok) load();
  }

  if (!data) return <div className="container mx-auto max-w-5xl px-4 py-8 text-sm text-zinc-400">Carregando...</div>;

  return (
    <div>
      {/* ENVIAR / PUNIR / CONFIGURAÇÕES */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:flex sm:w-fit">
        {(
          [
            { id: "send", label: "Enviar", icon: Gift, active: "border-amber-500 bg-amber-500/10 text-amber-300" },
            { id: "reports", label: "Denúncias", icon: Flag, active: "border-red-500 bg-red-500/10 text-red-300" },
            { id: "punish", label: "Punir", icon: Gavel, active: "border-red-500 bg-red-500/10 text-red-300" },
            { id: "banlists", label: "Banlists", icon: Ban, active: "border-red-500 bg-red-500/10 text-red-300" },
            { id: "pass", label: "Passe", icon: Crown, active: "border-amber-500 bg-amber-500/10 text-amber-300" },
            { id: "releases", label: "Lançamentos", icon: Rocket, active: "border-amber-500 bg-amber-500/10 text-amber-300" },
            { id: "pricing", label: "Preços", icon: Tags, active: "border-purple-500 bg-purple-500/10 text-purple-300" },
            { id: "season", label: "Season", icon: CalendarDays, active: "border-sky-500 bg-sky-500/10 text-sky-300" },
            { id: "tournaments", label: "Torneios", icon: Trophy, active: "border-amber-500 bg-amber-500/10 text-amber-300" },
            { id: "events", label: "Eventos", icon: Coins, active: "border-yellow-500 bg-yellow-500/10 text-yellow-300" },
            { id: "settings", label: "Configurações", icon: Settings, active: "border-emerald-500 bg-emerald-500/10 text-emerald-300" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => { setPunishTarget(undefined); setMode(t.id); }}
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold ${
              mode === t.id ? t.active : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
            {t.id === "reports" && openReports > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[10px] leading-4 text-white">{openReports}</span>}
          </button>
        ))}
      </div>

      {mode === "reports" ? (
        <ReportsPanel
          onPunish={(username) => {
            setPunishTarget(username);
            setMode("punish");
          }}
        />
      ) : mode === "punish" ? (
        <PunishPanel key={punishTarget} initialUsername={punishTarget} />
      ) : mode === "pass" ? (
        <BattlePassPanel cosmetics={data.cosmetics} />
      ) : mode === "releases" ? (
        <ReleasesPanel />
      ) : mode === "banlists" ? (
        <BanlistsPanel />
      ) : mode === "pricing" ? (
        <PricingPanel />
      ) : mode === "season" ? (
        <SeasonPanel cosmetics={data.cosmetics} />
      ) : mode === "tournaments" ? (
        <TournamentsPanel cosmetics={data.cosmetics} />
      ) : mode === "events" ? (
        <EventsPanel />
      ) : mode === "settings" ? (
        <SaleSettingsForm initialPercent={salePercent} />
      ) : (
      <div className="flex flex-col gap-5">
        {/* 1. PARA QUEM */}
        <Step n={1} title="Para quem">
          <div className="mb-3 flex flex-wrap gap-2">
            {(
              [
                ["users", "Jogadores"],
                ["all", "Todos"],
                ["clan", "Um clã"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} onClick={() => setTargetMode(id)} className={chip(targetMode === id)}>
                {label}
              </button>
            ))}
          </div>
          {targetMode === "users" && (
            <input
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="@yugi, @kaiba, @joey  (separe por vírgula)"
              className={inputClass}
            />
          )}
          {targetMode === "all" && <p className="text-sm text-amber-300">Vai para todas as contas verificadas do jogo. Confira bem antes de enviar.</p>}
          {targetMode === "clan" && (
            <select value={clanId ?? ""} onChange={(e) => setClanId(e.target.value || null)} className={inputClass}>
              <option value="">Escolha o clã...</option>
              {options.clans.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.members} membros)
                </option>
              ))}
            </select>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button key={r.id} onClick={() => setReason(r.id)} title={r.hint} className={chip(reason === r.id)}>
                {r.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-zinc-500">{REASONS.find((r) => r.id === reason)?.hint}</p>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Observação (opcional), ex.: 1º lugar Torneio Slifer" className={`${inputClass} mt-3`} />
        </Step>

        {/* 2. O QUE ENVIAR */}
        <Step n={2} title="O que enviar">
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {KINDS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setKind(id)}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors ${
                  kind === id ? "border-amber-500 bg-amber-500/10 text-amber-300" : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          {kind === "currency" && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <button onClick={() => setCurrency("gold")} className={chip(currency === "gold")}>
                  <GoldIcon className="mr-1 inline h-3.5 w-3.5 text-amber-400" /> Gold
                </button>
                <button onClick={() => setCurrency("cash")} className={chip(currency === "cash")}>
                  <CreditIcon className="mr-1 inline h-3.5 w-3.5 text-purple-400" /> {CREDIT_LABEL}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={amount || ""}
                  onChange={(e) => setAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                  placeholder="Quantidade"
                  className={`${inputClass} w-40`}
                />
                {[100, 500, 1000, 5000].map((v) => (
                  <button key={v} onClick={() => setAmount(v)} className={chip(amount === v)}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          {kind === "card" && (
            <CardPicker
              card={card}
              onPick={setCard}
              finish={finish}
              setFinish={setFinish}
              border={border}
              setBorder={setBorder}
              quantity={cardQty}
              setQuantity={setCardQty}
            />
          )}

          {kind === "cosmetic" && <CosmeticPicker cosmetics={data.cosmetics} selected={cosmeticId} onSelect={setCosmeticId} onCreated={load} />}

          {kind === "item" && (
            <div className="flex flex-col gap-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(ITEMS) as ItemKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setItemKey(key)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left ${
                      itemKey === key ? "border-amber-500 bg-amber-500/10" : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-600"
                    }`}
                  >
                    <MillenniumPouch className={`h-4 w-4 shrink-0 ${ITEMS[key].color}`} />
                    <span>
                      <span className="block text-sm font-semibold text-zinc-100">{ITEMS[key].name}</span>
                      <span className="block text-xs text-zinc-500">{ITEMS[key].description}</span>
                    </span>
                  </button>
                ))}
              </div>
              <QuantityInput value={itemQty} onChange={setItemQty} />
            </div>
          )}

          {kind === "vip" && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {[7, 30, 90].map((d) => (
                  <button key={d} onClick={() => setVipDays(d)} className={chip(vipDays === d)}>
                    {d} dias
                  </button>
                ))}
                <input type="number" min={1} value={vipDays} onChange={(e) => setVipDays(Number(e.target.value))} className={`${inputClass} !w-24`} />
              </div>
              <p className="text-xs text-zinc-500">Os dias somam ao VIP que o jogador já tem. VIP ganha +30% de gold nos duelos.</p>
            </div>
          )}

          {kind === "structure" && (
            <div className="flex flex-col gap-3">
              <select value={structureId ?? ""} onChange={(e) => setStructureId(e.target.value || null)} className={inputClass}>
                <option value="">Escolha o Structure Deck...</option>
                {options.structures.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                {(["base", "premium"] as const).map((ed) => (
                  <button key={ed} onClick={() => setEdition(ed)} className={chip(edition === ed)}>
                    {ed === "premium" ? "Premium (cosméticos + itens)" : "Base"}
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-500">O jogador recebe as cartas, o deck pronto no Deck Builder e, na Premium, os extras.</p>
            </div>
          )}
        </Step>

        {/* 3. ENVIAR */}
        <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-zinc-300">
            <strong className="text-zinc-100">{summary}</strong> para{" "}
            <strong className="text-zinc-100">{targetLabel}</strong> ·{" "}
            {REASONS.find((r) => r.id === reason)?.label}
          </p>
          <button
            onClick={send}
            disabled={!payload || !target || sending}
            className="flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-black hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-600"
          >
            <Send className="h-4 w-4" /> {sending ? "Enviando..." : "Enviar"}
          </button>
        </div>
        {feedback && (
          <p className={`rounded-lg border px-4 py-3 text-sm ${feedback.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
            {feedback.text}
          </p>
        )}

        {/* HISTÓRICO */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="mb-3 text-base font-bold text-zinc-100">Últimos envios</h2>
          {data.grants.length === 0 ? (
            <p className="text-sm text-zinc-500">Nada enviado ainda.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-800/70">
              {data.grants.map((g) => (
                <li key={g.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
                  <span className="text-zinc-300">
                    <strong className="text-zinc-100">{g.summary}</strong> → @{g.target}
                    <span className="ml-2 text-xs text-zinc-500">
                      {REASONS.find((r) => r.id === g.reason)?.label ?? g.reason}
                      {g.note && ` · ${g.note}`}
                    </span>
                  </span>
                  <span className="text-xs text-zinc-500">
                    por @{g.admin} · {formatRelative(new Date(g.createdAt))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      )}
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-zinc-100">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/15 text-xs text-amber-400">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function QuantityInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-400">
      Quantidade
      <input
        type="number"
        min={1}
        value={value || ""}
        onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        className={`${inputClass} w-24`}
      />
    </label>
  );
}

function CardPicker({
  card,
  onPick,
  finish,
  setFinish,
  border,
  setBorder,
  quantity,
  setQuantity,
}: {
  card: CatalogCard | null;
  onPick: (c: CatalogCard) => void;
  finish: Finish;
  setFinish: (f: Finish) => void;
  border: Border;
  setBorder: (b: Border) => void;
  quantity: number;
  setQuantity: (q: number) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CatalogCard[]>([]);

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
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="min-w-0 flex-1">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar carta no catálogo (nome em inglês)..." className={`${inputClass} pl-9`} />
        </div>
        {results.length > 0 && (
          <ul className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-zinc-800">
            {results.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => onPick(c)}
                  className={`w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-800 ${card?.id === c.id ? "bg-amber-500/10 text-amber-200" : "text-zinc-300"}`}
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="mb-1.5 mt-4 text-xs font-semibold text-zinc-500">Raridade</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(FINISHES) as Finish[]).map((f) => (
            <button key={f} onClick={() => setFinish(f)} className={chip(finish === f)}>
              {FINISHES[f].label}
            </button>
          ))}
        </div>
        <p className="mb-1.5 mt-3 text-xs font-semibold text-zinc-500">Borda</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(BORDERS) as Border[]).map((b) => (
            <button key={b} onClick={() => setBorder(b)} className={chip(border === b)}>
              {BORDERS[b].label}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <QuantityInput value={quantity} onChange={setQuantity} />
        </div>
      </div>

      <div className="mx-auto w-40 shrink-0">
        {card ? (
          <>
            <FoilCard src={card.imageUrl} alt={card.name} finish={finish} border={border} />
            <p className="mt-2 text-center text-xs text-zinc-400">{card.name}</p>
          </>
        ) : (
          <div className="flex aspect-[421/614] items-center justify-center rounded-lg border border-dashed border-zinc-700 p-3 text-center text-xs text-zinc-500">
            Busque e escolha uma carta
          </div>
        )}
      </div>
    </div>
  );
}

function CosmeticPicker({
  cosmetics,
  selected,
  onSelect,
  onCreated,
}: {
  cosmetics: Cosmetic[];
  selected: string | null;
  onSelect: (id: string) => void;
  onCreated: () => void;
}) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {COSMETIC_TYPES.map((t) => {
        const list = cosmetics.filter((c) => c.type === t.type);
        return (
          <div key={t.type}>
            <p className="mb-1.5 text-xs font-semibold text-zinc-500">{t.label}</p>
            {list.length === 0 ? (
              <p className="text-xs text-zinc-600">Nenhum criado ainda.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {list.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onSelect(c.id)}
                    className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left ${
                      selected === c.id ? "border-amber-500 bg-amber-500/10" : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-600"
                    }`}
                  >
                    {c.imageUrl ? (
                      <img src={c.imageUrl} alt="" className="h-8 w-8 rounded object-cover" />
                    ) : c.effect ? (
                      <PlayerName name="nick" effect={c.effect} className="text-xs" />
                    ) : null}
                    <span>
                      <span className="block text-xs font-semibold text-zinc-100">{c.name}</span>
                      <span className="block text-[10px] text-zinc-500">
                        {RARITY_LABELS[c.rarity] ?? c.rarity}
                        {c.structureDeckId && " · exclusivo de Structure Deck"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {creating ? (
        <CreateCosmeticForm
          onDone={() => {
            setCreating(false);
            onCreated();
          }}
        />
      ) : (
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 self-start rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800">
          <Plus className="h-3.5 w-3.5" /> Criar cosmético
        </button>
      )}
    </div>
  );
}

function CreateCosmeticForm({ onDone }: { onDone: () => void }) {
  const [type, setType] = useState<string>("sleeve");
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [effect, setEffect] = useState<string>(NAME_EFFECTS[0].id);
  const [rarity, setRarity] = useState("common");
  const [error, setError] = useState<string | null>(null);
  const isNick = type === "name_style";

  async function create() {
    setError(null);
    const res = await fetch("/api/admin/cosmetics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, name, rarity, ...(isNick ? { effect } : { imageUrl }) }),
    });
    const json = await res.json();
    if (res.ok) onDone();
    else setError(json.error ?? "Não foi possível criar.");
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-700 bg-zinc-950/60 p-4">
      <p className="text-sm font-bold text-zinc-100">Novo cosmético</p>
      <div className="flex flex-wrap gap-2">
        {COSMETIC_TYPES.map((t) => (
          <button key={t.type} onClick={() => setType(t.type)} className={chip(type === t.type)}>
            {t.label}
          </button>
        ))}
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Nome, ex.: Sleeve Olho de Hórus" className={inputClass} />
      {isNick ? (
        <div className="flex flex-wrap gap-2">
          {NAME_EFFECTS.map((e) => (
            <button key={e.id} onClick={() => setEffect(e.id)} className={chip(effect === e.id)}>
              <PlayerName name={e.label} effect={e.id} />
            </button>
          ))}
        </div>
      ) : (
        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Link da imagem (https://...)" className={inputClass} />
      )}
      <div className="flex flex-wrap gap-2">
        {Object.entries(RARITY_LABELS).map(([id, label]) => (
          <button key={id} onClick={() => setRarity(id)} className={chip(rarity === id)}>
            {label}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button onClick={create} disabled={name.trim().length < 2} className="rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-bold text-black hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-600">
          Criar
        </button>
        <button onClick={onDone} className="rounded-lg border border-zinc-700 px-4 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800">
          Cancelar
        </button>
      </div>
    </div>
  );
}
