import { ShieldAlert } from "lucide-react";
import { ArtBanner } from "@/components/theme/ArtBanner";
import { GlassPanel } from "@/components/theme/PageBackdrop";
import { ART } from "@/lib/card-art";
import { getViewer } from "@/lib/admin-server";
import { getCardSalePercent } from "@/lib/site-settings";
import { AdminPanel } from "./AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const viewer = await getViewer();

  if (!viewer?.isAdmin) {
    return (
      <GlassPanel className="max-w-3xl">
        <div className="py-16 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-red-400" />
          <p className="mt-3 font-bold text-zinc-100">Área exclusiva do Admin</p>
          <p className="mt-1 text-sm text-zinc-400">Sua conta não tem permissão para ver esta página.</p>
        </div>
      </GlassPanel>
    );
  }

  const cardSalePercent = await getCardSalePercent();

  return (
    <GlassPanel className="max-w-5xl">
      {/* Time Wizard: quem controla o tempo (e as regras) do jogo */}
      <ArtBanner
        art={ART.timeWizard}
        eyebrow="Sala do Faraó"
        title="Painel do Admin"
        subtitle="Envie recompensas, aplique punições e ajuste as regras do jogo."
        tone="red"
        position="center 30%"
      />
      <AdminPanel salePercent={cardSalePercent} />
    </GlassPanel>
  );
}
