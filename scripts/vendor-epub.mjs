// Refresh the EPUB-only runtime from a checked-out fork. Review the diff before upgrading.
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
  const data =
    name === "fixed-layout.js"
      ? bytes
          .toString()
          .replace("import 'construct-style-sheets-polyfill'\n", "")
      : bytes;
  fs.writeFileSync(path.join(destination, name), data);
}
fs.writeFileSync(path.join(destination, "REVISION"), revision + "\n");
