import React, { useState, useEffect } from 'react';
import { useEmpresa } from '../EmpresaContext';
import api from '../services/api';

export default function DiagnosticoCajaChica({ show, onHide }) {
  const { empresaSeleccionada } = useEmpresa();
  const [presupuestos, setPresupuestos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    if (show && empresaSeleccionada) {
      cargarPresupuestos();
    }
  }, [show, empresaSeleccionada]);

  const cargarPresupuestos = async () => {
    setLoading(true);
    try {
      const response = await api.presupuestosNoCliente.getPorEmpresa(empresaSeleccionada.id);
      setPresupuestos(response.data || []);
    } catch (err) {
      console.error('Error cargando presupuestos:', err);
    } finally {
      setLoading(false);
    }
  };

  const presupuestosFiltrados = presupuestos.filter(p => {
    if (!filtro) return true;
    const calle = (p.direccionObraCalle || p.calle || '').toLowerCase();
    return calle.includes(filtro.toLowerCase());
  });

  const presupuestosConCajaChica = presupuestosFiltrados.filter(p => {
    const otrosCostos = typeof p.otros_costos_json === 'string'
      ? JSON.parse(p.otros_costos_json || '[]')
      : (Array.isArray(p.otros_costos_json) ? p.otros_costos_json : []);
    
    return otrosCostos.some(c => c.tipo === 'CAJA_CHICA');
  });

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{zIndex: 2000, backgroundColor: 'rgba(0,0,0,0.5)'}}>
      <div className="modal-dialog modal-xl" style={{marginTop: '50px', maxWidth: '95vw'}}>
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">🔍 Diagnóstico: Caja Chica en BD</h5>
            <button type="button" className="btn-close" onClick={onHide}></button>
          </div>

          <div className="modal-body" style={{maxHeight: '80vh', overflowY: 'auto'}}>
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border" role="status"></div>
                <p className="mt-3">Cargando presupuestos...</p>
              </div>
            ) : (
              <>
                <div className="mb-3">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Filtrar por calle..."
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                  />
                </div>

                <div className="alert alert-info">
                  <strong>Total presupuestos:</strong> {presupuestos.length}<br/>
                  <strong>Con caja chica asignada:</strong> {presupuestosConCajaChica.length}
                </div>

                {presupuestosConCajaChica.length === 0 ? (
                  <div className="alert alert-warning">
                    ⚠️ No se encontró ningún presupuesto con caja chica asignada
                  </div>
                ) : (
                  presupuestosConCajaChica.map(p => {
                    const otrosCostos = typeof p.otros_costos_json === 'string'
                      ? JSON.parse(p.otros_costos_json || '[]')
                      : (Array.isArray(p.otros_costos_json) ? p.otros_costos_json : []);
                    
                    const cajaChica = otrosCostos.filter(c => c.tipo === 'CAJA_CHICA');
                    
                    const profesionales = typeof p.profesionales_json === 'string'
                      ? JSON.parse(p.profesionales_json || '[]')
                      : (Array.isArray(p.profesionales_json) ? p.profesionales_json : []);

                    return (
                      <div key={p.id} className="card mb-3">
                        <div className="card-header bg-primary text-white">
                          <strong>Presupuesto #{p.id}</strong> - {p.direccionObraCalle || p.calle} {p.direccionObraAltura || p.altura}
                          {p.direccionObraPiso && ` Piso ${p.direccionObraPiso}`}
                          {p.direccionObraDepartamento && ` Depto ${p.direccionObraDepartamento}`}
                        </div>
                        <div className="card-body">
                          <h6 className="text-success">✅ Profesionales en presupuesto ({profesionales.length}):</h6>
                          <pre className="bg-light p-2 rounded" style={{fontSize: '0.85em'}}>
                            {JSON.stringify(profesionales, null, 2)}
                          </pre>

                          <h6 className="text-primary mt-3">💰 Caja Chica Asignada ({cajaChica.length}):</h6>
                          {cajaChica.map((cc, idx) => (
                            <div key={idx} className="alert alert-success mb-2">
                              <strong>Profesional:</strong> {cc.profesionalNombre || '(vacío)'} - <strong>Tipo:</strong> {cc.profesionalTipo || '(vacío)'}<br/>
                              <strong>Monto:</strong> ${cc.monto}<br/>
                              <strong>Fecha:</strong> {cc.fecha}<br/>
                              <strong>Descripción:</strong> {cc.descripcion}
                            </div>
                          ))}

                          <h6 className="text-muted mt-3">📄 otros_costos_json completo:</h6>
                          <pre className="bg-light p-2 rounded" style={{fontSize: '0.75em', maxHeight: '200px', overflowY: 'auto'}}>
                            {JSON.stringify(otrosCostos, null, 2)}
                          </pre>
                        </div>
                      </div>
                    );
                  })
                )}

                {presupuestosFiltrados.length > 0 && presupuestosConCajaChica.length === 0 && (
                  <div className="mt-4">
                    <h6>📋 Primeros 3 presupuestos (sin caja chica):</h6>
                    {presupuestosFiltrados.slice(0, 3).map(p => {
                      const profesionales = typeof p.profesionales_json === 'string'
                        ? JSON.parse(p.profesionales_json || '[]')
                        : (Array.isArray(p.profesionales_json) ? p.profesionales_json : []);
                      
                      const otrosCostos = typeof p.otros_costos_json === 'string'
                        ? JSON.parse(p.otros_costos_json || '[]')
                        : (Array.isArray(p.otros_costos_json) ? p.otros_costos_json : []);

                      return (
                        <div key={p.id} className="card mb-2">
                          <div className="card-header">
                            Presupuesto #{p.id} - {p.direccionObraCalle || p.calle} {p.direccionObraAltura || p.altura}
                          </div>
                          <div className="card-body">
                            <div><strong>Profesionales ({profesionales.length}):</strong></div>
                            <pre className="bg-light p-2" style={{fontSize: '0.8em'}}>
                              {JSON.stringify(profesionales, null, 2)}
                            </pre>
                            <div className="mt-2"><strong>otros_costos_json:</strong></div>
                            <pre className="bg-light p-2" style={{fontSize: '0.8em'}}>
                              {JSON.stringify(otrosCostos, null, 2)}
                            </pre>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onHide}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
