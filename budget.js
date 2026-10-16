// Weekly budget spaces (feature id "budget").
//
// How it works:
//  - You log work as you finish it (hours + what you made, or a full/half day).
//  - Money only counts once it's actually deposited: on payday you enter the
//    deposit and the app shows how to split it (taxes first, then must-pays,
//    savings, then everyday and flexible spending) before you save.
//  - Purchases come off each line's weekly limit.
//  - When a new week starts, last week's leftover shows up as a reminder to
//    move it to savings.
//
// Nothing personal is hard-coded here (this repo is public): income sources,
// pay days, tax %, and budget lines all start empty/generic and are filled
// in from "my plan", then saved with the space.
//
// Data (store.data.budget):
//   sources   two income sources: {id, name, mode:'hours'|'days', payDay, taxPct, ...}
//   lines     budget lines: {id, name, target (per week), group}
//   income    deposits: {id, src, amt, tax, parts:{lineId:amt}, extra, date, paidIds, ts}
//   purchases {id, line, amt, note, date, ts}
//   work      {id, src, type:'shift'|'full'|'half', hours, amt, date, paid, ts}
//   moves     leftover moved to savings: {id, week, dest, amt, date}
//   wishlist  things to buy later: {id, name, url, price, got, ts}
//   goals     savings goals with a progress bar: {id, name, total, due, paid, lineId} (lineId = the weekly savings line that feeds it)
//   buckets   money set aside that isn't touched: {id, name, balance, locked}
//   cushion   minimum to keep in checking
// Weeks run Sunday to Saturday, in local time.

import { store, ui, saveData } from './store.js';
import { uid, escapeHtml, PENCIL_ICON, COLLAPSE_ICON } from './shared.js';
import { render } from './app.js';

export const GROUPS = [
  { id: 'must', label: 'must-pay' },
  { id: 'save', label: 'savings' },
  { id: 'spend', label: 'everyday' },
  { id: 'flex', label: 'flexible' }
];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function defaultBudget(){
  return {
    sources: [
      { id: 's1', name: 'Hourly job', mode: 'hours', payDay: 3, taxPct: 0, hoursGoal: 0 },
      { id: 's2', name: 'Day pay', mode: 'days', payDay: 5, taxPct: 0, full: 0, half: 0 }
    ],
    weeklyGoal: 0,
    lines: [],
    income: [], purchases: [], work: [], moves: []
  };
}
// Re-split a week's deposits across the current lines (priority order), keeping each deposit's tax.
// Needed when the plan changes after money was already split under the old lines.
function reflowWeek(b, ws){
  const order = GROUPS.flatMap(g => b.lines.filter(l => l.group === g.id));
  const inc = b.income.filter(e => weekStart(e.date) === ws).sort((x, y) => (x.ts || 0) - (y.ts || 0) || x.date.localeCompare(y.date));
  const funded = {};
  inc.forEach(e => {
    let left = r2((Number(e.amt) || 0) - (Number(e.tax) || 0));
    const parts = {};
    order.forEach(l => {
      const need = r2((Number(l.target) || 0) - (funded[l.id] || 0));
      if(need <= 0 || left <= 0) return;
      const give = r2(Math.min(need, left));
      parts[l.id] = give; funded[l.id] = r2((funded[l.id] || 0) + give); left = r2(left - give);
    });
    e.parts = parts; e.extra = left;
  });
}
function healIncome(b){
  const ids = new Set(b.lines.map(l => l.id)), bad = new Set();
  b.income.forEach(e => { if(Object.keys(e.parts || {}).some(id => !ids.has(id))) bad.add(weekStart(e.date)); });
  bad.forEach(ws => reflowWeek(b, ws));
}
function B(){
  if(!store.data.budget) store.data.budget = defaultBudget();
  const b = store.data.budget;
  ['lines', 'income', 'purchases', 'work', 'moves', 'wishlist', 'goals', 'buckets'].forEach(k => { if(!Array.isArray(b[k])) b[k] = []; });
  if(!Array.isArray(b.sources) || b.sources.length === 0) b.sources = defaultBudget().sources;
  if(typeof b.weeklyGoal !== 'number') b.weeklyGoal = 0;
  if(typeof b.cushion !== 'number') b.cushion = 0;
  if(b.lines.length && b.income.length) healIncome(b);
  return b;
}
function BD(){
  if(!ui.bd) ui.bd = { wOpt: 0, wHours: '', wMade: '', wDate: '', iSrc: null, iAmt: '', pAmt: '', pLine: '', pNote: '', xName: '', xUrl: '', xPrice: '', preview: null, openWeek: null, err: {}, scroll: null };
  return ui.bd;
}

// Apply a settings patch (from a setup/update link) to a budget, keeping history.
// Lines and goals are matched by name so funded history stays attached.
export function buildBudget(existing, patch){
  const b = existing ? JSON.parse(JSON.stringify(existing)) : defaultBudget();
  ['lines', 'income', 'purchases', 'work', 'moves', 'wishlist', 'goals', 'buckets'].forEach(k => { if(!Array.isArray(b[k])) b[k] = []; });
  if(!Array.isArray(b.sources) || !b.sources.length) b.sources = defaultBudget().sources;
  const key = x => (x || '').trim().toLowerCase();
  (patch.sources || []).forEach(ps => {
    let s = b.sources.find(x => key(x.name) === key(ps.name)) || b.sources.find(x => x.mode === ps.mode && /^(hourly job|day pay)$/i.test(x.name));
    if(s) Object.assign(s, ps);
  });
  if(patch.lines){
    const old = b.lines;
    b.lines = patch.lines.map(l => { const o = old.find(x => key(x.name) === key(l.name)); return { id: o ? o.id : uid(), name: l.name, target: Number(l.target) || 0, group: l.group || 'spend' }; });
  }
  const lineId = name => { const l = b.lines.find(x => key(x.name) === key(name)); return l ? l.id : ''; };
  if(patch.goals) b.goals = patch.goals.map(g => { const o = b.goals.find(x => key(x.name) === key(g.name)); return { id: o ? o.id : uid(), name: g.name, total: Number(g.total) || 0, due: g.due || '', paid: Number(g.paid) || 0, lineId: lineId(g.line) }; });
  if(patch.buckets) b.buckets = patch.buckets.map(k => { const o = b.buckets.find(x => key(x.name) === key(k.name)); return { id: o ? o.id : uid(), name: k.name, balance: Number(k.balance) || 0, locked: !!k.locked }; });
  if(patch.cushion !== undefined) b.cushion = Number(patch.cushion) || 0;
  if(patch.lines) healIncome(b);
  if(patch.weeklyGoal !== undefined) b.weeklyGoal = Number(patch.weeklyGoal) || 0;
  return b;
}

// ---------- small helpers ----------
const r2 = n => Math.round(n * 100) / 100;
const money = n => '$' + (Math.abs(n - Math.round(n)) < 0.005 ? String(Math.round(n)) : r2(n).toFixed(2));
const attr = s => escapeHtml(s).replace(/"/g, '&quot;');
const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export function todayStr(){ return ui.budgetToday || ymd(new Date()); }
const addDays = (s, n) => { const d = parseDay(s); d.setDate(d.getDate() + n); return ymd(d); };
const weekStart = s => { const d = parseDay(s); d.setDate(d.getDate() - d.getDay()); return ymd(d); };
const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 86400000);
function weekLabel(ws){
  const a = parseDay(ws), b = parseDay(addDays(ws, 6));
  const mo = d => d.toLocaleDateString(undefined, { month: 'short' });
  return a.getMonth() === b.getMonth() ? `${mo(a)} ${a.getDate()} – ${b.getDate()}` : `${mo(a)} ${a.getDate()} – ${mo(b)} ${b.getDate()}`;
}
const dayLabel = s => parseDay(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

function orderedLines(){
  const lines = B().lines;
  return GROUPS.flatMap(g => lines.filter(l => l.group === g.id));
}
const lineById = id => B().lines.find(l => l.id === id);
const planTotal = () => r2(B().lines.reduce((s, l) => s + (Number(l.target) || 0), 0));
const srcById = id => B().sources.find(s => s.id === id);
const inWeek = (e, ws) => weekStart(e.date) === ws;
const sum = (list, f) => r2(list.reduce((s, x) => s + f(x), 0));

// ---------- money math ----------
function fundedFor(ws){
  const f = {};
  B().income.filter(e => inWeek(e, ws)).forEach(e => Object.entries(e.parts || {}).forEach(([id, a]) => { f[id] = r2((f[id] || 0) + a); }));
  return f;
}
// Pure: how a deposit would be split given what this week has already funded.
function allocate(amt, src, ws){
  const tax = r2(amt * (Number(src.taxPct) || 0) / 100);
  let left = r2(amt - tax);
  const funded = fundedFor(ws);
  const parts = {};
  for(const l of orderedLines()){
    const need = r2((Number(l.target) || 0) - (funded[l.id] || 0));
    if(need <= 0 || left <= 0) continue;
    const give = r2(Math.min(need, left));
    parts[l.id] = give;
    left = r2(left - give);
  }
  return { tax, parts, extra: left };
}
// leftover = deposits after taxes, minus what went to savings lines, minus what was spent
function weekSummary(ws){
  const inc = B().income.filter(e => inWeek(e, ws));
  const gross = sum(inc, e => e.amt), tax = sum(inc, e => e.tax || 0);
  const saved = sum(inc, e => Object.entries(e.parts || {}).reduce((s, [id, a]) => { const l = lineById(id); return s + (l && l.group === 'save' ? a : 0); }, 0));
  const buys = B().purchases.filter(p => inWeek(p, ws));
  const spent = sum(buys, p => p.amt);
  return { gross, tax, saved, spent, leftover: r2(gross - tax - saved - spent), buys };
}
function pastWeekStarts(){
  const cur = weekStart(todayStr());
  const set = new Set();
  const b = B();
  [...b.income, ...b.purchases, ...b.work].forEach(e => { const ws = weekStart(e.date); if(ws < cur) set.add(ws); });
  return Array.from(set).sort().reverse().slice(0, 12);
}
const moveFor = ws => B().moves.find(m => m.week === ws);
function nextToMove(){
  return pastWeekStarts().find(ws => !moveFor(ws) && weekSummary(ws).leftover > 0.004) || null;
}
// Money that's free right now: last weeks' leftover you haven't moved yet,
// plus anything this week's deposits covered beyond the plan.
function spareMoney(){
  const unmoved = sum(pastWeekStarts().filter(ws => !moveFor(ws)), ws => Math.max(0, weekSummary(ws).leftover));
  const extra = sum(B().income.filter(e => inWeek(e, weekStart(todayStr()))), e => e.extra || 0);
  return r2(unmoved + extra);
}
function saveDestinations(){
  return [...B().lines.filter(l => l.group === 'save').map(l => l.name), 'General savings'];
}

// ---------- work + paydays ----------
const unpaidWork = srcId => B().work.filter(w => w.src === srcId && !w.paid);
const workPay = list => sum(list, w => w.amt);
function lastPayday(dow, today){ return addDays(today, -((parseDay(today).getDay() - dow + 7) % 7)); }
function nextPayday(dow, today){ return addDays(today, (dow - parseDay(today).getDay() + 7) % 7); }
// Which payday a deposit entered today belongs to: the one just passed (within 2 days),
// otherwise the one coming up if it's within 2 days (paid early), otherwise the last one.
function payDateFor(s, today){
  const last = lastPayday(s.payDay, today), next = nextPayday(s.payDay, today);
  if(daysBetween(last, today) <= 2) return last;
  if(daysBetween(today, next) <= 2) return next;
  return last;
}
// days between a shift and the payday that includes it (1 = paid the next time payday comes around;
// e.g. 12 = a shift on Sunday the 4th is paid on Friday the 16th)
const holdOf = s => (s.holdDays === undefined || s.holdDays === null || s.holdDays === '') ? 1 : Number(s.holdDays);
// unpaid shifts that a payday on `payDate` would cover
const payableOn = (s, payDate) => unpaidWork(s.id).filter(w => w.date <= addDays(payDate, -holdOf(s)));
function paydayPrompts(){
  const today = todayStr();
  return B().sources.map(s => {
    const d = lastPayday(s.payDay, today);
    if(daysBetween(d, today) > 2) return null;       // payday + 2 days of grace
    const amt = workPay(payableOn(s, d));
    return amt > 0 ? { src: s, amt } : null;
  }).filter(Boolean);
}
function nextPaydayText(s){
  const diff = (s.payDay - parseDay(todayStr()).getDay() + 7) % 7;
  return diff === 0 ? 'today' : (diff === 1 ? 'tomorrow' : dayLabel(addDays(todayStr(), diff)));
}
function workOptions(){
  const out = [];
  B().sources.forEach(s => {
    if(s.mode === 'hours') out.push({ src: s, type: 'shift', label: `${s.name} hours` });
    else { out.push({ src: s, type: 'full', label: `${s.name} · full day` }); out.push({ src: s, type: 'half', label: `${s.name} · half day` }); }
  });
  return out;
}

// ---------- rendering ----------
function renderPayStrip(){
  return `<div class="bd-paystrip">${B().sources.map(s => {
    const due = paydayPrompts().some(p => p.src.id === s.id);
    return `<span class="bd-pchip ${due ? 'due' : ''}">${escapeHtml(s.name)} pays <b>${DAY_NAMES[s.payDay]}s</b> · ${due ? 'payday!' : nextPaydayText(s)}</span>`;
  }).join('')}</div>`;
}

function renderPrompts(){
  return paydayPrompts().map(p => `<div class="bd-card bd-payday"><div class="bd-pin"></div>
    <div class="bd-label">${escapeHtml(p.src.name)} payday 💸</div>
    <div style="font-size:14px;">You've logged <b>${money(p.amt)}</b> that hasn't been paid yet. Enter what actually landed in your account and I'll show where it goes.</div>
    <div class="bd-f" style="margin-top:10px;"><button class="bd-btn" data-bdpay="${p.src.id}">enter my ${escapeHtml(p.src.name)} pay</button></div></div>`).join('');
}

function renderBanner(){
  const ws = nextToMove();
  if(!ws) return '';
  const s = weekSummary(ws);
  return `<div class="bd-card bd-banner"><div class="bd-pin"></div>
    <div class="bd-label">new week — move last week's leftover to savings</div>
    <div style="font-size:14px;">${weekLabel(ws)} left <b>${money(s.leftover)}</b> after taxes, savings and spending. Log any bills you paid first, then move what's left${B().cushion > 0 ? ` (keep ${money(B().cushion)} in checking)` : ''}.</div>
    <div class="bd-f" style="margin-top:10px;"><span class="bd-hint">move it to</span>
      <select id="bdDest">${saveDestinations().map(d => `<option>${escapeHtml(d)}</option>`).join('')}</select>
      <button class="bd-btn" id="bdMoved" data-week="${ws}">I moved it</button>
      <span class="bd-link" id="bdSkip" data-week="${ws}">nothing to move</span></div></div>`;
}

function renderHero(ws){
  const b = B();
  const worked = sum(b.work.filter(w => inWeek(w, ws)), w => w.amt);
  const funded = fundedFor(ws);
  const covered = Math.min(planTotal(), sum(Object.values(funded).map(v => ({ v })), x => x.v));
  const short = orderedLines().filter(l => (funded[l.id] || 0) < (Number(l.target) || 0) - 0.004 && (Number(l.target) || 0) > 0);
  const pendingParts = b.sources.map(s => ({ s, a: workPay(unpaidWork(s.id)) })).filter(x => x.a > 0);
  const goal = b.weeklyGoal || 0;
  const pct = (v, t) => t > 0 ? Math.max(0, Math.min(100, v / t * 100)) : 0;
  return `<div class="bd-card bd-hero"><div class="bd-pin"></div>
    <div class="bd-stat"><div class="bd-k">worked &amp; logged this week</div>
      <div class="bd-v">${money(worked)}${goal > 0 ? ` <small>of ~${money(goal)}</small>` : ''}</div>
      ${goal > 0 ? `<div class="bd-bar"><i style="width:${pct(worked, goal)}%"></i></div>
      <div class="bd-s">${worked >= goal ? 'weekly goal reached 🎉' : `${money(goal - worked)} more to hit my weekly goal`}</div>` : `<div class="bd-s">set a weekly goal in my plan to track it</div>`}
    </div>
    <div class="bd-stat"><div class="bd-k">paid this week &amp; set aside for my plan</div>
      <div class="bd-v">${money(covered)} <small>of ${money(planTotal())}</small></div>
      <div class="bd-bar"><i style="width:${pct(covered, planTotal())}%"></i></div>
      <div class="bd-s">${short.length === 0 ? 'every line is funded for the week 🎉' : `${money(r2(planTotal() - covered))} still to cover · ${short.length} line${short.length === 1 ? '' : 's'} not full yet`}</div>
    </div>
    <div class="bd-pending">${pendingParts.length ? `<b>${money(sum(pendingParts, x => x.a))}</b> still on its way: ${pendingParts.map(x => `${escapeHtml(x.s.name)} ${money(x.a)} on ${DAY_NAMES[x.s.payDay].slice(0, 3)}`).join(' · ')}` : 'nothing pending — everything logged has been paid'}</div>
  </div>`;
}

function renderWork(ws){
  const d = BD(), opts = workOptions();
  if(d.wOpt >= opts.length) d.wOpt = 0;
  const cur = opts[d.wOpt];
  const isShift = cur.type === 'shift';
  const weekWork = B().work.filter(w => inWeek(w, ws));
  let summary = '';
  B().sources.forEach(s => {
    const mine = weekWork.filter(w => w.src === s.id);
    if(s.mode === 'hours'){
      const h = sum(mine, w => w.hours || 0), pay = workPay(mine);
      summary += `<div class="bd-wkline"><span>${escapeHtml(s.name)} this week</span><b>${h > 0 ? `${h} h · ${money(pay)} · ${money(pay / h)}/hr` : 'none yet'}</b></div>`;
      if(s.hoursGoal > 0) summary += `<div class="bd-bar" style="margin:2px 0 8px;"><i style="width:${Math.min(100, h / s.hoursGoal * 100)}%"></i></div>`;
    } else {
      const full = mine.filter(w => w.type === 'full').length, half = mine.filter(w => w.type === 'half').length;
      summary += `<div class="bd-wkline"><span>${escapeHtml(s.name)} this week</span><b>${(full || half) ? `${[full ? full + ' full' : '', half ? half + ' half' : ''].filter(Boolean).join(' + ')} · ${money(workPay(mine))}` : 'none yet'}</b></div>`;
    }
  });
  const unpaid = B().sources.map(s => { const a = workPay(unpaidWork(s.id)); const np = nextPayday(s.payDay, todayStr()), nowAmt = workPay(payableOn(s, np)); return a > 0 ? `<div class="bd-unpaid"><span>${escapeHtml(s.name)} not paid yet: <b>${money(a)}</b> <small>· ${nowAmt > 0 ? `${money(nowAmt)} arrives ${np === todayStr() ? 'today' : dayLabel(np)}` : `next payday ${dayLabel(np)} won't include these`}</small></span><button class="bd-btn sm" data-bdpay="${s.id}">I got paid for this</button></div>` : ''; }).join('');
  return `<div class="bd-card"><div class="bd-tape"></div>
    <div class="bd-label">work time</div>
    <div class="bd-seg">${opts.map((o, i) => `<span class="${i === d.wOpt ? 'on' : ''}" data-bdwopt="${i}">${escapeHtml(o.label)}</span>`).join('')}</div>
    ${isShift ? `<div class="bd-f"><label>hours worked</label><input class="bd-amt" type="number" inputmode="decimal" step="0.25" placeholder="hours" data-bdin="wHours" value="${attr(d.wHours)}" />
      <label>I made</label><input class="bd-amt" type="number" inputmode="decimal" step="0.01" placeholder="$ I made" data-bdin="wMade" value="${attr(d.wMade)}" /></div>` : ''}
    <div class="bd-f"><label>worked on</label><input class="bd-date" type="date" max="${todayStr()}" data-bdin="wDate" value="${attr(d.wDate || todayStr())}" /></div>
    <div class="bd-f"><button class="bd-btn" id="bdWorkAdd">${isShift ? 'log shift' : 'log time'}</button><span class="bd-err">${escapeHtml(d.err.work || '')}</span></div>
    ${isShift ? `<div class="bd-hint" style="margin-bottom:10px;">You know your pay right after a shift. It counts as "on its way" until payday, when I'll show where it goes.</div>` : ''}
    ${summary}${unpaid}
  </div>`;
}

function renderIncomeCard(){
  const d = BD(), srcs = B().sources;
  if(!d.iSrc || !srcById(d.iSrc)) d.iSrc = srcs[0].id;
  const s = srcById(d.iSrc);
  return `<div class="bd-card"><div class="bd-pin"></div>
    <div class="bd-label">I got paid</div>
    <div class="bd-seg">${srcs.map(x => `<span class="${x.id === d.iSrc ? 'on' : ''}" data-bdisrc="${x.id}">${escapeHtml(x.name)}</span>`).join('')}</div>
    <div class="bd-f"><input id="bdIAmt" class="bd-amt" type="number" inputmode="decimal" step="0.01" placeholder="$ amount" data-bdin="iAmt" value="${attr(d.iAmt)}" />
      ${s.taxPct > 0 ? `<span class="bd-hint">${s.taxPct}% will be set aside for taxes</span>` : ''}</div>
    <div class="bd-f"><button class="bd-btn" id="bdIncGo">show me where it goes</button><span class="bd-err">${escapeHtml(d.err.inc || '')}</span></div>
    <div class="bd-hint">I split it by priority: taxes, then must-pays, savings, everyday, flexible.</div></div>`;
}

function renderPreview(){
  const pv = BD().preview;
  if(!pv) return '';
  const { plan, amt, src } = pv, funded = fundedFor(weekStart(todayStr()));
  const rows = orderedLines().filter(l => plan.parts[l.id]).map(l => {
    const after = r2((funded[l.id] || 0) + plan.parts[l.id]), t = Number(l.target) || 0;
    return `<div class="bd-pvrow"><span class="n">${escapeHtml(l.name)}<small>${after >= t - 0.004 ? 'fully funded for the week' : `${money(after)} of ${money(t)} — still needs ${money(r2(t - after))}`}</small></span><b>${money(plan.parts[l.id])}</b></div>`;
  }).join('');
  const afterF = Object.assign({}, funded); Object.entries(plan.parts).forEach(([id, a]) => { afterF[id] = r2((afterF[id] || 0) + a); });
  const stillShort = orderedLines().filter(l => (Number(l.target) || 0) > 0 && (afterF[l.id] || 0) < Number(l.target) - 0.004);
  const need = r2(stillShort.reduce((s, l) => s + (l.target - (afterF[l.id] || 0)), 0));
  let msg;
  if(plan.extra > 0.004) msg = `<div class="bd-pvmsg ok">Everything this week is funded, with <b>${money(plan.extra)}</b> extra. Good places for it: your savings, or a cushion for a slow week.</div>`;
  else if(stillShort.length){
    const flex = stillShort.filter(l => l.group === 'flex' || l.group === 'spend').map(l => l.name).reverse().slice(0, 2);
    msg = `<div class="bd-pvmsg warn">After this you still need <b>${money(need)}</b> to fully cover the week. ${flex.length ? `If money runs short, drop ${flex.map(escapeHtml).join(' and ')} first — they're your flexible lines.` : ''}</div>`;
  } else msg = `<div class="bd-pvmsg ok">That covers the rest of your week. 🎉</div>`;
  if(B().cushion > 0) msg += `<div class="bd-hint" style="margin-top:6px;">Keep at least <b>${money(B().cushion)}</b> in checking.</div>`;
  return `<div class="bd-card bd-preview bd-full" id="bdPreview"><div class="bd-pin"></div>
    <div class="bd-label">here's where ${money(amt)} from ${escapeHtml(src.name)} goes</div>
    ${plan.tax > 0 ? `<div class="bd-pvrow tax"><span class="n">Tax set-aside<small>${src.taxPct}% of ${escapeHtml(src.name)} pay — don't spend this</small></span><b>${money(plan.tax)}</b></div>` : ''}
    ${rows}${msg}
    <div class="bd-f" style="margin-top:12px;"><button class="bd-btn" id="bdPvSave">save this</button><button class="bd-btn ghost" id="bdPvCancel">cancel</button></div></div>`;
}

function renderLines(ws){
  const funded = fundedFor(ws);
  const spent = {};
  B().purchases.filter(p => inWeek(p, ws)).forEach(p => { spent[p.line] = r2((spent[p.line] || 0) + p.amt); });
  let h = '';
  GROUPS.forEach(g => {
    const ls = B().lines.filter(l => l.group === g.id);
    if(!ls.length) return;
    h += `<div class="bd-grp">${g.label}</div>`;
    ls.forEach(l => {
      const t = Number(l.target) || 0, f = funded[l.id] || 0, isSave = g.id === 'save';
      const used = isSave ? f : (spent[l.id] || 0), left = r2(t - used);
      const ok = f >= t - 0.004;
      const chip = ok ? `<span class="bd-chip ok">funded</span>` : `<span class="bd-chip short">needs ${money(r2(t - f))}</span>`;
      const over = !isSave && left < -0.004;
      h += `<div class="bd-line"><div class="top"><span class="nm">${escapeHtml(l.name)}</span>${t > 0 ? chip : ''}<span class="rt ${over ? 'bad' : ''}">${isSave ? `${money(f)} of ${money(t)} set aside` : (over ? `over by ${money(-left)}` : `${money(left)} left of ${money(t)}`)}</span></div>
        <div class="bd-bar ${over ? 'over' : ''}" style="margin-top:7px;"><i style="width:${t > 0 ? Math.min(100, used / t * 100) : 0}%"></i></div></div>`;
    });
  });
  const taxSaved = sum(B().income.filter(e => inWeek(e, ws)), e => e.tax || 0);
  if(taxSaved > 0) h += `<div class="bd-grp">tax set-aside</div><div class="bd-line"><div class="top"><span class="nm">Saved for taxes this week</span><span class="rt">${money(taxSaved)}</span></div></div>`;
  return `<div class="bd-card"><div class="bd-pin"></div><div class="bd-label">my week</div>${h}</div>`;
}

function goalStats(g){
  const funded = g.lineId ? sum(B().income, e => (e.parts || {})[g.lineId] || 0) : 0;
  const got = r2((Number(g.paid) || 0) + funded), total = Number(g.total) || 0;
  const left = Math.max(0, r2(total - got));
  const wks = g.due ? Math.max(1, Math.ceil(daysBetween(todayStr(), g.due) / 7)) : 0;
  const line = g.lineId ? lineById(g.lineId) : null;
  return { got, total, left, wks, line, pct: total > 0 ? Math.min(100, got / total * 100) : 0 };
}
function renderGoals(){
  const goals = B().goals;
  if(!goals.length) return '';
  return goals.map(g => {
    const st = goalStats(g), weekly = st.line ? Number(st.line.target) || 0 : 0;
    let status;
    if(st.left <= 0.004) status = '<span class="bd-chip ok">done 🎉</span>';
    else if(g.due && daysBetween(todayStr(), g.due) < 0) status = '<span class="bd-chip over">past due</span>';
    else if(g.due && weekly > 0) status = weekly * st.wks >= st.left - 0.004 ? '<span class="bd-chip ok">on track</span>' : `<span class="bd-chip short">needs ${money(r2(st.left / st.wks))}/wk</span>`;
    else status = '';
    const due = g.due ? `due ${dayLabel(g.due)} · ${daysBetween(todayStr(), g.due) < 0 ? 'passed' : `${st.wks} week${st.wks === 1 ? '' : 's'} left`}` : '';
    return `<div class="bd-card"><div class="bd-pin"></div><div class="bd-label">${escapeHtml(g.name)} <small style="font-size:12px;color:var(--ink-soft);font-style:normal;">goal</small></div>
      <div class="bd-v" style="font-size:30px;">${money(st.got)} <small>of ${money(st.total)}</small></div>
      <div class="bd-bar"><i style="width:${st.pct}%"></i></div>
      <div class="bd-f" style="margin:8px 0 0;justify-content:space-between;"><span class="bd-hint">${st.left > 0.004 ? `${money(st.left)} to go` : 'fully saved'}${due ? ' · ' + due : ''}</span>${status}</div>
      ${weekly > 0 && st.left > 0.004 ? `<div class="bd-hint" style="margin-top:4px;">${money(weekly)}/week from my plan${(Number(g.paid) || 0) > 0 ? ` · ${money(Number(g.paid))} already paid up front` : ''}</div>` : ''}</div>`;
  }).join('');
}
function renderSafety(){
  const b = B(), taxTotal = sum(b.income, e => e.tax || 0), hasTax = b.sources.some(s => s.taxPct > 0);
  if(!b.buckets.length && !hasTax && !(b.cushion > 0)) return '';
  const rows = [];
  if(hasTax) rows.push(`<div class="bd-line"><div class="top"><span class="nm">Taxes</span><span class="rt">${money(taxTotal)} set aside so far</span></div><div class="bd-hint">${b.sources.filter(s => s.taxPct > 0).map(s => `${s.taxPct}% of ${escapeHtml(s.name)} pay`).join(' · ')}, taken out of each deposit</div></div>`);
  b.buckets.forEach(k => rows.push(`<div class="bd-line"><div class="top"><span class="nm">${k.locked ? '🔒 ' : ''}${escapeHtml(k.name)}</span><span class="rt">${money(Number(k.balance) || 0)}</span></div>${k.locked ? '<div class="bd-hint">don\'t touch</div>' : ''}</div>`));
  if(b.cushion > 0) rows.push(`<div class="bd-line"><div class="top"><span class="nm">Checking cushion</span><span class="rt">keep ${money(b.cushion)} minimum</span></div></div>`);
  return `<div class="bd-card"><div class="bd-tape"></div><div class="bd-label">safety nets</div>${rows.join('')}</div>`;
}

function renderPurchase(){
  const d = BD(), lines = orderedLines().filter(l => l.group !== 'save');
  if(!lines.find(l => l.id === d.pLine)) d.pLine = lines.length ? lines[0].id : '';
  return `<div class="bd-card" style="margin-bottom:22px;"><div class="bd-tape"></div>
    <div class="bd-label">I bought something</div>
    <div class="bd-f"><input class="bd-amt" type="number" inputmode="decimal" step="0.01" placeholder="$ amount" data-bdin="pAmt" value="${attr(d.pAmt)}" />
      <select data-bdin="pLine">${lines.map(l => `<option value="${l.id}" ${l.id === d.pLine ? 'selected' : ''}>${escapeHtml(l.name)}</option>`).join('')}</select></div>
    <div class="bd-f"><input class="bd-note" type="text" placeholder="note (optional)" maxlength="40" data-bdin="pNote" value="${attr(d.pNote)}" /></div>
    <div class="bd-f"><button class="bd-btn" id="bdBuyAdd">add purchase</button><span class="bd-err">${escapeHtml(d.err.buy || '')}</span></div></div>`;
}

function renderRecent(){
  const b = B(), items = [];
  b.income.forEach(e => items.push({ k: 'in', kind: 'income', id: e.id, date: e.date, ts: e.ts || 0, t: `Paid · ${escapeHtml((srcById(e.src) || { name: 'income' }).name)}`, s: e.tax > 0 ? `${money(e.tax)} set aside for taxes` : '', a: e.amt }));
  b.purchases.forEach(p => items.push({ k: 'out', kind: 'purchase', id: p.id, date: p.date, ts: p.ts || 0, t: escapeHtml((lineById(p.line) || { name: 'removed line' }).name), s: escapeHtml(p.note || ''), a: p.amt }));
  b.work.forEach(w => { const s = srcById(w.src) || { name: 'work' }; items.push({ k: 'work', kind: 'work', id: w.id, date: w.date, ts: w.ts || 0, t: w.type === 'shift' ? `${escapeHtml(s.name)} · ${w.hours} h` : `${escapeHtml(s.name)} · ${w.type} day`, s: w.paid ? 'paid' : 'not paid yet', a: w.amt }); });
  b.moves.filter(m => m.dest !== 'skipped').forEach(m => items.push({ k: 'save', kind: 'move', id: m.id, date: m.date, ts: 0, t: `Moved leftover to ${escapeHtml(m.dest)}`, s: weekLabel(m.week), a: m.amt }));
  items.sort((x, y) => y.date.localeCompare(x.date) || y.ts - x.ts);
  const icon = { in: '↓', out: '↑', work: '⏱', save: '★' };
  const d = BD(), shown = d.recentAll ? items : items.slice(0, 8);
  const rows = shown.map(e => `<div class="bd-act"><span class="bd-ico i-${e.k}">${icon[e.k]}</span><span class="d">${dayLabel(e.date)}</span>
      <span class="t">${e.t}${e.s ? ` <small>· ${e.s}</small>` : ''}</span><span class="a ${e.k === 'in' ? 'in' : ''}">${e.k === 'in' ? '+' : (e.k === 'out' ? '−' : '')}${money(e.a)}</span>
      ${e.kind !== 'move' ? `<span class="bd-x" data-bddel="${e.kind}|${e.id}" title="delete">✕</span>` : ''}</div>`).join('');
  return `<div class="bd-card" style="margin-bottom:22px;"><div class="bd-label">recent</div>${rows || '<div class="bd-hint">nothing logged yet</div>'}${items.length > 8 ? `<div style="margin-top:8px;"><span class="bd-link" id="bdRecentMore">${d.recentAll ? 'show fewer' : `show all ${items.length}`}</span></div>` : ''}</div>`;
}

function renderPast(){
  const weeks = pastWeekStarts(), d = BD();
  const movedBy = {};
  B().moves.filter(m => m.dest !== 'skipped').forEach(m => { movedBy[m.dest] = r2((movedBy[m.dest] || 0) + m.amt); });
  const tally = Object.entries(movedBy).map(([k, v]) => `${escapeHtml(k.replace(/ savings$/i, ''))} ${money(v)}`);
  const rows = weeks.map(ws => {
    const s = weekSummary(ws), mv = moveFor(ws);
    const chip = s.leftover > 0.004
      ? (mv ? (mv.dest === 'skipped' ? `<span class="bd-chip flat">${money(s.leftover)} skipped</span>` : `<span class="bd-chip ok">${money(s.leftover)} → ${escapeHtml(mv.dest.replace(/ savings$/i, ''))} ✓</span>`) : `<span class="bd-chip short">${money(s.leftover)} not moved</span>`)
      : (s.leftover < -0.004 ? `<span class="bd-chip over">over by ${money(-s.leftover)}</span>` : `<span class="bd-chip flat">on plan</span>`);
    const open = d.openWeek === ws;
    let det = '';
    if(open){
      const spentBy = {}; s.buys.forEach(p => { spentBy[p.line] = r2((spentBy[p.line] || 0) + p.amt); });
      det = `<div class="bd-wkdet"><div><span>paid</span><span>${money(s.gross)}</span></div>
        ${s.tax > 0 ? `<div><span>set aside for taxes</span><span>−${money(s.tax)}</span></div>` : ''}
        ${s.saved > 0 ? `<div><span>set aside as savings</span><span>−${money(s.saved)}</span></div>` : ''}
        ${B().lines.filter(l => l.group !== 'save' && (spentBy[l.id] || 0) > 0).map(l => { const sp = spentBy[l.id], t = Number(l.target) || 0; return `<div class="${sp > t + 0.004 ? 'over' : ''}"><span>${escapeHtml(l.name)}</span><span>${money(sp)} of ${money(t)}</span></div>`; }).join('')}
        ${Object.keys(spentBy).filter(id => !lineById(id)).length ? `<div><span>removed lines</span><span>${money(sum(Object.keys(spentBy).filter(id => !lineById(id)), id => spentBy[id]))}</span></div>` : ''}
      </div>`;
    }
    return `<div class="bd-wkrow"><div class="hd" data-bdwk="${ws}"><span class="nm">${weekLabel(ws)}<small>paid ${money(s.gross)} · spent ${money(s.spent)}</small></span>${chip}<span class="caret">${open ? '▴' : '▾'}</span></div>${det}</div>`;
  }).join('');
  return `<div class="bd-card"><div class="bd-tape"></div><div class="bd-label">past weeks</div>
    <div class="bd-hint" style="margin-bottom:6px;">${tally.length ? 'leftover moved to savings so far: ' + tally.join(' · ') : 'no leftover moved to savings yet'}</div>
    ${rows || '<div class="bd-hint">your first finished week will show up here</div>'}</div>`;
}

function cleanUrl(u){
  u = (u || '').trim();
  if(!u) return '';
  if(!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try{ const x = new URL(u); return (x.protocol === 'http:' || x.protocol === 'https:') ? x.href : ''; }catch(e){ return ''; }
}
function renderWishlist(){
  const d = BD(), items = B().wishlist;
  const open = items.filter(i => !i.got), got = items.filter(i => i.got);
  const total = sum(open, i => Number(i.price) || 0);
  const spare = spareMoney();
  const row = i => {
    let host = '';
    try{ host = new URL(i.url).hostname.replace(/^www\./, ''); }catch(e){}
    return `<div class="bd-wish ${i.got ? 'got' : ''}"><span class="bd-check ${i.got ? 'on' : ''}" data-bdwgot="${i.id}" title="${i.got ? 'put back on list' : 'I got it'}">${i.got ? '✓' : ''}</span>
      <span class="t">${i.url ? `<a href="${attr(i.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(i.name)}</a>` : escapeHtml(i.name)}${host ? `<small>${escapeHtml(host)}</small>` : ''}</span>
      <span class="a">${Number(i.price) > 0 ? money(Number(i.price)) : ''}${!i.got && Number(i.price) > 0 ? (Number(i.price) <= spare + 0.004 ? '<small class="bd-aff yes">you could afford this</small>' : `<small class="bd-aff">need ${money(r2(Number(i.price) - spare))} more</small>`) : ''}</span><span class="bd-x" data-bdwdel="${i.id}" title="remove">✕</span></div>`;
  };
  return `<div class="bd-card" style="margin-bottom:22px;"><div class="bd-tape"></div>
    <div class="bd-label">wish list <small style="font-size:12px;color:var(--ink-soft);font-style:normal;">things I want when I can afford them</small></div>
    <div class="bd-f"><input class="bd-note" type="text" placeholder="what is it?" maxlength="60" data-bdin="xName" value="${attr(d.xName)}" />
      <input class="bd-amt" type="number" inputmode="decimal" step="0.01" placeholder="$ price" data-bdin="xPrice" value="${attr(d.xPrice)}" /></div>
    <div class="bd-f"><input class="bd-note" type="text" inputmode="url" placeholder="link (optional)" data-bdin="xUrl" value="${attr(d.xUrl)}" /></div>
    <div class="bd-f"><button class="bd-btn" id="bdWishAdd">add to wish list</button><span class="bd-err">${escapeHtml(d.err.wish || '')}</span></div>
    ${open.length ? `<div class="bd-hint" style="margin-bottom:4px;">spare money right now: <b>${money(spare)}</b> <span title="">(last weeks' leftover not moved yet + extra from this week's pay)</span></div>` : ''}
    ${open.map(row).join('') || '<div class="bd-hint">nothing on the list yet</div>'}
    ${open.length ? `<div class="bd-sumrow"><span>total to save for</span><b>${money(total)}</b></div>` : ''}
    ${got.length ? `<div class="bd-grp">got it</div>${got.map(row).join('')}` : ''}
  </div>`;
}

function renderSetup(){
  return `<div class="bd-card bd-setup"><div class="bd-pin"></div>
    <div class="bd-label">set up my plan</div>
    <div style="font-size:14px;line-height:1.5;">Add your weekly budget lines (like groceries or gas), name your income sources, and set pay days. You only do this once, and you can change it any time.</div>
    <div class="bd-f" style="margin-top:12px;"><button class="bd-btn" id="bdSetup">set up my plan</button></div></div>`;
}

function renderPlanModal(){
  const p = ui.bdPlan;
  if(!p) return '';
  const dayOpts = sel => DAY_NAMES.map((n, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${n}</option>`).join('');
  const srcBlocks = p.sources.map((s, i) => `<div class="bd-plan-src">
    <div class="bd-hint">income source ${i + 1} · ${s.mode === 'hours' ? 'paid by the hour' : 'paid by the day'}</div>
    <input type="text" data-bdp="src|${i}|name" placeholder="name" maxlength="24" value="${attr(s.name)}" />
    <div class="bd-plan-row"><label>pays on</label><select data-bdp="src|${i}|payDay">${dayOpts(s.payDay)}</select></div>
    <div class="bd-plan-row"><label>days from a shift until its payday</label><input type="number" inputmode="numeric" data-bdp="src|${i}|holdDays" value="${attr(s.holdDays === undefined ? 1 : s.holdDays)}" /></div>
    <div class="bd-plan-row"><label>set aside for taxes %</label><input type="number" inputmode="decimal" data-bdp="src|${i}|taxPct" value="${attr(s.taxPct)}" /></div>
    ${s.mode === 'hours' ? `<div class="bd-plan-row"><label>weekly hours goal</label><input type="number" inputmode="decimal" data-bdp="src|${i}|hoursGoal" value="${attr(s.hoursGoal || '')}" /></div>`
      : `<div class="bd-plan-row"><label>full day pay $</label><input type="number" inputmode="decimal" data-bdp="src|${i}|full" value="${attr(s.full || '')}" /></div>
         <div class="bd-plan-row"><label>half day pay $</label><input type="number" inputmode="decimal" data-bdp="src|${i}|half" value="${attr(s.half || '')}" /></div>`}
  </div>`).join('');
  const lineRows = p.lines.map((l, i) => `<div class="bd-plan-line">
    <input type="text" data-bdp="line|${i}|name" placeholder="name" maxlength="30" value="${attr(l.name)}" />
    <input type="number" inputmode="decimal" class="w" data-bdp="line|${i}|target" placeholder="$/wk" value="${attr(l.target)}" />
    <select data-bdp="line|${i}|group">${GROUPS.map(g => `<option value="${g.id}" ${g.id === l.group ? 'selected' : ''}>${g.label}</option>`).join('')}</select>
    <span class="bd-x" data-bdplandel="${i}" title="remove">✕</span></div>`).join('');
  return `<div class="modal-overlay" id="bdPlanOverlay"><div class="modal-box modal-box-lg">
    <div class="modal-closerow"><span class="expand-btn" id="bdPlanClose">${COLLAPSE_ICON}</span></div>
    <div class="modal-title">My plan</div>
    <div class="bd-plan-h">income</div>${srcBlocks}
    <div class="bd-plan-row"><label>weekly pay goal $</label><input type="number" inputmode="decimal" data-bdp="goal" value="${attr(p.weeklyGoal || '')}" /></div>
    <div class="bd-plan-row"><label>keep in checking at least $</label><input type="number" inputmode="decimal" data-bdp="cushion" value="${attr(p.cushion || '')}" /></div>
    <div class="bd-plan-h">savings goals</div>
    ${p.goals.map((g, i) => `<div class="bd-plan-src"><input type="text" data-bdp="goals|${i}|name" placeholder="goal name" maxlength="30" value="${attr(g.name)}" />
      <div class="bd-plan-row"><label>total $</label><input type="number" inputmode="decimal" data-bdp="goals|${i}|total" value="${attr(g.total || '')}" /></div>
      <div class="bd-plan-row"><label>paid up front $</label><input type="number" inputmode="decimal" data-bdp="goals|${i}|paid" value="${attr(g.paid || '')}" /></div>
      <div class="bd-plan-row"><label>due</label><input type="date" style="width:140px;" data-bdp="goals|${i}|due" value="${attr(g.due || '')}" /></div>
      <div class="bd-plan-row"><label>fed by savings line</label><select data-bdp="goals|${i}|lineId"><option value="">none</option>${p.lines.filter(l => l.group === 'save').map(l => `<option value="${l.id}" ${l.id === g.lineId ? 'selected' : ''}>${escapeHtml(l.name || 'unnamed')}</option>`).join('')}</select></div>
      <span class="bd-link" data-bdgdel="${i}">remove this goal</span></div>`).join('')}
    <span class="bd-link" id="bdGoalAdd">+ add a goal</span>
    <div class="bd-plan-h">set-aside money (not spent)</div>
    ${p.buckets.map((k, i) => `<div class="bd-plan-line"><input type="text" data-bdp="buckets|${i}|name" placeholder="name" maxlength="30" value="${attr(k.name)}" />
      <input type="number" inputmode="decimal" class="w" data-bdp="buckets|${i}|balance" placeholder="$" value="${attr(k.balance || '')}" />
      <select data-bdp="buckets|${i}|locked"><option value="1" ${k.locked ? 'selected' : ''}>don't touch</option><option value="" ${!k.locked ? 'selected' : ''}>ok to use</option></select>
      <span class="bd-x" data-bdkdel="${i}" title="remove">✕</span></div>`).join('')}
    <span class="bd-link" id="bdBucketAdd">+ add one</span>
    <div class="bd-plan-h">weekly budget lines</div>
    ${lineRows || '<div class="bd-hint" style="margin-bottom:8px;">no lines yet — add them below</div>'}
    <span class="bd-link" id="bdPlanAdd">+ add a line</span>
    <div class="bd-plan-h">or paste several at once</div>
    <textarea id="bdQuick" rows="5" placeholder="one per line, like:&#10;Groceries 35&#10;Rent 200 must&#10;Trip fund 50 save">${escapeHtml(p.quick || '')}</textarea>
    <div class="bd-hint">add <b>must</b>, <b>save</b>, <b>spend</b> or <b>flex</b> at the end to pick a group (default: spend)</div>
    <span class="bd-link" id="bdQuickAdd">add these lines</span>
    <div class="modal-actions" style="margin-top:16px;"><button class="modal-cancel" id="bdPlanCancel">cancel</button><button class="modal-add" id="bdPlanSave">save plan</button></div>
  </div></div>`;
}

export function renderBudget(){
  B();
  if(B().lines.length === 0) return renderSetup() + renderPlanModal();
  const ws = weekStart(todayStr());
  return `<div class="bd-weeklabel">this week · ${weekLabel(ws)}</div>
    ${renderPayStrip()}
    ${renderPrompts()}
    ${renderBanner()}
    ${renderHero(ws)}
    <div class="bd-grid">${renderWork(ws)}${renderIncomeCard()}${renderPreview()}</div>
    <div class="bd-grid"><div>${renderLines(ws)}${renderGoals()}${renderSafety()}</div><div>${renderPurchase()}${renderRecent()}${renderWishlist()}${renderPast()}</div></div>
    <div class="bd-foot"><span class="bd-link" id="bdEditPlan">edit my plan</span></div>
    ${renderPlanModal()}`;
}

// ---------- events ----------
function openPlan(){
  const b = B();
  ui.bdPlan = { sources: JSON.parse(JSON.stringify(b.sources)), weeklyGoal: b.weeklyGoal || 0, lines: JSON.parse(JSON.stringify(b.lines)), goals: JSON.parse(JSON.stringify(b.goals)), buckets: JSON.parse(JSON.stringify(b.buckets)), cushion: b.cushion || 0, quick: '' };
  render();
}
function parseQuick(text){
  const out = [];
  text.split('\n').forEach(raw => {
    const m = raw.trim().match(/^(.*?)[\s:]+\$?(\d+(?:\.\d+)?)(?:\s+(must|save|spend|flex))?\s*$/i);
    if(m && m[1].trim()) out.push({ id: uid(), name: m[1].trim(), target: parseFloat(m[2]), group: (m[3] || 'spend').toLowerCase() });
  });
  return out;
}

export function attachBudgetEvents(){
  if(!document.getElementById('bdSetup') && !document.getElementById('bdWorkAdd') && !document.getElementById('bdPlanOverlay')) return;
  const d = BD();

  // keep typed values across re-renders
  document.querySelectorAll('[data-bdin]').forEach(el => {
    const f = el.getAttribute('data-bdin');
    const sync = () => { d[f] = el.value; };
    el.addEventListener('input', sync); el.addEventListener('change', sync);
  });

  const on = (id, fn) => { const el = document.getElementById(id); if(el) el.onclick = fn; };
  on('bdRecentMore', () => { d.recentAll = !d.recentAll; render(); });
  on('bdSetup', openPlan); on('bdEditPlan', openPlan);

  document.querySelectorAll('[data-bdwopt]').forEach(el => el.onclick = () => { d.wOpt = Number(el.getAttribute('data-bdwopt')); d.err.work = ''; render(); });
  document.querySelectorAll('[data-bdisrc]').forEach(el => el.onclick = () => { d.iSrc = el.getAttribute('data-bdisrc'); d.preview = null; render(); });

  // log work
  on('bdWorkAdd', () => {
    const cur = workOptions()[d.wOpt], today = (d.wDate && d.wDate <= todayStr()) ? d.wDate : todayStr();
    if(cur.type === 'shift'){
      const hours = num(d.wHours), made = num(d.wMade);
      if(!(hours > 0) || !(made > 0)){ d.err.work = 'enter your hours and what you made'; render(); return; }
      B().work.push({ id: uid(), src: cur.src.id, type: 'shift', hours, amt: made, date: today, paid: false, ts: Date.now() });
      d.wHours = ''; d.wMade = '';
    } else {
      const amt = Number(cur.type === 'full' ? cur.src.full : cur.src.half) || 0;
      if(!(amt > 0)){ d.err.work = `set your ${cur.type} day pay in my plan first`; render(); return; }
      B().work.push({ id: uid(), src: cur.src.id, type: cur.type, hours: 0, amt, date: today, paid: false, ts: Date.now() });
    }
    d.err.work = ''; d.wDate = '';
    render(); saveData();
  });

  // "I got paid for this" / payday prompt -> prefill the deposit form
  document.querySelectorAll('[data-bdpay]').forEach(el => el.onclick = () => {
    const id = el.getAttribute('data-bdpay');
    const sc = srcById(id), pay = workPay(payableOn(sc, payDateFor(sc, todayStr())));
    d.iSrc = id; d.iAmt = pay > 0 ? String(pay) : ''; d.preview = null; d.scroll = 'iamt';
    render();
  });

  // deposit -> preview -> save
  on('bdIncGo', () => {
    const src = srcById(d.iSrc), amt = num(d.iAmt);
    if(!(amt > 0)){ d.err.inc = 'enter the amount you were paid'; render(); return; }
    d.err.inc = '';
    d.preview = { src: { id: src.id, name: src.name, taxPct: src.taxPct }, amt, plan: allocate(amt, src, weekStart(todayStr())) };
    d.scroll = 'preview';
    render();
  });
  on('bdPvCancel', () => { d.preview = null; render(); });
  on('bdPvSave', () => {
    const pv = d.preview;
    if(!pv) return;
    const today = todayStr();
    const sc = srcById(pv.src.id);
    const paid = payableOn(sc, payDateFor(sc, today));
    paid.forEach(w => { w.paid = true; });
    B().income.push({ id: uid(), src: pv.src.id, amt: pv.amt, tax: pv.plan.tax, parts: pv.plan.parts, extra: pv.plan.extra, date: today, paidIds: paid.map(w => w.id), ts: Date.now() });
    d.preview = null; d.iAmt = '';
    render(); saveData();
  });

  // purchases
  on('bdBuyAdd', () => {
    const amt = num(d.pAmt);
    if(!(amt > 0)){ d.err.buy = 'enter an amount'; render(); return; }
    if(!d.pLine){ d.err.buy = 'add a budget line first'; render(); return; }
    B().purchases.push({ id: uid(), line: d.pLine, amt, note: (d.pNote || '').trim(), date: todayStr(), ts: Date.now() });
    d.pAmt = ''; d.pNote = ''; d.err.buy = '';
    render(); saveData();
  });

  // wish list
  on('bdWishAdd', () => {
    const name = (d.xName || '').trim();
    if(!name){ d.err.wish = 'what do you want to get?'; render(); return; }
    const url = cleanUrl(d.xUrl);
    if((d.xUrl || '').trim() && !url){ d.err.wish = "that link doesn't look right"; render(); return; }
    B().wishlist.push({ id: uid(), name, url, price: num(d.xPrice), got: false, ts: Date.now() });
    d.xName = ''; d.xUrl = ''; d.xPrice = ''; d.err.wish = '';
    render(); saveData();
  });
  document.querySelectorAll('[data-bdwgot]').forEach(el => el.onclick = () => {
    const it = B().wishlist.find(x => x.id === el.getAttribute('data-bdwgot'));
    if(it){ it.got = !it.got; render(); saveData(); }
  });
  document.querySelectorAll('[data-bdwdel]').forEach(el => el.onclick = () => {
    B().wishlist = B().wishlist.filter(x => x.id !== el.getAttribute('data-bdwdel'));
    render(); saveData();
  });

  // delete from "recent"
  document.querySelectorAll('[data-bddel]').forEach(el => el.onclick = () => {
    const [kind, id] = el.getAttribute('data-bddel').split('|');
    if(!confirm('Delete this entry?')) return;
    const b = B();
    if(kind === 'purchase') b.purchases = b.purchases.filter(x => x.id !== id);
    else if(kind === 'work') b.work = b.work.filter(x => x.id !== id);
    else if(kind === 'income'){
      const e = b.income.find(x => x.id === id);
      if(e) b.work.forEach(w => { if((e.paidIds || []).includes(w.id)) w.paid = false; });   // un-pay what it settled
      b.income = b.income.filter(x => x.id !== id);
    }
    render(); saveData();
  });

  // leftover -> savings
  on('bdMoved', () => {
    const ws = document.getElementById('bdMoved').getAttribute('data-week');
    const dest = document.getElementById('bdDest').value;
    B().moves.push({ id: uid(), week: ws, dest, amt: weekSummary(ws).leftover, date: todayStr() });
    render(); saveData();
  });
  on('bdSkip', () => {
    const ws = document.getElementById('bdSkip').getAttribute('data-week');
    B().moves.push({ id: uid(), week: ws, dest: 'skipped', amt: weekSummary(ws).leftover, date: todayStr() });
    render(); saveData();
  });

  document.querySelectorAll('[data-bdwk]').forEach(el => el.onclick = () => {
    const ws = el.getAttribute('data-bdwk');
    d.openWeek = d.openWeek === ws ? null : ws;
    render();
  });

  // plan editor (works on a draft; "save plan" commits)
  const p = ui.bdPlan;
  if(p){
    document.querySelectorAll('[data-bdp]').forEach(el => {
      const parts = el.getAttribute('data-bdp').split('|');
      const sync = () => {
        const v = el.value;
        if(parts[0] === 'goal') p.weeklyGoal = num(v);
        else if(parts[0] === 'cushion') p.cushion = num(v);
        else if(parts[0] === 'goals'){
          const g = p.goals[Number(parts[1])], f = parts[2];
          g[f] = (f === 'total' || f === 'paid') ? num(v) : v;
        } else if(parts[0] === 'buckets'){
          const k = p.buckets[Number(parts[1])], f = parts[2];
          k[f] = f === 'balance' ? num(v) : (f === 'locked' ? !!v : v);
        }
        else if(parts[0] === 'src'){
          const s = p.sources[Number(parts[1])], f = parts[2];
          s[f] = f === 'name' ? v : (f === 'payDay' ? Number(v) : num(v));
        } else if(parts[0] === 'line'){
          const l = p.lines[Number(parts[1])], f = parts[2];
          l[f] = f === 'target' ? v : v;
        }
      };
      el.addEventListener('input', sync); el.addEventListener('change', sync);
    });
    const quick = document.getElementById('bdQuick');
    if(quick) quick.addEventListener('input', () => { p.quick = quick.value; });
    const closePlan = () => { ui.bdPlan = null; render(); };
    on('bdPlanClose', closePlan); on('bdPlanCancel', closePlan);
    const ov = document.getElementById('bdPlanOverlay');
    if(ov) ov.addEventListener('click', e => { if(e.target === ov) closePlan(); });
    on('bdGoalAdd', () => { p.goals.push({ id: uid(), name: '', total: 0, due: '', paid: 0, lineId: '' }); render(); });
    document.querySelectorAll('[data-bdgdel]').forEach(el => el.onclick = () => { p.goals.splice(Number(el.getAttribute('data-bdgdel')), 1); render(); });
    on('bdBucketAdd', () => { p.buckets.push({ id: uid(), name: '', balance: 0, locked: true }); render(); });
    document.querySelectorAll('[data-bdkdel]').forEach(el => el.onclick = () => { p.buckets.splice(Number(el.getAttribute('data-bdkdel')), 1); render(); });
    on('bdPlanAdd', () => { p.lines.push({ id: uid(), name: '', target: '', group: 'spend' }); render(); });
    document.querySelectorAll('[data-bdplandel]').forEach(el => el.onclick = () => { p.lines.splice(Number(el.getAttribute('data-bdplandel')), 1); render(); });
    on('bdQuickAdd', () => {
      const added = parseQuick(quick ? quick.value : '');
      if(!added.length) return;
      p.lines.push(...added); p.quick = ''; render();
    });
    on('bdPlanSave', () => {
      const b = B();
      b.sources = p.sources.map(s => Object.assign({}, s, { name: (s.name || '').trim() || 'income' }));
      b.weeklyGoal = Number(p.weeklyGoal) || 0;
      b.lines = p.lines.filter(l => (l.name || '').trim()).map(l => ({ id: l.id, name: l.name.trim(), target: num(l.target), group: l.group }));
      b.goals = p.goals.filter(g => (g.name || '').trim()).map(g => ({ id: g.id, name: g.name.trim(), total: num(g.total), due: g.due || '', paid: num(g.paid), lineId: g.lineId || '' }));
      b.buckets = p.buckets.filter(k => (k.name || '').trim()).map(k => ({ id: k.id, name: k.name.trim(), balance: num(k.balance), locked: !!k.locked }));
      b.cushion = num(p.cushion);
      reflowWeek(b, weekStart(todayStr()));
      ui.bdPlan = null;
      render(); saveData();
    });
  }

  // after a re-render, bring the thing you just opened into view
  if(d.scroll){
    const el = d.scroll === 'preview' ? document.getElementById('bdPreview') : document.getElementById('bdIAmt');
    d.scroll = null;
    if(el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}
