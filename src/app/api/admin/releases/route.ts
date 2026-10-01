import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/admin-server";
import {
  ReleaseError,
  assignCards,
  createRelease,
  deleteRelease,
  getRoomAvailability,
  listReleases,
  listUnreleasedCards,
  processDueReleases,
  releaseCardsNow,
  releaseNow,
  scheduleRoom,
  updateRelease,
} from "@/lib/card-releases";
import { getRoomSchedules } from "@/lib/site-settings";
import { DUEL_ROOMS } from "@/lib/duel-rooms";

// Aba Lançamentos do Admin: abertura das salas, lançamentos programados e cartas não lançadas
export async function GET() {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  await processDueReleases();
  const [schedules, availability, releases, cards] = await Promise.all([getRoomSchedules(), getRoomAvailability(), listReleases(), listUnreleasedCards()]);
  return NextResponse.json({
    rooms: DUEL_ROOMS.map((r) => ({ id: r.id, name: r.name, manualOpen: schedules[r.id]?.open ?? true, opensAt: schedules[r.id]?.opensAt ?? null, open: availability[r.id]?.open ?? true })),
    releases,
    cards,
  });
}

const releaseFields = {
  name: z.string().trim().min(3).max(80),
  description: z.string().trim().max(600).nullable().optional(),
  releaseAt: z.coerce.date().nullable(),
  promoPercent: z.number().int().min(0).max(100),
  promoHours: z.number().int().min(0).max(1000),
};
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("room"), roomId: z.string(), open: z.boolean(), opensAt: z.coerce.date().nullable() }),
  z.object({ action: z.literal("create"), ...releaseFields }),
  z.object({ action: z.literal("update"), id: z.string(), ...releaseFields }),
  z.object({ action: z.literal("delete"), id: z.string() }),
  z.object({ action: z.literal("release_now"), id: z.string() }),
  z.object({ action: z.literal("release_cards"), cardIds: z.array(z.number().int()).min(1).max(500) }),
  z.object({ action: z.literal("assign_cards"), cardIds: z.array(z.number().int()).min(1).max(500), releaseId: z.string().nullable() }),
]);

export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Confira os campos." }, { status: 400 });
  const body = parsed.data;
  try {
    switch (body.action) {
      case "room":
        await scheduleRoom(admin.id, body.roomId, { open: body.open, opensAt: body.opensAt });
        return NextResponse.json({ message: body.open ? "Sala aberta." : body.opensAt ? "Abertura agendada (e colocada no calendário)." : "Sala fechada." });
      case "create":
        await createRelease(body);
        return NextResponse.json({ message: "Lançamento criado." });
      case "update":
        await updateRelease(body.id, body);
        return NextResponse.json({ message: "Lançamento salvo (e atualizado no calendário)." });
      case "delete":
        await deleteRelease(body.id);
        return NextResponse.json({ message: "Lançamento apagado. As cartas continuam não lançadas." });
      case "release_now":
        await releaseNow(body.id);
        return NextResponse.json({ message: "Lançado! As cartas já estão na loja e o anúncio saiu no Jornal." });
      case "release_cards":
        return NextResponse.json({ message: `${await releaseCardsNow(body.cardIds)} carta(s) lançada(s). Já estão na loja.` });
      case "assign_cards":
        return NextResponse.json({ message: `${await assignCards(body.cardIds, body.releaseId)} carta(s) ${body.releaseId ? "colocada(s) no lançamento" : "sem lançamento"}.` });
    }
  } catch (err) {
    if (err instanceof ReleaseError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}
