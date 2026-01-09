// Hook para cargar empresas y tipos de profesional
import { useEffect, useState } from 'react';
import { empresasApiService } from '../../../services/empresasApiService';
// import { debugTiposProfesionales } from '../../../services/profesionalesObraService';

export function useEmpresasYTipos() {
  const [empresas, setEmpresas] = useState([]);
  const [tiposProfesional, setTiposProfesional] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      empresasApiService.getAll(),
      fetch('/api/profesionales/tipos-disponibles')
        .then(res => res.json())
        .then(tipos => Array.isArray(tipos) ? tipos : [])
    ])
      .then(([emp, tipos]) => {
        setEmpresas(emp);
        setTiposProfesional(tipos);
        setLoading(false);
      })
      .catch(e => {
        setError('Error al cargar datos');
        setLoading(false);
      });
  }, []);

  return { empresas, tiposProfesional, loading, error };
}
