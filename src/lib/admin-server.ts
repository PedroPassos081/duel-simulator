import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";

/** Quem está logado e o cargo de conta dele (lido do banco, nunca da sessão). */
export async function getViewer() {
  const session = await auth();
  const userId = session?.user ? (session.user as { id: string }).id : null;
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  return user ? { id: user.id, role: user.role, isAdmin: isAdmin(user.role) } : null;
}

/** Para rotas da API do Admin: devolve o Admin logado ou null (a rota responde 403). */
export async function getAdmin() {
  const viewer = await getViewer();
  return viewer?.isAdmin ? viewer : null;
}
