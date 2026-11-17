import { FORMS } from '../app/registry.js';
import { render } from '../app/router.js';
import { config } from './config.js';
import { friendlyError } from './store.js';
import { esc } from './utils.js';
import { S } from '../state.js';
import { btn, call } from '../ui/components.js';
import { closeModal, mhead, modal, toast } from '../ui/feedback.js';
import { F, formHTML } from '../ui/forms.js';
/* ---------- account tools ---------- */
export function genPassword() {
  const w = [
      'Teal',
      'Coral',
      'River',
      'Mango',
      'Lotus',
      'Cedar',
      'Pearl',
      'Maple',
      'Orbit',
      'Comet',
      'Sunny',
      'Breeze',
      'Kite',
      'Lemon',
      'Nova',
      'Olive',
      'Palm',
      'Robin',
      'Sage',
      'Tulip',
    ],
    r = n => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  return w[r(w.length)] + w[r(w.length)].toLowerCase() + '-' + (1000 + r(9000));
}
export function nextLogin(prefix, base) {
  const n = [...S.db.students, ...S.db.staff]
    .map(x => x.login || '')
    .filter(l => l.startsWith(prefix))
    .map(l => +l.slice(prefix.length) || 0);
  return prefix + (Math.max(base, ...n) + 1);
}
/* Account administration goes through the API server (it holds the Supabase service key). */
export async function apiFetch(path, opts = {}) {
  const { data } = await S.sb.auth.getSession();
  const token = data.session?.access_token;
  let res;
  try {
    res = await fetch(config.apiUrl + path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(opts.headers || {}),
      },
    });
  } catch (e) {
    return { error: { message: 'Failed to fetch — is the API server running?' } };
  }
  let body = null;
  try {
    body = await res.json();
  } catch {}
  return res.ok
    ? { data: body, error: null }
    : { data: null, error: { message: body?.error || 'Request failed (' + res.status + ')' } };
}
export async function createAccount(login, pw, roleName, personId, name) {
  const { error } = await apiFetch('/api/accounts', {
    method: 'POST',
    body: JSON.stringify({ login, password: pw, role: roleName, personId, name }),
  });
  if (error) {
    toast('Account not created: ' + friendlyError(error), 'err');
    return false;
  }
  return true;
}
export async function deleteAccount(login) {
  const { error } = await apiFetch('/api/accounts/' + encodeURIComponent(login), { method: 'DELETE' });
  if (error) toast('Account not removed: ' + friendlyError(error), 'err');
}
export function credentialsModal(name, login, pw) {
  modal(
    mhead(
      'Account ready',
      'Share these sign-in details with ' + esc(name) + '. They can change the password in Profile.',
    ) +
      `<dl class="kv"><dt>Campus ID</dt><dd style="font-size:18px">${esc(login)}</dd><dt>Password</dt><dd style="font-size:18px">${esc(pw)}</dd></dl><div class="softinfo">This password is shown only once. Write it down or copy it now.</div><div class="formactions">${btn('Copy details', call('copyText', 'Campus ID: ' + login + '\nPassword: ' + pw), 'primary')}${btn('Done', 'closeModal()')}</div>`,
  );
}
export function copyText(t) {
  navigator.clipboard?.writeText(t).then(
    () => toast('Copied'),
    () => toast('Copy failed — please write it down', 'err'),
  );
}
export function resetPwModal(login, name) {
  if (!login) return toast('This person has no sign-in account yet', 'err');
  const pw = genPassword();
  modal(
    mhead('Reset password', esc(name) + ' · ' + esc(login)) +
      formHTML(
        'resetpw',
        [
          `<input type="hidden" name="login" value="${esc(login)}"><input type="hidden" name="nm" value="${esc(name)}">`,
          F('pw', 'New password', 'text', { value: pw, full: true, hint: 'At least 8 characters.' }),
        ],
        'Set password',
      ),
  );
}
FORMS.resetpw = v => {
  if (v.pw.length < 8) return { field: 'pw', msg: 'At least 8 characters' };
  apiFetch('/api/accounts/' + encodeURIComponent(v.login) + '/password', {
    method: 'POST',
    body: JSON.stringify({ password: v.pw }),
  }).then(({ error }) => {
    if (error) {
      toast('Not changed: ' + friendlyError(error), 'err');
      closeModal();
    } else credentialsModal(v.nm, v.login, v.pw);
  });
};
FORMS.mypw = v => {
  if (v.pw.length < 8) return { field: 'pw', msg: 'At least 8 characters' };
  if (v.pw !== v.pw2) return { field: 'pw2', msg: 'Passwords don’t match' };
  S.sb.auth.updateUser({ password: v.pw }).then(({ error }) => {
    if (error) toast('Not changed: ' + friendlyError(error), 'err');
    else {
      toast('Password changed');
      render();
    }
  });
};
