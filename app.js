// The main app shell: bootstraps everything, owns the top-level render()
// and attachEvents() functions that stitch each feature module together.

import { store, ui, loadData } from './store.js';
import { escapeHtml } from './shared.js';
import { renderCountdown, renderInfoCard, renderBudgetModal, renderFooter, attachChromeEvents } from './chrome.js';
import { renderQuickList, renderTodoList, attachListsEvents } from './lists.js';
import { renderMoodBoard, attachMoodboardEvents } from './moodboard.js';

export function render(){
  const app = document.getElementById('app');
  document.title = store.data.title || "senior yr hq";
  let html = `
    <header>
      <div class="eyebrow">the mood board for</div>
      <div class="title">${escapeHtml(store.data.title)}</div>
      <div class="title-dots">• • •</div>
      <div class="subtitle">everything I'm dreaming up before the big move</div>
    </header>
  `;
  html += renderCountdown();
  html += renderInfoCard();
  html += renderBudgetModal();
  html += `<div class="tab-bar">    <span class="tab-btn ${ui.activeTab==='board'?'active':''}" data-tab="board">mood board</span>
    <span class="tab-btn ${ui.activeTab==='quick'?'active':''}" data-tab="quick">shopping list</span>
    <span class="tab-btn ${ui.activeTab==='todo'?'active':''}" data-tab="todo">stuff to do</span>
  </div>`;

  if(ui.activeTab === 'quick' || ui.activeTab === 'todo'){
    html += ui.activeTab === 'quick' ? renderQuickList() : renderTodoList();
    html += renderFooter();
    app.innerHTML = html;
    attachEvents();
    return;
  }


  html += renderMoodBoard();

  app.innerHTML = html;
  attachEvents();
}

export function attachEvents(){
  document.querySelectorAll('[data-tab]').forEach(el => el.onclick = () => {
    ui.activeTab = el.getAttribute('data-tab');
    render();
  });


  attachChromeEvents();
  attachListsEvents();
  attachMoodboardEvents();
}

loadData();
