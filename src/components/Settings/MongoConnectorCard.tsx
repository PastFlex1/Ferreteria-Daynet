import React, { useState, useEffect } from 'react';
import { 
  Database, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Zap, 
  UploadCloud, 
  DownloadCloud, 
  ExternalLink,
  HardDrive,
  Copy,
  Check
} from 'lucide-react';
import { mongoSync, MongoStatusResponse } from '../../services/mongoSyncService';
import { useModal } from '../../context/ModalContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { KNOWN_COLLECTIONS } from '../../services/backupService';
import {
  defaultTaxRates,
  initialStoreSettings,
  defaultAccountPlan,
  defaultAssetClassifications,
  defaultAssetAreas,
  defaultAssetLocations,
  defaultPaymentMethods,
  defaultUsersList,
  defaultSellers,
  defaultEmployees,
  defaultCategories,
  initialCustomers,
  initialProducts,
  initialInvoices
} from '../../data/initialData';

const DEFAULT_FALLBACKS: Record<string, any> = {
  ferreteria_settings: initialStoreSettings,
  ferreteria_products: initialProducts,
  ferreteria_customers: initialCustomers,
  ferreteria_invoices: initialInvoices,
  ferreteria_categories: defaultCategories,
  ferreteria_taxes: defaultTaxRates,
  ferreteria_settings_tax_rates: defaultTaxRates,
  ferreteria_settings_users_list: defaultUsersList,
  ferreteria_settings_payment_methods: defaultPaymentMethods,
  ferreteria_account_plan: defaultAccountPlan,
  ferreteria_accounting_accounts: defaultAccountPlan,
  ferreteria_asset_classifications: defaultAssetClassifications,
  ferreteria_asset_areas: defaultAssetAreas,
  ferreteria_asset_locations: defaultAssetLocations,
  ferreteria_hr_employees: defaultEmployees,
  ferreteria_sellers: defaultSellers,
};

export const MongoConnectorCard: React.FC = () => {
  const { showAlert, showToast } = useModal();
  const [status, setStatus] = useState<MongoStatusResponse>({
    connected: false,
    uri: 'mongodb://127.0.0.1:27017',
    dbName: 'ferreteria_daynet',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [inputUri, setInputUri] = useState('mongodb://127.0.0.1:27017');
  const [inputDbName, setInputDbName] = useState('ferreteria_daynet');
  const [copied, setCopied] = useState(false);

  const fetchStatus = async (force = false) => {
    setIsLoading(true);
    try {
      const res = await mongoSync.getStatus(force);
      setStatus(res);
      if (res.uri) setInputUri(res.uri);
      if (res.dbName) setInputDbName(res.dbName);
    } catch {
      setStatus({
        connected: false,
        uri: inputUri,
        dbName: inputDbName,
        error: 'No se pudo contactar el puente local'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => fetchStatus(), 15000);
    return () => clearInterval(interval);
  }, []);

  const handleTestConnection = async () => {
    setIsLoading(true);
    try {
      const res = await mongoSync.testConnection(inputUri, inputDbName, true);
      if (res.success) {
        showToast(`✅ Conexión con MongoDB Compass exitosa. ${res.collections?.length || 0} colecciones detectadas.`, 'success');
        await fetchStatus(true);
      } else {
        showAlert('Error de Conexión a MongoDB', res.message || 'Verifica que MongoDB Compass o el servicio mongod estén corriendo en este equipo.');
      }
    } catch (e: any) {
      showAlert('Error', e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportAllToMongo = async () => {
    setIsSyncing(true);
    try {
      const payload: Record<string, any> = {};

      // 1. Fetch from Firestore app_state if available
      try {
        const querySnapshot = await getDocs(collection(db, 'app_state'));
        querySnapshot.forEach((docSnap) => {
          const val = docSnap.data();
          payload[docSnap.id] = val?.data !== undefined ? val.data : val;
        });
      } catch (err) {
        console.warn('Could not read from Firestore app_state, using localStorage:', err);
      }

      // 2. Read all keys from localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('ferreteria_') || key.startsWith('doc_') || key === 'app_state')) {
          try {
            const raw = localStorage.getItem(key);
            if (raw && !payload[key]) {
              try {
                payload[key] = JSON.parse(raw);
              } catch {
                payload[key] = raw;
              }
            }
          } catch {}
        }
      }

      // 3. Ensure every single module and collection has an initial structure
      for (const key of KNOWN_COLLECTIONS) {
        if (payload[key] === undefined || payload[key] === null) {
          if (DEFAULT_FALLBACKS[key] !== undefined) {
            payload[key] = DEFAULT_FALLBACKS[key];
          } else if (
            key.endsWith('s') || 
            key.includes('history') || 
            key.includes('list') || 
            key.includes('details') ||
            key.includes('records') ||
            key.includes('plan')
          ) {
            payload[key] = [];
          } else {
            payload[key] = {};
          }
        }
      }

      const res = await mongoSync.exportAllToMongo(payload);
      if (res.success) {
        const count = Object.keys(payload).length;
        showToast(`🚀 ¡Se exportaron ${count} secciones y colecciones a MongoDB Compass exitosamente!`, 'success');
        await fetchStatus(true);
      } else {
        showAlert('Fallo en sincronización', res.message);
      }
    } catch (e: any) {
      showAlert('Error al exportar', e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullAllFromMongo = async () => {
    setIsSyncing(true);
    try {
      const res = await mongoSync.pullAllFromMongo();
      if (res.success && res.data) {
        let restoredCount = 0;
        for (const [key, val] of Object.entries(res.data)) {
          try {
            localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
            restoredCount++;
          } catch {}
        }
        showToast(`📥 Se restauraron ${restoredCount} colecciones desde MongoDB. Recargando datos...`, 'success');
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        showAlert('Aviso', res.error || 'No se encontraron documentos en MongoDB para restaurar.');
      }
    } catch (e: any) {
      showAlert('Error al restaurar', e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const copyUri = () => {
    navigator.clipboard.writeText(inputUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast('URI copiada al portapapeles', 'info');
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 ring-1 ring-slate-200/60 p-6 shadow-sm space-y-6">
      {/* Header with Connection Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center space-x-3.5">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors shadow-inner ${
            status.connected 
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
              : 'bg-rose-50 text-rose-600 border border-rose-200'
          }`}>
            <Database className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-extrabold text-slate-900">
                Conexión a MongoDB Local (Compass)
              </h3>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wide border ${
                status.connected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-2xs'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                <span className={`w-2 h-2 rounded-full ${status.connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                {status.connected ? 'Conectado y Enchufado' : 'Desconectado'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Almacena automáticamente cada venta, producto, cliente y permiso en tu base de datos MongoDB local.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchStatus(true)}
          disabled={isLoading}
          className="self-start sm:self-auto px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Actualizar Estado</span>
        </button>
      </div>

      {/* Connection Info Banner */}
      {status.connected ? (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-900 space-y-1">
            <p className="font-bold">
              ¡MongoDB está enlazado en tiempo real con este computador!
            </p>
            <p className="text-emerald-700">
              Base de Datos: <strong className="font-mono">{status.dbName}</strong> | Colecciones detectadas: <strong className="font-mono">{status.collections?.length || 0}</strong> ({status.collections?.join(', ') || 'sin colecciones aún'}).
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 space-y-1">
            <p className="font-bold">Servicio local de MongoDB no detectado</p>
            <p className="text-amber-700">
              Asegúrate de que el servicio de MongoDB (o MongoDB Compass) esté instalado y activo en este equipo en el puerto 27017.
            </p>
          </div>
        </div>
      )}

      {/* Configuration Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            URI de Conexión MongoDB
          </label>
          <div className="relative flex items-center">
            <input
              type="text"
              value={inputUri}
              onChange={(e) => setInputUri(e.target.value)}
              placeholder="mongodb://127.0.0.1:27017"
              className="w-full pl-3.5 pr-20 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button
              type="button"
              onClick={copyUri}
              className="absolute right-2 px-2 py-1 text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Predeterminado para Compass: <code className="text-slate-600">mongodb://127.0.0.1:27017</code>
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Nombre de la Base de Datos
          </label>
          <input
            type="text"
            value={inputDbName}
            onChange={(e) => setInputDbName(e.target.value)}
            placeholder="ferreteria_daynet"
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Base de datos que verás dentro de MongoDB Compass.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={isLoading}
          className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-black text-xs rounded-xl shadow-sm transition flex items-center space-x-2 cursor-pointer disabled:opacity-50"
        >
          <Zap className="w-4 h-4 fill-current" />
          <span>Probar y Conectar</span>
        </button>

        <button
          type="button"
          onClick={handleExportAllToMongo}
          disabled={!status.connected || isSyncing}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-sm transition flex items-center space-x-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <UploadCloud className={`w-4 h-4 ${isSyncing ? 'animate-bounce' : ''}`} />
          <span>Volcar Todos los Datos a MongoDB Compass</span>
        </button>

        <button
          type="button"
          onClick={handlePullAllFromMongo}
          disabled={!status.connected || isSyncing}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center space-x-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <DownloadCloud className="w-4 h-4" />
          <span>Restaurar Datos desde MongoDB</span>
        </button>
      </div>

      {/* Quick Guide for MongoDB Compass */}
      <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2.5">
        <div className="flex items-center space-x-2 text-xs font-black text-slate-800">
          <HardDrive className="w-4 h-4 text-orange-500" />
          <span>¿Cómo ver tus datos en MongoDB Compass en cualquier computador?</span>
        </div>
        <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside font-medium leading-relaxed">
          <li>Abre el programa <strong>MongoDB Compass</strong> en tu computador.</li>
          <li>En la barra de conexión superior, pega: <code className="bg-white px-2 py-0.5 rounded border border-slate-200 font-mono font-bold text-slate-900">mongodb://127.0.0.1:27017</code></li>
          <li>Haz clic en el botón verde <strong>Connect</strong>.</li>
          <li>En la lista de bases de datos a la izquierda, entra a <strong className="text-emerald-700 font-mono">ferreteria_daynet</strong>.</li>
          <li>¡Listo! Podrás explorar directamente las colecciones: <code className="font-mono text-slate-800">inventario_productos</code>, <code className="font-mono text-slate-800">facturas_ventas</code>, <code className="font-mono text-slate-800">clientes</code> y <code className="font-mono text-slate-800">usuarios_sistema</code>.</li>
        </ol>
      </div>
    </div>
  );
};
