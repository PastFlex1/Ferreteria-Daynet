import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

async function runMigration() {
  const client = await pool.connect();
  console.log('===============================================================');
  console.log('🚀 INICIANDO REFACTORIZACIÓN INTEGRAL DE ESQUEMA POSTGRESQL');
  console.log('===============================================================\n');

  try {
    await client.query('BEGIN;');

    // -------------------------------------------------------------------------
    // 1. CORRECCIÓN KARDEX: ON DELETE CASCADE -> RESTRICT
    // -------------------------------------------------------------------------
    console.log('[1/5] Corrigiendo integridad en kardex_movimientos (CASCADE -> RESTRICT)...');
    await client.query(`
      ALTER TABLE kardex_movimientos 
      DROP CONSTRAINT IF EXISTS kardex_movimientos_product_id_fkey;
    `);
    await client.query(`
      ALTER TABLE kardex_movimientos 
      ADD CONSTRAINT kardex_movimientos_product_id_fkey 
      FOREIGN KEY (product_id) REFERENCES productos(id) ON DELETE RESTRICT;
    `);
    console.log('  ✓ kardex_movimientos_product_id_fkey configurada como ON DELETE RESTRICT');

    // FK adicional para auditoría de usuario si existe
    await client.query(`
      ALTER TABLE kardex_movimientos 
      DROP CONSTRAINT IF EXISTS fk_kardex_usuario;
    `);
    await client.query(`
      ALTER TABLE kardex_movimientos 
      ADD CONSTRAINT fk_kardex_usuario 
      FOREIGN KEY (user_id) REFERENCES usuarios_sistema(id) ON DELETE SET NULL;
    `);
    console.log('  ✓ kardex_movimientos.user_id enlazado a usuarios_sistema(id)');

    // -------------------------------------------------------------------------
    // 2. CORRECCIÓN SECUENCIALES: UNIQUE (establishment, emission_point, document_type)
    // -------------------------------------------------------------------------
    console.log('\n[2/5] Aplicando UNIQUE y CHECK en secuenciales_emision...');
    await client.query(`
      ALTER TABLE secuenciales_emision 
      DROP CONSTRAINT IF EXISTS uq_secuenciales_establecimiento_pto_doc;
    `);
    await client.query(`
      ALTER TABLE secuenciales_emision 
      ADD CONSTRAINT uq_secuenciales_establecimiento_pto_doc 
      UNIQUE (establishment, emission_point, document_type);
    `);
    await client.query(`
      ALTER TABLE secuenciales_emision 
      DROP CONSTRAINT IF EXISTS chk_secuenciales_positive;
    `);
    await client.query(`
      ALTER TABLE secuenciales_emision 
      ADD CONSTRAINT chk_secuenciales_positive 
      CHECK (current_sequential >= 0);
    `);
    console.log('  ✓ UNIQUE (establishment, emission_point, document_type) aplicado en secuenciales_emision');
    console.log('  ✓ CHECK (current_sequential >= 0) aplicado');

    // -------------------------------------------------------------------------
    // 3. TABLAS DE DETALLES NORMALIZADAS Y LLAVES FORÁNEAS FALTANTES
    // -------------------------------------------------------------------------
    console.log('\n[3/5] Creando tablas de detalle normalizadas y llaves foráneas...');

    // 3.1 Detalle de facturas de venta
    await client.query(`
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
    `);
    console.log('  ✓ Tabla factura_detalles creada con FKs y CHECKs');

    // 3.2 Detalle de asientos contables (líneas de partida doble)
    await client.query(`
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
    `);
    console.log('  ✓ Tabla asiento_lineas creada con FKs y CHECKs');

    // 3.3 FK facturas_ventas.journal_entry_id -> asientos_contables(id)
    await client.query(`
      ALTER TABLE facturas_ventas 
      DROP CONSTRAINT IF EXISTS fk_facturas_journal_entry;
    `);
    await client.query(`
      ALTER TABLE facturas_ventas 
      ADD CONSTRAINT fk_facturas_journal_entry 
      FOREIGN KEY (journal_entry_id) REFERENCES asientos_contables(id) ON DELETE SET NULL;
    `);
    console.log('  ✓ FK facturas_ventas.journal_entry_id -> asientos_contables(id) añadida');

    // 3.4 FK facturas_ventas.customer_id -> clientes(id)
    await client.query(`
      ALTER TABLE facturas_ventas 
      DROP CONSTRAINT IF EXISTS fk_facturas_cliente;
    `);
    await client.query(`
      ALTER TABLE facturas_ventas 
      ADD CONSTRAINT fk_facturas_cliente 
      FOREIGN KEY (customer_id) REFERENCES clientes(id) ON DELETE RESTRICT;
    `);
    console.log('  ✓ FK facturas_ventas.customer_id -> clientes(id) añadida');

    // 3.5 Relación usuarios_sistema.role -> roles_sistema(name)
    await client.query(`
      ALTER TABLE roles_sistema 
      DROP CONSTRAINT IF EXISTS uq_roles_sistema_name;
    `);
    await client.query(`
      ALTER TABLE roles_sistema 
      ADD CONSTRAINT uq_roles_sistema_name UNIQUE (name);
    `);
    await client.query(`
      ALTER TABLE usuarios_sistema 
      DROP CONSTRAINT IF EXISTS fk_usuarios_role;
    `);
    await client.query(`
      ALTER TABLE usuarios_sistema 
      ADD CONSTRAINT fk_usuarios_role 
      FOREIGN KEY (role) REFERENCES roles_sistema(name) ON UPDATE CASCADE ON DELETE RESTRICT;
    `);
    console.log('  ✓ UNIQUE roles_sistema(name) y FK usuarios_sistema(role) -> roles_sistema(name) añadidas');

    // -------------------------------------------------------------------------
    // 4. APLICACIÓN DE CHECK CONSTRAINTS EXHAUSTIVOS
    // -------------------------------------------------------------------------
    console.log('\n[4/5] Aplicando CHECK constraints en tablas del sistema...');

    // 4.1 productos
    await client.query(`
      ALTER TABLE productos 
      DROP CONSTRAINT IF EXISTS chk_productos_cost,
      DROP CONSTRAINT IF EXISTS chk_productos_price,
      DROP CONSTRAINT IF EXISTS chk_productos_stock,
      DROP CONSTRAINT IF EXISTS chk_productos_min_stock,
      DROP CONSTRAINT IF EXISTS chk_productos_iva,
      DROP CONSTRAINT IF EXISTS chk_productos_status;
    `);
    await client.query(`
      ALTER TABLE productos 
      ADD CONSTRAINT chk_productos_cost CHECK (cost_price >= 0),
      ADD CONSTRAINT chk_productos_price CHECK (sale_price >= 0),
      ADD CONSTRAINT chk_productos_stock CHECK (stock >= 0),
      ADD CONSTRAINT chk_productos_min_stock CHECK (min_stock >= 0),
      ADD CONSTRAINT chk_productos_iva CHECK (iva_rate >= 0),
      ADD CONSTRAINT chk_productos_status CHECK (status IN ('Activo', 'Inactivo', 'Agotado', 'Descontinuado'));
    `);
    console.log('  ✓ CHECKs aplicados en productos (precios >= 0, stock >= 0, estados)');

    // 4.2 facturas_ventas
    await client.query(`
      ALTER TABLE facturas_ventas 
      DROP CONSTRAINT IF EXISTS chk_facturas_subtotal,
      DROP CONSTRAINT IF EXISTS chk_facturas_tax,
      DROP CONSTRAINT IF EXISTS chk_facturas_discount,
      DROP CONSTRAINT IF EXISTS chk_facturas_total,
      DROP CONSTRAINT IF EXISTS chk_facturas_status,
      DROP CONSTRAINT IF EXISTS chk_facturas_sri_status;
    `);
    await client.query(`
      ALTER TABLE facturas_ventas 
      ADD CONSTRAINT chk_facturas_subtotal CHECK (subtotal >= 0),
      ADD CONSTRAINT chk_facturas_tax CHECK (tax >= 0),
      ADD CONSTRAINT chk_facturas_discount CHECK (discount >= 0),
      ADD CONSTRAINT chk_facturas_total CHECK (total >= 0),
      ADD CONSTRAINT chk_facturas_status CHECK (status IN ('EMITIDA', 'AUTORIZADO', 'ANULADA', 'PENDIENTE', 'RECHAZADA')),
      ADD CONSTRAINT chk_facturas_sri_status CHECK (sri_status IN ('PENDIENTE', 'EN_COLA', 'FIRMADO', 'RECIBIDA', 'EN_PROCESO', 'AUTORIZADO', 'DEVUELTA', 'NO AUTORIZADO', 'ERROR'));
    `);
    console.log('  ✓ CHECKs aplicados en facturas_ventas (montos >= 0, estados)');

    // 4.3 asientos_contables (DEBE = HABER, partida doble)
    await client.query(`
      ALTER TABLE asientos_contables 
      DROP CONSTRAINT IF EXISTS chk_asientos_debit,
      DROP CONSTRAINT IF EXISTS chk_asientos_credit,
      DROP CONSTRAINT IF EXISTS chk_asientos_balance,
      DROP CONSTRAINT IF EXISTS chk_asientos_status,
      DROP CONSTRAINT IF EXISTS chk_asientos_type;
    `);
    await client.query(`
      ALTER TABLE asientos_contables 
      ADD CONSTRAINT chk_asientos_debit CHECK (total_debit >= 0),
      ADD CONSTRAINT chk_asientos_credit CHECK (total_credit >= 0),
      ADD CONSTRAINT chk_asientos_balance CHECK (ABS(total_debit - total_credit) <= 0.01),
      ADD CONSTRAINT chk_asientos_status CHECK (status IN ('ASENTADO', 'ANULADO', 'BORRADOR')),
      ADD CONSTRAINT chk_asientos_type CHECK (type IN ('INGRESO', 'EGRESO', 'DIARIO', 'AJUSTE', 'CIERRE'));
    `);
    console.log('  ✓ CHECKs aplicados en asientos_contables (total_debit = total_credit estricto)');

    // 4.4 kardex_movimientos
    await client.query(`
      ALTER TABLE kardex_movimientos 
      DROP CONSTRAINT IF EXISTS chk_kardex_quantity,
      DROP CONSTRAINT IF EXISTS chk_kardex_cost,
      DROP CONSTRAINT IF EXISTS chk_kardex_total,
      DROP CONSTRAINT IF EXISTS chk_kardex_stock_balance,
      DROP CONSTRAINT IF EXISTS chk_kardex_type;
    `);
    await client.query(`
      ALTER TABLE kardex_movimientos 
      ADD CONSTRAINT chk_kardex_quantity CHECK (quantity != 0),
      ADD CONSTRAINT chk_kardex_cost CHECK (cost_unit >= 0),
      ADD CONSTRAINT chk_kardex_total CHECK (total_cost >= 0),
      ADD CONSTRAINT chk_kardex_stock_balance CHECK (stock_balance >= 0),
      ADD CONSTRAINT chk_kardex_type CHECK (type IN ('INGRESO', 'EGRESO', 'AJUSTE', 'VENTA', 'COMPRA', 'DEVOLUCION'));
    `);
    console.log('  ✓ CHECKs aplicados en kardex_movimientos (costos, balance y tipos)');

    // 4.5 clientes
    await client.query(`
      ALTER TABLE clientes 
      DROP CONSTRAINT IF EXISTS chk_clientes_debt,
      DROP CONSTRAINT IF EXISTS chk_clientes_credit_limit;
    `);
    await client.query(`
      ALTER TABLE clientes 
      ADD CONSTRAINT chk_clientes_debt CHECK (current_debt >= 0),
      ADD CONSTRAINT chk_clientes_credit_limit CHECK (credit_limit >= 0);
    `);
    console.log('  ✓ CHECKs aplicados en clientes');

    // 4.6 sesiones_caja
    await client.query(`
      ALTER TABLE sesiones_caja 
      DROP CONSTRAINT IF EXISTS chk_sesiones_opening_cash,
      DROP CONSTRAINT IF EXISTS chk_sesiones_sales_cash,
      DROP CONSTRAINT IF EXISTS chk_sesiones_sales_transfer,
      DROP CONSTRAINT IF EXISTS chk_sesiones_sales_card,
      DROP CONSTRAINT IF EXISTS chk_sesiones_sales_credit,
      DROP CONSTRAINT IF EXISTS chk_sesiones_expected_cash,
      DROP CONSTRAINT IF EXISTS chk_sesiones_status;
    `);
    await client.query(`
      ALTER TABLE sesiones_caja 
      ADD CONSTRAINT chk_sesiones_opening_cash CHECK (opening_cash >= 0),
      ADD CONSTRAINT chk_sesiones_sales_cash CHECK (total_sales_cash >= 0),
      ADD CONSTRAINT chk_sesiones_sales_transfer CHECK (total_sales_transfer >= 0),
      ADD CONSTRAINT chk_sesiones_sales_card CHECK (total_sales_card >= 0),
      ADD CONSTRAINT chk_sesiones_sales_credit CHECK (total_sales_credit >= 0),
      ADD CONSTRAINT chk_sesiones_expected_cash CHECK (expected_cash >= 0),
      ADD CONSTRAINT chk_sesiones_status CHECK (status IN ('ABIERTA', 'CERRADA'));
    `);
    console.log('  ✓ CHECKs aplicados en sesiones_caja');

    // 4.7 cola_sri
    await client.query(`
      ALTER TABLE cola_sri 
      DROP CONSTRAINT IF EXISTS chk_cola_sri_reintentos,
      DROP CONSTRAINT IF EXISTS chk_cola_sri_estado;
    `);
    await client.query(`
      ALTER TABLE cola_sri 
      ADD CONSTRAINT chk_cola_sri_reintentos CHECK (reintentos >= 0),
      ADD CONSTRAINT chk_cola_sri_estado CHECK (estado IN ('EN_COLA', 'FIRMADO', 'RECIBIDA', 'EN_PROCESO', 'AUTORIZADO', 'DEVUELTA', 'ERROR', 'NO AUTORIZADO'));
    `);
    console.log('  ✓ CHECKs aplicados en cola_sri');

    // -------------------------------------------------------------------------
    // 5. CONSOLIDACIÓN DE TABLAS DUPLICADAS Y NORMALIZACIÓN DE TABLAS JSONB
    // -------------------------------------------------------------------------
    console.log('\n[5/5] Consolidando tablas duplicadas y normalizando tablas JSONB...');

    // 5.1 Asegurar que sesiones_caja tiene columna data para compatibilidad
    await client.query(`
      ALTER TABLE sesiones_caja ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;
    `);

    // Migrar datos existentes de caja_sesiones a sesiones_caja si existen
    const csRows = await client.query(`SELECT id, data, updated_at FROM caja_sesiones;`);
    for (const row of csRows.rows) {
      const d = row.data || {};
      const id = row.id;
      const cashierName = d.cashierName || 'Administrador Principal';
      const pto = d.emissionPoint || '001';
      const openTime = d.openedAt ? new Date(d.openedAt) : new Date();
      const status = d.status === 'ABIERTA' ? 'ABIERTA' : 'CERRADA';
      const initCash = Number(d.initialCash || 0);
      const sCash = Number(d.totalSalesCash || 0);
      const sTrans = Number(d.totalSalesTransfer || 0);
      const sCard = Number(d.totalSalesCard || 0);
      const sCred = Number(d.totalSalesCredit || 0);
      const expCash = Number(d.expectedCash || 0);
      const actCash = Number(d.actualCash || d.realCash || 0);
      const invCount = Number(d.totalInvoicesCount || 0);

      await client.query(`
        INSERT INTO sesiones_caja (
          id, cashier_name, emission_point, opening_time, status,
          opening_cash, total_sales_cash, total_sales_transfer, total_sales_card,
          total_sales_credit, expected_cash, actual_cash, total_invoices_count, data, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15)
        ON CONFLICT (id) DO UPDATE
        SET cashier_name = EXCLUDED.cashier_name, status = EXCLUDED.status,
            opening_cash = EXCLUDED.opening_cash, total_sales_cash = EXCLUDED.total_sales_cash,
            expected_cash = EXCLUDED.expected_cash, data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;
      `, [id, cashierName, pto, openTime, status, initCash, sCash, sTrans, sCard, sCred, expCash, actCash, invCount, JSON.stringify(d), row.updated_at]);
    }
    console.log(`  ✓ Migrados ${csRows.rows.length} registros de caja_sesiones -> sesiones_caja`);

    // Eliminar la tabla duplicada caja_sesiones y reemplazarla con VIEW sobre sesiones_caja
    await client.query(`DROP TABLE IF EXISTS caja_sesiones CASCADE;`);
    await client.query(`
      CREATE OR REPLACE VIEW caja_sesiones AS 
      SELECT * FROM sesiones_caja;
    `);
    console.log('  ✓ Tabla duplicada caja_sesiones eliminada y convertida a VIEW de sesiones_caja');

    // 5.2 Estructurar configuracion_parametros vs app_state
    await client.query(`
      ALTER TABLE configuracion_parametros 
      ADD COLUMN IF NOT EXISTS param_key VARCHAR(100),
      ADD COLUMN IF NOT EXISTS param_value TEXT,
      ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'GENERAL',
      ADD COLUMN IF NOT EXISTS description TEXT;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_config_param_key ON configuracion_parametros(param_key);
    `);
    console.log('  ✓ configuracion_parametros enriquecida con columnas relacionales (param_key, param_value, category)');

    // 5.3 Normalizar notas_credito
    await client.query(`DROP TABLE IF EXISTS notas_credito CASCADE;`);
    await client.query(`
      CREATE TABLE notas_credito (
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
    `);
    console.log('  ✓ Tabla relacional notas_credito creada con FKs y validaciones');

    // 5.4 Normalizar empleados
    await client.query(`DROP TABLE IF EXISTS empleados CASCADE;`);
    await client.query(`
      CREATE TABLE empleados (
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
    `);
    console.log('  ✓ Tabla relacional empleados creada con campos formales y CHECKs');

    // 5.5 Normalizar promociones
    await client.query(`DROP TABLE IF EXISTS promociones CASCADE;`);
    await client.query(`
      CREATE TABLE promociones (
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
    `);
    console.log('  ✓ Tabla relacional promociones creada con FKs y CHECKs');

    // 5.6 Normalizar cotizaciones_pedidos
    await client.query(`DROP TABLE IF EXISTS cotizaciones_pedidos CASCADE;`);
    await client.query(`
      CREATE TABLE cotizaciones_pedidos (
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
    `);
    console.log('  ✓ Tabla relacional cotizaciones_pedidos creada con FKs y CHECKs');

    await client.query('COMMIT;');
    console.log('\n===============================================================');
    console.log('✅ REFACTORIZACIÓN APLICADA EXITOSAMENTE EN POSTGRESQL');
    console.log('===============================================================');
  } catch (error: any) {
    await client.query('ROLLBACK;');
    console.error('\n❌ ERROR EN MIGRACIÓN (TRANSACCIÓN REVERTIDA):', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
