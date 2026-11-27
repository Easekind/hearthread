import { markdown, readingPage, columnCount } from "./reader-surface";
import { expect, test } from "./chinese-library";

test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

test("dialogs cover the window and settings preserve the library scrollbar and layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1260, height: 350 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator(".wall-select").first().waitFor();
  const libraryWidth = () =>
    page.evaluate(() => document.documentElement.clientWidth);
  const width = await libraryWidth();
  expect(width).toBeLessThan(1260);
  await page.evaluate(() => window.scrollTo(0, 140));
  for (const [button, overlay] of [
    ["导入书籍", ".modal-backdrop"],
    ["设置", ".library-scrim"],
  ]) {
    const opener = page.getByRole("button", { name: button, exact: true });
    await opener.scrollIntoViewIfNeeded();
    const scrollY = await page.evaluate(() => window.scrollY);
    const importButton = page.locator(".import-button");
    const bounds = await importButton.boundingBox();
    await opener.click();
    const scrim = page.locator(overlay);
    await expect(scrim).toBeVisible();
    await expect
      .poll(() => scrim.evaluate((el) => el.getBoundingClientRect().right))
      .toBe(button === "设置" ? width : 1260);
    if (button === "设置") {
      expect(await libraryWidth()).toBe(width);
      expect(await importButton.boundingBox()).toEqual(bounds);
    }
    await page.mouse.move(400, 250);
    await page.mouse.wheel(0, 400);
    await page.keyboard.press("Escape");
    await expect(scrim).toHaveCount(0);
    expect(await libraryWidth()).toBe(width);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
    expect(await importButton.boundingBox()).toEqual(bounds);
  }
});

test("阅读正文隐藏滚动条，保留单屏分页、双屏翻页和续读", async ({ page }) => {
  await page.setViewportSize({ width: 1260, height: 700 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "导入书籍", exact: true })
    .first()
    .click();
  await page.locator("#import-files").setInputFiles({
    name: "长文.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      Array.from(
        { length: 100 },
        (_, i) => "## 随笔 " + i + "\n\n今天的阅读记录。",
      ).join("\n\n"),
    ),
  });
  await page.getByRole("button", { name: "导入 1 本", exact: true }).click();
  const book = page.getByRole("button", { name: "选择 长文", exact: true });
  await book.dblclick();
  const layer = page.locator(".reading-layer");
  await expect(markdown(page).locator("h2")).toHaveCount(100);
  expect(
    await layer.evaluate(
      (el) => el.getBoundingClientRect().width - el.clientWidth,
    ),
  ).toBe(0);
  const currentPage = () => readingPage(page);
  await page.mouse.move(550, 350);
  await page.mouse.wheel(0, 700);
  await expect.poll(currentPage).toBeGreaterThan(0);
  await layer.focus();
  await page.keyboard.press("Escape");
  await book.dblclick();
  await expect.poll(currentPage).toBeGreaterThan(0);
  await layer.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "阅读排版", exact: true }).click();
  await page.getByRole("button", { name: "双屏", exact: true }).click();
  await page.getByRole("button", { name: "关闭阅读排版" }).click();
  await expect.poll(() => columnCount(page)).toBe(2);
  const previous = await currentPage();
  await layer.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(currentPage).toBeGreaterThan(previous);
});
