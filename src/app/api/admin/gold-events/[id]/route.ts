import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdmin } from "@/lib/admin-server";
import { GoldEventError, buildAnnouncement, deleteGoldEvent, publishAnnouncement } from "@/lib/gold-events";

// GET: anúncio pronto para esse evento
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  const event = await prisma.goldEvent.findUnique({ where: { id: params.id } });
  if (!event) return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
  return NextResponse.json(buildAnnouncement(event));
}

const publishSchema = z.object({
  title: z.string().trim().min(3),
  summary: z.string().trim().max(300).optional(),
  content: z.string().trim().min(10),
});

// POST: publica o anúncio no Jornal
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  const parsed = publishSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Escreva o título e o texto do anúncio." }, { status: 400 });
  try {
    const post = await publishAnnouncement(admin.id, params.id, parsed.data);
    return NextResponse.json({ message: "Anúncio publicado no Jornal (fixado no topo).", postId: post.id });
  } catch (err) {
    if (err instanceof GoldEventError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}

// DELETE: apaga o evento
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  await deleteGoldEvent(params.id);
  return NextResponse.json({ message: "Evento apagado." });
}
