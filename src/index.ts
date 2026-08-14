import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { XAI_OAUTH_BASE_URL, xaiOauthModels } from "./models.js";
import { xaiOauthConfig } from "./oauth.js";
import { rebindStaleXaiModel } from "./session-bind.js";

export { XAI_OAUTH_BASE_URL, xaiOauthModels } from "./models.js";

/**
 * Registers under the built-in provider id on purpose: same id means the stored
 * SuperGrok credential is reused with no second login, one entry per model in
 * the picker, and `/usage` untouched (pi-ai's SuperGrok billing special case is
 * keyed on the provider id). Runtime overlays are merged last in every rebuild
 * path, so these corrected entries also win over anything discovery returns.
 *
 * No `streamSimple` (openai-responses is a built-in api) and no
 * `fetchDynamicModels` — a second one under this id would collide with the
 * built-in xai-oauth model manager over the same `model_cache` row.
 */
export default function (pi: ExtensionAPI) {
  pi.registerProvider("xai-oauth", {
    baseUrl: XAI_OAUTH_BASE_URL,
    api: "openai-responses",
    models: xaiOauthModels,
    oauth: xaiOauthConfig(),
  });

  // Session start binds the default model before this overlay is visible on the
  // live session object. Rebind so grok-4.6 keeps the effort dial.
  pi.on("session_start", (_event, ctx) => rebindStaleXaiModel(pi, ctx));
}
