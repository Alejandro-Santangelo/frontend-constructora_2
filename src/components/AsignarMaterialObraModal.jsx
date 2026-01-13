import React, { useState, useEffect, useMemo } from 'react';
import { useEmpresa } from '../EmpresaContext';
import DetalleSemanalMaterialesModal from './DetalleSemanalMaterialesModal';
import AsignarMaterialSemanalModal from './AsignarMaterialSemanalModal';

/**
 * Modal para asignar materiales del presupuestoNoCliente a una obra específica
 * Organiza la asignación por jornales y semanas para facilitar la planificación
 */
const AsignarMaterialObraModal = ({ show, onClose, obra, onAsignacionExitosa, configuracionObra = null }) => {
  const { empresaSeleccionada } = useEmpresa();

  // Estados
  const [presupuesto, setPresupuesto] = useState(null);
  const [materialesDisponibles, setMaterialesDisponibles] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingPresupuesto, setLoadingPresupuesto] = useState(false);
  const [error, setError] = useState(null);
  const [forceUpdate, setForceUpdate] = useState(0); // Para forzar re-render
  const [modoPresupuesto, setModoPresupuesto] = useState('DETALLE'); // 'GLOBAL', 'DETALLE' o 'MIXTO'
  const [cantidadGlobalDisponible, setCantidadGlobalDisponible] = useState(0);
  const [importeGlobalDisponible, setImporteGlobalDisponible] = useState(0);

  // Estados para detalle semanal
  const [mostrarDetalleSemana, setMostrarDetalleSemana] = useState(false);
  const [semanaSeleccionada, setSemanaSeleccionada] = useState(null);
  const [asignacionesPorDia, setAsignacionesPorDia] = useState({});

  // Estados para asignación semanal completa
  const [mostrarAsignacionSemanal, setMostrarAsignacionSemanal] = useState(false);
  const [semanaAsignacionCompleta, setSemanaAsignacionCompleta] = useState(null);

  // Estado para formulario de asignación individual
  const [mostrarFormularioIndividual, setMostrarFormularioIndividual] = useState(false);

  // Formulario de nueva asignación
  const [nuevaAsignacion, setNuevaAsignacion] = useState({
    tipoAsignacion: '', // 'CANTIDAD_GLOBAL' | 'ELEMENTO_DETALLADO'
    materialId: '', // ID del material del presupuesto
    cantidad: '',
    precioUnitario: '',
    fechaAsignacion: '', // Vacío por defecto, se configura al abrir modal
    observaciones: '',
    esManual: false
  });

  const [nuevoMaterialManual, setNuevoMaterialManual] = useState({
    nombre: '',
    unidad: 'un',
    unidadCustom: ''
  });

  const unidadesMedida = ['un', 'kg', 'm', 'm²', 'm³', 'l', 'bolsa', 'otro'];

  const tieneItemsDetallados = materialesDisponibles.length > 0;
  // Siempre permitir manual (como en Gastos), para mantener paridad
  const permiteManual = true;

  console.log('ðŸ” [AsignarMaterialObraModal] Debug:', {
    materialesDisponibles: materialesDisponibles.length,
    tieneItemsDetallados,
    modoPresupuesto,
    permiteManual,
    tipoAsignacionActual: nuevaAsignacion.tipoAsignacion
  });

  const obtenerUnidadFinal = () => {
    if (nuevoMaterialManual.unidad === 'otro') {
      return (nuevoMaterialManual.unidadCustom || '').trim();
    }
    return nuevoMaterialManual.unidad;
  };

  // ðŸ”¥ Crear configuración actualizada con fechaProbableInicio y jornales del presupuesto
  const configuracionObraActualizada = useMemo(() => {
    if (!configuracionObra) return null;

    if (presupuesto) {
      const fechaActualizada = presupuesto.fechaProbableInicio?.includes('T')
        ? presupuesto.fechaProbableInicio.split('T')[0]
        : presupuesto.fechaProbableInicio || configuracionObra.fechaInicio;

      let diasHabilesPresupuesto = configuracionObra.jornalesTotales;
      if (presupuesto.tiempoEstimadoTerminacion) {
        diasHabilesPresupuesto = presupuesto.tiempoEstimadoTerminacion;
      }

      // ðŸ”¥ USAR días hábiles del presupuesto (fuente de verdad), NO semanasObjetivo × 5
      const diasHabiles = presupuesto.tiempoEstimadoTerminacion || configuracionObra.diasHabiles || (configuracionObra.semanasObjetivo * 5);
      const capacidadNecesaria = diasHabiles > 0 ? Math.ceil(diasHabilesPresupuesto / diasHabiles) : 0;

      console.log('ðŸ”¥ [MATERIALES] configuracionObraActualizada:', {
        diasHabilesPresupuesto,
        diasHabiles,
        capacidadNecesaria,
        presupuestoId: presupuesto.id,
        tiempoEstimadoTerminacion: presupuesto.tiempoEstimadoTerminacion
      });

      return {
        ...configuracionObra,
        fechaInicio: fechaActualizada,
        jornalesTotales: diasHabilesPresupuesto,
        diasHabiles,
        capacidadNecesaria,
        presupuestoSeleccionado: presupuesto
      };
    }

    return configuracionObra;
  }, [configuracionObra, presupuesto]);

  // Cargar presupuesto de la obra
  useEffect(() => {
    console.log('ðŸ”„ useEffect [show, obra] ejecutado - show:', show, 'obra.id:', obra?.id);
    if (show && obra) {
      // Incrementar forceUpdate ANTES de cargar para forzar re-render
      setForceUpdate(prev => prev + 1);
      cargarPresupuestoObra();
      cargarAsignacionesActuales();
    } else if (!show) {
      // Limpiar estado cuando se cierra para forzar recarga fresca
      console.log('🧹 Limpiando estado del modal (cerrado)');
      setPresupuesto(null);
      setMaterialesDisponibles([]);
    }
  }, [show, obra]);

  // ✅ useEffect para recalcular presupuesto disponible cuando cambian las asignaciones
  useEffect(() => {
    console.log('🔍 [DEBUG-DISPONIBLE] useEffect ejecutándose...', {
      presupuesto: !!presupuesto,
      totalMateriales: presupuesto?.presupuestoGeneral?.totalMateriales,
      numAsignaciones: asignaciones?.length
    });

    if (presupuesto?.presupuestoGeneral?.totalMateriales > 0 && asignaciones) {
      const totalMateriales = presupuesto.presupuestoGeneral.totalMateriales;
      const totalAsignado = asignaciones.reduce((sum, asig) => {
        return sum + (parseFloat(asig.importeAsignado) || 0);
      }, 0);

      const disponibleRestante = totalMateriales - totalAsignado;
      setImporteGlobalDisponible(Math.max(0, disponibleRestante));

      console.log(`🔄 [Materiales] Recalculando disponible - Total: $${totalMateriales.toLocaleString('es-AR')}, Asignado: $${totalAsignado.toLocaleString('es-AR')}, Disponible: $${disponibleRestante.toLocaleString('es-AR')}`);
    } else if (presupuesto) {
      // Si hay presupuesto pero no total de materiales, mostrar 0
      console.log('⚠️ [Materiales] Presupuesto sin totalMateriales o sin asignaciones', {
        totalMateriales: presupuesto?.presupuestoGeneral?.totalMateriales,
        asignaciones: asignaciones?.length
      });
      setImporteGlobalDisponible(0);
    }
  }, [asignaciones, presupuesto]);

  const cargarPresupuestoObra = async () => {
    setLoadingPresupuesto(true);
    setError(null);
    try {
           console.log('🔍🔍🔍 INICIANDO CARGA DE PRESUPUESTO 🔍🔍🔍');
      console.log('🚨🚨🚨 OBJETO OBRA COMPLETO:', JSON.stringify(obra, null, 2));
      console.log('🔍 obra.id:', obra.id);
      console.log('🔍 obra._obraOriginalId:', obra._obraOriginalId);
      console.log('🔍 obra.presupuestoNoCliente?.obraId:', obra.presupuestoNoCliente?.obraId);
      console.log('🔍 obra.obraId:', obra.obraId);
      console.log('🔍 Buscando presupuesto para obra:', obra.id, 'empresa:', empresaSeleccionada.id);

      // Añadir timestamp para evitar caché del navegador
      const timestamp = new Date().getTime();
      const obraIdReal = obra._obraOriginalId || obra.presupuestoNoCliente?.obraId || obra.obraId || obra.id;
      console.log('✅ obraIdReal calculado:', obraIdReal);

      const [respTradicionales, respTrabajosExtra] = await Promise.all([
        fetch(`http://localhost:8080/api/presupuestos-no-cliente?empresaId=${empresaSeleccionada.id}&_t=${timestamp}`, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        }).then(r => r.ok ? r.json() : []),
      fetch(`http://localhost:8080/api/v1/trabajos-extra?empresaId=${empresaSeleccionada.id}&obraId=${obraIdReal}&_t=${timestamp}`, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        }).then(r => r.ok ? r.json() : [])
      ]);
      // Normalizar trabajos extra: asegurar que tengan campo 'id'
      const trabajosExtraNormalizados = (Array.isArray(respTrabajosExtra) ? respTrabajosExtra : []).map(te => ({
        ...te,
        id: te.id || te.idTrabajoExtra || te.trabajoExtraId,
        esTrabajoExtra: true,
        tipo: 'TRABAJO_EXTRA'
      }));

      const todosPresupuestos = [
        ...(Array.isArray(respTradicionales) ? respTradicionales : []),
        ...trabajosExtraNormalizados
      ];

      console.log('📦 Total presupuestos obtenidos:', todosPresupuestos?.length || 0);
      console.log('📦 Trabajos extra normalizados:', trabajosExtraNormalizados.length, trabajosExtraNormalizados);
      console.log('📦 Total presupuestos obtenidos:', todosPresupuestos?.length || 0);

      // Estados válidos para obras vinculadas (MODIFICADO NO se incluye)
      const estadosValidos = ['APROBADO', 'EN_EJECUCION', 'SUSPENDIDA', 'CANCELADA'];

      // Filtrar por obraId Y estado válido
      const presupuestosObra = (todosPresupuestos || []).filter(p =>
  (Number(p.obraId) === Number(obraIdReal) || Number(p.idObra) === Number(obraIdReal)) && estadosValidos.includes(p.estado)
);
     console.log('✅ Presupuestos con estado válido de obra (obraId:', obraIdReal, '):', presupuestosObra.length);
      if (presupuestosObra.length === 0) {
        throw new Error('No se encontró un presupuesto con estado válido (APROBADO, EN_EJECUCION, SUSPENDIDA, CANCELADA) para esta obra');
      }

      // 🔥 SI EL MODAL FUE ABIERTO DESDE UN TRABAJO EXTRA ESPECÍFICO, USAR SOLO ESE
      const trabajoExtraIdEspecifico = obra._trabajoExtraId;

      let presupuestoActual;
      if (trabajoExtraIdEspecifico) {
        // Buscar el trabajo extra específico que se clickeó
        presupuestoActual = presupuestosObra.find(p =>
          (p.esTrabajoExtra || p.tipo === 'TRABAJO_EXTRA') && p.id === trabajoExtraIdEspecifico
        );

        if (!presupuestoActual) {
          throw new Error(`No se encontró el trabajo extra con ID ${trabajoExtraIdEspecifico}`);
        }
        console.log('✅ Usando TRABAJO EXTRA ESPECÍFICO clickeado:', presupuestoActual.id, presupuestoActual.nombre);
      } else {
        // Lógica original: priorizar trabajos extra sobre presupuestos tradicionales
        const trabajosExtraObra = presupuestosObra.filter(p => p.esTrabajoExtra || p.tipo === 'TRABAJO_EXTRA');
        const tradicionalesObra = presupuestosObra.filter(p => !p.esTrabajoExtra && p.tipo !== 'TRABAJO_EXTRA');

        if (trabajosExtraObra.length > 0) {
          presupuestoActual = trabajosExtraObra.sort((a, b) => b.id - a.id)[0]; // Más reciente primero
          console.log('✅ Seleccionando TRABAJO EXTRA más reciente:', presupuestoActual.id);
        } else {
          presupuestoActual = tradicionalesObra.sort((a, b) => {
            if (a.numeroPresupuesto === b.numeroPresupuesto) {
              return (b.version || 0) - (a.version || 0);
            }
            return b.id - a.id;
          })[0];
          console.log('✅ Seleccionando PRESUPUESTO TRADICIONAL:', presupuestoActual.id);
        }
      }

      console.log('🎯 Presupuesto con estado válido seleccionado:', {
        id: presupuestoActual.id,
        version: presupuestoActual.version,
        estado: presupuestoActual.estado,
        fechaProbableInicio: presupuestoActual.fechaProbableInicio,
        esTrabajoExtra: presupuestoActual.esTrabajoExtra || presupuestoActual.tipo === 'TRABAJO_EXTRA'
      });

      const presupuestoId = presupuestoActual.id;
      const esTrabajoExtra = presupuestoActual.esTrabajoExtra || presupuestoActual.tipo === 'TRABAJO_EXTRA';
      console.log('✅ Usando presupuesto ID:', presupuestoId, '| Es trabajo extra:', esTrabajoExtra);
      console.log('�🚨🚨 PRESUPUESTO SELECCIONADO COMPLETO:', JSON.stringify(presupuestoActual, null, 2));
      console.log('📅 fechaProbableInicio en presupuestoActual (lista):', presupuestoActual.fechaProbableInicio);

      // 🔥 SIEMPRE RECARGAR para tener datos frescos (evita mostrar presupuestos editados con valores viejos)
      let presupuestoData;

      // Construir URL según el tipo de presupuesto
      const presupuestoUrl = esTrabajoExtra
        ? `http://localhost:8080/api/v1/trabajos-extra/${presupuestoId}?_t=${timestamp}`
          : `http://localhost:8080/api/presupuestos-no-cliente/${presupuestoId}?empresaId=${empresaSeleccionada.id}&_t=${timestamp}`;

        console.log('🌐🌐🌐 URL A CONSULTAR:', presupuestoUrl);

        const presupuestoResponse = await fetch(presupuestoUrl, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });

        if (!presupuestoResponse.ok) {
          throw new Error('No se pudo obtener el presupuesto');
        }

        presupuestoData = await presupuestoResponse.json();

      console.log('📦 presupuestoData completo recibido:', presupuestoData);
      console.log('ðŸ“… fechaProbableInicio en presupuestoData (completo):', presupuestoData.fechaProbableInicio);

      // Extraer materiales de itemsCalculadora
      const todosMateriales = [];
      let montoGlobalDetectadoEnItems = 0;

      if (presupuestoData.itemsCalculadora && Array.isArray(presupuestoData.itemsCalculadora)) {
        presupuestoData.itemsCalculadora.forEach((item) => {
          // 🆕 DETECTAR MODO GLOBAL: Si el item tiene campo "materiales" o "subtotalMateriales" > 0
          // sin materialesLista o con materialesLista vacío, es modo GLOBAL
          const tieneMontoGlobalMateriales = (item.materiales || item.subtotalMateriales || 0) > 0;
          const tieneMaterialesDetallados = item.materialesLista && Array.isArray(item.materialesLista) && item.materialesLista.length > 0;

          if (tieneMontoGlobalMateriales && !tieneMaterialesDetallados) {
            // Modo GLOBAL puro: hay un monto pero no hay detalles
            const montoGlobal = item.materiales || item.subtotalMateriales || 0;
            montoGlobalDetectadoEnItems += montoGlobal;
            console.log('🌍 [MODO GLOBAL] Detectado en item:', {
              rubro: item.tipoProfesional,
              montoGlobal: montoGlobal,
              tieneDetalles: false
            });
          }

          if (item.materialesLista && Array.isArray(item.materialesLista)) {
            item.materialesLista.forEach(mat => {
              // Filtrar materiales que son placeholders del presupuesto global
              const esGlobalPlaceholder =
                (mat.descripcionMaterial || mat.descripcion || '').includes('Presupuesto Global') ||
                ((mat.nombreMaterial || mat.nombre || '') === 'Sin nombre' &&
                 (mat.descripcionMaterial || mat.descripcion || '').includes('Global'));

              if (esGlobalPlaceholder) {
                 const importeItem = mat.subtotal || mat.importe || 0;
                 montoGlobalDetectadoEnItems += importeItem;
                 console.log('🌍 [DETECTADO] Item Global en materiales:', { id: mat.id, importe: importeItem });
              }

              // Solo agregar materiales específicos, NO los placeholders globales
              if (!esGlobalPlaceholder) {
                // Calcular precio unitario: subtotal / cantidad
                const precioCalculado = mat.cantidad > 0 ? (mat.subtotal || 0) / mat.cantidad : 0;

                todosMateriales.push({
                  id: mat.id,
                  nombre: mat.nombreMaterial || mat.nombre,
                  descripcion: mat.descripcionMaterial || mat.descripcion || '',
                  unidad: mat.unidadMedida || mat.unidad || 'unidad',
                  precioUnitario: precioCalculado,
                  cantidadDisponible: mat.cantidad || 0,
                  estadoStock: mat.cantidad > 0 ? 'DISPONIBLE' : 'AGOTADO',
                  rubro: item.tipoProfesional || 'Sin categoría' // Usar tipoProfesional del item
                });
              }
            });
          }
        });
      }

      console.log('✅ Materiales cargados:', todosMateriales.length);
      console.log('📦 Primer material de ejemplo:', todosMateriales[0]); // Ver estructura final
      setMaterialesDisponibles(todosMateriales);

      // Calcular modo presupuesto y cantidad global disponible
      // 🔥 CORRECCIÓN: Leer totalMateriales desde múltiples ubicaciones posibles
      let totalMateriales =
        presupuestoData.presupuestoGeneral?.totalMateriales ||  // 1. presupuestoGeneral.totalMateriales
        presupuestoData.totalMateriales ||                       // 2. totalMateriales en raíz (trabajos extra)
        0;

      const tieneItemsDetallados = todosMateriales.length > 0;

      // 🔥 CORRECCIÓN: Si totalMateriales es 0, buscar si venía en un item global de la calculadora
      if (totalMateriales === 0 && montoGlobalDetectadoEnItems > 0) {
        console.log('⚠️ [Materiales] Usando monto de item global detectado: $' + montoGlobalDetectadoEnItems);
        totalMateriales = montoGlobalDetectadoEnItems;

        // Parche visual
        if (!presupuestoData.presupuestoGeneral) presupuestoData.presupuestoGeneral = {};
        presupuestoData.presupuestoGeneral.totalMateriales = totalMateriales;
      }

      console.log('💰 [DEBUG MODAL] Datos Presupuesto:', {
        totalMateriales,
        tieneItemsDetallados,
        numItems: todosMateriales.length,
        presupuestoGeneral: presupuestoData.presupuestoGeneral
      });

      // LÓGICA DE DETECCIÓN DE MODO MEJORADA
      if (!tieneItemsDetallados) {
        // 🔥 SI NO HAY DETALLES, SIEMPRE ES GLOBAL (aunque sea 0)
        // Esto permite asignar manualmente contra un "presupuesto global" implícito o vacío
        console.log('👉 Sin items detallados -> Forzando modo GLOBAL');
        setModoPresupuesto('GLOBAL');
        setCantidadGlobalDisponible(totalMateriales);
        setImporteGlobalDisponible(totalMateriales);
      } else if (totalMateriales > 0 && tieneItemsDetallados) {
        // Caso Híbrido: Hay total y hay items.
        // Verificamos si los items cubren todo el total
        const totalAsignadoDesdeDetalle = todosMateriales.reduce((sum, mat) =>
          sum + (mat.precioUnitario * mat.cantidadDisponible), 0);
        const diferencia = totalMateriales - totalAsignadoDesdeDetalle;

        if (Math.abs(diferencia) > 10) { // Tolerancia de $10
          console.log('👉 Diferencia detectada entre Total y Detalles -> Modo MIXTO');
          setModoPresupuesto('MIXTO');
          setCantidadGlobalDisponible(Math.max(0, diferencia));
          setImporteGlobalDisponible(Math.max(0, diferencia));
        } else {
          console.log('👉 Detalles coinciden con Total -> Modo DETALLE');
          setModoPresupuesto('DETALLE');
          setCantidadGlobalDisponible(0);
          setImporteGlobalDisponible(0);
        }
      } else {
         // Hay items pero no total global -> Modo DETALLE puro
         console.log('👉 Items sin total global -> Modo DETALLE');
         setModoPresupuesto('DETALLE');
         setCantidadGlobalDisponible(0);
         setImporteGlobalDisponible(0);
      }

      console.log('ðŸ’° Modo Presupuesto:', modoPresupuesto, 'Disponible Global:', cantidadGlobalDisponible, 'Importe:', importeGlobalDisponible);

      // IMPORTANTE: Usar SOLO presupuestoData (respuesta completa del backend), NO presupuestoActual (lista)
      // presupuestoData es la fuente de verdad con datos frescos
      const fechaRaw = presupuestoData.fechaProbableInicio;

      if (!fechaRaw) {
        console.warn('âš ï¸ fechaProbableInicio es null/undefined en presupuestoData');
      }

      const fechaFormateada = fechaRaw ? (typeof fechaRaw === 'string' && fechaRaw.includes('T') ? fechaRaw.split('T')[0] : fechaRaw) : null;

      const presupuestoParaEstado = {
        id: presupuestoId,
        nombre: presupuestoActual.nombre || 'Presupuesto',
        numeroPresupuesto: presupuestoActual.numeroPresupuesto,
        version: presupuestoActual.version || 1,
        estado: presupuestoActual.estado,
        fechaProbableInicio: fechaFormateada,
        presupuestoGeneral: presupuestoData.presupuestoGeneral // 🔥 CRUCIAL: Guardar datos económicos
      };

            setPresupuesto(presupuestoParaEstado);
      console.log('📅 Fecha probable inicio cargada (ISO → YYYY-MM-DD):', fechaRaw, '→', fechaFormateada);
      console.log('✅✅✅ PRESUPUESTO GUARDADO EN ESTADO:', presupuestoParaEstado);

      // 🆕 LOG CLARO DEL MODO DETECTADO
      console.log('═══════════════════════════════════════');
      console.log('   MODO DE PRESUPUESTO DETECTADO');
      console.log('═══════════════════════════════════════');
      console.log('Modo:', modoPresupuesto);
      console.log('Total Materiales:', totalMateriales);
      console.log('Items Detallados:', tieneItemsDetallados);
      console.log('Cantidad Items:', todosMateriales.length);
      console.log('Importe Disponible:', importeGlobalDisponible);
      console.log('═══════════════════════════════════════');

      console.log('🔍🔍🔍 FIN CARGA DE PRESUPUESTO 🔍🔍🔍');
    } catch (error) {
      console.error('❌ Error cargando presupuesto:', error);
      setError(error.message);
    } finally {
      setLoadingPresupuesto(false);
    }
  };

  // Función para calcular stock real disponible desde asignaciones en BD
  const calcularStockDisponible = (materialId) => {
    // Sumar todas las cantidades asignadas de este material desde BD
    const totalAsignado = asignaciones
      .filter(a => a.presupuestoMaterialId === materialId || a.materialId === materialId)
      .reduce((sum, a) => sum + (parseFloat(a.cantidadAsignada) || 0), 0);

    // Encontrar el material original
    const materialOriginal = materialesDisponibles.find(m => m.id === materialId);
    if (!materialOriginal) return 0;

    // Calcular disponible real
    const disponibleReal = (materialOriginal.cantidadDisponible || 0) - totalAsignado;
    return Math.max(0, disponibleReal); // No puede ser negativo
  };

  // Función para obtener estado de stock actualizado
  const getEstadoStockActualizado = (materialId) => {
    const disponibleReal = calcularStockDisponible(materialId);

    if (disponibleReal === 0) return 'AGOTADO';
    if (disponibleReal <= 10) return 'STOCK_BAJO'; // Configurable
    return 'DISPONIBLE';
  };

  // Función para obtener la fecha de asignación real basada en fecha probable inicio
  const obtenerFechaAsignacionReal = () => {
    // Usar fechaProbableInicio del presupuesto cargado (reactivo)
    if (presupuesto?.fechaProbableInicio) {
      console.log('ðŸ“… obtenerFechaAsignacionReal - usando presupuesto.fechaProbableInicio:', presupuesto.fechaProbableInicio);
      return presupuesto.fechaProbableInicio;
    }
    // Fallback: intentar obtener del DOM si no está en presupuesto
    const inputFecha = document.querySelector('input[name="fechaProbableInicio"]');
    const fechaFallback = inputFecha?.value || new Date().toISOString().split('T')[0];
    console.log('âš ï¸ obtenerFechaAsignacionReal - usando fallback:', fechaFallback);
    return fechaFallback;
  };

  const cargarAsignacionesActuales = async () => {
    console.log('🔄 Cargando asignaciones actuales para obra:', obra?.id);
    try {
      // Limpiamos referencias a localStorage que ya no se deben usar

      const { obtenerMaterialesAsignados } = await import('../services/obraMaterialService');
      const materialesBDRaw = await obtenerMaterialesAsignados(obra.id, empresaSeleccionada.id);
      const materialesBD = (Array.isArray(materialesBDRaw) ? materialesBDRaw : []).map(m => ({
        ...m,
        // Normalización crítica para que funcione la tarjeta de semana
        numeroSemana: m.numeroSemana || m.semana || null, // Backend suele devolver 'semana'
        esSemanal: m.esSemanal || (m.semana ? true : false), // Inferir si es semanal si tiene semana
        cantidadAsignada: m.cantidadAsignada ?? m.cantidad,
        // Asegurar campos de material
        nombreMaterial: m.nombreMaterial || m.nombre || m.presupuestoMaterial?.nombre || 'Material Sin Nombre',
        unidadMedida: m.unidadMedida || m.unidad || m.presupuestoMaterial?.unidad || 'un'
      }));

      console.log('📡 Materiales desde backend (normalizados):', materialesBD.length, materialesBD);

      // NOTA: Se ha eliminado la mezcla con localStorage para asegurar que solo se muestren
      // datos reales confirmados por el backend.

      console.log('✅ Total materiales asignados (Backend puro):', materialesBD.length, materialesBD);
      setAsignaciones(materialesBD);
    } catch (error) {
      console.error('❌ Error cargando asignaciones de materiales:', error);
      // En caso de error, dejamos la lista vacía en lugar de mostrar datos obsoletos de localStorage
      setAsignaciones([]);
    }
  };

  // Función para validar stock antes de asignar
  const validarStockAntes = () => {
    const material = materialesDisponibles.find(m => m.id.toString() === nuevaAsignacion.materialId.toString());
    if (!material) {
      throw new Error('Material no encontrado');
    }

    // Usar stock real disponible en lugar del original
    const stockReal = calcularStockDisponible(material.id);
    const estadoReal = getEstadoStockActualizado(material.id);

    if (estadoReal === 'AGOTADO') {
      throw new Error('No se puede asignar material agotado');
    }

    const cantidadAsignar = parseFloat(nuevaAsignacion.cantidad);
    if (cantidadAsignar > stockReal) {
      throw new Error(`Stock insuficiente. Disponible: ${stockReal}, Solicitado: ${cantidadAsignar}`);
    }

    return material;
  };

  const handleAsignarMaterial = async () => {
    if (!nuevaAsignacion.tipoAsignacion) {
      alert('Por favor seleccione el tipo de asignación');
      return;
    }

    const cantidadNum = parseFloat(nuevaAsignacion.cantidad) || 0;
    if (cantidadNum <= 0) {
      alert('Por favor ingrese una cantidad válida');
      return;
    }

    // Validar presupuesto disponible para asignaciones GLOBALES
    if (nuevaAsignacion.tipoAsignacion === 'CANTIDAD_GLOBAL') {
      const importeTotal = cantidadNum * (parseFloat(nuevaAsignacion.precioUnitario) || 0);
      if (importeTotal > importeGlobalDisponible) {
        alert(`âš ï¸ El importe ($${importeTotal.toLocaleString('es-AR')}) excede el disponible ($${importeGlobalDisponible.toLocaleString('es-AR')})`);
        return;
      }
    }

    // Calcular número de semana desde fecha de asignación
    let numeroSemana = null;
    if (nuevaAsignacion.fechaAsignacion && presupuesto?.fechaProbableInicio) {
      const fechaAsignacion = new Date(nuevaAsignacion.fechaAsignacion + 'T12:00:00');
      const fechaInicio = new Date(presupuesto.fechaProbableInicio.split('T')[0] + 'T12:00:00');
      const diffMs = fechaAsignacion - fechaInicio;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      numeroSemana = Math.floor(diffDays / 7) + 1;
    }

    setLoading(true);
    setError(null);

    try {
      if (nuevaAsignacion.tipoAsignacion === 'CANTIDAD_GLOBAL') {
        throw new Error('Los materiales manuales aún no están soportados. El backend requiere que el material esté en el presupuesto (material_calculadora). Use solo materiales del presupuesto por ahora.');
      }

      // ELEMENTO_DETALLADO
      if (!nuevaAsignacion.materialId) {
        throw new Error('Debe seleccionar un material del presupuesto');
      }

      validarStockAntes();

      const { asignarMaterial } = await import('../services/obraMaterialService');

      const datosAsignacion = {
        presupuestoMaterialId: parseInt(nuevaAsignacion.materialId),
        cantidadAsignada: cantidadNum,
        precioUnitario: parseFloat(nuevaAsignacion.precioUnitario) || 0, // 🔥 Agregado para enviar precio manual
        numeroSemana,
        fechaAsignacion: nuevaAsignacion.fechaAsignacion || null,
        observaciones: nuevaAsignacion.observaciones || ''
      };

      await asignarMaterial(obra.id, datosAsignacion, empresaSeleccionada.id);

      setNuevaAsignacion({
        tipoAsignacion: '',
        materialId: '',
        cantidad: '',
        precioUnitario: '',
        fechaAsignacion: '',
        observaciones: '',
        esManual: false
      });
      setNuevoMaterialManual({
        nombre: '',
        unidad: 'un',
        unidadCustom: ''
      });

      await cargarAsignacionesActuales();
      if (onAsignacionExitosa) onAsignacionExitosa();
      setForceUpdate(prev => prev + 1);

      alert('✅ Material asignado exitosamente');
    } catch (error) {
      console.error('âŒ Error al asignar material:', error);
      setError(error.message);
      alert(`Error al asignar material: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Nueva función: manejar asignaciones semanales múltiples
  const handleAsignacionSemanalCompleta = async (asignacionesSemana) => {
    if (!asignacionesSemana || asignacionesSemana.length === 0) {
      console.log('âš ï¸ No hay asignaciones para procesar');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('📤 [AsignacionSemanal] Procesando asignaciones:', asignacionesSemana.length);
      console.log('📤 [AsignacionSemanal] Tipo asignaciones:', asignacionesSemana[0]?.esManual ? 'GLOBALES' : 'PRESUPUESTO');

      // Separar asignaciones globales de las del presupuesto
      const asignacionesGlobales = asignacionesSemana.filter(a => a.esManual);
      const asignacionesPresupuesto = asignacionesSemana.filter(a => !a.esManual);

      console.log('📊 [AsignacionSemanal] Globales:', asignacionesGlobales.length, 'Presupuesto:', asignacionesPresupuesto.length);

      // Procesar asignaciones GLOBALES (crear material en catálogo + asignar a obra)
      const resultados = [];
      if (asignacionesGlobales.length > 0) {
        console.log('✅ [AsignacionSemanal] Materiales globales - Backend soporta');
        console.log('ðŸ“ Asignando materiales globales directamente a BD...');

        const { asignarMaterial } = await import('../services/obraMaterialService');

        for (const asig of asignacionesGlobales) {
          try {
            const datosAsignacion = {
              descripcion: asig.nombreMaterial || asig.nombre,
              unidadMedida: asig.unidadMedida || asig.unidad,
              cantidadAsignada: parseFloat(asig.cantidadAsignada ?? asig.cantidad),
              precioUnitario: parseFloat(asig.precioUnitario) || 0, // 🔥 Agregado precio para globales
              numeroSemana: asig.numeroSemana,
              observaciones: asig.observaciones || '',
              esGlobal: true
            };

            await asignarMaterial(obra.id, datosAsignacion, empresaSeleccionada.id);
            resultados.push(asig);
            console.log('✅ Material global asignado:', asig.nombreMaterial);
          } catch (error) {
            console.error('âŒ Error asignando material global:', error);
          }
        }

        console.log(`✅ ${asignacionesGlobales.length} materiales globales guardados en BD`);
      }

      // Procesar asignaciones del presupuesto con el backend
      if (asignacionesPresupuesto.length > 0) {
        const { asignarMaterial } = await import('../services/obraMaterialService');

        for (const asignacion of asignacionesPresupuesto) {
          const datosAsignacion = {
            presupuestoMaterialId: parseInt(asignacion.materialId),
            cantidadAsignada: parseFloat(asignacion.cantidad),
            precioUnitario: parseFloat(asignacion.precioUnitario) || 0,
            numeroSemana: asignacion.numeroSemana,
            fechaAsignacion: asignacion.fechaAsignacion || null,
            esSemanal: asignacion.esSemanal || false,
            observaciones: asignacion.observaciones || '',
            esGlobal: false
          };

          try {
            await asignarMaterial(obra.id, datosAsignacion, empresaSeleccionada.id);
            resultados.push(asignacion);
          } catch (err) {
            console.error('❌ Error asignando material individual:', err);
          }
        }
      }

      console.log('✅ [AsignacionSemanal] Completadas:', resultados.length);

      // Recargar asignaciones
      await cargarAsignacionesActuales();

      // Cerrar modal
      setMostrarAsignacionSemanal(false);

      if (onAsignacionExitosa) {
        onAsignacionExitosa();
      }

      // Recargar asignaciones para actualizar UI (contadores de tarjetas, etc.)
      await cargarAsignacionesActuales();

      setForceUpdate(prev => prev + 1);

      alert(`✅ Se asignaron ${resultados.length} materiales para la semana`);

    } catch (error) {
      console.error('âŒ [AsignacionSemanal] Error:', error);
      setError(error.message);
      alert(`Error en asignaciones semanales: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarAsignacion = async (asignacionId) => {
    if (!confirm('¿Está seguro de eliminar esta asignación?')) {
      return;
    }

    try {
      const key = `obra_materiales_${obra.id}_${empresaSeleccionada.id}`;
      const localesRaw = JSON.parse(localStorage.getItem(key) || '[]');
      const locales = Array.isArray(localesRaw) ? localesRaw : [];

      const existeLocal = locales.some(a => a.id === asignacionId);
      if (existeLocal || (typeof asignacionId === 'string' && asignacionId.startsWith('MANUAL_'))) {
        const filtradas = locales.filter(a => a.id !== asignacionId);
        localStorage.setItem(key, JSON.stringify(filtradas));
        await cargarAsignacionesActuales();
        if (onAsignacionExitosa) onAsignacionExitosa();
        setForceUpdate(prev => prev + 1);
        alert('✅ Asignación eliminada exitosamente');
        return;
      }

      const { eliminarAsignacion } = await import('../services/obraMaterialService');
      await eliminarAsignacion(obra.id, asignacionId, empresaSeleccionada.id);

      await cargarAsignacionesActuales();
      if (onAsignacionExitosa) onAsignacionExitosa();
      setForceUpdate(prev => prev + 1);
      alert('✅ Asignación eliminada exitosamente');
    } catch (error) {
      console.error('âŒ [handleEliminar] Error:', error);
      alert(`Error eliminando asignación: ${error.message}`);
    }
  };

  // Funciones para manejo de detalle semanal
  const abrirDetalleSemana = (numeroSemana) => {
    setSemanaSeleccionada(numeroSemana);
    setMostrarDetalleSemana(true);

    // Calcular días hábiles de la semana
    const diasSemana = calcularDiasHabilesSemana(numeroSemana);
    console.log(`ðŸ“… Abriendo detalle semana ${numeroSemana}:`, diasSemana);
  };

  // Nueva función: abrir formulario con fecha específica
  const abrirAsignacionParaDia = (fechaStr) => {
    setNuevaAsignacion({
      tipoAsignacion: '',
      materialId: '',
      cantidad: '',
      fechaAsignacion: fechaStr,
      observaciones: '',
      esManual: false
    });
    setNuevoMaterialManual({
      nombre: '',
      unidad: 'un',
      unidadCustom: ''
    });
    setMostrarDetalleSemana(false); // Cerrar detalle semanal
    setMostrarFormularioIndividual(true); // Abrir formulario individual
  };

  // Nueva función: abrir modal de asignación semanal completa
  const abrirAsignacionSemanal = (numeroSemana) => {
    setSemanaAsignacionCompleta(numeroSemana);
    setMostrarDetalleSemana(false); // Cerrar detalle si estaba abierto
    setMostrarAsignacionSemanal(true);
  };

  // Función para manejar envío del formulario individual
  const handleSubmit = async (e) => {
    e.preventDefault();
    await handleAsignarMaterial();
    setMostrarFormularioIndividual(false); // Cerrar formulario tras éxito
  };

  // Función para verificar si una fecha es feriado en Argentina
  const esFeriadoFn = (fecha) => {
    const year = fecha.getFullYear();
    const mes = fecha.getMonth() + 1;
    const dia = fecha.getDate();
    const mesdia = `${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

    const feriadosFijos = [
      '01-01', '03-24', '04-02', '05-01', '05-25', '06-20',
      '07-09', '12-08', '12-25'
    ];

    if (feriadosFijos.includes(mesdia)) return true;

    // Cálculo de Pascua
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    const pascua = new Date(year, month - 1, day);

    const carnavalLunes = new Date(pascua);
    carnavalLunes.setDate(pascua.getDate() - 48);
    const carnavalMartes = new Date(pascua);
    carnavalMartes.setDate(pascua.getDate() - 47);
    const juevesSanto = new Date(pascua);
    juevesSanto.setDate(pascua.getDate() - 3);
    const viernesSanto = new Date(pascua);
    viernesSanto.setDate(pascua.getDate() - 2);

    const compararFecha = (f1, f2) => {
      return f1 && f2 &&
             f1.getFullYear() === f2.getFullYear() &&
             f1.getMonth() === f2.getMonth() &&
             f1.getDate() === f2.getDate();
    };

    if (compararFecha(fecha, carnavalLunes) ||
        compararFecha(fecha, carnavalMartes) ||
        compararFecha(fecha, juevesSanto) ||
        compararFecha(fecha, viernesSanto)) {
      return true;
    }

    // Feriados puente por año
    if (year === 2025 && ['04-18', '05-02', '06-16', '10-13', '11-24'].includes(mesdia)) return true;
    if (year === 2026 && ['02-16', '02-17', '03-23', '06-15', '10-12', '11-23'].includes(mesdia)) return true;
    if (year === 2027 && ['02-08', '02-09', '03-25', '03-26', '05-24', '06-21', '10-11', '11-22'].includes(mesdia)) return true;
    if (year === 2028 && ['02-28', '02-29', '04-13', '04-14', '05-26', '06-19', '10-09', '11-20'].includes(mesdia)) return true;

    return false;
  };

  // Calcular array de días hábiles reales (excluyendo fines de semana y feriados)
  const calcularDiasHabiles = (inicio, cantidadDias) => {
    const dias = [];
    let diasAgregados = 0;
    let fechaActual = new Date(inicio);

    while (diasAgregados < cantidadDias) {
      const diaSemana = fechaActual.getDay();
      const esFinDeSemana = diaSemana === 0 || diaSemana === 6;
      const esFeriado = esFeriadoFn(fechaActual);

      if (!esFinDeSemana && !esFeriado) {
        dias.push(new Date(fechaActual));
        diasAgregados++;
      }

      fechaActual.setDate(fechaActual.getDate() + 1);
    }

    return dias;
  };

  // Calcular días hábiles disponibles según diasHabiles (semanasObjetivo * 5)
  const diasHabilesDisponibles = useMemo(() => {
    if (!configuracionObraActualizada?.fechaInicio || !configuracionObraActualizada?.diasHabiles) return [];

    const fechaInicio = configuracionObraActualizada.fechaInicio.includes('-')
      ? new Date(configuracionObraActualizada.fechaInicio.split('T')[0] + 'T12:00:00')
      : new Date(configuracionObraActualizada.fechaInicio);

    return calcularDiasHabiles(fechaInicio, configuracionObraActualizada.diasHabiles);
  }, [configuracionObraActualizada?.fechaInicio, configuracionObraActualizada?.diasHabiles]);

  // Calcular semanas necesarias basándose en días hábiles reales
  const semanas = useMemo(() => {
    if (!configuracionObraActualizada?.fechaInicio || diasHabilesDisponibles.length === 0) return [];

    const fechaInicio = configuracionObraActualizada.fechaInicio.includes('-')
      ? new Date(configuracionObraActualizada.fechaInicio.split('T')[0] + 'T12:00:00')
      : new Date(configuracionObraActualizada.fechaInicio);

    const semanasPorProyecto = [];

    // Encontrar el lunes de la semana de inicio
    const primerLunes = new Date(fechaInicio);
    const diaSemana = primerLunes.getDay();
    const diasHastaLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
    primerLunes.setDate(primerLunes.getDate() + diasHastaLunes);

    // El último día hábil determina hasta dónde generar semanas
    const ultimoDiaHabil = diasHabilesDisponibles[diasHabilesDisponibles.length - 1];
    if (!ultimoDiaHabil) return [];

    let fechaActual = new Date(primerLunes);
    let numeroSemana = 1;

    while (fechaActual <= ultimoDiaHabil) {
      const diasSemana = [];

      // Generar los 7 días de la semana (Lunes a Domingo)
      for (let i = 0; i < 7; i++) {
        const fecha = new Date(fechaActual);
        fecha.setDate(fechaActual.getDate() + i);
        fecha.setHours(0, 0, 0, 0);

        const esFinDeSemana = fecha.getDay() === 0 || fecha.getDay() === 6;
        const esFeriado = esFeriadoFn(fecha);

        const fechaInicioNormalizada = new Date(fechaInicio);
        fechaInicioNormalizada.setHours(0, 0, 0, 0);

        const esAntesDeInicio = fecha < fechaInicioNormalizada;
        const esDespuesDelFinal = ultimoDiaHabil && fecha > ultimoDiaHabil;

        diasSemana.push({
          fecha: new Date(fecha),
          esHabil: !esFinDeSemana && !esFeriado && !esAntesDeInicio && !esDespuesDelFinal
        });
      }

      // Solo agregar la semana si tiene al menos un día hábil
      const tieneHabiles = diasSemana.some(d => d.esHabil);
      if (tieneHabiles) {
        semanasPorProyecto.push({
          numeroSemana: numeroSemana,
          diasHabiles: diasSemana.filter(d => d.esHabil).length,
          fechaInicio: diasSemana[0].fecha,
          fechaFin: diasSemana[6].fecha
        });
        numeroSemana++;
      }

      fechaActual.setDate(fechaActual.getDate() + 7);
    }

    console.log(`📊 [MATERIALES] ${semanasPorProyecto.length} semanas necesarias para ${configuracionObraActualizada.diasHabiles} días hábiles objetivo`);
    return semanasPorProyecto;
  }, [configuracionObraActualizada?.fechaInicio, diasHabilesDisponibles]);

  const calcularDiasHabilesSemana = (numeroSemana) => {
    // Usar fechaProbableInicio del presupuesto (reactivo) con fallback a configuracionObra
    const fechaInicioAUsar = presupuesto?.fechaProbableInicio || configuracionObra?.fechaInicio;

    if (!fechaInicioAUsar || !numeroSemana || numeroSemana < 1) {
      console.warn('âš ï¸ Parámetros inválidos para calcular días hábiles:', { fechaInicio: fechaInicioAUsar, numeroSemana });
      return [];
    }

    try {
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

      const fechaInicio = parsearFechaLocal(fechaInicioAUsar);
      console.log('ðŸ“… Calculando semana', numeroSemana, 'con fechaInicio:', fechaInicioAUsar, '(desde presupuesto:', !!presupuesto?.fechaProbableInicio, ')');

      // Validar que fechaInicio es válida
      if (isNaN(fechaInicio.getTime())) {
        console.error('âŒ Fecha de inicio inválida:', fechaInicioAUsar);
        return [];
      }

      // Encontrar el lunes de la semana de inicio (solo para semana 1)
      const primerLunes = new Date(fechaInicio.getTime());
      const diaSemanaInicio = primerLunes.getDay();
      const diasHastaPrimerLunes = diaSemanaInicio === 0 ? -6 : 1 - diaSemanaInicio;
      primerLunes.setDate(primerLunes.getDate() + diasHastaPrimerLunes);

      // Validar que primerLunes es válida
      if (isNaN(primerLunes.getTime())) {
        console.error('âŒ Primer lunes inválido:', primerLunes);
        return [];
      }

      // Para la semana solicitada, calcular su lunes sumando semanas completas (7 días)
      const inicioSemana = new Date(primerLunes.getTime());
      inicioSemana.setDate(primerLunes.getDate() + ((numeroSemana - 1) * 7));

      // Validar que inicioSemana es válida
      if (isNaN(inicioSemana.getTime())) {
        console.error('âŒ Fecha de inicio de semana inválida:', inicioSemana);
        return [];
      }

      // Generar lunes a viernes, filtrando feriados
      const nombresDias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
      const diasHabiles = [];
      for (let i = 0; i < 5; i++) {
        const dia = new Date(inicioSemana.getTime()); // Usar getTime() para clonar correctamente
        dia.setDate(inicioSemana.getDate() + i);

        // Validar cada día antes de añadirlo
        if (isNaN(dia.getTime())) {
          console.error(`âŒ Día ${i} inválido:`, dia);
          continue;
        }

        // Verificar si es feriado
        const esFeriado = esFeriadoFn(dia);

        // Solo agregar si NO es feriado
        if (!esFeriado) {
          // Obtener el día de la semana real (0=Domingo, 1=Lunes, etc.)
          const diaSemana = dia.getDay();
          // Ajustar para que Lunes=0, Martes=1, etc.
          const indiceDia = diaSemana === 0 ? 6 : diaSemana - 1;

          diasHabiles.push({
            fecha: new Date(dia.getTime()),
            fechaStr: dia.toISOString().split('T')[0],
            nombre: nombresDias[indiceDia],
            numero: dia.getDate()
          });
        }
      }

      console.log(`ðŸ“… Días hábiles calculados para semana ${numeroSemana}:`, diasHabiles);
      return diasHabiles;

    } catch (error) {
      console.error('âŒ Error calculando días hábiles de semana:', error);
      return [];
    }

    return diasHabiles;
  };

  const cerrarDetalleSemana = () => {
    setMostrarDetalleSemana(false);
    setSemanaSeleccionada(null);
  };

  if (!show) return null;

  return (
    <>
    <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
      <div className="modal-dialog modal-xl">
        <div className="modal-content">
          {/* Header */}
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title">
              <i className="fas fa-boxes me-2"></i>
              Asignar Materiales - {obra?.nombre}
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
            ></button>
          </div>

          {/* Body - Con key para forzar re-render cuando se recarga */}
          <div className="modal-body" key={`materiales-body-${forceUpdate}`}>
            {error && (
              <div className="alert alert-danger">
                <i className="fas fa-exclamation-triangle me-2"></i>
                {error}
              </div>
            )}

            {loadingPresupuesto ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Cargando...</span>
                </div>
                <p className="mt-3">Cargando presupuesto...</p>
              </div>
            ) : !presupuesto ? (
              <div className="alert alert-warning">
                <i className="fas fa-exclamation-triangle me-2"></i>
                No se encontró un presupuesto para esta obra
              </div>
            ) : (
              <>
                {console.log('🎨 RENDERIZANDO SECCIÓN MODO PRESUPUESTO - Modo:', modoPresupuesto, 'Presupuesto:', !!presupuesto)}
                {/* ℹ️ Información del modo de presupuesto */}
                <div className="alert alert-info mb-3" style={{border: '3px solid red'}}>
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <strong>
                        <i className="fas fa-info-circle me-2"></i>
                        Modo de Presupuesto: {
                          modoPresupuesto === 'GLOBAL'
                            ? '🌍 Global'
                            : (modoPresupuesto === 'MIXTO' ? '🧩 Mixto' : '📋 Detallado')
                        }
                      </strong>
                    </div>
                    {(modoPresupuesto === 'GLOBAL' || modoPresupuesto === 'MIXTO') && (
                      <div className="text-end">
                        <div>
                          <small className="text-muted">Presupuesto Total:</small>{' '}
                          <strong className="text-primary">
                            ${(presupuesto.presupuestoGeneral?.totalMateriales || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                        <div>
                          <small className="text-muted">Disponible:</small>{' '}
                          <strong className={importeGlobalDisponible <= 0 ? 'text-danger' : 'text-success'}>
                            ${importeGlobalDisponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                      </div>
                    )}
                  </div>
                  {modoPresupuesto === 'DETALLE' && (
                    <div className="mt-2">
                      <small className="text-muted">
                        💡 <strong>Modo Detalle:</strong> Selecciona materiales específicos del presupuesto para asignar a la obra.
                      </small>
                    </div>
                  )}
                </div>

                {/* Distribución semanal estimada - solo si hay configuración */}
                {configuracionObra && configuracionObra.semanasObjetivo && (
                  <div className="card mb-3 border-info">
                    <div className="card-header bg-info text-white">
                      <h6 className="mb-0">
                        <i className="fas fa-calendar-week me-2"></i>
                        Distribución Semanal Estimada
                      </h6>
                    </div>
                    <div className="card-body">
                      <div className="row">
                        {semanas.map((semanaInfo, index) => {
                          const semana = semanaInfo.numeroSemana;
                          // Contar materiales asignados en esta semana
                          const materialesSemana = asignaciones.filter(a => {
                            // Chequeo robusto de semana
                            if (a.numeroSemana) {
                                return a.numeroSemana == semana;
                            }
                            // Fallback a fechas si no hay número de semana explícito
                            if (a.fechaAsignacion && semanaInfo.fechaInicio && semanaInfo.fechaFin) {
                              // Normalizar fecha asginación (quitar hora si viene completa)
                              const fecha = new Date(a.fechaAsignacion.includes('T') ? a.fechaAsignacion.split('T')[0] + 'T12:00:00' : a.fechaAsignacion);
                              return fecha >= semanaInfo.fechaInicio && fecha <= semanaInfo.fechaFin;
                            }
                            // Si no hay fecha ni semana explícita, pero el backend lo devuelve como semana
                            if (a.semana && a.semana == semana) {
                                return true;
                            }
                            return false;
                          }).length;
                          const porcentajeSemana = (100 / semanas.length).toFixed(1);

                          return (
                            <div key={semana} className="col-md-6 col-lg-4 mb-2">
                              <div
                                className="border rounded p-2 bg-light hover-card"
                                style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                                onClick={() => abrirDetalleSemana(semana)}
                                onMouseEnter={(e) => {
                                  e.target.style.backgroundColor = '#e3f2fd';
                                  e.target.style.borderColor = '#2196f3';
                                }}
                                onMouseLeave={(e) => {
                                  e.target.style.backgroundColor = '#f8f9fa';
                                  e.target.style.borderColor = '#dee2e6';
                                }}
                              >
                                <div className="d-flex justify-content-between align-items-center">
                                  <strong className="text-primary">Semana {semana}</strong>
                                </div>
                                <small className="text-muted d-block">
                                  <i className="fas fa-boxes me-1"></i>
                                  {materialesSemana} materiales asignados
                                </small>
                                <small className="text-info d-block mt-1">
                                  <i className="fas fa-mouse-pointer me-1"></i>
                                  Clic para asignar materiales
                                </small>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="alert alert-light mt-2 mb-0">
                        <small className="text-muted">
                          <i className="fas fa-lightbulb me-1"></i>
                          <strong>Sugerencia:</strong> Los materiales se pueden distribuir por semana según las etapas de construcción.
                          Considere el cronograma de trabajo y las necesidades específicas de cada fase.
                        </small>
                      </div>
                    </div>
                  </div>
                )}

                {materialesDisponibles.length === 0 && asignaciones.length === 0 && (
                  <div className="alert alert-info">
                    <i className="fas fa-info-circle me-2"></i>
                    No hay materiales en el presupuesto de esta obra
                  </div>
                )}

                {/* Asignación por planificación semanal - se realiza desde las tarjetas de semanas */}

                {/* Lista de asignaciones actuales - MOSTRAR SIEMPRE si hay asignaciones */}
                {(materialesDisponibles.length > 0 || asignaciones.length > 0) && (
                  <div className="card">
                    <div className="card-header">
                      <h6 className="mb-0">
                        <i className="fas fa-list me-2"></i>
                        Materiales Asignados ({asignaciones.length})
                      </h6>
                    </div>
                    <div className="card-body">
                      {asignaciones.length === 0 ? (
                          <div className="text-center text-muted py-3">
                            <i className="fas fa-inbox fa-2x mb-2"></i>
                            <p className="mb-0">No hay materiales asignados a esta obra</p>
                          </div>
                        ) : (
                          <div className="table-responsive">
                            <table className="table table-hover">
                              <thead>
                                <tr>
                                  <th>Material</th>
                                  <th>Cantidad</th>
                                  <th>Fecha</th>
                                  <th>Observaciones</th>
                                  <th>Acciones</th>
                                </tr>
                              </thead>
                              <tbody>
                                {asignaciones.map((asignacion, index) => (
                                  <tr key={asignacion.id || index}>
                                    <td>{asignacion.nombreMaterial}</td>
                                    <td>{asignacion.cantidadAsignada} {asignacion.unidadMedida || 'unidad'}</td>
                                    <td>
                                      <small className="fw-bold">
                                        {asignacion.esSemanal ? (
                                          <span className="text-warning">
                                            <i className="fas fa-calendar-week me-1"></i>
                                            Toda la semana
                                          </span>
                                        ) : asignacion.fechaAsignacion ? (() => {
                                          const partes = asignacion.fechaAsignacion.split('T')[0].split('-');
                                          return `${partes[2]}/${partes[1]}/${partes[0]}`;
                                        })() : '-'}
                                      </small>
                                    </td>
                                    <td>
                                      <small className="text-muted">
                                        {asignacion.observaciones || '-'}
                                      </small>
                                    </td>
                                    <td>
                                      <button
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={() => handleEliminarAsignacion(asignacion.id)}
                                        title="Eliminar asignación"
                                      >
                                        <i className="fas fa-trash"></i>
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer" style={{ position: 'sticky', bottom: 0, backgroundColor: 'white', zIndex: 10, borderTop: '1px solid #dee2e6' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              <i className="fas fa-times me-2"></i>
              Cerrar
            </button>

            {/* Botón de consolidación */}
            <button
              type="button"
              className="btn btn-success"
              onClick={onClose}
            >
              <i className="fas fa-check-circle me-2"></i>
              Guardar y Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* Modal de Detalle Semanal */}
    <DetalleSemanalMaterialesModal
      show={mostrarDetalleSemana}
      onClose={() => setMostrarDetalleSemana(false)}
      obra={obra}
      numeroSemana={semanaSeleccionada}
      configuracionObra={configuracionObraActualizada}
      materialesDisponibles={materialesDisponibles}
      asignaciones={asignaciones}
      onAbrirAsignacionParaDia={abrirAsignacionParaDia}
      onAsignarParaTodaLaSemana={abrirAsignacionSemanal}
    />

    {/* Formulario de Asignación Individual */}
    {mostrarFormularioIndividual && (
      <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1060}}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header bg-warning text-dark">
              <h6 className="modal-title">
                <i className="fas fa-plus me-2"></i>
                Asignar Material - {nuevaAsignacion.fechaAsignacion}
              </h6>
              <button
                type="button"
                className="btn-close"
                onClick={() => setMostrarFormularioIndividual(false)}
              ></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                {/* Selector de Tipo de Asignación */}
                <div className="mb-3">
                  <label className="form-label">
                    <i className="fas fa-filter me-1"></i>
                    Tipo de Asignación
                  </label>
                  <select
                    className="form-select"
                    value={nuevaAsignacion.tipoAsignacion}
                    onChange={(e) => {
                      setNuevaAsignacion({
                        ...nuevaAsignacion,
                        tipoAsignacion: e.target.value,
                        materialId: '',
                        cantidad: '',
                        precioUnitario: '',
                        observaciones: '',
                        esManual: e.target.value === 'CANTIDAD_GLOBAL'
                      });
                      setNuevoMaterialManual({
                        nombre: '',
                        unidad: 'un',
                        unidadCustom: ''
                      });
                    }}
                    required
                  >
                    <option value="">Seleccionar tipo...</option>

                    {permiteManual && (
                      <option value="CANTIDAD_GLOBAL">
                        📦 Cantidad Global (Material manual)
                      </option>
                    )}

                    {tieneItemsDetallados && (
                      <option value="ELEMENTO_DETALLADO">
                        📋 Elemento del Presupuesto Detallado ({materialesDisponibles.length} items)
                      </option>
                    )}
                  </select>

                  {nuevaAsignacion.tipoAsignacion === 'CANTIDAD_GLOBAL' && (
                    <small className="text-muted d-block mt-1">
                      <i className="fas fa-info-circle me-1"></i>
                      Crearás un material manual (no requiere estar en el presupuesto).
                    </small>
                  )}
                  {nuevaAsignacion.tipoAsignacion === 'ELEMENTO_DETALLADO' && (
                    <small className="text-muted d-block mt-1">
                      <i className="fas fa-info-circle me-1"></i>
                      Seleccionarás un material específico del presupuesto (valida stock).
                    </small>
                  )}
                </div>

                {nuevaAsignacion.tipoAsignacion === 'CANTIDAD_GLOBAL' && (
                  <>
                    <div className="alert alert-success mb-3">
                      <strong>💰 Presupuesto Global de Materiales Disponible:</strong> ${(() => {
                        console.log('🖥️ [RENDER] Mostrando disponible:', importeGlobalDisponible);
                        return importeGlobalDisponible.toLocaleString('es-AR', { minimumFractionDigits: 2 });
                      })()}
                    </div>

                    <div className="mb-3">
                      <label className="form-label">
                        Nombre del Material <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        value={nuevoMaterialManual.nombre}
                        onChange={(e) => setNuevoMaterialManual({ ...nuevoMaterialManual, nombre: e.target.value })}
                        placeholder="Ej: Cemento, Arena, Ladrillos..."
                        required
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Unidad de Medida</label>
                      <select
                        className="form-select"
                        value={nuevoMaterialManual.unidad}
                        onChange={(e) => setNuevoMaterialManual({
                          ...nuevoMaterialManual,
                          unidad: e.target.value,
                          unidadCustom: e.target.value === 'otro' ? (nuevoMaterialManual.unidadCustom || '') : ''
                        })}
                      >
                        {unidadesMedida.map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                      {nuevoMaterialManual.unidad === 'otro' && (
                        <input
                          type="text"
                          className="form-control mt-2"
                          value={nuevoMaterialManual.unidadCustom || ''}
                          onChange={(e) => setNuevoMaterialManual({ ...nuevoMaterialManual, unidadCustom: e.target.value })}
                          placeholder="Escribí la unidad..."
                          required
                        />
                      )}
                    </div>
                  </>
                )}

                {nuevaAsignacion.tipoAsignacion === 'ELEMENTO_DETALLADO' && (
                  <>
                    <div className="mb-3">
                      <label className="form-label">Material</label>
                      <select
                        className="form-select"
                        value={nuevaAsignacion.materialId}
                        onChange={(e) => setNuevaAsignacion({ ...nuevaAsignacion, materialId: e.target.value })}
                        key={`material-selector-${forceUpdate}`}
                        required
                      >
                        <option value="">Seleccionar material...</option>
                        {materialesDisponibles.map(material => {
                          const disponibleReal = calcularStockDisponible(material.id);
                          const stockOriginal = material.cantidadDisponible || 0;
                          const estadoReal = getEstadoStockActualizado(material.id);
                                                  const icono = {
                            DISPONIBLE: '🟢',
                            STOCK_BAJO: '🟡',
                            AGOTADO: '🔴'
                          }[estadoReal] || '⚪';

                          const infoStock = disponibleReal !== stockOriginal
                            ? `${disponibleReal}/${stockOriginal}`
                            : `${disponibleReal}`;

                          return (
                            <option
                              key={material.id}
                              value={material.id}
                              disabled={estadoReal === 'AGOTADO'}
                            >
                              {icono} {material.nombre} - {infoStock} disponibles ({material.unidad})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {nuevaAsignacion.materialId && (() => {
                      const materialSeleccionado = materialesDisponibles.find(m => m.id.toString() === nuevaAsignacion.materialId.toString());
                      if (!materialSeleccionado) return null;

                      const disponibleReal = calcularStockDisponible(materialSeleccionado.id);
                      const estadoReal = getEstadoStockActualizado(materialSeleccionado.id);
                      const stockOriginal = materialSeleccionado.cantidadDisponible || 0;
                      const yaAsignado = stockOriginal - disponibleReal;
                      const precioUnitario = materialSeleccionado.precioUnitario || 0;
                      const totalPresupuestado = stockOriginal * precioUnitario;
                      const totalAsignado = yaAsignado * precioUnitario;
                      const totalDisponible = disponibleReal * precioUnitario;

                      return (
                        <>
                          {/* Panel informativo de disponibilidad */}
                          <div className="alert alert-info border-0 shadow-sm mb-3">
                            <div className="d-flex align-items-center mb-2">
                              <i className="fas fa-info-circle fs-5 me-2"></i>
                              <h6 className="mb-0 fw-bold">📦 {materialSeleccionado.nombre}</h6>
                            </div>
                            <div className="row g-2 small">
                              <div className="col-6">
                                <div className="d-flex justify-content-between">
                                  <span className="text-muted">💰 Presupuestado:</span>
                                  <strong>{stockOriginal} {materialSeleccionado.unidad}</strong>
                                </div>
                                <div className="d-flex justify-content-between">
                                  <span className="text-muted">💵 Valor total:</span>
                                  <strong>${totalPresupuestado.toLocaleString('es-AR', {minimumFractionDigits: 2})}</strong>
                                </div>
                              </div>
                              <div className="col-6">
                                <div className="d-flex justify-content-between">
                                  <span className="text-muted">✅ Ya asignado:</span>
                                  <strong className="text-primary">{yaAsignado} {materialSeleccionado.unidad}</strong>
                                </div>
                                <div className="d-flex justify-content-between">
                                  <span className="text-muted">💵 Asignado:</span>
                                  <strong className="text-primary">${totalAsignado.toLocaleString('es-AR', {minimumFractionDigits: 2})}</strong>
                                </div>
                              </div>
                              <div className="col-12">
                                <div className="border-top pt-2 mt-1">
                                  <div className="d-flex justify-content-between align-items-center">
                                    <span className="text-muted fw-bold">🟢 Disponible:</span>
                                    <span className={`fs-5 fw-bold ${estadoReal === 'AGOTADO' ? 'text-danger' : estadoReal === 'STOCK_BAJO' ? 'text-warning' : 'text-success'}`}>
                                      {disponibleReal} {materialSeleccionado.unidad}
                                    </span>
                                  </div>
                                  <div className="d-flex justify-content-between">
                                    <span className="text-muted">💵 Valor disponible:</span>
                                    <strong className="text-success">${totalDisponible.toLocaleString('es-AR', {minimumFractionDigits: 2})}</strong>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Alertas de stock */}
                          {estadoReal === 'STOCK_BAJO' && (
                            <div className="alert alert-warning d-flex align-items-center mb-3">
                              <i className="fas fa-exclamation-triangle me-2"></i>
                              ⚠️ Stock bajo: Solo quedan {disponibleReal} {materialSeleccionado.unidad}
                            </div>
                          )}
                          {estadoReal === 'AGOTADO' && (
                            <div className="alert alert-danger d-flex align-items-center mb-3">
                              <i className="fas fa-times-circle me-2"></i>
                              🚫 Material agotado - No hay stock disponible
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </>
                )}

                <div className="mb-3">
                  <label className="form-label">Cantidad</label>
                  <input
                    type="number"
                    className="form-control"
                    value={nuevaAsignacion.cantidad}
                    onChange={(e) => setNuevaAsignacion({...nuevaAsignacion, cantidad: e.target.value})}
                    min="0"
                    step="0.01"
                    required
                  />
                </div>

                {nuevaAsignacion.tipoAsignacion === 'CANTIDAD_GLOBAL' && (
                  <div className="mb-3">
                    <label className="form-label">Precio Unitario ($)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={nuevaAsignacion.precioUnitario || ''}
                      onChange={(e) => setNuevaAsignacion({...nuevaAsignacion, precioUnitario: e.target.value})}
                      min="0"
                      step="0.01"
                      required
                      placeholder="Ingrese el precio unitario"
                    />
                    {nuevaAsignacion.cantidad && nuevaAsignacion.precioUnitario && (
                      <small className="text-muted d-block mt-1">
                        <i className="fas fa-calculator me-1"></i>
                        Total: ${(parseFloat(nuevaAsignacion.cantidad) * parseFloat(nuevaAsignacion.precioUnitario)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </small>
                    )}
                  </div>
                )}

                <div className="mb-3">
                  <label className="form-label">Fecha de Asignación</label>
                  <input
                    type="date"
                    className="form-control"
                    value={nuevaAsignacion.fechaAsignacion}
                    onChange={(e) => setNuevaAsignacion({...nuevaAsignacion, fechaAsignacion: e.target.value})}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Observaciones (opcional)</label>
                  <textarea
                    className="form-control"
                    value={nuevaAsignacion.observaciones}
                    onChange={(e) => setNuevaAsignacion({...nuevaAsignacion, observaciones: e.target.value})}
                    rows="2"
                    placeholder="Observaciones adicionales..."
                  ></textarea>
                </div>
                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-success" disabled={loading}>
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Asignando...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-check me-2"></i>
                        Asignar Material
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setMostrarFormularioIndividual(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Modal de Asignación Semanal Completa */}
    {mostrarAsignacionSemanal && semanaAsignacionCompleta && (
      <AsignarMaterialSemanalModal
        show={mostrarAsignacionSemanal}
        onClose={() => setMostrarAsignacionSemanal(false)}
        obra={obra}
        numeroSemana={semanaAsignacionCompleta}
        diasSemana={calcularDiasHabilesSemana(semanaAsignacionCompleta)}
        materialesDisponibles={materialesDisponibles}
        modoPresupuesto={modoPresupuesto}
        cantidadGlobalDisponible={cantidadGlobalDisponible}
        onConfirmarAsignacion={handleAsignacionSemanalCompleta}
      />
    )}
    </>
  );
};

export default AsignarMaterialObraModal;


