import api from './api';
import eventBus, { FINANCIAL_EVENTS } from '../utils/eventBus';

/**
 * Servicio para gestión de pagos a profesionales de obra
 * Backend: 14 endpoints REST para pagos
 * Usa api.get, api.post, api.put, api.delete, api.patch
 * 
 * ✨ Con sincronización automática vía EventBus
 */

// ========== FORMATEO DE DATOS ==========

export const formatearMoneda = (valor) => {
  if (valor === null || valor === undefined || isNaN(valor)) return '$0.00';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS'
  }).format(valor);
};

export const formatearFecha = (fecha) => {
  if (!fecha) return '-';
  return new Date(fecha).toLocaleDateString('es-AR');
};

export const formatearPorcentaje = (valor) => {
  if (valor === null || valor === undefined || isNaN(valor)) return '0%';
  return `${Number(valor).toFixed(2)}%`;
};

// ========== CRUD BÁSICO ==========

export const registrarPago = async (pagoData, empresaId) => {
  try {
    console.log('📤 REGISTRAR PAGO - Datos enviados:', {
      url: '/api/v1/pagos-profesional-obra',
      body: pagoData,
      empresaId: empresaId
    });
    // El interceptor de axios agrega empresaId automáticamente al body Y params
    const response = await api.post('/api/v1/pagos-profesional-obra', pagoData);
    console.log('✅ PAGO REGISTRADO:', response);
    
    // 🔔 Emitir evento para sincronización automática
    console.log('📣 [SERVICIO] Emitiendo evento PAGO_REGISTRADO...');
    eventBus.emit(FINANCIAL_EVENTS.PAGO_REGISTRADO, {
      pago: response,
      profesionalId: pagoData.profesionalObraId,
      empresaId
    });
    console.log('📣✅ [SERVICIO] Evento PAGO_REGISTRADO emitido');
    
    return response;
  } catch (error) {
    console.error('❌ Error registrando pago:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url,
      method: error.config?.method,
      body: error.config?.data,
      fullError: error
    });
    throw error;
  }
};

export const obtenerPagoPorId = async (pagoId, empresaId) => {
  try {
    return await api.get(`/api/v1/pagos-profesional-obra/${pagoId}`, { empresaId });
  } catch (error) {
    console.error('Error obteniendo pago:', error);
    throw error;
  }
};

export const listarPagosPorProfesional = async (profesionalId, empresaId) => {
  try {
    return await api.get(`/api/v1/pagos-profesional-obra/profesional/${profesionalId}`, { empresaId });
  } catch (error) {
    console.error('❌ Error listando pagos del profesional:', {
      profesionalId,
      empresaId,
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: error.message,
      data: error.response?.data,
      error: error
    });
    throw error;
  }
};

// ✨ NUEVO: Listar pagos por profesionalObraId (asignacionId)
export const listarPagosPorProfesionalObra = async (profesionalObraId, empresaId) => {
  try {
    return await api.get(`/api/v1/pagos-profesional-obra/profesional-obra/${profesionalObraId}`, { empresaId });
  } catch (error) {
    console.error('❌ Error listando pagos del profesional-obra:', {
      profesionalObraId,
      empresaId,
      status: error.response?.status,
      message: error.message,
      error: error
    });
    throw error;
  }
};

export const listarTodosPagosEmpresa = async (empresaId) => {
  try {
    console.log('📋 Listando todos los pagos de la empresa:', empresaId);
    const response = await api.get('/api/v1/pagos-profesional-obra', { 
      params: { empresaId } 
    });
    
    const pagos = Array.isArray(response) ? response : 
           response?.data ? response.data : 
           response?.pagos ? response.pagos : [];
    
    console.log(`✅ ${pagos.length} pagos cargados desde el backend`);
    return pagos;
  } catch (error) {
    console.error('❌ Error listando todos los pagos:', error);
    return []; // Retornar array vacío en lugar de throw para no romper el flujo
  }
};

export const actualizarPago = async (pagoId, pagoData, empresaId) => {
  try {
    const response = await api.put(`/api/v1/pagos-profesional-obra/${pagoId}`, pagoData, { empresaId });
    
    // 🔔 Emitir evento para sincronización automática
    eventBus.emit(FINANCIAL_EVENTS.PAGO_ACTUALIZADO, {
      pagoId,
      pago: response,
      empresaId
    });
    
    return response;
  } catch (error) {
    console.error('Error actualizando pago:', error);
    throw error;
  }
};

export const eliminarPago = async (pagoId, empresaId) => {
  try {
    const response = await api.delete(`/api/v1/pagos-profesional-obra/${pagoId}`, { empresaId });
    
    // 🔔 Emitir evento para sincronización automática
    eventBus.emit(FINANCIAL_EVENTS.PAGO_ELIMINADO, {
      pagoId,
      empresaId
    });
    
    return response;
  } catch (error) {
    console.error('Error eliminando pago:', error);
    throw error;
  }
};

// ========== ACCIONES DE ESTADO ==========

export const marcarComoPagado = async (pagoId, fechaPago, empresaId) => {
  try {
    const fechaPagoFinal = fechaPago || new Date().toISOString().split('T')[0];
    const response = await api.patch(
      `/api/v1/pagos-profesional-obra/${pagoId}/marcar-pagado?empresaId=${empresaId}&fechaPago=${fechaPagoFinal}`,
      {}
    );
    
    // 🔔 Emitir evento para sincronización automática
    eventBus.emit(FINANCIAL_EVENTS.PAGO_ACTUALIZADO, {
      pagoId,
      accion: 'marcar_pagado',
      empresaId
    });
    
    return response;
  } catch (error) {
    console.error('Error marcando pago como pagado:', error);
    throw error;
  }
};

export const anularPago = async (pagoId, motivo, empresaId) => {
  try {
    const motivoFinal = motivo || 'Anulado por el usuario';
    return await api.patch(
      `/api/v1/pagos-profesional-obra/${pagoId}/anular?empresaId=${empresaId}&motivo=${encodeURIComponent(motivoFinal)}`,
      {}
    );
  } catch (error) {
    console.error('Error anulando pago:', error);
    throw error;
  }
};

// ========== CONSULTAS ESPECIALES ==========

export const obtenerAdelantos = async (profesionalId, empresaId) => {
  try {
    return await api.get(`/api/v1/pagos-profesional-obra/profesional/${profesionalId}/adelantos`, { empresaId });
  } catch (error) {
    console.error('Error obteniendo adelantos:', error);
    throw error;
  }
};

export const obtenerAdelantosPendientes = async (profesionalId, empresaId) => {
  try {
    return await api.get(`/api/v1/pagos-profesional-obra/profesional/${profesionalId}/adelantos-pendientes`, { empresaId });
  } catch (error) {
    console.error('Error obteniendo adelantos pendientes:', error);
    throw error;
  }
};

export const obtenerTotalPagado = async (profesionalId, empresaId) => {
  try {
    return await api.get(`/api/v1/pagos-profesional-obra/profesional/${profesionalId}/total-pagado`, { empresaId });
  } catch (error) {
    console.error('Error obteniendo total pagado:', error);
    throw error;
  }
};

export const obtenerPromedioPresentismo = async (profesionalId, empresaId) => {
  try {
    return await api.get(`/api/v1/pagos-profesional-obra/profesional/${profesionalId}/promedio-presentismo`, { empresaId });
  } catch (error) {
    console.error('Error obteniendo promedio presentismo:', error);
    throw error;
  }
};

export const obtenerPagosPendientes = async (profesionalId, empresaId) => {
  try {
    return await api.get(`/api/v1/pagos-profesional-obra/profesional/${profesionalId}/pendientes`, { empresaId });
  } catch (error) {
    console.error('Error obteniendo pagos pendientes:', error);
    throw error;
  }
};

export const obtenerPagosPorRangoFechas = async (fechaDesde, fechaHasta, empresaId) => {
  try {
    return await api.get('/api/v1/pagos-profesional-obra/fecha-rango', { 
      empresaId,
      fechaDesde,
      fechaHasta
    });
  } catch (error) {
    console.error('Error obteniendo pagos por rango de fechas:', error);
    throw error;
  }
};

export const listarPagosPorTipo = async (tipoPago, empresaId) => {
  try {
    return await api.get(`/api/v1/pagos-profesional-obra/tipo/${tipoPago}`, { empresaId });
  } catch (error) {
    console.error('Error obteniendo pagos por tipo:', error);
    throw error;
  }
};

export const listarPagosPorObra = async (direccionObraId, empresaId) => {
  try {
    console.log(`🔍 [Servicio] Buscando pagos para direccionObraId: ${direccionObraId}`);
    const response = await api.get('/api/v1/pagos-profesional-obra', { 
      params: { empresaId }
    });
    
    // Filtrar pagos que pertenezcan a profesionales de esta obra
    const todosPagos = Array.isArray(response) ? response : response?.data || [];
    console.log(`📦 [Servicio] Total pagos en empresa: ${todosPagos.length}`);
    
    // Los pagos tienen profesionalObraId, necesitamos buscar en el presupuesto
    // Por ahora devolvemos todos y filtraremos en el contexto
    return todosPagos;
  } catch (error) {
    console.error('❌ Error listando pagos por obra:', error);
    return [];
  }
};

// ========== HELPERS ==========

/**
 * Calcula el estado visual del pago
 */
export const obtenerEstadoPago = (pago) => {
  if (!pago) return { label: 'Desconocido', color: 'secondary', icon: '❓' };
  
  const estado = pago.estado?.toUpperCase();
  
  switch (estado) {
    case 'PENDIENTE':
      return { label: 'Pendiente', color: 'warning', icon: '⏳' };
    case 'PAGADO':
      return { label: 'Pagado', color: 'success', icon: '✅' };
    case 'ANULADO':
      return { label: 'Anulado', color: 'secondary', icon: '❌' };
    default:
      return { label: estado || 'Desconocido', color: 'secondary', icon: '❓' };
  }
};

/**
 * Calcula el tipo visual del pago
 */
export const obtenerTipoPago = (pago) => {
  if (!pago) return { label: 'Desconocido', color: 'secondary', icon: '❓' };
  
  const tipo = pago.tipoPago?.toUpperCase();
  
  switch (tipo) {
    case 'SEMANAL':
    case 'PAGO_SEMANAL':
      return { label: 'Pago Semanal', color: 'primary', icon: '📅' };
    case 'ADELANTO':
      return { label: 'Adelanto', color: 'info', icon: '💰' };
    case 'FINAL':
    case 'PAGO_FINAL':
      return { label: 'Pago Final', color: 'success', icon: '🏁' };
    case 'AJUSTE':
      return { label: 'Ajuste', color: 'warning', icon: '⚖️' };
    case 'PAGO_PARCIAL':
      return { label: 'Pago Parcial', color: 'warning', icon: '💳' };
    case 'MATERIALES':
      return { label: 'Material', color: 'success', icon: '🧱' };
    case 'GASTOS_GENERALES':
    case 'OTROS_COSTOS':
      return { label: 'Gasto General', color: 'warning', icon: '💵' };
    case 'TRABAJOS_EXTRA':
    case 'PAGO_GENERAL':
      return { label: 'Trabajo Extra', color: 'info', icon: '🔧' };
    default:
      return { label: tipo || 'Desconocido', color: 'secondary', icon: '❓' };
  }
};

/**
 * Calcula el neto a pagar considerando descuentos por adelantos y presentismo
 */
export const calcularNetoPagar = (pago) => {
  if (!pago) return 0;
  
  const montoBase = Number(pago.montoBruto || 0);
  const descuentoAdelantos = Number(pago.descuentoAdelantos || 0);
  const descuentoPresentismo = Number(pago.descuentoPresentismo || 0);
  
  return montoBase - descuentoAdelantos - descuentoPresentismo;
};

export default {
  registrarPago,
  obtenerPagoPorId,
  listarPagosPorProfesional,
  listarTodosPagosEmpresa,
  actualizarPago,
  eliminarPago,
  marcarComoPagado,
  anularPago,
  obtenerAdelantos,
  obtenerAdelantosPendientes,
  obtenerTotalPagado,
  obtenerPromedioPresentismo,
  obtenerPagosPendientes,
  obtenerPagosPorRangoFechas,
  listarPagosPorTipo,
  formatearMoneda,
  formatearFecha,
  formatearPorcentaje,
  obtenerEstadoPago,
  obtenerTipoPago,
  calcularNetoPagar
};
