"use client";

import { useMemo, useState } from "react";
import { CircleDollarSign, Clock, Gem, Plus, Trash2, Trophy } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { PlayerName } from "@/components/PlayerName";
import {
  CLAN_BONUS_RATE,
  CLAN_ROLES,
  VAULT_REASONS,
  canManageInvites,
  decideKick,
  decideRoleChange,
  decideSettings,
  decideVault,
  roleLabel,
  type ClanRole,
} from "@/lib/clans/roles";
import { formatDate, formatRelative } from "@/lib/dates";
import type { Act, ClanData, Prize } from "./types";
import { DecisionHint, NumberInput, Panel, inputClass, primaryButton, secondaryButton } from "./ui";

const ROLE_BADGES: Record<ClanRole, string> = {
  leader: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  vice: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  sub: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  captain: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  member: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
};

const ROLE_ORDER: ClanRole[] = ["leader", "vice", "sub", "captain", "member"];

function RoleBadge({ role }: { role: ClanRole }) {
  return <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${ROLE_BADGES[role]}`}>{roleLabel(role)}</span>;
}

function Amounts({ gold, cash }: { gold: number; cash: number }) {
  return (
    <span className="inline-flex items-center gap-2 tabular-nums">
      <span className="flex items-center gap-1 text-amber-400">
        <CircleDollarSign className="w-3.5 h-3.5" />
        {gold}
      </span>
      <span className="flex items-center gap-1 text-purple-400">
        <Gem className="w-3.5 h-3.5" />
        {cash}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// MEMBROS
// ---------------------------------------------------------------------------

export function MembersTab({ data, act }: { data: ClanData; act: Act }) {
  const [managing, setManaging] = useState<string | null>(null);
  const myRole = data.me.role;
  const counts = Object.fromEntries(ROLE_ORDER.map((r) => [r, data.members.filter((m) => m.role === r).length]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
        {ROLE_ORDER.filter((r) => r !== "member").map((r) => (
          <span key={r} className="rounded-md border border-zinc-800 px-2 py-1">
            {roleLabel(r)}: {counts[r]}/{CLAN_ROLES[r].max}
          </span>
        ))}
      </div>

      <ul className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
        {data.members.map((m) => {
          const isMe = m.userId === data.me.userId;
          const kick = decideKick(myRole, m.role);
          // "Passar a liderança" fica por último, para nunca ser a opção padrão
          const roleOptions = [...ROLE_ORDER.slice(1), ROLE_ORDER[0]].filter(
            (r) => r !== m.role && decideRoleChange(myRole, m.role, r).kind !== "forbidden"
          );
          const canManage = !isMe && (kick.kind !== "forbidden" || roleOptions.length > 0);

          return (
            <li key={m.userId} className="border-b border-zinc-800/60 px-4 py-3 last:border-b-0">
              <div className="flex items-center gap-3">
                <Avatar {...m.avatar} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <PlayerName {...m.playerName} className="font-semibold text-zinc-200" />
                    <RoleBadge role={m.role} />
                    {isMe && <span className="text-xs text-zinc-500">(você)</span>}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    Contribuiu <Amounts {...m.contribution} />
                  </p>
                </div>
                {canManage && (
                  <button onClick={() => setManaging(managing === m.userId ? null : m.userId)} className={secondaryButton}>
                    Gerenciar
                  </button>
                )}
              </div>

              {managing === m.userId && (
                <ManageMember
                  roleOptions={roleOptions}
                  myRole={myRole}
                  targetRole={m.role}
                  onChangeRole={(role) => act({ action: "change_role", userId: m.userId, role }).then(() => setManaging(null))}
                  onKick={() => act({ action: "kick", userId: m.userId }).then(() => setManaging(null))}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ManageMember({
  roleOptions,
  myRole,
  targetRole,
  onChangeRole,
  onKick,
}: {
  roleOptions: ClanRole[];
  myRole: ClanRole;
  targetRole: ClanRole;
  onChangeRole: (role: ClanRole) => void;
  onKick: () => void;
}) {
  const [newRole, setNewRole] = useState<ClanRole | "">(roleOptions[0] ?? "");
  const kick = decideKick(myRole, targetRole);

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 sm:ml-12">
      {roleOptions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as ClanRole)}
              className={`${inputClass} w-auto`}
            >
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {r === "leader" ? "Passar a liderança" : roleLabel(r)}
                </option>
              ))}
            </select>
            <button onClick={() => newRole && onChangeRole(newRole)} className={primaryButton}>
              {newRole === "leader" ? "Passar liderança" : "Mudar cargo"}
            </button>
          </div>
          {newRole === "leader" && (
            <p className="text-xs text-amber-300">Você passa a ter o cargo atual deste jogador.</p>
          )}
          {newRole && <DecisionHint decision={decideRoleChange(myRole, targetRole, newRole)} />}
        </div>
      )}
      {kick.kind !== "forbidden" && (
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => confirm("Expulsar este jogador do clã?") && onKick()}
            className="self-start rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/10"
          >
            {kick.kind === "request" ? "Pedir expulsão" : "Expulsar"}
          </button>
          <DecisionHint decision={kick} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// COFRE
// ---------------------------------------------------------------------------

export function VaultTab({ data, act, canDistribute }: { data: ClanData; act: Act; canDistribute: boolean }) {
  const ranking = [...data.members].sort(
    (a, b) => b.contribution.cash - a.contribution.cash || b.contribution.gold - a.contribution.gold
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-3 text-xs leading-relaxed text-purple-200">
        O cofre recebe <strong>{CLAN_BONUS_RATE * 100}%</strong> de tudo o que os membros ganham no Random e em premiações,
        sem tirar nada deles, além de doações e prêmios do clã.
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Quem mais contribuiu" description="Bônus de 10% + doações de cada membro.">
          <ol className="flex flex-col gap-2">
            {ranking.map((m, i) => (
              <li key={m.userId} className="flex items-center gap-2 text-sm">
                <span className="w-6 text-right text-xs font-bold text-zinc-500">{i + 1}º</span>
                <PlayerName {...m.playerName} className="min-w-0 flex-1 truncate text-zinc-200" />
                <Amounts {...m.contribution} />
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="Histórico do cofre">
          {data.vaultTransactions.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhuma movimentação ainda.</p>
          ) : (
            <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
              {data.vaultTransactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0">
                    <span className="text-zinc-300">{VAULT_REASONS[t.reason as keyof typeof VAULT_REASONS] ?? t.reason}</span>
                    {t.userName && <span className="text-zinc-500"> · @{t.userName}</span>}
                    <span className="block text-zinc-600">{formatRelative(new Date(t.createdAt))}</span>
                  </span>
                  <span className={`shrink-0 font-bold tabular-nums ${t.amount > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {t.amount > 0 ? "+" : ""}
                    {t.amount} {t.currency === "gold" ? "gold" : "crédito"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {canDistribute ? (
        <DistributePanel data={data} act={act} />
      ) : (
        <p className="text-xs text-zinc-500">Só o líder, o vice e os sub-líderes podem distribuir o cofre.</p>
      )}
    </div>
  );
}

function DistributePanel({ data, act }: { data: ClanData; act: Act }) {
  const [mode, setMode] = useState<"contribution" | "manual">("contribution");
  const decision = decideVault(data.me.role);

  // Por contribuição
  const [currency, setCurrency] = useState<"gold" | "cash">("gold");
  const [rankBy, setRankBy] = useState<"gold" | "cash">("cash");
  const [topCount, setTopCount] = useState(10);
  const [topAmount, setTopAmount] = useState(0);
  const [restAmount, setRestAmount] = useState(0);
  const contributionTotal = useMemo(() => {
    const n = data.members.length;
    const top = Math.min(topCount, n);
    return top * topAmount + (n - top) * restAmount;
  }, [data.members.length, topCount, topAmount, restAmount]);

  // Manual
  const [manual, setManual] = useState<Record<string, { gold: number; cash: number }>>({});
  const manualTotals = Object.values(manual).reduce((s, v) => ({ gold: s.gold + v.gold, cash: s.cash + v.cash }), { gold: 0, cash: 0 });
  const setManualValue = (userId: string, key: "gold" | "cash", value: number) =>
    setManual((prev) => ({ ...prev, [userId]: { ...(prev[userId] ?? { gold: 0, cash: 0 }), [key]: value } }));

  return (
    <Panel title="Distribuir o cofre" description="Divida o cofre entre os membros do jeito que o clã achar justo.">
      <div className="mb-4 flex w-fit gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
        {(
          [
            ["contribution", "Por contribuição"],
            ["manual", "Manual"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${mode === id ? "bg-zinc-700 text-white" : "text-zinc-400"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "contribution" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            act({ action: "distribute_contribution", currency, rankBy, topCount, topAmount, restAmount });
          }}
          className="flex flex-col gap-3 text-sm text-zinc-300"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              Pagar em
              <select value={currency} onChange={(e) => setCurrency(e.target.value as "gold" | "cash")} className={inputClass}>
                <option value="gold">Gold</option>
                <option value="cash">Crédito</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              Classificar pela contribuição em
              <select value={rankBy} onChange={(e) => setRankBy(e.target.value as "gold" | "cash")} className={inputClass}>
                <option value="cash">Crédito</option>
                <option value="gold">Gold</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              Quantos no topo
              <NumberInput value={topCount} onChange={(v) => setTopCount(Math.min(20, Math.max(1, v)))} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              Valor para cada um do topo
              <NumberInput value={topAmount} onChange={setTopAmount} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-400 sm:col-span-2">
              Valor para cada um dos demais membros
              <NumberInput value={restAmount} onChange={setRestAmount} />
            </label>
          </div>
          <p className="text-xs text-zinc-400">
            Total: <strong className="text-zinc-200">{contributionTotal}</strong> {currency === "gold" ? "gold" : "crédito"} (cofre
            tem {currency === "gold" ? data.clan.vaultGold : data.clan.vaultCash})
          </p>
          <DecisionHint decision={decision} />
          <button disabled={contributionTotal <= 0} className={`${primaryButton} self-start`}>
            {decision.kind === "request" ? "Pedir distribuição" : "Distribuir"}
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const payouts = Object.entries(manual)
              .map(([userId, v]) => ({ userId, ...v }))
              .filter((p) => p.gold > 0 || p.cash > 0);
            act({ action: "distribute_manual", payouts }).then((ok) => ok && setManual({}));
          }}
          className="flex flex-col gap-3"
        >
          <ul className="flex flex-col gap-2">
            {data.members.map((m) => (
              <li key={m.userId} className="grid grid-cols-[1fr_90px_90px] items-center gap-2">
                <PlayerName {...m.playerName} className="truncate text-sm text-zinc-200" />
                <NumberInput value={manual[m.userId]?.gold ?? 0} onChange={(v) => setManualValue(m.userId, "gold", v)} placeholder="gold" />
                <NumberInput value={manual[m.userId]?.cash ?? 0} onChange={(v) => setManualValue(m.userId, "cash", v)} placeholder="crédito" />
              </li>
            ))}
          </ul>
          <p className="text-xs text-zinc-400">
            Total: <Amounts {...manualTotals} />
          </p>
          <DecisionHint decision={decision} />
          <button disabled={manualTotals.gold + manualTotals.cash <= 0} className={`${primaryButton} self-start`}>
            {decision.kind === "request" ? "Pedir distribuição" : "Distribuir"}
          </button>
        </form>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// TORNEIOS
// ---------------------------------------------------------------------------

export function TournamentsTab({ data, act, canManage }: { data: ClanData; act: Act; canManage: boolean }) {
  const decision = decideVault(data.me.role);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [prizes, setPrizes] = useState<Prize[]>([
    { placement: 1, gold: 0, cash: 0 },
    { placement: 2, gold: 0, cash: 0 },
    { placement: 3, gold: 0, cash: 0 },
  ]);
  const totals = prizes.reduce((s, p) => ({ gold: s.gold + p.gold, cash: s.cash + p.cash }), { gold: 0, cash: 0 });

  return (
    <div className="flex flex-col gap-6">
      {canManage && (
        <Panel
          title="Organizar torneio do clã"
          description="A premiação sai do cofre e fica reservada. Se o torneio for cancelado, ela volta."
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await act({
                action: "tournament_create",
                name,
                description: description || undefined,
                startsAt: new Date(startsAt).toISOString(),
                prizes: prizes.filter((p) => p.gold > 0 || p.cash > 0),
              });
              if (ok) {
                setName("");
                setDescription("");
              }
            }}
            className="flex flex-col gap-3"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do torneio" maxLength={60} className={inputClass} />
              <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputClass} />
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Regras e formato (como vai ser o torneio)"
              rows={2}
              maxLength={300}
              className={inputClass}
            />
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-zinc-400">Premiação</p>
              {prizes.map((p, i) => (
                <div key={i} className="grid grid-cols-[50px_1fr_1fr_32px] items-center gap-2">
                  <span className="text-sm font-bold text-zinc-300">{p.placement}º</span>
                  <NumberInput
                    value={p.gold}
                    placeholder="gold"
                    onChange={(v) => setPrizes((prev) => prev.map((x, j) => (j === i ? { ...x, gold: v } : x)))}
                  />
                  <NumberInput
                    value={p.cash}
                    placeholder="crédito"
                    onChange={(v) => setPrizes((prev) => prev.map((x, j) => (j === i ? { ...x, cash: v } : x)))}
                  />
                  <button
                    type="button"
                    onClick={() => setPrizes((prev) => prev.filter((_, j) => j !== i).map((x, j) => ({ ...x, placement: j + 1 })))}
                    className="text-zinc-500 hover:text-red-400"
                    aria-label="Remover colocação"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setPrizes((prev) => [...prev, { placement: prev.length + 1, gold: 0, cash: 0 }])}
                className={`${secondaryButton} flex items-center gap-1 self-start`}
              >
                <Plus className="w-3.5 h-3.5" /> Colocação
              </button>
              <p className="text-xs text-zinc-400">
                Total reservado: <Amounts {...totals} />
              </p>
            </div>
            <DecisionHint decision={decision} />
            <button disabled={name.trim().length < 3 || !startsAt || totals.gold + totals.cash <= 0} className={`${primaryButton} self-start`}>
              {decision.kind === "request" ? "Pedir criação do torneio" : "Criar torneio"}
            </button>
          </form>
        </Panel>
      )}

      {data.tournaments.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhum torneio do clã ainda.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.tournaments.map((t) => (
            <TournamentCard key={t.id} tournament={t} data={data} act={act} canManage={canManage} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TournamentCard({
  tournament: t,
  data,
  act,
  canManage,
}: {
  tournament: ClanData["tournaments"][number];
  data: ClanData;
  act: Act;
  canManage: boolean;
}) {
  const [finishing, setFinishing] = useState(false);
  const [winners, setWinners] = useState<Record<number, string>>({});
  const decision = decideVault(data.me.role);
  const statusLabel = { open: "Aberto", finished: "Finalizado", cancelled: "Cancelado" }[t.status] ?? t.status;

  return (
    <li className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 font-bold text-zinc-100">
            <Trophy className="w-4 h-4 text-amber-400" />
            {t.name}
          </h3>
          <p className="text-xs text-zinc-500">
            {formatDate(new Date(t.startsAt), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · {statusLabel}
          </p>
        </div>
      </div>
      {t.description && <p className="mt-2 whitespace-pre-line text-sm text-zinc-300">{t.description}</p>}

      <ul className="mt-3 flex flex-col gap-1 text-sm">
        {t.prizes.map((p) => {
          const winner = t.results?.find((r) => r.placement === p.placement);
          return (
            <li key={p.placement} className="flex items-center gap-3">
              <span className="w-8 font-bold text-zinc-400">{p.placement}º</span>
              <Amounts gold={p.gold} cash={p.cash} />
              {winner && <span className="text-zinc-200">→ @{winner.name}</span>}
            </li>
          );
        })}
      </ul>

      {t.status === "open" && canManage && (
        <div className="mt-3 flex flex-col gap-2 border-t border-zinc-800 pt-3">
          {finishing ? (
            <>
              {t.prizes.map((p) => (
                <label key={p.placement} className="grid grid-cols-[50px_1fr] items-center gap-2 text-sm">
                  <span className="font-bold text-zinc-400">{p.placement}º</span>
                  <select
                    value={winners[p.placement] ?? ""}
                    onChange={(e) => setWinners((prev) => ({ ...prev, [p.placement]: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="">Sem vencedor (prêmio volta ao cofre)</option>
                    {data.members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        @{m.playerName.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <DecisionHint decision={decision} />
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    act({
                      action: "tournament_finalize",
                      tournamentId: t.id,
                      winners: Object.entries(winners)
                        .filter(([, userId]) => userId)
                        .map(([placement, userId]) => ({ placement: Number(placement), userId })),
                    }).then((ok) => ok && setFinishing(false))
                  }
                  className={primaryButton}
                >
                  Confirmar resultado e pagar
                </button>
                <button onClick={() => setFinishing(false)} className={secondaryButton}>
                  Voltar
                </button>
              </div>
            </>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setFinishing(true)} className={primaryButton}>
                Finalizar torneio
              </button>
              <button
                onClick={() => confirm("Cancelar o torneio e devolver a premiação ao cofre?") && act({ action: "tournament_cancel", tournamentId: t.id })}
                className={secondaryButton}
              >
                Cancelar torneio
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// PEDIDOS (aprovações com prazo de 2 dias)
// ---------------------------------------------------------------------------

const REQUEST_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Aguardando", className: "text-amber-300" },
  executing: { label: "Executando", className: "text-amber-300" },
  executed: { label: "Executado", className: "text-emerald-400" },
  rejected: { label: "Recusado", className: "text-red-400" },
  expired: { label: "Expirado", className: "text-zinc-500" },
  failed: { label: "Não foi possível executar", className: "text-red-400" },
};

function timeLeft(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "prazo encerrado";
  const hours = Math.floor(ms / 3_600_000);
  return hours >= 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h restantes` : `${hours}h ${Math.floor((ms % 3_600_000) / 60_000)}min restantes`;
}

export function RequestsTab({ data, act }: { data: ClanData; act: Act }) {
  const pending = data.requests.filter((r) => r.status === "pending");
  const history = data.requests.filter((r) => r.status !== "pending");

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs leading-relaxed text-zinc-400">
        Decisões do vice, dos sub-líderes e dos capitães que dependem de aprovação aparecem aqui. Pedidos do vice e dos capitães
        são executados sozinhos se ninguém responder em 2 dias. Pedidos dos sub-líderes precisam do &quot;sim&quot; do líder.
      </p>

      <Panel title={`Aguardando resposta (${pending.length})`}>
        {pending.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum pedido pendente.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pending.map((r) => (
              <li key={r.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                <p className="text-sm font-semibold text-zinc-200">{r.summary}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span>Pedido por @{r.requesterName}</span>
                  <span>· Para: {r.approverRoles.map(roleLabel).join(" ou ")}</span>
                  <span className="flex items-center gap-1 text-amber-300">
                    <Clock className="w-3 h-3" /> {timeLeft(r.expiresAt)}
                  </span>
                  <span>· {r.autoExecute ? "Sem resposta: executa" : "Sem resposta: expira"}</span>
                </p>
                {r.canDecide && (
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => act({ action: "decide_request", requestId: r.id, approve: true })} className={primaryButton}>
                      Aceitar
                    </button>
                    <button onClick={() => act({ action: "decide_request", requestId: r.id, approve: false })} className={secondaryButton}>
                      Recusar
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Histórico">
        {history.length === 0 ? (
          <p className="text-sm text-zinc-500">Nada por aqui ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map((r) => {
              const status = REQUEST_STATUS[r.status] ?? { label: r.status, className: "text-zinc-400" };
              return (
                <li key={r.id} className="border-b border-zinc-800/60 pb-2 text-xs last:border-b-0">
                  <p className="text-sm text-zinc-300">{r.summary}</p>
                  <p className="mt-0.5 text-zinc-500">
                    <span className={`font-semibold ${status.className}`}>{status.label}</span>
                    {r.status === "executed" && (r.decidedByName ? ` por @${r.decidedByName}` : " automaticamente (prazo de 2 dias)")}
                    {r.status === "rejected" && r.decidedByName && ` por @${r.decidedByName}`}
                    {r.status === "failed" && r.resultMessage && `: ${r.resultMessage}`}
                    {" · pedido por @"}
                    {r.requesterName} · {formatRelative(new Date(r.createdAt))}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CONVITES
// ---------------------------------------------------------------------------

export function InvitesTab({ data, act }: { data: ClanData; act: Act }) {
  const [username, setUsername] = useState("");
  const canInvite = canManageInvites(data.me.role);
  const requests = data.joinRequests.filter((j) => j.type === "request");
  const invites = data.joinRequests.filter((j) => j.type === "invite");

  if (!canInvite) {
    return <p className="text-sm text-zinc-500">Só o líder, o vice e os sub-líderes podem convidar e aceitar novos membros.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Enviar convite" description="Convide um jogador pelo nome de usuário.">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await act({ action: "invite", username })) setUsername("");
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <span className="absolute left-3 top-2 text-sm text-zinc-500">@</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="usuario" className={`${inputClass} pl-7`} />
          </div>
          <button disabled={!username.trim()} className={primaryButton}>
            Convidar
          </button>
        </form>
      </Panel>

      <Panel title={`Pedidos para entrar (${requests.length})`}>
        {requests.length === 0 ? (
          <p className="text-sm text-zinc-500">Ninguém pediu para entrar.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {requests.map((j) => (
              <li key={j.id} className="flex items-center gap-3">
                <Avatar {...j.avatar} size={32} />
                <PlayerName {...j.playerName} className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-200" />
                <button onClick={() => act({ action: "respond_join", joinRequestId: j.id, accept: true })} className={primaryButton}>
                  Aceitar
                </button>
                <button onClick={() => act({ action: "respond_join", joinRequestId: j.id, accept: false })} className={secondaryButton}>
                  Recusar
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={`Convites enviados (${invites.length})`}>
        {invites.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum convite pendente.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {invites.map((j) => (
              <li key={j.id} className="flex items-center gap-3">
                <Avatar {...j.avatar} size={32} />
                <span className="min-w-0 flex-1">
                  <PlayerName {...j.playerName} className="truncate text-sm font-semibold text-zinc-200" />
                  <span className="block text-xs text-zinc-500">{formatRelative(new Date(j.createdAt))}</span>
                </span>
                <button onClick={() => act({ action: "respond_join", joinRequestId: j.id, accept: false })} className={secondaryButton}>
                  Cancelar
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DOAÇÃO
// ---------------------------------------------------------------------------

export function DonationTab({ act }: { act: Act }) {
  const [donation, setDonation] = useState(0);
  const [giftTo, setGiftTo] = useState("");
  const [giftAmount, setGiftAmount] = useState(0);

  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-400">
        Use seus créditos para ajudar o clã ou presentear alguém. A compra de créditos com dinheiro real vai ficar aqui quando o
        pagamento estiver disponível.
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Doar para o cofre" description="Os créditos saem da sua carteira e contam como sua contribuição.">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (await act({ action: "donate", amount: donation })) setDonation(0);
            }}
            className="flex gap-2"
          >
            <NumberInput value={donation} onChange={setDonation} placeholder="créditos" />
            <button disabled={donation <= 0} className={primaryButton}>
              Doar
            </button>
          </form>
        </Panel>

        <Panel title="Mandar de presente" description="Envie créditos para qualquer jogador, do clã ou não.">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (await act({ action: "gift", username: giftTo, amount: giftAmount })) {
                setGiftTo("");
                setGiftAmount(0);
              }
            }}
            className="flex flex-col gap-2"
          >
            <div className="relative">
              <span className="absolute left-3 top-2 text-sm text-zinc-500">@</span>
              <input value={giftTo} onChange={(e) => setGiftTo(e.target.value)} placeholder="usuario" className={`${inputClass} pl-7`} />
            </div>
            <div className="flex gap-2">
              <NumberInput value={giftAmount} onChange={setGiftAmount} placeholder="créditos" />
              <button disabled={giftAmount <= 0 || !giftTo.trim()} className={primaryButton}>
                Enviar
              </button>
            </div>
          </form>
        </Panel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CONFIGURAÇÕES
// ---------------------------------------------------------------------------

export function SettingsTab({ data, act, canEdit }: { data: ClanData; act: Act; canEdit: boolean }) {
  const [name, setName] = useState(data.clan.name);
  const [description, setDescription] = useState(data.clan.description ?? "");
  const decision = decideSettings(data.me.role);
  const isLeader = data.me.role === "leader";

  return (
    <div className="flex flex-col gap-6">
      {canEdit ? (
        <Panel title="Dados do clã">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              act({
                action: "settings",
                ...(name !== data.clan.name ? { name } : {}),
                ...(description !== (data.clan.description ?? "") ? { description: description || null } : {}),
              });
            }}
            className="flex flex-col gap-3"
          >
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} className={inputClass} />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={300} className={inputClass} />
            <DecisionHint decision={decision} />
            <button
              disabled={name === data.clan.name && description === (data.clan.description ?? "")}
              className={`${primaryButton} self-start`}
            >
              {decision.kind === "request" ? "Pedir alteração" : "Salvar"}
            </button>
          </form>
        </Panel>
      ) : (
        <p className="text-sm text-zinc-500">Só o líder e o vice podem alterar os dados do clã.</p>
      )}

      <Panel title="Sair do clã">
        <p className="mb-3 text-xs text-zinc-400">
          {isLeader
            ? data.members.length > 1
              ? "Como líder, passe a liderança para outro membro (em Membros → Gerenciar) antes de sair."
              : "Você é o único membro: ao sair, o clã e o cofre deixam de existir."
            : "Você pode sair quando quiser."}
        </p>
        <button
          disabled={isLeader && data.members.length > 1}
          onClick={() => confirm("Tem certeza que quer sair do clã?") && act({ action: "leave" })}
          className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-40"
        >
          Sair do clã
        </button>
      </Panel>
    </div>
  );
}
