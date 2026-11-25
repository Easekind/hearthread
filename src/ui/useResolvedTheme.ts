import { useSyncExternalStore } from "react";
import type { Theme } from "../model";

const darkMode = matchMedia("(prefers-color-scheme: dark)");

function subscribe(notify: () => void) {
  darkMode.addEventListener("change", notify);
  return () => darkMode.removeEventListener("change", notify);
}

export function useResolvedTheme(theme: Theme) {
  return useSyncExternalStore(subscribe, () =>
    theme === "system" ? (darkMode.matches ? "dark" : "light") : theme,
  );
}
