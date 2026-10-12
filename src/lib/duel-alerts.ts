"use client";

// Alertas do duelo no navegador (celular e PC): apito, vibração e notificação
// do sistema. O som é gerado na hora (Web Audio), sem arquivo de áudio.
//
// Limites do navegador: o som só toca depois de um toque/clique na página
// (por isso unlockAlerts() é chamada ao entrar na fila). Com a tela em outro
// aplicativo, o aviso chega pela notificação do sistema (se permitida).

const TURN_ALERT_KEY = "duel-turn-alert";

let audio: AudioContext | null = null;

function context() {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  audio ??= new Ctx();
  return audio;
}

/** Libera o som (precisa de um toque do jogador) e registra o service worker das notificações. */
export function unlockAlerts() {
  const ctx = context();
  if (ctx?.state === "suspended") ctx.resume().catch(() => {});
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
}

/** Pede permissão para avisar com notificação quando a tela está em outro app. */
export async function askNotificationPermission() {
  if (typeof Notification === "undefined" || Notification.permission !== "default") return;
  await Notification.requestPermission().catch(() => {});
}

function tone(ctx: AudioContext, freq: number, start: number, duration: number, volume = 0.25) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration + 0.05);
}

async function notify(title: string, body: string, url?: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted" || !document.hidden) return;
  try {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) await reg.showNotification(title, { body, icon: "/icon.png", tag: "duel-alert", data: { url: url ?? location.href } });
    else new Notification(title, { body, icon: "/icon.png", tag: "duel-alert" });
  } catch {
    // sem notificação: o som e a vibração ainda avisam
  }
}

/** Duelo encontrado: três toques subindo, vibração e notificação. */
export function alertMatchFound(url?: string) {
  const ctx = context();
  if (ctx) {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    [523, 659, 784, 1047].forEach((f, i) => tone(ctx, f, i * 0.16, 0.22));
  }
  navigator.vibrate?.([200, 100, 200, 100, 400]);
  void notify("Duelo encontrado!", "Seu adversário chegou. Volte para o Master Duelist e duele!", url);
}

/** Começou o seu turno: dois toques curtos (se o jogador não desligou). */
export function alertYourTurn() {
  if (!isTurnAlertOn()) return;
  const ctx = context();
  if (ctx) {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    tone(ctx, 880, 0, 0.14, 0.2);
    tone(ctx, 1175, 0.16, 0.18, 0.2);
  }
  navigator.vibrate?.([120, 80, 120]);
  void notify("Seu turno!", "É a sua vez no duelo.");
}

export function isTurnAlertOn() {
  try {
    return localStorage.getItem(TURN_ALERT_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setTurnAlert(on: boolean) {
  try {
    localStorage.setItem(TURN_ALERT_KEY, on ? "on" : "off");
  } catch {
    // sem armazenamento: vale só nesta tela
  }
}

/** Mantém a tela acesa enquanto espera na fila (quando o aparelho permite). */
export async function keepScreenOn() {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } };
    return (await nav.wakeLock?.request("screen")) ?? null;
  } catch {
    return null;
  }
}
