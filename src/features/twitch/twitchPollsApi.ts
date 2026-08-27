async function helixPost(
  path: string,
  clientId: string,
  accessToken: string,
  body: Record<string, any>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`https://api.twitch.tv/helix/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Client-Id": clientId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `${res.status}: ${errText}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export function createTwitchPoll(
  clientId: string,
  accessToken: string,
  broadcasterId: string,
  title: string,
  options: string[],
  durationSeconds = 60
) {
  return helixPost("polls", clientId, accessToken, {
    broadcaster_id: broadcasterId,
    title: title.slice(0, 60),
    choices: options.slice(0, 5).map((o) => ({ title: o.slice(0, 25) })),
    duration: Math.min(1800, Math.max(15, durationSeconds)),
  });
}

export function createTwitchPrediction(
  clientId: string,
  accessToken: string,
  broadcasterId: string,
  title: string,
  outcomes: string[],
  predictionWindowSeconds = 60
) {
  return helixPost("predictions", clientId, accessToken, {
    broadcaster_id: broadcasterId,
    title: title.slice(0, 45),
    outcomes: outcomes.slice(0, 10).map((o) => ({ title: o.slice(0, 25) })),
    prediction_window: Math.min(1800, Math.max(30, predictionWindowSeconds)),
  });
}
