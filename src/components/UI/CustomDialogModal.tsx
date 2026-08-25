import React from 'react';
import { 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  AlertTriangle, 
  X, 
  Check, 
  Trash2, 
  HelpCircle 
} from 'lucide-react';

export type DialogType = 'info' | 'success' | 'warning' | 'error' | 'confirm';

export interface DialogOptions {
  title?: string;
  message: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface CustomDialogModalProps {
  isOpen: boolean;
  options: DialogOptions | null;
  onClose: () => void;
}

export const CustomDialogModal: React.FC<CustomDialogModalProps> = ({
  isOpen,
  options,
  onClose,
}) => {
  if (!isOpen || !options) return null;

  const type = options.type || 'info';

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-8 h-8 text-emerald-400 stroke-[2.5]" />;
      case 'warning':
        return <AlertTriangle className="w-8 h-8 text-amber-400 stroke-[2.5]" />;
      case 'error':
        return <AlertCircle className="w-8 h-8 text-rose-400 stroke-[2.5]" />;
      case 'confirm':
        return <HelpCircle className="w-8 h-8 text-orange-400 stroke-[2.5]" />;
      default:
        return <Info className="w-8 h-8 text-blue-400 stroke-[2.5]" />;
    }
  };

  const getHeaderBg = () => {
    switch (type) {
      case 'success':
        return 'bg-emerald-500/10 border-emerald-500/30';
      case 'warning':
        return 'bg-amber-500/10 border-amber-500/30';
      case 'error':
        return 'bg-rose-500/10 border-rose-500/30';
      case 'confirm':
        return 'bg-orange-500/10 border-orange-500/30';
      default:
        return 'bg-blue-500/10 border-blue-500/30';
    }
  };

  const handleConfirm = () => {
    if (options.onConfirm) {
      options.onConfirm();
    }
    onClose();
  };

  const handleCancel = () => {
    if (options.onCancel) {
      options.onCancel();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden ring-1 ring-orange-500/20 text-white my-auto">
        {/* Header Visual */}
        <div className={`p-6 flex flex-col items-center text-center border-b ${getHeaderBg()}`}>
          <div className="p-3 bg-slate-900/90 rounded-2xl shadow-inner mb-3 border border-slate-800">
            {getIcon()}
          </div>
          <h3 className="text-base font-black text-white tracking-wide">
            {options.title || (type === 'confirm' ? 'Confirmación Requerida' : 'Aviso del Sistema')}
          </h3>
        </div>

        {/* Message Content */}
        <div className="p-6 text-center space-y-4">
          <p className="text-xs text-slate-300 font-medium leading-relaxed">
            {options.message}
          </p>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-center gap-3">
            {type === 'confirm' ? (
              <>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer border border-slate-800"
                >
                  {options.cancelText || 'Cancelar'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-lg shadow-orange-500/25 transition cursor-pointer"
                >
                  {options.confirmText || 'Sí, Confirmar'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleConfirm}
                className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-lg shadow-orange-500/25 transition cursor-pointer"
              >
                {options.confirmText || 'Entendido'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
