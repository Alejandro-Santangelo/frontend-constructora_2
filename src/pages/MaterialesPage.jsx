import React, { useEffect, useState } from 'react';
import api from '../services/api';

const MaterialesPage = () => {
  const [materiales, setMateriales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);


  useEffect(() => {
    api.materiales.getAll()
      .then(res => setMateriales(res.data || []))
      .catch(err => {
        if (err && err.data) {
          let msg = err.data.message || 'No se pudieron cargar los materiales.';
          if (err.data.validationErrors) {
            msg += ': ' + Object.entries(err.data.validationErrors).map(([k, v]) => `${k}: ${v}`).join(', ');
          }
          setError(msg);
        } else {
          setError('No se pudieron cargar los materiales.');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Cargando materiales...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div className="container mt-4">
      <h2>Materiales</h2>
      {materiales.length === 0 ? (
        <div className="alert alert-warning">No hay materiales registrados.</div>
      ) : (
        <table className="table table-bordered table-sm mt-3">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Precio</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            {materiales.map(mat => (
              <tr key={mat.id}>
                <td>{mat.id}</td>
                <td>{mat.nombre}</td>
                <td>{mat.precio}</td>
                <td>{mat.stock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default MaterialesPage;
