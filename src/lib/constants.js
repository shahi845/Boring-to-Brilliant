'use strict';
/* ==========================================================================
   OURCAMPUS — campus management web app
   Data is stored in Supabase. Sign-in uses Supabase Auth (campus ID + password)
   and Row Level Security in the database enforces who can read / write what.
   ========================================================================== */
export const KEY = 'ourcampus_v2',
  UIKEY = 'ourcampus_ui_v2';
export const ROLES = ['Student', 'Staff', 'Admin', 'Principal', 'Vice Principal', 'Academic Assistant'];
export const BUILTIN_POSITIONS = [
  'Teacher / Usthad',
  'Librarian',
  'Lab Charge',
  'Academic Assistant',
  'Office Staff',
];
export const POSITION_INFO = {
  'Teacher / Usthad': 'Assigned classes, attendance marking, marks and student follow-ups',
  Librarian: 'Library clearance requests and student library status',
  'Lab Charge': 'Computer lab seat map, pass requests and seat availability',
  'Academic Assistant':
    'Leave clearance, attendance verification, medical checks, corrections and follow-ups',
  'Office Staff': 'Title only — adds no extra features',
};
export const STATUSES = ['Present', 'Absent', 'Late', 'On Leave', 'Outside Campus'];
export const SHORT = {
  Present: 'Present',
  Absent: 'Absent',
  Late: 'Late',
  'On Leave': 'Leave',
  'Outside Campus': 'Outside',
};
export const REQUEST_TYPES = [
  'Bonafide Certificate',
  'Study Certificate',
  'Permission Letter',
  'Attendance Correction',
  'Library Clearance',
  'Other',
];
export const REQ_ICON = {
  'Bonafide Certificate': '📜',
  'Study Certificate': '🎓',
  'Permission Letter': '✉️',
  'Attendance Correction': '🛠️',
  'Library Clearance': '📚',
  Other: '📝',
  'Book Issue': '📖',
};
/** Raised from the library scene (not from the Official Requests picker); handled by the Librarian. */
export const BOOK_ISSUE = 'Book Issue';
export const HANDLERS = ['Admin office', 'Academic Assistant', 'Librarian'];
export const AUTHORITY = ['Principal & Vice Principal', 'Principal only', 'Vice Principal only'];
export const ICONS = {
  Home: '🏠',
  Attendance: '📅',
  'Leave Application': '📝',
  'Official Requests': '📄',
  Fees: '💳',
  'Lab Pass': '💻',
  Notifications: '🔔',
  Profile: '⚙',
  'My Students': '👥',
  'Leave Clearance': '🗂️',
  Verification: '✅',
  Library: '📚',
  'Computer Lab': '💻',
  'Leave Decisions': '📨',
  'Fee Authorization': '🧾',
  Announcements: '📢',
  Students: '🎓',
  'Staff Management': '🧑‍🏫',
  Admissions: '➕',
  Reports: '📊',
  Settings: '🛠️',
};
