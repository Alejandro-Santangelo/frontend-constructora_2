// Servicio para gestión de Caja Chica de Profesionales en Obra
import api from './api';
import eventBus, { FINANCIAL_EVENTS } from '../utils/eventBus';

/**
 * Asignar caja chica a múltiples profesionales
 * POST /v1/caja-chica-obra/asignar-multiple
 * @param {Object} data - {presupuestoNoClienteId, profesionalesIds: [Long], monto, fecha, observaciones}
 * @param {number} empresaId - ID de la empresa (multi-tenant)
 * @returns {Promise} Lista de CajaChicaObra creados
 */
export const asignarCajaChicaMultiple = async (data, empresaId) => {
  try {
    const response = await api.post('/api/v1/caja-chica-obra/asignar-multiple', data, { empresaId });
    
    // 🔔 Emitir evento para sincronización automática
    eventBus.emit(FINANCIAL_EVENTS.CAJA_CHICA_ASIGNADA, {
      asignaciones: response,
      empresaId,
      presupuestoNoClienteId: data.presupuestoNoClienteId
    });
    
    return response;
  } catch (error) {
    console.error('Error asignando caja chica:', error);
    throw error;
  }
};

/**
 * Obtener todas las asignaciones de caja chica de una obra
 * GET /v1/caja-chica-obra/obra/{presupuestoNoClienteId}
 * @param {number} presupuestoNoClienteId - ID del presupuesto
 * @param {number} empresaId - ID de la empresa
 * @returns {Promise} Lista de asignaciones de caja chica
 */
export const obtenerCajaChicaPorObra = async (presupuestoNoClienteId, empresaId) => {
  try {
    return await api.get(`/api/v1/caja-chica-obra/obra/${presupuestoNoClienteId}`, { empresaId });
  } catch (error) {
    console.error('Error obteniendo caja chica de obra:', error);
    throw error;
  }
};

/**
 * Obtener todas las asignaciones de caja chica de un profesional
 * GET /v1/caja-chica-obra/profesional/{profesionalId}
 * @param {number} profesionalId - ID del profesional
 * @param {number} empresaId - ID de la empresa
 * @returns {Promise} Lista de asignaciones del profesional
 */
export const obtenerCajaChicaPorProfesional = async (profesionalId, empresaId) => {
  try {
    return await api.get(`/api/v1/caja-chica-obra/profesional/${profesionalId}`, { empresaId });
  } catch (error) {
    console.error('Error obteniendo caja chica del profesional:', error);
    throw error;
  }
};

/**
 * Marcar una asignación como rendida
 * PATCH /v1/caja-chica-obra/{id}/rendir
 * @param {number} cajaChicaId - ID de la asignación
 * @param {number} empresaId - ID de la empresa
 * @returns {Promise} CajaChicaObra actualizado
 */
export const rendirCajaChica = async (cajaChicaId, empresaId) => {
  try {
    return await api.patch(`/api/v1/caja-chica-obra/${cajaChicaId}/rendir`, null, { empresaId });
  } catch (error) {
    console.error('Error rindiendo caja chica:', error);
    throw error;
  }
};

/**
 * Anular una asignación de caja chica
 * PATCH /v1/caja-chica-obra/{id}/anular
 * @param {number} cajaChicaId - ID de la asignación
 * @param {number} empresaId - ID de la empresa
 * @returns {Promise} CajaChicaObra anulado
 */
export const anularCajaChica = async (cajaChicaId, empresaId) => {
  try {
    return await api.patch(`/api/v1/caja-chica-obra/${cajaChicaId}/anular`, null, { empresaId });
  } catch (error) {
    console.error('Error anulando caja chica:', error);
    throw error;
  }
};

/**
 * Obtener color de semáforo según porcentaje de saldo
 * @param {number} saldoActual - Saldo disponible
 * @param {number} montoAsignado - Monto total asignado
 * @returns {string} Color del semáforo (success, warning, danger)
 */
export const obtenerColorSemaforo = (saldoActual, montoAsignado) => {
  if (!montoAsignado || montoAsignado === 0) return 'secondary';
  
  const porcentaje = (saldoActual / montoAsignado) * 100;
  
  if (porcentaje > 70) return 'success';  // Verde
  if (porcentaje >= 30) return 'warning'; // Amarillo
  return 'danger'; // Rojo
};

/**
 * Formatear monto como moneda argentina
 * @param {number} monto - Monto a formatear
 * @returns {string} Monto formateado (ej: "$ 50.000,00")
 */
export const formatearMoneda = (monto) => {
  if (!monto && monto !== 0) return '$ 0,00';
  
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(monto);
};

/**
 * FUNCIONES LEGACY - Mantener compatibilidad con componentes antiguos
 * TODO: Migrar RegistrarGastoModal y otros a usar los nuevos endpoints
 */

/**
 * @deprecated - Usar obtenerCajaChicaPorProfesional en su lugar
 * Consultar saldo de caja chica de un profesional (LEGACY)
 */
export const consultarSaldoCajaChica = async (profesionalObraId, empresaId) => {
  try {
    // Por ahora, obtener todas las asignaciones del profesional y calcular el saldo
    const asignaciones = await obtenerCajaChicaPorProfesional(profesionalObraId, empresaId);
    
    // Calcular saldo total (sumar todas las asignaciones activas)
    const saldoTotal = asignaciones
      .filter(a => a.estado === 'ACTIVO')
      .reduce((sum, a) => sum + (a.monto || 0), 0);
    
    return {
      saldoDisponible: saldoTotal,
      asignaciones: asignaciones
    };
  } catch (error) {
    console.error('Error consultando saldo caja chica:', error);
    throw error;
  }
};

/**
 * @deprecated - Usar asignarCajaChicaMultiple en su lugar
 * Asignar caja chica a un solo profesional (LEGACY)
 */
export const asignarCajaChica = async (profesionalObraId, monto, empresaId, presupuestoNoClienteId) => {
  try {
    // Convertir a formato múltiple
    const data = {
      presupuestoNoClienteId: presupuestoNoClienteId,
      profesionalesIds: [profesionalObraId],
      monto: monto,
      fecha: new Date().toISOString().split('T')[0],
      observaciones: 'Asignación individual (legacy)'
    };
    
    const result = await asignarCajaChicaMultiple(data, empresaId);
    return result[0]; // Retornar solo el primer elemento
  } catch (error) {
    console.error('Error asignando caja chica:', error);
    throw error;
  }
};

export default {
  asignarCajaChicaMultiple,
  obtenerCajaChicaPorObra,
  obtenerCajaChicaPorProfesional,
  rendirCajaChica,
  anularCajaChica,
  formatearMoneda,
  obtenerColorSemaforo,
  // Legacy
  consultarSaldoCajaChica,
  asignarCajaChica
};
