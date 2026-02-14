// Servicio para endpoints de trabajos adicionales
import apiClient from './api';

const BASE_URL = '/api/trabajos-adicionales';

// El backend ya devuelve los datos en camelCase, no necesitamos transformación

/**
 * Crear un nuevo trabajo adicional
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
 * Obtener trabajo adicional por ID
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
  listarTrabajosAdicionales,
  obtenerTrabajoAdicionalPorId,
  actualizarTrabajoAdicional,
  eliminarTrabajoAdicional,
  actualizarEstadoTrabajoAdicional,
  filtrarPorObra,
  filtrarPorTrabajoExtra,
  ESTADOS_TRABAJO_ADICIONAL,
  COLORES_ESTADO,
  ICONOS_ESTADO
};
