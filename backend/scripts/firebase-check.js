import { firebaseDatabase } from '../src/firebase-store.js';

try {
  const db = firebaseDatabase();
  const [products, orders, delivery] = await Promise.all([
    db.collection('products').get(),
    db.collection('orders').get(),
    db.doc('settings/delivery').get(),
  ]);
  console.log(`Firestore conectado: ${products.size} productos, ${orders.size} pedidos, configuración de entrega ${delivery.exists ? 'presente' : 'pendiente'}.`);
} catch (error) {
  console.error(`No se pudo conectar con Firestore: ${error.message}`);
  process.exitCode = 1;
}
