// Servicio para gestión de Gastos Generales (presupuesto_gasto_general)
import apiClient from './api';

// ============================================================
// ENDPOINTS DE PRESUPUESTO_GASTO_GENERAL (Legacy)
// ============================================================

// Consultar gastos generales por ítem
export const getGastosGeneralesPorItem = async (itemId, empresaId = null) => {
  let url = `/api/presupuesto-gasto-general/item/${itemId}`;
  if (empresaId) url += `/empresa/${empresaId}`;
  const response = await apiClient.get(url);
  return response.data;
};

// Crear gasto general
export const crearGastoGeneral = async (gasto) => {
  const response = await apiClient.post('/api/presupuesto-gasto-general', gasto);
  return response.data;
};

// Editar gasto general
export const editarGastoGeneral = async (gasto) => {
  const response = await apiClient.put(`/api/presupuesto-gasto-general/${gasto.id}`, gasto);
  return response.data;
};

// Eliminar gasto general por ID
export const eliminarGastoGeneral = async (id) => {
  const response = await apiClient.delete(`/api/presupuesto-gasto-general/${id}`);
  return response.data;
};

// Eliminar todos los gastos de un ítem
export const eliminarGastosPorItem = async (itemId, empresaId = null) => {
  let url = `/api/presupuesto-gasto-general/item/${itemId}`;
  if (empresaId) url += `/empresa/${empresaId}`;
  const response = await apiClient.delete(url);
  return response.data;
};

// ============================================================
// ENDPOINTS DE CATÁLOGO GASTOS_GENERALES (Nuevo)
// ============================================================

const BASE_URL = '/gastos-generales';

export const catalogoGastosService = {
  /**
   * Obtener todos los gastos generales de una empresa
   */
  async obtenerTodos(empresaId) {
    try {
      const response = await apiClient.get(BASE_URL, {
        headers: { empresaId: empresaId.toString() }
      });
      return response.data;
    } catch (error) {
      console.error('Error obteniendo gastos generales:', error);
      throw error;
    }
  },

  /**
   * Obtener un gasto general por ID
   */
  async obtenerPorId(id, empresaId) {
    try {
      const response = await apiClient.get(`${BASE_URL}/${id}`, {
        headers: { empresaId: empresaId.toString() }
      });
      return response.data;
    } catch (error) {
      console.error(`Error obteniendo gasto general ${id}:`, error);
      throw error;
    }
  },

  /**
   * Crear un nuevo gasto general
   */
  async crear(gasto, empresaId) {
    try {
      const response = await apiClient.post(BASE_URL, gasto, {
        headers: { empresaId: empresaId.toString() }
      });
      return response.data;
    } catch (error) {
      console.error('Error creando gasto general:', error);
      throw error;
    }
  },

  /**
   * Actualizar un gasto general existente
   */
  async actualizar(id, gasto, empresaId) {
    try {
      const response = await apiClient.put(`${BASE_URL}/${id}`, gasto, {
        headers: { empresaId: empresaId.toString() }
      });
      return response.data;
    } catch (error) {
      console.error(`Error actualizando gasto general ${id}:`, error);
      throw error;
    }
  },

  /**
   * Eliminar un gasto general
   */
  async eliminar(id, empresaId) {
    try {
      await apiClient.delete(`${BASE_URL}/${id}`, {
        headers: { empresaId: empresaId.toString() }
      });
      return true;
    } catch (error) {
      console.error(`Error eliminando gasto general ${id}:`, error);
      throw error;
    }
  },

  /**
   * Obtener gastos generales por categoría
   */
  async obtenerPorCategoria(categoria, empresaId) {
    try {
      const response = await apiClient.get(`${BASE_URL}/categoria/${categoria}`, {
        headers: { empresaId: empresaId.toString() }
      });
      return response.data;
    } catch (error) {
      console.error(`Error obteniendo gastos de categoría ${categoria}:`, error);
      throw error;
    }
  },

  /**
   * Actualizar precio de todos los gastos generales
   */
  async actualizarPrecioTodos(porcentaje, empresaId) {
    try {
      const response = await apiClient.put(
        `${BASE_URL}/actualizar-precio-todos`,
        null,
        {
          params: { porcentaje },
          headers: { empresaId: empresaId.toString() }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error actualizando precios de todos:', error);
      throw error;
    }
  },

  /**
   * Actualizar precio de un gasto general específico
   */
  async actualizarPrecioUno(id, porcentaje, empresaId) {
    try {
      const response = await apiClient.put(
        `${BASE_URL}/${id}/actualizar-precio`,
        null,
        {
          params: { porcentaje },
          headers: { empresaId: empresaId.toString() }
        }
      );
      return response.data;
    } catch (error) {
      console.error(`Error actualizando precio del gasto ${id}:`, error);
      throw error;
    }
  },

  /**
   * Actualizar precio de varios gastos generales seleccionados
   */
  async actualizarPrecioVarios(ids, porcentaje, empresaId) {
    try {
      const response = await apiClient.put(
        `${BASE_URL}/actualizar-precio-varios`,
        { ids, porcentaje },
        {
          headers: { empresaId: empresaId.toString() }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error actualizando precios de varios:', error);
      throw error;
    }
  }
};

export default catalogoGastosService;
