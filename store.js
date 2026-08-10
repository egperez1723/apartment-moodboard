// Central app state (your board's data) + Firebase sync + local backups.
// This is the only module allowed to reassign `store.data` wholesale.
// Everyone else reads/writes properties on the shared `store` and `ui` objects.

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
const boardRef = db.collection('moodboard').doc('board');

const STORAGE_KEY = "apartment-moodboard-data-v2"; // local fallback only
let isFirstSnapshot = true;
let firestoreReady = false;

// `store.data` holds your actual board (categories, shopping list, etc).
// Kept as an object property (not a bare `let`) so every module can read
// and mutate it without needing setter functions for reassignment.
export const store = { data: null };

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
  modalAddingLink: false
};

export function defaultState(){
  return {
    title: "senior yr hq",
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
  if(!store.data.title) store.data.title = "senior yr hq";
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
}


export async function loadData(){
  // local fallback so something shows immediately / if offline
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    store.data = raw ? JSON.parse(raw) : defaultState();
  }catch(e){ store.data = defaultState(); }
  normalizeState();
  render();

  // live sync from Firestore — this is the source of truth once it connects
  boardRef.onSnapshot((doc) => {
    firestoreReady = true;
    if(doc.metadata.hasPendingWrites){
      // this is our own local write already reflected on screen — skip re-render so it doesn't steal focus
      isFirstSnapshot = false;
      return;
    }
    if(doc.exists){
      let incoming;
      try{
        incoming = doc.data().state ? JSON.parse(doc.data().state) : null;
      }catch(e){
        console.error('Firestore data corrupt, keeping current store.data', e);
        incoming = null;
      }
      if(incoming){
        // safety check: never silently accept a drastic, unexplained data loss from the cloud
        const incomingCatCount = (incoming.categories||[]).length;
        const currentCatCount = (store.data.categories||[]).length;
        if(currentCatCount >= 3 && incomingCatCount === 0 && !doc.data().intentionalEmpty){
          console.error('Blocked a sync that would have wiped', currentCatCount, 'categories down to 0. Keeping current data and backing it up locally.');
          saveLocalBackup(store.data);
          isFirstSnapshot = false;
          return;
        }
        store.data = incoming;
      }
    } else if(isFirstSnapshot && !localStorage.getItem(EVER_CONNECTED_KEY)){
      // genuinely brand new — nothing in Firestore yet, push up whatever we have locally
      boardRef.set({state: JSON.stringify(store.data)});
    }
    localStorage.setItem(EVER_CONNECTED_KEY, '1');
    isFirstSnapshot = false;
    normalizeState();
    saveLocalBackup(store.data);
    render();
  }, (err) => {
    console.error('Firestore sync error', err);
  });
}


const EVER_CONNECTED_KEY = 'apartment-moodboard-ever-connected';
const BACKUP_KEY_PREFIX = 'apartment-moodboard-autobackup-';
const BACKUP_SLOT_COUNT = 3;

export function saveLocalBackup(s){
  try{
    // rotate: shift older backups back before writing the newest into slot 0
    for(let i = BACKUP_SLOT_COUNT - 1; i > 0; i--){
      const prev = localStorage.getItem(BACKUP_KEY_PREFIX + (i-1));
      if(prev) localStorage.setItem(BACKUP_KEY_PREFIX + i, prev);
    }
    localStorage.setItem(BACKUP_KEY_PREFIX + '0', JSON.stringify({when: Date.now(), state: s}));
  }catch(e){ console.error('local backup failed', e); }
}

export function getNewestLocalBackup(){
  for(let i = 0; i < BACKUP_SLOT_COUNT; i++){
    const raw = localStorage.getItem(BACKUP_KEY_PREFIX + i);
    if(raw){ try{ return JSON.parse(raw); }catch(e){} }
  }
  return null;
}

export async function saveData(intentionalEmpty){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(store.data)); }
  catch(e){ console.error('local save failed', e); }
  saveLocalBackup(store.data);
  try{ await boardRef.set({state: JSON.stringify(store.data), intentionalEmpty: !!intentionalEmpty}); }
  catch(e){
    console.error('cloud save failed', e);
    alert('Your change saved on this device, but failed to sync to the cloud (' + (e.message || 'unknown error') + '). It will keep retrying — if this keeps happening, tell Claude.');
  }
}


export async function resetAll(){
  if(!confirm('Clear the whole board? This removes every category, item, and the completed pile.')) return;
  if(!confirm('Really sure? This cannot be undone. Everything on the mood board, shopping list stays, but all categories and items will be gone for good.')) return;
  saveLocalBackup(store.data);
  store.data = {title: store.data.title, moveInDate:null, categories:[], bought:[]};
  normalizeState();
  render(); await saveData(true);
}

loadData();

