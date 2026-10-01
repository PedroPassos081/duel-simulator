// Horário de Brasília (UTC−3, sem horário de verão desde 2019).
// A semana e a season viram no horário de Brasília, não no do servidor.
export const BRT_TIMEZONE = "America/Sao_Paulo";
const OFFSET_MS = -3 * 3_600_000;
const DAY_MS = 86_400_000;

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;
export const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"] as const;

/** Data e hora de um instante no relógio de Brasília. */
export function brtParts(date: Date) {
  const d = new Date(date.getTime() + OFFSET_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate(), weekday: d.getUTCDay(), hour: d.getUTCHours(), minute: d.getUTCMinutes() };
}

/** Instante de uma data/hora de Brasília (mês começa em 0; aceita dia/mês fora do intervalo). */
export function brtDate(year: number, month: number, day: number, hour = 0, minute = 0) {
  return new Date(Date.UTC(year, month, day, hour, minute) - OFFSET_MS);
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

/** "29/09" ou "29/09 às 00:00" no horário de Brasília. */
export function formatBrt(date: Date, withTime = false) {
  const p = brtParts(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${pad(p.day)}/${pad(p.month + 1)}`;
  return withTime ? `${day} às ${pad(p.hour)}:${pad(p.minute)}` : day;
}

export interface WeekSchedule {
  weekday: number; // 0 = domingo, 1 = segunda...
  hour: number;
  minute: number;
}

// Padrão: vira de domingo para segunda, à meia-noite
export const DEFAULT_WEEK_SCHEDULE: WeekSchedule = { weekday: 1, hour: 0, minute: 0 };

/** Semana que contém `now`: começa no dia/horário configurado e dura 7 dias. */
export function weekRange(now: Date, schedule: WeekSchedule = DEFAULT_WEEK_SCHEDULE) {
  const p = brtParts(now);
  let start = brtDate(p.year, p.month, p.day - ((p.weekday - schedule.weekday + 7) % 7), schedule.hour, schedule.minute);
  if (start > now) start = addDays(start, -7);
  return { start, end: addDays(start, 7) };
}

/** Mês de `now` no horário de Brasília: do dia 1 às 00:00 até o dia 1 do mês seguinte. */
export function monthRange(now: Date) {
  const p = brtParts(now);
  return { start: brtDate(p.year, p.month, 1), end: brtDate(p.year, p.month + 1, 1), name: `${MONTHS[p.month]} ${p.year}` };
}

export function isWeekSchedule(value: unknown): value is WeekSchedule {
  const v = value as WeekSchedule;
  return (
    !!v &&
    Number.isInteger(v.weekday) && v.weekday >= 0 && v.weekday <= 6 &&
    Number.isInteger(v.hour) && v.hour >= 0 && v.hour <= 23 &&
    Number.isInteger(v.minute) && v.minute >= 0 && v.minute <= 59
  );
}

/** Valor para <input type="datetime-local"> no horário de Brasília. */
export function toBrtInput(value: string | Date) {
  const p = brtParts(new Date(value));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month + 1)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Lê um <input type="datetime-local"> como horário de Brasília. */
export function fromBrtInput(value: string) {
  return new Date(`${value}:00-03:00`);
}
