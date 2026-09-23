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
  readonly loaded = signal(false);
  readonly error = signal('');

  load(force = false): void {
    if (this.loading() || (this.loaded() && !force)) return;
    this.loading.set(true);
    this.error.set('');
    this.api.products().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: products => { this.products.set(products); this.cart.syncProducts(products); this.loaded.set(true); },
      error: () => this.error.set('No se pudo cargar el catálogo. Comprueba la conexión con el servidor.'),
    });
  }

  upsert(product: Product): void {
    this.products.update(items => {
      const index = items.findIndex(item => item.id === product.id);
      return index < 0 ? [product, ...items] : items.map(item => item.id === product.id ? product : item);
    });
  }

  remove(id: Product['id']): void {
    this.products.update(items => items.filter(item => item.id !== id));
  }
}
