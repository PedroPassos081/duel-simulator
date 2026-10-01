import { prisma } from "@/lib/prisma";

// Suspensão de conta aplicada pelo Admin. Vale na hora, mesmo para quem já
// estava logado: auth() trata a sessão de uma conta suspensa como deslogada.
// O resultado fica guardado por 30 s para não consultar o banco a cada requisição.
const SUSPENSION_CACHE_MS = 30_000;
const cache = new Map<string, { suspended: boolean; checkedAt: number }>();

export function isSuspended(user: { suspendedUntil: Date | null }) {
  return Boolean(user.suspendedUntil && user.suspendedUntil > new Date());
}

export function clearSuspensionCache(userId: string) {
  cache.delete(userId);
}

export async function isUserSuspended(userId: string) {
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.checkedAt < SUSPENSION_CACHE_MS) return cached.suspended;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { suspendedUntil: true } });
  const suspended = Boolean(user && isSuspended(user));
  cache.set(userId, { suspended, checkedAt: Date.now() });
  return suspended;
}
