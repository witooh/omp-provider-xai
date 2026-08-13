import { describe, expect, it, mock } from "bun:test";
import type { ExtensionAPI, ProviderConfig } from "@oh-my-pi/pi-coding-agent";
import registerExtension from "../src/index.js";
import { xaiOauthModels } from "../src/models.js";

const register = () => {
  const registerProvider = mock((_name: string, _config: ProviderConfig) => {});
  const pi = {
    registerProvider,
    registerCommand: mock(() => {}),
    on: mock(() => {}),
  } as unknown as ExtensionAPI;

  registerExtension(pi);

  const [name, config] = registerProvider.mock.calls[0];
  return { registerProvider, name, config };
};

describe("extension registration", () => {
  it("exports a default function", () => {
    expect(typeof registerExtension).toBe("function");
  });

  it("registers the built-in xai-oauth provider id exactly once", () => {
    const { registerProvider, name } = register();

    expect(registerProvider).toHaveBeenCalledTimes(1);
    // Same id as the built-in: reuses the stored credential, keeps /usage.
    expect(name).toBe("xai-oauth");
  });

  it("registers the corrected catalog on the responses api", () => {
    const { config } = register();

    expect(config.api).toBe("openai-responses");
    expect(config.baseUrl).toBe("https://api.x.ai/v1");
    expect(config.models).toBe(xaiOauthModels);
  });

  it("registers no transport or discovery hooks", () => {
    const { config } = register();

    // A second fetchDynamicModels under this id would fight the built-in
    // xai-oauth model manager over the same model_cache row.
    expect(config.fetchDynamicModels).toBeUndefined();
    expect(config.streamSimple).toBeUndefined();
    // An apiKey here would install a bogus config credential for xai-oauth.
    expect(config.apiKey).toBeUndefined();
  });

  it("delegates oauth to the host implementation", () => {
    const { config } = register();

    expect(typeof config.oauth?.login).toBe("function");
    expect(typeof config.oauth?.refreshToken).toBe("function");
    expect(config.oauth?.name).toEndWith("[grok-4.6 catalog]");
    expect(config.oauth?.getApiKey?.({ access: "tok-1", refresh: "r", expires: 0 })).toBe("tok-1");
  });
});
