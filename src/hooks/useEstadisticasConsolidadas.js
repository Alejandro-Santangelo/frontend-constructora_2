import { useState, useEffect } from 'react';
import api from '../services/api';
import { listarCobrosPorObra } from '../services/cobrosObraService';
import { listarPagosPorProfesionalObra } from '../services/pagosProfesionalObraService';
import { listarPagosConsolidadosPorPresupuesto } from '../services/pagosConsolidadosService';
import { obtenerAsignacionesDeObra } from '../services/asignacionesCobroObraService';
import { obtenerSaldoDisponible } from '../services/retirosPersonalesService';
import { obtenerResumenCobrosEmpresa } from '../services/cobrosEmpresaService';
import eventBus, { FINANCIAL_EVENTS } from '../utils/eventBus';

/**
 * Hook personalizado para calcular estadísticas financieras CONSOLIDADAS
 * Calcula datos de TODAS las obras con estado APROBADO y EN_EJECUCION
 * ✨ Con sincronización automática vía EventBus
 */
export const useEstadisticasConsolidadas = (empresaId, refreshTrigger, activo = true) => {
  const [estadisticas, setEstadisticas] = useState({
    totalPresupuesto: 0,
    totalCobrado: 0, // Total asignado a obras (desde cobros_obra)
    totalCobradoEmpresa: 0, // 🆕 Total cobrado a nivel empresa (desde cobros_empresa)
    saldoCobradoSinAsignar: 0, // 🆕 Saldo disponible sin asignar a rubros
    totalPagado: 0,
    totalRetirado: 0,
    saldoDisponible: 0,
    porcentajeCobrado: 0,
    porcentajePagado: 0,
    porcentajeDisponible: 0,
    cantidadObras: 0,
    cantidadCobros: 0,
    cantidadPagos: 0,
    cobrosPendientes: 0,
    pagosPendientes: 0,
    alertas: [],
    desglosePorObra: [],
    fechaUltimoCobro: null
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isLoadingRef, setIsLoadingRef] = useState(false);

  useEffect(() => {
    if (empresaId && activo) {
      cargarEstadisticasConsolidadas();
    } else if (!activo) {
      setEstadisticas({
        totalPresupuesto: 0,
        totalCobrado: 0,
        totalPagado: 0,
        totalRetirado: 0,
        saldoDisponible: 0,
        porcentajeCobrado: 0,
        porcentajePagado: 0,
        porcentajeDisponible: 0,
        cantidadObras: 0,
        cantidadCobros: 0,
        cantidadPagos: 0,
        cobrosPendientes: 0,
        pagosPendientes: 0,
        alertas: [],
        desglosePorObra: []
      });
    }
  }, [empresaId, refreshTrigger, activo]);

  useEffect(() => {
    if (!empresaId || !activo) return;

    let debounceTimer = null;

    const handleFinancialEvent = (eventData) => {
      console.log('🔔 [useEstadisticasConsolidadas] Evento financiero recibido:', eventData);

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      // Aumentar debounce a 1 segundo para reducir cargas
      debounceTimer = setTimeout(() => {
        if (!isLoadingRef) {
          console.log('🔄 [useEstadisticasConsolidadas] Recargando estadísticas consolidadas...');
          cargarEstadisticasConsolidadas();
        } else {
          console.log('⏸️ [useEstadisticasConsolidadas] Carga en progreso, ignorando evento');
        }
      }, 1000);
    };

    const unsubscribers = [
      eventBus.on(FINANCIAL_EVENTS.PAGO_REGISTRADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.PAGO_ACTUALIZADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.PAGO_ELIMINADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.PAGO_CONSOLIDADO_REGISTRADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.COBRO_REGISTRADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.COBRO_ACTUALIZADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.COBRO_ELIMINADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.CAJA_CHICA_ASIGNADA, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.GASTO_CAJA_CHICA_REGISTRADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.RETIRO_REGISTRADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.RETIRO_ANULADO, handleFinancialEvent),
      eventBus.on(FINANCIAL_EVENTS.RETIRO_ELIMINADO, handleFinancialEvent),
    ];

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribers.forEach(unsub => unsub());
    };
  }, [empresaId, activo, isLoadingRef]);

  const cargarEstadisticasConsolidadas = async () => {
    if (isLoadingRef) {
      return;
    }

    setLoading(true);
    setIsLoadingRef(true);
    setError(null);

    try {
      const [responseAprobado, responseEnEjecucion] = await Promise.all([
        api.presupuestosNoCliente.busquedaAvanzada({ estado: 'APROBADO' }, empresaId),
        api.presupuestosNoCliente.busquedaAvanzada({ estado: 'EN_EJECUCION' }, empresaId)
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

      console.log('🔍 [useEstadisticasConsolidadas] Presupuestos encontrados ANTES de cargar completos:', {
        aprobados: presupuestosAprobado.length,
        enEjecucion: presupuestosEnEjecucion.length,
        total: todosPresupuestos.length,
        ids: todosPresupuestos.map(p => ({
          id: p.id,
          estado: p.estado,
          numero: p.numeroPresupuesto,
          nombreObra: p.nombreObra
        }))
      });

      if (todosPresupuestos.length === 0) {
      setEstadisticas({
        totalPresupuesto: 0,
        totalCobrado: 0,
        totalCobradoEmpresa: 0,
        saldoCobradoSinAsignar: 0,
        totalPagado: 0,
        totalRetirado: 0,
        saldoDisponible: 0,
        porcentajeCobrado: 0,
        porcentajePagado: 0,
        porcentajeDisponible: 0,
        cantidadObras: 0,
        cantidadCobros: 0,
        cantidadPagos: 0,
        cobrosPendientes: 0,
        pagosPendientes: 0,
        alertas: [],
        desglosePorObra: [],
        fechaUltimoCobro: null
      });
        setLoading(false);
        return;
      }

      // ✅ Solo las versiones más recientes tienen estado APROBADO o EN_EJECUCION
      // No necesitamos agrupar, cada presupuesto ya es único
      console.log('🔍 [useEstadisticasConsolidadas] Presupuestos encontrados:', {
        aprobados: presupuestosAprobado.length,
        enEjecucion: presupuestosEnEjecucion.length,
        total: todosPresupuestos.length,
        ids: todosPresupuestos.map(p => ({ id: p.id, estado: p.estado, numero: p.numeroPresupuesto }))
      });

      // Obtener datos completos de cada presupuesto
      const presupuestosCompletos = await Promise.all(
        todosPresupuestos.map(p =>
          api.presupuestosNoCliente.getById(p.id, empresaId).catch(() => null)
        )
      );

      const presupuestosSinNulls = presupuestosCompletos.filter(p => p !== null);

      // 🔧 FILTRAR DUPLICADOS: Agrupar por nombre de obra y quedarse con la versión más reciente (ID más alto)
      const presupuestosMap = new Map();
      presupuestosSinNulls.forEach(p => {
        const nombreObra = p.nombreObra || `${p.direccionObraCalle || ''} ${p.direccionObraAltura || ''}`.trim();
        const numeroPresupuesto = p.numeroPresupuesto;
        const key = `${nombreObra}-${numeroPresupuesto}`;

        const existing = presupuestosMap.get(key);
        // Quedarse con el ID más alto (versión más reciente)
        if (!existing || p.id > existing.id) {
          presupuestosMap.set(key, p);
        }
      });

      const presupuestosUnicos = Array.from(presupuestosMap.values());

      console.log('💰 [useEstadisticasConsolidadas] Presupuestos completos cargados:', {
        cantidadTotal: presupuestosSinNulls.length,
        cantidadUnicos: presupuestosUnicos.length,
        eliminados: presupuestosSinNulls.length - presupuestosUnicos.length,
        obras: presupuestosUnicos.map(p => ({
          id: p.id,
          nombre: p.nombreObra,
          numero: p.numeroPresupuesto,
          estado: p.estado
        }))
      });

      let totalPresupuesto = 0;
      presupuestosUnicos.forEach((presupuesto) => {
        const totalEstePresupuesto = calcularTotalPresupuesto(presupuesto);
        console.log(`  📊 Presupuesto ${presupuesto.id} (${presupuesto.numeroPresupuesto}):`, {
          nombreObra: presupuesto.nombreObra,
          estado: presupuesto.estado,
          total: totalEstePresupuesto,
          camposDisponibles: {
            valorTotalIva: presupuesto.valorTotalIva,
            totalPresupuestoConHonorarios: presupuesto.totalPresupuestoConHonorarios,
            valorTotal: presupuesto.valorTotal,
            totalPresupuesto: presupuesto.totalPresupuesto,
            totalFinal: presupuesto.totalFinal,
            montoTotal: presupuesto.montoTotal,
            totalHonorariosCalculado: presupuesto.totalHonorariosCalculado
          },
          campoUsado: presupuesto.valorTotalIva ? 'valorTotalIva' :
                       presupuesto.totalPresupuestoConHonorarios ? 'totalPresupuestoConHonorarios' :
                       presupuesto.valorTotal ? 'valorTotal' :
                       presupuesto.totalPresupuesto ? 'totalPresupuesto' : 'calculado'
        });
        totalPresupuesto += totalEstePresupuesto;
      });

      console.log('✅ [useEstadisticasConsolidadas] Total Presupuesto Consolidado (base):', totalPresupuesto);

      // 🔧 Sumar trabajos extra al presupuesto total
      let totalTrabajosExtra = 0;
      const obraIds = presupuestosUnicos.map(p => p.obraId || p.direccionObraId).filter(Boolean);

      console.log('🔍 DIAGNÓSTICO TRABAJOS EXTRA - Presupuestos únicos:', presupuestosUnicos.map(p => ({
        id: p.id,
        nombre: p.nombreObra,
        obraId: p.obraId,
        direccionObraId: p.direccionObraId,
        usado: p.obraId || p.direccionObraId
      })));
      console.log('🔍 DIAGNÓSTICO TRABAJOS EXTRA - ObraIds extraídos:', obraIds);
      console.log('🔍 DIAGNÓSTICO TRABAJOS EXTRA - Cantidad de obras:', obraIds.length);

      if (obraIds.length > 0) {
        try {
          console.log('🔧 Cargando trabajos extra para calcular presupuesto total...');
          const trabajosExtraPromises = obraIds.map(async (obraId) => {
            try {
              const response = await api.trabajosExtra.getAll(empresaId, { obraId });
              const trabajos = Array.isArray(response) ? response : response?.data || [];

              console.log(`🔍 DIAGNÓSTICO - Obra ${obraId}: Trabajos extra cargados:`, trabajos.length, trabajos.map(t => ({ id: t.id, nombre: t.nombre })));

              // Cargar detalle completo de cada trabajo para obtener totalCalculado correcto
              const trabajosConTotal = await Promise.all(trabajos.map(async (trabajo) => {
                try {
                  const fullResponse = await api.trabajosExtra.getById(trabajo.id, empresaId);
                  const fullTrabajo = fullResponse.data || fullResponse;
                  return fullTrabajo;
                } catch (err) {
                  return trabajo;
                }
              }));

              const totalObra = trabajosConTotal.reduce((sum, t) => {
                // Función auxiliar para parsear montos
                const parseMontoLocal = (val) => {
                  if (typeof val === 'number') return val;
                  if (!val) return 0;
                  let str = String(val).trim().replace(/[^0-9.,-]/g, '');
                  if (str.includes(',')) {
                    str = str.replace(/\./g, '').replace(',', '.');
                  }
                  return parseFloat(str) || 0;
                };

                // Si tiene itemsCalculadora, calcular con honorarios y MC
                if (t.itemsCalculadora && Array.isArray(t.itemsCalculadora) && t.itemsCalculadora.length > 0) {
                  // Calcular subtotales por categoría
                  let subtotalJornales = 0;
                  let subtotalMateriales = 0;
                  let subtotalOtros = 0;

                  t.itemsCalculadora.forEach((item) => {
                    let jorItem = parseMontoLocal(item.subtotalManoObra) || 0;
                    if (jorItem === 0 && item.jornales && Array.isArray(item.jornales)) {
                      jorItem = item.jornales.reduce((s, j) => s + (parseMontoLocal(j.subtotal) || parseMontoLocal(j.importe) || 0), 0);
                    }
                    subtotalJornales += jorItem;
                    subtotalMateriales += parseMontoLocal(item.subtotalMateriales) || 0;
                    subtotalOtros += parseMontoLocal(item.subtotalGastosGenerales) || 0;
                  });

                  const subtotalBase = subtotalJornales + subtotalMateriales + subtotalOtros;

                  // Aplicar honorarios
                  let totalHonorarios = 0;
                  if (t.honorarios && typeof t.honorarios === 'object') {
                    const conf = t.honorarios;
                    if (conf.jornalesActivo && conf.jornalesValor) {
                      totalHonorarios += subtotalJornales * (parseFloat(conf.jornalesValor) / 100);
                    }
                    if (conf.materialesActivo && conf.materialesValor) {
                      totalHonorarios += subtotalMateriales * (parseFloat(conf.materialesValor) / 100);
                    }
                    if (conf.otrosCostosActivo && conf.otrosCostosValor) {
                      totalHonorarios += subtotalOtros * (parseFloat(conf.otrosCostosValor) / 100);
                    }
                  }

                  // Aplicar mayores costos
                  let totalMC = 0;
                  if (t.mayoresCostos && typeof t.mayoresCostos === 'object') {
                    const conf = t.mayoresCostos;
                    if (conf.jornalesActivo && conf.jornalesValor) {
                      totalMC += subtotalJornales * (parseFloat(conf.jornalesValor) / 100);
                    }
                    if (conf.materialesActivo && conf.materialesValor) {
                      totalMC += subtotalMateriales * (parseFloat(conf.materialesValor) / 100);
                    }
                    if (conf.otrosCostosActivo && conf.otrosCostosValor) {
                      totalMC += subtotalOtros * (parseFloat(conf.otrosCostosValor) / 100);
                    }
                    if (conf.honorariosActivo && conf.honorariosValor && totalHonorarios > 0) {
                      totalMC += totalHonorarios * (parseFloat(conf.honorariosValor) / 100);
                    }
                  }

                  return sum + subtotalBase + totalHonorarios + totalMC;
                }

                // Fallback: usar valor de BD
                const total = parseFloat(t.totalFinal) || parseFloat(t.montoTotal) || parseFloat(t.totalCalculado) || 0;
                return sum + total;
              }, 0);

              console.log(`🔧 Obra ${obraId}: ${trabajosConTotal.length} trabajo(s) extra = $${totalObra.toLocaleString()}`);
              console.log(`🔍 DIAGNÓSTICO - Detalle cálculo obra ${obraId}:`, trabajosConTotal.map(t => ({
                nombre: t.nombre,
                itemsCalculadora: t.itemsCalculadora?.length || 0,
                totalFinal: t.totalFinal,
                totalCalculado: t.totalCalculado
              })));
              return totalObra;
            } catch (error) {
              console.warn(`⚠️ Error cargando trabajos extra de obra ${obraId}:`, error);
              return 0;
            }
          });

          const totalesPorObra = await Promise.all(trabajosExtraPromises);
          totalTrabajosExtra = totalesPorObra.reduce((sum, total) => sum + total, 0);

          console.log('✅ Total de trabajos extra:', totalTrabajosExtra.toLocaleString());
          console.log('🔍 DIAGNÓSTICO - Total Presupuesto ANTES de sumar trabajos extra:', totalPresupuesto.toLocaleString());
          totalPresupuesto += totalTrabajosExtra;
          console.log('🔍 DIAGNÓSTICO - Total Presupuesto DESPUÉS de sumar trabajos extra:', totalPresupuesto.toLocaleString());
          console.log('✅ Total Presupuesto FINAL (base + trabajos extra):', totalPresupuesto.toLocaleString());
        } catch (error) {
          console.warn('⚠️ Error cargando trabajos extra para presupuesto:', error);
        }
      } else {
        console.warn('⚠️ DIAGNÓSTICO - No se encontraron obraIds para cargar trabajos extra. Presupuestos:', presupuestosUnicos.map(p => ({
          id: p.id,
          nombre: p.nombreObra,
          obraId: p.obraId,
          direccionObraId: p.direccionObraId
        })));
      }

      // 🆕 Obtener honorarios reales de todas las obras
      let honorariosPorObra = {};
      if (obraIds.length > 0) {
        try {
          const honorariosResponse = await api.presupuestosNoCliente.getHonorariosPorObras(obraIds, empresaId);
          const honorariosArray = Array.isArray(honorariosResponse) ? honorariosResponse : honorariosResponse?.data || [];
          honorariosPorObra = honorariosArray.reduce((map, h) => {
            map[h.obraId] = parseFloat(h.totalHonorarios || 0);
            return map;
          }, {});
          console.log('✅ [useEstadisticasConsolidadas] Honorarios cargados:', honorariosPorObra);
        } catch (err) {
          console.warn('⚠️ [useEstadisticasConsolidadas] Error cargando honorarios:', err);
        }
      }

      let totalCobrado = 0;
      let cantidadCobros = 0;
      let cobrosPendientes = 0;
      // Importar y sumar los cobros reales por cada obra
      const desglosePorObra = [];

      // 🆕 Primero obtener TODOS los cobros de la empresa
      let todosLosCobros = [];
      try {
        const response = await api.get('/api/v1/cobros-obra', { params: { empresaId } });
        todosLosCobros = Array.isArray(response) ? response :
          response?.data ? response.data :
          response?.cobros ? response.cobros : [];
        console.log(`📥 Total de cobros en la empresa: ${todosLosCobros.length}`, todosLosCobros);

        // 🔍 LOG DETALLADO: Ver estructura del primer cobro para debugging
        if (todosLosCobros.length > 0) {
          console.log('🔍 ESTRUCTURA DEL PRIMER COBRO:', JSON.stringify(todosLosCobros[0], null, 2));
          console.log('🔍 Campos disponibles en cobro:', Object.keys(todosLosCobros[0]));
        }
      } catch (error) {
        console.warn(`⚠️ Error cargando cobros de la empresa:`, error);
      }

      // ⚠️ NOTA: Este endpoint devuelve ASIGNACIONES de cobros a obras ($18M), NO el cobro original ($30M)
      // El valor correcto de totalCobrado viene de /api/v1/cobros-empresa/resumen (línea ~612)
      const cobrosCobrados = todosLosCobros.filter(c => c.estado === 'COBRADO' || c.estado === 'cobrado');
      const cobrosPendientesArray = todosLosCobros.filter(c => c.estado === 'PENDIENTE' || c.estado === 'pendiente');

      const totalAsignacionesCobros = cobrosCobrados.reduce((sum, c) => sum + (parseFloat(c.monto) || 0), 0);
      const totalPendiente = cobrosPendientesArray.reduce((sum, c) => sum + (parseFloat(c.monto) || 0), 0);

      cantidadCobros = todosLosCobros.length;
      cobrosPendientes = cobrosPendientesArray.length;

      console.log('💰 ANÁLISIS DE ASIGNACIONES DE COBROS (NO es el cobro total):', {
        totalAsignacionesEnBD: todosLosCobros.length,
        asignacionesCOBRADAS: {
          cantidad: cobrosCobrados.length,
          monto: totalAsignacionesCobros
        },
        asignacionesPENDIENTES: {
          cantidad: cobrosPendientesArray.length,
          monto: totalPendiente
        },
        TOTAL_ASIGNACIONES: totalAsignacionesCobros + totalPendiente,
        NOTA: 'Este valor ($18M) es MENOR que el cobro total ($30M) porque el resto está sin asignar',
        detalleCobros: todosLosCobros.map(c => ({
          id: c.id,
          monto: parseFloat(c.monto),
          estado: c.estado,
          obraId: c.obraId,
          presupuestoId: c.presupuestoNoClienteId,
          fecha: c.fechaCobro
        }))
      });

      // Obtener la fecha del último cobro (más reciente)
      const fechaUltimoCobro = cobrosCobrados.length > 0
        ? cobrosCobrados.sort((a, b) => new Date(b.fechaCobro || b.fechaCreacion) - new Date(a.fechaCobro || a.fechaCreacion))[0].fechaCobro || cobrosCobrados[0].fechaCreacion
        : null;

      console.log(`✅ Total de ASIGNACIONES de cobros: $${totalAsignacionesCobros.toLocaleString()} (NO es el total cobrado real)`);
      if (fechaUltimoCobro) console.log(`📅 Fecha del último cobro: ${fechaUltimoCobro}`);

      // 🆕 Obtener TODAS las asignaciones de la empresa una sola vez
      let todasLasAsignaciones = [];
      try {
        const { obtenerTodasAsignaciones } = await import('../services/asignacionesCobroObraService');
        todasLasAsignaciones = await obtenerTodasAsignaciones(empresaId);
        console.log(`📦 Total de asignaciones en la empresa: ${todasLasAsignaciones.length}`, todasLasAsignaciones);

        // 🔍 Log detallado de cada asignación para debugging
        if (todasLasAsignaciones.length > 0) {
          console.log('🔍 ASIGNACION COMPLETA:', JSON.stringify(todasLasAsignaciones[0], null, 2));

          console.log('🔍 IDs de presupuestos a buscar:', presupuestosUnicos.map(p => ({
            id: p.id,
            nombre: p.nombreObra,
            obraId: p.obraId,
            direccionObraId: p.direccionObraId
          })));
        }
      } catch (error) {
        console.warn(`⚠️ Error cargando asignaciones de la empresa:`, error);
      }

      // 🆕 Ahora calcular por obra filtrando los cobros reales
      for (const presupuesto of presupuestosUnicos) {
        const nombreObra = presupuesto.nombreObra || `${presupuesto.direccionObraCalle || ''} ${presupuesto.direccionObraAltura || ''}`.trim() || `Presupuesto #${presupuesto.numeroPresupuesto || presupuesto.id}`;
        const totalPresupuestoObra = calcularTotalPresupuesto(presupuesto);
        let totalCobradoObra = 0;
        let cantidadCobrosObra = 0;
        let cobrosPendientesObra = 0;

        console.log(`🏗️ Obra "${nombreObra}" - Presupuesto ID: ${presupuesto.id}, Obra ID del presupuesto: ${presupuesto.obraId}`);
        console.log(`  🔍 Total de cobros en sistema: ${todosLosCobros.length}`);

        // 🔥 FILTRAR COBROS REALES de esta obra (no asignaciones)
        const cobrosObra = todosLosCobros.filter(c =>
          c.obraId === presupuesto.obraId || c.presupuestoNoClienteId === presupuesto.id
        );

        console.log(`  📊 Cobros encontrados para esta obra: ${cobrosObra.length}`, cobrosObra);

        if (cobrosObra.length > 0) {
          console.log('  Detalle de cobros:', cobrosObra.map(c => ({
            id: c.id,
            monto: c.monto,
            montoParsed: parseFloat(c.monto),
            estado: c.estado,
            fechaCobro: c.fechaCobro,
            presupuestoNoClienteId: c.presupuestoNoClienteId,
            obraId: c.obraId
          })));
        }

        // Sumar solo los cobros COBRADOS de esta obra
        const cobrosCobradosObra = cobrosObra.filter(c => c.estado === 'COBRADO' || c.estado === 'cobrado');
        console.log(`  📌 Cobros cobrados:`, cobrosCobradosObra.length);

        totalCobradoObra = cobrosCobradosObra
          .reduce((sum, c) => {
            const monto = parseFloat(c.monto) || 0;
            console.log(`    Sumando cobro ${c.id}: $${monto.toLocaleString()} (acumulado: $${(sum + monto).toLocaleString()})`);
            return sum + monto;
          }, 0);

        cantidadCobrosObra = cobrosObra.length;
        cobrosPendientesObra = cobrosObra.filter(c => c.estado === 'PENDIENTE' || c.estado === 'pendiente').length;

        console.log(`  💵 Total cobrado de esta obra: $${totalCobradoObra.toLocaleString()}`);

        // Obtener trabajos extra de esta obra
        let trabajosExtraObra = [];
        try {
          const obraId = presupuesto.obraId || presupuesto.direccionObraId;
          if (obraId) {
            const responseTE = await api.trabajosExtra.getAll(empresaId, { obraId });
            const trabajos = Array.isArray(responseTE) ? responseTE : responseTE?.data || [];

            trabajosExtraObra = await Promise.all(trabajos.map(async (t) => {
              try {
                const fullResponse = await api.trabajosExtra.getById(t.id, empresaId);
                const fullTrabajo = fullResponse.data || fullResponse;

                // Calcular total con la misma lógica de RegistrarPagoConsolidadoModal
                let totalCalculado = 0;
                let totalHonorarios = 0; // Inicializar fuera del if

                if (fullTrabajo.itemsCalculadora && Array.isArray(fullTrabajo.itemsCalculadora) && fullTrabajo.itemsCalculadora.length > 0) {
                  const parseMontoLocal = (val) => {
                    if (typeof val === 'number') return val;
                    if (!val) return 0;
                    let str = String(val).trim().replace(/[^0-9.,-]/g, '');
                    if (str.includes(',')) str = str.replace(/\./g, '').replace(',', '.');
                    return parseFloat(str) || 0;
                  };

                  let subtotalJornales = 0, subtotalMateriales = 0, subtotalOtros = 0;
                  fullTrabajo.itemsCalculadora.forEach((item) => {
                    let jorItem = parseMontoLocal(item.subtotalManoObra) || 0;
                    if (jorItem === 0 && item.jornales && Array.isArray(item.jornales)) {
                      jorItem = item.jornales.reduce((s, j) => s + (parseMontoLocal(j.subtotal) || parseMontoLocal(j.importe) || 0), 0);
                    }
                    subtotalJornales += jorItem;
                    subtotalMateriales += parseMontoLocal(item.subtotalMateriales) || 0;
                    subtotalOtros += parseMontoLocal(item.subtotalGastosGenerales) || 0;
                  });

                  const subtotalBase = subtotalJornales + subtotalMateriales + subtotalOtros;
                  if (fullTrabajo.honorarios && typeof fullTrabajo.honorarios === 'object') {
                    const conf = fullTrabajo.honorarios;
                    if (conf.jornalesActivo && conf.jornalesValor) totalHonorarios += subtotalJornales * (parseFloat(conf.jornalesValor) / 100);
                    if (conf.materialesActivo && conf.materialesValor) totalHonorarios += subtotalMateriales * (parseFloat(conf.materialesValor) / 100);
                    if (conf.otrosCostosActivo && conf.otrosCostosValor) totalHonorarios += subtotalOtros * (parseFloat(conf.otrosCostosValor) / 100);
                  }

                  let totalMC = 0;
                  if (fullTrabajo.mayoresCostos && typeof fullTrabajo.mayoresCostos === 'object') {
                    const conf = fullTrabajo.mayoresCostos;
                    if (conf.jornalesActivo && conf.jornalesValor) totalMC += subtotalJornales * (parseFloat(conf.jornalesValor) / 100);
                    if (conf.materialesActivo && conf.materialesValor) totalMC += subtotalMateriales * (parseFloat(conf.materialesValor) / 100);
                    if (conf.otrosCostosActivo && conf.otrosCostosValor) totalMC += subtotalOtros * (parseFloat(conf.otrosCostosValor) / 100);
                    if (conf.honorariosActivo && conf.honorariosValor && totalHonorarios > 0) totalMC += totalHonorarios * (parseFloat(conf.honorariosValor) / 100);
                  }

                  totalCalculado = subtotalBase + totalHonorarios + totalMC;
                } else {
                  totalCalculado = parseFloat(fullTrabajo.totalFinal) || parseFloat(fullTrabajo.montoTotal) || 0;
                }

                console.log(`🔍 [TE: ${fullTrabajo.nombre}] totalHonorarios = ${totalHonorarios}, totalCalculado = ${totalCalculado}`);

                return {
                  id: fullTrabajo.id,
                  nombre: fullTrabajo.nombre,
                  totalCalculado: totalCalculado,
                  totalHonorarios: totalHonorarios  // 🆕 Incluir honorarios calculados
                };
              } catch (err) {
                console.error(`❌ Error procesando trabajo extra ${t.id}:`, err);
                return { id: t.id, nombre: t.nombre, totalCalculado: parseFloat(t.totalFinal) || 0, totalHonorarios: 0 };
              }
            }));
          }
        } catch (error) {
          console.warn(`⚠️ Error cargando trabajos extra de obra ${presupuesto.obraId}:`, error);
        }

        // 🆕 Calcular totales distribuidos por ítems de esta obra
        const asignacionesObra = todasLasAsignaciones.filter(a =>
          (a.obraId === presupuesto.obraId || a.presupuestoNoClienteId === presupuesto.id) &&
          (a.estado === 'ACTIVA' || a.estado === 'activa')
        );

        let montoProfesionales = 0;
        let montoMateriales = 0;
        let montoGastosGenerales = 0;
        let montoTrabajosExtra = 0;

        console.log(`📊 [${nombreObra}] Calculando distribución por ítems:`, {
          obraId: presupuesto.obraId,
          presupuestoId: presupuesto.id,
          totalAsignacionesEmpresa: todasLasAsignaciones.length,
          asignacionesObra: asignacionesObra.length,
          asignaciones: asignacionesObra
        });

        asignacionesObra.forEach(asig => {
          montoProfesionales += parseFloat(asig.montoProfesionales || 0);
          montoMateriales += parseFloat(asig.montoMateriales || 0);
          montoGastosGenerales += parseFloat(asig.montoGastosGenerales || 0);
          montoTrabajosExtra += parseFloat(asig.montoTrabajosExtra || 0);
        });

        console.log(`💰 [${nombreObra}] Totales distribuidos:`, {
          montoProfesionales,
          montoMateriales,
          montoGastosGenerales,
          montoTrabajosExtra,
          total: montoProfesionales + montoMateriales + montoGastosGenerales + montoTrabajosExtra
        });

        // 🆕 Calcular honorarios totales incluyendo trabajos extra
        const honorariosBase = honorariosPorObra[presupuesto.obraId || presupuesto.direccionObraId] || parseFloat(presupuesto.totalHonorarios || 0);
        const honorariosTrabajosExtra = trabajosExtraObra.reduce((sum, te) => sum + (parseFloat(te.totalHonorarios) || 0), 0);
        const totalHonorariosConTE = honorariosBase + honorariosTrabajosExtra;

        console.log(`🎯 [${nombreObra}] HONORARIOS:`, {
          honorariosBase: honorariosBase.toLocaleString(),
          cantidadTrabajosExtra: trabajosExtraObra.length,
          trabajosExtra: trabajosExtraObra.map(te => ({
            nombre: te.nombre,
            totalHonorarios: te.totalHonorarios
          })),
          honorariosTrabajosExtra: honorariosTrabajosExtra.toLocaleString(),
          totalHonorariosConTE: totalHonorariosConTE.toLocaleString()
        });

        desglosePorObra.push({
          id: presupuesto.id,
          obraId: presupuesto.obraId || presupuesto.direccionObraId,
          nombreObra,
          numeroPresupuesto: presupuesto.numeroPresupuesto,
          estado: presupuesto.estado,
          totalPresupuesto: totalPresupuestoObra,
          totalHonorarios: totalHonorariosConTE,
          totalCobrado: totalCobradoObra,
          cantidadCobros: cantidadCobrosObra,
          cobrosPendientes: cobrosPendientesObra,
          totalPagado: 0,
          cantidadPagos: 0,
          pagosPendientes: 0,
          trabajosExtra: trabajosExtraObra,
          // 🆕 Totales distribuidos por ítems
          montoProfesionales,
          montoMateriales,
          montoGastosGenerales,
          montoTrabajosExtra
        });
      }

      // 🔍 IDENTIFICAR COBROS HUÉRFANOS (no asignados a ninguna obra)
      const totalCobradoPorObras = desglosePorObra.reduce((sum, o) => sum + o.totalCobrado, 0);
      const diferenciaCobros = totalCobrado - totalCobradoPorObras;

      console.log('🔍 ANÁLISIS DE COBROS:', {
        totalCobradoEmpresa: totalCobrado,
        totalCobradoSumaObras: totalCobradoPorObras,
        diferencia: diferenciaCobros,
        cantidadObras: desglosePorObra.length,
        desgloseCobros: desglosePorObra.map(o => ({
          obra: o.nombreObra,
          cobrado: o.totalCobrado
        }))
      });

      if (diferenciaCobros > 0) {
        console.warn('⚠️ HAY COBROS NO ASIGNADOS A NINGUNA OBRA:');
        console.log('  Total cobrado (empresa):', totalCobrado.toLocaleString());
        console.log('  Total cobrado (suma obras):', totalCobradoPorObras.toLocaleString());
        console.log('  Diferencia (cobros huérfanos):', diferenciaCobros.toLocaleString());

        // Obtener IDs de obras existentes
        const obrasIds = presupuestosUnicos.map(p => p.obraId);
        const presupuestosIds = presupuestosUnicos.map(p => p.id);

        // Encontrar cobros que NO pertenecen a ninguna obra
        const cobrosHuerfanos = todosLosCobros.filter(c => {
          const esEstadoCobrado = c.estado === 'COBRADO' || c.estado === 'cobrado';
          const noTieneObraValida = !obrasIds.includes(c.obraId);
          const noTienePresupuestoValido = !presupuestosIds.includes(c.presupuestoNoClienteId);
          return esEstadoCobrado && noTieneObraValida && noTienePresupuestoValido;
        });

        console.log('  Cobros huérfanos encontrados:', cobrosHuerfanos.length);
        console.table(cobrosHuerfanos.map(c => ({
          id: c.id,
          monto: parseFloat(c.monto),
          estado: c.estado,
          obraId: c.obraId,
          presupuestoNoClienteId: c.presupuestoNoClienteId,
          fechaCobro: c.fechaCobro,
          descripcion: c.descripcion || c.observaciones
        })));
      }

      let totalPagado = 0;
      let cantidadPagos = 0;
      let pagosPendientes = 0;

      // 🔥 USAR ENDPOINT DE RESUMEN FINANCIERO POR OBRA
      console.log('💰 Obteniendo resúmenes financieros de cada obra...');

      const resumenesPromises = presupuestosUnicos.map(async (presupuesto) => {
        try {
          const obraId = presupuesto.obraId || presupuesto.direccionObraId;
          console.log(`  📊 Obteniendo resumen financiero de obra ${obraId}...`);
          const resumen = await api.get(`/api/v1/obras-financiero/${obraId}/resumen`, { empresaId });
          console.log(`  ✅ Obra ${obraId} (${resumen.nombreObra}):`, {
            totalPagadoGeneral: resumen.totalPagadoGeneral,
            totalPagadoProfesionales: resumen.totalPagadoProfesionales,
            totalPagadoMateriales: resumen.totalPagadoMateriales,
            totalPagadoGastosGenerales: resumen.totalPagadoGastosGenerales
          });
          return resumen;
        } catch (error) {
          const obraId = presupuesto.obraId || presupuesto.direccionObraId;
          console.error(`  ❌ Error 400 obteniendo resumen de obra ${obraId}:`, {
            status: error.response?.status,
            statusText: error.response?.statusText,
            mensaje: error.response?.data,
            url: `/api/v1/obras-financiero/${obraId}/resumen?empresaId=${empresaId}`,
            error: error
          });
          return null;
        }
      });

      const resumenes = await Promise.all(resumenesPromises);
      const resumenesSinNulls = resumenes.filter(r => r !== null);

      // Sumar totales de todas las obras (sin trabajos extra aún)
      totalPagado = resumenesSinNulls.reduce((sum, r) => sum + (r.totalPagadoGeneral || 0), 0);

      // 🔧 AGREGAR PAGOS DE TRABAJOS EXTRA
      console.log('🔧 Obteniendo pagos de trabajos extra...');
      let totalPagadoTrabajosExtra = 0;
      let pagosTrabajosExtraPorObra = {}; // 🆕 Mapa de obraId -> total pagado en trabajos extra

      try {
        const pagosTrabajosExtra = await api.pagosTrabajoExtra.getByEmpresa(empresaId);
        console.log(`  ✅ ${pagosTrabajosExtra.length} pagos de trabajos extra encontrados`);
        console.log(`  🔍 Estructura del primer pago:`, pagosTrabajosExtra[0]);

        totalPagadoTrabajosExtra = pagosTrabajosExtra
          .filter(p => p.estado === 'PAGADO')
          .reduce((sum, p) => sum + (parseFloat(p.montoFinal) || 0), 0);

        // 🆕 Agrupar pagos por obra
        pagosTrabajosExtra
          .filter(p => p.estado === 'PAGADO')
          .forEach(pago => {
            const obraId = pago.trabajoExtra?.obraId || pago.obraId;
            console.log(`  🔍 Procesando pago ID ${pago.id}: obraId=${obraId}, monto=${pago.montoFinal}`);

            if (obraId) {
              if (!pagosTrabajosExtraPorObra[obraId]) {
                pagosTrabajosExtraPorObra[obraId] = 0;
                console.log(`    ✅ Inicializado pagosTrabajosExtraPorObra[${obraId}] = 0`);
              }
              pagosTrabajosExtraPorObra[obraId] += parseFloat(pago.montoFinal) || 0;
              console.log(`    ✅ Sumado $${pago.montoFinal} a obra ${obraId}. Total: $${pagosTrabajosExtraPorObra[obraId]}`);
            } else {
              console.log(`    ⚠️ No se encontró obraId para pago ID ${pago.id}`);
            }
          });

        console.log(`  💰 Total pagado en trabajos extra: $${totalPagadoTrabajosExtra.toLocaleString('es-AR')}`);
        console.log(`  📊 Pagos de trabajos extra por obra:`, pagosTrabajosExtraPorObra);

        // Sumar trabajos extra al total general
        totalPagado += totalPagadoTrabajosExtra;
      } catch (error) {
        console.warn('⚠️ No se pudieron cargar pagos de trabajos extra:', error);
      }

      console.log(`💰 TOTAL PAGADO CONSOLIDADO (CON TRABAJOS EXTRA): $${totalPagado.toLocaleString('es-AR')}`);
      console.log(`  📊 Desglose:`, {
        profesionales: resumenesSinNulls.reduce((sum, r) => sum + (r.totalPagadoProfesionales || 0), 0),
        materiales: resumenesSinNulls.reduce((sum, r) => sum + (r.totalPagadoMateriales || 0), 0),
        gastosGenerales: resumenesSinNulls.reduce((sum, r) => sum + (r.totalPagadoGastosGenerales || 0), 0),
        trabajosExtra: totalPagadoTrabajosExtra
      });

      // 🆕 CONTAR PAGOS REALES REGISTRADOS
      console.log('📊 Obteniendo cantidad de pagos reales registrados...');
      let pagosPorObra = {}; // Mapa obraId -> cantidad de pagos

      try {
        // Importar y consultar servicios de pagos
        const { listarPagosPorObra } = await import('../services/pagosProfesionalObraService');
        const { listarPagosConsolidadosPorEmpresa } = await import('../services/pagosConsolidadosService');

        // Obtener pagos consolidados por empresa
        const pagosConsolidados = await listarPagosConsolidadosPorEmpresa(empresaId);
        console.log(`  ✅ ${pagosConsolidados.length} pagos consolidados encontrados`);

        // Contar pagos por obra
        pagosConsolidados.forEach(pago => {
          if (pago.obraId) {
            pagosPorObra[pago.obraId] = (pagosPorObra[pago.obraId] || 0) + 1;
          }
        });

        // Actualizar cantidadPagos total
        cantidadPagos = pagosConsolidados.length;

        console.log('  📋 Pagos por obra:', pagosPorObra);
        console.log(`  📊 Total de pagos registrados: ${cantidadPagos}`);
      } catch (error) {
        console.warn('⚠️ Error al obtener pagos reales:', error);
      }

      // Actualizar desglose por obra con pagos de trabajos extra y cantidad de pagos
      resumenesSinNulls.forEach(resumen => {
        const obraDesglose = desglosePorObra.find(o => {
          const matchId = o.id === resumen.presupuestoId;
          const matchNombre = o.nombreObra === resumen.nombreObra;
          return matchId || matchNombre;
        });

        if (obraDesglose) {
          const pagadoTrabajosExtraObra = pagosTrabajosExtraPorObra[obraDesglose.obraId] || 0;
          obraDesglose.totalPagado = (resumen.totalPagadoGeneral || 0) + pagadoTrabajosExtraObra;
          obraDesglose.cantidadPagos = pagosPorObra[obraDesglose.obraId] || 0; // 🆕 Agregar cantidad real
        }
      });

      // console.log('🌐 [useEstadisticasConsolidadas] RESUMEN CONSOLIDADO:', {
        // cantidadObras: todosPresupuestos.length,
        // totalPagado,
        // cantidadPagos,
        // desglosePorObra: desglosePorObra.map(o => ({
        //   id: o.id,
        //   nombreObra: o.nombreObra,
        //   totalPagado: o.totalPagado,
        //   cantidadPagos: o.cantidadPagos
        // }))
      // });

      // 🆕 Obtener retiros por obra y total retirado
      let totalRetirado = 0;
      let retirosPorObra = {}; // Mapa obraId -> totalRetirado
      let retirosGenerales = 0; // Retiros sin obra específica
      try {
        const { listarRetiros } = await import('../services/retirosPersonalesService');
        const todosLosRetiros = await listarRetiros(empresaId);

        // Calcular total retirado
        totalRetirado = todosLosRetiros
          .filter(r => r.estado !== 'ANULADO')
          .reduce((sum, r) => sum + (parseFloat(r.monto) || 0), 0);

        // Separar retiros por obra y retiros generales
        todosLosRetiros
          .filter(r => r.estado !== 'ANULADO')
          .forEach(retiro => {
            const monto = parseFloat(retiro.monto) || 0;

            // Si tiene obra específica (obraId existe y no es null)
            if (retiro.obraId) {
              const obraId = retiro.obraId;
              if (!retirosPorObra[obraId]) {
                retirosPorObra[obraId] = 0;
              }
              retirosPorObra[obraId] += monto;
            } else {
              // Retiro general (obra_id es NULL en BD)
              retirosGenerales += monto;
            }
          });

        console.log('💰 [useEstadisticasConsolidadas] Total retirado:', totalRetirado);
        console.log('💰 [useEstadisticasConsolidadas] Retiros por obra:', retirosPorObra);
        console.log('💰 [useEstadisticasConsolidadas] Retiros generales (sin obra):', retirosGenerales);
      } catch (error) {
        console.error('❌ Error obteniendo retiros:', error);
        totalRetirado = 0;
        retirosPorObra = {};
        retirosGenerales = 0;
      }

      // 🆕 Obtener totales de cobros a nivel empresa
      let totalCobradoEmpresa = 0;
      let saldoDisponibleEmpresa = 0;
      try {
        const resumenEmpresa = await obtenerResumenCobrosEmpresa(empresaId);
        totalCobradoEmpresa = parseFloat(resumenEmpresa?.totalCobrado || 0);
        saldoDisponibleEmpresa = parseFloat(resumenEmpresa?.totalDisponible || 0);
        console.log('💰 [useEstadisticasConsolidadas] Cobros empresa:', {
          totalCobrado: totalCobradoEmpresa,
          totalAsignado: resumenEmpresa?.totalAsignado,
          totalDisponible: saldoDisponibleEmpresa
        });
      } catch (error) {
        console.error('❌ Error obteniendo cobros empresa (backend no implementado):', error.message);
        // 🔄 FALLBACK TEMPORAL: Usar totalCobrado de obras hasta que se implemente el backend
        console.warn('⚠️ Usando totalCobrado de obras como fallback temporal');
        totalCobradoEmpresa = 0; // Se usará totalCobrado en su lugar
        saldoDisponibleEmpresa = 0;
      }

      // 🆕 Calcular total asignado de cobros a rubros
      let totalAsignado = 0;
      try {
        totalAsignado = todasLasAsignaciones
          .filter(a => a.estado === 'ACTIVA' || a.estado === 'activa')
          .reduce((sum, a) => sum + (parseFloat(a.montoAsignado) || 0), 0);
        console.log('💰 [useEstadisticasConsolidadas] Total asignado a rubros:', totalAsignado);
      } catch (error) {
        console.error('❌ Error calculando total asignado:', error);
        totalAsignado = 0;
      }

      const saldoDisponible = totalCobradoEmpresa - totalPagado - totalRetirado; // 🔥 Usar totalCobradoEmpresa
      const saldoCobradoSinAsignar = saldoDisponibleEmpresa; // 🔥 Usar el valor del endpoint
      const porcentajeCobrado = totalPresupuesto > 0 ? (totalCobradoEmpresa / totalPresupuesto) * 100 : 0; // 🔥 Usar totalCobradoEmpresa
      const porcentajePagado = totalPresupuesto > 0 ? (totalPagado / totalPresupuesto) * 100 : 0;
      const porcentajeDisponible = totalPresupuesto > 0 ? (saldoDisponible / totalPresupuesto) * 100 : 0;

      console.log('📊 [useEstadisticasConsolidadas] Métricas calculadas:', {
        cantidadObras: presupuestosUnicos.length,
        totalPresupuesto,
        totalCobrado,
        totalAsignado,
        saldoCobradoSinAsignar,
        totalPagado,
        totalRetirado,
        saldoDisponible,
        porcentajeCobrado: porcentajeCobrado.toFixed(2) + '%',
        porcentajePagado: porcentajePagado.toFixed(2) + '%',
        porcentajeDisponible: porcentajeDisponible.toFixed(2) + '%',
        obrasDesglose: desglosePorObra.map(o => o.nombreObra)
      });

      // 🔧 Calcular saldoDisponible para cada obra (cobrado - pagado - retirado de esa obra específica)
      // 🆕 Distribuir retiros generales proporcionalmente entre todas las obras
      const cantidadObras = desglosePorObra.length;
      const retiroGeneralPorObra = cantidadObras > 0 ? retirosGenerales / cantidadObras : 0;

      const desglosePorObraConSaldo = desglosePorObra.map(obra => {
        const retiradoObraEspecifico = retirosPorObra[obra.obraId] || 0;
        const retiradoObraTotal = retiradoObraEspecifico + retiroGeneralPorObra;
        const saldoDisponible = obra.totalCobrado - obra.totalPagado - retiradoObraTotal;
        return {
          ...obra,
          totalRetirado: retiradoObraTotal,
          saldoDisponible
        };
      });

      const alertas = generarAlertasConsolidadas({
        totalPresupuesto,
        totalCobrado,
        totalPagado,
        saldoDisponible,
        porcentajeCobrado,
        porcentajePagado,
        porcentajeDisponible,
        cantidadObras: presupuestosUnicos.length,
        desglosePorObra: desglosePorObraConSaldo // 🆕 Pasar desglose para alertas individuales
      });

      console.log('📊 [useEstadisticasConsolidadas] VALORES FINALES:', {
        totalCobradoEmpresa,
        saldoCobradoSinAsignar: saldoDisponibleEmpresa,
        totalCobrado: totalCobradoEmpresa,
        totalPresupuesto
      });

      console.log('🔍 DIAGNÓSTICO - VALOR A GUARDAR EN ESTADO totalPresupuesto:', totalPresupuesto.toLocaleString());

      setEstadisticas({
        totalPresupuesto,
        totalCobrado: totalCobradoEmpresa,
        totalCobradoEmpresa,
        saldoCobradoSinAsignar: saldoDisponibleEmpresa,
        totalAsignado,
        totalPagado,
        totalRetirado,
        saldoDisponible,
        porcentajeCobrado,
        porcentajePagado,
        porcentajeDisponible,
        cantidadObras: presupuestosUnicos.length,
        cantidadCobros,
        cantidadPagos,
        cobrosPendientes,
        pagosPendientes,
        alertas,
        desglosePorObra: desglosePorObraConSaldo,
        fechaUltimoCobro
      });

    } catch (err) {
      console.error('❌ Error cargando estadísticas consolidadas:', err);
      setError(err.message || 'Error al cargar estadísticas consolidadas');
    } finally {
      setLoading(false);
      setIsLoadingRef(false);
    }
  };

  return { estadisticas, loading, error, recargar: cargarEstadisticasConsolidadas };
};

const calcularTotalPresupuesto = (presupuesto) => {
  // Prioridad 1: totalFinal (campo calculado y guardado correctamente)
  if (presupuesto.totalFinal && presupuesto.totalFinal > 0) {
    console.log(`  ✅ Usando totalFinal: ${presupuesto.totalFinal}`);
    return parseFloat(presupuesto.totalFinal);
  }

  // Prioridad 2: valorTotalIva
  if (presupuesto.valorTotalIva && presupuesto.valorTotalIva > 0) {
    console.log(`  ✅ Usando valorTotalIva: ${presupuesto.valorTotalIva}`);
    return parseFloat(presupuesto.valorTotalIva);
  }

  // Prioridad 3: Calcular desde itemsCalculadora
  const itemsCalculadora = presupuesto.itemsCalculadora || [];
  if (itemsCalculadora.length > 0) {
    let totalBase = 0;

    itemsCalculadora.forEach((item) => {
      // Jornales del item (cantidadJornales * importeJornal)
      const cantidadJornales = parseFloat(item.cantidadJornales || 0);
      const importeJornal = parseFloat(item.importeJornal || 0);
      const subtotalJornales = cantidadJornales * importeJornal;
      totalBase += subtotalJornales;

      // Profesionales
      if (item.profesionales && Array.isArray(item.profesionales)) {
        item.profesionales.forEach((prof) => {
          const subtotal = parseFloat(prof.subtotal || 0);
          totalBase += subtotal;
        });
      }

      // Materiales
      if (item.materialesLista && Array.isArray(item.materialesLista)) {
        item.materialesLista.forEach((mat) => {
          const subtotal = parseFloat(mat.subtotal || 0);
          totalBase += subtotal;
        });
      }

      // Otros costos
      if (item.otrosCostos && Array.isArray(item.otrosCostos)) {
        item.otrosCostos.forEach((costo) => {
          const subtotal = parseFloat(costo.subtotal || costo.importe || 0);
          totalBase += subtotal;
        });
      }
    });

    if (totalBase > 0) {
      // 1. Aplicar honorarios sobre la base
      const porcentajeHonorarios = parseFloat(presupuesto.porcentajeHonorarios || presupuesto.porcentajeHonorariosEsperado || 0);
      const totalHonorarios = totalBase * (porcentajeHonorarios / 100);
      const subtotalConHonorarios = totalBase + totalHonorarios;

      // 2. Aplicar mayores costos sobre (base + honorarios)
      const porcentajeMayoresCostos = parseFloat(presupuesto.porcentajeMayoresCostos || 0);
      const totalMayoresCostos = subtotalConHonorarios * (porcentajeMayoresCostos / 100);

      // 3. Total final SIN IVA
      const totalFinal = subtotalConHonorarios + totalMayoresCostos;

      console.log(`  ✅ Calculado desde items: base=${totalBase}, +honorarios=${totalHonorarios} (${porcentajeHonorarios}%), subtotal=${subtotalConHonorarios}, +mayoresCostos=${totalMayoresCostos} (${porcentajeMayoresCostos}%), TOTAL=${totalFinal}`);
      return totalFinal;
    }
  }

  // Prioridad 3: totalPresupuestoConHonorarios (puede no incluir IVA)
  if (presupuesto.totalPresupuestoConHonorarios && presupuesto.totalPresupuestoConHonorarios > 0) {
    console.log(`  ✅ Usando totalPresupuestoConHonorarios: ${presupuesto.totalPresupuestoConHonorarios}`);
    return parseFloat(presupuesto.totalPresupuestoConHonorarios);
  }

  // Prioridad 4: valorTotal
  if (presupuesto.valorTotal && presupuesto.valorTotal > 0) {
    console.log(`  ✅ Usando valorTotal: ${presupuesto.valorTotal}`);
    return parseFloat(presupuesto.valorTotal);
  }

  // Prioridad 5: totalPresupuesto + honorarios
  if (presupuesto.totalPresupuesto && presupuesto.totalPresupuesto > 0) {
    const total = parseFloat(presupuesto.totalPresupuesto) + parseFloat(presupuesto.totalHonorariosCalculado || 0);
    console.log(`  ✅ Usando totalPresupuesto + honorarios: ${total}`);
    return total;
  }

  console.warn(`  ⚠️ No se pudo calcular total para presupuesto ${presupuesto.id}`);
  return 0;
};

const generarAlertasConsolidadas = (metricas) => {
  console.log('🚨 generarAlertasConsolidadas recibió:', metricas);

  const alertas = [];
  const {
    totalPresupuesto,
    totalCobrado,
    totalPagado,
    saldoDisponible,
    porcentajeCobrado,
    porcentajePagado,
    porcentajeDisponible,
    cantidadObras,
    desglosePorObra = [] // 🆕 Recibir desglose de obras
  } = metricas;

  // 🆕 Alertas basadas en obras individuales con problemas
  if (desglosePorObra && desglosePorObra.length > 0) {
    console.log('🔍 Analizando obras para alertas:', desglosePorObra);
    desglosePorObra.forEach(obra => {
      const balanceObra = (obra.totalCobrado || 0) - (obra.totalPagado || 0) - (obra.totalRetirado || 0);
      const porcentajeCobradoObra = obra.totalPresupuesto > 0
        ? ((obra.totalCobrado || 0) / obra.totalPresupuesto) * 100
        : 0;

      console.log(`🔍 Analizando obra "${obra.nombreObra}":`, {
        totalCobrado: obra.totalCobrado,
        totalPagado: obra.totalPagado,
        totalRetirado: obra.totalRetirado,
        balanceObra,
        porcentajeCobradoObra
      });

      // Alerta de déficit por obra
      if (balanceObra < 0) {
        console.log(`🚨 GENERANDO alerta de DÉFICIT para "${obra.nombreObra}"`);
        alertas.push({
          tipo: 'danger',
          icono: '🚨',
          titulo: 'Déficit Financiero',
          descripcion: `Has pagado $${Math.abs(balanceObra).toLocaleString('es-AR', { minimumFractionDigits: 0 })} más de lo cobrado`,
          recomendacion: 'Necesitas cobrar urgentemente'
        });
      } else {
        console.log(`✅ NO hay déficit en "${obra.nombreObra}", balance: ${balanceObra}`);
      }

      // Alerta de bajo porcentaje de cobro por obra
      if (porcentajeCobradoObra < 30 && obra.totalPresupuesto > 0) {
        console.log(`⚠️ GENERANDO alerta de BAJO COBRO para "${obra.nombreObra}": ${porcentajeCobradoObra.toFixed(1)}%`);
        alertas.push({
          tipo: 'warning',
          icono: '⚠️',
          titulo: 'Bajo Porcentaje de Cobro',
          descripcion: `Solo has cobrado el ${porcentajeCobradoObra.toFixed(1)}% del presupuesto total`,
          recomendacion: 'Considera gestionar más cobros'
        });
      }

      // Alerta de saldo bajo por obra (ha cobrado pero queda poco)
      if (balanceObra > 0 && balanceObra < obra.totalPresupuesto * 0.1 && (obra.totalCobrado || 0) > 0) {
        alertas.push({
          tipo: 'warning',
          icono: '💰',
          titulo: 'Saldo Bajo en Obra',
          descripcion: `Solo quedan $${balanceObra.toLocaleString('es-AR', { minimumFractionDigits: 0 })} disponibles`,
          recomendacion: 'Planifica el próximo cobro'
        });
      }
    });
  }

  // Alertas consolidadas globales
  if (saldoDisponible < 0) {
    alertas.push({
      tipo: 'danger',
      icono: '🚨',
      titulo: 'SALDO NEGATIVO CONSOLIDADO',
      mensaje: `Se ha gastado $${Math.abs(saldoDisponible).toLocaleString('es-AR', { minimumFractionDigits: 2 })} más de lo cobrado en TODAS las obras`,
      accion: `Urgente: Revisar flujo de caja en las ${cantidadObras} obras activas`
    });
  }

  if (saldoDisponible > 0 && porcentajeDisponible < 10 && totalCobrado > 0) {
    const porcentajeSaldoDelCobrado = totalCobrado > 0 ? (saldoDisponible / totalCobrado) * 100 : 0;
    alertas.push({
      tipo: 'warning',
      icono: '⚠️',
      titulo: 'SALDO CONSOLIDADO BAJO',
      mensaje: `Solo queda $${saldoDisponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })} disponible (${porcentajeSaldoDelCobrado.toFixed(1)}% de lo cobrado, ${porcentajeDisponible.toFixed(1)}% del presupuesto total)`,
      accion: 'Planificar cobros en las obras más avanzadas'
    });
  }

  if (porcentajePagado > 70 && porcentajeCobrado < 50) {
    alertas.push({
      tipo: 'warning',
      icono: '💰',
      titulo: 'DESBALANCE GENERAL COBROS/PAGOS',
      mensaje: `Has pagado ${porcentajePagado.toFixed(1)}% pero solo cobraste ${porcentajeCobrado.toFixed(1)}% del total`,
      accion: `Priorizar cobros en las ${cantidadObras} obras activas`
    });
  }

  if (saldoDisponible > 0 && porcentajeDisponible > 30 && totalCobrado > 0) {
    const porcentajeSaldoDelCobrado = totalCobrado > 0 ? (saldoDisponible / totalCobrado) * 100 : 0;
    alertas.push({
      tipo: 'success',
      icono: '✅',
      titulo: 'SITUACIÓN FINANCIERA SALUDABLE',
      mensaje: `Tienes $${saldoDisponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })} disponible (${porcentajeSaldoDelCobrado.toFixed(1)}% de lo cobrado)`,
      accion: 'Puedes continuar con los pagos programados'
    });
  }

  if (cantidadObras > 5) {
    alertas.push({
      tipo: 'info',
      icono: '🏗️',
      titulo: 'MÚLTIPLES OBRAS EN EJECUCIÓN',
      mensaje: `Estás gestionando ${cantidadObras} obras simultáneamente`,
      accion: 'Monitorear cada obra individualmente para evitar desbalances'
    });
  }

  if (porcentajeCobrado > 100) {
    alertas.push({
      tipo: 'info',
      icono: '📈',
      titulo: 'COBROS SUPERAN PRESUPUESTO',
      mensaje: `Has cobrado ${porcentajeCobrado.toFixed(1)}% del presupuesto total`,
      accion: 'Puede haber mayores costos o adicionales en algunas obras'
    });
  }

  if (porcentajePagado > 100) {
    alertas.push({
      tipo: 'danger',
      icono: '🔴',
      titulo: 'PAGOS SUPERAN PRESUPUESTO',
      mensaje: `Has pagado ${porcentajePagado.toFixed(1)}% del presupuesto total`,
      accion: 'URGENTE: Revisar sobrecostos y cobrar diferencias pendientes'
    });
  }

  if (totalPresupuesto > 0 && porcentajeCobrado < 20 && totalCobrado > 0) {
    alertas.push({
      tipo: 'info',
      icono: '📊',
      titulo: 'FASE INICIAL DE OBRAS',
      mensaje: `Solo se ha cobrado ${porcentajeCobrado.toFixed(1)}% del total presupuestado`,
      accion: 'Normal en inicio. Planificar cronograma de cobros'
    });
  }

  return alertas;
};

export default useEstadisticasConsolidadas;
