import axios from 'axios';
import api from './api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Servicio para gestionar el catálogo de Materiales
 */

/**
 * Obtener todos los materiales del catálogo
 */
export const obtenerMateriales = async (empresaId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/materiales?empresaId=${empresaId}`, {
      headers: {
        'empresaId': empresaId.toString()
      }
    });

    if (!response.ok) {
      throw new Error('Error al obtener materiales');
    }

    return await response.json();
  } catch (error) {
    console.error('Error obteniendo materiales:', error);
    return [];
  }
};

/**
 * Buscar material por nombre exacto
 */
export const buscarMaterialPorNombre = async (nombre, empresaId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/materiales?empresaId=${empresaId}`, {
      headers: {
        'empresaId': empresaId.toString()
      }
    });

    if (!response.ok) {
      throw new Error('Error al buscar materiales');
    }

    const materiales = await response.json();
    // Buscar coincidencia exacta (case insensitive)
    return materiales.find(m =>
      (m.nombre || '').toLowerCase().trim() === nombre.toLowerCase().trim()
    ) || null;
  } catch (error) {
    console.error('Error buscando material por nombre:', error);
    return null;
  }
};

/**
 * Crear nuevo material en el catálogo
 * Solo guarda nombre, unidad y precio base, SIN cantidad
 */
export const crearMaterial = async (datos, empresaId) => {
  try {
    const payload = {
      nombre: datos.nombre,
      descripcion: datos.descripcion || '',
      unidadMedida: datos.unidadMedida || datos.unidad || '',
      precioUnitario: datos.precioUnitario || 0,
      activo: true
      // NO enviar empresaId en body - solo en header
    };

    const response = await axios.post(`${API_BASE_URL}/materiales`, payload, {
      headers: {
        'empresaId': empresaId.toString(),
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error creando material:', error);
    throw error;
  }
};

/**
 * Obtener o crear material
 * Si no existe, lo crea automáticamente en el catálogo
 */
export const obtenerOCrearMaterial = async (nombre, unidadMedida, precioUnitario, empresaId) => {
  try {
    // 1. Buscar si ya existe
    const materialExistente = await buscarMaterialPorNombre(nombre, empresaId);

    if (materialExistente) {
      console.log('✅ Material encontrado en catálogo:', materialExistente);
      return materialExistente;
    }

    // 2. Si no existe, crear
    console.log('📝 Creando nuevo material en catálogo:', nombre);
    const nuevoMaterial = await crearMaterial({
      nombre,
      unidadMedida,
      precioUnitario: precioUnitario || 0
    }, empresaId);

    console.log('✅ Material creado en catálogo:', nuevoMaterial);
    return nuevoMaterial;
  } catch (error) {
    console.error('Error en obtenerOCrearMaterial:', error);
    throw error;
  }
};
