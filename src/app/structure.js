import {
  canDecide,
  canHandleRequest,
  canManageLab,
  isAA,
  isLib,
  isTeacher,
  me,
  myClasses,
  unreadCount,
} from '../lib/permissions.js';
import { today } from '../lib/utils.js';
import { S } from '../state.js';
/* ---------- application structure (drives nav, tabs & dev navigator) ---------- */
export function navFor(r, p) {
  const N = (page, sections = [], group = '') => ({ page, sections, group });
  if (r === 'Student')
    return [
      N('Home'),
      N('Attendance', ['Overview', 'Leave Status', 'Medical', 'Forms']),
      N('Leave Application', ['Apply', 'My Applications']),
      N('Official Requests', ['New Request', 'Tracking']),
      N('Fees', ['Status', 'Receipts']),
      N('Lab Pass', ['Seat Map', 'My Pass']),
      N('Notifications', ['All', 'Unread']),
      N('Profile'),
    ];
  if (r === 'Staff') {
    const pos = p?.positions || [],
      teach = pos.includes('Teacher / Usthad') || (p?.classes || []).length > 0,
      L = [N('Home')];
    L.push(
      N(
        'Attendance',
        teach
          ? ['Mark Attendance', 'Outside Campus', 'Leave Status', 'History']
          : ['Outside Campus', 'Leave Status', 'History'],
      ),
    );
    if (teach) L.push(N('My Students', ['Class Roster', 'Marks', 'Follow-ups']));
    if (pos.includes('Academic Assistant')) {
      L.push(N('Leave Clearance', ['Awaiting Clearance', 'Cleared'], 'My positions'));
      L.push(
        N(
          'Verification',
          ['Attendance Submissions', 'Medical Requests', 'Corrections', 'Follow-ups'],
          'My positions',
        ),
      );
    }
    if (pos.includes('Librarian'))
      L.push(N('Library', ['Clearance Requests', 'Student Status'], 'My positions'));
    if (pos.includes('Lab Charge')) L.push(N('Computer Lab', ['Seat Map', 'Passes'], 'My positions'));
    L.push(N('Notifications', ['All', 'Unread']), N('Profile'));
    return L;
  }
  if (r === 'Academic Assistant')
    return [
      N('Home'),
      N('Leave Clearance', ['Awaiting Clearance', 'Cleared']),
      N('Verification', ['Attendance Submissions', 'Medical Requests', 'Corrections', 'Follow-ups']),
      N('Attendance', ['Overview', 'Outside Campus', 'Leave Status', 'History']),
      N('Notifications', ['All', 'Unread']),
      N('Profile'),
    ];
  if (r === 'Principal' || r === 'Vice Principal')
    return [
      N('Home'),
      N('Leave Decisions', ['Pending', 'Decided']),
      N('Fee Authorization', ['Pending', 'Decided']),
      N('Announcements', ['Post', 'History']),
      N('Notifications', ['All', 'Unread']),
      N('Profile'),
    ];
  return [
    N('Home'),
    N('Students', ['Directory', 'Add Student'], 'Manage'),
    N('Staff Management', ['Staff & Positions', 'Add Staff'], 'Manage'),
    N('Attendance', ['Monitoring', 'Outside Campus', 'Leave Status', 'Medical', 'Forms'], 'Manage'),
    N('Admissions', ['Pipeline', 'New Application'], 'Manage'),
    N('Fees', ['Records', 'Assign Fee', 'Adjustments'], 'Manage'),
    N('Official Requests', ['Queue', 'Completed'], 'Manage'),
    N('Computer Lab', ['Seat Map', 'Passes'], 'Manage'),
    N('Reports', ['Attendance', 'Fees', 'Leave'], 'Insights'),
    N('Announcements', ['Post', 'History'], 'Insights'),
    N('Settings', ['Institution', 'Workflow', 'Positions', 'Data'], 'System'),
    N('Notifications', ['All', 'Unread'], 'System'),
    N('Profile'),
  ];
}
export function navAll() {
  return navFor(S.role, me());
}
/* ---------- counts that need attention (drive badges & home) ---------- */
export function counts() {
  const c = {},
    add = (k, n) => {
      if (n > 0) c[k] = (c[k] || 0) + n;
    },
    t = today();
  if (S.role === 'Principal' || S.role === 'Vice Principal') {
    if (canDecide('leaveAuthority')) {
      const n = S.db.leaves.filter(l => l.status === 'Pending').length;
      add('Leave Decisions', n);
      add('Leave Decisions/Pending', n);
    }
    if (canDecide('feeAuthority')) {
      const n = S.db.feeTasks.filter(f => f.status === 'Pending').length;
      add('Fee Authorization', n);
      add('Fee Authorization/Pending', n);
    }
  }
  if (isAA()) {
    const a = S.db.leaves.filter(l => l.status === 'Awaiting Clearance').length;
    add('Leave Clearance', a);
    add('Leave Clearance/Awaiting Clearance', a);
    const v1 = S.db.attSubs.filter(s => !s.verified).length,
      v2 = S.db.medical.filter(m => m.status === 'Pending').length,
      v3 = S.db.requests.filter(
        r =>
          canHandleRequest(r) &&
          ['Submitted', 'In Progress'].includes(r.status) &&
          S.db.settings.routing[r.type] === 'Academic Assistant',
      ).length,
      v4 = S.db.followups.filter(f => f.status === 'Open').length;
    add('Verification', v1 + v2 + v3 + v4);
    add('Verification/Attendance Submissions', v1);
    add('Verification/Medical Requests', v2);
    add('Verification/Corrections', v3);
    add('Verification/Follow-ups', v4);
  }
  if (isLib()) {
    const n = S.db.requests.filter(
      r => S.db.settings.routing[r.type] === 'Librarian' && ['Submitted', 'In Progress'].includes(r.status),
    ).length;
    add('Library', n);
    add('Library/Clearance Requests', n);
  }
  if (canManageLab()) {
    const n = S.db.lab.bookings.filter(b => b.date === t && b.status === 'Requested').length;
    add('Computer Lab', n);
    add('Computer Lab/Passes', n);
  }
  if (S.role === 'Admin') {
    const n = S.db.requests.filter(
      r =>
        (S.db.settings.routing[r.type] || 'Admin office') === 'Admin office' &&
        ['Submitted', 'In Progress'].includes(r.status),
    ).length;
    add('Official Requests', n);
    add('Official Requests/Queue', n);
  }
  if (isTeacher()) {
    const pend = myClasses().filter(cl => !S.db.attSubs.some(s => s.class === cl && s.date === t)).length;
    add('Attendance', pend);
    add('Attendance/Mark Attendance', pend);
  }
  const u = unreadCount();
  add('Notifications', u);
  add('Notifications/Unread', u);
  return c;
}
