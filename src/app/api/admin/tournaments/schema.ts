import { z } from "zod";
import { rewardSchema } from "@/lib/reward-schema";

// Formulário de torneio do Admin (criar e editar)
export const tournamentSchema = z.object({
  name: z.string().trim().min(3, "Dê um nome ao torneio.").max(80),
  description: z.string().trim().max(500).nullable().optional(),
  type: z.enum(["official", "quick"]),
  format: z.string().trim().min(1).max(60), // id da banlist
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  // Chaves: vagas, tempo de cada jogador (s) e horários da Chave A, Chave B e Final
  structure: z.enum(["points", "bracket"]).default("points"),
  maxEntrants: z.number().int().min(2).max(512).nullable().optional(),
  clockSeconds: z.number().int().min(30).max(3600).optional(),
  stages: z.array(z.object({ key: z.enum(["A", "B", "final"]), startsAt: z.coerce.date() })).max(3).optional(),
  prizes: z.array(z.object({ placement: z.number().int().min(1).max(64), rewards: z.array(rewardSchema).max(10) })).max(16),
});
