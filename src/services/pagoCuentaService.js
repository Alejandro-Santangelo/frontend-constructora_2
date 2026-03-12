import api from './api';

/**
 * Servicio para gestión de pagos a cuenta sobre items de rubros
 */

const API_BASE_URL = '/api/pagos-cuenta';

/**
 * Crear un pago a cuenta sobre un item de rubro
 */
export const crearPagoCuenta = async (pagoData) => {
  try {
    const response = await api.post(API_BASE_URL, pagoData);
    return response.data;
  } catch (error) {
    console.error('Error creando pago a cuenta:', error);
    throw error;
  }
};

/**
 * Obtener un pago por ID
 */
export const obtenerPagoPorId = async (id, empresaId) => {
  try {
    const response = await api.get(`${API_BASE_URL}/${id}`, {
      params: { empresaId }
    });
    return response.data;
  } catch (error) {
    console.error('Error obteniendo pago:', error);
    throw error;
  }
};

/**
 * Listar pagos de un presupuesto
 */
export const listarPagosPorPresupuesto = async (presupuestoId, empresaId) => {
  try {
    const response = await api.get(API_BASE_URL, {
      params: { presupuestoId, empresaId }
    });
    return response.data;
  } catch (error) {
    console.error('Error listando pagos del presupuesto:', error);
    throw error;
  }
};

/**
 * Listar pagos de un rubro específico
 */
export const listarPagosPorRubro = async (presupuestoId, empresaId, nombreRubro) => {
  try {
    const response = await api.get(`${API_BASE_URL}/rubro`, {
      params: { presupuestoId, empresaId, nombreRubro }
    });
    return response.data;
  } catch (error) {
    console.error('Error listando pagos del rubro:', error);
    throw error;
  }
};

/**
 * Listar pagos de un item específico (rubro + tipo)
 */
export const listarPagosPorItem = async (presupuestoId, empresaId, nombreRubro, tipoItem) => {
  try {
    const response = await api.get(`${API_BASE_URL}/item`, {
      params: { presupuestoId, empresaId, nombreRubro, tipoItem }
    });
    return response.data;
  } catch (error) {
    console.error('Error listando pagos del item:', error);
    throw error;
  }
};

/**
 * Obtener resumen de pagos del presupuesto
 */
export const obtenerResumenPagos = async (presupuestoId, empresaId) => {
  try {
    const response = await api.get(`${API_BASE_URL}/resumen`, {
      params: { presupuestoId, empresaId }
    });
    return response.data;
  } catch (error) {
    console.error('Error obteniendo resumen de pagos:', error);
    throw error;
  }
};

/**
 * Calcular totales de un item específico
 */
export const calcularTotalesItem = async (presupuestoId, empresaId, nombreRubro, tipoItem) => {
  try {
    const response = await api.get(`${API_BASE_URL}/totales-item`, {
      params: { presupuestoId, empresaId, nombreRubro, tipoItem }
    });
    return response.data;
  } catch (error) {
    console.error('Error calculando totales del item:', error);
    throw error;
  }
};

/**
 * Eliminar un pago
 */
export const eliminarPago = async (id, empresaId) => {
  try {
    await api.delete(`${API_BASE_URL}/${id}`, {
      params: { empresaId }
    });
    return true;
  } catch (error) {
    console.error('Error eliminando pago:', error);
    throw error;
  }
};

/**
 * Formatear moneda
 */
export const formatearMoneda = (valor) => {
  if (valor === null || valor === undefined || isNaN(valor)) return '$0,00';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(valor);
};

/**
 * Tipos de items
 */
export const TIPOS_ITEM = {
  JORNALES: 'JORNALES',
  MATERIALES: 'MATERIALES',
  GASTOS_GENERALES: 'GASTOS_GENERALES'
};

export const TIPOS_ITEM_LABELS = {
  JORNALES: 'Jornales',
  MATERIALES: 'Materiales',
  GASTOS_GENERALES: 'Gastos Generales'
};

/**
 * Métodos de pago
 */
export const METODOS_PAGO = {
  EFECTIVO: 'EFECTIVO',
  TRANSFERENCIA: 'TRANSFERENCIA',
  CHEQUE: 'CHEQUE',
  TARJETA: 'TARJETA',
  OTRO: 'OTRO'
};

export const METODOS_PAGO_LABELS = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  CHEQUE: 'Cheque',
  TARJETA: 'Tarjeta',
  OTRO: 'Otro'
};

export default {
  crearPagoCuenta,
  obtenerPagoPorId,
  listarPagosPorPresupuesto,
  listarPagosPorRubro,
  listarPagosPorItem,
  obtenerResumenPagos,
  calcularTotalesItem,
  eliminarPago,
  formatearMoneda,
  TIPOS_ITEM,
  TIPOS_ITEM_LABELS,
  METODOS_PAGO,
  METODOS_PAGO_LABELS
};
