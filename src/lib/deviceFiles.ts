import { Capacitor, registerPlugin } from "@capacitor/core";

// Saving a file to / picking a file from the user's device, in a browser and
// inside the Android app alike. The browser path is the usual blob <a
// download> + <input type="file">. Neither works in the app's WebView: it
// has no download handler, so a blob download silently does nothing, and
// its file chooser filters on the input's accept list, where ".json" isn't a
// MIME type and most file providers label .json files
// application/octet-stream — so they show up greyed out. Inside the app the
// native DeviceFilesPlugin (android/.../DeviceFilesPlugin.java) opens
// Android's own "save as" / "open" document pickers instead.
export interface DeviceFilesPlugin {
  /** Resolves saved: false when the user backs out of the picker. */
  saveFile(options: {
    filename: string;
    mimeType: string;
    data: string;
    encoding: "utf8" | "base64";
  }): Promise<{ saved: boolean }>;
  /** Resolves with no data when the user backs out of the picker. */
  openFile(options: { mimeTypes?: string[]; encoding: "utf8" | "base64" }): Promise<{
    name?: string;
    mimeType?: string;
    data?: string;
  }>;
}

export const DeviceFiles = registerPlugin<DeviceFilesPlugin>("DeviceFiles");

// Older APKs (still running this web code via live updates) don't have the
// plugin, so they keep the browser path.
function hasDeviceFiles() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("DeviceFiles");
}

function isTextType(mimeType: string) {
  return mimeType.startsWith("text/") || mimeType === "application/json";
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(data: string): Uint8Array<ArrayBuffer> {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Saves `blob` as `filename`. Resolves false if the user cancelled the
// app's save picker (a browser download can't report that).
export async function saveFileToDevice(filename: string, blob: Blob): Promise<boolean> {
  if (hasDeviceFiles()) {
    const mimeType = blob.type || "application/octet-stream";
    const text = isTextType(mimeType);
    const { saved } = await DeviceFiles.saveFile({
      filename,
      mimeType,
      data: text ? await blob.text() : await blobToBase64(blob),
      encoding: text ? "utf8" : "base64",
    });
    return saved;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked a tick later: some browsers start the download asynchronously
  // and fail it if the URL is already gone.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

// Opens a file picker and hands the chosen file to `onFile`. `accept` is an
// <input accept> list for browsers; inside the app any file can be picked
// (and is validated by whoever reads it), for the labelling reason above.
export function pickFileFromDevice(
  accept: string,
  onFile: (file: File) => void,
  { binary = false }: { binary?: boolean } = {},
) {
  if (hasDeviceFiles()) {
    DeviceFiles.openFile({ encoding: binary ? "base64" : "utf8" })
      .then((r) => {
        if (r.data === undefined) return;
        const type = r.mimeType || "application/octet-stream";
        const content = binary ? base64ToBytes(r.data) : r.data;
        onFile(new File([content], r.name || "file", { type }));
      })
      .catch((err) => console.error("Opening file failed", err));
    return;
  }
  // Briefly attached to the DOM (hidden) since some browsers refuse to show
  // the picker for a detached element's click().
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  input.style.display = "none";
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) onFile(file);
    input.remove();
  };
  document.body.appendChild(input);
  input.click();
}
