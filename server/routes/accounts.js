/**
 * Account administration (Admin only).
 *   POST   /api/accounts                   create a sign-in account for a student or staff member
 *   POST   /api/accounts/:login/password   set a new password
 *   DELETE /api/accounts/:login            remove the sign-in account (campus records are kept)
 */
import { authenticate, requireRole } from '../lib/auth.js';
import { HttpError, readJson, send } from '../lib/http.js';
import { checkPassword, normaliseLogin, validateNewAccount } from '../lib/validate.js';

export async function accountsRoute(req, res, { admin, cfg, parts, audit }) {
  const ctx = await authenticate(req, admin);
  requireRole(ctx, 'Admin');

  if (req.method === 'POST' && parts.length === 0) {
    const input = validateNewAccount(await readJson(req));
    if (await admin.getProfileByLogin(input.login))
      throw new HttpError(409, `Campus ID ${input.login} already has an account`);
    const email = `${input.login.toLowerCase()}@${cfg.loginDomain}`;
    const user = await admin.createUser(email, input.password, input.name);
    try {
      await admin.insertProfile({
        user_id: user.id,
        login_id: input.login,
        role: input.role,
        person_id: input.personId,
        display_name: input.name,
      });
    } catch (e) {
      await admin.deleteUser(user.id).catch(() => {}); // roll back half-created account
      throw e;
    }
    audit('account.create', ctx, input.login);
    return send(res, 201, { login: input.login });
  }

  const login = normaliseLogin(decodeURIComponent(parts[0] || ''));
  const target = await admin.getProfileByLogin(login);
  if (!target) throw new HttpError(404, `No account for ${login}`);

  if (req.method === 'POST' && parts[1] === 'password' && parts.length === 2) {
    const { password } = await readJson(req);
    await admin.setPassword(target.user_id, checkPassword(password));
    audit('account.password', ctx, login);
    return send(res, 200, { login });
  }

  if (req.method === 'DELETE' && parts.length === 1) {
    if (target.user_id === ctx.user.id) throw new HttpError(400, 'You cannot remove your own account');
    await admin.deleteUser(target.user_id);
    audit('account.delete', ctx, login);
    return send(res, 200, { login });
  }

  throw new HttpError(405, 'Method not allowed');
}
