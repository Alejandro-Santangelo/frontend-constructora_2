import React, { useState, useEffect, useMemo } from 'react';
import { formatearMoneda } from '../services/cobrosObraService';
import { listarPagosConsolidadosPorEmpresa } from '../services/pagosConsolidadosService';
import apiService from '../services/api';
import * as trabajosAdicionalesService from '../services/trabajosAdicionalesService';
import { listarEntidadesFinancieras, obtenerEstadisticasMultiples } from '../services/entidadesFinancierasService';
import { listarCobrosEmpresa } from '../services/cobrosEmpresaService';

/**
 * Modal para mostrar el desglose detallado por obra de un concepto financiero
 * Se usa en modo consolidado al hacer clic en las tarjetas del resumen
 */
const DetalleConsolidadoPorObraModal = ({ show, onHide, tipo, datos, titulo, estadisticas, empresaSeleccionada }) => {
  const [mostrandoDetallePagos, setMostrandoDetallePagos] = useState(false);
  const [pagosDetallados, setPagosDetallados] = useState([]);
  const [gruposColapsados, setGruposColapsados] = useState({});
  const [cargandoPagos, setCargandoPagos] = useState(false);
  const [trabajosAdicionales, setTrabajosAdicionales] = useState([]);
  const [cargandoTrabajosAdicionales, setCargandoTrabajosAdicionales] = useState(false);
  const [trabajosExtra, setTrabajosExtra] = useState(new Map());
  const [cargandoTrabajosExtra, setCargandoTrabajosExtra] = useState(false);
  // Cobros de TRABAJO_ADICIONAL y OBRA_INDEPENDIENTE para el desglose de saldo disponible
  const [entidadesSinDistribucion, setEntidadesSinDistribucion] = useState([]);
  const [cargandoEntidadesSinDist, setCargandoEntidadesSinDist] = useState(false);
  // 💰 Cobros reales a la empresa (para tipo 'cobros')
  const [cobrosEmpresa, setCobrosEmpresa] = useState([]);
  const [cargandoCobrosEmpresa, setCargandoCobrosEmpresa] = useState(false);

  // 🆕 Cargar trabajos adicionales y extra cuando se abre el modal
  useEffect(() => {
    if (show && empresaSeleccionada?.id && (tipo === 'presupuestos' || tipo === 'saldoPorCobrar' || tipo === 'pagos' || tipo === 'saldoDisponible')) {
      cargarTrabajosAdicionales();
      cargarTrabajosExtra();
    }
  }, [show, empresaSeleccionada?.id, tipo]);

  // 💰 Cargar cobros reales de la empresa (no por obra, sino todos)
  useEffect(() => {
    if (show && empresaSeleccionada?.id && tipo === 'cobros') {
      cargarCobrosEmpresa();
    }
  }, [show, empresaSeleccionada?.id, tipo]);

  const cargarCobrosEmpresa = async () => {
    setCargandoCobrosEmpresa(true);
    try {
      const cobros = await listarCobrosEmpresa(empresaSeleccionada.id);
      console.log('💰 [DetalleConsolidado] Cobros empresa cargados:', cobros.length);
      setCobrosEmpresa(cobros || []);
    } catch (err) {
      console.error('❌ Error cargando cobros empresa:', err);
      setCobrosEmpresa([]);
    } finally {
      setCargandoCobrosEmpresa(false);
    }
  };

  // Cargar cobros de TA y OI para el desglose de saldo disponible
  useEffect(() => {
    if (show && empresaSeleccionada?.id && tipo === 'saldoDisponible') {
      cargarEntidadesSinDistribucion();
    }
  }, [show, empresaSeleccionada?.id, tipo]);

  // 🆕 Calcular el total CORRECTO con deduplicación de TAs y OIs
  const totalCorrectoCalculado = useMemo(() => {
    console.log(`🔍 [useMemo] Inicio - tipo=${tipo}, datos=${datos?.length}, TAs=${trabajosAdicionales.length}, cargandoTAs=${cargandoTrabajosAdicionales}, TEs Map size=${trabajosExtra.size}, cargandoTEs=${cargandoTrabajosExtra}`);

    if (tipo !== 'presupuestos' || !datos || datos.length === 0) {
      return null; // Solo calcular para tipo presupuestos
    }

    // ✅ Esperar a que trabajosExtra y trabajosAdicionales se carguen
    if (cargandoTrabajosExtra || cargandoTrabajosAdicionales) {
      console.log('⏳ [useMemo] Esperando carga de trabajos extra/adicionales...');
      return null;
    }

    // ✅ Esperar a que los arrays tengan datos (no solo que no estén cargando)
    if (trabajosExtra.size === 0 && trabajosAdicionales.length === 0) {
      console.log('⏳ [useMemo] Arrays vacíos, esperando datos...');
      return null;
    }

    console.log(`✅ [useMemo] Procesando con:`, {
      trabajosAdicionales: trabajosAdicionales.map(ta => `id:${ta.id} obraId:${ta.obraId}`),
      trabajosExtraMap: Array.from(trabajosExtra.entries()).map(([obraId, tes]) => `obra${obraId}→[${tes.map(te => te.obraId).join(',')}]`)
    });

    let total = 0;
    const taIdsContados = new Set(); // Para deduplica TAs
    const oiMap = new Map(); // Para deduplicar OIs

    // ✅ CORREGIDO: Crear Set solo con IDs de presupuestos que son trabajos extra
    const idsPresupuestosTrabajosExtra = new Set();
    trabajosExtra.forEach(tesObra => {
      tesObra.forEach(te => {
        // Solo agregar el ID del presupuesto del TE (no el obraId)
        if (te.id) idsPresupuestosTrabajosExtra.add(te.id);
        if (te.presupuestoId) idsPresupuestosTrabajosExtra.add(te.presupuestoId);
      });
    });

    // ✅ FILTRAR solo presupuestos que son TEs (para no contarlos dos veces)
    const obrasFiltradas = datos.filter(obra => {
      const presupuestoIdActual = obra.presupuestoId || obra.id;
      const esPresupuestoTrabajoExtra = idsPresupuestosTrabajosExtra.has(presupuestoIdActual);

      if (esPresupuestoTrabajoExtra) {
        console.log(`🚫 [useMemo] Filtrando "${obra.nombreObra}" (presupuestoId: ${presupuestoIdActual}) - es TE duplicado`);
      }
      return !esPresupuestoTrabajoExtra;
    });

    console.log(`📊 [useMemo] Obras a procesar: ${obrasFiltradas.length}`, obrasFiltradas.map(o => o.nombreObra));

    // Procesar cada obra (sin TEs duplicados)
    obrasFiltradas.forEach(obra => {
      const presupuestoBase = parseFloat(obra.totalPresupuesto || 0);

      // Si es OI, deduplicar por nombre_direccion
      if (obra.esObraIndependiente) {
        // ✅ Si nombre y dirección están vacíos, usar ID para evitar colisiones
        const nombre = obra.nombreObra || '';
        const dir = obra.direccion || '';
        const claveUnica = (nombre || dir) ? `${nombre}_${dir}`.trim() : `id_${obra.id}`;
        const existente = oiMap.get(claveUnica);
        const montoActual = presupuestoBase;

        if (!existente || montoActual > parseFloat(existente.monto || 0)) {
          oiMap.set(claveUnica, { monto: montoActual });
        }
        return; // No sumar aún, sumaremos después
      }

      // Sumar obra principal
      total += presupuestoBase;

      // Sumar TEs de esta obra
      const obraIdReal = obra.obraId || obra.id; // Calcular ID real de la obra
      const trabajosExtraObra = trabajosExtra.get(obraIdReal) || [];
      trabajosExtraObra.forEach(te => {
        total += parseFloat(te.totalCalculado || 0);
      });

      // Sumar TAs de esta obra (con deduplicación)
      // ✅ Incluir AMBOS IDs de cada TE (obraId y id)
      const trabajosExtraObraIds = trabajosExtraObra.flatMap(te => [te.obraId, te.id]).filter(Boolean);
      const trabajosAdicionalesObra = trabajosAdicionales.filter(ta => {
        const teId = ta.trabajoExtraId || ta.trabajo_extra_id;
        const obraIdTA = ta.obraId || ta.obra_id;
        // ✅ Priorizar trabajoExtraId para evitar duplicados
        if (teId && trabajosExtraObraIds.includes(teId)) return true;
        // ✅ Solo comparar con obraIdReal (no obra.id directamente)
        if (!teId && obraIdTA === obraIdReal) return true;
        return false;
      });

      console.log(`📊 [useMemo] "${obra.nombreObra}": obraIdReal=${obraIdReal}, TAs encontrados=${trabajosAdicionalesObra.length}`);

      trabajosAdicionalesObra.forEach(ta => {
        if (!taIdsContados.has(ta.id)) {
          const monto = parseFloat(ta.importe || 0);
          console.log(`  💵 [useMemo] Sumando TA id:${ta.id} "${ta.nombre?.substring(0,20)}...": $${monto.toLocaleString()}`);
          total += monto;
          taIdsContados.add(ta.id);
        }
      });
    });

    // Sumar OIs deduplicadas
    oiMap.forEach(({ monto }) => {
      total += monto;
    });

    // Sumar TAs huérfanos (sin obra asociada, con deduplicación)
    const tasHuerfanos = trabajosAdicionales.filter(ta => {
      const obraIdTA = ta.obraId || ta.obra_id;
      const teId = ta.trabajoExtraId || ta.trabajo_extra_id;
      return !obraIdTA && !teId;
    });
    tasHuerfanos.forEach(ta => {
      if (!taIdsContados.has(ta.id)) {
        total += parseFloat(ta.importe || 0);
        taIdsContados.add(ta.id);
      }
    });

    console.log('✅ Total correcto calculado:', total);
    console.log('📊 TAs únicos contados:', taIdsContados.size);
    console.log('📊 OIs únicos contados:', oiMap.size);

    return total;
  }, [tipo, datos, trabajosAdicionales, trabajosExtra, cargandoTrabajosExtra, cargandoTrabajosAdicionales]);

  const cargarEntidadesSinDistribucion = async () => {
    setCargandoEntidadesSinDist(true);
    try {
      const todasEF = await listarEntidadesFinancieras(empresaSeleccionada.id);
      const efSinDist = (todasEF || []).filter(
        ef => ef.tipoEntidad === 'TRABAJO_ADICIONAL' || ef.tipoEntidad === 'OBRA_INDEPENDIENTE'
      );
      if (efSinDist.length === 0) {
        setEntidadesSinDistribucion([]);
        return;
      }
      const estadisticasEF = await obtenerEstadisticasMultiples(
        empresaSeleccionada.id,
        efSinDist.map(ef => ef.id)
      );
      // Emparejar por índice: el backend devuelve en el mismo orden que el request
      // efSinDist[i].entidadId es el ID real de la obra (fuente más confiable)
      const filas = (estadisticasEF || []).map((e, i) => ({
        nombreObra:   e.nombreDisplay,
        totalCobrado: parseFloat(e.totalCobrado || 0),
        tipoEntidad:  e.tipoEntidad,
        entidadId:    efSinDist[i]?.entidadId ?? e.entidadId ?? e.obraId ?? null,
      }));

      // Deduplicar EF huérfanos con nombre casi idéntico (ej: typo en nombre anterior)
      // Cuando dos entradas tienen nombres con distancia Levenshtein ≤ 2, se queda
      // la que tiene mayor entidadId (registro más reciente/correcto).
      const lev = (a, b) => {
        const m = a.length, n = b.length;
        const dp = Array.from({ length: m + 1 }, (_, i2) =>
          Array.from({ length: n + 1 }, (_, j) => i2 === 0 ? j : j === 0 ? i2 : 0)
        );
        for (let i2 = 1; i2 <= m; i2++)
          for (let j = 1; j <= n; j++)
            dp[i2][j] = a[i2 - 1] === b[j - 1]
              ? dp[i2 - 1][j - 1]
              : 1 + Math.min(dp[i2 - 1][j], dp[i2][j - 1], dp[i2 - 1][j - 1]);
        return dp[m][n];
      };
      const filasDedup = [];
      filas.forEach(f => {
        const nomF = (f.nombreObra || '').toLowerCase().trim();
        const idxExistente = filasDedup.findIndex(d =>
          lev(nomF, (d.nombreObra || '').toLowerCase().trim()) <= 2
        );
        if (idxExistente === -1) {
          filasDedup.push(f);
        } else {
          // Conservar la entrada con el mayor entidadId (más reciente)
          if ((f.entidadId || 0) > (filasDedup[idxExistente].entidadId || 0)) {
            filasDedup[idxExistente] = f;
          }
        }
      });
      setEntidadesSinDistribucion(filasDedup);
    } catch (err) {
      console.warn('⚠️ [DetalleConsolidado] Error cargando TA/OI:', err.message);
      setEntidadesSinDistribucion([]);
    } finally {
      setCargandoEntidadesSinDist(false);
    }
  };

  const cargarTrabajosAdicionales = async () => {
    setCargandoTrabajosAdicionales(true);
    try {
      const trabajosAd = await trabajosAdicionalesService.listarTrabajosAdicionales(empresaSeleccionada.id);
      console.log('✅ Trabajos adicionales cargados para modal:', trabajosAd.length);
      console.log('📊 TAs disponibles:', trabajosAd.map(ta => `id:${ta.id} [obra:${ta.obraId}, te:${ta.trabajoExtraId || 'null'}] "${ta.nombre?.substring(0,30)}..."`));
      setTrabajosAdicionales(trabajosAd);
    } catch (error) {
      console.warn('⚠️ Error cargando trabajos adicionales para modal:', error);
      setTrabajosAdicionales([]);
    } finally {
      setCargandoTrabajosAdicionales(false);
    }
  };

  const cargarTrabajosExtra = async () => {
    setCargandoTrabajosExtra(true);
    try {
      console.log('🔄 Cargando trabajos extra usando presupuestos...', { datos });

      // Usar el mismo método que SistemaFinancieroPage - obtener todos los presupuestos
      const todosPresupuestos = await apiService.get('/api/v1/presupuestos-no-cliente', {
        params: { empresaId: empresaSeleccionada.id }
      });

      const presupuestosArray = Array.isArray(todosPresupuestos) ? todosPresupuestos :
                               todosPresupuestos?.data ? todosPresupuestos.data : [];

      // Filtrar solo trabajos extra
      const presupuestosTrabajosExtra = presupuestosArray.filter(p => {
        return p.esPresupuestoTrabajoExtra === true ||
               p.esPresupuestoTrabajoExtra === 'V' ||
               p.es_presupuesto_trabajo_extra === true;
      });

      console.log('✅ Presupuestos trabajos extra encontrados:', presupuestosTrabajosExtra);

      // Agrupar por obra origen
      const trabajosExtraMap = new Map();

      presupuestosTrabajosExtra.forEach(te => {
        const obraOrigenId = te.obraOrigenId || te.obra_origen_id || te.obra?.obraOrigenId;
        const obraTrabajoExtraId = te.obraId || te.obra?.id; // ID de la obra trabajo extra

        if (obraOrigenId) {
          if (!trabajosExtraMap.has(obraOrigenId)) {
            trabajosExtraMap.set(obraOrigenId, []);
          }
          trabajosExtraMap.get(obraOrigenId).push({
            id: te.id, // ID del presupuesto
            obraId: obraTrabajoExtraId, // ID de la obra trabajo extra
            nombre: te.nombreObra || te.nombre,
            totalCalculado: te.totalFinal || te.valorTotalIva || te.valorTotal || 0,
            obraOrigenId,
            presupuesto: te
          });
        }
      });

      console.log('✅ TEs organizados:', Array.from(trabajosExtraMap.entries()).map(([obraPadreId, tes]) =>
        `Obra ${obraPadreId} → TEs: [${tes.map(te => `${te.obraId}:"${te.nombre?.substring(0,20)}"`).join(', ')}]`
      ).join(' | '));

      // 🔍 Log detallado de todos los IDs de cada TE
      console.log('🔍 [DEBUG] Detalle completo de TEs cargados:');
      Array.from(trabajosExtraMap.entries()).forEach(([obraPadreId, tes]) => {
        tes.forEach(te => {
          console.log(`  TE "${te.nombre}": { id: ${te.id}, obraId: ${te.obraId}, obraOrigenId: ${te.obraOrigenId} }`);
        });
      });

      setTrabajosExtra(trabajosExtraMap);
    } finally {
      setCargandoTrabajosExtra(false);
    }
  };

  if (!show) return null;

  // Cargar detalle de pagos
  const cargarDetallePagos = async () => {
    if (!empresaSeleccionada?.id) {
      console.error('No hay empresa seleccionada');
      return;
    }

    setCargandoPagos(true);
    try {
      console.log('🔍 Cargando TODOS los pagos detallados...');

      // 1. Cargar pagos consolidados (materiales y gastos generales)
      const pagosConsolidados = await listarPagosConsolidadosPorEmpresa(empresaSeleccionada.id);

      // 2. Cargar pagos de trabajos extra
      const pagosTrabajosExtra = await apiService.pagosTrabajoExtra.getByEmpresa(empresaSeleccionada.id).catch(err => {
        console.warn('⚠️ Error cargando pagos de trabajos extra:', err);
        return [];
      });

      // 3. Cargar pagos de profesionales por obra
      let pagosProfesionales = [];
      if (datos && datos.length > 0) {
        const promesasPagos = datos.map(async (obra) => {
          try {
            const response = await apiService.get('/api/v1/pagos-profesional-obra', {
              params: {
                empresaId: empresaSeleccionada.id,
                obraId: obra.obraId
              }
            });

            const pagosArray = Array.isArray(response) ? response :
                              response?.data ? response.data : [];

            return pagosArray.map(p => ({
              ...p,
              nombreObra: obra.nombreObra,
              tipoItem: 'PROFESIONAL_OBRA'
            }));
          } catch (error) {
            console.warn(`⚠️ Error cargando pagos de obra ${obra.nombreObra}:`, error);
            return [];
          }
        });

        const resultados = await Promise.all(promesasPagos);
        pagosProfesionales = resultados.flat();
      }

      // Combinar todos los pagos
      const todosLosPagos = [
        ...pagosProfesionales.map(p => ({
          ...p,
          tipoItem: 'PROFESIONAL_OBRA',
          descripcion: p.nombreProfesional || p.nombre || 'Profesional',
          monto: p.montoNeto || p.montoBruto
        })),
        ...pagosConsolidados.map(p => ({
          ...p,
          tipoItem: p.tipoItem || (p.concepto?.includes('material') ? 'MATERIAL' : 'GASTO_GENERAL'),
          descripcion: p.concepto || p.descripcion || 'Pago consolidado',
          nombreObra: datos?.[0]?.nombreObra || 'N/A'
        })),
        ...pagosTrabajosExtra.map(p => ({
          ...p,
          tipoItem: 'TRABAJO_EXTRA',
          descripcion: p.concepto || p.nombre || 'Trabajo Extra',
          monto: p.montoFinal || p.montoBase,
          nombreObra: p.nombreObra || datos?.[0]?.nombreObra || 'N/A'
        }))
      ];

      console.log(`✅ Total de pagos cargados: ${todosLosPagos.length}`);
      console.log(`  - Profesionales: ${pagosProfesionales.length}`);
      console.log(`  - Consolidados: ${pagosConsolidados.length}`);
      console.log(`  - Trabajos Extra: ${pagosTrabajosExtra.length}`);

      setPagosDetallados(todosLosPagos);
      setMostrandoDetallePagos(true);
    } catch (error) {
      console.error('Error cargando detalle de pagos:', error);
      alert('Error al cargar el detalle de pagos');
    } finally {
      setCargandoPagos(false);
    }
  };

  // Función para renderizar según el tipo de dato
  const renderContenido = () => {
    // Para 'cobros' usamos cobrosEmpresa directamente (no depende de datos)
    if (tipo !== 'cobros' && (!datos || datos.length === 0)) {
      return (
        <div className="alert alert-info">
          No hay datos disponibles para mostrar.
        </div>
      );
    }

    switch (tipo) {
      case 'presupuestos':
        return renderPresupuestos();
      case 'cobros':
        return renderCobros();
      case 'pagos':
        return renderPagos();
      case 'saldoPorCobrar':
        return renderSaldoPorCobrar();
      case 'saldoDisponible':
        return renderSaldoDisponible();
      case 'balanceNeto':
        return renderBalanceNeto();
      case 'deficit':
        return renderDeficit();
      default:
        return null;
    }
  };

  const renderPresupuestos = () => {
    // ✅ CALCULAR TOTAL REAL: sumar exactamente las filas que se renderizan (sin duplicar TAs)
    let totalCalculado = 0;
    const taIdsContados = new Set(); // Para evitar contar el mismo TA múltiples veces

    // ✅ CORREGIDO: Crear Set solo con IDs de presupuestos que son trabajos extra
    const idsPresupuestosTrabajosExtra = new Set();
    trabajosExtra.forEach(tesObra => {
      tesObra.forEach(te => {
        // Solo agregar el ID del presupuesto del TE (no el obraId)
        if (te.id) idsPresupuestosTrabajosExtra.add(te.id);
        if (te.presupuestoId) idsPresupuestosTrabajosExtra.add(te.presupuestoId);
      });
    });

    // 1. Filtrar solo presupuestos que son trabajos extra, NO obras principales
    const obrasFiltradas = datos.filter(obra => {
      const presupuestoIdActual = obra.presupuestoId || obra.id;
      const esPresupuestoTrabajoExtra = idsPresupuestosTrabajosExtra.has(presupuestoIdActual);

      if (esPresupuestoTrabajoExtra) {
        console.log(`🚫 [Presupuestos] Excluyendo presupuesto "${obra.nombreObra}" (presupuestoId: ${presupuestoIdActual}) - es un trabajo extra`);
      }

      return !esPresupuestoTrabajoExtra;
    });

    // Deduplicar OI por nombreObra
    const oiMap = new Map();
    const obrasNormales = [];

    obrasFiltradas.forEach(obra => {
      if (obra.esObraIndependiente) {
        // ✅ Si nombre y dirección están vacíos, usar ID para evitar colisiones
        const nombre = obra.nombreObra || '';
        const dir = obra.direccion || '';
        const claveUnica = (nombre || dir) ? `${nombre}_${dir}`.trim() : `id_${obra.id}`;
        const montoActual = parseFloat(obra.totalPresupuesto || 0);
        const existente = oiMap.get(claveUnica);

        if (!existente || montoActual > (parseFloat(existente.totalPresupuesto || 0))) {
          oiMap.set(claveUnica, obra);
        }
      } else {
        obrasNormales.push(obra);
      }
    });

    const obrasPrincipales = [...obrasNormales, ...Array.from(oiMap.values())];

    obrasPrincipales.forEach(obra => {
      if (obra.esObraIndependiente) {
        // OI: sumar directamente
        totalCalculado += parseFloat(obra.totalPresupuesto || 0);
      } else {
        const obraIdReal = obra.obraId || obra.id;
        // OP base
        totalCalculado += parseFloat(obra.totalPresupuesto || 0);

        // TE de esta obra
        const trabajosExtraObra = trabajosExtra.get(obraIdReal) || [];
        trabajosExtraObra.forEach(te => {
          totalCalculado += parseFloat(te.totalCalculado || 0);
        });

        // TA de esta obra (directos + anidados bajo TE) - SIN DUPLICAR
        // ✅ Incluir AMBOS IDs de cada TE (obraId y id)
        const trabajosExtraObraIds = trabajosExtraObra.flatMap(te => [te.obraId, te.id]).filter(Boolean);
        const trabajosAdicionalesObra = trabajosAdicionales.filter(ta => {
          const teId = ta.trabajoExtraId || ta.trabajo_extra_id;
          const obraIdTA = ta.obraId || ta.obra_id;
          // ✅ Priorizar trabajoExtraId para evitar duplicados
          if (teId && trabajosExtraObraIds.includes(teId)) return true;
          if (!teId && obraIdTA === obraIdReal) return true;
          return false;
        });
        trabajosAdicionalesObra.forEach(ta => {
          if (!taIdsContados.has(ta.id)) {
            totalCalculado += parseFloat(ta.importe || 0);
            taIdsContados.add(ta.id);
          }
        });
      }
    });

    // 2. TE huérfanos (sin obra asociada)
    Array.from(trabajosExtra.values()).flat()
      .filter(te => {
        const obraPadreId = te.presupuesto?.obraOrigenId || te.presupuesto?.obra_origen_id || te.obraOrigenId;
        return !datos.some(obra => {
          const obraIdReal = obra.obraId || obra.id;
          return obraPadreId === obraIdReal;
        });
      })
      .forEach(te => {
        totalCalculado += parseFloat(te.totalFinal || te.montoTotal || te.totalCalculado || 0);
      });

    // 3. TA huérfanos (sin obra ni TE asociado) - SIN DUPLICAR
    trabajosAdicionales
      .filter(ta => {
        const obraIdTA = ta.obraId || ta.obra_id;
        const teId = ta.trabajoExtraId || ta.trabajo_extra_id;
        const tieneObraAsociada = datos.some(obra => {
          const obraIdReal = obra.obraId || obra.id;
          return obraIdTA === obraIdReal;
        });
        if (tieneObraAsociada) return false;
        const todosTrabajosExtraIds = Array.from(trabajosExtra.values()).flat().map(te => te.obraId).filter(Boolean);
        const tieneTrabajoExtraAsociado = teId && todosTrabajosExtraIds.includes(teId);
        if (tieneTrabajoExtraAsociado) return false;
        return true;
      })
      .forEach(ta => {
        if (!taIdsContados.has(ta.id)) {
          totalCalculado += parseFloat(ta.importe || 0);
          taIdsContados.add(ta.id);
        }
      });

    console.log('💰 [DetalleConsolidado] Total calculado desde filas (TAs deduplicados):', totalCalculado.toLocaleString());
    console.log('💰 [DetalleConsolidado] TAs únicos contados:', taIdsContados.size);
    console.log('💰 [DetalleConsolidado] Total del useMemo:', totalCorrectoCalculado ? totalCorrectoCalculado.toLocaleString() : 'null');

    // ✅ Priorizar el cálculo del render (que tiene datos completos) sobre el useMemo
    const totalCompleto = totalCalculado > 0 ? totalCalculado : (totalCorrectoCalculado || 0);

    return (
      <div className="table-responsive">
        <table className="table table-hover">
          <thead className="table-primary">
            <tr>
              <th>Obra / Trabajo</th>
              <th>Estado</th>
              <th className="text-end">Monto Presupuestado</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              // Filtrar TE del map
              const obrasFiltradas = datos.filter(obra => {
                const estaEnMapTrabajos = Array.from(trabajosExtra.values()).flat().some(te => te.id === obra.presupuestoId || te.id === obra.id);
                return !estaEnMapTrabajos;
              });

              // ✅ Deduplicar OI por nombreObra, priorizando la con monto > 0
              const oiMap = new Map();
              const obrasNormales = [];

              obrasFiltradas.forEach(obra => {
                if (obra.esObraIndependiente) {
                  // ✅ Si nombre y dirección están vacíos, usar ID para evitar colisiones
                  const nombre = obra.nombreObra || '';
                  const dir = obra.direccion || '';
                  const claveUnica = (nombre || dir) ? `${nombre}_${dir}`.trim() : `id_${obra.id}`;
                  const montoActual = parseFloat(obra.totalPresupuesto || 0);
                  const existente = oiMap.get(claveUnica);

                  if (!existente || montoActual > (parseFloat(existente.totalPresupuesto || 0))) {
                    oiMap.set(claveUnica, obra);
                  }
                } else {
                  obrasNormales.push(obra);
                }
              });

              const obrasDeduplicated = [...obrasNormales, ...Array.from(oiMap.values())];
              console.log(`✅ [DetalleModal] Obras después de deduplicar OI:`, obrasDeduplicated.length);

              return obrasDeduplicated.map((obra, idx) => {
              const obraIdReal = obra.obraId || obra.id;

              // ✅ Si es obra independiente, no tiene trabajos extra ni adicionales
              if (obra.esObraIndependiente) {
                return (
                  <React.Fragment key={idx}>
                    {/* Obra principal independiente */}
                    <tr>
                      <td>
                        <strong className="text-primary">{obra.nombreObra}</strong>
                        <div className="text-muted small">Sin versión</div>
                        <div className="mt-1">
                          <span className="badge bg-warning text-dark">
                            <i className="bi bi-diagram-3 me-1"></i>
                            Obra Independiente
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${
                          obra.estado === 'APROBADO' ? 'bg-success' :
                          obra.estado === 'EN_EJECUCION' ? 'bg-primary' :
                          'bg-secondary'
                        }`}>
                          {obra.estado || 'N/A'}
                        </span>
                      </td>
                      <td className="text-end">
                        <strong className="text-primary">
                          {formatearMoneda(obra.totalPresupuesto || 0)}
                          <small className="text-muted d-block">(Estimado)</small>
                        </strong>
                      </td>
                    </tr>

                    {/* Línea separadora entre obras (excepto la última) */}
                    {idx < obrasDeduplicated.length - 1 && (
                      <tr>
                        <td colSpan="3" className="p-0">
                          <hr className="border-dark my-2" style={{borderWidth: '1px'}} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              }

              // 🔥 SIMPLIFICADO: Obtener trabajos extra directamente del Map usando obraIdReal
              const trabajosExtraObra = trabajosExtra.get(obraIdReal) || [];

              console.log(`🔍 Modal - Obra "${obra.nombreObra}":`, {
                'obra.obraId': obra.obraId,
                'obra.id': obra.id,
                'obraIdReal (usado)': obraIdReal,
                'presupuestoId': obra.presupuestoId,
                trabajosExtraEncontrados: trabajosExtraObra.length
              });

              // Encontrar trabajos adicionales relacionados con esta obra
              // Incluir tanto los directamente asociados a la obra como los asociados a trabajos extra de esta obra
              // ✅ Incluir AMBOS IDs de cada TE (obraId y id) para cubrir todas las formas de referencia
              const trabajosExtraObraIds = trabajosExtraObra.flatMap(te => [te.obraId, te.id]).filter(Boolean);

              console.log(`📋 Obra "${obra.nombreObra}" - TEs de esta obra:`, trabajosExtraObra.map(te => ({
                nombre: te.nombre,
                id: te.id,
                obraId: te.obraId
              })));
              console.log(`📋 IDs disponibles para matching de TAs:`, trabajosExtraObraIds);

              const trabajosAdicionalesObra = trabajosAdicionales.filter(ta => {
                // ✅ Soporte para snake_case y camelCase
                const teId = ta.trabajoExtraId || ta.trabajo_extra_id;
                const obraIdTA = ta.obraId || ta.obra_id;

                console.log(`🔍 [${obra.nombreObra}] Evaluando TA id:${ta.id} "${ta.nombre?.substring(0,30)}": { trabajoExtraId: ${teId}, obraId: ${obraIdTA}, obraIdReal: ${obraIdReal} }`);

                // ✅ PRIORIDAD: Si tiene trabajoExtraId, solo considerar esa relación (evita duplicados)
                // Caso 1: Trabajo adicional asociado a un trabajo extra de esta obra
                if (teId && trabajosExtraObraIds.includes(teId)) {
                  console.log(`  ✅ Match por TE: teId ${teId} está en trabajosExtraObraIds`);
                  return true;
                }
                // Caso 2: Trabajo adicional directamente asociado a la obra (solo si NO tiene trabajoExtraId)
                if (!teId && obraIdTA === obraIdReal) {
                  console.log(`  ✅ Match por obra directa: obraIdTA ${obraIdTA} === obraIdReal ${obraIdReal}`);
                  return true;
                }
                console.log(`  ❌ No match`);
                return false;
              });

              console.log(`📊 [${obra.nombreObra}] Total TAs asociados: ${trabajosAdicionalesObra.length}`);

              return (
                <React.Fragment key={idx}>
                  {/* Obra principal */}
                  <tr>
                    <td>
                      <strong className="text-primary">{obra.nombreObra}</strong>
                      <div className="text-muted small">
                        Presupuesto #{obra.numeroPresupuesto || 'N/A'}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${
                        obra.estado === 'APROBADO' ? 'bg-success' :
                        obra.estado === 'EN_EJECUCION' ? 'bg-primary' :
                        'bg-secondary'
                      }`}>
                        {obra.estado || 'N/A'}
                      </span>
                    </td>
                    <td className="text-end">
                      <strong className="text-primary">
                        {formatearMoneda(obra.totalPresupuesto || 0)}
                      </strong>
                    </td>
                  </tr>

                  {/* ═══ SUBGRUPO: ADICIONALES OBRA (Trabajos Extra) ═══ */}
                  {trabajosExtraObra.length > 0 && (() => {
                    const claveExtra = `extra_${idx}`;
                    const colapsadoExtra = !!gruposColapsados[claveExtra];
                    return (
                      <>
                        <tr
                          onClick={() => setGruposColapsados(p => ({ ...p, [claveExtra]: !p[claveExtra] }))}
                          style={{ backgroundColor: '#fff3cd', cursor: 'pointer', borderLeft: '5px solid #ffc107', borderBottom: '1px solid rgba(253, 126, 20, 0.45)' }}
                        >
                          <td colSpan="3" className="py-1 px-3 small">
                            <span className="fw-bold" style={{ color: '#856404' }}>
                              <i className={`fas fa-chevron-${colapsadoExtra ? 'right' : 'down'} me-2`} style={{ fontSize: '0.75em' }}></i>
                              📋 Adicionales Obra
                              <span className="badge ms-2" style={{ fontSize: '0.7em', backgroundColor: '#ffc107', color: '#000' }}>{trabajosExtraObra.length}</span>
                            </span>
                            <span className="text-muted ms-3 small">Clic para {colapsadoExtra ? 'mostrar' : 'ocultar'}</span>
                          </td>
                        </tr>
                        {!colapsadoExtra && trabajosExtraObra.map((trabajo, tIdx) => {
                          // 🔍 Buscar tareas leves asociadas a ESTE trabajo extra específico
                          const tareasLevesDelTE = trabajosAdicionalesObra.filter(ta => {
                            const teId = ta.trabajoExtraId || ta.trabajo_extra_id;
                            // Verificar si el trabajoExtraId coincide con el ID del trabajo extra actual
                            // trabajoExtraId puede apuntar al ID de presupuesto (trabajo.id) O al obraId del TE
                            return teId && (teId === trabajo.id || teId === trabajo.obraId);
                          });

                          return (
                            <React.Fragment key={`${idx}-trabajo-${tIdx}`}>
                              {/* Fila del Trabajo Extra */}
                              <tr style={{ borderLeft: '5px solid #ffc107', borderBottom: tareasLevesDelTE.length > 0 ? '1px dashed rgba(253, 126, 20, 0.3)' : '1px solid rgba(253, 126, 20, 0.45)' }}>
                                <td className="ps-3">
                                  <small><strong>{trabajo.nombre}</strong></small>
                                </td>
                                <td>
                                  <span className="badge bg-warning text-dark" style={{ fontSize: '0.7em' }}>
                                    📋 Adicional Obra
                                    {tareasLevesDelTE.length > 0 && <span className="ms-1">({tareasLevesDelTE.length} 🔧)</span>}
                                  </span>
                                </td>
                                <td className="text-end">
                                  <span className="fw-bold" style={{ color: '#856404' }}>
                                    {formatearMoneda(trabajo.totalCalculado || 0)}
                                  </span>
                                </td>
                              </tr>

                              {/* Tareas Leves anidadas bajo este Trabajo Extra */}
                              {tareasLevesDelTE.map((ta, taIdx) => (
                                <tr key={`${idx}-te${tIdx}-ta${taIdx}`} style={{ borderLeft: '7px solid #fd7e14', backgroundColor: '#f0f9ff', borderBottom: '1px solid rgba(253, 126, 20, 0.3)' }}>
                                  <td className="ps-4">
                                    <small className="text-info">
                                      <i className="bi bi-arrow-return-right me-1" style={{ fontSize: '0.7em' }}></i>
                                      <strong>{ta.nombre || ta.descripcion}</strong>
                                    </small>
                                  </td>
                                  <td>
                                    <span className="badge bg-info text-dark" style={{ fontSize: '0.65em' }}>🔧 Tarea Leve</span>
                                  </td>
                                  <td className="text-end">
                                    <span className="fw-bold text-info" style={{ fontSize: '0.9em' }}>
                                      {formatearMoneda(ta.importe || 0)}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })}
                      </>
                    );
                  })()}

                  {/* ═══ SUBGRUPO: TAREAS LEVES DIRECTAS (sin trabajoExtraId) ═══ */}
                  {(() => {
                    // 🔍 Solo mostrar tareas leves que NO tienen trabajoExtraId (directas de la obra)
                    const tareasLevesDirectas = trabajosAdicionalesObra.filter(ta => {
                      const teId = ta.trabajoExtraId || ta.trabajo_extra_id;
                      return !teId; // Sin trabajoExtraId = directa de la obra
                    });

                    if (tareasLevesDirectas.length === 0) return null;

                    const claveAdic = `adic_${idx}`;
                    const colapsadoAdic = !!gruposColapsados[claveAdic];
                    return (
                      <>
                        <tr
                          onClick={() => setGruposColapsados(p => ({ ...p, [claveAdic]: !p[claveAdic] }))}
                          style={{ backgroundColor: '#dbeafe', cursor: 'pointer', borderLeft: '5px solid #1d4ed8', borderBottom: '1px solid rgba(253, 126, 20, 0.45)' }}
                        >
                          <td colSpan="3" className="py-1 px-3 small">
                            <span className="fw-bold text-primary">
                              <i className={`fas fa-chevron-${colapsadoAdic ? 'right' : 'down'} me-2`} style={{ fontSize: '0.75em' }}></i>
                              🔧 Tareas Leves Directas
                              <span className="badge bg-primary ms-2" style={{ fontSize: '0.7em' }}>{tareasLevesDirectas.length}</span>
                            </span>
                            <span className="text-muted ms-3 small">Clic para {colapsadoAdic ? 'mostrar' : 'ocultar'}</span>
                          </td>
                        </tr>
                        {!colapsadoAdic && tareasLevesDirectas.map((trabajoAd, taIdx) => (
                          <tr key={`${idx}-ta-directa-${taIdx}`} style={{ borderLeft: '7px solid #fd7e14', borderBottom: '1px solid rgba(253, 126, 20, 0.45)' }}>
                            <td className="ps-3">
                              <small className="text-info"><strong>{trabajoAd.nombre || trabajoAd.descripcion}</strong></small>
                              {trabajoAd.nombreProfesional && (
                                <div className="text-muted small">Prof: {trabajoAd.nombreProfesional}</div>
                              )}
                            </td>
                            <td>
                              <span className="badge bg-info text-dark" style={{ fontSize: '0.7em' }}>🔧 Tarea Leve</span>
                            </td>
                            <td className="text-end">
                              <span className="fw-bold text-info">
                                {formatearMoneda(trabajoAd.importe || trabajoAd.montoEstimado || 0)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </>
                    );
                  })()}

                  {/* Línea separadora entre obras (excepto la última) */}
                  {idx < obrasDeduplicated.length - 1 && (
                    <tr>
                      <td colSpan="3" className="p-0">
                        <hr className="border-dark my-2" style={{borderWidth: '1px'}} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            });
            })()}
            {/* Trabajos extra huérfanos (sin obra asociada) */}
            {Array.from(trabajosExtra.values()).flat().filter(te => {
              // Verificar si este trabajo extra está asociado a alguna obra en datos
              const obraPadreId = te.presupuesto?.obraOrigenId || te.presupuesto?.obra_origen_id || te.obraOrigenId;
              return !datos.some(obra => {
                const obraIdReal = obra.obraId || obra.id;
                return obraPadreId === obraIdReal;
              });
            }).length > 0 && (
              <>
                <tr>
                  <td colSpan="3" className="p-0">
                    <hr className="border-dark my-2" style={{borderWidth: '1px'}} />
                  </td>
                </tr>
                {Array.from(trabajosExtra.values()).flat()
                  .filter(te => {
                    const obraPadreId = te.presupuesto?.obraOrigenId || te.presupuesto?.obra_origen_id || te.obraOrigenId;
                    return !datos.some(obra => {
                      const obraIdReal = obra.obraId || obra.id;
                      return obraPadreId === obraIdReal;
                    });
                  })
                  .map((trabajoExtra, teIdx) => (
                    <tr key={`trabajo-extra-huerfano-${teIdx}`} className="table-secondary">
                      <td>
                        <i className="bi bi-question-circle me-2 text-muted"></i>
                        <span className="fw-bold" style={{ color: '#856404' }}>📋 Adicional Obra: {trabajoExtra.nombre}</span>
                        <div className="text-muted small">
                          Obra no identificada
                        </div>
                      </td>
                      <td>
                        <span className="badge bg-warning text-dark">Adicional Obra</span>
                      </td>
                      <td className="text-end">
                        <span className="fw-bold" style={{ color: '#856404' }}>
                          {formatearMoneda(trabajoExtra.totalFinal || trabajoExtra.montoTotal || trabajoExtra.totalCalculado || 0)}
                        </span>
                      </td>
                    </tr>
                  ))}
              </>
            )}
            {/* Trabajos adicionales huérfanos (sin obra ni trabajo extra asociado) */}
            {trabajosAdicionales.filter(ta => {
              const obraIdTA = ta.obraId || ta.obra_id;
              const teId = ta.trabajoExtraId || ta.trabajo_extra_id;
              // Excluir si está asociado a alguna obra en datos
              const tieneObraAsociada = datos.some(obra => {
                const obraIdReal = obra.obraId || obra.id;
                return obraIdTA === obraIdReal;
              });
              if (tieneObraAsociada) return false;

              // Excluir si está asociado a algún trabajo extra de alguna obra en datos
              const todosTrabajosExtraIds = Array.from(trabajosExtra.values()).flat().map(te => te.obraId).filter(Boolean);
              const tieneTrabajoExtraAsociado = teId && todosTrabajosExtraIds.includes(teId);
              if (tieneTrabajoExtraAsociado) return false;

              return true;
            }).length > 0 && (
              <>
                <tr>
                  <td colSpan="3" className="p-0">
                    <hr className="border-dark my-2" style={{borderWidth: '1px'}} />
                  </td>
                </tr>
                {trabajosAdicionales
                  .filter(ta => {
                    const obraIdTA = ta.obraId || ta.obra_id;
                    const teId = ta.trabajoExtraId || ta.trabajo_extra_id;
                    const tieneObraAsociada = datos.some(obra => {
                      const obraIdReal = obra.obraId || obra.id;
                      return obraIdTA === obraIdReal;
                    });
                    if (tieneObraAsociada) return false;

                    const todosTrabajosExtraIds = Array.from(trabajosExtra.values()).flat().map(te => te.obraId).filter(Boolean);
                    const tieneTrabajoExtraAsociado = teId && todosTrabajosExtraIds.includes(teId);
                    if (tieneTrabajoExtraAsociado) return false;

                    return true;
                  })
                  .map((trabajoAd, taIdx) => (
                    <tr key={`trabajo-adicional-huerfano-${taIdx}`} className="table-secondary">
                      <td>
                        <i className="bi bi-question-circle me-2 text-muted"></i>
                        <span className="text-info"><strong>{trabajoAd.descripcion}</strong></span>
                        <div className="text-muted small">
                          Prof: {trabajoAd.nombreProfesional} | Obra no identificada
                        </div>
                      </td>
                      <td>
                        <span className="badge bg-info text-dark">🔧 Tarea Leve</span>
                      </td>
                      <td className="text-end">
                        <span className="text-primary fw-bold">
                          {formatearMoneda(trabajoAd.importe || 0)}
                        </span>
                      </td>
                    </tr>
                  ))}
              </>
            )}
          </tbody>
          <tfoot className="table-dark">
            <tr>
              <td colSpan="2" className="text-end fw-bold fs-5">TOTAL CONSOLIDADO:</td>
              <td className="text-end">
                <strong className="text-light fs-4">
                  {formatearMoneda(totalCompleto)}
                </strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  const renderCobros = () => {
    if (cargandoCobrosEmpresa) {
      return (
        <div className="text-center py-4">
          <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
          <p className="mt-2 text-muted">Cargando cobros de la empresa...</p>
        </div>
      );
    }

    if (!cobrosEmpresa || cobrosEmpresa.length === 0) {
      return (
        <div className="alert alert-info">
          <i className="bi bi-info-circle me-2"></i>
          No hay cobros registrados para esta empresa.
        </div>
      );
    }

    const totalCobrado = cobrosEmpresa.reduce((sum, c) => sum + (parseFloat(c.montoTotal) || 0), 0);
    const totalAsignado = cobrosEmpresa.reduce((sum, c) => {
      const disponible = parseFloat(c.montoDisponible) || 0;
      const total = parseFloat(c.montoTotal) || 0;
      return sum + (total - disponible);
    }, 0);
    const totalDisponible = cobrosEmpresa.reduce((sum, c) => sum + (parseFloat(c.montoDisponible) || 0), 0);

    return (
      <div className="table-responsive">
        <table className="table table-hover table-striped">
          <thead className="table-success">
            <tr>
              <th>Fecha</th>
              <th>Descripción / Método</th>
              <th className="text-end">Monto Cobrado</th>
              <th className="text-end">Asignado a Obras</th>
              <th className="text-end">Saldo Disponible</th>
            </tr>
          </thead>
          <tbody>
            {cobrosEmpresa.map((cobro, idx) => {
              const montoTotal = parseFloat(cobro.montoTotal) || 0;
              const montoDisponible = parseFloat(cobro.montoDisponible) || 0;
              const montoAsignado = montoTotal - montoDisponible;
              const tieneDisponible = montoDisponible > 0;

              return (
                <tr key={cobro.id || idx} className={tieneDisponible ? '' : 'table-light'}>
                  <td>
                    <strong>{cobro.fechaCobro ? new Date(cobro.fechaCobro).toLocaleDateString('es-AR') : '-'}</strong>
                  </td>
                  <td>
                    <div>{cobro.descripcion || 'Sin descripción'}</div>
                    {cobro.metodoPago && (
                      <span className="badge bg-secondary ms-0">{cobro.metodoPago}</span>
                    )}
                    {cobro.numeroComprobante && (
                      <small className="text-muted ms-2">#{cobro.numeroComprobante}</small>
                    )}
                  </td>
                  <td className="text-end">
                    <strong className="text-success">{formatearMoneda(montoTotal)}</strong>
                  </td>
                  <td className="text-end">
                    {montoAsignado > 0
                      ? <span className="text-primary">{formatearMoneda(montoAsignado)}</span>
                      : <span className="text-muted">—</span>
                    }
                  </td>
                  <td className="text-end">
                    {tieneDisponible
                      ? <strong className="text-warning">{formatearMoneda(montoDisponible)}</strong>
                      : <span className="text-muted text-success fw-bold">✓ Asignado</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="table-success">
            <tr className="fw-bold">
              <td colSpan="2" className="text-end">TOTAL:</td>
              <td className="text-end">
                <strong className="text-success fs-5">{formatearMoneda(totalCobrado)}</strong>
              </td>
              <td className="text-end">
                <strong className="text-primary fs-5">{formatearMoneda(totalAsignado)}</strong>
              </td>
              <td className="text-end">
                <strong className="text-warning fs-5">{formatearMoneda(totalDisponible)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  const renderPagos = () => {
    // ✅ CORREGIDO: Crear Set solo con IDs de presupuestos que son trabajos extra
    const idsPresupuestosTrabajosExtra = new Set();
    trabajosExtra.forEach(tesObra => {
      tesObra.forEach(te => {
        // Solo agregar el ID del presupuesto del TE (no el obraId)
        if (te.id) idsPresupuestosTrabajosExtra.add(te.id);
        if (te.presupuestoId) idsPresupuestosTrabajosExtra.add(te.presupuestoId);
      });
    });

    // Filtrar solo presupuestos que son trabajos extra, NO obras principales
    const obrasFiltradas = datos.filter(obra => {
      const presupuestoIdActual = obra.presupuestoId || obra.id;
      const esPresupuestoTrabajoExtra = idsPresupuestosTrabajosExtra.has(presupuestoIdActual);

      if (esPresupuestoTrabajoExtra) {
        console.log(`🚫 [Pagos] Excluyendo presupuesto "${obra.nombreObra}" (presupuestoId: ${presupuestoIdActual}) - es un trabajo extra`);
      }

      return !esPresupuestoTrabajoExtra;
    });

    // Deduplicar Obras Independientes por nombre+dirección
    const oiMap = new Map();
    const obrasNormales = [];
    obrasFiltradas.forEach(obra => {
      if (obra.esObraIndependiente) {
        const clave = (obra.nombreObra || obra.direccion) ? `${obra.nombreObra}_${obra.direccion}`.trim() : `id_${obra.id}`;
        if (!oiMap.has(clave)) oiMap.set(clave, obra);
      } else {
        obrasNormales.push(obra);
      }
    });
    const obrasPrincipales = [...obrasNormales, ...Array.from(oiMap.values())];

    // Totales para el footer
    const totalPagosCount = obrasPrincipales.reduce((s, o) => s + (o.cantidadPagos || 0), 0);
    const totalPagado = obrasPrincipales.reduce((s, o) => s + (o.totalPagado || 0), 0);
    const totalPendiente = obrasPrincipales.reduce((s, o) => s + (o.pagosPendientes || 0), 0);

    return (
      <>
        <div className="table-responsive">
          <table className="table table-hover">
            <thead className="table-primary">
              <tr>
                <th>Obra</th>
                <th className="text-center">Cantidad de Pagos</th>
                <th className="text-end">Total Pagado</th>
                <th className="text-end">Pendiente</th>
                <th className="text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {obrasPrincipales.map((obra, idx) => {
                const obraIdReal = obra.obraId || obra.id;
                const trabajosExtraObra = trabajosExtra.get(obraIdReal) || [];
                const trabajosExtraObraIds = trabajosExtraObra.flatMap(te => [te.obraId, te.id]).filter(Boolean);
                const trabajosAdicionalesObra = trabajosAdicionales.filter(ta => {
                  const teId = ta.trabajoExtraId || ta.trabajo_extra_id;
                  const obraIdTA = ta.obraId || ta.obra_id;
                  if (teId && trabajosExtraObraIds.includes(teId)) return true;
                  if (!teId && obraIdTA === obraIdReal) return true;
                  return false;
                });
                const claveExtra = `pagos_extra_${idx}`;
                const claveAdic = `pagos_adic_${idx}`;
                const colapsadoExtra = !!gruposColapsados[claveExtra];
                const colapsadoAdic = !!gruposColapsados[claveAdic];

                return (
                  <React.Fragment key={idx}>
                    {/* Fila obra principal */}
                    <tr style={{ borderBottom: (trabajosExtraObra.length > 0 || trabajosAdicionalesObra.length > 0) ? '1px solid rgba(253, 126, 20, 0.45)' : undefined }}>
                      <td>
                        <strong>{obra.nombreObra}</strong>
                        {obra.esObraIndependiente && (
                          <span className="badge bg-warning text-dark ms-2" style={{ fontSize: '0.7em' }}>
                            <i className="bi bi-diagram-3 me-1"></i>Obra Independiente
                          </span>
                        )}
                      </td>
                      <td className="text-center">
                        <span className="badge bg-info">{obra.cantidadPagos || 0}</span>
                      </td>
                      <td className="text-end">
                        <strong className="text-primary">{formatearMoneda(obra.totalPagado || 0)}</strong>
                      </td>
                      <td className="text-end">
                        <span className="text-warning">{formatearMoneda(obra.pagosPendientes || 0)}</span>
                      </td>
                      <td className="text-center">
                        <button className="btn btn-sm btn-outline-primary" onClick={cargarDetallePagos} disabled={cargandoPagos}>
                          {cargandoPagos ? <><span className="spinner-border spinner-border-sm me-1"></span>Cargando...</> : <><i className="bi bi-eye me-1"></i>Ver Detalle</>}
                        </button>
                      </td>
                    </tr>

                    {/* Subgrupo: Adicionales Obra */}
                    {trabajosExtraObra.length > 0 && (
                      <>
                        <tr
                          onClick={() => setGruposColapsados(p => ({ ...p, [claveExtra]: !p[claveExtra] }))}
                          style={{ backgroundColor: '#fff3cd', cursor: 'pointer', borderLeft: '5px solid #ffc107', borderBottom: '1px solid rgba(253, 126, 20, 0.45)' }}
                        >
                          <td colSpan="5" className="py-1 px-3 small">
                            <span className="fw-bold" style={{ color: '#856404' }}>
                              <i className={`fas fa-chevron-${colapsadoExtra ? 'right' : 'down'} me-2`} style={{ fontSize: '0.75em' }}></i>
                              📋 Adicionales Obra
                              <span className="badge ms-2" style={{ fontSize: '0.7em', backgroundColor: '#ffc107', color: '#000' }}>{trabajosExtraObra.length}</span>
                            </span>
                            <span className="text-muted ms-3 small">Clic para {colapsadoExtra ? 'mostrar' : 'ocultar'}</span>
                          </td>
                        </tr>
                        {!colapsadoExtra && trabajosExtraObra.map((te, tIdx) => {
                          const tareasLevesDelTE = trabajosAdicionalesObra.filter(ta => {
                            const teId = ta.trabajoExtraId || ta.trabajo_extra_id;
                            return teId && (teId === te.id || teId === te.obraId);
                          });
                          return (
                            <React.Fragment key={`te_${idx}_${tIdx}`}>
                              <tr style={{ borderLeft: '5px solid #ffc107', borderBottom: tareasLevesDelTE.length > 0 ? '1px dashed rgba(253, 126, 20, 0.3)' : '1px solid rgba(253, 126, 20, 0.45)' }}>
                                <td className="ps-3">
                                  <small><strong>{te.nombre}</strong></small>
                                  {tareasLevesDelTE.length > 0 && <small className="text-info ms-1">({tareasLevesDelTE.length} 🔧)</small>}
                                </td>
                                <td className="text-center"><span className="badge bg-secondary">—</span></td>
                                <td className="text-end"><small className="text-muted">—</small></td>
                                <td className="text-end"><small className="text-muted">—</small></td>
                                <td></td>
                              </tr>
                              {tareasLevesDelTE.map((ta, taIdx) => (
                                <tr key={`te${tIdx}_ta${taIdx}`} style={{ borderLeft: '7px solid #fd7e14', backgroundColor: '#f0f9ff', borderBottom: '1px solid rgba(253, 126, 20, 0.3)' }}>
                                  <td className="ps-4">
                                    <small className="text-info">
                                      <i className="bi bi-arrow-return-right me-1" style={{ fontSize: '0.7em' }}></i>
                                      <strong>{ta.nombre || ta.descripcion}</strong>
                                    </small>
                                  </td>
                                  <td className="text-center"><span className="badge bg-info" style={{ fontSize: '0.65em' }}>🔧</span></td>
                                  <td className="text-end"><small className="text-muted">—</small></td>
                                  <td className="text-end"><small className="text-muted">—</small></td>
                                  <td></td>
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })}
                      </>
                    )}

                    {/* Subgrupo: Tareas Leves Directas */}
                    {(() => {
                      const tareasLevesDirectas = trabajosAdicionalesObra.filter(ta => {
                        const teId = ta.trabajoExtraId || ta.trabajo_extra_id;
                        return !teId;
                      });
                      if (tareasLevesDirectas.length === 0) return null;
                      return (
                        <>
                          <tr
                            onClick={() => setGruposColapsados(p => ({ ...p, [claveAdic]: !p[claveAdic] }))}
                            style={{ backgroundColor: '#dbeafe', cursor: 'pointer', borderLeft: '5px solid #1d4ed8', borderBottom: '1px solid rgba(253, 126, 20, 0.45)' }}
                          >
                            <td colSpan="5" className="py-1 px-3 small">
                              <span className="fw-bold text-primary">
                                <i className={`fas fa-chevron-${colapsadoAdic ? 'right' : 'down'} me-2`} style={{ fontSize: '0.75em' }}></i>
                                🔧 Tareas Leves Directas
                                <span className="badge bg-primary ms-2" style={{ fontSize: '0.7em' }}>{tareasLevesDirectas.length}</span>
                              </span>
                              <span className="text-muted ms-3 small">Clic para {colapsadoAdic ? 'mostrar' : 'ocultar'}</span>
                            </td>
                          </tr>
                          {!colapsadoAdic && tareasLevesDirectas.map((ta, taIdx) => (
                            <tr key={`ta_directa_${idx}_${taIdx}`} style={{ borderLeft: '7px solid #fd7e14', borderBottom: '1px solid rgba(253, 126, 20, 0.45)' }}>
                              <td className="ps-3">
                                <small className="text-info"><strong>{ta.nombre || ta.descripcion}</strong></small>
                              </td>
                              <td className="text-center"><span className="badge bg-secondary">—</span></td>
                              <td className="text-end"><small className="text-muted">—</small></td>
                              <td className="text-end"><small className="text-muted">—</small></td>
                              <td></td>
                            </tr>
                          ))}
                        </>
                      );
                    })()}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot className="table-light">
              <tr>
                <td className="text-end"><strong>TOTAL:</strong></td>
                <td className="text-center">
                  <span className="badge bg-info fs-6">{totalPagosCount}</span>
                </td>
                <td className="text-end">
                  <strong className="text-primary fs-5">{formatearMoneda(totalPagado)}</strong>
                </td>
                <td className="text-end">
                  <strong className="text-warning fs-5">{formatearMoneda(totalPendiente)}</strong>
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

      {/* Modal anidado para mostrar detalle de pagos */}
      {mostrandoDetallePagos && (
        <div
          className="modal show d-block"
          style={{ zIndex: 3000, backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setMostrandoDetallePagos(false)}
        >
          <div
            className="modal-dialog modal-xl modal-dialog-scrollable"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content">
              <div className="modal-header bg-info text-white">
                <h5 className="modal-title">
                  <i className="bi bi-receipt me-2"></i>
                  Detalle de Pagos Realizados
                </h5>
                <button
                  type="button"
                  className="btn btn-light btn-sm ms-auto"
                  onClick={() => setMostrandoDetallePagos(false)}
                >
                  Cerrar
                </button>
              </div>
              <div className="modal-body" style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
                {pagosDetallados.length === 0 ? (
                  <div className="alert alert-info">
                    <i className="bi bi-info-circle me-2"></i>
                    No se encontraron pagos registrados para esta empresa.
                  </div>
                ) : (
                  <>
                    <div className="alert alert-success mb-3">
                      <div className="d-flex justify-content-between align-items-center">
                        <span>
                          <i className="bi bi-check-circle me-2"></i>
                          Total de pagos encontrados: <strong>{pagosDetallados.length}</strong>
                        </span>
                        <span className="fs-5">
                          Total: <strong className="text-primary">{formatearMoneda(pagosDetallados.reduce((sum, p) => sum + (p.monto || 0), 0))}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="table-responsive">
                      <table className="table table-sm table-hover table-striped">
                        <thead className="table-info">
                          <tr>
                            <th style={{ width: '80px' }}>ID</th>
                            <th>Fecha</th>
                            <th>Tipo de Pago</th>
                            <th>Descripción</th>
                            <th>Obra</th>
                            <th className="text-end">Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagosDetallados.map((pago, idx) => (
                            <tr key={idx}>
                              <td>
                                <span className="badge bg-secondary">#{pago.id}</span>
                              </td>
                              <td>
                                <small>
                                  {pago.fechaPago
                                    ? new Date(pago.fechaPago).toLocaleDateString('es-AR', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit'
                                      })
                                    : 'N/A'}
                                </small>
                              </td>
                              <td>
                                <span className={`badge ${
                                  pago.tipoItem === 'PROFESIONAL_OBRA' ? 'bg-primary' :
                                  pago.tipoItem === 'MATERIAL' ? 'bg-warning text-dark' :
                                  pago.tipoItem === 'GASTO_GENERAL' ? 'bg-danger' :
                                  pago.tipoItem === 'TRABAJO_EXTRA' ? 'bg-success' :
                                  'bg-secondary'
                                }`}>
                                  {pago.tipoItem === 'PROFESIONAL_OBRA' ? 'Profesional' :
                                   pago.tipoItem === 'MATERIAL' ? 'Material' :
                                   pago.tipoItem === 'GASTO_GENERAL' ? 'Gasto General' :
                                   pago.tipoItem === 'TRABAJO_EXTRA' ? 'Trabajo Extra' :
                                   pago.tipoItem || 'N/A'}
                                </span>
                              </td>
                              <td>
                                <div className="text-truncate" style={{ maxWidth: '250px' }}>
                                  {pago.descripcion || pago.observaciones || '-'}
                                </div>
                              </td>
                              <td>
                                <strong>{pago.nombreObra || pago.obra?.nombre || 'N/A'}</strong>
                              </td>
                              <td className="text-end">
                                <strong className="text-primary">
                                  {formatearMoneda(pago.monto || 0)}
                                </strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="table-light">
                          <tr>
                            <td colSpan="5" className="text-end"><strong>TOTAL PAGADO:</strong></td>
                            <td className="text-end">
                              <strong className="text-primary fs-5">
                                {formatearMoneda(pagosDetallados.reduce((sum, p) => sum + (p.monto || 0), 0))}
                              </strong>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Resumen por tipo de pago */}
                    <div className="mt-4">
                      <h6 className="mb-3">
                        <i className="bi bi-pie-chart me-2"></i>
                        Resumen por Tipo de Pago
                      </h6>
                      <div className="row g-3">
                        {['PROFESIONAL_OBRA', 'MATERIAL', 'GASTO_GENERAL', 'TRABAJO_EXTRA'].map(tipo => {
                          const pagosTipo = pagosDetallados.filter(p => p.tipoItem === tipo);
                          const totalTipo = pagosTipo.reduce((sum, p) => sum + (p.monto || 0), 0);

                          if (pagosTipo.length === 0) return null;

                          return (
                            <div key={tipo} className="col-md-6">
                              <div className={`card border-${
                                tipo === 'PROFESIONAL_OBRA' ? 'primary' :
                                tipo === 'MATERIAL' ? 'warning' :
                                tipo === 'GASTO_GENERAL' ? 'danger' :
                                'success'
                              }`}>
                                <div className="card-body">
                                  <h6 className={`card-title text-${
                                    tipo === 'PROFESIONAL_OBRA' ? 'primary' :
                                    tipo === 'MATERIAL' ? 'warning' :
                                    tipo === 'GASTO_GENERAL' ? 'danger' :
                                    'success'
                                  }`}>
                                    {tipo === 'PROFESIONAL_OBRA' ? '👷 Profesionales' :
                                     tipo === 'MATERIAL' ? '🧱 Materiales' :
                                     tipo === 'GASTO_GENERAL' ? '💰 Gastos Generales' :
                                     '🔧 Trabajos Extra'}
                                  </h6>
                                  <div className="d-flex justify-content-between align-items-center">
                                    <span className="text-muted">
                                      {pagosTipo.length} pago{pagosTipo.length !== 1 ? 's' : ''}
                                    </span>
                                    <strong className="fs-5">{formatearMoneda(totalTipo)}</strong>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setMostrandoDetallePagos(false)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
  };

  const renderSaldoPorCobrar = () => {
    const cargando = cargandoTrabajosAdicionales || cargandoTrabajosExtra;
    if (cargando) {
      return (
        <div className="text-center py-4">
          <div className="spinner-border text-warning" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
          <p className="mt-2 text-muted">Cargando datos de presupuesto...</p>
        </div>
      );
    }

    // ── Paso 1: Deduplicar obras del desglose ────────────────────────────────────
    const oiMap = new Map();
    const obrasNormales = [];

    // ✅ CORREGIDO: Crear Set solo con IDs de presupuestos que son trabajos extra
    const idsPresupuestosTrabajosExtra = new Set();
    trabajosExtra.forEach(tesObra => {
      tesObra.forEach(te => {
        // Solo agregar el ID del presupuesto del TE (no el obraId)
        if (te.id) idsPresupuestosTrabajosExtra.add(te.id);
        if (te.presupuestoId) idsPresupuestosTrabajosExtra.add(te.presupuestoId);
      });
    });

    datos.forEach(obra => {
      // Excluir filas que son trabajos extra (ya los agregamos desde el Map)
      const esTE = obra.esObraTrabajoExtra || obra.esPresupuestoTrabajoExtra ||
                   obra.obra?.esObraTrabajoExtra || obra.es_presupuesto_trabajo_extra;
      if (esTE) return;

      // ✅ CORREGIDO: Solo excluir presupuestos que son trabajos extra, NO obras principales
      const presupuestoIdActual = obra.presupuestoId || obra.id;
      if (idsPresupuestosTrabajosExtra.has(presupuestoIdActual)) {
        console.log(`🚫 [SaldoPorCobrar] Excluyendo presupuesto "${obra.nombreObra}" (presupuestoId: ${presupuestoIdActual}) - es un trabajo extra`);
        return;
      }

      if (obra.esObraIndependiente) {
        const clave = `${obra.nombreObra || ''}_${obra.obraId || obra.id || ''}`.trim();
        const existente = oiMap.get(clave);
        const montoActual = parseFloat(obra.totalPresupuesto || 0);
        if (!existente || montoActual > parseFloat(existente.totalPresupuesto || 0)) {
          oiMap.set(clave, obra);
        }
      } else {
        obrasNormales.push(obra);
      }
    });

    const datosFiltrados = [...obrasNormales, ...Array.from(oiMap.values())];

    // ── Paso 2: TAs deduplicados ────────────────────────────────────────────────
    const taIdsContados = new Set();

    // ── Paso 3: Calcular totales ────────────────────────────────────────────────
    let totalPresupuestado = 0;

    // Obras principales + sus TEs
    datosFiltrados.forEach(obra => {
      const obraId = obra.obraId || obra.id;
      totalPresupuestado += parseFloat(obra.totalPresupuesto || 0);

      // TEs de esta obra (del Map de estado)
      const tesObra = trabajosExtra.get(obraId) || [];
      tesObra.forEach(te => {
        totalPresupuestado += parseFloat(te.totalCalculado || 0);
      });

      // TAs de esta obra (sin duplicar)
      if (!obra.esObraIndependiente) {
        const tesObraIds = tesObra.map(te => te.obraId).filter(Boolean);
        trabajosAdicionales
          .filter(ta =>
            ta.obraId === obraId ||
            (ta.trabajoExtraId && tesObraIds.includes(ta.trabajoExtraId))
          )
          .forEach(ta => {
            if (!taIdsContados.has(ta.id)) {
              totalPresupuestado += parseFloat(ta.importe || 0);
              taIdsContados.add(ta.id);
            }
          });
      }
    });

    // TAs huérfanos (sin obraId ni trabajoExtraId que matcheen)
    const todosTeIds = Array.from(trabajosExtra.values()).flat().map(te => te.obraId).filter(Boolean);
    trabajosAdicionales
      .filter(ta => {
        const tieneObra = datosFiltrados.some(o => (o.obraId || o.id) === ta.obraId);
        const tieneTE = ta.trabajoExtraId && todosTeIds.includes(ta.trabajoExtraId);
        return !tieneObra && !tieneTE;
      })
      .forEach(ta => {
        if (!taIdsContados.has(ta.id)) {
          totalPresupuestado += parseFloat(ta.importe || 0);
          taIdsContados.add(ta.id);
        }
      });

    const totalCobradoEmpresa = parseFloat(estadisticas?.totalCobrado) || parseFloat(estadisticas?.totalCobradoEmpresa) || 0;
    const totalSaldoPorCobrar = Math.max(0, totalPresupuestado - totalCobradoEmpresa);

    // ── Paso 4: Render ──────────────────────────────────────────────────────────
    return (
      <div className="table-responsive">
        <table className="table table-hover table-striped">
          <thead className="table-warning">
            <tr>
              <th>Tipo</th>
              <th>Obra / Trabajo</th>
              <th className="text-end">Presupuestado</th>
              <th className="text-end">Cobrado Asignado</th>
              <th className="text-end">Saldo por Cobrar</th>
            </tr>
          </thead>
          <tbody>
            {datosFiltrados.map((obra, idx) => {
              const obraId = obra.obraId || obra.id;
              const presupuesto = parseFloat(obra.totalPresupuesto || 0);
              const cobradoAsignado = parseFloat(obra.totalCobrado || 0);
              const saldoObra = Math.max(0, presupuesto - cobradoAsignado);
              const tesObra = trabajosExtra.get(obraId) || [];

              // TAs de esta obra
              const tesObraIds = tesObra.map(te => te.obraId).filter(Boolean);
              const tasObra = !obra.esObraIndependiente
                ? trabajosAdicionales.filter(ta => {
                    const teId = ta.trabajoExtraId || ta.trabajo_extra_id;
                    const obraIdTA = ta.obraId || ta.obra_id;
                    // ✅ Priorizar trabajoExtraId para evitar duplicados
                    if (teId && tesObraIds.includes(teId)) return true;
                    if (!teId && obraIdTA === obraId) return true;
                    return false;
                  })
                : [];

              const claveExtra = `saldo_extra_${idx}`;
              const claveAdic = `saldo_adic_${idx}`;
              const colapsadoExtra = !!gruposColapsados[claveExtra];
              const colapsadoAdic = !!gruposColapsados[claveAdic];

              return (
                <React.Fragment key={`obra-${idx}`}>
                  {/* Obra principal u OI */}
                  <tr style={{ borderBottom: (tesObra.length > 0 || tasObra.length > 0) ? '1px solid rgba(253, 126, 20, 0.45)' : undefined }}>
                    <td>
                      <span className={`badge ${obra.esObraIndependiente ? 'bg-info' : 'bg-primary'}`}>
                        {obra.esObraIndependiente ? 'Independiente' : 'Principal'}
                      </span>
                    </td>
                    <td><strong>{obra.nombreObra}</strong></td>
                    <td className="text-end">{formatearMoneda(presupuesto)}</td>
                    <td className="text-end text-success">
                      {cobradoAsignado > 0 ? formatearMoneda(cobradoAsignado) : <span className="text-muted">—</span>}
                    </td>
                    <td className="text-end">
                      <strong className={saldoObra > 0 ? 'text-danger' : 'text-success'}>
                        {saldoObra > 0 ? formatearMoneda(saldoObra) : '✓'}
                      </strong>
                    </td>
                  </tr>

                  {/* Subgrupo: Adicionales Obra (Trabajos Extra) */}
                  {tesObra.length > 0 && (
                    <>
                      <tr
                        onClick={() => setGruposColapsados(p => ({ ...p, [claveExtra]: !p[claveExtra] }))}
                        style={{ backgroundColor: '#fff3cd', cursor: 'pointer', borderLeft: '5px solid #ffc107', borderBottom: '1px solid rgba(253, 126, 20, 0.45)' }}
                      >
                        <td colSpan="5" className="py-1 px-3 small">
                          <span className="fw-bold" style={{ color: '#856404' }}>
                            <i className={`fas fa-chevron-${colapsadoExtra ? 'right' : 'down'} me-2`} style={{ fontSize: '0.75em' }}></i>
                            📋 Adicionales Obra
                            <span className="badge ms-2" style={{ fontSize: '0.7em', backgroundColor: '#ffc107', color: '#000' }}>{tesObra.length}</span>
                          </span>
                          <span className="text-muted ms-3 small">Clic para {colapsadoExtra ? 'mostrar' : 'ocultar'}</span>
                        </td>
                      </tr>
                      {!colapsadoExtra && tesObra.map((te, teIdx) => {
                        const tareasLevesDelTE = tasObra.filter(ta => {
                          const teId = ta.trabajoExtraId || ta.trabajo_extra_id;
                          return teId && (teId === te.id || teId === te.obraId);
                        });
                        return (
                          <React.Fragment key={`te-${teIdx}`}>
                            <tr style={{ borderLeft: '5px solid #ffc107', borderBottom: tareasLevesDelTE.length > 0 ? '1px dashed rgba(253, 126, 20, 0.3)' : '1px solid rgba(253, 126, 20, 0.45)' }}>
                              <td>
                                <span className="badge" style={{ backgroundColor: '#ffc107', color: '#000' }}>📋 Adicional</span>
                              </td>
                              <td className="ps-3">
                                <i className="bi bi-arrow-return-right me-1 text-muted"></i>
                                <small><strong>{te.nombre}</strong></small>
                                {tareasLevesDelTE.length > 0 && <small className="text-info ms-1">({tareasLevesDelTE.length} 🔧)</small>}
                              </td>
                              <td className="text-end"><small>{formatearMoneda(te.totalCalculado || 0)}</small></td>
                              <td className="text-end"><span className="text-muted small">—</span></td>
                              <td className="text-end"><small className="text-danger">{formatearMoneda(te.totalCalculado || 0)}</small></td>
                            </tr>
                            {tareasLevesDelTE.map((ta, taIdx) => (
                              <tr key={`te${teIdx}_ta${taIdx}`} style={{ borderLeft: '7px solid #fd7e14', backgroundColor: '#f0f9ff', borderBottom: '1px solid rgba(253, 126, 20, 0.3)' }}>
                                <td></td>
                                <td className="ps-4">
                                  <i className="bi bi-arrow-return-right me-1" style={{ fontSize: '0.7em', color: '#0ea5e9' }}></i>
                                  <small className="text-info">{ta.descripcion || ta.nombre || `Tarea #${ta.id}`}</small>
                                </td>
                                <td className="text-end"><small className="text-info">{formatearMoneda(ta.importe || 0)}</small></td>
                                <td className="text-end"><span className="text-muted small">—</span></td>
                                <td className="text-end"><small className="text-info">{formatearMoneda(ta.importe || 0)}</small></td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </>
                  )}

                  {/* Subgrupo: Tareas Leves Directas */}
                  {(() => {
                    const tareasLevesDirectas = tasObra.filter(ta => {
                      const teId = ta.trabajoExtraId || ta.trabajo_extra_id;
                      return !teId;
                    });
                    if (tareasLevesDirectas.length === 0) return null;
                    return (
                      <>
                        <tr
                          onClick={() => setGruposColapsados(p => ({ ...p, [claveAdic]: !p[claveAdic] }))}
                          style={{ backgroundColor: '#dbeafe', cursor: 'pointer', borderLeft: '5px solid #1d4ed8', borderBottom: '1px solid rgba(253, 126, 20, 0.45)' }}
                        >
                          <td colSpan="5" className="py-1 px-3 small">
                            <span className="fw-bold text-primary">
                              <i className={`fas fa-chevron-${colapsadoAdic ? 'right' : 'down'} me-2`} style={{ fontSize: '0.75em' }}></i>
                              🔧 Tareas Leves Directas
                              <span className="badge bg-primary ms-2" style={{ fontSize: '0.7em' }}>{tareasLevesDirectas.length}</span>
                            </span>
                            <span className="text-muted ms-3 small">Clic para {colapsadoAdic ? 'mostrar' : 'ocultar'}</span>
                          </td>
                        </tr>
                        {!colapsadoAdic && tareasLevesDirectas.map((ta, taIdx) => (
                          <tr key={`ta-directa-${taIdx}`} style={{ borderLeft: '7px solid #fd7e14', borderBottom: '1px solid rgba(253, 126, 20, 0.45)' }}>
                            <td>
                              <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#fff' }}>🔧 Tarea Leve</span>
                            </td>
                            <td className="ps-3">
                              <i className="bi bi-arrow-return-right me-1 text-muted"></i>
                              <small>{ta.descripcion || ta.nombre || `Tarea #${ta.id}`}</small>
                            </td>
                            <td className="text-end"><small>{formatearMoneda(ta.importe || 0)}</small></td>
                            <td className="text-end"><span className="text-muted small">—</span></td>
                            <td className="text-end"><small className="text-danger">{formatearMoneda(ta.importe || 0)}</small></td>
                          </tr>
                        ))}
                      </>
                    );
                  })()}
                </React.Fragment>
              );
            })}

            {/* TAs huérfanos */}
            {trabajosAdicionales
              .filter(ta => {
                const tieneObra = datosFiltrados.some(o => (o.obraId || o.id) === ta.obraId);
                const tieneTE = ta.trabajoExtraId && todosTeIds.includes(ta.trabajoExtraId);
                return !tieneObra && !tieneTE;
              })
              .map((ta, idx) => (
                <tr key={`ta-huerfano-${idx}`} style={{ borderLeft: '7px solid #fd7e14', borderBottom: '1px solid rgba(253, 126, 20, 0.45)' }}>
                  <td>
                    <span className="badge" style={{ backgroundColor: '#fd7e14', color: '#fff' }}>🔧 Tarea Leve</span>
                  </td>
                  <td><small>{ta.descripcion || ta.nombre || `Tarea #${ta.id}`}</small></td>
                  <td className="text-end"><small>{formatearMoneda(ta.importe || 0)}</small></td>
                  <td className="text-end"><span className="text-muted small">—</span></td>
                  <td className="text-end"><small className="text-danger">{formatearMoneda(ta.importe || 0)}</small></td>
                </tr>
              ))}
          </tbody>
          <tfoot className="table-warning">
            <tr>
              <td colSpan="2" className="text-end"><strong>TOTAL PRESUPUESTADO:</strong></td>
              <td className="text-end fw-bold">{formatearMoneda(totalPresupuestado)}</td>
              <td></td>
              <td className="text-end" rowSpan="3">
                <strong className="text-danger fs-5">{formatearMoneda(totalSaldoPorCobrar)}</strong>
              </td>
            </tr>
            <tr>
              <td colSpan="2" className="text-end"><strong>TOTAL COBRADO A EMPRESA:</strong></td>
              <td className="text-end text-success fw-bold">{formatearMoneda(totalCobradoEmpresa)}</td>
              <td></td>
            </tr>
            <tr>
              <td colSpan="2" className="text-end"><strong>SALDO POR COBRAR:</strong></td>
              <td className="text-end text-danger fw-bold">{formatearMoneda(totalSaldoPorCobrar)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  const renderDeficit = () => {
    // Crear Set con todos los IDs de trabajos extra para detección rápida
    const idsTrabajosExtra = new Set();
    trabajosExtra.forEach(tesObra => {
      tesObra.forEach(te => {
        if (te.obraId) idsTrabajosExtra.add(te.obraId);
        if (te.id) idsTrabajosExtra.add(te.id);
      });
    });

    // Filtrar solo obras con déficit (balance negativo) y excluir TEs
    const obrasConDeficit = datos.filter(obra => {
      // Verificar si es un TE
      const obraIdActual = obra.obraId || obra.id;
      const presupuestoIdActual = obra.presupuestoId || obra.id;
      const esTE = idsTrabajosExtra.has(obraIdActual) || idsTrabajosExtra.has(presupuestoIdActual);

      if (esTE) return false;

      // Verificar si tiene déficit
      const balance = (obra.totalCobrado || 0) - (obra.totalPagado || 0) - (obra.totalRetirado || 0);
      return balance < 0;
    });

    if (obrasConDeficit.length === 0) {
      return (
        <div className="alert alert-success">
          <i className="bi bi-check-circle me-2"></i>
          <strong>¡Excelente!</strong> No hay obras con déficit. Todas las obras tienen saldo positivo o neutro.
        </div>
      );
    }

    return (
      <div className="table-responsive">
        <table className="table table-hover table-striped">
          <thead className="table-danger">
            <tr>
              <th>Obra</th>
              <th className="text-end">Total Cobrado</th>
              <th className="text-end">Total Pagado</th>
              <th className="text-end">Total Retirado</th>
              <th className="text-end">Déficit</th>
            </tr>
          </thead>
          <tbody>
            {obrasConDeficit.map((obra, idx) => {
              const balance = (obra.totalCobrado || 0) - (obra.totalPagado || 0) - (obra.totalRetirado || 0);
              return (
                <tr key={idx} className="table-danger table-danger-subtle">
                  <td>
                    <strong>{obra.nombreObra}</strong>
                    <div className="text-muted small">
                      <i className="bi bi-exclamation-triangle me-1"></i>
                      Requiere atención urgente
                    </div>
                  </td>
                  <td className="text-end text-success">{formatearMoneda(obra.totalCobrado || 0)}</td>
                  <td className="text-end text-danger">{formatearMoneda(obra.totalPagado || 0)}</td>
                  <td className="text-end text-warning">{formatearMoneda(obra.totalRetirado || 0)}</td>
                  <td className="text-end">
                    <strong className="text-danger fs-6">
                      {formatearMoneda(balance)}
                    </strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="table-light">
            <tr>
              <td className="text-end"><strong>TOTAL DÉFICIT:</strong></td>
              <td className="text-end text-success">
                {formatearMoneda(obrasConDeficit.reduce((sum, o) => sum + (o.totalCobrado || 0), 0))}
              </td>
              <td className="text-end text-danger">
                {formatearMoneda(obrasConDeficit.reduce((sum, o) => sum + (o.totalPagado || 0), 0))}
              </td>
              <td className="text-end text-warning">
                {formatearMoneda(obrasConDeficit.reduce((sum, o) => sum + (o.totalRetirado || 0), 0))}
              </td>
              <td className="text-end">
                <strong className="text-danger fs-5">
                  {formatearMoneda(
                    obrasConDeficit.reduce((sum, o) => sum + ((o.totalCobrado || 0) - (o.totalPagado || 0) - (o.totalRetirado || 0)), 0)
                  )}
                </strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  const renderSaldoDisponible = () => {
    const totalCobrado = estadisticas?.totalCobradoEmpresa || estadisticas?.totalCobrado || 0;

    // ✅ CORREGIDO: Crear Set solo con IDs de presupuestos que son trabajos extra
    const idsPresupuestosTrabajosExtra = new Set();
    trabajosExtra.forEach(tesObra => {
      tesObra.forEach(te => {
        // Solo agregar el ID del presupuesto del TE (no el obraId)
        if (te.id) idsPresupuestosTrabajosExtra.add(te.id);
        if (te.presupuestoId) idsPresupuestosTrabajosExtra.add(te.presupuestoId);
      });
    });

    // ── Paso 1: Filtrar solo presupuestos que son trabajos extra, NO obras principales ─────────────────────────
    const oiMapDatos = new Map();
    const obrasNormalesSD = [];
    datos.forEach(obra => {
      const presupuestoIdActual = obra.presupuestoId || obra.id;
      const esPresupuestoTrabajoExtra = idsPresupuestosTrabajosExtra.has(presupuestoIdActual);

      if (esPresupuestoTrabajoExtra) {
        console.log(`🚫 [SaldoDisponible] Excluyendo presupuesto "${obra.nombreObra}" (presupuestoId: ${presupuestoIdActual}) - es un trabajo extra`);
        return;
      }

      if (obra.esObraIndependiente) {
        const clave = (obra.nombreObra || obra.direccion)
          ? `${obra.nombreObra}_${obra.direccion}`.trim()
          : `id_${obra.id}`;
        if (!oiMapDatos.has(clave)) oiMapDatos.set(clave, obra);
      } else {
        obrasNormalesSD.push(obra);
      }
    });
    const obrasPrincipalesSD = [...obrasNormalesSD, ...Array.from(oiMapDatos.values())];

    // ── Paso 2: Separar entidades sin distribución ─────────────────────────────
    // OIs: excluir las que ya están en datos por ID (el state ya viene deduplicado por nombre)
    const obraIdsEnDatos = new Set(
      Array.from(oiMapDatos.values()).map(o => o.obraId || o.id).filter(Boolean)
    );
    const oisSD = entidadesSinDistribucion.filter(e =>
      e.tipoEntidad === 'OBRA_INDEPENDIENTE' &&
      !obraIdsEnDatos.has(e.entidadId)
    );

    // TAs ya se muestran en los subgrupos por obra — no se reutiliza tasSD
    // (evita duplicados entre entidadesSinDistribucion y trabajosAdicionales)
    const tasSD = [];

    // ── Paso 3: Totales ────────────────────────────────────────────────────────
    const totalAsignadoPrincipal = datos.reduce((sum, o) => sum + (o.totalCobrado || 0), 0);
    const totalAsignadoSinDist = entidadesSinDistribucion.reduce((sum, e) => sum + (e.totalCobrado || 0), 0);
    const totalAsignado = totalAsignadoPrincipal + totalAsignadoSinDist;
    const saldoDisponible = totalCobrado - totalAsignado;

    // Clave para colapsar el bloque global de TAs
    const claveTA = 'sd_global_tareas';
    const colapsadoTA = !!gruposColapsados[claveTA];

    return (
      <>
        <div className="alert alert-info mb-3">
          <div className="row">
            <div className="col-md-4 text-center border-end">
              <div className="mb-1"><strong>Total Cobrado (Empresa)</strong></div>
              <div className="fs-4 text-success fw-bold">{formatearMoneda(totalCobrado)}</div>
            </div>
            <div className="col-md-4 text-center border-end">
              <div className="mb-1"><strong>Total Asignado a Obras</strong></div>
              <div className="fs-4 text-primary fw-bold">
                {cargandoEntidadesSinDist
                  ? <span className="spinner-border spinner-border-sm text-primary" />
                  : formatearMoneda(totalAsignado)}
              </div>
            </div>
            <div className="col-md-4 text-center">
              <div className="mb-1"><strong>Saldo Disponible</strong></div>
              <div className={`fs-4 fw-bold ${saldoDisponible >= 0 ? 'text-success' : 'text-danger'}`}>
                {cargandoEntidadesSinDist
                  ? <span className="spinner-border spinner-border-sm" />
                  : formatearMoneda(saldoDisponible)}
              </div>
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-hover table-striped">
            <thead className="table-success">
              <tr>
                <th>Obra / Entidad</th>
                <th className="text-end">Monto Asignado</th>
                <th className="text-end">% del Total Cobrado</th>
              </tr>
            </thead>
            <tbody>
              {/* Obras principales con subgrupo de Adicionales Obra */}
              {obrasPrincipalesSD.map((obra, idx) => {
                const obraIdReal = obra.obraId || obra.id;
                // Las OIs no tienen Adicionales Obra ni Tareas Leves en este sistema
                const tesObra = obra.esObraIndependiente ? [] : (trabajosExtra.get(obraIdReal) || []);
                const tasObra = obra.esObraIndependiente ? [] : trabajosAdicionales.filter(ta => {
                  const teId = ta.trabajoExtraId || ta.trabajo_extra_id;
                  const obraIdTA = ta.obraId || ta.obra_id;
                  if (teId && tesObra.flatMap(te => [te.obraId, te.id]).filter(Boolean).includes(teId)) return true;
                  if (!teId && obraIdTA === obraIdReal) return true;
                  return false;
                });
                const claveExtra = `sd_extra_${idx}`;
                const claveAdic = `sd_adic_${idx}`;
                const colapsadoExtra = !!gruposColapsados[claveExtra];
                const colapsadoAdic = !!gruposColapsados[claveAdic];
                const porcentaje = totalCobrado > 0 ? ((obra.totalCobrado || 0) / totalCobrado * 100) : 0;

                return (
                  <React.Fragment key={`sdo_${idx}`}>
                    <tr style={{ borderBottom: (tesObra.length > 0 || tasObra.length > 0) ? '1px solid rgba(253, 126, 20, 0.45)' : undefined }}>
                      <td>
                        <strong>{obra.nombreObra}</strong>
                        {obra.esTrabajoAdicional && (
                          <span className="badge ms-1" style={{backgroundColor: '#fd7e14', color: '#fff', fontSize: '0.75em'}}>
                            🔧 Tarea Leve
                          </span>
                        )}
                        {obra.esObraIndependiente && (
                          <span className="badge bg-info ms-1">Independiente</span>
                        )}
                      </td>
                      <td className="text-end text-primary">{formatearMoneda(obra.totalCobrado || 0)}</td>
                      <td className="text-end">{porcentaje.toFixed(2)}%</td>
                    </tr>

                    {/* Subgrupo: Adicionales Obra */}
                    {tesObra.length > 0 && (
                      <>
                        <tr
                          onClick={() => setGruposColapsados(p => ({ ...p, [claveExtra]: !p[claveExtra] }))}
                          style={{ backgroundColor: '#fff3cd', cursor: 'pointer', borderLeft: '5px solid #ffc107', borderBottom: '1px solid rgba(253, 126, 20, 0.45)' }}
                        >
                          <td colSpan="3" className="py-1 px-3 small">
                            <span className="fw-bold" style={{ color: '#856404' }}>
                              <i className={`fas fa-chevron-${colapsadoExtra ? 'right' : 'down'} me-2`} style={{ fontSize: '0.75em' }}></i>
                              📋 Adicionales Obra
                              <span className="badge ms-2" style={{ fontSize: '0.7em', backgroundColor: '#ffc107', color: '#000' }}>{tesObra.length}</span>
                            </span>
                            <span className="text-muted ms-3 small">Clic para {colapsadoExtra ? 'mostrar' : 'ocultar'}</span>
                          </td>
                        </tr>
                        {!colapsadoExtra && tesObra.map((te, teIdx) => {
                          const tareasLevesDelTE = tasObra.filter(ta => {
                            const teId = ta.trabajoExtraId || ta.trabajo_extra_id;
                            return teId && (teId === te.id || teId === te.obraId);
                          });
                          return (
                            <React.Fragment key={`te_sd_${idx}_${teIdx}`}>
                              <tr style={{ borderLeft: '5px solid #ffc107', borderBottom: tareasLevesDelTE.length > 0 ? '1px dashed rgba(253, 126, 20, 0.3)' : '1px solid rgba(253, 126, 20, 0.45)' }}>
                                <td className="ps-3">
                                  <small><strong>{te.nombre}</strong></small>
                                  {tareasLevesDelTE.length > 0 && <small className="text-info ms-1">({tareasLevesDelTE.length} 🔧)</small>}
                                </td>
                                <td className="text-end"><small className="text-muted">—</small></td>
                                <td className="text-end"><small className="text-muted">—</small></td>
                              </tr>
                              {tareasLevesDelTE.map((ta, taIdx) => (
                                <tr key={`te${teIdx}_ta${taIdx}`} style={{ borderLeft: '7px solid #fd7e14', backgroundColor: '#f0f9ff', borderBottom: '1px solid rgba(253, 126, 20, 0.3)' }}>
                                  <td className="ps-4">
                                    <i className="bi bi-arrow-return-right me-1" style={{ fontSize: '0.7em', color: '#0ea5e9' }}></i>
                                    <small className="text-info">{ta.nombre || ta.descripcion || `Tarea #${ta.id}`}</small>
                                  </td>
                                  <td className="text-end"><small className="text-muted">—</small></td>
                                  <td className="text-end"><small className="text-muted">—</small></td>
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })}
                      </>
                    )}

                    {/* Subgrupo: Tareas Leves Directas */}
                    {(() => {
                      const tareasLevesDirectas = tasObra.filter(ta => {
                        const teId = ta.trabajoExtraId || ta.trabajo_extra_id;
                        return !teId;
                      });
                      if (tareasLevesDirectas.length === 0) return null;
                      return (
                        <>
                          <tr
                            onClick={() => setGruposColapsados(p => ({ ...p, [claveAdic]: !p[claveAdic] }))}
                            style={{ backgroundColor: '#dbeafe', cursor: 'pointer', borderLeft: '5px solid #1d4ed8', borderBottom: '1px solid rgba(253, 126, 20, 0.45)' }}
                          >
                            <td colSpan="3" className="py-1 px-3 small">
                              <span className="fw-bold text-primary">
                                <i className={`fas fa-chevron-${colapsadoAdic ? 'right' : 'down'} me-2`} style={{ fontSize: '0.75em' }}></i>
                                🔧 Tareas Leves Directas
                                <span className="badge bg-primary ms-2" style={{ fontSize: '0.7em' }}>{tareasLevesDirectas.length}</span>
                              </span>
                              <span className="text-muted ms-3 small">Clic para {colapsadoAdic ? 'mostrar' : 'ocultar'}</span>
                            </td>
                          </tr>
                          {!colapsadoAdic && tareasLevesDirectas.map((ta, taIdx) => (
                            <tr key={`ta_sd_directa_${idx}_${taIdx}`} style={{ borderLeft: '7px solid #fd7e14', borderBottom: '1px solid rgba(253, 126, 20, 0.45)' }}>
                              <td className="ps-3">
                                <small>{ta.nombre || ta.descripcion || `Tarea #${ta.id}`}</small>
                              </td>
                              <td className="text-end"><small className="text-muted">—</small></td>
                              <td className="text-end"><small className="text-muted">—</small></td>
                            </tr>
                          ))}
                        </>
                      );
                    })()}
                  </React.Fragment>
                );
              })}

              {/* Bloque global colapsable: Tareas Leves (de entidadesSinDistribucion) */}
              {tasSD.length > 0 && (
                <>
                  {/* Separador visual para que no confunda con la obra anterior */}
                  <tr style={{ backgroundColor: '#f8f9fa', borderTop: '3px solid #dee2e6' }}>
                    <td colSpan="3" className="py-1 px-3">
                      <small className="text-muted fw-bold text-uppercase" style={{ fontSize: '0.7em', letterSpacing: '0.05em' }}>
                        Tareas Leves sin distribución de cobro por obra
                      </small>
                    </td>
                  </tr>
                  <tr
                    onClick={() => setGruposColapsados(p => ({ ...p, [claveTA]: !p[claveTA] }))}
                    style={{ backgroundColor: '#dbeafe', cursor: 'pointer', borderLeft: '5px solid #1d4ed8', borderBottom: '1px solid rgba(253, 126, 20, 0.45)' }}
                  >
                    <td colSpan="3" className="py-1 px-3 small">
                      <span className="fw-bold text-primary">
                        <i className={`fas fa-chevron-${colapsadoTA ? 'right' : 'down'} me-2`} style={{ fontSize: '0.75em' }}></i>
                        🔧 Tareas Leves / Mantenimiento
                        <span className="badge bg-primary ms-2" style={{ fontSize: '0.7em' }}>{tasSD.length}</span>
                      </span>
                      <span className="text-muted ms-3 small">Clic para {colapsadoTA ? 'mostrar' : 'ocultar'}</span>
                    </td>
                  </tr>
                  {!colapsadoTA && tasSD.map((ta, idx) => {
                    const porcentaje = totalCobrado > 0 ? ((ta.totalCobrado || 0) / totalCobrado * 100) : 0;
                    return (
                      <tr key={`ta_glob_${idx}`} style={{ borderLeft: '7px solid #fd7e14', borderBottom: '1px solid rgba(253, 126, 20, 0.45)' }}>
                        <td className="ps-3">
                          <small>{ta.nombreObra}</small>
                          <span className="badge ms-1" style={{ backgroundColor: '#fd7e14', color: '#fff', fontSize: '0.7em' }}>🔧 Tarea Leve</span>
                        </td>
                        <td className="text-end text-primary">{formatearMoneda(ta.totalCobrado || 0)}</td>
                        <td className="text-end">{porcentaje.toFixed(2)}%</td>
                      </tr>
                    );
                  })}
                </>
              )}

              {/* OIs de entidadesSinDistribucion no presentes en datos */}
              {oisSD.length > 0 && oisSD.map((oi, idx) => {
                const porcentaje = totalCobrado > 0 ? ((oi.totalCobrado || 0) / totalCobrado * 100) : 0;
                return (
                  <tr key={`oi_sd_${idx}`}>
                    <td>
                      <strong>{oi.nombreObra}</strong>
                      <span className="badge bg-info ms-1">Independiente</span>
                    </td>
                    <td className="text-end text-primary">{formatearMoneda(oi.totalCobrado || 0)}</td>
                    <td className="text-end">{porcentaje.toFixed(2)}%</td>
                  </tr>
                );
              })}

              {cargandoEntidadesSinDist && (
                <tr>
                  <td colSpan="3" className="text-center text-muted">
                    <span className="spinner-border spinner-border-sm me-2" />
                    Cargando Tareas Leves y obras independientes...
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="table-light">
              <tr>
                <td className="text-end"><strong>TOTAL ASIGNADO:</strong></td>
                <td className="text-end text-primary fw-bold">{formatearMoneda(totalAsignado)}</td>
                <td className="text-end fw-bold">
                  {totalCobrado > 0 ? ((totalAsignado / totalCobrado * 100).toFixed(2)) : 0}%
                </td>
              </tr>
              <tr className="table-success">
                <td className="text-end"><strong>SALDO DISPONIBLE:</strong></td>
                <td className="text-end fw-bold fs-5" colSpan="2">
                  <span className={saldoDisponible >= 0 ? 'text-success' : 'text-danger'}>
                    {formatearMoneda(saldoDisponible)}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </>
    );
  };

  const renderBalanceNeto = () => (
    <div className="table-responsive">
      <table className="table table-hover table-striped">
        <thead className="table-info">
          <tr>
            <th>Obra</th>
            <th className="text-end">Total Asignado</th>
            <th className="text-end">Total Pagado</th>
            <th className="text-end">Total Retirado</th>
            <th className="text-end">Balance Neto</th>
          </tr>
        </thead>
        <tbody>
          {datos.map((obra, idx) => {
            const balance = (obra.totalCobrado || 0) - (obra.totalPagado || 0) - (obra.totalRetirado || 0);
            return (
              <tr key={idx}>
                <td>
                  <strong>{obra.nombreObra}</strong>
                </td>
                <td className="text-end text-success">{formatearMoneda(obra.totalCobrado || 0)}</td>
                <td className="text-end text-primary">{formatearMoneda(obra.totalPagado || 0)}</td>
                <td className="text-end text-warning">{formatearMoneda(obra.totalRetirado || 0)}</td>
                <td className="text-end">
                  <strong className={balance >= 0 ? 'text-success' : 'text-danger'}>
                    {formatearMoneda(balance)}
                  </strong>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="table-light">
          <tr>
            <td className="text-end"><strong>TOTAL:</strong></td>
            <td className="text-end text-success">
              {formatearMoneda(datos.reduce((sum, o) => sum + (o.totalCobrado || 0), 0))}
            </td>
            <td className="text-end text-primary">
              {formatearMoneda(datos.reduce((sum, o) => sum + (o.totalPagado || 0), 0))}
            </td>
            <td className="text-end text-warning">
              {formatearMoneda(datos.reduce((sum, o) => sum + (o.totalRetirado || 0), 0))}
            </td>
            <td className="text-end">
              <strong className={
                (datos.reduce((sum, o) => sum + (o.totalCobrado || 0), 0) -
                 datos.reduce((sum, o) => sum + (o.totalPagado || 0), 0) -
                 datos.reduce((sum, o) => sum + (o.totalRetirado || 0), 0)) >= 0
                  ? 'text-success fs-5'
                  : 'text-danger fs-5'
              }>
                {formatearMoneda(
                  datos.reduce((sum, o) => sum + (o.totalCobrado || 0), 0) -
                  datos.reduce((sum, o) => sum + (o.totalPagado || 0), 0) -
                  datos.reduce((sum, o) => sum + (o.totalRetirado || 0), 0)
                )}
              </strong>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );

  return (
    <div className="modal show d-block" style={{ zIndex: 2500, backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">
              <i className="bi bi-list-ul me-2"></i>
              {titulo || 'Detalle por Obra'}
            </h5>
            <button type="button" className="btn btn-light btn-sm ms-auto" onClick={onHide}>
              Cerrar
            </button>
          </div>
          <div className="modal-body">
            <div className="alert alert-info">
              <div>
                <i className="bi bi-info-circle me-2"></i>
                <strong>Vista consolidada:</strong>{' '}
                {tipo === 'cobros' ? (
                  <strong>{cobrosEmpresa.length} cobro(s) registrado(s)</strong>
                ) : cargandoTrabajosExtra ? (
                  <strong className="text-muted">Cargando...</strong>
                ) : (
                  <strong>{(() => {
                  // ✅ Usar el mismo filtro que renderPresupuestos (basado en trabajosExtra Map)
                  const obrasFiltradas = datos?.filter(obra => {
                    const estaEnMapTrabajos = Array.from(trabajosExtra.values()).flat().some(te => te.id === obra.presupuestoId || te.id === obra.id);
                    return !estaEnMapTrabajos;
                  }) || [];

                  const oiMap = new Map();
                  let countNormales = 0;
                  obrasFiltradas.forEach(obra => {
                    if (obra.esObraIndependiente) {
                      // ✅ Si nombre y dirección están vacíos, usar ID para evitar colisiones
                      const nombre = obra.nombreObra || '';
                      const dir = obra.direccion || '';
                      const claveUnica = (nombre || dir) ? `${nombre}_${dir}`.trim() : `id_${obra.id}`;
                      if (!oiMap.has(claveUnica)) oiMap.set(claveUnica, true);
                    } else {
                      countNormales++;
                    }
                  });
                  const total = countNormales + oiMap.size;
                  console.log(`📊 [Header] Conteo obras: ${total} (normales: ${countNormales}, OIs: ${oiMap.size})`);
                  return total;
                })()} obra(s)</strong>
                )}
                {estadisticas && ((estadisticas.cantidadTrabajosExtra || 0) > 0 || (estadisticas.cantidadTrabajosAdicionales || 0) > 0) && (
                  <>
                    {(estadisticas.cantidadTrabajosExtra || 0) > 0 && (
                      <span className="ms-1 text-warning">
                        + <strong>{estadisticas.cantidadTrabajosExtra} TE</strong>
                      </span>
                    )}
                    {(estadisticas.cantidadTrabajosAdicionales || 0) > 0 && (
                      <span className="ms-1 text-info">
                        + <strong>{estadisticas.cantidadTrabajosAdicionales} TA</strong>
                      </span>
                    )}
                  </>
                )}
              </div>
              {tipo === 'cobros' && (
                <div className="mt-3">
                  <div className="row text-center">
                    <div className="col-md-4">
                      <strong className="fs-6">Total Cobrado:</strong>
                      <div className="fw-bold fs-4 text-success">
                        {formatearMoneda(cobrosEmpresa.reduce((s, c) => s + (parseFloat(c.montoTotal) || 0), 0))}
                      </div>
                    </div>
                    <div className="col-md-4">
                      <strong className="fs-6">Asignado a Obras:</strong>
                      <div className="fw-bold fs-4 text-primary">
                        {formatearMoneda(cobrosEmpresa.reduce((s, c) => {
                          const total = parseFloat(c.montoTotal) || 0;
                          const disp = parseFloat(c.montoDisponible) || 0;
                          return s + (total - disp);
                        }, 0))}
                      </div>
                    </div>
                    <div className="col-md-4">
                      <strong className="fs-6">Saldo Disponible:</strong>
                      <div className="fw-bold fs-4 text-warning">
                        {formatearMoneda(cobrosEmpresa.reduce((s, c) => s + (parseFloat(c.montoDisponible) || 0), 0))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {tipo === 'pagos' && estadisticas && (
                <div className="mt-3 text-center">
                  <strong className="fs-5">Total pagado:</strong>{' '}
                  <span className="text-danger fw-bold fs-4">{formatearMoneda(estadisticas.totalPagado || 0)}</span>
                </div>
              )}
              {tipo === 'presupuestos' && estadisticas && (
                <div className="mt-3 text-center">
                  <strong className="fs-5">Total Presupuestado a {empresaSeleccionada?.nombreEmpresa || empresaSeleccionada?.nombre || 'la empresa'}:</strong>{' '}
                  <span className="text-primary fw-bold fs-4">
                    {formatearMoneda(totalCorrectoCalculado !== null ? totalCorrectoCalculado : (estadisticas.totalPresupuesto || 0))}
                  </span>
                </div>
              )}
              {tipo === 'saldoPorCobrar' && estadisticas && (
                <div className="mt-3 text-center">
                  <strong className="fs-5">Total por cobrar a {empresaSeleccionada?.nombreEmpresa || empresaSeleccionada?.nombre || 'la empresa'}:</strong>{' '}
                  <span className="text-warning fw-bold fs-4">
                    {formatearMoneda(
                      Math.max(0,
                        (estadisticas.totalPresupuesto || 0) -
                        (parseFloat(estadisticas.totalCobrado) || parseFloat(estadisticas.totalCobradoEmpresa) || 0)
                      )
                    )}
                  </span>
                </div>
              )}
              {tipo === 'balanceNeto' && datos && datos.length > 0 && (
                <div className="mt-3 text-center">
                  <div className="mb-2">
                    <strong className="fs-5">Balance entre Cobros - Pagos - Retiros:</strong>
                  </div>
                  <div>
                    <strong className="fs-5">Saldo Disponible:</strong>{' '}
                    <span className={`fw-bold fs-4 ${
                      (datos.reduce((sum, o) => sum + (o.totalCobrado || 0), 0) -
                       datos.reduce((sum, o) => sum + (o.totalPagado || 0), 0) -
                       datos.reduce((sum, o) => sum + (o.totalRetirado || 0), 0)) >= 0
                        ? 'text-success'
                        : 'text-danger'
                    }`}>
                    {formatearMoneda(
                      datos.reduce((sum, o) => sum + (o.totalCobrado || 0), 0) -
                      datos.reduce((sum, o) => sum + (o.totalPagado || 0), 0) -
                      datos.reduce((sum, o) => sum + (o.totalRetirado || 0), 0)
                    )}
                  </span>
                  </div>
                </div>
              )}
              {tipo === 'deficit' && estadisticas && (
                <div className="mt-3 text-center">
                  <strong className="fs-5">Déficit total:</strong>{' '}
                  <span className="text-danger fw-bold fs-4">
                    {formatearMoneda(estadisticas.saldoDisponible < 0 ? estadisticas.saldoDisponible : 0)}
                  </span>
                  {estadisticas.saldoDisponible >= 0 && (
                    <div className="mt-2 text-success">
                      <i className="bi bi-check-circle me-2"></i>
                      No hay déficit general
                    </div>
                  )}
                </div>
              )}
            </div>
            {renderContenido()}
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

export default DetalleConsolidadoPorObraModal;
