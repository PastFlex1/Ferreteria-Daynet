# 🛠️ Ferretería Daynet - Core ERP & Facturación Electrónica SRI

> **Sistema Integral de Facturación, Inventario, Punto de Venta (POS) y Contabilidad Formal**  
> Arquitectura 100% migrada a **PostgreSQL 18 Relacional** con soporte multi-caja en tiempo real (LAN), control de concurrencia ACID y emisión electrónica al SRI (Ecuador).

---

## 📋 Tabla de Contenidos
1. [Resumen Ejecutivo de la Migración](#-resumen-ejecutivo-de-la-migración)
2. [Arquitectura del Sistema](#-arquitectura-del-sistema)
3. [Inventario de Cambios: Archivos Eliminados, Creados y Modificados](#-inventario-de-cambios)
4. [Esquema de Base de Datos PostgreSQL 18](#-esquema-de-base-de-datos-postgresql-18)
5. [Endpoints de la API Express](#-endpoints-de-la-api-express)
6. [Guía de Puesta en Marcha (Paso a Paso)](#-guía-de-puesta-en-marcha)
7. [Inspección Visual con pgAdmin 4 o DBeaver](#-inspección-visual-con-pgadmin-4-o-dbeaver)

---

## 🚀 Resumen Ejecutivo de la Migración

Se eliminaron de raíz todas las dependencias y rastros de código de **MongoDB** y **Firebase/Firestore**, reemplazándolos por un motor empresarial **PostgreSQL 18**:

* ❌ **Eliminado al 100%**:
  * Dependencia npm `mongodb` desinstalada de `package.json`.
  * Cero imports de `mongodb` o SDKs de Firebase en todo el código.
  * Eliminación de scripts legados (`vite-mongo-plugin.ts`, `mongo-bridge.cjs`, `init_compass.cjs`, `clean_database.cjs`, `sync_mongo_collections.cjs`).
  * Eliminación de hooks y servicios antiguos (`useFirestoreSync.ts`, `mongoSyncService.ts`, `MongoConnectorCard.tsx`).
* ✅ **Implementado al 100%**:
  * Driver oficial de PostgreSQL (`pg` + `@types/pg`) con Pool de Conexiones optimizado para alta concurrencia.
  * Esquema relacional formal DDL (`server/sql/schema.sql`) con claves primarias, foráneas, índices B-Tree y JSONB indexado con GIN.
  * Hook de reactividad nativo (`usePostgresSync.ts`) y servicio unificado (`postgresSyncService.ts`).
  * Conexión en tiempo real para terminales LAN mediante **Server-Sent Events (SSE)**.
  * Worker en segundo plano para la cola de facturación electrónica SRI (`server/services/sriWorker.ts`).
  * Tarjeta de conexión y diagnóstico en la UI (`PostgresConnectorCard.tsx`).
  * Cero errores de compilación (`tsc --noEmit` código 0) y build de producción limpio (`dist/`).

---

## 🏛️ Arquitectura del Sistema

```
┌────────────────────────────────────────────────────────────────────────┐
│                        NAVEGADOR / TERMINAL POS                        │
│   React 19 + TypeScript + TailwindCSS + Optimistic UI (LocalStorage)  │
│          usePostgresSync (Reactividad) / EventSource (SSE)            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP Fetch / SSE Stream
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      SERVIDOR BACKEND (EXPRESS)                        │
│                           Puerto: 5000                                 │
│                                                                        │
│  ├── /api/auth          ➔ Autenticación con Bcrypt & JWT               │
│  ├── /api/invoices      ➔ Facturas, Validación y Reserva Secuencial   │
│  ├── /api/sri           ➔ Firma Digital .p12 y Worker en 2do Plano    │
│  ├── /api/postgres      ➔ Sincronización Reactiva SSE y CRUD           │
│  ├── /api/accounting    ➔ Partida Doble (Debe == Haber) y Períodos     │
│  └── /dist (Estático)   ➔ Sirve la SPA de React en Producción          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Connection Pool (pg.Pool)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        MOTOR POSTGRESQL 18                             │
│                     Puerto: 5432 / ferreteria_daynet                   │
│                                                                        │
│  • Tablas Relacionales: facturas_ventas, productos, clientes, etc.     │
│  • Concurrencia ACID: secuenciales_emision (Puntos 001 - 004)          │
│  • Cola Transaccional: cola_sri, certificados_sri                      │
│  • Contabilidad: asientos_contables, plan_cuentas_contable             │
│  • Bitácora Inmutable: bitacora_auditoria                              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📂 Inventario de Cambios

### 1. Archivos Eliminados Definitivamente
| Archivo Eliminado | Motivo de Eliminación |
| :--- | :--- |
| `vite-mongo-plugin.ts` | Puente de desarrollo legado que interceptaba rutas hacia MongoDB. |
| `scripts/mongo-bridge.cjs` | Proceso independiente antiguo de Node para MongoDB. |
| `scripts/init_compass.cjs` | Inicializador legado para colecciones de MongoDB Compass. |
| `scripts/clean_database.cjs` | Script legado de truncado para bases NoSQL. |
| `scripts/sync_mongo_collections.cjs` | Script antiguo de copia entre colecciones de Mongo. |
| `src/hooks/useFirestoreSync.ts` | Hook original de Firebase/Firestore; migrado a `usePostgresSync.ts`. |
| `src/services/mongoSyncService.ts` | Servicio que llamaba a endpoints de Mongo; migrado a `postgresSyncService.ts`. |
| `src/components/Settings/MongoConnectorCard.tsx` | Tarjeta de Mongo Compass; reemplazada por `PostgresConnectorCard.tsx`. |
| `rewrite_app_states.cjs`, `fix_import.cjs`, `replace_dates.py` | Scripts scratch temporales eliminados para dejar el repositorio limpio. |

### 2. Archivos Nuevos Creados
| Archivo Creado | Propósito |
| :--- | :--- |
| `server/sql/schema.sql` | Esquema DDL formal con 20 tablas relacionales, índices y restricciones en PostgreSQL 18. |
| `server/config/postgres.ts` | Administrador del pool `pg`, ejecutor de DDL y adaptador de consultas con soporte ACID y JSONB. |
| `server/scripts/initPostgres.ts` | Script ejecutable (`npm run init:pg`) que crea la base de datos y ejecuta el `schema.sql`. |
| `server/scripts/cleanPostgres.ts` | Script (`npm run clean:pg`) que vacía únicamente tablas de prueba antes de ir a producción. |
| `src/hooks/usePostgresSync.ts` | Hook de reactividad para componentes React conectado a PostgreSQL y canales SSE. |
| `src/services/postgresSyncService.ts` | Cliente HTTP frontend para diagnóstico, estado, sync-all y pull-all sobre PostgreSQL. |
| `src/components/Settings/PostgresConnectorCard.tsx` | Componente de interfaz de usuario con diagnóstico del puerto 5432 y guía para pgAdmin/DBeaver. |

### 3. Archivos Clave Modificados
* **`package.json`**: Se eliminó `mongodb`, se configuró `pg` y `@types/pg`, y se agregaron los comandos `init:pg` y `clean:pg`.
* **`server/index.ts`**: Verificación de conexión a PostgreSQL en el arranque y log informativo.
* **`server/routes/index.ts`**: Rutas unificadas bajo `/api/postgres/` y `/api/sync/`.
* **`server/routes/sync.routes.ts`**: Uso de `optionalToken` para que terminales locales no sean bloqueadas con 401 durante la lectura/escritura en PostgreSQL.
* **`src/components/Header.tsx`**: Menú actualizado a **"Base de Datos (PostgreSQL)"**.
* **`src/components/Settings/SettingsManager.tsx`**: Subtítulos y tarjeta integrados a PostgreSQL 18.
* **22 Componentes del Frontend**: Actualizados para importar y usar directamente `usePostgresSync`.
* **`.env` y `.env.example`**: Variables estandarizadas (`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`).

---

## 🗄️ Esquema de Base de Datos PostgreSQL 18

El archivo `server/sql/schema.sql` crea automáticamente las siguientes tablas:

1. **Catálogos y Parámetros Maestros**:
   * `usuarios_sistema`: Cuentas de usuario con hash de contraseña y roles.
   * `roles_sistema`: Permisos por rol institucional.
   * `clientes`: Clientes con C.I./RUC, límite de crédito y saldo pendiente.
   * `proveedores`: Proveedores comerciales con datos de contacto y términos de pago.
   * `categorias_productos`: Categorías jerárquicas de ferretería.
   * `unidades_medida`: Unidades oficiales (UND, KG, MTS, etc.).
   * `productos`: Catálogo con código, SKU, código de barras, precios por escala, IVA y stock.

2. **Movimientos y Control de Existencias**:
   * `kardex_movimientos`: Kardex valorado método Promedio Ponderado con entradas, salidas y saldos.
   * `caja_sesiones`: Control de apertura, arqueos, retiros y cierre de caja.

3. **Facturación y Cumplimiento SRI**:
   * `secuenciales_emision`: Control atómico de numeración sin saltos por establecimiento (001) y punto (001 a 004).
   * `facturas_ventas`: Encabezado y detalle de comprobantes (Facturas, Boletas, Cotizaciones).
   * `cola_sri`: Cola transaccional de comprobantes pendientes de firma, recepción y autorización ante el SRI.
   * `certificados_sri`: Registro de certificados de firma electrónica `.p12`.

4. **Contabilidad Formal de Partida Doble**:
   * `plan_cuentas_contable`: Catálogo de cuentas contables reglamentario (Activo, Pasivo, Patrimonio, etc.).
   * `asientos_contables`: Asientos de diario validados matemáticamente (`Debe == Haber`).
   * `periodos_fiscales`: Control de meses fiscales abiertos/cerrados para bloqueo de modificaciones retroactivas.

5. **Auditoría y Estado Reactivo**:
   * `bitacora_auditoria`: Registro inmutable de eventos sensibles del sistema.
   * `app_state`: Almacén con índice GIN para sincronización rápida multi-terminal.

---

## 🌐 Endpoints de la API Express

Todos los endpoints están disponibles bajo el prefijo `/api`:

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Inicio de sesión con validación de credenciales (Bcrypt) y entrega de JWT. |
| `GET` | `/api/health` | Estado de salud del servidor y marca de tiempo. |
| `GET` | `/api/invoices` | Listado de comprobantes y facturas emitidas. |
| `POST` | `/api/invoices` | Creación y persistencia transaccional de factura. |
| `POST` | `/api/invoices/reserve-sequential` | Reserva atómica del siguiente número secuencial SRI sin saltos. |
| `GET` | `/api/invoices/emission-points` | Estado y numeración de los 4 puntos de emisión. |
| `GET` | `/api/products` | Catálogo de productos con precios y stock. |
| `GET` | `/api/customers` | Consulta y búsqueda de clientes por identificación. |
| `GET` | `/api/postgres/status` | Diagnóstico de conexión en vivo con PostgreSQL 18. |
| `GET` | `/api/postgres/events` | Canal de eventos Server-Sent Events (SSE) para sincronización LAN en tiempo real. |
| `GET` | `/api/postgres/doc/:docId` | Lectura reactiva de colecciones/tablas. |
| `POST` | `/api/postgres/doc/:docId` | Escritura reactiva atómica en tablas de PostgreSQL. |
| `POST` | `/api/postgres/sync-all` | Sincronización masiva de todas las secciones del ERP hacia PostgreSQL. |
| `GET` | `/api/postgres/pull-all` | Descarga masiva del estado completo de la base de datos. |
| `GET` | `/api/sri/cola` | Bandeja de comprobantes en cola de procesamiento SRI. |
| `POST` | `/api/sri/cola/reintentar/:id` | Reintento de autorización de un comprobante devuelto o pendiente. |
| `GET` | `/api/accounting/entries` | Asientos contables con balance de sumas y saldos. |

---

## ⚙️ Guía de Puesta en Marcha

### 1. Configurar Credenciales en `.env`
Edita el archivo [.env](file:///c:/Users/Alex%20Palma/Downloads/facturación-ferretería%20(1)/.env) con tu contraseña de PostgreSQL local:

```ini
PORT=5000
PGHOST="127.0.0.1"
PGPORT="5432"
PGUSER="postgres"
PGPASSWORD="tu_password_aqui"
PGDATABASE="ferreteria_daynet"
DATABASE_URL="postgresql://postgres:tu_password_aqui@127.0.0.1:5432/ferreteria_daynet"
JWT_SECRET="ferreteria_daynet_secret_jwt_token_2026"
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:5000,http://127.0.0.1:3000,http://127.0.0.1:5000"
```

### 2. Inicializar la Base de Datos
Ejecuta el script automatizado para crear la base de datos `ferreteria_daynet` y aplicar el esquema de tablas:
```bash
npm run init:pg
```

### 3. Ejecutar en Modo Desarrollo
Inicia tanto el servidor Express (puerto 5000) como la interfaz Vite (puerto 3000) concurrentemente:
```bash
npm run dev
```
Abre en tu navegador: `http://localhost:3000`

### 4. Compilar y Ejecutar en Modo Producción
Para un despliegue institucional monolítico:
```bash
npm run build
npm start
```
Abre en tu navegador: `http://localhost:5000` (el servidor Express sirve directamente la aplicación React optimizada).

---

## 🔎 Inspección Visual con pgAdmin 4 o DBeaver

Para explorar directamente tus tablas relacionales:

1. Abre **pgAdmin 4** o **DBeaver** en tu computadora.
2. Crea una nueva conexión con:
   * **Host:** `127.0.0.1`
   * **Port:** `5432`
   * **Database:** `ferreteria_daynet`
   * **Username:** `postgres`
   * **Password:** *Tu contraseña configurada en `.env`*
3. En el árbol de navegación ve a: `Databases ➔ ferreteria_daynet ➔ Schemas ➔ public ➔ Tables`.
4. ¡Listo! Podrás visualizar y consultar en tiempo real tablas como:
   * `SELECT * FROM facturas_ventas;`
   * `SELECT * FROM productos;`
   * `SELECT * FROM kardex_movimientos;`
   * `SELECT * FROM asientos_contables;`
   * `SELECT * FROM cola_sri;`
