import React, { useState } from 'react';

const PresupuestosPorEstado = () => {
  const [empresaId, setEmpresaId] = useState('');
  const [estado, setEstado] = useState('A enviar');
  const [obraId, setObraId] = useState('');
  const [presupuestos, setPresupuestos] = useState([]);
  const [loading, setLoading] = useState(false);

  const buscarPresupuestos = async () => {
    setLoading(true);
    let url = `http://localhost:8080/api/presupuestos/por-estado?empresaId=${empresaId}&estado=${encodeURIComponent(estado)}`;
    if (obraId) url += `&obraId=${obraId}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      setPresupuestos(Array.isArray(data) ? data : []);
    } catch (err) {
      setPresupuestos([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Buscar presupuestos por estado</h2>
      <div style={{ display: 'flex', gap: '1em', marginBottom: '1em' }}>
        <input
          type="number"
          placeholder="ID Empresa"
          value={empresaId}
          onChange={e => setEmpresaId(e.target.value)}
        />
        <input
          type="text"
          placeholder="Estado"
          value={estado}
          onChange={e => setEstado(e.target.value)}
        />
        <input
          type="number"
          placeholder="ID Obra (opcional)"
          value={obraId}
          onChange={e => setObraId(e.target.value)}
        />
        <button onClick={buscarPresupuestos} disabled={loading}>
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </div>
      <table border="1" cellPadding="5">
        <thead>
          <tr>
            <th>ID</th>
            <th>Descripción</th>
            <th>Estado</th>
            <th>Monto Total</th>
            <th>Fecha Creación</th>
            <th>ID Empresa</th>
            <th>ID Obra</th>
          </tr>
        </thead>
        <tbody>
          {presupuestos.map(p => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.descripcion}</td>
              <td>{p.estado}</td>
              <td>{p.montoTotal}</td>
              <td>{p.fechaCreacion}</td>
              <td>{p.idEmpresa}</td>
              <td>{p.idObra}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {presupuestos.length === 0 && !loading && <div>No hay resultados.</div>}
    </div>
  );
};

export default PresupuestosPorEstado;
