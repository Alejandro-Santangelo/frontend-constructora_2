import React, { useState, useEffect } from 'react';
import { 
  listarPagosPorProfesional,
  listarTodosPagosEmpresa,
  marcarComoPagado, 
  anularPago, 
  eliminarPago,
  obtenerTotalPagado,
  obtenerAdelantos,
  obtenerPromedioPresentismo,
  formatearMoneda, 
  formatearFecha,
  formatearPorcentaje,
  obtenerEstadoPago,
  obtenerTipoPago,
  calcularNetoPagar
} from '../services/pagosProfesionalObraService';
import { useEmpresa } from '../EmpresaContext';
import api from '../services/api';
import DireccionObraSelector from './DireccionObraSelector';
import eventBus, { FINANCIAL_EVENTS } from '../utils/eventBus';
import { ordenarPorRubro } from '../utils/badgeColors';

/**
 * Modal para listar pagos a profesionales
 * ✨ Con sincronización automática vía EventBus
 */

const ListarPagosProfesionalModal = ({ show, onHide, onSuccess, obraDireccion, modoConsolidado, refreshTrigger, obrasSeleccionadas, obrasDisponibles }) => {
  const { empresaSeleccionada } = useEmpresa();
  const [direccionSeleccionada, setDireccionSeleccionada] = useState(obraDireccion || null);
  
  // Determinar si hay selección parcial de obras
  const haySeleccionParcial = obrasSeleccionadas && obrasSeleccionadas.size > 0;
  const [pagos, setPagos] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [otrosCostos, setOtrosCostos] = useState([]);
  const [trabajosExtra, setTrabajosExtra] = useState([]); // 🔧 NUEVO
  const [tipoGastoFiltro, setTipoGastoFiltro] = useState('TODOS'); // TODOS, PROFESIONALES, MATERIALES, OTROS_COSTOS, TRABAJOS_EXTRA
  const [itemSeleccionado, setItemSeleccionado] = useState(''); // ID del profesional/material/gasto/trabajo seleccionado
  const [totalPagado, setTotalPagado] = useState(0);
  const [totalAdelantos, setTotalAdelantos] = useState(0);
  const [promedioPresentismo, setPromedioPresentismo] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState('TODOS');

  useEffect(() => {
    if (show && empresaSeleccionada) {
      console.log('🔄 ListarPagos: Actualizando datos automáticamente...');
      // Reset state
      setDireccionSeleccionada(obraDireccion || null);
      setItemSeleccionado('');
      setTipoGastoFiltro('TODOS');
      setPagos([]);
      setProfesionales([]);
      setMateriales([]);
      setOtrosCostos([]);
      setError(null);
      
      // Si está en modo consolidado, cargar directamente
      if (modoConsolidado) {
        cargarPagosConsolidados();
      }
    }
  }, [show, empresaSeleccionada, obraDireccion, modoConsolidado, refreshTrigger]);

  // Auto-refresh: Recargar items cuando cambia el presupuesto o se actualiza
  useEffect(() => {
    if (modoConsolidado) {
      // En modo consolidado no cargamos items individuales
      return;
    }
    if (direccionSeleccionada && empresaSeleccionada && show) {
      console.log('🔄 Recargando items del presupuesto...');
      cargarItemsDelPresupuesto();
    } else {
      setProfesionales([]);
      setMateriales([]);
      setOtrosCostos([]);
      setItemSeleccionado('');
    }
  }, [direccionSeleccionada, empresaSeleccionada, modoConsolidado, show, refreshTrigger]);

  // Auto-refresh: Recargar pagos cuando cambia el item seleccionado o se actualiza
  useEffect(() => {
    if (itemSeleccionado && empresaSeleccionada && show) {
      console.log('🔄 Recargando pagos del item seleccionado...');
      cargarPagos();
      cargarEstadisticas();
    } else {
      // Si no hay item seleccionado, limpiar pagos
      setPagos([]);
    }
  }, [itemSeleccionado, empresaSeleccionada, show, refreshTrigger]);

  useEffect(() => {
    if (itemSeleccionado && empresaSeleccionada && show) {
      console.log('🔄 Recargando pagos del item seleccionado...');
      cargarPagos();
      cargarEstadisticas();
    } else {
      // Si no hay item seleccionado, limpiar pagos
      setPagos([]);
    }
  }, [itemSeleccionado, empresaSeleccionada, show, refreshTrigger]);

  // 🚌 SINCRONIZACIÓN AUTOMÁTICA: Escuchar eventos financieros
  useEffect(() => {
    if (!show) return;
    
    console.log('🎧 ListarPagos: Suscribiendo a eventos financieros...');
    
    const handleFinancialEvent = (eventData) => {
      console.log('📡 Evento financiero recibido en ListarPagos, recargando...', eventData);
      
      if (modoConsolidado) {
        cargarPagosConsolidados();
      } else if (itemSeleccionado) {
        cargarPagos();
        cargarEstadisticas();
      }
    };
    
    // Suscribirse a eventos de pagos
    const unsubscribers = [
      eventBus.on(FINANCIAL_EVENTS.PAGO_REGISTRADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.PAGO_ACTUALIZADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.PAGO_ELIMINADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.PAGO_CONSOLIDADO_REGISTRADO, handleFinancialEvent),
    ];
    
    // Cleanup
    return () => {
      console.log('🔇 ListarPagos: Desuscribiendo de eventos');
      unsubscribers.forEach(unsub => unsub());
    };
  }, [show, modoConsolidado, itemSeleccionado]);

  const cargarItemsDelPresupuesto = async () => {
    try {
      console.log('🔍 Cargando items del presupuesto:', direccionSeleccionada.presupuestoNoClienteId);
      
      // Obtener el presupuesto completo con sus items de calculadora
      const presupuesto = await api.presupuestosNoCliente.getById(
        direccionSeleccionada.presupuestoNoClienteId, 
        empresaSeleccionada.id
      );
      
      console.log('📦 Presupuesto obtenido:', presupuesto);
      
      // Extraer profesionales, materiales y otros costos de itemsCalculadora
      const itemsCalculadora = presupuesto.itemsCalculadora || [];
      console.log('📋 Items de calculadora:', itemsCalculadora.length);
      
      // PROFESIONALES
      const todosProfesionales = [];
      itemsCalculadora.forEach(item => {
        if (item.profesionales && Array.isArray(item.profesionales)) {
          item.profesionales.forEach(prof => {
            todosProfesionales.push({
              id: prof.id || `${item.id}-prof-${prof.tipoProfesional}-${prof.nombre}`,
              tipoProfesional: prof.tipoProfesional || item.tipoProfesional,
              nombre: prof.nombre || 'Sin nombre',
              cantidadJornales: prof.cantidadJornales,
              importeJornal: prof.importeJornal,
              profesionalNombre: prof.nombre || 'Sin nombre',
              tipo: prof.tipoProfesional || item.tipoProfesional
            });
          });
        }
      });
      
      // MATERIALES
      const todosMateriales = [];
      itemsCalculadora.forEach(item => {
        if (item.materialesLista && Array.isArray(item.materialesLista)) {
          item.materialesLista.forEach(mat => {
            todosMateriales.push({
              id: mat.id || `${item.id}-mat-${mat.nombre}`,
              nombre: mat.nombre || 'Sin nombre',
              cantidadUnidades: mat.cantidadUnidades,
              precioUnidad: mat.precioUnidad,
              precioTotal: mat.precioTotal
            });
          });
        }
      });
      
      // OTROS COSTOS (gastos generales)
      const todosOtrosCostos = [];
      itemsCalculadora.forEach(item => {
        if (item.gastosGenerales && Array.isArray(item.gastosGenerales)) {
          item.gastosGenerales.forEach(gasto => {
            todosOtrosCostos.push({
              id: gasto.id || `${item.id}-gasto-${gasto.nombre}`,
              nombre: gasto.nombre || 'Sin nombre',
              precioTotal: gasto.precioTotal
            });
          });
        }
      });
      
      // TRABAJOS EXTRA
      const todosTrabajosExtra = [];
      try {
        // Cargar trabajos extra de la obra
        const obraId = presupuesto.obraId || presupuesto.obra_id;
        if (obraId) {
          const trabajosExtraResponse = await api.trabajosExtra.getAll(empresaSeleccionada.id, { obraId });
          const trabajos = Array.isArray(trabajosExtraResponse) ? trabajosExtraResponse : trabajosExtraResponse?.data || [];
          
          trabajos.forEach(trabajo => {
            todosTrabajosExtra.push({
              id: trabajo.id,
              nombre: trabajo.nombre || 'Sin nombre',
              observaciones: trabajo.observaciones,
              totalCalculado: trabajo.totalCalculado || 0,
              estadoPago: trabajo.estadoPago || 'PENDIENTE'
            });
          });
        }
        console.log('✅ Trabajos extra:', todosTrabajosExtra.length);
      } catch (err) {
        console.warn('⚠️ Error cargando trabajos extra:', err);
      }
      
      console.log('✅ Profesionales:', todosProfesionales.length);
      console.log('✅ Materiales:', todosMateriales.length);
      console.log('✅ Otros Costos:', todosOtrosCostos.length);
      console.log('✅ Trabajos Extra:', todosTrabajosExtra.length);
      
      setProfesionales(todosProfesionales);
      setMateriales(todosMateriales);
      setOtrosCostos(todosOtrosCostos);
      setTrabajosExtra(todosTrabajosExtra);
      
    } catch (err) {
      console.error('❌ Error cargando items del presupuesto:', err);
      setError('Error al cargar los items del presupuesto.');
      setProfesionales([]);
      setMateriales([]);
      setOtrosCostos([]);
    }
  };

  const cargarPagosConsolidados = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('🌐 Cargando pagos consolidados...');
      console.log('  📍 Empresa ID:', empresaSeleccionada?.id);
      
      // 🆕 Cargar pagos de materiales/gastos Y trabajos extra (estos están OK)
      const [pagosConsolidados, pagosTrabajosExtra] = await Promise.all([
        import('../services/pagosConsolidadosService.js').then(m => 
          m.listarPagosConsolidadosPorEmpresa(empresaSeleccionada.id)
        ).catch(err => {
          console.warn('⚠️ Error cargando pagos consolidados:', err);
          return [];
        }),
        api.pagosTrabajoExtra.getByEmpresa(empresaSeleccionada.id).catch(err => {
          console.warn('⚠️ Error cargando pagos de trabajos extra:', err);
          return [];
        })
      ]);
      
      // 🔧 Para pagos profesionales, cargar desde cada obra (como hace Sistema Financiero)
      let pagosProfesionalesCompletos = [];
      if (obrasDisponibles && obrasDisponibles.length > 0) {
        console.log(`👷 Cargando pagos profesionales de ${obrasDisponibles.length} obra(s)...`);
        
        const promesasPagos = obrasDisponibles.map(async (obra) => {
          try {
            // Usar el endpoint de pagos por obra que SÍ funciona
            const pagosPorObra = await api.get('/api/v1/pagos-profesional-obra', {
              params: { 
                empresaId: empresaSeleccionada.id,
                obraId: obra.obraId 
              }
            });
            
            const pagosArray = Array.isArray(pagosPorObra) ? pagosPorObra : 
                              pagosPorObra?.data ? pagosPorObra.data : [];
            
            // Asegurar que tengan presupuestoNoClienteId
            return pagosArray.map(p => ({
              ...p,
              presupuestoNoClienteId: p.presupuestoNoClienteId || obra.id,
              nombreObra: obra.nombreObra
            }));
          } catch (error) {
            console.warn(`  ⚠️ Error cargando pagos de obra ${obra.nombreObra}:`, error);
            return [];
          }
        });
        
        const resultados = await Promise.all(promesasPagos);
        pagosProfesionalesCompletos = resultados.flat();
      }
      
      console.log(`📦 Pagos profesionales: ${pagosProfesionalesCompletos.length}`);
      console.log(`📦 Pagos materiales/gastos: ${pagosConsolidados.length}`);
      console.log(`📦 Pagos trabajos extra: ${pagosTrabajosExtra.length}`);
      
      // 🔍 Log de tipos de pago para debug
      if (pagosProfesionalesCompletos.length > 0) {
        console.log('  📋 Muestra pago profesional:', pagosProfesionalesCompletos[0]);
        console.log('  📋 Tipos de pago profesionales:', [...new Set(pagosProfesionalesCompletos.map(p => p.tipoPago))]);
      } else {
        console.warn('  ⚠️ NO HAY PAGOS PROFESIONALES');
      }
      if (pagosConsolidados.length > 0) {
        console.log('  📋 Muestra pago consolidado:', pagosConsolidados[0]);
        console.log('  📋 Tipos de pago consolidados:', [...new Set(pagosConsolidados.map(p => p.tipoPago))]);
      }
      if (pagosTrabajosExtra.length > 0) {
        console.log('  📋 Muestra pago trabajo extra:', pagosTrabajosExtra[0]);
      }
      
      // Normalizar estructura de pagos consolidados para compatibilidad
      const pagosConsolidadosNormalizados = pagosConsolidados.map(pago => ({
        ...pago,
        tipoPago: pago.tipoPago || 'MATERIALES', // MATERIALES o GASTOS_GENERALES
        montoBruto: pago.monto || pago.montoBruto,
        montoNeto: pago.monto || pago.montoBruto,
        nombreProfesional: pago.concepto || pago.descripcion || 'Material/Gasto',
        presupuestoNoClienteId: pago.presupuestoNoClienteId
      }));
      
      // 🔧 Normalizar estructura de trabajos extra
      const pagosTrabajosExtraNormalizados = pagosTrabajosExtra.map(pago => ({
        ...pago,
        tipoPago: 'TRABAJOS_EXTRA',
        montoBruto: pago.montoFinal || pago.montoBase,
        montoNeto: pago.montoFinal || pago.montoBase,
        nombreProfesional: pago.concepto || 'Trabajo Extra',
        presupuestoNoClienteId: pago.presupuestoNoClienteId,
        fechaPago: pago.fechaPago || pago.fechaEmision
      }));
      
      // Combinar todos los tipos de pagos
      let todosLosPagos = [
        ...pagosProfesionalesCompletos, 
        ...pagosConsolidadosNormalizados,
        ...pagosTrabajosExtraNormalizados
      ];
      console.log(`📦 Total pagos combinados: ${todosLosPagos.length}`);
      
      // 🔍 Desglose por tipo de pago
      const desglose = todosLosPagos.reduce((acc, p) => {
        const tipo = p.tipoPago || 'SIN_TIPO';
        acc[tipo] = (acc[tipo] || 0) + 1;
        return acc;
      }, {});
      console.log('  📊 Desglose por tipo:', desglose);
      
      // ✅ Si hay obras seleccionadas con checkboxes, filtrar solo esas obras
      if (haySeleccionParcial && obrasDisponibles) {
        const idsSeleccionados = Array.from(obrasSeleccionadas);
        console.log(`🔍 IDs seleccionados:`, idsSeleccionados);
        
        todosLosPagos = todosLosPagos.filter(pago => 
          idsSeleccionados.includes(pago.presupuestoNoClienteId)
        );
        console.log(`✅ Filtrados a ${todosLosPagos.length} pagos de ${obrasSeleccionadas.size} obras seleccionadas`);
      }
      
      // Enriquecer pagos con nombre de obra (si aún no lo tienen)
      if (obrasDisponibles && obrasDisponibles.length > 0) {
        todosLosPagos = todosLosPagos.map(pago => {
          // Si ya tiene nombreObra, no sobreescribir
          if (pago.nombreObra) return pago;
          
          const obra = obrasDisponibles.find(o => o.id === pago.presupuestoNoClienteId);
          return {
            ...pago,
            nombreObra: obra?.nombreObra || `Obra #${pago.presupuestoNoClienteId}`
          };
        });
      }
      
      setPagos(todosLosPagos);
      
      // Calcular total pagado
      const total = todosLosPagos
        .filter(p => p.estado === 'PAGADO')
        .reduce((sum, p) => sum + (parseFloat(p.montoNeto || p.montoBruto) || 0), 0);
      
      setTotalPagado(total);
      
      console.log(`✅ ${todosLosPagos.length === 0 ? 'No hay pagos registrados' : `Cargados ${todosLosPagos.length} pagos`}`);
    } catch (err) {
      console.error('❌ Error cargando pagos consolidados:', err);
      // Si el error es 404 (no encontrado), no mostrar error, solo dejar vacío
      if (err.response?.status === 404 || err.response?.status === 204) {
        console.log('ℹ️ No hay pagos registrados para esta empresa');
        setPagos([]);
        setTotalPagado(0);
      } else {
        // Solo mostrar error si es un error real del servidor
        setError('Error al cargar pagos consolidados');
        setPagos([]);
        setTotalPagado(0);
      }
    } finally {
      setLoading(false);
    }
  };

  // Función para cargar todos los pagos de la obra (sin filtrar por item específico)
  // NOTA: Actualmente comentada porque requiere endpoint específico en el backend
  /*
  const cargarTodosPagosObra = async () => {
    setLoading(true);
    setError(null);
    try {
      // Aquí deberías tener un endpoint que devuelva todos los pagos por dirección/presupuesto
      // Por ahora usamos el mismo endpoint filtrando después
      const data = await listarPagosPorProfesional(null, empresaSeleccionada.id);
      
      // Filtrar por presupuesto si es necesario
      const pagosFiltrados = Array.isArray(data) 
        ? data.filter(p => p.direccionObra === direccionSeleccionada.direccionObra)
        : [];
      
      setPagos(pagosFiltrados);
    } catch (err) {
      console.error('Error cargando todos los pagos:', err);
      setError('Error al cargar pagos. Por favor intente nuevamente.');
      setPagos([]);
    } finally {
      setLoading(false);
    }
  };
  */

  const cargarPagos = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listarPagosPorProfesional(itemSeleccionado, empresaSeleccionada.id);
      setPagos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando pagos:', err);
      setError('Error al cargar pagos. Por favor intente nuevamente.');
      setPagos([]);
    } finally {
      setLoading(false);
    }
  };

  const cargarEstadisticas = async () => {
    try {
      const [total, adelantos, presentismo] = await Promise.all([
        obtenerTotalPagado(itemSeleccionado, empresaSeleccionada.id),
        obtenerAdelantos(itemSeleccionado, empresaSeleccionada.id),
        obtenerPromedioPresentismo(itemSeleccionado, empresaSeleccionada.id)
      ]);
      
      setTotalPagado(total || 0);
      
      const totalAdelantosNum = Array.isArray(adelantos) 
        ? adelantos.reduce((sum, a) => sum + (a.monto || 0), 0) 
        : 0;
      setTotalAdelantos(totalAdelantosNum);
      
      setPromedioPresentismo(presentismo || 100);
    } catch (err) {
      console.error('Error cargando estadísticas:', err);
    }
  };

  const handleMarcarPagado = async (pagoId) => {
    const confirmar = window.confirm('¿Confirmar que este pago fue efectivamente realizado?');
    if (!confirmar) return;

    try {
      await marcarComoPagado(pagoId, null, empresaSeleccionada.id);
      
      if (onSuccess) {
        onSuccess({
          mensaje: '✅ Pago marcado como pagado exitosamente'
        });
      }
      
      if (modoConsolidado) {
        cargarPagosConsolidados();
      } else {
        cargarPagos();
        cargarEstadisticas();
      }
    } catch (err) {
      console.error('Error marcando pago:', err);
      alert('Error al marcar pago como pagado');
    }
  };

  const handleAnular = async (pagoId) => {
    const motivo = prompt('Ingrese el motivo de anulación:');
    if (!motivo) return;

    try {
      await anularPago(pagoId, motivo, empresaSeleccionada.id);
      
      if (onSuccess) {
        onSuccess({
          mensaje: '⚠️ Pago anulado exitosamente'
        });
      }
      
      if (modoConsolidado) {
        cargarPagosConsolidados();
      } else {
        cargarPagos();
        cargarEstadisticas();
      }
    } catch (err) {
      console.error('Error anulando pago:', err);
      alert('Error al anular pago');
    }
  };

  const handleEliminar = async (pago) => {
    const confirmar = window.confirm('⚠️ ¿Está seguro de eliminar este pago? Esta acción no se puede deshacer.');
    if (!confirmar) return;

    try {
      // Identificar tipo de pago para usar el endpoint correcto
      const TIPOS_PROFESIONAL = ['SEMANAL', 'ADELANTO', 'PAGO_FINAL', 'FINAL', 'PAGO_PARCIAL'];
      const TIPOS_CONSOLIDADO = ['MATERIALES', 'GASTOS_GENERALES', 'OTROS_COSTOS'];
      
      const esPagoProfesional = TIPOS_PROFESIONAL.includes(pago.tipoPago);
      const esPagoConsolidado = TIPOS_CONSOLIDADO.includes(pago.tipoPago);
      
      if (esPagoProfesional) {
        // DELETE /api/v1/pagos-profesional-obra/{id}
        await eliminarPago(pago.id, empresaSeleccionada.id);
      } else if (esPagoConsolidado) {
        // DELETE /api/v1/pagos-consolidados/{id}
        const { eliminarPagoConsolidado } = await import('../services/pagosConsolidadosService.js');
        await eliminarPagoConsolidado(pago.id, empresaSeleccionada.id);
      } else {
        console.error('❌ Tipo de pago no reconocido:', pago.tipoPago);
        alert('Error: Tipo de pago no reconocido');
        return;
      }
      
      if (onSuccess) {
        onSuccess({
          mensaje: '🗑️ Pago eliminado exitosamente'
        });
      }
      
      if (modoConsolidado) {
        cargarPagosConsolidados();
      } else {
        cargarPagos();
        cargarEstadisticas();
      }
    } catch (err) {
      console.error('Error eliminando pago:', err);
      alert('Error al eliminar pago');
    }
  };

  const pagosFiltrados = pagos.filter(pago => {
    if (filtroTipo === 'TODOS') return true;
    
    // Profesionales: incluir tipos relacionados a pagos de profesionales
    if (filtroTipo === 'PROFESIONALES') {
      return !pago.tipoPago || 
             pago.tipoPago === 'SEMANAL' ||        // ✅ Valor real del backend
             pago.tipoPago === 'PAGO_SEMANAL' || 
             pago.tipoPago === 'ADELANTO' || 
             pago.tipoPago === 'PAGO_FINAL' || 
             pago.tipoPago === 'AJUSTE' ||
             pago.tipoPago === 'FINAL';            // Por si hay variantes
    }
    
    // Gastos Generales: incluye GASTOS_GENERALES y OTROS_COSTOS (son sinónimos)
    if (filtroTipo === 'GASTOS_GENERALES') {
      return pago.tipoPago === 'GASTOS_GENERALES' || pago.tipoPago === 'OTROS_COSTOS';
    }
    
    // Para el resto (MATERIALES, TRABAJOS_EXTRA), coincidencia exacta
    return pago.tipoPago === filtroTipo;
  });

  // 📋 Agrupar pagos por obra para mejor UX en modo consolidado
  const agruparPorObra = (listaPagos) => {
    const grupos = {};
    listaPagos.forEach(pago => {
      const nombreObra = pago.nombreObra || 'Sin nombre';
      if (!grupos[nombreObra]) {
        grupos[nombreObra] = [];
      }
      grupos[nombreObra].push(pago);
    });
    return grupos;
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{zIndex: 2000}}>
      <div className="modal-dialog modal-xl" style={{marginTop: '40px', maxWidth: '1200px'}}>
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">Listar Pagos - Obra Seleccionada</h5>
            <button type="button" className="btn btn-light btn-sm ms-auto" onClick={onHide}>
              Cerrar
            </button>
          </div>

          <div className="modal-body">
            {error && (
              <div className="alert alert-danger alert-dismissible fade show" role="alert">
                {error}
                <button type="button" className="btn-close" onClick={() => setError(null)}></button>
              </div>
            )}

            {/* Mostrar alerta en modo consolidado */}
            {modoConsolidado && (
              <div className="alert alert-info">
                <i className="bi bi-info-circle me-2"></i>
                <strong>Modo Consolidado:</strong> Mostrando pagos de {haySeleccionParcial ? `${obrasSeleccionadas.size} obra(s) seleccionada(s)` : 'todas las obras'}
              </div>
            )}

            {/* Selector de Dirección - solo si NO está en modo consolidado */}
            {!modoConsolidado && (
              <div className="mb-3">
                <label className="form-label fw-bold">
                  Dirección de Obra <span className="text-danger">*</span>
                </label>
                <DireccionObraSelector
                  value={direccionSeleccionada}
                  onChange={setDireccionSeleccionada}
                  readOnly={!!obraDireccion}
                />
                {!direccionSeleccionada && !obraDireccion && (
                  <div className="form-text text-muted">
                    Seleccione primero la dirección de obra
                  </div>
                )}
              </div>
            )}

            {/* Selector de Tipo de Gasto - solo si NO está en modo consolidado */}
            {!modoConsolidado && direccionSeleccionada && (
              <>
                <div className="mb-3">
                  <label className="form-label fw-bold">Filtrar por Tipo de Gasto:</label>
                  <div className="btn-group w-100" role="group">
                    <button
                      type="button"
                      className={`btn ${tipoGastoFiltro === 'TODOS' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => { setTipoGastoFiltro('TODOS'); setItemSeleccionado(''); }}
                    >
                      📋 Todos ({profesionales.length + materiales.length + otrosCostos.length + trabajosExtra.length})
                    </button>
                    <button
                      type="button"
                      className={`btn ${tipoGastoFiltro === 'PROFESIONALES' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => { setTipoGastoFiltro('PROFESIONALES'); setItemSeleccionado(''); }}
                    >
                      👷 Profesionales ({profesionales.length})
                    </button>
                    <button
                      type="button"
                      className={`btn ${tipoGastoFiltro === 'MATERIALES' ? 'btn-success' : 'btn-outline-success'}`}
                      onClick={() => { setTipoGastoFiltro('MATERIALES'); setItemSeleccionado(''); }}
                    >
                      🧱 Materiales ({materiales.length})
                    </button>
                    <button
                      type="button"
                      className={`btn ${tipoGastoFiltro === 'OTROS_COSTOS' ? 'btn-warning' : 'btn-outline-warning'}`}
                      onClick={() => { setTipoGastoFiltro('OTROS_COSTOS'); setItemSeleccionado(''); }}
                    >
                      📋 Otros Costos ({otrosCostos.length})
                    </button>
                    <button
                      type="button"
                      className={`btn ${tipoGastoFiltro === 'TRABAJOS_EXTRA' ? 'btn-info' : 'btn-outline-info'}`}
                      onClick={() => { setTipoGastoFiltro('TRABAJOS_EXTRA'); setItemSeleccionado(''); }}
                    >
                      🔧 Trabajos Extra ({trabajosExtra.length})
                    </button>
                  </div>
                </div>

                {/* Selector de Item específico (opcional) */}
                {(tipoGastoFiltro === 'PROFESIONALES' || tipoGastoFiltro === 'MATERIALES' || tipoGastoFiltro === 'OTROS_COSTOS' || tipoGastoFiltro === 'TRABAJOS_EXTRA') && (
                  <div className="mb-3">
                    <label className="form-label fw-bold">
                      {tipoGastoFiltro === 'PROFESIONALES' && 'Seleccionar Profesional (opcional):'}
                      {tipoGastoFiltro === 'MATERIALES' && 'Seleccionar Material (opcional):'}
                      {tipoGastoFiltro === 'OTROS_COSTOS' && 'Seleccionar Gasto (opcional):'}
                      {tipoGastoFiltro === 'TRABAJOS_EXTRA' && 'Seleccionar Trabajo Extra (opcional):'}
                    </label>
                    <select
                      className="form-select"
                      value={itemSeleccionado}
                      onChange={(e) => setItemSeleccionado(e.target.value)}
                      disabled={
                        (tipoGastoFiltro === 'PROFESIONALES' && profesionales.length === 0) ||
                        (tipoGastoFiltro === 'MATERIALES' && materiales.length === 0) ||
                        (tipoGastoFiltro === 'OTROS_COSTOS' && otrosCostos.length === 0) ||
                        (tipoGastoFiltro === 'TRABAJOS_EXTRA' && trabajosExtra.length === 0)
                      }
                    >
                      <option value="">Ver todos los {tipoGastoFiltro === 'PROFESIONALES' ? 'profesionales' : tipoGastoFiltro === 'MATERIALES' ? 'materiales' : tipoGastoFiltro === 'OTROS_COSTOS' ? 'gastos' : 'trabajos extra'}</option>
                      
                      {tipoGastoFiltro === 'PROFESIONALES' && ordenarPorRubro(profesionales).map(prof => (
                        <option key={prof.id} value={prof.id}>
                          {prof.profesionalNombre || prof.nombre} - {prof.tipoProfesional || prof.tipo}
                        </option>
                      ))}
                      
                      {tipoGastoFiltro === 'MATERIALES' && materiales.map(mat => (
                        <option key={mat.id} value={mat.id}>
                          {mat.nombre}
                        </option>
                      ))}
                      
                      {tipoGastoFiltro === 'OTROS_COSTOS' && otrosCostos.map(gasto => (
                        <option key={gasto.id} value={gasto.id}>
                          {gasto.nombre}
                        </option>
                      ))}
                      
                      {tipoGastoFiltro === 'TRABAJOS_EXTRA' && trabajosExtra.map(trabajo => (
                        <option key={trabajo.id} value={trabajo.id}>
                          {trabajo.nombre}
                        </option>
                      ))}
                    </select>
                    <div className="form-text text-muted">
                      Deje vacío para ver todos los pagos del tipo seleccionado
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Información del item seleccionado */}
            {itemSeleccionado && direccionSeleccionada && (
              <>
                {/* Estadísticas */}
                <div className="row mb-4">
                  <div className="col-md-3">
                    <div className="card border-success">
                      <div className="card-body text-center">
                        <h6 className="text-muted mb-2">Total Pagado</h6>
                        <h4 className="text-success mb-0">{formatearMoneda(totalPagado)}</h4>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card border-info">
                      <div className="card-body text-center">
                        <h6 className="text-muted mb-2">Adelantos</h6>
                        <h4 className="text-info mb-0">{formatearMoneda(totalAdelantos)}</h4>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card border-warning">
                      <div className="card-body text-center">
                        <h6 className="text-muted mb-2">Presentismo</h6>
                        <h4 className="text-warning mb-0">{formatearPorcentaje(promedioPresentismo)}</h4>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card border-primary">
                      <div className="card-body text-center">
                        <h6 className="text-muted mb-2">Total Pagos</h6>
                        <h4 className="text-primary mb-0">{pagos.length}</h4>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Lista de pagos - se muestra si hay obra seleccionada O en modo consolidado */}
            {(direccionSeleccionada || modoConsolidado) && (
              <>
                {/* Estadísticas - solo en modo consolidado o con item seleccionado */}
                {(modoConsolidado || itemSeleccionado) && (
                  <div className="row mb-4">
                    <div className="col-md-3">
                      <div className="card border-success">
                        <div className="card-body text-center">
                          <h6 className="text-muted mb-2">Total Pagado</h6>
                          <h4 className="text-success mb-0">{formatearMoneda(totalPagado)}</h4>
                        </div>
                      </div>
                    </div>
                    {!modoConsolidado && (
                      <>
                        <div className="col-md-3">
                          <div className="card border-info">
                            <div className="card-body text-center">
                              <h6 className="text-muted mb-2">Adelantos</h6>
                              <h4 className="text-info mb-0">{formatearMoneda(totalAdelantos)}</h4>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-3">
                          <div className="card border-warning">
                            <div className="card-body text-center">
                              <h6 className="text-muted mb-2">Presentismo</h6>
                              <h4 className="text-warning mb-0">{formatearPorcentaje(promedioPresentismo)}</h4>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                    <div className={modoConsolidado ? "col-md-9" : "col-md-3"}>
                      <div className="card border-primary">
                        <div className="card-body text-center">
                          <h6 className="text-muted mb-2">Total Pagos</h6>
                          <h4 className="text-primary mb-0">{pagos.length}</h4>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Filtros */}
                <div className="mb-3">
                  <label className="form-label fw-bold">Filtrar por Categoría:</label>
                  <div className="btn-group" role="group">
                    <button 
                      className={`btn ${filtroTipo === 'TODOS' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => setFiltroTipo('TODOS')}
                    >
                      Todos ({pagos.length})
                    </button>
                    <button 
                      className={`btn ${filtroTipo === 'PROFESIONALES' ? 'btn-info' : 'btn-outline-info'}`}
                      onClick={() => setFiltroTipo('PROFESIONALES')}
                    >
                      👷 Profesionales ({pagos.filter(p => 
                        !p.tipoPago || 
                        p.tipoPago === 'SEMANAL' || 
                        p.tipoPago === 'PAGO_SEMANAL' || 
                        p.tipoPago === 'ADELANTO' || 
                        p.tipoPago === 'PAGO_FINAL' || 
                        p.tipoPago === 'FINAL' ||
                        p.tipoPago === 'AJUSTE'
                      ).length})
                    </button>
                    <button 
                      className={`btn ${filtroTipo === 'MATERIALES' ? 'btn-success' : 'btn-outline-success'}`}
                      onClick={() => setFiltroTipo('MATERIALES')}
                    >
                      🧱 Materiales ({pagos.filter(p => p.tipoPago === 'MATERIALES').length})
                    </button>
                    <button 
                      className={`btn ${filtroTipo === 'GASTOS_GENERALES' ? 'btn-warning' : 'btn-outline-warning'}`}
                      onClick={() => setFiltroTipo('GASTOS_GENERALES')}
                    >
                      💵 Gastos Generales ({pagos.filter(p => p.tipoPago === 'GASTOS_GENERALES' || p.tipoPago === 'OTROS_COSTOS').length})
                    </button>
                    <button 
                      className={`btn ${filtroTipo === 'TRABAJOS_EXTRA' ? 'btn-info' : 'btn-outline-info'}`}
                      onClick={() => setFiltroTipo('TRABAJOS_EXTRA')}
                    >
                      🔧 Trabajos Extra ({pagos.filter(p => p.tipoPago === 'TRABAJOS_EXTRA').length})
                    </button>
                  </div>
                </div>

                {/* Tabla de pagos */}
                {loading ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Cargando...</span>
                    </div>
                  </div>
                ) : (!itemSeleccionado && !modoConsolidado) ? (
                  <div className="alert alert-info">
                    <i className="bi bi-info-circle me-2"></i>
                    Seleccione un profesional, material o gasto para ver su historial de pagos.
                  </div>
                ) : pagosFiltrados.length === 0 ? (
                  <div className="alert alert-warning">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    No hay pagos registrados{filtroTipo !== 'TODOS' ? ` de tipo ${filtroTipo.toLowerCase()}` : ''}.
                  </div>
                ) : (
                  <div className="table-responsive" style={{maxHeight: '400px', overflowY: 'auto'}}>
                    <table className="table table-hover table-bordered table-sm">
                      <thead className="table-light sticky-top">
                        <tr>
                          {modoConsolidado && <th>Obra</th>}
                          {modoConsolidado && <th>Profesional</th>}
                          <th>Fecha</th>
                          <th>Tipo</th>
                          <th>Período</th>
                          <th>Monto Bruto</th>
                          <th>Desc. Adelantos</th>
                          <th>Desc. Presentismo</th>
                          <th>Monto Neto</th>
                          <th>Estado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modoConsolidado ? (
                          // Modo consolidado: Agrupar por obra
                          (() => {
                            const gruposObra = agruparPorObra(pagosFiltrados);
                            return Object.entries(gruposObra).map(([nombreObra, pagosObra]) => (
                              <React.Fragment key={nombreObra}>
                                {/* Encabezado de obra */}
                                <tr className="table-info">
                                  <td colSpan="11" className="fw-bold py-3">
                                    <i className="bi bi-building me-2"></i>
                                    📋 OBRA: {nombreObra}
                                    <span className="badge bg-primary ms-3">{pagosObra.length} pago(s)</span>
                                    <span className="badge bg-success ms-2">
                                      Total: {formatearMoneda(pagosObra.reduce((sum, p) => sum + calcularNetoPagar(p), 0))}
                                    </span>
                                  </td>
                                </tr>
                                {/* Pagos de esta obra */}
                                {pagosObra.map(pago => {
                                  const estadoInfo = obtenerEstadoPago(pago);
                                  const tipoInfo = obtenerTipoPago(pago);
                                  const montoNeto = calcularNetoPagar(pago);
                                  
                                  return (
                                    <tr key={pago.id}>
                                      <td><small className="text-muted">↳</small></td>
                                      <td>
                                        <small>
                                          <strong>{pago.nombreProfesional || 'N/A'}</strong>
                                          <br/>
                                          <span className="text-muted">{pago.tipoProfesional || ''}</span>
                                        </small>
                                      </td>
                                      <td>{formatearFecha(pago.fechaPago)}</td>
                                      <td>
                                        <span className={`badge bg-${tipoInfo.color}`}>
                                          {tipoInfo.icon} {tipoInfo.label}
                                        </span>
                                      </td>
                                      <td className="small">
                                        {pago.fechaPeriodoDesde && pago.fechaPeriodoHasta ? (
                                          <>
                                            {formatearFecha(pago.fechaPeriodoDesde)}
                                            <br/>
                                            {formatearFecha(pago.fechaPeriodoHasta)}
                                          </>
                                        ) : (
                                          <span className="text-muted">-</span>
                                        )}
                                      </td>
                                      <td className="fw-bold">{formatearMoneda(pago.montoBruto)}</td>
                                      <td className="text-danger">
                                        {pago.descuentoAdelantos > 0 ? formatearMoneda(pago.descuentoAdelantos) : '-'}
                                      </td>
                                      <td className="text-warning">
                                        {pago.descuentoPresentismo > 0 ? (
                                          <>
                                            {formatearMoneda(pago.descuentoPresentismo)}
                                            <div className="small text-muted">
                                              ({formatearPorcentaje(pago.porcentajePresentismo)}%)
                                            </div>
                                          </>
                                        ) : '-'}
                                      </td>
                                      <td className="fw-bold text-success">{formatearMoneda(montoNeto)}</td>
                                      <td>
                                        <span className={`badge bg-${estadoInfo.color}`}>
                                          {estadoInfo.icon} {estadoInfo.label}
                                        </span>
                                      </td>
                                      <td>
                                        <div className="btn-group btn-group-sm" role="group">
                                          <button
                                            className="btn btn-danger"
                                            onClick={() => handleEliminar(pago)}
                                            disabled={loading}
                                            title="Eliminar pago"
                                          >
                                            🗑️
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </React.Fragment>
                            ));
                          })()
                        ) : (
                          // Modo individual: Sin agrupación
                          pagosFiltrados.map(pago => {
                            const estadoInfo = obtenerEstadoPago(pago);
                            const tipoInfo = obtenerTipoPago(pago);
                            const montoNeto = calcularNetoPagar(pago);
                            
                            return (
                              <tr key={pago.id}>
                                <td>{formatearFecha(pago.fechaPago)}</td>
                                <td>
                                  <span className={`badge bg-${tipoInfo.color}`}>
                                    {tipoInfo.icon} {tipoInfo.label}
                                  </span>
                                </td>
                                <td className="small">
                                  {pago.fechaPeriodoDesde && pago.fechaPeriodoHasta ? (
                                    <>
                                      {formatearFecha(pago.fechaPeriodoDesde)}
                                      <br/>
                                      {formatearFecha(pago.fechaPeriodoHasta)}
                                    </>
                                  ) : (
                                    <span className="text-muted">-</span>
                                  )}
                                </td>
                                <td className="fw-bold">{formatearMoneda(pago.montoBruto)}</td>
                                <td className="text-danger">
                                  {pago.descuentoAdelantos > 0 ? formatearMoneda(pago.descuentoAdelantos) : '-'}
                                </td>
                                <td className="text-warning">
                                  {pago.descuentoPresentismo > 0 ? (
                                    <>
                                      {formatearMoneda(pago.descuentoPresentismo)}
                                      <div className="small text-muted">
                                        ({formatearPorcentaje(pago.porcentajePresentismo)}%)
                                      </div>
                                    </>
                                  ) : '-'}
                                </td>
                                <td className="fw-bold text-success">{formatearMoneda(montoNeto)}</td>
                                <td>
                                  <span className={`badge bg-${estadoInfo.color}`}>
                                    {estadoInfo.icon} {estadoInfo.label}
                                  </span>
                                </td>
                                <td>
                                  <div className="btn-group btn-group-sm" role="group">
                                    <button
                                      className="btn btn-danger"
                                      onClick={() => handleEliminar(pago)}
                                      disabled={loading}
                                      title="Eliminar pago"
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onHide}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListarPagosProfesionalModal;
