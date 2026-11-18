import { render } from '../app/router.js';
import { migrate } from './migrate.js';
import { viewerId } from './permissions.js';
import { $, today } from './utils.js';
import { S } from '../state.js';
import { toast } from '../ui/feedback.js';
import { sceneBusy } from '../scene/fx.js';
export let synced = new Map(),
  syncedN = new Map(),
  syncQ = Promise.resolve(),
  syncing = 0,
  lastLoad = 0;
export const COLLS = [
  'students',
  'staff',
  'attendance',
  'leaves',
  'medical',
  'requests',
  'fees',
  'feeTasks',
  'marks',
  'followups',
  'formSubs',
  'forms',
  'announcements',
  'admissions',
];
export const loginEmail = id => String(id).trim().toLowerCase() + '@ourcampus.app';
export function emptyDB() {
  return {
    version: 2,
    settings: {},
    classes: [],
    students: [],
    staff: [],
    attendance: [],
    attSubs: [],
    leaves: [],
    medical: [],
    requests: [],
    fees: [],
    feeTasks: [],
    marks: [],
    followups: [],
    formSubs: [],
    forms: [],
    announcements: [],
    admissions: [],
    notifications: [],
    libStatus: {},
    lab: { unavailable: [], bookings: [] },
  };
}
export function toRows() {
  const m = new Map(),
    put = (c, k, sid, d) =>
      m.set(c + '|' + k, {
        collection: c,
        key: String(k),
        student_id: sid == null || sid === '' ? null : Number(sid),
        data: d,
      });
  COLLS.forEach(c =>
    (S.db[c] || []).forEach(r => put(c, r.id, c === 'students' ? r.id : (r.studentId ?? null), r)),
  );
  S.db.attSubs.forEach(s => put('attSubs', s.class + '|' + s.date, null, s));
  S.db.lab.bookings.filter(b => !b._pseudo).forEach(b => put('labBookings', b.id, b.studentId, b));
  Object.entries(S.db.libStatus).forEach(([sid, v]) => put('libStatus', sid, +sid, v));
  put('meta', 'settings', null, S.db.settings);
  put('meta', 'classes', null, { list: S.db.classes });
  put('meta', 'labUnavailable', null, { list: S.db.lab.unavailable });
  return m;
}
export function fromRows(rows, notes) {
  const D = emptyDB();
  rows.forEach(r => {
    const d = r.data;
    if (COLLS.includes(r.collection)) D[r.collection].push(d);
    else if (r.collection === 'attSubs') D.attSubs.push(d);
    else if (r.collection === 'labBookings') D.lab.bookings.push(d);
    else if (r.collection === 'libStatus') D.libStatus[r.key] = d;
    else if (r.collection === 'meta') {
      if (r.key === 'settings') D.settings = d;
      else if (r.key === 'classes') D.classes = d.list || [];
      else if (r.key === 'labUnavailable') D.lab.unavailable = d.list || [];
    }
  });
  COLLS.forEach(c => D[c].sort((a, b) => a.id - b.id));
  D.lab.bookings.sort((a, b) => a.id - b.id);
  D.notifications = notes.map(n => ({
    ...n.data,
    id: +n.id,
    to: n.audience,
    readBy: n.read_by || [],
    handled: !!n.handled,
  }));
  return D;
}
export function snapshot() {
  synced = new Map([...toRows()].map(([k, v]) => [k, JSON.stringify([v.student_id, v.data])]));
  syncedN = new Map(S.db.notifications.map(n => [n.id, { read: [...n.readBy], handled: n.handled }]));
}
export async function fetchAll(table, q) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q(S.sb.from(table)).range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}
export async function loadAll() {
  const [rows, notes] = await Promise.all([
    fetchAll('records', t => t.select('collection,key,student_id,data').order('collection').order('key')),
    fetchAll('notifications', t =>
      t.select('id,audience,data,read_by,handled').order('id', { ascending: false }),
    ),
  ]);
  S.db = fromRows(rows, notes);
  if (S.profile.role === 'Student') {
    const { data, error } = await S.sb.rpc('lab_seats', { d: today() });
    if (!error)
      (data || []).forEach(s => {
        if (!s.mine)
          S.db.lab.bookings.push({
            id: 'p' + s.seat,
            seat: s.seat,
            studentId: -1,
            date: today(),
            status: s.status,
            _pseudo: true,
          });
      });
  }
  migrate();
  snapshot();
  lastLoad = Date.now();
}
/* ---------- computer lab: live seat availability for everyone ---------- */
const sameJSON = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const bookingSig = list =>
  list
    .filter(b => b.date === today())
    .map(b => [b.id, b.seat, b.status, b.studentId])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
/**
 * Pull the latest unavailable seats and today's bookings from the server.
 * Updates S.db in place and marks the rows as synced (so save() won't push
 * them back). Returns true when anything changed.
 */
export async function syncLab() {
  if (!S.sb || !S.profile || syncing) return false;
  await syncQ;
  const t = today();
  const [un, own, seats] = await Promise.all([
    S.sb.from('records').select('data').eq('collection', 'meta').eq('key', 'labUnavailable').maybeSingle(),
    S.sb.from('records').select('key,student_id,data').eq('collection', 'labBookings').eq('data->>date', t),
    S.profile.role === 'Student' ? S.sb.rpc('lab_seats', { d: t }) : Promise.resolve({ data: [] }),
  ]);
  for (const r of [un, own, seats]) if (r.error) throw r.error;
  if (syncing) return false; // a local change started meanwhile — the next poll catches up
  const list = [...new Set((un.data?.data?.list || []).map(Number))].sort((a, b) => a - b);
  const before = [[...S.db.lab.unavailable].sort((a, b) => a - b), bookingSig(S.db.lab.bookings)];
  S.db.lab.unavailable = list;
  synced.set('meta|labUnavailable', JSON.stringify([null, { list }]));
  const fresh = (own.data || []).map(r => r.data);
  S.db.lab.bookings = S.db.lab.bookings.filter(b => b.date !== t && !b._pseudo).concat(fresh);
  fresh.forEach(b => synced.set('labBookings|' + b.id, JSON.stringify([b.studentId ?? null, b])));
  // today's bookings that disappeared on the server are no longer "synced" either
  [...synced.keys()].forEach(k => {
    if (k.startsWith('labBookings|') && !S.db.lab.bookings.some(b => 'labBookings|' + b.id === k))
      synced.delete(k);
  });
  (seats.data || []).forEach(s => {
    if (!s.mine)
      S.db.lab.bookings.push({
        id: 'p' + s.seat,
        seat: s.seat,
        studentId: -1,
        date: t,
        status: s.status,
        _pseudo: true,
      });
  });
  return !sameJSON(before, [list, bookingSig(S.db.lab.bookings)]);
}
/** While a lab page is open, poll every few seconds and redraw when seats change. */
let labTimer = 0;
export function watchLab(isLabPage) {
  if (labTimer) return;
  labTimer = setInterval(async () => {
    if (!isLabPage()) {
      clearInterval(labTimer);
      labTimer = 0;
      return;
    }
    if (document.hidden || sceneBusy() || $('overlay').innerHTML) return;
    try {
      if (await syncLab()) render();
    } catch (e) {
      console.error(e);
    }
  }, 6000);
}
export function friendlyError(e) {
  const m = String(e?.message || e || '');
  if (e?.code === '23505' || /duplicate key/.test(m))
    return 'Someone else just did that — the latest data has been loaded.';
  if (/row-level security|permission/i.test(m)) return 'You don’t have permission to make that change.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'No connection — check your internet and try again.';
  return m || 'Something went wrong';
}
export function save() {
  if (!S.sb || !S.profile) return;
  const rows = toRows(),
    ins = [],
    upd = [],
    del = [];
  rows.forEach((v, k) => {
    const j = JSON.stringify([v.student_id, v.data]);
    if (!synced.has(k)) ins.push(v);
    else if (synced.get(k) !== j) upd.push(v);
  });
  synced.forEach((_, k) => {
    if (!rows.has(k)) del.push(k);
  });
  const vid = viewerId(),
    nIns = [],
    read = [],
    hand = [];
  S.db.notifications.forEach(n => {
    const s = syncedN.get(n.id);
    if (!s) {
      nIns.push(n);
      return;
    }
    if (n.readBy.includes(vid) && !s.read.includes(vid)) read.push(n.id);
    if (n.handled && !s.handled) hand.push(n.id);
  });
  snapshot();
  if (!ins.length && !upd.length && !del.length && !nIns.length && !read.length && !hand.length) return;
  syncing++;
  setSyncState(true);
  syncQ = syncQ
    .then(async () => {
      for (let i = 0; i < ins.length; i += 400) {
        const { error } = await S.sb.from('records').insert(ins.slice(i, i + 400));
        if (error) throw error;
      }
      for (const r of upd) {
        const { data, error } = await S.sb
          .from('records')
          .update({ student_id: r.student_id, data: r.data })
          .eq('collection', r.collection)
          .eq('key', r.key)
          .select('key');
        if (error) throw error;
        if (!data.length) throw new Error('permission');
      }
      for (const k of del) {
        const i = k.indexOf('|');
        const { error } = await S.sb
          .from('records')
          .delete()
          .eq('collection', k.slice(0, i))
          .eq('key', k.slice(i + 1));
        if (error) throw error;
      }
      if (nIns.length) {
        const { error } = await S.sb.from('notifications').insert(
          nIns.map(n => {
            const { id, to, readBy, handled, ...data } = n;
            return { id, audience: to, data, read_by: readBy, handled };
          }),
        );
        if (error) throw error;
      }
      if (read.length) {
        const { error } = await S.sb.rpc('mark_read', { ids: read });
        if (error) throw error;
      }
      if (hand.length) {
        const { error } = await S.sb.rpc('mark_handled', { ids: hand });
        if (error) throw error;
      }
    })
    .catch(async e => {
      console.error(e);
      toast('Not saved: ' + friendlyError(e), 'err');
      await refresh(true);
    })
    .finally(() => {
      syncing--;
      setSyncState(false);
    });
}
export function setSyncState(on) {
  const el = $('syncdot');
  if (el) {
    el.classList.toggle('busy', syncing > 0);
    el.title = syncing > 0 ? 'Saving…' : 'All changes saved';
  }
}
export async function refresh(force = false) {
  if (!S.sb || !S.profile) return;
  if (!force && (syncing || $('overlay').innerHTML || document.hidden || sceneBusy())) return;
  try {
    await syncQ;
    await loadAll();
    render();
  } catch (e) {
    console.error(e);
    if (force) toast('Couldn’t reload data: ' + friendlyError(e), 'err');
  }
}
/** Keep data fresh: reload every minute while idle, and when the tab regains focus. */
export function initBackgroundSync() {
  setInterval(() => {
    if (Date.now() - lastLoad > 60000) refresh();
  }, 15000);
  window.addEventListener('focus', () => {
    if (Date.now() - lastLoad > 20000) refresh();
  });
}
export function snapshotEmpty() {
  synced = new Map();
  syncedN = new Map();
}
