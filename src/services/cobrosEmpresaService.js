import api from './api';
import eventBus, { FINANCIAL_EVENTS } from '../utils/eventBus';

/**
 * Servicio para gestión de cobros a nivel empresa
 * Permite registrar cobros sin asignarlos inmediatamente a obras
 * y luego asignarlos total o parcialmente
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

/**
 * Registrar nuevo cobro a nivel empresa (sin asignar a obras)
 */
export const registrarCobroEmpresa = async (cobroData, empresaId) => {
  const payload = {
    empresaId: empresaId,
    montoTotal: cobroData.montoTotal,
    descripcion: cobroData.descripcion,
    fechaCobro: cobroData.fechaCobro,
    metodoPago: cobroData.metodoPago,
    numeroComprobante: cobroData.numeroComprobante || null,
    tipoComprobante: cobroData.tipoComprobante || null,
    observaciones: cobroData.observaciones || null
  };

  try {
    console.log('🔵 [cobrosEmpresaService] Registrando cobro empresa:', JSON.stringify(payload, null, 2));
    
    const response = await api.post(`/api/v1/cobros-empresa?empresaId=${empresaId}`, payload);
    
    console.log('🟢 [cobrosEmpresaService] Cobro registrado:', response);
    
    // 🔔 Emitir evento para sincronización
    eventBus.emit(FINANCIAL_EVENTS.COBRO_REGISTRADO, {
      cobro: response,
      empresaId,
      esCobroEmpresa: true
    });
    
    return response;
  } catch (error) {
    console.error('❌ Error registrando cobro empresa:', error.response?.data?.message || error.message);
    console.error('❌ Payload:', payload);
    throw error;
  }
};

/**
 * Asignar cobro empresa a una o varias obras
 */
export const asignarCobroAObras = async (cobroEmpresaId, asignaciones, empresaId) => {
  const payload = {
    asignaciones: asignaciones.map(a => ({
      obraId: a.obraId,
      montoAsignado: a.montoAsignado,
      descripcion: a.descripcion || null,
      ...(a.distribucionItems && {
        distribucionItems: a.distribucionItems
      })
    }))
  };

  try {
    console.log('🔵 [cobrosEmpresaService] Asignando cobro a obras:', {
      cobroEmpresaId,
      empresaId,
      payload: JSON.stringify(payload, null, 2)
    });
    
    const response = await api.post(
      `/api/v1/cobros-empresa/${cobroEmpresaId}/asignar?empresaId=${empresaId}`,
      payload
    );
    
    console.log('🟢 [cobrosEmpresaService] Asignación exitosa:', response);
    
    // 🔔 Emitir evento por cada asignación
    asignaciones.forEach(a => {
      eventBus.emit(FINANCIAL_EVENTS.COBRO_REGISTRADO, {
        obraId: a.obraId,
        monto: a.montoAsignado,
        empresaId
      });
    });
    
    return response;
  } catch (error) {
    console.error('❌ Error asignando cobro a obras:', error.response?.data?.message || error.message);
    console.error('❌ Detalles completos del error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      headers: error.response?.headers
    });
    throw error;
  }
};

/**
 * Listar cobros de empresa
 */
export const listarCobrosEmpresa = async (empresaId, estado = null) => {
  try {
    const params = { empresaId };
    if (estado) params.estado = estado;
    
    const response = await api.get('/api/v1/cobros-empresa', { params });
    
    // Manejar respuesta envuelta o array directo
    const extractData = (resp) => {
      if (Array.isArray(resp)) return resp;
      if (resp?.data && Array.isArray(resp.data)) return resp.data;
      if (resp?.content && Array.isArray(resp.content)) return resp.content;
      return [];
    };
    
    return extractData(response);
  } catch (error) {
    console.error('❌ Error listando cobros empresa:', error);
    throw error;
  }
};

/**
 * Obtener saldo disponible total de la empresa
 */
export const obtenerSaldoDisponible = async (empresaId) => {
  try {
    const response = await api.get('/api/v1/cobros-empresa/saldo-disponible', {
      params: { empresaId }
    });
    
    return response;
  } catch (error) {
    console.error('❌ Error obteniendo saldo disponible:', error);
    throw error;
  }
};

/**
 * Obtener detalle de un cobro empresa con sus asignaciones
 */
export const obtenerDetalleCobroEmpresa = async (cobroEmpresaId, empresaId) => {
  try {
    const response = await api.get(`/api/v1/cobros-empresa/${cobroEmpresaId}`, {
      params: { empresaId }
    });
    
    return response;
  } catch (error) {
    console.error('❌ Error obteniendo detalle cobro empresa:', error);
    throw error;
  }
};

/**
 * Eliminar cobro empresa (solo si no tiene asignaciones)
 */
export const eliminarCobroEmpresa = async (cobroEmpresaId, empresaId) => {
  try {
    const response = await api.delete(`/api/v1/cobros-empresa/${cobroEmpresaId}`, {
      params: { empresaId }
    });
    
    // 🔔 Emitir evento
    eventBus.emit(FINANCIAL_EVENTS.COBRO_ELIMINADO, {
      cobroEmpresaId,
      empresaId
    });
    
    return response;
  } catch (error) {
    console.error('❌ Error eliminando cobro empresa:', error);
    throw error;
  }
};

/**
 * Anular cobro empresa
 */
export const anularCobroEmpresa = async (cobroEmpresaId, motivo, empresaId) => {
  try {
    const response = await api.patch(
      `/api/v1/cobros-empresa/${cobroEmpresaId}/anular?empresaId=${empresaId}`,
      { motivo }
    );
    
    return response;
  } catch (error) {
    console.error('❌ Error anulando cobro empresa:', error);
    throw error;
  }
};

/**
 * Obtener resumen financiero de cobros empresa
 */
export const obtenerResumenCobrosEmpresa = async (empresaId) => {
  try {
    const response = await api.get('/api/v1/cobros-empresa/resumen', {
      params: { empresaId }
    });
    
    return response;
  } catch (error) {
    console.error('❌ Error obteniendo resumen cobros empresa:', error);
    throw error;
  }
};

// ========== HELPERS ==========

/**
 * Calcula el estado visual del cobro empresa
 */
export const obtenerEstadoCobroEmpresa = (cobro) => {
  if (!cobro) return { label: 'Desconocido', color: 'secondary', icon: '❓' };
  
  const estado = cobro.estado?.toUpperCase();
  
  switch (estado) {
    case 'DISPONIBLE':
      return { label: 'Disponible', color: 'success', icon: '💰' };
    case 'ASIGNADO_PARCIAL':
      return { label: 'Parcial', color: 'warning', icon: '⚡' };
    case 'ASIGNADO_TOTAL':
      return { label: 'Asignado', color: 'info', icon: '✅' };
    case 'ANULADO':
      return { label: 'Anulado', color: 'danger', icon: '❌' };
    default:
      return { label: estado || 'Desconocido', color: 'secondary', icon: '❓' };
  }
};

/**
 * Obtener distribución consolidada de cobros por obra con items
 */
export const obtenerDistribucionPorObra = async (empresaId) => {
  try {
    const response = await api.get('/api/v1/cobros-empresa/distribucion-por-obra', {
      params: { empresaId }
    });
    
    return response;
  } catch (error) {
    console.error('❌ Error obteniendo distribución por obra:', error);
    throw error;
  }
};

/**
 * Eliminar una asignación específica de un cobro empresa
 */
export const eliminarAsignacionCobroEmpresa = async (cobroEmpresaId, asignacionId, empresaId) => {
  try {
    console.log(`🔵 [cobrosEmpresaService] Eliminando asignación ${asignacionId} del cobro ${cobroEmpresaId}`);
    
    const response = await api.delete(
      `/api/v1/cobros-empresa/${cobroEmpresaId}/asignaciones/${asignacionId}`,
      { params: { empresaId } }
    );
    
    console.log('🟢 [cobrosEmpresaService] Asignación eliminada exitosamente');
    
    // Emitir evento para refrescar las vistas
    eventBus.emit(FINANCIAL_EVENTS.COBRO_EMPRESA_UPDATED);
    
    return response;
  } catch (error) {
    console.error('❌ Error eliminando asignación:', error);
    throw error;
  }
};

export default {
  registrarCobroEmpresa,
  asignarCobroAObras,
  listarCobrosEmpresa,
  obtenerSaldoDisponible,
  obtenerDetalleCobroEmpresa,
  eliminarCobroEmpresa,
  anularCobroEmpresa,
  obtenerResumenCobrosEmpresa,
  obtenerDistribucionPorObra,
  eliminarAsignacionCobroEmpresa,
  formatearMoneda,
  formatearFecha,
  obtenerEstadoCobroEmpresa
};
