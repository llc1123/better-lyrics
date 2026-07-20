import { GENERAL_ERROR_LOG } from "@constants";
import { t } from "@core/i18n";
import { log } from "@utils";
import { PictureInPictureController } from "./controller";

const STYLESHEET_PATH = "css/blyrics/picture-in-picture.css";

function renderLoadingShell(pipWindow: Window): void {
  const shell = pipWindow.document.createElement("main");
  shell.className = "blyrics-pip-shell";
  shell.setAttribute("aria-busy", "true");

  const status = pipWindow.document.createElement("p");
  status.className = "blyrics-pip-shell__status";
  status.setAttribute("role", "status");
  status.textContent = t("picture_in_picture_loading");

  shell.appendChild(status);
  pipWindow.document.body.replaceChildren(shell);
}

function injectStylesheet(pipWindow: Window, stylesheet: string): void {
  const style = pipWindow.document.createElement("style");
  style.textContent = stylesheet;
  pipWindow.document.head.appendChild(style);
}

async function loadStylesheet(): Promise<string> {
  const response = await fetch(chrome.runtime.getURL(STYLESHEET_PATH));
  if (!response.ok) throw new Error(`Document Picture-in-Picture stylesheet failed to load: ${response.status}`);
  return response.text();
}

function reportFailure(message: string, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);
  log(GENERAL_ERROR_LOG, `${message}: ${detail}`);
}

export const pictureInPictureController = new PictureInPictureController<Window>({
  host: window,
  loadStylesheet,
  renderLoadingShell,
  injectStylesheet,
  closeWindow: pipWindow => pipWindow.close(),
  observePageHide: (pipWindow, listener) => pipWindow.addEventListener("pagehide", listener, { once: true }),
  reportFailure,
});
