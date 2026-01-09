import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import { listarCobrosPorObra, obtenerTotalCobrado } from '../services/cobrosObraService';
import { listarPagosPorProfesional } from '../services/pagosProfesionalObraService';
import eventBus, { FINANCIAL_EVENTS } from '../utils/eventBus';

// 🔒 CACHÉ GLOBAL: Evita cargas redundantes entre componentes
const cacheGlobal = {
  data: null,
  timestamp: 0,
  presupuestoId: null,
  TTL: 2000 // 2 segundos de validez
};

// ⏱️ DEBOUNCE TIMER: Agrupa eventos rápidos
let debounceTimer = null;

// 🗑️ Función para invalidar caché manualmente (útil al cambiar de obra)
export const invalidarCacheEstadisticas = () => {
  cacheGlobal.timestamp = 0;
  cacheGlobal.presupuestoId = null;
  cacheGlobal.data = null;
};

/**
 * Hook personalizado para calcular estadísticas financieras de una obra
 * Calcula: total presupuesto, cobros, pagos, saldo disponible
 * Retorna alertas si está cerca del límite
 * ✨ Con sincronización automática vía EventBus
 * 🚀 Con caché global y debounce para evitar cargas duplicadas
 */
export const useEstadisticasFinancieras = (obraDireccion, empresaId, refreshTrigger) => {
  const [estadisticas, setEstadisticas] = useState({
    totalPresupuesto: 0,
    totalCobrado: 0,
    totalPagado: 0,
    saldoDisponible: 0,
    porcentajeCobrado: 0,
    porcentajePagado: 0,
    porcentajeDisponible: 0,
    alertas: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // 🔒 Flag para evitar cargas duplicadas
  const cargandoRef = useRef(false);
  
  // 🔄 Función de carga envuelta en useCallback para mantener referencia estable
  const cargarEstadisticas = useCallback(async () => {
    // 🔒 Evitar cargas duplicadas simultáneas
    if (cargandoRef.current) {
      return;
    }
    
    if (!obraDireccion || !empresaId) {
      return;
    }
    
    const presupuestoId = obraDireccion.presupuestoNoClienteId;
    
    // 💾 VERIFICAR CACHÉ GLOBAL
    const now = Date.now();
    if (cacheGlobal.data && 
        cacheGlobal.presupuestoId === presupuestoId &&
        (now - cacheGlobal.timestamp) < cacheGlobal.TTL) {
      setEstadisticas(cacheGlobal.data);
      setLoading(false);
      return;
    }
    
    cargandoRef.current = true;
    setLoading(true);
    setError(null);
    
    try {
      // 1. Obtener presupuesto completo
      const presupuesto = await api.presupuestosNoCliente.getById(
        obraDireccion.presupuestoNoClienteId,
        empresaId
      );

      // 2. Calcular total del presupuesto
      const totalPresupuesto = calcularTotalPresupuesto(presupuesto);

      // 3. Obtener cobros
      let totalCobrado = 0;
      let cantidadCobros = 0;
      try {
        // Estrategia alternativa: obtener TODOS los cobros y filtrar localmente
        // Evita el error 500 del endpoint /cobros-obra/direccion
        const response = await api.get('/api/v1/cobros-obra', { 
          params: { empresaId } 
        });
        
        const todosLosCobros = Array.isArray(response) ? response : 
                              response?.data ? response.data :
                              response?.cobros ? response.cobros : [];
        
        // Filtrar cobros de esta obra específica
        const cobrosObra = todosLosCobros.filter(c => 
          c.presupuestoNoClienteId === obraDireccion.presupuestoNoClienteId
        );
        
        if (cobrosObra.length > 0) {
          cobrosObra.forEach((c, index) => {
            });
          
          const cobrosValidos = cobrosObra.filter(c => c.estado?.toUpperCase() === 'COBRADO');
          totalCobrado = cobrosValidos.reduce((sum, c) => sum + (parseFloat(c.monto) || 0), 0);
          cantidadCobros = cobrosValidos.length;
        }
        
        } catch (err) {
        console.warn('⚠️ Error obteniendo cobros:', err);
        console.warn('⚠️ Detalles del error:', err.response?.data || err.message);
      }

      // 4. Obtener pagos (profesionales + pagos consolidados)
      let totalPagadoProfesionales = 0;
      let totalPagadoConsolidados = 0;
      try {
        // 4.1 PAGOS A PROFESIONALES
        const itemsCalculadora = presupuesto.itemsCalculadora || [];
        const profesionalesIds = [];
        
        itemsCalculadora.forEach(item => {
          if (item.profesionales && Array.isArray(item.profesionales)) {
            item.profesionales.forEach(prof => {
              const profesionalObraId = prof.profesionalObraId || prof.id;
              if (profesionalObraId) {
                profesionalesIds.push(profesionalObraId);
              }
            });
          }
        });

        // Obtener pagos de cada profesional
        const pagosPorProfesional = await Promise.all(
          profesionalesIds.map(id => 
            listarPagosPorProfesional(id, empresaId).catch(() => [])
          )
        );

        totalPagadoProfesionales = pagosPorProfesional
          .flat()
          .filter(p => p.estado === 'PAGADO' || p.estado === 'pagado')
          .reduce((sum, p) => sum + (parseFloat(p.montoNeto || p.montoBruto || p.montoPagado) || 0), 0);
        
        // 4.2 PAGOS CONSOLIDADOS (materiales + otros costos)
        const { listarPagosConsolidadosPorPresupuesto } = await import('../services/pagosConsolidadosService');
        const pagosConsolidados = await listarPagosConsolidadosPorPresupuesto(
          obraDireccion.presupuestoNoClienteId,
          empresaId
        ).catch(() => []);
        
        totalPagadoConsolidados = pagosConsolidados
          .filter(p => p.estado === 'PAGADO' || p.estado === 'pagado')
          .reduce((sum, p) => sum + (parseFloat(p.monto) || 0), 0);
          
      } catch (err) {
        console.warn('⚠️ Error obteniendo pagos:', err);
      }
      
      const totalPagado = totalPagadoProfesionales + totalPagadoConsolidados;

      // 5. Calcular métricas
      const saldoDisponible = totalCobrado - totalPagado;
      const porcentajeCobrado = totalPresupuesto > 0 ? (totalCobrado / totalPresupuesto) * 100 : 0;
      const porcentajePagado = totalPresupuesto > 0 ? (totalPagado / totalPresupuesto) * 100 : 0;
      const porcentajeDisponible = totalPresupuesto > 0 ? (saldoDisponible / totalPresupuesto) * 100 : 0;

      // 6. Generar alertas
      const alertas = generarAlertas({
        totalPresupuesto,
        totalCobrado,
        totalPagado,
        saldoDisponible,
        porcentajeCobrado,
        porcentajePagado,
        porcentajeDisponible
      });

      const estadisticasCalculadas = {
        totalPresupuesto,
        totalCobrado,
        totalPagado,
        saldoDisponible,
        porcentajeCobrado,
        porcentajePagado,
        porcentajeDisponible,
        cantidadCobros,
        alertas
      };
      
      setEstadisticas(estadisticasCalculadas);
      
      // 💾 GUARDAR EN CACHÉ GLOBAL
      cacheGlobal.data = estadisticasCalculadas;
      cacheGlobal.presupuestoId = presupuestoId;
      cacheGlobal.timestamp = Date.now();

      } catch (err) {
      console.error('❌ Error cargando estadísticas:', err);
      setError(err.message || 'Error al cargar estadísticas');
    } finally {
      setLoading(false);
      cargandoRef.current = false; // 🔓 Liberar flag
      }
  }, [obraDireccion, empresaId]); // ✅ Dependencias correctas

  useEffect(() => {
    // Invalidar caché si cambió el presupuesto
    if (obraDireccion?.presupuestoNoClienteId !== cacheGlobal.presupuestoId) {
      cacheGlobal.timestamp = 0;
    }
    cargarEstadisticas();
  }, [cargarEstadisticas, refreshTrigger]);

  // 🚌 SINCRONIZACIÓN AUTOMÁTICA: Escuchar eventos financieros
  useEffect(() => {
    if (!obraDireccion || !empresaId) return;
    
    const handleFinancialEvent = (eventData) => {
      console.log('🔔 [useEstadisticasFinancieras] Evento financiero recibido:', eventData);
      
      // ⏱️ DEBOUNCE: Agrupar eventos rápidos
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      
      // ⚡ INVALIDAR CACHÉ INMEDIATAMENTE para forzar recarga
      console.log('🗑️ [useEstadisticasFinancieras] Invalidando caché...');
      cacheGlobal.timestamp = 0;
      cacheGlobal.presupuestoId = null;
      cacheGlobal.data = null;
      
      debounceTimer = setTimeout(() => {
        // Invalidar caché para forzar recarga
        cacheGlobal.timestamp = 0;
        if (!cargandoRef.current) {
          console.log('🔄 [useEstadisticasFinancieras] Recargando estadísticas...');
          cargarEstadisticas();
        }
      }, 300); // 300ms de espera para agrupar eventos
    };
    
    const unsubscribers = [
      eventBus.on(FINANCIAL_EVENTS.PAGO_REGISTRADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.PAGO_ACTUALIZADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.PAGO_ELIMINADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.PAGO_CONSOLIDADO_REGISTRADO, handleFinancialEvent), // ✅ AGREGADO
      eventBus.on(FINANCIAL_EVENTS.COBRO_REGISTRADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.COBRO_ACTUALIZADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.COBRO_ELIMINADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.CAJA_CHICA_ASIGNADA, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.GASTO_CAJA_CHICA_REGISTRADO, handleFinancialEvent),
    ];
    
    return () => {
      unsubscribers.forEach(unsub => unsub());
      // Limpiar debounce timer pendiente
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    };
  }, [cargarEstadisticas]); // ✅ Incluir cargarEstadisticas en dependencias

  return { estadisticas, loading, error, recargar: cargarEstadisticas };
};

/**
 * Calcula el total del presupuesto sumando todos los items
 */
const calcularTotalPresupuesto = (presupuesto) => {
  let total = 0;

  // PRIMERO: Si tiene totalPresupuestoConHonorarios (incluye honorarios aplicados)
  if (presupuesto.totalPresupuestoConHonorarios && presupuesto.totalPresupuestoConHonorarios > 0) {
    return parseFloat(presupuesto.totalPresupuestoConHonorarios);
  }

  // SEGUNDO: Si tiene totalPresupuesto (base sin honorarios) + totalHonorariosCalculado
  if (presupuesto.totalPresupuesto && presupuesto.totalPresupuesto > 0) {
    const totalConHonorarios = parseFloat(presupuesto.totalPresupuesto) + parseFloat(presupuesto.totalHonorariosCalculado || 0);
    return totalConHonorarios;
  }

  // TERCERO: Si tiene total directo
  if (presupuesto.total && presupuesto.total > 0) {
    return parseFloat(presupuesto.total);
  }

  // CUARTO: Si tiene totalCalculado
  if (presupuesto.totalCalculado && presupuesto.totalCalculado > 0) {
    return parseFloat(presupuesto.totalCalculado);
  }

  // Calcular desde itemsCalculadora
  const itemsCalculadora = presupuesto.itemsCalculadora || [];
  
  itemsCalculadora.forEach(item => {
    // Profesionales
    if (item.profesionales && Array.isArray(item.profesionales)) {
      item.profesionales.forEach(prof => {
        // Usar el campo 'subtotal' que ya viene calculado del backend
        total += parseFloat(prof.subtotal || prof.importeCalculado || 0);
      });
    }

    // Materiales
    if (item.materialesLista && Array.isArray(item.materialesLista)) {
      item.materialesLista.forEach(mat => {
        // Usar el campo 'subtotal' que ya viene calculado del backend
        total += parseFloat(mat.subtotal || 0);
      });
    }

    // Otros costos
    if (item.otrosCostos && Array.isArray(item.otrosCostos)) {
      item.otrosCostos.forEach(costo => {
        total += parseFloat(costo.importe || 0);
      });
    }
  });

  // Si aún es 0, intentar desde arrays directos
  if (total === 0) {
    // Profesionales directos
    if (presupuesto.profesionales && Array.isArray(presupuesto.profesionales)) {
      presupuesto.profesionales.forEach(prof => {
        total += parseFloat(prof.subtotal || prof.importeCalculado || 0);
      });
    }

    // Materiales directos
    if (presupuesto.materiales && Array.isArray(presupuesto.materiales)) {
      presupuesto.materiales.forEach(mat => {
        total += parseFloat(mat.subtotal || 0);
      });
    }

    // Otros costos directos
    if (presupuesto.otrosCostos && Array.isArray(presupuesto.otrosCostos)) {
      presupuesto.otrosCostos.forEach(costo => {
        total += parseFloat(costo.importe || 0);
      });
    }
  }

  return total;
};

/**
 * Genera alertas basadas en las métricas financieras
 */
const generarAlertas = (metricas) => {
  const alertas = [];
  const {
    totalPresupuesto,
    totalCobrado,
    totalPagado,
    saldoDisponible,
    porcentajeCobrado,
    porcentajePagado,
    porcentajeDisponible
  } = metricas;

  // ALERTA 1: Saldo negativo (gastado más de lo cobrado)
  if (saldoDisponible < 0) {
    alertas.push({
      tipo: 'danger',
      icono: '🚨',
      titulo: 'SALDO NEGATIVO',
      mensaje: `Has gastado $${Math.abs(saldoDisponible).toLocaleString('es-AR', { minimumFractionDigits: 2 })} más de lo cobrado`,
      accion: 'Urgente: Necesitas cobrar más dinero al cliente'
    });
  }

  // ALERTA 2: Saldo muy bajo (menos del 10% disponible)
  if (saldoDisponible > 0 && porcentajeDisponible < 10 && totalCobrado > 0) {
    alertas.push({
      tipo: 'warning',
      icono: '⚠️',
      titulo: 'SALDO BAJO',
      mensaje: `Solo queda ${porcentajeDisponible.toFixed(1)}% del dinero cobrado disponible`,
      accion: 'Considera solicitar un nuevo cobro pronto'
    });
  }

  // ALERTA 3: Pagado más del 80% pero cobrado menos del 60%
  if (porcentajePagado > 80 && porcentajeCobrado < 60) {
    alertas.push({
      tipo: 'warning',
      icono: '💰',
      titulo: 'DESBALANCE COBROS/PAGOS',
      mensaje: `Has pagado ${porcentajePagado.toFixed(1)}% pero solo cobraste ${porcentajeCobrado.toFixed(1)}%`,
      accion: 'Necesitas cobrar más para equilibrar el flujo de caja'
    });
  }

  // ALERTA 4: Cobrado más del 100% del presupuesto
  if (porcentajeCobrado > 100) {
    alertas.push({
      tipo: 'info',
      icono: '📈',
      titulo: 'COBRASTE MÁS DEL PRESUPUESTO',
      mensaje: `Has cobrado ${porcentajeCobrado.toFixed(1)}% del presupuesto original`,
      accion: 'Puede haber mayores costos o modificaciones aprobadas'
    });
  }

  // ALERTA 5: Pagado más del 100% del presupuesto
  if (porcentajePagado > 100) {
    alertas.push({
      tipo: 'danger',
      icono: '🔴',
      titulo: 'PAGASTE MÁS DEL PRESUPUESTO',
      mensaje: `Has pagado ${porcentajePagado.toFixed(1)}% del presupuesto original`,
      accion: 'Urgente: Revisa los costos adicionales y cobra la diferencia'
    });
  }

  // ALERTA 6: Todo cobrado pero falta pagar (obra en curso)
  if (porcentajeCobrado >= 95 && porcentajePagado < 50) {
    alertas.push({
      tipo: 'success',
      icono: '✅',
      titulo: 'COBROS COMPLETOS',
      mensaje: 'Has cobrado prácticamente todo el presupuesto',
      accion: 'Puedes continuar con los pagos sin preocupaciones'
    });
  }

  // ALERTA 7: Poco cobrado (menos del 30%)
  if (totalPresupuesto > 0 && porcentajeCobrado < 30 && totalCobrado > 0) {
    alertas.push({
      tipo: 'info',
      icono: '📊',
      titulo: 'INICIO DE OBRA',
      mensaje: `Solo has cobrado ${porcentajeCobrado.toFixed(1)}% del presupuesto`,
      accion: 'Normal en inicio de obra. Planifica próximos cobros'
    });
  }

  // ALERTA 8: Saldo disponible próximo a agotarse (entre 10% y 20%)
  if (saldoDisponible > 0 && porcentajeDisponible >= 10 && porcentajeDisponible < 20 && totalCobrado > 0) {
    alertas.push({
      tipo: 'warning',
      icono: '⏰',
      titulo: 'PLANIFICAR PRÓXIMO COBRO',
      mensaje: `Queda ${porcentajeDisponible.toFixed(1)}% de saldo disponible`,
      accion: 'Prepara el próximo certificado o cobro'
    });
  }

  return alertas;
};

export default useEstadisticasFinancieras;
