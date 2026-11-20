const sortOptions = {recent:'最近阅读', added:'最近添加', title:'书名排序'};
let popupAnchor = null;
let previousView = 'grid';

function matchesBook(book, queryText) {
  const author = book.author.replace(' / 示例文档', '');
  return [book.title, book.en, author].some(value =>
    value.replace(/\s+/g, ' ').toLowerCase().includes(queryText));
}

function fieldOptions(id) {
  if (id==='preference-section') return Object.entries(settingNames);
  if (id==='locale') return ['简体中文','繁體中文','English'].map(name=>[name,name]);
  if (id==='import-folder' || id==='move-folder') return folders.map(name=>[name,name]);
  return [['serif','衬线'],['sans','无衬线']];
}

function fieldMenu(id,label,initial,symbol='') {
  const options=fieldOptions(id);
  const [value,title]=options.find(([key])=>key===initial) || options[0];
  return `<button type="button" class="tool-trigger field-trigger" data-library-menu="field" id="${id}"
    data-label="${esc(label)}" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(label+'，'+title)}" value="${esc(value)}">
    ${symbol?icon(symbol):''}<span>${esc(title)}</span>${icon('down')}</button>`;
}

function libraryTools() {
  function trigger(kind, symbol, title, label) {
    return `<button class="tool-trigger" type="button" data-library-menu="${kind}" aria-haspopup="menu" aria-expanded="false" aria-label="${label}，${esc(title)}">${icon(symbol)}<span>${esc(title)}</span>${icon('down')}</button>`;
  }
  return `<div class="wall-toolbar library-tools"><span class="toolbar-summary">${query ? '“'+esc(query)+'” 的搜索结果' : ''}</span>
    <div class="library-tool-actions">${trigger('folder','folder',folderFilter || '全部分类','按分类筛选')}
    ${trigger('sort','sort',sortOptions[sort],'藏书排序')}
    ${batch ? '' : `<button class="tool-trigger manage-library" type="button" data-action="batch">${icon('manage')}管理藏书</button>`}</div></div>`;
}

function toggleManagement() {
  if (!batch) previousView = view;
  batch = !batch;
  view = batch ? 'list' : previousView;
  selected.clear();
  render();
  document.querySelector(batch ? '[data-action="select-all"]' : '.manage-library')?.focus();
}

function managementBar(list) {
  const all = list.length && list.every(b => selected.has(b.id));
  const operations = [['bulk-move','moveBook','移动'],['bulk-export','exportBook','导出'],['bulk-delete','trash','删除']];
  return `<section class="selection-bar" aria-label="批量管理"><div class="selection-state">
    <button type="button" data-action="select-all" ${list.length?'':'disabled'}>${all?'取消全选':'全选'}</button>
    <span role="status">已选 <b>${selected.size}</b> 本</span></div><div class="selection-ops">
    ${operations.map(([action,symbol,title])=>`<button type="button" data-action="${action}" ${selected.size?'':'disabled'}>${icon(symbol)}${title}</button>`).join('')}</div>
    <button type="button" class="finish-selection" data-action="batch">完成</button></section>`;
}

function closePopup(restoreFocus = false) {
  if (!popupAnchor) return;
  popupAnchor.setAttribute('aria-expanded','false');
  if (restoreFocus) popupAnchor.focus({preventScroll:true});
  retireSurface(document.querySelector('.library-popup:not([inert])'));
  popupAnchor = null;
}

function showPopup(anchor, label, body) {
  const wasOpen = popupAnchor === anchor && document.querySelector('.library-popup:not([inert])');
  closePopup();
  if (wasOpen) return;
  popupAnchor = anchor;
  anchor.setAttribute('aria-expanded','true');
  const owner=anchor.closest('.modal,.room-panel,.library-drawer') || document.getElementById('menu-root');
  const menu=document.createElement('div');
  menu.className='menu library-popup';
  menu.popover='manual';
  menu.setAttribute('role','menu');
  menu.setAttribute('aria-label',label);
  menu.innerHTML=body;
  owner.append(menu);
  menu.showPopover();
  const rect = anchor.getBoundingClientRect();
  const below = innerHeight - rect.bottom - 16, above = rect.top - 16;
  const opensUp = menu.offsetHeight > below && above > below;
  menu.style.maxHeight = Math.max(44, opensUp ? above : below)+'px';
  menu.style.left = Math.max(8, Math.min(innerWidth-menu.offsetWidth-8,rect.right-menu.offsetWidth))+'px';
  menu.style.top = (opensUp ? rect.top-menu.offsetHeight-6 : rect.bottom+6)+'px';
  const originX=Math.max(8,Math.min(menu.offsetWidth-8,rect.left+rect.width/2-parseFloat(menu.style.left)));
  menu.style.transformOrigin=originX+'px '+(opensUp?'bottom':'top');
  const current=menu.querySelector('[aria-checked="true"]') || menu.querySelector('button');
  if (current.offsetTop+current.offsetHeight>menu.clientHeight) menu.scrollTop=current.offsetTop-menu.clientHeight/2;
  current.focus({preventScroll:true});
}

function showLibraryMenu(anchor) {
  const kind=anchor.dataset.libraryMenu;
  const folder=kind==='folder', field=kind==='field';
  const options=field?fieldOptions(anchor.id):folder?[['','全部分类'],...folders.map(f=>[f,f])]:Object.entries(sortOptions);
  const value=field?anchor.value:folder?folderFilter:sort;
  const body=options.map(([key,title])=>`<button type="button" role="menuitemradio" aria-checked="${value===key}" data-option="${esc(key)}"><span>${esc(title)}</span>${key===value ? icon('check') : ''}</button>`).join('');
  showPopup(anchor,field?anchor.dataset.label:folder?'分类':'排序', body+(folder?`<hr><button role="menuitem" data-action="new-folder">${icon('plus')}新建分类</button>`:''));

}

function bookMenu(id, anchor) {
  const book = books.find(b=>b.id===id);
  const groups = [
    [['open','book','打开阅读']],
    [['rename','edit','重命名'],['move','moveBook','移动到分类'],['export','exportBook','导出原文件']],
    [['delete','trash','删除']]
  ];
  if (!book.pinned) groups[1].unshift(['pin','pin','置顶']);
  const body = groups.map(group=>group.map(([action,symbol,title])=>
    `<button role="menuitem" class="${action==='delete'?'destructive':''}" data-action="book-${action}" data-id="${id}">${icon(symbol)}${title}</button>`).join('')).join('<hr>');
  showPopup(anchor,book.title+' 的操作',body);
}

document.addEventListener('click', event => {
  const option = event.target.closest('[data-option]');
  if (event.target.closest('.library-popup [data-action="new-folder"]')) closePopup(true);
  if (!option || !popupAnchor) return;
  const kind = popupAnchor.dataset.libraryMenu;
  if (kind==='field') {
    const trigger=popupAnchor;
    const value=option.dataset.option, title=option.textContent.trim();
    closePopup(true);
    if (trigger.value===value) return;
    trigger.value=value;
    trigger.querySelector('span').textContent=title;
    trigger.setAttribute('aria-label',trigger.dataset.label+'，'+title);
    trigger.dispatchEvent(new Event('input',{bubbles:true}));
    trigger.dispatchEvent(new Event('change',{bubbles:true}));
    return;
  }
  if (kind === 'folder') {
    folderFilter = option.dataset.option;
    filter = 'all';
    selected.clear();
  } else sort = option.dataset.option;
  closePopup();
  render();
  document.querySelector(`[data-library-menu="${kind}"]`).focus();
}, true);

document.addEventListener('keydown', event => {
  const menu = document.querySelector('.library-popup:not([inert])');
  if (!menu) {
    const trigger=event.target.closest('[data-library-menu]');
    if (trigger && ['ArrowDown','ArrowUp'].includes(event.key)) {
      event.preventDefault();event.stopImmediatePropagation();showLibraryMenu(trigger);
    }
    return;
  }
  if (event.key==='Tab') {closePopup(true);return}
  if (!['Escape','ArrowDown','ArrowUp','Home','End','ArrowLeft','ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (event.key==='Escape') {closePopup(true);return}
  const items = [...menu.querySelectorAll('button')];
  const index = items.indexOf(document.activeElement);
  if (event.key==='Home') items[0].focus();
  if (event.key==='End') items.at(-1).focus();
  if (event.key==='ArrowDown') items[(index+1)%items.length].focus();
  if (event.key==='ArrowUp') items[(index+items.length-1)%items.length].focus();
}, true);
window.addEventListener('resize', () => closePopup());
window.addEventListener('scroll', event => {
  if (popupAnchor && !event.target.closest?.('.library-popup')) closePopup();
}, true);

function emptyLibrary() {
  let title='书库里还没有书', description='可以导入 EPUB、PDF 或 Markdown。';
  let action='import', label='导入书籍', symbol='library';
  if (query.trim()) {
    title='没有找到匹配的书籍';
    description=folderFilter?'已在「'+folderFilter+'」中搜索书名和作者。':'试试其他书名或作者姓名。';
    action='close-search'; label='清除搜索'; symbol='search';
  } else if (folderFilter) {
    title='「'+folderFilter+'」里还没有书';symbol='folder';
  }
  return `<section class="empty library-empty"><span class="empty-symbol">${icon(symbol)}</span><h2>${esc(title)}</h2>
    <p>${esc(description)}</p><button class="button" data-action="${action}">${label}</button></section>`;
}

// Reuse the title button so row clicks follow the same reading and selection rules.
document.addEventListener('click',event=>{
  const row=event.target.closest('.list-view tbody tr');
  if (!row || event.target.closest('button,input,a,label') || !getSelection().isCollapsed) return;
  row.querySelector('.title-cell [data-open]')?.click();
});

function searchAccessory() {
  return query?btn('close','清除搜索','close-search'):'<kbd>'+platformModifier+' K</kbd>';
}

function refreshLibrarySearch(value) {
  const input=document.getElementById('global-query');
  const hadQuery=Boolean(query);
  query=value;
  selected.clear();
  // Replacing the focused input interrupts composition and the phone keyboard.
  document.querySelector('.studio-main').innerHTML=libraryContents();
  if (hadQuery!==Boolean(value)) input.nextElementSibling.outerHTML=searchAccessory();
  const url=new URL(location.href);
  if (value) url.searchParams.set('q',value);
  else url.searchParams.delete('q');
  history.replaceState(null,'',url);
  closePopup();
}
