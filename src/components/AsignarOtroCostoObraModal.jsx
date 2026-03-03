import React, { useState, useEffect, useMemo } from 'react';
import { useEmpresa } from '../EmpresaContext';
import DetalleSemanalGastosModal from './DetalleSemanalGastosModal';
import AsignarOtroCostoSemanalModal from './AsignarOtroCostoSemanalModal';
import api from '../services/api';
import { calcularSemanasParaDiasHabiles, esDiaHabil } from '../utils/feriadosArgentina';

/**
 * Modal para asignar otros costos/gastos generales del presupuestoNoCliente a una obra específica
 * Organiza la asignación por jornales y semanas para facilitar la planificación
 */
const AsignarOtroCostoObraModal = ({ show, onClose, obra, onAsignacionExitosa, configuracionObra = null }) => {
  const { empresaSeleccionada } = useEmpresa();

  // Helper para parsear fechas evitando problemas de zona horaria
  const parsearFechaLocal = (fechaStr) => {
    if (!fechaStr) return new Date();
    if (typeof fechaStr !== 'string') {
      return fechaStr instanceof Date ? fechaStr : new Date();
    }
    if (fechaStr.includes('-')) {
      const soloFecha = fechaStr.split('T')[0];
      const [year, month, day] = soloFecha.split('-');
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 7, 0, 0);
    }
    return new Date(fechaStr);
  };

  // Estados
  const [presupuesto, setPresupuesto] = useState(null);
  const [otrosCostosDisponibles, setOtrosCostosDisponibles] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingPresupuesto, setLoadingPresupuesto] = useState(false);
  const [error, setError] = useState(null);
  const [forceUpdate, setForceUpdate] = useState(0); // Para forzar re-render

  // 🆕 Estados para modo presupuesto (global vs detalle)
  const [modoPresupuesto, setModoPresupuesto] = useState(null); // 'GLOBAL' | 'DETALLE' | 'MIXTO'
  const [presupuestoGlobalDisponible, setPresupuestoGlobalDisponible] = useState(0);
  const [presupuestoGlobalTotal, setPresupuestoGlobalTotal] = useState(0);
  const [gastosCreados, setGastosCreados] = useState([]); // Gastos creados manualmente desde global
  const [rubrosPresupuesto, setRubrosPresupuesto] = useState([]);

  // Debug visible (por si el usuario no ve console logs)
  const [debugDeteccionPresupuesto, setDebugDeteccionPresupuesto] = useState(null);

  // Estados para detalle semanal
  const [mostrarDetalleSemana, setMostrarDetalleSemana] = useState(false);
  const [semanaSeleccionada, setSemanaSeleccionada] = useState(null);
  const [asignacionesPorDia, setAsignacionesPorDia] = useState({});

  // Estados para asignación semanal completa
  const [mostrarAsignacionSemanal, setMostrarAsignacionSemanal] = useState(false);
  const [semanaAsignacionCompleta, setSemanaAsignacionCompleta] = useState(null);
  const [rubroSeleccionado, setRubroSeleccionado] = useState('General'); // Rubro actual

  // Estado para formulario de asignación individual
  const [mostrarFormularioIndividual, setMostrarFormularioIndividual] = useState(false);

  // 🆕 Estado para creación manual de gasto
  const [mostrarCrearGastoManual, setMostrarCrearGastoManual] = useState(false);
  const [nuevoGastoManual, setNuevoGastoManual] = useState({
    descripcion: '',
    categoria: 'General',
    categoriaCustom: '',
    cantidadAsignada: '',
    importeUnitario: '',
    observaciones: '',
    tipoRegistro: 'GASTO_DIRECTO' // 'GASTO_DIRECTO' (retiro caja chica) o 'INVENTARIO' (con stock)
  });

  // Formulario de nueva asignación
  const [nuevaAsignacion, setNuevaAsignacion] = useState({
    tipoAsignacion: '', // 'IMPORTE_GLOBAL' o 'ELEMENTO_DETALLADO'
    otroCostoId: '', // ID del costo del presupuesto o 'MANUAL_' + timestamp
    cantidadAsignada: '',
    importeUnitario: '', // 🔥 NUEVO: importe por unidad
    importeAsignado: '',
    fechaAsignacion: '', // Inicializar vacío, se configura al abrir modal
    observaciones: '',
    esManual: false, // 🆕 Flag para gastos creados manualmente
    origenFondos: 'RETIRO_DIRECTO' // 🆕 'RETIRO_DIRECTO' | 'PRESUPUESTO_MATERIALES' (cuando presupuesto gastos = 0)
  });

  // 🆕 Estados para edición de asignación existente
  const [asignacionEnEdicion, setAsignacionEnEdicion] = useState(null);
  const [mostrarModalEdicion, setMostrarModalEdicion] = useState(false);

  // Calcular stock disponible real (descontando asignaciones)
  const calcularStockDisponible = (costoId) => {
    // Sumar todas las cantidades asignadas de este costo desde BD
    const totalAsignado = asignaciones
      .filter(a => a.otroCostoId === costoId)
      .reduce((sum, a) => sum + (parseFloat(a.cantidadAsignada) || 0), 0);

    // Encontrar el costo original
    const costoOriginal = otrosCostosDisponibles.find(c => c.id === costoId);
    if (!costoOriginal || costoOriginal.cantidadDisponible === null) return null;

    // Calcular disponible real
    const disponibleReal = (costoOriginal.cantidadDisponible || 0) - totalAsignado;

    console.log(`📊 Costo ${costoOriginal.nombre}: stock original=${costoOriginal.cantidadDisponible}, asignado=${totalAsignado}, disponible=${disponibleReal}`);

    return Math.max(0, disponibleReal);
  };

  // Función para obtener estado de stock actualizado
  const getEstadoStockActualizado = (costoId) => {
    const disponibleReal = calcularStockDisponible(costoId);

    if (disponibleReal === null) return 'SIN_STOCK';
    if (disponibleReal === 0) return 'AGOTADO';
    if (disponibleReal <= 2) return 'STOCK_BAJO';
    return 'DISPONIBLE';
  };

  // ✅ Helper para obtener el ID REAL de la obra (diferencia entre trabajo extra y obra normal)
  const getObraId = () => {
    if (!obra) return null;
    // 🔥 CRÍTICO: Un trabajo extra SIEMPRE debe usar su propio ID
    // NO usar _obraId (eso es la obra principal)
    if (obra._esTrabajoExtra) {
      console.log('🔥 TRABAJO EXTRA: Usando ID del trabajo extra:', obra.id);
      return obra.id; // ← USAR EL ID DEL TRABAJO EXTRA DIRECTAMENTE
    }
    // Si es una obra normal, usar el ID directo
    console.log('📋 OBRA NORMAL: Usando ID de la obra:', obra.id);
    return obra.id;
  };

  // 🔥 Crear configuración actualizada con fechaProbableInicio y jornales del presupuesto
  // ✅ GARANTIZAR SIEMPRE: fechaInicio y diasHabiles para mostrar tarjetas de semanas
  const configuracionObraActualizada = useMemo(() => {
    if (!configuracionObra && !presupuesto) return null;

    const baseConfig = configuracionObra || {};
    let fechaInicio = null;
    let diasHabiles = null;
    let diasHabilesPresupuesto = 0;

    // Obtener fechaInicio (prioridad: presupuesto -> configuracionObra)
    if (presupuesto?.fechaProbableInicio) {
      fechaInicio = presupuesto.fechaProbableInicio.includes('T')
        ? presupuesto.fechaProbableInicio.split('T')[0]
        : presupuesto.fechaProbableInicio;
    } else {
      fechaInicio = baseConfig.fechaInicio || baseConfig.fechaProbableInicio;
    }

    // Obtener días hábiles (prioridad: presupuesto -> configuracionObra)
    if (presupuesto) {
      if (presupuesto.tiempoEstimadoTerminacion) {
        diasHabilesPresupuesto = presupuesto.tiempoEstimadoTerminacion;
      } else if (presupuesto.itemsCalculadora && Array.isArray(presupuesto.itemsCalculadora)) {
        // Fallback: calcular sumando jornales si no existe tiempoEstimadoTerminacion
        diasHabilesPresupuesto = presupuesto.itemsCalculadora.reduce((total, rubro) => {
          const esLegacyDuplicado = rubro.tipoProfesional?.toLowerCase().includes('migrado') ||
                                    rubro.tipoProfesional?.toLowerCase().includes('legacy') ||
                                    rubro.descripcion?.toLowerCase().includes('migrados desde tabla legacy');
          if (esLegacyDuplicado) return total;

          const incluir = rubro.incluirEnCalculoDias !== false;
          if (!incluir) return total;

          const jornalesRubro = rubro.jornales?.reduce((sum, j) => sum + (j.cantidad || 0), 0) || 0;
          const profesionalesRubro = rubro.profesionales?.reduce((sum, p) => sum + (p.cantidadJornales || 0), 0) || 0;
          return total + jornalesRubro + profesionalesRubro;
        }, 0) || baseConfig.jornalesTotales;
      } else {
        diasHabilesPresupuesto = baseConfig.jornalesTotales || 0;
      }
    } else {
      diasHabilesPresupuesto = baseConfig.tiempoEstimadoTerminacion || baseConfig.jornalesTotales || 0;
    }

    // 🔥 USAR días hábiles del presupuesto (fuente de verdad), NO semanasObjetivo × 5
    // Prioridad: 1. Presupuesto (propiedad) -> 2. Presupuesto (calculado) -> 3. Config (dias) -> 4. Config (semanas)
    const semanasObjetivo = Number(baseConfig.semanasObjetivo);
    const diasDesdeSemanas = Number.isFinite(semanasObjetivo) ? semanasObjetivo * 5 : null;
    diasHabiles = presupuesto?.tiempoEstimadoTerminacion || diasHabilesPresupuesto || baseConfig.diasHabiles || diasDesdeSemanas;
    const capacidadNecesaria = diasHabiles > 0 ? Math.ceil(diasHabilesPresupuesto / diasHabiles) : 0;

    return {
      ...baseConfig,
      fechaInicio: fechaInicio || baseConfig.fechaInicio,
      jornalesTotales: diasHabilesPresupuesto,
      diasHabiles,
      capacidadNecesaria,
      semanasObjetivo: baseConfig.semanasObjetivo || presupuesto?.semanasObjetivo || null,
      presupuestoSeleccionado: presupuesto || null
    };
  }, [configuracionObra, presupuesto]);

  // Cargar presupuesto de la obra
  useEffect(() => {
    console.log('🔄 [OTROS COSTOS] useEffect [show, obra] ejecutado - show:', show, 'obra.id:', obra?.id);
    if (show && obra) {
      // Ejecutar carga secuencial para trabajos extra
      const cargarDatos = async () => {
        // Incrementar forceUpdate ANTES de cargar para forzar re-render
        setForceUpdate(prev => prev + 1);

        // 🔥 PRIMERO cargar el presupuesto (setea el estado con itemsCalculadora)
        const presupuestoCargado = await cargarPresupuestoObra();

        // 🔥 DESPUÉS cargar asignaciones pasando el presupuesto directamente
        // Esto evita el problema de setState asíncrono
        await cargarAsignacionesActuales(presupuestoCargado);
      };

      cargarDatos();
    } else if (!show) {
      // Limpiar estado cuando se cierra para forzar recarga fresca
      console.log('🧹 [OTROS COSTOS] Limpiando estado del modal (cerrado)');
      setPresupuesto(null);
      setOtrosCostosDisponibles([]);
      setModoPresupuesto(null);
      setPresupuestoGlobalDisponible(0);
      setPresupuestoGlobalTotal(0);
      setGastosCreados([]);
      setRubrosPresupuesto([]);
      setDebugDeteccionPresupuesto(null);
    }
  }, [show, obra, configuracionObra?.presupuestoSeleccionado?.id]);

  // 🆕 useEffect para recalcular disponible del presupuesto global cuando cambian asignaciones
  useEffect(() => {
    console.log('🔄 [DEBUG DISPONIBLE] useEffect ejecutado con:', {
      modoPresupuesto,
      presupuestoGlobalTotal,
      asignacionesLength: asignaciones.length,
      esTrabajoExtra: obra._esTrabajoExtra || false
    });

    if (modoPresupuesto === 'GLOBAL') { // ✅ Removida condición presupuestoGlobalTotal > 0 que causaba problemas
      const totalAsignado = asignaciones.reduce((sum, asig) => {
        return sum + (parseFloat(asig.importeAsignado) || 0);
      }, 0);

      const disponibleRestante = presupuestoGlobalTotal - totalAsignado;
      setPresupuestoGlobalDisponible(Math.max(0, disponibleRestante));

      console.log(`🔄 [DEBUG DISPONIBLE] Calculando${obra._esTrabajoExtra ? ' (TRABAJO EXTRA)' : ''} - Total: $${presupuestoGlobalTotal.toLocaleString('es-AR')}, Asignado: $${totalAsignado.toLocaleString('es-AR')}, Disponible: $${disponibleRestante.toLocaleString('es-AR')}`);

      // 🔍 DEBUG ADICIONAL para trabajos extra
      if (obra._esTrabajoExtra) {
        console.log('🔍 [TRABAJO EXTRA] Detalle de asignaciones:', {
          totalAsignaciones: asignaciones.length,
          asignacionesDetalle: asignaciones.map(a => ({
            id: a.id,
            importe: a.importeAsignado,
            descripcion: a.descripcion
          }))
        });
      }
    } else {
      // ✅ Si no es modo GLOBAL, asegurar que el disponible sea 0
      setPresupuestoGlobalDisponible(0);
      console.log('🔄 [DEBUG DISPONIBLE] Modo no-GLOBAL detectado - Disponible establecido en $0');
    }
  }, [asignaciones, modoPresupuesto, presupuestoGlobalTotal, obra._esTrabajoExtra]);

  // Función para obtener la fecha de asignación real basada en fecha probable inicio
  const obtenerFechaAsignacionReal = () => {
    // Usar fechaProbableInicio del presupuesto cargado (reactivo)
    if (presupuesto?.fechaProbableInicio) {
      console.log('📅 [OTROS COSTOS] obtenerFechaAsignacionReal - usando presupuesto.fechaProbableInicio:', presupuesto.fechaProbableInicio);
      return presupuesto.fechaProbableInicio;
    }
    // Fallback: intentar obtener del DOM si no está en presupuesto
    const inputFecha = document.querySelector('input[name="fechaProbableInicio"]');
    const fechaFallback = inputFecha?.value || new Date().toISOString().split('T')[0];
    console.log('⚠️ [OTROS COSTOS] obtenerFechaAsignacionReal - usando fallback:', fechaFallback);
    return fechaFallback;
  };

  const normalizarTexto = (value) => {
    return (value ?? '')
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  const extraerImporteItem = (item) => {
    const candidatos = [
      item?.importe,
      item?.subtotal,
      item?.total,
      item?.monto,
      item?.valor,
      item?.precioUnitario, // 🆕 Agregar precioUnitario para gastos globales
    ];
    for (const c of candidatos) {
      const n = Number(c);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return 0;
  };

  const obtenerRubroFinal = () => {
    if (nuevoGastoManual.categoria === '__OTRO__') {
      const custom = (nuevoGastoManual.categoriaCustom || '').trim();
      return custom;
    }
    return (nuevoGastoManual.categoria || 'General').trim() || 'General';
  };

  const rubrosParaSelect = useMemo(() => {
    const base = Array.isArray(rubrosPresupuesto) ? [...rubrosPresupuesto] : [];
    const tieneGeneral = base.some(r => normalizarTexto(r) === 'general');
    if (!tieneGeneral) base.unshift('General');
    return base;
  }, [rubrosPresupuesto]);

  const esItemPresupuestoGlobal = (item) => {
    if (!item) return false;
    if (item.esGlobal === true) return true;

    const unidad = normalizarTexto(item.unidad ?? item.unidadMedida);
    if (unidad === 'global') return true;

    const texto = normalizarTexto(item.descripcion ?? item.nombre ?? item.concepto);
    return (
      /presupuesto\s*global/.test(texto) ||
      /gastos?\s*generales?\s*global/.test(texto) ||
      /gastos?\s*grales/.test(texto)
    );
  };

  const separarGlobalYDetalle = (items, configHonorarios = null, configMayoresCostos = null) => {
    const arr = Array.isArray(items) ? items : [];
    const globalItems = arr.filter(esItemPresupuestoGlobal);
    const detalleItems = arr.filter((x) => !esItemPresupuestoGlobal(x));
    const globalItem = globalItems[0] || null;

    console.log('🔍 separarGlobalYDetalle - Items recibidos:', {
      totalItems: arr.length,
      globalItems: globalItems.length,
      detalleItems: detalleItems.length,
      tieneConfigHonorarios: !!configHonorarios,
      tieneConfigMayoresCostos: !!configMayoresCostos,
      globalItem: globalItem ? {
        id: globalItem.id,
        descripcion: globalItem.descripcion,
        importe: globalItem.importe,
        subtotal: globalItem.subtotal,
        total: globalItem.total,
        todasPropiedades: Object.keys(globalItem)
      } : null
    });

    let importeGlobal = 0;
    if (globalItem) {
      // ✅ CALCULAR IMPORTE GLOBAL INCLUYENDO HONORARIOS Y MAYORES COSTOS
      const baseGlobal = extraerImporteItem(globalItem);
      let honorarios = 0;
      let mayoresCostosBase = 0;
      let mayoresCostosHonorarios = 0;

      // Usar configuración pasada como parámetro o la del estado
      const configHon = configHonorarios || presupuesto?.honorarios;
      const configMC = configMayoresCostos || presupuesto?.mayoresCostos;

      console.log('🔍 Configuración para cálculo:', {
        tieneConfigHonorarios: !!configHon,
        honorariosOtrosCostos: configHon?.otrosCostos,
        tieneConfigMayoresCostos: !!configMC,
        mayoresCostosOtrosCostos: configMC?.otrosCostos,
        mayoresCostosHonorarios: configMC?.honorarios
      });

      // Calcular honorarios de otros costos
      if (configHon?.otrosCostos?.activo && configHon?.otrosCostos?.valor) {
        const valorHonorario = Number(configHon.otrosCostos.valor);
        if (configHon.otrosCostos.tipo === 'porcentaje') {
          honorarios = (baseGlobal * valorHonorario) / 100;
        }
      }

      // Calcular mayores costos sobre la base
      if (configMC?.otrosCostos?.activo && configMC?.otrosCostos?.valor) {
        const valorMayorCosto = Number(configMC.otrosCostos.valor);
        if (configMC.otrosCostos.tipo === 'porcentaje') {
          mayoresCostosBase = (baseGlobal * valorMayorCosto) / 100;
        }
      }

      // Calcular mayores costos sobre honorarios
      if (honorarios > 0 && configMC?.honorarios?.activo && configMC?.honorarios?.valor) {
        const valorMCHon = Number(configMC.honorarios.valor);
        if (configMC.honorarios.tipo === 'porcentaje') {
          mayoresCostosHonorarios = (honorarios * valorMCHon) / 100;
        }
      }

      importeGlobal = baseGlobal + honorarios + mayoresCostosBase + mayoresCostosHonorarios;

      console.log('💰 CÁLCULO IMPORTE GLOBAL GASTOS GENERALES:', {
        baseGlobal,
        honorarios,
        mayoresCostosBase,
        mayoresCostosHonorarios,
        importeGlobalFinal: importeGlobal,
        formatoAR: `$${importeGlobal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
      });
    }

    return {
      globalItem,
      importeGlobal,
      detalleItems,
      tieneGlobal: Boolean(globalItem),
    };
  };

  // Función para obtener gastos generales con stock (según backend)
  const obtenerGastosGeneralesConStock = async (presupuestoId, empresaId) => {
    if (!presupuestoId) {
      throw new Error('presupuestoId es requerido');
    }

    const response = await fetch(`/api/presupuestos-no-cliente/${presupuestoId}/gastos-generales`, {
      method: 'GET',
      headers: {
        'empresaId': empresaId.toString(),
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }

    return await response.json();
  };

  // Función para asignar otros costos a obra (funciona igual para obras normales y trabajos extra)
  const asignarOtroCostoAObra = async (obraId, empresaId, datos) => {
    const esManual = Boolean(datos.esManual);

    const payload = {
      obraId: parseInt(obraId),
      importeAsignado: parseFloat(datos.importeAsignado),
      semana: datos.semana ? Number(datos.semana) : null,
      fechaAsignacion: datos.fechaAsignacion || null,
      esGlobal: Boolean(datos.esGlobal),
      observaciones: datos.observaciones || null,
      origenFondos: datos.origenFondos || null // 🆕 Incluir origen de fondos en el payload
    };

    if (esManual) {
      // Gasto manual: sin IDs, con descripción y categoría
      payload.presupuestoOtroCostoId = null;
      payload.gastoGeneralId = null;
      payload.descripcion = datos.descripcion || datos.nombre;
      payload.categoria = datos.categoria || 'General';
    } else {
      // Gasto del presupuesto: con IDs
      payload.presupuestoOtroCostoId = parseInt(datos.gastoGeneralId);
      payload.gastoGeneralId = parseInt(datos.gastoGeneralId);
    }

    // Si es un recurso físico, agregar la cantidad
    if (datos.cantidadAsignada !== undefined && datos.cantidadAsignada !== null) {
      payload.cantidadAsignada = parseInt(datos.cantidadAsignada);
    }

    // VALIDACIÓN CRÍTICA: Nunca enviar importe 0
    if (!payload.importeAsignado || payload.importeAsignado <= 0) {
      throw new Error('El importe asignado debe ser mayor a cero');
    }

    console.log('📦 Payload enviado al backend:', payload);

    const endpoint = `/api/obras/${obraId}/otros-costos`;
    console.log('📡 POST endpoint:', endpoint);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'empresaId': empresaId.toString(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error ${response.status} del backend:`, errorText);
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    return await response.json();
  };

  const cargarPresupuestoObra = async () => {
    setLoadingPresupuesto(true);
    setError(null);
    try {
      console.log('🔍🔍🔍 [OTROS COSTOS] INICIANDO CARGA DE PRESUPUESTO 🔍🔍🔍');
      console.log('🔍 obra._esTrabajoExtra:', obra._esTrabajoExtra);
      console.log('🔍 obra.presupuestoNoCliente presente:', !!obra.presupuestoNoCliente);
      console.log('🔍 obra.id:', obra.id);

      let presupuestoActual = null;
      let presupuestoId = null; // ✅ Definir aquí para todos los casos

      // 🔥 SIEMPRE RECARGAR para tener datos frescos (evita mostrar presupuestos editados con valores viejos)
      if (obra._esTrabajoExtra) {
        console.log('✅ Trabajo Extra detectado - cargando datos del trabajo extra ID:', obra.id);
        console.log('⚠️ IMPORTANTE: Trabajo extra funciona como presupuesto-no-cliente independiente');

        // Cargar el trabajo extra completo (que incluye todos los datos del presupuesto)
        try {
          presupuestoActual = await api.trabajosExtra.getById(obra.id, empresaSeleccionada.id);

          // 🔑 PARA TRABAJOS EXTRA: El presupuestoId ES el ID del trabajo extra
          // NO necesita buscar presupuestos externos, ya tiene TODO dentro
          presupuestoId = presupuestoActual.id;

          console.log('🔑 [TRABAJO EXTRA] Usando presupuesto del trabajo extra:', {
            trabajoExtraId: presupuestoActual.id,
            presupuestoId: presupuestoId,
            tieneItemsCalculadora: !!presupuestoActual.itemsCalculadora,
            cantidadItems: presupuestoActual.itemsCalculadora?.length || 0
          });

          // 🚨🚨🚨 LOG CRÍTICO DEL PRESUPUESTO COMPLETO 🚨🚨🚨
          console.log('═══════════════════════════════════════');
          console.log('🔍 TRABAJO EXTRA CARGADO COMPLETO');
          console.log('═══════════════════════════════════════');
          console.log('ID:', presupuestoActual.id);
          console.log('Nombre:', presupuestoActual.nombreObra || presupuestoActual.nombre);
          console.log('Tiempo estimado:', presupuestoActual.tiempoEstimadoTerminacion, 'semanas');
          console.log('Items Calculadora:', presupuestoActual.itemsCalculadora?.length || 0);
          console.log('Otros Costos array:', presupuestoActual.otrosCostos?.length || 0);
          console.log('Otros Costos JSON:', presupuestoActual.otrosCostosJson ? 'presente' : 'ausente');
          console.log('🔍 TODAS LAS PROPIEDADES DEL TRABAJO EXTRA:', Object.keys(presupuestoActual).sort());
          console.log('🔍 OBJETO COMPLETO RAW DEL BACKEND:', JSON.stringify(presupuestoActual, null, 2));

          // 🔍 VERIFICAR ITEMS CALCULADORA CON GASTOS GENERALES
          if (presupuestoActual.itemsCalculadora && presupuestoActual.itemsCalculadora.length > 0) {
            console.log('═══════════════════════════════════════');
            console.log('📋 ITEMS CALCULADORA DETALLADOS');
            console.log('═══════════════════════════════════════');
            presupuestoActual.itemsCalculadora.forEach((item, idx) => {
              console.log(`\n${idx + 1}. ITEM: ${item.tipoProfesional}`);
              console.log(`   ├─ Total item: $${item.total?.toLocaleString('es-AR')}`);
              console.log(`   ├─ Subtotal gastos generales: $${item.subtotalGastosGenerales?.toLocaleString('es-AR')}`);

              if (item.gastosGenerales && item.gastosGenerales.length > 0) {
                console.log(`   ├─ Gastos generales (${item.gastosGenerales.length}):`);
                item.gastosGenerales.forEach((gasto, gIdx) => {
                  console.log(`   │  ${gIdx + 1}. ${gasto.descripcion}`);
                  console.log(`   │     ├─ cantidad: ${gasto.cantidad}`);
                  console.log(`   │     ├─ precioUnitario: $${gasto.precioUnitario?.toLocaleString('es-AR')}`);
                  console.log(`   │     ├─ subtotal: $${gasto.subtotal?.toLocaleString('es-AR')}`);
                  console.log(`   │     ├─ importe: $${gasto.importe?.toLocaleString('es-AR')}`);
                  console.log(`   │     └─ Cálculo: ${gasto.cantidad} × $${gasto.precioUnitario?.toLocaleString('es-AR')} = $${(gasto.cantidad * gasto.precioUnitario)?.toLocaleString('es-AR')}`);
                });
              } else {
                console.log(`   └─ Sin gastos generales`);
              }
            });
            console.log('═══════════════════════════════════════');
          }

          if (presupuestoActual.otrosCostos && presupuestoActual.otrosCostos.length > 0) {
            console.log('═══════════════════════════════════════');
            console.log('💰 OTROS COSTOS EN EL PRESUPUESTO');
            console.log('═══════════════════════════════════════');
            presupuestoActual.otrosCostos.forEach((gasto, idx) => {
              console.log(`${idx + 1}. ${gasto.descripcion}`);
              console.log(`   ├─ cantidad: ${gasto.cantidad}`);
              console.log(`   ├─ precioUnitario: $${gasto.precioUnitario?.toLocaleString('es-AR')}`);
              console.log(`   ├─ importe: $${gasto.importe?.toLocaleString('es-AR')}`);
              console.log(`   ├─ subtotal: $${gasto.subtotal?.toLocaleString('es-AR')}`);
              console.log(`   ├─ Cálculo: ${gasto.cantidad} × $${gasto.precioUnitario?.toLocaleString('es-AR')} = $${(gasto.cantidad * gasto.precioUnitario)?.toLocaleString('es-AR')}`);
              console.log(`   └─ Objeto completo:`, JSON.stringify(gasto, null, 2));
            });
            console.log('═══════════════════════════════════════');
          }

          console.log('✅ Trabajo extra cargado:', {
            id: presupuestoActual.id,
            nombre: presupuestoActual.nombreObra || presupuestoActual.nombre,
            items: presupuestoActual.itemsCalculadora?.length || 0,
            esTrabajoExtra: presupuestoActual.esTrabajoExtra
          });

          // 🔥 VALIDACIÓN FINAL: Garantizar que los itemsCalculadora SOLO pertenecen a este trabajo extra
          // Si hay presupuestoId en items, filtrar solo los del trabajo extra
          if (presupuestoActual.itemsCalculadora && Array.isArray(presupuestoActual.itemsCalculadora)) {
            const itemsOriginales = presupuestoActual.itemsCalculadora.length;
            presupuestoActual.itemsCalculadora = presupuestoActual.itemsCalculadora.filter(item => {
              // Estrategia 1: Si el item tiene presupuestoId, debe coincidir con el trabajo extra actual
              if (item.presupuestoId && item.presupuestoId !== presupuestoActual.id) {
                console.warn('❌ Eliminando item de otra obra (por presupuestoId):', {
                  itemPresupuestoId: item.presupuestoId,
                  trabajoExtraId: presupuestoActual.id,
                  item: item.tipoProfesional
                });
                return false; // Rechazar
              }

              // Estrategia 2: Si el item tiene obraId, NO debe ser diferente del trabajo extra
              // (un trabajo extra es independiente, no tiene obraId significativamente)
              if (item.obraId && item.obraId !== presupuestoActual.id && item.obraId !== presupuestoActual.obraId) {
                console.warn('❌ Eliminando item de otra obra (por obraId):', {
                  itemObraId: item.obraId,
                  trabajoExtraId: presupuestoActual.id,
                  presupuestoObraId: presupuestoActual.obraId,
                  item: item.tipoProfesional
                });
                return false; // Rechazar
              }

              return true; // Aceptar
            });
            const itemsFiltrados = presupuestoActual.itemsCalculadora.length;
            if (itemsOriginales !== itemsFiltrados) {
              console.warn(`⚠️ SE FILTRARON ITEMS: ${itemsOriginales} → ${itemsFiltrados}`);
              console.warn(`🚨 Trabajo Extra DEBE TENER DATOS SOLO DE SÍ MISMO, NO DE OBRA PRINCIPAL`);
            }
          }
        } catch (error) {
          console.error('❌ Error cargando trabajo extra:', error);
          throw new Error('No se pudo cargar el trabajo extra');
        }
      } else {
        // ✅ OBRA REGULAR: Buscar presupuesto vinculado a esta obra
        console.log('🔍 Buscando presupuesto con estado válido (APROBADO, EN_EJECUCION, SUSPENDIDA, CANCELADA, TERMINADO, FINALIZADO) para obra:', obra.id);

        // Cargar solo presupuestos tradicionales
        const dataTradicionales = await api.presupuestosNoCliente.getAll(empresaSeleccionada.id);

        console.log('📦 Presupuestos tradicionales obtenidos:', dataTradicionales?.length || 0);

        // El backend puede devolver el array directamente o dentro de content/datos
        const presupuestosTradicionales = Array.isArray(dataTradicionales) ? dataTradicionales : (dataTradicionales?.content || dataTradicionales?.datos || []);

        // Solo presupuestos tradicionales
        const presupuestos = presupuestosTradicionales;
        console.log('📦 Total presupuestos para esta obra:', presupuestos.length);

        // Estados válidos para obras vinculadas (incluye TERMINADO y FINALIZADO para tareas leves)
        const estadosValidos = ['APROBADO', 'EN_EJECUCION', 'SUSPENDIDA', 'CANCELADA', 'TERMINADO', 'FINALIZADO'];

        // Filtrar por obraId y estado válido
        console.log('🔍 Filtrando presupuestos por obraId:', obra.id);
        let presupuestosObra = (presupuestos || []).filter(p => {
          const coincideObra = (Number(p.obraId) === Number(obra.id) || Number(p.idObra) === Number(obra.id));
          const tieneEstado = estadosValidos.includes(p.estado);

          if (!coincideObra || !tieneEstado) {
            console.warn(`❌ Presupuesto ${p.id} - coincideObra: ${coincideObra} (obraId: ${p.obraId}, idObra: ${p.idObra}), tieneEstado: ${tieneEstado} (estado: ${p.estado})`);
          }

          return coincideObra && tieneEstado;
        });
        console.log('✅ Presupuestos válidos de obra', obra.id, ':', presupuestosObra.length);

        if (presupuestosObra.length === 0) {
          throw new Error('No se encontró un presupuesto con estado válido (APROBADO, EN_EJECUCION, SUSPENDIDA, CANCELADA, TERMINADO, FINALIZADO) para esta obra');
        }

        // Seleccionar el más reciente
        const presupuestoResumen = presupuestosObra.sort((a, b) => {
          if (a.numeroPresupuesto === b.numeroPresupuesto) {
            return (b.version || 0) - (a.version || 0);
          }
          return b.id - a.id;
        })[0];
        console.log('✅ Presupuesto seleccionado:', presupuestoResumen.id);

        // IMPORTANTE: Siempre buscar la versión más reciente, incluso si tenemos una en configuracionObra
        if (presupuestoResumen && configuracionObra?.presupuestoSeleccionado &&
            presupuestoResumen.version !== configuracionObra.presupuestoSeleccionado.version) {
          console.log('🔄 Detectada nueva versión del presupuesto:', {
            actual: presupuestoResumen.version,
            configuracion: configuracionObra.presupuestoSeleccionado.version
          });
        }

        const presupuestoId = presupuestoResumen.id;
        const esTrabajoExtra = presupuestoResumen.esTrabajoExtra || presupuestoResumen.tipo === 'TRABAJO_EXTRA';

        console.log('✅ Presupuesto seleccionado:', {
          id: presupuestoId,
          version: presupuestoResumen.version,
          esTrabajoExtra: esTrabajoExtra,
          nombre: presupuestoResumen.nombreObra || presupuestoResumen.nombre
        });

        // 🔥 OBTENER EL PRESUPUESTO COMPLETO según su tipo
        if (esTrabajoExtra) {
          console.log('📦 Cargando trabajo extra completo ID:', presupuestoId);
          presupuestoActual = await api.trabajosExtra.getById(presupuestoId, empresaSeleccionada.id);
        } else {
          console.log('📦 Cargando presupuesto tradicional completo ID:', presupuestoId);
          presupuestoActual = await api.presupuestosNoCliente.getById(presupuestoId, empresaSeleccionada.id);
        }
      }


      if (!presupuestoActual) {
        throw new Error('No se pudieron obtener los detalles del presupuesto ' + presupuestoId);
      }

      console.log('✅ Presupuesto completo obtenido:', presupuestoActual.id, 'con', presupuestoActual.itemsCalculadora?.length || 0, 'items en calculadora');
      console.log('📅 fechaProbableInicio en presupuestoActual:', presupuestoActual.fechaProbableInicio);

      // 🆕 DETECTAR MODO DEL PRESUPUESTO (GLOBAL vs DETALLE)
      // ✅ PASO 1: CALCULAR PRESUPUESTO GLOBAL SUMANDO TODOS LOS GASTOS GENERALES DE TODOS LOS RUBROS
      console.log('═══════════════════════════════════════');
      console.log('💰 CALCULANDO PRESUPUESTO GLOBAL - Suma de todos los gastos generales');
      console.log('═══════════════════════════════════════');

      let presupuestoGlobal = 0;
      let totalGastosEncontrados = 0;

      if (presupuestoActual.itemsCalculadora && Array.isArray(presupuestoActual.itemsCalculadora)) {
        presupuestoActual.itemsCalculadora.forEach((rubro) => {
          // 🔥 VALIDACIÓN CRÍTICA: Para trabajos extra, NO filtrar por presupuestoId
          // Los gastos están almacenados directamente en el trabajo extra
          if (!obra._esTrabajoExtra && rubro.presupuestoId && rubro.presupuestoId !== presupuestoActual.id) {
            console.warn('⏭️ Omitiendo rubro de otro presupuesto (obra principal) en cálculo de global:', {
              rubroPresupuestoId: rubro.presupuestoId,
              presupuestoActualId: presupuestoActual.id,
              rubroTipo: rubro.tipoProfesional
            });
            return; // Saltar este rubro SOLO para obras normales
          }

          console.log(`\nRUBRO: ${rubro.tipoProfesional} ${obra._esTrabajoExtra ? '(TRABAJO EXTRA)' : ''}`);

          if (rubro.gastosGenerales && Array.isArray(rubro.gastosGenerales)) {
            rubro.gastosGenerales.forEach((gasto) => {
              const importe = Number(gasto.importe || gasto.subtotal || 0);
              presupuestoGlobal += importe;
              totalGastosEncontrados++;
              console.log(`  ├─ ${gasto.descripcion}: $${importe.toLocaleString('es-AR')}`);
            });
          }
        });
      }

      console.log(`\n✅ TOTAL CALCULADO: $${presupuestoGlobal.toLocaleString('es-AR')} (${totalGastosEncontrados} items)`);

      // 🎯 Si no hay gastos en itemsCalculadora, usar importeGastosGeneralesObra de la obra
      if (presupuestoGlobal === 0 && totalGastosEncontrados === 0) {
        if (obra.importeGastosGeneralesObra && Number(obra.importeGastosGeneralesObra) > 0) {
          presupuestoGlobal = Number(obra.importeGastosGeneralesObra);
          console.log(`✅ Usando importeGastosGeneralesObra de la obra: $${presupuestoGlobal.toLocaleString('es-AR')}`);
        }
      }

      // 🔍 DEBUG ADICIONAL para trabajos extra
      if (obra._esTrabajoExtra) {
        console.log('🔍 [TRABAJO EXTRA] Verificación de cálculo de presupuesto global:', {
          trabajoExtraId: presupuestoActual.id,
          totalItems: presupuestoActual.itemsCalculadora?.length || 0,
          totalGastos: totalGastosEncontrados,
          presupuestoGlobalCalculado: presupuestoGlobal,
          itemsConGastos: presupuestoActual.itemsCalculadora?.filter(i => i.gastosGenerales?.length > 0).length || 0
        });
      }
      console.log('═══════════════════════════════════════\n');

      let gastosDisponibles = [];
      let modoDetectado = null;
      let fuenteDeteccion = null;

      const rubrosMap = new Map();
      const obtenerTextoDeCampo = (val) => {
        if (val === null || val === undefined) return '';
        if (typeof val === 'string') return val.trim();
        if (typeof val === 'number') return Number.isFinite(val) ? String(val) : '';
        if (typeof val === 'object') {
          const candidatos = [val.nombre, val.descripcion, val.label, val.value, val.titulo];
          for (const c of candidatos) {
            if (typeof c === 'string' && c.trim()) return c.trim();
          }
        }
        return '';
      };

      const extraerRubroDeItem = (it) => {
        if (!it) return '';
        if (typeof it === 'string') return it.trim();

        const directos = [
          it.categoria,
          it.rubro,
          it.rubroNombre,
          it.nombreRubro,
          it.categoriaNombre,
          it.nombreCategoria,
          it.tipoRubro,
          it.tipo,
        ];

        for (const d of directos) {
          const t = obtenerTextoDeCampo(d);
          if (t) return t;
        }

        const anidados = [
          it.categoria?.nombre,
          it.categoria?.descripcion,
          it.rubro?.nombre,
          it.rubro?.descripcion,
        ];
        for (const a of anidados) {
          const t = obtenerTextoDeCampo(a);
          if (t) return t;
        }

        return '';
      };

      const obtenerCategoriaGasto = (g) => {
        const t = extraerRubroDeItem(g);
        return t || 'General';
      };

      const agregarRubro = (r) => {
        const val = (r ?? '').toString().trim();
        if (!val) return;
        const key = normalizarTexto(val);
        if (!key || key === 'sin categoria') return;
        if (!rubrosMap.has(key)) rubrosMap.set(key, val);
      };
      const extraerRubrosDeArray = (arr) => {
        (Array.isArray(arr) ? arr : []).forEach(it => agregarRubro(extraerRubroDeItem(it)));
      };

      const parsearArrayDesdeJson = (val) => {
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') {
          try {
            const parsed = JSON.parse(val || '[]');
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        }
        return [];
      };

      // ✅ EXTRAER CONFIGURACIÓN DE HONORARIOS Y MAYORES COSTOS ANTES DE PROCESAR
      const fechaRaw = presupuestoActual.fechaProbableInicio;
      const fechaFormateada = fechaRaw ? (typeof fechaRaw === 'string' && fechaRaw.includes('T') ? fechaRaw.split('T')[0] : fechaRaw) : null;

      console.log('🔍 [DEBUG RAW] presupuestoActual campos:', {
        id: presupuestoActual.id,
        tieneHonorarios: !!presupuestoActual.honorarios,
        tieneMayoresCostos: !!presupuestoActual.mayoresCostos,
        honorariosOtrosCostosActivo: presupuestoActual.honorariosOtrosCostosActivo,
        honorariosOtrosCostosValor: presupuestoActual.honorariosOtrosCostosValor,
        mayoresCostosOtrosCostosActivo: presupuestoActual.mayoresCostosOtrosCostosActivo,
        mayoresCostosOtrosCostosValor: presupuestoActual.mayoresCostosOtrosCostosValor,
        mayoresCostosHonorariosActivo: presupuestoActual.mayoresCostosHonorariosActivo,
        mayoresCostosHonorariosValor: presupuestoActual.mayoresCostosHonorariosValor,
        todasLasPropiedades: Object.keys(presupuestoActual)
      });

      // Convertir estructura plana del backend a estructura anidada
      const honorariosRaw = presupuestoActual.honorarios || {};
      const honorarios = {
        otrosCostos: {
          activo: honorariosRaw.otrosCostosActivo ?? presupuestoActual.honorariosOtrosCostosActivo ?? false,
          tipo: honorariosRaw.otrosCostosTipo ?? presupuestoActual.honorariosOtrosCostosTipo ?? 'porcentaje',
          valor: Number(honorariosRaw.otrosCostosValor ?? presupuestoActual.honorariosOtrosCostosValor ?? 0)
        },
        jornales: {
          activo: honorariosRaw.jornalesActivo ?? presupuestoActual.honorariosJornalesActivo ?? false,
          tipo: honorariosRaw.jornalesTipo ?? presupuestoActual.honorariosJornalesTipo ?? 'porcentaje',
          valor: Number(honorariosRaw.jornalesValor ?? presupuestoActual.honorariosJornalesValor ?? 0)
        },
        materiales: {
          activo: honorariosRaw.materialesActivo ?? presupuestoActual.honorariosMaterialesActivo ?? false,
          tipo: honorariosRaw.materialesTipo ?? presupuestoActual.honorariosMaterialesTipo ?? 'porcentaje',
          valor: Number(honorariosRaw.materialesValor ?? presupuestoActual.honorariosMaterialesValor ?? 0)
        },
        profesionales: {
          activo: honorariosRaw.profesionalesActivo ?? presupuestoActual.honorariosProfesionalesActivo ?? false,
          tipo: honorariosRaw.profesionalesTipo ?? presupuestoActual.honorariosProfesionalesTipo ?? 'porcentaje',
          valor: Number(honorariosRaw.profesionalesValor ?? presupuestoActual.honorariosProfesionalesValor ?? 0)
        }
      };

      const mayoresCostosRaw = presupuestoActual.mayoresCostos || {};
      const mayoresCostos = {
        otrosCostos: {
          activo: mayoresCostosRaw.otrosCostosActivo ?? presupuestoActual.mayoresCostosOtrosCostosActivo ?? false,
          tipo: mayoresCostosRaw.otrosCostosTipo ?? presupuestoActual.mayoresCostosOtrosCostosTipo ?? 'porcentaje',
          valor: Number(mayoresCostosRaw.otrosCostosValor ?? presupuestoActual.mayoresCostosOtrosCostosValor ?? 0)
        },
        jornales: {
          activo: mayoresCostosRaw.jornalesActivo ?? presupuestoActual.mayoresCostosJornalesActivo ?? false,
          tipo: mayoresCostosRaw.jornalesTipo ?? presupuestoActual.mayoresCostosJornalesTipo ?? 'porcentaje',
          valor: Number(mayoresCostosRaw.jornalesValor ?? presupuestoActual.mayoresCostosJornalesValor ?? 0)
        },
        materiales: {
          activo: mayoresCostosRaw.materialesActivo ?? presupuestoActual.mayoresCostosMaterialesActivo ?? false,
          tipo: mayoresCostosRaw.materialesTipo ?? presupuestoActual.mayoresCostosMaterialesTipo ?? 'porcentaje',
          valor: Number(mayoresCostosRaw.materialesValor ?? presupuestoActual.mayoresCostosMaterialesValor ?? 0)
        },
        profesionales: {
          activo: mayoresCostosRaw.profesionalesActivo ?? presupuestoActual.mayoresCostosProfesionalesActivo ?? false,
          tipo: mayoresCostosRaw.profesionalesTipo ?? presupuestoActual.mayoresCostosProfesionalesTipo ?? 'porcentaje',
          valor: Number(mayoresCostosRaw.profesionalesValor ?? presupuestoActual.mayoresCostosProfesionalesValor ?? 0)
        },
        honorarios: {
          activo: mayoresCostosRaw.honorariosActivo ?? presupuestoActual.mayoresCostosHonorariosActivo ?? false,
          tipo: mayoresCostosRaw.honorariosTipo ?? presupuestoActual.mayoresCostosHonorariosTipo ?? 'porcentaje',
          valor: Number(mayoresCostosRaw.honorariosValor ?? presupuestoActual.mayoresCostosHonorariosValor ?? 0)
        }
      };

      // ✅ SETEAR PRESUPUESTO EN ESTADO ANTES DE PROCESAR (para que separarGlobalYDetalle lo use)
      const presupuestoParaEstado = {
        id: presupuestoId,
        nombre: presupuestoActual.nombreObra || presupuestoActual.nombre || 'Presupuesto',
        version: presupuestoActual.version || 1,
        fechaProbableInicio: fechaFormateada,
        tiempoEstimadoTerminacion: presupuestoActual.tiempoEstimadoTerminacion,
        honorarios,
        mayoresCostos,
        itemsCalculadora: presupuestoActual.itemsCalculadora || [] // ✅ INCLUIR itemsCalculadora para extraer gastos en trabajos extra
      };

      setPresupuesto(presupuestoParaEstado);

      console.log('💰 [DEBUG] Configuración de honorarios/mayores costos MAPEADA:', {
        honorariosOtrosCostos: honorarios.otrosCostos,
        mayoresCostosOtrosCostos: mayoresCostos.otrosCostos,
        mayoresCostosHonorarios: mayoresCostos.honorarios
      });

      // 🆕 EXTRAER RUBROS DE TODAS LAS FUENTES POSIBLES DEL PRESUPUESTO
      if (presupuestoActual.itemsCalculadora && Array.isArray(presupuestoActual.itemsCalculadora)) {
        presupuestoActual.itemsCalculadora.forEach(it => {
          // 🔥 VALIDACIÓN: Si es trabajo extra, SOLO items de este trabajo extra
          if (obra._esTrabajoExtra && it.presupuestoId && it.presupuestoId !== presupuestoActual.id) {
            console.warn('⏭️ Omitiendo item de otra obra en extracción de rubros');
            return; // Saltar
          }

          // Extraer rubro usando la lógica robusta
          agregarRubro(extraerRubroDeItem(it));

          // También probar campos específicos que suelen ser rubros
          agregarRubro(obtenerTextoDeCampo(it.tipoProfesional));
          agregarRubro(obtenerTextoDeCampo(it.nombreItem));
          agregarRubro(obtenerTextoDeCampo(it.descripcion));

          // También extraer de sus gastos generales internos si existen
          if (it.gastosGenerales && Array.isArray(it.gastosGenerales)) {
            extraerRubrosDeArray(it.gastosGenerales);
          }
        });
      }

      // Probar también en "detalles" (formato alternativo)
      if (presupuestoActual.detalles && Array.isArray(presupuestoActual.detalles)) {
        presupuestoActual.detalles.forEach(it => {
          agregarRubro(extraerRubroDeItem(it));
          agregarRubro(obtenerTextoDeCampo(it.tipoProfesional));
          agregarRubro(obtenerTextoDeCampo(it.nombreItem));
          agregarRubro(obtenerTextoDeCampo(it.descripcion));
        });
      }

      // 1. Verificar si tiene otrosCostos (formato simple)
      const otrosCostosDesdeJson = parsearArrayDesdeJson(presupuestoActual.otrosCostosJson);
      const otrosCostosDesdeProp = Array.isArray(presupuestoActual.otrosCostos) ? presupuestoActual.otrosCostos : [];
      const otrosCostosCandidatos = (otrosCostosDesdeProp.length > 0) ? otrosCostosDesdeProp : otrosCostosDesdeJson;

      // 🔍 LOG: Estructura de otrosCostos
      console.log('🔍🔍🔍 [DEBUG GASTOS GLOBALES] Analizando otrosCostos:', {
        tieneProp: otrosCostosDesdeProp.length > 0,
        tieneJson: otrosCostosDesdeJson.length > 0,
        candidatosTotal: otrosCostosCandidatos.length,
        primerItem: otrosCostosCandidatos[0],
        estructuraCompleta: otrosCostosCandidatos
      });

      // 🚨🚨🚨 LOG CRÍTICO: ANÁLISIS DE IMPORTES 🚨🚨🚨
      if (otrosCostosCandidatos.length > 0) {
        console.log('═══════════════════════════════════════');
        console.log('🔍 IMPORTES RECIBIDOS DEL PRESUPUESTO');
        console.log('═══════════════════════════════════════');
        otrosCostosCandidatos.forEach((gasto, idx) => {
          console.log(`Item ${idx + 1}: ${gasto.descripcion}`);
          console.log(`  ├─ importe: $${gasto.importe?.toLocaleString('es-AR')}`);
          console.log(`  ├─ subtotal: $${gasto.subtotal?.toLocaleString('es-AR')}`);
          console.log(`  ├─ cantidad: ${gasto.cantidad}`);
          console.log(`  ├─ precioUnitario: $${gasto.precioUnitario?.toLocaleString('es-AR')}`);
          console.log(`  ├─ Todas las propiedades:`, Object.keys(gasto));
          console.log(`  └─ Objeto completo:`, gasto);
        });
        console.log('═══════════════════════════════════════');
      }

      if (otrosCostosCandidatos.length > 0) {
        extraerRubrosDeArray(otrosCostosCandidatos);
        fuenteDeteccion = (otrosCostosDesdeProp.length > 0)
          ? 'presupuestoActual.otrosCostos'
          : 'presupuestoActual.otrosCostosJson';

        const { tieneGlobal, importeGlobal, detalleItems } = separarGlobalYDetalle(otrosCostosCandidatos, honorarios, mayoresCostos);

        console.log('🔍 [DEBUG GASTOS GLOBALES] Resultado separarGlobalYDetalle:', {
          tieneGlobal,
          importeGlobal,
          detalleItemsCount: detalleItems.length
        });

        if (tieneGlobal) {
          presupuestoGlobal = presupuestoGlobal || importeGlobal;
          console.log('💰 [DEBUG GASTOS GLOBALES] presupuestoGlobal asignado:', presupuestoGlobal);
        }

        if (tieneGlobal && detalleItems.length === 0) {
          modoDetectado = 'GLOBAL';
          gastosDisponibles = [];
        } else if (tieneGlobal && detalleItems.length > 0) {
          modoDetectado = 'MIXTO';
          gastosDisponibles = detalleItems.map(gasto => ({
            id: gasto.id,
            nombre: gasto.descripcion,
            descripcion: gasto.descripcion,
            categoria: obtenerCategoriaGasto(gasto),
            cantidadDisponible: gasto.cantidad ?? null,
            precioUnitario: gasto.precioUnitario || (gasto.subtotal / gasto.cantidad) || gasto.importe,
            importe: gasto.subtotal || gasto.importe,
            esDelStock: gasto.cantidad !== null && gasto.cantidad !== undefined
          }));
        } else {
          modoDetectado = 'DETALLE';
          gastosDisponibles = otrosCostosCandidatos.map(gasto => {
            const importeFinal = gasto.subtotal || gasto.importe;
            console.log('═══════════════════════════════════════');
            console.log(`🔍 MAPEANDO GASTO DISPONIBLE: ${gasto.descripcion}`);
            console.log('═══════════════════════════════════════');
            console.log('📥 Datos RAW del backend:');
            console.log('   ├─ gasto.importe:', gasto.importe);
            console.log('   ├─ gasto.subtotal:', gasto.subtotal);
            console.log('   ├─ gasto.precioUnitario:', gasto.precioUnitario);
            console.log('   ├─ gasto.cantidad:', gasto.cantidad);
            console.log('   └─ gasto objeto completo:', gasto);
            console.log('📤 Valores calculados para UI:');
            console.log('   ├─ importeFinal (subtotal || importe):', importeFinal);
            console.log('   ├─ precioUnitario calculado:', gasto.precioUnitario || (gasto.subtotal / gasto.cantidad) || gasto.importe);
            console.log('   └─ Cálculo manual: cantidad × precioUnitario =', gasto.cantidad, '×', gasto.precioUnitario, '=', (gasto.cantidad * gasto.precioUnitario));
            console.log('═══════════════════════════════════════');

            return {
              id: gasto.id,
              nombre: gasto.descripcion,
              descripcion: gasto.descripcion,
              categoria: obtenerCategoriaGasto(gasto),
              cantidadDisponible: gasto.cantidad ?? null,
              precioUnitario: gasto.precioUnitario || (gasto.subtotal / gasto.cantidad) || gasto.importe,
              importe: importeFinal,
              esDelStock: gasto.cantidad !== null && gasto.cantidad !== undefined
            };
          });
        }
      }

      // 2. Verificar itemsCalculadora.gastosGenerales (formato anidado)
      // ✅ Solo buscar más gastos si NO es modo GLOBAL
      if (!modoDetectado && presupuestoActual.itemsCalculadora && Array.isArray(presupuestoActual.itemsCalculadora)) {
        const todosGastos = [];
        presupuestoActual.itemsCalculadora.forEach(item => {
          // 🔥 VALIDACIÓN CRÍTICA: Si es trabajo extra, validar que el item pertenece a ESTE trabajo extra
          // NO a la obra principal vinculada
          if (obra._esTrabajoExtra && item.presupuestoId && item.presupuestoId !== presupuestoActual.id) {
            console.warn('⚠️ Ignorando item de otro presupuesto (obra principal):', {
              itemPresupuestoId: item.presupuestoId,
              trabajoExtraId: presupuestoActual.id,
              itemDescripcion: item.tipoProfesional
            });
            return; // Saltar este item
          }

          if (item.gastosGenerales && Array.isArray(item.gastosGenerales)) {
            extraerRubrosDeArray(item.gastosGenerales);
            todosGastos.push(...item.gastosGenerales);
          }
        });

        // 🔍 LOG: Gastos encontrados en itemsCalculadora
        console.log('🔍🔍🔍 [DEBUG GASTOS GLOBALES] Gastos en itemsCalculadora.gastosGenerales:', {
          totalGastos: todosGastos.length,
          primerGasto: todosGastos[0],
          estructuraCompleta: todosGastos
        });

        if (todosGastos.length > 0) {
          fuenteDeteccion = 'presupuestoActual.itemsCalculadora.gastosGenerales';
          const { tieneGlobal, importeGlobal, detalleItems } = separarGlobalYDetalle(todosGastos, honorarios, mayoresCostos);

          console.log('🔍 [DEBUG GASTOS GLOBALES] Resultado separarGlobalYDetalle (itemsCalculadora):', {
            tieneGlobal,
            importeGlobal,
            detalleItemsCount: detalleItems.length
          });

          if (tieneGlobal) {
            presupuestoGlobal = presupuestoGlobal || importeGlobal;
            console.log('💰 [DEBUG GASTOS GLOBALES] presupuestoGlobal asignado (itemsCalculadora):', presupuestoGlobal);
          }

          if (tieneGlobal && detalleItems.length === 0) {
            modoDetectado = 'GLOBAL';
            gastosDisponibles = [];
          } else if (tieneGlobal && detalleItems.length > 0) {
            modoDetectado = 'MIXTO';
            gastosDisponibles = detalleItems.map(gasto => ({
              id: gasto.id,
              nombre: gasto.descripcion,
              descripcion: gasto.descripcion,
              categoria: obtenerCategoriaGasto(gasto),
              cantidadDisponible: gasto.cantidad,
              unidadMedida: '',
              precioUnitario: gasto.precioUnitario,
              importe: gasto.subtotal,
              esDelStock: true
            }));
          } else {
            modoDetectado = 'DETALLE';
            gastosDisponibles = todosGastos.map(gasto => ({
              id: gasto.id,
              nombre: gasto.descripcion,
              descripcion: gasto.descripcion,
              categoria: obtenerCategoriaGasto(gasto),
              cantidadDisponible: gasto.cantidad,
              unidadMedida: '',
              precioUnitario: gasto.precioUnitario,
              importe: gasto.subtotal,
              esDelStock: true
            }));
          }
        }
      }

      // 3. Intentar endpoint del backend como respaldo
      // ✅ Solo buscar en backend si NO detectó ningún modo aún
      // 🔥 IMPORTANTE: Para trabajos extra, NO llamar a endpoints de presupuestos-no-cliente (no existen)
      // ✅ VALIDACIÓN: Solo si presupuestoId es válido (no null, no undefined)
      if (!modoDetectado && !obra._esTrabajoExtra && presupuestoId) {
        try {
          console.log('📡 Intentando endpoint de gastos generales (backend):', presupuestoId);

          const gastosGeneralesData = await obtenerGastosGeneralesConStock(presupuestoId, empresaSeleccionada.id);
          console.log('📦 Gastos generales obtenidos del backend:', gastosGeneralesData);

          extraerRubrosDeArray(gastosGeneralesData);

          // 🔍 LOG: Ver estructura completa del primer gasto
          if (gastosGeneralesData && gastosGeneralesData.length > 0) {
            console.log('🔍 ESTRUCTURA del primer gasto:', {
              objetoCompleto: gastosGeneralesData[0],
              importe: gastosGeneralesData[0].importe,
              todasLasPropiedades: Object.keys(gastosGeneralesData[0])
            });

            // 🚨 LOG EXHAUSTIVO PARA DETECTAR DIVISION POR SEMANAS 🚨
            console.log('═══════════════════════════════════════');
            console.log('   🔍 ANÁLISIS DE IMPORTE RECIBIDO');
            console.log('═══════════════════════════════════════');
            gastosGeneralesData.forEach((gasto, index) => {
              console.log(`Item ${index + 1}:`);
              console.log(`  - Descripción: ${gasto.descripcion}`);
              console.log(`  - Importe en el objeto: $${gasto.importe?.toLocaleString('es-AR')}`);
              console.log(`  - Subtotal (si existe): $${gasto.subtotal?.toLocaleString('es-AR')}`);
              console.log(`  - Cantidad (si existe): ${gasto.cantidad}`);
              console.log(`  - Importe original (si existe): $${gasto.importeOriginal?.toLocaleString('es-AR')}`);
              console.log(`  - Importe total (si existe): $${gasto.importeTotal?.toLocaleString('es-AR')}`);
              console.log(`  - Semanas (si existe): ${gasto.semanas || gasto.cantidadSemanas}`);
              console.log(`  - Props del objeto:`, Object.keys(gasto));
            });
            console.log('═══════════════════════════════════════');
          }

          fuenteDeteccion = 'endpoint /gastos-generales';
          const { tieneGlobal, importeGlobal, detalleItems } = separarGlobalYDetalle(gastosGeneralesData || [], honorarios, mayoresCostos);
          if (tieneGlobal) {
            presupuestoGlobal = presupuestoGlobal || importeGlobal;
          }

          if (tieneGlobal && detalleItems.length === 0) {
            modoDetectado = 'GLOBAL';
            gastosDisponibles = [];
          } else if (tieneGlobal && detalleItems.length > 0) {
            modoDetectado = 'MIXTO';
            gastosDisponibles = detalleItems.map(gasto => ({
              id: gasto.id,
              nombre: gasto.descripcion,
              descripcion: gasto.descripcion,
              categoria: obtenerCategoriaGasto(gasto),
              cantidadDisponible: 3,
              unidadMedida: '',
              importe: gasto.importe,
              esDelStock: true
            }));
          } else {
            gastosDisponibles = (gastosGeneralesData || []).map(gasto => ({
              id: gasto.id,
              nombre: gasto.descripcion,
              descripcion: gasto.descripcion,
              categoria: obtenerCategoriaGasto(gasto),
              cantidadDisponible: 3,
              unidadMedida: '',
              importe: gasto.importe,
              esDelStock: true
            }));
            modoDetectado = gastosDisponibles.length > 0 ? 'DETALLE' : null;
          }

        } catch (stockError) {
          console.log('⚠️ Endpoint gastos-generales no disponible, usando otros-costos como respaldo:', stockError.message);

          // Respaldo: usar el endpoint original de otros-costos
          try {
            const otrosCostosUrl = `/api/presupuestos-no-cliente/${presupuestoId}/otros-costos`;
            console.log('📡 Llamando a endpoint de respaldo:', otrosCostosUrl);

            const otrosCostosResponse = await fetch(otrosCostosUrl, {
              headers: {
                'empresaId': empresaSeleccionada.id.toString()
              }
            });

            if (otrosCostosResponse.ok) {
              const otrosCostosData = await otrosCostosResponse.json();
              console.log('📋 Otros costos del presupuesto (respaldo):', otrosCostosData);

              extraerRubrosDeArray(otrosCostosData);

              fuenteDeteccion = 'endpoint /otros-costos (respaldo)';
              const { tieneGlobal, importeGlobal, detalleItems } = separarGlobalYDetalle(otrosCostosData || [], honorarios, mayoresCostos);
              if (tieneGlobal) {
                presupuestoGlobal = presupuestoGlobal || importeGlobal;
              }

              if (tieneGlobal && detalleItems.length === 0) {
                modoDetectado = 'GLOBAL';
                gastosDisponibles = [];
                console.log('🌍 GLOBAL detectado en endpoint de respaldo (solo item global)');
              } else {
                // Convertir formato de otros costos al formato esperado
                const base = tieneGlobal ? detalleItems : (otrosCostosData || []);
                if (tieneGlobal && detalleItems.length > 0) {
                  modoDetectado = 'MIXTO';
                }

                gastosDisponibles = base.map(costo => {
                // Detectar si es un recurso físico basándose en el nombre/descripción
                const esRecursoFisico = /volquete|contenedor|andamio|herramienta|equipo|maquina|vehiculo|camion/i.test(costo.descripcion || '');

                return {
                  id: costo.id,
                  nombre: costo.descripcion,
                  descripcion: costo.descripcion,
                  categoria: obtenerCategoriaGasto(costo),
                  cantidadDisponible: esRecursoFisico ? 3 : null, // Si es recurso físico, asignar cantidad predeterminada
                  importe: costo.importe,
                  esDelStock: esRecursoFisico
                };
                });

                if (!modoDetectado) {
                  modoDetectado = gastosDisponibles.length > 0 ? 'DETALLE' : null;
                }
                console.log('✅ Otros costos convertidos:', gastosDisponibles.length);
              }
            } else {
              const errorText = await otrosCostosResponse.text();
              throw new Error(`Error ${otrosCostosResponse.status}: ${errorText}`);
            }
          } catch (respaldoError) {
            console.error('❌ Error en endpoint de respaldo:', respaldoError);
            // No lanzar error, simplemente no hay gastos disponibles
          }
        }
      }

      // 4. Establecer modo final y disponibles
      const modoFinal = modoDetectado || 'GLOBAL';
      setModoPresupuesto(modoFinal);

      setDebugDeteccionPresupuesto({
        modoFinal,
        fuenteDeteccion,
        presupuestoGlobal,
        itemsDetalle: gastosDisponibles.length,
        rubrosDetectados: rubrosMap.size,
        rubrosEjemplo: Array.from(rubrosMap.values()).slice(0, 8),
      });

      // ✅ En MODO GLOBAL, asegurar lista vacía; en DETALLE, usar los gastos encontrados
      if (modoFinal === 'GLOBAL') {
        setOtrosCostosDisponibles([]);
        console.log('🌍 MODO GLOBAL - Lista de gastos disponibles: VACÍA (crear manual)');
        console.log('═══════════════════════════════════════');
        console.log('📊 RESUMEN FINAL - MODO GLOBAL');
        console.log('═══════════════════════════════════════');
        console.log('Presupuesto Global:', presupuestoGlobal);
        console.log('Usuario creará gastos manualmente');
        console.log('═══════════════════════════════════════');
      } else {
        console.log('═══════════════════════════════════════');
        console.log('🚨🚨🚨 GASTOS DISPONIBLES FINALES 🚨🚨🚨');
        console.log('═══════════════════════════════════════');
        console.log('Modo detectado:', modoFinal);
        console.log('Fuente de datos:', fuenteDeteccion);
        console.log('Total de gastos disponibles:', gastosDisponibles.length);
        console.log('\n📋 DETALLE DE CADA GASTO:');
        gastosDisponibles.forEach((g, idx) => {
          console.log(`\n${idx + 1}. ${g.nombre || g.descripcion}`);
          console.log('   ├─ ID:', g.id);
          console.log('   ├─ Importe:', g.importe);
          console.log('   ├─ Importe formateado: $' + g.importe?.toLocaleString('es-AR'));
          console.log('   ├─ Precio unitario:', g.precioUnitario);
          console.log('   ├─ Cantidad disponible:', g.cantidadDisponible);
          console.log('   ├─ Es del stock:', g.esDelStock);
          console.log('   └─ Categoría:', g.categoria);
        });
        console.log('\n═══════════════════════════════════════');
        console.log('🎯 ESTOS SON LOS VALORES QUE VERÁ EL USUARIO EN LA UI');
        console.log('═══════════════════════════════════════\n');

        setOtrosCostosDisponibles(gastosDisponibles);
        console.log('✅ Estado actualizado - Gastos disponibles:', gastosDisponibles.length);
      }

      setPresupuestoGlobalTotal(presupuestoGlobal);
      // ✅ NO establecer disponible aquí - se calculará correctamente en useEffect después de cargar asignaciones

      // Rubros sugeridos desde el presupuesto vinculado
      setRubrosPresupuesto(Array.from(rubrosMap.values()).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })));

      console.log(`🎯 MODO FINAL DETECTADO: ${modoDetectado || 'GLOBAL'}`);
      if (modoDetectado === 'GLOBAL') {
        console.log(`💰 Presupuesto Global Total: $${presupuestoGlobal.toLocaleString('es-AR')}`);
      } else {
        console.log(`📋 Gastos Detallados: ${gastosDisponibles.length} items`);
      }

      console.log('✅ Presupuesto guardado en estado con configuración de honorarios/mayores costos');
      console.log('🏁🏁🏁 FIN CARGA DE PRESUPUESTO Y RUBROS 🏁🏁🏁');

      // ✅ Retornar presupuesto cargado para uso directo (evita problema de setState asíncrono)
      return presupuestoActual;
    } catch (error) {
      console.error('❌ Error cargando presupuesto:', error);
      setError(error.message);
      return null;
    } finally {
      setLoadingPresupuesto(false);
    }
  };

  // 🆕 Función auxiliar para extraer asignaciones desde trabajo extra
  const extraerAsignacionesDesdeTrabajoExtra = (trabajoExtra) => {
    console.log('� [EXTRACCION GASTOS] Iniciando extracción desde trabajo extra...', {
      id: trabajoExtra?.id,
      nombre: trabajoExtra?.nombre,
      tieneItemsCalculadora: !!trabajoExtra?.itemsCalculadora,
      cantidadItems: trabajoExtra?.itemsCalculadora?.length || 0
    });

    // 🚨 CORRECCIÓN ARQUITECTURAL CRÍTICA:
    // Los gastos en itemsCalculadora[].gastosGenerales son PRESUPUESTO (disponibles), NO asignaciones
    console.log('⚠️ [EXTRACCION GASTOS] ARQUITECTURA CLARIFICADA:');
    console.log('   📋 itemsCalculadora[].gastosGenerales = PRESUPUESTO (disponible para asignar)');
    console.log('   📅 Asignaciones reales = gastos asignados a días/semanas específicos');
    console.log('   💡 Hasta que no se asigne nada, "Asignado" debe ser $0');

    // Devolver array vacío porque NO HAY ASIGNACIONES REALES AÚN
    // Los gastos en itemsCalculadora son el presupuesto disponible, no las asignaciones
    const asignaciones = [];

    console.log('✅ [EXTRACCION GASTOS] Devolviendo asignaciones vacías (correcto - presupuesto sin asignaciones)');
    console.log('💰 [EXTRACCION GASTOS] Total asignado: $0 (correcto hasta que se hagan asignaciones reales)');

    return asignaciones;
  };

  const cargarAsignacionesActuales = async (presupuestoCargado = null) => {
    try {
      console.log('🔍 Cargando asignaciones actuales de otros costos...');

      // 🔥 BIFURCACIÓN: Trabajos extra vs Obras normales
      if (obra._esTrabajoExtra) {
        console.log('📦 TRABAJO EXTRA: Extrayendo gastos desde itemsCalculadora');

        // Usar presupuesto pasado como parámetro (más confiable) o el del estado
        const presupuestoParaExtraer = presupuestoCargado || presupuesto;

        if (presupuestoParaExtraer) {
          console.log('✅ Presupuesto disponible para extracción:', {
            id: presupuestoParaExtraer.id,
            tieneItemsCalculadora: !!presupuestoParaExtraer.itemsCalculadora,
            cantidadItems: presupuestoParaExtraer.itemsCalculadora?.length || 0
          });

          const asignacionesExtraidas = extraerAsignacionesDesdeTrabajoExtra(presupuestoParaExtraer);
          setAsignaciones(asignacionesExtraidas);

          // Calcular disponible del presupuesto global
          if (modoPresupuesto === 'GLOBAL' || modoPresupuesto === 'MIXTO') {
            const totalAsignado = asignacionesExtraidas.reduce((sum, asig) => {
              return sum + (parseFloat(asig.importeAsignado) || 0);
            }, 0);

            const disponibleRestante = presupuestoGlobalTotal - totalAsignado;
            setPresupuestoGlobalDisponible(Math.max(0, disponibleRestante));

            console.log(`💰 Presupuesto Global - Total: $${presupuestoGlobalTotal.toLocaleString('es-AR')}, Asignado: $${totalAsignado.toLocaleString('es-AR')}, Disponible: $${disponibleRestante.toLocaleString('es-AR')}`);
          }
        } else {
          console.warn('⚠️ Presupuesto aún no cargado, esperando...');
          setAsignaciones([]);
        }
        return; // ← Salir temprano para trabajos extra
      }

      // ════════════════════════════════════════════════════════════
      // OBRA NORMAL: Usar endpoints tradicionales
      // ════════════════════════════════════════════════════════════
      const obraIdParaQuery = getObraId();
      let endpoint = `/api/obras/${obraIdParaQuery}/otros-costos`;
      let params = { empresaId: empresaSeleccionada.id };

      console.log('📡 GET endpoint:', endpoint, 'params:', params);

      const queryString = new URLSearchParams(params).toString();
      const fullUrl = `${endpoint}${queryString ? '?' + queryString : ''}`;

      const response = await fetch(fullUrl, {
        headers: {
          'empresaId': empresaSeleccionada.id.toString()
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Asignaciones actuales desde BD:', data);

        // 📦 Cargar también localStorage temporal (solo para este modal)
        const locKey = `asignaciones_locales_costos_${obra.id}`;
        const locales = JSON.parse(localStorage.getItem(locKey) || '[]');

        // Combinar BD + localStorage temporal (evitar duplicados)
        const combined = [...(Array.isArray(data) ? data : [])];
        locales.forEach(loc => {
          if (!combined.some(c => c.id === loc.id)) {
            combined.push({ ...loc, esTemporalLocal: true });
          }
        });

        console.log(`📊 Asignaciones: ${data.length} desde BD + ${locales.length} temporales en localStorage = ${combined.length} total`);
        setAsignaciones(combined);

        // Calcular disponible del presupuesto global después de cargar asignaciones
        if (modoPresupuesto === 'GLOBAL' || modoPresupuesto === 'MIXTO') {
          const totalAsignado = combined.reduce((sum, asig) => {
            return sum + (parseFloat(asig.importeAsignado) || 0);
          }, 0);

          const disponibleRestante = presupuestoGlobalTotal - totalAsignado;
          setPresupuestoGlobalDisponible(Math.max(0, disponibleRestante));

          console.log(`💰 Presupuesto Global - Total: $${presupuestoGlobalTotal.toLocaleString('es-AR')}, Asignado: $${totalAsignado.toLocaleString('es-AR')}, Disponible: $${disponibleRestante.toLocaleString('es-AR')}`);
        }
      } else if (response.status === 404) {
        console.warn(`⚠️ Sin asignaciones previas (404) - Primera vez configurando`);
        setAsignaciones([]);
      } else {
        console.error(`❌ Error ${response.status} al cargar asignaciones desde BD`);
        setAsignaciones([]);
      }
    } catch (error) {
      console.error('❌ Error cargando asignaciones:', error);
      console.error('  Nota: Si es la primera vez, esto es normal (sin asignaciones previas)');
      setAsignaciones([]);
    }
  };

  const handleAsignarCosto = async () => {
    console.log('🚀 [DEBUG GASTOS] Iniciando handleAsignarCosto');
    console.log('📊 [DEBUG GASTOS] Estado completo nuevaAsignacion:', nuevaAsignacion);
    console.log('📅 [DEBUG GASTOS] Fecha que se va a procesar:', nuevaAsignacion.fechaAsignacion);

    // 🔥 TRABAJO EXTRA: BLOQUEADO - No debe modificar el presupuesto del trabajo extra
    if (obra._esTrabajoExtra) {
      alert('⚠️ No puedes agregar gastos desde aquí en un Trabajo Extra.\n\n' +
            '💡 El Trabajo Extra funciona como presupuesto independiente.\n' +
            '✅ Para modificar gastos, edita directamente el Trabajo Extra desde la lista de presupuestos.\n\n' +
            '🔍 Este modal solo debe mostrar los gastos disponibles del Trabajo Extra para asignar a días específicos.');
      return;
    }

    // 🔵 OBRA NORMAL: Lógica original para obras normales
    // ✅ CASO 1: Asignación desde IMPORTE GLOBAL
    if (nuevaAsignacion.tipoAsignacion === 'IMPORTE_GLOBAL') {
      if (!nuevoGastoManual.descripcion.trim()) {
        alert('⚠️ Debe ingresar una descripción para el gasto');
        return;
      }

      if (nuevoGastoManual.categoria === '__OTRO__' && !obtenerRubroFinal()) {
        alert('⚠️ Si seleccionas "Otros", debes escribir el rubro');
        return;
      }

      const importeAsignado = parseFloat(nuevaAsignacion.importeAsignado) || 0;

      if (importeAsignado <= 0) {
        alert('⚠️ El importe debe ser mayor a cero');
        return;
      }

      // 🆕 Solo validar disponible si NO hay un origen de fondos alternativo
      if (presupuestoGlobalTotal > 0 && importeAsignado > presupuestoGlobalDisponible) {
        alert(`⚠️ El importe ($${importeAsignado.toLocaleString('es-AR')}) excede el disponible ($${presupuestoGlobalDisponible.toLocaleString('es-AR')})`);
        return;
      }

      // 🆕 Si presupuesto = 0, verificar que se haya seleccionado origen de fondos
      if (presupuestoGlobalTotal === 0 && !nuevaAsignacion.origenFondos) {
        alert('⚠️ Debe seleccionar el origen de fondos (Retiro Directo o Presupuesto de Materiales)');
        return;
      }

      // 🔥 DESHABILITADO: Backend tiene CORS bloqueado para /api/gastos-generales
      // console.log('📝 Verificando/creando gasto en catálogo...');
      // const { obtenerOCrearGasto } = await import('../services/catalogoGastosService');
      // const gastoCatalogo = await obtenerOCrearGasto(
      //   nuevoGastoManual.descripcion,
      //   importeAsignado,
      //   empresaSeleccionada.id
      // );
      // console.log('✅ Gasto en catálogo:', gastoCatalogo);

      // Crear gasto manual (backend lo creará automáticamente)
      const categoriaFinal = obtenerRubroFinal();
      const gastoManual = {
        // id: gastoCatalogo.id, // Backend asignará ID
        nombre: nuevoGastoManual.descripcion,
        descripcion: nuevoGastoManual.descripcion,
        categoria: categoriaFinal,
        importe: importeAsignado,
        esDelStock: false,
        esManual: true
      };

      // Asignar como si fuera un elemento seleccionado
      setNuevaAsignacion({
        ...nuevaAsignacion,
        otroCostoId: gastoManual.id,
        importeAsignado: importeAsignado.toString(),
        esManual: true
      });

      // Continuar con el flujo normal usando el gasto manual creado
      setOtrosCostosDisponibles(prev => [...prev, gastoManual]);
      setGastosCreados(prev => [...prev, gastoManual]);

      console.log('✅ Gasto manual creado desde IMPORTE_GLOBAL:', gastoManual);
    }

    // ✅ CASO 2: Si está creando un gasto nuevo desde ELEMENTO_DETALLADO
    if (nuevaAsignacion.otroCostoId === 'CREAR_NUEVO') {
      const gastoCreado = handleCrearGastoManual(false);
      if (!gastoCreado) {
        return; // handleCrearGastoManual ya mostró el error
      }
      // Continuar con la asignación usando el gasto recién creado
      // El estado ya fue actualizado en handleCrearGastoManual
    }

    if (!nuevaAsignacion.otroCostoId || nuevaAsignacion.otroCostoId === 'CREAR_NUEVO') {
      alert('Por favor complete los datos del gasto');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const costoSeleccionado = otrosCostosDisponibles.find(
        c => c.id.toString() === nuevaAsignacion.otroCostoId
      );

      // 🔥 Calcular número de semana desde fecha de asignación
      let numeroSemana = null;
      if (nuevaAsignacion.fechaAsignacion && configuracionObraActualizada?.fechaInicio) {
        const fechaAsignacion = new Date(nuevaAsignacion.fechaAsignacion + 'T12:00:00');
        const fechaInicio = new Date(configuracionObraActualizada.fechaInicio.split('T')[0] + 'T12:00:00');
        const diffMs = fechaAsignacion - fechaInicio;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        numeroSemana = Math.floor(diffDays / 7) + 1;
        console.log(`📅 Semana calculada: ${numeroSemana} (fecha: ${nuevaAsignacion.fechaAsignacion}, inicio: ${configuracionObraActualizada.fechaInicio})`);
      }

      // Preparar datos según el tipo de recurso
      const esManual = Boolean(nuevaAsignacion.esManual || nuevaAsignacion.tipoAsignacion === 'IMPORTE_GLOBAL');

      const datos = {
        gastoGeneralId: nuevaAsignacion.otroCostoId,
        fechaAsignacion: nuevaAsignacion.fechaAsignacion,
        semana: numeroSemana,
        observaciones: nuevaAsignacion.observaciones || null,
        esGlobal: Boolean(nuevaAsignacion.esManual),
        esManual: esManual,
        origenFondos: nuevaAsignacion.origenFondos || 'RETIRO_DIRECTO' // 🆕 Guardar origen de fondos
      };

      // Si es manual, agregar descripción y categoría del gasto
      if (esManual && costoSeleccionado) {
        datos.descripcion = costoSeleccionado.descripcion || costoSeleccionado.nombre;
        datos.categoria = costoSeleccionado.categoria || 'General';
        datos.nombre = costoSeleccionado.nombre || costoSeleccionado.descripcion;
      }

      console.log('🔍 DEBUG - Estado completo:');
      console.log('   nuevaAsignacion:', nuevaAsignacion);
      console.log('   costoSeleccionado:', costoSeleccionado);
      console.log('   otrosCostosDisponibles:', otrosCostosDisponibles);

      if (costoSeleccionado?.esDelStock) {
        // Para recursos físicos: usuario ingresa cantidad e importe unitario
        const cantidad = parseInt(nuevaAsignacion.cantidadAsignada) || 0;
        const importeUnitario = parseFloat(nuevaAsignacion.importeUnitario) || 0;
        const importeTotal = cantidad * importeUnitario;

        console.log('🔍 DEBUG - Cálculo de importe:');
        console.log('   cantidad asignada:', cantidad);
        console.log('   importe unitario:', importeUnitario);
        console.log('   importe total:', importeTotal);

        if (cantidad <= 0) {
          alert('⚠️ Debe ingresar una cantidad válida');
          setLoading(false);
          return;
        }

        if (importeUnitario <= 0) {
          alert('⚠️ Debe ingresar un importe unitario válido');
          setLoading(false);
          return;
        }

        datos.cantidadAsignada = cantidad;
        datos.importeAsignado = importeTotal;

        console.log(`📊 RESULTADO - Enviando al backend:`, datos);
      } else {
        // Para importes monetarios: solo el importe
        datos.importeAsignado = parseFloat(nuevaAsignacion.importeAsignado) || 0;

        console.log(`💰 Importe directo: $${datos.importeAsignado}`);
      }

      console.log('📤 Datos preparados para el backend:', datos);
      console.log('📋 Costo seleccionado:', costoSeleccionado);
      console.log('🔍 Estado formulario:', nuevaAsignacion);
      console.log(`🔥🔥🔥 POST OTRO COSTO INDIVIDUAL - Payload:`, datos);

      const obraIdParaAsignacion = getObraId(); // ✅ Usa ID real de la obra
      const resultado = await asignarOtroCostoAObra(obraIdParaAsignacion, empresaSeleccionada.id, datos);
      console.log('✅ Costo asignado exitosamente:', resultado);

      // 🧹 Limpiar localStorage después de guardado exitoso en BD
      const obraIdParaKey = getObraId(); // ✅ Usa ID real de la obra
      const locKey = `asignaciones_locales_costos_${obraIdParaKey}`;
      localStorage.removeItem(locKey);
      console.log('🧹 localStorage limpiado después de guardado exitoso en BD');

      // Limpiar formulario completamente
      setNuevaAsignacion({
        tipoAsignacion: '',
        otroCostoId: '',
        cantidadAsignada: '',
        importeUnitario: '',
        importeAsignado: '',
        fechaAsignacion: '',
        observaciones: '',
        esManual: false,
        origenFondos: 'RETIRO_DIRECTO'
      });

      // Recargar asignaciones
      await cargarAsignacionesActuales();

      if (onAsignacionExitosa) {
        onAsignacionExitosa();
      }
    } catch (error) {
      console.error('❌ Error asignando costo:', error);
      alert(`Error al asignar costo: ${error.message}\n\nLos datos NO fueron guardados. Verifique la conexión con el backend.`);
    } finally {
      setLoading(false);
    }
  };

  // 🆕 Función para crear gasto manual desde presupuesto global (inline o modal)
  const handleCrearGastoManual = async (cerrarModal = true) => {
    if (!nuevoGastoManual.descripcion.trim()) {
      alert('⚠️ Debe ingresar una descripción para el gasto');
      return;
    }

    if (nuevoGastoManual.categoria === '__OTRO__' && !obtenerRubroFinal()) {
      alert('⚠️ Si seleccionas "Otros", debes escribir el rubro');
      return;
    }

    const cantidad = parseFloat(nuevoGastoManual.cantidadAsignada) || 0;
    const importeUnitario = parseFloat(nuevoGastoManual.importeUnitario) || 0;
    const importeTotal = cantidad * importeUnitario;

    if (importeTotal <= 0) {
      alert('⚠️ El importe total debe ser mayor a cero');
      return;
    }

    // 🆕 VALIDACIÓN según tipo de registro
    const esGastoDirecto = nuevoGastoManual.tipoRegistro === 'GASTO_DIRECTO';

    if (esGastoDirecto) {
      // 🆕 Solo validar si hay presupuesto real Y NO se seleccionó origen alternativo
      if (presupuestoGlobalTotal > 0 && presupuestoGlobalDisponible > 0 && importeTotal > presupuestoGlobalDisponible) {
        const confirmar = window.confirm(
          `⚠️ ADVERTENCIA: El importe ($${importeTotal.toLocaleString('es-AR')}) excede el disponible del presupuesto ($${presupuestoGlobalDisponible.toLocaleString('es-AR')}).\n\n` +
          `Diferencia: $${(importeTotal - presupuestoGlobalDisponible).toLocaleString('es-AR')}\n\n` +
          `¿Desea continuar de todas formas? Este gasto se registrará como EXTRA al presupuesto.`
        );

        if (!confirmar) return;
      }

      // 🆕 Si presupuesto = 0, verificar origen de fondos
      if (presupuestoGlobalTotal === 0 && !nuevaAsignacion.origenFondos) {
        alert('⚠️ Debe seleccionar el origen de fondos antes de crear el gasto');
        return;
      }
    } else {
      // Para inventario: solo informar, no validar contra presupuesto
      console.log(`💰 Agregando al inventario: $${importeTotal.toLocaleString('es-AR')} (sin validar contra presupuesto)`);
    }

    // Crear gasto manual
    const categoriaFinal = obtenerRubroFinal();
    const gastoManual = {
      nombre: nuevoGastoManual.descripcion,
      descripcion: nuevoGastoManual.descripcion,
      categoria: categoriaFinal,
      cantidadDisponible: esGastoDirecto ? null : cantidad, // null = sin stock (gasto directo)
      precioUnitario: importeUnitario,
      importe: importeTotal,
      esDelStock: !esGastoDirecto, // true si es inventario, false si es gasto directo
      esManual: true,
      tipoRegistro: nuevoGastoManual.tipoRegistro // Guardar el tipo para referencia
    };

    // Agregar a la lista de gastos disponibles
    setOtrosCostosDisponibles(prev => [...prev, gastoManual]);
    setGastosCreados(prev => [...prev, gastoManual]);

    // Pre-seleccionar el gasto recién creado en el formulario
    setNuevaAsignacion({
      ...nuevaAsignacion,
      otroCostoId: gastoManual.id,
      cantidadAsignada: cantidad.toString(),
      importeUnitario: importeUnitario.toString(),
      importeAsignado: importeTotal.toString(),
      esManual: true
    });

    // Limpiar formulario de creación
    setNuevoGastoManual({
      descripcion: '',
      categoria: 'General',
      categoriaCustom: '',
      cantidadAsignada: '',
      importeUnitario: '',
      observaciones: '',
      tipoRegistro: 'GASTO_DIRECTO' // Reset al valor por defecto
    });

    // Cerrar modal si se llama desde allí
    if (cerrarModal) {
      setMostrarCrearGastoManual(false);
    }

    const tipoTexto = esGastoDirecto ? '💸 Gasto Directo / Retiro Caja Chica' : '📦 Entrada de Inventario';
    console.log(`✅ Gasto manual creado: ${tipoTexto}`, gastoManual);

    if (!esGastoDirecto) {
      console.log(`📦 Inventario actualizado: +${cantidad} unidades de "${gastoManual.nombre}"`);
    }

    return gastoManual;
  };

  // Nueva función: manejar asignaciones semanales múltiples de costos
  const handleAsignacionSemanalCompleta = async (asignacionesSemana) => {
    console.log('📋 [INICIO HANDLER] handleAsignacionSemanalCompleta EJECUTADO - Timestamp:', new Date().toISOString());
    console.log('📥 [HANDLER] Recibido:', asignacionesSemana);

    if (!asignacionesSemana || asignacionesSemana.length === 0) {
      console.log('⚠️ No hay asignaciones de costos para procesar');
      return;
    }

    // 🔥 TRABAJO EXTRA: Guardado especial con PUT a /api/v1/trabajos-extra/{id}
    if (obra._esTrabajoExtra) {
      console.log('🔥 [TRABAJO EXTRA] Iniciando guardado de múltiples gastos...');
      setLoading(true);

      try {
        // 1. Obtener el trabajo extra completo actual
        console.log('📥 Obteniendo trabajo extra completo...');
        const trabajoExtra = await api.trabajosExtra.getById(obra.id, empresaSeleccionada.id);
        console.log('✅ Trabajo extra obtenido:', trabajoExtra);

        // 2. Validar que tenga itemsCalculadora
        if (!trabajoExtra.itemsCalculadora || trabajoExtra.itemsCalculadora.length === 0) {
          alert('❌ Error: El trabajo extra no tiene rubros (itemsCalculadora vacío)');
          setLoading(false);
          return;
        }

        const primerItem = trabajoExtra.itemsCalculadora[0];
        if (!primerItem.id) {
          alert('❌ Error: El rubro del trabajo extra no tiene ID');
          setLoading(false);
          return;
        }

        // 3. Convertir asignaciones a formato de gastos
        const nuevosGastos = asignacionesSemana.map((asig, index) => ({
          descripcion: asig.nombreOtroCosto || asig.descripcion,
          cantidad: Number(asig.cantidad) || 1,
          precioUnitario: Number(asig.importe) || 0,
          subtotal: (Number(asig.cantidad) || 1) * (Number(asig.importe) || 0),
          sinCantidad: false,
          sinPrecio: false,
          orden: (primerItem.gastosGenerales || []).length + index + 1,
          observaciones: asig.observaciones || ''
        }));

        console.log('💰 Nuevos gastos a agregar:', nuevosGastos);

        // 4. Agregar a la lista existente
        const gastosActualizados = [...(primerItem.gastosGenerales || []), ...nuevosGastos];

        // 5. Calcular totales
        const subtotalGastos = gastosActualizados.reduce((sum, g) => sum + (g.subtotal || 0), 0);
        const subtotalManoObra = primerItem.subtotalManoObra || 0;
        const subtotalMateriales = (primerItem.materialesLista || []).reduce((sum, m) => sum + (m.subtotal || 0), 0);
        const totalItem = subtotalManoObra + subtotalMateriales + subtotalGastos;

        // 6. Construir payload
        const payload = {
          obraId: trabajoExtra.obraId,
          nombre: trabajoExtra.nombre,
          descripcion: trabajoExtra.descripcion,
          fechaProbableInicio: trabajoExtra.fechaProbableInicio,
          vencimiento: trabajoExtra.vencimiento,
          tiempoEstimadoTerminacion: trabajoExtra.tiempoEstimadoTerminacion,
          itemsCalculadora: [
            {
              id: primerItem.id,
              tipoProfesional: primerItem.tipoProfesional || 'Gasto General',
              descripcion: primerItem.descripcion || 'Trabajo adicional',
              esModoManual: primerItem.esModoManual ?? false,
              esRubroVacio: primerItem.esRubroVacio ?? false,
              esGastoGeneral: primerItem.esGastoGeneral ?? false,
              incluirEnCalculoDias: primerItem.incluirEnCalculoDias ?? true,
              trabajaEnParalelo: primerItem.trabajaEnParalelo ?? true,
              cantidadJornales: primerItem.cantidadJornales || 0,
              importeJornal: primerItem.importeJornal || 0,
              subtotalManoObra: subtotalManoObra,
              total: totalItem,
              profesionales: primerItem.profesionales || [],
              materialesLista: primerItem.materialesLista || [],
              gastosGenerales: gastosActualizados,
              jornales: primerItem.jornales || []
            }
          ],
          dias: trabajoExtra.dias || []
        };

        // 7. Enviar PUT
        console.log(`🌐 Enviando PUT a /api/v1/trabajos-extra/${obra.id}`);
        const response = await fetch(`http://localhost:8080/api/v1/trabajos-extra/${obra.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'empresaId': empresaSeleccionada.id.toString()
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error('❌ Error del backend:', errorData);
          throw new Error(`Error ${response.status}: ${errorData}`);
        }

        const resultado = await response.json();
        console.log('✅ Respuesta del backend:', resultado);

        // 8. Success feedback
        alert(`✅ ${nuevosGastos.length} gasto(s) asignado(s) correctamente al trabajo extra`);

        // 9. Actualizar UI
        await cargarAsignacionesActuales();
        setMostrarAsignacionSemanal(false);
        if (onAsignacionExitosa) {
          onAsignacionExitosa();
        }

        setLoading(false);
        return; // ✅ Salir aquí

      } catch (error) {
        console.error('❌ Error asignando gastos a trabajo extra:', error);
        alert(`❌ Error al guardar: ${error.message}`);
        setLoading(false);
        return;
      }
    }

    // 🔵 OBRA NORMAL: Lógica original
    setLoading(true);
    setError(null);

    try {
      console.log('💰 Procesando asignaciones semanales de costos:', asignacionesSemana);

      // Procesar cada asignación diaria
      const resultados = [];

      for (const asignacion of asignacionesSemana) {
        try {
          // Manejar IDs manuales (strings) para evitar NaN
          const esManual = typeof asignacion.otroCostoId === 'string' && asignacion.otroCostoId.startsWith('MANUAL');

          let gastoId = esManual ? null : Number(asignacion.otroCostoId);

          // 🔥 CREAR GASTO EN EL CATÁLOGO si es manual (sin Content-Type charset)
          if (esManual) {
            try {
              console.log('📝 Creando gasto en catálogo:', asignacion.nombreOtroCosto);
              const { obtenerOCrearGasto } = await import('../services/catalogoGastosService');
              const gastoCatalogo = await obtenerOCrearGasto(
                asignacion.nombreOtroCosto,
                Number(asignacion.importe),
                empresaSeleccionada.id
              );
              gastoId = gastoCatalogo.id;
              console.log('✅ Gasto creado/encontrado en catálogo:', gastoCatalogo);
            } catch (error) {
              console.error('❌ Error creando gasto en catálogo:', error);
              gastoId = null; // Fallback - backend intentará crear
            }
          }

          const payload = {
            obraId: obra.id,
            presupuestoOtroCostoId: gastoId,
            gastoGeneralId: gastoId,
            importeAsignado: Number(asignacion.importe),
            semana: Number(asignacion.numeroSemana),
            observaciones: asignacion.observaciones,
            // Agregar metadatos descriptivos para que backend pueda crear el gasto si no existe
            descripcion: asignacion.nombreOtroCosto,
            categoria: asignacion.categoria,
            esGlobal: Boolean(asignacion.esManual), // 🔥 NUEVO: Marcar como global si es manual
            esManual: Boolean(asignacion.esManual), // 🔥 NUEVO: Preservar flag de gasto manual
            origenFondos: asignacion.origenFondos || null // 🆕 Incluir origen de fondos
          };

          // Intentar guardar en backend
          let data = null;
          let success = false;

          try {
            const obraIdParaBulk = getObraId(); // ✅ Usa ID real de la obra

            // 🔥 Si es trabajo extra, agregar su ID al payload
            let payloadBulk = { ...payload };
            if (obra._esTrabajoExtra) {
              console.log('✅ TRABAJO EXTRA - Agregando ID al payload bulk');
              payloadBulk.trabajoExtraId = parseInt(obra.id);
              payloadBulk.esTrabajoExtra = true;
            }

            const endpoint = `/api/obras/${obraIdParaBulk}/otros-costos`;
            console.log('📡 POST BULK endpoint:', endpoint);

            const response = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'empresaId': empresaSeleccionada.id.toString(),
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(payloadBulk)
            });

            if (response.ok) {
              data = await response.json();
              success = true;
            } else {
              console.warn(`⚠️ Backend respondió con error ${response.status} para ${asignacion.fechaAsignacion}`);
            }
          } catch (netError) {
             console.error(`❌ Error de red al asignar costo para ${asignacion.fechaAsignacion}:`, netError);
          }

          let nuevaAsignacionFinal = null;

          if (success && data) {
            resultados.push({
              semana: asignacion.numeroSemana,
              costo: asignacion.nombreOtroCosto,
              importe: asignacion.importe,
              resultado: data
            });
          } else {
            console.error(`❌ No se pudo guardar asignación para semana ${asignacion.numeroSemana}: ${asignacion.nombreOtroCosto}`);
          }
        } catch (innerError) {
          console.error('Error crítico procesando asignación individual:', innerError);
        }
      }

      console.log('✅ Asignaciones semanales completadas.');

      // 🧹 Limpiar localStorage después de guardado exitoso en BD
      const locKey = `asignaciones_locales_costos_${obra.id}`;
      localStorage.removeItem(locKey);
      console.log('🧹 localStorage limpiado después de asignaciones semanales exitosas');

      // Recargar asignaciones desde BD
      await cargarAsignacionesActuales();

      // Cerrar modal
      setMostrarAsignacionSemanal(false);

      if (onAsignacionExitosa) {
        onAsignacionExitosa();
      }

      alert(`💰 Se asignaron ${resultados.length} costos para la semana ${semanaAsignacionCompleta}`);

    } catch (error) {
      console.error('❌ Error en asignaciones semanales de costos:', error);
      setError(error.message);
      alert(`Error en asignaciones semanales de costos: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarAsignacion = async (asignacionId) => {
    // 🚫 BLOQUEO: No permitir eliminar gastos en trabajos extra
    if (obra._esTrabajoExtra) {
      alert('❌ No puedes eliminar gastos desde aquí en un Trabajo Extra.\n\n💡 El Trabajo Extra funciona como presupuesto independiente con importes predefinidos.\n\n Para modificar el presupuesto, ve a la sección de Trabajos Extra.');
      return;
    }

    if (!confirm('¿Está seguro de eliminar esta asignación?')) {
      return;
    }

    try {
      setLoading(true);

      // ════════════════════════════════════════════════════════════
      // OBRA NORMAL: Usar endpoint tradicional
      // ════════════════════════════════════════════════════════════

      // 1. Eliminar de localStorage temporal si existe
      const locKey = `asignaciones_locales_costos_${obra.id}`;
      const currentLocales = JSON.parse(localStorage.getItem(locKey) || '[]');
      const filtered = currentLocales.filter(a => a.id.toString() !== asignacionId.toString());
      localStorage.setItem(locKey, JSON.stringify(filtered));

      // 2. Eliminar de BD
      const obraIdParaDelete = getObraId();

      const endpoint = `/api/obras/${obraIdParaDelete}/otros-costos/${asignacionId}`;
      const headers = {
        'empresaId': empresaSeleccionada.id.toString()
      };

      console.log('📡 DELETE endpoint:', endpoint);

      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: headers
      });

      if (response.ok) {
        console.log('✅ Asignación eliminada del backend');
      } else {
        console.warn('⚠️ No se pudo eliminar del backend (puede no existir), pero se borró localmente.');
      }

      // 3. Actualizar UI
      await cargarAsignacionesActuales();
      if (onAsignacionExitosa) {
        onAsignacionExitosa();
      }
    } catch (error) {
      console.error('❌ Error eliminando asignación:', error);
      // Recargar asignaciones desde BD
      await cargarAsignacionesActuales();
    } finally {
      setLoading(false);
    }
  };

  // 🆕 Función auxiliar para eliminar gasto general de trabajo extra
  const eliminarGastoDeTrabajoExtra = async (asignacionId) => {
    console.log('🗑️ Eliminando gasto general de trabajo extra...');
    console.log('🗑️ ID del gasto a eliminar:', asignacionId);

    // Usar el endpoint DELETE específico del backend
    const response = await fetch(`http://localhost:8080/api/v1/trabajos-extra/gastos-generales/${asignacionId}`, {
      method: 'DELETE',
      headers: {
        'empresaId': empresaSeleccionada.id.toString()
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error ${response.status} del backend:`, errorText);
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    console.log('✅ Gasto general eliminado del trabajo extra');
  };

  const handleEditarAsignacion = (asignacion) => {
    // 🚫 BLOQUEO: No permitir editar gastos en trabajos extra
    if (obra._esTrabajoExtra) {
      alert('❌ No puedes editar gastos desde aquí en un Trabajo Extra.\n\n💡 El Trabajo Extra funciona como presupuesto independiente con importes predefinidos.\n\n Para modificar el presupuesto, ve a la sección de Trabajos Extra.');
      return;
    }

    console.log('✏️ Editando asignación:', asignacion);
    setAsignacionEnEdicion({
      ...asignacion,
      // Asegurar que los campos numéricos sean strings para los inputs
      importeAsignado: asignacion.importeAsignado?.toString() || '',
      cantidadAsignada: asignacion.cantidadAsignada?.toString() || '1'
    });
    setMostrarModalEdicion(true);
  };

  const handleActualizarAsignacion = async () => {
    if (!asignacionEnEdicion) return;

    try {
      setLoading(true);

      const nuevoImporte = parseFloat(asignacionEnEdicion.importeAsignado);
      const nuevaCantidad = parseFloat(asignacionEnEdicion.cantidadAsignada);

      if (!nuevoImporte || nuevoImporte <= 0) {
        alert('El importe debe ser mayor a cero');
        return;
      }

      // 🔥 BIFURCACIÓN: Trabajos extra vs Obras normales
      if (obra._esTrabajoExtra) {
        await actualizarGastoEnTrabajoExtra(asignacionEnEdicion.id, {
          importeAsignado: nuevoImporte,
          cantidadAsignada: nuevaCantidad,
          observaciones: asignacionEnEdicion.observaciones
        });
      } else {
        // ════════════════════════════════════════════════════════════
        // OBRA NORMAL: Usar endpoint tradicional
        // ════════════════════════════════════════════════════════════
        const obraIdParaUpdate = getObraId();
        const endpoint = `/api/obras/${obraIdParaUpdate}/otros-costos/${asignacionEnEdicion.id}`;

        const response = await fetch(endpoint, {
          method: 'PUT',
          headers: {
            'empresaId': empresaSeleccionada.id.toString(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            importeAsignado: nuevoImporte,
            cantidadAsignada: nuevaCantidad,
            observaciones: asignacionEnEdicion.observaciones
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Error ${response.status}: ${errorText}`);
        }

        console.log('✅ Asignación actualizada en backend');
      }

      console.log('✅ Asignación actualizada');
      setMostrarModalEdicion(false);
      setAsignacionEnEdicion(null);
      await cargarAsignacionesActuales();
      if (onAsignacionExitosa) onAsignacionExitosa();
      alert('Asignación actualizada correctamente');
    } catch (error) {
      console.error('❌ Error actualizando asignación:', error);
      alert(`Error al actualizar: ${error.message}`);
    } finally {
      setMostrarModalEdicion(false);
      setLoading(false);
    }
  };

  // 🆕 Función auxiliar para actualizar gasto en trabajo extra
  const actualizarGastoEnTrabajoExtra = async (asignacionId, cambios) => {
    console.log('✏️ Actualizando gasto en trabajo extra...');

    // El ID tiene formato: `${itemIdx}-${gastoIdx}`
    const [itemIdx, gastoIdx] = asignacionId.toString().split('-').map(Number);

    if (isNaN(itemIdx) || isNaN(gastoIdx)) {
      throw new Error(`ID de asignación inválido: ${asignacionId}`);
    }

    // 1. Obtener el trabajo extra actual
    const trabajoExtra = await api.trabajosExtra.getById(obra.id, empresaSeleccionada.id);

    // 2. Validar que el gasto existe
    if (!trabajoExtra.itemsCalculadora ||
        !trabajoExtra.itemsCalculadora[itemIdx] ||
        !trabajoExtra.itemsCalculadora[itemIdx].gastosGenerales ||
        !trabajoExtra.itemsCalculadora[itemIdx].gastosGenerales[gastoIdx]) {
      throw new Error(`Gasto no encontrado en índices: item ${itemIdx}, gasto ${gastoIdx}`);
    }

    const gasto = trabajoExtra.itemsCalculadora[itemIdx].gastosGenerales[gastoIdx];
    const importeAnterior = gasto.importe || gasto.subtotal || 0;

    // 3. Actualizar el gasto
    if (cambios.importeAsignado !== undefined) {
      gasto.importe = cambios.importeAsignado;

      // Recalcular precio unitario si hay cantidad
      if (cambios.cantidadAsignada && cambios.cantidadAsignada > 0) {
        gasto.cantidad = cambios.cantidadAsignada;
        gasto.precioUnitario = cambios.importeAsignado / cambios.cantidadAsignada;
      } else if (gasto.cantidad && gasto.cantidad > 0) {
        gasto.precioUnitario = cambios.importeAsignado / gasto.cantidad;
      } else {
        gasto.precioUnitario = cambios.importeAsignado;
        gasto.cantidad = 1;
      }
    }

    if (cambios.observaciones !== undefined) {
      gasto.observaciones = cambios.observaciones;
    }

    // 4. Recalcular subtotal del rubro
    const diferenciaImporte = (gasto.importe || 0) - importeAnterior;
    trabajoExtra.itemsCalculadora[itemIdx].subtotal =
      (trabajoExtra.itemsCalculadora[itemIdx].subtotal || 0) + diferenciaImporte;

    // 5. Guardar el trabajo extra actualizado
    console.log('📡 PUT /api/v1/trabajos-extra/{id} - Actualizando gasto...');

    const response = await fetch(`/api/v1/trabajos-extra/${obra.id}`, {
      method: 'PUT',
      headers: {
        'empresaId': empresaSeleccionada.id.toString(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(trabajoExtra)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error ${response.status} del backend:`, errorText);
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    console.log('✅ Gasto actualizado en trabajo extra');
  };

  // Funciones para manejo de detalle semanal
  const abrirDetalleSemana = (numeroSemana) => {
    setSemanaSeleccionada(numeroSemana);
    setMostrarDetalleSemana(true);

    // Calcular días hábiles de la semana
    const diasSemana = calcularDiasHabilesSemana(numeroSemana);
    console.log(`📅 Abriendo detalle semana ${numeroSemana} (Gastos):`, diasSemana);
  };

  // Nueva función: abrir formulario con fecha específica
  const abrirAsignacionParaDia = (fechaStr) => {
    console.log('🎯 [DEBUG GASTOS] abrirAsignacionParaDia recibió fecha:', fechaStr);
    setNuevaAsignacion({
      tipoAsignacion: '',
      otroCostoId: '',
      cantidadAsignada: '',
      importeUnitario: '',
      importeAsignado: '',
      fechaAsignacion: fechaStr,
      observaciones: '',
      esManual: false
    });
    setNuevoGastoManual({
      descripcion: '',
      categoria: 'General',
      categoriaCustom: '',
      cantidadAsignada: '',
      importeUnitario: '',
      observaciones: ''
    });
    setMostrarDetalleSemana(false); // Cerrar detalle semanal
    setMostrarFormularioIndividual(true); // Abrir formulario individual
    console.log(`ð Formulario configurado para fecha: ${fechaStr}`);
  };

  // Nueva función: abrir modal de asignación semanal completa
  const abrirAsignacionSemanal = (numeroSemana, rubroActual = 'General') => {
    setSemanaAsignacionCompleta(numeroSemana);
    setRubroSeleccionado(rubroActual); // Guardar el rubro desde donde se abre
    setMostrarDetalleSemana(false); // Cerrar detalle si estaba abierto
    setMostrarAsignacionSemanal(true);
    console.log(`📅 Abriendo asignación semanal completa para semana ${numeroSemana}, rubro: ${rubroActual}`);
  };

  // Función para manejar envío del formulario individual
  const handleSubmit = async (e) => {
    e.preventDefault();
    await handleAsignarCosto();
    setMostrarFormularioIndividual(false); // Cerrar formulario tras éxito
  };

  // Calcular semanas necesarias basándose en días hábiles reales (misma lógica que Configuración)
  const semanas = useMemo(() => {
    if (!configuracionObraActualizada?.fechaInicio || !configuracionObraActualizada?.diasHabiles) return [];

    const diasHabiles = Number(configuracionObraActualizada.diasHabiles);
    if (!Number.isFinite(diasHabiles) || diasHabiles <= 0) return [];

    const fechaInicio = parsearFechaLocal(configuracionObraActualizada.fechaInicio);
    if (!fechaInicio || isNaN(fechaInicio.getTime())) return [];

    const totalSemanas = calcularSemanasParaDiasHabiles(fechaInicio, diasHabiles);
    if (!totalSemanas || totalSemanas <= 0) return [];

    return Array.from({ length: totalSemanas }, (_, idx) => ({
      numeroSemana: idx + 1
    }));
  }, [configuracionObraActualizada?.fechaInicio, configuracionObraActualizada?.diasHabiles]);

  // 🆕 Calcular totales de materiales y honorarios (para origen de fondos cuando presupuesto gastos = $0)
  const { totalHonorarios, totalMateriales } = useMemo(() => {
    let totalMateriales = 0;
    let totalHonorarios = 0;

    if (presupuestoGlobalTotal === 0 && presupuesto?.itemsCalculadora) {
      // 1. Calcular bases para honorarios
      let baseManoObra = 0;
      let baseMaterialesBruto = 0;
      let baseProfesionales = 0;

      presupuesto.itemsCalculadora.forEach((item) => {
        // Mano de obra (jornales)
        let manoObraItem = 0;

        if (item.subtotalManoObra) {
          manoObraItem = item.subtotalManoObra;
        } else if (item.jornales && Array.isArray(item.jornales)) {
          const totalJornales = item.jornales.reduce((sum, j) => {
            const jornalTotal = (j.cantidad || 0) * (j.importeTotal || j.precioUnitario || j.importe || j.subtotal || j.total || 0);
            return sum + jornalTotal;
          }, 0);
          if (totalJornales > 0) {
            manoObraItem = totalJornales;
          }
        } else if (item.total) {
          const totalMaterialesItem = item.materialesLista ?
            item.materialesLista.reduce((sum, m) => sum + (m.subtotal || 0), 0) : 0;
          const totalGastosItem = item.gastosGenerales ?
            item.gastosGenerales.reduce((sum, g) => sum + (g.importe || g.subtotal || 0), 0) : 0;
          manoObraItem = item.total - totalMaterialesItem - totalGastosItem;
        }

        baseManoObra += manoObraItem;

        // Materiales
        if (item.materialesLista && Array.isArray(item.materialesLista)) {
          const subtotalMateriales = item.materialesLista.reduce((sum, m) => sum + (m.subtotal || 0), 0);
          baseMaterialesBruto += subtotalMateriales;
        }

        // Profesionales
        if (item.profesionales && Array.isArray(item.profesionales)) {
          baseProfesionales += item.profesionales.reduce((sum, p) => sum + (p.subtotal || 0), 0);
        }
      });

      // 2. Calcular honorarios según configuración
      let honorariosJornales = 0;
      let honorariosMateriales = 0;
      let honorariosProfesionales = 0;
      let honorariosOtrosCostos = 0;

      if (presupuesto.honorarios) {
        // Honorarios sobre jornales
        if (presupuesto.honorarios.jornales?.activo && presupuesto.honorarios.jornales?.valor) {
          const valorHon = Number(presupuesto.honorarios.jornales.valor);
          if (presupuesto.honorarios.jornales.tipo === 'porcentaje') {
            honorariosJornales = (baseManoObra * valorHon) / 100;
          } else {
            honorariosJornales = valorHon;
          }
        }

        // Honorarios sobre materiales
        if (presupuesto.honorarios.materiales?.activo && presupuesto.honorarios.materiales?.valor) {
          const valorHon = Number(presupuesto.honorarios.materiales.valor);
          if (presupuesto.honorarios.materiales.tipo === 'porcentaje') {
            honorariosMateriales = (baseMaterialesBruto * valorHon) / 100;
          } else {
            honorariosMateriales = valorHon;
          }
        }

        // Honorarios sobre profesionales
        if (presupuesto.honorarios.profesionales?.activo && presupuesto.honorarios.profesionales?.valor) {
          const valorHon = Number(presupuesto.honorarios.profesionales.valor);
          if (presupuesto.honorarios.profesionales.tipo === 'porcentaje') {
            honorariosProfesionales = (baseProfesionales * valorHon) / 100;
          } else {
            honorariosProfesionales = valorHon;
          }
        }

        // Honorarios sobre otros costos
        if (presupuesto.honorarios.otrosCostos?.activo && presupuesto.honorarios.otrosCostos?.valor) {
          const valorHon = Number(presupuesto.honorarios.otrosCostos.valor);
          if (presupuesto.honorarios.otrosCostos.tipo === 'porcentaje') {
            honorariosOtrosCostos = (presupuestoGlobalTotal * valorHon) / 100;
          } else {
            honorariosOtrosCostos = valorHon;
          }
        }
      }

      // Total honorarios
      totalHonorarios = honorariosJornales + honorariosMateriales + honorariosProfesionales + honorariosOtrosCostos;

      // Total materiales
      totalMateriales = baseMaterialesBruto;
    }

    return { totalHonorarios, totalMateriales };
  }, [presupuestoGlobalTotal, presupuesto]);

  const calcularDiasHabilesSemana = (numeroSemana) => {
    console.log('📆 [calcularDiasHabilesSemana] Entrada:', {
      numeroSemana,
      presupuesto: !!presupuesto,
      configuracionObra: !!configuracionObra,
      fechaProbableInicio: presupuesto?.fechaProbableInicio,
      fechaInicio: configuracionObra?.fechaInicio
    });

    if (!numeroSemana || numeroSemana < 1) {
      console.warn('⚠️ Número de semana inválido (costos):', numeroSemana);
      return [];
    }

    try {
      // Helper para parsear fechas evitando problemas de zona horaria
      const parsearFechaLocal = (fechaStr) => {
        if (!fechaStr) return null;
        if (typeof fechaStr !== 'string') {
          return fechaStr instanceof Date ? fechaStr : null;
        }
        if (fechaStr.includes('-')) {
          const soloFecha = fechaStr.split('T')[0];
          const [year, month, day] = soloFecha.split('-');
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 7, 0, 0);
        }
        return new Date(fechaStr);
      };

      // 🔥 USAR fechaProbableInicio del presupuesto (reactivo) en lugar de configuracionObra
      const fechaInicioAUsar = presupuesto?.fechaProbableInicio || configuracionObra?.fechaInicio;

      if (!fechaInicioAUsar) {
        console.warn('⚠️ No hay fecha de inicio disponible (costos)');
        return [];
      }

      const fechaInicio = parsearFechaLocal(fechaInicioAUsar);

      if (!fechaInicio || isNaN(fechaInicio.getTime())) {
        console.warn('⚠️ Fecha de inicio inválida (costos):', fechaInicioAUsar);
        return [];
      }

      console.log('📅 [OTROS COSTOS] Calculando semana', numeroSemana, 'con fechaInicio:', fechaInicioAUsar, '(desde presupuesto:', !!presupuesto?.fechaProbableInicio, ')');

      // Encontrar el lunes de la semana de inicio (solo para semana 1)
      const primerLunes = new Date(fechaInicio.getTime());
      const diaSemanaInicio = primerLunes.getDay();
      const diasHastaPrimerLunes = diaSemanaInicio === 0 ? -6 : 1 - diaSemanaInicio;
      primerLunes.setDate(primerLunes.getDate() + diasHastaPrimerLunes);

      if (isNaN(primerLunes.getTime())) {
        console.warn('⚠️ Primer lunes inválido (costos)');
        return [];
      }

      // Para la semana solicitada, calcular su lunes sumando semanas completas (7 días)
      const inicioSemana = new Date(primerLunes.getTime());
      inicioSemana.setDate(primerLunes.getDate() + ((numeroSemana - 1) * 7));

      if (isNaN(inicioSemana.getTime())) {
        console.warn('⚠️ Fecha de inicio de semana inválida (costos)');
        return [];
      }

      // Generar lunes a viernes, filtrando feriados
      const nombresDias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
      const diasHabiles = [];
      for (let i = 0; i < 5; i++) {
        const dia = new Date(inicioSemana.getTime());
        dia.setDate(inicioSemana.getDate() + i);

        if (isNaN(dia.getTime())) {
          console.warn(`⚠️ Día ${i} inválido (costos)`);
          continue;
        }

        // Solo agregar si es día hábil (lun-vie, no feriado)
        if (esDiaHabil(dia)) {
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

      console.log(`💰 Días hábiles calculados para semana ${numeroSemana} (costos):`, diasHabiles);
      return diasHabiles;

    } catch (error) {
      console.error('❌ Error calculando días hábiles de semana (costos):', error);
      return [];
    }
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
          <div className="modal-header bg-warning text-dark">
            <div className="d-flex align-items-center gap-3 flex-grow-1">
              <h5 className="modal-title mb-0">
                <i className="fas fa-dollar-sign me-2"></i>
                Asignar Otros Costos / Gastos Generales - {obra?.nombre}
              </h5>

              {/* 🎯 Badge de Modo de Presupuesto */}
              {modoPresupuesto && (
                <span
                  className={`badge text-white ${
                    modoPresupuesto === 'GLOBAL' ? 'bg-secondary' :
                    modoPresupuesto === 'MIXTO' ? 'bg-warning text-dark' :
                    'bg-info'
                  }`}
                  style={{ fontSize: '0.7em' }}
                  title={
                    modoPresupuesto === 'GLOBAL'
                      ? 'Presupuesto con importe total único - El usuario asigna montos manualmente'
                      : modoPresupuesto === 'MIXTO'
                        ? 'Presupuesto combinado - Tiene importe global + items de detalle'
                        : 'Presupuesto con items individuales - El usuario selecciona de una lista'
                  }
                >
                  {modoPresupuesto === 'GLOBAL' && <><i className="fas fa-globe me-1"></i>Global</>}
                  {modoPresupuesto === 'MIXTO' && <><i className="fas fa-random me-1"></i>Mixto</>}
                  {modoPresupuesto === 'DETALLE' && <><i className="fas fa-list me-1"></i>Detallado</>}
                </span>
              )}
            </div>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
            ></button>
          </div>

          {/* Body - Con key para forzar re-render cuando se recarga */}
          <div className="modal-body" key={`otros-costos-body-${forceUpdate}`}>
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
                {/* 📊 Información del presupuesto según modo */}
                {(modoPresupuesto === 'GLOBAL' || modoPresupuesto === 'MIXTO') && (() => {
                  // ✅ CALCULAR TOTAL ASIGNADO DIRECTAMENTE desde las asignaciones reales
                  const totalAsignado = asignaciones.reduce((sum, asig) => {
                    return sum + (parseFloat(asig.importeAsignado) || 0);
                  }, 0);

                  const porcentajeUtilizado = presupuestoGlobalTotal > 0
                    ? ((totalAsignado / presupuestoGlobalTotal) * 100).toFixed(1)
                    : 0;

                  // 🔍 DEBUG para trabajos extra
                  if (obra._esTrabajoExtra) {
                    console.log('🔍 [UI RESUMEN] Trabajo Extra:', {
                      presupuestoGlobalTotal,
                      totalAsignado,
                      presupuestoGlobalDisponible,
                      asignacionesCount: asignaciones.length,
                      diferencia: presupuestoGlobalTotal - totalAsignado,
                      coincideConDisponible: (presupuestoGlobalTotal - totalAsignado) === presupuestoGlobalDisponible
                    });
                  }

                  // 🆕 Calcular totales de materiales y honorarios cuando presupuesto gastos = $0
                  let totalMateriales = 0;
                  let totalHonorarios = 0;

                  if (presupuestoGlobalTotal === 0 && presupuesto?.itemsCalculadora) {
                    console.log('💰 [INICIO CÁLCULO] Presupuesto completo:', presupuesto);
                    console.log('💰 [INICIO CÁLCULO] Items calculadora:', presupuesto.itemsCalculadora?.length);
                    console.log('💰 [INICIO CÁLCULO] Configuración honorarios:', presupuesto.honorarios);

                    // 1. Calcular bases para honorarios
                    let baseManoObra = 0;
                    let baseMaterialesBruto = 0;
                    let baseProfesionales = 0;

                    presupuesto.itemsCalculadora.forEach((item, index) => {
                      console.log(`\n💰 Item ${index + 1} (${item.tipoProfesional || item.nombreItem}):`, {
                        subtotalManoObra: item.subtotalManoObra,
                        jornales: item.jornales,
                        profesionales: item.profesionales,
                        materialesLista: item.materialesLista?.length,
                        todasLasPropiedades: Object.keys(item),
                        ITEM_COMPLETO: item
                      });

                      // Mano de obra (jornales) - probar múltiples campos posibles
                      let manoObraItem = 0;

                      // Opción 1: subtotalManoObra
                      if (item.subtotalManoObra) {
                        manoObraItem = item.subtotalManoObra;
                        console.log(` ✅ Encontrado en subtotalManoObra: $${manoObraItem}`);
                      }

                      // Opción 2: Array de jornales
                      if (item.jornales && Array.isArray(item.jornales)) {
                        console.log(` 🔍 Analizando array de jornales (${item.jornales.length} items):`, item.jornales);
                        const totalJornales = item.jornales.reduce((sum, j, jIndex) => {
                          console.log(`   Jornal ${jIndex + 1}:`, {
                            cantidad: j.cantidad,
                            importeTotal: j.importeTotal,
                            precioUnitario: j.precioUnitario,
                            importe: j.importe,
                            subtotal: j.subtotal,
                            total: j.total,
                            todasPropiedades: Object.keys(j),
                            JORNAL_COMPLETO: j
                          });
                          const jornalTotal = (j.cantidad || 0) * (j.importeTotal || j.precioUnitario || j.importe || j.subtotal || j.total || 0);
                          console.log(`     Calculado: ${j.cantidad || 0} × ${j.importeTotal || j.precioUnitario || j.importe || j.subtotal || j.total || 0} = $${jornalTotal}`);
                          return sum + jornalTotal;
                        }, 0);
                        if (totalJornales > 0) {
                          manoObraItem = totalJornales;
                          console.log(` ✅ Encontrado en jornales array: $${manoObraItem}`);
                        } else {
                          console.log(` ⚠️ Array de jornales dio total = 0`);
                        }
                      }

                      // Opción 3: total - materiales - gastos
                      if (manoObraItem === 0 && item.total) {
                        const totalMaterialesItem = item.materialesLista ?
                          item.materialesLista.reduce((sum, m) => sum + (m.subtotal || 0), 0) : 0;
                        const totalGastosItem = item.gastosGenerales ?
                          item.gastosGenerales.reduce((sum, g) => sum + (g.importe || g.subtotal || 0), 0) : 0;
                        manoObraItem = item.total - totalMaterialesItem - totalGastosItem;
                        console.log(` ✅ Calculado por diferencia: total=${item.total} - materiales=${totalMaterialesItem} - gastos=${totalGastosItem} = $${manoObraItem}`);
                      }

                      baseManoObra += manoObraItem;
                      console.log(` ➡️ baseManoObra acumulada: $${baseManoObra}`);

                      // Materiales
                      if (item.materialesLista && Array.isArray(item.materialesLista)) {
                        const subtotalMateriales = item.materialesLista.reduce((sum, m) => sum + (m.subtotal || 0), 0);
                        baseMaterialesBruto += subtotalMateriales;
                      }

                      // Profesionales (si existen en el item)
                      if (item.profesionales && Array.isArray(item.profesionales)) {
                        baseProfesionales += item.profesionales.reduce((sum, p) => sum + (p.subtotal || 0), 0);
                      }
                    });

                    console.log('💰 [BASES CALCULADAS]:', {
                      baseManoObra,
                      baseMaterialesBruto,
                      baseProfesionales
                    });

                    // 2. Calcular honorarios según configuración
                    let honorariosJornales = 0;
                    let honorariosMateriales = 0;
                    let honorariosProfesionales = 0;
                    let honorariosOtrosCostos = 0;

                    if (presupuesto.honorarios) {
                      console.log('💰 [HONORARIOS CONFIG] Configuración completa:', JSON.stringify(presupuesto.honorarios, null, 2));

                      // Honorarios sobre jornales
                      console.log('💰 [HONORARIOS JORNALES] Verificando:', {
                        activo: presupuesto.honorarios.jornales?.activo,
                        valor: presupuesto.honorarios.jornales?.valor,
                        tipo: presupuesto.honorarios.jornales?.tipo,
                        baseManoObra
                      });

                      if (presupuesto.honorarios.jornales?.activo && presupuesto.honorarios.jornales?.valor) {
                        const valorHon = Number(presupuesto.honorarios.jornales.valor);
                        if (presupuesto.honorarios.jornales.tipo === 'porcentaje') {
                          honorariosJornales = (baseManoObra * valorHon) / 100;
                        } else {
                          honorariosJornales = valorHon;
                        }
                        console.log('💰 [HONORARIOS JORNALES] Calculado:', honorariosJornales);
                      }

                      // Honorarios sobre materiales
                      console.log('💰 [HONORARIOS MATERIALES] Verificando:', {
                        activo: presupuesto.honorarios.materiales?.activo,
                        valor: presupuesto.honorarios.materiales?.valor,
                        tipo: presupuesto.honorarios.materiales?.tipo,
                        baseMaterialesBruto
                      });

                      if (presupuesto.honorarios.materiales?.activo && presupuesto.honorarios.materiales?.valor) {
                        const valorHon = Number(presupuesto.honorarios.materiales.valor);
                        if (presupuesto.honorarios.materiales.tipo === 'porcentaje') {
                          honorariosMateriales = (baseMaterialesBruto * valorHon) / 100;
                        } else {
                          honorariosMateriales = valorHon;
                        }
                        console.log('💰 [HONORARIOS MATERIALES] Calculado:', honorariosMateriales);
                      }

                      // Honorarios sobre profesionales
                      if (presupuesto.honorarios.profesionales?.activo && presupuesto.honorarios.profesionales?.valor) {
                        const valorHon = Number(presupuesto.honorarios.profesionales.valor);
                        if (presupuesto.honorarios.profesionales.tipo === 'porcentaje') {
                          honorariosProfesionales = (baseProfesionales * valorHon) / 100;
                        } else {
                          honorariosProfesionales = valorHon;
                        }
                      }

                      // Honorarios sobre otros costos (si hay presupuesto global > 0)
                      if (presupuesto.honorarios.otrosCostos?.activo && presupuesto.honorarios.otrosCostos?.valor) {
                        const valorHon = Number(presupuesto.honorarios.otrosCostos.valor);
                        if (presupuesto.honorarios.otrosCostos.tipo === 'porcentaje') {
                          honorariosOtrosCostos = (presupuestoGlobalTotal * valorHon) / 100;
                        } else {
                          honorariosOtrosCostos = valorHon;
                        }
                      }
                    } else {
                      console.warn('⚠️ presupuesto.honorarios NO EXISTE o es null/undefined');
                    }

                    // Total honorarios
                    totalHonorarios = honorariosJornales + honorariosMateriales + honorariosProfesionales + honorariosOtrosCostos;

                    // Total materiales (incluye materiales brutos)
                    totalMateriales = baseMaterialesBruto;

                    console.log('💰 [CÁLCULO FINAL HONORARIOS]:', {
                      honorariosJornales,
                      honorariosMateriales,
                      honorariosProfesionales,
                      honorariosOtrosCostos,
                      totalHonorarios,
                      totalMateriales
                    });
                  }

                  // Determinar qué mostrar según origen de fondos seleccionado
                  let presupuestoMostrar = presupuestoGlobalTotal;
                  let labelPresupuesto = 'Total Presupuestado:';

                  if (presupuestoGlobalTotal === 0 && nuevaAsignacion.origenFondos) {
                    if (nuevaAsignacion.origenFondos === 'RETIRO_DIRECTO') {
                      presupuestoMostrar = totalHonorarios;
                      labelPresupuesto = 'Disponible en Honorarios:';
                    } else if (nuevaAsignacion.origenFondos === 'PRESUPUESTO_MATERIALES') {
                      presupuestoMostrar = totalMateriales;
                      labelPresupuesto = 'Disponible en Materiales:';
                    }
                  }

                  return (
                    <div className="alert alert-primary mb-3 border-0">
                      <div className="row align-items-center">
                        <div className="col-md-6">
                          <h6 className="mb-1">
                            <i className="fas fa-wallet me-2"></i>
                            Resumen de Gastos Generales
                          </h6>
                          <p className="mb-0 text-muted small">
                            {porcentajeUtilizado}% del presupuesto de gastos asignado
                          </p>
                          <div className="progress mt-2" style={{ height: '6px' }}>
                            <div
                              className={`progress-bar ${porcentajeUtilizado >= 100 ? 'bg-danger' : porcentajeUtilizado >= 75 ? 'bg-warning' : 'bg-success'}`}
                              role="progressbar"
                              style={{ width: `${Math.min(porcentajeUtilizado, 100)}%` }}
                              aria-valuenow={porcentajeUtilizado}
                              aria-valuemin="0"
                              aria-valuemax="100"
                            ></div>
                          </div>
                        </div>
                        <div className="col-md-6 text-md-end">
                          <div className="mb-2">
                            <small className="text-muted">{labelPresupuesto}</small>{' '}
                            <strong className="text-primary fs-5">
                              ${presupuestoMostrar.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </strong>
                            {presupuestoGlobalTotal === 0 && nuevaAsignacion.origenFondos && (
                              <span className="badge bg-secondary ms-2" style={{ fontSize: '0.7rem' }}>
                                {nuevaAsignacion.origenFondos === 'RETIRO_DIRECTO' ? '💸 Honorarios' : '🧱 Materiales'}
                              </span>
                            )}
                          </div>
                          <div className="mb-2">
                            <small className="text-muted">Asignado:</small>{' '}
                            <strong className="text-warning fs-5">
                              ${totalAsignado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </strong>
                          </div>
                          <div>
                            <small className="text-muted">Disponible para asignar:</small>{' '}
                            <strong className={`fs-5 ${presupuestoGlobalDisponible <= 0 ? 'text-danger' : 'text-success'}`}>
                              ${presupuestoGlobalDisponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 🆕 Selector de Origen de Fondos - Solo cuando Presupuesto de Gastos = $0 */}
                {presupuestoGlobalTotal === 0 && (
                  <div className="card mb-3 border-warning">
                    <div className="card-header bg-warning text-dark">
                      <h6 className="mb-0">
                        <i className="fas fa-exclamation-triangle me-2"></i>
                        No hay presupuesto asignado para Gastos Generales
                      </h6>
                    </div>
                    <div className="card-body">
                      <p className="mb-3">
                        <i className="fas fa-info-circle me-2 text-primary"></i>
                        Debes seleccionar de dónde se tomarán los fondos para los gastos que registres:
                      </p>
                      <div className="d-flex flex-column gap-3">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="origenFondosGlobal"
                            id="origenRetiroDirectoGlobal"
                            value="RETIRO_DIRECTO"
                            checked={nuevaAsignacion.origenFondos === 'RETIRO_DIRECTO'}
                            onChange={(e) => setNuevaAsignacion({...nuevaAsignacion, origenFondos: e.target.value})}
                          />
                          <label className="form-check-label" htmlFor="origenRetiroDirectoGlobal">
                            <strong className="d-block mb-1">💸 Retiro Directo / Caja Chica</strong>
                            <small className="text-muted">
                              Se registra como gasto extraordinario. No afecta el presupuesto de materiales.
                            </small>
                          </label>
                        </div>
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="origenFondosGlobal"
                            id="origenMaterialesGlobal"
                            value="PRESUPUESTO_MATERIALES"
                            checked={nuevaAsignacion.origenFondos === 'PRESUPUESTO_MATERIALES'}
                            onChange={(e) => setNuevaAsignacion({...nuevaAsignacion, origenFondos: e.target.value})}
                          />
                          <label className="form-check-label" htmlFor="origenMaterialesGlobal">
                            <strong className="d-block mb-1">🧱 Descontar del Presupuesto de Materiales</strong>
                            <small className="text-muted">
                              Se descuenta del dinero destinado a materiales. Reduce el presupuesto disponible para comprar materiales.
                            </small>
                          </label>
                        </div>
                      </div>
                      {/* Mostrar selección actual */}
                      {nuevaAsignacion.origenFondos && (
                        <div className="alert alert-info mt-3 mb-0">
                          <i className="fas fa-check-circle me-2"></i>
                          <strong>Origen seleccionado:</strong> {nuevaAsignacion.origenFondos === 'RETIRO_DIRECTO' ? '💸 Retiro Directo' : '🧱 Presupuesto de Materiales'}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {modoPresupuesto === 'DETALLE' && (
                  <div className="alert alert-info mb-3">
                    <h6 className="mb-1">
                      <i className="fas fa-list-ul me-2"></i>
                      Presupuesto Detallado
                    </h6>
                    <p className="mb-0 text-muted small">
                      Selecciona items específicos de la lista de gastos disponibles del presupuesto
                    </p>
                  </div>
                )}

                {/* Debug info (colapsable) */}
                {debugDeteccionPresupuesto && (
                  <div className="mt-2">
                    <small className="text-muted">
                      <strong>Debug:</strong> fuente={debugDeteccionPresupuesto.fuenteDeteccion || 'N/A'} | detalle={debugDeteccionPresupuesto.itemsDetalle} | global=${Number(debugDeteccionPresupuesto.presupuestoGlobal || 0).toLocaleString('es-AR')} | rubros={debugDeteccionPresupuesto.rubrosDetectados ?? 0}
                       | <button className="btn btn-link btn-sm p-0 text-warning ms-2" onClick={() => {
                          if(confirm('¿Limpiar localStorage temporal de gastos?')) {
                            localStorage.removeItem(`asignaciones_locales_costos_${obra.id}`);
                            cargarAsignacionesActuales();
                            alert('🧹 localStorage temporal limpiado');
                          }
                       }}>🧹 Limpiar Temp</button>
                      {(debugDeteccionPresupuesto.rubrosEjemplo && debugDeteccionPresupuesto.rubrosEjemplo.length > 0)
                        ? ` | ej: ${debugDeteccionPresupuesto.rubrosEjemplo.join(', ')}`
                        : ''}
                    </small>
                  </div>
                )}

                {modoPresupuesto === 'DETALLE' && (
                  <div className="mt-2">
                    <small className="text-muted">
                      💡 <strong>Modo Detalle:</strong> Selecciona gastos específicos del presupuesto para asignar a la obra.
                    </small>
                  </div>
                )}

                {/* Distribución semanal estimada - solo si hay configuración con fechaInicio y semanas calculadas */}
                {configuracionObraActualizada?.fechaInicio && semanas && semanas.length > 0 && (
                  <div className="card mb-3 border-warning">
                    <div className="card-header bg-warning text-dark">
                      <h6 className="mb-0">
                        <i className="fas fa-calendar-alt me-2"></i>
                        Planificación Sugerida - Distribución por Semana
                      </h6>
                      <small className="text-dark">
                        <i className="fas fa-info-circle me-1"></i>
                        Haz clic en cada semana para asignar gastos a días específicos
                      </small>
                    </div>
                    <div className="card-body">
                      <div className="row">
                        {semanas.map((semanaInfo, index) => {
                          const semana = semanaInfo.numeroSemana;
                          const jornalesPorSemana = (configuracionObra.capacidadNecesaria || 0) * 5;
                          const porcentajeSemana = (100 / semanas.length).toFixed(1);

                          // Separar gastos monetarios de elementos físicos
                          const gastosMonetarios = otrosCostosDisponibles.filter(c => !c.esDelStock || c.cantidadDisponible === null);
                          const elementosFisicos = otrosCostosDisponibles.filter(c => c.esDelStock && c.cantidadDisponible !== null);

                          const totalGastosMonetarios = (modoPresupuesto === 'GLOBAL' || modoPresupuesto === 'MIXTO')
                            ? (presupuestoGlobalTotal + gastosMonetarios.reduce((sum, costo) => sum + (parseFloat(costo.importe) || 0), 0))
                            : gastosMonetarios.reduce((sum, costo) => sum + (parseFloat(costo.importe) || 0), 0);

                          const gastoMonetarioSemanal = (totalGastosMonetarios * parseFloat(porcentajeSemana) / 100).toFixed(2);

                          // Calcular elementos físicos por semana
                          const elementosPorSemana = elementosFisicos.map(elem => {
                            const cantidadSemanal = Math.ceil((elem.cantidadDisponible || 0) * parseFloat(porcentajeSemana) / 100);
                            return { nombre: elem.nombre, cantidad: cantidadSemanal };
                          }).filter(e => e.cantidad > 0);

                          return (
                            <div key={semana} className="col-md-6 col-lg-4 mb-2">
                              <div
                                className="border rounded p-3 bg-light hover-card shadow-sm"
                                style={{
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  borderLeft: '4px solid #ffc107'
                                }}
                                onClick={() => abrirDetalleSemana(semana)}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#fff3cd';
                                  e.currentTarget.style.borderColor = '#ffc107';
                                  e.currentTarget.style.borderLeftColor = '#ff9800';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                                  e.currentTarget.style.borderColor = '#dee2e6';
                                  e.currentTarget.style.borderLeftColor = '#ffc107';
                                }}
                              >
                                <div className="d-flex justify-content-between align-items-center">
                                  <strong className="text-warning"><i className="fas fa-calendar-week me-1"></i>Semana {semana}</strong>
                                  <small className="badge bg-info text-white">{porcentajeSemana}%</small>
                                </div>

                                {/* Mostrar elementos físicos si existen */}
                                {elementosPorSemana.length > 0 && (
                                  <small className="text-primary d-block mt-2">
                                    <i className="fas fa-boxes me-1"></i>
                                    <strong>Materiales:</strong>
                                    <div className="ms-3">
                                      {elementosPorSemana.map((elem, idx) => (
                                        <span key={idx} className="d-block">
                                          • {elem.cantidad} {elem.nombre}
                                        </span>
                                      ))}
                                    </div>
                                  </small>
                                )}

                                <div className="mt-2 pt-2 border-top">
                                  <button
                                    className="btn btn-sm btn-warning btn-block w-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      abrirDetalleSemana(semana);
                                    }}
                                  >
                                    <i className="fas fa-edit me-1"></i>
                                    Asignar Gastos para Semana {semana}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="alert alert-light mt-2 mb-0">
                        <small className="text-muted">
                          <i className="fas fa-lightbulb me-1"></i>
                          <strong>Sugerencia:</strong> Los gastos generales se distribuyen proporcionalmente según la duración.
                          Algunos gastos (seguros, alquileres) son constantes, otros (combustible, servicios) varían según la actividad.
                        </small>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mensaje si no hay presupuesto detectable (ni global ni detalle) */}
                {otrosCostosDisponibles.length === 0 && modoPresupuesto !== 'GLOBAL' && modoPresupuesto !== 'MIXTO' && (
                  <div className="alert alert-warning shadow-sm border-0 d-flex align-items-center">
                    <i className="fas fa-exclamation-triangle fs-4 me-3"></i>
                    <div>
                      No se detectaron rubros ni ítems de Gastos Generales en el presupuesto de esta obra.
                      <br />
                      <small>Verifica que el presupuesto no este vacío o que tenga cargada la calculadora de jornales/gastos.</small>
                    </div>
                  </div>
                )}

                {/* Asignación por planificación semanal - se realiza desde las tarjetas de semanas */}

                {/* Lista de asignaciones actuales */}
                {(otrosCostosDisponibles.length > 0 || modoPresupuesto === 'GLOBAL' || modoPresupuesto === 'MIXTO' || asignaciones.length > 0) && (
                  <div className="card shadow-sm border-0">
                    <div className="card-body">
                      {asignaciones.length === 0 ? (
                        <div className="text-center text-muted py-3">
                            <i className="fas fa-info-circle fa-2x mb-2"></i>
                            <p className="mb-0">Aún no hay gastos confirmados</p>
                            {(!configuracionObra || !configuracionObra.semanasObjetivo) && (modoPresupuesto === 'GLOBAL' || modoPresupuesto === 'MIXTO') ? (
                              /* Modo Global sin semanas - mostrar botón directo para agregar gasto */
                              <div className="mt-3">
                                <small className="text-muted d-block mb-2">Asigna gastos manualmente</small>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary"
                                  onClick={() => {
                                    // Resetear formulario completamente
                                    setNuevaAsignacion({
                                      tipoAsignacion: '',
                                      otroCostoId: '',
                                      cantidadAsignada: '',
                                      importeUnitario: '',
                                      importeAsignado: '',
                                      fechaAsignacion: new Date().toISOString().slice(0, 10),
                                      observaciones: '',
                                      esManual: false
                                    });
                                    setNuevoGastoManual({
                                      descripcion: '',
                                      categoria: 'General',
                                      categoriaCustom: '',
                                      cantidadAsignada: '',
                                      importeUnitario: '',
                                      observaciones: ''
                                    });
                                    setMostrarFormularioIndividual(true);
                                  }}
                                >
                                  <i className="fas fa-plus me-1"></i>
                                  Agregar Gasto
                                </button>
                              </div>
                            ) : (
                              /* Modo Detalle o con semanas - usar tarjetas */
                              <small className="text-muted">Usa las tarjetas de arriba para asignar gastos por semana</small>
                            )}
                          </div>
                        ) : (
                          <div className="table-responsive">
                            <table className="table table-hover">
                              <thead>
                                <tr>
                                  <th>Descripción</th>
                                  <th>Categoría</th>
                                  <th>Importe Asignado</th>
                                  <th>Fecha</th>
                                  <th>Observaciones</th>
                                  <th>Origen Fondos</th>
                                  <th>Acciones</th>
                                </tr>
                              </thead>
                              <tbody>
                                {asignaciones.map((asignacion, index) => (
                                  <tr key={asignacion.id || index}>
                                    <td>
                                      <div className="fw-bold">
                                        {asignacion.nombreOtroCosto || asignacion.descripcion || (asignacion.observaciones?.includes('[GASTO MANUAL]')
                                          ? asignacion.observaciones.split('- Rubro:')[0].replace('[GASTO MANUAL]', '').trim()
                                          : 'Gasto General')}
                                      </div>
                                      {asignacion.semana && (
                                        <small className="text-muted">
                                          <i className="fas fa-calendar-week me-1"></i>
                                          Semana {asignacion.semana}
                                        </small>
                                      )}
                                    </td>
                                    <td>
                                      <span className="badge bg-info text-dark">
                                        {asignacion.categoria || (asignacion.observaciones?.includes('Rubro:')
                                          ? asignacion.observaciones.split('Rubro:')[1].split('|')[0].trim()
                                          : 'General')}
                                      </span>
                                    </td>
                                    <td>
                                      <strong className="text-success">
                                        ${Number(asignacion.importeAsignado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                      </strong>
                                    </td>
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
                                      <small className="text-muted" style={{ fontSize: '0.75rem', display: 'block', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace:'nowrap' }} title={asignacion.observaciones}>
                                        {asignacion.observaciones || '-'}
                                      </small>
                                    </td>
                                    <td>
                                      {(() => {
                                        const origen = asignacion.origenFondos;
                                        if (!origen || origen === 'RETIRO_DIRECTO') {
                                          return (
                                            <span className="badge bg-warning text-dark" title="Retiro Directo / Caja Chica">
                                              <i className="fas fa-wallet me-1"></i>
                                              Retiro
                                            </span>
                                          );
                                        } else if (origen === 'PRESUPUESTO_MATERIALES') {
                                          return (
                                            <span className="badge bg-secondary" title="Descontado del Presupuesto de Materiales">
                                              <i className="fas fa-boxes me-1"></i>
                                              Materiales
                                            </span>
                                          );
                                        } else {
                                          return (
                                            <span className="badge bg-light text-dark" title="Presupuesto de Gastos Generales">
                                              <i className="fas fa-clipboard-list me-1"></i>
                                              Presup.
                                            </span>
                                          );
                                        }
                                      })()}
                                    </td>
                                    <td>
                                      <div className="btn-group shadow-sm">
                                        <button
                                          className="btn btn-sm btn-light border"
                                          onClick={() => handleEditarAsignacion(asignacion)}
                                          title="Editar asignación"
                                        >
                                          <i className="fas fa-edit text-primary"></i>
                                        </button>
                                        <button
                                          className="btn btn-sm btn-light border"
                                          onClick={() => handleEliminarAsignacion(asignacion.id)}
                                          title="Eliminar asignación"
                                        >
                                          <i className="fas fa-trash text-danger"></i>
                                        </button>
                                      </div>
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

            {/* Botón de consolidación - siempre visible */}
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

    {/* Modal de Detalle Semanal para Gastos */}
    <DetalleSemanalGastosModal
      show={mostrarDetalleSemana}
      onClose={cerrarDetalleSemana}
      obra={obra}
      numeroSemana={semanaSeleccionada}
      configuracionObra={configuracionObraActualizada}
      gastosGenerales={otrosCostosDisponibles}
      asignaciones={asignaciones}
      onAbrirAsignacionParaDia={abrirAsignacionParaDia}
      onAsignarParaTodaLaSemana={abrirAsignacionSemanal}
    />

    {/* Formulario de Asignación Individual para Costos */}
    {mostrarFormularioIndividual && (
      <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1060}}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header bg-warning text-dark">
              <h6 className="modal-title">
                <i className="fas fa-plus me-2"></i>
                Asignar Gasto General - {nuevaAsignacion.fechaAsignacion}
              </h6>
              <button
                type="button"
                className="btn-close"
                onClick={() => setMostrarFormularioIndividual(false)}
              ></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                {/* 🆕 Selector de Tipo de Asignación */}
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
                        otroCostoId: '',
                        cantidadAsignada: '',
                        importeUnitario: '',
                        importeAsignado: ''
                      });
                    }}
                    required
                  >
                    <option value="">Seleccionar tipo...</option>

                    {/* Opción: Usar Importe Global (siempre disponible si hay presupuesto global) */}
                    {(modoPresupuesto === 'GLOBAL' || modoPresupuesto === 'MIXTO') && presupuestoGlobalDisponible > 0 && (
                      <option value="IMPORTE_GLOBAL">
                        💰 Importe del Presupuesto Global (Disponible: ${presupuestoGlobalDisponible.toLocaleString('es-AR')})
                      </option>
                    )}

                    {/* Opción: Seleccionar Elemento Detallado (si hay gastos disponibles) */}
                    {otrosCostosDisponibles.length > 0 && (
                      <option value="ELEMENTO_DETALLADO">
                        📋 Elemento del Presupuesto Detallado ({otrosCostosDisponibles.length} items disponibles)
                      </option>
                    )}
                  </select>

                  {/* Ayuda según el tipo seleccionado */}
                  {nuevaAsignacion.tipoAsignacion === 'IMPORTE_GLOBAL' && (
                    <small className="text-muted d-block mt-1">
                      <i className="fas fa-info-circle me-1"></i>
                      Asignarás un importe directo del presupuesto global. Debes especificar descripción del gasto.
                    </small>
                  )}
                  {nuevaAsignacion.tipoAsignacion === 'ELEMENTO_DETALLADO' && (
                    <small className="text-muted d-block mt-1">
                      <i className="fas fa-info-circle me-1"></i>
                      Seleccionarás un gasto específico del presupuesto detallado.
                    </small>
                  )}
                </div>

                {/* Mostrar campos según el tipo seleccionado */}
                {nuevaAsignacion.tipoAsignacion === 'IMPORTE_GLOBAL' && (
                  <>
                    <div className="alert alert-success mb-3">
                      <strong>💰 Presupuesto Global Disponible:</strong> ${presupuestoGlobalDisponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </div>

                    <div className="mb-3">
                      <label className="form-label">
                        Descripción del Gasto <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        value={nuevoGastoManual.descripcion}
                        onChange={(e) => setNuevoGastoManual({...nuevoGastoManual, descripcion: e.target.value})}
                        placeholder="Ej: Volquetes, Escaleras, Seguro, etc."
                        required
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Categoría/Rubro</label>
                      <select
                        className="form-select"
                        value={nuevoGastoManual.categoria || 'General'}
                        onChange={(e) => setNuevoGastoManual({
                          ...nuevoGastoManual,
                          categoria: e.target.value,
                          categoriaCustom: e.target.value === '__OTRO__' ? (nuevoGastoManual.categoriaCustom || '') : ''
                        })}
                      >
                        {rubrosParaSelect.map((rubro) => (
                          <option key={rubro} value={rubro}>{rubro}</option>
                        ))}
                        <option value="__OTRO__">Otros (escribir rubro...)</option>
                      </select>
                      {nuevoGastoManual.categoria === '__OTRO__' && (
                        <input
                          type="text"
                          className="form-control mt-2"
                          value={nuevoGastoManual.categoriaCustom || ''}
                          onChange={(e) => setNuevoGastoManual({ ...nuevoGastoManual, categoriaCustom: e.target.value })}
                          placeholder="Escribí el rubro (ej: Logística, Herramientas, Alquileres...)"
                        />
                      )}
                    </div>

                    <div className="mb-3">
                      <label className="form-label">
                        Importe a Asignar <span className="text-danger">*</span>
                      </label>
                      <input
                        type="number"
                        className="form-control"
                        value={nuevaAsignacion.importeAsignado}
                        onChange={(e) => setNuevaAsignacion({...nuevaAsignacion, importeAsignado: e.target.value})}
                        placeholder="Ej: 500000"
                        min="0.01"
                        step="0.01"
                        required
                      />
                      {presupuestoGlobalTotal > 0 && nuevaAsignacion.importeAsignado && parseFloat(nuevaAsignacion.importeAsignado) > presupuestoGlobalDisponible && (
                        <small className="text-danger d-block mt-1">
                          <i className="fas fa-exclamation-triangle me-1"></i>
                          El importe excede el disponible en ${(parseFloat(nuevaAsignacion.importeAsignado) - presupuestoGlobalDisponible).toLocaleString('es-AR')}
                        </small>
                      )}
                    </div>
                  </>
                )}

                {nuevaAsignacion.tipoAsignacion === 'ELEMENTO_DETALLADO' && (
                  <>
                <div className="mb-3">
                  <label className="form-label">Costo/Gasto General</label>
                  <select
                    className="form-select"
                    value={nuevaAsignacion.otroCostoId}
                    onChange={(e) => {
                      console.log('📝 [DEBUG GASTOS] Cambiando costo, fechaAsignacion actual:', nuevaAsignacion.fechaAsignacion);
                      console.log('🔍 [DEBUG] Presupuesto completo:', presupuesto);
                      console.log('🔍 [DEBUG] Honorarios otrosCostos:', presupuesto?.honorarios?.otrosCostos);
                      console.log('🔍 [DEBUG] MayoresCostos otrosCostos:', presupuesto?.mayoresCostos?.otrosCostos);

                      // 🔥 Autocompletar importe unitario con el valor del presupuesto + honorarios + mayores costos
                      const costoSeleccionado = otrosCostosDisponibles.find(c => c.id.toString() === e.target.value);
                      console.log('📦 Costo seleccionado COMPLETO:', costoSeleccionado);
                      console.log('📦 Todos los costos disponibles:', otrosCostosDisponibles);

                      let importeUnitario = 0;
                      if (costoSeleccionado) {
                        const importeBase = Number(costoSeleccionado.importe || 0);
                        importeUnitario = importeBase;
                        console.log('💰 Importe BASE desde costoSeleccionado.importe:', importeBase);

                        // Aplicar honorarios sobre la base
                        if (presupuesto?.honorarios?.otrosCostos?.activo && presupuesto?.honorarios?.otrosCostos?.valor) {
                          const valor = Number(presupuesto.honorarios.otrosCostos.valor);
                          if (presupuesto.honorarios.otrosCostos.tipo === 'porcentaje') {
                            const incrementoHonorarios = (importeBase * valor) / 100;
                            importeUnitario += incrementoHonorarios;
                            console.log(`💵 Aplicando honorarios ${valor}%: +$${incrementoHonorarios.toLocaleString()}`);
                          }
                        } else {
                          console.log('⚠️ No se aplicaron honorarios');
                        }

                        // Aplicar mayores costos sobre la BASE (no sobre base+honorarios)
                        if (presupuesto?.mayoresCostos?.otrosCostos?.activo && presupuesto?.mayoresCostos?.otrosCostos?.valor) {
                          const valor = Number(presupuesto.mayoresCostos.otrosCostos.valor);
                          if (presupuesto.mayoresCostos.otrosCostos.tipo === 'porcentaje') {
                            const incrementoMayoresCostos = (importeBase * valor) / 100;
                            importeUnitario += incrementoMayoresCostos;
                            console.log(`💵 Aplicando mayores costos ${valor}%: +$${incrementoMayoresCostos.toLocaleString()}`);
                          }
                        } else {
                          console.log('⚠️ No se aplicaron mayores costos');
                        }

                        console.log('💰 Importe FINAL calculado:', importeUnitario);
                      }

                      setNuevaAsignacion({
                        ...nuevaAsignacion,
                        otroCostoId: e.target.value,
                        importeUnitario: importeUnitario // 🔥 Auto-llenar importe unitario con fees aplicados
                      });
                    }}
                    required
                  >
                    <option value="">Seleccionar costo...</option>

                    {/* 🆕 Opción para crear nuevo gasto (cuando presupuesto es GLOBAL) */}
                    {modoPresupuesto === 'GLOBAL' && (
                      <option value="CREAR_NUEVO" style={{ fontWeight: 'bold', color: '#28a745', backgroundColor: '#d4edda' }}>
                        ➕ Crear Nuevo Gasto Manual
                      </option>
                    )}

                    {/* ℹ️ Mensaje cuando no hay gastos disponibles (modo GLOBAL) */}
                    {otrosCostosDisponibles.length === 0 && modoPresupuesto === 'GLOBAL' && (
                      <option disabled style={{ color: '#6c757d', fontStyle: 'italic' }}>
                        Sin gastos detallados - Use "Crear Nuevo"
                      </option>
                    )}

                    {(() => {
                      // Agrupar costos por categoría/rubro
                      const costosPorCategoria = {};
                      otrosCostosDisponibles.forEach(costo => {
                        const categoria = costo.categoria || 'Sin categoría';
                        if (!costosPorCategoria[categoria]) {
                          costosPorCategoria[categoria] = [];
                        }
                        costosPorCategoria[categoria].push(costo);
                      });

                      // Colores para cada categoría
                      const coloresCategorias = {
                        'Albañileria': '#8B4513',
                        'Albañilería': '#8B4513',
                        'Pintura': '#4169E1',
                        'Electricidad': '#FFD700',
                        'Plomería': '#20B2AA',
                        'Sin categoría': '#6c757d'
                      };

                      // Renderizar como opciones con separadores de categoría
                      return Object.keys(costosPorCategoria).sort().flatMap(categoria => {
                        const colorCategoria = coloresCategorias[categoria] || '#6c757d';

                        return [
                          // Separador de categoría (deshabilitado, con color)
                          <option
                            key={`sep-${categoria}`}
                            disabled
                            style={{
                              fontWeight: 'bold',
                              backgroundColor: colorCategoria,
                              color: '#fff',
                              padding: '5px'
                            }}
                          >
                            ━━━ {categoria.toUpperCase()} ━━━
                          </option>,
                          // Items de esta categoría
                          ...costosPorCategoria[categoria].map(costo => {
                            const disponibleReal = calcularStockDisponible(costo.id);
                            const estadoReal = getEstadoStockActualizado(costo.id);
                            const stockOriginal = costo.cantidadDisponible || 0;

                            const icono = {
                              'DISPONIBLE': '🟢',
                              'STOCK_BAJO': '🟡',
                              'AGOTADO': '🔴',
                              'SIN_STOCK': '⚪'
                            }[estadoReal];

                            const color = estadoReal === 'AGOTADO' ? '#dc3545' : '#000';

                            const infoStock = disponibleReal !== null && disponibleReal !== stockOriginal
                              ? `${disponibleReal}/${stockOriginal}`
                              : (disponibleReal !== null ? `${disponibleReal}` : stockOriginal);

                            // Calcular importe con honorarios y mayores costos
                            const importeBase = Number(costo.importe || 0);
                            let importeFinal = importeBase;

                            // Aplicar honorarios sobre la base
                            if (presupuesto?.honorarios?.otrosCostos?.activo && presupuesto?.honorarios?.otrosCostos?.valor) {
                              const valor = Number(presupuesto.honorarios.otrosCostos.valor);
                              if (presupuesto.honorarios.otrosCostos.tipo === 'porcentaje') {
                                importeFinal += (importeBase * valor) / 100;
                              }
                            }

                            // Aplicar mayores costos sobre la BASE (no sobre base+honorarios)
                            if (presupuesto?.mayoresCostos?.otrosCostos?.activo && presupuesto?.mayoresCostos?.otrosCostos?.valor) {
                              const valor = Number(presupuesto.mayoresCostos.otrosCostos.valor);
                              if (presupuesto.mayoresCostos.otrosCostos.tipo === 'porcentaje') {
                                importeFinal += (importeBase * valor) / 100;
                              }
                            }

                            return (
                              <option
                                key={costo.id}
                                value={costo.id}
                                disabled={estadoReal === 'AGOTADO'}
                                style={{ color, paddingLeft: '20px' }}
                              >
                                   {icono} {costo.nombre} {
                                  disponibleReal !== null
                                    ? `(${costo.unidadMedida ? infoStock + ' ' + costo.unidadMedida + ' disponibles - ' : ''}$${importeFinal.toLocaleString('es-AR')}/unidad)`
                                    : `($${importeFinal.toLocaleString('es-AR')}/unidad)`
                                }
                              </option>
                            );
                          })
                        ];
                      });
                    })()}
                  </select>
                </div>

                {/* 🆕 Campos adicionales si está creando un gasto nuevo */}
                {nuevaAsignacion.otroCostoId === 'CREAR_NUEVO' && (
                  <>
                    <div className="alert alert-info mb-3 d-flex justify-content-between align-items-center">
                      <div>
                        <small>
                          <i className="fas fa-info-circle me-1"></i>
                          <strong>Crear gasto desde presupuesto global</strong>
                          <br />
                          Disponible: ${presupuestoGlobalDisponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => setMostrarCrearGastoManual(true)}
                        title="Abrir modal avanzado de creación"
                      >
                        <i className="fas fa-cog me-1"></i>
                        Opciones Avanzadas
                      </button>
                    </div>

                    <div className="row mb-3">
                      <div className="col-md-8">
                        <label className="form-label">
                          Descripción del Gasto <span className="text-danger">*</span>
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          value={nuevoGastoManual.descripcion}
                          onChange={(e) => setNuevoGastoManual({...nuevoGastoManual, descripcion: e.target.value})}
                          placeholder="Ej: Volquetes, Escaleras, Seguro, etc."
                          required
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Categoría/Rubro</label>
                        <select
                          className="form-select"
                          value={nuevoGastoManual.categoria || 'General'}
                          onChange={(e) => setNuevoGastoManual({...nuevoGastoManual, categoria: e.target.value})}
                        >
                          <option value="General">General</option>
                          <option value="Equipamiento">Equipamiento</option>
                          <option value="Transporte">Transporte</option>
                          <option value="Servicios">Servicios</option>
                          <option value="Seguridad">Seguridad</option>
                          <option value="Administrativo">Administrativo</option>
                          <option value="Otros">Otros</option>
                        </select>
                      </div>
                    </div>

                    {/* 🆕 Selector de tipo de registro */}
                    <div className="mb-3">
                      <label className="form-label fw-bold">
                        <i className="fas fa-question-circle me-2 text-info"></i>
                        ¿Cómo desea registrar este gasto?
                      </label>
                      <div className="d-flex gap-3">
                        <div className="form-check flex-fill">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="tipoRegistroInline"
                            id="tipoGastoDirecto"
                            value="GASTO_DIRECTO"
                            checked={nuevoGastoManual.tipoRegistro === 'GASTO_DIRECTO'}
                            onChange={(e) => setNuevoGastoManual({...nuevoGastoManual, tipoRegistro: e.target.value})}
                          />
                          <label className="form-check-label" htmlFor="tipoGastoDirecto">
                            <strong>💸 Gasto Directo / Retiro Caja Chica</strong>
                            <br />
                            <small className="text-muted">
                              Se registra como gasto inmediato. No se controla stock.
                              {presupuestoGlobalDisponible > 0 && (
                                <> Se descuenta del presupuesto global disponible.</>
                              )}
                            </small>
                          </label>
                        </div>
                        <div className="form-check flex-fill">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="tipoRegistroInline"
                            id="tipoInventario"
                            value="INVENTARIO"
                            checked={nuevoGastoManual.tipoRegistro === 'INVENTARIO'}
                            onChange={(e) => setNuevoGastoManual({...nuevoGastoManual, tipoRegistro: e.target.value})}
                          />
                          <label className="form-check-label" htmlFor="tipoInventario">
                            <strong>📦 Entrada de Inventario</strong>
                            <br />
                            <small className="text-muted">
                              Se agrega al stock como material. Permite control de cantidades disponibles.
                            </small>
                          </label>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="mb-3">
                  {(() => {
                    // Si está creando nuevo, siempre mostrar campos de cantidad e importe
                    if (nuevaAsignacion.otroCostoId === 'CREAR_NUEVO') {
                      return (
                        <>
                          <div className="row mb-3">
                            <div className="col-md-6">
                              <label className="form-label">
                                Cantidad <span className="text-danger">*</span>
                              </label>
                              <input
                                type="number"
                                className="form-control"
                                value={nuevoGastoManual.cantidadAsignada}
                                onChange={(e) => setNuevoGastoManual({...nuevoGastoManual, cantidadAsignada: e.target.value})}
                                placeholder="Ej: 2"
                                min="0.01"
                                step="0.01"
                                required
                              />
                            </div>
                            <div className="col-md-6">
                              <label className="form-label">
                                Importe Unitario <span className="text-danger">*</span>
                              </label>
                              <input
                                type="number"
                                className="form-control"
                                value={nuevoGastoManual.importeUnitario}
                                onChange={(e) => setNuevoGastoManual({...nuevoGastoManual, importeUnitario: e.target.value})}
                                placeholder="Ej: 1500000"
                                min="0.01"
                                step="0.01"
                                required
                              />
                            </div>
                          </div>

                          {nuevoGastoManual.cantidadAsignada && nuevoGastoManual.importeUnitario && (
                            <div className="alert alert-success mb-3">
                              <div className="d-flex justify-content-between align-items-center">
                                <span><strong>Total del gasto:</strong></span>
                                <strong className="text-success">
                                  ${(parseFloat(nuevoGastoManual.cantidadAsignada) * parseFloat(nuevoGastoManual.importeUnitario)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </strong>
                              </div>
                              {(() => {
                                const totalGasto = parseFloat(nuevoGastoManual.cantidadAsignada) * parseFloat(nuevoGastoManual.importeUnitario);
                                if (presupuestoGlobalTotal > 0 && totalGasto > presupuestoGlobalDisponible) {
                                  return (
                                    <small className="text-danger d-block mt-1">
                                      <i className="fas fa-exclamation-triangle me-1"></i>
                                      Excede el disponible en ${(totalGasto - presupuestoGlobalDisponible).toLocaleString('es-AR')}
                                    </small>
                                  );
                                }
                                return (
                                  <small className="text-muted d-block mt-1">
                                    Disponible restante: ${(presupuestoGlobalDisponible - totalGasto).toLocaleString('es-AR')}
                                  </small>
                                );
                              })()}
                            </div>
                          )}
                        </>
                      );
                    }

                    const costoSeleccionado = otrosCostosDisponibles.find(c => c.id.toString() === nuevaAsignacion.otroCostoId);
                    const esDelStock = costoSeleccionado?.cantidadDisponible !== null;

                    if (esDelStock) {
                      // Modo stock: cantidad + importe unitario
                      return (
                        <>
                          <div className="mb-3">
                            <label className="form-label">
                              Cantidad a Asignar
                              {costoSeleccionado && (
                                <small className="text-muted ms-2">
                                  (Disponibles: {costoSeleccionado.cantidadDisponible})
                                </small>
                              )}
                            </label>
                            <input
                              type="number"
                              className="form-control"
                              value={nuevaAsignacion.cantidadAsignada || ''}
                              onChange={(e) => {
                                const valor = parseInt(e.target.value) || 0;

                                if (costoSeleccionado && valor > costoSeleccionado.cantidadDisponible) {
                                  alert(`⚠️ Cantidad máxima disponible: ${costoSeleccionado.cantidadDisponible}`);
                                  return;
                                }

                                setNuevaAsignacion({
                                  ...nuevaAsignacion,
                                  cantidadAsignada: e.target.value
                                });
                              }}
                              placeholder="Ej: 2"
                              min="1"
                              required
                            />
                          </div>
                          <div className="mb-3">
                            <label className="form-label">
                              Importe Unitario
                              <small className="text-muted ms-2">(por unidad)</small>
                            </label>
                            <input
                              type="number"
                              className="form-control"
                              value={nuevaAsignacion.importeUnitario || ''}
                              onChange={(e) => {
                                setNuevaAsignacion({
                                  ...nuevaAsignacion,
                                  importeUnitario: e.target.value
                                });
                              }}
                              placeholder="Ej: 500000"
                              min="0"
                              step="0.01"
                              required
                            />
                            {nuevaAsignacion.cantidadAsignada && nuevaAsignacion.importeUnitario && (
                              <small className="text-muted">
                                Total: ${(parseInt(nuevaAsignacion.cantidadAsignada) * parseFloat(nuevaAsignacion.importeUnitario)).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                              </small>
                            )}
                          </div>
                        </>
                      );
                    } else {
                      // Modo importe directo
                      return (
                        <div className="mb-3">
                          <label className="form-label">Importe a Asignar</label>
                          <input
                            type="number"
                            className="form-control"
                            value={nuevaAsignacion.importeAsignado || ''}
                            onChange={(e) => {
                              setNuevaAsignacion({
                                ...nuevaAsignacion,
                                importeAsignado: e.target.value
                              });
                            }}
                            placeholder="Ingrese el importe"
                            min="0"
                            step="0.01"
                            required
                          />
                        </div>
                      );
                    }
                  })()}
                </div>
                </>
                )}

                {/* Campos comunes para ambos tipos */}
                {nuevaAsignacion.tipoAsignacion && (
                  <>
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
                  <button type="submit" className="btn btn-warning text-dark" disabled={loading}>
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Asignando...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-check me-2"></i>
                        Asignar Costo
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
                </>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Modal de Asignación Semanal Completa para Costos */}
    {mostrarAsignacionSemanal && semanaAsignacionCompleta && (() => {
      console.log('🔍 [DEBUG MODAL SEMANAL] Renderizando con valores DETALLADOS:', {
        presupuestoGlobalDisponible,
        presupuestoGlobalTotal,
        modoPresupuesto,
        asignacionesLength: asignaciones.length,
        asignaciones: asignaciones.map(a => ({
          id: a.id,
          descripcion: a.descripcion,
          importeAsignado: a.importeAsignado,
          categoria: a.categoria,
          esDesdePresupuesto: a.esDesdePresupuesto
        })),
        obra: obra ? { id: obra.id, nombre: obra.nombre, _esTrabajoExtra: obra._esTrabajoExtra } : null
      });
      return (
        <AsignarOtroCostoSemanalModal
          show={mostrarAsignacionSemanal}
          onClose={() => setMostrarAsignacionSemanal(false)}
          obra={obra}
          numeroSemana={semanaAsignacionCompleta}
          diasSemana={calcularDiasHabilesSemana(semanaAsignacionCompleta)}
          otrosCostosDisponibles={otrosCostosDisponibles}
          rubrosParaSelect={rubrosParaSelect}
          presupuestoGlobalDisponible={presupuestoGlobalDisponible}
          presupuestoGlobalTotal={presupuestoGlobalTotal}
          totalHonorarios={totalHonorarios}
          totalMateriales={totalMateriales}
          modoPresupuesto={modoPresupuesto}
          rubroInicial={rubroSeleccionado}
          onConfirmarAsignacion={handleAsignacionSemanalCompleta}
        />
      );
    })()}

    {/* 🆕 Modal para Crear Gasto Manual (Modo Global) */}
    {mostrarCrearGastoManual && (
      <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1060}}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header bg-success text-white">
              <h6 className="modal-title">
                <i className="fas fa-plus me-2"></i>
                Crear Gasto Manual
              </h6>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={() => {
                  setMostrarCrearGastoManual(false);
                  setNuevoGastoManual({
                    descripcion: '',
                    categoria: 'General',
                    categoriaCustom: '',
                    cantidadAsignada: '',
                    importeUnitario: '',
                    observaciones: '',
                    tipoRegistro: 'GASTO_DIRECTO'
                  });
                }}
              ></button>
            </div>
            <div className="modal-body">
              <div className="alert alert-info mb-3">
                <small>
                  <i className="fas fa-info-circle me-1"></i>
                  Crea un gasto usando el presupuesto global disponible.
                  <br />
                  <strong>Disponible: ${presupuestoGlobalDisponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                </small>
              </div>

              <div className="mb-3">
                <label className="form-label">
                  Descripción del Gasto <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={nuevoGastoManual.descripcion}
                  onChange={(e) => setNuevoGastoManual({...nuevoGastoManual, descripcion: e.target.value})}
                  placeholder="Ej: Volquete, Seguro, Alquiler, etc."
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Categoría/Rubro</label>
                <select
                  className="form-select"
                  value={nuevoGastoManual.categoria || 'General'}
                  onChange={(e) => setNuevoGastoManual({
                    ...nuevoGastoManual,
                    categoria: e.target.value,
                    categoriaCustom: e.target.value === '__OTRO__' ? (nuevoGastoManual.categoriaCustom || '') : ''
                  })}
                >
                  {rubrosParaSelect.map((rubro) => (
                    <option key={rubro} value={rubro}>{rubro}</option>
                  ))}
                  <option value="__OTRO__">Otros (escribir rubro...)</option>
                </select>
                {nuevoGastoManual.categoria === '__OTRO__' && (
                  <input
                    type="text"
                    className="form-control mt-2"
                    value={nuevoGastoManual.categoriaCustom || ''}
                    onChange={(e) => setNuevoGastoManual({ ...nuevoGastoManual, categoriaCustom: e.target.value })}
                    placeholder="Escribí el rubro (ej: Logística, Herramientas, Alquileres...)"
                  />
                )}
              </div>

              {/* 🆕 Selector de tipo de registro */}
              <div className="mb-3">
                <label className="form-label fw-bold">
                  <i className="fas fa-question-circle me-2 text-info"></i>
                  ¿Cómo desea registrar este gasto?
                </label>
                <div className="d-flex flex-column gap-2">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="tipoRegistroModal"
                      id="tipoGastoDirectoModal"
                      value="GASTO_DIRECTO"
                      checked={nuevoGastoManual.tipoRegistro === 'GASTO_DIRECTO'}
                      onChange={(e) => setNuevoGastoManual({...nuevoGastoManual, tipoRegistro: e.target.value})}
                    />
                    <label className="form-check-label" htmlFor="tipoGastoDirectoModal">
                      <strong>💸 Gasto Directo / Retiro Caja Chica</strong>
                      <br />
                      <small className="text-muted">
                        Se registra como gasto inmediato. No se controla stock.
                        {presupuestoGlobalDisponible > 0 && (
                          <> Se descuenta del presupuesto global disponible.</>
                        )}
                      </small>
                    </label>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="tipoRegistroModal"
                      id="tipoInventarioModal"
                      value="INVENTARIO"
                      checked={nuevoGastoManual.tipoRegistro === 'INVENTARIO'}
                      onChange={(e) => setNuevoGastoManual({...nuevoGastoManual, tipoRegistro: e.target.value})}
                    />
                    <label className="form-check-label" htmlFor="tipoInventarioModal">
                      <strong>📦 Entrada de Inventario</strong>
                      <br />
                      <small className="text-muted">
                        Se agrega al stock como material. Permite control de cantidades disponibles.
                      </small>
                    </label>
                  </div>
                </div>
              </div>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">
                    Cantidad <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    value={nuevoGastoManual.cantidadAsignada}
                    onChange={(e) => setNuevoGastoManual({...nuevoGastoManual, cantidadAsignada: e.target.value})}
                    placeholder="Ej: 2"
                    min="0.01"
                    step="0.01"
                  />
                </div>

                <div className="col-md-6 mb-3">
                  <label className="form-label">
                    Importe Unitario <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    value={nuevoGastoManual.importeUnitario}
                    onChange={(e) => setNuevoGastoManual({...nuevoGastoManual, importeUnitario: e.target.value})}
                    placeholder="Ej: 1500000"
                    min="0.01"
                    step="0.01"
                  />
                </div>
              </div>

              {nuevoGastoManual.cantidadAsignada && nuevoGastoManual.importeUnitario && (
                <div className="alert alert-success mb-3">
                  <strong>Total del gasto:</strong> ${(parseFloat(nuevoGastoManual.cantidadAsignada) * parseFloat(nuevoGastoManual.importeUnitario)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </div>
              )}

              <div className="mb-3">
                <label className="form-label">Observaciones (opcional)</label>
                <textarea
                  className="form-control"
                  value={nuevoGastoManual.observaciones}
                  onChange={(e) => setNuevoGastoManual({...nuevoGastoManual, observaciones: e.target.value})}
                  rows="2"
                  placeholder="Notas adicionales..."
                ></textarea>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setMostrarCrearGastoManual(false);
                  setNuevoGastoManual({
                    descripcion: '',
                    categoria: 'General',
                    categoriaCustom: '',
                    cantidadAsignada: '',
                    importeUnitario: '',
                    observaciones: ''
                  });
                }}
              >
                Cancelar
              </button>
              <button
                className="btn btn-success"
                onClick={() => handleCrearGastoManual(true)}
              >
                <i className="fas fa-check me-1"></i>
                Crear y Seleccionar
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* 🆕 Modal de Edición de Asignación */}
    {mostrarModalEdicion && asignacionEnEdicion && (
      <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1100 }}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content shadow-lg border-0">
            <div className="modal-header bg-primary text-white">
              <h6 className="modal-title">
                <i className="fas fa-edit me-2"></i>
                Editar Asignación de Gasto
              </h6>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={() => setMostrarModalEdicion(false)}
              ></button>
            </div>
            <div className="modal-body p-4">
              <div className="mb-3">
                <label className="form-label fw-bold">Descripción</label>
                <input
                  type="text"
                  className="form-control"
                  value={asignacionEnEdicion.descripcion || ''}
                  onChange={(e) => setAsignacionEnEdicion({...asignacionEnEdicion, descripcion: e.target.value})}
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold">Categoría/Rubro</label>
                <select
                  className="form-select"
                  value={asignacionEnEdicion.categoria || 'General'}
                  onChange={(e) => setAsignacionEnEdicion({...asignacionEnEdicion, categoria: e.target.value})}
                >
                  {rubrosParaSelect.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label fw-bold">Importe Asignado ($)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={asignacionEnEdicion.importeAsignado || ''}
                    onChange={(e) => setAsignacionEnEdicion({...asignacionEnEdicion, importeAsignado: e.target.value})}
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label fw-bold">Cantidad</label>
                  <input
                    type="number"
                    className="form-control"
                    value={asignacionEnEdicion.cantidadAsignada || ''}
                    onChange={(e) => setAsignacionEnEdicion({...asignacionEnEdicion, cantidadAsignada: e.target.value})}
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold">Observaciones</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={asignacionEnEdicion.observaciones || ''}
                  onChange={(e) => setAsignacionEnEdicion({...asignacionEnEdicion, observaciones: e.target.value})}
                ></textarea>
              </div>
            </div>
            <div className="modal-footer bg-light">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setMostrarModalEdicion(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary px-4"
                onClick={handleActualizarAsignacion}
                disabled={loading}
              >
                {loading ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default AsignarOtroCostoObraModal;
