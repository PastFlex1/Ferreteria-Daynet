import React, { useEffect, useState } from 'react';
import { Wrench, Loader2, Store, CheckCircle2, ShieldCheck, Zap, Layers } from 'lucide-react';

interface SplashScreenProps {
  onComplete?: () => void;
  storeName?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ 
  onComplete, 
  storeName = 'Ferretería DAYNET' 
}) => {
  const [progress, setProgress] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);

  const statuses = [
    'Inicializando sistema de punto de venta...',
    'Cargando catálogo de productos y precios...',
    'Verificando módulo de facturación electrónica SRI...',
    'Sincronizando caja chica e historial de transacciones...',
    '¡Todo listo para trabajar!'
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          if (onComplete) setTimeout(onComplete, 200);
          return 100;
        }
        const next = prev + Math.floor(Math.random() * 15) + 8;
        return next > 100 ? 100 : next;
      });
    }, 120);

    return () => clearInterval(interval);
  }, [onComplete]);

  useEffect(() => {
    if (progress < 25) setStatusIndex(0);
    else if (progress < 50) setStatusIndex(1);
    else if (progress < 75) setStatusIndex(2);
    else if (progress < 95) setStatusIndex(3);
    else setStatusIndex(4);
  }, [progress]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-6 select-none overflow-hidden">
      {/* Background Ambient Lights */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10 max-w-md w-full text-center space-y-8">
        {/* Animated Brand Logo */}
        <div className="relative inline-block mx-auto">
          <div className="absolute -inset-2 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 rounded-3xl blur-md opacity-70 animate-pulse"></div>
          <div className="relative p-6 bg-slate-900 border border-orange-500/40 rounded-2xl shadow-2xl text-orange-400 flex items-center justify-center">
            <Wrench className="w-12 h-12 stroke-[2.5] animate-bounce" />
          </div>
        </div>

        {/* Store Title */}
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-orange-500/10 border border-orange-500/30 rounded-full text-orange-400 text-xs font-black tracking-widest uppercase shadow-sm">
            <Store className="w-3.5 h-3.5" />
            <span>SISTEMA DE FACTURACIÓN & POS</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            FERRETERÍA <span className="text-orange-500">DAYNET</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Control de Inventario, Ventas, Caja & Comprobantes SRI
          </p>
        </div>

        {/* Progress Bar & Status Text */}
        <div className="space-y-3 bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-bold flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-orange-400 animate-spin" />
              <span>{statuses[statusIndex]}</span>
            </span>
            <span className="text-orange-400 font-mono font-black">{progress}%</span>
          </div>

          <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-700/60">
            <div 
              className="h-full bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 rounded-full transition-all duration-300 shadow-lg shadow-orange-500/50"
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 font-mono">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Conexión Segura</span>
            </span>
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              <span>v2.5 High-Speed</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ModuleSkeletonProps {
  title?: string;
}

export const ModuleSkeleton: React.FC<ModuleSkeletonProps> = ({ title = 'Cargando Módulo...' }) => {
  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-pulse select-none">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-slate-800 rounded-lg"></div>
          <div className="h-4 w-72 bg-slate-800/60 rounded-lg"></div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-28 bg-slate-800 rounded-xl"></div>
          <div className="h-10 w-36 bg-orange-500/20 rounded-xl"></div>
        </div>
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-3">
            <div className="flex justify-between items-center">
              <div className="h-4 w-24 bg-slate-800 rounded"></div>
              <div className="h-8 w-8 bg-slate-800 rounded-xl"></div>
            </div>
            <div className="h-7 w-32 bg-slate-800 rounded-lg"></div>
            <div className="h-3 w-20 bg-slate-800/50 rounded"></div>
          </div>
        ))}
      </div>

      {/* Main Table / View Skeleton */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex justify-between items-center gap-4 pb-4 border-b border-slate-800">
          <div className="h-10 w-64 bg-slate-800 rounded-xl"></div>
          <div className="flex gap-2">
            <div className="h-10 w-24 bg-slate-800 rounded-xl"></div>
            <div className="h-10 w-24 bg-slate-800 rounded-xl"></div>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="h-12 bg-slate-800/40 rounded-xl border border-slate-800/60 flex items-center px-4 justify-between">
              <div className="h-4 w-32 bg-slate-800 rounded"></div>
              <div className="h-4 w-48 bg-slate-800 rounded"></div>
              <div className="h-4 w-20 bg-slate-800 rounded"></div>
              <div className="h-6 w-16 bg-slate-800 rounded-full"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface ActionLoadingOverlayProps {
  message?: string;
  submessage?: string;
}

export const ActionLoadingOverlay: React.FC<ActionLoadingOverlayProps> = ({
  message = 'Procesando información...',
  submessage = 'Por favor espere un momento'
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl max-w-sm w-full text-center space-y-4">
        <div className="relative inline-flex items-center justify-center">
          <div className="w-14 h-14 rounded-full border-4 border-orange-500/20 border-t-orange-500 animate-spin"></div>
          <Wrench className="w-6 h-6 text-orange-400 absolute" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white">{message}</h3>
          <p className="text-xs text-slate-400">{submessage}</p>
        </div>
      </div>
    </div>
  );
};
