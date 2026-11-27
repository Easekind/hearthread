// Lift the supplied edition artwork and type without rasterizing the interface.
import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { zipSync, strToU8 } from "fflate";
const source = fs.readFileSync("docs/design/v0.1/index.html", "utf8");
const section = (a, b) =>
  source.slice(source.indexOf(a), source.indexOf(b, source.indexOf(a)));
const write = (path, data) => fs.writeFileSync(path, data);
let font = 0;
const css = source
  .match(/<style>([\s\S]*?)<\/style>/)[1]
  .replace(/data:font\/(\w+);base64,([\w+/=]+)/g, (_, ext, data) => {
    const path = "design/font-" + ++font + "." + ext;
    write("public/" + path, Buffer.from(data, "base64"));
    return "/" + path;
  });
write("public/design/edition.css", css);
write(
  "public/design/licenses.txt",
  source.match(
    /<script type="text\/plain" id="font-licenses">([\s\S]*?)<\/script>/,
  )[1] +
    section("</style>", "</head>")
      .replaceAll("<!--", "\n")
      .replaceAll("-->", "\n")
      .replace("</style>", ""),
);
// Only execute pure asset builders from the checked-in edition, at development time.
const ctx = vm.createContext({});
const evaluate = (code) => vm.runInContext(code, ctx);
evaluate(section("const paths=", "const drawerViewport"));
write("src/ui/icons.json", JSON.stringify(evaluate("paths"), null, 2));
evaluate(fs.readFileSync("docs/design/v0.1/sample-books.js", "utf8"));
evaluate(
  section("const esc=", "const btn=") +
    section("const jacketArt=", "/* EDITION_COVERS_END"),
);
const books = evaluate("originalBooks");
const images = evaluate("jacketArt");
for (const { style: key } of books) {
  const data = images[key];
  if (!data) continue;
  write(
    "public/design/" + key + ".jpg",
    Buffer.from(data.split(",")[1], "base64"),
  );
  images[key] = "/design/" + key + ".jpg";
}
const jackets = {};
for (const book of books)
  jackets[book.style] = evaluate("cover")(book).match(
    /<svg[^>]*>([\s\S]*?)<\/svg>/,
  )[1];
write("src/library/jackets.json", JSON.stringify(jackets, null, 2));
write("src/library/edition.json", JSON.stringify(books, null, 2));
const brand = source.match(/<svg class="brand-wordmark"[\s\S]+?<\/svg>/)[0];
write("src/ui/wordmark.svg", brand);
const chapters = evaluate("chapterNames"),
  prose = evaluate("prose");
// The HTML design can be opened directly from disk, including its paginated preview.
execFileSync("bun", [
  "build",
  "public/foliate/paginator.js",
  "--format=iife",
  "--minify",
  "--banner=/* Foliate paginator · MIT · see ../../../public/foliate/LICENSE */",
  "--outfile=docs/design/v0.1/publication-paginator.js",
]);
for (const book of books.filter((book) => book.type === "EPUB")) {
  const name = "public/samples/" + book.style;
  const escape = evaluate("esc");
  const files = {
    mimetype: "application/epub+zip",
    "META-INF/container.xml":
      '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
  };
  const x = (s) =>
    '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>' +
    book.title +
    "</title></head><body>" +
    s +
    "</body></html>";
  files["nav.xhtml"] = x(
    '<nav epub:type="toc"><ol>' +
      chapters
        .map((t, i) => '<li><a href="c' + i + '.xhtml">' + t + "</a></li>")
        .join("") +
      "</ol></nav>",
  );
  files["book.opf"] =
    '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">' +
    book.style +
    "</dc:identifier><dc:title>" +
    book.title +
    '</dc:title><dc:creator>Henry David Thoreau</dc:creator><dc:language>en</dc:language><meta property="dcterms:modified">2026-11-25T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>' +
    chapters
      .map(
        (_, i) =>
          '<item id="c' +
          i +
          '" href="c' +
          i +
          '.xhtml" media-type="application/xhtml+xml"/>',
      )
      .join("") +
    "</manifest><spine>" +
    chapters.map((_, i) => '<itemref idref="c' + i + '"/>').join("") +
    "</spine></package>";
  chapters.forEach(
    (title, i) =>
      (files["c" + i + ".xhtml"] = x(
        "<h1>" +
          escape(title) +
          "</h1>" +
          prose[i].map((p) => "<p>" + escape(p) + "</p>").join(""),
      )),
  );
  write(
    name + ".epub",
    zipSync(
      Object.fromEntries(
        Object.entries(files).map(([k, v]) => [
          k,
          k === "mimetype" ? [strToU8(v), { level: 0 }] : strToU8(v),
        ]),
      ),
      { level: 6, mtime: new Date(2020, 0, 1) },
    ),
  );
}
