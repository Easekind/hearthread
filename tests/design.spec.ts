import { test, expect } from "@playwright/test";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
for (const [width, height] of [
  [1440, 900],
  [390, 844],
])
  for (const surface of ["library", "settings", "read-1"]) {
    test(surface + " pixels " + width, async ({ page }, info) => {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.mouse.move(0, 0);
      const images: PNG[] = [];
      for (const [name, url] of [
        [
          "edition",
          pathToFileURL(path.resolve("docs/design/v0.1/index.html")).href,
        ],
        ["application", "/"],
      ]) {
        await page.goto(url + "#" + surface);
        const target =
          surface === "settings"
            ? ".preferences"
            : surface === "library"
              ? ".wall-select"
              : ".reading-content h1";
        await expect(page.locator(target).first()).toBeVisible();
        await page.waitForLoadState("networkidle");
        await page.evaluate(async () => {
          await document.fonts.ready;
          await new Promise(requestAnimationFrame);
          await new Promise(requestAnimationFrame);
        });
        const buffer = await page.screenshot({
          path: info.outputPath(name + ".png"),
          animations: "disabled",
        });
        images.push(PNG.sync.read(buffer));
      }
      const diff = new PNG({ width, height }),
        changed = pixelmatch(
          images[0].data,
          images[1].data,
          diff.data,
          width,
          height,
          { threshold: 0.08 },
        );
      await fs.writeFile(
        info.outputPath("difference.png"),
        PNG.sync.write(diff),
      );
      await info.attach("changed-pixels", {
        body: String(changed),
        contentType: "text/plain",
      });
      expect(changed, "perceptible pixel differences").toBe(0);
    });
  }
