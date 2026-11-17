/** GET /api/stats — headline numbers for Admin, Principal and Vice Principal dashboards / monitoring. */
import { authenticate, requireRole } from '../lib/auth.js';
import { send } from '../lib/http.js';

export async function statsRoute(req, res, { admin }) {
  const ctx = await authenticate(req, admin);
  requireRole(ctx, 'Admin', 'Principal', 'Vice Principal');
  const [students, staff, pendingLeave, openRequests] = await Promise.all([
    admin.countRecords('students'),
    admin.countRecords('staff'),
    admin.countRecords('leaves', '&data->>status=eq.Pending'),
    admin.countRecords('requests', '&data->>status=in.(Submitted,In%20Progress)'),
  ]);
  return send(res, 200, { students, staff, pendingLeave, openRequests, at: new Date().toISOString() });
}
