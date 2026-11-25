import type { Preferences } from "../model";
import readingFonts from "../../docs/design/v0.1/reading-fonts.json";

type Category = Preferences["fontCategory"];

export const typeLimits = {
  size: { min: 12, max: 30 },
  leading: { min: 1, max: 2.4 },
};

export function isSystemFont(category: Category, family: string) {
  return Object.hasOwn(readingFonts[category].fonts, family);
}

export function systemFontOptions(
  category: Category,
  locale: Preferences["locale"],
): Record<string, string> {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return {};
  // An unavailable family renders the probe entirely in the monospace fallback.
  const sample = "湖面映着树影 Wmil012";
  ctx.font = "40px monospace";
  const fallback = ctx.measureText(sample).width;
  return Object.fromEntries(
    Object.entries(readingFonts[category].fonts)
      .filter(([name]) => {
        ctx.font = `40px "${name}", monospace`;
        return ctx.measureText(sample).width !== fallback;
      })
      .map(([name, label]) => [name, locale === "en" ? name : label]),
  );
}

export function readingFontFamily({
  fontCategory,
  fontFamily,
  customFont,
}: Preferences) {
  const { stack } = readingFonts[fontCategory];
  if (fontFamily === "custom" && customFont) return "UserReading, " + stack;
  if (isSystemFont(fontCategory, fontFamily))
    return `"${fontFamily}", ${stack}`;
  return stack;
}
