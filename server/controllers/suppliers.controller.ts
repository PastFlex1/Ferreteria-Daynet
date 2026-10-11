import { Request, Response } from 'express';
import { getDatabase } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export async function getAllSuppliers(req: Request, res: Response) {
  try {
    const db = await getDatabase();
    const { q } = req.query;

    const filter: any = {};
    if (q) {
      const searchRegex = new RegExp(String(q), 'i');
      filter.$or = [
        { name: searchRegex },
        { taxId: searchRegex },
        { contactPerson: searchRegex },
        { email: searchRegex }
      ];
    }

    const items = await db.collection('proveedores').find(filter).toArray();

    if (items.length === 0 && !q) {
      const stateDoc = await db.collection<{ _id: string; data?: any[] }>('app_state').findOne({ _id: 'ferreteria_suppliers' });
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
      return { ...data, id: String(data.id || data._id) };
    });

    return res.status(200).json({
      success: true,
      count: clean.length,
      data: clean
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al consultar proveedores.',
      error: error.message
    });
  }
}

export async function createSupplier(req: AuthenticatedRequest, res: Response) {
  try {
    const db = await getDatabase();
    const supplierData = req.body;

    if (!supplierData.name || !supplierData.taxId) {
      return res.status(400).json({
        success: false,
        message: 'Razón Social y RUC/Identificación del proveedor son obligatorios.'
      });
    }

    const customId = supplierData.id || `prov-${Date.now()}`;
    const newDoc = {
      _id: String(customId),
      id: String(customId),
      taxId: supplierData.taxId.trim(),
      name: supplierData.name.trim(),
      contactPerson: supplierData.contactPerson || '',
      email: supplierData.email || '',
      phone: supplierData.phone || '',
      address: supplierData.address || '',
      category: supplierData.category || 'General',
      paymentTerms: supplierData.paymentTerms || 'Contado',
      createdAt: new Date(),
      _syncedAt: new Date()
    };

    await db.collection('proveedores').updateOne(
      { _id: newDoc._id } as any,
      { $set: newDoc },
      { upsert: true }
    );

    return res.status(201).json({
      success: true,
      message: 'Proveedor registrado exitosamente.',
      data: newDoc
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
    const db = await getDatabase();
    const updates = req.body;

    const existing = await db.collection('proveedores').findOne({
      $or: [{ _id: id }, { id: id }, { taxId: id }]
    } as any);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado.'
      });
    }

    const { _id, id: docId, ...cleanUpdates } = updates;
    cleanUpdates.updatedAt = new Date();
    cleanUpdates._syncedAt = new Date();

    await db.collection('proveedores').updateOne(
      { _id: existing._id } as any,
      { $set: cleanUpdates }
    );

    return res.status(200).json({
      success: true,
      message: 'Proveedor actualizado exitosamente.'
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
    const db = await getDatabase();

    const result = await db.collection('proveedores').deleteOne({
      $or: [{ _id: id }, { id: id }]
    } as any);

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Proveedor eliminado correctamente.'
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar proveedor.',
      error: error.message
    });
  }
}
