# BELILO · backend

API de Node.js y Express para el frontend Angular. Funciona con un archivo JSON local o con Cloud Firestore sin cambiar las rutas de Angular.

## Modo local

Requiere Node.js 22.12 o superior. Desde la carpeta `Pablin`:

```powershell
npm.cmd --prefix backend install
npm.cmd --prefix backend start
```

La API escucha en `http://127.0.0.1:3000`. En desarrollo, la contraseña de Admin es `CACAHUATE`; se puede sustituir con `BELILO_ADMIN_TOKEN`. Sin `BELILO_STORE=firebase`, los productos, pedidos y entregas se guardan en `backend/data/store.json`, que no se incluye en Git. Inicia Angular en otra terminal con `npm.cmd --prefix frontend start`.

## Activar Cloud Firestore

1. El ID del proyecto Firebase de BELILO ya está configurado como **`belilo`** en `src/firebase-store.js`. Habilita **Cloud Firestore** en modo de producción en [Firebase Console](https://console.firebase.google.com/). El ID de la base de datos puede permanecer como `(default)`.
2. En *Configuración del proyecto → Cuentas de servicio*, genera una clave privada para el servidor y guárdala **fuera de este repositorio**. No copies su contenido al código, a Angular ni a un chat. En un servidor de Google Cloud puedes usar credenciales predeterminadas sin descargar una clave.
3. En `backend/.env` (ignorado por Git), configura estas variables; sustituye la ruta del archivo por la tuya:

   ```dotenv
   BELILO_STORE=firebase
   BELILO_IMAGE_STORE=local
   BELILO_FIREBASE_PROJECT_ID=belilo
   GOOGLE_APPLICATION_CREDENTIALS=C:\ruta\fuera\del\proyecto\service-account.json
   ```

   `npm start`, `npm run firebase:check` y `npm run firebase:import` cargan este archivo automáticamente. El comando `npm.cmd --prefix frontend run dev:all` también lo carga al iniciar el backend. Puedes añadir `BELILO_ADMIN_TOKEN=una-contrasena-larga-y-unica` si quieres cambiar la contraseña de Admin. Para volver al modo JSON local, cambia `BELILO_STORE=local` y reinicia la API.

4. Con el backend local ya iniciado al menos una vez, importa **una sola vez** el catálogo, los pedidos existentes, las ubicaciones, los horarios y los teléfonos:

   ```powershell
   npm.cmd --prefix backend run firebase:import
   ```

   La importación se cancela si ya hay datos BELILO en Firestore; no sobrescribe pedidos existentes. Haz una copia de `backend/data/store.json` antes de importar si necesitas conservar otra versión local.
5. Inicia la API con `npm.cmd --prefix backend start` y Angular con `npm.cmd --prefix frontend start`. El frontend sigue usando `/api` y no necesita una clave de servicio ni configuración Firebase en el navegador. Si cambias de proyecto en el futuro, puedes sobrescribir el ID predeterminado con `BELILO_FIREBASE_PROJECT_ID`.

En desarrollo local, `CACAHUATE` sigue siendo la contraseña de Admin aunque los datos estén en Firebase, salvo que configures `BELILO_ADMIN_TOKEN`. En producción, `BELILO_ADMIN_TOKEN` es obligatorio y debe ser largo y único. La API debe permanecer activa para que Angular pueda consultar Firestore. Para alojarla fuera de tu equipo, despliega el backend en un servidor Node.js y configura las mismas variables como secretos del servidor; configura `/api` para apuntar a esa API.

El Admin SDK del servidor omite las reglas de seguridad de Firestore. En un proyecto dedicado a BELILO, usa las reglas de `firebase/firestore.rules` para negar el acceso directo desde clientes web. No las apliques a un proyecto compartido con otras aplicaciones sin revisar sus necesidades de acceso.

## Datos y operaciones

Firestore usa `products/{id}`, `orders/{id}` y `settings/delivery`. Las compras se registran como pendientes. Al cerrar un pedido como entregado, una transacción descuenta stock una sola vez; al marcarlo no entregado, conserva el stock. La creación de pedidos y la eliminación de productos también usan transacciones para conservar las validaciones cuando hay solicitudes simultáneas.

Los precios ahora se muestran en **Bs** y conservan sus valores numéricos anteriores; no se hizo conversión cambiaria. Cada producto admite hasta 8 imágenes JPG, PNG o WebP (4 MB por archivo) subidas desde Admin. En desarrollo local, los archivos se guardan en `backend/data/images` y se sirven por `/api/images/:nombre`. Las imágenes cargadas previamente mediante URL siguen funcionando.

## Publicar en Netlify sin Firebase Storage

El archivo [`../netlify.toml`](../netlify.toml) compila Angular, empaqueta la API Express en una Netlify Function y envía `/api/*` a esa función. En Netlify, la API conserva productos, pedidos y entregas en Firestore, y guarda las fotos en **Netlify Blobs**, una colección del sitio que persiste entre despliegues. Así, el administrador puede añadir fotos y los clientes pueden verlas desde la misma URL del catálogo. El desarrollo local sigue usando `backend/data/images`.

1. Conecta en Netlify el repositorio cuya raíz contiene `frontend/`, `backend/` y `netlify.toml`. Deja **Base directory** vacío para usar la raíz del repositorio; subir únicamente `frontend/dist` no incluirá la API ni Blobs. El comando de compilación y el directorio publicado ya están en `netlify.toml`.
2. En la configuración del sitio de Netlify, añade estas variables de entorno. Marca la contraseña y el JSON como secretos y **no los escribas en `netlify.toml` ni en Git**:

   ```dotenv
   BELILO_STORE=firebase
   BELILO_FIREBASE_PROJECT_ID=belilo
   BELILO_ADMIN_TOKEN=<contraseña-administrativa-larga-y-única>
   BELILO_FIREBASE_SERVICE_ACCOUNT_JSON=<contenido-JSON-de-la-cuenta-de-servicio>
   ```

   La cuenta de servicio es la que ya usa este proyecto para Firestore. Netlify necesita su JSON como variable porque no tiene acceso a la ruta `GOOGLE_APPLICATION_CREDENTIALS` de este equipo. El JSON solo se lee en la Function; no se envía a Angular. No hace falta activar Blaze ni Cloud Storage de Firebase. No configures `BELILO_IMAGE_STORE=local` en Netlify.
3. Publica el sitio y comprueba `https://TU-SITIO.netlify.app/api/health`. Luego entra en `/admin`, sube una foto de prueba y abre el catálogo desde otro navegador. Las fotos nuevas se guardan en la colección permanente `belilo-images` de Netlify Blobs.
4. Las fotos **ya subidas en este equipo** requieren una copia inicial; sus rutas actuales se conservan. Tras crear el sitio, coloca temporalmente `NETLIFY_SITE_ID` (el **Project ID** de Netlify) y `NETLIFY_AUTH_TOKEN` (un token personal de Netlify) en el `backend/.env` ignorado por Git, y ejecuta desde `Pablin`:

   ```powershell
   npm.cmd --prefix backend run netlify:images:import
   ```

   Retira `NETLIFY_AUTH_TOKEN` del archivo al terminar. El script copia los archivos de `backend/data/images` a Blobs con los mismos nombres. Las fotos de más de 4 MB deben reducirse antes de copiarlas porque la Function tiene un límite de tamaño de solicitud/respuesta.

Netlify Free incluye Functions y Blobs con un límite mensual de créditos; al agotarlo, el sitio se pausa hasta el siguiente ciclo, sin cargos automáticos. El número de productos por sí solo no determina el uso: también cuentan las visitas y descargas de imágenes. Consulta la [documentación de Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/) y [los límites del plan Free](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/).

Si en otro alojamiento necesitas Firebase Storage, crea un bucket y configura `BELILO_IMAGE_STORE=firebase` y, si el nombre no es `belilo.firebasestorage.app`, `BELILO_STORAGE_BUCKET=nombre-del-bucket`; Firebase Storage requiere Blaze.

La compra permite **entrega en la ciudad** mediante los puntos y horarios configurados, o **envío a otra ciudad** con departamento y dirección. El costo de envío se coordina con el asesor y no se suma al total de los productos. Los pedidos antiguos sin tipo de entrega se muestran como entregas en la ciudad.

Las rutas públicas son `GET /api/products`, `GET /api/delivery-settings` y `POST /api/orders`. Las operaciones de catálogo, los ajustes, `GET /api/orders` y `PATCH /api/orders/:id/status` requieren `Authorization: Bearer <BELILO_ADMIN_TOKEN>`.

Ejecuta `npm.cmd --prefix backend test` para probar el contrato de la API y las reglas de stock en el modo local.
