import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectObraById } from '../store/slices/obrasSlice';

const ListarTodosPresupuestosNoClienteModal = ({ show, onClose, empresaId, apiService, onEditarSoloFechas }) => {
  const [presupuestos, setPresupuestos] = useState([]);
  const [presupuestosFiltrados, setPresupuestosFiltrados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Obtener todas las obras del store
  const obras = useSelector(state => state.obras.obras || []);
  
  // Filtros
  const [filtroVersion, setFiltroVersion] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
  const [filtroObraId, setFiltroObraId] = useState('');

  useEffect(() => {
    if (show && empresaId) {
      cargarPresupuestos();
    }
  }, [show, empresaId, filtroObraId]);

  // Aplicar filtros cuando cambien los presupuestos o los filtros
  useEffect(() => {
    aplicarFiltros();
  }, [presupuestos, filtroVersion, filtroEstado, filtroFechaDesde, filtroFechaHasta, filtroObraId]);

  const cargarPresupuestos = async () => {
    setLoading(true);
    setError(null);
    try {
      // Backend filtra automáticamente con Hibernate Filter
      // Si hay filtroObraId, pasarlo al backend para filtrar directamente
      const response = await apiService.presupuestosNoCliente.getAll(empresaId, filtroObraId || null);
      const lista = Array.isArray(response) ? response : (response.datos || response.content || []);
      
      setPresupuestos(lista);
      setPresupuestosFiltrados(lista);
    } catch (err) {
      setError(err.message || 'Error al cargar presupuestos');
    } finally {
      setLoading(false);
    }
  };

  const aplicarFiltros = () => {
    let resultado = [...presupuestos];

    // Filtro por obraId ya se aplica en el backend (getAll)
    // Filtro por versión
    if (filtroVersion !== '') {
      resultado = resultado.filter(p => Number(p.numeroVersion) === Number(filtroVersion));
    }
    // Filtro por estado
    if (filtroEstado !== '') {
      resultado = resultado.filter(p => (p.estado || 'A enviar') === filtroEstado);
    }
    // Filtro por fecha desde
    if (filtroFechaDesde !== '') {
      resultado = resultado.filter(p => {
        const fechaCreacion = p.fechaCreacion || '';
        return fechaCreacion >= filtroFechaDesde;
      });
    }
    // Filtro por fecha hasta
    if (filtroFechaHasta !== '') {
      resultado = resultado.filter(p => {
        const fechaCreacion = p.fechaCreacion || '';
        return fechaCreacion <= filtroFechaHasta;
      });
    }

    setPresupuestosFiltrados(resultado);
  };

  const limpiarFiltros = () => {
    setFiltroVersion('');
    setFiltroEstado('');
    setFiltroFechaDesde('');
    setFiltroFechaHasta('');
    setFiltroObraId('');
  };

  // Obtener versiones únicas para el select
  const versionesUnicas = [...new Set(presupuestos.map(p => p.numeroVersion))].sort((a, b) => a - b);
  
  // Obtener estados únicos para el select
  const estadosUnicos = [...new Set(presupuestos.map(p => p.estado || 'A enviar'))].sort();

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl" style={{ maxWidth: '95%' }}>
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="fas fa-list me-2"></i>
              Todos los Presupuestos No Cliente
            </h5>
            <button type="button" className="btn btn-light btn-sm ms-auto" onClick={onClose}>
              Cerrar
            </button>
          </div>
          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {loading && (
              <div className="text-center py-4">
                <i className="fas fa-spinner fa-spin fa-2x text-primary"></i>
                <p className="mt-2">Cargando presupuestos...</p>
              </div>
            )}

            {error && (
              <div className="alert alert-danger">
                <i className="fas fa-exclamation-circle me-2"></i>
                {error}
              </div>
            )}

            {!loading && !error && (
              <>
                {/* Panel de filtros */}
                <div className="card mb-3">
                  <div className="card-header bg-light">
                    <div className="d-flex justify-content-between align-items-center">
                      <h6 className="mb-0">
                        <i className="fas fa-filter me-2"></i>
                        Filtros
                      </h6>
                      <button 
                        type="button" 
                        className="btn btn-sm btn-outline-secondary"
                        onClick={limpiarFiltros}
                      >
                        <i className="fas fa-times me-1"></i>
                        Limpiar filtros
                      </button>
                    </div>
                  </div>
                  <div className="card-body">
                    <div className="row g-3">
                      {/* Filtro por obraId */}
                      <div className="col-md-3">
                        <label className="form-label">Obra</label>
                        <select
                          className="form-select form-select-sm"
                          value={filtroObraId}
                          onChange={e => setFiltroObraId(e.target.value)}
                        >
                          <option value="">Todas las obras</option>
                          {obras.map(o => (
                            <option key={o.id} value={o.id}>{o.nombreObra}</option>
                          ))}
                        </select>
                      </div>
                      {/* Filtro por versión */}
                      <div className="col-md-3">
                        <label className="form-label">Versión</label>
                        <select 
                          className="form-select form-select-sm"
                          value={filtroVersion}
                          onChange={(e) => setFiltroVersion(e.target.value)}
                        >
                          <option value="">Todas las versiones</option>
                          {versionesUnicas.map(v => (
                            <option key={v} value={v}>Versión {v}</option>
                          ))}
                        </select>
                      </div>
                      {/* Filtro por estado */}
                      <div className="col-md-3">
                        <label className="form-label">Estado</label>
                        <select 
                          className="form-select form-select-sm"
                          value={filtroEstado}
                          onChange={(e) => setFiltroEstado(e.target.value)}
                        >
                          <option value="">Todos los estados</option>
                          {estadosUnicos.map(e => (
                            <option key={e} value={e}>{e}</option>
                          ))}
                        </select>
                      </div>
                      {/* Filtro por fecha desde */}
                      <div className="col-md-3">
                        <label className="form-label">Fecha creación desde</label>
                        <input 
                          type="date"
                          className="form-control form-control-sm"
                          value={filtroFechaDesde}
                          onChange={(e) => setFiltroFechaDesde(e.target.value)}
                        />
                      </div>
                      {/* Filtro por fecha hasta */}
                      <div className="col-md-3">
                        <label className="form-label">Fecha creación hasta</label>
                        <input 
                          type="date"
                          className="form-control form-control-sm"
                          value={filtroFechaHasta}
                          onChange={(e) => setFiltroFechaHasta(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Información de resultados */}
                <div className="mb-3 d-flex justify-content-between align-items-center">
                  <div>
                    <strong>Mostrando:</strong> {presupuestosFiltrados.length} de {presupuestos.length} presupuestos
                  </div>
                  {(filtroVersion || filtroEstado || filtroFechaDesde || filtroFechaHasta) && (
                    <span className="badge bg-info">
                      <i className="fas fa-filter me-1"></i>
                      Filtros activos
                    </span>
                  )}
                </div>

                {presupuestosFiltrados.length === 0 && (
                  <div className="alert alert-info">
                    <i className="fas fa-info-circle me-2"></i>
                    No hay presupuestos que coincidan con los filtros seleccionados.
                  </div>
                )}

                {presupuestosFiltrados.length > 0 && (
                <div className="table-responsive">
                  <table className="table table-hover table-bordered table-sm">
                    <thead className="table-light">
                      <tr>
                          <th>ID</th>
                          <th>Nro. Pres.</th>
                          <th>Versión</th>
                          <th>Solicitante</th>
                          <th>Nombre de Obra</th>
                          <th>Dirección Obra</th>
                          <th>Descripción</th>
                          <th>Estado</th>
                          <th>Fecha Creación</th>
                          <th>Fecha Inicio</th>
                          <th>Vencimiento</th>
                          <th>Teléfono</th>
                          <th>Mail</th>
                          <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {presupuestosFiltrados.map((p) => {
                        const obra = obras.find(o => o.id === p.idObra);
                        const nombreObra = obra?.nombreObra || p.nombreObra || '-';
                        const puedeEditarFechas = p.estado === 'APROBADO' || p.estado === 'EN_EJECUCION';
                        
                        return (
                          <tr key={p.id}>
                            <td>{p.id}</td>
                            <td>{p.numeroPresupuesto || '-'}</td>
                            <td className="text-center">
                              <span className="badge bg-secondary">{p.numeroVersion || 1}</span>
                            </td>
                            <td>{p.nombreSolicitante || '-'}</td>
                            <td>{nombreObra}</td>
                            <td>
                              {[
                                p.direccionObraCalle,
                                p.direccionObraAltura,
                                p.direccionObraPiso && `Piso ${p.direccionObraPiso}`,
                                p.direccionObraDepartamento && `Depto ${p.direccionObraDepartamento}`
                              ].filter(Boolean).join(' ') || '-'}
                            </td>
                            <td style={{ maxWidth: '200px' }}>
                              <div className="text-truncate" title={p.descripcion}>
                                {p.descripcion || '-'}
                              </div>
                            </td>
                            <td>
                              <span className={`badge ${
                                p.estado === 'APROBADO' ? 'bg-success' :
                                p.estado === 'EN_EJECUCION' ? 'bg-primary' :
                                p.estado === 'ENVIADO' ? 'bg-info' :
                                p.estado === 'RECHAZADO' ? 'bg-danger' :
                                p.estado === 'MODIFICADO' ? 'bg-warning text-dark' :
                                'bg-secondary'
                              }`}>
                                {p.estado || 'A enviar'}
                              </span>
                            </td>
                            <td>{p.fechaCreacion || '-'}</td>
                            <td>{p.fechaProbableInicio || '-'}</td>
                            <td>{p.vencimiento || '-'}</td>
                            <td>{p.telefono || '-'}</td>
                            <td>{p.mail || '-'}</td>
                            <td>
                              {puedeEditarFechas && onEditarSoloFechas && (
                                <button
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => onEditarSoloFechas(p)}
                                  title="Editar solo fechas (Fecha Probable de Inicio y Días Hábiles)"
                                >
                                  <i className="fas fa-calendar-alt me-1"></i>
                                  Editar Fechas
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                )}
              </>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListarTodosPresupuestosNoClienteModal;
