import React, { useState, useEffect } from 'react';
import { Button, Form, Spinner, Alert, Badge, Table } from 'react-bootstrap';
import { useEmpresa } from '../EmpresaContext';
import apiService from '../services/api';
import api from '../services/api';

const HistorialVersionesPresupuestoNoClienteModal = ({ show, handleClose, obraIdInicial, empresaIdInicial }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [obraId, setObraId] = useState(obraIdInicial || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [versiones, setVersiones] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [detalleVersion, setDetalleVersion] = useState(null);
  const [aprobando, setAprobando] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [presupuestos, setPresupuestos] = useState([]);
  const [obras, setObras] = useState([]);
  
  // Estados para búsqueda por dirección
  const [direccionBarrio, setDireccionBarrio] = useState('');
  const [direccionCalle, setDireccionCalle] = useState('');
  const [direccionAltura, setDireccionAltura] = useState('');
  const [direccionTorre, setDireccionTorre] = useState('');
  const [direccionPiso, setDireccionPiso] = useState('');
  const [direccionDpto, setDireccionDpto] = useState('');
  const [barriosSugeridos, setBarriosSugeridos] = useState([]);
  const [callesSugeridas, setCallesSugeridas] = useState([]);
  const [alturasSugeridas, setAlturasSugeridas] = useState([]);
  const [torresSugeridas, setTorresSugeridas] = useState([]);
  const [pisosSugeridos, setPisosSugeridos] = useState([]);
  const [dptosSugeridos, setDptosSugeridos] = useState([]);

  // Cargar presupuestos y obras al abrir el modal
  useEffect(() => {
    if (show && empresaSeleccionada) {
      cargarDatos();
    }
  }, [show, empresaSeleccionada]);

  const cargarDatos = async () => {
    try {
      // Cargar presupuestos
      const responsePresupuestos = await api.presupuestosNoCliente.getAll(empresaSeleccionada.id);
      const listaPresupuestos = Array.isArray(responsePresupuestos) ? responsePresupuestos : (responsePresupuestos.datos || responsePresupuestos.content || []);
      setPresupuestos(listaPresupuestos);
      
      // Cargar obras
      const responseObras = await api.obras.getPorEmpresa(empresaSeleccionada.id);
      setObras(Array.isArray(responseObras) ? responseObras : []);
      
      console.log('📦 Datos cargados:', listaPresupuestos.length, 'presupuestos,', responseObras.length, 'obras');
    } catch (err) {
      console.error('Error cargando datos:', err);
    }
  };

  // Autocomplete progresivo para dirección
  useEffect(() => {
    if (presupuestos.length === 0) return;
    
    // Filtrar barrios únicos
    const barrios = [...new Set(
      presupuestos
        .map(p => p.direccionObraBarrio)
        .filter(b => b && b.trim())
    )].sort();
    
    setBarriosSugeridos(barrios);
  }, [presupuestos]);

  useEffect(() => {
    if (presupuestos.length === 0) return;
    
    // Filtrar calles únicas (opcionalmente filtradas por barrio si está seleccionado)
    let presupuestosFiltrados = presupuestos;
    if (direccionBarrio) {
      presupuestosFiltrados = presupuestos.filter(p => 
        p.direccionObraBarrio?.toLowerCase() === direccionBarrio.toLowerCase()
      );
    }
    
    const calles = [...new Set(
      presupuestosFiltrados
        .map(p => p.direccionObraCalle)
        .filter(c => c && c.trim())
    )].sort();
    
    setCallesSugeridas(calles);
  }, [presupuestos, direccionBarrio]);

  useEffect(() => {
    if (!direccionCalle || presupuestos.length === 0) {
      setAlturasSugeridas([]);
      setTorresSugeridas([]);
      setPisosSugeridos([]);
      setDptosSugeridos([]);
      return;
    }
    
    // Filtrar alturas para la calle seleccionada (y opcionalmente barrio)
    let presupuestosFiltrados = presupuestos.filter(p => 
      p.direccionObraCalle?.toLowerCase() === direccionCalle.toLowerCase()
    );
    
    if (direccionBarrio) {
      presupuestosFiltrados = presupuestosFiltrados.filter(p =>
        p.direccionObraBarrio?.toLowerCase() === direccionBarrio.toLowerCase()
      );
    }
    
    const alturas = [...new Set(
      presupuestosFiltrados
        .map(p => p.direccionObraAltura)
        .filter(a => a && a.toString().trim())
    )].sort((a, b) => Number(a) - Number(b));
    
    setAlturasSugeridas(alturas);
  }, [direccionCalle, direccionBarrio, presupuestos]);

  useEffect(() => {
    if (!direccionCalle || !direccionAltura || presupuestos.length === 0) {
      setTorresSugeridas([]);
      setPisosSugeridos([]);
      setDptosSugeridos([]);
      return;
    }
    
    // Filtrar torres para calle + altura
    let presupuestosFiltrados = presupuestos.filter(p => 
      p.direccionObraCalle?.toLowerCase() === direccionCalle.toLowerCase() &&
      p.direccionObraAltura?.toString() === direccionAltura.toString()
    );
    
    if (direccionBarrio) {
      presupuestosFiltrados = presupuestosFiltrados.filter(p =>
        p.direccionObraBarrio?.toLowerCase() === direccionBarrio.toLowerCase()
      );
    }
    
    const torres = [...new Set(
      presupuestosFiltrados
        .map(p => p.direccionObraTorre)
        .filter(t => t && t.toString().trim())
    )].sort();
    
    setTorresSugeridas(torres);
  }, [direccionCalle, direccionAltura, direccionBarrio, presupuestos]);

  useEffect(() => {
    if (!direccionCalle || !direccionAltura || presupuestos.length === 0) {
      setPisosSugeridos([]);
      setDptosSugeridos([]);
      return;
    }
    
    // Filtrar pisos para calle + altura + torre (si existe)
    let presupuestosFiltrados = presupuestos.filter(p => 
      p.direccionObraCalle?.toLowerCase() === direccionCalle.toLowerCase() &&
      p.direccionObraAltura?.toString() === direccionAltura.toString()
    );
    
    if (direccionBarrio) {
      presupuestosFiltrados = presupuestosFiltrados.filter(p =>
        p.direccionObraBarrio?.toLowerCase() === direccionBarrio.toLowerCase()
      );
    }
    
    if (direccionTorre) {
      presupuestosFiltrados = presupuestosFiltrados.filter(p =>
        p.direccionObraTorre?.toString() === direccionTorre.toString()
      );
    }
    
    const pisos = [...new Set(
      presupuestosFiltrados
        .map(p => p.direccionObraPiso)
        .filter(p => p && p.toString().trim())
    )].sort();
    
    setPisosSugeridos(pisos);
  }, [direccionCalle, direccionAltura, direccionBarrio, direccionTorre, presupuestos]);

  useEffect(() => {
    if (!direccionCalle || !direccionAltura || presupuestos.length === 0) {
      setDptosSugeridos([]);
      return;
    }
    
    // Filtrar departamentos para calle + altura + torre (si existe) + piso (si existe)
    let presupuestosFiltrados = presupuestos.filter(p => 
      p.direccionObraCalle?.toLowerCase() === direccionCalle.toLowerCase() &&
      p.direccionObraAltura?.toString() === direccionAltura.toString()
    );
    
    if (direccionBarrio) {
      presupuestosFiltrados = presupuestosFiltrados.filter(p =>
        p.direccionObraBarrio?.toLowerCase() === direccionBarrio.toLowerCase()
      );
    }
    
    if (direccionTorre) {
      presupuestosFiltrados = presupuestosFiltrados.filter(p =>
        p.direccionObraTorre?.toString() === direccionTorre.toString()
      );
    }
    
    if (direccionPiso) {
      presupuestosFiltrados = presupuestosFiltrados.filter(p =>
        p.direccionObraPiso?.toString() === direccionPiso.toString()
      );
    }
    const dptos = [...new Set(
      presupuestos
        .filter(p => 
          p.direccionObraCalle?.toLowerCase() === direccionCalle.toLowerCase() &&
          p.direccionObraAltura?.toString() === direccionAltura.toString() &&
          (!direccionPiso || p.direccionObraPiso?.toString() === direccionPiso.toString())
        )
        .map(p => p.direccionObraDpto)
        .filter(d => d && d.toString().trim())
    )].sort();
    
    setDptosSugeridos(dptos);
  }, [direccionCalle, direccionAltura, direccionPiso, presupuestos]);

  // Si se pasa obraId inicial, buscar automáticamente después de cargar datos
  useEffect(() => {
    if (show && obraIdInicial && empresaSeleccionada?.id && presupuestos.length > 0 && obras.length > 0) {
      setObraId(obraIdInicial);
      handleBuscarVersiones(empresaSeleccionada.id, obraIdInicial);
    }
  }, [show, obraIdInicial, empresaSeleccionada, presupuestos, obras]);

  const handleBuscarVersiones = async (empId = null, obraIdParam = null) => {
    const empresaIdBuscar = empId || empresaSeleccionada?.id;

    if (!empresaIdBuscar) {
      setError('Debe seleccionar empresa');
      return;
    }

    setLoading(true);
    setError(null);
    setSubmitted(true);

    try {
      let versionesEncontradas = [];
      // Si se abrió desde la página principal con un presupuesto seleccionado
      if (window.numeroPresupuestoHistorial) {
        versionesEncontradas = presupuestos.filter(p => p.numeroPresupuesto === window.numeroPresupuestoHistorial);
      } else {
        // Filtrar presupuestos por dirección (lógica original)
        versionesEncontradas = presupuestos.filter(p => {
          // Filtro por barrio (opcional)
          if (direccionBarrio.trim()) {
            const pBarrio = (p.direccionObraBarrio || '').toLowerCase().trim();
            const buscarBarrio = direccionBarrio.toLowerCase().trim();
            if (!pBarrio.includes(buscarBarrio) && !buscarBarrio.includes(pBarrio)) {
              return false;
            }
          }
          // Filtro por calle (obligatorio)
          const pCalle = (p.direccionObraCalle || '').toLowerCase().trim();
          const buscarCalle = direccionCalle.toLowerCase().trim();
          if (!pCalle.includes(buscarCalle) && !buscarCalle.includes(pCalle)) {
            return false;
          }
          // Filtro por altura (opcional)
          if (direccionAltura.trim()) {
            const pAltura = (p.direccionObraAltura || '').toString().trim();
            const buscarAltura = direccionAltura.toString().trim();
            if (pAltura !== buscarAltura) {
              return false;
            }
          }
          // Filtro por torre (opcional)
          if (direccionTorre.trim()) {
            const pTorre = (p.direccionObraTorre || '').toString().trim();
            const buscarTorre = direccionTorre.toString().trim();
            if (pTorre !== buscarTorre) {
              return false;
            }
          }
          // Filtro por piso (opcional)
          if (direccionPiso.trim()) {
            const pPiso = (p.direccionObraPiso || '').toString().trim();
            const buscarPiso = direccionPiso.toString().trim();
            if (pPiso !== buscarPiso) {
              return false;
            }
          }
          // Filtro por departamento (opcional)
          if (direccionDpto.trim()) {
            const pDpto = (p.direccionObraDpto || p.direccionObraDepartamento || '').toString().trim();
            const buscarDpto = direccionDpto.toString().trim();
            if (pDpto !== buscarDpto) {
              return false;
            }
          }
          return true;
        });
      }

      console.log('📦 Versiones encontradas:', versionesEncontradas.length);

      if (versionesEncontradas.length > 0) {
        // Ordenar por versión descendente (más reciente primero)
        const versionesOrdenadas = versionesEncontradas.sort((a, b) => (b.numeroVersion || b.version || 0) - (a.numeroVersion || a.version || 0));
        setVersiones(versionesOrdenadas);
        setError(null);
      } else {
        setVersiones([]);
        setError(null); // No es error, simplemente no hay versiones
      }
    } catch (err) {
      console.error('❌ Error al buscar versiones:', err);
      setError(err.message || 'Error al buscar versiones');
      setVersiones([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleBuscarVersiones();
  };

  const handleVerDetalle = (version) => {
    setDetalleVersion(version);
    setSuccessMessage(null); // Limpiar mensajes al abrir detalle
  };

  const handleCerrarDetalle = () => {
    setDetalleVersion(null);
    setSuccessMessage(null);
  };

  const handleAprobarYCrearObra = async () => {
    if (!detalleVersion || !empresaSeleccionada?.id) return;

    // Validaciones previas
    if (!detalleVersion.direccionObraCalle || !detalleVersion.direccionObraAltura) {
      setError('El presupuesto debe tener dirección completa (calle y altura) para crear una obra');
      return;
    }

    if (detalleVersion.estado === 'APROBADO' && detalleVersion.obraId) {
      setError(`Este presupuesto ya está aprobado y tiene una obra asignada (ID: ${detalleVersion.obraId})`);
      return;
    }

    setAprobando(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await api.post(
        `/api/v1/presupuestos-no-cliente/${detalleVersion.id}/aprobar-y-crear-obra`,
        {},
        {
          headers: {
            'X-Tenant-ID': empresaSeleccionada.id,
            'Content-Type': 'application/json'
          }
        }
      );

      const { obraId, presupuestosActualizados, mensaje, obraCreada } = response.data;

      // Mostrar mensaje de éxito
      let successMsg = '';
      if (obraCreada) {
        successMsg = `✅ Obra creada exitosamente (ID: ${obraId}). ${presupuestosActualizados} presupuesto(s) actualizado(s).`;
      } else {
        successMsg = `✅ Obra reutilizada (ID: ${obraId}). ${presupuestosActualizados} presupuesto(s) actualizado(s).`;
      }
      setSuccessMessage(successMsg);

      // Actualizar la versión actual con el nuevo estado
      setDetalleVersion({
        ...detalleVersion,
        estado: 'APROBADO',
        obraId: obraId
      });

      // Recargar la lista de versiones para actualizar todos los estados
      handleBuscarVersiones();

      console.log('✅ Presupuesto aprobado:', response.data);

    } catch (err) {
      console.error('❌ Error al aprobar presupuesto:', err);
      
      if (err.response?.status === 409) {
        setError('El presupuesto ya está aprobado y tiene una obra asignada');
      } else if (err.response?.status === 400) {
        setError(err.response.data?.mensaje || 'Validación fallida. Verifique que el presupuesto tenga dirección completa');
      } else if (err.response?.status === 404) {
        setError('Presupuesto no encontrado');
      } else {
        setError(err.response?.data?.mensaje || err.message || 'Error al aprobar presupuesto y crear obra');
      }
    } finally {
      setAprobando(false);
    }
  };

  const handleModalClose = () => {
    setObraId('');
    setDireccionBarrio('');
    setDireccionCalle('');
    setDireccionAltura('');
    setDireccionTorre('');
    setDireccionPiso('');
    setDireccionDpto('');
    setVersiones([]);
    setError(null);
    setSubmitted(false);
    setDetalleVersion(null);
    setSuccessMessage(null);
    handleClose();
  };

  const formatCurrency = (value) => {
    if (!value && value !== 0) return '-';
    return `$${parseFloat(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('es-AR');
    } catch {
      return dateString.substring(0, 10);
    }
  };

  if (!show) return null;

  return (
    <>
      {/* Modal principal - Listado de versiones */}
      {!detalleVersion && (
        <div className="modal show d-block" style={{ zIndex: 2000 }}>
          <div className="modal-dialog modal-xl" style={{ marginTop: '80px', maxWidth: '95vw' }}>
            <div className="modal-content">
              <div className="modal-header" style={{ background: '#f8f9fa', borderBottom: '2px solid #007bff' }}>
                <h5 className="modal-title">
                  📋 Historial de Versiones - Presupuesto No Cliente
                </h5>
                <button type="button" className="btn btn-light btn-sm ms-auto" onClick={handleModalClose}>
                  Cerrar
                </button>
              </div>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label><strong>Empresa seleccionada</strong></Form.Label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontWeight: 500, fontSize: 15, color: '#495057' }}>
                  {empresaSeleccionada?.nombreEmpresa || empresaSeleccionada?.nombre || 'Sin empresa'}
                </span>
                <Form.Control
                  type="number"
                  value={empresaSeleccionada?.id || ''}
                  disabled
                  readOnly
                  style={{
                    width: 80,
                    fontSize: 13,
                    padding: '4px 8px',
                    textAlign: 'center',
                    background: '#e9ecef'
                  }}
                  title="ID de empresa"
                />
              </div>
            </Form.Group>

            <div className="alert alert-info mb-3">
              <i className="bi bi-info-circle-fill me-2"></i>
              <strong>Buscar por dirección:</strong> Ingrese al menos la calle (obligatorio). Los demás campos son opcionales y se autocompletarán según lo disponible.
            </div>

            {/* Campo Barrio con autocomplete */}
            <Form.Group className="mb-3">
              <Form.Label><strong>Barrio</strong> <span className="text-muted">(opcional)</span></Form.Label>
              <Form.Control
                type="text"
                list="barrios-list"
                value={direccionBarrio}
                onChange={(e) => {
                  setDireccionBarrio(e.target.value);
                  // Limpiar campos dependientes
                  setDireccionCalle('');
                  setDireccionAltura('');
                  setDireccionTorre('');
                  setDireccionPiso('');
                  setDireccionDpto('');
                }}
                placeholder="Ej: Palermo, Recoleta..."
              />
              <datalist id="barrios-list">
                {barriosSugeridos.map((barrio, idx) => (
                  <option key={idx} value={barrio} />
                ))}
              </datalist>
              <Form.Text className="text-muted">
                {barriosSugeridos.length > 0 && `${barriosSugeridos.length} barrios disponibles`}
              </Form.Text>
            </Form.Group>

            {/* Campo Calle con autocomplete */}
            <Form.Group className="mb-3">
              <Form.Label><strong>Calle *</strong></Form.Label>
              <Form.Control
                type="text"
                list="calles-list"
                value={direccionCalle}
                onChange={(e) => {
                  setDireccionCalle(e.target.value);
                  // Limpiar campos dependientes
                  setDireccionAltura('');
                  setDireccionTorre('');
                  setDireccionPiso('');
                  setDireccionDpto('');
                }}
                required
                placeholder="Ej: Av. Libertador"
              />
              <datalist id="calles-list">
                {callesSugeridas.map((calle, idx) => (
                  <option key={idx} value={calle} />
                ))}
              </datalist>
              <Form.Text className="text-muted">
                {callesSugeridas.length > 0 && `${callesSugeridas.length} calles disponibles${direccionBarrio ? ' en este barrio' : ''}`}
              </Form.Text>
            </Form.Group>

            {/* Campo Altura con autocomplete */}
            <Form.Group className="mb-3">
              <Form.Label><strong>Altura</strong> <span className="text-muted">(opcional)</span></Form.Label>
              <Form.Control
                type="text"
                list="alturas-list"
                value={direccionAltura}
                onChange={(e) => {
                  setDireccionAltura(e.target.value);
                  // Limpiar campos dependientes
                  setDireccionTorre('');
                  setDireccionPiso('');
                  setDireccionDpto('');
                }}
                placeholder="1234"
                disabled={!direccionCalle}
              />
              <datalist id="alturas-list">
                {alturasSugeridas.map((altura, idx) => (
                  <option key={idx} value={altura} />
                ))}
              </datalist>
              <Form.Text className="text-muted">
                {direccionCalle && alturasSugeridas.length > 0 && `${alturasSugeridas.length} alturas disponibles para esta calle`}
              </Form.Text>
            </Form.Group>

            {/* Campo Torre con autocomplete */}
            <Form.Group className="mb-3">
              <Form.Label><strong>Torre / Edificio</strong> <span className="text-muted">(opcional)</span></Form.Label>
              <Form.Control
                type="text"
                list="torres-list"
                value={direccionTorre}
                onChange={(e) => {
                  setDireccionTorre(e.target.value);
                  // Limpiar campos dependientes
                  setDireccionPiso('');
                  setDireccionDpto('');
                }}
                placeholder="A, B, 1, 2..."
                disabled={!direccionCalle || !direccionAltura}
              />
              <datalist id="torres-list">
                {torresSugeridas.map((torre, idx) => (
                  <option key={idx} value={torre} />
                ))}
              </datalist>
              <Form.Text className="text-muted">
                {direccionCalle && direccionAltura && torresSugeridas.length > 0 && `${torresSugeridas.length} torres disponibles en esta dirección`}
              </Form.Text>
            </Form.Group>

            {/* Campo Piso con autocomplete */}
            <Form.Group className="mb-3">
              <Form.Label><strong>Piso</strong> <span className="text-muted">(opcional)</span></Form.Label>
              <Form.Control
                type="text"
                list="pisos-list"
                value={direccionPiso}
                onChange={(e) => {
                  setDireccionPiso(e.target.value);
                  // Limpiar departamento
                  setDireccionDpto('');
                }}
                placeholder="5"
                disabled={!direccionCalle || !direccionAltura}
              />
              <datalist id="pisos-list">
                {pisosSugeridos.map((piso, idx) => (
                  <option key={idx} value={piso} />
                ))}
              </datalist>
              <Form.Text className="text-muted">
                {direccionCalle && direccionAltura && pisosSugeridos.length > 0 && `${pisosSugeridos.length} pisos disponibles`}
              </Form.Text>
            </Form.Group>

            {/* Campo Departamento con autocomplete */}
            <Form.Group className="mb-3">
              <Form.Label><strong>Departamento</strong> <span className="text-muted">(opcional)</span></Form.Label>
              <Form.Control
                type="text"
                list="dptos-list"
                value={direccionDpto}
                onChange={(e) => setDireccionDpto(e.target.value)}
                placeholder="A"
                disabled={!direccionCalle || !direccionAltura}
              />
              <datalist id="dptos-list">
                {dptosSugeridos.map((dpto, idx) => (
                  <option key={idx} value={dpto} />
                ))}
              </datalist>
              <Form.Text className="text-muted">
                {direccionCalle && direccionAltura && dptosSugeridos.length > 0 && `${dptosSugeridos.length} departamentos disponibles`}
              </Form.Text>
            </Form.Group>

            <div className="d-flex gap-2">
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Buscando...
                  </>
                ) : (
                  '🔍 Buscar versiones'
                )}
              </Button>
              <Button 
                variant="secondary" 
                onClick={() => {
                  setDireccionCalle('');
                  setDireccionAltura('');
                  setDireccionPiso('');
                  setDireccionDpto('');
                  setVersiones([]);
                  setSubmitted(false);
                }}
                disabled={loading}
              >
                Limpiar
              </Button>
            </div>
          </Form>

          {error && (
            <Alert variant="danger" className="mt-3" dismissible onClose={() => setError(null)}>
              <strong>⚠️ Error del servidor</strong>
              <p className="mb-0 mt-2">{error}</p>
            </Alert>
          )}

          {submitted && !loading && versiones.length === 0 && !error && (
            <Alert variant="info" className="mt-3">
              <div className="d-flex align-items-start">
                <div style={{ fontSize: '2rem', marginRight: '15px' }}>📭</div>
                <div>
                  <strong>No se encontraron versiones de presupuestos</strong>
                  <p className="mb-2 mt-2">
                    No existen presupuestos para la dirección: <strong>{direccionCalle} {direccionAltura} {direccionPiso} {direccionDpto}</strong>
                  </p>
                  <p className="mb-0">
                    <small>💡 Sugerencia: Intente con menos filtros (solo calle) o verifique que la dirección sea correcta.</small>
                  </p>
                </div>
              </div>
            </Alert>
          )}

          {submitted && !loading && versiones.length > 0 && (
            <div className="mt-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0">
                  <Badge bg="success">{versiones.length}</Badge> versión(es) encontrada(s)
                </h5>
                <small className="text-muted">Agrupadas por presupuesto y ordenadas por versión</small>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <Table striped bordered hover responsive size="sm">
                  <thead style={{ background: '#007bff', color: 'white' }}>
                    <tr>
                      <th>Presupuesto #</th>
                      <th>Versión</th>
                      <th>ID</th>
                      <th>Dirección Completa</th>
                      <th>Estado</th>
                      <th>Obra ID</th>
                      <th>Fecha Creación</th>
                      <th>Prof.</th>
                      <th>Mat.</th>
                      <th>Otros</th>
                      <th>Monto Total</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versiones.map((version, idx) => {
                      // Detectar si es la última versión de su número de presupuesto
                      const esUltimaVersion = idx === 0 || 
                        version.numeroPresupuesto !== versiones[idx - 1]?.numeroPresupuesto;
                      
                      return (
                        <tr key={idx} style={{ 
                          background: esUltimaVersion ? '#e7f3ff' : 'transparent',
                          fontWeight: esUltimaVersion ? '500' : 'normal',
                          borderTop: esUltimaVersion && idx > 0 ? '2px solid #007bff' : undefined
                        }}>
                          <td>
                            <Badge bg="primary">{version.numeroPresupuesto || 'N/A'}</Badge>
                          </td>
                          <td>
                            <Badge bg={esUltimaVersion ? 'success' : 'secondary'}>
                              v{version.numeroVersion || version.version || 1}
                            </Badge>
                            {esUltimaVersion && <small className="ms-1 text-success d-block">(Última)</small>}
                          </td>
                          <td><small>{version.id}</small></td>
                          <td>
                            <div>
                              {version.direccionObraBarrio && <span className="badge bg-secondary me-1">{version.direccionObraBarrio}</span>}
                              <strong>{version.direccionObraCalle} {version.direccionObraAltura}</strong>
                              {(version.direccionObraTorre || version.direccionObraPiso || version.direccionObraDpto) && (
                                <small className="d-block text-muted">
                                  {version.direccionObraTorre && <span className="text-info">Torre {version.direccionObraTorre}</span>}
                                  {version.direccionObraTorre && (version.direccionObraPiso || version.direccionObraDpto) && ', '}
                                  {version.direccionObraPiso && `Piso ${version.direccionObraPiso}`}
                                  {version.direccionObraPiso && version.direccionObraDpto && ', '}
                                  {version.direccionObraDpto && `Dpto ${version.direccionObraDpto}`}
                                </small>
                              )}
                            </div>
                          </td>
                          <td>
                            <Badge bg={
                              version.estado === 'APROBADO' ? 'success' : 
                              version.estado === 'MODIFICADO' ? 'warning' :
                              version.estado === 'A_ENVIAR' ? 'primary' :
                              'secondary'
                            }>
                              {version.estado || 'BORRADOR'}
                            </Badge>
                          </td>
                          <td className="text-center">
                            {version.obraId ? (
                              <Badge bg="success" title="Asociado a obra">
                                🏗️ {version.obraId}
                              </Badge>
                            ) : (
                              <Badge bg="secondary">-</Badge>
                            )}
                          </td>
                          <td><small>{formatDate(version.fechaCreacion)}</small></td>
                          <td className="text-center">
                            {version.profesionales?.length || 0}
                          </td>
                          <td className="text-center">
                            {version.materiales?.length || version.materialesList?.length || 0}
                          </td>
                          <td className="text-center">
                            {version.otrosCostos?.length || 0}
                          </td>
                          <td className="text-end">
                            <strong>{formatCurrency(version.montoTotal)}</strong>
                          </td>
                          <td className="text-center">
                            <Button
                              variant="info"
                              size="sm"
                              onClick={() => handleVerDetalle(version)}
                            >
                              👁️ Ver
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer" style={{ background: '#f8f9fa', borderTop: '1px solid #dee2e6' }}>
          <Button variant="secondary" onClick={handleModalClose}>
            Cerrar
          </Button>
        </div>
      </div>
      </div>
      </div>
      )}

      {/* Modal de Detalle de Versión */}
      {detalleVersion && (
        <div className="modal show d-block" style={{ zIndex: 2100 }}>
          <div className="modal-dialog modal-xl" style={{ marginTop: '50px', maxWidth: '95vw' }}>
            <div className="modal-content">
              <div className="modal-header" style={{ background: '#007bff', color: 'white' }}>
                <h5 className="modal-title">
                  📄 Detalle Presupuesto - Versión {detalleVersion.version} (ID: {detalleVersion.id})
                </h5>
                <button type="button" className="btn btn-light btn-sm ms-auto" onClick={handleCerrarDetalle}>
                  Cerrar
                </button>
              </div>
              <div className="modal-body" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
            {/* Información General */}
            <div className="card mb-3">
              <div className="card-header bg-primary text-white">
                <strong>📋 Información General</strong>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-6">
                    <p><strong>Versión:</strong> <Badge bg="success">v{detalleVersion.version}</Badge></p>
                    <p><strong>Estado:</strong> <Badge bg={detalleVersion.estado === 'APROBADO' ? 'success' : 'warning'}>{detalleVersion.estado || 'PENDIENTE'}</Badge></p>
                    <p><strong>Fecha Creación:</strong> {formatDate(detalleVersion.fechaCreacion)}</p>
                    <p><strong>ID Empresa:</strong> {detalleVersion.idEmpresa}</p>
                  </div>
                  <div className="col-md-6">
                    <p><strong>Dirección Obra:</strong></p>
                    <p className="ms-3">
                      {detalleVersion.direccionObraCalle} {detalleVersion.direccionObraAltura}<br/>
                      {detalleVersion.direccionObraPiso && `Piso: ${detalleVersion.direccionObraPiso}, `}
                      {detalleVersion.direccionObraDpto && `Dpto: ${detalleVersion.direccionObraDpto}`}<br/>
                      {detalleVersion.direccionObraLocalidad}, {detalleVersion.direccionObraProvincia}<br/>
                      CP: {detalleVersion.direccionObraCodigoPostal}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Honorarios de Dirección */}
            <div className="card mb-3">
              <div className="card-header bg-info text-white">
                <strong>💼 Honorarios de Dirección de Obra</strong>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-4">
                    <p><strong>Selección:</strong> {detalleVersion.honorarioSeleccion}</p>
                  </div>
                  <div className="col-md-4">
                    <p><strong>Valor Fijo:</strong> {formatCurrency(detalleVersion.honorarioDireccionValorFijo)}</p>
                  </div>
                  <div className="col-md-4">
                    <p><strong>Porcentaje:</strong> {detalleVersion.honorarioDireccionPorcentaje}%</p>
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-12">
                    <p><strong>Total Honorarios Dirección:</strong> <span className="text-success fs-5">{formatCurrency(detalleVersion.totalHonorariosDireccionObra)}</span></p>
                  </div>
                </div>
              </div>
            </div>

            {/* Profesionales */}
            <div className="card mb-3">
              <div className="card-header bg-warning">
                <strong>👨‍💼 Profesionales ({detalleVersion.profesionales?.length || 0})</strong>
              </div>
              <div className="card-body">
                {detalleVersion.profesionales && detalleVersion.profesionales.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <Table striped bordered hover size="sm">
                      <thead>
                        <tr>
                          <th>Tipo</th>
                          <th>Nombre</th>
                          <th>Teléfono</th>
                          <th>Honorario/Hora</th>
                          <th>Honorario/Día</th>
                          <th>Honorario/Semana</th>
                          <th>Honorario/Mes</th>
                          <th>Horas</th>
                          <th>Días</th>
                          <th>Semanas</th>
                          <th>Meses</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalleVersion.profesionales.map((prof, idx) => (
                          <tr key={idx}>
                            <td><Badge bg="primary">{prof.tipo}</Badge></td>
                            <td>{prof.nombreProfesional || '-'}</td>
                            <td>{prof.telefonoProfesional || '-'}</td>
                            <td>{formatCurrency(prof.honorarioHora)}</td>
                            <td>{formatCurrency(prof.honorarioDia)}</td>
                            <td>{formatCurrency(prof.honorarioSemana)}</td>
                            <td>{formatCurrency(prof.honorarioMes)}</td>
                            <td>{prof.horas || 0}</td>
                            <td>{prof.dias || 0}</td>
                            <td>{prof.semanas || 0}</td>
                            <td>{prof.meses || 0}</td>
                            <td><strong>{formatCurrency(prof.totalHonorarios)}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#fff3cd' }}>
                          <td colSpan="11" className="text-end"><strong>Total Honorarios Profesionales:</strong></td>
                          <td><strong>{formatCurrency(detalleVersion.totalHonorariosProfesionales)}</strong></td>
                        </tr>
                      </tfoot>
                    </Table>
                  </div>
                ) : (
                  <p className="text-muted">No hay profesionales registrados en esta versión.</p>
                )}
              </div>
            </div>

            {/* Materiales */}
            <div className="card mb-3">
              <div className="card-header bg-success text-white">
                <strong>🛠️ Materiales ({(detalleVersion.materiales || detalleVersion.materialesList || []).length})</strong>
              </div>
              <div className="card-body">
                {((detalleVersion.materiales || detalleVersion.materialesList || []).length > 0) ? (
                  <div style={{ overflowX: 'auto' }}>
                    <Table striped bordered hover size="sm">
                      <thead>
                        <tr>
                          <th>Descripción</th>
                          <th>Cantidad</th>
                          <th>Unidad Medida</th>
                          <th>Precio Unitario</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detalleVersion.materiales || detalleVersion.materialesList).map((mat, idx) => (
                          <tr key={idx}>
                            <td>{mat.descripcion}</td>
                            <td>{mat.cantidad}</td>
                            <td>{mat.unidadMedida}</td>
                            <td>{formatCurrency(mat.precioUnitario)}</td>
                            <td><strong>{formatCurrency(mat.total)}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#d4edda' }}>
                          <td colSpan="4" className="text-end"><strong>Total Materiales:</strong></td>
                          <td><strong>{formatCurrency(detalleVersion.totalMateriales)}</strong></td>
                        </tr>
                      </tfoot>
                    </Table>
                  </div>
                ) : (
                  <p className="text-muted">No hay materiales registrados en esta versión.</p>
                )}
              </div>
            </div>

            {/* Otros Costos */}
            <div className="card mb-3">
              <div className="card-header bg-secondary text-white">
                <strong>💰 Otros Costos ({detalleVersion.otrosCostos?.length || 0})</strong>
              </div>
              <div className="card-body">
                {detalleVersion.otrosCostos && detalleVersion.otrosCostos.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <Table striped bordered hover size="sm">
                      <thead>
                        <tr>
                          <th>Descripción</th>
                          <th>Monto</th>
                          <th>Observaciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalleVersion.otrosCostos.map((costo, idx) => (
                          <tr key={idx}>
                            <td>{costo.descripcion}</td>
                            <td><strong>{formatCurrency(costo.monto)}</strong></td>
                            <td>{costo.observaciones || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-muted">No hay otros costos registrados en esta versión.</p>
                )}
              </div>
            </div>

            {/* Resumen Total */}
            <div className="card" style={{ background: '#d1ecf1', borderColor: '#bee5eb' }}>
              <div className="card-body">
                <h4 className="text-center mb-3">💵 MONTO TOTAL DEL PRESUPUESTO</h4>
                <h2 className="text-center text-success">
                  {formatCurrency(detalleVersion.montoTotal)}
                </h2>
              </div>
            </div>

            {/* Mensajes de éxito/error */}
            {successMessage && (
              <Alert variant="success" className="mt-3" dismissible onClose={() => setSuccessMessage(null)}>
                {successMessage}
              </Alert>
            )}

            {error && (
              <Alert variant="danger" className="mt-3" dismissible onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* Información de Obra (si ya está aprobado) */}
            {detalleVersion.obraId && (
              <Alert variant="info" className="mt-3">
                <strong>🏗️ Obra Asociada:</strong> ID {detalleVersion.obraId}
              </Alert>
            )}
          </div>
          <div className="modal-footer">
            {/* Botón Aprobar y Crear Obra */}
            {detalleVersion.estado !== 'APROBADO' && (
              <Button 
                variant="success" 
                onClick={handleAprobarYCrearObra}
                disabled={aprobando}
              >
                {aprobando ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Aprobando...
                  </>
                ) : (
                  '✅ Aprobar y Crear Obra'
                )}
              </Button>
            )}
            
            <Button variant="secondary" onClick={handleCerrarDetalle}>
              Cerrar
            </Button>
          </div>
        </div>
        </div>
        </div>
      )}
    </>
  );
};

export default HistorialVersionesPresupuestoNoClienteModal;
