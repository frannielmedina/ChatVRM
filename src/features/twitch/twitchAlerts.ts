import { alertQueue } from "@/features/alerts/alertQueue";

const ALERT_DURATION_MS = 8000;

export function fireFollowAlert(
  displayName: string,
  sendPrompt: (text: string) => void
) {
  alertQueue.push({
    kind: "follow",
    title: "New Follower!",
    subtitle: displayName,
    durationMs: ALERT_DURATION_MS,
  });
  sendPrompt(
    `[Twitch Follow] ${displayName} just followed the channel! React briefly and thank them by name.`
  );
}

export function fireRaidAlert(
  fromDisplayName: string,
  viewers: number,
  sendPrompt: (text: string) => void
) {
  alertQueue.push({
    kind: "raid",
    title: "Raid!",
    subtitle: `${fromDisplayName} — ${viewers} raiders`,
    durationMs: ALERT_DURATION_MS,
  });
  sendPrompt(
    `[Twitch Raid] ${fromDisplayName} just raided the channel with ${viewers} viewers! Give them an enthusiastic welcome by name.`
  );
}

export function fireSubAlert(
  displayName: string,
  tier: string,
  sendPrompt: (text: string) => void
) {
  alertQueue.push({
    kind: "sub",
    title: "New Subscriber!",
    subtitle: displayName,
    durationMs: ALERT_DURATION_MS,
  });
  sendPrompt(
    `[Twitch Sub] ${displayName} just subscribed to the channel! Thank them briefly by name.`
  );
}

export function fireResubAlert(
  displayName: string,
  cumulativeMonths: number,
  sendPrompt: (text: string) => void
) {
  alertQueue.push({
    kind: "resub",
    title: "Resubscribed!",
    subtitle: `${displayName} — ${cumulativeMonths} months`,
    durationMs: ALERT_DURATION_MS,
  });
  sendPrompt(
    `[Twitch Resub] ${displayName} just resubscribed for a total of ${cumulativeMonths} months! Thank them briefly by name.`
  );
}

// Fires instead of fireResubAlert when the subscriber chose to share their
// consecutive-months streak.
export function fireStreakAlert(
  displayName: string,
  streakMonths: number,
  sendPrompt: (text: string) => void
) {
  alertQueue.push({
    kind: "streak",
    title: `Congratulations for your ${streakMonths} stream streak, ${displayName}`,
    durationMs: ALERT_DURATION_MS,
  });
  sendPrompt(
    `[Twitch Streak] ${displayName} just shared a ${streakMonths}-month sub streak! Congratulate them by name.`
  );
}

export function fireBitsAlert(
  displayName: string,
  bits: number,
  message: string,
  sendPrompt: (text: string) => void
) {
  alertQueue.push({
    kind: "bits",
    title: `${bits} Bits!`,
    subtitle: displayName,
    durationMs: ALERT_DURATION_MS,
  });
  const withMessage = message ? ` They said: "${message}"` : "";
  sendPrompt(
    `[Twitch Bits] ${displayName} just cheered ${bits} bits!${withMessage} Thank them briefly by name.`
  );
}
