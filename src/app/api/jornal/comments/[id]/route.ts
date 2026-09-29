import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getViewer } from "@/lib/admin-server";

// Apaga um comentário: o autor apaga o próprio; o Admin apaga qualquer um.
// O texto some, mas as respostas dos outros continuam.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { count } = await prisma.newsComment.updateMany({
    where: { id: params.id, deletedAt: null, ...(viewer.isAdmin ? {} : { userId: viewer.id }) },
    data: { deletedAt: new Date() },
  });
  if (count === 0) {
    return NextResponse.json({ error: "Comentário não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
