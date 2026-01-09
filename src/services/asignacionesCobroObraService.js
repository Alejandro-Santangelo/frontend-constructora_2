import api from './api';

/**
 * Servicio para gestión de asignaciones de cobros a obras
 * Un cobro puede tener múltiples asignaciones a diferentes obras
 * Cada asignación puede tener distribución por items (profesionales, materiales, gastos generales)
 */

// ========== CRUD BÁSICO ==========

/**
 * Crear nueva asignación de cobro a obra
 */
export const crearAsignacion = async (asignacionData, empresaId) => {
  try {
    const response = await api.post(`/api/v1/asignaciones-cobro-obra?empresaId=${empresaId}`, asignacionData);
    console.log('✅ Asignación creada:', response);
    return response;
  } catch (error) {
    console.error('❌ Error creando asignación:', error.response?.data?.message || error.message);
    throw error;
  }
};

/**
 * Actualizar asignación existente
 */
export const actualizarAsignacion = async (asignacionId, asignacionData, empresaId) => {
  try {
    const response = await api.put(`/api/v1/asignaciones-cobro-obra/${asignacionId}?empresaId=${empresaId}`, asignacionData);
    console.log('✅ Asignación actualizada:', response);
    return response;
  } catch (error) {
    console.error('❌ Error actualizando asignación:', error);
    throw error;
  }
};

/**
 * Eliminar asignación
 */
export const eliminarAsignacion = async (asignacionId, empresaId) => {
  try {
    await api.delete(`/api/v1/asignaciones-cobro-obra/${asignacionId}?empresaId=${empresaId}`);
    console.log('✅ Asignación eliminada');
  } catch (error) {
    console.error('❌ Error eliminando asignación:', error);
    throw error;
  }
};

/**
 * Anular asignación (cambia estado a ANULADA, no elimina)
 */
export const anularAsignacion = async (asignacionId, empresaId) => {
  try {
    const response = await api.patch(`/api/v1/asignaciones-cobro-obra/${asignacionId}/anular?empresaId=${empresaId}`);
    console.log('✅ Asignación anulada:', response);
    return response;
  } catch (error) {
    console.error('❌ Error anulando asignación:', error);
    throw error;
  }
};

// ========== CONSULTAS ==========

/**
 * Obtener asignación por ID
 */
export const obtenerAsignacionPorId = async (asignacionId, empresaId) => {
  try {
    return await api.get(`/api/v1/asignaciones-cobro-obra/${asignacionId}?empresaId=${empresaId}`);
  } catch (error) {
    console.error('❌ Error obteniendo asignación:', error);
    throw error;
  }
};

/**
 * Obtener todas las asignaciones de un cobro
 */
export const obtenerAsignacionesDeCobro = async (cobroId, empresaId) => {
  try {
    const response = await api.get(`/api/v1/asignaciones-cobro-obra/cobro/${cobroId}?empresaId=${empresaId}`);
    return Array.isArray(response) ? response : (response?.data || []);
  } catch (error) {
    console.error('❌ Error obteniendo asignaciones del cobro:', error);
    return []; // Retornar array vacío si no hay asignaciones
  }
};

/**
 * Obtener asignaciones activas de un cobro
 */
export const obtenerAsignacionesActivasDeCobro = async (cobroId, empresaId) => {
  try {
    const response = await api.get(`/api/v1/asignaciones-cobro-obra/cobro/${cobroId}/activas?empresaId=${empresaId}`);
    return Array.isArray(response) ? response : (response?.data || []);
  } catch (error) {
    console.error('❌ Error obteniendo asignaciones activas:', error);
    return [];
  }
};

/**
 * Obtener todas las asignaciones de una obra
 */
export const obtenerAsignacionesDeObra = async (obraId, empresaId) => {
  try {
    const response = await api.get(`/api/v1/asignaciones-cobro-obra/obra/${obraId}?empresaId=${empresaId}`);
    return Array.isArray(response) ? response : (response?.data || []);
  } catch (error) {
    console.error('❌ Error obteniendo asignaciones de la obra:', error);
    return [];
  }
};

/**
 * Obtener todas las asignaciones de una empresa
 */
export const obtenerTodasAsignaciones = async (empresaId) => {
  try {
    const response = await api.get(`/api/v1/asignaciones-cobro-obra?empresaId=${empresaId}`);
    return Array.isArray(response) ? response : (response?.data || []);
  } catch (error) {
    console.error('❌ Error obteniendo todas las asignaciones:', error);
    return [];
  }
};

// ========== CÁLCULOS ==========

/**
 * Calcular total asignado de un cobro
 */
export const calcularTotalAsignado = async (cobroId, empresaId) => {
  try {
    const response = await api.get(`/api/v1/asignaciones-cobro-obra/cobro/${cobroId}/total-asignado?empresaId=${empresaId}`);
    return parseFloat(response) || 0;
  } catch (error) {
    console.error('❌ Error calculando total asignado:', error);
    return 0;
  }
};

/**
 * Calcular total recibido por una obra
 */
export const calcularTotalRecibido = async (obraId, empresaId) => {
  try {
    const response = await api.get(`/api/v1/asignaciones-cobro-obra/obra/${obraId}/total-recibido?empresaId=${empresaId}`);
    return parseFloat(response) || 0;
  } catch (error) {
    console.error('❌ Error calculando total recibido:', error);
    return 0;
  }
};

// ========== HELPERS ==========

/**
 * Validar que la suma de distribución por items coincida con el monto asignado
 */
export const validarDistribucionItems = (asignacion) => {
  const { montoAsignado, montoProfesionales, montoMateriales, montoGastosGenerales, montoTrabajosExtra } = asignacion;
  
  if (!montoProfesionales && !montoMateriales && !montoGastosGenerales && !montoTrabajosExtra) {
    return true; // Sin distribución, es válido
  }
  
  const sumaItems = (montoProfesionales || 0) + (montoMateriales || 0) + (montoGastosGenerales || 0) + (montoTrabajosExtra || 0);
  const diferencia = Math.abs(sumaItems - montoAsignado);
  
  return diferencia < 0.01; // Tolerancia de 1 centavo por redondeos
};

/**
 * Crear asignaciones a partir de la distribución por ítems del formulario
 */
export const crearAsignacionConDistribucion = async (cobroId, obraId, presupuestoNoClienteId, montoAsignado, distribucionItems, empresaId) => {
  const asignacionData = {
    cobroObraId: cobroId,
    obraId: obraId,
    presupuestoNoClienteId: presupuestoNoClienteId,
    empresaId: empresaId,
    montoAsignado: parseFloat(montoAsignado),
    estado: 'ACTIVA'
  };
  
  // Agregar distribución por items si existe
  if (distribucionItems) {
    if (distribucionItems.profesionales?.monto > 0) {
      asignacionData.montoProfesionales = parseFloat(distribucionItems.profesionales.monto);
      asignacionData.porcentajeProfesionales = parseFloat(distribucionItems.profesionales.porcentaje);
    }
    if (distribucionItems.materiales?.monto > 0) {
      asignacionData.montoMateriales = parseFloat(distribucionItems.materiales.monto);
      asignacionData.porcentajeMateriales = parseFloat(distribucionItems.materiales.porcentaje);
    }
    if (distribucionItems.gastosGenerales?.monto > 0) {
      asignacionData.montoGastosGenerales = parseFloat(distribucionItems.gastosGenerales.monto);
      asignacionData.porcentajeGastosGenerales = parseFloat(distribucionItems.gastosGenerales.porcentaje);
    }
    if (distribucionItems.trabajosExtra?.monto > 0) {
      asignacionData.montoTrabajosExtra = parseFloat(distribucionItems.trabajosExtra.monto);
      asignacionData.porcentajeTrabajosExtra = parseFloat(distribucionItems.trabajosExtra.porcentaje);
    }
  }
  
  return await crearAsignacion(asignacionData, empresaId);
};

export default {
  crearAsignacion,
  actualizarAsignacion,
  eliminarAsignacion,
  anularAsignacion,
  obtenerAsignacionPorId,
  obtenerAsignacionesDeCobro,
  obtenerAsignacionesActivasDeCobro,
  obtenerAsignacionesDeObra,
  obtenerTodasAsignaciones,
  calcularTotalAsignado,
  calcularTotalRecibido,
  validarDistribucionItems,
  crearAsignacionConDistribucion
};
