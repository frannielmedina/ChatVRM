export type BackgroundType = "image" | "color" | "greenscreen" | "none";

export type BackgroundConfig = {
  type: BackgroundType;
  color: string;
  imageUrl: string; // URL or data URL for custom uploaded image
  builtinImage: string; // one of the preset image keys
};

export const DEFAULT_BACKGROUND_CONFIG: BackgroundConfig = {
  type: "image",
  color: "#00b140",
  imageUrl: "",
  builtinImage: "bg-c.png",
};

export const BUILTIN_BACKGROUNDS = [
  { key: "bg-c.png", label: "Default" },
  { key: "none", label: "None (transparent)" },
];

export const PRESET_COLORS = [
  { label: "Green Screen", value: "#00b140" },
  { label: "Blue Screen", value: "#0047AB" },
  { label: "White", value: "#ffffff" },
  { label: "Black", value: "#000000" },
  { label: "Soft Pink", value: "#f8c8d4" },
  { label: "Sky Blue", value: "#87CEEB" },
];
