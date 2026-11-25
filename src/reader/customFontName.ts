import { create } from "fontkitten";
import { files } from "../storage/files";

let lastFont: { key: string; name: string } | undefined;

export async function customFontName(key: string) {
  if (lastFont?.key === key) return lastFont.name;
  const source = await files.url(key);
  try {
    const response = await fetch(source.url);
    if (!response.ok) throw new Error("无法读取字体");
    const bytes = new Uint8Array(await response.arrayBuffer());
    // Fontkitten accepts Uint8Array in browsers, but its declaration uses Node's Buffer.
    const font = create(bytes as Buffer);
    const face = font.isCollection ? font.fonts[0] : font;
    const name =
      face?.getName("preferredFamily")?.trim() ||
      face?.familyName?.trim() ||
      "";
    lastFont = { key, name };
    return name;
  } finally {
    source.release();
  }
}
