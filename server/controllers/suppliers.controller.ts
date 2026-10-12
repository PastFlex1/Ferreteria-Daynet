import { Request, Response } from 'express';
import { getPgPool } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

function mapSupplierRow(r: any) {
  const customData = r.data || {};
  return {
    ...customData,
    id: r.id,
    name: r.name,
    taxId: r.tax_id,
    email: r.email || '',
    phone: r.phone || '',
    address: r.address || '',
    contactPerson: r.contact_person || '',
    updatedAt: r.updated_at
  };
}

export async function getAllSuppliers(req: Request, res: Response) {
  try {
    const pool = getPgPool();
    const { q } = req.query;

    let queryText = 'SELECT * FROM proveedores WHERE 1=1';
    const params: any[] = [];

    if (q) {
      params.push(`%${String(q).trim()}%`);
      queryText += ` AND (name ILIKE $${params.length} OR tax_id ILIKE $${params.length} OR email ILIKE $${params.length} OR contact_person ILIKE $${params.length})`;
    }

    queryText += ' ORDER BY name ASC;';

    const result = await pool.query(queryText, params);
    const clean = result.rows.map(mapSupplierRow);

    return res.status(200).json({
      success: true,
      count: clean.length,
      data: clean
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al consultar proveedores desde PostgreSQL.',
      error: error.message
    });
  }
}

export async function createSupplier(req: AuthenticatedRequest, res: Response) {
  try {
    const pool = getPgPool();
    const s = req.body;
    const taxId = (s.taxId || s.tax_id || s.ruc || s.cedula || '').trim();

    if (!s.name || !taxId) {
      return res.status(400).json({
        success: false,
        message: 'Razón Social y RUC/Identificación del proveedor son obligatorios.'
      });
    }

    const id = String(s.id || `prov-${Date.now()}`);
    const name = String(s.name).trim();
    const email = s.email || null;
    const phone = s.phone || null;
    const address = s.address || null;
    const contact = s.contactPerson || s.contact_person || null;

    const insertRes = await pool.query(`
      INSERT INTO proveedores (id, name, tax_id, email, phone, address, contact_person, data)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, tax_id = EXCLUDED.tax_id, email = EXCLUDED.email,
          phone = EXCLUDED.phone, address = EXCLUDED.address,
          contact_person = EXCLUDED.contact_person, data = EXCLUDED.data
      RETURNING *;
    `, [id, name, taxId, email, phone, address, contact, JSON.stringify(s)]);

    return res.status(201).json({
      success: true,
      message: 'Proveedor registrado exitosamente en PostgreSQL.',
      data: mapSupplierRow(insertRes.rows[0])
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al registrar proveedor.',
      error: error.message
    });
  }
}

export async function updateSupplier(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const pool = getPgPool();
    const updates = req.body;

    const checkRes = await pool.query('SELECT * FROM proveedores WHERE id = $1 OR tax_id = $1 LIMIT 1;', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado.'
      });
    }

    const current = checkRes.rows[0];
    const name = updates.name ? String(updates.name).trim() : current.name;
    const taxId = updates.taxId || updates.tax_id || current.tax_id;
    const email = updates.email !== undefined ? updates.email : current.email;
    const phone = updates.phone !== undefined ? updates.phone : current.phone;
    const address = updates.address !== undefined ? updates.address : current.address;
    const contact = updates.contactPerson !== undefined ? updates.contactPerson : current.contact_person;

    const mergedData = { ...(current.data || {}), ...updates };

    const updateRes = await pool.query(`
      UPDATE proveedores
      SET name = $2, tax_id = $3, email = $4, phone = $5, address = $6, contact_person = $7, data = $8::jsonb
      WHERE id = $1
      RETURNING *;
    `, [current.id, name, taxId, email, phone, address, contact, JSON.stringify(mergedData)]);

    return res.status(200).json({
      success: true,
      message: 'Proveedor actualizado exitosamente en PostgreSQL.',
      data: mapSupplierRow(updateRes.rows[0])
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar proveedor.',
      error: error.message
    });
  }
}

export async function deleteSupplier(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const pool = getPgPool();

    const result = await pool.query('DELETE FROM proveedores WHERE id = $1 OR tax_id = $1 RETURNING id, name;', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado.'
      });
    }

    return res.status(200).json({
      success: true,
      message: `Proveedor '${result.rows[0].name}' eliminado correctamente de PostgreSQL.`
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar proveedor.',
      error: error.message
    });
  }
}
