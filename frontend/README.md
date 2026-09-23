# BELILO · frontend Angular

Aplicación Angular 21 organizada por funciones. La compra se completa en el carrito lateral:

| Ruta | Función |
| --- | --- |
| `/inicio` | Catálogo, categorías y búsqueda de piezas |
| `/admin` | Inventario, estados de pedido y configuración de entregas; se abre tras pulsar cuatro veces BELILO en la cabecera y pedir la contraseña |

El botón **Mi bolsa** abre el carrito a la derecha desde cualquier página. En ese panel se revisan cantidades, datos de contacto, ubicación y horario. Después de registrar el pedido, el comprador recibe un enlace de WhatsApp con el mensaje preparado para cada asesor configurado. Debe tocar el enlace y enviarlo en WhatsApp; abrir el enlace no envía el mensaje automáticamente. El sitio limita la reapertura del enlace durante un minuto y el backend limita los pedidos repetidos.

## Colores del sitio

La paleta completa se edita en `src/theme.css`. Cambia las variables de `:root` para probar otros colores en inicio, catálogo, carrito, compra y administración al mismo tiempo. `--color-page`, `--color-surface` y `--color-field` controlan los fondos; `--color-text` y sus variantes controlan la tipografía; `--color-accent` y `--color-accent-hover` controlan los elementos destacados. Los bordes transparentes se derivan de `--color-border` con `color-mix`, por lo que siguen la paleta automáticamente. Los estados de éxito, error y pedido pendiente tienen variables propias para conservar su significado.

Los importes se muestran en **bolivianos (Bs)** sin convertir los valores numéricos existentes. Admin permite subir hasta 8 fotos por producto desde el equipo (4 MB por foto), elegir la portada, filtrar inventario por categoría y añadir una categoría nueva con la opción **Otra**. Cada producto muestra un carrusel de fotos. En la compra se elige entre entrega dentro de la ciudad y envío a otro departamento; el costo de ese envío se coordina aparte.

## Desarrollo

Requiere Node.js 22.12 o superior.

```bash
npm.cmd --prefix backend install
npm.cmd --prefix frontend install
```

En dos terminales, desde la carpeta del proyecto `Pablin`:

```powershell
npm.cmd --prefix backend start
npm.cmd --prefix frontend start
```

La página se abre en `http://127.0.0.1:4200/` y el backend escucha en `http://127.0.0.1:3000`. `npm start` dentro de `frontend` inicia solo Angular; el proxy de desarrollo conecta `/api` con el backend ya iniciado. Si el puerto 4200 está ocupado, usa `npm.cmd --prefix frontend start -- --port 4300` y abre `http://127.0.0.1:4300/`. Para iniciar ambos desde `frontend` con un solo comando, usa `npm run dev:all`; este comando carga `backend/.env` para activar Firestore si está configurado. La compilación de producción se genera con `npm run build`.

El backend local contiene productos iniciales y guarda los cambios en `../backend/data/store.json`. Pulsa cuatro veces el nombre BELILO de la cabecera para abrir Admin; en desarrollo local, la contraseña predeterminada es **CACAHUATE**. La sesión se conserva solo durante la sesión de la pestaña. El backend escucha únicamente en `127.0.0.1` para desarrollo local.

## Organización

- `src/app/core`: modelos, contrato `CommerceRepository`, cliente HTTP y estado compartido de catálogo y carrito.
- `src/app/features`: páginas independientes, cargadas al navegar.
- `src/app/shared/collection.ts`: contenedor genérico que dibuja cualquier lista de objetos con `id` usando una plantilla provista por la página; muestra un estado vacío cuando no hay elementos.
- `src/app/app.routes.ts`: navegación.
- `src/environments/environment.ts`: URL base de la API.
- `../backend`: API local con datos persistentes para desarrollo.
- `src/proxy.conf.json` y `scripts/dev.mjs`: proxy y arranque conjunto del frontend y el backend.

## Cloud Firestore

El backend ya puede guardar productos, pedidos y entregas en Cloud Firestore. Angular conserva el contrato `CommerceRepository` y sigue llamando a `/api`; por eso la clave de servicio Firebase nunca llega al navegador. El modo local continúa disponible. Consulta [la guía del backend](../backend/README.md) para crear el proyecto Firebase, importar los datos locales y activar `BELILO_STORE=firebase`. La API debe estar ejecutándose tanto en desarrollo como cuando el frontend se publique.

## Contrato con el backend

La URL base es `/api` por defecto. El desarrollo local ya incluye la API y el proxy. En producción, configure el servidor para servir `/api` en el mismo origen que Angular o cambie `apiUrl` en `src/environments/environment.ts`.

El frontend espera estas rutas JSON:

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/api/products` | Lista de productos |
| POST | `/api/products` | Crear producto |
| PUT | `/api/products/:id` | Editar producto |
| DELETE | `/api/products/:id` | Eliminar producto |
| POST | `/api/images` | Subir una imagen JPG, PNG o WebP (Admin, cuerpo binario) |
| GET | `/api/images/:name` | Mostrar una imagen cargada |
| GET | `/api/delivery-settings` | Zonas, horarios y teléfonos |
| PUT | `/api/delivery-settings` | Actualizar entregas |
| GET | `/api/orders` | Pedidos recibidos |
| POST | `/api/orders` | Registrar compra |
| PATCH | `/api/orders/:id/status` | Cerrar pedido como `entregado` o `no_entregado` (Admin) |

Las listas pueden ser un array JSON o `{ "data": [...] }`. Los productos tienen `id`, `name`, `category`, `price` (número en Bs), `stock` (entero no negativo), `images` (hasta 8 rutas) e `image` como portada compatible con productos anteriores. Al crear un producto se envían los mismos campos sin `id`; el backend devuelve el producto creado con su `id`. Los productos locales existentes sin stock reciben 10 unidades al iniciar el backend actualizado. Las zonas tienen `id`, `name` y `image` opcional. La configuración de entrega tiene `zones`, `times`, `departments` y `whatsappNumbers`.

La compra envía `clientName`, `clientPhone`, `deliveryType`, `deliveryLocation`, `deliveryTime` e `items: [{ productId, quantity }]`. Para `otra_ciudad` también envía `deliveryDepartment` y `deliveryAddress`; el horario queda `A coordinar con asesor`. El backend calcula el total de productos, valida las existencias y conserva nombre y precio de cada pieza en el pedido. El carrito se conserva en `localStorage` para que sobreviva a una recarga y se vacía únicamente cuando el pedido se registra con éxito. El pedido comienza como `pendiente`; al marcarlo `entregado` se descuenta el stock una sola vez. Al marcarlo `no_entregado`, el stock permanece igual. Los estados cerrados no se pueden volver a cambiar.

**Seguridad:** el backend exige la contraseña para las operaciones administrativas (`POST/PUT/DELETE /products`, `GET /orders`, `PUT /delivery-settings`, `PATCH /orders/:id/status`) y calcula el total del pedido con los precios actuales. `CACAHUATE` es la contraseña predeterminada solo en desarrollo local, también si se usa Firestore; en producción se exige `BELILO_ADMIN_TOKEN`. Tras 3 intentos incorrectos desde la misma IP, el backend bloquea el acceso durante 15 minutos. Se limitan los pedidos a 6 por IP y 3 por teléfono por hora. La vista `/admin` oculta no es por sí sola un control de acceso. Firestore se accede desde el backend mediante credenciales del servidor, sin exponerlas a Angular.

La compilación de producción genera el frontend. Para publicarlo junto con la API y guardar fotos persistentes en Netlify Blobs, sigue la [guía de Netlify](../backend/README.md#publicar-en-netlify-sin-firebase-storage). El servidor de `../backend` también puede servir esos archivos junto con `/api` en otro alojamiento usando almacenamiento local o Firestore.
