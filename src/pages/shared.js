import { render } from '../app/router.js';
import { actorName, isUnread, markRead, myNotifs } from '../lib/permissions.js';
import { save } from '../lib/store.js';
import { esc, nextId, nowTime, rel, today } from '../lib/utils.js';
import { S } from '../state.js';
import { call } from '../ui/components.js';
/* ==========================================================================
   Shared data helpers
   ========================================================================== */
export const att = (sid, date) => S.db.attendance.find(a => a.studentId === sid && a.date === date);
export const classStudents = cl => S.db.students.filter(s => s.class === cl);
export const subOf = (cl, d) => S.db.attSubs.find(s => s.class === cl && s.date === d);
export const outsideNow = () =>
  S.db.attendance.filter(a => a.date === today() && a.status === 'Outside Campus');
export function setAtt(sid, date, status, extra = {}) {
  let r = att(sid, date);
  if (!r) {
    r = { id: nextId(S.db.attendance), studentId: sid, date, status: '', time: '', note: '' };
    S.db.attendance.push(r);
  }
  const prev = r.status;
  r.time = extra.time || (prev === status && r.time ? r.time : nowTime());
  r.note =
    extra.note !== undefined ? extra.note : status === 'Outside Campus' && prev === status ? r.note : '';
  r.status = status;
  r.by = actorName();
  if (status !== 'Outside Campus') {
    delete r.returnedAt;
    delete r.outAt;
  }
  return r;
}
export function leaveCovering(sid, date) {
  return S.db.leaves.find(
    l =>
      l.studentId === sid &&
      ['Approved', 'Awaiting Clearance', 'Cleared'].includes(l.status) &&
      l.from <= date &&
      l.to >= date,
  );
}
export function feeStatus(f) {
  return f.status === 'Paid' ? 'Paid' : f.due && f.due < today() ? 'Overdue' : 'Pending';
}
export function attPct(sid) {
  const own = S.db.attendance.filter(a => a.studentId === sid),
    p = own.filter(a => a.status === 'Present' || a.status === 'Late').length;
  return { n: own.length, pct: own.length ? Math.round((p / own.length) * 100) : 0 };
}
export function shortcuts(list) {
  return `<h2 class="play-heading">Shortcuts</h2><div class="play-actions">${list
    .slice(0, 4)
    .map(
      ([i, l, d, p, s], k) =>
        `<button class="play-action tone-${k}" onclick="${call('go', p, s || '')}"><span class="play-action-icon">${i}</span><b>${esc(l)}</b><small>${esc(d)}</small><span class="action-arrow">↗</span></button>`,
    )
    .join('')}</div>`;
}
export function updatesPanel(limit = 3, skipKind = '') {
  const list = myNotifs()
    .filter(n => isUnread(n) && !n.action && !(skipKind && n.kind === skipKind))
    .slice(0, limit);
  return `<div class="play-panel"><div class="play-panel-head"><h2>💬 Updates</h2><button onclick="go('Notifications')">See all →</button></div>${list.length ? list.map(n => `<div class="play-notice" role="button" tabindex="0" style="cursor:pointer" onclick="openNotif(${n.id})" onkeydown="if(event.key==='Enter')this.click()">${n.icon} ${esc(n.text)} <small>${esc(rel(n.at))}</small></div>`).join('') : '<div class="play-notice">🌿 You’re all caught up.</div>'}</div>`;
}
export function welcome(kicker, title, sub, mascot = '🎒') {
  return `<div class="play-welcome"><div class="welcome-kicker">✦ ${esc(kicker)}</div><div class="welcome-flex"><div><h1>${title}</h1><p>${esc(sub)}</p></div><div class="play-mascot" aria-hidden="true">${mascot}<span>✨</span></div></div></div>`;
}
export function importantBanner() {
  const a = S.db.announcements.filter(x => x.important).sort((x, y) => y.at.localeCompare(x.at))[0];
  if (!a) return '';
  const n = myNotifs().find(x => x.ref === 'ann:' + a.id);
  if (!n || !isUnread(n)) return '';
  return `<div class="banner">📢 <span><b>${esc(a.title)}</b> — ${esc(a.body)}</span><button class="btn sm" style="margin-left:auto" onclick="dismissNotif(${n.id})">Got it</button></div>`;
}
export function dismissNotif(id) {
  const n = S.db.notifications.find(x => x.id === id);
  if (n) {
    markRead(n);
    save();
    render();
  }
}
