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

  console.log('🔍 [AsignarMaterialObraModal] Debug:', {
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

  // 🔥 Crear configuración actualizada con fechaProbableInicio y jornales del presupuesto
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

      // 🔥 USAR días hábiles del presupuesto (fuente de verdad), NO semanasObjetivo × 5
      const diasHabiles = presupuesto.tiempoEstimadoTerminacion || configuracionObra.diasHabiles || (configuracionObra.semanasObjetivo * 5);
      const capacidadNecesaria = diasHabiles > 0 ? Math.ceil(diasHabilesPresupuesto / diasHabiles) : 0;

      console.log('🔥 [MATERIALES] configuracionObraActualizada:', {
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
    console.log('🔄 useEffect [show, obra] ejecutado - show:', show, 'obra.id:', obra?.id);
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

  const cargarPresupuestoObra = async () => {
    setLoadingPresupuesto(true);
    setError(null);
    try {
      console.log('🔍🔍🔍 INICIANDO CARGA DE PRESUPUESTO 🔍🔍🔍');
      console.log('🔍 Buscando presupuesto para obra:', obra.id, 'empresa:', empresaSeleccionada.id);

      // Añadir timestamp para evitar caché del navegador
      const timestamp = new Date().getTime();

      // Buscar el presupuesto por obraId
      const todosPresupuestosUrl = `http://localhost:8080/api/presupuestos-no-cliente?empresaId=${empresaSeleccionada.id}&_t=${timestamp}`;
      console.log('📡 Llamando a:', todosPresupuestosUrl);
      const todosPresupuestosResponse = await fetch(todosPresupuestosUrl, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      if (!todosPresupuestosResponse.ok) {
        throw new Error('No se pudieron obtener los presupuestos');
      }

      const todosPresupuestos = await todosPresupuestosResponse.json();
      console.log('📦 Total presupuestos obtenidos:', todosPresupuestos?.length || 0);

      // Estados válidos para obras vinculadas (MODIFICADO NO se incluye)
      const estadosValidos = ['APROBADO', 'EN_EJECUCION', 'SUSPENDIDA', 'CANCELADA'];

      // Filtrar por obraId Y estado válido
      const presupuestosObra = (todosPresupuestos || []).filter(p =>
        (p.obraId === obra.id || p.idObra === obra.id) && estadosValidos.includes(p.estado)
      );
      console.log('✅ Presupuestos con estado válido de obra', obra.id, ':', presupuestosObra.length);

      if (presupuestosObra.length === 0) {
        throw new Error('No se encontró un presupuesto con estado válido (APROBADO, EN_EJECUCION, SUSPENDIDA, CANCELADA) para esta obra');
      }

      // Tomar el más reciente entre los APROBADOS (mayor versión o mayor ID)
      const presupuestoActual = presupuestosObra.sort((a, b) => {
        if (a.numeroPresupuesto === b.numeroPresupuesto) {
          return (b.version || 0) - (a.version || 0);
        }
        return b.id - a.id;
      })[0];

      console.log('🎯 Presupuesto con estado válido seleccionado:', {
        id: presupuestoActual.id,
        version: presupuestoActual.version,
        estado: presupuestoActual.estado,
        fechaProbableInicio: presupuestoActual.fechaProbableInicio
      });

      const presupuestoId = presupuestoActual.id;
      console.log('✅ Usando presupuesto ID:', presupuestoId);
      console.log('📅 fechaProbableInicio en presupuestoActual (lista):', presupuestoActual.fechaProbableInicio);

      // Obtener presupuesto completo para extraer materiales
      const presupuestoUrl = `http://localhost:8080/api/presupuestos-no-cliente/${presupuestoId}?empresaId=${empresaSeleccionada.id}&_t=${timestamp}`;
      console.log('📡 Llamando a presupuesto completo:', presupuestoUrl);
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

      const presupuestoData = await presupuestoResponse.json();
      console.log('📦 presupuestoData completo recibido:', presupuestoData);
      console.log('📅 fechaProbableInicio en presupuestoData (completo):', presupuestoData.fechaProbableInicio);

      // Extraer materiales de itemsCalculadora
      const todosMateriales = [];

      if (presupuestoData.itemsCalculadora && Array.isArray(presupuestoData.itemsCalculadora)) {
        presupuestoData.itemsCalculadora.forEach((item) => {
          if (item.materialesLista && Array.isArray(item.materialesLista)) {
            item.materialesLista.forEach(mat => {
              // Filtrar materiales que son placeholders del presupuesto global
              const esGlobalPlaceholder =
                (mat.descripcionMaterial || mat.descripcion || '').includes('Presupuesto Global') ||
                ((mat.nombreMaterial || mat.nombre || '') === 'Sin nombre' &&
                 (mat.descripcionMaterial || mat.descripcion || '').includes('Global'));

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
      const totalMateriales = presupuestoData.presupuestoGeneral?.totalMateriales || 0;
      const tieneItemsDetallados = todosMateriales.length > 0;

      if (totalMateriales > 0 && !tieneItemsDetallados) {
        setModoPresupuesto('GLOBAL');
        setCantidadGlobalDisponible(totalMateriales);
      } else if (totalMateriales > 0 && tieneItemsDetallados) {
        const totalAsignadoDesdeDetalle = todosMateriales.reduce((sum, mat) =>
          sum + (mat.precioUnitario * mat.cantidadDisponible), 0);
        const diferencia = totalMateriales - totalAsignadoDesdeDetalle;

        if (Math.abs(diferencia) > 0.01) {
          setModoPresupuesto('MIXTO');
          setCantidadGlobalDisponible(Math.max(0, diferencia));
        } else {
          setModoPresupuesto('DETALLE');
          setCantidadGlobalDisponible(0);
        }
      } else {
        setModoPresupuesto('DETALLE');
        setCantidadGlobalDisponible(0);
      }

      console.log('💰 Modo Presupuesto:', modoPresupuesto, 'Disponible Global:', cantidadGlobalDisponible);

      // IMPORTANTE: Usar SOLO presupuestoData (respuesta completa del backend), NO presupuestoActual (lista)
      // presupuestoData es la fuente de verdad con datos frescos
      const fechaRaw = presupuestoData.fechaProbableInicio;

      if (!fechaRaw) {
        console.warn('⚠️ fechaProbableInicio es null/undefined en presupuestoData');
      }

      const fechaFormateada = fechaRaw ? (typeof fechaRaw === 'string' && fechaRaw.includes('T') ? fechaRaw.split('T')[0] : fechaRaw) : null;

      const presupuestoParaEstado = {
        id: presupuestoId,
        nombre: presupuestoActual.nombre || 'Presupuesto',
        numeroPresupuesto: presupuestoActual.numeroPresupuesto,
        version: presupuestoActual.version || 1,
        estado: presupuestoActual.estado,
        fechaProbableInicio: fechaFormateada
      };

      setPresupuesto(presupuestoParaEstado);
      console.log('📅 Fecha probable inicio cargada (ISO → YYYY-MM-DD):', fechaRaw, '→', fechaFormateada);
      console.log('✅✅✅ PRESUPUESTO GUARDADO EN ESTADO:', presupuestoParaEstado);
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
      console.log('📅 obtenerFechaAsignacionReal - usando presupuesto.fechaProbableInicio:', presupuesto.fechaProbableInicio);
      return presupuesto.fechaProbableInicio;
    }
    // Fallback: intentar obtener del DOM si no está en presupuesto
    const inputFecha = document.querySelector('input[name="fechaProbableInicio"]');
    const fechaFallback = inputFecha?.value || new Date().toISOString().split('T')[0];
    console.log('⚠️ obtenerFechaAsignacionReal - usando fallback:', fechaFallback);
    return fechaFallback;
  };

  const cargarAsignacionesActuales = async () => {
    console.log('🔄 Cargando asignaciones actuales para obra:', obra?.id);
    try {
      const key = `obra_materiales_${obra.id}_${empresaSeleccionada.id}`;
      const localesRaw = JSON.parse(localStorage.getItem(key) || '[]');
      console.log('📦 Materiales en localStorage:', localesRaw.length, localesRaw);

      const locales = (Array.isArray(localesRaw) ? localesRaw : []).map(a => ({
        ...a,
        // Normalizar nombres para que se vean en tablas/modales
        nombreMaterial: a.nombreMaterial || a.nombre || a.presupuestoMaterial?.nombre,
        unidadMedida: a.unidadMedida || a.unidad || a.presupuestoMaterial?.unidad,
        cantidadAsignada: a.cantidadAsignada ?? a.cantidad
      }));

      const { obtenerMaterialesAsignados } = await import('../services/obraMaterialService');
      const materialesBD = await obtenerMaterialesAsignados(obra.id, empresaSeleccionada.id);
      console.log('📡 Materiales desde backend:', materialesBD?.length || 0, materialesBD);

      const combined = [...(Array.isArray(materialesBD) ? materialesBD : [])];
      locales.forEach(loc => {
        if (!combined.some(c => c.id === loc.id)) {
          combined.push(loc);
        }
      });

      console.log('✅ Total materiales asignados:', combined.length, combined);
      setAsignaciones(combined);
    } catch (error) {
      console.error('❌ Error cargando asignaciones de materiales:', error);
      const key = `obra_materiales_${obra.id}_${empresaSeleccionada.id}`;
      const localesRaw = JSON.parse(localStorage.getItem(key) || '[]');
      console.log('📦 Usando solo localStorage (fallback):', localesRaw.length);
      const locales = (Array.isArray(localesRaw) ? localesRaw : []).map(a => ({
        ...a,
        nombreMaterial: a.nombreMaterial || a.nombre || a.presupuestoMaterial?.nombre,
        unidadMedida: a.unidadMedida || a.unidad || a.presupuestoMaterial?.unidad,
        cantidadAsignada: a.cantidadAsignada ?? a.cantidad
      }));
      setAsignaciones(locales);
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
        if (!nuevoMaterialManual.nombre.trim()) {
          throw new Error('Debe ingresar un nombre para el material');
        }
        if (nuevoMaterialManual.unidad === 'otro' && !obtenerUnidadFinal()) {
          throw new Error('Si seleccionas "otro", debes escribir la unidad');
        }

        // 🔥 DESHABILITADO: Backend rechaza Content-Type con charset
        // console.log('📝 Verificando/creando material en catálogo...');
        // const { obtenerOCrearMaterial } = await import('../services/catalogoMaterialesService');
        // const materialCatalogo = await obtenerOCrearMaterial(
        //   nuevoMaterialManual.nombre,
        //   obtenerUnidadFinal(),
        //   0,
        //   empresaSeleccionada.id
        // );
        // console.log('✅ Material en catálogo:', materialCatalogo);
        console.log('⚠️ Material manual (backend lo creará):', nuevoMaterialManual.nombre);

        const key = `obra_materiales_${obra.id}_${empresaSeleccionada.id}`;
        const asignacionesExistentes = JSON.parse(localStorage.getItem(key) || '[]');

        const asignacionLocal = {
          id: `MANUAL_${Date.now()}_${Math.random()}`,
          materialId: materialCatalogo.id, // 🔥 Usar ID del catálogo
          nombreMaterial: nuevoMaterialManual.nombre,
          unidadMedida: obtenerUnidadFinal(),
          cantidadAsignada: cantidadNum,
          fechaAsignacion: nuevaAsignacion.fechaAsignacion,
          numeroSemana,
          esSemanal: false,
          esManual: true,
          observaciones: nuevaAsignacion.observaciones || '',
          timestamp: new Date().toISOString()
        };

        localStorage.setItem(key, JSON.stringify([...(Array.isArray(asignacionesExistentes) ? asignacionesExistentes : []), asignacionLocal]));

        setNuevaAsignacion({
          tipoAsignacion: '',
          materialId: '',
          cantidad: '',
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
        return;
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
        numeroSemana,
        fechaAsignacion: nuevaAsignacion.fechaAsignacion || null,
        observaciones: nuevaAsignacion.observaciones || ''
      };

      await asignarMaterial(obra.id, datosAsignacion, empresaSeleccionada.id);

      setNuevaAsignacion({
        tipoAsignacion: '',
        materialId: '',
        cantidad: '',
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
      console.error('❌ Error al asignar material:', error);
      setError(error.message);
      alert(`Error al asignar material: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Nueva función: manejar asignaciones semanales múltiples
  const handleAsignacionSemanalCompleta = async (asignacionesSemana) => {
    if (!asignacionesSemana || asignacionesSemana.length === 0) {
      console.log('⚠️ No hay asignaciones para procesar');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('📤 [AsignacionSemanal] Procesando asignaciones:', asignacionesSemana.length);
      console.log('📤 [AsignacionSemanal] Tipo asignaciones:', asignacionesSemana[0]?.esManual ? 'MANUALES' : 'PRESUPUESTO');

      // Separar asignaciones manuales de las del presupuesto
      const asignacionesManuales = asignacionesSemana.filter(a => a.esManual);
      const asignacionesPresupuesto = asignacionesSemana.filter(a => !a.esManual);

      console.log('📊 [AsignacionSemanal] Manuales:', asignacionesManuales.length, 'Presupuesto:', asignacionesPresupuesto.length);

      // Guardar en localStorage las asignaciones manuales
      if (asignacionesManuales.length > 0) {
        // 🔥 CREAR MATERIALES EN EL CATÁLOGO (sin Content-Type charset)
        console.log('📝 Verificando/creando materiales en catálogo...');
        const { obtenerOCrearMaterial } = await import('../services/catalogoMaterialesService');
        const asignacionesConCatalogo = await Promise.all(
          asignacionesManuales.map(async (asig) => {
            try {
              const materialCatalogo = await obtenerOCrearMaterial(
                asig.nombreMaterial || asig.nombre,
                asig.unidadMedida || asig.unidad,
                0, // precio se asigna en la asignación individual
                empresaSeleccionada.id
              );
              console.log('✅ Material en catálogo:', materialCatalogo);
              return {
                ...asig,
                materialId: materialCatalogo.id
              };
            } catch (error) {
              console.error('❌ Error creando material en catálogo:', error);
              return {
                ...asig,
                materialId: null // Fallback si falla
              };
            }
          })
        );

        console.log('✅ Materiales procesados con catálogo:', asignacionesConCatalogo.length);

        const key = `obra_materiales_${obra.id}_${empresaSeleccionada.id}`;
        const asignacionesExistentes = JSON.parse(localStorage.getItem(key) || '[]');

        const nuevasAsignacionesManuales = asignacionesConCatalogo.map(asig => ({
          id: `MANUAL_${Date.now()}_${Math.random()}`,
          materialId: asig.materialId,
          nombreMaterial: asig.nombreMaterial || asig.nombre,
          unidadMedida: asig.unidadMedida || asig.unidad,
          cantidadAsignada: parseFloat(asig.cantidadAsignada ?? asig.cantidad),
          precioUnitario: parseFloat(asig.precioUnitario || 0),
          numeroSemana: asig.numeroSemana,
          fechaAsignacion: asig.fechaAsignacion || null,
          esSemanal: asig.esSemanal || false,
          esManual: true,
          observaciones: asig.observaciones || '',
          timestamp: new Date().toISOString()
        }));

        localStorage.setItem(key, JSON.stringify([...(Array.isArray(asignacionesExistentes) ? asignacionesExistentes : []), ...nuevasAsignacionesManuales]));
        console.log('✅ [LocalStorage] Guardadas', nuevasAsignacionesManuales.length, 'asignaciones manuales');
      }

      // Procesar asignaciones del presupuesto con el backend
      const resultados = [];
      if (asignacionesPresupuesto.length > 0) {
        const { asignarMaterial } = await import('../services/obraMaterialService');

        for (const asignacion of asignacionesPresupuesto) {
          const datosAsignacion = {
            presupuestoMaterialId: parseInt(asignacion.materialId),
            cantidadAsignada: parseFloat(asignacion.cantidad),
            numeroSemana: asignacion.numeroSemana,
            fechaAsignacion: asignacion.fechaAsignacion || null,
            esSemanal: asignacion.esSemanal || false,
            observaciones: asignacion.observaciones || ''
          };

          try {
            await asignarMaterial(obra.id, datosAsignacion, empresaSeleccionada.id);
            resultados.push(asignacion);
          } catch (err) {
            console.error('❌ Error asignando material individual:', err);
          }
        }
      }

      console.log('✅ [AsignacionSemanal] Completadas:', resultados.length + asignacionesManuales.length);

      // Recargar asignaciones
      await cargarAsignacionesActuales();

      // Cerrar modal
      setMostrarAsignacionSemanal(false);

      if (onAsignacionExitosa) {
        onAsignacionExitosa();
      }

      setForceUpdate(prev => prev + 1);

      alert(`✅ Se asignaron ${resultados.length + asignacionesManuales.length} materiales para la semana`);

    } catch (error) {
      console.error('❌ [AsignacionSemanal] Error:', error);
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
      console.error('❌ [handleEliminar] Error:', error);
      alert(`Error eliminando asignación: ${error.message}`);
    }
  };

  // Funciones para manejo de detalle semanal
  const abrirDetalleSemana = (numeroSemana) => {
    setSemanaSeleccionada(numeroSemana);
    setMostrarDetalleSemana(true);

    // Calcular días hábiles de la semana
    const diasSemana = calcularDiasHabilesSemana(numeroSemana);
    console.log(`📅 Abriendo detalle semana ${numeroSemana}:`, diasSemana);
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
          diasHabiles: diasSemana.filter(d => d.esHabil).length
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
      console.warn('⚠️ Parámetros inválidos para calcular días hábiles:', { fechaInicio: fechaInicioAUsar, numeroSemana });
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
      console.log('📅 Calculando semana', numeroSemana, 'con fechaInicio:', fechaInicioAUsar, '(desde presupuesto:', !!presupuesto?.fechaProbableInicio, ')');

      // Validar que fechaInicio es válida
      if (isNaN(fechaInicio.getTime())) {
        console.error('❌ Fecha de inicio inválida:', fechaInicioAUsar);
        return [];
      }

      // Encontrar el lunes de la semana de inicio (solo para semana 1)
      const primerLunes = new Date(fechaInicio.getTime());
      const diaSemanaInicio = primerLunes.getDay();
      const diasHastaPrimerLunes = diaSemanaInicio === 0 ? -6 : 1 - diaSemanaInicio;
      primerLunes.setDate(primerLunes.getDate() + diasHastaPrimerLunes);

      // Validar que primerLunes es válida
      if (isNaN(primerLunes.getTime())) {
        console.error('❌ Primer lunes inválido:', primerLunes);
        return [];
      }

      // Para la semana solicitada, calcular su lunes sumando semanas completas (7 días)
      const inicioSemana = new Date(primerLunes.getTime());
      inicioSemana.setDate(primerLunes.getDate() + ((numeroSemana - 1) * 7));

      // Validar que inicioSemana es válida
      if (isNaN(inicioSemana.getTime())) {
        console.error('❌ Fecha de inicio de semana inválida:', inicioSemana);
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
          console.error(`❌ Día ${i} inválido:`, dia);
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

      console.log(`📅 Días hábiles calculados para semana ${numeroSemana}:`, diasHabiles);
      return diasHabiles;

    } catch (error) {
      console.error('❌ Error calculando días hábiles de semana:', error);
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
                          const materialesSemana = asignaciones.filter(a =>
                            a.esSemanal || (a.fechaAsignacion &&
                              new Date(a.fechaAsignacion) >= semanaInfo.fechaInicio &&
                              new Date(a.fechaAsignacion) <= semanaInfo.fechaFin)
                          ).length;
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
                    {(modoPresupuesto === 'GLOBAL' || modoPresupuesto === 'MIXTO') && (
                      <div className="alert alert-success mb-3">
                        <strong>📦 Global disponible:</strong> {cantidadGlobalDisponible}
                      </div>
                    )}

                    {modoPresupuesto === 'DETALLE' && !tieneItemsDetallados && (
                      <div className="alert alert-warning mb-3">
                        <i className="fas fa-exclamation-triangle me-2"></i>
                        No hay materiales detallados disponibles: cargá el material manualmente.
                      </div>
                    )}

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

                      if (estadoReal === 'STOCK_BAJO') {
                        return (
                          <div className="alert alert-warning d-flex align-items-center mb-3">
                            <i className="fas fa-exclamation-triangle me-2"></i>
                            ⚠️ Stock bajo: Solo quedan {disponibleReal} unidades
                          </div>
                        );
                      }
                      if (estadoReal === 'AGOTADO') {
                        return (
                          <div className="alert alert-danger d-flex align-items-center mb-3">
                            <i className="fas fa-times-circle me-2"></i>
                            🚫 Material agotado
                          </div>
                        );
                      }
                      return null;
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
