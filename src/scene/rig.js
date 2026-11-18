/* ==========================================================================
   OURCAMPUS student character — layered SVG rig + pose engine.

   The character is built from named, nested groups so every part can be
   animated on its own (here in JS, later in Rive):
     head · body · upper-arm-l/r · forearm-l/r · hand-l/r
     upper-leg-l/r · lower-leg-l/r · foot-l/r
   Each group rotates around its joint (see PIVOTS). Coordinates are local to
   the character: (0,0) is between the feet, the head top is at about y=-96.
   Two views share the same skeleton: "front" (face visible) and "back"
   (seen from behind, used for sitting at a computer or facing a shelf).
   ========================================================================== */

export const KID_COLORS = {
  line: '#213049',
  skin: '#f6c7a1',
  skinShade: '#e9a982',
  blush: '#ff9eaa',
  hair: '#3a2a35',
  hoodie: '#0e9f9a',
  hoodieDark: '#0b827e',
  pants: '#34406b',
  pantsDark: '#2a3458',
  shoe: '#ffffff',
  sole: '#ff9600',
  lanyard: '#ffc800',
  shadow: '#1c2c5926',
};

/** Joint positions in local coordinates — each named group rotates around its pivot. */
export const PIVOTS = {
  body: [0, -34],
  head: [0, -62],
  'upper-arm-l': [-14, -57],
  'forearm-l': [-14, -46],
  'hand-l': [-14, -36],
  'upper-arm-r': [14, -57],
  'forearm-r': [14, -46],
  'hand-r': [14, -36],
  'upper-leg-l': [-6, -34],
  'lower-leg-l': [-6, -21],
  'foot-l': [-6, -9],
  'upper-leg-r': [6, -34],
  'lower-leg-r': [6, -21],
  'foot-r': [6, -9],
};
export const PART_NAMES = Object.keys(PIVOTS);

const tf = (name, a = {}) => {
  const ang = a[name] || 0,
    [px, py] = PIVOTS[name];
  return ang ? ` transform="rotate(${+ang.toFixed(2)} ${px} ${py})"` : '';
};

function leg(side, a, C) {
  const s = side === 'l' ? -1 : 1,
    x = 6 * s;
  const st = `stroke="${C.line}" stroke-width="1.6" stroke-linejoin="round"`;
  return `<g id="upper-leg-${side}" data-part="upper-leg-${side}"${tf('upper-leg-' + side, a)}>
<rect x="${x - 4.5}" y="-35" width="9" height="15" rx="4.5" fill="${C.pants}" ${st}/>
<g id="lower-leg-${side}" data-part="lower-leg-${side}"${tf('lower-leg-' + side, a)}>
<rect x="${x - 4}" y="-23" width="8" height="15" rx="4" fill="${C.pantsDark}" ${st}/>
<g id="foot-${side}" data-part="foot-${side}"${tf('foot-' + side, a)}>
<path d="M${x - 5 + (s < 0 ? -3 : 0)} -2 q0 -8 ${s < 0 ? 8 : 5} -8 q${s < 0 ? 5 : 8} 0 ${s < 0 ? 5 : 8} 8 z" fill="${C.shoe}" ${st}/>
<rect x="${x - 5 + (s < 0 ? -3 : 0)}" y="-2.4" width="13" height="3.2" rx="1.6" fill="${C.sole}" ${st}/>
</g></g></g>`;
}

function arm(side, a, C, back) {
  const s = side === 'l' ? -1 : 1,
    x = 14 * s;
  const st = `stroke="${C.line}" stroke-width="1.6" stroke-linejoin="round"`;
  return `<g id="upper-arm-${side}" data-part="upper-arm-${side}"${tf('upper-arm-' + side, a)}>
<rect x="${x - 4.5}" y="-60" width="9" height="16" rx="4.5" fill="${C.hoodie}" ${st}/>
<g id="forearm-${side}" data-part="forearm-${side}"${tf('forearm-' + side, a)}>
<rect x="${x - 4}" y="-48" width="8" height="13" rx="4" fill="${C.hoodieDark}" ${st}/>
<g id="hand-${side}" data-part="hand-${side}"${tf('hand-' + side, a)}>
<circle cx="${x}" cy="-33" r="4.6" fill="${C.skin}" ${st}/>
<g data-slot="hand-${side}"></g>
</g></g></g>`;
}

function face(C, expr) {
  const mouth =
    expr === 'open'
      ? `<path d="M-5 -71.5 q5 8 10 0 z" fill="#c2445a" stroke="${C.line}" stroke-width="1.4" stroke-linejoin="round"/><path d="M-2.6 -68.6 q2.6 -2.2 5.2 0" fill="#ff8a9b"/>`
      : expr === 'wow'
        ? `<ellipse cx="0" cy="-69.5" rx="2.6" ry="3.2" fill="#c2445a" stroke="${C.line}" stroke-width="1.4"/>`
        : expr === 'focus'
          ? `<path d="M-3 -70 h6" stroke="${C.line}" stroke-width="1.8" stroke-linecap="round"/>`
          : `<path d="M-5 -71.2 q5 5.5 10 0" fill="none" stroke="${C.line}" stroke-width="1.8" stroke-linecap="round"/>`;
  return `<g id="face" data-part="face">
<g data-part="eyes"><ellipse cx="-6" cy="-79" rx="2.3" ry="2.9" fill="${C.line}"/><ellipse cx="6" cy="-79" rx="2.3" ry="2.9" fill="${C.line}"/>
<circle cx="-5.2" cy="-80" r=".8" fill="#fff"/><circle cx="6.8" cy="-80" r=".8" fill="#fff"/></g>
<path d="M-9 -84.5 q3 -2 6 -.6 M3 -85.1 q3 -1.4 6 .6" fill="none" stroke="${C.hair}" stroke-width="1.6" stroke-linecap="round"/>
<ellipse cx="-10.5" cy="-73.5" rx="3" ry="1.8" fill="${C.blush}" opacity=".7"/><ellipse cx="10.5" cy="-73.5" rx="3" ry="1.8" fill="${C.blush}" opacity=".7"/>
<g data-part="mouth">${mouth}</g></g>`;
}

function head(C, back, expr, a) {
  const st = `stroke="${C.line}" stroke-width="1.6" stroke-linejoin="round"`;
  return `<g id="head" data-part="head"${tf('head', a)}>
<rect x="-4" y="-66" width="8" height="7" rx="3" fill="${C.skinShade}" ${st}/>
<circle cx="-15.5" cy="-77" r="3.6" fill="${C.skin}" ${st}/><circle cx="15.5" cy="-77" r="3.6" fill="${C.skin}" ${st}/>
<circle cx="0" cy="-78" r="16" fill="${back ? C.hair : C.skin}" ${st}/>
${
  back
    ? `<path d="M-13 -70 q13 7 26 0" fill="none" stroke="${C.line}" stroke-width="1.2" opacity=".35"/><path d="M-6 -92 q6 -5 12 0" fill="none" stroke="#ffffff" stroke-width="1.6" opacity=".25" stroke-linecap="round"/>`
    : `<path d="M-16 -79 q-1 -16 14 -16 q17 -1 18 15 q-6 -8 -15 -7 q-5 5 -17 8 z" fill="${C.hair}" ${st}/>${face(C, expr)}`
}
</g>`;
}

function torso(C, back) {
  const st = `stroke="${C.line}" stroke-width="1.6" stroke-linejoin="round"`;
  return `<rect x="-14" y="-63" width="28" height="33" rx="11" fill="${C.hoodie}" ${st}/>
${
  back
    ? `<path d="M-9 -63 q9 9 18 0" fill="${C.hoodieDark}" ${st}/><path d="M-11 -40 h22" stroke="${C.hoodieDark}" stroke-width="2" stroke-linecap="round"/>`
    : `<path d="M-6 -63 l6 6 l6 -6" fill="none" stroke="${C.lanyard}" stroke-width="2" stroke-linecap="round"/>
<path d="M0 -57 v6" stroke="${C.lanyard}" stroke-width="2"/><rect x="-4" y="-52" width="8" height="10" rx="2" fill="#fff" ${st}/><rect x="-2.4" y="-50" width="4.8" height="2.4" rx="1" fill="${C.hoodie}"/>
<path d="M-9 -38 h18 v4 q-9 3 -18 0 z" fill="${C.hoodieDark}" opacity=".55"/>`
}`;
}

/**
 * One view of the character as an SVG <g>. `a` = joint angles (degrees),
 * `bob` = [dx, dy] whole-body offset, `expr` = smile | open | wow | focus.
 */
export function rigSVG(
  view = 'front',
  { a = {}, bob = [0, 0], expr = 'smile', legs = true, C = KID_COLORS } = {},
) {
  const back = view === 'back';
  const arms = arm('l', a, C, back) + arm('r', a, C, back);
  return `<g class="rig rig-${view}" data-view="${view}" id="rig-${view}">
<ellipse id="shadow" cx="0" cy="0" rx="16" ry="4.2" fill="${C.shadow}"/>
<g id="bob" data-part="bob"${bob[0] || bob[1] ? ` transform="translate(${bob[0]} ${bob[1]})"` : ''}>
<g id="legs" data-part="legs"${legs ? '' : ' style="display:none"'}>${leg('l', a, C)}${leg('r', a, C)}</g>
<g id="body" data-part="body"${tf('body', a)}>
${back ? arms : ''}<g id="torso">${torso(C, back)}</g>${back ? '' : arms}
${head(C, back, expr, a)}
</g></g></g>`;
}

/* ---------------- poses ----------------
   Each pose returns joint angles for time t (seconds). Positive angles swing a
   hanging limb toward screen-left, so left limbs go "outward" with + and right
   limbs go outward with −. */
const sin = Math.sin,
  cos = Math.cos;
export const POSES = {
  stand: t => ({
    view: 'front',
    a: {
      'upper-arm-l': 6 + 2 * sin(t * 2),
      'upper-arm-r': -6 - 2 * sin(t * 2),
      'forearm-l': -8,
      'forearm-r': 8,
    },
    bob: [0, sin(t * 2.2) * 0.6],
  }),
  wave: t => ({
    view: 'front',
    a: {
      'upper-arm-l': 6,
      'forearm-l': -8,
      'upper-arm-r': -150,
      'forearm-r': -25 + 25 * sin(t * 8),
      head: 4 * sin(t * 2),
    },
    bob: [0, sin(t * 2.2) * 0.6],
  }),
  walk: t => {
    const p = t * 10,
      s = sin(p);
    return {
      view: 'front',
      a: {
        'upper-leg-l': 18 * s,
        'upper-leg-r': 18 * s,
        'lower-leg-l': -10 * Math.max(0, s),
        'lower-leg-r': -10 * Math.max(0, -s),
        'foot-l': -8 * s,
        'foot-r': -8 * s,
        'upper-arm-l': 12 - 16 * s,
        'upper-arm-r': -12 - 16 * s,
        'forearm-l': -14,
        'forearm-r': 14,
        head: 3 * s,
        body: 2 * s,
      },
      bob: [0, -Math.abs(cos(p)) * 2.4],
    };
  },
  turn: t => ({ ...POSES.stand(t), expr: 'wow' }),
  /** back view, knees bending as the student lowers onto the chair */
  prepare: () => ({
    view: 'back',
    a: {
      'upper-arm-l': 28,
      'upper-arm-r': -28,
      'forearm-l': -20,
      'forearm-r': 20,
      'upper-leg-l': 14,
      'upper-leg-r': -14,
    },
    bob: [0, 5],
  }),
  sit: t => ({
    view: 'back',
    legs: false,
    a: { 'upper-arm-l': 30, 'upper-arm-r': -30, 'forearm-l': -105, 'forearm-r': 105, head: 2 * sin(t) },
    bob: [0, 0],
  }),
  type: t => ({
    view: 'back',
    legs: false,
    a: {
      'upper-arm-l': 30,
      'upper-arm-r': -30,
      'forearm-l': -105 + 6 * sin(t * 18),
      'forearm-r': 105 + 6 * sin(t * 18 + 2),
      head: 3 * sin(t * 1.3),
    },
    bob: [0, 0],
  }),
  cheer: t => {
    const h = Math.abs(sin(t * 6.5));
    return {
      view: 'front',
      expr: 'open',
      a: {
        'upper-arm-l': 150 + 12 * sin(t * 13),
        'forearm-l': 22,
        'upper-arm-r': -150 - 12 * sin(t * 13),
        'forearm-r': -22,
        'upper-leg-l': 8 * h,
        'upper-leg-r': -8 * h,
      },
      bob: [0, -h * 9],
    };
  },
  /* ---- library ---- */
  browse: t => ({
    view: 'back',
    a: { 'upper-arm-l': 6, 'upper-arm-r': -6, head: 9 * sin(t * 1.4) },
    bob: [0, sin(t * 2.2) * 0.6],
  }),
  reach: t => ({
    view: 'back',
    a: { 'upper-arm-l': 6, 'upper-arm-r': -165 + 4 * sin(t * 6), 'forearm-r': -8, head: -6 },
    bob: [0, -2],
  }),
  pull: () => ({
    view: 'back',
    a: { 'upper-arm-l': 6, 'upper-arm-r': -115, 'forearm-r': -40, head: -3 },
    bob: [0, 0],
  }),
  hold: t => ({
    view: 'front',
    expr: 'smile',
    a: { 'upper-arm-l': 6 + 2 * sin(t * 2), 'forearm-l': -8, 'upper-arm-r': -12, 'forearm-r': 100 },
    bob: [0, sin(t * 2.2) * 0.6],
  }),
  carry: t => {
    const w = POSES.walk(t);
    return { ...w, a: { ...w.a, 'upper-arm-r': -12, 'forearm-r': 100 } };
  },
  give: t => ({
    view: 'back',
    a: {
      'upper-arm-l': 150,
      'forearm-l': -25,
      'upper-arm-r': -150 + 4 * sin(t * 3),
      'forearm-r': 25,
      head: 2 * sin(t * 2),
    },
    bob: [0, -1],
  }),
};

/** Character group at a scene position. `flip` = -1 faces left. */
export function kidSVG({
  x = 0,
  y = 0,
  scale = 1,
  flip = 1,
  pose = 'stand',
  t = 0,
  C = KID_COLORS,
  holding = '',
} = {}) {
  const P = POSES[pose](t);
  const view = P.view;
  const fr = rigSVG('front', view === 'front' ? { ...P, C } : { C }),
    bk = rigSVG('back', view === 'back' ? { ...P, C } : { C });
  const slot = s =>
    holding ? s.replace('<g data-slot="hand-r"></g>', `<g data-slot="hand-r">${holding}</g>`) : s;
  return `<g class="kid" id="student" data-kid transform="translate(${x} ${y}) scale(${scale})"><g data-flip transform="scale(${flip} 1)">
<g data-viewwrap="front"${view === 'front' ? '' : ' style="display:none"'}>${slot(fr)}</g>
<g data-viewwrap="back"${view === 'back' ? '' : ' style="display:none"'}>${slot(bk)}</g>
</g></g>`;
}

/* ---------------- runtime controller ---------------- */
const reduce = () => {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};
const lerp = (a, b, k) => a + (b - a) * k;
const ease = k => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

/**
 * Drives one character element: position tweens, facing, view switches and
 * looping poses. Methods return promises so scenes read like a script:
 *   await kid.walk([[x,y],…]); await kid.turn('back'); kid.pose('sit');
 */
export class Kid {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.scale = 1;
    this.flip = 1;
    this.squash = 1;
    this.poseName = 'stand';
    this.t0 = performance.now();
    this.tw = null;
    this.el = null;
    this.raf = 0;
    this.instant = reduce();
  }
  bind(el) {
    this.el = el;
    this.parts = {};
    if (!el) return this;
    for (const v of ['front', 'back']) {
      const w = el.querySelector(`[data-viewwrap="${v}"]`);
      const m = {
        wrap: w,
        bob: w.querySelector('[data-part="bob"]'),
        legs: w.querySelector('[data-part="legs"]'),
      };
      PART_NAMES.forEach(n => (m[n] = w.querySelector(`[data-part="${n}"]`)));
      m.mouth = w.querySelector('[data-part="mouth"]');
      m.eyes = w.querySelector('[data-part="eyes"]');
      this.parts[v] = m;
    }
    this.flipEl = el.querySelector('[data-flip]');
    this.hand = el.querySelector('[data-viewwrap="front"] [data-slot="hand-r"]');
    this.handBack = el.querySelector('[data-viewwrap="back"] [data-slot="hand-r"]');
    this.expr = '';
    this.apply(performance.now());
    cancelAnimationFrame(this.raf);
    this.loop();
    return this;
  }
  loop() {
    const f = now => {
      if (!this.el || !this.el.isConnected) {
        this.raf = 0;
        return;
      }
      this.step(now);
      this.raf = requestAnimationFrame(f);
    };
    this.raf = requestAnimationFrame(f);
  }
  step(now) {
    const tw = this.tw;
    if (tw) {
      const k = Math.min(1, (now - tw.start) / tw.dur);
      const kk = tw.ease ? ease(k) : k;
      tw.apply(kk);
      if (k >= 1) {
        this.tw = null;
        tw.done();
      }
    }
    this.apply(now);
  }
  apply(now) {
    if (!this.el) return;
    const t = (now - this.t0) / 1000,
      P = POSES[this.poseName](t),
      view = P.view;
    this.el.setAttribute(
      'transform',
      `translate(${this.x.toFixed(1)} ${this.y.toFixed(1)}) scale(${this.scale})`,
    );
    this.flipEl.setAttribute('transform', `scale(${(this.flip * this.squash).toFixed(3)} 1)`);
    for (const v of ['front', 'back']) {
      const m = this.parts[v];
      if (!m) continue;
      m.wrap.style.display = v === view ? '' : 'none';
      if (v !== view) continue;
      PART_NAMES.forEach(n => {
        const el = m[n];
        if (!el) return;
        const ang = (P.a && P.a[n]) || 0,
          [px, py] = PIVOTS[n];
        el.setAttribute('transform', ang ? `rotate(${ang.toFixed(2)} ${px} ${py})` : '');
      });
      const b = P.bob || [0, 0];
      m.bob.setAttribute('transform', `translate(${b[0].toFixed(2)} ${b[1].toFixed(2)})`);
      m.legs.style.display = P.legs === false ? 'none' : '';
      if (m.eyes) {
        const blink = t % 3.6 < 0.12 ? 0.15 : 1;
        m.eyes.setAttribute(
          'transform',
          blink < 1 ? `translate(0 -79) scale(1 ${blink}) translate(0 79)` : '',
        );
      }
      const ex = P.expr || 'smile';
      if (m.mouth && ex !== this.expr) {
        this.expr = ex;
        const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        tmp.innerHTML = rigSVG('front', { expr: ex });
        const nm = tmp.querySelector('[data-part="mouth"]');
        m.mouth.innerHTML = nm.innerHTML;
      }
    }
  }
  pose(name) {
    if (name !== this.poseName) {
      this.poseName = name;
      this.t0 = performance.now();
    }
    return this;
  }
  place(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }
  tween(dur, apply, easeOn = false) {
    return new Promise(res => {
      if (this.tw) this.tw.done();
      if (this.instant || !this.el) {
        apply(1);
        res();
        return;
      }
      this.tw = { start: performance.now(), dur, apply, done: res, ease: easeOn };
    });
  }
  wait(ms) {
    return new Promise(r => setTimeout(r, this.instant ? 0 : ms));
  }
  /** Walk through waypoints at `speed` scene units per second. */
  async walk(points, { speed = 150, pose = 'walk' } = {}) {
    for (const [nx, ny] of points) {
      const sx = this.x,
        sy = this.y,
        d = Math.hypot(nx - sx, ny - sy);
      if (d < 0.5) continue;
      if (Math.abs(nx - sx) > 2) this.flip = nx < sx ? -1 : 1;
      this.pose(pose);
      await this.tween((d / speed) * 1000, k => {
        this.x = lerp(sx, nx, k);
        this.y = lerp(sy, ny, k);
      });
    }
  }
  /** Turn in place: squash horizontally, swap pose/view at the midpoint. */
  async turn(nextPose, flip = this.flip) {
    await this.tween(140, k => (this.squash = 1 - 0.85 * k));
    this.pose(nextPose);
    this.flip = flip;
    await this.tween(140, k => (this.squash = 0.15 + 0.85 * k));
    this.squash = 1;
  }
  async moveTo(x, y, dur = 400, pose) {
    if (pose) this.pose(pose);
    const sx = this.x,
      sy = this.y;
    await this.tween(
      dur,
      k => {
        this.x = lerp(sx, x, k);
        this.y = lerp(sy, y, k);
      },
      true,
    );
  }
  /** Put markup (e.g. a book) into the right hand of both views. */
  hold(markupFront, markupBack = markupFront) {
    if (this.hand) this.hand.innerHTML = markupFront || '';
    if (this.handBack) this.handBack.innerHTML = markupBack || '';
  }
  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.el = null;
  }
}
