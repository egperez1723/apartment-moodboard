// The mood board itself: categories, item cards, sub-items, links, photos,
// the item view/edit popup, category photos, and the mood-board photo view.

import { store, ui, saveData } from './store.js';
import { uid, escapeHtml, faviconFor, compressImage, catColor,
  PENCIL_ICON, EXPAND_ICON, COLLAPSE_ICON, CHECK_ICON, COPY_ICON,
  IMAGE_ICON, CARD_ICON, NOTE_ICON } from './shared.js';
import { render } from './app.js';
import { renderFooter } from './chrome.js';

function findGroup(catId, itemId){
  const cat = store.data.categories.find(c => c.id === catId);
  const item = cat ? cat.items.find(i => i.id === itemId) : null;
  return {cat, item};
}


export function renderMoodBoard(){
  let html = '';
  html += `
    <div class="new-cat-row">
      <span class="round-plus" id="addCatBtn">+</span><span style="font-size:12px; color:var(--ink-soft);">add a category</span>
    </div>
  `;
  if(ui.addingCategory){
    html += `<div class="modal-overlay" id="catModalOverlay">
      <div class="modal-box">
        <div class="modal-closerow"><span class="expand-btn" id="catCloseBtn">${COLLAPSE_ICON}</span></div>
        <div class="modal-title">New category</div>
        <input type="text" id="newCatInput" placeholder="e.g. Bedroom" maxlength="30" />
        <div class="modal-actions">
          <button class="modal-cancel" id="catCancelBtn">cancel</button>
          <button class="modal-add" id="catAddBtn">add</button>
        </div>
      </div>
    </div>`;
  }

  if(ui.editingCatId !== null){
    const cat = store.data.categories.find(c => c.id === ui.editingCatId);
    if(cat){
      const isCourse = store.features.includes('course');
      html += `<div class="modal-overlay" id="catEditModalOverlay">
        <div class="modal-box">
          <div class="modal-closerow"><span class="expand-btn" id="catEditCloseBtn">${COLLAPSE_ICON}</span></div>
          <div class="modal-title">Edit category</div>
          <input type="text" id="catEditNameInput" value="${escapeHtml(cat.name)}" maxlength="30" />
          ${isCourse ? `<div class="info-field-label">weight %</div><input type="number" inputmode="numeric" id="catEditWeightInput" placeholder="e.g. 20" maxlength="3" value="${store.data.categoryWeights[cat.id] || ''}" />` : ''}
          <div class="cat-edit-popup-actions">
            <span class="cat-move-btn" id="catEditMoveUp" title="move up">↑</span>
            <span class="cat-move-btn" id="catEditMoveDown" title="move down">↓</span>
            <span class="cat-edit-delete" id="catEditDeleteBtn">✕ delete category</span>
          </div>
          <div class="modal-actions">
            <button class="modal-cancel" id="catEditCancelBtn">cancel</button>
            <button class="modal-add" id="catEditSaveBtn">save</button>
          </div>
        </div>
      </div>`;
    }
  }

  if(store.data.categories.length === 0){
    html += `<div class="empty-hint">the board's empty — add a category above to start pinning things</div>`;
  } else {
    html += `<div class="cat-edit-row">
      <span class="cat-edit-toggle" id="catEditToggle">${ui.catEditMode ? CHECK_ICON : PENCIL_ICON}</span>
    </div>`;
  }

  store.data.categories.forEach((cat, catIndex) => {
    const items = cat.items || [];
    const cColor = catColor(catIndex);
    const inMoodView = ui.moodViewCats.has(cat.id);
    const allImages = items.flatMap(it => (it.images||[]).map(img => ({img, title: it.title})));
    html += `<div class="board-cat">
      <div class="cat-header">
        <span class="cat-dot" style="background:${cColor};"></span>
        <div class="cat-name hand" data-catopenedit="${cat.id}" style="border-bottom-color:${cColor}; cursor:pointer;">${escapeHtml(cat.name)}</div>
        <div class="cat-meta">${items.length} item${items.length===1?'':'s'}</div>
        <div class="cat-icon-group">
          <div class="cat-quick-add">
            <span class="cat-mood-toggle" data-quickaddtoggle="${cat.id}" title="add">+</span>
            ${ui.catQuickAddOpen === cat.id ? `<div class="cat-quick-menu">
              <div class="cat-quick-menu-item" data-quickadditem="${cat.id}">${CARD_ICON} add item</div>
              <div class="cat-quick-menu-item" data-quickaddphoto="${cat.id}">${IMAGE_ICON} add picture</div>
            </div>` : ''}
          </div>
          <span class="cat-mood-toggle ${inMoodView?'active':''}" data-moodview="${cat.id}" title="mood board view">${IMAGE_ICON}</span>
        </div>
      </div>`;

    if(inMoodView){
      const catImgs = cat.images || [];
      const hasAny = catImgs.length > 0 || allImages.length > 0;
      html += `<div class="mood-photo-grid">`;
      catImgs.forEach(img => {
        html += `<div class="mood-photo mood-photo-cat"><span class="mood-pin" style="background:${cColor};"></span><img src="${img.data}" alt="category inspo" /><span class="mood-photo-del" data-catimgdel="${img.id}" data-cat="${cat.id}">✕</span></div>`;
      });
      allImages.forEach(({img,title}) => {
        html += `<div class="mood-photo"><img src="${img.data}" alt="${escapeHtml(title)}" /></div>`;
      });
      html += `<label class="mood-photo mood-photo-add" title="add category inspo">+<input type="file" accept="image/*" multiple data-catimgadd="${cat.id}" /></label>`;
      html += `</div>`;
      if(!hasAny){
        html += `<div class="mood-empty">no photos pinned in this category yet — add some inspo above</div>`;
      }
      html += `</div>`;
      return;
    }

    html += `<div class="cards-grid">`;

    if((cat.images||[]).length > 0){
      const catImgs = cat.images;
      html += `<div class="cat-inspo-frame">
        <span class="mood-pin" style="background:${cColor};"></span>
        <div class="img-grid ${(catImgs.length===1?'n1':(catImgs.length===3?'n3':(catImgs.length===2?'n2':'nmany')))}">
          ${catImgs.map(img => `<div class="img-thumb-wrap"><img src="${img.data}" /></div>`).join('')}
        </div>
      </div>`;
    }

    const isCourse = store.features.includes('course');
    const sortedItems = [...items].sort((a,b) => {
      if((a.completed?1:0) !== (b.completed?1:0)) return (a.completed?1:0) - (b.completed?1:0);
      if(isCourse){
        const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return ad - bd;
      }
      return 0;
    });
    sortedItems.forEach(it => {
      const subs = it.subitems || [];
      const doneCount = subs.filter(s=>s.done).length;
      const subsWithPrice = subs.filter(s => s.price);
      const cardDisplayPrice = subsWithPrice.length > 0 ? subsWithPrice.reduce((sum,s)=>sum+Number(s.price),0) : (it.price || 0);
      const hasScore = it.maxScore && it.score !== undefined && it.score !== null && it.score !== '';
      const dueLabel = it.dueDate ? new Date(it.dueDate + 'T00:00:00').toLocaleDateString(undefined, {month:'short', day:'numeric'}) : '';
      html += `<div class="card ${it.completed?'completed':''}" data-cardopen="${it.id}" draggable="true" data-dragitem="${it.id}" data-dragcat="${cat.id}">
        <div class="washi" style="background:${cColor};"></div>
        ${(it.images.length + it.links.length) > 3 ? `<div class="washi2" style="background:${catColor(catIndex+1)};"></div>` : ''}
        ${it.completed ? `<div class="completed-overlay" style="background:${cColor};"></div><div class="completed-badge" style="background:${cColor};">${CHECK_ICON}</div>` : ''}
        <div class="card-top">
          <div class="card-title-static">${escapeHtml(it.title)}</div>
          ${(it.notes || subs.length > 0 || (!isCourse && cardDisplayPrice) || (isCourse && hasScore) || ui.catEditMode) ? `<div class="card-badges-row">
            ${it.notes ? `<span class="note-indicator" title="has a note">${NOTE_ICON}</span>` : ''}
            ${subs.length > 0 ? `<span class="sub-badge">${doneCount}/${subs.length}</span>` : ''}
            ${!isCourse && cardDisplayPrice ? `<span class="card-price-tag">$${cardDisplayPrice.toFixed(2)}</span>` : ''}
            ${isCourse && hasScore ? `<span class="card-price-tag">${it.score}/${it.maxScore}</span>` : ''}
            ${ui.catEditMode ? `<span class="card-del" data-carddel="${it.id}" data-cat="${cat.id}">✕</span>` : ''}
          </div>` : ''}
          ${isCourse && dueLabel ? `<div class="card-due">due ${dueLabel}</div>` : ''}
        </div>

        ${(it.images||[]).length > 0 ? `<div class="img-grid ${(it.images.length===1?'n1':(it.images.length===3?'n3':(it.images.length===2?'n2':'nmany')))}">
          ${it.images.map(img => `<div class="img-thumb-wrap"><img src="${img.data}" /></div>`).join('')}
        </div>` : ''}

        ${(it.links||[]).length > 0 ? `<div class="links-grid">
          ${it.links.slice(0,3).map(l => { const fav = faviconFor(l.url); let dom=''; try{ dom = new URL(l.url).hostname.replace('www.',''); }catch(e){ dom = l.url; }
            return `<a class="link-tile" href="${escapeHtml(l.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation();">
              ${fav ? `<img src="${fav}" alt="" />` : ''}
              <span class="domain">${escapeHtml(dom)}</span>
            </a>`; }).join('')}
        </div>` : ''}

        <div class="card-footer">
          <button class="move-bought-btn" data-togglecompleted="${it.id}" data-cat="${cat.id}">${it.completed ? (isCourse ? 'mark not done' : 'mark active') : (isCourse ? 'mark done' : 'completed')}</button>
          <span class="expand-btn" data-expandtoggle="${it.id}">${EXPAND_ICON}</span>
        </div>
      </div>`;
    });

    html += `<div class="card add-card" data-addgroup="${cat.id}">+ add an item to ${escapeHtml(cat.name)}</div>`;
    html += `</div></div>`;
  });

  if(ui.openItemId !== null){
    let openCat = null, openItem = null, openCatIndex = -1;
    store.data.categories.forEach((c, idx) => {
      const found = (c.items||[]).find(i => i.id === ui.openItemId);
      if(found){ openCat = c; openItem = found; openCatIndex = idx; }
    });
    if(openItem){
      const subs = openItem.subitems || [];
      const addingSub = ui.addingSubFor === openItem.id;
      const addingLink = ui.addingLinkFor === openItem.id;
      const openCColor = catColor(openCatIndex);
      html += `<div class="modal-overlay" id="itemViewOverlay">
        <div class="modal-box modal-box-lg">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div class="card-title" contenteditable="true" data-itemtitle="${openItem.id}" data-cat="${openCat.id}" style="font-size:19px; text-align:left; flex:1;">${escapeHtml(openItem.title)}</div>
            <span class="item-done-btn" id="itemViewClose" style="margin-left:8px; background:${openCColor};">${CHECK_ICON}</span>
          </div>
          <input type="text" inputmode="decimal" class="modal-price-input" id="itemViewPriceInput" placeholder="price (optional)" maxlength="10" value="${openItem.price ? openItem.price : ''}" data-item="${openItem.id}" data-cat="${openCat.id}" style="${store.features.includes('course') ? 'display:none;' : ''}" />
          ${store.features.includes('course') ? `<div class="course-field-row">
            <input type="date" class="modal-price-input" id="itemViewDueInput" value="${openItem.dueDate || ''}" data-item="${openItem.id}" data-cat="${openCat.id}" style="flex:1;" />
            <input type="number" inputmode="numeric" class="modal-price-input" id="itemViewScoreInput" placeholder="score" maxlength="6" value="${openItem.score !== undefined && openItem.score !== null ? openItem.score : ''}" data-item="${openItem.id}" data-cat="${openCat.id}" style="width:70px;" />
            <span style="align-self:center; color:var(--ink-soft); font-size:13px;">/</span>
            <input type="number" inputmode="numeric" class="modal-price-input" id="itemViewMaxScoreInput" placeholder="out of" maxlength="6" value="${openItem.maxScore !== undefined && openItem.maxScore !== null ? openItem.maxScore : ''}" data-item="${openItem.id}" data-cat="${openCat.id}" style="width:70px;" />
          </div>` : ''}
          ${store.data.categories.length > 1 ? `<div class="move-cat-row">
            <span class="move-cat-label">move to</span>
            <select id="itemMoveCatSelect" data-item="${openItem.id}" data-cat="${openCat.id}">
              ${store.data.categories.map(c => `<option value="${c.id}" ${c.id === openCat.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
            </select>
          </div>` : ''}

          <div class="modal-section-label">sub-items</div>
          ${subs.length > 0 ? `<ul class="subitems">
            ${subs.map(s => ui.editingSubId === s.id ? `<li class="subitem">
              <input type="text" class="sub-edit-input" id="subEditInput" value="${escapeHtml(s.text)}" maxlength="40" data-item="${openItem.id}" data-cat="${openCat.id}" data-sub="${s.id}" autofocus />
              <input type="text" inputmode="decimal" class="sub-edit-price" id="subEditPrice" placeholder="$" maxlength="10" value="${s.price ? s.price : ''}" />
              <span class="mini-plus" data-subeditconfirm="${s.id}" data-item="${openItem.id}" data-cat="${openCat.id}">${CHECK_ICON}</span>
            </li>` : `<li class="subitem">
              <div class="sub-check ${s.done?'done':''}" data-subtoggle="${s.id}" data-item="${openItem.id}" data-cat="${openCat.id}"></div>
              <div class="sub-text ${s.done?'done':''}" data-subeditstart="${s.id}">${escapeHtml(s.text)}${s.price ? ` <span class="sub-price">$${Number(s.price).toFixed(2)}</span>` : ''}</div>
              <div class="sub-del" data-subdel="${s.id}" data-item="${openItem.id}" data-cat="${openCat.id}">✕</div>
            </li>`).join('')}
          </ul>` : ''}
          <div class="add-sub-row">
            ${addingSub
              ? `<input type="text" placeholder="sub-item name…" data-newsub="${openItem.id}" data-cat="${openCat.id}" maxlength="40" autofocus /><span class="mini-plus" data-confirmsub="${openItem.id}" data-cat="${openCat.id}">${CHECK_ICON}</span>`
              : `<span class="mini-plus" data-startsub="${openItem.id}">+</span><span style="font-size:11px; color:var(--ink-soft);">sub-item</span>`}
          </div>

          <div class="modal-section-label">links</div>
          ${(openItem.links||[]).length > 0 ? `<div class="links-grid">
            ${openItem.links.map(l => { const fav = faviconFor(l.url); let dom=''; try{ dom = new URL(l.url).hostname.replace('www.',''); }catch(e){ dom = l.url; }
              return `<a class="link-tile" href="${escapeHtml(l.url)}" target="_blank" rel="noopener">
                <span class="link-del" data-linkdel="${l.id}" data-item="${openItem.id}" data-cat="${openCat.id}">✕</span>
                ${fav ? `<img src="${fav}" alt="" />` : ''}
                <span class="domain">${escapeHtml(dom)}</span>
              </a>`; }).join('')}
          </div>` : ''}
          <div class="add-link-row">
            ${addingLink
              ? `<input type="text" placeholder="paste a link…" data-newlink="${openItem.id}" data-cat="${openCat.id}" maxlength="300" autofocus /><span class="mini-plus" data-confirmlink="${openItem.id}" data-cat="${openCat.id}">${CHECK_ICON}</span>`
              : `<span class="mini-plus" data-startlink="${openItem.id}">+</span><span style="font-size:11px; color:var(--ink-soft);">link</span>`}
          </div>

          <div class="modal-section-label">photos</div>
          ${(openItem.images||[]).length > 0 ? `<div class="img-grid ${(openItem.images.length===1?'n1':(openItem.images.length===3?'n3':(openItem.images.length===2?'n2':'nmany')))}">
            ${openItem.images.map(img => `<div class="img-thumb-wrap"><img src="${img.data}" /><div class="img-del" data-imgdel="${img.id}" data-item="${openItem.id}" data-cat="${openCat.id}">✕</div></div>`).join('')}
          </div>` : ''}
          <label class="add-img-btn">+ add photo<input type="file" accept="image/*" multiple data-imgadd="${openItem.id}" data-cat="${openCat.id}" /></label>

          <div class="modal-section-label">notes</div>
          <textarea class="notes-area" data-notesfor="${openItem.id}" data-cat="${openCat.id}" placeholder="jot something down…">${escapeHtml(openItem.notes || '')}</textarea>
        </div>
      </div>`;
    }
  }

  html += renderFooter();

  if(ui.addingItemCat !== null){
    const cat = store.data.categories.find(c => c.id === ui.addingItemCat);
    html += `<div class="modal-overlay" id="itemModalOverlay">
      <div class="modal-box modal-box-lg">
        <div class="modal-closerow"><span class="expand-btn" id="itemCloseBtn">${COLLAPSE_ICON}</span></div>
        <div class="modal-title">New item${cat ? ` in ${escapeHtml(cat.name)}` : ''}</div>
        <input type="text" id="itemTitleInput" placeholder="${store.features.includes('course') ? 'e.g. Problem set 4' : 'e.g. Bedding'}" maxlength="40" value="${escapeHtml(ui.itemDraft.title)}" />
        ${store.features.includes('course')
          ? `<div class="course-field-row">
              <input type="date" id="itemDueInput" value="${ui.itemDraft.dueDate || ''}" style="flex:1;" />
              <input type="number" inputmode="numeric" id="itemScoreInput" placeholder="score" maxlength="6" value="${ui.itemDraft.score || ''}" style="width:70px;" />
              <span style="align-self:center; color:var(--ink-soft); font-size:13px;">/</span>
              <input type="number" inputmode="numeric" id="itemMaxScoreInput" placeholder="out of" maxlength="6" value="${ui.itemDraft.maxScore || ''}" style="width:70px;" />
            </div>`
          : `<input type="text" inputmode="decimal" id="itemPriceInput" placeholder="price (optional) — e.g. 24.99" maxlength="10" value="${escapeHtml(ui.itemDraft.price || '')}" />`}

        <div class="modal-section-label">sub-items</div>
        ${ui.itemDraft.subitems.length > 0 ? `<ul class="subitems">
          ${ui.itemDraft.subitems.map(s => `<li class="subitem">
            <span class="sub-text">${escapeHtml(s.text)}</span>
            <span class="sub-del" data-draftsubdel="${s.id}">✕</span>
          </li>`).join('')}
        </ul>` : ''}
        <div class="add-sub-row">
          ${ui.modalAddingSub
            ? `<input type="text" id="draftNewSub" placeholder="sub-item name…" maxlength="40" autofocus /><span class="mini-plus" id="draftConfirmSub">${CHECK_ICON}</span>`
            : `<span class="mini-plus" id="draftStartSub">+</span><span style="font-size:11px; color:var(--ink-soft);">sub-item</span>`}
        </div>

        <div class="modal-section-label">links</div>
        ${ui.itemDraft.links.length > 0 ? `<div class="links-grid">
          ${ui.itemDraft.links.map(l => { let dom=''; try{ dom = new URL(l.url).hostname.replace('www.',''); }catch(e){ dom = l.url; }
            return `<div class="link-tile" style="position:relative;">
              <span class="link-del" data-draftlinkdel="${l.id}">✕</span>
              <span class="domain">${escapeHtml(dom)}</span>
            </div>`; }).join('')}
        </div>` : ''}
        <div class="add-link-row">
          ${ui.modalAddingLink
            ? `<input type="text" id="draftNewLink" placeholder="paste a link…" maxlength="300" autofocus /><span class="mini-plus" id="draftConfirmLink">${CHECK_ICON}</span>`
            : `<span class="mini-plus" id="draftStartLink">+</span><span style="font-size:11px; color:var(--ink-soft);">link</span>`}
        </div>

        <div class="modal-section-label">photos</div>
        ${ui.itemDraft.images.length > 0 ? `<div class="img-grid ${(ui.itemDraft.images.length===1?'n1':(ui.itemDraft.images.length===3?'n3':(ui.itemDraft.images.length===2?'n2':'nmany')))}">
          ${ui.itemDraft.images.map(img => `<div class="img-thumb-wrap"><img src="${img.data}" /><div class="img-del" data-draftimgdel="${img.id}">✕</div></div>`).join('')}
        </div>` : ''}
        <label class="add-img-btn">+ add photo<input type="file" accept="image/*" multiple id="draftImgInput" /></label>

        <div class="modal-section-label">notes</div>
        <textarea class="notes-area" id="itemNotesInput" placeholder="notes (optional)">${escapeHtml(ui.itemDraft.notes)}</textarea>

        <div class="modal-actions" style="margin-top:14px;">
          <button class="modal-cancel" id="itemCancelBtn">cancel</button>
          <button class="modal-add" id="itemSaveBtn">add to board</button>
        </div>
      </div>
    </div>`;
  }
  return html;
}

function addSub(catId, itemId){
  const input = document.querySelector(`[data-newsub="${itemId}"]`);
  const text = input.value.trim();
  if(!text) return;
  const {item} = findGroup(catId, itemId);
  if(item){ item.subitems.push({id: uid(), text, done:false}); ui.addingSubFor = null; render(); saveData(); }
}

function addLink(catId, itemId){
  const input = document.querySelector(`[data-newlink="${itemId}"]`);
  let url = input.value.trim();
  if(!url) return;
  if(!/^https?:\/\//i.test(url)) url = 'https://' + url;
  const {item} = findGroup(catId, itemId);
  if(item){ item.links.push({id: uid(), url}); ui.addingLinkFor = null; render(); saveData(); }
}

function addCategory(){
  const input = document.getElementById('newCatInput');
  const name = input.value.trim();
  if(!name) return;
  store.data.categories.push({id: uid(), name, items: [], images: []});
  ui.addingCategory = false; render(); saveData();
}


export function attachMoodboardEvents(){

  const addCatBtn = document.getElementById('addCatBtn');
  if(addCatBtn) addCatBtn.onclick = () => { ui.addingCategory = true; render(); const inp = document.getElementById('newCatInput'); if(inp) inp.focus(); };
  const catModalOverlay = document.getElementById('catModalOverlay');
  if(catModalOverlay) catModalOverlay.addEventListener('click', (e) => { if(e.target === catModalOverlay){ ui.addingCategory = false; render(); } });
  const catCancelBtn = document.getElementById('catCancelBtn');
  if(catCancelBtn) catCancelBtn.onclick = () => { ui.addingCategory = false; render(); };
  const catCloseBtn = document.getElementById('catCloseBtn');
  if(catCloseBtn) catCloseBtn.onclick = () => { ui.addingCategory = false; render(); };
  const catAddBtn = document.getElementById('catAddBtn');
  if(catAddBtn) catAddBtn.onclick = addCategory;
  const newCatInput = document.getElementById('newCatInput');
  if(newCatInput){
    newCatInput.focus();
    newCatInput.addEventListener('keydown', e => { if(e.key==='Enter') addCategory(); if(e.key==='Escape'){ ui.addingCategory=false; render(); } });
  }

  function syncItemDraftFromInputs(){
    const t = document.getElementById('itemTitleInput');
    const n = document.getElementById('itemNotesInput');
    const p = document.getElementById('itemPriceInput');
    const due = document.getElementById('itemDueInput');
    const sc = document.getElementById('itemScoreInput');
    const msc = document.getElementById('itemMaxScoreInput');
    if(t) ui.itemDraft.title = t.value;
    if(n) ui.itemDraft.notes = n.value;
    if(p) ui.itemDraft.price = p.value;
    if(due) ui.itemDraft.dueDate = due.value;
    if(sc) ui.itemDraft.score = sc.value;
    if(msc) ui.itemDraft.maxScore = msc.value;
  }

  const itemModalOverlay = document.getElementById('itemModalOverlay');
  if(itemModalOverlay) itemModalOverlay.addEventListener('click', (e) => { if(e.target === itemModalOverlay){ ui.addingItemCat = null; ui.itemDraft = null; render(); } });
  const itemCancelBtn = document.getElementById('itemCancelBtn');
  if(itemCancelBtn) itemCancelBtn.onclick = () => { ui.addingItemCat = null; ui.itemDraft = null; render(); };
  const itemCloseBtn = document.getElementById('itemCloseBtn');
  if(itemCloseBtn) itemCloseBtn.onclick = () => { ui.addingItemCat = null; ui.itemDraft = null; render(); };
  const itemSaveBtn = document.getElementById('itemSaveBtn');
  if(itemSaveBtn) itemSaveBtn.onclick = () => {
    syncItemDraftFromInputs();
    const cat = store.data.categories.find(c => c.id === ui.addingItemCat);
    if(cat){
      const priceVal = (ui.itemDraft.price || '').trim();
      const scoreVal = (ui.itemDraft.score || '').toString().trim();
      const maxScoreVal = (ui.itemDraft.maxScore || '').toString().trim();
      cat.items.push({
        id: uid(),
        title: ui.itemDraft.title.trim() || 'New item',
        notes: ui.itemDraft.notes.trim(),
        price: priceVal ? (parseFloat(priceVal) || 0) : 0,
        dueDate: ui.itemDraft.dueDate || null,
        score: scoreVal ? Number(scoreVal) : null,
        maxScore: maxScoreVal ? Number(maxScoreVal) : null,
        subitems: ui.itemDraft.subitems,
        links: ui.itemDraft.links,
        images: ui.itemDraft.images
      });
      ui.addingItemCat = null; ui.itemDraft = null;
      render(); saveData();
    }
  };

  const draftStartSub = document.getElementById('draftStartSub');
  if(draftStartSub) draftStartSub.onclick = () => { syncItemDraftFromInputs(); ui.modalAddingSub = true; render(); const i = document.getElementById('draftNewSub'); if(i) i.focus(); };
  function confirmDraftSub(){
    const el = document.getElementById('draftNewSub');
    if(!el) return;
    const text = el.value.trim();
    if(text){ syncItemDraftFromInputs(); ui.itemDraft.subitems.push({id: uid(), text, done:false}); ui.modalAddingSub = false; render(); }
  }
  const draftNewSub = document.getElementById('draftNewSub');
  if(draftNewSub){
    draftNewSub.addEventListener('keydown', e => {
      if(e.key==='Enter') confirmDraftSub();
      if(e.key==='Escape'){ ui.modalAddingSub=false; render(); }
    });
  }
  const draftConfirmSub = document.getElementById('draftConfirmSub');
  if(draftConfirmSub) draftConfirmSub.onclick = confirmDraftSub;
  document.querySelectorAll('[data-draftsubdel]').forEach(el => el.onclick = () => {
    syncItemDraftFromInputs();
    ui.itemDraft.subitems = ui.itemDraft.subitems.filter(s => s.id !== el.getAttribute('data-draftsubdel'));
    render();
  });

  const draftStartLink = document.getElementById('draftStartLink');
  if(draftStartLink) draftStartLink.onclick = () => { syncItemDraftFromInputs(); ui.modalAddingLink = true; render(); const i = document.getElementById('draftNewLink'); if(i) i.focus(); };
  function confirmDraftLink(){
    const el = document.getElementById('draftNewLink');
    if(!el) return;
    let url = el.value.trim();
    if(url){
      if(!/^https?:\/\//i.test(url)) url = 'https://' + url;
      syncItemDraftFromInputs(); ui.itemDraft.links.push({id: uid(), url}); ui.modalAddingLink = false; render();
    }
  }
  const draftNewLink = document.getElementById('draftNewLink');
  if(draftNewLink){
    draftNewLink.addEventListener('keydown', e => {
      if(e.key==='Enter') confirmDraftLink();
      if(e.key==='Escape'){ ui.modalAddingLink=false; render(); }
    });
  }
  const draftConfirmLink = document.getElementById('draftConfirmLink');
  if(draftConfirmLink) draftConfirmLink.onclick = confirmDraftLink;
  document.querySelectorAll('[data-draftlinkdel]').forEach(el => el.onclick = () => {
    syncItemDraftFromInputs();
    ui.itemDraft.links = ui.itemDraft.links.filter(l => l.id !== el.getAttribute('data-draftlinkdel'));
    render();
  });

  const draftImgInput = document.getElementById('draftImgInput');
  if(draftImgInput){
    draftImgInput.addEventListener('change', (e) => {
      syncItemDraftFromInputs();
      const files = Array.from(e.target.files || []);
      let remaining = files.length;
      if(remaining === 0) return;
      files.forEach(file => {
        compressImage(file, 300, dataUrl => {
          ui.itemDraft.images.push({id: uid(), data: dataUrl});
          remaining--;
          if(remaining === 0) render();
        });
      });
    });
  }
  document.querySelectorAll('[data-draftimgdel]').forEach(el => el.onclick = () => {
    syncItemDraftFromInputs();
    ui.itemDraft.images = ui.itemDraft.images.filter(i => i.id !== el.getAttribute('data-draftimgdel'));
    render();
  });

  document.querySelectorAll('[data-notesfor]').forEach(el => {
    el.addEventListener('blur', () => {
      const {item} = findGroup(el.getAttribute('data-cat'), el.getAttribute('data-notesfor'));
      if(item){ item.notes = el.value; saveData(); }
    });
  });

  const itemViewPriceInput = document.getElementById('itemViewPriceInput');
  if(itemViewPriceInput){
    itemViewPriceInput.addEventListener('blur', () => {
      const {item} = findGroup(itemViewPriceInput.getAttribute('data-cat'), itemViewPriceInput.getAttribute('data-item'));
      if(item){
        const val = itemViewPriceInput.value.trim();
        item.price = val ? (parseFloat(val) || 0) : 0;
        saveData();
      }
    });
  }

  const itemViewDueInput = document.getElementById('itemViewDueInput');
  if(itemViewDueInput){
    itemViewDueInput.addEventListener('change', () => {
      const {item} = findGroup(itemViewDueInput.getAttribute('data-cat'), itemViewDueInput.getAttribute('data-item'));
      if(item){ item.dueDate = itemViewDueInput.value || null; saveData(); }
    });
  }
  const itemViewScoreInput = document.getElementById('itemViewScoreInput');
  const itemViewMaxScoreInput = document.getElementById('itemViewMaxScoreInput');
  if(itemViewScoreInput){
    itemViewScoreInput.addEventListener('blur', () => {
      const {item} = findGroup(itemViewScoreInput.getAttribute('data-cat'), itemViewScoreInput.getAttribute('data-item'));
      if(item){ const v = itemViewScoreInput.value.trim(); item.score = v ? Number(v) : null; saveData(); }
    });
  }
  if(itemViewMaxScoreInput){
    itemViewMaxScoreInput.addEventListener('blur', () => {
      const {item} = findGroup(itemViewMaxScoreInput.getAttribute('data-cat'), itemViewMaxScoreInput.getAttribute('data-item'));
      if(item){ const v = itemViewMaxScoreInput.value.trim(); item.maxScore = v ? Number(v) : null; saveData(); }
    });
  }

  const itemMoveCatSelect = document.getElementById('itemMoveCatSelect');
  if(itemMoveCatSelect){
    itemMoveCatSelect.onchange = () => {
      const fromCatId = itemMoveCatSelect.getAttribute('data-cat');
      const itemId = itemMoveCatSelect.getAttribute('data-item');
      const toCatId = itemMoveCatSelect.value;
      if(toCatId === fromCatId) return;
      const fromCat = store.data.categories.find(c => c.id === fromCatId);
      const toCat = store.data.categories.find(c => c.id === toCatId);
      if(!fromCat || !toCat) return;
      const idx = fromCat.items.findIndex(i => i.id === itemId);
      if(idx === -1) return;
      const [moved] = fromCat.items.splice(idx, 1);
      toCat.items.push(moved);
      render(); saveData();
    };
  }



  const catEditToggle = document.getElementById('catEditToggle');
  if(catEditToggle) catEditToggle.onclick = () => { ui.catEditMode = !ui.catEditMode; render(); };

  document.querySelectorAll('[data-catopenedit]').forEach(el => el.onclick = () => {
    ui.editingCatId = el.getAttribute('data-catopenedit');
    render();
  });

  const catEditModalOverlay = document.getElementById('catEditModalOverlay');
  if(catEditModalOverlay) catEditModalOverlay.addEventListener('click', (e) => { if(e.target === catEditModalOverlay){ ui.editingCatId = null; render(); } });
  const catEditCloseBtn = document.getElementById('catEditCloseBtn');
  if(catEditCloseBtn) catEditCloseBtn.onclick = () => { ui.editingCatId = null; render(); };
  const catEditCancelBtn = document.getElementById('catEditCancelBtn');
  if(catEditCancelBtn) catEditCancelBtn.onclick = () => { ui.editingCatId = null; render(); };

  const catEditNameInput = document.getElementById('catEditNameInput');
  if(catEditNameInput){ catEditNameInput.focus(); catEditNameInput.select(); }

  const catEditMoveUp = document.getElementById('catEditMoveUp');
  const catEditMoveDown = document.getElementById('catEditMoveDown');
  function moveCat(dir){
    const idx = store.data.categories.findIndex(c => c.id === ui.editingCatId);
    const swapWith = dir === 'up' ? idx - 1 : idx + 1;
    if(idx === -1 || swapWith < 0 || swapWith >= store.data.categories.length) return;
    [store.data.categories[idx], store.data.categories[swapWith]] = [store.data.categories[swapWith], store.data.categories[idx]];
    render(); saveData();
  }
  if(catEditMoveUp) catEditMoveUp.onclick = () => moveCat('up');
  if(catEditMoveDown) catEditMoveDown.onclick = () => moveCat('down');

  const catEditDeleteBtn = document.getElementById('catEditDeleteBtn');
  if(catEditDeleteBtn) catEditDeleteBtn.onclick = () => {
    if(!confirm('Remove this whole category and its items?')) return;
    store.data.categories = store.data.categories.filter(c => c.id !== ui.editingCatId);
    delete store.data.categoryWeights[ui.editingCatId];
    ui.editingCatId = null;
    render(); saveData();
  };

  const catEditSaveBtn = document.getElementById('catEditSaveBtn');
  if(catEditSaveBtn) catEditSaveBtn.onclick = () => {
    const cat = store.data.categories.find(c => c.id === ui.editingCatId);
    if(cat){
      const nameInput = document.getElementById('catEditNameInput');
      const name = nameInput.value.trim();
      if(name) cat.name = name;
      const weightInput = document.getElementById('catEditWeightInput');
      if(weightInput){
        const val = weightInput.value.trim();
        if(val) store.data.categoryWeights[cat.id] = Number(val);
        else delete store.data.categoryWeights[cat.id];
      }
    }
    ui.editingCatId = null;
    render(); saveData();
  };

  function startAddItem(catId){
    ui.addingItemCat = catId;
    ui.itemDraft = {title:'', notes:'', price:'', dueDate:'', score:'', maxScore:'', subitems:[], links:[], images:[]};
    ui.modalAddingSub = false;
    ui.modalAddingLink = false;
    ui.catQuickAddOpen = null;
    render();
    const t = document.getElementById('itemTitleInput');
    if(t) t.focus();
  }
  document.querySelectorAll('[data-addgroup]').forEach(el => el.onclick = () => startAddItem(el.getAttribute('data-addgroup')));

  document.querySelectorAll('[data-quickaddtoggle]').forEach(el => el.onclick = (e) => {
    e.stopPropagation();
    const catId = el.getAttribute('data-quickaddtoggle');
    ui.catQuickAddOpen = (ui.catQuickAddOpen === catId) ? null : catId;
    render();
  });
  document.querySelectorAll('[data-quickadditem]').forEach(el => el.onclick = (e) => {
    e.stopPropagation();
    startAddItem(el.getAttribute('data-quickadditem'));
  });
  document.querySelectorAll('[data-quickaddphoto]').forEach(el => el.onclick = (e) => {
    e.stopPropagation();
    const catId = el.getAttribute('data-quickaddphoto');
    ui.catQuickAddOpen = null;
    render();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.style.cssText = 'position:absolute; left:-9999px; width:1px; height:1px; opacity:0;';
    document.body.appendChild(input);
    let handled = false;
    input.addEventListener('change', (ev) => {
      if(handled) return;
      handled = true;
      const cat = store.data.categories.find(c => c.id === catId);
      const files = Array.from(ev.target.files || []);
      if(!cat || files.length === 0){ input.remove(); return; }
      if(!cat.images) cat.images = [];
      let remaining = files.length;
      files.forEach(file => {
        compressImage(file, 400, dataUrl => {
          cat.images.push({id: uid(), data: dataUrl});
          remaining--;
          if(remaining === 0){ render(); saveData(); input.remove(); }
        });
      });
    });
    input.click();
  });
  if(ui.catQuickAddOpen !== null){
    document.addEventListener('click', function closeQuickAdd(){
      ui.catQuickAddOpen = null;
      render();
      document.removeEventListener('click', closeQuickAdd);
    }, {once: true});
  }

  document.querySelectorAll('[data-itemtitle]').forEach(el => {
    el.addEventListener('blur', () => {
      const {item} = findGroup(el.getAttribute('data-cat'), el.getAttribute('data-itemtitle'));
      if(item){ item.title = el.innerText.trim() || item.title; saveData(); }
    });
    el.addEventListener('keydown', e => { if(e.key==='Enter'){ e.preventDefault(); el.blur(); } });
  });

  let dragSrc = null;
  document.querySelectorAll('[data-dragitem]').forEach(el => {
    el.addEventListener('dragstart', (e) => {
      dragSrc = {itemId: el.getAttribute('data-dragitem'), catId: el.getAttribute('data-dragcat')};
      e.dataTransfer.effectAllowed = 'move';
      el.style.opacity = '0.4';
    });
    el.addEventListener('dragend', () => { el.style.opacity = '1'; dragSrc = null; });
    el.addEventListener('dragover', (e) => { e.preventDefault(); });
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      if(!dragSrc) return;
      const targetCatId = el.getAttribute('data-dragcat');
      const targetItemId = el.getAttribute('data-dragitem');
      if(dragSrc.catId !== targetCatId || dragSrc.itemId === targetItemId) return;
      const cat = store.data.categories.find(c => c.id === targetCatId);
      if(!cat) return;
      const fromIdx = cat.items.findIndex(i => i.id === dragSrc.itemId);
      const toIdx = cat.items.findIndex(i => i.id === targetItemId);
      if(fromIdx === -1 || toIdx === -1) return;
      const [moved] = cat.items.splice(fromIdx, 1);
      cat.items.splice(toIdx, 0, moved);
      render(); saveData();
    });
  });

  document.querySelectorAll('[data-cardopen]').forEach(el => el.addEventListener('click', (e) => {
    const interactive = e.target.closest('input, textarea, a, .sub-check, .sub-text, .sub-del, .card-del, .mini-plus, .img-del, .link-del, .add-img-btn, .move-bought-btn');
    if(interactive) return;
    ui.openItemId = el.getAttribute('data-cardopen');
    ui.addingSubFor = null; ui.addingLinkFor = null;
    render();
  }));

  document.querySelectorAll('[data-expandtoggle]').forEach(el => el.onclick = (e) => {
    e.stopPropagation();
    ui.openItemId = el.getAttribute('data-expandtoggle');
    ui.addingSubFor = null; ui.addingLinkFor = null;
    render();
  });

  const itemViewOverlay = document.getElementById('itemViewOverlay');
  if(itemViewOverlay) itemViewOverlay.addEventListener('click', (e) => { if(e.target === itemViewOverlay){ ui.openItemId = null; render(); } });
  const itemViewClose = document.getElementById('itemViewClose');
  if(itemViewClose) itemViewClose.onclick = () => { ui.openItemId = null; render(); };

  document.querySelectorAll('[data-carddel]').forEach(el => el.onclick = () => {
    const cat = store.data.categories.find(c => c.id === el.getAttribute('data-cat'));
    if(cat){ cat.items = cat.items.filter(i => i.id !== el.getAttribute('data-carddel')); render(); saveData(); }
  });

  document.querySelectorAll('[data-togglecompleted]').forEach(el => el.onclick = () => {
    const catId = el.getAttribute('data-cat');
    const cat = store.data.categories.find(c => c.id === catId);
    const item = cat ? cat.items.find(i => i.id === el.getAttribute('data-togglecompleted')) : null;
    if(item){ item.completed = !item.completed; render(); saveData(); }
  });

  document.querySelectorAll('[data-moodview]').forEach(el => el.onclick = () => {
    const catId = el.getAttribute('data-moodview');
    if(ui.moodViewCats.has(catId)) ui.moodViewCats.delete(catId); else ui.moodViewCats.add(catId);
    render();
  });

  document.querySelectorAll('[data-catimgadd]').forEach(el => {
    el.addEventListener('change', (e) => {
      const catId = el.getAttribute('data-catimgadd');
      const cat = store.data.categories.find(c => c.id === catId);
      if(!cat) return;
      if(!cat.images) cat.images = [];
      const files = Array.from(e.target.files || []);
      let remaining = files.length;
      if(remaining === 0) return;
      files.forEach(file => {
        compressImage(file, 400, dataUrl => {
          cat.images.push({id: uid(), data: dataUrl});
          remaining--;
          if(remaining === 0){ render(); saveData(); }
        });
      });
    });
  });
  document.querySelectorAll('[data-catimgdel]').forEach(el => el.onclick = () => {
    const cat = store.data.categories.find(c => c.id === el.getAttribute('data-cat'));
    if(cat){ cat.images = (cat.images||[]).filter(i => i.id !== el.getAttribute('data-catimgdel')); render(); saveData(); }
  });

  // subitems
  document.querySelectorAll('[data-subtoggle]').forEach(el => el.onclick = () => {
    const {item} = findGroup(el.getAttribute('data-cat'), el.getAttribute('data-item'));
    const s = item && item.subitems.find(s => s.id === el.getAttribute('data-subtoggle'));
    if(s){
      s.done = !s.done;
      if(s.done && !s.price){ ui.editingSubId = s.id; }
      render(); saveData();
    }
  });
  document.querySelectorAll('[data-subdel]').forEach(el => el.onclick = () => {
    const {item} = findGroup(el.getAttribute('data-cat'), el.getAttribute('data-item'));
    if(item){ item.subitems = item.subitems.filter(s => s.id !== el.getAttribute('data-subdel')); render(); saveData(); }
  });
  document.querySelectorAll('[data-startsub]').forEach(el => el.onclick = () => { ui.addingSubFor = el.getAttribute('data-startsub'); render(); const inp = document.querySelector(`[data-newsub]`); if(inp) inp.focus(); });
  document.querySelectorAll('[data-newsub]').forEach(el => {
    el.addEventListener('keydown', e => { if(e.key==='Enter') addSub(el.getAttribute('data-cat'), el.getAttribute('data-newsub')); if(e.key==='Escape'){ ui.addingSubFor=null; render(); } });
  });
  document.querySelectorAll('[data-confirmsub]').forEach(el => el.onclick = () => addSub(el.getAttribute('data-cat'), el.getAttribute('data-confirmsub')));

  document.querySelectorAll('[data-subeditstart]').forEach(el => el.onclick = () => {
    ui.editingSubId = el.getAttribute('data-subeditstart');
    render();
  });
  function confirmSubEdit(){
    const input = document.getElementById('subEditInput');
    const priceInput = document.getElementById('subEditPrice');
    if(!input) return;
    const catId = input.getAttribute('data-cat');
    const itemId = input.getAttribute('data-item');
    const subId = input.getAttribute('data-sub');
    const text = input.value.trim();
    const {item} = findGroup(catId, itemId);
    const s = item && item.subitems.find(s => s.id === subId);
    if(s && text){
      s.text = text;
      const priceVal = priceInput ? priceInput.value.trim() : '';
      s.price = priceVal ? (parseFloat(priceVal) || 0) : 0;
    }
    ui.editingSubId = null;
    render(); saveData();
  }
  document.querySelectorAll('[data-subeditconfirm]').forEach(el => el.onclick = confirmSubEdit);
  const subEditInput = document.getElementById('subEditInput');
  const subEditPrice = document.getElementById('subEditPrice');
  if(subEditInput){
    let focusPrice = false;
    if(subEditPrice){
      const {item} = findGroup(subEditInput.getAttribute('data-cat'), subEditInput.getAttribute('data-item'));
      const s = item && item.subitems.find(s => s.id === subEditInput.getAttribute('data-sub'));
      if(s && s.done && !s.price) focusPrice = true;
    }
    if(focusPrice){
      subEditPrice.focus();
      subEditPrice.select();
    } else {
      subEditInput.focus();
      subEditInput.select();
    }
    subEditInput.addEventListener('keydown', e => {
      if(e.key==='Enter') confirmSubEdit();
      if(e.key==='Escape'){ ui.editingSubId=null; render(); }
    });
  }
  if(subEditPrice) subEditPrice.addEventListener('keydown', e => { if(e.key==='Enter') confirmSubEdit(); if(e.key==='Escape'){ ui.editingSubId=null; render(); } });

  // links
  document.querySelectorAll('[data-linkdel]').forEach(el => el.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const {item} = findGroup(el.getAttribute('data-cat'), el.getAttribute('data-item'));
    if(item){ item.links = item.links.filter(l => l.id !== el.getAttribute('data-linkdel')); render(); saveData(); }
  });
  document.querySelectorAll('[data-startlink]').forEach(el => el.onclick = () => { ui.addingLinkFor = el.getAttribute('data-startlink'); render(); const inp = document.querySelector(`[data-newlink]`); if(inp) inp.focus(); });
  document.querySelectorAll('[data-newlink]').forEach(el => {
    el.addEventListener('keydown', e => { if(e.key==='Enter') addLink(el.getAttribute('data-cat'), el.getAttribute('data-newlink')); if(e.key==='Escape'){ ui.addingLinkFor=null; render(); } });
  });
  document.querySelectorAll('[data-confirmlink]').forEach(el => el.onclick = () => addLink(el.getAttribute('data-cat'), el.getAttribute('data-confirmlink')));

  // images
  document.querySelectorAll('[data-imgdel]').forEach(el => el.onclick = () => {
    const {item} = findGroup(el.getAttribute('data-cat'), el.getAttribute('data-item'));
    if(item){ item.images = item.images.filter(i => i.id !== el.getAttribute('data-imgdel')); render(); saveData(); }
  });
  document.querySelectorAll('[data-imgadd]').forEach(el => {
    el.addEventListener('change', (e) => {
      const catId = el.getAttribute('data-cat');
      const itemId = el.getAttribute('data-imgadd');
      const {item} = findGroup(catId, itemId);
      if(!item) return;
      const files = Array.from(e.target.files || []);
      let remaining = files.length;
      if(remaining === 0) return;
      files.forEach(file => {
        compressImage(file, 300, dataUrl => {
          item.images.push({id: uid(), data: dataUrl});
          remaining--;
          if(remaining === 0){ render(); saveData(); }
        });
      });
    });
  });
}
