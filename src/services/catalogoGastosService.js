import axios from 'axios';
import api from './api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Servicio para gestionar el catálogo de Gastos Generales
 */

/**
 * Buscar gasto general por nombre exacto
 */
export const buscarGastoPorNombre = async (nombre, empresaId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/gastos-generales`, {
      headers: {
        'empresaId': empresaId.toString()
      }
    });

    if (!response.ok) {
      throw new Error('Error al buscar gastos generales');
    }

    const gastos = await response.json();
    // Buscar coincidencia exacta (case insensitive)
    return gastos.find(g =>
      (g.nombre || '').toLowerCase().trim() === nombre.toLowerCase().trim()
    ) || null;
  } catch (error) {
    console.error('Error buscando gasto por nombre:', error);
    return null;
  }
};

/**
 * Crear nuevo gasto general en el catálogo
 * Solo guarda nombre y precio base, SIN cantidad
 */
export const crearGastoGeneral = async (datos, empresaId) => {
  try {
    const payload = {
      nombre: datos.nombre || datos.descripcion,
      descripcion: datos.descripcion || '',
      unidadMedida: datos.unidadMedida || '',
      categoria: datos.categoria || '',
      precioUnitarioBase: datos.precioUnitario || datos.precioUnitarioBase || 0
      // NO enviar empresaId en body - solo en header
    };

    const response = await axios.post(`${API_BASE_URL}/gastos-generales`, payload, {
      headers: {
        'empresaId': empresaId.toString(),
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error creando gasto general:', error);
    throw error;
  }
};

/**
 * Obtener o crear gasto general
 * Si no existe, lo crea automáticamente en el catálogo
 */
export const obtenerOCrearGasto = async (nombre, precioUnitario, empresaId) => {
  try {
    // 1. Buscar si ya existe
    const gastoExistente = await buscarGastoPorNombre(nombre, empresaId);

    if (gastoExistente) {
      console.log('✅ Gasto encontrado en catálogo:', gastoExistente);
      return gastoExistente;
    }

    // 2. Si no existe, crear
    console.log('📝 Creando nuevo gasto en catálogo:', nombre);
    const nuevoGasto = await crearGastoGeneral({
      nombre,
      precioUnitario
    }, empresaId);

    console.log('✅ Gasto creado en catálogo:', nuevoGasto);
    return nuevoGasto;
  } catch (error) {
    console.error('Error en obtenerOCrearGasto:', error);
    throw error;
  }
};
