import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Filter } from 'lucide-react';

export interface CustomSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string;
  color?: string; // e.g. "emerald", "amber", "rose", "blue", "indigo"
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: (CustomSelectOption | string)[];
  placeholder?: string;
  labelPrefix?: string;
  icon?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'light' | 'dark' | 'orange';
  disabled?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  labelPrefix,
  icon,
  className = '',
  size = 'md',
  variant = 'light',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize options to CustomSelectOption structure
  const normalizedOptions: CustomSelectOption[] = options.map((opt) => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return opt;
  });

  const selectedOption: CustomSelectOption = normalizedOptions.find((opt) => opt.value === value) || {
    value,
    label: value || placeholder,
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  // Color dots helper
  const getColorBadge = (color?: string) => {
    switch (color) {
      case 'emerald':
      case 'green':
      case 'PAGADA':
        return 'bg-emerald-500 shadow-emerald-500/50';
      case 'amber':
      case 'yellow':
      case 'PENDIENTE':
        return 'bg-amber-500 shadow-amber-500/50';
      case 'rose':
      case 'red':
      case 'ANULADA':
        return 'bg-rose-500 shadow-rose-500/50';
      case 'blue':
      case 'BOLETA':
        return 'bg-blue-500 shadow-blue-500/50';
      case 'indigo':
      case 'FACTURA':
        return 'bg-indigo-500 shadow-indigo-500/50';
      case 'orange':
      case 'COTIZACION':
        return 'bg-orange-500 shadow-orange-500/50';
      default:
        return 'bg-slate-400';
    }
  };

  // Size styling
  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-[11px]',
    md: 'px-3.5 py-2 text-xs',
    lg: 'px-4 py-2.5 text-sm',
  };

  // Variant styling for trigger
  const variantClasses = {
    light:
      'bg-slate-900 border-slate-800 text-slate-100 hover:bg-slate-800/90 shadow-sm border focus:ring-2 focus:ring-orange-500/40',
    dark:
      'bg-slate-950 border-slate-800 text-white hover:border-slate-700 shadow-md border focus:ring-2 focus:ring-orange-500/40',
    orange:
      'bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black hover:from-orange-600 hover:to-amber-600 shadow-md shadow-orange-500/20',
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2.5 rounded-xl font-black transition-all duration-200 cursor-pointer ${
          sizeClasses[size]
        } ${variantClasses[variant]} ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.99]'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          {icon ? (
            icon
          ) : (
            <Filter className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          )}

          {/* Color dot indicator if available */}
          {selectedOption.color && (
            <span
              className={`w-2 h-2 rounded-full shadow-xs ${getColorBadge(
                selectedOption.color
              )}`}
            />
          )}

          <span className="truncate">
            {labelPrefix ? `${labelPrefix}: ` : ''}
            {selectedOption.label}
          </span>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-orange-400' : ''
          }`}
        />
      </button>

      {/* Floating Custom Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 sm:right-auto sm:min-w-[200px] mt-2 z-50 bg-slate-950/98 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-1.5 ring-1 ring-orange-500/30 animate-fadeIn space-y-0.5 custom-scrollbar max-h-64 overflow-y-auto">
          {normalizedOptions.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl font-bold transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25 font-black'
                    : 'text-slate-200 hover:bg-slate-800/90 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  {option.icon}
                  {option.color && (
                    <span
                      className={`w-2 h-2 rounded-full shadow-xs ${getColorBadge(
                        option.color
                      )}`}
                    />
                  )}
                  <span className="truncate">{option.label}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {option.badge && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-800 text-orange-400 border border-slate-700'
                      }`}
                    >
                      {option.badge}
                    </span>
                  )}
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
