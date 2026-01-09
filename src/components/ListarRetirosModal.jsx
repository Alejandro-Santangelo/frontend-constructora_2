import React, { useState, useEffect } from 'react';
import { useEmpresa } from '../EmpresaContext';
import eventBus, { FINANCIAL_EVENTS } from '../utils/eventBus';
import { 
  listarRetiros, 
  anularRetiro, 
  eliminarRetiro,
  obtenerTotales,
  formatearMoneda,
  formatearFecha,
  TIPOS_RETIRO,
  ESTADOS_RETIRO
} from '../services/retirosPersonalesService';

const ListarRetirosModal = ({ show, onHide, onSuccess }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [retiros, setRetiros] = useState([]);
  const [totales, setTotales] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState('ACTIVO');
  const [filtroTipo, setFiltroTipo] = useState('');

  useEffect(() => {
    if (show && empresaSeleccionada) {
      cargarRetiros();
      cargarTotales();
    }
  }, [show, empresaSeleccionada, filtroEstado, filtroTipo]);

  const cargarRetiros = async () => {
    setLoading(true);
    setError(null);
    try {
      const filtros = {};
      if (filtroEstado) filtros.estado = filtroEstado;
      if (filtroTipo) filtros.tipoRetiro = filtroTipo;

      const data = await listarRetiros(empresaSeleccionada.id, filtros);
      setRetiros(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando retiros:', err);
      setError('Error al cargar retiros');
      setRetiros([]);
    } finally {
      setLoading(false);
    }
  };

  const cargarTotales = async () => {
    try {
      const data = await obtenerTotales(empresaSeleccionada.id);
      setTotales(data);
    } catch (err) {
      console.error('Error cargando totales:', err);
    }
  };

  const handleAnular = async (id) => {
    if (!window.confirm('¿Está seguro de anular este retiro? El monto volverá a estar disponible.')) {
      return;
    }

    try {
      await anularRetiro(id, empresaSeleccionada.id);
      
      // 📡 Notificar que se anuló un retiro
      eventBus.emit(FINANCIAL_EVENTS.RETIRO_ANULADO, {
        empresaId: empresaSeleccionada.id,
        retiroId: id
      });
      
      if (onSuccess) {
        onSuccess({ mensaje: 'Retiro anulado exitosamente' });
      }

      cargarRetiros();
      cargarTotales();
    } catch (err) {
      console.error('Error anulando retiro:', err);
      const mensaje = err?.response?.data?.message || 'Error al anular retiro';
      alert(`❌ ${mensaje}`);
    }
  };

  const handleEliminar = async (id, estado) => {
    if (estado === 'ANULADO') {
      alert('❌ No se pueden eliminar retiros anulados');
      return;
    }

    if (!window.confirm('⚠️ ¿Está seguro de eliminar este retiro? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await eliminarRetiro(id, empresaSeleccionada.id);
      
      // 📡 Notificar que se eliminó un retiro
      eventBus.emit(FINANCIAL_EVENTS.RETIRO_ELIMINADO, {
        empresaId: empresaSeleccionada.id,
        retiroId: id
      });
      
      if (onSuccess) {
        onSuccess({ mensaje: '🗑️ Retiro eliminado exitosamente' });
      }

      cargarRetiros();
      cargarTotales();
    } catch (err) {
      console.error('Error eliminando retiro:', err);
      const mensaje = err?.response?.data?.message || 'Error al eliminar retiro';
      alert(`❌ ${mensaje}`);
    }
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{ zIndex: 2100, backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl">
        <div className="modal-content">
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title">
              <i className="bi bi-wallet2 me-2"></i>
              Retiros Personales
            </h5>
            <button type="button" className="btn btn-light btn-sm ms-auto" onClick={onHide}>
              Cerrar
            </button>
          </div>

          <div className="modal-body">
            {/* Resumen de totales */}
            {totales && (
              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <div className="card h-100 border-success shadow-sm">
                    <div className="card-body text-center py-4">
                      <div className="mb-2">
                        <i className="bi bi-wallet2 text-success" style={{ fontSize: '2rem' }}></i>
                      </div>
                      <h6 className="text-muted mb-2 text-uppercase" style={{ fontSize: '0.75rem' }}>
                        Total Retirado
                      </h6>
                      <h3 className="text-success mb-1 fw-bold" style={{ whiteSpace: 'nowrap' }}>
                        {formatearMoneda(totales.totalRetiros)}
                      </h3>
                      <small className="text-muted">
                        <i className="bi bi-receipt me-1"></i>
                        {totales.cantidadRetiros} retiro(s)
                      </small>
                    </div>
                  </div>
                </div>
                {totales.retirosPorTipo && Object.entries(totales.retirosPorTipo).map(([tipo, monto]) => (
                  <div key={tipo} className="col-md-6">
                    <div className="card h-100 border-light shadow-sm">
                      <div className="card-body text-center py-4">
                        <div className="mb-2">
                          <i className={`bi ${tipo === 'GANANCIA' ? 'bi-trophy' : tipo === 'PRESTAMO' ? 'bi-arrow-down-circle' : 'bi-bag'} text-primary`} style={{ fontSize: '2rem' }}></i>
                        </div>
                        <h6 className="text-muted mb-2 text-uppercase" style={{ fontSize: '0.75rem' }}>
                          {TIPOS_RETIRO[tipo] || tipo}
                        </h6>
                        <h4 className="mb-0 fw-bold text-primary" style={{ whiteSpace: 'nowrap' }}>
                          {formatearMoneda(monto)}
                        </h4>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Filtros */}
            <div className="card mb-4 border-0 shadow-sm">
              <div className="card-body bg-light">
                <div className="row g-3 align-items-end">
                  <div className="col-md-4">
                    <label className="form-label fw-semibold mb-2">
                      <i className="bi bi-funnel me-2"></i>
                      Estado
                    </label>
                    <select
                      className="form-select"
                      value={filtroEstado}
                      onChange={(e) => setFiltroEstado(e.target.value)}
                    >
                      <option value="">📋 Todos los estados</option>
                      <option value="ACTIVO">✓ Activos</option>
                      <option value="ANULADO">✗ Anulados</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold mb-2">
                      <i className="bi bi-tag me-2"></i>
                      Tipo de Retiro
                    </label>
                    <select
                      className="form-select"
                      value={filtroTipo}
                      onChange={(e) => setFiltroTipo(e.target.value)}
                    >
                      <option value="">📦 Todos los tipos</option>
                      {Object.entries(TIPOS_RETIRO).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <button 
                      className="btn btn-outline-secondary w-100"
                      onClick={() => {
                        setFiltroEstado('');
                        setFiltroTipo('');
                      }}
                    >
                      <i className="bi bi-x-circle me-2"></i>
                      Limpiar Filtros
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="alert alert-danger">
                <i className="bi bi-exclamation-triangle me-2"></i>
                {error}
              </div>
            )}

            {/* Tabla de retiros */}
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-success" role="status">
                  <span className="visually-hidden">Cargando...</span>
                </div>
                <p className="mt-2 text-muted">Cargando retiros...</p>
              </div>
            ) : retiros.length === 0 ? (
              <div className="alert alert-info text-center">
                <i className="bi bi-info-circle me-2"></i>
                No hay retiros registrados con los filtros seleccionados
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover table-sm">
                  <thead className="table-light">
                    <tr>
                      <th>ID</th>
                      <th>Fecha</th>
                      <th>Monto</th>
                      <th>Tipo</th>
                      <th>Motivo</th>
                      <th>Estado</th>
                      <th className="text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {retiros.map(retiro => (
                      <tr key={retiro.id} className={retiro.estado === 'ANULADO' ? 'table-secondary' : ''}>
                        <td>
                          <small className="font-monospace">#{retiro.id}</small>
                        </td>
                        <td>{formatearFecha(retiro.fechaRetiro)}</td>
                        <td className="fw-bold text-success">
                          {formatearMoneda(retiro.monto)}
                        </td>
                        <td>
                          <span className="badge bg-info text-dark">
                            {TIPOS_RETIRO[retiro.tipoRetiro] || retiro.tipoRetiro}
                          </span>
                        </td>
                        <td>
                          <small>{retiro.motivo || '-'}</small>
                          {retiro.observaciones && (
                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                              {retiro.observaciones}
                            </div>
                          )}
                        </td>
                        <td>
                          {retiro.estado === 'ACTIVO' ? (
                            <span className="badge bg-success">✓ Activo</span>
                          ) : (
                            <span className="badge bg-secondary">✗ Anulado</span>
                          )}
                        </td>
                        <td>
                          <div className="btn-group btn-group-sm" role="group">
                            {retiro.estado === 'ACTIVO' && (
                              <button
                                className="btn btn-warning"
                                onClick={() => handleAnular(retiro.id)}
                                title="Anular retiro"
                              >
                                ✗
                              </button>
                            )}
                            <button
                              className="btn btn-danger"
                              onClick={() => handleEliminar(retiro.id, retiro.estado)}
                              disabled={retiro.estado === 'ANULADO'}
                              title={retiro.estado === 'ANULADO' ? 'No se pueden eliminar retiros anulados' : 'Eliminar retiro'}
                              style={retiro.estado === 'ANULADO' ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="table-light fw-bold">
                    <tr>
                      <td colSpan="2" className="text-end">TOTAL:</td>
                      <td className="text-success">
                        {formatearMoneda(
                          retiros
                            .filter(r => r.estado === 'ACTIVO')
                            .reduce((sum, r) => sum + parseFloat(r.monto), 0)
                        )}
                      </td>
                      <td colSpan="4">
                        <small className="text-muted">
                          (Solo retiros activos)
                        </small>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onHide}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListarRetirosModal;
