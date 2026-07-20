import { GENERAL_ERROR_LOG } from "@constants";
import { AppState } from "@core/appState";
import { t } from "@core/i18n";
import { getStorage } from "@core/storage";
import { log } from "@utils";
import { PictureInPictureController } from "./controller";
import { PictureInPictureLyricsView } from "./lyricsView";

const STYLESHEET_PATH = "css/blyrics/picture-in-picture.css";
const activeViews = new WeakMap<Window, PictureInPictureLyricsView>();
let hasInitializedAutoRestore = false;
let hasAttemptedAutoRestore = false;
let autoRestoreInteractionController: AbortController | null = null;

function renderLoadingShell(pipWindow: Window): void {
  AppState.isPictureInPictureOpen = true;
  if (!AppState.areLyricsLoaded || AppState.lastLoadedVideoId !== AppState.lastVideoId) {
    AppState.queueLyricInjection = true;
  }
  pipWindow.document.title = t("picture_in_picture_open");
  activeViews.set(pipWindow, new PictureInPictureLyricsView(pipWindow, document));
}

function injectStylesheet(pipWindow: Window, stylesheet: string): void {
  const style = pipWindow.document.createElement("style");
  style.textContent = stylesheet;
  pipWindow.document.head.appendChild(style);
  activeViews.get(pipWindow)?.refreshLayout();
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
  closeWindow: pipWindow => {
    AppState.isPictureInPictureOpen = false;
    pipWindow.close();
  },
  observePageHide: (pipWindow, listener) =>
    pipWindow.addEventListener(
      "pagehide",
      () => {
        AppState.isPictureInPictureOpen = false;
        listener();
      },
      { once: true }
    ),
  reportFailure,
});

function disarmAutoRestore(): void {
  autoRestoreInteractionController?.abort();
  autoRestoreInteractionController = null;
}

function armAutoRestore(): void {
  if (
    hasAttemptedAutoRestore ||
    autoRestoreInteractionController ||
    pictureInPictureController.isOpen() ||
    !pictureInPictureController.isSupported()
  ) {
    return;
  }

  const controller = new AbortController();
  autoRestoreInteractionController = controller;
  const attemptOpen = (event: Event): void => {
    if (!event.isTrusted || hasAttemptedAutoRestore) return;
    hasAttemptedAutoRestore = true;
    disarmAutoRestore();
    const target = event.target;
    if (target instanceof Element && target.closest("[data-blyrics-picture-in-picture-toggle]")) return;
    if (!pictureInPictureController.isOpen()) pictureInPictureController.toggle();
  };

  document.addEventListener("pointerdown", attemptOpen, { capture: true, signal: controller.signal });
  document.addEventListener("keydown", attemptOpen, { capture: true, signal: controller.signal });
}

export function initializePictureInPictureAutoRestore(): void {
  if (hasInitializedAutoRestore) return;
  hasInitializedAutoRestore = true;

  getStorage({ isPictureInPictureAutoRestoreEnabled: false }, items => {
    if (items.isPictureInPictureAutoRestoreEnabled) armAutoRestore();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync" || !changes.isPictureInPictureAutoRestoreEnabled || hasAttemptedAutoRestore) return;
    if (changes.isPictureInPictureAutoRestoreEnabled.newValue === true) {
      armAutoRestore();
    } else {
      disarmAutoRestore();
    }
  });
}
