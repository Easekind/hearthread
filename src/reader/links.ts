import { isTauri } from "@tauri-apps/api/core";
export async function openExternal(href: string) {
  const url = new URL(href);
  if (!["https:", "http:", "mailto:"].includes(url.protocol)) return;
  if (isTauri()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url.href);
  } else window.open(url.href, "_blank", "noopener,noreferrer");
}
