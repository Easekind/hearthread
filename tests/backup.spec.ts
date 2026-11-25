import { readFile } from "node:fs/promises";
import { test, expect } from "./chinese-library";
test("export library and restore into a fresh local store", async ({
  page,
  browser,
}, info) => {
  await page.goto("/");
  await page.getByLabel("导入书籍", { exact: true }).click();
  await page.locator("#import-files").setInputFiles({
    name: "备份样本.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# 已恢复\n\n离线书库。"),
  });
  await page.getByRole("button", { name: "导入 1 本" }).click();
  await expect(
    page.getByRole("button", { name: "选择 备份样本", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "选择 备份样本", exact: true })
    .dblclick();
  await page.locator(".markdown-content h1").click();
  await page.getByRole("button", { name: "阅读排版", exact: true }).click();
  await page.getByRole("button", { name: "双屏", exact: true }).click();
  await page.getByRole("button", { name: "返回书库" }).click();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByRole("button", { name: "跟随系统" }).click();
  await page.getByRole("button", { name: "阅读排版", exact: true }).click();
  await page.getByRole("slider", { name: "字号" }).press("Home");
  await page.getByRole("slider", { name: "行距" }).press("Home");
  await page.getByRole("button", { name: "字体类别，衬线" }).click();
  await page.getByRole("menuitemradio", { name: "无衬线" }).click();
  const fontInput = page.locator('input[accept=".otf,.ttf,.woff2"]');
  await fontInput.setInputFiles("public/design/font-1.ttf");
  await expect(
    page.getByRole("button", { name: "字体，Sora（已导入）" }),
  ).toBeVisible();
  const replacement = await readFile("public/design/font-2.woff2");
  for (const [name, buffer] of [
    ["not-a-font.txt", replacement],
    ["document.ttf", Buffer.from("%PDF-1.7")],
  ] as const) {
    await fontInput.setInputFiles({ name, mimeType: "", buffer });
    await expect(page.locator("#toast-root")).toContainText(
      "请选择 OTF、TTF 或 WOFF2",
    );
    await expect(
      page.getByRole("button", { name: "字体，Sora（已导入）" }),
    ).toBeVisible();
  }
  await fontInput.setInputFiles({
    name: "replacement.WOFF2",
    mimeType: "",
    buffer: replacement,
  });
  const fontLabel = "字体，Bodoni Moda 11pt（已导入）";
  await expect(page.getByRole("button", { name: fontLabel })).toBeVisible();
  await page.getByRole("button", { name: "本地存储", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出备份" }).click();
  const file = info.outputPath("library.zip");
  await (await download).saveAs(file);
  const fresh = await browser.newPage({ baseURL: "http://127.0.0.1:4173" });
  try {
    await fresh.goto("/#settings");
    await fresh
      .getByRole("button", { name: "Local storage", exact: true })
      .click();
    await fresh.locator("[type=file]").setInputFiles(file);
    await expect(fresh.getByRole("status")).toContainText("书库已恢复");
    await fresh.getByRole("button", { name: "外观", exact: true }).click();
    await expect(
      fresh.getByRole("button", { name: "跟随系统" }),
    ).toHaveAttribute("aria-pressed", "true");
    await fresh.getByRole("button", { name: "关闭面板" }).click();
    await fresh
      .getByRole("button", { name: "选择 备份样本", exact: true })
      .dblclick();
    await expect(fresh.locator(".markdown-content h1")).toHaveText("已恢复");
    await expect(fresh.locator(".text-document")).toHaveAttribute(
      "data-layout",
      "double",
    );
    const paragraph = fresh.locator(".markdown-content p");
    await expect(paragraph).toHaveCSS("font-size", "12px");
    await expect(paragraph).toHaveCSS("line-height", "12px");
    await expect(paragraph).toHaveCSS("font-family", /UserReading.*system-ui/);
    await fresh.locator(".reading-layer").focus();
    await fresh.keyboard.press("Enter");
    await fresh.getByRole("button", { name: "阅读排版", exact: true }).click();
    await fresh.getByRole("button", { name: fontLabel }).click();
    await expect(
      fresh.getByRole("menuitemradio", { name: "Bodoni Moda 11pt（已导入）" }),
    ).toHaveAttribute("aria-checked", "true");
  } finally {
    await fresh.close();
  }
});
