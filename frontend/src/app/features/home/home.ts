import { CurrencyPipe } from '@angular/common';
import { Component, computed, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CartService } from '../../core/cart.service';
import { CartDrawerService } from '../../core/cart-drawer.service';
import { CatalogService } from '../../core/catalog.service';
import { primaryImage, Product } from '../../core/models';
import { Collection } from '../../shared/collection';
import { ArrowIcon } from '../../shared/arrow-icon';
import { ProductGallery } from '../../shared/product-gallery';

@Component({
  selector: 'app-home',
  imports: [ArrowIcon, Collection, CurrencyPipe, ProductGallery],
  templateUrl: './home.html',
})
export class Home implements OnInit, OnDestroy {
  private refreshTimer?: ReturnType<typeof setInterval>;
  readonly catalog = inject(CatalogService);
  readonly cart = inject(CartService);
  readonly drawer = inject(CartDrawerService);
  readonly primaryImage = primaryImage;
  readonly query = signal('');
  readonly category = signal('Todas');
  readonly notice = signal('');
  readonly selectedProduct = signal<Product | null>(null);
  readonly currentProduct = computed(() => {
    const selected = this.selectedProduct();
    return selected ? this.catalog.products().find(product => product.id === selected.id) ?? null : null;
  });
  readonly categories = computed(() => ['Todas', ...new Set(this.catalog.products().map(p => p.category))]);
  readonly activeCategory = computed(() => this.categories().includes(this.category()) ? this.category() : 'Todas');
  readonly visibleProducts = computed(() => {
    const search = this.query().trim().toLocaleLowerCase();
    return this.catalog.products().filter(product =>
      (this.activeCategory() === 'Todas' || product.category === this.activeCategory()) &&
      (!search || `${product.name} ${product.description} ${product.category}`.toLocaleLowerCase().includes(search)));
  });

  ngOnInit(): void {
    this.catalog.load(true);
    this.refreshTimer = setInterval(() => {
      if (!document.hidden) this.catalog.load(true);
    }, 15000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  @HostListener('document:visibilitychange')
  @HostListener('window:focus')
  refreshWhenVisible(): void {
    if (!document.hidden) this.catalog.load(true);
  }
  search(event: Event): void { this.query.set((event.target as HTMLInputElement).value); }
  add(product: Product, buyNow = false): void {
    if (product.stock <= 0) return;
    const count = this.cart.count();
    this.cart.add(product);
    if (this.cart.count() === count) {
      this.notice.set('Ya añadiste todas las unidades disponibles de esta pieza.');
      if (buyNow && this.cart.items().some(item => item.product.id === product.id)) {
        this.selectedProduct.set(null);
        this.drawer.open('details');
      }
      return;
    }
    this.notice.set(`${product.name} se añadió al carrito.`);
    this.selectedProduct.set(null);
    this.drawer.open(buyNow ? 'details' : 'selection');
  }

  scrollToCatalog(): void {
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  @HostListener('document:keydown.escape')
  closeDetails(): void { this.selectedProduct.set(null); }
}
