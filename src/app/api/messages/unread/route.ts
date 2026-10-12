import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { countUnreadMessages } from "@/lib/messages";

// Quantas mensagens não lidas (o número no envelope do topo)
export async function GET() {
  const session = await auth();
  const id = session?.user ? (session.user as { id: string }).id : null;
  return NextResponse.json({ unread: id ? await countUnreadMessages(id) : 0 });
}
