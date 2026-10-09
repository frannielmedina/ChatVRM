// ─────────────────────────────────────────────────────────────────────────────
// 3D / performance settings. Shared by the normal Settings modal and the
// Streamer Mode control window, and applied to the singleton Viewer.
// ─────────────────────────────────────────────────────────────────────────────

export type QualityPreset = "low" | "medium" | "high" | "ultra";
export type HardwareTier = QualityPreset;

export type GraphicsConfig = {
  /** Detect the hardware and keep resolution scale adjusted live to hold the target FPS. */
  autoQuality: boolean;
  /** Maximum render FPS. 0 = unlimited (follow the monitor refresh rate). */
  fpsLimit: number;
  /** Multiplier on the device pixel ratio (0.4 – 2). Lower = blurrier but lighter. */
  resolutionScale: number;
  /** Hard cap on the final pixel ratio, so 4K / retina screens don't melt weak GPUs. */
  maxPixelRatio: number;
  /** Anti-aliasing. Can only change when the canvas is created → needs a page reload. */
  antialias: boolean;
  /** Brightness of the main (key) light. */
  lightIntensity: number;
  /** Brightness of the ambient fill light. */
  ambientIntensity: number;
  /** Horizontal angle of the key light in degrees (0 = front, 90 = right). */
  lightAzimuth: number;
  /** Vertical angle of the key light in degrees. */
  lightElevation: number;
};

// These match the values that were hard-coded in the original Viewer, so
// nothing looks different until the user changes something.
export const DEFAULT_GRAPHICS_CONFIG: GraphicsConfig = {
  autoQuality: true,
  fpsLimit: 60,
  resolutionScale: 1,
  maxPixelRatio: 2,
  antialias: true,
  lightIntensity: 0.6,
  ambientIntensity: 0.4,
  lightAzimuth: 45,
  lightElevation: 35,
};

export const FPS_OPTIONS = [0, 15, 24, 30, 45, 60, 90, 120];

export const QUALITY_PRESETS: Record<
  QualityPreset,
  { label: string; fpsLimit: number; resolutionScale: number; maxPixelRatio: number; antialias: boolean }
> = {
  low:    { label: "Low",    fpsLimit: 30, resolutionScale: 0.6,  maxPixelRatio: 1,   antialias: false },
  medium: { label: "Medium", fpsLimit: 30, resolutionScale: 0.85, maxPixelRatio: 1.5, antialias: true },
  high:   { label: "High",   fpsLimit: 60, resolutionScale: 1,    maxPixelRatio: 2,   antialias: true },
  ultra:  { label: "Ultra",  fpsLimit: 60, resolutionScale: 1.25, maxPixelRatio: 2,   antialias: true },
};

export const MIN_RESOLUTION_SCALE = 0.4;

// ── Hardware detection ───────────────────────────────────────────────────────
export type HardwareInfo = {
  tier: HardwareTier;
  gpu: string;
  cores: number;
  memoryGB: number | null;
  reason: string;
};

let cachedHardware: HardwareInfo | null = null;

export function detectHardware(): HardwareInfo {
  if (cachedHardware) return cachedHardware;

  const cores = (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 4;
  const memoryGB: number | null =
    typeof navigator !== "undefined" && (navigator as any).deviceMemory
      ? (navigator as any).deviceMemory
      : null;

  let gpu = "unknown";
  try {
    const c = document.createElement("canvas");
    const gl =
      (c.getContext("webgl") as WebGLRenderingContext | null) ||
      (c.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      gpu = ext
        ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
        : String(gl.getParameter(gl.RENDERER));
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    /* keep "unknown" */
  }

  const g = gpu.toLowerCase();
  const software = /swiftshader|llvmpipe|software|basic render/.test(g);
  const mobile = /mali|adreno|powervr|videocore/.test(g);
  const intelIntegrated = /intel/.test(g) && !/arc\s?[ab]\d/.test(g);
  const appleSilicon = /apple/.test(g);
  const discreteHigh = /rtx|geforce (gtx )?1[0-9]{3}|gtx 1[6-9]|radeon rx (5[6-9]|6|7)|rx [5-9][0-9]{3}|arc\s?[ab][5-9]/.test(g);
  const discreteMid = /nvidia|geforce|gtx|radeon|rx |quadro/.test(g);

  let tier: HardwareTier;
  let reason: string;
  if (software) {
    tier = "low"; reason = "software rendering (no GPU acceleration)";
  } else if (mobile) {
    tier = "low"; reason = "mobile GPU";
  } else if (intelIntegrated) {
    tier = cores >= 12 ? "medium" : "low"; reason = "integrated Intel graphics";
  } else if (appleSilicon) {
    tier = cores >= 10 ? "ultra" : "high"; reason = "Apple Silicon GPU";
  } else if (discreteHigh) {
    tier = cores >= 8 ? "ultra" : "high"; reason = "dedicated high-end GPU";
  } else if (discreteMid) {
    tier = "high"; reason = "dedicated GPU";
  } else {
    // Unknown GPU: fall back to CPU/RAM heuristics.
    tier = cores <= 4 || (memoryGB !== null && memoryGB <= 4) ? "low" : cores >= 8 ? "high" : "medium";
    reason = "unrecognised GPU, estimated from CPU/RAM";
  }
  if (memoryGB !== null && memoryGB <= 2) tier = "low";

  cachedHardware = { tier, gpu, cores, memoryGB, reason };
  return cachedHardware;
}

/** The starting point auto-quality uses on this machine (the live scaler only moves resolution down/up from here). */
export function autoProfileFor(tier: HardwareTier) {
  return QUALITY_PRESETS[tier];
}

/** Read the saved config synchronously (the Viewer needs `antialias` before React has rendered anything). */
export function readStoredGraphicsConfig(): GraphicsConfig {
  try {
    const raw = window.localStorage.getItem("chatVRMParams");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.graphicsConfig) return { ...DEFAULT_GRAPHICS_CONFIG, ...parsed.graphicsConfig };
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_GRAPHICS_CONFIG;
}

export type PerfStats = {
  fps: number;
  pixelRatio: number;
  resolutionScale: number;
  fpsTarget: number;
  tier: HardwareTier;
  autoAdjusted: boolean;
};
