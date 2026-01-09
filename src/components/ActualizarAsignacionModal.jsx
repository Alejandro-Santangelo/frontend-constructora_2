// Modal para actualizar una asignación existente
import React, { useState, useEffect } from 'react';
import ObraSelector from './ObraSelector';
import ProfesionalSelector from './ProfesionalSelector';
import AsignacionSelector from './AsignacionSelector';
import { useEmpresa } from '../EmpresaContext';

const ActualizarAsignacionModal = ({ show, onClose, asignacionId, empresaId }) => {
  const { empresaSeleccionada } = useEmpresa();
  
  const [form, setForm] = useState({
    asignacionId: asignacionId || '',
    empresaId: empresaSeleccionada?.id || empresaId || '',
    profesional: '',
    obraId: '',
    fechaDesde: '',
    fechaHasta: '',
    rolEnObra: '',
    valorHoraAsignado: '',
    activo: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resultado, setResultado] = useState(null);

  // Sincronizar asignacionId cuando cambie el prop
  useEffect(() => {
    if (asignacionId) {
      setForm(f => ({ ...f, asignacionId }));
    }
  }, [asignacionId]);

  // Sincronizar empresaId con el contexto
  useEffect(() => {
    if (empresaId) {
      setForm(f => ({ ...f, empresaId }));
    } else if (empresaSeleccionada?.id) {
      setForm(f => ({ ...f, empresaId: empresaSeleccionada.id }));
    }
  }, [empresaId, empresaSeleccionada]);

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({
      ...f,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResultado(null);
    try {
      const params = [];
      if (form.empresaId) params.push(`empresaId=${form.empresaId}`);
      if (form.obraId) params.push(`obraId=${form.obraId}`);
      const query = params.length > 0 ? `?${params.join('&')}` : '';
      const response = await fetch(`/api/profesionales-obras/${form.asignacionId}${query}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
        body: JSON.stringify(form)
      });
      if (!response.ok) {
        const err = await response.json();
        setError(err.message || 'Error desconocido');
      } else {
        const data = await response.json();
        setResultado(data);
      }
    } catch (e) {
      setError('Error de red o servidor');
    }
    setLoading(false);
  };

  const handleClose = () => {
    setForm({
      asignacionId: '',
      empresaId: empresaSeleccionada?.id || '',
      profesional: '',
      obraId: '',
      fechaDesde: '',
      fechaHasta: '',
      rolEnObra: '',
      valorHoraAsignado: '',
      activo: true
    });
    setError(null);
    setResultado(null);
    setLoading(false);
    onClose();
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{zIndex: 2000}}>
      <div className="modal-dialog" style={{marginTop: '120px', maxWidth: '600px', width: '99vw'}}>
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Actualizar asignación</h5>
            <button type="button" className="btn-close" onClick={handleClose}></button>
          </div>
          <div className="modal-body">
            <form onSubmit={handleSubmit}>
              {/* Empresa (solo lectura) */}
              <div className="mb-3 p-3 bg-light rounded">
                <div className="row">
                  <div className="col-md-6">
                    <strong>ID Empresa:</strong> {empresaSeleccionada?.id || '-'}
                  </div>
                  <div className="col-md-6">
                    <strong>Empresa:</strong> {empresaSeleccionada?.nombreEmpresa || empresaSeleccionada?.nombre || '-'}
                  </div>
                </div>
              </div>
              
              <div className="mb-2" style={{display:'flex', gap:'12px'}}>
                <label className="form-label" style={{flex:1}}>Obra
                  <ObraSelector
                    empresaId={form.empresaId}
                    value={form.obraId}
                    onChange={obraId => setForm(f => ({ ...f, obraId, profesionalId: '', asignacionId: '' }))}
                    required={true}
                  />
                </label>
              </div>
              <div className="mb-2" style={{display:'flex', gap:'12px'}}>
                <label className="form-label" style={{flex:1}}>Profesional
                  <ProfesionalSelector
                    empresaId={form.empresaId}
                    obraId={form.obraId}
                    value={form.profesionalId || ''}
                    onChange={profesionalId => setForm(f => ({ ...f, profesionalId, asignacionId: '' }))}
                    required={true}
                  />
                </label>
                <label className="form-label" style={{flex:1}}>Asignación
                  <AsignacionSelector
                    empresaId={form.empresaId}
                    obraId={form.obraId}
                    profesionalId={form.profesionalId}
                    value={form.asignacionId || ''}
                    onChange={asignacionId => setForm(f => ({ ...f, asignacionId }))}
                    required={true}
                  />
                </label>
              </div>
              <div className="mb-2">
                <label className="form-label">Profesional
                  <input type="text" className="form-control" name="profesional" value={form.profesional} onChange={handleChange} style={{borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}} />
                </label>
              </div>
              <div className="mb-2" style={{display:'flex', gap:'12px'}}>
                <label className="form-label" style={{flex:1}}>Obra ID
                  <input type="number" className="form-control" name="obraId" value={form.obraId} onChange={handleChange} style={{borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}} />
                </label>
                <label className="form-label" style={{flex:1}}>Fecha desde
                  <input type="date" className="form-control" name="fechaDesde" value={form.fechaDesde} onChange={handleChange} style={{borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}} />
                </label>
                <label className="form-label" style={{flex:1}}>Fecha hasta
                  <input type="date" className="form-control" name="fechaHasta" value={form.fechaHasta} onChange={handleChange} style={{borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}} />
                </label>
              </div>
              <div className="mb-2">
                <label className="form-label">Rol en obra
                  <input type="text" className="form-control" name="rolEnObra" value={form.rolEnObra} onChange={handleChange} style={{borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}} />
                </label>
              </div>
              <div className="mb-2">
                <label className="form-label">Valor hora asignado
                  <input type="number" className="form-control" name="valorHoraAsignado" value={form.valorHoraAsignado} onChange={handleChange} style={{borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}} />
                </label>
              </div>
              <div className="mb-2">
                <label className="form-label">Activo
                  <input type="checkbox" className="form-check-input" name="activo" checked={form.activo} onChange={handleChange} />
                </label>
              </div>
              <button type="submit" className="btn btn-primary w-100 fw-bold" disabled={loading}>
                {loading ? 'Actualizando...' : 'Actualizar'}
              </button>
            </form>
            <div className="mt-3">
              {error && <div className="alert alert-danger">{error}</div>}
              {resultado && (
                <div className="alert alert-success">
                  <strong>Asignación actualizada:</strong><br />
                  ID: {resultado.idAsignacion}<br />
                  Profesional: {resultado.nombreProfesional} ({resultado.tipoProfesional})<br />
                  Obra: {resultado.nombreObra} ({resultado.estadoObra})<br />
                  Dirección: {resultado.direccionObra}<br />
                  Fechas: {resultado.fechaDesde} a {resultado.fechaHasta}<br />
                  Rol: {resultado.rolEnObra}<br />
                  Valor/hora: ${resultado.valorHoraAsignado}<br />
                  Activo: {resultado.activo ? 'Sí' : 'No'}<br />
                  Creado: {resultado.fechaCreacion}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActualizarAsignacionModal;
