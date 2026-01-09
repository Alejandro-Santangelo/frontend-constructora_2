import React, { useState, useEffect } from 'react';
import { listarGastosPorProfesional, formatearFecha } from '../services/gastosObraService';
import { formatearMoneda } from '../services/cajaChicaService';
import { useEmpresa } from '../EmpresaContext';

const ListarGastosModal = ({ show, onHide, profesionalObraId, profesionalNombre, direccionObra, onVerDetalle }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filtros, setFiltros] = useState({
    fechaDesde: '',
    fechaHasta: ''
  });

  useEffect(() => {
    if (show && profesionalObraId && empresaSeleccionada) {
      cargarGastos();
    }
  }, [show, profesionalObraId, empresaSeleccionada]);

  const cargarGastos = async () => {
    setLoading(true);
    setError(null);
    try {
      const datos = await listarGastosPorProfesional(
        profesionalObraId,
        empresaSeleccionada.id,
        filtros.fechaDesde || null,
        filtros.fechaHasta || null
      );
      setGastos(datos || []);
    } catch (err) {
      console.error('Error cargando gastos:', err);
      setError(
        err.response?.data?.message || 
        err.response?.data?.error || 
        'Error al cargar los gastos. Por favor intente nuevamente.'
      );
      setGastos([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFiltroChange = (e) => {
    const { name, value } = e.target;
    setFiltros(prev => ({ ...prev, [name]: value }));
  };

  const handleAplicarFiltros = () => {
    cargarGastos();
  };

  const handleLimpiarFiltros = () => {
    setFiltros({
      fechaDesde: '',
      fechaHasta: ''
    });
    // Recargar sin filtros después de limpiar
    setTimeout(() => cargarGastos(), 100);
  };

  const calcularTotal = () => {
    return gastos.reduce((sum, gasto) => sum + (parseFloat(gasto.monto) || 0), 0);
  };

  const handleVerDetalle = (gasto) => {
    if (onVerDetalle) {
      onVerDetalle(gasto);
    }
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{zIndex: 2000}}>
      <div className="modal-dialog modal-xl" style={{marginTop: '120px', maxWidth: '1200px', width: '99vw'}}>
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">📋 Historial de Gastos</h5>
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

            {/* Tabla de gastos */}
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Cargando...</span>
                </div>
                <p className="mt-3">Cargando gastos...</p>
              </div>
            ) : gastos.length === 0 ? (
              <div className="alert alert-info">
                No se encontraron gastos registrados
                {(filtros.fechaDesde || filtros.fechaHasta) && ' con los filtros aplicados'}.
              </div>
            ) : (
              <>
                <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <table className="table table-striped table-bordered table-hover">
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}>
                      <tr>
                        <th style={{ width: '100px' }}>Fecha</th>
                        <th>Concepto</th>
                        <th style={{ width: '120px' }}>Monto</th>
                        <th style={{ width: '150px' }}>Comprobante</th>
                        <th style={{ width: '100px' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gastos.map((gasto, index) => (
                        <tr key={gasto.id || index}>
                          <td>{formatearFecha(gasto.fecha)}</td>
                          <td>
                            {gasto.concepto}
                            {gasto.observaciones && (
                              <div>
                                <span className="badge bg-secondary mt-1">
                                  Obs: {gasto.observaciones.substring(0, 30)}
                                  {gasto.observaciones.length > 30 && '...'}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="text-end">
                            <strong className="text-danger">
                              {formatearMoneda(gasto.monto)}
                            </strong>
                          </td>
                          <td>
                            {gasto.comprobante ? (
                              <span className="badge bg-success">{gasto.comprobante}</span>
                            ) : (
                              <span className="badge bg-secondary">Sin comprobante</span>
                            )}
                          </td>
                          <td className="text-center">
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-sm"
                              onClick={() => handleVerDetalle(gasto)}
                            >
                              👁️ Ver
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Resumen */}
                <div className="mt-3 p-3 bg-light rounded">
                  <div className="row">
                    <div className="col-md-6">
                      <strong>Total de gastos:</strong> {gastos.length}
                    </div>
                    <div className="col-md-6 text-end">
                      <strong>Monto total: </strong>
                      <span className="fs-5 text-danger">
                        {formatearMoneda(calcularTotal())}
                      </span>
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
            <button 
              type="button"
              className="btn btn-primary" 
              onClick={cargarGastos} 
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

export default ListarGastosModal;
