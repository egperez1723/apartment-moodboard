// The countdown card, move-in info popup, budget tracker popup, and footer
// (backup/restore/reset). Small, mostly self-contained UI pieces.

import { store, ui, saveLocalBackup, getNewestLocalBackup, resetAll, saveData, normalizeState,
  ALL_FEATURES, openSpace, createSpace, deleteSpace, toggleFeature, moveSpace, setSpaceArchived, computeRunningGrade, computeCourseProgress, computeNextDue,
  getAllHomeTasks, toggleHomeTask } from './store.js';
import { escapeHtml, daysUntil, PENCIL_ICON, COLLAPSE_ICON, CHECK_ICON, COPY_ICON, RECEIPT_ICON, CARD_ICON, CALENDAR_ICON } from './shared.js';
import { render } from './app.js';

function renderSpaceRow(s, isArchived){
  const featureLabels = ALL_FEATURES.filter(f => (s.features||[]).includes(f.id)).map(f => f.label);
  return `<div class="space-row ${isArchived ? 'space-row-archived' : ''}" data-openspace="${s.id}">
    <div class="space-row-main">
      <div class="space-row-name hand">${escapeHtml(s.name)}</div>
      <div class="space-row-meta">${featureLabels.length ? featureLabels.join(' · ') : 'mood board only'}</div>
    </div>
    ${ui.homeEditMode ? `<div class="cat-edit-actions">
      ${isArchived
        ? `<span class="timeline-manage-link" data-unarchivespace="${s.id}">unarchive</span>`
        : `<span class="cat-move-btn" data-spacemove="${s.id}" data-dir="up">↑</span>
           <span class="cat-move-btn" data-spacemove="${s.id}" data-dir="down">↓</span>
           <span class="timeline-manage-link" data-archivespace="${s.id}">archive</span>`}
      <span class="cat-del-icon" data-delspace="${s.id}">✕</span>
    </div>` : ''}
  </div>`;
}

export function renderHomeScreen(){
  let html = `
    <header>
      <div class="eyebrow">senior year</div>
      <div class="title">your spaces</div>
      <div class="subtitle">pick a space, or start a new one</div>
    </header>
  `;

  const tasks = getAllHomeTasks();
  if(tasks.length > 0){
    const today = new Date().toISOString().slice(0,10);
    html += `<div class="home-tasks-card">
      <div class="home-tasks-title">all tasks</div>
      <ul class="todo-list">
        ${tasks.map(t => `<li class="todo-item">
          <span class="home-task-space" data-openspace="${t.spaceId}">${escapeHtml(t.spaceName)}</span>
          <div class="todo-check" data-hometoggle="${t.spaceId}|${t.id}"></div>
          <div class="todo-text">${escapeHtml(t.text)}${t.dueDate ? ` <span class="todo-date-badge ${t.dueDate < today ? 'overdue' : ''}">${new Date(t.dueDate+'T00:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})}</span>` : ''}</div>
        </li>`).join('')}
      </ul>
    </div>`;
  }

  if(store.spaces.length === 0){
    html += `<div class="empty-hint">no spaces yet — add one below to get started</div>`;
  } else {
    const activeSpaces = store.spaces.filter(s => !s.archived);
    const archivedSpaces = store.spaces.filter(s => s.archived);

    html += `<div class="cat-edit-row"><span class="cat-edit-toggle" id="homeEditToggle">${ui.homeEditMode ? CHECK_ICON : PENCIL_ICON}</span></div>`;

    if(activeSpaces.length === 0){
      html += `<div class="empty-hint">all spaces are archived — unarchive one below, or add a new space</div>`;
    } else {
      html += `<div class="space-list">`;
      activeSpaces.forEach(s => { html += renderSpaceRow(s, false); });
      html += `</div>`;
    }

    if(archivedSpaces.length > 0){
      html += `<div class="archived-toggle-row" id="archivedToggle">
        <span>${archivedSpaces.length} archived space${archivedSpaces.length===1?'':'s'}</span>
        <span class="expand-btn" style="width:18px; height:18px; background:var(--cream);">${ui.showArchived ? CHEVRON_UP() : CHEVRON_DOWN()}</span>
      </div>`;
      if(ui.showArchived){
        html += `<div class="space-list">`;
        archivedSpaces.forEach(s => { html += renderSpaceRow(s, true); });
        html += `</div>`;
      }
    }
  }

  html += `<div class="new-cat-row">
    <span class="round-plus" id="addSpaceBtn">+</span><span style="font-size:12px; color:var(--ink-soft);">add a space</span>
  </div>`;

  if(ui.addingSpace){
    html += `<div class="modal-overlay" id="spaceModalOverlay">
      <div class="modal-box">
        <div class="modal-closerow"><span class="expand-btn" id="spaceCloseBtn">${COLLAPSE_ICON}</span></div>
        <div class="modal-title">New space</div>
        <input type="text" id="newSpaceInput" placeholder="e.g. CS 301" maxlength="30" />
        <div class="feature-check-group">
          ${ALL_FEATURES.map(f => `<label class="feature-check"><input type="checkbox" data-featurecheck="${f.id}" ${ui.newSpaceFeatures.has(f.id) ? 'checked' : ''}/> ${f.label}</label>`).join('')}
        </div>
        <div class="modal-actions">
          <button class="modal-cancel" id="spaceCancelBtn">cancel</button>
          <button class="modal-add" id="spaceAddBtn">add</button>
        </div>
      </div>
    </div>`;
  }

  return html;
}

export function attachHomeEvents(){
  document.querySelectorAll('[data-hometoggle]').forEach(el => el.onclick = () => {
    const [spaceId, taskId] = el.getAttribute('data-hometoggle').split('|');
    toggleHomeTask(spaceId, taskId);
  });

  const homeEditToggle = document.getElementById('homeEditToggle');
  if(homeEditToggle) homeEditToggle.onclick = () => { ui.homeEditMode = !ui.homeEditMode; render(); };

  const archivedToggle = document.getElementById('archivedToggle');
  if(archivedToggle) archivedToggle.onclick = () => { ui.showArchived = !ui.showArchived; render(); };

  document.querySelectorAll('[data-openspace]').forEach(el => el.onclick = (e) => {
    if(e.target.closest('[data-delspace], [data-spacemove], [data-archivespace], [data-unarchivespace]')) return;
    openSpace(el.getAttribute('data-openspace'));
  });
  document.querySelectorAll('[data-delspace]').forEach(el => el.onclick = (e) => {
    e.stopPropagation();
    deleteSpace(el.getAttribute('data-delspace'));
  });
  document.querySelectorAll('[data-spacemove]').forEach(el => el.onclick = (e) => {
    e.stopPropagation();
    moveSpace(el.getAttribute('data-spacemove'), el.getAttribute('data-dir'));
  });
  document.querySelectorAll('[data-archivespace]').forEach(el => el.onclick = (e) => {
    e.stopPropagation();
    setSpaceArchived(el.getAttribute('data-archivespace'), true);
  });
  document.querySelectorAll('[data-unarchivespace]').forEach(el => el.onclick = (e) => {
    e.stopPropagation();
    setSpaceArchived(el.getAttribute('data-unarchivespace'), false);
  });

  const addSpaceBtn = document.getElementById('addSpaceBtn');
  if(addSpaceBtn) addSpaceBtn.onclick = () => { ui.addingSpace = true; ui.newSpaceFeatures = new Set(); render(); };
  const spaceCloseBtn = document.getElementById('spaceCloseBtn');
  if(spaceCloseBtn) spaceCloseBtn.onclick = () => { ui.addingSpace = false; render(); };
  const spaceCancelBtn = document.getElementById('spaceCancelBtn');
  if(spaceCancelBtn) spaceCancelBtn.onclick = () => { ui.addingSpace = false; render(); };
  const spaceModalOverlay = document.getElementById('spaceModalOverlay');
  if(spaceModalOverlay) spaceModalOverlay.addEventListener('click', (e) => { if(e.target === spaceModalOverlay){ ui.addingSpace = false; render(); } });

  document.querySelectorAll('[data-featurecheck]').forEach(el => el.onchange = () => {
    const id = el.getAttribute('data-featurecheck');
    if(el.checked) ui.newSpaceFeatures.add(id); else ui.newSpaceFeatures.delete(id);
  });

  const spaceAddBtn = document.getElementById('spaceAddBtn');
  if(spaceAddBtn) spaceAddBtn.onclick = () => {
    const input = document.getElementById('newSpaceInput');
    const name = input ? input.value : '';
    if(!name.trim()){ input && input.focus(); return; }
    ui.addingSpace = false;
    createSpace(name, Array.from(ui.newSpaceFeatures));
  };
  const newSpaceInput = document.getElementById('newSpaceInput');
  if(newSpaceInput){
    newSpaceInput.focus();
    newSpaceInput.addEventListener('keydown', (e) => { if(e.key === 'Enter') document.getElementById('spaceAddBtn').click(); });
  }
}

export function renderCountdown(){
  const d = daysUntil(store.data.moveInDate);
  let inner;
  if(store.data.moveInDate === null){
    inner = `<div class="hand" style="font-size:18px; color:var(--ink-soft);">no move-in date set yet</div>`;
  } else if(!d.past && d.totalHours > 0){
    inner = `<div class="countdown-num">${d.days}<span style="font-size:20px;">d</span> ${d.hours}<span style="font-size:20px;">h</span></div><div class="countdown-label">until move-in</div>`;
  } else if(d.totalHours === 0){
    inner = `<div class="countdown-num hand">today!</div><div class="countdown-label">move-in day is here</div>`;
  } else {
    const agoHours = Math.abs(d.totalHours);
    const agoDays = Math.floor(agoHours/24);
    inner = `<div class="countdown-num hand">home</div><div class="countdown-label">moved in ${agoDays} day${agoDays===1?'':'s'} ago</div>`;
  }
  return `<div class="countdown-card">
    ${inner}
    <button class="countdown-editbtn" id="editDateLink" title="edit move-in date">${PENCIL_ICON}</button>
    ${ui.editingDate ? `<div class="date-editor"><input type="datetime-local" id="dateInput" value="${store.data.moveInDate || ''}" /><button id="saveDateBtn">save</button></div>` : ''}
  </div>`;
}


function formatMoveInDateTime(dateStr){
  if(!dateStr) return null;
  const [datePart, timePart] = dateStr.split('T');
  const [y, m, dd] = datePart.split('-').map(Number);
  const [hh, mm] = (timePart || '00:00').split(':').map(Number);
  const d = new Date(y, m-1, dd, hh, mm);
  const dateFmt = d.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
  const timeFmt = d.toLocaleTimeString(undefined, { hour:'numeric', minute:'2-digit' });
  return `${dateFmt}, ${timeFmt}`;
}


export function renderInfoCard(){
  const info = store.data.info || {};
  const hasBudgetData = store.data.categories.some(c => (c.items||[]).some(it => it.price)) || (store.data.quickList||[]).some(q => q.price);

  let html = `<div class="quick-access-row">
    <span class="quick-access-btn" id="infoOpenBtn">${CARD_ICON} move-in info</span>
    ${hasBudgetData ? `<span class="quick-access-btn" id="budgetOpenBtn">${RECEIPT_ICON} budget</span>` : ''}
  </div>`;

  if(ui.viewingInfo){
    const rows = [];
    const moveInFmt = formatMoveInDateTime(store.data.moveInDate);
    if(moveInFmt) rows.push(['move-in', moveInFmt]);
    if(info.unitNumber) rows.push(['unit', info.unitNumber]);
    if(info.address) rows.push(['address', info.address]);
    if(info.storageUnit) rows.push(['storage #', info.storageUnit]);
    if(info.storageCode) rows.push(['storage code', info.storageCode]);
    if(info.storageAddress) rows.push(['storage address', info.storageAddress]);

    html += `<div class="modal-overlay" id="infoViewOverlay">
      <div class="modal-box" style="padding:0; max-width:300px; background:transparent; box-shadow:none;">
        <div class="modal-closerow"><span class="expand-btn" id="infoViewCloseBtn" style="background:var(--paper);">${COLLAPSE_ICON}</span></div>
        <div class="index-card">
          <div class="index-card-band">
            <span>move-in info</span>
            <span class="index-card-editbtn" id="infoEditFromViewBtn">${PENCIL_ICON}</span>
          </div>
          <div class="index-card-body">
            ${rows.length === 0 ? `<div class="info-empty">nothing added yet — tap the pencil to fill it in</div>` : rows.map(([label,val]) => `<div class="index-card-row"><span class="index-card-label">${escapeHtml(label)}</span><span class="index-card-value">${escapeHtml(val)}</span></div>`).join('')}
          </div>
        </div>
      </div>
    </div>`;
  }

  if(ui.editingInfo){
    html += `<div class="modal-overlay" id="infoModalOverlay">
      <div class="modal-box modal-box-lg info-modal">
        <div class="modal-closerow"><span class="expand-btn" id="infoEditCloseBtn">${COLLAPSE_ICON}</span></div>
        <div class="modal-title">move-in info</div>
        <div class="info-field-label">unit number</div>
        <input type="text" id="infoUnitInput" placeholder="e.g. Apt 204" value="${escapeHtml(info.unitNumber || '')}" />
        <div class="info-field-label">address</div>
        <input type="text" id="infoAddressInput" placeholder="street, city, store.data, zip" value="${escapeHtml(info.address || '')}" />
        <div class="info-field-label">storage unit number</div>
        <input type="text" id="infoStorageUnitInput" placeholder="e.g. Unit 118" value="${escapeHtml(info.storageUnit || '')}" />
        <div class="info-field-label">storage unit code</div>
        <input type="text" id="infoStorageCodeInput" placeholder="e.g. 4471#" value="${escapeHtml(info.storageCode || '')}" />
        <div class="info-field-label">storage unit address</div>
        <input type="text" id="infoStorageAddressInput" placeholder="street, city, store.data, zip" value="${escapeHtml(info.storageAddress || '')}" />
        <div class="modal-actions" style="margin-top:14px;">
          <button class="modal-cancel" id="infoCancelBtn">cancel</button>
          <button class="modal-add" id="infoSaveBtn">save</button>
        </div>
      </div>
    </div>`;
  }

  return html;
}


export function renderBudgetModal(){
  if(!ui.budgetModalOpen) return '';

  const receiptItems = [];
  store.data.categories.forEach(cat => {
    (cat.items||[]).forEach(it => {
      const subsWithPrice = (it.subitems||[]).filter(s => s.price);
      if(subsWithPrice.length > 0){
        subsWithPrice.forEach(s => {
          receiptItems.push({name: `${it.title} — ${s.text}`, price: Number(s.price), done: !!s.done});
        });
      } else if(it.price){
        receiptItems.push({name: it.title, price: Number(it.price), done: !!it.completed});
      }
    });
  });
  (store.data.quickList||[]).forEach(q => {
    if(q.price) receiptItems.push({name: q.text, price: Number(q.price), done: !!q.done});
  });

  const totalAll = receiptItems.reduce((s,r)=>s+r.price, 0);
  const totalSpent = receiptItems.filter(r=>r.done).reduce((s,r)=>s+r.price, 0);

  return `<div class="modal-overlay" id="budgetModalOverlay">
    <div class="modal-box" style="max-width:340px; padding:0; background:transparent; box-shadow:none;">
      <div class="modal-closerow"><span class="expand-btn" id="budgetCloseBtn" style="background:var(--paper);">${COLLAPSE_ICON}</span></div>
      <div class="receipt">
        ${receiptItems.map(r => `<div class="receipt-row ${r.done?'done':''}"><span class="receipt-item">${escapeHtml(r.name)}</span><span class="receipt-dots"></span><span class="receipt-price">$${r.price.toFixed(2)}</span></div>`).join('')}
        <div class="receipt-divider"></div>
        <div class="receipt-row receipt-total"><span class="receipt-item">total planned</span><span class="receipt-dots"></span><span class="receipt-price">$${totalAll.toFixed(2)}</span></div>
        <div class="receipt-row receipt-total spent"><span class="receipt-item">spent so far</span><span class="receipt-dots"></span><span class="receipt-price">$${totalSpent.toFixed(2)}</span></div>
      </div>
    </div>
  </div>`;
}


export function renderCourseInfoCard(){
  const ci = store.data.courseInfo || {};
  const dayLabels = ['Su','M','Tu','W','Th','F','Sa'];
  const days = ci.classDays || [];

  const next = computeNextDue();
  let nextDueBadge = '';
  if(next){
    const dueLabel = new Date(next.dueDate + 'T00:00:00').toLocaleDateString(undefined, {month:'short', day:'numeric'});
    nextDueBadge = `<span class="next-due-badge" data-timelineopen="${next.id}">next due: ${escapeHtml(next.title)} · ${dueLabel}</span>`;
  }

  const importantNotes = store.data.courseImportantNotes || [];
  const importantBadges = importantNotes.map(n => `<div class="important-note-badge" data-openinfobtn="1">${WARNING_ICON()} ${escapeHtml(n)}</div>`).join('');

  let html = `<div class="quick-access-row">
    <span class="quick-access-btn" id="courseInfoOpenBtn">${CARD_ICON} course info</span>
    ${nextDueBadge}
  </div>
  ${importantBadges}`;

  if(ui.viewingCourseInfo){
    const rows = [];
    if(ci.professor) rows.push(['professor', ci.professor]);
    if(ci.professorEmail) rows.push(['email', ci.professorEmail]);
    if(ci.isAsync){
      rows.push(['format', 'asynchronous — no fixed class time']);
    } else if(days.length > 0 && (ci.classStart || ci.classEnd)){
      const dayStr = days.map(d => dayLabels[d]).join('');
      const timeStr = [ci.classStart, ci.classEnd].filter(Boolean).map(formatTime12).join(' – ');
      rows.push(['class time', `${dayStr} ${timeStr}`.trim()]);
    } else if(days.length > 0){
      rows.push(['class days', days.map(d => dayLabels[d]).join(', ')]);
    }
    if(!ci.isAsync && ci.classRoom) rows.push(['room', ci.classRoom]);
    if(ci.officeHours) rows.push(['office hrs', ci.officeHours]);

    const notes = store.data.courseNotes || '';
    const materials = store.data.courseMaterials || [];

    html += `<div class="modal-overlay" id="courseInfoViewOverlay">
      <div class="modal-box" style="padding:0; max-width:300px; background:transparent; box-shadow:none;">
        <div class="modal-closerow"><span class="expand-btn" id="courseInfoViewCloseBtn" style="background:var(--paper);">${COLLAPSE_ICON}</span></div>
        <div class="index-card">
          <div class="index-card-band">
            <span>course info</span>
            <span class="index-card-editbtn" id="courseInfoEditFromViewBtn">${PENCIL_ICON}</span>
          </div>
          <div class="index-card-body">
            ${rows.length === 0 ? `<div class="info-empty">nothing added yet — tap the pencil to fill it in</div>` : rows.map(([label,val]) => `<div class="index-card-row"><span class="index-card-label">${escapeHtml(label)}</span><span class="index-card-value">${escapeHtml(val)}${label==='email' ? ` <span class="info-copy-btn" data-copyval="${escapeHtml(val)}" title="copy email" style="display:inline-flex; vertical-align:middle; margin-left:4px;">${COPY_ICON}</span>` : ''}</span></div>`).join('')}
            ${materials.length > 0 ? `<div class="index-card-notes-toggle" id="courseMaterialsToggle">
              <span>materials</span>
              <span class="expand-btn" style="width:18px; height:18px; background:var(--cream);">${ui.courseMaterialsOpen ? CHEVRON_UP() : CHEVRON_DOWN()}</span>
            </div>
            ${ui.courseMaterialsOpen ? `<div class="index-card-notes-body"><ul class="index-card-materials-list">${materials.map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ul></div>` : ''}` : ''}
            ${notes ? `<div class="index-card-notes-toggle" id="courseNotesToggle">
              <span>notes</span>
              <span class="expand-btn" style="width:18px; height:18px; background:var(--cream);">${ui.courseNotesOpen ? CHEVRON_UP() : CHEVRON_DOWN()}</span>
            </div>
            ${ui.courseNotesOpen ? `<div class="index-card-notes-body">${escapeHtml(notes)}</div>` : ''}` : ''}
          </div>
        </div>
      </div>
    </div>`;
  }

  if(ui.editingCourseInfo){
    html += `<div class="modal-overlay" id="courseInfoModalOverlay">
      <div class="modal-box modal-box-lg info-modal">
        <div class="modal-closerow"><span class="expand-btn" id="courseInfoEditCloseBtn">${COLLAPSE_ICON}</span></div>
        <div class="modal-title">course info</div>
        <div class="info-field-label">professor</div>
        <div class="course-info-row">
          <input type="text" id="courseProfInput" placeholder="name" value="${escapeHtml(ci.professor || '')}" style="flex:1;" />
          <input type="email" id="courseProfEmailInput" placeholder="email" value="${escapeHtml(ci.professorEmail || '')}" style="flex:1;" />
        </div>
        <label class="feature-check" style="margin:10px 0 12px 0;"><input type="checkbox" id="courseAsyncCheck" ${ci.isAsync ? 'checked' : ''}/> this course is async — no fixed class time</label>
        ${!ci.isAsync ? `
        <div class="info-field-label">class time</div>
        <div class="class-days-picker" style="margin-bottom:8px;">
          ${dayLabels.map((lbl, i) => `<span class="class-day-chip ${days.includes(i) ? 'active' : ''}" data-classday="${i}">${lbl}</span>`).join('')}
        </div>
        <div class="course-info-row">
          <input type="time" id="courseStartInput" value="${ci.classStart || ''}" style="flex:1;" />
          <span style="color:var(--ink-soft); font-size:12px;">to</span>
          <input type="time" id="courseEndInput" value="${ci.classEnd || ''}" style="flex:1;" />
        </div>
        <div class="info-field-label">room</div>
        <input type="text" id="courseRoomInput" placeholder="e.g. Rm 118" value="${escapeHtml(ci.classRoom || '')}" />
        ` : ''}
        <div class="info-field-label">office hours</div>
        <input type="text" id="courseOfficeInput" placeholder="e.g. Tues 2-4pm, Rm 204" value="${escapeHtml(ci.officeHours || '')}" />
        <div class="info-field-label">important notes</div>
        <div id="importantNotesList">
          ${ui.importantNotesDraft.map((n, i) => `<div class="course-info-row" style="margin-bottom:8px;">
            <input type="text" class="important-note-draft-input" data-noteidx="${i}" placeholder="e.g. no absences allowed" maxlength="80" value="${escapeHtml(n)}" style="flex:1;" />
            <span class="cat-del-icon" data-notedel="${i}">✕</span>
          </div>`).join('')}
        </div>
        <div class="timeline-manage-link" id="addImportantNoteBtn" style="display:inline-block; margin-bottom:14px; cursor:pointer;">+ add another note</div>
        <div class="info-field-label">required materials</div>
        <div id="materialsList">
          ${ui.materialsDraft.map((m, i) => `<div class="course-info-row" style="margin-bottom:8px;">
            <input type="text" class="material-draft-input" data-materialidx="${i}" placeholder="e.g. TI-84 calculator" maxlength="80" value="${escapeHtml(m)}" style="flex:1;" />
            <span class="cat-del-icon" data-materialdel="${i}">✕</span>
          </div>`).join('')}
        </div>
        <div class="timeline-manage-link" id="addMaterialBtn" style="display:inline-block; margin-bottom:14px; cursor:pointer;">+ add another material</div>
        <div class="info-field-label">notes</div>
        <textarea class="notes-area" id="courseNotesInput" placeholder="e.g. no final for this class, or grades on a curve...">${escapeHtml(store.data.courseNotes || '')}</textarea>
        <div class="modal-actions" style="margin-top:14px;">
          <button class="modal-cancel" id="courseInfoCancelBtn">cancel</button>
          <button class="modal-add" id="courseInfoSaveBtn">save</button>
        </div>
      </div>
    </div>`;
  }

  return html;
}
function formatTime12(t){
  if(!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2,'0')}${ampm}`;
}
function WARNING_ICON(){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" style="flex-shrink:0;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`; }
function CHEVRON_UP(){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><path d="M18 15l-6-6-6 6"/></svg>`; }
function CHEVRON_DOWN(){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><path d="M6 9l6 6 6-6"/></svg>`; }

export function renderSyllabusCard(){
  const grade = computeRunningGrade();
  const progress = computeCourseProgress();
  const weights = store.data.categoryWeights || {};
  const chips = store.data.categories
    .filter(c => weights[c.id])
    .map(c => `<span class="card-badges-row-chip">${escapeHtml(c.name)} ${weights[c.id]}%</span>`)
    .join('');
  return `<div class="syllabus-card">
    <div class="syllabus-head">
      <span class="hand" style="font-size:15px;">syllabus</span>
      <span class="syllabus-grade">${grade === null ? '—' : grade.toFixed(1) + '%'}</span>
    </div>
    <div class="syllabus-progress-label">course ${progress.pct.toFixed(1)}% complete</div>
    <div class="syllabus-progress-track"><div class="syllabus-progress-fill" style="width:${progress.pct}%;"></div></div>
    ${chips ? `<div class="syllabus-chips">${chips}</div>` : `<div class="syllabus-hint">set category weights in edit mode (pencil above your categories)</div>`}
  </div>`;
}


export function renderFooter(){
  const backup = getNewestLocalBackup();
  const backupAge = backup ? new Date(backup.when).toLocaleString(undefined, {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}) : null;
  return `<footer>
    <div class="backup-row">
      <span class="backup-link" id="spaceSettingsLink">${ui.spaceSettingsOpen ? 'hide space settings' : 'space settings'}</span>
    </div>
    ${ui.spaceSettingsOpen ? `<div class="feature-check-group feature-check-group-footer">
      ${ALL_FEATURES.map(f => `<label class="feature-check"><input type="checkbox" data-featuretoggle="${f.id}" ${store.features.includes(f.id) ? 'checked' : ''}/> ${f.label}</label>`).join('')}
    </div>` : ''}
    <div class="backup-row">
      <span class="backup-link" id="backupLink">backup board</span>
      <span class="backup-link" id="restoreLink">restore from backup</span>
    </div>
    ${backup ? `<div class="backup-row"><span class="backup-link" id="localRecoverLink">recover local backup from ${backupAge}</span></div>` : ''}
    <input type="file" id="restoreFileInput" accept="application/json" style="display:none;" />
    <span class="reset-link" id="resetLink">clear this space</span>
  </footer>`;
}


export function attachChromeEvents(){
  const courseInfoOpenBtn = document.getElementById('courseInfoOpenBtn');
  if(courseInfoOpenBtn) courseInfoOpenBtn.onclick = () => { ui.viewingCourseInfo = true; render(); };
  document.querySelectorAll('[data-openinfobtn]').forEach(el => el.onclick = () => { ui.viewingCourseInfo = true; render(); });

  const courseInfoViewOverlay = document.getElementById('courseInfoViewOverlay');
  if(courseInfoViewOverlay) courseInfoViewOverlay.addEventListener('click', (e) => { if(e.target === courseInfoViewOverlay){ ui.viewingCourseInfo = false; render(); } });
  const courseInfoViewCloseBtn = document.getElementById('courseInfoViewCloseBtn');
  if(courseInfoViewCloseBtn) courseInfoViewCloseBtn.onclick = () => { ui.viewingCourseInfo = false; render(); };
  const courseNotesToggle = document.getElementById('courseNotesToggle');
  if(courseNotesToggle) courseNotesToggle.onclick = () => { ui.courseNotesOpen = !ui.courseNotesOpen; render(); };
  const courseMaterialsToggle = document.getElementById('courseMaterialsToggle');
  if(courseMaterialsToggle) courseMaterialsToggle.onclick = () => { ui.courseMaterialsOpen = !ui.courseMaterialsOpen; render(); };
  const courseInfoEditFromViewBtn = document.getElementById('courseInfoEditFromViewBtn');
  if(courseInfoEditFromViewBtn) courseInfoEditFromViewBtn.onclick = () => {
    ui.viewingCourseInfo = false;
    ui.editingCourseInfo = true;
    ui.importantNotesDraft = [...(store.data.courseImportantNotes || [])];
    ui.materialsDraft = [...(store.data.courseMaterials || [])];
    render();
  };

  const courseInfoModalOverlay = document.getElementById('courseInfoModalOverlay');
  if(courseInfoModalOverlay) courseInfoModalOverlay.addEventListener('click', (e) => { if(e.target === courseInfoModalOverlay){ ui.editingCourseInfo = false; ui.viewingCourseInfo = true; render(); } });
  const courseInfoCancelBtn = document.getElementById('courseInfoCancelBtn');
  if(courseInfoCancelBtn) courseInfoCancelBtn.onclick = () => { ui.editingCourseInfo = false; ui.viewingCourseInfo = true; render(); };
  const courseInfoEditCloseBtn = document.getElementById('courseInfoEditCloseBtn');
  if(courseInfoEditCloseBtn) courseInfoEditCloseBtn.onclick = () => { ui.editingCourseInfo = false; ui.viewingCourseInfo = true; render(); };

  document.querySelectorAll('[data-classday]').forEach(el => el.onclick = () => {
    const day = Number(el.getAttribute('data-classday'));
    const days = store.data.courseInfo.classDays || [];
    store.data.courseInfo.classDays = days.includes(day) ? days.filter(d => d !== day) : [...days, day].sort();
    render();
  });

  const courseAsyncCheck = document.getElementById('courseAsyncCheck');
  if(courseAsyncCheck) courseAsyncCheck.onchange = () => {
    // preserve whatever's currently typed before re-rendering shows/hides fields
    const profEl = document.getElementById('courseProfInput');
    const emailEl = document.getElementById('courseProfEmailInput');
    if(profEl) store.data.courseInfo.professor = profEl.value;
    if(emailEl) store.data.courseInfo.professorEmail = emailEl.value;
    store.data.courseInfo.isAsync = courseAsyncCheck.checked;
    render();
  };

  const addImportantNoteBtn = document.getElementById('addImportantNoteBtn');
  if(addImportantNoteBtn) addImportantNoteBtn.onclick = () => {
    syncImportantNotesDraft();
    ui.importantNotesDraft.push('');
    render();
  };
  document.querySelectorAll('[data-notedel]').forEach(el => el.onclick = () => {
    syncImportantNotesDraft();
    ui.importantNotesDraft.splice(Number(el.getAttribute('data-notedel')), 1);
    render();
  });
  function syncImportantNotesDraft(){
    document.querySelectorAll('.important-note-draft-input').forEach(el => {
      ui.importantNotesDraft[Number(el.getAttribute('data-noteidx'))] = el.value;
    });
  }

  const addMaterialBtn = document.getElementById('addMaterialBtn');
  if(addMaterialBtn) addMaterialBtn.onclick = () => {
    syncMaterialsDraft();
    ui.materialsDraft.push('');
    render();
  };
  document.querySelectorAll('[data-materialdel]').forEach(el => el.onclick = () => {
    syncMaterialsDraft();
    ui.materialsDraft.splice(Number(el.getAttribute('data-materialdel')), 1);
    render();
  });
  function syncMaterialsDraft(){
    document.querySelectorAll('.material-draft-input').forEach(el => {
      ui.materialsDraft[Number(el.getAttribute('data-materialidx'))] = el.value;
    });
  }

  const courseInfoSaveBtn = document.getElementById('courseInfoSaveBtn');
  if(courseInfoSaveBtn) courseInfoSaveBtn.onclick = () => {
    syncImportantNotesDraft();
    syncMaterialsDraft();
    const isAsync = document.getElementById('courseAsyncCheck').checked;
    store.data.courseInfo = {
      professor: document.getElementById('courseProfInput').value.trim(),
      professorEmail: document.getElementById('courseProfEmailInput').value.trim(),
      isAsync,
      classDays: isAsync ? [] : (store.data.courseInfo.classDays || []),
      classStart: isAsync ? '' : document.getElementById('courseStartInput').value,
      classEnd: isAsync ? '' : document.getElementById('courseEndInput').value,
      classRoom: isAsync ? '' : document.getElementById('courseRoomInput').value.trim(),
      officeHours: document.getElementById('courseOfficeInput').value.trim()
    };
    store.data.courseNotes = document.getElementById('courseNotesInput').value.trim();
    store.data.courseImportantNotes = ui.importantNotesDraft.map(n => n.trim()).filter(Boolean);
    store.data.courseMaterials = ui.materialsDraft.map(m => m.trim()).filter(Boolean);
    ui.importantNotesDraft = [];
    ui.materialsDraft = [];
    ui.editingCourseInfo = false; ui.viewingCourseInfo = true;
    render(); saveData();
  };

  const editDateLink = document.getElementById('editDateLink');
  if(editDateLink) editDateLink.onclick = () => { ui.editingDate = !ui.editingDate; render(); };
  const saveDateBtn = document.getElementById('saveDateBtn');
  if(saveDateBtn) saveDateBtn.onclick = () => {
    store.data.moveInDate = document.getElementById('dateInput').value || null;
    ui.editingDate = false; render(); saveData();
  };


  const infoOpenBtn = document.getElementById('infoOpenBtn');
  if(infoOpenBtn) infoOpenBtn.onclick = () => { ui.viewingInfo = true; render(); };

  const budgetOpenBtn = document.getElementById('budgetOpenBtn');
  if(budgetOpenBtn) budgetOpenBtn.onclick = () => { ui.budgetModalOpen = true; render(); };
  const budgetModalOverlay = document.getElementById('budgetModalOverlay');
  if(budgetModalOverlay) budgetModalOverlay.addEventListener('click', (e) => { if(e.target === budgetModalOverlay){ ui.budgetModalOpen = false; render(); } });
  const budgetCloseBtn = document.getElementById('budgetCloseBtn');
  if(budgetCloseBtn) budgetCloseBtn.onclick = () => { ui.budgetModalOpen = false; render(); };

  document.querySelectorAll('[data-copyval]').forEach(el => el.onclick = () => {
    const val = el.getAttribute('data-copyval');
    const done = () => {
      el.classList.add('copied');
      el.innerHTML = CHECK_ICON;
      setTimeout(() => { el.classList.remove('copied'); el.innerHTML = COPY_ICON; }, 1500);
    };
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(val).then(done).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = val; document.body.appendChild(ta); ta.select();
        try{ document.execCommand('copy'); }catch(e){}
        document.body.removeChild(ta);
        done();
      });
    } else {
      const ta = document.createElement('textarea');
      ta.value = val; document.body.appendChild(ta); ta.select();
      try{ document.execCommand('copy'); }catch(e){}
      document.body.removeChild(ta);
      done();
    }
  });
  const infoModalOverlay = document.getElementById('infoModalOverlay');
  if(infoModalOverlay) infoModalOverlay.addEventListener('click', (e) => { if(e.target === infoModalOverlay){ ui.editingInfo = false; ui.viewingInfo = true; render(); } });
  const infoCancelBtn = document.getElementById('infoCancelBtn');
  if(infoCancelBtn) infoCancelBtn.onclick = () => { ui.editingInfo = false; ui.viewingInfo = true; render(); };
  const infoEditCloseBtn = document.getElementById('infoEditCloseBtn');
  if(infoEditCloseBtn) infoEditCloseBtn.onclick = () => { ui.editingInfo = false; ui.viewingInfo = true; render(); };
  const infoSaveBtn = document.getElementById('infoSaveBtn');
  if(infoSaveBtn) infoSaveBtn.onclick = () => {
    store.data.info = {
      unitNumber: document.getElementById('infoUnitInput').value.trim(),
      address: document.getElementById('infoAddressInput').value.trim(),
      storageUnit: document.getElementById('infoStorageUnitInput').value.trim(),
      storageCode: document.getElementById('infoStorageCodeInput').value.trim(),
      storageAddress: document.getElementById('infoStorageAddressInput').value.trim()
    };
    ui.editingInfo = false; ui.viewingInfo = true; render(); saveData();
  };

  const infoViewOverlay = document.getElementById('infoViewOverlay');
  if(infoViewOverlay) infoViewOverlay.addEventListener('click', (e) => { if(e.target === infoViewOverlay){ ui.viewingInfo = false; render(); } });
  const infoViewCloseBtn = document.getElementById('infoViewCloseBtn');
  if(infoViewCloseBtn) infoViewCloseBtn.onclick = () => { ui.viewingInfo = false; render(); };
  const infoEditFromViewBtn = document.getElementById('infoEditFromViewBtn');
  if(infoEditFromViewBtn) infoEditFromViewBtn.onclick = () => { ui.viewingInfo = false; ui.editingInfo = true; render(); };

  const backupLink = document.getElementById('backupLink');
  if(backupLink) backupLink.onclick = () => {
    const blob = new Blob([JSON.stringify(store.data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0,10);
    a.href = url;
    a.download = `moodboard-backup-${dateStamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const restoreLink = document.getElementById('restoreLink');
  const restoreFileInput = document.getElementById('restoreFileInput');
  if(restoreLink && restoreFileInput) restoreLink.onclick = () => restoreFileInput.click();
  const localRecoverLink = document.getElementById('localRecoverLink');
  if(localRecoverLink) localRecoverLink.onclick = () => {
    const backup = getNewestLocalBackup();
    if(!backup) return;
    if(!confirm('Restore from this device\'s local backup? This replaces what\'s currently shown.')) return;
    saveLocalBackup(store.currentSpaceId, store.data);
    store.data = backup.state;
    normalizeState();
    render(); saveData(true);
  };
  if(restoreFileInput){
    restoreFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try{
          const parsed = JSON.parse(ev.target.result);
          if(!confirm('Replace your current board with this backup?')) return;
          saveLocalBackup(store.currentSpaceId, store.data);
          store.data = parsed;
          normalizeState();
          render(); saveData(true);
        }catch(err){ alert('That file could not be read as a valid backup.'); }
      };
      reader.readAsText(file);
      restoreFileInput.value = '';
    });
  }


  document.getElementById('resetLink').onclick = resetAll;

  const spaceSettingsLink = document.getElementById('spaceSettingsLink');
  if(spaceSettingsLink) spaceSettingsLink.onclick = () => { ui.spaceSettingsOpen = !ui.spaceSettingsOpen; render(); };
  document.querySelectorAll('[data-featuretoggle]').forEach(el => el.onchange = () => {
    toggleFeature(el.getAttribute('data-featuretoggle'));
  });
}
