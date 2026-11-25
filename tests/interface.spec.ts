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
  const choices = page.getByRole("group", { name: "书库外观" });
  const system = choices.getByRole("button", { name: "跟随系统" });
  await expect(choices.getByRole("button")).toHaveCount(4);
  await page.emulateMedia({ colorScheme: "light" });
  await system.press("Space");
  await expect(system).toHaveAttribute("aria-pressed", "true");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("body")).toHaveClass(/theme-dark/);
  await page.reload();
  await expect(system).toHaveAttribute("aria-pressed", "true");
  await expect(choices.getByRole("button", { pressed: true })).toHaveCount(1);
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("body")).not.toHaveClass(/theme-dark/);
  await choices.getByRole("button", { name: "暖纸" }).click();
  await expect(system).toHaveAttribute("aria-pressed", "false");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("body")).toHaveClass(/theme-paper/);
  await page.getByRole("button", { name: "阅读排版", exact: true }).click();
  const size = page.getByRole("slider", { name: "字号" });
  const leading = page.getByRole("slider", { name: "行距" });
  await page.getByRole("button", { name: "字体类别，衬线" }).click();
  await page.getByRole("menuitemradio", { name: "无衬线" }).click();
  await page.getByRole("button", { name: "字体，系统默认" }).click();
  const family = page.getByRole("menuitemradio").nth(1);
  const selectedFont = (await family.innerText()).trim();
  await family.click();
  await expect(
    page.getByRole("button", { name: "字体，" + selectedFont }),
  ).toBeVisible();
  const preview = page.locator(".type-specimen p").first();
  const previewFamily = await preview.evaluate(
    (p) => getComputedStyle(p).fontFamily,
  );
  await size.press("Home");
  await leading.press("Home");
  await expect(preview).toHaveCSS("font-size", "12px");
  await expect(preview).toHaveCSS("line-height", "12px");
  await expect(page.locator(".type-specimen p[lang=en]")).toHaveCSS(
    "font-size",
    "12px",
  );
  await size.press("End");
  await expect(size).toHaveAttribute("aria-valuenow", "30");
  await leading.press("ArrowRight");
  await expect(leading).toHaveAttribute("aria-valuenow", "1.05");

  await page.goto("/#read-1");
  await page.locator(".reading-layer").focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "阅读排版", exact: true }).click();
  await expect(size).toHaveAttribute("aria-valuenow", "30");
  await expect(leading).toHaveAttribute("aria-valuenow", "1.05");
  await expect(
    page.getByRole("button", { name: "字体，" + selectedFont }),
  ).toBeVisible();
  await expect(page.locator(".reading-content p").first()).toHaveCSS(
    "font-family",
    previewFamily,
  );
  const chapter = page.getByRole("slider", { name: "选择章节" });
  const initialChapter = await chapter.getAttribute("aria-valuenow");
  await size.press("ArrowLeft");
  await expect(size).toHaveAttribute("aria-valuenow", "29");
  await expect(chapter).toHaveAttribute("aria-valuenow", initialChapter!);
  await page.getByRole("button", { name: "恢复默认排版" }).click();
  await expect(
    page.getByRole("button", { name: "字体类别，衬线" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "字体，系统默认" }),
  ).toBeVisible();
  await expect(size).toHaveAttribute("aria-valuenow", "20");
});

test("native font dialog filters imports and replacements", async ({
  page,
}) => {
  await page.goto("/#settings");
  await page.getByRole("button", { name: "阅读排版", exact: true }).click();
  const filters: unknown[] = [];
  let path: string | null = "/selected/Sora.ttf";
  // Exercise the native picker button without showing an OS dialog on CI.
  await page.exposeFunction(
    "pickFontInTest",
    (options: { filters: unknown }) => {
      filters.push(options.filters);
      return path;
    },
  );
  await page.evaluate(() => {
    Object.assign(window, {
      isTauri: true,
      __TAURI_INTERNALS__: {
        async invoke(
          command: string,
          args: { options: unknown; path: string },
        ) {
          if (command === "plugin:dialog|open")
            return Reflect.get(window, "pickFontInTest")(args.options);
          if (
            command === "plugin:fs|read_file" &&
            args.path === "/selected/Sora.ttf"
          )
            return (await fetch("/design/font-1.ttf")).arrayBuffer();
          throw new Error("Unexpected command " + command);
        },
      },
    });
  });
  await page.getByRole("button", { name: "导入字体", exact: true }).click();
  const current = page.getByRole("button", { name: "字体，Sora（已导入）" });
  await expect(current).toBeVisible();
  path = null;
  const replace = page.getByRole("button", { name: "更换字体", exact: true });
  await replace.click();
  await expect(replace).toBeEnabled();
  await expect(current).toBeVisible();
  const expected = [{ name: "字体文件", extensions: ["otf", "ttf", "woff2"] }];
  expect(filters).toEqual([expected, expected]);
});
