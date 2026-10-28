-- =========================================================================
-- ESQUEMA RELACIONAL INSTITUCIONAL SQLITE - ERP D-FERRETERÍA
-- Diseñado para control de concurrencia, integridad referencial y portabilidad 100% offline
-- =========================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- 1. ESQUEMA DE SEGURIDAD Y USUARIOS
CREATE TABLE IF NOT EXISTS roles_sistema (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    permissions TEXT DEFAULT '[]',
    data TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS usuarios_sistema (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'Cajero' REFERENCES roles_sistema(name) ON UPDATE CASCADE ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'Activo' CHECK (status IN ('Activo', 'Inactivo', 'Suspendido')),
    password TEXT NOT NULL,
    data TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios_sistema(username);

-- 2. CLIENTES Y PROVEEDORES
CREATE TABLE IF NOT EXISTS clientes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tax_id TEXT UNIQUE,
    doc_type TEXT DEFAULT 'C.I.',
    email TEXT,
    phone TEXT,
    address TEXT,
    current_debt REAL DEFAULT 0.00 CHECK (current_debt >= 0),
    credit_limit REAL DEFAULT 0.00 CHECK (credit_limit >= 0),
    data TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_clientes_tax_id ON clientes(tax_id);

CREATE TABLE IF NOT EXISTS proveedores (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tax_id TEXT UNIQUE,
    email TEXT,
    phone TEXT,
    address TEXT,
    contact_person TEXT,
    data TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_proveedores_tax_id ON proveedores(tax_id);

-- 3. PRODUCTOS E INVENTARIO
CREATE TABLE IF NOT EXISTS categorias_productos (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    data TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS unidades_medida (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    abbreviation TEXT NOT NULL,
    data TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS productos (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE,
    sku TEXT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    unit TEXT DEFAULT 'UND',
    cost_price REAL DEFAULT 0.0000 CHECK (cost_price >= 0),
    sale_price REAL NOT NULL DEFAULT 0.0000 CHECK (sale_price >= 0),
    stock REAL NOT NULL DEFAULT 0.00,
    min_stock REAL DEFAULT 5.00 CHECK (min_stock >= 0),
    has_iva INTEGER DEFAULT 1,
    iva_rate REAL DEFAULT 15.00 CHECK (iva_rate >= 0),
    status TEXT DEFAULT 'Activo' CHECK (status IN ('Activo', 'Inactivo', 'Agotado', 'Descontinuado')),
    data TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_productos_code ON productos(code);
CREATE INDEX IF NOT EXISTS idx_productos_name ON productos(name);

CREATE TABLE IF NOT EXISTS kardex_movimientos (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    product_name TEXT NOT NULL,
    date TEXT DEFAULT (datetime('now', 'localtime')),
    type TEXT NOT NULL CHECK (type IN ('INGRESO', 'EGRESO', 'AJUSTE', 'VENTA', 'COMPRA', 'DEVOLUCION')),
    reason TEXT,
    quantity REAL NOT NULL CHECK (quantity != 0),
    cost_unit REAL NOT NULL CHECK (cost_unit >= 0),
    total_cost REAL NOT NULL CHECK (total_cost >= 0),
    stock_balance REAL NOT NULL,
    document_ref TEXT,
    user_id TEXT REFERENCES usuarios_sistema(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_kardex_product ON kardex_movimientos(product_id);
CREATE INDEX IF NOT EXISTS idx_kardex_date ON kardex_movimientos(date);

-- 4. CONTROL DE CONCURRENCIA: SECUENCIALES ATÓMICOS POR ESTABLECIMIENTO Y PUNTO
CREATE TABLE IF NOT EXISTS secuenciales_emision (
    id TEXT PRIMARY KEY, -- formato: 001-001-01
    establishment TEXT NOT NULL,
    emission_point TEXT NOT NULL,
    document_type TEXT NOT NULL, -- 01 = Factura, 04 = Nota Credito, 07 = Retencion
    name TEXT,
    current_sequential INTEGER NOT NULL DEFAULT 0 CHECK (current_sequential >= 0),
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    CONSTRAINT uq_secuenciales_establecimiento_pto_doc UNIQUE (establishment, emission_point, document_type)
);

-- 5. CONTABILIDAD FORMAL CON PARTIDA DOBLE Y CIERRE
CREATE TABLE IF NOT EXISTS plan_cuentas_contable (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- ACTIVO, PASIVO, PATRIMONIO, INGRESO, GASTO
    level INTEGER NOT NULL DEFAULT 1,
    parent_code TEXT,
    balance REAL DEFAULT 0.00,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS asientos_contables (
    id TEXT PRIMARY KEY,
    entry_number TEXT UNIQUE NOT NULL, -- ASI-2026-0001
    date TEXT NOT NULL,
    concept TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'DIARIO' CHECK (type IN ('INGRESO', 'EGRESO', 'DIARIO', 'AJUSTE', 'CIERRE')),
    document_reference TEXT,
    total_debit REAL NOT NULL CHECK (total_debit >= 0),
    total_credit REAL NOT NULL CHECK (total_credit >= 0),
    is_balanced INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'ASENTADO' CHECK (status IN ('ASENTADO', 'ANULADO', 'BORRADOR')),
    items TEXT NOT NULL DEFAULT '[]',
    data TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    created_by TEXT REFERENCES usuarios_sistema(id) ON DELETE SET NULL,
    CONSTRAINT chk_asientos_balance CHECK (abs(total_debit - total_credit) <= 0.01)
);

CREATE INDEX IF NOT EXISTS idx_asientos_date ON asientos_contables(date);
CREATE INDEX IF NOT EXISTS idx_asientos_number ON asientos_contables(entry_number);

-- 5.1 LÍNEAS RELACIONALES NORMALIZADAS DE ASIENTOS CONTABLES
CREATE TABLE IF NOT EXISTS asiento_lineas (
    id TEXT PRIMARY KEY,
    asiento_id TEXT NOT NULL REFERENCES asientos_contables(id) ON DELETE CASCADE,
    account_id TEXT REFERENCES plan_cuentas_contable(id) ON DELETE RESTRICT,
    account_code TEXT NOT NULL,
    account_name TEXT NOT NULL,
    concept TEXT,
    debit REAL NOT NULL DEFAULT 0.00 CHECK (debit >= 0),
    credit REAL NOT NULL DEFAULT 0.00 CHECK (credit >= 0),
    data TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    CONSTRAINT chk_debit_or_credit CHECK (debit > 0 OR credit > 0)
);

CREATE INDEX IF NOT EXISTS idx_asiento_lineas_asiento ON asiento_lineas(asiento_id);
CREATE INDEX IF NOT EXISTS idx_asiento_lineas_cuenta ON asiento_lineas(account_id);
CREATE INDEX IF NOT EXISTS idx_asiento_lineas_code ON asiento_lineas(account_code);

CREATE TABLE IF NOT EXISTS periodos_fiscales (
    id TEXT PRIMARY KEY, -- formato: 2026-09
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'ABIERTO' CHECK (status IN ('ABIERTO', 'CERRADO')),
    closed_at TEXT,
    closed_by TEXT REFERENCES usuarios_sistema(id) ON DELETE SET NULL,
    notes TEXT
);

-- 6. FACTURACIÓN Y VENTAS
CREATE TABLE IF NOT EXISTS facturas_ventas (
    id TEXT PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL, -- 001-001-000000001
    establishment TEXT NOT NULL,
    emission_point TEXT NOT NULL,
    sequential INTEGER NOT NULL,
    date TEXT DEFAULT (datetime('now', 'localtime')),
    customer_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT,
    customer_name TEXT NOT NULL,
    customer_tax_id TEXT NOT NULL,
    seller TEXT,
    subtotal REAL NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    tax REAL NOT NULL DEFAULT 0.00 CHECK (tax >= 0),
    discount REAL DEFAULT 0.00 CHECK (discount >= 0),
    total REAL NOT NULL DEFAULT 0.00 CHECK (total >= 0),
    payment_method TEXT DEFAULT 'EFECTIVO',
    status TEXT NOT NULL DEFAULT 'EMITIDA' CHECK (status IN ('EMITIDA', 'AUTORIZADO', 'ANULADA', 'PENDIENTE', 'RECHAZADA')),
    sri_status TEXT DEFAULT 'PENDIENTE' CHECK (sri_status IN ('PENDIENTE', 'EN_COLA', 'FIRMADO', 'RECIBIDA', 'EN_PROCESO', 'AUTORIZADO', 'DEVUELTA', 'NO AUTORIZADO', 'ERROR')),
    access_key TEXT UNIQUE,
    authorization_number TEXT,
    authorization_date TEXT,
    items TEXT NOT NULL DEFAULT '[]',
    journal_entry_id TEXT REFERENCES asientos_contables(id) ON DELETE SET NULL,
    data TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_facturas_number ON facturas_ventas(invoice_number);
CREATE INDEX IF NOT EXISTS idx_facturas_access_key ON facturas_ventas(access_key);
CREATE INDEX IF NOT EXISTS idx_facturas_date ON facturas_ventas(date);
CREATE INDEX IF NOT EXISTS idx_facturas_customer ON facturas_ventas(customer_id);

-- 6.1 DETALLE RELACIONAL NORMALIZADO DE FACTURAS
CREATE TABLE IF NOT EXISTS factura_detalles (
    id TEXT PRIMARY KEY,
    factura_id TEXT NOT NULL REFERENCES facturas_ventas(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES productos(id) ON DELETE RESTRICT,
    codigo TEXT,
    descripcion TEXT NOT NULL,
    cantidad REAL NOT NULL CHECK (cantidad > 0),
    precio_unitario REAL NOT NULL CHECK (precio_unitario >= 0),
    descuento REAL NOT NULL DEFAULT 0.00 CHECK (descuento >= 0),
    subtotal REAL NOT NULL CHECK (subtotal >= 0),
    has_iva INTEGER DEFAULT 1,
    iva_rate REAL DEFAULT 15.00 CHECK (iva_rate >= 0),
    iva_valor REAL DEFAULT 0.00 CHECK (iva_valor >= 0),
    total REAL NOT NULL CHECK (total >= 0),
    data TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_factura_detalles_factura ON factura_detalles(factura_id);
CREATE INDEX IF NOT EXISTS idx_factura_detalles_producto ON factura_detalles(product_id);

-- 7. NOTAS DE CRÉDITO RELACIONALES
CREATE TABLE IF NOT EXISTS notas_credito (
    id TEXT PRIMARY KEY,
    credit_note_number TEXT UNIQUE NOT NULL,
    establishment TEXT NOT NULL,
    emission_point TEXT NOT NULL,
    sequential INTEGER NOT NULL,
    date TEXT DEFAULT (datetime('now', 'localtime')),
    invoice_id TEXT REFERENCES facturas_ventas(id) ON DELETE RESTRICT,
    invoice_number TEXT NOT NULL,
    customer_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT,
    customer_name TEXT NOT NULL,
    customer_tax_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    subtotal REAL NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    tax REAL NOT NULL DEFAULT 0.00 CHECK (tax >= 0),
    total REAL NOT NULL DEFAULT 0.00 CHECK (total >= 0),
    status TEXT NOT NULL DEFAULT 'EMITIDA' CHECK (status IN ('EMITIDA', 'AUTORIZADO', 'ANULADA', 'PENDIENTE')),
    sri_status TEXT DEFAULT 'PENDIENTE',
    access_key TEXT UNIQUE,
    authorization_number TEXT,
    items TEXT NOT NULL DEFAULT '[]',
    data TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_nc_number ON notas_credito(credit_note_number);
CREATE INDEX IF NOT EXISTS idx_nc_customer ON notas_credito(customer_id);
CREATE INDEX IF NOT EXISTS idx_nc_invoice ON notas_credito(invoice_id);

-- 8. COTIZACIONES Y PEDIDOS RELACIONALES
CREATE TABLE IF NOT EXISTS cotizaciones_pedidos (
    id TEXT PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL DEFAULT 'COTIZACION' CHECK (type IN ('COTIZACION', 'PEDIDO')),
    date TEXT DEFAULT (datetime('now', 'localtime')),
    valid_until TEXT,
    customer_id TEXT REFERENCES clientes(id) ON DELETE RESTRICT,
    customer_name TEXT NOT NULL,
    customer_tax_id TEXT NOT NULL,
    seller TEXT,
    subtotal REAL NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    tax REAL NOT NULL DEFAULT 0.00 CHECK (tax >= 0),
    discount REAL DEFAULT 0.00 CHECK (discount >= 0),
    total REAL NOT NULL DEFAULT 0.00 CHECK (total >= 0),
    status TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (status IN ('PENDIENTE', 'APROBADO', 'FACTURADO', 'RECHAZADO', 'VENCIDO')),
    invoiced_id TEXT REFERENCES facturas_ventas(id) ON DELETE SET NULL,
    items TEXT NOT NULL DEFAULT '[]',
    notes TEXT,
    data TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_order_number ON cotizaciones_pedidos(order_number);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_customer ON cotizaciones_pedidos(customer_id);

-- 9. RECURSOS HUMANOS: EMPLEADOS
CREATE TABLE IF NOT EXISTS empleados (
    id TEXT PRIMARY KEY,
    identification TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    department TEXT DEFAULT 'General',
    position TEXT DEFAULT 'Empleado',
    salary REAL NOT NULL DEFAULT 0.00 CHECK (salary >= 0),
    hire_date TEXT,
    status TEXT NOT NULL DEFAULT 'Activo' CHECK (status IN ('Activo', 'Inactivo', 'Vacaciones', 'Liquidado')),
    data TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_empleados_ident ON empleados(identification);

-- 10. PROMOCIONES RELACIONALES
CREATE TABLE IF NOT EXISTS promociones (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    discount_type TEXT NOT NULL DEFAULT 'PORCENTAJE' CHECK (discount_type IN ('PORCENTAJE', 'MONTO_FIJO', '2X1', 'COMBO')),
    discount_value REAL NOT NULL DEFAULT 0.00 CHECK (discount_value >= 0),
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    min_purchase_amount REAL DEFAULT 0.00 CHECK (min_purchase_amount >= 0),
    applicable_category TEXT,
    applicable_product_id TEXT REFERENCES productos(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'Activo' CHECK (status IN ('Activo', 'Inactivo', 'Vencido')),
    data TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_promociones_code ON promociones(code);

-- 11. COLA SRI Y SERVICIO DE FIRMA
CREATE TABLE IF NOT EXISTS cola_sri (
    id TEXT PRIMARY KEY, -- QUEUE-{claveAcceso}
    invoice_id TEXT NOT NULL,
    invoice_number TEXT NOT NULL,
    establishment TEXT DEFAULT '001',
    emission_point TEXT DEFAULT '001',
    clave_acceso TEXT UNIQUE NOT NULL,
    customer_name TEXT,
    customer_tax_id TEXT,
    total REAL DEFAULT 0.00,
    estado TEXT NOT NULL DEFAULT 'EN_COLA' CHECK (estado IN ('EN_COLA', 'FIRMADO', 'RECIBIDA', 'EN_PROCESO', 'AUTORIZADO', 'DEVUELTA', 'ERROR', 'NO AUTORIZADO')),
    reintentos INTEGER NOT NULL DEFAULT 0 CHECK (reintentos >= 0),
    max_reintentos INTEGER NOT NULL DEFAULT 20,
    fecha_creacion TEXT DEFAULT (datetime('now', 'localtime')),
    fecha_ultimo_intento TEXT,
    numero_autorizacion TEXT,
    fecha_autorizacion TEXT,
    mensajes_sri TEXT,
    ultimo_error TEXT,
    xml_original TEXT,
    xml_firmado TEXT,
    data TEXT DEFAULT '{}',
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_cola_sri_estado ON cola_sri(estado);
CREATE INDEX IF NOT EXISTS idx_cola_sri_clave ON cola_sri(clave_acceso);

CREATE TABLE IF NOT EXISTS certificados_sri (
    id TEXT PRIMARY KEY DEFAULT 'active_certificate',
    p12_base64 TEXT NOT NULL,
    encrypted_password TEXT NOT NULL,
    iv TEXT NOT NULL,
    environment TEXT DEFAULT 'PRUEBAS',
    status TEXT DEFAULT 'ACTIVO',
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_by TEXT,
    file_name TEXT,
    file_size TEXT
);

-- 12. CAJA Y SESIONES DE CAJEROS (UNIFICADA)
CREATE TABLE IF NOT EXISTS sesiones_caja (
    id TEXT PRIMARY KEY,
    cashier_id TEXT REFERENCES usuarios_sistema(id) ON DELETE SET NULL,
    cashier_name TEXT NOT NULL,
    emission_point TEXT NOT NULL DEFAULT '001',
    opening_time TEXT DEFAULT (datetime('now', 'localtime')),
    closing_time TEXT,
    opening_cash REAL DEFAULT 0.00 CHECK (opening_cash >= 0),
    total_sales_cash REAL DEFAULT 0.00 CHECK (total_sales_cash >= 0),
    total_sales_transfer REAL DEFAULT 0.00 CHECK (total_sales_transfer >= 0),
    total_sales_card REAL DEFAULT 0.00 CHECK (total_sales_card >= 0),
    total_sales_credit REAL DEFAULT 0.00 CHECK (total_sales_credit >= 0),
    expected_cash REAL DEFAULT 0.00 CHECK (expected_cash >= 0),
    actual_cash REAL DEFAULT 0.00,
    difference REAL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'ABIERTA' CHECK (status IN ('ABIERTA', 'CERRADA')),
    total_invoices_count INTEGER DEFAULT 0,
    data TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

DROP VIEW IF EXISTS caja_sesiones;
CREATE VIEW IF NOT EXISTS caja_sesiones AS 
SELECT * FROM sesiones_caja;

-- 13. AUDITORÍA INMUTABLE Y REPORTES DE MIGRACIÓN
CREATE TABLE IF NOT EXISTS bitacora_auditoria (
    id TEXT PRIMARY KEY,
    timestamp TEXT DEFAULT (datetime('now', 'localtime')),
    user_id TEXT REFERENCES usuarios_sistema(id) ON DELETE SET NULL,
    username TEXT NOT NULL,
    role TEXT,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    emission_point TEXT,
    terminal TEXT,
    ip TEXT,
    details TEXT,
    data TEXT DEFAULT '{}',
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_auditoria_timestamp ON bitacora_auditoria(timestamp);
CREATE INDEX IF NOT EXISTS idx_auditoria_action ON bitacora_auditoria(action);

CREATE TABLE IF NOT EXISTS reportes_migracion (
    id TEXT PRIMARY KEY,
    timestamp TEXT DEFAULT (datetime('now', 'localtime')),
    executed_by TEXT NOT NULL,
    database TEXT NOT NULL,
    total_analyzed INTEGER NOT NULL,
    total_migrated INTEGER NOT NULL,
    total_issues INTEGER NOT NULL,
    report_data TEXT NOT NULL
);

-- 14. PARÁMETROS DEL SISTEMA VS APP_STATE REACTIVO
CREATE TABLE IF NOT EXISTS configuracion_parametros (
    id TEXT PRIMARY KEY,
    param_key TEXT UNIQUE,
    param_value TEXT,
    category TEXT DEFAULT 'GENERAL',
    description TEXT,
    data TEXT DEFAULT '{}',
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_config_param_key ON configuracion_parametros(param_key);

CREATE TABLE IF NOT EXISTS configuracion_empresa (
    id TEXT PRIMARY KEY DEFAULT 'empresa_principal',
    ruc TEXT NOT NULL,
    razon_social TEXT NOT NULL,
    nombre_comercial TEXT,
    direccion_matriz TEXT NOT NULL,
    direccion_establecimiento TEXT,
    contribuyente_especial TEXT,
    regimen_rimpe TEXT,
    data TEXT DEFAULT '{}',
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Estado de UI de cliente reactivo
CREATE TABLE IF NOT EXISTS app_state (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 15. AJUSTES DE STOCK Y TOMA FÍSICA
CREATE TABLE IF NOT EXISTS ajustes_inventario (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    sku TEXT,
    qty REAL NOT NULL,
    reason TEXT,
    user_name TEXT DEFAULT 'Administrador',
    cost_price REAL DEFAULT 0.00,
    type TEXT DEFAULT 'AJUSTE',
    date TEXT DEFAULT (datetime('now', 'localtime')),
    data TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_ajustes_product ON ajustes_inventario(product_id);
CREATE INDEX IF NOT EXISTS idx_ajustes_date ON ajustes_inventario(date);
