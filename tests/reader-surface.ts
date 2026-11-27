import type { Page } from "@playwright/test";

export const markdown = (page: Page) =>
  page.frameLocator("foliate-paginator iframe").first().locator("body");
export const pdfPages = (page: Page) =>
  page.locator("foliate-fxl iframe[data-section-index]:visible");
export const columnCount = (page: Page) =>
  page
    .locator("foliate-paginator")
    .evaluate(
      (el) => (el as HTMLElement & { columnCount: number }).columnCount,
    );
export const readingPage = (page: Page) =>
  page
    .locator("foliate-paginator")
    .evaluate((el) => (el as HTMLElement & { page: number }).page);
