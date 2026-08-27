import React, { useEffect, useRef, useState, useCallback } from "react";
import { IconButton } from "./iconButton";
import { TextButton } from "./textButton";
import { Link } from "./link";
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
import { pushTestAlert } from "@/features/alerts/alertQueue";
import { AdBreakConfig } from "@/features/adBreak/adBreakConfig";
import { AutonomousConfig } from "@/features/autonomous/autonomousConfig";

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
  adBreakConfig: AdBreakConfig;
  onChangeAdBreakConfig: (config: AdBreakConfig) => void;
  onTestAdBreak: () => void;
  autonomousConfig: AutonomousConfig;
  onChangeAutonomousConfig: (config: AutonomousConfig) => void;
  eventSubStatus: "idle" | "connecting" | "connected" | "error" | "disconnected";
  eventSubError: string | null;
  onTestFollow: () => void;
  onTestRaid: () => void;
  onTestSub: () => void;
  onTestResub: () => void;
  onTestStreak: () => void;
  onTestBits: () => void;
  isMobile: boolean;
  onClickClose: () => void;
  onSaveAndClose: () => void;
  onChangeAiConfig: (config: AIProviderConfig) => void;
  onChangeSystemPrompt: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onChangeChatLog: (index: number, text: string) => void;
  onClickOpenVrmFile: () => void;
  onClickResetChatLog: () => void;
  onClickResetSystemPrompt: () => void;
  fallbackMessage: string;
  onChangeFallbackMessage: (message: string) => void;
  onClickResetFallbackMessage: () => void;
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

// ── Tab definitions ───────────────────────────────────────────────────────────
// Adding a new settings section later (e.g. "Polls") is just: add an id here,
// add a case in the render switch below.
type TabId =
  | "general"
  | "vrm"
  | "llm"
  | "ui"
  | "tts"
  | "discord"
  | "systemPrompt"
  | "twitch"
  | "vision"
  | "screenShare";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "general", label: "General", icon: "⚙️" },
  { id: "vrm", label: "VRM", icon: "🧍" },
  { id: "llm", label: "LLM", icon: "🧠" },
  { id: "ui", label: "UI & Background", icon: "🎨" },
  { id: "tts", label: "TTS", icon: "🔊" },
  { id: "discord", label: "Discord", icon: "💬" },
  { id: "systemPrompt", label: "System Prompt", icon: "📝" },
  { id: "twitch", label: "Twitch", icon: "🟣" },
  { id: "vision", label: "Vision", icon: "👁️" },
  { id: "screenShare", label: "Screen Share", icon: "🖥️" },
];

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-20">
    <div className="typography-24 font-bold text-text-primary">{children}</div>
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
    adBreakConfig,
    onChangeAdBreakConfig,
    onTestAdBreak,
    autonomousConfig,
    onChangeAutonomousConfig,
    eventSubStatus,
    eventSubError,
    onTestFollow,
    onTestRaid,
    onTestSub,
    onTestResub,
    onTestStreak,
    onTestBits,
    onClickClose,
    onSaveAndClose,
    onChangeSystemPrompt,
    onChangeAiConfig,
    onChangeChatLog,
    onClickOpenVrmFile,
    onClickResetChatLog,
    onClickResetSystemPrompt,
    fallbackMessage,
    onChangeFallbackMessage,
    onClickResetFallbackMessage,
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
  const [activeTab, setActiveTab] = useState<TabId>("general");

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

      {/* Tab bar — horizontal scroll strip on mobile, so it stays put on desktop too for a single consistent layout */}
      <div className="flex-shrink-0 border-b border-surface3 bg-surface1/40 overflow-x-auto">
        <div className="flex px-8 min-w-max">
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-6 px-16 py-12 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-text-primary/60 hover:text-text-primary"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable body — only the active tab's content is rendered */}
      <div className="flex-1 overflow-y-auto">
        <div className="text-text1 max-w-3xl mx-auto px-24 py-32">

          {activeTab === "general" && (
            <>
              <SectionTitle>General</SectionTitle>
              <div className="mb-16 text-sm text-text-primary/70">
                Save your full configuration to a file, or load one you saved earlier.
              </div>
              <SettingsPorter
                systemPrompt={systemPrompt}
                aiConfig={aiConfig}
                ttsConfig={ttsConfig}
                koeiroParam={koeiroParam}
                backgroundConfig={backgroundConfig}
                onLoadSettings={onLoadSettings}
              />

              <div className="my-40">
                <div className="my-16 typography-20 font-bold">Fallback Message</div>
                <div className="p-16 bg-surface1 rounded-8">
                  <div className="text-sm text-text-primary/70 mb-12">
                    Spoken instead of staying silent whenever the AI provider
                    errors out — rate limits, timeouts, or anything else. Use{" "}
                    <code className="bg-surface3 px-4 rounded-4">[happy]</code>,{" "}
                    <code className="bg-surface3 px-4 rounded-4">[sad]</code>,{" "}
                    <code className="bg-surface3 px-4 rounded-4">[angry]</code>,{" "}
                    <code className="bg-surface3 px-4 rounded-4">[relaxed]</code>, or{" "}
                    <code className="bg-surface3 px-4 rounded-4">[neutral]</code> at
                    the start to set her expression, same as normal replies.
                  </div>
                  <textarea
                    value={fallbackMessage}
                    onChange={(e) => onChangeFallbackMessage(e.target.value)}
                    className="px-16 py-8 bg-surface3 hover:bg-surface3-hover rounded-8 w-full h-[80px] mb-8"
                  />
                  <TextButton onClick={onClickResetFallbackMessage}>
                    Reset to Default
                  </TextButton>
                </div>
              </div>

              <div className="my-40">
                <div className="my-16 typography-20 font-bold flex items-center gap-8">
                  <span>Autonomous Mode</span>
                  <span
                    className={`inline-block w-10 h-10 rounded-full ${
                      autonomousConfig.enabled ? "bg-green-500" : "bg-surface3"
                    }`}
                  />
                </div>
                <div className="p-16 bg-surface1 rounded-8">
                  <div className="text-sm text-text-primary/70 mb-12">
                    When nobody has talked to Miko for a while, she&apos;ll start
                    talking on her own to keep the stream lively. The moment you
                    type in chat (or Twitch chat gets a response), autonomous
                    mode turns off and she responds normally again.
                  </div>
                  <label className="flex items-center gap-8 cursor-pointer mb-12">
                    <input
                      type="checkbox"
                      checked={autonomousConfig.enabled}
                      onChange={(e) =>
                        onChangeAutonomousConfig({
                          ...autonomousConfig,
                          enabled: e.target.checked,
                        })
                      }
                      className="w-16 h-16 accent-primary"
                    />
                    <span>Enable autonomous mode</span>
                  </label>
                  <div className="flex flex-wrap gap-16">
                    <div>
                      <div className="font-bold mb-4 text-sm">
                        Idle time before it kicks in (seconds)
                      </div>
                      <input
                        type="number"
                        min={30}
                        step={10}
                        className="px-16 py-8 w-[140px] bg-surface3 hover:bg-surface3-hover rounded-8"
                        value={autonomousConfig.idleThresholdSeconds}
                        onChange={(e) =>
                          onChangeAutonomousConfig({
                            ...autonomousConfig,
                            idleThresholdSeconds: Math.max(30, Number(e.target.value) || 0),
                          })
                        }
                      />
                    </div>
                    <div>
                      <div className="font-bold mb-4 text-sm">
                        Time between monologue lines (seconds)
                      </div>
                      <input
                        type="number"
                        min={10}
                        step={5}
                        className="px-16 py-8 w-[140px] bg-surface3 hover:bg-surface3-hover rounded-8"
                        value={autonomousConfig.monologueIntervalSeconds}
                        onChange={(e) =>
                          onChangeAutonomousConfig({
                            ...autonomousConfig,
                            monologueIntervalSeconds: Math.max(10, Number(e.target.value) || 0),
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>


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
            </>
          )}

          {activeTab === "vrm" && (
            <>
              <SectionTitle>VRM / Character Model</SectionTitle>
              <div className="my-8">
                <TextButton onClick={onClickOpenVrmFile}>Open VRM File</TextButton>
              </div>
            </>
          )}

          {activeTab === "llm" && (
            <>
              <AIProviderSettings
                config={aiConfig}
                onChangeConfig={onChangeAiConfig}
              />
            </>
          )}

          {activeTab === "ui" && (
            <>
              <SectionTitle>UI Color &amp; Background</SectionTitle>
              <BackgroundSettings
                config={backgroundConfig}
                onChangeConfig={onChangeBackgroundConfig}
              />
              <CaptionSettings
                style={captionStyle}
                onChangeStyle={onChangeCaptionStyle}
              />
            </>
          )}

          {activeTab === "tts" && (
            <>
              <TTSSettings
                ttsConfig={ttsConfig}
                onChangeTTSConfig={onChangeTTSConfig}
                koeiroParam={koeiroParam}
                onChangeKoeiroParam={onChangeKoeiroParam}
              />
            </>
          )}

          {activeTab === "discord" && (
            <>
              <DiscordSettings
                config={discordConfig}
                isConnected={discordConnected}
                connectionError={discordConnectionError}
                onChangeConfig={onChangeDiscordConfig}
                onConnect={onDiscordConnect}
                onDisconnect={onDiscordDisconnect}
              />
            </>
          )}

          {activeTab === "systemPrompt" && (
            <>
              <SectionTitle>System Prompt</SectionTitle>
              <div className="my-8">
                <TextButton onClick={onClickResetSystemPrompt}>
                  Reset to Default
                </TextButton>
              </div>
              <textarea
                value={systemPrompt}
                onChange={onChangeSystemPrompt}
                className="px-16 py-8 bg-surface1 hover:bg-surface1-hover h-[400px] rounded-8 w-full mt-8"
              />
            </>
          )}

          {activeTab === "twitch" && (
            <>
              <TwitchSettings
                config={twitchConfig}
                isConnected={twitchConnected}
                onChangeConfig={onChangeTwitchConfig}
                onConnect={onTwitchConnect}
                onDisconnect={onTwitchDisconnect}
              />

              <div className="my-40">
                <div className="my-16 typography-20 font-bold">Ad Break Countdown</div>
                <div className="p-16 bg-surface1 rounded-8">
                  <div className="text-sm text-text-primary/70 mb-12">
                    Shows an &quot;AD STARTS IN:&quot; countdown top-right. Miko
                    reminds viewers to subscribe when it starts, and welcomes
                    everyone back when it hits zero — as long as Twitch is
                    connected. Trigger it manually below, or type{" "}
                    <code className="bg-surface3 px-4 rounded-4">!ad</code> in
                    your Twitch chat (mods/broadcaster only).
                  </div>
                  <label className="flex items-center gap-8 cursor-pointer mb-12">
                    <input
                      type="checkbox"
                      checked={adBreakConfig.enabled}
                      onChange={(e) =>
                        onChangeAdBreakConfig({ ...adBreakConfig, enabled: e.target.checked })
                      }
                      className="w-16 h-16 accent-primary"
                    />
                    <span>Enable ad break countdown</span>
                  </label>
                  <div className="mb-12">
                    <div className="font-bold mb-4 text-sm">Countdown length (seconds)</div>
                    <input
                      type="number"
                      min={10}
                      step={5}
                      className="px-16 py-8 w-[140px] bg-surface3 hover:bg-surface3-hover rounded-8"
                      value={adBreakConfig.durationSeconds}
                      onChange={(e) =>
                        onChangeAdBreakConfig({
                          ...adBreakConfig,
                          durationSeconds: Math.max(10, Number(e.target.value) || 0),
                        })
                      }
                    />
                  </div>
                  <TextButton onClick={onTestAdBreak}>Test Ad Break</TextButton>
                </div>
              </div>

              <div className="my-40">
                <div className="my-16 typography-20 font-bold flex items-center gap-8">
                  <span>Follow / Raid / Sub / Bits Alerts</span>
                  <span
                    className={`inline-block w-10 h-10 rounded-full ${
                      eventSubStatus === "connected"
                        ? "bg-green-500"
                        : eventSubStatus === "connecting"
                        ? "bg-yellow-500"
                        : eventSubStatus === "error"
                        ? "bg-red-500"
                        : "bg-surface3"
                    }`}
                  />
                  <span className="text-sm font-normal text-text-primary/60">
                    {eventSubStatus === "connected"
                      ? "Connected"
                      : eventSubStatus === "connecting"
                      ? "Connecting…"
                      : eventSubStatus === "error"
                      ? "Error"
                      : "Not connected"}
                  </span>
                </div>
                <div className="p-16 bg-surface1 rounded-8">
                  <div className="text-sm text-text-primary/70 mb-12">
                    Live alerts for new followers, raids, subs, resubs
                    (including shared streaks), and bits. These use Twitch&apos;s
                    EventSub system, which needs a bit more than the chat
                    connection above:
                  </div>
                  <ol className="text-sm text-text-primary/70 mb-12 pl-20 list-decimal space-y-4">
                    <li>
                      Register a free app at{" "}
                      <Link
                        url="https://dev.twitch.tv/console/apps"
                        label="dev.twitch.tv/console/apps"
                      />
                      . Any name works; set the OAuth Redirect URL to{" "}
                      <code className="bg-surface3 px-4 rounded-4">http://localhost</code>{" "}
                      (or anything — it&apos;s not used by this flow). Copy the{" "}
                      <strong>Client ID</strong> it gives you into the field
                      below.
                    </li>
                    <li>
                      Generate a token with these scopes:{" "}
                      <code className="bg-surface3 px-4 rounded-4">
                        moderator:read:followers channel:read:subscriptions bits:read
                        channel:manage:polls channel:manage:predictions
                      </code>{" "}
                      — e.g. at{" "}
                      <Link
                        url="https://twitchtokengenerator.com/"
                        label="twitchtokengenerator.com"
                      />{" "}
                      (choose &quot;Bot Chat Token&quot;, then check those
                      scopes plus chat if you want one token for both). Paste
                      it into the <strong>OAuth Token</strong> field above,
                      in the Twitch Integration section.
                    </li>
                    <li>Enable alerts below, then hit Connect to Twitch above.</li>
                    <li>
                      Once connected, type{" "}
                      <code className="bg-surface3 px-4 rounded-4">/poll Question? | A | B</code>{" "}
                      or{" "}
                      <code className="bg-surface3 px-4 rounded-4">
                        /prediction Question? | A | B
                      </code>{" "}
                      in the chat box to start a real Twitch poll/prediction —
                      Miko can also start one on her own if you ask her to.
                    </li>
                  </ol>
                  <label className="flex items-center gap-8 cursor-pointer mb-12">
                    <input
                      type="checkbox"
                      checked={twitchConfig.alertsEnabled}
                      onChange={(e) =>
                        onChangeTwitchConfig({ ...twitchConfig, alertsEnabled: e.target.checked })
                      }
                      className="w-16 h-16 accent-primary"
                    />
                    <span>Enable follow/raid/sub/bits alerts</span>
                  </label>
                  <div className="mb-16">
                    <div className="font-bold mb-4">Client ID</div>
                    <input
                      className="text-ellipsis px-16 py-8 w-full bg-surface3 hover:bg-surface3-hover rounded-8"
                      type="text"
                      placeholder="your app's Client ID"
                      value={twitchConfig.clientId || ""}
                      onChange={(e) =>
                        onChangeTwitchConfig({ ...twitchConfig, clientId: e.target.value })
                      }
                    />
                  </div>
                  {eventSubStatus === "error" && eventSubError && (
                    <div className="text-sm text-secondary mb-12">{eventSubError}</div>
                  )}
                  <div className="flex flex-wrap gap-8">
                    <TextButton onClick={onTestFollow}>Test Follow</TextButton>
                    <TextButton onClick={onTestRaid}>Test Raid</TextButton>
                    <TextButton onClick={onTestSub}>Test Sub</TextButton>
                    <TextButton onClick={onTestResub}>Test Resub</TextButton>
                    <TextButton onClick={onTestStreak}>Test Streak</TextButton>
                    <TextButton onClick={onTestBits}>Test Bits</TextButton>
                  </div>
                </div>
              </div>

              <div className="my-40">
                <div className="my-16 typography-20 font-bold">Alerts</div>
                <div className="p-16 bg-surface1 rounded-8">
                  <div className="text-sm text-text-primary/70 mb-12">
                    Alert cards render stacked in the top-right corner of the screen.
                    Use this to confirm the overlay is working generally.
                  </div>
                  <TextButton onClick={pushTestAlert}>Test Alert</TextButton>
                </div>
              </div>
            </>
          )}

          {activeTab === "vision" && (
            <>
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
            </>
          )}

          {activeTab === "screenShare" && (
            <>
              <ScreenShareSettings
                config={screenShareConfig}
                onChangeConfig={onChangeScreenShareConfig}
                onStart={onScreenShareStart}
                onStop={onScreenShareStop}
              />
            </>
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
