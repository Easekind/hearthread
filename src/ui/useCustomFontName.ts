import { useEffect, useState } from "react";

export function useCustomFontName(key?: string) {
  const [imported, setImported] = useState<{ key: string; name: string }>();
  useEffect(() => {
    if (!key) return;
    let active = true;
    import("../reader/customFontName")
      .then(({ customFontName }) => customFontName(key))
      .then((name) => {
        if (active) setImported({ key, name });
      })
      // A missing name must not prevent the reader from using the font.
      .catch((error) => console.warn("无法读取导入字体的家族名称", error));
    return () => {
      active = false;
    };
  }, [key]);
  return imported && imported.key === key ? imported.name : "";
}
