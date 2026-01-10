import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Button, Badge, OverlayTrigger, Tooltip } from 'react-bootstrap';
import SeleccionarProfesionalesModal from './SeleccionarProfesionalesModal';
import AgregarProfesionalModal from './AgregarProfesionalModal';

const DetalleSemanaModal = ({
  show,
  onHide,
  semana,
  asignacionesLocalesSemana = {}, // { fecha: [profesionales] } (lo que ya se configuró localmente en esta sesión)
  asignacionesGlobales = [], // Todas las asignaciones de la BD para validar conflictos
  profesionalesDisponibles = [],
  onGuardar,
  empresaId
}) => {
  // Estado local para manejar las asignaciones antes de guardar
  // Estructura: { "YYYY-MM-DD": [ { id, nombre, tipoProfesional, costoJornal } ] }
  const [asignacionesLocales, setAsignacionesLocales] = useState({});
  const [mostrarSelector, setMostrarSelector] = useState(false);
  const [mostrarAgregarProfesional, setMostrarAgregarProfesional] = useState(false);
  const [diaSeleccionadoParaAgregar, setDiaSeleccionadoParaAgregar] = useState(null); // 'todos' o 'YYYY-MM-DD'

  useEffect(() => {
    if (show && semana) {
      // Inicializar con lo que venga de props o vacío
      const inicial = {};
      semana.dias.forEach(d => {
        // Asegurar que sea Date
        const fechaObj = new Date(d);
        const fechaKey = fechaObj.toISOString().split('T')[0];
        inicial[fechaKey] = asignacionesLocalesSemana[fechaKey] || [];
      });
      setAsignacionesLocales(inicial);
    }
  }, [show, semana, asignacionesLocalesSemana]);

  // Manejar cierre del selector de profesionales
  const handleConfirmarSeleccion = (profesionalesNuevos) => {
    if (!profesionalesNuevos || profesionalesNuevos.length === 0) return;

    setAsignacionesLocales(prev => {
      const nuevoEstado = { ...prev };

      const fechasAfectadas = diaSeleccionadoParaAgregar === 'todos'
        ? Object.keys(nuevoEstado)
        : [diaSeleccionadoParaAgregar];

      fechasAfectadas.forEach(fecha => {
        const asignadosActuales = nuevoEstado[fecha] || [];
        // Combinar evitando duplicados por ID
        const mapaCombinado = new Map();
        asignadosActuales.forEach(p => mapaCombinado.set(p.id, p));
        profesionalesNuevos.forEach(p => mapaCombinado.set(p.id, p));

        nuevoEstado[fecha] = Array.from(mapaCombinado.values());
      });

      return nuevoEstado;
    });

    setMostrarSelector(false);
  };

  const removerProfesional = (fecha, profesionalId) => {
      setAsignacionesLocales(prev => ({
          ...prev,
          [fecha]: prev[fecha].filter(p => p.id !== profesionalId)
      }));
  };

  const handleGuardar = () => {
    onGuardar(semana.key, asignacionesLocales);
    onHide();
    setAsignacionesLocales({});
  };

  const handleProfesionalCreado = (nuevoProfesional) => {
    // Añadir el nuevo profesional a la lista de disponibles
    // Y seleccionarlo automáticamente
    console.log('✅ Profesional creado:', nuevoProfesional);

    // Cerrar el modal de agregar y abrir el selector con el nuevo profesional
    setMostrarAgregarProfesional(false);

    // Agregar directamente a las asignaciones del día seleccionado
    if (diaSeleccionadoParaAgregar && diaSeleccionadoParaAgregar !== 'todos') {
      handleConfirmarSeleccion([nuevoProfesional]);
    }

    alert(`✅ ${nuevoProfesional.nombre} fue creado y asignado exitosamente`);
  };

  // Calcular totales para resumen
  const resumen = useMemo(() => {
    let totalJornales = 0;
    const profesionalesUnicos = new Set();
    Object.values(asignacionesLocales).forEach(lista => {
        totalJornales += lista.length;
        lista.forEach(p => profesionalesUnicos.add(p.id));
    });
    return {
        totalJornales,
        profesionalesUnicos: profesionalesUnicos.size
    };
  }, [asignacionesLocales]);

  // Helper para mostrar fecha amigable
  const formatFecha = (fechaISO) => {
      const [year, month, day] = fechaISO.split('-');
      const date = new Date(parseInt(year), parseInt(month)-1, parseInt(day));
      return date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' });
  };

  if (!semana) return null;

  return (
    <>
      <Modal show={show} onHide={onHide} size="lg" backdrop="static">
        <Modal.Header closeButton className="bg-light">
          <Modal.Title>
            <i className="fas fa-calendar-week me-2 text-primary"></i>
            Semana {semana.numeroSemana} <small className="text-muted fs-6 ms-2">({semana.dias.length} días hábiles)</small>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0">
            {/* Header de acciones globales */}
            <div className="p-3 bg-light border-bottom d-flex justify-content-between align-items-center">
                <div>
                    <span className="badge bg-primary me-2">{resumen.profesionalesUnicos} Profesionales</span>
                    <span className="badge bg-info text-dark">{resumen.totalJornales} Jornales Total</span>
                </div>
                <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => {
                        setDiaSeleccionadoParaAgregar('todos');
                        setMostrarSelector(true);
                    }}
                >
                    <i className="fas fa-users-cog me-2"></i>
                    Asignar a Toda la Semana
                </Button>
            </div>

            {/* Lista de días */}
            <div className="list-group list-group-flush" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {Object.keys(asignacionesLocales).sort().map(fecha => {
                    const profesionales = asignacionesLocales[fecha] || [];
                    const esFinDeSemana = false; // Ya filtramos días hábiles en el parent, asumimos que son laborables o el parent pasó los días correctos.

                    return (
                        <div key={fecha} className="list-group-item p-3">
                            <div className="d-flex justify-content-between align-items-start mb-2">
                                <h6 className="mb-0 text-capitalize fw-bold text-dark">
                                    <i className="far fa-calendar-alt me-2 text-muted"></i>
                                    {formatFecha(fecha)}
                                </h6>
                                <Button
                                    variant="link"
                                    size="sm"
                                    className="p-0 text-decoration-none"
                                    onClick={() => {
                                        setDiaSeleccionadoParaAgregar(fecha);
                                        setMostrarSelector(true);
                                    }}
                                >
                                    <i className="fas fa-plus-circle me-1"></i>Agregar
                                </Button>
                            </div>

                            {profesionales.length > 0 ? (
                                <div className="d-flex flex-wrap gap-2 mt-2">
                                    {profesionales.map(prof => (
                                        <div key={`${fecha}-${prof.id}`} className="position-relative">
                                            <Badge bg="light" text="dark" className="border d-flex align-items-center p-2">
                                                <div className="d-flex flex-column align-items-start me-2">
                                                    <span className="fw-bold">{prof.nombre}</span>
                                                    <small className="text-muted" style={{fontSize: '0.7rem'}}>
                                                        {prof.tipoProfesional || prof.rubro || 'Sin rol'}
                                                    </small>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="btn-close"
                                                    style={{ fontSize: '0.6em' }}
                                                    onClick={() => removerProfesional(fecha, prof.id)}
                                                    aria-label="Remove"
                                                />
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-muted small fst-italic mt-2 py-1 px-2 border rounded bg-light d-inline-block">
                                    Sin asignaciones para este día
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Cancelar</Button>
          <Button variant="primary" onClick={handleGuardar}>
            <i className="fas fa-save me-2"></i>Guardar Cambios Semana
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Selector de Profesionales Sub-modal */}
      <SeleccionarProfesionalesModal
        show={mostrarSelector}
        onHide={() => setMostrarSelector(false)}
        profesionalesDisponibles={profesionalesDisponibles}
        profesionalesSeleccionados={
             // Si es un día específico, mostrar los que ya están ese día
             (diaSeleccionadoParaAgregar && diaSeleccionadoParaAgregar !== 'todos')
             ? asignacionesLocales[diaSeleccionadoParaAgregar] || []
             : [] // Si es todos, no pre-seleccionamos nada para no confundir (o podríamos intersección)
        }
        onConfirmar={handleConfirmarSeleccion}
        empresaId={empresaId}
        asignacionesExistentes={asignacionesGlobales} // Pasamos asignaciones globales para validar conflictos
        // Si seleccionamos un día específico, pasamos ese día como rango
        fechaInicio={diaSeleccionadoParaAgregar !== 'todos' ? new Date(diaSeleccionadoParaAgregar) : null}
        fechaFin={diaSeleccionadoParaAgregar !== 'todos' ? new Date(diaSeleccionadoParaAgregar) : null}
        // Pasamos null como semanaActual si es por día, o la semana completa si es 'todos'
        semanaActual={diaSeleccionadoParaAgregar === 'todos' ? semana : null}
        // Nuevo callback para abrir el modal de agregar profesional
        onNuevoProfesional={() => {
          setMostrarSelector(false);
          setMostrarAgregarProfesional(true);
        }}
      />

      {/* Modal para Agregar Profesional Nuevo */}
      <AgregarProfesionalModal
        show={mostrarAgregarProfesional}
        onHide={() => setMostrarAgregarProfesional(false)}
        onProfesionalCreado={handleProfesionalCreado}
        empresaId={empresaId}
      />
    </>
  );
};

export default DetalleSemanaModal;
