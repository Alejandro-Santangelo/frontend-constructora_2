/**
 * Calcula el total final de un presupuesto restando todos los descuentos configurados.
 *
 * @param {Array}  items       - Array de items del presupuesto. Cada item debe tener:
 *                               total, subtotalJornales, subtotalMateriales,
 *                               honorariosAplicados, mayoresCostosAplicados
 * @param {Object} descuentos  - Objeto de descuentos con la estructura interna del form:
 *                               { jornales, materiales, honorarios, honorariosJornales, ..., mayoresCostos }
 *                               O bien el objeto plano del row con campos flat (descuentosJornalesActivo, etc.)
 * @returns {{ totalSinDescuento, totalDescuentos, totalFinal, detalleDescuentos }}
 */
export function calcularTotalConDescuentosDesdeItems(items = [], descuentos = {}) {
  // ✅ Sumar item.total de cada item (ya incluye base + honorarios + mayores costos calculados en backend)
  const totalSinDescuento = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);

  const baseJornales     = items.reduce((sum, i) => sum + (Number(i.subtotalJornales)      || 0), 0);
  const baseMateriales   = items.reduce((sum, i) => sum + (Number(i.subtotalMateriales)    || 0), 0);
  const baseHonorarios   = items.reduce((sum, i) => sum + (Number(i.honorariosAplicados)   || 0), 0);
  const baseMayoresCostos = items.reduce((sum, i) => sum + (Number(i.mayoresCostosAplicados) || 0), 0);

  let totalDescuentos = 0;
  const detalleDescuentos = [];

  const aplicar = (activo, tipo, valor, base, label) => {
    if (activo === false) return;
    const v = Number(valor || 0);
    if (v <= 0 || base <= 0) return;
    const imp = tipo === 'porcentaje' ? (base * v) / 100 : v;
    totalDescuentos += imp;
    detalleDescuentos.push({ label, importe: imp });
  };

  // Normalizar: acepta tanto el objeto interno del form como el objeto plano del row
  const cfg = normalizarDescuentos(descuentos);

  aplicar(cfg.jornales.activo,     cfg.jornales.tipo,     cfg.jornales.valor,     baseJornales,    'Descuento en Jornales');
  aplicar(cfg.materiales.activo,   cfg.materiales.tipo,   cfg.materiales.valor,   baseMateriales,  'Descuento en Materiales');

  // Honorarios: sub-tipos o legacy
  const tieneSubtipos = [
    'honorariosJornales','honorariosProfesionales','honorariosMateriales',
    'honorariosOtros','honorariosGastosGenerales','honorariosConfiguracion'
  ].some(k => Number(cfg[k]?.valor || 0) > 0);

  if (tieneSubtipos) {
    // Usamos baseHonorarios como base unificada para todos los sub-tipos
    // (en la lista no tenemos el desglose por categoría de honorario)
    let totalDescHonorarios = 0;
    const usaGG = Number(cfg.honorariosGastosGenerales?.valor || 0) > 0;
    [
      { key: 'honorariosJornales' },
      { key: 'honorariosProfesionales' },
      { key: 'honorariosMateriales' },
      { key: 'honorariosOtros',           skip: usaGG },
      { key: 'honorariosGastosGenerales' },
      { key: 'honorariosConfiguracion' }
    ].forEach(({ key, skip }) => {
      if (skip) return;
      const c = cfg[key];
      if (!c || c.activo === false) return;
      const v = Number(c.valor || 0);
      if (v <= 0 || baseHonorarios <= 0) return;
      totalDescHonorarios += c.tipo === 'porcentaje' ? (baseHonorarios * v) / 100 : v;
    });
    if (totalDescHonorarios > 0) {
      totalDescuentos += totalDescHonorarios;
      detalleDescuentos.push({ label: 'Descuento en Honorarios', importe: totalDescHonorarios });
    }
  } else {
    aplicar(cfg.honorarios.activo, cfg.honorarios.tipo, cfg.honorarios.valor, baseHonorarios, 'Descuento en Honorarios');
  }

  aplicar(cfg.mayoresCostos.activo, cfg.mayoresCostos.tipo, cfg.mayoresCostos.valor, baseMayoresCostos, 'Descuento en Mayores Costos');

  return {
    totalSinDescuento,
    totalDescuentos,
    totalFinal: totalSinDescuento - totalDescuentos,
    detalleDescuentos
  };
}

/**
 * Normaliza el objeto de descuentos sin importar si viene como objeto interno del form
 * o como campos planos del row (descuentosJornalesActivo, etc.)
 */
function normalizarDescuentos(d = {}) {
  // Si ya tiene estructura interna (form.descuentos)
  if (d.jornales && typeof d.jornales === 'object') return d;

  // Si viene como campos planos del row
  const sub = (prefix) => ({
    activo: d[`${prefix}Activo`] !== false,
    tipo:   d[`${prefix}Tipo`]   || 'porcentaje',
    valor:  d[`${prefix}Valor`]  || 0
  });
  return {
    jornales:                  sub('descuentosJornales'),
    materiales:                sub('descuentosMateriales'),
    honorarios:                sub('descuentosHonorarios'),
    honorariosJornales:        sub('descuentosHonorariosJornales'),
    honorariosProfesionales:   sub('descuentosHonorariosProfesionales'),
    honorariosMateriales:      sub('descuentosHonorariosMateriales'),
    honorariosOtros:           sub('descuentosHonorariosOtros'),
    honorariosGastosGenerales: sub('descuentosHonorariosGastosGenerales'),
    honorariosConfiguracion:   sub('descuentosHonorariosConfiguracion'),
    mayoresCostos:             sub('descuentosMayoresCostos')
  };
}
