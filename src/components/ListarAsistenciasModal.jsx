import React, { useState, useEffect } from 'react';
import { listarAsistenciasPorProfesional, formatearFecha } from '../services/asistenciaObraService';
import { useEmpresa } from '../EmpresaContext';

const ListarAsistenciasModal = ({ show, onHide, profesionalObraId, profesionalNombre, direccionObra }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [asistencias, setAsistencias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filtros, setFiltros] = useState({
    fechaDesde: '',
    fechaHasta: ''
  });

  useEffect(() => {
    if (show && profesionalObraId && empresaSeleccionada) {
      cargarAsistencias();
    }
  }, [show, profesionalObraId, empresaSeleccionada]);

  const cargarAsistencias = async () => {
    setLoading(true);
    setError(null);
    try {
      const datos = await listarAsistenciasPorProfesional(
        profesionalObraId,
        empresaSeleccionada.id,
        filtros.fechaDesde || null,
        filtros.fechaHasta || null
      );
      setAsistencias(datos || []);
    } catch (err) {
      console.error('Error cargando asistencias:', err);
      setError(
        err.response?.data?.message || 
        err.response?.data?.error || 
        'Error al cargar las asistencias. Por favor intente nuevamente.'
      );
      setAsistencias([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFiltroChange = (e) => {
    const { name, value } = e.target;
    setFiltros(prev => ({ ...prev, [name]: value }));
  };

  const handleAplicarFiltros = () => {
    cargarAsistencias();
  };

  const handleLimpiarFiltros = () => {
    setFiltros({
      fechaDesde: '',
      fechaHasta: ''
    });
    setTimeout(() => cargarAsistencias(), 100);
  };

  const calcularTotalHoras = () => {
    return asistencias.reduce((sum, asistencia) => {
      if (asistencia.horasTrabajadas) {
        return sum + parseFloat(asistencia.horasTrabajadas);
      }
      return sum;
    }, 0);
  };

  const formatearHorasTrabajadas = (horas) => {
    if (!horas && horas !== 0) return '-';
    const h = Math.floor(horas);
    const m = Math.round((horas - h) * 60);
    return `${h}h ${m}m`;
  };

  const obtenerEstadoAsistencia = (asistencia) => {
    if (!asistencia.horaSalida) {
      return { texto: 'En curso', variant: 'warning', icono: '⏳' };
    }
    return { texto: 'Completa', variant: 'success', icono: '✓' };
  };

  const calcularDiasAsistidos = () => {
    const diasUnicos = new Set(asistencias.map(a => a.fecha));
    return diasUnicos.size;
  };

  const calcularPromedioHorasDiarias = () => {
    const totalHoras = calcularTotalHoras();
    const dias = calcularDiasAsistidos();
    return dias > 0 ? (totalHoras / dias).toFixed(2) : 0;
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{zIndex: 2000}}>
      <div className="modal-dialog modal-xl" style={{marginTop: '120px', maxWidth: '1200px', width: '99vw'}}>
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">📅 Historial de Asistencias</h5>
            <button type="button" className="btn btn-light btn-sm ms-auto" onClick={onHide}>
              Cerrar
            </button>
          </div>

          <div className="modal-body">
            {error && (
              <div className="alert alert-danger alert-dismissible fade show" role="alert">
                {error}
                <button type="button" className="btn-close" onClick={() => setError(null)}></button>
              </div>
            )}

            {/* Información del profesional */}
            <div className="mb-3 p-3 bg-light rounded">
              <div className="row">
                <div className="col-md-6">
                  <strong>Profesional:</strong> {profesionalNombre || 'No especificado'}
                </div>
                <div className="col-md-6">
                  <strong>Obra:</strong> {direccionObra || 'No especificada'}
                </div>
              </div>
            </div>

            {/* Filtros */}
            <div className="mb-3 p-3 border rounded">
              <form>
                <div className="row align-items-end">
                  <div className="col-md-4">
                    <div className="mb-3">
                      <label className="form-label">Desde</label>
                      <input
                        type="date"
                        className="form-control"
                        name="fechaDesde"
                        value={filtros.fechaDesde}
                        onChange={handleFiltroChange}
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="mb-3">
                      <label className="form-label">Hasta</label>
                      <input
                        type="date"
                        className="form-control"
                        name="fechaHasta"
                        value={filtros.fechaHasta}
                        onChange={handleFiltroChange}
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <div className="col-md-4">
                    <button 
                      type="button"
                      className="btn btn-primary me-2" 
                      onClick={handleAplicarFiltros} 
                      disabled={loading}
                    >
                      🔍 Filtrar
                    </button>
                    <button 
                      type="button"
                      className="btn btn-outline-secondary" 
                      onClick={handleLimpiarFiltros} 
                      disabled={loading}
                    >
                      ✖ Limpiar
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Tabla de asistencias */}
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Cargando...</span>
                </div>
                <p className="mt-3">Cargando asistencias...</p>
              </div>
            ) : asistencias.length === 0 ? (
              <div className="alert alert-info">
                No se encontraron registros de asistencia
                {(filtros.fechaDesde || filtros.fechaHasta) && ' con los filtros aplicados'}.
              </div>
            ) : (
              <>
                <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <table className="table table-striped table-bordered table-hover">
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}>
                      <tr>
                        <th style={{ width: '100px' }}>Fecha</th>
                        <th style={{ width: '80px' }}>Entrada</th>
                        <th style={{ width: '80px' }}>Salida</th>
                        <th style={{ width: '100px' }}>Horas</th>
                        <th style={{ width: '150px' }}>GPS Entrada</th>
                        <th style={{ width: '150px' }}>GPS Salida</th>
                        <th style={{ width: '100px' }}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asistencias.map((asistencia, index) => {
                        const estado = obtenerEstadoAsistencia(asistencia);
                        return (
                          <tr key={asistencia.id || index}>
                            <td>{formatearFecha(asistencia.fecha)}</td>
                            <td>
                              <span className="badge bg-success">{asistencia.horaEntrada || '-'}</span>
                            </td>
                            <td>
                              {asistencia.horaSalida ? (
                                <span className="badge bg-danger">{asistencia.horaSalida}</span>
                              ) : (
                                <span className="badge bg-secondary">-</span>
                              )}
                            </td>
                            <td className="text-center">
                              {asistencia.horasTrabajadas ? (
                                <strong className="text-primary">
                                  {formatearHorasTrabajadas(asistencia.horasTrabajadas)}
                                </strong>
                              ) : (
                                <span className="text-muted">En curso</span>
                              )}
                            </td>
                            <td>
                              <small className="text-muted">
                                {asistencia.latitudEntrada && asistencia.longitudEntrada ? (
                                  <>
                                    {asistencia.latitudEntrada.toFixed(4)},<br/>
                                    {asistencia.longitudEntrada.toFixed(4)}
                                  </>
                                ) : '-'}
                              </small>
                            </td>
                            <td>
                              <small className="text-muted">
                                {asistencia.latitudSalida && asistencia.longitudSalida ? (
                                  <>
                                    {asistencia.latitudSalida.toFixed(4)},<br/>
                                    {asistencia.longitudSalida.toFixed(4)}
                                  </>
                                ) : '-'}
                              </small>
                            </td>
                            <td className="text-center">
                              <span className={`badge bg-${estado.variant}`}>
                                {estado.icono} {estado.texto}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Estadísticas */}
                <div className="mt-3 p-3 bg-light rounded">
                  <h6 className="mb-3">📊 Estadísticas</h6>
                  <div className="row">
                    <div className="col-md-3 mb-2">
                      <strong>Total registros:</strong> {asistencias.length}
                    </div>
                    <div className="col-md-3 mb-2">
                      <strong>Días asistidos:</strong> {calcularDiasAsistidos()}
                    </div>
                    <div className="col-md-3 mb-2">
                      <strong>Total horas:</strong>{' '}
                      <span className="text-primary fs-6">
                        {formatearHorasTrabajadas(calcularTotalHoras())}
                      </span>
                    </div>
                    <div className="col-md-3 mb-2">
                      <strong>Promedio diario:</strong>{' '}
                      <span className="text-success fs-6">
                        {formatearHorasTrabajadas(parseFloat(calcularPromedioHorasDiarias()))}
                      </span>
                    </div>
                  </div>

                  {/* Barra de progreso visual */}
                  <div className="mt-3">
                    <div className="d-flex justify-content-between mb-1">
                      <small>Horas trabajadas</small>
                      <small>{calcularTotalHoras().toFixed(2)} horas</small>
                    </div>
                    <div className="progress" style={{ height: '20px' }}>
                      <div 
                        className="progress-bar bg-primary"
                        role="progressbar"
                        style={{ width: `${(calcularTotalHoras() / (asistencias.length * 8)) * 100}%` }}
                        aria-valuenow={calcularTotalHoras()}
                        aria-valuemin="0"
                        aria-valuemax={asistencias.length * 8}
                      ></div>
                    </div>
                    <small className="text-muted">
                      Basado en {asistencias.length} registros (jornada estándar: 8h)
                    </small>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onHide}>
              Cerrar
            </button>
            <button 
              type="button"
              className="btn btn-primary" 
              onClick={cargarAsistencias} 
              disabled={loading}
            >
              {loading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Actualizando...
                </>
              ) : (
                '🔄 Actualizar'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListarAsistenciasModal;
