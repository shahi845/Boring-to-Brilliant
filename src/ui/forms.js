import { FORMS } from '../app/registry.js';
import { render } from '../app/router.js';
import { save } from '../lib/store.js';
import { esc, js } from '../lib/utils.js';
import { closeModal, toast } from './feedback.js';
/* ---------- forms with validation ---------- */
export function F(name, label, type = 'text', o = {}) {
  const v = o.value ?? '',
    req = o.required !== false,
    cls = o.full ? ' class="full"' : '';
  let input;
  if (type === 'select')
    input = `<select class="field" name="${name}" ${req ? 'data-req' : ''}>${o.placeholder ? `<option value="">${esc(o.placeholder)}</option>` : ''}${(
      o.options || []
    )
      .map(x => {
        const [val, lab] = Array.isArray(x) ? x : [x, x];
        return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`;
      })
      .join('')}</select>`;
  else if (type === 'textarea')
    input = `<textarea class="field" name="${name}" ${req ? 'data-req' : ''} maxlength="${o.max || 500}" placeholder="${esc(o.ph || '')}" ${o.phFrom ? `data-ph-from="${esc(o.phFrom)}"` : ''}>${esc(v)}</textarea>`;
  else if (type === 'readonly') input = `<div class="readonly">${esc(v)}</div>`;
  else if (type === 'checks')
    input = `<div class="checks">${(o.options || []).map(x => `<label><input type="checkbox" name="${name}" value="${esc(x)}" ${(o.value || []).includes(x) ? 'checked' : ''}> ${esc(x)}</label>`).join('')}</div>`;
  else if (type === 'checkbox')
    return `<label${cls} style="flex-direction:row;align-items:center;gap:9px"><input type="checkbox" name="${name}" ${v ? 'checked' : ''}> ${esc(label)}</label>`;
  else
    input = `<input class="field" type="${type}" name="${name}" value="${esc(v)}" ${req ? 'data-req' : ''} ${o.after ? `data-after="${esc(o.after)}"` : ''} ${o.min != null ? `min="${o.min}"` : ''} ${o.maxv != null ? `max="${o.maxv}"` : ''} placeholder="${esc(o.ph || '')}" ${type === 'text' ? 'maxlength="120"' : ''}>`;
  return `<label${cls}>${esc(label)}${input}${o.hint ? `<span class="hint">${esc(o.hint)}</span>` : ''}<span class="err" data-err="${name}"></span></label>`;
}
export function formHTML(id, fields, submit = 'Save', extra = '') {
  return `<form novalidate onsubmit="return submitForm(event,${js(id)})"><div class="formgrid">${fields.join('')}</div><div class="formactions"><button class="btn primary" type="submit">${esc(submit)}</button>${extra}</div></form>`;
}
export function submitForm(e, id) {
  e.preventDefault();
  const f = e.target,
    sub = f.querySelector('[type=submit]');
  if (sub?.disabled) return false;
  f.querySelectorAll('.err').forEach(x => (x.textContent = ''));
  f.querySelectorAll('.invalid').forEach(x => x.classList.remove('invalid'));
  const v = {};
  [...f.elements].forEach(el => {
    if (!el.name) return;
    if (el.type === 'radio') {
      if (el.checked) v[el.name] = el.value;
      else if (!(el.name in v)) v[el.name] = '';
    } else if (el.type === 'checkbox') {
      if (el.closest('.checks')) {
        v[el.name] ||= [];
        if (el.checked) v[el.name].push(el.value);
      } else v[el.name] = el.checked;
    } else v[el.name] = String(el.value).trim();
  });
  let bad = false;
  f.querySelectorAll('[data-req]').forEach(el => {
    if (!String(el.value).trim()) {
      bad = true;
      el.classList.add('invalid');
      const er = f.querySelector(`[data-err="${el.name}"]`);
      if (er) er.textContent = 'Required';
    }
  });
  f.querySelectorAll('.choice-group').forEach(g => {
    if (!g.querySelector('input:checked')) {
      bad = true;
      const er = f.querySelector(`[data-err="${g.dataset.group}"]`);
      if (er) er.textContent = 'Choose one';
    }
  });
  if (bad) {
    toast('Please fill in the highlighted fields', 'err');
    return false;
  }
  f.querySelectorAll('input[type=email]').forEach(el => {
    if (el.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value)) {
      bad = true;
      el.classList.add('invalid');
      f.querySelector(`[data-err="${el.name}"]`).textContent = 'Enter a valid email';
    }
  });
  f.querySelectorAll('input[type=number]').forEach(el => {
    const n = Number(el.value);
    if (el.value !== '' && (isNaN(n) || (el.min !== '' && n < +el.min) || (el.max !== '' && n > +el.max))) {
      bad = true;
      el.classList.add('invalid');
      f.querySelector(`[data-err="${el.name}"]`).textContent =
        'Enter a number' + (el.min !== '' ? ' from ' + el.min : '') + (el.max !== '' ? ' to ' + el.max : '');
    }
  });
  if (bad) {
    toast('Please check the highlighted fields', 'err');
    return false;
  }
  const res = FORMS[id]?.(v, f);
  if (res && res.field) {
    const el = f.querySelector(`[name="${res.field}"]`);
    el?.classList.add('invalid');
    const er = f.querySelector(`[data-err="${res.field}"]`);
    if (er) er.textContent = res.msg;
    toast(res.msg, 'err');
    return false;
  }
  if (typeof res === 'string') {
    toast(res, 'err');
    return false;
  }
  if (sub) sub.disabled = true;
  return false;
}
export function commit(msg, close = true) {
  save();
  if (close) closeModal();
  render();
  if (msg) toast(msg);
}
