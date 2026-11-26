import { afterEach, describe, expect, test } from "bun:test";
import en from "@/locales/en.json";
import { SettingResolver, type VoiceContext } from "../commands";
import { SETTING_CATALOG } from "../settingCatalog.generated";
import { buildSettingTargets } from "../settingTargets";
import { voiceBus } from "../voiceBus";
import type { VoiceMatch } from "../VoiceCommandRegistry";
import { LlmInterpreter, type LlmEngine } from "./LlmInterpreter";
import { LocalLlm, type WorkerLike } from "./LocalLlm";
import { isModelHost } from "./models";
import { closeOtherChannels, guardFetch } from "./networkGuard";
import { buildMessages, buildRequest, candidateSettings, parseReply, replySchema } from "./prompt";
import { VoiceToolbox } from "./VoiceToolbox";
import type { WorkerReply, WorkerRequest } from "./workerProtocol";

const enLabel = (key: string): string => {
  const v = key.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)?.[p], en);
  return typeof v === "string" ? v : "";
};

const values: Record<string, unknown> = {
  waveAmp: 2,
  waveSpeed: 1,
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
  voiceInterpreter: "hybrid",
  voiceLlmModel: "qwen2.5-0.5b",
  decorations: [],
};

function context(): VoiceContext {
  const targets = buildSettingTargets({
    defaults: values,
    catalog: SETTING_CATALOG,
    labels: (k) => [enLabel(k)],
    extreme: false,
  });
  return { get: (k) => values[k], settings: new SettingResolver(targets), stepScale: 1 };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("VoiceToolbox (internal MCP tools)", () => {
  const ctx = context();
  const box = new VoiceToolbox();

  test("tools/list: schemas come from the settings registry", () => {
    const tools = box.listTools(ctx);
    const names = tools.map((t) => t.name);
    expect(names).toContain("set_setting");
    expect(names).toContain("run_command");
    const set = tools.find((t) => t.name === "set_setting")!;
    const keyEnum = (set.inputSchema.properties as Record<string, { enum: string[] }>).key.enum;
    expect(keyEnum).toContain("waveAmp");
    expect(keyEnum).toContain("freakOutOn");
    // Never offered: structured values and the interpreter's own settings.
    expect(keyEnum).not.toContain("voiceOn");
    expect(keyEnum).not.toContain("voiceInterpreter");
    expect(keyEnum).not.toContain("voiceLlmModel");
    expect(keyEnum).not.toContain("decorations");
    const cmds = (
      tools.find((t) => t.name === "run_command")!.inputSchema.properties as Record<
        string,
        { enum: string[] }
      >
    ).command.enum;
    expect(cmds).toContain("swing.higher");
    expect(cmds).toContain("mode.fly");
    // "wake up" is the rules' job; commands with slots go through other tools.
    expect(cmds).not.toContain("voice.wake");
    expect(cmds).not.toContain("setting.set");
  });

  test("set_setting clamps numbers, coerces on/off, checks options", () => {
    expect(box.callTool("set_setting", { key: "waveAmp", value: 3 }, ctx).outcome?.patch).toEqual({
      waveAmp: 3,
    });
    const big = box.callTool("set_setting", { key: "waveAmp", value: 9999 }, ctx).outcome?.patch;
    expect((big as { waveAmp: number }).waveAmp).toBeLessThan(9999);
    expect(box.callTool("set_setting", { key: "snowOn", value: "on" }, ctx).outcome?.patch).toEqual(
      {
        snowOn: true,
      },
    );
    expect(
      box.callTool("set_setting", { key: "tornadoDirection", value: "counterclockwise" }, ctx)
        .outcome?.patch,
    ).toEqual({ tornadoDirection: "ccw" });
    expect(box.callTool("set_setting", { key: "waveAmp", value: "max" }, ctx).isError).toBeFalsy();
    expect(box.callTool("set_setting", { key: "snowOn", value: 7 }, ctx).isError).toBe(true);
    expect(box.callTool("set_setting", { key: "neonMode", value: "banana" }, ctx).isError).toBe(
      true,
    );
  });

  test("unknown or forbidden keys are refused, spoken names are accepted", () => {
    expect(box.callTool("set_setting", { key: "noSuchThing", value: 1 }, ctx).isError).toBe(true);
    expect(box.callTool("set_setting", { key: "voiceOn", value: false }, ctx).isError).toBe(true);
    expect(
      box.callTool("set_setting", { key: "voiceInterpreter", value: "rules" }, ctx).isError,
    ).toBe(true);
    expect(
      box.callTool("set_setting", { key: "wave height", value: 3 }, ctx).outcome?.patch,
    ).toEqual({
      waveAmp: 3,
    });
    expect(box.callTool("explode", {}, ctx).isError).toBe(true);
    expect(box.callTool("set_setting", null, ctx).isError).toBe(true);
  });

  test("adjust, toggle, reset", () => {
    const up = box.callTool("adjust_setting", { key: "waveAmp", direction: "up" }, ctx);
    expect((up.outcome?.patch as { waveAmp: number }).waveAmp).toBeGreaterThan(2);
    const by = box.callTool(
      "adjust_setting",
      { key: "waveAmp", direction: "down", amount: 0.5 },
      ctx,
    );
    expect(by.outcome?.patch).toEqual({ waveAmp: 1.5 });
    expect(
      box.callTool("adjust_setting", { key: "snowOn", direction: "up" }, ctx).outcome?.patch,
    ).toEqual({ snowOn: true });
    expect(box.callTool("toggle_setting", { key: "auroraOn" }, ctx).outcome?.patch).toEqual({
      auroraOn: true,
    });
    expect(box.callTool("toggle_setting", { key: "waveAmp" }, ctx).isError).toBe(true);
    expect(box.callTool("reset_setting", { key: "snowAmount" }, ctx).outcome?.patch).toEqual({
      snowAmount: 4000,
    });
    expect(
      box.callTool("adjust_setting", { key: "waveAmp", direction: "sideways" }, ctx).isError,
    ).toBe(true);
  });

  test("commands and directions become host actions", () => {
    expect(box.callTool("run_command", { command: "mode.fly" }, ctx).outcome?.actions).toEqual([
      { type: "mode", mode: "noclip" },
    ]);
    expect(
      box.callTool("run_command", { command: "swing.higher" }, ctx).outcome?.patch,
    ).toHaveProperty("swingIntensity");
    expect(box.callTool("run_command", { command: "nope" }, ctx).isError).toBe(true);
    expect(
      box.callTool("point_direction", { target: "sway", compass: "east" }, ctx).outcome?.actions,
    ).toEqual([{ type: "direction", target: "sway", bearing: 90 }]);
    expect(
      box.callTool("point_direction", { target: "waves", relative: "left" }, ctx).outcome?.actions,
    ).toEqual([{ type: "direction", target: "waves", view: -90 }]);
    expect(
      box.callTool("point_direction", { target: "waves", bearing: 450 }, ctx).outcome?.actions,
    ).toEqual([{ type: "direction", target: "waves", bearing: 90 }]);
    expect(
      box.callTool("turn_direction", { target: "sway", side: "left" }, ctx).outcome?.actions,
    ).toEqual([{ type: "direction", target: "sway", turn: -45 }]);
    expect(box.callTool("point_direction", { target: "moon" }, ctx).isError).toBe(true);
  });

  test("read tools describe settings and change nothing", () => {
    const list = box.callTool("list_settings", { query: "wave height" }, ctx);
    expect(list.outcome).toBeUndefined();
    expect(list.text.split("\n")[0]).toStartWith("waveAmp ");
    const get = box.callTool("get_setting", { key: "snowAmount" }, ctx);
    expect(get.text).toContain("= 4000");
    expect(get.outcome).toBeUndefined();
  });
});

describe("prompt", () => {
  const ctx = context();
  const box = new VoiceToolbox();

  test("candidates are the settings the phrase names", () => {
    const c = candidateSettings("could you make the waves a little higher", box, ctx);
    expect(c.length).toBeGreaterThan(0);
    expect(c.length).toBeLessThanOrEqual(12);
    expect(c.some((l) => l.startsWith("waveAmp "))).toBe(true);
    // Nothing named: a few common ones instead of nothing.
    expect(candidateSettings("hmm", box, ctx).length).toBeGreaterThan(0);
  });

  test("messages: system with tools and candidates, then the phrase only", () => {
    const msgs = buildMessages("it's snowing too much", box, ctx);
    expect(msgs.map((m) => m.role)).toEqual(["system", "user"]);
    expect(msgs[1].content).toBe("it's snowing too much");
    expect(msgs[0].content).toContain("adjust_setting(");
    expect(msgs[0].content).toContain("snowAmount");
    expect(msgs[0].content).not.toContain("list_settings");
    // Small enough for a small model to read quickly.
    expect(msgs[0].content.length).toBeLessThan(6000);
  });

  test("reply schema only allows action tools", () => {
    const schema = replySchema(box, ctx) as {
      properties: {
        calls: {
          maxItems: number;
          items: { anyOf: { properties: { tool: { enum: string[] } } }[] };
        };
      };
    };
    const tools = schema.properties.calls.items.anyOf.map((b) => b.properties.tool.enum[0]);
    expect(tools).toContain("set_setting");
    expect(tools).not.toContain("list_settings");
    expect(schema.properties.calls.maxItems).toBe(3);
  });

  test("everyday words bring their settings; the schema only allows the candidates", () => {
    const { messages, schema } = buildRequest("make the sea calmer", box, ctx);
    expect(messages[0].content).toContain("waveAmp ");
    const json = JSON.stringify(schema);
    expect(json).toContain('"waveAmp"');
    expect(json).not.toContain('"camFov"');
  });

  test("parseReply is tolerant", () => {
    expect(parseReply('{"calls":[{"tool":"run_command","args":{"command":"mode.fly"}}]}')).toEqual([
      { tool: "run_command", args: { command: "mode.fly" } },
    ]);
    expect(parseReply('Sure! {"tool":"toggle_setting","args":{"key":"snowOn"}} done')).toEqual([
      { tool: "toggle_setting", args: { key: "snowOn" } },
    ]);
    expect(parseReply('[{"name":"reset_setting","arguments":{"key":"waveAmp"}}]')).toEqual([
      { tool: "reset_setting", args: { key: "waveAmp" } },
    ]);
    expect(parseReply('{"calls":[]}')).toEqual([]);
    expect(parseReply("no idea")).toEqual([]);
    expect(parseReply("{broken")).toEqual([]);
  });
});

class FakeEngine implements LlmEngine {
  ready = true;
  delayMs = 0;
  answers: string[] = [];
  seen: string[] = [];
  interrupted = 0;
  private cancel: (() => void) | null = null;
  isReady() {
    return this.ready;
  }
  complete(messages: { role: string; content: string }[]): Promise<string> {
    this.seen.push(messages[messages.length - 1].content);
    const answer = this.answers.shift() ?? '{"calls":[]}';
    return new Promise((resolve) => {
      const t = setTimeout(() => resolve(answer), this.delayMs);
      this.cancel = () => {
        clearTimeout(t);
        resolve("");
      };
    });
  }
  interrupt() {
    this.interrupted++;
    this.cancel?.();
  }
}

describe("LlmInterpreter", () => {
  test("tool calls become one merged match", async () => {
    const engine = new FakeEngine();
    engine.answers.push(
      JSON.stringify({
        calls: [
          { tool: "adjust_setting", args: { key: "waveAmp", direction: "up" } },
          { tool: "point_direction", args: { target: "sway", compass: "north" } },
          { tool: "set_setting", args: { key: "made_up", value: 1 } },
        ],
      }),
    );
    const r = await new LlmInterpreter(engine).interpret(
      "bigger waves, sway north",
      context(),
      1000,
    );
    expect(r.status).toBe("ok");
    expect(r.match?.commandId).toBe("llm:adjust_setting+point_direction+set_setting");
    expect(r.match?.outcome.patch).toHaveProperty("waveAmp");
    expect(r.match?.outcome.actions).toEqual([{ type: "direction", target: "sway", bearing: 0 }]);
    expect(r.refused.length).toBe(1);
  });

  test("nothing fitting, not ready, read-only calls", async () => {
    const engine = new FakeEngine();
    const llm = new LlmInterpreter(engine);
    expect((await llm.interpret("what a day", context(), 1000)).status).toBe("none");
    engine.answers.push('{"calls":[{"tool":"list_settings","args":{"query":"wave"}}]}');
    const ro = await llm.interpret("which settings are there", context(), 1000);
    expect(ro.status).toBe("none");
    expect(ro.refused[0]).toContain("read-only");
    engine.ready = false;
    expect((await llm.interpret("fly", context(), 1000)).status).toBe("unavailable");
  });

  test("too slow: interrupted, and the next phrase still gets its turn", async () => {
    const engine = new FakeEngine();
    engine.delayMs = 200;
    const llm = new LlmInterpreter(engine);
    const r1 = await llm.interpret("one", context(), 30);
    expect(r1.status).toBe("timeout");
    expect(engine.interrupted).toBe(1);
    engine.delayMs = 0;
    engine.answers.push('{"calls":[{"tool":"run_command","args":{"command":"mode.swim"}}]}');
    const r2 = await llm.interpret("swim please", context(), 500);
    expect(r2.status).toBe("ok");
  });

  test("a phrase whose deadline passed while waiting is not sent at all", async () => {
    const engine = new FakeEngine();
    engine.delayMs = 80;
    const llm = new LlmInterpreter(engine);
    const a = llm.interpret("first", context(), 1000);
    const b = llm.interpret("second", context(), 20);
    expect((await a).status).toBe("none");
    expect((await b).status).toBe("timeout");
    expect(engine.seen).toEqual(["first"]);
  });
});

describe("voiceBus with an LLM interpreter", () => {
  const ran: string[] = [];
  const m = (id: string): VoiceMatch => ({
    commandId: id,
    phrase: id,
    heard: id,
    score: 1,
    outcome: { label: id.toUpperCase() },
  });
  const install = (opts: {
    rules: Record<string, VoiceMatch>;
    llm: (text: string) => VoiceMatch | null;
    llmFirst?: boolean;
    ready?: boolean;
  }) => {
    ran.length = 0;
    voiceBus.clearLog();
    voiceBus.newSession();
    voiceBus.setHandler({
      match: (alts) => opts.rules[alts[0].toLowerCase()] ?? null,
      run: (match) => ran.push(match.commandId),
      interpret: async (text) => {
        await sleep(10);
        const match = opts.llm(text);
        return { match, status: match ? "ok" : "none", ms: 10, calls: [], refused: [] };
      },
      llmFirst: opts.llmFirst,
      llmReady: () => opts.ready ?? true,
    });
  };
  afterEach(() => {
    voiceBus.setHandler(null);
    voiceBus.setEarlyMs(400);
    voiceBus.setAsleep(false);
    voiceBus.newSession();
  });

  test("hybrid: the rules answer known phrases at once, the LLM the rest", async () => {
    let asked = 0;
    install({
      rules: { swing: m("mode.swing") },
      llm: () => {
        asked++;
        return m("llm:adjust_setting");
      },
    });
    expect(voiceBus.final(["swing"])?.commandId).toBe("mode.swing");
    expect(asked).toBe(0);
    expect(voiceBus.final(["make the sea calmer"])).toBeNull();
    expect(voiceBus.get().log[0].llm?.status).toBe("pending");
    expect(voiceBus.get().thinking).toBe(1);
    await sleep(30);
    expect(ran).toEqual(["mode.swing", "llm:adjust_setting"]);
    expect(voiceBus.get().log[0].llm?.status).toBe("ok");
    expect(voiceBus.get().log[0].match?.commandId).toBe("llm:adjust_setting");
    expect(voiceBus.get().thinking).toBe(0);
  });

  test("hybrid: early partial runs are kept", async () => {
    install({ rules: { swing: m("mode.swing") }, llm: () => m("llm:x") });
    voiceBus.setEarlyMs(20);
    voiceBus.partial("swing");
    await sleep(40);
    expect(ran).toEqual(["mode.swing"]);
  });

  test("llm first: no early runs, the rules only when the LLM has nothing", async () => {
    install({
      rules: { swing: m("mode.swing"), fly: m("mode.fly") },
      llm: (text) => (text === "swing" ? m("llm:run_command") : null),
      llmFirst: true,
    });
    voiceBus.setEarlyMs(20);
    voiceBus.partial("swing");
    await sleep(40);
    expect(ran).toEqual([]);
    voiceBus.final(["swing"]);
    await sleep(30);
    expect(ran).toEqual(["llm:run_command"]);
    voiceBus.final(["fly"]);
    await sleep(30);
    expect(ran).toEqual(["llm:run_command", "mode.fly"]);
    expect(voiceBus.get().log[0].llm?.fellBack).toBe(true);
  });

  test("model not ready, or asleep: rules only, as without an LLM", async () => {
    let asked = 0;
    install({
      rules: { swing: m("mode.swing") },
      llm: () => {
        asked++;
        return m("llm:x");
      },
      llmFirst: true,
      ready: false,
    });
    expect(voiceBus.final(["swing"])?.commandId).toBe("mode.swing");
    expect(voiceBus.final(["gibberish"])).toBeNull();
    install({ rules: {}, llm: () => (asked++, m("llm:x")) });
    voiceBus.setAsleep(true);
    voiceBus.final(["make it snow"]);
    await sleep(20);
    expect(asked).toBe(0);
    expect(ran).toEqual([]);
  });

  test("typed phrases take the same way", async () => {
    install({ rules: {}, llm: () => m("llm:toggle_setting") });
    expect(voiceBus.submit(["turn the lights into northern lights"], "typed")).toBeNull();
    await sleep(30);
    expect(ran).toEqual(["llm:toggle_setting"]);
    expect(voiceBus.get().log[0].source).toBe("typed");
  });
});

describe("privacy: the model's network", () => {
  test("only model hosts", () => {
    expect(isModelHost("https://huggingface.co/mlc-ai/x/resolve/main/a.bin")).toBe(true);
    expect(isModelHost("https://cdn-lfs.huggingface.co/x")).toBe(true);
    expect(isModelHost("https://cas-bridge.xethub.hf.co/x")).toBe(true);
    expect(
      isModelHost("https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/x.wasm"),
    ).toBe(true);
    expect(isModelHost("https://huggingface.co.evil.example/x")).toBe(false);
    expect(isModelHost("https://api.example.com/v1/chat")).toBe(false);
    expect(isModelHost("not a url")).toBe(false);
  });

  test("fetch is closed while the model answers, GET-only to model hosts while loading", async () => {
    let open = false;
    const real: string[] = [];
    const f = guardFetch(
      (async (input: RequestInfo | URL) => {
        real.push(String(input));
        return new Response("ok");
      }) as typeof fetch,
      () => open,
    );
    const hf = "https://huggingface.co/mlc-ai/m/resolve/main/params.bin";
    await expect(f(hf)).rejects.toThrow("network closed");
    await expect(
      f("https://example.com/collect", { method: "POST", body: "swing higher" }),
    ).rejects.toThrow();
    open = true;
    await expect(f(hf)).resolves.toBeInstanceOf(Response);
    await expect(f(hf, { method: "POST", body: "x" })).rejects.toThrow();
    await expect(f("https://example.com/x")).rejects.toThrow();
    expect(real).toEqual([hf]);
  });

  test("sockets, XHR and beacons are removed", () => {
    const scope: Record<string, unknown> = {
      WebSocket: class {},
      XMLHttpRequest: class {},
      EventSource: class {},
      navigator: { sendBeacon: () => true },
    };
    closeOtherChannels(scope);
    expect(scope.WebSocket).toBeUndefined();
    expect(scope.XMLHttpRequest).toBeUndefined();
    expect(scope.EventSource).toBeUndefined();
    expect((scope.navigator as { sendBeacon: () => boolean }).sendBeacon()).toBe(false);
  });
});

/** A worker that answers like llmWorker.ts, without a model. */
class FakeWorker implements WorkerLike {
  onmessage: ((ev: MessageEvent<WorkerReply>) => void) | null = null;
  cached = false;
  sent: WorkerRequest[] = [];
  terminated = false;
  postMessage(req: WorkerRequest) {
    this.sent.push(req);
    if (req.type === "interrupt") return;
    const answer = (value: unknown) =>
      setTimeout(() =>
        this.onmessage?.({
          data: { type: "result", id: req.id, ok: true, value },
        } as MessageEvent<WorkerReply>),
      );
    if (req.type === "check") answer(this.cached);
    else if (req.type === "load") {
      this.onmessage?.({
        data: { type: "progress", progress: 0.5, text: "50%" },
      } as MessageEvent<WorkerReply>);
      this.cached = true;
      answer(true);
    } else if (req.type === "remove") {
      this.cached = false;
      answer(true);
    } else if (req.type === "complete") answer('{"calls":[]}');
    else answer(true);
  }
  terminate() {
    this.terminated = true;
  }
}

describe("LocalLlm lifecycle", () => {
  test("never downloads by itself; download, ready, remove, shutdown", async () => {
    const w = new FakeWorker();
    const llm = new LocalLlm(
      () => w,
      async () => true,
    );
    llm.sync(false, "qwen2.5-0.5b");
    expect(llm.get().status).toBe("off");
    expect(w.sent).toEqual([]);
    llm.sync(true, "qwen2.5-0.5b");
    expect(llm.get().status).toBe("checking");
    await sleep(10);
    expect(llm.get().status).toBe("absent");
    expect(w.sent.map((r) => r.type)).toEqual(["check"]);
    await expect(llm.complete([], null)).rejects.toThrow("not ready");
    await llm.download();
    expect(llm.get().status).toBe("ready");
    expect(w.sent.find((r) => r.type === "load")).toMatchObject({
      modelId: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    });
    expect(await llm.complete([{ role: "user", content: "x" }], null)).toBe('{"calls":[]}');
    await llm.remove();
    expect(llm.get().status).toBe("absent");
    llm.sync(false, "qwen2.5-0.5b");
    expect(llm.get().status).toBe("off");
    expect(w.terminated).toBe(true);
  });

  test("a cached model loads when switched on; no WebGPU = unsupported", async () => {
    const w = new FakeWorker();
    w.cached = true;
    const llm = new LocalLlm(
      () => w,
      async () => true,
    );
    llm.sync(true, "llama-3.2-1b");
    await sleep(10);
    expect(llm.get().status).toBe("ready");
    const noGpu = new LocalLlm(
      () => new FakeWorker(),
      async () => false,
    );
    noGpu.sync(true, "qwen2.5-0.5b");
    await sleep(5);
    expect(noGpu.get().status).toBe("unsupported");
  });
});
