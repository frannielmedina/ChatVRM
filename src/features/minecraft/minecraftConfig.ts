// ── Minecraft integration ─────────────────────────────────────────────────────
// A browser can't speak the Minecraft protocol, so ChatVRM talks to a small local
// Mineflayer bridge (tools/minecraft-bridge) over WebSocket. The bridge joins the
// server as a bot, forwards in-game chat here and types the AI's replies back.

export type MinecraftVersionId = "auto" | "1.8.9" | "1.21.11" | "26.1";

export const MINECRAFT_VERSIONS: { id: MinecraftVersionId; label: string; note: string }[] = [
  { id: "1.8.9", label: "1.8.9", note: "Legacy (PvP servers) — chat is split into 100-character lines" },
  { id: "1.21.11", label: "1.21.11", note: "Latest 1.21.x" },
  { id: "26.1", label: "26.1", note: "New year-based versioning (26.1.x servers)" },
  { id: "auto", label: "Auto-detect", note: "Let the bridge ping the server and choose" },
];

export type MinecraftConfig = {
  bridgeUrl: string;        // ws://127.0.0.1:8788
  host: string;             // server address
  port: number;             // server port
  version: MinecraftVersionId;
  botName: string;          // in-game name of the bot
  auth: "offline" | "microsoft";
  respondToChat: boolean;   // let the AI answer in-game chat
  mentionOnly: boolean;     // only answer messages that contain the trigger word
  triggerWord: string;      // e.g. the character's name
  sendRepliesToGame: boolean; // type the AI's answer into game chat
  reactToEvents: boolean;   // react (via the AI) when someone joins / leaves / the bot dies
};

export const DEFAULT_MINECRAFT_CONFIG: MinecraftConfig = {
  bridgeUrl: "ws://127.0.0.1:8788",
  host: "localhost",
  port: 25565,
  version: "1.21.11",
  botName: "Miko",
  auth: "offline",
  respondToChat: true,
  mentionOnly: true,
  triggerWord: "miko",
  sendRepliesToGame: true,
  reactToEvents: false,
};

export type MinecraftState =
  | "idle"          // not connected
  | "bridge"        // connected to the bridge, not in the game
  | "connecting"    // bot is joining the server
  | "connected"     // bot is in the game
  | "kicked"
  | "error";

export type MinecraftStatus = {
  state: MinecraftState;
  message?: string;
  // Microsoft device-code login
  msaCode?: { url: string; code: string };
  // Filled when connected
  version?: string;
  players?: number;
};

export const DEFAULT_MINECRAFT_STATUS: MinecraftStatus = { state: "idle" };

export type MinecraftChatMessage = {
  username: string;
  message: string;
  whisper: boolean;
};

export type MinecraftGameEvent =
  | { kind: "playerJoined"; username: string }
  | { kind: "playerLeft"; username: string }
  | { kind: "death" };
