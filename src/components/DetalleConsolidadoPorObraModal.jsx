import React, { useState, useEffect } from 'react';
import { formatearMoneda } from '../services/cobrosObraService';
import { listarPagosConsolidadosPorEmpresa } from '../services/pagosConsolidadosService';
import apiService from '../services/api';

/**
 * Modal para mostrar el desglose detallado por obra de un concepto financiero
 * Se usa en modo consolidado al hacer clic en las tarjetas del resumen
 */
const DetalleConsolidadoPorObraModal = ({ show, onHide, tipo, datos, titulo, estadisticas, empresaSeleccionada }) => {
  const [mostrandoDetallePagos, setMostrandoDetallePagos] = useState(false);
  const [pagosDetallados, setPagosDetallados] = useState([]);
  const [cargandoPagos, setCargandoPagos] = useState(false);

  if (!show) return null;

  // Cargar detalle de pagos
  const cargarDetallePagos = async () => {
    if (!empresaSeleccionada?.id) {
      console.error('No hay empresa seleccionada');
      return;
    }

    setCargandoPagos(true);
    try {
      console.log('🔍 Cargando TODOS los pagos detallados...');

      // 1. Cargar pagos consolidados (materiales y gastos generales)
      const pagosConsolidados = await listarPagosConsolidadosPorEmpresa(empresaSeleccionada.id);

      // 2. Cargar pagos de trabajos extra
      const pagosTrabajosExtra = await apiService.pagosTrabajoExtra.getByEmpresa(empresaSeleccionada.id).catch(err => {
        console.warn('⚠️ Error cargando pagos de trabajos extra:', err);
        return [];
      });

      // 3. Cargar pagos de profesionales por obra
      let pagosProfesionales = [];
      if (datos && datos.length > 0) {
        const promesasPagos = datos.map(async (obra) => {
          try {
            const response = await apiService.get('/api/v1/pagos-profesional-obra', {
              params: {
                empresaId: empresaSeleccionada.id,
                obraId: obra.obraId
              }
            });

            const pagosArray = Array.isArray(response) ? response :
                              response?.data ? response.data : [];

            return pagosArray.map(p => ({
              ...p,
              nombreObra: obra.nombreObra,
              tipoItem: 'PROFESIONAL_OBRA'
            }));
          } catch (error) {
            console.warn(`⚠️ Error cargando pagos de obra ${obra.nombreObra}:`, error);
            return [];
          }
        });

        const resultados = await Promise.all(promesasPagos);
        pagosProfesionales = resultados.flat();
      }

      // Combinar todos los pagos
      const todosLosPagos = [
        ...pagosProfesionales.map(p => ({
          ...p,
          tipoItem: 'PROFESIONAL_OBRA',
          descripcion: p.nombreProfesional || p.nombre || 'Profesional',
          monto: p.montoNeto || p.montoBruto
        })),
        ...pagosConsolidados.map(p => ({
          ...p,
          tipoItem: p.tipoItem || (p.concepto?.includes('material') ? 'MATERIAL' : 'GASTO_GENERAL'),
          descripcion: p.concepto || p.descripcion || 'Pago consolidado',
          nombreObra: datos?.[0]?.nombreObra || 'N/A'
        })),
        ...pagosTrabajosExtra.map(p => ({
          ...p,
          tipoItem: 'TRABAJO_EXTRA',
          descripcion: p.concepto || p.nombre || 'Trabajo Extra',
          monto: p.montoFinal || p.montoBase,
          nombreObra: p.nombreObra || datos?.[0]?.nombreObra || 'N/A'
        }))
      ];

      console.log(`✅ Total de pagos cargados: ${todosLosPagos.length}`);
      console.log(`  - Profesionales: ${pagosProfesionales.length}`);
      console.log(`  - Consolidados: ${pagosConsolidados.length}`);
      console.log(`  - Trabajos Extra: ${pagosTrabajosExtra.length}`);

      setPagosDetallados(todosLosPagos);
      setMostrandoDetallePagos(true);
    } catch (error) {
      console.error('Error cargando detalle de pagos:', error);
      alert('Error al cargar el detalle de pagos');
    } finally {
      setCargandoPagos(false);
    }
  };

  // Función para renderizar según el tipo de dato
  const renderContenido = () => {
    if (!datos || datos.length === 0) {
      return (
        <div className="alert alert-info">
          No hay datos disponibles para mostrar.
        </div>
      );
    }

    switch (tipo) {
      case 'presupuestos':
        return renderPresupuestos();
      case 'cobros':
        return renderCobros();
      case 'pagos':
        return renderPagos();
      case 'saldoPorCobrar':
        return renderSaldoPorCobrar();
      case 'balanceNeto':
        return renderBalanceNeto();
      case 'deficit':
        return renderDeficit();
      default:
        return null;
    }
  };

  const renderPresupuestos = () => {
    // Calcular el total incluyendo trabajos extra
    const totalConTrabajosExtra = datos.reduce((sum, o) => {
      const presupuestoBase = o.totalPresupuesto || 0;
      const trabajosExtra = (o.trabajosExtra || []).reduce((s, t) => s + (t.totalCalculado || 0), 0);
      return sum + presupuestoBase + trabajosExtra;
    }, 0);

    return (
      <div className="table-responsive">
        <table className="table table-hover table-striped">
          <thead className="table-primary">
            <tr>
              <th>Obra</th>
              <th>Estado</th>
              <th className="text-end">Monto Presupuestado</th>
            </tr>
          </thead>
          <tbody>
            {datos.map((obra, idx) => (
              <>
                <tr key={idx}>
                  <td>
                    <strong>{obra.nombreObra}</strong>
                    <div className="text-muted small">
                      Presupuesto #{obra.numeroPresupuesto || 'N/A'}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${
                      obra.estado === 'APROBADO' ? 'bg-success' :
                      obra.estado === 'EN_EJECUCION' ? 'bg-primary' :
                      'bg-secondary'
                    }`}>
                      {obra.estado || 'N/A'}
                    </span>
                  </td>
                  <td className="text-end">
                    <strong className="text-primary">
                      {formatearMoneda(obra.totalPresupuesto || 0)}
                    </strong>
                  </td>
                </tr>
                {/* Mostrar trabajos extra como filas adicionales */}
                {obra.trabajosExtra && obra.trabajosExtra.length > 0 && obra.trabajosExtra.map((trabajo, tIdx) => (
                  <tr key={`${idx}-trabajo-${tIdx}`} className="table-active">
                    <td className="ps-4">
                      <i className="bi bi-arrow-return-right me-2 text-muted"></i>
                      <span className="text-muted">Trabajo Extra: {trabajo.nombre}</span>
                    </td>
                    <td>
                      <span className="badge bg-info">EXTRA</span>
                    </td>
                    <td className="text-end">
                      <span className="text-info">
                        {formatearMoneda(trabajo.totalCalculado || 0)}
                      </span>
                    </td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
          <tfoot className="table-light">
            <tr>
              <td colSpan="2" className="text-end"><strong>TOTAL:</strong></td>
              <td className="text-end">
                <strong className="text-primary fs-5">
                  {formatearMoneda(totalConTrabajosExtra)}
                </strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  const renderCobros = () => (
    <div className="table-responsive">
      <table className="table table-hover table-striped">
        <thead className="table-success">
          <tr>
            <th>Obra</th>
            <th className="text-center">Cantidad de Asignaciones</th>
            <th className="text-end">Importe Asignado</th>
            <th className="text-end">Pendiente</th>
          </tr>
        </thead>
        <tbody>
          {datos.map((obra, idx) => (
            <tr key={idx}>
              <td>
                <strong>{obra.nombreObra}</strong>
              </td>
              <td className="text-center">
                <span className="badge bg-info">{obra.cantidadCobros || 0}</span>
              </td>
              <td className="text-end">
                <strong className="text-success">{formatearMoneda(obra.totalCobrado || 0)}</strong>
                <br />
                <small className="text-muted">Asignado de cobros globales</small>
              </td>
              <td className="text-end">
                <span className="text-warning">{formatearMoneda(obra.cobrosPendientes || 0)}</span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="table-light">
          <tr>
            <td className="text-end"><strong>TOTAL ASIGNADO:</strong></td>
            <td className="text-center">
              <span className="badge bg-info fs-6">
                {datos.reduce((sum, o) => sum + (o.cantidadCobros || 0), 0)}
              </span>
            </td>
            <td className="text-end">
              <strong className="text-success fs-5">
                {formatearMoneda(datos.reduce((sum, o) => sum + (o.totalCobrado || 0), 0))}
              </strong>
            </td>
            <td className="text-end">
              <strong className="text-warning fs-5">
                {formatearMoneda(datos.reduce((sum, o) => sum + (o.cobrosPendientes || 0), 0))}
              </strong>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );

  const renderPagos = () => (
    <>
      <div className="table-responsive">
        <table className="table table-hover table-striped">
          <thead className="table-primary">
            <tr>
              <th>Obra</th>
              <th className="text-center">Cantidad de Pagos</th>
              <th className="text-end">Total Pagado</th>
              <th className="text-end">Pendiente</th>
              <th className="text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {datos.map((obra, idx) => (
              <tr key={idx}>
                <td>
                  <strong>{obra.nombreObra}</strong>
                </td>
                <td className="text-center">
                  <span className="badge bg-info">{obra.cantidadPagos || 0}</span>
                </td>
                <td className="text-end">
                  <strong className="text-primary">{formatearMoneda(obra.totalPagado || 0)}</strong>
                </td>
                <td className="text-end">
                  <span className="text-warning">{formatearMoneda(obra.pagosPendientes || 0)}</span>
                </td>
                <td className="text-center">
                  <button
                    className="btn btn-sm btn-outline-primary"
                    onClick={cargarDetallePagos}
                    disabled={cargandoPagos}
                  >
                    {cargandoPagos ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1"></span>
                        Cargando...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-eye me-1"></i>
                        Ver Detalle
                      </>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="table-light">
            <tr>
              <td className="text-end"><strong>TOTAL:</strong></td>
              <td className="text-center">
                <span className="badge bg-info fs-6">
                  {datos.reduce((sum, o) => sum + (o.cantidadPagos || 0), 0)}
                </span>
              </td>
              <td className="text-end">
                <strong className="text-primary fs-5">
                  {formatearMoneda(datos.reduce((sum, o) => sum + (o.totalPagado || 0), 0))}
                </strong>
              </td>
              <td className="text-end">
                <strong className="text-warning fs-5">
                  {formatearMoneda(datos.reduce((sum, o) => sum + (o.pagosPendientes || 0), 0))}
                </strong>
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Modal anidado para mostrar detalle de pagos */}
      {mostrandoDetallePagos && (
        <div
          className="modal show d-block"
          style={{ zIndex: 3000, backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setMostrandoDetallePagos(false)}
        >
          <div
            className="modal-dialog modal-xl modal-dialog-scrollable"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content">
              <div className="modal-header bg-info text-white">
                <h5 className="modal-title">
                  <i className="bi bi-receipt me-2"></i>
                  Detalle de Pagos Realizados
                </h5>
                <button
                  type="button"
                  className="btn btn-light btn-sm ms-auto"
                  onClick={() => setMostrandoDetallePagos(false)}
                >
                  Cerrar
                </button>
              </div>
              <div className="modal-body" style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
                {pagosDetallados.length === 0 ? (
                  <div className="alert alert-info">
                    <i className="bi bi-info-circle me-2"></i>
                    No se encontraron pagos registrados para esta empresa.
                  </div>
                ) : (
                  <>
                    <div className="alert alert-success mb-3">
                      <div className="d-flex justify-content-between align-items-center">
                        <span>
                          <i className="bi bi-check-circle me-2"></i>
                          Total de pagos encontrados: <strong>{pagosDetallados.length}</strong>
                        </span>
                        <span className="fs-5">
                          Total: <strong className="text-primary">{formatearMoneda(pagosDetallados.reduce((sum, p) => sum + (p.monto || 0), 0))}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="table-responsive">
                      <table className="table table-sm table-hover table-striped">
                        <thead className="table-info">
                          <tr>
                            <th style={{ width: '80px' }}>ID</th>
                            <th>Fecha</th>
                            <th>Tipo de Pago</th>
                            <th>Descripción</th>
                            <th>Obra</th>
                            <th className="text-end">Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagosDetallados.map((pago, idx) => (
                            <tr key={idx}>
                              <td>
                                <span className="badge bg-secondary">#{pago.id}</span>
                              </td>
                              <td>
                                <small>
                                  {pago.fechaPago
                                    ? new Date(pago.fechaPago).toLocaleDateString('es-AR', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit'
                                      })
                                    : 'N/A'}
                                </small>
                              </td>
                              <td>
                                <span className={`badge ${
                                  pago.tipoItem === 'PROFESIONAL_OBRA' ? 'bg-primary' :
                                  pago.tipoItem === 'MATERIAL' ? 'bg-warning text-dark' :
                                  pago.tipoItem === 'GASTO_GENERAL' ? 'bg-danger' :
                                  pago.tipoItem === 'TRABAJO_EXTRA' ? 'bg-success' :
                                  'bg-secondary'
                                }`}>
                                  {pago.tipoItem === 'PROFESIONAL_OBRA' ? 'Profesional' :
                                   pago.tipoItem === 'MATERIAL' ? 'Material' :
                                   pago.tipoItem === 'GASTO_GENERAL' ? 'Gasto General' :
                                   pago.tipoItem === 'TRABAJO_EXTRA' ? 'Trabajo Extra' :
                                   pago.tipoItem || 'N/A'}
                                </span>
                              </td>
                              <td>
                                <div className="text-truncate" style={{ maxWidth: '250px' }}>
                                  {pago.descripcion || pago.observaciones || '-'}
                                </div>
                              </td>
                              <td>
                                <strong>{pago.nombreObra || pago.obra?.nombre || 'N/A'}</strong>
                              </td>
                              <td className="text-end">
                                <strong className="text-primary">
                                  {formatearMoneda(pago.monto || 0)}
                                </strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="table-light">
                          <tr>
                            <td colSpan="5" className="text-end"><strong>TOTAL PAGADO:</strong></td>
                            <td className="text-end">
                              <strong className="text-primary fs-5">
                                {formatearMoneda(pagosDetallados.reduce((sum, p) => sum + (p.monto || 0), 0))}
                              </strong>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Resumen por tipo de pago */}
                    <div className="mt-4">
                      <h6 className="mb-3">
                        <i className="bi bi-pie-chart me-2"></i>
                        Resumen por Tipo de Pago
                      </h6>
                      <div className="row g-3">
                        {['PROFESIONAL_OBRA', 'MATERIAL', 'GASTO_GENERAL', 'TRABAJO_EXTRA'].map(tipo => {
                          const pagosTipo = pagosDetallados.filter(p => p.tipoItem === tipo);
                          const totalTipo = pagosTipo.reduce((sum, p) => sum + (p.monto || 0), 0);

                          if (pagosTipo.length === 0) return null;

                          return (
                            <div key={tipo} className="col-md-6">
                              <div className={`card border-${
                                tipo === 'PROFESIONAL_OBRA' ? 'primary' :
                                tipo === 'MATERIAL' ? 'warning' :
                                tipo === 'GASTO_GENERAL' ? 'danger' :
                                'success'
                              }`}>
                                <div className="card-body">
                                  <h6 className={`card-title text-${
                                    tipo === 'PROFESIONAL_OBRA' ? 'primary' :
                                    tipo === 'MATERIAL' ? 'warning' :
                                    tipo === 'GASTO_GENERAL' ? 'danger' :
                                    'success'
                                  }`}>
                                    {tipo === 'PROFESIONAL_OBRA' ? '👷 Profesionales' :
                                     tipo === 'MATERIAL' ? '🧱 Materiales' :
                                     tipo === 'GASTO_GENERAL' ? '💰 Gastos Generales' :
                                     '🔧 Trabajos Extra'}
                                  </h6>
                                  <div className="d-flex justify-content-between align-items-center">
                                    <span className="text-muted">
                                      {pagosTipo.length} pago{pagosTipo.length !== 1 ? 's' : ''}
                                    </span>
                                    <strong className="fs-5">{formatearMoneda(totalTipo)}</strong>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setMostrandoDetallePagos(false)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const renderSaldoPorCobrar = () => {
    // Calcular total presupuestado incluyendo trabajos extra
    const totalPresupuestado = datos.reduce((sum, o) => {
      const totalObra = o.totalPresupuesto || 0;
      const totalTrabajosExtra = o.trabajosExtra?.reduce((s, t) => s + (t.totalCalculado || 0), 0) || 0;
      return sum + totalObra + totalTrabajosExtra;
    }, 0);

    // Usar total cobrado a la empresa (no las asignaciones a obras)
    const totalCobradoEmpresa = estadisticas?.totalCobradoEmpresa || 0;

    // Calcular saldo por cobrar
    const totalSaldoPorCobrar = totalPresupuestado - totalCobradoEmpresa;

    return (
      <div className="table-responsive">
        <table className="table table-hover table-striped">
          <thead className="table-warning">
            <tr>
              <th>Obra</th>
              <th className="text-end">Total Presupuestado</th>
              <th className="text-end">Saldo por Cobrar</th>
            </tr>
          </thead>
          <tbody>
            {datos.map((obra, idx) => {
              const saldo = (obra.totalPresupuesto || 0);
              const totalTrabajosExtra = obra.trabajosExtra?.reduce((sum, t) => sum + (t.totalCalculado || 0), 0) || 0;
              const totalObraConTrabajosExtra = saldo + totalTrabajosExtra;

              return (
                <React.Fragment key={idx}>
                  <tr>
                    <td>
                      <strong>{obra.nombreObra}</strong>
                    </td>
                    <td className="text-end">{formatearMoneda(obra.totalPresupuesto || 0)}</td>
                    <td className="text-end">
                      <strong className="text-danger">{formatearMoneda(saldo)}</strong>
                    </td>
                  </tr>
                  {obra.trabajosExtra && obra.trabajosExtra.length > 0 && obra.trabajosExtra.map((trabajo, tIdx) => (
                    <tr key={`${idx}-trabajo-${tIdx}`} className="table-active">
                      <td className="ps-4">
                        <i className="bi bi-arrow-return-right me-2"></i>
                        <small><strong>Trabajo Extra: {trabajo.nombre}</strong></small>
                      </td>
                      <td className="text-end">
                        <small><strong>{formatearMoneda(trabajo.totalCalculado || 0)}</strong></small>
                      </td>
                      <td className="text-end">
                        <small className="text-danger"><strong>{formatearMoneda(trabajo.totalCalculado || 0)}</strong></small>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot className="table-light">
            <tr>
              <td className="text-end"><strong>TOTAL PRESUPUESTADO:</strong></td>
              <td className="text-end">
                {formatearMoneda(totalPresupuestado)}
              </td>
              <td className="text-end" rowSpan="3">
                <strong className="text-danger fs-5">
                  {formatearMoneda(totalSaldoPorCobrar)}
                </strong>
              </td>
            </tr>
            <tr>
              <td className="text-end"><strong>TOTAL COBRADO A {empresaSeleccionada?.razonSocial || 'EMPRESA'}:</strong></td>
              <td className="text-end text-success">
                {formatearMoneda(totalCobradoEmpresa)}
              </td>
            </tr>
            <tr>
              <td className="text-end"><strong>SALDO POR COBRAR:</strong></td>
              <td className="text-end">
                {formatearMoneda(totalSaldoPorCobrar)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  const renderDeficit = () => {
    // Filtrar solo obras con déficit (balance negativo)
    const obrasConDeficit = datos.filter(obra => {
      const balance = (obra.totalCobrado || 0) - (obra.totalPagado || 0) - (obra.totalRetirado || 0);
      return balance < 0;
    });

    if (obrasConDeficit.length === 0) {
      return (
        <div className="alert alert-success">
          <i className="bi bi-check-circle me-2"></i>
          <strong>¡Excelente!</strong> No hay obras con déficit. Todas las obras tienen saldo positivo o neutro.
        </div>
      );
    }

    return (
      <div className="table-responsive">
        <table className="table table-hover table-striped">
          <thead className="table-danger">
            <tr>
              <th>Obra</th>
              <th className="text-end">Total Cobrado</th>
              <th className="text-end">Total Pagado</th>
              <th className="text-end">Total Retirado</th>
              <th className="text-end">Déficit</th>
            </tr>
          </thead>
          <tbody>
            {obrasConDeficit.map((obra, idx) => {
              const balance = (obra.totalCobrado || 0) - (obra.totalPagado || 0) - (obra.totalRetirado || 0);
              return (
                <tr key={idx} className="table-danger table-danger-subtle">
                  <td>
                    <strong>{obra.nombreObra}</strong>
                    <div className="text-muted small">
                      <i className="bi bi-exclamation-triangle me-1"></i>
                      Requiere atención urgente
                    </div>
                  </td>
                  <td className="text-end text-success">{formatearMoneda(obra.totalCobrado || 0)}</td>
                  <td className="text-end text-danger">{formatearMoneda(obra.totalPagado || 0)}</td>
                  <td className="text-end text-warning">{formatearMoneda(obra.totalRetirado || 0)}</td>
                  <td className="text-end">
                    <strong className="text-danger fs-6">
                      {formatearMoneda(balance)}
                    </strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="table-light">
            <tr>
              <td className="text-end"><strong>TOTAL DÉFICIT:</strong></td>
              <td className="text-end text-success">
                {formatearMoneda(obrasConDeficit.reduce((sum, o) => sum + (o.totalCobrado || 0), 0))}
              </td>
              <td className="text-end text-danger">
                {formatearMoneda(obrasConDeficit.reduce((sum, o) => sum + (o.totalPagado || 0), 0))}
              </td>
              <td className="text-end text-warning">
                {formatearMoneda(obrasConDeficit.reduce((sum, o) => sum + (o.totalRetirado || 0), 0))}
              </td>
              <td className="text-end">
                <strong className="text-danger fs-5">
                  {formatearMoneda(
                    obrasConDeficit.reduce((sum, o) => sum + ((o.totalCobrado || 0) - (o.totalPagado || 0) - (o.totalRetirado || 0)), 0)
                  )}
                </strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  const renderBalanceNeto = () => (
    <div className="table-responsive">
      <table className="table table-hover table-striped">
        <thead className="table-info">
          <tr>
            <th>Obra</th>
            <th className="text-end">Total Asignado</th>
            <th className="text-end">Total Pagado</th>
            <th className="text-end">Total Retirado</th>
            <th className="text-end">Balance Neto</th>
          </tr>
        </thead>
        <tbody>
          {datos.map((obra, idx) => {
            const balance = (obra.totalCobrado || 0) - (obra.totalPagado || 0) - (obra.totalRetirado || 0);
            return (
              <tr key={idx}>
                <td>
                  <strong>{obra.nombreObra}</strong>
                </td>
                <td className="text-end text-success">{formatearMoneda(obra.totalCobrado || 0)}</td>
                <td className="text-end text-primary">{formatearMoneda(obra.totalPagado || 0)}</td>
                <td className="text-end text-warning">{formatearMoneda(obra.totalRetirado || 0)}</td>
                <td className="text-end">
                  <strong className={balance >= 0 ? 'text-success' : 'text-danger'}>
                    {formatearMoneda(balance)}
                  </strong>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="table-light">
          <tr>
            <td className="text-end"><strong>TOTAL:</strong></td>
            <td className="text-end text-success">
              {formatearMoneda(datos.reduce((sum, o) => sum + (o.totalCobrado || 0), 0))}
            </td>
            <td className="text-end text-primary">
              {formatearMoneda(datos.reduce((sum, o) => sum + (o.totalPagado || 0), 0))}
            </td>
            <td className="text-end text-warning">
              {formatearMoneda(datos.reduce((sum, o) => sum + (o.totalRetirado || 0), 0))}
            </td>
            <td className="text-end">
              <strong className={
                (datos.reduce((sum, o) => sum + (o.totalCobrado || 0), 0) -
                 datos.reduce((sum, o) => sum + (o.totalPagado || 0), 0) -
                 datos.reduce((sum, o) => sum + (o.totalRetirado || 0), 0)) >= 0
                  ? 'text-success fs-5'
                  : 'text-danger fs-5'
              }>
                {formatearMoneda(
                  datos.reduce((sum, o) => sum + (o.totalCobrado || 0), 0) -
                  datos.reduce((sum, o) => sum + (o.totalPagado || 0), 0) -
                  datos.reduce((sum, o) => sum + (o.totalRetirado || 0), 0)
                )}
              </strong>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );

  return (
    <div className="modal show d-block" style={{ zIndex: 2500, backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">
              <i className="bi bi-list-ul me-2"></i>
              {titulo || 'Detalle por Obra'}
            </h5>
            <button type="button" className="btn btn-light btn-sm ms-auto" onClick={onHide}>
              Cerrar
            </button>
          </div>
          <div className="modal-body">
            <div className="alert alert-info">
              <div>
                <i className="bi bi-info-circle me-2"></i>
                <strong>Vista consolidada:</strong> Mostrando el desglose de <strong>{datos?.length || 0} obra(s)</strong>
              </div>
              {tipo === 'cobros' && estadisticas && (
                <div className="mt-3 text-center">
                  <strong className="fs-5">
                    Total Cobrado a {empresaSeleccionada?.nombreEmpresa || empresaSeleccionada?.nombre || 'la empresa'} al día {estadisticas.fechaUltimoCobro ? new Date(estadisticas.fechaUltimoCobro).toLocaleDateString('es-AR') : new Date().toLocaleDateString('es-AR')}:
                  </strong>{' '}
                  <span className="text-success fw-bold fs-4">{formatearMoneda(estadisticas.totalCobrado || 0)}</span>
                </div>
              )}
              {tipo === 'pagos' && estadisticas && (
                <div className="mt-3 text-center">
                  <strong className="fs-5">Total pagado:</strong>{' '}
                  <span className="text-danger fw-bold fs-4">{formatearMoneda(estadisticas.totalPagado || 0)}</span>
                </div>
              )}
              {tipo === 'presupuestos' && estadisticas && (
                <div className="mt-3 text-center">
                  <strong className="fs-5">Total Presupuestado a {empresaSeleccionada?.nombreEmpresa || empresaSeleccionada?.nombre || 'la empresa'}:</strong>{' '}
                  <span className="text-primary fw-bold fs-4">{formatearMoneda(estadisticas.totalPresupuesto || 0)}</span>
                </div>
              )}
              {tipo === 'saldoPorCobrar' && estadisticas && (
                <div className="mt-3 text-center">
                  <strong className="fs-5">Total por cobrar a {empresaSeleccionada?.nombreEmpresa || empresaSeleccionada?.nombre || 'la empresa'}:</strong>{' '}
                  <span className="text-warning fw-bold fs-4">{formatearMoneda((estadisticas.totalPresupuesto || 0) - (estadisticas.totalCobrado || 0))}</span>
                </div>
              )}
              {tipo === 'balanceNeto' && datos && datos.length > 0 && (
                <div className="mt-3 text-center">
                  <div className="mb-2">
                    <strong className="fs-5">Balance entre Cobros - Pagos - Retiros:</strong>
                  </div>
                  <div>
                    <strong className="fs-5">Saldo Disponible:</strong>{' '}
                    <span className={`fw-bold fs-4 ${
                      (datos.reduce((sum, o) => sum + (o.totalCobrado || 0), 0) -
                       datos.reduce((sum, o) => sum + (o.totalPagado || 0), 0) -
                       datos.reduce((sum, o) => sum + (o.totalRetirado || 0), 0)) >= 0
                        ? 'text-success'
                        : 'text-danger'
                    }`}>
                    {formatearMoneda(
                      datos.reduce((sum, o) => sum + (o.totalCobrado || 0), 0) -
                      datos.reduce((sum, o) => sum + (o.totalPagado || 0), 0) -
                      datos.reduce((sum, o) => sum + (o.totalRetirado || 0), 0)
                    )}
                  </span>
                  </div>
                </div>
              )}
              {tipo === 'deficit' && estadisticas && (
                <div className="mt-3 text-center">
                  <strong className="fs-5">Déficit total:</strong>{' '}
                  <span className="text-danger fw-bold fs-4">
                    {formatearMoneda(estadisticas.saldoDisponible < 0 ? estadisticas.saldoDisponible : 0)}
                  </span>
                  {estadisticas.saldoDisponible >= 0 && (
                    <div className="mt-2 text-success">
                      <i className="bi bi-check-circle me-2"></i>
                      No hay déficit general
                    </div>
                  )}
                </div>
              )}
            </div>
            {renderContenido()}
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

export default DetalleConsolidadoPorObraModal;
