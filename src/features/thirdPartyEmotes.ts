// 7TV / BetterTTV / FrankerFaceZ emotes. These are not part of Twitch's own
// `emotes` IRC tag (they're just plain words in the message), so we download
// the global + channel emote lists once and match words against them.
//
// Everything here fails soft: if an API is down or blocked, that provider is
// simply skipped and the wall keeps working with Twitch emotes + emoji.

const emoteByName = new Map<string, string>();
const channelUrls = new Set<string>();
let loadedRoomId: string | null = null;
let loading: Promise<void> | null = null;
let globalsLoaded = false;

async function getJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function abs(url: string | undefined): string | null {
  if (!url) return null;
  return url.startsWith("//") ? `https:${url}` : url;
}

function add(name: string | undefined, url: string | null, isChannel: boolean) {
  if (!name || !url) return;
  emoteByName.set(name, url);
  if (isChannel) channelUrls.add(url);
}

function addSevenTv(emotes: any[] | undefined, isChannel: boolean) {
  for (const e of emotes ?? []) {
    const host = abs(e?.data?.host?.url);
    if (!host) continue;
    const files: { name: string }[] = e?.data?.host?.files ?? [];
    // Prefer a ~2x webp (animated when the emote is animated).
    const file = files.find((f) => f.name === "2x.webp") ?? files.find((f) => f.name.endsWith(".webp")) ?? files[0];
    if (file) add(e?.name, `${host}/${file.name}`, isChannel);
  }
}

function addBttv(list: any[] | undefined, isChannel: boolean) {
  for (const e of list ?? []) {
    if (e?.id && e?.code) add(e.code, `https://cdn.betterttv.net/emote/${e.id}/2x.webp`, isChannel);
  }
}

function addFfz(sets: Record<string, any> | undefined, setIds: (string | number)[] | undefined, isChannel: boolean) {
  if (!sets) return;
  const ids = setIds && setIds.length ? setIds : Object.keys(sets);
  for (const id of ids) {
    for (const e of sets[String(id)]?.emoticons ?? []) {
      const urls = e?.urls ?? {};
      add(e?.name, abs(urls["2"] ?? urls["1"] ?? urls["4"]), isChannel);
    }
  }
}

async function loadGlobals() {
  if (globalsLoaded) return;
  globalsLoaded = true;
  const [seven, bttv, ffz] = await Promise.all([
    getJson("https://7tv.io/v3/emote-sets/global"),
    getJson("https://api.betterttv.net/3/cached/emotes/global"),
    getJson("https://api.frankerfacez.com/v1/set/global"),
  ]);
  addSevenTv(seven?.emotes, false);
  addBttv(Array.isArray(bttv) ? bttv : [], false);
  addFfz(ffz?.sets, ffz?.default_sets, false);
}

async function loadChannel(roomId: string) {
  const [seven, bttv, ffz] = await Promise.all([
    getJson(`https://7tv.io/v3/users/twitch/${roomId}`),
    getJson(`https://api.betterttv.net/3/cached/users/twitch/${roomId}`),
    getJson(`https://api.frankerfacez.com/v1/room/id/${roomId}`),
  ]);
  addSevenTv(seven?.emote_set?.emotes, true);
  addBttv(bttv?.channelEmotes, true);
  addBttv(bttv?.sharedEmotes, true);
  addFfz(ffz?.sets, ffz?.room?.set != null ? [ffz.room.set] : undefined, true);
}

/** Safe to call on every chat message — only the first call for a channel does any work. */
export function ensureThirdPartyEmotes(roomId?: string): void {
  if (loading || (roomId && roomId === loadedRoomId)) return;
  loading = (async () => {
    await loadGlobals();
    if (roomId && roomId !== loadedRoomId) {
      loadedRoomId = roomId;
      await loadChannel(roomId);
    }
  })()
    .catch(() => {})
    .finally(() => {
      loading = null;
    });
}

/** Image URLs for every 7TV/BTTV/FFZ emote word found in the message, in order. */
export function findThirdPartyEmoteUrls(message: string): string[] {
  if (emoteByName.size === 0) return [];
  const out: string[] = [];
  for (const word of message.split(/\s+/)) {
    const url = emoteByName.get(word);
    if (url) out.push(url);
  }
  return out;
}

/** Channel-specific 7TV/BTTV/FFZ emotes (used for the alert "emote wall"). */
export function getThirdPartyChannelPool(): string[] {
  return Array.from(channelUrls);
}

export function resetThirdPartyEmotes() {
  emoteByName.clear();
  channelUrls.clear();
  loadedRoomId = null;
  globalsLoaded = false;
  loading = null;
}
