import { describe, expect, it, mock } from "bun:test";
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import registerExtension from "../src/index.js";

const staleGrok46 = {
  provider: "xai-oauth",
  id: "grok-4.6",
  reasoning: true,
  thinking: undefined,
};

const correctedGrok46 = {
  provider: "xai-oauth",
  id: "grok-4.6",
  reasoning: true,
  thinking: {
    mode: "effort" as const,
    efforts: ["minimal", "low", "medium", "high", "xhigh"],
  },
};

function boot(opts: {
  setModel?: (model: unknown) => Promise<boolean>;
  setThinkingLevel?: (level: string) => void;
  getThinkingLevel?: () => string | undefined;
  getModelRole?: (role: string) => string | undefined;
  getSetting?: (path: string) => unknown;
}) {
  const handlers: Record<string, (event: unknown, ctx: ExtensionContext) => unknown> = {};
  const setModel = mock(opts.setModel ?? (async () => true));
  const setThinkingLevel = mock(opts.setThinkingLevel ?? ((_level: string) => {}));
  const registerProvider = mock(() => {});

  registerExtension({
    registerProvider,
    registerCommand: mock(() => {}),
    on: (event: string, handler: (event: unknown, ctx: ExtensionContext) => unknown) => {
      handlers[event] = handler;
    },
    setModel,
    setThinkingLevel,
    getThinkingLevel: opts.getThinkingLevel ?? (() => undefined),
    pi: {
      settings: {
        getModelRole: opts.getModelRole ?? (() => "xai-oauth/grok-4.6:xhigh"),
        get: opts.getSetting ?? ((path: string) => (path === "defaultThinkingLevel" ? "xhigh" : undefined)),
      },
    },
  } as unknown as ExtensionAPI);

  return { handlers, setModel, setThinkingLevel };
}

describe("session_start rebind", () => {
  it("rebinds a stale grok-4.6 and applies the configured effort", async () => {
    const { handlers, setModel, setThinkingLevel } = boot({});
    const handler = handlers.session_start;

    expect(handler).toBeDefined();

    await handler?.({}, {
      model: staleGrok46,
      modelRegistry: {
        find: () => correctedGrok46,
      },
    } as unknown as ExtensionContext);

    expect(setModel).toHaveBeenCalledTimes(1);
    expect(setModel.mock.calls[0][0]).toBe(correctedGrok46);
    expect(setThinkingLevel).toHaveBeenCalledWith("xhigh");
  });

  it("does not rebind when the session model already has an effort ladder", async () => {
    const { handlers, setModel, setThinkingLevel } = boot({});
    const handler = handlers.session_start;

    await handler?.({}, {
      model: correctedGrok46,
      modelRegistry: { find: () => correctedGrok46 },
    } as unknown as ExtensionContext);

    expect(setModel).not.toHaveBeenCalled();
    expect(setThinkingLevel).not.toHaveBeenCalled();
  });

  it("does not rebind a non-xai-oauth model", async () => {
    const { handlers, setModel } = boot({});
    const handler = handlers.session_start;

    await handler?.({}, {
      model: { provider: "kiro", id: "claude-opus-5", reasoning: true },
      modelRegistry: { find: () => correctedGrok46 },
    } as unknown as ExtensionContext);

    expect(setModel).not.toHaveBeenCalled();
  });

  it("does not apply schema-default high when the role has no effort suffix", async () => {
    const { handlers, setThinkingLevel } = boot({
      getModelRole: () => "xai-oauth/grok-4.6",
      getSetting: (path) => (path === "defaultThinkingLevel" ? "high" : undefined),
    });
    const handler = handlers.session_start;

    await handler?.({}, {
      model: staleGrok46,
      modelRegistry: { find: () => correctedGrok46 },
      sessionManager: { getEntries: () => [] },
    } as unknown as ExtensionContext);

    expect(setThinkingLevel).not.toHaveBeenCalled();
  });

  it("reapplies a session thinking_level_change instead of the role suffix", async () => {
    const { handlers, setThinkingLevel } = boot({});
    const handler = handlers.session_start;

    await handler?.({}, {
      model: staleGrok46,
      modelRegistry: { find: () => correctedGrok46 },
      sessionManager: {
        getEntries: () => [{ type: "thinking_level_change", thinkingLevel: "medium", configured: "medium" }],
      },
    } as unknown as ExtensionContext);

    expect(setThinkingLevel).toHaveBeenCalledWith("medium");
  });

  it("reapplies an already-resolved session level instead of the role suffix", async () => {
    const { handlers, setThinkingLevel } = boot({
      getThinkingLevel: () => "low",
    });
    const handler = handlers.session_start;

    await handler?.({}, {
      model: staleGrok46,
      modelRegistry: { find: () => correctedGrok46 },
      sessionManager: { getEntries: () => [] },
    } as unknown as ExtensionContext);

    expect(setThinkingLevel).toHaveBeenCalledWith("low");
  });
});
