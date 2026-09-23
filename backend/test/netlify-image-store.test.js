import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withLambda } from '@netlify/aws-lambda-compat';
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

test('la función moderna de Netlify acepta una foto y la devuelve por /api/images', async () => {
  const entries = new Map();
  const images = createNetlifyImageStore({
    async set(name, value) { entries.set(name, value); },
    async get(name) { return entries.has(name) ? entries.get(name).arrayBuffer() : null; },
  });
  const invoke = withLambda(serverless(createApp({ adminToken: 'secret', commerceStore: {}, imageStore: images, frontendDir: null, imageMaxMb: 4 }),
    { binary: ['image/jpeg', 'image/png', 'image/webp'] }));
  const context = { requestId: 'test' };
  const health = await invoke(new Request('https://belilo.test/api/health'), context);
  assert.equal(health.status, 200);
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  const uploaded = await invoke(new Request('https://belilo.test/api/images', {
    method: 'POST',
    headers: { authorization: 'Bearer secret', 'content-type': 'image/jpeg' },
    body: bytes,
  }), context);
  assert.equal(uploaded.status, 201);
  const { url } = await uploaded.json();
  const downloaded = await invoke(new Request(`https://belilo.test${url}`), context);
  assert.equal(downloaded.status, 200);
  assert.equal(downloaded.headers.get('content-type'), 'image/jpeg');
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), bytes);
});
