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
  ESTADOS_RETIRO,
  listarGastosConRetiroDirecto // 🆕 Nueva función para obtener gastos de retiro directo
} from '../services/retirosPersonalesService';

const ListarRetirosModal = ({ show, onHide, onSuccess }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [retiros, setRetiros] = useState([]);
  const [gastosRetiroDirecto, setGastosRetiroDirecto] = useState([]); // 🆕 Gastos generales con retiro directo
  const [registrosCombinados, setRegistrosCombinados] = useState([]); // 🆕 Combinación de retiros + gastos
  const [totales, setTotales] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState('ACTIVO');
  const [filtroTipo, setFiltroTipo] = useState('');

  useEffect(() => {
    if (show && empresaSeleccionada) {
      cargarRetiros();
      cargarGastosRetiroDirecto(); // 🆕 Cargar gastos con retiro directo
      cargarTotales();
    }
  }, [show, empresaSeleccionada, filtroEstado, filtroTipo]);

  // 🆕 Combinar retiros y gastos cuando cambien
  useEffect(() => {
    console.log('🔄 [RETIROS MODAL] Combinando registros:', {
      retiros: retiros.length,
      gastosRetiroDirecto: gastosRetiroDirecto.length,
      filtroEstado,
      filtroTipo
    });

    const combinados = [];

    // Agregar retiros normales
    retiros.forEach(retiro => {
      console.log('📝 [COMBINANDO] Agregando retiro:', retiro.id);
      combinados.push({
        ...retiro,
        tipoRegistro: 'RETIRO',
        fechaRegistro: retiro.fechaRetiro,
        descripcion: retiro.motivo
      });
    });

    // Agregar gastos con retiro directo
    gastosRetiroDirecto.forEach(gasto => {
      console.log('📝 [COMBINANDO] Agregando gasto:', {
        id: gasto.id,
        descripcion: gasto.descripcion,
        nombreObra: gasto.nombreObra,
        importe: gasto.importeAsignado || gasto.importe
      });
      combinados.push({
        ...gasto,
        tipoRegistro: 'GASTO_GENERAL',
        tipoRetiro: 'GASTO_GENERAL', // Para el filtro
        fechaRegistro: new Date(), // Fecha actual ya que el backend no devuelve fecha
        monto: gasto.importeAsignado || gasto.importe,
        descripcion: gasto.descripcion || gasto.concepto
      });
    });

    console.log('📊 [COMBINANDO] Total combinados antes de filtros:', combinados.length);

    // Ordenar por fecha (más recientes primero)
    combinados.sort((a, b) => {
      const fechaA = new Date(a.fechaRegistro || 0);
      const fechaB = new Date(b.fechaRegistro || 0);
      return fechaB - fechaA;
    });

    // Aplicar filtros
    let filtrados = combinados;

    if (filtroTipo) {
      console.log('🔍 [FILTROS] Aplicando filtro tipo:', filtroTipo);
      filtrados = filtrados.filter(r => r.tipoRetiro === filtroTipo);
      console.log('📊 [FILTROS] Después de filtro tipo:', filtrados.length);
    }

    if (filtroEstado) {
      console.log('🔍 [FILTROS] Aplicando filtro estado:', filtroEstado);
      // Solo aplicar filtro de estado a retiros normales, no a gastos generales
      filtrados = filtrados.filter(r => {
        // Si es un gasto general, no filtrar por estado (los gastos no tienen ese campo)
        if (r.tipoRegistro === 'GASTO_GENERAL') return true;
        // Si es un retiro normal, aplicar el filtro de estado
        return r.estado === filtroEstado;
      });
      console.log('📊 [FILTROS] Después de filtro estado:', filtrados.length);
    }

    console.log('🎯 [RESULTADO FINAL] Registros a mostrar:', filtrados.length);
    setRegistrosCombinados(filtrados);
  }, [retiros, gastosRetiroDirecto, filtroEstado, filtroTipo]);

  const cargarRetiros = async () => {
    setLoading(true);
    setError(null);
    try {
      const filtros = {};
      if (filtroEstado) filtros.estado = filtroEstado;
      if (filtroTipo && filtroTipo !== 'GASTO_GENERAL') filtros.tipoRetiro = filtroTipo; // Excluir filtro GASTO_GENERAL para retiros normales

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

  // 🆕 Cargar gastos generales con retiro directo
  const cargarGastosRetiroDirecto = async () => {
    try {
      console.log('🔍 [RETIROS MODAL] Iniciando carga de gastos con retiro directo...');
      console.log('🔍 [RETIROS MODAL] Función disponible:', typeof listarGastosConRetiroDirecto);
      console.log('🔍 [RETIROS MODAL] EmpresaId:', empresaSeleccionada.id);

      const data = await listarGastosConRetiroDirecto(empresaSeleccionada.id);

      console.log('📊 [RETIROS MODAL] Gastos recibidos:', data);
      console.log('📊 [RETIROS MODAL] Tipo de dato:', typeof data);
      console.log('📊 [RETIROS MODAL] Es array:', Array.isArray(data));
      console.log('📊 [RETIROS MODAL] Cantidad:', Array.isArray(data) ? data.length : 'No es array');

      setGastosRetiroDirecto(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('❌ [RETIROS MODAL] Error cargando gastos con retiro directo:', err);
      console.error('❌ [RETIROS MODAL] Error completo:', err.message, err.stack);
      setGastosRetiroDirecto([]);
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
            <div className="row g-3 mb-4">
              {/* Total de Retiros Normales */}
              {totales && (
                <div className="col-md-4">
                  <div className="card h-100 border-primary shadow-sm">
                    <div className="card-body text-center py-4">
                      <div className="mb-2">
                        <i className="bi bi-wallet2 text-primary" style={{ fontSize: '2rem' }}></i>
                      </div>
                      <h6 className="text-muted mb-2 text-uppercase" style={{ fontSize: '0.75rem' }}>
                        Retiros Normales
                      </h6>
                      <h3 className="text-primary mb-1 fw-bold" style={{ whiteSpace: 'nowrap' }}>
                        {formatearMoneda(totales.totalRetiros)}
                      </h3>
                      <small className="text-muted">
                        <i className="bi bi-receipt me-1"></i>
                        {totales.cantidadRetiros} retiro(s)
                      </small>
                    </div>
                  </div>
                </div>
              )}

              {/* Total de Gastos con Retiro Directo */}
              <div className="col-md-4">
                <div className="card h-100 border-warning shadow-sm">
                  <div className="card-body text-center py-4">
                    <div className="mb-2">
                      <i className="bi bi-cash-coin text-warning" style={{ fontSize: '2rem' }}></i>
                    </div>
                    <h6 className="text-muted mb-2 text-uppercase" style={{ fontSize: '0.75rem' }}>
                      Gastos Generales
                    </h6>
                    <h3 className="text-warning mb-1 fw-bold" style={{ whiteSpace: 'nowrap' }}>
                      {formatearMoneda(
                        gastosRetiroDirecto
                          .reduce((sum, g) => sum + parseFloat(g.importeAsignado || g.importe || 0), 0)
                      )}
                    </h3>
                    <small className="text-muted">
                      <i className="bi bi-receipt me-1"></i>
                      {gastosRetiroDirecto.length} gasto(s)
                    </small>
                  </div>
                </div>
              </div>

              {/* Total Combinado */}
              <div className="col-md-4">
                <div className="card h-100 border-success shadow-sm">
                  <div className="card-body text-center py-4">
                    <div className="mb-2">
                      <i className="bi bi-piggy-bank text-success" style={{ fontSize: '2rem' }}></i>
                    </div>
                    <h6 className="text-muted mb-2 text-uppercase" style={{ fontSize: '0.75rem' }}>
                      Total General
                    </h6>
                    <h3 className="text-success mb-1 fw-bold" style={{ whiteSpace: 'nowrap' }}>
                      {formatearMoneda(
                        registrosCombinados
                          .reduce((sum, r) => sum + parseFloat(r.monto || 0), 0)
                      )}
                    </h3>
                    <small className="text-muted">
                      <i className="bi bi-receipt me-1"></i>
                      {registrosCombinados.length} total
                    </small>
                  </div>
                </div>
              </div>
            </div>

            {/* Tarjetas de retiros por tipo (solo si hay datos) */}
            {totales?.retirosPorTipo && Object.keys(totales.retirosPorTipo).length > 0 && (
              <div className="row g-3 mb-4">
                {Object.entries(totales.retirosPorTipo).map(([tipo, monto]) => (
                  <div key={tipo} className="col-md-4">
                    <div className="card h-100 border-light shadow-sm">
                      <div className="card-body text-center py-3">
                        <div className="mb-2">
                          <i className={`bi ${tipo === 'GANANCIA' ? 'bi-trophy' : tipo === 'PRESTAMO' ? 'bi-arrow-down-circle' : 'bi-bag'} text-info`} style={{ fontSize: '1.5rem' }}></i>
                        </div>
                        <h6 className="text-muted mb-2 text-uppercase" style={{ fontSize: '0.7rem' }}>
                          {TIPOS_RETIRO[tipo] || tipo}
                        </h6>
                        <h5 className="mb-0 fw-bold text-info" style={{ whiteSpace: 'nowrap' }}>
                          {formatearMoneda(monto)}
                        </h5>
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
            ) : registrosCombinados.length === 0 ? (
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
                      <th style={{ minWidth: '200px' }}>Descripción / Obra</th>
                      <th>Estado</th>
                      <th className="text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrosCombinados.map((registro, index) => {
                      const esGasto = registro.tipoRegistro === 'GASTO_GENERAL';

                      return (
                        <tr
                          key={`${registro.tipoRegistro}-${registro.id}-${index}`}
                          className={registro.estado === 'ANULADO' ? 'table-secondary' : ''}
                        >
                          <td>
                            <small className="font-monospace">
                              {esGasto ? (
                                <>
                                  <span className="badge bg-warning text-dark me-1">G</span>
                                  #{registro.id}
                                </>
                              ) : (
                                <>
                                  <span className="badge bg-primary me-1">R</span>
                                  #{registro.id}
                                </>
                              )}
                            </small>
                          </td>
                          <td>{formatearFecha(registro.fechaRegistro)}</td>
                          <td className="fw-bold text-success">
                            {formatearMoneda(registro.monto)}
                          </td>
                          <td>
                            {esGasto ? (
                              <span className="badge bg-warning text-dark">
                                💸 Gasto General
                              </span>
                            ) : (
                              <span className="badge bg-info text-dark">
                                {TIPOS_RETIRO[registro.tipoRetiro] || registro.tipoRetiro}
                              </span>
                            )}
                          </td>
                          <td>
                            {esGasto ? (
                              <>
                                <div>
                                  <span className="fw-bold text-dark">
                                    {registro.descripcion || 'Sin descripción'}
                                  </span>
                                  <span className="mx-2 text-muted">|</span>
                                  <span className="fw-bold text-dark">
                                    <i className="bi bi-building me-1"></i>
                                    {registro.nombreObra}
                                  </span>
                                </div>
                                <div className="small mt-1" style={{ marginLeft: '8.5rem' }}>
                                  <span className={`badge ${registro.tipoObra === 'Trabajo Extra' ? 'bg-secondary' : 'bg-primary'} badge-sm`}>
                                    {registro.tipoObra}
                                  </span>
                                  {registro.rubro && (
                                    <span className="ms-1 text-muted">
                                      · {registro.rubro}
                                    </span>
                                  )}
                                </div>
                              </>
                            ) : (
                              <>
                                <small>{registro.motivo || '-'}</small>
                                {registro.observaciones && (
                                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                                    {registro.observaciones}
                                  </div>
                                )}
                              </>
                            )}
                          </td>
                          <td>
                            {registro.estado === 'ACTIVO' ? (
                              <span className="badge bg-success">✓ Activo</span>
                            ) : (
                              <span className="badge bg-secondary">✗ Anulado</span>
                            )}
                          </td>
                          <td>
                            {!esGasto && (
                              <div className="btn-group btn-group-sm" role="group">
                                {registro.estado === 'ACTIVO' && (
                                  <button
                                    className="btn btn-warning"
                                    onClick={() => handleAnular(registro.id)}
                                    title="Anular retiro"
                                  >
                                    ✗
                                  </button>
                                )}
                                <button
                                  className="btn btn-danger"
                                  onClick={() => handleEliminar(registro.id, registro.estado)}
                                  disabled={registro.estado === 'ANULADO'}
                                  title={registro.estado === 'ANULADO' ? 'No se pueden eliminar retiros anulados' : 'Eliminar retiro'}
                                  style={registro.estado === 'ANULADO' ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                >
                                  🗑️
                                </button>
                              </div>
                            )}
                            {esGasto && (
                              <span className="badge bg-light text-muted">
                                Vía Gastos
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="table-light fw-bold">
                    <tr>
                      <td colSpan="2" className="text-end">TOTAL:</td>
                      <td className="text-success">
                        {formatearMoneda(
                          registrosCombinados
                            .filter(r => r.estado === 'ACTIVO')
                            .reduce((sum, r) => sum + parseFloat(r.monto || 0), 0)
                        )}
                      </td>
                      <td colSpan="4">
                        <small className="text-muted">
                          (Solo registros activos: {registrosCombinados.filter(r => r.estado === 'ACTIVO').length})
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
