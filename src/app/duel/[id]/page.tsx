import Link from "next/link";
import { notFound } from "next/navigation";
import { Swords } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/Avatar";
import { toAvatarProps, toPlayerNameProps, userAvatarSelect } from "@/lib/avatar";
import { PlayerName } from "@/components/PlayerName";
import { getDuelRoom } from "@/lib/duel-rooms";
import { LeaveDuelButton } from "./LeaveDuelButton";

export default async function DuelPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const userId = session?.user ? (session.user as { id: string }).id : null;

  const match = await prisma.match.findUnique({
    where: { id: params.id },
    include: {
      players: {
        include: { user: { select: userAvatarSelect } },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!match || !match.players.some((p) => p.userId === userId)) notFound();

  const room = getDuelRoom(match.format);
  const deckIds = match.players.map((p) => p.deckId);
  const decks = await prisma.deck.findMany({ where: { id: { in: deckIds } }, select: { id: true, name: true } });
  const deckName = (id: string) => decks.find((d) => d.id === id)?.name ?? "Deck";

  // Você sempre embaixo, o oponente em cima
  const me = match.players.find((p) => p.userId === userId)!;
  const opponent = match.players.find((p) => p.userId !== userId);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <p className="text-center text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Random · {room?.name ?? match.format}
      </p>

      <div className="mt-6 flex flex-col items-center gap-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-6 py-10">
        {opponent && <PlayerBadge player={opponent} deckName={deckName(opponent.deckId)} />}

        <div className="flex items-center gap-3 text-amber-400">
          <span className="h-px w-16 bg-zinc-700" />
          <Swords className="w-8 h-8" />
          <span className="h-px w-16 bg-zinc-700" />
        </div>

        <PlayerBadge player={me} deckName={deckName(me.deckId)} isMe />
      </div>

      {match.finishedAt ? (
        <div className="mt-6 text-center text-sm text-zinc-400">
          Este duelo foi encerrado.{" "}
          <Link href="/random" className="font-semibold text-amber-400 hover:text-amber-300">
            Voltar ao Random
          </Link>
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center gap-3 text-center">
          <p className="max-w-md text-sm text-zinc-400">
            Oponente encontrado! O motor de duelo ainda está em desenvolvimento. Quando estiver pronto, o duelo
            acontece aqui.
          </p>
          <LeaveDuelButton matchId={match.id} />
        </div>
      )}
    </div>
  );
}

function PlayerBadge({
  player,
  deckName,
  isMe,
}: {
  player: { user: Parameters<typeof toAvatarProps>[0] };
  deckName: string;
  isMe?: boolean;
}) {
  const avatar = toAvatarProps(player.user);
  return (
    <div className="flex flex-col items-center gap-2">
      <Avatar {...avatar} size={72} />
      <p className="text-lg font-bold text-zinc-100">
        <PlayerName {...toPlayerNameProps(player.user)} />
        {isMe && <span className="ml-1.5 text-xs font-normal text-zinc-500">(você)</span>}
      </p>
      <p className="text-xs text-zinc-400">{deckName}</p>
    </div>
  );
}
