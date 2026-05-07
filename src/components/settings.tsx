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
import { SettingsPorter } from "./settingsPorter";
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
  twitchConfig: TwitchConfig;
  twitchConnected: boolean;
  screenShareConfig: ScreenShareConfig;
  backgroundConfig: BackgroundConfig;
  captionStyle: CaptionStyle;
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
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
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

// ── Settings content (shared between popup and inline) ────────────────────────
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
    onLoadSettings,
    isMobile,
  } = props;

  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

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
          onSave={() => {
            setShowSaveConfirm(false);
            onSaveAndClose();
          }}
          onDiscard={() => {
            setShowSaveConfirm(false);
            onClickClose();
          }}
          onCancel={() => setShowSaveConfirm(false)}
        />
      )}

      <div className={isMobile ? "absolute z-40 w-full h-full bg-white/80 backdrop-blur" : "w-full h-full bg-white"}>
        <div className="absolute m-24 z-10">
          <IconButton
            iconName="24/Close"
            isProcessing={false}
            onClick={handleClose}
          />
        </div>
        <div className="max-h-full overflow-auto h-full">
          <div className="text-text1 max-w-3xl mx-auto px-24 py-64">
            <div className="my-24 typography-32 font-bold">Settings</div>

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

            <ScreenShareSettings
              config={screenShareConfig}
              onChangeConfig={onChangeScreenShareConfig}
              onStart={onScreenShareStart}
              onStop={onScreenShareStop}
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
          </div>
        </div>
      </div>
    </>
  );
};

// ── Desktop popup window settings ─────────────────────────────────────────────
export const SettingsPopup = (props: Props) => {
  const popupRef = useRef<Window | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [popupReady, setPopupReady] = useState(false);

  useEffect(() => {
    const popup = window.open(
      "",
      "chatvrm-settings",
      `width=760,height=700,resizable=yes,scrollbars=yes,menubar=no,toolbar=no,location=no,status=no`
    );

    if (!popup) {
      return;
    }

    popupRef.current = popup;

    popup.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>ChatVRM — Settings</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Montserrat', 'M PLUS 2', sans-serif; overflow: hidden; }
    #settings-root { width: 100vw; height: 100vh; overflow: auto; }
  </style>
</head>
<body>
  <div id="settings-root"></div>
</body>
</html>`);
    popup.document.close();

    Array.from(document.styleSheets).forEach((sheet) => {
      try {
        if (sheet.href) {
          const link = popup.document.createElement("link");
          link.rel = "stylesheet";
          link.href = sheet.href;
          popup.document.head.appendChild(link);
        } else if (sheet.ownerNode) {
          const clone = sheet.ownerNode.cloneNode(true) as HTMLElement;
          popup.document.head.appendChild(clone);
        }
      } catch (_) {}
    });

    popup.addEventListener("beforeunload", () => {
      props.onClickClose();
    });

    setPopupReady(true);

    return () => {
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.removeEventListener("beforeunload", () => {});
        popupRef.current.close();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!popupReady || !containerRef.current || !popupRef.current) return;
    const root = popupRef.current.document.getElementById("settings-root");
    if (root && containerRef.current) {
      root.appendChild(containerRef.current);
    }
  }, [popupReady]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
      <SettingsContent {...props} isMobile={false} />
    </div>
  );
};

// ── Main Settings wrapper ─────────────────────────────────────────────────────
export const Settings = (props: Props) => {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  if (isMobile) {
    return (
      <div className="absolute z-40 w-full h-full bg-white/80 backdrop-blur">
        <SettingsContent {...props} isMobile={true} />
      </div>
    );
  }

  return <SettingsDesktopWrapper {...props} />;
};

const SettingsDesktopWrapper = (props: Props) => {
  const [popupBlocked, setPopupBlocked] = useState(false);

  useEffect(() => {
    const test = window.open("", "_blank", "width=1,height=1");
    if (!test || test.closed) {
      setPopupBlocked(true);
    } else {
      test.close();
    }
  }, []);

  if (popupBlocked) {
    return (
      <div className="absolute z-40 w-full h-full bg-white/80 backdrop-blur">
        <SettingsContent {...props} isMobile={false} />
      </div>
    );
  }

  return (
    <div className="absolute z-40 w-full h-full bg-white/80 backdrop-blur">
      <SettingsContent {...props} isMobile={false} />
    </div>
  );
};
