// Turn the jacket already on screen so the animation inherits its live pose.
function visibleBookJacket(id) {
  const candidates=[
    document.querySelector(`[data-focus-book="${id}"] .book-cover`),
    document.querySelector(`.title-cell [data-open="${id}"]`)?.closest('.title-cell')?.querySelector('.mini-cover'),
    document.querySelector(`.reading-dock [data-open="${id}"]`)?.closest('.reading-dock')?.querySelector('.dock-cover')
  ];
  return candidates.find(node=>{
    if (!node) return false;
    const rect=node.getBoundingClientRect();
    return rect.width>0 && rect.height>0 && rect.bottom>0 && rect.top<innerHeight && rect.right>0 && rect.left<innerWidth;
  });
}

function revealReader(layer,jacket) {
  const duration=300;
  const options={duration,id:'open-book'};
  const easeInOut=getComputedStyle(layer).getPropertyValue('--ease-in-out').trim();
  if (jacket?.isConnected) {
    const current=getComputedStyle(jacket).transform;
    const pose=current==='none'?'':current+' ';
    const compact=jacket.classList.contains('mini-cover');
    jacket.animate([
      {transform:current,transformOrigin:'left center'},
      {transform:pose+`perspective(850px) translateY(${compact?-2:-5}px) rotateY(${compact?-24:-58}deg)`,transformOrigin:'left center'}
    ],{...options,easing:'ease-out'});
  }
  // Reveal the actual page as the cover turns. Both finish on the same frame.
  layer.animate([{opacity:0,easing:easeInOut},{opacity:1,offset:.76},{opacity:1}],options);
  const text=layer.querySelector('.reading-content,.pdf-page');
  text?.animate([{opacity:0},{opacity:0,offset:.42,easing:'ease-in-out'},{opacity:1}],options);
}

function openBook(id,fromShelf=true) {
  const book=books.find(item=>item.id===Number(id));
  if (!book || book.deleted) return;
  if (batch) {
    if (selected.has(book.id)) selected.delete(book.id);
    else selected.add(book.id);
    render();
    return;
  }
  if (book.importPreview) {
    info(esc(book.title),'本次预览仅添加书目。可打开示例藏书体验阅读。');
    return;
  }
  passageQuery='';
  clearMotion();
  const animate=fromShelf && !motionPreference();
  const jacket=animate ? visibleBookJacket(book.id) : null;
  book.lastReadOrder=++readOrder;
  returnControl='book:'+book.id;
  libraryScroll=window.scrollY;
  selectedBookId=activeBook=book.id;
  chapter=chapterMemory.get(book.id) || (book.progress>=60?3:book.progress>=30?2:1);
  route=book.type==='PDF'?'pdf':book.type==='MD'?'markdown':'reader';
  readerPanel=''; focusMode=true; libraryPanel=''; readingOpen=true;
  render();
  const layer=document.querySelector('.reading-layer');
  layer.focus({preventScroll:true});
  layer.scrollTop=0;
  if (animate) revealReader(layer,jacket);
}
