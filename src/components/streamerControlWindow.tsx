import React, { useState } from "react";
import { PopoutPortal } from "./popoutPortal";
import { StreamerChatPanel } from "./streamerChatPanel";
import { TwitchSettings } from "./twitchSettings";
import { TTSSettings } from "./ttsSettings";
import { AIProviderSettings } from "./aiProviderSettings";
import { CaptionSettings, CaptionStyle } from "./captionSettings";
import { BackgroundSettings } from "./backgroundSettings";
import { VisionSettings } from "./visionSettings";
import { GraphicsSettings } from "./graphicsSettings";
import { StreamerSettings } from "./streamerSettings";
import { Message } from "@/features/messages/messages";
import { TTSConfig } from "@/features/tts/ttsConfig";
import { TwitchConfig } from "@/features/twitch/twitchClient";
import { AIProviderConfig } from "@/features/chat/aiProviders";
import { BackgroundConfig } from "@/features/background/backgroundConfig";
import { KoeiroParam } from "@/features/constants/koeiroParam";
import { VisionConfig } from "@/features/vision/visionConfig";
import { VisionStatus } from "@/features/vision/useVision";
import { ScreenShareConfig } from "@/features/screenShare/screenShare";
import { GraphicsConfig } from "@/features/graphics/graphicsConfig";
import { StreamerConfig } from "@/features/streamer/streamerConfig";
import { BroadcastState } from "@/features/streamer/rtmpBroadcaster";

export type StreamerControlProps = {
  win: Window;
  onClosed: () => void;

  chatLog: Message[];
  chatProcessing: boolean;
  onSend: (text: string, username?: string) => void;
  onOverride: (text: string) => void;

  twitchConfig: TwitchConfig;
  twitchConnected: boolean;
  onChangeTwitchConfig: (c: TwitchConfig) => void;
  onTwitchConnect: () => void;
  onTwitchDisconnect: () => void;

  ttsConfig: TTSConfig;
  onChangeTTSConfig: (c: TTSConfig) => void;
  koeiroParam: KoeiroParam;
  onChangeKoeiroParam: (x: number, y: number) => void;

  aiConfig: AIProviderConfig;
  onChangeAiConfig: (c: AIProviderConfig) => void;

  captionStyle: CaptionStyle;
  onChangeCaptionStyle: (s: CaptionStyle) => void;

  backgroundConfig: BackgroundConfig;
  onChangeBackgroundConfig: (c: BackgroundConfig) => void;

  visionConfig: VisionConfig;
  onChangeVisionConfig: (c: VisionConfig) => void;
  visionStatus: VisionStatus;
  visionLastDescription: string;
  visionLastCaptureTime: Date | null;
  visionSecondsUntilNext: number;
  visionError: string | null;
  onVisionCaptureNow: () => void;
  screenShareConfig: ScreenShareConfig;

  graphicsConfig: GraphicsConfig;
  onChangeGraphicsConfig: (c: GraphicsConfig) => void;

  streamerConfig: StreamerConfig;
  onChangeStreamerConfig: (c: StreamerConfig) => void;
  broadcast: BroadcastState;
  goLivePending: boolean;
  onGoLive: () => void;
  onStopBroadcast: () => void;
};

type TabId = "chat" | "twitch" | "tts" | "llm" | "caption" | "bg" | "vision" | "3d" | "stream";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "chat", label: "Chat", icon: "💬" },
  { id: "twitch", label: "Twitch", icon: "🟣" },
  { id: "tts", label: "TTS", icon: "🔊" },
  { id: "llm", label: "LLM", icon: "🧠" },
  { id: "caption", label: "Caption", icon: "🔤" },
  { id: "bg", label: "Background", icon: "🎨" },
  { id: "vision", label: "Vision", icon: "👁️" },
  { id: "3d", label: "3D", icon: "🎮" },
  { id: "stream", label: "Stream", icon: "📡" },
];

const Content = (p: StreamerControlProps) => {
  const [tab, setTab] = useState<TabId>("chat");
  const live = p.broadcast.status === "live";

  return (
    <div className="flex flex-col bg-white text-text-primary" style={{ height: "100vh" }}>
      <div className="flex items-center justify-between px-16 py-10 border-b border-surface3 flex-shrink-0">
        <div className="typography-20 font-bold">Streamer Control Panel</div>
        <div className="flex items-center gap-8 text-xs font-bold">
          {live && <span className="px-8 py-2 rounded-oval bg-red-500 text-white animate-pulse">LIVE</span>}
          {p.twitchConnected && <span className="px-8 py-2 rounded-oval bg-[#9146FF] text-white">Twitch</span>}
        </div>
      </div>

      <div className="flex-shrink-0 border-b border-surface3 bg-surface1/40 overflow-x-auto">
        <div className="flex px-4 min-w-max">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-4 px-12 py-10 text-sm font-bold whitespace-nowrap border-b-2 ${
                tab === t.id ? "border-primary text-primary" : "border-transparent text-text-primary/60 hover:text-text-primary"
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {tab === "chat" ? (
          <StreamerChatPanel
            chatLog={p.chatLog}
            chatProcessing={p.chatProcessing}
            twitchConfig={p.twitchConfig}
            twitchConnected={p.twitchConnected}
            onChangeTwitchConfig={p.onChangeTwitchConfig}
            onTwitchConnect={p.onTwitchConnect}
            onTwitchDisconnect={p.onTwitchDisconnect}
            onSend={p.onSend}
            onOverride={p.onOverride}
          />
        ) : (
          <div className="h-full overflow-y-auto px-16 pb-32">
            {tab === "twitch" && (
              <TwitchSettings
                hideStreamerMode
                config={p.twitchConfig}
                isConnected={p.twitchConnected}
                onChangeConfig={p.onChangeTwitchConfig}
                onConnect={p.onTwitchConnect}
                onDisconnect={p.onTwitchDisconnect}
              />
            )}
            {tab === "tts" && (
              <TTSSettings
                ttsConfig={p.ttsConfig}
                onChangeTTSConfig={p.onChangeTTSConfig}
                koeiroParam={p.koeiroParam}
                onChangeKoeiroParam={p.onChangeKoeiroParam}
              />
            )}
            {tab === "llm" && (
              <AIProviderSettings config={p.aiConfig} onChangeConfig={p.onChangeAiConfig} />
            )}
            {tab === "caption" && (
              <CaptionSettings style={p.captionStyle} onChangeStyle={p.onChangeCaptionStyle} />
            )}
            {tab === "bg" && (
              <BackgroundSettings config={p.backgroundConfig} onChangeConfig={p.onChangeBackgroundConfig} />
            )}
            {tab === "vision" && (
              <VisionSettings
                config={p.visionConfig}
                onChangeConfig={p.onChangeVisionConfig}
                onCaptureNow={p.onVisionCaptureNow}
                status={p.visionStatus}
                lastDescription={p.visionLastDescription}
                lastCaptureTime={p.visionLastCaptureTime}
                secondsUntilNext={p.visionSecondsUntilNext}
                error={p.visionError}
                screenShareActive={p.screenShareConfig.active}
                screenShareMode={p.screenShareConfig.mode}
                groqApiKey={p.aiConfig.provider === "groq" ? p.aiConfig.apiKey : undefined}
              />
            )}
            {tab === "3d" && (
              <GraphicsSettings config={p.graphicsConfig} onChangeConfig={p.onChangeGraphicsConfig} />
            )}
            {tab === "stream" && (
              <StreamerSettings
                config={p.streamerConfig}
                onChangeConfig={p.onChangeStreamerConfig}
                broadcast={p.broadcast}
                awaitingClick={p.goLivePending}
                onGoLive={p.onGoLive}
                onStop={p.onStopBroadcast}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const StreamerControlWindow = (p: StreamerControlProps) => (
  <PopoutPortal win={p.win} title="ChatVRM — Control Panel" onClosed={p.onClosed}>
    <Content {...p} />
  </PopoutPortal>
);
