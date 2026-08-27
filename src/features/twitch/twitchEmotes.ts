export async function fetchChannelEmoteUrls(
  clientId: string,
  accessToken: string,
  broadcasterId: string
): Promise<string[]> {
  try {
    const res = await fetch(
      `https://api.twitch.tv/helix/chat/emotes?broadcaster_id=${encodeURIComponent(broadcasterId)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Client-Id": clientId,
        },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const urls: string[] = (data?.data || [])
      .map((e: any) => e?.images?.url_2x || e?.images?.url_1x)
      .filter(Boolean);
    return urls;
  } catch (e) {
    console.error("[EmoteWall] Failed to fetch channel emotes", e);
    return [];
  }
}
