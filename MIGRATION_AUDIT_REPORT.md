# Informe de Migración y Auditoría de Datos
**Fecha de Ejecución:** 2026-10-11T06:19:40.560Z  
**Base de Datos:** `ferreteria_daynet`  
**Ejecutado por:** Terminal_CLI  

---

## 1. Resumen Ejecutivo
- **Total Registros Analizados:** 20
- **Total Registros Normalizados a Colecciones Formas:** 20
- **Total Hallazgos / Inconsistencias Detectadas:** 5
  - 🚨 **Críticas:** 2
  - ⚠️ **Altas:** 2
  - ℹ️ **Medias / Observaciones:** 1

> **Cumplimiento TdR:** El script no oculta ninguna inconsistencia en silencio. Todo registro que no cumplió con las reglas fiscales o contables se detalla a continuación para su depuración con el cliente.

---

## 2. Resultados por Fase (Orden Recomendado)

| Fase | Descripción | Analizados | Normalizados | Hallazgos |
| :---: | :--- | :---: | :---: | :---: |
| 1 | Esquema, autenticación y permisos | 6 | 6 | **2** |
| 2 | Ventas, secuenciales y cola SRI | 2 | 2 | **2** |
| 3 | Inventario por bodega y kardex | 4 | 4 | **0** |
| 4 | Contabilidad con partida doble y cierre | 3 | 3 | **0** |
| 5 | Compras, CxP, retenciones y ATS | 2 | 2 | **1** |
| 6 | Caja por cajero y punto | 1 | 1 | **0** |
| 7 | Nómina, activos y reportes | 2 | 2 | **0** |

---

## 3. Detalle Pormenorizado de Inconsistencias para Depurar con el Cliente



### [Hallazgo #1] ⚠️ ALTA: usuarios_sistema (USR-01)
- **Fase:** Fase 1 - Esquema, Autenticación y Permisos
- **Campo:** `username`
- **Problema Detectado:** El usuario 'Administrador Principal' tiene cédula/RUC inválido: Dígito verificador Módulo 11 (Sociedad Privada) erróneo
- **Acción Recomendada con el Cliente:** Solicitar al cliente la cédula correcta del colaborador para inicio de sesión.
```json
{
  "username": "1799999999001",
  "name": "Administrador Principal"
}
```

---

### [Hallazgo #2] ℹ️ MEDIA: usuarios_sistema (USR-01)
- **Fase:** Fase 1 - Esquema, Autenticación y Permisos
- **Campo:** `password`
- **Problema Detectado:** El usuario 'Administrador Principal' tenía contraseña en texto plano. Se actualizó automáticamente con hash bcrypt.
- **Acción Recomendada con el Cliente:** Notificar al usuario el uso de contraseña cifrada segura.


---

### [Hallazgo #3] 🚨 CRÍTICA: facturas_ventas (inv-1791658856857)
- **Fase:** Fase 2 - Ventas, Secuenciales y Cola SRI
- **Campo:** `sriStatus`
- **Problema Detectado:** FACTURA SIN AUTORIZACIÓN SRI: '001-001-000000002' (Estado: 'SIN_ESTADO'). No cuenta con número de autorización legal.
- **Acción Recomendada con el Cliente:** Reenviar o reconsultar con la misma clave de acceso en la bandeja de cola SRI.
```json
{
  "invoiceNumber": "001-001-000000002",
  "total": 9.77
}
```

---

### [Hallazgo #4] 🚨 CRÍTICA: facturas_ventas (fac-001)
- **Fase:** Fase 2 - Ventas, Secuenciales y Cola SRI
- **Campo:** `sriStatus`
- **Problema Detectado:** FACTURA SIN AUTORIZACIÓN SRI: '001-001-000000001' (Estado: 'EMITIDA'). No cuenta con número de autorización legal.
- **Acción Recomendada con el Cliente:** Reenviar o reconsultar con la misma clave de acceso en la bandeja de cola SRI.
```json
{
  "invoiceNumber": "001-001-000000001",
  "date": "2026-09-19",
  "total": 25.5
}
```

---

### [Hallazgo #5] ⚠️ ALTA: proveedores (prov-02)
- **Fase:** Fase 5 - Compras, CxP, Retenciones y ATS
- **Campo:** `taxId`
- **Problema Detectado:** Proveedor 'Adelca Acería del Ecuador C.A.' con RUC/Cédula fiscal inválido: Dígito verificador Módulo 11 (Sociedad Privada) erróneo
- **Acción Recomendada con el Cliente:** Corregir el RUC del proveedor para validez del Anexo Transaccional Simplificado (ATS).
```json
{
  "name": "Adelca Acería del Ecuador C.A.",
  "taxId": "0990004523001"
}
```


---
_Informe emitido automáticamente por el Servicio Institucional de Migración de Ferretería Daynet._
