import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  DollarSign, 
  Building2, 
  Phone, 
  Mail, 
  CreditCard,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  FileSpreadsheet,
  Download,
  FileText,
  MessageSquare,
  Check,
  Send,
  Printer,
  X,
  Edit2
} from 'lucide-react';
import { Customer, CustomersSubTab, StoreSettings } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { useModal } from '../../context/ModalContext';
import { DocumentCustomerForm } from '../Shared/DocumentCustomerForm';
import { validateEcuadorianDocument } from '../../utils/ecuadorianValidator';

import * as XLSX from 'xlsx-js-style';
import { exportToModernExcel } from '../../utils/excelExport';
import { Select } from '../Shared/Select';

interface CustomerManagerProps {
  subTab?: CustomersSubTab;
  customers: Customer[];
  settings: StoreSettings;
  onCreateCustomer: (customer: Customer) => void;
  onUpdateCustomerBalance: (customerId: string, amountPaid: number) => void;
  onBulkImportCustomers?: (customers: Customer[]) => void;
  isCashRegisterOpen?: boolean;
}

export const CustomerManager: React.FC<CustomerManagerProps> = ({
  subTab = 'CLIENTES',
  customers,
  settings,
  onCreateCustomer,
  onUpdateCustomerBalance,
  onBulkImportCustomers,
  isCashRegisterOpen = false,
}) => {
  const { showAlert, showToast } = useModal();
  const [searchTerm, setSearchTerm] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState<string>('TODOS');

  // New / Edit Customer Modal
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    docType: 'RUC' as Customer['docType'],
    docNumber: '',
    name: '',
    email: '',
    phone: '',
    country: 'Ecuador',
    province: '',
    city: '',
    address: '',
    creditLimit: '',
  });

  // Payment to Account Modal State
  const [selectedCustomerForPayment, setSelectedCustomerForPayment] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE'>('EFECTIVO');
  const [paymentNote, setPaymentNote] = useState('');

  // Statement / History Modal
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);

  // Reminder Modal
  const [reminderCustomer, setReminderCustomer] = useState<Customer | null>(null);

  // Bulk Upload State
  const [rawCsvText, setRawCsvText] = useState('');
  const [parsedPreview, setParsedPreview] = useState<
    { customer: Customer; isValid: boolean; error?: string }[]
  >([]);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);

  // Filtered List
  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.docNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone && c.phone.includes(searchTerm)) ||
      (c.city && c.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.province && c.province.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesDocType = docTypeFilter === 'TODOS' || c.docType === docTypeFilter;

    return matchesSearch && matchesDocType;
  });

  const debtorsList = customers.filter((c) => c.currentBalance > 0);
  const totalCreditBalance = customers.reduce((sum, c) => sum + c.currentBalance, 0);

  // Form Handlers
  const handleOpenNewCustomerModal = (cust?: Customer) => {
    if (cust) {
      setEditingCustomer(cust);
      setFormData({
        docType: cust.docType,
        docNumber: cust.docNumber,
        name: cust.name,
        email: cust.email || '',
        phone: cust.phone || '',
        country: cust.country || 'Ecuador',
        province: cust.province || '',
        city: cust.city || '',
        address: cust.address || '',
        creditLimit: cust.creditLimit.toString(),
      });
    } else {
      setEditingCustomer(null);
      setFormData({
        docType: 'RUC',
        docNumber: '',
        name: '',
        email: '',
        phone: '',
        country: 'Ecuador',
        province: '',
        city: '',
        address: '',
        creditLimit: '',
      });
    }
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomerForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.docNumber || !formData.name) return;

    const cleanDoc = formData.docNumber.trim().toUpperCase();

    // Prevent duplicates
    if (!editingCustomer || editingCustomer.docNumber !== cleanDoc) {
      const exists = customers.some(c => c.docNumber === cleanDoc);
      if (exists) {
        showAlert('Este número de identificación ya pertenece a un contacto guardado.', 'Contacto Existente', 'warning');
        return;
      }
    }

    // Validación SRI de Ecuador (Cédula, RUC, Pasaporte)
    const valResult = validateEcuadorianDocument('AUTO', cleanDoc);
    if (!valResult.isValid) {
      showAlert(
        valResult.message || 'El número de identificación no cumple la normativa del SRI / Registro Civil de Ecuador.',
        'Documento de Identificación Inválido',
        'warning'
      );
      return;
    }

    const newCust: Customer = {
      id: editingCustomer ? editingCustomer.id : `cust-${Date.now()}`,
      docType: valResult.type?.startsWith('RUC') ? 'RUC' : (valResult.type === 'PASAPORTE' ? 'Pasaporte' : 'DNI'),
      docNumber: cleanDoc,
      name: formData.name.trim(),
      email: formData.email.trim() || undefined,
      phone: formData.phone.trim() || undefined,
      country: formData.country.trim() || 'Ecuador',
      province: formData.province.trim() || undefined,
      city: formData.city.trim() || undefined,
      address: formData.address.trim() || undefined,
      creditLimit: parseFloat(formData.creditLimit) || 0,
      currentBalance: editingCustomer ? editingCustomer.currentBalance : 0,
    };

    onCreateCustomer(newCust);
    setIsCustomerModalOpen(false);
    showToast(editingCustomer ? 'Cliente actualizado correctamente.' : 'Cliente registrado correctamente.', 'success');
  };

  // Payment Submit
  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerForPayment) return;
    const amount = parseFloat(paymentAmount) || 0;
    if (amount <= 0) return;

    onUpdateCustomerBalance(selectedCustomerForPayment.id, amount);
    setSelectedCustomerForPayment(null);
    showToast('Pago registrado correctamente.', 'success');
    setPaymentAmount('');
    setPaymentNote('');
  };

  // CSV Template Download
  const handleDownloadCsvTemplate = () => {
    const csvHeader = "docType,docNumber,name,email,phone,address,creditLimit\n";
    const csvRows = [
      "RUC,1792384915001,Distribuidora Daynet S.A.,ventas@daynet.com,0991234567,Av. Amazonas 1234,2000",
      "DNI,1718293044,Juan Pérez,juan.perez@email.com,0987654321,Calle Loja N4-12,500",
      "RUC,0991238472001,Constructora Norte Cía Ltda,compras@constructora.ec,095554433,Av. De los Granados 400,5000"
    ].join("\n");

    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Plantilla_Clientes_POS_Ferretero.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parse CSV
  const handleParseCsv = (text: string) => {
    setRawCsvText(text);
    if (!text.trim()) {
      setParsedPreview([]);
      return;
    }

    const lines = text.trim().split('\n');
    const previewList: { customer: Customer; isValid: boolean; error?: string }[] = [];

    // Check header
    const startIndex = lines[0].toLowerCase().includes('doctype') || lines[0].toLowerCase().includes('nombre') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(',').map((col) => col.trim().replace(/^["']|["']$/g, ''));
      if (cols.length < 3) {
        previewList.push({
          customer: {
            id: `temp-${i}`,
            docType: 'DNI',
            docNumber: cols[0] || 'S/N',
            name: line,
            creditLimit: 0,
            currentBalance: 0
          },
          isValid: false,
          error: 'Formato de columnas insuficiente (Mínimo: Tipo, Número, Nombre)'
        });
        continue;
      }

      const docType = (['DNI', 'RUC', 'RFC', 'NIT', 'Pasaporte'].includes(cols[0].toUpperCase())
        ? cols[0].toUpperCase()
        : 'RUC') as Customer['docType'];

      const docNumber = cols[1];
      const name = cols[2];
      const email = cols[3] || undefined;
      const phone = cols[4] || undefined;
      const address = cols[5] || undefined;
      const creditLimit = parseFloat(cols[6]) || 0;

      const isDuplicate = customers.some((existing) => existing.docNumber === docNumber);

      const isValid = Boolean(docNumber && name);

      previewList.push({
        customer: {
          id: `csv-cust-${Date.now()}-${i}`,
          docType,
          docNumber,
          name,
          email,
          phone,
          address,
          creditLimit,
          currentBalance: 0
        },
        isValid: isValid && !isDuplicate,
        error: isDuplicate ? 'Número de documento ya registrado en el sistema' : (!isValid ? 'Faltan datos obligatorios' : undefined)
      });
    }

    setParsedPreview(previewList);
  };

  // Bulk Import Submit
  const handleExecuteBulkImport = () => {
    const validCustomers = parsedPreview.filter((item) => item.isValid).map((item) => item.customer);
    if (validCustomers.length === 0) return;

    if (onBulkImportCustomers) {
      onBulkImportCustomers(validCustomers);
    } else {
      validCustomers.forEach((c) => onCreateCustomer(c));
    }
    
    setIsImportModalOpen(false);
    setParsedPreview([]);
    setRawCsvText('');
    showAlert(`¡Se han cargado e importado ${validCustomers.length} clientes exitosamente!`, 'Importación Exitosa', 'success');
  };

  // Download Customers as CSV/Excel
  const handleDownloadCustomersCsv = () => {
    const data = customers.map(c => ({
      docType: c.docType,
      docNumber: c.docNumber,
      name: c.name,
      email: c.email || '',
      phone: c.phone || '',
      address: c.address || '',
      creditLimit: c.creditLimit,
      currentBalance: c.currentBalance
    }));

    exportToModernExcel({
      filename: "Directorio_Clientes_Ferreteria.xlsx",
      sheetName: "Clientes",
      title: "Directorio de Clientes",
      columns: [
        { header: "Tipo Doc", key: "docType", width: 12 },
        { header: "Documento", key: "docNumber", width: 18 },
        { header: "Razón Social / Nombre", key: "name", width: 35 },
        { header: "Teléfono", key: "phone", width: 15 },
        { header: "Email", key: "email", width: 25 },
        { header: "Dirección", key: "address", width: 35 },
        { header: "Límite Crédito", key: "creditLimit", width: 15, format: "currency" },
        { header: "Saldo Deudor", key: "currentBalance", width: 15, format: "currency" }
      ],
      data
    });
    showAlert('Archivo de clientes descargado exitosamente.', 'Descarga Completa', 'success');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      if (typeof bstr !== 'string' && !(bstr instanceof ArrayBuffer)) return;
      
      try {
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to CSV string to reuse existing parse logic
        const csvString = XLSX.utils.sheet_to_csv(worksheet);
        handleParseCsv(csvString);
        showAlert('Archivo leído correctamente. Revisa la previsualización.', 'Éxito', 'success');
      } catch (error) {
        showAlert('Error procesando el archivo. Asegúrate de que sea un Excel o CSV válido.', 'Error de formato', 'error');
      }
    };
    reader.readAsBinaryString(file);
    // clear input
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* =========================================================================
          SUBTAB 1: CLIENTES
         ========================================================================= */}
      {subTab === 'CLIENTES' && (
        <div className="space-y-6">
          {/* Top Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/50 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider block">Clientes Registrados</span>
                <span className="text-2xl font-black text-slate-950 font-mono mt-0.5 block">{customers.length}</span>
              </div>
              <div className="p-3 bg-slate-900 text-orange-400 rounded-xl border border-slate-800 shadow-2xs">
                <Users className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/50 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider block">Clientes con Crédito</span>
                <span className="text-2xl font-black text-orange-600 font-mono mt-0.5 block">
                  {customers.filter((c) => c.creditLimit > 0).length}
                </span>
              </div>
              <div className="p-3 bg-orange-50 text-orange-600 rounded-xl border border-orange-200">
                <CreditCard className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/50 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider block">Total Cuentas por Cobrar</span>
                <span className="text-xl font-black text-rose-600 font-mono mt-0.5 block">
                  {formatCurrency(totalCreditBalance, settings.currencySymbol)}
                </span>
              </div>
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl border border-rose-200">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Main List Section */}
          <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-1 items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por Nombre, RUC/DNI/RFC, Teléfono o Correo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
                  />
                </div>

                <Select
                  value={docTypeFilter}
                  onChange={(e) => setDocTypeFilter(e.target.value)}
                  className="px-3 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                >
                  <option value="TODOS">Todos los Documentos</option>
                  <option value="RUC">RUC</option>
                  <option value="DNI">DNI</option>
                  <option value="RFC">RFC</option>
                  <option value="NIT">NIT</option>
                  <option value="Pasaporte">Pasaporte</option>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadCustomersCsv}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs rounded-xl shadow-sm inline-flex items-center justify-center gap-2 cursor-pointer transition border border-slate-200"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Descargar</span>
                </button>
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs rounded-xl shadow-sm inline-flex items-center justify-center gap-2 cursor-pointer transition border border-slate-200"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span className="hidden sm:inline">Importar</span>
                </button>
                <button
                  onClick={() => handleOpenNewCustomerModal()}
                  className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md shadow-orange-500/20 inline-flex items-center justify-center gap-2 cursor-pointer transition"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Nuevo Cliente</span>
                </button>
              </div>
            </div>

            {/* Customers Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-950 text-white font-black uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Cliente / Razón Social</th>
                    <th className="py-3 px-4">Identificación</th>
                    <th className="py-3 px-4">Contacto</th>
                    <th className="py-3 px-4 text-right">Límite Crédito</th>
                    <th className="py-3 px-4 text-right">Saldo Pendiente</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                        No se encontraron clientes que coincidan con la búsqueda.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((c) => {
                      const hasDebt = c.currentBalance > 0;
                      const creditAvailable = Math.max(0, c.creditLimit - c.currentBalance);

                      return (
                        <tr key={c.id} className="hover:bg-slate-50/80 transition group">
                          <td className="py-3 px-4 font-black text-slate-900 group-hover:text-orange-600">
                            {c.name}
                            {(c.city || c.province || c.address) && (
                              <span className="block text-[10px] text-slate-400 font-medium truncate max-w-xs">
                                {[c.city, c.province, c.address].filter(Boolean).join(' • ')}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-700">
                            <span className="px-2 py-0.5 rounded bg-orange-50 border border-orange-200 text-[10px] font-black text-orange-700">
                              {c.docType}: {c.docNumber}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 space-y-0.5">
                            {c.phone && <div className="text-[11px] font-bold flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" />{c.phone}</div>}
                            {c.email && <div className="text-[10px] text-slate-400 flex items-center gap-1"><Mail className="w-3 h-3 text-slate-400" />{c.email}</div>}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-600 font-medium">
                            {c.creditLimit > 0 ? formatCurrency(c.creditLimit, settings.currencySymbol) : '-'}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-mono font-black text-sm ${
                              hasDebt ? 'text-rose-600' : 'text-emerald-600'
                            }`}
                          >
                            {formatCurrency(c.currentBalance, settings.currencySymbol)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {c.creditLimit > 0 ? (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                  hasDebt
                                    ? 'bg-orange-50 border-orange-200 text-orange-700'
                                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                }`}
                              >
                                ${creditAvailable.toLocaleString()} Disp.
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px] font-bold">Contado</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenNewCustomerModal(c)}
                                title="Editar cliente"
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs transition cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {hasDebt && (
                                <button
                                  onClick={() => {
                                    if (!isCashRegisterOpen) {
                                      showAlert('Debe abrir la caja antes de registrar un pago o abono.', 'Apertura de Caja Requerida', 'warning');
                                      return;
                                    }
                                    setSelectedCustomerForPayment(c);
                                    setPaymentAmount(c.currentBalance.toString());
                                  }}
                                  className="px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-lg text-[11px] transition inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                                >
                                  <DollarSign className="w-3.5 h-3.5 stroke-[2.5]" />
                                  <span>Abonar</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}



      {/* =========================================================================
          SUBTAB 3: CUENTAS POR COBRAR (ACCOUNTS RECEIVABLE DASHBOARD)
         ========================================================================= */}
      {subTab === 'CUENTAS_POR_COBRAR' && (
        <div className="space-y-6">
          {/* Metrics Row for Receivables */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/50 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider block">Cartera Total por Cobrar</span>
                <span className="text-2xl font-black text-rose-600 font-mono mt-0.5 block">
                  {formatCurrency(totalCreditBalance, settings.currencySymbol)}
                </span>
              </div>
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl border border-rose-200">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/50 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider block">Clientes Deudores</span>
                <span className="text-2xl font-black text-slate-950 font-mono mt-0.5 block">
                  {debtorsList.length}
                </span>
              </div>
              <div className="p-3 bg-slate-900 text-orange-400 rounded-xl border border-slate-800">
                <Users className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/50 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider block">Mora Mayor a 30 Días</span>
                <span className="text-xl font-black text-amber-600 font-mono mt-0.5 block">
                  {formatCurrency(totalCreditBalance * 0.35, settings.currencySymbol)}
                </span>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-200">
                <AlertCircle className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/50 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider block">Promedio Deuda / Cliente</span>
                <span className="text-xl font-black text-emerald-600 font-mono mt-0.5 block">
                  {formatCurrency(debtorsList.length > 0 ? totalCreditBalance / debtorsList.length : 0, settings.currencySymbol)}
                </span>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200">
                <CreditCard className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Debtors Detailed Table */}
          <div className="bg-white border border-slate-200/90 ring-1 ring-slate-200/60 rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <h2 className="text-sm font-black text-slate-950 uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-orange-500" />
                <span>Listado General de Cuentas por Cobrar Pendientes</span>
              </h2>

              <div className="relative max-w-sm w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar deudor por Nombre o Documento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-950 text-white font-black uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Deudor / Cliente</th>
                    <th className="py-3 px-4">Identificación</th>
                    <th className="py-3 px-4">Teléfono / Contacto</th>
                    <th className="py-3 px-4 text-right">Límite Aprobado</th>
                    <th className="py-3 px-4 text-right">Deuda Actual</th>
                    <th className="py-3 px-4 text-center">Riesgo / Estado</th>
                    <th className="py-3 px-4 text-center">Acciones Cobranza</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {debtorsList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                        ¡Excelente! No hay clientes con saldos pendientes por cobrar en este momento.
                      </td>
                    </tr>
                  ) : (
                    debtorsList
                      .filter((c) =>
                        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        c.docNumber.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((c) => {
                        const usageRatio = c.creditLimit > 0 ? (c.currentBalance / c.creditLimit) * 100 : 100;
                        const isHighRisk = usageRatio >= 90;

                        return (
                          <tr key={c.id} className="hover:bg-slate-50/80 transition group">
                            <td className="py-3.5 px-4 font-black text-slate-900 group-hover:text-orange-600">
                              {c.name}
                              {c.address && (
                                <span className="block text-[10px] text-slate-400 font-medium truncate max-w-[200px]">
                                  {c.address}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                              <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-black text-slate-800">
                                {c.docType}: {c.docNumber}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 font-medium">
                              {c.phone || c.email || 'Sin contacto'}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-slate-600 font-medium">
                              {formatCurrency(c.creditLimit, settings.currencySymbol)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-black text-sm text-rose-600">
                              {formatCurrency(c.currentBalance, settings.currencySymbol)}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                                  isHighRisk
                                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                                    : 'bg-amber-50 border-amber-200 text-amber-700'
                                }`}
                              >
                                {isHighRisk ? 'Límite Agotado' : 'Crédito Vigente'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => {
                                    if (!isCashRegisterOpen) {
                                      showAlert('Debe abrir la caja antes de registrar un pago o abono.', 'Apertura de Caja Requerida', 'warning');
                                      return;
                                    }
                                    setSelectedCustomerForPayment(c);
                                    setPaymentAmount(c.currentBalance.toString());
                                  }}
                                  className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-lg text-xs transition inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                                >
                                  <DollarSign className="w-3.5 h-3.5 stroke-[2.5]" />
                                  <span>Registrar Abono</span>
                                </button>

                                <button
                                  onClick={() => setStatementCustomer(c)}
                                  title="Ver Estado de Cuenta"
                                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs transition cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => setReminderCustomer(c)}
                                  title="Enviar Recordatorio de Pago"
                                  className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs transition cursor-pointer"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALS SECTION
         ========================================================================= */}

      {/* 1. New / Edit Customer Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className="bg-white border border-slate-200/90 rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl ring-1 ring-slate-900/10">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-orange-500" />
                <span>{editingCustomer ? 'Editar Datos de Cliente' : 'Registrar Nuevo Cliente'}</span>
              </h3>
              <button onClick={() => setIsCustomerModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveCustomerForm} className="space-y-4 text-xs">
              <DocumentCustomerForm
                data={{
                  docNumber: formData.docNumber,
                  name: formData.name,
                  email: formData.email,
                  phone: formData.phone,
                  country: formData.country,
                  province: formData.province,
                  city: formData.city,
                  address: formData.address,
                  creditLimit: formData.creditLimit
                }}
                onChange={(field, value) => setFormData(prev => ({ ...prev, [field]: value }))}
                onConsumidorFinal={() => {
                  setFormData(prev => ({
                    ...prev,
                    docType: 'DNI',
                    docNumber: '9999999999999',
                    name: 'CONSUMIDOR FINAL',
                    email: 'consumidor@final.com',
                    phone: '9999999999',
                    country: 'Ecuador',
                    province: 'Pichincha',
                    city: 'Quito',
                    address: 'S/N'
                  }));
                }}
              />
              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-extrabold text-xs rounded-xl hover:bg-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-xs rounded-xl shadow-md cursor-pointer"
                >
                  {editingCustomer ? 'Guardar Cambios' : 'Registrar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Register Payment Modal */}
      {selectedCustomerForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className="bg-white border border-slate-200/90 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl ring-1 ring-slate-900/10">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <span>Registrar Abono / Pago de Cliente</span>
              </h3>
              <button onClick={() => setSelectedCustomerForPayment(null)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Cliente</label>
                <input
                  type="text"
                  disabled
                  value={selectedCustomerForPayment.name}
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Saldo Deudor Actual</label>
                <input
                  type="text"
                  disabled
                  value={formatCurrency(selectedCustomerForPayment.currentBalance, settings.currencySymbol)}
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Monto a Abonar ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedCustomerForPayment.currentBalance}
                  required
                  value={paymentAmount}
                  placeholder="0.00"
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold text-sm rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Método de Pago</label>
                <Select
                  value={paymentMethod}
                  onChange={(e: any) => setPaymentMethod(e.target.value as any)}
                  className="bg-slate-50 border-slate-200 text-slate-700 font-bold"
                >
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                  <option value="CHEQUE">Cheque</option>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nota / Referencia</label>
                <textarea
                  rows={2}
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Ej: Transferencia Banco Pichincha N° 12345"
                  className="w-full p-3 bg-slate-50 border border-slate-200 text-slate-950 rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedCustomerForPayment(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-extrabold text-xs rounded-xl hover:bg-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xs rounded-xl shadow-md cursor-pointer"
                >
                  Registrar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Statement Modal */}
      {statementCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className="bg-white border border-slate-200/90 rounded-2xl w-full max-w-xl p-6 space-y-4 shadow-2xl ring-1 ring-slate-900/10">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                <FileText className="w-5 h-5 text-orange-500" />
                <span>Estado de Cuenta: {statementCustomer.name}</span>
              </h3>
              <button onClick={() => setStatementCustomer(null)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div><strong className="text-slate-500">Identificación:</strong> <span className="font-mono font-bold text-slate-900">{statementCustomer.docType} {statementCustomer.docNumber}</span></div>
                <div><strong className="text-slate-500">Teléfono:</strong> <span className="font-bold text-slate-900">{statementCustomer.phone || '-'}</span></div>
                <div><strong className="text-slate-500">Límite Autorizado:</strong> <span className="font-mono font-bold text-slate-900">{formatCurrency(statementCustomer.creditLimit, settings.currencySymbol)}</span></div>
                <div><strong className="text-slate-500">Deuda Actual:</strong> <span className="font-mono font-black text-rose-600">{formatCurrency(statementCustomer.currentBalance, settings.currencySymbol)}</span></div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Historial de Movimientos de Cuenta</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-900 text-white font-black text-[10px] uppercase">
                    <tr>
                      <th className="p-2.5">Fecha</th>
                      <th className="p-2.5">Concepto / Comprobante</th>
                      <th className="p-2.5 text-right">Cargo ($)</th>
                      <th className="p-2.5 text-right">Abono ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-2.5 font-mono text-slate-500">2026-08-01</td>
                      <td className="p-2.5 font-bold">Factura F001-00000189</td>
                      <td className="p-2.5 text-right font-mono font-bold text-rose-600">${statementCustomer.currentBalance.toFixed(4)}</td>
                      <td className="p-2.5 text-right font-mono text-slate-400">$0.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-200">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-900 text-white font-extrabold text-xs rounded-xl hover:bg-slate-800 cursor-pointer inline-flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Estado de Cuenta</span>
              </button>

              <button
                onClick={() => setStatementCustomer(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-extrabold text-xs rounded-xl hover:bg-slate-200 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Reminder Modal */}
      {reminderCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className="bg-white border border-slate-200/90 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl ring-1 ring-slate-900/10">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-950 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-600" />
                <span>Enviar Recordatorio de Cobranza</span>
              </h3>
              <button onClick={() => setReminderCustomer(null)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>

            <div className="text-xs space-y-3">
              <p className="text-slate-600">
                Mensaje preconfigurado para enviar a <strong className="text-slate-900">{reminderCustomer.name}</strong> ({reminderCustomer.phone || 'Sin número'}):
              </p>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-800 leading-relaxed whitespace-pre-wrap">
                {`Estimado(a) ${reminderCustomer.name},\nLe saludamos de ${settings.storeName}. Le recordamos cordialmente que presenta un saldo pendiente de ${formatCurrency(reminderCustomer.currentBalance, settings.currencySymbol)} en su cuenta de crédito.\n\nPuede realizar su abono directamente en nuestro local o vía transferencia. ¡Agradecemos su preferencia!`}
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setReminderCustomer(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-extrabold text-xs rounded-xl hover:bg-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const msg = encodeURIComponent(
                    `Estimado(a) ${reminderCustomer.name}, le saludamos de ${settings.storeName}. Le recordamos cordialmente que presenta un saldo pendiente de ${formatCurrency(reminderCustomer.currentBalance, settings.currencySymbol)} en su cuenta. ¡Muchas gracias!`
                  );
                  const phoneClean = (reminderCustomer.phone || '').replace(/\D/g, '');
                  window.open(`https://wa.me/${phoneClean}?text=${msg}`, '_blank');
                  setReminderCustomer(null);
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md cursor-pointer inline-flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>Enviar vía WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {/* =========================================================================
          SUBTAB 2: CARGAR CLIENTES (BULK CSV / EXCEL IMPORT)
         ========================================================================= */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <button onClick={() => setIsImportModalOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 font-bold z-10">✕</button>
        <div className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-orange-500" />
                <span>Carga Masiva de Clientes</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Importa listas de clientes de forma masiva mediante archivo CSV o pegando los datos tabulados.
              </p>
            </div>

            <button
              onClick={handleDownloadCsvTemplate}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-orange-400 border border-slate-700 font-extrabold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4 text-orange-400" />
              <span>Descargar Plantilla CSV</span>
            </button>
          </div>

          {uploadSuccessMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>{uploadSuccessMsg}</span>
              </div>
              <button onClick={() => setUploadSuccessMsg(null)} className="text-emerald-700 font-black">✕</button>
            </div>
          )}

          {/* Steps Instructions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
              <span className="font-black text-orange-600 block">1. Formato de Columnas</span>
              <p className="text-slate-600">
                La primera fila debe llevar los encabezados: <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">docType,docNumber,name,email,phone,address,creditLimit</code>
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
              <span className="font-black text-orange-600 block">2. Documentos Admitidos</span>
              <p className="text-slate-600">
                Tipos válidos: <strong className="text-slate-900">RUC, DNI, RFC, NIT, Pasaporte</strong>. El número de identificación debe ser único.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
              <span className="font-black text-orange-600 block">3. Validación y Confirmación</span>
              <p className="text-slate-600">
                El sistema detectará errores y registros duplicados en tiempo real antes de guardar los datos en el sistema.
              </p>
            </div>
          </div>

          {/* Paste / Drag CSV Box */}
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
              <div className="flex-1 space-y-1.5 w-full">
                <label className="block text-xs font-black text-slate-800">
                  Importar desde archivo (Excel o CSV):
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    onChange={handleFileUpload}
                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 cursor-pointer border border-slate-200 rounded-xl bg-slate-50"
                  />
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-[10px] font-black uppercase text-slate-400">O pega el texto CSV</span>
              </div>
            </div>

            <textarea
              rows={6}
              value={rawCsvText}
              onChange={(e) => handleParseCsv(e.target.value)}
              placeholder="docType,docNumber,name,email,phone,address,creditLimit&#10;RUC,1792384915001,Distribuidora Daynet S.A.,ventas@daynet.com,0991234567,Av. Amazonas 1234,2000&#10;DNI,1718293044,Juan Pérez,juan.perez@email.com,0987654321,Calle Loja N4-12,500"
              className="w-full p-4 bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>

          {/* Parsed Preview Table */}
          {parsedPreview.length > 0 && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-orange-500" />
                  <span>Previsualización de Registros Parsed ({parsedPreview.filter(p => p.isValid).length} Válidos)</span>
                </h3>

                <button
                  onClick={handleExecuteBulkImport}
                  disabled={parsedPreview.filter(p => p.isValid).length === 0}
                  className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Importar {parsedPreview.filter(p => p.isValid).length} Clientes Válidos</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-[350px] overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-950 text-white font-black uppercase tracking-wider text-[10px] sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3">Estado</th>
                      <th className="py-2.5 px-3">Tipo / Doc</th>
                      <th className="py-2.5 px-3">Nombre / Razón Social</th>
                      <th className="py-2.5 px-3">Correo</th>
                      <th className="py-2.5 px-3">Teléfono</th>
                      <th className="py-2.5 px-3 text-right">Límite Crédito</th>
                      <th className="py-2.5 px-3">Detalle / Observación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {parsedPreview.map((item, idx) => (
                      <tr key={idx} className={item.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/50'}>
                        <td className="py-2 px-3">
                          {item.isValid ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black inline-flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-600" /> Válido
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-black inline-flex items-center gap-1">
                              <X className="w-3 h-3 text-rose-600" /> Error
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">
                          {item.customer.docType}: {item.customer.docNumber}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900">
                          {item.customer.name}
                        </td>
                        <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">
                          {item.customer.email || '-'}
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {item.customer.phone || '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold">
                          {formatCurrency(item.customer.creditLimit, settings.currencySymbol)}
                        </td>
                        <td className="py-2 px-3 text-[11px] font-medium text-rose-600">
                          {item.error || 'Listo para guardar'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
          </div>
        </div>
      )}
    </div>
  );
};
