// Datas do jornal e do calendário sempre no horário de Brasília, mesmo que o
// servidor rode em outro fuso (o Brasil não tem horário de verão desde 2019).
export const APP_TIME_ZONE = "America/Sao_Paulo";
const APP_UTC_OFFSET = "-03:00";

export const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
export const WEEKDAY_SHORT = ["D", "S", "T", "Q", "Q", "S", "S"];

const pad = (n: number) => String(n).padStart(2, "0");

/** "AAAA-MM-DD" do dia (no horário de Brasília) em que a data cai. */
export function dayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(date);
}

export function dayKeyOf(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

/** Ano e mês (0-11) de hoje no horário de Brasília. */
export function currentYearMonth(now = new Date()) {
  const [year, month] = dayKey(now).split("-").map(Number);
  return { year, month: month - 1 };
}

/** Início (inclusivo) e fim (exclusivo) de um mês no horário de Brasília. */
export function monthRange(year: number, month: number) {
  const next = month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };
  return {
    start: new Date(`${year}-${pad(month + 1)}-01T00:00:00${APP_UTC_OFFSET}`),
    end: new Date(`${next.year}-${pad(next.month + 1)}-01T00:00:00${APP_UTC_OFFSET}`),
  };
}

/** Semanas do mês (domingo a sábado); null nos dias fora do mês. */
export function monthGrid(year: number, month: number) {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

export function formatDate(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: APP_TIME_ZONE, ...options }).format(date);
}

/** "há 5 min", "há 2 h", "há 3 dias" ou a data, para comentários. */
export function formatRelative(date: Date, now = new Date()) {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days} ${days === 1 ? "dia" : "dias"}`;
  return formatDate(date, { day: "2-digit", month: "short", year: "numeric" });
}
