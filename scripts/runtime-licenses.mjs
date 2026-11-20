// Keep redistributable notices alongside the offline application.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const notices = [];
for (const [path, item] of Object.entries(lock.packages)) {
  if (!path || item.dev || item.optional) continue;
  const name = path.split("node_modules/").at(-1);
  const sources = readdirSync(path, { withFileTypes: true }).filter(
    (f) =>
      f.isFile() && /^(license|licence|notice|copying)(\.|-|$)/i.test(f.name),
  );
  notices.push(
    [
      name + " " + item.version + " (" + (item.license ?? "see upstream") + ")",
      ...sources.map((f) => readFileSync(join(path, f.name), "utf8")),
    ].join("\n"),
  );
}
writeFileSync("public/licenses/runtime.txt", notices.join("\n\n"));
