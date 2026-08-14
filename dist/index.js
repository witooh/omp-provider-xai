// src/models.ts
var XAI_OAUTH_BASE_URL = "https://api.x.ai/v1";
var ZERO_COST = Object.freeze({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
var XAI_EFFORT_MAP = { minimal: "low" };
var XAI_EFFORTS = ["minimal", "low", "medium", "high", "xhigh"];
var effortThinking = () => ({
  mode: "effort",
  efforts: XAI_EFFORTS,
  effortMap: { ...XAI_EFFORT_MAP }
});
var effortCompat = () => ({
  supportsReasoningEffort: true,
  omitReasoningEffort: false,
  reasoningEffortMap: { ...XAI_EFFORT_MAP }
});
var xaiOauthModels = [
  {
    // The model omp 17.2.15 has no curated entry for. Context window, vision,
    // and the low/medium/high/xhigh ladder come from docs.x.ai/developers/
    // models/grok-4.6 and .../model-capabilities/text/reasoning.
    id: "grok-4.6",
    name: "Grok 4.6",
    reasoning: true,
    input: ["text", "image"],
    contextWindow: 5e5,
    maxTokens: 5e5,
    cost: ZERO_COST,
    thinking: effortThinking(),
    compat: effortCompat()
  },
  {
    // Reasons natively but rejects the wire `reasoning.effort` param (HTTP 400).
    // `reasoning: true` with no `thinking` is omp's encoding for that.
    id: "grok-build",
    name: "Grok Build",
    reasoning: true,
    input: ["text", "image"],
    contextWindow: 512e3,
    maxTokens: 512e3,
    cost: ZERO_COST
  },
  {
    id: "grok-build-0.1",
    name: "Grok Build 0.1",
    reasoning: true,
    input: ["text", "image"],
    contextWindow: 256e3,
    maxTokens: 256e3,
    cost: ZERO_COST
  },
  {
    id: "grok-4.3",
    name: "Grok 4.3",
    reasoning: true,
    input: ["text", "image"],
    contextWindow: 1e6,
    maxTokens: 1e6,
    cost: ZERO_COST,
    thinking: effortThinking(),
    compat: effortCompat()
  },
  {
    id: "grok-4.5",
    name: "Grok 4.5",
    reasoning: true,
    input: ["text", "image"],
    contextWindow: 5e5,
    maxTokens: 5e5,
    cost: ZERO_COST,
    thinking: effortThinking(),
    compat: effortCompat()
  },
  {
    // Text-only per the bundled catalog.
    id: "grok-4.20-multi-agent-0309",
    name: "Grok 4.20 (Multi-Agent)",
    reasoning: true,
    input: ["text"],
    contextWindow: 2e6,
    maxTokens: 2e6,
    cost: ZERO_COST,
    thinking: effortThinking(),
    compat: effortCompat()
  },
  {
    id: "grok-4.20-0309-reasoning",
    name: "Grok 4.20 (Reasoning)",
    reasoning: true,
    input: ["text", "image"],
    contextWindow: 2e6,
    maxTokens: 2e6,
    cost: ZERO_COST
  },
  {
    id: "grok-4.20-0309-non-reasoning",
    name: "Grok 4.20 (Non-Reasoning)",
    reasoning: false,
    input: ["text", "image"],
    contextWindow: 2e6,
    maxTokens: 2e6,
    cost: ZERO_COST
  },
  {
    // Cursor's "Composer 2.5 Fast" exposed via SuperGrok.
    id: "grok-composer-2.5-fast",
    name: "Grok Composer 2.5 Fast",
    reasoning: false,
    input: ["text"],
    contextWindow: 2e5,
    maxTokens: 2e5,
    cost: ZERO_COST
  }
];

// src/oauth.ts
import { getProviderDefinition } from "@oh-my-pi/pi-ai";
var XAI_OAUTH_PROVIDER_ID = "xai-oauth";
function builtinXaiOauth() {
  const def = getProviderDefinition(XAI_OAUTH_PROVIDER_ID);
  if (!def?.login || !def.refreshToken) {
    throw new Error(
      "omp-provider-xai: this omp build has no built-in xai-oauth login/refresh to delegate to; the extension cannot register without breaking SuperGrok authentication."
    );
  }
  return { name: def.name, login: def.login, refreshToken: def.refreshToken };
}
function xaiOauthConfig() {
  const def = builtinXaiOauth();
  return {
    // Second row in the /login list (getOAuthProviders concatenates built-ins
    // and custom providers without de-duplicating); label it so the duplicate
    // is not confusing. Both rows drive the same stored credential.
    name: `${def.name} [grok-4.6 catalog]`,
    login: (callbacks) => def.login(callbacks),
    refreshToken: (credentials) => def.refreshToken(credentials),
    // Matches the built-in path: xai-oauth is not in getOAuthApiKey's
    // needsStructuredApiKey list, so that path also yields the raw access token.
    getApiKey: (credentials) => credentials.access
  };
}

// src/session-bind.ts
var EFFORT_SUFFIX = {
  minimal: true,
  low: true,
  medium: true,
  high: true,
  xhigh: true,
  max: true,
  off: true,
  auto: true
};
function configuredThinkingLevel(pi) {
  const settings = pi.pi?.settings;
  const role = settings?.getModelRole?.("default");
  if (typeof role !== "string") return void 0;
  const colon = role.lastIndexOf(":");
  if (colon < 0) return void 0;
  const suffix = role.slice(colon + 1);
  return EFFORT_SUFFIX[suffix] ? suffix : void 0;
}
function lastSessionThinkingLevel(ctx) {
  const entries = ctx.sessionManager?.getEntries?.() ?? [];
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry?.type !== "thinking_level_change") continue;
    const configured = "configured" in entry ? entry.configured : void 0;
    const level = typeof configured === "string" && configured.length > 0 ? configured : entry.thinkingLevel;
    if (typeof level === "string" && (EFFORT_SUFFIX[level] || level === "inherit")) return level;
  }
  return void 0;
}
async function rebindStaleXaiModel(pi, ctx) {
  const current = ctx.model;
  if (!current || current.provider !== "xai-oauth") return;
  if (Array.isArray(current.thinking?.efforts) && current.thinking.efforts.length > 0) return;
  const corrected = ctx.modelRegistry.find(current.provider, current.id);
  if (!corrected || !Array.isArray(corrected.thinking?.efforts) || corrected.thinking.efforts.length === 0) return;
  const existing = pi.getThinkingLevel();
  const intended = (typeof existing === "string" && existing.length > 0 ? existing : void 0) ?? lastSessionThinkingLevel(ctx) ?? configuredThinkingLevel(pi);
  const ok = await pi.setModel(corrected);
  if (!ok) return;
  if (intended) pi.setThinkingLevel(intended);
}

// src/index.ts
function index_default(pi) {
  pi.registerProvider("xai-oauth", {
    baseUrl: XAI_OAUTH_BASE_URL,
    api: "openai-responses",
    models: xaiOauthModels,
    oauth: xaiOauthConfig()
  });
  pi.on("session_start", (_event, ctx) => rebindStaleXaiModel(pi, ctx));
}
export {
  XAI_OAUTH_BASE_URL,
  index_default as default,
  xaiOauthModels
};
