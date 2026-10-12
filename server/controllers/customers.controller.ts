import { Request, Response } from 'express';
import { getPgPool } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

function mapCustomerRow(r: any) {
  const customData = r.data || {};
  return {
    ...customData,
    id: r.id,
    name: r.name,
    taxId: r.tax_id,
    docNumber: r.tax_id,
    docType: r.doc_type || 'C.I.',
    email: r.email || '',
    phone: r.phone || '',
    address: r.address || '',
    currentDebt: Number(r.current_debt),
    currentBalance: Number(r.current_debt),
    creditLimit: Number(r.credit_limit),
    updatedAt: r.updated_at
  };
}

export async function getAllCustomers(req: Request, res: Response) {
  try {
    const pool = getPgPool();
    const { q } = req.query;

    let queryText = 'SELECT * FROM clientes WHERE 1=1';
    const params: any[] = [];

    if (q) {
      params.push(`%${String(q).trim()}%`);
      queryText += ` AND (name ILIKE $${params.length} OR tax_id ILIKE $${params.length} OR email ILIKE $${params.length} OR phone ILIKE $${params.length})`;
    }

    queryText += ' ORDER BY name ASC;';

    const result = await pool.query(queryText, params);
    const clean = result.rows.map(mapCustomerRow);

    return res.status(200).json({
      success: true,
      count: clean.length,
      data: clean
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al consultar clientes desde PostgreSQL.',
      error: error.message
    });
  }
}

export async function getCustomerById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const pool = getPgPool();

    const result = await pool.query(
      `SELECT * FROM clientes WHERE id = $1 OR tax_id = $1 LIMIT 1;`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado.'
      });
    }

    return res.status(200).json({
      success: true,
      data: mapCustomerRow(result.rows[0])
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al consultar cliente.',
      error: error.message
    });
  }
}

export async function createCustomer(req: AuthenticatedRequest, res: Response) {
  const pool = getPgPool();
  try {
    const c = req.body;
    const taxId = (c.docNumber || c.tax_id || c.taxId || c.cedula || c.ruc || '').trim();

    if (!c.name || !taxId) {
      return res.status(400).json({
        success: false,
        message: 'Nombre e identificación del cliente son obligatorios.'
      });
    }

    const id = String(c.id || `cust-${Date.now()}`);
    const name = String(c.name).trim();
    const docType = c.docType || c.doc_type || 'C.I.';
    const email = c.email || null;
    const phone = c.phone || null;
    const address = c.address || null;
    const debt = Math.max(0, Number(c.currentBalance ?? c.current_debt ?? c.currentDebt ?? 0));
    const limit = Math.max(0, Number(c.creditLimit ?? c.credit_limit ?? 0));

    const insertRes = await pool.query(`
      INSERT INTO clientes (
        id, name, tax_id, doc_type, email, phone, address,
        current_debt, credit_limit, data, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, tax_id = EXCLUDED.tax_id, doc_type = EXCLUDED.doc_type,
          email = EXCLUDED.email, phone = EXCLUDED.phone, address = EXCLUDED.address,
          current_debt = EXCLUDED.current_debt, credit_limit = EXCLUDED.credit_limit,
          data = EXCLUDED.data, updated_at = NOW()
      RETURNING *;
    `, [id, name, taxId, docType, email, phone, address, debt, limit, JSON.stringify(c)]);

    return res.status(201).json({
      success: true,
      message: 'Cliente registrado exitosamente en PostgreSQL.',
      data: mapCustomerRow(insertRes.rows[0])
    });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Ya existe un cliente registrado con esa identificación/RUC.',
        error: error.detail
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Error al registrar cliente.',
      error: error.message
    });
  }
}

export async function updateCustomer(req: AuthenticatedRequest, res: Response) {
  const pool = getPgPool();
  try {
    const { id } = req.params;
    const updates = req.body;

    const checkRes = await pool.query('SELECT * FROM clientes WHERE id = $1 OR tax_id = $1;', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado.'
      });
    }

    const current = checkRes.rows[0];
    const name = updates.name ? String(updates.name).trim() : current.name;
    const taxId = updates.docNumber || updates.tax_id || updates.taxId || current.tax_id;
    const docType = updates.docType || updates.doc_type || current.doc_type;
    const email = updates.email !== undefined ? updates.email : current.email;
    const phone = updates.phone !== undefined ? updates.phone : current.phone;
    const address = updates.address !== undefined ? updates.address : current.address;
    const debt = updates.currentBalance !== undefined ? Math.max(0, Number(updates.currentBalance)) : (updates.currentDebt !== undefined ? Math.max(0, Number(updates.currentDebt)) : current.current_debt);
    const limit = updates.creditLimit !== undefined ? Math.max(0, Number(updates.creditLimit)) : current.credit_limit;

    const mergedData = { ...(current.data || {}), ...updates };

    const updateRes = await pool.query(`
      UPDATE clientes
      SET name = $2, tax_id = $3, doc_type = $4, email = $5,
          phone = $6, address = $7, current_debt = $8, credit_limit = $9,
          data = $10::jsonb, updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `, [current.id, name, taxId, docType, email, phone, address, debt, limit, JSON.stringify(mergedData)]);

    return res.status(200).json({
      success: true,
      message: 'Cliente actualizado exitosamente en PostgreSQL.',
      data: mapCustomerRow(updateRes.rows[0])
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar cliente.',
      error: error.message
    });
  }
}

export async function deleteCustomer(req: AuthenticatedRequest, res: Response) {
  const pool = getPgPool();
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM clientes WHERE id = $1 OR tax_id = $1 RETURNING id, name;', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado.'
      });
    }

    return res.status(200).json({
      success: true,
      message: `Cliente '${result.rows[0].name}' eliminado correctamente de PostgreSQL.`
    });
  } catch (error: any) {
    if (error.code === '23503') {
      return res.status(409).json({
        success: false,
        message: 'Acción bloqueada: No se puede eliminar el cliente porque tiene comprobantes o facturas asociadas en el sistema.',
        error: error.detail || error.message
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar cliente.',
      error: error.message
    });
  }
}
