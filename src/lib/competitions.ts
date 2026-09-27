import { prisma } from "@/lib/prisma";
import { createTournamentPost } from "@/lib/news";

export interface CompetitionPlacement {
  userId: string;
  points: number;
  placement?: number;
}

/**
 * Registra uma competição e os pontos de cada participante. Os pontos entram
 * no ranking de Competição no período (season/ano) de `heldAt`, e o resultado
 * é publicado automaticamente no jornal.
 *
 * Uso típico:
 *   await createCompetitionWithResults("Torneio de Abertura", new Date(), [
 *     { userId: campeao, placement: 1, points: 100 },
 *     { userId: vice, placement: 2, points: 60 },
 *   ]);
 */
export async function createCompetitionWithResults(
  name: string,
  heldAt: Date,
  results: CompetitionPlacement[],
  description?: string
) {
  const competition = await prisma.competition.create({
    data: {
      name,
      description,
      heldAt,
      results: { create: results },
    },
    include: { results: true },
  });
  // Torneio finalizado aparece no jornal
  await createTournamentPost(competition.id);
  return competition;
}

/** Adiciona ou corrige os pontos de um participante em uma competição existente. */
export async function setCompetitionResult(competitionId: string, result: CompetitionPlacement) {
  return prisma.competitionResult.upsert({
    where: { competitionId_userId: { competitionId, userId: result.userId } },
    update: { points: result.points, placement: result.placement },
    create: { competitionId, ...result },
  });
}
