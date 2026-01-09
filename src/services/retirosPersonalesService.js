import api from './api';

const BASE_URL = '/api/v1/retiros-personales';

/**
 * Calcular saldo disponible para retiros
 */
export const obtenerSaldoDisponible = async (empresaId) => {
  console.log('📤 [Service] Haciendo petición saldo-disponible con empresaId:', empresaId);
  const response = await api.get(`${BASE_URL}/saldo-disponible`, {
    params: { empresaId }
  });
  console.log('📥 [Service] Respuesta completa:', response);
  console.log('📥 [Service] response.data:', response.data);
  // El interceptor ya extrae los datos, están en response directamente
  return response.data || response;
};

/**
 * Registrar un nuevo retiro personal
 */
export const registrarRetiro = async (retiroData) => {
  try {
    const response = await api.post(BASE_URL, retiroData);
    return response.data || response;
  } catch (error) {
    console.error('Error registrando retiro:', error);
    throw error;
  }
};

/**
 * Listar retiros de una empresa
 */
export const listarRetiros = async (empresaId, filtros = {}) => {
  const params = {
    empresaId,
    ...filtros
  };
  const response = await api.get(BASE_URL, { params });
  return response.data || response;
};

/**
 * Obtener un retiro por ID
 */
export const obtenerRetiro = async (id, empresaId) => {
  try {
    const response = await api.get(`${BASE_URL}/${id}`, {
      params: { empresaId }
    });
    return response.data || response;
  } catch (error) {
    console.error('Error obteniendo retiro:', error);
    throw error;
  }
};

/**
 * Anular un retiro
 */
export const anularRetiro = async (id, empresaId) => {
  try {
    const response = await api.put(`${BASE_URL}/${id}/anular`, null, {
      params: { empresaId }
    });
    return response.data || response;
  } catch (error) {
    console.error('Error anulando retiro:', error);
    throw error;
  }
};

/**
 * Eliminar un retiro
 */
export const eliminarRetiro = async (id, empresaId) => {
  try {
    await api.delete(`${BASE_URL}/${id}`, {
      params: { empresaId }
    });
  } catch (error) {
    console.error('Error eliminando retiro:', error);
    throw error;
  }
};

/**
 * Obtener totales de retiros
 */
export const obtenerTotales = async (empresaId, fechaDesde = null, fechaHasta = null) => {
  try {
    const params = { empresaId };
    if (fechaDesde) params.fechaDesde = fechaDesde;
    if (fechaHasta) params.fechaHasta = fechaHasta;
    
    const response = await api.get(`${BASE_URL}/totales`, { params });
    return response.data || response;
  } catch (error) {
    console.error('Error obteniendo totales:', error);
    throw error;
  }
};

/**
 * Formatear moneda
 */
export const formatearMoneda = (monto) => {
  if (!monto && monto !== 0) return '$\u00A00,00';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(monto);
};

/**
 * Formatear fecha
 */
export const formatearFecha = (fecha) => {
  if (!fecha) return '-';
  return new Date(fecha).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

/**
 * Tipos de retiro disponibles
 */
export const TIPOS_RETIRO = {
  GANANCIA: 'Ganancia',
  PRESTAMO: 'Préstamo',
  GASTO_PERSONAL: 'Gasto Personal'
};

/**
 * Estados de retiro
 */
export const ESTADOS_RETIRO = {
  ACTIVO: 'Activo',
  ANULADO: 'Anulado'
};
