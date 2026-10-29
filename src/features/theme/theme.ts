export type ThemeId = "dark" | "light";

export const THEME_STORAGE_KEY = "chatVRM_theme";
export const DEFAULT_THEME: ThemeId = "dark";

export function loadTheme(): ThemeId {
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyTheme(theme: ThemeId): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* private mode etc. */
  }
}
