// Modal para desactivar una asignación existente
import React, { useState, useEffect } from 'react';
import ObraSelector from './ObraSelector';
import ProfesionalSelector from './ProfesionalSelector';
import AsignacionSelector from './AsignacionSelector';
import { useEmpresa } from '../EmpresaContext';

const DesactivarAsignacionModal = ({ show, onClose, asignacionId, empresaId }) => {
  const { empresaSeleccionada } = useEmpresa();
  
  const [form, setForm] = useState({
    empresaId: empresaId || empresaSeleccionada?.id || '',
    obraId: '',
    profesionalId: '',
    asignacionId: asignacionId || ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resultado, setResultado] = useState(null);

  // Sincronizar con props cuando cambien
  useEffect(() => {
    if (asignacionId) {
      setForm(f => ({ ...f, asignacionId }));
    }
  }, [asignacionId]);

  useEffect(() => {
    if (empresaId) {
      setForm(f => ({ ...f, empresaId }));
    } else if (empresaSeleccionada?.id) {
      setForm(f => ({ ...f, empresaId: empresaSeleccionada.id }));
    }
  }, [empresaId, empresaSeleccionada]);

  const handleChange = (name, value) => {
    setForm(f => ({
      ...f,
      [name]: value,
      ...(name === 'empresaId' ? { obraId: '', profesionalId: '', asignacionId: '' } : {}),
      ...(name === 'obraId' ? { profesionalId: '', asignacionId: '' } : {}),
      ...(name === 'profesionalId' ? { asignacionId: '' } : {})
    }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResultado(null);
    try {
      const url = `/api/profesionales-obras/${form.asignacionId}?empresaId=${form.empresaId}&obraId=${form.obraId}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'Accept': '*/*' }
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
    setForm({ empresaId: empresaSeleccionada?.id || '', obraId: '', profesionalId: '', asignacionId: '' });
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
            <h5 className="modal-title">Desactivar asignación</h5>
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
                    onChange={obraId => handleChange('obraId', obraId)}
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
                    onChange={profesionalId => handleChange('profesionalId', profesionalId)}
                    required={true}
                  />
                </label>
                <label className="form-label" style={{flex:1}}>Asignación
                  <AsignacionSelector
                    empresaId={form.empresaId}
                    obraId={form.obraId}
                    profesionalId={form.profesionalId}
                    value={form.asignacionId || ''}
                    onChange={asignacionId => handleChange('asignacionId', asignacionId)}
                    required={true}
                  />
                </label>
              </div>
              <button type="submit" className="btn btn-danger w-100 fw-bold" disabled={loading || !form.empresaId || !form.obraId || !form.asignacionId}>
                {loading ? 'Desactivando...' : 'Desactivar asignación'}
              </button>
            </form>
            <div className="mt-3">
              {error && <div className="alert alert-danger">{error}</div>}
              {resultado && (
                <div className="alert alert-success">
                  <strong>Asignación desactivada:</strong><br />
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

export default DesactivarAsignacionModal;
