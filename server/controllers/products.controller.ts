import { Request, Response } from 'express';
import { getPgPool } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

function mapProductRow(r: any) {
  const customData = r.data || {};
  return {
    ...customData,
    id: r.id,
    code: r.code || r.sku || r.id,
    sku: r.sku || r.code || r.id,
    barcode: customData.barcode || r.code || '',
    name: r.name,
    description: r.description,
    category: r.category || 'General',
    unit: r.unit || 'UND',
    price: Number(r.sale_price),
    salePrice: Number(r.sale_price),
    cost: Number(r.cost_price),
    costPrice: Number(r.cost_price),
    stock: Number(r.stock),
    minStock: Number(r.min_stock),
    has_iva: r.has_iva,
    hasIva: r.has_iva,
    taxRate: Number(r.iva_rate),
    iva_rate: Number(r.iva_rate),
    status: r.status,
    updatedAt: r.updated_at
  };
}

export async function getAllProducts(req: Request, res: Response) {
  try {
    const pool = getPgPool();
    const { q, category } = req.query;

    let queryText = 'SELECT * FROM productos WHERE 1=1';
    const params: any[] = [];

    if (category) {
      params.push(String(category));
      queryText += ` AND category = $${params.length}`;
    }

    if (q) {
      params.push(`%${String(q).trim()}%`);
      queryText += ` AND (name ILIKE $${params.length} OR code ILIKE $${params.length} OR sku ILIKE $${params.length} OR id ILIKE $${params.length})`;
    }

    queryText += ' ORDER BY name ASC;';

    const result = await pool.query(queryText, params);
    const clean = result.rows.map(mapProductRow);

    return res.status(200).json({
      success: true,
      count: clean.length,
      data: clean
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al consultar productos de SQLite.',
      error: error.message
    });
  }
}

export async function getProductById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const pool = getPgPool();

    const result = await pool.query(
      `SELECT * FROM productos WHERE id = $1 OR code = $1 OR sku = $1 LIMIT 1;`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado.'
      });
    }

    return res.status(200).json({
      success: true,
      data: mapProductRow(result.rows[0])
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al consultar producto.',
      error: error.message
    });
  }
}

export async function createProduct(req: AuthenticatedRequest, res: Response) {
  const pool = getPgPool();
  try {
    const p = req.body;

    if (!p.name || (p.price === undefined && p.sale_price === undefined)) {
      return res.status(400).json({
        success: false,
        message: 'Nombre y precio de venta son obligatorios.'
      });
    }

    const id = String(p.id || p.code || p.sku || `prod-${Date.now()}`);
    const code = p.code || p.sku || id;
    const sku = p.sku || p.code || id;
    const name = String(p.name).trim();
    const desc = p.description || null;
    const cat = p.category || 'General';
    const unit = p.unit || 'UND';
    const costPrice = Math.max(0, Number(p.costPrice ?? p.cost ?? 0));
    const salePrice = Math.max(0, Number(p.price ?? p.sale_price ?? 0));
    const stock = Number(p.stock ?? 0);
    const minStock = Math.max(0, Number(p.minStock ?? p.min_stock ?? 5));
    const hasIva = p.has_iva !== undefined ? Boolean(p.has_iva) : (p.taxRate !== undefined ? Number(p.taxRate) > 0 : true);
    const ivaRate = Math.max(0, Number(p.taxRate ?? p.iva_rate ?? 15));
    const status = ['Activo', 'Inactivo', 'Agotado', 'Descontinuado'].includes(p.status) ? p.status : 'Activo';

    const insertRes = await pool.query(`
      INSERT INTO productos (
        id, code, sku, name, description, category, unit,
        cost_price, sale_price, stock, min_stock, has_iva, iva_rate, status, data, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE
      SET code = EXCLUDED.code, sku = EXCLUDED.sku, name = EXCLUDED.name,
          description = EXCLUDED.description, category = EXCLUDED.category, unit = EXCLUDED.unit,
          cost_price = EXCLUDED.cost_price, sale_price = EXCLUDED.sale_price, stock = EXCLUDED.stock,
          min_stock = EXCLUDED.min_stock, has_iva = EXCLUDED.has_iva, iva_rate = EXCLUDED.iva_rate,
          status = EXCLUDED.status, data = EXCLUDED.data, updated_at = NOW()
      RETURNING *;
    `, [id, code, sku, name, desc, cat, unit, costPrice, salePrice, stock, minStock, hasIva, ivaRate, status, JSON.stringify(p)]);

    // Registro automático en Kardex si tiene existencias iniciales
    if (stock > 0) {
      const kardexId = `kdx-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const totalCost = Number((stock * costPrice).toFixed(4));
      await pool.query(`
        INSERT INTO kardex_movimientos (
          id, product_id, product_name, date, type, reason,
          quantity, cost_unit, total_cost, stock_balance, user_id
        )
        VALUES ($1, $2, $3, NOW(), 'INGRESO', 'Inventario inicial de producto', $4, $5, $6, $7, $8);
      `, [kardexId, id, name, stock, costPrice, totalCost, stock, req.user?.id || null]);
    }

    return res.status(201).json({
      success: true,
      message: 'Producto registrado exitosamente en SQLite.',
      data: mapProductRow(insertRes.rows[0])
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al registrar producto en SQLite.',
      error: error.message
    });
  }
}

export async function updateProduct(req: AuthenticatedRequest, res: Response) {
  const pool = getPgPool();
  try {
    const { id } = req.params;
    const updates = req.body;

    const checkRes = await pool.query('SELECT * FROM productos WHERE id = $1 OR code = $1;', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado.'
      });
    }

    const current = checkRes.rows[0];
    const code = updates.code || updates.sku || current.code;
    const sku = updates.sku || updates.code || current.sku;
    const name = updates.name ? String(updates.name).trim() : current.name;
    const desc = updates.description !== undefined ? updates.description : current.description;
    const cat = updates.category !== undefined ? updates.category : current.category;
    const unit = updates.unit !== undefined ? updates.unit : current.unit;
    const costPrice = updates.costPrice !== undefined ? Math.max(0, Number(updates.costPrice)) : (updates.cost !== undefined ? Math.max(0, Number(updates.cost)) : current.cost_price);
    const salePrice = updates.price !== undefined ? Math.max(0, Number(updates.price)) : (updates.sale_price !== undefined ? Math.max(0, Number(updates.sale_price)) : current.sale_price);
    const stock = updates.stock !== undefined ? Number(updates.stock) : current.stock;
    const minStock = updates.minStock !== undefined ? Math.max(0, Number(updates.minStock)) : current.min_stock;
    const hasIva = updates.has_iva !== undefined ? Boolean(updates.has_iva) : current.has_iva;
    const ivaRate = updates.taxRate !== undefined ? Math.max(0, Number(updates.taxRate)) : (updates.iva_rate !== undefined ? Math.max(0, Number(updates.iva_rate)) : current.iva_rate);
    const status = updates.status || current.status;

    const mergedData = { ...(current.data || {}), ...updates };

    const updateRes = await pool.query(`
      UPDATE productos
      SET code = $2, sku = $3, name = $4, description = $5, category = $6, unit = $7,
          cost_price = $8, sale_price = $9, stock = $10, min_stock = $11,
          has_iva = $12, iva_rate = $13, status = $14, data = $15::jsonb, updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `, [current.id, code, sku, name, desc, cat, unit, costPrice, salePrice, stock, minStock, hasIva, ivaRate, status, JSON.stringify(mergedData)]);

    return res.status(200).json({
      success: true,
      message: 'Producto actualizado exitosamente en SQLite.',
      data: mapProductRow(updateRes.rows[0])
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar producto.',
      error: error.message
    });
  }
}

export async function deleteProduct(req: AuthenticatedRequest, res: Response) {
  const pool = getPgPool();
  try {
    const { id } = req.params;

    try {
      const result = await pool.query('DELETE FROM productos WHERE id = $1 OR code = $1 RETURNING id, name;', [id]);
      if (result.rows.length > 0) {
        return res.status(200).json({
          success: true,
          message: `Producto '${result.rows[0].name}' eliminado correctamente de SQLite.`
        });
      }
    } catch {
      // Si tiene claves foráneas (kardex_movimientos, factura_detalles), desactivar para proteger auditoría
      await pool.query("UPDATE productos SET status = 'Inactivo' WHERE id = $1 OR code = $1;", [id]);
      return res.status(200).json({
        success: true,
        message: 'Producto archivado/desactivado correctamente en SQLite.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Producto eliminado correctamente.'
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar producto.',
      error: error.message
    });
  }
}
