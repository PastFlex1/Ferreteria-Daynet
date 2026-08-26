import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx-js-style';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  X, 
  Plus, 
  Check, 
  RefreshCw,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { Product, ProductCategory, StoreSettings } from '../../types';
import { exportToModernExcel } from '../../utils/excelExport';
import { formatCurrency } from '../../utils/formatters';
import { useModal } from '../../context/ModalContext';

interface BulkProductImporterProps {
  isOpen?: boolean;
  onClose?: () => void;
  isInline?: boolean;
  products: Product[];
  categories?: ProductCategory[];
  units?: any[];
  settings: StoreSettings;
  onSaveProduct: (product: Product) => void;
}

interface ParsedRow {
  product: Product;
  isValid: boolean;
  isExisting: boolean;
  errors: string[];
}

export const BulkProductImporterModal: React.FC<BulkProductImporterProps> = ({
  isOpen = true,
  onClose,
  isInline = false,
  products,
  categories = [],
  units = [],
  settings,
  onSaveProduct,
}) => {
  const { showAlert, showToast } = useModal();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [rawText, setRawText] = useState('');
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isInline && !isOpen) return null;

  // ── Download Excel Template (.xlsx) ────────────────────────────────────────
  const handleDownloadExcelTemplate = () => {
    const columns = [
      { header: 'SKU', key: 'sku', width: 16 },
      { header: 'Código de Barras', key: 'barcode', width: 18 },
      { header: 'Nombre del Producto', key: 'name', width: 35 },
      { header: 'Categoría', key: 'category', width: 22 },
      { header: 'Unidad de Medida', key: 'unit', width: 14 },
      { header: 'Precio Costo ($)', key: 'costPrice', width: 16 },
      { header: 'Precio Venta Sin IVA ($)', key: 'price', width: 22 },
      { header: 'Tarifa IVA (%)', key: 'taxRate', width: 14 },
      { header: 'Stock Inicial', key: 'stock', width: 14 },
      { header: 'Stock Mínimo', key: 'minStock', width: 14 },
      { header: 'Ubicación / Pasillo', key: 'location', width: 20 },
    ];

    const sampleData = [
      {
        sku: 'MART-16OZ',
        barcode: '786100029301',
        name: 'Martillo Stanley 16oz Mango Fibra',
        category: 'Herramientas Manuales',
        unit: 'UND',
        costPrice: 12.00,
        price: 18.50,
        taxRate: 15,
        stock: 50,
        minStock: 10,
        location: 'Pasillo 1 - Estante A',
      },
      {
        sku: 'CEM-50KG',
        barcode: '786100029302',
        name: 'Cemento Holcim Fuerte 50kg',
        category: 'Materiales de Construcción',
        unit: 'SAC',
        costPrice: 7.10,
        price: 8.75,
        taxRate: 5,
        stock: 200,
        minStock: 40,
        location: 'Bodega Principal B-02',
      },
      {
        sku: 'TUB-PVC-3P',
        barcode: '786100029303',
        name: 'Tubo Sanitario PVC 3 Pulgadas x 3m',
        category: 'Tubería y Conexiones',
        unit: 'UND',
        costPrice: 8.50,
        price: 12.00,
        taxRate: 15,
        stock: 80,
        minStock: 15,
        location: 'Estante C-10',
      },
    ];

    exportToModernExcel({
      filename: 'Plantilla_Carga_Productos_Ferreteria',
      sheetName: 'Productos',
      title: 'PLANTILLA DE IMPORTACIÓN DE PRODUCTOS',
      columns,
      data: sampleData,
    });
    showToast('Plantilla Excel descargada correctamente.', 'success');
  };

  // ── Download CSV Template (.csv) ──────────────────────────────────────────
  const handleDownloadCsvTemplate = () => {
    const header = "SKU,Código de Barras,Nombre del Producto,Categoría,Unidad,Precio Costo,Precio Venta,Tarifa IVA,Stock,Stock Mínimo,Ubicación\n";
    const sample = [
      "MART-16OZ,786100029301,Martillo Stanley 16oz Mango Fibra,Herramientas Manuales,UND,12.00,18.50,15,50,10,Pasillo 1 - Estante A",
      "CEM-50KG,786100029302,Cemento Holcim Fuerte 50kg,Materiales de Construcción,SAC,7.10,8.75,5,200,40,Bodega Principal B-02",
      "TUB-PVC-3P,786100029303,Tubo Sanitario PVC 3 Pulgadas x 3m,Tubería y Conexiones,UND,8.50,12.00,15,80,15,Estante C-10"
    ].join("\n");

    const blob = new Blob(["\uFEFF" + header + sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Plantilla_Productos_Ferreteria.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Plantilla CSV descargada.', 'success');
  };

  // ── Intelligent Row Normalizer ─────────────────────────────────────────────
  const normalizeAndValidateRows = (rawRows: any[]): ParsedRow[] => {
    return rawRows.map((row, index) => {
      const errors: string[] = [];

      // Find value with loose key matching
      const findVal = (...keys: string[]) => {
        for (const k of keys) {
          for (const rowKey of Object.keys(row)) {
            const cleanKey = rowKey.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            const cleanTarget = k.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            if (cleanKey.includes(cleanTarget) || cleanTarget.includes(cleanKey)) {
              const val = row[rowKey];
              if (val !== undefined && val !== null && String(val).trim() !== '') {
                return String(val).trim();
              }
            }
          }
        }
        return '';
      };

      const sku = findVal('sku', 'codigo', 'cod', 'referencia') || `PROD-${Date.now()}-${index + 1}`;
      const barcode = findVal('barcode', 'barras', 'codigobarras', 'ean') || sku;
      const name = findVal('nombre', 'descripcion', 'name', 'producto', 'articulo');
      const category = findVal('categoria', 'category', 'rubro', 'grupo') || 'Herramientas Manuales';
      const unit = findVal('unidad', 'unit', 'medida', 'um') || 'UND';
      const costPrice = parseFloat(findVal('costo', 'preciocosto', 'costprice', 'cost') || '0') || 0;
      const price = parseFloat(findVal('precio', 'pvp', 'precioventa', 'price', 'valor') || '0') || 0;
      const taxValStr = findVal('tarifaiva', 'iva', 'taxrate', 'tax');
      const taxRate = taxValStr !== '' && !isNaN(parseFloat(taxValStr))
        ? parseFloat(taxValStr)
        : (typeof settings.defaultTaxRate === 'number' ? settings.defaultTaxRate : 15);
      const stock = parseFloat(findVal('stock', 'cantidad', 'stockactual', 'qty') || '0') || 0;
      const minStock = parseFloat(findVal('stockminimo', 'minstock', 'minimo', 'alerta') || '5') || 5;
      const location = findVal('ubicacion', 'pasillo', 'estante', 'location') || '';

      if (!name) {
        errors.push('Falta el nombre del producto');
      }
      if (price <= 0) {
        errors.push('Precio de venta inválido o 0');
      }

      const existingProd = products.find(p => p.sku.toLowerCase() === sku.toLowerCase());

      const productObj: Product = {
        id: existingProd ? existingProd.id : `prod-${Date.now()}-${index + 1}`,
        sku,
        barcode,
        name: name || `Producto Fila ${index + 1}`,
        category: category as any,
        unit: unit as any,
        costPrice: costPrice > 0 ? costPrice : Math.round(price * 0.7 * 100) / 100,
        price,
        taxRate,
        stock,
        minStock,
        location,
        allowFractional: false,
      };

      return {
        product: productObj,
        isValid: errors.length === 0,
        isExisting: Boolean(existingProd),
        errors,
      };
    });
  };

  // ── Handle File Upload (Excel or CSV) ──────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!jsonData || jsonData.length === 0) {
          showAlert('El archivo seleccionado no contiene filas de datos.', 'Archivo Vacío', 'warning');
          setIsProcessing(false);
          return;
        }

        const parsed = normalizeAndValidateRows(jsonData);
        setParsedRows(parsed);
        setIsProcessing(false);
        showToast(`${parsed.length} productos detectados en el archivo.`, 'success');
      } catch (err: any) {
        showAlert('No se pudo procesar el archivo Excel/CSV. Verifique el formato e intente nuevamente.', 'Error de Lectura', 'error');
        setIsProcessing(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // ── Handle Pasted CSV / TSV Text ──────────────────────────────────────────
  const handleParseText = (text: string) => {
    setRawText(text);
    if (!text.trim()) {
      setParsedRows([]);
      return;
    }

    try {
      const workbook = XLSX.read(text, { type: 'string' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (jsonData && jsonData.length > 0) {
        const parsed = normalizeAndValidateRows(jsonData);
        setParsedRows(parsed);
        return;
      }
    } catch (e) {
      // Fallback simple line parser
      const lines = text.trim().split('\n');
      const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
      const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
      
      const rawData = lines.slice(1).map(line => {
        const cols = line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
        const obj: any = {};
        headers.forEach((h, i) => {
          obj[h] = cols[i] || '';
        });
        return obj;
      });

      const parsed = normalizeAndValidateRows(rawData);
      setParsedRows(parsed);
    }
  };

  // ── Confirm & Execute Import ───────────────────────────────────────────────
  const handleConfirmImport = () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      showAlert('No hay productos válidos para importar.', 'Sin Datos Válidos', 'warning');
      return;
    }

    let createdCount = 0;
    let updatedCount = 0;

    validRows.forEach(r => {
      if (r.isExisting && updateExisting) {
        onSaveProduct(r.product);
        updatedCount++;
      } else if (!r.isExisting) {
        onSaveProduct(r.product);
        createdCount++;
      }
    });

    const msg = `¡Importación completada! ${createdCount} productos nuevos creados y ${updatedCount} productos actualizados.`;
    setSuccessMessage(msg);
    showToast(msg, 'success');

    setTimeout(() => {
      setParsedRows([]);
      setFileName(null);
      setRawText('');
      if (onClose) onClose();
    }, 1500);
  };

  const validCount = parsedRows.filter(r => r.isValid).length;
  const existingCount = parsedRows.filter(r => r.isValid && r.isExisting).length;
  const newCount = parsedRows.filter(r => r.isValid && !r.isExisting).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;

  const content = (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3.5 bg-slate-950 text-sky-400 rounded-2xl border border-slate-800 shadow-md">
            <UploadCloud className="w-7 h-7 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-950">Importar Productos desde Excel o CSV</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-sky-50 text-sky-700 border border-sky-200">
                .XLSX • .XLS • .CSV
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Carga tu catálogo masivo en segundos con detección automática de columnas y precios.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadExcelTemplate}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Plantilla Excel (.xlsx)</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadCsvTemplate}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-black text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4 text-orange-600" />
            <span>Plantilla CSV</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900">✕</button>
        </div>
      )}

      {/* Drag & Drop File Upload Area */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm space-y-4">
        <input
          type="file"
          ref={fileInputRef}
          accept=".xlsx, .xls, .csv"
          onChange={handleFileUpload}
          className="hidden"
        />

        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 hover:border-orange-500 bg-slate-50/70 hover:bg-orange-50/40 rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3 group"
        >
          <div className="p-4 bg-white rounded-2xl border border-slate-200 group-hover:border-orange-300 shadow-2xs group-hover:scale-105 transition-transform">
            <FileSpreadsheet className="w-8 h-8 text-orange-500" />
          </div>
          <div>
            <p className="text-sm font-black text-slate-900">
              {fileName ? fileName : 'Haz clic o arrastra tu archivo Excel (.xlsx, .xls) o CSV aquí'}
            </p>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Compatible con exportaciones de cualquier sistema de facturación o planilla personalizada.
            </p>
          </div>
          <span className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl group-hover:bg-slate-800 transition">
            Examinar Archivo
          </span>
        </div>

        <div className="flex items-center justify-between text-xs pt-1">
          <button
            type="button"
            onClick={() => setShowPasteArea(!showPasteArea)}
            className="text-orange-600 hover:text-orange-700 font-bold flex items-center gap-1 cursor-pointer"
          >
            <span>{showPasteArea ? 'Ocultar caja de texto' : '¿Prefieres copiar y pegar texto CSV / Excel?'}</span>
          </button>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={updateExisting}
                onChange={(e) => setUpdateExisting(e.target.checked)}
                className="w-4 h-4 text-orange-500 rounded border-slate-300 focus:ring-orange-500"
              />
              <span>Actualizar productos existentes si el SKU coincide</span>
            </label>
          </div>
        </div>

        {showPasteArea && (
          <div className="space-y-2 pt-2">
            <textarea
              rows={4}
              value={rawText}
              onChange={(e) => handleParseText(e.target.value)}
              placeholder="Pega aquí el contenido copiado de Excel o CSV..."
              className="w-full p-3.5 bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Pre-Import Preview & Action Summary */}
      {parsedRows.length > 0 && (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm space-y-4 animate-fadeIn">
          {/* Summary Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-slate-100 text-slate-800 text-xs font-bold rounded-lg border border-slate-200">
                Total: {parsedRows.length} filas
              </span>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200">
                🟢 {newCount} Nuevos
              </span>
              {existingCount > 0 && (
                <span className="px-3 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg border border-amber-200">
                  🟡 {existingCount} Actualizarán Existentes
                </span>
              )}
              {invalidCount > 0 && (
                <span className="px-3 py-1 bg-rose-50 text-rose-700 text-xs font-bold rounded-lg border border-rose-200">
                  🔴 {invalidCount} con Errores
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={validCount === 0}
              className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Confirmar e Importar {validCount} Productos</span>
            </button>
          </div>

          {/* Preview Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-[380px] overflow-y-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-950 text-white font-black uppercase text-[10px] sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3">Nombre</th>
                  <th className="py-2.5 px-3">Categoría</th>
                  <th className="py-2.5 px-3">Unidad</th>
                  <th className="py-2.5 px-3 text-right">Costo</th>
                  <th className="py-2.5 px-3 text-right">PVP</th>
                  <th className="py-2.5 px-3 text-center">IVA</th>
                  <th className="py-2.5 px-3 text-right">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-medium">
                {parsedRows.map((row, idx) => (
                  <tr
                    key={idx}
                    className={
                      !row.isValid
                        ? 'bg-rose-50/70 text-rose-900'
                        : row.isExisting
                        ? 'bg-amber-50/40 text-slate-900'
                        : 'hover:bg-slate-50 text-slate-900'
                    }
                  >
                    <td className="py-2 px-3">
                      {!row.isValid ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                          {row.errors.join(', ')}
                        </span>
                      ) : row.isExisting ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          Actualizar
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Nuevo
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono font-bold">{row.product.sku}</td>
                    <td className="py-2 px-3 font-bold truncate max-w-[200px]">{row.product.name}</td>
                    <td className="py-2 px-3 text-slate-500">{row.product.category}</td>
                    <td className="py-2 px-3 text-center font-mono font-bold text-[10px]">{row.product.unit}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-600">
                      {formatCurrency(row.product.costPrice, settings.currencySymbol)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-black text-orange-600">
                      {formatCurrency(row.product.price, settings.currencySymbol)}
                    </td>
                    <td className="py-2 px-3 text-center font-mono font-bold text-[10px]">
                      {row.product.taxRate}%
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                      {row.product.stock}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  if (isInline) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-slate-100 border border-slate-200 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden my-auto">
        <div className="bg-slate-950 text-white p-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-sky-500/20 text-sky-400 rounded-xl">
              <UploadCloud className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Importar Productos al Inventario</h3>
              <p className="text-xs text-slate-400">Archivos Excel (.xlsx, .xls) o CSV</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {content}
        </div>
      </div>
    </div>
  );
};
