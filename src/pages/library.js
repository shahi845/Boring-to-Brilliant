import { FORMS, PAGES } from '../app/registry.js';
import { actorName } from '../lib/permissions.js';
import { avatar, esc, fmtDate, sName, today } from '../lib/utils.js';
import { requestQueue } from './requests.js';
import { S } from '../state.js';
import { btn, call, card, heading, itemRow, tabs, tag } from '../ui/components.js';
import { mhead, modal } from '../ui/feedback.js';
import { F, commit, formHTML } from '../ui/forms.js';
import { BOOK_ISSUE, REQ_ICON } from '../lib/constants.js';
import { notify, handlerKey, handlerLink } from '../lib/notifications.js';
import { me } from '../lib/permissions.js';
import { save } from '../lib/store.js';
import { nextId, rel, stamp } from '../lib/utils.js';
import { toast } from '../ui/feedback.js';
import { ALL_BOOKS, bookById } from '../data/books.js';
import {
  libSceneAgain,
  libSceneBook,
  libSceneClose,
  libSceneGo,
  libSceneIssue,
  libScenePutBack,
  libSceneShelf,
  librarySceneMarkup,
} from '../scene/library-controller.js';
export {
  libSceneAgain,
  libSceneBook,
  libSceneClose,
  libSceneGo,
  libSceneIssue,
  libScenePutBack,
  libSceneShelf,
};
/* ==========================================================================
   STUDENT LIBRARY — browse the shelves and request a book (animated scene)
   ========================================================================== */
const bookIdOf = r => (/\b(B-\d{3})\b/.exec(r.details || '') || [])[1];
const myBookRequests = () =>
  S.db.requests.filter(r => r.type === BOOK_ISSUE && r.studentId === me()?.id).sort((a, b) => b.id - a.id);
const openFor = id =>
  myBookRequests().find(
    r => bookIdOf(r) === id && ['Submitted', 'In Progress', 'Completed'].includes(r.status),
  );
const BOOK_STATUS = {
  Submitted: 'Requested',
  'In Progress': 'Being prepared',
  Completed: 'Issued',
  Rejected: 'Not issued',
};
function bookCover(b) {
  return `<span class="sp-book" style="background:${b.color}"><i></i></span>`;
}
const libCtx = {
  states: () => {
    const out = {};
    ALL_BOOKS.forEach(b => (out[b.id] = openFor(b.id) ? 'mine' : b.out ? 'unavailable' : 'free'));
    return out;
  },
  issue: b => issueBook(b),
  bookCard: (b, state) =>
    `<div class="sp-row">${bookCover(b)}<div class="grow"><div class="hero-eyebrow">${esc(b.id)} · ${esc(b.shelf)}</div><b style="font-size:17px">${esc(b.title)}</b><div class="muted">${esc(b.author)}</div>
<div style="margin-top:6px">${state === 'free' ? tag('Available') : state === 'mine' ? tag('Requested') : tag('Issued')}</div></div></div>
<div class="formactions" style="margin-top:12px">${state === 'free' ? btn('Get this book', 'libSceneGo()', 'primary') : `<span class="muted">${state === 'mine' ? 'You already have this one — see My Books.' : 'Another student has this copy right now.'}</span>`}${btn('Close', 'libSceneClose()')}</div>`,
  slipHTML: (b, r) =>
    `<div class="libslip pop"><div class="ls-head"><span>📖 LIBRARY ISSUE SLIP</span><b>${esc(b.id)}</b></div>
<div class="ls-body">${bookCover(b)}<div class="grow"><h2>Request sent! 🎉</h2><b>${esc(b.title)}</b><div class="muted">${esc(b.author)} · ${esc(b.shelf)}</div>
<p class="muted" style="margin:8px 0 0">${esc(me()?.name || '')} · ${fmtDate(today())}. The Librarian confirms and hands the book over at the counter.</p></div></div>
<div class="formactions">${btn('My Books', "go('Library','My Books')", 'sm primary')}${btn('Get another book', 'libSceneAgain()', 'sm')}</div></div>`,
};
/** Create a Book Issue request for the Librarian. */
export function issueBook(b) {
  const s = me();
  if (!s) return 'no-student';
  if (b.out) return (toast('This copy is already issued', 'err'), 'out');
  if (openFor(b.id)) return (toast('You already requested this book', 'err'), 'dup');
  const id = nextId(S.db.requests),
    details = `${b.id} · ${b.title} — ${b.author} (${b.shelf} shelf)`;
  const r = {
    id,
    studentId: s.id,
    type: BOOK_ISSUE,
    details,
    status: 'Submitted',
    createdAt: stamp(),
    history: [{ status: 'Submitted', by: s.name, at: stamp(), note: '' }],
  };
  S.db.requests.push(r);
  notify(handlerKey(BOOK_ISSUE), 'Book issue request from ' + s.name + ': ' + b.title, {
    icon: REQ_ICON[BOOK_ISSUE],
    ref: 'req:' + id,
    action: true,
    link: handlerLink(BOOK_ISSUE, 'req:' + id),
  });
  save();
  toast('Issue request sent to the Librarian 📚');
  return r;
}
function studentLibrary() {
  const h = heading('Library', 'Pick a book from the shelves — your student fetches it for you.') + tabs();
  if (S.section !== 'My Books') return h + librarySceneMarkup(libCtx);
  const list = myBookRequests();
  return (
    h +
    card(
      'My books',
      list.length
        ? list
            .map(r => {
              const b = bookById(bookIdOf(r));
              return itemRow({
                icon: b ? bookCover(b) : '📖',
                title: esc(b ? b.title : r.details),
                meta:
                  esc((b ? b.id + ' · ' + b.shelf + ' · ' : '') + 'requested ' + rel(r.createdAt)) +
                  (r.note ? ' · ' + esc(r.note) : ''),
                right: tag(BOOK_STATUS[r.status] || r.status),
              });
            })
            .join('')
        : `<div class="calm"><span class="big">📚</span><b>No books yet</b><div style="margin-top:14px">${btn('Browse the bookshelf', "go('Library','Bookshelf')", 'primary')}</div></div>`,
    )
  );
}
/* ==========================================================================
   LIBRARY (staff holding the Librarian position)
   ========================================================================== */
PAGES.Library = () => {
  if (S.role === 'Student') return studentLibrary();
  const h = heading('Library', 'Your Librarian responsibilities.') + tabs();
  if (S.section === 'Clearance Requests')
    return (
      h +
      requestQueue(r => S.db.settings.routing[r.type] === 'Librarian') +
      `<h2 class="play-heading">Completed</h2>` +
      requestQueue(r => S.db.settings.routing[r.type] === 'Librarian', true)
    );
  return (
    h +
    card(
      'Student library status',
      `<div class="toolbar"><input class="field" placeholder="Search students…" oninput="filterItems(this,'#libl')"></div><div id="libl">${S.db.students
        .map(s => {
          const l = S.db.libStatus[s.id];
          return itemRow({
            icon: avatar(s.name, s.id),
            title: esc(s.name) + ` <span class="muted" style="font-weight:650">· ${esc(s.class)}</span>`,
            meta: l
              ? esc([l.note, 'updated ' + fmtDate(l.at) + ' by ' + l.by].filter(Boolean).join(' · '))
              : '',
            right: tag(l?.status || 'Not checked') + ' ' + btn('Update', call('libModal', s.id), 'sm'),
          });
        })
        .join('')}</div>`,
    )
  );
};
export function libModal(sid) {
  const l = S.db.libStatus[sid] || {};
  modal(
    mhead('Library status', esc(sName(sid))) +
      formHTML(
        'lib',
        [
          `<input type="hidden" name="sid" value="${sid}">`,
          F('status', 'Status', 'select', {
            options: ['Cleared', 'On Hold', 'Not checked'],
            value: l.status || 'Not checked',
          }),
          F('note', 'Note', 'text', {
            value: l.note || '',
            required: false,
            ph: 'e.g. 1 book overdue',
            full: true,
          }),
        ],
        'Save',
      ),
  );
}
FORMS.lib = v => {
  if (v.status === 'On Hold' && !v.note) return { field: 'note', msg: 'Add a note so the student knows why' };
  S.db.libStatus[+v.sid] = { status: v.status, note: v.note, by: actorName(), at: today() };
  commit('Library status updated');
};
export function filterItems(inp, sel) {
  const q = inp.value.toLowerCase();
  document
    .querySelectorAll(sel + ' .item')
    .forEach(r => (r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none'));
}
