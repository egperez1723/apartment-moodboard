// Costume planner spaces (e.g. Halloween). Each costume is stored as a
// category and each piece of a costume as an item inside it, so the
// existing data shape, photo compression, and budget math all keep working.
// Costume-only extras live in two places:
//   store.data.costumeStatus[catId]  -> 'idea' | 'ordered' | 'have' | 'done'
//   item.source                      -> 'own' | 'buy' | 'diy'
// The countdown reuses `moveInDate` (just labelled for Halloween) so the
// existing date editor keeps working.

import { store, ui, saveData } from './store.js';
import { uid, escapeHtml, daysUntil, PENCIL_ICON, COLLAPSE_ICON, compressImage } from './shared.js';
import { render } from './app.js';

const STATUSES = [
  { id: 'idea', label: 'just an idea' },
  { id: 'ordered', label: 'ordered' },
  { id: 'have', label: 'got everything' },
  { id: 'done', label: 'done' }
];
const SOURCES = [
  { id: 'own', label: 'own it' },
  { id: 'buy', label: 'buy' },
  { id: 'diy', label: 'DIY' }
];

function statusOf(catId){
  const id = (store.data.costumeStatus || {})[catId] || 'idea';
  return STATUSES.find(s => s.id === id) || STATUSES[0];
}
function money(n){
  const v = Number(n) || 0;
  return '$' + (Number.isInteger(v) ? v : v.toFixed(2));
}
function piecesOf(cat){ return cat.items || []; }
function costOf(cat){ return piecesOf(cat).reduce((s, it) => s + (Number(it.price) || 0), 0); }
function findPiece(catId, itemId){
  const cat = store.data.categories.find(c => c.id === catId);
  return { cat, item: cat ? piecesOf(cat).find(i => i.id === itemId) : null };
}

export function renderCostumeCountdown(){
  const d = daysUntil(store.data.moveInDate);
  let inner;
  if(store.data.moveInDate === null){
    inner = `<div class="hand" style="font-size:18px; color:var(--ink-soft);">no date set yet</div>`;
  } else if(!d.past && d.totalHours > 0){
    inner = `<div class="countdown-num">${d.days}<span style="font-size:20px;">d</span> ${d.hours}<span style="font-size:20px;">h</span></div><div class="countdown-label">until halloween</div>`;
  } else if(d.totalHours === 0){
    inner = `<div class="countdown-num hand">boo!</div><div class="countdown-label">halloween is here</div>`;
  } else {
    const agoDays = Math.floor(Math.abs(d.totalHours) / 24);
    inner = `<div class="countdown-num hand">🎃</div><div class="countdown-label">halloween was ${agoDays} day${agoDays === 1 ? '' : 's'} ago</div>`;
  }

  let total = 0, ready = 0;
  store.data.categories.forEach(c => piecesOf(c).forEach(it => { total++; if(it.completed) ready++; }));
  const pct = total ? Math.round((ready / total) * 100) : 0;

  return `<div class="countdown-card">
    ${inner}
    ${total ? `<div class="cs-progress">pieces ready · ${ready} of ${total}<div class="cs-bar"><i style="width:${pct}%"></i></div></div>` : ''}
    <button class="countdown-editbtn" id="editDateLink" title="edit date">${PENCIL_ICON}</button>
    ${ui.editingDate ? `<div class="date-editor"><input type="datetime-local" id="dateInput" value="${store.data.moveInDate || ''}" /><button id="saveDateBtn">save</button></div>` : ''}
  </div>`;
}

function renderCostumeCard(cat){
  const status = statusOf(cat.id);
  const pieces = piecesOf(cat);
  const readyCount = pieces.filter(p => p.completed).length;
  const photo = (cat.images || [])[0];

  return `<div class="cs-card">
    <div class="cs-pin"></div>
    <div class="cs-head">
      <h3 class="cs-name">${escapeHtml(cat.name)}</h3>
      <span class="cs-edit" data-csedit="${cat.id}" title="edit costume">${PENCIL_ICON}</span>
    </div>
    <span class="cs-status cs-s-${status.id}" data-csstatus="${cat.id}" title="tap to change">${status.label}</span>
    ${photo
      ? `<div class="cs-photo"><img src="${photo.data}" /></div>
         <div class="cs-photo-links">
           <label class="cs-link">swap photo<input type="file" accept="image/*" data-csphoto="${cat.id}" /></label>
           <span class="cs-link" data-csphotodel="${cat.id}">remove</span>
         </div>`
      : `<label class="cs-photo cs-photo-empty">+ add inspiration photo<input type="file" accept="image/*" data-csphoto="${cat.id}" /></label>`}
    <ul class="cs-pieces">
      ${pieces.length === 0 ? `<li class="cs-empty">no pieces yet</li>` : ''}
      ${pieces.map(p => `<li>
        <span class="cs-chk ${p.completed ? 'on' : ''}" data-cscheck="${cat.id}|${p.id}"></span>
        <span class="cs-piece-title ${p.completed ? 'done' : ''}" data-csopenpiece="${cat.id}|${p.id}">${escapeHtml(p.title)}</span>
        ${p.price ? `<span class="cs-piece-price">${money(p.price)}</span>` : ''}
        <span class="cs-tag cs-t-${p.source || 'buy'}">${(SOURCES.find(s => s.id === (p.source || 'buy')) || SOURCES[1]).label}</span>
      </li>`).join('')}
    </ul>
    <span class="cs-link cs-add-piece" data-csaddpiece="${cat.id}">+ add piece</span>
    <div class="cs-cost"><span>${readyCount} of ${pieces.length} pieces ready</span><b>${money(costOf(cat))}</b></div>
  </div>`;
}

function renderShoppingCard(){
  const rows = [];
  store.data.categories.forEach(cat => piecesOf(cat).forEach(p => {
    if((p.source || 'buy') === 'buy') rows.push({ cat, p });
  }));
  rows.sort((a, b) => (a.p.completed ? 1 : 0) - (b.p.completed ? 1 : 0));

  return `<div class="cs-card cs-wide">
    <div class="cs-tape"></div>
    <div class="cs-label">shopping list</div>
    ${rows.length === 0 ? `<div class="cs-empty">nothing to buy yet — mark a piece "buy" and it shows up here</div>` : ''}
    ${rows.map(({ cat, p }) => `<div class="cs-shop-row">
      <span class="cs-chk ${p.completed ? 'on' : ''}" data-cscheck="${cat.id}|${p.id}"></span>
      <span class="${p.completed ? 'cs-piece-title done' : ''}">${escapeHtml(p.title)}</span>
      <span class="cs-for">${escapeHtml(cat.name)}</span>
      ${p.price ? `<span class="cs-piece-price">${money(p.price)}</span>` : ''}
    </div>`).join('')}
  </div>`;
}

function renderBudgetCard(){
  const cats = store.data.categories;
  const total = cats.reduce((s, c) => s + costOf(c), 0);
  const spent = cats.reduce((s, c) => s + piecesOf(c).filter(p => p.completed).reduce((t, p) => t + (Number(p.price) || 0), 0), 0);
  return `<div class="cs-card">
    <div class="cs-pin"></div>
    <div class="cs-label">budget</div>
    ${cats.map(c => `<div class="cs-bud-line"><span>${escapeHtml(c.name)}</span><span>${money(costOf(c))}</span></div>`).join('')}
    <div class="cs-bud-line cs-bud-total"><span>total</span><span>${money(total)}</span></div>
    <div class="cs-bud-line cs-bud-spent"><span>spent so far</span><span>${money(spent)}</span></div>
  </div>`;
}

function renderCostumeModal(){
  const d = ui.costumeDraft;
  if(!d) return '';
  if(d.kind === 'costume'){
    return `<div class="modal-overlay" id="csModalOverlay">
      <div class="modal-box">
        <div class="modal-closerow"><span class="expand-btn" id="csCloseBtn">${COLLAPSE_ICON}</span></div>
        <div class="modal-title">${d.id ? 'Edit costume' : 'New costume'}</div>
        <input type="text" id="csNameInput" placeholder="e.g. Witch, Cowboy, Cat" maxlength="30" value="${escapeHtml(d.name)}" />
        <div class="modal-actions">
          ${d.id ? `<span class="cat-edit-delete" id="csDeleteBtn">delete</span>` : ''}
          <button class="modal-cancel" id="csCancelBtn">cancel</button>
          <button class="modal-add" id="csSaveBtn">save</button>
        </div>
      </div>
    </div>`;
  }
  return `<div class="modal-overlay" id="csModalOverlay">
    <div class="modal-box">
      <div class="modal-closerow"><span class="expand-btn" id="csCloseBtn">${COLLAPSE_ICON}</span></div>
      <div class="modal-title">${d.id ? 'Edit piece' : 'New piece'}</div>
      <input type="text" id="csPieceTitleInput" placeholder="e.g. Wig, Boots, Hat" maxlength="40" value="${escapeHtml(d.title)}" />
      <input type="number" inputmode="decimal" id="csPiecePriceInput" placeholder="price (optional)" value="${d.price}" />
      <select id="csPieceSourceSelect">
        ${SOURCES.map(s => `<option value="${s.id}" ${d.source === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}
      </select>
      <div class="modal-actions">
        ${d.id ? `<span class="cat-edit-delete" id="csDeleteBtn">delete</span>` : ''}
        <button class="modal-cancel" id="csCancelBtn">cancel</button>
        <button class="modal-add" id="csSaveBtn">save</button>
      </div>
    </div>
  </div>`;
}

export function renderCostumes(){
  const cats = store.data.categories;
  let html = `<div class="cs-section-head"><h2>costume ideas</h2></div>`;
  if(cats.length === 0){
    html += `<div class="empty-hint">no costumes yet — add your first idea below</div>`;
  } else {
    html += `<div class="cs-grid">${cats.map(renderCostumeCard).join('')}</div>`;
  }
  html += `<div class="new-cat-row"><span class="round-plus" id="csAddCostumeBtn">+</span><span style="font-size:12px; color:var(--ink-soft);">add a costume</span></div>`;
  if(cats.length > 0){
    html += `<div class="cs-bottom">${renderShoppingCard()}${renderBudgetCard()}</div>`;
  }
  html += renderCostumeModal();
  return html;
}

function closeModal(){ ui.costumeDraft = null; render(); }

export function attachCostumeEvents(){
  // add / edit costume
  const addBtn = document.getElementById('csAddCostumeBtn');
  if(addBtn) addBtn.onclick = () => { ui.costumeDraft = { kind: 'costume', id: null, name: '' }; render(); };
  document.querySelectorAll('[data-csedit]').forEach(el => el.onclick = () => {
    const cat = store.data.categories.find(c => c.id === el.getAttribute('data-csedit'));
    if(cat){ ui.costumeDraft = { kind: 'costume', id: cat.id, name: cat.name }; render(); }
  });

  // cycle status
  document.querySelectorAll('[data-csstatus]').forEach(el => el.onclick = () => {
    const catId = el.getAttribute('data-csstatus');
    const cur = statusOf(catId).id;
    const next = STATUSES[(STATUSES.findIndex(s => s.id === cur) + 1) % STATUSES.length].id;
    if(!store.data.costumeStatus) store.data.costumeStatus = {};
    store.data.costumeStatus[catId] = next;
    render(); saveData();
  });

  // pieces: check off, open, add
  document.querySelectorAll('[data-cscheck]').forEach(el => el.onclick = () => {
    const [catId, itemId] = el.getAttribute('data-cscheck').split('|');
    const { item } = findPiece(catId, itemId);
    if(item){ item.completed = !item.completed; render(); saveData(); }
  });
  document.querySelectorAll('[data-csopenpiece]').forEach(el => el.onclick = () => {
    const [catId, itemId] = el.getAttribute('data-csopenpiece').split('|');
    const { item } = findPiece(catId, itemId);
    if(item) ui.costumeDraft = { kind: 'piece', catId, id: item.id, title: item.title, price: item.price || '', source: item.source || 'buy' };
    render();
  });
  document.querySelectorAll('[data-csaddpiece]').forEach(el => el.onclick = () => {
    ui.costumeDraft = { kind: 'piece', catId: el.getAttribute('data-csaddpiece'), id: null, title: '', price: '', source: 'buy' };
    render();
  });

  // photos (one cover photo per costume)
  document.querySelectorAll('[data-csphoto]').forEach(el => el.addEventListener('change', (e) => {
    const cat = store.data.categories.find(c => c.id === el.getAttribute('data-csphoto'));
    const file = (e.target.files || [])[0];
    if(!cat || !file) return;
    compressImage(file, 600, dataUrl => {
      cat.images = [{ id: uid(), data: dataUrl }];
      render(); saveData();
    });
  }));
  document.querySelectorAll('[data-csphotodel]').forEach(el => el.onclick = () => {
    const cat = store.data.categories.find(c => c.id === el.getAttribute('data-csphotodel'));
    if(cat){ cat.images = []; render(); saveData(); }
  });

  // modal
  const overlay = document.getElementById('csModalOverlay');
  if(overlay) overlay.addEventListener('click', (e) => { if(e.target === overlay) closeModal(); });
  const closeBtn = document.getElementById('csCloseBtn'); if(closeBtn) closeBtn.onclick = closeModal;
  const cancelBtn = document.getElementById('csCancelBtn'); if(cancelBtn) cancelBtn.onclick = closeModal;

  const saveBtn = document.getElementById('csSaveBtn');
  if(saveBtn) saveBtn.onclick = () => {
    const d = ui.costumeDraft;
    if(!d) return;
    if(d.kind === 'costume'){
      const name = (document.getElementById('csNameInput').value || '').trim();
      if(!name){ document.getElementById('csNameInput').focus(); return; }
      if(d.id){
        const cat = store.data.categories.find(c => c.id === d.id);
        if(cat) cat.name = name;
      } else {
        const id = uid();
        store.data.categories.push({ id, name, items: [], images: [] });
        if(!store.data.costumeStatus) store.data.costumeStatus = {};
        store.data.costumeStatus[id] = 'idea';
      }
    } else {
      const title = (document.getElementById('csPieceTitleInput').value || '').trim();
      if(!title){ document.getElementById('csPieceTitleInput').focus(); return; }
      const priceRaw = document.getElementById('csPiecePriceInput').value;
      const price = priceRaw === '' ? 0 : Number(priceRaw) || 0;
      const source = document.getElementById('csPieceSourceSelect').value;
      const cat = store.data.categories.find(c => c.id === d.catId);
      if(!cat) return;
      if(d.id){
        const item = piecesOf(cat).find(i => i.id === d.id);
        if(item){ item.title = title; item.price = price; item.source = source; }
      } else {
        cat.items.push({ id: uid(), title, notes: '', price, dueDate: null, score: null, maxScore: null, subitems: [], links: [], images: [], completed: false, source });
      }
    }
    ui.costumeDraft = null;
    render(); saveData();
  };

  const delBtn = document.getElementById('csDeleteBtn');
  if(delBtn) delBtn.onclick = () => {
    const d = ui.costumeDraft;
    if(!d) return;
    if(d.kind === 'costume'){
      if(!confirm('Delete this costume and all its pieces?')) return;
      store.data.categories = store.data.categories.filter(c => c.id !== d.id);
      if(store.data.costumeStatus) delete store.data.costumeStatus[d.id];
    } else {
      if(!confirm('Delete this piece?')) return;
      const cat = store.data.categories.find(c => c.id === d.catId);
      if(cat) cat.items = cat.items.filter(i => i.id !== d.id);
    }
    ui.costumeDraft = null;
    render(); saveData();
  };

  ['csNameInput', 'csPieceTitleInput', 'csPiecePriceInput'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('keydown', (e) => { if(e.key === 'Enter'){ e.preventDefault(); document.getElementById('csSaveBtn').click(); } });
  });
}
