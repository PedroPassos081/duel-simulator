import { closeFinishedPeriods } from "@/lib/ranking-closing";
import Link from "next/link";
import { CalendarRange, Trophy } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/Avatar";
import { ArtBanner } from "@/components/theme/ArtBanner";
import { GlassPanel } from "@/components/theme/PageBackdrop";
import { EyeOfHorus, ObeliskIcon } from "@/components/theme/EgyptIcons";
import { ART, cardArt } from "@/lib/card-art";
import { PlayerName } from "@/components/PlayerName";
import {
  CLAN_RANKING_CATEGORIES,
  RANKING_CATEGORIES,
  RANKING_PERIODS,
  getClanRanking,
  getRanking,
  type PeriodInfo,
  type RankingPeriod,
} from "@/lib/rankings";

export const dynamic = "force-dynamic";

const MEDALS = ["text-amber-300", "text-zinc-300", "text-orange-400"];

const dateFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });

type View = "players" | "clans";

// Abas principais: ranking de jogadores e de clãs, cada uma com a sua arte ao fundo
const VIEWS = [
  { id: "players", label: "Duelistas", hint: "Jogador contra jogador", art: cardArt(46986414), icon: EyeOfHorus }, // Dark Magician
  { id: "clans", label: "Clãs", hint: "A força de cada tribo", art: cardArt(62473983), icon: ObeliskIcon }, // Gravekeeper's Chief
] as const;

export default async function RankingPage({
  searchParams,
}: {
  searchParams: { view?: string; cat?: string; period?: string };
}) {
  const view: View = searchParams.view === "clans" ? "clans" : "players";
  const categories = view === "clans" ? CLAN_RANKING_CATEGORIES : RANKING_CATEGORIES;
  const category = categories.find((c) => c.id === searchParams.cat) ?? categories[0];
  const period = RANKING_PERIODS.find((p) => p.id === searchParams.period) ?? RANKING_PERIODS[0];

  // Encerra a semana/season que acabou (troféus e prêmios) antes de mostrar o ranking
  await closeFinishedPeriods();
  const session = await auth();
  const viewerId = session?.user ? (session.user as { id: string }).id : null;

  const href = (v: View, cat: string, per: RankingPeriod) => `/ranking?view=${v}&cat=${cat}&period=${per}`;

  return (
    <GlassPanel className="max-w-4xl">
      {/* CABEÇALHO */}
      {/* Exodia: o duelista invencível no topo do pódio */}
      {/* Exodia: o duelista invencível no topo do pódio */}
      <ArtBanner
        art={ART.exodia}
        emblemArt={ART.ultimateDragon}
        eyebrow="Hall dos Campeões"
        title={
          <span className="flex items-center gap-2">
            <Trophy className="h-7 w-7 text-amber-300" />
            Ranking
          </span>
        }
        subtitle={view === "clans" ? "Os clãs mais fortes em cada categoria." : "Os melhores duelistas em cada categoria."}
        tone="red"
        position="center 20%"
      />

      {/* DUELISTAS | CLÃS */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        {VIEWS.map(({ id, label, hint, art, icon: Icon }) => (
          <Link
            key={id}
            // Ao trocar de aba, a categoria volta para a primeira daquela aba
            href={href(id, (id === "clans" ? CLAN_RANKING_CATEGORIES : RANKING_CATEGORIES)[0].id, period.id)}
            className={`group relative flex items-center gap-3 overflow-hidden rounded-xl border px-4 py-3 transition-all ${
              view === id
                ? "border-amber-500 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                : "border-zinc-800 text-zinc-300 hover:border-amber-500/40 hover:text-zinc-100"
            }`}
          >
            <img
              src={art}
              alt=""
              aria-hidden
              className={`absolute inset-0 h-full w-full object-cover object-[center_25%] transition-all duration-300 group-hover:scale-105 ${
                view === id ? "opacity-45" : "opacity-20 group-hover:opacity-35"
              }`}
            />
            <span
              aria-hidden
              className={`absolute inset-0 bg-gradient-to-r ${
                view === id ? "from-amber-950/80 via-zinc-950/70 to-zinc-950/40" : "from-zinc-950/95 via-zinc-950/80 to-zinc-950/60"
              }`}
            />
            <Icon className="relative h-6 w-6 shrink-0" />
            <span className="relative [text-shadow:0_2px_6px_rgba(0,0,0,0.9)]">
              <span className="block font-bold">{label}</span>
              <span className="block text-[11px] opacity-80">{hint}</span>
            </span>
          </Link>
        ))}
      </div>

      {/* CATEGORIAS */}
      <div className="mb-4 flex flex-wrap gap-2">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={href(view, c.id, period.id)}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
              c.id === category.id
                ? "border-amber-500 bg-amber-500 text-black"
                : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-amber-500/50"
            }`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      {view === "clans" ? (
        <ClanRanking category={category.id as (typeof CLAN_RANKING_CATEGORIES)[number]["id"]} period={period.id} viewerId={viewerId} href={(per) => href(view, category.id, per)} description={category.description} unit={category.unit} />
      ) : (
        <PlayerRanking category={category.id as (typeof RANKING_CATEGORIES)[number]["id"]} period={period.id} viewerId={viewerId} href={(per) => href(view, category.id, per)} description={category.description} unit={category.unit} />
      )}
    </GlassPanel>
  );
}

/** Abas de período + legenda da categoria. */
function PeriodBar({
  current,
  info,
  href,
  description,
}: {
  current: RankingPeriod;
  info: PeriodInfo;
  href: (period: RankingPeriod) => string;
  description: string;
}) {
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
          {RANKING_PERIODS.map((p) => (
            <Link
              key={p.id}
              href={href(p.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                p.id === current ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
        <p className="flex items-center gap-1.5 text-xs text-zinc-400">
          <CalendarRange className="h-3.5 w-3.5" />
          {info.label}
          {info.range && current === "season" && (
            <span className="text-zinc-500">
              ({dateFormat.format(info.range.start)} – {dateFormat.format(new Date(info.range.end.getTime() - 1))})
            </span>
          )}
          {info.endsLabel && <span className="text-amber-300/80">· termina {info.endsLabel}</span>}
        </p>
      </div>
      <p className="mb-3 text-xs text-zinc-500">{description}</p>
    </>
  );
}

// ------------------------------ DUELISTAS ------------------------------

async function PlayerRanking({
  category,
  period,
  viewerId,
  href,
  description,
  unit,
}: {
  category: (typeof RANKING_CATEGORIES)[number]["id"];
  period: RankingPeriod;
  viewerId: string | null;
  href: (period: RankingPeriod) => string;
  description: string;
  unit: string;
}) {
  const ranking = await getRanking(category, period, viewerId);
  const viewerInTop = ranking.viewer && ranking.entries.some((e) => e.userId === ranking.viewer!.userId);

  return (
    <>
      <PeriodBar
        current={period}
        info={ranking.period}
        href={href}
        description={description + (category === "cards" && period !== "all" ? " Neste período, conta as cartas adquiridas." : "")}
      />

      <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
        {ranking.period.unavailable ? (
          <EmptyState text="Nenhuma season está acontecendo agora." />
        ) : ranking.entries.length === 0 ? (
          <EmptyState text="Ainda não há ninguém neste ranking." />
        ) : (
          <ol>
            {ranking.entries.map((entry) => (
              <PlayerRow key={entry.userId} entry={entry} unit={unit} isViewer={entry.userId === viewerId} />
            ))}
          </ol>
        )}
      </section>

      {/* SUA POSIÇÃO (quando você está fora do top) */}
      {ranking.viewer && !viewerInTop && (
        <section className="mt-4 overflow-hidden rounded-xl border border-amber-500/30 bg-zinc-900/60">
          <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Sua posição</p>
          <ol>
            <PlayerRow entry={ranking.viewer} unit={unit} isViewer />
          </ol>
        </section>
      )}
    </>
  );
}

function PlayerRow({
  entry,
  unit,
  isViewer,
}: {
  entry: Awaited<ReturnType<typeof getRanking>>["entries"][number];
  unit: string;
  isViewer: boolean;
}) {
  return (
    <li className={`flex items-center gap-3 border-b border-zinc-800/60 px-4 py-3 last:border-b-0 ${isViewer ? "bg-amber-500/10" : ""}`}>
      <Position position={entry.position} />
      <Avatar {...entry.avatar} size={36} />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-200">
        <PlayerName {...entry.playerName} />
        {isViewer && <span className="ml-1.5 text-xs font-normal text-zinc-500">(você)</span>}
      </span>
      <Value value={entry.value} unit={unit} />
    </li>
  );
}

// -------------------------------- CLÃS --------------------------------

async function ClanRanking({
  category,
  period,
  viewerId,
  href,
  description,
  unit,
}: {
  category: (typeof CLAN_RANKING_CATEGORIES)[number]["id"];
  period: RankingPeriod;
  viewerId: string | null;
  href: (period: RankingPeriod) => string;
  description: string;
  unit: string;
}) {
  const viewerClanId = viewerId
    ? (await prisma.clanMember.findUnique({ where: { userId: viewerId }, select: { clanId: true } }))?.clanId ?? null
    : null;
  const ranking = await getClanRanking(category, period, viewerClanId);
  const viewerInTop = ranking.viewer && ranking.entries.some((e) => e.clanId === ranking.viewer!.clanId);

  return (
    <>
      <PeriodBar current={period} info={ranking.period} href={href} description={description} />

      <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
        {ranking.period.unavailable ? (
          <EmptyState text="Nenhuma season está acontecendo agora." />
        ) : ranking.entries.length === 0 ? (
          <EmptyState text="Nenhum clã pontuou ainda." />
        ) : (
          <ol>
            {ranking.entries.map((entry) => (
              <ClanRow key={entry.clanId} entry={entry} unit={unit} isViewer={entry.clanId === viewerClanId} />
            ))}
          </ol>
        )}
      </section>

      {/* SEU CLÃ (quando está fora do top) */}
      {ranking.viewer && !viewerInTop && (
        <section className="mt-4 overflow-hidden rounded-xl border border-amber-500/30 bg-zinc-900/60">
          <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Seu clã</p>
          <ol>
            <ClanRow entry={ranking.viewer} unit={unit} isViewer />
          </ol>
        </section>
      )}
    </>
  );
}

function ClanRow({
  entry,
  unit,
  isViewer,
}: {
  entry: Awaited<ReturnType<typeof getClanRanking>>["entries"][number];
  unit: string;
  isViewer: boolean;
}) {
  return (
    <li className={`flex items-center gap-3 border-b border-zinc-800/60 px-4 py-3 last:border-b-0 ${isViewer ? "bg-amber-500/10" : ""}`}>
      <Position position={entry.position} />
      {/* Brasão: obelisco dourado */}
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-500/50 bg-zinc-950 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
        <ObeliskIcon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-zinc-200">
          {entry.name}
          {isViewer && <span className="ml-1.5 text-xs font-normal text-zinc-500">(seu clã)</span>}
        </span>
        <span className="block text-[11px] text-zinc-500">{entry.memberCount} membros</span>
      </span>
      <Value value={entry.value} unit={unit} />
    </li>
  );
}

// ------------------------------- COMUNS -------------------------------

function Position({ position }: { position: number }) {
  const medal = MEDALS[position - 1];
  return (
    <span className={`w-8 text-center text-sm font-bold ${medal ?? "text-zinc-500"}`}>
      {medal ? <Trophy className="mx-auto h-5 w-5" /> : `${position}º`}
    </span>
  );
}

function Value({ value, unit }: { value: number; unit: string }) {
  return (
    <span className="text-sm font-bold tabular-nums text-zinc-100">
      {value > 0 && unit === "score" ? `+${value}` : value}
      <span className="ml-1 text-xs font-normal text-zinc-500">{unit}</span>
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="px-4 py-12 text-center text-sm text-zinc-500">{text}</p>;
}
