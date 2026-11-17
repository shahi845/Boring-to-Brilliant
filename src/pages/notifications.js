import { PAGES } from '../app/registry.js';
import { isUnread, markRead, me, myNotifs } from '../lib/permissions.js';
import { esc, rel } from '../lib/utils.js';
import { S } from '../state.js';
import { btn, calm, card, heading, itemRow, tabs, tag } from '../ui/components.js';
import { F, commit, formHTML } from '../ui/forms.js';
/* ==========================================================================
   NOTIFICATIONS & PROFILE
   ========================================================================== */
PAGES.Notifications = () => {
  const all = myNotifs(),
    list = S.section === 'Unread' ? all.filter(isUnread) : all;
  return (
    heading(
      'Notifications',
      'Tap any update to open the exact item it refers to.',
      all.some(isUnread) ? btn('Mark all as read', 'markAllRead()', 'sm') : '',
    ) +
    tabs() +
    card(
      '',
      list.length
        ? list
            .map(n =>
              itemRow({
                icon: `<span class="taskicon t-${isUnread(n) ? 'green' : 'blue'}" style="width:38px;height:38px;font-size:18px">${n.icon}</span>`,
                title:
                  (isUnread(n) ? '<span style="color:var(--primary)">●</span> ' : '') +
                  `<span style="${isUnread(n) ? '' : 'font-weight:650'}">${esc(n.text)}</span>`,
                meta: esc(rel(n.at)) + (n.handled ? ' · Handled' : ''),
                right: n.handled ? tag('Handled') : n.action ? tag('Action') : '',
                onclick: 'openNotif(' + n.id + ')',
              }),
            )
            .join('')
        : calm(
            '🔔',
            S.section === 'Unread' ? 'No unread notifications' : 'No notifications yet',
            'You’re all caught up.',
          ),
    )
  );
};
export function markAllRead() {
  myNotifs().forEach(markRead);
  commit('All caught up', false);
}
PAGES.Profile = () => {
  const m = me();
  const rows =
    S.role === 'Student'
      ? [
          ['Name', m.name],
          ['Class', m.class],
          ['Roll no.', m.roll],
          ['Email', m.email],
          ['Guardian', m.guardian],
        ]
      : S.role === 'Staff' || S.role === 'Academic Assistant'
        ? [
            ['Name', m.name],
            ['Department', m.department],
            ['Positions', (m.positions || []).join(', ') || '—'],
            ['Classes', (m.classes || []).join(', ') || '—'],
          ]
        : [['Account', S.profile?.display_name || S.role]];
  return (
    heading('Profile & settings', 'Your details, password and display preferences.') +
    `<div class="row2">${card('Your details', `<dl class="kv"><dt>Campus ID</dt><dd>${esc(S.profile?.login_id || '')}</dd>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}<dt>Institution</dt><dd>${esc(S.db.settings.institution)}</dd><dt>Academic year</dt><dd>${esc(S.db.settings.academicYear)}</dd></dl>`)}
  <div class="stack">${card('Change password', formHTML('mypw', [F('pw', 'New password', 'password', { full: true, hint: 'At least 8 characters.' }), F('pw2', 'Confirm new password', 'password', { full: true })], 'Update password'))}
  ${card('Display & account', `<div class="actions">${btn('◐ Light / dark', 'toggleTheme()')}${btn('Sign out', 'signOut()', 'danger')}</div>`)}</div></div>`
  );
};
