import { inject, Injectable, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { CommerceRepository } from './commerce.repository';
import { Product } from './models';
import { CartService } from './cart.service';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly api = inject(CommerceRepository);
  private readonly cart = inject(CartService);
  readonly products = signal<Product[]>([]);
  readonly loading = signal(false);
  readonly refreshing = signal(false);
  readonly loaded = signal(false);
  readonly error = signal('');

  load(force = false): void {
    if (this.loading() || this.refreshing() || (this.loaded() && !force)) return;
    const initialLoad = !this.loaded();
    if (initialLoad) {
      this.loading.set(true);
      this.error.set('');
    } else {
      this.refreshing.set(true);
    }
    this.api.products().pipe(finalize(() => {
      this.loading.set(false);
      this.refreshing.set(false);
    })).subscribe({
      next: products => {
        if (initialLoad || JSON.stringify(products) !== JSON.stringify(this.products())) {
          this.products.set(products);
          this.cart.syncProducts(products);
        }
        this.loaded.set(true);
        this.error.set('');
      },
      error: () => {
        if (initialLoad) this.error.set('No se pudo cargar el catálogo. Comprueba la conexión con el servidor.');
      },
    });
  }

  upsert(product: Product): void {
    this.products.update(items => {
      const index = items.findIndex(item => item.id === product.id);
      return index < 0 ? [product, ...items] : items.map(item => item.id === product.id ? product : item);
    });
    this.cart.syncProducts(this.products());
  }

  remove(id: Product['id']): void {
    this.products.update(items => items.filter(item => item.id !== id));
    this.cart.syncProducts(this.products());
  }
}
