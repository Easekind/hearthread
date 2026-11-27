// Refresh the shared publication runtime from a checked-out fork. Review the diff before upgrading.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
const repo = path.resolve(process.argv[2] ?? "../foliate-js");
const revision = execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const destination = "public/foliate";
const modules = [
  "view",
  "epub",
  "epubcfi",
  "progress",
  "overlayer",
  "text-walker",
  "section-chunks",
  "paginator",
  "fixed-layout",
  "search",
];
for (const name of [
  ...modules.map((n) => n + ".js"),
  "vendor/zip.js",
  "LICENSE",
]) {
  // Read committed blobs so the recorded revision reproduces the exact resources.
  const bytes = execFileSync(
    "git",
    ["-C", repo, "show", revision + ":" + name],
    { maxBuffer: 4 * 1024 * 1024 },
  );
  let data = bytes;
  if (name === "paginator.js") {
    const marker = "    getContents() {";
    const source = bytes.toString();
    if (!source.includes(marker))
      throw new Error("Review paginator page metrics");
    data = Buffer.from(
      "import { pageRange } from './page-numbers.js'\n" +
        source.replace(
          marker,
          `    get rtl() { return this.#rtl }
    getPageRange(fontKey, prepare) {
        return pageRange(this, this.#sortedViews, this.#renderedStart, this.size / this.columnCount, this.#styles, fontKey, prepare)
    }
` + marker,
        ),
    );
  }
  if (name === "fixed-layout.js") {
    // When regrouping a spread, retain the selected original page on either side.
    const source = bytes
      .toString()
      .replace("import 'construct-style-sheets-polyfill'\n", "");
    const start = source.indexOf("    #respread(spreadMode) {");
    const end = source.indexOf("\n    }", start);
    const method = source.slice(start, end);
    const updated = method
      .replace("const { index }", "const { index, side }")
      .replace(
        "this.goToSpread(index, this.rtl ? 'right' : 'left', 'page')",
        "this.goToSpread(index, side, 'page')",
      );
    if (!updated.includes("this.goToSpread(index, side, 'page')"))
      throw new Error(
        "Review fixed-layout page selection before updating the renderer",
      );
    data = Buffer.from(source.slice(0, start) + updated + source.slice(end));
  }
  fs.writeFileSync(path.join(destination, name), data);
}
fs.writeFileSync(path.join(destination, "REVISION"), revision + "\n");
