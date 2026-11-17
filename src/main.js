/**
 * OURCAMPUS — application entry point.
 *
 * 1. Imports every feature module (each registers its pages, homes and forms).
 * 2. Exposes module functions on window so the HTML templates' inline handlers
 *    (onclick="go('Fees')") can call them.
 * 3. Restores the theme and starts authentication.
 */
import * as m0 from './app/router.js';
import * as m1 from './app/structure.js';
import * as m2 from './data/seed.js';
import * as m3 from './lib/accounts.js';
import * as m4 from './lib/auth.js';
import * as m5 from './lib/constants.js';
import * as m6 from './lib/migrate.js';
import * as m7 from './lib/notifications.js';
import * as m8 from './lib/permissions.js';
import * as m9 from './lib/store.js';
import * as m10 from './lib/utils.js';
import * as m11 from './pages/admin.js';
import * as m12 from './pages/attendance.js';
import * as m13 from './pages/fees.js';
import * as m14 from './pages/forms.js';
import * as m15 from './pages/home.js';
import * as m16 from './pages/lab.js';
import * as m17 from './pages/leave.js';
import * as m18 from './pages/library.js';
import * as m19 from './pages/medical.js';
import * as m20 from './pages/my-students.js';
import * as m21 from './pages/notifications.js';
import * as m22 from './pages/requests.js';
import * as m23 from './pages/shared.js';
import * as m24 from './pages/system.js';
import * as m25 from './pages/verification.js';
import * as m26 from './ui/components.js';
import * as m27 from './ui/feedback.js';
import * as m28 from './ui/forms.js';
import * as m29 from './ui/search.js';
import * as m30 from './ui/theme.js';
import { bootAuth } from './lib/auth.js';
import { emptyDB, initBackgroundSync } from './lib/store.js';
import { initRouter } from './app/router.js';
import { initShortcuts } from './ui/search.js';
import { S } from './state.js';

Object.assign(
  window,
  m0,
  m1,
  m2,
  m3,
  m4,
  m5,
  m6,
  m7,
  m8,
  m9,
  m10,
  m11,
  m12,
  m13,
  m14,
  m15,
  m16,
  m17,
  m18,
  m19,
  m20,
  m21,
  m22,
  m23,
  m24,
  m25,
  m26,
  m27,
  m28,
  m29,
  m30,
);

try {
  if (localStorage.getItem('ourcampus_theme') === 'dark') document.body.classList.add('dark');
} catch {
  /* storage unavailable */
}
S.db = emptyDB();
initRouter();
initShortcuts();
initBackgroundSync();
bootAuth();
