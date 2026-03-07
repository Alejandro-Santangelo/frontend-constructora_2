import React, { useState, useEffect } from 'react';
import { useEmpresa } from '../EmpresaContext';
import api from '../services/api';

/**
 * Modal detallado de un día específico
 * Muestra y permite editar profesionales, materiales y gastos del día
 */
const ModalDetalleDia = ({ show, onClose, diaData, obra, onActualizar }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [etapa, setEtapa] = useState(null);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  
  // Estados para cada sección
  const [profesionales, setProfesionales] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [observaciones, setObservaciones] = useState('');
  
  // Modales auxiliares
  const [mostrarModalMaterial, setMostrarModalMaterial] = useState(false);
  const [mostrarModalGasto, setMostrarModalGasto] = useState(false);

  useEffect(() => {
    if (show && diaData) {
      cargarDetalleDia();
    }
  }, [show, diaData]);

  const cargarDetalleDia = async () => {
    setLoading(true);
    try {
      const data = await api.get(
        `/api/obras/${obra.id}/etapas-diarias/${diaData.fecha}`,
        {
          headers: {
            'empresaId': empresaSeleccionada.id.toString()
          }
        }
      );
      setEtapa(data);
      setProfesionales(data.profesionales || []);
      setMateriales(data.materiales || []);
      setGastos(data.gastos || []);
      setObservaciones(data.observaciones || '');
        setEtapa({ fecha: diaData.fecha });
        setProfesionales([]);
        setMateriales([]);
        setGastos([]);
        setObservaciones('');
      }
    } catch (error) {
      console.error('Error cargando detalle del día:', error);
    } finally {
      setLoading(false);
    }
  };

  const marcarComoCompletado = async () => {
    setGuardando(true);
    try {
      await api.post(
        `/api/obras/${obra.id}/etapas-diarias/${diaData.fecha}/completar`,
        null,
        {
          headers: {
            'empresaId': empresaSeleccionada.id.toString()
          }
        }
      );
      
      onActualizar();
      cargarDetalleDia();
    } catch (error) {
      console.error('Error marcando como completado:', error);
    } finally {
      setGuardando(false);
    }
  };

  const guardarObservaciones = async () => {
    setGuardando(true);
    try {
      await api.put(
        `/api/obras/${obra.id}/etapas-diarias/${diaData.fecha}/observaciones`,
        { observaciones },
        {
          headers: {
            'empresaId': empresaSeleccionada.id.toString()
          }
        }
      );
      
      onActualizar();
    } catch (error) {
      console.error('Error guardando observaciones:', error);
    } finally {
      setGuardando(false);
    }
  };

  const eliminarMaterial = async (materialId) => {
    if (!confirm('¿Eliminar este material del día?')) return;
    
    try {
      await api.delete(
        `/api/obras/${obra.id}/etapas-diarias/${diaData.fecha}/materiales/${materialId}`,
        {
          headers: {
            'empresaId': empresaSeleccionada.id.toString()
          }
        }
      );
      
      setMateriales(prev => prev.filter(m => m.id !== materialId));
      onActualizar();
    } catch (error) {
      console.error('Error eliminando material:', error);
    }
  };

  const eliminarGasto = async (gastoId) => {
    if (!confirm('¿Eliminar este gasto del día?')) return;
    
    try {
      await api.delete(
        `/api/obras/${obra.id}/etapas-diarias/${diaData.fecha}/gastos/${gastoId}`,
        {
          headers: {
            'empresaId': empresaSeleccionada.id.toString()
          }
        }
      );
      
      setGastos(prev => prev.filter(g => g.id !== gastoId));
      onActualizar();
    } catch (error) {
      console.error('Error eliminando gasto:', error);
    }
  };

  const formatearMoneda = (valor) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(valor);
  };

  const formatearHora = (hora) => {
    if (!hora) return '--:--';
    return hora.substring(0, 5);
  };

  const calcularHoras = (entrada, salida) => {
    if (!entrada || !salida) return 'En curso';
    
    const [hE, mE] = entrada.split(':').map(Number);
    const [hS, mS] = salida.split(':').map(Number);
    
    const minutos = (hS * 60 + mS) - (hE * 60 + mE);
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    
    return `${horas}hs${mins > 0 ? ` ${mins}min` : ''}`;
  };

  if (!show) return null;

  return (
    <>
      <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className="modal-dialog modal-xl modal-dialog-scrollable">
          <div className="modal-content">
            {/* Header */}
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="fas fa-calendar-day me-2"></i>
                {diaData?.diaNombre} {diaData?.diaNumero} de {diaData?.mes}
              </h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>

            {/* Body */}
            <div className="modal-body">
              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary"></div>
                </div>
              ) : (
                <>
                  {/* Estado y acciones */}
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <div>
                      <span className={`badge ${
                        diaData.estado === 'completado' ? 'bg-success' :
                        diaData.estado === 'en-curso' ? 'bg-warning' :
                        diaData.estado === 'planeado' ? 'bg-info' : 'bg-secondary'
                      } fs-6`}>
                        {diaData.estado === 'completado' ? '✅ Completado' :
                         diaData.estado === 'en-curso' ? '🔄 En curso' :
                         diaData.estado === 'planeado' ? '📋 Planeado' : '⚪ Sin planificar'}
                      </span>
                    </div>
                    {diaData.estado !== 'completado' && (
                      <button 
                        className="btn btn-success btn-sm"
                        onClick={marcarComoCompletado}
                        disabled={guardando}
                      >
                        <i className="fas fa-check me-2"></i>
                        Marcar como completado
                      </button>
                    )}
                  </div>

                  {/* Sección Profesionales */}
                  <div className="mb-4">
                    <h6 className="border-bottom pb-2">
                      <i className="fas fa-users me-2 text-primary"></i>
                      PROFESIONALES ({profesionales.length})
                    </h6>
                    
                    {profesionales.length === 0 ? (
                      <div className="alert alert-info">
                        <i className="fas fa-info-circle me-2"></i>
                        No hay profesionales asignados para este día
                      </div>
                    ) : (
                      <div className="list-group mb-3">
                        {profesionales.map((prof) => (
                          <div key={prof.id} className="list-group-item">
                            <div className="d-flex justify-content-between align-items-center">
                              <div className="flex-grow-1">
                                <h6 className="mb-1">
                                  ✓ {prof.nombre}
                                  {prof.tipoProfesional && (
                                    <span className="text-muted ms-2">- {prof.tipoProfesional}</span>
                                  )}
                                </h6>
                                <div className="d-flex gap-3 text-muted small">
                                  <span>
                                    <i className="fas fa-sign-in-alt me-1"></i>
                                    Entrada: <strong>{formatearHora(prof.checkIn)}</strong>
                                  </span>
                                  <span>
                                    <i className="fas fa-sign-out-alt me-1"></i>
                                    Salida: <strong>{formatearHora(prof.checkOut)}</strong>
                                  </span>
                                  <span>
                                    <i className="fas fa-clock me-1"></i>
                                    {calcularHoras(prof.checkIn, prof.checkOut)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Sección Materiales */}
                  <div className="mb-4">
                    <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                      <h6 className="mb-0">
                        <i className="fas fa-boxes me-2 text-info"></i>
                        MATERIALES CONSUMIDOS ({materiales.length})
                      </h6>
                      <button 
                        className="btn btn-sm btn-outline-info"
                        onClick={() => setMostrarModalMaterial(true)}
                      >
                        <i className="fas fa-plus me-1"></i>
                        Registrar consumo
                      </button>
                    </div>
                    
                    {materiales.length === 0 ? (
                      <div className="alert alert-secondary">
                        <i className="fas fa-box-open me-2"></i>
                        No hay materiales registrados para este día
                      </div>
                    ) : (
                      <div className="list-group">
                        {materiales.map((mat) => (
                          <div key={mat.id} className="list-group-item">
                            <div className="d-flex justify-content-between align-items-start">
                              <div className="flex-grow-1">
                                <h6 className="mb-1">{mat.nombre}</h6>
                                <div className="d-flex gap-3 text-muted small">
                                  <span>
                                    <i className="fas fa-cubes me-1"></i>
                                    Consumido: <strong>{mat.cantidadConsumida} {mat.unidad}</strong>
                                  </span>
                                  {mat.disponiblePresupuesto && (
                                    <span>
                                      <i className="fas fa-chart-line me-1"></i>
                                      Disponible: {mat.disponiblePresupuesto.disponible}/{mat.disponiblePresupuesto.total}
                                    </span>
                                  )}
                                </div>
                                {mat.observaciones && (
                                  <p className="mb-0 mt-2 small text-muted">
                                    💬 {mat.observaciones}
                                  </p>
                                )}
                              </div>
                              <div className="d-flex gap-1">
                                <button 
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => eliminarMaterial(mat.id)}
                                >
                                  <i className="fas fa-trash"></i>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Sección Gastos Generales */}
                  <div className="mb-4">
                    <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                      <h6 className="mb-0">
                        <i className="fas fa-dollar-sign me-2 text-success"></i>
                        GASTOS GENERALES DEL DÍA ({gastos.length})
                      </h6>
                      <button 
                        className="btn btn-sm btn-outline-success"
                        onClick={() => setMostrarModalGasto(true)}
                      >
                        <i className="fas fa-plus me-1"></i>
                        Agregar gasto
                      </button>
                    </div>
                    
                    {gastos.length === 0 ? (
                      <div className="alert alert-secondary">
                        <i className="fas fa-hand-holding-usd me-2"></i>
                        No hay gastos registrados para este día
                      </div>
                    ) : (
                      <div className="list-group">
                        {gastos.map((gasto) => (
                          <div key={gasto.id} className="list-group-item">
                            <div className="d-flex justify-content-between align-items-start">
                              <div className="flex-grow-1">
                                <h6 className="mb-1">
                                  {gasto.nombre}
                                  <span className="badge bg-success ms-2">
                                    {formatearMoneda(gasto.importe)}
                                  </span>
                                </h6>
                                {gasto.categoria && (
                                  <small className="text-muted">
                                    Categoría: {gasto.categoria}
                                  </small>
                                )}
                                {gasto.observaciones && (
                                  <p className="mb-0 mt-2 small text-muted">
                                    💬 {gasto.observaciones}
                                  </p>
                                )}
                              </div>
                              <button 
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => eliminarGasto(gasto.id)}
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                            </div>
                          </div>
                        ))}
                        <div className="list-group-item bg-light">
                          <div className="d-flex justify-content-between align-items-center">
                            <strong>Total gastos del día:</strong>
                            <strong className="text-success fs-5">
                              {formatearMoneda(gastos.reduce((sum, g) => sum + (g.importe || 0), 0))}
                            </strong>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Observaciones */}
                  <div>
                    <h6 className="border-bottom pb-2">
                      <i className="fas fa-sticky-note me-2 text-warning"></i>
                      OBSERVACIONES
                    </h6>
                    <textarea
                      className="form-control"
                      rows="3"
                      placeholder="Notas sobre este día (clima, incidentes, logros, etc.)"
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                    />
                    <button 
                      className="btn btn-sm btn-primary mt-2"
                      onClick={guardarObservaciones}
                      disabled={guardando}
                    >
                      <i className="fas fa-save me-1"></i>
                      Guardar observaciones
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Aquí irían los modales de agregar material/gasto - por ahora placeholders */}
      {mostrarModalMaterial && (
        <div className="modal show d-block" style={{ zIndex: 1060, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Registrar Material</h5>
                <button className="btn-close" onClick={() => setMostrarModalMaterial(false)}></button>
              </div>
              <div className="modal-body">
                <p className="text-muted">Próximamente: selector de materiales del presupuesto</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ModalDetalleDia;
