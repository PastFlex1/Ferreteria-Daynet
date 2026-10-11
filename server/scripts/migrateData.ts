import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { getDatabase } from '../config/db';
import { validateEcuadorianId, validateJournalEntryBalance } from '../utils/validator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MigrationIssue {
  phase: number;
  phaseName: string;
  severity: 'CRITICA' | 'ALTA' | 'MEDIA' | 'OBSERVACION';
  entity: string;
  recordId: string;
  field?: string;
  issue: string;
  rawSample?: any;
  recommendation: string;
}

export interface MigrationPhaseResult {
  phase: number;
  phaseName: string;
  totalAnalyzed: number;
  totalMigrated: number;
  issuesCount: number;
}

export interface MigrationReport {
  timestamp: string;
  executedBy: string;
  database: string;
  totalRecordsAnalyzed: number;
  totalRecordsMigrated: number;
  totalIssuesFound: number;
  phases: MigrationPhaseResult[];
  issues: MigrationIssue[];
}

export async function runFullMigration(db: any, executedBy = 'Auditor_Script'): Promise<MigrationReport> {
  const issues: MigrationIssue[] = [];
  const phases: MigrationPhaseResult[] = [];
  let totalAnalyzed = 0;
  let totalMigrated = 0;

  console.log('\n========================================================================');
  console.log('🚀 INICIANDO SCRIPT ÚNICO DE MIGRACIÓN Y AUDITORÍA NORMALIZADA');
  console.log('   Requerimiento TdR: Normalizar app_state a filas formales y reportar inconsistencias');
  console.log('========================================================================\n');

  // Helper para leer doc de app_state
  async function getAppState(docId: string): Promise<any> {
    const doc = await db.collection<any>('app_state').findOne({ _id: docId });
    return doc ? doc.data : null;
  }

  // ---------------------------------------------------------------------------------
  // FASE 1: Esquema, autenticación y permisos
  // ---------------------------------------------------------------------------------
  console.log('📦 FASE 1: Migrando Esquema, Autenticación y Permisos...');
  let f1Analyzed = 0;
  let f1Migrated = 0;
  const f1IssuesBefore = issues.length;

  // 1.1 Usuarios del sistema
  const rawUsers = (await getAppState('ferreteria_settings_users_list')) || [];
  if (Array.isArray(rawUsers)) {
    for (const u of rawUsers) {
      f1Analyzed++;
      const username = String(u.username || u.cedula || u.id || '').trim();
      const id = String(u.id || u._id || username);

      // Validar Cédula de usuario si es de 10 o 13 dígitos
      if (/^\d{10}$/.test(username) || /^\d{13}$/.test(username)) {
        const idCheck = validateEcuadorianId(username);
        if (!idCheck.isValid) {
          issues.push({
            phase: 1,
            phaseName: 'Esquema, Autenticación y Permisos',
            severity: 'ALTA',
            entity: 'usuarios_sistema',
            recordId: id,
            field: 'username',
            issue: `El usuario '${u.name}' tiene cédula/RUC inválido: ${idCheck.reason}`,
            rawSample: { username, name: u.name },
            recommendation: 'Solicitar al cliente la cédula correcta del colaborador para inicio de sesión.'
          });
        }
      }

      // Validar password cifrado
      let passwordHash = u.password || 'admin123';
      if (!passwordHash.startsWith('$2a$') && !passwordHash.startsWith('$2b$')) {
        issues.push({
          phase: 1,
          phaseName: 'Esquema, Autenticación y Permisos',
          severity: 'MEDIA',
          entity: 'usuarios_sistema',
          recordId: id,
          field: 'password',
          issue: `El usuario '${u.name}' tenía contraseña en texto plano. Se actualizó automáticamente con hash bcrypt.`,
          recommendation: 'Notificar al usuario el uso de contraseña cifrada segura.'
        });
        passwordHash = await bcrypt.hash(String(passwordHash), 10);
      }

      const cleanUser = {
        _id: id,
        id,
        name: u.name || 'Usuario',
        username,
        email: u.email || `${username}@ferreteria.com`,
        role: typeof u.role === 'object' ? u.role?.name || u.role?.label || 'Cajero' : u.role || 'Cajero',
        status: u.status || 'Activo',
        password: passwordHash,
        updatedAt: new Date()
      };

      await db.collection('usuarios_sistema').updateOne(
        { _id: id as any },
        { $set: cleanUser },
        { upsert: true }
      );
      f1Migrated++;
    }
  }

  // 1.2 Roles y Configuración
  const rawRoles = (await getAppState('ferreteria_settings_roles')) || [];
  if (Array.isArray(rawRoles)) {
    for (const r of rawRoles) {
      f1Analyzed++;
      const roleId = String(r.id || r._id || r.name);
      await db.collection('roles_sistema').updateOne(
        { _id: roleId as any },
        { $set: { ...r, _id: roleId, updatedAt: new Date() } },
        { upsert: true }
      );
      f1Migrated++;
    }
  }

  phases.push({
    phase: 1,
    phaseName: 'Esquema, autenticación y permisos',
    totalAnalyzed: f1Analyzed,
    totalMigrated: f1Migrated,
    issuesCount: issues.length - f1IssuesBefore
  });

  // ---------------------------------------------------------------------------------
  // FASE 2: Ventas, secuenciales y cola SRI (el riesgo tributario más alto)
  // ---------------------------------------------------------------------------------
  console.log('📑 FASE 2: Migrando Ventas, Secuenciales y Cola SRI...');
  let f2Analyzed = 0;
  let f2Migrated = 0;
  const f2IssuesBefore = issues.length;

  const rawInvoices = (await getAppState('ferreteria_invoices')) || [];
  const invoiceNumbersSeen = new Set<string>();

  if (Array.isArray(rawInvoices)) {
    for (const inv of rawInvoices) {
      f2Analyzed++;
      const invoiceId = String(inv.id || inv._id || `inv-${Date.now()}`);
      const invoiceNumber = inv.fullNumber || inv.invoiceNumber || inv.number;

      // 1. Validación de número de factura
      if (!invoiceNumber) {
        issues.push({
          phase: 2,
          phaseName: 'Ventas, Secuenciales y Cola SRI',
          severity: 'CRITICA',
          entity: 'facturas_ventas',
          recordId: invoiceId,
          field: 'invoiceNumber',
          issue: 'Factura sin número o secuencial asignado (registro incompleto).',
          rawSample: { id: invoiceId, total: inv.total, customer: inv.customer?.name },
          recommendation: 'Asignar secuencial con el contador o anular internamente.'
        });
      } else {
        const fullNumStr = String(invoiceNumber);
        if (invoiceNumbersSeen.has(fullNumStr)) {
          issues.push({
            phase: 2,
            phaseName: 'Ventas, Secuenciales y Cola SRI',
            severity: 'CRITICA',
            entity: 'facturas_ventas',
            recordId: invoiceId,
            field: 'invoiceNumber',
            issue: `Secuencial duplicado detectado: '${fullNumStr}'. Dos ventas comparten la misma numeración fiscal.`,
            recommendation: 'Reasignar secuencial único en secuenciales_emision y depurar con el cliente.'
          });
        }
        invoiceNumbersSeen.add(fullNumStr);
      }

      // 2. Validación de Estado y Autorización SRI
      const isAuthorized = inv.sriStatus === 'AUTORIZADO' || inv.status === 'AUTORIZADO';
      const authNumber = inv.authorizationNumber || inv.numeroAutorizacion;

      if (!isAuthorized || !authNumber) {
        issues.push({
          phase: 2,
          phaseName: 'Ventas, Secuenciales y Cola SRI',
          severity: 'CRITICA',
          entity: 'facturas_ventas',
          recordId: invoiceId,
          field: 'sriStatus',
          issue: `FACTURA SIN AUTORIZACIÓN SRI: '${invoiceNumber || invoiceId}' (Estado: '${inv.status || 'SIN_ESTADO'}'). No cuenta con número de autorización legal.`,
          rawSample: { invoiceNumber, date: inv.date, total: inv.total },
          recommendation: 'Reenviar o reconsultar con la misma clave de acceso en la bandeja de cola SRI.'
        });
      }

      // 3. Normalizar factura en facturas_ventas
      const cleanInvoice = {
        ...inv,
        _id: invoiceId,
        id: invoiceId,
        invoiceNumber: String(invoiceNumber || invoiceId),
        establishment: inv.establishment || '001',
        emissionPoint: inv.emissionPoint || '001',
        sriStatus: isAuthorized ? 'AUTORIZADO' : (inv.sriStatus || inv.status || 'PENDIENTE'),
        updatedAt: new Date()
      };

      await db.collection('facturas_ventas').updateOne(
        { _id: invoiceId as any },
        { $set: cleanInvoice },
        { upsert: true }
      );
      f2Migrated++;

      // 4. Si la factura no estaba autorizada, encolar en cola_sri para que el worker la tramite
      if (!isAuthorized && inv.accessKey) {
        await db.collection('cola_sri').updateOne(
          { _id: `QUEUE-${inv.accessKey}` as any },
          {
            $setOnInsert: {
              _id: `QUEUE-${inv.accessKey}`,
              invoiceId,
              invoiceNumber: String(invoiceNumber || invoiceId),
              establishment: inv.establishment || '001',
              emissionPoint: inv.emissionPoint || '001',
              claveAcceso: inv.accessKey,
              customerName: inv.customer?.name,
              customerTaxId: inv.customer?.idNumber || inv.customer?.taxId,
              total: inv.total,
              estado: 'EN_PROCESO',
              reintentos: 0,
              maxReintentos: 15,
              fechaCreacion: new Date()
            }
          },
          { upsert: true }
        );
      }
    }
  }

  phases.push({
    phase: 2,
    phaseName: 'Ventas, secuenciales y cola SRI',
    totalAnalyzed: f2Analyzed,
    totalMigrated: f2Migrated,
    issuesCount: issues.length - f2IssuesBefore
  });

  // ---------------------------------------------------------------------------------
  // FASE 3: Inventario por bodega y kardex
  // ---------------------------------------------------------------------------------
  console.log('📦 FASE 3: Migrando Inventario por Bodega y Kardex...');
  let f3Analyzed = 0;
  let f3Migrated = 0;
  const f3IssuesBefore = issues.length;

  const rawProducts = (await getAppState('ferreteria_products')) || [];
  if (Array.isArray(rawProducts)) {
    for (const prod of rawProducts) {
      f3Analyzed++;
      const prodId = String(prod.id || prod._id || prod.code || prod.sku);
      const stock = Number(prod.stock || 0);
      const cost = Number(prod.cost || prod.costPrice || 0);

      if (stock < 0) {
        issues.push({
          phase: 3,
          phaseName: 'Inventario por bodega y kardex',
          severity: 'ALTA',
          entity: 'productos',
          recordId: prodId,
          field: 'stock',
          issue: `Producto '${prod.name}' presenta STOCK NEGATIVO: ${stock} unidades.`,
          rawSample: { code: prod.code, name: prod.name, stock },
          recommendation: 'Realizar conteo físico y registrar ajuste de inventario con responsable.'
        });
      }

      if (cost <= 0) {
        issues.push({
          phase: 3,
          phaseName: 'Inventario por bodega y kardex',
          severity: 'MEDIA',
          entity: 'productos',
          recordId: prodId,
          field: 'cost',
          issue: `Producto '${prod.name}' no tiene precio de costo registrado (${cost}).`,
          recommendation: 'Actualizar costo unitario para correcta valuación contable en Kardex.'
        });
      }

      const cleanProduct = {
        ...prod,
        _id: prodId,
        id: prodId,
        stock,
        cost,
        updatedAt: new Date()
      };

      await db.collection('productos').updateOne(
        { _id: prodId as any },
        { $set: cleanProduct },
        { upsert: true }
      );
      f3Migrated++;
    }
  }

  phases.push({
    phase: 3,
    phaseName: 'Inventario por bodega y kardex',
    totalAnalyzed: f3Analyzed,
    totalMigrated: f3Migrated,
    issuesCount: issues.length - f3IssuesBefore
  });

  // ---------------------------------------------------------------------------------
  // FASE 4: Contabilidad con partida doble y cierre
  // ---------------------------------------------------------------------------------
  console.log('⚖️ FASE 4: Migrando Contabilidad con Partida Doble y Cierre...');
  let f4Analyzed = 0;
  let f4Migrated = 0;
  const f4IssuesBefore = issues.length;

  const rawEntries = (await getAppState('ferreteria_journal_entries')) || [];
  if (Array.isArray(rawEntries)) {
    for (const entry of rawEntries) {
      f4Analyzed++;
      const entryId = String(entry.id || entry._id || entry.entryNumber || `asi-${Date.now()}`);

      // VALIDACIÓN CRÍTICA: PARTIDA DOBLE CUADRADA
      const balance = validateJournalEntryBalance(entry);

      if (!balance.isBalanced) {
        issues.push({
          phase: 4,
          phaseName: 'Contabilidad con partida doble y cierre',
          severity: 'CRITICA',
          entity: 'asientos_contables',
          recordId: entryId,
          field: 'isBalanced',
          issue: `ASIENTO CONTABLE DESCUADRADO: '${entry.entryNumber || entryId}' - Concepto: '${entry.concept}'. Total Debe: $${balance.totalDebit} != Total Haber: $${balance.totalCredit} (Descuadre: $${balance.diff}).`,
          rawSample: { entryNumber: entry.entryNumber, totalDebit: balance.totalDebit, totalCredit: balance.totalCredit, diff: balance.diff },
          recommendation: 'Revisar cuentas contrapartida y cuadrar el asiento con el departamento contable.'
        });
      }

      const cleanEntry = {
        ...entry,
        _id: entryId,
        id: entryId,
        totalDebit: balance.totalDebit,
        totalCredit: balance.totalCredit,
        isBalanced: balance.isBalanced,
        status: entry.status || 'ASENTADO',
        updatedAt: new Date()
      };

      await db.collection('asientos_contables').updateOne(
        { _id: entryId as any },
        { $set: cleanEntry },
        { upsert: true }
      );
      f4Migrated++;
    }
  }

  phases.push({
    phase: 4,
    phaseName: 'Contabilidad con partida doble y cierre',
    totalAnalyzed: f4Analyzed,
    totalMigrated: f4Migrated,
    issuesCount: issues.length - f4IssuesBefore
  });

  // ---------------------------------------------------------------------------------
  // FASE 5: Compras, CxP, retenciones y ATS
  // ---------------------------------------------------------------------------------
  console.log('🛒 FASE 5: Migrando Compras, CxP, Retenciones y ATS...');
  let f5Analyzed = 0;
  let f5Migrated = 0;
  const f5IssuesBefore = issues.length;

  const rawSuppliers = (await getAppState('ferreteria_suppliers')) || [];
  if (Array.isArray(rawSuppliers)) {
    for (const sup of rawSuppliers) {
      f5Analyzed++;
      const supId = String(sup.id || sup._id || sup.taxId || sup.ruc);
      const taxId = String(sup.taxId || sup.ruc || '').trim();

      if (taxId) {
        const idCheck = validateEcuadorianId(taxId);
        if (!idCheck.isValid) {
          issues.push({
            phase: 5,
            phaseName: 'Compras, CxP, Retenciones y ATS',
            severity: 'ALTA',
            entity: 'proveedores',
            recordId: supId,
            field: 'taxId',
            issue: `Proveedor '${sup.name || sup.businessName}' con RUC/Cédula fiscal inválido: ${idCheck.reason}`,
            rawSample: { name: sup.name, taxId },
            recommendation: 'Corregir el RUC del proveedor para validez del Anexo Transaccional Simplificado (ATS).'
          });
        }
      }

      await db.collection('proveedores').updateOne(
        { _id: supId as any },
        { $set: { ...sup, _id: supId, id: supId, updatedAt: new Date() } },
        { upsert: true }
      );
      f5Migrated++;
    }
  }

  phases.push({
    phase: 5,
    phaseName: 'Compras, CxP, retenciones y ATS',
    totalAnalyzed: f5Analyzed,
    totalMigrated: f5Migrated,
    issuesCount: issues.length - f5IssuesBefore
  });

  // ---------------------------------------------------------------------------------
  // FASE 6: Caja por cajero y punto
  // ---------------------------------------------------------------------------------
  console.log('💵 FASE 6: Migrando Caja por Cajero y Punto...');
  let f6Analyzed = 0;
  let f6Migrated = 0;
  const f6IssuesBefore = issues.length;

  const rawCash = await getAppState('ferreteria_cash_session');
  if (rawCash && typeof rawCash === 'object') {
    f6Analyzed++;
    const sessionId = String(rawCash.id || rawCash._id || 'sesion-activa-001');
    await db.collection('sesiones_caja').updateOne(
      { _id: sessionId as any },
      { $set: { ...rawCash, _id: sessionId, updatedAt: new Date() } },
      { upsert: true }
    );
    f6Migrated++;
  }

  phases.push({
    phase: 6,
    phaseName: 'Caja por cajero y punto',
    totalAnalyzed: f6Analyzed,
    totalMigrated: f6Migrated,
    issuesCount: issues.length - f6IssuesBefore
  });

  // ---------------------------------------------------------------------------------
  // FASE 7: Nómina, activos y reportes
  // ---------------------------------------------------------------------------------
  console.log('👥 FASE 7: Migrando Nómina, Activos y Reportes...');
  let f7Analyzed = 0;
  let f7Migrated = 0;
  const f7IssuesBefore = issues.length;

  const rawEmployees = (await getAppState('ferreteria_hr_employees')) || [];
  if (Array.isArray(rawEmployees)) {
    for (const emp of rawEmployees) {
      f7Analyzed++;
      const empId = String(emp.id || emp._id);
      const cedula = String(emp.cedula || emp.idCard || emp.identification || '').trim();

      if (cedula) {
        const idCheck = validateEcuadorianId(cedula);
        if (!idCheck.isValid) {
          issues.push({
            phase: 7,
            phaseName: 'Nómina, activos y reportes',
            severity: 'MEDIA',
            entity: 'empleados',
            recordId: empId,
            field: 'cedula',
            issue: `Colaborador '${emp.firstName || emp.name}' tiene cédula no válida: ${idCheck.reason}`,
            rawSample: { name: `${emp.firstName} ${emp.lastName}`, cedula },
            recommendation: 'Validar cédula para registro ante Ministerio del Trabajo / IESS.'
          });
        }
      }

      await db.collection('empleados').updateOne(
        { _id: empId as any },
        { $set: { ...emp, _id: empId, id: empId, updatedAt: new Date() } },
        { upsert: true }
      );
      f7Migrated++;
    }
  }

  phases.push({
    phase: 7,
    phaseName: 'Nómina, activos y reportes',
    totalAnalyzed: f7Analyzed,
    totalMigrated: f7Migrated,
    issuesCount: issues.length - f7IssuesBefore
  });

  totalAnalyzed = phases.reduce((acc, p) => acc + p.totalAnalyzed, 0);
  totalMigrated = phases.reduce((acc, p) => acc + p.totalMigrated, 0);

  const report: MigrationReport = {
    timestamp: new Date().toISOString(),
    executedBy,
    database: db.databaseName,
    totalRecordsAnalyzed: totalAnalyzed,
    totalRecordsMigrated: totalMigrated,
    totalIssuesFound: issues.length,
    phases,
    issues
  };

  // Guardar en PostgreSQL en la tabla reportes_migracion
  await db.collection('reportes_migracion').insertOne({
    ...report,
    _migratedAt: new Date()
  });

  // Guardar reporte en archivo Markdown y JSON
  const reportMd = generateMarkdownReport(report);
  const outDir = path.resolve(__dirname, '../../');
  fs.writeFileSync(path.join(outDir, 'MIGRATION_AUDIT_REPORT.md'), reportMd, 'utf8');
  fs.writeFileSync(path.join(outDir, 'migration_audit_report.json'), JSON.stringify(report, null, 2), 'utf8');

  console.log('\n========================================================================');
  console.log(`✓ MIGRACIÓN Y AUDITORÍA COMPLETADA`);
  console.log(`📊 Total Registros Analizados: ${totalAnalyzed}`);
  console.log(`💾 Total Filas Normalizadas:  ${totalMigrated}`);
  console.log(`⚠️ Total Inconsistencias Reportadas: ${issues.length}`);
  console.log(`📄 Informe generado en: MIGRATION_AUDIT_REPORT.md`);
  console.log('========================================================================\n');

  return report;
}

function generateMarkdownReport(report: MigrationReport): string {
  const criticalCount = report.issues.filter(i => i.severity === 'CRITICA').length;
  const highCount = report.issues.filter(i => i.severity === 'ALTA').length;
  const mediumCount = report.issues.filter(i => i.severity === 'MEDIA').length;

  return `# Informe de Migración y Auditoría de Datos
**Fecha de Ejecución:** ${report.timestamp}  
**Base de Datos:** \`${report.database}\`  
**Ejecutado por:** ${report.executedBy}  

---

## 1. Resumen Ejecutivo
- **Total Registros Analizados:** ${report.totalRecordsAnalyzed}
- **Total Registros Normalizados a Colecciones Formas:** ${report.totalRecordsMigrated}
- **Total Hallazgos / Inconsistencias Detectadas:** ${report.totalIssuesFound}
  - 🚨 **Críticas:** ${criticalCount}
  - ⚠️ **Altas:** ${highCount}
  - ℹ️ **Medias / Observaciones:** ${mediumCount}

> **Cumplimiento TdR:** El script no oculta ninguna inconsistencia en silencio. Todo registro que no cumplió con las reglas fiscales o contables se detalla a continuación para su depuración con el cliente.

---

## 2. Resultados por Fase (Orden Recomendado)

| Fase | Descripción | Analizados | Normalizados | Hallazgos |
| :---: | :--- | :---: | :---: | :---: |
${report.phases.map(p => `| ${p.phase} | ${p.phaseName} | ${p.totalAnalyzed} | ${p.totalMigrated} | **${p.issuesCount}** |`).join('\n')}

---

## 3. Detalle Pormenorizado de Inconsistencias para Depurar con el Cliente

${report.issues.length === 0 ? '_No se encontraron anomalías. Toda la base de datos está en perfecto estado._' : ''}
${report.issues.map((issue, idx) => `
### [Hallazgo #${idx + 1}] ${issue.severity === 'CRITICA' ? '🚨 CRÍTICA' : issue.severity === 'ALTA' ? '⚠️ ALTA' : 'ℹ️ MEDIA'}: ${issue.entity} (${issue.recordId})
- **Fase:** Fase ${issue.phase} - ${issue.phaseName}
- **Campo:** \`${issue.field || 'general'}\`
- **Problema Detectado:** ${issue.issue}
- **Acción Recomendada con el Cliente:** ${issue.recommendation}
${issue.rawSample ? `\`\`\`json\n${JSON.stringify(issue.rawSample, null, 2)}\n\`\`\`` : ''}
`).join('\n---\n')}

---
_Informe emitido automáticamente por el Servicio Institucional de Migración de Ferretería Daynet._
`;
}

// Ejecución directa por CLI si se invoca con `tsx server/scripts/migrateData.ts`
if (process.argv[1] && process.argv[1].endsWith('migrateData.ts')) {
  getDatabase().then(async (db) => {
    await runFullMigration(db, 'Terminal_CLI');
    process.exit(0);
  }).catch(err => {
    console.error('Error ejecutando migración:', err);
    process.exit(1);
  });
}
