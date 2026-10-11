import { Request, Response } from 'express';
import { getDatabase } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export async function getAllCustomers(req: Request, res: Response) {
  try {
    const db = await getDatabase();
    const { q } = req.query;

    const filter: any = {};
    if (q) {
      const searchRegex = new RegExp(String(q), 'i');
      filter.$or = [
        { name: searchRegex },
        { docNumber: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ];
    }

    const items = await db.collection('clientes').find(filter).toArray();

    if (items.length === 0 && !q) {
      const stateDoc = await db.collection<{ _id: string; data?: any[] }>('app_state').findOne({ _id: 'ferreteria_customers' });
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
      message: 'Error al consultar clientes.',
      error: error.message
    });
  }
}

export async function createCustomer(req: AuthenticatedRequest, res: Response) {
  try {
    const db = await getDatabase();
    const customerData = req.body;

    if (!customerData.name || !customerData.docNumber) {
      return res.status(400).json({
        success: false,
        message: 'Nombre e identificación son obligatorios.'
      });
    }

    const customId = customerData.id || `cust-${Date.now()}`;
    const newDoc = {
      _id: String(customId),
      id: String(customId),
      docType: customerData.docType || 'Cédula',
      docNumber: customerData.docNumber.trim(),
      name: customerData.name.trim(),
      email: customerData.email || '',
      phone: customerData.phone || '',
      address: customerData.address || '',
      creditLimit: Number(customerData.creditLimit) || 0,
      currentBalance: Number(customerData.currentBalance) || 0,
      createdAt: new Date(),
      _syncedAt: new Date()
    };

    await db.collection('clientes').updateOne(
      { _id: newDoc._id } as any,
      { $set: newDoc },
      { upsert: true }
    );

    return res.status(201).json({
      success: true,
      message: 'Cliente registrado exitosamente.',
      data: newDoc
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al registrar cliente.',
      error: error.message
    });
  }
}

export async function updateCustomer(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const db = await getDatabase();
    const updates = req.body;

    const existing = await db.collection('clientes').findOne({
      $or: [{ _id: id }, { id: id }, { docNumber: id }]
    } as any);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado.'
      });
    }

    const { _id, id: docId, ...cleanUpdates } = updates;
    cleanUpdates.updatedAt = new Date();
    cleanUpdates._syncedAt = new Date();

    await db.collection('clientes').updateOne(
      { _id: existing._id } as any,
      { $set: cleanUpdates }
    );

    return res.status(200).json({
      success: true,
      message: 'Cliente actualizado exitosamente.'
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
  try {
    const { id } = req.params;
    const db = await getDatabase();

    const result = await db.collection('clientes').deleteOne({
      $or: [{ _id: id }, { id: id }]
    } as any);

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Cliente eliminado correctamente.'
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar cliente.',
      error: error.message
    });
  }
}
