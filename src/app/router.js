import { HOMES, PAGES } from './registry.js';
import { counts, navAll } from './structure.js';
import { ICONS } from '../lib/constants.js';
import { markRead, me, unreadCount } from '../lib/permissions.js';
import { save } from '../lib/store.js';
import { $, esc, js } from '../lib/utils.js';
import { studentDetail } from '../pages/admin.js';
import { feeTaskDetail } from '../pages/fees.js';
import { bookingDetail } from '../pages/lab.js';
import { leaveDetail } from '../pages/leave.js';
import { medicalDetail } from '../pages/medical.js';
import { requestDetail } from '../pages/requests.js';
import { followupDetail } from '../pages/verification.js';
import { S } from '../state.js';
import { calm, heading } from '../ui/components.js';
import { closeModal, toast } from '../ui/feedback.js';
/* ---------- router ---------- */
export function go(p, s = '', open = '') {
  S.pendingOpen = open || '';
  const h = '#/' + encodeURIComponent(p) + (s ? '/' + encodeURIComponent(s) : '');
  if (location.hash === h) route();
  else location.hash = h;
}
export function goBack() {
  if (history.length > 1) history.back();
  else go('Home');
}
export function parseHash() {
  const h = location.hash
    .replace(/^#\/?/, '')
    .split('/')
    .map(x => {
      try {
        return decodeURIComponent(x);
      } catch {
        return x;
      }
    });
  return { p: h[0] || 'Home', s: h[1] || '' };
}
export function route() {
  const { p, s } = parseHash(),
    it = navAll().find(n => n.page === p);
  if (!it) {
    if (p !== 'Home') toast('“' + p + '” isn’t available in your portal', 'info');
    S.page = 'Home';
    S.section = '';
    history.replaceState(null, '', '#/Home');
  } else {
    S.page = p;
    S.section = it.sections.length ? (it.sections.includes(s) ? s : it.sections[0]) : '';
  }
  $('sidebar').classList.remove('open');
  closeModal();
  const c = $('content');
  c.classList.remove('anim');
  void c.offsetWidth;
  c.classList.add('anim');
  render();
  window.scrollTo(0, 0);
  if (S.pendingOpen) {
    const r = S.pendingOpen;
    S.pendingOpen = '';
    setTimeout(() => openRef(r), 40);
  }
}
/** Listen for URL hash changes (back/forward buttons, links). */
export function initRouter() {
  window.addEventListener('hashchange', route);
}
/* ---------- shell render ---------- */
export function render() {
  const nav = navAll(),
    c = counts(),
    m = me();
  $('rolepill').innerHTML =
    `<span id="syncdot" class="syncdot" title="All changes saved"></span>${esc(S.profile?.display_name || S.role)} <span class="muted" style="font-weight:700">· ${esc(S.profile?.login_id || '')}</span>`;
  let html = `<div class="small">${esc(S.role.toUpperCase())} PORTAL</div>`,
    grp = '';
  nav
    .filter(n => n.page !== 'Profile')
    .forEach(n => {
      if (n.group && n.group !== grp) {
        grp = n.group;
        html += `<div class="small">${esc(grp.toUpperCase())}</div>`;
      }
      html += `<button class="navbtn ${S.page === n.page ? 'active' : ''}" onclick="go(${js(n.page)})" ${S.page === n.page ? 'aria-current="page"' : ''}><span class="ico">${ICONS[n.page] || '▤'}</span>${esc(n.page)}${c[n.page] ? `<span class="navcount">${c[n.page]}</span>` : ''}</button>`;
    });
  $('navigation').innerHTML = html;
  $('profilenav').classList.toggle('active', S.page === 'Profile');
  $('breadcrumb').innerHTML =
    `<button onclick="go('Home')" class="hidem">${esc(S.role)}</button><span class="hidem">›</span>` +
    (S.page === 'Home'
      ? '<b>Home</b>'
      : `<button onclick="go(${js(S.page)})">${esc(S.page)}</button>` +
        (S.section ? `<span>›</span><b>${esc(S.section)}</b>` : ''));
  const u = unreadCount();
  $('bellbtn').innerHTML = '🔔' + (u ? `<span class="bellcount">${u > 9 ? '9+' : u}</span>` : '');
  $('content').innerHTML =
    !m && S.role === 'Student'
      ? heading('Profile not found') +
        calm('🎓', 'Your student record is missing', 'Please contact the office.')
      : !m && S.role === 'Staff'
        ? heading('Profile not found') +
          calm('🧑‍🏫', 'Your staff record is missing', 'Please contact the office.')
        : renderPage();
  document.title = S.page === 'Home' ? 'OURCAMPUS' : S.page + ' · OURCAMPUS';
}
export function renderPage() {
  const P = PAGES[S.page];
  if (S.page === 'Home') return HOMES[S.role]();
  return P ? P() : heading(S.page) + calm('🧭', 'This page is not available here');
}
/* ---------- open a specific record (from notifications/search) ---------- */
export function openRef(ref) {
  const [k, id] = String(ref).split(':'),
    n = +id;
  (
    ({
      leave: () => leaveDetail(n),
      req: () => requestDetail(n),
      med: () => medicalDetail(n),
      fee: () => feeTaskDetail(n),
      lab: () => bookingDetail(n),
      fu: () => followupDetail(n),
      student: () => studentDetail(n),
    })[k] || (() => {})
  )();
}
export function openNotif(id) {
  const n = S.db.notifications.find(x => x.id === id);
  if (!n) return;
  markRead(n);
  save();
  if (n.link) {
    const [p, s, r] = n.link;
    if (!navAll().some(x => x.page === p)) {
      render();
      toast('This item is handled in another portal', 'info');
      return;
    }
    go(p, s || '', r || '');
  } else render();
}
