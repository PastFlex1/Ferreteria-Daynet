import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
  align?: 'left' | 'right' | 'auto';
}

const DAYS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  className = '',
  align = 'auto'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownAlign, setDropdownAlign] = useState<'left' | 'right'>('left');
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Parse value or use today
  const parsedDate = value ? new Date(value + 'T12:00:00') : new Date();
  const [viewDate, setViewDate] = useState(parsedDate);

  useEffect(() => {
    if (value) {
      setViewDate(new Date(value + 'T12:00:00'));
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      if (align === 'right') {
        setDropdownAlign('right');
      } else if (align === 'left') {
        setDropdownAlign('left');
      } else {
        const rect = containerRef.current.getBoundingClientRect();
        const calendarWidth = 295; // w-72 (288px) + margin
        if (rect.left + calendarWidth > window.innerWidth - 16) {
          setDropdownAlign('right');
        } else {
          setDropdownAlign('left');
        }
      }
    }
  }, [isOpen, align]);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleDateSelect = (day: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    const yyyy = newDate.getFullYear();
    const mm = String(newDate.getMonth() + 1).padStart(2, '0');
    const dd = String(newDate.getDate()).padStart(2, '0');
    onChange(`${yyyy}-${mm}-${dd}`);
    setIsOpen(false);
  };

  const renderCalendar = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-8 w-8"></div>);
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
          className={`h-8 w-8 rounded-full flex items-center justify-center text-sm transition-all
            ${isSelected ? 'bg-orange-500 text-white font-black shadow-md shadow-orange-500/40' : 
              isToday ? 'bg-orange-100 text-orange-700 font-bold' : 
              'text-slate-700 hover:bg-slate-100 font-medium'}`}
        >
          {day}
        </button>
      );
    }
    return days;
  };

  const displayFormat = value ? value.split('-').reverse().join('/') : 'dd/mm/aaaa';

  return (
    <div className="relative w-full" ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between cursor-pointer px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-800 focus-within:ring-2 focus-within:ring-orange-500 transition-all ${className} ${!value ? 'text-slate-400' : ''}`}
      >
        <span>{displayFormat}</span>
        <CalendarIcon className="w-4 h-4 text-slate-400" />
      </div>

      {isOpen && (
        <div className={`absolute z-50 mt-2 p-4 bg-white border border-slate-200 shadow-2xl rounded-3xl w-72 ${
          dropdownAlign === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'
        } transform animate-in fade-in slide-in-from-top-2`}>
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={handlePrevMonth} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-600 transition">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="font-black text-slate-800 text-sm">
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </div>
            <button type="button" onClick={handleNextMonth} className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-600 transition">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {DAYS.map(d => (
              <div key={d} className="text-[10px] font-black text-slate-400 uppercase">{d}</div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1 place-items-center">
            {renderCalendar()}
          </div>
        </div>
      )}
    </div>
  );
};
