import { useState, useEffect, useRef } from 'react';
import { getApiUrl, getAuthHeaders } from '../lib/apiConfig';

/**
 * Hook de sincronización 100% PostgreSQL 18 Local y tiempo real LAN.
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
    const token = typeof window !== 'undefined' ? localStorage.getItem('ferreteria_auth_token') : null;
    const sseEndpoint = getApiUrl('/api/postgres/events') + (token ? `?token=${encodeURIComponent(token)}` : '');
    sharedEventSource = new EventSource(sseEndpoint);
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
        if (payload.type === 'invoice_created' && (payload.invoice || payload.data)) {
          const inv = payload.invoice || payload.data;
          window.dispatchEvent(new CustomEvent('ferreteria_remote_invoice', { detail: inv }));
        }
        if (payload.type === 'product_stock_updated' && payload.productId) {
          window.dispatchEvent(new CustomEvent('ferreteria_remote_stock', { detail: payload }));
        }
      } catch {}
    };
    sharedEventSource.onerror = () => {
      // Reconexión automática nativa de EventSource del navegador
    };
  } catch {}
}

export function usePostgresSync<T>(docId: string, initialValue: T) {
  const isValidType = (val: any): boolean => {
    if (val === undefined || val === null) return false;
    if (typeof initialValue === 'string') {
      return typeof val === 'string';
    }
    if (Array.isArray(initialValue)) {
      return Array.isArray(val);
    }
    if (typeof initialValue === 'object') {
      return typeof val === 'object' && !Array.isArray(val);
    }
    return typeof val === typeof initialValue;
  };

  // 1. Inicialización síncrona desde caché LocalStorage
  const [data, setData] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const cached = localStorage.getItem(docId);
      if (cached !== null) {
        if (typeof initialValue === 'string') {
          return cached as unknown as T;
        }
        const parsed = JSON.parse(cached);
        if (isValidType(parsed)) {
          if (Array.isArray(initialValue) && Array.isArray(parsed) && parsed.length === 0 && (initialValue as any[]).length > 0) {
            return initialValue;
          }
          return parsed as T;
        }
      }
    } catch {}
    return initialValue;
  });

  const [isLoading, setIsLoading] = useState(false);
  const isInitialMount = useRef(true);
  const latestDataRef = useRef<T>(data);
  latestDataRef.current = data;

  useEffect(() => {
    ensureSharedEventSource();

    // 2. Escuchar cambios de otras pestañas en la misma máquina (BroadcastChannel)
    const handleBroadcast = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_DOC' && event.data?.docId === docId) {
        const incoming = event.data.data;
        if (isValidType(incoming)) {
          setData(incoming);
        }
      }
    };
    broadcastChannel?.addEventListener('message', handleBroadcast);

    // 3. Escuchar cambios en tiempo real vía LAN (SSE Server-Sent Events)
    const handleSseUpdate = (incomingData: any) => {
      if (isValidType(incomingData)) {
        setData(incomingData);
      }
    };

    if (!listenersByDocId.has(docId)) {
      listenersByDocId.set(docId, new Set());
    }
    listenersByDocId.get(docId)?.add(handleSseUpdate);

    // 4. Carga inicial directa desde PostgreSQL
    fetch(getApiUrl(`/api/postgres/doc/${encodeURIComponent(docId)}`), {
      headers: { 'Accept': 'application/json', ...getAuthHeaders() }
    })
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((res) => {
        if (res && res.exists && isValidType(res.data)) {
          const isRemoteEmptyArray = Array.isArray(res.data) && res.data.length === 0;
          const isInitialHasItems = Array.isArray(initialValue) && (initialValue as any[]).length > 0;

          if (isRemoteEmptyArray && isInitialHasItems) {
            // Guardar valores iniciales en PostgreSQL
            fetch(getApiUrl(`/api/postgres/doc/${encodeURIComponent(docId)}`), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
              body: JSON.stringify({ data: initialValue })
            }).catch(() => {});
          } else {
            setData(res.data);
            try {
              localStorage.setItem(docId, typeof res.data === 'string' ? res.data : JSON.stringify(res.data));
            } catch {}
          }
        } else if (!res || !res.exists) {
          // El documento aún no está en PostgreSQL, poblar con el valor inicial/caché
          const current = latestDataRef.current;
          const toSave = isValidType(current) ? current : initialValue;
          fetch(getApiUrl(`/api/postgres/doc/${encodeURIComponent(docId)}`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ data: toSave })
          }).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => {
        setIsLoading(false);
      });

    return () => {
      broadcastChannel?.removeEventListener('message', handleBroadcast);
      listenersByDocId.get(docId)?.delete(handleSseUpdate);
      if (listenersByDocId.get(docId)?.size === 0) {
        listenersByDocId.delete(docId);
      }
    };
  }, [docId]);

  // 5. Guardado reactivo y atómico en PostgreSQL
  const updateData = (action: React.SetStateAction<T>) => {
    setData((prev) => {
      const nextData = typeof action === 'function' ? (action as (prevState: T) => T)(prev) : action;

      // A. Guardar de inmediato en LocalStorage
      try {
        localStorage.setItem(docId, typeof nextData === 'string' ? nextData : JSON.stringify(nextData));
      } catch (e) {
        console.warn(`[LocalStorage] Error guardando ${docId}:`, e);
      }

      // B. Notificar a otras pestañas de la misma computadora
      try {
        broadcastChannel?.postMessage({
          type: 'SYNC_DOC',
          docId,
          data: nextData,
          timestamp: Date.now()
        });
      } catch {}

      // C. Disparar evento en memoria para componentes de la misma pestaña
      window.dispatchEvent(new CustomEvent(`ferreteria_sync_${docId}`, { detail: nextData }));

      // D. Guardar en PostgreSQL (tabla app_state y tabla relacional correspondiente)
      fetch(getApiUrl(`/api/postgres/doc/${encodeURIComponent(docId)}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ data: nextData })
      }).catch((err) => {
        console.warn(`[PostgreSQL Sync] Error guardando ${docId}:`, err);
      });

      return nextData;
    });
  };

  return [data, updateData, isLoading] as const;
}

export default usePostgresSync;
