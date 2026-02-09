/**
 * Helper para construir payloads de Trabajos Extra
 *
 * Los trabajos extra NO usan tablas relacionales (asignaciones_profesional_obra, etc.)
 * TODO se guarda en itemsCalculadora[] del trabajo extra.
 *
 * Este helper asegura que TODOS los campos obligatorios estén presentes
 * según la especificación del backend.
 */

/**
 * Construye el payload completo para actualizar un trabajo extra
 *
 * @param {Object} trabajoExtraActual - Trabajo extra completo del backend
 * @param {Object} opciones - Opciones de actualización
 * @param {Array} opciones.profesionalesSeleccionados - Profesionales a asignar/actualizar
 * @param {Array} opciones.materialesSeleccionados - Materiales a asignar/actualizar
 * @param {Array} opciones.gastosSeleccionados - Gastos a asignar/actualizar
 * @param {Array} opciones.dias - Días/etapas del trabajo extra
 * @param {boolean} opciones.reemplazarCompleto - Si true, reemplaza todo; si false, merge con existente
 * @returns {Object} Payload completo listo para PUT
 */
export function construirPayloadTrabajoExtra(trabajoExtraActual, opciones = {}) {
  const {
    profesionalesSeleccionados = null,
    materialesSeleccionados = null,
    gastosSeleccionados = null,
    dias = null,
    reemplazarCompleto = false
  } = opciones;

  // Construir items nuevos o actualizar existentes
  let itemsCalculadora = [];

  if (reemplazarCompleto) {
    // Reemplazar completamente - construir desde cero
    itemsCalculadora = construirItemsDesdeSeleccion({
      profesionalesSeleccionados,
      materialesSeleccionados,
      gastosSeleccionados
    });
  } else {
    // Merge con items existentes
    itemsCalculadora = mergeItemsCalculadora(
      trabajoExtraActual.itemsCalculadora || [],
      {
        profesionalesSeleccionados,
        materialesSeleccionados,
        gastosSeleccionados
      }
    );
  }

  // Construir payload final
  return {
    // Campos básicos del trabajo extra (preservar del original)
    obraId: trabajoExtraActual.obraId,
    nombre: trabajoExtraActual.nombre,
    descripcion: trabajoExtraActual.descripcion || '',
    fechaProbableInicio: trabajoExtraActual.fechaProbableInicio,
    vencimiento: trabajoExtraActual.vencimiento,
    tiempoEstimadoTerminacion: trabajoExtraActual.tiempoEstimadoTerminacion,

    // Items calculadora (profesionales, materiales, gastos)
    itemsCalculadora: itemsCalculadora,

    // Días/etapas
    dias: dias !== null ? dias : (trabajoExtraActual.dias || []),

    // Configuración de honorarios (preservar del original)
    honorariosOtrosCostosActivo: trabajoExtraActual.honorariosOtrosCostosActivo,
    honorariosOtrosCostosValor: trabajoExtraActual.honorariosOtrosCostosValor,
    honorariosOtrosCostosTipo: trabajoExtraActual.honorariosOtrosCostosTipo,
    mayoresCostosOtrosCostosActivo: trabajoExtraActual.mayoresCostosOtrosCostosActivo,
    mayoresCostosOtrosCostosValor: trabajoExtraActual.mayoresCostosOtrosCostosValor,
    mayoresCostosOtrosCostosTipo: trabajoExtraActual.mayoresCostosOtrosCostosTipo
  };
}

/**
 * Construye items calculadora desde las selecciones (reemplazo completo)
 */
function construirItemsDesdeSeleccion({ profesionalesSeleccionados, materialesSeleccionados, gastosSeleccionados }) {
  const items = [];

  // 1. Agrupar profesionales por tipoProfesional
  if (profesionalesSeleccionados && profesionalesSeleccionados.length > 0) {
    const profesionalesPorTipo = agruparProfesionalesPorTipo(profesionalesSeleccionados);

    Object.entries(profesionalesPorTipo).forEach(([tipoProfesional, profesionales]) => {
      items.push(construirItemProfesional(tipoProfesional, profesionales, [], []));
    });
  }

  // 2. Agregar items de materiales (si corresponde implementar)
  if (materialesSeleccionados && materialesSeleccionados.length > 0) {
    // TODO: Implementar cuando se necesite
    console.warn('⚠️ Materiales en trabajo extra aún no implementado');
  }

  // 3. Agregar items de gastos generales (si corresponde implementar)
  if (gastosSeleccionados && gastosSeleccionados.length > 0) {
    // TODO: Implementar cuando se necesite
    console.warn('⚠️ Gastos generales en trabajo extra aún no implementado');
  }

  return items;
}

/**
 * Merge items calculadora existentes con nuevas selecciones
 */
function mergeItemsCalculadora(itemsExistentes, { profesionalesSeleccionados, materialesSeleccionados, gastosSeleccionados }) {
  // Clonar items existentes
  const itemsActualizados = JSON.parse(JSON.stringify(itemsExistentes || []));

  // 1. Actualizar/agregar profesionales
  if (profesionalesSeleccionados !== null) {
    // Agrupar nuevos profesionales por tipo
    const nuevosProfesionalesPorTipo = agruparProfesionalesPorTipo(profesionalesSeleccionados);

    Object.entries(nuevosProfesionalesPorTipo).forEach(([tipoProfesional, profesionales]) => {
      // Buscar si ya existe un item para este tipo
      const itemExistenteIdx = itemsActualizados.findIndex(
        item => item.tipoProfesional === tipoProfesional && !item.esGastoGeneral
      );

      if (itemExistenteIdx >= 0) {
        // Actualizar item existente
        const itemExistente = itemsActualizados[itemExistenteIdx];
        itemsActualizados[itemExistenteIdx] = construirItemProfesional(
          tipoProfesional,
          profesionales,
          itemExistente.materialesLista || [],
          itemExistente.gastosGenerales || []
        );
      } else {
        // Crear nuevo item
        itemsActualizados.push(construirItemProfesional(tipoProfesional, profesionales, [], []));
      }
    });
  }

  // 2. Actualizar materiales (si se proporciona)
  if (materialesSeleccionados !== null) {
    // TODO: Implementar lógica de merge de materiales
    console.warn('⚠️ Merge de materiales en trabajo extra aún no implementado');
  }

  // 3. Actualizar gastos generales (si se proporciona)
  if (gastosSeleccionados !== null) {
    // TODO: Implementar lógica de merge de gastos
    console.warn('⚠️ Merge de gastos en trabajo extra aún no implementado');
  }

  return itemsActualizados;
}

/**
 * Agrupa profesionales por tipoProfesional
 */
function agruparProfesionalesPorTipo(profesionales) {
  const grupos = {};

  profesionales.forEach(prof => {
    // Determinar tipo de profesional (puede venir en diferentes campos)
    const tipo = prof.tipoProfesional || prof.rol || prof.tipo || 'Profesional';

    if (!grupos[tipo]) {
      grupos[tipo] = [];
    }

    grupos[tipo].push(prof);
  });

  return grupos;
}

/**
 * Construye un item de calculadora con profesionales
 *
 * ⚠️ IMPORTANTE: Incluye TODOS los campos obligatorios según especificación backend
 */
function construirItemProfesional(tipoProfesional, profesionales, materialesLista = [], gastosGenerales = []) {
  // Calcular totales del item
  const totalJornales = profesionales.reduce((sum, p) => {
    const cantJornales = Number(p.cantidadJornales || p.cantidad || 0);
    return sum + cantJornales;
  }, 0);

  const importePromedio = profesionales.length > 0
    ? profesionales.reduce((sum, p) => sum + Number(p.valorJornal || p.importeJornal || 0), 0) / profesionales.length
    : 0;

  const subtotalManoObra = profesionales.reduce((sum, p) => {
    return sum + Number(p.subtotal || 0);
  }, 0);

  // Mapear profesionales al formato backend
  const profesionalesMapeados = profesionales.map(prof => ({
    // ✅ CAMPOS OBLIGATORIOS
    rol: prof.rol || prof.tipoProfesional || tipoProfesional,
    nombreCompleto: prof.nombreCompleto || prof.nombre || '',
    cantidadJornales: Number(prof.cantidadJornales || prof.cantidad || 0),
    valorJornal: Number(prof.valorJornal || prof.importeJornal || 0),
    subtotal: Number(prof.subtotal || 0),

    // ⚪ CAMPOS OPCIONALES
    profesionalObraId: prof.id || prof.profesionalObraId || null,
    incluirEnCalculoDias: prof.incluirEnCalculoDias !== false, // Default true
    observaciones: prof.observaciones || null,
    frontendId: prof.frontendId || null
  }));

  // Construir item completo con TODOS los campos obligatorios
  return {
    // Identificación
    tipoProfesional: tipoProfesional,
    descripcion: `${tipoProfesional} - ${profesionales.length} profesional(es)`,

    // ⚠️ FLAGS CRÍTICOS (SIEMPRE REQUERIDOS)
    esModoManual: false,
    esRubroVacio: false,
    esGastoGeneral: false,
    incluirEnCalculoDias: true,
    trabajaEnParalelo: true,

    // Cálculos financieros
    cantidadJornales: totalJornales,
    importeJornal: importePromedio,
    subtotalManoObra: subtotalManoObra,
    total: subtotalManoObra, // Por ahora solo mano de obra

    // Arrays (DEBEN EXISTIR aunque estén vacíos)
    profesionales: profesionalesMapeados,
    materialesLista: materialesLista || [],
    gastosGenerales: gastosGenerales || [],
    jornales: [] // Siempre vacío para trabajos extra
  };
}

/**
 * Valida que el payload tenga todos los campos obligatorios
 *
 * @param {Object} payload - Payload a validar
 * @returns {Array<string>} Array de errores (vacío si válido)
 */
export function validarPayloadTrabajoExtra(payload) {
  const errores = [];

  // Validar estructura base
  if (!payload.obraId) {
    errores.push('obraId es obligatorio');
  }

  if (!payload.nombre) {
    errores.push('nombre es obligatorio');
  }

  if (!Array.isArray(payload.itemsCalculadora)) {
    errores.push('itemsCalculadora debe ser un array');
    return errores;
  }

  // Validar cada item
  payload.itemsCalculadora.forEach((item, index) => {
    // Campos obligatorios del item
    const camposObligatorios = [
      'tipoProfesional',
      'esModoManual',
      'esRubroVacio',
      'esGastoGeneral',
      'cantidadJornales',
      'importeJornal',
      'subtotalManoObra',
      'total',
      'trabajaEnParalelo'
    ];

    camposObligatorios.forEach(campo => {
      if (item[campo] === undefined || item[campo] === null) {
        errores.push(`Item ${index}: ${campo} es obligatorio`);
      }
    });

    // Validar arrays existen
    if (!Array.isArray(item.profesionales)) {
      errores.push(`Item ${index}: profesionales debe ser un array`);
    }

    if (!Array.isArray(item.materialesLista)) {
      errores.push(`Item ${index}: materialesLista debe ser un array`);
    }

    if (!Array.isArray(item.gastosGenerales)) {
      errores.push(`Item ${index}: gastosGenerales debe ser un array`);
    }

    // Validar profesionales
    item.profesionales?.forEach((prof, profIndex) => {
      const camposObligatoriosProf = [
        'rol',
        'nombreCompleto',
        'cantidadJornales',
        'valorJornal',
        'subtotal'
      ];

      camposObligatoriosProf.forEach(campo => {
        if (!prof[campo] && prof[campo] !== 0) {
          errores.push(`Item ${index}, Profesional ${profIndex}: ${campo} es obligatorio`);
        }
      });

      // Validar cálculo de subtotal
      const subtotalCalculado = prof.cantidadJornales * prof.valorJornal;
      if (Math.abs(prof.subtotal - subtotalCalculado) > 0.01) {
        errores.push(
          `Item ${index}, Profesional ${profIndex}: subtotal incorrecto ` +
          `(esperado: ${subtotalCalculado}, recibido: ${prof.subtotal})`
        );
      }
    });
  });

  return errores;
}

/**
 * Mapea profesionales seleccionados desde el modal al formato esperado
 *
 * @param {Array} profesionalesConDatos - Profesionales del modal con cantidades asignadas
 * @returns {Array} Profesionales mapeados con subtotales calculados
 */
export function mapearProfesionalesParaTrabajoExtra(profesionalesConDatos) {
  return profesionalesConDatos.map(prof => {
    const cantidadJornales = Number(prof.cantidadJornales || prof.cantidad || prof.jornalesAsignados || 0);
    const valorJornal = Number(prof.valorJornal || prof.importeJornal || prof.jornal || 0);
    const subtotal = cantidadJornales * valorJornal;

    return {
      // Datos del profesional
      id: prof.id || prof.profesionalObraId,
      profesionalObraId: prof.id || prof.profesionalObraId,
      nombreCompleto: prof.nombreCompleto || prof.nombre || '',
      rol: prof.rol || prof.tipoProfesional || prof.tipo || 'Profesional',
      tipoProfesional: prof.tipoProfesional || prof.rol || prof.tipo || 'Profesional',

      // Cantidades y valores
      cantidadJornales: cantidadJornales,
      valorJornal: valorJornal,
      subtotal: subtotal,

      // Opcionales
      incluirEnCalculoDias: prof.incluirEnCalculoDias !== false,
      observaciones: prof.observaciones || null,
      frontendId: prof.frontendId || null
    };
  });
}

export default {
  construirPayloadTrabajoExtra,
  validarPayloadTrabajoExtra,
  mapearProfesionalesParaTrabajoExtra
};
