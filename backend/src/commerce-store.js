import { createStore } from './store.js';

// This adapter preserves the current JSON store for development and tests.
// The Firebase adapter implements the same operations using Firestore transactions.
export function createLocalCommerceStore(file) {
  const store = createStore(file);

  return {
    async listProducts() { return store.read().products; },
    async addProduct(input) {
      return store.update(state => {
        const product = { id: state.nextProductId++, ...input };
        state.products.push(product);
        return product;
      });
    },
    async replaceProduct(id, input) {
      if (!store.read().products.some(product => String(product.id) === String(id))) return null;
      return store.update(state => {
        const index = state.products.findIndex(product => String(product.id) === String(id));
        state.products[index] = { id: state.products[index].id, ...input };
        return state.products[index];
      });
    },
    async removeProduct(id) {
      const state = store.read();
      if (!state.products.some(product => String(product.id) === String(id))) return 'not_found';
      if (state.orders.some(order => order.status === 'pendiente' &&
          order.items.some(item => String(item.productId) === String(id)))) return 'pending';
      store.update(next => { next.products = next.products.filter(product => String(product.id) !== String(id)); });
      return 'deleted';
    },
    async getDeliverySettings() { return store.read().deliverySettings; },
    async setDeliverySettings(settings) {
      store.update(state => { state.deliverySettings = settings; });
      return settings;
    },
    async listOrders() { return store.read().orders; },
    async addOrder(body, parseOrder) {
      const input = parseOrder(body, store.read());
      if (!input) return null;
      return store.update(state => {
        const order = { id: state.nextOrderId++, ...input, status: 'pendiente', createdAt: new Date().toISOString() };
        state.orders.push(order);
        return order;
      });
    },
    async setOrderStatus(id, status) {
      const state = store.read();
      const existing = state.orders.find(order => String(order.id) === String(id));
      if (!existing) return { kind: 'not_found' };
      if (existing.status === status) return { kind: 'ok', order: existing };
      if (existing.status !== 'pendiente') return { kind: 'closed' };
      if (status === 'entregado' && existing.items.some(item => {
        const product = state.products.find(product => product.id === item.productId);
        return !product || product.stock < item.quantity;
      })) return { kind: 'stock' };

      const order = store.update(next => {
        const updated = next.orders.find(item => String(item.id) === String(id));
        if (status === 'entregado') {
          for (const item of updated.items) {
            next.products.find(product => product.id === item.productId).stock -= item.quantity;
          }
        }
        updated.status = status;
        updated.resolvedAt = new Date().toISOString();
        return updated;
      });
      return { kind: 'ok', order };
    },
  };
}
