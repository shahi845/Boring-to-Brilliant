import { S } from '../state.js';
/* ---------- utilities ---------- */
export const $ = id => document.getElementById(id);
export const pad = n => String(n).padStart(2, '0');
export const dstr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export function today() {
  return dstr(new Date());
}
export function addDays(s, n) {
  const d = new Date(s + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return dstr(d);
}
export function nowTime() {
  const d = new Date();
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}
export function stamp() {
  return today() + ' ' + nowTime();
}
export function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(String(s).slice(0, 10) + 'T00:00:00');
  if (isNaN(d)) return esc(s);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
export function fmtDay(s) {
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short' });
}
export function fmtRange(a, b) {
  return a === b || !b ? fmtDate(a) : fmtDate(a) + ' – ' + fmtDate(b);
}
export function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5) + 1;
}
export function fmtTime(t) {
  if (!t) return '';
  const [h, m] = String(t).split(':').map(Number);
  if (isNaN(h)) return esc(t);
  return (h % 12 || 12) + ':' + pad(m || 0) + (h < 12 ? ' AM' : ' PM');
}
export function rel(ts) {
  if (!ts) return '';
  const [d, t] = String(ts).split(' ');
  if (d === today()) return t ? 'Today, ' + fmtTime(t) : 'Today';
  if (d === addDays(today(), -1)) return 'Yesterday' + (t ? ', ' + fmtTime(t) : '');
  return fmtDate(d);
}
export function esc(x) {
  return String(x ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}
export function js(x) {
  return esc(JSON.stringify(x));
}
export function nextId(arr) {
  const m = Math.max(0, ...arr.map(x => +x.id || 0));
  return S.db && S.db.__seeding ? m + 1 : Math.max(m + 1, Date.now() * 10 + Math.floor(Math.random() * 10));
}
export function greet() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
export function initials(n) {
  return String(n)
    .replace(/^(Usthad|Ms\.|Mr\.|Dr\.)\s+/, '')
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0] || '')
    .join('')
    .toUpperCase();
}
export const AV = ['#0e9f9a', '#1cb0f6', '#ff7a59', '#a56cf0', '#ff4b4b', '#2bb5a0'];
export function avatar(name, id) {
  return `<span class="avatar" style="background:${AV[(id || String(name).length) % AV.length]}" aria-hidden="true">${esc(initials(name))}</span>`;
}
export function plural(n, w, p) {
  return n + ' ' + (n === 1 ? w : p || w + 's');
}
export function firstName(n) {
  return String(n)
    .replace(/^(Usthad|Ms\.|Mr\.|Dr\.)\s+/, '')
    .split(' ')[0];
}
export function sName(id) {
  return S.db.students.find(s => s.id === id)?.name || 'Former student';
}
export function sClass(id) {
  return S.db.students.find(s => s.id === id)?.class || '—';
}
export function money(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN');
}
