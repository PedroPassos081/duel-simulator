import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/admin-server";
import { GoldEventError, buildAnnouncement, createGoldEvent, listGoldEvents } from "@/lib/gold-events";

const goldEventSchema = z.object({
  name: z.string().trim().min(3, "Dê um nome ao evento.").max(80),
  bonusGold: z.number().int().min(1).max(1_000_000),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
});

export async function GET() {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  return NextResponse.json(await listGoldEvents());
}

// Cria o evento e devolve um anúncio pronto para revisar antes de publicar
export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  const parsed = goldEventSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  try {
    const event = await createGoldEvent(admin.id, parsed.data);
    return NextResponse.json({ event, announcement: buildAnnouncement(parsed.data) }, { status: 201 });
  } catch (err) {
    if (err instanceof GoldEventError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}
