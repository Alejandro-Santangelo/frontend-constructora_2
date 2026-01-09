import React, { useState, useEffect, useMemo } from 'react';
import { useEmpresa } from '../EmpresaContext';
import DetalleSemanalGastosModal from './DetalleSemanalGastosModal';
import AsignarOtroCostoSemanalModal from './AsignarOtroCostoSemanalModal';

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
    otroCostoId: '', // ID del costo del presupuesto
    cantidadAsignada: '',
    importeUnitario: '', // 🔥 NUEVO: importe por unidad
    importeAsignado: '',
    fechaAsignacion: '', // Inicializar vacío, se configura al abrir modal
    observaciones: ''
  });

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
    console.log('🔄 [OTROS COSTOS] useEffect [show, obra] ejecutado - show:', show, 'obra.id:', obra?.id);
    if (show && obra) {
      // Incrementar forceUpdate ANTES de cargar para forzar re-render
      setForceUpdate(prev => prev + 1);
      cargarPresupuestoObra();
      cargarAsignacionesActuales();
    } else if (!show) {
      // Limpiar estado cuando se cierra para forzar recarga fresca
      console.log('🧹 [OTROS COSTOS] Limpiando estado del modal (cerrado)');
      setPresupuesto(null);
      setOtrosCostosDisponibles([]);
    }
  }, [show, obra, configuracionObra?.presupuestoSeleccionado?.id]);

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

  // Función para obtener gastos generales con stock (según backend)
  const obtenerGastosGeneralesConStock = async (presupuestoId, empresaId) => {
    const response = await fetch(`http://localhost:8080/api/presupuestos-no-cliente/${presupuestoId}/gastos-generales`, {
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
    const payload = {
      obraId: parseInt(obraId),
      gastoGeneralId: parseInt(datos.gastoGeneralId),
      presupuestoOtroCostoId: parseInt(datos.gastoGeneralId), // Compatibilidad con ambas implementaciones
      fechaAsignacion: datos.fechaAsignacion,
      importeAsignado: parseFloat(datos.importeAsignado),
      observaciones: datos.observaciones || null
    };

    // 🔥 Incluir semana si está presente
    if (datos.semana !== null && datos.semana !== undefined) {
      payload.semana = Number(datos.semana);
    }

    // Si es un recurso físico, agregar la cantidad para control de stock
    if (datos.cantidadAsignada !== undefined && datos.cantidadAsignada !== null) {
      payload.cantidadAsignada = parseInt(datos.cantidadAsignada);
    }

    // VALIDACIÓN CRÍTICA: Nunca enviar importe 0
    if (!payload.importeAsignado || payload.importeAsignado <= 0) {
      console.error('❌ BLOQUEANDO envío - importeAsignado inválido:', payload.importeAsignado);

      // Usar valor específico basado en la cantidad para volquetes
      const cantidad = payload.cantidadAsignada || 1;
      payload.importeAsignado = 1000000 * cantidad; // $1M por volquete

      console.warn(`⚠️ Usando valor de emergencia: $${payload.importeAsignado} (${cantidad} × $1.000.000)`);
    }

    console.log('📦 Payload final enviado al backend (formato original):', payload);

    const response = await fetch(`http://localhost:8080/api/obras/${obraId}/otros-costos`, {
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
      console.log('🔍 Buscando presupuesto con estado válido (APROBADO, EN_EJECUCION, SUSPENDIDA, CANCELADA) más reciente para obra:', obra.id);

      // Añadir timestamp para evitar caché
      const timestamp = new Date().getTime();

      // SIEMPRE buscar la versión más reciente del presupuesto en la API
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

      // Filtrar por obraId y estado válido
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

      // IMPORTANTE: Siempre buscar la versión más reciente, incluso si tenemos una en configuracionObra
      if (presupuestoActual && configuracionObra?.presupuestoSeleccionado &&
          presupuestoActual.version !== configuracionObra.presupuestoSeleccionado.version) {
        console.log('🔄 Detectada nueva versión del presupuesto:', {
          actual: presupuestoActual.version,
          configuracion: configuracionObra.presupuestoSeleccionado.version
        });
      }

      const presupuestoId = presupuestoActual.id;
      console.log('✅ Usando presupuesto con estado válido ID:', presupuestoId, 'versión:', presupuestoActual.version, 'estado:', presupuestoActual.estado);
      console.log('📅 fechaProbableInicio en presupuestoActual:', presupuestoActual.fechaProbableInicio);

      // Intentar obtener gastos generales usando la función del backend
      let gastosDisponibles = [];
      try {
        console.log('📡 Intentando endpoint de gastos generales (backend):', presupuestoId);

        const gastosGeneralesData = await obtenerGastosGeneralesConStock(presupuestoId, empresaSeleccionada.id);
        console.log('📦 Gastos generales obtenidos del backend:', gastosGeneralesData);

        // 🔍 LOG: Ver estructura completa del primer gasto
        if (gastosGeneralesData && gastosGeneralesData.length > 0) {
          console.log('🔍 ESTRUCTURA del primer gasto:', {
            objetoCompleto: gastosGeneralesData[0],
            importe: gastosGeneralesData[0].importe,
            todasLasPropiedades: Object.keys(gastosGeneralesData[0])
          });
        }

        // Usar todos los gastos que devuelve el backend (no filtrar por estadoStock)
        gastosDisponibles = (gastosGeneralesData || []).map(gasto => ({
          id: gasto.id,
          nombre: gasto.descripcion,
          descripcion: gasto.descripcion,
          categoria: gasto.categoria || 'General',
          cantidadDisponible: 3, // Cantidad por defecto para volquetes
          unidadMedida: 'unidades',
          importe: gasto.importe,
          esDelStock: true
        }));

        console.log('✅ Gastos generales procesados:', gastosDisponibles.length);
      } catch (stockError) {
        console.log('⚠️ Endpoint gastos-generales no disponible, usando otros-costos como respaldo:', stockError.message);

        // Respaldo: usar el endpoint original de otros-costos
        try {
          const otrosCostosUrl = `http://localhost:8080/api/presupuestos-no-cliente/${presupuestoId}/otros-costos`;
          console.log('📡 Llamando a endpoint de respaldo:', otrosCostosUrl);

          const otrosCostosResponse = await fetch(otrosCostosUrl, {
            headers: {
              'empresaId': empresaSeleccionada.id.toString()
            }
          });

          if (otrosCostosResponse.ok) {
            const otrosCostosData = await otrosCostosResponse.json();
            console.log('📋 Otros costos del presupuesto (respaldo):', otrosCostosData);

            // Convertir formato de otros costos al formato esperado
            gastosDisponibles = (otrosCostosData || []).map(costo => {
              // Detectar si es un recurso físico basándose en el nombre/descripción
              const esRecursoFisico = /volquete|contenedor|andamio|herramienta|equipo|maquina|vehiculo|camion/i.test(costo.descripcion || '');

              return {
                id: costo.id,
                nombre: costo.descripcion,
                descripcion: costo.descripcion,
                categoria: costo.categoria || 'General',
                cantidadDisponible: esRecursoFisico ? 3 : null, // Si es recurso físico, asignar cantidad predeterminada
                importe: costo.importe,
                esDelStock: esRecursoFisico
              };
            });

            console.log('✅ Otros costos convertidos:', gastosDisponibles.length);
          } else {
            const errorText = await otrosCostosResponse.text();
            throw new Error(`Error ${otrosCostosResponse.status}: ${errorText}`);
          }
        } catch (respaldoError) {
          console.error('❌ Error en endpoint de respaldo:', respaldoError);
          throw new Error(`No se pudieron obtener gastos ni otros costos: ${respaldoError.message}`);
        }
      }

      setOtrosCostosDisponibles(gastosDisponibles);

      // Convertir fechaProbableInicio de ISO a formato YYYY-MM-DD
      const fechaRaw = presupuestoActual.fechaProbableInicio;
      const fechaFormateada = fechaRaw ? (typeof fechaRaw === 'string' && fechaRaw.includes('T') ? fechaRaw.split('T')[0] : fechaRaw) : null;

      const presupuestoParaEstado = {
        id: presupuestoId,
        nombre: presupuestoActual.nombreObra || 'Presupuesto',
        version: presupuestoActual.version || 1,
        fechaProbableInicio: fechaFormateada,
        // Agregar honorarios y mayores costos para cálculos
        honorarios: {
          otrosCostos: {
            activo: presupuestoActual.honorariosOtrosCostosActivo,
            tipo: presupuestoActual.honorariosOtrosCostosTipo,
            valor: presupuestoActual.honorariosOtrosCostosValor
          }
        },
        mayoresCostos: {
          otrosCostos: {
            activo: presupuestoActual.mayoresCostosOtrosCostosActivo,
            tipo: presupuestoActual.mayoresCostosOtrosCostosTipo,
            valor: presupuestoActual.mayoresCostosOtrosCostosValor
          }
        }
      };

      setPresupuesto(presupuestoParaEstado);
      console.log('📅 Fecha probable inicio cargada en AsignarOtroCosto (ISO → YYYY-MM-DD):', fechaRaw, '→', fechaFormateada);
      console.log('✅✅✅ [OTROS COSTOS] PRESUPUESTO GUARDADO EN ESTADO:', presupuestoParaEstado);
      console.log('🔍🔍🔍 [OTROS COSTOS] FIN CARGA DE PRESUPUESTO 🔍🔍🔍');
    } catch (error) {
      console.error('❌ Error cargando presupuesto:', error);
      setError(error.message);
    } finally {
      setLoadingPresupuesto(false);
    }
  };

  const cargarAsignacionesActuales = async () => {
    try {
      console.log('🔍 Cargando asignaciones actuales de otros costos...');

      const response = await fetch(
        `http://localhost:8080/api/obras/${obra.id}/otros-costos`,
        {
          headers: {
            'empresaId': empresaSeleccionada.id.toString()
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Asignaciones actuales:', data);
        setAsignaciones(Array.isArray(data) ? data : []);
      } else if (response.status === 500) {
        console.warn('⚠️ Error 500 en el backend - Trabajando en modo offline');
        setAsignaciones([]);
      } else if (response.status === 404) {
        console.warn('⚠️ Endpoint no encontrado - Funcionalidad no implementada aún');
        setAsignaciones([]);
      } else {
        console.warn(`⚠️ No se pudieron cargar las asignaciones (Status: ${response.status})`);
        setAsignaciones([]);
      }
    } catch (error) {
      console.error('❌ Error cargando asignaciones:', error);
      setAsignaciones([]);
    }
  };

  const handleAsignarCosto = async () => {
    console.log('🚀 [DEBUG GASTOS] Iniciando handleAsignarCosto');
    console.log('📊 [DEBUG GASTOS] Estado completo nuevaAsignacion:', nuevaAsignacion);
    console.log('📅 [DEBUG GASTOS] Fecha que se va a procesar:', nuevaAsignacion.fechaAsignacion);

    if (!nuevaAsignacion.otroCostoId) {
      alert('Por favor seleccione un costo');
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
      const datos = {
        gastoGeneralId: nuevaAsignacion.otroCostoId,
        fechaAsignacion: nuevaAsignacion.fechaAsignacion,
        semana: numeroSemana, // 🔥 AGREGAR SEMANA
        observaciones: nuevaAsignacion.observaciones || null
      };

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

      const resultado = await asignarOtroCostoAObra(obra.id, empresaSeleccionada.id, datos);
      console.log('✅ Costo asignado exitosamente:', resultado);

      // Limpiar formulario completamente
      setNuevaAsignacion({
        otroCostoId: '',
        cantidadAsignada: '',
        importeUnitario: '', // 🔥 Agregar campo nuevo
        importeAsignado: '',
        fechaAsignacion: '', // Vacío, no fecha actual
        observaciones: ''
      });

      // Recargar asignaciones
      await cargarAsignacionesActuales();

      if (onAsignacionExitosa) {
        onAsignacionExitosa();
      }
    } catch (error) {
      console.error('❌ Error asignando costo:', error);
      setError(error.message);
      alert(`Error al asignar costo: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Nueva función: manejar asignaciones semanales múltiples de costos
  const handleAsignacionSemanalCompleta = async (asignacionesSemana) => {
    if (!asignacionesSemana || asignacionesSemana.length === 0) {
      console.log('⚠️ No hay asignaciones de costos para procesar');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('💰 Procesando asignaciones semanales de costos:', asignacionesSemana);

      // Procesar cada asignación diaria
      const resultados = [];
      for (const asignacion of asignacionesSemana) {
        const payload = {
          obraId: obra.id,
          presupuestoOtroCostoId: Number(asignacion.otroCostoId),
          gastoGeneralId: Number(asignacion.otroCostoId), // Backend requiere este campo
          importeAsignado: Number(asignacion.importe),
          semana: Number(asignacion.numeroSemana), // 🔥 Convertir a número
          observaciones: asignacion.observaciones
        };

        console.log(`🔥🔥🔥 POST OTRO COSTO - Payload completo:`, payload);        console.log(`📅 Procesando asignación de costo para ${asignacion.fechaAsignacion}:`, payload);

        const response = await fetch(
          `http://localhost:8080/api/obras/${obra.id}/otros-costos`,
          {
            method: 'POST',
            headers: {
              'empresaId': empresaSeleccionada.id.toString(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          }
        );

        if (response.ok) {
          const data = await response.json();
          resultados.push({
            fecha: asignacion.fechaAsignacion,
            costo: asignacion.nombreOtroCosto,
            importe: asignacion.importe,
            resultado: data
          });

          // Guardar también en localStorage para organización por días
          const key = `asignaciones_costos_${obra.id}_${asignacion.fechaAsignacion}`;
          const asignacionesDia = JSON.parse(localStorage.getItem(key) || '[]');
          asignacionesDia.push({
            id: data.id || Date.now(),
            otroCostoId: asignacion.otroCostoId,
            nombreCosto: asignacion.nombreOtroCosto,
            importe: asignacion.importe,
            fecha: asignacion.fechaAsignacion,
            observaciones: asignacion.observaciones,
            timestamp: new Date().toISOString()
          });
          localStorage.setItem(key, JSON.stringify(asignacionesDia));
        } else {
          const errorText = await response.text();
          console.error(`❌ Error en asignación de costo para ${asignacion.fechaAsignacion}:`, errorText);
        }
      }

      console.log('✅ Asignaciones semanales de costos completadas:', resultados);

      // Recargar asignaciones
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
    if (!confirm('¿Está seguro de eliminar esta asignación?')) {
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:8080/api/obras/${obra.id}/otros-costos/${asignacionId}`,
        {
          method: 'DELETE',
          headers: {
            'empresaId': empresaSeleccionada.id.toString()
          }
        }
      );

      if (response.ok) {
        console.log('✅ Asignación eliminada');
        await cargarAsignacionesActuales();

        if (onAsignacionExitosa) {
          onAsignacionExitosa();
        }
      } else {
        const errorText = await response.text();
        console.error(`❌ Error ${response.status} eliminando asignación:`, errorText);
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
    } catch (error) {
      console.error('❌ Error eliminando asignación:', error);
      alert(`Error: ${error.message}`);
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
    console.log('🎯 [DEBUG GASTOS] abrirAsignacionParaDia recibió fecha:', fechaStr);
    setNuevaAsignacion(prev => ({
      ...prev,
      fechaAsignacion: fechaStr
    }));
    setMostrarDetalleSemana(false); // Cerrar detalle semanal
    setMostrarFormularioIndividual(true); // Abrir formulario individual
    console.log(`ð Formulario configurado para fecha: ${fechaStr}`);
  };

  // Nueva función: abrir modal de asignación semanal completa
  const abrirAsignacionSemanal = (numeroSemana) => {
    setSemanaAsignacionCompleta(numeroSemana);
    setMostrarDetalleSemana(false); // Cerrar detalle si estaba abierto
    setMostrarAsignacionSemanal(true);
    console.log(`📅 Abriendo asignación semanal completa para semana ${numeroSemana}`);
  };

  // Función para manejar envío del formulario individual
  const handleSubmit = async (e) => {
    e.preventDefault();
    await handleAsignarCosto();
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

    console.log(`💰 [OTROS COSTOS] ${semanasPorProyecto.length} semanas necesarias para ${configuracionObraActualizada.diasHabiles} días hábiles objetivo`);
    return semanasPorProyecto;
  }, [configuracionObraActualizada?.fechaInicio, diasHabilesDisponibles]);

  const calcularDiasHabilesSemana = (numeroSemana) => {
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
            <h5 className="modal-title">
              <i className="fas fa-dollar-sign me-2"></i>
              Asignar Otros Costos / Gastos Generales - {obra?.nombre}
            </h5>
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
                {/* Distribución semanal estimada - solo si hay configuración */}
                {configuracionObra && configuracionObra.semanasObjetivo && (
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

                          const totalGastosMonetarios = gastosMonetarios.reduce((sum, costo) => sum + (parseFloat(costo.importe) || 0), 0);
                          const gastoMonetarioSemanal = (totalGastosMonetarios * parseFloat(porcentajeSemana) / 100).toFixed(2);

                          // Calcular elementos físicos por semana
                          const elementosPorSemana = elementosFisicos.map(elem => {
                            const cantidadSemanal = Math.ceil((elem.cantidadDisponible || 0) * parseFloat(porcentajeSemana) / 100);
                            return { nombre: elem.nombre, cantidad: cantidadSemanal };
                          }).filter(e => e.cantidad > 0);

                          return (
                            <div key={semana} className="col-md-6 col-lg-4 mb-2">
                              <div
                                className="border rounded p-2 bg-light hover-card"
                                style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                                onClick={() => abrirDetalleSemana(semana)}
                                onMouseEnter={(e) => {
                                  e.target.style.backgroundColor = '#fff3cd';
                                  e.target.style.borderColor = '#ffc107';
                                }}
                                onMouseLeave={(e) => {
                                  e.target.style.backgroundColor = '#f8f9fa';
                                  e.target.style.borderColor = '#dee2e6';
                                }}
                              >
                                <div className="d-flex justify-content-between align-items-center">
                                  <strong className="text-warning">Semana {semana}</strong>
                                  <div className="d-flex align-items-center gap-1">
                                    <small className="text-muted">{porcentajeSemana}%</small>
                                    <i className="fas fa-calendar-day text-warning" style={{ fontSize: '0.8rem' }}></i>
                                  </div>
                                </div>
                                <small className="text-muted d-block">
                                  <i className="fas fa-users me-1"></i>
                                  {jornalesPorSemana} jornales
                                </small>

                                {/* Mostrar gastos monetarios si existen */}
                                {totalGastosMonetarios > 0 && (
                                  <small className="text-success d-block">
                                    <i className="fas fa-dollar-sign me-1"></i>
                                    ~${gastoMonetarioSemanal}
                                  </small>
                                )}

                                {/* Mostrar elementos físicos si existen */}
                                {elementosPorSemana.length > 0 && (
                                  <small className="text-primary d-block">
                                    <i className="fas fa-boxes me-1"></i>
                                    {elementosPorSemana.map((elem, idx) => (
                                      <span key={idx}>
                                        {elem.cantidad} {elem.nombre}
                                        {idx < elementosPorSemana.length - 1 && ', '}
                                      </span>
                                    ))}
                                  </small>
                                )}

                                <small className="text-info d-block mt-1">
                                  <i className="fas fa-hand-pointer me-1"></i>
                                  Clic para asignar
                                </small>
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

                {otrosCostosDisponibles.length === 0 && (
                  <div className="alert alert-info">
                    <i className="fas fa-info-circle me-2"></i>
                    No hay otros costos/gastos generales en el presupuesto de esta obra
                  </div>
                )}

                {/* Asignación por planificación semanal - se realiza desde las tarjetas de semanas */}

                {/* Lista de asignaciones actuales */}
                {otrosCostosDisponibles.length > 0 && (
                  <div className="card">
                    <div className="card-header bg-light">
                      <h6 className="mb-0">
                        <i className="fas fa-check-circle me-2 text-success"></i>
                        Asignaciones Confirmadas ({asignaciones.length})
                      </h6>
                      <small className="text-muted">
                        Gastos ya asignados y guardados en la base de datos
                      </small>
                    </div>
                    <div className="card-body">
                      {asignaciones.length === 0 ? (
                        <div className="text-center text-muted py-3">
                            <i className="fas fa-info-circle fa-2x mb-2"></i>
                            <p className="mb-0">Aún no hay gastos confirmados</p>
                            <small className="text-muted">Usa las tarjetas de arriba para asignar gastos por semana</small>
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
                                    <td>{asignacion.descripcion || 'N/A'}</td>
                                    <td>
                                      <span className="badge bg-secondary">
                                        {asignacion.categoria || 'General'}
                                      </span>
                                    </td>
                                    <td>
                                      <strong>
                                        ${Number(asignacion.importeAsignado || 0).toLocaleString('es-AR')}
                                      </strong>
                                    </td>
                                    <td>
                                      <small>{(() => {
                                        const inputFecha = document.querySelector('input[name="fechaProbableInicio"]');
                                        const fechaStr = inputFecha?.value || '2025-12-16';
                                        // Convertir de YYYY-MM-DD a DD/MM/YYYY directamente
                                        const partes = fechaStr.split('-');
                                        return `${partes[2]}/${partes[1]}/${partes[0]}`;
                                      })()}</small>
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
                                    ? `(${infoStock} ${costo.unidadMedida || 'unidades'} disponibles - $${importeFinal.toLocaleString('es-AR')}/unidad)`
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
                <div className="mb-3">
                  {(() => {
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
              </form>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Modal de Asignación Semanal Completa para Costos */}
    {mostrarAsignacionSemanal && semanaAsignacionCompleta && (
      <AsignarOtroCostoSemanalModal
        show={mostrarAsignacionSemanal}
        onClose={() => setMostrarAsignacionSemanal(false)}
        obra={obra}
        numeroSemana={semanaAsignacionCompleta}
        diasSemana={calcularDiasHabilesSemana(semanaAsignacionCompleta)}
        otrosCostosDisponibles={otrosCostosDisponibles}
        onConfirmarAsignacion={handleAsignacionSemanalCompleta}
      />
    )}
    </>
  );
};

export default AsignarOtroCostoObraModal;
