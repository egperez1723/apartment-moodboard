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
  { id: 'info', label: 'info card' }
];

// `store.data` holds the currently open space's board (categories, shopping
// list, etc). `store.spaces` is the lightweight list for the home screen.
// `store.currentSpaceId` / `store.features` describe which space is open.
export const store = { data: null, spaces: [], currentSpaceId: null, features: [] };

// `ui` holds transient interface state (which modal is open, which tab is
// active, etc) — never saved to the cloud, just what's currently on screen.
export const ui = {
  editingDate: false,
  openItemId: null,
  addingCategory: false,
  catEditMode: false,
  moodViewCats: new Set(),
  catQuickAddOpen: null,
  budgetModalOpen: false,
  editingQuickId: null,
  editingInfo: false,
  viewingInfo: false,
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
  spaceSettingsOpen: false
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
    infoCollapsed: false
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
  if(store.data.infoCollapsed === undefined) store.data.infoCollapsed = false;
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
    store.spaces = snap.docs.map(d => ({ id: d.id, name: d.data().name || 'untitled', features: d.data().features || [] }));
    try{ localStorage.setItem(SPACES_INDEX_KEY, JSON.stringify(store.spaces)); }catch(e){}
    if(!store.currentSpaceId) render();
  }, (err) => console.error('spaces index sync error', err));
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
  try{
    await spacesCol.doc(id).set({ name: cleanName, features: features || [], state: JSON.stringify(state) });
  }catch(e){
    console.error('create space failed', e);
    alert('Could not create that space — check your connection and try again.');
    return;
  }
  openSpace(id);
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
