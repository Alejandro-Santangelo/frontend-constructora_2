import React, { useState, useMemo, useEffect } from 'react';

const SeleccionarProfesionalesModal = ({
  show,
  onHide,
  profesionalesDisponibles = [],
  profesionalesSeleccionados = [],
  onConfirmar,
  asignacionesExistentes = [], // Todas las asignaciones existentes en la obra
  fechaInicio = null, // Fecha de inicio de la asignación actual
  fechaFin = null, // Fecha de fin de la asignación actual
  semanaActual = null // Información de la semana actual (para asignación semanal)
}) => {
  const [seleccionados, setSeleccionados] = useState(profesionalesSeleccionados.map(p => p.id));

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
    const profesionales = profesionalesDisponibles.filter(p => seleccionados.includes(p.id));
    onConfirmar(profesionales);
    onHide();
  };

  // Configuración de rubros y tipos de profesionales
  const configRubros = {
    'Albañilería': {
      orden: 1,
      color: '#8B4513',
      emoji: '🧱',
      tipos: ['Oficial Albañil', 'Ayudante Albañil', 'Aprendiz Albañil']
    },
    'Pintura': {
      orden: 2,
      color: '#4169E1',
      emoji: '🎨',
      tipos: ['Oficial Pintor', 'Ayudante Pintor', 'Aprendiz Pintor']
    },
    'Plomería': {
      orden: 3,
      color: '#20B2AA',
      emoji: '🔧',
      tipos: ['Oficial Plomero', 'Ayudante Plomero', 'Aprendiz Plomero']
    },
    'Electricidad': {
      orden: 4,
      color: '#FFD700',
      emoji: '⚡',
      tipos: ['Oficial Electricista', 'Ayudante Electricista', 'Aprendiz Electricista']
    },
    'Otros': {
      orden: 99,
      color: '#6c757d',
      emoji: '👷',
      tipos: []
    }
  };

  // Asignar rubro a cada tipo de profesional
  const getRubroPorTipo = (tipo) => {
    for (const [rubro, config] of Object.entries(configRubros)) {
      if (config.tipos.includes(tipo)) {
        return rubro;
      }
    }
    return 'Otros';
  };

  // Agrupar profesionales por rubro y tipo
  const profesionalesPorRubro = useMemo(() => {
    const profesionalesActivos = profesionalesDisponibles.filter(p => p.activo);

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
  }, [profesionalesDisponibles]);

  // Ordenar rubros
  const rubrosOrdenados = Object.keys(profesionalesPorRubro).sort((a, b) => {
    const ordenA = configRubros[a]?.orden || 999;
    const ordenB = configRubros[b]?.orden || 999;
    return ordenA - ordenB;
  });

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}>
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

            {profesionalesDisponibles.length === 0 && (
              <div className="alert alert-warning">
                <i className="fas fa-exclamation-triangle me-2"></i>
                No hay profesionales disponibles
              </div>
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
