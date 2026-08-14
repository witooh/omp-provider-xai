import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";

const EFFORT_SUFFIX: Record<string, true> = {
  minimal: true,
  low: true,
  medium: true,
  high: true,
  xhigh: true,
  max: true,
  off: true,
  auto: true,
};

type SettingsLike = {
  getModelRole?: (role: string) => string | undefined;
};

/** Role suffix (`xai-oauth/grok-4.6:xhigh`) only — never schema-default `high`. */
export function configuredThinkingLevel(pi: ExtensionAPI): string | undefined {
  const settings = (pi as ExtensionAPI & { pi?: { settings?: SettingsLike } }).pi?.settings;
  const role = settings?.getModelRole?.("default");
  if (typeof role !== "string") return undefined;

  const colon = role.lastIndexOf(":");
  if (colon < 0) return undefined;
  const suffix = role.slice(colon + 1);
  return EFFORT_SUFFIX[suffix] ? suffix : undefined;
}

function lastSessionThinkingLevel(ctx: ExtensionContext): string | undefined {
  const entries = ctx.sessionManager?.getEntries?.() ?? [];
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry?.type !== "thinking_level_change") continue;
    const configured = "configured" in entry ? entry.configured : undefined;
    const level = typeof configured === "string" && configured.length > 0 ? configured : entry.thinkingLevel;
    if (typeof level === "string" && (EFFORT_SUFFIX[level] || level === "inherit")) return level;
  }
  return undefined;
}

/**
 * Session start binds the default model before this extension's overlay lands,
 * so `xai-oauth/grok-4.6` can sit on the session with `thinking: undefined`
 * even though the registry already has the corrected ladder. Rebind + restore
 * the effort the session already chose, or the role suffix if this is a fresh start.
 */
export async function rebindStaleXaiModel(pi: ExtensionAPI, ctx: ExtensionContext): Promise<void> {
  const current = ctx.model;
  if (!current || current.provider !== "xai-oauth") return;
  if (Array.isArray(current.thinking?.efforts) && current.thinking.efforts.length > 0) return;

  const corrected = ctx.modelRegistry.find(current.provider, current.id);
  if (!corrected || !Array.isArray(corrected.thinking?.efforts) || corrected.thinking.efforts.length === 0) return;

  const existing = pi.getThinkingLevel();
  const intended =
    (typeof existing === "string" && existing.length > 0 ? existing : undefined) ??
    lastSessionThinkingLevel(ctx) ??
    configuredThinkingLevel(pi);

  const ok = await pi.setModel(corrected);
  if (!ok) return;

  if (intended) pi.setThinkingLevel(intended as Parameters<ExtensionAPI["setThinkingLevel"]>[0]);
}
