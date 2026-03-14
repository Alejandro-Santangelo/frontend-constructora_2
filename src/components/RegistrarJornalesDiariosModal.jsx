import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Table, Spinner, Alert, Badge } from 'react-bootstrap';
import { useEmpresa } from '../EmpresaContext';
import * as jornalesService from '../services/jornalesDiariosService';
import { obtenerRubrosActivosPorObra } from '../services/jornalesDiariosService';
import { listarAsignaciones } from '../services/profesionalesObraService';
import api from '../services/api';

/**
 * Modal para registrar jornales diarios de profesionales en una obra
 * Muestra los profesionales asignados y permite ingresar horas trabajadas
 */
const RegistrarJornalesDiariosModal = ({ show, onHide, obra, onJornalCreado, onAbrirAsignarProfesionales }) => {
  const { empresaSeleccionada } = useEmpresa();

  // Estados
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [profesionalesAsignados, setProfesionalesAsignados] = useState([]);
  const [jornalesDelDia, setJornalesDelDia] = useState({});
  const [jornalesExistentes, setJornalesExistentes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Nuevos estados para selector de profesionales
  const [vistaSeleccion, setVistaSeleccion] = useState(false);
  const [todosProfesionales, setTodosProfesionales] = useState([]);
  const [profesionalesSeleccionados, setProfesionalesSeleccionados] = useState([]);
  const [asignacionesPorProfesional, setAsignacionesPorProfesional] = useState({});

  // Estado para rubros del presupuesto de la obra
  const [rubros, setRubros] = useState([]);

  // NUEVO: Estados para multi-fecha
  const [fechasPorProfesional, setFechasPorProfesional] = useState({}); // { profesionalId: [{ fecha, fraccion }] }
  const [profesionalEditandoFechas, setProfesionalEditandoFechas] = useState(null);
  const [nuevaFecha, setNuevaFecha] = useState('');

  // Cargar profesionales asignados a la obra
  useEffect(() => {
    if (show && obra && empresaSeleccionada) {
      cargarProfesionalesAsignados();
      cargarRubros();
    }
  }, [show, obra, empresaSeleccionada]);

  // Cargar jornales existentes cuando cambia la fecha
  useEffect(() => {
    if (show && obra && empresaSeleccionada && fecha) {
      cargarJornalesExistentes();
    }
  }, [fecha, show, obra, empresaSeleccionada]);

  const cargarProfesionalesAsignados = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listarAsignaciones(empresaSeleccionada.id);
      const asignaciones = Array.isArray(response) ? response : (response?.data || []);

      // Filtrar solo los de esta obra
      const asignacionesObra = asignaciones.filter(a => a.obraId === obra.id && a.activo);

      setProfesionalesAsignados(asignacionesObra);
      console.log(`✅ ${asignacionesObra.length} profesionales asignados a la obra`);
    } catch (err) {
      console.error('❌ Error al cargar profesionales:', err);
      setError('No se pudieron cargar los profesionales asignados');
    } finally {
      setLoading(false);
    }
  };

  const cargarRubros = async () => {
    if (!obra?.id) return;
    try {
      const lista = await obtenerRubrosActivosPorObra(obra.id, empresaSeleccionada.id);
      setRubros(lista);
      console.log(`✅ ${lista.length} rubros cargados para la obra ${obra.id}`);
    } catch (err) {
      console.warn('⚠️ No se pudieron cargar los rubros:', err);
      setRubros([]);
    }
  };

  const cargarJornalesExistentes = async () => {    try {
      const fechaDesde = fecha;
      const fechaHasta = fecha;
      const response = await jornalesService.listarJornalesPorFechas(fechaDesde, fechaHasta, empresaSeleccionada.id);
      const jornales = Array.isArray(response) ? response : (response?.data || []);

      // Filtrar solo los de esta obra
      const jornalesObra = jornales.filter(j => j.obraId === obra.id);
      setJornalesExistentes(jornalesObra);

      // Pre-llenar el formulario con los jornales existentes
      const jornalesMap = {};
      jornalesObra.forEach(j => {
        jornalesMap[j.profesionalId] = {
          horasTrabajadasDecimal: j.horasTrabajadasDecimal,
          observaciones: j.observaciones || '',
          id: j.id
        };
      });
      setJornalesDelDia(jornalesMap);

      if (jornalesObra.length > 0) {
        console.log(`📋 ${jornalesObra.length} jornales ya registrados para ${fecha}`);
      }
    } catch (err) {
      console.error('❌ Error al cargar jornales existentes:', err);
    }
  };

  const cargarTodosProfesionales = async () => {
    console.log('🔥 cargarTodosProfesionales() - INICIANDO con empresaId:', empresaSeleccionada?.id);
    setLoading(true);
    try {
      // Cargar profesionales
      const response = await api.profesionales.getAll(empresaSeleccionada.id);
      const profesionales = Array.isArray(response) ? response : (response?.data || []);
      setTodosProfesionales(profesionales);
      console.log(`✅ ${profesionales.length} profesionales disponibles en la empresa`);

      // Cargar todas las asignaciones de profesionales a obras
      try {
        const asignacionesResponse = await listarAsignaciones(empresaSeleccionada.id);
        const asignaciones = Array.isArray(asignacionesResponse) ? asignacionesResponse : (asignacionesResponse?.data || []);

        // Crear un mapa: profesionalId -> [obras con fechas]
        const mapaAsignaciones = {};
        asignaciones.forEach(asig => {
          if (asig.activo && asig.profesionalId) {
            if (!mapaAsignaciones[asig.profesionalId]) {
              mapaAsignaciones[asig.profesionalId] = [];
            }

            // Agregar cada asignación con sus fechas (puede haber múltiples asignaciones a la misma obra en diferentes períodos)
            mapaAsignaciones[asig.profesionalId].push({
              obraId: asig.obraId,
              obraNombre: asig.obraNombre || `Obra ${asig.obraId}`,
              fechaInicio: asig.fechaInicio,
              fechaFin: asig.fechaFin,
              semana: asig.semana,
              anio: asig.anio,
              asignacionId: asig.id
            });
          }
        });

        setAsignacionesPorProfesional(mapaAsignaciones);
        console.log(`✅ Asignaciones de profesionales cargadas:`, mapaAsignaciones);
      } catch (errAsig) {
        console.warn('⚠️ No se pudieron cargar las asignaciones:', errAsig);
        setAsignacionesPorProfesional({});
      }
    } catch (err) {
      console.error('❌ Error al cargar profesionales:', err);
      setError('No se pudieron cargar los profesionales disponibles');
    } finally {
      setLoading(false);
    }
  };

  const handleAbrirSelectorProfesionales = () => {
    setVistaSeleccion(true);
    cargarTodosProfesionales();
  };

  const handleVolverAFormulario = () => {
    setVistaSeleccion(false);
    setProfesionalesSeleccionados([]);
    // Recargar profesionales asignados y jornales
    cargarProfesionalesAsignados();
    cargarJornalesExistentes();
  };

  const handleSeleccionarProfesional = (profesional) => {
    if (profesionalesSeleccionados.find(p => p.id === profesional.id)) {
      // Deseleccionar
      setProfesionalesSeleccionados(prev => prev.filter(p => p.id !== profesional.id));
      // NUEVO: Limpiar fechas del profesional
      setFechasPorProfesional(prev => {
        const nuevo = { ...prev };
        delete nuevo[profesional.id];
        return nuevo;
      });
    } else {
      // Seleccionar con fracción por defecto 1.0 y tarifa
      setProfesionalesSeleccionados(prev => [...prev, {
        ...profesional,
        horasTrabajadasDecimal: 1.0,
        observaciones: '',
        tarifaDiaria: profesional.honorario || 0 // Usar honorario si existe, sino 0
      }]);
      // NUEVO: Inicializar con fecha actual por defecto
      setFechasPorProfesional(prev => ({
        ...prev,
        [profesional.id]: [{ fecha: fecha, fraccion: 1.0 }]
      }));
    }
  };

  const handleCambiarFraccionSeleccionado = (profesionalId, fraccion) => {
    setProfesionalesSeleccionados(prev =>
      prev.map(p => p.id === profesionalId ? { ...p, horasTrabajadasDecimal: parseFloat(fraccion) } : p)
    );
  };

  const handleCambiarTarifaSeleccionado = (profesionalId, tarifa) => {
    setProfesionalesSeleccionados(prev =>
      prev.map(p => p.id === profesionalId ? { ...p, tarifaDiaria: parseFloat(tarifa) || 0 } : p)
    );
  };

  const handleCambiarRubroSeleccionado = (profesionalId, rubroId) => {
    setProfesionalesSeleccionados(prev =>
      prev.map(p => p.id === profesionalId ? { ...p, rubroId: rubroId ? parseInt(rubroId) : null } : p)
    );
  };

  // NUEVO: Handlers para multi-fecha
  const handleAbrirSelectorFechas = (profesionalId) => {
    setProfesionalEditandoFechas(profesionalId);
    setNuevaFecha(fecha); // Usar fecha actual como default
  };

  const handleAgregarFecha = () => {
    if (!nuevaFecha || !profesionalEditandoFechas) return;

    setFechasPorProfesional(prev => {
      const fechasActuales = prev[profesionalEditandoFechas] || [];

      // Verificar si la fecha ya existe
      if (fechasActuales.some(f => f.fecha === nuevaFecha)) {
        alert('Esta fecha ya está seleccionada para este profesional');
        return prev;
      }

      return {
        ...prev,
        [profesionalEditandoFechas]: [...fechasActuales, { fecha: nuevaFecha, fraccion: 1.0 }]
      };
    });

    setNuevaFecha('');
  };

  const handleEliminarFecha = (profesionalId, fechaAEliminar) => {
    setFechasPorProfesional(prev => ({
      ...prev,
      [profesionalId]: (prev[profesionalId] || []).filter(f => f.fecha !== fechaAEliminar)
    }));
  };

  const handleCambiarFraccionFecha = (profesionalId, fecha, nuevaFraccion) => {
    setFechasPorProfesional(prev => ({
      ...prev,
      [profesionalId]: (prev[profesionalId] || []).map(f =>
        f.fecha === fecha ? { ...f, fraccion: parseFloat(nuevaFraccion) } : f
      )
    }));
  };

  const handleGuardarProfesionalesSeleccionados = async () => {
    if (profesionalesSeleccionados.length === 0) {
      setError('Debes seleccionar al menos un profesional');
      return;
    }

    // Validar que todos los profesionales tengan tarifa configurada
    const profesionalesSinTarifa = profesionalesSeleccionados.filter(p => !p.tarifaDiaria || p.tarifaDiaria === 0);
    if (profesionalesSinTarifa.length > 0) {
      const nombres = profesionalesSinTarifa.map(p => p.nombre).join(', ');
      setError(`Los siguientes profesionales no tienen tarifa configurada: ${nombres}. Por favor, especifica una tarifa diaria.`);
      return;
    }

    // Validar que todos los profesionales tengan rubro seleccionado (solo si hay rubros disponibles)
    if (rubros.length > 0) {
      const profesionalesSinRubro = profesionalesSeleccionados.filter(p => !p.rubroId);
      if (profesionalesSinRubro.length > 0) {
        const nombres = profesionalesSinRubro.map(p => p.nombre).join(', ');
        setError(`Debes seleccionar un rubro para: ${nombres}`);
        return;
      }
    }

    // NUEVO: Validar que todos los profesionales seleccionados tengan al menos una fecha
    const profesionalesSinFechas = profesionalesSeleccionados.filter(p => !fechasPorProfesional[p.id] || fechasPorProfesional[p.id].length === 0);
    if (profesionalesSinFechas.length > 0) {
      const nombres = profesionalesSinFechas.map(p => p.nombre).join(', ');
      setError(`Debes agregar al menos una fecha para: ${nombres}`);
      return;
    }

    setGuardando(true);
    setError(null);
    setSuccess(null);

    try {
      console.log('🔍 Guardando jornales - Datos de entrada:', {
        profesionalesSeleccionados,
        fechasPorProfesional,
        obra,
        empresaSeleccionada,
        jornalesExistentes
      });

      // NUEVO: Crear jornales para cada combinación profesional-fecha
      const jornalesAGuardar = [];
      profesionalesSeleccionados.forEach(prof => {
        const fechasProf = fechasPorProfesional[prof.id] || [];
        fechasProf.forEach(({ fecha: fechaJornal, fraccion }) => {
          const jornal = {
            profesionalId: prof.id,
            obraId: obra.id,
            rubroId: prof.rubroId || null,
            fecha: fechaJornal,
            horasTrabajadasDecimal: fraccion,
            observaciones: prof.observaciones || null
          };

          // Agregar tarifa si existe y es distinta de 0
          if (prof.tarifaDiaria && prof.tarifaDiaria > 0) {
            jornal.tarifaDiaria = prof.tarifaDiaria;
          }

          jornalesAGuardar.push(jornal);
        });
      });

      console.log('📋 Jornales a guardar (total: ' + jornalesAGuardar.length + '):', jornalesAGuardar);

      let creados = 0;
      let actualizados = 0;
      let errores = 0;

      for (const jornal of jornalesAGuardar) {
        try {
          console.log(`🔍 Procesando jornal para profesional ${jornal.profesionalId} en fecha ${jornal.fecha}:`, jornal);
          console.log(`🔍 ¿Tiene tarifaDiaria?:`, jornal.tarifaDiaria);

          // Verificar si ya existe un jornal para este profesional en esta fecha
          const jornalExistente = jornalesExistentes.find(
            j => j.profesionalId === jornal.profesionalId && j.fecha === jornal.fecha && j.obraId === jornal.obraId
          );

          if (jornalExistente) {
            console.log(`🔄 Actualizando jornal existente (ID: ${jornalExistente.id}) para profesional ${jornal.profesionalId}`);
            await jornalesService.actualizarJornalDiario(jornalExistente.id, jornal, empresaSeleccionada.id);
            actualizados++;
          } else {
            console.log(`➕ Creando nuevo jornal para profesional ${jornal.profesionalId}`);
            await jornalesService.crearJornalDiario(jornal, empresaSeleccionada.id);
            creados++;
          }
        } catch (err) {
          console.error(`❌ Error al guardar jornal para profesional ${jornal.profesionalId}:`, err);
          errores++;
        }
      }

      if (errores === 0) {
        setSuccess(`✅ Jornales guardados: ${creados} nuevos, ${actualizados} actualizados`);

        // Notificar al componente padre
        if (onJornalCreado) onJornalCreado();

        // Cerrar el modal después de 1.5 segundos
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        setError(`⚠️ Se guardaron algunos jornales (${creados} nuevos, ${actualizados} actualizados) pero ${errores} tuvieron errores`);
      }
    } catch (err) {
      console.error('❌ Error al guardar jornales:', err);
      setError(err.message || err.response?.data?.message || 'Error al guardar los jornales');
    } finally {
      setGuardando(false);
    }
  };

  const handleHorasChange = (profesionalId, horas) => {
    setJornalesDelDia(prev => ({
      ...prev,
      [profesionalId]: {
        ...prev[profesionalId],
        horasTrabajadasDecimal: horas
      }
    }));
  };

  const handleObservacionesChange = (profesionalId, observaciones) => {
    setJornalesDelDia(prev => ({
      ...prev,
      [profesionalId]: {
        ...prev[profesionalId],
        observaciones: observaciones
      }
    }));
  };

  const handleGuardar = async () => {
    setGuardando(true);
    setError(null);
    setSuccess(null);

    try {
      const jornalesAGuardar = Object.entries(jornalesDelDia)
        .filter(([_, data]) => data.horasTrabajadasDecimal && parseFloat(data.horasTrabajadasDecimal) > 0)
        .map(([profesionalId, data]) => ({
          profesionalId: parseInt(profesionalId),
          obraId: obra.id,
          fecha: fecha,
          horasTrabajadasDecimal: parseFloat(data.horasTrabajadasDecimal),
          observaciones: data.observaciones || null
        }));

      if (jornalesAGuardar.length === 0) {
        setError('Debe ingresar al menos un jornal con horas trabajadas');
        setGuardando(false);
        return;
      }

      let creados = 0;
      let actualizados = 0;
      let errores = 0;

      for (const jornal of jornalesAGuardar) {
        try {
          // Verificar si ya existe un jornal para ese profesional en esa fecha
          const jornalExistente = jornalesExistentes.find(
            j => j.profesionalId === jornal.profesionalId && j.fecha === jornal.fecha
          );

          if (jornalExistente) {
            // Actualizar
            await jornalesService.actualizarJornalDiario(
              jornalExistente.id,
              jornal,
              empresaSeleccionada.id
            );
            actualizados++;
          } else {
            // Crear nuevo
            await jornalesService.crearJornalDiario(jornal, empresaSeleccionada.id);
            creados++;
          }
        } catch (err) {
          console.error('❌ Error al guardar jornal:', err);
          errores++;
        }
      }

      if (errores === 0) {
        setSuccess(`✅ Jornales guardados: ${creados} nuevos, ${actualizados} actualizados`);
        if (onJornalCreado) {
          onJornalCreado();
        }
        setTimeout(() => {
          onHide();
        }, 1500);
      } else {
        setError(`⚠️ Se guardaron algunos jornales pero ${errores} tuvieron errores`);
      }
    } catch (err) {
      console.error('❌ Error al guardar jornales:', err);
      setError('Error al guardar los jornales: ' + (err.message || 'Error desconocido'));
    } finally {
      setGuardando(false);
    }
  };

  const handleClose = () => {
    setJornalesDelDia({});
    setJornalesExistentes([]);
    setError(null);
    setSuccess(null);
    setVistaSeleccion(false);
    setProfesionalesSeleccionados([]);
    setRubros([]);
    // NUEVO: Limpiar estados de multi-fecha
    setFechasPorProfesional({});
    setProfesionalEditandoFechas(null);
    setNuevaFecha('');
    onHide();
  };

  const calcularMontoCobrado = (profesional, horas) => {
    if (!horas || !profesional) return 0;
    const tarifa = profesional.honorario || profesional.tarifaDiaria || 0;
    return (parseFloat(horas) * tarifa).toFixed(2);
  };

  return (
    <Modal show={show} onHide={handleClose} size="xl" backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="fas fa-calendar-day me-2"></i>
          Asignación Diaria de Profesionales - {obra?.nombre || 'Obra'}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {/* Selector de Fecha */}
        <div className="mb-4">
          <Form.Group>
            <Form.Label className="fw-bold">
              <i className="fas fa-calendar-day me-2"></i>
              Fecha de Asignación
            </Form.Label>
            <Form.Control
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
            <Form.Text className="text-muted">
              Seleccione el día para asignar profesionales y sus jornadas (completa o fracciones)
            </Form.Text>
          </Form.Group>
        </div>

        {/* Alerts */}
        {error && (
          <Alert variant="danger" onClose={() => setError(null)} dismissible>
            {error}
          </Alert>
        )}
        {success && (
          <Alert variant="success" onClose={() => setSuccess(null)} dismissible>
            {success}
          </Alert>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-4">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2">Cargando profesionales...</p>
          </div>
        )}

        {/* Tabla de Profesionales */}
        {!loading && profesionalesAsignados.length === 0 && !vistaSeleccion && (
          <div>
            <Alert variant="warning">
              <i className="fas fa-exclamation-triangle me-2"></i>
              No hay profesionales asignados a esta obra para esta fecha.
            </Alert>
            <div className="text-center mb-3">
              <Button
                variant="success"
                size="lg"
                onClick={handleAbrirSelectorProfesionales}
              >
                <i className="fas fa-user-plus me-2"></i>
                Asignar profesionales para este día
              </Button>
              <p className="text-muted mt-2">
                <small>Selecciona profesionales existentes o créalos nuevos</small>
              </p>
            </div>
          </div>
        )}

        {/* Vista de Selección de Profesionales */}
        {vistaSeleccion && (
          <div>
            <div className="mb-3 d-flex justify-content-between align-items-center">
              <h6 className="text-primary mb-0">
                <i className="fas fa-user-check me-2"></i>
                Seleccionar Profesionales ({profesionalesSeleccionados.length} seleccionados)
              </h6>
              <Button variant="outline-secondary" size="sm" onClick={handleVolverAFormulario}>
                <i className="fas fa-arrow-left me-2"></i>
                Volver
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-4">
                <Spinner animation="border" variant="primary" />
                <p className="mt-2">Cargando profesionales...</p>
              </div>
            ) : (
              <>
                <Alert variant="info">
                  <strong>Instrucciones:</strong> Selecciona los profesionales que trabajaron este día.
                  Puedes ajustar la fracción de jornada (1.0 = día completo, 0.5 = medio día) y la tarifa diaria si es necesario.
                  {profesionalesSeleccionados.some(p => !p.tarifaDiaria || p.tarifaDiaria === 0) && (
                    <div className="mt-2 text-warning">
                      <i className="fas fa-exclamation-triangle me-2"></i>
                      <strong>Atención:</strong> Algunos profesionales sin tarifa configurada. Debes especificar una tarifa personalizada.
                    </div>
                  )}
                </Alert>

                <Table bordered hover responsive>
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: '50px' }}></th>
                      <th>Profesional</th>
                      <th>Tipo</th>
                      <th>Obras Asignadas</th>
                      <th style={{ width: '180px' }}>Rubro</th>
                      <th>Tarifa Diaria</th>
                      <th style={{ width: '300px' }}>Fechas y Fracciones</th>
                      <th style={{ width: '120px' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todosProfesionales.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="text-center text-muted py-4">
                          No hay profesionales disponibles en la empresa
                        </td>
                      </tr>
                    ) : (
                      todosProfesionales.map(prof => {
                        const seleccionado = profesionalesSeleccionados.find(p => p.id === prof.id);
                        const tarifa = seleccionado?.tarifaDiaria ?? prof.honorario ?? 0;
                        const fechasProf = fechasPorProfesional[prof.id] || [];

                        // NUEVO: Calcular total sumando todas las fechas
                        const totalDias = fechasProf.reduce((sum, f) => sum + f.fraccion, 0);
                        const montoTotal = (totalDias * tarifa).toFixed(2);

                        const obrasAsignadas = asignacionesPorProfesional[prof.id] || [];
                        const tieneTarifa = (prof.honorario && prof.honorario > 0);

                        return (
                          <tr key={prof.id} className={seleccionado ? 'table-success' : ''}>
                            <td className="text-center">
                              <Form.Check
                                type="checkbox"
                                checked={!!seleccionado}
                                onChange={() => handleSeleccionarProfesional(prof)}
                              />
                            </td>
                            <td>
                              <div>
                                <strong>{prof.nombre}</strong>
                                {prof.especialidad && (
                                  <div className="text-muted small">{prof.especialidad}</div>
                                )}
                              </div>
                            </td>
                            <td>
                              <Badge bg="info">{prof.tipoProfesional || 'N/A'}</Badge>
                            </td>
                            <td>
                              {obrasAsignadas.length > 0 ? (
                                <div className="small">
                                  {obrasAsignadas.map((asig, idx) => {
                                    // Formatear la información de fecha/período
                                    let periodo = '';
                                    if (asig.semana && asig.anio) {
                                      periodo = `Semana ${asig.semana}/${asig.anio}`;
                                    } else if (asig.fechaInicio && asig.fechaFin) {
                                      const inicio = new Date(asig.fechaInicio).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
                                      const fin = new Date(asig.fechaFin).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
                                      periodo = `${inicio} - ${fin}`;
                                    } else if (asig.fechaInicio) {
                                      periodo = `Desde ${new Date(asig.fechaInicio).toLocaleDateString('es-AR')}`;
                                    }

                                    const esObraActual = asig.obraId === obra?.id;

                                    return (
                                      <div key={`${asig.asignacionId}-${idx}`} className="mb-1">
                                        <Badge
                                          bg={esObraActual ? 'primary' : 'secondary'}
                                          className="me-1"
                                        >
                                          {asig.obraNombre}
                                        </Badge>
                                        {periodo && (
                                          <span className="text-muted" style={{ fontSize: '0.85em' }}>
                                            ({periodo})
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-muted small">Sin asignaciones</span>
                              )}
                            </td>
                            <td>
                              {seleccionado ? (
                                <Form.Select
                                  size="sm"
                                  value={seleccionado.rubroId || ''}
                                  onChange={(e) => handleCambiarRubroSeleccionado(prof.id, e.target.value)}
                                  className={!seleccionado.rubroId ? 'border-danger' : ''}
                                >
                                  <option value="">-- Seleccionar --</option>
                                  {rubros.map(r => (
                                    <option key={r.id} value={r.id}>{r.nombreRubro}</option>
                                  ))}
                                </Form.Select>
                              ) : (
                                <span className="text-muted small">-</span>
                              )}
                            </td>
                            <td className="text-end">
                              {seleccionado ? (
                                <div>
                                  <Form.Control
                                    type="number"
                                    size="sm"
                                    step="1000"
                                    min="0"
                                    value={tarifa}
                                    onChange={(e) => handleCambiarTarifaSeleccionado(prof.id, e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                    className={!tieneTarifa ? 'border-warning' : ''}
                                  />
                                  {!tieneTarifa && (
                                    <small className="text-warning d-block">
                                      ⚠️ Sin tarifa configurada
                                    </small>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  ${tarifa.toLocaleString('es-AR')}
                                  {!tieneTarifa && (
                                    <div className="text-warning small">⚠️ Sin tarifa</div>
                                  )}
                                </div>
                              )}
                            </td>
                            <td>
                              {seleccionado ? (
                                <div>
                                  {/* NUEVO: Mostrar fechas como chips con fracciones editables */}
                                  <div className="d-flex flex-wrap gap-2 mb-2">
                                    {fechasProf.map(({ fecha: f, fraccion }) => {
                                      const montoFecha = (fraccion * tarifa);
                                      return (
                                        <div key={f} className="d-flex align-items-center gap-1 border rounded p-1" style={{ backgroundColor: '#f0f8ff' }}>
                                          <span className="small text-nowrap">
                                            📅 {new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                                          </span>
                                          <Form.Select
                                            size="sm"
                                            value={String(fraccion)}
                                            onChange={(e) => handleCambiarFraccionFecha(prof.id, f, e.target.value)}
                                            style={{ width: '75px', padding: '0.15rem 0.3rem', fontSize: '0.85rem' }}
                                          >
                                            <option value="0.25">0.25</option>
                                            <option value="0.5">0.5</option>
                                            <option value="0.75">0.75</option>
                                            <option value="1">1.0</option>
                                            <option value="1.25">1.25</option>
                                            <option value="1.5">1.5</option>
                                          </Form.Select>
                                          <button
                                            className="btn btn-sm btn-danger p-0"
                                            style={{ width: '20px', height: '20px', fontSize: '0.7rem', lineHeight: '1' }}
                                            onClick={() => handleEliminarFecha(prof.id, f)}
                                            title="Quitar fecha"
                                          >
                                            ✕
                                          </button>
                                          <span className="small text-muted fw-bold">${montoFecha.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* NUEVO: Botón para agregar más fechas */}
                                  <div className="d-flex gap-1">
                                    <Form.Control
                                      type="date"
                                      size="sm"
                                      value={profesionalEditandoFechas === prof.id ? nuevaFecha : ''}
                                      onChange={(e) => {
                                        setProfesionalEditandoFechas(prof.id);
                                        setNuevaFecha(e.target.value);
                                      }}
                                      style={{ width: '140px' }}
                                    />
                                    <Button
                                      size="sm"
                                      variant="outline-primary"
                                      onClick={() => {
                                        handleAbrirSelectorFechas(prof.id);
                                        handleAgregarFecha();
                                      }}
                                      disabled={!nuevaFecha || profesionalEditandoFechas !== prof.id}
                                      style={{ whiteSpace: 'nowrap' }}
                                    >
                                      <i className="fas fa-plus me-1"></i>Agregar
                                    </Button>
                                  </div>

                                  {fechasProf.length === 0 && (
                                    <small className="text-danger d-block mt-1">
                                      ⚠️ Agrega al menos una fecha
                                    </small>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                            <td className="text-end">
                              {seleccionado ? (
                                <div>
                                  <strong className="text-success">
                                    ${parseFloat(montoTotal).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                  </strong>
                                  {fechasProf.length > 0 && (
                                    <div className="small text-muted">
                                      {totalDias.toFixed(2)} días
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </Table>

                {profesionalesSeleccionados.length > 0 && (
                  <div className="text-end mt-3">
                    <Button
                      variant="success"
                      size="lg"
                      onClick={handleGuardarProfesionalesSeleccionados}
                      disabled={guardando}
                    >
                      {guardando ? (
                        <>
                          <Spinner animation="border" size="sm" className="me-2" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-save me-2"></i>
                          Guardar {profesionalesSeleccionados.length} Jornales
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {!loading && profesionalesAsignados.length > 0 && !vistaSeleccion && (
          <>
            <div className="mb-3 d-flex justify-content-between align-items-center">
              <div>
                <h6 className="text-muted mb-1">
                  <i className="fas fa-users me-2"></i>
                  Profesionales Disponibles para Asignar ({profesionalesAsignados.length})
                </h6>
                <small className="text-muted">
                  <strong>Asignación por fracción de día:</strong> 1.0 = jornada completa, 0.75 = 3/4 día, 0.5 = medio día, 0.25 = 1/4 día
                </small>
              </div>
              <Button
                variant="outline-success"
                size="sm"
                onClick={handleAbrirSelectorProfesionales}
              >
                <i className="fas fa-user-plus me-2"></i>
                Agregar Más Profesionales
              </Button>
            </div>

            <Table bordered hover responsive>
              <thead className="table-light">
                <tr>
                  <th style={{ width: '25%' }}>Profesional</th>
                  <th style={{ width: '15%' }}>Tipo</th>
                  <th style={{ width: '12%' }}>Tarifa Día</th>
                  <th style={{ width: '15%' }}>Horas Trabajadas</th>
                  <th style={{ width: '13%' }}>Monto a Cobrar</th>
                  <th style={{ width: '20%' }}>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {profesionalesAsignados.map((asignacion) => {
                  const profesionalId = asignacion.profesionalId;
                  const jornal = jornalesDelDia[profesionalId] || {};
                  const horas = jornal.horasTrabajadasDecimal || '';
                  const observaciones = jornal.observaciones || '';
                  const tarifa = asignacion.honorario || asignacion.tarifaDiaria || 0;
                  const monto = calcularMontoCobrado(asignacion, horas);
                  const tieneJornalExistente = jornalesExistentes.some(j => j.profesionalId === profesionalId);

                  return (
                    <tr key={profesionalId} className={tieneJornalExistente ? 'table-info' : ''}>
                      <td>
                        {asignacion.nombreProfesional || asignacion.profesionalNombre || 'N/A'}
                        {tieneJornalExistente && (
                          <Badge bg="info" className="ms-2">Registrado</Badge>
                        )}
                      </td>
                      <td>
                        <small className="text-muted">
                          {asignacion.tipoProfesional || 'N/A'}
                        </small>
                      </td>
                      <td className="text-end">
                        ${tarifa.toLocaleString('es-AR')}
                      </td>
                      <td>
                        <Form.Control
                          type="number"
                          step="0.25"
                          min="0"
                          max="1.5"
                          value={horas}
                          onChange={(e) => handleHorasChange(profesionalId, e.target.value)}
                          placeholder="0.0"
                          size="sm"
                        />
                      </td>
                      <td className="text-end fw-bold">
                        {horas ? `$${parseFloat(monto).toLocaleString('es-AR')}` : '-'}
                      </td>
                      <td>
                        <Form.Control
                          type="text"
                          value={observaciones}
                          onChange={(e) => handleObservacionesChange(profesionalId, e.target.value)}
                          placeholder="Opcional"
                          size="sm"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="table-light">
                <tr>
                  <td colSpan="4" className="text-end fw-bold">
                    Total a pagar:
                  </td>
                  <td className="text-end fw-bold text-primary">
                    ${Object.entries(jornalesDelDia)
                      .reduce((total, [profId, data]) => {
                        const profesional = profesionalesAsignados.find(a => a.profesionalId === parseInt(profId));
                        if (profesional && data.horasTrabajadasDecimal) {
                          return total + parseFloat(calcularMontoCobrado(profesional, data.horasTrabajadasDecimal));
                        }
                        return total;
                      }, 0)
                      .toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </Table>
          </>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose} disabled={guardando}>
          <i className="fas fa-times me-2"></i>
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={handleGuardar}
          disabled={guardando || profesionalesAsignados.length === 0}
        >
          {guardando ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              Guardando...
            </>
          ) : (
            <>
              <i className="fas fa-save me-2"></i>
              Guardar Jornales
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default RegistrarJornalesDiariosModal;
