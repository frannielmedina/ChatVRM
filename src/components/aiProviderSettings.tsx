import React, { useCallback } from "react";
import { AIProviderConfig, AIProvider, AI_PROVIDERS, getProviderMeta, getDefaultModel } from "@/features/chat/aiProviders";
import { Link } from "./link";

type Props = {
  config: AIProviderConfig;
  onChangeConfig: (config: AIProviderConfig) => void;
};

export const AIProviderSettings = ({ config, onChangeConfig }: Props) => {
  const update = useCallback(
    (partial: Partial<AIProviderConfig>) => {
      onChangeConfig({ ...config, ...partial });
    },
    [config, onChangeConfig]
  );

  const handleProviderChange = useCallback(
    (provider: AIProvider) => {
      const meta = getProviderMeta(provider);
      onChangeConfig({
        ...config,
        provider,
        model: getDefaultModel(provider),
        baseUrl: meta.defaultBaseUrl || "",
      });
    },
    [config, onChangeConfig]
  );

  const meta = getProviderMeta(config.provider);

  return (
    <div className="my-40">
      <div className="my-16 typography-20 font-bold">AI Provider</div>

      {/* Provider grid */}
      <div className="grid grid-cols-2 gap-8 mb-16">
        {AI_PROVIDERS.map((p) => (
          <button
            key={p.value}
            onClick={() => handleProviderChange(p.value)}
            className={`p-12 rounded-8 border-2 text-left transition-all ${
              config.provider === p.value
                ? "border-primary bg-primary/10"
                : "border-surface3 bg-surface1 hover:border-primary/50"
            }`}
          >
            <div className="font-bold text-sm">{p.label}</div>
            <div className="text-xs text-text-primary/60 mt-1 leading-tight">
              {p.description}
            </div>
          </button>
        ))}
      </div>

      {/* Provider-specific fields */}
      <div className="p-16 bg-surface1 rounded-8 flex flex-col gap-12">

        {/* API Key */}
        {meta.requiresKey && (
          <div>
            <div className="font-bold mb-4">{meta.label} API Key</div>
            <input
              className="text-ellipsis px-16 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8"
              type="password"
              placeholder={meta.keyPlaceholder || "Your API key"}
              value={config.apiKey || ""}
              onChange={(e) => update({ apiKey: e.target.value })}
            />
            {meta.keyLink && (
              <div className="text-xs text-text-primary/60 mt-4">
                Get your key at{" "}
                <Link url={meta.keyLink} label={meta.keyLinkLabel || meta.keyLink} />
              </div>
            )}
          </div>
        )}

        {/* Base URL (Ollama / LM Studio) */}
        {meta.requiresBaseUrl && (
          <div>
            <div className="font-bold mb-4">Server URL</div>
            <input
              className="text-ellipsis px-16 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8"
              type="text"
              placeholder={meta.defaultBaseUrl || "http://localhost:11434"}
              value={config.baseUrl || ""}
              onChange={(e) => update({ baseUrl: e.target.value })}
            />
            {config.provider === "ollama" && (
              <div className="text-xs text-text-primary/60 mt-4">
                Make sure Ollama is running:{" "}
                <code className="bg-surface3 px-4 rounded">ollama serve</code>
                {" "}and CORS is enabled via{" "}
                <code className="bg-surface3 px-4 rounded">OLLAMA_ORIGINS=*</code>
              </div>
            )}
            {config.provider === "lmstudio" && (
              <div className="text-xs text-text-primary/60 mt-4">
                Start the local server in LM Studio under the{" "}
                <strong>Local Server</strong> tab, then load a model.
              </div>
            )}
          </div>
        )}

        {/* Model selector */}
        <div>
          <div className="font-bold mb-4">Model</div>
          {config.provider === "lmstudio" ? (
            <div className="text-sm text-text-primary/60">
              LM Studio uses whichever model is currently loaded in the app — no selection needed.
            </div>
          ) : (
            <>
              <select
                className="px-16 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8 mb-8"
                value={config.model || meta.models[0]?.value || ""}
                onChange={(e) => update({ model: e.target.value })}
              >
                {meta.models.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              {/* Custom model input */}
              <input
                className="text-ellipsis px-16 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8"
                type="text"
                placeholder="Or type a custom model ID…"
                value={config.model || ""}
                onChange={(e) => update({ model: e.target.value })}
              />
            </>
          )}
        </div>

        {/* No-key notice for local providers */}
        {!meta.requiresKey && (
          <div className="flex items-center gap-8 text-sm text-green-600 bg-green-500/10 border border-green-500/20 rounded-8 px-12 py-8">
            <span>🔒</span>
            <span>No API key required — runs fully locally on your machine.</span>
          </div>
        )}
      </div>
    </div>
  );
};
