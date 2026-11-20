// Render the supplied typesetting specimen into an exportable original.
import fs from "node:fs";
import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
});
try {
  const page = await browser.newPage();
  await page.setContent(
    "<style>@page{size:A5;margin:16mm}body{font:14px/1.6 Georgia,serif}h1{font-size:37px;line-height:1.15}h2{font-size:20px}span{margin-right:16px}.small{font-size:11px}</style>" +
      fs.readFileSync("src/reader/pdf-sample.html", "utf8"),
  );
  await page.pdf({ path: "public/samples/pdf.pdf", preferCSSPageSize: true });
} finally {
  await browser.close();
}
