-- =========================================================================
-- ESQUEMA RELACIONAL INSTITUCIONAL POSTGRESQL - ERP
-- Diseñado para control de concurrencia, integridad referencial y auditoría
-- =========================================================================

-- Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ESQUEMA DE SEGURIDAD Y USUARIOS
CREATE TABLE IF NOT EXISTS roles_sistema (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuarios_sistema (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(150),
    role VARCHAR(50) NOT NULL DEFAULT 'Cajero',
    status VARCHAR(20) NOT NULL DEFAULT 'Activo',
    password VARCHAR(255) NOT NULL,
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
    current_debt NUMERIC(14, 2) DEFAULT 0.00,
    credit_limit NUMERIC(14, 2) DEFAULT 0.00,
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proveedores_tax_id ON proveedores(tax_id);

-- 3. PRODUCTOS E INVENTARIO
CREATE TABLE IF NOT EXISTS categorias_productos (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS unidades_medida (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    abbreviation VARCHAR(10) NOT NULL
);

CREATE TABLE IF NOT EXISTS productos (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(50) UNIQUE,
    sku VARCHAR(50),
    name VARCHAR(250) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    unit VARCHAR(30) DEFAULT 'UND',
    cost_price NUMERIC(14, 4) DEFAULT 0.0000,
    sale_price NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    stock NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    min_stock NUMERIC(14, 2) DEFAULT 5.00,
    has_iva BOOLEAN DEFAULT true,
    iva_rate NUMERIC(5, 2) DEFAULT 15.00,
    status VARCHAR(20) DEFAULT 'Activo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_productos_code ON productos(code);
CREATE INDEX IF NOT EXISTS idx_productos_name ON productos(name);

CREATE TABLE IF NOT EXISTS kardex_movimientos (
    id VARCHAR(50) PRIMARY KEY,
    product_id VARCHAR(50) NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    product_name VARCHAR(250) NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    type VARCHAR(30) NOT NULL, -- INGRESO, EGRESO, AJUSTE, VENTA, COMPRA
    reason TEXT,
    quantity NUMERIC(14, 2) NOT NULL,
    cost_unit NUMERIC(14, 4) NOT NULL,
    total_cost NUMERIC(14, 4) NOT NULL,
    stock_balance NUMERIC(14, 2) NOT NULL,
    document_ref VARCHAR(100),
    user_id VARCHAR(50),
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
    current_sequential INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. FACTURACIÓN Y VENTAS
CREATE TABLE IF NOT EXISTS facturas_ventas (
    id VARCHAR(50) PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL, -- 001-001-000000001
    establishment VARCHAR(3) NOT NULL,
    emission_point VARCHAR(3) NOT NULL,
    sequential INT NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    customer_id VARCHAR(50),
    customer_name VARCHAR(200) NOT NULL,
    customer_tax_id VARCHAR(20) NOT NULL,
    seller VARCHAR(100),
    subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    tax NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(14, 2) DEFAULT 0.00,
    total NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(50) DEFAULT 'EFECTIVO',
    status VARCHAR(30) NOT NULL DEFAULT 'EMITIDA', -- EMITIDA, AUTORIZADO, ANULADA
    sri_status VARCHAR(30) DEFAULT 'PENDIENTE',
    access_key VARCHAR(49) UNIQUE,
    authorization_number VARCHAR(60),
    authorization_date TIMESTAMP WITH TIME ZONE,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    journal_entry_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_facturas_number ON facturas_ventas(invoice_number);
CREATE INDEX IF NOT EXISTS idx_facturas_access_key ON facturas_ventas(access_key);
CREATE INDEX IF NOT EXISTS idx_facturas_date ON facturas_ventas(date);

-- 6. COLA SRI Y SERVICIO DE FIRMA (Requerimiento TdR Facturación Asíncrona)
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
    estado VARCHAR(30) NOT NULL DEFAULT 'EN_COLA', -- EN_COLA, FIRMADO, RECIBIDA, EN_PROCESO, AUTORIZADO, DEVUELTA, ERROR
    reintentos INT NOT NULL DEFAULT 0,
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

-- 7. CONTABILIDAD FORMAL CON PARTIDA DOBLE Y CIERRE
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
    type VARCHAR(20) NOT NULL DEFAULT 'DIARIO', -- INGRESO, EGRESO, DIARIO, AJUSTE
    document_reference VARCHAR(100),
    total_debit NUMERIC(14, 2) NOT NULL,
    total_credit NUMERIC(14, 2) NOT NULL,
    is_balanced BOOLEAN NOT NULL DEFAULT true,
    status VARCHAR(20) NOT NULL DEFAULT 'ASENTADO', -- ASENTADO, ANULADO
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_asientos_date ON asientos_contables(date);
CREATE INDEX IF NOT EXISTS idx_asientos_number ON asientos_contables(entry_number);

CREATE TABLE IF NOT EXISTS periodos_fiscales (
    id VARCHAR(50) PRIMARY KEY, -- formato: 2026-09
    year INT NOT NULL,
    month INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ABIERTO', -- ABIERTO, CERRADO
    closed_at TIMESTAMP WITH TIME ZONE,
    closed_by VARCHAR(50),
    notes TEXT
);

-- 8. CAJA Y SESIONES DE CAJEROS
CREATE TABLE IF NOT EXISTS sesiones_caja (
    id VARCHAR(50) PRIMARY KEY,
    cashier_id VARCHAR(50),
    cashier_name VARCHAR(150) NOT NULL,
    emission_point VARCHAR(3) NOT NULL DEFAULT '001',
    opening_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    closing_time TIMESTAMP WITH TIME ZONE,
    opening_cash NUMERIC(14, 2) DEFAULT 0.00,
    total_sales_cash NUMERIC(14, 2) DEFAULT 0.00,
    total_sales_transfer NUMERIC(14, 2) DEFAULT 0.00,
    total_sales_card NUMERIC(14, 2) DEFAULT 0.00,
    total_sales_credit NUMERIC(14, 2) DEFAULT 0.00,
    expected_cash NUMERIC(14, 2) DEFAULT 0.00,
    actual_cash NUMERIC(14, 2) DEFAULT 0.00,
    difference NUMERIC(14, 2) DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'ABIERTA', -- ABIERTA, CERRADA
    total_invoices_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. AUDITORÍA INMUTABLE Y REPORTES DE MIGRACIÓN
CREATE TABLE IF NOT EXISTS bitacora_auditoria (
    id VARCHAR(50) PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(50),
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

-- 10. TABLA COMPATIBLE APP_STATE PARA SINCRONIZACIÓN REACTIVA JSONB
-- Permite almacenar configuraciones y estados de UI en PostgreSQL nativo con indexación GIN
CREATE TABLE IF NOT EXISTS app_state (
    id VARCHAR(150) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_app_state_data_gin ON app_state USING GIN(data);
