import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { firebaseDatabase, importLocalSnapshot } from '../src/firebase-store.js';
import { createStore } from '../src/store.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'data', 'store.json');

try {
  if (!existsSync(file)) throw new Error(`No existe ${file}. Inicia primero el backend local.`);
  const db = firebaseDatabase();
  const snapshot = createStore(file).read();
  const result = await importLocalSnapshot(db, snapshot);
  console.log(`Importación terminada: ${result.products} productos y ${result.orders} pedidos. Entregas y teléfonos también importados.`);
} catch (error) {
  console.error(`No se importaron datos a Firebase: ${error.message}`);
  process.exitCode = 1;
}
