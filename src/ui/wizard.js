/* ==========================================================================
   Step-by-step forms — one question per screen, Duolingo style.
   A wizard is an ordinary <form> split into <section> steps, so it submits
   through the same submitForm() + FORMS[id] handlers (same validation,
   same saving). The last step is an automatic "Check & submit" review.
   ========================================================================== */
import { esc, js } from '../lib/utils.js';
import { submitForm } from './forms.js';

/**
 * steps: [{ icon, title, hint, fields: [html…] }]
 * hidden: html for hidden inputs.  extra: extra buttons shown on the first step.
 */
export function wizardHTML(
  id,
  steps,
  submit = 'Submit',
  { hidden = '', extra = '', reviewTitle = 'Check and submit', start = 0 } = {},
) {
  const total = steps.length + 1;
  start = Math.max(0, Math.min(steps.length - 1, start));
  const sections = steps
    .map(
      (s, i) =>
        `<section class="wiz-step${i === start ? ' on' : ''}" data-i="${i}" aria-hidden="${i !== start}">
<div class="wiz-q">${s.icon ? `<span class="wiz-icon" aria-hidden="true">${s.icon}</span>` : ''}<div><h2>${esc(s.title)}</h2>${s.hint ? `<p class="muted">${esc(s.hint)}</p>` : ''}</div></div>
<div class="formgrid">${s.fields.join('')}</div></section>`,
    )
    .join('');
  return `<form class="wiz" novalidate data-step="${start}" data-total="${total}" onsubmit="return wizSubmit(event,${js(id)})" onkeydown="wizKey(event)" oninput="this.dataset.dirty=1" onchange="this.dataset.dirty=1">
${hidden}
<div class="wiz-top"><div class="wiz-bar" role="progressbar" aria-valuemin="1" aria-valuemax="${total}" aria-valuenow="${start + 1}"><i style="width:${(((start + 1) / total) * 100).toFixed(1)}%"></i></div><span class="wiz-count">${start + 1} / ${total}</span></div>
${sections}
<section class="wiz-step" data-i="${steps.length}" data-review aria-hidden="true">
<div class="wiz-q"><span class="wiz-icon" aria-hidden="true">✅</span><div><h2>${esc(reviewTitle)}</h2><p class="muted">Tap a row to change it.</p></div></div>
<div class="wiz-review"></div></section>
<div class="wiz-nav"><button type="button" class="btn" data-back onclick="wizBack(this)"${start ? '' : ' hidden'}>← Back</button><span class="wiz-extra"${start ? ' hidden' : ''}>${extra}</span><button type="button" class="btn primary" data-next onclick="wizNext(this)">Continue</button><button type="submit" class="btn primary" data-submit hidden>${esc(submit)}</button></div>
</form>`;
}

/** Big tap-able option cards (a radio group). options: [{value,label,icon,hint}] */
export function Choice(name, label, options, value = '', { auto = true } = {}) {
  return `<div class="choice-group full" role="radiogroup" aria-label="${esc(label)}" data-group="${esc(name)}" data-label="${esc(label)}">${options
    .map(
      o =>
        `<label class="choice-card"><input type="radio" name="${esc(name)}" value="${esc(o.value)}" ${String(o.value) === String(value) ? 'checked' : ''} ${o.ph ? `data-ph="${esc(o.ph)}"` : ''} ${auto ? 'onchange="wizAuto(this)"' : ''}><b aria-hidden="true">${o.icon || ''}</b><span>${esc(o.label || o.value)}</span>${o.hint ? `<small>${esc(o.hint)}</small>` : ''}</label>`,
    )
    .join('')}<span class="err" data-err="${esc(name)}"></span></div>`;
}

/** Quick-pick buttons that fill other fields. items: [{label, set:{field:value}}] */
export function Chips(items) {
  return `<div class="wiz-chips full">${items.map(c => `<button type="button" class="chip" data-set="${esc(JSON.stringify(c.set))}" onclick="wizSet(this)">${esc(c.label)}</button>`).join('')}</div>`;
}

/* ---------------- runtime ---------------- */
const steps = f => [...f.querySelectorAll('.wiz-step')];
function show(f, i) {
  const all = steps(f),
    n = all.length;
  i = Math.max(0, Math.min(n - 1, i));
  f.dataset.step = i;
  all.forEach((s, k) => {
    s.classList.toggle('on', k === i);
    s.setAttribute('aria-hidden', String(k !== i));
  });
  const review = all[i].hasAttribute('data-review');
  if (review) buildReview(f);
  f.querySelector('[data-back]').hidden = i === 0;
  f.querySelector('[data-next]').hidden = review;
  f.querySelector('[data-submit]').hidden = !review;
  const ex = f.querySelector('.wiz-extra');
  if (ex) ex.hidden = i !== 0;
  f.querySelector('.wiz-bar i').style.width = (((i + 1) / n) * 100).toFixed(1) + '%';
  f.querySelector('.wiz-bar').setAttribute('aria-valuenow', i + 1);
  f.querySelector('.wiz-count').textContent = `${i + 1} / ${n}`;
  const first = all[i].querySelector(
    'input:not([type=hidden]):not([type=radio]),select,textarea,input[type=radio]:checked,input[type=radio]',
  );
  if (first && !review) setTimeout(() => first.focus({ preventScroll: true }), 30);
  else f.querySelector(review ? '[data-submit]' : '[data-next]')?.focus({ preventScroll: true });
  f.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function setErr(f, name, msg) {
  const el = f.querySelector(`[name="${name}"]`);
  if (el && el.type !== 'radio') el.classList.add('invalid');
  const er = f.querySelector(`[data-err="${name}"]`);
  if (er) er.textContent = msg;
}
/** Check only the fields on one step. */
function validStep(sec) {
  const f = sec.closest('form');
  sec.querySelectorAll('.err').forEach(x => (x.textContent = ''));
  sec.querySelectorAll('.invalid').forEach(x => x.classList.remove('invalid'));
  let bad = false;
  sec.querySelectorAll('[data-req]').forEach(el => {
    if (!String(el.value).trim()) {
      bad = true;
      setErr(f, el.name, el.tagName === 'SELECT' ? 'Choose one' : 'Required');
    }
  });
  sec.querySelectorAll('.choice-group').forEach(g => {
    if (!g.querySelector('input:checked')) {
      bad = true;
      setErr(f, g.dataset.group, 'Choose one to continue');
    }
  });
  sec.querySelectorAll('input[type=number]').forEach(el => {
    const n = Number(el.value);
    if (el.value !== '' && (isNaN(n) || (el.min !== '' && n < +el.min) || (el.max !== '' && n > +el.max))) {
      bad = true;
      setErr(f, el.name, 'Enter a valid number');
    }
  });
  sec.querySelectorAll('[data-after]').forEach(el => {
    const other = f.querySelector(`[name="${el.dataset.after}"]`);
    if (el.value && other?.value && el.value < other.value) {
      bad = true;
      setErr(f, el.name, 'Can’t be before the start date');
    }
  });
  if (bad) sec.querySelector('.invalid, .choice-group input')?.focus();
  return !bad;
}
export function wizNext(b) {
  const f = b.closest('form'),
    i = +f.dataset.step;
  if (!validStep(steps(f)[i])) return;
  show(f, i + 1);
}
export function wizBack(b) {
  const f = b.closest('form');
  show(f, +f.dataset.step - 1);
}
export function wizGo(b, i) {
  show(b.closest('form'), i);
}
/** A choice was tapped: move on automatically, like a quiz. */
export function wizAuto(input) {
  const f = input.closest('form'),
    i = +f.dataset.step,
    sec = steps(f)[i];
  const er = f.querySelector(`[data-err="${input.name}"]`);
  if (er) er.textContent = '';
  if (input.dataset.ph)
    f.querySelectorAll(`[data-ph-from="${input.name}"]`).forEach(t => (t.placeholder = input.dataset.ph));
  // only auto-advance when the choice is the only thing on this step
  if (sec.querySelectorAll('input:not([type=radio]):not([type=hidden]),select,textarea').length) return;
  setTimeout(() => {
    if (+f.dataset.step === i && validStep(sec)) show(f, i + 1);
  }, 260);
}
export function wizSet(b) {
  const f = b.closest('form'),
    set = JSON.parse(b.dataset.set);
  Object.entries(set).forEach(([k, v]) => {
    const el = f.querySelector(`[name="${k}"]`);
    if (!el) return;
    el.value = v;
    el.classList.remove('invalid');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  b.parentNode.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === b));
  f.dataset.dirty = 1;
}
export function wizKey(e) {
  if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return;
  const f = e.currentTarget;
  if (steps(f)[+f.dataset.step].hasAttribute('data-review')) return;
  e.preventDefault();
  wizNext(f.querySelector('[data-next]'));
}
function labelOf(lab) {
  return [...lab.childNodes]
    .filter(n => n.nodeType === 3)
    .map(n => n.textContent)
    .join('')
    .trim();
}
function buildReview(f) {
  const rows = [];
  steps(f).forEach((sec, i) => {
    if (sec.hasAttribute('data-review')) return;
    sec.querySelectorAll('.choice-group').forEach(g => {
      const c = g.querySelector('input:checked');
      rows.push([i, g.dataset.label, c ? c.closest('label').querySelector('span').textContent : '—']);
    });
    sec.querySelectorAll('.formgrid > label').forEach(lab => {
      const el = lab.querySelector('input,select,textarea'),
        ro = lab.querySelector('.readonly');
      if (el && el.type === 'checkbox') return rows.push([i, labelOf(lab), el.checked ? 'Yes' : 'No']);
      let v = ro
        ? ro.textContent
        : el
          ? el.tagName === 'SELECT'
            ? el.selectedOptions[0]?.textContent
            : el.value
          : '';
      if (el && el.type === 'date' && v)
        v = new Date(v + 'T00:00').toLocaleDateString(undefined, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      rows.push([i, labelOf(lab), String(v || '').trim() || '—']);
    });
  });
  f.querySelector('.wiz-review').innerHTML = rows
    .map(
      ([i, l, v]) =>
        `<button type="button" class="wiz-row" onclick="wizGo(this,${i})"><span>${esc(l)}</span><b>${esc(v)}</b><i aria-hidden="true">✎</i></button>`,
    )
    .join('');
}
/** Final submit: same handler as normal forms; jump back to any step with an error. */
export function wizSubmit(e, id) {
  const r = submitForm(e, id);
  const f = e.target;
  const bad = f.querySelector('.invalid') || [...f.querySelectorAll('.err')].find(x => x.textContent);
  if (bad && f.isConnected) {
    const sec = bad.closest('.wiz-step');
    if (sec) show(f, +sec.dataset.i);
  }
  return r;
}
