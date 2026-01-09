// Modal para listar profesionales asignados a una obra de una empresa
import React, { useState, useEffect } from 'react';
import { useEmpresa } from '../EmpresaContext';
import api from '../services/api';

const ProfesionalesPorObraModal = ({ show, onClose }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [obraId, setObraId] = useState('');
  const [obras, setObras] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resultados, setResultados] = useState(null);
  const [presupuestos, setPresupuestos] = useState([]);

  // Cargar presupuestos al abrir el modal
  useEffect(() => {
    if (show && empresaSeleccionada) {
      cargarPresupuestos();
    }
  }, [show, empresaSeleccionada]);

  const cargarPresupuestos = async () => {
    try {
      const response = await api.presupuestosNoCliente.getAll(empresaSeleccionada.id);
      const lista = Array.isArray(response) ? response : (response.datos || response.content || []);
      setPresupuestos(lista);
      console.log('📦 Presupuestos cargados:', lista.length);
    } catch (err) {
      console.error('Error cargando presupuestos:', err);
    }
  };

  // Cargar obras al seleccionar empresa
  useEffect(() => {
    if (empresaSeleccionada?.id) {
      api.obras.getPorEmpresa(empresaSeleccionada.id)
        .then(data => setObras(Array.isArray(data) ? data : []))
        .catch(() => setObras([]));
    } else {
      setObras([]);
    }
  }, [empresaSeleccionada]);

  const handleConsultar = async (e) => {
    e.preventDefault();
    if (!empresaSeleccionada?.id) {
      setError('Debe seleccionar una empresa desde el selector principal');
      return;
    }
    
    if (!obraId) {
      setError('Debe seleccionar una obra');
      return;
    }
    
    setLoading(true);
    setError(null);
    setResultados(null);
    
    try {
      console.log('🔍 Buscando profesionales para obra ID:', obraId);
      
      // Buscar la obra seleccionada
      const obraSeleccionada = obras.find(o => o.id == obraId);
      
      if (!obraSeleccionada) {
        setError('Obra no encontrada');
        setLoading(false);
        return;
      }
      
      console.log('📍 Obra seleccionada:', obraSeleccionada);
      console.log('📦 Total presupuestos disponibles:', presupuestos.length);
      
      // Mostrar resumen de presupuestos
      if (presupuestos.length > 0) {
        console.log('📋 Presupuestos disponibles:');
        presupuestos.forEach(p => {
          console.log(`  - ID: ${p.id}, Calle: "${p.direccionObraCalle}", Altura: "${p.direccionObraAltura}"`);
        });
      }
      
      // Extraer dirección de la obra (puede estar en diferentes campos)
      const obraNombre = obraSeleccionada.nombreObra || obraSeleccionada.nombre || '';
      
      // Intentar extraer calle y altura del nombre (formato: "Obra Calle Altura...")
      let obraCalle = obraSeleccionada.calle || '';
      let obraAltura = obraSeleccionada.altura || '';
      
      // Si no hay calle, intentar parsear del nombre
      if (!obraCalle && obraNombre) {
        // Formato común: "Obra Larrañaga 15 Piso 2 Depto C"
        const match = obraNombre.match(/Obra\s+(.+?)\s+(\d+)/i);
        if (match) {
          obraCalle = match[1].trim();
          obraAltura = match[2];
        }
      }
      
      console.log('🔎 Buscando con:', { obraCalle, obraAltura });
      
      // Buscar presupuestos que coincidan con la dirección de la obra
      const presupuestosDeObra = presupuestos.filter(p => {
        const pCalle = (p.direccionObraCalle || '').toLowerCase().trim();
        const pAltura = (p.direccionObraAltura || '').toString().trim();
        const oCalle = obraCalle.toLowerCase().trim();
        const oAltura = obraAltura.toString().trim();
        
        const calleMatch = pCalle.includes(oCalle) || oCalle.includes(pCalle);
        const alturaMatch = !oAltura || pAltura === oAltura;
        
        const match = calleMatch && alturaMatch;
        
        if (match) {
          console.log('✅ Presupuesto coincide:', p.id, p.direccionObraCalle, p.direccionObraAltura);
        }
        
        return match;
      });
      
      console.log('📦 Presupuestos de esta obra:', presupuestosDeObra.length);
      
      // Extraer profesionales de los presupuestos
      const profesionalesUnicos = new Map();
      presupuestosDeObra.forEach(presupuesto => {
        try {
          const profesionales = presupuesto.profesionales_json || presupuesto.profesionalesJson || [];
          const profesionalesArray = typeof profesionales === 'string' 
            ? JSON.parse(profesionales) 
            : profesionales;
          
          if (Array.isArray(profesionalesArray)) {
            console.log(`  📦 Presupuesto ${presupuesto.id} tiene ${profesionalesArray.length} profesionales`);
            profesionalesArray.forEach((prof, index) => {
              console.log(`    ${index + 1}. Nombre: "${prof.nombre || prof.nombreProfesional}", Tipo: "${prof.tipo || prof.tipoProfesional}"`);
              
              // Crear ID único basado SOLO en nombre + tipo (para deduplicar entre versiones)
              const nombre = (prof.nombre || prof.nombreProfesional || '').trim().toLowerCase();
              const tipo = (prof.tipo || prof.tipoProfesional || '').trim().toUpperCase();
              const profId = `${nombre}_${tipo}`;
              
              // Solo agregar si no existe ya (para evitar duplicados)
              if (!profesionalesUnicos.has(profId)) {
                // Agregar información adicional
                const direccionCompleta = [
                  presupuesto.direccionObraBarrio,
                  presupuesto.direccionObraCalle,
                  presupuesto.direccionObraAltura,
                  presupuesto.direccionObraTorre ? `Torre ${presupuesto.direccionObraTorre}` : null
                ].filter(Boolean).join(' ');
                
                const profesionalConInfo = {
                  ...prof,
                  uniqueId: `${presupuesto.id}_${profId}`, // Key única para React
                  presupuestoId: presupuesto.id,
                  presupuestoDireccion: direccionCompleta,
                  presupuestoVersion: presupuesto.version,
                  fechaAsignacion: presupuesto.fechaCreacion,
                  // Mapear campos comunes
                  nombre: prof.nombre || prof.nombreProfesional,
                  tipoProfesional: prof.tipo || prof.tipoProfesional,
                  telefono: prof.telefono || '-',
                  email: prof.email || '-',
                  especialidad: prof.especialidad || prof.tipo || '-',
                  valorHoraDefault: prof.valorHora || prof.valorHoraDefault || 0,
                  activo: true
                };
                
                profesionalesUnicos.set(profId, profesionalConInfo);
                console.log(`      ✅ Agregado: ${profId}`);
              } else {
                console.log(`      ⚠️ Ya existe, ignorando duplicado: ${profId}`);
              }
            });
          }
        } catch (err) {
          console.error('Error parseando profesionales del presupuesto:', presupuesto.id, err);
        }
      });
      
      const profesionalesArray = Array.from(profesionalesUnicos.values());
      console.log('✅ Profesionales encontrados:', profesionalesArray.length);
      console.log('📋 Detalle de profesionales:');
      profesionalesArray.forEach(p => {
        console.log(`  - ${p.nombre} | Tipo: ${p.tipoProfesional} | Presupuesto: ${p.presupuestoId}`);
      });
      
      setResultados(profesionalesArray);
      
      if (profesionalesArray.length === 0) {
        setError('No se encontraron profesionales asignados a esta obra en los presupuestos');
      }
    } catch (e) {
      console.error('❌ Error consultando profesionales:', e);
      setError('Error al buscar profesionales');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setObraId('');
    setError(null);
    setResultados(null);
    setLoading(false);
    onClose();
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{zIndex: 2000}}>
      <div className="modal-dialog" style={{marginTop: '120px', maxWidth: '700px', width: '99vw'}}>
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Profesionales asignados a obra</h5>
            <button type="button" className="btn btn-light btn-sm ms-auto" onClick={handleClose}>
              Cerrar
            </button>
          </div>
          <div className="modal-body" style={{padding: '18px 12px 12px 12px'}}>
            <form onSubmit={handleConsultar}>
              <div className="mb-2" style={{display:'flex', gap:'12px'}}>
                <label className="form-label" style={{flex:1}}>Empresa
                  <input
                    type="text"
                    className="form-control"
                    value={empresaSeleccionada?.nombreEmpresa || empresaSeleccionada?.nombre || ''}
                    disabled
                    readOnly
                    style={{borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                  />
                </label>
                <label className="form-label" style={{flex:'0 0 120px'}}>ID
                  <input
                    type="number"
                    className="form-control"
                    value={empresaSeleccionada?.id || ''}
                    disabled
                    readOnly
                    style={{borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                  />
                </label>
              </div>
              <div className="mb-2" style={{display:'flex', gap:'12px'}}>
                <label className="form-label" style={{flex:1}}>Obra
                  <select
                    className="form-select"
                    value={obraId}
                    onChange={e => setObraId(e.target.value)}
                    disabled={!empresaSeleccionada?.id}
                    style={{borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                  >
                    <option value="">{!empresaSeleccionada?.id ? 'Seleccione primero una empresa' : (obras.length === 0 ? 'No hay obras disponibles' : 'Seleccione obra')}</option>
                    {obras.map(obra => (
                      <option key={obra.id} value={obra.id}>{obra.nombreObra || obra.nombre || `Obra #${obra.id}`}</option>
                    ))}
                  </select>
                </label>
                <label className="form-label" style={{flex:'0 0 120px'}}>ID Obra
                  <input
                    type="number"
                    className="form-control"
                    value={obraId}
                    onChange={e => setObraId(e.target.value)}
                    placeholder="ID obra"
                    disabled={!empresaSeleccionada?.id}
                    style={{borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                  />
                </label>
              </div>
              <button type="submit" className="btn btn-primary w-100 fw-bold" disabled={loading || !empresaSeleccionada?.id || !obraId}>
                {loading ? 'Consultando...' : 'Consultar'}
              </button>
            </form>
            <div className="mt-3">
              {error && <div className="alert alert-danger">{error}</div>}
              {resultados && Array.isArray(resultados) && resultados.length > 0 && (
                <div>
                  <h5>Profesionales asignados:</h5>
                  <ul>
                    {resultados.map(r => (
                      <li key={r.uniqueId || r.id}>
                        <strong>{r.nombre}</strong> ({r.tipoProfesional})<br />
                        Teléfono: {r.telefono} | Email: {r.email}<br />
                        Especialidad: {r.especialidad}<br />
                        Valor/hora: ${r.valorHoraDefault} | Activo: {r.activo ? 'Sí' : 'No'}<br />
                        Fecha asignación: {r.fechaAsignacion || '-'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {resultados && Array.isArray(resultados) && resultados.length === 0 && (
                <div className="alert alert-info">No se encontraron profesionales asignados para los criterios ingresados.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfesionalesPorObraModal;
