// Registering models under `xai-oauth` requires an `oauth` block:
// validateProviderConfiguration rejects a runtime registration that defines
// models without `apiKey` or `oauth` (models-config.ts:66-76), and an `apiKey`
// would install a bogus config credential. Registering `oauth` also means this
// extension owns `xai-oauth` token refresh at runtime — pi-ai's auth-storage
// prefers a custom provider over the built-in in both refresh paths — so the
// implementation must be omp's own, not a re-port of the device-code flow.

import type { OAuthCredentials, OAuthLoginCallbacks } from "@oh-my-pi/pi-ai";
import { getProviderDefinition } from "@oh-my-pi/pi-ai";

const XAI_OAUTH_PROVIDER_ID = "xai-oauth";

/**
 * omp's built-in xai-oauth definition (pi-ai/src/registry/xai-oauth.ts). Reused
 * rather than ported so login/refresh stay bit-identical to the host's own
 * implementation across omp upgrades.
 */
function builtinXaiOauth() {
  const def = getProviderDefinition(XAI_OAUTH_PROVIDER_ID);
  if (!def?.login || !def.refreshToken) {
    throw new Error(
      "omp-provider-xai: this omp build has no built-in xai-oauth login/refresh to delegate to; " +
        "the extension cannot register without breaking SuperGrok authentication.",
    );
  }
  return { name: def.name, login: def.login, refreshToken: def.refreshToken };
}

export function xaiOauthConfig() {
  const def = builtinXaiOauth();
  return {
    // Second row in the /login list (getOAuthProviders concatenates built-ins
    // and custom providers without de-duplicating); label it so the duplicate
    // is not confusing. Both rows drive the same stored credential.
    name: `${def.name} [grok-4.6 catalog]`,
    login: (callbacks: OAuthLoginCallbacks) => def.login(callbacks),
    refreshToken: (credentials: OAuthCredentials) => def.refreshToken(credentials),
    // Matches the built-in path: xai-oauth is not in getOAuthApiKey's
    // needsStructuredApiKey list, so that path also yields the raw access token.
    getApiKey: (credentials: OAuthCredentials) => credentials.access,
  };
}
