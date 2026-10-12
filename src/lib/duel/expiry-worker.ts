import { expireOldDuels } from "@/lib/duel/expiry";

const state = globalThis as typeof globalThis & {
  duelExpiryTimer?: ReturnType<typeof setInterval>;
};
export function startDuelExpiryWorker() {
  if (state.duelExpiryTimer) return;
  let running = false;
  const sweep = async () => {
    if (running) return;
    running = true;
    try {
      const count = await expireOldDuels();
      if (count)
        console.info(
          `[duel-expiry] ${count} duelo(s) cancelado(s) após 2 horas.`,
        );
    } catch (error) {
      console.error("[duel-expiry] Falha ao verificar duelos", error);
    } finally {
      running = false;
    }
  };
  state.duelExpiryTimer = setInterval(sweep, 60_000);
  state.duelExpiryTimer.unref();
  void sweep();
}
