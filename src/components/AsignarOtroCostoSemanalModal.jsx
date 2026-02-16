import React, { useState, useMemo } from 'react';

const AsignarOtroCostoSemanalModal = ({
  show,
  onClose,
  obra,
  numeroSemana,
  diasSemana = [],
  otrosCostosDisponibles = [],
  rubrosParaSelect = [],
  presupuestoGlobalDisponible = 0,
  presupuestoGlobalTotal = 0, // 🆕 Total del presupuesto para detectar cuando es 0
  totalHonorarios = 0, // 🆕 Total honorarios calculado
  totalMateriales = 0, // 🆕 Total materiales calculado
  modoPresupuesto = 'GLOBAL',
  asignacionesExistentes = [], // Nueva prop
  onEliminarAsignacion, // Nueva prop
  onEditarAsignacion, // Nueva prop
  rubroInicial = 'General', // Rubro desde donde se abre el modal
  onConfirmarAsignacion
}) => {
  console.log('🔍 [MODAL SEMANAL] Props recibidas:', {
    presupuestoGlobalDisponible,
    modoPresupuesto,
    show,
    obra: obra ? { id: obra.id, nombre: obra.nombre } : null
  });
  const [tipoAsignacion, setTipoAsignacion] = useState(modoPresupuesto === 'GLOBAL' ? 'IMPORTE_GLOBAL' : 'ELEMENTO_DETALLADO');
  const [costoSeleccionadoId, setCostoSeleccionadoId] = useState('');
  const [importeTotal, setImporteTotal] = useState('');
  const [tipoDistribucion, setTipoDistribucion] = useState('uniforme'); // 'uniforme' o 'inicio-fin'
  const [observaciones, setObservaciones] = useState('');
  const [procesando, setProcesando] = useState(false); // Protección contra doble clic
  const [origenFondos, setOrigenFondos] = useState('RETIRO_DIRECTO'); // 🆕 Origen de fondos cuando presupuesto = 0

  // Estado para creación rápida de gasto (similar al modal individual)
  const [nuevoGastoManual, setNuevoGastoManual] = useState({
    descripcion: '',
    categoria: typeof rubroInicial === 'string' ? rubroInicial : 'General', // Asegurar que sea string
    categoriaCustom: ''
  });

  const obtenerRubroFinal = () => {
    if (nuevoGastoManual.categoria === '__OTRO__') {
      return (nuevoGastoManual.categoriaCustom || '').trim();
    }
    return (nuevoGastoManual.categoria || 'General').trim() || 'General';
  };

  // 🆕 Calcular monto disponible según origen de fondos seleccionado
  const montoDisponibleCalculado = useMemo(() => {
    // Si presupuesto > 0, usar el disponible normal
    if (presupuestoGlobalTotal > 0) {
      return {
        monto: presupuestoGlobalDisponible,
        label: 'Disponible:',
        emoji: '💵'
      };
    }

    // Si presupuesto = 0, depende del origen de fondos
    if (origenFondos === 'RETIRO_DIRECTO') {
      return {
        monto: totalHonorarios,
        label: 'Disponible en Honorarios:',
        emoji: '💸'
      };
    } else if (origenFondos === 'PRESUPUESTO_MATERIALES') {
      return {
        monto: totalMateriales,
        label: 'Disponible en Materiales:',
        emoji: '🧱'
      };
    }

    // Default
    return {
      monto: 0,
      label: 'Disponible:',
      emoji: '💵'
    };
  }, [presupuestoGlobalTotal, presupuestoGlobalDisponible, origenFondos, totalHonorarios, totalMateriales]);

  // Calcular distribución automática
  const calcularDistribucion = () => {
    console.log('🧮 [DISTRIBUCION] importeTotal:', importeTotal, 'tipoAsignacion:', tipoAsignacion, 'diasSemana.length:', diasSemana.length);

    if (!importeTotal || (tipoAsignacion === 'ELEMENTO_DETALLADO' && !costoSeleccionadoId)) {
      console.log('⚠️ [DISTRIBUCION] Retornando vacío: falta importeTotal o costoSeleccionadoId');
      return {};
    }
    if (tipoAsignacion === 'IMPORTE_GLOBAL' && !nuevoGastoManual.descripcion.trim()) {
      console.log('⚠️ [DISTRIBUCION] Retornando vacío: falta descripción en modo GLOBAL');
      return {};
    }

    const importe = parseFloat(importeTotal);
    const dias = diasSemana.length;

    if (dias === 0) return {};

    if (tipoDistribucion === 'uniforme') {
      const importePorDia = Math.floor(importe * 100 / dias) / 100;
      const resto = Math.round((importe - (importePorDia * dias)) * 100) / 100;

      const distribucion = {};
      diasSemana.forEach((dia, index) => {
        distribucion[dia.fechaStr] = importePorDia + (index === 0 ? resto : 0);
      });
      console.log('✅ [DISTRIBUCION UNIFORME] Resultado:', distribucion);
      return distribucion;
    } else {
      const factores = [0.30, 0.15, 0.20, 0.15, 0.20]; // L, M, X, J, V
      const distribucion = {};
      diasSemana.forEach((dia, index) => {
        const factor = factores[index] || 0.2;
        distribucion[dia.fechaStr] = Math.round(importe * factor * 100) / 100;
      });
      console.log('✅ [DISTRIBUCION INICIO-FIN] Resultado:', distribucion);
      return distribucion;
    }
  };

  const distribucionCalculada = calcularDistribucion();

  const handleConfirmar = async () => {
    if (procesando) {
      console.log('⚠️ [PROTECCIÓN] handleConfirmar ya se está ejecutando, ignorando...');
      return;
    }

    setProcesando(true);
    console.log('🔒 [LOCK] Procesando asignación semanal - bloqueado contra doble clic');

    const importe = parseFloat(importeTotal) || 0;

    if (tipoAsignacion === 'IMPORTE_GLOBAL') {
      if (!nuevoGastoManual.descripcion.trim()) {
        alert('⚠️ Debe ingresar una descripción para el gasto');
        setProcesando(false);
        return;
      }
      if (nuevoGastoManual.categoria === '__OTRO__' && !obtenerRubroFinal()) {
        alert('⚠️ Si seleccionas "Otros", debes escribir el rubro');
        setProcesando(false);
        return;
      }
      if (importe <= 0) {
        alert('⚠️ El importe total debe ser mayor a cero');
        setProcesando(false);
        return;
      }

      // 🆕 Solo validar disponible si NO hay un origen de fondos alternativo
      if (presupuestoGlobalTotal > 0 && importe > presupuestoGlobalDisponible) {
        alert(`⚠️ El importe ($${importe.toLocaleString('es-AR')}) excede el disponible ($${presupuestoGlobalDisponible.toLocaleString('es-AR')})`);
        setProcesando(false);
        return;
      }

      // 🆕 Si presupuesto = 0, verificar que se haya seleccionado origen de fondos
      if (presupuestoGlobalTotal === 0 && !origenFondos) {
        alert('⚠️ Debe seleccionar el origen de fondos (Retiro Directo o Presupuesto de Materiales)');
        setProcesando(false);
        return;
      }
    } else {
      if (!costoSeleccionadoId) {
        alert('⚠️ Por favor seleccione un costo del presupuesto');
        setProcesando(false);
        return;
      }
      if (importe <= 0) {
        alert('⚠️ El importe debe ser mayor a cero');
        setProcesando(false);
        return;
      }
    }

    const categoriaFinal = (tipoAsignacion === 'IMPORTE_GLOBAL')
      ? obtenerRubroFinal()
      : (otrosCostosDisponibles.find(c => c.id.toString() === costoSeleccionadoId)?.categoria || 'General');

    const nombreGasto = (tipoAsignacion === 'IMPORTE_GLOBAL')
      ? nuevoGastoManual.descripcion
      : (otrosCostosDisponibles.find(c => c.id.toString() === costoSeleccionadoId)?.nombre || 'Gasto');

    // Detectar si es Global o Detallado basándose en el contenido real
    const descripcionCompleta = (nombreGasto || '').toLowerCase();
    const esGlobal = descripcionCompleta.includes('presupuesto global') ||
                     descripcionCompleta.includes('para la') ||
                     descripcionCompleta.includes('para el');

    // Crear UNA SOLA asignación para toda la semana (no distribuir por días)
    const asignacionSemanal = {
      otroCostoId: tipoAsignacion === 'IMPORTE_GLOBAL' ? `MANUAL_${Date.now()}` : costoSeleccionadoId,
      nombreOtroCosto: nombreGasto,
      categoria: categoriaFinal,
      importe: importe,
      numeroSemana: numeroSemana,
      observaciones: observaciones + (esGlobal ? ` [Para toda la Semana]` : ` [Gasto Semanal Detallado]`),
      esManual: tipoAsignacion === 'IMPORTE_GLOBAL',
      esSemanal: true, // Marcador para identificar que es asignación semanal completa
      origenFondos: presupuestoGlobalTotal === 0 ? origenFondos : null // 🆕 Incluir origen de fondos si presupuesto = 0
    };

    const asignacionesSemana = [asignacionSemanal];

    console.log('📤 [MODAL SEMANAL] Enviando UNA asignación semanal:', asignacionSemanal);
    console.log('📤 [MODAL SEMANAL] Importe total:', importe);

    if (onConfirmarAsignacion) {
      await onConfirmarAsignacion(asignacionesSemana);
    }

    console.log('✅ [MODAL SEMANAL] Procesamiento completado, cerrando modal');
    setProcesando(false);

    // Cerrar después de que se complete el procesamiento
    onClose();
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1070}}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title">
              <i className="fas fa-calendar-week me-2"></i>
              Asignación Semanal: Otros Costos (Semana {numeroSemana})
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
            ></button>
          </div>
          <div className="modal-body p-4">
            <div className="alert alert-info border-0 shadow-sm d-flex align-items-center mb-4">
              <i className="fas fa-info-circle fs-4 me-3"></i>
              <div>
                Configure la asignación para toda la semana {numeroSemana}.
                El importe se distribuirá automáticamente entre los días hábiles.
              </div>
            </div>

            {/* Selector de Tipo de Asignación */}
            <div className="card mb-4 border-0 bg-light">
              <div className="card-body">
                <label className="form-label fw-bold text-success mb-3">
                  <i className="fas fa-tasks me-2"></i>
                  Tipo de asignación semanal
                </label>
                <div className="d-flex gap-3">
                  {(modoPresupuesto === 'GLOBAL' || modoPresupuesto === 'MIXTO') && (
                    <div
                      className={`flex-fill p-3 border rounded cursor-pointer transition-all ${tipoAsignacion === 'IMPORTE_GLOBAL' ? 'border-success bg-white shadow-sm ring-success' : 'bg-white text-muted opacity-75'}`}
                      style={{ cursor: 'pointer', border: tipoAsignacion === 'IMPORTE_GLOBAL' ? '2px solid' : '1px solid' }}
                      onClick={() => setTipoAsignacion('IMPORTE_GLOBAL')}
                    >
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          checked={tipoAsignacion === 'IMPORTE_GLOBAL'}
                          onChange={() => setTipoAsignacion('IMPORTE_GLOBAL')}
                        />
                        <label className="form-check-label fw-bold">Importe Global</label>
                      </div>
                      <small className="d-block mt-1 text-muted">Usar presupuesto global ($ {presupuestoGlobalDisponible.toLocaleString('es-AR')})</small>
                    </div>
                  )}
                  {(modoPresupuesto === 'DETALLE' || modoPresupuesto === 'MIXTO') && (
                    <div
                      className={`flex-fill p-3 border rounded cursor-pointer transition-all ${tipoAsignacion === 'ELEMENTO_DETALLADO' ? 'border-success bg-white shadow-sm ring-success' : 'bg-white text-muted opacity-75'}`}
                      style={{ cursor: 'pointer', border: tipoAsignacion === 'ELEMENTO_DETALLADO' ? '2px solid' : '1px solid' }}
                      onClick={() => setTipoAsignacion('ELEMENTO_DETALLADO')}
                    >
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          checked={tipoAsignacion === 'ELEMENTO_DETALLADO'}
                          onChange={() => setTipoAsignacion('ELEMENTO_DETALLADO')}
                        />
                        <label className="form-check-label fw-bold">Elemento Detallado</label>
                      </div>
                      <small className="d-block mt-1 text-muted">Seleccionar ítem específico del presupuesto</small>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 🆕 Selector de Origen de Fondos - Solo cuando Presupuesto de Gastos = $0 */}
            {presupuestoGlobalTotal === 0 && (
              <div className="card mb-4 border-warning">
                <div className="card-header bg-warning text-dark">
                  <h6 className="mb-0">
                    <i className="fas fa-exclamation-triangle me-2"></i>
                    No hay presupuesto asignado para Gastos Generales
                  </h6>
                </div>
                <div className="card-body">
                  <p className="mb-3">
                    <i className="fas fa-info-circle me-2 text-primary"></i>
                    Debes seleccionar de dónde se tomarán los fondos para los gastos que registres:
                  </p>
                  <div className="d-flex flex-column gap-3">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="origenFondosSemanal"
                        id="origenRetiroDirectoSemanal"
                        value="RETIRO_DIRECTO"
                        checked={origenFondos === 'RETIRO_DIRECTO'}
                        onChange={(e) => setOrigenFondos(e.target.value)}
                      />
                      <label className="form-check-label" htmlFor="origenRetiroDirectoSemanal">
                        <strong className="d-block mb-1">💸 Retiro Directo / Caja Chica</strong>
                        <small className="text-muted">
                          Se registra como gasto extraordinario. No afecta el presupuesto de materiales.
                        </small>
                      </label>
                    </div>
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="origenFondosSemanal"
                        id="origenMaterialesSemanal"
                        value="PRESUPUESTO_MATERIALES"
                        checked={origenFondos === 'PRESUPUESTO_MATERIALES'}
                        onChange={(e) => setOrigenFondos(e.target.value)}
                      />
                      <label className="form-check-label" htmlFor="origenMaterialesSemanal">
                        <strong className="d-block mb-1">🧱 Descontar del Presupuesto de Materiales</strong>
                        <small className="text-muted">
                          Se descuenta del dinero destinado a materiales. Reduce el presupuesto disponible para comprar materiales.
                        </small>
                      </label>
                    </div>
                  </div>
                  {origenFondos && (
                    <div className="alert alert-info mt-3 mb-0">
                      <i className="fas fa-check-circle me-2"></i>
                      <strong>Origen seleccionado:</strong> {origenFondos === 'RETIRO_DIRECTO' ? '💸 Retiro Directo' : '🧱 Presupuesto de Materiales'}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="row g-3">
              {tipoAsignacion === 'IMPORTE_GLOBAL' ? (
                <>
                  <div className="col-md-7">
                    <label className="form-label fw-bold">Descripción / Concepto *</label>
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      placeholder="Ej: Seguimiento semanal, Gastos varios..."
                      value={nuevoGastoManual.descripcion}
                      onChange={(e) => setNuevoGastoManual({...nuevoGastoManual, descripcion: e.target.value})}
                    />
                  </div>
                  <div className="col-md-5">
                    <label className="form-label fw-bold">Categoría/Rubro</label>
                    <select
                      className="form-select form-select-lg"
                      value={nuevoGastoManual.categoria}
                      onChange={(e) => setNuevoGastoManual({
                        ...nuevoGastoManual,
                        categoria: e.target.value,
                        categoriaCustom: e.target.value === '__OTRO__' ? (nuevoGastoManual.categoriaCustom || '') : ''
                      })}
                    >
                      {(Array.isArray(rubrosParaSelect) ? rubrosParaSelect : []).map((r, idx) => {
                        const valorRubro = typeof r === 'string' ? r : (r?.nombre || r?.valor || String(r));
                        return <option key={idx} value={valorRubro}>{valorRubro}</option>;
                      })}
                      <option value="__OTRO__">Otros (escribir...)</option>
                    </select>
                    {nuevoGastoManual.categoria === '__OTRO__' && (
                      <input
                        type="text"
                        className="form-control mt-2"
                        placeholder="Escribí el rubro..."
                        value={nuevoGastoManual.categoriaCustom}
                        onChange={(e) => setNuevoGastoManual({...nuevoGastoManual, categoriaCustom: e.target.value})}
                        required
                      />
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="col-md-12">
                    <label className="form-label fw-bold">Seleccionar Item del Presupuesto *</label>
                    <select
                      className="form-select form-select-lg"
                      value={costoSeleccionadoId}
                      onChange={(e) => setCostoSeleccionadoId(e.target.value)}
                    >
                      <option value="">Seleccione un costo...</option>
                      {otrosCostosDisponibles.map(costo => (
                        <option key={costo.id} value={costo.id}>
                          [{costo.categoria}] {costo.nombre} - Presupuestado: ${Number(costo.importe || 0).toLocaleString('es-AR')}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Panel informativo cuando se selecciona un item */}
                  {costoSeleccionadoId && (() => {
                    const costoSeleccionado = otrosCostosDisponibles.find(c => c.id.toString() === costoSeleccionadoId.toString());
                    if (!costoSeleccionado) return null;

                    const totalPresupuestado = parseFloat(costoSeleccionado.importe || 0);
                    // Calcular ya asignado (esto debe venir de las asignaciones existentes)
                    // Por ahora lo dejo en 0, pero deberías pasarlo como prop
                    const yaAsignado = 0; // TODO: Calcular desde asignaciones existentes
                    const disponible = totalPresupuestado - yaAsignado;

                    return (
                      <div className="col-12">
                        <div className="alert alert-info border-0 shadow-sm mb-0">
                          <div className="d-flex align-items-center mb-2">
                            <i className="fas fa-info-circle fs-5 me-2"></i>
                            <h6 className="mb-0 fw-bold">💰 {costoSeleccionado.nombre}</h6>
                          </div>
                          <div className="row g-2 small">
                            <div className="col-4">
                              <div className="text-muted">📋 Categoría:</div>
                              <strong>{costoSeleccionado.categoria}</strong>
                            </div>
                            <div className="col-4">
                              <div className="text-muted">💰 Presupuestado:</div>
                              <strong>${totalPresupuestado.toLocaleString('es-AR', {minimumFractionDigits: 2})}</strong>
                            </div>
                            <div className="col-4">
                              <div className="text-muted">✅ Ya asignado:</div>
                              <strong className="text-primary">${yaAsignado.toLocaleString('es-AR', {minimumFractionDigits: 2})}</strong>
                            </div>
                            <div className="col-12">
                              <div className="border-top pt-2 mt-1">
                                <div className="d-flex justify-content-between align-items-center">
                                  <span className="text-muted fw-bold">🟢 Disponible:</span>
                                  <span className="fs-5 fw-bold text-success">
                                    ${disponible.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}

              <div className="col-md-6">
                <label className="form-label fw-bold">Importe Total a Distribuir *</label>
                <div className="input-group input-group-lg">
                  <span className="input-group-text">$</span>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    value={importeTotal}
                    onChange={(e) => setImporteTotal(e.target.value)}
                  />
                </div>
                {tipoAsignacion === 'IMPORTE_GLOBAL' && (
                  <div className="mt-1">
                    <small className={parseFloat(importeTotal) > montoDisponibleCalculado.monto ? 'text-danger fw-bold' : 'text-muted'}>
                      {montoDisponibleCalculado.emoji} {montoDisponibleCalculado.label} ${montoDisponibleCalculado.monto.toLocaleString('es-AR')}
                    </small>
                  </div>
                )}
              </div>

              <div className="col-md-6">
                <label className="form-label fw-bold">Método de Distribución</label>
                <select
                  className="form-select form-select-lg"
                  value={tipoDistribucion}
                  onChange={(e) => setTipoDistribucion(e.target.value)}
                >
                  <option value="uniforme">Toda la Semana</option>
                  <option value="inicio-fin">Inicio-Fin (Más al principio y final)</option>
                </select>
              </div>

              <div className="col-12">
                <label className="form-label fw-bold">Observaciones Generales</label>
                <textarea
                  className="form-control"
                  rows="2"
                  placeholder="Notas para el reporte semanal..."
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                ></textarea>
              </div>
            </div>
          </div>
          <div className="modal-footer bg-light border-top-0 p-3">
            <button
              type="button"
              className="btn btn-outline-secondary px-4"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-success px-4 shadow-sm"
              onClick={handleConfirmar}
              disabled={procesando || !importeTotal || (tipoAsignacion === 'ELEMENTO_DETALLADO' && !costoSeleccionadoId) || (tipoAsignacion === 'IMPORTE_GLOBAL' && !nuevoGastoManual.descripcion)}
            >
              <i className="fas fa-check-circle me-2"></i>
              Confirmar Asignación Semanal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AsignarOtroCostoSemanalModal;
