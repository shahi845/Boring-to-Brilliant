/** Input validation for account administration. */
import { HttpError } from './http.js';

export const LOGIN_RE = /^[A-Z][A-Z0-9-]{2,23}$/; // ST-1001, SF-201, ADMIN …
export const ROLES_CREATABLE = ['Student', 'Staff'];

export function normaliseLogin(v) {
  const login = String(v ?? '')
    .trim()
    .toUpperCase();
  if (!LOGIN_RE.test(login))
    throw new HttpError(400, 'Campus ID must be 3–24 letters, digits or dashes (e.g. ST-1001)');
  return login;
}

export function checkPassword(v) {
  const pw = String(v ?? '');
  if (pw.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
  if (pw.length > 72) throw new HttpError(400, 'Password must be at most 72 characters');
  return pw;
}

export function validateNewAccount(body) {
  const login = normaliseLogin(body.login);
  const password = checkPassword(body.password);
  const role = String(body.role || '');
  if (!ROLES_CREATABLE.includes(role)) throw new HttpError(400, 'Role must be Student or Staff');
  const personId = Number(body.personId);
  if (!Number.isSafeInteger(personId) || personId <= 0)
    throw new HttpError(400, 'personId must be a positive integer');
  const name = String(body.name || '').trim();
  if (!name || name.length > 120) throw new HttpError(400, 'Name is required (max 120 characters)');
  return { login, password, role, personId, name };
}
