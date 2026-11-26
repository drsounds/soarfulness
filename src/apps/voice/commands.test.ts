import { describe, expect, test } from "bun:test";
import en from "@/locales/en.json";
import {
  SettingResolver,
  createVoiceRegistry,
  parseDirection,
  type VoiceContext,
} from "./commands";
import { SETTING_CATALOG } from "./settingCatalog.generated";
import { buildSettingTargets, niceStep } from "./settingTargets";
import { parseSpokenNumber, parseSpokenValue } from "./spokenValue";
import { normalize, phraseSimilarity, tokens } from "./textMatch";

const enLabel = (key: string): string => {
  const v = key.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)?.[p], en);
  return typeof v === "string" ? v : "";
};

const values: Record<string, unknown> = {
  waveAmp: 2,
  waveSpeed: 1,
  waveDir: 0,
  swayAmp: 1,
  swingIntensity: 0.3,
  swingSpeed: 1,
  noclipSpeed: 1,
  noclipFallRiseSpeed: 20,
  freakOutOn: false,
  tornadoOn: false,
  auroraOn: false,
  snowOn: false,
  snowAmount: 4000,
  neonMode: "solid",
  tornadoDirection: "cw",
  camFov: 70,
  voiceLang: "auto",
  voiceOn: true,
  decorations: [],
};

function setup() {
  const targets = buildSettingTargets({
    defaults: values,
    catalog: SETTING_CATALOG,
    labels: (k) => [enLabel(k)],
    extreme: false,
  });
  const ctx: VoiceContext = {
    get: (k) => values[k],
    settings: new SettingResolver(targets),
    stepScale: 1,
  };
  const registry = createVoiceRegistry();
  const hear = (text: string, asleep = false) =>
    registry.match([text], ctx, { threshold: 0.72, asleep });
  return { targets, hear };
}

describe("textMatch", () => {
  test("normalize folds accents and punctuation", () => {
    expect(normalize("Öka VÅGHÖJD, tack!")).toBe("oka vaghojd tack");
    expect(normalize("2,5 m")).toBe("2.5 m");
  });
  test("phraseSimilarity tolerates misheard and merged words", () => {
    expect(phraseSimilarity(tokens("wave hight"), tokens("wave height"))).toBeGreaterThan(0.8);
    expect(phraseSimilarity(tokens("waveheight"), tokens("wave height"))).toBeGreaterThan(0.9);
    expect(phraseSimilarity(tokens("sink"), tokens("soar"))).toBeLessThan(0.5);
  });
});

describe("spoken values", () => {
  test("numbers", () => {
    expect(parseSpokenNumber(["five"])).toBe(5);
    expect(parseSpokenNumber(["two", "point", "five"])).toBe(2.5);
    expect(parseSpokenNumber(["twenty", "three"])).toBe(23);
    expect(parseSpokenNumber(["three", "hundred"])).toBe(300);
    expect(parseSpokenNumber(["fem", "komma", "fem"])).toBe(5.5);
    expect(parseSpokenNumber(["2.5", "meters"])).toBe(2.5);
    expect(parseSpokenNumber(["minus", "ten"])).toBe(-10);
    expect(parseSpokenNumber(["north"])).toBeNull();
  });
  test("values", () => {
    expect(parseSpokenValue(["on"])).toEqual({ kind: "bool", value: true });
    expect(parseSpokenValue(["av"])).toEqual({ kind: "bool", value: false });
    expect(parseSpokenValue(["max"])).toEqual({ kind: "limit", which: "max" });
    expect(parseSpokenValue(["50", "percent"])).toEqual({
      kind: "number",
      value: 50,
      percent: true,
    });
  });
  test("niceStep", () => {
    expect(niceStep(10)).toBe(0.5);
    expect(niceStep(100)).toBe(5);
  });
});

describe("targets", () => {
  test("every primitive setting is a target, structured ones are not", () => {
    const { targets } = setup();
    const keys = targets.map((t) => t.key);
    expect(keys).toContain("waveAmp");
    expect(keys).toContain("neonMode");
    expect(keys).not.toContain("decorations");
    expect(keys).not.toContain("voiceOn");
    const wave = targets.find((t) => t.key === "waveAmp")!;
    expect(wave.max).toBe(25); // limitMax("waveAmp", false)
    expect(wave.step).toBe(0.5);
  });
});

describe("commands", () => {
  const { hear } = setup();
  const patch = (text: string) => hear(text)?.outcome.patch;
  const actions = (text: string) => hear(text)?.outcome.actions;

  test("modes", () => {
    expect(actions("swing")).toEqual([
      { type: "mode", mode: "swing" },
      { type: "whirlpool", on: false },
    ]);
    expect(actions("fly")).toEqual([{ type: "mode", mode: "noclip" }]);
    expect(actions("swim")).toEqual([{ type: "mode", mode: "float" }]);
    expect(actions("whirlpool")).toEqual([{ type: "whirlpool", on: true }]);
    expect(actions("okay swim please")).toEqual([{ type: "mode", mode: "float" }]);
  });

  test("swing higher / lower beats plain swing", () => {
    expect(hear("swing higher")?.commandId).toBe("swing.higher");
    expect(patch("swing higher")).toEqual({ swingIntensity: 0.45 });
    expect(patch("swing lower")).toEqual({ swingIntensity: 0.15 });
  });

  test("a value past the everyday max is not pulled down by higher", () => {
    const { hear: h } = setup();
    values.swingIntensity = 1.47; // the real default, above the normal max 0.625
    expect(h("swing higher")?.outcome.patch).toEqual({ swingIntensity: 1.62 });
    expect(h("swing lower")?.outcome.patch).toEqual({ swingIntensity: 1.32 });
    values.swingIntensity = 0.3;
  });

  test("soar and sink, with speed", () => {
    expect(actions("soar")).toEqual([{ type: "vertical", dir: "up" }]);
    expect(actions("sore")).toEqual([{ type: "vertical", dir: "up" }]);
    expect(actions("sink")).toEqual([{ type: "vertical", dir: "down" }]);
    expect(hear("sink faster")?.commandId).toBe("fly.sinkFaster");
    expect(patch("sink faster")).toEqual({ noclipFallRiseSpeed: 30 });
    expect(actions("sink faster")).toEqual([{ type: "vertical", dir: "down" }]);
    expect(patch("soar faster")).toEqual({ noclipFallRiseSpeed: 30 });
  });

  test("sway and wave direction", () => {
    expect(actions("change sway to north")).toEqual([
      { type: "direction", target: "sway", bearing: 0 },
    ]);
    expect(actions("change sway to the left")).toEqual([
      { type: "direction", target: "sway", view: -90 },
    ]);
    expect(actions("change sway to 90 degrees")).toEqual([
      { type: "direction", target: "sway", bearing: 90 },
    ]);
    expect(actions("turn waves right")).toEqual([{ type: "direction", target: "waves", turn: 45 }]);
    expect(parseDirection(["south", "west"])?.dir).toEqual({ bearing: 225 });
  });

  test("generic settings", () => {
    expect(patch("increase wave height")).toEqual({ waveAmp: 2.5 });
    expect(patch("decrease wave height")).toEqual({ waveAmp: 1.5 });
    expect(patch("set wave height to 5")).toEqual({ waveAmp: 5 });
    expect(patch("set wave height to two point five")).toEqual({ waveAmp: 2.5 });
    expect(patch("wave height 3")).toEqual({ waveAmp: 3 });
    expect(patch("set wave height to 500")).toEqual({ waveAmp: 25 });
    expect(patch("set wave height to max")).toEqual({ waveAmp: 25 });
    expect(patch("more sway")).toEqual({ swayAmp: 1.5 });
    expect(patch("increase wave height by 3")).toEqual({ waveAmp: 5 });
    expect(patch("set field of view to 90")).toEqual({ camFov: 90 });
  });

  test("on / off", () => {
    expect(patch("start ride")).toEqual({ freakOutOn: true });
    expect(patch("stop ride")).toEqual({ freakOutOn: false });
    expect(patch("turn on northern lights")).toEqual({ auroraOn: true });
    expect(patch("snow on")).toEqual({ snowOn: true });
    expect(patch("rain off")).toBeUndefined(); // no rainOn in this test's settings
    expect(patch("aurora off")).toEqual({ auroraOn: false });
  });

  test("option lists", () => {
    expect(patch("set neon mode to fade")).toEqual({ neonMode: "fade" });
    expect(patch("set tornado direction to counterclockwise")).toEqual({ tornadoDirection: "ccw" });
    expect(patch("set voice language to swedish")).toEqual({ voiceLang: "sv-SE" });
  });

  test("swedish", () => {
    expect(actions("gunga")).toEqual([
      { type: "mode", mode: "swing" },
      { type: "whirlpool", on: false },
    ]);
    expect(actions("flyg")).toEqual([{ type: "mode", mode: "noclip" }]);
    expect(patch("öka våghöjd")).toEqual({ waveAmp: 2.5 });
    expect(patch("sätt våghöjd till fem")).toEqual({ waveAmp: 5 });
  });

  test("sleep and wake", () => {
    expect(hear("swing", true)).toBeNull();
    expect(actions("wake up")).toEqual([{ type: "listen", awake: true }]);
    expect(hear("wake up", true)?.commandId).toBe("voice.wake");
  });

  test("nonsense is ignored", () => {
    expect(hear("what a lovely day it is")).toBeNull();
    expect(hear("")).toBeNull();
  });
});

describe("generated catalog", () => {
  test("is up to date with the settings rows", () => {
    const r = Bun.spawnSync(["node", "scripts/gen-voice-catalog.mjs", "--check"]);
    expect(r.stderr.toString()).toBe("");
    expect(r.exitCode).toBe(0);
  });
});
