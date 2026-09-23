import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { getStorage } from 'firebase-admin/storage';

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const FILE_NAME = /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}\.(jpg|png|webp)$/i;

export function imageType(buffer, declaredType) {
  if (!Buffer.isBuffer(buffer) || !TYPES[declaredType]) return null;
  if (declaredType === 'image/jpeg' && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
  if (declaredType === 'image/png' && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (declaredType === 'image/webp' && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export function createLocalImageStore(directory) {
  return {
    async save(buffer, type) {
      mkdirSync(directory, { recursive: true });
      const name = `${randomUUID()}.${TYPES[type]}`;
      writeFileSync(join(directory, name), buffer, { flag: 'wx' });
      return `/api/images/${name}`;
    },
    async get(name) {
      if (!FILE_NAME.test(name) || !existsSync(join(directory, name))) return null;
      return { type: name.endsWith('.jpg') ? 'image/jpeg' : name.endsWith('.png') ? 'image/png' : 'image/webp', stream: () => createReadStream(join(directory, name)) };
    },
  };
}

export function createFirebaseImageStore(app, bucketName) {
  const bucket = getStorage(app).bucket(bucketName);
  return {
    async check() {
      const [exists] = await bucket.exists();
      if (!exists) throw new Error(`No existe el bucket ${bucketName}. Activa Cloud Storage o usa BELILO_IMAGE_STORE=local.`);
    },
    async save(buffer, type) {
      const name = `${randomUUID()}.${TYPES[type]}`;
      await bucket.file(`products/${name}`).save(buffer, { resumable: false, metadata: { contentType: type, cacheControl: 'public, max-age=86400' } });
      return `/api/images/${name}`;
    },
    async get(name) {
      if (!FILE_NAME.test(name)) return null;
      const file = bucket.file(`products/${name}`);
      const [exists] = await file.exists();
      if (!exists) return null;
      return { type: name.endsWith('.jpg') ? 'image/jpeg' : name.endsWith('.png') ? 'image/png' : 'image/webp', stream: () => file.createReadStream() };
    },
  };
}

// Netlify site-wide Blobs survive deploys; the browser still uses /api/images.
export function createNetlifyImageStore(store) {
  return {
    async save(buffer, type) {
      const name = `${randomUUID()}.${TYPES[type]}`;
      await store.set(name, new Blob([new Uint8Array(buffer)], { type }));
      return `/api/images/${name}`;
    },
    async get(name) {
      if (!FILE_NAME.test(name)) return null;
      const data = await store.get(name, { type: 'arrayBuffer' });
      if (data === null) return null;
      const type = name.endsWith('.jpg') ? 'image/jpeg' : name.endsWith('.png') ? 'image/png' : 'image/webp';
      return { type, stream: () => Readable.from([Buffer.from(data)]) };
    },
  };
}
