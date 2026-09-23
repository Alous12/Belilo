import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { concatMap, finalize, from } from 'rxjs';
import { CommerceRepository } from '../../core/commerce.repository';
import { CatalogService } from '../../core/catalog.service';
import { DeliverySettings, Order, OrderStatus, primaryImage, Product, ProductInput, productImages } from '../../core/models';
import { AdminAuthService } from '../../core/admin-auth.service';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function blankProduct(): ProductInput {
  return { name: '', category: '', price: 0, stock: 1, image: '', images: [], description: '' };
}

@Component({
  selector: 'app-admin',
  imports: [CurrencyPipe, DatePipe, FormsModule],
  templateUrl: './admin.html',
})
export class Admin implements OnInit, OnDestroy {
  private readonly api = inject(CommerceRepository);
  private readonly auth = inject(AdminAuthService);
  private refreshTimer?: ReturnType<typeof setInterval>;
  readonly catalog = inject(CatalogService);
  readonly primaryImage = primaryImage;
  readonly categories = computed(() => [...new Set(['Manillas', 'Collares', 'Aretes', 'Anillos', ...this.catalog.products().map(item => item.category).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'es')));
  readonly inventoryCategory = signal('Todas');
  readonly inventoryProducts = computed(() => this.catalog.products().filter(item => this.inventoryCategory() === 'Todas' || item.category === this.inventoryCategory()));
  readonly tab = signal<'products' | 'orders' | 'delivery'>('products');
  readonly orders = signal<Order[]>([]);
  readonly pendingCount = computed(() => this.orders().filter(order => order.status === 'pendiente').length);
  readonly deliveredCount = computed(() => this.orders().filter(order => order.status === 'entregado').length);
  readonly updatingOrderId = signal<Order['id'] | null>(null);
  readonly settings = signal<DeliverySettings | null>(null);
  readonly ordersLoading = signal(false);
  readonly settingsLoading = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly saving = signal(false);
  readonly uploadingImages = signal(false);
  readonly uploadingZoneImage = signal(false);
  readonly authenticated = signal(false);
  readonly loginPending = signal(false);
  readonly loginError = signal('');
  loginToken = '';
  editingId: Product['id'] | null = null;
  product: ProductInput = blankProduct();
  categoryChoice = '';
  customCategory = '';
  zoneName = '';
  zoneImage = '';
  timesText = '';
  phonesText = '';

  ngOnInit(): void {
    const token = this.auth.token();
    if (token) this.verifyToken(token);
    this.refreshTimer = setInterval(() => {
      if (this.authenticated() && this.tab() === 'orders' && !this.ordersLoading()) this.loadOrders(true);
    }, 15000);
  }

  ngOnDestroy(): void { if (this.refreshTimer) clearInterval(this.refreshTimer); }

  login(): void {
    const token = this.loginToken.trim();
    if (token && !this.loginPending()) this.verifyToken(token);
  }

  logout(): void {
    this.auth.clear();
    this.authenticated.set(false);
    this.loginToken = '';
    this.orders.set([]);
  }

  private verifyToken(token: string): void {
    this.loginPending.set(true);
    this.loginError.set('');
    this.auth.verify(token).subscribe({
      next: () => {
        this.auth.save(token);
        this.authenticated.set(true);
        this.loginToken = '';
        this.loginPending.set(false);
        this.catalog.load(true);
        this.loadOrders();
      },
      error: () => {
        this.auth.clear();
        this.authenticated.set(false);
        this.loginError.set('Contraseña incorrecta o servidor no disponible.');
        this.loginPending.set(false);
      },
    });
  }

  selectTab(tab: 'products' | 'orders' | 'delivery'): void {
    this.tab.set(tab);
    this.error.set(''); this.success.set('');
    if (tab === 'orders') this.loadOrders();
    if (tab === 'delivery') this.loadSettings();
    if (tab === 'products') this.catalog.load(true);
  }

  edit(item: Product): void {
    if (this.uploadingImages()) return;
    this.editingId = item.id;
    this.product = { name: item.name, category: item.category, price: item.price, stock: item.stock, image: item.image, images: productImages(item), description: item.description };
    this.categoryChoice = item.category;
    this.customCategory = '';
    this.error.set(''); this.success.set('');
  }

  resetForm(): void {
    if (this.uploadingImages()) return;
    this.editingId = null; this.product = blankProduct(); this.categoryChoice = ''; this.customCategory = '';
  }

  onImagesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length || this.uploadingImages()) return;
    if (files.length + this.product.images.length > 8) { this.error.set('Cada producto admite hasta 8 imágenes.'); return; }
    if (files.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > MAX_IMAGE_BYTES)) {
      this.error.set('Selecciona imágenes JPG, PNG o WebP de hasta 4 MB cada una.'); return;
    }
    this.error.set('');
    this.uploadingImages.set(true);
    from(files).pipe(
      concatMap(file => this.api.uploadImage(file)),
      finalize(() => this.uploadingImages.set(false)),
    ).subscribe({
      next: ({ url }) => {
        this.product.images = [...this.product.images, url];
        this.product.image = this.product.images[0] ?? '';
      },
      error: () => this.error.set('No se pudo subir una de las imágenes. Las fotos que ya aparecen sí quedaron cargadas.'),
    });
  }

  removeImage(index: number): void {
    this.product.images = this.product.images.filter((_, position) => position !== index);
    this.product.image = this.product.images[0] ?? '';
  }

  makeCover(index: number): void {
    const images = [...this.product.images];
    const [selected] = images.splice(index, 1);
    images.unshift(selected);
    this.product.images = images;
    this.product.image = selected;
  }

  saveProduct(): void {
    const category = (this.categoryChoice === 'Otra' ? this.customCategory : this.categoryChoice).trim();
    if (!this.product.name.trim() || !category || this.product.price <= 0 ||
        !Number.isInteger(this.product.stock) || this.product.stock < 0 || this.saving() || this.uploadingImages()) return;
    this.saving.set(true); this.error.set(''); this.success.set('');
    const input = { ...this.product, name: this.product.name.trim(), category, image: this.product.images[0] ?? '', images: [...this.product.images] };
    const request = this.editingId === null ? this.api.createProduct(input) : this.api.updateProduct(this.editingId, input);
    request.subscribe({
      next: saved => { this.catalog.upsert(saved); this.resetForm(); this.success.set('Producto guardado.'); this.saving.set(false); },
      error: () => { this.error.set('No se pudo guardar el producto.'); this.saving.set(false); },
    });
  }

  deleteProduct(item: Product): void {
    if (!confirm(`¿Eliminar ${item.name}?`)) return;
    this.error.set(''); this.success.set('');
    this.api.deleteProduct(item.id).subscribe({
      next: () => { this.catalog.remove(item.id); this.success.set('Producto eliminado.'); },
      error: () => this.error.set('No se pudo eliminar el producto.'),
    });
  }

  loadOrders(silent = false): void {
    if (!silent) { this.ordersLoading.set(true); this.error.set(''); }
    this.api.orders().subscribe({
      next: orders => { this.orders.set([...orders].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))); this.ordersLoading.set(false); },
      error: () => { if (!silent) this.error.set('No se pudieron cargar los pedidos.'); this.ordersLoading.set(false); },
    });
  }

  productName(id: Product['id']): string {
    return this.catalog.products().find(product => product.id === id)?.name ?? `Pieza #${id}`;
  }

  setOrderStatus(order: Order, status: Exclude<OrderStatus, 'pendiente'>): void {
    if (order.status !== 'pendiente' || this.updatingOrderId() !== null) return;
    this.updatingOrderId.set(order.id);
    this.error.set(''); this.success.set('');
    this.api.updateOrderStatus(order.id, status).subscribe({
      next: updated => {
        this.orders.update(orders => orders.map(item => item.id === updated.id ? updated : item));
        if (status === 'entregado') this.catalog.load(true);
        this.success.set(status === 'entregado' ? 'Pedido entregado. El stock se actualizó.' : 'Pedido marcado como no entregado. El stock se mantuvo igual.');
        this.updatingOrderId.set(null);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(error.error?.error?.message ?? 'No se pudo actualizar el pedido.');
        this.updatingOrderId.set(null);
      },
    });
  }

  loadSettings(): void {
    this.settingsLoading.set(true); this.error.set('');
    this.api.deliverySettings().subscribe({
      next: settings => {
        this.settings.set(settings);
        this.timesText = settings.times.join('\n');
        this.phonesText = settings.whatsappNumbers.join('\n');
        this.settingsLoading.set(false);
      },
      error: () => { this.error.set('No se pudo cargar la configuración de entrega.'); this.settingsLoading.set(false); },
    });
  }

  addZone(): void {
    const name = this.zoneName.trim();
    if (!name || !this.settings()) return;
    const image = this.zoneImage.trim();
    this.settings.update(current => current ? { ...current, zones: [...current.zones, { id: crypto.randomUUID(), name, ...(image ? { image } : {}) }] } : null);
    this.zoneName = '';
    this.zoneImage = '';
  }

  uploadZoneImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.uploadingZoneImage()) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > MAX_IMAGE_BYTES) {
      this.error.set('La imagen de la ubicación debe ser JPG, PNG o WebP y pesar hasta 4 MB.'); return;
    }
    this.uploadingZoneImage.set(true);
    this.error.set('');
    this.api.uploadImage(file).pipe(finalize(() => this.uploadingZoneImage.set(false))).subscribe({
      next: ({ url }) => { this.zoneImage = url; },
      error: () => this.error.set('No se pudo subir la imagen de la ubicación.'),
    });
  }

  removeZone(id: string | number): void {
    this.settings.update(current => current ? { ...current, zones: current.zones.filter(zone => zone.id !== id) } : null);
  }

  saveSettings(): void {
    const current = this.settings();
    if (!current || this.saving()) return;
    const settings: DeliverySettings = {
      ...current,
      times: this.timesText.split('\n').map(x => x.trim()).filter(Boolean),
      whatsappNumbers: this.phonesText.split('\n').map(x => x.trim()).filter(Boolean),
    };
    this.saving.set(true); this.error.set(''); this.success.set('');
    this.api.updateDeliverySettings(settings).subscribe({
      next: saved => { this.settings.set(saved); this.success.set('Configuración guardada.'); this.saving.set(false); },
      error: () => { this.error.set('No se pudo guardar la configuración.'); this.saving.set(false); },
    });
  }
}
