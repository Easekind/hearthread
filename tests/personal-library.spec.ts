import { test, expect } from "./chinese-library";
import { basename } from "node:path";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
// Additional acceptance run against a reader's own files, kept outside the repository.
for (const format of ["EPUB", "PDF"] as const) {
  test("personal library " + format, async ({ page }) => {
    const file = process.env["HEARTHREAD_TEST_" + format];
    test.skip(!file, "Set HEARTHREAD_TEST_" + format + " to a local book");
    test.setTimeout(150_000);
    const id = createHash("sha256")
      .update(await fs.readFile(file!))
      .digest("hex");
    await page.goto("/");
    await page.getByLabel("导入书籍", { exact: true }).click();
    await page.locator("#import-files").setInputFiles(file!);
    await page.getByRole("button", { name: "导入 1 本" }).click();
    await page.locator('[data-focus-book="' + id + '"]').dblclick();
    if (format === "PDF") {
      await expect(page.locator(".pdf-sheet canvas")).toBeVisible({
        timeout: 30000,
      });
      await page.locator(".reading-layer").focus();
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "目录", exact: true }).click();
      await page.locator(".contents-list button").nth(9).click();
      await expect(page.locator(".pdf-fit")).toContainText("第 10 页", {
        timeout: 30000,
      });
    } else {
      await expect(page.locator("foliate-view iframe").first()).toBeVisible({
        timeout: 30000,
      });
      await page.locator(".reading-layer").focus();
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "目录", exact: true }).click();
      const entries = page.locator(".contents-list button");
      await expect(entries.nth(5)).toBeVisible();
      await entries.nth(5).click();
    }
    await page.getByRole("button", { name: "返回书库" }).click();
    await expect(page.locator(".reading-layer")).toHaveCount(0);
    await page.reload();
    await page.locator('[data-focus-book="' + id + '"]').dblclick();
    if (format === "PDF")
      await expect(page.locator(".pdf-fit")).toContainText("第 10 页", {
        timeout: 30000,
      });
    else
      await expect(page.locator(".chapter-position")).not.toContainText("/ 0", {
        timeout: 30000,
      });
    await test
      .info()
      .attach("input", { body: basename(file!), contentType: "text/plain" });
  });
}
