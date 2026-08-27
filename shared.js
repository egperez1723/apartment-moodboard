// Pure helper functions and constants used across feature modules.
// No dependency on app state — safe to import from anywhere.

export function uid(){ return 'x' + Math.random().toString(36).slice(2,9); }

export function escapeHtml(s){ const d = document.createElement('div'); d.innerText = s || ''; return d.innerHTML; }

export function faviconFor(link){
  try{ const u = new URL(link); return `https://www.google.com/s2/favicons?sz=64&domain=${u.hostname}`; }
  catch(e){ return null; }
}


export const PENCIL_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`;
export const EXPAND_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>`;
export const COLLAPSE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/></svg>`;
export const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l6 6L20 6"/></svg>`;
export const COPY_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`;
export const IMAGE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/></svg>`;
export const RECEIPT_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-3-2-2 2-2-2-2 2-2-2-1 2z"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/></svg>`;
export const CARD_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="7" y1="15" x2="11" y2="15"/></svg>`;
export const NOTE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>`;
export const BACK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>`;
export const CALENDAR_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`;

// Per-space icon set (pick a symbol per space so the home screen isn't a
// wall of identical cards). Stored on the space doc as an id string; new
// icons can be added here without touching Firestore.
export const SPACE_ICONS = {
  pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c-3.3 0-6 2.6-6 6 0 4.5 6 12 6 12s6-7.5 6-12c0-3.4-2.7-6-6-6z"/><circle cx="12" cy="8" r="2.2"/></svg>`,
  pencil: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 20 L5.2 15.6 L15.6 5.2 C16.4 4.4 17.6 4.4 18.4 5.2 L18.8 5.6 C19.6 6.4 19.6 7.6 18.8 8.4 L8.4 18.8 L4 20 Z"/><path d="M14 7.5 L16.5 10" stroke-linecap="round"/></svg>`,
  building: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M5 20 V8 L12 4 L19 8 V20"/><path d="M5 20 H19"/><path d="M9 20 V13 H15 V20"/><path d="M9 9.5 H15" stroke-width="1.2"/></svg>`,
  city: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M3 20 V10 L8 7 V20"/><path d="M8 20 V4 L14 6.5 V20"/><path d="M14 20 V9 L20 11 V20"/><path d="M3 20 H20"/><path d="M10.2 10 h1.6 M10.2 13 h1.6 M16 13 h1.6" stroke-width="1.2" stroke-linecap="round"/></svg>`,
  scale: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 V20"/><path d="M6 20 H18"/><path d="M12 5.5 L5 8.5 M12 5.5 L19 8.5"/><path d="M5 8.5 L2.5 13.5 A3 3 0 0 0 7.5 13.5 Z" stroke-width="1.4"/><path d="M19 8.5 L16.5 13.5 A3 3 0 0 0 21.5 13.5 Z" stroke-width="1.4"/></svg>`,
  clipboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4.5" width="14" height="16" rx="2"/><rect x="9" y="3" width="6" height="3" rx="1"/><path d="M8.5 12 L11 14.5 L16 9.5"/></svg>`,
  briefcase: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="3.5" y="8" width="17" height="11" rx="2"/><path d="M8.5 8 V6 A2 2 0 0 1 10.5 4 H13.5 A2 2 0 0 1 15.5 6 V8"/><path d="M3.5 13 H20.5"/><path d="M11 12.5 H13"/></svg>`,
  book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5c2-1 5-1 8 0v13c-3-1-6-1-8 0z"/><path d="M20 5.5c-2-1-5-1-8 0v13c3-1 6-1 8 0z"/></svg>`,
  flask: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6"/><path d="M10 3v6.5L4.8 18.2A2 2 0 0 0 6.5 21h11a2 2 0 0 0 1.7-2.8L14 9.5V3"/><path d="M7.5 15h9"/></svg>`,
  calculator: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><rect x="7.5" y="5.5" width="9" height="4" rx="0.5"/><path d="M7.5 13.5h.01M12 13.5h.01M16.5 13.5h.01M7.5 17h.01M12 17h.01M16.5 17h.01"/></svg>`
};
export const SPACE_ICON_IDS = Object.keys(SPACE_ICONS);
export function spaceIconSvg(id){ return SPACE_ICONS[id] || SPACE_ICONS.pin; }

// Accent color options for a space's icon chip + card border. Keys map to
// CSS vars so the palette stays in one place (style.css :root).
export const SPACE_ACCENTS = {
  terracotta: { var: '--terracotta', soft: '--terracotta-soft' },
  sage: { var: '--sage-dark', soft: '--sage' },
  plum: { var: '--plum', soft: '--plum-soft' }
};
export const SPACE_ACCENT_IDS = Object.keys(SPACE_ACCENTS);


const CAT_COLORS = ['var(--blush)','var(--sage)','var(--butter)','var(--lavender)','var(--terracotta)','#a9c4c9'];
export function catColor(index){ return CAT_COLORS[index % CAT_COLORS.length]; }

export function daysUntil(dateStr){
  if(!dateStr) return null;
  const [datePart, timePart] = dateStr.split('T');
  const [y, m, dd] = datePart.split('-').map(Number);
  const [hh, mm] = (timePart || '00:00').split(':').map(Number);
  const target = new Date(y, m - 1, dd, hh, mm, 0, 0);
  const now = new Date();
  const diffMs = target - now;
  const totalMinutes = Math.floor(diffMs / (1000*60));
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(Math.abs(totalHours) / 24) * (totalHours < 0 ? -1 : 1);
  const hours = totalHours - days*24;
  return {days, hours: Math.abs(hours), totalHours, past: diffMs < 0};
}



export function compressImage(file, maxDim, cb){
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if(w > h && w > maxDim){ h = Math.round(h * maxDim / w); w = maxDim; }
      else if(h > maxDim){ w = Math.round(w * maxDim / h); h = maxDim; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      cb(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

