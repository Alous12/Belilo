export interface Product {
  id: number | string;
  name: string;
  category: string;
  price: number;
  stock: number;
  image: string;
  images?: string[];
  description: string;
}

export type ProductInput = Omit<Product, 'id' | 'images'> & { images: string[] };
export function productImages(product: Pick<Product, 'image' | 'images'>): string[] {
  return product.images?.length ? product.images : product.image ? [product.image] : [];
}
export function primaryImage(product: Pick<Product, 'image' | 'images'>): string {
  return productImages(product)[0] ?? '';
}
export interface CartItem { product: Product; quantity: number; }
export interface DeliveryZone { id: number | string; name: string; image?: string; }
export interface DeliverySettings { zones: DeliveryZone[]; times: string[]; whatsappNumbers: string[]; departments: string[]; }
export type DeliveryType = 'ciudad' | 'otra_ciudad';
export interface OrderInput {
  clientName: string;
  clientPhone: string;
  deliveryType?: DeliveryType;
  deliveryLocation: string;
  deliveryDepartment?: string;
  deliveryAddress?: string;
  deliveryTime: string;
  items: { productId: Product['id']; quantity: number }[];
}
export type OrderStatus = 'pendiente' | 'entregado' | 'no_entregado';
export interface OrderItem { productId: Product['id']; quantity: number; name?: string; unitPrice?: number; }
export interface Order extends OrderInput {
  id: number | string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  createdAt?: string;
  resolvedAt?: string;
}
