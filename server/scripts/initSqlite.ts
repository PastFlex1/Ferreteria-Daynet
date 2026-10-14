import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getSqliteDb, initializeSqliteSchema, sqliteFilePath } from '../config/sqlite';
import bcrypt from 'bcryptjs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initSqlite() {
  console.log(`\n======================================================`);
  console.log(`📦 INICIALIZADOR DE BASE DE DATOS SQLITE (OFFLINE / DESKTOP)`);
  console.log(`Archivo: ${sqliteFilePath}`);
  console.log(`======================================================\n`);

  try {
    const db = getSqliteDb();

    // 1. Ejecutar esquema formal DDL
    console.log(`[SQLite] Aplicando esquema relacional formal desde schema.sql...`);
    await initializeSqliteSchema();

    // 2. Sembrar secuenciales por defecto si no existen (Puntos de emisión TdR)
    const emissionPoints = ['001', '002', '003', '004'];
    const docTypes = [
      { code: '01', name: 'Factura Electrónica' },
      { code: '04', name: 'Nota de Crédito' },
      { code: '07', name: 'Comprobante de Retención' }
    ];

    for (const pto of emissionPoints) {
      for (const doc of docTypes) {
        const id = `001-${pto}-${doc.code}`;
        db.run(
          `INSERT OR IGNORE INTO secuenciales_emision (id, establishment, emission_point, document_type, name, current_sequential, updated_at)
           VALUES (?, '001', ?, ?, ?, 0, datetime('now', 'localtime'));`,
          [id, pto, doc.code, `${doc.name} (Punto ${pto})`]
        );
      }
    }
    console.log(`[SQLite] ✓ Secuenciales de emisión (001, 002, 003, 004) verificados.`);

    // 3. Sembrar roles y usuario Administrador por defecto si no existen
    db.run(`
      INSERT OR IGNORE INTO roles_sistema (id, name, description, permissions)
      VALUES ('role-admin', 'Administrador', 'Control total del sistema', '["*"]');
    `);
    db.run(`
      INSERT OR IGNORE INTO roles_sistema (id, name, description, permissions)
      VALUES ('role-cajero', 'Cajero', 'Punto de venta y cobros', '["pos", "invoices", "customers"]');
    `);

    // Verificar si hay usuarios registrados
    db.get(`SELECT count(*) as count FROM usuarios_sistema;`, [], async (_err, row: any) => {
      if (row && row.count === 0) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        db.run(
          `INSERT INTO usuarios_sistema (id, name, username, email, role, status, password)
           VALUES ('user-admin', 'Administrador General', 'admin', 'admin@ferreteria.com', 'Administrador', 'Activo', ?);`,
          [hashedPassword],
          () => {
            console.log(`[SQLite] ✓ Usuario 'admin' inicial creado (clave temporal: admin123).`);
          }
        );
      }
    });

    // 4. Listar tablas activas
    db.all(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;`,
      [],
      (_err, tables: any[]) => {
        console.log(`\n📋 Tablas activas en SQLite (${tables?.length || 0}):`);
        tables?.forEach(t => console.log(`   - ${t.name}`));
        console.log(`\n🎉 ¡Base de datos SQLite inicializada y lista en: ${sqliteFilePath}!\n`);
      }
    );

  } catch (err: any) {
    console.error(`[SQLite Error]:`, err.message);
    process.exit(1);
  }
}

initSqlite();
