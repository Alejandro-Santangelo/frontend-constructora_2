import apiService from './api';

// ================================================================================
// SERVICIO: Reportes del Sistema
// ================================================================================
// Endpoints para gestionar auditorías y backups automáticos del sistema
// ================================================================================

const BASE_URL = '/api/reportes-sistema';

/**
 * Interfaz TypeScript (para referencia)
 *
 * interface ReporteArchivo {
 *   nombre: string;
 *   tipo: 'AUDITORIA' | 'BACKUP';
 *   tamanoBytes: number;
 *   tamanoLegible: string;
 *   fechaCreacion: string;
 *   rutaRelativa: string;
 * }
 *
 * interface ReportesResponse {
 *   auditorias: ReporteArchivo[];
 *   backups: ReporteArchivo[];
 *   totalAuditorias: number;
 *   totalBackups: number;
 * }
 */

/**
 * Obtiene el listado completo de reportes (auditorías y backups)
 * @returns {Promise<ReportesResponse>}
 */
export const obtenerReportes = async () => {
  try {
    const response = await apiService.get(BASE_URL);
    return response;
  } catch (error) {
    console.error('[ReportesSistema] Error al obtener reportes:', error);
    throw error;
  }
};

/**
 * Obtiene solo las auditorías disponibles
 * @returns {Promise<ReporteArchivo[]>}
 */
export const obtenerAuditorias = async () => {
  try {
    const response = await apiService.get(`${BASE_URL}/auditorias`);
    return response;
  } catch (error) {
    console.error('[ReportesSistema] Error al obtener auditorías:', error);
    throw error;
  }
};

/**
 * Obtiene solo los backups disponibles
 * @returns {Promise<ReporteArchivo[]>}
 */
export const obtenerBackups = async () => {
  try {
    const response = await apiService.get(`${BASE_URL}/backups`);
    return response;
  } catch (error) {
    console.error('[ReportesSistema] Error al obtener backups:', error);
    throw error;
  }
};

/**
 * Genera la URL para descargar un archivo
 * @param {string} tipo - 'AUDITORIA' o 'BACKUP'
 * @param {string} nombreArchivo - Nombre del archivo a descargar
 * @returns {string} URL completa para descarga
 */
export const obtenerUrlDescarga = (tipo, nombreArchivo) => {
  return `${BASE_URL}/descargar/${tipo}/${nombreArchivo}`;
};

/**
 * Genera la URL para visualizar una auditoría en el navegador
 * @param {string} nombreArchivo - Nombre del archivo HTML de auditoría
 * @returns {string} URL completa para visualización
 */
export const obtenerUrlVisualizacion = (nombreArchivo) => {
  return `${BASE_URL}/ver/auditoria/${nombreArchivo}`;
};

/**
 * Descarga un archivo abriendo una nueva pestaña
 * @param {string} tipo - 'AUDITORIA' o 'BACKUP'
 * @param {string} nombreArchivo - Nombre del archivo
 */
export const descargarArchivo = (tipo, nombreArchivo) => {
  const url = obtenerUrlDescarga(tipo, nombreArchivo);
  window.open(url, '_blank');
};

/**
 * Visualiza una auditoría en una nueva pestaña
 * @param {string} nombreArchivo - Nombre del archivo HTML
 */
export const visualizarAuditoria = (nombreArchivo) => {
  const url = obtenerUrlVisualizacion(nombreArchivo);
  window.open(url, '_blank');
};

/**
 * Formatea una fecha ISO a formato legible
 * @param {string} fechaISO - Fecha en formato ISO 8601
 * @returns {string} Fecha formateada
 */
export const formatearFecha = (fechaISO) => {
  if (!fechaISO) return 'Fecha desconocida';

  try {
    const fecha = new Date(fechaISO);
    return fecha.toLocaleString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('[ReportesSistema] Error al formatear fecha:', error);
    return fechaISO;
  }
};

export const ejecutarAuditoria = async () => {
  try {
    // CRÍTICO: Timeout de 60 segundos - los scripts tardan 10-30 segundos
    // IMPORTANTE: Backend rechaza body {} - enviar null
    const response = await apiService.post(
      `${BASE_URL}/ejecutar/auditoria`,
      null, // Sin body (NO enviar {})
      { timeout: 60000 } // 60 segundos
    );
    return response;
  } catch (error) {
    console.error('[ReportesSistema] Error al ejecutar auditoría:', error?.message || error);
    throw error;
  }
};

/**
 * Ejecuta un backup de base de datos manualmente
 * IMPORTANTE: Esta operación puede tardar 10-30 segundos
 * @returns {Promise<string>} Mensaje de confirmación
 */
export const ejecutarBackup = async () => {
  try {
    // CRÍTICO: Timeout de 60 segundos - los scripts tardan 10-30 segundos
    // IMPORTANTE: Backend rechaza body {} - enviar null
    const response = await apiService.post(
      `${BASE_URL}/ejecutar/backup`,
      null, // Sin body (NO enviar {})
      { timeout: 60000 } // 60 segundos
    );
    return response;
  } catch (error) {
    console.error('[ReportesSistema] Error al ejecutar backup:', error?.message || error);
    throw error;
  }
};
