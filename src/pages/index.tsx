import { useCallback, useContext, useEffect, useState } from "react";
import VrmViewer from "@/components/vrmViewer";
import { ViewerContext } from "@/features/vrmViewer/viewerContext";
import {
  Message,
  textsToScreenplay,
  Screenplay,
} from "@/features/messages/messages";
import { speakCharacter } from "@/features/messages/speakCharacter";
import { MessageInputContainer } from "@/components/messageInputContainer";
import { SYSTEM_PROMPT } from "@/features/constants/systemPromptConstants";
import { KoeiroParam, DEFAULT_PARAM } from "@/features/constants/koeiroParam";
import { getChatResponseStream } from "@/features/chat/multiProviderChat";
import { Introduction } from "@/components/introduction";
import { Menu } from "@/components/menu";
import { GitHubLink } from "@/components/githubLink";
import { Meta } from "@/components/meta";
import { TwitchOverlay } from "@/components/twitchOverlay";
import { ScreenShareBackground } from "@/components/screenShareBackground";
import {
  TTSConfig,
  DEFAULT_TTS_CONFIG,
} from "@/features/tts/ttsConfig";
import {
  TwitchConfig,
  TwitchMessage,
  DEFAULT_TWITCH_CONFIG,
  twitchClient,
} from "@/features/twitch/twitchClient";
import {
  ScreenShareConfig,
  DEFAULT_SCREEN_SHARE_CONFIG,
  startScreenShare,
  stopScreenShare,
  buildVdoNinjaUrl,
} from "@/features/screenShare/screenShare";
import {
  AIProviderConfig,
  DEFAULT_AI_CONFIG,
  getProviderMeta,
} from "@/features/chat/aiProviders";

export default function Home() {
  const { viewer } = useContext(ViewerContext);

  const [systemPrompt, setSystemPrompt] = useState(SYSTEM_PROMPT);
  const [aiConfig, setAiConfig] = useState<AIProviderConfig>(DEFAULT_AI_CONFIG);
  const [koeiroParam, setKoeiroParam] = useState<KoeiroParam>(DEFAULT_PARAM);
  const [ttsConfig, setTtsConfig] = useState<TTSConfig>(DEFAULT_TTS_CONFIG);
  const [chatProcessing, setChatProcessing] = useState(false);
  const [chatLog, setChatLog] = useState<Message[]>([]);
  const [assistantMessage, setAssistantMessage] = useState("");

  // Twitch
  const [twitchConfig, setTwitchConfig] = useState<TwitchConfig>(DEFAULT_TWITCH_CONFIG);
  const [twitchConnected, setTwitchConnected] = useState(false);
  const [twitchMessages, setTwitchMessages] = useState<TwitchMessage[]>([]);

  // Screen Share
  const [screenShareConfig, setScreenShareConfig] = useState<ScreenShareConfig>(
    DEFAULT_SCREEN_SHARE_CONFIG
  );
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [vdoninjaUrl, setVdoninjaUrl] = useState("");

  // ── Persist settings ──────────────────────────────────────────────────────
  useEffect(() => {
    const saved = window.localStorage.getItem("chatVRMParams");
    if (saved) {
      try {
        const params = JSON.parse(saved);
        setSystemPrompt(params.systemPrompt ?? SYSTEM_PROMPT);
        setKoeiroParam(params.koeiroParam ?? DEFAULT_PARAM);
        setChatLog(params.chatLog ?? []);
        if (params.aiConfig) setAiConfig({ ...DEFAULT_AI_CONFIG, ...params.aiConfig });
        if (params.ttsConfig) setTtsConfig({ ...DEFAULT_TTS_CONFIG, ...params.ttsConfig });
        if (params.twitchConfig)
          setTwitchConfig({ ...DEFAULT_TWITCH_CONFIG, ...params.twitchConfig });
      } catch (_) {}
    }
  }, []);

  useEffect(() => {
    process.nextTick(() =>
      window.localStorage.setItem(
        "chatVRMParams",
        JSON.stringify({
          systemPrompt,
          koeiroParam,
          chatLog,
          aiConfig,
          ttsConfig,
          twitchConfig,
        })
      )
    );
  }, [systemPrompt, koeiroParam, chatLog, aiConfig, ttsConfig, twitchConfig]);

  // ── Chat log handlers ─────────────────────────────────────────────────────
  const handleChangeChatLog = useCallback(
    (targetIndex: number, text: string) => {
      setChatLog((prev) =>
        prev.map((v, i) => (i === targetIndex ? { role: v.role, content: text } : v))
      );
    },
    []
  );

  // ── Speak AI ──────────────────────────────────────────────────────────────
  const handleSpeakAi = useCallback(
    async (
      screenplay: Screenplay,
      onStart?: () => void,
      onEnd?: () => void
    ) => {
      speakCharacter(screenplay, viewer, ttsConfig, koeiroParam, onStart, onEnd);
    },
    [viewer, ttsConfig, koeiroParam]
  );

  // ── Send chat ─────────────────────────────────────────────────────────────
  const handleSendChat = useCallback(
    async (text: string) => {
      const providerMeta = getProviderMeta(aiConfig.provider);
      const needsKey = providerMeta.requiresKey;

      if (needsKey && !aiConfig.apiKey) {
        setAssistantMessage(
          `Please enter your ${providerMeta.label} API key in Settings.`
        );
        return;
      }
      if (!text?.trim()) return;

      setChatProcessing(true);

      const messageLog: Message[] = [
        ...chatLog,
        { role: "user", content: text },
      ];
      setChatLog(messageLog);

      const messages: Message[] = [
        { role: "system", content: systemPrompt },
        ...messageLog,
      ];

      const stream = await getChatResponseStream(messages, aiConfig).catch((e) => {
        console.error(e);
        return null;
      });

      if (!stream) {
        setChatProcessing(false);
        return;
      }

      const reader = stream.getReader();
      let receivedMessage = "";
      let aiTextLog = "";
      let tag = "";
      const sentences = new Array<string>();

      try {
        while (true) {
          const { done, value } = await reader.read();

          // ── FIX: flush whatever remains when the stream ends ──────────────
          if (done) {
            const remaining = receivedMessage.trim();
            if (remaining) {
              const aiText = `${tag} ${remaining}`;
              const aiTalks = textsToScreenplay([aiText], koeiroParam);
              aiTextLog += aiText;
              sentences.push(remaining);
              const currentAssistantMessage = sentences.join(" ");
              handleSpeakAi(aiTalks[0], () => {
                setAssistantMessage(currentAssistantMessage);
              });
            }
            break;
          }

          receivedMessage += value;

          const tagMatch = receivedMessage.match(/^\[(.*?)\]/);
          if (tagMatch && tagMatch[0]) {
            tag = tagMatch[0];
            receivedMessage = receivedMessage.slice(tag.length);
          }

          // ── FIX: only split on real sentence-ending punctuation, not commas ──
          const sentenceMatch = receivedMessage.match(
            /^(.+[。．！？\n])/
          );
          if (sentenceMatch && sentenceMatch[0]) {
            const sentence = sentenceMatch[0];
            sentences.push(sentence);
            receivedMessage = receivedMessage.slice(sentence.length).trimStart();

            if (
              !sentence.replace(
                /^[\s\[\(\{「［（【『〈《〔｛«‹〘〚〛〙›»〕》〉』】）］」\}\)\]]+$/g,
                ""
              )
            ) {
              continue;
            }

            const aiText = `${tag} ${sentence}`;
            const aiTalks = textsToScreenplay([aiText], koeiroParam);
            aiTextLog += aiText;

            const currentAssistantMessage = sentences.join(" ");
            handleSpeakAi(aiTalks[0], () => {
              setAssistantMessage(currentAssistantMessage);
            });
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        reader.releaseLock();
      }

      setChatLog([...messageLog, { role: "assistant", content: aiTextLog }]);
      setChatProcessing(false);
    },
    [systemPrompt, chatLog, handleSpeakAi, aiConfig, koeiroParam]
  );

  // ── Twitch ────────────────────────────────────────────────────────────────
  const handleTwitchConnect = useCallback(() => {
    twitchClient.connect(twitchConfig.channel, twitchConfig.oauthToken);

    const unsub = twitchClient.onMessage((msg) => {
      setTwitchMessages((prev) => [...prev.slice(-49), msg]);

      if (twitchConfig.respondToChat && !chatProcessing) {
        const prompt = `[Twitch chat] ${msg.username}: ${msg.message}`;
        handleSendChat(prompt);
      }
    });

    setTwitchConnected(true);
    (window as any).__twitchUnsub = unsub;
  }, [twitchConfig, chatProcessing, handleSendChat]);

  const handleTwitchDisconnect = useCallback(() => {
    twitchClient.disconnect();
    setTwitchConnected(false);
    if (typeof (window as any).__twitchUnsub === "function") {
      (window as any).__twitchUnsub();
    }
  }, []);

  // ── Screen Share ──────────────────────────────────────────────────────────
  const handleScreenShareStop = useCallback(() => {
    stopScreenShare();
    setScreenStream(null);
    setVdoninjaUrl("");
    setScreenShareConfig((prev) => ({ ...prev, active: false }));
  }, []);

  const handleScreenShareStart = useCallback(async () => {
    if (screenShareConfig.mode === "vdoninja") {
      const roomId = screenShareConfig.vdoninjaRoomId || "chatvrm-stream";
      const url = buildVdoNinjaUrl(roomId);
      setVdoninjaUrl(url);
      setScreenShareConfig((prev) => ({ ...prev, active: true }));
      window.open(
        `https://vdo.ninja/?push=${encodeURIComponent(roomId)}&screenshare`,
        "_blank"
      );
    } else {
      try {
        const stream = await startScreenShare();
        setScreenStream(stream);
        setScreenShareConfig((prev) => ({ ...prev, active: true }));
        stream.getVideoTracks()[0].addEventListener("ended", () => {
          handleScreenShareStop();
        });
      } catch (e) {
        console.error("Screen share cancelled or failed", e);
      }
    }
  }, [screenShareConfig, handleScreenShareStop]);

  const handleChangeTtsConfig = useCallback((config: TTSConfig) => {
    setTtsConfig(config);
  }, []);

  return (
    <div className={"font-M_PLUS_2"}>
      <Meta />
      <Introduction aiConfig={aiConfig} onChangeAiConfig={setAiConfig} />

      <ScreenShareBackground
        stream={screenStream}
        vdoninjaUrl={vdoninjaUrl}
        mode={screenShareConfig.mode}
        active={screenShareConfig.active}
      />

      <VrmViewer />

      <MessageInputContainer
        isChatProcessing={chatProcessing}
        onChatProcessStart={handleSendChat}
      />

      <Menu
        aiConfig={aiConfig}
        systemPrompt={systemPrompt}
        chatLog={chatLog}
        ttsConfig={ttsConfig}
        koeiroParam={koeiroParam}
        assistantMessage={assistantMessage}
        twitchConfig={twitchConfig}
        twitchConnected={twitchConnected}
        screenShareConfig={screenShareConfig}
        onChangeAiConfig={setAiConfig}
        onChangeSystemPrompt={setSystemPrompt}
        onChangeChatLog={handleChangeChatLog}
        onChangeTTSConfig={handleChangeTtsConfig}
        onChangeKoeiroParam={(x, y) => setKoeiroParam({ speakerX: x, speakerY: y })}
        handleClickResetChatLog={() => setChatLog([])}
        handleClickResetSystemPrompt={() => setSystemPrompt(SYSTEM_PROMPT)}
        onChangeTwitchConfig={setTwitchConfig}
        onTwitchConnect={handleTwitchConnect}
        onTwitchDisconnect={handleTwitchDisconnect}
        onChangeScreenShareConfig={setScreenShareConfig}
        onScreenShareStart={handleScreenShareStart}
        onScreenShareStop={handleScreenShareStop}
      />

      {twitchConfig.readChat && (
        <TwitchOverlay
          messages={twitchMessages}
          isConnected={twitchConnected}
          channel={twitchConfig.channel}
        />
      )}

      <GitHubLink />
    </div>
  );
}
