// Course spaces get a flat, due-date-sorted timeline instead of the
// category-grid mood board — simpler and closer to how assignments
// actually get tracked. Categories still exist underneath (for the
// syllabus weights) but are just a small tag on each row here.

import { store, ui, saveData } from './store.js';
import { uid, escapeHtml, COLLAPSE_ICON, CHECK_ICON } from './shared.js';
import { render } from './app.js';

function formatDateParts(dateStr){
  const d = new Date(dateStr + 'T00:00:00');
  return [d.toLocaleDateString(undefined, {month:'short'}).toLowerCase(), d.getDate()];
}

function findAssignment(id){
  for(const cat of store.data.categories){
    const item = cat.items.find(i => i.id === id);
    if(item) return {cat, item};
  }
  return {cat:null, item:null};
}

export function renderCourseTimeline(){
  const allItems = [];
  store.data.categories.forEach(cat => {
    (cat.items || []).forEach(it => allItems.push({...it, __catId: cat.id, __catName: cat.name}));
  });
  const withDate = allItems.filter(it => it.dueDate).sort((a,b) => a.dueDate.localeCompare(b.dueDate));
  const noDate = allItems.filter(it => !it.dueDate);
  const sorted = [...withDate, ...noDate];
  const today = new Date().toISOString().slice(0,10);

  let html = `<div class="course-timeline-head">
    <span class="timeline-manage-link" id="manageCatsLink">manage categories</span>
  </div>`;

  if(sorted.length === 0){
    html += `<div class="empty-hint">nothing on the timeline yet — add your first assignment below</div>`;
  } else {
    html += `<div class="timeline-list">`;
    sorted.forEach(it => {
      const overdue = it.dueDate && !it.completed && it.dueDate < today;
      const [mon, day] = it.dueDate ? formatDateParts(it.dueDate) : ['—', ''];
      const hasScore = it.maxScore !== undefined && it.maxScore !== null && it.maxScore !== '' &&
        it.score !== undefined && it.score !== null && it.score !== '';
      html += `<div class="timeline-row ${it.completed ? 'completed' : ''}" data-timelineopen="${it.id}">
        <div class="timeline-date ${overdue ? 'overdue' : ''}">
          <div class="timeline-date-mon">${mon}</div>
          <div class="timeline-date-day">${day}</div>
        </div>
        <div class="timeline-main">
          <div class="timeline-title">${escapeHtml(it.title)}</div>
          <div class="timeline-cat">${escapeHtml(it.__catName)}</div>
        </div>
        ${hasScore
          ? `<div class="timeline-score">${it.score}/${it.maxScore}</div>`
          : `<span class="timeline-check ${it.completed ? 'checked' : ''}" data-timelinecheck="${it.id}">${it.completed ? CHECK_ICON : ''}</span>`}
      </div>`;
    });
    html += `</div>`;
  }

  html += `<div class="new-cat-row"><span class="round-plus" id="addAssignmentBtn">+</span><span style="font-size:12px; color:var(--ink-soft);">add assignment</span></div>`;

  if(ui.assignmentModalOpen && ui.assignmentDraft){
    const d = ui.assignmentDraft;
    html += `<div class="modal-overlay" id="assignmentModalOverlay">
      <div class="modal-box">
        <div class="modal-closerow"><span class="expand-btn" id="assignmentCloseBtn">${COLLAPSE_ICON}</span></div>
        <div class="modal-title">${d.id ? 'Edit assignment' : 'New assignment'}</div>
        <input type="text" id="assignTitleInput" placeholder="e.g. Problem set 4" maxlength="40" value="${escapeHtml(d.title)}" />
        <select id="assignCatSelect">
          ${store.data.categories.map(c => `<option value="${c.id}" ${d.catId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
          <option value="__new__" ${d.catId === '__new__' ? 'selected' : ''}>+ new category</option>
        </select>
        ${d.catId === '__new__' ? `<input type="text" id="assignNewCatInput" placeholder="category name" maxlength="30" value="${escapeHtml(d.newCatName)}" />` : ''}
        <input type="date" id="assignDueInput" value="${d.dueDate}" />
        <label class="feature-check" style="margin:10px 0;"><input type="checkbox" id="assignGradedCheck" ${d.graded ? 'checked' : ''}/> graded</label>
        ${d.graded ? `<div class="course-info-row" style="margin-bottom:10px;">
          <input type="number" inputmode="numeric" id="assignScoreInput" placeholder="score" maxlength="6" value="${d.score}" style="width:80px;" />
          <span style="align-self:center; color:var(--ink-soft); font-size:13px;">/</span>
          <input type="number" inputmode="numeric" id="assignMaxScoreInput" placeholder="out of" maxlength="6" value="${d.maxScore}" style="width:80px;" />
        </div>` : ''}
        <div class="modal-actions">
          ${d.id ? `<span class="cat-edit-delete" id="assignDeleteBtn">delete</span>` : ''}
          <button class="modal-cancel" id="assignCancelBtn">cancel</button>
          <button class="modal-add" id="assignSaveBtn">save</button>
        </div>
      </div>
    </div>`;
  }

  if(ui.managingCourseCats){
    html += `<div class="modal-overlay" id="manageCatsOverlay">
      <div class="modal-box">
        <div class="modal-closerow"><span class="expand-btn" id="manageCatsCloseBtn">${COLLAPSE_ICON}</span></div>
        <div class="modal-title">Categories</div>
        ${store.data.categories.length > 0 ? `<div class="manage-cat-col-labels"><span>name</span><span>weight %</span></div>` : `<div class="info-empty">no categories yet — add your first one below</div>`}
        ${store.data.categories.map(cat => `<div class="manage-cat-row">
          <input type="text" class="manage-cat-name" data-mcname="${cat.id}" value="${escapeHtml(cat.name)}" maxlength="30" />
          <input type="number" inputmode="numeric" class="manage-cat-weight" data-mcweight="${cat.id}" placeholder="—" maxlength="3" value="${store.data.categoryWeights[cat.id] || ''}" />
          <span class="cat-del-icon" data-mcdel="${cat.id}">✕</span>
        </div>`).join('')}
        <div class="manage-cat-add-section">
          <div class="info-field-label" style="margin-top:2px;">add a category</div>
          <div class="manage-cat-row">
            <input type="text" id="newCatNameInline" placeholder="e.g. quizzes" maxlength="30" />
            <input type="number" inputmode="numeric" id="newCatWeightInline" placeholder="wt %" maxlength="3" />
            <span class="round-plus" id="addCatInlineBtn">+</span>
          </div>
        </div>
      </div>
    </div>`;
  }

  return html;
}

function startAddAssignment(){
  const firstCat = store.data.categories[0];
  ui.assignmentDraft = { id: null, catId: firstCat ? firstCat.id : '__new__', newCatName: '', title: '', dueDate: '', graded: false, score: '', maxScore: '' };
  ui.assignmentModalOpen = true;
  render();
}

function startEditAssignment(item){
  ui.assignmentDraft = {
    id: item.id,
    catId: item.__catId,
    newCatName: '',
    title: item.title,
    dueDate: item.dueDate || '',
    graded: !!(item.maxScore !== undefined && item.maxScore !== null && item.maxScore !== ''),
    score: item.score !== undefined && item.score !== null ? item.score : '',
    maxScore: item.maxScore !== undefined && item.maxScore !== null ? item.maxScore : ''
  };
  ui.assignmentModalOpen = true;
  render();
}

function closeAssignmentModal(){
  ui.assignmentModalOpen = false;
  ui.assignmentDraft = null;
  render();
}

function syncAssignmentDraft(){
  const d = ui.assignmentDraft;
  const t = document.getElementById('assignTitleInput'); if(t) d.title = t.value;
  const due = document.getElementById('assignDueInput'); if(due) d.dueDate = due.value;
  const nc = document.getElementById('assignNewCatInput'); if(nc) d.newCatName = nc.value;
  const sc = document.getElementById('assignScoreInput'); if(sc) d.score = sc.value;
  const msc = document.getElementById('assignMaxScoreInput'); if(msc) d.maxScore = msc.value;
}

export function attachCourseEvents(){
  const manageCatsLink = document.getElementById('manageCatsLink');
  if(manageCatsLink) manageCatsLink.onclick = () => { ui.managingCourseCats = true; render(); };

  document.querySelectorAll('[data-timelineopen]').forEach(el => el.addEventListener('click', (e) => {
    if(e.target.closest('.timeline-check')) return;
    const {item, cat} = findAssignment(el.getAttribute('data-timelineopen'));
    if(item) startEditAssignment({...item, __catId: cat.id});
  }));

  document.querySelectorAll('[data-timelinecheck]').forEach(el => el.onclick = (e) => {
    e.stopPropagation();
    const {item} = findAssignment(el.getAttribute('data-timelinecheck'));
    if(item){ item.completed = !item.completed; render(); saveData(); }
  });

  const addAssignmentBtn = document.getElementById('addAssignmentBtn');
  if(addAssignmentBtn) addAssignmentBtn.onclick = () => startAddAssignment();

  const assignmentModalOverlay = document.getElementById('assignmentModalOverlay');
  if(assignmentModalOverlay) assignmentModalOverlay.addEventListener('click', (e) => { if(e.target === assignmentModalOverlay) closeAssignmentModal(); });
  const assignmentCloseBtn = document.getElementById('assignmentCloseBtn');
  if(assignmentCloseBtn) assignmentCloseBtn.onclick = closeAssignmentModal;
  const assignCancelBtn = document.getElementById('assignCancelBtn');
  if(assignCancelBtn) assignCancelBtn.onclick = closeAssignmentModal;

  const assignCatSelect = document.getElementById('assignCatSelect');
  if(assignCatSelect) assignCatSelect.onchange = () => { syncAssignmentDraft(); ui.assignmentDraft.catId = assignCatSelect.value; render(); };
  const assignGradedCheck = document.getElementById('assignGradedCheck');
  if(assignGradedCheck) assignGradedCheck.onchange = () => { syncAssignmentDraft(); ui.assignmentDraft.graded = assignGradedCheck.checked; render(); };

  const assignSaveBtn = document.getElementById('assignSaveBtn');
  if(assignSaveBtn) assignSaveBtn.onclick = () => {
    syncAssignmentDraft();
    const d = ui.assignmentDraft;
    let catId = d.catId;
    if(catId === '__new__'){
      const name = d.newCatName.trim();
      if(!name) return;
      const newCat = { id: uid(), name, items: [] };
      store.data.categories.push(newCat);
      catId = newCat.id;
    }
    const cat = store.data.categories.find(c => c.id === catId);
    if(!cat) return;

    const title = d.title.trim() || 'New assignment';
    const dueDate = d.dueDate || null;
    const score = d.graded && d.score !== '' ? Number(d.score) : null;
    const maxScore = d.graded && d.maxScore !== '' ? Number(d.maxScore) : null;

    if(d.id){
      const {cat: oldCat, item} = findAssignment(d.id);
      if(item){
        item.title = title; item.dueDate = dueDate; item.score = score; item.maxScore = maxScore;
        if(oldCat.id !== catId){
          oldCat.items = oldCat.items.filter(i => i.id !== d.id);
          cat.items.push(item);
        }
      }
    } else {
      cat.items.push({ id: uid(), title, notes: '', price: 0, dueDate, score, maxScore, subitems: [], links: [], images: [], completed: false });
    }
    closeAssignmentModal();
    saveData();
  };

  const assignDeleteBtn = document.getElementById('assignDeleteBtn');
  if(assignDeleteBtn) assignDeleteBtn.onclick = () => {
    if(!confirm('Delete this assignment?')) return;
    const id = ui.assignmentDraft.id;
    store.data.categories.forEach(c => { c.items = c.items.filter(i => i.id !== id); });
    closeAssignmentModal();
    saveData();
  };

  const manageCatsOverlay = document.getElementById('manageCatsOverlay');
  if(manageCatsOverlay) manageCatsOverlay.addEventListener('click', (e) => { if(e.target === manageCatsOverlay){ ui.managingCourseCats = false; render(); } });
  const manageCatsCloseBtn = document.getElementById('manageCatsCloseBtn');
  if(manageCatsCloseBtn) manageCatsCloseBtn.onclick = () => { ui.managingCourseCats = false; render(); };

  document.querySelectorAll('[data-mcname]').forEach(el => el.addEventListener('blur', () => {
    const cat = store.data.categories.find(c => c.id === el.getAttribute('data-mcname'));
    if(cat){ cat.name = el.value.trim() || cat.name; saveData(); }
  }));
  document.querySelectorAll('[data-mcweight]').forEach(el => el.addEventListener('blur', () => {
    const catId = el.getAttribute('data-mcweight');
    const val = el.value.trim();
    if(val) store.data.categoryWeights[catId] = Number(val);
    else delete store.data.categoryWeights[catId];
    saveData();
  }));
  document.querySelectorAll('[data-mcdel]').forEach(el => el.onclick = () => {
    const catId = el.getAttribute('data-mcdel');
    if(!confirm('Delete this category and its assignments?')) return;
    store.data.categories = store.data.categories.filter(c => c.id !== catId);
    delete store.data.categoryWeights[catId];
    render(); saveData();
  });

  const addCatInlineBtn = document.getElementById('addCatInlineBtn');
  if(addCatInlineBtn) addCatInlineBtn.onclick = () => {
    const nameInput = document.getElementById('newCatNameInline');
    const weightInput = document.getElementById('newCatWeightInline');
    const name = nameInput ? nameInput.value.trim() : '';
    if(!name) { nameInput && nameInput.focus(); return; }
    const newCat = { id: uid(), name, items: [] };
    store.data.categories.push(newCat);
    const weightVal = weightInput ? weightInput.value.trim() : '';
    if(weightVal) store.data.categoryWeights[newCat.id] = Number(weightVal);
    render(); saveData();
  };
  ['newCatNameInline', 'newCatWeightInline'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('keydown', (e) => { if(e.key === 'Enter'){ e.preventDefault(); document.getElementById('addCatInlineBtn').click(); } });
  });
}
