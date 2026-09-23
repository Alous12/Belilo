import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';

const directory = mkdtempSync(join(tmpdir(), 'belilo-api-'));
const dataFile = join(directory, 'store.json');
const token = 'test-admin-token';
let server;
let base;

before(async () => {
  server = createApp({ dataFile, adminToken: token, frontendDir: directory }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  await new Promise(resolve => server.close(resolve));
  rmSync(directory, { recursive: true, force: true });
});

async function request(path, { method = 'GET', body, admin = false } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(admin ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: response.status === 204 ? null : await response.json() };
}

test('catálogo, entregas y pedidos cumplen el contrato del frontend', async () => {
  const catalog = await request('/products');
  assert.equal(catalog.status, 200);
  assert.ok(Array.isArray(catalog.body));
  assert.ok(catalog.body.length > 0);
  assert.equal(typeof catalog.body[0].price, 'number');

  const settings = await request('/delivery-settings');
  assert.equal(settings.status, 200);
  assert.ok(settings.body.zones[0].id);
  assert.ok(settings.body.times.length > 0);

  const product = catalog.body[0];
  const order = await request('/orders', {
    method: 'POST',
    body: {
      clientName: 'Cliente Prueba', clientPhone: '70000000',
      deliveryLocation: settings.body.zones[0].name, deliveryTime: settings.body.times[0],
      items: [{ productId: product.id, quantity: 2 }],
      total: 0,
    },
  });
  assert.equal(order.status, 201);
  assert.equal(order.body.total, product.price * 2);
  assert.equal(order.body.status, 'pendiente');
  assert.equal(order.body.items[0].productId, product.id);
  assert.ok(order.body.createdAt);

  assert.equal((await request('/orders')).status, 401);
  const orders = await request('/orders', { admin: true });
  assert.equal(orders.status, 200);
  assert.equal(orders.body[0].id, order.body.id);
});

test('operaciones administrativas validan token, datos y persistencia', async () => {
  const input = {
    name: 'Pieza de prueba', category: 'Manillas', price: 17.5, stock: 4,
    image: 'https://example.com/pieza.jpg', description: 'Edición limitada',
  };
  assert.equal((await request('/products', { method: 'POST', body: input })).status, 401);
  assert.equal((await request('/admin/session', { admin: true })).body.authenticated, true);
  assert.equal((await request('/products', { method: 'POST', body: { ...input, price: -1 }, admin: true })).status, 400);

  const created = await request('/products', { method: 'POST', body: input, admin: true });
  assert.equal(created.status, 201);
  assert.equal(created.body.name, input.name);
  const updated = await request(`/products/${created.body.id}`, {
    method: 'PUT', body: { ...input, price: 19.25 }, admin: true,
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.price, 19.25);

  const settings = (await request('/delivery-settings')).body;
  const changed = await request('/delivery-settings', {
    method: 'PUT', body: { ...settings, times: ['Mediodía'] }, admin: true,
  });
  assert.equal(changed.status, 200);
  assert.deepEqual(changed.body.times, ['Mediodía']);

  const secondApp = createApp({ dataFile, adminToken: token, frontendDir: directory });
  const secondServer = secondApp.listen(0, '127.0.0.1');
  await new Promise(resolve => secondServer.once('listening', resolve));
  const persisted = await fetch(`http://127.0.0.1:${secondServer.address().port}/api/products`).then(response => response.json());
  assert.equal(persisted.find(item => item.id === created.body.id).price, 19.25);
  await new Promise(resolve => secondServer.close(resolve));

  const removed = await request(`/products/${created.body.id}`, { method: 'DELETE', admin: true });
  assert.equal(removed.status, 204);
  assert.equal((await request(`/products/${created.body.id}`, { method: 'DELETE', admin: true })).status, 404);
});

test('pedidos rechazan productos inexistentes y opciones de entrega inválidas', async () => {
  const settings = (await request('/delivery-settings')).body;
  const invalidProduct = await request('/orders', {
    method: 'POST',
    body: {
      clientName: 'Cliente Prueba', clientPhone: '70000000',
      deliveryLocation: settings.zones[0].name, deliveryTime: settings.times[0],
      items: [{ productId: 999999, quantity: 1 }],
    },
  });
  assert.equal(invalidProduct.status, 400);
  assert.equal(invalidProduct.body.error.code, 'INVALID_ORDER');
});

test('entregar descuenta stock una sola vez; no entregar conserva existencias', async () => {
  const product = (await request('/products')).body[0];
  const settings = (await request('/delivery-settings')).body;
  const purchase = async () => request('/orders', {
    method: 'POST',
    body: {
      clientName: 'Cliente Prueba', clientPhone: '70000000',
      deliveryLocation: settings.zones[0].name, deliveryTime: settings.times[0],
      items: [{ productId: product.id, quantity: 2 }],
    },
  });

  const undelivered = await purchase();
  assert.equal(undelivered.status, 201);
  assert.equal(undelivered.body.items[0].name, product.name);
  const rejected = await request(`/orders/${undelivered.body.id}/status`, {
    method: 'PATCH', body: { status: 'no_entregado' }, admin: true,
  });
  assert.equal(rejected.status, 200);
  assert.equal((await request('/products')).body[0].stock, product.stock);
  assert.equal((await request(`/orders/${undelivered.body.id}/status`, {
    method: 'PATCH', body: { status: 'entregado' }, admin: true,
  })).status, 409);

  const delivered = await purchase();
  const path = `/orders/${delivered.body.id}/status`;
  assert.equal((await request(path, { method: 'PATCH', body: { status: 'entregado' }, admin: true })).status, 200);
  assert.equal((await request('/products')).body[0].stock, product.stock - 2);
  assert.equal((await request(path, { method: 'PATCH', body: { status: 'entregado' }, admin: true })).status, 200);
  assert.equal((await request('/products')).body[0].stock, product.stock - 2);
});

test('rechaza una entrega cuando el stock ya se agotó', async () => {
  const created = await request('/products', {
    method: 'POST', admin: true,
    body: { name: 'Pieza limitada', category: 'Pruebas', price: 10, stock: 1, image: '', description: '' },
  });
  const settings = (await request('/delivery-settings')).body;
  const purchase = () => request('/orders', {
    method: 'POST', body: {
      clientName: 'Cliente Prueba', clientPhone: '70000000',
      deliveryLocation: settings.zones[0].name, deliveryTime: settings.times[0],
      items: [{ productId: created.body.id, quantity: 1 }],
    },
  });
  const first = await purchase();
  const second = await purchase();
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal((await request(`/orders/${first.body.id}/status`, {
    method: 'PATCH', body: { status: 'entregado' }, admin: true,
  })).status, 200);
  const refused = await request(`/orders/${second.body.id}/status`, {
    method: 'PATCH', body: { status: 'entregado' }, admin: true,
  });
  assert.equal(refused.status, 409);
  assert.equal(refused.body.error.code, 'INSUFFICIENT_STOCK');
  assert.equal((await request('/products')).body.find(item => item.id === created.body.id).stock, 0);
  assert.equal((await request('/orders', { admin: true })).body.find(item => item.id === second.body.id).status, 'pendiente');
});

test('sube varias imágenes de producto y valida envíos a otros departamentos', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=', 'base64');
  const upload = (buffer, admin = true) => fetch(`${base}/images`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png', ...(admin ? { Authorization: `Bearer ${token}` } : {}) },
    body: buffer,
  });
  assert.equal((await upload(png, false)).status, 401);
  assert.equal((await upload(Buffer.from('not an image'))).status, 400);
  const first = await upload(png);
  const second = await upload(png);
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  const firstUrl = (await first.json()).url;
  const secondUrl = (await second.json()).url;
  assert.notEqual(firstUrl, secondUrl);
  const served = await fetch(`http://127.0.0.1:${server.address().port}${firstUrl}`);
  assert.equal(served.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await served.arrayBuffer()), png);

  const product = await request('/products', { method: 'POST', admin: true, body: {
    name: 'Pieza con fotos', category: 'Otra categoría', price: 28, stock: 3,
    image: firstUrl, images: [firstUrl, secondUrl], description: 'Prueba de galería',
  } });
  assert.equal(product.status, 201);
  assert.deepEqual(product.body.images, [firstUrl, secondUrl]);
  assert.equal(product.body.image, firstUrl);
  const settings = (await request('/delivery-settings')).body;
  assert.equal(settings.departments.length, 9);

  const shipping = await request('/orders', { method: 'POST', body: {
    clientName: 'Cliente de prueba', clientPhone: '70000000',
    deliveryType: 'otra_ciudad', deliveryLocation: 'Cochabamba', deliveryDepartment: 'Cochabamba',
    deliveryAddress: 'Cochabamba, Av. América 123', deliveryTime: 'A coordinar con asesor',
    items: [{ productId: product.body.id, quantity: 1 }],
  } });
  assert.equal(shipping.status, 201);
  assert.equal(shipping.body.deliveryDepartment, 'Cochabamba');
  assert.equal(shipping.body.deliveryAddress, 'Cochabamba, Av. América 123');
  assert.equal((await request('/orders', { method: 'POST', body: {
    clientName: 'Cliente de prueba', clientPhone: '70000000',
    deliveryType: 'otra_ciudad', deliveryLocation: 'Departamento inventado',
    deliveryDepartment: 'Departamento inventado', deliveryAddress: 'Una dirección',
    deliveryTime: 'A coordinar con asesor', items: [{ productId: product.body.id, quantity: 1 }],
  } })).status, 400);
});
