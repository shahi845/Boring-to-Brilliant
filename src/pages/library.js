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
import { ALL_BOOKS, BOOK_SHELVES, bookById, searchBooks } from '../data/books.js';
import { plural } from '../lib/utils.js';
import {
  libSceneAgain,
  libSceneBook,
  libSceneClose,
  libSceneGo,
  libSceneIssue,
  libScenePutBack,
  libSceneShelf,
  libSceneLocate,
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
const ORD = n => n + (['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || 'th');
/** Plain-language location of a book on the shelves. */
export function whereIs(b) {
  return `Shelf ${b.shelfId} (${b.shelf}) · ${['top', 'middle', 'bottom'][b.level]} row · ${ORD(b.slot + 1)} from the left`;
}
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
    `<div class="sp-row">${bookCover(b)}<div class="grow"><div class="hero-eyebrow">${esc(b.id)} · Call no. ${esc(b.callNo)}</div><b style="font-size:17px">${esc(b.title)}</b><div class="muted">${esc(b.author)}</div>
<div style="margin-top:6px">${state === 'free' ? tag('Available') : state === 'mine' ? tag('Requested') : tag('Issued')}</div></div></div>
<div class="book-where">📍 ${esc(whereIs(b))}</div>
<dl class="kv book-meta"><dt>Subject</dt><dd>${esc(b.shelf)}</dd><dt>Language</dt><dd>${esc(b.language)}</dd><dt>Published</dt><dd>${b.year} · ${b.pages} pages</dd><dt>Copies</dt><dd>${b.out ? 'All ' + b.copies + ' issued' : b.available + ' of ' + b.copies + ' on the shelf'}</dd></dl>
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
/* ---------- OPAC: online catalogue search ---------- */
let opacQ = '',
  opacShelf = '',
  opacAvail = false,
  opacSel = '';
function stateOf(b) {
  return S.role === 'Student' && openFor(b.id) ? 'mine' : b.out ? 'unavailable' : 'free';
}
function opacRow(b) {
  const st = stateOf(b);
  return `<button type="button" class="opac-item${b.id === opacSel ? ' on' : ''}" onclick="${call('opacPick', b.id)}" aria-label="${esc(b.title)} by ${esc(b.author)}, ${esc(whereIs(b))}">${bookCover(b)}<span class="grow"><b>${esc(b.title)}</b><span class="muted">${esc(b.author)} · ${esc(b.language)} · ${b.year}</span><span class="opac-where">📍 ${esc(b.callNo)} · ${esc(whereIs(b))}</span></span><span class="opac-status">${st === 'mine' ? tag('Requested') : st === 'unavailable' ? tag('Issued') : tag('Available')}<small>${b.id}</small></span></button>`;
}
function opacResults() {
  if (!opacQ.trim() && !opacShelf && !opacAvail)
    return `<div class="opac-try">Try: ${['python', 'history', 'arabic grammar', 'Ibn Kathir', 'B-014', 'C-1']
      .map(x => `<button type="button" class="chip" onclick="${call('opacTry', x)}">${esc(x)}</button>`)
      .join('')}</div>`;
  const list = searchBooks(opacQ, { shelfId: opacShelf, availableOnly: opacAvail });
  if (!list.length)
    return `<div class="calm" style="padding:18px"><span class="big">📭</span><b>No books found</b><div>Try another word or clear the filters.</div></div>`;
  return `<div class="opac-count">${plural(list.length, 'book')} found${S.role === 'Student' ? ' — tap one to see it on the shelf' : ''}</div><div class="opac-list">${list
    .slice(0, 40)
    .map(opacRow)
    .join(
      '',
    )}</div>${list.length > 40 ? '<p class="tinyhint">Showing the first 40 — add another word to narrow it down.</p>' : ''}`;
}
function opacHTML() {
  return `<form class="card opac" role="search" onsubmit="return false" oninput="this.dataset.dirty=1">
<div class="opac-head"><span class="opac-icon" aria-hidden="true">🔎</span><div><b>Library catalogue (OPAC)</b><div class="muted">${ALL_BOOKS.length} books · search by title, author, subject, language, book ID or call number (e.g. A-2-05).</div></div></div>
<div class="opac-bar"><input class="field" id="opacq" type="search" placeholder="Search books…" value="${esc(opacQ)}" oninput="opacInput(this.value)" autocomplete="off" aria-label="Search books">
<select class="field" aria-label="Shelf" onchange="opacFilter('shelf',this.value)"><option value="">All shelves</option>${BOOK_SHELVES.map(sh => `<option value="${sh.id}" ${sh.id === opacShelf ? 'selected' : ''}>${sh.id} · ${esc(sh.name)}</option>`).join('')}</select>
<label class="opac-avail"><input type="checkbox" ${opacAvail ? 'checked' : ''} onchange="opacFilter('avail',this.checked)"> Available only</label></div>
<div id="opacres">${opacResults()}</div></form>`;
}
const paintOpac = () => {
  const el = document.getElementById('opacres');
  if (el) el.innerHTML = opacResults();
};
export function opacInput(v) {
  opacQ = v;
  paintOpac();
}
export function opacFilter(k, v) {
  if (k === 'shelf') opacShelf = v;
  else opacAvail = !!v;
  paintOpac();
}
export function opacTry(q) {
  opacQ = q;
  const i = document.getElementById('opacq');
  if (i) i.value = q;
  paintOpac();
}
/** A search result was chosen: students see it on the shelf, staff get the full record. */
export function opacPick(id) {
  opacSel = id;
  paintOpac();
  if (S.role === 'Student') {
    if (libSceneLocate(id) === 'busy') toast('Finish with the book you’re carrying first', 'info');
  } else bookRecord(id);
}
export function bookRecord(id) {
  const b = bookById(id);
  if (!b) return;
  const reqs = S.db.requests
    .filter(r => r.type === BOOK_ISSUE && bookIdOf(r) === id)
    .sort((a, c) => c.id - a.id);
  modal(
    mhead(b.title, esc(b.author) + ' · ' + esc(b.id)) +
      `<div class="book-where">📍 ${esc(b.callNo)} · ${esc(whereIs(b))}</div><dl class="kv book-meta"><dt>Subject</dt><dd>${esc(b.shelf)}</dd><dt>Language</dt><dd>${esc(b.language)}</dd><dt>Published</dt><dd>${b.year} · ${b.pages} pages</dd><dt>Copies</dt><dd>${b.out ? 'All ' + b.copies + ' issued' : b.available + ' of ' + b.copies + ' on the shelf'}</dd></dl>` +
      (reqs.length
        ? `<h3 class="sectiontitle" style="margin-top:12px">Issue requests</h3>` +
          reqs
            .map(r =>
              itemRow({
                icon: avatar(sName(r.studentId), r.studentId),
                title: esc(sName(r.studentId)),
                meta: esc(rel(r.createdAt)),
                right: tag(BOOK_STATUS[r.status] || r.status),
                onclick: call('requestDetail', r.id),
              }),
            )
            .join('')
        : '<p class="muted">No issue requests for this book yet.</p>'),
  );
}
function studentLibrary() {
  const h =
    heading(
      'Library',
      'Search the catalogue or pick a book from the shelves — your student fetches it for you.',
    ) + tabs();
  if (S.section !== 'My Books') return h + opacHTML() + librarySceneMarkup(libCtx);
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
                  esc((b ? b.id + ' · ' + b.callNo + ' · ' : '') + 'requested ' + rel(r.createdAt)) +
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
  if (S.section === 'Catalogue') return h + opacHTML();
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
