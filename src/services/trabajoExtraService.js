// Servicio para gestión de Trabajos Extra
import apiClient from './api';

/**
 * Obtener detalles de un trabajo extra
 * @param {number} trabajoExtraId - ID del trabajo extra
 * @param {number} empresaId - ID de la empresa
 * @returns {Promise} Datos completos del trabajo extra
 */
export const obtenerTrabajoExtra = async (trabajoExtraId, empresaId) => {
  const response = await apiClient.get(
    `/api/v1/trabajos-extra/${trabajoExtraId}`,
    {
      headers: { 'X-Tenant-ID': empresaId },
      params: { empresaId }
    }
  );
  return response.data;
};

/**
 * Actualizar un trabajo extra (incluyendo su presupuesto con itemsCalculadora)
 * @param {number} trabajoExtraId - ID del trabajo extra
 * @param {Object} datosActualizados - Objeto completo del trabajo extra actualizado
 * @param {number} empresaId - ID de la empresa
 * @returns {Promise} Datos actualizados del trabajo extra
 */
export const actualizarTrabajoExtra = async (trabajoExtraId, datosActualizados, empresaId) => {
  const response = await apiClient.put(
    `/api/v1/trabajos-extra/${trabajoExtraId}`,
    datosActualizados,
    {
      headers: { 'X-Tenant-ID': empresaId },
      params: { empresaId }
    }
  );
  return response.data;
};

/**
 * Crear un nuevo trabajo extra
 * @param {Object} data - Datos del trabajo extra
 * @param {number} empresaId - ID de la empresa
 * @returns {Promise} Datos del trabajo extra creado
 */
export const crearTrabajoExtra = async (data, empresaId) => {
  const response = await apiClient.post(
    '/api/v1/trabajos-extra',
    data,
    {
      headers: { 'X-Tenant-ID': empresaId },
      params: { empresaId }
    }
  );
  return response.data;
};

/**
 * Listar trabajos extra de una obra
 * @param {number} obraId - ID de la obra
 * @param {number} empresaId - ID de la empresa
 * @returns {Promise} Lista de trabajos extra
 */
export const listarTrabajosExtraDeObra = async (obraId, empresaId) => {
  const response = await apiClient.get(
    `/api/v1/trabajos-extra/obra/${obraId}`,
    {
      headers: { 'X-Tenant-ID': empresaId },
      params: { empresaId }
    }
  );
  return response.data;
};

/**
 * Eliminar un trabajo extra
 * @param {number} trabajoExtraId - ID del trabajo extra
 * @param {number} empresaId - ID de la empresa
 * @returns {Promise} Confirmación de eliminación
 */
export const eliminarTrabajoExtra = async (trabajoExtraId, empresaId) => {
  const response = await apiClient.delete(
    `/api/v1/trabajos-extra/${trabajoExtraId}`,
    {
      headers: { 'X-Tenant-ID': empresaId },
      params: { empresaId }
    }
  );
  return response.data;
};
