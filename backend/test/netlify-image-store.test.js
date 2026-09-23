import assert from 'node:assert/strict';
import { test } from 'node:test';
import serverless from 'serverless-http';
import { createApp } from '../src/app.js';
import { createNetlifyImageStore } from '../src/image-store.js';

test('Netlify Blobs conserva una foto y la sirve con la misma ruta pública', async () => {
  const entries = new Map();
  const store = {
    async set(name, value) { entries.set(name, value); },
    async get(name, options) {
      assert.equal(options.type, 'arrayBuffer');
      return entries.has(name) ? entries.get(name).arrayBuffer() : null;
    },
  };
  const images = createNetlifyImageStore(store);
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  const url = await images.save(bytes, 'image/jpeg');
  const name = url.split('/').at(-1);
  assert.match(url, /^\/api\/images\/[a-f\d-]{36}\.jpg$/);
  assert.equal(entries.get(name).type, 'image/jpeg');
  assert.equal(await images.get('../private.jpg'), null);
  const image = await images.get(name);
  assert.equal(image.type, 'image/jpeg');
  const chunks = [];
  for await (const chunk of image.stream()) chunks.push(chunk);
  assert.deepEqual(Buffer.concat(chunks), bytes);
});

test('la función serverless acepta una foto y la devuelve por /api/images', async () => {
  const entries = new Map();
  const images = createNetlifyImageStore({
    async set(name, value) { entries.set(name, value); },
    async get(name) { return entries.has(name) ? entries.get(name).arrayBuffer() : null; },
  });
  const invoke = serverless(createApp({ adminToken: 'secret', commerceStore: {}, imageStore: images, imageMaxMb: 4 }),
    { binary: ['image/jpeg', 'image/png', 'image/webp'] });
  const health = await invoke({ httpMethod: 'GET', path: '/api/health', headers: {} }, {});
  assert.equal(health.statusCode, 200);
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  const uploaded = await invoke({
    httpMethod: 'POST', path: '/api/images',
    headers: { authorization: 'Bearer secret', 'content-type': 'image/jpeg' },
    body: bytes.toString('base64'), isBase64Encoded: true,
  }, {});
  assert.equal(uploaded.statusCode, 201);
  const { url } = JSON.parse(uploaded.body);
  const downloaded = await invoke({ httpMethod: 'GET', path: url, headers: {} }, {});
  assert.equal(downloaded.statusCode, 200);
  assert.equal(downloaded.headers['content-type'], 'image/jpeg');
  assert.deepEqual(Buffer.from(downloaded.body, downloaded.isBase64Encoded ? 'base64' : 'binary'), bytes);
});
