function importModal() {
  closePopup();
  libraryDialog('导入书籍', `<div class="import-workbench">
    <input type="file" id="import-files" accept=".epub,.pdf,.md,.markdown" multiple hidden>
    <button type="button" class="file-drop" id="choose-files"><span class="drop-symbol">${icon('importBook')}</span><strong>选择书籍文件</strong>
      <span>或拖放至此 · EPUB、PDF、Markdown</span></button>
    <div class="file-review" hidden><p class="queue-status" role="status"></p><ul aria-label="所选文件"></ul></div>
    <div class="destination">${icon('folder')}<span>导入到分类</span>${fieldMenu('import-folder','导入到分类',folderFilter)}</div>
    <small class="preview-note">本次预览仅使用文件名，刷新后书目将重置。</small></div>`,
    '导入书籍','id="confirm-import" disabled');
  const panel = document.querySelector('.modal');
  panel.classList.add('import-panel');
  const picker = panel.querySelector('#import-files');
  const choose = panel.querySelector('#choose-files');
  const review = panel.querySelector('.file-review');
  const confirm = panel.querySelector('#confirm-import');
  const queue = [];
  function refresh() {
    const ready = queue.filter(file=>!file.issue);
    confirm.disabled = !ready.length;
    confirm.textContent = ready.length ? '导入 '+ready.length+' 本' : '导入书籍';
    review.hidden = !queue.length;
    const skipped = queue.length-ready.length;
    review.querySelector('.queue-status').textContent = '待导入 '+ready.length+' 本'+(skipped?' · 将跳过 '+skipped+' 项':'');
    review.querySelector('ul').innerHTML = queue.map((file,index)=>
      `<li class="${file.issue?'skipped':''}">${icon(file.issue?'info':'file')}<span class="file-name" title="${esc(file.name)}">${esc(file.name)}</span><small>${file.issue||file.type}</small><button class="icon-button" data-remove-file="${index}" aria-label="移除 ${esc(file.name)}">${icon('close')}</button></li>`).join('');
  }
  function stage(files) {
    for (const file of files) {
      const ext = file.name.split('.').pop().toLowerCase();
      const type = ['epub','pdf','md','markdown'].includes(ext) ? (ext === 'markdown' ? 'MD' : ext.toUpperCase()) : '';
      const title = file.name.replace(/\.[^.]+$/, '').trim() || file.name;
      const key = title.toLowerCase();
      const exists = books.some(b=>!b.deleted && b.type===type && b.title.toLowerCase()===key);
      if (queue.some(f=>f.name===file.name)) continue;
      queue.push({name:file.name,title,type,size:file.size,issue:!type || !file.name.includes('.')?'格式不支持':exists?'书库中已有':''});
    }
    // Two filename extensions can represent the same Markdown book.
    const seen = new Set();
    for (const file of queue) {
      if (file.issue && file.issue!=='重复文件') continue;
      const key = file.type+'|'+file.title.toLowerCase();
      file.issue = seen.has(key)?'重复文件':'';
      seen.add(key);
    }
    refresh();
  }
  choose.onclick = () => picker.click();
  picker.onchange = () => {stage(picker.files);picker.value=''};
  panel.ondragover = event => {event.preventDefault();choose.classList.add('over')};
  panel.ondragleave = event => {if (!panel.contains(event.relatedTarget)) choose.classList.remove('over')};
  panel.ondrop = event => {event.preventDefault();choose.classList.remove('over');stage(event.dataTransfer.files)};
  review.onclick = event => {
    const button = event.target.closest('[data-remove-file]');
    if (!button) return;
    const index=Number(button.dataset.removeFile);
    queue.splice(index,1);
    stage([]);
    (review.querySelectorAll('button')[Math.min(index,queue.length-1)]||choose).focus({preventScroll:true});
  };
  confirm.onclick = () => {
    const target = panel.querySelector('#import-folder').value;
    const ready = queue.filter(file=>!file.issue);
    let id = Math.max(...books.map(b=>b.id));
    for (const file of ready) {
      books.push({id:++id,title:file.title,en:file.title,author:'',type:file.type,folder:target,
        progress:0,chapter:'书目预览',style:'imported',pinned:false,size:Math.ceil(file.size/1024)+' KB',lastReadOrder:0,importPreview:true});
    }
    closeModal();
    folderFilter=target; filter='all'; query=''; sort='added'; selected.clear();
    render();
    toast('已添加 '+ready.length+' 本书至「'+esc(target)+'」');
  };
}
