import api from './api';
import eventBus, { FINANCIAL_EVENTS } from '../utils/eventBus';

/**
 * Servicio para gestión de cobros de obra
 * Backend: 13 endpoints REST para cobros
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

// ========== CRUD BÁSICO ==========

export const registrarCobro = async (cobroData, empresaId) => {
  const payload = {
    ...cobroData,
    empresaId: empresaId
  };

  try {
    console.log('🔵 [cobrosObraService] Payload a enviar:', JSON.stringify(payload, null, 2));

    // CRÍTICO: Pasar empresaId como query param Y en el body para máxima compatibilidad
    const response = await api.post(`/api/v1/cobros-obra?empresaId=${empresaId}`, payload);

    console.log('🟢 [cobrosObraService] Respuesta del backend:', JSON.stringify(response, null, 2));

    // 🔔 Emitir evento para sincronización automática
    eventBus.emit(FINANCIAL_EVENTS.COBRO_REGISTRADO, {
      cobro: response,
      empresaId
    });

    return response;
  } catch (error) {
    console.error('❌ Error registrando cobro:', error.response?.data?.message || error.message);
    console.error('❌ Status code:', error.response?.status);
    console.error('❌ Detalles completos del error:', JSON.stringify(error.response?.data, null, 2));
    console.error('❌ Payload que causó el error:', JSON.stringify(payload, null, 2));
    throw error;
  }
};

export const obtenerCobroPorId = async (cobroId, empresaId) => {
  try {
    return await api.get(`/api/v1/cobros-obra/${cobroId}`, { empresaId });
  } catch (error) {
    console.error('Error obteniendo cobro:', error);
    throw error;
  }
};

/**
 * Listar cobros por dirección de obra (6 campos + presupuestoNoClienteId)
 * GET /cobros-obra/direccion?presupuestoNoClienteId=X&calle=Y&altura=Z&empresaId=1
 */
export const listarCobrosPorObra = async (direccion, empresaId) => {
  // Construir params fuera del try para que esté disponible en el catch
  const params = {
    presupuestoNoClienteId: direccion.presupuestoNoClienteId,
    calle: direccion.calle,
    altura: direccion.altura,
    empresaId: empresaId
  };

  // Solo agregar campos opcionales si tienen valor
  if (direccion.barrio) params.barrio = direccion.barrio;
  if (direccion.torre) params.torre = direccion.torre;
  if (direccion.piso) params.piso = direccion.piso;
  if (direccion.depto) params.depto = direccion.depto;

  try {
    if (!params.presupuestoNoClienteId) {
      console.error('❌ FALTA presupuestoNoClienteId en params!');
    }

    // api.get espera (endpoint, params), NO (endpoint, { params })
    return await api.get('/api/v1/cobros-obra/direccion', params);
  } catch (error) {
    console.error('❌ Error listando cobros de obra:', {
      params,
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: error.message,
      data: error.response?.data,
      error: error
    });
    throw error;
  }
};

export const actualizarCobro = async (cobroId, cobroData, empresaId) => {
  try {
    const response = await api.put(`/api/v1/cobros-obra/${cobroId}`, cobroData, { empresaId });

    // 🔔 Emitir evento para sincronización automática
    eventBus.emit(FINANCIAL_EVENTS.COBRO_ACTUALIZADO, {
      cobroId,
      cobro: response,
      empresaId
    });

    return response;
  } catch (error) {
    console.error('Error actualizando cobro:', error);
    throw error;
  }
};

export const eliminarCobro = async (cobroId, empresaId) => {
  try {
    const response = await api.delete(`/api/v1/cobros-obra/${cobroId}`, { empresaId });

    // 🔔 Emitir evento para sincronización automática
    eventBus.emit(FINANCIAL_EVENTS.COBRO_ELIMINADO, {
      cobroId,
      empresaId
    });

    return response;
  } catch (error) {
    console.error('Error eliminando cobro:', error);
    throw error;
  }
};

// ========== ACCIONES DE ESTADO ==========

export const marcarComoCobrado = async (cobroId, fechaCobro, empresaId) => {
  try {
    const fechaCobroFinal = fechaCobro || new Date().toISOString().split('T')[0];
    return await api.patch(
      `/api/v1/cobros-obra/${cobroId}/marcar-cobrado?empresaId=${empresaId}&fechaCobro=${fechaCobroFinal}`,
      {}
    );
  } catch (error) {
    console.error('Error marcando cobro como cobrado:', error);
    throw error;
  }
};

export const marcarComoVencido = async (cobroId, empresaId) => {
  try {
    return await api.patch(`/api/v1/cobros-obra/${cobroId}/marcar-vencido?empresaId=${empresaId}`, {});
  } catch (error) {
    console.error('Error marcando cobro como vencido:', error);
    throw error;
  }
};

export const anularCobro = async (cobroId, motivo, empresaId) => {
  try {
    const motivoFinal = motivo || 'Anulado por el usuario';
    return await api.patch(
      `/api/v1/cobros-obra/${cobroId}/anular?empresaId=${empresaId}&motivo=${encodeURIComponent(motivoFinal)}`,
      {}
    );
  } catch (error) {
    console.error('Error anulando cobro:', error);
    throw error;
  }
};

// ========== CONSULTAS ESPECIALES ==========

/**
 * Obtener cobros pendientes por dirección
 */
export const obtenerCobrosPendientes = async (direccion, empresaId) => {
  try {
    const params = {
      presupuestoNoClienteId: direccion.presupuestoNoClienteId,
      calle: direccion.calle,
      altura: direccion.altura
    };

    if (direccion.barrio) params.barrio = direccion.barrio;
    if (direccion.torre) params.torre = direccion.torre;
    if (direccion.piso) params.piso = direccion.piso;
    if (direccion.depto) params.depto = direccion.depto;

    return await api.get('/api/v1/cobros-obra/direccion/pendientes', { params });
  } catch (error) {
    console.error('Error obteniendo cobros pendientes:', error);
    throw error;
  }
};

/**
 * Obtener total cobrado por dirección
 */
export const obtenerTotalCobrado = async (direccion, empresaId) => {
  try {
    const params = {
      presupuestoNoClienteId: direccion.presupuestoNoClienteId,
      calle: direccion.calle,
      altura: direccion.altura,
      empresaId: empresaId // Agregar empresaId explícitamente
    };

    if (direccion.barrio) params.barrio = direccion.barrio;
    if (direccion.torre) params.torre = direccion.torre;
    if (direccion.piso) params.piso = direccion.piso;
    if (direccion.depto) params.depto = direccion.depto;

    console.log('📤 [obtenerTotalCobrado] Llamando al endpoint con params:', params);

    // ⚠️ IMPORTANTE: El backend retorna directamente el número (BigDecimal)
    const response = await api.get('/api/v1/cobros-obra/direccion/total-cobrado', { params });

    console.log('📥 [obtenerTotalCobrado] Respuesta del backend:', response);

    return response;
  } catch (error) {
    console.error('❌ Error obteniendo total cobrado:', error);
    console.error('Detalles:', error.response?.data);
    throw error;
  }
};

/**
 * Obtener total pendiente por dirección
 */
export const obtenerTotalPendiente = async (direccion, empresaId) => {
  try {
    const params = {
      presupuestoNoClienteId: direccion.presupuestoNoClienteId,
      calle: direccion.calle,
      altura: direccion.altura
    };

    if (direccion.barrio) params.barrio = direccion.barrio;
    if (direccion.torre) params.torre = direccion.torre;
    if (direccion.piso) params.piso = direccion.piso;
    if (direccion.depto) params.depto = direccion.depto;

    return await api.get('/api/v1/cobros-obra/direccion/total-pendiente', { params });
  } catch (error) {
    console.error('Error obteniendo total pendiente:', error);
    throw error;
  }
};

export const obtenerCobrosVencidos = async (empresaId) => {
  try {
    return await api.get('/api/v1/cobros-obra/vencidos', { empresaId });
  } catch (error) {
    console.error('Error obteniendo cobros vencidos:', error);
    throw error;
  }
};

export const obtenerCobrosPorRangoFechas = async (fechaDesde, fechaHasta, empresaId) => {
  try {
    return await api.get('/api/v1/cobros-obra/fechas', {
      empresaId,
      fechaDesde,
      fechaHasta
    });
  } catch (error) {
    console.error('Error obteniendo cobros por rango de fechas:', error);
    throw error;
  }
};

// ========== HELPERS ==========

/**
 * Calcula el estado visual del cobro
 */
export const obtenerEstadoCobro = (cobro) => {
  if (!cobro) return { label: 'Desconocido', color: 'secondary', icon: '❓' };

  const estado = cobro.estado?.toUpperCase();

  switch (estado) {
    case 'PENDIENTE':
      return { label: 'Pendiente', color: 'warning', icon: '⏳' };
    case 'COBRADO':
      return { label: 'Cobrado', color: 'success', icon: '✅' };
    case 'VENCIDO':
      return { label: 'Vencido', color: 'danger', icon: '⚠️' };
    case 'ANULADO':
      return { label: 'Anulado', color: 'secondary', icon: '❌' };
    default:
      return { label: estado || 'Desconocido', color: 'secondary', icon: '❓' };
  }
};

/**
 * Verifica si un cobro está vencido
 */
export const estaVencido = (cobro) => {
  if (!cobro || !cobro.fechaVencimiento) return false;
  const hoy = new Date();
  const vencimiento = new Date(cobro.fechaVencimiento);
  return vencimiento < hoy && cobro.estado?.toUpperCase() === 'PENDIENTE';
};

export default {
  registrarCobro,
  obtenerCobroPorId,
  listarCobrosPorObra,
  actualizarCobro,
  eliminarCobro,
  marcarComoCobrado,
  marcarComoVencido,
  anularCobro,
  obtenerCobrosPendientes,
  obtenerTotalCobrado,
  obtenerTotalPendiente,
  obtenerCobrosVencidos,
  obtenerCobrosPorRangoFechas,
  formatearMoneda,
  formatearFecha,
  obtenerEstadoCobro,
  estaVencido
};

