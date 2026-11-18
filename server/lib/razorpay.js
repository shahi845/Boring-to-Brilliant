/**
 * Minimal Razorpay client (no SDK). Uses the key id + secret from the server
 * environment; the secret never reaches the browser.
 * Docs: https://razorpay.com/docs/api/orders/ and payment signature verification.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError } from './http.js';

export function createRazorpay({ keyId, keySecret, fetchImpl = fetch }) {
  const ready = Boolean(keyId && keySecret);
  const auth = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  return {
    ready,
    keyId,
    mode: !ready ? 'off' : keyId.startsWith('rzp_live_') ? 'live' : 'test',
    /** Create an order for `amount` paise. */
    async createOrder({ amount, receipt, notes }) {
      if (!ready) throw new HttpError(503, 'Online payments are not set up yet');
      const res = await fetchImpl('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, currency: 'INR', receipt, notes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new HttpError(502, data?.error?.description || 'Could not start the payment');
      return data;
    },
    /** True when Razorpay's signature for order|payment matches. */
    verify(orderId, paymentId, signature) {
      if (!ready || !orderId || !paymentId || !signature) return false;
      const expected = createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
      const a = Buffer.from(expected),
        b = Buffer.from(String(signature));
      return a.length === b.length && timingSafeEqual(a, b);
    },
  };
}
