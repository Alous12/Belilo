import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommerceRepository } from '../../core/commerce.repository';
import { CartService } from '../../core/cart.service';
import { CatalogService } from '../../core/catalog.service';
import { CartItem, DeliverySettings, DeliveryType, Order, OrderInput, primaryImage } from '../../core/models';
import { whatsappLinks } from '../../core/whatsapp';

@Component({
  selector: 'app-checkout',
  imports: [CurrencyPipe, FormsModule, RouterLink],
  templateUrl: './checkout.html',
})
export class Checkout implements OnInit {
  private readonly api = inject(CommerceRepository);
  readonly cart = inject(CartService);
  readonly primaryImage = primaryImage;
  private readonly catalog = inject(CatalogService);
  readonly compact = input(false);
  readonly settings = signal<DeliverySettings | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly order = signal<Order | null>(null);
  readonly orderedItems = signal<CartItem[]>([]);
  readonly links = computed(() => {
    const order = this.order();
    return order && this.settings() ? whatsappLinks(order, this.settings()!.whatsappNumbers, this.orderedItems()) : [];
  });
  name = '';
  phone = '';
  zone = '';
  time = '';
  deliveryType: DeliveryType = 'ciudad';
  department = '';
  address = '';

  deliveryValid(): boolean {
    return this.deliveryType === 'ciudad' ? !!this.zone && !!this.time : !!this.department && !!this.address.trim();
  }

  ngOnInit(): void {
    this.loadSettings();
    if (this.cart.items().length) this.catalog.load();
  }

  loadSettings(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.deliverySettings().subscribe({
      next: settings => {
        this.settings.set(settings);
        this.zone = settings.zones[0]?.name ?? '';
        this.time = settings.times[0] ?? '';
        this.department = settings.departments[0] ?? '';
        this.loading.set(false);
      },
      error: () => { this.error.set('No se pudieron cargar las opciones de entrega.'); this.loading.set(false); },
    });
  }

  submit(): void {
    if (!this.cart.items().length || !this.name.trim() || !this.phone.trim() || !this.deliveryValid() || this.submitting()) return;
    const snapshot = this.cart.items().map(item => ({ ...item }));
    const payload: OrderInput = {
      clientName: this.name.trim(), clientPhone: this.phone.trim(),
      deliveryType: this.deliveryType,
      deliveryLocation: this.deliveryType === 'ciudad' ? this.zone : this.department,
      deliveryTime: this.deliveryType === 'ciudad' ? this.time : 'A coordinar con asesor',
      ...(this.deliveryType === 'otra_ciudad' ? { deliveryDepartment: this.department, deliveryAddress: this.address.trim() } : {}),
      items: this.cart.items().map(item => ({ productId: item.product.id, quantity: item.quantity })),
    };
    this.submitting.set(true);
    this.error.set('');
    this.api.createOrder(payload).subscribe({
      next: order => {
        this.orderedItems.set(snapshot);
        this.order.set(order);
        this.cart.clear();
        this.submitting.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(error.error?.error?.message ?? 'No se pudo registrar el pedido. Revisa los datos e inténtalo de nuevo.');
        this.submitting.set(false);
      },
    });
  }
}
