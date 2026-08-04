import type { ProviderConfig } from "@opencode-ai/sdk/v2/client";

export type LocalProviderInstallInput = {
  providerId: string;
  name: string;
  baseURL: string;
  modelId: string;
  modelName: string;
  setDefault: boolean;
  supportsVision: boolean;
  /** Optional API key for remote OpenAI-compatible providers (e.g. DashScope). */
  apiKey?: string;
  /** Use a models.dev-known provider id so OpenCode auto-populates all models. */
  useModelsDev?: boolean;
  /** Live model ids discovered from the connection (declared so all show up). */
  allModels?: string[];
};

type ProviderModelConfig = NonNullable<ProviderConfig["models"]>[string];

export const OLLAMA_PROVIDER_CONFIG = {
  providerId: "ollama",
  name: "Ollama (local)",
  baseURL: "http://localhost:11434/v1",
  defaultModelId: "qwen2.5-coder:7b",
};

/**
 * Alibaba Cloud Model Studio (DashScope) preset. Uses the Models.dev provider
 * ids (`alibaba` international / `alibaba-cn` mainland) so OpenCode
 * auto-populates the FULL DashScope catalog — no curated model list needed.
 * The base URL stays user editable for region/dedicated deployments.
 */
export const MODEL_STUDIO_PRESET = {
  providerId: "alibaba",
  name: "Alibaba Cloud Model Studio",
  defaultBaseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  cnProviderId: "alibaba-cn",
  cnName: "Alibaba (China)",
  cnBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  defaultModelId: "qwen-plus",
} as const;

export const OPENAI_IMAGE_EXTENSION_ID = "openai-image-generation";
export const OPENAI_IMAGE_MODEL = "gpt-image-2";

function readProperty(value: unknown, key: string) {
  if (typeof value !== "object" || value === null) return undefined;
  return Object.getOwnPropertyDescriptor(value, key)?.value;
}

export function parseOllamaVisionCapability(payload: unknown) {
  const capabilities = readProperty(payload, "capabilities");
  if (!Array.isArray(capabilities)) return false;
  return capabilities.some(
    (capability) =>
      typeof capability === "string" && capability.toLowerCase() === "vision",
  );
}

export async function fetchOllamaModelSupportsVision(
  modelId: string,
  baseURL: string,
) {
  try {
    const response = await fetch(
      `${baseURL.replace(/\/v1\/?$/, "")}/api/show`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelId }),
        signal: AbortSignal.timeout(3000),
      },
    );
    if (!response.ok) return false;
    const payload: unknown = await response.json();
    return parseOllamaVisionCapability(payload);
  } catch {
    return false;
  }
}

export function buildLocalProviderModelConfig(
  input: Pick<
    LocalProviderInstallInput,
    "modelId" | "modelName" | "supportsVision"
  >,
): ProviderModelConfig {
  return {
    name: input.modelName.trim() || input.modelId,
    attachment: input.supportsVision,
    modalities: {
      input: input.supportsVision ? ["text", "image"] : ["text"],
      output: ["text"],
    },
  };
}

export function buildLocalProviderConfig(
  input: LocalProviderInstallInput,
): ProviderConfig {
  const modelId = input.modelId.trim();
  return {
    npm: "@ai-sdk/openai-compatible",
    name: input.name,
    options: {
      baseURL: input.baseURL,
      ...(input.apiKey ? { apiKey: input.apiKey } : {}),
    },
    models: { [modelId]: buildLocalProviderModelConfig({ ...input, modelId }) },
  };
}

/**
 * Fetch the live model catalog from an OpenAI-compatible endpoint (DashScope
 * `GET /models`). Returns every model id the connection exposes. Empty on
 * failure so callers can fall back to the models.dev catalog.
 */
export async function fetchDashScopeModels(
  baseURL: string,
  apiKey: string,
): Promise<string[]> {
  const base = baseURL.replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as Record<string, unknown>;
    const list = Array.isArray(data?.data)
      ? (data.data as Record<string, unknown>[])
      : [];
    return list
      .map((m) => (typeof m?.id === "string" ? m.id : ""))
      .filter((id): id is string => id.length > 0);
  } catch {
    return [];
  }
}

/**
 * Config for a models.dev-known provider (e.g. Alibaba/DashScope). Declares
 * every discovered model so the FULL catalog is selectable; when discovery is
 * unavailable it omits `models` and OpenCode falls back to models.dev.
 */
export function buildModelsDevProviderConfig(
  input: Pick<
    LocalProviderInstallInput,
    "providerId" | "name" | "baseURL" | "apiKey" | "allModels"
  >,
): ProviderConfig {
  const allModels = (input.allModels ?? [])
    .map((id) => id.trim())
    .filter(Boolean);
  return {
    npm: "@ai-sdk/openai-compatible",
    name: input.name,
    options: {
      baseURL: input.baseURL,
      ...(input.apiKey ? { apiKey: input.apiKey } : {}),
    },
    ...(allModels.length
      ? {
          models: Object.fromEntries(allModels.map((id) => [id, { name: id }])),
        }
      : {}),
  };
}
