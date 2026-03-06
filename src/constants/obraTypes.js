/**
 * Constantes de tipos de Obra (campo tipoOrigen del backend)
 *
 * Los valores de string son los exactos que usa el backend en el campo
 * tipoOrigen de ObraSimpleDTO y ObraResponseDTO.
 * NO modificar sin coordinar con backend.
 *
 * Relación presupuesto → obra (generación automática al aprobar):
 *
 *   PRESUPUESTO PRINCIPAL       → obra.tipoOrigen = 'PRESUPUESTO_PRINCIPAL'
 *   PRESUPUESTO TRABAJO_DIARIO  → obra.tipoOrigen = 'PRESUPUESTO_TRABAJO_DIARIO'
 *   PRESUPUESTO TRABAJO_EXTRA   → obra.tipoOrigen = 'PRESUPUESTO_TRABAJO_EXTRA'
 *   PRESUPUESTO TAREA_LEVE      → obra.tipoOrigen = 'PRESUPUESTO_TAREA_LEVE'
 *   Obra creada manualmente     → obra.tipoOrigen = 'OBRA_MANUAL'
 */

// ==================== TIPOS DE OBRA (valores backend para tipoOrigen) ====================
export const TIPOS_OBRA = {
  /** Obra generada al aprobar un presupuesto PRINCIPAL */
  OBRA_PRINCIPAL:      'PRESUPUESTO_PRINCIPAL',

  /** Obra generada al aprobar un presupuesto TRABAJO_DIARIO */
  OBRA_TRABAJO_DIARIO: 'PRESUPUESTO_TRABAJO_DIARIO',

  /** Trabajo adicional sobre obra existente (desde presupuesto TRABAJO_EXTRA) */
  OBRA_ADICIONAL:      'PRESUPUESTO_TRABAJO_EXTRA',

  /** Tarea leve sobre obra existente (desde presupuesto TAREA_LEVE) */
  OBRA_TAREA_LEVE:     'PRESUPUESTO_TAREA_LEVE',

  /** Obra creada manualmente, sin presupuesto asociado */
  OBRA_INDEPENDIENTE:  'OBRA_MANUAL',
};

// ==================== ALIASES SEMÁNTICOS ====================
// Se usan en lugar de strings literales para evitar typos y
// para dejar claro el contrato con el backend.

/** Obra formal generada al aprobar un presupuesto principal (PRINCIPAL). */
export const OBRA_PRINCIPAL      = TIPOS_OBRA.OBRA_PRINCIPAL;      // 'PRESUPUESTO_PRINCIPAL'

/** Obra rápida generada automáticamente desde un presupuesto de trabajo diario. */
export const OBRA_TRABAJO_DIARIO = TIPOS_OBRA.OBRA_TRABAJO_DIARIO; // 'PRESUPUESTO_TRABAJO_DIARIO'

/** Trabajo adicional sobre una obra existente (desde presupuesto TRABAJO_EXTRA). */
export const OBRA_ADICIONAL      = TIPOS_OBRA.OBRA_ADICIONAL;      // 'PRESUPUESTO_TRABAJO_EXTRA'

/** Tarea leve sobre una obra existente (desde presupuesto TAREA_LEVE). */
export const OBRA_TAREA_LEVE     = TIPOS_OBRA.OBRA_TAREA_LEVE;    // 'PRESUPUESTO_TAREA_LEVE'

/** Obra creada manualmente sin presupuesto asociado. */
export const OBRA_INDEPENDIENTE  = TIPOS_OBRA.OBRA_INDEPENDIENTE;  // 'OBRA_MANUAL'


// ==================== TIPOS PARA SISTEMA DE ENTIDADES FINANCIERAS ====================
/**
 * Valores que acepta el endpoint /api/v1/entidades-financieras/sincronizar
 * ⚠️ IMPORTANTE: NO confundir con tipoOrigen (campo de solo lectura de las obras)
 *
 * TipoEntidadFinanciera (para sincronizar):
 *   - OBRA_PRINCIPAL: Obra que tiene presupuestoNoClienteId
 *   - OBRA_INDEPENDIENTE: Obra sin presupuesto (creada manualmente)
 *   - TRABAJO_EXTRA: Trabajo extra vinculado a obra
 *   - TRABAJO_ADICIONAL: Tarea leve vinculada a obra
 */
export const TIPO_ENTIDAD_FINANCIERA = {
  OBRA_PRINCIPAL:      'OBRA_PRINCIPAL',
  OBRA_INDEPENDIENTE:  'OBRA_INDEPENDIENTE',
  TRABAJO_EXTRA:       'TRABAJO_EXTRA',
  TRABAJO_ADICIONAL:   'TRABAJO_ADICIONAL',
};

/**
 * Mapea una obra a su tipo de entidad financiera según el backend
 * @param {Object} obra - Obra con presupuestoNoClienteId
 * @returns {string} OBRA_PRINCIPAL | OBRA_INDEPENDIENTE
 */
export const getTipoEntidadFinanciera = (obra) => {
  const tienePresupuesto = obra.presupuestoNoClienteId != null ||
                          obra.presupuesto_no_cliente_id != null;
  return tienePresupuesto
    ? TIPO_ENTIDAD_FINANCIERA.OBRA_PRINCIPAL
    : TIPO_ENTIDAD_FINANCIERA.OBRA_INDEPENDIENTE;
};


// ==================== RELACIÓN PRESUPUESTO → OBRA (SOLO PARA REFERENCIA) ====================
/**
 * Dado un tipoPresupuesto, devuelve el tipoEntidad (obra) que genera.
 * Útil para el payload de sincronización con /api/v1/entidades-financieras.
 *
 * @param {string} tipoPresupuesto - Valor de TIPOS_PRESUPUESTO
 * @returns {string} tipoObra - Valor de TIPOS_OBRA
 */
export const tipoObraDesdePresupuesto = (tipoPresupuesto) => {
  const mapa = {
    PRINCIPAL:      TIPOS_OBRA.OBRA_PRINCIPAL,      // ✅ Nuevo valor del backend
    TRADICIONAL:    TIPOS_OBRA.OBRA_PRINCIPAL,      // ⚠️ Backward compatibility (deprecated)
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
