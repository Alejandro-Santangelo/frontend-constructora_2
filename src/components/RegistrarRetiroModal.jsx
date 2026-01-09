import React, { useState, useEffect } from 'react';
import { useEmpresa } from '../EmpresaContext';
import eventBus, { FINANCIAL_EVENTS } from '../utils/eventBus';
import { 
  registrarRetiro, 
  obtenerSaldoDisponible, 
  formatearMoneda,
  TIPOS_RETIRO 
} from '../services/retirosPersonalesService';
import { useEstadisticasConsolidadas } from '../hooks/useEstadisticasConsolidadas';
import api from '../services/api';

const RegistrarRetiroModal = ({ show, onHide, onSuccess }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { estadisticas: estadisticasConsolidadas, loading: loadingEstadisticas } = useEstadisticasConsolidadas(
    empresaSeleccionada?.id,
    refreshTrigger
  );
  
  const [formData, setFormData] = useState({
    monto: '',
    fechaRetiro: new Date().toISOString().split('T')[0],
    motivo: '',
    tipoRetiro: 'GANANCIA',
    observaciones: '',
    origenRetiro: 'GENERAL', // GENERAL o OBRA
    obraId: null
  });
  const [saldoDisponible, setSaldoDisponible] = useState(null);
  const [cargandoSaldo, setCargandoSaldo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  
  // Obras disponibles para retirar
  const [obrasDisponibles, setObrasDisponibles] = useState([]);
  const [totalHonorariosPresupuestados, setTotalHonorariosPresupuestados] = useState(0);
  
  // Calcular saldo disponible CORRECTO: totalCobrado - totalPagado - totalRetirado
  const saldoDisponibleReal = estadisticasConsolidadas 
    ? (estadisticasConsolidadas.totalCobradoEmpresa || estadisticasConsolidadas.totalCobrado || 0) 
      - (estadisticasConsolidadas.totalPagado || 0) 
      - (estadisticasConsolidadas.totalRetirado || 0)
    : 0;

  // Obtener saldo disponible de la obra seleccionada
  const obraSeleccionada = obrasDisponibles.find(o => o.obraId === formData.obraId);
  const saldoObraSeleccionada = obraSeleccionada?.saldoDisponible || 0;

  // Saldo que se debe validar según el origen
  const saldoAValidar = formData.origenRetiro === 'GENERAL' ? saldoDisponibleReal : saldoObraSeleccionada;

  useEffect(() => {
    if (show && empresaSeleccionada) {
      cargarSaldoDisponible();
      resetForm();
    }
  }, [show, empresaSeleccionada]);

  // Cargar obras desde el desglose del hook cuando cambian las estadísticas
  useEffect(() => {
    if (estadisticasConsolidadas?.desglosePorObra) {
      const obrasFormateadas = estadisticasConsolidadas.desglosePorObra.map(obra => ({
        obraId: obra.obraId,
        presupuestoNoClienteId: obra.id,
        direccion: obra.nombreObra,
        totalHonorarios: parseFloat(obra.totalHonorarios || 0),
        totalCobrado: parseFloat(obra.totalCobrado || 0),
        totalPagado: parseFloat(obra.totalPagado || 0),
        totalRetirado: parseFloat(obra.totalRetirado || 0),
        saldoDisponible: parseFloat(obra.saldoDisponible || 0)
      }));
      
      setObrasDisponibles(obrasFormateadas);
      
      // Calcular total de honorarios
      const totalHonorarios = obrasFormateadas.reduce((sum, o) => sum + o.totalHonorarios, 0);
      setTotalHonorariosPresupuestados(totalHonorarios);
    }
  }, [estadisticasConsolidadas]);

  const cargarSaldoDisponible = async () => {
    setCargandoSaldo(true);
    try {
      const data = await obtenerSaldoDisponible(empresaSeleccionada.id);
      setSaldoDisponible(data);
    } catch (err) {
      console.error('Error cargando saldo:', err);
      setError('No se pudo cargar el saldo disponible');
    } finally {
      setCargandoSaldo(false);
    }
  };

  const resetForm = () => {
    setFormData({
      monto: '',
      fechaRetiro: new Date().toISOString().split('T')[0],
      motivo: '',
      tipoRetiro: 'GANANCIA',
      observaciones: '',
      origenRetiro: 'GENERAL',
      obraId: null
    });
    setError(null);
    setSuccessMessage(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Si cambia el origen del retiro, resetear obraId
    if (name === 'origenRetiro') {
      setFormData(prev => ({ 
        ...prev, 
        [name]: value,
        obraId: null // Resetear obra seleccionada
      }));
    } 
    // Si selecciona una obra, convertir el ID a número
    else if (name === 'obraId') {
      setFormData(prev => ({ 
        ...prev, 
        [name]: value ? parseInt(value, 10) : null 
      }));
    }
    // Otros campos
    else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const montoNum = parseFloat(formData.monto);

    // Validaciones
    if (!formData.monto || montoNum <= 0) {
      setError('Debe ingresar un monto mayor a 0');
      return;
    }

    // Validar según origen
    if (formData.origenRetiro === 'GENERAL') {
      if (montoNum > saldoDisponibleReal) {
        setError(`El monto excede el saldo disponible general (${formatearMoneda(saldoDisponibleReal)})`);
        return;
      }
    } else if (formData.origenRetiro === 'OBRA') {
      if (!formData.obraId) {
        setError('Debe seleccionar una obra para retirar');
        return;
      }
      if (montoNum > saldoObraSeleccionada) {
        setError(`El monto excede el saldo disponible de la obra (${formatearMoneda(saldoObraSeleccionada)})`);
        return;
      }
    }

    const fechaRetiro = new Date(formData.fechaRetiro);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    if (fechaRetiro > hoy) {
      setError('La fecha de retiro no puede ser futura');
      return;
    }

    if (!empresaSeleccionada) {
      setError('No hay empresa seleccionada');
      return;
    }

    setLoading(true);

    try {
      const retiroData = {
        empresaId: empresaSeleccionada.id,
        monto: montoNum,
        fechaRetiro: formData.fechaRetiro,
        motivo: formData.motivo || null,
        tipoRetiro: formData.tipoRetiro,
        observaciones: formData.observaciones || null,
        origenRetiro: formData.origenRetiro,
        obraId: formData.origenRetiro === 'OBRA' ? formData.obraId : null
      };

      await registrarRetiro(retiroData);

      // 📡 Notificar al sistema que hubo un retiro
      eventBus.emit(FINANCIAL_EVENTS.RETIRO_REGISTRADO, {
        empresaId: empresaSeleccionada.id,
        monto: montoNum,
        obraId: formData.origenRetiro === 'OBRA' ? formData.obraId : null
      });

      const mensajeOrigen = formData.origenRetiro === 'OBRA' 
        ? ` de la obra "${obraSeleccionada?.direccion}"` 
        : ' del saldo general';
      
      setSuccessMessage(`✅ Retiro registrado exitosamente por ${formatearMoneda(montoNum)}${mensajeOrigen}`);
      
      if (onSuccess) {
        onSuccess({
          mensaje: `Retiro registrado por ${formatearMoneda(montoNum)}`,
          monto: montoNum
        });
      }

      // Recargar saldo y resetear form
      await cargarSaldoDisponible();
      setRefreshTrigger(prev => prev + 1); // Recargar estadísticas consolidadas
      resetForm();

      // Auto-ocultar después de 3 segundos
      setTimeout(() => {
        setSuccessMessage(null);
        onHide();
      }, 3000);

    } catch (err) {
      console.error('Error registrando retiro:', err);
      const mensaje = err?.response?.data?.message || err?.message || 'Error desconocido';
      setError(`Error al registrar retiro: ${mensaje}`);
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{ zIndex: 2100, backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title">💵 Registrar Retiro Personal</h5>
            <button type="button" className="btn btn-light btn-sm ms-auto" onClick={onHide}>
              Cerrar
            </button>
          </div>

          <div className="modal-body">
            {/* Panel de Honorarios Presupuestados */}
            {totalHonorariosPresupuestados > 0 && (
              <div className="alert alert-info border-start border-5 border-info mb-3">
                <div className="row align-items-center">
                  <div className="col-md-6">
                    <h6 className="alert-heading mb-1">
                      <i className="bi bi-briefcase me-2"></i>
                      💼 Honorarios Totales Presupuestados
                    </h6>
                    <div className="fs-4 fw-bold text-primary">
                      {formatearMoneda(totalHonorariosPresupuestados)}
                    </div>
                    <small className="text-muted">
                      Suma de todas las obras en ejecución
                    </small>
                  </div>
                  <div className="col-md-6">
                    <details>
                      <summary className="text-primary fw-bold" style={{cursor: 'pointer'}}>
                        <i className="bi bi-list-ul me-1"></i>
                        Ver desglose por obra ({obrasDisponibles.length})
                      </summary>
                      <div className="mt-2">
                        <table className="table table-sm table-borderless mb-0">
                          <tbody>
                            {obrasDisponibles.map(obra => (
                              <tr key={obra.obraId}>
                                <td className="py-1">
                                  <small className="text-muted">{obra.direccion}</small>
                                </td>
                                <td className="py-1 text-end">
                                  <small className="fw-bold text-primary">
                                    {formatearMoneda(obra.totalHonorarios)}
                                  </small>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </div>
                </div>
              </div>
            )}

            {/* Alerta de saldo disponible */}
            {loadingEstadisticas ? (
              <div className="alert alert-info">
                <i className="bi bi-hourglass-split me-2"></i>
                Cargando saldo disponible...
              </div>
            ) : estadisticasConsolidadas ? (
              <div className={`alert ${saldoDisponibleReal > 0 ? 'alert-success' : 'alert-warning'} border-start border-5`}>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="alert-heading mb-1">
                      <i className="bi bi-wallet2 me-2"></i>
                      Saldo Disponible General
                    </h6>
                    <div className="fs-4 fw-bold">
                      {formatearMoneda(saldoDisponibleReal)}
                    </div>
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setRefreshTrigger(prev => prev + 1)}
                    disabled={loadingEstadisticas}
                  >
                    <i className="bi bi-arrow-clockwise"></i> Actualizar
                  </button>
                </div>
                <details className="mt-2 small">
                  <summary style={{ cursor: 'pointer' }} className="text-muted">
                    Ver desglose financiero
                  </summary>
                  <div className="mt-2">
                    <div className="row">
                      <div className="col-md-4">
                        <strong>💰 Total Cobrado:</strong><br />
                        {formatearMoneda(estadisticasConsolidadas.totalCobradoEmpresa || estadisticasConsolidadas.totalCobrado || 0)}
                      </div>
                      <div className="col-md-4">
                        <strong>💸 Total Pagado:</strong><br />
                        {formatearMoneda(estadisticasConsolidadas.totalPagado || 0)}
                      </div>
                      <div className="col-md-4">
                        <strong>💵 Total Retirado:</strong><br />
                        {formatearMoneda(estadisticasConsolidadas.totalRetirado || 0)}
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            ) : null}

            {/* Mensajes de error/éxito */}
            {error && (
              <div className="alert alert-danger alert-dismissible fade show">
                <i className="bi bi-exclamation-triangle me-2"></i>
                {error}
                <button type="button" className="btn-close" onClick={() => setError(null)}></button>
              </div>
            )}

            {successMessage && (
              <div className="alert alert-success alert-dismissible fade show">
                {successMessage}
                <button type="button" className="btn-close" onClick={() => setSuccessMessage(null)}></button>
              </div>
            )}

            {/* Formulario */}
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                {/* Origen del Retiro */}
                <div className="col-12">
                  <label className="form-label fw-bold">
                    Origen del Retiro <span className="text-danger">*</span>
                  </label>
                  
                  {loadingEstadisticas ? (
                    <div className="alert alert-info">
                      <i className="bi bi-hourglass-split me-2"></i>
                      Cargando obras disponibles...
                    </div>
                  ) : (
                    <>
                      <div className="btn-group w-100" role="group">
                        <input
                          type="radio"
                          className="btn-check"
                          name="origenRetiro"
                          id="origenGeneral"
                          value="GENERAL"
                          checked={formData.origenRetiro === 'GENERAL'}
                          onChange={handleChange}
                          disabled={loading}
                        />
                        <label className="btn btn-outline-primary" htmlFor="origenGeneral">
                          <i className="bi bi-cash-stack me-2"></i>
                          Saldo General ({formatearMoneda(saldoDisponibleReal)})
                        </label>

                        <input
                          type="radio"
                          className="btn-check"
                          name="origenRetiro"
                          id="origenObra"
                          value="OBRA"
                          checked={formData.origenRetiro === 'OBRA'}
                          onChange={handleChange}
                          disabled={loading || obrasDisponibles.length === 0}
                        />
                        <label 
                          className={`btn ${obrasDisponibles.length === 0 ? 'btn-outline-secondary' : 'btn-outline-success'}`} 
                          htmlFor="origenObra"
                        >
                          <i className="bi bi-building me-2"></i>
                          Obra Específica {obrasDisponibles.length > 0 && `(${obrasDisponibles.length} obra${obrasDisponibles.length > 1 ? 's' : ''})`}
                        </label>
                      </div>
                      {formData.origenRetiro === 'GENERAL' && (
                        <small className="text-muted d-block mt-1">
                          <i className="bi bi-info-circle me-1"></i>
                          Retirará del saldo total de la empresa (cobros - pagos - retiros)
                        </small>
                      )}
                      {obrasDisponibles.length === 0 && !loadingEstadisticas && (
                        <small className="text-warning d-block mt-1">
                          <i className="bi bi-exclamation-triangle me-1"></i>
                          No hay obras en ejecución. Verifique que tenga presupuestos APROBADOS o EN_EJECUCION.
                        </small>
                      )}
                    </>
                  )}
                </div>

                {/* Selector de Obra (solo si origen es OBRA) */}
                {formData.origenRetiro === 'OBRA' && obrasDisponibles.length > 0 && (
                  <div className="col-12">
                    <label className="form-label">
                      Seleccione la Obra <span className="text-danger">*</span>
                    </label>
                    <select
                      className="form-select"
                      name="obraId"
                      value={formData.obraId || ''}
                      onChange={handleChange}
                      required={formData.origenRetiro === 'OBRA'}
                      disabled={loading}
                      style={{borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe'}}
                    >
                      <option value="">-- Seleccione una obra --</option>
                      {obrasDisponibles.map(obra => (
                        <option key={obra.obraId} value={obra.obraId}>
                          {obra.direccion} | Saldo: {formatearMoneda(obra.saldoDisponible)}
                          {obra.sinDatosFinancieros && ' (sin datos financieros)'}
                        </option>
                      ))}
                    </select>
                    {obraSeleccionada && (
                      <div className={`alert ${obraSeleccionada.saldoDisponible > 0 ? 'alert-success' : 'alert-warning'} mt-2 py-2`}>
                        <div className="row">
                          <div className="col-12 mb-2">
                            <strong className="d-block">
                              <i className="bi bi-building me-1"></i>
                              {obraSeleccionada.direccion}
                            </strong>
                          </div>
                          
                          <div className="col-md-4">
                            <small className="text-muted d-block">💼 Honorarios Presupuestados</small>
                            <strong className="text-primary fs-6">
                              {formatearMoneda(obraSeleccionada.totalHonorarios)}
                            </strong>
                          </div>
                          
                          <div className="col-md-4">
                            <small className="text-muted d-block">💰 Saldo Disponible</small>
                            <strong className={obraSeleccionada.saldoDisponible > 0 ? 'text-success fs-6' : 'text-danger fs-6'}>
                              {formatearMoneda(obraSeleccionada.saldoDisponible)}
                            </strong>
                          </div>
                          
                          <div className="col-md-4">
                            <small className="text-muted d-block">📊 Relación</small>
                            <strong className={
                              obraSeleccionada.totalHonorarios > 0 
                                ? (obraSeleccionada.saldoDisponible >= obraSeleccionada.totalHonorarios ? 'text-success' : 'text-warning')
                                : 'text-muted'
                            }>
                              {obraSeleccionada.totalHonorarios > 0 
                                ? `${((obraSeleccionada.saldoDisponible / obraSeleccionada.totalHonorarios) * 100).toFixed(0)}%`
                                : 'N/A'
                              }
                            </strong>
                          </div>
                        </div>
                        
                        {obraSeleccionada.saldoDisponible <= 0 && (
                          <div className="alert alert-danger mt-2 mb-0 py-1">
                            <small>
                              <i className="bi bi-exclamation-triangle me-1"></i>
                              Esta obra no tiene saldo disponible para retirar
                            </small>
                          </div>
                        )}
                        
                        {obraSeleccionada.totalHonorarios > 0 && obraSeleccionada.saldoDisponible > 0 && obraSeleccionada.saldoDisponible < obraSeleccionada.totalHonorarios && (
                          <div className="alert alert-warning mt-2 mb-0 py-1">
                            <small>
                              <i className="bi bi-info-circle me-1"></i>
                              El saldo disponible ({formatearMoneda(obraSeleccionada.saldoDisponible)}) es menor a los honorarios presupuestados ({formatearMoneda(obraSeleccionada.totalHonorarios)})
                            </small>
                          </div>
                        )}
                        
                        {obraSeleccionada.totalHonorarios > 0 && obraSeleccionada.saldoDisponible >= obraSeleccionada.totalHonorarios && (
                          <div className="alert alert-success mt-2 mb-0 py-1">
                            <small>
                              <i className="bi bi-check-circle me-1"></i>
                              Podés retirar hasta {formatearMoneda(obraSeleccionada.totalHonorarios)} según honorarios presupuestados
                              {obraSeleccionada.saldoDisponible > obraSeleccionada.totalHonorarios && (
                                <span className="d-block mt-1">
                                  Saldo excedente: {formatearMoneda(obraSeleccionada.saldoDisponible - obraSeleccionada.totalHonorarios)}
                                </span>
                              )}
                            </small>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Monto */}
                <div className="col-md-6">
                  <label className="form-label">
                    Monto <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    className="form-control form-control-lg"
                    name="monto"
                    placeholder="Ej: 5000000"
                    value={formData.monto}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    required
                    disabled={loading}
                    style={{borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                  />
                  {formData.monto && parseFloat(formData.monto) > 0 && (
                    <small className="text-success fw-bold">
                      {formatearMoneda(parseFloat(formData.monto))}
                    </small>
                  )}
                </div>

                {/* Fecha */}
                <div className="col-md-6">
                  <label className="form-label">
                    Fecha de Retiro <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    name="fechaRetiro"
                    value={formData.fechaRetiro}
                    onChange={handleChange}
                    max={new Date().toISOString().split('T')[0]}
                    required
                    disabled={loading}
                    style={{borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                  />
                </div>

                {/* Tipo de Retiro */}
                <div className="col-md-6">
                  <label className="form-label">
                    Tipo de Retiro <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select"
                    name="tipoRetiro"
                    value={formData.tipoRetiro}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    style={{borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                  >
                    {Object.entries(TIPOS_RETIRO).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Motivo */}
                <div className="col-md-6">
                  <label className="form-label">Motivo</label>
                  <input
                    type="text"
                    className="form-control"
                    name="motivo"
                    placeholder="Ej: Ganancia del mes"
                    value={formData.motivo}
                    onChange={handleChange}
                    maxLength={500}
                    disabled={loading}
                    style={{borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                  />
                </div>

                {/* Observaciones */}
                <div className="col-12">
                  <label className="form-label">Observaciones</label>
                  <textarea
                    className="form-control"
                    name="observaciones"
                    rows="3"
                    placeholder="Notas adicionales..."
                    value={formData.observaciones}
                    onChange={handleChange}
                    maxLength={1000}
                    disabled={loading}
                    style={{borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                  />
                </div>
              </div>

              {/* Botones */}
              <div className="d-flex justify-content-end gap-2 mt-4">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={onHide}
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-success"
                  disabled={
                    loading || 
                    loadingEstadisticas || 
                    (formData.origenRetiro === 'GENERAL' && saldoDisponibleReal <= 0) ||
                    (formData.origenRetiro === 'OBRA' && (!formData.obraId || saldoObraSeleccionada <= 0))
                  }
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Procesando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle me-2"></i>
                      Registrar Retiro
                      {formData.origenRetiro === 'OBRA' && obraSeleccionada && (
                        <small className="d-block">de {obraSeleccionada.direccion}</small>
                      )}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrarRetiroModal;
