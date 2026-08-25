import React, { useState } from 'react';
import { Search, UserPlus, X, Check, Building2, User, Phone, Mail, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { Customer } from '../../types';
import { useModal } from '../../context/ModalContext';
import { DocumentCustomerForm, DocumentCustomerData } from '../Shared/DocumentCustomerForm';
import { validateEcuadorianDocument } from '../../utils/ecuadorianValidator';

interface CustomerSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  selectedCustomer: Customer;
  onSelectCustomer: (customer: Customer) => void;
  onCreateCustomer: (newCustomer: Customer) => void;
}

export const CustomerSelectModal: React.FC<CustomerSelectModalProps> = ({
  isOpen,
  onClose,
  customers,
  selectedCustomer,
  onSelectCustomer,
  onCreateCustomer,
}) => {
  const { showAlert, showToast } = useModal();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // New Customer Form State
  const [docType, setDocType] = useState<'RUC' | 'DNI' | 'Pasaporte'>('RUC');
  const [docNumber, setDocNumber] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [creditLimit, setCreditLimit] = useState('0');

  if (!isOpen) return null;

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.docNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.phone && c.phone.includes(searchTerm))
  );

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !docNumber) return;

    const cleanDoc = docNumber.trim().toUpperCase();

    // Prevent duplicates
    const existingCustomer = customers.find(c => c.docNumber === cleanDoc);
    if (existingCustomer) {
      showAlert('Este contacto ya está en tu directorio. Lo hemos seleccionado automáticamente por ti.', 'Contacto Existente', 'info');
      onSelectCustomer(existingCustomer);
      setIsCreating(false);
      onClose();
      return;
    }

    // SRI Validation for Ecuador
    const valResult = validateEcuadorianDocument('AUTO', cleanDoc);
    if (!valResult.isValid) {
      showAlert(
        valResult.message || 'El documento ingresado no cumple con las reglas del SRI o Registro Civil de Ecuador.',
        'Identificación Inválida',
        'warning'
      );
      return;
    }

    const newCustomer: Customer = {
      id: `cust-${Date.now()}`,
      docType: valResult.type?.startsWith('RUC') ? 'RUC' : (valResult.type === 'PASAPORTE' ? 'Pasaporte' : 'DNI'),
      docNumber: cleanDoc,
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      creditLimit: parseFloat(creditLimit) || 0,
      currentBalance: 0,
    };

    onCreateCustomer(newCustomer);
    onSelectCustomer(newCustomer);
    setIsCreating(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
      <div className="bg-white border border-slate-200/90 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] ring-1 ring-slate-900/10">
        {/* Modal Header */}
        <div className="px-6 py-4.5 bg-slate-950 text-white border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-wide">
                {isCreating ? 'Registrar Nuevo Cliente / Razón Social' : 'Seleccionar Cliente para Comprobante'}
              </h2>
              <p className="text-xs text-slate-400">
                Seleccione el receptor oficial de facturas, boletas o cotizaciones
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-850 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {!isCreating ? (
            <div className="space-y-4">
              {/* Search & Create Toggle Row */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por Nombre, RFC/RUC/DNI o Teléfono..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    autoFocus
                  />
                </div>
                <button
                  onClick={() => setIsCreating(true)}
                  className="px-3 py-2 bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-xl text-xs transition inline-flex items-center gap-1 shrink-0 shadow-sm shadow-orange-500/20 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Nuevo Cliente</span>
                </button>
              </div>

              {/* Customer List */}
              <div className="space-y-2 mt-3">
                {filteredCustomers.map((cust) => {
                  const isSelected = selectedCustomer.id === cust.id;
                  return (
                    <div
                      key={cust.id}
                      onClick={() => {
                        onSelectCustomer(cust);
                        onClose();
                      }}
                      className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-orange-50 border-orange-500 ring-1 ring-orange-500/30 text-slate-900'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-slate-900">{cust.name}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-800 border border-slate-300 font-semibold">
                            {cust.docType}: {cust.docNumber}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 flex flex-wrap gap-3">
                          {cust.phone && <span>Tel: {cust.phone}</span>}
                          {cust.address && <span>{cust.address}</span>}
                        </div>
                        {cust.creditLimit > 0 && (
                          <div className="text-[11px] text-orange-600 font-semibold pt-1">
                            Límite de Crédito: ${cust.creditLimit.toLocaleString()} • Deuda Actual: ${cust.currentBalance.toLocaleString()}
                          </div>
                        )}
                      </div>

                      {isSelected && (
                        <div className="p-1.5 bg-orange-500 text-white rounded-full font-bold shadow-sm">
                          <Check className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Create Customer Form */
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <DocumentCustomerForm
                data={{ docNumber, name, email, phone, address, creditLimit }}
                onChange={(field, value) => {
                  if (field === 'docNumber') setDocNumber(value);
                  if (field === 'name') setName(value);
                  if (field === 'email') setEmail(value);
                  if (field === 'phone') setPhone(value);
                  if (field === 'address') setAddress(value);
                  if (field === 'creditLimit') setCreditLimit(value);
                }}
                onConsumidorFinal={() => {
                  setDocType('DNI');
                  setDocNumber('9999999999999');
                  setName('CONSUMIDOR FINAL');
                  setEmail('consumidor@final.com');
                  setPhone('9999999999');
                  setAddress('S/N');
                  setCreditLimit('0');
                }}
              />
              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer"
                >
                  Guardar Cliente
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
