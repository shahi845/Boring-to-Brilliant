/* ---------- theme ---------- */
export function toggleTheme() {
  const d = !document.body.classList.contains('dark');
  document.body.classList.toggle('dark', d);
  try {
    localStorage.setItem('ourcampus_theme', d ? 'dark' : 'light');
  } catch {}
}
