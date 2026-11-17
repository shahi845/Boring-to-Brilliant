// Unit tests for pure domain logic: dates, permissions, navigation structure and seed data integrity.
import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { navFor } from '../../src/app/structure.js';
import { seed } from '../../src/data/seed.js';
import { canDecide, canHandleRequest, isAA, isLib, isTeacher } from '../../src/lib/permissions.js';
import { leaders as notifyLeaders } from '../../src/lib/notifications.js';
import { addDays, daysBetween, esc, fmtTime, initials, nextId, plural } from '../../src/lib/utils.js';
import { S } from '../../src/state.js';
import { feeStatus, leaveCovering } from '../../src/pages/shared.js';

beforeEach(() => {
  S.db = null;
  seed();
  S.ui = { studentId: 1, staffId: 1 };
});

describe('utils', () => {
  test('date helpers', () => {
    assert.equal(addDays('2026-02-28', 1), '2026-03-01');
    assert.equal(addDays('2026-01-01', -1), '2025-12-31');
    assert.equal(daysBetween('2026-11-17', '2026-11-19'), 3);
    assert.equal(fmtTime('13:05'), '1:05 PM');
    assert.equal(fmtTime('00:30'), '12:30 AM');
  });
  test('escapes HTML to prevent XSS', () => {
    assert.equal(esc('<img src=x onerror="a()">'), '&lt;img src=x onerror=&quot;a()&quot;&gt;');
  });
  test('text helpers', () => {
    assert.equal(plural(1, 'day'), '1 day');
    assert.equal(plural(3, 'day'), '3 days');
    assert.equal(initials('Usthad Nabeel'), 'N');
    assert.equal(initials('Ahmed Rashid'), 'AR');
  });
  test('nextId produces unique, increasing ids', () => {
    const a = nextId([{ id: 5 }]);
    const b = nextId([{ id: 5 }, { id: a }]);
    assert.ok(a > 5 && b > a);
  });
});

describe('seed data', () => {
  test('every record points at an existing student', () => {
    const ids = new Set(S.db.students.map(s => s.id));
    for (const c of ['attendance', 'leaves', 'medical', 'requests', 'fees', 'feeTasks', 'followups'])
      for (const r of S.db[c]) assert.ok(ids.has(r.studentId), `${c} ${r.id} -> ${r.studentId}`);
  });
  test('every student and staff member has a unique campus login', () => {
    const logins = [...S.db.students, ...S.db.staff].map(x => x.login);
    assert.equal(new Set(logins).size, logins.length);
    assert.ok(logins.every(l => /^(ST|SF)-\d+$/.test(l)));
  });
  test('no two active lab passes share a seat', () => {
    const active = S.db.lab.bookings.filter(b => ['Active', 'Requested'].includes(b.status));
    assert.equal(new Set(active.map(b => b.seat)).size, active.length);
  });
});

describe('permissions', () => {
  test('students and teachers cannot decide leave or fees', () => {
    for (const r of ['Student', 'Staff', 'Admin', 'Academic Assistant']) {
      S.role = r;
      assert.equal(canDecide('leaveAuthority'), false, r);
      assert.equal(canDecide('feeAuthority'), false, r);
    }
  });
  test('leave authority setting is respected', () => {
    S.db.settings.leaveAuthority = 'Principal only';
    S.role = 'Principal';
    assert.equal(canDecide('leaveAuthority'), true);
    S.role = 'Vice Principal';
    assert.equal(canDecide('leaveAuthority'), false);
    assert.deepEqual(notifyLeaders('leaveAuthority'), ['role:Principal']);
  });
  test('positions unlock responsibilities', () => {
    S.role = 'Staff';
    S.ui.staffId = 1; // Teacher + Lab Charge
    assert.equal(isTeacher(), true);
    assert.equal(isAA(), false);
    S.ui.staffId = 2; // Teacher + Librarian
    assert.equal(isLib(), true);
    assert.equal(canHandleRequest({ type: 'Library Clearance' }), true);
    assert.equal(canHandleRequest({ type: 'Bonafide Certificate' }), false);
  });
  test('navigation adapts to role and positions', () => {
    const pages = (r, p) => navFor(r, p).map(n => n.page);
    assert.ok(pages('Student').includes('Lab Pass'));
    assert.ok(!pages('Student').includes('Students'));
    const lab = pages('Staff', { positions: ['Teacher / Usthad', 'Lab Charge'], classes: ['Degree I'] });
    assert.ok(lab.includes('Computer Lab') && !lab.includes('Library'));
    const office = pages('Staff', { positions: ['Office Staff'], classes: [] });
    assert.ok(!office.includes('My Students') && !office.includes('Leave Decisions'));
    assert.ok(pages('Principal').includes('Leave Decisions'));
    assert.ok(pages('Admin').includes('Settings'));
  });
});

describe('domain rules', () => {
  test('fee status becomes Overdue after the due date', () => {
    assert.equal(feeStatus({ status: 'Pending', due: '2000-01-01' }), 'Overdue');
    assert.equal(feeStatus({ status: 'Paid', due: '2000-01-01' }), 'Paid');
    assert.equal(feeStatus({ status: 'Pending', due: '2999-01-01' }), 'Pending');
  });
  test('only approved/cleared leave covers a date', () => {
    const l = S.db.leaves.find(x => x.status === 'Awaiting Clearance');
    assert.ok(leaveCovering(l.studentId, l.from));
    const p = S.db.leaves.find(x => x.status === 'Pending');
    assert.equal(leaveCovering(p.studentId, p.from), undefined);
  });
});
