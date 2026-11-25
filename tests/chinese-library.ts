import { expect, test as base } from "@playwright/test";
export { expect };
export type { Page, Locator } from "@playwright/test";

// These scenarios compare the Chinese design or assert Chinese accessible names.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.goto("/#settings");
    await page.getByRole("button", { name: "Language", exact: true }).click();
    await page
      .getByRole("button", { name: "Interface language, English" })
      .click();
    await page.getByRole("menuitemradio", { name: "简体中文" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await page.goto("about:blank");
    await use(page);
  },
});
