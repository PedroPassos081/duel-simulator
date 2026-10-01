import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/admin-server";
import { BanlistError, buildBanlistAnnouncement, publishBanlistAnnouncement } from "@/lib/banlists";

function fail(err: unknown) {
  if (err instanceof BanlistError) return NextResponse.json({ error: err.message }, { status: 422 });
  throw err;
}

// Texto pronto do anúncio (?full=1: a lista completa em vez das mudanças)
export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  try {
    return NextResponse.json(await buildBanlistAnnouncement(params.id, new URL(req.url).searchParams.get("full") === "1"));
  } catch (err) {
    return fail(err);
  }
}

const schema = z.object({ title: z.string().max(140), summary: z.string().max(300).optional(), content: z.string().max(20_000) });

// POST: publica no Jornal (fixado) e marca as mudanças como anunciadas
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Só o Admin." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Texto do anúncio inválido." }, { status: 400 });
  try {
    const post = await publishBanlistAnnouncement(admin.id, params.id, parsed.data);
    return NextResponse.json({ message: "Anúncio publicado e fixado no Jornal!", postId: post.id });
  } catch (err) {
    return fail(err);
  }
}
