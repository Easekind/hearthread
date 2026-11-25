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
  for (const surface of ["library", "settings", "typography", "read-1"]) {
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
        await page.goto(
          url + "#" + (surface === "typography" ? "settings" : surface),
        );
        if (surface === "typography") {
          if (width === 390) {
            await page.getByRole("button", { name: /设置分类/ }).click();
            await page.getByRole("menuitemradio", { name: "阅读排版" }).click();
          } else {
            await page
              .getByRole("button", { name: "阅读排版", exact: true })
              .click();
          }
        }
        const target =
          surface === "typography"
            ? ".type-specimen"
            : surface === "settings"
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
        const capture =
          surface === "typography" ? page.locator(".type-specimen") : page;
        const buffer = await capture.screenshot({
          path: info.outputPath(name + ".png"),
          animations: "disabled",
        });
        images.push(PNG.sync.read(buffer));
      }
      const { width: w, height: h } = images[0];
      const diff = new PNG({ width: w, height: h }),
        changed = pixelmatch(images[0].data, images[1].data, diff.data, w, h, {
          threshold: 0.08,
        });
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
