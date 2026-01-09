import React from 'react';

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
    
    // Lista de feriados argentinos
    const feriadosArgentinos = [
      '2025-01-01', // Año Nuevo
      '2025-03-24', // Día Nacional de la Memoria
      '2025-03-25', // Día Nacional de la Memoria
      '2025-04-02', // Día del Veterano
      '2025-04-18', // Viernes Santo
      '2025-05-01', // Día del Trabajador
      '2025-05-25', // Revolución de Mayo
      '2025-06-20', // Día de la Bandera
      '2025-07-09', // Día de la Independencia
      '2025-08-17', // Paso a la Inmortalidad del General San Martín
      '2025-10-12', // Día del Respeto a la Diversidad Cultural
      '2025-11-20', // Día de la Soberanía Nacional
      '2025-12-08', // Inmaculada Concepción
      '2025-12-25', // Navidad
    ];
    
    const esFinDeSemana = (fecha) => {
      const dia = fecha.getDay();
      return dia === 0 || dia === 6; // Domingo o sábado
    };
    
    const esFeriado = (fecha) => {
      const fechaStr = fecha.toISOString().split('T')[0];
      return feriadosArgentinos.includes(fechaStr);
    };
    
    // Calcular el primer día de esta semana del proyecto (basado en días hábiles)
    const diasHabilesTranscurridos = (numeroSemana - 1) * 5; // 5 días hábiles por semana
    let fechaActual = new Date(fechaInicio);
    let contadorDiasHabiles = 0;
    
    // Avanzar hasta llegar al primer día de la semana deseada
    while (contadorDiasHabiles < diasHabilesTranscurridos) {
      if (!esFinDeSemana(fechaActual) && !esFeriado(fechaActual)) {
        contadorDiasHabiles++;
      }
      if (contadorDiasHabiles < diasHabilesTranscurridos) {
        fechaActual.setDate(fechaActual.getDate() + 1);
      }
    }
    
    // Retroceder al lunes de la semana para mostrar contexto completo
    const primerDiaHabilSemana = new Date(fechaActual);
    const diaSemanaActual = fechaActual.getDay();
    const diasHastaLunes = diaSemanaActual === 0 ? -6 : 1 - diaSemanaActual;
    const fechaLunes = new Date(fechaActual);
    fechaLunes.setDate(fechaActual.getDate() + diasHastaLunes);
    
    // Normalizar fechas para comparación (eliminar hora)
    const fechaInicioNormalizada = new Date(fechaInicio);
    fechaInicioNormalizada.setHours(0, 0, 0, 0);
    
    // Generar todos los días de lunes a viernes para mostrar contexto
    const todosLosDias = [];
    const nombresDias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    
    for (let i = 0; i < 5; i++) {
      const dia = new Date(fechaLunes);
      dia.setDate(fechaLunes.getDate() + i);
      dia.setHours(0, 0, 0, 0);
      
      const esHabil = !esFinDeSemana(dia) && !esFeriado(dia);
      // Comparar con fecha de inicio del proyecto, no con primer día hábil de la semana
      const esDiaDelProyecto = dia >= fechaInicioNormalizada;
      const esInteractivo = esHabil && esDiaDelProyecto;
      
      // Determinar el tipo de día para el estilo visual
      let tipoDia = 'habil';
      let motivoNoHabil = '';
      
      if (esFinDeSemana(dia)) {
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
  
  // Función para obtener asignaciones de un día específico
  const getAsignacionesDia = (fechaStr) => {
    return asignaciones.filter(asignacion => {
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
                        Jornales por semana: <strong>{(configuracionObra.capacidadNecesaria || 0) * 5}</strong> |
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
                      console.log('Asignar material para toda la semana', numeroSemana);
                      if (onAsignarParaTodaLaSemana) {
                        onAsignarParaTodaLaSemana('material', diasSemana);
                      }
                    }}
                  >
                    <i className="fas fa-calendar-week me-1"></i>
                    Asignar para toda la semana
                  </button>
                </div>
              </div>
            </div>

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
                                console.log(`Abriendo formulario de asignación para ${dia.fechaStr}`);
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