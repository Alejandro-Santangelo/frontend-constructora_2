import React, { useState, useEffect } from 'react';
import { 
  registrarPago, 
  listarPagosPorProfesional,
  formatearMoneda 
} from '../services/pagosProfesionalObraService';
import { registrarPagosConsolidadosBatch, listarPagosConsolidadosPorPresupuesto } from '../services/pagosConsolidadosService';
import { useEmpresa } from '../EmpresaContext';
import { useEstadisticasConsolidadas } from '../hooks/useEstadisticasConsolidadas';
import api from '../services/api';
import eventBus, { FINANCIAL_EVENTS } from '../utils/eventBus';

/**
 * Modal consolidado para gestión financiera de todas las obras
 * ✨ Con sincronización automática vía EventBus
 */

const SistemaFinancieroConsolidadoModal = ({ show, onHide, onSuccess, refreshTrigger }) => {
  const { empresaSeleccionada } = useEmpresa();
  
  // Hook de estadísticas consolidadas
  const { 
    estadisticas, 
    loading: loadingEstadisticas 
  } = useEstadisticasConsolidadas(
    empresaSeleccionada?.id,
    refreshTrigger,
    show // solo activo cuando el modal está abierto
  );
  
  const [tipoGasto, setTipoGasto] = useState('PROFESIONALES');
  const [profesionales, setProfesionales] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [otrosCostos, setOtrosCostos] = useState([]);
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [error, setError] = useState(null);
  const [profesionalesSuspendidos, setProfesionalesSuspendidos] = useState(new Set());
  const [materialesSuspendidos, setMaterialesSuspendidos] = useState(new Set());
  const [otrosCostosSuspendidos, setOtrosCostosSuspendidos] = useState(new Set());
  const [loading, setLoading] = useState(false);
  
  // 🔒 Flag para evitar cargas duplicadas
  const cargandoRef = React.useRef(false);

  // Auto-actualización cuando el modal se abre O cuando cambia refreshTrigger
  useEffect(() => {
    if (show && empresaSeleccionada) {
      // console.log('🔄 SistemaFinancieroConsolidado: Actualizando datos automáticamente...');
      setTipoGasto('PROFESIONALES');
      setError(null);
      setProfesionalesSuspendidos(new Set());
      setMaterialesSuspendidos(new Set());
      setOtrosCostosSuspendidos(new Set());
      // Resetear flag al abrir modal
      cargandoRef.current = false;
      cargarTodosLosPresupuestos();
    }
  }, [show, empresaSeleccionada, refreshTrigger]);

  // 🚌 SINCRONIZACIÓN AUTOMÁTICA: Escuchar eventos financieros
  useEffect(() => {
    if (!show) return;
    
    // console.log('🎧 SistemaFinancieroConsolidado: Suscribiendo a eventos financieros...');
    
    const handleFinancialEvent = (eventData) => {
      // console.log('📡 Evento financiero recibido en modal consolidado, recargando...', eventData);
      if (!cargandoRef.current) {
        cargarTodosLosPresupuestos();
      }
    };
    
    // Suscribirse a eventos de pagos y cobros
    const unsubscribers = [
      eventBus.on(FINANCIAL_EVENTS.PAGO_REGISTRADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.PAGO_ACTUALIZADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.PAGO_ELIMINADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.PAGO_CONSOLIDADO_REGISTRADO, handleFinancialEvent),
    ];
    
    // Cleanup
    return () => {
      // console.log('🔇 SistemaFinancieroConsolidado: Desuscribiendo de eventos');
      unsubscribers.forEach(unsub => unsub());
    };
  }, [show]);

  const cargarTodosLosPresupuestos = async () => {
    // 🔒 Evitar cargas duplicadas simultáneas
    if (cargandoRef.current) {
      // console.log('⏳ [Consolidado] Ya hay una carga en progreso, ignorando...');
      return;
    }
    
    cargandoRef.current = true;
    // console.log('🔄 [Consolidado] Iniciando carga de todos los presupuestos');
    setCargandoDatos(true);
    
    try {
      const [responseAprobado, responseEnEjecucion] = await Promise.all([
        api.presupuestosNoCliente.busquedaAvanzada({ estado: 'APROBADO' }, empresaSeleccionada.id),
        api.presupuestosNoCliente.busquedaAvanzada({ estado: 'EN_EJECUCION' }, empresaSeleccionada.id)
      ]);
      
      const extractData = (response) => {
        if (Array.isArray(response)) return response;
        if (response?.datos && Array.isArray(response.datos)) return response.datos;
        if (response?.content && Array.isArray(response.content)) return response.content;
        if (response?.data && Array.isArray(response.data)) return response.data;
        return [];
      };
      
      const presupuestosAprobado = extractData(responseAprobado);
      const presupuestosEnEjecucion = extractData(responseEnEjecucion);
      const todosPresupuestos = [...presupuestosAprobado, ...presupuestosEnEjecucion];
      
      if (todosPresupuestos.length === 0) {
        setError('No hay presupuestos APROBADOS o EN_EJECUCION.');
        setProfesionales([]);
        setMateriales([]);
        setOtrosCostos([]);
        return;
      }

      const presupuestosCompletos = await Promise.all(
        todosPresupuestos.map(p => api.presupuestosNoCliente.getById(p.id, empresaSeleccionada.id))
      );

      // 💰 Consultar pagos consolidados existentes para cada presupuesto
      const todosPagosConsolidados = await Promise.all(
        presupuestosCompletos.map(p => 
          listarPagosConsolidadosPorPresupuesto(p.id, empresaSeleccionada.id)
            .catch(err => {
              console.warn(`⚠️ Error cargando pagos para presupuesto ${p.id}:`, err);
              return [];
            })
        )
      );

      // Crear mapa de pagos por presupuesto para búsqueda rápida
      const pagosMap = {};
      presupuestosCompletos.forEach((presupuesto, idx) => {
        pagosMap[presupuesto.id] = todosPagosConsolidados[idx] || [];
      });

      const todosProfesionales = [];
      const todosMateriales = [];
      const todosOtrosCostos = [];
      let contadorProfesionales = 0;

      presupuestosCompletos.forEach((presupuesto) => {
        const itemsCalculadora = presupuesto.itemsCalculadora || [];
        const nombreObra = presupuesto.nombreObra || presupuesto.direccionObra?.direccion || `Presupuesto #${presupuesto.numeroPresupuesto}`;
        
        itemsCalculadora.forEach((item) => {
          if (item.profesionales && Array.isArray(item.profesionales)) {
            item.profesionales.forEach((prof, profIdx) => {
              contadorProfesionales++;
              const idUnico = `${presupuesto.id}-${prof.id}-${contadorProfesionales}`;
              const precioTotal = (prof.cantidadJornales || 0) * (prof.importeJornal || 0);
              
              todosProfesionales.push({
                id: idUnico,
                profesionalId: prof.id,
                profesionalObraId: prof.profesionalObraId || prof.id,
                indiceEnLista: contadorProfesionales,
                presupuestoId: presupuesto.id,
                nombreObra: nombreObra,
                tipoProfesional: prof.tipo || item.tipoProfesional || 'Sin tipo',
                nombre: prof.nombre || `${prof.tipo || item.tipoProfesional} #${profIdx + 1}`,
                cantidadJornales: prof.cantidadJornales || 0,
                precioJornal: prof.importeJornal || 0,
                precioTotal: precioTotal,
                nombreCompleto: prof.nombre || `${prof.tipo || item.tipoProfesional} #${profIdx + 1}`
              });
            });
          }
        });
        
        itemsCalculadora.forEach((item, itemIdx) => {
          if (item.materialesLista && Array.isArray(item.materialesLista)) {
            item.materialesLista.forEach((mat, matIdx) => {
              // 🔍 Buscar si existe un pago para este material
              const pagosPresupuesto = pagosMap[presupuesto.id] || [];
              const pagoExistente = pagosPresupuesto.find(pago => 
                pago.tipoPago === 'MATERIALES' &&
                pago.itemCalculadoraId === item.id &&
                pago.materialCalculadoraId === mat.id
              );

              todosMateriales.push({
                id: `${presupuesto.id}-mat-${itemIdx}-${matIdx}`,
                presupuestoId: presupuesto.id,
                itemCalculadoraId: item.id, // ID real del item
                materialCalculadoraId: mat.id, // ID real del material
                nombreObra: nombreObra,
                nombre: mat.nombre || 'Sin nombre',
                cantidadUnidades: mat.cantidad || 0,
                precioUnidad: mat.precioUnitario || 0,
                precioTotal: mat.subtotal || 0,
                unidad: mat.unidad || 'u',
                pagado: !!pagoExistente, // ✅ Marcar como pagado si existe
                pagoId: pagoExistente?.id,
                fechaPago: pagoExistente?.fechaPago
              });
            });
          }
        });
        
        // 📋 OTROS COSTOS: Gastos Generales desde subtotalGastosGenerales
        itemsCalculadora.forEach((item, itemIdx) => {
          if (item.subtotalGastosGenerales && parseFloat(item.subtotalGastosGenerales) > 0) {
            // 🔍 Buscar si existe un pago para este gasto general
            const pagosPresupuesto = pagosMap[presupuesto.id] || [];
            const nombreGasto = item.descripcionGastosGenerales || `Gastos Generales - ${item.tipoProfesional}`;
            const pagoExistente = pagosPresupuesto.find(pago => 
              pago.tipoPago === 'GASTOS_GENERALES' &&
              pago.itemCalculadoraId === item.id &&
              pago.materialCalculadoraId === null
            );

            todosOtrosCostos.push({
              id: `${presupuesto.id}-gasto-${itemIdx}`,
              presupuestoId: presupuesto.id,
              itemCalculadoraId: item.id, // ID real del item
              nombreObra: nombreObra,
              nombre: nombreGasto,
              precioTotal: parseFloat(item.subtotalGastosGenerales),
              tipo: item.tipoProfesional || 'Gastos Generales',
              observaciones: item.observacionesGastosGenerales,
              pagado: !!pagoExistente, // ✅ Marcar como pagado si existe
              pagoId: pagoExistente?.id,
              fechaPago: pagoExistente?.fechaPago
            });
          }
        });
      });
      
      // console.log('📊 RESUMEN FINAL:', {
      //   profesionales: todosProfesionales.length,
      //   materiales: todosMateriales.length,
      //   otrosCostos: todosOtrosCostos.length
      // });
      
      setProfesionales(todosProfesionales);
      setMateriales(todosMateriales);
      setOtrosCostos(todosOtrosCostos);
      
      if (todosProfesionales.length > 0) {
        await cargarTotalesPagadosPorProfesional(todosProfesionales);
      }
      
      // console.log('✅ [Consolidado] Carga completada exitosamente');
      
    } catch (err) {
      console.error('❌ Error cargando presupuestos:', err);
      setError('Error al cargar los presupuestos consolidados.');
    } finally {
      setCargandoDatos(false);
      cargandoRef.current = false; // 🔓 Liberar flag
      // console.log('🔓 [Consolidado] Flag de carga liberado');
    }
  };

  const cargarTotalesPagadosPorProfesional = async (listaProfesionales) => {
    // Consultar pagos para cada profesional individualmente
    const profesionalesConPagos = await Promise.all(
      listaProfesionales.map(async (prof) => {
        if (!prof.profesionalObraId) {
          return { 
            ...prof, 
            totalPagado: 0, 
            saldoPendiente: prof.precioTotal || 0,
            totalProfesional: prof.precioTotal || 0,
            porcentajeCobrado: 0
          };
        }
        
        try {
          // Consultar pagos de este profesional específico
          const pagos = await listarPagosPorProfesional(prof.profesionalObraId, empresaSeleccionada.id);
          
          // Filtrar solo pagos NO anulados y sumar
          const totalPagado = Array.isArray(pagos)
            ? pagos
                .filter(pago => pago.estado !== 'ANULADO')
                .reduce((sum, pago) => sum + (parseFloat(pago.montoFinal) || 0), 0)
            : 0;
          
          const totalProfesional = prof.precioTotal || 0;
          const saldoPendiente = Math.max(0, totalProfesional - totalPagado);
          
          // console.log(`💰 [Consolidado] Prof ${prof.profesionalObraId} (${prof.nombre}): ${pagos?.length || 0} pagos, $${totalPagado} pagado de $${totalProfesional}`);
          
          return {
            ...prof,
            totalPagado,
            saldoPendiente,
            totalProfesional,
            porcentajeCobrado: totalProfesional > 0 ? (totalPagado / totalProfesional) * 100 : 0
          };
        } catch (err) {
          console.warn(`⚠️ Error cargando pagos para profesional ${prof.profesionalObraId}:`, err);
          return { 
            ...prof, 
            totalPagado: 0, 
            saldoPendiente: prof.precioTotal || 0,
            totalProfesional: prof.precioTotal || 0,
            porcentajeCobrado: 0
          };
        }
      })
    );
    
    setProfesionales(profesionalesConPagos);
  };

  const toggleSuspenderProfesional = (profesionalId) => {
    setProfesionalesSuspendidos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(profesionalId)) {
        newSet.delete(profesionalId);
      } else {
        newSet.add(profesionalId);
      }
      return newSet;
    });
  };

  const toggleSuspenderMaterial = (materialId) => {
    setMaterialesSuspendidos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(materialId)) {
        newSet.delete(materialId);
      } else {
        newSet.add(materialId);
      }
      return newSet;
    });
  };

  const toggleSuspenderOtroCosto = (costoId) => {
    setOtrosCostosSuspendidos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(costoId)) {
        newSet.delete(costoId);
      } else {
        newSet.add(costoId);
      }
      return newSet;
    });
  };

  const handlePagarATodos = async () => {
    // Filtrar profesionales con saldo pendiente y que NO estén suspendidos
    const profesionalesParaPagar = profesionales.filter(p => 
      (p.saldoPendiente || 0) > 0 && !profesionalesSuspendidos.has(p.id)
    );
    
    if (profesionalesParaPagar.length === 0) {
      alert('✅ No hay profesionales para pagar (todos pagados o suspendidos)');
      return;
    }

    const totalPendiente = profesionalesParaPagar.reduce((sum, p) => sum + (p.saldoPendiente || 0), 0);
    const cantidadSuspendidos = profesionalesSuspendidos.size;
    
    const confirmacion = window.confirm(
      `¿Confirmar pago masivo a ${profesionalesParaPagar.length} profesionales?\n\n` +
      `Total a pagar: ${formatearMoneda(totalPendiente)}\n` +
      `${cantidadSuspendidos > 0 ? `\n⚠️ ${cantidadSuspendidos} profesional(es) suspendido(s) NO será(n) pagado(s)` : ''}`
    );

    if (!confirmacion) return;

    setLoading(true);
    const resultados = { exitosos: [], fallidos: [] };

    for (const prof of profesionalesParaPagar) {
      try {
        const pagoData = {
          profesionalObraId: prof.profesionalObraId,
          tipoPago: 'PAGO_TOTAL',
          montoBruto: prof.saldoPendiente,
          descuentoAdelantos: 0,
          descuentoPresentismo: 0,
          porcentajePresentismo: 100,
          fechaPago: new Date().toISOString().split('T')[0],
          fechaPeriodoDesde: null,
          fechaPeriodoHasta: null,
          observaciones: `[PAGO MASIVO - ${prof.nombreObra}] ${prof.nombreCompleto} (Prof ID: ${prof.profesionalId}, Índice: ${prof.indiceEnLista})`,
          estado: 'PAGADO'
        };

        await registrarPago(pagoData, empresaSeleccionada.id);
        
        // 📡 Notificar al contexto centralizado
        eventBus.emit(FINANCIAL_EVENTS.PAGO_REGISTRADO, {
          profesionalObraId: prof.profesionalObraId,
          monto: prof.saldoPendiente
        });
        
        resultados.exitosos.push({ nombre: prof.nombreCompleto, obra: prof.nombreObra, monto: prof.saldoPendiente });
      } catch (err) {
        resultados.fallidos.push({ nombre: prof.nombreCompleto, obra: prof.nombreObra, error: err.message });
      }
    }

    setLoading(false);
    
    const mensaje = `📊 RESULTADO DEL PAGO MASIVO\n\n✅ Exitosos: ${resultados.exitosos.length}\n❌ Fallidos: ${resultados.fallidos.length}`;
    alert(mensaje);

    if (resultados.exitosos.length > 0) {
      await cargarTodosLosPresupuestos();
      if (onSuccess) onSuccess({ mensaje: `${resultados.exitosos.length} pagos registrados` });
    }
  };

  // 📋 Agrupar items por obra para mejor UX
  const agruparPorObra = (items) => {
    const grupos = {};
    items.forEach(item => {
      const nombreObra = item.nombreObra || 'Sin nombre';
      if (!grupos[nombreObra]) {
        grupos[nombreObra] = [];
      }
      grupos[nombreObra].push(item);
    });
    return grupos;
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{zIndex: 2000, backgroundColor: 'rgba(0,0,0,0.5)'}}>
      <div className="modal-dialog modal-fullscreen">
        <div className="modal-content">
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title">
              🌐 Pagos - Cobros (TODAS LAS OBRAS)
            </h5>
            <button type="button" className="btn btn-light btn-sm ms-auto" onClick={onHide}>
              Cerrar
            </button>
          </div>

          <div className="modal-body" style={{maxHeight: 'calc(100vh - 120px)', overflowY: 'auto'}}>
            {cargandoDatos && (
              <div className="alert alert-info">
                <span className="spinner-border spinner-border-sm me-2"></span>
                Cargando datos de todas las obras...
              </div>
            )}

            {error && (
              <div className="alert alert-danger alert-dismissible">
                {error}
                <button type="button" className="btn-close" onClick={() => setError(null)}></button>
              </div>
            )}

            {/* SECCIÓN 1: TARJETAS DE RESUMEN */}
            {estadisticas && !loadingEstadisticas && (
              <>
                {/* Primera fila: 3 tarjetas principales */}
                <div className="row mb-3">
                  {/* Card: Total Presupuestado */}
                  <div className="col-md-4 mb-3">
                    <div className="card border-info shadow-sm h-100">
                      <div className="card-header bg-info text-white d-flex justify-content-between align-items-center">
                        <span className="fw-bold">📋 Presupuestado</span>
                        <i className="bi bi-file-earmark-text fs-4"></i>
                      </div>
                      <div className="card-body text-center">
                        <h2 className="display-6 text-info mb-2">
                          {formatearMoneda(estadisticas.totalPresupuesto || 0)}
                        </h2>
                        <small className="text-muted">{estadisticas.cantidadObras || 0} obra(s)</small>
                      </div>
                    </div>
                  </div>

                  {/* Card: Total Cobrado */}
                  <div className="col-md-4 mb-3">
                    <div className="card border-success shadow-sm h-100">
                      <div className="card-header bg-success text-white d-flex justify-content-between align-items-center">
                        <span className="fw-bold">💰 Total Cobrado</span>
                        <i className="bi bi-cash-stack fs-4"></i>
                      </div>
                      <div className="card-body text-center">
                        <h2 className="display-6 text-success mb-2">
                          {formatearMoneda(estadisticas.totalCobrado || 0)}
                        </h2>
                        <div className="progress mt-2" style={{height: '20px'}}>
                          <div 
                            className="progress-bar bg-success" 
                            role="progressbar" 
                            style={{width: `${estadisticas.porcentajeCobrado || 0}%`}}
                            aria-valuenow={estadisticas.porcentajeCobrado || 0} 
                            aria-valuemin="0" 
                            aria-valuemax="100"
                          >
                            {(estadisticas.porcentajeCobrado || 0).toFixed(1)}%
                          </div>
                        </div>
                        <small className="text-muted mt-1 d-block">{estadisticas.cantidadCobros || 0} cobro(s)</small>
                      </div>
                    </div>
                  </div>

                  {/* Card: Total Pagado */}
                  <div className="col-md-4 mb-3">
                    <div className="card border-danger shadow-sm h-100">
                      <div className="card-header bg-danger text-white d-flex justify-content-between align-items-center">
                        <span className="fw-bold">💸 Total Pagado</span>
                        <i className="bi bi-arrow-up-circle fs-4"></i>
                      </div>
                      <div className="card-body text-center">
                        <h2 className="display-6 text-danger mb-2">
                          {formatearMoneda(estadisticas.totalPagado || 0)}
                        </h2>
                        <div className="progress mt-2" style={{height: '20px'}}>
                          <div 
                            className="progress-bar bg-danger" 
                            role="progressbar" 
                            style={{width: `${estadisticas.porcentajePagado || 0}%`}}
                            aria-valuenow={estadisticas.porcentajePagado || 0} 
                            aria-valuemin="0" 
                            aria-valuemax="100"
                          >
                            {(estadisticas.porcentajePagado || 0).toFixed(1)}%
                          </div>
                        </div>
                        <small className="text-muted mt-1 d-block">{estadisticas.cantidadPagos || 0} pago(s)</small>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Segunda fila: 2 tarjetas de balance */}
                <div className="row mb-4">
                  {/* Card: Saldo por Cobrar */}
                  <div className="col-md-6 mb-3">
                    <div className="card border-warning shadow-sm h-100">
                      <div className="card-header bg-warning text-dark d-flex justify-content-between align-items-center">
                        <span className="fw-bold">⏳ Saldo por Cobrar</span>
                        <i className="bi bi-hourglass-split fs-4"></i>
                      </div>
                      <div className="card-body text-center">
                        <h2 className="display-6 text-warning mb-2">
                          {formatearMoneda((estadisticas.totalPresupuesto - estadisticas.totalCobrado) || 0)}
                        </h2>
                        <small className="text-muted mt-1 d-block">
                          Falta cobrar {(100 - (estadisticas.porcentajeCobrado || 0)).toFixed(1)}% del presupuesto
                        </small>
                      </div>
                    </div>
                  </div>

                  {/* Card: Balance Neto / Déficit */}
                  <div className="col-md-6 mb-3">
                    <div className={`card shadow-sm h-100 ${estadisticas.saldoDisponible < 0 ? 'border-danger' : 'border-primary'}`}>
                      <div className={`card-header text-white d-flex justify-content-between align-items-center ${estadisticas.saldoDisponible < 0 ? 'bg-danger' : 'bg-primary'}`}>
                        <span className="fw-bold">
                          {estadisticas.saldoDisponible < 0 ? '⚠️ Déficit (Cobrado - Pagado)' : '✅ Saldo Disponible'}
                        </span>
                        <i className={`bi ${estadisticas.saldoDisponible < 0 ? 'bi-exclamation-triangle' : 'bi-wallet2'} fs-4`}></i>
                      </div>
                      <div className="card-body text-center">
                        <h2 className={`display-6 mb-2 ${estadisticas.saldoDisponible < 0 ? 'text-danger' : 'text-primary'}`}>
                          {formatearMoneda(estadisticas.saldoDisponible || 0)}
                        </h2>
                        <small className="text-muted mt-1 d-block">
                          {estadisticas.saldoDisponible < 0 ? 'Necesitas cobrar más' : `${Math.abs(estadisticas.porcentajeDisponible || 0).toFixed(1)}% disponible`}
                        </small>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            <hr className="my-4" />

            {/* VISTA AGRUPADA POR OBRA */}
            <div className="obras-consolidadas">
              {(() => {
                // Obtener lista única de obras
                const obrasSet = new Set();
                profesionales.forEach(p => obrasSet.add(p.nombreObra));
                materiales.forEach(m => obrasSet.add(m.nombreObra));
                otrosCostos.forEach(c => obrasSet.add(c.nombreObra));
                
                const obras = Array.from(obrasSet);
                
                return obras.map((nombreObra, obraIdx) => {
                  const profesionalesObra = profesionales.filter(p => p.nombreObra === nombreObra);
                  const materialesObra = materiales.filter(m => m.nombreObra === nombreObra);
                  const otrosCostosObra = otrosCostos.filter(c => c.nombreObra === nombreObra);
                  
                  return (
                    <div key={obraIdx} className="card mb-4 border-primary shadow-lg">
                      {/* HEADER DE OBRA */}
                      <div className="card-header bg-primary text-white">
                        <h4 className="mb-1">
                          <i className="bi bi-building me-2"></i>
                          {nombreObra}
                        </h4>
                        <small className="text-white-50">
                          {profesionalesObra.length} profesionales • {materialesObra.length} materiales • {otrosCostosObra.length} gastos generales
                        </small>
                      </div>
                      
                      <div className="card-body p-4">
                        {/* SECCIÓN PROFESIONALES */}
                        {profesionalesObra.length > 0 && (
                          <div className="mb-4">
                            <h5 className="bg-info text-white p-3 rounded mb-3">
                              <i className="bi bi-people-fill me-2"></i>
                              👷 Profesionales ({profesionalesObra.length})
                              {profesionalesObra.filter(p => p.saldoPendiente <= 1 && p.totalProfesional > 0).length > 0 && (
                                <span className="badge bg-success ms-2">
                                  ✅ {profesionalesObra.filter(p => p.saldoPendiente <= 1 && p.totalProfesional > 0).length} pagado(s)
                                </span>
                              )}
                            </h5>
                            <div className="table-responsive">
                              <table className="table table-hover table-bordered table-sm">
                                <thead className="table-dark">
                                  <tr>
                                    <th>Tipo Profesional</th>
                                    <th>Nombre Completo</th>
                                    <th>Días Trabajados</th>
                                    <th>Tarifa por Día</th>
                                    <th>Total a Pagar</th>
                                    <th>Total Pagado</th>
                                    <th>Saldo Pendiente</th>
                                    <th>Estado Pago</th>
                                    <th>Acciones</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {profesionalesObra.map(prof => {
                                    const totalJornales = (prof.cantidadJornales || 0) * (prof.precioJornal || 0);
                                    const porcentaje = prof.porcentajeCobrado || 0;
                                    const estaSuspendido = profesionalesSuspendidos.has(prof.id);
                                    
                                    return (
                                      <tr 
                                        key={prof.id} 
                                        className={
                                          estaSuspendido ? 'table-secondary' : 
                                          porcentaje >= 100 ? 'table-success' : 
                                          porcentaje > 0 ? 'table-warning' : ''
                                        }
                                      >
                                        <td>{prof.tipoProfesional}</td>
                                        <td>
                                          {prof.nombreCompleto}
                                          {estaSuspendido && <span className="badge bg-secondary ms-2">Suspendido</span>}
                                        </td>
                                        <td className="text-center">{prof.cantidadJornales}</td>
                                        <td className="text-end">{formatearMoneda(prof.precioJornal)}</td>
                                        <td className="text-end fw-bold">{formatearMoneda(totalJornales)}</td>
                                        <td className="text-end text-success">{formatearMoneda(prof.totalPagado || 0)}</td>
                                        <td className="text-end text-danger">{formatearMoneda(prof.saldoPendiente || 0)}</td>
                                        <td className="text-center">
                                          {totalJornales > 0 && (prof.totalPagado || 0) >= totalJornales ? (
                                            <span className="badge bg-success">✅ Completo</span>
                                          ) : (prof.totalPagado || 0) > 0 && totalJornales > 0 ? (
                                            <span className="badge bg-warning text-dark">⚠️ Parcial ({((prof.totalPagado / totalJornales) * 100).toFixed(0)}%)</span>
                                          ) : (
                                            <span className="badge bg-secondary">Pendiente</span>
                                          )}
                                        </td>
                                        <td>
                                          {porcentaje < 100 && (
                                            <button
                                              className={`btn btn-sm ${estaSuspendido ? 'btn-success' : 'btn-warning'}`}
                                              onClick={() => toggleSuspenderProfesional(prof.id)}
                                              disabled={loading}
                                            >
                                              {estaSuspendido ? '✓ Reactivar' : '⏸ Suspender'}
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* SECCIÓN MATERIALES */}
                        {materialesObra.length > 0 && (
                          <div className="mb-4">
                            <h5 className="bg-success text-white p-3 rounded mb-3">
                              <i className="bi bi-box-seam me-2"></i>
                              🧱 Materiales ({materialesObra.length})
                              {materialesObra.filter(m => m.pagado).length > 0 && (
                                <span className="badge bg-light text-success ms-2">
                                  ✅ {materialesObra.filter(m => m.pagado).length} pagado(s)
                                </span>
                              )}
                            </h5>
                            <div className="table-responsive">
                              <table className="table table-hover table-bordered table-sm">
                                <thead className="table-dark">
                                  <tr>
                                    <th>Material</th>
                                    <th>Cantidad</th>
                                    <th>Unidad</th>
                                    <th>Precio Unit.</th>
                                    <th>Total</th>
                                    <th>Acción</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {materialesObra.map(mat => {
                                    const estaSuspendido = materialesSuspendidos.has(mat.id);
                                    const estaPagado = mat.pagado;
                                    return (
                                      <tr key={mat.id} className={estaSuspendido ? 'table-secondary' : estaPagado ? 'table-success' : ''}>
                                        <td>
                                          {mat.nombre}
                                          {estaPagado && (
                                            <span className="badge bg-success ms-2">✅ PAGADO</span>
                                          )}
                                          {estaSuspendido && !estaPagado && (
                                            <span className="badge bg-secondary ms-2">Suspendido</span>
                                          )}
                                        </td>
                                        <td className="text-center">{mat.cantidadUnidades}</td>
                                        <td>{mat.unidadMedida}</td>
                                        <td className="text-end">{formatearMoneda(mat.precioUnitario)}</td>
                                        <td className="text-end fw-bold">{formatearMoneda(mat.precioTotal)}</td>
                                        <td className="text-center">
                                          {estaPagado ? (
                                            <small className="text-muted">
                                              {mat.fechaPago ? new Date(mat.fechaPago).toLocaleDateString() : 'Pagado'}
                                            </small>
                                          ) : (
                                            <button
                                              className={`btn btn-sm ${estaSuspendido ? 'btn-success' : 'btn-warning'}`}
                                              onClick={() => toggleSuspenderMaterial(mat.id)}
                                              disabled={loading}
                                            >
                                              {estaSuspendido ? '✓ Reactivar' : '⏸ Suspender'}
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot className="table-light">
                                  <tr>
                                    <th colSpan="4" className="text-end">SUBTOTAL MATERIALES:</th>
                                    <th className="text-end">{formatearMoneda(materialesObra.reduce((sum, m) => sum + (m.precioTotal || 0), 0))}</th>
                                    <th></th>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* SECCIÓN OTROS COSTOS */}
                        {otrosCostosObra.length > 0 && (
                          <div className="mb-4">
                            <h5 className="bg-warning text-dark p-3 rounded mb-3">
                              <i className="bi bi-receipt me-2"></i>
                              📋 Gastos Generales ({otrosCostosObra.length})
                              {otrosCostosObra.filter(c => c.pagado).length > 0 && (
                                <span className="badge bg-success ms-2">
                                  ✅ {otrosCostosObra.filter(c => c.pagado).length} pagado(s)
                                </span>
                              )}
                            </h5>
                            <div className="table-responsive">
                              <table className="table table-hover table-bordered table-sm">
                                <thead className="table-dark">
                                  <tr>
                                    <th>Tipo</th>
                                    <th>Descripción</th>
                                    <th>Total</th>
                                    <th>Acción</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {otrosCostosObra.map(costo => {
                                    const estaSuspendido = otrosCostosSuspendidos.has(costo.id);
                                    const estaPagado = costo.pagado;
                                    return (
                                      <tr key={costo.id} className={estaSuspendido ? 'table-secondary' : estaPagado ? 'table-success' : ''}>
                                        <td>{costo.tipo}</td>
                                        <td>
                                          {costo.nombre}
                                          {estaPagado && (
                                            <span className="badge bg-success ms-2">✅ PAGADO</span>
                                          )}
                                          {estaSuspendido && !estaPagado && (
                                            <span className="badge bg-secondary ms-2">Suspendido</span>
                                          )}
                                        </td>
                                        <td className="text-end fw-bold">{formatearMoneda(costo.precioTotal)}</td>
                                        <td className="text-center">
                                          {estaPagado ? (
                                            <small className="text-muted">
                                              {costo.fechaPago ? new Date(costo.fechaPago).toLocaleDateString() : 'Pagado'}
                                            </small>
                                          ) : (
                                            <button
                                              className={`btn btn-sm ${estaSuspendido ? 'btn-success' : 'btn-warning'}`}
                                              onClick={() => toggleSuspenderOtroCosto(costo.id)}
                                              disabled={loading}
                                            >
                                              {estaSuspendido ? '✓ Reactivar' : '⏸ Suspender'}
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot className="table-light">
                                  <tr>
                                    <th colSpan="2" className="text-end">SUBTOTAL GASTOS GENERALES:</th>
                                    <th className="text-end">{formatearMoneda(otrosCostosObra.reduce((sum, c) => sum + (c.precioTotal || 0), 0))}</th>
                                    <th></th>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* TOTAL DE LA OBRA */}
                        <div className="alert alert-primary mt-3">
                          <div className="row">
                            <div className="col-md-12 text-end">
                              <h5 className="mb-0">
                                💰 TOTAL OBRA: 
                                <strong className="ms-2">
                                  {formatearMoneda(
                                    profesionalesObra.reduce((sum, p) => sum + ((p.cantidadJornales || 0) * (p.precioJornal || 0)), 0) +
                                    materialesObra.reduce((sum, m) => sum + (m.precioTotal || 0), 0) +
                                    otrosCostosObra.reduce((sum, c) => sum + (c.precioTotal || 0), 0)
                                  )}
                                </strong>
                              </h5>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Tabs para seleccionar tipo - DEPRECATED, ahora se muestra todo junto */}
            {false && (
            <>
            <div className="mb-3">
              <div className="btn-group w-100" role="group">
                <button
                  type="button"
                  className={`btn btn-lg ${tipoGasto === 'PROFESIONALES' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setTipoGasto('PROFESIONALES')}
                >
                  👷 Profesionales ({profesionales.length})
                  {profesionales.filter(p => p.saldoPendiente <= 1 && p.totalProfesional > 0).length > 0 && (
                    <span className="badge bg-success ms-2">
                      ✅ {profesionales.filter(p => p.saldoPendiente <= 1 && p.totalProfesional > 0).length} pagado(s)
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className={`btn btn-lg ${tipoGasto === 'MATERIALES' ? 'btn-success' : 'btn-outline-success'}`}
                  onClick={() => setTipoGasto('MATERIALES')}
                >
                  🧱 Materiales ({materiales.length})
                  {materiales.filter(m => m.pagado).length > 0 && (
                    <span className="badge bg-success ms-2">
                      ✅ {materiales.filter(m => m.pagado).length} pagado(s)
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className={`btn btn-lg ${tipoGasto === 'OTROS_COSTOS' ? 'btn-warning' : 'btn-outline-warning'}`}
                  onClick={() => setTipoGasto('OTROS_COSTOS')}
                >
                  📋 Gastos Generales ({otrosCostos.length})
                  {otrosCostos.filter(c => c.pagado).length > 0 && (
                    <span className="badge bg-success ms-2">
                      ✅ {otrosCostos.filter(c => c.pagado).length} pagado(s)
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* PROFESIONALES */}
            {tipoGasto === 'PROFESIONALES' && (
              <div className="card mb-4 shadow-sm">
                <div className="card-header bg-info text-white">
                  <h5 className="mb-0">
                    👷 Profesionales Activos ({profesionales.length})
                    {profesionales.filter(p => p.saldoPendiente <= 1 && p.totalProfesional > 0).length > 0 && (
                      <span className="badge bg-light text-info ms-2">
                        ✅ {profesionales.filter(p => p.saldoPendiente <= 1 && p.totalProfesional > 0).length} pagado(s)
                      </span>
                    )}
                  </h5>
                </div>
                <div className="card-body">
                  {profesionales.length > 0 && (
                    <div className="mb-3">
                      <button
                        className="btn btn-success btn-lg w-100"
                        onClick={handlePagarATodos}
                        disabled={loading || profesionales.filter(p => p.saldoPendiente > 0 && !profesionalesSuspendidos.has(p.id)).length === 0}
                      >
                        {loading ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2"></span>
                            Procesando pagos...
                          </>
                        ) : (
                          <>
                            💸 Pagar a Todos los Profesionales con Saldo Pendiente
                            {profesionales.filter(p => p.saldoPendiente > 0 && !profesionalesSuspendidos.has(p.id)).length > 0 && (
                              <span className="ms-2">
                                ({profesionales.filter(p => p.saldoPendiente > 0 && !profesionalesSuspendidos.has(p.id)).length} prof. - 
                                Total: {formatearMoneda(profesionales.filter(p => !profesionalesSuspendidos.has(p.id)).reduce((sum, p) => sum + (p.saldoPendiente || 0), 0))})
                              </span>
                            )}
                          </>
                        )}
                      </button>
                      {profesionalesSuspendidos.size > 0 && (
                        <div className="alert alert-warning mt-2 py-2 mb-0">
                          <small>⚠️ {profesionalesSuspendidos.size} profesional(es) suspendido(s) no será(n) pagado(s)</small>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="table-responsive" style={{maxHeight: '500px', overflowY: 'auto'}}>
                    <table className="table table-hover table-bordered table-sm">
                      <thead className="table-dark sticky-top">
                        <tr>
                          <th>Obra</th>
                          <th>Tipo Profesional</th>
                          <th>Nombre Completo</th>
                          <th>Días Trabajados</th>
                          <th>Tarifa por Día</th>
                          <th>Total a Pagar</th>
                          <th>Total Pagado</th>
                          <th>Saldo Pendiente</th>
                          <th>Estado Pago</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const gruposObra = agruparPorObra(profesionales);
                          return Object.entries(gruposObra).map(([nombreObra, profesionalesObra]) => (
                            <React.Fragment key={nombreObra}>
                              {/* Encabezado de obra */}
                              <tr className="table-info">
                                <td colSpan="10" className="fw-bold py-3">
                                  <i className="bi bi-building me-2"></i>
                                  📋 OBRA: {nombreObra}
                                  <span className="badge bg-primary ms-3">{profesionalesObra.length} profesional(es)</span>
                                </td>
                              </tr>
                              {/* Profesionales de esta obra */}
                              {profesionalesObra.map(prof => {
                                const totalJornales = (prof.cantidadJornales || 0) * (prof.precioJornal || 0);
                                const porcentaje = prof.porcentajeCobrado || 0;
                                const estaSuspendido = profesionalesSuspendidos.has(prof.id);
                                
                                return (
                                  <tr 
                                    key={prof.id} 
                                    className={
                                      estaSuspendido ? 'table-secondary' : 
                                      porcentaje >= 100 ? 'table-success' : 
                                      porcentaje > 0 ? 'table-warning' : ''
                                    }
                                  >
                                    <td><small className="text-muted">↳</small></td>
                                    <td>{prof.tipoProfesional}</td>
                                    <td>
                                      {prof.nombreCompleto}
                                      {estaSuspendido && <span className="badge bg-secondary ms-2">Suspendido</span>}
                                    </td>
                                    <td className="text-center">{prof.cantidadJornales}</td>
                                    <td className="text-end">{formatearMoneda(prof.precioJornal)}</td>
                                    <td className="text-end fw-bold">{formatearMoneda(totalJornales)}</td>
                                    <td className="text-end text-success">{formatearMoneda(prof.totalPagado || 0)}</td>
                                    <td className="text-end text-danger">{formatearMoneda(prof.saldoPendiente || 0)}</td>
                                    <td className="text-center">
                                      {totalJornales > 0 && (prof.totalPagado || 0) >= totalJornales ? (
                                        <span className="badge bg-success">✅ Completo</span>
                                      ) : (prof.totalPagado || 0) > 0 && totalJornales > 0 ? (
                                        <span className="badge bg-warning text-dark">⚠️ Parcial ({((prof.totalPagado / totalJornales) * 100).toFixed(0)}%)</span>
                                      ) : (
                                        <span className="badge bg-secondary">Pendiente</span>
                                      )}
                                    </td>
                                    <td>
                                      {porcentaje < 100 && (
                                        <button
                                          className={`btn btn-sm ${estaSuspendido ? 'btn-success' : 'btn-warning'}`}
                                          onClick={() => toggleSuspenderProfesional(prof.id)}
                                          disabled={loading}
                                        >
                                          {estaSuspendido ? '✓ Reactivar' : '⏸ Suspender'}
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* MATERIALES */}
            {tipoGasto === 'MATERIALES' && (
              <div className="card mb-4 shadow-sm">
                <div className="card-header bg-success text-white">
                  <h5 className="mb-0">
                    🧱 Materiales ({materiales.length})
                    {materiales.filter(m => m.pagado).length > 0 && (
                      <span className="badge bg-light text-success ms-2">
                        ✅ {materiales.filter(m => m.pagado).length} pagado(s)
                      </span>
                    )}
                  </h5>
                </div>
                <div className="card-body">
                  {materiales.length > 0 && (
                    <div className="mb-3">
                    <button
                      className="btn btn-success btn-lg w-100"
                      onClick={async () => {
                        // Filtrar: Solo materiales no pagados y no suspendidos
                        const materialesParaPagar = materiales.filter(m => !m.pagado && !materialesSuspendidos.has(m.id));
                        if (materialesParaPagar.length === 0) {
                          alert('No hay materiales para pagar (todos están pagados o suspendidos)');
                          return;
                        }
                        const total = materialesParaPagar.reduce((sum, m) => sum + (m.precioTotal || 0), 0);
                        if (!window.confirm(`¿Confirmar pago de ${materialesParaPagar.length} material(es) por un total de ${formatearMoneda(total)}?${materialesSuspendidos.size > 0 ? `\n\n⚠️ ${materialesSuspendidos.size} material(es) suspendido(s) no será(n) pagado(s)` : ''}`)) {
                          return;
                        }
                        
                        setLoading(true);
                        try {
                          // Preparar datos de pagos de materiales
                          const pagosData = materialesParaPagar.map(material => {
                            const cantidad = parseFloat(material.cantidadUnidades) || 1;
                            const monto = parseFloat(material.precioTotal) || 0;
                            const precioUnitario = cantidad > 0 ? (monto / cantidad) : monto;
                            
                            return {
                              presupuestoNoClienteId: material.presupuestoId,
                              itemCalculadoraId: material.itemCalculadoraId, // ID real del item
                              materialCalculadoraId: material.materialCalculadoraId, // ID real del material
                              empresaId: empresaSeleccionada.id,
                              tipoPago: 'MATERIALES',
                              concepto: material.nombre,
                              cantidad: cantidad,
                              precioUnitario: precioUnitario,
                              monto: monto,
                              metodoPago: 'EFECTIVO',
                              fechaPago: new Date().toISOString().split('T')[0],
                              estado: 'PAGADO',
                              observaciones: `Pago de material - Obra: ${material.nombreObra}`
                            };
                          });
                          
                          // Registrar pagos en el backend
                          const resultado = await registrarPagosConsolidadosBatch(pagosData, empresaSeleccionada.id);
                          
                          // 📡 Notificar al contexto centralizado
                          eventBus.emit(FINANCIAL_EVENTS.PAGO_CONSOLIDADO_REGISTRADO, {
                            tipo: 'MATERIALES',
                            cantidad: pagosData.length
                          });
                          
                          console.log('✅ Resultado del registro:', resultado);
                          
                          // El backend podría devolver undefined si todo fue exitoso pero sin response body
                          const cantidadRegistrada = resultado?.cantidadRegistrados || pagosData.length;
                          const totalMonto = resultado?.totalMonto || total;
                          
                          if (onSuccess) onSuccess({
                            mensaje: `✅ ${cantidadRegistrada} pago(s) de materiales registrados por ${formatearMoneda(totalMonto)}`
                          });
                          
                          // Recargar datos
                          cargarTodosLosPresupuestos();
                        } catch (error) {
                          console.error('❌ Error registrando pagos de materiales:');
                          console.error('📊 Error completo:', error);
                          
                          const errorMsg = error.data?.error 
                            || error.data?.mensaje 
                            || error.data?.message 
                            || error.message 
                            || 'Error desconocido';
                          
                          alert(`❌ Error al registrar pagos:\n\n${errorMsg}`);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading || materiales.filter(m => !m.pagado && !materialesSuspendidos.has(m.id)).length === 0}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Procesando pagos...
                        </>
                      ) : (
                        <>
                          💸 Pagar Todos los Materiales
                          {materiales.filter(m => !m.pagado && !materialesSuspendidos.has(m.id)).length > 0 && (
                            <span className="ms-2">
                              ({materiales.filter(m => !m.pagado && !materialesSuspendidos.has(m.id)).length} mat. - 
                              Total: {formatearMoneda(materiales.filter(m => !m.pagado && !materialesSuspendidos.has(m.id)).reduce((sum, m) => sum + (m.precioTotal || 0), 0))})
                            </span>
                          )}
                        </>
                      )}
                    </button>
                    {materialesSuspendidos.size > 0 && (
                      <div className="alert alert-warning mt-2 py-2 mb-0">
                        <small>⚠️ {materialesSuspendidos.size} material(es) suspendido(s) no será(n) pagado(s)</small>
                      </div>
                    )}
                  </div>
                )}

                <div className="table-responsive" style={{maxHeight: '500px', overflowY: 'auto'}}>
                <table className="table table-hover table-bordered table-sm">
                  <thead className="table-dark sticky-top">
                    <tr>
                      <th>Obra</th>
                      <th>Material</th>
                      <th>Cantidad</th>
                      <th>Unidad</th>
                      <th>Precio Unit.</th>
                      <th>Total</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materiales.map(mat => {
                      const estaSuspendido = materialesSuspendidos.has(mat.id);
                      const estaPagado = mat.pagado; // ✅ Nuevo flag de pagado
                      return (
                        <tr key={mat.id} className={estaSuspendido ? 'table-secondary' : estaPagado ? 'table-success' : ''}>
                          <td><small>{mat.nombreObra}</small></td>
                          <td>
                            {mat.nombre}
                            {estaPagado && (
                              <span className="badge bg-success ms-2">✅ PAGADO</span>
                            )}
                            {estaSuspendido && !estaPagado && (
                              <span className="badge bg-secondary ms-2">Suspendido</span>
                            )}
                          </td>
                          <td className="text-center">{mat.cantidadUnidades}</td>
                          <td>{mat.unidad}</td>
                          <td className="text-end">{formatearMoneda(mat.precioUnidad)}</td>
                          <td className="text-end fw-bold">{formatearMoneda(mat.precioTotal)}</td>
                          <td>
                            {estaPagado ? (
                              <small className="text-muted">
                                {mat.fechaPago ? new Date(mat.fechaPago).toLocaleDateString() : 'Pagado'}
                              </small>
                            ) : (
                              <button
                                className={`btn btn-sm ${estaSuspendido ? 'btn-success' : 'btn-warning'}`}
                                onClick={() => toggleSuspenderMaterial(mat.id)}
                                disabled={loading}
                              >
                                {estaSuspendido ? '✓ Reactivar' : '⏸ Suspender'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="table-light">
                    <tr>
                      <th colSpan="5" className="text-end">TOTAL MATERIALES:</th>
                      <th className="text-end">{formatearMoneda(materiales.reduce((sum, m) => sum + (m.precioTotal || 0), 0))}</th>
                      <th></th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
            )}

            {/* OTROS COSTOS */}
            {tipoGasto === 'OTROS_COSTOS' && (
              <div className="card mb-4 shadow-sm">
                <div className="card-header bg-warning text-dark">
                  <h5 className="mb-0">
                    📋 Gastos Generales ({otrosCostos.length})
                    {otrosCostos.filter(c => c.pagado).length > 0 && (
                      <span className="badge bg-light text-dark ms-2">
                        ✅ {otrosCostos.filter(c => c.pagado).length} pagado(s)
                      </span>
                    )}
                  </h5>
                </div>
                <div className="card-body">
                {otrosCostos.length > 0 && (
                  <div className="mb-3">
                    <button
                      className="btn btn-success btn-lg w-100"
                      onClick={async () => {
                        // Filtrar: Solo otros costos no pagados y no suspendidos
                        const costosParaPagar = otrosCostos.filter(c => !c.pagado && !otrosCostosSuspendidos.has(c.id));
                        if (costosParaPagar.length === 0) {
                          alert('No hay otros costos para pagar (todos están pagados o suspendidos)');
                          return;
                        }
                        const total = costosParaPagar.reduce((sum, c) => sum + (c.precioTotal || 0), 0);
                        if (!window.confirm(`¿Confirmar pago de ${costosParaPagar.length} otro(s) costo(s) por un total de ${formatearMoneda(total)}?${otrosCostosSuspendidos.size > 0 ? `\n\n⚠️ ${otrosCostosSuspendidos.size} costo(s) suspendido(s) no será(n) pagado(s)` : ''}`)) {
                          return;
                        }
                        
                        setLoading(true);
                        try {
                          // Preparar datos de pagos consolidados
                          const pagosData = costosParaPagar.map(costo => {
                            return {
                              presupuestoNoClienteId: costo.presupuestoId,
                              itemCalculadoraId: costo.itemCalculadoraId, // ID real del item
                              materialCalculadoraId: null, // NULL para gastos generales
                              empresaId: empresaSeleccionada.id,
                              tipoPago: 'GASTOS_GENERALES',
                              concepto: costo.nombre,
                              cantidad: 1,
                              precioUnitario: parseFloat(costo.precioTotal),
                              monto: parseFloat(costo.precioTotal),
                              metodoPago: 'EFECTIVO',
                              fechaPago: new Date().toISOString().split('T')[0],
                              estado: 'PAGADO',
                              observaciones: costo.observaciones || `Pago de gastos generales - ${costo.tipo} - Obra: ${costo.nombreObra}`
                            };
                          });
                          
                          // Registrar pagos en el backend
                          const resultado = await registrarPagosConsolidadosBatch(pagosData, empresaSeleccionada.id);
                          
                          // 📡 Notificar al contexto centralizado
                          eventBus.emit(FINANCIAL_EVENTS.PAGO_CONSOLIDADO_REGISTRADO, {
                            tipo: 'GASTOS_GENERALES',
                            cantidad: pagosData.length
                          });
                          
                          console.log('✅ Resultado del registro:', resultado);
                          
                          // El backend podría devolver undefined si todo fue exitoso pero sin response body
                          const cantidadRegistrada = resultado?.cantidadRegistrados || pagosData.length;
                          const totalMonto = resultado?.totalMonto || total;
                          
                          if (onSuccess) onSuccess({
                            mensaje: `✅ ${cantidadRegistrada} pago(s) de gastos generales registrados por ${formatearMoneda(totalMonto)}`
                          });
                          
                          // Recargar datos
                          cargarTodosLosPresupuestos();
                        } catch (error) {
                          console.error('❌ Error registrando pagos de gastos generales:');
                          console.error('📊 Error completo:', error);
                          
                          const errorMsg = error.data?.error 
                            || error.data?.mensaje 
                            || error.data?.message 
                            || error.message 
                            || 'Error desconocido';
                          
                          alert(`❌ Error al registrar pagos:\n\n${errorMsg}`);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading || otrosCostos.filter(c => !c.pagado && !otrosCostosSuspendidos.has(c.id)).length === 0}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Procesando pagos...
                        </>
                      ) : (
                        <>
                          💸 Pagar Todos los Gastos Generales
                          {otrosCostos.filter(c => !c.pagado && !otrosCostosSuspendidos.has(c.id)).length > 0 && (
                            <span className="ms-2">
                              ({otrosCostos.filter(c => !c.pagado && !otrosCostosSuspendidos.has(c.id)).length} costos - 
                              Total: {formatearMoneda(otrosCostos.filter(c => !c.pagado && !otrosCostosSuspendidos.has(c.id)).reduce((sum, c) => sum + (c.precioTotal || 0), 0))})
                            </span>
                          )}
                        </>
                      )}
                    </button>
                    {otrosCostosSuspendidos.size > 0 && (
                      <div className="alert alert-warning mt-2 py-2 mb-0">
                        <small>⚠️ {otrosCostosSuspendidos.size} costo(s) suspendido(s) no será(n) pagado(s)</small>
                      </div>
                    )}
                  </div>
                )}

                <div className="table-responsive" style={{maxHeight: '500px', overflowY: 'auto'}}>
                <table className="table table-hover table-bordered table-sm">
                  <thead className="table-dark sticky-top">
                    <tr>
                      <th>Obra</th>
                      <th>Tipo</th>
                      <th>Descripción</th>
                      <th>Total</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const gruposObra = agruparPorObra(otrosCostos);
                      return Object.entries(gruposObra).map(([nombreObra, costosObra]) => (
                        <React.Fragment key={nombreObra}>
                          {/* Encabezado de obra */}
                          <tr className="table-info">
                            <td colSpan="5" className="fw-bold py-3">
                              <i className="bi bi-building me-2"></i>
                              📋 OBRA: {nombreObra}
                              <span className="badge bg-primary ms-3">{costosObra.length} costo(s)</span>
                            </td>
                          </tr>
                          {/* Costos de esta obra */}
                          {costosObra.map(costo => {
                            const estaSuspendido = otrosCostosSuspendidos.has(costo.id);
                            const estaPagado = costo.pagado; // ✅ Nuevo flag de pagado
                            return (
                              <tr key={costo.id} className={estaSuspendido ? 'table-secondary' : estaPagado ? 'table-success' : ''}>
                                <td><small className="text-muted">↳</small></td>
                                <td>{costo.tipo}</td>
                                <td>
                                  {costo.nombre}
                                  {estaPagado && (
                                    <span className="badge bg-success ms-2">✅ PAGADO</span>
                                  )}
                                  {estaSuspendido && !estaPagado && (
                                    <span className="badge bg-secondary ms-2">Suspendido</span>
                                  )}
                                </td>
                                <td className="text-end fw-bold">{formatearMoneda(costo.precioTotal)}</td>
                                <td>
                                  {estaPagado ? (
                                    <small className="text-muted">
                                      {costo.fechaPago ? new Date(costo.fechaPago).toLocaleDateString() : 'Pagado'}
                                    </small>
                                  ) : (
                                    <button
                                      className={`btn btn-sm ${estaSuspendido ? 'btn-success' : 'btn-warning'}`}
                                      onClick={() => toggleSuspenderOtroCosto(costo.id)}
                                      disabled={loading}
                                    >
                                      {estaSuspendido ? '✓ Reactivar' : '⏸ Suspender'}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      ));
                    })()}
                  </tbody>
                  <tfoot className="table-light">
                    <tr>
                      <th colSpan="3" className="text-end">TOTAL GASTOS GENERALES:</th>
                      <th className="text-end">{formatearMoneda(otrosCostos.reduce((sum, c) => sum + (c.precioTotal || 0), 0))}</th>
                      <th></th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
            )}
            </>
            )}
            {/* FIN DE TABS DEPRECATED */}
          </div>

          <div className="modal-footer bg-light">
            <button 
              type="button" 
              className="btn btn-secondary btn-lg" 
              onClick={onHide}
              disabled={loading}
            >
              ← Volver
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SistemaFinancieroConsolidadoModal;
