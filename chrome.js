// The countdown card, move-in info popup, budget tracker popup, and footer
// (backup/restore/reset). Small, mostly self-contained UI pieces.

import { store, ui, saveLocalBackup, getNewestLocalBackup, resetAll, saveData, normalizeState } from './store.js';
import { escapeHtml, daysUntil, PENCIL_ICON, COLLAPSE_ICON, CHECK_ICON, COPY_ICON, RECEIPT_ICON, CARD_ICON } from './shared.js';
import { render } from './app.js';

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


export function renderFooter(){
  const backup = getNewestLocalBackup();
  const backupAge = backup ? new Date(backup.when).toLocaleString(undefined, {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}) : null;
  return `<footer>
    <div class="backup-row">
      <span class="backup-link" id="backupLink">backup board</span>
      <span class="backup-link" id="restoreLink">restore from backup</span>
    </div>
    ${backup ? `<div class="backup-row"><span class="backup-link" id="localRecoverLink">recover local backup from ${backupAge}</span></div>` : ''}
    <input type="file" id="restoreFileInput" accept="application/json" style="display:none;" />
    <span class="reset-link" id="resetLink">clear the whole board</span>
  </footer>`;
}


export function attachChromeEvents(){
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
    saveLocalBackup(store.data);
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
          saveLocalBackup(store.data);
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
}
