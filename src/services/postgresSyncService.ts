/**
 * Servicio de sincronización y conexión Plug-and-Play con PostgreSQL 18 Local (pgAdmin / DBeaver)
 */

import { getApiUrl, getAuthHeaders } from '../lib/apiConfig';

export interface PostgresStatusResponse {
  connected: boolean;
  engine?: string;
  uri: string;
  dbName: string;
  collections?: string[];
  totalDocs?: number;
  error?: string;
  timestamp?: string;
}

export interface PostgresTestResponse {
  success: boolean;
  message: string;
  database?: string;
  dbName?: string;
  collections?: string[];
  version?: string;
  error?: string;
}

class PostgresSyncService {
  private statusCache: PostgresStatusResponse | null = null;
  private lastCheckTime = 0;
  private isEnabled = true;

  /**
   * Consulta el estado en vivo de la conexión local a PostgreSQL
   */
  async getStatus(force = false): Promise<PostgresStatusResponse> {
    const now = Date.now();
    if (!force && this.statusCache && now - this.lastCheckTime < 5000) {
      return this.statusCache;
    }

    try {
      const res = await fetch(getApiUrl('/api/postgres/status'), {
        headers: { 'Accept': 'application/json', ...getAuthHeaders() },
        cache: 'no-store'
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data: PostgresStatusResponse = await res.json();
      this.statusCache = data;
      this.lastCheckTime = now;
      return data;
    } catch (err: any) {
      const fallback: PostgresStatusResponse = {
        connected: false,
        engine: 'PostgreSQL 18 Relacional',
        uri: 'postgresql://127.0.0.1:5432',
        dbName: 'ferreteria_daynet',
        error: err?.message || 'Servicio local no disponible'
      };
      this.statusCache = fallback;
      this.lastCheckTime = now;
      return fallback;
    }
  }

  /**
   * Prueba una URI o base de datos personalizada
   */
  async testConnection(uri: string, dbName: string, saveAsActive = false): Promise<PostgresTestResponse> {
    try {
      const res = await fetch(getApiUrl('/api/postgres/test-connection'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ uri, dbName, saveAsActive })
      });
      const data = await res.json();
      if (data.success && saveAsActive) {
        await this.getStatus(true);
      }
      return data;
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Error de red al conectar con PostgreSQL',
        error: err.message
      };
    }
  }

  /**
   * Guarda o actualiza un documento en PostgreSQL en tiempo real
   */
  async saveDoc(docId: string, data: any): Promise<boolean> {
    if (!this.isEnabled) return false;
    try {
      const res = await fetch(getApiUrl(`/api/postgres/doc/${encodeURIComponent(docId)}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ data })
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Obtiene un documento guardado en PostgreSQL
   */
  async getDoc(docId: string): Promise<{ exists: boolean; data: any } | null> {
    try {
      const res = await fetch(getApiUrl(`/api/postgres/doc/${encodeURIComponent(docId)}`), {
        headers: { 'Accept': 'application/json', ...getAuthHeaders() }
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Exporta masivamente todos los estados/tablas a PostgreSQL
   */
  async exportAllToPostgres(dataMap: Record<string, any>): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(getApiUrl('/api/postgres/sync-all'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ data: dataMap })
      });
      const json = await res.json();
      return {
        success: res.ok && json.success,
        message: json.message || (res.ok ? 'Sincronización con PostgreSQL completada' : 'Error en sincronización')
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Error al conectar con PostgreSQL' };
    }
  }

  /**
   * Recupera todas las tablas desde PostgreSQL
   */
  async pullAllFromPostgres(): Promise<{ success: boolean; data?: Record<string, any>; count?: number; error?: string }> {
    try {
      const res = await fetch(getApiUrl('/api/postgres/pull-all'), {
        headers: { 'Accept': 'application/json', ...getAuthHeaders() },
        cache: 'no-store'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

export const postgresSync = new PostgresSyncService();
export default postgresSync;
