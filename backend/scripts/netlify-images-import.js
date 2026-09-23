import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStore } from '@netlify/blobs';

const directory = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'images');
const siteID = process.env.NETLIFY_SITE_ID;
const token = process.env.NETLIFY_AUTH_TOKEN;
const types = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const filename = /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}\.(jpg|png|webp)$/i;

if (!siteID || !token) {
  console.error('Configura NETLIFY_SITE_ID y NETLIFY_AUTH_TOKEN para importar las imágenes locales.');
  process.exit(1);
}

const names = (await readdir(directory)).filter(name => filename.test(name));
const files = await Promise.all(names.map(async name => ({ name, data: await readFile(join(directory, name)) })));
const oversized = files.find(file => file.data.length > 4 * 1024 * 1024);
if (oversized) {
  console.error(`La imagen ${oversized.name} supera 4 MB; redúcela antes de importarla.`);
  process.exit(1);
}

const store = getStore({ name: 'belilo-images', siteID, token });
for (const { name, data } of files) {
  const type = types[name.split('.').at(-1).toLowerCase()];
  await store.set(name, new Blob([new Uint8Array(data)], { type }));
  console.log(`Importada: ${name}`);
}
console.log(`${files.length} imágenes copiadas a Netlify Blobs. Las rutas /api/images conservan sus nombres.`);
