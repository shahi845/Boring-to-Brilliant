import { BUILTIN_POSITIONS } from './constants.js';
import { leaders } from './notifications.js';
import { S } from '../state.js';
/* ---------- identity & permissions (preview only) ---------- */
export function me() {
  if (S.role === 'Student')
    return S.db.students.find(s => s.id === S.ui.studentId) || S.db.students[0] || null;
  if (S.role === 'Staff') return S.db.staff.find(s => s.id === S.ui.staffId) || S.db.staff[0] || null;
  if (S.role === 'Academic Assistant')
    return (
      S.db.staff.find(s => s.id === S.ui.aaId && s.positions.includes('Academic Assistant')) ||
      S.db.staff.find(s => s.positions.includes('Academic Assistant')) || {
        id: 0,
        name: 'Academic Assistant',
        department: '—',
        positions: ['Academic Assistant'],
        classes: [],
        ghost: true,
      }
    );
  return { id: 0, name: S.role, positions: [], classes: [] };
}
export function viewerId() {
  const m = me();
  if (S.role === 'Student') return 'student:' + (m?.id || 0);
  if (S.role === 'Staff' || S.role === 'Academic Assistant') return 'staff:' + (m?.id || 0);
  return 'role:' + S.role;
}
export function viewerKeys() {
  const m = me();
  if (S.role === 'Student') return ['student:' + (m?.id || 0), 'all', 'students'];
  if (S.role === 'Staff' || S.role === 'Academic Assistant') {
    const ks = ['staff:' + (m?.id || 0), 'all', 'staffAll'];
    (m?.positions || []).forEach(p => ks.push('position:' + p));
    if (S.role === 'Academic Assistant') ks.push('position:Academic Assistant');
    return ks;
  }
  return ['role:' + S.role, 'all', 'staffAll'];
}
export function myNotifs() {
  const k = viewerKeys();
  return S.db.notifications
    .filter(n => n.to.some(x => k.includes(x)))
    .sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id);
}
export function isUnread(n) {
  return !n.handled && !n.readBy.includes(viewerId());
}
export function unreadCount() {
  return myNotifs().filter(isUnread).length;
}
export function markRead(n) {
  if (!n.readBy.includes(viewerId())) n.readBy.push(viewerId());
}
export function hasPos(p) {
  const m = me();
  return (
    (S.role === 'Staff' && !!m?.positions?.includes(p)) ||
    (S.role === 'Academic Assistant' && p === 'Academic Assistant')
  );
}
export const isAA = () => hasPos('Academic Assistant'),
  isLib = () => hasPos('Librarian'),
  isLabCharge = () => hasPos('Lab Charge');
export function isTeacher() {
  const m = me();
  return (
    S.role === 'Staff' &&
    !!m &&
    (m.positions.includes('Teacher / Usthad') || m.classes.length > 0 || classTeacherOf().length > 0)
  );
}
/** Classes this staff member is class teacher of (assigned by the Admin). */
export function classTeacherOf() {
  const m = me();
  if (S.role !== 'Staff' || !m) return [];
  const ct = S.db.settings.classTeachers || {};
  return Object.keys(ct).filter(c => +ct[c] === m.id && S.db.classes.includes(c));
}
export function myClasses() {
  if (S.role !== 'Staff' || !me()) return [];
  return [...new Set([...(isTeacher() ? me().classes : []), ...classTeacherOf()])];
}
/** Any teacher can take attendance for any class; their own classes are listed first. */
export function markableClasses() {
  if (!isTeacher()) return [];
  const mine = myClasses();
  return [...mine, ...S.db.classes.filter(c => !mine.includes(c))];
}
/** Only the Admin and the class teacher may rearrange a class's seats. */
export function canArrange(cls) {
  return S.role === 'Admin' || classTeacherOf().includes(cls);
}
export function canDecide(kind) {
  return (S.role === 'Principal' || S.role === 'Vice Principal') && leaders(kind).includes('role:' + S.role);
}
export function canHandleRequest(r) {
  const h = S.db.settings.routing[r.type] || 'Admin office';
  return h === 'Admin office' ? S.role === 'Admin' : h === 'Academic Assistant' ? isAA() : isLib();
}
export function canManageLab() {
  return S.role === 'Admin' || isLabCharge();
}
export function canEditAttendance() {
  return S.role === 'Staff' || S.role === 'Academic Assistant' || S.role === 'Admin';
}
export function actorName() {
  return S.role === 'Staff' || S.role === 'Academic Assistant'
    ? me()?.name || S.role
    : S.role === 'Student'
      ? me()?.name
      : S.role === 'Admin'
        ? 'Admin office'
        : S.role;
}
export function allPositions() {
  return [...BUILTIN_POSITIONS, ...S.db.settings.customPositions];
}
