import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APP_NAME = 'belilo-server';
const SETTINGS_PATH = 'settings/delivery';
const DEFAULT_PROJECT_ID = 'belilo';

function publicProduct(snapshot) {
  const { pendingOrders: _pendingOrders, ...data } = snapshot.data();
  return { ...data, id: data.id ?? snapshot.id };
}

function publicOrder(snapshot) {
  const data = snapshot.data();
  return { ...data, id: data.id ?? snapshot.id };
}

function documentId(id) {
  if ((typeof id !== 'string' && typeof id !== 'number') ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(String(id))) return null;
  return String(id);
}

export function firebaseApp(projectId = process.env.BELILO_FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID) {
  let app = getApps().find(candidate => candidate.name === APP_NAME);
  if (app && app.options.projectId !== projectId) {
    throw new Error(`Firebase ya está inicializado para ${app.options.projectId}.`);
  }
  if (!app) {
    let credential;
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      if (process.env.BELILO_FIREBASE_SERVICE_ACCOUNT_JSON) {
        let account;
        try { account = JSON.parse(process.env.BELILO_FIREBASE_SERVICE_ACCOUNT_JSON); }
        catch { throw new Error('BELILO_FIREBASE_SERVICE_ACCOUNT_JSON no contiene JSON válido.'); }
        if (account.project_id !== projectId) throw new Error('La cuenta de servicio no pertenece al proyecto Firebase configurado.');
        credential = cert(account);
      } else {
        credential = applicationDefault();
      }
    }
    app = initializeApp({
      projectId,
      ...(credential ? { credential } : {}),
    }, APP_NAME);
  }
  return app;
}

export function firebaseDatabase(projectId) {
  return getFirestore(firebaseApp(projectId));
}

export function createFirebaseCommerceStore(db) {
  const products = db.collection('products');
  const orders = db.collection('orders');
  const settingsRef = db.doc(SETTINGS_PATH);

  return {
    async listProducts() {
      const snapshot = await products.get();
      return snapshot.docs.map(publicProduct);
    },
    async addProduct(input) {
      const ref = products.doc();
      await ref.set({ ...input, pendingOrders: 0 });
      return { id: ref.id, ...input };
    },
    async replaceProduct(id, input) {
      const ref = products.doc(String(id));
      return db.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) return null;
        transaction.set(ref, {
          ...input,
          ...(snapshot.data().id !== undefined ? { id: snapshot.data().id } : {}),
          pendingOrders: snapshot.data().pendingOrders ?? 0,
        });
        return { id: snapshot.data().id ?? snapshot.id, ...input };
      });
    },
    async removeProduct(id) {
      const ref = products.doc(String(id));
      return db.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) return 'not_found';
        if ((snapshot.data().pendingOrders ?? 0) > 0) return 'pending';
        transaction.delete(ref);
        return 'deleted';
      });
    },
    async getDeliverySettings() {
      const snapshot = await settingsRef.get();
      if (!snapshot.exists) throw new Error('Firestore está vacío. Ejecuta npm run firebase:import antes de iniciar.');
      return snapshot.data();
    },
    async setDeliverySettings(settings) {
      await settingsRef.set(settings);
      return settings;
    },
    async listOrders() {
      const snapshot = await orders.get();
      return snapshot.docs.map(publicOrder);
    },
    async addOrder(body, parseOrder) {
      if (!Array.isArray(body?.items) || body.items.length < 1 || body.items.length > 100) return null;
      const ids = [...new Set(body.items.map(item => documentId(item?.productId)))];
      if (ids.includes(null)) return null;
      const productRefs = ids.map(id => products.doc(id));
      const orderRef = orders.doc();
      return db.runTransaction(async transaction => {
        const settingsSnapshot = await transaction.get(settingsRef);
        if (!settingsSnapshot.exists) throw new Error('Firestore está vacío. Ejecuta npm run firebase:import.');
        const snapshots = await Promise.all(productRefs.map(ref => transaction.get(ref)));
        const state = {
          deliverySettings: settingsSnapshot.data(),
          products: snapshots.filter(snapshot => snapshot.exists).map(publicProduct),
        };
        const input = parseOrder(body, state);
        if (!input) return null;
        for (const snapshot of snapshots) {
          if (snapshot.exists) {
            transaction.update(snapshot.ref, { pendingOrders: (snapshot.data().pendingOrders ?? 0) + 1 });
          }
        }
        const order = { id: orderRef.id, ...input, status: 'pendiente', createdAt: new Date().toISOString() };
        transaction.set(orderRef, order);
        return order;
      });
    },
    async setOrderStatus(id, status) {
      const orderRef = orders.doc(String(id));
      return db.runTransaction(async transaction => {
        const orderSnapshot = await transaction.get(orderRef);
        if (!orderSnapshot.exists) return { kind: 'not_found' };
        const order = publicOrder(orderSnapshot);
        if (order.status === status) return { kind: 'ok', order };
        if (order.status !== 'pendiente') return { kind: 'closed' };
        const refs = order.items.map(item => products.doc(String(item.productId)));
        const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
        if (status === 'entregado' && snapshots.some((snapshot, index) =>
          !snapshot.exists || snapshot.data().stock < order.items[index].quantity)) {
          return { kind: 'stock' };
        }
        for (let index = 0; index < snapshots.length; index++) {
          const snapshot = snapshots[index];
          if (!snapshot.exists) continue;
          transaction.update(snapshot.ref, {
            pendingOrders: Math.max(0, (snapshot.data().pendingOrders ?? 0) - 1),
            ...(status === 'entregado' ? { stock: snapshot.data().stock - order.items[index].quantity } : {}),
          });
        }
        order.status = status;
        order.resolvedAt = new Date().toISOString();
        transaction.set(orderRef, order);
        return { kind: 'ok', order };
      });
    },
  };
}

export async function importLocalSnapshot(db, snapshot) {
  const [productExisting, orderExisting, settingsExisting] = await Promise.all([
    db.collection('products').limit(1).get(),
    db.collection('orders').limit(1).get(),
    db.doc(SETTINGS_PATH).get(),
  ]);
  if (!productExisting.empty || !orderExisting.empty || settingsExisting.exists) {
    throw new Error('Firestore ya contiene datos de BELILO. La importación inicial se canceló para no sobrescribirlos.');
  }
  if (!Array.isArray(snapshot.products) || !Array.isArray(snapshot.orders) ||
      !snapshot.deliverySettings || snapshot.products.length + snapshot.orders.length + 1 > 500) {
    throw new Error('El archivo local no tiene el formato esperado o excede una importación de 500 documentos.');
  }
  const pendingByProduct = new Map();
  for (const order of snapshot.orders) {
    if (order.status !== 'pendiente') continue;
    for (const item of order.items) {
      const key = String(item.productId);
      pendingByProduct.set(key, (pendingByProduct.get(key) ?? 0) + 1);
    }
  }
  const batch = db.batch();
  for (const product of snapshot.products) {
    const id = documentId(product.id);
    if (!id) throw new Error('Hay un ID de producto inválido en el archivo local.');
    batch.set(db.collection('products').doc(id), { ...product, pendingOrders: pendingByProduct.get(id) ?? 0 });
  }
  for (const order of snapshot.orders) {
    const id = documentId(order.id);
    if (!id) throw new Error('Hay un ID de pedido inválido en el archivo local.');
    batch.set(db.collection('orders').doc(id), order);
  }
  batch.set(db.doc(SETTINGS_PATH), snapshot.deliverySettings);
  await batch.commit();
  return { products: snapshot.products.length, orders: snapshot.orders.length };
}
