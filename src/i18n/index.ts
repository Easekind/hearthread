import i18next, { type TOptions } from "i18next";
import en from "./en.json";
import zhCN from "./zh-CN.json";

export const locales = ["en", "zh-CN"] as const;
export type Locale = (typeof locales)[number];
export type MessageKey = keyof typeof zhCN;
export const languageNames: Record<Locale, string> = {
  en: "English",
  "zh-CN": "简体中文",
};

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "zh-CN";
}

void i18next.init({
  resources: { en: { translation: en }, "zh-CN": { translation: zhCN } },
  lng: "en",
  fallbackLng: "en",
  supportedLngs: locales.slice(),
  keySeparator: false,
  initAsync: false,
  interpolation: { escapeValue: false },
});

export function t(key: MessageKey, options: TOptions = {}): string {
  return i18next.t(key, options);
}

export function applyLocale(locale: Locale) {
  if (i18next.language !== locale) void i18next.changeLanguage(locale);
  document.documentElement.lang = locale;
  document.title = "hearthread · " + t("library.title");
}

export function nativeError(reason: unknown) {
  if (
    typeof reason === "string" &&
    reason.startsWith("error.") &&
    Object.hasOwn(zhCN, reason)
  )
    return new Error(t(reason as MessageKey));
  return reason;
}
