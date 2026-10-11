import { Request, Response } from 'express';
import { getDatabase } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export async function getKardexMovements(req: Request, res: Response) {
  try {
    const db = await getDatabase();
    const { productId, type, startDate, endDate } = req.query;

    const filter: any = {};
    if (productId) {
      filter.productId = String(productId);
    }
    if (type) {
      filter.type = String(type);
    }
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(String(startDate));
      if (endDate) filter.date.$lte = new Date(String(endDate));
    }

    const items = await db.collection('kardex_movimientos').find(filter).sort({ date: -1 }).toArray();

    if (items.length === 0) {
      const stateDoc = await db.collection<{ _id: string; data?: any[] }>('app_state').findOne({ _id: 'ferreteria_kardex' });
      if (stateDoc && Array.isArray(stateDoc.data)) {
        return res.status(200).json({
          success: true,
          count: stateDoc.data.length,
          data: stateDoc.data
        });
      }
    }

    return res.status(200).json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al consultar movimientos del Kardex.',
      error: error.message
    });
  }
}

export async function createAdjustment(req: AuthenticatedRequest, res: Response) {
  try {
    const db = await getDatabase();
    const { productId, adjustmentType, quantity, reason } = req.body;

    if (!productId || !adjustmentType || quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Producto, tipo de ajuste (POSITIVO/NEGATIVO) y cantidad son requeridos.'
      });
    }

    const product = await db.collection('productos').findOne({
      $or: [{ _id: productId }, { id: productId }, { code: productId }]
    } as any);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado.'
      });
    }

    const currentStock = Number(product.stock) || 0;
    const qty = Math.abs(Number(quantity));
    let newStock = currentStock;

    if (adjustmentType === 'POSITIVO' || adjustmentType === 'INGRESO') {
      newStock = currentStock + qty;
    } else {
      newStock = Math.max(0, currentStock - qty);
    }

    await db.collection('productos').updateOne(
      { _id: product._id },
      { $set: { stock: newStock, updatedAt: new Date() } }
    );

    const adjustmentDoc = {
      productId: String(product.id || product._id),
      productName: product.name,
      type: adjustmentType,
      quantity: qty,
      previousStock: currentStock,
      newStock,
      reason: reason || 'Ajuste manual de inventario',
      user: req.user?.name || 'Administrador',
      date: new Date()
    };

    await db.collection('ajustes_inventario').insertOne(adjustmentDoc);

    // Movimiento formal en Kardex
    await db.collection('kardex_movimientos').insertOne({
      productId: String(product.id || product._id),
      productName: product.name,
      type: adjustmentType === 'POSITIVO' ? 'INGRESO' : 'EGRESO',
      subtype: 'AJUSTE',
      quantity: qty,
      previousStock: currentStock,
      newStock,
      reason: reason || 'Ajuste físico de inventario',
      user: req.user?.name || 'Administrador',
      date: new Date()
    });

    return res.status(201).json({
      success: true,
      message: 'Ajuste de inventario procesado en el servidor correctamente.',
      data: {
        product: product.name,
        previousStock: currentStock,
        newStock
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al procesar el ajuste de inventario.',
      error: error.message
    });
  }
}
