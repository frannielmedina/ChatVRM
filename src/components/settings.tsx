import React from "react";
import { IconButton } from "./iconButton";
import { TextButton } from "./textButton";
import { Message } from "@/features/messages/messages";
import { TTSSettings } from "./ttsSettings";
import { TwitchSettings } from "./twitchSettings";
import { ScreenShareSettings } from "./screenShareSettings";
import { AIProviderSettings } from "./aiProviderSettings";
import { BackgroundSettings } from "./backgroundSettings";
import { TTSConfig } from "@/features/tts/ttsConfig";
import { TwitchConfig } from "@/features/twitch/twitchClient";
import { ScreenShareConfig } from "@/features/screenShare/screenShare";
import { AIProviderConfig } from "@/features/chat/aiProviders";
import { BackgroundConfig } from "@/features/background/backgroundConfig";

type Props = {
  aiConfig: AIProviderConfig;
  systemPrompt: string;
  chatLog: Message[];
  ttsConfig: TTSConfig;
  koeiroParam: { speakerX: number; speakerY: number };
  twitchConfig: TwitchConfig;
  twitchConnected: boolean;
  screenShareConfig: ScreenShareConfig;
  backgroundConfig: BackgroundConfig;
  onClickClose: () => void;
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
};

export const Settings = ({
  aiConfig,
  chatLog,
  systemPrompt,
  ttsConfig,
  koeiroParam,
  twitchConfig,
  twitchConnected,
  screenShareConfig,
  backgroundConfig,
  onClickClose,
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
}: Props) => {
  return (
    <div className="absolute z-40 w-full h-full bg-white/80 backdrop-blur">
      <div className="absolute m-24">
        <IconButton
          iconName="24/Close"
          isProcessing={false}
          onClick={onClickClose}
        />
      </div>
      <div className="max-h-full overflow-auto">
        <div className="text-text1 max-w-3xl mx-auto px-24 py-64">
          <div className="my-24 typography-32 font-bold">Settings</div>

          {/* AI Provider */}
          <AIProviderSettings
            config={aiConfig}
            onChangeConfig={onChangeAiConfig}
          />

          {/* Background */}
          <BackgroundSettings
            config={backgroundConfig}
            onChangeConfig={onChangeBackgroundConfig}
          />

          {/* VRM model */}
          <div className="my-40">
            <div className="my-16 typography-20 font-bold">Character Model</div>
            <div className="my-8">
              <TextButton onClick={onClickOpenVrmFile}>Open VRM File</TextButton>
            </div>
          </div>

          {/* System prompt */}
          <div className="my-40">
            <div className="my-8">
              <div className="my-16 typography-20 font-bold">Character Prompt (System Prompt)</div>
              <TextButton onClick={onClickResetSystemPrompt}>Reset to Default</TextButton>
            </div>
            <textarea
              value={systemPrompt}
              onChange={onChangeSystemPrompt}
              className="px-16 py-8 bg-surface1 hover:bg-surface1-hover h-168 rounded-8 w-full mt-8"
            />
          </div>

          {/* TTS */}
          <TTSSettings
            ttsConfig={ttsConfig}
            onChangeTTSConfig={onChangeTTSConfig}
            koeiroParam={koeiroParam}
            onChangeKoeiroParam={onChangeKoeiroParam}
          />

          {/* Twitch */}
          <TwitchSettings
            config={twitchConfig}
            isConnected={twitchConnected}
            onChangeConfig={onChangeTwitchConfig}
            onConnect={onTwitchConnect}
            onDisconnect={onTwitchDisconnect}
          />

          {/* Screen Share */}
          <ScreenShareSettings
            config={screenShareConfig}
            onChangeConfig={onChangeScreenShareConfig}
            onStart={onScreenShareStart}
            onStop={onScreenShareStop}
          />

          {/* Chat log */}
          {chatLog.length > 0 && (
            <div className="my-40">
              <div className="my-8">
                <div className="my-16 typography-20 font-bold">Conversation History</div>
                <TextButton onClick={onClickResetChatLog}>Clear History</TextButton>
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
        </div>
      </div>
    </div>
  );
};
