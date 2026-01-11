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
    const esGlobal = Boolean(data.esGlobal);

    const payload = {
      obraId: parseInt(obraId),
      cantidadAsignada: parseFloat(data.cantidadAsignada),
      precioUnitario: data.precioUnitario !== undefined ? parseFloat(data.precioUnitario) : undefined, // 🔥 Agregar precio unitario
      observaciones: data.observaciones || '',
      esGlobal: esGlobal
    };

    if (esGlobal) {
      // Material global: sin IDs, con descripción y unidad
      payload.presupuestoMaterialId = null;
      payload.materialCatalogoId = null;
      payload.descripcion = data.descripcion || data.nombre;
      payload.unidadMedida = data.unidadMedida || data.unidad;
    } else {
      // Material del presupuesto: con ID
      payload.presupuestoMaterialId = parseInt(data.presupuestoMaterialId);
    }

    // Incluir semana si está presente
    if (data.numeroSemana !== undefined && data.numeroSemana !== null) {
      payload.semana = parseInt(data.numeroSemana);
    }

    // Incluir fecha de asignación si está presente
    if (data.fechaAsignacion) {
      payload.fechaAsignacion = data.fechaAsignacion;
    }

    console.log('📦 Payload material enviado al backend:', payload);

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
