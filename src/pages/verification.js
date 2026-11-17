import { PAGES } from '../app/registry.js';
import { notify, resolveRef } from '../lib/notifications.js';
import { actorName, isAA } from '../lib/permissions.js';
import { $, avatar, esc, fmtDate, fmtRange, rel, sClass, sName, stamp } from '../lib/utils.js';
import { requestQueue } from './requests.js';
import { att, classStudents, subOf } from './shared.js';
import { S } from '../state.js';
import { btn, call, calm, card, heading, itemRow, tabs, tag } from '../ui/components.js';
import { mhead, modal, toast } from '../ui/feedback.js';
import { commit } from '../ui/forms.js';
/* ==========================================================================
   VERIFICATION (Academic Assistant) & FOLLOW-UPS
   ========================================================================== */
PAGES.Verification = () => {
  const h = heading('Verification', 'Academic checks that keep records accurate.') + tabs();
  if (S.section === 'Attendance Submissions') {
    const un = S.db.attSubs.filter(s => !s.verified).sort((a, b) => a.date.localeCompare(b.date)),
      ve = S.db.attSubs
        .filter(s => s.verified)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 6);
    return (
      h +
      (un.length
        ? card(
            'Waiting for verification',
            un
              .map(s => {
                const st = classStudents(s.class),
                  c = x => st.filter(p => att(p.id, s.date)?.status === x).length;
                return itemRow({
                  icon: '<span class="taskicon t-blue" style="width:40px;height:40px;font-size:19px">📅</span>',
                  title: esc(s.class) + ' · ' + fmtDate(s.date),
                  meta: `by ${esc(s.by)} · ${c('Present')} present, ${c('Absent')} absent, ${c('Late')} late, ${c('On Leave')} leave, ${c('Outside Campus')} outside`,
                  onclick: call('rosterModal', s.class, s.date),
                  right:
                    btn('View', call('rosterModal', s.class, s.date), 'sm') +
                    btn('Verify', call('verifySub', s.class, s.date), 'sm primary'),
                });
              })
              .join(''),
          )
        : calm('✅', 'All submitted attendance is verified')) +
      (ve.length
        ? card(
            'Recently verified',
            ve
              .map(s =>
                itemRow({
                  title: esc(s.class) + ' · ' + fmtDate(s.date),
                  meta: 'Verified by ' + esc(s.verifiedBy),
                  right: tag('Verified'),
                }),
              )
              .join(''),
            'style="margin-top:16px"',
          )
        : '')
    );
  }
  if (S.section === 'Medical Requests') {
    const p = S.db.medical.filter(m => m.status === 'Pending'),
      d = S.db.medical
        .filter(m => m.status !== 'Pending')
        .slice(-6)
        .reverse();
    return (
      h +
      (p.length
        ? card(
            'Waiting for verification',
            p
              .map(m =>
                itemRow({
                  icon: avatar(sName(m.studentId), m.studentId),
                  title: esc(sName(m.studentId)),
                  meta: fmtRange(m.from, m.to) + ' · ' + esc(m.note),
                  onclick: call('medicalDetail', m.id),
                  right: btn('Review', call('medicalDetail', m.id), 'sm primary'),
                }),
              )
              .join(''),
          )
        : calm('✚', 'No medical requests waiting')) +
      (d.length
        ? card(
            'Recently reviewed',
            d
              .map(m =>
                itemRow({
                  title: esc(sName(m.studentId)),
                  meta: fmtRange(m.from, m.to),
                  right: tag(m.status),
                  onclick: call('medicalDetail', m.id),
                }),
              )
              .join(''),
            'style="margin-top:16px"',
          )
        : '')
    );
  }
  if (S.section === 'Corrections')
    return (
      h +
      requestQueue(r => S.db.settings.routing[r.type] === 'Academic Assistant') +
      `<h2 class="play-heading">Completed</h2>` +
      requestQueue(r => S.db.settings.routing[r.type] === 'Academic Assistant', true)
    );
  const o = S.db.followups.filter(f => f.status === 'Open'),
    r = S.db.followups
      .filter(f => f.status !== 'Open')
      .slice(-6)
      .reverse();
  return (
    h +
    (o.length
      ? card(
          'Open follow-ups',
          o
            .map(f =>
              itemRow({
                icon: avatar(sName(f.studentId), f.studentId),
                title:
                  esc(sName(f.studentId)) +
                  ` <span class="muted" style="font-weight:650">· ${esc(sClass(f.studentId))}</span>`,
                meta: esc(f.note) + ' · raised by ' + esc(f.raisedBy),
                onclick: call('followupDetail', f.id),
                right: btn('Resolve', call('followupDetail', f.id), 'sm primary'),
              }),
            )
            .join(''),
        )
      : calm('👀', 'No open follow-ups')) +
    (r.length
      ? card(
          'Recently resolved',
          r
            .map(f =>
              itemRow({
                title: esc(sName(f.studentId)),
                meta: esc(f.resolution || ''),
                right: tag('Resolved'),
                onclick: call('followupDetail', f.id),
              }),
            )
            .join(''),
          'style="margin-top:16px"',
        )
      : '')
  );
};
export function verifySub(cl, d) {
  const s = subOf(cl, d);
  if (!s || !isAA()) return;
  s.verified = true;
  s.verifiedBy = actorName();
  resolveRef('sub:' + d + '|' + cl);
  if (!S.db.attSubs.some(x => x.date === d && !x.verified)) resolveRef('sub:' + d);
  commit(cl + ' attendance for ' + fmtDate(d) + ' verified');
}
export function followupDetail(id) {
  const f = S.db.followups.find(x => x.id === id);
  if (!f) return toast('This follow-up no longer exists', 'err');
  modal(
    mhead('Follow-up · ' + sName(f.studentId), esc(sClass(f.studentId)) + ' · ' + tag(f.status)) +
      `<dl class="kv"><dt>Raised by</dt><dd>${esc(f.raisedBy)} · ${esc(rel(f.createdAt))}</dd><dt>Concern</dt><dd>${esc(f.note)}</dd>${f.resolution ? `<dt>Resolution</dt><dd>${esc(f.resolution)} <span class="muted">— ${esc(f.resolvedBy)}</span></dd>` : ''}</dl>` +
      `<div class="actions">${btn('Open student profile', call('studentDetail', f.studentId), 'sm')}</div>` +
      (isAA() && f.status === 'Open'
        ? `<label style="font-weight:700;display:block;margin-top:16px">What was done?<textarea class="field" id="fnote" style="width:100%;margin-top:6px" placeholder="e.g. Spoke with guardian; student returns Monday"></textarea></label><div class="formactions">${btn('Mark resolved', call('resolveFollowup', id), 'primary')}</div>`
        : ''),
  );
}
export function resolveFollowup(id) {
  const f = S.db.followups.find(x => x.id === id),
    note = ($('fnote')?.value || '').trim();
  if (!f || f.status !== 'Open') return;
  if (!note) {
    $('fnote').classList.add('invalid');
    return toast('Add a short resolution note', 'err');
  }
  Object.assign(f, { status: 'Resolved', resolution: note, resolvedBy: actorName(), resolvedAt: stamp() });
  resolveRef('fu:' + id);
  if (f.raisedById)
    notify('staff:' + f.raisedById, 'Follow-up for ' + sName(f.studentId) + ' resolved: ' + note, {
      icon: '👀',
      link: ['My Students', 'Follow-ups', 'fu:' + id],
    });
  commit('Follow-up resolved');
}
