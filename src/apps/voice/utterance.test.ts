import { afterEach, describe, expect, test } from "bun:test";
import type { VoiceMatch } from "./VoiceCommandRegistry";
import { effectKey, isNewEffect, latencySummary, reactionMs } from "./utterance";
import { voiceBus } from "./voiceBus";

const m = (
  commandId: string,
  patch?: Record<string, unknown>,
  absolute = false,
  actions?: VoiceMatch["outcome"]["actions"],
): VoiceMatch => ({
  commandId,
  phrase: commandId,
  heard: commandId,
  score: 1,
  outcome: { label: commandId, patch, actions },
  absolute,
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("isNewEffect", () => {
  test("a relative command runs once per phrase, whatever value it computes", () => {
    const first = m("setting.increase", { waveHeight: 2 });
    expect(isNewEffect(first, [])).toBe(true);
    expect(isNewEffect(m("setting.increase", { waveHeight: 2.5 }), [first])).toBe(false);
  });
  test("an absolute command runs again only with a different value", () => {
    const three = m("setting.set", { waveHeight: 3 }, true);
    expect(isNewEffect(m("setting.set", { waveHeight: 3 }, true), [three])).toBe(false);
    expect(isNewEffect(m("setting.set", { waveHeight: 35 }, true), [three])).toBe(true);
  });
  test("a different command or action runs", () => {
    const swing = m("mode.swing", undefined, false, [{ type: "mode", mode: "swing" }]);
    expect(isNewEffect(m("swing.higher", { swingIntensity: 2 }), [swing])).toBe(true);
    expect(effectKey(swing)).not.toBe(effectKey(m("mode.fly")));
  });
});

describe("latency", () => {
  const timing = (quietAt: number, firedAt: number | null) => ({
    spokeAt: 0,
    quietAt,
    endAt: null,
    firedAt,
    finalAt: null,
    early: true,
    matchMs: 1,
  });
  test("reaction is from the words settling to the command running", () => {
    expect(reactionMs(timing(1000, 1400))).toBe(400);
    expect(reactionMs(timing(1000, null))).toBeNull();
  });
  test("summary is the median of recent reactions", () => {
    const s = latencySummary([timing(0, 300), undefined, timing(0, 500), timing(0, 2000)]);
    expect(s).toEqual({ medianMs: 500, count: 3 });
    expect(latencySummary([])).toBeNull();
  });
});

describe("voiceBus acts on settled partial results", () => {
  const ran: string[] = [];
  const install = (lookup: Record<string, VoiceMatch>) => {
    ran.length = 0;
    voiceBus.clearLog();
    voiceBus.newSession();
    voiceBus.setHandler({
      match: (alts) => {
        for (const a of alts) {
          const hit = lookup[a.toLowerCase().replace(/[.!?]/g, "")];
          if (hit) return hit;
        }
        return null;
      },
      run: (match) => ran.push(match.commandId),
    });
  };
  afterEach(() => {
    voiceBus.setHandler(null);
    voiceBus.setEarlyMs(400);
    voiceBus.newSession();
  });

  test("runs before the final result, and the final does not run it again", async () => {
    install({ "swing higher": m("swing.higher", { swingIntensity: 2 }) });
    voiceBus.setEarlyMs(30);
    voiceBus.partial("swing");
    voiceBus.partial("swing higher");
    expect(ran).toEqual([]);
    await sleep(60);
    expect(ran).toEqual(["swing.higher"]);
    const log = voiceBus.get().log;
    expect(log[0].timing?.early).toBe(true);
    voiceBus.final(["Swing higher."]);
    expect(ran).toEqual(["swing.higher"]);
    // The final result updates the early entry instead of adding one.
    expect(voiceBus.get().log.length).toBe(1);
    expect(voiceBus.get().log[0].alternatives).toEqual(["Swing higher."]);
    expect(voiceBus.get().log[0].timing?.finalAt).not.toBeNull();
  });

  test("words that keep changing wait until they settle", async () => {
    install({
      swing: m("mode.swing", undefined, false, [{ type: "mode", mode: "swing" }]),
      "swing higher": m("swing.higher", { swingIntensity: 2 }),
    });
    voiceBus.setEarlyMs(40);
    voiceBus.partial("swing");
    await sleep(15);
    voiceBus.partial("swing higher");
    await sleep(15);
    voiceBus.partial("swing higher"); // a repeat does not restart the wait
    await sleep(40);
    expect(ran).toEqual(["swing.higher"]);
  });

  test("a corrected final result still runs", async () => {
    install({
      "set wave height to 3": m("setting.set", { waveHeight: 3 }, true),
      "set wave height to 35": m("setting.set", { waveHeight: 35 }, true),
    });
    voiceBus.setEarlyMs(20);
    voiceBus.partial("set wave height to 3");
    await sleep(40);
    voiceBus.final(["set wave height to 35"]);
    expect(ran).toEqual(["setting.set", "setting.set"]);
    expect(voiceBus.get().log.length).toBe(2);
  });

  test("ACT EARLY off waits for the final result", async () => {
    install({ fly: m("mode.fly", undefined, false, [{ type: "mode", mode: "noclip" }]) });
    voiceBus.setEarlyMs(0);
    voiceBus.partial("fly");
    await sleep(30);
    expect(ran).toEqual([]);
    voiceBus.final(["fly"]);
    expect(ran).toEqual(["mode.fly"]);
    expect(voiceBus.get().log[0].timing?.early).toBe(false);
  });

  test("a new phrase can run the same relative command again", async () => {
    install({ "swing higher": m("swing.higher", { swingIntensity: 2 }) });
    voiceBus.setEarlyMs(20);
    voiceBus.partial("swing higher");
    await sleep(40);
    voiceBus.final(["swing higher"]);
    voiceBus.partial("swing higher");
    await sleep(40);
    expect(ran).toEqual(["swing.higher", "swing.higher"]);
  });

  test("typed phrases run at once", () => {
    install({ fly: m("mode.fly", undefined, false, [{ type: "mode", mode: "noclip" }]) });
    expect(voiceBus.submit(["fly"], "typed")?.commandId).toBe("mode.fly");
    expect(ran).toEqual(["mode.fly"]);
  });
});
