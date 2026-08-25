import React, { useState } from 'react';
import { useFirestoreSync } from '../../hooks/useFirestoreSync';
import { useModal } from '../../context/ModalContext';
import { 
  PackageCheck, 
  Truck, 
  ClipboardList, 
  RotateCcw, 
  FileX, 
  CreditCard, 
  Receipt, 
  Send, 
  Percent, 
  Stethoscope, 
  Target, 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileText, 
  Download, 
  Printer, 
  Building, 
  User, 
  TrendingUp, 
  Award, 
  DollarSign,
  ShieldCheck,
  Check,
  RefreshCw,
  Eye
} from 'lucide-react';
import { Customer, Invoice, Product, SalesSubTab, StoreSettings } from '../../types';
import { formatCurrency, formatFullDate } from '../../utils/formatters';
import { CreateOrderModal, Order } from './CreateOrderModal';
import { OrderDetailModal } from './OrderDetailModal';
import { CreateGuiaRemisionModal, GuiaRemisionData } from './CreateGuiaRemisionModal';
import { CreateCreditNoteModal } from './CreateCreditNoteModal';
import { CreateMedicalPrescriptionModal } from './CreateMedicalPrescriptionModal';
import { CreateRetentionModal } from './CreateRetentionModal';
import { CommissionsAndGoalsManager } from './CommissionsAndGoalsManager';
import { defaultSellers } from '../../data/initialData';
import { SriEmissionProgressModal } from '../POS/SriEmissionProgressModal';


interface SalesModuleViewProps {
  subTab: SalesSubTab;
  invoices: Invoice[];
  customers: Customer[];
  products: Product[];
  settings: StoreSettings;
  onNavigateToTab: (tab: SalesSubTab) => void;
  onOpenViewer?: (invoice: Invoice) => void;
  onInvoiceOrder?: (order: Order) => void;
}

export const SalesModuleView: React.FC<SalesModuleViewProps> = ({
  subTab,
  invoices,
  customers,
  products,
  settings,
  onNavigateToTab,
  onOpenViewer,
  onInvoiceOrder,
}) => {
  const { showAlert } = useModal();
  const [searchTerm, setSearchTerm] = useState('');

  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<Order | null>(null);

  // Pedidos state initialized from firestore
  const [orders, setOrders] = useFirestoreSync<Order[]>('ferreteria_orders', []);

  const handleSaveOrder = (newOrder: Order) => {
    setOrders((prev) => [newOrder, ...prev]);
  };

  const handleUpdateOrderStatus = (orderId: string, newStatus: Order['status']) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
    if (selectedOrderForDetail && selectedOrderForDetail.id === orderId) {
      setSelectedOrderForDetail({ ...selectedOrderForDetail, status: newStatus });
    }
  };

  const handleDeleteOrder = (orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
  };

  const [guias, setGuias] = useFirestoreSync<GuiaRemisionData[]>('ferreteria_guias', []);
  
  const [isCreateGuiaOpen, setIsCreateGuiaOpen] = useState(false);

  const handleSaveGuia = (guia: GuiaRemisionData) => {
    setGuias((prev) => [guia, ...prev]);
    showAlert('Guía de Remisión generada exitosamente.', 'Éxito', 'success');
  };

  const [establishment] = useFirestoreSync<string>('ferreteria_settings_establishment', '001');
  const [emissionPoint] = useFirestoreSync<string>('ferreteria_settings_emission_point', '001');
  const [secCreditNote, setSecCreditNote] = useFirestoreSync<string>('ferreteria_settings_sec_credit_note', '000000001');
  const [secRetention, setSecRetention] = useFirestoreSync<string>('ferreteria_settings_sec_retention', '000000001');

  const [creditNotes, setCreditNotes] = useFirestoreSync<any[]>('ferreteria_credit_notes', []);
  const [retenciones, setRetenciones] = useFirestoreSync<any[]>('ferreteria_retenciones', []);
  const [recetas, setRecetas] = useFirestoreSync<any[]>('ferreteria_recetas', []);
  const [isCreditNoteModalOpen, setIsCreditNoteModalOpen] = useState(false);
  const [isRetentionModalOpen, setIsRetentionModalOpen] = useState(false);
  const [isMedicalModalOpen, setIsMedicalModalOpen] = useState(false);

  const [sellers, setSellers] = useFirestoreSync<any[]>('ferreteria_sellers', defaultSellers);

  const [sriMode] = useFirestoreSync<'PRUEBAS' | 'PRODUCCION'>('ferreteria_settings_sri_mode', 'PRUEBAS');
  const [selectedInvoiceForSri, setSelectedInvoiceForSri] = useState<Invoice | null>(null);
  const [isSriModalOpen, setIsSriModalOpen] = useState(false);

  const handleSaveCreditNote = (data: any) => {
    setCreditNotes((prev) => [data, ...prev]);
    const nextNum = (parseInt(secCreditNote, 10) + 1).toString().padStart(9, '0');
    setSecCreditNote(nextNum);
    setIsCreditNoteModalOpen(false);
    showAlert('Nota de Crédito generada y autorizada exitosamente.', 'Éxito', 'success');
  };

  const handleSaveRetention = (data: any) => {
    setRetenciones((prev) => [data, ...prev]);
    const nextNum = (parseInt(secRetention, 10) + 1).toString().padStart(9, '0');
    setSecRetention(nextNum);
    setIsRetentionModalOpen(false);
    showAlert('Comprobante de Retención generado y registrado exitosamente.', 'Éxito', 'success');
  };

  const handleSaveMedicalPrescription = (data: any) => {
    setRecetas((prev) => [data, ...prev]);
    setIsMedicalModalOpen(false);
    showAlert('Receta médica registrada exitosamente.', 'Éxito', 'success');
  };

  // Filter orders
  const filteredOrders = orders.filter(
    (ord) =>
      ord.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ord.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ord.customerRuc && ord.customerRuc.includes(searchTerm))
  );

  // --- RENDERING MODULE DEPENDING ON SUBTAB ---

  if (subTab === 'PEDIDOS') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-slate-900 text-orange-400 rounded-2xl border border-slate-800">
              <PackageCheck className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-950">Pedidos de Clientes</h2>
              <p className="text-xs text-slate-500 font-medium">
                Gestione órdenes de venta previas a facturación y despacho.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsCreateOrderOpen(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md shadow-orange-500/20 flex items-center space-x-2 cursor-pointer transition"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Crear Nuevo Pedido</span>
          </button>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <input
              type="text"
              placeholder="Buscar por cliente, RUC o N° pedido..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2 bg-slate-50 border border-slate-200 text-xs rounded-xl w-72 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <span className="text-xs text-slate-500 font-bold">
              {filteredOrders.length} Pedidos Registrados
            </span>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl space-y-3">
              <PackageCheck className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-sm font-black text-slate-800 uppercase">
                {searchTerm ? 'No se encontraron pedidos con ese criterio' : 'No hay pedidos registrados'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
                Cree un nuevo pedido de cliente para registrar órdenes formales de venta.
              </p>
              {!searchTerm && (
                <button
                  type="button"
                  onClick={() => setIsCreateOrderOpen(true)}
                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-xs rounded-xl shadow-md inline-flex items-center space-x-2 cursor-pointer hover:from-orange-600 hover:to-amber-600"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Crear Primer Pedido</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-white uppercase font-black tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">N° Pedido</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Ítems</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Monto Total</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredOrders.map((ord) => (
                    <tr
                      key={ord.id}
                      className="hover:bg-slate-50/80 transition font-medium text-slate-800"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-950">{ord.id}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {ord.customerName}
                        {ord.customerRuc && (
                          <span className="block text-[10px] text-slate-400 font-mono">
                            RUC: {ord.customerRuc}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{formatFullDate(ord.date)}</td>
                      <td className="py-3 px-4">{ord.itemsCount} productos</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                            ord.status === 'FACTURADO'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : ord.status === 'DESPACHADO'
                              ? 'bg-teal-50 text-teal-700 border-teal-200'
                              : ord.status === 'EN PREPARACION'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : ord.status === 'ANULADO'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-orange-600">
                        {formatCurrency(ord.total, settings.currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-center space-x-1.5">
                        {ord.status === 'FACTURADO' ? (
                          <button
                            type="button"
                            onClick={() => setSelectedOrderForDetail(ord)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-bold transition cursor-pointer"
                            title="Ver Detalle del Pedido Facturado"
                          >
                            Ver Detalle
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (onInvoiceOrder) {
                                onInvoiceOrder(ord);
                              } else {
                                onNavigateToTab('CAJA');
                              }
                            }}
                            className="px-2.5 py-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-lg text-[11px] font-black transition cursor-pointer shadow-xs"
                            title="Facturar Pedido en POS"
                          >
                            Facturar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modals */}
        <CreateOrderModal
          isOpen={isCreateOrderOpen}
          onClose={() => setIsCreateOrderOpen(false)}
          onSave={handleSaveOrder}
          customers={customers}
          products={products}
          settings={settings}
        />

        <OrderDetailModal
          order={selectedOrderForDetail}
          onClose={() => setSelectedOrderForDetail(null)}
          onUpdateStatus={handleUpdateOrderStatus}
          onDeleteOrder={handleDeleteOrder}
          onInvoiceOrder={onInvoiceOrder}
          settings={settings}
        />
      </div>
    );
  }

  if (subTab === 'GUIA_REMISION') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-slate-900 text-orange-400 rounded-2xl border border-slate-800">
              <Truck className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-950">Guías de Remisión para Transporte</h2>
              <p className="text-xs text-slate-500 font-medium">Documentos electrónicos para traslado autorizado de mercadería en vía pública.</p>
            </div>
          </div>
          <button
            onClick={() => setIsCreateGuiaOpen(true)}
            className="px-4 py-2.5 bg-slate-950 text-white font-black text-xs rounded-xl shadow-md flex items-center space-x-2 hover:bg-slate-900 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Emitir Nueva Guía de Remisión</span>
          </button>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-white uppercase font-black tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">N° Guía Remisión</th>
                  <th className="py-3 px-4">Factura Origen</th>
                  <th className="py-3 px-4">Transportista / RUC</th>
                  <th className="py-3 px-4">Placa Vehículo</th>
                  <th className="py-3 px-4">Ruta Traslado</th>
                  <th className="py-3 px-4">Estado SRI</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {guias.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 font-medium">
                      No hay guías de remisión registradas.
                    </td>
                  </tr>
                ) : (
                  guias.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-50/80 transition text-slate-800 font-medium">
                      <td className="py-3 px-4 font-mono font-bold text-slate-950">{g.id}</td>
                      <td className="py-3 px-4 font-mono font-bold text-orange-600">{g.invoiceRef}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{g.transporter}</div>
                        <div className="text-[10px] text-slate-400 font-mono">RUC: {g.transporterRuc}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">{g.plate}</td>
                      <td className="py-3 px-4 text-slate-600">{g.route}</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{g.status}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition">
                          <Printer className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <CreateGuiaRemisionModal
          isOpen={isCreateGuiaOpen}
          onClose={() => setIsCreateGuiaOpen(false)}
          onSave={handleSaveGuia}
        />
      </div>
    );
  }

  if (subTab === 'NOTA_CREDITO') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-slate-900 text-orange-400 rounded-2xl border border-slate-800">
              <CreditCard className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-950">Notas de Crédito Electrónicas</h2>
              <p className="text-xs text-slate-500 font-medium">Anulación parcial o total de facturas con ajuste de inventario y saldos.</p>
            </div>
          </div>
          <button
            onClick={() => setIsCreditNoteModalOpen(true)}
            className="px-4 py-2.5 bg-slate-950 text-white font-black text-xs rounded-xl shadow-md flex items-center space-x-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Generar Nota de Crédito</span>
          </button>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-white uppercase font-black tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">N° Nota Crédito</th>
                  <th className="py-3 px-4">Factura Afectada</th>
                  <th className="py-3 px-4">Cliente / Razón Social</th>
                  <th className="py-3 px-4">Motivo Modificación</th>
                  <th className="py-3 px-4 text-right">Monto</th>
                  <th className="py-3 px-4 text-center">Estado SRI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {creditNotes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 font-medium">
                      No hay notas de crédito emitidas.
                    </td>
                  </tr>
                ) : (
                  creditNotes.map((nc) => (
                    <tr key={nc.id} className="hover:bg-slate-50/80 transition text-slate-800 font-medium">
                      <td className="py-3 px-4 font-mono font-bold text-slate-950">{nc.id}</td>
                      <td className="py-3 px-4 font-mono font-bold text-orange-600">{nc.invoiceRef}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{nc.customer}</td>
                      <td className="py-3 px-4 text-slate-600">{nc.reason}</td>
                      <td className="py-3 px-4 text-right font-mono font-black text-rose-600">
                        -{formatCurrency(nc.amount, settings.currencySymbol)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {nc.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      {isCreditNoteModalOpen && (
        <CreateCreditNoteModal
          onClose={() => setIsCreditNoteModalOpen(false)}
          onSave={handleSaveCreditNote}
          invoices={invoices}
          settings={settings}
          establishment={establishment}
          emissionPoint={emissionPoint}
          secCreditNote={secCreditNote}
        />
      )}
      </div>
    );
  }

  // ─── ELECTRONIC INVOICING / FACTURACIÓN ELECTRÓNICA SRI ───────
  if (subTab === 'COMPROBANTES_ELECTRONICOS') {
    const facturas = invoices.filter((i) => i.documentType === 'FACTURA');
    const autorizadasCount = facturas.filter((i) => i.sriStatus === 'AUTORIZADO').length;
    const porcentajeAutorizadas = facturas.length > 0 ? Math.round((autorizadasCount / facturas.length) * 100) : 0;

    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-slate-900 text-orange-400 rounded-2xl border border-slate-800">
              <Send className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-950">Panel de Comprobantes Electrónicos & Firma SRI</h2>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${
                  sriMode === 'PRODUCCION' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  Ambiente: {sriMode}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Monitoreo de estado de transmisión, firma digital XML XAdES-BES y autorización en línea.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (facturas.length > 0) {
                  setSelectedInvoiceForSri(facturas[0]);
                  setIsSriModalOpen(true);
                } else {
                  showAlert('No hay facturas registradas para sincronizar.', 'SRI', 'info');
                }
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-black text-xs rounded-xl shadow-md flex items-center space-x-2 cursor-pointer transition"
            >
              <RefreshCw className="w-4 h-4 stroke-[2.5]" />
              <span>Transmitir Última Factura</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-xs text-slate-500 font-extrabold uppercase">Firmados & Autorizados</span>
              <span className="text-2xl font-black text-emerald-600 font-mono block mt-1">
                {porcentajeAutorizadas}% <span className="text-xs font-bold text-slate-400 font-sans">({autorizadasCount}/{facturas.length})</span>
              </span>
            </div>
            <ShieldCheck className="w-8 h-8 text-emerald-500" />
          </div>
          <div className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-xs text-slate-500 font-extrabold uppercase">Backend Java Local</span>
              <span className="text-sm font-black text-slate-900 block mt-1 font-mono">http://localhost:8080</span>
            </div>
            <CheckCircle2 className="w-8 h-8 text-blue-500" />
          </div>
          <div className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-xs text-slate-500 font-extrabold uppercase">Ambiente de Emisión</span>
              <span className={`text-sm font-black block mt-1 ${sriMode === 'PRODUCCION' ? 'text-purple-600' : 'text-amber-600'}`}>
                {sriMode} (SRI Ecuador)
              </span>
            </div>
            <Building className="w-8 h-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-950">Historial de Comprobantes Electrónicos para el SRI</h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-white uppercase font-black tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Comprobante</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Clave de Acceso (49 dígitos)</th>
                  <th className="py-3 px-4">Fecha Autorización</th>
                  <th className="py-3 px-4 text-center">Estado SRI</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-medium">
                {facturas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">
                      No hay facturas emitidas aún. Realice una venta tipo "Factura" desde el POS.
                    </td>
                  </tr>
                ) : (
                  facturas.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{inv.fullNumber}</td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        <div>{inv.customer.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{inv.customer.docNumber}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[10px] text-slate-500 truncate max-w-[200px]">
                        {inv.sriClaveAcceso || 'Clave generada al emitir'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-[11px]">
                        {inv.sriFechaAutorizacion || formatFullDate(inv.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                          inv.sriStatus === 'AUTORIZADO'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                        }`}>
                          {inv.sriStatus === 'AUTORIZADO' ? '✓ AUTORIZADO' : 'PENDIENTE'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setSelectedInvoiceForSri(inv);
                            setIsSriModalOpen(true);
                          }}
                          className={`px-2.5 py-1 text-white font-black text-[10px] rounded-lg shadow-sm transition inline-flex items-center gap-1 cursor-pointer ${
                            inv.sriStatus === 'AUTORIZADO'
                              ? 'bg-slate-800 hover:bg-slate-700'
                              : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500'
                          }`}
                        >
                          <Send className="w-3 h-3" />
                          <span>{inv.sriStatus === 'AUTORIZADO' ? 'Ver SRI' : 'Transmitir SRI'}</span>
                        </button>
                        {onOpenViewer && (
                          <button
                            onClick={() => onOpenViewer(inv)}
                            className="px-2 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg font-bold text-[10px] transition cursor-pointer"
                          >
                            RIDE (PDF)
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal de Transmisión SRI en Vivo */}
        <SriEmissionProgressModal
          isOpen={isSriModalOpen}
          onClose={() => setIsSriModalOpen(false)}
          invoice={selectedInvoiceForSri}
          settings={settings}
        />
      </div>
    );
  }

  if (subTab === 'RETENCION') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-slate-900 text-orange-400 rounded-2xl border border-slate-800">
              <Percent className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-950">Comprobantes de Retención</h2>
              <p className="text-xs text-slate-500 font-medium">Retenciones de IVA e Impuesto a la Renta emitidas y recibidas de agentes de retención.</p>
            </div>
          </div>
          <button
            onClick={() => setIsRetentionModalOpen(true)}
            className="px-4 py-2.5 bg-slate-950 text-white font-black text-xs rounded-xl shadow-md flex items-center space-x-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Registrar Comprobante de Retención</span>
          </button>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-white uppercase font-black tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">N° Retención</th>
                  <th className="py-3 px-4">Factura Asociada</th>
                  <th className="py-3 px-4">Cliente / Agente</th>
                  <th className="py-3 px-4">Ret. Renta</th>
                  <th className="py-3 px-4">Ret. IVA</th>
                  <th className="py-3 px-4 text-right">Monto Retenido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-medium">
                {retenciones.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 font-medium">
                      No hay retenciones registradas.
                    </td>
                  </tr>
                ) : (
                  retenciones.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-950">{r.id}</td>
                      <td className="py-3 px-4 font-mono font-bold text-orange-600">{r.invoiceRef}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{r.customer}</td>
                      <td className="py-3 px-4">{r.retentionRir}</td>
                      <td className="py-3 px-4">{r.retentionIva}</td>
                      <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                        {formatCurrency(r.totalRetenido, settings.currencySymbol)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      {isRetentionModalOpen && (
        <CreateRetentionModal
          onClose={() => setIsRetentionModalOpen(false)}
          onSave={handleSaveRetention}
          invoices={invoices}
          settings={settings}
          establishment={establishment}
          emissionPoint={emissionPoint}
          secRetention={secRetention}
        />
      )}
      </div>
    );
  }

  if (subTab === 'RECETAS_MEDICAS') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-slate-900 text-orange-400 rounded-2xl border border-slate-800">
              <Stethoscope className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-950">Despacho con Receta Médica / Prescripción</h2>
              <p className="text-xs text-slate-500 font-medium">Registro de químicos restringidos, solventes y reactivos de uso técnico/médico.</p>
            </div>
          </div>
          <button
            onClick={() => setIsMedicalModalOpen(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-xs rounded-xl shadow-md flex items-center space-x-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Registrar Receta en Venta</span>
          </button>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-white uppercase font-black tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Código Receta</th>
                  <th className="py-3 px-4">Paciente / Solicitante</th>
                  <th className="py-3 px-4">Médico Prescriptor</th>
                  <th className="py-3 px-4">N° Prescripción</th>
                  <th className="py-3 px-4">Producto / Sustancia Controlada</th>
                  <th className="py-3 px-4">Fecha Despacho</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-medium">
                {recetas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 font-medium">
                      No hay recetas médicas registradas.
                    </td>
                  </tr>
                ) : (
                  recetas.map((rc) => (
                    <tr key={rc.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-950">{rc.id}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{rc.patientName}</td>
                      <td className="py-3 px-4 text-slate-700">{rc.doctorName}</td>
                      <td className="py-3 px-4 font-mono text-orange-600 font-bold">{rc.prescriptionNumber}</td>
                      <td className="py-3 px-4">{rc.items}</td>
                      <td className="py-3 px-4 text-slate-500">{formatFullDate(rc.date)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      {isMedicalModalOpen && (
        <CreateMedicalPrescriptionModal
          onClose={() => setIsMedicalModalOpen(false)}
          onSave={handleSaveMedicalPrescription}
        />
      )}
      </div>
    );
  }

  if (subTab === 'COMISIONES_METAS') {
    return (
      <CommissionsAndGoalsManager
        invoices={invoices}
        settings={settings}
        onNavigateToTab={onNavigateToTab}
      />
    );
  }

  // Fallback for DEVOLUCIONES
  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-8 shadow-sm text-center space-y-4">
      <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center mx-auto border border-orange-200">
        <FileX className="w-6 h-6" />
      </div>
      <div>
        <h2 className="text-lg font-black text-slate-950 uppercase tracking-wide">
          {subTab === 'DEVOLUCIONES' ? 'Facturas Devueltas (SRI)' : subTab.replace(/_/g, ' ')}
        </h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 font-medium">
          {subTab === 'DEVOLUCIONES' 
            ? 'Bandeja de comprobantes electrónicos devueltos por el SRI. Recuerda que una devolución no es un error fatal del sistema, simplemente significa que el SRI devuelve la factura para su corrección o revisión antes de autorizarla.'
            : `Módulo de gestión de ${subTab.toLowerCase().replace(/_/g, ' ')} habilitado y sincronizado con el catálogo general.`}
        </p>
      </div>
      <button
        onClick={() => onNavigateToTab('CAJA')}
        className="px-5 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-slate-800"
      >
        Ir a Terminal de Ventas
      </button>
    </div>
  );
};
