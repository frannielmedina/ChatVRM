// ── Discord Integration Configuration ────────────────────────────────────────
// Uses Discord's Web Gateway (WebSocket) for real-time voice channel events
// and a Bot token to read messages / get voice state updates.
//
// For voice STT: Discord sends voice speaking events via the gateway.
// We capture audio via getUserMedia when the user joins a voice channel
// through our embedded Discord Activity or by monitoring gateway events.
//
// NOTE: True Discord voice audio capture requires either:
//   1. Discord RPC (desktop app) — most reliable
//   2. Discord Activity SDK (embedded app in voice channel)
//   3. A bot in the voice channel that relays audio
//
// This implementation uses the Gateway + a Bot token approach:
//   - Bot joins voice channel and relays audio descriptions
//   - OR: user enables "System Audio" capture via screen share + STT

export type DiscordSTTMode =
  | "bot"        // Bot token — monitors voice channel speaking events + text chat
  | "webhook";   // Incoming webhook — receive messages from Discord to VTuber

export type DiscordConfig = {
  enabled: boolean;
  mode: DiscordSTTMode;
  // Bot mode
  botToken: string;
  guildId: string;
  channelId: string;       // text channel to monitor
  voiceChannelId: string;  // voice channel to monitor for speaking events
  respondToMessages: boolean;
  respondToMentionsOnly: boolean;
  botPrefix: string;       // e.g. "!" — prefix for commands
  // Webhook mode
  webhookUrl: string;      // Outgoing webhook or bot sends messages here
  // Shared
  showOverlay: boolean;    // Show Discord chat overlay like Twitch
  maxOverlayMessages: number;
};

export const DEFAULT_DISCORD_CONFIG: DiscordConfig = {
  enabled: false,
  mode: "bot",
  botToken: "",
  guildId: "",
  channelId: "",
  voiceChannelId: "",
  respondToMessages: false,
  respondToMentionsOnly: true,
  botPrefix: "!",
  webhookUrl: "",
  showOverlay: true,
  maxOverlayMessages: 5,
};

export type DiscordMessage = {
  id: string;
  username: string;
  displayName: string;
  content: string;
  timestamp: number;
  avatarUrl?: string;
  color?: string;         // role color
  isMention?: boolean;
  isBot?: boolean;
};

export type DiscordVoiceEvent = {
  userId: string;
  username: string;
  speaking: boolean;      // true = started speaking, false = stopped
  timestamp: number;
};
