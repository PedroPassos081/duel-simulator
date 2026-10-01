"use client";

import { useCallback, useEffect, useState } from "react";
import { Shield, Users } from "lucide-react";
import { GoldIcon, CreditIcon } from "@/components/theme/CurrencyIcons";
import { CLAN_MAX_MEMBERS, canManageInvites, decideSettings, decideVault, roleLabel } from "@/lib/clans/roles";
import { ArtBanner } from "@/components/theme/ArtBanner";
import { GlassPanel } from "@/components/theme/PageBackdrop";
import { ART, cardArt, clanArchetype } from "@/lib/card-art";
import type { Act, ClanData, NoClanData } from "./types";
import {
  DonationTab,
  InvitesTab,
  MembersTab,
  RequestsTab,
  SettingsTab,
  TournamentsTab,
  VaultTab,
} from "./sections";
import { Panel, inputClass, primaryButton } from "./ui";
import { ChatTab } from "./ChatTab";

type Tab = "chat" | "members" | "vault" | "tournaments" | "requests" | "invites" | "donation" | "settings";

export default function ClanPage() {
  const [data, setData] = useState<ClanData | NoClanData | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/clans");
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Executa uma ação, mostra o resultado e recarrega os dados
  const act: Act = useCallback(
    async (body) => {
      setFeedback(null);
      const res = await fetch("/api/clans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      setFeedback({ type: res.ok ? "success" : "error", text: res.ok ? json.message : json.error ?? "Erro." });
      await load();
      return res.ok;
    },
    [load]
  );

  if (!data) {
    return <GlassPanel className="max-w-5xl text-sm text-zinc-400">Carregando...</GlassPanel>;
  }

  return (
    <GlassPanel className="max-w-5xl">
      {feedback && (
        <div
          className={`mb-5 rounded-lg border px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          {feedback.text}
        </div>
      )}
      {data.clan ? <ClanView data={data} act={act} /> : <NoClanView data={data} act={act} />}
    </GlassPanel>
  );
}

function NoClanView({ data, act }: { data: NoClanData; act: Act }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const requestedClanIds = new Set(data.myRequests.map((r) => r.clan.id));

  return (
    <>
      <ArtBanner
        art={ART.gravekeeperChief}
        eyebrow="Coveiros · Invocados · Necrovale"
        title={
          <span className="flex items-center gap-2">
            <Shield className="h-7 w-7 text-amber-300" />
            Clã
          </span>
        }
        subtitle="Você ainda não está em um clã. Crie o seu, aceite um convite ou peça para entrar em um."
        tone="gold"
        position="center 30%"
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Criar um clã" description="Você será o líder. Até 20 membros por clã.">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (await act({ action: "create", name, description: description || undefined })) setName("");
            }}
            className="flex flex-col gap-3"
          >
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Nome do clã" className={inputClass} />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="Descrição (opcional)"
              className={inputClass}
            />
            <button disabled={name.trim().length < 3} className={`${primaryButton} self-start`}>
              Criar clã
            </button>
          </form>
        </Panel>

        <Panel title="Convites recebidos">
          {data.invites.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhum convite por enquanto.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.invites.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 px-3 py-2">
                  <span className="text-sm font-semibold text-zinc-200">
                    {inv.clan.name}
                    <span className="ml-2 text-xs font-normal text-zinc-500">{inv.clan._count.members}/{CLAN_MAX_MEMBERS}</span>
                  </span>
                  <span className="flex gap-2">
                    <button onClick={() => act({ action: "accept_invite", joinRequestId: inv.id })} className={primaryButton}>
                      Aceitar
                    </button>
                    <button
                      onClick={() => act({ action: "cancel_own_request", joinRequestId: inv.id })}
                      className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
                    >
                      Recusar
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-bold text-zinc-100">Clãs</h2>
        {data.clans.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum clã criado ainda. Seja o primeiro!</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.clans.map((clan) => {
              const full = clan._count.members >= CLAN_MAX_MEMBERS;
              const requested = requestedClanIds.has(clan.id);
              const myRequest = data.myRequests.find((r) => r.clan.id === clan.id);
              const archetype = clanArchetype(clan.id);
              return (
                <li key={clan.id} className="group relative flex flex-col gap-2 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-4 transition-colors hover:border-amber-500/50">
                  <img
                    src={cardArt(archetype.art)}
                    alt=""
                    aria-hidden
                    style={{ objectPosition: archetype.position }}
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40 transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-zinc-950/95 via-zinc-950/75 to-zinc-950/30" />
                  <p className="relative text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300/80">{archetype.name}</p>
                  <div className="relative flex items-center justify-between gap-2">
                    <h3 className="font-bold text-zinc-100">{clan.name}</h3>
                    <span className="flex items-center gap-1 text-xs text-zinc-300">
                      <Users className="w-3.5 h-3.5" />
                      {clan._count.members}/{CLAN_MAX_MEMBERS}
                    </span>
                  </div>
                  {clan.description && <p className="relative text-sm text-zinc-300">{clan.description}</p>}
                  {requested && myRequest ? (
                    <button
                      onClick={() => act({ action: "cancel_own_request", joinRequestId: myRequest.id })}
                      className="relative self-start rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
                    >
                      Pedido enviado · Cancelar
                    </button>
                  ) : (
                    <button
                      onClick={() => act({ action: "request_join", clanId: clan.id })}
                      disabled={full}
                      className={`${primaryButton} relative self-start`}
                    >
                      {full ? "Clã cheio" : "Pedir para entrar"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

function ClanView({ data, act }: { data: ClanData; act: Act }) {
  const [tab, setTab] = useState<Tab>("members");
  const role = data.me.role;
  const pendingForMe = data.requests.filter((r) => r.canDecide).length;
  const pendingJoins = data.joinRequests.filter((j) => j.type === "request").length;
  const archetype = clanArchetype(data.clan.id);

  const tabs: { id: Tab; label: string; badge?: number; show: boolean }[] = [
    { id: "members", label: "Membros", show: true },
    { id: "chat", label: "Chat", show: true },
    { id: "vault", label: "Cofre", show: true },
    { id: "tournaments", label: "Torneios", show: true },
    { id: "requests", label: "Pedidos", badge: pendingForMe, show: true },
    { id: "invites", label: "Convites", badge: canManageInvites(role) ? pendingJoins : 0, show: true },
    { id: "donation", label: "Doação", show: true },
    { id: "settings", label: "Configurações", show: true },
  ];

  return (
    <>
      <ArtBanner
        art={archetype.art}
        eyebrow={`${archetype.name} · ${archetype.tagline}`}
        title={
          <span className="flex items-center gap-2">
            <Shield className="h-7 w-7 shrink-0 text-amber-300" />
            <span className="truncate">{data.clan.name}</span>
          </span>
        }
        subtitle={
          <>
            {data.clan.description && <span className="block">{data.clan.description}</span>}
            <span className="text-xs text-zinc-400">
              {data.members.length}/{CLAN_MAX_MEMBERS} membros · Você é <strong className="text-zinc-200">{roleLabel(role)}</strong>
            </span>
          </>
        }
        tone={archetype.tone}
        position={archetype.position}
      >
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-black/50 px-4 py-2.5 backdrop-blur-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Cofre</span>
          <span className="flex items-center gap-1.5 font-bold text-amber-400">
            <GoldIcon className="w-4 h-4" />
            {data.clan.vaultGold}
          </span>
          <span className="flex items-center gap-1.5 font-bold text-purple-400">
            <CreditIcon className="w-4 h-4" />
            {data.clan.vaultCash}
          </span>
        </div>
      </ArtBanner>

      {/* ABAS */}
      <div className="mb-6 flex flex-wrap gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                tab === t.id ? "bg-amber-500 text-black" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
              }`}
            >
              {t.label}
              {Boolean(t.badge) && (
                <span className={`rounded-full px-1.5 text-[10px] ${tab === t.id ? "bg-black/20" : "bg-red-500 text-white"}`}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
      </div>

      {tab === "members" && <MembersTab data={data} act={act} />}
      {tab === "chat" && <ChatTab />}
      {tab === "vault" && <VaultTab data={data} act={act} canDistribute={decideVault(role).kind !== "forbidden"} />}
      {tab === "tournaments" && <TournamentsTab data={data} act={act} canManage={decideVault(role).kind !== "forbidden"} />}
      {tab === "requests" && <RequestsTab data={data} act={act} />}
      {tab === "invites" && <InvitesTab data={data} act={act} />}
      {tab === "donation" && <DonationTab act={act} />}
      {tab === "settings" && <SettingsTab data={data} act={act} canEdit={decideSettings(role).kind !== "forbidden"} />}
    </>
  );
}
