import React, { useState, useEffect, useMemo } from 'react';
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
import { obtenerSaldoDisponible, listarCobrosEmpresa } from '../services/cobrosEmpresaService';
import { calcularTotalRecibido } from '../services/asignacionesCobroObraService';

/**
 * Modal para dar adelantos a profesionales
 * Soporta modo individual y modo múltiple
 */
const DarAdelantoModal = ({
  show,
  onHide,
  profesionalPreseleccionado,
  profesionalesDisponibles = [], // DEPRECATED - se mantiene por compatibilidad, pero se cargan desde el backend
  obrasSeleccionadas = [],
  empresaId,
  modoMultiple = false,
  obraDireccion,
  onSuccess
}) => {
  const { empresaSeleccionada } = useEmpresa();

  // Estados principales
  const [profesionalSeleccionado, setProfesionalSeleccionado] = useState(null);
  const [profesionalesSeleccionados, setProfesionalesSeleccionados] = useState([]);
  const [profesionalesConDatosFinancieros, setProfesionalesConDatosFinancieros] = useState([]); // Cargados desde backend
  const [loadingProfesionales, setLoadingProfesionales] = useState(false);
  const [tipoAdelanto, setTipoAdelanto] = useState(TIPOS_ADELANTO.SEMANAL);
  const [usarMontoFijo, setUsarMontoFijo] = useState(false); // Toggle entre porcentaje y monto fijo
  const [tipoSaldoSeleccionado, setTipoSaldoSeleccionado] = useState('obra'); // 'obra' | 'empresa'
  const [totalCobradoEmpresa, setTotalCobradoEmpresa] = useState(0); // Total cobrado a la tenant (asignado + sin asignar)
  const [totalCobrosAsignadosObra, setTotalCobrosAsignadosObra] = useState(0); // Total de cobros asignados a la obra actual
  const [saldoDisponibleEmpresa, setSaldoDisponibleEmpresa] = useState(0); // Saldo sin asignar a obras
  const [porcentaje, setPorcentaje] = useState(CONFIGURACION_ADELANTOS.PORCENTAJE_DEFAULT);
  const [montoFijo, setMontoFijo] = useState(null);
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [observaciones, setObservaciones] = useState('');
  const [semanaReferencia, setSemanaReferencia] = useState(null);

  // Estados de UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [advertencia, setAdvertencia] = useState(null); // Advertencias que no bloquean (ej: exceder 50%)
  const [adelantosActivos, setAdelantosActivos] = useState([]);
  const [loadingAdelantos, setLoadingAdelantos] = useState(false);

// Cargar profesionales con datos financieros usando el nuevo endpoint del backend
  const cargarProfesionalesConDatosFinancieros = async () => {
    if (!empresaSeleccionada && !empresaId) return;
    if (!obrasSeleccionadas || obrasSeleccionadas.length === 0) return;

    setLoadingProfesionales(true);
    try {
      const idEmpresa = empresaId || empresaSeleccionada.id;
      const todosLosProfesionales = [];

      // Usar el nuevo endpoint que devuelve profesionales con datos financieros calculados
      for (const obra of obrasSeleccionadas) {
        try {
          const presupuestoId = obra.id || obra.presupuestoId;
          const url = `/api/presupuestos-no-cliente/${presupuestoId}/profesionales-financieros?empresaId=${idEmpresa}`;

          const response = await fetch(url, {
            headers: {
              'empresaId': idEmpresa.toString(),
              'X-Tenant-ID': idEmpresa.toString()
            }
          });

          if (!response.ok) {
            console.warn(`No se pudieron cargar profesionales para presupuesto ${presupuestoId}`);
            continue;
          }

          const profesionales = await response.json();

          // Los datos financieros ya vienen calculados del backend
          profesionales.forEach(prof => {
            todosLosProfesionales.push({
              ...prof,
              diasTrabajados: prof.cantidadJornales
            });
          });
        } catch (err) {
          console.error(`Error cargando profesionales para obra ${obra.nombreObra}:`, err);
        }
      }

      setProfesionalesConDatosFinancieros(todosLosProfesionales);
    } catch (error) {
      console.error('Error cargando profesionales:', error);
      setProfesionalesConDatosFinancieros([]);
    } finally {
      setLoadingProfesionales(false);
    }
  };

  // Cargar datos financieros de la empresa (total cobrado + saldo sin asignar)
  useEffect(() => {
    const cargarDatosFinancierosEmpresa = async () => {
      if (!show || (!empresaSeleccionada && !empresaId)) return;

      try {
        const idEmpresa = empresaId || empresaSeleccionada.id;

        // 1️⃣ Obtener TODOS los cobros de la tenant (asignados y sin asignar)
        const cobros = await listarCobrosEmpresa(idEmpresa);
        const totalCobrado = cobros.reduce((sum, cobro) => {
          // Sumar solo cobros activos (no anulados)
          if (cobro.estado !== 'ANULADO') {
            return sum + (cobro.montoTotal || cobro.monto || 0);
          }
          return sum;
        }, 0);

        // 2️⃣ Obtener saldo disponible (sin asignar a obras)
        const saldoDisponible = await obtenerSaldoDisponible(idEmpresa);

        console.log('💼 Datos financieros de la empresa:', {
          totalCobrado,
          saldoDisponible,
          cantidadCobros: cobros.length
        });

        setTotalCobradoEmpresa(totalCobrado || 0);
        setSaldoDisponibleEmpresa(saldoDisponible || 0);
      } catch (err) {
        console.error('Error cargando datos financieros de la empresa:', err);
        setTotalCobradoEmpresa(0);
        setSaldoDisponibleEmpresa(0);
      }
    };

    cargarDatosFinancierosEmpresa();
  }, [show, empresaSeleccionada, empresaId]);

  // Cargar total de cobros asignados a las obras seleccionadas
  useEffect(() => {
    const cargarCobrosAsignadosObras = async () => {
      if (!show || (!empresaSeleccionada && !empresaId)) return;
      if (!obrasSeleccionadas || obrasSeleccionadas.length === 0) return;

      try {
        const idEmpresa = empresaId || empresaSeleccionada.id;
        let totalAsignado = 0;

        // Sumar el total de cobros asignados a cada obra seleccionada
        for (const obra of obrasSeleccionadas) {
          const obraId = obra.id || obra.presupuestoId;
          const totalObra = await calcularTotalRecibido(obraId, idEmpresa);
          totalAsignado += totalObra;
        }

        console.log('🏢 Total de cobros asignados a obras seleccionadas:', {
          cantidadObras: obrasSeleccionadas.length,
          totalAsignado
        });

        setTotalCobrosAsignadosObra(totalAsignado || 0);
      } catch (err) {
        console.error('Error cargando cobros asignados a obras:', err);
        setTotalCobrosAsignadosObra(0);
      }
    };

    cargarCobrosAsignadosObras();
  }, [show, empresaSeleccionada, empresaId, obrasSeleccionadas]);

  // Inicializar con profesional preseleccionado
  useEffect(() => {
    if (show && (empresaSeleccionada || empresaId) && obrasSeleccionadas?.length > 0) {
      // Cargar profesionales con datos financieros al abrir el modal
      cargarProfesionalesConDatosFinancieros();

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
      setTipoSaldoSeleccionado('obra');
      setPorcentaje(CONFIGURACION_ADELANTOS.PORCENTAJE_DEFAULT);
      setMontoFijo(null);
      setMetodoPago('EFECTIVO');
      setObservaciones('');
      setSemanaReferencia(null);
      setError(null);
      setAdvertencia(null);
      setProfesionalesSeleccionados([]);
    }
  }, [show, profesionalPreseleccionado, empresaId, obrasSeleccionadas]); // eslint-disable-line react-hooks/exhaustive-deps

  // Determinar qué lista de profesionales usar
  // Prioridad: profesionalesConDatosFinancieros (cargados desde backend) > profesionalesDisponibles (legacy)
  const profesionalesParaMostrar = useMemo(() => {
    if (profesionalesConDatosFinancieros.length > 0) {
      return profesionalesConDatosFinancieros;
    }
    return profesionalesDisponibles;
  }, [profesionalesConDatosFinancieros, profesionalesDisponibles]);

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
    // 🔄 MODO MÚLTIPLE: Calcular para todos los profesionales seleccionados
    if (modoMultiple && profesionalesSeleccionados.length > 0) {
      let totalEstimado = 0;

      profesionalesSeleccionados.forEach(profId => {
        const prof = profesionalesParaMostrar.find(p => p.id === profId);
        if (prof) {
          totalEstimado += calcularMontoEstimado(prof, tipoAdelanto, 100);
        }
      });

      // Seleccionar dinero disponible según la opción del usuario
      // 🏢 'obra' = dinero de cobros asignados a las obras seleccionadas
      // 💼 'empresa' = total cobrado a la tenant (asignado + sin asignar)
      let disponibleFinal = tipoSaldoSeleccionado === 'empresa'
        ? totalCobradoEmpresa
        : totalCobrosAsignadosObra;

      let montoFinal = 0;
      if (usarMontoFijo) {
        montoFinal = Math.min(montoFijo ?? 0, disponibleFinal);
      } else {
        montoFinal = Math.min((totalEstimado * porcentaje / 100), disponibleFinal);
      }

      return {
        estimado: totalEstimado,
        final: Math.max(0, montoFinal),
        disponible: Math.max(0, disponibleFinal),
        disponibleObra: Math.max(0, totalCobrosAsignadosObra),
        disponibleEmpresa: Math.max(0, totalCobradoEmpresa),
        adelantosActivos: 0
      };
    }

    // 👤 MODO INDIVIDUAL: Calcular para un solo profesional
    if (!profesionalSeleccionado) return {
      estimado: 0,
      final: 0,
      disponible: 0,
      disponibleObra: 0,
      disponibleEmpresa: 0
    };

    // Calcular monto estimado según el período seleccionado
    const montoEstimado = calcularMontoEstimado(profesionalSeleccionado, tipoAdelanto, 100);

    // Seleccionar dinero disponible según la opción del usuario
    // 🏢 'obra' = dinero de cobros asignados a las obras seleccionadas
    // 💼 'empresa' = total cobrado a la tenant (asignado + sin asignar)
    let disponible = tipoSaldoSeleccionado === 'empresa'
      ? totalCobradoEmpresa
      : totalCobrosAsignadosObra;

    let montoFinal = 0;
    if (usarMontoFijo) {
      // Usuario ingresó monto fijo específico
      montoFinal = Math.min(montoFijo ?? 0, disponible);
    } else {
      // Usuario usa porcentaje sobre el estimado del período
      montoFinal = Math.min((montoEstimado * porcentaje / 100), disponible);
    }

    const totalAdelantosActivos = adelantosActivos.reduce((sum, a) => sum + (a.saldoAdelantoPorDescontar || 0), 0);

    return {
      estimado: montoEstimado,
      final: Math.max(0, montoFinal),
      disponible: Math.max(0, disponible),
      disponibleObra: Math.max(0, totalCobrosAsignadosObra),
      disponibleEmpresa: Math.max(0, totalCobradoEmpresa),
      adelantosActivos: totalAdelantosActivos
    };
  };

  const montos = calcularMontos();

  // Manejar cambio de profesional (modo selector)
  const handleProfesionalChange = (profesionalId) => {
    const profesional = profesionalesParaMostrar.find(p => p.id === profesionalId);
    setProfesionalSeleccionado(profesional);
    if (profesional) {
      cargarAdelantosActivos(profesional);
    }
  };

  // Toggle selección múltiple
  const toggleSeleccionProfesional = (profesionalId) => {
    // Limpiar error al seleccionar/deseleccionar
    setError(null);

    if (profesionalesSeleccionados.includes(profesionalId)) {
      setProfesionalesSeleccionados(prev => prev.filter(id => id !== profesionalId));
    } else {
      setProfesionalesSeleccionados(prev => [...prev, profesionalId]);
    }
  };

  // Seleccionar/deseleccionar todos los profesionales
  const toggleSeleccionarTodos = () => {
    // Limpiar error al seleccionar todos
    setError(null);

    if (profesionalesSeleccionados.length === profesionalesParaMostrar.length) {
      // Si todos están seleccionados, deseleccionar todos
      setProfesionalesSeleccionados([]);
    } else {
      // Seleccionar todos
      setProfesionalesSeleccionados(profesionalesParaMostrar.map(p => p.id));
    }
  };

  // Calcular cuánto puede cobrar cada profesional según el período seleccionado
  const calcularMontoDisponiblePorPeriodo = (profesional) => {
    if (!profesional) return 0;

    // Usar calcularMontoEstimado del servicio para calcular según el período
    const montoEstimado = calcularMontoEstimado(profesional, tipoAdelanto, 100);

    // El monto disponible es el menor entre lo estimado y el saldo pendiente
    const saldoPendiente = profesional.saldoPendiente || profesional.saldo || 0;
    return Math.min(montoEstimado, saldoPendiente);
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

    // Validación con el servicio (solo en modo individual)
    if (!modoMultiple) {
      const validacion = validarAdelanto(profesionalSeleccionado, montos.final);
      if (!validacion.valido) {
        setError(validacion.errores.join('. '));
        return;
      }

      // Mostrar advertencias si excede el 50% (no bloquea)
      if (validacion.advertencias && validacion.advertencias.length > 0) {
        setAdvertencia(validacion.advertencias.join(' '));
      } else {
        setAdvertencia(null);
      }
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
          const prof = profesionalesParaMostrar.find(p => p.id === profId);
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

        const response = await registrarAdelanto({
          profesionalObraId: profesionalSeleccionado.profesionalObraId,
          tipoAdelanto,
          montoAdelanto: montos.final,
          metodoPago,
          observaciones,
          semanaReferencia
        }, empresaSeleccionada.id);

        // Verificar si el backend retornó advertencia por exceder el 50%
        const mensajeExito = `✅ Adelanto registrado exitosamente para ${profesionalSeleccionado.nombre}`;
        if (response?.excedeLimiteRecomendado && response?.advertencia) {
          alert(`${mensajeExito}\n\n⚠️ ${response.advertencia}`);
        } else {
          alert(mensajeExito);
        }
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

        {advertencia && (
          <Alert variant="warning" onClose={() => setAdvertencia(null)} dismissible>
            <strong>⚠️ Advertencia:</strong> {advertencia}
            <div className="mt-2 small">
              <em>Puedes continuar, pero está excediendo el límite recomendado del 50%.</em>
            </div>
          </Alert>
        )}

        {/* Selector de profesional (si no está preseleccionado) */}
        {!profesionalPreseleccionado && !modoMultiple && (
          <div className="mb-4">
            <Form.Label className="fw-bold">Seleccionar Profesional *</Form.Label>
            <Form.Select
              value={profesionalSeleccionado?.id || ''}
              onChange={(e) => handleProfesionalChange(e.target.value)}
              disabled={loading || loadingProfesionales}
            >
              <option value="">-- Seleccione un profesional --</option>
              {profesionalesParaMostrar.map(prof => {
                const montoDisponible = calcularMontoDisponiblePorPeriodo(prof);
                return (
                  <option key={prof.id} value={prof.id} disabled={montoDisponible <= 0}>
                    {prof.nombre} - Puede cobrar: {formatearMoneda(montoDisponible)} ({prof.nombreObra || 'Sin obra'})
                  </option>
                );
              })}
            </Form.Select>
          </div>
        )}

        {/* Modo múltiple: Lista con checkboxes */}
        {modoMultiple && (
          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div>
                <Form.Label className="fw-bold mb-0">Seleccionar Profesionales *</Form.Label>
                <br />
                <small className="text-muted">
                  Mostrando importes disponibles para cada período
                </small>
              </div>
              {profesionalesParaMostrar.length > 0 && (
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={toggleSeleccionarTodos}
                  disabled={loading || loadingProfesionales}
                >
                  {profesionalesSeleccionados.length === profesionalesParaMostrar.length
                    ? '☑ Deseleccionar todos'
                    : '☐ Seleccionar todos'}
                </Button>
              )}
            </div>
            <div className="border rounded p-2" style={{ maxHeight: '400px', overflowY: 'auto', overflowX: 'auto' }}>
              {loadingProfesionales ? (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary mb-2" role="status">
                    <span className="visually-hidden">Cargando...</span>
                  </div>
                  <p className="text-muted mb-0">Cargando profesionales...</p>
                </div>
              ) : profesionalesParaMostrar.length === 0 ? (
                <div className="text-center py-4">
                  <div className="text-muted mb-2">
                    <i className="bi bi-info-circle" style={{ fontSize: '2rem' }}></i>
                  </div>
                  <p className="text-muted mb-2">
                    <strong>No hay profesionales disponibles</strong>
                  </p>
                  <small className="text-muted">
                    Asegurate de tener obras seleccionadas con profesionales asignados.
                  </small>
                </div>
              ) : (
                <table className="table table-sm table-hover mb-0" style={{ fontSize: '0.875rem' }}>
                  <thead className="table-light sticky-top" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr>
                      <th style={{ width: '40px' }} className="text-center">
                        <Form.Check
                          type="checkbox"
                          checked={profesionalesSeleccionados.length === profesionalesParaMostrar.length && profesionalesParaMostrar.length > 0}
                          onChange={toggleSeleccionarTodos}
                          disabled={loading}
                        />
                      </th>
                      <th style={{ minWidth: '150px' }}>Profesional / Obra</th>
                      <th className="text-end" style={{ minWidth: '100px' }}>
                        📅 Semanal<br />
                        <small className="text-muted fw-normal">(5 días)</small>
                      </th>
                      <th className="text-end" style={{ minWidth: '100px' }}>
                        📅 Quincenal<br />
                        <small className="text-muted fw-normal">(10 días)</small>
                      </th>
                      <th className="text-end" style={{ minWidth: '100px' }}>
                        📅 Mensual<br />
                        <small className="text-muted fw-normal">(22 días)</small>
                      </th>
                      <th className="text-end" style={{ minWidth: '110px' }}>
                        📅 Total Obra<br />
                        <small className="text-muted fw-normal">(Todos los jornales)</small>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {profesionalesParaMostrar.map(prof => {
                      // Calcular lo que debe cobrar por período (jornal × días)
                      const precioJornal = prof.precioJornal || 0;
                      const cantidadJornales = prof.cantidadJornales || 0;

                      // 1 semana = 5 días laborables
                      const montoSemanal = precioJornal * 5;

                      // 2 semanas = 10 días laborables
                      const montoQuincenal = precioJornal * 10;

                      // 1 mes = 22 días laborables
                      const montoMensual = precioJornal * 22;

                      // Total obra = todos los jornales asignados
                      const montoTotalObra = precioJornal * cantidadJornales;

                      const tieneAlgunMonto = montoSemanal > 0 || montoQuincenal > 0 || montoMensual > 0 || montoTotalObra > 0;

                      return (
                        <tr
                          key={prof.id}
                          className={profesionalesSeleccionados.includes(prof.id) ? 'table-active' : ''}
                        >
                          <td className="text-center align-middle">
                            <Form.Check
                              type="checkbox"
                              id={`prof-${prof.id}`}
                              checked={profesionalesSeleccionados.includes(prof.id)}
                              onChange={() => toggleSeleccionProfesional(prof.id)}
                              disabled={loading}
                            />
                          </td>
                          <td className="align-middle">
                            <div>
                              <strong className="text-dark">{prof.nombre}</strong>
                              {!tieneAlgunMonto && (
                                <Badge bg="warning" text="dark" className="ms-2" style={{ fontSize: '0.65rem' }}>
                                  Sin precio jornal
                                </Badge>
                              )}
                              <br />
                              <small className="text-muted">
                                {prof.nombreObra || 'N/A'}
                              </small>
                              <br />
                              <small className="text-muted">
                                {cantidadJornales} {cantidadJornales === 1 ? 'jornal' : 'jornales'} × {formatearMoneda(precioJornal)}
                              </small>
                            </div>
                          </td>
                          <td className="text-end align-middle">
                            <span className={montoSemanal > 0 ? 'text-success fw-bold' : 'text-secondary'}>
                              {formatearMoneda(montoSemanal)}
                            </span>
                          </td>
                          <td className="text-end align-middle">
                            <span className={montoQuincenal > 0 ? 'text-success fw-bold' : 'text-secondary'}>
                              {formatearMoneda(montoQuincenal)}
                            </span>
                          </td>
                          <td className="text-end align-middle">
                            <span className={montoMensual > 0 ? 'text-success fw-bold' : 'text-secondary'}>
                              {formatearMoneda(montoMensual)}
                            </span>
                          </td>
                          <td className="text-end align-middle">
                            <span className={montoTotalObra > 0 ? 'text-success fw-bold' : 'text-secondary'}>
                              {formatearMoneda(montoTotalObra)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
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
                value={montoFijo ?? ''}
                onChange={(e) => setMontoFijo(e.target.value === '' ? null : Number(e.target.value))}
                disabled={loading}
                placeholder="Ingresá el monto exacto"
                className="form-control-lg"
              />
            </div>
            <small className="text-muted">
              Máximo disponible: {formatearMoneda(montos.disponible)}
            </small>

{/* 💰 Selector de origen del dinero para el adelanto */}
            <div className="mt-3 p-3 bg-light rounded border">
              <div className="mb-3">
                <small className="fw-bold text-muted d-block mb-2">💰 Origen del Dinero para el Adelanto</small>

                {/* Radio buttons para seleccionar tipo de saldo */}
                <div className="d-flex flex-column gap-2">
                  <Form.Check
                    type="radio"
                    id="saldo-obra"
                    name="tipoSaldo"
                    label="🏢 Usar cobros asignados a las obras"
                    checked={tipoSaldoSeleccionado === 'obra'}
                    onChange={() => setTipoSaldoSeleccionado('obra')}
                  />
                  <Form.Check
                    type="radio"
                    id="saldo-empresa"
                    name="tipoSaldo"
                    label="💼 Usar total cobrado a la tenant"
                    checked={tipoSaldoSeleccionado === 'empresa'}
                    onChange={() => setTipoSaldoSeleccionado('empresa')}
                  />
                </div>
              </div>

              {/* Mostrar los 2 saldos disponibles */}
              <div className="row g-2">
                <div className="col-6">
                  <div className={`p-2 rounded ${tipoSaldoSeleccionado === 'obra' ? 'bg-primary bg-opacity-10 border border-primary' : 'bg-white border'}` }>
                    <small className="d-block text-muted" style={{fontSize: '0.7rem'}}>🏢 Cobros a obras</small>
                    <strong className="d-block" style={{fontSize: '0.9rem'}}>
                      {formatearMoneda(montos.disponibleObra)}
                    </strong>
                  </div>
                </div>
                <div className="col-6">
                  <div className={`p-2 rounded ${tipoSaldoSeleccionado === 'empresa' ? 'bg-warning bg-opacity-10 border border-warning' : 'bg-white border'}` }>
                    <small className="d-block text-muted" style={{fontSize: '0.7rem'}}>💼 Total tenant</small>
                    <strong className="d-block" style={{fontSize: '0.9rem'}}>
                      {formatearMoneda(montos.disponibleEmpresa)}
                    </strong>
                  </div>
                </div>
              </div>

              <small className="text-muted d-block mt-2" style={{fontSize: '0.7rem'}}>
                💡 <strong>Cobros a obras:</strong> Dinero de cobros asignados a las obras seleccionadas.<br/>
                💡 <strong>Total tenant:</strong> Todo el dinero cobrado a la tenant (incluye asignado + sin asignar).
              </small>
            </div>

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
          disabled={
            loading ||
            montos.final <= 0 ||
            (modoMultiple ? profesionalesSeleccionados.length === 0 : !profesionalSeleccionado)
          }
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
