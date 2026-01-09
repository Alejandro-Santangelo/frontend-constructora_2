// Servicio para gestión de Gastos Generales (presupuesto_gasto_general)
import apiClient from './api';

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
