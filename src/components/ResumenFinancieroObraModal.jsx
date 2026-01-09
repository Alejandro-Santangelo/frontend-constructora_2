import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import api from '../services/api';
import cobrosObraService, { formatearMoneda, formatearFecha } from '../services/cobrosObraService';
import pagosProfesionalObraService, { formatearPorcentaje } from '../services/pagosProfesionalObraService';
import { registrarPagosConsolidadosBatch, listarPagosConsolidadosPorPresupuesto } from '../services/pagosConsolidadosService';
import { useEmpresa } from '../EmpresaContext';
import { useFinancialData } from '../context/FinancialDataContext';
import { useEstadisticasFinancieras } from '../hooks/useEstadisticasFinancieras';
import { useEstadisticasConsolidadas } from '../hooks/useEstadisticasConsolidadas';
import DireccionObraSelector from './DireccionObraSelector';
import DetalleConsolidadoPorObraModal from './DetalleConsolidadoPorObraModal';
import eventBus, { FINANCIAL_EVENTS } from '../utils/eventBus';

const ResumenFinancieroObraModal = ({ show, onHide, obraId, obraDireccion, modoConsolidado, refreshTrigger }) => {
  const { empresaSeleccionada } = useEmpresa();
  
  // 🏦 Contexto financiero para obtener datos de profesionales con pagos
  const { datosFinancieros, getProfesionales } = useFinancialData();
  
  // Estados - declarar ANTES de los hooks que los usan
  const [resumen, setResumen] = useState(null);
  const [datosPresupuesto, setDatosPresupuesto] = useState(null);
  const [direccionSeleccionada, setDireccionSeleccionada] = useState(obraDireccion || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  
  // Estados para materiales y otros costos
  const [materiales, setMateriales] = useState([]);
  const [otrosCostos, setOtrosCostos] = useState([]);
  const [materialesSuspendidos, setMaterialesSuspendidos] = useState(new Set());
  const [otrosCostosSuspendidos, setOtrosCostosSuspendidos] = useState(new Set());
  
  // Estados para el modal de desglose
  const [showDesglose, setShowDesglose] = useState(false);
  const [desgloseTipo, setDesgloseTipo] = useState(null);
  const [desgloseTitulo, setDesgloseTitulo] = useState('');
  const [desgloseDatos, setDesgloseDatos] = useState([]);
  
  // Hook de estadísticas individuales (usa direccionSeleccionada para actualizar cuando cambia)
  const { 
    estadisticas: estadisticasIndividuales,
    loading: loadingIndividuales
  } = useEstadisticasFinancieras(
    direccionSeleccionada || obraDireccion,
    empresaSeleccionada?.id,
    refreshTrigger
  );
  
  // Hook de estadísticas consolidadas
  const { 
    estadisticas: estadisticasConsolidadas,
    loading: loadingConsolidadas
  } = useEstadisticasConsolidadas(
    empresaSeleccionada?.id,
    refreshTrigger,
    modoConsolidado && show
  );
  
  // Determinar qué estadísticas usar según el modo
  const estadisticasActuales = modoConsolidado ? estadisticasConsolidadas : estadisticasIndividuales;
  const loadingActual = modoConsolidado ? loadingConsolidadas : loadingIndividuales;
  
  // Convertir estadísticas al formato de resumen para compatibilidad
  const resumenDesdeEstadisticas = estadisticasActuales ? {
    totalPresupuesto: estadisticasActuales.totalPresupuesto,
    presupuestoTotal: estadisticasActuales.totalPresupuesto,
    totalCobrado: estadisticasActuales.totalCobrado,
    totalPagado: estadisticasActuales.totalPagado,
    porcentajeCobrado: estadisticasActuales.porcentajeCobrado,
    porcentajePagado: estadisticasActuales.porcentajePagado,
    saldoPorCobrar: estadisticasActuales.totalPresupuesto - estadisticasActuales.totalCobrado,
    balanceNeto: estadisticasActuales.saldoDisponible,
    cantidadObras: estadisticasActuales.cantidadObras || 1,
    totalCobros: estadisticasActuales.cantidadCobros || 0,
    totalPagos: estadisticasActuales.cantidadPagos || 0,
    cobrosPendientes: estadisticasActuales.cobrosPendientes || 0,
    pagosPendientes: estadisticasActuales.pagosPendientes || 0,
    // Enriquecer con datos del presupuesto si están disponibles
    ...(datosPresupuesto && {
      numeroPresupuesto: datosPresupuesto.numeroPresupuesto,
      numeroVersion: datosPresupuesto.numeroVersion || datosPresupuesto.version,
      estado: datosPresupuesto.estado,
      direccion: `${datosPresupuesto.direccionObraCalle || ''} ${datosPresupuesto.direccionObraAltura || ''}`,
      totalHonorarios: datosPresupuesto.totalHonorarios || 0,
      totalBase: datosPresupuesto.totalPresupuesto || 0,
      totalMayoresCostos: datosPresupuesto.totalMayoresCostos || 0,
      totalMateriales: datosPresupuesto.totalMateriales || 0,
      // Extraer profesionales de la calculadora
      profesionalesActivos: (() => {
        // 🔄 Intentar usar datos del contexto financiero (tienen totalPagado calculado)
        const profesionalesDelContexto = getProfesionales ? getProfesionales() : [];
        if (profesionalesDelContexto && profesionalesDelContexto.length > 0) {
          // Mapear al formato correcto con precioTotal calculado
          return profesionalesDelContexto.map(prof => ({
            ...prof,
            // Calcular precioTotal si no existe (cantidadJornales * precioJornal)
            precioTotal: prof.precioTotal || ((prof.cantidadJornales || 0) * (prof.precioJornal || prof.importeJornal || 0)),
            // Asegurar que tenga tipoProfesional
            tipoProfesional: prof.tipoProfesional || prof.tipo || 'No especificado'
          }));
        }
        
        // Fallback: extraer de itemsCalculadora sin datos de pagos
        const itemsCalculadora = datosPresupuesto.itemsCalculadora || [];
        const profesionales = [];
        itemsCalculadora.forEach(item => {
          if (item.profesionales && Array.isArray(item.profesionales)) {
            item.profesionales.forEach(prof => {
              const cantidadJornales = prof.cantidadJornales || 0;
              const importeJornal = prof.importeJornal || prof.precioJornal || 0;
              profesionales.push({
                id: prof.id || prof.profesionalObraId,
                nombre: prof.nombre || prof.nombreCompleto || 'Sin nombre',
                tipoProfesional: prof.tipoProfesional || item.tipoProfesional || 'No especificado',
                cantidadJornales: cantidadJornales,
                importeJornal: importeJornal,
                precioJornal: importeJornal,
                precioTotal: cantidadJornales * importeJornal,
                totalPagado: 0 // Sin datos de pagos en este caso
              });
            });
          }
        });
        return profesionales;
      })(),
      cantidadProfesionales: (() => {
        const itemsCalculadora = datosPresupuesto.itemsCalculadora || [];
        let count = 0;
        itemsCalculadora.forEach(item => {
          if (item.profesionales && Array.isArray(item.profesionales)) {
            count += item.profesionales.length;
          }
        });
        return count;
      })()
    })
  } : null;

  useEffect(() => {
    if (obraDireccion) {
      setDireccionSeleccionada(obraDireccion);
    }
  }, [obraDireccion]);

  // 🔥 INVALIDAR CACHÉ cuando se abre el modal
  useEffect(() => {
    if (show) {
      console.log('🔥 [ResumenFinanciero] Modal abierto - Invalidando caché de estadísticas...');
      // Importar dinámicamente la función de invalidación
      import('../hooks/useEstadisticasFinancieras').then(module => {
        if (module.invalidarCacheEstadisticas) {
          module.invalidarCacheEstadisticas();
          console.log('✅ [ResumenFinanciero] Caché invalidado');
        }
      }).catch(err => {
        console.warn('⚠️ No se pudo invalidar caché:', err);
      });
    }
  }, [show]);

  // Cargar datos adicionales del presupuesto en modo individual
  useEffect(() => {
    if (modoConsolidado || !direccionSeleccionada?.presupuestoNoClienteId || !empresaSeleccionada?.id) {
      return;
    }
    
    const cargarDatosPresupuesto = async () => {
      try {
        const presupuesto = await api.presupuestosNoCliente.getById(
          direccionSeleccionada.presupuestoNoClienteId,
          empresaSeleccionada.id
        );
        setDatosPresupuesto(presupuesto);
        await cargarMaterialesYOtrosCostos(presupuesto);
      } catch (err) {
        console.warn('⚠️ Error cargando datos del presupuesto:', err);
      }
    };
    
    cargarDatosPresupuesto();
  }, [direccionSeleccionada?.presupuestoNoClienteId, empresaSeleccionada?.id]); // Dependencias específicas

  // Auto-actualización cuando el modal se abre o cambian los datos del presupuesto
  useEffect(() => {
    if (!show || !empresaSeleccionada) return;
    
    console.log('🔄 ResumenFinanciero: Actualizando datos automáticamente...');
    
    const cargarDatos = async () => {
      if (modoConsolidado) {
        await cargarResumenConsolidado();
      } else if (direccionSeleccionada?.presupuestoNoClienteId) {
        // En modo individual, recargar materiales y otros costos cuando se abre el modal
        try {
          const presupuesto = await api.presupuestosNoCliente.getById(
            direccionSeleccionada.presupuestoNoClienteId,
            empresaSeleccionada.id
          );
          await cargarMaterialesYOtrosCostos(presupuesto);
        } catch (err) {
          console.warn('⚠️ Error recargando materiales y otros costos:', err);
        }
      }
    };
    
    cargarDatos();
    // Modo individual ya se maneja automáticamente por el hook useEstadisticasFinancieras
  }, [show, modoConsolidado, refreshTrigger]); // Removidas dependencias que causan loops

  // 🔔 Suscripción a eventos financieros para actualización en tiempo real
  useEffect(() => {
    if (!show) return;
    
    console.log('🔔 [ResumenFinanciero] Suscrito a eventos financieros');
    
    // Contador interno para forzar re-render
    let updateCounter = 0;
    
    const handlePagoRegistrado = (data) => {
      console.log('💸 [ResumenFinanciero] Evento de pago recibido:', data);
      updateCounter++;
      
      // Forzar recarga de datos según el modo
      setTimeout(() => {
        if (modoConsolidado) {
          console.log('🔄 [ResumenFinanciero] Recargando datos consolidados...');
          cargarResumenConsolidado();
        } else if (direccionSeleccionada?.presupuestoNoClienteId) {
          console.log('🔄 [ResumenFinanciero] Recargando datos individuales...');
          // Los hooks ya se encargarán de recargar automáticamente
          // pero forzamos una recarga de materiales/otros costos
          api.presupuestosNoCliente.getById(
            direccionSeleccionada.presupuestoNoClienteId,
            empresaSeleccionada.id
          ).then(presupuesto => {
            cargarMaterialesYOtrosCostos(presupuesto);
          }).catch(err => {
            console.warn('⚠️ Error recargando después de evento:', err);
          });
        }
      }, 300); // Pequeño delay para que el backend termine de procesar
    };
    
    const unsubscribers = [
      eventBus.on(FINANCIAL_EVENTS.PAGO_CONSOLIDADO_REGISTRADO, handlePagoRegistrado),
      eventBus.on(FINANCIAL_EVENTS.PAGO_REGISTRADO, handlePagoRegistrado),
      eventBus.on(FINANCIAL_EVENTS.COBRO_REGISTRADO, handlePagoRegistrado),
    ];
    
    return () => {
      console.log('🔕 [ResumenFinanciero] Desuscrito de eventos financieros');
      unsubscribers.forEach(unsub => unsub());
    };
  }, [show, modoConsolidado, direccionSeleccionada, empresaSeleccionada]);

  const cargarResumenConsolidado = useCallback(async () => {
    if (!empresaSeleccionada?.id) return;
    
    setLoading(true);
    setError(null);
    try {
      console.log('🌐 Cargando resumen financiero consolidado...');
      
      // Cargar presupuestos APROBADOS y EN_EJECUCION
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
      
      // Consolidar datos de todas las obras
      let totalPresupuestado = 0;
      let totalCobrado = 0;
      let totalPagado = 0;
      
      for (const pres of todosPresupuestos) {
        // Total presupuestado
        totalPresupuestado += pres.total || 0;
        
        // Cargar cobros - solo si tiene direccionObra
        if (pres.direccionObra) {
          try {
            const cobros = await cobrosObraService.listarCobrosPorObra(pres.direccionObra, empresaSeleccionada.id);
            const cobrosArray = Array.isArray(cobros) ? cobros : [];
            totalCobrado += cobrosArray.filter(c => c.estado === 'COBRADO').reduce((sum, c) => sum + (c.montoCobrado || 0), 0);
          } catch (err) {
            console.warn(`Error cargando cobros de ${pres.nombreObra}:`, err);
          }
        }
      }
      
      // Cargar todos los pagos usando el servicio consolidado ya creado
      const presupuestosCompletos = await Promise.all(
        todosPresupuestos.map(p => api.presupuestosNoCliente.getById(p.id, empresaSeleccionada.id))
      );
      
      const todosProfesionales = [];
      presupuestosCompletos.forEach(presupuesto => {
        const itemsCalculadora = presupuesto.itemsCalculadora || [];
        itemsCalculadora.forEach(item => {
          if (item.profesionales && Array.isArray(item.profesionales)) {
            item.profesionales.forEach(prof => {
              todosProfesionales.push({
                profesionalObraId: prof.profesionalObraId || prof.id
              });
            });
          }
        });
      });
      
      for (const prof of todosProfesionales) {
        try {
          const pagos = await pagosProfesionalObraService.listarPagosPorProfesional(prof.profesionalObraId, empresaSeleccionada.id);
          const pagosArray = Array.isArray(pagos) ? pagos : [];
          totalPagado += pagosArray.filter(p => p.estado === 'PAGADO').reduce((sum, p) => sum + (p.montoNeto || p.montoBruto || 0), 0);
        } catch (err) {
          // Ignorar errores de profesionales sin pagos
        }
      }
      
      const resumenConsolidado = {
        totalPresupuesto: totalPresupuestado,
        presupuestoTotal: totalPresupuestado,
        totalCobrado: totalCobrado,
        totalPagado: totalPagado,
        cobrado: { total: totalCobrado, cantidad: 0 },
        pendienteCobro: { total: totalPresupuestado - totalCobrado },
        pagado: { total: totalPagado, cantidad: 0 },
        pendientePago: { total: 0 },
        saldoPorCobrar: totalPresupuestado - totalCobrado,
        balanceNeto: totalCobrado - totalPagado,
        utilidad: totalCobrado - totalPagado,
        margenUtilidad: totalCobrado > 0 ? ((totalCobrado - totalPagado) / totalCobrado) * 100 : 0,
        porcentajeCobrado: totalPresupuestado > 0 ? (totalCobrado / totalPresupuestado) * 100 : 0,
        porcentajePagado: totalPresupuestado > 0 ? (totalPagado / totalPresupuestado) * 100 : 0,
        ultimaActualizacion: new Date().toISOString()
      };
      
      setResumen(resumenConsolidado);
      setLastUpdate(new Date());
      console.log('✅ Resumen consolidado cargado:', resumenConsolidado);
    } catch (err) {
      console.error('❌ Error cargando resumen consolidado:', err);
      setError('Error al cargar el resumen financiero consolidado');
    } finally {
      setLoading(false);
    }
  }, [empresaSeleccionada?.id]); // useCallback con dependencias mínimas

  const cargarMaterialesYOtrosCostos = useCallback(async (presupuesto) => {
    if (!presupuesto || !empresaSeleccionada?.id) return;
    
    try {
      const pagosConsolidados = await listarPagosConsolidadosPorPresupuesto(
        presupuesto.id,
        empresaSeleccionada.id
      ).catch(() => []);
      
      const itemsCalculadora = presupuesto.itemsCalculadora || [];
      const nombreObra = presupuesto.nombreObra || presupuesto.direccionObra?.direccion || `Presupuesto #${presupuesto.numeroPresupuesto}`;
      
      const materialesArray = [];
      const otrosCostosArray = [];
      
      // 🔥 CARGAR ASIGNACIONES SEMANALES DE MATERIALES desde BD
      let asignacionesMaterialesBD = [];
      
      if (obraId) {
        try {
          console.log(`📦 [ResumenFinanciero] Cargando asignaciones de materiales para obra ${obraId}`);
          const { obtenerMaterialesAsignados } = await import('../services/obraMaterialService');
          asignacionesMaterialesBD = await obtenerMaterialesAsignados(obraId, empresaSeleccionada.id);
          console.log(`✅ [ResumenFinanciero] ${asignacionesMaterialesBD.length} asignaciones de materiales cargadas:`, asignacionesMaterialesBD);
        } catch (err) {
          console.warn('⚠️ [ResumenFinanciero] Error cargando asignaciones de materiales:', err);
        }
      } else {
        console.warn('⚠️ [ResumenFinanciero] No se pudo obtener obraId para cargar materiales');
      }
      
      // Crear mapa de asignaciones por materialId para acceso rápido
      const asignacionesPorMaterial = new Map();
      asignacionesMaterialesBD.forEach(asig => {
        // Probar diferentes nombres de campos del backend
        const matId = asig.materialCalculadoraId || 
                      asig.material_calculadora_id || 
                      asig.presupuestoMaterialId ||
                      asig.presupuesto_material_id ||
                      asig.materialId;
        
        console.log('🔍 [ResumenFinanciero] Procesando asignación:', {
          asignacionCompleta: asig,
          matIdExtraido: matId
        });
        
        if (matId) {
          if (!asignacionesPorMaterial.has(matId)) {
            asignacionesPorMaterial.set(matId, []);
          }
          asignacionesPorMaterial.get(matId).push({
            cantidad: asig.cantidadAsignada || asig.cantidad_asignada || asig.cantidad || 0,
            fecha: asig.fechaAsignacion || asig.fecha_asignacion || asig.createdAt,
            observaciones: asig.observaciones || '',
            id: asig.id
          });
        } else {
          console.warn('⚠️ [ResumenFinanciero] Asignación sin materialId:', asig);
        }
      });
      
      console.log('📋 [ResumenFinanciero] Mapa de asignaciones creado:', {
        totalMateriales: asignacionesPorMaterial.size,
        materialIds: Array.from(asignacionesPorMaterial.keys()),
        detalleCompleto: Array.from(asignacionesPorMaterial.entries())
      });
      
      // Log para ver qué tiene itemsCalculadora
      console.log('📦 [ResumenFinanciero] Items Calculadora:', {
        totalItems: itemsCalculadora.length,
        items: itemsCalculadora.map(item => ({
          id: item.id,
          tipoProfesional: item.tipoProfesional,
          tieneMateriales: !!item.materialesLista,
          cantidadMateriales: item.materialesLista?.length || 0
        }))
      });
      
      // Extraer materiales con estado de pagado Y asignaciones semanales
      itemsCalculadora.forEach((item, itemIdx) => {
        if (item.materialesLista && Array.isArray(item.materialesLista)) {
          item.materialesLista.forEach((mat, matIdx) => {
            const pagoExistente = pagosConsolidados.find(pago => 
              pago.tipoPago === 'MATERIALES' &&
              pago.itemCalculadoraId === item.id &&
              pago.materialCalculadoraId === mat.id
            );
            
            // Obtener asignaciones de este material
            const asignaciones = asignacionesPorMaterial.get(mat.id) || [];
            
            materialesArray.push({
              id: `${presupuesto.id}-mat-${itemIdx}-${matIdx}`,
              presupuestoId: presupuesto.id,
              itemCalculadoraId: item.id,
              materialCalculadoraId: mat.id,
              nombreObra: nombreObra,
              nombre: mat.nombre || 'Sin nombre',
              cantidadUnidades: mat.cantidad || 0,
              precioUnidad: mat.precioUnitario || 0,
              precioTotal: mat.subtotal || 0,
              unidad: mat.unidad || 'u',
              pagado: !!pagoExistente,
              pagoId: pagoExistente?.id,
              fechaPago: pagoExistente?.fechaPago,
              asignaciones: asignaciones, // 🔥 Array de asignaciones semanales desde BD
              cantidadAsignada: asignaciones.reduce((sum, a) => sum + (a.cantidad || 0), 0) // Total asignado
            });
          });
        }
      });
      
      // Extraer otros costos (gastos generales) con estado de pagado
      itemsCalculadora.forEach((item, itemIdx) => {
        if (item.subtotalGastosGenerales && parseFloat(item.subtotalGastosGenerales) > 0) {
          const pagoExistente = pagosConsolidados.find(pago => 
            pago.tipoPago === 'GASTOS_GENERALES' &&
            pago.itemCalculadoraId === item.id &&
            pago.materialCalculadoraId === null
          );
          
          otrosCostosArray.push({
            id: `${presupuesto.id}-gasto-${itemIdx}`,
            presupuestoId: presupuesto.id,
            itemCalculadoraId: item.id,
            nombreObra: nombreObra,
            nombre: item.descripcionGastosGenerales || `Gastos Generales - ${item.tipoProfesional}`,
            precioTotal: parseFloat(item.subtotalGastosGenerales),
            tipo: item.tipoProfesional || 'Gastos Generales',
            observaciones: item.observacionesGastosGenerales,
            pagado: !!pagoExistente,
            pagoId: pagoExistente?.id,
            fechaPago: pagoExistente?.fechaPago
          });
        }
      });
      
      setMateriales(materialesArray);
      setOtrosCostos(otrosCostosArray);
    } catch (error) {
      console.error('❌ Error cargando materiales y otros costos:', error);
    }
  }, [empresaSeleccionada?.id]); // useCallback con dependencias mínimas

  const cargarResumen = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('🔍 Cargando resumen financiero completo para presupuesto:', direccionSeleccionada.presupuestoNoClienteId);
      
      // 1. Obtener el presupuesto completo
      const presupuesto = await api.presupuestosNoCliente.getById(
        direccionSeleccionada.presupuestoNoClienteId,
        empresaSeleccionada.id
      );
      
      console.log('📦 Presupuesto obtenido:', presupuesto);
      
      // 2. Obtener COBROS de esta obra usando el servicio correcto
      let totalCobrado = 0;
      let cantidadCobros = 0;
      try {
        const cobros = await cobrosObraService.listarCobrosPorObra({
          presupuestoNoClienteId: direccionSeleccionada.presupuestoNoClienteId,
          calle: direccionSeleccionada.calle,
          altura: direccionSeleccionada.altura,
          ...(direccionSeleccionada.barrio && { barrio: direccionSeleccionada.barrio }),
          ...(direccionSeleccionada.torre && { torre: direccionSeleccionada.torre }),
          ...(direccionSeleccionada.piso && { piso: direccionSeleccionada.piso }),
          ...(direccionSeleccionada.depto && { depto: direccionSeleccionada.depto })
        });
        const cobrosArray = Array.isArray(cobros) ? cobros : [];
        console.log('💵 Cobros obtenidos:', cobrosArray.length);
        
        // Sumar solo cobros en estado COBRADO
        totalCobrado = cobrosArray
          .filter(c => c.estado === 'COBRADO')
          .reduce((sum, c) => sum + (c.montoCobrado || 0), 0);
        cantidadCobros = cobrosArray.length;
      } catch (errCobros) {
        console.warn('⚠️ No se pudieron cargar cobros:', errCobros);
        // No lanzar error, simplemente continuar con totalCobrado = 0
      }
      
      // 3. Obtener PAGOS de esta obra (profesionales + materiales + otros costos)
      let totalPagadoProfesionales = 0;
      let totalPagadoConsolidados = 0;
      let cantidadPagos = 0;
      try {
        // 3.1 PAGOS A PROFESIONALES
        const itemsCalculadora = presupuesto.itemsCalculadora || [];
        const todosProfesionalesIds = [];
        itemsCalculadora.forEach(item => {
          if (item.profesionales && Array.isArray(item.profesionales)) {
            item.profesionales.forEach(prof => {
              if (prof.id) {
                todosProfesionalesIds.push(prof.id);
              }
            });
          }
        });
        
        console.log('👷 IDs de profesionales en calculadora:', todosProfesionalesIds);
        
        // Obtener pagos de cada profesional
        const pagosPorProfesional = await Promise.all(
          todosProfesionalesIds.map(async (profId) => {
            try {
              const pagos = await pagosProfesionalObraService.obtenerPagosPorProfesional(profId);
              return Array.isArray(pagos) ? pagos : [];
            } catch (err) {
              console.warn(`⚠️ No se pudieron cargar pagos del profesional ${profId}`);
              return [];
            }
          })
        );
        
        const todosPagosProfesionales = pagosPorProfesional.flat();
        console.log('💸 Pagos a profesionales obtenidos:', todosPagosProfesionales.length);
        
        totalPagadoProfesionales = todosPagosProfesionales
          .filter(p => p.estado === 'PAGADO')
          .reduce((sum, p) => sum + (p.montoNeto || p.montoBruto || 0), 0);
        
        // 3.2 PAGOS CONSOLIDADOS (materiales + otros costos)
        const pagosConsolidados = await listarPagosConsolidadosPorPresupuesto(
          presupuesto.id,
          empresaSeleccionada.id
        ).catch(() => []);
        
        console.log('💰 Pagos consolidados obtenidos:', pagosConsolidados.length);
        
        totalPagadoConsolidados = pagosConsolidados
          .filter(p => p.estado === 'PAGADO')
          .reduce((sum, p) => sum + (parseFloat(p.monto) || 0), 0);
        
        cantidadPagos = todosPagosProfesionales.length + pagosConsolidados.length;
        
        console.log('💵 TOTAL PAGADO:', {
          profesionales: totalPagadoProfesionales,
          consolidados: totalPagadoConsolidados,
          total: totalPagadoProfesionales + totalPagadoConsolidados
        });
        
      } catch (errPagos) {
        console.warn('⚠️ No se pudieron cargar pagos:', errPagos);
      }
      
      const totalPagado = totalPagadoProfesionales + totalPagadoConsolidados;
      
      // 4. Extraer profesionales de itemsCalculadora para mostrar
      const itemsCalculadora = presupuesto.itemsCalculadora || [];
      console.log('📋 Items calculadora:', itemsCalculadora.length);
      const todosProfesionales = [];
      itemsCalculadora.forEach(item => {
        if (item.profesionales && Array.isArray(item.profesionales)) {
          console.log(`  📊 Item ${item.tipoProfesional}: ${item.profesionales.length} profesionales`);
          item.profesionales.forEach(prof => {
            todosProfesionales.push({
              id: prof.id,
              nombre: prof.nombre || prof.nombreCompleto || 'Sin nombre',
              tipoProfesional: prof.tipoProfesional || item.tipoProfesional,
              cantidadJornales: prof.cantidadJornales || 0,
              importeJornal: prof.importeJornal || 0
            });
          });
        }
      });
      console.log('👷 Total profesionales extraídos:', todosProfesionales.length);
      
      // 5. Calcular métricas
      const totalPresupuesto = presupuesto.totalPresupuestoConHonorarios || presupuesto.totalPresupuesto || 0;
      const saldoPorCobrar = totalPresupuesto - totalCobrado;
      const balanceNeto = totalCobrado - totalPagado;
      const porcentajeCobrado = totalPresupuesto > 0 ? (totalCobrado / totalPresupuesto) * 100 : 0;
      const porcentajePagado = totalPresupuesto > 0 ? (totalPagado / totalPresupuesto) * 100 : 0;
      
      // 6. Construir resumen con datos reales
      const resumenConstructo = {
        // Datos del presupuesto
        totalPresupuesto,
        totalBase: presupuesto.totalPresupuesto || 0,
        totalHonorarios: presupuesto.totalHonorarios || 0,
        totalMayoresCostos: presupuesto.totalMayoresCostos || 0,
        
        // Estado del presupuesto
        estado: presupuesto.estado,
        numeroPresupuesto: presupuesto.numeroPresupuesto,
        numeroVersion: presupuesto.numeroVersion || presupuesto.version,
        
        // Dirección
        direccion: `${presupuesto.direccionObraCalle || ''} ${presupuesto.direccionObraAltura || ''}`,
        nombreObra: presupuesto.nombreObra || 'Sin nombre',
        
        // Profesionales
        profesionalesActivos: todosProfesionales,
        cantidadProfesionales: todosProfesionales.length,
        
        // Datos financieros REALES
        totalCobrado,
        totalPagado,
        totalCobros: cantidadCobros,
        totalPagos: cantidadPagos,
        saldoPorCobrar,
        balanceNeto,
        porcentajeCobrado,
        porcentajePagado,
        
        // Otros
        promedioPresentismo: 100
      };
      
      console.log('✅ Resumen financiero completo:', resumenConstructo);
      setResumen(resumenConstructo);
      setLastUpdate(new Date());
      
    } catch (err) {
      console.error('❌ Error cargando resumen financiero:', err);
      setError('Error al cargar el resumen financiero. Por favor intente nuevamente.');
      setResumen(null);
    } finally {
      setLoading(false);
    }
  };

  // Funciones para manejo de suspensión
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

  // Función para pagar materiales
  const pagarMateriales = async (materialesParaPagar) => {
    if (!materialesParaPagar || materialesParaPagar.length === 0) {
      alert('No hay materiales para pagar');
      return;
    }

    const total = materialesParaPagar.reduce((sum, m) => sum + (m.precioTotal || 0), 0);
    if (!window.confirm(`¿Confirmar pago de ${materialesParaPagar.length} material(es) por ${formatearMoneda(total)}?`)) {
      return;
    }

    setLoading(true);
    try {
      const pagosData = materialesParaPagar.map(material => {
        const cantidad = parseFloat(material.cantidadUnidades) || 1;
        const monto = parseFloat(material.precioTotal) || 0;
        const precioUnitario = cantidad > 0 ? (monto / cantidad) : monto;

        // ✅ CRÍTICO: Asegurar que presupuestoNoClienteId siempre tenga valor
        const presupuestoId = material.presupuestoId || datosPresupuesto?.id || direccionSeleccionada?.presupuestoNoClienteId;
        
        if (!presupuestoId) {
          throw new Error('No se pudo determinar el ID del presupuesto para el material: ' + material.nombre);
        }

        return {
          presupuestoNoClienteId: presupuestoId,
          itemCalculadoraId: material.itemCalculadoraId,
          materialCalculadoraId: material.materialCalculadoraId,
          empresaId: empresaSeleccionada.id,
          tipoPago: 'MATERIALES',
          concepto: material.nombre,
          cantidad: cantidad,
          precioUnitario: precioUnitario,
          monto: monto,
          metodoPago: 'EFECTIVO',
          fechaPago: new Date().toISOString().split('T')[0],
          estado: 'PAGADO',
          observaciones: `Pago de material - ${material.nombre} - Obra: ${material.nombreObra || 'N/A'}`
        };
      });

      console.log('🔍 DEBUG - Materiales a pagar:');
      console.log('📊 Datos de entrada (materialesParaPagar):', materialesParaPagar);
      console.log('📤 Payload que se enviará (pagosData):', pagosData);
      console.log('🔑 Campos críticos del primer pago:', {
        presupuestoNoClienteId: pagosData[0]?.presupuestoNoClienteId,
        itemCalculadoraId: pagosData[0]?.itemCalculadoraId,
        materialCalculadoraId: pagosData[0]?.materialCalculadoraId,
        empresaId: pagosData[0]?.empresaId,
        tipoPago: pagosData[0]?.tipoPago,
        concepto: pagosData[0]?.concepto,
        cantidad: pagosData[0]?.cantidad,
        precioUnitario: pagosData[0]?.precioUnitario,
        monto: pagosData[0]?.monto
      });

      await registrarPagosConsolidadosBatch(pagosData, empresaSeleccionada.id);
      alert(`✅ ${pagosData.length} pago(s) de materiales registrados por ${formatearMoneda(total)}`);
      
      // Recargar datos
      if (datosPresupuesto) {
        await cargarMaterialesYOtrosCostos(datosPresupuesto);
      }
    } catch (error) {
      const errorMsg = error.data?.error || error.message || 'Error desconocido';
      alert(`❌ Error al registrar pagos:\n\n${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  // Función para pagar otros costos
  const pagarOtrosCostos = async (costosParaPagar) => {
    if (!costosParaPagar || costosParaPagar.length === 0) {
      alert('No hay otros costos para pagar');
      return;
    }

    const total = costosParaPagar.reduce((sum, c) => sum + (c.precioTotal || 0), 0);
    if (!window.confirm(`¿Confirmar pago de ${costosParaPagar.length} otro(s) costo(s) por ${formatearMoneda(total)}?`)) {
      return;
    }

    setLoading(true);
    try {
      const pagosData = costosParaPagar.map(costo => {
        // ✅ CRÍTICO: Asegurar que presupuestoNoClienteId siempre tenga valor
        const presupuestoId = costo.presupuestoId || datosPresupuesto?.id || direccionSeleccionada?.presupuestoNoClienteId;
        
        if (!presupuestoId) {
          throw new Error('No se pudo determinar el ID del presupuesto para el gasto: ' + costo.nombre);
        }

        return {
          presupuestoNoClienteId: presupuestoId,
          itemCalculadoraId: costo.itemCalculadoraId,
          materialCalculadoraId: null,
          empresaId: empresaSeleccionada.id,
          tipoPago: 'GASTOS_GENERALES',
          concepto: costo.nombre,
          cantidad: 1,
          precioUnitario: parseFloat(costo.precioTotal),
          monto: parseFloat(costo.precioTotal),
          metodoPago: 'EFECTIVO',
          fechaPago: new Date().toISOString().split('T')[0],
          estado: 'PAGADO',
          observaciones: costo.observaciones || `Pago de gastos generales - ${costo.tipo} - Obra: ${costo.nombreObra || 'N/A'}`
        };
      });

      console.log('🔍 DEBUG - Gastos Generales a pagar:');
      console.log('📊 Datos de entrada (costosParaPagar):', costosParaPagar);
      console.log('📤 Payload que se enviará (pagosData):', pagosData);
      console.log('🔑 Campos críticos del primer pago:', {
        presupuestoNoClienteId: pagosData[0]?.presupuestoNoClienteId,
        itemCalculadoraId: pagosData[0]?.itemCalculadoraId,
        materialCalculadoraId: pagosData[0]?.materialCalculadoraId,
        empresaId: pagosData[0]?.empresaId,
        tipoPago: pagosData[0]?.tipoPago,
        concepto: pagosData[0]?.concepto,
        cantidad: pagosData[0]?.cantidad,
        precioUnitario: pagosData[0]?.precioUnitario,
        monto: pagosData[0]?.monto
      });

      await registrarPagosConsolidadosBatch(pagosData, empresaSeleccionada.id);
      alert(`✅ ${pagosData.length} pago(s) de gastos generales registrados por ${formatearMoneda(total)}`);
      
      // Recargar datos
      if (datosPresupuesto) {
        await cargarMaterialesYOtrosCostos(datosPresupuesto);
      }
    } catch (error) {
      const errorMsg = error.data?.error || error.message || 'Error desconocido';
      alert(`❌ Error al registrar pagos:\n\n${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  // Función para pagar profesionales
  const pagarProfesionales = async (profesionalesParaPagar) => {
    if (!profesionalesParaPagar || profesionalesParaPagar.length === 0) {
      alert('No hay profesionales para pagar');
      return;
    }

    const total = profesionalesParaPagar.reduce((sum, p) => {
      const subtotal = p.precioTotal || 0;
      const totalPagado = p.totalPagado || 0;
      return sum + (subtotal - totalPagado);
    }, 0);

    if (!window.confirm(`¿Confirmar pago de ${profesionalesParaPagar.length} profesional(es) por ${formatearMoneda(total)}?`)) {
      return;
    }

    setLoading(true);
    try {
      const pagosRegistrados = [];
      
      for (const prof of profesionalesParaPagar) {
        const subtotal = prof.precioTotal || 0;
        const totalPagado = prof.totalPagado || 0;
        const montoPendiente = subtotal - totalPagado;

        if (montoPendiente <= 0) continue; // Saltar si ya está pagado

        const pagoData = {
          profesionalObraId: prof.id,
          empresaId: empresaSeleccionada.id,
          monto: montoPendiente,
          tipoPago: 'SUELDO_SEMANAL',
          metodoPago: 'EFECTIVO',
          fechaPago: new Date().toISOString().split('T')[0],
          observaciones: `Pago total - ${prof.nombre || prof.tipoProfesional}`,
          estado: 'COMPLETADO'
        };

        const resultado = await pagosProfesionalObraService.registrarPago(pagoData, empresaSeleccionada.id);
        pagosRegistrados.push(resultado);
      }

      alert(`✅ ${pagosRegistrados.length} pago(s) de profesionales registrados por ${formatearMoneda(total)}`);
      
      // Recargar datos
      await cargarDatosCompletos();
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message || 'Error desconocido';
      alert(`❌ Error al registrar pagos:\n\n${errorMsg}`);
      console.error('Error completo:', error);
    } finally {
      setLoading(false);
    }
  };

  // Función para abrir el modal de desglose
  const abrirDesglose = (tipo, titulo) => {
    console.log('🔍 abrirDesglose llamado:', { 
      tipo, 
      titulo, 
      modoConsolidado, 
      tieneEstadisticas: !!estadisticasActuales,
      desglosePorObra: estadisticasActuales?.desglosePorObra 
    });
    
    if (!modoConsolidado) {
      console.warn('⚠️ No está en modo consolidado');
      return;
    }
    
    if (!estadisticasActuales?.desglosePorObra) {
      console.warn('⚠️ No hay desglosePorObra disponible');
      return;
    }
    
    console.log('✅ Abriendo modal de desglose con', estadisticasActuales.desglosePorObra.length, 'obras');
    setDesgloseTipo(tipo);
    setDesgloseTitulo(titulo);
    setDesgloseDatos(estadisticasActuales.desglosePorObra);
    setShowDesglose(true);
  };

  if (!show) return null;

  return (
    <>
      <div className="modal show d-block" style={{zIndex: 2000}}>
        <div className="modal-dialog modal-xl" style={{marginTop: '20px', maxWidth: '1400px'}}>
          <div className="modal-content">
            <div className="modal-header bg-gradient" style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}}>
              <div className="d-flex align-items-center justify-content-between w-100">
                <h5 className="modal-title text-primary mb-0 flex-shrink-0 me-3 fw-bold">Resumen de Pagos y Cobros - Obra Seleccionada</h5>
                <div className="d-flex gap-2 align-items-center flex-shrink-0">
                {lastUpdate && (
                  <small className="text-white opacity-75">
                    Última actualización: {new Date(lastUpdate).toLocaleTimeString('es-AR')}
                  </small>
                )}
                <button 
                  type="button" 
                  className="btn btn-sm btn-light"
                  onClick={() => modoConsolidado ? cargarResumenConsolidado() : cargarResumen()}
                  disabled={loading || (!direccionSeleccionada && !modoConsolidado)}
                  title="Actualizar datos del presupuesto"
                >
                  <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`}></i> Actualizar
                </button>
                <button type="button" className="btn btn-light btn-sm ms-auto" onClick={onHide}>
                  Cerrar
                </button>
              </div>
            </div>
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
                <strong>Modo Consolidado:</strong> Mostrando resumen financiero de TODAS las obras con estados APROBADO y EN_EJECUCION
              </div>
            )}

            {/* Selector de dirección de obra - solo si NO está en modo consolidado */}
            {!modoConsolidado && (
              <DireccionObraSelector
                value={direccionSeleccionada}
                onChange={setDireccionSeleccionada}
                required={false}
                label="Obra Seleccionada"
                readOnly={!!obraDireccion}
              />
            )}

            {loadingActual || loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" style={{width: '3rem', height: '3rem'}} role="status">
                  <span className="visually-hidden">Cargando...</span>
                </div>
                <p className="mt-3 text-muted">Cargando información financiera...</p>
              </div>
            ) : (() => {
              // SIEMPRE usar estadísticas del hook (tiene integración con EventBus)
              // Si no hay estadísticas del hook, usar resumen manual como fallback
              const resumenFinal = resumenDesdeEstadisticas || resumen;
              
              return resumenFinal ? (
              <>
                {/* SECCIÓN 0: INFO DEL PRESUPUESTO - Solo mostrar si NO es modo consolidado */}
                {!modoConsolidado && resumenFinal?.numeroPresupuesto && (
                  <div className="alert alert-info mb-4">
                    <div className="row align-items-center">
                      <div className="col-md-8">
                        <h5 className="mb-2">
                          📋 Presupuesto #{resumenFinal.numeroPresupuesto} 
                          {resumenFinal.numeroVersion && ` - v${resumenFinal.numeroVersion}`}
                        </h5>
                        <p className="mb-1">
                          <strong>📍 Dirección:</strong> {resumenFinal.direccion}
                        </p>
                        <p className="mb-1">
                          <strong>📊 Estado:</strong> <span className="badge bg-primary">{resumenFinal.estado}</span>
                        </p>
                        <p className="mb-0 small text-muted">
                          <i className="bi bi-arrow-clockwise me-1"></i>
                          Los datos se actualizan automáticamente cada vez que abres este dashboard
                        </p>
                      </div>
                      <div className="col-md-4 text-end">
                        <div className="mb-2">
                          <small className="text-muted">Total Presupuestado</small>
                          <h3 className="mb-0 text-primary">{formatearMoneda(resumenFinal.totalPresupuesto || resumenFinal.presupuestoTotal)}</h3>
                        </div>
                        {(resumenFinal?.totalHonorarios || 0) > 0 && (
                          <small className="text-muted">
                            Incluye honorarios: {formatearMoneda(resumenFinal.totalHonorarios)}
                          </small>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* MÉTRICAS FINANCIERAS PRINCIPALES */}
                <div className="row mb-4">
                  <div className="col-12">
                    <h5 className="mb-3 text-primary fw-bold">Resumen de Pagos y Cobros - Obra Seleccionada</h5>
                    <h5 className="mb-3">💰 Resumen Financiero</h5>
                  </div>
                  
                  {/* Total Presupuesto */}
                  <div className="col-md-4 mb-3">
                    <div 
                      className="card border-primary shadow-sm h-100"
                      onClick={() => modoConsolidado && abrirDesglose('presupuestos', '📋 Desglose de Presupuestos por Obra')}
                      style={{cursor: modoConsolidado ? 'pointer' : 'default'}}
                    >
                      <div className="card-body text-center">
                        <div className="text-primary mb-2" style={{fontSize: '2rem'}}>📋</div>
                        <h6 className="text-muted mb-2">Total Presupuestado</h6>
                        <h3 className="text-primary mb-0">{formatearMoneda(resumenFinal.totalPresupuesto || resumenFinal.presupuestoTotal)}</h3>
                        <small className="text-muted">
                          {modoConsolidado ? `De ${resumenFinal.cantidadObras || 1} obra(s)` : 'Incluye honorarios y mayores costos'}
                        </small>
                        {modoConsolidado && (
                          <div className="mt-2">
                            <small className="text-primary"><i className="bi bi-hand-index me-1"></i>Clic para ver detalle</small>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Total Cobrado */}
                  <div className="col-md-4 mb-3">
                    <div 
                      className="card border-success shadow-sm h-100"
                      onClick={() => modoConsolidado && abrirDesglose('cobros', '💵 Desglose de Cobros por Obra')}
                      style={{cursor: modoConsolidado ? 'pointer' : 'default'}}
                    >
                      <div className="card-body text-center">
                        <div className="text-success mb-2" style={{fontSize: '2rem'}}>💵</div>
                        <h6 className="text-muted mb-2">Total Cobrado</h6>
                        <h3 className="text-success mb-0">{formatearMoneda(resumenFinal.totalCobrado)}</h3>
                        <div className="progress mt-2" style={{height: '8px'}}>
                          <div 
                            className="progress-bar bg-success" 
                            role="progressbar" 
                            style={{width: `${resumenFinal.porcentajeCobrado || 0}%`}}
                          ></div>
                        </div>
                        <small className="text-muted">{(resumenFinal.porcentajeCobrado || 0).toFixed(1)}% del presupuesto</small>
                        {modoConsolidado && (
                          <div className="mt-2">
                            <small className="text-success"><i className="bi bi-hand-index me-1"></i>Clic para ver detalle</small>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Total Pagado */}
                  <div className="col-md-4 mb-3">
                    <div 
                      className="card border-danger shadow-sm h-100"
                      onClick={() => modoConsolidado && abrirDesglose('pagos', '💸 Desglose de Pagos por Obra')}
                      style={{cursor: modoConsolidado ? 'pointer' : 'default'}}
                    >
                      <div className="card-body text-center">
                        <div className="text-danger mb-2" style={{fontSize: '2rem'}}>💸</div>
                        <h6 className="text-muted mb-2">Total Pagado</h6>
                        <h3 className="text-danger mb-0">{formatearMoneda(resumenFinal.totalPagado)}</h3>
                        <div className="progress mt-2" style={{height: '8px'}}>
                          <div 
                            className="progress-bar bg-danger" 
                            role="progressbar" 
                            style={{width: `${resumenFinal.porcentajePagado || 0}%`}}
                          ></div>
                        </div>
                        <small className="text-muted">{(resumenFinal.porcentajePagado || 0).toFixed(1)}% del presupuesto</small>
                        {modoConsolidado && (
                          <div className="mt-2">
                            <small className="text-danger"><i className="bi bi-hand-index me-1"></i>Clic para ver detalle</small>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Saldo por Cobrar */}
                  <div className="col-md-6 mb-3">
                    <div 
                      className="card border-warning shadow-sm h-100"
                      onClick={() => modoConsolidado && abrirDesglose('saldoPorCobrar', '📊 Desglose de Saldo por Cobrar por Obra')}
                      style={{cursor: modoConsolidado ? 'pointer' : 'default'}}
                    >
                      <div className="card-body text-center">
                        <div className="text-warning mb-2" style={{fontSize: '2rem'}}>📊</div>
                        <h6 className="text-muted mb-2">Saldo por Cobrar</h6>
                        <h3 className="text-warning mb-0">{formatearMoneda(resumenFinal.saldoPorCobrar || 0)}</h3>
                        <small className="text-muted">
                          {(resumenFinal.saldoPorCobrar || 0) > 0 
                            ? 'Falta por cobrar del presupuesto' 
                            : 'Presupuesto cobrado completamente'}
                        </small>
                        {modoConsolidado && (
                          <div className="mt-2">
                            <small className="text-warning"><i className="bi bi-hand-index me-1"></i>Clic para ver detalle</small>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Balance Neto */}
                  <div className="col-md-6 mb-3">
                    <div 
                      className={`card shadow-sm h-100 ${(resumenFinal.balanceNeto || 0) >= 0 ? 'border-info' : 'border-danger'}`}
                      onClick={() => modoConsolidado && abrirDesglose('balanceNeto', '📈 Desglose de Balance Neto por Obra')}
                      style={{cursor: modoConsolidado ? 'pointer' : 'default'}}
                    >
                      <div className="card-body text-center">
                        <div className={`mb-2 ${(resumenFinal.balanceNeto || 0) >= 0 ? 'text-info' : 'text-danger'}`} style={{fontSize: '2rem'}}>
                          {(resumenFinal.balanceNeto || 0) >= 0 ? '📈' : '📉'}
                        </div>
                        <h6 className="text-muted mb-2">Balance Neto</h6>
                        <h3 className={(resumenFinal?.balanceNeto || 0) >= 0 ? 'text-info' : 'text-danger'}>
                          {formatearMoneda(Math.abs(resumenFinal?.balanceNeto || 0))}
                        </h3>
                        <small className="text-muted">
                          {(resumenFinal?.balanceNeto || 0) >= 0 
                            ? 'Ganancia actual (Cobrado - Pagado)' 
                            : 'Pérdida actual (Pagado > Cobrado)'}
                        </small>
                      </div>
                    </div>
                  </div>
                </div>

                {/* LISTA DE PROFESIONALES */}
                {!modoConsolidado && resumenFinal?.profesionalesActivos && resumenFinal.profesionalesActivos.length > 0 && (
                  <div className="card mb-4 shadow-sm">
                    <div className="card-header bg-primary text-white">
                      <h5 className="mb-0">👷 Profesionales en la Calculadora</h5>
                    </div>
                    <div className="card-body">
                      <div className="table-responsive">
                        <table className="table table-hover">
                          <thead>
                            <tr>
                              <th>Nombre</th>
                              <th>Tipo</th>
                              <th className="text-end">Jornales</th>
                              <th className="text-end">Importe Jornal</th>
                              <th className="text-end">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {resumenFinal.profesionalesActivos.map((prof, index) => (
                              <tr key={index}>
                                <td>{prof.nombre}</td>
                                <td><span className="badge bg-info">{prof.tipoProfesional}</span></td>
                                <td className="text-end">{prof.cantidadJornales || '-'}</td>
                                <td className="text-end">{formatearMoneda(prof.importeJornal || 0)}</td>
                                <td className="text-end">
                                  <strong>{formatearMoneda((prof.cantidadJornales || 0) * (prof.importeJornal || 0))}</strong>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* SECCIÓN ADICIONAL: INGRESOS Y EGRESOS */}
                <div className="row mb-4">
                  <div className="col-12">
                    <h5 className="mb-3">📑 Detalle de Movimientos</h5>
                  </div>
                  <div className="col-md-4">
                    <div 
                      className="card border-success shadow-sm"
                      onClick={() => modoConsolidado && abrirDesglose('cobros', '💰 Desglose de Ingresos (Cobrado) por Obra')}
                      style={{cursor: modoConsolidado ? 'pointer' : 'default'}}
                    >
                      <div className="card-body text-center">
                        <div className="text-success mb-2" style={{fontSize: '2rem'}}>💰</div>
                        <h6 className="text-muted mb-2">INGRESOS (Cobrado)</h6>
                        <h3 className="text-success mb-0">{formatearMoneda(resumenFinal?.totalCobrado || 0)}</h3>
                        <small className="text-muted">De {resumenFinal?.totalCobros || 0} cobro(s)</small>
                        {modoConsolidado && (
                          <div className="mt-2">
                            <small className="text-success"><i className="bi bi-hand-index me-1"></i>Clic para ver detalle</small>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div 
                      className="card border-danger shadow-sm"
                      onClick={() => modoConsolidado && abrirDesglose('pagos', '💸 Desglose de Egresos (Pagado) por Obra')}
                      style={{cursor: modoConsolidado ? 'pointer' : 'default'}}
                    >
                      <div className="card-body text-center">
                        <div className="text-danger mb-2" style={{fontSize: '2rem'}}>💸</div>
                        <h6 className="text-muted mb-2">EGRESOS (Pagado)</h6>
                        <h3 className="text-danger mb-0">{formatearMoneda(resumenFinal?.totalPagado || 0)}</h3>
                        <small className="text-muted">De {resumenFinal?.totalPagos || 0} pago(s)</small>
                        {modoConsolidado && (
                          <div className="mt-2">
                            <small className="text-danger"><i className="bi bi-hand-index me-1"></i>Clic para ver detalle</small>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div 
                      className="card border-primary shadow-sm"
                      onClick={() => modoConsolidado && abrirDesglose('balanceNeto', '📈 Desglose de Balance Neto por Obra')}
                      style={{cursor: modoConsolidado ? 'pointer' : 'default'}}
                    >
                      <div className="card-body text-center">
                        <div className={`mb-2 ${(resumenFinal?.balanceNeto || 0) >= 0 ? 'text-success' : 'text-danger'}`} style={{fontSize: '2rem'}}>
                          {(resumenFinal?.balanceNeto || 0) >= 0 ? '📈' : '📉'}
                        </div>
                        <h6 className="text-muted mb-2">BALANCE NETO</h6>
                        <h3 className={`mb-0 ${(resumenFinal?.balanceNeto || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                          {formatearMoneda(resumenFinal?.balanceNeto || 0)}
                        </h3>
                        <small className="text-muted">
                          {(resumenFinal?.balanceNeto || 0) >= 0 ? 'Superávit' : 'Déficit'}
                        </small>
                        {modoConsolidado && (
                          <div className="mt-2">
                            <small className="text-primary"><i className="bi bi-hand-index me-1"></i>Clic para ver detalle</small>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECCIÓN 2: COBROS */}
                <div className="card mb-4 shadow-sm">
                  <div className="card-header bg-success text-white">
                    <h5 className="mb-0">💰 Detalle de Cobros</h5>
                  </div>
                  <div className="card-body">
                    <div className="row">
                      <div className="col-md-3">
                        <div 
                          className="text-center p-3 border rounded"
                          onClick={() => modoConsolidado && abrirDesglose('cobros', '💰 Total Cobros por Obra')}
                          style={{cursor: modoConsolidado ? 'pointer' : 'default'}}
                        >
                          <div className="text-muted small mb-1">Total Cobros</div>
                          <div className="h5 mb-0">{resumenFinal?.totalCobros || 0}</div>
                          {modoConsolidado && (
                            <small className="text-success d-block mt-1"><i className="bi bi-hand-index"></i></small>
                          )}
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div 
                          className="text-center p-3 border rounded"
                          onClick={() => modoConsolidado && abrirDesglose('cobros', '⏳ Cobros Pendientes por Obra')}
                          style={{cursor: modoConsolidado ? 'pointer' : 'default'}}
                        >
                          <div className="text-muted small mb-1">Cobros Pendientes</div>
                          <div className="h5 mb-0 text-warning">{resumenFinal?.cobrosPendientes || 0}</div>
                          {modoConsolidado && (
                            <small className="text-warning d-block mt-1"><i className="bi bi-hand-index"></i></small>
                          )}
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div 
                          className="text-center p-3 border rounded"
                          onClick={() => modoConsolidado && abrirDesglose('saldoPorCobrar', '💵 Saldo por Cobrar por Obra')}
                          style={{cursor: modoConsolidado ? 'pointer' : 'default'}}
                        >
                          <div className="text-muted small mb-1">Monto Pendiente</div>
                          <div className="h5 mb-0 text-warning">{formatearMoneda(resumenFinal?.montoPendienteCobro || 0)}</div>
                          {modoConsolidado && (
                            <small className="text-warning d-block mt-1"><i className="bi bi-hand-index"></i></small>
                          )}
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div 
                          className="text-center p-3 border rounded"
                          onClick={() => modoConsolidado && abrirDesglose('cobros', '🚨 Cobros Vencidos por Obra')}
                          style={{cursor: modoConsolidado ? 'pointer' : 'default'}}
                        >
                          <div className="text-muted small mb-1">Cobros Vencidos</div>
                          <div className="h5 mb-0 text-danger">{resumenFinal?.cobrosVencidos || 0}</div>
                          {modoConsolidado && (
                            <small className="text-danger d-block mt-1"><i className="bi bi-hand-index"></i></small>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECCIÓN 3: PAGOS */}
                <div className="card mb-4 shadow-sm">
                  <div className="card-header bg-primary text-white">
                    <h5 className="mb-0">💸 Detalle de Pagos a Profesionales</h5>
                  </div>
                  <div className="card-body">
                    <div className="row">
                      <div className="col-md-3">
                        <div 
                          className="text-center p-3 border rounded"
                          onClick={() => modoConsolidado && abrirDesglose('pagos', '💸 Total Pagos por Obra')}
                          style={{cursor: modoConsolidado ? 'pointer' : 'default'}}
                        >
                          <div className="text-muted small mb-1">Total Pagos</div>
                          <div className="h5 mb-0">{resumenFinal?.totalPagos || 0}</div>
                          {modoConsolidado && (
                            <small className="text-primary d-block mt-1"><i className="bi bi-hand-index"></i></small>
                          )}
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div 
                          className="text-center p-3 border rounded"
                          onClick={() => modoConsolidado && abrirDesglose('pagos', '⏳ Pagos Pendientes por Obra')}
                          style={{cursor: modoConsolidado ? 'pointer' : 'default'}}
                        >
                          <div className="text-muted small mb-1">Pagos Pendientes</div>
                          <div className="h5 mb-0 text-warning">{resumenFinal?.pagosPendientes || 0}</div>
                          {modoConsolidado && (
                            <small className="text-warning d-block mt-1"><i className="bi bi-hand-index"></i></small>
                          )}
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div 
                          className="text-center p-3 border rounded"
                          onClick={() => modoConsolidado && abrirDesglose('pagos', '💵 Monto Pendiente por Obra')}
                          style={{cursor: modoConsolidado ? 'pointer' : 'default'}}
                        >
                          <div className="text-muted small mb-1">Monto Pendiente</div>
                          <div className="h5 mb-0 text-warning">{formatearMoneda(resumenFinal?.montoPendientePago || 0)}</div>
                          {modoConsolidado && (
                            <small className="text-warning d-block mt-1"><i className="bi bi-hand-index"></i></small>
                          )}
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div 
                          className="text-center p-3 border rounded"
                          onClick={() => modoConsolidado && abrirDesglose('pagos', '🎁 Adelantos por Obra')}
                          style={{cursor: modoConsolidado ? 'pointer' : 'default'}}
                        >
                          <div className="text-muted small mb-1">Total Adelantos</div>
                          <div className="h5 mb-0 text-info">{formatearMoneda(resumenFinal?.totalAdelantos || 0)}</div>
                          {modoConsolidado && (
                            <small className="text-info d-block mt-1"><i className="bi bi-hand-index"></i></small>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Promedio de Presentismo */}
                    {resumenFinal?.promedioPresentismo !== undefined && (
                      <div className="mt-3 text-center">
                        <div className="text-muted small">Promedio de Presentismo</div>
                        <div className="h4 mb-0 text-success">
                          {formatearPorcentaje(resumenFinal.promedioPresentismo)}
                        </div>
                        <div className="progress mt-2" style={{height: '25px'}}>
                          <div 
                            className="progress-bar bg-success" 
                            role="progressbar" 
                            style={{width: `${resumenFinal.promedioPresentismo}%`}}
                            aria-valuenow={resumenFinal.promedioPresentismo} 
                            aria-valuemin="0" 
                            aria-valuemax="100"
                          >
                            {formatearPorcentaje(resumenFinal.promedioPresentismo)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* SECCIÓN 4: PROFESIONALES ACTIVOS */}
                {resumenFinal?.profesionalesActivos && resumenFinal.profesionalesActivos.length > 0 && (
                  <div className="card mb-4 shadow-sm">
                    <div className="card-header bg-info text-white">
                      <h5 className="mb-0">
                        👷 Profesionales ({resumenFinal.profesionalesActivos.length})
                        {resumenFinal.profesionalesActivos.filter(p => {
                          const subtotal = p.precioTotal || 0;
                          const totalPagado = p.totalPagado || 0;
                          const saldo = subtotal - totalPagado;
                          return saldo <= 1 && subtotal > 0;
                        }).length > 0 && (
                          <span className="badge bg-success ms-2">
                            ✅ {resumenFinal.profesionalesActivos.filter(p => {
                              const subtotal = p.precioTotal || 0;
                              const totalPagado = p.totalPagado || 0;
                              const saldo = subtotal - totalPagado;
                              return saldo <= 1 && subtotal > 0;
                            }).length} pagado(s)
                          </span>
                        )}
                      </h5>
                    </div>
                    <div className="card-body">
                      {resumenFinal.profesionalesActivos.filter(p => {
                        const subtotal = p.precioTotal || 0;
                        const totalPagado = p.totalPagado || 0;
                        const saldo = subtotal - totalPagado;
                        return saldo > 1; // Tiene saldo pendiente
                      }).length > 0 && (
                        <button
                          className="btn btn-info btn-sm mb-3 w-100"
                          onClick={() => pagarProfesionales(resumenFinal.profesionalesActivos.filter(p => {
                            const subtotal = p.precioTotal || 0;
                            const totalPagado = p.totalPagado || 0;
                            const saldo = subtotal - totalPagado;
                            return saldo > 1; // Tiene saldo pendiente
                          }))}
                          disabled={loading}
                        >
                          💸 Pagar Todos ({resumenFinal.profesionalesActivos.filter(p => {
                            const subtotal = p.precioTotal || 0;
                            const totalPagado = p.totalPagado || 0;
                            const saldo = subtotal - totalPagado;
                            return saldo > 1;
                          }).length}) - 
                          {formatearMoneda(resumenFinal.profesionalesActivos.filter(p => {
                            const subtotal = p.precioTotal || 0;
                            const totalPagado = p.totalPagado || 0;
                            const saldo = subtotal - totalPagado;
                            return saldo > 1;
                          }).reduce((sum, p) => {
                            const subtotal = p.precioTotal || 0;
                            const totalPagado = p.totalPagado || 0;
                            return sum + (subtotal - totalPagado);
                          }, 0))}
                        </button>
                      )}
                      
                      <div className="table-responsive" style={{maxHeight: '300px', overflowY: 'auto'}}>
                        <table className="table table-sm table-hover">
                          <thead className="table-light sticky-top">
                            <tr>
                              <th>Profesional</th>
                              <th>Tipo</th>
                              <th>Total</th>
                              <th>Acción</th>
                            </tr>
                          </thead>
                          <tbody>
                            {resumenFinal.profesionalesActivos.map((prof, idx) => {
                              const subtotal = prof.precioTotal || 0;
                              const totalPagado = prof.totalPagado || 0;
                              const saldo = subtotal - totalPagado;
                              const estaPagado = saldo <= 1 && subtotal > 0;
                              
                              return (
                                <tr key={idx} className={estaPagado ? 'table-success' : ''}>
                                  <td>
                                    {prof.nombre}
                                    {estaPagado && <span className="badge bg-success ms-2">✅ PAGADO</span>}
                                  </td>
                                  <td>{prof.tipoProfesional || 'No especificado'}</td>
                                  <td className="fw-bold">{formatearMoneda(subtotal)}</td>
                                  <td>
                                    {estaPagado ? (
                                      <small className="text-muted">Pagado</small>
                                    ) : totalPagado > 0 ? (
                                      <small className="text-warning">Pago parcial: {formatearMoneda(totalPagado)}</small>
                                    ) : (
                                      <small className="text-muted">Sin pagos</small>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* SECCIÓN 5: MATERIALES */}
                {!modoConsolidado && materiales.length > 0 && (
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
                      {materiales.filter(m => !m.pagado && !materialesSuspendidos.has(m.id)).length > 0 && (
                        <button
                          className="btn btn-success btn-sm mb-3 w-100"
                          onClick={() => pagarMateriales(materiales.filter(m => !m.pagado && !materialesSuspendidos.has(m.id)))}
                          disabled={loading}
                        >
                          💸 Pagar Todos ({materiales.filter(m => !m.pagado && !materialesSuspendidos.has(m.id)).length}) - 
                          {formatearMoneda(materiales.filter(m => !m.pagado && !materialesSuspendidos.has(m.id)).reduce((s, m) => s + m.precioTotal, 0))}
                        </button>
                      )}
                      
                      <div className="table-responsive" style={{maxHeight: '300px', overflowY: 'auto'}}>
                        <table className="table table-sm table-hover">
                          <thead className="table-light sticky-top">
                            <tr>
                              <th>Material</th>
                              <th>Cantidad</th>
                              <th>Total</th>
                              <th>Acción</th>
                            </tr>
                          </thead>
                          <tbody>
                            {materiales.map(mat => {
                              const estaSuspendido = materialesSuspendidos.has(mat.id);
                              const estaPagado = mat.pagado;
                              return (
                                <tr key={mat.id} className={estaPagado ? 'table-success' : estaSuspendido ? 'table-secondary' : ''}>
                                  <td>
                                    {mat.nombre}
                                    {estaPagado && <span className="badge bg-success ms-2">✅ PAGADO</span>}
                                    {estaSuspendido && !estaPagado && <span className="badge bg-secondary ms-2">Suspendido</span>}
                                  </td>
                                  <td>{mat.cantidadUnidades} {mat.unidad}</td>
                                  <td className="fw-bold">{formatearMoneda(mat.precioTotal)}</td>
                                  <td>
                                    {estaPagado ? (
                                      <small className="text-muted">{mat.fechaPago ? new Date(mat.fechaPago).toLocaleDateString() : 'Pagado'}</small>
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
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* SECCIÓN 6: OTROS COSTOS */}
                {!modoConsolidado && otrosCostos.length > 0 && (
                  <div className="card mb-4 shadow-sm">
                    <div className="card-header bg-warning text-dark">
                      <h5 className="mb-0">
                        📋 Otros Costos ({otrosCostos.length})
                        {otrosCostos.filter(c => c.pagado).length > 0 && (
                          <span className="badge bg-success ms-2">
                            ✅ {otrosCostos.filter(c => c.pagado).length} pagado(s)
                          </span>
                        )}
                      </h5>
                    </div>
                    <div className="card-body">
                      {otrosCostos.filter(c => !c.pagado && !otrosCostosSuspendidos.has(c.id)).length > 0 && (
                        <button
                          className="btn btn-warning btn-sm mb-3 w-100"
                          onClick={() => pagarOtrosCostos(otrosCostos.filter(c => !c.pagado && !otrosCostosSuspendidos.has(c.id)))}
                          disabled={loading}
                        >
                          💸 Pagar Todos ({otrosCostos.filter(c => !c.pagado && !otrosCostosSuspendidos.has(c.id)).length}) - 
                          {formatearMoneda(otrosCostos.filter(c => !c.pagado && !otrosCostosSuspendidos.has(c.id)).reduce((s, c) => s + c.precioTotal, 0))}
                        </button>
                      )}
                      
                      <div className="table-responsive" style={{maxHeight: '300px', overflowY: 'auto'}}>
                        <table className="table table-sm table-hover">
                          <thead className="table-light sticky-top">
                            <tr>
                              <th>Descripción</th>
                              <th>Tipo</th>
                              <th>Total</th>
                              <th>Acción</th>
                            </tr>
                          </thead>
                          <tbody>
                            {otrosCostos.map(costo => {
                              const estaSuspendido = otrosCostosSuspendidos.has(costo.id);
                              const estaPagado = costo.pagado;
                              return (
                                <tr key={costo.id} className={estaPagado ? 'table-success' : estaSuspendido ? 'table-secondary' : ''}>
                                  <td>
                                    {costo.nombre}
                                    {estaPagado && <span className="badge bg-success ms-2">✅ PAGADO</span>}
                                    {estaSuspendido && !estaPagado && <span className="badge bg-secondary ms-2">Suspendido</span>}
                                  </td>
                                  <td>{costo.tipo}</td>
                                  <td className="fw-bold">{formatearMoneda(costo.precioTotal)}</td>
                                  <td>
                                    {estaPagado ? (
                                      <small className="text-muted">{costo.fechaPago ? new Date(costo.fechaPago).toLocaleDateString() : 'Pagado'}</small>
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
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* SECCIÓN 7: ALERTAS */}
                {(((resumenFinal?.cobrosVencidos || 0) > 0) || ((resumenFinal?.pagosPendientes || 0) > 0) || ((resumenFinal?.balanceNeto || 0) < 0)) && (
                  <div className="card shadow-sm border-warning">
                    <div className="card-header bg-warning">
                      <h5 className="mb-0">⚠️ Alertas y Acciones Requeridas</h5>
                    </div>
                    <div className="card-body">
                      <ul className="mb-0">
                        {(resumenFinal?.cobrosVencidos || 0) > 0 && (
                          <li className="text-danger">
                            <strong>¡Atención!</strong> Hay {resumenFinal.cobrosVencidos} cobro(s) vencido(s). 
                            Se recomienda realizar seguimiento.
                          </li>
                        )}
                        {(resumenFinal?.pagosPendientes || 0) > 0 && (
                          <li className="text-warning">
                            Hay {resumenFinal.pagosPendientes} pago(s) pendiente(s) por un total de {formatearMoneda(resumenFinal.montoPendientePago || 0)}.
                          </li>
                        )}
                        {(resumenFinal?.balanceNeto || 0) < 0 && (
                          <li className="text-danger">
                            <strong>Déficit financiero:</strong> Los egresos superan a los ingresos en {formatearMoneda(Math.abs(resumenFinal.balanceNeto))}.
```
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}
              </>
            ) : direccionSeleccionada ? (
              <div className="alert alert-info">
                <i className="fas fa-info-circle me-2"></i>
                No hay datos financieros disponibles para esta dirección.
              </div>
            ) : (
              <div className="alert alert-secondary text-center py-5">
                <i className="fas fa-map-marker-alt fa-3x text-muted mb-3"></i>
                <h5>Seleccione una dirección de obra para ver la información financiera</h5>
                <p className="text-muted">El resumen incluye cobros, pagos, balances y estadísticas de profesionales.</p>
              </div>
            );
            })()}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onHide}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>

      {/* Estilos CSS */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
          display: inline-block;
        }
      `}</style>
      
      {/* Modal de desglose por obra - renderizado con Portal */}
      {showDesglose && ReactDOM.createPortal(
        <DetalleConsolidadoPorObraModal
          show={showDesglose}
          onHide={() => setShowDesglose(false)}
          tipo={desgloseTipo}
          datos={desgloseDatos}
          titulo={desgloseTitulo}
          empresaSeleccionada={empresaSeleccionada}
        />,
        document.body
      )}
    </>
  );
};

export default ResumenFinancieroObraModal;
