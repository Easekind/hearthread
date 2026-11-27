function readerSpecimen(book,isPdf) {
  return isPdf?`<div class="pdf-stage"><article class="pdf-page"><h1>The Seven Lamps of Architecture</h1><p>John Ruskin</p><h2>Introductory</h2><p>Some years ago, in conversation with an artist whose works, perhaps, alone, in the present day, unite perfection of drawing with resplendence of color, the writer made some inquiry respecting the general means by which this latter quality was most easily to be attained.</p></article></div>`:`<article class="reading-content markdown-content"><h1>${esc(book.title)}</h1><h2>学而篇</h2><p>子曰：“学而时习之，不亦说乎？有朋自远方来，不亦乐乎？人不知而不愠，不亦君子乎？”</p><p>有子曰：“其为人也孝悌，而好犯上者，鲜矣。”</p><h2>为政篇</h2><p>子曰：“为政以德，譬如北辰，居其所而众星共之。”</p></article>`;
}
const pageColors = {light:'素白',paper:'暖纸',dark:'墨夜',system:'跟随系统'};
// The standalone edition uses the publication paginator for its sample chapters.
customElements.define('edition-pages', class extends HTMLElement {
  connectedCallback() {
    const pager=this.pager=document.createElement('foliate-paginator');
    this.append(pager);
    const dual=spreadViewport.matches && preferredLayout==='double';
    const width=this.clientWidth;
    const margin=dual?Math.min(48,Math.round(width*.035)):48;
    pager.setAttribute('max-inline-size',(dual?Math.min(680,width-1):680)+'px');
    pager.setAttribute('max-column-count',dual?'2':'1');
    pager.setAttribute('margin-left',margin+'px');
    pager.setAttribute('margin-right',margin+'px');
    pager.addEventListener('load',({detail:{doc}})=>{
      doc.addEventListener('click',()=>{if(doc.getSelection()?.isCollapsed)setReadingTools(focusMode)});
      doc.addEventListener('keydown',e=>{
        if(['ArrowLeft','ArrowRight','Enter','Escape'].includes(e.key)){
          e.preventDefault();
          document.querySelector('.reading-layer').dispatchEvent(new KeyboardEvent('keydown',{key:e.key,bubbles:true}));
        }
      });
    });
    pager.addEventListener('relocate',({detail})=>{
      if(!this.isConnected)return;
      chapter=detail.index+1;
      chapterMemory.set(activeBook,chapter);
      void pager.getPageRange().then(range=>{
        const label=this.closest('.reader')?.querySelector('.page-position');
        if(label && range)label.textContent='第 '+range.join('–')+' 页';
      });
    });
    pager.open({sections:chapterNames.map((title,i)=>({
      id:String(i),load:()=>'about:blank',
      loadContent:()=>'<html xmlns="http://www.w3.org/1999/xhtml"><head><title>'+esc(title)+'</title></head><body><h1>'+esc(title)+'</h1>'+prose[i].map(p=>'<p>'+esc(p)+'</p>').join('')+'</body></html>'
    }))});
    this.applyType();
    void pager.goTo({index:chapter-1});
  }
  applyType() {
    const css=getComputedStyle(this.closest('.reader'));
    this.pager.setStyles('::highlight(found-passage){background:#f2c56e;color:#302214}html,body{color:'+css.getPropertyValue('--reader-ink')+'!important;background:'+css.getPropertyValue('--reader-paper')+'!important}body,p,li,blockquote{font-family:'+readerFonts()+'!important;font-size:'+fontSize+'px!important;line-height:'+leading+'!important}');
  }
  disconnectedCallback(){this.pager.destroy()}
});
const spreadViewport = matchMedia('(min-width: 720px) and (min-height: 500px)');
let preferredLayout = 'single';
let sampleFontImported = false;
let fontCategory = 'serif', readingFont = 'default', pdfWide = false;
const chapterMemory = new Map();
function hasSystemFont(name) {
  const ctx=document.createElement('canvas').getContext('2d');
  const sample='湖面映着树影 Wmil012';
  ctx.font='40px monospace';
  const fallback=ctx.measureText(sample).width;
  ctx.font='40px "'+name+'", monospace';
  return ctx.measureText(sample).width!==fallback;
}
const readerFonts = () => (readingFont==='default'?'':"'"+readingFont+"', ")+readingFonts[fontCategory].stack.replaceAll('"',"'");
function resolvedPaper() {
  return paper==='system'?(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):paper;
}
function paperChoices(active, attribute) {
  return Object.entries(pageColors).map(([value,label])=>`<button type="button" class="paper-choice" data-${attribute}="${value}" aria-pressed="${value===active}"><span class="paper-sample ${value}" aria-hidden="true">${value==='system'?icon('monitor'):'Aa'}</span><span>${label}</span>${value===active?icon('check'):''}</button>`).join('');
}
function rangeFill(value,min,max) {
  return (value-min)/(max-min)*100+'%';
}
function readingRange(id,label,min,max,step,value) {
  return `<input data-slot="slider" type="range" id="${id}" aria-label="${label}" min="${min}" max="${max}" step="${step}" value="${value}" style="--range-fill:${rangeFill(value,min,max)}">`;
}
function fontControls() {
  function face(label,id,value) {
    return `<div class="face-row"><span>${label}</span>${fieldMenu(id,label,value)}</div>`;
  }
  function slider(label,id,min,max,step,value,unit) {
    return `<label class="type-slider">${label}<output for="${id}">${value}${unit}</output>${readingRange(id,label,min,max,step,value)}</label>`;
  }
  return `<div class="type-controls">${face('字体类别','font-category',fontCategory)}${face('字体','reading-font',readingFont)}
    ${slider('字号','type-size',12,30,1,fontSize,' px')}${slider('行距','type-leading',1,2.4,.05,leading,' 倍')}</div>`;
}
function paintType() {
  const surface=document.querySelector('.reader, .type-specimen');
  if (!surface) return;
  surface.style.setProperty('--reading-face',readerFonts());
  surface.style.setProperty('--reader-size',fontSize+'px');
  surface.style.setProperty('--reader-leading',leading);
  surface.querySelector('edition-pages')?.applyType();
}
document.addEventListener('input',event=>{
  const input=event.target;
  if (input.matches('.type-slider input')) {
    input.style.setProperty('--range-fill',rangeFill(input.valueAsNumber,Number(input.min),Number(input.max)));
  }
  if (!['type-size','type-leading','font-category','reading-font'].includes(input.id)) return;
  if (input.id==='type-size') fontSize=Number(input.value);
  if (input.id==='type-leading') leading=Number(input.value);
  if (input.id==='font-category') {
    fontCategory=input.value;
    readingFont='default';
    document.getElementById('reading-font').outerHTML=fieldMenu('reading-font','字体',readingFont);
  }
  if (input.id==='reading-font') readingFont=input.value;
  const output=input.parentElement.querySelector('output');
  if (output) output.value=input.value+(input.id==='type-size'?' px':' 倍');
  paintType();
});

function reader() {
  const book=books.find(b=>b.id===activeBook);
  const epub=route==='reader', pdf=route==='pdf';
  const pageLayout=spreadViewport.matches?preferredLayout:'single';

  const paperStyle=`--reader-size:${fontSize}px;--reader-leading:${leading};--reading-face:${readerFonts()}`;
  const content=epub ? '<edition-pages class="book-surface"></edition-pages>' : readerSpecimen(book,pdf,!pdf);
  const tool=(action,symbol,label)=>`<button type="button" class="room-tool" data-action="${action}" aria-label="${label}" title="${label}" ${['toc','reader-search','typography'].includes(action)?`aria-expanded="${readerPanel===({toc:'toc','reader-search':'search',typography:'type'}[action])}"`:''}>${symbol==='type'?'<span class="type-symbol">Aa</span>':icon(symbol)}</button>`;
  const navigation=tool('prev','previous','上一页')+'<span class="page-position">第 1 页</span>'+tool('next','next','下一页');
  return `<main class="reader reading-room ${focusMode?'is-focus':''}" data-paper="${resolvedPaper()}" data-pdf-wide="${pdfWide}" data-page-layout="${pageLayout}" style="${paperStyle}">
    <button class="reading-tools-access" data-action="show-reading-tools" ${focusMode?'':'hidden'}>显示阅读工具</button>
    <header class="room-head" ${focusMode?'inert':''}><button class="room-back" aria-label="返回书库" data-route="library">${icon('back')}<span>书库</span></button>
    <div class="room-identity"><strong>${esc(book.title)}</strong><small>${esc(book.author.replace(' / 示例文档',''))}</small></div>
    <div class="room-actions">${tool('reader-search','search','书内搜索')}</div></header>
    ${epub?content:`<div class="text-document" data-format="${route}" data-layout="${pageLayout}">${content}</div>`}
    <footer class="room-dock" aria-label="阅读工具" ${focusMode?'inert':''}>${tool('toc','contents','目录')}<div class="room-navigation">${navigation}</div>
    ${pdf?tool('typography','sun','阅读显示'):tool('typography','type','阅读排版')}</footer>
    ${readerPanel?readingPanel():''}</main>`;
}
let passageQuery='';
const documentPassages='.pdf-page p,.markdown-content p,.markdown-content li,.markdown-content blockquote';
function readingPanel() {
  const heading={toc:'目录',search:'书内搜索',type:route==='pdf'?'阅读显示':'阅读排版'}[readerPanel];
  let body;
  const layoutChoices=['single','double'].map((value,i)=>`<button type="button" data-action="layout-${value}" aria-pressed="${preferredLayout===value}">${['单屏','双屏'][i]}</button>`).join('');
  const layoutRow=spreadViewport.matches?`<div class="face-row layout-row" role="group" aria-label="页面布局"><span>页面布局</span><div class="layout-choices">${layoutChoices}</div></div>`:'';
  if (readerPanel==='type') body=`${layoutRow}${route==='pdf'?`<button class="pdf-fit" data-action="pdf-scale" aria-label="切换 PDF 显示宽度" aria-pressed="${pdfWide}">${pdfWide?'适合宽度':'适合页面'} ${icon(pdfWide?'fitWidth':'fitPage')}</button>`:fontControls()}<div class="paper-choices">${paperChoices(paper,'paper')}</div>
    ${route==='pdf'?'':'<button class="reset-reading" data-action="reset-type">恢复默认排版</button>'}`;
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
  const groups=new Map();
  for(const row of rows) {
    const label=row.section===undefined?(route==='pdf'?'第 1 页':document.querySelectorAll(documentPassages)[row.index]?.previousElementSibling?.closest('h2')?.textContent || '正文'):chapterNames[row.section];
    const text=row.text.toLowerCase();
    for(let start=text.indexOf(term);start!==-1;start=text.indexOf(term,start+term.length)){
      if(!groups.has(label))groups.set(label,[]);
      const end=start+term.length;
      groups.get(label).push(`<button class="search-hit" data-paragraph="${row.index}" data-offset="${start}" ${row.section===undefined?'':`data-result-chapter="${row.section+1}"`}>${start>48?'…':''}${esc(row.text.slice(Math.max(0,start-48),start))}<mark>${esc(row.text.slice(start,end))}</mark>${esc(row.text.slice(end,end+48))}${end+48<row.text.length?'…':''}</button>`);
    }
  }
  return [...groups].map(([title,hits])=>`<details class="search-group" open><summary><span>${esc(title)}</span><small>${hits.length}</small></summary><div>${hits.join('')}</div></details>`).join('') || '<p role="status">未找到匹配段落</p>';
}
function applyReadingPaper(value) {
  paper=value;
  const room=document.querySelector('.reading-room');
  room.dataset.paper=resolvedPaper();
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
  if (route==='reader') {
    toggleReadingPanel('');
    const pager=document.querySelector('edition-pages foliate-paginator');
    const anchor=section?0:doc=>{
      const passage=doc.querySelectorAll('p')[index];
      if(passage)highlightPassage(passage,Number(row.dataset.offset));
      return passage;
    };
    void pager.goTo({index:section?index:Number(row.dataset.resultChapter)-1,anchor});
    document.querySelector('.reading-layer').focus({preventScroll:true});
    return;
  }
  toggleReadingPanel('');
  const selector=section?'article h2':documentPassages;
  const destination=document.querySelector('.reading-room').querySelectorAll(selector)[index];
  destination?.scrollIntoView({block:'center'});
  if (!section && destination) highlightPassage(destination,Number(row.dataset.offset));
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
function highlightPassage(paragraph,start) {
  if (!globalThis.CSS?.highlights) return;
  const term=passageQuery.trim().toLowerCase();

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
      paragraph.ownerDocument.defaultView.CSS.highlights.set('found-passage',new Highlight(range));
      return;
    }
    offset=end;
  }
}
