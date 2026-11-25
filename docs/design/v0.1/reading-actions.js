Object.assign(actions,{
  'custom-font':()=>{sampleFontImported=true;readingFont='Sora';render();toast('设计预览已应用示例字体 Sora')},
  'show-reading-tools':()=>{setReadingTools(true);document.querySelector('.room-back').focus({preventScroll:true})},
  toc:()=>toggleReadingPanel('toc'),typography:()=>toggleReadingPanel('type'),
  'reader-search':()=>toggleReadingPanel('search'),'panel-close':()=>toggleReadingPanel(''),
  'layout-single':()=>{preferredLayout='single';render()},
  'layout-double':()=>{preferredLayout='double';render()},
  'reset-type':()=>{if(spreadViewport.matches)preferredLayout='single';fontSize=20;leading=1.95;fontCategory='serif';readingFont='default';paper='light';render()},
  'pdf-scale':()=>{pdfWide=!pdfWide;render()},
  'prev':()=>{turnReadingPage(-1)},
  'next':()=>{turnReadingPage(1)}
});
spreadViewport.addEventListener('change',()=>{if(readingOpen)render()});
matchMedia('(prefers-color-scheme:dark)').addEventListener('change',()=>{if(shellTheme==='system')render();else if(paper==='system' && readingOpen){document.querySelector('.reading-room').dataset.paper=resolvedPaper();syncBrowserChrome()}});
function turnReadingPage(direction){
  const text=document.querySelector('.text-document');
  if(text?.dataset.layout==='double' && route!=='pdf'){
    const gap=parseFloat(getComputedStyle(text.firstElementChild).columnGap);
    const was=text.scrollLeft;
    text.scrollBy({left:direction*(text.clientWidth+gap)});
    if(Math.abs(text.scrollLeft-was)>1 || route==='markdown')return;
  }
  if(route==='reader') goToChapter(chapter+direction);
  if(route==='markdown') document.querySelector('.reading-layer').scrollBy(0,direction*(innerHeight-140));
}
function enterPreview(hash){
  if(hash!=='settings' && !/^read-\d+$/.test(hash)) return;
  cancelAnimationFrame(sheetMotion.frame);
  if(hash==='settings') {readingOpen=false;readerPanel='';focusMode=false;route='library'}
  if(hash==='settings')openPanel('settings');
  else if(/^read-\d+$/.test(hash))openBook(Number(hash.slice(5)),false);
}
enterPreview(requestedSurface);
window.addEventListener('hashchange',()=>{const hash=location.hash.slice(1);if(hash==='library')closeLibraryLayer();else enterPreview(hash)});
