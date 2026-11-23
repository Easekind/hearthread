// Symbols share the existing 24-unit icon grid and inherit control color.
Object.assign(paths,{
  sidebar:'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M9 4v16',
  manage:'M3 6l2 2 4-5 M12 6h9 M3 16l2 2 4-5 M12 16h9',
  contents:'M4 4h5v9l-2.5-2L4 13z M12 6h8 M12 11h8 M4 17h16 M4 21h11',
  moveBook:'M3 9V6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2 M2 12h12 M10 9l4 3-4 3',
  importBook:'M19 14V3H6a2.5 2.5 0 0 0-2.5 2.5v13A2.5 2.5 0 0 1 6 16h7 M3.5 18.5A2.5 2.5 0 0 0 6 21h7 M18 15v7 M14.5 18.5h7',
  exportBook:'M12 15V3 M8 7l4-4 4 4 M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5',
  language:'M3 5h12 M9 3v2 M13 5c-1 5-4 9-9 12 M6 9c1.5 3 4 5.5 7 7 M14 21l4-11 4 11 M15.5 17h5',
  keyboard:'M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M6 9h.5 M10 9h.5 M14 9h.5 M18 9h.5 M6 12h.5 M10 12h.5 M14 12h.5 M18 12h.5 M8 15h8',
  fitWidth:'M3 4v16 M21 4v16 M5 12h14 M8 9l-3 3 3 3 M16 9l3 3-3 3',
  fitPage:'M6 3h9l4 4v14H6z M15 3v5h4',
  storage:'M3 14l3-9h12l3 9v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M3 14h18 M16 17h2',
  info:'M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0z M12 11v5 M12 7.5v.2',
  previous:'M14.5 5.5 8 12l6.5 6.5',next:'M9.5 5.5 16 12l-6.5 6.5',
  more:'M5 11.25a.75.75 0 1 1 0 1.5.75.75 0 1 1 0-1.5z M12 11.25a.75.75 0 1 1 0 1.5.75.75 0 1 1 0-1.5z M19 11.25a.75.75 0 1 1 0 1.5.75.75 0 1 1 0-1.5z',
  settings:'M9.7 3h4.6l.7 2.4 1.5.9 2.5-.6 2.3 4-1.8 1.8v1.8l1.8 1.8-2.3 4-2.5-.6-1.5.9-.7 2.1H9.7L9 19.4l-1.5-.9-2.5.6-2.3-4 1.8-1.8v-1.8l-1.8-1.8 2.3-4 2.5.6L9 5.4z M15 12a3 3 0 1 1-6 0 3 3 0 1 1 6 0z'
});

const drawerViewport=matchMedia('(max-width:900px)');
function navigationToggle() {
  const expanded=drawerViewport.matches?mobileNav:!navCompact;
  const label=expanded?'收起导航':'展开导航';
  return `<button type="button" class="icon-button" data-action="toggle-nav" aria-controls="library-nav" aria-expanded="${expanded}" aria-label="${label}" title="${label}">
    <svg class="ui-glyph" data-symbol="sidebar" focusable="false" aria-hidden="true" viewBox="0 0 24 24">
      <path class="sidebar-pane" d="M5 4h4v16H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke="none"/>
      <path d="${paths.sidebar}"/>
    </svg></button>`;
}
drawerViewport.addEventListener('change',()=>{
  if (mobileNav) {
    mobileNav=false;
    render();
    document.querySelector('.topbar-left [data-action="toggle-nav"]')?.focus({preventScroll:true});
    return;
  }
  const toggle=document.querySelector('.topbar-left [data-action="toggle-nav"]');
  if (!toggle) return;
  const focused=document.activeElement===toggle;
  toggle.outerHTML=navigationToggle();
  if (focused) document.querySelector('.topbar-left [data-action="toggle-nav"]').focus({preventScroll:true});
});

const platformModifier=/Mac|iPhone|iPad/.test(navigator.platform)?'⌘':'Ctrl';
const root=document.documentElement;
document.addEventListener('keydown',()=>{root.dataset.input='keyboard'},true);
function usePointer() {
  if (root.dataset.input!=='pointer') root.dataset.input='pointer';
}
document.addEventListener('pointerdown',usePointer,true);
document.addEventListener('pointermove',usePointer,true);

// Retire only this instance. A newly opened surface can replace it immediately.
function retireSurface(node) {
  if (!node || node.inert) return;
  node.inert=true;
  node.setAttribute('aria-hidden','true');
  if (motionPreference() || !node.isConnected) {node.remove();return}
  node.classList.add('is-leaving');
  const transitions=node.getAnimations({subtree:true});
  Promise.allSettled(transitions.map(animation=>animation.finished)).then(()=>node.remove());
}

function selectBook(id) {
  const book=visibleBooks().find(item=>item.id===Number(id));
  if (!book || selectedBookId===book.id) return;
  selectedBookId=book.id;
  for(const tile of document.querySelectorAll('.wall-item')){
    const active=Number(tile.dataset.wallId)===book.id;
    tile.classList.toggle('is-selected',active);
    tile.querySelector('.wall-select').setAttribute('aria-pressed',String(active));
  }
  const dockAction=document.activeElement?.closest('.dock-controls [data-action]')?.dataset.action;
  const dock=document.querySelector('.reading-dock');
  if(dock) dock.outerHTML=readingDock(book);
  const tile=document.querySelector(`[data-focus-book="${book.id}"]`);
  const control=dockAction?document.querySelector(`.dock-controls [data-action="${dockAction}"]`):tile;
  control?.focus({preventScroll:true});
  if (root.dataset.input==='keyboard') tile?.scrollIntoView({block:'nearest',behavior:'instant'});
}

let noticeRemaining=0, noticeStarted=0;
function pauseNotice() {
  if (!toastTimer) return;
  clearTimeout(toastTimer);
  noticeRemaining=Math.max(0,noticeRemaining-(performance.now()-noticeStarted));
  toastTimer=0;
}
function resumeNotice() {
  const notice=document.querySelector('#toast-root .toast:not([inert])');
  if (!notice || toastTimer || document.hidden || notice.matches(':focus-within')) return;
  if (matchMedia('(hover:hover) and (pointer:fine)').matches && notice.matches(':hover')) return;
  noticeStarted=performance.now();
  toastTimer=setTimeout(()=>{toastTimer=0;retireSurface(notice)},noticeRemaining);
}
document.addEventListener('visibilitychange',()=>document.hidden?pauseNotice():resumeNotice());

function announceToast(message,undo) {
  pauseNotice();
  noticeRemaining=undo?8000:4500;
  const host=document.getElementById('toast-root');
  let toastEl=host.querySelector('.toast:not([inert])');
  if(!toastEl){
    host.innerHTML='<div class="toast"><span></span></div>';
    toastEl=host.firstElementChild;
    toastEl.onpointerenter=event=>{if (event.pointerType!=='touch') pauseNotice()};
    toastEl.onpointerleave=resumeNotice;
    toastEl.addEventListener('focusin',pauseNotice);
    toastEl.addEventListener('focusout',()=>queueMicrotask(resumeNotice));
  }
  toastEl.querySelector('span').innerHTML=message;
  toastEl.querySelector('button')?.remove();
  if(undo){
    const button=document.createElement('button');
    button.id='undo';
    button.textContent='撤销';
    toastEl.append(button);
    button.onclick=()=>{pauseNotice();undo();retireSurface(toastEl)};
  }
  resumeNotice();
}

function prepareNameField(dialog) {
  const field=dialog.querySelector('#new-name,#folder-name');
  if (!field) {dialog.focus();return}
  const error=document.createElement('small');
  error.id='name-feedback'; error.className='field-feedback'; error.hidden=true;
  error.setAttribute('aria-live','polite'); field.after(error);
  const save=dialog.querySelector('.modal-actions .primary');
  function validate() {
    const name=field.value.trim();
    const problem=!name?'请输入名称':field.id==='folder-name' && folders.includes(name)?'这个分类名称已存在':'';
    error.textContent=problem; error.hidden=!problem;
    field.setAttribute('aria-invalid',String(!!problem));
    field.setAttribute('aria-describedby',error.id);
    save.disabled=!!problem;
    return !problem;
  }
  field.addEventListener('input',validate);
  field.addEventListener('keydown',event=>{
    if (event.key==='Enter' && !event.isComposing && event.keyCode!==229) {
      event.preventDefault();
      if (validate()) save.click();
    }
  });
  save.disabled=!field.value.trim();
  field.focus();field.select();
}

// A reader can use a different paper color from the library behind it.
function syncBrowserChrome() {
  const surface=document.querySelector('.reading-room') || document.body;
  document.querySelector('meta[name="theme-color"]').content=getComputedStyle(surface).backgroundColor;
}

// Safari's keyboard can shrink only the visual viewport. Size editing surfaces
// to that viewport without intercepting pinch zoom or page scrolling.
function fitEditingSurface() {
  const viewport=window.visualViewport;
  const editing=drawerViewport.matches && document.activeElement.matches('input[type=search],.field-input');
  if (viewport && editing && viewport.scale===1) {
    root.style.setProperty('--editing-height',viewport.height+'px');
    root.style.setProperty('--editing-top',viewport.offsetTop+'px');
  } else {
    root.style.removeProperty('--editing-height');
    root.style.removeProperty('--editing-top');
  }
}
window.visualViewport?.addEventListener('resize',fitEditingSurface);
window.visualViewport?.addEventListener('scroll',fitEditingSurface);
document.addEventListener('focusin',fitEditingSurface);
document.addEventListener('focusout',()=>queueMicrotask(fitEditingSurface));
