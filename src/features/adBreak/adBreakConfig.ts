export type AdBreakConfig = {
  // Whether ad-break countdowns do anything at all (visual + AI lines).
  enabled: boolean;
  // How long the on-screen "AD STARTS IN:" countdown runs, in seconds.
  durationSeconds: number;
};

export const DEFAULT_AD_BREAK_CONFIG: AdBreakConfig = {
  enabled: true,
  durationSeconds: 90,
};
