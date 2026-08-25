import React from 'react';
import { formatCurrency } from '../../utils/formatters';

export interface SriTotalsBreakdown {
  subtotalSinImpuestos: number;
  subtotal15: number;
  subtotal5: number;
  subtotalEspecial: number;
  subtotal0: number;
  subtotalNoObjeto: number;
  subtotalExento: number;
  totalDescuento: number;
  valorIce: number;
  iva15: number;
  iva5: number;
  ivaEspecial: number;
  propina10Enabled: boolean;
  propina10Amount: number;
  valorAPagar: number;
}

interface SriTotalsTableProps {
  breakdown: SriTotalsBreakdown;
  currencySymbol?: string;
  readOnly?: boolean;
  onTogglePropina?: (enabled: boolean) => void;
  className?: string;
  theme?: 'blue' | 'dark' | 'slate';
  totalLabel?: string;
}

export const SriTotalsTable: React.FC<SriTotalsTableProps> = ({
  breakdown,
  currencySymbol = '$',
  readOnly = false,
  onTogglePropina,
  className = '',
  theme = 'blue',
  totalLabel = 'Valor a pagar:',
}) => {
  const headerBg = theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-[#0f4c96] text-white';

  const rows = [
    { label: 'Subtotal sin impuestos:', value: breakdown.subtotalSinImpuestos },
    { label: 'Subtotal 15.00%:', value: breakdown.subtotal15 },
    { label: 'Subtotal 5%:', value: breakdown.subtotal5 },
    { label: 'Subtotal tarifa especial:', value: breakdown.subtotalEspecial },
    { label: 'Subtotal 0%:', value: breakdown.subtotal0 },
    { label: 'Subtotal no objeto de IVA:', value: breakdown.subtotalNoObjeto },
    { label: 'Subtotal exento de IVA:', value: breakdown.subtotalExento },
    { label: 'Total descuento:', value: breakdown.totalDescuento },
    { label: 'Valor ICE:', value: breakdown.valorIce },
    { label: 'IVA 15.00% :', value: breakdown.iva15 },
    { label: 'IVA 5% :', value: breakdown.iva5 },
    { label: 'IVA tarifa especial:', value: breakdown.ivaEspecial },
  ];

  return (
    <div className={`overflow-hidden border border-slate-300 rounded-lg text-xs font-sans ${className}`}>
      <table className="w-full border-collapse">
        <thead>
          <tr className={`${headerBg} font-bold text-xs`}>
            <th className="py-2 px-3 text-left w-2/3 border-r border-blue-400/30">Detalle</th>
            <th className="py-2 px-3 text-right w-1/3">Valores</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white text-slate-800">
          {rows.map((row, idx) => (
            <tr key={idx} className="hover:bg-slate-50/70">
              <td className="py-1.5 px-3 text-left font-medium text-slate-700">{row.label}</td>
              <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">
                {formatCurrency(row.value, currencySymbol).replace(currencySymbol, '').trim()}
              </td>
            </tr>
          ))}

          {/* Propina 10% Row */}
          <tr className="hover:bg-slate-50/70 bg-slate-50/40">
            <td className="py-1.5 px-3 text-left font-medium text-slate-700 flex items-center gap-2">
              <span>Propina 10%:</span>
              {!readOnly && onTogglePropina ? (
                <input
                  type="checkbox"
                  checked={breakdown.propina10Enabled}
                  onChange={(e) => onTogglePropina(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                />
              ) : (
                <span className="inline-block w-4 h-4 border border-slate-400 rounded bg-white text-center text-[10px] leading-3 font-bold">
                  {breakdown.propina10Enabled ? '✓' : ''}
                </span>
              )}
            </td>
            <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">
              {breakdown.propina10Amount > 0
                ? formatCurrency(breakdown.propina10Amount, currencySymbol).replace(currencySymbol, '').trim()
                : '0.00'}
            </td>
          </tr>

          {/* Valor a Pagar Final Row */}
          <tr className="bg-slate-100 font-black text-slate-950 border-t-2 border-slate-400">
            <td className="py-2 px-3 text-left font-extrabold text-xs">{totalLabel}</td>
            <td className="py-2 px-3 text-right font-mono font-black text-sm text-blue-900">
              {formatCurrency(breakdown.valorAPagar, currencySymbol)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
