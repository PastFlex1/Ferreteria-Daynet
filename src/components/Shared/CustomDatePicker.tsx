import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X as ClearIcon } from 'lucide-react';

interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
  align?: 'left' | 'right' | 'auto';
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  min?: string;
  max?: string;
}

const DAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  className = '',
  align = 'auto',
  placeholder = 'dd/mm/aaaa',
  disabled = false,
  required = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Parse value or use today
  const parsedDate = value ? new Date(value + 'T12:00:00') : new Date();
  const [viewDate, setViewDate] = useState(parsedDate);

  useEffect(() => {
    if (value) {
      setViewDate(new Date(value + 'T12:00:00'));
    }
  }, [value]);

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const calendarWidth = 290;
      const calendarHeight = 330;
      
      // Horizontal placement
      let left = rect.left;
      if (align === 'right' || (align === 'auto' && rect.left + calendarWidth > window.innerWidth - 16)) {
        left = Math.max(16, rect.right - calendarWidth);
      } else {
        left = Math.max(16, rect.left);
      }

      // Vertical placement (open upwards if not enough room below)
      const spaceBelow = window.innerHeight - rect.bottom;
      let top = rect.bottom + 6;
      if (spaceBelow < calendarHeight && rect.top > calendarHeight) {
        top = rect.top - calendarHeight - 6;
      }

      setDropdownPos({ top, left });
    }
  }, [align]);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const handleReposition = () => updatePosition();
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  // Standard getDay(): 0=Sun, 1=Mon, ..., 6=Sat. For Monday-first: (day + 6) % 7
  const getFirstDayOffset = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return (day + 6) % 7;
  };

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleDateSelect = (day: number, specificDate?: Date) => {
    const baseDate = specificDate || viewDate;
    const newDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), day);
    const yyyy = newDate.getFullYear();
    const mm = String(newDate.getMonth() + 1).padStart(2, '0');
    const dd = String(newDate.getDate()).padStart(2, '0');
    onChange(`${yyyy}-${mm}-${dd}`);
    setIsOpen(false);
  };

  const handleSelectToday = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    onChange(`${yyyy}-${mm}-${dd}`);
    setViewDate(now);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  const renderCalendar = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayOffset = getFirstDayOffset(year, month);
    
    const days = [];
    
    // Trailing days from previous month
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayOffset - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      days.push(
        <button
          key={`prev-${dayNum}`}
          type="button"
          onClick={() => handleDateSelect(dayNum, new Date(year, month - 1, dayNum))}
          className="h-8 w-8 rounded-xl flex items-center justify-center text-xs text-slate-300 hover:bg-slate-100 hover:text-slate-600 transition-all cursor-pointer"
        >
          {dayNum}
        </button>
      );
    }
    
    const today = new Date();
    const selectedDate = value ? new Date(value + 'T12:00:00') : null;

    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
      const isSelected = selectedDate && selectedDate.getDate() === day && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;

      days.push(
        <button
          key={day}
          type="button"
          onClick={() => handleDateSelect(day)}
          className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-semibold transition-all relative cursor-pointer
            ${isSelected 
              ? 'bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-black shadow-md shadow-orange-500/40 scale-105 ring-2 ring-orange-400/40' 
              : isToday 
                ? 'bg-orange-50 text-orange-700 font-bold border border-orange-300/80 hover:bg-orange-100' 
                : 'text-slate-700 hover:bg-orange-50 hover:text-orange-700 font-medium'}`}
        >
          {day}
          {isToday && !isSelected && (
            <span className="absolute bottom-1 w-1 h-1 rounded-full bg-orange-500"></span>
          )}
        </button>
      );
    }

    // Trailing days to complete the calendar grid
    const totalCells = days.length;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let day = 1; day <= remainingCells; day++) {
      days.push(
        <button
          key={`next-${day}`}
          type="button"
          onClick={() => handleDateSelect(day, new Date(year, month + 1, day))}
          className="h-8 w-8 rounded-xl flex items-center justify-center text-xs text-slate-300 hover:bg-slate-100 hover:text-slate-600 transition-all cursor-pointer"
        >
          {day}
        </button>
      );
    }

    return days;
  };

  const displayFormat = value ? value.split('-').reverse().join('/') : placeholder;

  return (
    <div className="relative w-full" ref={triggerRef}>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`group flex items-center justify-between cursor-pointer px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-800 transition-all select-none hover:border-orange-300 ${
          disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''
        } ${isOpen ? 'ring-2 ring-orange-500 border-orange-400 shadow-sm' : ''} ${className} ${!value ? 'text-slate-400' : ''}`}
      >
        <span className="truncate">{displayFormat}</span>
        <div className="flex items-center gap-1.5 ml-2 shrink-0">
          {value && !disabled && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              title="Borrar fecha"
              className="p-0.5 text-slate-300 hover:text-rose-500 rounded transition cursor-pointer hover:bg-rose-50"
            >
              <ClearIcon className="w-3.5 h-3.5" />
            </span>
          )}
          <CalendarIcon className={`w-4 h-4 transition-colors ${isOpen ? 'text-orange-500' : 'text-slate-400 group-hover:text-orange-500'}`} />
        </div>
      </div>

      {isOpen && dropdownPos && ReactDOM.createPortal(
        <div 
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            zIndex: 999999,
          }}
          className="p-3.5 bg-white border border-slate-200/90 shadow-2xl rounded-2xl w-72 transform animate-in fade-in zoom-in-95 duration-150 select-none ring-1 ring-slate-900/10"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button 
              type="button" 
              onClick={handlePrevMonth} 
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-orange-600 transition cursor-pointer"
              title="Mes anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <div className="flex items-center gap-1 font-bold text-slate-800 text-xs">
              <select
                value={viewDate.getMonth()}
                onChange={(e) => setViewDate(new Date(viewDate.getFullYear(), Number(e.target.value), 1))}
                className="bg-transparent hover:bg-slate-100 px-1 py-0.5 rounded-lg cursor-pointer text-slate-800 font-bold focus:outline-none capitalize text-xs border border-transparent hover:border-slate-200"
              >
                {MONTHS.map((m, idx) => (
                  <option key={m} value={idx}>{m}</option>
                ))}
              </select>
              <select
                value={viewDate.getFullYear()}
                onChange={(e) => setViewDate(new Date(Number(e.target.value), viewDate.getMonth(), 1))}
                className="bg-transparent hover:bg-slate-100 px-1 py-0.5 rounded-lg cursor-pointer text-slate-800 font-bold focus:outline-none text-xs border border-transparent hover:border-slate-200"
              >
                {Array.from({ length: 25 }, (_, i) => 2020 + i).map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>

            <button 
              type="button" 
              onClick={handleNextMonth} 
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-orange-600 transition cursor-pointer"
              title="Mes siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          {/* Days of week */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {DAYS.map((d, i) => (
              <div 
                key={d} 
                className={`text-[10px] font-black uppercase tracking-wider ${i >= 5 ? 'text-orange-400' : 'text-slate-400'}`}
              >
                {d}
              </div>
            ))}
          </div>
          
          {/* Calendar days grid */}
          <div className="grid grid-cols-7 gap-1 place-items-center">
            {renderCalendar()}
          </div>

          {/* Action footer */}
          <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-100 text-xs">
            <button
              type="button"
              onClick={handleClear}
              className="px-2.5 py-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg font-bold transition-all text-[11px] cursor-pointer"
            >
              Borrar
            </button>
            <button
              type="button"
              onClick={handleSelectToday}
              className="px-3 py-1 bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white rounded-lg font-bold transition-all text-[11px] shadow-sm shadow-orange-500/20 cursor-pointer"
            >
              Hoy
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
