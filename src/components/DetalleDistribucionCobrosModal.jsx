import React, { useState, useEffect } from 'react';
import { formatearMoneda } from '../services/cobrosObraService';
import { obtenerDistribucionPorObra } from '../services/cobrosEmpresaService';
import { actualizarAsignacion } from '../services/asignacionesCobroObraService';
import { listarEntidadesFinancieras, obtenerEstadisticasMultiples } from '../services/entidadesFinancierasService';
import { useEmpresa } from '../EmpresaContext';

const DetalleDistribucionCobrosModal = ({ show, onHide, datos, estadisticas, obrasDisponibles }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [distribucionPorObra, setDistribucionPorObra] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editandoObra, setEditandoObra] = useState(null);
  const [formEdicion, setFormEdicion] = useState({
    montoProfesionales: 0,
    montoMateriales: 0,
    montoGastosGenerales: 0,
    montoTrabajosExtra: 0
  });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (show && empresaSeleccionada) {
      cargarDistribucion();
    }
  }, [show, empresaSeleccionada]);

  const cargarDistribucion = async () => {
    setLoading(true);
    try {
      // ── PASO 1: Obtener todas las entidades financieras activas de la empresa ──────
      // Incluye OBRA_PRINCIPAL, TRABAJO_EXTRA, TRABAJO_ADICIONAL, OBRA_INDEPENDIENTE
      const [distribucion, entidadesFinancieras] = await Promise.all([
        obtenerDistribucionPorObra(empresaSeleccionada.id),
        listarEntidadesFinancieras(empresaSeleccionada.id),
      ]);

      console.log('🔍 [DetalleDistribucion] distribucion-por-obra:', distribucion?.length, 'filas');
      console.log('🔍 [DetalleDistribucion] entidades-financieras:', entidadesFinancieras?.length, 'registros');

      // ── PASO 2: Separar entidades financieras por tipo ───────────────────────────
      // OBRA_PRINCIPAL y TRABAJO_EXTRA → sus cobros vienen de distribucion-por-obra
      // TRABAJO_ADICIONAL y OBRA_INDEPENDIENTE → sus cobros vienen de estadisticas-multiples
      const efSinDistribucion = (entidadesFinancieras || []).filter(
        ef => ef.tipoEntidad === 'TRABAJO_ADICIONAL' || ef.tipoEntidad === 'OBRA_INDEPENDIENTE'
      );

      // ── PASO 3: Llamar a estadisticas-multiples para TA y OI ────────────────────
      const idsEfSinDistribucion = efSinDistribucion.map(ef => ef.id);
      const estadisticasSinDistribucion = await obtenerEstadisticasMultiples(
        empresaSeleccionada.id,
        idsEfSinDistribucion
      );

      // Indexar estadísticas por entidadFinancieraId para lookup O(1)
      const estadPorEfId = {};
      (estadisticasSinDistribucion || []).forEach(e => {
        estadPorEfId[e.entidadFinancieraId] = e;
      });

      // Indexar entidades financieras por (tipoEntidad + entidadId) para merge
      const efPorTipoYEntidadId = {};
      (entidadesFinancieras || []).forEach(ef => {
        efPorTipoYEntidadId[`${ef.tipoEntidad}_${ef.entidadId}`] = ef;
      });

      // ── PASO 4: Construir lista unificada ────────────────────────────────────────

      // 4a. Indexar distribucion-por-obra por obraId y por nombre (fallback)
      const backendPorId = {};
      const backendPorNombre = {};
      (distribucion || []).forEach(d => {
        if (d.obraId != null) backendPorId[d.obraId] = d;
        const key = d.nombreObra || `id_${d.obraId}`;
        if (!backendPorNombre[key]) backendPorNombre[key] = d;
      });

      const getBd = (id, nombre) =>
        (id != null && backendPorId[id]) ||
        (nombre && backendPorNombre[nombre]) ||
        {};

      const entidades = [];
      const idsAgregados = new Set();
      const nombresAgregados = new Set();

      // 4b. Obras principales y sus trabajos extra (datos desde distribucion-por-obra)
      (obrasDisponibles || []).forEach(obra => {
        const nombre = obra.nombreObra;
        const idObra = obra.obraId || obra.id;
        const tipo = obra.esObraIndependiente ? 'OBRA_INDEPENDIENTE' : 'OBRA_PRINCIPAL';

        // Para OBRA_INDEPENDIENTE usar entidades-financieras, no distribucion-por-obra
        if (tipo === 'OBRA_INDEPENDIENTE') {
          const ef = efPorTipoYEntidadId[`OBRA_INDEPENDIENTE_${idObra}`];
          const est = ef ? (estadPorEfId[ef.id] || {}) : {};
          const claveUnica = idObra ?? nombre;
          if (!idsAgregados.has(claveUnica)) {
            idsAgregados.add(claveUnica);
            nombresAgregados.add(nombre);
            entidades.push({
              obraId:              idObra,
              entidadFinancieraId: ef?.id,
              nombreObra:          ef?.nombreDisplay || nombre,
              tipo:                'OBRA_INDEPENDIENTE',
              totalCobradoAsignado: parseFloat(est.totalCobrado || 0),
              montoProfesionales:   null,
              montoMateriales:      null,
              montoGastosGenerales: null,
              montoTrabajosExtra:   null,
              asignacionId:         null,
              enBackend:            !!ef,
            });
          }
          return;
        }

        // OBRA_PRINCIPAL
        const bd = getBd(idObra, nombre);
        const claveUnica = idObra ?? nombre;
        if (!idsAgregados.has(claveUnica)) {
          idsAgregados.add(claveUnica);
          nombresAgregados.add(nombre);
          if (bd.obraId != null) idsAgregados.add(bd.obraId);
          entidades.push({
            obraId:              bd.obraId || idObra,
            nombreObra:          nombre,
            tipo:                'OBRA_PRINCIPAL',
            totalCobradoAsignado: bd.totalCobradoAsignado || 0,
            montoProfesionales:   bd.montoProfesionales   || 0,
            montoMateriales:      bd.montoMateriales       || 0,
            montoGastosGenerales: bd.montoGastosGenerales  || 0,
            montoTrabajosExtra:   bd.montoTrabajosExtra    || 0,
            asignacionId:         bd.asignacionId,
            enBackend:            !!bd.obraId,
          });
        }

        // Trabajos extra de esta obra (datos desde distribucion-por-obra)
        (obra.trabajosExtra || []).forEach(te => {
          const teNombre = te.nombre || `TE #${te.id}`;
          const teId = te.obraId || `te_${te.id}`;
          const teBd = getBd(te.obraId, teNombre);
          const teClaveUnica = te.obraId ?? teNombre;
          if (!idsAgregados.has(teClaveUnica)) {
            idsAgregados.add(teClaveUnica);
            nombresAgregados.add(teNombre);
            if (teBd.obraId != null) idsAgregados.add(teBd.obraId);
            entidades.push({
              obraId:              teBd.obraId || teId,
              nombreObra:          teNombre,
              tipo:                'TRABAJO_EXTRA',
              obraPadreNombre:     nombre,
              totalCobradoAsignado: teBd.totalCobradoAsignado || 0,
              montoProfesionales:   teBd.montoProfesionales   || 0,
              montoMateriales:      teBd.montoMateriales       || 0,
              montoGastosGenerales: teBd.montoGastosGenerales  || 0,
              montoTrabajosExtra:   teBd.montoTrabajosExtra    || 0,
              asignacionId:         teBd.asignacionId,
              enBackend:            !!teBd.obraId,
            });
          }
        });
      });

      // 4c. Trabajos adicionales → datos desde estadisticas-multiples
      const efTrabajosAdicionales = (entidadesFinancieras || []).filter(
        ef => ef.tipoEntidad === 'TRABAJO_ADICIONAL'
      );
      efTrabajosAdicionales.forEach(ef => {
        const nombre = ef.nombreDisplay || `Trabajo Adicional #${ef.entidadId}`;
        const claveUnica = `ta_ef_${ef.id}`;
        if (!idsAgregados.has(claveUnica)) {
          idsAgregados.add(claveUnica);
          nombresAgregados.add(nombre);
          const est = estadPorEfId[ef.id] || {};
          entidades.push({
            obraId:              `ta_${ef.entidadId}`,
            entidadFinancieraId: ef.id,
            nombreObra:          nombre,
            tipo:                'TRABAJO_ADICIONAL',
            totalCobradoAsignado: parseFloat(est.totalCobrado || 0),
            montoProfesionales:   null,
            montoMateriales:      null,
            montoGastosGenerales: null,
            montoTrabajosExtra:   null,
            asignacionId:         null,
            enBackend:            true,
          });
        }
      });

      // 4d. Entradas del backend (distribucion-por-obra) que no matchean con ninguna entidad conocida
      (distribucion || []).forEach(d => {
        const yaIncluido =
          (d.obraId != null && idsAgregados.has(d.obraId)) ||
          (d.nombreObra && nombresAgregados.has(d.nombreObra));
        if (!yaIncluido) {
          if (d.obraId != null) idsAgregados.add(d.obraId);
          nombresAgregados.add(d.nombreObra || `id_${d.obraId}`);
          entidades.push({ ...d, tipo: 'OTRO', enBackend: true });
        }
      });

      console.log(`✅ [DetalleDistribucion] Total entidades: ${entidades.length}`);
      setDistribucionPorObra(entidades);
    } catch (error) {
      console.error('Error cargando distribución:', error);
      setDistribucionPorObra([]);
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  // 🔍 Filtrar solo obras/entidades con cobros asignados
  const distribucionConCobros = distribucionPorObra.filter(obra => (obra.totalCobradoAsignado || 0) > 0);

  // Calcular totales basados en los datos REALES de distribucionConCobros
  // Obras Principales + Trabajos Extra (sistema antiguo)
  const totalAsignadoPrincipalTE = distribucionConCobros.reduce((sum, o) => {
    if (o.tipo !== 'OBRA_PRINCIPAL' && o.tipo !== 'TRABAJO_EXTRA' && o.tipo !== 'OTRO') return sum;
    return sum + (o.totalCobradoAsignado || 0);
  }, 0);
  // Obras Independientes + Trabajos Adicionales (sistema nuevo)
  const totalAsignadoTAOI = distribucionConCobros.reduce((sum, o) => {
    if (o.tipo !== 'OBRA_INDEPENDIENTE' && o.tipo !== 'TRABAJO_ADICIONAL') return sum;
    return sum + (o.totalCobradoAsignado || 0);
  }, 0);
  // Total global (para el alert superior)
  const totalCobradoAsignado = totalAsignadoPrincipalTE + totalAsignadoTAOI;
  const totalDistribuidoItems = distribucionConCobros.reduce((sum, o) => {
    // TRABAJO_ADICIONAL y OBRA_INDEPENDIENTE no distribuyen por ítems
    if (o.tipo === 'TRABAJO_ADICIONAL' || o.tipo === 'OBRA_INDEPENDIENTE') return sum;
    const distribuido = (o.montoProfesionales || 0) +
                       (o.montoMateriales || 0) +
                       (o.montoGastosGenerales || 0) +
                       (o.montoTrabajosExtra || 0);
    return sum + distribuido;
  }, 0);

  // 🆕 Obtener retiros del desglose de estadísticas (si está disponible)
  const totalRetirado = estadisticas?.totalRetirado || 0;

  // Crear mapa de retiros por obra desde estadisticas.desglosePorObra
  const retirosPorObraMap = {};
  if (estadisticas?.desglosePorObra) {
    estadisticas.desglosePorObra.forEach(obra => {
      retirosPorObraMap[obra.obraId] = obra.totalRetirado || 0;
    });
  }

  const saldoDisponibleReal = totalCobradoAsignado - totalDistribuidoItems - totalRetirado;

  return (
    <div className={`modal fade ${show ? 'show d-block' : ''}`} tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-info bg-opacity-10">
            <h5 className="modal-title">
              <i className="bi bi-bank me-2"></i>
              📊 Distribución de Cobros por Obra e Items
            </h5>
            <button type="button" className="btn btn-light btn-sm ms-auto" onClick={onHide}>
              Cerrar
            </button>
          </div>

          <div className="modal-body">
            {loading ? (
              <div className="text-center py-4">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Cargando...</span>
                </div>
                <p className="mt-2">Cargando distribución de cobros...</p>
              </div>
            ) : (
              <>
                {/* Alerta informativa */}
                <div className="alert alert-info">
                  <div>
                    <i className="bi bi-info-circle me-2"></i>
                    <strong>Vista consolidada:</strong> Mostrando distribución de cobros en <strong>{distribucionConCobros.length} obra(s)</strong>
                    {estadisticas && ((estadisticas.cantidadTrabajosExtra || 0) > 0 || (estadisticas.cantidadTrabajosAdicionales || 0) > 0) && (
                      <>
                        {(estadisticas.cantidadTrabajosExtra || 0) > 0 && (
                          <span className="ms-1 text-warning">
                            + <strong>{estadisticas.cantidadTrabajosExtra} TE</strong>
                          </span>
                        )}
                        {(estadisticas.cantidadTrabajosAdicionales || 0) > 0 && (
                          <span className="ms-1 text-info">
                            + <strong>{estadisticas.cantidadTrabajosAdicionales} TA</strong>
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <div className="mt-3">
                    <div className="row text-center">
                      <div className="col-md-3">
                        <strong className="fs-6">Cobro asignado:</strong>
                        <div className="fw-bold fs-4 text-success">
                          {formatearMoneda(totalAsignadoPrincipalTE)}
                        </div>
                        <small className="text-muted">Obras principales y trabajos extra</small>
                      </div>
                      <div className="col-md-3">
                        <strong className="fs-6">Distribuido en Items:</strong>
                        <div className="fw-bold fs-4 text-primary">
                          {formatearMoneda(totalDistribuidoItems)}
                        </div>
                      </div>
                      <div className="col-md-3">
                        <strong className="fs-6">Total Retirado:</strong>
                        <div className="fw-bold fs-4 text-danger">
                          {formatearMoneda(totalRetirado)}
                        </div>
                      </div>
                      <div className="col-md-3">
                        <strong className="fs-6">Cobro asignado:</strong>
                        <div className={`fw-bold fs-4 ${totalAsignadoTAOI > 0 ? 'text-info' : 'text-muted'}`}>
                          {formatearMoneda(totalAsignadoTAOI)}
                        </div>
                        <small className="text-muted">Obras independientes y trabajos adicionales</small>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabla de distribución por obra */}
                <div className="table-responsive">
                  <table className="table table-hover table-striped">
                    <thead className="table-info">
                      <tr>
                        <th>Tipo</th>
                        <th>Obra / Entidad</th>
                        <th className="text-end">Total Asignado</th>
                        <th className="text-end">Profesionales</th>
                        <th className="text-end">Materiales</th>
                        <th className="text-end">Gastos Generales</th>
                        <th className="text-end">Trabajos Extra</th>
                        <th className="text-end">Total Distribuido</th>
                        <th className="text-end">Retirado</th>
                        <th className="text-end">Disponible</th>
                        <th className="text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {distribucionConCobros.map((obra, idx) => {
                        // TRABAJO_ADICIONAL y OBRA_INDEPENDIENTE no distribuyen por ítems
                        const noDistribuye = obra.tipo === 'TRABAJO_ADICIONAL' || obra.tipo === 'OBRA_INDEPENDIENTE';
                        const totalDistribuido = noDistribuye ? 0 :
                                                 (obra.montoProfesionales || 0) +
                                                 (obra.montoMateriales || 0) +
                                                 (obra.montoGastosGenerales || 0) +
                                                 (obra.montoTrabajosExtra || 0);
                        const retiradoObra = retirosPorObraMap[obra.obraId] || 0;
                        const saldoDisponible = (obra.totalCobradoAsignado || 0) - totalDistribuido - retiradoObra;
                        const tieneCobro = (obra.totalCobradoAsignado || 0) > 0;
                        const tipoBadge = {
                          OBRA_PRINCIPAL:     { label: 'Principal',    color: 'primary'           },
                          OBRA_INDEPENDIENTE: { label: 'Independiente', color: 'info'              },
                          TRABAJO_EXTRA:      { label: 'Trabajo Extra', color: 'warning text-dark' },
                          TRABAJO_ADICIONAL:  { label: 'T. Adicional',  color: 'secondary'         },
                          OTRO:               { label: 'Otro',          color: 'dark'              },
                        }[obra.tipo] || { label: obra.tipo || '-', color: 'secondary' };

                        return (
                          <tr key={`${obra.tipo}_${obra.obraId}_${idx}`}
                              className={!tieneCobro ? 'table-light text-muted' : ''}>
                            <td>
                              <span className={`badge bg-${tipoBadge.color}`}>{tipoBadge.label}</span>
                            </td>
                            <td>
                              <strong>{obra.nombreObra}</strong>
                              {obra.obraPadreNombre && (
                                <div className="text-muted small">↳ de: {obra.obraPadreNombre}</div>
                              )}
                              {!tieneCobro && (
                                <div className="text-muted small">
                                  <i className="bi bi-dash-circle me-1"></i>Sin cobros asignados
                                </div>
                              )}
                            </td>
                            <td className={`text-end fw-bold ${tieneCobro ? 'text-success' : 'text-muted'}`}>
                              {formatearMoneda(obra.totalCobradoAsignado || 0)}
                            </td>
                            <td className="text-end">
                              {noDistribuye ? <span className="text-muted small">—</span> : formatearMoneda(obra.montoProfesionales || 0)}
                            </td>
                            <td className="text-end">
                              {noDistribuye ? <span className="text-muted small">—</span> : formatearMoneda(obra.montoMateriales || 0)}
                            </td>
                            <td className="text-end">
                              {noDistribuye ? <span className="text-muted small">—</span> : formatearMoneda(obra.montoGastosGenerales || 0)}
                            </td>
                            <td className="text-end">
                              {noDistribuye ? <span className="text-muted small">—</span> : formatearMoneda(obra.montoTrabajosExtra || 0)}
                            </td>
                            <td className={`text-end fw-bold ${totalDistribuido > 0 ? 'text-primary' : 'text-muted'}`}>
                              {noDistribuye ? <span className="text-muted small">N/A</span> : formatearMoneda(totalDistribuido)}
                            </td>
                            <td className="text-end text-danger">{formatearMoneda(retiradoObra)}</td>
                            <td className="text-end">
                              <span className={saldoDisponible > 0 ? 'text-success fw-bold' : 'text-muted'}>
                                {formatearMoneda(saldoDisponible)}
                              </span>
                            </td>
                            <td className="text-center">
                              {tieneCobro && obra.asignacionId ? (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary"
                                  onClick={() => {
                                    setEditandoObra(obra);
                                    setFormEdicion({
                                      montoProfesionales: obra.montoProfesionales || 0,
                                      montoMateriales: obra.montoMateriales || 0,
                                      montoGastosGenerales: obra.montoGastosGenerales || 0,
                                      montoTrabajosExtra: obra.montoTrabajosExtra || 0
                                    });
                                  }}
                                  title="Editar distribución de ítems"
                                >
                                  <i className="bi bi-pencil-square"></i> Editar
                                </button>
                              ) : (
                                <span className="text-muted small">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="table-light">
                      <tr className="fw-bold">
                        <td></td>
                        <td className="text-end">TOTALES:</td>
                        <td className="text-end text-success fs-6">
                          {formatearMoneda(totalCobradoAsignado)}
                        </td>
                        <td className="text-end">
                          {formatearMoneda(distribucionConCobros.reduce((sum, o) => sum + (o.montoProfesionales || 0), 0))}
                        </td>
                        <td className="text-end">
                          {formatearMoneda(distribucionConCobros.reduce((sum, o) => sum + (o.montoMateriales || 0), 0))}
                        </td>
                        <td className="text-end">
                          {formatearMoneda(distribucionConCobros.reduce((sum, o) => sum + (o.montoGastosGenerales || 0), 0))}
                        </td>
                        <td className="text-end">
                          {formatearMoneda(distribucionConCobros.reduce((sum, o) => sum + (o.montoTrabajosExtra || 0), 0))}
                        </td>
                        <td className="text-end text-primary fs-6">
                          {formatearMoneda(totalDistribuidoItems)}
                        </td>
                        <td className="text-end text-danger fs-6">
                          {formatearMoneda(totalRetirado)}
                        </td>
                        <td className="text-end fs-6">
                          <span className={saldoDisponibleReal > 0 ? 'text-success' : 'text-muted'}>
                            {formatearMoneda(saldoDisponibleReal)}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Resumen en tarjetas */}
                <div className="row mt-4">
                  <div className="col-md-3">
                    <div className="card border-success">
                      <div className="card-body text-center">
                        <h6 className="text-muted">Cobro asignado</h6>
                        <h4 className="text-success mb-0">{formatearMoneda(totalAsignadoPrincipalTE)}</h4>
                        <small className="text-muted">Obras principales y trabajos extra</small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card border-primary">
                      <div className="card-body text-center">
                        <h6 className="text-muted">Distribuido en Items</h6>
                        <h4 className="text-primary mb-0">{formatearMoneda(totalDistribuidoItems)}</h4>
                        <small className="text-muted">Profesionales, materiales, gastos, trabajos extra</small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card border-danger">
                      <div className="card-body text-center">
                        <h6 className="text-muted">Total Retirado</h6>
                        <h4 className="text-danger mb-0">{formatearMoneda(totalRetirado)}</h4>
                        <small className="text-muted">Retiros personales</small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card border-info">
                      <div className="card-body text-center">
                        <h6 className="text-muted">Cobro asignado</h6>
                        <h4 className={`mb-0 ${totalAsignadoTAOI > 0 ? 'text-info' : 'text-muted'}`}>
                          {formatearMoneda(totalAsignadoTAOI)}
                        </h4>
                        <small className="text-muted">Obras independientes y trabajos adicionales</small>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onHide}>
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Edición de Distribución */}
      {editandoObra && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1060 }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="bi bi-pencil-square me-2"></i>
                  Editar Distribución de Ítems: {editandoObra.nombreObra}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setEditandoObra(null)}
                  disabled={guardando}
                ></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-info">
                  <strong>Total Asignado:</strong> {formatearMoneda(editandoObra.totalCobradoAsignado || 0)}
                </div>

                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label fw-bold">
                      👷 Profesionales
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      value={formEdicion.montoProfesionales}
                      onChange={(e) => setFormEdicion({...formEdicion, montoProfesionales: parseFloat(e.target.value) || 0})}
                      min="0"
                      step="0.01"
                      disabled={guardando}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-bold">
                      🧱 Materiales
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      value={formEdicion.montoMateriales}
                      onChange={(e) => setFormEdicion({...formEdicion, montoMateriales: parseFloat(e.target.value) || 0})}
                      min="0"
                      step="0.01"
                      disabled={guardando}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-bold">
                      💵 Gastos Generales
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      value={formEdicion.montoGastosGenerales}
                      onChange={(e) => setFormEdicion({...formEdicion, montoGastosGenerales: parseFloat(e.target.value) || 0})}
                      min="0"
                      step="0.01"
                      disabled={guardando}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-bold">
                      🔧 Trabajos Extra
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      value={formEdicion.montoTrabajosExtra}
                      onChange={(e) => setFormEdicion({...formEdicion, montoTrabajosExtra: parseFloat(e.target.value) || 0})}
                      min="0"
                      step="0.01"
                      disabled={guardando}
                    />
                  </div>
                </div>

                <div className="alert alert-warning mt-3">
                  <strong>Total a Distribuir:</strong> {formatearMoneda(
                    formEdicion.montoProfesionales +
                    formEdicion.montoMateriales +
                    formEdicion.montoGastosGenerales +
                    formEdicion.montoTrabajosExtra
                  )}
                  <br />
                  {(formEdicion.montoProfesionales + formEdicion.montoMateriales +
                    formEdicion.montoGastosGenerales + formEdicion.montoTrabajosExtra) >
                   (editandoObra.totalCobradoAsignado || 0) && (
                    <span className="text-danger">
                      <i className="bi bi-exclamation-triangle me-1"></i>
                      Excede el total asignado
                    </span>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditandoObra(null)}
                  disabled={guardando}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    const totalDistribuido = formEdicion.montoProfesionales +
                                            formEdicion.montoMateriales +
                                            formEdicion.montoGastosGenerales +
                                            formEdicion.montoTrabajosExtra;

                    if (totalDistribuido > (editandoObra.totalCobradoAsignado || 0)) {
                      alert('El total distribuido no puede exceder el total asignado');
                      return;
                    }

                    setGuardando(true);
                    try {
                      await actualizarAsignacion(
                        editandoObra.asignacionId,
                        {
                          montoProfesionales: formEdicion.montoProfesionales,
                          montoMateriales: formEdicion.montoMateriales,
                          montoGastosGenerales: formEdicion.montoGastosGenerales,
                          montoTrabajosExtra: formEdicion.montoTrabajosExtra
                        },
                        empresaSeleccionada.id
                      );

                      // Recargar distribución
                      await cargarDistribucion();
                      setEditandoObra(null);
                      alert('Distribución actualizada correctamente');
                    } catch (error) {
                      console.error('Error al actualizar distribución:', error);
                      alert('Error al actualizar la distribución: ' + (error.message || 'Error desconocido'));
                    } finally {
                      setGuardando(false);
                    }
                  }}
                  disabled={guardando}
                >
                  {guardando ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle me-2"></i>
                      Guardar Cambios
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DetalleDistribucionCobrosModal;
