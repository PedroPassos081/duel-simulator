"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Ban,
  Bot,
  Bug,
  Eye,
  Layers,
  Loader2,
  Circle,
  Crown,
  Hand,
  Mountain,
  Scissors,
  Send,
  ShieldX,
  Skull,
  Sparkles,
  Swords,
  X,
} from "lucide-react";
import type { Card, DeckSection } from "@/types/card";

type EquippedDeck = {
  id: string;
  name: string;
  isEquipped: boolean;
  cards: { section: DeckSection; quantity: number; card: Card }[];
};

type RoomState = {
  id: string;
  status: "waiting" | "rps" | "choosing" | "active" | "finished";
  meId: string;
  rpsRound: number;
  rpsDeadline?: string | null;
  rpsWinnerId?: string;
  firstPlayerId?: string;
  game?: RoomGameState | null;
  players: {
    id: string;
    nickname: string;
    choiceSubmitted: boolean;
    rpsChoice?: "rock" | "paper" | "scissors";
  }[];
};

type RoomGameState = {
  meId: string;
  ownHand: Card[];
  ownMonsters: FieldCardView[];
  ownSpellTraps: FieldCardView[];
  opponentMonsters: FieldCardView[];
  opponentSpellTraps: FieldCardView[];
  ownDeckCount: number;
  ownExtraCount: number;
  ownGraveyard: Card[];
  ownBanished: Card[];
  opponentHandCount: number;
  opponentDeckCount: number;
  opponentExtraCount: number;
  opponentGraveyard: Card[];
  opponentBanished: Card[];
  ownLifePoints: number;
  opponentLifePoints: number;
  ownUser: { nickname: string; image: string | null };
  opponentUser: { nickname: string; image: string | null };
  winnerId?: string | null;
  youWon?: boolean | null;
  isYourTurn: boolean;
  currentTurn: number;
  currentPhase: string;
  legalActions: Record<string, DuelCardAction[]>;
  attackableMonsters: Array<{
    cardId: number;
    zone: number;
    canDirect: boolean;
  }>;
  specialSummonCandidates: Card[];
  decision?: OcgDecision | null;
  chain?: {
    card: Card | null;
    linkCount: number;
    awaitingYou: boolean;
    controllerId: string | null;
    deadlineAt?: string | null;
    canForceClose: boolean;
    // Cartas que você pode ativar nesta janela (ex.: Kalut no cálculo de dano).
    options?: Card[];
  } | null;
};

type OcgDecision =
  | {
      type: "yes_no";
      source: "effect" | "generic";
      cardId?: number;
      description: string;
      card?: Card | null;
    }
  | { type: "option"; options: string[] }
  | {
      type: "cards" | "tributes" | "battle_targets";
      min: number;
      max: number;
      canCancel: boolean;
      candidates: Array<{
        index: number;
        cardId: number;
        controllerId: string;
        location: number;
        sequence: number;
        card: Card | null;
      }>;
    }
  | {
      type: "position";
      cardId: number;
      positions: number[];
      card: Card | null;
    }
  | {
      type: "place";
      count: number;
      places: Array<{
        index: number;
        controllerId: string;
        location: number;
        sequence: number;
      }>;
    }
  | {
      type: "sum";
      target: number;
      min: number;
      max: number;
      mustCards: Array<{
        index: number;
        cardId: number;
        controllerId: string;
        location: number;
        sequence: number;
        amount: number;
        card: Card | null;
      }>;
      candidates: Array<{
        index: number;
        cardId: number;
        controllerId: string;
        location: number;
        sequence: number;
        amount: number;
        card: Card | null;
      }>;
    }
  | {
      type: "unselect";
      canFinish: boolean;
      canCancel: boolean;
      min: number;
      max: number;
      selectable: Array<{
        index: number;
        cardId: number;
        controllerId: string;
        location: number;
        sequence: number;
        card: Card | null;
      }>;
      selected: Array<{
        index: number;
        cardId: number;
        controllerId: string;
        location: number;
        sequence: number;
        card: Card | null;
      }>;
    };

type DuelCardAction =
  | "summon"
  | "set_monster"
  | "set_spell_trap"
  | "activate"
  | "special_summon"
  | "attack";

type FieldCardView = {
  card?: Card;
  faceDown: boolean;
  position: string;
  zone: number;
};

type PendingPlacement = {
  action: "summon" | "set_monster";
  cardId: number;
  kind: "monster";
};

const PHASES = ["DP", "SP", "MP1", "BP", "MP2", "EP"];
const PHASE_KEYS: Record<string, string> = {
  DP: "draw",
  SP: "standby",
  MP1: "main1",
  BP: "battle",
  MP2: "main2",
  EP: "end",
};

const PHASE_NAMES: Record<string, string> = {
  DP: "Draw Phase",
  SP: "Standby Phase",
  MP1: "Main Phase 1",
  BP: "Battle Phase",
  MP2: "Main Phase 2",
  EP: "End Phase (encerra o turno)",
};

// Todo o tabuleiro é dimensionado a partir de `--z` (altura de uma zona),
// definida no container da página. Assim o campo inteiro escala junto com a
// tela mantendo as proporções.
const ZONE_SIZE = "h-[var(--z)] w-[calc(var(--z)*0.71)]";
const UI_TEXT = "text-[length:clamp(10px,calc(var(--z)*0.085),13px)]";
// Popups do duelo (chains, decisões de efeito etc.) ficam centralizados no
// tabuleiro: ocupam só a área à direita do painel lateral (--panel-w), onde o
// tabuleiro também é centralizado.
const BOARD_OVERLAY = "absolute inset-y-0 right-0 left-[var(--panel-w)]";

function lastCard(cards?: Card[]) {
  return cards?.[cards.length - 1];
}

// Espaçamento entre as cartas da mão: acima de `maxCards` elas passam a se
// sobrepor para a mão continuar com a mesma largura.
function handSpacing(count: number, cardWidth: number, maxCards: number) {
  if (count <= maxCards) return "calc(var(--z) * 0.04)";
  return `calc(var(--z) * ${(-cardWidth * (count - maxCards)) / (count - 1)})`;
}

// Leque sutil da mão: as cartas das pontas giram e descem um pouco.
function fanTransform(index: number, count: number, opponent = false) {
  const offset = index - (count - 1) / 2;
  const angle = Math.max(-6, Math.min(6, offset * 1.8));
  if (opponent) return `rotate(${-angle}deg)`;
  const drop = Math.min(0.035, offset * offset * 0.006);
  return `translateY(calc(var(--z) * ${drop})) rotate(${angle}deg)`;
}

function CardBack({ className = "h-full w-full" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-[3px] bg-black ${className}`}>
      <Image
        src="/assets/master-duelist-card-back.svg"
        alt="Verso Master Duelist"
        fill
        sizes="120px"
        className="object-cover"
        unoptimized
      />
    </div>
  );
}

// O contador fica sempre legível, mas do lado de quem é dono da pilha: embaixo
// para nós, em cima para o oponente (que "senta" do outro lado da mesa).
function PileCount({ count, opponent = false }: { count: number; opponent?: boolean }) {
  return (
    <span
      className={`pointer-events-none absolute left-1/2 z-10 min-w-[22px] -translate-x-1/2 rounded-full border border-edison-gold/60 bg-[#0b0d12] px-1.5 text-center font-mono text-[11px] font-bold leading-[16px] text-edison-gold shadow-[0_2px_6px_rgba(0,0,0,0.6)] ${
        opponent ? "top-0 -translate-y-1/2" : "bottom-0 translate-y-1/2"
      }`}
    >
      {count}
    </span>
  );
}

function SidePile({
  label,
  count,
  topCard,
  faceDown = false,
  opponent = false,
  onSelect,
  overlay,
  icon,
}: {
  label: string;
  count: number;
  topCard?: Card;
  faceDown?: boolean;
  opponent?: boolean;
  onSelect?: (card: Card) => void;
  overlay?: ReactNode;
  icon?: ReactNode;
}) {
  const clickable = !faceDown && Boolean(topCard) && Boolean(onSelect);
  const filled = faceDown ? count > 0 : Boolean(topCard);
  return (
    <div className={`relative shrink-0 ${ZONE_SIZE}`}>
      {/* As pilhas do oponente ficam viradas para ele, como numa mesa real. */}
      <button
        type="button"
        disabled={!clickable}
        onClick={() => topCard && onSelect?.(topCard)}
        title={label}
        className={`relative h-full w-full overflow-hidden transition ${
          filled
            ? "rounded-[4px] shadow-[0_6px_14px_rgba(0,0,0,0.6)] ring-1 ring-black/60"
            : "rounded-md border border-dashed border-white/20 bg-black/30"
        } ${clickable ? "hover:-translate-y-0.5 hover:brightness-110" : "cursor-default"} ${
          opponent ? "rotate-180" : ""
        }`}
      >
        {faceDown && count > 0 ? (
          <Image
            src="/assets/master-duelist-card-back.svg"
            alt={label}
            fill
            sizes="120px"
            className="object-cover"
            unoptimized
          />
        ) : !faceDown && topCard?.imageUrl ? (
          <Image
            src={topCard.imageUrl}
            alt={`${label}: ${topCard.name}`}
            fill
            sizes="120px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-white/30">
            {icon}
            <span className="text-[9px] font-bold uppercase leading-none tracking-[0.14em]">
              {label}
            </span>
          </div>
        )}
      </button>
      {overlay}
      {count > 0 && <PileCount count={count} opponent={opponent} />}
    </div>
  );
}

function EmptyZone({
  kind,
  opponent,
}: {
  kind: "monster" | "spell";
  opponent: boolean;
}) {
  const Icon = kind === "monster" ? Swords : Sparkles;
  const tone = opponent
    ? kind === "monster"
      ? "border-rose-300/45 bg-rose-400/[0.07] shadow-[inset_0_0_16px_rgba(251,113,133,0.14)]"
      : "border-rose-300/25 bg-rose-400/[0.035]"
    : kind === "monster"
      ? "border-sky-300/50 bg-sky-400/[0.07] shadow-[inset_0_0_16px_rgba(56,152,255,0.16)]"
      : "border-sky-300/28 bg-sky-400/[0.035]";
  return (
    <div
      className={`flex h-full w-full items-center justify-center rounded-md border ${tone} ${
        opponent ? "rotate-180" : ""
      }`}
    >
      <Icon
        strokeWidth={1.4}
        className={`h-[26%] w-[26%] ${opponent ? "text-rose-200/20" : "text-sky-200/20"}`}
      />
    </div>
  );
}

function ZoneRow({
  opponent = false,
  kind,
  cards = [],
  onSelect,
  selectable = false,
  selectableZones,
  onZoneSelect,
  attackableZones,
  targetableZones,
  onAttack,
  onTarget,
}: {
  opponent?: boolean;
  kind: "monster" | "spell";
  cards?: FieldCardView[];
  onSelect?: (card: Card) => void;
  selectable?: boolean;
  selectableZones?: number[];
  onZoneSelect?: (zone: number) => void;
  attackableZones?: number[];
  targetableZones?: number[];
  onAttack?: (cardId: number, zone: number) => void;
  onTarget?: (zone: number) => void;
}) {
  return (
    // O lado do oponente é espelhado: a zona 0 dele fica à nossa direita.
    <div
      className={`flex gap-[calc(var(--z)*0.26)] ${opponent ? "flex-row-reverse" : ""}`}
    >
      {Array.from({ length: 5 }, (_, index) => {
        const fieldCard = cards.find((entry) => entry.zone === index);
        const card = fieldCard?.card;
        const defensePosition =
          fieldCard?.position === "face_down_defense" ||
          fieldCard?.position === "face_up_defense";
        const zoneIsSelectable =
          selectable &&
          (selectableZones === undefined || selectableZones.includes(index));
        const attackable = Boolean(
          card && attackableZones?.includes(index)
        );
        const targetable = Boolean(targetableZones?.includes(index));
        const rotation = opponent
          ? defensePosition
            ? "rotate-[270deg]"
            : "rotate-180"
          : defensePosition
            ? "rotate-90"
            : "";
        const showStats =
          kind === "monster" &&
          fieldCard &&
          !fieldCard.faceDown &&
          card &&
          card.atk !== null;
        // A pílula de ATK/DEF fica voltada para a linha central, onde os dois
        // lados se enfrentam; em defesa ela acompanha a carta deitada.
        const statsPosition = opponent
          ? defensePosition
            ? "bottom-[calc(var(--z)*0.145)] translate-y-1/2"
            : "bottom-0 translate-y-1/2"
          : defensePosition
            ? "top-[calc(var(--z)*0.145)] -translate-y-1/2"
            : "top-0 -translate-y-1/2";
        return fieldCard ? (
          <button
            key={`${card?.id ?? "hidden"}-${index}`}
            type="button"
            onClick={() => {
              if (targetable) {
                onTarget?.(index);
              } else if (attackable && card) {
                onAttack?.(card.id, index);
              } else if (card) {
                onSelect?.(card);
              }
            }}
            className={`group relative shrink-0 hover:z-20 animate-card-summon ${ZONE_SIZE}`}
            title={
              targetable
                ? "Clique para escolher este monstro como alvo do ataque"
                : attackable
                  ? "Clique para atacar com este monstro"
                  : fieldCard.faceDown && card && !opponent
                ? `Carta setada: ${card.name}`
                : card
                  ? `Ver ${card.name}`
                  : "Carta virada para baixo"
            }
          >
            <div
              className={`absolute inset-0 overflow-hidden rounded-[4px] bg-black/40 transition duration-300 group-hover:-translate-y-1 group-hover:brightness-110 ${rotation} ${
                attackable
                  ? "animate-pulse shadow-[0_0_24px_rgba(251,113,133,0.75)] ring-2 ring-rose-400"
                  : targetable
                    ? "animate-pulse shadow-[0_0_26px_rgba(224,178,60,0.8)] ring-2 ring-edison-gold"
                    : "shadow-[0_6px_14px_rgba(0,0,0,0.6)] ring-1 ring-black/60"
              }`}
            >
              {fieldCard.faceDown ? (
                <>
                  <div className="absolute inset-0 transition duration-300 group-hover:opacity-25">
                    <CardBack />
                  </div>
                  {!opponent && card?.imageUrl && (
                    <Image
                      src={card.imageUrl}
                      alt={`Prévia de ${card.name}`}
                      fill
                      sizes="120px"
                      className="object-cover opacity-0 brightness-[0.45] saturate-[0.72] transition duration-300 group-hover:opacity-90"
                      unoptimized
                    />
                  )}
                </>
              ) : !card?.imageUrl ? (
                <CardBack />
              ) : (
                <Image
                  src={card.imageUrl}
                  alt={card.name}
                  fill
                  sizes="120px"
                  className="object-cover"
                  unoptimized
                />
              )}
            </div>
            {showStats && (
              <span
                className={`pointer-events-none absolute left-1/2 z-10 flex -translate-x-1/2 items-center gap-[3px] whitespace-nowrap rounded-full border border-white/15 bg-[#07090d]/90 px-1.5 font-mono text-[length:clamp(9px,calc(var(--z)*0.078),12px)] font-bold leading-[1.55] shadow-lg ${statsPosition}`}
              >
                {card.level !== null && (
                  <span className="mr-0.5 text-amber-300">
                    {card.type.includes("XYZ") ? "☆" : "★"}
                    {card.level}
                  </span>
                )}
                <span className="text-rose-300">{card.atk}</span>
                <span className="text-white/35">/</span>
                <span className="text-sky-300">{card.def ?? "-"}</span>
              </span>
            )}
            {(attackable || targetable) && (
              <span className="pointer-events-none absolute inset-x-1 top-1/2 z-10 -translate-y-1/2 rounded bg-black/85 px-1 py-1 text-center text-[9px] font-black uppercase tracking-wider text-white">
                {targetable ? "Alvo" : "Atacar"}
              </span>
            )}
          </button>
        ) : (
          <button
            key={index}
            type="button"
            disabled={!zoneIsSelectable}
            onClick={() => zoneIsSelectable && onZoneSelect?.(index)}
            className={`shrink-0 rounded-md p-0 transition ${ZONE_SIZE} ${
              zoneIsSelectable
                ? "animate-pulse ring-2 ring-edison-gold hover:bg-edison-gold/15"
                : ""
            }`}
          >
            <EmptyZone kind={kind} opponent={opponent} />
          </button>
        );
      })}
    </div>
  );
}

function FieldZone({
  fieldCard,
  opponent = false,
  selectable = false,
  onSelect,
  onZoneSelect,
}: {
  fieldCard?: FieldCardView;
  opponent?: boolean;
  selectable?: boolean;
  onSelect?: (card: Card) => void;
  onZoneSelect?: () => void;
}) {
  const card = fieldCard?.card;
  if (fieldCard) {
    return (
      <button
        type="button"
        onClick={() => card && onSelect?.(card)}
        className={`relative shrink-0 overflow-hidden rounded-[4px] bg-black/30 shadow-[0_6px_14px_rgba(0,0,0,0.6)] ring-1 ring-black/60 animate-card-summon ${ZONE_SIZE} ${
          opponent ? "rotate-180" : ""
        }`}
      >
        {fieldCard.faceDown || !card?.imageUrl ? (
          <CardBack />
        ) : (
          <Image
            src={card.imageUrl}
            alt={card.name}
            fill
            sizes="120px"
            className="object-cover"
            unoptimized
          />
        )}
      </button>
    );
  }
  return (
    <button
      type="button"
      disabled={!selectable}
      onClick={onZoneSelect}
      title="Zona de Campo"
      className={`flex shrink-0 flex-col items-center justify-center gap-1.5 rounded-md border border-edison-gold/35 bg-edison-gold/[0.05] text-edison-gold/40 shadow-[inset_0_0_16px_rgba(224,178,60,0.12)] transition ${ZONE_SIZE} ${
        selectable ? "animate-pulse ring-2 ring-edison-gold hover:bg-edison-gold/15" : ""
      } ${opponent ? "rotate-180" : ""}`}
    >
      <Mountain strokeWidth={1.4} className="h-[24%] w-[24%]" />
      <span className="text-[9px] font-bold uppercase leading-none tracking-[0.14em]">
        Campo
      </span>
    </button>
  );
}

// Círculo decorativo dos playmats (identidade própria do Master Duelist).
function ArcaneCircle({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      stroke="currentColor"
      aria-hidden
      className={`absolute left-1/2 top-1/2 h-[88%] -translate-x-1/2 -translate-y-1/2 ${className}`}
    >
      <circle cx="100" cy="100" r="97" strokeWidth="0.9" />
      <circle cx="100" cy="100" r="90" strokeWidth="0.5" strokeDasharray="1.5 3.5" />
      <circle cx="100" cy="100" r="64" strokeWidth="0.7" />
      <polygon points="100,10 177.9,145 22.1,145" strokeWidth="0.7" />
      <polygon points="100,190 22.1,55 177.9,55" strokeWidth="0.7" />
      <circle cx="100" cy="100" r="22" strokeWidth="0.7" />
    </svg>
  );
}

function CardInspector({ card }: { card?: Card }) {
  const [panel, setPanel] = useState<"card" | "chat" | "log" | "options">("card");
  const [chatText, setChatText] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [report, setReport] = useState("");
  const [reportStatus, setReportStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    if (card) setPanel("card");
  }, [card]);

  function addLocalMessage() {
    const message = chatText.trim();
    if (!message) return;
    setMessages((current) => [...current, message]);
    setChatText("");
  }

  async function sendReport() {
    if (report.trim().length < 10) return;
    setReportStatus("sending");
    const response = await fetch("/api/duel/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: report.trim(),
        context: "Tela de duelo · Turno 01 · Main Phase 1",
      }),
    });
    if (response.ok) {
      setReportStatus("sent");
      setReport("");
    } else {
      setReportStatus("error");
    }
  }

  const tabs = [
    { key: "card", label: "Carta" },
    { key: "chat", label: "Chat" },
    { key: "log", label: "Log" },
    { key: "options", label: "Opções" },
  ] as const;

  return (
    <aside className="relative flex h-full w-[var(--panel-w)] shrink-0 flex-col overflow-hidden border-r border-edison-gold/15 bg-[#0a0c11]/95">
      <div className="flex border-b border-white/10 px-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setPanel(tab.key)}
            className={`relative flex-1 py-3 text-[13px] font-bold transition ${
              panel === tab.key
                ? "text-edison-gold"
                : "text-white/45 hover:text-white"
            }`}
          >
            {tab.label}
            {panel === tab.key && (
              <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-edison-gold shadow-[0_0_8px_rgba(224,178,60,0.8)]" />
            )}
          </button>
        ))}
      </div>

      {panel === "card" && card ? (
        <div className="flex min-h-0 flex-1 flex-col p-4">
          <h2 className="text-center text-lg font-black leading-tight">{card.name}</h2>
          <div className="mx-auto mt-2 h-px w-2/3 bg-gradient-to-r from-transparent via-edison-gold/60 to-transparent" />
          <div className="relative mx-auto mt-3 aspect-[421/614] w-[min(240px,27vh)] max-w-full shrink-0 overflow-hidden rounded-md shadow-[0_0_30px_rgba(224,178,60,0.14),0_12px_30px_rgba(0,0,0,0.7)]">
            {card.imageUrl ? (
              <Image
                src={card.imageUrl}
                alt={card.name}
                fill
                sizes="280px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <CardBack />
            )}
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {[card.type, card.race, card.attribute].filter(Boolean).map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/70"
              >
                {chip}
              </span>
            ))}
            {card.level !== null && (
              <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-0.5 text-[11px] text-amber-200">
                {card.type.includes("XYZ") ? "☆ Rank" : "★ Nível"} {card.level}
              </span>
            )}
          </div>
          {(card.atk !== null || card.def !== null) && (
            <div className="mt-2 flex justify-center gap-2 font-mono text-xs font-black">
              <span className="rounded bg-rose-500/15 px-2 py-1 text-rose-300">
                ATK {card.atk ?? "?"}
              </span>
              <span className="rounded bg-sky-500/15 px-2 py-1 text-sky-300">
                DEF {card.def ?? "-"}
              </span>
            </div>
          )}
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.03] p-3 text-[13px] leading-5 text-white/80">
            <p className="whitespace-pre-line">{card.description}</p>
            <p className="mt-3 font-mono text-[10px] text-white/30">#{card.id}</p>
          </div>
        </div>
      ) : panel === "card" ? (
        <div className="flex flex-1 flex-col items-center justify-center p-5 text-center text-white/30">
          <Eye className="h-9 w-9" />
          <p className="mt-3 text-xs leading-5">
            Clique em uma carta da mão ou do campo para ler seus dados e efeito.
          </p>
        </div>
      ) : panel === "chat" ? (
        <div className="flex min-h-0 flex-1 flex-col p-3">
          <p className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-2 text-[10px] leading-4 text-amber-200/65">
            O envio entre os dois duelistas será ativado junto com as salas multiplayer.
          </p>
          <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg bg-black/25 p-2">
            {messages.length === 0 ? (
              <p className="pt-8 text-center text-xs text-white/25">Nenhuma mensagem ainda.</p>
            ) : messages.map((message, index) => (
              <div key={index} className="ml-auto max-w-[85%] rounded-lg bg-sky-700 px-3 py-2 text-xs">
                <strong className="block text-[9px] text-sky-100/70">Você</strong>
                {message}
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={chatText}
              onChange={(event) => setChatText(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && addLocalMessage()}
              placeholder="Digite uma mensagem..."
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 text-xs outline-none focus:border-edison-gold/60"
            />
            <button onClick={addLocalMessage} className="rounded-lg bg-edison-gold p-2.5 text-black hover:brightness-110">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : panel === "log" ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {[
            "Duelo iniciado.",
            "Você comprou 5 cartas.",
            "Turno 01 iniciado.",
            "Draw Phase concluída.",
            "Standby Phase concluída.",
            "Main Phase 1 iniciada.",
          ].map((entry, index) => (
            <div key={entry} className="flex gap-3 border-b border-white/5 py-2 text-xs">
              <span className="font-mono text-edison-gold/50">{String(index + 1).padStart(2, "0")}</span>
              <span className="text-white/65">{entry}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-2 p-4">
          <button
            onClick={() => { setReportOpen(true); setReportStatus("idle"); }}
            className="flex items-center justify-center gap-2 rounded-lg border border-red-400/30 bg-red-950/60 py-2.5 text-xs font-bold text-red-100 hover:bg-red-900/70"
          >
            <Bug className="h-4 w-4" /> Relatar bug
          </button>
        </div>
      )}

      {reportOpen && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full rounded-xl border border-red-400/25 bg-[#15131b] p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-black">Relatar um bug</h2>
                <p className="mt-1 text-xs font-semibold text-amber-300">Descreva o mais detalhado possível.</p>
              </div>
              <button onClick={() => setReportOpen(false)} className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={report}
              onChange={(event) => setReport(event.target.value)}
              rows={8}
              placeholder="Conte o que aconteceu, qual carta ou ação estava usando e o que esperava que acontecesse..."
              className="mt-4 w-full resize-none rounded-lg border border-white/10 bg-black/35 p-3 text-sm outline-none focus:border-red-400"
            />
            {reportStatus === "sent" && <p className="mt-2 text-xs text-emerald-300">Relatório enviado. Obrigado por ajudar.</p>}
            {reportStatus === "error" && <p className="mt-2 text-xs text-red-300">Não foi possível enviar. Verifique a configuração do e-mail.</p>}
            <button
              onClick={sendReport}
              disabled={report.trim().length < 10 || reportStatus === "sending"}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-red-700 py-2.5 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {reportStatus === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bug className="h-4 w-4" />}
              Enviar relatório
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

function TurnBadge({ turn, isYourTurn }: { turn: number; isYourTurn: boolean }) {
  return (
    <div
      title={isYourTurn ? "Seu turno" : "Turno do oponente"}
      className={`flex items-center gap-2 rounded-full border border-white/15 bg-[#07090d]/85 px-3 py-1 shadow-lg backdrop-blur ${UI_TEXT}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          isYourTurn
            ? "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)]"
            : "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.9)]"
        }`}
      />
      <span className="uppercase tracking-[0.16em] text-white/50">Turno</span>
      <span className="font-mono font-black text-edison-gold">{turn}</span>
    </div>
  );
}

function PhaseTrack({
  currentPhase,
  phaseIsAvailable,
  selectPhase,
}: {
  currentPhase?: string;
  phaseIsAvailable: (phase: string) => boolean;
  selectPhase: (phase: string) => void;
}) {
  return (
    <div className="flex items-center gap-[3px] rounded-full border border-edison-gold/30 bg-[#07090d]/85 p-[3px] shadow-[0_0_18px_rgba(0,0,0,0.6)] backdrop-blur">
      {PHASES.map((phase) => (
        <button
          key={phase}
          type="button"
          title={PHASE_NAMES[phase]}
          onClick={() => selectPhase(phase)}
          disabled={!phaseIsAvailable(phase)}
          className={`rounded-full px-[calc(var(--z)*0.1)] py-[calc(var(--z)*0.03)] font-bold transition ${UI_TEXT} ${
            PHASE_KEYS[phase] === currentPhase
              ? "bg-edison-gold text-black shadow-[0_0_12px_rgba(224,178,60,0.55)]"
              : phaseIsAvailable(phase)
                ? "text-white hover:bg-white/10"
                : "text-white/30"
          }`}
        >
          {phase}
        </button>
      ))}
    </div>
  );
}

function DuelistHud({
  opponent = false,
  lifePoints = 8_000,
  nickname,
  image,
}: {
  opponent?: boolean;
  lifePoints?: number;
  nickname?: string;
  image?: string | null;
}) {
  const lifeRatio = Math.max(0, Math.min(100, (lifePoints / 8_000) * 100));
  const name = nickname ?? (opponent ? "Oponente" : "Você");
  return (
    <section
      className={`flex w-full flex-col items-center rounded-lg border bg-[#07090d]/80 px-1 py-[calc(var(--z)*0.08)] shadow-lg backdrop-blur-sm ${
        opponent ? "border-rose-400/30" : "border-sky-400/30"
      }`}
    >
      <div
        className={`relative flex aspect-square w-[calc(var(--z)*0.3)] items-center justify-center overflow-hidden rounded-full border-2 ${
          opponent
            ? "border-rose-400/80 bg-rose-950/60 text-rose-200"
            : "border-sky-400/80 bg-sky-950/60 text-sky-200"
        }`}
      >
        {image ? (
          <Image
            src={image}
            alt={name}
            fill
            sizes="48px"
            className="object-cover"
            unoptimized
          />
        ) : opponent ? (
          <Bot className="h-1/2 w-1/2" />
        ) : (
          <Swords className="h-1/2 w-1/2" />
        )}
      </div>
      <p className={`mt-1 w-full truncate px-0.5 text-center font-bold ${UI_TEXT}`}>
        {name}
      </p>
      <p className="font-mono text-[length:clamp(13px,calc(var(--z)*0.15),21px)] font-black leading-tight tabular-nums">
        {lifePoints}
      </p>
      <div className="mt-1 h-1 w-[80%] overflow-hidden rounded-full bg-white/10">
        <div
          style={{ width: `${lifeRatio}%` }}
          className={`h-full rounded-full transition-[width] duration-500 ${
            opponent ? "bg-rose-500" : "bg-sky-400"
          }`}
        />
      </div>
    </section>
  );
}

// Valores pseudoaleatórios fixos (mesmo resultado a cada render) para espalhar
// as partículas da tela de resultado.
function seeded(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

const RESULT_PARTICLES = Array.from({ length: 40 }, (_, index) => ({
  left: seeded(index, 1) * 100,
  // Atraso negativo: as partículas já começam espalhadas pela tela.
  delay: seeded(index, 2) * -6,
  duration: 3.6 + seeded(index, 3) * 3,
  drift: (seeded(index, 4) - 0.5) * 180,
  spin: 360 + seeded(index, 5) * 720,
  size: 5 + seeded(index, 6) * 7,
  variant: index % 4,
}));

const CONFETTI_COLORS = ["#e0b23c", "#fff3c4", "#f5d27a", "#7dd3fc"];
const EMBER_COLORS = ["#ef4444", "#f97316", "#fca5a5", "#b91c1c"];

// Tela de fim de duelo: o duelo fica cinza ao fundo e o resultado aparece no
// centro do tabuleiro — dourado com confete na vitória, vermelho com brasas
// na derrota.
function DuelResultScreen({
  youWon,
  nickname,
  image,
  ownLifePoints,
  opponentLifePoints,
  opponentNickname,
  onViewBoard,
}: {
  youWon: boolean;
  nickname: string;
  image: string | null;
  ownLifePoints: number;
  opponentLifePoints: number;
  opponentNickname: string;
  onViewBoard: () => void;
}) {
  const colors = youWon ? CONFETTI_COLORS : EMBER_COLORS;
  const StatusIcon = youWon ? Crown : ShieldX;
  return (
    <>
      <div className="absolute inset-0 z-[100] bg-neutral-700/45 backdrop-blur-[2px] backdrop-grayscale animate-overlay-fade" />

      <div
        aria-hidden
        className={`${BOARD_OVERLAY} pointer-events-none z-[101] overflow-hidden`}
      >
        {RESULT_PARTICLES.map((particle, index) => {
          const color = colors[index % colors.length];
          return (
            <span
              key={index}
              className="absolute top-0 block animate-[particle-fall_5s_linear_infinite] motion-reduce:hidden"
              style={
                {
                  left: `${particle.left}%`,
                  width: particle.size,
                  height: youWon
                    ? particle.variant === 0
                      ? particle.size * 0.45
                      : particle.size
                    : particle.size * 0.7,
                  background: color,
                  borderRadius: youWon && particle.variant !== 2 ? 2 : 9999,
                  boxShadow: youWon ? undefined : `0 0 ${particle.size * 1.5}px ${color}`,
                  opacity: youWon ? 1 : 0.85,
                  animationDelay: `${particle.delay}s`,
                  animationDuration: `${particle.duration * (youWon ? 1 : 1.7)}s`,
                  "--drift": `${particle.drift}px`,
                  "--spin": `${youWon ? particle.spin : particle.spin / 6}deg`,
                } as CSSProperties
              }
            />
          );
        })}
      </div>

      <div className={`${BOARD_OVERLAY} z-[102] flex items-center justify-center p-4`}>
        <section
          role="dialog"
          aria-label={youWon ? "Vitória" : "Derrota"}
          className={`relative w-full max-w-md overflow-hidden rounded-3xl border px-8 pb-8 pt-9 text-center animate-[result-in_0.8s_cubic-bezier(0.16,1,0.3,1)_both] ${
            youWon
              ? "border-edison-gold/60 bg-gradient-to-b from-[#1c160a]/95 via-[#120f08]/95 to-[#0b0906]/95 shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_0_90px_rgba(224,178,60,0.35)]"
              : "border-red-500/50 bg-gradient-to-b from-[#1f0a0d]/95 via-[#14070a]/95 to-[#0c0506]/95 shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_0_90px_rgba(220,38,38,0.35)]"
          }`}
        >
          {youWon ? (
            // Raios dourados girando atrás do avatar.
            <div className="pointer-events-none absolute left-1/2 top-[150px] h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 [-webkit-mask-image:radial-gradient(circle,black_18%,transparent_62%)] [mask-image:radial-gradient(circle,black_18%,transparent_62%)]">
              <div className="h-full w-full animate-[result-rays-spin_30s_linear_infinite] [background-image:repeating-conic-gradient(from_0deg,rgba(224,178,60,0.28)_0deg_6deg,transparent_6deg_16deg)] motion-reduce:animate-none" />
            </div>
          ) : (
            // Rachaduras vermelhas partindo do topo.
            <svg
              viewBox="0 0 400 300"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-[300px] w-full text-red-500/30"
            >
              <polyline points="200,0 188,40 206,70 192,112 210,150" />
              <polyline points="206,70 240,86 262,120 300,132 340,128" />
              <polyline points="192,112 160,128 136,164 96,176" />
              <polyline points="188,40 150,52 120,40 84,58 50,50" />
              <polyline points="210,150 226,190 214,230" />
              <polyline points="262,120 272,160 300,182" />
            </svg>
          )}

          <div className="pointer-events-none absolute left-1/2 top-[150px] h-56 w-56 -translate-x-1/2 -translate-y-1/2">
            <div
              className={`h-full w-full rounded-full blur-2xl animate-[glow-pulse_2.8s_ease-in-out_infinite] motion-reduce:animate-none ${
                youWon ? "bg-edison-gold/35" : "bg-red-600/35"
              }`}
            />
          </div>

          <StatusIcon
            strokeWidth={1.8}
            className={`relative mx-auto h-10 w-10 ${
              youWon
                ? "text-edison-gold drop-shadow-[0_0_12px_rgba(224,178,60,0.9)]"
                : "text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.9)]"
            }`}
          />

          <div
            className={`relative mx-auto mt-3 h-28 w-28 rounded-full p-[3px] ${
              youWon
                ? "bg-[conic-gradient(from_0deg,#fff3c4,#e0b23c,#a8741a,#e0b23c,#fff3c4)] shadow-[0_0_40px_rgba(224,178,60,0.6)]"
                : "bg-[conic-gradient(from_0deg,#fecaca,#ef4444,#7f1d1d,#ef4444,#fecaca)] shadow-[0_0_40px_rgba(220,38,38,0.55)]"
            }`}
          >
            <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#15171f]">
              {image ? (
                <Image
                  src={image}
                  alt={nickname}
                  fill
                  sizes="112px"
                  className={`object-cover ${youWon ? "" : "grayscale-[0.6]"}`}
                  unoptimized
                />
              ) : (
                <span className="text-4xl font-black text-white/85">
                  {nickname.charAt(0).toUpperCase()}
                </span>
              )}
              {!youWon && (
                <div className="absolute inset-0 bg-red-900/30 mix-blend-multiply" />
              )}
            </div>
            {youWon && (
              <>
                <Sparkles className="absolute -left-4 top-1 h-5 w-5 text-[#fff3c4] animate-[glow-pulse_2.8s_ease-in-out_infinite] motion-reduce:animate-none" />
                <Sparkles className="absolute -right-5 bottom-3 h-4 w-4 text-edison-gold animate-[glow-pulse_2.8s_ease-in-out_infinite] [animation-delay:1.2s] motion-reduce:animate-none" />
              </>
            )}
          </div>

          <p className="relative mt-3 truncate text-lg font-black">{nickname}</p>

          <h2
            className={`relative mt-4 bg-[length:200%_auto] bg-clip-text text-5xl font-black uppercase tracking-[0.12em] text-transparent animate-[title-shine_4s_linear_infinite] motion-reduce:animate-none ${
              youWon
                ? "bg-[linear-gradient(110deg,#a8741a_0%,#e0b23c_30%,#fff7d6_50%,#e0b23c_70%,#a8741a_100%)]"
                : "bg-[linear-gradient(110deg,#7f1d1d_0%,#ef4444_30%,#fecaca_50%,#ef4444_70%,#7f1d1d_100%)]"
            }`}
          >
            {youWon ? "Vitória" : "Derrota"}
          </h2>
          <p
            className={`relative mt-2 text-sm font-semibold ${
              youWon ? "text-edison-gold/90" : "text-red-200/85"
            }`}
          >
            {youWon ? "Parabéns, você ganhou!" : "Boa sorte na próxima!"}
          </p>

          <div className="relative mt-5 flex items-center justify-center gap-2 font-mono text-xs">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              <span className="text-white/45">Você </span>
              <b>{ownLifePoints}</b>
            </span>
            <span className="text-white/30">×</span>
            <span className="max-w-[45%] truncate rounded-full border border-white/10 bg-white/5 px-3 py-1">
              <span className="text-white/45">{opponentNickname} </span>
              <b>{opponentLifePoints}</b>
            </span>
          </div>

          <div className="relative mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                window.location.href = "/duel";
              }}
              className={`rounded-full px-6 py-2.5 text-sm font-black transition hover:brightness-110 ${
                youWon
                  ? "bg-edison-gold text-black shadow-[0_0_20px_rgba(224,178,60,0.45)]"
                  : "bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.45)]"
              }`}
            >
              Voltar ao lobby
            </button>
            <button
              type="button"
              onClick={onViewBoard}
              className="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-bold text-white/80 transition hover:bg-white/10"
            >
              Ver o campo
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

function PreDuelGate({
  roomId,
  onGameState,
}: {
  roomId: string;
  onGameState: (game?: RoomGameState | null) => void;
}) {
  const [room, setRoom] = useState<RoomState>();
  const [sending, setSending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(15);
  const [syncError, setSyncError] = useState(false);

  useEffect(() => {
    let active = true;
    async function refresh() {
      const response = await fetch(
        `/api/duel/rooms/${roomId}?time=${Date.now()}`,
        {
        cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        }
      );
      if (response.ok && active) {
        const nextRoom: RoomState = await response.json();
        setRoom(nextRoom);
        onGameState(nextRoom.game);
        setSyncError(false);
      } else if (active) {
        setSyncError(true);
      }
    }
    refresh();
    const timer = window.setInterval(refresh, 700);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [roomId, onGameState]);

  useEffect(() => {
    function updateCountdown() {
      if (!room?.rpsDeadline) {
        setSecondsLeft(15);
        return;
      }
      setSecondsLeft(
        Math.max(0, Math.ceil((new Date(room.rpsDeadline).getTime() - Date.now()) / 1000))
      );
    }
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 250);
    return () => window.clearInterval(timer);
  }, [room?.rpsDeadline]);

  if (room?.status === "active" || room?.status === "finished") return null;
  const me = room?.players.find((player) => player.id === room.meId);
  const winner = room?.rpsWinnerId === room?.meId;

  async function chooseRps(choice: "rock" | "paper" | "scissors") {
    setSending(true);
    await fetch(`/api/duel/rooms/${roomId}/rps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ choice }),
    });
    setSending(false);
  }

  async function chooseOrder(goFirst: boolean) {
    setSending(true);
    await fetch(`/api/duel/rooms/${roomId}/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goFirst }),
    });
    setSending(false);
  }

  async function cancelSearch() {
    setCancelling(true);
    const response = await fetch(`/api/duel/rooms/${roomId}`, {
      method: "DELETE",
    });
    if (response.ok) {
      window.location.href = "/duel";
      return;
    }
    setCancelling(false);
  }

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-[#080b12]/95 p-6 backdrop-blur-lg">
      <section className="w-full max-w-xl rounded-3xl border border-edison-gold/25 bg-[#15131b] p-8 text-center shadow-2xl">
        {!room || room.status === "waiting" ? (
          <>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-edison-gold" />
            <h1 className="mt-5 text-2xl font-black">Procurando oponente</h1>
            <p className="mt-2 text-sm text-white/50">
              Você está na fila. A partida abrirá quando outro jogador apertar Jogar.
            </p>
            <button
              type="button"
              onClick={cancelSearch}
              disabled={cancelling}
              className="mt-7 rounded-xl border border-red-400/30 bg-red-500/10 px-6 py-3 text-sm font-black text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cancelling ? "Cancelando..." : "Cancelar busca"}
            </button>
          </>
        ) : room.status === "rps" ? (
          <>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-edison-gold">
              Rodada {room.rpsRound}
            </p>
            <h1 className="mt-2 text-2xl font-black">Pedra, papel ou tesoura</h1>
            <div className="mx-auto mt-4 flex h-14 w-14 items-center justify-center rounded-full border-2 border-edison-gold/40 bg-edison-gold/10 font-mono text-xl font-black text-edison-gold">
              {secondsLeft}
            </div>
            <p className="mt-2 text-sm text-white/50">
              {me?.choiceSubmitted
                ? "Escolha enviada. Aguardando o outro duelista."
                : "Escolha uma opção. Ela ficará escondida até os dois responderem."}
            </p>
            <div className="mt-7 grid grid-cols-3 gap-3">
              {[
                { value: "rock" as const, label: "Pedra", Icon: Circle },
                { value: "paper" as const, label: "Papel", Icon: Hand },
                { value: "scissors" as const, label: "Tesoura", Icon: Scissors },
              ].map(({ value, label, Icon }) => (
                <button
                  key={value}
                  onClick={() => chooseRps(value)}
                  disabled={sending || me?.choiceSubmitted}
                  className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 font-black transition hover:border-edison-gold hover:bg-edison-gold/10 disabled:opacity-40"
                >
                  <Icon className="h-9 w-9" />
                  {label}
                </button>
              ))}
            </div>
            {syncError && (
              <p className="mt-4 text-xs text-red-300">
                Reconectando à sala...
              </p>
            )}
          </>
        ) : winner ? (
          <>
            <Swords className="mx-auto h-12 w-12 text-edison-gold" />
            <h1 className="mt-4 text-2xl font-black">Você venceu</h1>
            <p className="mt-2 text-sm text-white/50">
              Escolha a ordem do duelo.
            </p>
            <div className="mt-7 grid grid-cols-2 gap-3">
              <button onClick={() => chooseOrder(true)} disabled={sending} className="rounded-xl bg-edison-gold px-5 py-4 font-black text-black disabled:opacity-50">
                Quero começar
              </button>
              <button onClick={() => chooseOrder(false)} disabled={sending} className="rounded-xl border border-white/15 bg-white/5 px-5 py-4 font-black disabled:opacity-50">
                Quero ir em segundo
              </button>
            </div>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-white/50" />
            <h1 className="mt-5 text-2xl font-black">Aguardando a escolha</h1>
            <p className="mt-2 text-sm text-white/50">
              O vencedor está escolhendo quem começa.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

export default function DuelPlayPage() {
  const [roomId, setRoomId] = useState<string>();
  const [deck, setDeck] = useState<EquippedDeck>();
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<Card>();
  const [playerDeckCount, setPlayerDeckCount] = useState(0);
  const [opponentDeckCount, setOpponentDeckCount] = useState(35);
  const [gameState, setGameState] = useState<RoomGameState | null>();
  const [actionError, setActionError] = useState<string>();
  const [acting, setActing] = useState(false);
  // `acting` (useState) só reflete a trava depois de um re-render; dois
  // cliques na mesma zona no mesmo tick do event loop ainda leriam o valor
  // antigo (false) e disparariam duas ações para o OCGCore, e a segunda
  // chega quando o motor já não está mais esperando aquela ação. O ref
  // fecha essa janela porque é lido/escrito de forma síncrona.
  const actingRef = useRef(false);
  const [selectedHandIndex, setSelectedHandIndex] = useState<number>();
  const [pendingPlacement, setPendingPlacement] = useState<PendingPlacement>();
  const [selectedDecisionIndices, setSelectedDecisionIndices] = useState<number[]>([]);
  const [specialSummonOpen, setSpecialSummonOpen] = useState(false);
  const [chainSecondsLeft, setChainSecondsLeft] = useState(20);
  const [resultHidden, setResultHidden] = useState(false);

  useEffect(() => {
    setRoomId(new URLSearchParams(window.location.search).get("room") ?? undefined);
    fetch("/api/decks")
      .then((response) => response.json())
      .then((decks: EquippedDeck[]) => {
        if (Array.isArray(decks)) {
          const equippedDeck = decks.find((item) => item.isEquipped);
          setDeck(equippedDeck);
          setSelectedCard(
            equippedDeck?.cards.find((item) => item.section === "main")?.card
          );
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const mainDeck = useMemo(
    () =>
      deck?.cards
        .filter((item) => item.section === "main")
        .flatMap((item) => Array.from({ length: item.quantity }, () => item.card)) ??
      [],
    [deck]
  );
  const extraCount =
    deck?.cards
      .filter((item) => item.section === "extra")
      .reduce((total, item) => total + item.quantity, 0) ?? 0;
  const hand = gameState?.ownHand ?? mainDeck.slice(0, 5);
  const fieldMonsters = gameState?.ownMonsters ?? [];
  const fieldSpellTraps = gameState?.ownSpellTraps ?? [];
  const ownFieldSpell = fieldSpellTraps.find((entry) => entry.zone === 5);
  const opponentFieldSpell = gameState?.opponentSpellTraps.find(
    (entry) => entry.zone === 5
  );
  const selectedActions = selectedCard
    ? gameState?.legalActions[String(selectedCard.id)] ?? []
    : [];
  const inlinePlaceDecision = useMemo(() => {
    const decision = gameState?.decision;
    const meId = gameState?.meId;
    if (!meId || decision?.type !== "place" || decision.count !== 1) {
      return undefined;
    }

    const places = decision.places.filter(
      (place) =>
        place.controllerId === meId &&
        ((place.location === 4 &&
          place.sequence >= 0 &&
          place.sequence < 5) ||
          (place.location === 8 &&
            place.sequence >= 0 &&
            place.sequence <= 5))
    );
    if (places.length === 0) return undefined;

    const kindForPlace = (place: (typeof places)[number]) =>
      place.location === 4
        ? ("monster" as const)
        : place.sequence === 5
          ? ("field" as const)
          : ("spell" as const);
    const kind = kindForPlace(places[0]);
    if (!places.every((place) => kindForPlace(place) === kind)) {
      return undefined;
    }

    return { kind, places };
  }, [gameState]);
  const battleTargetDecision =
    gameState?.decision?.type === "battle_targets"
      ? gameState.decision
      : undefined;
  const positionDecision =
    gameState?.decision?.type === "position"
      ? gameState.decision
      : undefined;
  const decisionSignature = gameState?.decision
    ? gameState.decision.type === "cards" ||
      gameState.decision.type === "tributes" ||
      gameState.decision.type === "battle_targets"
      ? `${gameState.decision.type}:${gameState.decision.candidates
          .map((candidate) => candidate.index)
          .join(",")}:${gameState.decision.min}:${gameState.decision.max}`
      : gameState.decision.type === "sum"
        ? `sum:${gameState.decision.candidates.map((candidate) => candidate.index).join(",")}`
        : gameState.decision.type === "unselect"
          ? `unselect:${gameState.decision.selectable.map((candidate) => candidate.index).join(",")}:${gameState.decision.selected.map((candidate) => candidate.index).join(",")}`
          : `${gameState.decision.type}:${"cardId" in gameState.decision ? gameState.decision.cardId ?? "" : ""}`
    : "";

  useEffect(() => {
    setSelectedDecisionIndices([]);
  }, [decisionSignature]);

  useEffect(() => {
    function updateChainCountdown() {
      const deadline = gameState?.chain?.deadlineAt;
      if (!deadline) {
        setChainSecondsLeft(20);
        return;
      }
      setChainSecondsLeft(
        Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000))
      );
    }
    updateChainCountdown();
    const timer = window.setInterval(updateChainCountdown, 250);
    return () => window.clearInterval(timer);
  }, [gameState?.chain?.deadlineAt]);

  useEffect(() => {
    setPlayerDeckCount(
      gameState?.ownDeckCount ?? Math.max(mainDeck.length - 5, 0)
    );
    setOpponentDeckCount(gameState?.opponentDeckCount ?? 35);
  }, [gameState, mainDeck.length]);

  useEffect(() => {
    function updateDeckCounts(event: Event) {
      const detail = (
        event as CustomEvent<{ player?: number; opponent?: number }>
      ).detail;
      if (Number.isInteger(detail?.player) && detail.player! >= 0) {
        setPlayerDeckCount(detail.player!);
      }
      if (Number.isInteger(detail?.opponent) && detail.opponent! >= 0) {
        setOpponentDeckCount(detail.opponent!);
      }
    }

    window.addEventListener("duel:deck-count", updateDeckCounts);
    return () => window.removeEventListener("duel:deck-count", updateDeckCounts);
  }, []);

  async function sendAction(
    action:
      | { type: "next_phase" | "end_turn" }
      | {
          type: "select_phase";
          phase: "standby" | "main1" | "battle" | "main2";
        }
      | { type: "pass_chain" | "force_pass_chain" }
      | { type: "activate_chain"; cardId: number }
      | {
          type: "ocg_decision";
          yes?: boolean;
          optionIndex?: number;
          cardIndices?: number[] | null;
          position?: number;
          placeIndices?: number[];
          toggleIndex?: number | null;
          finishSelection?: boolean;
        }
      | {
          type: "summon" | "set_monster";
          cardId: number;
          zone: number;
        }
      | { type: "set_spell_trap" | "activate"; cardId: number }
      | { type: "special_summon"; cardId: number }
      | { type: "attack"; cardId: number; zone: number }
  ) {
    if (!roomId || actingRef.current) return;
    actingRef.current = true;
    setActing(true);
    setActionError(undefined);
    try {
      const response = await fetch(`/api/duel/rooms/${roomId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      if (!response.ok) {
        const result = await response.json();
        setActionError(result.error ?? "Não foi possível realizar esta ação.");
      } else {
        setSelectedHandIndex(undefined);
        setPendingPlacement(undefined);
        setSpecialSummonOpen(false);
      }
    } finally {
      actingRef.current = false;
      setActing(false);
    }
  }

  function handleCardAction(action: DuelCardAction, cardId: number) {
    if (action === "activate" && gameState?.chain?.awaitingYou) {
      sendAction({ type: "activate_chain", cardId });
      return;
    }
    if (
      action === "special_summon" ||
      action === "set_spell_trap" ||
      action === "activate"
    ) {
      // A zona (S/T ou Campo) não é escolhida aqui: o OCGCore pede com uma
      // decisão MESSAGE_SELECT_PLACE própria depois de consumir a ativação,
      // e essa decisão já é tratada pelo fluxo genérico (inlinePlaceDecision)
      // mais abaixo. Adivinhar a zona no cliente e mandar tudo numa
      // chamada só deixava o motor travado quando o palpite não batia com
      // o que o OCGCore esperava.
      sendAction({ type: action, cardId });
      return;
    }
    if (action === "attack") return;
    setPendingPlacement({ action, cardId, kind: "monster" });
    setSelectedHandIndex(undefined);
  }

  function placeCard(zone: number) {
    if (!pendingPlacement) return;
    sendAction({
      type: pendingPlacement.action,
      cardId: pendingPlacement.cardId,
      zone,
    });
  }

  // Só existe algo para cancelar enquanto a jogada ainda não foi enviada ao
  // OCGCore (escolha de zona no cliente, menu de ação aberto, modal de
  // invocação especial). Uma vez que o servidor confirma a ativação/invocação,
  // a única forma de "desfazer" é o próprio motor responder com uma decisão
  // que tenha canCancel/canFinish — isso já tem seus próprios botões.
  const canCancelPendingAction = Boolean(
    pendingPlacement || selectedHandIndex !== undefined || specialSummonOpen
  );

  // Status mostrado na linha central do tabuleiro: dicas de escolha de
  // zona/alvo têm prioridade sobre o aviso de espera pelo oponente.
  const statusIsPrompt = Boolean(
    battleTargetDecision || inlinePlaceDecision || pendingPlacement
  );
  const statusMessage = battleTargetDecision
    ? "Escolha o monstro que será atacado"
    : inlinePlaceDecision || pendingPlacement
      ? "Escolha uma das zonas iluminadas"
      : gameState &&
          !gameState.winnerId &&
          !gameState.decision &&
          !gameState.chain?.awaitingYou &&
          !gameState.isYourTurn
        ? "Aguardando o oponente..."
        : undefined;
  const opponentHandCount = gameState?.opponentHandCount ?? 5;

  function cancelPendingAction() {
    if (!canCancelPendingAction) return;
    setPendingPlacement(undefined);
    setSelectedHandIndex(undefined);
    setSpecialSummonOpen(false);
    setActionError(undefined);
  }

  function chooseInlineDecisionZone(zone: number) {
    const place = inlinePlaceDecision?.places.find(
      (candidate) => candidate.sequence === zone
    );
    if (!place) return;
    sendAction({ type: "ocg_decision", placeIndices: [place.index] });
  }

  function declareAttack(cardId: number, zone: number) {
    sendAction({ type: "attack", cardId, zone });
  }

  function chooseBattleTarget(zone: number) {
    const target = battleTargetDecision?.candidates.find(
      (candidate) => candidate.location === 4 && candidate.sequence === zone
    );
    if (!target) return;
    sendAction({ type: "ocg_decision", cardIndices: [target.index] });
  }

  function selectPhase(phase: string) {
    const target = PHASE_KEYS[phase];
    if (phase === "EP") {
      sendAction({ type: "end_turn" });
      return;
    }
    if (
      target === "standby" ||
      target === "main1" ||
      target === "battle" ||
      target === "main2"
    ) {
      sendAction({ type: "select_phase", phase: target });
    }
  }

  function phaseIsAvailable(phase: string) {
    if (!gameState?.isYourTurn || acting) return false;
    const current = gameState.currentPhase;
    if (phase === "SP") return current === "draw";
    if (phase === "MP1") return current === "standby";
    if (phase === "BP") {
      return current === "main1" && gameState.currentTurn > 1;
    }
    if (phase === "MP2") return current === "battle";
    if (phase === "EP") {
      return ["main1", "battle", "main2", "end"].includes(current);
    }
    return false;
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-[#07080c] font-sans text-white"
      style={{ "--panel-w": "clamp(260px, 22vw, 420px)" } as CSSProperties}
      onContextMenu={(event) => {
        if (!canCancelPendingAction) return;
        event.preventDefault();
        cancelPendingAction();
      }}
    >
      {roomId && (
        <PreDuelGate roomId={roomId} onGameState={setGameState} />
      )}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_10%,rgba(190,40,60,0.16),transparent_42%),radial-gradient(circle_at_62%_95%,rgba(40,110,230,0.16),transparent_45%),radial-gradient(circle_at_60%_50%,rgba(224,178,60,0.05),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:26px_26px]" />

      {specialSummonOpen && !gameState?.decision && (
        <div className={`${BOARD_OVERLAY} z-[94] flex items-center justify-center bg-black/65 p-4 animate-overlay-fade`}>
          <div className="w-full max-w-2xl rounded-2xl border border-violet-400/35 bg-[#121019]/95 p-5 text-center shadow-2xl backdrop-blur animate-modal-pop">
            <h2 className="text-xl font-black">Invocações especiais disponíveis</h2>
            <p className="mt-1 text-xs text-white/50">
              O OCGCore continuará pedindo materiais, posição e zona quando necessário.
            </p>
            <div className="mt-5 flex max-h-[52vh] flex-wrap justify-center gap-3 overflow-y-auto">
              {gameState?.specialSummonCandidates.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => handleCardAction("special_summon", card.id)}
                  disabled={acting}
                  className="w-28 rounded-lg border border-violet-400/25 bg-violet-400/10 p-2 transition hover:border-violet-300 hover:bg-violet-400/20 disabled:opacity-40"
                >
                  <div className="relative mx-auto aspect-[421/614] w-full overflow-hidden rounded bg-black/40">
                    {card.imageUrl && (
                      <Image
                        src={card.imageUrl}
                        alt={card.name}
                        fill
                        sizes="112px"
                        className="object-cover"
                        unoptimized
                      />
                    )}
                  </div>
                  <span className="mt-2 block text-[10px] font-black leading-tight">
                    {card.name}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSpecialSummonOpen(false)}
              className="mt-5 rounded-lg border border-white/15 bg-white/5 px-6 py-2.5 text-xs font-black"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {gameState?.decision &&
        gameState.decision.type !== "place" &&
        gameState.decision.type !== "battle_targets" &&
        !inlinePlaceDecision && (
        <div className={`${BOARD_OVERLAY} z-[95] flex items-center justify-center bg-black/65 p-4 animate-overlay-fade`}>
          <div className="w-full max-w-2xl rounded-2xl border border-edison-gold/35 bg-[#121019]/95 p-5 text-center shadow-2xl backdrop-blur animate-modal-pop">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-edison-gold">
              Decisão do efeito
            </p>

            {gameState.decision.type === "yes_no" && (
              <>
                {gameState.decision.card && (
                  <div className="mx-auto mt-3 w-20">
                    <div className="relative mx-auto aspect-[421/614] w-full overflow-hidden rounded border border-edison-gold/50 bg-black/40">
                      {gameState.decision.card.imageUrl ? (
                        <Image
                          src={gameState.decision.card.imageUrl}
                          alt={gameState.decision.card.name}
                          fill
                          sizes="80px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[9px] text-white/40">
                          Carta
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <h2 className="mt-2 text-xl font-black">
                  {gameState.decision.card
                    ? `Ativar o efeito de ${gameState.decision.card.name}?`
                    : "Deseja aplicar este efeito?"}
                </h2>
                <p className="mt-2 text-xs text-white/45">
                  O duelo continuará depois da sua escolha.
                </p>
                <div className="mt-5 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => sendAction({ type: "ocg_decision", yes: true })}
                    disabled={acting}
                    className="rounded-lg bg-edison-gold px-7 py-2.5 text-xs font-black text-black disabled:opacity-40"
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => sendAction({ type: "ocg_decision", yes: false })}
                    disabled={acting}
                    className="rounded-lg border border-white/15 bg-white/5 px-7 py-2.5 text-xs font-black text-white disabled:opacity-40"
                  >
                    Não
                  </button>
                </div>
              </>
            )}

            {gameState.decision.type === "option" && (
              <>
                <h2 className="mt-2 text-xl font-black">Escolha uma opção</h2>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {gameState.decision.options.map((option, index) => (
                    <button
                      key={`${option}-${index}`}
                      type="button"
                      onClick={() =>
                        sendAction({ type: "ocg_decision", optionIndex: index })
                      }
                      disabled={acting}
                      className="rounded-lg border border-edison-gold/25 bg-edison-gold/10 px-4 py-3 text-left text-xs font-bold text-white transition hover:bg-edison-gold/20 disabled:opacity-40"
                    >
                      Opção {index + 1}
                    </button>
                  ))}
                </div>
              </>
            )}

            {(gameState.decision.type === "cards" ||
              gameState.decision.type === "tributes") && (
              <>
                <h2 className="mt-2 text-xl font-black">
                  {gameState.decision.type === "tributes"
                    ? "Escolha os tributos"
                    : "Escolha as cartas"}
                </h2>
                <p className="mt-1 text-xs text-white/50">
                  Selecione entre {gameState.decision.min} e {gameState.decision.max}.
                </p>
                <div className="mt-5 flex max-h-[48vh] flex-wrap justify-center gap-3 overflow-y-auto p-1">
                  {gameState.decision.candidates.map((candidate) => {
                    const selected = selectedDecisionIndices.includes(candidate.index);
                    const maxSelections =
                      gameState.decision?.type === "cards" ||
                      gameState.decision?.type === "tributes"
                        ? gameState.decision.max
                        : 0;
                    return (
                      <button
                        key={`${candidate.index}-${candidate.cardId}`}
                        type="button"
                        onClick={() =>
                          setSelectedDecisionIndices((current) =>
                            current.includes(candidate.index)
                              ? current.filter((index) => index !== candidate.index)
                              : current.length < maxSelections
                                ? [...current, candidate.index]
                                : current
                          )
                        }
                        className={`w-24 rounded-lg border p-2 transition ${
                          selected
                            ? "border-edison-gold bg-edison-gold/20 ring-2 ring-edison-gold/35"
                            : "border-white/10 bg-white/5 hover:border-white/30"
                        }`}
                      >
                        <div className="relative mx-auto aspect-[421/614] w-full overflow-hidden rounded bg-black/40">
                          {candidate.card?.imageUrl ? (
                            <Image
                              src={candidate.card.imageUrl}
                              alt={candidate.card.name}
                              fill
                              sizes="96px"
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[9px] text-white/40">
                              Carta
                            </div>
                          )}
                        </div>
                        <span className="mt-1.5 block truncate text-[9px] font-bold">
                          {candidate.card?.name ?? `Carta ${candidate.cardId}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-5 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      sendAction({
                        type: "ocg_decision",
                        cardIndices: selectedDecisionIndices,
                      })
                    }
                    disabled={
                      acting ||
                      selectedDecisionIndices.length < gameState.decision.min ||
                      selectedDecisionIndices.length > gameState.decision.max
                    }
                    className="rounded-lg bg-edison-gold px-6 py-2.5 text-xs font-black text-black disabled:opacity-40"
                  >
                    Confirmar ({selectedDecisionIndices.length})
                  </button>
                  {gameState.decision.canCancel && (
                    <button
                      type="button"
                      onClick={() =>
                        sendAction({ type: "ocg_decision", cardIndices: null })
                      }
                      disabled={acting}
                      className="rounded-lg border border-white/15 bg-white/5 px-6 py-2.5 text-xs font-black disabled:opacity-40"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </>
            )}

            {gameState.decision.type === "sum" && (
              <>
                <h2 className="mt-2 text-xl font-black">
                  Escolha os materiais
                </h2>
                <p className="mt-1 text-xs text-white/50">
                  A soma dos níveis selecionados precisa ser {gameState.decision.target}.
                </p>
                {gameState.decision.mustCards.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                      Incluído automaticamente
                    </p>
                    <div className="mt-2 flex flex-wrap justify-center gap-3">
                      {gameState.decision.mustCards.map((candidate) => (
                        <div
                          key={`must-${candidate.index}-${candidate.cardId}`}
                          className="w-24 rounded-lg border border-edison-gold/60 bg-edison-gold/10 p-2"
                        >
                          <div className="relative mx-auto aspect-[421/614] w-full overflow-hidden rounded bg-black/40">
                            {candidate.card?.imageUrl ? (
                              <Image
                                src={candidate.card.imageUrl}
                                alt={candidate.card.name}
                                fill
                                sizes="96px"
                                className="object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-[9px] text-white/40">
                                Carta
                              </div>
                            )}
                          </div>
                          <span className="mt-1.5 block truncate text-[9px] font-bold">
                            {candidate.card?.name ?? `Carta ${candidate.cardId}`}
                          </span>
                          <span className="block text-[9px] text-edison-gold">
                            Nível {candidate.amount}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-4 flex max-h-[40vh] flex-wrap justify-center gap-3 overflow-y-auto p-1">
                  {gameState.decision.candidates.map((candidate) => {
                    const selected = selectedDecisionIndices.includes(candidate.index);
                    return (
                      <button
                        key={`${candidate.index}-${candidate.cardId}`}
                        type="button"
                        onClick={() =>
                          setSelectedDecisionIndices((current) =>
                            current.includes(candidate.index)
                              ? current.filter((index) => index !== candidate.index)
                              : [...current, candidate.index]
                          )
                        }
                        className={`w-24 rounded-lg border p-2 transition ${
                          selected
                            ? "border-edison-gold bg-edison-gold/20 ring-2 ring-edison-gold/35"
                            : "border-white/10 bg-white/5 hover:border-white/30"
                        }`}
                      >
                        <div className="relative mx-auto aspect-[421/614] w-full overflow-hidden rounded bg-black/40">
                          {candidate.card?.imageUrl ? (
                            <Image
                              src={candidate.card.imageUrl}
                              alt={candidate.card.name}
                              fill
                              sizes="96px"
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[9px] text-white/40">
                              Carta
                            </div>
                          )}
                        </div>
                        <span className="mt-1.5 block truncate text-[9px] font-bold">
                          {candidate.card?.name ?? `Carta ${candidate.cardId}`}
                        </span>
                        <span className="block text-[9px] text-edison-gold">
                          Nível {candidate.amount}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {(() => {
                  const decision = gameState.decision;
                  if (decision.type !== "sum") return null;
                  const mustTotal = decision.mustCards.reduce(
                    (total, card) => total + card.amount,
                    0
                  );
                  const selectedTotal = selectedDecisionIndices.reduce(
                    (total, index) =>
                      total + (decision.candidates[index]?.amount ?? 0),
                    0
                  );
                  const currentTotal = mustTotal + selectedTotal;
                  const validCount =
                    selectedDecisionIndices.length >= decision.min &&
                    selectedDecisionIndices.length <= decision.max;
                  return (
                    <>
                      <p className="mt-3 text-xs text-white/60">
                        Total selecionado: {currentTotal} / {decision.target}
                      </p>
                      <div className="mt-3 flex justify-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            sendAction({
                              type: "ocg_decision",
                              cardIndices: selectedDecisionIndices,
                            })
                          }
                          disabled={
                            acting || !validCount || currentTotal !== decision.target
                          }
                          className="rounded-lg bg-edison-gold px-6 py-2.5 text-xs font-black text-black disabled:opacity-40"
                        >
                          Confirmar ({selectedDecisionIndices.length})
                        </button>
                      </div>
                    </>
                  );
                })()}
              </>
            )}

            {gameState.decision.type === "unselect" && (
              <>
                <h2 className="mt-2 text-xl font-black">
                  Escolha os materiais
                </h2>
                <p className="mt-1 text-xs text-white/50">
                  Selecione entre {gameState.decision.min} e {gameState.decision.max} carta(s).
                </p>
                <div className="mt-4 flex max-h-[40vh] flex-wrap justify-center gap-3 overflow-y-auto p-1">
                  {gameState.decision.selected.map((candidate) => (
                    <button
                      key={`selected-${candidate.index}-${candidate.cardId}`}
                      type="button"
                      onClick={() =>
                        sendAction({
                          type: "ocg_decision",
                          toggleIndex: candidate.index,
                        })
                      }
                      disabled={acting}
                      className="w-24 rounded-lg border border-edison-gold bg-edison-gold/20 p-2 ring-2 ring-edison-gold/35 transition disabled:opacity-40"
                    >
                      <div className="relative mx-auto aspect-[421/614] w-full overflow-hidden rounded bg-black/40">
                        {candidate.card?.imageUrl ? (
                          <Image
                            src={candidate.card.imageUrl}
                            alt={candidate.card.name}
                            fill
                            sizes="96px"
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[9px] text-white/40">
                            Carta
                          </div>
                        )}
                      </div>
                      <span className="mt-1.5 block truncate text-[9px] font-bold">
                        {candidate.card?.name ?? `Carta ${candidate.cardId}`}
                      </span>
                      <span className="block text-[9px] text-white/50">Remover</span>
                    </button>
                  ))}
                  {gameState.decision.selectable.map((candidate) => (
                    <button
                      key={`selectable-${candidate.index}-${candidate.cardId}`}
                      type="button"
                      onClick={() =>
                        sendAction({
                          type: "ocg_decision",
                          toggleIndex: candidate.index,
                        })
                      }
                      disabled={acting}
                      className="w-24 rounded-lg border border-white/10 bg-white/5 p-2 transition hover:border-white/30 disabled:opacity-40"
                    >
                      <div className="relative mx-auto aspect-[421/614] w-full overflow-hidden rounded bg-black/40">
                        {candidate.card?.imageUrl ? (
                          <Image
                            src={candidate.card.imageUrl}
                            alt={candidate.card.name}
                            fill
                            sizes="96px"
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[9px] text-white/40">
                            Carta
                          </div>
                        )}
                      </div>
                      <span className="mt-1.5 block truncate text-[9px] font-bold">
                        {candidate.card?.name ?? `Carta ${candidate.cardId}`}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-5 flex justify-center gap-3">
                  {gameState.decision.canFinish && (
                    <button
                      type="button"
                      onClick={() =>
                        sendAction({ type: "ocg_decision", finishSelection: true })
                      }
                      disabled={acting}
                      className="rounded-lg bg-edison-gold px-6 py-2.5 text-xs font-black text-black disabled:opacity-40"
                    >
                      Concluir ({gameState.decision.selected.length})
                    </button>
                  )}
                  {gameState.decision.canCancel && (
                    <button
                      type="button"
                      onClick={() =>
                        sendAction({ type: "ocg_decision", toggleIndex: null })
                      }
                      disabled={acting}
                      className="rounded-lg border border-white/15 bg-white/5 px-6 py-2.5 text-xs font-black disabled:opacity-40"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </>
            )}

            {positionDecision && (
              <>
                <h2 className="mt-2 text-xl font-black">
                  Escolha como invocar
                </h2>
                <p className="mt-1 text-xs text-white/50">
                  Clique na posição visual desejada para continuar.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {positionDecision.positions.map((position) => {
                    const defensePosition = position === 4 || position === 8;
                    const faceDownPosition = position === 2 || position === 8;
                    const positionLabel = defensePosition ? "Defesa" : "Ataque";

                    return (
                      <button
                        key={position}
                        type="button"
                        onClick={() =>
                          sendAction({ type: "ocg_decision", position })
                        }
                        disabled={acting}
                        title={`Invocar em posição de ${positionLabel.toLowerCase()}`}
                        className="group flex min-h-56 flex-col items-center justify-center rounded-xl border border-edison-gold/25 bg-edison-gold/[0.07] p-4 transition duration-200 hover:border-edison-gold/70 hover:bg-edison-gold/15 hover:shadow-[0_0_28px_rgba(208,168,89,0.18)] disabled:opacity-40"
                      >
                        <div className="flex h-44 w-full items-center justify-center">
                          <div
                            className={`relative h-40 aspect-[421/614] overflow-hidden rounded border border-edison-gold/65 bg-black shadow-xl transition duration-200 group-hover:scale-105 ${defensePosition ? "rotate-90" : ""}`}
                          >
                            {faceDownPosition ? (
                              <Image
                                src="/assets/master-duelist-card-back.svg"
                                alt={`${positionLabel} com a carta virada para baixo`}
                                fill
                                sizes="112px"
                                className="object-cover"
                                unoptimized
                              />
                            ) : positionDecision.card?.imageUrl ? (
                              <Image
                                src={positionDecision.card.imageUrl}
                                alt={`${positionDecision.card.name} em posição de ${positionLabel.toLowerCase()}`}
                                fill
                                sizes="112px"
                                className="object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center bg-white/5 px-2 text-center text-[10px] font-bold text-white/55">
                                {positionDecision.card?.name ?? "Monstro"}
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="mt-2 rounded-full border border-white/10 bg-black/35 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-edison-gold">
                          {positionLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {actionError && (
              <p className="mt-4 rounded bg-red-950/80 px-3 py-2 text-xs text-red-200">
                {actionError}
              </p>
            )}
          </div>
        </div>
      )}


      {gameState?.chain && !gameState.decision && (
        <div className={`${BOARD_OVERLAY} z-[90] flex items-center justify-center bg-black/40 p-4 pointer-events-none animate-overlay-fade`}>
          <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-edison-gold/35 bg-[#121019]/95 p-5 text-center shadow-2xl backdrop-blur animate-modal-pop">
            {/* Sem elos, é uma janela aberta pelo motor para um efeito
                relevante do momento — ex.: Kalut durante o cálculo de dano. */}
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-edison-gold">
              {gameState.chain.linkCount > 0
                ? `Chain Link ${gameState.chain.linkCount}`
                : gameState.currentPhase === "battle"
                  ? "Janela de resposta · Batalha"
                  : "Janela de resposta"}
            </p>
            <h2 className="mt-2 text-lg font-black">
              {gameState.chain.linkCount > 0
                ? gameState.chain.card?.name ?? "Efeito ativado"
                : gameState.chain.awaitingYou
                  ? "Você pode ativar um efeito"
                  : "O oponente pode responder"}
            </h2>
            <p className="mt-2 text-xs text-white/55">
              {gameState.chain.awaitingYou
                ? gameState.chain.linkCount > 0
                  ? "Deseja responder à ativação?"
                  : "Escolha uma carta para ativar ou continue sem responder."
                : "Aguardando a resposta do oponente."}
            </p>
            {gameState.chain.awaitingYou &&
              (gameState.chain.options?.length ?? 0) > 0 && (
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  {gameState.chain.options!.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() =>
                        sendAction({ type: "activate_chain", cardId: card.id })
                      }
                      disabled={acting}
                      title={`Ativar ${card.name}`}
                      className="w-24 rounded-lg border border-edison-gold/30 bg-edison-gold/[0.06] p-1.5 transition hover:border-edison-gold hover:bg-edison-gold/15 disabled:opacity-40"
                    >
                      <div className="relative mx-auto aspect-[421/614] w-full overflow-hidden rounded">
                        {card.imageUrl ? (
                          <Image
                            src={card.imageUrl}
                            alt={card.name}
                            fill
                            sizes="96px"
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <CardBack />
                        )}
                      </div>
                      <span className="mt-1.5 block truncate text-[10px] font-bold">
                        {card.name}
                      </span>
                      <span className="mt-1 block rounded bg-edison-gold py-1 text-[10px] font-black text-black">
                        Ativar
                      </span>
                    </button>
                  ))}
                </div>
              )}
            {gameState.chain.deadlineAt && (
              <div className="mx-auto mt-4 flex h-14 w-14 items-center justify-center rounded-full border-2 border-edison-gold/45 bg-edison-gold/10 font-mono text-xl font-black text-edison-gold">
                {chainSecondsLeft}
              </div>
            )}
            {gameState.chain.awaitingYou && (
              <button
                type="button"
                onClick={() => sendAction({ type: "pass_chain" })}
                disabled={acting}
                className="mt-4 rounded-lg bg-edison-gold px-5 py-2 text-xs font-black text-black disabled:opacity-40"
              >
                Sem resposta
              </button>
            )}
            {!gameState.chain.awaitingYou &&
              (gameState.chain.canForceClose || chainSecondsLeft === 0) && (
                <button
                  type="button"
                  onClick={() => sendAction({ type: "force_pass_chain" })}
                  disabled={acting}
                  className="mt-4 rounded-lg bg-red-600 px-5 py-2 text-xs font-black text-white transition hover:bg-red-500 disabled:opacity-40"
                >
                  Finalizar chain
                </button>
              )}
          </div>
        </div>
      )}

      {gameState?.winnerId && !resultHidden && (
        <DuelResultScreen
          youWon={Boolean(gameState.youWon)}
          nickname={gameState.ownUser?.nickname ?? "Você"}
          image={gameState.ownUser?.image ?? null}
          ownLifePoints={gameState.ownLifePoints}
          opponentLifePoints={gameState.opponentLifePoints}
          opponentNickname={gameState.opponentUser?.nickname ?? "Oponente"}
          onViewBoard={() => setResultHidden(true)}
        />
      )}
      {gameState?.winnerId && resultHidden && (
        <div className={`${BOARD_OVERLAY} pointer-events-none z-[100] flex items-start justify-center pt-4`}>
          <button
            type="button"
            onClick={() => setResultHidden(false)}
            className={`pointer-events-auto rounded-full border px-5 py-2 text-xs font-black shadow-2xl backdrop-blur transition hover:brightness-110 animate-modal-pop ${
              gameState.youWon
                ? "border-edison-gold/60 bg-[#1c160a]/90 text-edison-gold"
                : "border-red-500/50 bg-[#1f0a0d]/90 text-red-200"
            }`}
          >
            Ver resultado
          </button>
        </div>
      )}

      <div
        className="relative z-10 flex h-screen w-full overflow-hidden"
        style={
          {
            // Altura do tabuleiro = 6.26 zonas; largura = 8.7 zonas.
            "--z": "min(calc((100vh - 24px) / 6.26), calc((100vw - var(--panel-w) - 40px) / 8.7))",
          } as CSSProperties
        }
      >
        <CardInspector card={selectedCard} />

        <div className="flex min-w-0 flex-1 items-center justify-center px-4">
          <main className="relative shrink-0 rounded-2xl border border-edison-gold/35 px-[calc(var(--z)*0.18)] shadow-[0_0_0_1px_rgba(0,0,0,0.7),0_24px_70px_rgba(0,0,0,0.75)]">
            {/* Playmats: vermelho para o oponente, azul para nós (cores do logo). */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
              <div className="absolute inset-x-0 top-0 h-1/2 bg-[radial-gradient(ellipse_at_50%_55%,rgba(190,40,60,0.30),transparent_65%),linear-gradient(180deg,#14080c_0%,#240d14_60%,#1c0a10_100%)]">
                <ArcaneCircle className="text-rose-200/[0.12]" />
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(ellipse_at_50%_45%,rgba(40,120,230,0.30),transparent_65%),linear-gradient(180deg,#0a1426_0%,#0c1a33_40%,#080f1d_100%)]">
                <ArcaneCircle className="text-sky-200/[0.12]" />
              </div>
              <div className="absolute inset-0 [background-image:radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1.5px)] [background-size:18px_18px]" />
              <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-edison-gold/70 to-transparent shadow-[0_0_14px_rgba(224,178,60,0.7)]" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.55)_100%)]" />
            </div>
            {[
              "left-2 top-2 rounded-tl-lg border-l-2 border-t-2",
              "right-2 top-2 rounded-tr-lg border-r-2 border-t-2",
              "bottom-2 left-2 rounded-bl-lg border-b-2 border-l-2",
              "bottom-2 right-2 rounded-br-lg border-b-2 border-r-2",
            ].map((corner) => (
              <span
                key={corner}
                className={`pointer-events-none absolute h-6 w-6 border-edison-gold/60 ${corner}`}
              />
            ))}

            {/* Mão do oponente */}
            <div className="relative flex h-[calc(var(--z)*0.58)] items-start justify-center pt-[calc(var(--z)*0.03)]">
              {Array.from(
                { length: opponentHandCount },
                (_, index) => (
                  <div
                    key={index}
                    style={{
                      marginLeft:
                        index === 0 ? 0 : handSpacing(opponentHandCount, 0.38, 12),
                      transform: fanTransform(index, opponentHandCount, true),
                    }}
                    className="shrink-0 shadow-[0_4px_10px_rgba(0,0,0,0.6)]"
                  >
                    <CardBack className="h-[calc(var(--z)*0.54)] w-[calc(var(--z)*0.38)] rotate-180" />
                  </div>
                )
              )}
            </div>

            {/* Lado do oponente (espelhado) */}
            <div className="relative flex">
              <div className="flex flex-col gap-[calc(var(--z)*0.08)]">
                <div className={ZONE_SIZE} />
                <SidePile
                  opponent
                  label="Banidas"
                  count={gameState?.opponentBanished.length ?? 0}
                  topCard={lastCard(gameState?.opponentBanished)}
                  onSelect={setSelectedCard}
                  icon={<Ban className="h-4 w-4" />}
                />
              </div>
              <div className="ml-[calc(var(--z)*0.12)] flex flex-col gap-[calc(var(--z)*0.08)]">
                <SidePile
                  opponent
                  label="Deck"
                  count={opponentDeckCount}
                  faceDown
                  icon={<Layers className="h-4 w-4" />}
                />
                <SidePile
                  opponent
                  label="Cemitério"
                  count={gameState?.opponentGraveyard.length ?? 0}
                  topCard={lastCard(gameState?.opponentGraveyard)}
                  onSelect={setSelectedCard}
                  icon={<Skull className="h-4 w-4" />}
                />
              </div>
              <div className="ml-[calc(var(--z)*0.3)] flex flex-col gap-[calc(var(--z)*0.08)]">
                <ZoneRow
                  opponent
                  kind="spell"
                  cards={gameState?.opponentSpellTraps}
                />
                <ZoneRow
                  opponent
                  kind="monster"
                  cards={gameState?.opponentMonsters}
                  onSelect={setSelectedCard}
                  targetableZones={battleTargetDecision?.candidates
                    .filter((candidate) => candidate.location === 4)
                    .map((candidate) => candidate.sequence)}
                  onTarget={chooseBattleTarget}
                />
              </div>
              <div className="ml-[calc(var(--z)*0.3)] flex flex-col gap-[calc(var(--z)*0.08)]">
                <SidePile
                  opponent
                  label="Extra"
                  count={gameState?.opponentExtraCount ?? 0}
                  faceDown
                  icon={<Sparkles className="h-4 w-4" />}
                />
                <FieldZone
                  opponent
                  fieldCard={opponentFieldSpell}
                  onSelect={setSelectedCard}
                />
              </div>
              <div className="ml-[calc(var(--z)*0.12)] flex w-[calc(var(--z)*0.71)] flex-col">
                <DuelistHud
                  opponent
                  lifePoints={gameState?.opponentLifePoints}
                  nickname={gameState?.opponentUser?.nickname}
                  image={gameState?.opponentUser?.image}
                />
              </div>
            </div>

            {/* Linha central: turno, fases e status do duelo. */}
            <div className="relative z-30 flex h-[calc(var(--z)*0.5)] items-center">
              <div className="flex w-[calc(var(--z)*1.54)] justify-center">
                <TurnBadge
                  turn={gameState?.currentTurn ?? 1}
                  isYourTurn={Boolean(gameState?.isYourTurn)}
                />
              </div>
              <div className="ml-[calc(var(--z)*0.3)] flex w-[calc(var(--z)*4.59)] justify-center">
                <PhaseTrack
                  currentPhase={gameState?.currentPhase}
                  phaseIsAvailable={phaseIsAvailable}
                  selectPhase={selectPhase}
                />
              </div>
              <div className="ml-[calc(var(--z)*0.3)] flex w-[calc(var(--z)*1.54)] justify-center">
                {statusMessage && (
                  <div
                    className={`flex flex-col items-center gap-1 rounded-lg border px-2.5 py-1 text-center font-semibold shadow-lg backdrop-blur ${UI_TEXT} ${
                      statusIsPrompt
                        ? "border-edison-gold/60 bg-[#1a1407]/90 text-edison-gold"
                        : "border-white/15 bg-[#07090d]/85 text-white/75"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {!statusIsPrompt && (
                        <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                      )}
                      {statusMessage}
                    </span>
                    {battleTargetDecision?.canCancel && (
                      <button
                        type="button"
                        onClick={() =>
                          sendAction({ type: "ocg_decision", cardIndices: null })
                        }
                        disabled={acting}
                        className="rounded-full bg-rose-600 px-2.5 py-0.5 text-[11px] font-bold text-white transition hover:bg-rose-500 disabled:opacity-40"
                      >
                        Ataque direto
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Nosso lado */}
            <div className="relative flex">
              <div className="flex w-[calc(var(--z)*0.71)] flex-col justify-end">
                <DuelistHud
                  lifePoints={gameState?.ownLifePoints}
                  nickname={gameState?.ownUser?.nickname}
                  image={gameState?.ownUser?.image}
                />
              </div>
              <div className="ml-[calc(var(--z)*0.12)] flex flex-col gap-[calc(var(--z)*0.08)]">
                <FieldZone
                  fieldCard={ownFieldSpell}
                  selectable={inlinePlaceDecision?.kind === "field"}
                  onSelect={setSelectedCard}
                  onZoneSelect={() =>
                    inlinePlaceDecision?.kind === "field"
                      ? chooseInlineDecisionZone(5)
                      : placeCard(5)
                  }
                />
                <SidePile
                  label="Extra"
                  count={gameState?.ownExtraCount ?? extraCount}
                  faceDown
                  icon={<Sparkles className="h-4 w-4" />}
                  overlay={
                    (gameState?.specialSummonCandidates.length ?? 0) > 0 ? (
                      <button
                        type="button"
                        onClick={() => setSpecialSummonOpen(true)}
                        className="absolute inset-x-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-edison-gold py-1 text-[10px] font-black uppercase tracking-wide text-black shadow-[0_0_14px_rgba(224,178,60,0.7)] hover:brightness-110"
                      >
                        Invocar
                      </button>
                    ) : undefined
                  }
                />
              </div>
              <div className="ml-[calc(var(--z)*0.3)] flex flex-col gap-[calc(var(--z)*0.08)]">
                <ZoneRow
                  kind="monster"
                  cards={fieldMonsters}
                  onSelect={setSelectedCard}
                  attackableZones={gameState?.attackableMonsters.map(
                    (attacker) => attacker.zone
                  )}
                  onAttack={declareAttack}
                  selectable={
                    pendingPlacement?.kind === "monster" ||
                    inlinePlaceDecision?.kind === "monster"
                  }
                  selectableZones={
                    inlinePlaceDecision?.kind === "monster"
                      ? inlinePlaceDecision.places.map((place) => place.sequence)
                      : undefined
                  }
                  onZoneSelect={
                    inlinePlaceDecision?.kind === "monster"
                      ? chooseInlineDecisionZone
                      : placeCard
                  }
                />
                <ZoneRow
                  kind="spell"
                  cards={fieldSpellTraps}
                  onSelect={setSelectedCard}
                  selectable={inlinePlaceDecision?.kind === "spell"}
                  selectableZones={
                    inlinePlaceDecision?.kind === "spell"
                      ? inlinePlaceDecision.places.map((place) => place.sequence)
                      : undefined
                  }
                  onZoneSelect={
                    inlinePlaceDecision?.kind === "spell"
                      ? chooseInlineDecisionZone
                      : placeCard
                  }
                />
              </div>
              <div className="ml-[calc(var(--z)*0.3)] flex flex-col gap-[calc(var(--z)*0.08)]">
                <SidePile
                  label="Cemitério"
                  count={gameState?.ownGraveyard.length ?? 0}
                  topCard={lastCard(gameState?.ownGraveyard)}
                  onSelect={setSelectedCard}
                  icon={<Skull className="h-4 w-4" />}
                />
                <SidePile
                  label="Deck"
                  count={playerDeckCount}
                  faceDown
                  icon={<Layers className="h-4 w-4" />}
                />
              </div>
              <div className="ml-[calc(var(--z)*0.12)] flex flex-col gap-[calc(var(--z)*0.08)]">
                <SidePile
                  label="Banidas"
                  count={gameState?.ownBanished.length ?? 0}
                  topCard={lastCard(gameState?.ownBanished)}
                  onSelect={setSelectedCard}
                  icon={<Ban className="h-4 w-4" />}
                />
                <div className={`flex items-center justify-center ${ZONE_SIZE}`}>
                  {canCancelPendingAction && (
                    <button
                      type="button"
                      onClick={cancelPendingAction}
                      title="Clique com o botão direito em qualquer lugar do tabuleiro também cancela"
                      className={`flex w-full flex-col items-center gap-1 rounded-md border border-rose-400/50 bg-rose-950/80 px-1 py-2 font-bold text-rose-100 shadow-lg transition hover:bg-rose-900 animate-modal-pop ${UI_TEXT}`}
                    >
                      <X className="h-4 w-4" />
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Nossa mão */}
            <div className="relative z-40 flex h-[calc(var(--z)*1.02)] items-start justify-center pt-[calc(var(--z)*0.04)]">
              {loading &&
                Array.from({ length: 5 }, (_, index) => (
                  <div
                    key={index}
                    style={{
                      marginLeft: index === 0 ? 0 : handSpacing(5, 0.64, 8),
                      transform: fanTransform(index, 5),
                    }}
                    className="shrink-0 shadow-[0_6px_14px_rgba(0,0,0,0.6)]"
                  >
                    <CardBack className="h-[calc(var(--z)*0.9)] w-[calc(var(--z)*0.64)]" />
                  </div>
                ))}
              {!loading &&
                hand.map((card, index) => (
                  <div
                    key={`${card.id}-${index}`}
                    style={{
                      marginLeft:
                        index === 0 ? 0 : handSpacing(hand.length, 0.64, 8),
                    }}
                    className="relative h-[calc(var(--z)*0.9)] w-[calc(var(--z)*0.64)] shrink-0 hover:z-20"
                  >
                    {selectedHandIndex === index &&
                      selectedActions.length > 0 && (
                        <div className="absolute bottom-[calc(100%+14px)] left-1/2 z-50 flex -translate-x-1/2 flex-col gap-1 rounded-lg border border-edison-gold/40 bg-[#0a0c11]/95 p-1.5 shadow-2xl backdrop-blur animate-modal-pop">
                          {selectedActions.map((action) => (
                            <button
                              key={action}
                              type="button"
                              onClick={() => handleCardAction(action, card.id)}
                              disabled={acting}
                              className="whitespace-nowrap rounded-md bg-white/5 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-edison-gold hover:text-black disabled:opacity-40"
                            >
                              {{
                                summon: "Normal Summon",
                                set_monster: "Set",
                                set_spell_trap: "Set",
                                activate: "Ativar",
                                special_summon: "Special Summon",
                                attack: "Atacar",
                              }[action]}
                            </button>
                          ))}
                        </div>
                      )}
                    <div
                      style={{ transform: fanTransform(index, hand.length) }}
                      className="h-full w-full"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCard(card);
                          setSelectedHandIndex((current) =>
                            current === index ? undefined : index
                          );
                          setActionError(undefined);
                        }}
                        className={`relative h-full w-full overflow-hidden rounded-[4px] shadow-[0_6px_14px_rgba(0,0,0,0.6)] transition duration-200 hover:-translate-y-[calc(var(--z)*0.14)] hover:scale-105 ${
                          selectedHandIndex === index
                            ? "-translate-y-[calc(var(--z)*0.14)] ring-2 ring-edison-gold shadow-[0_0_18px_rgba(224,178,60,0.7)]"
                            : "ring-1 ring-black/60"
                        }`}
                      >
                        {card.imageUrl ? (
                          <Image
                            src={card.imageUrl}
                            alt={card.name}
                            fill
                            sizes="100px"
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <CardBack />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </main>
        </div>
      </div>

      {actionError && (
        <div className="pointer-events-none fixed bottom-5 left-[var(--panel-w)] right-0 z-[120] flex justify-center px-4">
          <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-lg border border-red-500/40 bg-red-950/95 px-4 py-2.5 text-xs text-red-100 shadow-2xl backdrop-blur animate-modal-pop">
            <span className="flex-1">{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(undefined)}
              className="shrink-0 text-red-300 hover:text-white"
              aria-label="Fechar aviso"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
