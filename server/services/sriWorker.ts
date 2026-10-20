import { getDatabase } from '../config/db';
import { broadcastSse } from '../controllers/sync.controller';
import { SriQueueRecord } from '../controllers/sriQueue.controller';
import { getSriJavaBaseUrl } from '../controllers/sri.controller';

let workerIntervalId: NodeJS.Timeout | null = null;
let isProcessing = false;

/**
 * WORKER EN SEGUNDO PLANO PARA FACTURACIÓN ELECTRÓNICA:
 * - Procesa cola_sri asíncronamente
 * - Consulta autorización para comprobantes en RECIBIDA o EN_PROCESO
 * - NUNCA genera un secuencial nuevo (utiliza siempre la misma clave de acceso)
 * - Maneja el Error 43 como comprobante ya recibido que debe consultarse directamente
 */
export async function processSriQueueBatch() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const db = await getDatabase();
    const pendingItems = await db.collection<SriQueueRecord>('cola_sri')
      .find({
        estado: { $in: ['EN_COLA', 'FIRMADO', 'RECIBIDA', 'EN_PROCESO'] },
        reintentos: { $lt: 20 }
      })
      .limit(10)
      .toArray();

    if (pendingItems.length === 0) {
      isProcessing = false;
      return;
    }

    for (const item of pendingItems) {
      try {
        const claveAcceso = item.claveAcceso;
        if (!claveAcceso) continue;

        // Intentar consultar autorización legal ante el SRI usando la MISMA clave de acceso
        let authResult: { isAuthorized: boolean; isDevuelta: boolean; authNumber?: string; authDate?: string; rawText?: string } = {
          isAuthorized: false,
          isDevuelta: false
        };

        try {
          const javaBase = await getSriJavaBaseUrl();
          const res = await fetch(`${javaBase}/api/sri/autorizacion/${claveAcceso}`, {
            headers: { 'Accept': 'text/plain, application/xml, application/json' },
            signal: AbortSignal.timeout(6000)
          });

          if (res.ok) {
            const text = await res.text();
            authResult.rawText = text;

            if (text.includes('AUTORIZADO') && !text.includes('NO AUTORIZADO')) {
              authResult.isAuthorized = true;
              const authNumMatch = text.match(/<numeroAutorizacion>(.*?)<\/numeroAutorizacion>/i);
              const authDateMatch = text.match(/<fechaAutorizacion>(.*?)<\/fechaAutorizacion>/i);
              authResult.authNumber = authNumMatch ? authNumMatch[1] : claveAcceso;
              authResult.authDate = authDateMatch ? authDateMatch[1] : new Date().toISOString();
            } else if (text.includes('DEVUELTA') || text.includes('NO AUTORIZADO')) {
              authResult.isDevuelta = true;
            }
          }
        } catch (fetchErr) {
          // El servicio Java o el SRI no están respondiendo en este tick.
          // El worker no falla y reintentará en el próximo ciclo sin duplicar secuenciales.
        }

        if (authResult.isAuthorized) {
          // 1. Marcar como AUTORIZADO en la cola
          await db.collection('cola_sri').updateOne(
            { _id: item._id as any },
            {
              $set: {
                estado: 'AUTORIZADO',
                numeroAutorizacion: authResult.authNumber,
                fechaAutorizacion: authResult.authDate,
                fechaUltimoIntento: new Date()
              }
            }
          );

          // 2. Actualizar la factura formal en facturas_ventas
          await db.collection('facturas_ventas').updateOne(
            { $or: [{ invoiceNumber: item.invoiceNumber }, { accessKey: item.claveAcceso }, { id: item.invoiceId }] as any },
            {
              $set: {
                sriStatus: 'AUTORIZADO',
                status: 'AUTORIZADO',
                authorizationNumber: authResult.authNumber,
                authorizationDate: authResult.authDate,
                updatedAt: new Date()
              }
            }
          );

          broadcastSse({
            type: 'sri_authorized',
            invoiceNumber: item.invoiceNumber,
            claveAcceso: item.claveAcceso,
            numeroAutorizacion: authResult.authNumber
          });

          console.log(`[SRI Worker] ✓ Factura ${item.invoiceNumber} legalmente AUTORIZADA en SRI.`);
        } else if (authResult.isDevuelta) {
          await db.collection('cola_sri').updateOne(
            { _id: item._id as any },
            {
              $inc: { reintentos: 1 },
              $set: {
                estado: 'DEVUELTA',
                ultimoError: 'Comprobante DEVUELTO por el SRI. Revise los datos fiscales en la bandeja de pendientes.',
                fechaUltimoIntento: new Date()
              }
            }
          );
        } else {
          // Estado intermedio (RECIBIDA / EN PROCESO):
          // Incrementar reintentos conservando ESTRICTAMENTE la misma clave de acceso
          await db.collection('cola_sri').updateOne(
            { _id: item._id as any },
            {
              $inc: { reintentos: 1 },
              $set: {
                estado: 'EN_PROCESO',
                fechaUltimoIntento: new Date()
              }
            }
          );
        }
      } catch (itemErr: any) {
        console.warn(`[SRI Worker Item Warning]:`, itemErr?.message);
      }
    }
  } catch (error: any) {
    console.warn(`[SRI Worker Batch Warning]:`, error?.message);
  } finally {
    isProcessing = false;
  }
}

/**
 * Inicia el loop del worker en Express (ejecución cada 25 segundos)
 */
export function startSriWorker(intervalMs = 25000) {
  if (workerIntervalId) return;

  console.log(`[SRI Worker] Iniciando servicio de cola de facturación electrónica en segundo plano (intervalo: ${intervalMs / 1000}s)...`);
  workerIntervalId = setInterval(() => {
    processSriQueueBatch().catch(() => {});
  }, intervalMs);

  // Ejecución inicial ligera
  setTimeout(() => {
    processSriQueueBatch().catch(() => {});
  }, 5000);
}

export function stopSriWorker() {
  if (workerIntervalId) {
    clearInterval(workerIntervalId);
    workerIntervalId = null;
    console.log('[SRI Worker] Servicio detenido.');
  }
}
