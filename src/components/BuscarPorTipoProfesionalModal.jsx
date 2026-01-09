import React, { useState, useEffect } from 'react';
import { Spinner, Alert, Table, Badge, Button } from 'react-bootstrap';
import api from '../services/api';
import { useEmpresa } from '../EmpresaContext';

/**
 * Modal para buscar presupuestos por tipo de profesional dentro del JSON
 * Utiliza búsqueda local en los JSONs de profesionales
 */
const BuscarPorTipoProfesionalModal = ({ show, handleClose, onSeleccionarPresupuesto }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [tipoProfesional, setTipoProfesional] = useState('');
  const [modoConsulta, setModoConsulta] = useState('lista'); // 'lista' o 'especifico'
  const [presupuestoId, setPresupuestoId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [presupuestos, setPresupuestos] = useState([]);
  const [todosPresupuestos, setTodosPresupuestos] = useState([]);
  const [presupuestoEspecifico, setPresupuestoEspecifico] = useState(null);
  const [busquedaRealizada, setBusquedaRealizada] = useState(false);

  // Cargar todos los presupuestos al abrir el modal
  useEffect(() => {
    if (show && empresaSeleccionada) {
      cargarPresupuestos();
    }
  }, [show, empresaSeleccionada]);

  const cargarPresupuestos = async () => {
    try {
      const response = await api.presupuestosNoCliente.getAll(empresaSeleccionada.id);
      const lista = Array.isArray(response) ? response : (response.datos || response.content || []);
      setTodosPresupuestos(lista);
      console.log('📦 Presupuestos cargados:', lista.length);
    } catch (err) {
      console.error('Error cargando presupuestos:', err);
    }
  };

  // Tipos comunes predefinidos para autocompletar
  const tiposComunes = [
    'ARQUITECTO',
    'INGENIERO',
    'MAESTRO_MAYOR',
    'OFICIAL_ALBANIL',
    'OFICIAL_PLOMERO',
    'OFICIAL_ELECTRICISTA',
    'OFICIAL_PINTOR',
    'OFICIAL_CARPINTERO',
    'AYUDANTE',
    'CAPATAZ'
  ];

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

  // Buscar presupuestos con variaciones del tipo - FILTRADO LOCAL (backend ya no tiene endpoint JSON)
  const handleBuscar = async () => {
    if (!tipoProfesional.trim()) {
      setError('Debe ingresar un tipo de profesional');
      return;
    }

    if (!empresaSeleccionada) {
      setError('Debe seleccionar una empresa');
      return;
    }

    setLoading(true);
    setError(null);
    setPresupuestos([]);
    setBusquedaRealizada(true);

    try {
      console.log('🔍 Buscando presupuestos con profesional (filtrado local):', tipoProfesional);
      
      const tipoNormalizado = normalizarTipo(tipoProfesional);
      const variaciones = generarVariaciones(tipoNormalizado);
      
      console.log('📋 Variaciones de búsqueda:', variaciones);
      
      // NUEVO: Filtrar localmente desde todosPresupuestos (ya cargados)
      const presupuestosFiltrados = todosPresupuestos.filter(presupuesto => {
        // Buscar en el array de profesionales (ahora viene de tabla normalizada, no JSON)
        const profesionales = presupuesto.profesionales || [];
        
        // Verificar si algún profesional coincide con las variaciones
        return profesionales.some(prof => {
          const tipoProfNormalizado = normalizarTipo(prof.tipo || '');
          return variaciones.some(variacion => 
            tipoProfNormalizado.includes(variacion) || 
            variacion.includes(tipoProfNormalizado)
          );
        });
      });
      
      console.log('✅ Presupuestos encontrados (filtrado local):', presupuestosFiltrados.length);
      
      // Ordenar por fecha de creación (más recientes primero)
      const ordenados = presupuestosFiltrados.sort((a, b) => {
        const fechaA = new Date(a.fechaCreacion || 0);
        const fechaB = new Date(b.fechaCreacion || 0);
        return fechaB - fechaA;
      });
      
      setPresupuestos(ordenados);
      
      if (ordenados.length === 0) {
        setError(`No se encontraron presupuestos con profesionales de tipo "${tipoProfesional}"`);
      }
    } catch (err) {
      console.error('❌ Error buscando presupuestos:', err);
      setError(err.message || 'Error al buscar presupuestos');
    } finally {
      setLoading(false);
    }
  };

  // Generar variaciones de búsqueda para aumentar resultados
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

  const handleSeleccionar = (presupuesto) => {
    console.log('✅ Presupuesto seleccionado:', presupuesto);
    if (onSeleccionarPresupuesto) {
      onSeleccionarPresupuesto(presupuesto);
    }
    handleClose();
  };

  const handleCerrar = () => {
    setTipoProfesional('');
    setPresupuestos([]);
    setError(null);
    setBusquedaRealizada(false);
    handleClose();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleBuscar();
    }
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    try {
      return new Date(fecha).toLocaleDateString('es-AR');
    } catch {
      return fecha;
    }
  };

  const formatearMonto = (monto) => {
    if (!monto && monto !== 0) return '-';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2
    }).format(monto);
  };

  const getBadgeEstado = (estado) => {
    const estados = {
      'BORRADOR': 'secondary',
      'PENDIENTE': 'warning',
      'EN_REVISION': 'info',
      'APROBADO': 'success',
      'RECHAZADO': 'danger',
      'MODIFICADO': 'dark',
      'VENCIDO': 'danger'
    };
    return estados[estado] || 'secondary';
  };

  // Extraer tipos de profesionales del array normalizado (ya no es JSON)
  const obtenerTiposProfesionales = (profesionales) => {
    if (!profesionales || !Array.isArray(profesionales)) return [];
    
    try {
      const tipos = profesionales.map(p => p.tipo).filter(Boolean);
      return [...new Set(tipos)]; // Deduplicar
    } catch (err) {
      console.error('Error obteniendo tipos de profesionales:', err);
      return [];
    }
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000 }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          {/* Header */}
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">
              🔍 Buscar Presupuestos por Tipo de Profesional
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={handleCerrar}></button>
          </div>

          {/* Body */}
          <div className="modal-body">
            {/* Empresa seleccionada */}
            <div className="alert alert-info mb-3">
              <strong>Empresa:</strong> {empresaSeleccionada?.nombre || empresaSeleccionada?.nombreEmpresa || 'No seleccionada'}
            </div>

            {/* Buscador con sugerencias */}
            <div className="mb-4">
              <label className="form-label fw-bold">Tipo de Profesional</label>
              <input
                type="text"
                className="form-control form-control-lg"
                placeholder="Ej: oficial, albañil, ayudante, arquitecto..."
                value={tipoProfesional}
                onChange={(e) => setTipoProfesional(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
              />
              <small className="text-muted">
                Busca por palabra completa o parcial. Ej: "oficial" encuentra todos los oficiales
              </small>

              {/* Sugerencias rápidas */}
              <div className="mt-2">
                <small className="text-muted d-block mb-1">Sugerencias rápidas:</small>
                <div className="d-flex flex-wrap gap-1">
                  {tiposComunes.map(tipo => (
                    <button
                      key={tipo}
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => setTipoProfesional(tipo)}
                      disabled={loading}
                    >
                      {tipo.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Botón buscar */}
            <div className="d-grid mb-3">
              <Button
                variant="primary"
                size="lg"
                onClick={handleBuscar}
                disabled={loading || !tipoProfesional.trim()}
              >
                {loading ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <i className="bi bi-search me-2"></i>
                    Buscar Presupuestos
                  </>
                )}
              </Button>
            </div>

            {/* Errores */}
            {error && (
              <Alert variant="warning" dismissible onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* Resultados */}
            {busquedaRealizada && !loading && presupuestos.length > 0 && (
              <>
                <div className="alert alert-success">
                  ✅ Se encontraron <strong>{presupuestos.length}</strong> presupuestos con profesionales de tipo <strong>"{tipoProfesional}"</strong>
                </div>

                <div className="table-responsive" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  <Table striped bordered hover size="sm">
                    <thead className="table-dark" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                      <tr>
                        <th style={{ width: '60px' }}>ID</th>
                        <th style={{ width: '100px' }}>Número</th>
                        <th style={{ width: '80px' }}>Versión</th>
                        <th>Dirección Obra</th>
                        <th>Solicitante</th>
                        <th style={{ width: '100px' }}>Estado</th>
                        <th>Profesionales</th>
                        <th style={{ width: '120px' }}>Total</th>
                        <th style={{ width: '100px' }}>Fecha</th>
                        <th style={{ width: '100px' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {presupuestos.map((presupuesto) => {
                        const tiposProfesionales = obtenerTiposProfesionales(presupuesto.profesionales);
                        return (
                          <tr key={presupuesto.id}>
                            <td>{presupuesto.id}</td>
                            <td>
                              <Badge bg="info">#{presupuesto.numeroPresupuesto || '-'}</Badge>
                            </td>
                            <td>
                              <Badge bg="secondary">v{presupuesto.numeroVersion || 1}</Badge>
                            </td>
                            <td>
                              <small>
                                {presupuesto.direccionObraCalle || presupuesto.direccionObra || '-'} {presupuesto.direccionObraAltura || ''}
                                {presupuesto.direccionObraPiso && ` - Piso ${presupuesto.direccionObraPiso}`}
                                {presupuesto.direccionObraDepartamento && ` Dto ${presupuesto.direccionObraDepartamento}`}
                              </small>
                            </td>
                            <td>
                              <small>{presupuesto.nombreSolicitante || '-'}</small>
                            </td>
                            <td>
                              <Badge bg={getBadgeEstado(presupuesto.estado)}>
                                {presupuesto.estado || 'BORRADOR'}
                              </Badge>
                            </td>
                            <td>
                              <small>
                                {tiposProfesionales.length > 0 ? (
                                  <div className="d-flex flex-wrap gap-1">
                                    {tiposProfesionales.map((tipo, idx) => (
                                      <Badge key={idx} bg="light" text="dark" className="border">
                                        {tipo.replace(/_/g, ' ')}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-muted">Sin datos</span>
                                )}
                              </small>
                            </td>
                            <td className="text-end">
                              <strong>{formatearMonto(presupuesto.totalPresupuestoConHonorarios || presupuesto.montoTotal || presupuesto.totalFinal || presupuesto.totalGeneral)}</strong>
                            </td>
                            <td>
                              <small>{formatearFecha(presupuesto.fechaCreacion)}</small>
                            </td>
                            <td>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleSeleccionar(presupuesto)}
                              >
                                Seleccionar
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              </>
            )}

            {/* Sin resultados */}
            {busquedaRealizada && !loading && presupuestos.length === 0 && !error && (
              <Alert variant="info">
                No se encontraron presupuestos con profesionales de tipo "{tipoProfesional}"
              </Alert>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <Button variant="secondary" onClick={handleCerrar}>
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuscarPorTipoProfesionalModal;
