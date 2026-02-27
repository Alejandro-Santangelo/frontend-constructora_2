/**
 * Constantes de tipos de Obra / tipoEntidad financiero
 *
 * Los valores de string son los exactos que usa el backend en el sistema
 * de entidades financieras (/api/v1/entidades-financieras).
 * NO modificar sin coordinar con backend.
 *
 * Relación presupuesto → obra:
 *
 *   PRESUPUESTO_PRINCIPAL       (TRADICIONAL)    → OBRA_PRINCIPAL
 *   PRESUPUESTO_TRABAJO_DIARIO  (TRABAJO_DIARIO)  → OBRA_TRABAJO_DIARIO
 *   PRESUPUESTO_ADICIONAL_OBRA  (TRABAJO_EXTRA)   → OBRA_ADICIONAL
 *   PRESUPUESTO_TAREA_LEVE      (TAREA_LEVE)      → OBRA_TAREA_LEVE
 *   (creada manualmente, sin presupuesto)          → OBRA_INDEPENDIENTE
 */

// ==================== TIPOS DE OBRA (valores backend) ====================
export const TIPOS_OBRA = {
  /** Obra generada al aprobar un presupuesto TRADICIONAL */
  OBRA_PRINCIPAL:      'OBRA_PRINCIPAL',

  /** Obra generada automáticamente desde un presupuesto TRABAJO_DIARIO */
  OBRA_TRABAJO_DIARIO: 'OBRA_TRABAJO_DIARIO',

  /** Trabajo adicional sobre obra existente (desde presupuesto TRABAJO_EXTRA) */
  OBRA_ADICIONAL:      'TRABAJO_EXTRA',

  /** Tarea leve sobre obra existente (desde presupuesto TAREA_LEVE) */
  OBRA_TAREA_LEVE:     'TRABAJO_ADICIONAL',

  /** Obra creada manualmente, sin presupuesto asociado */
  OBRA_INDEPENDIENTE:  'OBRA_INDEPENDIENTE',
};

// ==================== ALIASES SEMÁNTICOS ====================
// Se usan en lugar de strings literales para evitar typos y
// para dejar claro el contrato con el backend.

/** Obra formal generada al aprobar un presupuesto principal (TRADICIONAL). */
export const OBRA_PRINCIPAL      = TIPOS_OBRA.OBRA_PRINCIPAL;      // 'OBRA_PRINCIPAL'

/** Obra rápida generada automáticamente desde un presupuesto de trabajo diario. */
export const OBRA_TRABAJO_DIARIO = TIPOS_OBRA.OBRA_TRABAJO_DIARIO; // 'OBRA_TRABAJO_DIARIO'

/** Trabajo adicional sobre una obra existente (tipoEntidad: 'TRABAJO_EXTRA'). */
export const OBRA_ADICIONAL      = TIPOS_OBRA.OBRA_ADICIONAL;      // 'TRABAJO_EXTRA'

/** Tarea leve sobre una obra existente (tipoEntidad: 'TRABAJO_ADICIONAL'). */
export const OBRA_TAREA_LEVE     = TIPOS_OBRA.OBRA_TAREA_LEVE;    // 'TRABAJO_ADICIONAL'

/** Obra creada manualmente sin presupuesto asociado. */
export const OBRA_INDEPENDIENTE  = TIPOS_OBRA.OBRA_INDEPENDIENTE;  // 'OBRA_INDEPENDIENTE'


// ==================== RELACIÓN PRESUPUESTO → OBRA ====================
/**
 * Dado un tipoPresupuesto, devuelve el tipoEntidad (obra) que genera.
 * Útil para el payload de sincronización con /api/v1/entidades-financieras.
 *
 * @param {string} tipoPresupuesto - Valor de TIPOS_PRESUPUESTO
 * @returns {string} tipoObra - Valor de TIPOS_OBRA
 */
export const tipoObraDesdePresupuesto = (tipoPresupuesto) => {
  const mapa = {
    TRADICIONAL:    TIPOS_OBRA.OBRA_PRINCIPAL,
    TRABAJO_DIARIO: TIPOS_OBRA.OBRA_TRABAJO_DIARIO,
    TRABAJO_EXTRA:  TIPOS_OBRA.OBRA_ADICIONAL,
    TAREA_LEVE:     TIPOS_OBRA.OBRA_TAREA_LEVE,
  };
  return mapa[tipoPresupuesto] ?? TIPOS_OBRA.OBRA_INDEPENDIENTE;
};


// ==================== CONFIGURACIÓN VISUAL ====================
export const OBRA_CONFIG = {
  [TIPOS_OBRA.OBRA_PRINCIPAL]: {
    label:      'Obra Principal',
    labelCorto: 'Principal',
    emoji:      '🏗️',
    color:      '#2196f3',
    badgeClass: 'bg-primary',
    esHija:     false,
  },
  [TIPOS_OBRA.OBRA_TRABAJO_DIARIO]: {
    label:      'Obra Trabajo Diario',
    labelCorto: 'Trabajo Diario',
    emoji:      '📅',
    color:      '#4caf50',
    badgeClass: 'bg-success',
    esHija:     false,
  },
  [TIPOS_OBRA.OBRA_ADICIONAL]: {
    label:      'Adicional de Obra',
    labelCorto: 'Adicional',
    emoji:      '🔧',
    color:      '#ff9800',
    badgeClass: 'bg-warning text-dark',
    esHija:     true,
  },
  [TIPOS_OBRA.OBRA_TAREA_LEVE]: {
    label:      'Tarea Leve',
    labelCorto: 'Tarea Leve',
    emoji:      '📋',
    color:      '#9c27b0',
    badgeClass: 'bg-purple text-white',
    esHija:     true,
  },
  [TIPOS_OBRA.OBRA_INDEPENDIENTE]: {
    label:      'Obra Independiente',
    labelCorto: 'Independiente',
    emoji:      '🔨',
    color:      '#607d8b',
    badgeClass: 'bg-secondary',
    esHija:     false,
  },
};

/**
 * Devuelve la configuración visual de un tipo de obra.
 * @param {string} tipoObra - Valor de TIPOS_OBRA
 * @returns {Object}
 */
export const getConfigObra = (tipoObra) =>
  OBRA_CONFIG[tipoObra] ?? OBRA_CONFIG[TIPOS_OBRA.OBRA_INDEPENDIENTE];
