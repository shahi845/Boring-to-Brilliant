/* ---------- theme ---------- */
export function toggleTheme() {
  const d = !document.body.classList.contains('dark');
  document.body.classList.toggle('dark', d);
  try {
    localStorage.setItem('ourcampus_theme', d ? 'dark' : 'light');
  } catch {}
}
/* ---------- cartoon menu (replaces the fixed sidebar) ---------- */
export function menuOpen() {
  return document.body.classList.contains('menu-open');
}
export function toggleMenu(force) {
  const open = typeof force === 'boolean' ? force : !menuOpen();
  document.body.classList.toggle('menu-open', open);
  const sb = document.getElementById('sidebar'),
    b = document.getElementById('menubtn');
  sb?.classList.toggle('open', open);
  sb?.setAttribute('aria-hidden', String(!open));
  if (b) {
    b.setAttribute('aria-expanded', String(open));
    b.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  if (open)
    setTimeout(() => sb?.querySelector('.navbtn.active, .navbtn')?.focus({ preventScroll: true }), 60);
  else if (typeof force !== 'boolean') b?.focus({ preventScroll: true });
}
export const closeMenu = () => menuOpen() && toggleMenu(false);
if (typeof window !== 'undefined')
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menuOpen()) {
      toggleMenu(false);
      document.getElementById('menubtn')?.focus();
    }
  });
