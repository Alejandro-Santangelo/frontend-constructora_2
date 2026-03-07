






import React, { useState } from 'react';
import { useEmpresasYTipos } from './useEmpresasYTipos';
import { useEmpresa } from '../../../EmpresaContext';
import api from '../../../services/api';

const ConsultarPorEspecialidadModal = ({ show, onClose }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [tipoProfesional, setTipoProfesional] = useState('');
  const { tiposProfesional, loading: loadingDatos, error: errorDatos } = useEmpresasYTipos();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resultados, setResultados] = useState(null);

  const handleConsultar = async (e) => {
    e.preventDefault();
    if (!empresaSeleccionada?.id) {
      setError('Debe seleccionar una empresa desde el selector principal');
      return;
    }
    setLoading(true);
    setError(null);
    setResultados(null);
    try {
      const response = await api.get(
        `/api/profesionales-obras/tipo/${encodeURIComponent(tipoProfesional)}?empresaId=${empresaSeleccionada.id}`
      );
      setResultados(response.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Error de red o servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setTipoProfesional('');
    setError(null);
    setResultados(null);
    setLoading(false);
    onClose();
  };  if (!show) return null;

  return (
    <div className="modal show d-block" style={{zIndex: 2000}}>
      <div className="modal-dialog" style={{marginTop: '120px', maxWidth: '500px', width: '99vw'}}>
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Consultar asignaciones por especialidad</h5>
            <button type="button" className="btn-close" onClick={handleClose}></button>
          </div>
          <div className="modal-body" style={{padding: '18px 12px 12px 12px'}}>
            {loadingDatos && <div>Cargando datos...</div>}
            {errorDatos && <div className="alert alert-danger">{errorDatos}</div>}
            <form onSubmit={handleConsultar}>
              <div className="mb-2">
                <label className="form-label">Tipo de profesional
                  <select
                    className="form-select"
                    value={tipoProfesional}
                    onChange={e => setTipoProfesional(e.target.value)}
                    required
                  >
                    <option value="">Seleccione tipo</option>
                    {tiposProfesional.map(tipo => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mb-2" style={{display:'flex', gap:'12px'}}>
                <label className="form-label" style={{flex:1}}>Empresa
                  <input
                    type="text"
                    className="form-control"
                    value={empresaSeleccionada?.nombreEmpresa || empresaSeleccionada?.nombre || ''}
                    disabled
                    readOnly
                  />
                </label>
                <label className="form-label" style={{flex:'0 0 120px'}}>ID
                  <input
                    type="number"
                    className="form-control"
                    value={empresaSeleccionada?.id || ''}
                    disabled
                    readOnly
                  />
                </label>
              </div>
              <button type="submit" className="btn btn-primary w-100 fw-bold" disabled={loading || !tipoProfesional || !empresaSeleccionada?.id}>
                {loading ? 'Consultando...' : 'Consultar'}
              </button>
            </form>
            <div className="mt-3">
              {error && <div className="alert alert-danger">{error}</div>}
              {resultados && Array.isArray(resultados) && resultados.length > 0 && (
                <div>
                  <h5>Resultados:</h5>
                  <ul>
                    {resultados.map(r => (
                      <li key={r.idAsignacion}>
                        <strong>{r.nombreProfesional}</strong> ({r.tipoProfesional}) - Obra: {r.nombreObra} ({r.estadoObra})<br />
                        Dirección: {r.direccionObra} | Rol: {r.rolEnObra} | Valor/hora: ${r.valorHoraAsignado}<br />
                        Desde: {r.fechaDesde} Hasta: {r.fechaHasta} {r.activo ? '[Activo]' : '[Inactivo]'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {resultados && Array.isArray(resultados) && resultados.length === 0 && (
                <div className="alert alert-info">No se encontraron asignaciones para los criterios ingresados.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsultarPorEspecialidadModal;

