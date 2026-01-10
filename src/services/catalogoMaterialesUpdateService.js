import api from './api';

/**
 * Servicio para actualización masiva de precios de Materiales
 */

const catalogoMaterialesUpdateService = {
  /**
   * Actualizar precio de TODOS los materiales
   */
  actualizarPrecioTodos: async (porcentaje, empresaId) => {
    try {
      const response = await fetch(`${api.defaults.baseURL}/api/materiales/actualizar-precio-todos?porcentaje=${porcentaje}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'empresaId': empresaId.toString()
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Error al actualizar precios');
      }

      return await response.json();
    } catch (error) {
      console.error('Error actualizando precio de todos:', error);
      throw error;
    }
  },

  /**
   * Actualizar precio de UN material
   */
  actualizarPrecioUno: async (id, porcentaje, empresaId) => {
    try {
      const response = await fetch(`${api.defaults.baseURL}/api/materiales/${id}/actualizar-precio?porcentaje=${porcentaje}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'empresaId': empresaId.toString()
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Error al actualizar precio');
      }

      return await response.json();
    } catch (error) {
      console.error('Error actualizando precio individual:', error);
      throw error;
    }
  },

  /**
   * Actualizar precio de VARIOS materiales seleccionados
   */
  actualizarPrecioVarios: async (ids, porcentaje, empresaId) => {
    try {
      const response = await fetch(`${api.defaults.baseURL}/api/materiales/actualizar-precio-varios`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'empresaId': empresaId.toString()
        },
        body: JSON.stringify({ ids, porcentaje })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Error al actualizar precios');
      }

      return await response.json();
    } catch (error) {
      console.error('Error actualizando precio de varios:', error);
      throw error;
    }
  }
};

export default catalogoMaterialesUpdateService;
