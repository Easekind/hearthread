// Keep redistributable notices alongside the offline application.
import {
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

const root = resolve("package.json");
const notices = new Map();

function collect(name, parent, optional = false) {
  const manifest = createRequire(parent)
    .resolve.paths(name)
    .map((dir) => join(dir, name, "package.json"))
    .find(existsSync);
  if (!manifest) {
    if (optional) return;
    throw new Error(`Missing runtime dependency ${name} required by ${parent}`);
  }
  const path = realpathSync(manifest);
  if (notices.has(path)) return;
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  const directory = dirname(path);
  const sources = readdirSync(directory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        /^(license|licence|notice|copying)(\.|-|$)/i.test(entry.name),
    )
    .map((entry) => entry.name)
    .sort();
  notices.set(
    path,
    [
      `${pkg.name} ${pkg.version} (${pkg.license ?? "see upstream"})`,
      ...sources.map((file) => readFileSync(join(directory, file), "utf8")),
    ].join("\n"),
  );
  for (const dep of Object.keys(pkg.dependencies ?? {})) {
    if (!(dep in (pkg.optionalDependencies ?? {}))) collect(dep, path);
  }
  for (const peer of Object.keys(pkg.peerDependencies ?? {})) {
    collect(peer, path, pkg.peerDependenciesMeta?.[peer]?.optional);
  }
}

for (const name of Object.keys(
  JSON.parse(readFileSync(root, "utf8")).dependencies,
)) {
  collect(name, root);
}
writeFileSync(
  "public/licenses/runtime.txt",
  [...new Set(notices.values())].sort().join("\n\n"),
);
