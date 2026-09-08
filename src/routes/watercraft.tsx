import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { WatercraftToolbar } from "@/components/watercraft/WatercraftToolbar";
import { WatercraftApp } from "@/lib/watercraft/WatercraftApp";
import type { BuildAction, SculptAction, ToolMode } from "@/lib/watercraft/types";

// "Watercraft": an optional, entirely client-side sandbox alongside the
// main meditative bath — a raft that bobs on a small animated ocean, with a
// Minecraft-like block grid on one side and a brush-sculptable clay pad on
// the other. Worlds save/load as real .glb files (see
// src/lib/watercraft/glbIO.ts) via the File System download/upload dance —
// no server, no account, nothing leaves the browser.
export const Route = createFileRoute("/watercraft")({
  component: WatercraftPage,
  head: () => ({
    meta: [
      { title: "Watercraft — Aquafulness" },
      {
        name: "description",
        content:
          "Build a small floating world while it bobs on the waves — Minecraft-like block building plus brush-based sculpting, entirely in your browser. Export or import your creation as a .glb file.",
      },
    ],
  }),
});

function WatercraftPage() {
  const mountRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<WatercraftApp | null>(null);

  const [mode, setMode] = useState<ToolMode>("build");
  const [buildAction, setBuildAction] = useState<BuildAction>("place");
  const [blockType, setBlockType] = useState(0);
  const [sculptAction, setSculptAction] = useState<SculptAction>("raise");
  const [brushRadius, setBrushRadius] = useState(1.1);
  const [brushStrength, setBrushStrength] = useState(0.14);
  const [blockCount, setBlockCount] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "import" | "reset"; file: File | null } | null>(
    null,
  );

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const app = new WatercraftApp(mount, {
      onBlockCountChange: setBlockCount,
      onImportedStatic: () => {},
    });
    appRef.current = app;
    return () => {
      app.dispose();
      appRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (appRef.current) appRef.current.mode = mode;
  }, [mode]);
  useEffect(() => {
    if (appRef.current) appRef.current.buildAction = buildAction;
  }, [buildAction]);
  useEffect(() => {
    if (appRef.current) appRef.current.blockType = blockType;
  }, [blockType]);
  useEffect(() => {
    if (appRef.current) appRef.current.sculptAction = sculptAction;
  }, [sculptAction]);
  useEffect(() => {
    if (appRef.current) appRef.current.brushRadius = brushRadius;
  }, [brushRadius]);
  useEffect(() => {
    if (appRef.current) appRef.current.brushStrength = brushStrength;
  }, [brushStrength]);

  useEffect(() => {
    if (!status) return;
    const id = window.setTimeout(() => setStatus(null), 4000);
    return () => window.clearTimeout(id);
  }, [status]);

  const handleExport = async () => {
    const app = appRef.current;
    if (!app) return;
    setStatus("Exporting…");
    try {
      const blob = await app.exportGlb();
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `watercraft-${stamp}.glb`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus(`Saved ${filename}`);
    } catch (err) {
      console.error("Watercraft export failed", err);
      setStatus("Export failed — see console");
    }
  };

  const runImport = async (file: File) => {
    const app = appRef.current;
    if (!app) return;
    setStatus("Importing…");
    try {
      const result = await app.importGlb(file);
      setStatus(
        result.kind === "restored"
          ? "World imported."
          : "Imported as a static model (not a saved Aquafulness world, so it isn't editable).",
      );
    } catch (err) {
      console.error("Watercraft import failed", err);
      setStatus("Import failed — is this a valid .glb?");
    }
  };

  const handleImportFile = (file: File) => {
    const app = appRef.current;
    if (app && app.blockCount > 0) {
      setConfirm({ kind: "import", file });
    } else {
      void runImport(file);
    }
  };

  const handleReset = () => {
    const app = appRef.current;
    if (app && app.blockCount > 0) {
      setConfirm({ kind: "reset", file: null });
    } else {
      app?.reset();
      setStatus("Cleared.");
    }
  };

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-[#bfe8ef]">
      <div ref={mountRef} className="absolute inset-0 touch-none" />

      <WatercraftToolbar
        mode={mode}
        onModeChange={setMode}
        buildAction={buildAction}
        onBuildActionChange={setBuildAction}
        blockType={blockType}
        onBlockTypeChange={setBlockType}
        sculptAction={sculptAction}
        onSculptActionChange={setSculptAction}
        brushRadius={brushRadius}
        onBrushRadiusChange={setBrushRadius}
        brushStrength={brushStrength}
        onBrushStrengthChange={setBrushStrength}
        blockCount={blockCount}
        status={status}
        onExport={() => void handleExport()}
        onImportFile={handleImportFile}
        onReset={handleReset}
      />

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === "reset" ? "Clear your build?" : "Import over your current build?"}
        message={
          confirm?.kind === "reset"
            ? "This removes every block and sculpted shape. This can't be undone."
            : "If this file is a saved Aquafulness world, it will replace your current blocks and sculpt. Export first if you want to keep this build."
        }
        confirmLabel={confirm?.kind === "reset" ? "Clear" : "Import"}
        cancelLabel="Cancel"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.kind === "reset") {
            appRef.current?.reset();
            setStatus("Cleared.");
          } else if (confirm?.file) {
            void runImport(confirm.file);
          }
          setConfirm(null);
        }}
      />
    </div>
  );
}
