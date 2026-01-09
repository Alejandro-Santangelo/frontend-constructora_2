import React, { useEffect, useState } from 'react';

const AsignacionSelector = ({ empresaId, obraId, profesionalId, value, onChange, required = false, className = "form-select", placeholder = "Seleccionar asignación..." }) => {
  const [asignaciones, setAsignaciones] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (empresaId && obraId && profesionalId) {
      setLoading(true);
      fetch(`/api/profesionales-obras/asignaciones?empresaId=${empresaId}&obraId=${obraId}&profesionalId=${profesionalId}`)
        .then(res => res.json())
        .then(data => {
          setAsignaciones(Array.isArray(data) ? data : []);
          setLoading(false);
        })
        .catch(() => {
          setAsignaciones([]);
          setLoading(false);
        });
    } else {
      setAsignaciones([]);
    }
  }, [empresaId, obraId, profesionalId]);

  if (loading) {
    return (
      <select className={className} disabled>
        <option>Cargando asignaciones...</option>
      </select>
    );
  }

  return (
    <select
      className={className}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      required={required}
      disabled={!empresaId || !obraId || !profesionalId}
    >
      <option value="">{(!empresaId || !obraId || !profesionalId) ? 'Seleccione empresa, obra y profesional' : (asignaciones.length === 0 ? 'No hay asignaciones disponibles' : placeholder)}</option>
      {asignaciones.map(asig => (
        <option key={`asig-${asig.idAsignacion}`} value={asig.idAsignacion}>
          {`Asignación #${asig.idAsignacion}`}
        </option>
      ))}
    </select>
  );
};

export default AsignacionSelector;
