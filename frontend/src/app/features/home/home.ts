import { CurrencyPipe } from '@angular/common';
import { Component, computed, HostListener, inject, OnInit, signal } from '@angular/core';
import { CartService } from '../../core/cart.service';
import { CartDrawerService } from '../../core/cart-drawer.service';
import { CatalogService } from '../../core/catalog.service';
import { primaryImage, Product } from '../../core/models';
import { Collection } from '../../shared/collection';
import { ProductGallery } from '../../shared/product-gallery';

@Component({
  selector: 'app-home',
  imports: [Collection, CurrencyPipe, ProductGallery],
  templateUrl: './home.html',
})
export class Home implements OnInit {
  readonly catalog = inject(CatalogService);
  readonly cart = inject(CartService);
  readonly drawer = inject(CartDrawerService);
  readonly primaryImage = primaryImage;
  readonly query = signal('');
  readonly category = signal('Todas');
  readonly notice = signal('');
  readonly selectedProduct = signal<Product | null>(null);
  readonly categories = computed(() => ['Todas', ...new Set(this.catalog.products().map(p => p.category))]);
  readonly visibleProducts = computed(() => {
    const search = this.query().trim().toLocaleLowerCase();
    return this.catalog.products().filter(product =>
      (this.category() === 'Todas' || product.category === this.category()) &&
      (!search || `${product.name} ${product.description} ${product.category}`.toLocaleLowerCase().includes(search)));
  });

  ngOnInit(): void { this.catalog.load(); }
  search(event: Event): void { this.query.set((event.target as HTMLInputElement).value); }
  add(product: Product): void {
    if (product.stock <= 0) return;
    this.cart.add(product);
    this.notice.set(`${product.name} se añadió al carrito.`);
  }

  buyNow(product: Product): void {
    if (product.stock <= 0) return;
    this.cart.add(product);
    this.selectedProduct.set(null);
    this.drawer.open();
  }

  scrollToCatalog(): void {
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  @HostListener('document:keydown.escape')
  closeDetails(): void { this.selectedProduct.set(null); }
}
