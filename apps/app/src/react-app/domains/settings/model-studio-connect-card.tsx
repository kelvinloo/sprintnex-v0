/** @jsxImportSource react */
import { useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProviderIcon } from "../../design-system/provider-icon";
import { TextInput } from "../../design-system/text-input";
import { SettingsNotice } from "./settings-section";
import {
  fetchDashScopeModels,
  MODEL_STUDIO_PRESET,
  type LocalProviderInstallInput,
} from "./openai-image-extension";

export type ModelStudioConnectCardProps = {
  connectedProviders: Array<{ id: string }>;
  onConnect: (input: LocalProviderInstallInput) => Promise<void>;
  disabled?: boolean;
};

/**
 * Reusable Alibaba Cloud Model Studio (DashScope) connect card. Used on the AI
 * settings page and the Sprintnex settings > Providers page. Detects an
 * existing connection (alibaba / alibaba-cn) and hides the form; at connect
 * time it discovers the account's full model catalog so every model is
 * selectable (falls back to Models.dev when discovery fails).
 */
export function ModelStudioConnectCard(props: ModelStudioConnectCardProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [region, setRegion] = useState<"intl" | "cn">("intl");
  const [baseUrl, setBaseUrl] = useState<string>(
    MODEL_STUDIO_PRESET.defaultBaseUrl,
  );
  const [apiKey, setApiKey] = useState("");

  const connected = props.connectedProviders.some(
    (provider) =>
      provider.id === MODEL_STUDIO_PRESET.providerId ||
      provider.id === MODEL_STUDIO_PRESET.cnProviderId,
  );

  const changeRegion = (next: "intl" | "cn") => {
    setRegion(next);
    setBaseUrl(
      next === "cn"
        ? MODEL_STUDIO_PRESET.cnBaseUrl
        : MODEL_STUDIO_PRESET.defaultBaseUrl,
    );
  };

  const handleConnect = async () => {
    const trimmedBaseUrl = baseUrl.trim();
    const trimmedApiKey = apiKey.trim();
    if (!trimmedBaseUrl) {
      setError("Base URL is required.");
      return;
    }
    if (!trimmedApiKey) {
      setError("API key is required.");
      return;
    }
    const cn = region === "cn";
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      // Discover the account's full model catalog from the connection so every
      // available model is selectable (falls back to Models.dev when empty).
      const allModels = await fetchDashScopeModels(
        trimmedBaseUrl,
        trimmedApiKey,
      );
      await props.onConnect({
        providerId: cn
          ? MODEL_STUDIO_PRESET.cnProviderId
          : MODEL_STUDIO_PRESET.providerId,
        name: cn ? MODEL_STUDIO_PRESET.cnName : MODEL_STUDIO_PRESET.name,
        baseURL: trimmedBaseUrl.replace(/\/+$/, ""),
        modelId: MODEL_STUDIO_PRESET.defaultModelId,
        modelName: MODEL_STUDIO_PRESET.defaultModelId,
        setDefault: true,
        supportsVision: false,
        apiKey: trimmedApiKey,
        useModelsDev: true,
        allModels,
      });
      setStatus(
        allModels.length > 0
          ? `Connected. ${allModels.length} models are now selectable in the model picker.`
          : "Connected. Model catalog loads from Models.dev.",
      );
    } catch (connectError) {
      setError(
        connectError instanceof Error
          ? connectError.message
          : "Failed to connect Model Studio.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-dls-border bg-dls-surface px-4 py-4">
      <div className="mb-3 flex items-center gap-3">
        <ProviderIcon
          providerId="alibaba"
          size={20}
          className="text-dls-text"
        />
        <div className="min-w-0">
          <div className="text-sm font-medium text-dls-text">
            Alibaba Cloud Model Studio
          </div>
          <div className="text-xs text-muted-foreground">
            Qwen models via the OpenAI-compatible DashScope endpoint.
          </div>
        </div>
      </div>
      {connected ? (
        <div className="flex items-center gap-2 rounded-lg border border-green-6 bg-green-3/30 px-3 py-2 text-sm text-green-11">
          <CheckCircle2 className="size-4 shrink-0" />
          Already connected — all models are available in the model picker.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="block">
            <div className="mb-1 text-xs font-medium text-dls-secondary">
              Region
            </div>
            <select
              value={region}
              onChange={(event) =>
                changeRegion(event.currentTarget.value === "cn" ? "cn" : "intl")
              }
              className="w-full rounded-lg border border-dls-border bg-dls-surface px-3 py-2 text-sm text-dls-text shadow-sm focus:outline-none focus:ring-2 focus:ring-[rgba(var(--dls-accent-rgb),0.2)]"
            >
              <option value="intl">International</option>
              <option value="cn">China (mainland)</option>
            </select>
          </label>
          <TextInput
            label="Base URL"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.currentTarget.value)}
            placeholder="https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
          />
          <TextInput
            label="API key"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(event) => setApiKey(event.currentTarget.value)}
            placeholder="sk-..."
          />
          {error ? <SettingsNotice tone="error">{error}</SettingsNotice> : null}
          {status ? <SettingsNotice>{status}</SettingsNotice> : null}
          <div className="flex justify-end">
            <Button
              onClick={() => void handleConnect()}
              disabled={props.disabled || busy}
            >
              {busy ? "Connecting…" : "Connect Model Studio"}
              {!busy ? <ArrowRight className="ml-1.5 size-3.5" /> : null}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
