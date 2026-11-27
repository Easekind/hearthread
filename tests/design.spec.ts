import { test, expect } from "./chinese-library";
import { columnCount } from "./reader-surface";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
for (const [width, height] of [
  [1440, 900],
  [390, 844],
  [744, 1133],
])
  for (const surface of width === 744
    ? ["spread"]
    : [
        "library",
        "settings",
        "language",
        "typography",
        "read-1",
        "spread",
        "toolbar",
        "search",
      ]) {
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
        const section =
          surface === "typography"
            ? "阅读排版"
            : surface === "language"
              ? "语言"
              : "";
        await page.goto(
          url +
            "#" +
            (section
              ? "settings"
              : ["spread", "toolbar", "search"].includes(surface)
                ? "read-1"
                : surface),
        );
        if (surface === "toolbar" || surface === "search") {
          await page.locator(".reading-layer").focus();
          await page.keyboard.press("Enter");
          await expect(page.locator(".page-position")).toHaveText("第 1 页");
        }
        if (surface === "search") {
          await page.getByRole("button", { name: "书内搜索" }).click();
          await page.getByLabel("搜索本书").fill("pond");
          await expect(page.locator(".search-group").nth(1)).toBeVisible();
          const result = page.locator(".search-hit").first();
          await expect(result).toHaveCSS("white-space", "normal");
          expect(
            await result.evaluate((el) => el.scrollWidth <= el.clientWidth),
          ).toBe(true);
          await page.getByLabel("搜索本书").blur();
          await page.mouse.move(0, 0);
        }
        if (surface === "spread") {
          await page.locator(".reading-layer").focus();
          await page.keyboard.press("Enter");
          await page
            .getByRole("button", { name: "阅读排版", exact: true })
            .click();
          if (width === 390) {
            await expect(
              page.getByRole("group", { name: "页面布局" }),
            ).toHaveCount(0);
          } else {
            await page
              .getByRole("button", { name: "双屏", exact: true })
              .click();
          }
          await page.getByRole("button", { name: "关闭阅读排版" }).click();
          await page.locator(".reading-layer").focus();
          await page.keyboard.press("Enter");
          await expect
            .poll(() => columnCount(page))
            .toBe(width === 390 ? 1 : 2);
          await page.mouse.move(0, 0);
        }
        if (section) {
          if (width === 390) {
            await page.getByRole("button", { name: /设置分类/ }).click();
            await page.getByRole("menuitemradio", { name: section }).click();
          } else {
            await page
              .getByRole("button", { name: section, exact: true })
              .click();
          }
        }
        const target =
          surface === "typography"
            ? ".type-specimen"
            : surface === "settings" || surface === "language"
              ? ".preferences"
              : surface === "library"
                ? ".wall-select"
                : "foliate-paginator iframe";
        await expect(page.locator(target).first()).toBeVisible();
        await page.waitForLoadState("networkidle");
        await page.evaluate(async () => {
          await document.fonts.ready;
          await new Promise(requestAnimationFrame);
          await new Promise(requestAnimationFrame);
        });
        const capture =
          surface === "typography"
            ? page.locator(".type-specimen")
            : surface === "search"
              ? page.locator(".panel-search")
              : surface === "toolbar"
                ? page.locator(".room-dock")
                : surface === "language"
                  ? page.locator(".pref-group")
                  : page;
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
