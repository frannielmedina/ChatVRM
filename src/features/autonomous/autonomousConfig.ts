export type AutonomousConfig = {
  enabled: boolean;
  // How long (seconds) with no one talking to Miko before autonomous
  // monologue mode kicks in. Default 5 minutes, per spec.
  idleThresholdSeconds: number;
  // Once active, how often (seconds) Miko says another autonomous line
  // while it's still quiet.
  monologueIntervalSeconds: number;
};

export const DEFAULT_AUTONOMOUS_CONFIG: AutonomousConfig = {
  enabled: false,
  idleThresholdSeconds: 300,
  monologueIntervalSeconds: 45,
};
