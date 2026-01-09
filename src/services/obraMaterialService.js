import api from './api';

/**
 * Servicio para gestionar materiales asignados a obras
 * Usa tabla obra_material en BD
 */

/**
 * Obtener todos los materiales asignados a una obra
 * @param {number} obraId - ID de la obra
 * @param {number} empresaId - ID de la empresa
 * @returns {Promise<Array>} Lista de materiales asignados
 */
export const obtenerMaterialesAsignados = async (obraId, empresaId) => {
  try {
    const response = await api.get(`/api/obras/${obraId}/materiales`, {
      headers: { empresaId: empresaId.toString() }
    });
    return Array.isArray(response) ? response : response?.data || [];
  } catch (error) {
    console.error(`Error obteniendo materiales de obra ${obraId}:`, error);
    throw error;
  }
};

/**
 * Asignar un material a una obra
 * @param {number} obraId - ID de la obra
 * @param {object} data - Datos de la asignación
 * @param {number} empresaId - ID de la empresa
 * @returns {Promise<object>} Material asignado
 */
export const asignarMaterial = async (obraId, data, empresaId) => {
  try {
    const payload = {
      obraId: parseInt(obraId),
      presupuestoMaterialId: parseInt(data.presupuestoMaterialId),
      cantidadAsignada: parseFloat(data.cantidadAsignada),
      observaciones: data.observaciones || ''
    };
    
    // Incluir semana si está presente (campo requerido por backend)
    if (data.numeroSemana) {
      payload.semana = parseInt(data.numeroSemana);
    }
    
    const response = await api.post(`/api/obras/${obraId}/materiales`, 
      payload,
      {
        headers: { empresaId: empresaId.toString() }
      }
    );
    return response?.data || response;
  } catch (error) {
    console.error(`Error asignando material a obra ${obraId}:`, error);
    throw error;
  }
};

/**
 * Eliminar una asignación de material
 * @param {number} obraId - ID de la obra
 * @param {number} asignacionId - ID de la asignación
 * @param {number} empresaId - ID de la empresa
 * @returns {Promise<void>}
 */
export const eliminarAsignacion = async (obraId, asignacionId, empresaId) => {
  try {
    await api.delete(`/api/obras/${obraId}/materiales/${asignacionId}`, {
      headers: { empresaId: empresaId.toString() }
    });
  } catch (error) {
    console.error(`Error eliminando asignación ${asignacionId}:`, error);
    throw error;
  }
};
