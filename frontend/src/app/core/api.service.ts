import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { DeliverySettings, Order, OrderInput, OrderStatus, Product, ProductInput } from './models';
import { CommerceRepository } from './commerce.repository';

function unwrapList<T>(response: T[] | { data: T[] }): T[] {
  return Array.isArray(response) ? response : response.data;
}

@Injectable({ providedIn: 'root' })
export class ApiService extends CommerceRepository {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl.replace(/\/$/, '');

  products(): Observable<Product[]> {
    return this.http.get<Product[] | { data: Product[] }>(`${this.base}/products`).pipe(map(unwrapList));
  }
  createProduct(product: ProductInput): Observable<Product> {
    return this.http.post<Product>(`${this.base}/products`, product);
  }
  updateProduct(id: Product['id'], product: ProductInput): Observable<Product> {
    return this.http.put<Product>(`${this.base}/products/${encodeURIComponent(id)}`, product);
  }
  deleteProduct(id: Product['id']): Observable<void> {
    return this.http.delete<void>(`${this.base}/products/${encodeURIComponent(id)}`);
  }
  uploadImage(file: File): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(`${this.base}/images`, file, {
      headers: { 'Content-Type': file.type },
    });
  }
  deliverySettings(): Observable<DeliverySettings> {
    return this.http.get<DeliverySettings>(`${this.base}/delivery-settings`);
  }
  updateDeliverySettings(settings: DeliverySettings): Observable<DeliverySettings> {
    return this.http.put<DeliverySettings>(`${this.base}/delivery-settings`, settings);
  }
  orders(): Observable<Order[]> {
    return this.http.get<Order[] | { data: Order[] }>(`${this.base}/orders`).pipe(map(unwrapList));
  }
  createOrder(order: OrderInput): Observable<Order> {
    return this.http.post<Order>(`${this.base}/orders`, order);
  }
  updateOrderStatus(id: Order['id'], status: Exclude<OrderStatus, 'pendiente'>): Observable<Order> {
    return this.http.patch<Order>(`${this.base}/orders/${encodeURIComponent(id)}/status`, { status });
  }
}
