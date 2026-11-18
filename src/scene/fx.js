/* Shared scene helpers: confetti, busy flag, and re-mount on resize/theme. */
let busyCount = 0;
export const sceneBusy = () => busyCount > 0;
export async function busyWhile(fn) {
  busyCount++;
  try {
    return await fn();
  } finally {
    busyCount--;
  }
}

export function confettiSVG(cx, cy, C, settled = false) {
  const cols = [C.state.free, C.state.selected, C.state.requested, C.state.occupied, C.door, C.pot];
  let out = '';
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2,
      r = 50 + (i % 5) * 16,
      dx = Math.cos(a) * r,
      dy = Math.sin(a) * r * 0.7 - 30;
    if (settled) {
      out += `<rect x="${(cx - 3 + dx * 0.8).toFixed(1)}" y="${(cy - 3 + dy * 0.8 + 30).toFixed(1)}" width="${i % 3 ? 6 : 8}" height="${i % 2 ? 10 : 6}" rx="2" fill="${cols[i % cols.length]}" transform="rotate(${(i * 47) % 360} ${(cx + dx * 0.8).toFixed(1)} ${(cy + dy * 0.8 + 30).toFixed(1)})"/>`;
      continue;
    }
    out += `<rect class="confetti" x="${cx - 3}" y="${cy - 3}" width="${i % 3 ? 6 : 8}" height="${i % 2 ? 10 : 6}" rx="2" fill="${cols[i % cols.length]}" style="--dx:${dx.toFixed(0)}px;--dy:${dy.toFixed(0)}px;--r:${(i * 47) % 360}deg;animation-delay:${(i % 6) * 30}ms"/>`;
  }
  return `<g class="confetti-burst">${out}</g>`;
}

const subs = new Set();
let lastW = typeof window !== 'undefined' ? window.innerWidth : 0;
export function onSceneEnvChange(fn) {
  subs.add(fn);
}
if (typeof window !== 'undefined') {
  let tmr = 0;
  window.addEventListener('resize', () => {
    clearTimeout(tmr);
    tmr = setTimeout(() => {
      const w = window.innerWidth;
      if (w < 700 !== lastW < 700 || Math.abs(w - lastW) > 160) {
        lastW = w;
        subs.forEach(f => f());
      }
    }, 200);
  });
  let dark = document.body.classList.contains('dark');
  new MutationObserver(() => {
    const d = document.body.classList.contains('dark');
    if (d === dark) return;
    dark = d;
    subs.forEach(f => f());
  }).observe(document.body, {
    attributes: true,
    attributeFilter: ['class'],
  });
}
