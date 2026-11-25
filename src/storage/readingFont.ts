import { patchPrefs } from "./catalog";
import { files } from "./files";

export const fontExtensions = ["otf", "ttf", "woff2"];
const formatError = "请选择 OTF、TTF 或 WOFF2 字体文件";

function checkExtension(name: string) {
  if (!fontExtensions.some((ext) => name.toLowerCase().endsWith("." + ext)))
    throw new Error(formatError);
}

async function applyFont(bytes: Uint8Array<ArrayBuffer>) {
  const signature = String.fromCharCode(...bytes.subarray(0, 4));
  if (!["OTTO", "\x00\x01\x00\x00", "true", "wOF2"].includes(signature))
    throw new Error(formatError);
  try {
    await new FontFace("Check", bytes).load();
  } catch {
    throw new Error("无法读取此字体，请选择有效的字体文件");
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
    title: "选择字体",
    filters: [{ name: "字体文件", extensions: fontExtensions }],
    fileAccessMode: "scoped",
  });
  if (!path) return false;
  // Android document providers can return an opaque URI without a file name.
  if (!path.startsWith("content://")) checkExtension(path);
  const { readFile } = await import("@tauri-apps/plugin-fs");
  await applyFont(await readFile(path));
  return true;
}
