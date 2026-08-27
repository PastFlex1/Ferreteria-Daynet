import React, { useState } from 'react';
import { User, Eye, EyeOff, LogIn, Wrench, ShieldAlert } from 'lucide-react';

interface LoginViewProps {
  users: any[];
  onLogin: (user: any) => void;
  storeName: string;
  logoUrl?: string;
}

export const LoginView: React.FC<LoginViewProps> = ({ users, onLogin, storeName, logoUrl }) => {
  const [usernameInput, setUsernameInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const activeUsers = users.filter(u => u.status === 'Activo');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    setTimeout(() => {
      // Find user by username (Cédula o RUC)
      const matchedUser = activeUsers.find(
        u => u.username === usernameInput.trim()
      );

      if (!matchedUser) {
        setError('No se encontró ningún usuario activo con la Cédula o RUC ingresado.');
        setIsLoading(false);
        return;
      }

      // Check if password matches
      const correctPassword = matchedUser.password || '1234';
      if (password === correctPassword) {
        onLogin(matchedUser);
      } else {
        setError('Contraseña incorrecta. Inténtelo de nuevo.');
        setIsLoading(false);
      }
    }, 600); // Premium loading delay feel
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-white font-sans relative overflow-hidden">
      {/* Dynamic Glowing Background Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-orange-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[8000ms]"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[6000ms]"></div>
      
      {/* Decorative Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40"></div>

      <div className="relative z-10 w-full max-w-md p-4">
        {/* Glassmorphic Login Card */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl flex flex-col space-y-6">
          
          {/* Header & Logo Area */}
          <div className="text-center space-y-3">
            <div className="inline-flex relative group mx-auto">
              {logoUrl ? (
                <div className="p-3 bg-white/95 rounded-2xl shadow-xl border border-slate-700 flex items-center justify-center">
                  <img src={logoUrl} alt="Logo" className="w-16 h-16 object-contain" />
                </div>
              ) : (
                <>
                  <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl blur-md opacity-75 group-hover:opacity-100 transition duration-300"></div>
                  <div className="relative p-3.5 bg-slate-950 text-orange-500 rounded-xl border border-orange-500/25 flex items-center justify-center shadow-inner">
                    <Wrench className="w-8 h-8 stroke-[2.5]" />
                  </div>
                </>
              )}
            </div>
            
            <div className="space-y-1 pt-1.5">
              <h2 className="text-xl font-black tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                {storeName || 'Ferretería'}
              </h2>
              <p className="text-xs text-slate-400 font-semibold tracking-wider uppercase">
                Control de Acceso • Punto de Venta
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-5">
            {/* Username / Cedula o RUC Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
                Cédula o RUC
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Ingrese su Identificación (p.ej. 1724567890)"
                  value={usernameInput}
                  onChange={(e) => {
                    setUsernameInput(e.target.value);
                    setError(null);
                  }}
                  className="w-full bg-slate-950/80 border border-slate-800/90 rounded-2xl pl-10 pr-4 py-3 text-xs text-white font-mono transition focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30 outline-none"
                />
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            </div>

            {/* Password PIN Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
                Contraseña / PIN
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  className="w-full bg-slate-950/80 border border-slate-800/90 rounded-2xl pl-4 pr-12 py-3 text-xs text-white font-mono transition focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30 outline-none"
                />
                
                {/* Show/Hide password toggle */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-2xl text-[11px] font-bold flex items-start space-x-2 animate-fadeIn">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Login Action Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full relative group overflow-hidden py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs rounded-2xl shadow-xl transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <LogIn className="w-4 h-4 text-white" />
                  <span>INICIAR SESIÓN</span>
                </>
              )}
            </button>
          </form>

          {/* Footer Info */}
          <div className="text-center pt-2 space-y-1">
            <div className="text-[10px] text-slate-500 font-medium">
              Ferretería Daynet &copy; {new Date().getFullYear()} • Todos los derechos reservados.
            </div>
            <div className="text-[10px] text-slate-400 font-medium flex items-center justify-center gap-1.5 pt-0.5">
              <span>Desarrollado por:</span>
              <span className="font-bold text-slate-300">Palma Nexus Solutions</span>
              <span className="text-orange-400 font-mono font-bold">099 821 2307</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
