import { useState, useEffect, useRef } from 'react';

/**
 * Hook de sincronización 100% MongoDB Local (Compass) y tiempo real LAN.
 * Persistencia directa, rendimiento ultra rápido y sincronización multi-pestaña y multi-computadora (LAN).
 */

// Canal de difusión para sincronización instantánea entre pestañas abiertas
const broadcastChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('ferreteria_erp_sync')
  : null;

// Conexión compartida SSE (Server-Sent Events) para sincronización en tiempo real por LAN
let sharedEventSource: EventSource | null = null;
const listenersByDocId = new Map<string, Set<(data: any) => void>>();

function ensureSharedEventSource() {
  if (typeof window === 'undefined') return;
  if (sharedEventSource && (sharedEventSource.readyState === EventSource.OPEN || sharedEventSource.readyState === EventSource.CONNECTING)) {
    return;
  }

  try {
    sharedEventSource = new EventSource('/api/mongo/events');
    sharedEventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'doc_updated' && payload.docId) {
          const docListeners = listenersByDocId.get(payload.docId);
          if (docListeners) {
            docListeners.forEach((cb) => cb(payload.data));
          }
          try {
            localStorage.setItem(payload.docId, typeof payload.data === 'string' ? payload.data : JSON.stringify(payload.data));
          } catch {}
        }
      } catch {}
    };
    sharedEventSource.onerror = () => {
      // Reconexión automática nativa de EventSource del navegador
    };
  } catch {}
}

export function useFirestoreSync<T>(docId: string, initialValue: T) {
  // 1. Estado Inicial: desde caché local o initialValue (cero parpadeo en pantalla)
  const [data, setData] = useState<T>(() => {
    try {
      const cached = localStorage.getItem(docId);
      if (cached) {
        return typeof initialValue === 'string' ? (cached as any) : JSON.parse(cached);
      }
    } catch {}
    return initialValue;
  });

  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    ensureSharedEventSource();

    // 2. Suscribirse a eventos remotos por SSE (LAN / Red local)
    let docListeners = listenersByDocId.get(docId);
    if (!docListeners) {
      docListeners = new Set();
      listenersByDocId.set(docId, docListeners);
    }
    const onRemoteUpdate = (incomingData: any) => {
      if (!isMountedRef.current) return;
      setData(incomingData);
    };
    docListeners.add(onRemoteUpdate);

    // 3. Suscribirse a mensajes de otras pestañas en la misma máquina
    const onBroadcastMessage = (event: MessageEvent) => {
      if (event.data?.docId === docId && isMountedRef.current) {
        setData(event.data.data);
      }
    };
    broadcastChannel?.addEventListener('message', onBroadcastMessage);

    // 4. Carga inicial directa desde MongoDB Compass
    fetch(`/api/mongo/doc/${encodeURIComponent(docId)}`, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    })
      .then((res) => res.json())
      .then((resData) => {
        if (!isMountedRef.current) return;
        if (resData && resData.exists && resData.data !== undefined && resData.data !== null) {
          setData(resData.data);
          try {
            localStorage.setItem(docId, typeof resData.data === 'string' ? resData.data : JSON.stringify(resData.data));
          } catch {}
        } else {
          // El documento aún no está en MongoDB, poblar con el valor inicial/caché
          let currentVal = initialValue;
          try {
            const cached = localStorage.getItem(docId);
            if (cached) {
              currentVal = typeof initialValue === 'string' ? (cached as any) : JSON.parse(cached);
            }
          } catch {}

          fetch(`/api/mongo/doc/${encodeURIComponent(docId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: currentVal })
          }).catch(() => {});
        }
        setIsLoading(false);
      })
      .catch(() => {
        if (isMountedRef.current) setIsLoading(false);
      });

    return () => {
      isMountedRef.current = false;
      docListeners?.delete(onRemoteUpdate);
      if (docListeners?.size === 0) {
        listenersByDocId.delete(docId);
      }
      broadcastChannel?.removeEventListener('message', onBroadcastMessage);
    };
  }, [docId]);

  // 5. Guardado reactivo y atómico en MongoDB
  const updateData = (newData: T | ((prev: T) => T)) => {
    setData((prevData) => {
      const nextDataRaw = typeof newData === 'function' ? (newData as any)(prevData) : newData;
      const nextData = JSON.parse(JSON.stringify(nextDataRaw));

      // A. Actualizar caché local
      try {
        localStorage.setItem(docId, typeof nextData === 'string' ? nextData : JSON.stringify(nextData));
      } catch {}

      // B. Notificar a otras pestañas
      try {
        broadcastChannel?.postMessage({ docId, data: nextData });
      } catch {}

      // C. Notificar a otros componentes montados en la misma pestaña/ventana
      queueMicrotask(() => {
        const docListeners = listenersByDocId.get(docId);
        if (docListeners) {
          docListeners.forEach((cb) => {
            try {
              cb(nextData);
            } catch (err) {
              console.error('Error notificando listener local:', err);
            }
          });
        }
      });

      // D. Guardar en MongoDB Compass (colección app_state y colección friendly)
      fetch(`/api/mongo/doc/${encodeURIComponent(docId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: nextData })
      }).catch((err) => {
        console.warn(`[MongoDB Sync] Error guardando ${docId}:`, err);
      });

      return nextData;
    });
  };

  return [data, updateData, isLoading] as const;
}

// Alias moderno para el sistema
export const useMongoSync = useFirestoreSync;
