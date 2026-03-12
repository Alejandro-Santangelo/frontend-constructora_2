import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Button, Form, Badge, Alert, Table, Card, Accordion } from 'react-bootstrap';
import { useEmpresa } from '../EmpresaContext';
import {
  crearPagoCuenta,
  obtenerResumenPagos,
  listarPagosPorPresupuesto,
  calcularTotalesItem,
  formatearMoneda,
  TIPOS_ITEM,
  TIPOS_ITEM_LABELS,
  METODOS_PAGO,
  METODOS_PAGO_LABELS
} from '../services/pagoCuentaService';

/**
 * Modal para gestionar pagos a cuenta sobre items de rubros del presupuesto
 * Muestra: Jornales, Materiales y Gastos Generales de cada rubro
 * Permite registrar pagos parciales con cálculo automático de saldos
 */
const PagoCuentaModal = ({
  show,
  onHide,
  presupuesto,
  onSuccess
}) => {
  const { empresaSeleccionada } = useEmpresa();

  // Estados principales
  const [rubroSeleccionado, setRubroSeleccionado] = useState(null);
  const [tipoItemSeleccionado, setTipoItemSeleccionado] = useState(null);
  const [monto, setMonto] = useState('');
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [observaciones, setObservaciones] = useState('');
  const [fechaPago, setFechasPago] = useState(new Date().toISOString().split('T')[0]);

  // Estados de datos
  const [resumenPagos, setResumenPagos] = useState({});
  const [historialPagos, setHistorialPagos] = useState([]);
  const [totalesItemActual, setTotalesItemActual] = useState(null);

  // Estados de UI
  const [loading, setLoading] = useState(false);
  const [loadingResumen, setLoadingResumen] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [vistaActual, setVistaActual] = useState('seleccion'); // 'seleccion' | 'pago' | 'historial'

  // Extraer rubros del presupuesto (itemsCalculadora)
  const rubrosPresupuesto = useMemo(() => {
    if (!presupuesto || !presupuesto.itemsCalculadora) return [];
    
    return presupuesto.itemsCalculadora.map(item => {
      // Calcular totales por tipo de item
      const totalJornales = (item.jornales || []).reduce((sum, j) => 
        sum + (j.subtotal || 0), 0);
      const totalMateriales = (item.materialesLista || []).reduce((sum, m) => 
        sum + (m.subtotal || 0), 0);
      const totalGastosGenerales = (item.gastosGenerales || []).reduce((sum, g) => 
        sum + (g.subtotal || 0), 0);

      return {
        nombre: item.tipoProfesional,
        itemId: item.id,
        jornales: {
          tipo: TIPOS_ITEM.JORNALES,
          total: totalJornales,
          lista: item.jornales || []
        },
        materiales: {
          tipo: TIPOS_ITEM.MATERIALES,
          total: totalMateriales,
          lista: item.materialesLista || []
        },
        gastosGenerales: {
          tipo: TIPOS_ITEM.GASTOS_GENERALES,
          total: totalGastosGenerales,
          lista: item.gastosGenerales || []
        },
        totalRubro: totalJornales + totalMateriales + totalGastosGenerales
      };
    });
  }, [presupuesto]);

  // Cargar resumen de pagos del presupuesto
  const cargarResumenPagos = async () => {
    if (!presupuesto || !empresaSeleccionada) return;

    setLoadingResumen(true);
    try {
      const resumen = await obtenerResumenPagos(presupuesto.id, empresaSeleccionada.id);
      setResumenPagos(resumen);
    } catch (err) {
      console.error('Error cargando resumen de pagos:', err);
      setResumenPagos({});
    } finally {
      setLoadingResumen(false);
    }
  };

  // Cargar historial de pagos
  const cargarHistorial = async () => {
    if (!presupuesto || !empresaSeleccionada) return;

    try {
      const pagos = await listarPagosPorPresupuesto(presupuesto.id, empresaSeleccionada.id);
      setHistorialPagos(pagos);
    } catch (err) {
      console.error('Error cargando historial:', err);
      setHistorialPagos([]);
    }
  };

  // Cargar totales del item actual seleccionado
  const cargarTotalesItem = async (nombreRubro, tipoItem) => {
    if (!presupuesto || !empresaSeleccionada || !nombreRubro || !tipoItem) return;

    try {
      const totales = await calcularTotalesItem(
        presupuesto.id,
        empresaSeleccionada.id,
        nombreRubro,
        tipoItem
      );
      setTotalesItemActual(totales);
    } catch (err) {
      console.error('Error cargando totales del item:', err);
      setTotalesItemActual(null);
    }
  };

  // Inicializar modal
  useEffect(() => {
    if (show && presupuesto && empresaSeleccionada) {
      cargarResumenPagos();
      cargarHistorial();
      
      // Reset form
      setRubroSeleccionado(null);
      setTipoItemSeleccionado(null);
      setMonto('');
      setMetodoPago('EFECTIVO');
      setObservaciones('');
      setFechasPago(new Date().toISOString().split('T')[0]);
      setError(null);
      setSuccess(null);
      setVistaActual('seleccion');
      setTotalesItemActual(null);
    }
  }, [show, presupuesto, empresaSeleccionada]);

  // Cargar totales cuando se selecciona un item
  useEffect(() => {
    if (rubroSeleccionado && tipoItemSeleccionado) {
      cargarTotalesItem(rubroSeleccionado.nombre, tipoItemSeleccionado);
    } else {
      setTotalesItemActual(null);
    }
  }, [rubroSeleccionado, tipoItemSeleccionado]);

  // Handle selección de item
  const handleSeleccionarItem = (rubro, tipoItem) => {
    setRubroSeleccionado(rubro);
    setTipoItemSeleccionado(tipoItem);
    setVistaActual('pago');
    setError(null);
    setSuccess(null);
  };

  // Handle registrar pago
  const handleRegistrarPago = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validaciones
    if (!rubroSeleccionado || !tipoItemSeleccionado) {
      setError('Debe seleccionar un rubro e item');
      return;
    }

    const montoNumerico = parseFloat(monto);
    if (isNaN(montoNumerico) || montoNumerico <= 0) {
      setError('El monto debe ser mayor a cero');
      return;
    }

    // Validar que no exceda el saldo pendiente
    if (totalesItemActual && montoNumerico > totalesItemActual.saldoPendiente) {
      setError(`El monto excede el saldo pendiente (${formatearMoneda(totalesItemActual.saldoPendiente)})`);
      return;
    }

    setLoading(true);

    try {
      const pagoData = {
        presupuestoId: presupuesto.id,
        empresaId: empresaSeleccionada.id,
        nombreRubro: rubroSeleccionado.nombre,
        tipoItem: tipoItemSeleccionado,
        monto: montoNumerico,
        metodoPago,
        observaciones,
        fechaPago,
        usuarioRegistro: empresaSeleccionada.nombre
      };

      await crearPagoCuenta(pagoData);

      setSuccess('✅ Pago registrado exitosamente');
      
      // Recargar datos
      await cargarResumenPagos();
      await cargarHistorial();
      await cargarTotalesItem(rubroSeleccionado.nombre, tipoItemSeleccionado);

      // Reset form
      setMonto('');
      setObservaciones('');
      
      // Callback
      if (onSuccess) {
        setTimeout(() => onSuccess(), 1500);
      }
    } catch (err) {
      console.error('Error registrando pago:', err);
      setError(err.response?.data?.message || 'Error al registrar el pago');
    } finally {
      setLoading(false);
    }
  };

  // Handle volver a selección
  const handleVolver = () => {
    setVistaActual('seleccion');
    setRubroSeleccionado(null);
    setTipoItemSeleccionado(null);
    setMonto('');
    setObservaciones('');
    setError(null);
    setSuccess(null);
  };

  // Obtener datos de pago de un item desde el resumen
  const obtenerDatosPagoItem = (nombreRubro, tipoItem) => {
    const datosRubro = resumenPagos[nombreRubro];
    if (!datosRubro) return null;
    return datosRubro[tipoItem] || null;
  };

  // Renderizar badge de estado de pagos
  const renderBadgeEstado = (rubro, item) => {
    const datosPago = obtenerDatosPagoItem(rubro.nombre, item.tipo);
    if (!datosPago) {
      return <Badge bg="secondary">Sin pagos</Badge>;
    }

    const porcentaje = (datosPago.totalPagado / datosPago.totalPresupuestado) * 100;
    
    if (porcentaje >= 100) {
      return <Badge bg="success">✓ Pagado</Badge>;
    } else if (porcentaje > 0) {
      return <Badge bg="warning">{porcentaje.toFixed(0)}% pagado</Badge>;
    }
    return <Badge bg="secondary">Sin pagos</Badge>;
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" centered>
      <Modal.Header closeButton className="bg-primary text-white">
        <Modal.Title>
          <i className="bi bi-cash-coin me-2"></i>
          Pagos a Cuenta - {presupuesto?.nombreObra}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {/* Alertas */}
        {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
        {success && <Alert variant="success" dismissible onClose={() => setSuccess(null)}>{success}</Alert>}

        {/* VISTA: Selección de Item */}
        {vistaActual === 'seleccion' && (
          <>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5>Seleccione el item para registrar pago</h5>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => setVistaActual('historial')}
              >
                <i className="bi bi-clock-history me-1"></i>
                Ver Historial
              </Button>
            </div>

            {loadingResumen ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Cargando...</span>
                </div>
              </div>
            ) : rubrosPresupuesto.length === 0 ? (
              <Alert variant="info">
                No hay rubros configurados en este presupuesto
              </Alert>
            ) : (
              <Accordion defaultActiveKey="0">
                {rubrosPresupuesto.map((rubro, idx) => (
                  <Accordion.Item eventKey={idx.toString()} key={rubro.itemId || idx}>
                    <Accordion.Header>
                      <strong>{rubro.nombre}</strong>
                      <Badge bg="primary" className="ms-2">
                        Total: {formatearMoneda(rubro.totalRubro)}
                      </Badge>
                    </Accordion.Header>
                    <Accordion.Body>
                      <Table hover size="sm">
                        <thead className="table-light">
                          <tr>
                            <th>Item</th>
                            <th className="text-end">Presupuestado</th>
                            <th className="text-end">Pagado</th>
                            <th className="text-end">Saldo Pendiente</th>
                            <th className="text-center">Estado</th>
                            <th className="text-center">Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Jornales */}
                          {rubro.jornales.total > 0 && (
                            <tr>
                              <td><i className="bi bi-people-fill text-primary me-2"></i>{TIPOS_ITEM_LABELS.JORNALES}</td>
                              <td className="text-end">{formatearMoneda(rubro.jornales.total)}</td>
                              <td className="text-end text-success">
                                {formatearMoneda(obtenerDatosPagoItem(rubro.nombre, TIPOS_ITEM.JORNALES)?.totalPagado || 0)}
                              </td>
                              <td className="text-end text-danger">
                                {formatearMoneda(obtenerDatosPagoItem(rubro.nombre, TIPOS_ITEM.JORNALES)?.saldoPendiente || rubro.jornales.total)}
                              </td>
                              <td className="text-center">
                                {renderBadgeEstado(rubro, rubro.jornales)}
                              </td>
                              <td className="text-center">
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={() => handleSeleccionarItem(rubro, TIPOS_ITEM.JORNALES)}
                                >
                                  <i className="bi bi-plus-circle me-1"></i>
                                  Pagar
                                </Button>
                              </td>
                            </tr>
                          )}

                          {/* Materiales */}
                          {rubro.materiales.total > 0 && (
                            <tr>
                              <td><i className="bi bi-box-seam text-warning me-2"></i>{TIPOS_ITEM_LABELS.MATERIALES}</td>
                              <td className="text-end">{formatearMoneda(rubro.materiales.total)}</td>
                              <td className="text-end text-success">
                                {formatearMoneda(obtenerDatosPagoItem(rubro.nombre, TIPOS_ITEM.MATERIALES)?.totalPagado || 0)}
                              </td>
                              <td className="text-end text-danger">
                                {formatearMoneda(obtenerDatosPagoItem(rubro.nombre, TIPOS_ITEM.MATERIALES)?.saldoPendiente || rubro.materiales.total)}
                              </td>
                              <td className="text-center">
                                {renderBadgeEstado(rubro, rubro.materiales)}
                              </td>
                              <td className="text-center">
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={() => handleSeleccionarItem(rubro, TIPOS_ITEM.MATERIALES)}
                                >
                                  <i className="bi bi-plus-circle me-1"></i>
                                  Pagar
                                </Button>
                              </td>
                            </tr>
                          )}

                          {/* Gastos Generales */}
                          {rubro.gastosGenerales.total > 0 && (
                            <tr>
                              <td><i className="bi bi-receipt text-info me-2"></i>{TIPOS_ITEM_LABELS.GASTOS_GENERALES}</td>
                              <td className="text-end">{formatearMoneda(rubro.gastosGenerales.total)}</td>
                              <td className="text-end text-success">
                                {formatearMoneda(obtenerDatosPagoItem(rubro.nombre, TIPOS_ITEM.GASTOS_GENERALES)?.totalPagado || 0)}
                              </td>
                              <td className="text-end text-danger">
                                {formatearMoneda(obtenerDatosPagoItem(rubro.nombre, TIPOS_ITEM.GASTOS_GENERALES)?.saldoPendiente || rubro.gastosGenerales.total)}
                              </td>
                              <td className="text-center">
                                {renderBadgeEstado(rubro, rubro.gastosGenerales)}
                              </td>
                              <td className="text-center">
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={() => handleSeleccionarItem(rubro, TIPOS_ITEM.GASTOS_GENERALES)}
                                >
                                  <i className="bi bi-plus-circle me-1"></i>
                                  Pagar
                                </Button>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </Table>
                    </Accordion.Body>
                  </Accordion.Item>
                ))}
              </Accordion>
            )}
          </>
        )}

        {/* VISTA: Formulario de Pago */}
        {vistaActual === 'pago' && rubroSeleccionado && (
          <>
            <Button variant="outline-secondary" size="sm" onClick={handleVolver} className="mb-3">
              <i className="bi bi-arrow-left me-1"></i>
              Volver
            </Button>

            <Card className="mb-3">
              <Card.Header className="bg-light">
                <h5 className="mb-0">
                  {rubroSeleccionado.nombre} - {TIPOS_ITEM_LABELS[tipoItemSeleccionado]}
                </h5>
              </Card.Header>
              <Card.Body>
                {totalesItemActual ? (
                  <div className="row">
                    <div className="col-md-4">
                      <div className="text-center p-3 bg-light rounded">
                        <small className="text-muted">Total Presupuestado</small>
                        <h4 className="mb-0">{formatearMoneda(totalesItemActual.montoTotal)}</h4>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="text-center p-3 bg-success bg-opacity-10 rounded">
                        <small className="text-muted">Total Pagado</small>
                        <h4 className="mb-0 text-success">{formatearMoneda(totalesItemActual.totalPagado)}</h4>
                        <small className="text-success">{totalesItemActual.porcentajePagado?.toFixed(1)}%</small>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="text-center p-3 bg-danger bg-opacity-10 rounded">
                        <small className="text-muted">Saldo Pendiente</small>
                        <h4 className="mb-0 text-danger">{formatearMoneda(totalesItemActual.saldoPendiente)}</h4>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="spinner-border spinner-border-sm" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                )}
              </Card.Body>
            </Card>

            <Form onSubmit={handleRegistrarPago}>
              <Form.Group className="mb-3">
                <Form.Label>Monto del Pago *</Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  placeholder="Ingrese el monto"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  required
                  disabled={loading}
                />
                {totalesItemActual && (
                  <Form.Text className="text-muted">
                    Saldo disponible: {formatearMoneda(totalesItemActual.saldoPendiente)}
                  </Form.Text>
                )}
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Método de Pago</Form.Label>
                <Form.Select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  disabled={loading}
                >
                  {Object.entries(METODOS_PAGO_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Fecha de Pago</Form.Label>
                <Form.Control
                  type="date"
                  value={fechaPago}
                  onChange={(e) => setFechasPago(e.target.value)}
                  disabled={loading}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Observaciones</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  placeholder="Observaciones opcionales sobre este pago"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  disabled={loading}
                />
              </Form.Group>

              <div className="d-grid gap-2">
                <Button 
                  type="submit" 
                  variant="primary" 
                  size="lg"
                  disabled={loading || !monto || !totalesItemActual}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Registrando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle me-2"></i>
                      Registrar Pago
                    </>
                  )}
                </Button>
              </div>
            </Form>
          </>
        )}

        {/* VISTA: Historial de Pagos */}
        {vistaActual === 'historial' && (
          <>
            <Button variant="outline-secondary" size="sm" onClick={handleVolver} className="mb-3">
              <i className="bi bi-arrow-left me-1"></i>
              Volver
            </Button>

            <h5 className="mb-3">Historial de Pagos</h5>

            {historialPagos.length === 0 ? (
              <Alert variant="info">
                No hay pagos registrados para este presupuesto
              </Alert>
            ) : (
              <Table striped bordered hover>
                <thead className="table-dark">
                  <tr>
                    <th>Fecha</th>
                    <th>Rubro</th>
                    <th>Item</th>
                    <th className="text-end">Monto</th>
                    <th>Método</th>
                    <th>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {historialPagos.map((pago, idx) => (
                    <tr key={pago.id || idx}>
                      <td>{new Date(pago.fechaPago).toLocaleDateString('es-AR')}</td>
                      <td><strong>{pago.nombreRubro}</strong></td>
                      <td><Badge bg="secondary">{TIPOS_ITEM_LABELS[pago.tipoItem]}</Badge></td>
                      <td className="text-end"><strong>{formatearMoneda(pago.monto)}</strong></td>
                      <td>{METODOS_PAGO_LABELS[pago.metodoPago] || pago.metodoPago}</td>
                      <td>{pago.observaciones || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default PagoCuentaModal;
