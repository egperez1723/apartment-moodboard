// The main app shell: bootstraps everything, owns the top-level render()
// and attachEvents() functions that stitch each feature module together.

import { store, ui, loadData, goHome, renameSpace, createSpace, openSpace, updateSpaceState } from './store.js';
import { escapeHtml } from './shared.js';
import { renderCountdown, renderInfoCard, renderBudgetModal, renderFooter, renderHomeScreen,
  renderCourseInfoCard, renderSyllabusCard, attachChromeEvents, attachHomeEvents } from './chrome.js';
import { renderQuickList, renderTodoList, attachListsEvents } from './lists.js';
import { renderMoodBoard, attachMoodboardEvents } from './moodboard.js';
import { renderCourseTimeline, attachCourseEvents } from './course.js';
import { renderCostumeCountdown, renderCostumes, attachCostumeEvents } from './costumes.js';
import { renderBudget as renderBudgetSpace, attachBudgetEvents, buildBudget } from './budget.js';
import { BACK_ICON } from './shared.js';

export function render(){
  const app = document.getElementById('app');

  if(!store.currentSpaceId){
    document.title = "senior yr hq";
    app.innerHTML = renderHomeScreen();
    attachHomeEvents();
    return;
  }

  document.title = store.data.title || "senior yr hq";
  const hasInfo = store.features.includes('info');
  const hasShopping = store.features.includes('shopping');
  const hasTodo = store.features.includes('todo');
  const isCourse = store.features.includes('course');
  const isCostumes = !isCourse && store.features.includes('costumes');
  const isBudget = !isCourse && !isCostumes && store.features.includes('budget');

  let html = `
    <header>
      <span class="back-to-spaces" id="backToSpacesBtn">${BACK_ICON} all spaces</span>
      <div class="eyebrow">the space for</div>
      <div class="title" contenteditable="true" id="spaceTitleInput">${escapeHtml(store.data.title)}</div>
      <div class="title-dots">• • •</div>
      <div class="subtitle">everything for this one, all in one place</div>
    </header>
  `;
  if(isCourse){
    html += renderCourseInfoCard();
    html += renderSyllabusCard();
  } else if(isCostumes){
    html += renderCostumeCountdown();
  } else if(hasInfo){
    html += renderCountdown();
    html += renderInfoCard();
    html += renderBudgetModal();
  }

  const tabs = [{id:'board', label: isCourse ? 'course board' : (isCostumes ? 'costumes' : (isBudget ? 'budget' : 'mood board'))}];
  if(hasShopping) tabs.push({id:'quick', label:'shopping list'});
  if(hasTodo) tabs.push({id:'todo', label:'stuff to do'});

  if(tabs.length > 1){
    html += `<div class="tab-bar">${tabs.map(t => `<span class="tab-btn ${ui.activeTab===t.id?'active':''}" data-tab="${t.id}">${t.label}</span>`).join('')}</div>`;
  }

  if(ui.activeTab === 'quick' && hasShopping){
    html += renderQuickList();
  } else if(ui.activeTab === 'todo' && hasTodo){
    html += renderTodoList();
  } else if(isCourse){
    html += renderCourseTimeline();
  } else if(isCostumes){
    html += renderCostumes();
  } else if(isBudget){
    html += renderBudgetSpace();
  } else {
    html += renderMoodBoard();
  }

  html += renderFooter();
  app.innerHTML = html;
  attachEvents();
}

export function attachEvents(){
  document.querySelectorAll('[data-tab]').forEach(el => el.onclick = () => {
    ui.activeTab = el.getAttribute('data-tab');
    render();
  });

  const backBtn = document.getElementById('backToSpacesBtn');
  if(backBtn) backBtn.onclick = () => goHome();

  const spaceTitleInput = document.getElementById('spaceTitleInput');
  if(spaceTitleInput){
    spaceTitleInput.addEventListener('blur', () => {
      const val = spaceTitleInput.innerText.trim();
      if(val && val !== store.data.title) renameSpace(val);
      else spaceTitleInput.innerText = store.data.title;
    });
    spaceTitleInput.addEventListener('keydown', (e) => { if(e.key === 'Enter'){ e.preventDefault(); spaceTitleInput.blur(); } });
  }

  attachChromeEvents();
  attachListsEvents();
  attachMoodboardEvents();
  attachCourseEvents();
  attachCostumeEvents();
  attachBudgetEvents();
}

loadData();

// One-tap budget setup: a link like  .../#budget-setup=<base64 json>  creates a
// pre-filled budget space (the data lives in the link, never in this repo).
function importBudgetFromHash(){
  const m = location.hash.match(/^#budget-setup=(.+)$/);
  if(!m) return;
  const token = m[1];
  try{ history.replaceState(null, '', location.pathname + location.search); }catch(e){}
  let key = 'budgetSetupDone', done = '';
  try{ done = localStorage.getItem(key) || ''; }catch(e){}
  if(done === token) return;
  let data;
  try{ data = JSON.parse(decodeURIComponent(escape(atob(token.replace(/-/g,'+').replace(/_/g,'/'))))); }catch(e){ return; }
  if(!data || !data.budget) return;
  setTimeout(() => {
    if(!confirm('Create your budget space from this setup link?')) return;
    try{ localStorage.setItem(key, token); }catch(e){}
    createSpace('Budget', ['budget'], '💰', 'sage', { budget: data.budget });
  }, 1800);
}
importBudgetFromHash();

// Budget plan update link: .../#budget-update=<base64 json>. Changes the lines, goals,
// savings buckets etc. of your existing budget space (or makes one) and keeps history.
function importBudgetUpdateFromHash(){
  const m = location.hash.match(/^#budget-update=(.+)$/);
  if(!m) return;
  const token = m[1];
  try{ history.replaceState(null, '', location.pathname + location.search); }catch(e){}
  let done = '';
  try{ done = localStorage.getItem('budgetUpdateDone') || ''; }catch(e){}
  if(done === token) return;
  let patch;
  try{ patch = JSON.parse(decodeURIComponent(escape(atob(token.replace(/-/g,'+').replace(/_/g,'/'))))); }catch(e){ return; }
  if(!patch) return;
  setTimeout(async () => {
    for(let i = 0; i < 20 && !store.spaces.length; i++) await new Promise(r => setTimeout(r, 300));
    const existing = store.spaces.find(s => (s.features || []).includes('budget') && !s.archived);
    if(!confirm(existing ? 'Update your budget plan from this link? Your logged history stays.' : 'No budget space found. Create one from this link?')) return;
    try{ localStorage.setItem('budgetUpdateDone', token); }catch(e){}
    try{
      if(existing){
        await updateSpaceState(existing.id, st => { st.budget = buildBudget(st.budget, patch); });
        openSpace(existing.id);
        alert('Budget plan updated!');
      } else {
        createSpace('Budget', ['budget'], '💰', 'sage', { budget: buildBudget(null, patch) });
      }
    }catch(e){
      console.error('budget update failed', e);
      try{ localStorage.removeItem('budgetUpdateDone'); }catch(_){}
      alert('Could not update the budget (' + (e.message || 'unknown error') + '). Check your connection and open the link again.');
    }
  }, 2200);
}
importBudgetUpdateFromHash();

// Add-tasks link: .../#todo-add=<base64 json {space, tasks:[{text, dueDate}]}>. Appends to the
// named space's "stuff to do" list (creating the space if needed) and skips tasks already there.
function importTodosFromHash(){
  const m = location.hash.match(/^#todo-add=(.+)$/);
  if(!m) return;
  const token = m[1];
  try{ history.replaceState(null, '', location.pathname + location.search); }catch(e){}
  let done = '';
  try{ done = localStorage.getItem('todoAddDone') || ''; }catch(e){}
  if(done === token) return;
  let data;
  try{ data = JSON.parse(decodeURIComponent(escape(atob(token.replace(/-/g,'+').replace(/_/g,'/'))))); }catch(e){ return; }
  if(!data || !Array.isArray(data.tasks)) return;
  const name = data.space || 'School';
  const mk = (t, i) => ({ id: 'todo' + Date.now().toString(36) + i, text: String(t.text).slice(0, 80), done: false, dueDate: t.dueDate || '' });
  const merge = list => {
    const have = new Set(list.map(x => x.text));
    data.tasks.map(mk).forEach(t => { if(!have.has(t.text)) list.push(t); });
    return list;
  };
  setTimeout(async () => {
    for(let i = 0; i < 20 && !store.spaces.length; i++) await new Promise(r => setTimeout(r, 300));
    const existing = store.spaces.find(s => s.name === name && (s.features || []).includes('todo') && !s.archived);
    if(!confirm(`Add ${data.tasks.length} task(s) to "${name}"?`)) return;
    try{ localStorage.setItem('todoAddDone', token); }catch(e){}
    try{
      if(existing){
        await updateSpaceState(existing.id, st => { st.todoList = merge(st.todoList || []); });
        openSpace(existing.id);
      } else {
        createSpace(name, ['todo'], '🔔', 'sage', { todoList: merge([]) });
      }
    }catch(e){
      console.error('todo add failed', e);
      try{ localStorage.removeItem('todoAddDone'); }catch(_){}
      alert('Could not add tasks (' + (e.message || 'unknown error') + '). Open the link again.');
    }
  }, 2200);
}
importTodosFromHash();
