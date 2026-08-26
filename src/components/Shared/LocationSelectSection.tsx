import React, { useState } from 'react';
import { Globe, Map, MapPin, Plus, X, Check } from 'lucide-react';
import { useFirestoreSync } from '../../hooks/useFirestoreSync';
import { defaultCountries, defaultProvinces, defaultCities } from '../../data/initialData';
import { Select } from './Select';

export interface LocationSelectSectionProps {
  country?: string;
  province?: string;
  city?: string;
  onCountryChange: (country: string) => void;
  onProvinceChange: (province: string) => void;
  onCityChange: (city: string) => void;
  className?: string;
  required?: boolean;
}

export const LocationSelectSection: React.FC<LocationSelectSectionProps> = ({
  country = 'Ecuador',
  province = '',
  city = '',
  onCountryChange,
  onProvinceChange,
  onCityChange,
  className = '',
  required = false,
}) => {
  const [countries, setCountries] = useFirestoreSync<string[]>('ferreteria_locations_countries', defaultCountries);
  const [provinces, setProvinces] = useFirestoreSync<string[]>('ferreteria_locations_provinces', defaultProvinces);
  const [cities, setCities] = useFirestoreSync<string[]>('ferreteria_locations_cities', defaultCities);

  // Quick-add modal state
  const [addingType, setAddingType] = useState<'country' | 'province' | 'city' | null>(null);
  const [newItemName, setNewItemName] = useState('');

  const handleAddNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newItemName.trim();
    if (!cleanName) return;

    if (addingType === 'country') {
      const exists = countries.some(c => c.toLowerCase() === cleanName.toLowerCase());
      if (!exists) {
        setCountries(prev => [cleanName, ...prev]);
      }
      onCountryChange(cleanName);
    } else if (addingType === 'province') {
      const exists = provinces.some(p => p.toLowerCase() === cleanName.toLowerCase());
      if (!exists) {
        setProvinces(prev => [cleanName, ...prev]);
      }
      onProvinceChange(cleanName);
    } else if (addingType === 'city') {
      const exists = cities.some(c => c.toLowerCase() === cleanName.toLowerCase());
      if (!exists) {
        setCities(prev => [cleanName, ...prev]);
      }
      onCityChange(cleanName);
    }

    setNewItemName('');
    setAddingType(null);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between pb-1 border-b border-slate-100">
        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-orange-500" />
          <span>Ubicación Geográfica (País / Provincia / Ciudad)</span>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* 1. País */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-slate-700 uppercase flex items-center gap-1">
              <Globe className="w-3 h-3 text-slate-400" />
              <span>País {required && '*'}</span>
            </label>
            <button
              type="button"
              onClick={() => {
                setAddingType('country');
                setNewItemName('');
              }}
              className="text-[10px] text-orange-600 hover:text-orange-700 font-bold flex items-center gap-0.5 cursor-pointer"
              title="Agregar nuevo país a la lista"
            >
              <Plus className="w-3 h-3" />
              <span>Nuevo</span>
            </button>
          </div>
          <Select
            value={country || 'Ecuador'}
            onChange={(e) => onCountryChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
          >
            <option value="">-- Seleccionar País --</option>
            {countries.map((c, idx) => (
              <option key={idx} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>

        {/* 2. Provincia */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-slate-700 uppercase flex items-center gap-1">
              <Map className="w-3 h-3 text-slate-400" />
              <span>Provincia / Estado {required && '*'}</span>
            </label>
            <button
              type="button"
              onClick={() => {
                setAddingType('province');
                setNewItemName('');
              }}
              className="text-[10px] text-orange-600 hover:text-orange-700 font-bold flex items-center gap-0.5 cursor-pointer"
              title="Agregar nueva provincia a la lista"
            >
              <Plus className="w-3 h-3" />
              <span>Nueva</span>
            </button>
          </div>
          <Select
            value={province}
            onChange={(e) => onProvinceChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
          >
            <option value="">-- Seleccionar Provincia --</option>
            {provinces.map((p, idx) => (
              <option key={idx} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>

        {/* 3. Ciudad */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-slate-700 uppercase flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-400" />
              <span>Ciudad / Cantón {required && '*'}</span>
            </label>
            <button
              type="button"
              onClick={() => {
                setAddingType('city');
                setNewItemName('');
              }}
              className="text-[10px] text-orange-600 hover:text-orange-700 font-bold flex items-center gap-0.5 cursor-pointer"
              title="Agregar nueva ciudad a la lista"
            >
              <Plus className="w-3 h-3" />
              <span>Nueva</span>
            </button>
          </div>
          <Select
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
          >
            <option value="">-- Seleccionar Ciudad --</option>
            {cities.map((c, idx) => (
              <option key={idx} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Quick Add Modal */}
      {addingType && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h4 className="text-xs font-black text-slate-950 uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-orange-500" />
                <span>
                  {addingType === 'country' && 'Agregar Nuevo País'}
                  {addingType === 'province' && 'Agregar Nueva Provincia / Estado'}
                  {addingType === 'city' && 'Agregar Nueva Ciudad / Cantón'}
                </span>
              </h4>
              <button
                type="button"
                onClick={() => setAddingType(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddNewItem} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Nombre {addingType === 'country' ? 'del País' : addingType === 'province' ? 'de la Provincia' : 'de la Ciudad'}
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder={
                    addingType === 'country'
                      ? 'Ej: Canadá'
                      : addingType === 'province'
                      ? 'Ej: Santa Elena'
                      : 'Ej: Samborondón'
                  }
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Se guardará automáticamente en el catálogo y estará disponible en todos los módulos.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddingType(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-black rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Guardar y Seleccionar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
