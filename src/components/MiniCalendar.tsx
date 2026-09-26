import Link from "next/link";
import { EyeOfHorus, MillenniumPyramid } from "@/components/theme/EgyptIcons";
import { Cartouche } from "@/components/theme/EgyptDecor";
import { eventTypeInfo, getEventsInMonth, getUpcomingEvents } from "@/lib/calendar";
import { MONTH_NAMES, WEEKDAY_SHORT, currentYearMonth, dayKey, dayKeyOf, formatDate, monthGrid } from "@/lib/dates";

const UPCOMING_COUNT = 5;

/** Mini calendário do mês atual + os próximos eventos. Fica na lateral do jornal. */
export async function MiniCalendar() {
  const now = new Date();
  const { year, month } = currentYearMonth(now);
  const [monthEvents, upcoming] = await Promise.all([
    getEventsInMonth(year, month),
    getUpcomingEvents(UPCOMING_COUNT, now),
  ]);

  const todayKey = dayKey(now);
  const daysWithEvents = new Set(monthEvents.map((e) => dayKey(e.startsAt)));

  return (
    <aside className="flex flex-col gap-4">
      <section className="rounded-xl border border-amber-500/25 bg-gradient-to-b from-amber-950/30 to-zinc-900/60 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/70">Hoje</p>
            <p className="text-lg font-bold text-zinc-100 first-letter:uppercase">
              {formatDate(now, { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <EyeOfHorus className="h-5 w-8 shrink-0 text-amber-400/80" />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <Cartouche className="text-xs">
            {MONTH_NAMES[month]} {year}
          </Cartouche>
          <Link href="/calendario" className="text-xs font-semibold text-amber-400 hover:text-amber-300">
            Ver calendário →
          </Link>
        </div>

        <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[11px]">
          {WEEKDAY_SHORT.map((d, i) => (
            <span key={i} className="py-1 font-bold text-amber-400/70">
              {d}
            </span>
          ))}
          {monthGrid(year, month).flat().map((day, i) => {
            if (day === null) return <span key={i} />;
            const key = dayKeyOf(year, month, day);
            const isToday = key === todayKey;
            return (
              <span
                key={i}
                className={`relative flex h-7 items-center justify-center rounded-md ${
                  isToday ? "bg-amber-500 font-bold text-black shadow-[0_0_10px_rgba(245,158,11,0.6)]" : "text-zinc-300"
                }`}
              >
                {day}
                {daysWithEvents.has(key) && (
                  <span
                    className={`absolute bottom-0.5 h-1 w-1 rounded-full ${isToday ? "bg-black" : "bg-amber-400"}`}
                  />
                )}
              </span>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-amber-500/25 bg-zinc-900/60 p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-100">
          <MillenniumPyramid className="w-4 h-4 text-amber-400" />
          Próximos eventos
        </h2>
        {upcoming.length === 0 ? (
          <p className="mt-3 text-xs text-zinc-500">Nenhum evento marcado por enquanto.</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-3">
            {upcoming.map((event) => {
              const type = eventTypeInfo(event.type);
              return (
                <li key={event.id} className="flex gap-3">
                  <div className="flex w-11 shrink-0 flex-col items-center rounded-lg border border-amber-500/30 bg-amber-500/5 py-1">
                    <span className="text-[10px] font-semibold uppercase text-zinc-500">
                      {formatDate(event.startsAt, { month: "short" }).replace(".", "")}
                    </span>
                    <span className="text-base font-bold leading-none text-amber-100">
                      {formatDate(event.startsAt, { day: "numeric" })}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-200">{event.title}</p>
                    <p className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                      <span className={`h-1.5 w-1.5 rounded-full ${type.dot}`} />
                      {type.label} · {formatDate(event.startsAt, { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </aside>
  );
}
