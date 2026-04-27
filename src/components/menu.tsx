import { IconButton } from "./iconButton";
import { Message } from "@/features/messages/messages";
import { ChatLogDialog } from "./chatLogDialog";
import React, { useCallback, useContext, useRef, useState } from "react";
import { Settings } from "./settings";
import { ViewerContext } from "@/features/vrmViewer/viewerContext";
import { AssistantText } from "./assistantText";
import { TTSConfig } from "@/features/tts/ttsConfig";
import { TwitchConfig } from "@/features/twitch/twitchClient";
import { ScreenShareConfig } from "@/features/screenShare/screenShare";
import { AIProviderConfig } from "@/features/chat/aiProviders";
import { BackgroundConfig } from "@/features/background/backgroundConfig";
import { KoeiroParam } from "@/features/constants/koeiroParam";
import { SettingsSnapshot } from "@/features/settings/settingsPorter";
import { CaptionStyle } from "./captionSettings";

type Props = {
  aiConfig: AIProviderConfig;
  systemPrompt: string;
  chatLog: Message[];
  ttsConfig: TTSConfig;
  koeiroParam: KoeiroParam;
  assistantMessage: string;
  twitchConfig: TwitchConfig;
  twitchConnected: boolean;
  screenShareConfig: ScreenShareConfig;
  backgroundConfig: BackgroundConfig;
  captionStyle: CaptionStyle;
  uiVisible: boolean;
  onChangeSystemPrompt: (systemPrompt: string) => void;
  onChangeAiConfig: (config: AIProviderConfig) => void;
  onChangeChatLog: (index: number, text: string) => void;
  onChangeTTSConfig: (config: TTSConfig) => void;
  onChangeKoeiroParam: (x: number, y: number) => void;
  handleClickResetChatLog: () => void;
  handleClickResetSystemPrompt: () => void;
  onChangeTwitchConfig: (config: TwitchConfig) => void;
  onTwitchConnect: () => void;
  onTwitchDisconnect: () => void;
  onChangeScreenShareConfig: (config: ScreenShareConfig) => void;
  onScreenShareStart: () => void;
  onScreenShareStop: () => void;
  onChangeBackgroundConfig: (config: BackgroundConfig) => void;
  onChangeCaptionStyle: (style: CaptionStyle) => void;
  onLoadSettings: (snapshot: SettingsSnapshot) => void;
};

export const Menu = ({
  aiConfig,
  systemPrompt,
  chatLog,
  ttsConfig,
  koeiroParam,
  assistantMessage,
  twitchConfig,
  twitchConnected,
  screenShareConfig,
  backgroundConfig,
  captionStyle,
  uiVisible,
  onChangeSystemPrompt,
  onChangeAiConfig,
  onChangeChatLog,
  onChangeTTSConfig,
  onChangeKoeiroParam,
  handleClickResetChatLog,
  handleClickResetSystemPrompt,
  onChangeTwitchConfig,
  onTwitchConnect,
  onTwitchDisconnect,
  onChangeScreenShareConfig,
  onScreenShareStart,
  onScreenShareStop,
  onChangeBackgroundConfig,
  onChangeCaptionStyle,
  onLoadSettings,
}: Props) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showChatLog, setShowChatLog] = useState(false);
  const { viewer } = useContext(ViewerContext);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChangeSystemPrompt = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) =>
      onChangeSystemPrompt(event.target.value),
    [onChangeSystemPrompt]
  );

  const handleClickOpenVrmFile = useCallback(() => fileInputRef.current?.click(), []);

  const handleChangeVrmFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files) return;
      const file = files[0];
      if (!file) return;
      const ext = file.name.split(".").pop();
      if (ext === "vrm") {
        const blob = new Blob([file], { type: "application/octet-stream" });
        const url = window.URL.createObjectURL(blob);
        viewer.loadVrm(url);
      }
      event.target.value = "";
    },
    [viewer]
  );

  // Keep UI visible while settings panel is open
  const shouldShowUI = uiVisible || showSettings;

  return (
    <>
      {/* Top-left buttons — auto-hide */}
      <div
        className={`absolute z-10 m-24 transition-opacity duration-500 ${
          shouldShowUI ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="grid grid-flow-col gap-[8px]">
          <IconButton
            iconName="24/Menu"
            label="Settings"
            isProcessing={false}
            onClick={() => setShowSettings(true)}
          />
          {/* Chat Log — now opens dialog */}
          <IconButton
            iconName={showChatLog ? "24/CommentFill" : "24/CommentOutline"}
            label="Chat Log"
            isProcessing={false}
            disabled={chatLog.length <= 0}
            onClick={() => setShowChatLog(true)}
          />
          {twitchConnected && (
            <div className="flex items-center gap-4 px-12 py-8 bg-[#9146FF]/20 border border-[#9146FF]/40 rounded-16 text-[#9146FF] text-sm font-bold">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#9146FF">
                <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
              </svg>
              Live
            </div>
          )}
          {screenShareConfig.active && (
            <button
              onClick={onScreenShareStop}
              className="flex items-center gap-4 px-12 py-8 bg-green-500/20 border border-green-500/40 rounded-16 text-green-600 text-sm font-bold hover:bg-secondary/20 hover:border-secondary/40 hover:text-secondary transition-colors"
            >
              🖥️ Stop Share
            </button>
          )}
        </div>
      </div>

      {/* Chat Log Dialog (modal) */}
      {showChatLog && (
        <ChatLogDialog
          messages={chatLog}
          onClose={() => setShowChatLog(false)}
        />
      )}

      {showSettings && (
        <Settings
          aiConfig={aiConfig}
          chatLog={chatLog}
          systemPrompt={systemPrompt}
          ttsConfig={ttsConfig}
          koeiroParam={koeiroParam}
          twitchConfig={twitchConfig}
          twitchConnected={twitchConnected}
          screenShareConfig={screenShareConfig}
          backgroundConfig={backgroundConfig}
          captionStyle={captionStyle}
          onClickClose={() => setShowSettings(false)}
          onChangeAiConfig={onChangeAiConfig}
          onChangeSystemPrompt={handleChangeSystemPrompt}
          onChangeChatLog={onChangeChatLog}
          onClickOpenVrmFile={handleClickOpenVrmFile}
          onClickResetChatLog={handleClickResetChatLog}
          onClickResetSystemPrompt={handleClickResetSystemPrompt}
          onChangeTTSConfig={onChangeTTSConfig}
          onChangeKoeiroParam={onChangeKoeiroParam}
          onChangeTwitchConfig={onChangeTwitchConfig}
          onTwitchConnect={onTwitchConnect}
          onTwitchDisconnect={onTwitchDisconnect}
          onChangeScreenShareConfig={onChangeScreenShareConfig}
          onScreenShareStart={onScreenShareStart}
          onScreenShareStop={onScreenShareStop}
          onChangeBackgroundConfig={onChangeBackgroundConfig}
          onChangeCaptionStyle={onChangeCaptionStyle}
          onLoadSettings={onLoadSettings}
        />
      )}

      {/* Caption — shown when not in dialog and there is a message */}
      {!showChatLog && assistantMessage && (
        <AssistantText
  key={assistantMessage}
  message={assistantMessage}
  captionStyle={captionStyle}
/>
      )}

      <input
        type="file"
        className="hidden"
        accept=".vrm"
        ref={fileInputRef}
        onChange={handleChangeVrmFile}
      />
    </>
  );
};
