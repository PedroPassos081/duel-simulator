import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getThread, MessageError } from "@/lib/messages";

// Conversa com um jogador (marca como lidas as mensagens dele)
export async function GET(_req: Request, { params }: { params: { username: string } }) {
  const session = await auth();
  const id = session?.user ? (session.user as { id: string }).id : null;
  if (!id) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  try {
    return NextResponse.json(await getThread(id, decodeURIComponent(params.username)));
  } catch (err) {
    if (err instanceof MessageError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
