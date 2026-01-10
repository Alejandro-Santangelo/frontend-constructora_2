const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

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
      (g.descripcion || '').toLowerCase().trim() === nombre.toLowerCase().trim()
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
      descripcion: datos.nombre || datos.descripcion,
      precioUnitario: datos.precioUnitario || 0,
      cantidad: 1, // Valor por defecto para el catálogo
      subtotal: datos.precioUnitario || 0,
      observaciones: datos.observaciones || 'Creado desde asignación manual',
      sinCantidad: false,
      sinPrecio: false,
      orden: 999,
      empresaId: empresaId
    };

    const response = await fetch(`${API_BASE_URL}/gastos-generales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'empresaId': empresaId.toString()
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error al crear gasto general: ${errorText}`);
    }

    return await response.json();
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
