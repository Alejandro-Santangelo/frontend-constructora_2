/**
 * Estados de Obras y Presupuestos (sincronizados 1:1 por el backend)
 *
 * ⚠️ IMPORTANTE: El backend sincroniza automáticamente estos estados
 * entre Obra ↔ Presupuesto. NO modificar sin coordinar con backend.
 *
 * Total: 10 estados disponibles
 */

// ==================== ESTADOS ====================
export const ESTADOS = {
  BORRADOR:         'BORRADOR',           // Estado inicial
  A_ENVIAR:         'A_ENVIAR',           // Listo para enviar al cliente
  ENVIADO:          'ENVIADO',            // Enviado al cliente
  MODIFICADO:       'MODIFICADO',         // Modificado después de enviado
  APROBADO:         'APROBADO',           // Aprobado por cliente
  OBRA_A_CONFIRMAR: 'OBRA_A_CONFIRMAR',   // Pendiente de confirmación
  EN_EJECUCION:     'EN_EJECUCION',       // 🏗️ Obra en ejecución
  SUSPENDIDA:       'SUSPENDIDA',         // Temporalmente suspendida
  TERMINADO:        'TERMINADO',          // Finalizado
  CANCELADO:        'CANCELADO',          // Cancelado
};

// ==================== CONFIGURACIÓN VISUAL ====================
export const ESTADO_CONFIG = {
  [ESTADOS.BORRADOR]: {
    label: 'Borrador',
    emoji: '📝',
    color: '#6c757d',
    badgeClass: 'bg-secondary',
  },
  [ESTADOS.A_ENVIAR]: {
    label: 'A Enviar',
    emoji: '📤',
    color: '#28a745',
    badgeClass: 'bg-success',
  },
  [ESTADOS.ENVIADO]: {
    label: 'Enviado',
    emoji: '📬',
    color: '#17a2b8',
    badgeClass: 'bg-info',
  },
  [ESTADOS.MODIFICADO]: {
    label: 'Modificado',
    emoji: '✏️',
    color: '#ffc107',
    badgeClass: 'bg-warning text-dark',
  },
  [ESTADOS.APROBADO]: {
    label: 'Aprobado',
    emoji: '✅',
    color: '#28a745',
    badgeClass: 'bg-success',
  },
  [ESTADOS.OBRA_A_CONFIRMAR]: {
    label: 'Obra a Confirmar',
    emoji: '⏳',
    color: '#fd7e14',
    badgeClass: 'bg-warning',
  },
  [ESTADOS.EN_EJECUCION]: {
    label: 'En Ejecución',
    emoji: '🏗️',
    color: '#007bff',
    badgeClass: 'bg-primary',
  },
  [ESTADOS.SUSPENDIDA]: {
    label: 'Suspendida',
    emoji: '⏸️',
    color: '#dc3545',
    badgeClass: 'bg-danger',
  },
  [ESTADOS.TERMINADO]: {
    label: 'Terminado',
    emoji: '🏁',
    color: '#343a40',
    badgeClass: 'bg-dark',
  },
  [ESTADOS.CANCELADO]: {
    label: 'Cancelado',
    emoji: '❌',
    color: '#dc3545',
    badgeClass: 'bg-danger',
  },
};

// ==================== HELPERS ====================

/**
 * Formatea un estado para mostrar en UI
 * @param {string} estado - Estado a formatear
 * @returns {string} Texto formateado
 */
export const formatEstado = (estado) => {
  const config = ESTADO_CONFIG[estado];
  return config ? config.label : estado || '-';
};

/**
 * Obtiene la clase CSS de badge para un estado
 * @param {string} estado - Estado
 * @returns {string} Clase CSS
 */
export const getBadgeClass = (estado) => {
  const config = ESTADO_CONFIG[estado];
  return config ? config.badgeClass : 'bg-secondary';
};

/**
 * Obtiene el emoji para un estado
 * @param {string} estado - Estado
 * @returns {string} Emoji
 */
export const getEmoji = (estado) => {
  const config = ESTADO_CONFIG[estado];
  return config ? config.emoji : '📄';
};

/**
 * Verifica si un estado permite modificaciones
 * @param {string} estado - Estado a verificar
 * @returns {boolean} True si permite modificaciones
 */
export const esModificable = (estado) => {
  return [
    ESTADOS.BORRADOR,
    ESTADOS.A_ENVIAR,
    ESTADOS.MODIFICADO,
  ].includes(estado);
};

/**
 * Verifica si un estado está activo (no finalizado ni cancelado)
 * @param {string} estado - Estado a verificar
 * @returns {boolean} True si está activo
 */
export const esActivo = (estado) => {
  return ![ESTADOS.TERMINADO, ESTADOS.CANCELADO].includes(estado);
};

/**
 * Estados que representan obras/presupuestos en ejecución
 * @returns {string[]} Array de estados
 */
export const getEstadosEnEjecucion = () => {
  return [ESTADOS.APROBADO, ESTADOS.EN_EJECUCION];
};

/**
 * Estados que representan obras/presupuestos finalizados
 * @returns {string[]} Array de estados
 */
export const getEstadosFinalizados = () => {
  return [ESTADOS.TERMINADO, ESTADOS.CANCELADO];
};

/**
 * Estados que muestran avance activo
 * @returns {string[]} Array de estados
 */
export const getEstadosActivos = () => {
  return [
    ESTADOS.APROBADO,
    ESTADOS.EN_EJECUCION,
    ESTADOS.TERMINADO,
  ];
};
