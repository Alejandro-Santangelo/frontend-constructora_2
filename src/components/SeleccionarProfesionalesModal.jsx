import React, { useState, useMemo, useEffect } from 'react';
import apiService from '../services/api';



const configRubros = {
  'Albañilería': {
    orden: 1,
    color: '#8B4513',
    emoji: '🧱',
    tipos: ['Oficial Albañil', 'Medio Oficial Albañil', 'Ayudante Albañil', 'Peón', 'Mampostero']
  },
  'Electricidad': {
    orden: 2,
    color: '#FFD700',
    emoji: '⚡',
    tipos: ['Oficial Electricista', 'Medio Oficial Electricista', 'Ayudante Electricista', 'Técnico Electricista']
  },
  'Plomería y Gas': {
    orden: 3,
    color: '#20B2AA',
    emoji: '🔧',
    tipos: ['Oficial Plomero', 'Medio Oficial Plomero', 'Ayudante Plomero', 'Gasista Matriculado']
  },
  'Pintura': {
    orden: 4,
    color: '#4169E1',
    emoji: '🎨',
    tipos: ['Oficial Pintor', 'Medio Oficial Pintor', 'Ayudante Pintor', 'Empapelador']
  },
  'Carpintería': {
    orden: 5,
    color: '#795548',
    emoji: '🪚',
    tipos: ['Oficial Carpintero', 'Ayudante Carpintero', 'Ebanista']
  },
  'Herrería': {
    orden: 6,
    color: '#607D8B',
    emoji: '⛓️',
    tipos: ['Oficial Herrero', 'Ayudante Herrero', 'Soldador']
  },
  'Construcción en Seco': {
    orden: 7,
    color: '#9E9E9E',
    emoji: '🏗️',
    tipos: ['Oficial Yesero', 'Ayudante Yesero', 'Durlockista']
  },
  'Pisos y Revestimientos': {
    orden: 8,
    color: '#FFB74D',
    emoji: '🔳',
    tipos: ['Oficial Solador', 'Oficial Ceramista', 'Marmolero']
  },
  'Techos': {
    orden: 9,
    color: '#5C6BC0',
    emoji: '🏠',
    tipos: ['Techista', 'Zinguero']
  },
  'Profesionales': {
    orden: 10,
    color: '#2E7D32',
    emoji: '📐',
    tipos: ['Arquitecto', 'Ingeniero Civil', 'Maestro Mayor de Obras']
  },
  'Supervisión': {
    orden: 11,
    color: '#673AB7',
    emoji: '📋',
    tipos: ['Jefe de Obra', 'Capataz', 'Encargado']
  },
  'Otros': {
    orden: 99,
    color: '#6c757d',
    emoji: '👷',
    tipos: ['Peón General', 'Sereno', 'Limpieza', 'Jardinero', 'Otros']
  }
};

const SeleccionarProfesionalesModal = ({
  show,
  onHide,
  profesionalesDisponibles = [],
  profesionalesSeleccionados = [],
  onConfirmar,
  asignacionesExistentes = [], // Todas las asignaciones existentes en la obra
  fechaInicio = null, // Fecha de inicio de la asignación actual
  fechaFin = null, // Fecha de fin de la asignación actual
  semanaActual = null, // Información de la semana actual (para asignación semanal)
  empresaId = null,
  onNuevoProfesional = null, // Callback para abrir modal externo de agregar profesional
  showNotification = null // Callback para mostrar notificaciones
}) => {
  const [seleccionados, setSeleccionados] = useState(profesionalesSeleccionados.map(p => p.id));
  const [profesionalesLocales, setProfesionalesLocales] = useState([]);

  // 🆕 Estados para profesionales ad-hoc (creados manualmente)
  const [mostrarFormularioAdhoc, setMostrarFormularioAdhoc] = useState(false);
  const [profesionalesAdhoc, setProfesionalesAdhoc] = useState([]);
  const [profesionalAdhocForm, setProfesionalAdhocForm] = useState({
    nombre: '',
    tipoProfesional: '',
    honorarioDia: '',
    telefono: '',
    email: ''
  });
  const [guardarEnCatalogo, setGuardarEnCatalogo] = useState(false);
  const [guardandoProfesional, setGuardandoProfesional] = useState(false);

  // DEBUG: Check Main Modal Mount/Unmount with ID
  const instanceId = React.useMemo(() => Math.random().toString(36).substr(2, 5), []);
  useEffect(() => {
    console.log(`📍 [SeleccionarProfesionalesModal ${instanceId}] MOUNTED`);
    return () => console.log(`👋 [SeleccionarProfesionalesModal ${instanceId}] UNMOUNTED`);
  }, []);

  useEffect(() => {
    console.log(`👀 [SeleccionarProfesionalesModal ${instanceId}] prop show:`, show);
  }, [show]);

  // Actualizar seleccionados cuando cambien los profesionales seleccionados
  useEffect(() => {
    setSeleccionados(profesionalesSeleccionados.map(p => p.id));
  }, [profesionalesSeleccionados]);

  // Remover profesionales que ya no están disponibles cuando cambien las asignaciones
  useEffect(() => {
    if (seleccionados.length > 0 && asignacionesExistentes.length > 0) {
      const nuevosSeleccionados = seleccionados.filter(profId => {
        const disponibilidad = verificarDisponibilidadPorFechas(profId);
        return disponibilidad.disponible;
      });

      if (nuevosSeleccionados.length !== seleccionados.length) {
        console.log('🔄 Actualizando selección por cambios en disponibilidad');
        setSeleccionados(nuevosSeleccionados);
      }
    }
  }, [asignacionesExistentes, semanaActual, fechaInicio, fechaFin]);

  // Función para verificar si un profesional ya está asignado en las fechas especificadas
  const verificarDisponibilidadPorFechas = (profesionalId) => {
    if (!asignacionesExistentes || asignacionesExistentes.length === 0) {
      return { disponible: true, conflictos: [] };
    }

    const conflictos = [];

    // Si es asignación semanal (por semana)
    if (semanaActual && semanaActual.dias) {
      asignacionesExistentes.forEach(asignacion => {
        // TIPO 1: Verificar asignaciones SEMANALES
        if (asignacion.asignacionesPorSemana && Array.isArray(asignacion.asignacionesPorSemana)) {
          asignacion.asignacionesPorSemana.forEach(semanaAsig => {
            if (semanaAsig.detallesPorDia && Array.isArray(semanaAsig.detallesPorDia)) {
              semanaAsig.detallesPorDia.forEach(detalle => {
                // Verificar si este detalle es del profesional que estamos validando
                const esMismoProfesional =
                  detalle.profesionalId === profesionalId ||
                  parseInt(detalle.profesionalId) === parseInt(profesionalId);

                if (esMismoProfesional && detalle.fecha && detalle.cantidad > 0) {
                  const fechaDetalle = new Date(detalle.fecha).toDateString();
                  const hayConflicto = semanaActual.dias.some(dia => {
                    const diaActual = new Date(dia).toDateString();
                    return fechaDetalle === diaActual;
                  });

                  if (hayConflicto) {
                    // Evitar duplicados en conflictos
                    const yaExiste = conflictos.some(c => c.fecha === detalle.fecha);
                    if (!yaExiste) {
                      conflictos.push({
                        fecha: detalle.fecha,
                        obraNombre: asignacion.obraNombre || 'Obra no especificada',
                        cantidad: detalle.cantidad,
                        tipo: 'semanal'
                      });
                    }
                  }
                }
              });
            }
          });
        }

        // TIPO 2: Verificar asignaciones POR OBRA COMPLETA (fechaDesde/fechaHasta)
        if (asignacion.profesionalId === profesionalId && (asignacion.fechaDesde || asignacion.fechaHasta)) {
          const asigInicio = asignacion.fechaDesde ? new Date(asignacion.fechaDesde) : null;
          const asigFin = asignacion.fechaHasta ? new Date(asignacion.fechaHasta) : null;

          // Verificar si algún día de la semana actual cae dentro del rango de la asignación por obra
          const hayConflictoEnSemana = semanaActual.dias.some(dia => {
            const fechaDia = new Date(dia);
            const dentroRango = (!asigInicio || fechaDia >= asigInicio) && (!asigFin || fechaDia <= asigFin);
            return dentroRango;
          });

          if (hayConflictoEnSemana) {
            conflictos.push({
              fechaDesde: asignacion.fechaDesde,
              fechaHasta: asignacion.fechaHasta,
              obraNombre: asignacion.obraNombre || 'Obra no especificada',
              rubroNombre: asignacion.rubroNombre,
              tipo: 'obra-completa'
            });
          }
        }
      });
    }
    // Si es asignación por obra completa (con fechas de inicio y fin)
    else if (fechaInicio || fechaFin) {
      const inicio = fechaInicio ? new Date(fechaInicio) : null;
      const fin = fechaFin ? new Date(fechaFin) : null;

      asignacionesExistentes.forEach(asignacion => {
        // TIPO 1: Para asignaciones SEMANALES, extraer las fechas de los detalles
        if (asignacion.asignacionesPorSemana && Array.isArray(asignacion.asignacionesPorSemana)) {
          let tieneProfesional = false;
          let fechasConflicto = [];

          asignacion.asignacionesPorSemana.forEach(semanaAsig => {
            if (semanaAsig.detallesPorDia && Array.isArray(semanaAsig.detallesPorDia)) {
              semanaAsig.detallesPorDia.forEach(detalle => {
                const esMismoProfesional =
                  detalle.profesionalId === profesionalId ||
                  parseInt(detalle.profesionalId) === parseInt(profesionalId);

                if (esMismoProfesional && detalle.cantidad > 0 && detalle.fecha) {
                  tieneProfesional = true;
                  const fechaDetalle = new Date(detalle.fecha);

                  // Verificar solapamiento con el rango solicitado
                  if ((!inicio || fechaDetalle >= inicio) && (!fin || fechaDetalle <= fin)) {
                    fechasConflicto.push(detalle.fecha);
                  }
                }
              });
            }
          });

          if (tieneProfesional && fechasConflicto.length > 0) {
            const fechaMin = fechasConflicto.reduce((min, f) => f < min ? f : min, fechasConflicto[0]);
            const fechaMax = fechasConflicto.reduce((max, f) => f > max ? f : max, fechasConflicto[0]);

            conflictos.push({
              fechaDesde: fechaMin,
              fechaHasta: fechaMax,
              obraNombre: asignacion.obraNombre || 'Obra no especificada',
              cantidadDias: fechasConflicto.length,
              tipo: 'semanal'
            });
          }
        }

        // TIPO 2: Para asignaciones POR OBRA COMPLETA con fechaDesde/fechaHasta
        if (asignacion.profesionalId === profesionalId && (asignacion.fechaDesde || asignacion.fechaHasta)) {
          const asigInicio = asignacion.fechaDesde ? new Date(asignacion.fechaDesde) : null;
          const asigFin = asignacion.fechaHasta ? new Date(asignacion.fechaHasta) : null;

          // Verificar solapamiento de fechas
          let hayConflicto = false;

          if (inicio && asigFin && inicio <= asigFin && (!fin || fin >= asigInicio)) {
            hayConflicto = true;
          } else if (fin && asigInicio && fin >= asigInicio && (!inicio || inicio <= asigFin)) {
            hayConflicto = true;
          } else if (!inicio && !fin && (asigInicio || asigFin)) {
            // Si no hay fechas específicas en la nueva asignación, considerar conflicto
            hayConflicto = true;
          }

          if (hayConflicto) {
            conflictos.push({
              fechaDesde: asignacion.fechaDesde,
              fechaHasta: asignacion.fechaHasta,
              obraNombre: asignacion.obraNombre || 'Obra no especificada',
              rubroNombre: asignacion.rubroNombre,
              tipo: 'obra-completa'
            });
          }
        }
      });
    }

    return {
      disponible: conflictos.length === 0,
      conflictos
    };
  };

  const handleToggle = (profesionalId) => {
    setSeleccionados(prev => {
      if (prev.includes(profesionalId)) {
        return prev.filter(id => id !== profesionalId);
      } else {
        return [...prev, profesionalId];
      }
    });
  };

  const handleConfirmar = () => {
    const todos = [...profesionalesDisponibles, ...profesionalesLocales, ...profesionalesAdhoc];
    // Filtrar duplicados por ID por si acaso
    const unicosMap = new Map();
    todos.forEach(p => unicosMap.set(p.id, p));
    const unicos = Array.from(unicosMap.values());

    const profesionales = unicos.filter(p => seleccionados.includes(p.id));
    onConfirmar(profesionales);
    onHide();
  };

  // 🆕 Handlers para profesionales ad-hoc
  const handleAgregarAdhoc = async () => {
    if (!profesionalAdhocForm.nombre.trim() || !profesionalAdhocForm.tipoProfesional.trim()) {
      if (showNotification) {
        showNotification('Por favor complete al menos el nombre y tipo de profesional', 'warning');
      } else {
        alert('Por favor complete al menos el nombre y tipo de profesional');
      }
      return;
    }

    setGuardandoProfesional(true);

    try {
      let nuevoProfesional;

      // Si está marcado "Guardar en catálogo", crear en la BD
      if (guardarEnCatalogo) {
        if (!empresaId) {
          throw new Error('No se puede guardar: falta empresaId');
        }

        const dataProfesional = {
          nombre: profesionalAdhocForm.nombre.trim(),
          tipoProfesional: profesionalAdhocForm.tipoProfesional.trim(),
          honorarioDia: profesionalAdhocForm.honorarioDia ? parseFloat(profesionalAdhocForm.honorarioDia) : 0,
          telefono: profesionalAdhocForm.telefono.trim() || null,
          email: profesionalAdhocForm.email.trim() || null,
          empresaId: empresaId,
          activo: true,
          categoria: 'INDEPENDIENTE' // 🆕 Marca como profesional independiente
        };

        const response = await apiService.profesionales.create(dataProfesional);

        // Manejar diferentes estructuras de respuesta del backend
        const profesionalCreado = response?.data || response;

        if (!profesionalCreado || !profesionalCreado.id) {
          throw new Error('El backend no devolvió un profesional válido');
        }

        nuevoProfesional = {
          id: profesionalCreado.id,
          nombre: profesionalCreado.nombre || profesionalAdhocForm.nombre.trim(),
          tipoProfesional: profesionalCreado.tipoProfesional || profesionalAdhocForm.tipoProfesional.trim(),
          honorarioDia: profesionalCreado.honorarioDia || profesionalCreado.honorario_dia || (profesionalAdhocForm.honorarioDia ? parseFloat(profesionalAdhocForm.honorarioDia) : 0),
          telefono: profesionalCreado.telefono || profesionalAdhocForm.telefono.trim(),
          email: profesionalCreado.email || profesionalAdhocForm.email.trim(),
          activo: profesionalCreado.activo !== undefined ? profesionalCreado.activo : true,
          categoria: profesionalCreado.categoria || 'INDEPENDIENTE',
          _esGuardado: true // Flag para distinguir en la UI
        };

        if (showNotification) {
          showNotification('✅ Profesional guardado en catálogo permanente', 'success');
        }
      } else {
        // Crear profesional temporal (solo para esta asignación)
        nuevoProfesional = {
          id: `adhoc_${Date.now()}`,
          nombre: profesionalAdhocForm.nombre.trim(),
          tipoProfesional: profesionalAdhocForm.tipoProfesional.trim(),
          honorarioDia: profesionalAdhocForm.honorarioDia ? parseFloat(profesionalAdhocForm.honorarioDia) : 0,
          telefono: profesionalAdhocForm.telefono.trim(),
          email: profesionalAdhocForm.email.trim(),
          activo: true,
          _esAdhoc: true // Flag para temporales
        };

        if (showNotification) {
          showNotification('Profesional temporal agregado', 'success');
        }
      }

      setProfesionalesAdhoc(prev => [...prev, nuevoProfesional]);
      setSeleccionados(prev => [...prev, nuevoProfesional.id]);

      // Limpiar formulario
      setProfesionalAdhocForm({
        nombre: '',
        tipoProfesional: '',
        honorarioDia: '',
        telefono: '',
        email: ''
      });
      setGuardarEnCatalogo(false);

    } catch (error) {
      console.error('Error al agregar profesional:', error);
      if (showNotification) {
        showNotification(
          `❌ Error: ${error.response?.data?.message || error.message || 'No se pudo guardar el profesional'}`,
          'error'
        );
      } else {
        alert(`Error: ${error.response?.data?.message || error.message || 'No se pudo guardar el profesional'}`);
      }
    } finally {
      setGuardandoProfesional(false);
    }
  };

  const handleEliminarAdhoc = (profId) => {
    setProfesionalesAdhoc(prev => prev.filter(p => p.id !== profId));
    setSeleccionados(prev => prev.filter(id => id !== profId));
  };

  // Asignar rubro a cada tipo de profesional
  const getRubroPorTipo = (tipo) => {
    if (!tipo) return 'Otros';
    const tipoNormalizado = tipo.trim(); // No uppercase para comparar exacto primero

    for (const [rubro, config] of Object.entries(configRubros)) {
      if (config.tipos.includes(tipoNormalizado)) {
        return rubro;
      }
      // Búsqueda parcial si no hay match exacto (fallback)
      if (config.tipos.some(t => tipo.toUpperCase().includes(t.toUpperCase().replace('OFICIAL ', '').replace('AYUDANTE ', '')))) {
         return rubro;
      }
    }
    return 'Otros';
  };

  // Agrupar profesionales por rubro y tipo
  const profesionalesPorRubro = useMemo(() => {
    const todos = [...profesionalesDisponibles, ...profesionalesLocales, ...profesionalesAdhoc];
    // Filtrar duplicados
    const unicosMap = new Map();
    todos.forEach(p => unicosMap.set(p.id, p));
    const todosUnicos = Array.from(unicosMap.values());

    const profesionalesActivos = todosUnicos.filter(p => p.activo);

    const agrupados = {};

    profesionalesActivos.forEach(prof => {
      const tipo = prof.tipoProfesional || 'Sin Categoría';
      const rubro = getRubroPorTipo(tipo);

      if (!agrupados[rubro]) {
        agrupados[rubro] = {};
      }

      if (!agrupados[rubro][tipo]) {
        agrupados[rubro][tipo] = [];
      }

      agrupados[rubro][tipo].push(prof);
    });

    return agrupados;
  }, [profesionalesDisponibles, profesionalesLocales, profesionalesAdhoc]);

  // Ordenar rubros
  const rubrosOrdenados = Object.keys(profesionalesPorRubro).sort((a, b) => {
    const ordenA = configRubros[a]?.orden || 999;
    const ordenB = configRubros[b]?.orden || 999;
    return ordenA - ordenB;
  });

  // if (!show) return null; // COMENTADO PARA EVITAR DESMONTAJE - Usaremos CSS display

  if (!show) {
      // Retornar un div vacío oculto para mantener el componente montado pero invisible
      // Ojo: Si retornamos null, el efecto se mantiene, pero si retornamos algo diferente al render principal...
      // Mejor estrategia: Renderizar todo pero oculto.
      // Pero 'modal show' de bootstrap lo hace visible.
      // Retornaremos null por ahora para comprobar teoría, pero si falla, pasamos a display none.
      // Wait, user says he sees UNMOUNTED. So it IS unmounting.
      // Returning null does NOT unmount.
      // So parent IS removing it.
      // BUT let's try returning an empty div instead of null.
      // return <div style={{display: 'none'}}></div>;
  }

  // ESTRATEGIA: Renderizado condicional por CSS
  const displayStyle = show ? { display: 'block', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 } : { display: 'none' };

  // Si no está show, no renderizamos el contenido pesado para performance, pero mantenemos el wrapper?
  // No, si queremos persistencia de estado (input form), debemos renderizar TODO.

  return (
    <div className={`modal ${show ? 'show' : ''}`} style={displayStyle}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="fas fa-users me-2"></i>
              Seleccionar Profesionales
            </h5>
            <button type="button" className="btn btn-light btn-sm ms-auto" onClick={onHide}>
              Cerrar
            </button>
          </div>

          <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {/* 🆕 Tabs: Seleccionar de Lista vs Agregar Manualmente */}
            <ul className="nav nav-pills mb-4">
              <li className="nav-item">
                <button
                  className={`nav-link ${!mostrarFormularioAdhoc ? 'active' : ''}`}
                  onClick={() => setMostrarFormularioAdhoc(false)}
                  style={{
                    background: !mostrarFormularioAdhoc
                      ? 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)'
                      : 'transparent',
                    color: !mostrarFormularioAdhoc ? '#fff' : '#6c757d',
                    border: !mostrarFormularioAdhoc ? 'none' : '1px solid #dee2e6',
                    fontWeight: '600'
                  }}
                >
                  <i className="fas fa-list me-2"></i>
                  Seleccionar de Lista
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${mostrarFormularioAdhoc ? 'active' : ''}`}
                  onClick={() => setMostrarFormularioAdhoc(true)}
                  style={{
                    background: mostrarFormularioAdhoc
                      ? 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)'
                      : 'transparent',
                    color: mostrarFormularioAdhoc ? '#fff' : '#6c757d',
                    border: mostrarFormularioAdhoc ? 'none' : '1px solid #dee2e6',
                    fontWeight: '600'
                  }}
                >
                  <i className="fas fa-user-plus me-2"></i>
                  Agregar Manualmente
                </button>
              </li>
            </ul>

            {/* Contenido condicional según tab activa */}
            {!mostrarFormularioAdhoc ? (
              // TAB 1: Seleccionar de Lista
              <>
                <div className="alert alert-info mb-3">
                  <i className="fas fa-info-circle me-2"></i>
                  <strong>Selecciona uno o varios profesionales</strong> para asignar a esta obra.
                  Puedes marcar varios a la vez y confirmar al final.
                </div>

                {seleccionados.length > 0 && (
                  <div className="alert alert-success mb-3">
                    <i className="fas fa-check-circle me-2"></i>
                    <strong>{seleccionados.length} profesional{seleccionados.length !== 1 ? 'es' : ''} seleccionado{seleccionados.length !== 1 ? 's' : ''}</strong>
                  </div>
                )}

                {rubrosOrdenados.map(rubro => {
                  const configRubro = configRubros[rubro];
                  const tiposProfesionales = profesionalesPorRubro[rubro];
                  const tiposOrdenados = Object.keys(tiposProfesionales).sort((a, b) => {
                    const indexA = configRubro.tipos.indexOf(a);
                    const indexB = configRubro.tipos.indexOf(b);
                    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
                    if (indexA === -1) return 1;
                    if (indexB === -1) return -1;
                    return indexA - indexB;
                  });

                  // Calcular total de profesionales en el rubro
                  const totalProfesionales = Object.values(tiposProfesionales).reduce(
                    (sum, profs) => sum + profs.length, 0
                  );

                  return (
                    <div key={rubro} className="mb-4">
                      {/* Título del Rubro */}
                      <div className="d-flex align-items-center mb-3 pb-2 border-bottom border-3" style={{ borderColor: configRubro.color + '!important' }}>
                        <h5 className="mb-0 fw-bold" style={{ color: configRubro.color }}>
                          <span className="me-2" style={{ fontSize: '1.3em' }}>{configRubro.emoji}</span>
                          {rubro}
                          <span className="badge ms-2" style={{
                            backgroundColor: configRubro.color,
                            fontSize: '0.75em'
                          }}>
                            {totalProfesionales} {totalProfesionales === 1 ? 'profesional' : 'profesionales'}
                          </span>
                        </h5>
                      </div>

                      {/* Tipos de profesionales dentro del rubro */}
                      {tiposOrdenados.map(tipo => {
                        const profesionales = tiposProfesionales[tipo].sort((a, b) =>
                          a.nombre.localeCompare(b.nombre)
                        );

                        return (
                          <div key={tipo} className="mb-3 ms-3">
                            <h6 className="mb-2" style={{ color: configRubro.color, opacity: 0.8 }}>
                              <i className="fas fa-angle-right me-2"></i>
                              {tipo}
                              <span className="badge bg-light text-dark ms-2" style={{ fontSize: '0.75em' }}>
                                {profesionales.length}
                              </span>
                            </h6>

                            <div className="list-group ms-3">
                              {profesionales.map(prof => {
                                const obras = prof.cantidadObrasAsignadas || 0;
                                const estaSeleccionado = seleccionados.includes(prof.id);

                                // Verificar disponibilidad por fechas en la obra actual
                                const disponibilidad = verificarDisponibilidadPorFechas(prof.id);
                                // Solo marcar como no disponible si hay conflictos de fechas en ESTA obra
                                // La disponibilidad general (sin asignaciones en otras obras) ya está filtrada por el componente padre
                                const noDisponible = !disponibilidad.disponible;

                                return (
                                  <div
                                    key={prof.id}
                                    className={`list-group-item list-group-item-action ${estaSeleccionado ? 'active' : ''} ${noDisponible ? 'border-danger' : ''}`}
                                    style={{ cursor: noDisponible ? 'not-allowed' : 'pointer', opacity: noDisponible ? 0.7 : 1 }}
                                    onClick={() => !noDisponible && handleToggle(prof.id)}
                                  >
                                    <div className="d-flex align-items-center">
                                      <input
                                        type="checkbox"
                                        className="form-check-input me-3"
                                        checked={estaSeleccionado}
                                        disabled={noDisponible}
                                        onChange={() => handleToggle(prof.id)}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <div className="flex-grow-1">
                                        <div className="d-flex justify-content-between align-items-center">
                                          <strong>{prof.nombre}</strong>
                                          {noDisponible ? (
                                            <span className="badge bg-danger">
                                              Conflicto de fechas
                                            </span>
                                          ) : (
                                            <span className="badge bg-success">Disponible</span>
                                          )}
                                        </div>
                                        {prof.email && (
                                          <small className="text-muted d-block mt-1">
                                            <i className="fas fa-envelope me-1"></i>
                                            {prof.email}
                                          </small>
                                        )}

                                        {/* Mostrar advertencia si el profesional tiene conflictos de fechas en ESTA obra */}
                                        {noDisponible && (
                                          <div className="mt-2 p-2 bg-danger bg-opacity-10 rounded border border-danger">
                                            <small className="text-danger fw-bold d-block mb-2">
                                              <i className="fas fa-exclamation-triangle me-1"></i>
                                              {prof.nombre} ya está asignado en fechas que se solapan con esta asignación
                                            </small>
                                            <small className="text-danger d-block mb-2" style={{ lineHeight: '1.4' }}>
                                              Conflictos encontrados en esta obra:
                                            </small>
                                            {disponibilidad.conflictos.length > 0 ? (
                                              disponibilidad.conflictos.map((conflicto, idx) => (
                                                <small key={idx} className="text-danger d-block ms-3 mb-1">
                                                  <strong>• {conflicto.obraNombre || 'Esta obra'}</strong>
                                                  {conflicto.fecha && ` - ${new Date(conflicto.fecha).toLocaleDateString('es-AR')}`}
                                                  {conflicto.fechaDesde && ` - Desde ${new Date(conflicto.fechaDesde).toLocaleDateString('es-AR')}`}
                                                  {conflicto.fechaHasta && ` hasta ${new Date(conflicto.fechaHasta).toLocaleDateString('es-AR')}`}
                                                </small>
                                              ))
                                            ) : (
                                              <small className="text-danger d-block ms-3 mb-1">
                                                <i className="fas fa-info-circle me-1"></i>
                                                Fechas en conflicto (detalles no especificados)
                                              </small>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {(profesionalesDisponibles.length === 0 && profesionalesLocales.length === 0 && profesionalesAdhoc.length === 0) && (
                  <div className="alert alert-warning">
                    <i className="fas fa-exclamation-triangle me-2"></i>
                    No hay profesionales disponibles
                  </div>
                )}
              </>
            ) : (
              // TAB 2: Agregar Manualmente
              <>
                <div className="alert alert-info mb-3">
                  <i className="fas fa-lightbulb me-2"></i>
                  <strong>Profesionales temporales:</strong> Los profesionales creados aquí son temporales
                  y solo se agregarán a esta planificación. No se guardarán en el catálogo permanente.
                </div>

                {/* Formulario para crear profesional ad-hoc */}
                <div className="card mb-3">
                  <div className="card-body">
                    <h6 className="card-title mb-3">
                      <i className="fas fa-user-plus me-2"></i>
                      Nuevo Profesional Temporal
                    </h6>

                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label">
                          Nombre <span className="text-danger">*</span>
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          value={profesionalAdhocForm.nombre}
                          onChange={(e) => setProfesionalAdhocForm({ ...profesionalAdhocForm, nombre: e.target.value })}
                          placeholder="Nombre del profesional"
                        />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label">
                          Tipo de Profesional <span className="text-danger">*</span>
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          value={profesionalAdhocForm.tipoProfesional}
                          onChange={(e) => setProfesionalAdhocForm({ ...profesionalAdhocForm, tipoProfesional: e.target.value })}
                          placeholder="Ej: Albañil, Electricista, Plomero"
                        />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label">Honorario por Día</label>
                        <input
                          type="number"
                          className="form-control"
                          value={profesionalAdhocForm.honorarioDia}
                          onChange={(e) => setProfesionalAdhocForm({ ...profesionalAdhocForm, honorarioDia: e.target.value })}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                        />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label">Teléfono</label>
                        <input
                          type="tel"
                          className="form-control"
                          value={profesionalAdhocForm.telefono}
                          onChange={(e) => setProfesionalAdhocForm({ ...profesionalAdhocForm, telefono: e.target.value })}
                          placeholder="Ej: +54 9 11 1234-5678"
                        />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label">Email</label>
                        <input
                          type="email"
                          className="form-control"
                          value={profesionalAdhocForm.email}
                          onChange={(e) => setProfesionalAdhocForm({ ...profesionalAdhocForm, email: e.target.value })}
                          placeholder="email@ejemplo.com"
                        />
                      </div>
                    </div>

                    {/* 🆕 Checkbox para guardar en catálogo */}
                    <div className="mt-3">
                      <div className="card bg-light border-primary">
                        <div className="card-body py-2">
                          <div className="form-check">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              id="guardarEnCatalogo"
                              checked={guardarEnCatalogo}
                              onChange={(e) => setGuardarEnCatalogo(e.target.checked)}
                            />
                            <label className="form-check-label" htmlFor="guardarEnCatalogo">
                              <strong>
                                <i className="fas fa-save me-2 text-primary"></i>
                                Guardar en catálogo permanente
                              </strong>
                              <small className="d-block text-muted mt-1">
                                {guardarEnCatalogo
                                  ? '✅ Este profesional se guardará como INDEPENDIENTE y estará disponible para futuras asignaciones'
                                  : '⚠️ Solo se agregará temporalmente a esta asignación (no se guardará en el catálogo)'}
                              </small>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-end">
                      <button
                        className="btn btn-success"
                        onClick={handleAgregarAdhoc}
                        disabled={guardandoProfesional}
                      >
                        {guardandoProfesional ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                            Guardando...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-plus-circle me-2"></i>
                            {guardarEnCatalogo ? 'Guardar en Catálogo' : 'Agregar Profesional'}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Lista de profesionales ad-hoc creados */}
                {profesionalesAdhoc.length > 0 && (
                  <>
                    <h6 className="mb-3">
                      <i className="fas fa-users me-2"></i>
                      Profesionales Temporales Agregados ({profesionalesAdhoc.length})
                    </h6>

                    <div className="list-group">
                      {profesionalesAdhoc.map(prof => (
                        <div key={prof.id} className="list-group-item">
                          <div className="d-flex justify-content-between align-items-start">
                            <div className="flex-grow-1">
                              <div className="d-flex align-items-center mb-2">
                                <h6 className="mb-0 me-2">{prof.nombre}</h6>
                                {prof._esGuardado ? (
                                  <span className="badge bg-success">
                                    <i className="fas fa-check-circle me-1"></i>
                                    Guardado en Catálogo
                                  </span>
                                ) : (
                                  <span className="badge bg-warning text-dark">
                                    <i className="fas fa-clock me-1"></i>
                                    Temporal
                                  </span>
                                )}
                              </div>
                              <div className="text-muted small">
                                <div><strong>Tipo:</strong> {prof.tipoProfesional}</div>
                                {prof.honorarioDia > 0 && (
                                  <div><strong>Honorario/día:</strong> ${prof.honorarioDia.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                                )}
                                {prof.telefono && (
                                  <div><strong>Teléfono:</strong> {prof.telefono}</div>
                                )}
                                {prof.email && (
                                  <div><strong>Email:</strong> {prof.email}</div>
                                )}
                              </div>
                            </div>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleEliminarAdhoc(prof.id)}
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {profesionalesAdhoc.length === 0 && (
                  <div className="alert alert-secondary">
                    <i className="fas fa-info-circle me-2"></i>
                    No hay profesionales temporales agregados. Usa el formulario de arriba para crear uno.
                  </div>
                )}
              </>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onHide}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirmar}
              disabled={seleccionados.length === 0}
            >
              <i className="fas fa-check me-2"></i>
              Confirmar Selección ({seleccionados.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeleccionarProfesionalesModal;
