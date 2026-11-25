import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cpSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "offline-pdf-resources",
      buildStart() {
        for (const dir of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
          mkdirSync("public/pdf-resources", { recursive: true });
          cpSync(
            resolve("node_modules/pdfjs-dist", dir),
            resolve("public/pdf-resources", dir),
            { recursive: true },
          );
        }
      },
    },
  ],
  optimizeDeps: { include: ["fontkitten"] },
  server: {
    port: 1420,
    strictPort: true,
    host: process.env.TAURI_DEV_HOST || "127.0.0.1",
    watch: { ignored: ["**/src-tauri/**", "**/test-results/**"] },
  },
  build: { target: "es2022", sourcemap: false },
});
