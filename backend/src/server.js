import { createApp } from './app.js';
import { createFirebaseCommerceStore, firebaseApp, firebaseDatabase } from './firebase-store.js';
import { createFirebaseImageStore } from './image-store.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';
const firebaseMode = process.env.BELILO_STORE === 'firebase';
const adminToken = process.env.BELILO_ADMIN_TOKEN ?? (process.env.NODE_ENV === 'production' ? '' : 'CACAHUATE');

if (!adminToken) {
  console.error('Configura BELILO_ADMIN_TOKEN antes de iniciar en producción.');
  process.exit(1);
}
try {
  const commerceStore = firebaseMode
    ? createFirebaseCommerceStore(firebaseDatabase())
    : undefined;
  if (commerceStore) await commerceStore.getDeliverySettings();
  const imageStore = process.env.BELILO_IMAGE_STORE === 'firebase'
    ? createFirebaseImageStore(firebaseApp(), process.env.BELILO_STORAGE_BUCKET || `${process.env.BELILO_FIREBASE_PROJECT_ID || 'belilo'}.firebasestorage.app`)
    : undefined;
  if (imageStore) await imageStore.check();
  const app = createApp({ adminToken, commerceStore, imageStore });
  app.listen(port, host, () => console.log(
    `BELILO API (${firebaseMode ? 'Firestore' : 'local'}, imágenes ${imageStore ? 'Firebase Storage' : 'locales'}) disponible en http://${host}:${port}/api/health`,
  ));
} catch (error) {
  console.error(`No se pudo iniciar BELILO: ${error.message}`);
  process.exit(1);
}
