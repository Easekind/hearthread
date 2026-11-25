import { t } from "../i18n";
import { patchPrefs } from "./catalog";
import { files } from "./files";

export const fontExtensions = ["otf", "ttf", "woff2"];

function checkExtension(name: string) {
  if (!fontExtensions.some((ext) => name.toLowerCase().endsWith("." + ext)))
    throw new Error(t("error.fontFormat"));
}

async function applyFont(bytes: Uint8Array<ArrayBuffer>) {
  const signature = String.fromCharCode(...bytes.subarray(0, 4));
  if (!["OTTO", "\x00\x01\x00\x00", "true", "wOF2"].includes(signature))
    throw new Error(t("error.fontFormat"));
  try {
    await new FontFace("Check", bytes).load();
  } catch {
    throw new Error(t("error.invalidFont"));
  }
  await patchPrefs({
    customFont: await files.put(new Blob([bytes])),
    fontFamily: "custom",
  });
}

export async function importFontFile(file: File) {
  checkExtension(file.name);
  await applyFont(new Uint8Array(await file.arrayBuffer()));
}

export async function pickNativeFont() {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const path = await open({
    title: t("font.choose"),
    filters: [{ name: t("font.files"), extensions: fontExtensions }],
    fileAccessMode: "scoped",
  });
  if (!path) return false;
  // Android document providers can return an opaque URI without a file name.
  if (!path.startsWith("content://")) checkExtension(path);
  const { readFile } = await import("@tauri-apps/plugin-fs");
  await applyFont(await readFile(path));
  return true;
}
