// Servicio para Pagos Consolidados (Gastos Generales, Materiales, Otros Costos)
import apiClient from './api';
import eventBus, { FINANCIAL_EVENTS } from '../utils/eventBus';

/**
 * Registrar pago consolidado (para items sin profesional asignado)
 * Como gastos generales, materiales comprados, otros costos, etc.
 */
export const registrarPagoConsolidado = async (pagoData, empresaId) => {
  try {
    console.log('📤 REGISTRAR PAGO CONSOLIDADO - Datos enviados:', {
      url: '/api/v1/pagos-consolidados',
      body: pagoData,
      empresaId: empresaId
    });
    
    // 🔧 IGUAL que pagosProfesionalObraService: dejar que el interceptor maneje empresaId
    console.log('🔍 [SERVICIO] Antes de llamar apiClient.post...');
    const response = await apiClient.post('/api/v1/pagos-consolidados', pagoData);
    console.log('✅ PAGO CONSOLIDADO REGISTRADO:', response);
    console.log('✅ Response completa:', JSON.stringify(response, null, 2));
    
    // 🔔 Emitir evento para sincronización automática
    eventBus.emit(FINANCIAL_EVENTS.PAGO_CONSOLIDADO_REGISTRADO, {
      pago: response.data || response,
      empresaId
    });
    
    return response.data || response;
  } catch (error) {
    console.error('❌ Error registrando pago consolidado:', {
      pagoData,
      empresaId,
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: error.message,
      data: error.response?.data,
      url: error.config?.url,
      method: error.config?.method,
      body: error.config?.data,
      headers: error.config?.headers,
      fullError: error
    });
    
    // Log adicional del error del servidor
    if (error.response?.data) {
      console.error('❌ [BACKEND ERROR]:', error.response.data);
    }
    
    throw error;
  }
};

/**
 * Registrar múltiples pagos consolidados en batch
 */
export const registrarPagosConsolidadosBatch = async (pagosData, empresaId) => {
  try {
    console.log('📤 REGISTRAR PAGOS BATCH - Datos enviados:', {
      url: '/api/v1/pagos-consolidados/batch',
      cantidad: pagosData.length,
      empresaId: empresaId
    });
    
    // 🔧 IGUAL que pagosProfesionalObraService: dejar que el interceptor maneje empresaId
    const response = await apiClient.post('/api/v1/pagos-consolidados/batch', pagosData);
    console.log('✅ PAGOS BATCH REGISTRADOS:', response);
    
    // 🔔 Emitir evento para sincronización automática
    eventBus.emit(FINANCIAL_EVENTS.PAGO_CONSOLIDADO_REGISTRADO, {
      pagos: response.data || response,
      empresaId,
      cantidad: pagosData.length
    });
    
    return response.data || response;
  } catch (error) {
    console.error('❌ Error registrando pagos consolidados en batch:');
    console.dir(error, { depth: null });
    
    // Usar console.table para propiedades del error
    console.table({
      'message': error.message,
      'name': error.name,
      'status': error.status,
      'hasResponse': !!error.response,
      'hasRequest': !!error.request,
      'hasData': !!error.data
    });
    
    // Si hay un objeto error.data, mostrarlo
    if (error.data) {
      console.error('📦 ERROR.DATA:', error.data);
      console.error('📦 ERROR.DATA (JSON):', JSON.stringify(error.data, null, 2));
    }
    
    // Si hay response
    if (error.response) {
      console.error('📡 ERROR.RESPONSE:', error.response);
      console.error('📡 ERROR.RESPONSE.DATA:', error.response.data);
    }
    
    console.error('📋 PAYLOAD:', JSON.stringify(pagosData.slice(0, 2), null, 2));
    
    throw error;
  }
};

/**
 * Listar TODOS los pagos consolidados de una empresa
 * GET /api/v1/pagos-consolidados?empresaId=1
 */
export const listarPagosConsolidadosPorEmpresa = async (empresaId) => {
  try {
    console.log('📋 Listando pagos consolidados de la empresa:', empresaId);
    
    // 🔧 IGUAL que pagosProfesionalObraService: dejar que el interceptor maneje empresaId
    const response = await apiClient.get('/api/v1/pagos-consolidados');
    
    const pagos = Array.isArray(response) ? response : 
           response?.data ? response.data : 
           response?.pagos ? response.pagos : [];
    
    console.log(`✅ ${pagos.length} pagos consolidados cargados desde el backend`);
    return pagos;
  } catch (error) {
    console.error('❌ Error listando pagos consolidados:', {
      empresaId,
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    return []; // Retornar array vacío en lugar de throw
  }
};

/**
 * Listar pagos consolidados por presupuesto
 */
export const listarPagosConsolidadosPorPresupuesto = async (presupuestoId, empresaId) => {
  try {
    const response = await apiClient.get(
      `/api/v1/pagos-consolidados/presupuesto/${presupuestoId}`,
      { 
        params: { empresaId } 
      }
    );
    return response;
  } catch (error) {
    console.error('❌ Error listando pagos consolidados:', {
      presupuestoId,
      empresaId,
      error: error.message
    });
    throw error;
  }
};

/**
 * Listar pagos de un item de calculadora
 */
export const listarPagosPorItem = async (itemId, empresaId) => {
  try {
    const response = await apiClient.get(
      `/api/v1/pagos-consolidados/item/${itemId}`,
      { 
        headers: { 'X-Tenant-ID': empresaId },
        params: { empresaId }
      }
    );
    return response;
  } catch (error) {
    console.error('❌ Error listando pagos del item:', {
      itemId,
      empresaId,
      error: error.message
    });
    throw error;
  }
};

/**
 * Obtener totales consolidados
 */
export const obtenerTotalesConsolidados = async (empresaId, presupuestoId = null, fechaDesde = null, fechaHasta = null) => {
  try {
    const params = { empresaId };
    if (presupuestoId) params.presupuestoId = presupuestoId;
    if (fechaDesde) params.fechaDesde = fechaDesde;
    if (fechaHasta) params.fechaHasta = fechaHasta;

    const response = await apiClient.get(
      '/api/v1/pagos-consolidados/totales',
      { 
        headers: { 'X-Tenant-ID': empresaId },
        params
      }
    );
    return response;
  } catch (error) {
    console.error('❌ Error obteniendo totales consolidados:', error.message);
    throw error;
  }
};

/**
 * Buscar pagos por dirección de obra
 */
export const buscarPagosPorDireccion = async (calle, altura, empresaId) => {
  try {
    const response = await apiClient.get(
      '/api/v1/pagos-consolidados/direccion',
      { 
        headers: { 'X-Tenant-ID': empresaId },
        params: { calle, altura, empresaId }
      }
    );
    return response;
  } catch (error) {
    console.error('❌ Error buscando pagos por dirección:', error.message);
    throw error;
  }
};

/**
 * Anular un pago
 */
export const anularPago = async (pagoId, empresaId) => {
  try {
    const response = await apiClient.put(
      `/api/v1/pagos-consolidados/${pagoId}/anular`,
      null,
      { 
        headers: { 'X-Tenant-ID': empresaId },
        params: { empresaId }
      }
    );
    
    eventBus.emit(FINANCIAL_EVENTS.PAGO_ACTUALIZADO, {
      pagoId,
      pago: response,
      empresaId
    });
    
    return response;
  } catch (error) {
    console.error('❌ Error anulando pago:', error.message);
    throw error;
  }
};

/**
 * Obtener pago consolidado por ID
 */
export const obtenerPagoConsolidado = async (pagoId, empresaId) => {
  try {
    const response = await apiClient.get(
      `/api/v1/pagos-consolidados/${pagoId}`,
      { 
        headers: { 'X-Tenant-ID': empresaId },
        params: { empresaId } 
      }
    );
    return response;
  } catch (error) {
    console.error('Error obteniendo pago consolidado:', error);
    throw error;
  }
};

/**
 * Actualizar pago consolidado
 */
export const actualizarPagoConsolidado = async (pagoId, pagoData, empresaId) => {
  try {
    const response = await apiClient.put(
      `/api/v1/pagos-consolidados/${pagoId}`,
      pagoData,
      { 
        headers: { 'X-Tenant-ID': empresaId },
        params: { empresaId } 
      }
    );
    
    eventBus.emit(FINANCIAL_EVENTS.PAGO_ACTUALIZADO, {
      pagoId,
      pago: response,
      empresaId
    });
    
    return response;
  } catch (error) {
    console.error('Error actualizando pago consolidado:', error);
    throw error;
  }
};

/**
 * Eliminar pago consolidado
 */
export const eliminarPagoConsolidado = async (pagoId, empresaId) => {
  try {
    const response = await apiClient.delete(
      `/api/v1/pagos-consolidados/${pagoId}`,
      { 
        headers: { 'X-Tenant-ID': empresaId },
        params: { empresaId } 
      }
    );
    
    eventBus.emit(FINANCIAL_EVENTS.PAGO_ELIMINADO, {
      pagoId,
      empresaId
    });
    
    return response;
  } catch (error) {
    console.error('Error eliminando pago consolidado:', error);
    throw error;
  }
};

export default {
  registrarPagoConsolidado,
  registrarPagosConsolidadosBatch,
  listarPagosConsolidadosPorEmpresa,
  listarPagosConsolidadosPorPresupuesto,
  listarPagosPorItem,
  obtenerPagoConsolidado,
  actualizarPagoConsolidado,
  eliminarPagoConsolidado,
  obtenerTotalesConsolidados,
  buscarPagosPorDireccion,
  anularPago
};
