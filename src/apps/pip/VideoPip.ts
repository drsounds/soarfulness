// Fallback for browsers without Document Picture-in-Picture (Safari, Firefox,
// Chrome on Android outside the app): the 3D canvas is streamed into a
// hidden <video>, and that video goes into ordinary video Picture-in-Picture.
// Only the WebGL canvas is captured (no flat backdrop photo or DOM overlays),
// and once the page is hidden the browser may slow the stream down.

type CaptureCanvas = HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream };

export function videoPipAvailable(): boolean {
  if (typeof document === "undefined") return false;
  return (
    !!document.pictureInPictureEnabled &&
    typeof (HTMLCanvasElement.prototype as CaptureCanvas).captureStream === "function"
  );
}

export class VideoPip {
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;

  constructor(private readonly onClosed: () => void) {}

  get active(): boolean {
    return !!this.video;
  }

  /** Needs a click (user activation) in every browser. */
  async open(canvas: HTMLCanvasElement, fps: number): Promise<boolean> {
    const capture = (canvas as CaptureCanvas).captureStream;
    if (!capture || this.video) return !!this.video;
    const stream = capture.call(canvas, fps > 0 ? fps : 30);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    video.setAttribute("aria-hidden", "true");
    video.style.cssText =
      "position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0;pointer-events:none";
    document.body.appendChild(video);
    this.video = video;
    this.stream = stream;
    video.addEventListener("leavepictureinpicture", () => this.cleanup(), { once: true });
    try {
      await video.play();
      await video.requestPictureInPicture();
      return true;
    } catch {
      this.cleanup();
      return false;
    }
  }

  close(): void {
    if (this.video && document.pictureInPictureElement === this.video) {
      void document.exitPictureInPicture().catch(() => {});
    }
    this.cleanup();
  }

  private cleanup(): void {
    if (!this.video) return;
    for (const t of this.stream?.getTracks() ?? []) t.stop();
    this.video.srcObject = null;
    this.video.remove();
    this.video = null;
    this.stream = null;
    this.onClosed();
  }
}
