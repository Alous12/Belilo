import { createHash } from 'node:crypto';

const ADMIN_WINDOW_MS = 15 * 60 * 1000;
const ORDER_WINDOW_MS = 60 * 60 * 1000;
const ADMIN_ATTEMPTS = 3;
const ORDERS_PER_IP = 6;
const ORDERS_PER_PHONE = 3;

function id(kind, value) {
  return `${kind}_${createHash('sha256').update(String(value)).digest('hex')}`;
}

function activeWindow(data, now, duration) {
  return data && Number.isFinite(data.windowStart) && now - data.windowStart < duration
    ? data : { windowStart: now, count: 0 };
}

function retryAfter(until, now) {
  return Math.max(1, Math.ceil((until - now) / 1000));
}

function adminDecision(data, valid, now) {
  const current = activeWindow(data, now, ADMIN_WINDOW_MS);
  if (current.lockedUntil > now) return { allowed: false, blocked: true, retryAfter: retryAfter(current.lockedUntil, now) };
  if (valid) return { allowed: true, clear: true };
  const count = current.count + 1;
  if (count >= ADMIN_ATTEMPTS) {
    return { allowed: false, blocked: true, retryAfter: retryAfter(now + ADMIN_WINDOW_MS, now), data: { windowStart: now, count, lockedUntil: now + ADMIN_WINDOW_MS } };
  }
  return { allowed: false, blocked: false, remaining: ADMIN_ATTEMPTS - count, data: { windowStart: current.windowStart, count } };
}

function orderDecision(entries, now) {
  const limits = [ORDERS_PER_IP, ORDERS_PER_PHONE];
  const windows = entries.map(data => activeWindow(data, now, ORDER_WINDOW_MS));
  const blocked = windows.findIndex((window, index) => window.count >= limits[index]);
  if (blocked !== -1) {
    return { allowed: false, retryAfter: retryAfter(windows[blocked].windowStart + ORDER_WINDOW_MS, now) };
  }
  return { allowed: true, data: windows.map(window => ({ windowStart: window.windowStart, count: window.count + 1 })) };
}

export function createMemorySecurityStore(now = Date.now) {
  const entries = new Map();
  return {
    async attemptAdmin(client, valid) {
      const key = id('admin', client);
      const result = adminDecision(entries.get(key), valid, now());
      if (result.clear) entries.delete(key);
      else if (result.data) entries.set(key, result.data);
      return result;
    },
    async consumeOrder(client, phone) {
      const keys = [id('order_ip', client), id('order_phone', phone)];
      const result = orderDecision(keys.map(key => entries.get(key)), now());
      if (result.allowed) keys.forEach((key, index) => entries.set(key, result.data[index]));
      return result;
    },
  };
}

export function createFirestoreSecurityStore(db, now = Date.now) {
  const collection = db.collection('security_limits');
  return {
    async attemptAdmin(client, valid) {
      const ref = collection.doc(id('admin', client));
      return db.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        const result = adminDecision(snapshot.exists ? snapshot.data() : null, valid, now());
        if (result.clear && snapshot.exists) transaction.delete(ref);
        else if (result.data) transaction.set(ref, result.data);
        return result;
      });
    },
    async consumeOrder(client, phone) {
      const refs = [collection.doc(id('order_ip', client)), collection.doc(id('order_phone', phone))];
      return db.runTransaction(async transaction => {
        const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
        const result = orderDecision(snapshots.map(snapshot => snapshot.exists ? snapshot.data() : null), now());
        if (result.allowed) refs.forEach((ref, index) => transaction.set(ref, result.data[index]));
        return result;
      });
    },
  };
}
