import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useEmpresa } from '../EmpresaContext';

/**
 * Vista semanal de etapas diarias
 * Muestra 5 días laborables (Lun-Vie) con resumen de profesionales, materiales y gastos
 */
const VistaSemanalEtapas = ({ obra, onVerDetalleDia }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [semanaActual, setSemanaActual] = useState(0); // Índice de la semana (0 = primera semana de la obra)
  const [etapasSemana, setEtapasSemana] = useState([]);
  const [diasSemana, setDiasSemana] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Helper para parsear fechas evitando problemas de zona horaria
  const parsearFechaLocal = (fechaStr) => {
    if (!fechaStr) return new Date();
    if (fechaStr.includes('-')) {
      const soloFecha = fechaStr.split('T')[0];
      const [year, month, day] = soloFecha.split('-');
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
    }
    return new Date(fechaStr);
  };
  
  // Obtener datos del presupuesto - memoizados para evitar recreaciones
  const { fechaInicio, diasHabiles, totalSemanas } = useMemo(() => {
    const presupuesto = obra?.presupuestoNoCliente;
    const fechaInicio = presupuesto?.fechaProbableInicio;
    const diasHabiles = presupuesto?.tiempoEstimadoTerminacion || 0;
    return {
      fechaInicio,
      diasHabiles,
      totalSemanas: Math.ceil(diasHabiles / 5)
    };
  }, [obra?.id]); // Solo depende del ID, no del objeto completo
  
  // Funciones de cálculo de semanas - NO usar useCallback para evitar dependencias circulares
  const calcularSemanaActual = (offset = 0) => {
    const hoy = new Date();
    const diaSemana = hoy.getDay();
    const diasHastaLunes = diaSemana === 0 ? -6 : -(diaSemana - 1);
    
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() + diasHastaLunes + (offset * 7));
    
    const dias = [];
    for (let i = 0; i < 5; i++) {
      const dia = new Date(lunes);
      dia.setDate(lunes.getDate() + i);
      dias.push({
        fecha: dia.toISOString().split('T')[0],
        diaNombre: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'][i],
        diaNumero: dia.getDate(),
        mes: dia.toLocaleString('es-ES', { month: 'long' }),
        anio: dia.getFullYear()
      });
    }
    
    return dias;
  };
  
  const calcularSemanaObra = (numeroSemana) => {
    if (!fechaInicio) {
      // Si no hay fecha de inicio, usar fecha actual
      return calcularSemanaActual(0);
    }
    
    const fechaInicioDate = parsearFechaLocal(fechaInicio);
    const dias = [];
    
    // Calcular el lunes de la semana específica
    let diasContados = 0;
    let fechaActual = new Date(fechaInicioDate);
    
    // Avanzar al inicio de la semana solicitada (semanas de 5 días hábiles)
    const diasAAvanzar = numeroSemana * 5;
    
    while (diasContados < diasAAvanzar) {
      fechaActual.setDate(fechaActual.getDate() + 1);
      const diaSemana = fechaActual.getDay();
      // Contar solo días hábiles (Lun-Vie)
      if (diaSemana >= 1 && diaSemana <= 5) {
        diasContados++;
      }
    }
    
    // Generar los 5 días de la semana
    for (let i = 0; i < 5; i++) {
      // Avanzar hasta encontrar el siguiente día hábil
      while (true) {
        const diaSemana = fechaActual.getDay();
        if (diaSemana >= 1 && diaSemana <= 5) {
          break; // Es día hábil
        }
        fechaActual.setDate(fechaActual.getDate() + 1);
      }
      
      dias.push({
        fecha: fechaActual.toISOString().split('T')[0],
        diaNombre: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'][i],
        diaNumero: fechaActual.getDate(),
        mes: fechaActual.toLocaleString('es-ES', { month: 'long' }),
        anio: fechaActual.getFullYear()
      });
      
      // Avanzar al siguiente día hábil
      fechaActual.setDate(fechaActual.getDate() + 1);
    }
    
    return dias;
  };

  const determinarEstado = (etapa, fecha) => {
    if (!etapa) return 'sin-planificar';
    
    const hoy = new Date().toISOString().split('T')[0];
    const fechaDiaObj = parsearFechaLocal(fecha);
    const fechaDia = fechaDiaObj.toISOString().split('T')[0];
    
    if (fechaDia > hoy) return 'planeado';
    if (fechaDia === hoy) return 'en-curso';
    return 'completado';
  };

  const cargarEtapasSemana = useCallback(async () => {
    if (!obra || !empresaSeleccionada) return;
    
    setLoading(true);
    try {
      // Calcular los días de la semana actual basándose en el presupuesto
      const nuevasDias = fechaInicio ? calcularSemanaObra(semanaActual) : calcularSemanaActual(0);
      setDiasSemana(nuevasDias);

      // Cargar SOLO las etapas de los días de esta semana
      const fechasStr = nuevasDias.map(d => d.fecha).join(',');
      const response = await fetch(`http://localhost:8080/api/etapas-diarias?obraId=${obra.id}`, {
        headers: {
          'empresaId': empresaSeleccionada.id.toString()
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const todasLasEtapas = await response.json();
      
      // Crear un mapa de etapas por fecha SOLO para esta semana
      const etapasPorFecha = new Map();
      if (Array.isArray(todasLasEtapas)) {
        todasLasEtapas.forEach(etapa => {
          if (etapa.fecha && nuevasDias.some(d => d.fecha === etapa.fecha)) {
            etapasPorFecha.set(etapa.fecha, etapa);
          }
        });
      }
      
      // Mapear cada día de la semana con su etapa correspondiente
      const etapasConDatos = nuevasDias.map(dia => {
        const etapa = etapasPorFecha.get(dia.fecha);
        return {
          ...dia,
          etapa: etapa || null,
          profesionalesCount: etapa?.tareas?.reduce((sum, t) => sum + (t.profesionales?.length || 0), 0) || 0,
          materialesCount: etapa?.materiales?.length || 0,
          gastosTotal: etapa?.gastos?.reduce((sum, g) => sum + (g.importe || 0), 0) || 0,
          estado: determinarEstado(etapa, dia.fecha)
        };
      });

      setEtapasSemana(etapasConDatos);
    } catch (error) {
      console.error('Error cargando etapas:', error);
      // Si hay error, mostrar la semana sin datos
      const nuevasDias = fechaInicio ? calcularSemanaObra(semanaActual) : calcularSemanaActual(0);
      const etapasSinDatos = nuevasDias.map(dia => ({
        ...dia,
        etapa: null,
        profesionalesCount: 0,
        materialesCount: 0,
        gastosTotal: 0,
        estado: 'sin-planificar'
      }));
      setEtapasSemana(etapasSinDatos);
      setDiasSemana(nuevasDias);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obra?.id, empresaSeleccionada?.id, semanaActual]); // Solo IDs y números primitivos

  // Cargar etapas de la semana
  useEffect(() => {
    cargarEtapasSemana();
  }, [cargarEtapasSemana]);

  // Validar obra después de todos los hooks
  if (!obra) {
    return (
      <div className="text-center text-muted py-5">
        <i className="fas fa-exclamation-triangle fa-4x mb-3 text-warning"></i>
        <p className="fs-5">No hay obra seleccionada</p>
      </div>
    );
  }

  const cambiarSemana = (direccion) => {
    setSemanaActual(prev => {
      const nueva = prev + direccion;
      return Math.max(0, Math.min(totalSemanas - 1, nueva));
    });
  };

  const irASemanaActual = () => {
    if (!fechaInicio) {
      setSemanaActual(0);
      return;
    }
    
    const hoy = new Date();
    const inicio = parsearFechaLocal(fechaInicio);
    
    if (hoy < inicio) {
      setSemanaActual(0);
      return;
    }
    
    let diasTranscurridos = 0;
    let fechaActual = new Date(inicio);
    
    while (fechaActual < hoy && diasTranscurridos < diasHabiles) {
      if (fechaActual.getDay() !== 0 && fechaActual.getDay() !== 6) {
        diasTranscurridos++;
      }
      fechaActual.setDate(fechaActual.getDate() + 1);
    }
    
    const semanaCalculada = Math.floor(diasTranscurridos / 5);
    setSemanaActual(Math.min(semanaCalculada, totalSemanas - 1));
  };

  const getEstadoBadge = (estado) => {
    switch (estado) {
      case 'completado':
        return { icon: '✅', text: 'Completo', class: 'bg-success' };
      case 'en-curso':
        return { icon: '🔄', text: 'En curso', class: 'bg-warning' };
      case 'planeado':
        return { icon: '📋', text: 'Planeado', class: 'bg-info' };
      default:
        return { icon: '⚪', text: 'Sin planificar', class: 'bg-secondary' };
    }
  };

  // Calcular resumen semanal
  const resumenSemanal = {
    totalProfesionales: etapasSemana.reduce((sum, dia) => sum + dia.profesionalesCount, 0),
    totalMateriales: etapasSemana.reduce((sum, dia) => sum + dia.materialesCount, 0),
    totalGastos: etapasSemana.reduce((sum, dia) => sum + dia.gastosTotal, 0)
  };

  const formatearMoneda = (valor) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(valor);
  };

  const obtenerRangoSemana = () => {
    if (diasSemana.length === 0) return '';
    const primer = diasSemana[0];
    const ultimo = diasSemana[4];
    return `${primer.diaNumero} al ${ultimo.diaNumero} de ${primer.mes} 2025`;
  };

  const obtenerTituloProgreso = () => {
    const numeroSemana = semanaActual + 1;
    const diasInicio = (semanaActual * 5) + 1;
    const diasFin = Math.min((semanaActual * 5) + 5, diasHabiles);
    
    return `Semana ${numeroSemana} de ${totalSemanas} (Días ${diasInicio}-${diasFin} de ${diasHabiles})`;
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="vista-semanal-etapas">
      {/* Header con navegación */}
      <div className="card mb-3">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h5 className="mb-1">
                <i className="fas fa-calendar-week me-2"></i>
                Semana del {obtenerRangoSemana()}
              </h5>
              <small className="text-muted">{obtenerTituloProgreso()}</small>
            </div>
            <div className="btn-group">
              <button 
                className="btn btn-sm btn-outline-primary" 
                onClick={() => cambiarSemana(-1)}
                disabled={semanaActual === 0}
              >
                <i className="fas fa-chevron-left"></i> Anterior
              </button>
              <button 
                className="btn btn-sm btn-outline-primary" 
                onClick={irASemanaActual}
              >
                Hoy
              </button>
              <button 
                className="btn btn-sm btn-outline-primary" 
                onClick={() => cambiarSemana(1)}
                disabled={semanaActual >= totalSemanas - 1}
              >
                Siguiente <i className="fas fa-chevron-right"></i>
              </button>
            </div>
          </div>

          {/* Resumen semanal */}
          <div className="row text-center">
            <div className="col-md-4">
              <div className="d-flex align-items-center justify-content-center">
                <i className="fas fa-users fa-2x text-primary me-2"></i>
                <div>
                  <h4 className="mb-0">{resumenSemanal.totalProfesionales}</h4>
                  <small className="text-muted">Asistencias</small>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="d-flex align-items-center justify-content-center">
                <i className="fas fa-boxes fa-2x text-info me-2"></i>
                <div>
                  <h4 className="mb-0">{resumenSemanal.totalMateriales}</h4>
                  <small className="text-muted">Materiales usados</small>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="d-flex align-items-center justify-content-center">
                <i className="fas fa-dollar-sign fa-2x text-success me-2"></i>
                <div>
                  <h4 className="mb-0">{formatearMoneda(resumenSemanal.totalGastos)}</h4>
                  <small className="text-muted">Gastos totales</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de días */}
      <div className="row g-3">
        {diasSemana.map((dia, index) => {
          const etapaDia = etapasSemana[index] || dia;
          const estadoBadge = getEstadoBadge(etapaDia.estado);

          return (
            <div key={dia.fecha} className="col-md-2-4 col-sm-6">
              <div 
                className={`card h-100 ${etapaDia.estado === 'en-curso' ? 'border-warning border-2' : ''}`}
                style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                onClick={() => onVerDetalleDia && onVerDetalleDia(etapaDia)}
              >
                <div className="card-header bg-light">
                  <div className="d-flex justify-content-between align-items-center">
                    <strong>{dia.diaNombre.substring(0, 3).toUpperCase()}</strong>
                    <span className="badge bg-secondary">{dia.diaNumero}</span>
                  </div>
                  <span className={`badge ${estadoBadge.class} w-100 mt-2`}>
                    {estadoBadge.icon} {estadoBadge.text}
                  </span>
                </div>
                <div className="card-body">
                  <div className="mb-2">
                    <small className="text-muted d-block">
                      <i className="fas fa-users me-1"></i>
                      {etapaDia.profesionalesCount > 0 ? (
                        <strong>{etapaDia.profesionalesCount} activos</strong>
                      ) : (
                        'Sin profesionales'
                      )}
                    </small>
                    {etapaDia.etapa?.profesionales?.slice(0, 2).map((prof, i) => (
                      <small key={i} className="d-block text-truncate" title={prof.nombre}>
                        ✓ {prof.nombre}
                      </small>
                    ))}
                    {etapaDia.profesionalesCount > 2 && (
                      <small className="text-muted">+{etapaDia.profesionalesCount - 2} más</small>
                    )}
                  </div>

                  <div className="mb-2">
                    <small className="text-muted d-block">
                      <i className="fas fa-boxes me-1"></i>
                      {etapaDia.materialesCount > 0 ? (
                        <strong>{etapaDia.materialesCount} materiales</strong>
                      ) : (
                        'Sin materiales'
                      )}
                    </small>
                    {etapaDia.etapa?.materiales?.slice(0, 2).map((mat, i) => (
                      <small key={i} className="d-block text-truncate" title={mat.nombre}>
                        • {mat.cantidad} {mat.nombre}
                      </small>
                    ))}
                  </div>

                  {etapaDia.gastosTotal > 0 && (
                    <div>
                      <small className="text-muted d-block">
                        <i className="fas fa-dollar-sign me-1"></i>
                        <strong className="text-success">{formatearMoneda(etapaDia.gastosTotal)}</strong>
                      </small>
                    </div>
                  )}
                </div>
                <div className="card-footer bg-transparent border-0 pt-0">
                  <button 
                    className="btn btn-sm btn-outline-primary w-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      onVerDetalleDia && onVerDetalleDia(etapaDia);
                    }}
                  >
                    {etapaDia.estado === 'sin-planificar' ? 'Planificar' : 'Ver detalle'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .col-md-2-4 {
          flex: 0 0 20%;
          max-width: 20%;
        }
        
        @media (max-width: 768px) {
          .col-md-2-4 {
            flex: 0 0 50%;
            max-width: 50%;
          }
        }
      `}</style>
    </div>
  );
};

// Memoizar componente para evitar re-renders innecesarios cuando las props no cambian
export default React.memo(VistaSemanalEtapas, (prevProps, nextProps) => {
  return prevProps.obra?.id === nextProps.obra?.id && 
         prevProps.onVerDetalleDia === nextProps.onVerDetalleDia;
});
