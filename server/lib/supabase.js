/**
 * Minimal Supabase REST client for the server (uses the service-role key, bypasses RLS).
 * Only used for actions the browser must never do: creating/removing sign-in accounts.
 */
import { HttpError } from './http.js';

export function createSupabaseAdmin({ supabaseUrl, serviceKey, fetchImpl = fetch }) {
  const base = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  async function call(path, { method = 'GET', body, headers = {} } = {}) {
    const res = await fetchImpl(supabaseUrl + path, {
      method,
      headers: { ...base, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      const msg =
        data?.msg ||
        data?.message ||
        data?.error_description ||
        data?.error ||
        `Supabase error ${res.status}`;
      throw new HttpError(res.status === 422 || res.status === 409 ? 409 : 502, msg);
    }
    return data;
  }

  return {
    /** Resolve an access token to a user (Supabase validates the JWT signature and expiry). */
    async getUserFromToken(token) {
      const res = await fetchImpl(supabaseUrl + '/auth/v1/user', {
        headers: { apikey: serviceKey, Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json();
    },
    async getProfileByUser(userId) {
      const rows = await call(`/rest/v1/profiles?user_id=eq.${encodeURIComponent(userId)}&select=*`);
      return rows?.[0] || null;
    },
    async getProfileByLogin(login) {
      const rows = await call(`/rest/v1/profiles?login_id=eq.${encodeURIComponent(login)}&select=*`);
      return rows?.[0] || null;
    },
    async createUser(email, password, name) {
      return call('/auth/v1/admin/users', {
        method: 'POST',
        body: { email, password, email_confirm: true, user_metadata: { name } },
      });
    },
    async insertProfile(profile) {
      return call('/rest/v1/profiles', {
        method: 'POST',
        body: profile,
        headers: { Prefer: 'return=minimal' },
      });
    },
    async setPassword(userId, password) {
      return call(`/auth/v1/admin/users/${userId}`, { method: 'PUT', body: { password } });
    },
    async deleteUser(userId) {
      return call(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' });
    },
    /** One record's data (or null). */
    async getRecord(collection, key) {
      const rows = await call(
        `/rest/v1/records?collection=eq.${encodeURIComponent(collection)}&key=eq.${encodeURIComponent(key)}&select=data`,
      );
      return rows?.[0]?.data || null;
    },
    async listRecords(collection) {
      const rows = await call(`/rest/v1/records?collection=eq.${encodeURIComponent(collection)}&select=data`);
      return (rows || []).map(r => r.data);
    },
    /** Insert or replace a record ({collection, key, student_id, data}). */
    async upsertRecord(row) {
      return call('/rest/v1/records?on_conflict=collection,key', {
        method: 'POST',
        body: row,
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      });
    },
    /** Insert notifications ({audience:[…], data:{text,icon,link,…}}). */
    async insertNotifications(list) {
      const at = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date());
      return call('/rest/v1/notifications', {
        method: 'POST',
        body: list.map((n, i) => ({
          id: Date.now() * 10 + i,
          audience: n.audience,
          data: { icon: '🔔', link: null, ref: '', action: false, kind: '', at, ...n.data },
          read_by: [],
          handled: false,
        })),
        headers: { Prefer: 'return=minimal' },
      });
    },
    async countRecords(collection, filter = '') {
      const res = await fetchImpl(
        `${supabaseUrl}/rest/v1/records?collection=eq.${encodeURIComponent(collection)}${filter}&select=key`,
        { method: 'HEAD', headers: { ...base, Prefer: 'count=exact' } },
      );
      const range = res.headers.get('content-range') || '';
      return Number(range.split('/')[1] || 0);
    },
  };
}
