import { getPictureInPictureCapability } from "./capability";
import type { DocumentPictureInPictureWindowOptions, PictureInPictureControllerDependencies } from "./types";

const REQUEST_OPTIONS = {
  width: 420,
  height: 180,
  disallowReturnToOpener: true,
} as const satisfies DocumentPictureInPictureWindowOptions;

function assertNever(value: never): never {
  throw new Error(`Unexpected Picture-in-Picture capability: ${JSON.stringify(value)}`);
}

export class PictureInPictureController<TWindow> {
  private activeWindow: TWindow | null = null;
  private isOpening = false;

  constructor(private readonly dependencies: PictureInPictureControllerDependencies<TWindow>) {}

  isSupported(): boolean {
    const capability = getPictureInPictureCapability<TWindow>(this.dependencies.host, false);

    switch (capability.kind) {
      case "supported":
      case "already-open":
        return true;
      case "missing":
      case "malformed":
        return false;
      default:
        return assertNever(capability);
    }
  }

  isOpen(): boolean {
    return this.activeWindow !== null;
  }

  toggle(): void {
    if (this.activeWindow !== null) {
      this.closeActiveWindow();
      return;
    }

    if (this.isOpening) return;
    this.open();
  }

  private open(): void {
    const capability = getPictureInPictureCapability<TWindow>(this.dependencies.host, this.isOpening);

    switch (capability.kind) {
      case "supported":
        this.requestWindow(capability.api);
        return;
      case "missing":
      case "malformed":
      case "already-open":
        return;
      default:
        return assertNever(capability);
    }
  }

  private requestWindow(api: {
    requestWindow(options: DocumentPictureInPictureWindowOptions): Promise<TWindow>;
  }): void {
    this.isOpening = true;

    let request: Promise<TWindow>;
    try {
      // Keep this call directly in the dock click stack; user activation does not survive an await.
      request = api.requestWindow(REQUEST_OPTIONS);
    } catch (error) {
      this.isOpening = false;
      this.dependencies.reportFailure("Document Picture-in-Picture request failed", error);
      return;
    }

    void request.then(pipWindow => this.initialize(pipWindow)).catch(error => this.handleRequestFailure(error));
  }

  private handleRequestFailure(error: unknown): void {
    this.isOpening = false;
    this.dependencies.reportFailure("Document Picture-in-Picture request failed", error);
  }

  private initialize(pipWindow: TWindow): void {
    this.isOpening = false;
    this.activeWindow = pipWindow;
    this.dependencies.observePageHide(pipWindow, () => {
      if (this.activeWindow === pipWindow) this.reset();
    });

    try {
      this.dependencies.renderLoadingShell(pipWindow);
    } catch (error) {
      this.dependencies.reportFailure("Document Picture-in-Picture shell setup failed", error);
      this.closeWindowIfActive(pipWindow);
      return;
    }

    void this.injectStyles(pipWindow);
  }

  private async injectStyles(pipWindow: TWindow): Promise<void> {
    try {
      const stylesheet = await this.dependencies.loadStylesheet();
      if (this.activeWindow !== pipWindow) return;
      this.dependencies.injectStylesheet(pipWindow, stylesheet);
    } catch (error) {
      this.dependencies.reportFailure("Document Picture-in-Picture stylesheet injection failed", error);
      this.closeWindowIfActive(pipWindow);
    }
  }

  private closeActiveWindow(): void {
    const pipWindow = this.activeWindow;
    if (pipWindow === null) return;

    this.reset();
    this.dependencies.closeWindow(pipWindow);
  }

  private closeWindowIfActive(pipWindow: TWindow): void {
    if (this.activeWindow === pipWindow) this.closeActiveWindow();
  }

  private reset(): void {
    this.activeWindow = null;
    this.isOpening = false;
  }
}
