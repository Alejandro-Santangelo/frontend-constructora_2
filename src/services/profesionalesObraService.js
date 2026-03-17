// Servicio para endpoints de profesionales-obras
import apiClient from './api';
import eventBus, { FINANCIAL_EVENTS } from '../utils/eventBus';

// Asignar profesionales semanalmente a una obra (nuevo endpoint)
export const asignarProfesionalesSemanal = (data) => apiClient.post('/api/profesionales/asignar-semanal', data);

// Listar todas las asignaciones
export const listarAsignaciones = (empresaId) => {
  const params = empresaId ? { empresaId } : {};
  return apiClient.get('/api/profesionales-obras', { params });
};

// Asignar profesional a obra
export const asignarProfesional = (data) => apiClient.post('/api/profesionales-obras/asignar', data);

// Asignar múltiples profesionales a una obra
export const asignarMultiplesProfesionales = (data) => apiClient.post('/api/profesionales-obras/asignar-multiples', data);

// Consultar asignaciones por especialidad
export const obtenerAsignacionesPorTipo = (tipoProfesional, empresaId) =>
  apiClient.get(`/api/profesionales-obras/tipo/${encodeURIComponent(tipoProfesional)}`, { params: { empresaId } });

// Consultar disponibilidad por tipo de profesional
export const consultarDisponibilidadPorTipo = (tipoProfesional, empresaId) =>
  apiClient.get(`/api/profesionales-obras/disponibilidad/${encodeURIComponent(tipoProfesional)}`, { params: { empresaId } });

// Listar profesionales por tipo
export const listarProfesionalesPorTipo = (tipoProfesional, empresaId) =>
  apiClient.get(`/api/profesionales-obras/profesionales/tipo/${encodeURIComponent(tipoProfesional)}`, { params: { empresaId } });

// Listar profesionales asignados a una obra de una empresa
export const obtenerProfesionalesPorObraYEmpresa = (empresaId, obraId) =>
  apiClient.get('/api/profesionales-obras/profesionales-por-obra', { params: { empresaId, obraId } });

// Actualizar asignación existente
export const actualizarAsignacion = (asignacionId, data, empresaId) =>
  apiClient.put(`/api/profesionales-obras/${asignacionId}`, data, { params: { empresaId } });

// Desactivar asignación
export const desactivarAsignacion = (asignacionId, empresaId) =>
  apiClient.delete(`/api/profesionales-obras/${asignacionId}`, { params: { empresaId } });

// DEBUG: Ver todos los tipos de profesionales
export const debugTiposProfesionales = () => apiClient.get('/api/profesionales-obras/debug/tipos-profesionales');

// ============================================
// ASIGNACIÓN SEMANAL DE PROFESIONALES
// ============================================

// Crear asignación semanal
export const crearAsignacionSemanal = async (data, empresaId) => {
  console.log('🌐 ================ LLAMADA A BACKEND ================');
  console.log('📍 Endpoint: POST /api/profesionales/asignar-semanal');
  console.log('🏢 EmpresaId (header):', empresaId);
  console.log('📦 Payload completo:');
  console.log(JSON.stringify(data, null, 2));
  console.log('====================================================');

  try {
    const response = await apiClient.post('/api/profesionales/asignar-semanal', data, {
      headers: {
        'empresaId': empresaId.toString()
      }
    });

    console.log('✅ Respuesta exitosa del backend:', response.status);

    // Emitir evento para actualizar profesionales en otros componentes
    console.log('📡 [Service] Emitiendo evento PROFESIONAL_ASIGNADO');
    eventBus.emit(FINANCIAL_EVENTS.PROFESIONAL_ASIGNADO, {
      obraId: data.obraId,
      empresaId,
      timestamp: new Date().toISOString()
    });

    return response;
  } catch (error) {
    console.error('❌ Error en crearAsignacionSemanal:');
    console.error('   Status:', error.response?.status);
    console.error('   StatusText:', error.response?.statusText);
    console.error('   Data:', error.response?.data);
    console.error('   Message:', error.message);

    // Re-lanzar el error con información adicional
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    } else if (error.response?.data) {
      throw new Error(typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data));
    } else {
      throw error;
    }
  }
};

// Obtener asignaciones de una obra
export const obtenerAsignacionesSemanalPorObra = (obraId, empresaId) => {
  console.log('🔍 [Service] Obteniendo asignaciones para obra:', obraId, 'empresaId pasado:', empresaId);

  // Agregar empresaId en headers explícitamente como requiere el backend
  return apiClient.get(`/api/profesionales/asignaciones/${obraId}`, {
    headers: {
      'empresaId': empresaId.toString()
    }
  });
};

// Actualizar asignación semanal existente
export const actualizarAsignacionSemanal = (asignacionId, data, empresaId) => {
  console.log('🔍 [Service] Actualizando asignación:', asignacionId, 'empresaId:', empresaId);
  return apiClient.put(`/api/profesionales/asignar-semanal/${asignacionId}`, data, {
    headers: {
      'empresaId': empresaId.toString()
    }
  });
};

// Eliminar asignación semanal
export const eliminarAsignacionSemanal = async (asignacionId, empresaId) => {
  console.log('🔍 [Service] Eliminando asignación:', asignacionId, 'empresaId:', empresaId);
  try {
    const response = await apiClient.delete(`/api/profesionales/asignar-semanal/${asignacionId}`, {
      headers: {
        'empresaId': empresaId.toString()
      }
    });
    console.log('✅ [Service] Asignación eliminada exitosamente:', asignacionId);

    // Emitir evento para actualizar profesionales en otros componentes
    console.log('📡 [Service] Emitiendo evento PROFESIONAL_DESASIGNADO');
    eventBus.emit(FINANCIAL_EVENTS.PROFESIONAL_DESASIGNADO, {
      asignacionId,
      empresaId,
      timestamp: new Date().toISOString()
    });

    return response;
  } catch (error) {
    console.error('❌ [Service] Error eliminando asignación:', {
      asignacionId,
      empresaId,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
};

// Eliminar múltiples asignaciones (por obra completa)
export const eliminarAsignacionesPorObra = async (obraId, empresaId) => {
  console.log('🔍 [Service] Eliminando asignaciones por asignación individual (fallback seguro)...');
  // Nota: El endpoint de borrado masivo /api/profesionales/asignaciones/obra/{id} devuelve 404/500 en este entorno.
  // Por lo tanto, simulamos éxito para forzar al frontend a usar el fallback de borrado 1x1
  // que ya está implementado en AsignarProfesionalSemanalModal.jsx
  throw new Error("Endpoint Disable: Use Fallback");
};

// ============================================
// PROFESIONALES CONSOLIDADOS (PAGO CONSOLIDADO)
// ============================================

/**
 * Obtener profesionales consolidados de todas las obras activas
 * Incluye profesionales de: asignaciones_profesional_obra, presupuestos detallados, configuración de obra
 * Filtros: APROBADO, EN_EJECUCION, TERMINADO (solo TAREA_LEVE)
 */
export const obtenerProfesionalesConsolidados = async (empresaId) => {
  console.log('🔍 [Service] Obteniendo profesionales consolidados para empresaId:', empresaId);
  try {
    const response = await apiClient.get('/api/profesionales-obras/profesionales-consolidados', {
      params: { empresaId }
    });
    console.log('✅ [Service] Profesionales consolidados obtenidos:', response.data);
    return response;
  } catch (error) {
    console.error('❌ [Service] Error obteniendo profesionales consolidados:', {
      empresaId,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
};
