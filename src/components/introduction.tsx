import { useState, useCallback } from "react";
import { Link } from "./link";
import { AIProviderConfig, AI_PROVIDERS, getProviderMeta, getDefaultModel, AIProvider } from "@/features/chat/aiProviders";

type Props = {
  aiConfig: AIProviderConfig;
  onChangeAiConfig: (config: AIProviderConfig) => void;
};

export const Introduction = ({ aiConfig, onChangeAiConfig }: Props) => {
  const [opened, setOpened] = useState(false);

  const meta = getProviderMeta(aiConfig.provider);

  const handleProviderChange = useCallback(
    (provider: AIProvider) => {
      const newMeta = getProviderMeta(provider);
      onChangeAiConfig({
        ...aiConfig,
        provider,
        model: getDefaultModel(provider),
        baseUrl: newMeta.defaultBaseUrl || "",
      });
    },
    [aiConfig, onChangeAiConfig]
  );

  const isReady =
    !meta.requiresKey ||
    !!aiConfig.apiKey ||
    aiConfig.provider === "ollama" ||
    aiConfig.provider === "lmstudio";

  return opened ? (
    <div className="absolute z-40 w-full h-full px-24 py-40 bg-black/30 font-M_PLUS_2">
      <div className="mx-auto my-auto max-w-3xl max-h-full p-24 overflow-auto bg-white rounded-16">
        <div className="my-24">
          <div className="my-8 font-bold typography-20 text-secondary">
            About ChatVRM
          </div>
          <div>
            Chat with a 3D character right in your browser using microphone or text input,
            voice synthesis, and multiple TTS providers. Connect to Groq, Mistral, Google AI,
            OpenRouter, Fireworks AI, or run fully locally with Ollama or LM Studio.
          </div>
        </div>

        <div className="my-24">
          <div className="my-8 font-bold typography-20 text-secondary">Usage Notes</div>
          <div>
            Do not intentionally induce discriminatory, violent, or harmful speech.
            When swapping VRM models, follow the model&apos;s license terms.
          </div>
        </div>

        <div className="my-24">
          <div className="my-8 font-bold typography-20 text-secondary">Choose AI Provider</div>

          <div className="grid grid-cols-2 gap-8 my-12">
            {AI_PROVIDERS.map((p) => (
              <button
                key={p.value}
                onClick={() => handleProviderChange(p.value)}
                className={`p-12 rounded-8 border-2 text-left transition-all ${
                  aiConfig.provider === p.value
                    ? "border-secondary bg-secondary/10"
                    : "border-surface3 bg-surface1 hover:border-secondary/50"
                }`}
              >
                <div className="font-bold text-sm">{p.label}</div>
                <div className="text-xs text-text-primary/60 mt-1 leading-tight">
                  {p.description}
                </div>
              </button>
            ))}
          </div>

          {meta.requiresKey && (
            <div className="mt-12">
              <div className="font-bold mb-4">{meta.label} API Key</div>
              <input
                type="password"
                placeholder={meta.keyPlaceholder || "Your API key"}
                value={aiConfig.apiKey || ""}
                onChange={(e) => onChangeAiConfig({ ...aiConfig, apiKey: e.target.value })}
                className="my-4 px-16 py-8 w-full h-40 bg-surface3 hover:bg-surface3-hover rounded-4 text-ellipsis"
              />
              {meta.keyLink && (
                <div className="mt-4 text-sm text-text-primary/60">
                  Get your key at{" "}
                  <Link url={meta.keyLink} label={meta.keyLinkLabel || meta.keyLink} />.
                  Keys are used directly in your browser and never stored on any server.
                </div>
              )}
            </div>
          )}

          {(aiConfig.provider === "ollama" || aiConfig.provider === "lmstudio") && (
            <div className="mt-12 p-12 bg-green-500/10 border border-green-500/20 rounded-8 text-sm text-green-700">
              🔒 No API key needed — {meta.label} runs entirely on your machine.
              {aiConfig.provider === "ollama" && (
                <span> Make sure <code className="bg-surface3 px-4 rounded">ollama serve</code> is running.</span>
              )}
              {aiConfig.provider === "lmstudio" && (
                <span> Make sure the LM Studio local server is started with a model loaded.</span>
              )}
            </div>
          )}
        </div>

        <div className="my-24">
          <button
            onClick={() => setOpened(true)}
            className="font-bold bg-secondary hover:bg-secondary-hover active:bg-secondary-press disabled:bg-secondary-disabled text-white px-24 py-8 rounded-oval"
          >
            {isReady ? "Start" : "Continue without API Key"}
          </button>
        </div>
      </div>
    </div>
  ) : null;
};
