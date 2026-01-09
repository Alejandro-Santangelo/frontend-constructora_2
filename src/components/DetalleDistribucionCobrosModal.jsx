import React, { useState, useEffect } from 'react';
import { formatearMoneda } from '../services/cobrosObraService';
import { obtenerDistribucionPorObra } from '../services/cobrosEmpresaService';
import { actualizarAsignacion } from '../services/asignacionesCobroObraService';
import { useEmpresa } from '../EmpresaContext';

const DetalleDistribucionCobrosModal = ({ show, onHide, datos, estadisticas }) => {
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
      const distribucion = await obtenerDistribucionPorObra(empresaSeleccionada.id);
      console.log('🔍 [DetalleDistribucion] Respuesta del backend:', distribucion);
      console.log('🔍 [DetalleDistribucion] Cantidad de elementos:', distribucion?.length);

      // Mostrar cada elemento individualmente
      if (Array.isArray(distribucion)) {
        distribucion.forEach((obra, idx) => {
          console.log(`🔍 [DetalleDistribucion] Obra ${idx}:`, {
            obraId: obra.obraId,
            nombreObra: obra.nombreObra,
            totalCobradoAsignado: obra.totalCobradoAsignado
          });
        });
      }

      // Filtrar duplicados por obraId (por si el backend devuelve duplicados)
      const distribucionUnica = Array.isArray(distribucion)
        ? distribucion.filter((obra, index, self) =>
            index === self.findIndex(o => o.obraId === obra.obraId)
          )
        : [];

      console.log('🔍 [DetalleDistribucion] Después de filtrar duplicados:', distribucionUnica.length);
      setDistribucionPorObra(distribucionUnica);
    } catch (error) {
      console.error('Error cargando distribución:', error);
      setDistribucionPorObra([]);
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  // Calcular totales basados en los datos REALES de distribucionPorObra
  const totalCobradoAsignado = distribucionPorObra.reduce((sum, o) => sum + (o.totalCobradoAsignado || 0), 0);
  const totalDistribuidoItems = distribucionPorObra.reduce((sum, o) => {
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
                    <strong>Vista consolidada:</strong> Mostrando distribución de cobros en <strong>{distribucionPorObra.length} obra(s)</strong>
                  </div>
                  <div className="mt-3">
                    <div className="row text-center">
                      <div className="col-md-3">
                        <strong className="fs-6">Total Asignado:</strong>
                        <div className="fw-bold fs-4 text-success">
                          {formatearMoneda(totalCobradoAsignado)}
                        </div>
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
                        <strong className="fs-6">Saldo Disponible:</strong>
                        <div className={`fw-bold fs-4 ${saldoDisponibleReal > 0 ? 'text-success' : 'text-muted'}`}>
                          {formatearMoneda(saldoDisponibleReal)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabla de distribución por obra */}
                <div className="table-responsive">
                  <table className="table table-hover table-striped">
                    <thead className="table-info">
                      <tr>
                        <th>Obra</th>
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
                      {distribucionPorObra.map((obra, idx) => {
                        const totalDistribuido = (obra.montoProfesionales || 0) +
                                                 (obra.montoMateriales || 0) +
                                                 (obra.montoGastosGenerales || 0) +
                                                 (obra.montoTrabajosExtra || 0);
                        const retiradoObra = retirosPorObraMap[obra.obraId] || 0;
                        const saldoDisponible = (obra.totalCobradoAsignado || 0) - totalDistribuido - retiradoObra;
                        const tieneDistribucion = totalDistribuido > 0;

                        return (
                          <tr key={idx} className={!tieneDistribucion ? 'table-warning table-warning-subtle' : ''}>
                            <td>
                              <strong>{obra.nombreObra}</strong>
                              {!tieneDistribucion && (
                                <div className="text-muted small">
                                  <i className="bi bi-exclamation-triangle me-1"></i>
                                  Sin distribución en items
                                </div>
                              )}
                            </td>
                            <td className="text-end text-success fw-bold">
                              {formatearMoneda(obra.totalCobradoAsignado || 0)}
                            </td>
                            <td className="text-end">
                              {formatearMoneda(obra.montoProfesionales || 0)}
                            </td>
                            <td className="text-end">
                              {formatearMoneda(obra.montoMateriales || 0)}
                            </td>
                            <td className="text-end">
                              {formatearMoneda(obra.montoGastosGenerales || 0)}
                            </td>
                            <td className="text-end">
                              {formatearMoneda(obra.montoTrabajosExtra || 0)}
                            </td>
                            <td className="text-end text-primary fw-bold">
                              {formatearMoneda(totalDistribuido)}
                            </td>
                            <td className="text-end text-danger">
                              {formatearMoneda(retiradoObra)}
                            </td>
                            <td className="text-end">
                              <span className={saldoDisponible > 0 ? 'text-success fw-bold' : 'text-muted'}>
                                {formatearMoneda(saldoDisponible)}
                              </span>
                            </td>
                            <td className="text-center">
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
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="table-light">
                      <tr className="fw-bold">
                        <td className="text-end">TOTALES:</td>
                        <td className="text-end text-success fs-6">
                          {formatearMoneda(totalCobradoAsignado)}
                        </td>
                        <td className="text-end">
                          {formatearMoneda(distribucionPorObra.reduce((sum, o) => sum + (o.montoProfesionales || 0), 0))}
                        </td>
                        <td className="text-end">
                          {formatearMoneda(distribucionPorObra.reduce((sum, o) => sum + (o.montoMateriales || 0), 0))}
                        </td>
                        <td className="text-end">
                          {formatearMoneda(distribucionPorObra.reduce((sum, o) => sum + (o.montoGastosGenerales || 0), 0))}
                        </td>
                        <td className="text-end">
                          {formatearMoneda(distribucionPorObra.reduce((sum, o) => sum + (o.montoTrabajosExtra || 0), 0))}
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
                        <h6 className="text-muted">Total Asignado</h6>
                        <h4 className="text-success mb-0">{formatearMoneda(totalCobradoAsignado)}</h4>
                        <small className="text-muted">A obras</small>
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
                    <div className="card border-success">
                      <div className="card-body text-center">
                        <h6 className="text-muted">Saldo Disponible</h6>
                        <h4 className={`mb-0 ${saldoDisponibleReal > 0 ? 'text-success' : 'text-muted'}`}>
                          {formatearMoneda(saldoDisponibleReal)}
                        </h4>
                        <small className="text-muted">Real disponible</small>
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
