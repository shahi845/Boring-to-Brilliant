import { notify } from '../lib/notifications.js';
import { addDays, fmtDate, fmtRange, pad, today } from '../lib/utils.js';
import { S } from '../state.js';
/* ---------- seed data ---------- */
export function seed() {
  const t = today(),
    y = addDays(t, -1);
  const D = {
    version: 2,
    settings: {
      institution: 'OURCAMPUS College',
      academicYear: '2026–27',
      leaveAuthority: 'Principal & Vice Principal',
      feeAuthority: 'Principal & Vice Principal',
      clearanceRequired: true,
      labMode: 'Approval',
      routing: {
        'Bonafide Certificate': 'Admin office',
        'Study Certificate': 'Admin office',
        'Permission Letter': 'Admin office',
        'Attendance Correction': 'Academic Assistant',
        'Library Clearance': 'Librarian',
        Other: 'Admin office',
      },
      customPositions: [],
    },
    classes: ['Degree I', 'Degree II'],
    students: [],
    staff: [
      {
        id: 1,
        login: 'SF-201',
        name: 'Usthad Nabeel',
        department: 'Sociology',
        positions: ['Teacher / Usthad', 'Lab Charge'],
        classes: ['Degree I'],
      },
      {
        id: 2,
        login: 'SF-202',
        name: 'Ms. Safa',
        department: 'Languages',
        positions: ['Teacher / Usthad', 'Librarian'],
        classes: ['Degree II'],
      },
      {
        id: 3,
        login: 'SF-203',
        name: 'Usthad Hameed',
        department: 'Academic Office',
        positions: ['Academic Assistant'],
        classes: [],
      },
      {
        id: 4,
        login: 'SF-204',
        name: 'Mr. Rashid',
        department: 'Administration',
        positions: ['Office Staff'],
        classes: [],
      },
    ],
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
    announcements: [],
    notifications: [],
    libStatus: {},
    forms: [
      {
        id: 1,
        title: 'Student Information Update',
        description: 'Ask the office to correct your contact or personal details.',
        prompt: 'What should be updated?',
      },
      {
        id: 2,
        title: 'Hostel Night-Out Declaration',
        description: 'Tell the warden when you will stay outside overnight.',
        prompt: 'Dates, place and guardian contact',
      },
    ],
    admissions: [
      { id: 1, name: 'Zayan P', course: 'Degree I', phone: '98470 11122', status: 'Under Review' },
      { id: 2, name: 'Mehrin A', course: 'Degree II', phone: '98950 22233', status: 'Received' },
      { id: 3, name: 'Adil C', course: 'Degree I', phone: '97440 33344', status: 'Accepted' },
    ],
    lab: { unavailable: [39, 40], bookings: [] },
  };
  const names = [
    ['Ahmed Rashid', 'Degree I'],
    ['Amina Rahman', 'Degree I'],
    ['Faris Ali', 'Degree I'],
    ['Yusuf M', 'Degree I'],
    ['Nida P', 'Degree I'],
    ['Shamil V', 'Degree I'],
    ['Hana Fathima', 'Degree II'],
    ['Rayan K', 'Degree II'],
    ['Sara N', 'Degree II'],
    ['Irfan T', 'Degree II'],
    ['Zainab K', 'Degree II'],
    ['Afra S', 'Degree II'],
  ];
  names.forEach(([n, c], i) =>
    D.students.push({
      id: i + 1,
      login: 'ST-' + (1001 + i),
      name: n,
      class: c,
      roll: (c === 'Degree I' ? 'D1-' : 'D2-') + pad((i % 6) + 1),
      email: n.split(' ')[0].toLowerCase() + '@campus.demo',
      guardian: '+91 9' + (400000000 + i * 1234567).toString().slice(0, 9),
    }),
  );
  let aid = 1;
  const A = (sid, date, status, time, note, by) =>
    D.attendance.push({
      id: aid++,
      studentId: sid,
      date,
      status,
      time: time || '',
      note: note || '',
      by: by || '',
    });
  // history: last ~12 calendar days excluding Sundays
  let back = 0,
    days = [];
  for (let i = 1; days.length < 10 && i < 20; i++) {
    const d = addDays(t, -i);
    if (new Date(d + 'T00:00:00').getDay() !== 0) days.push(d);
  }
  days.forEach((d, di) => {
    D.students.forEach(s => {
      let st = 'Present';
      const r = (s.id * 7 + di * 3) % 17;
      if (r === 0) st = 'Absent';
      else if (r === 5) st = 'Late';
      if (s.id === 8 && di < 2) st = 'Absent';
      if (s.id === 7 && d >= addDays(t, -6) && d <= addDays(t, -5)) st = 'On Leave';
      A(s.id, d, st, '', '', s.class === 'Degree I' ? 'Usthad Nabeel' : 'Ms. Safa');
    });
    D.classes.forEach(c =>
      D.attSubs.push({
        class: c,
        date: d,
        by: c === 'Degree I' ? 'Usthad Nabeel' : 'Ms. Safa',
        at: d + ' 09:' + (c === 'Degree I' ? '05' : '12'),
        verified: di > 0,
        verifiedBy: di > 0 ? 'Usthad Hameed' : '',
      }),
    );
  });
  // today
  A(1, t, 'Present', '08:55', '', 'Usthad Nabeel');
  A(2, t, 'Present', '08:55', '', 'Usthad Nabeel');
  A(3, t, 'Late', '09:20', '', 'Usthad Nabeel');
  A(6, t, 'Outside Campus', '10:45', 'District sports meet practice', 'Usthad Nabeel');
  [7, 9, 12].forEach(i => A(i, t, 'Present', '09:05', '', 'Ms. Safa'));
  A(8, t, 'Absent', '09:05', '', 'Ms. Safa');
  A(10, t, 'Outside Campus', '11:20', 'University office – exam registration', 'Ms. Safa');
  A(11, t, 'Outside Campus', '13:05', 'Picked up by guardian', 'Ms. Safa');
  D.attSubs.push({
    class: 'Degree II',
    date: t,
    by: 'Ms. Safa',
    at: t + ' 09:12',
    verified: false,
    verifiedBy: '',
  });
  const H = (status, by, at, note) => ({ status, by, at, note: note || '' });
  D.leaves = [
    {
      id: 1,
      studentId: 1,
      type: 'Personal',
      from: addDays(t, 2),
      to: addDays(t, 3),
      reason: "Sister's wedding at home",
      status: 'Awaiting Clearance',
      createdAt: addDays(t, -2) + ' 18:20',
      decidedBy: 'Principal',
      decidedAt: y + ' 11:40',
      decisionNote: 'Approved. Please complete pending assignments before leaving.',
      history: [
        H('Submitted', 'Ahmed Rashid', addDays(t, -2) + ' 18:20'),
        H(
          'Approved',
          'Principal',
          y + ' 11:40',
          'Approved. Please complete pending assignments before leaving.',
        ),
      ],
    },
    {
      id: 2,
      studentId: 2,
      type: 'Personal',
      from: addDays(t, 1),
      to: addDays(t, 1),
      reason: 'Family function in Malappuram',
      status: 'Pending',
      createdAt: t + ' 08:12',
      history: [H('Submitted', 'Amina Rahman', t + ' 08:12')],
    },
    {
      id: 3,
      studentId: 3,
      type: 'Official',
      from: addDays(t, 5),
      to: addDays(t, 6),
      reason: 'Representing the college at the inter-collegiate quiz',
      status: 'Pending',
      createdAt: y + ' 16:02',
      history: [H('Submitted', 'Faris Ali', y + ' 16:02')],
    },
    {
      id: 4,
      studentId: 7,
      type: 'Personal',
      from: addDays(t, -6),
      to: addDays(t, -5),
      reason: 'Cousin’s nikah',
      status: 'Cleared',
      createdAt: addDays(t, -9) + ' 10:00',
      decidedBy: 'Vice Principal',
      decidedAt: addDays(t, -8) + ' 12:10',
      clearedBy: 'Usthad Hameed',
      clearedAt: addDays(t, -7) + ' 10:30',
      history: [
        H('Submitted', 'Hana Fathima', addDays(t, -9) + ' 10:00'),
        H('Approved', 'Vice Principal', addDays(t, -8) + ' 12:10'),
        H('Cleared', 'Usthad Hameed', addDays(t, -7) + ' 10:30'),
      ],
    },
    {
      id: 5,
      studentId: 9,
      type: 'Personal',
      from: addDays(t, -3),
      to: addDays(t, -3),
      reason: 'Personal work',
      status: 'Rejected',
      createdAt: addDays(t, -5) + ' 09:00',
      decidedBy: 'Vice Principal',
      decidedAt: addDays(t, -4) + ' 15:00',
      decisionNote: 'Internal exam scheduled on this day.',
      history: [
        H('Submitted', 'Sara N', addDays(t, -5) + ' 09:00'),
        H('Rejected', 'Vice Principal', addDays(t, -4) + ' 15:00', 'Internal exam scheduled on this day.'),
      ],
    },
  ];
  D.medical = [
    {
      id: 1,
      studentId: 7,
      from: addDays(t, -2),
      to: addDays(t, -2),
      note: 'Unwell, visited the family doctor',
      status: 'Pending',
      createdAt: y + ' 08:30',
    },
  ];
  D.requests = [
    {
      id: 1,
      studentId: 1,
      type: 'Bonafide Certificate',
      details: 'For scholarship application',
      status: 'Completed',
      createdAt: addDays(t, -4) + ' 10:00',
      note: 'Ready for collection at the office counter.',
      history: [
        H('Submitted', 'Ahmed Rashid', addDays(t, -4) + ' 10:00'),
        H('In Progress', 'Admin office', addDays(t, -3) + ' 11:00'),
        H(
          'Completed',
          'Admin office',
          addDays(t, -2) + ' 14:00',
          'Ready for collection at the office counter.',
        ),
      ],
    },
    {
      id: 2,
      studentId: 2,
      type: 'Study Certificate',
      details: 'Needed for passport application',
      status: 'In Progress',
      createdAt: y + ' 09:30',
      history: [H('Submitted', 'Amina Rahman', y + ' 09:30'), H('In Progress', 'Admin office', t + ' 10:15')],
    },
    {
      id: 3,
      studentId: 9,
      type: 'Library Clearance',
      details: 'Transferring to another campus next month',
      status: 'Submitted',
      createdAt: t + ' 09:48',
      history: [H('Submitted', 'Sara N', t + ' 09:48')],
    },
    {
      id: 4,
      studentId: 8,
      type: 'Attendance Correction',
      details: 'I was marked absent on ' + fmtDate(days[2]) + ' but attended the afternoon session.',
      status: 'Submitted',
      createdAt: y + ' 17:05',
      history: [H('Submitted', 'Rayan K', y + ' 17:05')],
    },
  ];
  let fid = 1;
  D.students.forEach(s => {
    const paid = [3, 7, 9].includes(s.id);
    D.fees.push({
      id: fid++,
      studentId: s.id,
      category: 'Tuition – Semester 1',
      amount: 2500,
      due: s.id === 2 ? addDays(t, -5) : addDays(t, 10),
      status: paid ? 'Paid' : 'Pending',
      paidAt: paid ? addDays(t, -8) : '',
      receipt: paid ? 'R-' + (1000 + fid) : '',
    });
  });
  D.fees.push({
    id: fid++,
    studentId: 1,
    category: 'Exam fee',
    amount: 600,
    due: addDays(t, -20),
    status: 'Paid',
    paidAt: addDays(t, -22),
    receipt: 'R-1101',
  });
  D.feeTasks = [
    {
      id: 1,
      feeId: 8,
      studentId: 8,
      kind: 'Extension',
      detail: 'Scholarship amount is expected next month.',
      newDue: addDays(t, 25),
      amount: 0,
      status: 'Pending',
      requestedBy: 'Rayan K (student)',
      createdAt: y + ' 12:00',
    },
    {
      id: 2,
      feeId: 11,
      studentId: 11,
      kind: 'Concession',
      detail: 'Sibling studying in the same institution.',
      amount: 500,
      newDue: '',
      status: 'Pending',
      requestedBy: 'Admin office',
      createdAt: t + ' 09:30',
    },
  ];
  D.marks = [
    {
      id: 1,
      studentId: 1,
      subject: 'Sociology – Unit test 1',
      marks: 82,
      by: 'Usthad Nabeel',
      date: addDays(t, -6),
    },
    {
      id: 2,
      studentId: 2,
      subject: 'Sociology – Unit test 1',
      marks: 76,
      by: 'Usthad Nabeel',
      date: addDays(t, -6),
    },
    {
      id: 3,
      studentId: 3,
      subject: 'Sociology – Unit test 1',
      marks: 69,
      by: 'Usthad Nabeel',
      date: addDays(t, -6),
    },
  ];
  D.followups = [
    {
      id: 1,
      studentId: 8,
      note: 'Absent several days in a row without a leave application. Please check in with the guardian.',
      raisedBy: 'Ms. Safa',
      raisedById: 2,
      status: 'Open',
      createdAt: t + ' 09:15',
    },
  ];
  D.lab.bookings = [
    { id: 1, seat: 3, studentId: 7, date: t, status: 'Active', createdAt: t + ' 08:40' },
    { id: 2, seat: 7, studentId: 9, date: t, status: 'Active', createdAt: t + ' 08:52' },
    { id: 3, seat: 12, studentId: 12, date: t, status: 'Active', createdAt: t + ' 09:30' },
    { id: 4, seat: 15, studentId: 4, date: t, status: 'Requested', createdAt: t + ' 10:02' },
    { id: 5, seat: 22, studentId: 5, date: t, status: 'Requested', createdAt: t + ' 10:10' },
  ];
  D.libStatus = {
    7: { status: 'Cleared', note: '', by: 'Ms. Safa', at: addDays(t, -3) },
    8: { status: 'On Hold', note: '1 book overdue', by: 'Ms. Safa', at: y },
  };
  D.announcements = [
    {
      id: 1,
      title: 'Library open till 7 PM',
      body: 'The library will stay open until 7 PM throughout exam week.',
      audience: 'Everyone',
      important: false,
      by: 'Admin',
      at: y + ' 15:00',
    },
  ];
  S.db = D;
  D.__seeding = true;
  const L = ['role:Principal', 'role:Vice Principal'];
  notify(L, 'Leave request from Amina Rahman is awaiting review', {
    icon: '📨',
    ref: 'leave:2',
    link: ['Leave Decisions', 'Pending', 'leave:2'],
    action: true,
    at: t + ' 08:12',
  });
  notify(L, 'Leave request from Faris Ali is awaiting review', {
    icon: '📨',
    ref: 'leave:3',
    link: ['Leave Decisions', 'Pending', 'leave:3'],
    action: true,
    at: y + ' 16:02',
  });
  notify('student:1', 'Your leave for ' + fmtRange(addDays(t, 2), addDays(t, 3)) + ' was approved 🎉', {
    icon: '🎉',
    kind: 'celebrate',
    link: ['Leave Application', 'My Applications', 'leave:1'],
    at: y + ' 11:40',
  });
  notify('position:Academic Assistant', 'Ahmed Rashid’s approved leave needs clearance', {
    icon: '🗂️',
    ref: 'clear:1',
    link: ['Leave Clearance', 'Awaiting Clearance', 'leave:1'],
    action: true,
    at: y + ' 11:40',
  });
  notify('position:Academic Assistant', 'Medical request from Hana Fathima needs verification', {
    icon: '✚',
    ref: 'med:1',
    link: ['Verification', 'Medical Requests', 'med:1'],
    action: true,
    at: y + ' 08:30',
  });
  notify(
    'position:Academic Assistant',
    'Degree I & II attendance for ' + fmtDate(days[0]) + ' is ready to verify',
    {
      icon: '✅',
      ref: 'sub:' + days[0],
      link: ['Verification', 'Attendance Submissions'],
      action: true,
      at: days[0] + ' 09:12',
    },
  );
  notify('position:Academic Assistant', 'Attendance correction request from Rayan K', {
    icon: '🛠️',
    ref: 'req:4',
    link: ['Verification', 'Corrections', 'req:4'],
    action: true,
    at: y + ' 17:05',
  });
  notify('position:Academic Assistant', 'Ms. Safa raised a follow-up for Rayan K', {
    icon: '👀',
    ref: 'fu:1',
    link: ['Verification', 'Follow-ups', 'fu:1'],
    action: true,
    at: t + ' 09:15',
  });
  notify('position:Librarian', 'Library clearance request from Sara N', {
    icon: '📚',
    ref: 'req:3',
    link: ['Library', 'Clearance Requests', 'req:3'],
    action: true,
    at: t + ' 09:48',
  });
  notify('role:Admin', 'Study Certificate for Amina Rahman is in progress', {
    icon: '📄',
    ref: 'req:2',
    link: ['Official Requests', 'Queue', 'req:2'],
    action: true,
    at: y + ' 09:30',
  });
  notify('position:Lab Charge', 'Yusuf M requested lab seat 15', {
    icon: '💻',
    ref: 'lab:4',
    link: ['Computer Lab', 'Passes', 'lab:4'],
    action: true,
    at: t + ' 10:02',
  });
  notify('position:Lab Charge', 'Nida P requested lab seat 22', {
    icon: '💻',
    ref: 'lab:5',
    link: ['Computer Lab', 'Passes', 'lab:5'],
    action: true,
    at: t + ' 10:10',
  });
  notify(L, 'Fee extension requested for Rayan K', {
    icon: '🧾',
    ref: 'fee:1',
    link: ['Fee Authorization', 'Pending', 'fee:1'],
    action: true,
    at: y + ' 12:00',
  });
  notify(L, 'Fee concession proposed for Zainab K', {
    icon: '🧾',
    ref: 'fee:2',
    link: ['Fee Authorization', 'Pending', 'fee:2'],
    action: true,
    at: t + ' 09:30',
  });
  notify('student:1', 'Your Bonafide Certificate is ready for collection', {
    icon: '📄',
    link: ['Official Requests', 'Tracking', 'req:1'],
    at: addDays(t, -2) + ' 14:00',
    readBy: ['student:1'],
  });
  notify(['all'], 'Library open till 7 PM during exam week', {
    icon: '📢',
    link: ['Notifications', 'All'],
    at: y + ' 15:00',
  });
  delete D.__seeding;
  return D;
}
