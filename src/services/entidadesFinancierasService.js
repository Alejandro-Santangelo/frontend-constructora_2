// ================================================================================
// SERVICIO: Sistema Unificado de Entidades Financieras
// Backend endpoint base: /api/v1/entidades-financieras
//
// Tipos de entidad (ver src/constants/obraTypes.js):
//   OBRA_PRINCIPAL     ('OBRA_PRINCIPAL')    - Obra generada desde presupuesto TRADICIONAL
//   OBRA_TRABAJO_DIARIO('OBRA_TRABAJO_DIARIO')- Obra generada desde presupuesto TRABAJO_DIARIO
//   OBRA_ADICIONAL     ('TRABAJO_EXTRA')     - Adicional vinculado a obra (presupuesto TRABAJO_EXTRA)
//   OBRA_TAREA_LEVE    ('TRABAJO_ADICIONAL') - Tarea leve vinculada a obra (presupuesto TAREA_LEVE)
//   OBRA_INDEPENDIENTE ('OBRA_INDEPENDIENTE')- Obra sin presupuesto, creada manualmente
// ================================================================================
import apiClient from './api';
import { getCurrentEmpresaId } from './api';
import {
  TIPOS_OBRA,
  OBRA_PRINCIPAL,
  OBRA_TRABAJO_DIARIO,
  OBRA_ADICIONAL,
  OBRA_TAREA_LEVE,
  OBRA_INDEPENDIENTE,
  tipoObraDesdePresupuesto,
} from '../constants/obraTypes';

const BASE_URL = '/api/v1/entidades-financieras';

// -----------------------------------------------------------------------
// Resuelve el empresaId del tenant activo:
// usa el valor pasado explicitamente; si es nulo/cero, toma el del contexto global.
// -----------------------------------------------------------------------
const _eid = (empresaId) => Number(empresaId) || getCurrentEmpresaId();

// -----------------------------------------------------------------------
// Cache local: mapa de `${tipoEntidad}_${entidadId}` -> entidadFinanciera
// Se invalida al llamar invalidarCache()
// -----------------------------------------------------------------------
let _cacheEntidades = null; // { empresaId, mapa: { key -> entidadFinanciera } }

const _buildKey = (tipoEntidad, entidadId) => `${tipoEntidad}_${entidadId}`;

export const invalidarCache = () => {
  _cacheEntidades = null;
};

// -----------------------------------------------------------------------
// ENDPOINT 1: Sincronizar (registra o actualiza, idempotente)
// POST /api/v1/entidades-financieras/sincronizar
// -----------------------------------------------------------------------
/**
 * Registra o actualiza una entidad en el sistema unificado.
 * Idempotente: se puede llamar multiples veces sin efectos negativos.
 * Devuelve el objeto EntidadFinanciera con su "id" (entidadFinancieraId).
 *
 * @param {Object} data - SincronizarRequest
 * @param {number} data.empresaId
 * @param {'OBRA_PRINCIPAL'|'OBRA_TRABAJO_DIARIO'|'OBRA_ADICIONAL'|'OBRA_TAREA_LEVE'|'OBRA_INDEPENDIENTE'} data.tipoEntidad
 * @param {number} entidadId - ID de la entidad original
 * @param {string} [data.nombreDisplay]
 * @returns {Promise<EntidadFinanciera>}
 */
export const sincronizarEntidad = async (data) => {
  const empresaId = _eid(data.empresaId);
  const payload = { ...data, empresaId };
  try {
    const response = await apiClient.post(`${BASE_URL}/sincronizar`, payload);
    const entidad = response.data || response;
    // Actualizar cache si esta poblado
    if (_cacheEntidades && _cacheEntidades.empresaId === empresaId) {
      const key = _buildKey(entidad.tipoEntidad, entidad.entidadId);
      _cacheEntidades.mapa[key] = entidad;
    }
    return entidad;
  } catch (error) {
    console.error('[EntidadesFinancieras] Error al sincronizar entidad:', error);
    throw error;
  }
};

// -----------------------------------------------------------------------
// ENDPOINT 7: Listar entidades activas de una empresa
// GET /api/v1/entidades-financieras?empresaId={empresaId}
// -----------------------------------------------------------------------
/**
 * Obtiene todas las entidades financieras activas de una empresa.
 * Usa cache local para evitar llamadas repetidas en la misma sesion.
 *
 * @param {number} empresaId
 * @param {boolean} [forzarRecarga=false] - Si true, ignora el cache
 * @returns {Promise<EntidadFinanciera[]>}
 */
export const listarEntidadesFinancieras = async (empresaIdParam, forzarRecarga = false) => {
  const empresaId = _eid(empresaIdParam);

  // Retornar cache si es valido
  if (!forzarRecarga && _cacheEntidades && _cacheEntidades.empresaId === empresaId) {
    return Object.values(_cacheEntidades.mapa);
  }

  try {
    const response = await apiClient.get(BASE_URL, { params: { empresaId } });
    const lista = Array.isArray(response) ? response :
                  Array.isArray(response?.data) ? response.data : [];

    // Construir mapa de cache
    const mapa = {};
    lista.forEach(ef => {
      const key = _buildKey(ef.tipoEntidad, ef.entidadId);
      mapa[key] = ef;
    });
    _cacheEntidades = { empresaId, mapa };

    return lista;
  } catch (error) {
    console.error('[EntidadesFinancieras] Error al listar entidades:', error);
    return [];
  }
};

// -----------------------------------------------------------------------
// Utilitario: obtener entidadFinancieraId desde tipo + ID original
// Usa cache; si no existe en cache llama a /sincronizar (idempotente).
// -----------------------------------------------------------------------
/**
 * Resuelve el entidadFinancieraId para una entidad dada.
 * Estrategia 1: cache local (GET /entidades-financieras).
 * Estrategia 2: POST /sincronizar si no esta en cache.
 *
 * @param {number} empresaId
 * @param {'OBRA_PRINCIPAL'|'OBRA_TRABAJO_DIARIO'|'OBRA_ADICIONAL'|'OBRA_TAREA_LEVE'|'OBRA_INDEPENDIENTE'} tipoEntidad
 * @param {Object} [extraData] - Datos adicionales para /sincronizar si es necesario
 * @returns {Promise<number|null>} - entidadFinancieraId, o null si falla
 */
export const resolverEntidadFinancieraId = async (empresaIdParam, tipoEntidad, entidadId, extraData = {}) => {
  const empresaId = _eid(empresaIdParam);

  // Asegurar cache cargado
  if (!_cacheEntidades || _cacheEntidades.empresaId !== empresaId) {
    await listarEntidadesFinancieras(empresaId);
  }

  const key = _buildKey(tipoEntidad, entidadId);
  if (_cacheEntidades?.mapa?.[key]) {
    return _cacheEntidades.mapa[key].id;
  }

  // No en cache -> sincronizar (idempotente, no genera duplicados)
  try {
    const entidad = await sincronizarEntidad({
      empresaId,
      tipoEntidad,
      entidadId,
      ...extraData
    });
    return entidad?.id ?? null;
  } catch (error) {
    console.error(`[EntidadesFinancieras] No se pudo resolver ID para ${tipoEntidad}#${entidadId}:`, error);
    return null;
  }
};

// -----------------------------------------------------------------------
// ENDPOINT 6: Obtener entidad por ID
// GET /api/v1/entidades-financieras/{id}?empresaId={empresaId}
// -----------------------------------------------------------------------
/**
 * @param {number} id - entidadFinancieraId
 * @param {number} empresaId
 * @returns {Promise<EntidadFinanciera>}
 */
export const obtenerEntidadFinanciera = async (id, empresaIdParam) => {
  const empresaId = _eid(empresaIdParam);
  try {
    const response = await apiClient.get(`${BASE_URL}/${id}`, { params: { empresaId } });
    return response.data || response;
  } catch (error) {
    console.error(`[EntidadesFinancieras] Error al obtener entidad ${id}:`, error);
    throw error;
  }
};

// -----------------------------------------------------------------------
// ENDPOINT 2: Registrar cobro
// POST /api/v1/entidades-financieras/cobros  -> 201 Created
// -----------------------------------------------------------------------
/**
 * Registra un cobro para una entidad financiera.
 *
 * @param {Object} data - CobroRequest
 * @param {number} data.entidadFinancieraId
 * @param {number} data.empresaId
 * @param {number} data.monto - Decimal > 0
 * @param {string} data.fechaCobro - "yyyy-MM-dd"
 * @param {string} [data.metodoPago]
 * @param {string} [data.referencia]
 * @param {string} [data.notas]
 * @param {string} [data.creadoPor]
 * @returns {Promise<CobroEntidad>}
 */
export const registrarCobro = async (data) => {
  const empresaId = _eid(data.empresaId);
  const payload = { ...data, empresaId };
  try {
    const response = await apiClient.post(`${BASE_URL}/cobros`, payload);
    return response.data || response;
  } catch (error) {
    console.error('[EntidadesFinancieras] Error al registrar cobro:', error);
    throw error;
  }
};

// -----------------------------------------------------------------------
// ENDPOINT 3: Obtener cobros de una entidad
// GET /api/v1/entidades-financieras/{entidadFinancieraId}/cobros?empresaId={empresaId}
// -----------------------------------------------------------------------
/**
 * Retorna cobros ordenados por fechaCobro DESC.
 * Nunca retorna 404; retorna [] si no hay cobros.
 *
 * @param {number} entidadFinancieraId
 * @param {number} empresaId
 * @returns {Promise<CobroEntidad[]>}
 */
export const obtenerCobrosEntidad = async (entidadFinancieraId, empresaIdParam) => {
  const empresaId = _eid(empresaIdParam);
  try {
    const response = await apiClient.get(
      `${BASE_URL}/${entidadFinancieraId}/cobros`,
      { params: { empresaId } }
    );
    const data = Array.isArray(response) ? response :
                 Array.isArray(response?.data) ? response.data : [];
    return data;
  } catch (error) {
    console.error(`[EntidadesFinancieras] Error al obtener cobros de entidad ${entidadFinancieraId}:`, error);
    return [];
  }
};

// -----------------------------------------------------------------------
// ENDPOINT 4: Obtener total cobrado
// GET /api/v1/entidades-financieras/{entidadFinancieraId}/total-cobrado?empresaId={empresaId}
// -----------------------------------------------------------------------
/**
 * Retorna el total cobrado como BigDecimal (numero).
 * Retorna 0 si no hay cobros.
 *
 * @param {number} entidadFinancieraId
 * @param {number} empresaId
 * @returns {Promise<number>}
 */
export const obtenerTotalCobradoEntidad = async (entidadFinancieraId, empresaIdParam) => {
  const empresaId = _eid(empresaIdParam);
  try {
    const response = await apiClient.get(
      `${BASE_URL}/${entidadFinancieraId}/total-cobrado`,
      { params: { empresaId } }
    );
    const raw = response?.data ?? response;
    return parseFloat(raw) || 0;
  } catch (error) {
    console.error(`[EntidadesFinancieras] Error al obtener total cobrado de ${entidadFinancieraId}:`, error);
    return 0;
  }
};

// -----------------------------------------------------------------------
// ENDPOINT 5: Estadisticas multiples
// POST /api/v1/entidades-financieras/estadisticas-multiples
// -----------------------------------------------------------------------
/**
 * Obtiene estadisticas financieras de multiples entidades en una sola llamada.
 * IDs no validos son ignorados silenciosamente.
 * Nunca retorna 404.
 *
 * @param {number} empresaId
 * @param {number[]} entidadesFinancierasIds - Array de entidadFinancieraId
 * @returns {Promise<EstadisticasEntidad[]>}
 */
export const obtenerEstadisticasMultiples = async (empresaIdParam, entidadesFinancierasIds) => {
  const empresaId = _eid(empresaIdParam);
  if (!entidadesFinancierasIds || entidadesFinancierasIds.length === 0) {
    return [];
  }

  try {
    const response = await apiClient.post(`${BASE_URL}/estadisticas-multiples`, {
      empresaId,
      entidadesFinancierasIds
    });
    const data = Array.isArray(response) ? response :
                 Array.isArray(response?.data) ? response.data : [];
    return data;
  } catch (error) {
    console.error('[EntidadesFinancieras] Error al obtener estadisticas multiples:', error);
    return [];
  }
};

// -----------------------------------------------------------------------
// ENDPOINT 8: Migrar datos existentes (administrativo, una sola vez)
// POST /api/v1/entidades-financieras/migrar?empresaId={empresaId}
// -----------------------------------------------------------------------
/**
 * Popula las filas iniciales de entidades_financieras para una empresa.
 * Ejecutar UNA SOLA VEZ tras el primer deploy.
 *
 * @param {number} empresaId
 * @returns {Promise<{mensaje: string, totalProcesados: number, empresaId: number}>}
 */
export const migrarEntidadesFinancieras = async (empresaIdParam) => {
  const empresaId = _eid(empresaIdParam);
  try {
    const response = await apiClient.post(`${BASE_URL}/migrar`, null, {
      params: { empresaId }
    });
    return response.data || response;
  } catch (error) {
    console.error('[EntidadesFinancieras] Error en migracion:', error);
    throw error;
  }
};

// -----------------------------------------------------------------------
// Helpers de clasificacion (mismo criterio que el backend)
// -----------------------------------------------------------------------

/**
 * Clasifica una obra segun si tiene o no presupuestoNoClienteId.
 * @param {Object} obra
 * @returns {string} OBRA_PRINCIPAL | OBRA_INDEPENDIENTE
 */
export const clasificarTipoObra = (obra) => {
  if (obra.presupuestoNoClienteId != null) return OBRA_PRINCIPAL;
  return OBRA_INDEPENDIENTE;
};

/**
 * Determina el tipoEntidad a partir de los flags presentes en la entidad
 * combinada que maneja el frontend (presupuesto seleccionado).
 *
 * @param {Object} entidad - Objeto de presupuesto/obra/trabajo del frontend
 * @returns {string} - Valor de TIPOS_OBRA
 */
export const inferirTipoEntidad = (entidad) => {
  if (entidad._esTrabajoAdicional) return OBRA_TAREA_LEVE;
  if (entidad._esTrabajoExtra || entidad.esTrabajoExtra) return OBRA_ADICIONAL;
  if (entidad.esObraIndependiente) return OBRA_INDEPENDIENTE;
  // Si tiene tipoPresupuesto explícito, usar el mapeo directo
  if (entidad.tipoPresupuesto) return tipoObraDesdePresupuesto(entidad.tipoPresupuesto);
  return OBRA_PRINCIPAL;
};

// -----------------------------------------------------------------------
// Funcion de alto nivel: cargar estadisticas para un conjunto de entidades
// Combina listarEntidadesFinancieras + obtenerEstadisticasMultiples
// -----------------------------------------------------------------------
/**
 * Obtiene estadisticas financieras para un array de entidades del frontend.
 * Resuelve automaticamente el entidadFinancieraId de cada una usando cache.
 *
 * @param {number} empresaId
 * @param {Array} entidades - Array de objetos con { id, obraId, esObraIndependiente, _esTrabajoAdicional, ... }
 * @returns {Promise<EstadisticasEntidad[]>}
 */
export const cargarEstadisticasParaEntidades = async (empresaIdParam, entidades) => {
  const empresaId = _eid(empresaIdParam);
  if (!entidades || entidades.length === 0) return [];

  // Asegurar cache de entidades financieras
  await listarEntidadesFinancieras(empresaId);

  // Resolver entidadFinancieraId para cada entidad
  const resolucionesPromises = entidades.map(async (entidad) => {
    const tipoEntidad = inferirTipoEntidad(entidad);

    // entidadId = ID original en la tabla correspondiente
    // Obras (principales, independientes, trabajo diario) usan obraId; adicionales/leves usan su propio id
    const esObra = tipoEntidad === OBRA_PRINCIPAL ||
                   tipoEntidad === OBRA_TRABAJO_DIARIO ||
                   tipoEntidad === OBRA_INDEPENDIENTE;
    const entidadId = esObra
      ? (entidad.obraId || entidad.direccionObraId || entidad.id)
      : entidad.id;

    const efId = await resolverEntidadFinancieraId(empresaId, tipoEntidad, entidadId, {
      nombreDisplay: entidad.nombreObra || entidad.nombre || null,
      presupuestoNoClienteId: entidad.presupuestoNoClienteId ?? null
    });

    return { entidad, tipoEntidad, entidadId, efId };
  });

  const resoluciones = await Promise.all(resolucionesPromises);

  // Filtrar las que no se pudieron resolver
  const validas = resoluciones.filter(r => r.efId != null);
  if (validas.length === 0) return [];

  const ids = validas.map(r => r.efId);
  const estadisticas = await obtenerEstadisticasMultiples(empresaId, ids);

  return estadisticas;
};
