// The main app shell: bootstraps everything, owns the top-level render()
// and attachEvents() functions that stitch each feature module together.

import { store, ui, loadData, goHome, renameSpace, createSpace } from './store.js';
import { escapeHtml } from './shared.js';
import { renderCountdown, renderInfoCard, renderBudgetModal, renderFooter, renderHomeScreen,
  renderCourseInfoCard, renderSyllabusCard, attachChromeEvents, attachHomeEvents } from './chrome.js';
import { renderQuickList, renderTodoList, attachListsEvents } from './lists.js';
import { renderMoodBoard, attachMoodboardEvents } from './moodboard.js';
import { renderCourseTimeline, attachCourseEvents } from './course.js';
import { renderCostumeCountdown, renderCostumes, attachCostumeEvents } from './costumes.js';
import { renderBudget as renderBudgetSpace, attachBudgetEvents } from './budget.js';
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
