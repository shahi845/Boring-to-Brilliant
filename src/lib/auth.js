import { createClient } from '@supabase/supabase-js';
import { route } from '../app/router.js';
import { seed } from '../data/seed.js';
import { config } from './config.js';
import { emptyDB, friendlyError, loadAll, loginEmail, save, snapshotEmpty, syncQ } from './store.js';
import { $ } from './utils.js';
import { S } from '../state.js';
import { closeModal, toast } from '../ui/feedback.js';
/* ---------- auth ---------- */
export function showScreen(which) {
  $('authscreen').hidden = which !== 'auth';
  $('loadscreen').hidden = which !== 'load';
  document.querySelector('.app').hidden = which !== 'app';
}
export function authError(t) {
  const e = $('autherr');
  e.textContent = t;
  e.hidden = !t;
}
export async function signIn(e) {
  e.preventDefault();
  const id = $('loginid').value.trim(),
    pw = $('loginpw').value,
    b = $('loginbtn');
  if (!id || !pw) return authError('Enter your campus ID and password.');
  if (!S.sb)
    return authError(
      'This site is not connected to Supabase yet. Add your project URL and key in config.js.',
    );
  b.disabled = true;
  b.textContent = 'Signing in…';
  authError('');
  const { data, error } = await S.sb.auth.signInWithPassword({ email: loginEmail(id), password: pw });
  b.disabled = false;
  b.textContent = 'Sign in';
  if (error)
    return authError(
      /invalid/i.test(error.message) ? 'Campus ID or password is incorrect.' : friendlyError(error),
    );
  $('loginpw').value = '';
  S.session = data.session;
  await startApp();
}
export async function signOut() {
  try {
    await syncQ;
  } catch {}
  await S.sb.auth.signOut();
  S.profile = null;
  S.session = null;
  S.db = emptyDB();
  closeModal();
  history.replaceState(null, '', '#/Home');
  showScreen('auth');
}
export async function startApp() {
  showScreen('load');
  try {
    const { data: p, error } = await S.sb
      .from('profiles')
      .select('*')
      .eq('user_id', S.session.user.id)
      .single();
    if (error || !p) {
      await S.sb.auth.signOut();
      showScreen('auth');
      return authError('This account has no campus profile. Ask the office to set it up.');
    }
    S.profile = p;
    await loadAll();
    if (!S.db.settings.institution) {
      if (p.role === 'Admin') {
        seed();
        snapshotEmpty();
        save();
        await syncQ;
        await loadAll();
        toast('Campus data created — welcome!');
      } else {
        await S.sb.auth.signOut();
        showScreen('auth');
        return authError('The campus isn’t set up yet. The Admin needs to sign in once first.');
      }
    }
    S.role = p.role;
    if (S.role === 'Student') S.ui.studentId = +p.person_id;
    if (S.role === 'Staff') {
      S.ui.staffId = +p.person_id;
      const s = S.db.staff.find(x => x.id === +p.person_id);
      if (
        s &&
        s.positions.includes('Academic Assistant') &&
        !s.positions.includes('Teacher / Usthad') &&
        !s.classes.length
      ) {
        S.role = 'Academic Assistant';
        S.ui.aaId = s.id;
      }
    }
    showScreen('app');
    route();
  } catch (e) {
    console.error(e);
    showScreen('auth');
    authError('Couldn’t load your campus: ' + friendlyError(e));
  }
}
export function togglePw(btn) {
  const i = $('loginpw');
  i.type = i.type === 'password' ? 'text' : 'password';
  btn.textContent = i.type === 'password' ? 'Show' : 'Hide';
}
export async function bootAuth() {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    showScreen('auth');
    authError('Setup needed: add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.');
    return;
  }
  S.sb = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  const { data } = await S.sb.auth.getSession();
  S.session = data.session;
  if (S.session) await startApp();
  else showScreen('auth');
  S.sb.auth.onAuthStateChange((ev, s) => {
    if (ev === 'SIGNED_OUT' && S.profile) {
      S.profile = null;
      showScreen('auth');
    }
    if (s) S.session = s;
  });
}
