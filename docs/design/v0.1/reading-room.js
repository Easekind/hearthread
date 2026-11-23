const pageColors = {light:'素白',paper:'暖纸',dark:'墨夜'};
let chineseFace = 'serif', latinFace = 'serif', pdfWide = false;
const chapterMemory = new Map();
const readerFonts = () => (latinFace==='serif'?'Georgia':'Arial')+', '+(chineseFace==='serif'?'var(--font-reading)':'var(--font-ui)');
function paperChoices(active, attribute) {
  return Object.entries(pageColors).map(([value,label])=>`<button type="button" class="paper-choice" data-${attribute}="${value}" aria-pressed="${value===active}"><span class="paper-sample ${value}" aria-hidden="true">Aa</span><span>${label}</span>${value===active?icon('check'):''}</button>`).join('');
}
function rangeFill(value,min,max) {
  return (value-min)/(max-min)*100+'%';
}
function readingRange(id,label,min,max,step,value) {
  return `<input data-slot="slider" type="range" id="${id}" aria-label="${label}" min="${min}" max="${max}" step="${step}" value="${value}" style="--range-fill:${rangeFill(value,min,max)}">`;
}
function fontControls(includeLatin) {
  function face(label,id,value) {
    return `<div class="face-row"><span>${label}</span>${fieldMenu(id,label,value)}</div>`;
  }
  function slider(label,id,min,max,step,value,unit) {
    return `<label class="type-slider">${label}<output for="${id}">${value}${unit}</output>${readingRange(id,label,min,max,step,value)}</label>`;
  }
  return `<div class="type-controls">${face('中文字体','chinese-face',chineseFace)}${includeLatin?face('西文字体','latin-face',latinFace):''}
    ${slider('字号','type-size',16,30,1,fontSize,' px')}${slider('行距','type-leading',1.5,2.4,.05,leading,' 倍')}</div>`;
}
function paintType() {
  const surface=document.querySelector('.reader, .type-specimen');
  if (!surface) return;
  surface.style.setProperty('--reading-face',readerFonts());
  surface.style.setProperty('--reader-size',fontSize+'px');
  surface.style.setProperty('--reader-leading',leading);
}
document.addEventListener('input',event=>{
  const input=event.target;
  if (input.matches('.chapter-position input,.type-slider input')) {
    input.style.setProperty('--range-fill',rangeFill(input.valueAsNumber,Number(input.min),Number(input.max)));
  }
  if (!['type-size','type-leading','chinese-face','latin-face'].includes(input.id)) return;
  if (input.id==='type-size') fontSize=Number(input.value);
  if (input.id==='type-leading') leading=Number(input.value);
  if (input.id==='chinese-face') chineseFace=input.value;
  if (input.id==='latin-face') latinFace=input.value;
  const output=input.parentElement.querySelector('output');
  if (output) output.value=input.value+(input.id==='type-size'?' px':' 倍');
  paintType();
});

function reader() {
  const book=books.find(b=>b.id===activeBook);
  const epub=route==='reader', pdf=route==='pdf';

  const paperStyle=`--reader-size:${fontSize}px;--reader-leading:${leading};--reading-face:${readerFonts()}`;
  const content=readerSpecimen(book,pdf,!epub&&!pdf);
  const tool=(action,symbol,label)=>`<button type="button" class="room-tool" data-action="${action}" aria-label="${label}" title="${label}" ${['toc','reader-search','typography'].includes(action)?`aria-expanded="${readerPanel===({toc:'toc','reader-search':'search',typography:'type'}[action])}"`:''}>${symbol==='type'?'<span class="type-symbol">Aa</span>':icon(symbol)}</button>`;
  const navigation=epub?`<button class="room-tool" data-action="prev" aria-label="上一章" ${chapter===1?'disabled':''}>${icon('previous')}</button>
    <label class="chapter-position"><span>第 ${chapter} 章 <i>/ ${chapterNames.length}</i></span>${readingRange('chapter-progress','选择章节',1,chapterNames.length,1,chapter)}</label>
    <button class="room-tool" data-action="next" aria-label="下一章" ${chapter===chapterNames.length?'disabled':''}>${icon('next')}</button>`
    :pdf?`<button class="pdf-fit" data-action="pdf-scale" aria-label="切换 PDF 显示宽度" aria-pressed="${pdfWide}">第 3 页 · ${pdfWide?'适合宽度':'适合页面'} ${icon(pdfWide?'fitWidth':'fitPage')}</button>`
    :`${tool('prev','previous','向上翻页')}<span class="document-position">Markdown</span>${tool('next','next','向下翻页')}`;
  return `<main class="reader reading-room ${focusMode?'is-focus':''}" data-paper="${paper}" data-pdf-wide="${pdfWide}" style="${paperStyle}">
    <button class="reading-tools-access" data-action="show-reading-tools" ${focusMode?'':'hidden'}>显示阅读工具</button>
    <header class="room-head" ${focusMode?'inert':''}><button class="room-back" aria-label="返回书库" data-route="library">${icon('back')}<span>书库</span></button>
    <div class="room-identity"><strong>${esc(book.title)}</strong><small>${esc(book.author.replace(' / 示例文档',''))}</small></div>
    <div class="room-actions">${tool('reader-search','search','书内搜索')}</div></header>
    ${content}
    <footer class="room-dock" aria-label="阅读工具" ${focusMode?'inert':''}>${tool('toc','contents','目录')}<div class="room-navigation">${navigation}</div>
    ${pdf?tool('paper-toggle',paper==='dark'?'sun':'moon','切换明暗主题'):tool('typography','type','阅读排版')}</footer>
    ${readerPanel?readingPanel():''}</main>`;
}
let passageQuery='';
const documentPassages='.pdf-page p,.markdown-content p,.markdown-content li,.markdown-content blockquote';
function readingPanel() {
  const heading={toc:'目录',search:'书内搜索',type:'阅读排版'}[readerPanel];
  let body;
  if (readerPanel==='type') body=`${fontControls(false)}<div class="paper-choices">${paperChoices(paper,'paper')}</div>
    <button class="reset-reading" data-action="reset-type">恢复默认排版</button>`;
  if (readerPanel==='toc') {
    const headings=route==='reader'?chapterNames:specimenSections().map(h=>h.textContent);
    body=`<div class="contents-list">${headings.map((h,i)=>`<button type="button" data-section="${i}" ${route==='reader'&&i===chapter-1?'aria-current="location"':''}><small>${String(i+1).padStart(2,'0')}</small><span>${esc(h)}</span></button>`).join('')}</div>`;
  }
  if (readerPanel==='search') body=`<label class="room-search">${icon('search')}<input type="search" id="book-query" enterkeyhint="search" aria-label="搜索本书" placeholder="搜索本书" value="${esc(passageQuery)}"></label><div id="book-results">${documentResults(passageQuery)}</div>`;
  return `<aside class="room-panel panel-${readerPanel}" aria-label="${heading}"><div class="row between"><h2>${heading}</h2>${btn('close','关闭'+heading,'panel-close')}</div>${body}</aside>`;
}
function specimenSections() {
  const template=document.createElement('template');
  template.innerHTML=readerSpecimen(books.find(b=>b.id===activeBook),route==='pdf',route==='markdown');
  return [...template.content.querySelectorAll('h2')];
}
function documentResults(q) {
  if (!q.trim()) return '';
  const rows=route==='reader'?prose.flatMap((paragraphs,section)=>paragraphs.map((text,index)=>({text,section,index})))
    :[...document.querySelectorAll(documentPassages)].map((node,index)=>({text:node.textContent,index}));
  const term=q.trim().toLowerCase();
  const found=rows.filter(row=>row.text.toLowerCase().includes(term));
  return `<p class="match-count" role="status">${found.length?'找到 '+found.length+' 个段落':'未找到匹配段落'}</p>`+found.map(row=>{
    const start=row.text.toLowerCase().indexOf(term),end=start+term.length;
    return `<button class="passage-match" data-paragraph="${row.index}" ${row.section===undefined?'':`data-result-chapter="${row.section+1}"`}>${row.section===undefined?'':`<small>${esc(chapterNames[row.section])}</small>`}${esc(row.text.slice(0,start))}<mark>${esc(row.text.slice(start,end))}</mark>${esc(row.text.slice(end))}</button>`;
  }).join('');
}
function applyReadingPaper(value) {
  paper=value;
  const room=document.querySelector('.reading-room');
  room.dataset.paper=paper;
  syncBrowserChrome();
  const choices=room.querySelector('[data-paper].paper-choice')?.parentElement;
  if (!choices) return;
  choices.innerHTML=paperChoices(paper,'paper');
  choices.querySelector('[aria-pressed="true"]').focus({preventScroll:true});
}

function toggleReadingPanel(kind) {
  if (kind && focusMode) setReadingTools(true);
  const last=readerPanel;
  readerPanel=kind===last?'':kind;
  const readerEl=document.querySelector('.reading-room');
  const oldPanel=readerEl.querySelector('.room-panel:not([inert])');
  retireSurface(oldPanel);
  if (readerPanel) {
    readerEl.querySelectorAll('.room-panel[inert]').forEach(node=>node.remove());
    readerEl.insertAdjacentHTML('beforeend',readingPanel());
    const panel=readerEl.querySelector('.room-panel');
    const trigger=readerEl.querySelector(`[data-action="${{toc:'toc',type:'typography',search:'reader-search'}[readerPanel]}"]`);
    const rect=trigger.getBoundingClientRect();
    const origin=Math.max(0,Math.min(panel.offsetWidth,rect.left + rect.width/2 - panel.getBoundingClientRect().left));
    panel.style.transformOrigin=origin+'px '+(readerPanel==='search'?'top':'bottom');
  }
  const triggers={toc:'toc',type:'typography',search:'reader-search'};
  for (const [key,action] of Object.entries(triggers)) readerEl.querySelector(`[data-action="${action}"]`)?.setAttribute('aria-expanded',String(key===readerPanel));
  if (readerPanel) readerEl.querySelector('#book-query,.room-panel [aria-current],.room-panel .icon-button')?.focus({preventScroll:true});
  if (readerPanel==='search') {const field=document.querySelector('#book-query');field.focus();field.select()}
  if (!readerPanel && last) readerEl.querySelector(`[data-action="${triggers[last]}"]`)?.focus({preventScroll:true});
}
function goToChapter(number) {
  chapter=Math.min(chapterNames.length,Math.max(1,number));
  chapterMemory.set(activeBook,chapter);
  const book=books.find(b=>b.id===activeBook);
  book.chapter='第'+chapter+'章 / '+chapterNames[chapter-1];
  book.progress=[12,38,65,88][chapter-1];
  readerPanel='';render();
  const layer=document.querySelector('.reading-layer');
  layer.scrollTop=0;
  layer.focus({preventScroll:true});
}
document.addEventListener('click',event=>{
  const row=event.target.closest('[data-section],[data-paragraph]');
  if (!row) return;
  const section=row.hasAttribute('data-section'), index=Number(section?row.dataset.section:row.dataset.paragraph);
  if (route==='reader') goToChapter(section?index+1:Number(row.dataset.resultChapter));
  else toggleReadingPanel('');
  if (section && route==='reader') return;
  const selector=section?'article h2':route==='reader'?'.reading-content p':documentPassages;
  const destination=document.querySelector('.reading-room').querySelectorAll(selector)[index];
  destination?.scrollIntoView({block:'center'});
  if (!section && destination) highlightPassage(destination);
  document.querySelector('.reading-layer').focus({preventScroll:true});
});
function setReadingTools(visible) {
  const room=document.querySelector('.reading-room');
  if (!room || visible===!focusMode) return;
  if (!visible && readerPanel) toggleReadingPanel('');
  focusMode=!visible;
  if (!visible && room.contains(document.activeElement)) {
    room.closest('.reading-layer').focus({preventScroll:true});
  }
  room.classList.toggle('is-focus',focusMode);
  for (const bar of room.querySelectorAll('.room-head,.room-dock')) bar.inert=focusMode;
  room.querySelector('.reading-tools-access').hidden=visible;
}

function onReadingPage(target) {
  return target.closest('.reading-room') &&
    !target.closest('.room-head,.room-dock,.room-panel,button,input,select,textarea,label,a,[contenteditable=true]');
}

let pagePress=null;
let beforeFirstClick=null;
document.addEventListener('pointerdown',event=>{
  pagePress=null;
  if (event.isPrimary && event.button===0 && onReadingPage(event.target)) {
    pagePress={id:event.pointerId,x:event.clientX,y:event.clientY,time:event.timeStamp,
      scroll:event.target.closest('.reading-layer').scrollTop,selected:!getSelection().isCollapsed};
  }
});
document.addEventListener('pointermove',event=>{
  if (pagePress?.id===event.pointerId && Math.hypot(event.clientX-pagePress.x,event.clientY-pagePress.y)>8) pagePress=null;
});
document.addEventListener('pointercancel',()=>{pagePress=null});
document.addEventListener('click',event=>{
  const press=pagePress;
  pagePress=null;
  if (!press || !onReadingPage(event.target) || press.selected || event.timeStamp-press.time>500) return;
  if (press.scroll!==event.target.closest('.reading-layer').scrollTop) return;
  if (!getSelection().isCollapsed) {
    // A native double-click selects a word after its first click has fired.
    if (event.detail===2 && beforeFirstClick!==null) setReadingTools(beforeFirstClick);
    return;
  }
  beforeFirstClick=!focusMode;
  setReadingTools(focusMode);
});
document.addEventListener('keydown',event=>{
  if (event.key==='Enter' && event.target.matches('.reading-layer') && !event.repeat) {
    event.preventDefault();
    setReadingTools(focusMode);
  }
});
document.addEventListener('input',event=>{
  if(event.target.id==='chapter-progress') event.target.previousElementSibling.innerHTML='第 '+Number(event.target.value)+' 章 <i>/ '+chapterNames.length+'</i>';
});

function highlightPassage(paragraph) {
  if (!globalThis.CSS?.highlights) return;
  const term=passageQuery.trim().toLowerCase();
  const start=paragraph.textContent.toLowerCase().indexOf(term);
  if (!term || start<0) return;
  const walker=document.createTreeWalker(paragraph,NodeFilter.SHOW_TEXT);
  const range=new Range();
  let offset=0;
  while (walker.nextNode()) {
    const node=walker.currentNode;
    const end=offset+node.length;
    if (offset<=start && start<end) range.setStart(node,start-offset);
    if (start+term.length<=end) {
      range.setEnd(node,start+term.length-offset);
      CSS.highlights.set('found-passage',new Highlight(range));
      return;
    }
    offset=end;
  }
}
