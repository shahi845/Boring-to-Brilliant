import { FORMS, PAGES } from '../app/registry.js';
import { go } from '../app/router.js';
import { createAccount, credentialsModal, deleteAccount, genPassword, nextLogin } from '../lib/accounts.js';
import { POSITION_INFO } from '../lib/constants.js';
import { notify } from '../lib/notifications.js';
import { allPositions, isTeacher, myClasses } from '../lib/permissions.js';
import { save } from '../lib/store.js';
import {
  avatar,
  esc,
  firstName,
  fmtRange,
  fmtTime,
  money,
  nextId,
  pad,
  plural,
  today,
} from '../lib/utils.js';
import { legend } from './attendance.js';
import { att, attPct, classStudents } from './shared.js';
import { S } from '../state.js';
import { btn, call, calm, card, heading, itemRow, tabs, tag } from '../ui/components.js';
import { closeModal, confirmBox, mhead, modal, toast } from '../ui/feedback.js';
import { F, commit, formHTML } from '../ui/forms.js';
/* ==========================================================================
   ADMIN — students, staff & positions, admissions
   ========================================================================== */
PAGES.Students = () => {
  if (S.section === 'Classes') return classesPage();
  if (S.section === 'Add Student')
    return (
      heading('Students', 'Add a student. Roll numbers are generated automatically.') +
      tabs() +
      card(
        'New student',
        formHTML(
          'student',
          [
            F('name', 'Full name'),
            `<label>Class<select class="field" name="class" data-req onchange="this.closest('form').querySelector('.newclass').hidden = this.value !== '__new'">${S.db.classes
              .map(c => `<option value="${esc(c)}">${esc(c)}</option>`)
              .join(
                '',
              )}<option value="__new"${S.db.classes.length ? '' : ' selected'}>+ New class…</option></select><span class="err" data-err="class"></span></label>`,
            `<label class="newclass"${S.db.classes.length ? ' hidden' : ''}>New class name<input class="field" name="newClass" maxlength="40" placeholder="e.g. Degree III"><span class="hint">Created when you add the student.</span><span class="err" data-err="newClass"></span></label>`,
            F('email', 'Email', 'email'),
            F('guardian', 'Guardian phone', 'text', { ph: '+91 …' }),
            F('pw', 'Sign-in password', 'text', {
              value: genPassword(),
              full: true,
              hint: 'Their Campus ID is created automatically (ST-…). They can change the password later.',
            }),
          ],
          'Add student & create account',
        ),
      )
    );
  return (
    heading(
      'Students',
      plural(S.db.students.length, 'student') +
        ' across ' +
        plural(S.db.classes.length, 'class', 'classes') +
        '.',
    ) +
    tabs() +
    card(
      '',
      `<div class="toolbar"><input class="field" placeholder="Search by name, class or roll no…" oninput="filterItems(this,'#stl')"></div><div id="stl">${S.db.students.map(s => itemRow({ icon: avatar(s.name, s.id), title: esc(s.name), meta: esc(s.login || 'No account') + ' · ' + esc(s.class) + ' · ' + esc(s.roll) + ' · ' + esc(s.email), onclick: call('studentDetail', s.id), right: btn('Password', call('resetPwModal', s.login || '', s.name), 'sm') + btn('Remove', call('removeStudent', s.id), 'sm danger') })).join('') || calm('🎓', 'No students yet')}</div>`,
    )
  );
};
/* ---------- classes ---------- */
function classesPage() {
  const ct = S.db.settings.classTeachers || {};
  return (
    heading('Students', 'Create and manage classes. Every class gets its own seating plan and attendance.') +
    tabs() +
    `<div class="row2">${card(
      'Classes',
      S.db.classes.length
        ? S.db.classes
            .map(c => {
              const n = classStudents(c).length,
                t = S.db.staff.find(x => x.id === +ct[c]);
              return itemRow({
                icon: `<span class="avatar" style="background:#0e9f9a" aria-hidden="true">${esc(rollPrefix(c))}</span>`,
                title: esc(c),
                meta:
                  plural(n, 'student') +
                  ' · ' +
                  (t ? 'Class teacher: ' + esc(t.name) : 'No class teacher yet'),
                right:
                  btn('Add student', call('addStudentTo', c), 'sm') +
                  btn('Rename', call('renameClassModal', c), 'sm') +
                  btn('Remove', call('removeClass', c), 'sm danger'),
              });
            })
            .join('')
        : calm('🏫', 'No classes yet', 'Create your first class.'),
    )}${card(
      'New class',
      formHTML(
        'newclass',
        [
          F('name', 'Class name', 'text', {
            full: true,
            ph: 'e.g. Degree III',
            hint: 'Roll numbers get a short prefix, e.g. Degree III → D3-01.',
          }),
        ],
        'Create class',
      ),
    )}</div>`
  );
}
FORMS.newclass = v => {
  const name = v.name.replace(/\s+/g, ' ').trim(),
    err = classNameError(name);
  if (err) return { field: 'name', msg: err };
  S.db.classes.push(name);
  commit('Class “' + name + '” created — assign a class teacher in Staff Management', false);
};
export function addStudentTo(c) {
  go('Students', 'Add Student');
  setTimeout(() => {
    const sel = document.querySelector('#content select[name=class]');
    if (sel) sel.value = c;
  }, 60);
}
export function renameClassModal(c) {
  modal(
    mhead('Rename class', esc(c) + ' · ' + plural(classStudents(c).length, 'student')) +
      formHTML(
        'renameclass',
        [
          `<input type="hidden" name="old" value="${esc(c)}">`,
          F('name', 'New name', 'text', {
            value: c,
            full: true,
            hint: 'Students, attendance submissions, seating and the class teacher move to the new name.',
          }),
        ],
        'Rename',
      ),
  );
}
FORMS.renameclass = v => {
  const name = v.name.replace(/\s+/g, ' ').trim(),
    old = v.old;
  if (name === old) return closeModal();
  const err = classNameError(name);
  if (err) return { field: 'name', msg: err };
  S.db.classes = S.db.classes.map(c => (c === old ? name : c));
  S.db.students.forEach(st => st.class === old && (st.class = name));
  S.db.staff.forEach(st => (st.classes = (st.classes || []).map(c => (c === old ? name : c))));
  S.db.attSubs.forEach(x => x.class === old && (x.class = name));
  const ct = S.db.settings.classTeachers || {};
  if (old in ct) {
    ct[name] = ct[old];
    delete ct[old];
  }
  if (S.db.seating?.[old]) {
    S.db.seating[name] = S.db.seating[old];
    delete S.db.seating[old];
  }
  commit('Class renamed to “' + name + '”');
};
export function removeClass(c) {
  const n = classStudents(c).length;
  if (n) return toast('Move or remove the ' + plural(n, 'student') + ' in ' + c + ' first', 'err');
  confirmBox(
    'Remove ' + c + '?',
    'The class has no students. Past attendance records stay in history.',
    'Remove',
    () => {
      S.db.classes = S.db.classes.filter(x => x !== c);
      const ct = S.db.settings.classTeachers || {};
      delete ct[c];
      S.db.staff.forEach(st => (st.classes = (st.classes || []).filter(x => x !== c)));
      if (S.db.seating?.[c]) delete S.db.seating[c];
      commit('Class removed');
    },
    true,
  );
}
const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };
/** Roll prefix from the class name: "Degree I" → D1, "Degree III" → D3, "BA English" → BE. */
export function rollPrefix(cl) {
  const words = String(cl).trim().split(/\s+/).filter(Boolean);
  return (
    words
      .map(w => ROMAN[w.toUpperCase()] || (/^\d+$/.test(w) ? w : w[0].toUpperCase()))
      .join('')
      .slice(0, 4) || 'CL'
  );
}
/** Next free roll number in a class. */
export function rollFor(cl) {
  const pre = rollPrefix(cl) + '-',
    used = classStudents(cl).map(st =>
      String(st.roll).startsWith(pre) ? +String(st.roll).slice(pre.length) || 0 : 0,
    );
  return pre + pad(Math.max(classStudents(cl).length, ...used, 0) + 1);
}
/** Validate a new class name; returns an error message or ''. */
export function classNameError(name) {
  if (!name) return 'Enter a class name';
  if (name.length > 40) return 'Keep it under 40 characters';
  if (/[,|]/.test(name)) return 'Commas and | can’t be used in class names';
  if (S.db.classes.some(c => c.toLowerCase() === name.toLowerCase())) return 'That class already exists';
  return '';
}
FORMS.student = v => {
  if (v.class === '__new') {
    v.newClass = (v.newClass || '').replace(/\s+/g, ' ').trim();
    const err = classNameError(v.newClass);
    if (err) return { field: 'newClass', msg: err };
  }
  if (S.db.students.some(s => (s.email || '').toLowerCase() === v.email.toLowerCase()))
    return { field: 'email', msg: 'A student with this email already exists' };
  if (v.pw.length < 8) return { field: 'pw', msg: 'At least 8 characters' };
  const newClass = v.class === '__new' ? v.newClass : '';
  if (newClass) v.class = newClass;
  const st = {
    id: nextId(S.db.students),
    login: nextLogin('ST-', 1000),
    name: v.name,
    class: v.class,
    email: v.email,
    guardian: v.guardian,
    roll: rollFor(v.class),
  };
  createAccount(st.login, v.pw, 'Student', st.id, st.name).then(ok => {
    if (!ok) {
      const f = document.querySelector('#content form [type=submit]');
      if (f) f.disabled = false;
      return;
    }
    if (newClass && !S.db.classes.includes(newClass)) S.db.classes.push(newClass);
    S.db.students.push(st);
    save();
    go('Students', 'Directory');
    if (newClass) toast('Class “' + newClass + '” created');
    setTimeout(() => credentialsModal(st.name, st.login, v.pw), 80);
  });
};
export function removeStudent(id) {
  const st = S.db.students.find(s => s.id === id);
  confirmBox(
    'Remove ' + st.name + '?',
    'Their sign-in account is deleted. Past records stay in history.',
    'Remove',
    () => {
      if (st.login) deleteAccount(st.login);
      S.db.students = S.db.students.filter(s => s.id !== id);
      commit('Student removed');
    },
    true,
  );
}
export function studentDetail(id) {
  const s = S.db.students.find(x => x.id === id);
  if (!s) return toast('Student not found', 'err');
  const r = att(s.id, today()),
    { n, pct } = attPct(s.id),
    lv = S.db.leaves
      .filter(l => l.studentId === id)
      .sort((a, b) => b.id - a.id)
      .slice(0, 3),
    lib = S.db.libStatus[id],
    fees = S.db.fees.filter(f => f.studentId === id && f.status !== 'Paid'),
    fu = S.db.followups.filter(f => f.studentId === id && f.status === 'Open');
  const last = S.db.attendance
    .filter(a => a.studentId === id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10)
    .reverse();
  modal(
    mhead(s.name, esc(s.class) + ' · ' + esc(s.roll)) +
      `<div class="row2"><div><dl class="kv"><dt>Today</dt><dd>${tag(r ? r.status : 'Not marked')}${r?.status === 'Outside Campus' ? ' since ' + fmtTime(r.time) : ''}</dd><dt>Attendance</dt><dd>${pct}% of ${plural(n, 'day')}</dd><dt>Library</dt><dd>${tag(lib?.status || 'Not checked')}</dd>${S.role === 'Admin' || S.role === 'Principal' || S.role === 'Vice Principal' ? `<dt>Fees due</dt><dd>${fees.length ? money(fees.reduce((a, f) => a + +f.amount, 0)) : 'None'}</dd><dt>Guardian</dt><dd>${esc(s.guardian)}</dd>` : ''}</dl></div><div><div class="daystrip">${last.map(a => `<div class="day" title="${esc(a.status)}">${new Date(a.date + 'T00:00:00').getDate()}<i class="${esc(a.status.toLowerCase().replace(/\s+/g, '-'))}"></i></div>`).join('')}</div>${legend()}</div></div>` +
      (lv.length
        ? `<h3 class="sectiontitle" style="margin-top:12px">Leave applications</h3>` +
          lv
            .map(l =>
              itemRow({
                title: fmtRange(l.from, l.to) + ' · ' + esc(l.type),
                right: tag(l.status),
                onclick: call('leaveDetail', l.id),
              }),
            )
            .join('')
        : '') +
      (fu.length ? `<div class="softinfo">👀 Open follow-up: ${esc(fu[0].note)}</div>` : '') +
      (isTeacher() && myClasses().includes(s.class) && !fu.length
        ? `<div class="formactions">${btn('Raise a follow-up', "closeModal();go('My Students','Follow-ups')", '')}</div>`
        : ''),
    'wide',
  );
}
PAGES['Staff Management'] = () => {
  if (S.section === 'Add Staff')
    return (
      heading('Staff management', 'Add a staff member and choose their position.') +
      tabs() +
      card(
        'New staff member',
        formHTML(
          'staff',
          [
            F('name', 'Name', 'text', { ph: 'e.g. Usthad Salim' }),
            F('department', 'Department'),
            F('position', 'Position', 'select', { options: allPositions(), value: 'Teacher / Usthad' }),
            F('classes', 'Assigned classes (teachers)', 'checks', {
              options: S.db.classes,
              full: true,
              required: false,
            }),
            F('pw', 'Sign-in password', 'text', {
              value: genPassword(),
              hint: 'Their Campus ID is created automatically (SF-…). They can change the password later.',
            }),
          ],
          'Add staff & create account',
        ),
      )
    );
  return (
    heading(
      'Staff management',
      'Positions decide which responsibilities appear in each person’s Staff Portal.',
    ) +
    tabs() +
    `<details class="softinfo" style="margin-top:0"><summary style="font-weight:800;cursor:pointer">What does each position unlock?</summary>${allPositions()
      .map(
        p =>
          `<div style="margin-top:7px"><b>${esc(p)}</b> — ${esc(POSITION_INFO[p] || 'Title only — adds no extra features')}</div>`,
      )
      .join(
        '',
      )}<div class="tinyhint" style="margin-top:8px">Positions add specific responsibilities only. They never grant leave or fee approval — those stay with the Principal / Vice Principal.</div></details>` +
    card(
      '',
      S.db.staff.length
        ? S.db.staff
            .map(s =>
              itemRow({
                icon: avatar(s.name, s.id),
                title:
                  esc(s.name) + ` <span class="muted" style="font-weight:650">· ${esc(s.department)}</span>`,
                meta:
                  (s.login ? `<span class="chip grey">${esc(s.login)}</span>` : '') +
                  (s.positions.length
                    ? s.positions.map(p => `<span class="chip">${esc(p)}</span>`).join('')
                    : '<span class="chip grey">No position</span>') +
                  (s.classes.length ? `<span class="chip grey">📚 ${esc(s.classes.join(', '))}</span>` : '') +
                  Object.entries(S.db.settings.classTeachers || {})
                    .filter(([c, id]) => +id === s.id && S.db.classes.includes(c))
                    .map(([c]) => `<span class="chip">⭐ Class teacher · ${esc(c)}</span>`)
                    .join(''),
                onclick: call('editStaff', s.id),
                right:
                  btn('Edit', call('editStaff', s.id), 'sm') +
                  btn('Password', call('resetPwModal', s.login || '', s.name), 'sm') +
                  btn('Remove', call('removeStaff', s.id), 'sm danger'),
              }),
            )
            .join('')
        : calm('🧑‍🏫', 'No staff yet'),
    ) +
    classTeacherCard()
  );
};
/** Admin assigns one class teacher per class. Class teachers can mark that class and arrange its seats. */
function classTeacherCard() {
  const ct = S.db.settings.classTeachers || {};
  return card(
    'Class teachers',
    `<p class="muted" style="margin-top:0">The class teacher marks attendance for the class and can arrange the seating plan on the benches.</p>` +
      formHTML(
        'classteachers',
        S.db.classes.map(c =>
          F('ct_' + c, c, 'select', {
            options: S.db.staff.map(x => [x.id, x.name + (x.positions.length ? ' · ' + x.positions[0] : '')]),
            placeholder: 'No class teacher',
            value: ct[c] ?? '',
            required: false,
          }),
        ),
        'Save class teachers',
      ),
    'style="margin-top:16px"',
  );
}
FORMS.classteachers = v => {
  const ct = {};
  S.db.classes.forEach(c => {
    if (v['ct_' + c]) ct[c] = +v['ct_' + c];
  });
  S.db.settings.classTeachers = ct;
  commit('Class teachers saved', false);
};
export function editStaff(id) {
  const s = S.db.staff.find(x => x.id === id);
  if (!s) return;
  modal(
    mhead('Edit ' + s.name, 'Positions & assigned classes') +
      formHTML(
        'editstaff',
        [
          `<input type="hidden" name="id" value="${id}">`,
          F('name', 'Name', 'text', { value: s.name }),
          F('department', 'Department', 'text', { value: s.department }),
          F('positions', 'Positions', 'checks', {
            options: allPositions(),
            value: s.positions,
            full: true,
            required: false,
          }),
          F('classes', 'Assigned classes', 'checks', {
            options: S.db.classes,
            value: s.classes,
            full: true,
            required: false,
          }),
        ],
        'Save changes',
      ),
    'wide',
  );
}
export function announcePositions(s, before) {
  const added = s.positions.filter(p => !before.includes(p)),
    msg = {
      Librarian: 'Library duty assigned — library clearance now appears in your portal 📚',
      'Lab Charge': 'Lab responsibility assigned — the Computer Lab now appears in your portal 💻',
      'Academic Assistant': 'Academic Assistant responsibilities assigned 🗂️',
      'Teacher / Usthad': 'Teaching responsibilities assigned 📅',
    };
  added.forEach(p =>
    notify('staff:' + s.id, msg[p] || 'Position assigned: ' + p, { icon: '🧑‍🏫', link: ['Home'] }),
  );
}
FORMS.editstaff = v => {
  const s = S.db.staff.find(x => x.id === +v.id);
  if (!s) return;
  const before = [...s.positions];
  Object.assign(s, {
    name: v.name,
    department: v.department,
    positions: v.positions || [],
    classes: v.classes || [],
  });
  announcePositions(s, before);
  commit(
    'Saved — ' + firstName(s.name) + '’s portal now shows: ' + (s.positions.join(', ') || 'no positions'),
  );
};
FORMS.staff = v => {
  if (S.db.staff.some(s => s.name.toLowerCase() === v.name.toLowerCase()))
    return { field: 'name', msg: 'A staff member with this name already exists' };
  if (v.pw.length < 8) return { field: 'pw', msg: 'At least 8 characters' };
  const s = {
    id: nextId(S.db.staff),
    login: nextLogin('SF-', 200),
    name: v.name,
    department: v.department,
    positions: [v.position],
    classes: v.classes || [],
  };
  createAccount(s.login, v.pw, 'Staff', s.id, s.name).then(ok => {
    if (!ok) {
      const f = document.querySelector('#content form [type=submit]');
      if (f) f.disabled = false;
      return;
    }
    S.db.staff.push(s);
    announcePositions(s, []);
    save();
    go('Staff Management', 'Staff & Positions');
    setTimeout(() => credentialsModal(s.name, s.login, v.pw), 80);
  });
};
export function removeStaff(id) {
  const s = S.db.staff.find(x => x.id === id);
  confirmBox(
    'Remove ' + s.name + '?',
    'Their positions become unassigned and their sign-in account is deleted.',
    'Remove',
    () => {
      if (s.login) deleteAccount(s.login);
      S.db.staff = S.db.staff.filter(x => x.id !== id);
      commit('Staff member removed');
    },
    true,
  );
}
export const ADM = ['Received', 'Under Review', 'Accepted', 'Rejected', 'Enrolled'];
PAGES.Admissions = () => {
  if (S.section === 'New Application')
    return (
      heading('Admissions', 'Record a new application.') +
      tabs() +
      card(
        'New application',
        formHTML(
          'admission',
          [
            F('name', 'Applicant name'),
            F('course', 'Class applied for', 'select', { options: S.db.classes }),
            F('phone', 'Phone'),
          ],
          'Save application',
        ),
      )
    );
  return (
    heading('Admissions', 'Move applicants through the pipeline. Enrolling creates the student record.') +
    tabs() +
    `<div class="toolbar">${ADM.map(s => `<span class="chip">${esc(s)} · ${S.db.admissions.filter(a => a.status === s).length}</span>`).join('')}</div>` +
    card(
      '',
      S.db.admissions.length
        ? S.db.admissions
            .slice()
            .sort((a, b) => ADM.indexOf(a.status) - ADM.indexOf(b.status))
            .map(a =>
              itemRow({
                icon: avatar(a.name, a.id),
                title: esc(a.name),
                meta: esc(a.course) + ' · ' + esc(a.phone || ''),
                right:
                  a.status === 'Enrolled'
                    ? tag('Enrolled')
                    : `<select class="field" aria-label="Status" onchange="setAdmission(${a.id},this.value)">${ADM.filter(
                        x => x !== 'Enrolled',
                      )
                        .map(s => `<option ${a.status === s ? 'selected' : ''}>${s}</option>`)
                        .join('')}</select>` +
                      (a.status === 'Accepted' ? btn('Enroll', call('enroll', a.id), 'sm primary') : ''),
              }),
            )
            .join('')
        : calm('➕', 'No applications yet'),
    )
  );
};
export function setAdmission(id, st) {
  const a = S.db.admissions.find(x => x.id === id);
  if (a) {
    a.status = st;
    commit(a.name + ' → ' + st, false);
  }
}
export function enroll(id) {
  const a = S.db.admissions.find(x => x.id === id);
  if (!a || a.status !== 'Accepted') return;
  confirmBox(
    'Enroll ' + a.name + '?',
    'A student record and sign-in account will be created in ' + a.course + '.',
    'Enroll',
    () => {
      const st = {
          id: nextId(S.db.students),
          login: nextLogin('ST-', 1000),
          name: a.name,
          class: a.course,
          email: '',
          guardian: a.phone || '',
          roll: rollFor(a.course),
        },
        pw = genPassword();
      createAccount(st.login, pw, 'Student', st.id, st.name).then(ok => {
        if (!ok) return;
        S.db.students.push(st);
        a.status = 'Enrolled';
        commit(a.name + ' enrolled 🎉');
        setTimeout(() => credentialsModal(st.name, st.login, pw), 80);
      });
    },
  );
}
FORMS.admission = v => {
  if (S.db.admissions.some(a => a.name.toLowerCase() === v.name.toLowerCase() && a.status !== 'Rejected'))
    return { field: 'name', msg: 'An active application with this name exists' };
  S.db.admissions.push({ id: nextId(S.db.admissions), ...v, status: 'Received' });
  save();
  go('Admissions', 'Pipeline');
  toast('Application saved');
};
