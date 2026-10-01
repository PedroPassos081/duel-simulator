import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { deleteClanMessage, getClanChat, MESSAGE_MAX_LENGTH, MessageError, postClanMessage } from "@/lib/messages";

async function userId() {
  const session = await auth();
  return session?.user ? (session.user as { id: string }).id : null;
}

function fail(err: unknown) {
  if (err instanceof MessageError) return NextResponse.json({ error: err.message }, { status: 422 });
  throw err;
}

// Chat do clã: só os membros veem
export async function GET() {
  const id = await userId();
  if (!id) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  try {
    return NextResponse.json(await getClanChat(id));
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request) {
  const id = await userId();
  if (!id) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  const parsed = z.object({ body: z.string().max(MESSAGE_MAX_LENGTH * 2) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Escreva uma mensagem." }, { status: 400 });
  try {
    await postClanMessage(id, parsed.data.body);
    return NextResponse.json(await getClanChat(id), { status: 201 });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: Request) {
  const id = await userId();
  if (!id) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  const messageId = new URL(req.url).searchParams.get("id");
  if (!messageId) return NextResponse.json({ error: "Mensagem não informada." }, { status: 400 });
  try {
    await deleteClanMessage(id, messageId);
    return NextResponse.json(await getClanChat(id));
  } catch (err) {
    return fail(err);
  }
}
