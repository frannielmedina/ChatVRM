import React, { useEffect, useRef, useState, useCallback } from "react";
import { IconButton } from "./iconButton";
import { TextButton } from "./textButton";
import { Message } from "@/features/messages/messages";
import { TTSSettings } from "./ttsSettings";
import { TwitchSettings } from "./twitchSettings";
import { ScreenShareSettings } from "./screenShareSettings";
import { AIProviderSettings } from "./aiProviderSettings";
import { BackgroundSettings } from "./backgroundSettings";
import { CaptionSettings } from "./captionSettings";
import { VisionSettings } from "./visionSettings";
import { DiscordSettings } from "./discordSettings";
import { SettingsPorter } from "./settingsPorter";
import { TTSConfig } from "@/features/tts/ttsConfig";
import { TwitchConfig } from "@/features/twitch/twitchClient";
import { ScreenShareConfig } from "@/features/screenShare/screenShare";
import { AIProviderConfig } from "@/features/chat/aiProviders";
import { BackgroundConfig } from "@/features/background/backgroundConfig";
import { KoeiroParam } from "@/features/constants/koeiroParam";
import { SettingsSnapshot } from "@/features/settings/settingsPorter";
import { CaptionStyle } from "./captionSettings";
import { VisionConfig } from "@/features/vision/visionConfig";
import { VisionStatus } from "@/features/vision/useVision";
import { DiscordConfig } from "@/features/discord/discordConfig";

type Props = {
  aiConfig: AIProviderConfig;
  systemPrompt: string;
  chatLog: Message[];
  ttsConfig: TTSConfig;
  koeiroParam: KoeiroParam;
  twitchConfig: TwitchConfig;
  twitchConnected: boolean;
  screenShareConfig: ScreenShareConfig;
  backgroundConfig: BackgroundConfig;
  captionStyle: CaptionStyle;
  visionConfig: VisionConfig;
  visionStatus: VisionStatus;
  visionLastDescription: string;
  visionLastCaptureTime: Date | null;
  visionSecondsUntilNext: number;
  visionError: string | null;
  discordConfig: DiscordConfig;
  discordConnected: boolean;
  discordConnectionError: string | null;
  isMobile: boolean;
  onClickClose: () => void;
  onSaveAndClose: () => void;
  onChangeAiConfig: (config: AIProviderConfig) => void;
  onChangeSystemPrompt: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onChangeChatLog: (index: number, text: string) => void;
  onClickOpenVrmFile: () => void;
  onClickResetChatLog: () => void;
  onClickResetSystemPrompt: () => void;
  onChangeTTSConfig: (config: TTSConfig) => void;
  onChangeKoeiroParam: (x: number, y: number) => void;
  onChangeTwitchConfig: (config: TwitchConfig) => void;
  onTwitchConnect: () => void;
  onTwitchDisconnect: () => void;
  onChangeScreenShareConfig: (config: ScreenShareConfig) => void;
  onScreenShareStart: () => void;
  onScreenShareStop: () => void;
  onChangeBackgroundConfig: (config: BackgroundConfig) => void;
  onChangeCaptionStyle: (style: CaptionStyle) => void;
  onChangeVisionConfig: (config: VisionConfig) => void;
  onVisionCaptureNow: () => void;
  onChangeDiscordConfig: (config: DiscordConfig) => void;
  onDiscordConnect: () => void;
  onDiscordDisconnect: () => void;
  onLoadSettings: (snapshot: SettingsSnapshot) => void;
};

// ── Save confirmation dialog ──────────────────────────────────────────────────
const SaveConfirmDialog = ({
  onSave,
  onDiscard,
  onCancel,
}: {
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div className="bg-white rounded-16 shadow-2xl max-w-sm w-full mx-16 p-24">
      <div className="typography-20 font-bold mb-8">Save settings?</div>
      <div className="text-sm text-text-primary/70 mb-20">
        Do you want to save your settings before closing?
      </div>
      <div className="flex gap-8 justify-end flex-wrap">
        <button
          onClick={onCancel}
          className="px-16 py-8 rounded-oval border-2 border-surface3 bg-surface1 hover:bg-surface3 font-bold text-sm"
        >
          Cancel
        </button>
        <button
          onClick={onDiscard}
          className="px-16 py-8 rounded-oval border-2 border-surface3 bg-surface1 hover:bg-surface3 font-bold text-sm text-secondary"
        >
          Don&apos;t Save
        </button>
        <button
          onClick={onSave}
          className="px-16 py-8 rounded-oval bg-primary hover:bg-primary-hover text-white font-bold text-sm"
        >
          Save &amp; Close
        </button>
      </div>
    </div>
  </div>
);

// ── Inner panel content ───────────────────────────────────────────────────────
export const SettingsContent = (props: Props) => {
  const {
    aiConfig,
    chatLog,
    systemPrompt,
    ttsConfig,
    koeiroParam,
    twitchConfig,
    twitchConnected,
    screenShareConfig,
    backgroundConfig,
    captionStyle,
    visionConfig,
    visionStatus,
    visionLastDescription,
    visionLastCaptureTime,
    visionSecondsUntilNext,
    visionError,
    discordConfig,
    discordConnected,
    discordConnectionError,
    onClickClose,
    onSaveAndClose,
    onChangeSystemPrompt,
    onChangeAiConfig,
    onChangeChatLog,
    onClickOpenVrmFile,
    onClickResetChatLog,
    onClickResetSystemPrompt,
    onChangeTTSConfig,
    onChangeKoeiroParam,
    onChangeTwitchConfig,
    onTwitchConnect,
    onTwitchDisconnect,
    onChangeScreenShareConfig,
    onScreenShareStart,
    onScreenShareStop,
    onChangeBackgroundConfig,
    onChangeCaptionStyle,
    onChangeVisionConfig,
    onVisionCaptureNow,
    onChangeDiscordConfig,
    onDiscordConnect,
    onDiscordDisconnect,
    onLoadSettings,
    isMobile,
  } = props;

  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showSaveConfirm) {
          setShowSaveConfirm(false);
        } else if (isMobile) {
          onClickClose();
        } else {
          setShowSaveConfirm(true);
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [showSaveConfirm, isMobile, onClickClose]);

  const handleClose = useCallback(() => {
    if (isMobile) {
      onClickClose();
    } else {
      setShowSaveConfirm(true);
    }
  }, [isMobile, onClickClose]);

  return (
    <>
      {showSaveConfirm && (
        <SaveConfirmDialog
          onSave={() => { setShowSaveConfirm(false); onSaveAndClose(); }}
          onDiscard={() => { setShowSaveConfirm(false); onClickClose(); }}
          onCancel={() => setShowSaveConfirm(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-24 py-16 border-b border-surface3 flex-shrink-0">
        <div className="typography-24 font-bold text-text-primary">Settings</div>
        <div className="flex items-center gap-8">
          <button
            onClick={onSaveAndClose}
            className="px-20 py-8 rounded-oval bg-primary hover:bg-primary-hover text-white font-bold text-sm transition-colors"
          >
            Save &amp; Close
          </button>
          <button
            onClick={handleClose}
            className="flex items-center justify-center w-36 h-36 rounded-8 bg-surface1 hover:bg-surface3 border-2 border-surface3 hover:border-secondary/40 transition-colors"
            title="Close (Esc)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="text-text1 max-w-3xl mx-auto px-24 py-32">

          <SettingsPorter
            systemPrompt={systemPrompt}
            aiConfig={aiConfig}
            ttsConfig={ttsConfig}
            koeiroParam={koeiroParam}
            backgroundConfig={backgroundConfig}
            onLoadSettings={onLoadSettings}
          />

          <div className="border-t border-surface3 my-32" />

          <AIProviderSettings
            config={aiConfig}
            onChangeConfig={onChangeAiConfig}
          />

          <BackgroundSettings
            config={backgroundConfig}
            onChangeConfig={onChangeBackgroundConfig}
          />

          <CaptionSettings
            style={captionStyle}
            onChangeStyle={onChangeCaptionStyle}
          />

          <div className="my-40">
            <div className="my-16 typography-20 font-bold">Character Model</div>
            <div className="my-8">
              <TextButton onClick={onClickOpenVrmFile}>Open VRM File</TextButton>
            </div>
          </div>

          <div className="my-40">
            <div className="my-8">
              <div className="my-16 typography-20 font-bold">
                Character Prompt (System Prompt)
              </div>
              <TextButton onClick={onClickResetSystemPrompt}>
                Reset to Default
              </TextButton>
            </div>
            <textarea
              value={systemPrompt}
              onChange={onChangeSystemPrompt}
              className="px-16 py-8 bg-surface1 hover:bg-surface1-hover h-168 rounded-8 w-full mt-8"
            />
          </div>

          <TTSSettings
            ttsConfig={ttsConfig}
            onChangeTTSConfig={onChangeTTSConfig}
            koeiroParam={koeiroParam}
            onChangeKoeiroParam={onChangeKoeiroParam}
          />

          <TwitchSettings
            config={twitchConfig}
            isConnected={twitchConnected}
            onChangeConfig={onChangeTwitchConfig}
            onConnect={onTwitchConnect}
            onDisconnect={onTwitchDisconnect}
          />

          <DiscordSettings
            config={discordConfig}
            isConnected={discordConnected}
            connectionError={discordConnectionError}
            onChangeConfig={onChangeDiscordConfig}
            onConnect={onDiscordConnect}
            onDisconnect={onDiscordDisconnect}
          />

          <ScreenShareSettings
            config={screenShareConfig}
            onChangeConfig={onChangeScreenShareConfig}
            onStart={onScreenShareStart}
            onStop={onScreenShareStop}
          />

          <VisionSettings
            config={visionConfig}
            onChangeConfig={onChangeVisionConfig}
            onCaptureNow={onVisionCaptureNow}
            status={visionStatus}
            lastDescription={visionLastDescription}
            lastCaptureTime={visionLastCaptureTime}
            secondsUntilNext={visionSecondsUntilNext}
            error={visionError}
            screenShareActive={screenShareConfig.active}
            screenShareMode={screenShareConfig.mode}
            groqApiKey={aiConfig.provider === "groq" ? aiConfig.apiKey : undefined}
          />

          {chatLog.length > 0 && (
            <div className="my-40">
              <div className="my-8">
                <div className="my-16 typography-20 font-bold">
                  Conversation History
                </div>
                <TextButton onClick={onClickResetChatLog}>
                  Clear History
                </TextButton>
              </div>
              <div className="my-8">
                {chatLog.map((value, index) => (
                  <div
                    key={index}
                    className="my-8 grid grid-flow-col grid-cols-[min-content_1fr] gap-x-fixed"
                  >
                    <div className="w-[80px] py-8">
                      {value.role === "assistant" ? "Character" : "You"}
                    </div>
                    <input
                      className="bg-surface1 hover:bg-surface1-hover rounded-8 w-full px-16 py-8"
                      type="text"
                      value={value.content}
                      onChange={(e) => onChangeChatLog(index, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="h-32" />
        </div>
      </div>
    </>
  );
};

// ── Settings — centered modal dialog ─────────────────────────────────────────
export const Settings = (props: Props) => {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  if (isMobile) {
    return (
      <div
        className="fixed inset-0 z-50 bg-white flex flex-col"
        style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms ease" }}
      >
        <SettingsContent {...props} isMobile={true} />
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        padding: "24px",
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        opacity: visible ? 1 : 0,
        transition: "opacity 200ms ease",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) props.onSaveAndClose(); }}
    >
      <div
        className="bg-white rounded-16 shadow-2xl flex flex-col overflow-hidden w-full"
        style={{
          maxWidth: 800,
          maxHeight: "88vh",
          transform: visible ? "translateY(0) scale(1)" : "translateY(20px) scale(0.97)",
          transition: "transform 240ms cubic-bezier(0.34,1.56,0.64,1), opacity 200ms ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <SettingsContent {...props} isMobile={false} />
      </div>
    </div>
  );
};

// Legacy export alias
export const SettingsPopup = Settings;
