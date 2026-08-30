import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { StoreSettings } from '../types';

export interface BackupMetadata {
  system: string;
  version: string;
  exportedAt: string;
  storeName: string;
  taxId: string;
  totalCollections: number;
  summary: {
    products: number;
    customers: number;
    invoices: number;
    suppliers: number;
    users: number;
    categories: number;
  };
}

export interface BackupPayload {
  metadata: BackupMetadata;
  data: Record<string, any>;
}

// Known collections to ensure complete fallback and export
const KNOWN_COLLECTIONS = [
  'ferreteria_settings',
  'ferreteria_products',
  'ferreteria_customers',
  'ferreteria_invoices',
  'ferreteria_categories',
  'ferreteria_units',
  'ferreteria_promotions',
  'ferreteria_taxes',
  'ferreteria_cash_session',
  'ferreteria_cash_sessions_history',
  'ferreteria_suppliers',
  'ferreteria_purchases',
  'ferreteria_purchase_orders',
  'ferreteria_product_batches',
  'ferreteria_suppliers_details',
  'ferreteria_payables',
  'ferreteria_supplier_payments',
  'ferreteria_bank_accounts',
  'ferreteria_bank_transactions',
  'ferreteria_bank_deposits',
  'ferreteria_petty_expenses',
  'ferreteria_finance_assets',
  'ferreteria_budget_categories',
  'ferreteria_issued_checks',
  'ferreteria_postdated_checks',
  'ferreteria_card_reconciliations',
  'ferreteria_journal_entries',
  'ferreteria_account_plan',
  'ferreteria_fiscal_periods',
  'ferreteria_assets',
  'ferreteria_asset_maintenances',
  'ferreteria_asset_transfers',
  'ferreteria_asset_classifications',
  'ferreteria_asset_areas',
  'ferreteria_asset_locations',
  'ferreteria_asset_history_logs',
  'ferreteria_hr_departments',
  'ferreteria_hr_positions',
  'ferreteria_hr_employees',
  'ferreteria_hr_payroll_roles',
  'ferreteria_hr_incomes',
  'ferreteria_hr_discounts',
  'ferreteria_hr_vacations',
  'ferreteria_hr_liquidations',
  'ferreteria_hr_decimos',
  'ferreteria_hr_novelties',
  'ferreteria_orders',
  'ferreteria_guias',
  'ferreteria_credit_notes',
  'ferreteria_retenciones',
  'ferreteria_recetas',
  'ferreteria_settings_users_list',
  'ferreteria_settings_payment_methods',
  'ferreteria_settings_establishment',
  'ferreteria_settings_emission_point',
  'ferreteria_settings_sec_invoice',
  'ferreteria_settings_sec_credit_note',
  'ferreteria_settings_sec_retention',
  'ferreteria_settings_sec_boleta',
  'ferreteria_settings_sec_quote',
  'ferreteria_settings_print_format',
  'ferreteria_settings_include_qr',
  'ferreteria_settings_print_logo',
  'ferreteria_settings_allow_negative_stock',
  'ferreteria_settings_block_no_stock_sales',
  'ferreteria_settings_min_stock_alert',
  'ferreteria_settings_auto_session_timeout',
  'ferreteria_settings_sri_mode',
  'ferreteria_settings_sri_api_url',
  'ferreteria_settings_p12_base64',
  'ferreteria_settings_p12_filename',
  'ferreteria_settings_p12_password',
  'ferreteria_settings_p12_upload_date',
];

/**
 * Exports the entire database into a downloadable JSON file.
 */
export async function exportDatabaseBackup(settings?: StoreSettings): Promise<{ fileName: string; totalCollections: number }> {
  const exportData: Record<string, any> = {};

  // 1. Attempt to fetch all docs from Firestore 'app_state'
  try {
    const querySnapshot = await getDocs(collection(db, 'app_state'));
    querySnapshot.forEach((docSnap) => {
      const val = docSnap.data();
      exportData[docSnap.id] = val?.data !== undefined ? val.data : val;
    });
  } catch (error) {
    console.warn('Could not read from Firestore collection app_state, falling back to localStorage:', error);
  }

  // 2. Supplement / fallback from localStorage
  for (const key of KNOWN_COLLECTIONS) {
    if (!exportData[key]) {
      try {
        const item = localStorage.getItem(key);
        if (item) {
          try {
            exportData[key] = JSON.parse(item);
          } catch {
            exportData[key] = item;
          }
        }
      } catch (e) {}
    }
  }

  // Also include any other local keys starting with ferreteria_
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('ferreteria_') && !exportData[key]) {
      try {
        const item = localStorage.getItem(key);
        if (item) {
          try {
            exportData[key] = JSON.parse(item);
          } catch {
            exportData[key] = item;
          }
        }
      } catch (e) {}
    }
  }

  const productsCount = Array.isArray(exportData.ferreteria_products) ? exportData.ferreteria_products.length : 0;
  const customersCount = Array.isArray(exportData.ferreteria_customers) ? exportData.ferreteria_customers.length : 0;
  const invoicesCount = Array.isArray(exportData.ferreteria_invoices) ? exportData.ferreteria_invoices.length : 0;
  const suppliersCount = Array.isArray(exportData.ferreteria_suppliers) ? exportData.ferreteria_suppliers.length : 0;
  const usersCount = Array.isArray(exportData.ferreteria_settings_users_list) ? exportData.ferreteria_settings_users_list.length : 1;
  const categoriesCount = Array.isArray(exportData.ferreteria_categories) ? exportData.ferreteria_categories.length : 0;

  const currentSettings = exportData.ferreteria_settings || settings || {};

  const payload: BackupPayload = {
    metadata: {
      system: 'Sistema Ferretería & Facturación SRI Ecuador',
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      storeName: currentSettings.storeName || 'Ferretería',
      taxId: currentSettings.taxId || '9999999999001',
      totalCollections: Object.keys(exportData).length,
      summary: {
        products: productsCount,
        customers: customersCount,
        invoices: invoicesCount,
        suppliers: suppliersCount,
        users: usersCount,
        categories: categoriesCount,
      },
    },
    data: exportData,
  };

  // Format filename with clean date/time
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = `${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}-${now.getSeconds().toString().padStart(2, '0')}`;
  const fileName = `backup_ferreteria_${dateStr}_${timeStr}.json`;

  // Create Blob & Trigger Download
  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return {
    fileName,
    totalCollections: Object.keys(exportData).length,
  };
}

/**
 * Validates and inspects an uploaded backup JSON file before restoration.
 */
export async function inspectBackupFile(file: File): Promise<BackupPayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);

        // Handle both standard BackupPayload format and raw key-value format
        if (parsed.data && typeof parsed.data === 'object') {
          resolve(parsed as BackupPayload);
        } else if (typeof parsed === 'object') {
          // Wrap raw key-value backup
          const payload: BackupPayload = {
            metadata: {
              system: 'Sistema Ferretería & Facturación SRI Ecuador',
              version: '1.0.0',
              exportedAt: new Date().toISOString(),
              storeName: parsed.ferreteria_settings?.storeName || 'Ferretería',
              taxId: parsed.ferreteria_settings?.taxId || '9999999999001',
              totalCollections: Object.keys(parsed).length,
              summary: {
                products: Array.isArray(parsed.ferreteria_products) ? parsed.ferreteria_products.length : 0,
                customers: Array.isArray(parsed.ferreteria_customers) ? parsed.ferreteria_customers.length : 0,
                invoices: Array.isArray(parsed.ferreteria_invoices) ? parsed.ferreteria_invoices.length : 0,
                suppliers: Array.isArray(parsed.ferreteria_suppliers) ? parsed.ferreteria_suppliers.length : 0,
                users: Array.isArray(parsed.ferreteria_settings_users_list) ? parsed.ferreteria_settings_users_list.length : 1,
                categories: Array.isArray(parsed.ferreteria_categories) ? parsed.ferreteria_categories.length : 0,
              },
            },
            data: parsed,
          };
          resolve(payload);
        } else {
          reject(new Error('El archivo no contiene un formato JSON válido de copia de seguridad.'));
        }
      } catch (err) {
        reject(new Error('Error al analizar el archivo JSON. Verifique que no esté dañado.'));
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
    reader.readAsText(file);
  });
}

/**
 * Restores all collections into Firestore and localStorage.
 */
export async function restoreDatabaseBackup(backup: BackupPayload): Promise<{ restoredCount: number }> {
  const data = backup.data;
  if (!data || typeof data !== 'object') {
    throw new Error('Datos de copia de seguridad inválidos.');
  }

  const keys = Object.keys(data);
  const savePromises: Promise<any>[] = [];

  for (const key of keys) {
    const rawVal = data[key];
    const cleanVal = JSON.parse(JSON.stringify(rawVal));

    // 1. Write to localStorage
    try {
      localStorage.setItem(key, typeof cleanVal === 'string' ? cleanVal : JSON.stringify(cleanVal));
    } catch (e) {
      console.warn(`Error writing ${key} to localStorage:`, e);
    }

    // 2. Write to Firestore collection 'app_state'
    try {
      const p = setDoc(doc(db, 'app_state', key), { data: cleanVal }).catch((err) => {
        console.warn(`Error saving ${key} to Firestore:`, err);
      });
      savePromises.push(p);
    } catch (err) {
      console.warn(`Firestore setDoc error for ${key}:`, err);
    }
  }

  await Promise.allSettled(savePromises);

  return {
    restoredCount: keys.length,
  };
}
