import { $, esc } from '../lib/utils.js';
/* ---------- toast / modal / confirm ---------- */
export function toast(t, type = 'ok') {
  document.querySelector('.toast')?.remove();
  const e = document.createElement('div');
  e.className = 'toast ' + (type === 'ok' ? '' : type);
  e.setAttribute('role', 'status');
  e.textContent = (type === 'ok' ? '✓ ' : type === 'err' ? '⚠ ' : 'ℹ ') + t;
  document.body.append(e);
  setTimeout(() => e.remove(), 2800);
}
export function modal(html, cls = '') {
  $('overlay').innerHTML =
    `<div class="scrim" onmousedown="if(event.target===this)closeModal()"><div class="modal ${cls}" role="dialog" aria-modal="true">${html}</div></div>`;
  setTimeout(() => {
    const f = $('overlay').querySelector(
      'input:not([type=hidden]):not([readonly]),textarea,select,.modal button.btn',
    );
    f?.focus();
  }, 30);
}
export function closeModal() {
  $('overlay').innerHTML = '';
}
export function mhead(title, sub = '') {
  return `<div class="mhead"><div><h2>${esc(title)}</h2>${sub ? `<div class="muted">${sub}</div>` : ''}</div><button class="close" onclick="closeModal()" aria-label="Close">✕</button></div>`;
}
export let _confirm = null;
export function confirmBox(title, text, okLabel, cb, danger = false) {
  _confirm = cb;
  modal(
    mhead(title) +
      `<p>${text}</p><div class="formactions"><button class="btn ${danger ? 'danger' : 'primary'}" onclick="runConfirm()">${esc(okLabel)}</button><button class="btn" onclick="closeModal()">Cancel</button></div>`,
  );
}
export function runConfirm() {
  const cb = _confirm;
  _confirm = null;
  closeModal();
  cb && cb();
}
