import { timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createLocalCommerceStore } from './commerce-store.js';
import { createLocalImageStore, imageType } from './image-store.js';
import { DEPARTMENTS, withDepartments } from './delivery.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultDataFile = join(root, 'data', 'store.json');
const defaultFrontendDir = resolve(root, '..', 'frontend', 'dist', 'belilo', 'browser');

function failure(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function textField(value, maximum, required = true) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length <= maximum && (!required || trimmed.length > 0) ? trimmed : null;
}

function parseProduct(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const name = textField(body.name, 120);
  const category = textField(body.category, 60);
  const description = textField(body.description, 2000, false);
  const legacyImage = textField(body.image ?? '', 2048, false);
  const rawImages = body.images === undefined ? (legacyImage ? [legacyImage] : []) : body.images;
  const price = body.price;
  const stock = body.stock;
  if (name === null || category === null || description === null || legacyImage === null ||
      !Array.isArray(rawImages) || rawImages.length > 8 ||
      typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || price > 1_000_000 ||
      !Number.isSafeInteger(stock) || stock < 0 || stock > 100_000) return null;
  const images = rawImages.map(value => textField(value, 2048));
  if (images.includes(null) || new Set(images).size !== images.length || images.some(value => {
    if (/^\/api\/images\/[a-f\d-]{36}\.(jpg|png|webp)$/i.test(value)) return false;
    try { return !['http:', 'https:'].includes(new URL(value).protocol); }
    catch { return true; }
  })) return null;
  return { name, category, price: Math.round(price * 100) / 100, stock, image: images[0] ?? '', images, description };
}

function parseSettings(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      !Array.isArray(body.zones) || !Array.isArray(body.times) || !Array.isArray(body.whatsappNumbers) ||
      body.zones.length < 1 || body.zones.length > 100 ||
      body.times.length < 1 || body.times.length > 50 || body.whatsappNumbers.length > 20) return null;

  const zones = body.zones.map(zone => {
    if (!zone || (typeof zone.id !== 'string' && typeof zone.id !== 'number')) return null;
    const name = textField(zone.name, 120);
    const image = zone.image === undefined ? undefined : textField(zone.image, 2048, false);
    return name === null || image === null ? null : { id: zone.id, name, ...(image ? { image } : {}) };
  });
  const times = body.times.map(value => textField(value, 100));
  const whatsappNumbers = body.whatsappNumbers.map(value => textField(value, 24));
  if (zones.includes(null) || times.includes(null) || whatsappNumbers.includes(null) ||
      new Set(zones.map(zone => String(zone.id))).size !== zones.length) return null;
  return { zones, times, whatsappNumbers };
}

function parseOrder(body, state) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const clientName = textField(body.clientName, 120);
  const clientPhone = textField(body.clientPhone, 30);
  const deliveryLocation = textField(body.deliveryLocation, 120);
  const deliveryTime = textField(body.deliveryTime, 100);
  const deliveryType = body.deliveryType ?? 'ciudad';
  const deliveryDepartment = deliveryType === 'otra_ciudad' ? textField(body.deliveryDepartment, 60) : undefined;
  const deliveryAddress = deliveryType === 'otra_ciudad' ? textField(body.deliveryAddress, 200) : undefined;
  if (clientName === null || clientPhone === null || !/^[+\d ()-]{7,30}$/.test(clientPhone) ||
      deliveryLocation === null || deliveryTime === null ||
      !['ciudad', 'otra_ciudad'].includes(deliveryType) ||
      (deliveryType === 'ciudad' && (!state.deliverySettings.zones.some(zone => zone.name === deliveryLocation) ||
        !state.deliverySettings.times.includes(deliveryTime))) ||
      (deliveryType === 'otra_ciudad' && (!DEPARTMENTS.includes(deliveryDepartment) ||
        deliveryAddress === null || deliveryLocation !== deliveryDepartment || deliveryTime !== 'A coordinar con asesor')) ||
      !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) return null;

  const quantities = new Map();
  for (const item of body.items) {
    if (!item || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) return null;
    const product = state.products.find(product => String(product.id) === String(item.productId));
    if (!product) return null;
    const totalQuantity = (quantities.get(product.id) ?? 0) + item.quantity;
    if (totalQuantity > 99 || totalQuantity > product.stock) return null;
    quantities.set(product.id, totalQuantity);
  }
  const items = [...quantities].map(([productId, quantity]) => {
    const product = state.products.find(entry => entry.id === productId);
    return { productId, quantity, name: product.name, unitPrice: product.price };
  });
  const totalCents = items.reduce((sum, item) => {
    const product = state.products.find(product => product.id === item.productId);
    return sum + Math.round(product.price * 100) * item.quantity;
  }, 0);
  return { clientName, clientPhone, deliveryType, deliveryLocation, deliveryTime,
    ...(deliveryType === 'otra_ciudad' ? { deliveryDepartment, deliveryAddress } : {}), items, total: totalCents / 100 };
}

export function createApp({ dataFile = defaultDataFile, adminToken, frontendDir = defaultFrontendDir, commerceStore, imageStore, imageMaxMb = 4 } = {}) {
  if (!adminToken) throw new Error('Se requiere un token de administración.');
  const store = commerceStore ?? createLocalCommerceStore(dataFile);
  const images = imageStore ?? createLocalImageStore(join(dirname(dataFile), 'images'));
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  function requireAdmin(req, res, next) {
    const supplied = /^Bearer (.+)$/.exec(req.get('authorization') ?? '')?.[1] ?? '';
    const expectedBuffer = Buffer.from(adminToken);
    const suppliedBuffer = Buffer.from(supplied);
    if (suppliedBuffer.length !== expectedBuffer.length ||
        !timingSafeEqual(suppliedBuffer, expectedBuffer)) {
      return failure(res, 401, 'UNAUTHORIZED', 'Se requiere un token de administración válido.');
    }
    next();
  }

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/admin/session', requireAdmin, (_req, res) => res.json({ authenticated: true }));

  app.post('/api/images', requireAdmin, express.raw({ type: () => true, limit: `${imageMaxMb}mb` }), async (req, res) => {
    const declaredType = req.get('content-type')?.split(';')[0].trim().toLowerCase();
    const type = imageType(req.body, declaredType);
    if (!type || req.body.length === 0) return failure(res, 400, 'INVALID_IMAGE', `Sube una imagen JPG, PNG o WebP válida (máximo ${imageMaxMb} MB).`);
    const url = await images.save(req.body, type);
    return res.status(201).json({ url });
  });
  app.get('/api/images/:name', async (req, res, next) => {
    const image = await images.get(req.params.name);
    if (!image) return failure(res, 404, 'NOT_FOUND', 'Imagen no encontrada.');
    res.set({ 'Content-Type': image.type, 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' });
    image.stream().on('error', next).pipe(res);
  });

  app.get('/api/products', async (_req, res) => res.json(await store.listProducts()));
  app.post('/api/products', requireAdmin, async (req, res) => {
    const input = parseProduct(req.body);
    if (!input) return failure(res, 400, 'INVALID_PRODUCT', 'Los datos del producto no son válidos.');
    const product = await store.addProduct(input);
    return res.status(201).json(product);
  });
  app.put('/api/products/:id', requireAdmin, async (req, res) => {
    const input = parseProduct(req.body);
    if (!input) return failure(res, 400, 'INVALID_PRODUCT', 'Los datos del producto no son válidos.');
    const product = await store.replaceProduct(req.params.id, input);
    if (!product) return failure(res, 404, 'NOT_FOUND', 'Producto no encontrado.');
    return res.json(product);
  });
  app.delete('/api/products/:id', requireAdmin, async (req, res) => {
    const result = await store.removeProduct(req.params.id);
    if (result === 'not_found') return failure(res, 404, 'NOT_FOUND', 'Producto no encontrado.');
    if (result === 'pending') {
      return failure(res, 409, 'PRODUCT_IN_PENDING_ORDER', 'No puedes eliminar una pieza con pedidos pendientes.');
    }
    return res.status(204).end();
  });

  app.get('/api/delivery-settings', async (_req, res) => res.json(withDepartments(await store.getDeliverySettings())));
  app.put('/api/delivery-settings', requireAdmin, async (req, res) => {
    const settings = parseSettings(req.body);
    if (!settings) return failure(res, 400, 'INVALID_SETTINGS', 'Se requiere una zona y un horario válidos.');
    return res.json(withDepartments(await store.setDeliverySettings(settings)));
  });

  app.get('/api/orders', requireAdmin, async (_req, res) => res.json(await store.listOrders()));
  app.post('/api/orders', async (req, res) => {
    const order = await store.addOrder(req.body, parseOrder);
    if (!order) return failure(res, 400, 'INVALID_ORDER', 'Revisa los productos y los datos de entrega.');
    return res.status(201).json(order);
  });

  app.patch('/api/orders/:id/status', requireAdmin, async (req, res) => {
    const status = req.body?.status;
    if (!['entregado', 'no_entregado'].includes(status)) {
      return failure(res, 400, 'INVALID_STATUS', 'Selecciona entregado o no entregado.');
    }
    const result = await store.setOrderStatus(req.params.id, status);
    if (result.kind === 'not_found') return failure(res, 404, 'NOT_FOUND', 'Pedido no encontrado.');
    if (result.kind === 'closed') return failure(res, 409, 'ORDER_CLOSED', 'Este pedido ya fue cerrado.');
    if (result.kind === 'stock') return failure(res, 409, 'INSUFFICIENT_STOCK', 'No hay stock suficiente para entregar este pedido.');
    return res.json(result.order);
  });

  app.use('/api', (_req, res) => failure(res, 404, 'NOT_FOUND', 'Ruta no encontrada.'));

  if (existsSync(join(frontendDir, 'index.html'))) {
    app.use(express.static(frontendDir));
    app.use((req, res, next) => {
      if (req.method === 'GET' && req.accepts('html')) return res.sendFile(join(frontendDir, 'index.html'));
      return next();
    });
  }

  app.use((error, _req, res, _next) => {
    if (error?.type === 'entity.parse.failed') return failure(res, 400, 'INVALID_JSON', 'El cuerpo debe ser JSON válido.');
    if (error?.type === 'entity.too.large') return failure(res, 413, 'BODY_TOO_LARGE', 'El cuerpo excede el tamaño permitido.');
    console.error(error);
    return failure(res, 500, 'INTERNAL_ERROR', 'Error interno del servidor.');
  });
  return app;
}
