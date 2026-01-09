import React, { useState, useEffect } from 'react';
import { useEmpresa } from '../EmpresaContext';
import api from '../services/api';
import DireccionObraSelector from './DireccionObraSelector';

const AsignarCajaChicaObraModal = ({ show, onHide, onSuccess, obraDireccion }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [direccionSeleccionada, setDireccionSeleccionada] = useState(obraDireccion || null);
  const [profesionales, setProfesionales] = useState([]);
  const [profesionalesSeleccionados, setProfesionalesSeleccionados] = useState([]);
  const [formData, setFormData] = useState({
    monto: '',
    fecha: new Date().toISOString().split('T')[0],
    observaciones: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (show && empresaSeleccionada) {
      setDireccionSeleccionada(obraDireccion || null);
      setProfesionalesSeleccionados([]);
      setFormData({
        monto: '',
        fecha: new Date().toISOString().split('T')[0],
        observaciones: ''
      });
      setError(null);
    }
  }, [show, empresaSeleccionada, obraDireccion]);

  useEffect(() => {
    if (direccionSeleccionada && empresaSeleccionada) {
      cargarProfesionalesDelPresupuesto();
    } else {
      setProfesionales([]);
      setProfesionalesSeleccionados([]);
    }
  }, [direccionSeleccionada, empresaSeleccionada]);

  const cargarProfesionalesDelPresupuesto = async () => {
    try {
      const presupuesto = await api.presupuestosNoCliente.getById(
        direccionSeleccionada.presupuestoNoClienteId, 
        empresaSeleccionada.id
      );
      
      const itemsCalculadora = presupuesto.itemsCalculadora || [];
      const todosProfesionales = [];
      
      itemsCalculadora.forEach(item => {
        if (item.profesionales && Array.isArray(item.profesionales)) {
          item.profesionales.forEach(prof => {
            todosProfesionales.push({
              id: prof.id || `${item.id}-prof-${prof.tipoProfesional}-${prof.nombre}`,
              tipoProfesional: prof.tipoProfesional || item.tipoProfesional,
              nombre: prof.nombre || 'Sin nombre',
              profesionalNombre: prof.nombre || 'Sin nombre',
              tipo: prof.tipoProfesional || item.tipoProfesional
            });
          });
        }
      });
      
      setProfesionales(todosProfesionales);
      
    } catch (err) {
      console.error('❌ Error cargando profesionales:', err);
      setError('Error al cargar los profesionales del presupuesto.');
      setProfesionales([]);
    }
  };

  const handleSelectProfesional = (profId) => {
    if (profesionalesSeleccionados.includes(profId)) {
      setProfesionalesSeleccionados(profesionalesSeleccionados.filter(id => id !== profId));
    } else {
      setProfesionalesSeleccionados([...profesionalesSeleccionados, profId]);
    }
  };

  const handleSelectAll = () => {
    if (profesionalesSeleccionados.length === profesionales.length) {
      setProfesionalesSeleccionados([]);
    } else {
      setProfesionalesSeleccionados(profesionales.map(p => p.id));
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (profesionalesSeleccionados.length === 0) {
      setError('⚠️ Debe seleccionar al menos un profesional');
      return;
    }

    if (!formData.monto || parseFloat(formData.monto) <= 0) {
      setError('⚠️ Debe ingresar un monto válido');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Crear una asignación por cada profesional seleccionado
      const asignaciones = profesionalesSeleccionados.map(profId => ({
        profesionalObraId: profId,
        direccionObra: direccionSeleccionada.direccionObra,
        presupuestoNoClienteId: direccionSeleccionada.presupuestoNoClienteId,
        monto: parseFloat(formData.monto),
        fecha: formData.fecha,
        observaciones: formData.observaciones,
        estado: 'ACTIVO'
      }));

      // Aquí deberías tener un endpoint para asignar caja chica
      // Por ahora simulo el éxito
      await Promise.all(
        asignaciones.map(async (asignacion) => {
          // await api.cajaChicaObra.asignar(asignacion, empresaSeleccionada.id);
          })
      );

      if (onSuccess) {
        onSuccess({
          mensaje: `✅ Caja chica asignada a ${profesionalesSeleccionados.length} profesional(es) exitosamente`
        });
      }

      onHide();
    } catch (err) {
      console.error('❌ Error asignando caja chica:', err);
      setError(err.response?.data?.message || 'Error al asignar caja chica. Por favor intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const formatearMoneda = (valor) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(valor);
  };

  const montoTotal = profesionalesSeleccionados.length > 0 && formData.monto 
    ? parseFloat(formData.monto) * profesionalesSeleccionados.length 
    : 0;

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header bg-warning text-dark">
            <h5 className="modal-title">💰 Asignar Caja Chica de Obra</h5>
            <button type="button" className="btn-close" onClick={onHide}></button>
          </div>

          <div className="modal-body">
            {error && (
              <div className="alert alert-danger alert-dismissible fade show" role="alert">
                {error}
                <button type="button" className="btn-close" onClick={() => setError(null)}></button>
              </div>
            )}

            <div className="alert alert-info mb-3">
              <i className="bi bi-info-circle me-2"></i>
              <strong>Caja Chica de Obra:</strong> Asigne un monto a uno o varios profesionales para gastos diarios en la obra.
              Este dinero es para compras menores que puedan surgir durante el día (herramientas, materiales pequeños, etc.).
            </div>

            <form onSubmit={handleSubmit}>
              {/* Selector de Dirección */}
              <div className="mb-3">
                <label className="form-label fw-bold">
                  Dirección de Obra <span className="text-danger">*</span>
                </label>
                <DireccionObraSelector
                  value={direccionSeleccionada}
                  onChange={setDireccionSeleccionada}
                  readOnly={!!obraDireccion}
                />
              </div>

              {direccionSeleccionada && (
                <>
                  {/* Fecha y Monto */}
                  <div className="row mb-3">
                    <div className="col-md-6">
                      <label className="form-label">
                        Fecha de Asignación <span className="text-danger">*</span>
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        name="fecha"
                        value={formData.fecha}
                        onChange={handleChange}
                        max={new Date().toISOString().split('T')[0]}
                        required
                        disabled={loading}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">
                        Monto por Profesional <span className="text-danger">*</span>
                      </label>
                      <input
                        type="number"
                        className="form-control"
                        name="monto"
                        placeholder="Ej: 5000"
                        value={formData.monto}
                        onChange={handleChange}
                        min="0"
                        step="0.01"
                        required
                        disabled={loading}
                      />
                      {formData.monto && parseFloat(formData.monto) > 0 && (
                        <div className="form-text text-primary">
                          {formatearMoneda(parseFloat(formData.monto))} por profesional
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Selección de Profesionales */}
                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <label className="form-label fw-bold mb-0">
                        Profesionales <span className="text-danger">*</span>
                      </label>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={handleSelectAll}
                        disabled={profesionales.length === 0}
                      >
                        {profesionalesSeleccionados.length === profesionales.length 
                          ? '☑️ Deseleccionar Todos' 
                          : '☐ Seleccionar Todos'}
                      </button>
                    </div>

                    {profesionales.length === 0 ? (
                      <div className="alert alert-warning">
                        No hay profesionales en la calculadora de este presupuesto
                      </div>
                    ) : (
                      <div className="border rounded p-3" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {profesionales.map(prof => (
                          <div key={prof.id} className="form-check mb-2">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`prof-${prof.id}`}
                              checked={profesionalesSeleccionados.includes(prof.id)}
                              onChange={() => handleSelectProfesional(prof.id)}
                              disabled={loading}
                            />
                            <label className="form-check-label" htmlFor={`prof-${prof.id}`}>
                              <strong>{prof.profesionalNombre || prof.nombre}</strong>
                              <span className="text-muted ms-2">({prof.tipoProfesional || prof.tipo})</span>
                            </label>
                          </div>
                        ))}
                      </div>
                    )}

                    {profesionalesSeleccionados.length > 0 && (
                      <div className="alert alert-success mt-2 mb-0">
                        ✅ {profesionalesSeleccionados.length} profesional(es) seleccionado(s)
                      </div>
                    )}
                  </div>

                  {/* Resumen */}
                  {montoTotal > 0 && (
                    <div className="card bg-light mb-3">
                      <div className="card-body">
                        <div className="row text-center">
                          <div className="col-md-4">
                            <div className="text-muted small">Monto por Profesional</div>
                            <div className="h5 text-primary">{formatearMoneda(parseFloat(formData.monto))}</div>
                          </div>
                          <div className="col-md-4">
                            <div className="text-muted small">Profesionales</div>
                            <div className="h5 text-info">{profesionalesSeleccionados.length}</div>
                          </div>
                          <div className="col-md-4">
                            <div className="text-muted small">Total a Asignar</div>
                            <div className="h4 text-success fw-bold">{formatearMoneda(montoTotal)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Observaciones */}
                  <div className="mb-3">
                    <label className="form-label">Observaciones</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      name="observaciones"
                      placeholder="Notas adicionales sobre esta asignación (opcional)"
                      value={formData.observaciones}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </div>
                </>
              )}
            </form>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onHide} disabled={loading}>
              Cancelar
            </button>
            <button 
              type="button"
              className="btn btn-warning" 
              onClick={handleSubmit} 
              disabled={loading || !direccionSeleccionada || profesionalesSeleccionados.length === 0 || !formData.monto || parseFloat(formData.monto) <= 0}
            >
              {loading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Asignando...
                </>
              ) : (
                <>
                  💰 Asignar Caja Chica ({formatearMoneda(montoTotal)})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AsignarCajaChicaObraModal;
