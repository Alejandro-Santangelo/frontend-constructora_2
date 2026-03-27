// Servicio para endpoints de trabajos adicionales
import apiClient from './api';

const BASE_URL = '/api/trabajos-adicionales';

// El backend ya devuelve los datos en camelCase, no necesitamos transformación

/**
 * Crear un nuevo trabajo adicional (directo, sin borrador)
 * @param {Object} data - TrabajoAdicionalRequestDTO
 * @returns {Promise} - TrabajoAdicionalResponseDTO
 */
export const crearTrabajoAdicional = async (data) => {
  try {
    const response = await apiClient.post(BASE_URL, data);
    return response.data;
  } catch (error) {
    console.error('❌ Error al crear trabajo adicional:', error);
    throw error;
  }
};

/**
 * Crear un borrador de trabajo adicional (estado BORRADOR)
 * @param {Object} data - TrabajoAdicionalRequestDTO
 * @returns {Promise} - TrabajoAdicionalResponseDTO
 */
export const crearBorradorTrabajoAdicional = async (data) => {
  try {
    const response = await apiClient.post(`${BASE_URL}/borrador`, data);
    return response.data;
  } catch (error) {
    console.error('❌ Error al crear borrador trabajo adicional:', error);
    throw error;
  }
};

/**
 * Actualizar un borrador de trabajo adicional existente
 * @param {number} id - ID del borrador
 * @param {Object} data - TrabajoAdicionalRequestDTO (campos a actualizar)
 * @returns {Promise} - TrabajoAdicionalResponseDTO
 */
export const actualizarBorradorTrabajoAdicional = async (id, data) => {
  try {
    const response = await apiClient.put(`${BASE_URL}/borrador/${id}`, data);
    return response.data;
  } catch (error) {
    console.error(`❌ Error al actualizar borrador trabajo adicional ${id}:`, error);
    throw error;
  }
};

/**
 * Confirmar un borrador de trabajo adicional (BORRADOR → PENDIENTE)
 * @param {number} id - ID del borrador
 * @returns {Promise} - TrabajoAdicionalResponseDTO
 */
export const confirmarBorradorTrabajoAdicional = async (id) => {
  try {
    const response = await apiClient.post(`${BASE_URL}/borrador/${id}/confirmar`);
    return response.data;
  } catch (error) {
    console.error(`❌ Error al confirmar borrador trabajo adicional ${id}:`, error);
    throw error;
  }
};

/**
 * Listar borradores de trabajos adicionales
 * @param {number} empresaId - ID de la empresa (obligatorio)
 * @param {number} obraId - ID de la obra (opcional)
 * @returns {Promise<Array>} - Array de TrabajoAdicionalResponseDTO
 */
export const listarBorradoresTrabajoAdicional = async (empresaId, obraId = null) => {
  try {
    const params = { empresaId };
    if (obraId) {
      params.obraId = obraId;
    }

    const response = await apiClient.get(`${BASE_URL}/borradores`, { params });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    console.error('❌ Error al listar borradores trabajos adicionales:', error.message);
    return [];
  }
};

/**
 * Listar todos los trabajos adicionales
 * @param {number} empresaId - ID de la empresa (opcional, para filtrar)
 * @returns {Promise<Array>} - Array de TrabajoAdicionalResponseDTO
 */
export const listarTrabajosAdicionales = async (empresaId = null) => {
  try {
    const params = empresaId ? { empresaId } : {};

    // Timeout manual de 5 segundos para evitar cuelgues
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout de 5 segundos alcanzado')), 5000)
    );

    const requestPromise = apiClient.get(BASE_URL, { params });
    const response = await Promise.race([requestPromise, timeoutPromise]);

    // El response puede venir directamente como array (interceptor) o como objeto con .data
    let data;
    if (Array.isArray(response)) {
      data = response;
    } else if (response.data && Array.isArray(response.data)) {
      data = response.data;
    } else {
      data = [];
    }

    return data;
  } catch (error) {
    console.error('❌ Error al listar trabajos adicionales:', error.message);
    return [];
  }
};

/**
 * Obtener trabajo adicional por ID (incluye presupuestosTareasLeves)
 * @param {number} id - ID del trabajo adicional
 * @returns {Promise} - TrabajoAdicionalResponseDTO
 */
export const obtenerTrabajoAdicionalPorId = async (id) => {
  try {
    const response = await apiClient.get(`${BASE_URL}/${id}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Error al obtener trabajo adicional ${id}:`, error);
    throw error;
  }
};

// Alias de compatibilidad con código legado
export const obtenerTrabajoPorId = async (id) => {
  return obtenerTrabajoAdicionalPorId(id);
};

/**
 * Obtener trabajos adicionales de una obra específica
 * @param {number} obraId - ID de la obra
 * @returns {Promise<Array>} - Array de TrabajoAdicionalResponseDTO (incluye presupuestosTareasLeves)
 */
export const obtenerTrabajosAdicionalesPorObra = async (obraId) => {
  try {
    const response = await apiClient.get(`${BASE_URL}/obra/${obraId}`);
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    console.error(`❌ Error al obtener trabajos adicionales de obra ${obraId}:`, error);
    return [];
  }
};

/**
 * Actualizar trabajo adicional existente
 * @param {number} id - ID del trabajo adicional
 * @param {Object} data - TrabajoAdicionalRequestDTO
 * @returns {Promise} - TrabajoAdicionalResponseDTO
 */
export const actualizarTrabajoAdicional = async (id, data) => {
  try {
    const response = await apiClient.put(`${BASE_URL}/${id}`, data);
    return response.data;
  } catch (error) {
    console.error(`❌ Error al actualizar trabajo adicional ${id}:`, error);
    throw error;
  }
};

/**
 * Eliminar trabajo adicional
 * @param {number} id - ID del trabajo adicional
 * @returns {Promise<void>}
 */
export const eliminarTrabajoAdicional = async (id) => {
  try {
    await apiClient.delete(`${BASE_URL}/${id}`);
  } catch (error) {
    console.error(`❌ Error al eliminar trabajo adicional ${id}:`, error);
    throw error;
  }
};

/**
 * Actualizar solo el estado del trabajo adicional
 * @param {number} id - ID del trabajo adicional
 * @param {string} estado - PENDIENTE | EN_PROGRESO | COMPLETADO | CANCELADO
 * @returns {Promise} - TrabajoAdicionalResponseDTO
 */
export const actualizarEstadoTrabajoAdicional = async (id, estado) => {
  try {
    const response = await apiClient.patch(`${BASE_URL}/${id}/estado`, { estado });
    return response.data;
  } catch (error) {
    console.error(`❌ Error al actualizar estado de trabajo adicional ${id}:`, error);
    throw error;
  }
};

/**
 * Filtrar trabajos adicionales por obra
 * @param {Array} trabajosAdicionales - Array completo de trabajos
 * @param {number} obraId - ID de la obra
 * @returns {Array} - Trabajos adicionales filtrados
 */
export const filtrarPorObra = (trabajosAdicionales, obraId) => {
  return trabajosAdicionales.filter(ta => ta.obraId === obraId && !ta.trabajoExtraId);
};

/**
 * Filtrar trabajos adicionales por trabajo extra
 * @param {Array} trabajosAdicionales - Array completo de trabajos
 * @param {number} trabajoExtraId - ID del trabajo extra
 * @returns {Array} - Trabajos adicionales filtrados
 */
export const filtrarPorTrabajoExtra = (trabajosAdicionales, trabajoExtraId) => {
  return trabajosAdicionales.filter(ta => ta.trabajoExtraId === trabajoExtraId);
};

// Estados disponibles
export const ESTADOS_TRABAJO_ADICIONAL = {
  PENDIENTE: 'PENDIENTE',
  EN_PROGRESO: 'EN_PROGRESO',
  COMPLETADO: 'COMPLETADO',
  CANCELADO: 'CANCELADO'
};

// Colores para badges de estado
export const COLORES_ESTADO = {
  PENDIENTE: 'secondary',
  EN_PROGRESO: 'primary',
  COMPLETADO: 'success',
  CANCELADO: 'danger'
};

// Iconos para estados
export const ICONOS_ESTADO = {
  PENDIENTE: 'clock',
  EN_PROGRESO: 'spinner',
  COMPLETADO: 'check-circle',
  CANCELADO: 'times-circle'
};

export default {
  crearTrabajoAdicional,
  crearBorradorTrabajoAdicional,
  actualizarBorradorTrabajoAdicional,
  confirmarBorradorTrabajoAdicional,
  listarBorradoresTrabajoAdicional,
  listarTrabajosAdicionales,
  obtenerTrabajoPorId,
  obtenerTrabajoAdicionalPorId,
  obtenerTrabajosAdicionalesPorObra,
  actualizarTrabajoAdicional,
  eliminarTrabajoAdicional,
  actualizarEstadoTrabajoAdicional,
  filtrarPorObra,
  filtrarPorTrabajoExtra,
  ESTADOS_TRABAJO_ADICIONAL,
  COLORES_ESTADO,
  ICONOS_ESTADO
};
