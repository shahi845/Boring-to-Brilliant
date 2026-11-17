import { nextId, stamp } from './utils.js';
import { S } from '../state.js';
/* ---------- notifications ---------- */
export function notify(to, text, o = {}) {
  S.db.notifications.push({
    id: nextId(S.db.notifications),
    to: [].concat(to),
    text,
    icon: o.icon || '🔔',
    link: o.link || null,
    ref: o.ref || '',
    action: !!o.action,
    kind: o.kind || '',
    at: o.at || stamp(),
    readBy: o.readBy || [],
    handled: false,
  });
}
export function resolveRef(ref) {
  S.db.notifications.forEach(n => {
    if (n.ref === ref && n.action) n.handled = true;
  });
}
export function leaders(kind) {
  const a = S.db.settings[kind];
  return a === 'Principal only'
    ? ['role:Principal']
    : a === 'Vice Principal only'
      ? ['role:Vice Principal']
      : ['role:Principal', 'role:Vice Principal'];
}
export function handlerKey(type) {
  const h = S.db.settings.routing[type] || 'Admin office';
  return h === 'Academic Assistant'
    ? 'position:Academic Assistant'
    : h === 'Librarian'
      ? 'position:Librarian'
      : 'role:Admin';
}
export function handlerLink(type, ref) {
  const h = S.db.settings.routing[type] || 'Admin office';
  return h === 'Academic Assistant'
    ? ['Verification', 'Corrections', ref]
    : h === 'Librarian'
      ? ['Library', 'Clearance Requests', ref]
      : ['Official Requests', 'Queue', ref];
}
