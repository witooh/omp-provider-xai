// Corrected model catalog for omp's built-in `xai-oauth` provider (SuperGrok /
// X Premium+). omp 17.2.15 curates eight Grok SKUs but not `grok-4.6`, so the
// uncurated discovery result lands with a fallback context window, no vision,
// no reasoning, and no effort dial. Registering the provider replaces its whole
// catalog (model-registry.ts:1982-2029 filters out every existing model of the
// provider and pushes only these overlays), so all nine entries live here — the
// eight curated ones are reproduced verbatim from
// pi-catalog/src/provider-models/openai-compat.ts:1218-1261.

import type { ProviderModelConfig } from "@oh-my-pi/pi-coding-agent";

export const XAI_OAUTH_BASE_URL = "https://api.x.ai/v1";

type Thinking = NonNullable<ProviderModelConfig["thinking"]>;

/** SuperGrok is plan-billed; xAI's OAuth surface reports no per-token price. */
const ZERO_COST = Object.freeze({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });

/**
 * xAI's wire ladder is low/medium/high/xhigh — it has no `minimal`, so omp's
 * bottom rung maps down to `low` (the same clamp pi-catalog applies to the
 * curated Grok models via XAI_REASONING_EFFORT_MAP).
 */
const XAI_EFFORT_MAP = { minimal: "low" } as const;
const XAI_EFFORTS = ["minimal", "low", "medium", "high", "xhigh"] as const;

/**
 * omp's `Effort` is an ambient const enum and cannot be referenced as a value
 * from a plugin bundle; its string values are the contract. Same workaround as
 * omp-provider-kiro/src/effort.ts.
 */
const effortThinking = (): Thinking => ({
  mode: "effort",
  efforts: XAI_EFFORTS as unknown as Thinking["efforts"],
  effortMap: { ...XAI_EFFORT_MAP },
});

/**
 * Models that accept the wire `reasoning.effort` dial.
 *
 * Load-bearing for `grok-4.6`: its id misses `GROK_EFFORT_CAPABLE_PREFIXES`, so
 * `buildOpenAIResponsesCompat` resolves `supportsReasoningEffort: false`
 * (compat/openai.ts:696), auto-flips `omitReasoningEffort` to true (:771-773),
 * and `resolveModelThinking` then discards the whole thinking block
 * (model-thinking.ts:143). `applyCompatOverrides` (:767) lets these win.
 */
const effortCompat = (): ProviderModelConfig["compat"] => ({
  supportsReasoningEffort: true,
  omitReasoningEffort: false,
  reasoningEffortMap: { ...XAI_EFFORT_MAP },
});

/**
 * `filterReasoningHistory`, `includeEncryptedReasoning`,
 * `supportsImageDetailOriginal`, and `promptCacheSessionHeader` are deliberately
 * absent: the compat builder derives all four from `provider === "xai-oauth"`
 * (compat/openai.ts:709, 718, 719, 761) and the provider id is unchanged.
 *
 * `maxTokens` mirrors `contextWindow` on every entry — this surface publishes no
 * per-request output cap, and the Responses wire still clamps to 64 000.
 */
export const xaiOauthModels: ProviderModelConfig[] = [
  {
    // The model omp 17.2.15 has no curated entry for. Context window, vision,
    // and the low/medium/high/xhigh ladder come from docs.x.ai/developers/
    // models/grok-4.6 and .../model-capabilities/text/reasoning.
    id: "grok-4.6",
    name: "Grok 4.6",
    reasoning: true,
    input: ["text", "image"],
    contextWindow: 500_000,
    maxTokens: 500_000,
    cost: ZERO_COST,
    thinking: effortThinking(),
    compat: effortCompat(),
  },
  {
    // Reasons natively but rejects the wire `reasoning.effort` param (HTTP 400).
    // `reasoning: true` with no `thinking` is omp's encoding for that.
    id: "grok-build",
    name: "Grok Build",
    reasoning: true,
    input: ["text", "image"],
    contextWindow: 512_000,
    maxTokens: 512_000,
    cost: ZERO_COST,
  },
  {
    id: "grok-build-0.1",
    name: "Grok Build 0.1",
    reasoning: true,
    input: ["text", "image"],
    contextWindow: 256_000,
    maxTokens: 256_000,
    cost: ZERO_COST,
  },
  {
    id: "grok-4.3",
    name: "Grok 4.3",
    reasoning: true,
    input: ["text", "image"],
    contextWindow: 1_000_000,
    maxTokens: 1_000_000,
    cost: ZERO_COST,
    thinking: effortThinking(),
    compat: effortCompat(),
  },
  {
    id: "grok-4.5",
    name: "Grok 4.5",
    reasoning: true,
    input: ["text", "image"],
    contextWindow: 500_000,
    maxTokens: 500_000,
    cost: ZERO_COST,
    thinking: effortThinking(),
    compat: effortCompat(),
  },
  {
    // Text-only per the bundled catalog.
    id: "grok-4.20-multi-agent-0309",
    name: "Grok 4.20 (Multi-Agent)",
    reasoning: true,
    input: ["text"],
    contextWindow: 2_000_000,
    maxTokens: 2_000_000,
    cost: ZERO_COST,
    thinking: effortThinking(),
    compat: effortCompat(),
  },
  {
    id: "grok-4.20-0309-reasoning",
    name: "Grok 4.20 (Reasoning)",
    reasoning: true,
    input: ["text", "image"],
    contextWindow: 2_000_000,
    maxTokens: 2_000_000,
    cost: ZERO_COST,
  },
  {
    id: "grok-4.20-0309-non-reasoning",
    name: "Grok 4.20 (Non-Reasoning)",
    reasoning: false,
    input: ["text", "image"],
    contextWindow: 2_000_000,
    maxTokens: 2_000_000,
    cost: ZERO_COST,
  },
  {
    // Cursor's "Composer 2.5 Fast" exposed via SuperGrok.
    id: "grok-composer-2.5-fast",
    name: "Grok Composer 2.5 Fast",
    reasoning: false,
    input: ["text"],
    contextWindow: 200_000,
    maxTokens: 200_000,
    cost: ZERO_COST,
  },
];
