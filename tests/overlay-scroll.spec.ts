import { expect, test } from "@playwright/test";

test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

test("dialogs cover the window and settings preserve the library scrollbar and layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1260, height: 700 });
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
