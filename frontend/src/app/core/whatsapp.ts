import { CartItem, Order } from './models';

export interface WhatsappLink { label: string; href: string; }

export function whatsappLinks(order: Order, phones: string[], cartSnapshot: CartItem[]): WhatsappLink[] {
  const details = order.items.map(item => {
    const local = cartSnapshot.find(entry => String(entry.product.id) === String(item.productId));
    const name = item.name || local?.product.name || `Pieza #${item.productId}`;
    return `• ${item.quantity} × ${name}`;
  }).join('\n');
  const message = [
    `*BELILO · Pedido #${order.id}*`,
    `Cliente: ${order.clientName}`,
    `Teléfono: ${order.clientPhone}`,
    `Entrega: ${order.deliveryType === 'otra_ciudad' ? 'Envío a otra ciudad' : 'En la ciudad'}`,
    `${order.deliveryType === 'otra_ciudad' ? 'Departamento' : 'Punto de entrega'}: ${order.deliveryLocation}`,
    ...(order.deliveryAddress ? [`Ciudad y dirección: ${order.deliveryAddress}`] : []),
    `Horario: ${order.deliveryTime}`,
    'Piezas:', details,
    `Total: Bs ${order.total.toFixed(2)}`,
  ].join('\n');

  return phones.map((phone, index) => {
    const digits = phone.replace(/\D/g, '');
    const normalized = digits.length === 8 ? `591${digits}` : digits;
    return { label: `Asesor ${index + 1} · +${normalized}`, href: `https://wa.me/${normalized}?text=${encodeURIComponent(message)}` };
  }).filter(link => /^https:\/\/wa\.me\/\d{8,15}\?/.test(link.href));
}
