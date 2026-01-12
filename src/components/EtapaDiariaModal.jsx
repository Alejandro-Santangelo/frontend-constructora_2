import React, { useState, useEffect } from 'react';
import { useEmpresa } from '../EmpresaContext';
import api from '../services/api';
import { getTipoProfesionalBadgeClass } from '../utils/badgeColors';
import SeleccionarProfesionalesModal from './SeleccionarProfesionalesModal';

const EtapaDiariaModal = ({ show, onClose, obra, configuracionObra = null, etapaDiariaInicial = null, onGuardado, etapasExistentes = [] }) => {
  const { empresaSeleccionada } = useEmpresa();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    fecha: '',
    descripcion: '', // 🆕 Descripción general del día
    horaInicio: '', // 🆕 Hora de inicio (HH:mm)
    horaFin: '', // 🆕 Hora de fin (HH:mm)
    tareas: [], // Array de tareas del día
    observaciones: ''
  });

  // Estados para agregar/editar tareas
  const [mostrarFormTarea, setMostrarFormTarea] = useState(false);
  const [editandoTareaIndex, setEditandoTareaIndex] = useState(null);
  const [nuevaTarea, setNuevaTarea] = useState({
    descripcion: '',
    estado: 'PENDIENTE',
    profesionales: [] // Array de IDs de profesionales
  });

  // Lista de profesionales disponibles
  const [profesionalesDisponibles, setProfesionalesDisponibles] = useState([]);
  const [profesionalSeleccionado, setProfesionalSeleccionado] = useState('');
  const [mostrarModalSeleccionProfesionales, setMostrarModalSeleccionProfesionales] = useState(false);

  // ==================== CÁLCULOS INTELIGENTES ====================

  // Calcular jornales del presupuesto
  const getJornalesPresupuesto = () => {
    // 🔥 PRIORIDAD 1: Si viene configuracionObra, usar esos valores
    if (configuracionObra?.diasHabiles) {
      return configuracionObra.diasHabiles;
    }

    // Intentar obtener desde presupuestoNoCliente vinculado
    if (obra?.presupuestoNoCliente?.detalles) {
      const detalles = obra.presupuestoNoCliente.detalles;
      const itemJornales = detalles.find(d =>
        d.item?.toLowerCase().includes('jornal') ||
        d.descripcion?.toLowerCase().includes('jornal')
      );

      if (itemJornales) {
        return parseFloat(itemJornales.cantidad) || 0;
      }
    }

    // Fallback: buscar en presupuestos array (si existe)
    if (obra?.presupuestos?.length > 0) {
      const presupuesto = obra.presupuestos[0];
      if (presupuesto.detalles) {
        const itemJornales = presupuesto.detalles.find(d =>
          d.item?.toLowerCase().includes('jornal') ||
          d.descripcion?.toLowerCase().includes('jornal')
        );

        if (itemJornales) {
          return parseFloat(itemJornales.cantidad) || 0;
        }
      }
    }

    return null;
  };

  // Calcular semanas estimadas (5 días hábiles = 1 semana)
  const getSemanas = () => {
    // 🔥 PRIORIDAD 1: Si viene configuracionObra, usar esos valores
    if (configuracionObra?.semanas) {
      return configuracionObra.semanas;
    }

    const jornales = getJornalesPresupuesto();
    return jornales ? Math.ceil(jornales / 5) : null;
  };

  // Calcular progreso (etapas terminadas vs jornales totales)
  const getProgreso = () => {
    const jornales = getJornalesPresupuesto();
    if (!jornales) return null;

    const etapasTerminadas = etapasExistentes.filter(e => e.estado === 'COMPLETADA').length;
    const porcentaje = Math.round((etapasTerminadas / jornales) * 100);

    return {
      terminadas: etapasTerminadas,
      total: jornales,
      porcentaje: Math.min(porcentaje, 100)
    };
  };

  // Calcular próxima fecha hábil (lun-vie)
  const getProximaFechaHabil = () => {
    const hoy = new Date();
    let proxima = new Date(hoy);
    proxima.setDate(proxima.getDate() + 1);

    // Saltar fin de semana
    while (proxima.getDay() === 0 || proxima.getDay() === 6) {
      proxima.setDate(proxima.getDate() + 1);
    }

    return proxima.toISOString().split('T')[0];
  };

  // Obtener próximas 3 fechas hábiles sugeridas
  const getFechasSugeridas = () => {
    const fechas = [];
    let fecha = new Date();

    while (fechas.length < 3) {
      fecha.setDate(fecha.getDate() + 1);

      // Solo días hábiles (lun-vie)
      if (fecha.getDay() !== 0 && fecha.getDay() !== 6) {
        const fechaStr = fecha.toISOString().split('T')[0];

        // Evitar fechas ya registradas
        const yaRegistrada = etapasExistentes.some(e => e.fecha === fechaStr);
        if (!yaRegistrada) {
          fechas.push({
            fecha: fechaStr,
            diaSemana: fecha.toLocaleDateString('es-AR', { weekday: 'long' })
          });
        }
      }
    }

    return fechas;
  };

  // Agrupar etapas por semana
  const getResumenSemanal = () => {
    const jornales = getJornalesPresupuesto();
    if (!jornales) return [];

    const semanas = getSemanas();
    const resumen = [];

    // Helper para parsear fechas evitando problemas de zona horaria
    const parsearFechaLocal = (fechaStr) => {
      if (!fechaStr) return new Date();
      if (fechaStr.includes('-')) {
        const soloFecha = fechaStr.split('T')[0];
        const [year, month, day] = soloFecha.split('-');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 7, 0, 0);
      }
      return new Date(fechaStr);
    };

    // Fecha de inicio de la obra (configuración o primera etapa o fecha actual)
    let fechaInicio;

    if (configuracionObra?.fechaInicio) {
      // Usar fecha de configuración con parsing seguro
      fechaInicio = parsearFechaLocal(configuracionObra.fechaInicio);
    } else {
      // Fallback a primera etapa existente
      const primeraEtapa = [...etapasExistentes].sort((a, b) =>
        parsearFechaLocal(a.fecha) - parsearFechaLocal(b.fecha)
      )[0];

      fechaInicio = primeraEtapa
        ? parsearFechaLocal(primeraEtapa.fecha)
        : new Date();
    }

    // Ajustar a lunes
    const primerLunes = new Date(fechaInicio);
    while (primerLunes.getDay() !== 1) {
      primerLunes.setDate(primerLunes.getDate() - 1);
    }

    // Generar resumen por semana
    for (let i = 0; i < semanas; i++) {
      const inicioSemana = new Date(primerLunes);
      inicioSemana.setDate(inicioSemana.getDate() + (i * 7));

      const finSemana = new Date(inicioSemana);
      finSemana.setDate(finSemana.getDate() + 4); // Viernes

      // Contar etapas de esta semana
      const etapasSemana = etapasExistentes.filter(e => {
        const fechaEtapa = parsearFechaLocal(e.fecha);
        return fechaEtapa >= inicioSemana && fechaEtapa <= finSemana;
      });

      const terminadas = etapasSemana.filter(e => e.estado === 'COMPLETADA').length;

      resumen.push({
        numero: i + 1,
        inicio: `${inicioSemana.getDate().toString().padStart(2, '0')}/${(inicioSemana.getMonth() + 1).toString().padStart(2, '0')}`,
        fin: `${finSemana.getDate().toString().padStart(2, '0')}/${(finSemana.getMonth() + 1).toString().padStart(2, '0')}`,
        completadas: etapasSemana.length,
        esperadas: 5,
        terminadas: terminadas,
        estado: terminadas === 5 ? 'completa' : etapasSemana.length > 0 ? 'en-progreso' : 'pendiente'
      });
    }

    return resumen;
  };

  useEffect(() => {
    if (show && obra) {
      cargarProfesionales();
      if (etapaDiariaInicial) {
        if (etapaDiariaInicial.id) {
          // Editar etapa existente
          cargarEtapaDiaria();
        } else {
          // Nuevo día desde calendario (solo tiene fecha)
          resetearFormulario();
          setFormData(prev => ({
            ...prev,
            fecha: etapaDiariaInicial.fecha || '',
            descripcion: etapaDiariaInicial.descripcion || '',
            horaInicio: etapaDiariaInicial.horaInicio || '',
            horaFin: etapaDiariaInicial.horaFin || '',
            tareas: etapaDiariaInicial.tareas || []
          }));
        }
      } else {
        resetearFormulario();
      }
    }
  }, [show, obra, etapaDiariaInicial]);

  // Cargar profesionales de la obra (solo los asignados)
  const cargarProfesionales = async () => {
    try {
      console.log('🔍 [EtapaDiariaModal] Cargando profesionales asignados a obra:', obra?.id);

      // Obtener profesionales asignados a esta obra específica
      const response = await fetch(
        `http://localhost:8080/api/profesionales/asignaciones/${obra.id}`,
        {
          headers: {
            'empresaId': empresaSeleccionada.id.toString(),
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        console.warn('⚠️ No se pudieron cargar asignaciones de profesionales');
        setProfesionalesDisponibles([]);
        return;
      }

      const asignaciones = await response.json();
      console.log('🔍 [EtapaDiariaModal] Asignaciones recibidas:', asignaciones);
      console.log('🔍 [EtapaDiariaModal] Es array?', Array.isArray(asignaciones));
      console.log('🔍 [EtapaDiariaModal] Tipo:', typeof asignaciones);
      console.log('🔍 [EtapaDiariaModal] Keys:', Object.keys(asignaciones));

      // Extraer profesionales únicos de las asignaciones
      const profesionalesMap = new Map();
      const asignacionesArray = Array.isArray(asignaciones) ? asignaciones : (asignaciones.data || []);

      asignacionesArray.forEach(asignacion => {
        if (asignacion.asignacionesPorSemana) {
          asignacion.asignacionesPorSemana.forEach(semana => {
            if (semana.detallesPorDia) {
              semana.detallesPorDia.forEach(detalle => {
                if (detalle.profesionalId && !profesionalesMap.has(detalle.profesionalId)) {
                  profesionalesMap.set(detalle.profesionalId, {
                    id: detalle.profesionalId,
                    nombre: detalle.profesionalNombre || `Profesional ${detalle.profesionalId}`,
                    tipoProfesional: detalle.profesionalTipo || detalle.profesionalRubro || 'Sin especificar',
                    activo: true
                  });
                }
              });
            }
          });
        }
      });

      const profesionalesAsignados = Array.from(profesionalesMap.values());
      console.log('✅ [EtapaDiariaModal] Profesionales asignados extraídos:', profesionalesAsignados.length, profesionalesAsignados);

      setProfesionalesDisponibles(profesionalesAsignados);
    } catch (error) {
      console.warn('Error cargando profesionales:', error);
      setProfesionalesDisponibles([]);
    }
  };

  const cargarEtapaDiaria = async () => {
    try {
      setLoading(true);
      const data = await api.etapasDiarias.getById(etapaDiariaInicial.id, empresaSeleccionada.id);

      // Cargar profesionales disponibles primero
      const profesionales = await api.profesionales.getAll(empresaSeleccionada.id);
      const profesionalesMap = new Map(profesionales.map(p => [p.id, p]));

      // Mapear estados antiguos y convertir IDs de profesionales a objetos completos
      const tareasNormalizadas = (data.tareas || []).map(t => {
        // Convertir array de IDs a objetos completos
        const profesionalesCompletos = Array.isArray(t.profesionales)
          ? t.profesionales
              .map(profId => {
                const id = typeof profId === 'object' ? profId.id : profId;
                return profesionalesMap.get(id);
              })
              .filter(Boolean) // Eliminar undefined si algún ID no se encuentra
          : [];

        return {
          ...t,
          estado: t.estado === 'TERMINADA' ? 'COMPLETADA' : t.estado,
          profesionales: profesionalesCompletos
        };
      });

      setFormData({
        fecha: data.fecha || '',
        descripcion: data.descripcion || '',
        horaInicio: data.horaInicio || '',
        horaFin: data.horaFin || '',
        tareas: tareasNormalizadas,
        observaciones: data.observaciones || ''
      });

    } catch (error) {
      console.error('Error cargando etapa diaria:', error);

      if (error.status === 404 || error.response?.status === 404 || error.message?.includes('404')) {
        setError('⚠️ El módulo de Etapas Diarias aún no está disponible en el backend');
      } else {
        setError('Error al cargar la etapa diaria: ' + (error.message || 'Error desconocido'));
      }
    } finally {
      setLoading(false);
    }
  };

  const resetearFormulario = () => {
    setFormData({
      fecha: '',
      descripcion: '',
      horaInicio: '',
      horaFin: '',
      tareas: [],
      observaciones: ''
    });
    setError(null);
    resetearFormTarea();
  };

  const resetearFormTarea = () => {
    setNuevaTarea({
      descripcion: '',
      estado: 'EN_PROCESO',
      profesionales: []
    });
    setMostrarFormTarea(false);
    setEditandoTareaIndex(null);
    setProfesionalSeleccionado('');
  };

  // ==================== GESTIÓN DE TAREAS ====================

  const handleNuevaTarea = () => {
    resetearFormTarea();
    setMostrarFormTarea(true);
  };

  const handleEditarTarea = (index) => {
    const tarea = formData.tareas[index];
    setNuevaTarea({
      descripcion: tarea.descripcion || '',
      estado: tarea.estado || 'EN_PROCESO',
      profesionales: tarea.profesionales || []
    });
    setEditandoTareaIndex(index);
    setMostrarFormTarea(true);
  };

  const handleGuardarTarea = () => {
    if (!nuevaTarea.descripcion.trim()) {
      setError('La descripción de la tarea es obligatoria');
      return;
    }

    const tareaFinal = {
      descripcion: nuevaTarea.descripcion.trim(),
      estado: nuevaTarea.estado,
      profesionales: nuevaTarea.profesionales
    };

    if (editandoTareaIndex !== null) {
      // Editar tarea existente - PRESERVAR EL ID
      const tareasActualizadas = [...formData.tareas];
      const tareaExistente = tareasActualizadas[editandoTareaIndex];
      tareasActualizadas[editandoTareaIndex] = {
        ...tareaFinal,
        id: tareaExistente.id // ⚠️ CRÍTICO: Mantener el ID de la tarea existente
      };
      setFormData(prev => ({ ...prev, tareas: tareasActualizadas }));
    } else {
      // Agregar nueva tarea (sin id)
      setFormData(prev => ({ ...prev, tareas: [...prev.tareas, tareaFinal] }));
    }

    resetearFormTarea();
  };

  const handleEliminarTarea = (index) => {
    if (window.confirm('¿Eliminar esta tarea?')) {
      const tareasActualizadas = formData.tareas.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, tareas: tareasActualizadas }));
    }
  };

  // Cambiar estado de tarea con un click
  const handleCambiarEstadoTarea = (index) => {
    const tarea = formData.tareas[index];
    let nuevoEstado;

    // Ciclo: PENDIENTE → EN_PROCESO → COMPLETADA → PENDIENTE
    if (tarea.estado === 'PENDIENTE') {
      nuevoEstado = 'EN_PROCESO';
    } else if (tarea.estado === 'EN_PROCESO') {
      nuevoEstado = 'COMPLETADA';
    } else {
      nuevoEstado = 'PENDIENTE';
    }

    const tareasActualizadas = [...formData.tareas];
    tareasActualizadas[index] = { ...tarea, estado: nuevoEstado };
    setFormData(prev => ({ ...prev, tareas: tareasActualizadas }));
  };

  const handleAgregarProfesional = () => {
    if (!profesionalSeleccionado) return;

    const profesional = profesionalesDisponibles.find(p => p.id === parseInt(profesionalSeleccionado));
    if (!profesional) return;

    // Evitar duplicados
    if (nuevaTarea.profesionales.some(p => p.id === profesional.id)) {
      setError('Este profesional ya está asignado a la tarea');
      return;
    }

    setNuevaTarea(prev => ({
      ...prev,
      profesionales: [...prev.profesionales, profesional]
    }));

    setProfesionalSeleccionado('');
  };

  const handleConfirmarProfesionales = (profesionalesSeleccionados) => {
    // Agregar solo los profesionales que no estén ya asignados
    const nuevosProf = profesionalesSeleccionados.filter(prof =>
      !nuevaTarea.profesionales.some(p => p.id === prof.id)
    );

    setNuevaTarea(prev => ({
      ...prev,
      profesionales: [...prev.profesionales, ...nuevosProf]
    }));

    setMostrarModalSeleccionProfesionales(false);
  };

  const handleQuitarProfesional = (profesionalId) => {
    setNuevaTarea(prev => ({
      ...prev,
      profesionales: prev.profesionales.filter(p => p.id !== profesionalId)
    }));
  };

  // Calcular estado general del día basado en tareas
  const getEstadoGeneralDia = () => {
    if (formData.tareas.length === 0) return 'PENDIENTE';

    const completadas = formData.tareas.filter(t => t.estado === 'COMPLETADA').length;
    const total = formData.tareas.length;

    if (completadas === total) return 'COMPLETADA';
    if (completadas > 0) return 'EN_PROCESO';

    const suspendidas = formData.tareas.filter(t => t.estado === 'SUSPENDIDA').length;
    if (suspendidas === total) return 'SUSPENDIDA';

    return 'EN_PROCESO';
  };

  const validarFormulario = () => {
    if (!formData.fecha) {
      setError('La fecha es obligatoria');
      return false;
    }

    if (formData.tareas.length === 0) {
      setError('Debe agregar al menos una tarea para este día');
      return false;
    }

    return true;
  };

  const handleGuardar = async () => {
    if (!validarFormulario()) {
      return;
    }

    // Validar que todos los profesionales asignados existan
    const profesionalesAsignados = new Set();
    formData.tareas.forEach(tarea => {
      if (Array.isArray(tarea.profesionales)) {
        tarea.profesionales.forEach(prof => {
          const profId = typeof prof === 'object' ? prof.id : prof;
          profesionalesAsignados.add(profId);
        });
      }
    });

    const profesionalesInvalidos = Array.from(profesionalesAsignados).filter(profId => {
      return !profesionalesDisponibles.some(p => p.id === profId);
    });

    if (profesionalesInvalidos.length > 0) {
      setError(`⚠️ Los siguientes profesionales no existen o no están disponibles: ${profesionalesInvalidos.join(', ')}`);
      return;
    }

    // 🔍 ALERT temporal para debug
    if (!obra || !obra.id) {
      alert(`❌ ERROR DEBUG:\n\nobra existe: ${!!obra}\nobra.id: ${obra?.id}\n\nPor favor reporta esto.`);
      setError('⚠️ Error: No se encontró el ID de la obra. Por favor, cierre y vuelva a abrir el modal.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const estadoGeneral = getEstadoGeneralDia();

      const dataParaEnviar = {
        obraId: obra.id,
        fecha: formData.fecha,
        descripcion: formData.descripcion || `Etapa del ${formData.fecha}`, // Si está vacío, generar descripción automática
        horaInicio: formData.horaInicio || null,
        horaFin: formData.horaFin || null,
        estado: estadoGeneral,
        tareas: formData.tareas.map(tarea => {
          const tareaDTO = {};

          // 1. Si tiene id, ponerlo PRIMERO
          if (tarea.id !== undefined && tarea.id !== null) {
            tareaDTO.id = tarea.id;
          }

          // 2. Luego los demás campos
          tareaDTO.descripcion = tarea.descripcion;
          tareaDTO.estado = tarea.estado;
          tareaDTO.profesionales = Array.isArray(tarea.profesionales)
            ? tarea.profesionales.map(p => typeof p === 'object' ? p.id : p)
            : [];

          return tareaDTO;
        }),
        observaciones: formData.observaciones.trim() || null
      };

      let resultado;
      // Solo hacer UPDATE si la etapa tiene ID (ya existe en BD)
      if (etapaDiariaInicial && etapaDiariaInicial.id) {
        resultado = await api.etapasDiarias.update(
          etapaDiariaInicial.id,
          dataParaEnviar,
          empresaSeleccionada.id
        );
      } else {
        resultado = await api.etapasDiarias.create(
          dataParaEnviar,
          empresaSeleccionada.id
        );
      }

      if (onGuardado) {
        onGuardado(resultado);
      }

      resetearFormulario();
      onClose();

    } catch (error) {
      console.error('Error al guardar etapa diaria:', error.message);

      // Verificar si es error relacionado al endpoint faltante
      if (error.message?.includes('No static resource') || error.message?.includes('etapas-diarias')) {
        setError('⚠️ Error al conectar con el módulo de Cronograma.\n\n' +
               'El endpoint POST /api/etapas-diarias no responde correctamente.\n\n' +
               'Verifique que el servidor backend esté ejecutándose en http://localhost:8080');
      } else if (error.status === 404 || error.response?.status === 404 || error.message?.includes('404')) {
        setError('⚠️ El módulo de Cronograma aún no está disponible en el backend.\n\n' +
               'Los datos se están preparando correctamente en el frontend, pero el servidor aún no tiene implementado este endpoint.\n\n' +
               'Contacte al administrador del sistema para implementar la API de Etapas Diarias.');
      } else if (error.message?.includes('Network Error') || error.code === 'ERR_NETWORK') {
        setError('❌ Error de conexión. Verifique que el servidor backend esté ejecutándose.');
      } else {
        setError(error.message || 'Error al guardar la etapa diaria');
      }
    } finally {
      setLoading(false);
    }
  };

  const getEstadoBadgeClass = (estado) => {
    switch (estado) {
      case 'TERMINADA': return 'bg-success';
      case 'EN_PROCESO': return 'bg-primary';
      case 'SUSPENDIDA': return 'bg-warning';
      case 'MODIFICADA': return 'bg-info';
      case 'CANCELADA': return 'bg-danger';
      default: return 'bg-secondary';
    }
  };

  const getEstadoBadge = (estado) => {
    const badges = {
      'TERMINADA': '✅',
      'EN_PROCESO': '🔄',
      'SUSPENDIDA': '⏸️',
      'MODIFICADA': '✏️',
      'CANCELADA': '❌'
    };
    return <span className={`badge ${getEstadoBadgeClass(estado)} me-2`}>{badges[estado]} {estado.replace('_', ' ')}</span>;
  };

  if (!show) return null;

  return (
    <>
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">
              <i className="fas fa-calendar-check me-2"></i>
              {etapaDiariaInicial ? 'Editar' : 'Nueva'} Etapa Diaria - {obra?.nombre}
            </h5>
            <button
              type="button"
              className="btn btn-light btn-sm ms-auto"
              onClick={onClose}
              disabled={loading}
            >
              Cerrar
            </button>
          </div>

          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {error && (
              <div className="alert alert-danger alert-dismissible fade show" role="alert">
                <i className="fas fa-exclamation-triangle me-2"></i>
                {error}
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setError(null)}
                ></button>
              </div>
            )}

            {/* PANEL DE INFORMACIÓN DEL PRESUPUESTO */}
            {!etapaDiariaInicial && getJornalesPresupuesto() && (
              <div className="card mb-3 border-primary">
                <div className="card-header bg-primary bg-opacity-10">
                  <h6 className="mb-0 text-primary">
                    <i className="fas fa-chart-line me-2"></i>
                    Información del Presupuesto
                  </h6>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-4 text-center">
                      <i className="fas fa-hard-hat fa-2x text-primary mb-2"></i>
                      <h5 className="mb-0">{getJornalesPresupuesto()}</h5>
                      <small className="text-muted">Jornales</small>
                    </div>
                    <div className="col-4 text-center">
                      <i className="fas fa-calendar-week fa-2x text-success mb-2"></i>
                      <h5 className="mb-0">{getSemanas()}</h5>
                      <small className="text-muted">Semanas</small>
                    </div>
                    <div className="col-4 text-center">
                      <i className="fas fa-tasks fa-2x text-info mb-2"></i>
                      <h5 className="mb-0">{getProgreso()?.terminadas || 0}/{getProgreso()?.total || 0}</h5>
                      <small className="text-muted">Completados</small>
                    </div>
                  </div>

                  {getProgreso() && (
                    <div className="mt-3">
                      <div className="d-flex justify-content-between mb-1">
                        <small className="text-muted">Progreso</small>
                        <small className="fw-bold text-primary">{getProgreso().porcentaje}%</small>
                      </div>
                      <div className="progress" style={{ height: '20px' }}>
                        <div
                          className={`progress-bar ${getProgreso().porcentaje >= 100 ? 'bg-success' : 'bg-primary'}`}
                          style={{ width: `${getProgreso().porcentaje}%` }}
                        >
                          {getProgreso().terminadas}/{getProgreso().total}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* FECHA DEL DÍA */}
            <div className="card mb-3">
              <div className="card-header bg-light">
                <h6 className="mb-0">
                  <i className="fas fa-calendar-day me-2"></i>
                  Fecha del Trabajo
                </h6>
              </div>
              <div className="card-body">
                <div className="row align-items-end">
                  <div className="col-md-12 mb-3">
                    <label className="form-label">Seleccionar Fecha *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.fecha}
                      onChange={(e) => setFormData(prev => ({ ...prev, fecha: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="col-md-12 mb-3">
                    <label className="form-label">Descripción del Día *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ej: Construcción de cimientos - Sector A"
                      value={formData.descripcion}
                      onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                      maxLength={500}
                    />
                    <small className="text-muted">Descripción general de las actividades del día</small>
                  </div>

                  <div className="col-md-6 mb-3">
                    <label className="form-label">Hora de Inicio (Opcional)</label>
                    <input
                      type="time"
                      className="form-control"
                      value={formData.horaInicio}
                      onChange={(e) => setFormData(prev => ({ ...prev, horaInicio: e.target.value }))}
                    />
                  </div>

                  <div className="col-md-6 mb-3">
                    <label className="form-label">Hora de Fin (Opcional)</label>
                    <input
                      type="time"
                      className="form-control"
                      value={formData.horaFin}
                      onChange={(e) => setFormData(prev => ({ ...prev, horaFin: e.target.value }))}
                    />
                  </div>
                </div>

                {!etapaDiariaInicial && getFechasSugeridas().length > 0 && (
                  <div className="mt-2">
                    <div className="dropdown">
                      <button
                        className="btn btn-outline-primary btn-sm dropdown-toggle"
                        type="button"
                        data-bs-toggle="dropdown"
                      >
                        <i className="fas fa-lightbulb me-1"></i>
                        Fechas Sugeridas
                      </button>
                        <ul className="dropdown-menu">
                          {getFechasSugeridas().map((item, idx) => (
                            <li key={idx}>
                              <button
                                className="dropdown-item"
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, fecha: item.fecha }))}
                              >
                                {(() => {
                                  const fechaStr = item.fecha;
                                  if (fechaStr.includes('-')) {
                                    const soloFecha = fechaStr.split('T')[0];
                                    const [year, month, day] = soloFecha.split('-');
                                    const fecha = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
                                    return fecha.toLocaleDateString('es-AR', {
                                      weekday: 'long',
                                      day: '2-digit',
                                      month: '2-digit'
                                    });
                                  }
                                  return new Date(fechaStr + 'T00:00:00').toLocaleDateString('es-AR', {
                                    weekday: 'long',
                                    day: '2-digit',
                                    month: '2-digit'
                                  });
                                })()}
                              </button>
                            </li>
                          ))}
                        </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* TAREAS DEL DÍA */}
            <div className="card mb-3">
              <div className="card-header bg-light d-flex justify-content-between align-items-center">
                <h6 className="mb-0">
                  <i className="fas fa-tasks me-2"></i>
                  Tareas del Día ({formData.tareas.length})
                </h6>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={handleNuevaTarea}
                >
                  <i className="fas fa-plus me-1"></i>
                  Nueva Tarea
                </button>
              </div>
              <div className="card-body">
                {/* Formulario para agregar/editar tarea */}
                {mostrarFormTarea && (
                  <div className="border border-primary rounded p-3 mb-3 bg-light">
                    <h6 className="text-primary mb-3">
                      {editandoTareaIndex !== null ? 'Editar Tarea' : 'Nueva Tarea'}
                    </h6>

                    <div className="mb-3">
                      <label className="form-label">Descripción *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={nuevaTarea.descripcion}
                        onChange={(e) => setNuevaTarea(prev => ({ ...prev, descripcion: e.target.value }))}
                        placeholder="Ej: Hacer todo el baño, Instalar azulejos cocina"
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Estado de la Tarea</label>
                      <select
                        className="form-select"
                        value={nuevaTarea.estado}
                        onChange={(e) => setNuevaTarea(prev => ({ ...prev, estado: e.target.value }))}
                      >
                        <option value="PENDIENTE">⏳ Pendiente</option>
                        <option value="EN_PROCESO">🔄 En Proceso</option>
                        <option value="COMPLETADA">✅ Completada</option>
                      </select>
                    </div>

                    {/* Profesionales asignados a esta tarea */}
                    <div className="mb-3">
                      <label className="form-label">Profesionales Asignados a esta Tarea</label>
                      <div className="mb-2">
                        <button
                          type="button"
                          className="btn btn-outline-primary w-100"
                          onClick={() => setMostrarModalSeleccionProfesionales(true)}
                        >
                          <i className="fas fa-users me-2"></i>
                          Seleccionar Profesionales
                          {nuevaTarea.profesionales.length > 0 && (
                            <span className="badge bg-primary ms-2">
                              {nuevaTarea.profesionales.length}
                            </span>
                          )}
                        </button>
                      </div>

                      {/* Lista de profesionales asignados */}
                      {nuevaTarea.profesionales.length > 0 && (
                        <div className="border rounded p-2">
                          {nuevaTarea.profesionales.map((prof) => (
                            <div key={prof.id} className="d-flex justify-content-between align-items-center mb-1">
                              <span className="small">
                                <i className="fas fa-user me-2"></i>
                                {prof.nombre}
                                <span className={`badge ${getTipoProfesionalBadgeClass(prof.tipoProfesional || prof.tipo)} ms-2`}>{prof.tipoProfesional || prof.tipo || ''}</span>
                              </span>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleQuitarProfesional(prof.id)}
                              >
                                <i className="fas fa-times"></i>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-success"
                        onClick={handleGuardarTarea}
                      >
                        <i className="fas fa-check me-2"></i>
                        {editandoTareaIndex !== null ? 'Actualizar' : 'Agregar'} Tarea
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={resetearFormTarea}
                      >
                        <i className="fas fa-times me-2"></i>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Lista de tareas agregadas */}
                {formData.tareas.length === 0 ? (
                  <div className="text-center text-muted py-4">
                    <i className="fas fa-tasks fa-3x mb-2"></i>
                    <p className="mb-0">No hay tareas agregadas para este día</p>
                    <small>Utilice el botón "Nueva Tarea" para agregar</small>
                  </div>
                ) : (
                  <div className="list-group">
                    {formData.tareas.map((tarea, index) => (
                      <div key={index} className="list-group-item">
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="flex-grow-1">
                            <h6 className="mb-2">
                              {getEstadoBadge(tarea.estado)} {tarea.descripcion}
                            </h6>

                            {tarea.profesionales && tarea.profesionales.length > 0 && (
                              <div className="mb-2">
                                <small className="text-muted">
                                  <i className="fas fa-users me-1"></i>
                                  Profesionales:
                                </small>
                                <div className="mt-1">
                                  {tarea.profesionales.map((prof, idx) => (
                                    <span key={idx} className="badge bg-primary me-1">
                                      {prof.nombre}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="btn-group">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => handleEditarTarea(index)}
                              title="Editar tarea"
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleEliminarTarea(index)}
                              title="Eliminar tarea"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Resumen de tareas */}
                {formData.tareas.length > 0 && (
                  <div className="alert alert-info mt-3 mb-0">
                    <div className="row text-center">
                      <div className="col-3">
                        <strong>{formData.tareas.length}</strong>
                        <br />
                        <small>Total</small>
                      </div>
                      <div className="col-3">
                        <strong className="text-secondary">
                          {formData.tareas.filter(t => t.estado === 'PENDIENTE').length}
                        </strong>
                        <br />
                        <small>Pendientes</small>
                      </div>
                      <div className="col-3">
                        <strong className="text-primary">
                          {formData.tareas.filter(t => t.estado === 'EN_PROCESO').length}
                        </strong>
                        <br />
                        <small>En Proceso</small>
                      </div>
                      <div className="col-3">
                        <strong className="text-success">
                          {formData.tareas.filter(t => t.estado === 'COMPLETADA').length}
                        </strong>
                        <br />
                        <small>Completadas</small>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* OBSERVACIONES GENERALES */}
            <div className="card">
              <div className="card-header bg-light">
                <h6 className="mb-0">
                  <i className="fas fa-comment-alt me-2"></i>
                  Observaciones Generales del Día
                </h6>
              </div>
              <div className="card-body">
                <textarea
                  className="form-control"
                  rows="3"
                  value={formData.observaciones}
                  onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
                  placeholder="Notas generales, clima, problemas encontrados, etc."
                ></textarea>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              <i className="fas fa-times me-2"></i>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleGuardar}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Guardando...
                </>
              ) : (
                <>
                  <i className="fas fa-save me-2"></i>
                  Guardar Etapa
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* Modal de selección de profesionales */}
    <SeleccionarProfesionalesModal
      show={mostrarModalSeleccionProfesionales}
      onHide={() => setMostrarModalSeleccionProfesionales(false)}
      profesionalesDisponibles={profesionalesDisponibles}
      profesionalesSeleccionados={nuevaTarea.profesionales}
      onConfirmar={handleConfirmarProfesionales}
      dias={formData.fecha ? [formData.fecha] : []}
      asignacionesExistentes={[]}
    />
    </>
  );
};

export default EtapaDiariaModal;
