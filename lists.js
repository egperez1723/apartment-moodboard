// Shopping list and "stuff to do" tabs — simple checklists, separate from
// the mood board's richer cards.

import { store, ui, saveData } from './store.js';
import { uid, escapeHtml, CHECK_ICON, CALENDAR_ICON } from './shared.js';
import { render } from './app.js';

export function renderQuickList(){
  const list = store.data.quickList || [];
  const totalAll = list.reduce((sum, q) => sum + (Number(q.price) || 0), 0);
  const totalSpent = list.filter(q => q.done).reduce((sum, q) => sum + (Number(q.price) || 0), 0);

  let html = `<div class="quick-section">
    <div class="quick-title">shopping list</div>
    <div class="quick-subtitle">stuff you realize you need on the go</div>`;

  if(totalAll > 0){
    html += `<div class="budget-summary">
      <div class="budget-stat"><span class="budget-label">planned</span><span class="budget-amt">$${totalAll.toFixed(2)}</span></div>
      <div class="budget-stat"><span class="budget-label">spent</span><span class="budget-amt spent">$${totalSpent.toFixed(2)}</span></div>
    </div>`;
  }

  if(list.length > 0){
    html += `<ul class="quick-list">
      ${list.map(q => ui.editingQuickId === q.id ? `<li class="quick-item quick-item-edit">
        <input type="text" id="quickEditText" class="quick-edit-input" value="${escapeHtml(q.text)}" maxlength="60" data-id="${q.id}" />
        <input type="text" inputmode="decimal" id="quickEditPrice" class="quick-edit-price" placeholder="$" value="${q.price ? q.price : ''}" />
        <span class="mini-plus" data-quickeditconfirm="${q.id}">${CHECK_ICON}</span>
      </li>` : `<li class="quick-item">
        <div class="quick-check ${q.done?'done':''}" data-qtoggle="${q.id}"></div>
        <div class="quick-text ${q.done?'done':''}" data-quickeditstart="${q.id}">${escapeHtml(q.text)}${q.price ? ` <span class="quick-price">$${Number(q.price).toFixed(2)}</span>` : ''}</div>
        <span class="quick-del" data-qdel="${q.id}">✕</span>
      </li>`).join('')}
    </ul>`;
  }

  html += `<div class="quick-add-row">
    <input type="text" id="quickAddInput" placeholder="e.g. more hangers…" maxlength="60" />
    <span class="round-plus" id="quickAddBtn">+</span>
  </div></div>`;

  return html;
}


function formatTodoDate(dateStr){
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, {month:'short', day:'numeric'});
}

export function renderTodoList(){
  const list = store.data.todoList || [];
  const withDate = [...list].filter(t => t.dueDate).sort((a,b) => a.dueDate.localeCompare(b.dueDate));
  const noDate = list.filter(t => !t.dueDate);
  const sorted = [...withDate, ...noDate];
  const today = new Date().toISOString().slice(0,10);

  let html = `<div class="todo-section">
    <div class="todo-title">stuff to do</div>
    <div class="todo-subtitle">tasks to take care of</div>`;

  if(sorted.length > 0){
    html += `<ul class="todo-list">
      ${sorted.map(t => ui.editingTodoId === t.id ? `<li class="todo-item todo-item-edit">
        <input type="text" id="todoEditText" class="quick-edit-input" value="${escapeHtml(t.text)}" maxlength="80" data-id="${t.id}" />
        <input type="date" id="todoEditDate" class="todo-edit-date" value="${t.dueDate || ''}" />
        <span class="mini-plus" data-todoeditconfirm="${t.id}">${CHECK_ICON}</span>
      </li>` : `<li class="todo-item">
        <div class="todo-check ${t.done?'done':''}" data-ttoggle="${t.id}"></div>
        <div class="todo-text ${t.done?'done':''}" data-ttoggle="${t.id}">${escapeHtml(t.text)}${t.dueDate ? ` <span class="todo-date-badge ${!t.done && t.dueDate < today ? 'overdue' : ''}">${formatTodoDate(t.dueDate)}</span>` : ''}</div>
        <span class="todo-cal" data-todoeditstart="${t.id}">${CALENDAR_ICON}</span>
        <span class="todo-del" data-tdel="${t.id}">✕</span>
      </li>`).join('')}
    </ul>`;
  }

  html += `<div class="todo-add-row">
    <input type="text" id="todoAddInput" placeholder="e.g. set up renters insurance…" maxlength="80" />
    <span class="round-plus" id="todoAddBtn">+</span>
  </div></div>`;

  return html;
}


export function attachListsEvents(){
  document.querySelectorAll('[data-qtoggle]').forEach(el => el.onclick = () => {
    const q = store.data.quickList.find(x => x.id === el.getAttribute('data-qtoggle'));
    if(q){
      q.done = !q.done;
      if(q.done && !q.price){ ui.editingQuickId = q.id; }
      render(); saveData();
    }
  });
  document.querySelectorAll('[data-qdel]').forEach(el => el.onclick = () => {
    store.data.quickList = store.data.quickList.filter(x => x.id !== el.getAttribute('data-qdel'));
    render(); saveData();
  });
  document.querySelectorAll('[data-quickeditstart]').forEach(el => el.onclick = () => {
    ui.editingQuickId = el.getAttribute('data-quickeditstart');
    render();
  });
  function confirmQuickEdit(){
    const textInput = document.getElementById('quickEditText');
    const priceInput = document.getElementById('quickEditPrice');
    if(!textInput) return;
    const id = textInput.getAttribute('data-id');
    const q = store.data.quickList.find(x => x.id === id);
    const text = textInput.value.trim();
    if(q && text){
      q.text = text;
      const priceVal = priceInput.value.trim();
      q.price = priceVal ? parseFloat(priceVal) || 0 : 0;
    }
    ui.editingQuickId = null;
    render(); saveData();
  }
  document.querySelectorAll('[data-quickeditconfirm]').forEach(el => el.onclick = confirmQuickEdit);
  const quickEditText = document.getElementById('quickEditText');
  const quickEditPrice = document.getElementById('quickEditPrice');
  if(quickEditText){
    const editingItem = store.data.quickList.find(x => x.id === ui.editingQuickId);
    if(editingItem && editingItem.done && !editingItem.price && quickEditPrice){
      quickEditPrice.focus();
      quickEditPrice.select();
    } else {
      quickEditText.focus();
      quickEditText.select();
    }
    quickEditText.addEventListener('keydown', e => {
      if(e.key==='Enter') confirmQuickEdit();
      if(e.key==='Escape'){ ui.editingQuickId=null; render(); }
    });
  }
  if(quickEditPrice) quickEditPrice.addEventListener('keydown', e => { if(e.key==='Enter') confirmQuickEdit(); if(e.key==='Escape'){ ui.editingQuickId=null; render(); } });

  function quickItemHtml(item){
    return `<div class="quick-check ${item.done?'done':''}" data-qtoggle="${item.id}"></div><div class="quick-text ${item.done?'done':''}" data-quickeditstart="${item.id}">${escapeHtml(item.text)}${item.price ? ` <span class="quick-price">$${Number(item.price).toFixed(2)}</span>` : ''}</div><span class="quick-del" data-qdel="${item.id}">✕</span>`;
  }
  function wireQuickItem(li, item){
    li.querySelector('[data-qtoggle].quick-check').onclick = () => {
      item.done = !item.done;
      if(item.done && !item.price){ ui.editingQuickId = item.id; }
      render(); saveData();
    };
    li.querySelector('[data-quickeditstart]').onclick = () => { ui.editingQuickId = item.id; render(); };
    li.querySelector('.quick-del').onclick = () => {
      store.data.quickList = store.data.quickList.filter(x => x.id !== item.id);
      render(); saveData();
    };
  }
  function updateQuickBudgetSummary(){
    const list = store.data.quickList || [];
    const totalAll = list.reduce((sum,q)=>sum+(Number(q.price)||0),0);
    const totalSpent = list.filter(q=>q.done).reduce((sum,q)=>sum+(Number(q.price)||0),0);
    const section = document.querySelector('.quick-section');
    if(!section) return;
    let summary = section.querySelector('.budget-summary');
    if(totalAll > 0){
      if(!summary){
        summary = document.createElement('div');
        summary.className = 'budget-summary';
        const subtitle = section.querySelector('.quick-subtitle');
        if(subtitle) subtitle.insertAdjacentElement('afterend', summary);
      }
      summary.innerHTML = `<div class="budget-stat"><span class="budget-label">planned</span><span class="budget-amt">$${totalAll.toFixed(2)}</span></div><div class="budget-stat"><span class="budget-label">spent</span><span class="budget-amt spent">$${totalSpent.toFixed(2)}</span></div>`;
    } else if(summary){
      summary.remove();
    }
  }
  function addQuickItem(){
    const input = document.getElementById('quickAddInput');
    const text = input.value.trim();
    if(!text) return;
    const item = {id: uid(), text, done:false, price: 0};
    store.data.quickList.push(item);
    saveData();

    let list = document.querySelector('.quick-list');
    if(!list){
      const section = document.querySelector('.quick-section');
      list = document.createElement('ul');
      list.className = 'quick-list';
      section.insertBefore(list, section.querySelector('.quick-add-row'));
    }
    const li = document.createElement('li');
    li.className = 'quick-item';
    li.innerHTML = quickItemHtml(item);
    list.appendChild(li);
    wireQuickItem(li, item);
    updateQuickBudgetSummary();

    input.value = '';
    input.focus();
  }
  const quickAddBtn = document.getElementById('quickAddBtn');
  if(quickAddBtn) quickAddBtn.onclick = addQuickItem;
  const quickAddInput = document.getElementById('quickAddInput');
  if(quickAddInput) quickAddInput.addEventListener('keydown', e => { if(e.key==='Enter') addQuickItem(); });


  document.querySelectorAll('[data-ttoggle]').forEach(el => el.onclick = () => {
    const t = store.data.todoList.find(x => x.id === el.getAttribute('data-ttoggle'));
    if(t){ t.done = !t.done; render(); saveData(); }
  });
  document.querySelectorAll('[data-tdel]').forEach(el => el.onclick = () => {
    store.data.todoList = store.data.todoList.filter(x => x.id !== el.getAttribute('data-tdel'));
    render(); saveData();
  });
  document.querySelectorAll('[data-todoeditstart]').forEach(el => el.onclick = () => {
    ui.editingTodoId = el.getAttribute('data-todoeditstart');
    render();
  });
  function confirmTodoEdit(){
    const textInput = document.getElementById('todoEditText');
    const dateInput = document.getElementById('todoEditDate');
    if(!textInput) return;
    const id = textInput.getAttribute('data-id');
    const t = store.data.todoList.find(x => x.id === id);
    const text = textInput.value.trim();
    if(t && text){
      t.text = text;
      t.dueDate = dateInput.value || null;
    }
    ui.editingTodoId = null;
    render(); saveData();
  }
  document.querySelectorAll('[data-todoeditconfirm]').forEach(el => el.onclick = confirmTodoEdit);
  const todoEditText = document.getElementById('todoEditText');
  const todoEditDate = document.getElementById('todoEditDate');
  if(todoEditText){
    todoEditText.focus();
    todoEditText.select();
    todoEditText.addEventListener('keydown', e => {
      if(e.key==='Enter') confirmTodoEdit();
      if(e.key==='Escape'){ ui.editingTodoId=null; render(); }
    });
  }
  if(todoEditDate) todoEditDate.addEventListener('keydown', e => { if(e.key==='Enter') confirmTodoEdit(); if(e.key==='Escape'){ ui.editingTodoId=null; render(); } });

  function addTodoItem(){
    const input = document.getElementById('todoAddInput');
    const text = input.value.trim();
    if(!text) return;
    store.data.todoList.push({id: uid(), text, done:false, dueDate: null});
    render(); saveData();
    document.getElementById('todoAddInput').focus();
  }
  const todoAddBtn = document.getElementById('todoAddBtn');
  if(todoAddBtn) todoAddBtn.onclick = addTodoItem;
  const todoAddInput = document.getElementById('todoAddInput');
  if(todoAddInput) todoAddInput.addEventListener('keydown', e => { if(e.key==='Enter') addTodoItem(); });
}
