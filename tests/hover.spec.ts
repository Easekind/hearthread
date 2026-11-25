import { expect, test, type Locator, type Page } from "./chinese-library";

const background = (el: Locator) =>
  el.evaluate((node) => getComputedStyle(node).backgroundColor);

async function hoverCycle(page: Page, el: Locator) {
  await page.mouse.move(1, 1);
  const idle = await background(el);
  await el.hover();
  await expect.poll(() => background(el)).not.toBe(idle);
  await page.mouse.move(1, 1);
  await expect.poll(() => background(el)).toBe(idle);
}

for (const theme of ["素白", "暖纸", "墨夜"]) {
  test(
    theme + " controls restore their resting state on pointer exit",
    async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/#settings");
      await page.locator(".paper-choice").filter({ hasText: theme }).click();
      await hoverCycle(page, page.getByRole("button", { name: "跟随系统" }));
      await hoverCycle(
        page,
        page.locator(".preferences-nav [aria-current=page]"),
      );
      await page.getByRole("button", { name: "关闭面板" }).click();
      const brand = page.getByRole("button", { name: "hearthread 书库" });
      await brand.hover();
      await expect(brand).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      for (const selector of [
        ".import-button",
        ".manage-library",
        ".nav-bottom button",
        ".view-switch .active",
      ]) {
        await hoverCycle(page, page.locator(selector));
      }
      await page.getByRole("button", { name: "管理藏书" }).click();
      const row = page.locator("tbody tr").first();
      const idle = await background(row);
      await row.locator(".title-cell button").click();
      await page.mouse.move(1, 1);
      await expect.poll(() => background(row)).toBe(idle);
      await expect(row.getByRole("checkbox")).toBeChecked();
    },
  );
}

test("reader menu uses the reading paper and follows keyboard and mouse independently", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#read-1");
  await page.locator(".reading-layer").focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "阅读排版", exact: true }).click();
  await page
    .locator(".room-panel .paper-choice")
    .filter({ hasText: "墨夜" })
    .click();
  await page.getByRole("button", { name: "字体类别，衬线" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toHaveCSS(
    "background-color",
    await background(page.locator(".room-panel")),
  );
  const options = menu.getByRole("menuitemradio");
  const first = options.first(),
    last = options.last();
  await first.hover();
  const highlight = await background(first);
  await page.keyboard.press("ArrowDown");
  await expect(last).toBeFocused();
  await expect.poll(() => background(last)).toBe(highlight);
  await expect.poll(() => background(first)).not.toBe(highlight);
  await first.hover({ position: { x: 5, y: 5 } });
  await expect.poll(() => background(first)).toBe(highlight);
  await expect.poll(() => background(last)).not.toBe(highlight);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
});

test("settings paints the new hover state on the first frame in both directions", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const settings = page.getByRole("button", { name: "设置", exact: true });
  await page.mouse.move(1, 1);
  const idle = await background(settings);

  // Record the first frame and the settled color in the page, without polling
  // past the frame a reader actually sees as the pointer crosses the button.
  async function firstAndSettled(
    event: "pointerenter" | "pointerleave",
    move: () => Promise<void>,
  ) {
    await settings.evaluate((el, event) => {
      el.addEventListener(
        event,
        () => {
          requestAnimationFrame(async () => {
            const first = getComputedStyle(el).backgroundColor;
            await Promise.all(
              el.getAnimations().map((animation) => animation.finished),
            );
            el.setAttribute(
              "data-paint-sample",
              JSON.stringify([first, getComputedStyle(el).backgroundColor]),
            );
          });
        },
        { once: true },
      );
      el.removeAttribute("data-paint-sample");
    }, event);
    await move();
    await expect(settings).toHaveAttribute("data-paint-sample", /./);
    return JSON.parse((await settings.getAttribute("data-paint-sample"))!) as [
      string,
      string,
    ];
  }

  const [enter, hovered] = await firstAndSettled("pointerenter", () =>
    settings.hover(),
  );
  const [leave, restored] = await firstAndSettled("pointerleave", () =>
    page.mouse.move(1, 1),
  );
  expect(hovered).not.toBe(idle);
  expect(restored).toBe(idle);
  expect([enter, leave]).toEqual([hovered, idle]);
});
