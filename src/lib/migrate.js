import { REQUEST_TYPES } from './constants.js';
import { S } from '../state.js';
export function migrate() {
  const s = S.db.settings;
  s.routing ||= {};
  REQUEST_TYPES.forEach(t => (s.routing[t] ||= 'Admin office'));
  s.customPositions ||= [];
  S.db.libStatus ||= {};
  S.db.lab ||= { unavailable: [], bookings: [] };
  S.db.staff.forEach(x => {
    x.positions ||= [];
    x.classes ||= [];
  });
  S.db.students.forEach(x => {
    x.login ||= '';
  });
}
