// Render the supplied typesetting specimen into an exportable original.
import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
});
try {
  const page = await browser.newPage();
  await page.goto(
    new URL("./samples/architecture/index.html", import.meta.url).href,
  );
  await page.evaluate(() =>
    Promise.all([...document.images].map((img) => img.decode())),
  );
  await page.pdf({ path: "public/samples/pdf.pdf", preferCSSPageSize: true });
} finally {
  await browser.close();
}
