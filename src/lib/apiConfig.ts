/**
 * Configuración centralizada de API y URLs del backend
 * Admite variables de entorno VITE_API_URL o VITE_BACKEND_URL, con fallback a rutas relativas para despliegues monolíticos (Express sirviendo dist/).
 */

export const API_BASE_URL: string = (
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_BACKEND_URL) ||
  (typeof window !== 'undefined' && (window as any).__API_URL__) ||
  ''
).replace(/\/$/, '');

/**
 * Retorna la URL absoluta o relativa para un endpoint dado.
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

/**
 * Obtiene los headers de autenticación JWT almacenados en la sesión activa.
 */
export function getAuthHeaders(): Record<string, string> {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('ferreteria_auth_token') : null;
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}
