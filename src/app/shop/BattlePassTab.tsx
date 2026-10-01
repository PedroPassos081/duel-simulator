"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, Crown, Lock, Scroll, Sparkles, Timer, X } from "lucide-react";
import { FoilCard } from "@/components/FoilCard";
import { GoldIcon, CreditIcon } from "@/components/theme/CurrencyIcons";
import { EyeOfHorus, MillenniumPouch, MillenniumPyramid } from "@/components/theme/EgyptIcons";
import { nameEffectClass } from "@/lib/cosmetic-types";
import { CosmeticArtImage, PlaymatView, SleeveView } from "@/components/cosmetics/CosmeticArt";
import { FINISHES, type Finish } from "@/lib/card-finish";
import { CREDIT_LABEL } from "@/lib/shop-rules";

type Track = "free" | "premium";
interface RewardTile {
  level: number;
  track: Track;
  kind: string;
  label: string;
  imageUrl: string | null;
  finish: Finish | null;
  cosmeticType?: string;
  effect?: string | null;
  currency?: string;
  amount?: number;
  options?: ChoiceOption[];
  claimed: string | null;
}
interface ChoiceOption {
  id: string;
  name: string;
  imageUrl: string | null;
  type: string;
  effect: string | null;
}
interface Mission {
  key: string;
  period: "day" | "week";
  title: string;
  goal: number;
  xp: number;
  progress: number;
  claimed: boolean;
  resetsAt: string;
}
interface PassData {
  pass: {
    id: string;
    name: string;
    description: string | null;
    artUrl: string | null;
    endsAt: string;
    levels: number;
    xpPerLevel: number;
    xpWin: number;
    xpLoss: number;
    premiumPriceCash: number;
  };
  progress: { xp: number; level: number; premium: boolean; xpInLevel: number };
  rewards: RewardTile[];
  missions: Mission[];
}
interface Reveal {
  summary: string;
  mystery: boolean;
  reveal: { name: string; imageUrl: string | null; finish: Finish } | null;
}

const CARD_BACK = "https://images.ygoprodeck.com/images/cards/back_high.jpg";

function timeLeft(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "encerrado";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${Math.floor((ms % 3_600_000) / 60_000)}min`;
}

/** Arte de um prêmio (carta com brilho, carta surpresa, moedas, item ou cosmético). */
function RewardArt({ r, big = false }: { r: Pick<RewardTile, "kind" | "imageUrl" | "finish" | "cosmeticType" | "effect" | "currency" | "amount" | "label" | "options">; big?: boolean }) {
  const size = big ? "h-12 w-12" : "h-8 w-8";
  switch (r.kind) {
    case "card":
    case "structure":
      return <FoilCard src={r.imageUrl} alt={r.label} finish={r.finish ?? "normal"} interactive={false} className="w-full" />;
    case "mystery_card":
      return (
        <div className="relative w-full overflow-hidden rounded-[6%]">
          <img src={CARD_BACK} alt="Carta surpresa" className="aspect-[59/86] w-full object-cover" />
          <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle,rgba(168,85,247,0.45),transparent_70%)]" />
          <span className="absolute inset-0 flex items-center justify-center text-3xl font-black text-amber-200 drop-shadow-[0_0_8px_rgba(0,0,0,0.9)]">?</span>
        </div>
      );
    case "currency":
      return (
        <div className="flex aspect-[59/86] w-full flex-col items-center justify-center gap-1 rounded-[6%] bg-[radial-gradient(circle,rgba(251,191,36,0.18),transparent_70%)]">
          {r.currency === "gold" ? <GoldIcon className={`${size} text-amber-400`} /> : <CreditIcon className={`${size} text-purple-400`} />}
          <span className={`font-black ${r.currency === "gold" ? "text-amber-300" : "text-purple-300"} ${big ? "text-lg" : "text-sm"}`}>{r.amount?.toLocaleString("pt-BR")}</span>
        </div>
      );
    case "vip":
      return (
        <div className="flex aspect-[59/86] w-full flex-col items-center justify-center gap-1 rounded-[6%] bg-[radial-gradient(circle,rgba(251,191,36,0.28),transparent_70%)]">
          <Crown className={`${size} text-amber-300`} />
          <span className="font-black text-amber-200">VIP {r.amount}d</span>
        </div>
      );
    case "item":
      return (
        <div className="flex aspect-[59/86] w-full items-center justify-center rounded-[6%] bg-[radial-gradient(circle,rgba(56,189,248,0.18),transparent_70%)]">
          <MillenniumPouch className={`${big ? "h-14 w-14" : "h-10 w-10"} text-amber-300`} />
        </div>
      );
    case "choice_cosmetic":
      // As opções em leque: o jogador escolhe uma ao resgatar
      return (
        <div className="relative aspect-[59/86] w-full">
          {(r.options ?? []).slice(0, 3).map((o, i) => (
            <div
              key={o.id}
              className="absolute inset-y-[8%] w-[62%] overflow-hidden rounded-md border border-amber-300/70 bg-zinc-950 shadow-lg"
              style={{ left: `${i * 19}%`, transform: `rotate(${(i - 1) * 8}deg)`, zIndex: i }}
            >
              {o.imageUrl && <CosmeticArtImage url={o.imageUrl} />}
            </div>
          ))}
          <span className="absolute bottom-0 right-0 z-10 rounded bg-amber-400 px-1 text-[9px] font-black text-black">1 de {r.options?.length ?? 3}</span>
        </div>
      );
    case "cosmetic":
      if (r.cosmeticType === "name_style") {
        return (
          <div className="flex aspect-[59/86] w-full items-center justify-center rounded-[6%] bg-zinc-950/80">
            <span className={`${nameEffectClass(r.effect)} text-lg font-black`}>@Nick</span>
          </div>
        );
      }
      return (
        <div className={`flex aspect-[59/86] w-full items-center justify-center overflow-hidden rounded-[6%] ${r.cosmeticType === "frame" ? "bg-zinc-950/80 p-1" : ""}`}>
          {r.imageUrl &&
            (r.cosmeticType === "frame" ? (
              <img src={r.imageUrl} alt={r.label} className="w-full" />
            ) : (
              <div className="relative h-full w-full">
                <CosmeticArtImage url={r.imageUrl} />
              </div>
            ))}
        </div>
      );
    default:
      return null;
  }
}

/** Aba Passe de Batalha: nível, XP, trilha grátis e Premium, missões e a revelação dos prêmios. */
export function BattlePassTab() {
  const router = useRouter();
  const [data, setData] = useState<PassData | null | undefined>(undefined);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [choosing, setChoosing] = useState<RewardTile | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/battle-pass", { cache: "no-store" });
    setData(res.ok ? await res.json() : null);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  // Abre a trilha no nível atual
  useEffect(() => {
    if (!data || scrolled.current || !track.current) return;
    scrolled.current = true;
    const col = track.current.querySelector<HTMLElement>(`[data-level="${Math.max(1, data.progress.level)}"]`);
    if (col) track.current.scrollLeft = col.offsetLeft - track.current.clientWidth / 2 + col.clientWidth / 2;
  }, [data]);

  async function post(body: object, key: string) {
    setBusy(key);
    setFeedback(null);
    const res = await fetch("/api/battle-pass", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) {
      setFeedback({ ok: false, text: json.error ?? "Não foi possível." });
      return null;
    }
    await load();
    router.refresh(); // saldo na barra do topo
    return json;
  }

  async function claim(r: RewardTile, choiceId?: string) {
    // Prêmio de escolha: abre as opções primeiro
    if (r.kind === "choice_cosmetic" && !choiceId) return setChoosing(r);
    setChoosing(null);
    const json = await post({ action: "claim", level: r.level, track: r.track, choiceId }, `${r.level}-${r.track}`);
    if (!json) return;
    setFlipped(!json.mystery);
    setReveal(json);
    if (json.mystery) setTimeout(() => setFlipped(true), 900);
  }

  const byLevel = useMemo(() => {
    const map = new Map<number, { free?: RewardTile; premium?: RewardTile }>();
    for (const r of data?.rewards ?? []) map.set(r.level, { ...map.get(r.level), [r.track]: r });
    return map;
  }, [data]);

  if (data === undefined) return <p className="text-sm text-zinc-400">Carregando o passe...</p>;
  if (data === null)
    return (
      <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-12 text-center text-sm text-zinc-500">
        Nenhum Passe de Batalha ativo agora. A próxima temporada chega em breve!
      </p>
    );

  const { pass, progress } = data;
  const maxed = progress.level >= pass.levels;
  const pct = maxed ? 100 : Math.round((progress.xpInLevel / pass.xpPerLevel) * 100);
  const claimable = data.rewards.filter((r) => !r.claimed && r.level <= progress.level && (r.track === "free" || progress.premium)).length;
  const highlights = data.rewards.filter((r) => r.track === "premium" && (r.kind === "cosmetic" || (r.kind === "card" && r.finish && r.finish !== "normal")));

  const tile = (r: RewardTile | undefined, level: number, trackName: Track) => {
    if (!r) return <div className="h-[168px]" />;
    const reached = level <= progress.level;
    const locked = trackName === "premium" && !progress.premium;
    const canClaim = reached && !locked && !r.claimed;
    const premium = trackName === "premium";
    return (
      <div
        className={`relative flex h-[168px] flex-col gap-1 rounded-xl border p-1.5 transition ${
          premium ? "border-amber-400/50 bg-gradient-to-b from-amber-500/15 via-zinc-950/80 to-purple-950/40" : "border-zinc-700 bg-zinc-900/70"
        } ${canClaim ? "shadow-[0_0_18px_rgba(251,191,36,0.55)] ring-2 ring-amber-300" : ""} ${!reached ? "opacity-60" : ""}`}
        title={r.claimed ? `Resgatado: ${r.claimed}` : r.label}
      >
        <div className="mx-auto w-[84px]">
          <RewardArt r={r} />
        </div>
        <p className="line-clamp-2 min-h-[26px] text-center text-[10px] font-semibold leading-tight text-zinc-200">{r.label}</p>
        {r.finish && r.finish !== "normal" && (
          <span className={`absolute left-1 top-1 rounded px-1 text-[9px] font-black ${FINISHES[r.finish].badge}`}>{FINISHES[r.finish].label}</span>
        )}
        {r.claimed ? (
          <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/55">
            <Check className="h-8 w-8 text-emerald-400 drop-shadow" />
          </span>
        ) : locked ? (
          <span className="absolute right-1 top-1 rounded-full bg-black/70 p-1" title="Trilha Premium">
            <Lock className="h-3 w-3 text-amber-300" />
          </span>
        ) : canClaim ? (
          <button
            disabled={busy !== null}
            onClick={() => claim(r)}
            className="absolute inset-x-1.5 bottom-1.5 rounded-md bg-gradient-to-b from-amber-300 to-amber-500 py-0.5 text-[11px] font-black text-black hover:brightness-110 disabled:opacity-50"
          >
            {busy === `${r.level}-${r.track}` ? "..." : r.kind === "choice_cosmetic" ? "Escolher" : "Resgatar"}
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {/* TOPO: arte da temporada, nível, XP e Premium */}
      <section className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-zinc-950">
        {pass.artUrl && <img src={pass.artUrl} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[center_30%] opacity-45" />}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/85 to-purple-950/40" />
        <EyeOfHorus className="pointer-events-none absolute -right-6 -top-4 h-40 w-64 text-amber-400/10" />
        <div className="relative flex flex-col gap-5 p-5 md:flex-row md:items-center">
          {/* Nível na Pirâmide do Milênio */}
          <div className="relative mx-auto flex h-32 w-32 shrink-0 items-center justify-center md:mx-0">
            <MillenniumPyramid className="absolute inset-0 h-full w-full text-amber-400 drop-shadow-[0_0_18px_rgba(251,191,36,0.55)]" />
            <span className="relative mt-8 text-center">
              <span className="block text-[10px] font-black uppercase tracking-widest text-black/70">Nível</span>
              <span className="block text-3xl font-black leading-none text-black">{progress.level}</span>
            </span>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-amber-300">Passe de Batalha</p>
            <h2 className="text-2xl font-black text-zinc-50 [text-shadow:0_2px_8px_rgba(0,0,0,0.9)]">{pass.name}</h2>
            {pass.description && <p className="max-w-2xl text-sm text-zinc-300">{pass.description}</p>}
            <div className="mt-1 flex items-center gap-3">
              <div className="h-3 flex-1 overflow-hidden rounded-full border border-amber-500/40 bg-black/60">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-600 via-amber-300 to-yellow-100 shadow-[0_0_10px_rgba(251,191,36,0.7)] transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="shrink-0 font-mono text-xs font-bold text-amber-200">{maxed ? "MÁX" : `${progress.xpInLevel}/${pass.xpPerLevel} XP`}</span>
            </div>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
              <span className="flex items-center gap-1">
                <Timer className="h-3.5 w-3.5" /> Termina em {timeLeft(pass.endsAt)}
              </span>
              <span>
                +{pass.xpWin} XP por vitória · +{pass.xpLoss} XP por duelo
              </span>
              {claimable > 0 && <span className="font-bold text-amber-300">{claimable} prêmio(s) para resgatar!</span>}
            </p>
          </div>

          <div className="shrink-0 md:w-56">
            {progress.premium ? (
              <div className="flex flex-col items-center gap-1 rounded-xl border border-amber-400/60 bg-gradient-to-b from-amber-400/25 to-purple-600/20 px-4 py-3 text-center">
                <Crown className="h-7 w-7 text-amber-300" />
                <p className="text-sm font-black uppercase tracking-wider text-amber-200">Premium ativo</p>
                <p className="text-[11px] text-zinc-300">Toda a trilha dourada é sua.</p>
              </div>
            ) : (
              <button
                disabled={busy !== null}
                onClick={() => confirm(`Ativar o Premium por ${pass.premiumPriceCash} ${CREDIT_LABEL.toLowerCase()}? Os prêmios dourados dos níveis que você já alcançou ficam liberados na hora.`) && post({ action: "buy_premium" }, "premium")}
                className="group flex w-full flex-col items-center gap-1 rounded-xl border border-amber-300 bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 px-4 py-3 text-black shadow-[0_0_24px_rgba(251,191,36,0.45)] transition hover:brightness-110 disabled:opacity-50"
              >
                <Crown className="h-7 w-7" />
                <span className="text-sm font-black uppercase tracking-wider">Ativar Premium</span>
                <span className="flex items-center gap-1 text-xs font-bold">
                  <CreditIcon className="h-3.5 w-3.5" /> {pass.premiumPriceCash} {CREDIT_LABEL.toLowerCase()}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Destaques da trilha Premium */}
        {highlights.length > 0 && (
          <div className="relative flex gap-3 overflow-x-auto border-t border-amber-500/20 bg-black/40 px-5 py-3">
            <p className="flex shrink-0 items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-300 [writing-mode:vertical-rl] rotate-180">
              <Sparkles className="h-3 w-3" /> Destaques
            </p>
            {highlights.map((r) => (
              <div key={`${r.level}-${r.track}`} className="w-20 shrink-0 text-center">
                <RewardArt r={r} />
                <p className="mt-1 truncate text-[10px] text-zinc-300" title={r.label}>
                  Nv {r.level} · {r.label}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {feedback && (
        <p className={`rounded-lg border px-3 py-2 text-sm ${feedback.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>{feedback.text}</p>
      )}

      {/* TRILHA */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
        <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wider">
          <span className="flex items-center gap-1 text-amber-300">
            <Crown className="h-3.5 w-3.5" /> Premium
          </span>
          <span className="text-zinc-500">Arraste para ver os {pass.levels} níveis</span>
        </div>
        <div ref={track} className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">
          {Array.from({ length: pass.levels }, (_, i) => i + 1).map((level) => {
            const reached = level <= progress.level;
            const rewards = byLevel.get(level) ?? {};
            return (
              <div key={level} data-level={level} className="flex w-[104px] shrink-0 flex-col gap-2">
                {tile(rewards.premium, level, "premium")}
                {/* Nó do nível na linha do progresso */}
                <div className="relative flex items-center justify-center">
                  <span className={`absolute inset-x-[-4px] h-1 ${reached ? "bg-gradient-to-r from-amber-500 to-amber-300" : "bg-zinc-800"}`} />
                  <span
                    className={`relative flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-black ${
                      level === progress.level ? "border-amber-200 bg-amber-400 text-black shadow-[0_0_14px_rgba(251,191,36,0.8)]" : reached ? "border-amber-500 bg-amber-600 text-black" : "border-zinc-700 bg-zinc-900 text-zinc-500"
                    }`}
                  >
                    {level}
                  </span>
                </div>
                {tile(rewards.free, level, "free")}
              </div>
            );
          })}
        </div>
        <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Grátis</p>
      </section>

      {/* MISSÕES */}
      <section className="grid gap-3 md:grid-cols-2">
        {(["day", "week"] as const).map((period) => (
          <div key={period} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h3 className="mb-3 flex items-center gap-2 font-bold text-zinc-100">
              <Scroll className="h-4 w-4 text-amber-300" /> Missões {period === "day" ? "diárias" : "semanais"}
              {data.missions[0] && (
                <span className="ml-auto text-[11px] font-normal text-zinc-500">
                  renovam em {timeLeft(data.missions.find((m) => m.period === period)?.resetsAt ?? pass.endsAt)}
                </span>
              )}
            </h3>
            {data.missions.length === 0 ? (
              <p className="text-sm text-zinc-500">Entre na sua conta para ver as missões.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {data.missions
                  .filter((m) => m.period === period)
                  .map((m) => {
                    const done = m.progress >= m.goal;
                    return (
                      <li key={m.key} className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center justify-between text-sm text-zinc-200">
                            {m.title}
                            <span className="text-xs text-zinc-400">
                              {m.progress}/{m.goal}
                            </span>
                          </p>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                            <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300" style={{ width: `${(m.progress / m.goal) * 100}%` }} />
                          </div>
                        </div>
                        {m.claimed ? (
                          <span className="flex w-24 items-center justify-center gap-1 text-xs font-bold text-emerald-400">
                            <Check className="h-3.5 w-3.5" /> Feita
                          </span>
                        ) : (
                          <button
                            disabled={!done || busy !== null}
                            onClick={() => post({ action: "mission", key: m.key }, m.key).then((j) => j && setFeedback({ ok: true, text: j.message }))}
                            className="w-24 rounded-lg bg-amber-500 px-2 py-1.5 text-xs font-black text-black hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-500"
                          >
                            +{m.xp} XP
                          </button>
                        )}
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
        ))}
      </section>

      {/* ESCOLHA 1 ENTRE AS OPÇÕES (playmat ou sleeve) */}
      {choosing &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm" onClick={() => setChoosing(null)}>
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl rounded-2xl border border-amber-500/40 bg-zinc-950 p-5">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-300">Nível {choosing.level} · escolha o seu</p>
                <button onClick={() => setChoosing(null)} className="text-zinc-400 hover:text-white" aria-label="Fechar">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mb-4 text-sm text-zinc-400">Você fica com um só. Os outros poderão ser comprados na aba Cosméticos quando forem liberados.</p>
              <div className="grid gap-4 sm:grid-cols-3">
                {(choosing.options ?? []).map((o) => (
                  <button
                    key={o.id}
                    disabled={busy !== null}
                    onClick={() => confirm(`Ficar com "${o.name}"? Não dá para trocar depois.`) && claim(choosing, o.id)}
                    className="group flex flex-col items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/60 p-3 transition hover:border-amber-400 hover:bg-zinc-900 disabled:opacity-50"
                  >
                    {o.type === "playmat" ? (
                      <PlaymatView url={o.imageUrl} theme={o.effect} className="w-full" />
                    ) : (
                      <SleeveView url={o.imageUrl} className="h-48" />
                    )}
                    <span className="text-sm font-bold text-zinc-100 group-hover:text-amber-200">{o.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* REVELAÇÃO DO PRÊMIO (a carta surpresa vira) */}
      {reveal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm" onClick={() => setReveal(null)}>
            <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-xs flex-col items-center gap-4 text-center">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-amber-300">{reveal.mystery ? "Carta surpresa" : "Prêmio resgatado"}</p>
              {reveal.reveal ? (
                <div className="w-56 [perspective:900px]">
                  <div className={`relative transition-transform duration-700 [transform-style:preserve-3d] ${flipped ? "[transform:rotateY(0deg)]" : "[transform:rotateY(180deg)]"}`}>
                    <div className="[backface-visibility:hidden]">
                      <FoilCard src={reveal.reveal.imageUrl} alt={reveal.reveal.name} finish={reveal.reveal.finish} />
                    </div>
                    <img src={CARD_BACK} alt="" className="absolute inset-0 h-full w-full rounded-[6%] object-cover [backface-visibility:hidden] [transform:rotateY(180deg)]" />
                  </div>
                </div>
              ) : (
                <Sparkles className="h-16 w-16 text-amber-300" />
              )}
              <p className={`text-lg font-black text-zinc-50 transition-opacity ${flipped || !reveal.mystery ? "opacity-100" : "opacity-0"}`}>{reveal.summary}</p>
              {reveal.reveal && reveal.reveal.finish !== "normal" && flipped && (
                <span className={`rounded px-2 py-0.5 text-xs font-black ${FINISHES[reveal.reveal.finish].badge}`}>{FINISHES[reveal.reveal.finish].label}</span>
              )}
              <button onClick={() => setReveal(null)} className="flex items-center gap-1 rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800">
                <X className="h-4 w-4" /> Fechar
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
