import { counts, navAll } from '../app/structure.js';
import { me } from '../lib/permissions.js';
import { esc, js } from '../lib/utils.js';
import { S } from '../state.js';
/* ---------- small UI builders ---------- */
export function roleLabel() {
  const m = me();
  return (S.role === 'Staff' || S.role === 'Academic Assistant') && m
    ? m.name + ' · ' + S.role
    : S.role === 'Student' && m
      ? m.name + ' · ' + m.class
      : S.role + ' workspace';
}
export function heading(title, desc = '', action = '') {
  return `<div class="heading"><div>${S.page !== 'Home' ? `<button class="backbtn" onclick="goBack()">← Back</button>` : ''}<div class="eyebrow">${esc(roleLabel())}</div><h1>${esc(title)}</h1>${desc ? `<p>${esc(desc)}</p>` : ''}</div>${action ? `<div class="actions">${action}</div>` : ''}</div>`;
}
export function tabs() {
  const it = navAll().find(n => n.page === S.page);
  if (!it || it.sections.length < 2) return '';
  const c = counts();
  return `<div class="tabs" role="tablist">${it.sections.map(s => `<button role="tab" aria-selected="${s === S.section}" class="${s === S.section ? 'on' : ''}" onclick="go(${js(S.page)},${js(s)})">${esc(s)}${c[S.page + '/' + s] ? `<span class="tc">${c[S.page + '/' + s]}</span>` : ''}</button>`).join('')}</div>`;
}
export function card(title, body, attrs = '') {
  return `<div class="card" ${attrs}>${title ? `<h3 class="sectiontitle">${esc(title)}</h3>` : ''}${body}</div>`;
}
export function tag(s) {
  return `<span class="tag ${esc(String(s).toLowerCase().replace(/\s+/g, '-'))}">${esc(s)}</span>`;
}
export function btn(label, fn, cl = '') {
  return `<button type="button" class="btn ${cl}" onclick="${fn}">${label}</button>`;
}
export function call(fn, ...a) {
  return esc(fn + '(' + a.map(x => JSON.stringify(x)).join(',') + ')');
}
export function calm(icon, title, text = '', action = '') {
  return `<div class="calm"><span class="big">${icon}</span><b>${esc(title)}</b>${text ? `<div>${esc(text)}</div>` : ''}${action ? `<div style="margin-top:14px">${action}</div>` : ''}</div>`;
}
export function taskRow(icon, tone, title, sub, onclick) {
  return `<button class="taskrow" onclick="${onclick}"><span class="taskicon t-${tone}">${icon}</span><span><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span><span class="go">›</span></button>`;
}
export function itemRow({ icon = '', title, meta = '', right = '', onclick = '' }) {
  return `<div class="item ${onclick ? 'click' : ''}" ${onclick ? `onclick="${onclick}" tabindex="0" role="button" onkeydown="if(event.key==='Enter')this.click()"` : ''}>${icon}<div class="grow"><div class="title">${title}</div>${meta ? `<div class="meta">${meta}</div>` : ''}</div>${right ? `<div class="actions" onclick="event.stopPropagation()">${right}</div>` : ''}</div>`;
}
export function stepper(steps) {
  return `<div class="stepper">${steps.map((s, i) => (i ? `<div class="stepline ${s.state === 'done' || s.state === 'cur' || s.state === 'bad' ? 'done' : ''}"></div>` : '') + `<div class="step ${s.state}"><div class="journey-node ${s.state === 'done' ? 'done' : ''}">${s.state === 'done' ? '✓' : s.state === 'bad' ? '✕' : s.icon}</div>${esc(s.label)}</div>`).join('')}</div>`;
}
export function table(headers, rows, empty = 'Nothing here yet') {
  return `<div class="tablewrap"><table class="table"><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}" class="empty">${esc(empty)}</td></tr>`}</tbody></table></div>`;
}
