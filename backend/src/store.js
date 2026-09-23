import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createSeed } from './seed.js';

export function createStore(file) {
  let state;

  function persist(value) {
    mkdirSync(dirname(file), { recursive: true });
    const temporary = `${file}.tmp`;
    writeFileSync(temporary, JSON.stringify(value, null, 2));
    renameSync(temporary, file);
  }

  if (existsSync(file)) {
    state = JSON.parse(readFileSync(file, 'utf8'));
    // Existing local catalogs predate inventory tracking.
    let migrated = false;
    for (const product of state.products) {
      if (!Number.isInteger(product.stock) || product.stock < 0) {
        product.stock = 10;
        migrated = true;
      }
    }
    if (migrated) persist(state);
  } else {
    state = createSeed();
    persist(state);
  }

  return {
    read: () => state,
    update(mutator) {
      const next = structuredClone(state);
      const result = mutator(next);
      persist(next);
      state = next;
      return result;
    },
  };
}
