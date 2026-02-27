/**
 * Constantes y configuración para los 4 tipos de PresupuestoNoCliente
 * Todos se almacenan en la misma tabla: presupuestos_no_cliente
 */

// ==================== TIPOS DE PRESUPUESTO ====================
// Valores exactos que acepta el backend (NO modificar sin coordinar con backend)
export const TIPOS_PRESUPUESTO = {
  TRADICIONAL: 'TRADICIONAL',           // Obra nueva - Presupuesto formal
  TRABAJO_DIARIO: 'TRABAJO_DIARIO',     // Obra rápida - Cliente auto-generado
  TRABAJO_EXTRA: 'TRABAJO_EXTRA',       // Trabajo adicional vinculado a obra
  TAREA_LEVE: 'TAREA_LEVE'             // Tarea rápida vinculada a obra o trabajo extra
};

// ==================== ALIASES SEMÁNTICOS ====================
// Nombres descriptivos para usar en el código del frontend.
// Sus valores corresponden 1:1 con los de TIPOS_PRESUPUESTO.
// El backend debe declarar el mismo enum con estos mismos valores de string.
//
//   PRESUPUESTO_PRINCIPAL       → "TRADICIONAL"
//   PRESUPUESTO_TRABAJO_DIARIO  → "TRABAJO_DIARIO"
//   PRESUPUESTO_ADICIONAL_OBRA  → "TRABAJO_EXTRA"
//   PRESUPUESTO_TAREA_LEVE      → "TAREA_LEVE"

/** Presupuesto principal para obra nueva. Estado inicial: BORRADOR. Genera obra al aprobar. */
export const PRESUPUESTO_PRINCIPAL      = TIPOS_PRESUPUESTO.TRADICIONAL;

/** Trabajo diario – obra rápida. Estado inicial: APROBADO (auto). Genera obra inmediatamente. */
export const PRESUPUESTO_TRABAJO_DIARIO = TIPOS_PRESUPUESTO.TRABAJO_DIARIO;

/** Adicional sobre obra existente. Estado inicial: BORRADOR. NO genera obra nueva. */
export const PRESUPUESTO_ADICIONAL_OBRA = TIPOS_PRESUPUESTO.TRABAJO_EXTRA;

/** Tarea leve sobre obra existente. Estado inicial: APROBADO (auto). NO genera obra nueva. */
export const PRESUPUESTO_TAREA_LEVE     = TIPOS_PRESUPUESTO.TAREA_LEVE;

// ==================== CONFIGURACIÓN VISUAL Y COMPORTAMIENTO ====================
export const PRESUPUESTO_CONFIG = {
  TRADICIONAL: {
    // Estilos visuales
    color: '#2196f3',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    badgeClass: 'bg-primary',
    icon: 'fa-building',
    emoji: '🏗️',

    // Labels
    label: 'Obra Principal',
    labelCorto: 'Obra Principal',
    descripcion: 'Presupuesto formal para obra nueva sin cliente previo',

    // Comportamiento
    autoAprobar: false,                  // Requiere aprobación manual
    requiereObraId: false,               // NO está vinculado a obra (la crea al aprobar)
    requiereClienteId: false,            // Cliente opcional
    requiereTrabajoExtraId: false,       // NO es hijo de trabajo extra
    crearObraAlAprobar: true,            // Genera obra al aprobar
    esHijo: false,                       // ES PADRE
    esPadre: true,
    puedeSerPadre: true,                 // Puede tener hijos (trabajos extra, tareas)

    // Estados permitidos
    estadosPermitidos: [
      'BORRADOR',
      'A_ENVIAR',
      'ENVIADO',
      'MODIFICADO',
      'APROBADO',
      'EN_EJECUCION',
      'SUSPENDIDA',
      'TERMINADO',
      'CANCELADO'
    ],
    estadoInicial: 'BORRADOR'
  },

  TRABAJO_DIARIO: {
    // Estilos visuales
    color: '#4caf50',
    gradient: 'linear-gradient(135deg, #66bb6a 0%, #43a047 100%)',
    badgeClass: 'bg-success',
    icon: 'fa-calendar-day',
    emoji: '📅',

    // Labels
    label: 'Trabajo Diario - Nuevo Cliente',
    labelCorto: 'Trabajo Diario - Nuevo Cliente',
    descripcion: 'Obra rápida con cliente auto-generado desde dirección',

    // Comportamiento
    autoAprobar: true,                   // Auto-aprobar al crear
    requiereObraId: false,               // NO está vinculado a obra
    requiereClienteId: false,            // Cliente se crea automáticamente
    requiereTrabajoExtraId: false,       // NO es hijo de trabajo extra
    crearObraAlAprobar: true,            // Genera obra al aprobar (automático)
    esHijo: false,                       // ES PADRE
    esPadre: true,
    puedeSerPadre: true,                 // Puede tener hijos

    // Estados permitidos
    estadosPermitidos: [
      'APROBADO',                        // Se crea directamente aprobado
      'EN_EJECUCION',
      'SUSPENDIDA',
      'TERMINADO',
      'CANCELADO'
    ],
    estadoInicial: 'APROBADO'            // ← Auto-aprobado
  },

  TRABAJO_EXTRA: {
    // Estilos visuales
    color: '#ff9800',
    gradient: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
    badgeClass: 'bg-warning text-dark',
    icon: 'fa-wrench',
    emoji: '🔧',

    // Labels
    label: 'Adicional Obra',
    labelCorto: 'Adicional Obra',
    descripcion: 'Trabajo adicional vinculado a una obra existente',

    // Comportamiento
    autoAprobar: false,                  // Requiere aprobación
    requiereObraId: true,                // ← OBLIGATORIO: vinculado a obra
    requiereClienteId: false,            // Cliente heredado de obra
    requiereTrabajoExtraId: false,       // NO es hijo de otro trabajo extra
    crearObraAlAprobar: false,           // NO genera obra (se vincula a existente)
    esHijo: true,                        // ES HIJO de obra
    esPadre: true,                       // PUEDE SER PADRE de tareas leves
    puedeSerPadre: true,                 // Puede tener tareas leves como hijas

    // Estados permitidos
    estadosPermitidos: [
      'BORRADOR',
      'ENVIADO',
      'APROBADO',
      'EN_EJECUCION',
      'SUSPENDIDA',
      'TERMINADO',
      'CANCELADO'
    ],
    estadoInicial: 'BORRADOR'
  },

  TAREA_LEVE: {
    // Estilos visuales
    color: '#9c27b0',
    gradient: 'linear-gradient(135deg, #af52bf 0%, #8e24aa 100%)',
    badgeClass: 'bg-purple text-white',
    icon: 'fa-clipboard-list',
    emoji: '📋',

    // Labels
    label: 'Tarea Leve',
    labelCorto: 'Tarea Leve',
    descripcion: 'Tarea rápida vinculada a obra o trabajo extra',

    // Comportamiento
    autoAprobar: true,                   // Auto-aprobar al crear (ejecución inmediata)
    requiereObraId: true,                // ← OBLIGATORIO: vinculado a obra
    requiereClienteId: false,            // Cliente heredado
    requiereTrabajoExtraId: false,       // OPCIONAL: si es nieta de trabajo extra
    crearObraAlAprobar: false,           // NO genera obra
    esHijo: true,                        // ES HIJO (de obra o trabajo extra)
    esPadre: false,                      // NO puede tener hijos
    puedeSerPadre: false,                // NO puede tener hijos

    // Estados permitidos
    estadosPermitidos: [
      'APROBADO',                        // Se crea directamente aprobado
      'EN_EJECUCION',
      'TERMINADO',
      'CANCELADO'
    ],
    estadoInicial: 'APROBADO'            // ← Auto-aprobado
  }
};

// ==================== HELPERS ====================

/**
 * Obtener configuración de un tipo con fallback
 * @param {string} tipo - Tipo de presupuesto
 * @returns {Object} Configuración del tipo
 */
export const getConfigPresupuesto = (tipo) => {
  return PRESUPUESTO_CONFIG[tipo] || PRESUPUESTO_CONFIG.TRADICIONAL;
};

/**
 * Determinar nivel jerárquico de un presupuesto
 * @param {Object} presupuesto - Objeto presupuesto
 * @returns {string} 'PADRE' | 'HIJO' | 'NIETO'
 */
export const getNivelJerarquico = (presupuesto) => {
  const { tipoPresupuesto, obraId, trabajoExtraId } = presupuesto;

  // PADRE: TRADICIONAL o TRABAJO_DIARIO (no tienen obraId hasta que aprueban)
  if (tipoPresupuesto === TIPOS_PRESUPUESTO.TRADICIONAL ||
      tipoPresupuesto === TIPOS_PRESUPUESTO.TRABAJO_DIARIO) {
    return 'PADRE';
  }

  // NIETO: TAREA_LEVE con trabajoExtraId
  if (tipoPresupuesto === TIPOS_PRESUPUESTO.TAREA_LEVE && trabajoExtraId) {
    return 'NIETO';
  }

  // HIJO: TRABAJO_EXTRA o TAREA_LEVE sin trabajoExtraId
  if (tipoPresupuesto === TIPOS_PRESUPUESTO.TRABAJO_EXTRA ||
      (tipoPresupuesto === TIPOS_PRESUPUESTO.TAREA_LEVE && obraId && !trabajoExtraId)) {
    return 'HIJO';
  }

  return 'DESCONOCIDO';
};

/**
 * Validar campos requeridos según tipo
 * @param {Object} datos - Datos del presupuesto
 * @returns {Object} { valido: boolean, errores: string[] }
 */
export const validarDatosPresupuesto = (datos) => {
  const { tipoPresupuesto } = datos;
  const config = getConfigPresupuesto(tipoPresupuesto);
  const errores = [];

  // Validar obraId si es requerido
  if (config.requiereObraId && !datos.obraId) {
    errores.push(`${config.label} requiere estar vinculado a una obra`);
  }

  // Validar clienteId si es requerido
  if (config.requiereClienteId && !datos.clienteId) {
    errores.push(`${config.label} requiere un cliente`);
  }

  // Validar dirección (siempre requerida)
  if (!datos.direccionObraCalle || !datos.direccionObraAltura) {
    errores.push('Calle y Altura son campos obligatorios');
  }

  return {
    valido: errores.length === 0,
    errores
  };
};

/**
 * Renderizar badge HTML para un tipo
 * @param {string} tipo - Tipo de presupuesto
 * @param {boolean} incluirTexto - Incluir texto o solo emoji
 * @returns {string} HTML del badge
 */
export const renderBadgePresupuesto = (tipo, incluirTexto = true) => {
  const config = getConfigPresupuesto(tipo);
  const texto = incluirTexto ? ` ${config.labelCorto}` : '';
  return `<span class="badge ${config.badgeClass} ms-1" style="font-size: 0.75em;">${config.emoji}${texto}</span>`;
};

/**
 * Obtener color de borde para card según tipo
 * @param {string} tipo - Tipo de presupuesto
 * @param {string} nivel - Nivel jerárquico ('PADRE' | 'HIJO' | 'NIETO')
 * @returns {string} Color hexadecimal
 */
export const getColorBorde = (tipo, nivel = 'PADRE') => {
  const config = getConfigPresupuesto(tipo);

  // Ajustar intensidad según nivel
  if (nivel === 'NIETO') {
    // Más oscuro para nietos
    return config.color.replace(/\d+/g, (match) => Math.max(0, parseInt(match) - 40));
  }

  return config.color;
};

/**
 * Determinar si un tipo puede tener hijos
 * @param {string} tipo - Tipo de presupuesto
 * @returns {boolean}
 */
export const puedeSerPadre = (tipo) => {
  const config = getConfigPresupuesto(tipo);
  return config.puedeSerPadre === true;
};

/**
 * Obtener tipos permitidos como hijos de un tipo padre
 * @param {string} tipoPadre - Tipo del presupuesto padre
 * @returns {string[]} Array de tipos permitidos como hijos
 */
export const getTiposHijosPermitidos = (tipoPadre) => {
  if (tipoPadre === TIPOS_PRESUPUESTO.TRADICIONAL ||
      tipoPadre === TIPOS_PRESUPUESTO.TRABAJO_DIARIO) {
    // Los padres pueden tener trabajos extra y tareas leves
    return [TIPOS_PRESUPUESTO.TRABAJO_EXTRA, TIPOS_PRESUPUESTO.TAREA_LEVE];
  }

  if (tipoPadre === TIPOS_PRESUPUESTO.TRABAJO_EXTRA) {
    // Los trabajos extra solo pueden tener tareas leves
    return [TIPOS_PRESUPUESTO.TAREA_LEVE];
  }

  // Las tareas leves no pueden tener hijos
  return [];
};

// ==================== ESTILOS CSS CUSTOM ====================
export const CUSTOM_STYLES = `
  .badge.bg-purple {
    background-color: #9c27b0 !important;
    color: white !important;
  }

  .card-tarea-leve-hija {
    border-left: 4px solid #9c27b0;
    margin-left: 0;
  }

  .card-tarea-leve-nieta {
    border-left: 4px solid #7b1fa2;
    margin-left: 2rem;
    background-color: #fafafa;
  }

  .badge-nivel-jerarquico {
    font-size: 0.7em;
    padding: 2px 6px;
    margin-left: 4px;
  }
`;

export default {
  TIPOS_PRESUPUESTO,
  PRESUPUESTO_CONFIG,
  getConfigPresupuesto,
  getNivelJerarquico,
  validarDatosPresupuesto,
  renderBadgePresupuesto,
  getColorBorde,
  puedeSerPadre,
  getTiposHijosPermitidos,
  CUSTOM_STYLES
};
