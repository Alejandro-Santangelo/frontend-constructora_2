// Servicio para gestión de Gastos de Obra
import apiClient from './api';

/**
 * Registrar un nuevo gasto
 * @param {Object} data - Datos del gasto
 * @param {number} empresaId - ID de la empresa (multi-tenant)
 * @returns {Promise} Respuesta con el gasto creado
 */
export const registrarGasto = async (data, empresaId) => {
  const response = await apiClient.post(
    '/api/v1/gastos-obra-profesional',
    data,
    { 
      headers: { 'X-Tenant-ID': empresaId },
      params: { empresaId }
    }
  );
  return response.data;
};

/**
 * Listar gastos de un profesional
 * @param {number} profesionalObraId - ID de la asignación profesional-obra
 * @param {number} empresaId - ID de la empresa
 * @param {string} fechaDesde - Fecha desde (opcional, formato: YYYY-MM-DD)
 * @param {string} fechaHasta - Fecha hasta (opcional, formato: YYYY-MM-DD)
 * @returns {Promise} Lista de gastos
 */
export const listarGastosPorProfesional = async (profesionalObraId, empresaId, fechaDesde = null, fechaHasta = null) => {
  const params = { empresaId };
  if (fechaDesde) params.fechaDesde = fechaDesde;
  if (fechaHasta) params.fechaHasta = fechaHasta;

  const response = await apiClient.get(
    `/api/v1/gastos-obra-profesional/profesional/${profesionalObraId}`,
    { 
      headers: { 'X-Tenant-ID': empresaId },
      params
    }
  );
  return response.data;
};

/**
 * Obtener detalle de un gasto específico
 * @param {number} gastoId - ID del gasto
 * @param {number} empresaId - ID de la empresa
 * @returns {Promise} Datos del gasto
 */
export const obtenerDetalleGasto = async (gastoId, empresaId) => {
  const response = await apiClient.get(
    `/api/v1/gastos-obra-profesional/${gastoId}`,
    { 
      headers: { 'X-Tenant-ID': empresaId },
      params: { empresaId }
    }
  );
  return response.data;
};

/**
 * Formatear fecha para mostrar (DD/MM/YYYY)
 * @param {string} fecha - Fecha en formato ISO
 * @returns {string} Fecha formateada
 */
export const formatearFecha = (fecha) => {
  if (!fecha) return '-';
  const date = new Date(fecha);
  return date.toLocaleDateString('es-AR');
};

/**
 * Formatear fecha y hora (DD/MM/YYYY HH:mm)
 * @param {string} fechaHora - Fecha/hora en formato ISO
 * @returns {string} Fecha/hora formateada
 */
export const formatearFechaHora = (fechaHora) => {
  if (!fechaHora) return '-';
  const date = new Date(fechaHora);
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
