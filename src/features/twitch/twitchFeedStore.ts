import { TwitchMessage } from "./twitchClient";

// Rolling buffer of recent Twitch chat, kept outside React state so a busy
// chat doesn't re-render the whole app on every message — only the Chat tab
// of the control window subscribes to it.
type Listener = (messages: TwitchMessage[]) => void;

const MAX = 150;
let messages: TwitchMessage[] = [];
const listeners = new Set<Listener>();

export const twitchFeedStore = {
  push(msg: TwitchMessage) {
    messages = [...messages.slice(-(MAX - 1)), msg];
    listeners.forEach((l) => l(messages));
  },
  clear() {
    messages = [];
    listeners.forEach((l) => l(messages));
  },
  subscribe(l: Listener) {
    listeners.add(l);
    l(messages);
    return () => {
      listeners.delete(l);
    };
  },
};
