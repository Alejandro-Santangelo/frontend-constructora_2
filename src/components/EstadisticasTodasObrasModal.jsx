import React, { useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useEstadisticasConsolidadas } from '../hooks/useEstadisticasConsolidadas';
import DetalleConsolidadoPorObraModal from './DetalleConsolidadoPorObraModal';
import DetalleDistribucionCobrosModal from './DetalleDistribucionCobrosModal';

const EstadisticasTodasObrasModal = ({ empresaId, empresaSeleccionada, onClose, showNotification }) => {
  const [showDesglose, setShowDesglose] = useState(false);
  const [desgloseTipo, setDesgloseTipo] = useState('');
  const [desgloseTitulo, setDesgloseTitulo] = useState('');
  const [showDistribucionCobros, setShowDistribucionCobros] = useState(false);

  const {
    estadisticas,
    loading,
    error
  } = useEstadisticasConsolidadas(empresaId, null, true);

  const abrirDesglose = (tipo, titulo) => {
    if (!estadisticas?.desglosePorObra || estadisticas.desglosePorObra.length === 0) {
      showNotification?.('warning', 'No hay datos de desglose disponibles');
      return;
    }
    setDesgloseTipo(tipo);
    setDesgloseTitulo(titulo);
    setShowDesglose(true);
  };

  const formatearMoneda = (valor) => {
    if (!valor && valor !== 0) return '$0,00';
    return `$${valor.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  };

  // Datos para gráficos
  const datosDistribucion = [
    { name: 'Cobrado', value: estadisticas.totalCobradoEmpresa || estadisticas.totalCobrado || 0, color: '#28a745' },
    { name: 'Por Cobrar', value: estadisticas.totalPresupuesto - (estadisticas.totalCobradoEmpresa || estadisticas.totalCobrado || 0), color: '#ffc107' },
    { name: 'Pagado', value: estadisticas.totalPagado, color: '#dc3545' }
  ].filter(d => d.value > 0);

  const datosBarras = [
    { categoria: 'Presupuesto', monto: estadisticas.totalPresupuesto },
    { categoria: 'Cobrado', monto: estadisticas.totalCobradoEmpresa || estadisticas.totalCobrado || 0 },
    { categoria: 'Pagado', monto: estadisticas.totalPagado },
    { categoria: 'Disponible', monto: estadisticas.saldoDisponible }
  ];

  const topObras = estadisticas.desglosePorObra
    ?.slice(0, 10)
    ?.sort((a, b) => b.totalPresupuesto - a.totalPresupuesto) || [];

  return (
    <>
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title">
              <i className="fas fa-chart-bar me-2"></i>
              Estadísticas Consolidadas - {estadisticas.cantidadObras} Obra(s)
            </h5>
            <button type="button" className="btn btn-light btn-sm ms-auto" onClick={onClose}>
              Cerrar
            </button>
          </div>

          <div className="modal-body" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
            {loading && (
              <div className="text-center py-5">
                <div className="spinner-border text-success" role="status">
                  <span className="visually-hidden">Cargando estadísticas...</span>
                </div>
                <p className="text-muted mt-2">Consolidando datos de todas las obras...</p>
              </div>
            )}

            {error && (
              <div className="alert alert-danger">
                <i className="fas fa-exclamation-triangle me-2"></i>
                {error}
              </div>
            )}

            {!loading && !error && (
              <>
                {/* Primera fila: 4 tarjetas principales */}
                <div className="row text-center mb-3">
                  <div className="col-md-3 mb-3 mb-md-0">
                    <div
                      className="border rounded p-3 bg-light"
                      onClick={() => abrirDesglose('presupuestos', '📋 Desglose de Presupuestos por Obra')}
                      style={{cursor: 'pointer'}}
                    >
                      <i className="bi bi-cash-stack fs-1 text-info"></i>
                      <h6 className="text-muted mt-2 mb-1">Total Presupuestado</h6>
                      <h4 className="text-info mb-0">{formatearMoneda(estadisticas.totalPresupuesto)}</h4>
                      <small className="text-muted">De {estadisticas.cantidadObras} obra(s)</small>
                      <div className="mt-1">
                        <small className="text-info"><i className="bi bi-hand-index"></i></small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3 mb-3 mb-md-0">
                    <div
                      className="border rounded p-3 bg-light"
                      onClick={() => abrirDesglose('cobros', '💵 Desglose de Cobros por Obra')}
                      style={{cursor: 'pointer'}}
                    >
                      <i className="bi bi-arrow-down-circle fs-1 text-success"></i>
                      <h6 className="text-muted mt-2 mb-1">Total Cobrado</h6>
                      <h4 className="text-success mb-0">{formatearMoneda(estadisticas.totalCobradoEmpresa || estadisticas.totalCobrado || 0)}</h4>
                      <small className="text-muted">{((estadisticas.totalCobradoEmpresa || estadisticas.totalCobrado || 0) / (estadisticas.totalPresupuesto || 1) * 100).toFixed(1)}% del presupuesto total</small>
                      <div className="mt-1">
                        <small className="text-success"><i className="bi bi-hand-index"></i></small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3 mb-3 mb-md-0">
                    <div
                      className="border rounded p-3 bg-light"
                      onClick={() => abrirDesglose('pagos', '💸 Desglose de Pagos por Obra')}
                      style={{cursor: 'pointer'}}
                    >
                      <i className="bi bi-arrow-up-circle fs-1 text-danger"></i>
                      <h6 className="text-muted mt-2 mb-1">Total Pagado</h6>
                      <h4 className="text-danger mb-0">{formatearMoneda(estadisticas.totalPagado)}</h4>
                      <small className="text-muted">{estadisticas.porcentajePagado.toFixed(1)}% del presupuesto total</small>
                      <div className="mt-1">
                        <small className="text-danger"><i className="bi bi-hand-index"></i></small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3 mb-3 mb-md-0">
                    <div
                      className="border rounded p-3 bg-light"
                      style={{cursor: 'pointer'}}
                    >
                      <i className="bi bi-wallet2 fs-1 text-warning"></i>
                      <h6 className="text-muted mt-2 mb-1">Total Retirado</h6>
                      <h4 className="text-warning mb-0">{formatearMoneda(estadisticas.totalRetirado || 0)}</h4>
                      <small className="text-muted">Retiros personales</small>
                      <div className="mt-1">
                        <small className="text-warning"><i className="bi bi-hand-index"></i></small>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Segunda fila: 4 tarjetas de balance */}
                <div className="row text-center">
                  <div className="col-md-3 mb-3 mb-md-0">
                    <div
                      className="border rounded p-3 bg-light"
                      onClick={() => abrirDesglose('saldoPorCobrar', '⏳ Desglose de Saldo por Cobrar por Obra')}
                      style={{cursor: 'pointer'}}
                    >
                      <i className="bi bi-hourglass-split fs-1 text-warning"></i>
                      <h6 className="text-muted mt-2 mb-1">Saldo por Cobrar</h6>
                      <h4 className="text-warning mb-0">
                        {formatearMoneda(estadisticas.totalPresupuesto - (estadisticas.totalCobradoEmpresa || estadisticas.totalCobrado || 0))}
                      </h4>
                      <small className="text-muted">
                        Falta cobrar {(
                          estadisticas.totalPresupuesto > 0
                            ? (100 * (estadisticas.totalPresupuesto - (estadisticas.totalCobradoEmpresa || estadisticas.totalCobrado || 0)) / estadisticas.totalPresupuesto)
                            : 0
                        ).toFixed(1)}% del presupuesto
                      </small>
                      <div className="mt-1">
                        <small className="text-warning"><i className="bi bi-hand-index"></i></small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3 mb-3 mb-md-0">
                    <div
                      className="border rounded p-3 bg-light"
                      onClick={() => setShowDistribucionCobros(true)}
                      style={{cursor: 'pointer'}}
                    >
                      <i className="bi bi-bank fs-1 text-info"></i>
                      <h6 className="text-muted mt-2 mb-1">Saldo disponible del Total Cobrado y Asignaciones por Ítems</h6>
                      <h4 className="text-info mb-0">
                        {(() => {
                          const totalCobrado = estadisticas.totalCobradoEmpresa || estadisticas.totalCobrado || 0;
                          const totalAsignado = estadisticas.totalAsignado || 0;
                          return formatearMoneda(totalCobrado - totalAsignado);
                        })()}
                      </h4>
                      <small className="text-muted">
                        Cobrado sin asignar a rubros
                      </small>
                      <div className="mt-1">
                        <small className="text-info"><i className="bi bi-hand-index"></i></small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3 mb-3 mb-md-0">
                    <div
                      className="border rounded p-3 bg-light"
                      onClick={() => abrirDesglose('saldoDisponible', '💰 Desglose de Saldo Disponible')}
                      style={{cursor: 'pointer'}}
                    >
                      <i className="bi bi-piggy-bank fs-1 text-primary"></i>
                      <h6 className="text-muted mt-2 mb-1">Total disponible de lo ya cobrado</h6>
                      <h4 className="mb-0 text-primary">
                        {(() => {
                          // Total cobrado menos total asignado a obras
                          if (loading) {
                            return <span className="spinner-border spinner-border-sm" role="status"></span>;
                          }

                          // Calcular: Total Cobrado - Total Asignado a obras
                          const totalCobrado = estadisticas.totalCobradoEmpresa || estadisticas.totalCobrado || 0;
                          const totalAsignado = estadisticas.totalAsignado || 0;
                          const saldoDisponible = totalCobrado - totalAsignado;
                          return formatearMoneda(saldoDisponible);
                        })()}
                      </h4>
                      <small className="text-muted">Cobrado - Asignado</small>
                      <div className="mt-1">
                        <small className="text-primary"><i className="bi bi-hand-index"></i></small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div
                      className="border rounded p-3 bg-danger bg-opacity-10"
                      onClick={() => abrirDesglose('deficit', '⚠️ Desglose de Déficit por Obra')}
                      style={{cursor: 'pointer'}}
                    >
                      <i className="bi bi-exclamation-triangle fs-1 text-danger"></i>
                      <h6 className="text-muted mt-2 mb-1">Déficit</h6>
                      <h4 className="mb-0 text-danger">
                        {(() => {
                          // Calcular suma de déficits individuales (solo obras con balance negativo)
                          const desglose = estadisticas.desglosePorObra || [];
                          const deficitTotal = desglose.reduce((sum, obra) => {
                            const balance = (obra.totalCobrado || 0) - (obra.totalPagado || 0) - (obra.totalRetirado || 0);
                            return balance < 0 ? sum + balance : sum;
                          }, 0);
                          return formatearMoneda(Math.abs(deficitTotal));
                        })()}
                      </h4>
                      <small className="text-muted">Déficit de obras individuales</small>
                      <div className="mt-1">
                        <small className="text-danger"><i className="bi bi-hand-index"></i></small>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Gráficos */}
                <div className="row mb-4">
                  <div className="col-md-6">
                    <div className="card">
                      <div className="card-header bg-light">
                        <h6 className="mb-0"><i className="fas fa-chart-pie me-2"></i>Distribución Financiera</h6>
                      </div>
                      <div className="card-body">
                        {datosDistribucion.length > 0 ? (
                          <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                              <Pie
                                data={datosDistribucion}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              >
                                {datosDistribucion.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value) => formatearMoneda(value)} />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="text-center text-muted py-5">No hay datos financieros</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div className="card">
                      <div className="card-header bg-light">
                        <h6 className="mb-0"><i className="fas fa-chart-bar me-2"></i>Comparativo de Montos</h6>
                      </div>
                      <div className="card-body">
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={datosBarras}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="categoria" />
                            <YAxis />
                            <Tooltip formatter={(value) => formatearMoneda(value)} />
                            <Legend />
                            <Bar dataKey="monto" fill="#007bff" name="Monto" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Alertas */}
                <div className="mt-4">
                {estadisticas.alertas && estadisticas.alertas.length > 0 && (
                  <div className="mb-4">
                    <h6 className="text-muted mb-3">
                      <i className="bi bi-bell-fill me-2"></i>
                      Alertas de Obras Seleccionadas ({estadisticas.alertas.length})
                    </h6>
                    <div className="row">
                      {estadisticas.alertas.map((alerta, index) => (
                        <div key={index} className="col-md-6 mb-2">
                          <div className={`alert alert-${alerta.tipo} mb-0 py-2`}>
                            <div className="d-flex align-items-start">
                              <span className="fs-4 me-2">{alerta.icono}</span>
                              <div className="flex-grow-1">
                                <strong className="d-block">{alerta.titulo}</strong>
                                <small className="d-block">{alerta.descripcion}</small>
                                {alerta.recomendacion && (
                                  <small className="d-block mt-1 fst-italic">
                                    <i className="bi bi-lightbulb me-1"></i>
                                    {alerta.recomendacion}
                                  </small>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top 10 Obras */}
                {topObras.length > 0 && (
                  <div className="card">
                    <div className="card-header bg-light">
                      <h6 className="mb-0"><i className="fas fa-trophy me-2"></i>Top 10 Obras por Presupuesto</h6>
                    </div>
                    <div className="card-body">
                      <div className="table-responsive">
                        <table className="table table-sm table-hover">
                          <thead className="table-light">
                            <tr>
                              <th>Posición</th>
                              <th>Obra</th>
                              <th className="text-end">Presupuesto</th>
                              <th className="text-end">Asignado</th>
                              <th className="text-end">Pagado</th>
                              <th className="text-end">Retirado</th>
                              <th className="text-end">Disponible</th>
                            </tr>
                          </thead>
                          <tbody>
                            {topObras.map((obra, index) => (
                              <tr key={index}>
                                <td>
                                  <span className={`badge ${index === 0 ? 'bg-warning' : index === 1 ? 'bg-secondary' : index === 2 ? 'bg-info' : 'bg-light text-dark'}`}>
                                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}°`}
                                  </span>
                                </td>
                                <td className="fw-bold">{obra.nombreObra}</td>
                                <td className="text-end">{formatearMoneda(obra.totalPresupuesto)}</td>
                                <td className="text-end">{formatearMoneda(obra.totalCobrado)}</td>
                                <td className="text-end">{formatearMoneda(obra.totalPagado)}</td>
                                <td className="text-end">{formatearMoneda(obra.totalRetirado || 0)}</td>
                                <td className="text-end text-primary fw-bold">{formatearMoneda(obra.saldoDisponible)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
                </div>
              </>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              <i className="fas fa-times me-2"></i>
              Cerrar
            </button>
            <button type="button" className="btn btn-success">
              <i className="fas fa-file-excel me-2"></i>
              Exportar Excel
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* Modal de Desglose por Obra */}
    {showDesglose && (
      <DetalleConsolidadoPorObraModal
        show={showDesglose}
        onHide={() => setShowDesglose(false)}
        tipo={desgloseTipo}
        datos={estadisticas?.desglosePorObra || []}
        titulo={desgloseTitulo}
        estadisticas={estadisticas}
        empresaSeleccionada={empresaSeleccionada}
      />
    )}

    {/* Modal de Distribución de Cobros por Obra */}
    {showDistribucionCobros && (
      <DetalleDistribucionCobrosModal
        show={showDistribucionCobros}
        onHide={() => setShowDistribucionCobros(false)}
        datos={estadisticas?.desglosePorObra || []}
        estadisticas={estadisticas}
      />
    )}
    </>
  );
};

export default EstadisticasTodasObrasModal;
