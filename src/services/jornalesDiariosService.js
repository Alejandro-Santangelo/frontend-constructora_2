import api from './api';

/**
 * Servicio para gestionar jornales diarios de profesionales
 * Conecta con /api/jornales-diarios
 */

const BASE_URL = '/api/jornales-diarios';

/**
 * Crear un nuevo jornal diario
 * @param {Object} jornal - { profesionalId, obraId, fecha, horasTrabajadasDecimal, observaciones }
 * @param {number} empresaId - ID de la empresa
 */
export const crearJornalDiario = async (jornal, empresaId) => {
  try {
    console.log('📤 Enviando jornal al backend:', {
      url: `${BASE_URL}?empresaId=${empresaId}`,
      payload: jornal,
      empresaId: empresaId
    });
    const response = await api.post(`${BASE_URL}?empresaId=${empresaId}`, jornal);
    console.log('✅ Jornal creado exitosamente:', response);
    return response;
  } catch (error) {
    console.error('❌ Error al crear jornal diario:', error);
    console.error('❌ Error completo (stringificado):', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.error('❌ error.response:', error.response);
    console.error('❌ error.response?.data:', error.response?.data);
    console.error('❌ error.response?.status:', error.response?.status);
    console.error('❌ error.message:', error.message);
    console.error('❌ error.config?.url:', error.config?.url);
    console.error('❌ error.config?.data:', error.config?.data);
    throw error;
  }
};

/**
 * Actualizar un jornal diario existente
 * @param {number} id - ID del jornal
 * @param {Object} jornal - Datos a actualizar
 * @param {number} empresaId - ID de la empresa
 */
export const actualizarJornalDiario = async (id, jornal, empresaId) => {
  try {
    const response = await api.put(`${BASE_URL}/${id}?empresaId=${empresaId}`, jornal);
    return response;
  } catch (error) {
    console.error('❌ Error al actualizar jornal diario:', error);
    throw error;
  }
};

/**
 * Eliminar un jornal diario
 * @param {number} id - ID del jornal
 * @param {number} empresaId - ID de la empresa
 */
export const eliminarJornalDiario = async (id, empresaId) => {
  try {
    const response = await api.delete(`${BASE_URL}/${id}?empresaId=${empresaId}`);
    return response;
  } catch (error) {
    console.error('❌ Error al eliminar jornal diario:', error);
    throw error;
  }
};

/**
 * Obtener jornal por ID
 * @param {number} id - ID del jornal
 * @param {number} empresaId - ID de la empresa
 */
export const obtenerJornalPorId = async (id, empresaId) => {
  try {
    const response = await api.get(`${BASE_URL}/${id}?empresaId=${empresaId}`);
    return response;
  } catch (error) {
    console.error('❌ Error al obtener jornal:', error);
    throw error;
  }
};

/**
 * Listar jornales por profesional
 * @param {number} profesionalId - ID del profesional
 * @param {number} empresaId - ID de la empresa
 */
export const listarJornalesPorProfesional = async (profesionalId, empresaId) => {
  try {
    const response = await api.get(`${BASE_URL}/profesional/${profesionalId}?empresaId=${empresaId}`);
    return response;
  } catch (error) {
    console.error('❌ Error al listar jornales por profesional:', error);
    throw error;
  }
};

/**
 * Listar jornales por obra
 * @param {number} obraId - ID de la obra
 * @param {number} empresaId - ID de la empresa
 */
export const listarJornalesPorObra = async (obraId, empresaId) => {
  try {
    const response = await api.get(`${BASE_URL}/obra/${obraId}?empresaId=${empresaId}`);
    return response;
  } catch (error) {
    console.error('❌ Error al listar jornales por obra:', error);
    throw error;
  }
};

/**
 * Listar jornales por rango de fechas
 * @param {string} fechaDesde - Fecha inicio (YYYY-MM-DD)
 * @param {string} fechaHasta - Fecha fin (YYYY-MM-DD)
 * @param {number} empresaId - ID de la empresa
 */
export const listarJornalesPorFechas = async (fechaDesde, fechaHasta, empresaId) => {
  try {
    const response = await api.get(`${BASE_URL}/fechas?fechaDesde=${fechaDesde}&fechaHasta=${fechaHasta}&empresaId=${empresaId}`);
    return response;
  } catch (error) {
    console.error('❌ Error al listar jornales por fechas:', error);
    throw error;
  }
};

/**
 * Listar jornales de un profesional en una obra
 * @param {number} profesionalId - ID del profesional
 * @param {number} obraId - ID de la obra
 * @param {number} empresaId - ID de la empresa
 */
export const listarJornalesPorProfesionalYObra = async (profesionalId, obraId, empresaId) => {
  try {
    const response = await api.get(`${BASE_URL}/profesional/${profesionalId}/obra/${obraId}?empresaId=${empresaId}`);
    return response;
  } catch (error) {
    console.error('❌ Error al listar jornales por profesional y obra:', error);
    throw error;
  }
};

/**
 * Obtener resumen de horas trabajadas por profesional en obra
 * @param {number} profesionalId - ID del profesional
 * @param {number} obraId - ID de la obra
 * @param {number} empresaId - ID de la empresa
 */
export const obtenerResumenProfesionalEnObra = async (profesionalId, obraId, empresaId) => {
  try {
    const response = await api.get(`${BASE_URL}/resumen/profesional/${profesionalId}/obra/${obraId}?empresaId=${empresaId}`);
    return response;
  } catch (error) {
    console.error('❌ Error al obtener resumen:', error);
    throw error;
  }
};

/**
 * Obtener resumen de todos los profesionales en una obra
 * @param {number} obraId - ID de la obra
 * @param {number} empresaId - ID de la empresa
 */
export const obtenerResumenProfesionalesEnObra = async (obraId, empresaId) => {
  try {
    const response = await api.get(`${BASE_URL}/resumen/obra/${obraId}?empresaId=${empresaId}`);
    return response;
  } catch (error) {
    console.error('❌ Error al obtener resumen de profesionales en obra:', error);
    throw error;
  }
};

/**
 * Obtener resumen de obra por profesional
 * @param {number} profesionalId - ID del profesional
 * @param {number} empresaId - ID de la empresa
 */
export const obtenerResumenObrasPorProfesional = async (profesionalId, empresaId) => {
  try {
    const response = await api.get(`${BASE_URL}/resumen/profesional/${profesionalId}/obras?empresaId=${empresaId}`);
    return response;
  } catch (error) {
    console.error('❌ Error al obtener resumen de obras por profesional:', error);
    throw error;
  }
};

/**
 * Verificar si existe un jornal para profesional, obra y fecha
 * @param {number} profesionalId - ID del profesional
 * @param {number} obraId - ID de la obra
 * @param {string} fecha - Fecha (YYYY-MM-DD)
 * @param {number} empresaId - ID de la empresa
 */
export const verificarJornalExistente = async (profesionalId, obraId, fecha, empresaId) => {
  try {
    const response = await api.get(`${BASE_URL}/verificar?profesionalId=${profesionalId}&obraId=${obraId}&fecha=${fecha}&empresaId=${empresaId}`);
    return response;
  } catch (error) {
    console.error('❌ Error al verificar jornal existente:', error);
    throw error;
  }
};

/**
 * Obtener rubros activos del presupuesto aprobado de una obra
 * @param {number} obraId - ID de la obra
 * @param {number} empresaId - ID de la empresa (inyectado automáticamente por el interceptor)
 * @returns {Promise<Array<{id: number, nombreRubro: string}>>}
 */
export const obtenerRubrosActivosPorObra = async (obraId, empresaId) => {
  try {
    const response = await api.get(`/api/presupuestos-no-cliente/por-obra/${obraId}/rubros-activos`);
    return Array.isArray(response) ? response : (response?.data || []);
  } catch (error) {
    console.error('❌ Error al obtener rubros de la obra:', error);
    throw error;
  }
};

export default {
  crearJornalDiario,
  actualizarJornalDiario,
  eliminarJornalDiario,
  obtenerJornalPorId,
  listarJornalesPorProfesional,
  listarJornalesPorObra,
  listarJornalesPorFechas,
  listarJornalesPorProfesionalYObra,
  obtenerResumenProfesionalEnObra,
  obtenerResumenProfesionalesEnObra,
  obtenerResumenObrasPorProfesional,
  verificarJornalExistente,
  obtenerRubrosActivosPorObra
};
