// Every library task uses the same header, body spacing and action footer.
function libraryDialog(title, body, confirmLabel, confirmAttributes, destructive=false) {
  const actions=`<button type="button" class="button" data-action="modal-close">取消</button>
    <button type="button" class="button primary${destructive?' destructive':''}" ${confirmAttributes}>${confirmLabel}</button>`;
  modal(title,`<div class="dialog-content">${body}</div>`,actions,'library-dialog');
}

function renameBookDialog(trigger) {
  const book=books.find(item=>item.id===Number(trigger.dataset.id));
  actionIds=[book.id];
  libraryDialog('重命名书籍',`<div class="dialog-field">
    <label for="new-name">书籍名称</label>
    <input class="field-input" enterkeyhint="done" id="new-name" value="${esc(book.title)}" maxlength="120"></div>
    <p class="dialog-note">仅更改书库中的显示名称。</p>`,'保存','data-action="confirm-rename"');
}

function newFolderDialog() {
  libraryDialog('新建分类',`<div class="dialog-field"><label for="folder-name">分类名称</label>
    <input class="field-input" enterkeyhint="done" id="folder-name" placeholder="输入分类名称" maxlength="80"></div>`,
    '创建','data-action="confirm-folder"');
}

function selectedBooksSummary(ids) {
  const selection=new Set(ids);
  const rows=books.filter(book=>selection.has(book.id)).map(book=>`
    <li>${icon('book')}<span>${esc(book.title)}</span><small>${esc(book.type)}</small></li>`).join('');
  return `<ul class="dialog-books" aria-label="所选藏书">${rows}</ul>`;
}

function moveModal(ids) {
  actionIds=ids;
  libraryDialog('移动到分类',`${selectedBooksSummary(ids)}
    <div class="destination">${icon('folder')}<span>目标分类</span>${fieldMenu('move-folder','目标分类',folders[0])}</div>`,
    '移动','data-action="confirm-move"');
}

function deleteModal(ids) {
  actionIds=ids;
  libraryDialog('删除藏书',`${selectedBooksSummary(ids)}
    <p class="dialog-note">从书库移除后，可在提示中点「撤销」恢复。</p>`,
    '删除 '+ids.length+' 本书','data-action="confirm-delete"',true);
}
