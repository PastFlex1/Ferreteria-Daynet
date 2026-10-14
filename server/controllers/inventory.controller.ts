import { Request, Response } from 'express';
import { getPgPool } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export async function getKardexMovements(req: Request, res: Response) {
  try {
    const pool = getPgPool();
    const { productId, type, startDate, endDate } = req.query;

    let queryText = 'SELECT * FROM kardex_movimientos WHERE 1=1';
    const params: any[] = [];

    if (productId) {
      params.push(String(productId));
      queryText += ` AND product_id = $${params.length}`;
    }

    if (type) {
      params.push(String(type));
      queryText += ` AND type = $${params.length}`;
    }

    if (startDate) {
      params.push(new Date(String(startDate)));
      queryText += ` AND date >= $${params.length}`;
    }

    if (endDate) {
      params.push(new Date(String(endDate)));
      queryText += ` AND date <= $${params.length}`;
    }

    queryText += ' ORDER BY date DESC;';

    const result = await pool.query(queryText, params);

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al consultar movimientos del Kardex desde SQLite.',
      error: error.message
    });
  }
}

export async function createAdjustment(req: AuthenticatedRequest, res: Response) {
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    const { productId, adjustmentType, quantity, reason } = req.body;

    if (!productId || !adjustmentType || quantity === undefined) {
      client.release();
      return res.status(400).json({
        success: false,
        message: 'Producto, tipo de ajuste (POSITIVO/NEGATIVO) y cantidad son requeridos.'
      });
    }

    await client.query('BEGIN;');

    const prodRes = await client.query(
      `SELECT * FROM productos WHERE id = $1 OR code = $1 OR sku = $1 FOR UPDATE;`,
      [productId]
    );

    if (prodRes.rows.length === 0) {
      await client.query('ROLLBACK;');
      client.release();
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado.'
      });
    }

    const product = prodRes.rows[0];
    const currentStock = Number(product.stock) || 0;
    const qty = Math.abs(Number(quantity));
    let newStock = currentStock;

    if (adjustmentType === 'POSITIVO' || adjustmentType === 'INGRESO') {
      newStock = currentStock + qty;
    } else {
      newStock = Math.max(0, currentStock - qty);
    }

    await client.query(
      `UPDATE productos SET stock = $1, updated_at = NOW() WHERE id = $2;`,
      [newStock, product.id]
    );

    const kardexId = `kdx-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const costUnit = Number(product.cost_price || 0);
    const totalCost = Number((qty * costUnit).toFixed(4));
    const movType = (adjustmentType === 'POSITIVO' || adjustmentType === 'INGRESO') ? 'INGRESO' : 'EGRESO';
    const movReason = reason || 'Ajuste físico de inventario';

    await client.query(`
      INSERT INTO kardex_movimientos (
        id, product_id, product_name, date, type, reason,
        quantity, cost_unit, total_cost, stock_balance, user_id
      )
      VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10);
    `, [kardexId, product.id, product.name, movType, movReason, qty, costUnit, totalCost, newStock, req.user?.id || null]);

    await client.query('COMMIT;');
    client.release();

    return res.status(201).json({
      success: true,
      message: 'Ajuste de inventario procesado en SQLite correctamente.',
      data: {
        product: product.name,
        previousStock: currentStock,
        newStock
      }
    });
  } catch (error: any) {
    try {
      await client.query('ROLLBACK;');
    } catch {}
    client.release();

    return res.status(500).json({
      success: false,
      message: 'Error al procesar el ajuste de inventario.',
      error: error.message
    });
  }
}
