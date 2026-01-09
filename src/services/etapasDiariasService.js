// Servicio para gestión de etapas diarias (tareas con asignación de profesionales)
import apiClient from './api';

// ============================================
// ETAPAS DIARIAS - GESTIÓN DE TAREAS
// ============================================

/**
 * Obtener profesionales disponibles y tareas del día
 * @param {number} obraId - ID de la obra
 * @param {string} fecha - Fecha en formato YYYY-MM-DD
 * @param {number} empresaId - ID de la empresa
 * @returns {Promise} Response con profesionalesDisponibles y tareas
 */
export const obtenerEtapasDiarias = (obraId, fecha, empresaId) => 
  apiClient.get(`/api/etapas-diarias/${obraId}/${fecha}`, {
    headers: {
      'empresaId': empresaId.toString()
    }
  });

/**
 * Crear o actualizar tareas del día con asignación de profesionales
 * @param {Object} data - Datos de las tareas
 * @param {number} data.obraId - ID de la obra
 * @param {string} data.fecha - Fecha en formato YYYY-MM-DD
 * @param {Array} data.tareas - Array de tareas a crear
 * @param {number} empresaId - ID de la empresa
 * @returns {Promise} Response con resumen de creación
 */
export const crearEtapasDiarias = (data, empresaId) =>
  apiClient.post('/api/etapas-diarias', data, {
    headers: {
      'empresaId': empresaId.toString(),
      'Content-Type': 'application/json'
    }
  });

/**
 * Actualizar una tarea específica
 * @param {number} tareaId - ID de la tarea a actualizar
 * @param {Object} data - Datos parciales a actualizar
 * @param {number} empresaId - ID de la empresa
 * @returns {Promise} Response de actualización
 */
export const actualizarTarea = (tareaId, data, empresaId) =>
  apiClient.put(`/api/etapas-diarias/tarea/${tareaId}`, data, {
    headers: {
      'empresaId': empresaId.toString(),
      'Content-Type': 'application/json'
    }
  });

/**
 * Eliminar una tarea
 * @param {number} tareaId - ID de la tarea a eliminar
 * @param {number} empresaId - ID de la empresa
 * @returns {Promise} Response de eliminación
 */
export const eliminarTarea = (tareaId, empresaId) =>
  apiClient.delete(`/api/etapas-diarias/tarea/${tareaId}`, {
    headers: {
      'empresaId': empresaId.toString()
    }
  });

/**
 * Obtener histórico de tareas de una obra
 * @param {number} obraId - ID de la obra
 * @param {number} empresaId - ID de la empresa
 * @returns {Promise} Response con todas las tareas históricas
 */
export const obtenerHistoricoEtapas = (obraId, empresaId) =>
  apiClient.get(`/api/etapas-diarias/obra/${obraId}`, {
    headers: {
      'empresaId': empresaId.toString()
    }
  });
