// Twitch-native emote helpers.

export interface EmoteRange {
  id: string;
  start: number;
  end: number;
}

/** Parses the IRC `emotes` tag, e.g. "25:0-4,12-16/1902:6-10". */
export function parseEmotesTag(emotesTag: string): EmoteRange[] {
  if (!emotesTag) return [];
  const ranges: EmoteRange[] = [];
  for (const group of emotesTag.split("/")) {
    const [id, positions] = group.split(":");
    if (!id || !positions) continue;
    for (const pos of positions.split(",")) {
      const [start, end] = pos.split("-").map(Number);
      if (!isNaN(start) && !isNaN(end)) ranges.push({ id, start, end });
    }
  }
  return ranges.sort((a, b) => a.start - b.start);
}

/**
 * CDN image for an emote id. `default` serves the animated version when one
 * exists and the static one otherwise (so animated emotes animate on the wall).
 */
export function twitchEmoteUrl(id: string, scale: "1.0" | "2.0" | "3.0" = "2.0"): string {
  return `https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(id)}/default/dark/${scale}`;
}

/** Image URLs for every native Twitch emote in a message, in order of appearance. */
export function extractTwitchEmoteUrls(emotesTag?: string): string[] {
  if (!emotesTag) return [];
  return parseEmotesTag(emotesTag).map((r) => twitchEmoteUrl(r.id));
}

/** The broadcaster's own uploaded emotes (needs Client-Id + token — used for alert walls). */
export async function fetchChannelEmoteUrls(
  clientId: string,
  accessToken: string,
  broadcasterId: string
): Promise<string[]> {
  try {
    const token = accessToken.replace(/^oauth:/i, "");
    const res = await fetch(
      `https://api.twitch.tv/helix/chat/emotes?broadcaster_id=${encodeURIComponent(broadcasterId)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Client-Id": clientId,
        },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const urls: string[] = (data?.data || [])
      .map((e: any) => {
        const id: string | undefined = e?.id;
        // Build from the id so animated emotes keep animating.
        if (id) return twitchEmoteUrl(id);
        return e?.images?.url_2x || e?.images?.url_1x;
      })
      .filter(Boolean);
    return urls;
  } catch (e) {
    console.error("[EmoteWall] Failed to fetch channel emotes", e);
    return [];
  }
}
