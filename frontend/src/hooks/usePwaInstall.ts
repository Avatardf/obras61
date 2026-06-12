/**
 * usePwaInstall — instalação do PWA via prompt nativo (Android/Chrome).
 *
 * O Chrome dispara `beforeinstallprompt` quando o app é instalável
 * (manifest válido + HTTPS) e ainda não está instalado. Guardamos o
 * evento e expomos `instalar()` para disparar o diálogo nativo.
 *
 * No iOS o evento não existe — a instalação é manual (Compartilhar →
 * Adicionar à Tela de Início), então `disponivel` fica false.
 */
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function usePwaInstall() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [instalado, setInstalado] = useState(
    () => window.matchMedia("(display-mode: standalone)").matches
  );

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault(); // impede o mini-infobar automático do Chrome
      setPromptEvent(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setPromptEvent(null);
      setInstalado(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function instalar() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") setPromptEvent(null);
  }

  return { disponivel: !!promptEvent && !instalado, instalado, instalar };
}
