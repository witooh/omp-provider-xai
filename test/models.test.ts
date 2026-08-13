import { describe, expect, it } from "bun:test";
import type { OpenAICompat } from "@oh-my-pi/pi-ai";
import type { ProviderModelConfig } from "@oh-my-pi/pi-coding-agent";
import { xaiOauthModels } from "../src/models.js";

const byId = (id: string) => {
  const model = xaiOauthModels.find((m) => m.id === id);
  if (!model) throw new Error(`missing model: ${id}`);
  return model;
};

/**
 * `ProviderModelConfig["compat"]` is the union of every api's compat shape;
 * these models are all openai-responses, so read them through that member.
 */
const compatOf = (model: ProviderModelConfig): OpenAICompat | undefined => model.compat as OpenAICompat | undefined;

describe("xai-oauth catalog", () => {
  it("registers all nine models with grok-4.6 as the headline", () => {
    // registerProvider replaces the provider's whole catalog, so a short list
    // would delete the other SKUs rather than add one.
    expect(xaiOauthModels).toHaveLength(9);
    expect(xaiOauthModels[0].id).toBe("grok-4.6");
  });

  it("gives grok-4.6 the capabilities the uncurated discovery result loses", () => {
    const grok46 = byId("grok-4.6");

    expect(grok46.name).toBe("Grok 4.6");
    expect(grok46.contextWindow).toBe(500_000);
    expect(grok46.maxTokens).toBe(500_000);
    expect(grok46.reasoning).toBe(true);
    expect(grok46.input).toEqual(["text", "image"]);
  });

  it("keeps the grok-4.6 effort dial alive through compat and thinking", () => {
    const grok46 = byId("grok-4.6");

    // Without the explicit override the compat builder resolves
    // supportsReasoningEffort=false for this id and the thinking block is
    // dropped entirely.
    expect(compatOf(grok46)?.supportsReasoningEffort).toBe(true);
    expect(compatOf(grok46)?.omitReasoningEffort).toBe(false);
    expect(compatOf(grok46)?.reasoningEffortMap).toEqual({ minimal: "low" });

    expect(grok46.thinking?.mode).toBe("effort");
    expect(grok46.thinking?.efforts).toEqual(["minimal", "low", "medium", "high", "xhigh"] as never);
    // xAI's documented ladder has no `minimal`; the map keeps it off the wire.
    expect(grok46.thinking?.effortMap).toEqual({ minimal: "low" });
  });

  it.each([
    ["grok-4.6", "Grok 4.6", 500_000, true, ["text", "image"]],
    ["grok-build", "Grok Build", 512_000, true, ["text", "image"]],
    ["grok-build-0.1", "Grok Build 0.1", 256_000, true, ["text", "image"]],
    ["grok-4.3", "Grok 4.3", 1_000_000, true, ["text", "image"]],
    ["grok-4.5", "Grok 4.5", 500_000, true, ["text", "image"]],
    ["grok-4.20-multi-agent-0309", "Grok 4.20 (Multi-Agent)", 2_000_000, true, ["text"]],
    ["grok-4.20-0309-reasoning", "Grok 4.20 (Reasoning)", 2_000_000, true, ["text", "image"]],
    ["grok-4.20-0309-non-reasoning", "Grok 4.20 (Non-Reasoning)", 2_000_000, false, ["text", "image"]],
    ["grok-composer-2.5-fast", "Grok Composer 2.5 Fast", 200_000, false, ["text"]],
  ] as const)("matches the curated surface for %s", (id, name, contextWindow, reasoning, input) => {
    const model = byId(id);

    expect(model.name).toBe(name);
    expect(model.contextWindow).toBe(contextWindow);
    expect(model.maxTokens).toBe(contextWindow);
    expect(model.reasoning).toBe(reasoning);
    expect(model.input).toEqual([...input]);
  });

  it("prices every entry at zero — SuperGrok is plan-billed", () => {
    for (const model of xaiOauthModels) {
      expect(model.cost).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
    }
  });

  it("carries thinking metadata exactly for the effort-capable models", () => {
    const effortCapable = ["grok-4.6", "grok-4.3", "grok-4.5", "grok-4.20-multi-agent-0309"];

    for (const model of xaiOauthModels) {
      const expectsDial = effortCapable.includes(model.id);
      // `reasoning: true, thinking: undefined` is omp's encoding for "thinks
      // natively, exposes no dial" — the wire rejects reasoning.effort there.
      expect([model.id, model.thinking !== undefined]).toEqual([model.id, expectsDial]);
      expect([model.id, compatOf(model)?.supportsReasoningEffort === true]).toEqual([model.id, expectsDial]);
      if (!expectsDial) expect(model.compat).toBeUndefined();
    }
  });

  it("leaves provider-derived compat keys to the host", () => {
    // buildOpenAIResponsesCompat derives these from provider === "xai-oauth";
    // restating them here would be a second source of truth.
    for (const model of xaiOauthModels) {
      expect(compatOf(model)?.filterReasoningHistory).toBeUndefined();
      expect(compatOf(model)?.includeEncryptedReasoning).toBeUndefined();
      expect(compatOf(model)?.supportsImageDetailOriginal).toBeUndefined();
    }
  });
});
