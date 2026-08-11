import { useCallback, useEffect, useRef, useState } from "react";
import { AutonomousConfig } from "./autonomousConfig";

// A handful of varied nudges so Miko doesn't say the exact same opener every
// time autonomous mode kicks in. The AI still writes the actual line — this
// just varies the instruction so the *topic* of the monologue varies too.
const AUTONOMOUS_PROMPTS = [
  "[Autonomous Mode] Nobody has said anything for a while. Fill the silence with a short in-character thought, story, or observation, as if thinking out loud to your viewers.",
  "[Autonomous Mode] It's quiet right now. Share a random fun fact, opinion, or musing in your own voice to keep things lively.",
  "[Autonomous Mode] Chat's gone quiet. Talk briefly about something on your mind, or ask your viewers an open question to get them chatting again.",
  "[Autonomous Mode] Still no activity. Do a short, casual bit — react to something, tell a mini-story, or comment on the stream — to fill the dead air.",
];

function pickPrompt(): string {
  return AUTONOMOUS_PROMPTS[Math.floor(Math.random() * AUTONOMOUS_PROMPTS.length)];
}

type Params = {
  config: AutonomousConfig;
  // Ref so the interval always sees the latest value without re-subscribing.
  isChatProcessingRef: React.MutableRefObject<boolean>;
  sendPrompt: (text: string) => Promise<void>;
};

export function useAutonomousMode({ config, isChatProcessingRef, sendPrompt }: Params) {
  const [isActive, setIsActive] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const nextMonologueAtRef = useRef(0);

  // Call this any time a *real* person talks to Miko — typing in the local
  // chat box, or a Twitch chat message being responded to. This is what
  // deactivates autonomous mode and resets the idle clock.
  const notifyActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    nextMonologueAtRef.current = 0;
    setIsActive(false);
  }, []);

  useEffect(() => {
    if (!config.enabled) {
      setIsActive(false);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const idleMs = now - lastActivityRef.current;
      const thresholdMs = config.idleThresholdSeconds * 1000;

      if (idleMs < thresholdMs) return;
      setIsActive(true);

      if (now < nextMonologueAtRef.current) return;
      if (isChatProcessingRef.current) return;

      nextMonologueAtRef.current = now + config.monologueIntervalSeconds * 1000;
      sendPrompt(pickPrompt()).catch((e) =>
        console.error("[AutonomousMode] monologue line failed", e)
      );
    }, 5000);

    return () => clearInterval(interval);
  }, [
    config.enabled,
    config.idleThresholdSeconds,
    config.monologueIntervalSeconds,
    isChatProcessingRef,
    sendPrompt,
  ]);

  return { isActive, notifyActivity };
}
