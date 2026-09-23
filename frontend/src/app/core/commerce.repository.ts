import { Observable } from 'rxjs';
import { DeliverySettings, Order, OrderInput, OrderStatus, Product, ProductInput } from './models';

// Angular uses this contract while the backend selects local JSON or Firestore.
export abstract class CommerceRepository {
  abstract products(): Observable<Product[]>;
  abstract createProduct(product: ProductInput): Observable<Product>;
  abstract updateProduct(id: Product['id'], product: ProductInput): Observable<Product>;
  abstract deleteProduct(id: Product['id']): Observable<void>;
  abstract uploadImage(file: File): Observable<{ url: string }>;
  abstract deliverySettings(): Observable<DeliverySettings>;
  abstract updateDeliverySettings(settings: DeliverySettings): Observable<DeliverySettings>;
  abstract orders(): Observable<Order[]>;
  abstract createOrder(order: OrderInput): Observable<Order>;
  abstract updateOrderStatus(id: Order['id'], status: Exclude<OrderStatus, 'pendiente'>): Observable<Order>;
}
