import apiClient from './api';

/**
 * Servicio para gestionar permisos y secciones permitidas por rol.
 * 
 * SUPER_ADMIN: Acceso a todas las secciones
 * CONTRATISTA: Solo acceso a presupuestos y obras
 */

const PERMISOS_STORAGE_KEY = 'permisos_secciones';

/**
 * Obtiene las secciones permitidas para el usuario desde el backend.
 * 
 * @param {string} rol - Rol del usuario (SUPER_ADMIN o CONTRATISTA)
 * @returns {Promise<{rol: string, secciones: string[], esSuperAdmin: boolean}>}
 */
export async function obtenerSeccionesPermitidas(rol) {
    try {
        const response = await apiClient.get('/api/permisos/secciones', {
            headers: {
                'X-User-Rol': rol
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error al obtener secciones permitidas:', error);
        
        // Fallback: si falla la API, aplicar reglas por defecto
        if (rol === 'SUPER_ADMIN') {
            return {
                rol: 'SUPER_ADMIN',
                secciones: [
                    'empresas',
                    'presupuestos',
                    'obras',
                    'clientes',
                    'profesionales',
                    'materiales',
                    'gastos-generales',
                    'proveedores',
                    'pagos-cobros-retiros',
                    'profesionales-por-obra',
                    'trabajos-diarios',
                    'nuevos-clientes',
                    'reportes',
                    'usuarios'
                ],
                esSuperAdmin: true
            };
        } else {
            return {
                rol: 'CONTRATISTA',
                secciones: ['presupuestos', 'obras', 'usuarios'], // CONTRATISTA puede gestionar su propio perfil
                esSuperAdmin: false
            };
        }
    }
}

/**
 * Guarda los permisos en localStorage.
 */
export function guardarPermisos(permisos) {
    localStorage.setItem(PERMISOS_STORAGE_KEY, JSON.stringify(permisos));
}

/**
 * Obtiene los permisos desde localStorage.
 */
export function obtenerPermisosGuardados() {
    const permisosStr = localStorage.getItem(PERMISOS_STORAGE_KEY);
    if (permisosStr) {
        try {
            return JSON.parse(permisosStr);
        } catch (error) {
            console.error('Error al parsear permisos guardados:', error);
            return null;
        }
    }
    return null;
}

/**
 * Limpia los permisos guardados.
 */
export function limpiarPermisos() {
    localStorage.removeItem(PERMISOS_STORAGE_KEY);
}

/**
 * Verifica si el usuario tiene acceso a una sección específica.
 * 
 * @param {string} seccion - Nombre de la sección (ej: 'empresas', 'presupuestos')
 * @returns {boolean} true si tiene acceso, false si no
 */
export function tieneAccesoASeccion(seccion) {
    const permisos = obtenerPermisosGuardados();
    
    console.log('🔐 tieneAccesoASeccion - Sección:', seccion, 'Permisos guardados:', permisos);
    
    if (!permisos || !permisos.secciones) {
        console.warn('⚠️ No hay permisos guardados - acceso denegado por defecto');
        return false;
    }
    
    const tieneAcceso = permisos.secciones.includes(seccion);
    console.log(tieneAcceso ? '✅' : '❌', `Acceso a '${seccion}':`, tieneAcceso);
    
    return tieneAcceso;
}

/**
 * Verifica si el usuario es super administrador.
 */
export function esSuperAdmin() {
    const permisos = obtenerPermisosGuardados();
    return permisos?.esSuperAdmin === true;
}
