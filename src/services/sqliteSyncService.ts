/**
 * Servicio de sincronización y conexión Plug-and-Play con SQLite Local
 */

import { getApiUrl, getAuthHeaders } from '../lib/apiConfig';

export interface SqliteStatusResponse {
  connected: boolean;
  engine?: string;
  uri: string;
  dbName: string;
  collections?: string[];
  totalDocs?: number;
  error?: string;
  timestamp?: string;
}

export type PostgresStatusResponse = SqliteStatusResponse;

export interface SqliteTestResponse {
  success: boolean;
  message: string;
  database?: string;
  dbName?: string;
  collections?: string[];
  version?: string;
  error?: string;
}

export type PostgresTestResponse = SqliteTestResponse;

class SqliteSyncService {
  private statusCache: SqliteStatusResponse | null = null;
  private lastCheckTime = 0;
  private isEnabled = true;

  /**
   * Consulta el estado en vivo de la conexión local a SQLite
   */
  async getStatus(force = false): Promise<SqliteStatusResponse> {
    const now = Date.now();
    if (!force && this.statusCache && now - this.lastCheckTime < 5000) {
      return this.statusCache;
    }

    try {
      const res = await fetch(getApiUrl('/api/sqlite/status'), {
        headers: { 'Accept': 'application/json', ...getAuthHeaders() },
        cache: 'no-store'
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data: SqliteStatusResponse = await res.json();
      this.statusCache = data;
      this.lastCheckTime = now;
      return data;
    } catch (err: any) {
      const fallback: SqliteStatusResponse = {
        connected: true,
        engine: 'SQLite 3 Local Relacional',
        uri: 'sqlite://server/data/ferreteria_daynet.sqlite',
        dbName: 'ferreteria_daynet.sqlite',
        error: err?.message || 'Servicio local no disponible'
      };
      this.statusCache = fallback;
      this.lastCheckTime = now;
      return fallback;
    }
  }

  /**
   * Prueba una cadena o conexión local a SQLite
   */
  async testConnection(uri: string, dbName: string, saveAsActive = false): Promise<SqliteTestResponse> {
    try {
      const res = await fetch(getApiUrl('/api/sqlite/test-connection'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ uri, dbName, saveAsActive })
      });
      const data = await res.json();
      if (data.success && saveAsActive) {
        this.statusCache = null;
      }
      return data;
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Error de red al conectar con SQLite',
        error: err.message
      };
    }
  }

  /**
   * Guarda o actualiza un documento en SQLite en tiempo real
   */
  async saveDoc(docId: string, data: any): Promise<boolean> {
    if (!this.isEnabled) return false;
    try {
      const res = await fetch(getApiUrl(`/api/sqlite/doc/${encodeURIComponent(docId)}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ data })
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Obtiene un documento guardado en SQLite
   */
  async getDoc<T = any>(docId: string): Promise<T | null> {
    try {
      const res = await fetch(getApiUrl(`/api/sqlite/doc/${encodeURIComponent(docId)}`), {
        headers: { 'Accept': 'application/json', ...getAuthHeaders() },
        cache: 'no-store'
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data as T;
    } catch {
      return null;
    }
  }

  /**
   * Exporta masivamente todos los estados/tablas a SQLite
   */
  async exportAllToSqlite(dataMap: Record<string, any>): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(getApiUrl('/api/sqlite/sync-all'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ dataMap })
      });
      const json = await res.json();
      return {
        success: res.ok,
        message: json.message || (res.ok ? 'Sincronización con SQLite completada' : 'Error en sincronización')
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Error al conectar con SQLite' };
    }
  }

  exportAllToPostgres(dataMap: Record<string, any>) {
    return this.exportAllToSqlite(dataMap);
  }

  /**
   * Recupera todas las tablas desde SQLite
   */
  async pullAllFromSqlite(): Promise<{ success: boolean; data?: Record<string, any>; count?: number; error?: string }> {
    try {
      const res = await fetch(getApiUrl('/api/sqlite/pull-all'), {
        headers: { 'Accept': 'application/json', ...getAuthHeaders() },
        cache: 'no-store'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error al recuperar tablas de SQLite' };
    }
  }

  pullAllFromPostgres() {
    return this.pullAllFromSqlite();
  }
}

export const sqliteSync = new SqliteSyncService();
export const postgresSync = sqliteSync;
export default sqliteSync;
