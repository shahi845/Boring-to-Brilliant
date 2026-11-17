/** Authenticates API requests with the caller's Supabase access token and loads their campus profile. */
import { HttpError } from './http.js';

export async function authenticate(req, admin) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new HttpError(401, 'Sign in required');
  const user = await admin.getUserFromToken(token);
  if (!user?.id) throw new HttpError(401, 'Your session has expired — please sign in again');
  const profile = await admin.getProfileByUser(user.id);
  if (!profile) throw new HttpError(403, 'No campus profile for this account');
  return { user, profile };
}

export function requireRole(ctx, ...roles) {
  if (!roles.includes(ctx.profile.role)) throw new HttpError(403, 'You do not have permission to do this');
}
