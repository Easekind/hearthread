import { markdown, readingPage } from "./reader-surface";
import { expect, test } from "@playwright/test";

// A Chinese OS must still get the product's English first-launch default.
test.use({ locale: "zh-CN" });
for (const width of [1440, 390]) {
  test(
    "switch, persist and restore interface language at " + width,
    async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      await expect(
        page.getByRole("heading", { name: "My library" }),
      ).toBeVisible();
      await expect(page.locator(".heading-name")).toContainText("3 books");
      await expect(page).toHaveTitle("hearthread · Library");
      await page
        .getByRole("button", { name: "Import books", exact: true })
        .click();
      await page.locator("#import-files").setInputFiles({
        name: "我的 notes.md",
        mimeType: "text/markdown",
        buffer: Buffer.from(
          "# 原文 stays\n\n" + "Keep this paragraph.\n\n".repeat(180),
        ),
      });
      if (width === 390)
        await expect(page.locator(".file-drop")).toBeInViewport();
      await page
        .getByRole("button", { name: "Import 1 book", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Select 我的 notes", exact: true })
        .dblclick();
      const reader = page.locator(".reading-layer");
      await expect(markdown(page).locator("h1")).toHaveText("原文 stays");
      await reader.focus();
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => readingPage(page)).toBeGreaterThan(0);
      await reader.focus();
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "Back to library" }).click();
      async function openLanguage(chinese: boolean) {
        if (width === 390)
          await page
            .getByRole("button", {
              name: chinese ? "展开导航" : "Expand navigation",
            })
            .click();
        await page
          .getByRole("button", {
            name: chinese ? "设置" : "Settings",
            exact: true,
          })
          .click();
        if (width === 390) {
          await page
            .getByRole("button", {
              name: chinese ? /设置分类/ : /Settings categories/,
            })
            .click();
          await page
            .getByRole("menuitemradio", {
              name: chinese ? "语言" : "Language",
              exact: true,
            })
            .click();
        } else {
          await page
            .getByRole("button", {
              name: chinese ? "语言" : "Language",
              exact: true,
            })
            .click();
        }
        await page
          .getByRole("button", {
            name: chinese ? /界面语言/ : /Interface language/,
          })
          .click();
      }
      await openLanguage(false);
      await page.getByRole("menuitemradio", { name: "简体中文" }).click();
      await expect(
        page.getByRole("button", { name: "界面语言，简体中文" }),
      ).toBeVisible();
      await page.reload();
      await expect(page).toHaveTitle("hearthread · 书库");
      await page.getByRole("button", { name: "关闭面板" }).click();
      await page
        .getByRole("button", { name: "选择 我的 notes", exact: true })
        .dblclick();
      await expect(markdown(page).locator("h1")).toHaveText("原文 stays");
      await expect.poll(() => readingPage(page)).toBeGreaterThan(0);
      await page.keyboard.press("Escape");
      await openLanguage(true);
      await page.getByRole("menuitemradio", { name: "English" }).click();
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await page.reload();
      await page.getByRole("button", { name: "Close panel" }).click();
      await expect(
        page.getByRole("heading", { name: "My library" }),
      ).toBeVisible();
    },
  );
}
