"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Layers, Lock, Palette, Upload, UserRound } from "lucide-react";
import { CollectionTab } from "./CollectionTab";
import { Avatar } from "@/components/Avatar";
import { PlayerName } from "@/components/PlayerName";
import { CosmeticArtImage, PlaymatView, SleeveView } from "@/components/cosmetics/CosmeticArt";
import { GlassPanel } from "@/components/theme/PageBackdrop";
import { COSMETIC_TYPES, RARITY_LABELS, SOURCE_LABELS } from "@/lib/cosmetic-types";

interface Cosmetic {
  id: string;
  type: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  effect: string | null;
  rarity: string;
  source: string;
}

interface Account {
  name: string | null;
  username: string | null;
  email: string;
  image: string | null;
  hasPassword: boolean;
  cosmetics: Cosmetic[];
  equipped: Record<string, string>;
}

type Tab = "profile" | "collection" | "customize";
type Feedback = { type: "success" | "error"; text: string } | null;

const AVATAR_SIZE = 256;

/** Recorta a imagem no centro e reduz para 256x256, para não pesar no banco. */
function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = AVATAR_SIZE;
      canvas.height = AVATAR_SIZE;
      canvas
        .getContext("2d")!
        .drawImage(
          img,
          (img.width - side) / 2,
          (img.height - side) / 2,
          side,
          side,
          0,
          0,
          AVATAR_SIZE,
          AVATAR_SIZE
        );
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/webp", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem."));
    };
    img.src = url;
  });
}

function FeedbackMessage({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return (
    <p className={`text-xs font-medium ${feedback.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
      {feedback.text}
    </p>
  );
}

const inputClass =
  "w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 transition-colors";
const primaryButtonClass =
  "rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-600 transition-colors";

export default function AccountPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [tab, setTab] = useState<Tab>("profile");

  async function loadAccount() {
    const res = await fetch("/api/account");
    if (res.ok) setAccount(await res.json());
  }

  useEffect(() => {
    loadAccount();
  }, []);

  if (!account) {
    return <GlassPanel className="max-w-4xl text-sm text-zinc-400">Carregando...</GlassPanel>;
  }

  const frameUrl = account.cosmetics.find((c) => c.id === account.equipped.frame)?.imageUrl;
  const nameEffect = account.cosmetics.find((c) => c.id === account.equipped.name_style)?.effect;

  return (
    <GlassPanel className="max-w-4xl">
      {/* CABEÇALHO */}
      <div className="flex items-center gap-4 mb-6 border-b border-zinc-800 pb-5">
        <Avatar image={account.image} name={account.username ?? account.name} size={64} frameUrl={frameUrl} />
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">Minha conta</h1>
          <p className="text-sm text-zinc-400 mt-1 truncate">
            <PlayerName name={account.username ?? account.name} effect={nameEffect} className="text-base font-semibold text-zinc-200" />{" "}
            · {account.email}
          </p>
        </div>
        {account.username && (
          <Link
            href={`/perfil/${account.username}`}
            className="ml-auto shrink-0 rounded-lg border border-amber-500/40 px-3 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/10"
          >
            Ver meu perfil
          </Link>
        )}
      </div>

      {/* ABAS */}
      <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-lg border border-zinc-800 w-fit mb-6">
        {(
          [
            { id: "profile", label: "Perfil", icon: UserRound },
            { id: "collection", label: "Maleta", icon: Layers },
            { id: "customize", label: "Personalizar", icon: Palette },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              tab === id ? "bg-amber-500 text-black shadow-sm" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === "profile" ? (
        <div className="flex flex-col gap-6">
          <AvatarSection account={account} frameUrl={frameUrl} onSaved={loadAccount} />
          <FramePicker account={account} onSaved={loadAccount} />
          <UsernameSection account={account} onSaved={loadAccount} />
          <PasswordSection hasPassword={account.hasPassword} onSaved={loadAccount} />
        </div>
      ) : tab === "collection" ? (
        <CollectionTab />
      ) : (
        <CustomizeSection account={account} onSaved={loadAccount} />
      )}
    </GlassPanel>
  );
}

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="bg-zinc-900/60 p-5 rounded-xl border border-zinc-800">
      <h2 className="text-base font-bold text-zinc-100">{title}</h2>
      {description && <p className="text-xs text-zinc-400 mt-1">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Troca rápida de moldura, ao lado da foto. As molduras vêm de Structure Decks, prêmios e eventos. */
function FramePicker({ account, onSaved }: { account: Account; onSaved: () => void }) {
  const [saving, setSaving] = useState<string | null>(null);
  const frames = account.cosmetics.filter((c) => c.type === "frame");
  const equippedId = account.equipped.frame ?? null;

  async function equip(cosmeticId: string | null) {
    setSaving(cosmeticId ?? "none");
    const res = await fetch("/api/account/cosmetics", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "frame", cosmeticId }),
    });
    setSaving(null);
    if (res.ok) onSaved();
  }

  return (
    <Panel title="Moldura" description="Fica em volta da sua foto no duelo, no pódio e no jornal.">
      <div className="flex flex-wrap gap-4">
        {[{ id: null as string | null, name: "Sem moldura", imageUrl: null as string | null }, ...frames].map((f) => {
          const selected = equippedId === f.id;
          return (
            <button
              key={f.id ?? "none"}
              onClick={() => equip(f.id)}
              disabled={selected || saving !== null}
              title={f.name}
              className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-[11px] font-semibold transition-all ${
                selected ? "border-amber-500 bg-amber-500/10 text-amber-300" : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:border-amber-500/50"
              }`}
            >
              <Avatar image={account.image} name={account.username ?? account.name} size={56} frameUrl={f.imageUrl} />
              <span className="max-w-[88px] truncate">{f.name}</span>
            </button>
          );
        })}
      </div>
      {frames.length === 0 && <p className="mt-3 text-xs text-zinc-500">Você ainda não possui nenhuma moldura. Elas acompanham Structure Decks Premium e prêmios de evento.</p>}
    </Panel>
  );
}

function AvatarSection({ account, frameUrl, onSaved }: { account: Account; frameUrl?: string | null; onSaved: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function saveImage(image: string | null) {
    setSaving(true);
    setFeedback(null);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setFeedback({ type: "success", text: image ? "Foto atualizada!" : "Foto removida." });
      onSaved();
    } else {
      setFeedback({ type: "error", text: data.error ?? "Erro ao salvar a foto." });
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFeedback({ type: "error", text: "Escolha um arquivo de imagem." });
      return;
    }
    try {
      await saveImage(await resizeImage(file));
    } catch (err) {
      setFeedback({ type: "error", text: (err as Error).message });
    }
  }

  return (
    <Panel title="Foto de perfil" description="Qualquer imagem: ela é recortada em quadrado automaticamente.">
      <div className="flex items-center gap-5">
        <Avatar image={account.image} name={account.username ?? account.name} size={88} frameUrl={frameUrl} />
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => inputRef.current?.click()} disabled={saving} className={`${primaryButtonClass} flex items-center gap-1.5`}>
              <Upload className="w-4 h-4" />
              {saving ? "Salvando..." : "Trocar foto"}
            </button>
            {account.image && (
              <button
                onClick={() => saveImage(null)}
                disabled={saving}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                Remover
              </button>
            )}
          </div>
          <FeedbackMessage feedback={feedback} />
        </div>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleFile} />
      </div>
    </Panel>
  );
}

function UsernameSection({ account, onSaved }: { account: Account; onSaved: () => void }) {
  const [username, setUsername] = useState(account.username ?? "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const unchanged = username.trim().toLowerCase() === (account.username ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setUsername(data.username);
      setFeedback({ type: "success", text: "Nome de usuário atualizado!" });
      onSaved();
    } else {
      setFeedback({ type: "error", text: data.error ?? "Erro ao salvar." });
    }
  }

  return (
    <Panel title="Nome de usuário" description="Letras minúsculas, números e sublinhado (3 a 24 caracteres). Também serve para fazer login.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-2 text-sm text-zinc-500">@</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={24}
              className={`${inputClass} pl-8`}
              placeholder="seu_usuario"
            />
          </div>
          <button type="submit" disabled={saving || unchanged || username.trim().length < 3} className={primaryButtonClass}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
        <FeedbackMessage feedback={feedback} />
      </form>
    </Panel>
  );
}

function PasswordSection({ hasPassword, onSaved }: { hasPassword: boolean; onSaved: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setFeedback({ type: "error", text: "A confirmação não confere com a nova senha." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFeedback({ type: "success", text: "Senha alterada com sucesso!" });
      onSaved();
    } else {
      setFeedback({ type: "error", text: data.error ?? "Erro ao alterar a senha." });
    }
  }

  return (
    <Panel
      title={hasPassword ? "Alterar senha" : "Definir senha"}
      description={
        hasPassword
          ? "Mínimo de 8 caracteres, com letras e números."
          : "Sua conta usa login com Google. Defina uma senha para também entrar com e-mail."
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-sm">
        {hasPassword && (
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Senha atual"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={inputClass}
          />
        )}
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Nova senha"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClass}
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Confirmar nova senha"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClass}
        />
        <button
          type="submit"
          disabled={saving || !newPassword || (hasPassword && !currentPassword)}
          className={`${primaryButtonClass} self-start`}
        >
          {saving ? "Salvando..." : hasPassword ? "Alterar senha" : "Definir senha"}
        </button>
        <FeedbackMessage feedback={feedback} />
      </form>
    </Panel>
  );
}

function CustomizeSection({ account, onSaved }: { account: Account; onSaved: () => void }) {
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function equip(type: string, cosmeticId: string | null) {
    setSavingKey(`${type}-${cosmeticId}`);
    setFeedback(null);
    const res = await fetch("/api/account/cosmetics", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, cosmeticId }),
    });
    const data = await res.json();
    setSavingKey(null);
    if (res.ok) {
      onSaved();
    } else {
      setFeedback({ type: "error", text: data.error ?? "Erro ao equipar." });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-2 text-xs text-purple-200 bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 leading-relaxed">
        <Lock className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
        <span>
          Itens de personalização não podem ser escolhidos livremente: você os ganha em eventos, como prêmios ou
          comprando na loja. Aqui aparecem apenas os itens que você possui.
        </span>
      </div>
      <FeedbackMessage feedback={feedback} />

      {COSMETIC_TYPES.map(({ type, label, description }) => {
        const owned = account.cosmetics.filter((c) => c.type === type);
        const equippedId = account.equipped[type] ?? null;
        // Estilos de nick não têm imagem: a prévia é o seu próprio nick com o efeito
        // Sleeve, playmat e moldura mostram o item como ele aparece no jogo
        const nickPreview = (c: { imageUrl?: string | null; effect: string | null } | null) => {
          if (type === "name_style") {
            return <PlayerName name={account.username ?? account.name} effect={c?.effect ?? null} className="px-2 text-base font-bold text-zinc-200 truncate" />;
          }
          if (type === "sleeve") {
            return <SleeveView url={c?.imageUrl ?? "/assets/master-duelist-card-back.svg"} className="h-full" />;
          }
          if (type === "playmat") {
            return <PlaymatView url={c?.imageUrl} theme={c?.effect} className="h-full w-full rounded-none border-0" />;
          }
          if (type === "frame") {
            return <Avatar image={account.image} name={account.username ?? account.name} size={56} frameUrl={c?.imageUrl} />;
          }
          return undefined;
        };

        return (
          <Panel key={type} title={label} description={description}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {/* Opção padrão, sempre disponível */}
              <CosmeticOption
                name="Padrão"
                subtitle="Visual original"
                preview={nickPreview(null)}
                selected={equippedId === null}
                loading={savingKey === `${type}-null`}
                onSelect={() => equip(type, null)}
              />
              {owned.map((c) => (
                <CosmeticOption
                  key={c.id}
                  name={c.name}
                  subtitle={`${RARITY_LABELS[c.rarity] ?? c.rarity} · ${SOURCE_LABELS[c.source] ?? c.source}`}
                  imageUrl={c.imageUrl}
                  preview={nickPreview(c)}
                  selected={equippedId === c.id}
                  loading={savingKey === `${type}-${c.id}`}
                  onSelect={() => equip(type, c.id)}
                />
              ))}
            </div>
            {owned.length === 0 && (
              <p className="text-xs text-zinc-500 mt-3">Você ainda não possui nenhum item deste tipo.</p>
            )}
          </Panel>
        );
      })}
    </div>
  );
}

function CosmeticOption({
  name,
  subtitle,
  imageUrl,
  preview,
  selected,
  loading,
  onSelect,
}: {
  name: string;
  subtitle: string;
  imageUrl?: string | null;
  preview?: React.ReactNode;
  selected: boolean;
  loading: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      disabled={selected || loading}
      className={`relative flex flex-col gap-2 rounded-xl border p-2.5 text-left transition-all ${
        selected ? "border-amber-500 bg-amber-500/10" : "border-zinc-800 bg-zinc-950/40 hover:border-amber-500/50"
      }`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-zinc-800/60 flex items-center justify-center">
        {preview ? (
          preview
        ) : imageUrl ? (
          <CosmeticArtImage url={imageUrl} position="center" />
        ) : (
          <Palette className="w-6 h-6 text-zinc-600" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-zinc-200 truncate">{name}</p>
        <p className="text-[11px] text-zinc-500 truncate">{loading ? "Equipando..." : subtitle}</p>
      </div>
      {selected && (
        <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500">
          <Check className="w-3.5 h-3.5 text-black" />
        </span>
      )}
    </button>
  );
}
