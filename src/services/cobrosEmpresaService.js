import api from './api';
import { getCurrentEmpresaId } from './api';
import eventBus, { FINANCIAL_EVENTS } from '../utils/eventBus';

// Resuelve el empresaId del tenant activo (fallback al contexto global si no se pasa)
const _eid = (empresaId) => Number(empresaId) || getCurrentEmpresaId();

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
export const registrarCobroEmpresa = async (cobroData, empresaIdParam) => {
  const empresaId = _eid(empresaIdParam);
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
export const asignarCobroAObras = async (cobroEmpresaId, asignaciones, empresaIdParam) => {
  const empresaId = _eid(empresaIdParam);
  const payload = {
    asignaciones: asignaciones.map(a => {
      const asignacion = {
        montoAsignado: a.montoAsignado,
        descripcion: a.descripcion || null
      };

      // Incluir IDs según el tipo de entidad
      if (a.obraId) asignacion.obraId = a.obraId;
      if (a.presupuestoId) asignacion.presupuestoId = a.presupuestoId;
      if (a.trabajoAdicionalId) asignacion.trabajoAdicionalId = a.trabajoAdicionalId;
      if (a.trabajoExtraId) asignacion.trabajoExtraId = a.trabajoExtraId;
      if (a.obraIndependienteId) asignacion.obraIndependienteId = a.obraIndependienteId;

      // Incluir distribución por ítems si existe
      if (a.distribucionItems) {
        asignacion.distribucionItems = a.distribucionItems;
      }

      return asignacion;
    })
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
      const evento = {
        monto: a.montoAsignado,
        empresaId
      };

      // Incluir el ID correspondiente en el evento
      if (a.obraId) evento.obraId = a.obraId;
      if (a.presupuestoId) evento.presupuestoId = a.presupuestoId;
      if (a.trabajoAdicionalId) evento.trabajoAdicionalId = a.trabajoAdicionalId;
      if (a.trabajoExtraId) evento.trabajoExtraId = a.trabajoExtraId;
      if (a.obraIndependienteId) evento.obraIndependienteId = a.obraIndependienteId;

      eventBus.emit(FINANCIAL_EVENTS.COBRO_REGISTRADO, evento);
    });

    return response;
  } catch (error) {
    const errData = error.response?.data;
    console.error('❌ [asignarCobroAObras] HTTP', error.response?.status, error.response?.statusText);
    console.error('❌ [asignarCobroAObras] URL:', `/api/v1/cobros-empresa/${cobroEmpresaId}/asignar?empresaId=${empresaId}`);
    console.error('❌ [asignarCobroAObras] Payload enviado:', JSON.stringify(payload, null, 2));
    console.error('❌ [asignarCobroAObras] Respuesta body completa:', JSON.stringify(errData, null, 2));
    // Spring Boot error fields
    if (errData) {
      console.error('❌ [Spring Boot] message  :', errData.message);
      console.error('❌ [Spring Boot] error    :', errData.error);
      console.error('❌ [Spring Boot] exception:', errData.exception);
      console.error('❌ [Spring Boot] trace    :', errData.trace);
      console.error('❌ [Spring Boot] path     :', errData.path);
      console.error('❌ [Spring Boot] status   :', errData.status);
    }
    throw error;
  }
};

/**
 * Listar cobros de empresa
 */
export const listarCobrosEmpresa = async (empresaIdParam, estado = null) => {
  const empresaId = _eid(empresaIdParam);
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
export const obtenerSaldoDisponible = async (empresaIdParam) => {
  const empresaId = _eid(empresaIdParam);
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
export const obtenerDetalleCobroEmpresa = async (cobroEmpresaId, empresaIdParam) => {
  const empresaId = _eid(empresaIdParam);
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
export const eliminarCobroEmpresa = async (cobroEmpresaId, empresaIdParam) => {
  const empresaId = _eid(empresaIdParam);
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
export const anularCobroEmpresa = async (cobroEmpresaId, motivo, empresaIdParam) => {
  const empresaId = _eid(empresaIdParam);
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
export const obtenerResumenCobrosEmpresa = async (empresaIdParam) => {
  const empresaId = _eid(empresaIdParam);
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
export const obtenerDistribucionPorObra = async (empresaIdParam) => {
  const empresaId = _eid(empresaIdParam);
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
export const eliminarAsignacionCobroEmpresa = async (cobroEmpresaId, asignacionId, empresaIdParam) => {
  const empresaId = _eid(empresaIdParam);
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
