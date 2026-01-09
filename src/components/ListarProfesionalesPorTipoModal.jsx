// Modal para listar profesionales por tipo
import React, { useState, useEffect } from 'react';
import { useEmpresasYTipos } from './profesionales/modals/useEmpresasYTipos';
import { useEmpresa } from '../EmpresaContext';
import api from '../services/api';

const ListarProfesionalesPorTipoModal = ({ show, onClose }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [tipoProfesionalInput, setTipoProfesionalInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resultados, setResultados] = useState(null);
  const [busquedaRealizada, setBusquedaRealizada] = useState(false);
  
  // Filtros de dirección progresivos
  const [calle, setCalle] = useState('');
  const [altura, setAltura] = useState('');
  const [piso, setPiso] = useState('');
  const [departamento, setDepartamento] = useState('');
  
  const [presupuestos, setPresupuestos] = useState([]);
  const [presupuestosFiltrados, setPresupuestosFiltrados] = useState([]);
  const [presupuestoSeleccionado, setPresupuestoSeleccionado] = useState(null);
  const [loadingPresupuestos, setLoadingPresupuestos] = useState(false);
  const { loading: loadingDatos, error: errorDatos } = useEmpresasYTipos();

  // Cargar presupuestos al abrir el modal
  useEffect(() => {
    if (show && empresaSeleccionada) {
      cargarPresupuestos();
    }
  }, [show, empresaSeleccionada]);

  const cargarPresupuestos = async () => {
    if (!empresaSeleccionada) return;
    
    setLoadingPresupuestos(true);
    try {
      const response = await api.presupuestosNoCliente.getAll(empresaSeleccionada.id);
      const lista = Array.isArray(response) ? response : (response.datos || response.content || []);
      
      // Deduplicar por dirección completa (mantener solo el más reciente por versión)
      const presupuestosUnicos = new Map();
      lista.forEach(p => {
        const key = `${p.direccionObraBarrio || ''}_${p.direccionObraCalle}_${p.direccionObraAltura}_${p.direccionObraTorre || ''}_${p.direccionObraPiso || ''}_${p.direccionObraDepartamento || ''}`;
        const existente = presupuestosUnicos.get(key);
        
        // Mantener el de mayor versión o el más reciente
        if (!existente || (p.version && existente.version && p.version > existente.version) || (!existente.version && p.id > existente.id)) {
          presupuestosUnicos.set(key, p);
        }
      });
      
      const listaUnica = Array.from(presupuestosUnicos.values());
      setPresupuestos(listaUnica);
      setPresupuestosFiltrados(listaUnica); // Inicialmente mostrar todos
    } catch (err) {
      console.error('Error cargando presupuestos:', err);
    } finally {
      setLoadingPresupuestos(false);
    }
  };

  // Filtrado progresivo por dirección
  useEffect(() => {
    if (!presupuestos.length) return;
    
    let filtrados = [...presupuestos];
    
    // Filtrar por calle (case insensitive, búsqueda parcial)
    if (calle.trim()) {
      const calleNorm = calle.toLowerCase().trim();
      filtrados = filtrados.filter(p => 
        (p.direccionObraCalle || '').toLowerCase().includes(calleNorm)
      );
    }
    
    // Filtrar por altura (exacta o parcial)
    if (altura.trim()) {
      const alturaNorm = altura.trim();
      filtrados = filtrados.filter(p => 
        (p.direccionObraAltura || '').toString().includes(alturaNorm)
      );
    }
    
    // Filtrar por piso (case insensitive)
    if (piso.trim()) {
      const pisoNorm = piso.toLowerCase().trim();
      filtrados = filtrados.filter(p => 
        (p.direccionObraPiso || '').toLowerCase().includes(pisoNorm)
      );
    }
    
    // Filtrar por departamento (case insensitive)
    if (departamento.trim()) {
      const deptoNorm = departamento.toLowerCase().trim();
      filtrados = filtrados.filter(p => 
        (p.direccionObraDepartamento || '').toLowerCase().includes(deptoNorm)
      );
    }
    
    setPresupuestosFiltrados(filtrados);
  }, [calle, altura, piso, departamento, presupuestos]);

  // Normalizar tipo de profesional para búsqueda flexible
  const normalizarTipo = (texto) => {
    return texto
      .toUpperCase()
      .trim()
      .replace(/\s+/g, '_')  // Espacios → guiones bajos
      .replace(/[ÁÀÄÂ]/g, 'A')
      .replace(/[ÉÈËÊ]/g, 'E')
      .replace(/[ÍÌÏÎ]/g, 'I')
      .replace(/[ÓÒÖÔ]/g, 'O')
      .replace(/[ÚÙÜÛ]/g, 'U')
      .replace(/Ñ/g, 'N');
  };

  // Generar variaciones de búsqueda
  const generarVariaciones = (tipoBase) => {
    const variaciones = new Set([tipoBase]);
    
    // Variación con espacios en lugar de guiones bajos
    variaciones.add(tipoBase.replace(/_/g, ' '));
    
    // Variación sin guiones bajos
    variaciones.add(tipoBase.replace(/_/g, ''));
    
    // Variación con primera letra mayúscula y resto minúsculas
    const capitalized = tipoBase.charAt(0) + tipoBase.slice(1).toLowerCase();
    variaciones.add(capitalized);
    variaciones.add(capitalized.replace(/_/g, ' '));
    
    // Variaciones para casos específicos
    if (tipoBase.includes('ALBANIL')) {
      variaciones.add(tipoBase.replace('ALBANIL', 'ALBAÑIL'));
    }
    if (tipoBase.includes('ALBAÑIL')) {
      variaciones.add(tipoBase.replace('ALBAÑIL', 'ALBANIL'));
    }
    
    // Variaciones masculino/femenino
    if (tipoBase.endsWith('O')) {
      variaciones.add(tipoBase.slice(0, -1) + 'A');
    }
    if (tipoBase.endsWith('A')) {
      variaciones.add(tipoBase.slice(0, -1) + 'O');
    }
    
    return Array.from(variaciones);
  };

  const handleConsultar = async (e) => {
    e.preventDefault();
    
    if (!empresaSeleccionada) {
      setError('Debe seleccionar una empresa');
      return;
    }

    if (!tipoProfesionalInput.trim()) {
      setError('Debe ingresar un tipo de profesional');
      return;
    }

    setLoading(true);
    setError(null);
    setResultados(null);
    setBusquedaRealizada(true);
    
    try {
      console.log('🔍 Buscando profesionales tipo:', tipoProfesionalInput);
      console.log('📦 Presupuestos disponibles:', presupuestosFiltrados.length);
      
      // Usar los presupuestos ya filtrados por dirección (si aplica)
      let presupuestosParaBuscar = presupuestosFiltrados;
      
      // Si no hay filtros de dirección, usar todos los presupuestos
      if (presupuestosParaBuscar.length === 0) {
        presupuestosParaBuscar = presupuestos;
      }
      
      console.log('🔎 Buscando en', presupuestosParaBuscar.length, 'presupuestos');
      
      // Extraer profesionales de los JSONs de los presupuestos con filtrado por palabra parcial
      const palabrasBusqueda = tipoProfesionalInput.toUpperCase().trim().split(/\s+/);
      console.log('🔍 Buscando palabras:', palabrasBusqueda);
      
      const profesionalesUnicos = new Map();
      presupuestosParaBuscar.forEach(presupuesto => {
        try {
          const profesionales = presupuesto.profesionales_json || presupuesto.profesionalesJson || [];
          const profesionalesArray = typeof profesionales === 'string' 
            ? JSON.parse(profesionales) 
            : profesionales;
          
          if (Array.isArray(profesionalesArray)) {
            profesionalesArray.forEach(prof => {
              // Obtener tipo del profesional y normalizarlo
              const tipoProfNormalizado = (prof.tipo || prof.tipoProfesional || '')
                .toUpperCase()
                .replace(/[ÁÀÄÂ]/g, 'A')
                .replace(/[ÉÈËÊ]/g, 'E')
                .replace(/[ÍÌÏÎ]/g, 'I')
                .replace(/[ÓÒÖÔ]/g, 'O')
                .replace(/[ÚÙÜÛ]/g, 'U')
                .replace(/Ñ/g, 'N');
              
              console.log('  👤 Revisando profesional:', prof.nombre, 'Tipo:', tipoProfNormalizado);
              
              // Verificar si alguna palabra de búsqueda está contenida en el tipo
              const coincide = palabrasBusqueda.some(palabra => {
                const palabraNorm = palabra
                  .replace(/[ÁÀÄÂ]/g, 'A')
                  .replace(/[ÉÈËÊ]/g, 'E')
                  .replace(/[ÍÌÏÎ]/g, 'I')
                  .replace(/[ÓÒÖÔ]/g, 'O')
                  .replace(/[ÚÙÜÛ]/g, 'U')
                  .replace(/Ñ/g, 'N');
                const match = tipoProfNormalizado.includes(palabraNorm);
                if (match) {
                  console.log('    ✅ COINCIDE:', palabraNorm, 'en', tipoProfNormalizado);
                }
                return match;
              });
              
              if (coincide) {
                // Crear un ID único si no existe
                const profId = prof.id || prof.profesionalId || `${presupuesto.id}_${prof.nombre}_${prof.tipo}`;
                
                // Agregar datos del presupuesto al profesional
                const direccionCompleta = [
                  presupuesto.direccionObraBarrio,
                  presupuesto.direccionObraCalle,
                  presupuesto.direccionObraAltura,
                  presupuesto.direccionObraTorre ? `Torre ${presupuesto.direccionObraTorre}` : null
                ].filter(Boolean).join(' ');
                
                const profesionalConPresupuesto = {
                  ...prof,
                  presupuestoId: presupuesto.id,
                  presupuestoDireccion: direccionCompleta,
                  presupuestoVersion: presupuesto.version
                };
                
                profesionalesUnicos.set(profId, profesionalConPresupuesto);
              }
            });
          }
        } catch (err) {
          console.error('Error parseando profesionales del presupuesto:', presupuesto.id, err);
        }
      });
      
      const profesionalesArray = Array.from(profesionalesUnicos.values());
      console.log('✅ Profesionales encontrados:', profesionalesArray.length);
      
      setResultados(profesionalesArray);
      
      if (profesionalesArray.length === 0) {
        setError(`No se encontraron profesionales de tipo "${tipoProfesionalInput}" en los presupuestos`);
      }
    } catch (e) {
      console.error('❌ Error buscando profesionales:', e);
      setError('Error al buscar profesionales en presupuestos');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setTipoProfesionalInput('');
    setCalle('');
    setAltura('');
    setPiso('');
    setDepartamento('');
    setPresupuestoSeleccionado(null);
    setError(null);
    setResultados(null);
    setLoading(false);
    setBusquedaRealizada(false);
    onClose();
  };

  const handleSeleccionarProfesional = (profesional) => {
    console.log('✅ Profesional seleccionado:', profesional);
    // Aquí puedes agregar lógica adicional si necesitas hacer algo con el profesional seleccionado
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000 }}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">🔍 Buscar Profesionales por Tipo</h5>
            <button type="button" className="btn btn-light btn-sm ms-auto" onClick={handleClose}>
              Cerrar
            </button>
          </div>
          <div className="modal-body" style={{padding: '18px'}}>
            {/* Empresa seleccionada */}
            <div className="alert alert-info mb-3">
              <strong>Empresa:</strong> {empresaSeleccionada?.nombre || empresaSeleccionada?.nombreEmpresa || 'No seleccionada'}
            </div>

            {loadingDatos && <div className="alert alert-secondary">Cargando datos...</div>}
            {errorDatos && <div className="alert alert-danger">{errorDatos}</div>}
            
            <form onSubmit={handleConsultar}>
              {/* Input tipo profesional */}
              <div className="mb-4">
                <label className="form-label fw-bold">Tipo de Profesional</label>
                <input
                  type="text"
                  className="form-control form-control-lg"
                  placeholder="Ej: oficial, albañil, ayudante, arquitecto..."
                  value={tipoProfesionalInput}
                  onChange={e => setTipoProfesionalInput(e.target.value)}
                  disabled={loading}
                />
                <small className="text-muted">
                  Busca por palabra completa o parcial. Ej: "oficial" encuentra todos los oficiales
                </small>
              </div>

              {/* Filtros progresivos de dirección */}
              <div className="mb-4">
                <h6 className="fw-bold mb-3">
                  <i className="bi bi-funnel me-2"></i>
                  Filtrar Presupuestos por Dirección (opcional)
                </h6>
                
                <div className="row g-2">
                  <div className="col-12">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Calle"
                      value={calle}
                      onChange={e => setCalle(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  
                  {calle && (
                    <div className="col-4">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Altura"
                        value={altura}
                        onChange={e => setAltura(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                  )}
                  
                  {calle && altura && (
                    <div className="col-4">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Piso"
                        value={piso}
                        onChange={e => setPiso(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                  )}
                  
                  {calle && altura && piso && (
                    <div className="col-4">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Depto"
                        value={departamento}
                        onChange={e => setDepartamento(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Lista de presupuestos filtrados */}
              {presupuestosFiltrados.length > 0 && (
                <div className="mb-4">
                  <h6 className="fw-bold mb-2">
                    <i className="bi bi-list-check me-2"></i>
                    Presupuestos encontrados ({presupuestosFiltrados.length})
                  </h6>
                  <div className="list-group" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {presupuestosFiltrados.map(presup => (
                      <button
                        key={presup.id}
                        type="button"
                        className={`list-group-item list-group-item-action ${presupuestoSeleccionado?.id === presup.id ? 'active' : ''}`}
                        onClick={() => setPresupuestoSeleccionado(presup)}
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            {presup.direccionObraBarrio && <span className="badge bg-secondary me-2">{presup.direccionObraBarrio}</span>}
                            <strong>{presup.direccionObraCalle} {presup.direccionObraAltura}</strong>
                            {presup.direccionObraTorre && <span className="ms-2 text-info">Torre: {presup.direccionObraTorre}</span>}
                            {presup.direccionObraPiso && <span className="ms-2">Piso: {presup.direccionObraPiso}</span>}
                            {presup.direccionObraDepartamento && <span className="ms-2">Depto: {presup.direccionObraDepartamento}</span>}
                          </div>
                          {presupuestoSeleccionado?.id === presup.id && (
                            <i className="bi bi-check-circle-fill text-white"></i>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  <small className="text-muted d-block mt-2">
                    {presupuestoSeleccionado 
                      ? `✓ Presupuesto seleccionado: ${[
                          presupuestoSeleccionado.direccionObraBarrio,
                          presupuestoSeleccionado.direccionObraCalle,
                          presupuestoSeleccionado.direccionObraAltura,
                          presupuestoSeleccionado.direccionObraTorre ? `Torre ${presupuestoSeleccionado.direccionObraTorre}` : null
                        ].filter(Boolean).join(' ')}`
                      : 'Haga clic en un presupuesto para seleccionarlo, o busque en todos'
                    }
                  </small>
                </div>
              )}
              
              <button 
                type="submit" 
                className="btn btn-primary w-100 fw-bold btn-lg" 
                disabled={loading || !tipoProfesionalInput}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Buscando...
                  </>
                ) : (
                  <>
                    <i className="bi bi-search me-2"></i>
                    Buscar Profesionales
                  </>
                )}
              </button>
            </form>
            
            <div className="mt-4">
              {error && <div className="alert alert-warning">{error}</div>}
              
              {busquedaRealizada && !loading && resultados && Array.isArray(resultados) && resultados.length > 0 && (
                <div>
                  <div className="alert alert-success">
                    ✅ Se encontraron <strong>{resultados.length}</strong> profesionales
                  </div>
                  <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <table className="table table-striped table-hover table-sm">
                      <thead className="table-dark" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr>
                          <th>Nombre</th>
                          <th>Tipo</th>
                          <th>Cantidad</th>
                          <th>Valor/Hora</th>
                          <th>Horas</th>
                          <th>Total</th>
                          <th>Presupuesto</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultados.map((r, idx) => (
                          <tr key={`${r.presupuestoId}_${idx}`}>
                            <td><strong>{r.nombre || r.nombreProfesional || '-'}</strong></td>
                            <td>
                              <span className="badge bg-info">
                                {(r.tipo || r.tipoProfesional || '').replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="text-center">{r.cantidad || 1}</td>
                            <td className="text-end">${r.valorHora || r.valorHoraDefault || 0}</td>
                            <td className="text-center">{r.horas || r.cantidadHoras || '-'}</td>
                            <td className="text-end">
                              <strong>${((r.valorHora || 0) * (r.horas || r.cantidadHoras || 0)).toFixed(2)}</strong>
                            </td>
                            <td>
                              <small className="text-muted">
                                {r.presupuestoDireccion}
                                {r.presupuestoVersion && <span className="ms-1 badge bg-secondary">v{r.presupuestoVersion}</span>}
                              </small>
                            </td>
                            <td>
                              <button
                                className="btn btn-sm btn-success"
                                onClick={() => handleSeleccionarProfesional(r)}
                                title="Seleccionar profesional"
                              >
                                <i className="bi bi-check-circle"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {busquedaRealizada && !loading && resultados && Array.isArray(resultados) && resultados.length === 0 && !error && (
                <div className="alert alert-info">
                  No se encontraron profesionales para los criterios ingresados
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={handleClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListarProfesionalesPorTipoModal;
