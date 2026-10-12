import { closeFinishedPeriods } from "@/lib/ranking-closing";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Mail, Settings, Shield } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/Avatar";
import { PlayerName } from "@/components/PlayerName";
import { RoleBadge } from "@/components/RoleBadge";
import { GlassPanel } from "@/components/theme/PageBackdrop";
import { toAvatarProps, toPlayerNameProps, userAvatarSelect } from "@/lib/avatar";
import { getPlayerStats } from "@/lib/rankings";
import { getTrophies } from "@/lib/tournaments";
import { roleLabel } from "@/lib/clans/roles";
import { ProfileStatsCard } from "./ProfileStatsCard";
import { TrophyShelf } from "./TrophyShelf";
import { ReportButton } from "./ReportButton";

export const dynamic = "force-dynamic";

const since = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

export default async function ProfilePage({ params }: { params: { username: string } }) {
  await closeFinishedPeriods();
  const session = await auth();
  const viewerId = session?.user ? (session.user as { id: string }).id : null;
  const handle = decodeURIComponent(params.username).replace(/^@/, "").toLowerCase();

  // /perfil/me: o seu próprio perfil
  if (handle === "me") {
    if (!viewerId) redirect("/login?callbackUrl=/perfil/me");
    const me = await prisma.user.findUnique({ where: { id: viewerId }, select: { username: true } });
    redirect(me?.username ? `/perfil/${me.username}` : "/account");
  }

  const user = await prisma.user.findFirst({
    where: { username: { equals: handle, mode: "insensitive" } },
    select: {
      id: true,
      role: true,
      createdAt: true,
      ...userAvatarSelect,
      clanMembership: { select: { role: true, clan: { select: { name: true } } } },
    },
  });
  if (!user) notFound();

  const [stats, trophies] = await Promise.all([getPlayerStats(user.id), getTrophies(user.id)]);
  const isMe = viewerId === user.id;

  return (
    <GlassPanel className="max-w-3xl">
      {/* CABEÇALHO: foto com moldura, nick, clã */}
      <header className="mb-6 flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <Avatar {...toAvatarProps(user)} size={84} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <PlayerName {...toPlayerNameProps(user)} link={false} className="text-2xl font-black text-zinc-100" />
            <RoleBadge role={user.role} />
          </p>
          <p className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-zinc-400 sm:justify-start">
            {user.clanMembership ? (
              <span className="flex items-center gap-1">
                <Shield className="h-3.5 w-3.5 text-amber-400" />
                {user.clanMembership.clan.name}
                <span className="text-zinc-500">· {roleLabel(user.clanMembership.role)}</span>
              </span>
            ) : (
              <span className="text-zinc-500">Sem clã</span>
            )}
            <span className="text-zinc-500">Duelista desde {since.format(user.createdAt)}</span>
          </p>
        </div>
        {isMe && (
          <Link
            href="/account"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
          >
            <Settings className="h-3.5 w-3.5" /> Editar perfil
          </Link>
        )}
        {!isMe && viewerId && user.username && (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/mensagens?para=${encodeURIComponent(user.username)}`}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-black hover:bg-amber-400"
            >
              <Mail className="h-3.5 w-3.5" /> Mensagem
            </Link>
            <ReportButton username={user.username} />
          </div>
        )}
      </header>

      {/* FICHA: Geral | Season | Semana */}
      <ProfileStatsCard stats={stats} />

      {/* ESTANTE DE TROFÉUS */}
      <TrophyShelf
        trophies={trophies.map((t) => ({ id: t.id, kind: t.kind, title: t.title, placement: t.placement, awardedAt: t.awardedAt.toISOString() }))}
      />
    </GlassPanel>
  );
}
