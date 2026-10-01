import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { listConversations, MESSAGE_MAX_LENGTH, MessageError, sendDirectMessage } from "@/lib/messages";

async function userId() {
  const session = await auth();
  return session?.user ? (session.user as { id: string }).id : null;
}

// Suas conversas (com a última mensagem e as não lidas)
export async function GET() {
  const id = await userId();
  if (!id) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  return NextResponse.json(await listConversations(id));
}

const sendSchema = z.object({ to: z.string().trim().min(1).max(40), body: z.string().max(MESSAGE_MAX_LENGTH * 2) });

// Envia uma mensagem privada para um @nick
export async function POST(req: Request) {
  const id = await userId();
  if (!id) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  const parsed = sendSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Informe o @nick e a mensagem." }, { status: 400 });
  try {
    return NextResponse.json(await sendDirectMessage(id, parsed.data.to, parsed.data.body), { status: 201 });
  } catch (err) {
    if (err instanceof MessageError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }
}
