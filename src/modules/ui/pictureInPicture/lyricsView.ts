import {
  BACKGROUND_LYRIC_CLASS,
  HAS_TRAILING_SPACE_CLASS,
  ROMANIZED_LYRICS_CLASS,
  TRANSLATED_LYRICS_CLASS,
} from "@constants";
import { AppState, type PlayerDetails } from "@core/appState";
import { t } from "@core/i18n";
import type { LineData, LyricsData, PartData } from "@modules/lyrics/injectLyrics";
import { getSongMetadata } from "@modules/lyrics/requestSniffer/requestSniffer";

interface SecondaryLyricContent {
  readonly romanization: string | null;
  readonly translation: string | null;
}

interface LyricsLineContent extends SecondaryLyricContent {
  readonly original: string;
  readonly parts: LyricPartContent[];
}

interface LyricPartContent {
  readonly text: string;
  readonly time: number;
  readonly duration: number;
  readonly hasTrailingSpace: boolean;
  readonly isBackground: boolean;
}

interface DisplayMetadata {
  readonly title: string;
  readonly byline: string;
  readonly videoId: string | null;
}

type PlayerControlAction = "previous" | "play-pause" | "next";
type PlayerControlIcon = Exclude<PlayerControlAction, "play-pause"> | "play" | "pause";

const PLAYER_TIME_EVENT = "blyrics-send-player-time";
const PLAYER_CONTROL_EVENT = "blyrics-player-control";
const ARTWORK_SIZE = 512;
const ACTIVE_LINE_HEIGHT_RATIO = 0.66;
const MIN_ACTIVE_LINE_FONT_SIZE = 10;
const FONT_FIT_ITERATIONS = 6;
const VISIBLE_METADATA_CHECK_INTERVAL = 250;
const PLAYER_CONTROLS_IDLE_DELAY = 2000;

const PLAYER_CONTROL_IDS: Record<PlayerControlAction, string> = {
  previous: "previous-button",
  "play-pause": "play-pause-button",
  next: "next-button",
};

const PLAYER_CONTROL_ICON_PATHS: Record<PlayerControlIcon, string> = {
  previous: "M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z",
  play: "M8 5v14l11-7z",
  pause: "M7 5h4v14H7V5zm6 0h4v14h-4V5z",
  next: "M16 6h2v12h-2V6zM6 18l8.5-6L6 6v12z",
};

function getLineContent(line: LineData): LyricsLineContent {
  const parts = line.parts.filter(isOriginalPart).map(part => ({
    text: part.lyricElement.textContent ?? "",
    time: part.time,
    duration: part.duration,
    hasTrailingSpace: part.lyricElement.classList.contains(HAS_TRAILING_SPACE_CLASS),
    isBackground: part.lyricElement.classList.contains(BACKGROUND_LYRIC_CLASS),
  }));
  const original = partsToText(parts);

  return {
    original: original || "♪",
    ...getSecondaryContent(line),
    parts,
  };
}

function getSecondaryContent(line: LineData): SecondaryLyricContent {
  const romanizationElement = line.lyricElement.querySelector(`.${ROMANIZED_LYRICS_CLASS}`);
  const translationElement = line.lyricElement.querySelector(`.${TRANSLATED_LYRICS_CLASS}`);
  return {
    romanization: romanizationElement?.textContent?.trim() || null,
    translation: translationElement?.textContent?.trim() || null,
  };
}

function partsToText(parts: readonly LyricPartContent[]): string {
  let text = "";
  let previousWasBackground: boolean | null = null;
  for (const part of parts) {
    if (previousWasBackground !== null && previousWasBackground !== part.isBackground) text += " ";
    text += part.text;
    if (part.hasTrailingSpace) text += " ";
    previousWasBackground = part.isBackground;
  }
  return text.replace(/\s+/g, " ").trim();
}

function isOriginalPart(part: PartData): boolean {
  return part.lyricElement.closest(`.${ROMANIZED_LYRICS_CLASS}`) === null;
}

function getArtworkUrl(url: string): string {
  if (/w\d+-h\d+/.test(url)) return url.replace(/w\d+-h\d+/, `w${ARTWORK_SIZE}-h${ARTWORK_SIZE}`);
  return url.replace(/\/(sd|hq|mq)?default\.jpg/, "/maxresdefault.jpg");
}

function getFallbackArtworkUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function getVisiblePlayerMetadata(sourceDocument: Document): DisplayMetadata {
  const playerBar = sourceDocument.querySelector("ytmusic-player-bar");
  const title = playerBar?.querySelector<HTMLElement>("yt-formatted-string.title, .title.ytmusic-player-bar");
  const byline = playerBar?.querySelector<HTMLElement>("yt-formatted-string.byline, .byline.ytmusic-player-bar");
  const bylineText = byline?.textContent?.trim() ?? "";
  const titleLink = title?.querySelector<HTMLAnchorElement>('a[href*="watch"]');
  let videoId: string | null = null;
  if (titleLink) {
    try {
      videoId = new URL(titleLink.href, sourceDocument.location.href).searchParams.get("v");
    } catch {
      videoId = null;
    }
  }

  return {
    title: title?.textContent?.trim() ?? "",
    byline: bylineText,
    videoId,
  };
}

function getSourcePlayerControl(sourceDocument: Document, action: PlayerControlAction): HTMLElement | null {
  return sourceDocument.querySelector<HTMLElement>(`ytmusic-player-bar #${PLAYER_CONTROL_IDS[action]}`);
}

function getSourceControlLabel(sourceDocument: Document, action: PlayerControlAction, fallback: string): string {
  const control = getSourcePlayerControl(sourceDocument, action);
  return (
    control?.getAttribute("aria-label") ?? control?.querySelector<HTMLElement>("[aria-label]")?.ariaLabel ?? fallback
  );
}

function createControlIcon(document: Document, icon: PlayerControlIcon): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("blyrics-pip-artwork__control-icon", `blyrics-pip-artwork__control-icon--${icon}`);
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", PLAYER_CONTROL_ICON_PATHS[icon]);
  svg.appendChild(path);
  return svg;
}

export class PictureInPictureLyricsView {
  private readonly shell: HTMLElement;
  private readonly artworkContainer: HTMLElement;
  private readonly artwork: HTMLImageElement;
  private readonly playPauseButton: HTMLButtonElement;
  private readonly title: HTMLElement;
  private readonly byline: HTMLElement;
  private readonly lyricsViewport: HTMLElement;
  private readonly lifecycleController = new AbortController();
  private readonly lyricsObserver: MutationObserver;
  private artworkController: AbortController | null = null;
  private currentVideoId: string | null = null;
  private currentLyrics: LyricsData | null = null;
  private lineElements: HTMLElement[] = [];
  private wordElements: HTMLElement[][] = [];
  private wordTimings: LyricPartContent[][] = [];
  private wordProgress: number[][] = [];
  private activeLineIndex = -1;
  private isLyricsLoadFinished = false;
  private lastVisibleMetadataCheck = 0;
  private lastPlayingState: boolean | null = null;
  private lyricsRefreshFrame: number | null = null;
  private layoutFrame: number | null = null;
  private pendingScrollBehavior: ScrollBehavior = "auto";
  private controlsIdleTimer: number | null = null;
  private lastPointerMoveTime = 0;
  private fallbackArtworkUrl = "";

  constructor(
    private readonly pipWindow: Window,
    private readonly sourceDocument: Document
  ) {
    const pipDocument = pipWindow.document;

    this.shell = pipDocument.createElement("main");
    this.shell.className = "blyrics-pip-shell";
    this.shell.setAttribute("aria-busy", "true");

    this.artworkContainer = pipDocument.createElement("div");
    this.artworkContainer.className = "blyrics-pip-artwork";

    const artworkPlaceholder = pipDocument.createElement("span");
    artworkPlaceholder.className = "blyrics-pip-artwork__placeholder";
    artworkPlaceholder.setAttribute("aria-hidden", "true");
    artworkPlaceholder.textContent = "♪";

    this.artwork = pipDocument.createElement("img");
    this.artwork.className = "blyrics-pip-artwork__image";
    this.artwork.alt = "";
    this.artwork.draggable = false;

    const artworkControls = pipDocument.createElement("div");
    artworkControls.className = "blyrics-pip-artwork__controls";
    const previousButton = this.createPlayerControlButton(
      "previous",
      getSourceControlLabel(sourceDocument, "previous", "Previous")
    );
    this.playPauseButton = this.createPlayerControlButton(
      "play-pause",
      getSourceControlLabel(sourceDocument, "play-pause", "Play")
    );
    const nextButton = this.createPlayerControlButton("next", getSourceControlLabel(sourceDocument, "next", "Next"));
    artworkControls.append(previousButton, this.playPauseButton, nextButton);
    this.artworkContainer.append(artworkPlaceholder, this.artwork, artworkControls);

    const content = pipDocument.createElement("section");
    content.className = "blyrics-pip-content";

    const header = pipDocument.createElement("header");
    header.className = "blyrics-pip-header";

    this.title = pipDocument.createElement("h1");
    this.title.className = "blyrics-pip-header__title";

    this.byline = pipDocument.createElement("p");
    this.byline.className = "blyrics-pip-header__artist";
    header.append(this.title, this.byline);

    this.lyricsViewport = pipDocument.createElement("div");
    this.lyricsViewport.className = "blyrics-pip-lyrics";
    this.lyricsViewport.setAttribute("aria-live", "polite");
    this.renderStatus(t("picture_in_picture_loading"), true);

    content.append(header, this.lyricsViewport);
    this.shell.append(this.artworkContainer, content);
    pipDocument.body.replaceChildren(this.shell);

    this.lyricsObserver = new MutationObserver(this.handleLyricsMutation);

    sourceDocument.addEventListener(PLAYER_TIME_EVENT, this.handlePlayerTime, {
      signal: this.lifecycleController.signal,
    });
    pipWindow.addEventListener("resize", this.handleResize, { signal: this.lifecycleController.signal });
    pipWindow.addEventListener("pointermove", this.handlePointerMove, {
      passive: true,
      signal: this.lifecycleController.signal,
    });
    pipWindow.addEventListener("pagehide", this.destroy, { once: true });
  }

  refreshLayout(): void {
    this.scheduleLayout("auto");
  }

  private scheduleLayout(behavior: ScrollBehavior): void {
    if (this.layoutFrame !== null) {
      if (behavior === "smooth") this.pendingScrollBehavior = behavior;
      return;
    }

    this.pendingScrollBehavior = behavior;
    this.layoutFrame = this.pipWindow.requestAnimationFrame(() => {
      this.layoutFrame = null;
      this.fitActiveLine();
      this.scrollToActiveLine(this.pendingScrollBehavior);
      this.pendingScrollBehavior = "auto";
    });
  }

  private readonly handlePlayerTime = (event: Event): void => {
    const detail = (event as CustomEvent<PlayerDetails>).detail;
    if (!detail) return;

    this.updatePlayPauseButton(detail.isPlaying);

    if (detail.videoId !== this.currentVideoId) {
      this.showSong(detail);
    }

    const now = Date.now();
    if (now - this.lastVisibleMetadataCheck >= VISIBLE_METADATA_CHECK_INTERVAL) {
      this.lastVisibleMetadataCheck = now;
      this.refreshVisibleMetadata(detail.videoId);
    }
    this.syncLyricsState(detail.videoId);

    this.updateActiveLine(detail);
  };

  private readonly handleResize = (): void => {
    this.refreshLayout();
  };

  private readonly handlePointerMove = (): void => {
    this.lastPointerMoveTime = this.pipWindow.performance.now();
    this.artworkContainer.removeAttribute("data-controls-idle");
    if (this.controlsIdleTimer === null) this.scheduleControlsIdleCheck();
  };

  private scheduleControlsIdleCheck(): void {
    const elapsed = this.pipWindow.performance.now() - this.lastPointerMoveTime;
    const remaining = Math.max(0, PLAYER_CONTROLS_IDLE_DELAY - elapsed);
    this.controlsIdleTimer = this.pipWindow.setTimeout(() => {
      this.controlsIdleTimer = null;
      if (this.pipWindow.performance.now() - this.lastPointerMoveTime < PLAYER_CONTROLS_IDLE_DELAY) {
        this.scheduleControlsIdleCheck();
        return;
      }
      this.artworkContainer.setAttribute("data-controls-idle", "true");
    }, remaining);
  }

  private readonly handleLyricsMutation = (): void => {
    if (this.lifecycleController.signal.aborted || this.lyricsRefreshFrame !== null) return;

    this.lyricsRefreshFrame = this.pipWindow.requestAnimationFrame(() => {
      this.lyricsRefreshFrame = null;
      if (this.currentVideoId) this.refreshLyrics(this.currentVideoId);
    });
  };

  private readonly destroy = (): void => {
    this.lifecycleController.abort();
    this.artworkController?.abort();
    this.lyricsObserver.disconnect();
    if (this.lyricsRefreshFrame !== null) this.pipWindow.cancelAnimationFrame(this.lyricsRefreshFrame);
    if (this.layoutFrame !== null) this.pipWindow.cancelAnimationFrame(this.layoutFrame);
    if (this.controlsIdleTimer !== null) this.pipWindow.clearTimeout(this.controlsIdleTimer);
  };

  private createPlayerControlButton(action: PlayerControlAction, label: string): HTMLButtonElement {
    const button = this.pipWindow.document.createElement("button");
    button.type = "button";
    button.tabIndex = -1;
    button.className = `blyrics-pip-artwork__control blyrics-pip-artwork__control--${action}`;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", () => this.activatePlayerControl(action));

    if (action === "play-pause") {
      button.append(
        createControlIcon(this.pipWindow.document, "play"),
        createControlIcon(this.pipWindow.document, "pause")
      );
    } else {
      button.appendChild(createControlIcon(this.pipWindow.document, action));
    }
    return button;
  }

  private activatePlayerControl(action: PlayerControlAction): void {
    const sourceControl = getSourcePlayerControl(this.sourceDocument, action);
    if (sourceControl) {
      sourceControl.click();
      return;
    }
    this.sourceDocument.dispatchEvent(new CustomEvent(PLAYER_CONTROL_EVENT, { detail: action }));
  }

  private updatePlayPauseButton(isPlaying: boolean): void {
    if (this.lastPlayingState === isPlaying) return;
    this.lastPlayingState = isPlaying;
    this.playPauseButton.toggleAttribute("data-playing", isPlaying);
    this.playPauseButton.setAttribute(
      "aria-label",
      getSourceControlLabel(this.sourceDocument, "play-pause", isPlaying ? "Pause" : "Play")
    );
  }

  private showSong(detail: PlayerDetails): void {
    this.lyricsObserver.disconnect();
    this.currentVideoId = detail.videoId;
    this.currentLyrics = null;
    this.lineElements = [];
    this.wordElements = [];
    this.wordTimings = [];
    this.wordProgress = [];
    this.activeLineIndex = -1;
    this.isLyricsLoadFinished = false;
    this.lastVisibleMetadataCheck = Date.now();
    this.title.textContent = detail.song;
    this.byline.textContent = detail.artist;
    this.renderStatus(t("picture_in_picture_loading"), true);
    this.loadArtwork(detail.videoId);
  }

  private refreshVisibleMetadata(videoId: string): void {
    const metadata = getVisiblePlayerMetadata(this.sourceDocument);
    if (this.currentVideoId !== videoId || (metadata.videoId && metadata.videoId !== videoId)) return;
    if (metadata.title && this.title.textContent !== metadata.title) this.title.textContent = metadata.title;
    if (metadata.byline && this.byline.textContent !== metadata.byline) this.byline.textContent = metadata.byline;
  }

  private loadArtwork(videoId: string): void {
    this.artworkController?.abort();
    const controller = new AbortController();
    this.artworkController = controller;
    this.fallbackArtworkUrl = getFallbackArtworkUrl(videoId);
    this.setArtwork(this.fallbackArtworkUrl);

    void getSongMetadata(videoId, 250, controller.signal).then(metadata => {
      if (controller.signal.aborted || this.currentVideoId !== videoId || !metadata) return;
      if (metadata.displayTitle) this.title.textContent = metadata.displayTitle;
      const displayByline = metadata.displayByline || metadata.artist;
      if (displayByline) this.byline.textContent = displayByline;
      if (metadata.thumbnail?.url) this.setArtwork(getArtworkUrl(metadata.thumbnail.url));
    });
  }

  private setArtwork(url: string): void {
    this.artwork.removeAttribute("data-loaded");
    this.artwork.onload = () => this.artwork.setAttribute("data-loaded", "true");
    this.artwork.onerror = () => {
      if (this.artwork.src !== this.fallbackArtworkUrl) {
        this.setArtwork(this.fallbackArtworkUrl);
      }
    };
    this.artwork.src = url;
  }

  private syncLyricsState(videoId: string): void {
    const lyrics = AppState.lastLoadedVideoId === videoId ? AppState.lyricData : null;
    const isFinished = AppState.lastLoadedVideoId === videoId && AppState.areLyricsLoaded;
    if (this.currentLyrics === lyrics && this.isLyricsLoadFinished === isFinished) return;

    this.isLyricsLoadFinished = isFinished;
    this.lyricsObserver.disconnect();
    if (lyrics) {
      this.lyricsObserver.observe(lyrics.lyricsContainer, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
    this.refreshLyrics(videoId);
  }

  private refreshLyrics(videoId: string): void {
    const lyrics = AppState.lastLoadedVideoId === videoId ? AppState.lyricData : null;
    if (!lyrics) {
      this.currentLyrics = null;
      this.lineElements = [];
      this.wordElements = [];
      this.wordTimings = [];
      this.wordProgress = [];
      this.activeLineIndex = -1;
      this.renderStatus(
        this.isLyricsLoadFinished ? t("lyrics_notFound") : t("picture_in_picture_loading"),
        !this.isLyricsLoadFinished
      );
      return;
    }

    if (this.currentLyrics === lyrics && this.lineElements.length === lyrics.lines.length) {
      if (this.updateSecondaryLyrics(lyrics)) this.refreshLayout();
      return;
    }

    const contents = lyrics.lines.map(getLineContent);
    this.currentLyrics = lyrics;
    this.activeLineIndex = -1;
    this.wordElements = [];
    this.wordTimings = contents.map(content => content.parts);
    this.wordProgress = contents.map(() => []);
    this.lineElements = contents.map((content, index) => this.createLyricLine(content, index));
    this.lyricsViewport.replaceChildren(...this.lineElements);
    this.shell.setAttribute("aria-busy", "false");
  }

  private createLyricLine(content: LyricsLineContent, lineIndex: number): HTMLElement {
    const line = this.pipWindow.document.createElement("div");
    line.className = "blyrics-pip-lyrics__line";
    line.dir = "auto";

    const original = this.pipWindow.document.createElement("span");
    original.className = "blyrics-pip-lyrics__original";
    const words = (this.currentLyrics?.syncType === "richsync" ? content.parts : []).map(part => {
      const word = this.pipWindow.document.createElement("span");
      word.className = "blyrics-pip-lyrics__word";
      word.classList.toggle("blyrics-pip-lyrics__word--trailing-space", part.hasTrailingSpace);
      word.textContent = part.text;
      return word;
    });
    this.wordElements[lineIndex] = words;
    this.wordProgress[lineIndex] = words.map(() => 0);
    if (words.length > 0) {
      original.append(...words);
    } else {
      original.textContent = content.original;
    }
    line.appendChild(original);

    this.setSecondaryText(line, "romanization", content.romanization);
    this.setSecondaryText(line, "translation", content.translation);

    return line;
  }

  private updateSecondaryLyrics(lyrics: LyricsData): boolean {
    let hasChanged = false;
    for (let index = 0; index < lyrics.lines.length; index++) {
      const line = this.lineElements[index];
      if (!line) continue;
      const content = getSecondaryContent(lyrics.lines[index]);
      hasChanged = this.setSecondaryText(line, "romanization", content.romanization) || hasChanged;
      hasChanged = this.setSecondaryText(line, "translation", content.translation) || hasChanged;
    }
    return hasChanged;
  }

  private setSecondaryText(line: HTMLElement, kind: "romanization" | "translation", text: string | null): boolean {
    const className = `blyrics-pip-lyrics__secondary--${kind}`;
    const existing = line.querySelector<HTMLElement>(`.${className}`);
    if (!text) {
      if (!existing) return false;
      existing.remove();
      return true;
    }
    if (existing) {
      if (existing.textContent === text) return false;
      existing.textContent = text;
      return true;
    }

    const secondary = this.pipWindow.document.createElement("span");
    secondary.className = `blyrics-pip-lyrics__secondary ${className}`;
    secondary.textContent = text;
    if (kind === "romanization") {
      line.insertBefore(secondary, line.querySelector(".blyrics-pip-lyrics__secondary--translation"));
    } else {
      line.appendChild(secondary);
    }
    return true;
  }

  private renderStatus(message: string, isLoading: boolean): void {
    const status = this.pipWindow.document.createElement("p");
    status.className = "blyrics-pip-lyrics__status";
    status.setAttribute("role", "status");
    status.textContent = message;
    this.lyricsViewport.replaceChildren(status);
    this.shell.setAttribute("aria-busy", String(isLoading));
  }

  private updateActiveLine(detail: PlayerDetails): void {
    const lyrics = this.currentLyrics;
    if (!lyrics || this.lineElements.length === 0) return;

    let nextIndex = 0;
    let lyricTime = detail.currentTime;
    if (lyrics.syncType === "none") {
      const duration = Number(detail.duration);
      const progress = duration > 0 ? Math.min(1, Math.max(0, detail.currentTime / duration)) : 0;
      nextIndex = Math.min(lyrics.lines.length - 1, Math.floor(progress * lyrics.lines.length));
    } else {
      lyricTime -= AppState.globalLyricOffset + AppState.lyricOffset;
      lyricTime -= lyrics.syncType === "richsync" ? AppState.richsyncOffsetTrim : AppState.lineOffsetTrim;
      const matchedIndex = lyrics.lines.findLastIndex(line => line.time <= lyricTime);
      nextIndex = Math.max(0, matchedIndex);
    }

    if (nextIndex !== this.activeLineIndex) {
      const isInitialPosition = this.activeLineIndex === -1;
      this.lineElements[this.activeLineIndex]?.style.removeProperty("font-size");
      this.activeLineIndex = nextIndex;
      this.lineElements.forEach((line, index) => {
        line.classList.toggle("blyrics-pip-lyrics__line--active", index === nextIndex);
        line.classList.toggle("blyrics-pip-lyrics__line--past", index < nextIndex);
      });
      this.scheduleLayout(isInitialPosition ? "auto" : "smooth");
    }

    if (lyrics.syncType === "richsync") this.updateWordAnimation(lyricTime);
  }

  private fitActiveLine(): void {
    const activeLine = this.lineElements[this.activeLineIndex];
    if (!activeLine || this.lyricsViewport.clientHeight <= 0) return;

    activeLine.style.removeProperty("font-size");
    const defaultFontSize = Number.parseFloat(this.pipWindow.getComputedStyle(activeLine).fontSize);
    if (!Number.isFinite(defaultFontSize) || defaultFontSize <= MIN_ACTIVE_LINE_FONT_SIZE) return;

    const maximumHeight = this.lyricsViewport.clientHeight * ACTIVE_LINE_HEIGHT_RATIO;
    if (activeLine.scrollHeight <= maximumHeight) return;

    let smallest = MIN_ACTIVE_LINE_FONT_SIZE;
    let largest = defaultFontSize;
    activeLine.style.fontSize = `${smallest}px`;
    if (activeLine.scrollHeight > maximumHeight) return;

    for (let iteration = 0; iteration < FONT_FIT_ITERATIONS; iteration++) {
      const candidate = (smallest + largest) / 2;
      activeLine.style.fontSize = `${candidate}px`;
      if (activeLine.scrollHeight <= maximumHeight) {
        smallest = candidate;
      } else {
        largest = candidate;
      }
    }

    activeLine.style.fontSize = `${smallest.toFixed(2)}px`;
  }

  private updateWordAnimation(lyricTime: number): void {
    const words = this.wordElements[this.activeLineIndex] ?? [];
    const timings = this.wordTimings[this.activeLineIndex] ?? [];
    const cachedProgress = this.wordProgress[this.activeLineIndex] ?? [];
    for (let index = 0; index < words.length; index++) {
      const timing = timings[index];
      const progress =
        timing.duration > 0
          ? Math.min(1, Math.max(0, (lyricTime - timing.time) / timing.duration))
          : Number(lyricTime >= timing.time);
      if (cachedProgress[index] === progress) continue;
      cachedProgress[index] = progress;
      const word = words[index];
      word.style.setProperty("--blyrics-pip-word-progress", String(progress));
    }
  }

  private scrollToActiveLine(behavior: ScrollBehavior): void {
    const activeLine = this.lineElements[this.activeLineIndex];
    if (!activeLine) return;

    const top = activeLine.offsetTop - this.lyricsViewport.clientHeight * 0.45 + activeLine.offsetHeight / 2;
    this.lyricsViewport.scrollTo({ top: Math.max(0, top), behavior });
  }
}
