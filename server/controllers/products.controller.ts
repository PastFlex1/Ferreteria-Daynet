import { Request, Response } from 'express';
import { getDatabase } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export async function getAllProducts(req: Request, res: Response) {
  try {
    const db = await getDatabase();
    const { q, category } = req.query;

    const filter: any = {};
    if (category) {
      filter.category = String(category);
    }
    if (q) {
      const searchRegex = new RegExp(String(q), 'i');
      filter.$or = [
        { name: searchRegex },
        { code: searchRegex },
        { sku: searchRegex },
        { barcode: searchRegex }
      ];
    }

    const items = await db.collection('productos').find(filter).toArray();
    
    // Fallback if collection is empty, check app_state
    if (items.length === 0 && !q && !category) {
      const stateDoc = await db.collection<{ _id: string; data?: any[] }>('app_state').findOne({ _id: 'ferreteria_products' });
      if (stateDoc && Array.isArray(stateDoc.data)) {
        return res.status(200).json({
          success: true,
          count: stateDoc.data.length,
          data: stateDoc.data
        });
      }
    }

    const clean = items.map(item => {
      const { _syncedAt, ...data } = item;
      return {
        ...data,
        id: String(data.id || data._id)
      };
    });

    return res.status(200).json({
      success: true,
      count: clean.length,
      data: clean
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al obtener productos.',
      error: error.message
    });
  }
}

export async function getProductById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const db = await getDatabase();

    const product = await db.collection('productos').findOne({
      $or: [{ _id: id }, { id: id }, { code: id }, { barcode: id }]
    } as any);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado.'
      });
    }

    const { _syncedAt, ...data } = product;
    return res.status(200).json({
      success: true,
      data: { ...data, id: String(data.id || data._id) }
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
  try {
    const db = await getDatabase();
    const productData = req.body;

    if (!productData.name || productData.price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Nombre y precio de venta son obligatorios.'
      });
    }

    const customId = productData.id || productData.code || `prod-${Date.now()}`;
    const newDoc = {
      _id: String(customId),
      id: String(customId),
      code: productData.code || productData.sku || customId,
      sku: productData.sku || productData.code || customId,
      barcode: productData.barcode || '',
      name: productData.name.trim(),
      category: productData.category || 'General',
      price: Number(productData.price) || 0,
      cost: Number(productData.cost ?? productData.costPrice ?? 0),
      costPrice: Number(productData.cost ?? productData.costPrice ?? 0),
      stock: Number(productData.stock) || 0,
      minStock: Number(productData.minStock) || 0,
      taxRate: Number(productData.taxRate ?? 15),
      unit: productData.unit || 'UNIDAD',
      createdAt: new Date(),
      _syncedAt: new Date()
    };

    await db.collection('productos').updateOne(
      { _id: newDoc._id } as any,
      { $set: newDoc },
      { upsert: true }
    );

    // Registro automático en Kardex si tiene stock inicial
    if (newDoc.stock > 0) {
      await db.collection('kardex_movimientos').insertOne({
        productId: newDoc.id,
        productName: newDoc.name,
        type: 'INICIAL',
        quantity: newDoc.stock,
        previousStock: 0,
        newStock: newDoc.stock,
        unitCost: newDoc.cost,
        reason: 'Inventario inicial de producto',
        user: req.user?.name || 'Sistema',
        date: new Date()
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Producto registrado exitosamente.',
      data: newDoc
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al registrar producto.',
      error: error.message
    });
  }
}

export async function updateProduct(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const db = await getDatabase();
    const updates = req.body;

    const existing = await db.collection('productos').findOne({
      $or: [{ _id: id }, { id: id }]
    } as any);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado.'
      });
    }

    const { _id, id: docId, ...cleanUpdates } = updates;
    cleanUpdates.updatedAt = new Date();
    cleanUpdates._syncedAt = new Date();

    if (cleanUpdates.cost !== undefined && cleanUpdates.costPrice === undefined) {
      cleanUpdates.costPrice = cleanUpdates.cost;
    }

    await db.collection('productos').updateOne(
      { _id: existing._id } as any,
      { $set: cleanUpdates }
    );

    return res.status(200).json({
      success: true,
      message: 'Producto actualizado exitosamente.'
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
  try {
    const { id } = req.params;
    const db = await getDatabase();

    const result = await db.collection('productos').deleteOne({
      $or: [{ _id: id }, { id: id }]
    } as any);

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado.'
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
