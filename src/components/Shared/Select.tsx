import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

export const Select = (props: any) => {
  const { value, onChange, children, className = '', disabled, required, searchable = true } = props;
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      if (searchable && searchInputRef.current) {
        // Focus the search input when opened
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
      }
    }
  }, [isOpen, searchable]);

  const options: { value: string; label: React.ReactNode }[] = [];

  React.Children.toArray(children).forEach((child: any) => {
    if (React.isValidElement(child) && child.type === 'option') {
      const element = child as React.ReactElement<any>;
      options.push({
        value: element.props.value !== undefined ? element.props.value : element.props.children,
        label: element.props.children,
      });
    } else if (child && (child as any).type === React.Fragment && (child as any).props.children) {
        React.Children.toArray((child as any).props.children).forEach((subChild: any) => {
             if (React.isValidElement(subChild) && subChild.type === 'option') {
                  const subElement = subChild as React.ReactElement<any>;
                  options.push({
                    value: subElement.props.value !== undefined ? subElement.props.value : subElement.props.children,
                    label: subElement.props.children,
                  });
             }
        });
    }
  });

  const selectedOption = options.find((opt) => String(opt.value) === String(value));
  const displayLabel = selectedOption ? selectedOption.label : '-- Seleccionar --';

  const filteredOptions = options.filter(opt => {
    if (!searchable || !searchQuery) return true;
    const optLabel = String(opt.label).toLowerCase();
    const query = searchQuery.toLowerCase();
    return optLabel.includes(query);
  });

  const handleSelect = (val: string) => {
    if (onChange) {
      onChange({ target: { value: val } });
    }
    setIsOpen(false);
  };

  return (
    <div className="relative w-full text-xs" ref={wrapperRef}>
      <div
        className={`w-full px-3 py-2 bg-slate-50 border rounded-xl font-medium text-xs flex items-center justify-between cursor-pointer transition-all ${
          isOpen ? 'ring-2 ring-orange-500 border-orange-500 shadow-2xs' : 'border-slate-200 hover:border-slate-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        {/* Hidden select for native form validation */}
        <select
          className="absolute opacity-0 w-0 h-0 pointer-events-none"
          value={value}
          onChange={() => {}}
          required={required}
          disabled={disabled}
          tabIndex={-1}
        >
          {options.map((opt, i) => (
            <option key={i} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className={`truncate mr-2 ${selectedOption && selectedOption.value !== '' ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>
          {displayLabel}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-orange-500 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-[9999] w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl overflow-hidden animate-fadeIn">
          {searchable !== false && (
            <div className="p-1.5 border-b border-slate-800 bg-slate-900/60">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={`Buscar en ${options.length} opciones...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-slate-900 text-slate-200 placeholder-slate-500 border border-slate-700/80 rounded-lg text-xs font-medium focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                />
              </div>
            </div>
          )}
          <div className="max-h-48 overflow-y-auto custom-scrollbar flex flex-col py-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, idx) => {
                const isSelected = String(value) === String(option.value);
                return (
                  <div
                    key={idx}
                    onClick={() => handleSelect(String(option.value))}
                    className={`px-3 py-1.5 mx-1 my-0.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white font-bold shadow-2xs'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {option.label}
                  </div>
                );
              })
            ) : (
              <div className="px-3 py-2 text-slate-500 text-xs font-medium text-center">
                No se encontraron resultados
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
