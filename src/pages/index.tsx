import { useCallback, useContext, useEffect, useRef, useState } from "react";
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
import { getChatResponseStream, truncateHistory, RateLimitError } from "@/features/chat/multiProviderChat";
import { Introduction } from "@/components/introduction";
import { Menu } from "@/components/menu";
import { GitHubLink } from "@/components/githubLink";
import { Meta } from "@/components/meta";
import { TwitchOverlay } from "@/components/twitchOverlay";
import { ScreenShareBackground } from "@/components/screenShareBackground";
import { BackgroundRenderer } from "@/components/backgroundRenderer";
import { LoadingScreen } from "@/components/loadingScreen";
import { TTSConfig, DEFAULT_TTS_CONFIG } from "@/features/tts/ttsConfig";
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
} from "@/features/screenShare/screenShare";
import {
  AIProviderConfig,
  DEFAULT_AI_CONFIG,
  getProviderMeta,
} from "@/features/chat/aiProviders";
import {
  BackgroundConfig,
  DEFAULT_BACKGROUND_CONFIG,
} from "@/features/background/backgroundConfig";
import { SettingsSnapshot } from "@/features/settings/settingsPorter";
import { useAutoHide } from "@/hooks/useAutoHide";
import { CaptionStyle, DEFAULT_CAPTION_STYLE } from "@/components/captionSettings";
import { VisionConfig, DEFAULT_VISION_CONFIG } from "@/features/vision/visionConfig";
import { useVision } from "@/features/vision/useVision";
import { buildUrl } from "@/utils/buildUrl";
import {
  DiscordConfig,
  DEFAULT_DISCORD_CONFIG,
} from "@/features/discord/discordConfig";
import { discordClient } from "@/features/discord/discordClient";
import { DiscordOverlay } from "@/components/discordOverlay";
import { AlertOverlay } from "@/components/alertOverlay";
import { AdBreakConfig, DEFAULT_AD_BREAK_CONFIG } from "@/features/adBreak/adBreakConfig";
import { useAdBreak } from "@/features/adBreak/useAdBreak";
import {
  AutonomousConfig,
  DEFAULT_AUTONOMOUS_CONFIG,
} from "@/features/autonomous/autonomousConfig";
import { useAutonomousMode } from "@/features/autonomous/useAutonomousMode";
import { eventSubClient } from "@/features/twitch/eventSubClient";
import {
  fireFollowAlert,
  fireRaidAlert,
  fireSubAlert,
  fireResubAlert,
  fireStreakAlert,
  fireBitsAlert,
} from "@/features/twitch/twitchAlerts";
import { EmoteWallOverlay } from "@/components/emoteWallOverlay";
import { spawnEmojiFromChat, setChannelEmotes } from "@/features/emoteWall/emoteWallQueue";
import { extractEmojis } from "@/features/emoteWall/emojiDetect";
import { fetchChannelEmoteUrls } from "@/features/twitch/twitchEmotes";
import { pollPredictionStore } from "@/features/pollPrediction/pollPredictionStore";
import { parseSlashCommand, extractAiDirective } from "@/features/pollPrediction/pollParser";
import { createTwitchPoll, createTwitchPrediction } from "@/features/twitch/twitchPollsApi";
import { DiscordMessage, DiscordVoiceEvent } from "@/features/discord/discordConfig";

// VRM model localStorage key
const VRM_URL_KEY = "chatVRM_lastVrmUrl";
const VRM_IS_DEFAULT_KEY = "chatVRM_isDefaultVrm";

// ── CJK detection ─────────────────────────────────────────────────────────────
function isCJKHeavy(text: string): boolean {
  const cjkMatches = text.match(/[\u3000-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]/g);
  if (!cjkMatches) return false;
  return cjkMatches.length / text.length > 0.2;
}

// ── Asterisk action stripper ──────────────────────────────────────────────────
function stripAsteriskActions(text: string): string {
  let clean = text.replace(/\*[^*\r\n]+\*/g, "");
  clean = clean.replace(/\*/g, "");
  return clean.replace(/\s{2,}/g, " ").trim();
}

export default function Home() {
  const { viewer } = useContext(ViewerContext);
  const uiVisible = useAutoHide(3000);

  const [isLoading, setIsLoading] = useState(true);
  const [systemPrompt, setSystemPrompt] = useState(SYSTEM_PROMPT);
  const [aiConfig, setAiConfig] = useState<AIProviderConfig>(DEFAULT_AI_CONFIG);
  const [koeiroParam, setKoeiroParam] = useState<KoeiroParam>(DEFAULT_PARAM);
  const [ttsConfig, setTtsConfig] = useState<TTSConfig>(DEFAULT_TTS_CONFIG);
  const [chatProcessing, setChatProcessing] = useState(false);
  const [chatLog, setChatLog] = useState<Message[]>([]);
  const [assistantMessage, setAssistantMessage] = useState("");
  const [backgroundConfig, setBackgroundConfig] = useState<BackgroundConfig>(
    DEFAULT_BACKGROUND_CONFIG
  );
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(DEFAULT_CAPTION_STYLE);
  const [visionConfig, setVisionConfig] = useState<VisionConfig>(DEFAULT_VISION_CONFIG);

  // Twitch
  const [twitchConfig, setTwitchConfig] = useState<TwitchConfig>(DEFAULT_TWITCH_CONFIG);
  const [twitchConnected, setTwitchConnected] = useState(false);
  const [activeTwitchMessage, setActiveTwitchMessage] = useState<TwitchMessage | null>(null);
  const [twitchQueueCount, setTwitchQueueCount] = useState(0);

  // Discord
  const [discordConfig, setDiscordConfig] = useState<DiscordConfig>(DEFAULT_DISCORD_CONFIG);
  const [discordConnected, setDiscordConnected] = useState(false);
  const [discordConnectionError, setDiscordConnectionError] = useState<string | null>(null);
  const [discordMessages, setDiscordMessages] = useState<DiscordMessage[]>([]);
  const [discordVoiceEvents, setDiscordVoiceEvents] = useState<DiscordVoiceEvent[]>([]);

  // Screen Share
  const [screenShareConfig, setScreenShareConfig] = useState<ScreenShareConfig>(
    DEFAULT_SCREEN_SHARE_CONFIG
  );
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [vdoninjaUrl, setVdoninjaUrl] = useState("");

  // Ad break + autonomous mode
  const [adBreakConfig, setAdBreakConfig] = useState<AdBreakConfig>(DEFAULT_AD_BREAK_CONFIG);
  const [autonomousConfig, setAutonomousConfig] = useState<AutonomousConfig>(
    DEFAULT_AUTONOMOUS_CONFIG
  );
  const chatProcessingRef = useRef(false);

  // Twitch EventSub (follow/raid/sub/resub/bits/streak alerts)
  const [eventSubStatus, setEventSubStatus] = useState<
    "idle" | "connecting" | "connected" | "error" | "disconnected"
  >("idle");
  const [eventSubError, setEventSubError] = useState<string | null>(null);
  const twitchBroadcasterIdRef = useRef<string>("");

  // ── Twitch message queue ───────────────────────────────────────────────────
  const twitchQueueRef = useRef<TwitchMessage[]>([]);
  const twitchProcessingRef = useRef(false);
  const bannedTwitchUsersRef = useRef<Set<string>>(new Set());

  const sendChatRef = useRef<(text: string) => Promise<void>>(async () => {});
  const twitchUnsubRef = useRef<(() => void) | null>(null);
  const twitchCmdUnsubRef = useRef<(() => void) | null>(null);
  const twitchBanUnsubRef = useRef<(() => void) | null>(null);

  // Discord unsub refs
  const discordMsgUnsubRef = useRef<(() => void) | null>(null);
  const discordVoiceUnsubRef = useRef<(() => void) | null>(null);
  const discordStatusUnsubRef = useRef<(() => void) | null>(null);

  // ── Persist / restore settings ─────────────────────────────────────────────
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
        if (params.discordConfig)
          setDiscordConfig({ ...DEFAULT_DISCORD_CONFIG, ...params.discordConfig });
        if (params.backgroundConfig)
          setBackgroundConfig({ ...DEFAULT_BACKGROUND_CONFIG, ...params.backgroundConfig });
        if (params.captionStyle)
          setCaptionStyle({ ...DEFAULT_CAPTION_STYLE, ...params.captionStyle });
        if (params.visionConfig)
          setVisionConfig({ ...DEFAULT_VISION_CONFIG, ...params.visionConfig });
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
          discordConfig,
          backgroundConfig,
          captionStyle,
          visionConfig,
        })
      )
    );
  }, [systemPrompt, koeiroParam, chatLog, aiConfig, ttsConfig, twitchConfig, discordConfig, backgroundConfig, captionStyle, visionConfig]);

  // ── VRM model persistence ──────────────────────────────────────────────────
  const [viewerReady, setViewerReady] = useState(false);

  useEffect(() => {
    const check = setInterval(() => {
      if (viewer.isReady) {
        setViewerReady(true);
        clearInterval(check);
      }
    }, 100);
    return () => clearInterval(check);
  }, [viewer]);

  useEffect(() => {
    if (!viewerReady || isLoading) return;

    const savedUrl = localStorage.getItem(VRM_URL_KEY);
    const isDefault = localStorage.getItem(VRM_IS_DEFAULT_KEY);

    if (savedUrl && isDefault !== "true") {
      viewer.loadVrm(savedUrl);
    } else {
      const defaultUrl = buildUrl("/AvatarSample_B.vrm");
      viewer.loadVrm(defaultUrl);
      localStorage.setItem(VRM_URL_KEY, defaultUrl);
      localStorage.setItem(VRM_IS_DEFAULT_KEY, "true");
    }
  }, [viewerReady, isLoading, viewer]);

  const handleVrmFileLoad = useCallback((url: string) => {
    viewer.loadVrm(url);
    localStorage.setItem(VRM_URL_KEY, url);
    localStorage.setItem(VRM_IS_DEFAULT_KEY, "false");
  }, [viewer]);

  const saveSettingsNow = useCallback(() => {
    window.localStorage.setItem(
      "chatVRMParams",
      JSON.stringify({
        systemPrompt,
        koeiroParam,
        chatLog,
        aiConfig,
        ttsConfig,
        twitchConfig,
        discordConfig,
        backgroundConfig,
        captionStyle,
        visionConfig,
      })
    );
  }, [systemPrompt, koeiroParam, chatLog, aiConfig, ttsConfig, twitchConfig, discordConfig, backgroundConfig, captionStyle, visionConfig]);

  const handleResetCommand = useCallback(() => {
    setChatLog([]);
    setAssistantMessage("");
    twitchQueueRef.current = [];
    twitchProcessingRef.current = false;
    setActiveTwitchMessage(null);
    setTwitchQueueCount(0);
    const savedUrl = localStorage.getItem(VRM_URL_KEY);
    if (savedUrl) {
      viewer.loadVrm(savedUrl);
    } else {
      viewer.loadVrm(buildUrl("/AvatarSample_B.vrm"));
    }
  }, [viewer]);

  const handleLoadSettings = useCallback((snapshot: SettingsSnapshot) => {
    setSystemPrompt(snapshot.systemPrompt);
    setAiConfig({ ...DEFAULT_AI_CONFIG, ...snapshot.aiConfig });
    setTtsConfig({ ...DEFAULT_TTS_CONFIG, ...snapshot.ttsConfig });
    setKoeiroParam({ ...DEFAULT_PARAM, ...snapshot.koeiroParam });
    setBackgroundConfig({
      ...DEFAULT_BACKGROUND_CONFIG,
      ...snapshot.backgroundConfig,
      imageUrl: "",
    });
  }, []);

  const handleChangeChatLog = useCallback(
    (targetIndex: number, text: string) => {
      setChatLog((prev) =>
        prev.map((v, i) => (i === targetIndex ? { role: v.role, content: text } : v))
      );
    },
    []
  );

  const handleSpeakAi = useCallback(
    (
      screenplay: Screenplay,
      onStart?: () => void,
      onEnd?: () => void
    ) => {
      speakCharacter(screenplay, viewer, ttsConfig, koeiroParam, onStart, onEnd);
    },
    [viewer, ttsConfig, koeiroParam]
  );

  // ── Core send-chat function ────────────────────────────────────────────────
  const handleSendChat = useCallback(
    async (text: string): Promise<void> => {
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

      const allMessages: Message[] = [
        { role: "system", content: systemPrompt },
        ...messageLog,
      ];

      const messages = truncateHistory(allMessages, aiConfig.provider);

      const stream = await getChatResponseStream(messages, aiConfig).catch((e) => {
        console.error(e);
        const isRateLimit = e instanceof RateLimitError;
        setAssistantMessage(
          isRateLimit
            ? `${getProviderMeta(aiConfig.provider).label} is rate-limiting requests right now — I'll respond again in a moment.`
            : `Something went wrong talking to ${getProviderMeta(aiConfig.provider).label} — check Settings if this keeps happening.`
        );
        return null;
      });

      if (!stream) {
        setChatProcessing(false);
        return;
      }

      const reader = stream.getReader();

      let fullResponse = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) fullResponse += value;
        }
      } catch (e) {
        console.error("[stream read]", e);
      } finally {
        reader.releaseLock();
      }

      const rawCleaned = stripAsteriskActions(fullResponse);
      if (!rawCleaned.trim()) {
        setChatProcessing(false);
        return;
      }

      // If the AI decided to start a poll/prediction (wrote a
      // "[POLL: ...]" / "[PREDICTION: ...]" tag), pull that out, fire the
      // Twitch API call, and don't speak the raw tag syntax aloud.
      const { cleanedText: cleanedResponse, directive } = extractAiDirective(rawCleaned);
      if (directive && twitchConfig.clientId && twitchConfig.oauthToken && twitchBroadcasterIdRef.current) {
        const create =
          directive.kind === "poll"
            ? createTwitchPoll(
                twitchConfig.clientId,
                twitchConfig.oauthToken,
                twitchBroadcasterIdRef.current,
                directive.question,
                directive.options
              )
            : createTwitchPrediction(
                twitchConfig.clientId,
                twitchConfig.oauthToken,
                twitchBroadcasterIdRef.current,
                directive.question,
                directive.options
              );
        create.then((r) => {
          if (!r.ok) console.error(`[${directive.kind}] Failed to create:`, r.error);
        });
      }

      if (!cleanedResponse.trim()) {
        setChatProcessing(false);
        return;
      }

      const aiTalks = textsToScreenplay([cleanedResponse], koeiroParam);

      if (aiTalks.length === 0) {
        setChatProcessing(false);
        return;
      }

      const displayText = cleanedResponse;

      await new Promise<void>((resolve) => {
        handleSpeakAi(
          aiTalks[0],
          () => {
            setAssistantMessage(displayText);
          },
          () => {
            const displayResponse = stripAsteriskActions(cleanedResponse);
            setChatLog([
              ...messageLog,
              { role: "assistant", content: displayResponse },
            ]);
            setChatProcessing(false);
            resolve();
          }
        );
      });
    },
    [systemPrompt, chatLog, handleSpeakAi, aiConfig, koeiroParam, twitchConfig]
  );

  useEffect(() => {
    sendChatRef.current = handleSendChat;
  }, [handleSendChat]);

  useEffect(() => {
    chatProcessingRef.current = chatProcessing;
  }, [chatProcessing]);

  // ── Ad break countdown ─────────────────────────────────────────────────────
  const sendPromptStable = useCallback(
    (text: string) => sendChatRef.current(text),
    []
  );

  const { startAdCountdown } = useAdBreak({
    config: adBreakConfig,
    isTwitchActive: () => twitchConfig.enabled && twitchConnected,
    sendPrompt: sendPromptStable,
  });

  // ── Autonomous mode ────────────────────────────────────────────────────────
  const { isActive: autonomousActive, notifyActivity } = useAutonomousMode({
    config: autonomousConfig,
    isChatProcessingRef: chatProcessingRef,
    sendPrompt: sendPromptStable,
  });

  // Wraps the local message box's send so it also counts as "real activity"
  // for autonomous mode (deactivates it / resets the idle clock). Also
  // intercepts "/poll ..." and "/prediction ..." as UI commands rather than
  // sending them to the AI as conversation.
  const handleLocalSendChat = useCallback(
    async (text: string) => {
      notifyActivity();

      const slash = parseSlashCommand(text);
      if (slash) {
        if (!twitchConfig.clientId || !twitchConfig.oauthToken || !twitchBroadcasterIdRef.current) {
          setAssistantMessage(
            "I need Twitch alerts connected (Client ID + token) before I can start a poll or prediction."
          );
          return;
        }
        const result =
          slash.kind === "poll"
            ? await createTwitchPoll(
                twitchConfig.clientId,
                twitchConfig.oauthToken,
                twitchBroadcasterIdRef.current,
                slash.question,
                slash.options
              )
            : await createTwitchPrediction(
                twitchConfig.clientId,
                twitchConfig.oauthToken,
                twitchBroadcasterIdRef.current,
                slash.question,
                slash.options
              );
        if (result.ok) {
          await sendChatRef.current(
            `[${slash.kind === "poll" ? "Poll" : "Prediction"} Started] You just started a ${slash.kind} asking: "${slash.question}". Briefly hype it up for viewers.`
          );
        } else {
          setAssistantMessage(`Couldn't start the ${slash.kind}: ${result.error}`);
        }
        return;
      }

      await sendChatRef.current(text);
    },
    [notifyActivity, twitchConfig]
  );

  // ── Alert test buttons (Settings > Twitch) ────────────────────────────────
  const handleTestFollow = useCallback(
    () => fireFollowAlert("TestFollower", sendPromptStable),
    [sendPromptStable]
  );
  const handleTestRaid = useCallback(
    () => fireRaidAlert("TestRaider", 25, sendPromptStable),
    [sendPromptStable]
  );
  const handleTestSub = useCallback(
    () => fireSubAlert("TestSubscriber", "1000", sendPromptStable),
    [sendPromptStable]
  );
  const handleTestResub = useCallback(
    () => fireResubAlert("TestSubscriber", 8, sendPromptStable),
    [sendPromptStable]
  );
  const handleTestStreak = useCallback(
    () => fireStreakAlert("TestSubscriber", 3, sendPromptStable),
    [sendPromptStable]
  );
  const handleTestBits = useCallback(
    () => fireBitsAlert("TestCheerer", 500, "Great stream!", sendPromptStable),
    [sendPromptStable]
  );

  // ── Twitch queue processor ─────────────────────────────────────────────────
  // Shows exactly one message on screen: the one Miko is currently replying
  // to. Drops any message from a user who got banned while it was waiting in
  // line, so the AI never responds to a spambot the mod bots already caught.
  const processTwitchQueue = useCallback(async () => {
    if (twitchProcessingRef.current) return;
    twitchProcessingRef.current = true;

    while (twitchQueueRef.current.length > 0) {
      const next = twitchQueueRef.current.shift()!;
      setTwitchQueueCount(twitchQueueRef.current.length);

      if (bannedTwitchUsersRef.current.has(next.username.toLowerCase())) {
        continue;
      }

      setActiveTwitchMessage(next);
      notifyActivity();
      const prompt = `[Twitch chat] ${next.username}: ${next.message}`;
      await sendChatRef.current(prompt);

      // Only clear if a ban handler hasn't already cleared it early
      setActiveTwitchMessage((cur) => (cur === next ? null : cur));
    }

    twitchProcessingRef.current = false;
  }, [notifyActivity]);

  // ── Vision ─────────────────────────────────────────────────────────────────
  const effectiveVisionConfig: VisionConfig = {
    ...visionConfig,
    groqApiKey:
      visionConfig.groqApiKey ||
      (aiConfig.provider === "groq" ? aiConfig.apiKey ?? "" : ""),
  };

  const {
    status: visionStatus,
    lastDescription: visionLastDescription,
    lastCaptureTime: visionLastCaptureTime,
    secondsUntilNext: visionSecondsUntilNext,
    captureNow: visionCaptureNow,
    error: visionError,
  } = useVision(
    effectiveVisionConfig,
    screenStream,
    screenShareConfig.mode,
    systemPrompt,
    (description) => sendChatRef.current(description)
  );

  // ── Twitch ─────────────────────────────────────────────────────────────────
  const handleTwitchConnect = useCallback(() => {
    twitchUnsubRef.current?.();
    twitchCmdUnsubRef.current?.();
    twitchBanUnsubRef.current?.();

    twitchClient.connect(twitchConfig.channel, twitchConfig.oauthToken);

    const unsub = twitchClient.onMessage((msg) => {
      // Emote wall: fires on any chat emoji regardless of whether the AI is
      // set to respond to chat — this is purely visual, gated only on the
      // Twitch connection itself being active.
      const emojis = extractEmojis(msg.message);
      if (emojis.length > 0) {
        spawnEmojiFromChat(emojis);
      }

      if (!twitchConfig.respondToChat) return;

      const trimmed = msg.message.trim();
      if (trimmed.startsWith("!")) return;
      if (/^@\S+/.test(trimmed)) return;
      if (bannedTwitchUsersRef.current.has(msg.username.toLowerCase())) return;

      twitchQueueRef.current.push(msg);
      setTwitchQueueCount(twitchQueueRef.current.length);
      processTwitchQueue();
    });

    const cmdUnsub = twitchClient.onCommand((command) => {
      if (command === "!reset") {
        handleResetCommand();
      } else if (command === "!ad") {
        startAdCountdown();
      }
    });

    // Spambot bans/timeouts: drop any of their messages still waiting in the
    // queue, and immediately hide the on-screen box if it's theirs right now.
    const banUnsub = twitchClient.onBan((e) => {
      const uname = e.username.toLowerCase();
      bannedTwitchUsersRef.current.add(uname);

      twitchQueueRef.current = twitchQueueRef.current.filter(
        (m) => m.username.toLowerCase() !== uname
      );
      setTwitchQueueCount(twitchQueueRef.current.length);

      setActiveTwitchMessage((cur) =>
        cur && cur.username.toLowerCase() === uname ? null : cur
      );
    });

    twitchUnsubRef.current = unsub;
    twitchCmdUnsubRef.current = cmdUnsub;
    twitchBanUnsubRef.current = banUnsub;
    setTwitchConnected(true);

    // ── EventSub alerts (follow/raid/sub/resub/bits/streak) ──────────────────
    // Reuses the same OAuth token as chat, as long as it was generated with
    // the broader scopes EventSub needs (see Settings > Twitch).
    if (twitchConfig.alertsEnabled && twitchConfig.clientId && twitchConfig.oauthToken) {
      eventSubClient.connect({
        clientId: twitchConfig.clientId,
        accessToken: twitchConfig.oauthToken,
        channelLogin: twitchConfig.channel,
        handlers: {
          onFollow: (name) => fireFollowAlert(name, sendPromptStable),
          onRaid: (name, viewers) => fireRaidAlert(name, viewers, sendPromptStable),
          onSub: (name, tier) => fireSubAlert(name, tier, sendPromptStable),
          onResub: (name, months, streak) => {
            if (streak !== null) {
              fireStreakAlert(name, streak, sendPromptStable);
            } else {
              fireResubAlert(name, months, sendPromptStable);
            }
          },
          onBits: (name, bits, message) => fireBitsAlert(name, bits, message, sendPromptStable),
          onStatus: (status, detail) => {
            setEventSubStatus(status === "disconnected" ? "disconnected" : status);
            setEventSubError(detail ?? null);
          },
          onBroadcasterId: (id) => {
            twitchBroadcasterIdRef.current = id;
            fetchChannelEmoteUrls(twitchConfig.clientId!, twitchConfig.oauthToken!, id).then(
              setChannelEmotes
            );
          },
          onPollBegin: (id, title, options) => {
            pollPredictionStore.setState({
              kind: "poll",
              id,
              title,
              options: options.map((o) => ({ title: o, votes: 0 })),
              status: "active",
            });
          },
          onPollProgress: (id, options) => {
            pollPredictionStore.update({ id, options, kind: "poll" } as any);
          },
          onPollEnd: (id, options) => {
            pollPredictionStore.update({ id, options, status: "ended", kind: "poll" } as any);
            const winner = [...options].sort((a, b) => b.votes - a.votes)[0];
            sendPromptStable(
              `[Poll Ended] The poll just ended. "${winner?.title}" won with ${winner?.votes} votes! Announce the winner briefly.`
            );
            pollPredictionStore.finish(60000);
          },
          onPredictionBegin: (id, title, outcomes) => {
            pollPredictionStore.setState({
              kind: "prediction",
              id,
              title,
              outcomes: outcomes.map((o) => ({ title: o, users: 0, points: 0 })),
              status: "active",
            });
          },
          onPredictionProgress: (id, outcomes) => {
            pollPredictionStore.update({ id, outcomes, kind: "prediction" } as any);
          },
          onPredictionLock: (id, outcomes) => {
            pollPredictionStore.update({
              id,
              outcomes,
              status: "locked",
              kind: "prediction",
            } as any);
          },
          onPredictionEnd: (id, outcomes, winningOutcome) => {
            pollPredictionStore.update({
              id,
              outcomes,
              status: "ended",
              kind: "prediction",
            } as any);
            sendPromptStable(
              winningOutcome
                ? `[Prediction Ended] The prediction just resolved. "${winningOutcome}" was correct! Announce the result briefly.`
                : `[Prediction Ended] The prediction was canceled. Briefly let viewers know.`
            );
            pollPredictionStore.finish(60000);
          },
        },
      });
    }
  }, [twitchConfig, processTwitchQueue, handleResetCommand, startAdCountdown, sendPromptStable]);

  const handleTwitchDisconnect = useCallback(() => {
    twitchClient.disconnect();
    eventSubClient.disconnect();
    setEventSubStatus("idle");
    setEventSubError(null);
    pollPredictionStore.clear();
    setChannelEmotes([]);
    setTwitchConnected(false);
    twitchQueueRef.current = [];
    twitchProcessingRef.current = false;
    bannedTwitchUsersRef.current = new Set();
    setActiveTwitchMessage(null);
    setTwitchQueueCount(0);
    twitchUnsubRef.current?.();
    twitchCmdUnsubRef.current?.();
    twitchBanUnsubRef.current?.();
    twitchUnsubRef.current = null;
    twitchCmdUnsubRef.current = null;
    twitchBanUnsubRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      twitchUnsubRef.current?.();
      twitchCmdUnsubRef.current?.();
      twitchBanUnsubRef.current?.();
      eventSubClient.disconnect();
    };
  }, []);

  // ── Discord ────────────────────────────────────────────────────────────────
  const handleDiscordConnect = useCallback(() => {
    // Clean up previous subscriptions
    discordMsgUnsubRef.current?.();
    discordVoiceUnsubRef.current?.();
    discordStatusUnsubRef.current?.();

    setDiscordConnectionError(null);

    const statusUnsub = discordClient.onStatus((connected, error) => {
      setDiscordConnected(connected);
      if (error) setDiscordConnectionError(error);
      else setDiscordConnectionError(null);
    });

    const msgUnsub = discordClient.onMessage((msg) => {
      setDiscordMessages((prev) => [...prev.slice(-49), msg]);

      if (discordConfig.respondToMessages) {
        const prompt = `[Discord] ${msg.displayName}: ${msg.content}`;
        sendChatRef.current(prompt);
      }
    });

    const voiceUnsub = discordClient.onVoiceEvent((event) => {
      setDiscordVoiceEvents((prev) => [...prev.slice(-19), event]);
    });

    discordStatusUnsubRef.current = statusUnsub;
    discordMsgUnsubRef.current = msgUnsub;
    discordVoiceUnsubRef.current = voiceUnsub;

    discordClient.connect(discordConfig);
  }, [discordConfig]);

  const handleDiscordDisconnect = useCallback(() => {
    discordClient.disconnect();
    setDiscordConnected(false);
    setDiscordConnectionError(null);
    discordMsgUnsubRef.current?.();
    discordVoiceUnsubRef.current?.();
    discordStatusUnsubRef.current?.();
    discordMsgUnsubRef.current = null;
    discordVoiceUnsubRef.current = null;
    discordStatusUnsubRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      discordMsgUnsubRef.current?.();
      discordVoiceUnsubRef.current?.();
      discordStatusUnsubRef.current?.();
    };
  }, []);

  // ── Screen Share ───────────────────────────────────────────────────────────
  const handleScreenShareStop = useCallback(() => {
    stopScreenShare();
    setScreenStream(null);
    setVdoninjaUrl("");
    setScreenShareConfig((prev) => ({ ...prev, active: false }));
  }, []);

  const handleScreenShareStart = useCallback(async () => {
    if (screenShareConfig.mode === "vdoninja") {
      const url = screenShareConfig.vdoninjaRoomId?.trim() || "";
      if (!url) return;
      setVdoninjaUrl(url);
      setScreenShareConfig((prev) => ({ ...prev, active: true }));
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

  // Snap the character to the corner "facecam" box while screen share /
  // VDO.Ninja is active, and restore the original full-screen centered
  // framing the moment it stops (button click, browser's native "Stop
  // sharing", or the VDO.Ninja connection ending).
  useEffect(() => {
    viewer.setScreenShareFraming(screenShareConfig.active);
    // The canvas's container just resized (full-screen <-> corner box) —
    // let the renderer/camera aspect catch up to the new dimensions once
    // the DOM has actually reflowed with the new size.
    requestAnimationFrame(() => viewer.resize());
  }, [screenShareConfig.active, viewer]);

  const handleChangeTtsConfig = useCallback((config: TTSConfig) => {
    setTtsConfig(config);
  }, []);

  return (
    <div className={"font-M_PLUS_2"}>
      <Meta />

      {isLoading && (
        <LoadingScreen onComplete={() => setIsLoading(false)} />
      )}

      <BackgroundRenderer config={backgroundConfig} />

      <Introduction aiConfig={aiConfig} onChangeAiConfig={setAiConfig} />

      <ScreenShareBackground
        stream={screenStream}
        vdoninjaUrl={vdoninjaUrl}
        mode={screenShareConfig.mode}
        active={screenShareConfig.active}
      />

      <VrmViewer cornerMode={screenShareConfig.active} />

      <div
        className={`transition-opacity duration-500 ${
          uiVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <MessageInputContainer
          isChatProcessing={chatProcessing}
          onChatProcessStart={handleLocalSendChat}
        />
      </div>

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
        backgroundConfig={backgroundConfig}
        captionStyle={captionStyle}
        visionConfig={visionConfig}
        visionStatus={visionStatus}
        visionLastDescription={visionLastDescription}
        visionLastCaptureTime={visionLastCaptureTime}
        visionSecondsUntilNext={visionSecondsUntilNext}
        visionError={visionError}
        discordConfig={discordConfig}
        discordConnected={discordConnected}
        discordConnectionError={discordConnectionError}
        adBreakConfig={adBreakConfig}
        onChangeAdBreakConfig={setAdBreakConfig}
        onTestAdBreak={() => startAdCountdown()}
        autonomousConfig={autonomousConfig}
        onChangeAutonomousConfig={setAutonomousConfig}
        autonomousActive={autonomousActive}
        eventSubStatus={eventSubStatus}
        eventSubError={eventSubError}
        onTestFollow={handleTestFollow}
        onTestRaid={handleTestRaid}
        onTestSub={handleTestSub}
        onTestResub={handleTestResub}
        onTestStreak={handleTestStreak}
        onTestBits={handleTestBits}
        uiVisible={uiVisible}
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
        onChangeBackgroundConfig={setBackgroundConfig}
        onChangeCaptionStyle={setCaptionStyle}
        onChangeVisionConfig={setVisionConfig}
        onVisionCaptureNow={visionCaptureNow}
        onChangeDiscordConfig={setDiscordConfig}
        onDiscordConnect={handleDiscordConnect}
        onDiscordDisconnect={handleDiscordDisconnect}
        onLoadSettings={handleLoadSettings}
        onSaveSettings={saveSettingsNow}
        onVrmFileLoad={handleVrmFileLoad}
      />

      <div
        className={`transition-opacity duration-500 ${
          uiVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <GitHubLink />
      </div>

      {twitchConfig.readChat && (
        <TwitchOverlay
          activeMessage={activeTwitchMessage}
          queuedCount={twitchQueueCount}
          isConnected={twitchConnected}
        />
      )}

      {discordConfig.showOverlay && (
        <DiscordOverlay
          messages={discordMessages}
          voiceEvents={discordVoiceEvents}
          isConnected={discordConnected}
          channelName={discordConfig.channelId}
          showOverlay={discordConfig.showOverlay}
        />
      )}

      {/* Top-right alert stack — ad countdown, Twitch alerts, polls, etc.
          all render here automatically by calling alertQueue.push(). */}
      <AlertOverlay />

      {/* Falling emotes/emojis — chat emoji, bits, and alert emote walls. */}
      <EmoteWallOverlay />
    </div>
  );
}
