import { prisma } from "@/lib/prisma";
import { monthRange } from "@/lib/dates";

export const EVENT_TYPES = {
  tournament: { label: "Torneio", dot: "bg-amber-400", badge: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  event: { label: "Evento", dot: "bg-purple-400", badge: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  update: { label: "Atualização", dot: "bg-sky-400", badge: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  other: { label: "Outro", dot: "bg-zinc-400", badge: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30" },
} as const;

export type EventType = keyof typeof EVENT_TYPES;

export function eventTypeInfo(type: string) {
  return EVENT_TYPES[type as EventType] ?? EVENT_TYPES.other;
}

/** Próximos eventos: os que ainda não terminaram, do mais próximo ao mais distante. */
export async function getUpcomingEvents(limit: number, now = new Date()) {
  return prisma.calendarEvent.findMany({
    where: {
      OR: [{ startsAt: { gte: now } }, { endsAt: { gte: now } }],
    },
    orderBy: { startsAt: "asc" },
    take: limit,
  });
}

/** Eventos que acontecem (total ou parcialmente) no mês. */
export async function getEventsInMonth(year: number, month: number) {
  const { start, end } = monthRange(year, month);
  return prisma.calendarEvent.findMany({
    where: {
      startsAt: { lt: end },
      OR: [{ startsAt: { gte: start } }, { endsAt: { gte: start } }],
    },
    orderBy: { startsAt: "asc" },
  });
}

/**
 * Coloca um evento no calendário.
 *
 * Uso típico:
 *   await createCalendarEvent({ title: "Torneio de Abertura", type: "tournament",
 *     startsAt: new Date("2026-10-10T19:00:00-03:00") });
 */
export async function createCalendarEvent(data: {
  title: string;
  startsAt: Date;
  endsAt?: Date;
  type?: EventType;
  description?: string;
}) {
  return prisma.calendarEvent.create({ data });
}
