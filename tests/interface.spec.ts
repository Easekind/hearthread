import { test, expect } from "@playwright/test";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
for (const [width, height] of [
  [1440, 900],
  [390, 844],
]) {
  test("edition comparison " + width, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const [label, url] of [
      [
        "reference",
        pathToFileURL(path.resolve("docs/design/v0.1/index.html")).href,
      ],
      ["app", "/"],
    ]) {
      await page.goto(url);
      await expect(page.locator(".wall-item")).toHaveCount(12);
      await page.evaluate(() => document.fonts.ready);
      await page.locator(".wall-select").first().waitFor();
      await page.screenshot({
        path: info.outputPath(label + ".png"),
        animations: "disabled",
      });
      const bounds = await page
        .locator(
          ".studio-nav,.studio-heading,.studio-search,.wall-item,.reading-dock,.wall-title",
        )
        .evaluateAll((nodes) =>
          nodes.map((n) => [
            n.className,
            ...["x", "y", "width", "height"].map(
              (key) =>
                Math.round(n.getBoundingClientRect()[key as "x"] * 10) / 10,
            ),
          ]),
        );
      await fs.writeFile(
        info.outputPath(label + ".json"),
        JSON.stringify(bounds),
      );
    }
    expect(await fs.readFile(info.outputPath("app.json"), "utf8")).toBe(
      await fs.readFile(info.outputPath("reference.json"), "utf8"),
    );
  });
}
test("manage, find and restore a deleted book", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "列表", exact: true }).click();
  await page.getByRole("button", { name: "瓦尔登湖 的更多操作" }).click();
  await page.getByText("重命名", { exact: true }).click();
  await page.getByLabel("书籍名称").fill("林间读本");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("searchbox", { name: "搜索书库" }).fill("林间读本");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "管理藏书" }).click();
  await page.getByRole("button", { name: "全选", exact: true }).click();
  await page.getByRole("button", { name: "删除", exact: true }).click();
  await page.getByRole("button", { name: "删除 1 本书" }).click();
  await expect(page.getByText("没有找到匹配的书籍")).toBeVisible();
  await page.getByRole("button", { name: "撤销" }).click();
  await expect(page.getByText("林间读本", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("林间读本", { exact: true })).toBeVisible();
});
test("mobile settings and saved appearance", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "展开导航" }).click();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByRole("button", { name: /墨夜/ }).click();
  await expect(page.locator("body")).toHaveClass(/theme-dark/);
  await page.getByRole("button", { name: "关闭面板" }).click();
  await page.reload();
  await expect(page.locator("body")).toHaveClass(/theme-dark/);
  await expect(page.locator(".reading-dock")).toBeVisible();
});
test("system appearance and typography sliders persist between surfaces", async ({
  page,
}) => {
  await page.goto("/#settings");
  const system = page.getByRole("switch", { name: "跟随系统外观" });
  await system.press("Space");
  await expect(system).toBeChecked();
  await page.reload();
  await expect(system).toBeChecked();
  await page.getByRole("button", { name: "阅读排版", exact: true }).click();
  const size = page.getByRole("slider", { name: "字号" });
  const leading = page.getByRole("slider", { name: "行距" });
  await size.press("End");
  await expect(size).toHaveAttribute("aria-valuenow", "30");
  await leading.press("ArrowRight");
  await expect(leading).toHaveAttribute("aria-valuenow", "2");

  await page.goto("/#read-1");
  await page.locator(".reading-layer").focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "阅读排版", exact: true }).click();
  await expect(size).toHaveAttribute("aria-valuenow", "30");
  await expect(leading).toHaveAttribute("aria-valuenow", "2");
  const chapter = page.getByRole("slider", { name: "选择章节" });
  const initialChapter = await chapter.getAttribute("aria-valuenow");
  await size.press("ArrowLeft");
  await expect(size).toHaveAttribute("aria-valuenow", "29");
  await expect(chapter).toHaveAttribute("aria-valuenow", initialChapter!);
});
