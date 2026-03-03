import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Badge, Alert } from 'react-bootstrap';
import { useEmpresa } from '../EmpresaContext';
import {
  TIPOS_ADELANTO,
  TIPOS_ADELANTO_LABELS,
  CONFIGURACION_ADELANTOS,
  calcularMontoEstimado,
  validarAdelanto,
  registrarAdelanto,
  listarAdelantosActivos,
  formatearMoneda
} from '../services/adelantosService';

/**
 * Modal para dar adelantos a profesionales
 * Soporta modo individual y modo múltiple
 */
const DarAdelantoModal = ({
  show,
  onHide,
  profesionalPreseleccionado,
  profesionalesDisponibles = [],
  modoMultiple = false,
  obraDireccion,
  onSuccess
}) => {
  const { empresaSeleccionada } = useEmpresa();

  // Estados principales
  const [profesionalSeleccionado, setProfesionalSeleccionado] = useState(null);
  const [profesionalesSeleccionados, setProfesionalesSeleccionados] = useState([]);
  const [tipoAdelanto, setTipoAdelanto] = useState(TIPOS_ADELANTO.SEMANAL);
  const [usarMontoFijo, setUsarMontoFijo] = useState(false); // Toggle entre porcentaje y monto fijo
  const [porcentaje, setPorcentaje] = useState(CONFIGURACION_ADELANTOS.PORCENTAJE_DEFAULT);
  const [montoFijo, setMontoFijo] = useState(0);
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [observaciones, setObservaciones] = useState('');
  const [semanaReferencia, setSemanaReferencia] = useState(null);

  // Estados de UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [adelantosActivos, setAdelantosActivos] = useState([]);
  const [loadingAdelantos, setLoadingAdelantos] = useState(false);

  // Inicializar con profesional preseleccionado
  useEffect(() => {
    if (show) {
      if (profesionalPreseleccionado) {
        setProfesionalSeleccionado(profesionalPreseleccionado);
        cargarAdelantosActivos(profesionalPreseleccionado);
      } else {
        setProfesionalSeleccionado(null);
        setAdelantosActivos([]);
      }

      // Reset form
      setTipoAdelanto(TIPOS_ADELANTO.SEMANAL);
      setUsarMontoFijo(false);
      setPorcentaje(CONFIGURACION_ADELANTOS.PORCENTAJE_DEFAULT);
      setMontoFijo(0);
      setMetodoPago('EFECTIVO');
      setObservaciones('');
      setSemanaReferencia(null);
      setError(null);
      setProfesionalesSeleccionados([]);
    }
  }, [show, profesionalPreseleccionado]);

  // Cargar adelantos activos del profesional
  const cargarAdelantosActivos = async (profesional) => {
    if (!profesional || !profesional.profesionalObraId || !empresaSeleccionada) return;

    setLoadingAdelantos(true);
    try {
      const adelantos = await listarAdelantosActivos(
        profesional.profesionalObraId,
        empresaSeleccionada.id
      );
      setAdelantosActivos(adelantos);
    } catch (err) {
      console.error('Error cargando adelantos activos:', err);
      setAdelantosActivos([]);
    } finally {
      setLoadingAdelantos(false);
    }
  };

  // Calcular montos
  const calcularMontos = () => {
    if (!profesionalSeleccionado) return { estimado: 0, final: 0, disponible: 0 };

    const saldoPendiente = profesionalSeleccionado.saldoPendiente || profesionalSeleccionado.saldo || 0;
    const totalAdelantosActivos = adelantosActivos.reduce((sum, a) => sum + (a.saldoAdelantoPorDescontar || 0), 0);
    const disponible = saldoPendiente - totalAdelantosActivos;

    let montoFinal = 0;
    let montoEstimado = 0;

    // 1️⃣ Calcular monto estimado según el período seleccionado
    montoEstimado = calcularMontoEstimado(profesionalSeleccionado, tipoAdelanto, 100);

    // 2️⃣ Aplicar método de cálculo: porcentaje o monto fijo
    if (usarMontoFijo) {
      // Usuario ingresó monto fijo específico
      montoFinal = Math.min(montoFijo, disponible);
    } else {
      // Usuario usa porcentaje sobre el estimado del período
      montoFinal = Math.min((montoEstimado * porcentaje / 100), disponible);
    }

    return {
      estimado: montoEstimado,
      final: Math.max(0, montoFinal),
      disponible: Math.max(0, disponible),
      adelantosActivos: totalAdelantosActivos
    };
  };

  const montos = calcularMontos();

  // Manejar cambio de profesional (modo selector)
  const handleProfesionalChange = (profesionalId) => {
    const profesional = profesionalesDisponibles.find(p => p.id === profesionalId);
    setProfesionalSeleccionado(profesional);
    if (profesional) {
      cargarAdelantosActivos(profesional);
    }
  };

  // Toggle selección múltiple
  const toggleSeleccionProfesional = (profesionalId) => {
    if (profesionalesSeleccionados.includes(profesionalId)) {
      setProfesionalesSeleccionados(prev => prev.filter(id => id !== profesionalId));
    } else {
      setProfesionalesSeleccionados(prev => [...prev, profesionalId]);
    }
  };

  // Seleccionar/deseleccionar todos los profesionales
  const toggleSeleccionarTodos = () => {
    const profesionalesConSaldo = profesionalesDisponibles.filter(p => (p.saldoPendiente || p.saldo || 0) > 0);

    if (profesionalesSeleccionados.length === profesionalesConSaldo.length) {
      // Si todos están seleccionados, deseleccionar todos
      setProfesionalesSeleccionados([]);
    } else {
      // Seleccionar todos
      setProfesionalesSeleccionados(profesionalesConSaldo.map(p => p.id));
    }
  };

  // Validar y confirmar
  const handleConfirmar = async () => {
    if (loading) return;

    setError(null);

    // Validaciones
    if (!modoMultiple && !profesionalSeleccionado) {
      setError('Debe seleccionar un profesional');
      return;
    }

    if (modoMultiple && profesionalesSeleccionados.length === 0) {
      setError('Debe seleccionar al menos un profesional');
      return;
    }

    if (montos.final <= 0) {
      setError('El monto del adelanto debe ser mayor a $0');
      return;
    }

    if (montos.final > montos.disponible) {
      setError(`El monto excede el saldo disponible (${formatearMoneda(montos.disponible)})`);
      return;
    }

    // Validación con el servicio
    const validacion = validarAdelanto(profesionalSeleccionado, montos.final);
    if (!validacion.valido) {
      setError(validacion.errores.join('. '));
      return;
    }

    // Confirmación del usuario
    const mensaje = modoMultiple
      ? `¿Confirmar adelanto de ${formatearMoneda(montos.final)} a ${profesionalesSeleccionados.length} profesional(es)?`
      : `¿Confirmar adelanto de ${formatearMoneda(montos.final)} a ${profesionalSeleccionado?.nombre}?`;

    if (!window.confirm(mensaje)) {
      return;
    }

    setLoading(true);

    try {
      if (modoMultiple) {
        // Registrar adelanto para cada profesional seleccionado
        for (const profId of profesionalesSeleccionados) {
          const prof = profesionalesDisponibles.find(p => p.id === profId);
          if (!prof || !prof.profesionalObraId) continue;

          await registrarAdelanto({
            profesionalObraId: prof.profesionalObraId,
            tipoAdelanto,
            montoAdelanto: montos.final,
            metodoPago,
            observaciones,
            semanaReferencia
          }, empresaSeleccionada.id);
        }

        alert(`✅ Adelanto registrado exitosamente para ${profesionalesSeleccionados.length} profesional(es)`);
      } else {
        // Modo individual
        if (!profesionalSeleccionado.profesionalObraId) {
          throw new Error('El profesional no tiene ID de asignación válido');
        }

        await registrarAdelanto({
          profesionalObraId: profesionalSeleccionado.profesionalObraId,
          tipoAdelanto,
          montoAdelanto: montos.final,
          metodoPago,
          observaciones,
          semanaReferencia
        }, empresaSeleccionada.id);

        alert(`✅ Adelanto registrado exitosamente para ${profesionalSeleccionado.nombre}`);
      }

      // Callback de éxito
      if (onSuccess) {
        onSuccess({
          mensaje: 'Adelanto registrado exitosamente',
          monto: montos.final,
          profesionales: modoMultiple ? profesionalesSeleccionados.length : 1
        });
      }

      // Cerrar modal
      onHide();
    } catch (err) {
      console.error('Error registrando adelanto:', err);
      const errorMsg = err.response?.data?.message ||
                       err.response?.data?.mensaje ||
                       err.message ||
                       'Error al registrar el adelanto';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>
          💸 Dar Adelanto
          {profesionalPreseleccionado && ` - ${profesionalPreseleccionado.nombre}`}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {error && (
          <Alert variant="danger" onClose={() => setError(null)} dismissible>
            {error}
          </Alert>
        )}

        {/* Selector de profesional (si no está preseleccionado) */}
        {!profesionalPreseleccionado && !modoMultiple && (
          <div className="mb-4">
            <Form.Label className="fw-bold">Seleccionar Profesional *</Form.Label>
            <Form.Select
              value={profesionalSeleccionado?.id || ''}
              onChange={(e) => handleProfesionalChange(e.target.value)}
              disabled={loading}
            >
              <option value="">-- Seleccione un profesional --</option>
              {profesionalesDisponibles
                .filter(p => (p.saldoPendiente || p.saldo || 0) > 0)
                .map(prof => (
                  <option key={prof.id} value={prof.id}>
                    {prof.nombre} - Saldo: {formatearMoneda(prof.saldoPendiente || prof.saldo || 0)}
                  </option>
                ))}
            </Form.Select>
          </div>
        )}

        {/* Modo múltiple: Lista con checkboxes */}
        {modoMultiple && (
          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <Form.Label className="fw-bold mb-0">Seleccionar Profesionales *</Form.Label>
              <Button
                variant="outline-primary"
                size="sm"
                onClick={toggleSeleccionarTodos}
                disabled={loading}
              >
                {profesionalesSeleccionados.length === profesionalesDisponibles.filter(p => (p.saldoPendiente || p.saldo || 0) > 0).length
                  ? '☑ Deseleccionar todos'
                  : '☐ Seleccionar todos'}
              </Button>
            </div>
            <div className="border rounded p-3" style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {profesionalesDisponibles
                .filter(p => (p.saldoPendiente || p.saldo || 0) > 0)
                .map(prof => (
                  <Form.Check
                    key={prof.id}
                    type="checkbox"
                    id={`prof-${prof.id}`}
                    label={
                      <span>
                        <strong>{prof.nombre}</strong> - Saldo: {formatearMoneda(prof.saldoPendiente || prof.saldo || 0)}
                      </span>
                    }
                    checked={profesionalesSeleccionados.includes(prof.id)}
                    onChange={() => toggleSeleccionProfesional(prof.id)}
                    disabled={loading}
                  />
                ))}
            </div>
            <small className="text-muted">
              {profesionalesSeleccionados.length} profesional(es) seleccionado(s)
            </small>
          </div>
        )}

        {/* Información del profesional seleccionado */}
        {profesionalSeleccionado && !modoMultiple && (
          <div className="alert alert-info mb-4">
            <h6 className="mb-2">📊 Información Actual</h6>
            <div className="row">
              <div className="col-md-6">
                <small className="d-block text-muted">Total asignado:</small>
                <strong>{formatearMoneda(profesionalSeleccionado.precioTotal || 0)}</strong>
              </div>
              <div className="col-md-6">
                <small className="d-block text-muted">Total pagado:</small>
                <strong className="text-success">{formatearMoneda(profesionalSeleccionado.totalPagado || 0)}</strong>
              </div>
              <div className="col-md-6 mt-2">
                <small className="d-block text-muted">Adelantos activos:</small>
                <strong className="text-warning">
                  {loadingAdelantos ? (
                    <span className="spinner-border spinner-border-sm"></span>
                  ) : (
                    formatearMoneda(montos.adelantosActivos)
                  )}
                </strong>
                {adelantosActivos.length > 0 && (
                  <Badge bg="warning" text="dark" className="ms-2">
                    {adelantosActivos.length} activo(s)
                  </Badge>
                )}
              </div>
              <div className="col-md-6 mt-2">
                <small className="d-block text-muted">Disponible para adelantar:</small>
                <strong className="text-primary">{formatearMoneda(montos.disponible)}</strong>
              </div>
            </div>
          </div>
        )}

        <hr />

        {/* Período del adelanto */}
        <div className="mb-4">
          <Form.Label className="fw-bold">📅 Período del Adelanto *</Form.Label>
          <small className="d-block text-muted mb-2">Seleccioná el período sobre el cual se calculará el adelanto</small>

          <div className="d-grid gap-2">
            {/* Adelanto Semanal */}
            <div
              className={`border rounded p-3 ${tipoAdelanto === TIPOS_ADELANTO.SEMANAL ? 'border-primary border-2 bg-light' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => setTipoAdelanto(TIPOS_ADELANTO.SEMANAL)}
            >
              <Form.Check
                type="radio"
                id="tipo-semanal"
                name="tipoAdelanto"
                label={
                  <div>
                    <strong>📅 {TIPOS_ADELANTO_LABELS[TIPOS_ADELANTO.SEMANAL]}</strong>
                    {profesionalSeleccionado && (
                      <small className="d-block text-success fw-bold mt-1">
                        💰 Monto del período: {formatearMoneda(calcularMontoEstimado(profesionalSeleccionado, TIPOS_ADELANTO.SEMANAL, 100))}
                      </small>
                    )}
                  </div>
                }
                checked={tipoAdelanto === TIPOS_ADELANTO.SEMANAL}
                onChange={() => setTipoAdelanto(TIPOS_ADELANTO.SEMANAL)}
                disabled={loading}
              />
            </div>

            {/* Adelanto Quincenal */}
            <div
              className={`border rounded p-3 ${tipoAdelanto === TIPOS_ADELANTO.QUINCENAL ? 'border-primary border-2 bg-light' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => setTipoAdelanto(TIPOS_ADELANTO.QUINCENAL)}
            >
              <Form.Check
                type="radio"
                id="tipo-quincenal"
                name="tipoAdelanto"
                label={
                  <div>
                    <strong>📅 {TIPOS_ADELANTO_LABELS[TIPOS_ADELANTO.QUINCENAL]}</strong>
                    {profesionalSeleccionado && (
                      <small className="d-block text-success fw-bold mt-1">
                        💰 Monto del período: {formatearMoneda(calcularMontoEstimado(profesionalSeleccionado, TIPOS_ADELANTO.QUINCENAL, 100))}
                      </small>
                    )}
                  </div>
                }
                checked={tipoAdelanto === TIPOS_ADELANTO.QUINCENAL}
                onChange={() => setTipoAdelanto(TIPOS_ADELANTO.QUINCENAL)}
                disabled={loading}
              />
            </div>

            {/* Adelanto Mensual */}
            <div
              className={`border rounded p-3 ${tipoAdelanto === TIPOS_ADELANTO.MENSUAL ? 'border-primary border-2 bg-light' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => setTipoAdelanto(TIPOS_ADELANTO.MENSUAL)}
            >
              <Form.Check
                type="radio"
                id="tipo-mensual"
                name="tipoAdelanto"
                label={
                  <div>
                    <strong>📅 {TIPOS_ADELANTO_LABELS[TIPOS_ADELANTO.MENSUAL]}</strong>
                    {profesionalSeleccionado && (
                      <small className="d-block text-success fw-bold mt-1">
                        💰 Monto del período: {formatearMoneda(calcularMontoEstimado(profesionalSeleccionado, TIPOS_ADELANTO.MENSUAL, 100))}
                      </small>
                    )}
                  </div>
                }
                checked={tipoAdelanto === TIPOS_ADELANTO.MENSUAL}
                onChange={() => setTipoAdelanto(TIPOS_ADELANTO.MENSUAL)}
                disabled={loading}
              />
            </div>

            {/* Adelanto Total Obra */}
            <div
              className={`border rounded p-3 ${tipoAdelanto === TIPOS_ADELANTO.TOTAL_OBRA ? 'border-primary border-2 bg-light' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => setTipoAdelanto(TIPOS_ADELANTO.TOTAL_OBRA)}
            >
              <Form.Check
                type="radio"
                id="tipo-total-obra"
                name="tipoAdelanto"
                label={
                  <div>
                    <strong>📅 {TIPOS_ADELANTO_LABELS[TIPOS_ADELANTO.TOTAL_OBRA]}</strong>
                    {profesionalSeleccionado && (
                      <small className="d-block text-success fw-bold mt-1">
                        💰 Saldo disponible: {formatearMoneda(montos.disponible)}
                      </small>
                    )}
                  </div>
                }
                checked={tipoAdelanto === TIPOS_ADELANTO.TOTAL_OBRA}
                onChange={() => setTipoAdelanto(TIPOS_ADELANTO.TOTAL_OBRA)}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <hr />

        {/* Forma de cálculo: Porcentaje o Monto Fijo */}
        <div className="mb-4">
          <Form.Label className="fw-bold">🧮 Forma de Cálculo *</Form.Label>
          <small className="d-block text-muted mb-3">¿Cómo querés calcular el monto a adelantar?</small>

          <div className="row g-3">
            <div className="col-6">
              <div
                className={`border rounded p-3 text-center ${!usarMontoFijo ? 'border-primary border-2 bg-light' : 'border-secondary'}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setUsarMontoFijo(false)}
              >
                <Form.Check
                  type="radio"
                  id="metodo-porcentaje"
                  name="metodoCalculo"
                  label={
                    <div>
                      <strong>📊 Por Porcentaje</strong>
                      <small className="d-block text-muted">Del monto del período</small>
                    </div>
                  }
                  checked={!usarMontoFijo}
                  onChange={() => setUsarMontoFijo(false)}
                  disabled={loading}
                />
              </div>
            </div>
            <div className="col-6">
              <div
                className={`border rounded p-3 text-center ${usarMontoFijo ? 'border-success border-2 bg-light' : 'border-secondary'}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setUsarMontoFijo(true)}
              >
                <Form.Check
                  type="radio"
                  id="metodo-monto-fijo"
                  name="metodoCalculo"
                  label={
                    <div>
                      <strong>💵 Monto Fijo</strong>
                      <small className="d-block text-muted">Ingresá el monto exacto</small>
                    </div>
                  }
                  checked={usarMontoFijo}
                  onChange={() => setUsarMontoFijo(true)}
                  disabled={loading}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Monto Fijo (si está seleccionado) */}
        {usarMontoFijo && (
          <div className="mb-4">
            <Form.Label className="fw-bold">💵 Monto Exacto a Adelantar *</Form.Label>
            <div className="input-group input-group-lg">
              <span className="input-group-text">$</span>
              <Form.Control
                type="number"
                min="0"
                max={montos.disponible}
                step="100"
                value={montoFijo}
                onChange={(e) => setMontoFijo(parseFloat(e.target.value) || 0)}
                disabled={loading}
                placeholder="Ingresá el monto exacto"
                className="form-control-lg"
              />
            </div>
            <small className="text-muted">
              Máximo disponible: {formatearMoneda(montos.disponible)}
            </small>
            {montoFijo > montos.disponible && (
              <div className="alert alert-warning mt-2 py-2 mb-0">
                <small>⚠️ El monto excede el saldo disponible. Se ajustará a {formatearMoneda(montos.disponible)}</small>
              </div>
            )}
          </div>
        )}

        {/* Porcentaje a adelantar (si NO es monto fijo) */}
        {!usarMontoFijo && (
        <div className="mb-4">
          <Form.Label className="fw-bold">
            Porcentaje a Adelantar: <span className="text-primary">{porcentaje}%</span>
          </Form.Label>
          <Form.Range
            min={CONFIGURACION_ADELANTOS.PORCENTAJE_MINIMO}
            max={CONFIGURACION_ADELANTOS.PORCENTAJE_MAXIMO}
            value={porcentaje}
            onChange={(e) => setPorcentaje(parseInt(e.target.value))}
            disabled={loading}
          />
          <div className="d-flex justify-content-between">
            <small className="text-muted">Mín: {CONFIGURACION_ADELANTOS.PORCENTAJE_MINIMO}%</small>
            <small className="text-muted">Máx: {CONFIGURACION_ADELANTOS.PORCENTAJE_MAXIMO}%</small>
          </div>
        </div>
        )}

        {/* Monto final calculado */}
        <div className="alert alert-success mb-4">
          <h5 className="mb-0">
            💰 Monto a Adelantar: <strong>{formatearMoneda(montos.final)}</strong>
          </h5>
        </div>

        {/* Método de pago */}
        <div className="mb-3">
          <Form.Label className="fw-bold">Método de Pago</Form.Label>
          <Form.Select
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value)}
            disabled={loading}
          >
            <option value="EFECTIVO">Efectivo</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="CHEQUE">Cheque</option>
          </Form.Select>
        </div>

        {/* Observaciones */}
        <div className="mb-3">
          <Form.Label className="fw-bold">Observaciones (opcional)</Form.Label>
          <Form.Control
            as="textarea"
            rows={2}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            disabled={loading}
            placeholder="Motivo del adelanto, acuerdos especiales, etc."
          />
        </div>

        {/* Advertencia */}
        <Alert variant="warning">
          <small>
            ⚠️ <strong>Importante:</strong> Este adelanto se descontará automáticamente de los próximos pagos semanales del profesional.
          </small>
        </Alert>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={loading}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={handleConfirmar}
          disabled={loading || !profesionalSeleccionado || montos.final <= 0}
        >
          {loading ? (
            <>
              <span className="spinner-border spinner-border-sm me-2"></span>
              Procesando...
            </>
          ) : (
            <>✅ Confirmar Adelanto</>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default DarAdelantoModal;
