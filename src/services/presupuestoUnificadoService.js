/**
 * Servicio Unificado de Presupuestos
 *
 * Este servicio reemplaza los servicios separados de:
 * - presupuestosNoCliente
 * - trabajosAdicionalesService
 * - trabajosExtra (parcialmente)
 *
 * Todos los tipos ahora usan el mismo endpoint: /api/v1/presupuestos-no-cliente
 */

import api from './api';
import {
  TIPOS_PRESUPUESTO,
  getConfigPresupuesto,
  validarDatosPresupuesto
} from '../constants/presupuestoTypes';

/**
 * Crear presupuesto (cualquier tipo)
 * @param {Object} datos - Datos del presupuesto
 * @param {string} datos.tipoPresupuesto - 'PRINCIPAL' | 'TRABAJO_DIARIO' | 'TRABAJO_EXTRA' | 'TAREA_LEVE'
 * @param {number} empresaId - ID de la empresa
 * @returns {Promise<Object>} Presupuesto creado
 */
export const crearPresupuesto = async (datos, empresaId) => {
  try {
    const config = getConfigPresupuesto(datos.tipoPresupuesto);

    // Validar datos según tipo
    const validacion = validarDatosPresupuesto(datos);
    if (!validacion.valido) {
      throw new Error(`Validación fallida:\n${validacion.errores.join('\n')}`);
    }

    // Preparar payload
    const payload = {
      ...datos,
      empresaId,
      // Estado inicial según configuración del tipo
      estado: datos.estado || config.estadoInicial,
      // Flag legacy para compatibilidad (mientras backend migra)
      esPresupuestoTrabajoExtra:
        datos.tipoPresupuesto === TIPOS_PRESUPUESTO.TRABAJO_EXTRA ||
        datos.tipoPresupuesto === TIPOS_PRESUPUESTO.TAREA_LEVE
    };

    console.log(`📝 [PresupuestoService] Creando ${config.label}:`, payload);

    const response = await api.presupuestosNoCliente.create(payload, empresaId);

    console.log(`✅ [PresupuestoService] ${config.label} creado:`, response);

    return response;
  } catch (error) {
    console.error(`❌ [PresupuestoService] Error al crear presupuesto:`, error);
    throw error;
  }
};

/**
 * Listar presupuestos con filtros
 * @param {number} empresaId - ID de la empresa
 * @param {Object} filtros - Filtros opcionales
 * @param {string} filtros.tipo - Filtrar por tipo específico
 * @param {number} filtros.obraId - Filtrar por obra
 * @param {number} filtros.trabajoExtraId - Filtrar por trabajo extra (nietos)
 * @param {boolean} filtros.soloRaices - Solo presupuestos padre (PRINCIPAL, TRABAJO_DIARIO)
 * @param {boolean} filtros.soloHijos - Solo hijos de obras (TRABAJO_EXTRA, TAREA_LEVE)
 * @returns {Promise<Array>} Lista de presupuestos
 */
export const listarPresupuestos = async (empresaId, filtros = {}) => {
  try {
    const params = { ...filtros };

    // Si pide solo raíces, filtrar PRINCIPAL y TRABAJO_DIARIO
    if (filtros.soloRaices) {
      delete params.soloRaices;
      // Backend debería soportar este filtro, pero por ahora lo hacemos en frontend
    }

    const response = await api.presupuestosNoCliente.getAll(empresaId, params);
    const lista = Array.isArray(response) ? response : (response.datos || response.content || []);

    // Aplicar filtros adicionales en frontend (temporal)
    let listaFiltrada = lista;

    if (filtros.soloRaices) {
      listaFiltrada = lista.filter(p =>
        p.tipoPresupuesto === TIPOS_PRESUPUESTO.PRINCIPAL ||
        p.tipoPresupuesto === TIPOS_PRESUPUESTO.TRABAJO_DIARIO ||
        (!p.tipoPresupuesto && !p.esPresupuestoTrabajoExtra) // Fallback para datos sin tipo
      );
    }

    if (filtros.soloHijos) {
      listaFiltrada = lista.filter(p =>
        p.tipoPresupuesto === TIPOS_PRESUPUESTO.TRABAJO_EXTRA ||
        p.tipoPresupuesto === TIPOS_PRESUPUESTO.TAREA_LEVE ||
        (!p.tipoPresupuesto && p.esPresupuestoTrabajoExtra) // Fallback
      );
    }

    if (filtros.tipo) {
      listaFiltrada = lista.filter(p => p.tipoPresupuesto === filtros.tipo);
    }

    console.log(`📋 [PresupuestoService] Listado (${listaFiltrada.length}/${lista.length}):`, filtros);

    return listaFiltrada;
  } catch (error) {
    console.error(`❌ [PresupuestoService] Error al listar:`, error);
    return [];
  }
};

/**
 * Listar TAREAS LEVES de una obra (hijas directas)
 * @param {number} obraId - ID de la obra
 * @param {number} empresaId - ID de la empresa
 * @returns {Promise<Array>} Tareas leves hijas
 */
export const listarTareasLevesObra = async (obraId, empresaId) => {
  return listarPresupuestos(empresaId, {
    tipo: TIPOS_PRESUPUESTO.TAREA_LEVE,
    obraId: obraId,
    trabajoExtraId: null // Solo hijas directas (no nietas)
  });
};

/**
 * Listar TAREAS LEVES de un trabajo extra (nietas)
 * @param {number} trabajoExtraId - ID del trabajo extra
 * @param {number} empresaId - ID de la empresa
 * @returns {Promise<Array>} Tareas leves nietas
 */
export const listarTareasLevesTrabajoExtra = async (trabajoExtraId, empresaId) => {
  return listarPresupuestos(empresaId, {
    tipo: TIPOS_PRESUPUESTO.TAREA_LEVE,
    trabajoExtraId: trabajoExtraId
  });
};

/**
 * Listar TRABAJOS EXTRA de una obra
 * @param {number} obraId - ID de la obra
 * @param {number} empresaId - ID de la empresa
 * @returns {Promise<Array>} Trabajos extra
 */
export const listarTrabajosExtraObra = async (obraId, empresaId) => {
  return listarPresupuestos(empresaId, {
    tipo: TIPOS_PRESUPUESTO.TRABAJO_EXTRA,
    obraId: obraId
  });
};

/**
 * Obtener jerarquía completa de una obra
 * @param {number} obraId - ID de la obra
 * @param {number} empresaId - ID de la empresa
 * @returns {Promise<Object>} Objeto con hijos y nietos organizados
 */
export const obtenerJerarquiaObra = async (obraId, empresaId) => {
  try {
    // Obtener todos los presupuestos relacionados a esta obra
    const todosRelacionados = await listarPresupuestos(empresaId, { obraId });

    // Separar por tipo y nivel
    const trabajosExtra = todosRelacionados.filter(p =>
      p.tipoPresupuesto === TIPOS_PRESUPUESTO.TRABAJO_EXTRA
    );

    const tareasHijas = todosRelacionados.filter(p =>
      p.tipoPresupuesto === TIPOS_PRESUPUESTO.TAREA_LEVE && !p.trabajoExtraId
    );

    const tareasNietas = todosRelacionados.filter(p =>
      p.tipoPresupuesto === TIPOS_PRESUPUESTO.TAREA_LEVE && p.trabajoExtraId
    );

    // Organizar nietas por trabajo extra padre
    const trabajosExtraConTareas = trabajosExtra.map(te => ({
      ...te,
      tareasLeves: tareasNietas.filter(t => t.trabajoExtraId === te.id)
    }));

    return {
      obraId,
      trabajosExtra: trabajosExtraConTareas,
      tareasDirectas: tareasHijas,
      totalTrabajosExtra: trabajosExtra.length,
      totalTareasDirectas: tareasHijas.length,
      totalTareasNietas: tareasNietas.length,
      totalTareas: tareasHijas.length + tareasNietas.length
    };
  } catch (error) {
    console.error(`❌ [PresupuestoService] Error al obtener jerarquía:`, error);
    throw error;
  }
};

/**
 * Actualizar presupuesto
 * @param {number} id - ID del presupuesto
 * @param {Object} datos - Datos a actualizar
 * @param {number} empresaId - ID de la empresa
 * @returns {Promise<Object>} Presupuesto actualizado
 */
export const actualizarPresupuesto = async (id, datos, empresaId) => {
  try {
    const response = await api.presupuestosNoCliente.update(id, datos, empresaId);
    console.log(`✅ [PresupuestoService] Presupuesto ${id} actualizado`);
    return response;
  } catch (error) {
    console.error(`❌ [PresupuestoService] Error al actualizar:`, error);
    throw error;
  }
};

/**
 * Eliminar presupuesto
 * @param {number} id - ID del presupuesto
 * @param {number} empresaId - ID de la empresa
 * @returns {Promise<void>}
 */
export const eliminarPresupuesto = async (id, empresaId) => {
  try {
    await api.presupuestosNoCliente.delete(id, empresaId);
    console.log(`✅ [PresupuestoService] Presupuesto ${id} eliminado`);
  } catch (error) {
    console.error(`❌ [PresupuestoService] Error al eliminar:`, error);
    throw error;
  }
};

/**
 * Obtener presupuesto por ID
 * @param {number} id - ID del presupuesto
 * @param {number} empresaId - ID de la empresa
 * @returns {Promise<Object>} Presupuesto
 */
export const obtenerPresupuesto = async (id, empresaId) => {
  try {
    return await api.presupuestosNoCliente.getById(id, empresaId);
  } catch (error) {
    console.error(`❌ [PresupuestoService] Error al obtener:`, error);
    throw error;
  }
};

// ==================== COMPATIBILIDAD CON CÓDIGO ANTIGUO ====================
// Estos métodos mantienen la firma del servicio antiguo para facilitar migración

/**
 * @deprecated Usar crearPresupuesto con tipo='TAREA_LEVE'
 */
export const crearTrabajoAdicional = async (datos) => {
  console.warn('⚠️ crearTrabajoAdicional está deprecado. Usar crearPresupuesto');
  return crearPresupuesto({
    ...datos,
    tipoPresupuesto: TIPOS_PRESUPUESTO.TAREA_LEVE
  }, datos.empresaId);
};

/**
 * @deprecated Usar actualizarPresupuesto
 */
export const actualizarTrabajoAdicional = async (id, datos) => {
  console.warn('⚠️ actualizarTrabajoAdicional está deprecado. Usar actualizarPresupuesto');
  return actualizarPresupuesto(id, {
    ...datos,
    tipoPresupuesto: TIPOS_PRESUPUESTO.TAREA_LEVE
  }, datos.empresaId);
};

/**
 * @deprecated Usar listarPresupuestos con tipo='TAREA_LEVE'
 */
export const listarTrabajosAdicionales = async (empresaId) => {
  console.warn('⚠️ listarTrabajosAdicionales está deprecado. Usar listarPresupuestos');
  return listarPresupuestos(empresaId, { tipo: TIPOS_PRESUPUESTO.TAREA_LEVE });
};

export default {
  // Métodos principales
  crearPresupuesto,
  listarPresupuestos,
  actualizarPresupuesto,
  eliminarPresupuesto,
  obtenerPresupuesto,

  // Métodos específicos por tipo
  listarTareasLevesObra,
  listarTareasLevesTrabajoExtra,
  listarTrabajosExtraObra,
  obtenerJerarquiaObra,

  // Compatibilidad (deprecados)
  crearTrabajoAdicional,
  actualizarTrabajoAdicional,
  listarTrabajosAdicionales
};
