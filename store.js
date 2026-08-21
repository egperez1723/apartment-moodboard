// Central app state (all your spaces + the currently open one) + Firebase
// sync + local backups. This is the only module allowed to reassign
// `store.data` wholesale. Everyone else reads/writes properties on the
// shared `store` and `ui` objects.

import { uid } from './shared.js';
import { render } from './app.js';


const firebaseConfig = {
  apiKey: "AIzaSyAwE4eae06GpppBp7Z9fREKZY-BxGXUrPs",
  authDomain: "apt-mood-board.firebaseapp.com",
  projectId: "apt-mood-board",
  storageBucket: "apt-mood-board.firebasestorage.app",
  messagingSenderId: "1036342063364",
  appId: "1:1036342063364:web:281bc3482a46a4386a6051",
  measurementId: "G-8R84868KSZ"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const spacesCol = db.collection('spaces');
const legacyBoardRef = db.collection('moodboard').doc('board'); // pre-multi-space data, read once for migration

const STORAGE_PREFIX = "apt-hub-space-v1-";
const SPACES_INDEX_KEY = "apt-hub-spaces-index-v1";
const LAST_SPACE_KEY = "apt-hub-last-space-v1";
const MIGRATED_KEY = "apt-hub-migrated-v1";
const BACKUP_PREFIX = "apt-hub-backup-v1-";
const BACKUP_SLOT_COUNT = 3;

// Every feature a space CAN have beyond the mood board (which every space
// always has). A space's `features` array is a subset of these ids.
export const ALL_FEATURES = [
  { id: 'shopping', label: 'shopping list' },
  { id: 'todo', label: 'stuff to do' },
  { id: 'info', label: 'info card' },
  { id: 'course', label: 'course tracker (syllabus + assignments)' }
];

// `store.data` holds the currently open space's board (categories, shopping
// list, etc). `store.spaces` is the lightweight list for the home screen.
// `store.currentSpaceId` / `store.features` describe which space is open.
export const store = { data: null, spaces: [], currentSpaceId: null, features: [] };
const spaceDataCache = {}; // spaceId -> parsed state, kept warm from the index listener for the home-screen task list

// `ui` holds transient interface state (which modal is open, which tab is
// active, etc) — never saved to the cloud, just what's currently on screen.
export const ui = {
  editingDate: false,
  openItemId: null,
  addingCategory: false,
  catEditMode: false,
  editingCatId: null,
  moodViewCats: new Set(),
  catQuickAddOpen: null,
  budgetModalOpen: false,
  editingQuickId: null,
  editingTodoId: null,
  editingInfo: false,
  viewingInfo: false,
  viewingCourseInfo: false,
  editingCourseInfo: false,
  courseNotesOpen: false,
  courseMaterialsOpen: false,
  importantNotesDraft: [],
  materialsDraft: [],
  activeTab: 'board',
  addingSubFor: null,
  addingLinkFor: null,
  editingSubId: null,
  addingItemCat: null,
  itemDraft: null,
  modalAddingSub: false,
  modalAddingLink: false,
  addingSpace: false,
  newSpaceFeatures: new Set(),
  homeEditMode: false,
  showArchived: false,
  spaceSettingsOpen: false,
  assignmentModalOpen: false,
  assignmentDraft: null,
  managingCourseCats: false
};

export function defaultState(name){
  return {
    title: name || "new space",
    moveInDate: null,
    categories: [],
    bought: [],
    info: { unitNumber: '', address: '', storageUnit: '', storageAddress: '', storageCode: '' },
    quickList: [],
    todoList: [],
    infoCollapsed: false,
    courseInfo: { professor: '', professorEmail: '', isAsync: false, classDays: [], classStart: '', classEnd: '', classRoom: '', officeHours: '' },
    courseInfoCollapsed: false,
    categoryWeights: {},
    categoryNotes: {},
    courseNotes: '',
    courseImportantNotes: [],
    courseMaterials: []
  };
}

export function normalizeState(){
  if(!store.data.categories) store.data.categories = [];
  store.data.categories.forEach(c => { if(!c.images) c.images = []; });
  if(!store.data.bought) store.data.bought = [];
  if(!store.data.title) store.data.title = "new space";
  if(!store.data.info) store.data.info = { unitNumber: '', address: '', storageUnit: '', storageAddress: '', storageCode: '' };
  if(store.data.info.storageCode === undefined) store.data.info.storageCode = '';
  if(!store.data.quickList) store.data.quickList = [];
  if(!store.data.todoList) store.data.todoList = [];
  store.data.todoList.forEach(t => { if(t.dueDate === undefined) t.dueDate = null; });
  if(store.data.infoCollapsed === undefined) store.data.infoCollapsed = false;
  if(!store.data.courseInfo) store.data.courseInfo = { professor: '', professorEmail: '', isAsync: false, classDays: [], classStart: '', classEnd: '', classRoom: '', officeHours: '' };
  if(store.data.courseInfo.isAsync === undefined) store.data.courseInfo.isAsync = false;
  if(store.data.courseInfo.professorEmail === undefined) store.data.courseInfo.professorEmail = '';
  if(!store.data.courseInfo.classDays) store.data.courseInfo.classDays = [];
  if(store.data.courseInfo.classStart === undefined) store.data.courseInfo.classStart = '';
  if(store.data.courseInfo.classEnd === undefined) store.data.courseInfo.classEnd = '';
  if(store.data.courseInfo.classRoom === undefined) store.data.courseInfo.classRoom = '';
  if(store.data.courseInfoCollapsed === undefined) store.data.courseInfoCollapsed = false;
  if(!store.data.categoryWeights) store.data.categoryWeights = {};
  if(!store.data.categoryNotes) store.data.categoryNotes = {};
  if(store.data.courseNotes === undefined) store.data.courseNotes = '';
  if(!store.data.courseImportantNotes) store.data.courseImportantNotes = [];
  if(!store.data.courseMaterials) store.data.courseMaterials = [];
  // migrate the old single-string field, if it's still hanging around
  if(store.data.courseImportantNote){
    store.data.courseImportantNotes.push(store.data.courseImportantNote);
    delete store.data.courseImportantNote;
  }
  if(store.data.bought.length > 0){
    let restoreCat = store.data.categories.find(c => c.name === 'previously completed');
    if(!restoreCat){
      restoreCat = {id: uid(), name: 'previously completed', items: []};
      store.data.categories.push(restoreCat);
    }
    store.data.bought.forEach(b => {
      restoreCat.items.push({id: b.id || uid(), title: b.title || 'item', notes:'', images:[], links:[], subitems:[], completed:true});
    });
    store.data.bought = [];
  }
  // a stale activeTab can point at a feature this space doesn't have (e.g.
  // after switching from a full-featured space into a bare-bones one)
  if(ui.activeTab === 'quick' && !store.features.includes('shopping')) ui.activeTab = 'board';
  if(ui.activeTab === 'todo' && !store.features.includes('todo')) ui.activeTab = 'board';
}

// Weighted running grade from graded assignments only. Categories with no
// graded items yet are excluded and the remaining weight is renormalized,
// so an empty "exams" category doesn't drag the grade toward zero.
export function computeRunningGrade(){
  const weights = store.data.categoryWeights || {};
  let weightedSum = 0, weightUsed = 0;
  store.data.categories.forEach(cat => {
    const w = Number(weights[cat.id]) || 0;
    if(w <= 0) return;
    const graded = (cat.items || []).filter(it => it.maxScore && it.score !== undefined && it.score !== null && it.score !== '');
    if(graded.length === 0) return;
    const earned = graded.reduce((s,it) => s + Number(it.score), 0);
    const possible = graded.reduce((s,it) => s + Number(it.maxScore), 0);
    if(possible <= 0) return;
    weightedSum += (earned / possible) * w;
    weightUsed += w;
  });
  if(weightUsed === 0) return null;
  return (weightedSum / weightUsed) * 100;
}

// % of assignments (across all categories) marked completed.
export function computeCourseProgress(){
  let total = 0, done = 0;
  store.data.categories.forEach(cat => {
    (cat.items || []).forEach(it => { total++; if(it.completed) done++; });
  });
  if(total === 0) return { pct: 0, total: 0, done: 0 };
  return { pct: (done / total) * 100, total, done };
}

// Nearest not-yet-done assignment with a due date, across all categories.
export function computeNextDue(){
  let next = null;
  store.data.categories.forEach(cat => {
    (cat.items || []).forEach(it => {
      if(it.completed || !it.dueDate) return;
      if(!next || it.dueDate < next.dueDate) next = it;
    });
  });
  return next;
}



let unsubscribeSpace = null;
let unsubscribeIndex = null;

export async function loadData(){
  await migrateLegacyIfNeeded();
  subscribeSpacesIndex();
  const last = localStorage.getItem(LAST_SPACE_KEY);
  if(last){ openSpace(last); } else { render(); }
}

function subscribeSpacesIndex(){
  try{
    const raw = localStorage.getItem(SPACES_INDEX_KEY);
    if(raw) store.spaces = JSON.parse(raw);
  }catch(e){}

  if(unsubscribeIndex) unsubscribeIndex();
  unsubscribeIndex = spacesCol.onSnapshot((snap) => {
    store.spaces = snap.docs.map((d, i) => ({ id: d.id, name: d.data().name || 'untitled', features: d.data().features || [], order: d.data().order !== undefined ? d.data().order : 10000 + i, archived: !!d.data().archived }));
    store.spaces.sort((a, b) => a.order - b.order);
    snap.docs.forEach(d => {
      // currently-open space already has the freshest data in store.data, so
      // don't let a possibly-stale cached copy stomp on unsaved local edits
      if(d.id === store.currentSpaceId) return;
      const raw = d.data().state;
      if(!raw) return;
      try{ spaceDataCache[d.id] = JSON.parse(raw); }catch(e){ /* leave whatever was cached before */ }
    });
    try{ localStorage.setItem(SPACES_INDEX_KEY, JSON.stringify(store.spaces)); }catch(e){}
    if(!store.currentSpaceId) render();
  }, (err) => console.error('spaces index sync error', err));
}

// All not-done "stuff to do" items across every space that has the todo
// feature, tagged with which space they came from. Sourced from the warm
// cache above, so no extra reads.
export function getAllHomeTasks(){
  const tasks = [];
  store.spaces.forEach(s => {
    if(s.archived) return;
    if(!(s.features || []).includes('todo')) return;
    const cached = spaceDataCache[s.id];
    if(!cached || !cached.todoList) return;
    cached.todoList.forEach(t => {
      if(t.done) return;
      tasks.push({ ...t, spaceId: s.id, spaceName: s.name });
    });
  });
  tasks.sort((a,b) => {
    if(a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if(a.dueDate) return -1;
    if(b.dueDate) return 1;
    return 0;
  });
  return tasks;
}

export async function toggleHomeTask(spaceId, taskId){
  const cached = spaceDataCache[spaceId];
  if(!cached || !cached.todoList) return;
  const task = cached.todoList.find(t => t.id === taskId);
  if(!task) return;
  task.done = !task.done;
  render();
  try{ await spacesCol.doc(spaceId).set({ state: JSON.stringify(cached) }, { merge: true }); }
  catch(e){ console.error('home task toggle sync failed', e); }
}

export function openSpace(id){
  if(unsubscribeSpace) unsubscribeSpace();
  store.currentSpaceId = id;
  ui.activeTab = 'board';
  try{ localStorage.setItem(LAST_SPACE_KEY, id); }catch(e){}

  try{
    const raw = localStorage.getItem(STORAGE_PREFIX + id);
    store.data = raw ? JSON.parse(raw) : defaultState();
  }catch(e){ store.data = defaultState(); }
  const cached = (store.spaces.find(s => s.id === id) || {}).features;
  store.features = cached || [];
  normalizeState();
  render();

  let isFirstSnapshot = true;
  unsubscribeSpace = spacesCol.doc(id).onSnapshot((doc) => {
    if(doc.metadata.hasPendingWrites){ isFirstSnapshot = false; return; }
    if(doc.exists){
      const d = doc.data();
      store.features = d.features || [];
      let incoming;
      try{ incoming = d.state ? JSON.parse(d.state) : null; }catch(e){
        console.error('Firestore data corrupt, keeping current store.data', e);
        incoming = null;
      }
      if(incoming){
        const incomingCatCount = (incoming.categories||[]).length;
        const currentCatCount = (store.data.categories||[]).length;
        if(currentCatCount >= 3 && incomingCatCount === 0 && !d.intentionalEmpty){
          console.error('Blocked a sync that would have wiped', currentCatCount, 'categories down to 0. Keeping current data and backing it up locally.');
          saveLocalBackup(id, store.data);
          isFirstSnapshot = false;
          return;
        }
        store.data = incoming;
      }
    }
    isFirstSnapshot = false;
    normalizeState();
    saveLocalBackup(id, store.data);
    try{ localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(store.data)); }catch(e){}
    render();
  }, (err) => console.error('space sync error', err));
}

export function goHome(){
  if(store.currentSpaceId && store.data){
    spaceDataCache[store.currentSpaceId] = store.data;
  }
  if(unsubscribeSpace) unsubscribeSpace();
  unsubscribeSpace = null;
  store.currentSpaceId = null;
  store.data = null;
  store.features = [];
  ui.homeEditMode = false;
  try{ localStorage.removeItem(LAST_SPACE_KEY); }catch(e){}
  render();
}

export async function createSpace(name, features){
  const cleanName = (name || '').trim() || 'untitled space';
  const id = uid();
  const state = defaultState(cleanName);
  const maxOrder = store.spaces.reduce((m, s) => Math.max(m, s.order ?? 0), -1);
  try{
    await spacesCol.doc(id).set({ name: cleanName, features: features || [], order: maxOrder + 1, state: JSON.stringify(state) });
  }catch(e){
    console.error('create space failed', e);
    alert('Could not create that space — check your connection and try again.');
    return;
  }
  openSpace(id);
}

export async function moveSpace(id, dir){
  const idx = store.spaces.findIndex(s => s.id === id);
  const swapWith = dir === 'up' ? idx - 1 : idx + 1;
  if(idx === -1 || swapWith < 0 || swapWith >= store.spaces.length) return;
  [store.spaces[idx], store.spaces[swapWith]] = [store.spaces[swapWith], store.spaces[idx]];
  render();
  try{
    const batch = db.batch();
    store.spaces.forEach((s, i) => { s.order = i; batch.set(spacesCol.doc(s.id), { order: i }, { merge: true }); });
    await batch.commit();
  }catch(e){ console.error('reorder spaces failed', e); }
}

export async function setSpaceArchived(id, archived){
  const s = store.spaces.find(x => x.id === id);
  if(s) s.archived = archived;
  render();
  try{ await spacesCol.doc(id).set({ archived }, { merge: true }); }
  catch(e){ console.error('archive toggle failed', e); }
}

export async function renameSpace(name){
  const cleanName = (name || '').trim() || store.data.title;
  store.data.title = cleanName;
  render();
  await saveData();
  if(store.currentSpaceId){
    try{ await spacesCol.doc(store.currentSpaceId).set({ name: cleanName }, { merge: true }); }
    catch(e){ console.error('rename sync failed', e); }
  }
}

export async function toggleFeature(featureId){
  const set = new Set(store.features);
  if(set.has(featureId)) set.delete(featureId); else set.add(featureId);
  store.features = Array.from(set);
  normalizeState();
  render();
  if(store.currentSpaceId){
    try{ await spacesCol.doc(store.currentSpaceId).set({ features: store.features }, { merge: true }); }
    catch(e){ console.error('feature toggle sync failed', e); }
  }
}

export async function deleteSpace(id){
  const space = store.spaces.find(s => s.id === id);
  if(!confirm(`Delete "${space ? space.name : 'this space'}"? Everything in it will be gone for good.`)) return;
  try{ await spacesCol.doc(id).delete(); }
  catch(e){ console.error('delete space failed', e); alert('Could not delete that space — check your connection and try again.'); return; }
  try{ localStorage.removeItem(STORAGE_PREFIX + id); }catch(e){}
  if(store.currentSpaceId === id) goHome();
}


export function saveLocalBackup(spaceId, s){
  try{
    for(let i = BACKUP_SLOT_COUNT - 1; i > 0; i--){
      const prev = localStorage.getItem(BACKUP_PREFIX + spaceId + '-' + (i-1));
      if(prev) localStorage.setItem(BACKUP_PREFIX + spaceId + '-' + i, prev);
    }
    localStorage.setItem(BACKUP_PREFIX + spaceId + '-0', JSON.stringify({when: Date.now(), state: s}));
  }catch(e){ console.error('local backup failed', e); }
}

export function getNewestLocalBackup(){
  if(!store.currentSpaceId) return null;
  for(let i = 0; i < BACKUP_SLOT_COUNT; i++){
    const raw = localStorage.getItem(BACKUP_PREFIX + store.currentSpaceId + '-' + i);
    if(raw){ try{ return JSON.parse(raw); }catch(e){} }
  }
  return null;
}

export async function saveData(intentionalEmpty){
  if(!store.currentSpaceId) return;
  try{ localStorage.setItem(STORAGE_PREFIX + store.currentSpaceId, JSON.stringify(store.data)); }
  catch(e){ console.error('local save failed', e); }
  saveLocalBackup(store.currentSpaceId, store.data);
  try{ await spacesCol.doc(store.currentSpaceId).set({ state: JSON.stringify(store.data), intentionalEmpty: !!intentionalEmpty }, { merge: true }); }
  catch(e){
    console.error('cloud save failed', e);
    alert('Your change saved on this device, but failed to sync to the cloud (' + (e.message || 'unknown error') + '). It will keep retrying — if this keeps happening, tell Claude.');
  }
}


export async function resetAll(){
  if(!confirm('Clear this whole space? This removes every category, item, and the completed pile.')) return;
  if(!confirm('Really sure? This cannot be undone.')) return;
  saveLocalBackup(store.currentSpaceId, store.data);
  store.data = defaultState(store.data.title);
  normalizeState();
  render(); await saveData(true);
}

// One-time move of the old single-board data into a proper "Move-In" space,
// so nothing already on the board gets lost when this rolls out.
async function migrateLegacyIfNeeded(){
  if(localStorage.getItem(MIGRATED_KEY)) return;
  try{
    const existing = await spacesCol.limit(1).get();
    if(!existing.empty){ localStorage.setItem(MIGRATED_KEY, '1'); return; }
    const legacyDoc = await legacyBoardRef.get();
    if(legacyDoc.exists && legacyDoc.data().state){
      const legacyState = legacyDoc.data().state;
      let parsed = null;
      try{ parsed = JSON.parse(legacyState); }catch(e){}
      const name = (parsed && parsed.title) || 'Move-In';
      await spacesCol.doc('move-in').set({
        name,
        features: ['shopping', 'todo', 'info'],
        state: legacyState
      });
    }
    localStorage.setItem(MIGRATED_KEY, '1');
  }catch(e){
    console.error('legacy migration check failed', e);
  }
}

loadData();
