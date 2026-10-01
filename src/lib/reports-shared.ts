// Constantes da denúncia usadas no navegador e no servidor
// Motivos da denúncia (o jogador escolhe um e explica por escrito)
export const REPORT_REASONS = {
  offense: "Ofensa ou assédio",
  cheating: "Trapaça no duelo",
  name: "Nome ou foto impróprios",
  spam: "Spam ou flood",
  scam: "Golpe ou negociação desonesta",
  other: "Outro",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

export const REPORT_STATUS = { open: "Aberta", resolved: "Resolvida", dismissed: "Arquivada" } as const;
export type ReportStatus = keyof typeof REPORT_STATUS;

export const REPORT_MIN_LENGTH = 10;
export const REPORT_MAX_LENGTH = 1000;

export function isReportReason(value: unknown): value is ReportReason {
  return typeof value === "string" && value in REPORT_REASONS;
}
