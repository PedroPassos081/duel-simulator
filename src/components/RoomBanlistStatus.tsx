import { BAN_STATUS_INFO, ROOM_BANLISTS, statusIn } from "@/lib/banlist-shared";

/** Situação da carta em cada sala: Proibida, Limitada (1), Semi-limitada (2) ou Livre (3). */
export function RoomBanlistStatus({ entries, rooms }: { entries?: { format?: string; status: string }[]; rooms?: string[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Banlist das salas</span>
      <div className="grid grid-cols-2 gap-2">
        {ROOM_BANLISTS.map((room) => {
          const info = BAN_STATUS_INFO[statusIn(entries, room.id)];
          // Fora do pool da sala (ex.: carta de 2008 na Slifer, que vai até 2006)
          if (rooms && !rooms.includes(room.id)) {
            return (
              <div key={room.id} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-2.5 py-1.5">
                <span className={`text-xs font-bold ${room.className}`}>{room.name}</span>
                <span className="rounded border border-zinc-700 bg-zinc-800/60 px-1.5 py-px text-[11px] font-bold text-zinc-400" title="Esta carta não existe nas cartas desta sala">
                  Fora da sala
                </span>
              </div>
            );
          }
          return (
            <div key={room.id} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-2.5 py-1.5">
              <span className={`text-xs font-bold ${room.className}`}>{room.name}</span>
              <span className={`rounded border px-1.5 py-px text-[11px] font-bold ${info.className}`} title={`Até ${info.copies} ${info.copies === 1 ? "cópia" : "cópias"} no deck`}>
                {info.label} {info.copies > 0 && `· ${info.copies}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
