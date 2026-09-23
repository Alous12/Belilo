import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createApp } from '../src/app.js';
import { createFirebaseCommerceStore, importLocalSnapshot } from '../src/firebase-store.js';
import { createSeed } from '../src/seed.js';

// In-memory implementation of the Firestore operations used by this adapter.
// The real service account and project connection are tested when configured.
class MemoryFirestore {
  records = new Map();
  sequence = 0;

  doc(path) {
    const id = path.split('/').at(-1);
    const ref = { path, id };
    ref.get = async () => this.snapshot(ref);
    return ref;
  }

  snapshot(ref) {
    const value = this.records.get(ref.path);
    return { ref, id: ref.id, exists: value !== undefined, data: () => structuredClone(value) };
  }

  collection(path) {
    const get = async (limit = Infinity) => {
      const docs = [...this.records.keys()]
        .filter(key => key.startsWith(`${path}/`) && key.split('/').length === 2)
        .slice(0, limit)
        .map(key => this.snapshot(this.doc(key)));
      return { docs, empty: docs.length === 0 };
    };
    return {
      doc: (id = `auto${++this.sequence}`) => this.doc(`${path}/${id}`),
      get: () => get(),
      limit: count => ({ get: () => get(count) }),
    };
  }

  writer() {
    const writes = [];
    return {
      get: ref => ref.get(),
      set: (ref, value) => writes.push(() => this.records.set(ref.path, structuredClone(value))),
      update: (ref, value) => writes.push(() => this.records.set(ref.path, { ...this.records.get(ref.path), ...structuredClone(value) })),
      delete: ref => writes.push(() => this.records.delete(ref.path)),
      commit: async () => { for (const write of writes) write(); },
    };
  }

  batch() { return this.writer(); }
  async runTransaction(callback) {
    const writer = this.writer();
    const result = await callback(writer);
    await writer.commit();
    return result;
  }
}

test('Firestore importa datos locales y conserva pedidos, protección y stock', async () => {
  const db = new MemoryFirestore();
  const seed = createSeed();
  const imported = await importLocalSnapshot(db, seed);
  assert.deepEqual(imported, { products: seed.products.length, orders: 0 });
  await assert.rejects(importLocalSnapshot(db, seed), /ya contiene datos/);

  const directory = mkdtempSync(join(tmpdir(), 'belilo-firebase-test-'));
  const server = createApp({
    commerceStore: createFirebaseCommerceStore(db),
    adminToken: 'test-firebase-token',
    frontendDir: directory,
  }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const request = async (path, { method = 'GET', body, admin = false } = {}) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(admin ? { Authorization: 'Bearer test-firebase-token' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
  };

  try {
    const catalog = (await request('/products')).body;
    const settings = (await request('/delivery-settings')).body;
    assert.equal(catalog.length, seed.products.length);
    assert.equal((await request('/orders')).status, 401);

    const createOrder = () => request('/orders', { method: 'POST', body: {
      clientName: 'Cliente Firebase', clientPhone: '70000000',
      deliveryLocation: settings.zones[0].name, deliveryTime: settings.times[0],
      items: [{ productId: catalog[0].id, quantity: 2 }],
    } });
    const delivered = await createOrder();
    assert.equal(delivered.status, 201);
    assert.equal(delivered.body.total, catalog[0].price * 2);
    assert.equal((await request(`/products/${catalog[0].id}`, { method: 'DELETE', admin: true })).status, 409);
    const deliver = () => request(`/orders/${delivered.body.id}/status`, {
      method: 'PATCH', body: { status: 'entregado' }, admin: true,
    });
    assert.equal((await deliver()).status, 200);
    assert.equal((await deliver()).status, 200);
    assert.equal((await request('/products')).body[0].stock, catalog[0].stock - 2);

    const notDelivered = await createOrder();
    assert.equal((await request(`/orders/${notDelivered.body.id}/status`, {
      method: 'PATCH', body: { status: 'no_entregado' }, admin: true,
    })).status, 200);
    assert.equal((await request('/products')).body[0].stock, catalog[0].stock - 2);
    assert.equal((await request('/orders', { admin: true })).body.length, 2);
  } finally {
    await new Promise(resolve => server.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  }
});
