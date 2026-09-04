import React from 'react';
import { UserCheck, CheckCircle2, AlertCircle, Search, Loader2, User, Mail, Phone, MapPin } from 'lucide-react';
import { validateEcuadorianDocument } from '../../utils/ecuadorianValidator';
import { useCedulaSearch } from '../../hooks/useCedulaSearch';
import { LocationSelectSection } from './LocationSelectSection';

export interface DocumentCustomerData {
  docNumber: string;
  name: string;
  email: string;
  phone: string;
  country?: string;
  province?: string;
  city?: string;
  address: string;
  creditLimit?: string;
}

interface DocumentCustomerFormProps {
  data: DocumentCustomerData;
  onChange: (field: keyof DocumentCustomerData, value: string) => void;
  onConsumidorFinal?: () => void;
  showCreditLimit?: boolean;
}

export const DocumentCustomerForm: React.FC<DocumentCustomerFormProps> = ({ data, onChange, onConsumidorFinal, showCreditLimit = true }) => {
  const { isSearchingCedula, fetchCedulaData } = useCedulaSearch();
  const lastSearchedRef = React.useRef<string>('');

  const handleSearchCedula = () => {
    if (data.docNumber) {
      fetchCedulaData(data.docNumber, (foundData) => {
        if (foundData.name) onChange('name', foundData.name);
        if (foundData.email) onChange('email', foundData.email);
        if (foundData.phone) onChange('phone', foundData.phone);
        if (foundData.address) onChange('address', foundData.address);
      });
    }
  };

  React.useEffect(() => {
    const cleanDoc = data.docNumber.trim();
    // Solo busca si tiene 10 o 13 dígitos y no lo hemos buscado ya
    if ((cleanDoc.length === 10 || cleanDoc.length === 13) && cleanDoc !== lastSearchedRef.current) {
      const res = validateEcuadorianDocument('AUTO', cleanDoc);
      if (res.isValid) {
        lastSearchedRef.current = cleanDoc;
        handleSearchCedula();
      }
    }
    // Permitir volver a buscar si borran todo
    if (cleanDoc === '') {
      lastSearchedRef.current = '';
    }
  }, [data.docNumber]);

  const handleConsumidorFinal = () => {
    if (onConsumidorFinal) {
      onConsumidorFinal();
    } else {
      onChange('docNumber', '9999999999999');
      onChange('name', 'CONSUMIDOR FINAL');
      onChange('email', 'consumidor@final.com');
      onChange('phone', '9999999999');
      onChange('address', 'S/N');
    }
  };

  return (
    <div className="space-y-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Row 1 */}
        <div className="space-y-1.5">
          <label className="text-xs font-black text-slate-800 uppercase tracking-wider block mb-1">
            R.U.C / C.I. / PASAPORTE
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={data.docNumber}
              onChange={(e) => onChange('docNumber', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearchCedula();
                }
              }}
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-300 focus:outline-none"
              placeholder="Ej: 1725389454001"
            />
            <button
              type="button"
              onClick={handleSearchCedula}
              disabled={isSearchingCedula || !data.docNumber}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl disabled:opacity-50 transition"
              title="Buscar en Registro Civil / Base Local"
            >
              {isSearchingCedula ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
            </button>
          </div>
          {data.docNumber && (() => {
            const res = validateEcuadorianDocument('AUTO', data.docNumber);
            return (
              <div className={`mt-1 px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 border ${
                res.isValid 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {res.isValid ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>Documento Válido ({res.type})</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
                    <span>{res.message}</span>
                  </>
                )}
              </div>
            );
          })()}
        </div>

        <div className="space-y-1.5 relative">
          <label className="text-xs font-black text-slate-800 uppercase tracking-wider block mb-1">
            RAZÓN SOCIAL:
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={data.name}
              onChange={(e) => onChange('name', e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-300 focus:outline-none"
              placeholder="Nombre completo"
              autoComplete="off"
              spellCheck="false"
            />
          </div>
        </div>

        {/* Row 2 */}
        <div className="space-y-1.5">
          <label className="text-xs font-black text-slate-800 uppercase tracking-wider block mb-1">
            EMAIL NOTIFICACIÓN:
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="email"
              value={data.email}
              onChange={(e) => onChange('email', e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-300 focus:outline-none"
              placeholder="ejemplo@correo.com"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-black text-slate-800 uppercase tracking-wider block mb-1">
            TELÉFONO:
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={data.phone}
              onChange={(e) => onChange('phone', e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-300 focus:outline-none"
              placeholder="Ej: 0998765432"
            />
          </div>
        </div>
      </div>

      {/* Row 3 - Ubicación Geográfica (País, Provincia, Ciudad) */}
      <div className="pt-2">
        <LocationSelectSection
          country={data.country || 'Ecuador'}
          province={data.province || ''}
          city={data.city || ''}
          onCountryChange={(val) => onChange('country', val)}
          onProvinceChange={(val) => onChange('province', val)}
          onCityChange={(val) => onChange('city', val)}
        />
      </div>

      {/* Row 4 - Full width Dirección */}
      <div className="space-y-1.5 pt-1">
        <label className="text-xs font-black text-slate-800 uppercase tracking-wider block mb-1">
          DIRECCIÓN (CALLES / REFERENCIA):
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={data.address}
            onChange={(e) => onChange('address', e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-300 focus:outline-none"
            placeholder="Calle principal, secundaria y número de casa"
          />
        </div>
      </div>

      {/* Row 4 - Optional Credit Limit */}
      {showCreditLimit && data.creditLimit !== undefined && (
        <div className="space-y-1.5 pt-2">
          <label className="text-xs font-black text-slate-800 uppercase tracking-wider block mb-1">
            LÍMITE DE CRÉDITO ($):
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={data.creditLimit}
              onChange={(e) => onChange('creditLimit', e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-300 focus:outline-none"
              placeholder="Ej: 500.00"
            />
          </div>
        </div>
      )}
    </div>
  );
};
