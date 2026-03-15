import React, { useState, useEffect } from 'react';
import { Modal, Button, Badge, Alert, Table, Spinner, Accordion } from 'react-bootstrap';
import { useEmpresa } from '../EmpresaContext';
import apiService from '../services/api';

/**
 * Modal para GestiÃ³n Consolidada de Pagos a Materiales
 * Estructura jerÃ¡rquica: material â†’ Obras â†’ Asignaciones por rubro
 * Muestra todos los Materiales con sus obras y asignaciones consolidadas
 */
const GestionPagosMaterialesModal = ({
  show,
  onHide,
  onSuccess,
  empresaId // 🔑 Recibir empresaId como prop explícita
}) => {
  const { empresaSeleccionada } = useEmpresa();
  // 🔑 Usar empresaId prop si existe, sino fallback al contexto
  const idEmpresaActual = empresaId || empresaSeleccionada?.id;

  // Estados principales
  const [materiales, setMateriales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Estados para edición de campos
  const [editando, setEditando] = useState(null); // { asigId, campo }
  const [valorTemporal, setValorTemporal] = useState('');
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
  const [campoAEditar, setCampoAEditar] = useState(null); // { asigId, campo, valorActual }

  // 💰 Estados para pools de dinero por rubro/obra
  const [poolsRubros, setPoolsRubros] = useState({}); // { 'obraId_rubroNombre': { total, asignado, disponible } }
  const [presupuestos, setPresupuestos] = useState([]); // Presupuestos de las obras
  const [editandoPool, setEditandoPool] = useState(null); // { poolKey }
  const [valorTemporalPool, setValorTemporalPool] = useState('');
  const [mostrarConfirmacionPool, setMostrarConfirmacionPool] = useState(false);
  const [poolAEditar, setPoolAEditar] = useState(null); // { poolKey, valorActual }

  // Cargar Materiales y presupuestos cuando se abre el modal
  useEffect(() => {
    if (show && idEmpresaActual) {
      cargarMaterialesConsolidados();
      cargarPresupuestos();
    }
  }, [show, idEmpresaActual]);

  // 💰 Recalcular pools cuando cambien Materiales o presupuestos
  useEffect(() => {
    if (materiales.length > 0) {
      calcularPoolsIniciales(materiales);
    }
  }, [materiales, presupuestos]);

  const cargarMaterialesConsolidados = async () => {
    if (!idEmpresaActual) {
      console.warn('⚠️ No hay empresa seleccionada');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Cargando Materiales consolidados para empresa:', idEmpresaActual);

      // Llamar al nuevo endpoint que devuelve Materiales consolidados
      const response = await apiService.get(`/api/materiales/materiales-consolidados`, {
        params: { empresaId: idEmpresaActual }
      });

      const materialesData = Array.isArray(response) ? response : (response?.data || []);

      console.log(`✅ Se encontraron ${materialesData.length} Materiales con asignaciones activas`);
      
      if (materialesData.length > 0) {
        console.log('📊 Primer material:', {
          nombre: materialesData[0].materialNombre,
          obras: materialesData[0].totalObras,
          asignaciones: materialesData[0].totalAsignaciones,
          totalAsignado: materialesData[0].totalAsignado
        });
      }

      setMateriales(materialesData);
    } catch (err) {
      console.error('❌ Error al cargar Materiales consolidados:', err);
      console.error('   URL:', `/api/materiales/materiales-consolidados?empresaId=${idEmpresaActual}`);
      console.error('   Detalles:', err.response?.data || err.message);
      setError(err.response?.data?.message || 'Error al cargar información de pagos a Materiales');
    } finally {
      setLoading(false);
    }
  };

  // 💰 Cargar presupuestos de las obras
  const cargarPresupuestos = async () => {
    try {
      const response = await apiService.get('/api/presupuestos-no-cliente', {
        empresaId: idEmpresaActual,
        page: 0,
        size: 1000
      });

      const data = response?.data ?? response;
      const lista = Array.isArray(data) ? data : (data?.content || []);
      setPresupuestos(lista);
      console.log('Presupuestos cargados:', lista.length);
    } catch (err) {
      console.warn('No se pudieron cargar presupuestos:', err.message);
    }
  };

  // 💰 Calcular pools iniciales de rubros por obra
  const calcularPoolsIniciales = (materialesData) => {
    const pools = {};

    materialesData.forEach(prof => {
      prof.obras.forEach(obra => {
        obra.asignaciones.forEach(asig => {
          const poolKey = `${obra.obraId}_${asig.rubroNombre}`;

          if (!pools[poolKey]) {
            pools[poolKey] = {
              obraId: obra.obraId,
              obraNombre: obra.obraNombre,
              rubroNombre: asig.rubroNombre,
              importeTotal: 0, // Se cargará desde presupuesto
              importeAsignado: 0,
              importeDisponible: 0
            };
          }

          // Sumar lo ya asignado a Materiales
          pools[poolKey].importeAsignado += Number(asig.totalAsignado || 0);
        });
      });
    });

    // 💰 Intentar cargar totales desde presupuestos
    if (presupuestos && presupuestos.length > 0) {
      presupuestos.forEach(presupuesto => {
        // Buscar itemsCalculadoraJson (modo global/detallado)
        const items = presupuesto.itemsCalculadoraJson || [];

        items.forEach(item => {
          const rubroNombre = item.tipomaterial || item.rubroNombre || 'Sin rubro';
          const obraId = presupuesto.obraId || presupuesto.obra_id;

          if (!obraId) return;

          const poolKey = `${obraId}_${rubroNombre}`;

          if (pools[poolKey]) {
            // Si es modo global, usar subtotalJornales
            // Si es detallado, sumar jornales individuales
            const totalJornales = item.subtotalJornales ||
                                 (item.jornales?.reduce((sum, j) => sum + (Number(j.subtotal) || 0), 0)) ||
                                 0;

            pools[poolKey].importeTotal += totalJornales;
          }
        });
      });
    }

    // Calcular disponible
    Object.keys(pools).forEach(key => {
      pools[key].importeDisponible = pools[key].importeTotal - pools[key].importeAsignado;
    });

    setPoolsRubros(pools);
    console.log('Pools iniciales calculados:', pools);
  };

  // 💰 Obtener pool disponible para una obra/rubro
  const obtenerPoolDisponible = (obraId, rubroNombre) => {
    const poolKey = `${obraId}_${rubroNombre}`;
    const pool = poolsRubros[poolKey];

    if (!pool) return { disponible: 0, total: 0, asignado: 0 };

    return {
      disponible: pool.importeDisponible,
      total: pool.importeTotal,
      asignado: pool.importeAsignado
    };
  };

  // 💰 Actualizar pool cuando se asigna dinero a un material
  const actualizarPoolAlAsignar = (obraId, rubroNombre, montoAnterior, montoNuevo) => {
    const poolKey = `${obraId}_${rubroNombre}`;

    setPoolsRubros(prev => {
      const pool = prev[poolKey];
      if (!pool) return prev;

      const diferencia = montoNuevo - montoAnterior;
      const nuevoAsignado = pool.importeAsignado + diferencia;
      const nuevoDisponible = pool.importeTotal - nuevoAsignado;

      return {
        ...prev,
        [poolKey]: {
          ...pool,
          importeAsignado: nuevoAsignado,
          importeDisponible: nuevoDisponible
        }
      };
    });
  };

  // 💰 Solicitar edición del total del pool
  const solicitarEdicionPool = (obraId, rubroNombre, valorActual) => {
    const poolKey = `${obraId}_${rubroNombre}`;
    setPoolAEditar({ poolKey, valorActual });
    setMostrarConfirmacionPool(true);
  };

  // 💰 Confirmar edición del pool
  const confirmarEdicionPool = () => {
    setEditandoPool({ poolKey: poolAEditar.poolKey });
    setValorTemporalPool(poolAEditar.valorActual);
    setMostrarConfirmacionPool(false);
  };

  // 💰 Cancelar edición del pool
  const cancelarEdicionPool = () => {
    setPoolAEditar(null);
    setMostrarConfirmacionPool(false);
    setEditandoPool(null);
    setValorTemporalPool('');
  };

  // 💰 Guardar cambio del total del pool
  const guardarCambioPool = (poolKey, nuevoTotal) => {
    setPoolsRubros(prev => {
      const pool = prev[poolKey];
      if (!pool) return prev;

      const nuevoDisponible = Number(nuevoTotal) - pool.importeAsignado;

      return {
        ...prev,
        [poolKey]: {
          ...pool,
          importeTotal: Number(nuevoTotal),
          importeDisponible: nuevoDisponible
        }
      };
    });

    setEditandoPool(null);
    setValorTemporalPool('');
  };

  const formatearMoneda = (valor) => {
    if (!valor && valor !== 0) return '$0.00';
    return `$${Number(valor).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getBadgeEstado = (estado) => {
    const badges = {
      'ACTIVO': 'success',
      'FINALIZADO': 'secondary',
      'CANCELADO': 'danger'
    };
    return badges[estado] || 'secondary';
  };

  const calcularTotalesGenerales = () => {
    let totalMateriales = materiales.length;
    let totalObras = 0;
    let totalAsignaciones = 0;
    let totalAsignado = 0;
    let totalUtilizado = 0;
    let totalPendiente = 0;

    materiales.forEach(prof => {
      totalObras += prof.totalObras || 0;
      totalAsignaciones += prof.totalAsignaciones || 0;
      totalAsignado += Number(prof.totalAsignado || 0);
      totalUtilizado += Number(prof.totalUtilizado || 0);
      totalPendiente += Number(prof.saldoPendiente || 0);
    });

    return { totalMateriales, totalObras, totalAsignaciones, totalAsignado, totalUtilizado, totalPendiente };
  };

  // Solicitar confirmación para editar
  const solicitarEdicion = (asigId, campo, valorActual) => {
    setCampoAEditar({ asigId, campo, valorActual });
    setMostrarConfirmacion(true);
  };

  // Confirmar edición
  const confirmarEdicion = () => {
    setEditando({ asigId: campoAEditar.asigId, campo: campoAEditar.campo });
    setValorTemporal(campoAEditar.valorActual);
    setMostrarConfirmacion(false);
  };

  // Cancelar edición
  const cancelarEdicion = () => {
    setCampoAEditar(null);
    setMostrarConfirmacion(false);
    setEditando(null);
    setValorTemporal('');
  };

  // Guardar cambio
  const guardarCambio = async (asigId, campo, nuevoValor) => {
    try {
      // Aquí llamarías al endpoint para actualizar la asignación
      // Ejemplo: await apiService.put(`/api/Materiales-obras/${asigId}`, { [campo]: nuevoValor }, { empresaId: empresaSeleccionada.id });

      // 💰 Capturar datos antes de la actualización para ajustar el pool
      let obraIdParaPool = null;
      let rubroNombreParaPool = null;
      let totalAsignadoAnterior = 0;
      let totalAsignadoNuevo = 0;

      // Por ahora, actualizar localmente
      const nuevosMateriales = materiales.map(prof => ({
        ...prof,
        obras: prof.obras.map(obra => ({
          ...obra,
          asignaciones: obra.asignaciones.map(asig => {
            if (asig.id === asigId) {
              // 💰 Guardar datos para actualizar pool
              obraIdParaPool = obra.obraId;
              rubroNombreParaPool = asig.rubroNombre;
              totalAsignadoAnterior = asig.totalAsignado;

              const actualizada = { ...asig, [campo]: Number(nuevoValor) };
              // Recalcular totales si es necesario
              if (campo === 'importeJornal' || campo === 'cantidadJornales') {
                actualizada.totalAsignado = actualizada.importeJornal * actualizada.cantidadJornales;
                actualizada.saldoPendiente = actualizada.totalAsignado - actualizada.totalUtilizado;
                actualizada.jornalesRestantes = actualizada.cantidadJornales - actualizada.jornalesUtilizados;
                totalAsignadoNuevo = actualizada.totalAsignado;
              } else {
                totalAsignadoNuevo = actualizada.totalAsignado;
              }
              return actualizada;
            }
            return asig;
          })
        }))
      }));

      setMateriales(nuevosMateriales);

      // 💰 Actualizar pool si cambió el total asignado
      if (obraIdParaPool && rubroNombreParaPool && totalAsignadoAnterior !== totalAsignadoNuevo) {
        actualizarPoolAlAsignar(obraIdParaPool, rubroNombreParaPool, totalAsignadoAnterior, totalAsignadoNuevo);
      }

      setEditando(null);
      setValorTemporal('');

      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Error al guardar cambio:', err);
      setError('Error al guardar los cambios');
    }
  };

  // Componente de campo editable
  const CampoEditable = ({ asigId, campo, valor, esMoneda = false }) => {
    const estaEditando = editando?.asigId === asigId && editando?.campo === campo;

    if (estaEditando) {
      return (
        <input
          type="number"
          className="form-control form-control-sm text-end"
          value={valorTemporal}
          onChange={(e) => setValorTemporal(e.target.value)}
          onBlur={() => {
            if (valorTemporal !== String(valor)) {
              guardarCambio(asigId, campo, valorTemporal);
            } else {
              cancelarEdicion();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              guardarCambio(asigId, campo, valorTemporal);
            } else if (e.key === 'Escape') {
              cancelarEdicion();
            }
          }}
          autoFocus
          style={{ minWidth: '100px' }}
        />
      );
    }

    const valorMostrar = esMoneda ? formatearMoneda(valor) : valor;

    return (
      <span
        className="fw-bold"
        onClick={() => solicitarEdicion(asigId, campo, valor)}
        style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
        title="Click para editar"
      >
        {valorMostrar}
      </span>
    );
  };

  const renderAsignacionesTable = (asignaciones, obraNombre) => {
    if (!asignaciones || asignaciones.length === 0) {
      return (
        <Alert variant="info" className="mb-0 text-center">
          No hay asignaciones en esta obra
        </Alert>
      );
    }

    return (
      <Table striped bordered hover responsive size="sm" className="mb-0">
        <thead className="table-light">
          <tr>
            <th style={{ width: '20%' }}>Rubro</th>
            <th style={{ width: '10%' }} className="text-center">Tipo</th>
            <th style={{ width: '12%' }} className="text-end">Precio Jornal</th>
            <th style={{ width: '10%' }} className="text-center">Jornales</th>
            <th style={{ width: '13%' }} className="text-end">Total Asignado</th>
            <th style={{ width: '13%' }} className="text-end">Total Utilizado</th>
            <th style={{ width: '13%' }} className="text-end">Saldo Pendiente</th>
            <th style={{ width: '9%' }} className="text-center">Estado</th>
          </tr>
        </thead>
        <tbody>
          {asignaciones.map((asig, idx) => (
            <tr key={idx}>
              <td>
                <strong className="text-primary">{asig.rubroNombre || 'Sin rubro'}</strong>
              </td>
              <td className="text-center">
                <Badge bg={asig.tipoAsignacion === 'JORNAL' ? 'primary' : 'info'} className="text-uppercase">
                  {asig.tipoAsignacion || '-'}
                </Badge>
              </td>
              <td className="text-end">
                <CampoEditable asigId={asig.id} campo="importeJornal" valor={asig.importeJornal} esMoneda={true} />
              </td>
              <td className="text-center">
                <div>
                  <span className="text-success fw-bold">{asig.jornalesUtilizados || 0}</span>
                  <span className="text-muted"> / </span>
                  <CampoEditable asigId={asig.id} campo="cantidadJornales" valor={asig.cantidadJornales} />
                </div>
                <small className="text-muted">
                  ({asig.jornalesRestantes || 0} rest.)
                </small>
              </td>
              <td className="text-end">
                <span className="fw-bold text-primary">{formatearMoneda(asig.totalAsignado)}</span>
              </td>
              <td className="text-end">
                <span className="fw-bold text-warning">{formatearMoneda(asig.totalUtilizado)}</span>
              </td>
              <td className="text-end">
                <span className={`fw-bold ${Number(asig.saldoPendiente || 0) > 0 ? 'text-danger' : 'text-success'}`}>
                  {formatearMoneda(asig.saldoPendiente)}
                </span>
              </td>
              <td className="text-center">
                <Badge bg={getBadgeEstado(asig.estado)}>
                  {asig.estado || 'N/A'}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  };

  const renderObrasDeMaterial = (obras, materialNombre) => {
    if (!obras || obras.length === 0) {
      return (
        <Alert variant="warning" className="mb-0">
          <i className="bi bi-info-circle me-2"></i>
          Este material no tiene obras asignadas
        </Alert>
      );
    }

    return (
      <div className="obras-container">
        {obras.map((obra, idxObra) => {
          // 💰 Obtener rubros únicos de esta obra
          const rubrosUnicos = [...new Set(obra.asignaciones.map(a => a.rubroNombre))];

          return (
            <div key={idxObra} className="obra-section mb-4 border rounded p-3 bg-light">
              {/* Header de la Obra */}
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h6 className="mb-0 text-primary">
                    <i className="bi bi-building me-2"></i>
                    <strong>{obra.obraNombre || `Obra ${idxObra + 1}`}</strong>
                  </h6>
                  {obra.direccionCompleta && (
                    <small className="text-muted">
                      <i className="bi bi-geo-alt-fill me-1"></i>
                      {obra.direccionCompleta}
                    </small>
                  )}

                  {/* 💰 Pools de Rubros */}
                  <div className="mt-2 d-flex flex-wrap gap-2">
                    {rubrosUnicos.map((rubroNombre, idx) => {
                      const pool = obtenerPoolDisponible(obra.obraId, rubroNombre);
                      const poolKey = `${obra.obraId}_${rubroNombre}`;
                      const estaEditandoPool = editandoPool?.poolKey === poolKey;

                      return (
                        <div key={idx} className="badge bg-info bg-opacity-75 text-dark d-flex align-items-center gap-2" style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem' }}>
                          <strong>{rubroNombre}:</strong>
                          {estaEditandoPool ? (
                            <input
                              type="number"
                              className="form-control form-control-sm d-inline-block"
                              style={{ width: '100px', fontSize: '0.8rem' }}
                              value={valorTemporalPool}
                              onChange={(e) => setValorTemporalPool(e.target.value)}
                              onBlur={() => {
                                if (valorTemporalPool !== String(pool.total)) {
                                  guardarCambioPool(poolKey, valorTemporalPool);
                                } else {
                                  cancelarEdicionPool();
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  guardarCambioPool(poolKey, valorTemporalPool);
                                } else if (e.key === 'Escape') {
                                  cancelarEdicionPool();
                                }
                              }}
                              autoFocus
                            />
                          ) : (
                            <span
                              onClick={() => solicitarEdicionPool(obra.obraId, rubroNombre, pool.total)}
                              style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
                              title="Click para editar el total del presupuesto"
                            >
                              {formatearMoneda(pool.disponible)} disponible
                            </span>
                          )}
                          <small className="text-muted">(de {formatearMoneda(pool.total)})</small>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="d-flex gap-3 align-items-center">
                  <Badge bg="secondary">{obra.obraEstado || 'N/A'}</Badge>
                  <small className="text-muted">
                    <i className="bi bi-list-check me-1"></i>
                    {obra.totalAsignaciones || 0} asignaciones
                  </small>
                  <Badge bg="primary">
                    Total: {formatearMoneda(obra.totalAsignado)}
                  </Badge>
                  <Badge bg="danger">
                    Pendiente: {formatearMoneda(obra.saldoPendiente)}
                  </Badge>
                </div>
              </div>

              {/* Tabla de Asignaciones de la Obra */}
              {renderAsignacionesTable(obra.asignaciones, obra.obraNombre)}
            </div>
          );
        })}
      </div>
    );
  };

  const totalesGenerales = calcularTotalesGenerales();

  return (
    <>
    <Modal
      show={show}
      onHide={onHide}
      size="xl"
      centered
      backdrop="static"
      className="modal-gestion-pagos-Materiales"
    >
      <Modal.Header closeButton className="bg-primary text-white">
        <Modal.Title>
          <i className="bi bi-people-fill me-2"></i>
          GestiÃ³n de Pagos por material
        </Modal.Title>
      </Modal.Header>

      <Modal.Body style={{ maxHeight: '75vh', overflowY: 'auto' }}>
        {/* Error */}
        {error && (
          <Alert variant="danger" className="mb-3" onClose={() => setError(null)} dismissible>
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {error}
          </Alert>
        )}

        {/* Loading */}
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <p className="mt-3 text-muted">Cargando informaciÃ³n de pagos...</p>
          </div>
        ) : (
          <>
            {/* Resumen General */}
            <div className="row mb-4">
              <div className="col-md-12">
                <div className="card border-primary shadow-sm">
                  <div className="card-body">
                    <h6 className="card-title text-primary mb-3">
                      <i className="bi bi-bar-chart-fill me-2"></i>
                      Resumen General
                    </h6>
                    <div className="row text-center">
                      <div className="col-md-2">
                        <div className="border rounded p-2 bg-light">
                          <h5 className="mb-1 text-primary">{totalesGenerales.totalMateriales}</h5>
                          <small className="text-muted">Materiales</small>
                        </div>
                      </div>
                      <div className="col-md-2">
                        <div className="border rounded p-2 bg-light">
                          <h5 className="mb-1 text-info">{totalesGenerales.totalObras}</h5>
                          <small className="text-muted">Obras</small>
                        </div>
                      </div>
                      <div className="col-md-2">
                        <div className="border rounded p-2 bg-light">
                          <h5 className="mb-1 text-secondary">{totalesGenerales.totalAsignaciones}</h5>
                          <small className="text-muted">Asignaciones</small>
                        </div>
                      </div>
                      <div className="col-md-2">
                        <div className="border rounded p-2 bg-success bg-opacity-10">
                          <h6 className="mb-1 text-success">{formatearMoneda(totalesGenerales.totalAsignado)}</h6>
                          <small className="text-muted">Asignado</small>
                        </div>
                      </div>
                      <div className="col-md-2">
                        <div className="border rounded p-2 bg-warning bg-opacity-10">
                          <h6 className="mb-1 text-warning">{formatearMoneda(totalesGenerales.totalUtilizado)}</h6>
                          <small className="text-muted">Utilizado</small>
                        </div>
                      </div>
                      <div className="col-md-2">
                        <div className="border rounded p-2 bg-danger bg-opacity-10">
                          <h6 className="mb-1 text-danger">{formatearMoneda(totalesGenerales.totalPendiente)}</h6>
                          <small className="text-muted">Pendiente</small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Listado de Materiales con AcordeÃ³n */}
            {materiales.length === 0 ? (
              <Alert variant="info" className="text-center">
                <i className="bi bi-info-circle me-2"></i>
                No hay Materiales con asignaciones activas
              </Alert>
            ) : (
              <Accordion defaultActiveKey="0">
                {materiales.map((prof, idx) => (
                  <Accordion.Item eventKey={String(idx)} key={idx}>
                    <Accordion.Header>
                      <div className="d-flex justify-content-between align-items-center w-100 pe-3">
                        <div>
                          <strong className="text-primary fs-5">
                            <i className="bi bi-person-fill me-2"></i>
                            {prof.materialNombre || `material ${idx + 1}`}
                          </strong>
                          {prof.materialTipo && (
                            <Badge bg="info" className="ms-2">{prof.materialTipo}</Badge>
                          )}
                          <div className="mt-1">
                            {prof.materialDni && (
                              <small className="text-muted me-3">
                                <i className="bi bi-card-text me-1"></i>
                                DNI: {prof.materialDni}
                              </small>
                            )}
                            {prof.materialTelefono && (
                              <small className="text-muted me-3">
                                <i className="bi bi-telephone-fill me-1"></i>
                                {prof.materialTelefono}
                              </small>
                            )}
                            {prof.materialEmail && (
                              <small className="text-muted">
                                <i className="bi bi-envelope-fill me-1"></i>
                                {prof.materialEmail}
                              </small>
                            )}
                          </div>
                        </div>
                        <div className="d-flex gap-3 align-items-center">
                          <div className="text-center">
                            <div className="fw-bold text-info">{prof.totalObras || 0}</div>
                            <small className="text-muted">Obras</small>
                          </div>
                          <div className="text-center">
                            <div className="fw-bold text-secondary">{prof.totalAsignaciones || 0}</div>
                            <small className="text-muted">Asignaciones</small>
                          </div>
                          <div className="text-center">
                            <div className="fw-bold text-success">{formatearMoneda(prof.totalAsignado)}</div>
                            <small className="text-muted">Total</small>
                          </div>
                          <div className="text-center">
                            <div className="fw-bold text-danger">{formatearMoneda(prof.saldoPendiente)}</div>
                            <small className="text-muted">Pendiente</small>
                          </div>
                        </div>
                      </div>
                    </Accordion.Header>
                    <Accordion.Body className="bg-white">
                      {renderObrasDeMaterial(prof.obras, prof.materialNombre)}
                    </Accordion.Body>
                  </Accordion.Item>
                ))}
              </Accordion>
            )}
          </>
        )}
      </Modal.Body>

      <Modal.Footer className="bg-light">
        <Button variant="secondary" onClick={onHide}>
          <i className="bi bi-x-circle me-2"></i>
          Cerrar
        </Button>
        <Button variant="primary" onClick={cargarMaterialesConsolidados}>
          <i className="bi bi-arrow-clockwise me-2"></i>
          Actualizar
        </Button>
      </Modal.Footer>
    </Modal>

    {/* Modal de Confirmación */}
    <Modal show={mostrarConfirmacion} onHide={() => setMostrarConfirmacion(false)} centered>
      <Modal.Header closeButton className="bg-warning text-dark">
        <Modal.Title>
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          Confirmación de Edición
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-0">
          ¿Está seguro de que desea editar este campo?
        </p>
        <small className="text-muted">
          Los cambios se guardarán automáticamente al terminar de editar.
        </small>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={() => setMostrarConfirmacion(false)}>
          <i className="bi bi-x-circle me-2"></i>
          Cancelar
        </Button>
        <Button variant="primary" onClick={confirmarEdicion}>
          <i className="bi bi-check-circle me-2"></i>
          Aceptar
        </Button>
      </Modal.Footer>
    </Modal>

    {/* 💰 Modal de Confirmación para Editar Pool */}
    <Modal show={mostrarConfirmacionPool} onHide={() => setMostrarConfirmacionPool(false)} centered>
      <Modal.Header closeButton className="bg-info text-dark">
        <Modal.Title>
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          Editar Total del Presupuesto
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-2">
          ¿Está seguro de que desea modificar el total del presupuesto de este rubro?
        </p>
        <small className="text-muted">
          <strong>Importante:</strong> Este cambio afectará el saldo disponible para asignar a los Materiales de este rubro en esta obra.
        </small>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={() => setMostrarConfirmacionPool(false)}>
          <i className="bi bi-x-circle me-2"></i>
          Cancelar
        </Button>
        <Button variant="primary" onClick={confirmarEdicionPool}>
          <i className="bi bi-check-circle me-2"></i>
          Aceptar
        </Button>
      </Modal.Footer>
    </Modal>
    </>
  );
};

export default GestionPagosMaterialesModal;
