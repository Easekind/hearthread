Object.assign(actions,{
  'show-reading-tools':()=>{setReadingTools(true);document.querySelector('.room-back').focus({preventScroll:true})},
  toc:()=>toggleReadingPanel('toc'),typography:()=>toggleReadingPanel('type'),
  'reader-search':()=>toggleReadingPanel('search'),'panel-close':()=>toggleReadingPanel(''),
  'reset-type':()=>{fontSize=20;leading=1.95;chineseFace=latinFace='serif';paper='light';render()},
  'system-theme':()=>{followSystem=!followSystem;if(followSystem)shellTheme=matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';render()},
  'pdf-scale':()=>{pdfWide=!pdfWide;render()},
  'prev':()=>{turnReadingPage(-1)},
  'next':()=>{turnReadingPage(1)}
});
matchMedia('(prefers-color-scheme:dark)').addEventListener('change',event=>{if(followSystem){shellTheme=event.matches?'dark':'light';render()}});
function turnReadingPage(direction){
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
