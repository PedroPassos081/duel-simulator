import Link from "next/link";
import { CalendarRange, Trophy } from "lucide-react";
import { auth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { PlayerName } from "@/components/PlayerName";
import {
  RANKING_CATEGORIES,
  RANKING_PERIODS,
  getRanking,
  type RankingCategory,
  type RankingPeriod,
} from "@/lib/rankings";

export const dynamic = "force-dynamic";

const MEDALS = ["text-amber-300", "text-zinc-300", "text-orange-400"];

const dateFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export default async function RankingPage({
  searchParams,
}: {
  searchParams: { cat?: string; period?: string };
}) {
  const category = (RANKING_CATEGORIES.find((c) => c.id === searchParams.cat) ?? RANKING_CATEGORIES[0]);
  const period = RANKING_PERIODS.find((p) => p.id === searchParams.period) ?? RANKING_PERIODS[0];

  const session = await auth();
  const viewerId = session?.user ? (session.user as { id: string }).id : null;
  const ranking = await getRanking(category.id, period.id, viewerId);

  const href = (cat: RankingCategory, per: RankingPeriod) => `/ranking?cat=${cat}&period=${per}`;
  const viewerInTop = ranking.viewer && ranking.entries.some((e) => e.userId === ranking.viewer!.userId);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* CABEÇALHO */}
      <div className="mb-6 border-b border-zinc-800 pb-5">
        <h1 className="flex items-center gap-2 text-3xl font-bold text-zinc-100 tracking-tight">
          <Trophy className="w-7 h-7 text-amber-400" />
          Ranking
        </h1>
        <p className="text-sm text-zinc-400 mt-1">Os melhores duelistas em cada categoria.</p>
      </div>

      {/* CATEGORIAS */}
      <div className="flex flex-wrap gap-2 mb-4">
        {RANKING_CATEGORIES.map((c) => (
          <Link
            key={c.id}
            href={href(c.id, period.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold border transition-colors ${
              c.id === category.id
                ? "bg-amber-500 text-black border-amber-500"
                : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-amber-500/50"
            }`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      {/* PERÍODOS */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
          {RANKING_PERIODS.map((p) => (
            <Link
              key={p.id}
              href={href(category.id, p.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                p.id === period.id ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
        <p className="flex items-center gap-1.5 text-xs text-zinc-400">
          <CalendarRange className="w-3.5 h-3.5" />
          {ranking.period.label}
          {ranking.period.range && period.id === "season" && (
            <span className="text-zinc-500">
              ({dateFormat.format(ranking.period.range.start)} –{" "}
              {dateFormat.format(new Date(ranking.period.range.end.getTime() - 1))})
            </span>
          )}
        </p>
      </div>

      <p className="text-xs text-zinc-500 mb-3">
        {category.description}
        {category.id === "cards" && period.id !== "all" && " Neste período, conta as cartas adquiridas."}
      </p>

      {/* TABELA */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
        {ranking.period.unavailable ? (
          <EmptyState text="Nenhuma season está acontecendo agora." />
        ) : ranking.entries.length === 0 ? (
          <EmptyState text="Ainda não há ninguém neste ranking." />
        ) : (
          <ol>
            {ranking.entries.map((entry) => (
              <RankingRow key={entry.userId} entry={entry} unit={category.unit} isViewer={entry.userId === viewerId} />
            ))}
          </ol>
        )}
      </section>

      {/* SUA POSIÇÃO (quando você está fora do top) */}
      {ranking.viewer && !viewerInTop && (
        <section className="mt-4 rounded-xl border border-amber-500/30 bg-zinc-900/60 overflow-hidden">
          <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Sua posição</p>
          <ol>
            <RankingRow entry={ranking.viewer} unit={category.unit} isViewer />
          </ol>
        </section>
      )}
    </div>
  );
}

function RankingRow({
  entry,
  unit,
  isViewer,
}: {
  entry: Awaited<ReturnType<typeof getRanking>>["entries"][number];
  unit: string;
  isViewer: boolean;
}) {
  const medal = MEDALS[entry.position - 1];
  return (
    <li
      className={`flex items-center gap-3 px-4 py-3 border-b border-zinc-800/60 last:border-b-0 ${
        isViewer ? "bg-amber-500/10" : ""
      }`}
    >
      <span className={`w-8 text-center text-sm font-bold ${medal ?? "text-zinc-500"}`}>
        {medal ? <Trophy className="w-5 h-5 mx-auto" /> : `${entry.position}º`}
      </span>
      <Avatar {...entry.avatar} size={36} />
      <span className="flex-1 min-w-0 truncate text-sm font-semibold text-zinc-200">
        <PlayerName {...entry.playerName} />
        {isViewer && <span className="ml-1.5 text-xs font-normal text-zinc-500">(você)</span>}
      </span>
      <span className="text-sm font-bold text-zinc-100 tabular-nums">
        {entry.value > 0 && unit === "score" ? `+${entry.value}` : entry.value}
        <span className="ml-1 text-xs font-normal text-zinc-500">{unit}</span>
      </span>
    </li>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="px-4 py-12 text-center text-sm text-zinc-500">{text}</p>;
}
