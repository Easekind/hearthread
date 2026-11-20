import { test, expect } from "@playwright/test";
test("export library and restore into a fresh local store", async ({
  page,
  browser,
}, info) => {
  await page.goto("/");
  await page.getByLabel("导入书籍", { exact: true }).click();
  await page
    .locator("#import-files")
    .setInputFiles({
      name: "备份样本.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# 已恢复\n\n离线书库。"),
    });
  await page.getByRole("button", { name: "导入 1 本" }).click();
  await expect(
    page.getByRole("button", { name: "选择 备份样本", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByRole("button", { name: "本地存储", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出备份" }).click();
  const file = info.outputPath("library.zip");
  await (await download).saveAs(file);
  const fresh = await browser.newPage({ baseURL: "http://127.0.0.1:4173" });
  try {
    await fresh.goto("/#settings");
    await fresh.getByRole("button", { name: "本地存储", exact: true }).click();
    await fresh.locator("[type=file]").setInputFiles(file);
    await expect(fresh.getByRole("status")).toContainText("书库已恢复");
    await fresh.getByRole("button", { name: "关闭面板" }).click();
    await fresh
      .getByRole("button", { name: "选择 备份样本", exact: true })
      .dblclick();
    await expect(fresh.locator(".markdown-content h1")).toHaveText("已恢复");
  } finally {
    await fresh.close();
  }
});
