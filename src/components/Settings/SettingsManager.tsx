import { Select } from '../Shared/Select';
import React, { useState, useEffect } from 'react';
import { useModal } from '../../context/ModalContext';
import { useFirestoreSync } from '../../hooks/useFirestoreSync';
import { defaultUsersList, defaultPaymentMethods } from '../../data/initialData';
import { 
  SettingsSubTab, 
  StoreSettings 
} from '../../types';
import { 
  Building2, 
  MapPin, 
  Receipt, 
  CreditCard, 
  Users, 
  Printer, 
  ShieldCheck, 
  Database, 
  Save, 
  Plus, 
  CheckCircle2, 
  FileText, 
  Server, 
  Key, 
  DollarSign, 
  Percent, 
  Sliders, 
  Download, 
  Upload, 
  RefreshCw, 
  Trash2, 
  Edit3, 
  QrCode, 
  Lock, 
  ToggleLeft, 
  ToggleRight,
  AlertTriangle,
  UserPlus,
  ImageIcon,
  Sparkles,
  Eye,
  EyeOff,
  Copy,
  Check,
  FileCode,
  ExternalLink
} from 'lucide-react';

import { SriBackendService } from '../../services/sriBackendService';
import { generateInvoiceXML, convertERPInvoiceToSRI, downloadXML } from '../../services/sriXmlService';

interface SettingsManagerProps {
  subTab: SettingsSubTab | 'SETTINGS';
  settings: StoreSettings;
  onSaveSettings: (newSettings: StoreSettings) => void;
  onClearAllData?: () => void;
}

export const SettingsManager: React.FC<SettingsManagerProps> = ({
  subTab,
  settings,
  onSaveSettings,
  onClearAllData,
}) => {
  const { showAlert, showConfirm, showToast } = useModal();
  const [formData, setFormData] = useState<StoreSettings>({ ...settings });
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sync when settings prop updates
  useEffect(() => {
    setFormData({ ...settings });
  }, [settings]);

  // Digital Signature (.p12 / Base64) State
  const [signatureBase64, setSignatureBase64] = useFirestoreSync<string>('ferreteria_settings_p12_base64', '');
  const [signatureFileName, setSignatureFileName] = useFirestoreSync<string>('ferreteria_settings_p12_filename', '');
  const [signatureFileSize, setSignatureFileSize] = useFirestoreSync<string>('ferreteria_settings_p12_filesize', '');
  const [signaturePassword, setSignaturePassword] = useFirestoreSync<string>('ferreteria_settings_p12_password', '');
  const [signatureUploadDate, setSignatureUploadDate] = useFirestoreSync<string>('ferreteria_settings_p12_upload_date', '');
  const [showSignaturePassword, setShowSignaturePassword] = useState(false);
  const [copiedBase64, setCopiedBase64] = useState(false);

  // Java Backend API URL State
  const [sriApiUrl, setSriApiUrl] = useFirestoreSync<string>('ferreteria_settings_sri_api_url', 'http://localhost:8080/api/sri');
  const [isTestingBackend, setIsTestingBackend] = useState(false);
  const [backendStatus, setBackendStatus] = useState<{ tested: boolean; ok: boolean; message: string }>({
    tested: false,
    ok: false,
    message: '',
  });

  // Additional Configuration State Mock Data
  const [sriMode, setSriMode] = useFirestoreSync<'PRUEBAS' | 'PRODUCCION'>('ferreteria_settings_sri_mode', 'PRUEBAS');
  const [establishment, setEstablishment] = useFirestoreSync<string>('ferreteria_settings_establishment', '001');
  const [emissionPoint, setEmissionPoint] = useFirestoreSync<string>('ferreteria_settings_emission_point', '001');
  const [secInvoice, setSecInvoice] = useFirestoreSync<string>('ferreteria_settings_sec_invoice', '000000001');
  const [secBoleta, setSecBoleta] = useFirestoreSync<string>('ferreteria_settings_sec_boleta', '000001');
  const [secQuote, setSecQuote] = useFirestoreSync<string>('ferreteria_settings_sec_quote', '000001');
  const [secCreditNote, setSecCreditNote] = useFirestoreSync<string>('ferreteria_settings_sec_credit_note', '000000001');
  const [secRetention, setSecRetention] = useFirestoreSync<string>('ferreteria_settings_sec_retention', '000000001');

  // Users Management State
  const [usersList, setUsersList] = useFirestoreSync<any[]>('ferreteria_settings_users_list', defaultUsersList);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', username: '', role: 'Vendedor', password: '' });

  // Payment Methods State
  const [paymentMethods, setPaymentMethods] = useFirestoreSync<any[]>('ferreteria_settings_payment_methods', defaultPaymentMethods);

  // Printing Format State
  const [printFormat, setPrintFormat] = useFirestoreSync<'TICKET_80MM' | 'TICKET_58MM' | 'RIDE_A4'>('ferreteria_settings_print_format', 'TICKET_80MM');
  const [includeQrCode, setIncludeQrCode] = useFirestoreSync<boolean>('ferreteria_settings_include_qr', true);
  const [printLogo, setPrintLogo] = useFirestoreSync<boolean>('ferreteria_settings_print_logo', true);

  // General Admin Settings
  const [allowNegativeStock, setAllowNegativeStock] = useFirestoreSync<boolean>('ferreteria_settings_allow_negative_stock', false);
  const [blockNoStockSales, setBlockNoStockSales] = useFirestoreSync<boolean>('ferreteria_settings_block_no_stock_sales', true);
  const [minStockAlert, setMinStockAlert] = useFirestoreSync<boolean>('ferreteria_settings_min_stock_alert', true);
  const [autoSessionTimeout, setAutoSessionTimeout] = useFirestoreSync<string>('ferreteria_settings_auto_session_timeout', '30');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSavedSuccess(true);
    showToast('Configuración guardada exitosamente', 'success');
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showAlert('Por favor seleccione un archivo de imagen válido (PNG, JPG, SVG, WebP).', 'Formato Inválido', 'warning');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showAlert('El logo no debe superar los 2MB de tamaño.', 'Archivo muy pesado', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const updated = { ...formData, logoUrl: base64 };
      setFormData(updated);
      onSaveSettings(updated);
      showToast('Logo empresarial cargado y guardado correctamente.', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    const updated = { ...formData, logoUrl: '' };
    setFormData(updated);
    onSaveSettings(updated);
    showToast('Logo eliminado. Se utilizará el ícono predeterminado.', 'info');
  };

  const handleP12FileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'p12' && ext !== 'pfx') {
      showAlert('Por favor seleccione un archivo con extensión .p12 o .pfx emitido por una entidad autorizada (Banco Central, Security Data, ANF, UANATACA, etc.).', 'Formato de Certificado Inválido', 'warning');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showAlert('El archivo de firma es demasiado pesado (> 5MB).', 'Archivo Excedido', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const cleanBase64 = result.includes(',') ? result.split(',')[1] : result;

      setSignatureBase64(cleanBase64);
      setSignatureFileName(file.name);
      setSignatureFileSize(`${(file.size / 1024).toFixed(1)} KB`);
      setSignatureUploadDate(new Date().toISOString());

      try {
        localStorage.setItem('ferreteria_settings_p12_base64', cleanBase64);
        localStorage.setItem('ferreteria_settings_p12_filename', file.name);
        localStorage.setItem('ferreteria_settings_p12_filesize', `${(file.size / 1024).toFixed(1)} KB`);
      } catch (err) {}

      showToast(`Certificado digital "${file.name}" cargado y convertido a Base64 exitosamente.`, 'success');
    };
    reader.onerror = () => {
      showAlert('Ocurrió un error al leer el archivo .p12. Intente nuevamente.', 'Error de Lectura', 'error');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveSignature = () => {
    showConfirm(
      '¿Está seguro de eliminar el certificado digital actual? Deberá cargar un nuevo archivo .p12 para firmar facturas electrónicas del SRI.',
      () => {
        setSignatureBase64('');
        setSignatureFileName('');
        setSignatureFileSize('');
        setSignaturePassword('');
        setSignatureUploadDate('');
        try {
          localStorage.removeItem('ferreteria_settings_p12_base64');
          localStorage.removeItem('ferreteria_settings_p12_filename');
          localStorage.removeItem('ferreteria_settings_p12_password');
        } catch (err) {}
        showToast('Certificado digital eliminado.', 'info');
      },
      'Eliminar Firma Electrónica'
    );
  };

  const handleCopyBase64 = () => {
    if (!signatureBase64) return;
    navigator.clipboard.writeText(signatureBase64);
    setCopiedBase64(true);
    showToast('Cadena Base64 copiada al portapapeles.', 'success');
    setTimeout(() => setCopiedBase64(false), 2500);
  };

  const handleTestBackendConnection = async () => {
    setIsTestingBackend(true);
    SriBackendService.setBaseUrl(sriApiUrl || 'http://localhost:8080/api/sri');
    const result = await SriBackendService.testConnection();
    setIsTestingBackend(false);
    setBackendStatus({ tested: true, ok: result.ok, message: result.message });
    if (result.ok) {
      showToast(result.message, 'success');
    } else {
      showAlert(result.message, 'Error de Conexión', 'error');
    }
  };

  const handleDownloadSampleXml = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const fechaEmision = `${day}/${month}/${year}`;

    const sampleData = {
      rucEmisor: formData.taxId || (formData as any).ruc || '1790012345001',
      razonSocialEmisor: formData.legalName || formData.storeName || 'FERRETERÍA DAYNET',
      nombreComercialEmisor: formData.storeName || 'FERRETERÍA DAYNET',
      dirMatriz: formData.address || 'Quito, Ecuador',
      estab: establishment || '001',
      ptoEmi: emissionPoint || '001',
      secuencial: (secInvoice || '1').padStart(9, '0'),
      fechaEmision,
      ambiente: sriMode === 'PRODUCCION' ? ('2' as const) : ('1' as const),
      cliente: {
        razonSocial: 'CONSUMIDOR FINAL',
        identificacion: '9999999999999',
        direccion: 'Quito, Ecuador',
        email: 'cliente@gmail.com',
      },
      items: [
        {
          codigo: 'MART-16',
          descripcion: 'Martillo de Uña 16oz Mango Fibra',
          cantidad: 1,
          precioUnitario: 12.50,
          descuento: 0,
          ivaRate: 15,
        }
      ],
      formaPago: '01',
      tipoComprobante: '01',
      obligadoContabilidad: 'NO',
    };

    const { xml, claveAcceso } = generateInvoiceXML(sampleData);
    downloadXML(xml, `factura_sri_${claveAcceso}.xml`);
    showToast(`XML de prueba generado con clave: ${claveAcceso}`, 'success');
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email || !newUser.username || !newUser.password) return;
    setUsersList([
      ...usersList,
      {
        id: `USR-0${usersList.length + 1}`,
        name: newUser.name,
        email: newUser.email,
        username: newUser.username,
        role: newUser.role,
        status: 'Activo',
        password: newUser.password
      }
    ]);
    setNewUser({ name: '', email: '', username: '', role: 'Vendedor', password: '' });
    setShowAddUserModal(false);
  };

  const currentTab = subTab === 'SETTINGS' ? 'CFG_EMPRESA' : subTab;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* SUCCESS ALERTS */}
      {savedSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl text-xs font-black flex items-center justify-between shadow-lg animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>Configuración y parámetros actualizados correctamente en el sistema.</span>
          </div>
        </div>
      )}

      {/* 1. CONFIGURACIÓN DE EMPRESA / DATOS FISCALES */}
      {(currentTab === 'CFG_EMPRESA') && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center space-x-3.5">
              <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">Datos Fiscales de la Empresa</h2>
                <p className="text-xs text-slate-400 font-medium">Información legal y tributaria de la matriz según registro SRI</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* LOGO EMPRESARIAL UPLOADER */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-orange-400" />
                    <span>Logo Oficial de la Empresa</span>
                  </label>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Se reflejará en la barra superior del sistema, pantalla de inicio y en la cabecera de todas las Facturas, Notas de Venta y RIDE del SRI.
                  </p>
                </div>
                {formData.logoUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar Logo</span>
                  </button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-5 pt-2">
                <div className="w-32 h-32 rounded-2xl bg-slate-900 border-2 border-dashed border-slate-700 flex items-center justify-center p-2 relative group overflow-hidden shrink-0">
                  {formData.logoUrl ? (
                    <img
                      src={formData.logoUrl}
                      alt="Logo Empresa"
                      className="w-full h-full object-contain rounded-xl"
                    />
                  ) : (
                    <div className="text-center p-3">
                      <ImageIcon className="w-8 h-8 text-slate-500 mx-auto mb-1 stroke-1" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Sin Logo</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 flex-1 w-full">
                  <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold rounded-xl text-xs transition cursor-pointer active:scale-95 shadow-md">
                    <Upload className="w-4 h-4 text-orange-400" />
                    <span>{formData.logoUrl ? 'Cambiar Logo de la Empresa' : 'Subir Logo (PNG, JPG, SVG)'}</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/jpg, image/svg+xml, image/webp"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[10px] text-slate-500">
                    Formato recomendado: PNG con fondo transparente o SVG de alta resolución (máx. 2MB).
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Nombre Comercial *</label>
                <input
                  type="text"
                  required
                  value={formData.storeName}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-white rounded-xl text-xs focus:outline-none focus:border-orange-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Razón Social Legal *</label>
                <input
                  type="text"
                  required
                  value={formData.legalName}
                  onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-white rounded-xl text-xs focus:outline-none focus:border-orange-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">RUC / Identificación Fiscal *</label>
                <input
                  type="text"
                  required
                  value={formData.taxId}
                  onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-orange-400 font-mono font-bold rounded-xl text-xs focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Teléfono de Atención</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-white rounded-xl text-xs focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-300 mb-1">Dirección Matriz / Fiscal *</label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-white rounded-xl text-xs focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-black rounded-xl text-xs transition shadow-md shadow-orange-500/20 flex items-center space-x-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Datos de la Empresa</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. FIRMA ELECTRÓNICA SRI (.p12 / Base64) */}
      {currentTab === 'CFG_FIRMA_ELECTRONICA' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center space-x-3.5">
              <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">Firma Electrónica SRI (.p12 / Base64)</h2>
                <p className="text-xs text-slate-400 font-medium">
                  Cargue su archivo de firma digital para la emisión y firmado automático de comprobantes electrónicos XAdES-BES
                </p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-black border flex items-center gap-1.5 ${
              signatureBase64
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}>
              {signatureBase64 ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Firma Vinculada (Base64)</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Sin Firma Digital</span>
                </>
              )}
            </span>
          </div>

          <div className="space-y-6">
            {/* Uploader Box */}
            <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-amber-400" />
                    <span>Archivo de Certificado Digital (.p12 o .pfx)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Al seleccionar el archivo, el sistema lo <strong>convertirá automáticamente a formato Base64</strong> y lo guardará listo para el firmado del SRI.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <label className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-black rounded-xl text-xs transition cursor-pointer shadow-lg shadow-amber-500/20 flex items-center gap-2 active:scale-95">
                    <Upload className="w-4 h-4" />
                    <span>{signatureBase64 ? 'Reemplazar Archivo .p12' : 'Cargar Archivo .p12'}</span>
                    <input
                      type="file"
                      accept=".p12,.pfx,application/x-pkcs12"
                      onChange={handleP12FileUpload}
                      className="hidden"
                    />
                  </label>

                  {signatureBase64 && (
                    <button
                      type="button"
                      onClick={handleRemoveSignature}
                      className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      title="Eliminar Firma"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Status & Metadata Card */}
              {signatureBase64 ? (
                <div className="p-4 bg-slate-900 border border-emerald-500/30 rounded-xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-white font-mono">
                          {signatureFileName || 'firma_electronica.p12'}
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          Tamaño: <strong>{signatureFileSize || 'N/A'}</strong> • Convertido a Base64 ({signatureBase64.length.toLocaleString()} caracteres)
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyBase64}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto border border-slate-700"
                    >
                      {copiedBase64 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedBase64 ? 'Copiado' : 'Copiar Base64'}</span>
                    </button>
                  </div>

                  {/* Base64 String Preview */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">
                      Cadena Base64 Generada (Primeros 160 caracteres):
                    </label>
                    <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-amber-400/90 break-all select-all">
                      {signatureBase64.slice(0, 160)}...
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5 border-2 border-dashed border-slate-800 rounded-xl text-center space-y-2">
                  <Key className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-400">Ningún archivo de firma .p12 seleccionado</p>
                  <p className="text-[10px] text-slate-500 max-w-md mx-auto">
                    Haga clic en el botón superior para seleccionar su archivo de certificado emitido por el Banco Central del Ecuador, Security Data, ANF, UANATACA, etc.
                  </p>
                </div>
              )}
            </div>

            {/* Password Configuration */}
            <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Lock className="w-4 h-4 text-purple-400" />
                <span>Contraseña del Certificado Digital</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Ingrese la contraseña proporcionada por la entidad certificadora al momento de emitir su firma electrónica. Esta clave se usará para desencriptar el certificado durante el firmado XML del SRI.
              </p>

              <div className="max-w-md relative">
                <input
                  type={showSignaturePassword ? 'text' : 'password'}
                  value={signaturePassword}
                  onChange={(e) => {
                    setSignaturePassword(e.target.value);
                    try {
                      localStorage.setItem('ferreteria_settings_p12_password', e.target.value);
                    } catch (err) {}
                  }}
                  placeholder="Ingrese la contraseña de su archivo .p12"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSignaturePassword(!showSignaturePassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer p-1"
                >
                  {showSignaturePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Ambiente SRI (Pruebas / Producción) */}
            <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-amber-400" />
                    <span>Ambiente de Emisión SRI (Ecuador)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Seleccione si desea emitir facturas en el servidor de <strong>PRUEBAS (celcer.sri.gob.ec)</strong> para ensayos, o en <strong>PRODUCCIÓN (cel.sri.gob.ec)</strong> con validez tributaria real.
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase border ${
                  sriMode === 'PRODUCCION' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}>
                  {sriMode}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSriMode('PRUEBAS');
                    showToast('Ambiente cambiado a PRUEBAS (celcer.sri.gob.ec)', 'info');
                  }}
                  className={`p-4 rounded-xl border text-left transition cursor-pointer ${
                    sriMode === 'PRUEBAS'
                      ? 'bg-amber-500/10 border-amber-500/40 ring-2 ring-amber-500/30'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-white">1. AMBIENTE DE PRUEBAS</span>
                    {sriMode === 'PRUEBAS' && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Servidor oficial de homologación del SRI (celcer). No genera obligaciones fiscales ni débitos.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSriMode('PRODUCCION');
                    showToast('Ambiente cambiado a PRODUCCIÓN (cel.sri.gob.ec)', 'warning');
                  }}
                  className={`p-4 rounded-xl border text-left transition cursor-pointer ${
                    sriMode === 'PRODUCCION'
                      ? 'bg-purple-500/10 border-purple-500/40 ring-2 ring-purple-500/30'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-white">2. AMBIENTE DE PRODUCCIÓN</span>
                    {sriMode === 'PRODUCCION' && <CheckCircle2 className="w-4 h-4 text-purple-400" />}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Servidor en vivo del SRI (cel). Cada comprobante emitido es legalmente válido y reportado al SRI.
                  </p>
                </button>
              </div>
            </div>

            {/* Java Backend API SRI Connection */}
            <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Server className="w-4 h-4 text-cyan-400" />
                    <span>Conexión con Backend Java SRI (Spring Boot)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Indique la URL de su API en Spring Boot para realizar el firmado XAdES-BES y la transmisión a los Web Services del SRI.
                  </p>
                </div>

                {backendStatus.tested && (
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${
                    backendStatus.ok
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}>
                    {backendStatus.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    <span>{backendStatus.ok ? 'Backend Java Activo (200 OK)' : 'Error de Conexión'}</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="md:col-span-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">URL del Backend Local Java (Spring Boot)</label>
                    <span className="text-[10px] font-mono text-cyan-400">
                      Puerto predeterminado: :8080
                    </span>
                  </div>
                  <input
                    type="text"
                    value={sriApiUrl}
                    onChange={(e) => setSriApiUrl(e.target.value)}
                    placeholder="http://localhost:8080"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={handleTestBackendConnection}
                    disabled={isTestingBackend}
                    className="w-full px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingBackend ? 'animate-spin' : ''}`} />
                    <span>{isTestingBackend ? 'Probando...' : 'Probar Conexión'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadSampleXml}
                    className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700 whitespace-nowrap"
                    title="Descargar XML de prueba para verificar sintaxis del SRI"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>Descargar XML</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Technical Information Box */}
            <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl space-y-2 text-xs text-slate-300">
              <h4 className="font-bold text-blue-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>¿Cómo funciona el firmado digital y la transmisión al SRI?</span>
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                El ERP genera el XML de la factura con la <strong>Clave de Acceso de 49 dígitos (Módulo 11)</strong> y se comunica con su backend Java en <code>{sriApiUrl || 'http://localhost:8080/api/sri'}</code>. El backend firma el XML con su certificado digital <strong>PKCS#12 (.p12 en Base64)</strong> bajo el estándar <strong>XAdES-BES</strong> y lo envía a los Web Services del SRI tanto en ambiente de <strong>Pruebas</strong> como de <strong>Producción</strong>.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  SriBackendService.setBaseUrl(sriApiUrl);
                  setSavedSuccess(true);
                  showToast('Firma electrónica, contraseña y URL de Backend guardadas exitosamente.', 'success');
                  setTimeout(() => setSavedSuccess(false), 3000);
                }}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-black rounded-xl text-xs transition shadow-md shadow-amber-500/20 flex items-center space-x-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Configuración de Firma & API</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. PUNTO DE EMISIÓN */}
      {currentTab === 'CFG_PUNTO_EMISION' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center space-x-3.5">
              <div className="p-3 bg-purple-500/10 text-purple-400 rounded-2xl border border-purple-500/20">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">Establecimientos & Puntos de Emisión SRI</h2>
                <p className="text-xs text-slate-400 font-medium">Configuración de series de comprobantes electrónicos y firma digital</p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-black border ${
              sriMode === 'PRODUCCION' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}>
              Ambiente: {sriMode}
            </span>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Establecimiento</label>
                <input 
                  type="text" 
                  value={establishment}
                  onChange={(e) => setEstablishment(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-purple-500 text-center"
                />
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Punto de Emisión</label>
                <input 
                  type="text" 
                  value={emissionPoint}
                  onChange={(e) => setEmissionPoint(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-purple-500 text-center"
                />
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Ambiente SRI</label>
                <Select 
                  value={sriMode}
                  onChange={(e) => setSriMode(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="PRODUCCION">PRODUCCIÓN (Facturación Real)</option>
                  <option value="PRUEBAS">PRUEBAS (Pruebas SRI)</option>
                </Select>
              </div>
            </div>

            <div className="p-5 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-400" />
                  <span>Secuenciales de Comprobantes Activos</span>
                </h3>
                <span className="text-[10px] text-slate-400">
                  Establecimiento y punto configurados: <strong className="text-purple-400 font-mono">{establishment.padStart(3, '0')}-{emissionPoint.padStart(3, '0')}</strong>
                </span>
              </div>

              {/* Live Preview Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-900/90 rounded-xl border border-slate-800/80">
                <div>
                  <span className="text-[9px] uppercase font-extrabold text-slate-400 block">Próxima Factura SRI</span>
                  <span className="font-mono text-xs font-black text-emerald-400">
                    {establishment.padStart(3, '0')}-{emissionPoint.padStart(3, '0')}-{secInvoice.padStart(9, '0')}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-extrabold text-slate-400 block">Próxima Nota de Venta</span>
                  <span className="font-mono text-xs font-black text-amber-400">
                    #{secBoleta.padStart(6, '0')}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-extrabold text-slate-400 block">Próxima Cotización</span>
                  <span className="font-mono text-xs font-black text-cyan-400">
                    COT-{secQuote.padStart(6, '0')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Secuencial Facturas SRI (9 dígitos)</label>
                  <input 
                    type="text" 
                    value={secInvoice}
                    onChange={(e) => setSecInvoice(e.target.value)}
                    placeholder="000000001"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-400 text-center"
                  />
                  <span className="text-[9px] text-slate-500 mt-1 block">Formato: {establishment.padStart(3, '0')}-{emissionPoint.padStart(3, '0')}-000000001</span>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Secuencial Notas de Venta (6 dígitos)</label>
                  <input 
                    type="text" 
                    value={secBoleta}
                    onChange={(e) => setSecBoleta(e.target.value)}
                    placeholder="000001"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-400 text-center"
                  />
                  <span className="text-[9px] text-slate-500 mt-1 block">Formato: #000001</span>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Secuencial Cotizaciones (6 dígitos)</label>
                  <input 
                    type="text" 
                    value={secQuote}
                    onChange={(e) => setSecQuote(e.target.value)}
                    placeholder="000001"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-cyan-400 text-center"
                  />
                  <span className="text-[9px] text-slate-500 mt-1 block">Formato: COT-000001</span>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Secuencial Notas de Crédito SRI</label>
                  <input 
                    type="text" 
                    value={secCreditNote}
                    onChange={(e) => setSecCreditNote(e.target.value)}
                    placeholder="000000001"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-rose-400 text-center"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Secuencial Retenciones SRI</label>
                  <input 
                    type="text" 
                    value={secRetention}
                    onChange={(e) => setSecRetention(e.target.value)}
                    placeholder="000000001"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-indigo-400 text-center"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => {
                  setSavedSuccess(true);
                  showToast('Puntos de emisión y secuenciales guardados exitosamente', 'success');
                  setTimeout(() => setSavedSuccess(false), 3000);
                }}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black rounded-xl text-xs transition shadow-md shadow-purple-600/20 flex items-center space-x-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Puntos de Emisión & Secuenciales</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. IMPUESTOS */}
      {currentTab === 'CFG_IMPUESTOS' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center space-x-3.5">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
                <Percent className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">Configuración de Impuestos & Retenciones</h2>
                <p className="text-xs text-slate-400 font-medium">Tasas de IVA vigente, retenciones en la fuente e ICE</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <label className="block text-xs font-bold text-slate-300">Tasa de Impuesto IVA Vendedor (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.defaultTaxRate}
                  onChange={(e) => setFormData({ ...formData, defaultTaxRate: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-800 text-emerald-400 font-mono font-black text-lg text-center rounded-xl py-2"
                />
                <span className="block text-[10px] text-slate-400">Tarifa general aplicada en Ecuador (15%)</span>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <label className="block text-xs font-bold text-slate-300">Símbolo Monetario Predeterminado</label>
                <input
                  type="text"
                  value={formData.currencySymbol}
                  onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 text-white font-mono font-bold text-center rounded-xl py-2"
                />
                <span className="block text-[10px] text-slate-400">Moneda contable predeterminada ($ USD)</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-xl text-xs transition shadow-md shadow-emerald-600/20 flex items-center space-x-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Parámetros Tributarios</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. CAJA */}
      {currentTab === 'CFG_CAJA' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center space-x-3.5">
              <div className="p-3 bg-teal-500/10 text-teal-400 rounded-2xl border border-teal-500/20">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">Configuración de Cajas & Cierres</h2>
                <p className="text-xs text-slate-400 font-medium">Límites de efectivo, fondo de caja chica y políticas de arqueo</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <label className="text-xs font-bold text-slate-300">Base Inicial en Efectivo por Defecto ($)</label>
              <input 
                type="number"
                defaultValue={100.00}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-teal-400"
              />
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <label className="text-xs font-bold text-slate-300">Límite Máximo de Efectivo en Caja ($)</label>
              <input 
                type="number"
                defaultValue={1000.00}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-400"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              onClick={() => {
                setSavedSuccess(true);
                setTimeout(() => setSavedSuccess(false), 3000);
              }}
              className="px-6 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-black rounded-xl text-xs transition shadow-md shadow-teal-600/20 flex items-center space-x-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Configuración de Caja</span>
            </button>
          </div>
        </div>
      )}

      {/* 5. FORMAS DE PAGO */}
      {currentTab === 'CFG_FORMAS_PAGO' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center space-x-3.5">
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">Catálogo de Formas de Pago SRI</h2>
                <p className="text-xs text-slate-400 font-medium">Métodos de cobro homologados con la ficha técnica del SRI Ecuador</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {paymentMethods.map((pm) => (
              <div key={pm.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="font-mono text-xs font-black text-orange-400 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                    [{pm.code}]
                  </span>
                  <span className="text-xs font-bold text-white">{pm.name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-0.5 text-[10px] font-black rounded ${
                    pm.active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {pm.active ? 'HABILITADO' : 'INACTIVO'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. USUARIOS */}
      {currentTab === 'CFG_USUARIOS' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center space-x-3.5">
              <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-2xl border border-cyan-500/20">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">Gestión de Usuarios & Roles</h2>
                <p className="text-xs text-slate-400 font-medium">Control de acceso, permisos y cuentas de cajeros y vendedores</p>
              </div>
            </div>

            <button
              onClick={() => setShowAddUserModal(true)}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-cyan-600/20 flex items-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>NUEVO USUARIO</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Nombre</th>
                  <th className="p-3">Cédula / RUC</th>
                  <th className="p-3">Correo Electrónico</th>
                  <th className="p-3">Rol Asignado</th>
                  <th className="p-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {usersList.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3 font-mono font-bold text-slate-400">{u.id}</td>
                    <td className="p-3 font-bold text-white">{u.name}</td>
                    <td className="p-3 font-mono text-amber-500 font-bold">{u.username || 'N/A'}</td>
                    <td className="p-3 text-cyan-400 font-mono">{u.email}</td>
                    <td className="p-3">
                      <span className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-[11px] font-bold">
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        {u.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ADD USER MODAL */}
          {showAddUserModal && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-cyan-400" />
                  <span>Crear Nuevo Usuario</span>
                </h3>

                <form onSubmit={handleAddUser} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Nombre Completo</label>
                    <input 
                      type="text"
                      required
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Cédula o RUC</label>
                    <input 
                      type="text"
                      required
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Correo Electrónico</label>
                    <input 
                      type="email"
                      required
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Rol</label>
                    <Select
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      <option value="Administrador">Administrador</option>
                      <option value="Cajero">Cajero</option>
                      <option value="Vendedor">Vendedor</option>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">Contraseña</label>
                    <input 
                      type="password"
                      required
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button 
                      type="button"
                      onClick={() => setShowAddUserModal(false)}
                      className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      className="px-4 py-2 bg-cyan-600 text-white text-xs font-bold rounded-xl"
                    >
                      Guardar Usuario
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7. FORMATO DE IMPRESIÓN */}
      {currentTab === 'CFG_FORMATO_IMPRESION' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center space-x-3.5">
              <div className="p-3 bg-rose-500/10 text-rose-400 rounded-2xl border border-rose-500/20">
                <Printer className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">Formato de Impresión & RIDE</h2>
                <p className="text-xs text-slate-400 font-medium">Plantillas de tickets térmicos, hojas A4 e impresión de código QR SRI</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => setPrintFormat('TICKET_80MM')}
                className={`p-4 rounded-2xl border text-left cursor-pointer transition ${
                  printFormat === 'TICKET_80MM' ? 'bg-orange-500/10 border-orange-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <div className="font-bold text-xs uppercase mb-1">Ticket Térmico 80mm</div>
                <div className="text-[10px] text-slate-400">Impresoras POS estándar de ticket continuo</div>
              </button>

              <button
                type="button"
                onClick={() => setPrintFormat('TICKET_58MM')}
                className={`p-4 rounded-2xl border text-left cursor-pointer transition ${
                  printFormat === 'TICKET_58MM' ? 'bg-orange-500/10 border-orange-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <div className="font-bold text-xs uppercase mb-1">Ticket Térmico 58mm</div>
                <div className="text-[10px] text-slate-400">Impresoras portátiles / Bluetooth compactas</div>
              </button>

              <button
                type="button"
                onClick={() => setPrintFormat('RIDE_A4')}
                className={`p-4 rounded-2xl border text-left cursor-pointer transition ${
                  printFormat === 'RIDE_A4' ? 'bg-orange-500/10 border-orange-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <div className="font-bold text-xs uppercase mb-1">Hoja A4 / PDF (RIDE SRI)</div>
                <div className="text-[10px] text-slate-400">Comprobante de representación impresa SRI en PDF</div>
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Pie de Página / Garantías en Comprobante</label>
              <textarea
                rows={3}
                value={formData.footerNotes}
                onChange={(e) => setFormData({ ...formData, footerNotes: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl p-3 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-black rounded-xl text-xs transition shadow-md shadow-rose-600/20 flex items-center space-x-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Plantilla de Impresión</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 8. ADMINISTRACIÓN */}
      {currentTab === 'CFG_ADMINISTRACION' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center space-x-3.5">
              <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
                <Sliders className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">Parámetros de Administración General</h2>
                <p className="text-xs text-slate-400 font-medium">Políticas de inventario, seguridad y validación de stock</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-white">Permitir Ventas con Inventario Negativo</div>
                <div className="text-[10px] text-slate-400">Permite emitir comprobantes de productos sin stock registrado en sistema</div>
              </div>
              <button 
                type="button"
                onClick={() => setAllowNegativeStock(!allowNegativeStock)}
                className={`p-1.5 rounded-xl border font-bold text-xs cursor-pointer ${
                  allowNegativeStock ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}
              >
                {allowNegativeStock ? 'PERMITIDO' : 'BLOQUEADO'}
              </button>
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-white">Alertas de Stock Mínimo en POS</div>
                <div className="text-[10px] text-slate-400">Muestra una notificación en caja al vender artículos cerca de agotarse</div>
              </div>
              <button 
                type="button"
                onClick={() => setMinStockAlert(!minStockAlert)}
                className={`p-1.5 rounded-xl border font-bold text-xs cursor-pointer ${
                  minStockAlert ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}
              >
                {minStockAlert ? 'ACTIVO' : 'INACTIVO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. BACKUP */}
      {currentTab === 'CFG_BACKUP' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center space-x-3.5">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">Respaldo & Copia de Seguridad</h2>
                <p className="text-xs text-slate-400 font-medium">Exportación de datos de la empresa, productos, clientes y facturas</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center space-x-3">
                <Download className="w-5 h-5 text-emerald-400" />
                <h3 className="text-xs font-bold text-white uppercase">Descargar Copia de Seguridad JSON</h3>
              </div>
              <p className="text-[10px] text-slate-400">
                Exporta la base de datos completa con inventario, clientes, historial de facturas y configuración en un archivo .json de respaldo.
              </p>
              <button
                onClick={() => showAlert("Descargando archivo de respaldo de base de datos (backup.json)...", "Copia de Seguridad", "success")}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                EXPORTAR BACKUP AHORA
              </button>
            </div>

            <div className="p-5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center space-x-3">
                <Upload className="w-5 h-5 text-blue-400" />
                <h3 className="text-xs font-bold text-white uppercase">Restaurar Copia de Seguridad</h3>
              </div>
              <p className="text-[10px] text-slate-400">
                Selecciona un archivo .json de copia de seguridad previo para restaurar los datos del sistema.
              </p>
              <button
                onClick={() => showAlert("Seleccione el archivo JSON para importar la copia de seguridad.", "Restaurar Backup", "info")}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                RESTAURAR DESDE ARCHIVO
              </button>
            </div>
          </div>

          {/* DANGER ZONE: CLEAN ALL MOCK DATA */}
          <div className="p-5 bg-rose-950/20 border border-rose-800/40 rounded-xl space-y-3">
            <div className="flex items-center space-x-3 text-rose-400">
              <Trash2 className="w-5 h-5" />
              <h3 className="text-xs font-bold uppercase">Limpiar Todos los Datos de Prueba</h3>
            </div>
            <p className="text-[11px] text-slate-300">
              Elimina permanentemente del almacenamiento local todos los clientes de prueba, productos, facturas, compras, proveedores y registros para dejar el sistema listo para producción a cero.
            </p>
            <button
              onClick={() => {
                showConfirm(
                  "¿Está seguro de que desea eliminar TODOS los datos de prueba del sistema? Esta acción dejará las tablas vacías.",
                  () => {
                    if (onClearAllData) {
                      onClearAllData();
                    } else {
                      localStorage.clear();
                      window.location.reload();
                    }
                  },
                  "Limpiar Base de Datos",
                  "Sí, Eliminar Todo",
                  "Cancelar"
                );
              }}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-rose-600/30 flex items-center space-x-2 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>ELIMINAR TODOS LOS DATOS DE PRUEBA (RESTABLECER SISTEMA)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
