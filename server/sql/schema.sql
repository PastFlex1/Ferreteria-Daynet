-- =========================================================================
-- ESQUEMA RELACIONAL INSTITUCIONAL POSTGRESQL - ERP D-FERRETERÍA
-- Diseñado para control de concurrencia, integridad referencial y auditoría
-- =========================================================================

-- Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ESQUEMA DE SEGURIDAD Y USUARIOS
CREATE TABLE IF NOT EXISTS roles_sistema (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]'::jsonb,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuarios_sistema (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(150),
    role VARCHAR(100) NOT NULL DEFAULT 'Cajero' REFERENCES roles_sistema(name) ON UPDATE CASCADE ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'Activo' CHECK (status IN ('Activo', 'Inactivo', 'Suspendido')),
    password VARCHAR(255) NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios_sistema(username);

-- 2. CLIENTES Y PROVEEDORES
CREATE TABLE IF NOT EXISTS clientes (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    tax_id VARCHAR(20) UNIQUE,
    doc_type VARCHAR(20) DEFAULT 'C.I.',
    email VARCHAR(150),
    phone VARCHAR(50),
    address TEXT,
    current_debt NUMERIC(14, 2) DEFAULT 0.00 CHECK (current_debt >= 0),
    credit_limit NUMERIC(14, 2) DEFAULT 0.00 CHECK (credit_limit >= 0),
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clientes_tax_id ON clientes(tax_id);

CREATE TABLE IF NOT EXISTS proveedores (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    tax_id VARCHAR(20) UNIQUE,
    email VARCHAR(150),
    phone VARCHAR(50),
    address TEXT,
    contact_person VARCHAR(150),
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proveedores_tax_id ON proveedores(tax_id);

-- 3. PRODUCTOS E INVENTARIO
CREATE TABLE IF NOT EXISTS categorias_productos (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS unidades_medida (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    abbreviation VARCHAR(10) NOT NULL,
    data JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS productos (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(50) UNIQUE,
    sku VARCHAR(50),
    name VARCHAR(250) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    unit VARCHAR(30) DEFAULT 'UND',
    cost_price NUMERIC(14, 4) DEFAULT 0.0000 CHECK (cost_price >= 0),
    sale_price NUMERIC(14, 4) NOT NULL DEFAULT 0.0000 CHECK (sale_price >= 0),
    stock NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (stock >= 0),
    min_stock NUMERIC(14, 2) DEFAULT 5.00 CHECK (min_stock >= 0),
    has_iva BOOLEAN DEFAULT true,
    iva_rate NUMERIC(5, 2) DEFAULT 15.00 CHECK (iva_rate >= 0),
    status VARCHAR(20) DEFAULT 'Activo' CHECK (status IN ('Activo', 'Inactivo', 'Agotado', 'Descontinuado')),
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_productos_code ON productos(code);
CREATE INDEX IF NOT EXISTS idx_productos_name ON productos(name);

CREATE TABLE IF NOT EXISTS kardex_movimientos (
    id VARCHAR(50) PRIMARY KEY,
    product_id VARCHAR(50) NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    product_name VARCHAR(250) NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    type VARCHAR(30) NOT NULL CHECK (type IN ('INGRESO', 'EGRESO', 'AJUSTE', 'VENTA', 'COMPRA', 'DEVOLUCION')),
    reason TEXT,
    quantity NUMERIC(14, 2) NOT NULL CHECK (quantity != 0),
    cost_unit NUMERIC(14, 4) NOT NULL CHECK (cost_unit >= 0),
    total_cost NUMERIC(14, 4) NOT NULL CHECK (total_cost >= 0),
    stock_balance NUMERIC(14, 2) NOT NULL CHECK (stock_balance >= 0),
    document_ref VARCHAR(100),
    user_id VARCHAR(50) REFERENCES usuarios_sistema(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kardex_product ON kardex_movimientos(product_id);
CREATE INDEX IF NOT EXISTS idx_kardex_date ON kardex_movimientos(date);

-- 4. CONTROL DE CONCURRENCIA: SECUENCIALES ATÓMICOS POR ESTABLECIMIENTO Y PUNTO
CREATE TABLE IF NOT EXISTS secuenciales_emision (
    id VARCHAR(50) PRIMARY KEY, -- formato: 001-001-01
    establishment VARCHAR(3) NOT NULL,
    emission_point VARCHAR(3) NOT NULL,
    document_type VARCHAR(10) NOT NULL, -- 01 = Factura, 04 = Nota Credito, 07 = Retencion
    name VARCHAR(100),
    current_sequential INT NOT NULL DEFAULT 0 CHECK (current_sequential >= 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_secuenciales_establecimiento_pto_doc UNIQUE (establishment, emission_point, document_type)
);

-- 5. CONTABILIDAD FORMAL CON PARTIDA DOBLE Y CIERRE
CREATE TABLE IF NOT EXISTS plan_cuentas_contable (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(30) NOT NULL, -- ACTIVO, PASIVO, PATRIMONIO, INGRESO, GASTO
    level INT NOT NULL DEFAULT 1,
    parent_code VARCHAR(30),
    balance NUMERIC(14, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS asientos_contables (
    id VARCHAR(50) PRIMARY KEY,
    entry_number VARCHAR(50) UNIQUE NOT NULL, -- ASI-2026-0001
    date DATE NOT NULL,
    concept TEXT NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'DIARIO' CHECK (type IN ('INGRESO', 'EGRESO', 'DIARIO', 'AJUSTE', 'CIERRE')),
    document_reference VARCHAR(100),
    total_debit NUMERIC(14, 2) NOT NULL CHECK (total_debit >= 0),
    total_credit NUMERIC(14, 2) NOT NULL CHECK (total_credit >= 0),
    is_balanced BOOLEAN NOT NULL DEFAULT true,
    status VARCHAR(20) NOT NULL DEFAULT 'ASENTADO' CHECK (status IN ('ASENTADO', 'ANULADO', 'BORRADOR')),
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50) REFERENCES usuarios_sistema(id) ON DELETE SET NULL,
    CONSTRAINT chk_asientos_balance CHECK (ABS(total_debit - total_credit) <= 0.01)
);

CREATE INDEX IF NOT EXISTS idx_asientos_date ON asientos_contables(date);
CREATE INDEX IF NOT EXISTS idx_asientos_number ON asientos_contables(entry_number);

-- 5.1 LÍNEAS RELACIONALES NORMALIZADAS DE ASIENTOS CONTABLES
CREATE TABLE IF NOT EXISTS asiento_lineas (
    id VARCHAR(50) PRIMARY KEY,
    asiento_id VARCHAR(50) NOT NULL REFERENCES asientos_contables(id) ON DELETE CASCADE,
    account_id VARCHAR(50) REFERENCES plan_cuentas_contable(id) ON DELETE RESTRICT,
    account_code VARCHAR(30) NOT NULL,
    account_name VARCHAR(150) NOT NULL,
    concept TEXT,
    debit NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (debit >= 0),
    credit NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (credit >= 0),
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_debit_or_credit CHECK (debit > 0 OR credit > 0)
);

CREATE INDEX IF NOT EXISTS idx_asiento_lineas_asiento ON asiento_lineas(asiento_id);
CREATE INDEX IF NOT EXISTS idx_asiento_lineas_cuenta ON asiento_lineas(account_id);
CREATE INDEX IF NOT EXISTS idx_asiento_lineas_code ON asiento_lineas(account_code);

CREATE TABLE IF NOT EXISTS periodos_fiscales (
    id VARCHAR(50) PRIMARY KEY, -- formato: 2026-09
    year INT NOT NULL,
    month INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ABIERTO' CHECK (status IN ('ABIERTO', 'CERRADO')),
    closed_at TIMESTAMP WITH TIME ZONE,
    closed_by VARCHAR(50) REFERENCES usuarios_sistema(id) ON DELETE SET NULL,
    notes TEXT
);

-- 6. FACTURACIÓN Y VENTAS
CREATE TABLE IF NOT EXISTS facturas_ventas (
    id VARCHAR(50) PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL, -- 001-001-000000001
    establishment VARCHAR(3) NOT NULL,
    emission_point VARCHAR(3) NOT NULL,
    sequential INT NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    customer_id VARCHAR(50) REFERENCES clientes(id) ON DELETE RESTRICT,
    customer_name VARCHAR(200) NOT NULL,
    customer_tax_id VARCHAR(20) NOT NULL,
    seller VARCHAR(100),
    subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    tax NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (tax >= 0),
    discount NUMERIC(14, 2) DEFAULT 0.00 CHECK (discount >= 0),
    total NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
    payment_method VARCHAR(50) DEFAULT 'EFECTIVO',
    status VARCHAR(30) NOT NULL DEFAULT 'EMITIDA' CHECK (status IN ('EMITIDA', 'AUTORIZADO', 'ANULADA', 'PENDIENTE', 'RECHAZADA')),
    sri_status VARCHAR(30) DEFAULT 'PENDIENTE' CHECK (sri_status IN ('PENDIENTE', 'EN_COLA', 'FIRMADO', 'RECIBIDA', 'EN_PROCESO', 'AUTORIZADO', 'DEVUELTA', 'NO AUTORIZADO', 'ERROR')),
    access_key VARCHAR(49) UNIQUE,
    authorization_number VARCHAR(60),
    authorization_date TIMESTAMP WITH TIME ZONE,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    journal_entry_id VARCHAR(50) REFERENCES asientos_contables(id) ON DELETE SET NULL,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_facturas_number ON facturas_ventas(invoice_number);
CREATE INDEX IF NOT EXISTS idx_facturas_access_key ON facturas_ventas(access_key);
CREATE INDEX IF NOT EXISTS idx_facturas_date ON facturas_ventas(date);
CREATE INDEX IF NOT EXISTS idx_facturas_customer ON facturas_ventas(customer_id);

-- 6.1 DETALLE RELACIONAL NORMALIZADO DE FACTURAS
CREATE TABLE IF NOT EXISTS factura_detalles (
    id VARCHAR(50) PRIMARY KEY,
    factura_id VARCHAR(50) NOT NULL REFERENCES facturas_ventas(id) ON DELETE CASCADE,
    product_id VARCHAR(50) REFERENCES productos(id) ON DELETE RESTRICT,
    codigo VARCHAR(50),
    descripcion VARCHAR(250) NOT NULL,
    cantidad NUMERIC(14, 2) NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(14, 4) NOT NULL CHECK (precio_unitario >= 0),
    descuento NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (descuento >= 0),
    subtotal NUMERIC(14, 2) NOT NULL CHECK (subtotal >= 0),
    has_iva BOOLEAN DEFAULT true,
    iva_rate NUMERIC(5, 2) DEFAULT 15.00 CHECK (iva_rate >= 0),
    iva_valor NUMERIC(14, 2) DEFAULT 0.00 CHECK (iva_valor >= 0),
    total NUMERIC(14, 2) NOT NULL CHECK (total >= 0),
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_factura_detalles_factura ON factura_detalles(factura_id);
CREATE INDEX IF NOT EXISTS idx_factura_detalles_producto ON factura_detalles(product_id);

-- 7. NOTAS DE CRÉDITO RELACIONALES
CREATE TABLE IF NOT EXISTS notas_credito (
    id VARCHAR(50) PRIMARY KEY,
    credit_note_number VARCHAR(50) UNIQUE NOT NULL,
    establishment VARCHAR(3) NOT NULL,
    emission_point VARCHAR(3) NOT NULL,
    sequential INT NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    invoice_id VARCHAR(50) REFERENCES facturas_ventas(id) ON DELETE RESTRICT,
    invoice_number VARCHAR(50) NOT NULL,
    customer_id VARCHAR(50) REFERENCES clientes(id) ON DELETE RESTRICT,
    customer_name VARCHAR(200) NOT NULL,
    customer_tax_id VARCHAR(20) NOT NULL,
    reason TEXT NOT NULL,
    subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    tax NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (tax >= 0),
    total NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'EMITIDA' CHECK (status IN ('EMITIDA', 'AUTORIZADO', 'ANULADA', 'PENDIENTE')),
    sri_status VARCHAR(30) DEFAULT 'PENDIENTE',
    access_key VARCHAR(49) UNIQUE,
    authorization_number VARCHAR(60),
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nc_number ON notas_credito(credit_note_number);
CREATE INDEX IF NOT EXISTS idx_nc_customer ON notas_credito(customer_id);
CREATE INDEX IF NOT EXISTS idx_nc_invoice ON notas_credito(invoice_id);

-- 8. COTIZACIONES Y PEDIDOS RELACIONALES
CREATE TABLE IF NOT EXISTS cotizaciones_pedidos (
    id VARCHAR(50) PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'COTIZACION' CHECK (type IN ('COTIZACION', 'PEDIDO')),
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP WITH TIME ZONE,
    customer_id VARCHAR(50) REFERENCES clientes(id) ON DELETE RESTRICT,
    customer_name VARCHAR(200) NOT NULL,
    customer_tax_id VARCHAR(20) NOT NULL,
    seller VARCHAR(100),
    subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    tax NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (tax >= 0),
    discount NUMERIC(14, 2) DEFAULT 0.00 CHECK (discount >= 0),
    total NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE' CHECK (status IN ('PENDIENTE', 'APROBADO', 'FACTURADO', 'RECHAZADO', 'VENCIDO')),
    invoiced_id VARCHAR(50) REFERENCES facturas_ventas(id) ON DELETE SET NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_order_number ON cotizaciones_pedidos(order_number);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_customer ON cotizaciones_pedidos(customer_id);

-- 9. RECURSOS HUMANOS: EMPLEADOS
CREATE TABLE IF NOT EXISTS empleados (
    id VARCHAR(50) PRIMARY KEY,
    identification VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(150),
    phone VARCHAR(50),
    address TEXT,
    department VARCHAR(100) DEFAULT 'General',
    position VARCHAR(100) DEFAULT 'Empleado',
    salary NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (salary >= 0),
    hire_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'Activo' CHECK (status IN ('Activo', 'Inactivo', 'Vacaciones', 'Liquidado')),
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_empleados_ident ON empleados(identification);

-- 10. PROMOCIONES RELACIONALES
CREATE TABLE IF NOT EXISTS promociones (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(50) UNIQUE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL DEFAULT 'PORCENTAJE' CHECK (discount_type IN ('PORCENTAJE', 'MONTO_FIJO', '2X1', 'COMBO')),
    discount_value NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (discount_value >= 0),
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    min_purchase_amount NUMERIC(14, 2) DEFAULT 0.00 CHECK (min_purchase_amount >= 0),
    applicable_category VARCHAR(100),
    applicable_product_id VARCHAR(50) REFERENCES productos(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Activo' CHECK (status IN ('Activo', 'Inactivo', 'Vencido')),
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_promociones_code ON promociones(code);

-- 11. COLA SRI Y SERVICIO DE FIRMA
CREATE TABLE IF NOT EXISTS cola_sri (
    id VARCHAR(100) PRIMARY KEY, -- QUEUE-{claveAcceso}
    invoice_id VARCHAR(50) NOT NULL,
    invoice_number VARCHAR(50) NOT NULL,
    establishment VARCHAR(3) DEFAULT '001',
    emission_point VARCHAR(3) DEFAULT '001',
    clave_acceso VARCHAR(49) UNIQUE NOT NULL,
    customer_name VARCHAR(200),
    customer_tax_id VARCHAR(20),
    total NUMERIC(14, 2) DEFAULT 0.00,
    estado VARCHAR(30) NOT NULL DEFAULT 'EN_COLA' CHECK (estado IN ('EN_COLA', 'FIRMADO', 'RECIBIDA', 'EN_PROCESO', 'AUTORIZADO', 'DEVUELTA', 'ERROR', 'NO AUTORIZADO')),
    reintentos INT NOT NULL DEFAULT 0 CHECK (reintentos >= 0),
    max_reintentos INT NOT NULL DEFAULT 20,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_ultimo_intento TIMESTAMP WITH TIME ZONE,
    numero_autorizacion VARCHAR(60),
    fecha_autorizacion TIMESTAMP WITH TIME ZONE,
    mensajes_sri JSONB,
    ultimo_error TEXT,
    xml_original TEXT,
    xml_firmado TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cola_sri_estado ON cola_sri(estado);
CREATE INDEX IF NOT EXISTS idx_cola_sri_clave ON cola_sri(clave_acceso);

CREATE TABLE IF NOT EXISTS certificados_sri (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'active_certificate',
    p12_base64 TEXT NOT NULL,
    encrypted_password TEXT NOT NULL,
    iv VARCHAR(64) NOT NULL,
    environment VARCHAR(20) DEFAULT 'PRUEBAS',
    status VARCHAR(20) DEFAULT 'ACTIVO',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(50)
);

-- 12. CAJA Y SESIONES DE CAJEROS (UNIFICADA)
CREATE TABLE IF NOT EXISTS sesiones_caja (
    id VARCHAR(50) PRIMARY KEY,
    cashier_id VARCHAR(50) REFERENCES usuarios_sistema(id) ON DELETE SET NULL,
    cashier_name VARCHAR(150) NOT NULL,
    emission_point VARCHAR(3) NOT NULL DEFAULT '001',
    opening_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    closing_time TIMESTAMP WITH TIME ZONE,
    opening_cash NUMERIC(14, 2) DEFAULT 0.00 CHECK (opening_cash >= 0),
    total_sales_cash NUMERIC(14, 2) DEFAULT 0.00 CHECK (total_sales_cash >= 0),
    total_sales_transfer NUMERIC(14, 2) DEFAULT 0.00 CHECK (total_sales_transfer >= 0),
    total_sales_card NUMERIC(14, 2) DEFAULT 0.00 CHECK (total_sales_card >= 0),
    total_sales_credit NUMERIC(14, 2) DEFAULT 0.00 CHECK (total_sales_credit >= 0),
    expected_cash NUMERIC(14, 2) DEFAULT 0.00 CHECK (expected_cash >= 0),
    actual_cash NUMERIC(14, 2) DEFAULT 0.00,
    difference NUMERIC(14, 2) DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'ABIERTA' CHECK (status IN ('ABIERTA', 'CERRADA')),
    total_invoices_count INT DEFAULT 0,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Vista de compatibilidad para evitar redundancia de caja_sesiones
CREATE OR REPLACE VIEW caja_sesiones AS 
SELECT * FROM sesiones_caja;

-- 13. AUDITORÍA INMUTABLE Y REPORTES DE MIGRACIÓN
CREATE TABLE IF NOT EXISTS bitacora_auditoria (
    id VARCHAR(50) PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(50) REFERENCES usuarios_sistema(id) ON DELETE SET NULL,
    username VARCHAR(50) NOT NULL,
    role VARCHAR(50),
    action VARCHAR(80) NOT NULL,
    entity VARCHAR(80) NOT NULL,
    entity_id VARCHAR(80),
    emission_point VARCHAR(10),
    terminal VARCHAR(50),
    ip VARCHAR(50),
    details JSONB
);

CREATE INDEX IF NOT EXISTS idx_auditoria_timestamp ON bitacora_auditoria(timestamp);
CREATE INDEX IF NOT EXISTS idx_auditoria_action ON bitacora_auditoria(action);

CREATE TABLE IF NOT EXISTS reportes_migracion (
    id VARCHAR(50) PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    executed_by VARCHAR(100) NOT NULL,
    database VARCHAR(50) NOT NULL,
    total_analyzed INT NOT NULL,
    total_migrated INT NOT NULL,
    total_issues INT NOT NULL,
    report_data JSONB NOT NULL
);

-- 14. PARÁMETROS DEL SISTEMA VS APP_STATE REACTIVO
CREATE TABLE IF NOT EXISTS configuracion_parametros (
    id VARCHAR(100) PRIMARY KEY,
    param_key VARCHAR(100) UNIQUE,
    param_value TEXT,
    category VARCHAR(50) DEFAULT 'GENERAL',
    description TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_config_param_key ON configuracion_parametros(param_key);

CREATE TABLE IF NOT EXISTS configuracion_empresa (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'empresa_principal',
    ruc VARCHAR(13) NOT NULL,
    razon_social VARCHAR(250) NOT NULL,
    nombre_comercial VARCHAR(250),
    direccion_matriz TEXT NOT NULL,
    direccion_establecimiento TEXT,
    contribuyente_especial VARCHAR(20),
    obligado_contabilidad BOOLEAN DEFAULT false,
    regimen_rimpe VARCHAR(50),
    data JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Estado de UI de cliente reactivo
CREATE TABLE IF NOT EXISTS app_state (
    id VARCHAR(150) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_app_state_data_gin ON app_state USING GIN(data);
