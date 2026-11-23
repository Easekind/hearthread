import fs from "node:fs";
const read = (file) => fs.readFileSync(new URL(file, import.meta.url), "utf8");
let html = read("../v0.8/index.html");
function replace(original, replacement) {
  if (!html.includes(original))
    throw Error("Missing prototype source: " + original);
  html = html.replace(original, () => replacement);
}
replace(
  "<title>hearthread v0.8 / Modern Library</title>",
  "<title>hearthread · 书库 v0.1</title>",
);
replace("shellTheme='dark'", "shellTheme='light'");
// Keep the inherited button interactions exclusive to actionable controls.
replace("button:hover{background:var(--color-paper-2)}", "");
// Button hover colors must match the pointer on the first frame.
replace(
  "button,input,select{transition:background-color",
  "input,select{transition:background-color",
);
html = html.replaceAll(
  ".wall-item:hover .wall-object",
  ".wall-select:hover .wall-object",
);
html = html.replaceAll(
  "button:active{transform:translateY(1px)}",
  "button:where(:enabled):active{transform:translateY(1px)}",
);
html = html.replaceAll(
  ".button.primary:hover{",
  ".button.primary:where(:enabled):hover{",
);
// The archived sheet's hover rules contain only hover selectors. Keep their
// source order and surrounding breakpoints while restricting them to a mouse.
const legacyStyle = html.slice(
  html.indexOf("<style>") + 7,
  html.indexOf("</style>"),
);
// Photo placeholders and shadcn controls both use data-slot.
const editionStyle = legacyStyle
  .replace("[data-slot] {", "[data-slot]:has(> img) {")
  .replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    comment.replace(/\bv0\.\d+\b/g, "v0.1"),
  );
replace(
  legacyStyle,
  editionStyle.replace(
    /(?<=[{}\n])([^{}\n]*:hover[^{}\n]*)\{([^{}]*)\}/g,
    "@media (hover:hover) and (pointer:fine){$1{$2}}",
  ),
);
replace(
  "width=device-width,initial-scale=1",
  "width=device-width,initial-scale=1,viewport-fit=cover,interactive-widget=resizes-content",
);
replace(
  '<meta name="description"',
  '<meta name="theme-color" content="#faf9f7"><meta name="description"',
);
replace(
  'id="global-query" type="search"',
  'id="global-query" type="search" enterkeyhint="search"',
);
replace(
  "</style>",
  read("library.css") +
    read("reading-preferences.css") +
    read("interface.css") +
    read("mobile.css") +
    "\n</style>",
);
replace(
  "<span class=\"dock-mark\">${icon('mark')}</span>",
  '<div class="mini-cover dock-cover" aria-hidden="true">${cover(b)}</div>',
);
replace('<span class="workspace-name">私人书库</span>', "");

replace(
  '<button type="button" class="icon-button drawer-close"',
  '<div class="sheet-grab" aria-hidden="true"><i></i></div><button type="button" class="icon-button drawer-close"',
);
replace(
  "libraryPanel=name;render();document.querySelector('.library-drawer').focus()",
  "libraryPanel=name;render();document.querySelector('.library-drawer').focus();presentSheet()",
);
replace(
  "libraryScroll=window.scrollY;libraryPanel=name",
  "if(mobileNav){mobileNav=false;returnControl='toggle-nav'}libraryScroll=window.scrollY;libraryPanel=name",
);
replace(
  "function closeLibraryLayer(){const wasReading",
  "function closeLibraryLayer(){if(libraryPanel&&dismissSheet())return;finishClosingLayer()}\nfunction finishClosingLayer(){const wasReading",
);
// Replace the inherited single-line prototype components at build time.
function component(name, content) {
  const line = html
    .split("\n")
    .find((line) => line.startsWith("function " + name + "("));
  if (!line) throw Error("Missing component: " + name);
  replace(line, content);
}
component("bookMenu", "");
component("libraryTools", read("controls.js"));
component("search", "function search(){return library()}");
component("importModal", read("import.js"));
replace(
  "[b.title,b.author,b.folder,b.en,b.type].some(t=>t.toLowerCase().includes(q))",
  "matchesBook(b,q)",
);
replace("搜索书名、作者、格式", "搜索书名或作者");
replace(
  "const pos=el.selectionStart;query=el.value;render();const input=document.querySelector('#global-query');input.focus();input.setSelectionRange(pos,pos)",
  "refreshLibrarySearch(el.value)",
);
replace(",wallRoomy=false", "");
replace("book-wall ${wallRoomy?'is-roomy':''}", "book-wall");
replace(
  "${x.pinned?`<span class=\"wall-pin\" aria-label=\"已置顶\">${icon('pin')}</span>`:''}",
  "",
);
replace(
  html
    .split("\n")
    .find((line) => line.trimStart().startsWith("'wall-density':")),
  "",
);
const batchStart = html.indexOf('${batch?`<div class="batchbar">');
const batchEnd = html.indexOf("${list.length?", batchStart);
if (batchStart < 0 || batchEnd < 0) throw Error("Missing management toolbar");
replace(
  html.slice(batchStart, batchEnd),
  '${batch ? managementBar(list) : ""}',
);
replace(
  "batch=!batch;if(batch)view='list';selected.clear();render()",
  "toggleManagement()",
);
replace(
  "if(el.dataset.bookMenu){",
  "if(el.dataset.libraryMenu){showLibraryMenu(el);return}if(el.dataset.bookMenu){",
);
replace(
  "if(!e.target.closest('.menu')&&!e.target.closest('[data-book-menu]'))document.querySelector('#menu-root').innerHTML=''",
  "if(!e.target.closest('.menu,[data-library-menu],[data-book-menu]'))closePopup()",
);
replace(
  "if(action.startsWith('book-'))document.querySelector('#menu-root').innerHTML=''",
  "if(action.startsWith('book-'))closePopup(true)",
);
html = html.replaceAll(
  'class="icon-button" data-book-menu=',
  'class="icon-button" aria-haspopup="menu" aria-expanded="false" data-book-menu=',
);
replace(
  "switch(b.style){",
  "switch(b.style){case 'imported': art=text(24,62,[b.type],16,'sans')+text(24,171,[Array.from(b.title).slice(0,10).join('')],20);break;",
);
replace(
  "el.checked?selected.add(id):selected.delete(id);render();return",
  "el.checked?selected.add(id):selected.delete(id);render();document.querySelector('[data-select=\"'+id+'\"]')?.focus({preventScroll:true});return",
);
const emptyState = html.match(
  /:`<section class="empty"><h2>这里还没有藏书[^\n]*?<\/section>`/,
);
if (!emptyState) throw Error("Missing library empty state");
replace(emptyState[0], ":emptyLibrary()");
replace(
  "function library(){const list=visibleBooks();return shell(",
  "function library(){return shell(libraryContents())}\nfunction libraryContents(){const list=visibleBooks();return ",
);
replace("emptyLibrary()}`)}", "emptyLibrary()}`}");
replace(
  '<td><button type="button" class="icon-button" aria-haspopup="menu" aria-expanded="false" data-book-menu',
  '<td><button ${batch?"hidden":""} type="button" class="icon-button" aria-haspopup="menu" aria-expanded="false" data-book-menu',
);
// Keep the three typeset specimens and give each the same reading controls.
const specimen = html.match(
  /const content=isPdf\?[^\n]+?(?=;return `<main class="reader )/,
)[0];
component(
  "reader",
  "function readerSpecimen(b,isPdf,isMd){" +
    specimen +
    ";return content}\n" +
    read("reading-room.js"),
);
replace(
  '<article class="reading-content"><h1>',
  '<article class="reading-content"><div class="chapter-kicker">第 ${chapter} 章</div><h1>',
);
replace("<h1>山间散步</h1>", "<h1>${esc(b.title)}</h1>");
component("renderReaderPanel", "");
component("inBookResults", "");
replace(
  "if(el.id==='book-query')document.querySelector('#book-results').innerHTML=inBookResults(el.value)",
  "if(el.id==='book-query'){passageQuery=el.value;document.querySelector('#book-results').innerHTML=documentResults(passageQuery)}",
);
const settingsStart = html.indexOf("function settings(){");
const settingsEnd = html.indexOf("function states(){", settingsStart);
replace(html.slice(settingsStart, settingsEnd), read("preferences.js") + "\n");
replace(
  "if(readerPanel){readerPanel='';render();return}",
  "if(readerPanel){toggleReadingPanel('');return}",
);
replace(
  "if(readingOpen){if((e.metaKey",
  "if(readingOpen&&!modalEl){if((e.metaKey",
);
html = html.replaceAll(
  "if(!typing&&e.key==='Arrow",
  "if(!typing&&!readerPanel&&e.key==='Arrow",
);
replace(
  "chapter=Number(el.value);render();document.querySelector('.reading-layer')?.scrollTo(0,0)",
  "goToChapter(Number(el.value))",
);
replace(
  "u.hash='library'",
  "u.hash=readingOpen?'read-'+activeBook:libraryPanel||'library'",
);
replace(
  "const actions={",
  "const requestedSurface=location.hash.slice(1);\nconst actions={",
);
replace(
  "if(focusMode){focusMode=false;render();return}",
  "if(readingOpen&&!focusMode){setReadingTools(false);return}",
);
replace(
  "!el.disabled&&el.getClientRects()",
  "!el.disabled&&!el.closest('[inert]')&&el.getClientRects()",
);
component("readerArrival", "");
component("openBook", read("book-opening.js"));
component("selectBook", "");
replace("const icon=(name)=>", read("interface.js") + "\nconst icon=(name)=>");
replace(
  '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="${paths[name]',
  '<svg class="ui-glyph" data-symbol="${name}" focusable="false" aria-hidden="true" viewBox="0 0 24 24"><path d="${paths[name]',
);
replace(
  "btn('menu',navCompact?'展开导航':'折叠导航','toggle-nav')",
  "navigationToggle()",
);
replace(
  '<aside class="studio-nav"',
  '<aside id="library-nav" class="studio-nav"',
);
replace(
  "if(innerWidth<=900){mobileNav=!mobileNav}",
  "if(drawerViewport.matches){mobileNav=!mobileNav}",
);
replace(
  '<label class="studio-search">',
  '<div class="studio-search" role="search">',
);
replace("<kbd>⌘ K</kbd>", "<kbd>' + platformModifier + ' K</kbd>");
replace("</kbd>'}</label>", "</kbd>'}</div>");
replace(
  "query?btn('close','清除搜索','close-search'):'<kbd>' + platformModifier + ' K</kbd>'",
  "searchAccessory()",
);
replace(
  'class="button import-button" data-action="import"',
  'class="button import-button" aria-label="导入书籍" data-action="import"',
);
replace(
  "data-action=\"import\">${icon('plus')}",
  "data-action=\"import\">${icon('importBook')}",
);
replace(
  "btn('back','上一本','shelf-prev')",
  "btn('previous','上一本','shelf-prev')",
);
replace(
  "btn('arrow','下一本','shelf-next')",
  "btn('next','下一本','shelf-next')",
);
replace(
  '<small>${esc(b.author)}<span class="mobile-format">',
  '<small>${esc(b.author.replace(" / 示例文档",""))}<span class="mobile-format">',
);

const dockStart = html.indexOf('<footer class="reading-dock"');
const dockEnd = html.indexOf("</footer>", dockStart) + "</footer>".length;
if (dockStart < 0 || dockEnd <= dockStart) throw Error("Missing shelf footer");
const dock = html.slice(dockStart, dockEnd);
replace(dock, "${readingDock(b)}");
replace(
  "function spatialShelf(",
  "function readingDock(b){return `" + dock + "`}\nfunction spatialShelf(",
);
replace(
  "const layer=document.querySelector('.layer-scroll');if(layer)layer.scrollTop=y;",
  "const layer=document.querySelector('.layer-scroll');if(layer)layer.scrollTop=y;syncBrowserChrome();",
);
replace(",reduceEffects=false", "");
replace("||!!document.querySelector('#reduced-preview')", "");
html = html.replace(/,'reduce-motion':.*?(?=,'library-location':)/, "");
replace(
  "const motionPreference=()=>matchMedia",
  "const motionPreference=()=>document.documentElement.dataset.input==='keyboard'||matchMedia",
);
replace("const duration=opening?740:430", "const duration=opening?280:240");
replace(
  "const to=target.querySelector('.book-cover')?.getBoundingClientRect()||target.getBoundingClientRect()",
  "const coverTarget=target.querySelector('.book-cover')||target.closest('.title-cell')?.querySelector('.book-cover');const to=coverTarget?.getBoundingClientRect()||target.getBoundingClientRect()",
);
replace(
  "document.querySelector('#app').innerHTML=library();if(mobileNav)",
  "if(readingOpen&&document.querySelector('#app .studio'))document.querySelector('#app .studio').inert=true;else if(!layerBefore || !(readingOpen||libraryPanel))document.querySelector('#app').innerHTML=library();if(mobileNav)",
);
replace(
  "const modalEl=document.querySelector('.modal');",
  "const modalEl=document.querySelector('.modal-backdrop:not([inert]) .modal');",
);
replace(
  "if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k')",
  "if(!modalEl&&(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k')",
);
replace(
  "if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='o')",
  "if(!modalEl&&(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='o')",
);
replace(
  "if(document.querySelector('.menu'))",
  "if(document.querySelector('.menu:not([inert])'))",
);
replace(
  "modalReturnFocus=document.activeElement;",
  "if(!document.querySelector('.modal-backdrop:not([inert])'))modalReturnFocus=document.activeElement;document.querySelector('#app').inert=true;document.querySelector('#library-layer').inert=true;",
);
component(
  "closeModal",
  `function closeModal(){
  const backdrop=document.querySelector('.modal-backdrop:not([inert])');
  if(!backdrop)return;
  document.querySelector('#app').inert=false;
  document.querySelector('#library-layer').inert=false;
  if(modalReturnFocus?.isConnected)modalReturnFocus.focus({preventScroll:true});
  retireSurface(backdrop);
}`,
);
const oldToast = html
  .split("\n")
  .find((line) => line.startsWith("let toastTimer;function toast("));
replace(oldToast, "let toastTimer;const toast=announceToast;");
replace(
  "focused?.dataset.filter?{filter:focused.dataset.filter}",
  "focused?.dataset.theme?{theme:focused.dataset.theme}:focused?.dataset.paper?{paper:focused.dataset.paper}:focused?.dataset.bookMenu?{bookMenu:focused.dataset.bookMenu}:focused?.dataset.filter?{filter:focused.dataset.filter}",
);
replace(
  "if(el.dataset.paper){paper=el.dataset.paper;render();return}",
  "if(el.dataset.paper){applyReadingPaper(el.dataset.paper);return}",
);
replace(
  "<h2>${esc(chapterNames[chapter-1]||chapterNames[0])}</h2><p>${prose[0][0]}</p>",
  "<h2>${esc(books.find(book=>book.id===activeBook)?.title || '')}</h2>",
);
replace(
  "const wasReading=readingOpen,b=",
  "globalThis.CSS?.highlights?.delete('found-passage');const opening=document.querySelector('.reading-layer')?.getAnimations().some(a=>a.id==='open-book');const wasReading=readingOpen,b=",
);
replace("if(wasReading&&target){", "if(wasReading&&target&&!opening){");
replace(
  "document.querySelector('.modal').focus()}",
  "prepareNameField(document.querySelector('.modal'))}",
);
replace(
  "'close-search':()=>{query='';searchOpen=false;render()}",
  "'close-search':()=>{query='';render();document.querySelector('#global-query').focus({preventScroll:true})}",
);
replace(
  "if(el.dataset.setting){settingTab=el.dataset.setting;render();return}",
  "if(el.dataset.setting){selectPreference(el.dataset.setting);return}",
);
replace(
  "e.preventDefault();actions['reader-search']()",
  "e.preventDefault();if(readerPanel==='search'){const input=document.querySelector('#book-query');input.focus();input.select()}else actions['reader-search']()",
);
replace(
  "function modal(title,body,actions=''){",
  "function modal(title,body,actions='',panelClass=''){",
);
replace(
  '<section class="modal" role="dialog"',
  '<section class="modal ${panelClass}" role="dialog"',
);
replace(
  html
    .split("\n")
    .find((line) => line.startsWith("let actionIds=[];function moveModal(")),
  "let actionIds=[];",
);
component("deleteModal", read("library-dialogs.js"));
replace(
  html.split("\n").find((line) => line.startsWith("'book-rename':")),
  "'book-rename':renameBookDialog,",
);
replace(
  html.split("\n").find((line) => line.startsWith("'new-folder':")),
  "'new-folder':newFolderDialog,",
);
replace(
  "</script></body>",
  read("sheet.js") + "\n" + read("reading-actions.js") + "\n</script></body>",
);
fs.writeFileSync(new URL("index.html", import.meta.url), html);
