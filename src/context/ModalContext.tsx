import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CustomDialogModal, DialogOptions } from '../components/UI/CustomDialogModal';
import { CheckCircle2, X, AlertCircle, Info } from 'lucide-react';


export interface ToastOptions {
  id: string;
  message: string;
  type?: 'success' | 'info' | 'warning' | 'error';
}

interface ModalContextType {
  showAlert: (message: string, title?: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  showConfirm: (message: string, onConfirm: () => void, title?: string, confirmText?: string, cancelText?: string) => void;
  showToast: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastOptions[]>([]);

  const showToast = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };
  const [dialogOptions, setDialogOptions] = useState<DialogOptions | null>(null);

  const showAlert = (
    message: string, 
    title?: string, 
    type: 'info' | 'success' | 'warning' | 'error' = 'info'
  ) => {
    setDialogOptions({
      message,
      title: title || (type === 'error' ? 'Error' : type === 'warning' ? 'Atención' : type === 'success' ? 'Éxito' : 'Aviso'),
      type,
    });
    setIsOpen(true);
  };

  const showConfirm = (
    message: string, 
    onConfirm: () => void, 
    title?: string, 
    confirmText?: string, 
    cancelText?: string
  ) => {
    setDialogOptions({
      message,
      title: title || 'Confirmación Requerida',
      type: 'confirm',
      confirmText,
      cancelText,
      onConfirm,
    });
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm, showToast }}>
      {children}

      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div 
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border animate-slideUp ${
              toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
              toast.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' :
              toast.type === 'warning' ? 'bg-amber-50 text-amber-800 border-amber-200' :
              'bg-blue-50 text-blue-800 border-blue-200'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600" />}
            {toast.type === 'warning' && <AlertCircle className="w-5 h-5 text-amber-600" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-blue-600" />}
            
            <span className="font-semibold text-sm mr-2">{toast.message}</span>
            
            <button onClick={() => removeToast(toast.id)} className="text-slate-400 hover:text-slate-600 ml-auto focus:outline-none">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <CustomDialogModal
        isOpen={isOpen}
        options={dialogOptions}
        onClose={handleClose}
      />
    </ModalContext.Provider>
  );
};

export const useModal = (): ModalContextType => {
  const context = useContext(ModalContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      showAlert: (msg, title) => alert(`${title ? title + ': ' : ''}${msg}`),
      showConfirm: (msg, onConfirm) => {
        if (confirm(msg)) onConfirm();
      },
      showToast: (msg) => console.log('Toast:', msg),
    };
  }
  return context;
};
