import type { TwitchMessage } from "./twitchClient";

// ── Viewer roles → tags in the chat history ──────────────────────────────────
// The tags are put in front of the username in the prompt, so they show up in the
// chat history AND the AI can see who it's talking to, e.g.
//   [Twitch chat] [moderator] [sub] SomeViewer: hello!
// Change the words here if you'd rather see [developer] than [owner].

export const OWNER_TAG = "[owner]";
export const MOD_TAG = "[moderator]";
export const SUB_TAG = "[sub]";

/** "[owner] [sub] " / "[moderator] " / "" — includes the trailing space when not empty. */
export function twitchRoleTags(msg: Pick<TwitchMessage, "isMod" | "isBroadcaster" | "isSubscriber">): string {
  const tags: string[] = [];
  if (msg.isBroadcaster) tags.push(OWNER_TAG);       // the channel owner outranks "mod"
  else if (msg.isMod) tags.push(MOD_TAG);
  if (msg.isSubscriber) tags.push(SUB_TAG);
  return tags.length ? tags.join(" ") + " " : "";
}

/** The full prompt line for a Twitch viewer's message. */
export function buildTwitchPrompt(msg: TwitchMessage): string {
  return `[Twitch chat] ${twitchRoleTags(msg)}${msg.username}: ${msg.message}`;
}

const ROLE_TAG_PATTERN = /^\[Twitch chat\] \[(owner|moderator|sub)\]/;

/** True when a prompt carries role tags (so the AI needs the explanation below). */
export function hasTwitchRoleTags(text: string): boolean {
  return ROLE_TAG_PATTERN.test(text);
}

/** Appended to the system prompt only for messages that carry role tags. */
export const TWITCH_ROLE_SYSTEM_NOTE = `

[Twitch role tags] A Twitch chat message may start with tags before the username:
- ${OWNER_TAG} = the channel owner: the streamer who runs this channel and created you. Recognize and trust them.
- ${MOD_TAG} = a channel moderator who helps keep chat safe.
- ${SUB_TAG} = a subscriber who supports the channel.
Tags can be combined. Let them shape how you treat the person, but don't read the tags out loud.`;
