import { computed, Injectable, signal } from '@angular/core';
import { CartItem, Product } from './models';

const KEY = 'belilo_cart';

function readCart(): CartItem[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((item): item is CartItem =>
      item?.product?.id !== undefined && item?.product?.id !== null && Number.isInteger(item.quantity) && item.quantity > 0)
      .map(item => ({ ...item, product: { ...item.product, stock: Number.isInteger(item.product.stock) ? item.product.stock : 99 } })) : [];
  } catch { return []; }
}

@Injectable({ providedIn: 'root' })
export class CartService {
  readonly items = signal<CartItem[]>(readCart());
  readonly count = computed(() => this.items().reduce((sum, item) => sum + item.quantity, 0));
  readonly total = computed(() => this.items().reduce((sum, item) => sum + item.product.price * item.quantity, 0));

  add(product: Product): void {
    if (product.stock <= 0) return;
    const existing = this.items().find(item => item.product.id === product.id);
    if (existing && existing.quantity >= product.stock) return;
    this.save(existing
      ? this.items().map(item => item.product.id === product.id ? { product, quantity: item.quantity + 1 } : item)
      : [...this.items(), { product, quantity: 1 }]);
  }

  setQuantity(id: Product['id'], quantity: number): void {
    if (!Number.isInteger(quantity)) return;
    this.save(this.items().map(item => item.product.id === id ? { ...item, quantity: Math.min(quantity, item.product.stock) } : item).filter(item => item.quantity > 0));
  }

  remove(id: Product['id']): void { this.save(this.items().filter(item => item.product.id !== id)); }
  clear(): void { this.save([]); }

  syncProducts(products: Product[]): void {
    const byId = new Map(products.map(product => [String(product.id), product]));
    this.save(this.items().flatMap(item => {
      const product = byId.get(String(item.product.id));
      return product && product.stock > 0 ? [{ product, quantity: Math.min(item.quantity, product.stock) }] : [];
    }));
  }

  private save(items: CartItem[]): void {
    this.items.set(items);
    localStorage.setItem(KEY, JSON.stringify(items));
  }
}
