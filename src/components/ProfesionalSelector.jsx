import React, { useEffect, useState } from 'react';

const ProfesionalSelector = ({ empresaId, obraId, value, onChange, required = false, className = "form-select", placeholder = "Seleccionar profesional..." }) => {
  const [profesionales, setProfesionales] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (empresaId && obraId) {
      setLoading(true);
      fetch(`/api/profesionales-obras/profesionales-por-obra?empresaId=${empresaId}&obraId=${obraId}`)
        .then(res => res.json())
        .then(data => {
          setProfesionales(Array.isArray(data) ? data : []);
          setLoading(false);
        })
        .catch(() => {
          setProfesionales([]);
          setLoading(false);
        });
    } else {
      setProfesionales([]);
    }
  }, [empresaId, obraId]);

  if (loading) {
    return (
      <select className={className} disabled>
        <option>Cargando profesionales...</option>
      </select>
    );
  }

  return (
    <select
      className={className}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      required={required}
      disabled={!empresaId || !obraId}
    >
      <option value="">{(!empresaId || !obraId) ? 'Seleccione empresa y obra' : (profesionales.length === 0 ? 'No hay profesionales disponibles' : placeholder)}</option>
      {profesionales.map(prof => (
        <option key={`prof-${prof.id}`} value={prof.id}>
          {prof.nombre} ({prof.tipoProfesional})
        </option>
      ))}
    </select>
  );
};

export default ProfesionalSelector;
