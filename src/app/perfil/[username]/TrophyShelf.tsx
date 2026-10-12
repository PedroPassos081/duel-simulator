import { MillenniumPyramid } from "@/components/theme/EgyptIcons";

interface TrophyView {
  id: string;
  kind: string;
  title: string;
  placement: number | null;
  awardedAt: string;
}

// Cor da pirâmide pela colocação: ouro, prata, bronze
const PLACE_STYLE: Record<number, { text: string; ring: string; label: string }> = {
  1: { text: "text-amber-300", ring: "border-amber-400/60 bg-amber-500/10 shadow-[0_0_16px_rgba(245,158,11,0.3)]", label: "Campeão" },
  2: { text: "text-zinc-200", ring: "border-zinc-300/50 bg-zinc-400/10", label: "2º lugar" },
  3: { text: "text-orange-400", ring: "border-orange-500/50 bg-orange-500/10", label: "3º lugar" },
};
const KIND_LABEL: Record<string, string> = { official: "Oficial", quick: "Rápido", weekly: "Semanal", season: "Season", special: "Especial" };

const date = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" });

/** Estante de troféus do perfil (torneios, semanal e season até o 3º lugar). */
export function TrophyShelf({ trophies }: { trophies: TrophyView[] }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-zinc-400">
        <MillenniumPyramid className="h-4 w-4 text-amber-400" /> Estante de troféus
        {trophies.length > 0 && <span className="text-zinc-600">({trophies.length})</span>}
      </h2>
      {trophies.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
          Nenhum troféu ainda. Torneios, a Semana e a Season dão troféus até o 3º lugar.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {trophies.map((t) => {
            const style = PLACE_STYLE[t.placement ?? 0] ?? PLACE_STYLE[3];
            return (
              <li key={t.id} className={`flex flex-col items-center gap-1 rounded-xl border px-3 py-4 text-center ${style.ring}`} title={t.title}>
                <MillenniumPyramid className={`h-9 w-9 ${style.text}`} />
                <p className={`text-xs font-black uppercase tracking-wider ${style.text}`}>{style.label}</p>
                <p className="line-clamp-2 text-sm font-semibold text-zinc-100">{t.title}</p>
                <p className="text-[11px] text-zinc-500">
                  {KIND_LABEL[t.kind] ?? t.kind} · {date.format(new Date(t.awardedAt))}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
