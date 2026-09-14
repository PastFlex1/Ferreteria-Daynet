/**
 * Servicio de sincronización y conexión Plug-and-Play con MongoDB Local (Compass)
 */

export interface MongoStatusResponse {
  connected: boolean;
  uri: string;
  dbName: string;
  collections?: string[];
  totalDocs?: number;
  error?: string;
  timestamp?: string;
}

export interface MongoTestResponse {
  success: boolean;
  message: string;
  dbName?: string;
  collections?: string[];
  error?: string;
}

class MongoSyncService {
  private statusCache: MongoStatusResponse | null = null;
  private lastCheckTime = 0;
  private isEnabled = true;

  /**
   * Consulta el estado en vivo de la conexión local a MongoDB (Compass)
   */
  async getStatus(force = false): Promise<MongoStatusResponse> {
    const now = Date.now();
    if (!force && this.statusCache && now - this.lastCheckTime < 5000) {
      return this.statusCache;
    }

    try {
      const res = await fetch('/api/mongo/status', {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data: MongoStatusResponse = await res.json();
      this.statusCache = data;
      this.lastCheckTime = now;
      return data;
    } catch (err: any) {
      const fallback: MongoStatusResponse = {
        connected: false,
        uri: 'mongodb://127.0.0.1:27017',
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
  async testConnection(uri: string, dbName: string, saveAsActive = false): Promise<MongoTestResponse> {
    try {
      const res = await fetch('/api/mongo/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        message: err.message || 'Error de red al conectar con MongoDB',
        error: err.message
      };
    }
  }

  /**
   * Guarda o actualiza un documento en MongoDB en tiempo real
   */
  async saveDoc(docId: string, data: any): Promise<boolean> {
    if (!this.isEnabled) return false;
    try {
      const res = await fetch(`/api/mongo/doc/${encodeURIComponent(docId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Obtiene un documento guardado en MongoDB
   */
  async getDoc(docId: string): Promise<{ exists: boolean; data: any } | null> {
    try {
      const res = await fetch(`/api/mongo/doc/${encodeURIComponent(docId)}`, {
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Exporta masivamente todos los estados/colecciones a MongoDB Compass
   */
  async exportAllToMongo(dataMap: Record<string, any>): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch('/api/mongo/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: dataMap })
      });
      const json = await res.json();
      return {
        success: res.ok && json.success,
        message: json.message || (res.ok ? 'Sincronización completada' : 'Error en sincronización')
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Error al conectar con MongoDB' };
    }
  }

  /**
   * Recupera todas las colecciones desde MongoDB
   */
  async pullAllFromMongo(): Promise<{ success: boolean; data?: Record<string, any>; count?: number; error?: string }> {
    try {
      const res = await fetch('/api/mongo/pull-all', {
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

export const mongoSync = new MongoSyncService();
