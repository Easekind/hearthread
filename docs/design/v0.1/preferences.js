const preferenceIcons={appearance:'sun',reading:'book',language:'language',storage:'storage',shortcuts:'keyboard',about:'info'};
function preferencesContent() {
  const button=(action,label)=>`<button class="pref-action" data-action="${action}">${label}</button>`;
  const group=(heading,body)=>`<section class="pref-group">${heading?`<h3>${heading}</h3>`:''}<div class="pref-rows">${body}</div></section>`;
  if (settingTab==='appearance') return `<div class="appearance-preview" aria-label="当前主题的书库预览"><div class="mini-window"><div class="mini-rail">${icon('library')}</div><div class="mini-library"><strong>我的书库</strong><div class="mini-shelf">${originalBooks.slice(0,3).map(b=>`<div>${cover(b)}</div>`).join('')}</div></div></div></div>
    <div class="paper-choices" role="group" aria-label="书库外观">${paperChoices(shellTheme,'theme')}</div>`;
  if (settingTab==='reading') return `<article class="type-specimen" style="--reading-face:${readerFonts()};--reader-size:${fontSize}px;--reader-leading:${leading}"><small>排版预览</small><p>清晨的湖面映着树影。<br>沿着岸边，再读一页。</p><p lang="en">Morning light on the water.</p></article>
    ${group('正文',fontControls())}${group('',settingRow(sampleFontImported?'Sora':'自定义字体','OTF、TTF、WOFF2',button('custom-font',sampleFontImported?'更换字体':'导入字体')))}`;
  if (settingTab==='language') return group('显示语言',settingRow('界面语言','',fieldMenu('locale','界面语言','简体中文'))+settingRow('自定义语言包','',button('language-pack','导入语言包')));
  if (settingTab==='storage') return group('此设备',settingRow('书库位置','~/Documents/hearthread · 示例路径',button('library-location','更改位置')))+group('备份与恢复',settingRow('导出完整书库','原始文件与阅读记录',button('export-library','导出备份'))+settingRow('从备份恢复','',button('restore-library','选择备份')));
  if (settingTab==='shortcuts') {
    const mod=/Mac|iPhone|iPad/.test(navigator.platform)?'⌘':'Ctrl';
    return group('键盘操作',[['搜索书库',mod+' K'],['导入书籍',mod+' O'],['书内搜索',mod+' F'],['切换章节','← / →'],['关闭面板','Esc']].map(([name,key])=>settingRow(name,'',`<button class="key" data-shortcut="${name}">${key}</button>`)).join(''));
  }
  return `<div class="product-signature"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M5 4 15 10V19L25 13V4L35 10V36L25 30V21L15 27V36L5 30Z"/></svg><strong>hearthread</strong><small>交互设计预览 · v0.1</small></div>`+
    group('',settingRow('应用更新','',button('check-update','检查更新'))+settingRow('开源项目与字体','',button('licenses','查看许可')));
}
function settings() {
  return `<div class="preferences"><header class="preferences-title"><h1>设置</h1></header><div class="preferences-grid">
    <nav class="preferences-nav" aria-label="设置分类">${Object.entries(settingNames).map(([id,name])=>`<button type="button" data-setting="${id}" aria-current="${settingTab===id?'page':'false'}">${icon(preferenceIcons[id])}${name}</button>`).join('')}</nav>
    <section class="preferences-detail">${preferenceDetail()}</section></div></div>`;
}
function preferenceDetail() {
  const title=settingNames[settingTab];
  return `<h2>${title}</h2><div class="mobile-preference">${fieldMenu('preference-section','设置分类',settingTab,preferenceIcons[settingTab])}</div>
    ${preferencesContent()}`;
}
function selectPreference(id) {
  if (id===settingTab || !Object.hasOwn(settingNames,id)) return;
  settingTab=id;
  const detail=document.querySelector('.preferences-detail');
  detail.innerHTML=preferenceDetail();
  const nav=document.querySelector('.preferences-nav');
  for (const item of nav.querySelectorAll('button')) item.setAttribute('aria-current',item.dataset.setting===id?'page':'false');
  const control=nav.offsetWidth?nav.querySelector('[aria-current="page"]'):detail.querySelector('#preference-section');
  control.focus({preventScroll:true});
  detail.closest('.library-drawer').scrollTop=0;
}
document.addEventListener('change',event=>{
  if (event.target.id==='preference-section') selectPreference(event.target.value);
});
document.addEventListener('keydown',event=>{
  if (!event.target.matches('.preferences-nav button')) return;
  const items=[...event.target.parentElement.children];
  const index=items.indexOf(event.target);
  const position={ArrowDown:(index+1)%items.length,ArrowUp:(index+items.length-1)%items.length,Home:0,End:items.length-1}[event.key];
  if (position===undefined) return;
  event.preventDefault();
  selectPreference(items[position].dataset.setting);
});
