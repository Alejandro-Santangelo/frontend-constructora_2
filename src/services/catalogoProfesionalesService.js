import api from './api';

/**
 * Servicio para actualización masiva de porcentaje de ganancia de Profesionales
 */

const catalogoProfesionalesService = {
  /**
   * Actualizar porcentaje de ganancia de TODOS los profesionales
   */
  actualizarPorcentajeTodos: async (porcentaje, empresaId) => {
    try {
      const response = await fetch(`${api.defaults.baseURL}/api/profesionales/actualizar-porcentaje-ganancia-todos?porcentaje=${porcentaje}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'empresaId': empresaId.toString()
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Error al actualizar porcentajes');
      }

      return await response.json();
    } catch (error) {
      console.error('Error actualizando porcentaje de todos:', error);
      throw error;
    }
  },

  /**
   * Actualizar porcentaje de ganancia de UN profesional
   */
  actualizarPorcentajeUno: async (id, porcentaje, empresaId) => {
    try {
      const response = await fetch(`${api.defaults.baseURL}/api/profesionales/${id}/actualizar-porcentaje-ganancia?porcentaje=${porcentaje}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'empresaId': empresaId.toString()
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Error al actualizar porcentaje');
      }

      return await response.json();
    } catch (error) {
      console.error('Error actualizando porcentaje individual:', error);
      throw error;
    }
  },

  /**
   * Actualizar porcentaje de ganancia de VARIOS profesionales seleccionados
   */
  actualizarPorcentajeVarios: async (ids, porcentaje, empresaId) => {
    try {
      const response = await fetch(`${api.defaults.baseURL}/api/profesionales/actualizar-porcentaje-ganancia-varios`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'empresaId': empresaId.toString()
        },
        body: JSON.stringify({ ids, porcentaje })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Error al actualizar porcentajes');
      }

      return await response.json();
    } catch (error) {
      console.error('Error actualizando porcentaje de varios:', error);
      throw error;
    }
  }
};

export default catalogoProfesionalesService;
