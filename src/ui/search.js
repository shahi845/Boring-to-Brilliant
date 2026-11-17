import { go } from '../app/router.js';
import { navAll } from '../app/structure.js';
import { ICONS } from '../lib/constants.js';
import { $, esc } from '../lib/utils.js';
import { editStaff, studentDetail } from '../pages/admin.js';
import { S } from '../state.js';
import { closeModal, modal } from './feedback.js';
/* ---------- search palette ---------- */
export let palSel = 0,
  palItems = [];
export function openPalette() {
  modal(
    `<input id="palq" placeholder="Search pages${S.role !== 'Student' ? ', students, staff' : ''}…" autocomplete="off" oninput="palSel=0;renderPalette()" onkeydown="palKey(event)" aria-label="Search"><div class="res" id="palres"></div>`,
    'palette',
  );
  setTimeout(() => {
    $('palq')?.focus();
    renderPalette();
  }, 35);
}
export function renderPalette() {
  const q = ($('palq')?.value || '').toLowerCase().trim();
  palItems = [];
  navAll().forEach(n => {
    if (!q || n.page.toLowerCase().includes(q))
      palItems.push({ g: 'Pages', i: ICONS[n.page] || '▤', t: n.page, s: '', fn: () => go(n.page) });
    n.sections.forEach(s => {
      if (q && (n.page + ' ' + s).toLowerCase().includes(q))
        palItems.push({ g: 'Sections', i: '↳', t: s, s: n.page, fn: () => go(n.page, s) });
    });
  });
  if (q && S.role !== 'Student') {
    S.db.students
      .filter(s => (s.name + ' ' + s.class + ' ' + s.roll).toLowerCase().includes(q))
      .slice(0, 8)
      .forEach(s =>
        palItems.push({
          g: 'Students',
          i: '🎓',
          t: s.name,
          s: s.class + ' · ' + s.roll,
          fn: () => studentDetail(s.id),
        }),
      );
  }
  if (q && S.role === 'Admin') {
    S.db.staff
      .filter(s => (s.name + ' ' + s.positions.join(' ')).toLowerCase().includes(q))
      .forEach(s =>
        palItems.push({
          g: 'Staff',
          i: '🧑‍🏫',
          t: s.name,
          s: s.positions.join(', '),
          fn: () => {
            go('Staff Management');
            setTimeout(() => editStaff(s.id), 60);
          },
        }),
      );
  }
  let g = '',
    h = '';
  palItems.forEach((x, i) => {
    if (x.g !== g) {
      g = x.g;
      h += `<div class="grp">${esc(g.toUpperCase())}</div>`;
    }
    h += `<button class="${i === palSel ? 'sel' : ''}" onclick="palGo(${i})"><span>${x.i}</span>${esc(x.t)}<small>${esc(x.s)}</small></button>`;
  });
  $('palres').innerHTML = h || '<div class="empty">No results. Try another word.</div>';
}
export function palKey(e) {
  if (e.key === 'ArrowDown') {
    palSel = Math.min(palSel + 1, palItems.length - 1);
    renderPalette();
    e.preventDefault();
  } else if (e.key === 'ArrowUp') {
    palSel = Math.max(palSel - 1, 0);
    renderPalette();
    e.preventDefault();
  } else if (e.key === 'Enter') {
    palGo(palSel);
  }
}
export function palGo(i) {
  const x = palItems[i];
  if (!x) return;
  closeModal();
  x.fn();
}
/** Keyboard shortcuts: Ctrl/⌘+K opens search, Esc closes dialogs. */
export function initShortcuts() {
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openPalette();
    } else if (e.key === 'Escape' && $('overlay').innerHTML) closeModal();
  });
}
