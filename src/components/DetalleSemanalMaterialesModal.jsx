import React from 'react';
import { esDiaHabil, esFeriado } from '../utils/feriadosArgentina';

const DetalleSemanalMaterialesModal = ({
  show,
  onClose,
  obra,
  numeroSemana,
  configuracionObra,
  materialesDisponibles = [],
  asignaciones = [],
  onAbrirAsignacionParaDia, // Nueva función para abrir formulario con fecha específica
  onAsignarParaTodaLaSemana // Nueva función para asignar a toda la semana
}) => {

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

  const calcularDiasHabilesSemana = (numeroSemana) => {
    if (!configuracionObra?.fechaInicio) return [];

    const fechaInicio = parsearFechaLocal(configuracionObra.fechaInicio);

    // Encontrar el primer lunes
    const primerLunes = new Date(fechaInicio.getTime());
    const diaSemanaInicio = primerLunes.getDay();
    const diasHastaPrimerLunes = diaSemanaInicio === 0 ? -6 : 1 - diaSemanaInicio;
    primerLunes.setDate(primerLunes.getDate() + diasHastaPrimerLunes);

    // Calcular el lunes de la semana solicitada (calendario directo)
    const fechaLunes = new Date(primerLunes.getTime());
    fechaLunes.setDate(primerLunes.getDate() + ((numeroSemana - 1) * 7));

    const fechaInicioNormalizada = new Date(fechaInicio);
    fechaInicioNormalizada.setHours(0, 0, 0, 0);

    const todosLosDias = [];
    const nombresDias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

    for (let i = 0; i < 5; i++) {
      const dia = new Date(fechaLunes);
      dia.setDate(fechaLunes.getDate() + i);
      dia.setHours(0, 0, 0, 0);

      const esHabil = esDiaHabil(dia);
      const esDiaDelProyecto = dia >= fechaInicioNormalizada;
      const esInteractivo = esHabil && esDiaDelProyecto;

      let tipoDia = 'habil';
      let motivoNoHabil = '';

      if (dia.getDay() === 0 || dia.getDay() === 6) {
        tipoDia = 'fin-semana';
        motivoNoHabil = dia.getDay() === 0 ? 'Domingo' : 'Sábado';
      } else if (esFeriado(dia)) {
        tipoDia = 'feriado';
        motivoNoHabil = 'Feriado nacional';
      } else if (!esDiaDelProyecto) {
        tipoDia = 'pre-inicio';
        motivoNoHabil = 'Anterior al inicio del proyecto';
      }

      todosLosDias.push({
        fecha: new Date(dia),
        fechaStr: dia.toISOString().split('T')[0],
        nombre: nombresDias[i],
        numero: dia.getDate(),
        esInteractivo: esInteractivo,
        tipoDia: tipoDia,
        motivoNoHabil: motivoNoHabil
      });
    }

    return todosLosDias;
  };

  if (!show || !numeroSemana) return null;

  const diasSemana = calcularDiasHabilesSemana(numeroSemana);

  // Separar asignaciones semanales de diarias
  const asignacionesSemanales = asignaciones.filter(asig => asig.esSemanal === true);
  const asignacionesDiarias = asignaciones.filter(asig => !asig.esSemanal);

  // Función para obtener asignaciones de un día específico (solo diarias)
  const getAsignacionesDia = (fechaStr) => {
    return asignacionesDiarias.filter(asignacion => {
      const fechaAsignacion = new Date(asignacion.fechaAsignacion).toISOString().split('T')[0];
      return fechaAsignacion === fechaStr;
    });
  };

  return (
    <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1060}}>
      <div className="modal-dialog modal-xl">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">
              <i className="fas fa-calendar-week me-2"></i>
              Planificación Materiales - Semana {numeroSemana} - {obra?.nombre}
            </h5>
            <button
              type="button"
              className="btn btn-light btn-sm ms-auto"
              onClick={onClose}
            >
              Cerrar
            </button>
          </div>
          <div className="modal-body">
            <div className="alert alert-info mb-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <strong>📦 Materiales disponibles:</strong> {materialesDisponibles.length} items
                  {configuracionObra && (
                    <div className="mt-1">
                      <small>
                        Planificación para la semana del {diasSemana.find(d => d.esInteractivo)?.fecha?.toLocaleDateString('es-AR')}
                        al {diasSemana.filter(d => d.esInteractivo).pop()?.fecha?.toLocaleDateString('es-AR')}
                      </small>
                    </div>
                  )}
                </div>
                <div>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => {
                      if (onAsignarParaTodaLaSemana) {
                        onAsignarParaTodaLaSemana(numeroSemana);
                      }
                    }}
                  >
                    <i className="fas fa-calendar-week me-1"></i>
                    Asignar para toda la semana
                  </button>
                </div>
              </div>
            </div>

            {/* Sección de Asignaciones Semanales */}
            {asignacionesSemanales.length > 0 && (
              <div className="alert alert-success border-0 shadow-sm mb-4">
                <div className="d-flex align-items-center mb-2">
                  <i className="fas fa-calendar-week fs-5 me-2"></i>
                  <h6 className="mb-0 fw-bold">Materiales Asignados para Toda la Semana</h6>
                </div>
                <div className="table-responsive">
                  <table className="table table-sm table-hover mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Material</th>
                        <th>Cantidad</th>
                        <th>Unidad</th>
                        <th>Observaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asignacionesSemanales.map((asig, idx) => (
                        <tr key={idx}>
                          <td className="fw-bold">{asig.nombreMaterial || asig.nombre || asig.presupuestoMaterial?.nombre || 'Material'}</td>
                          <td>{asig.cantidadAsignada ?? asig.cantidad}</td>
                          <td><span className="badge bg-secondary">{asig.unidadMedida || asig.unidad || asig.presupuestoMaterial?.unidad || ''}</span></td>
                          <td className="text-muted small">{asig.observaciones || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="row">
              {diasSemana.map((dia, index) => {
                const asignacionesDia = getAsignacionesDia(dia.fechaStr);

                // Determinar estilos basados en el tipo de día
                let cardClass = 'card ';
                let headerClass = '';
                let textClass = '';

                if (dia.tipoDia === 'habil' && dia.esInteractivo) {
                  // Día hábil normal
                  cardClass += 'border-primary';
                  headerClass = 'bg-primary text-white';
                  textClass = 'text-primary';
                } else if (dia.tipoDia === 'fin-semana') {
                  // Fin de semana
                  cardClass += 'border-secondary';
                  headerClass = 'bg-secondary text-white';
                  textClass = 'text-secondary';
                } else if (dia.tipoDia === 'feriado') {
                  // Feriado
                  cardClass += 'border-danger';
                  headerClass = 'bg-danger text-white';
                  textClass = 'text-danger';
                } else if (dia.tipoDia === 'pre-inicio') {
                  // Anterior al inicio del proyecto
                  cardClass += 'border-muted';
                  headerClass = 'bg-light text-muted';
                  textClass = 'text-muted';
                }

                return (
                <div key={index} className="col-md-4 col-lg-2 mb-3">
                  <div className={cardClass}>
                    <div className={`card-header text-center py-2 ${headerClass}`}>
                      <strong>{dia.nombre}</strong>
                      <br />
                      <small>{dia.numero}/{(new Date(dia.fecha).getMonth() + 1)}</small>
                      {!dia.esInteractivo && (
                        <>
                          <br />
                          <small className="fst-italic">({dia.motivoNoHabil})</small>
                        </>
                      )}
                    </div>
                    <div className="card-body p-2">
                      <h6 className={`mb-2 ${textClass}`}>
                        <i className="fas fa-boxes me-1"></i>
                        Materiales
                      </h6>

                      {dia.esInteractivo ? (
                        // Día interactivo - mostrar botones y asignaciones normalmente
                        <>
                          <div className="mb-2">
                            <button
                              className="btn btn-sm btn-outline-success w-100"
                              onClick={() => {
                                if (onAbrirAsignacionParaDia) {
                                  onAbrirAsignacionParaDia(dia.fechaStr);
                                }
                              }}
                            >
                              <i className="fas fa-plus me-1"></i>
                              Agregar
                            </button>
                          </div>

                          {/* Lista de materiales asignados a este día */}
                          <div className="small">
                            {asignacionesDia.length > 0 ? (
                              asignacionesDia.map((asignacion, idx) => (
                                <div key={idx} className="border-bottom pb-1 mb-1">
                                  <small className="text-success d-block">
                                    <strong>{asignacion.nombreMaterial || 'Material'}</strong>
                                  </small>
                                  <small className="text-muted">
                                    Cant: {asignacion.cantidadAsignada || asignacion.cantidad}
                                    {asignacion.observaciones && (
                                      <span className="d-block" style={{fontSize: '0.7rem'}}>
                                        📝 {asignacion.observaciones}
                                      </span>
                                    )}
                                  </small>
                                </div>
                              ))
                            ) : (
                              <small className="text-muted">Sin materiales asignados</small>
                            )}
                          </div>
                        </>
                      ) : (
                        // Día no interactivo - solo mostrar información
                        <div className="small">
                          <div className="text-center p-3">
                            <i className={`fas ${dia.tipoDia === 'fin-semana' ? 'fa-calendar-times' : dia.tipoDia === 'feriado' ? 'fa-flag' : 'fa-clock'} ${textClass} mb-2`}></i>
                            <br />
                            <small className={textClass}>No laborable</small>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>

            <div className="alert alert-light mt-3">
              <i className="fas fa-info-circle me-2"></i>
              <strong>Planificación de la Semana {numeroSemana}:</strong>
              <ul className="mb-0 mt-2">
                <li>Organice el envío de materiales según las necesidades diarias</li>
                <li>Distribuya los gastos generales a lo largo de la semana</li>
                <li>Considere los tiempos de entrega y disponibilidad</li>
              </ul>
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              <i className="fas fa-arrow-left me-2"></i>
              Volver a Resumen
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                console.log('Guardar planificación de la semana', numeroSemana);
                // Aquí se guardaría la planificación
              }}
            >
              <i className="fas fa-save me-2"></i>
              Guardar Planificación
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetalleSemanalMaterialesModal;
