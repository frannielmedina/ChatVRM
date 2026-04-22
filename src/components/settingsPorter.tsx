import React, { useCallback, useRef, useState } from "react";
import {
  buildSnapshot,
  downloadSettings,
  loadSettingsFromFile,
  SettingsSnapshot,
} from "@/features/settings/settingsPorter";
import { AIProviderConfig } from "@/features/chat/aiProviders";
import { TTSConfig } from "@/features/tts/ttsConfig";
import { BackgroundConfig } from "@/features/background/backgroundConfig";
import { KoeiroParam } from "@/features/constants/koeiroParam";

type Props = {
  // Current state (for saving)
  systemPrompt: string;
  aiConfig: AIProviderConfig;
  ttsConfig: TTSConfig;
  koeiroParam: KoeiroParam;
  backgroundConfig: BackgroundConfig;

  // Callbacks (for loading)
  onLoadSettings: (snapshot: SettingsSnapshot) => void;
};

type Status =
  | { type: "idle" }
  | { type: "saved"; filename: string }
  | { type: "loaded"; savedAt: string }
  | { type: "error"; message: string };

export const SettingsPorter = ({
  systemPrompt,
  aiConfig,
  ttsConfig,
  koeiroParam,
  backgroundConfig,
  onLoadSettings,
}: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingSnapshot, setPendingSnapshot] = useState<SettingsSnapshot | null>(null);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    const snapshot = buildSnapshot({
      systemPrompt,
      aiConfig,
      ttsConfig,
      koeiroParam,
      backgroundConfig,
    });
    const filename = `chatvrm-settings-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[T:]/g, "-")}.json`;
    downloadSettings(snapshot, filename);
    setStatus({ type: "saved", filename });
    setTimeout(() => setStatus({ type: "idle" }), 4000);
  }, [systemPrompt, aiConfig, ttsConfig, koeiroParam, backgroundConfig]);

  // ── Load ──────────────────────────────────────────────────────────────────
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;

      const result = await loadSettingsFromFile(file);
      if (!result.ok) {
        setStatus({ type: "error", message: result.error });
        setTimeout(() => setStatus({ type: "idle" }), 5000);
        return;
      }

      // Ask for confirmation before overwriting
      setPendingSnapshot(result.snapshot);
      setShowConfirm(true);
    },
    []
  );

  const handleConfirmLoad = useCallback(() => {
    if (!pendingSnapshot) return;
    onLoadSettings(pendingSnapshot);
    setShowConfirm(false);
    setStatus({
      type: "loaded",
      savedAt: pendingSnapshot._savedAt
        ? new Date(pendingSnapshot._savedAt).toLocaleString()
        : "unknown date",
    });
    setTimeout(() => setStatus({ type: "idle" }), 5000);
    setPendingSnapshot(null);
  }, [pendingSnapshot, onLoadSettings]);

  const handleCancelLoad = useCallback(() => {
    setShowConfirm(false);
    setPendingSnapshot(null);
  }, []);

  // ── What's included notice ────────────────────────────────────────────────
  const providerLabel = aiConfig.provider.charAt(0).toUpperCase() + aiConfig.provider.slice(1);
  const ttsLabel = ttsConfig.provider.charAt(0).toUpperCase() + ttsConfig.provider.slice(1);

  return (
    <div className="my-40">
      <div className="my-16 typography-20 font-bold">Save / Load Settings</div>

      {/* What gets saved */}
      <div className="mb-16 p-12 bg-surface1 rounded-8 text-sm">
        <div className="font-bold mb-6 text-text-primary/80">What's included in the file:</div>
        <ul className="space-y-2 text-text-primary/60">
          <li className="flex items-center gap-6">
            <span className="text-green-500">✓</span>
            <span>
              <strong>AI Provider</strong> — {providerLabel}
              {aiConfig.apiKey ? " (API key included)" : " (no key set)"}
              {aiConfig.model ? `, model: ${aiConfig.model}` : ""}
            </span>
          </li>
          <li className="flex items-center gap-6">
            <span className="text-green-500">✓</span>
            <span>
              <strong>TTS Provider</strong> — {ttsLabel}
              {ttsConfig.provider === "elevenlabs" && ttsConfig.elevenLabsKey
                ? " (API key included)"
                : ttsConfig.provider === "koeiromap" && ttsConfig.koeiromapKey
                ? " (API key included)"
                : ""}
            </span>
          </li>
          <li className="flex items-center gap-6">
            <span className="text-green-500">✓</span>
            <span><strong>System Prompt</strong></span>
          </li>
          <li className="flex items-center gap-6">
            <span className="text-green-500">✓</span>
            <span><strong>Background</strong> — {backgroundConfig.type} mode (uploaded images are not saved)</span>
          </li>
          <li className="flex items-center gap-6">
            <span className="text-green-500">✓</span>
            <span><strong>Voice parameters</strong> (Koeiromap X/Y)</span>
          </li>
          <li className="flex items-center gap-6">
            <span className="text-yellow-500">⚠</span>
            <span className="text-text-primary/50">Chat history is NOT included</span>
          </li>
          <li className="flex items-center gap-6">
            <span className="text-yellow-500">⚠</span>
            <span className="text-text-primary/50">Custom background images are NOT included (too large)</span>
          </li>
        </ul>
        <div className="mt-8 text-xs text-text-primary/40 border-t border-surface3 pt-8">
          ⚠ The exported file contains your API keys in plain text. Keep it private and do not share it publicly.
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-12 flex-wrap">
        <button
          onClick={handleSave}
          className="flex items-center gap-8 px-20 py-10 bg-primary hover:bg-primary-hover active:bg-primary-press text-white font-bold rounded-oval transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export Settings
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-8 px-20 py-10 bg-surface3 hover:bg-surface3-hover text-text-primary font-bold rounded-oval border-2 border-surface3 hover:border-primary/40 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Import Settings
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Status feedback */}
      {status.type === "saved" && (
        <div className="mt-12 flex items-center gap-8 text-sm text-green-700 bg-green-500/10 border border-green-500/20 rounded-8 px-12 py-8">
          <span>✅</span>
          <span>Settings exported as <strong>{status.filename}</strong></span>
        </div>
      )}
      {status.type === "loaded" && (
        <div className="mt-12 flex items-center gap-8 text-sm text-blue-700 bg-blue-500/10 border border-blue-500/20 rounded-8 px-12 py-8">
          <span>✅</span>
          <span>Settings loaded from file (originally saved {status.savedAt})</span>
        </div>
      )}
      {status.type === "error" && (
        <div className="mt-12 flex items-center gap-8 text-sm text-red-700 bg-red-500/10 border border-red-500/20 rounded-8 px-12 py-8">
          <span>❌</span>
          <span>{status.message}</span>
        </div>
      )}

      {/* Confirmation modal */}
      {showConfirm && pendingSnapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-16 shadow-2xl max-w-md w-full mx-16 p-24">
            <div className="typography-20 font-bold mb-12">Load Settings?</div>
            <div className="text-sm text-text-primary/70 mb-16 space-y-4">
              <p>
                This will <strong>replace</strong> your current settings including API keys, system prompt, TTS config, and background.
              </p>
              {pendingSnapshot._savedAt && (
                <p className="text-text-primary/50">
                  File saved: {new Date(pendingSnapshot._savedAt).toLocaleString()}
                </p>
              )}
              <div className="bg-surface1 rounded-8 p-12 text-xs space-y-1">
                <div>
                  <span className="font-bold">AI:</span>{" "}
                  {pendingSnapshot.aiConfig.provider}
                  {pendingSnapshot.aiConfig.model ? ` / ${pendingSnapshot.aiConfig.model}` : ""}
                  {pendingSnapshot.aiConfig.apiKey ? " (key present)" : " (no key)"}
                </div>
                <div>
                  <span className="font-bold">TTS:</span> {pendingSnapshot.ttsConfig.provider}
                </div>
                <div>
                  <span className="font-bold">Prompt:</span>{" "}
                  {pendingSnapshot.systemPrompt.slice(0, 60)}
                  {pendingSnapshot.systemPrompt.length > 60 ? "…" : ""}
                </div>
              </div>
            </div>
            <div className="flex gap-8 justify-end">
              <button
                onClick={handleCancelLoad}
                className="px-20 py-8 rounded-oval border-2 border-surface3 bg-surface1 hover:bg-surface3 font-bold text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmLoad}
                className="px-20 py-8 rounded-oval bg-primary hover:bg-primary-hover text-white font-bold text-sm transition-colors"
              >
                Load Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
