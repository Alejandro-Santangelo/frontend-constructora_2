import React, { useState, useEffect, useMemo } from 'react';
import { useEmpresa } from '../EmpresaContext';
import DetalleSemanalMaterialesModal from './DetalleSemanalMaterialesModal';
import AsignarMaterialSemanalModal from './AsignarMaterialSemanalModal';
import api from '../services/api';
import { calcularSemanasParaDiasHabiles, esDiaHabil } from '../utils/feriadosArgentina';
import { obtenerMateriales, crearMaterial, obtenerOCrearMaterial } from '../services/catalogoMaterialesService';

/**
 * Modal para asignar MATERIALES del presupuestoNoCliente a una obra específica
 * Organiza la asignación por rubros y semanas para facilitar la planificación
 * ⚠️ IMPORTANTE: Este modal es SOLO para MATERIALES, no para Gastos Generales
 */
const AsignarMaterialObraModal = ({ show, onClose, obra, onAsignacionExitosa, configuracionObra = null }) => {
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
  const [materialesDisponibles, setOtrosCostosDisponibles] = useState([]);
  const [materialesCatalogo, setMaterialesCatalogo] = useState([]); // 🆕 Materiales de la BD
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
    unidad: 'unidades',
    cantidadAsignada: '',
    importeUnitario: '',
    observaciones: ''
  });

  // Formulario de nueva asignación
  const [nuevaAsignacion, setNuevaAsignacion] = useState({
    tipoAsignacion: '', // 'IMPORTE_GLOBAL' o 'ELEMENTO_DETALLADO'
    materialId: '', // ID del costo del presupuesto o 'MANUAL_' + timestamp
    cantidadAsignada: '',
    importeUnitario: '', // 🔥 NUEVO: importe por unidad
    importeAsignado: '',
    fechaAsignacion: '', // Inicializar vacío, se configura al abrir modal
    observaciones: '',
    esManual: false // 🆕 Flag para gastos creados manualmente
  });

  // 🆕 Estados para edición de asignación existente
  const [asignacionEnEdicion, setAsignacionEnEdicion] = useState(null);
  const [mostrarModalEdicion, setMostrarModalEdicion] = useState(false);

  // Calcular stock disponible real (descontando asignaciones)
  const calcularStockDisponible = (costoId) => {
    // Sumar todas las cantidades asignadas de este costo desde BD
    const totalAsignado = asignaciones
      .filter(a => a.materialId === costoId)
      .reduce((sum, a) => sum + (parseFloat(a.cantidadAsignada) || 0), 0);

    // Encontrar el costo original
    const costoOriginal = materialesDisponibles.find(c => c.id === costoId);
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

  // ✅ Helper para obtener el ID REAL de la obra
  const getObraId = () => {
    if (!obra) return null;
    console.log('📋 Usando ID de la obra:', obra.id);
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
      // Incrementar forceUpdate ANTES de cargar para forzar re-render
      setForceUpdate(prev => prev + 1);
      // Carga secuencial: primero presupuesto, luego asignaciones con los datos cargados
      cargarPresupuestoObra().then((presupuestoCargado) => {
        if (presupuestoCargado) {
          cargarAsignacionesActuales(presupuestoCargado);
        } else {
          cargarAsignacionesActuales();
        }
      });
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

  // 🆕 Cargar materiales del catálogo de la BD
  useEffect(() => {
    const cargarMaterialesCatalogo = async () => {
      if (show && empresaSeleccionada?.id) {
        try {
          console.log('📦 Cargando materiales del catálogo...');
          const materiales = await obtenerMateriales(empresaSeleccionada.id);
          setMaterialesCatalogo(materiales || []);
          console.log(`✅ ${materiales?.length || 0} materiales cargados del catálogo`);
        } catch (error) {
          console.error('❌ Error cargando materiales del catálogo:', error);
          setMaterialesCatalogo([]);
        }
      }
    };
    cargarMaterialesCatalogo();
  }, [show, empresaSeleccionada?.id]);

  // 🆕 useEffect para recalcular disponible del presupuesto global cuando cambian asignaciones
  useEffect(() => {
    if (modoPresupuesto === 'GLOBAL' && presupuestoGlobalTotal > 0) {
      const totalAsignado = asignaciones.reduce((sum, asig) => {
        return sum + (parseFloat(asig.importeAsignado) || 0);
      }, 0);

      const disponibleRestante = presupuestoGlobalTotal - totalAsignado;
      setPresupuestoGlobalDisponible(Math.max(0, disponibleRestante));

      console.log(`🔄 Recalculando disponible - Total: $${presupuestoGlobalTotal.toLocaleString('es-AR')}, Asignado: $${totalAsignado.toLocaleString('es-AR')}, Disponible: $${disponibleRestante.toLocaleString('es-AR')}`);
    }
  }, [asignaciones, modoPresupuesto, presupuestoGlobalTotal]);

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

  // Función para asignar otros costos a obra (usando formato original que funcionaba)
  const asignarOtroCostoAObra = async (obraId, empresaId, datos) => {
    const esManual = Boolean(datos.esManual);

    const payload = {
      obraId: parseInt(obraId),
      importeAsignado: parseFloat(datos.importeAsignado),
      semana: datos.semana ? Number(datos.semana) : null,
      fechaAsignacion: datos.fechaAsignacion || null,
      esGlobal: Boolean(datos.esGlobal),
      observaciones: datos.observaciones || null
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
          console.log('OBJETO COMPLETO RAW DEL BACKEND:', JSON.stringify(presupuestoActual, null, 2));

          // 🔍 VERIFICAR ITEMS CALCULADORA CON GASTOS GENERALES
          if (presupuestoActual.itemsCalculadora && presupuestoActual.itemsCalculadora.length > 0) {
            console.log('═══════════════════════════════════════');
            console.log('📋 ITEMS CALCULADORA DETALLADOS');
            console.log('═══════════════════════════════════════');
            presupuestoActual.itemsCalculadora.forEach((item, idx) => {
              console.log(`\n${idx + 1}. ITEM: ${item.tipoProfesional}`);
              console.log(`   ├─ Total item: $${item.total?.toLocaleString('es-AR')}`);
              console.log(`   ├─ Subtotal materiales: $${item.subtotalMateriales?.toLocaleString('es-AR')}`);

              if (item.materialesLista && item.materialesLista.length > 0) {
                console.log(`   ├─ Materiales (${item.materialesLista.length}):`);
                item.materialesLista.forEach((material, gIdx) => {
                  console.log(`   │  ${gIdx + 1}. ${material.descripcion}`);
                  console.log(`   │     ├─ cantidad: ${material.cantidad}`);
                  console.log(`   │     ├─ precioUnitario: $${material.precioUnitario?.toLocaleString('es-AR')}`);
                  console.log(`   │     ├─ subtotal: $${material.subtotal?.toLocaleString('es-AR')}`);
                  console.log(`   │     ├─ importe: $${material.importe?.toLocaleString('es-AR')}`);
                  console.log(`   │     └─ Cálculo: ${material.cantidad} × $${material.precioUnitario?.toLocaleString('es-AR')} = $${(material.cantidad * material.precioUnitario)?.toLocaleString('es-AR')}`);
                });
              } else {
                console.log(`   └─ Sin materiales`);
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
        // ✅ OBRA REGULAR: Buscar presupuesto viculado a esta obra
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
      console.log('💰 CALCULANDO PRESUPUESTO GLOBAL - Suma de todos los materiales');
      console.log('═══════════════════════════════════════');

      let presupuestoGlobal = 0;
      let totalGastosEncontrados = 0;

      if (presupuestoActual.itemsCalculadora && Array.isArray(presupuestoActual.itemsCalculadora)) {
        presupuestoActual.itemsCalculadora.forEach((rubro) => {
          // 🔥 VALIDACIÓN CRÍTICA: Si es trabajo extra, ignorar items de otra obra
          if (obra._esTrabajoExtra && rubro.presupuestoId && rubro.presupuestoId !== presupuestoActual.id) {
            console.warn('⏭️ Omitiendo rubro de otro presupuesto (obra principal) en cálculo de global:', {
              rubroPresupuestoId: rubro.presupuestoId,
              trabajoExtraId: presupuestoActual.id,
              rubroTipo: rubro.tipoProfesional
            });
            return; // Saltar este rubro
          }

          console.log(`\nRUBRO: ${rubro.tipoProfesional}`);

          if (rubro.materialesLista && Array.isArray(rubro.materialesLista)) {
            rubro.materialesLista.forEach((material) => {
              const importe = Number(material.importe || material.subtotal || 0);
              presupuestoGlobal += importe;
              totalGastosEncontrados++;
              console.log(`  ├─ ${material.descripcion}: $${importe.toLocaleString('es-AR')}`);
            });
          }
        });
      }

      console.log(`\n✅ TOTAL CALCULADO: $${presupuestoGlobal.toLocaleString('es-AR')} (${totalGastosEncontrados} items)`);
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
        itemsCalculadora: presupuestoActual.itemsCalculadora || []
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

          // También extraer de sus materiales internos si existen
          if (it.materialesLista && Array.isArray(it.materialesLista)) {
            extraerRubrosDeArray(it.materialesLista);
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

      // 🚨 CAMBIO CRÍTICO: Este modal es SOLO para MATERIALES
      // IGNORAR completamente otrosCostos (gastos generales)
      // SOLO procesar materialesLista de cada rubro en itemsCalculadora

      gastosDisponibles = [];
      modoDetectado = null;
      presupuestoGlobal = 0;

      // Extraer SOLO MATERIALES desde itemsCalculadora
      if (presupuestoActual.itemsCalculadora && Array.isArray(presupuestoActual.itemsCalculadora) && presupuestoActual.itemsCalculadora.length > 0) {
        console.log('📋 EXTRAYENDO MATERIALES DESDE itemsCalculadora...');

        presupuestoActual.itemsCalculadora.forEach((item, itemIdx) => {
          if (!item.materialesLista || !Array.isArray(item.materialesLista)) {
            console.log(`⏭️ Item ${itemIdx + 1} (${item.tipoProfesional}) - Sin materiales`);
            return;
          }

          console.log(`✅ Item ${itemIdx + 1} (${item.tipoProfesional}) - ${item.materialesLista.length} materiales`);

          // Agregar cada material como disponible
          item.materialesLista.forEach((material, matIdx) => {
            gastosDisponibles.push({
              id: `mat_${itemIdx}_${matIdx}`,
              nombre: material.descripcion || 'Sin descripción',
              descripcion: material.descripcion || 'Sin descripción',
              categoria: material.categoria || item.tipoProfesional || 'Materiales',
              cantidad: material.cantidad || 1,
              cantidadDisponible: material.cantidad || 1,
              precioUnitario: material.precioUnitario || 0,
              importe: material.subtotal || material.importe || 0,
              subtotal: material.subtotal || material.importe || 0,
              esDelStock: false, // Los materiales del presupuesto no son del stock
              esDesdePresupuesto: true,
              rubroOrigen: item.tipoProfesional,
              itemIdx: itemIdx,
              materialIdx: matIdx
            });
          });
        });

        console.log(`✅ Total de MATERIALES extraídos: ${gastosDisponibles.length}`);
        if (gastosDisponibles.length > 0) {
          modoDetectado = 'DETALLE';
        }
      }

      // Si no hay materiales, mostrar modo global vacío
      if (!modoDetectado) {
        console.log('📦 No se encontraron materiales, usando modo GLOBAL');
        modoDetectado = 'GLOBAL';
        gastosDisponibles = [];

        // Calcular presupuesto global total del presupuesto
        if (presupuestoActual.montoTotal) {
          presupuestoGlobal = presupuestoActual.montoTotal;
        } else if (presupuestoActual.total) {
          presupuestoGlobal = presupuestoActual.total;
        }
      }

      // 💸 CARGAR GASTOS GENERALES CON ORIGEN PRESUPUESTO_MATERIALES
      // Estos gastos deben aparecer como materiales porque se cargan al presupuesto de materiales
      try {
        console.log('💸💸💸 INICIANDO CARGA DE GASTOS PARA MATERIALES 💸💸💸');
        console.log('💸 Obra ID:', obra.id);
        console.log('💸 Empresa ID:', empresaSeleccionada.id);
        console.log('💸 URL completa:', `/api/obras/${obra.id}/otros-costos`);

        // api.get() retorna directamente los datos (response.data ya extraído)
        const gastosData = await api.get(`/api/obras/${obra.id}/otros-costos`, {}, {
          headers: { empresaId: empresaSeleccionada.id }
        });

        console.log('💸 Datos recibidos:', gastosData);
        console.log('💸 Tipo de datos:', Array.isArray(gastosData) ? 'Array' : typeof gastosData);
        console.log('💸 Cantidad total de gastos:', Array.isArray(gastosData) ? gastosData.length : 0);

        if (gastosData && Array.isArray(gastosData)) {
          // Mostrar TODOS los gastos con sus origenFondos
          console.log('💸 === ANÁLISIS DE TODOS LOS GASTOS ===');
          gastosData.forEach((g, idx) => {
            console.log(`💸 Gasto ${idx + 1}: ID=${g.id}, descripcion="${g.descripcion}", origenFondos="${g.origenFondos || 'null'}"`);
          });

          const gastosParaMateriales = gastosData.filter(g => {
            const coincide = g.origenFondos === 'PRESUPUESTO_MATERIALES';
            console.log(`💸 Evaluando gasto ID ${g.id}: origenFondos="${g.origenFondos}" -> ${coincide ? '✅ INCLUIR' : '❌ OMITIR'}`);
            return coincide;
          });

          console.log(`💸 ========================================`);
          console.log(`💸 RESULTADO: ${gastosParaMateriales.length} gastos con PRESUPUESTO_MATERIALES`);
          console.log('💸 Gastos filtrados:', gastosParaMateriales);
          console.log(`💸 ========================================`);

          // Agregar cada gasto como un "material" disponible
          gastosParaMateriales.forEach((gasto, idx) => {
            const gastoMaterial = {
              id: `gasto_${gasto.id}`,
              nombre: `💸 ${gasto.descripcion || 'Gasto sin descripción'}`,
              descripcion: gasto.descripcion || 'Gasto sin descripción',
              categoria: gasto.rubro || 'Gastos Generales',
              cantidad: 1,
              cantidadDisponible: null, // No tiene stock físico
              precioUnitario: gasto.importe || 0,
              importe: gasto.importe || 0,
              subtotal: gasto.importe || 0,
              esDelStock: false,
              esDesdePresupuesto: false,
              esGastoGeneral: true, // Flag para identificarlo
              gastoOriginalId: gasto.id,
              rubroOrigen: 'Gastos Generales',
              observaciones: `Gasto General cargado a Presupuesto de Materiales`
            };
            console.log('💸 Agregando gasto como material:', gastoMaterial);
            gastosDisponibles.push(gastoMaterial);
          });

          if (gastosParaMateriales.length > 0) {
            console.log(`✅ ${gastosParaMateriales.length} gastos agregados como materiales`);
            console.log('✅ gastosDisponibles ACTUALIZADOS:', gastosDisponibles.length, 'items');
            // Si hay gastos, forzar modo DETALLE
            if (!modoDetectado || modoDetectado === 'GLOBAL') {
              modoDetectado = 'DETALLE';
              console.log('✅ Modo cambiado a DETALLE por gastos cargados');
            }
          }
        }
      } catch (errorGastos) {
        console.error('❌ Error cargando gastos para materiales:', errorGastos);
        // No bloqueamos la carga si falla esto
      }

      const modoFinal = modoDetectado || 'GLOBAL';
      setModoPresupuesto(modoFinal);

      setDebugDeteccionPresupuesto({
        modoFinal,
        fuenteDeteccion: 'materialesLista desde itemsCalculadora',
        presupuestoGlobal,
        itemsDetalle: gastosDisponibles.length,
        rubrosDetectados: rubrosMap.size
      });

      // ✅ En MODO GLOBAL, asegurar lista vacía; en DETALLE, usar los materiales encontrados
      if (modoFinal === 'GLOBAL') {
        setOtrosCostosDisponibles([]);
        console.log('🌍 MODO GLOBAL - Sin materiales detallados');
      } else {
        setOtrosCostosDisponibles(gastosDisponibles);
        console.log(`✅ MODO DETALLE - ${gastosDisponibles.length} materiales disponibles (incluye gastos)`);
      }

      setPresupuestoGlobalTotal(presupuestoGlobal);
      setPresupuestoGlobalDisponible(presupuestoGlobal);

      // Rubros sugeridos desde el presupuesto vinculado
      setRubrosPresupuesto(Array.from(rubrosMap.values()).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })));

      console.log('✅ Presupuesto cargado - SOLO MATERIALES');
      console.log('🏁🏁🏁 FIN CARGA DE PRESUPUESTO 🏁🏁🏁');
      return presupuestoActual;
    } catch (error) {
      console.error('❌ Error cargando presupuesto:', error);
      setError(error.message);
      return null;
    } finally {
      setLoadingPresupuesto(false);
    }
  };

  // 🆕 Función auxiliar para extraer asignaciones desde trabajo extra (SOLO MATERIALES)
  const extraerAsignacionesDesdeTrabajoExtra = (trabajoExtra) => {
    console.log('📦 [CORRECCIÓN ARQUITECTURAL] Procesando MATERIALES de trabajo extra...');

    // ═══════════════════════════════════════════════════════════════════
    // 🛑 CORRECCIÓN CRÍTICA: ARQUITECTURA PRESUPUESTO vs ASIGNACIONES
    // ═══════════════════════════════════════════════════════════════════

    console.log('🔍 ANÁLISIS ARQUITECTURAL DE MATERIALES:');
    console.log('📋 itemsCalculadora[].materialesLista = PRESUPUESTO (disponible para asignar)');
    console.log('📅 Asignaciones reales = materiales asignados a fechas/semanas específicas');
    console.log('');

    if (trabajoExtra?.itemsCalculadora && Array.isArray(trabajoExtra.itemsCalculadora)) {
      console.log('📊 PRESUPUESTO DE MATERIALES ENCONTRADO:');

      trabajoExtra.itemsCalculadora.forEach((item, itemIdx) => {
        if (item.materialesLista && Array.isArray(item.materialesLista) && item.materialesLista.length > 0) {
          console.log(`  ├─ Item ${itemIdx + 1}: "${item.tipoProfesional}"`);

          item.materialesLista.forEach((material, materialIdx) => {
            const subtotal = material.subtotal || material.importe || (material.cantidad * material.precio) || 0;
            console.log(`  │   └─ Material ${materialIdx + 1}: "${material.nombre || material.descripcion}" - $${Number(subtotal).toLocaleString('es-AR')}`);
          });
        }
      });
    }

    console.log('');
    console.log('✅ DECISIÓN: Devolver array vacío hasta que se hagan asignaciones reales');
    console.log('💡 Esto permitirá que "Asignado: $0" y "Disponible: ${presupuesto total}"');
    console.log('📝 Las asignaciones reales se crearán cuando el usuario asigne materiales a fechas específicas');
    console.log('');

    // Retornar array vacío - las asignaciones reales se crearán posteriormente
    return [];
  };

  const cargarAsignacionesActuales = async (presupuestoCargado = null) => {
    try {
      console.log('🔍 Cargando asignaciones actuales de materiales (TODOS LOS TIPOS DE OBRA)...');

      // ════════════════════════════════════════════════════════════
      // LÓGICA UNIFICADA: Cargar asignaciones guardadas EN BD
      // ════════════════════════════════════════════════════════════
      console.log('📦 Cargando asignaciones guardadas en BD (endpoint unificado)');

      const obraIdParaCargar = getObraId();
      let asignacionesDesdebd = [];

      try {
        // 🔥 Usar el nuevo servicio de API
        const data = await api.obras.getMateriales(obraIdParaCargar, empresaSeleccionada.id);
        console.log('✅ Materiales cargados desde BD:', data);

        // Convertir formato BD a formato UI
        asignacionesDesdebd = Array.isArray(data) ? data.map((mat, idx) => ({
          id: `asign_${mat.id || idx}`,
          materialObraId: mat.id, // ID de la asignación en BD
          descripcion: mat.descripcion || mat.nombreMaterial,
          nombreOtroCosto: mat.descripcion || mat.nombreMaterial,
          categoria: mat.categoria || mat.unidadMedida || 'Materiales',
          importeAsignado: mat.totalCalculado || (mat.cantidadAsignada * mat.precioUnitario),
          cantidadAsignada: mat.cantidadAsignada,
          importeUnitario: mat.precioUnitario || 0,
          unidadMedida: mat.unidadMedida,
          fechaAsignacion: mat.fechaAsignacion || null,
          semana: mat.semana,
          observaciones: mat.observaciones,
          esManual: mat.esGlobal
        })) : [];

        console.log(`✅ ${asignacionesDesdebd.length} materiales convertidos al formato UI`);
      } catch (error) {
        console.error('⚠️ Error cargando materiales desde BD:', error);
        asignacionesDesdebd = [];
      }

      // 💸 CARGAR GASTOS GENERALES ASIGNADOS CON ORIGEN PRESUPUESTO_MATERIALES
      // Estos gastos deben mostrarse en la tabla como si fueran materiales asignados
      try {
        console.log('💸 Cargando gastos asignados con origenFondos=PRESUPUESTO_MATERIALES...');
        const gastosData = await api.get(`/api/obras/${obraIdParaCargar}/otros-costos`, {}, {
          headers: { empresaId: empresaSeleccionada.id }
        });

        if (gastosData && Array.isArray(gastosData)) {
          const gastosAsignadosAMateriales = gastosData.filter(g =>
            g.origenFondos === 'PRESUPUESTO_MATERIALES'
          );

          console.log(`💸 Encontrados ${gastosAsignadosAMateriales.length} gastos asignados a materiales`);

          // Convertir gastos a formato de asignación para mostrar en tabla
          const gastosComoAsignaciones = gastosAsignadosAMateriales.map((gasto, idx) => {
            console.log(`💸 [MAPEO] Gasto ${idx + 1}:`, gasto);
            console.log(`💸 [MAPEO] - descripcion: "${gasto.descripcion}"`);
            console.log(`💸 [MAPEO] - importe: ${gasto.importe}`);
            console.log(`💸 [MAPEO] - importeAsignado: ${gasto.importeAsignado}`);
            console.log(`💸 [MAPEO] - monto: ${gasto.monto}`);
            console.log(`💸 [MAPEO] - semana: ${gasto.semana}`);
            console.log(`💸 [MAPEO] - Todas las propiedades:`, Object.keys(gasto));

            const importeFinal = gasto.importe || gasto.importeAsignado || gasto.monto || 0;
            console.log(`💸 [MAPEO] - Importe final seleccionado: ${importeFinal}`);

            return {
              id: `asign_gasto_${gasto.id}`,
              descripcion: gasto.descripcion,
              nombreOtroCosto: gasto.descripcion,
              categoria: gasto.rubro || 'Gastos Generales',
              importeAsignado: importeFinal,
              cantidadAsignada: 1,
              importeUnitario: importeFinal,
              fechaAsignacion: null,
              semana: gasto.semana || null,
              observaciones: gasto.observaciones || 'Gasto General cargado a Materiales',
              esManual: true,
              esGastoGeneral: true,
              gastoOriginalId: gasto.id
            };
          });

          // Combinar materiales + gastos
          asignacionesDesdebd = [...asignacionesDesdebd, ...gastosComoAsignaciones];
          console.log(`✅ Total de asignaciones (materiales + gastos): ${asignacionesDesdebd.length}`);
        }
      } catch (errorGastos) {
        console.warn('⚠️ Error cargando gastos asignados:', errorGastos);
      }

      setAsignaciones(asignacionesDesdebd);
      console.log(`✅ ${asignacionesDesdebd.length} asignaciones mostradas en tabla (incluye gastos)`);

      // Calcular disponible del presupuesto global si está en ese modo
      if (modoPresupuesto === 'GLOBAL' || modoPresupuesto === 'MIXTO') {
        const totalAsignado = asignacionesDesdebd.reduce((sum, asig) => {
          return sum + (parseFloat(asig.importeAsignado) || 0);
        }, 0);

        const disponibleRestante = presupuestoGlobalTotal - totalAsignado;
        setPresupuestoGlobalDisponible(Math.max(0, disponibleRestante));

        console.log(`💰 Presupuesto Global - Total: $${presupuestoGlobalTotal.toLocaleString('es-AR')}, Asignado: $${totalAsignado.toLocaleString('es-AR')}, Disponible: $${disponibleRestante.toLocaleString('es-AR')}`);
      } else {
        console.warn('⚠️ Modo presupuesto: ' + modoPresupuesto);
      }
    } catch (error) {
      console.error('❌ Error cargando asignaciones:', error);
      console.error('  Nota: Si es la primera vez, esto es normal (sin asignaciones previas)');
      setAsignaciones([]);
    }
  };

  const handleAsignarCosto = async () => {
    console.log('🚀 [DEBUG MATERIALES] Iniciando handleAsignarCosto');
    console.log('📊 [DEBUG MATERIALES] Estado completo nuevaAsignacion:', nuevaAsignacion);
    console.log('📅 [DEBUG MATERIALES] Fecha que se va a procesar:', nuevaAsignacion.fechaAsignacion);

    // � LÓGICA UNIFICADA PARA TODOS LOS TIPOS DE OBRA
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

      if (!nuevoGastoManual.descripcion.trim()) {
        alert('⚠️ Debe ingresar el nombre del material');
        return;
      }

      const cantidad = parseFloat(nuevoGastoManual.cantidadAsignada) || 0;
      const importeUnitarioGlobal = parseFloat(nuevoGastoManual.importeUnitario) || 0;
      const importeAsignado = cantidad * importeUnitarioGlobal;

      if (cantidad <= 0) {
        alert('⚠️ Debe ingresar una cantidad mayor a cero');
        return;
      }

      if (importeUnitarioGlobal <= 0) {
        alert('⚠️ Debe ingresar el precio unitario');
        return;
      }

      if (importeAsignado > presupuestoGlobalDisponible) {
        alert(`⚠️ El total ($${importeAsignado.toLocaleString('es-AR')}) excede el disponible ($${presupuestoGlobalDisponible.toLocaleString('es-AR')})`);
        return;
      }

      // Crear material manual
      const categoriaFinal = obtenerRubroFinal();
      const gastoManual = {
        nombre: nuevoGastoManual.descripcion,
        descripcion: nuevoGastoManual.descripcion,
        categoria: categoriaFinal,
        unidad: nuevoGastoManual.unidad || 'unidades',
        cantidadDisponible: cantidad,
        precioUnitario: importeUnitarioGlobal,
        importe: importeAsignado,
        esDelStock: false,
        esManual: true
      };

      // Asignar como si fuera un elemento seleccionado
      setNuevaAsignacion({
        ...nuevaAsignacion,
        materialId: gastoManual.id,
        cantidadAsignada: cantidad.toString(),
        importeUnitario: importeUnitarioGlobal.toString(),
        importeAsignado: importeAsignado.toString(),
        esManual: true
      });

      // Continuar con el flujo normal usando el gasto manual creado
      setOtrosCostosDisponibles(prev => [...prev, gastoManual]);
      setGastosCreados(prev => [...prev, gastoManual]);

      console.log('✅ Gasto manual creado desde IMPORTE_GLOBAL:', gastoManual);
    }

    // ✅ CASO 2: Si está creando un gasto nuevo desde ELEMENTO_DETALLADO
    if (nuevaAsignacion.materialId === 'CREAR_NUEVO') {
      const gastoCreado = handleCrearGastoManual(false);
      if (!gastoCreado) {
        return; // handleCrearGastoManual ya mostró el error
      }
      // Continuar con la asignación usando el gasto recién creado
      // El estado ya fue actualizado en handleCrearGastoManual
    }

    if (!nuevaAsignacion.materialId || nuevaAsignacion.materialId === 'CREAR_NUEVO') {
      alert('Por favor complete los datos del gasto');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 🔥 Buscar el material seleccionado en el catálogo
      const materialCatalogo = materialesCatalogo.find(
        m => m.id.toString() === nuevaAsignacion.materialId
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

      // Obtener cantidad e importe unitario
      const cantidad = parseFloat(nuevaAsignacion.cantidadAsignada) || 0;
      const importeUnitario = parseFloat(nuevaAsignacion.importeUnitario) || 0;

      if (cantidad <= 0) {
        alert('⚠️ Debe ingresar una cantidad válida');
        setLoading(false);
        return;
      }

      if (importeUnitario <= 0) {
        alert('⚠️ Debe ingresar un precio unitario válido');
        setLoading(false);
        return;
      }

      // 🔥 Preparar payload según especificación del backend
      const payload = {
        obraId: obra.id,
        materialCatalogoId: materialCatalogo ? parseInt(materialCatalogo.id) : null,
        descripcion: materialCatalogo?.nombre || nuevoGastoManual.descripcion || '',
        unidadMedida: materialCatalogo?.unidadMedida || nuevoGastoManual.unidad || 'unidades',
        precioUnitario: importeUnitario,
        cantidadAsignada: cantidad,
        semana: numeroSemana,
        esGlobal: true, // Siempre true para materiales del catálogo
        observaciones: nuevaAsignacion.observaciones || null
      };

      console.log('📤 Payload para asignar material:', payload);
      console.log('🏗️ Obra ID:', obra.id);
      console.log('🏢 Empresa ID:', empresaSeleccionada.id);

      // 🔥 Llamar al nuevo endpoint de materiales
      const resultado = await api.obras.asignarMaterial(obra.id, payload, empresaSeleccionada.id);
      console.log('✅ Material asignado exitosamente:', resultado);

      alert('✅ Material asignado correctamente');

      // Limpiar formulario completamente
      setNuevaAsignacion({
        materialId: '',
        cantidadAsignada: '',
        importeUnitario: '',
        importeAsignado: '',
        fechaAsignacion: '',
        observaciones: '',
        tipoAsignacion: ''
      });

      setNuevoGastoManual({
        descripcion: '',
        categoria: 'General',
        categoriaCustom: '',
        unidad: 'unidades',
        cantidadAsignada: '',
        importeUnitario: '',
        observaciones: ''
      });

      // Recargar asignaciones
      await cargarAsignacionesActuales();

      if (onAsignacionExitosa) {
        onAsignacionExitosa();
      }

      // Cerrar formulario tras éxito
      setMostrarFormularioIndividual(false);

    } catch (error) {
      console.error('❌ Error asignando material:', error);
      alert(`Error al asignar material: ${error.message}\n\nLos datos NO fueron guardados. Verifique la conexión con el backend.`);
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

    // Validar que no exceda el disponible
    if (importeTotal > presupuestoGlobalDisponible) {
      alert(`⚠️ El importe ($${importeTotal.toLocaleString('es-AR')}) excede el disponible ($${presupuestoGlobalDisponible.toLocaleString('es-AR')})`);
      return;
    }

    try {
      // 🔥 Verificar/crear material en catálogo de BD
      console.log('📝 Verificando/creando material en catálogo de BD...');
      const materialCatalogo = await obtenerOCrearMaterial(
        nuevoGastoManual.descripcion,
        nuevoGastoManual.unidad || 'unidades',
        importeUnitario,
        empresaSeleccionada.id
      );
      console.log('✅ Material en catálogo de BD:', materialCatalogo);

      // Crear gasto manual con el ID del catálogo
      const categoriaFinal = obtenerRubroFinal();
      const gastoManual = {
        id: materialCatalogo.id, // ID del catálogo de BD
        nombre: materialCatalogo.nombre,
        descripcion: materialCatalogo.descripcion || materialCatalogo.nombre,
        categoria: categoriaFinal,
        unidadMedida: materialCatalogo.unidadMedida,
        cantidadDisponible: cantidad,
        precioUnitario: materialCatalogo.precioUnitario,
        importe: importeTotal,
        esDelStock: false,
        esManual: true
      };

      // Agregar a la lista de gastos disponibles
      setOtrosCostosDisponibles(prev => [...prev, gastoManual]);
      setGastosCreados(prev => [...prev, gastoManual]);

      // Actualizar catálogo local para que aparezca en el dropdown
      setMaterialesCatalogo(prev => {
        // Verificar si ya existe en el catálogo local
        const existe = prev.some(m => m.id === materialCatalogo.id);
        if (existe) {
          return prev; // Ya existe, no duplicar
        }
        return [...prev, materialCatalogo]; // Agregar al catálogo local
      });

      // Pre-seleccionar el gasto recién creado en el formulario
      setNuevaAsignacion({
        ...nuevaAsignacion,
        materialId: gastoManual.id.toString(),
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
        unidad: 'unidades',
        cantidadAsignada: '',
        importeUnitario: '',
        observaciones: ''
      });

      // Cerrar modal si se llama desde allí
      if (cerrarModal) {
        setMostrarCrearGastoManual(false);
      }

      console.log('✅ Material creado/obtenido del catálogo y agregado a disponibles:', gastoManual);
      console.log(`💰 Disponible actualizado: $${presupuestoGlobalDisponible.toLocaleString('es-AR')} → Se asignará $${importeTotal.toLocaleString('es-AR')}`);

      return gastoManual;
    } catch (error) {
      console.error('❌ Error creando/obteniendo material del catálogo:', error);
      alert(`❌ Error al guardar el material: ${error.message}`);
      return null;
    }
  };

  // Nueva función: manejar asignaciones semanales múltiples de costos
  const handleAsignacionSemanalCompleta = async (asignacionesSemana) => {
    console.log('📋 [INICIO HANDLER] handleAsignacionSemanalCompleta EJECUTADO');
    console.log('📥 Recibido:', asignacionesSemana);
    console.log('📊 Modo presupuesto:', modoPresupuesto);

    if (!asignacionesSemana || asignacionesSemana.length === 0) {
      console.log('⚠️ No hay asignaciones de materiales para procesar');
      return;
    }

    // � LÓGICA UNIFICADA PARA TODOS LOS TIPOS DE OBRA
    setLoading(true);
    setError(null);

    try {
      console.log('💰 Procesando asignaciones semanales de materiales:', asignacionesSemana);

      const resultados = [];
      let conteoExitosas = 0;

      for (const asignacion of asignacionesSemana) {
        try {
          console.log(`📋 Asignando material para semana ${asignacion.numeroSemana}: ${asignacion.nombreMaterial}`);

          // 🔑 Payload según especificación del backend
          // 🔥 CONVERTIR TODOS A TIPOS CORRECTOS
          let payload = {
            obraId: Number(obra.id),
            cantidadAsignada: Number(asignacion.cantidad) || 0,
            semana: Number(asignacion.numeroSemana),
            esGlobal: Boolean(modoPresupuesto === 'GLOBAL' || asignacion.esManual),
            descripcion: String(asignacion.nombreMaterial || ''),
            unidadMedida: String(asignacion.unidadMedida || ''),
            precioUnitario: Number(asignacion.precioUnitario) || 0,
            observaciones: String(asignacion.observaciones || '')
          };

          // 🔥 SOLO enviar presupuestoMaterialId si es MODO DETALLADO Y tiene ID válido
          if (modoPresupuesto !== 'GLOBAL' && asignacion.materialId && !String(asignacion.materialId).startsWith('MANUAL')) {
            const presupuestoMaterialIdNum = Number(asignacion.materialId);
            if (!isNaN(presupuestoMaterialIdNum)) {
              payload.presupuestoMaterialId = presupuestoMaterialIdNum;
            }
          }

          console.log('📦 Payload para guardar:', payload);

          const obraIdParaBulk = getObraId();
          // 🔥 ENDPOINT CORRECTO para asignaciones de materiales
          const endpoint = `/api/obras/${obraIdParaBulk}/materiales`;
          console.log('📡 POST endpoint:', endpoint);

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'empresaId': empresaSeleccionada.id.toString(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            const data = await response.json();
            conteoExitosas++;
            resultados.push({
              semana: asignacion.numeroSemana,
              material: asignacion.nombreMaterial,
              cantidad: asignacion.cantidad,
              resultado: data
            });
            console.log(`✅ Material asignado para semana ${asignacion.numeroSemana}:`, data);
          } else {
            const errorText = await response.text();
            console.error(`❌ Backend error ${response.status}: ${errorText}`);
          }
        } catch (innerError) {
          console.error(`❌ Error asignando material para semana ${asignacion.numeroSemana}:`, innerError);
        }
      }

      console.log(`✅ Resultado: ${conteoExitosas}/${asignacionesSemana.length} materiales asignados`);

      if (conteoExitosas > 0) {
        alert(`✅ Se asignaron ${conteoExitosas} material(es) para la semana ${asignacionesSemana[0]?.numeroSemana}`);

        // Recargar asignaciones desde BD
        await cargarAsignacionesActuales();

        // Cerrar modal
        setMostrarAsignacionSemanal(false);

        if (onAsignacionExitosa) {
          onAsignacionExitosa();
        }
      } else {
        alert(`⚠️ No se pudo guardar ningún material para la semana ${asignacionesSemana[0]?.numeroSemana}`);
      }

    } catch (error) {
      console.error('❌ Error en asignaciones semanales:', error);
      setError(error.message);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarAsignacion = async (asignacionId) => {
    if (!confirm('¿Está seguro de eliminar esta asignación?')) {
      return;
    }

    try {
      setLoading(true);

      // � LÓGICA UNIFICADA PARA TODOS LOS TIPOS DE OBRA

      // 1. Eliminar de localStorage temporal si existe
      const locKey = `asignaciones_locales_costos_${obra.id}`;
      const currentLocales = JSON.parse(localStorage.getItem(locKey) || '[]');
      const filtered = currentLocales.filter(a => a.id.toString() !== asignacionId.toString());
      localStorage.setItem(locKey, JSON.stringify(filtered));

      // 2. Eliminar de BD usando endpoint unificado
      const obraIdParaDelete = getObraId();

      const endpoint = `/api/obras/${obraIdParaDelete}/materiales/${asignacionId}`;
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

  const handleEditarAsignacion = (asignacion) => {
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

      // � LÓGICA UNIFICADA: Usar endpoint de materiales para todos los tipos de obra
      const obraIdParaUpdate = getObraId();
      const endpoint = `/api/obras/${obraIdParaUpdate}/materiales/${asignacionEnEdicion.id}`;

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
    // Auto-detectar tipo de asignacion segun el contexto disponible
    const tieneGlobal = (modoPresupuesto === 'GLOBAL' || modoPresupuesto === 'MIXTO') && presupuestoGlobalDisponible > 0;
    const tieneDetalle = materialesDisponibles.length > 0;

    let tipoAuto = '';
    let materialAuto = '';
    let importeAuto = '';

    if (tieneDetalle && !tieneGlobal) {
      // Solo opcion detallada: preseleccionarla
      tipoAuto = 'ELEMENTO_DETALLADO';
      // Si solo hay 1 material, preseleccionarlo tambien
      if (materialesDisponibles.length === 1) {
        const mat = materialesDisponibles[0];
        materialAuto = mat.id ? mat.id.toString() : '';
        importeAuto = String(mat.importe || mat.precioUnitario || '');
      }
    } else if (tieneGlobal && !tieneDetalle) {
      // Solo opcion global: preseleccionarla
      tipoAuto = 'IMPORTE_GLOBAL';
    }
    // Si hay ambas opciones, dejar tipoAuto vacio para que el usuario elija

    setNuevaAsignacion({
      tipoAsignacion: tipoAuto,
      materialId: materialAuto,
      cantidadAsignada: '',
      importeUnitario: importeAuto,
      importeAsignado: importeAuto,
      fechaAsignacion: fechaStr,
      observaciones: '',
      esManual: false
    });
    setNuevoGastoManual({
      descripcion: '',
      categoria: 'General',
      categoriaCustom: '',
      unidad: 'unidades',
      cantidadAsignada: '',
      importeUnitario: '',
      observaciones: ''
    });
    setMostrarDetalleSemana(false); // Cerrar detalle semanal
    setMostrarFormularioIndividual(true); // Abrir formulario individual
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
          <div className="modal-header bg-success text-dark">
            <div className="d-flex align-items-center gap-3 flex-grow-1">
              <h5 className="modal-title mb-0">
                <i className="fas fa-boxes me-2"></i>
                Asignar Materiales - {obra?.nombre}
              </h5>

              {/* 🎯 Badge de Modo de Presupuesto */}
              {modoPresupuesto && (
                <span
                  className={`badge text-white ${
                    modoPresupuesto === 'GLOBAL' ? 'bg-secondary' :
                    modoPresupuesto === 'MIXTO' ? 'bg-success text-dark' :
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
                {(modoPresupuesto === 'GLOBAL' || modoPresupuesto === 'MIXTO') && (
                  <div className="alert alert-success mb-3">
                    <div className="row align-items-center">
                      <div className="col-md-6">
                        <h6 className="mb-1">
                          <i className="fas fa-wallet me-2"></i>
                          Presupuesto Disponible
                        </h6>
                        <p className="mb-0 text-muted small">
                          {modoPresupuesto === 'GLOBAL'
                            ? 'Asigna montos libremente dentro del presupuesto total'
                            : 'Combina presupuesto global + items específicos'}
                        </p>
                      </div>
                      <div className="col-md-6 text-md-end">
                        <div className="mb-1">
                          <small className="text-muted">Total Presupuestado:</small>{' '}
                          <strong className="text-primary fs-5">
                            ${presupuestoGlobalTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
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

                {/* 📦 Resumen de Materiales Disponibles (NUEVO) */}
                {modoPresupuesto === 'DETALLE' && materialesDisponibles.length > 0 && (() => {
                  // TOTAL DISPONIBLE: Solo materiales del presupuesto (SIN gastos generales)
                  const totalMaterialesDisponibles = materialesDisponibles.reduce((sum, m) => {
                    // Excluir gastos del total disponible
                    if (m.esGastoGeneral) return sum;
                    const importe = extraerImporteItem(m);
                    return sum + importe;
                  }, 0);

                  console.log('💰 [RESUMEN MATERIALES] Calculando totales...');
                  console.log('💰 asignaciones completas:', asignaciones);
                  console.log('💰 Cantidad de asignaciones:', asignaciones.length);

                  // TOTAL ASIGNADO: Materiales + gastos (todo lo asignado)
                  const totalMaterialesAsignados = asignaciones.reduce((sum, asig, idx) => {
                    const importe = parseFloat(asig.importeAsignado) || 0;
                    console.log(`💰 Asignación ${idx + 1}: ${asig.descripcion || asig.nombreOtroCosto} = $${importe.toLocaleString('es-AR')}${asig.esGastoGeneral ? ' (GASTO)' : ''}`);
                    return sum + importe;
                  }, 0);

                  console.log('💰 TOTAL DISPONIBLE (solo materiales):', totalMaterialesDisponibles.toLocaleString('es-AR'));
                  console.log('💰 TOTAL ASIGNADO (materiales + gastos):', totalMaterialesAsignados.toLocaleString('es-AR'));

                  const materialesdisponibleRestante = Math.max(0, totalMaterialesDisponibles - totalMaterialesAsignados);
                  const porcentajeUtilizado = totalMaterialesDisponibles > 0
                    ? ((totalMaterialesAsignados / totalMaterialesDisponibles) * 100).toFixed(1)
                    : 0;

                  return (
                    <div className="alert alert-primary mb-3 border-0">
                      <div className="row align-items-center">
                        <div className="col-md-6">
                          <h6 className="mb-1">
                            <i className="fas fa-boxes me-2"></i>
                            Resumen de Materiales
                          </h6>
                          <p className="mb-0 text-muted small">
                            {porcentajeUtilizado}% del presupuesto de materiales asignado
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
                            <small className="text-muted">Total de Materiales:</small>{' '}
                            <strong className="text-primary fs-5">
                              ${totalMaterialesDisponibles.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </strong>
                          </div>
                          <div className="mb-2">
                            <small className="text-muted">Asignado:</small>{' '}
                            <strong className="text-warning fs-5">
                              ${totalMaterialesAsignados.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </strong>
                          </div>
                          <div>
                            <small className="text-muted">Disponible:</small>{' '}
                            <strong className={`fs-5 ${materialesdisponibleRestante <= 0 ? 'text-danger' : 'text-success'}`}>
                              ${materialesdisponibleRestante.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

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
                    <div className="card-header bg-success text-dark">
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
                          const gastosMonetarios = materialesDisponibles.filter(c => !c.esDelStock || c.cantidadDisponible === null);
                          const elementosFisicos = materialesDisponibles.filter(c => c.esDelStock && c.cantidadDisponible !== null);

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
                                    Asignar Materiales para Semana {semana}
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
                          <strong>Sugerencia:</strong> Los materiales se distribuyen proporcionalmente según el avance de la obra.
                          Algunos materiales se usan al inicio (cimentación), otros durante el proyecto (estructuras), y otros al final (terminaciones).
                        </small>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mensaje si no hay presupuesto detectable (ni global ni detalle) */}
                {materialesDisponibles.length === 0 && modoPresupuesto !== 'GLOBAL' && modoPresupuesto !== 'MIXTO' && (
                  <div className="alert alert-warning shadow-sm border-0 d-flex align-items-center">
                    <i className="fas fa-exclamation-triangle fs-4 me-3"></i>
                    <div>
                      No se detectaron rubros ni ítems de Materiales en el presupuesto de esta obra.
                      <br />
                      <small>Verifica que el presupuesto no esté vacío o que tenga cargados los materiales.</small>
                    </div>
                  </div>
                )}

                {/* Asignación por planificación semanal - se realiza desde las tarjetas de semanas */}

                {/* Lista de asignaciones actuales */}
                {(materialesDisponibles.length > 0 || modoPresupuesto === 'GLOBAL' || modoPresupuesto === 'MIXTO' || asignaciones.length > 0) && (
                  <div className="card shadow-sm border-0">
                    <div className="card-body">
                      {asignaciones.length === 0 ? (
                        <div className="text-center text-muted py-3">
                            <i className="fas fa-info-circle fa-2x mb-2"></i>
                            <p className="mb-0">Aún no hay materiales confirmados</p>
                            {(!configuracionObra || !configuracionObra.semanasObjetivo) && (modoPresupuesto === 'GLOBAL' || modoPresupuesto === 'MIXTO') ? (
                              /* Modo Global sin semanas - mostrar botón directo para agregar gasto */
                              <div className="mt-3">
                                <small className="text-muted d-block mb-2">Asigna materiales manualmente</small>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary"
                                  onClick={() => {
                                    // Resetear formulario - modo GLOBAL preseleccionado
                                    setNuevaAsignacion({
                                      tipoAsignacion: 'IMPORTE_GLOBAL',
                                      materialId: '',
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
                                      unidad: 'unidades',
                                      cantidadAsignada: '',
                                      importeUnitario: '',
                                      observaciones: ''
                                    });
                                    setMostrarFormularioIndividual(true);
                                  }}
                                >
                                  <i className="fas fa-plus me-1"></i>
                                  Agregar Material
                                </button>
                              </div>
                            ) : (
                              /* Modo Detalle o con semanas - usar tarjetas */
                              <small className="text-muted">Usa las tarjetas de arriba para asignar materiales por semana</small>
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
                                      <span className={`badge ${asignacion.esGastoGeneral ? 'bg-warning text-dark' : 'bg-info text-dark'}`}>
                                        {asignacion.esGastoGeneral && '💸 '}
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
                                      <small className="text-muted" style={{ fontSize: '0.75rem', display: 'block', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={asignacion.observaciones}>
                                        {asignacion.observaciones || '-'}
                                      </small>
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
    <DetalleSemanalMaterialesModal
      show={mostrarDetalleSemana}
      onClose={cerrarDetalleSemana}
      obra={obra}
      numeroSemana={semanaSeleccionada}
      configuracionObra={configuracionObraActualizada}
      materialesAsociados={materialesDisponibles}
      asignaciones={asignaciones}
      onAbrirAsignacionParaDia={abrirAsignacionParaDia}
      onAsignarParaTodaLaSemana={abrirAsignacionSemanal}
    />

    {/* Formulario de Asignación Individual para Costos */}
    {mostrarFormularioIndividual && (
      <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1060}}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header bg-success text-dark">
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
                {/* Selector de Tipo de Asignación - solo visible cuando hay ambas opciones */}
                {((modoPresupuesto === 'GLOBAL' || modoPresupuesto === 'MIXTO') && presupuestoGlobalDisponible > 0 && materialesDisponibles.length > 0) && (
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
                    {materialesDisponibles.length > 0 && (
                      <option value="ELEMENTO_DETALLADO">
                        📋 Elemento del Presupuesto Detallado ({materialesDisponibles.length} items disponibles)
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
                )}

                {/* Mostrar campos según el tipo seleccionado */}
                {nuevaAsignacion.tipoAsignacion === 'IMPORTE_GLOBAL' && (
                  <>
                    <div className="alert alert-success mb-2 py-2">
                      <strong>Presupuesto disponible:</strong> ${presupuestoGlobalDisponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </div>

                    {/* Nombre del material */}
                    <div className="mb-3">
                      <label className="form-label">
                        Material <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        value={nuevoGastoManual.descripcion}
                        onChange={(e) => setNuevoGastoManual({...nuevoGastoManual, descripcion: e.target.value})}
                        placeholder="Ej: Cemento, Arena, Hierro, Ladrillos..."
                        required
                      />
                    </div>

                    {/* Unidad y Cantidad en la misma fila */}
                    <div className="row g-2 mb-3">
                      <div className="col-5">
                        <label className="form-label">Unidad <span className="text-danger">*</span></label>
                        <select
                          className="form-select"
                          value={nuevoGastoManual.unidad || 'unidades'}
                          onChange={(e) => setNuevoGastoManual({...nuevoGastoManual, unidad: e.target.value})}
                        >
                          <option value="unidades">Unidades</option>
                          <option value="bolsas">Bolsas</option>
                          <option value="kg">Kilogramos (kg)</option>
                          <option value="tn">Toneladas (tn)</option>
                          <option value="m3">Metros cúbicos (m³)</option>
                          <option value="m2">Metros cuadrados (m²)</option>
                          <option value="ml">Metros lineales (ml)</option>
                          <option value="lts">Litros (lts)</option>
                          <option value="barras">Barras</option>
                          <option value="chapas">Chapas</option>
                          <option value="rollos">Rollos</option>
                          <option value="caños">Caños</option>
                          <option value="tablas">Tablas</option>
                          <option value="otro">Otro</option>
                        </select>
                      </div>
                      <div className="col-7">
                        <label className="form-label">Cantidad <span className="text-danger">*</span></label>
                        <input
                          type="number"
                          className="form-control"
                          value={nuevoGastoManual.cantidadAsignada}
                          onChange={(e) => setNuevoGastoManual({...nuevoGastoManual, cantidadAsignada: e.target.value})}
                          placeholder="Ej: 50"
                          min="0.01"
                          step="0.01"
                          required
                        />
                      </div>
                    </div>

                    {/* Precio unitario */}
                    <div className="mb-3">
                      <label className="form-label">
                        Precio unitario <span className="text-danger">*</span>
                      </label>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input
                          type="number"
                          className="form-control"
                          value={nuevoGastoManual.importeUnitario}
                          onChange={(e) => setNuevoGastoManual({...nuevoGastoManual, importeUnitario: e.target.value})}
                          placeholder="Ej: 2500"
                          min="0"
                          step="0.01"
                          required
                        />
                        <span className="input-group-text">/ {nuevoGastoManual.unidad || 'unidad'}</span>
                      </div>
                    </div>

                    {/* Total calculado */}
                    {nuevoGastoManual.cantidadAsignada && nuevoGastoManual.importeUnitario && (() => {
                      const total = (parseFloat(nuevoGastoManual.cantidadAsignada) || 0) * (parseFloat(nuevoGastoManual.importeUnitario) || 0);
                      const excede = total > presupuestoGlobalDisponible;
                      return total > 0 ? (
                        <div className={`alert ${excede ? 'alert-danger' : 'alert-info'} py-2 mb-3`}>
                          <strong>Total: ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                          {excede && (
                            <span className="d-block small mt-1">
                              Excede el disponible en ${(total - presupuestoGlobalDisponible).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                      ) : null;
                    })()}

                    {/* Categoría/Rubro */}
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
                          placeholder="Escribí el rubro (ej: Hormigón, Mampostería, Cubierta...)"
                        />
                      )}
                    </div>
                  </>
                )}

                {nuevaAsignacion.tipoAsignacion === 'ELEMENTO_DETALLADO' && (
                  <>
                <div className="mb-3">
                  <label className="form-label">Material del Presupuesto</label>
                  <select
                    className="form-select"
                    value={nuevaAsignacion.materialId}
                    onChange={(e) => {
                      const valorSeleccionado = e.target.value;

                      // Si selecciona un material del catálogo, autocompletar precio
                      if (valorSeleccionado && valorSeleccionado !== 'CREAR_NUEVO') {
                        const materialSeleccionado = materialesCatalogo.find(m => m.id.toString() === valorSeleccionado);
                        if (materialSeleccionado) {
                          // Actualizar ambos estados para compatibilidad
                          setNuevoGastoManual({
                            ...nuevoGastoManual,
                            descripcion: materialSeleccionado.nombre || '',
                            unidad: materialSeleccionado.unidadMedida || 'unidades',
                            importeUnitario: materialSeleccionado.precioUnitario?.toString() || ''
                          });

                          // Actualizar también el estado de nuevaAsignacion
                          setNuevaAsignacion({
                            ...nuevaAsignacion,
                            materialId: valorSeleccionado,
                            importeUnitario: materialSeleccionado.precioUnitario?.toString() || ''
                          });
                          return; // Salir temprano ya que actualizamos nuevaAsignacion arriba
                        }
                      }

                      setNuevaAsignacion({
                        ...nuevaAsignacion,
                        materialId: valorSeleccionado
                      });
                    }}
                    required
                  >
                    <option value="">Seleccionar material...</option>

                    {/* 🆕 Opción para crear nuevo material */}
                    <option value="CREAR_NUEVO" style={{ fontWeight: 'bold', color: '#28a745', backgroundColor: '#d4edda' }}>
                      ➕ Crear Nuevo Material
                    </option>

                    {/* Materiales del catálogo */}
                    {materialesCatalogo.length === 0 && (
                      <option disabled style={{ color: '#6c757d', fontStyle: 'italic' }}>
                        Cargando materiales...
                      </option>
                    )}

                    {materialesCatalogo.map(material => (
                      <option key={material.id} value={material.id}>
                        {material.nombre} {material.unidadMedida ? `(${material.unidadMedida})` : ''} - ${Number(material.precioUnitario || 0).toLocaleString('es-AR')}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 🆕 Campos adicionales si está creando un material nuevo */}
                {nuevaAsignacion.materialId === 'CREAR_NUEVO' && (
                  <>
                    <div className="alert alert-success mb-2 py-2">
                      <strong>Presupuesto disponible:</strong> ${presupuestoGlobalDisponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </div>

                    {/* Nombre del material */}
                    <div className="mb-3">
                      <label className="form-label">
                        Material <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        value={nuevoGastoManual.descripcion}
                        onChange={(e) => setNuevoGastoManual({...nuevoGastoManual, descripcion: e.target.value})}
                        placeholder="Ej: Cemento, Arena, Hierro, Ladrillos..."
                        required
                      />
                    </div>

                    {/* Unidad y Cantidad en la misma fila */}
                    <div className="row g-2 mb-3">
                      <div className="col-5">
                        <label className="form-label">Unidad <span className="text-danger">*</span></label>
                        <select
                          className="form-select"
                          value={nuevoGastoManual.unidad || 'unidades'}
                          onChange={(e) => setNuevoGastoManual({...nuevoGastoManual, unidad: e.target.value})}
                        >
                          <option value="unidades">Unidades</option>
                          <option value="bolsas">Bolsas</option>
                          <option value="kg">Kilogramos (kg)</option>
                          <option value="tn">Toneladas (tn)</option>
                          <option value="m3">Metros cúbicos (m³)</option>
                          <option value="m2">Metros cuadrados (m²)</option>
                          <option value="ml">Metros lineales (ml)</option>
                          <option value="lts">Litros (lts)</option>
                          <option value="barras">Barras</option>
                          <option value="chapas">Chapas</option>
                          <option value="rollos">Rollos</option>
                          <option value="caños">Caños</option>
                          <option value="tablas">Tablas</option>
                          <option value="otro">Otro</option>
                        </select>
                      </div>
                      <div className="col-7">
                        <label className="form-label">Cantidad <span className="text-danger">*</span></label>
                        <input
                          type="number"
                          className="form-control"
                          value={nuevoGastoManual.cantidadAsignada}
                          onChange={(e) => setNuevoGastoManual({...nuevoGastoManual, cantidadAsignada: e.target.value})}
                          placeholder="Ej: 50"
                          min="0.01"
                          step="0.01"
                          required
                        />
                      </div>
                    </div>

                    {/* Precio unitario */}
                    <div className="mb-3">
                      <label className="form-label">
                        Precio unitario <span className="text-danger">*</span>
                      </label>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input
                          type="number"
                          className="form-control"
                          value={nuevoGastoManual.importeUnitario}
                          onChange={(e) => setNuevoGastoManual({...nuevoGastoManual, importeUnitario: e.target.value})}
                          placeholder="Ej: 2500"
                          min="0"
                          step="0.01"
                          required
                        />
                        <span className="input-group-text">/ {nuevoGastoManual.unidad || 'unidad'}</span>
                      </div>
                    </div>

                    {/* Total calculado */}
                    {nuevoGastoManual.cantidadAsignada && nuevoGastoManual.importeUnitario && (() => {
                      const total = (parseFloat(nuevoGastoManual.cantidadAsignada) || 0) * (parseFloat(nuevoGastoManual.importeUnitario) || 0);
                      const excede = total > presupuestoGlobalDisponible;
                      return total > 0 ? (
                        <div className={`alert ${excede ? 'alert-danger' : 'alert-info'} py-2 mb-3`}>
                          <strong>Total: ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                          {excede && (
                            <span className="d-block small mt-1">
                              Excede el disponible en ${(total - presupuestoGlobalDisponible).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                      ) : null;
                    })()}

                    {/* Categoría/Rubro */}
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
                          placeholder="Escribí el rubro (ej: Hormigón, Mampostería, Cubierta...)"
                        />
                      )}
                    </div>
                  </>
                )}

                <div className="mb-3">
                  {(() => {
                    // Si está creando nuevo, los campos ya están arriba - no mostrar nada aquí
                    if (nuevaAsignacion.materialId === 'CREAR_NUEVO') {
                      return null;
                    }

                    const costoSeleccionado = materialesDisponibles.find(c => c.id.toString() === nuevaAsignacion.materialId);
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
                </>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Modal de Asignación Semanal Completa para Costos */}
    {mostrarAsignacionSemanal && semanaAsignacionCompleta && (
      <AsignarMaterialSemanalModal
        show={mostrarAsignacionSemanal}
        onClose={() => setMostrarAsignacionSemanal(false)}
        obra={obra}
        numeroSemana={semanaAsignacionCompleta}
        diasSemana={calcularDiasHabilesSemana(semanaAsignacionCompleta)}
        materialesDisponibles={materialesDisponibles}
        rubrosParaSelect={rubrosParaSelect}
        presupuestoGlobalDisponible={presupuestoGlobalDisponible}
        modoPresupuesto={modoPresupuesto}
        rubroInicial={rubroSeleccionado}
        onConfirmarAsignacion={handleAsignacionSemanalCompleta}
      />
    )}

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
                    observaciones: ''
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

export default AsignarMaterialObraModal;
