import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EVENT_TYPES, eventTypeInfo, getEventsInMonth } from "@/lib/calendar";
import { MONTH_NAMES, currentYearMonth, dayKey, dayKeyOf, formatDate, monthGrid } from "@/lib/dates";
import { EyeOfHorus } from "@/components/theme/EgyptIcons";
import { Cartouche, EgyptBand } from "@/components/theme/EgyptDecor";
import { GlassPanel } from "@/components/theme/PageBackdrop";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MAX_EVENTS_PER_CELL = 2;

function parseMonth(value: string | undefined) {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const month = Number(match[2]) - 1;
    if (month >= 0 && month <= 11) return { year: Number(match[1]), month };
  }
  return currentYearMonth();
}

const monthParam = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, "0")}`;

export default async function CalendarPage({ searchParams }: { searchParams: { mes?: string } }) {
  const { year, month } = parseMonth(searchParams.mes);
  const events = await getEventsInMonth(year, month);
  const todayKey = dayKey(new Date());
  const current = currentYearMonth();
  const isCurrentMonth = current.year === year && current.month === month;

  const prev = month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
  const next = month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };

  const eventsByDay = new Map<string, typeof events>();
  for (const event of events) {
    const key = dayKey(event.startsAt);
    eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), event]);
  }

  return (
    <GlassPanel className="max-w-6xl">
      {/* CABEÇALHO */}
      <div className="mb-6">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-zinc-100">
          <EyeOfHorus className="h-7 w-11 text-amber-400" />
          Calendário
        </h1>
        <p className="mt-1 text-sm text-zinc-400">Torneios e eventos que estão por vir.</p>
        <EgyptBand className="mt-4" />
      </div>

      {/* NAVEGAÇÃO DO MÊS */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/calendario?mes=${monthParam(prev.year, prev.month)}`}
            aria-label="Mês anterior"
            className="rounded-lg border border-amber-500/30 p-2 text-amber-300 hover:bg-amber-500/10"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <Cartouche className="min-w-44 text-lg">
            {MONTH_NAMES[month]} {year}
          </Cartouche>
          <Link
            href={`/calendario?mes=${monthParam(next.year, next.month)}`}
            aria-label="Próximo mês"
            className="rounded-lg border border-amber-500/30 p-2 text-amber-300 hover:bg-amber-500/10"
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
          {!isCurrentMonth && (
            <Link href="/calendario" className="text-xs font-semibold text-amber-400 hover:text-amber-300">
              Voltar para hoje
            </Link>
          )}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-zinc-400">
          {Object.values(EVENT_TYPES).map((t) => (
            <span key={t.label} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${t.dot}`} />
              {t.label}
            </span>
          ))}
        </div>
      </div>

      {/* GRADE DO MÊS */}
      <div className="overflow-hidden rounded-xl border border-amber-500/25 bg-gradient-to-b from-amber-950/25 to-zinc-900/60">
        <div className="grid grid-cols-7 border-b border-amber-500/20 text-center text-xs font-bold uppercase tracking-wider text-amber-400/80">
          {WEEKDAYS.map((d) => (
            <span key={d} className="py-2">
              {d}
            </span>
          ))}
        </div>
        {monthGrid(year, month).map((week, w) => (
          <div key={w} className="grid grid-cols-7 border-b border-amber-500/10 last:border-b-0">
            {week.map((day, d) => {
              if (day === null) {
                return <div key={d} className="min-h-16 border-r border-amber-500/10 bg-black/20 last:border-r-0 sm:min-h-24" />;
              }
              const key = dayKeyOf(year, month, day);
              const dayEvents = eventsByDay.get(key) ?? [];
              const isToday = key === todayKey;
              return (
                <div
                  key={d}
                  className={`min-h-16 border-r border-amber-500/10 p-1 last:border-r-0 sm:min-h-24 sm:p-1.5 ${
                    isToday ? "bg-amber-500/10" : ""
                  }`}
                >
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      isToday ? "bg-amber-500 font-bold text-black shadow-[0_0_12px_rgba(245,158,11,0.6)]" : "text-zinc-400"
                    }`}
                  >
                    {day}
                  </span>
                  {/* Celular: pontinhos; telas maiores: títulos */}
                  <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                    {dayEvents.map((e) => (
                      <span key={e.id} className={`h-1.5 w-1.5 rounded-full ${eventTypeInfo(e.type).dot}`} />
                    ))}
                  </div>
                  <div className="mt-1 hidden flex-col gap-0.5 sm:flex">
                    {dayEvents.slice(0, MAX_EVENTS_PER_CELL).map((e) => (
                      <span
                        key={e.id}
                        title={e.title}
                        className={`truncate rounded border px-1 py-0.5 text-[10px] font-semibold ${eventTypeInfo(e.type).badge}`}
                      >
                        {e.title}
                      </span>
                    ))}
                    {dayEvents.length > MAX_EVENTS_PER_CELL && (
                      <span className="text-[10px] text-zinc-500">+{dayEvents.length - MAX_EVENTS_PER_CELL} mais</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* LISTA DO MÊS */}
      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-base font-bold text-zinc-100">
          <span className="h-px w-6 bg-amber-500/50" />
          Eventos de {MONTH_NAMES[month].toLowerCase()}
        </h2>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Nada marcado neste mês.</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-3">
            {events.map((event) => {
              const type = eventTypeInfo(event.type);
              return (
                <li
                  key={event.id}
                  className="flex gap-4 rounded-xl border border-zinc-800 border-l-amber-500/60 border-l-4 bg-zinc-900/60 p-4"
                >
                  <div className="flex w-14 shrink-0 flex-col items-center rounded-lg border border-amber-500/30 bg-amber-500/5 py-1.5">
                    <span className="text-[10px] font-semibold uppercase text-amber-400/80">
                      {formatDate(event.startsAt, { weekday: "short" }).replace(".", "")}
                    </span>
                    <span className="text-xl font-bold leading-none text-amber-100">
                      {formatDate(event.startsAt, { day: "numeric" })}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-zinc-100">{event.title}</h3>
                      <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${type.badge}`}>{type.label}</span>
                    </div>
                    <p className="text-xs text-zinc-500">
                      {formatDate(event.startsAt, { hour: "2-digit", minute: "2-digit" })}
                      {event.endsAt &&
                        ` até ${formatDate(event.endsAt, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`}
                    </p>
                    {event.description && <p className="mt-1.5 text-sm text-zinc-300">{event.description}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </GlassPanel>
  );
}
