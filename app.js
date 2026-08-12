// The main app shell: bootstraps everything, owns the top-level render()
// and attachEvents() functions that stitch each feature module together.

import { store, ui, loadData, goHome, renameSpace } from './store.js';
import { escapeHtml } from './shared.js';
import { renderCountdown, renderInfoCard, renderBudgetModal, renderFooter, renderHomeScreen,
  renderCourseInfoCard, renderSyllabusCard, attachChromeEvents, attachHomeEvents } from './chrome.js';
import { renderQuickList, renderTodoList, attachListsEvents } from './lists.js';
import { renderMoodBoard, attachMoodboardEvents } from './moodboard.js';
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
  } else if(hasInfo){
    html += renderCountdown();
    html += renderInfoCard();
    html += renderBudgetModal();
  }

  const tabs = [{id:'board', label: isCourse ? 'assignments' : 'mood board'}];
  if(hasShopping) tabs.push({id:'quick', label:'shopping list'});
  if(hasTodo) tabs.push({id:'todo', label:'stuff to do'});

  if(tabs.length > 1){
    html += `<div class="tab-bar">${tabs.map(t => `<span class="tab-btn ${ui.activeTab===t.id?'active':''}" data-tab="${t.id}">${t.label}</span>`).join('')}</div>`;
  }

  if(ui.activeTab === 'quick' && hasShopping){
    html += renderQuickList();
  } else if(ui.activeTab === 'todo' && hasTodo){
    html += renderTodoList();
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
}

loadData();
