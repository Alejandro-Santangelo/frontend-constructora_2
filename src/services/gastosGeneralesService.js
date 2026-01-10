// Servicio para gestión de Gastos Generales (presupuesto_gasto_general)
import api from './api';

// ============================================================
// ENDPOINTS DE PRESUPUESTO_GASTO_GENERAL (Legacy)
// ============================================================

// Consultar gastos generales por ítem
export const getGastosGeneralesPorItem = async (itemId, empresaId = null) => {
  let url = `/api/presupuesto-gasto-general/item/${itemId}`;
  if (empresaId) url += `/empresa/${empresaId}`;
  const response = await api.get(url);
  return response.data;
};

// Crear gasto general
export const crearGastoGeneral = async (gasto) => {
  const response = await api.post('/api/presupuesto-gasto-general', gasto);
  return response.data;
};

// Editar gasto general
export const editarGastoGeneral = async (gasto) => {
  const response = await api.put(`/api/presupuesto-gasto-general/${gasto.id}`, gasto);
  return response.data;
};

// Eliminar gasto general por ID
export const eliminarGastoGeneral = async (id) => {
  const response = await api.delete(`/api/presupuesto-gasto-general/${id}`);
  return response.data;
};

// Eliminar todos los gastos de un ítem
export const eliminarGastosPorItem = async (itemId, empresaId = null) => {
  let url = `/api/presupuesto-gasto-general/item/${itemId}`;
  if (empresaId) url += `/empresa/${empresaId}`;
  const response = await api.delete(url);
  return response.data;
};

// ============================================================
// ENDPOINTS DE CATÁLOGO GASTOS_GENERALES (Nuevo)
// ============================================================

const BASE_URL = '/api/gastos-generales';

export const catalogoGastosService = {
  /**
   * Obtener todos los gastos generales de una empresa
   */
  async obtenerTodos(empresaId) {
    try {
      // api.get ya devuelve response.data directamente
      const data = await api.get(BASE_URL, { empresaId });
      return data;
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
      const data = await api.get(`${BASE_URL}/${id}`, { empresaId });
      return data;
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
      const data = await api.post(BASE_URL, gasto, { empresaId });
      return data;
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
      const data = await api.put(`${BASE_URL}/${id}`, gasto, { empresaId });
      return data;
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
      await api.delete(`${BASE_URL}/${id}`, { empresaId });
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
      const data = await api.get(`${BASE_URL}/categoria/${categoria}`, { empresaId });
      return data;
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
      const data = await api.put(`${BASE_URL}/actualizar-precio-todos`, null, { porcentaje, empresaId });
      return data;
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
      const data = await api.put(`${BASE_URL}/${id}/actualizar-precio`, null, { porcentaje, empresaId });
      return data;
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
      const data = await api.put(`${BASE_URL}/actualizar-precio-varios`, { ids, porcentaje }, { empresaId });
      return data;
    } catch (error) {
      console.error('Error actualizando precios de varios:', error);
      throw error;
    }
  }
};

export default catalogoGastosService;
