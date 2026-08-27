import React, { useState } from 'react';
import { Globe, Map, MapPin, Plus, X, Check, Sparkles } from 'lucide-react';
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

  const countryList = Array.isArray(countries) && countries.length > 0 ? countries : defaultCountries;
  const provinceList = Array.isArray(provinces) && provinces.length > 0 ? provinces : defaultProvinces;
  const cityList = Array.isArray(cities) && cities.length > 0 ? cities : defaultCities;

  // Quick-add modal state
  const [addingType, setAddingType] = useState<'country' | 'province' | 'city' | null>(null);
  const [newItemName, setNewItemName] = useState('');

  const handleAddNewItem = () => {
    const cleanName = newItemName.trim();
    if (!cleanName) return;

    if (addingType === 'country') {
      const exists = countryList.some(c => c.toLowerCase() === cleanName.toLowerCase());
      if (!exists) {
        setCountries([cleanName, ...countryList]);
      }
      onCountryChange(cleanName);
    } else if (addingType === 'province') {
      const exists = provinceList.some(p => p.toLowerCase() === cleanName.toLowerCase());
      if (!exists) {
        setProvinces([cleanName, ...provinceList]);
      }
      onProvinceChange(cleanName);
    } else if (addingType === 'city') {
      const exists = cityList.some(c => c.toLowerCase() === cleanName.toLowerCase());
      if (!exists) {
        setCities([cleanName, ...cityList]);
      }
      onCityChange(cleanName);
    }

    setNewItemName('');
    setAddingType(null);
  };

  return (
    <div className={`bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 sm:p-4.5 space-y-4 shadow-xs ${className}`}>
      {/* Header with Title & Badge */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
        <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <div className="p-1 bg-orange-500/10 text-orange-600 rounded-lg">
            <Globe className="w-3.5 h-3.5" />
          </div>
          <span>Ubicación Geográfica</span>
        </span>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          País • Provincia • Ciudad
        </span>
      </div>

      {/* 3 Dropdown Columns with generous spacing */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* 1. Country */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-1">
            <label className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1">
              <Globe className="w-3 h-3 text-slate-400" />
              <span>País {required && <span className="text-rose-500">*</span>}</span>
            </label>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setAddingType('country');
                setNewItemName('');
              }}
              className="text-[10px] px-1.5 py-0.5 rounded-md bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 font-black border border-orange-500/20 flex items-center gap-0.5 cursor-pointer transition active:scale-95"
              title="Agregar nuevo país a la lista"
            >
              <Plus className="w-2.5 h-2.5" />
              <span>Nuevo</span>
            </button>
          </div>
          <Select
            value={country || 'Ecuador'}
            onChange={(e) => onCountryChange(e.target.value)}
            className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 rounded-xl text-xs font-bold text-slate-800 shadow-2xs py-2.5"
          >
            <option value="">-- Seleccionar País --</option>
            {countryList.map((c, idx) => (
              <option key={`${c}-${idx}`} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>

        {/* 2. Province */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-1">
            <label className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1">
              <Map className="w-3 h-3 text-slate-400" />
              <span>Provincia {required && <span className="text-rose-500">*</span>}</span>
            </label>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setAddingType('province');
                setNewItemName('');
              }}
              className="text-[10px] px-1.5 py-0.5 rounded-md bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 font-black border border-orange-500/20 flex items-center gap-0.5 cursor-pointer transition active:scale-95"
              title="Agregar nueva provincia a la lista"
            >
              <Plus className="w-2.5 h-2.5" />
              <span>Nueva</span>
            </button>
          </div>
          <Select
            value={province}
            onChange={(e) => onProvinceChange(e.target.value)}
            className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 rounded-xl text-xs font-bold text-slate-800 shadow-2xs py-2.5"
          >
            <option value="">-- Seleccionar Provincia --</option>
            {provinceList.map((p, idx) => (
              <option key={`${p}-${idx}`} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>

        {/* 3. City */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-1">
            <label className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-400" />
              <span>Ciudad {required && <span className="text-rose-500">*</span>}</span>
            </label>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setAddingType('city');
                setNewItemName('');
              }}
              className="text-[10px] px-1.5 py-0.5 rounded-md bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 font-black border border-orange-500/20 flex items-center gap-0.5 cursor-pointer transition active:scale-95"
              title="Agregar nueva ciudad a la lista"
            >
              <Plus className="w-2.5 h-2.5" />
              <span>Nueva</span>
            </button>
          </div>
          <Select
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 rounded-xl text-xs font-bold text-slate-800 shadow-2xs py-2.5"
          >
            <option value="">-- Seleccionar Ciudad --</option>
            {cityList.map((c, idx) => (
              <option key={`${c}-${idx}`} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Non-form Quick Add Modal to prevent outer form submission collisions */}
      {addingType && (
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setAddingType(null);
          }}
        >
          <div 
            className="bg-white border border-slate-200 rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4 ring-1 ring-slate-900/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-xs font-black text-slate-950 uppercase tracking-wider flex items-center gap-2">
                <div className="p-1.5 bg-orange-500 text-white rounded-lg shadow-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <span>
                  {addingType === 'country' && 'Agregar Nuevo País'}
                  {addingType === 'province' && 'Agregar Nueva Provincia'}
                  {addingType === 'city' && 'Agregar Nueva Ciudad'}
                </span>
              </h4>
              <button
                type="button"
                onClick={() => setAddingType(null)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Nombre {addingType === 'country' ? 'del País' : addingType === 'province' ? 'de la Provincia' : 'de la Ciudad'}:
                </label>
                <input
                  type="text"
                  autoFocus
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleAddNewItem();
                    }
                  }}
                  placeholder={
                    addingType === 'country'
                      ? 'Ej: Canadá'
                      : addingType === 'province'
                      ? 'Ej: Santa Elena'
                      : 'Ej: Samborondón'
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none transition"
                />
                <p className="text-[10px] text-slate-500 mt-1.5 font-medium">
                  Se agregará al catálogo y quedará seleccionado de inmediato. Presiona <strong>Enter</strong> para guardar.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddingType(null)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAddNewItem();
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-black rounded-xl shadow-md shadow-orange-500/20 cursor-pointer flex items-center gap-1.5 transition active:scale-95"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Guardar y Seleccionar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
