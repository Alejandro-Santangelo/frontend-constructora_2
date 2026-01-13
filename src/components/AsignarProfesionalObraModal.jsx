import React, { useState, useEffect } from 'react';
import { useEmpresa } from '../EmpresaContext';

/**
 * Modal para asignar profesionales del listado general a una obra específica
 * Permite seleccionar el rubro del presupuestoNoCliente y asignar jornales
 *
 * IMPORTANTE - Especificaciones Backend (v1.0.0):
 * - empresaId: Se envía como HEADER, no como query param
 * - rubroId: Tipo STRING (no number) - ej: "rubro-1", "item-abc"
 * - tipoAsignacion: "PROFESIONAL" o "JORNAL" (case-sensitive, mayúsculas)
 * - Validaciones automáticas del backend: profesional activo, jornales disponibles
 * - Respuestas 400 con mensajes descriptivos en español
 */
const AsignarProfesionalObraModal = ({ show, onClose, obra, onAsignacionExitosa }) => {
  const { empresaSeleccionada } = useEmpresa();

  // Estados
  const [presupuesto, setPresupuesto] = useState(null);
  const [profesionalesDisponibles, setProfesionalesDisponibles] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingPresupuesto, setLoadingPresupuesto] = useState(false);
  const [error, setError] = useState(null);
  const [obrasDelProfesional, setObrasDelProfesional] = useState([]);
  const [loadingObras, setLoadingObras] = useState(false);

  // Formulario de nueva asignación
  const [nuevaAsignacion, setNuevaAsignacion] = useState({
    profesionalId: '',
    rubroId: '',
    rubroSelectorValue: '', // Valor completo del selector (ej: "1689-jornal-697")
    itemId: '', // ID del profesional o jornal específico del presupuesto
    tipoAsignacion: '', // 'JORNAL' o 'HONORARIO'
    cantidadJornales: '',
    fechaInicio: '', // Renombrado según backend
    fechaFin: '', // Renombrado según backend
    observaciones: ''
  });

  // Cargar presupuesto de la obra
  useEffect(() => {
    if (show && obra) {
      console.log('🚀 Modal abierto - Iniciando carga de datos para obra:', {
        obraId: obra.id,
        obraNombre: obra.nombre,
        empresaId: empresaSeleccionada.id,
        empresaNombre: empresaSeleccionada.nombre_empresa
      });

      cargarPresupuestoObra();
      cargarProfesionalesDisponibles();
      cargarAsignacionesActuales();
    }
  }, [show, obra]);

  const cargarPresupuestoObra = async () => {
    setLoadingPresupuesto(true);
    setError(null);
    try {
      console.log('🔍 Cargando presupuesto para obra:', obra.id, 'empresa:', empresaSeleccionada.id);

      // 🔥 SI ES UN TRABAJO EXTRA ESPECÍFICO, usar directamente el presupuesto que ya viene en obra
      if (obra._trabajoExtraId && obra.presupuestoNoCliente) {
        console.log('✅ Usando presupuesto de TRABAJO EXTRA específico (ya cargado):', obra._trabajoExtraId);
        setPresupuesto(obra.presupuestoNoCliente);
        setLoadingPresupuesto(false);
        return;
      }

      // Usar el endpoint original que funciona
      const response = await fetch(
        `http://localhost:8080/api/presupuestos-no-cliente/por-obra/${obra.id}`,
        {
          headers: {
            'empresaId': empresaSeleccionada.id.toString(),
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('📡 Response status:', response.status, response.statusText);

      if (response.ok) {
        let data = await response.json();

        // Si devuelve un objeto único, convertirlo a array
        if (!Array.isArray(data)) {
          data = [data];
        }

        console.log('✅ Presupuestos cargados (RAW):', data);
        console.log('✅ Cantidad de presupuestos:', data.length);

        let presupuestoSeleccionado = null;

        // Si es un array, seleccionar el más apropiado
        if (Array.isArray(data) && data.length > 0) {
          console.log('🔍 Analizando presupuestos:', data.map(p => ({
            id: p.id,
            numeroPresupuesto: p.numeroPresupuesto,
            version: p.version || p.numeroVersion,
            estado: p.estado,
            tiempoEstimado: p.tiempoEstimadoTerminacion
          })));

          // 🎯 LÓGICA DEFINITIVA: Agrupar por numeroPresupuesto y filtrar solo estados válidos
          // Estados válidos: APROBADO, EN_EJECUCION, SUSPENDIDO, CANCELADO
          const ESTADOS_VALIDOS = ['APROBADO', 'EN_EJECUCION', 'SUSPENDIDO', 'CANCELADO'];

          const porNumero = {};
          data.forEach(p => {
            const num = p.numeroPresupuesto;
            if (!porNumero[num]) porNumero[num] = [];
            porNumero[num].push(p);
          });

          console.log('📊 Presupuestos agrupados por número:', Object.keys(porNumero).map(num => ({
            numeroPresupuesto: num,
            versiones: porNumero[num].map(p => ({ id: p.id, version: p.numeroVersion || p.version, estado: p.estado }))
          })));

          // Para cada grupo, seleccionar solo la versión con estado válido más reciente
          const presupuestosValidos = [];
          Object.values(porNumero).forEach(versiones => {
            const validos = versiones.filter(p => ESTADOS_VALIDOS.includes(p.estado));

            if (validos.length > 0) {
              // Ordenar por versión descendente y tomar el primero
              validos.sort((a, b) => {
                const vA = a.numeroVersion || a.version || 0;
                const vB = b.numeroVersion || b.version || 0;
                return vB - vA;
              });
              presupuestosValidos.push(validos[0]);
            }
          });

          if (presupuestosValidos.length > 0) {
            presupuestoSeleccionado = presupuestosValidos[0];

            console.log('✅ Presupuesto válido seleccionado:', {
              id: presupuestoSeleccionado.id,
              numeroPresupuesto: presupuestoSeleccionado.numeroPresupuesto,
              version: presupuestoSeleccionado.version || presupuestoSeleccionado.numeroVersion,
              estado: presupuestoSeleccionado.estado,
              tiempoEstimadoTerminacion: presupuestoSeleccionado.tiempoEstimadoTerminacion
            });
          } else {
            // ⚠️ Solo mostrar error si NO HAY NINGÚN presupuesto válido
            console.warn('⚠️ No se encontraron presupuestos válidos para esta obra');
            throw new Error('No hay presupuestos válidos (APROBADO, EN_EJECUCION, SUSPENDIDO, CANCELADO) vinculados a esta obra');
          }

          setPresupuesto(presupuestoSeleccionado);
        } else if (!Array.isArray(data)) {
          // Si no es array, es un objeto directo
          setPresupuesto(data);
        } else {
          throw new Error('No se encontró presupuesto vinculado a esta obra');
        }
      } else {
        // Intentar leer el mensaje de error del servidor
        const errorText = await response.text();
        console.error('❌ Error del servidor:', response.status, errorText);
        throw new Error(`Error ${response.status}: ${errorText || 'No se pudo cargar el presupuesto'}`);
      }
    } catch (err) {
      console.error('❌ Error cargando presupuesto:', err);
      setError(err.message);
      setPresupuesto(null);
    } finally {
      setLoadingPresupuesto(false);
    }
  };

  const cargarProfesionalesDisponibles = async () => {
    try {
      console.log('👥 Cargando profesionales para empresa:', empresaSeleccionada.id);

      const response = await fetch(
        `http://localhost:8080/api/profesionales`,
        {
          headers: {
            'empresaId': empresaSeleccionada.id.toString(),
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('📡 Profesionales response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Profesionales cargados:', data.length || data.resultado?.length || 0);
        setProfesionalesDisponibles(data.resultado || data || []);
      } else {
        const errorText = await response.text();
        console.error('❌ Error cargando profesionales:', response.status, errorText);
      }
    } catch (err) {
      console.error('❌ Error cargando profesionales:', err);
    }
  };

  const cargarAsignacionesActuales = async () => {
    try {
      console.log('📋 Cargando asignaciones para obra:', obra.id, 'empresa:', empresaSeleccionada.id);

      // 1. Obtener ASIGNACIONES POR OBRA COMPLETA
      const response = await fetch(
        `http://localhost:8080/api/obras/${obra.id}/asignaciones-profesionales`,
        {
          headers: {
            'empresaId': empresaSeleccionada.id.toString(),
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('📡 Asignaciones por obra response status:', response.status);

      let dataObra = [];
      if (response.ok) {
        dataObra = await response.json();
        console.log('✅ Asignaciones por obra cargadas:', dataObra.length || 0);
      }

      // 2. Obtener ASIGNACIONES SEMANALES
      let dataSemanal = [];
      try {
        const { obtenerAsignacionesSemanalPorObra } = await import('../services/profesionalesObraService');
        const responseSemanal = await obtenerAsignacionesSemanalPorObra(obra.id, empresaSeleccionada.id);
        dataSemanal = responseSemanal?.data?.data || responseSemanal?.data || responseSemanal || [];
        console.log('✅ Asignaciones semanales cargadas:', dataSemanal.length || 0);
      } catch (error) {
        console.warn('⚠️ No se pudieron cargar asignaciones semanales:', error);
      }

      // 3. COMBINAR AMBOS TIPOS DE ASIGNACIONES
      const todasLasAsignaciones = [...dataObra, ...dataSemanal];
      console.log('✅ Total asignaciones combinadas:', todasLasAsignaciones.length);

      const data = todasLasAsignaciones;
      console.log('📡 Asignaciones response status:', response.status);

        // Log detallado de cada asignación para verificar estructura de IDs
        if (data && data.length > 0) {
          console.log('🔍 Estructura completa de primera asignación:', JSON.stringify(data[0], null, 2));
          data.forEach((asig, idx) => {
            console.log(`  Asignación ${idx + 1}:`, {
              id: asig.id,
              tipoId: typeof asig.id,
              profesionalId: asig.profesionalId,
              obraId: asig.obraId,
              profesionalNombre: asig.profesionalNombre,
              todosLosCampos: Object.keys(asig)
            });
          });
        }

        setAsignaciones(data || []);
      } else {
        const errorText = await response.text();
        console.warn('⚠️ No se pudieron cargar las asignaciones:', response.status, errorText);
        setAsignaciones([]);
      }
    } catch (err) {
      console.error('❌ Error cargando asignaciones:', err);
      setAsignaciones([]);
    }
  };

  // NOTA: Esta función ya no se usa porque los profesionales NO necesitan tener jornales configurados
  // Los jornales se descuentan del presupuesto, no del profesional
  // Solo se requiere que el profesional esté activo y disponible
  /*
  const calcularJornalesDisponiblesProfesional = (profesional) => {
    if (!profesional || !profesional.dias) return 0;

  // Función para verificar si un profesional está disponible en las fechas especificadas
  // Verifica TODAS las asignaciones del profesional (incluyendo otras obras)
  const verificarDisponibilidadPorFechas = (profesionalId, fechaInicio, fechaFin) => {
    // Obtener TODAS las asignaciones del profesional desde obrasDelProfesional
    // que incluye asignaciones de todas las obras, no solo la actual
    const todasLasAsignaciones = obrasDelProfesional || [];

    if (todasLasAsignaciones.length === 0) {
      return { disponible: true, conflictos: [] };
    }

    const conflictos = [];
    const inicio = fechaInicio ? new Date(fechaInicio) : null;
    const fin = fechaFin ? new Date(fechaFin) : null;

    todasLasAsignaciones.forEach(asignacion => {
      // Verificar solo asignaciones del profesional seleccionado
      if (asignacion.profesionalId !== profesionalId) return;

      const asigInicio = asignacion.fechaDesde ? new Date(asignacion.fechaDesde) : null;
      const asigFin = asignacion.fechaHasta ? new Date(asignacion.fechaHasta) : null;

      // Verificar solapamiento de fechas
      let hayConflicto = false;

      // Si hay fechas de inicio y fin en ambas asignaciones
      if (inicio && fin && asigInicio && asigFin) {
        // Hay conflicto si los rangos se solapan
        hayConflicto = (inicio <= asigFin && fin >= asigInicio);
      }
      // Si solo hay fecha de inicio en la nueva asignación
      else if (inicio && !fin) {
        if (asigFin) {
          hayConflicto = inicio <= asigFin;
        } else if (asigInicio) {
          hayConflicto = true; // Asignación existente sin fin
        }
      }
      // Si solo hay fecha de fin en la nueva asignación
      else if (!inicio && fin) {
        if (asigInicio) {
          hayConflicto = fin >= asigInicio;
        } else if (asigFin) {
          hayConflicto = true; // Asignación existente sin inicio
        }
      }
      // Si no hay fechas en la nueva asignación
      else if (!inicio && !fin) {
        hayConflicto = (asigInicio || asigFin); // Conflicto si la existente tiene fechas
      }

      if (hayConflicto) {
        conflictos.push({
          fechaDesde: asignacion.fechaDesde,
          fechaHasta: asignacion.fechaHasta,
          obraNombre: asignacion.obraNombre || 'Obra no especificada',
          rubroNombre: asignacion.rubroNombre,
          obraId: asignacion.obraId
        });
      }
    });

    return {
      disponible: conflictos.length === 0,
      conflictos
    };
  };

    // Total de jornales del profesional
    const jornalesTotales = profesional.dias;

    // Jornales ya asignados en TODAS las asignaciones
    const jornalesAsignados = asignaciones
      .filter(a => a.profesionalId === profesional.id && a.tipoAsignacion === 'JORNAL')
      .reduce((sum, a) => sum + (a.cantidadJornales || 0), 0);

    return jornalesTotales - jornalesAsignados;
  };
  */

  // Función auxiliar para diagnosticar errores del backend
  const generarReporteDiagnostico = (errorData, payload, contexto) => {
    const reporte = {
      timestamp: new Date().toISOString(),
      error: errorData,
      payload: payload,
      contexto: contexto,
      validacionFrontend: {
        jornalesDisponibles: contexto.jornal?.cantidad || 0,
        jornalesSolicitados: payload.cantidadJornales,
        validacionPaso: contexto.jornal?.cantidad >= payload.cantidadJornales
      }
    };

    console.group('🚨 REPORTE DE DIAGNÓSTICO - ERROR DEL BACKEND');
    console.error('📋 Información completa:', reporte);
    console.error('⚠️ El backend reporta:', errorData);
    console.log('✅ Frontend validó:', `${contexto.jornal?.cantidad || 0} jornales disponibles`);
    console.log('📤 Payload enviado:', payload);
    console.log('🔍 Contexto completo:', contexto);
    console.groupEnd();

    return reporte;
  };

  // Calcular jornales disponibles por rubro (para mostrar en UI)
  const calcularJornalesDisponibles = (rubro) => {
    if (!rubro.cantidadJornales) return 0;

    const jornalesAsignados = asignaciones
      .filter(a => String(a.rubroId) === String(rubro.id) && a.tipoAsignacion === 'JORNAL')
      .reduce((sum, a) => sum + (a.cantidadJornales || 0), 0);

    return rubro.cantidadJornales - jornalesAsignados;
  };

  // Cargar obras asignadas a un profesional
  const cargarObrasDelProfesional = async (profesionalId) => {
    if (!profesionalId) {
      setObrasDelProfesional([]);
      return;
    }

    setLoadingObras(true);
    try {
      console.log('🔍 Cargando obras del profesional:', profesionalId);

      const response = await fetch(
        `http://localhost:8080/api/profesionales-obras/profesional/${profesionalId}`,
        {
          headers: {
            'empresaId': empresaSeleccionada.id.toString(),
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Obras del profesional cargadas:', data);
        setObrasDelProfesional(data || []);
      } else {
        console.error('❌ Error cargando obras del profesional:', response.status);
        setObrasDelProfesional([]);
      }
    } catch (err) {
      console.error('❌ Error cargando obras del profesional:', err);
      setObrasDelProfesional([]);
    } finally {
      setLoadingObras(false);
    }
  };

  // Manejar cambios en el formulario
  const handleChange = (field, value) => {
    if (field === 'profesionalId') {
      setNuevaAsignacion({ ...nuevaAsignacion, profesionalId: value });
      // Cargar obras del profesional seleccionado
      cargarObrasDelProfesional(value);
    } else if (field === 'rubroId') {
      // El valor viene como: "1688-prof-3776" o "1689-jornal-697"
      const parts = value.split('-');
      if (parts.length === 3) {
        const [rubroId, tipo, itemId] = parts;
        setNuevaAsignacion({
          ...nuevaAsignacion,
          rubroId: rubroId,
          rubroSelectorValue: value, // Guardar valor completo para el select
          itemId: itemId,
          tipoAsignacion: tipo === 'prof' ? 'HONORARIO' : 'JORNAL',
          cantidadJornales: '' // Resetear cantidad
        });
      } else {
        // Si no tiene el formato esperado, resetear
        setNuevaAsignacion({
          ...nuevaAsignacion,
          rubroId: value,
          rubroSelectorValue: value,
          itemId: '',
          tipoAsignacion: '',
          cantidadJornales: ''
        });
      }
    } else {
      setNuevaAsignacion({ ...nuevaAsignacion, [field]: value });
    }
  };


  // Agregar nueva asignación
  const handleAgregarAsignacion = async () => {
    if (!nuevaAsignacion.profesionalId) {
      alert('⚠️ Debe seleccionar un profesional');
      return;
    }

    // VALIDACIÓN DE DISPONIBILIDAD POR FECHAS
    const disponibilidad = verificarDisponibilidadPorFechas(
      Number(nuevaAsignacion.profesionalId),
      nuevaAsignacion.fechaInicio,
      nuevaAsignacion.fechaFin
    );

    if (!disponibilidad.disponible) {
      const profesional = profesionalesDisponibles.find(p => p.id === Number(nuevaAsignacion.profesionalId));
      alert(
        `⚠️ CONFLICTO DE ASIGNACIÓN\n\n` +
        `El profesional ${profesional?.nombre || 'seleccionado'} ya está asignado en otras obras durante las fechas seleccionadas:\n\n` +
        disponibilidad.conflictos.map((c, idx) =>
          `${idx + 1}. ${c.obraNombre}\n` +
          `   ${c.fechaDesde ? `Desde: ${new Date(c.fechaDesde).toLocaleDateString('es-AR')}` : ''}\n` +
          `   ${c.fechaHasta ? `Hasta: ${new Date(c.fechaHasta).toLocaleDateString('es-AR')}` : ''}`
        ).join('\n\n') +
        `\n\n❌ No se puede asignar el mismo profesional en fechas que se solapan.\n` +
        `Por favor, modifica las fechas o selecciona otro profesional.`
      );
      return;
    }

    // VALIDACIÓN DEFINITIVA: Verificar jornales disponibles en el presupuesto
    if (nuevaAsignacion.tipoAsignacion === 'JORNAL' && nuevaAsignacion.cantidadJornales) {
      const rubro = presupuesto.itemsCalculadora?.find(r => String(r.id) === String(nuevaAsignacion.rubroId));

      if (rubro) {
        const jornal = rubro.jornales?.find(j => String(j.id) === String(nuevaAsignacion.itemId));

        if (jornal) {
          // Calcular jornales ya asignados de este item
          const jornalesAsignados = asignaciones
            .filter(a => String(a.itemId) === String(jornal.id) && a.tipoAsignacion === 'JORNAL')
            .reduce((sum, a) => sum + (a.cantidadJornales || 0), 0);

          const jornalesDisponibles = (jornal.cantidad || 0) - jornalesAsignados;
          const cantidadSolicitada = Number(nuevaAsignacion.cantidadJornales);

          if (cantidadSolicitada > jornalesDisponibles) {
            alert(`⚠️ No hay suficientes jornales disponibles en el presupuesto.\n\n` +
                  `Jornal: ${jornal.rol}\n` +
                  `Total en presupuesto: ${jornal.cantidad}\n` +
                  `Ya asignados: ${jornalesAsignados}\n` +
                  `Disponibles: ${jornalesDisponibles}\n` +
                  `Solicitados: ${cantidadSolicitada}\n\n` +
                  `Los jornales se descuentan automáticamente del presupuesto.`);
            return;
          }
        }
      }
    }

    if (!nuevaAsignacion.rubroId) {
      alert('⚠️ Debe seleccionar un rubro/item del presupuesto');
      return;
    }

    if (!nuevaAsignacion.tipoAsignacion) {
      alert('⚠️ El tipo de asignación no pudo ser detectado. Verifique el rubro seleccionado.');
      return;
    }

    if (nuevaAsignacion.tipoAsignacion === 'JORNAL' && !nuevaAsignacion.cantidadJornales) {
      alert('⚠️ Debe especificar la cantidad de jornales');
      return;
    }

    // Validar que el profesional exista
    const profesional = profesionalesDisponibles.find(p => p.id === Number(nuevaAsignacion.profesionalId));

    if (!profesional) {
      alert('⚠️ No se encontró el profesional seleccionado');
      return;
    }

    // Nota: NO validamos jornales del profesional porque solo necesita estar disponible
    // Los jornales se descuentan del presupuesto, no del profesional

    setLoading(true);
    try {
      // Obtener datos del profesional y rubro seleccionados
      const profesional = profesionalesDisponibles.find(p => p.id === Number(nuevaAsignacion.profesionalId));

      // Buscar el rubro en itemsCalculadora
      const rubro = presupuesto.itemsCalculadora?.find(r => String(r.id) === String(nuevaAsignacion.rubroId));

      if (!rubro) {
        alert('⚠️ No se pudo encontrar el rubro seleccionado en el presupuesto');
        setLoading(false);
        return;
      }

      // Obtener el nombre del rubro (tipoProfesional)
      const rubroNombre = rubro.tipoProfesional || `Rubro ${nuevaAsignacion.rubroId}`;

      // Buscar información del jornal o profesional para enviar datos completos al backend
      const jornal = rubro.jornales?.find(j => String(j.id) === String(nuevaAsignacion.itemId));
      const profesionalItem = rubro.profesionales?.find(p => String(p.id) === String(nuevaAsignacion.itemId));

      // Preparar payload según especificaciones del backend
      const payload = {
        profesionalId: Number(nuevaAsignacion.profesionalId),
        rubroId: Number(nuevaAsignacion.rubroId), // CRÍTICO: Number, no String
        rubroNombre: rubroNombre,
        itemId: Number(nuevaAsignacion.itemId), // CRÍTICO: Number, no String
        tipoAsignacion: nuevaAsignacion.tipoAsignacion,
        cantidadJornales: Number(nuevaAsignacion.cantidadJornales),
        // Información adicional del jornal/profesional
        itemNombre: jornal ? jornal.rol : (profesionalItem ? profesionalItem.tipo : null),
        // Fechas según backend (fechaInicio/fechaFin, no fechaDesde/fechaHasta)
        fechaInicio: nuevaAsignacion.fechaInicio || null,
        fechaFin: nuevaAsignacion.fechaFin || null,
        observaciones: nuevaAsignacion.observaciones || null
      };

      console.log('📤 Creando asignación con payload completo:', {
        url: `http://localhost:8080/api/obras/${obra.id}/asignaciones-profesionales`,
        headers: {
          'Content-Type': 'application/json',
          'empresaId': empresaSeleccionada.id.toString()
        },
        payload,
        verificacionTipos: {
          'profesionalId es Number': typeof payload.profesionalId === 'number',
          'rubroId es Number': typeof payload.rubroId === 'number',
          'itemId es Number': typeof payload.itemId === 'number',
          'cantidadJornales es Number': typeof payload.cantidadJornales === 'number',
          valoresTipos: {
            profesionalId: typeof payload.profesionalId,
            rubroId: typeof payload.rubroId,
            itemId: typeof payload.itemId,
            cantidadJornales: typeof payload.cantidadJornales
          }
        },
        contexto: {
          profesional: profesional?.nombre,
          rubro: rubroNombre,
          jornal: jornal,
          jornalesDisponiblesEnPresupuesto: jornal ? jornal.cantidad : 'N/A'
        }
      });

      const response = await fetch(
        `http://localhost:8080/api/obras/${obra.id}/asignaciones-profesionales`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'empresaId': empresaSeleccionada.id.toString()
          },
          body: JSON.stringify(payload)
        }
      );

      console.log('📡 Response status:', response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Asignación creada:', data);
        alert('✅ Profesional asignado exitosamente');
        await cargarAsignacionesActuales();

        // Resetear formulario
        setNuevaAsignacion({
          profesionalId: '',
          rubroId: '',
          rubroSelectorValue: '',
          itemId: '',
          tipoAsignacion: '',
          cantidadJornales: '',
          fechaInicio: '',
          fechaFin: '',
          observaciones: ''
        });

        // Limpiar también las obras del profesional
        setObrasDelProfesional([]);

        if (onAsignacionExitosa) {
          onAsignacionExitosa();
        }
      } else {
        // Manejar errores según especificaciones del backend
        let errorMessage;
        try {
          const errorJson = await response.json();
          errorMessage = errorJson.message || errorJson.error || 'Error desconocido';
        } catch {
          errorMessage = await response.text();
        }

        console.error('❌ Error del servidor:', response.status, errorMessage);

        // Manejo de errores según especificación del backend
        if (response.status === 400) {
          // Error de validación (jornales insuficientes, profesional inactivo, etc.)
          if (errorMessage.includes('Jornales insuficientes')) {
            alert(`⚠️ ${errorMessage}\n\nEl backend validó que no hay suficientes jornales disponibles.\nVerifica que no haya otras asignaciones activas usando estos jornales.`);
          } else {
            alert(`⚠️ Error de validación:\n\n${errorMessage}`);
          }
        } else if (response.status === 404) {
          // Configuración no encontrada (presupuesto, rubro o jornal)
          alert(`⚠️ Configuración no encontrada:\n\n${errorMessage}\n\nVerifica que el presupuesto, rubro y jornal existan correctamente.`);
        } else if (response.status === 500) {
          // Error interno del servidor
          alert('❌ Error interno del servidor.\n\nContacte al administrador del sistema.');
          console.error('Error 500 - Detalles:', errorMessage);
        } else {
          alert(`❌ Error ${response.status}:\n\n${errorMessage}`);
        }
        return;
      }
    } catch (err) {
      alert('❌ Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Eliminar asignación
  const handleEliminarAsignacion = async (asignacionId) => {
    if (!confirm('¿Está seguro de eliminar esta asignación?')) return;

    const url = `http://localhost:8080/api/obras/${obra.id}/asignaciones-profesionales/${asignacionId}`;

    console.log('🗑️ Eliminando asignación:', {
      asignacionId,
      obraId: obra.id,
      empresaId: empresaSeleccionada.id,
      url
    });

    setLoading(true);
    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'empresaId': empresaSeleccionada.id.toString(),
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Response DELETE status:', response.status);

      if (response.ok) {
        console.log('✅ Asignación eliminada exitosamente');
        alert('✅ Asignación eliminada exitosamente');

        // Recargar asignaciones
        await cargarAsignacionesActuales();

        // Si hay un profesional seleccionado, recargar sus obras para actualizar disponibilidad
        if (nuevaAsignacion.profesionalId) {
          await cargarObrasDelProfesional(nuevaAsignacion.profesionalId);
        }

        // Notificar al componente padre
        if (onAsignacionExitosa) {
          onAsignacionExitosa();
        }
      } else {
        // Manejar errores según el status code
        let errorMessage;
        try {
          const errorJson = await response.json();
          errorMessage = errorJson.message || errorJson.error || 'Error desconocido';
        } catch {
          errorMessage = await response.text();
        }

        console.error('❌ Error al eliminar:', response.status, errorMessage);

        if (response.status === 404) {
          alert('⚠️ Asignación no encontrada.\n\n' + errorMessage);
        } else if (response.status === 400) {
          alert('⚠️ Error de validación:\n\n' + errorMessage);
        } else if (response.status === 500) {
          alert('❌ Error interno del servidor.\n\n' + errorMessage + '\n\nContacte al administrador del sistema.');
          console.error('Error 500 - Detalles completos:', errorMessage);
        } else {
          alert(`❌ Error ${response.status}:\n\n${errorMessage}`);
        }
      }
    } catch (err) {
      console.error('❌ Exception al eliminar:', err);
      alert('❌ Error de conexión: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl" style={{ maxWidth: '95%', marginTop: '20px' }}>
        <div className="modal-content">
          {/* Header */}
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">
              <i className="fas fa-users-cog me-2"></i>
              Asignar Profesionales a: {obra?.nombre}
            </h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          {/* Body */}
          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {loadingPresupuesto ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Cargando...</span>
                </div>
                <p className="mt-2 text-muted">Cargando presupuesto...</p>
              </div>
            ) : error ? (
              <div className="alert alert-warning">
                <i className="fas fa-exclamation-triangle me-2"></i>
                {error}
              </div>
            ) : !presupuesto ? (
              <div className="alert alert-info">
                <i className="fas fa-info-circle me-2"></i>
                Esta obra no tiene un presupuesto vinculado.
              </div>
            ) : (
              <>
                {/* Información del presupuesto */}
                <div className="card mb-4 border-info">
                  <div className="card-header bg-info text-white">
                    <h6 className="mb-0">
                      <i className="fas fa-file-invoice me-2"></i>
                      Presupuesto: {presupuesto.numeroPresupuesto || 'S/N'}
                    </h6>
                  </div>
                  <div className="card-body">
                    <div className="alert alert-info mb-3">
                      <i className="fas fa-info-circle me-2"></i>
                      <strong>Flujo de trabajo:</strong>
                      <ul className="mb-0 mt-2">
                        <li><strong>Profesionales:</strong> Solo necesitan estar activos y disponibles (NO requieren jornales en su perfil)</li>
                        <li><strong>Jornales del presupuesto:</strong> Se descuentan automáticamente del presupuesto cuando los asignas</li>
                        <li><strong>Disponibilidad:</strong> Se actualiza automáticamente según las obras asignadas</li>
                        <li><strong>Un profesional puede estar en múltiples obras simultáneamente</strong></li>
                      </ul>
                    </div>
                    <div className="row">
                      <div className="col-md-4">
                        <strong>Estado:</strong> <span className="badge bg-secondary">{presupuesto.estado}</span>
                      </div>
                      <div className="col-md-4">
                        <strong>Versión:</strong> {presupuesto.numeroVersion}
                      </div>
                      <div className="col-md-4">
                        <strong>Monto Total:</strong> ${presupuesto.totalFinal?.toLocaleString('es-AR')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 🆕 ANÁLISIS DE IMPACTO EN TIEMPO DE OBRA */}
                {presupuesto.tiempoEstimadoTerminacion ? (
                  <div className="card mb-4 border-primary" style={{ boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                    <div className="card-header bg-gradient" style={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white'
                    }}>
                      <h6 className="mb-0">
                        <i className="fas fa-calendar-check me-2"></i>
                        Análisis de Impacto en Tiempos de Obra
                      </h6>
                    </div>
                    <div className="card-body">
                      {(() => {
                        // 🏗️ PARA EL CÁLCULO DE DÍAS: Solo rubros marcados con incluirEnCalculoDias = true
                        const jornalesPlanificados = presupuesto.itemsCalculadora?.reduce((total, rubro) => {
                          // ✅ FILTRAR rubros duplicados/legacy
                          const esLegacyDuplicado = rubro.tipoProfesional?.toLowerCase().includes('migrado') ||
                                                    rubro.tipoProfesional?.toLowerCase().includes('legacy') ||
                                                    rubro.descripcion?.toLowerCase().includes('migrados desde tabla legacy');

                          if (esLegacyDuplicado) return total;

                          // Por defecto incluir si no está definido (retrocompatibilidad)
                          const incluir = rubro.incluirEnCalculoDias !== false;
                          if (!incluir) return total;

                          const jornalesRubro = rubro.jornales?.reduce((sum, j) => sum + (j.cantidad || 0), 0) || 0;
                          const profesionalesRubro = rubro.profesionales?.reduce((sum, p) => sum + (p.cantidadJornales || 0), 0) || 0;
                          return total + jornalesRubro + profesionalesRubro;
                        }, 0) || 0;

                        // Jornales asignados de los rubros incluidos en cálculo
                        // Obtener lista de rubros que están marcados para incluir
                        const rubrosIncluidos = presupuesto.itemsCalculadora?.filter(rubro => {
                          const esLegacyDuplicado = rubro.tipoProfesional?.toLowerCase().includes('migrado') ||
                                                    rubro.tipoProfesional?.toLowerCase().includes('legacy') ||
                                                    rubro.descripcion?.toLowerCase().includes('migrados desde tabla legacy');
                          if (esLegacyDuplicado) return false;
                          return rubro.incluirEnCalculoDias !== false;
                        }).map(r => r.tipoProfesional?.trim().toLowerCase()) || [];

                        const jornalesAsignados = asignaciones.reduce((sum, a) => {
                          const rubroNombre = a.rubroNombre?.trim().toLowerCase();
                          const estaIncluido = rubrosIncluidos.some(r => rubroNombre?.includes(r?.split(' ')[0])); // Comparar palabra clave
                          if (!estaIncluido) return sum;
                          return sum + (a.cantidadJornales || 0);
                        }, 0);

                        // 🧮 NUEVA LÓGICA: Calcular días según profesionales asignados
                        // cantidadJornales en asignación = cantidad de profesionales de ese rol
                        // Cada profesional aporta 1 jornal/día de capacidad
                        // Días necesarios = Jornales totales / Capacidad diaria

                        const capacidadDiaria = jornalesAsignados; // Cada unidad en cantidadJornales = 1 profesional = 1 jornal/día
                        const diasEstimadosOriginal = Number(presupuesto.tiempoEstimadoTerminacion) || 0;

                        // Si no hay asignaciones, mostrar advertencia
                        if (capacidadDiaria === 0) {
                          return (
                            <div className="alert alert-warning mb-0">
                              <div className="d-flex align-items-start">
                                <i className="fas fa-exclamation-triangle fa-2x me-3" style={{ marginTop: '4px' }}></i>
                                <div>
                                  <h6 className="alert-heading mb-2">⚠️ Sin Profesionales Asignados</h6>
                                  <p className="mb-2">
                                    <strong>Jornales totales necesarios:</strong> {jornalesPlanificados} jornales-día de trabajo
                                  </p>
                                  <p className="mb-2">
                                    <strong>Días estimados (referencia):</strong> {diasEstimadosOriginal} días hábiles
                                  </p>
                                  <hr />
                                  <p className="mb-0 text-info">
                                    <i className="fas fa-info-circle me-2"></i>
                                    Los días reales dependerán de cuántos profesionales asignes.
                                    Más profesionales = menos días para terminar la obra.
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // 🧮 CÁLCULO DE DÍAS REALES SEGÚN CAPACIDAD DIARIA
                        // Jornales totales = trabajo total a realizar (del presupuesto)
                        // Capacidad diaria = suma de profesionales asignados (cada prof. = 1 jornal/día)
                        // Días reales = Jornales totales ÷ Capacidad diaria

                        const diasRealesEstimados = Math.ceil(jornalesPlanificados / capacidadDiaria);
                        const diferenciaDias = diasRealesEstimados - diasEstimadosOriginal;
                        const porcentajeCapacidad = (capacidadDiaria / (jornalesPlanificados / diasEstimadosOriginal) * 100);

                        // Determinar tipo de alerta
                        let alertType, alertIcon, alertMessage, alertTitle, solucionSugerida;

                        if (diasRealesEstimados > diasEstimadosOriginal) {
                          // Poca capacidad = más días
                          const capacidadNecesaria = Math.ceil(jornalesPlanificados / diasEstimadosOriginal);
                          const profesionalesFaltantes = capacidadNecesaria - capacidadDiaria;

                          alertType = 'danger';
                          alertIcon = '🚨';
                          alertTitle = 'ATENCIÓN: Necesitas más profesionales';
                          alertMessage = `Con ${asignaciones.length} profesional${asignaciones.length !== 1 ? 'es' : ''} (${capacidadDiaria} jornales/día), la obra tardará ${diasRealesEstimados} días. Necesitas ${Math.abs(diferenciaDias)} día${Math.abs(diferenciaDias) !== 1 ? 's' : ''} MÁS de lo planificado (${diasEstimadosOriginal} días).`;
                          solucionSugerida = (
                            <div className="alert alert-warning mt-3 mb-0">
                              <h6 className="alert-heading mb-2">
                                <i className="fas fa-lightbulb me-2"></i>
                                💡 Solución para cumplir el plazo de {diasEstimadosOriginal} días hábiles:
                              </h6>

                              {/* Trabajo total */}
                              <div className="bg-info bg-opacity-10 p-3 rounded border border-info mb-3">
                                <h6 className="text-info mb-2">
                                  <i className="fas fa-hard-hat me-2"></i>
                                  Trabajo total a realizar:
                                </h6>
                                <div className="fs-4 fw-bold text-primary">
                                  {jornalesPlanificados} jornales-día
                                </div>
                                <small className="text-muted">
                                  Esto es fijo según el presupuesto (no cambia)
                                </small>
                              </div>

                              {/* Cálculo de profesionales */}
                              <div className="bg-danger bg-opacity-10 p-3 rounded border border-danger mb-2">
                                <h6 className="text-danger mb-2">
                                  <i className="fas fa-tachometer-alt me-2"></i>
                                  Capacidad diaria necesaria para cumplir el plazo:
                                </h6>
                                <div className="row g-2 align-items-center">
                                  <div className="col-md-4">
                                    <small className="text-muted d-block">Capacidad actual:</small>
                                    <div className="fs-4 fw-bold text-secondary">
                                      {capacidadDiaria} jornales/día
                                    </div>
                                    <small className="text-muted">({asignaciones.length} profesional{asignaciones.length !== 1 ? 'es' : ''})</small>
                                  </div>
                                  <div className="col-md-4">
                                    <small className="text-muted d-block">Capacidad necesaria:</small>
                                    <div className="fs-4 fw-bold text-success">
                                      {capacidadNecesaria} jornales/día
                                    </div>
                                    <small className="text-muted">(equivalente a {capacidadNecesaria} jornales/día)</small>
                                  </div>
                                  <div className="col-md-4">
                                    <small className="text-muted d-block">Te faltan:</small>
                                    <div className="fs-4 fw-bold text-danger">
                                      +{profesionalesFaltantes} jornales/día
                                    </div>
                                  </div>
                                </div>
                                <hr className="my-2" />
                                <small className="text-muted d-block">
                                  <i className="fas fa-calculator me-1"></i>
                                  <strong>Cálculo:</strong> {jornalesPlanificados} jornales ÷ {diasEstimadosOriginal} días = {capacidadNecesaria} jornales/día necesarios
                                </small>
                                <small className="text-muted d-block mt-1">
                                  <i className="fas fa-clock me-1"></i>
                                  <strong>Con tu capacidad actual:</strong> {jornalesPlanificados} jornales ÷ {capacidadDiaria} jornales/día = {diasRealesEstimados} días
                                </small>
                              </div>

                              <small className="text-muted d-block">
                                <i className="fas fa-info-circle me-1"></i>
                                Necesitas aumentar la capacidad diaria (más profesionales o más jornales por profesional). Revisa el presupuesto para ver qué roles necesitas.
                              </small>
                            </div>
                          );
                        } else if (Math.abs(diferenciaDias) <= 5) {
                          // Igual o casi igual = a tiempo
                          alertType = 'success';
                          alertIcon = '✅';
                          alertTitle = 'PERFECTO: Finalizarás A TIEMPO';
                          alertMessage = `Con ${asignaciones.length} profesional${asignaciones.length !== 1 ? 'es' : ''} asignado${asignaciones.length !== 1 ? 's' : ''} (${capacidadDiaria} jornales/día de capacidad), la obra se completará en aproximadamente ${diasRealesEstimados} días, cumpliendo con el plazo estimado.`;
                          solucionSugerida = null;
                        } else {
                          // Más capacidad = menos días
                          alertType = 'info';
                          alertIcon = '🚀';
                          alertTitle = 'EXCELENTE: Terminarás ANTES';
                          alertMessage = `Con ${asignaciones.length} profesional${asignaciones.length !== 1 ? 'es' : ''} asignado${asignaciones.length !== 1 ? 's' : ''} (${capacidadDiaria} jornales/día de capacidad), la obra se completará en ${diasRealesEstimados} días. ¡Terminarás ${Math.abs(diferenciaDias)} día${Math.abs(diferenciaDias) !== 1 ? 's' : ''} ANTES de lo planificado!`;
                          solucionSugerida = null;
                        }

                        return (
                          <>
                            <div className={`alert alert-${alertType} mb-3`} style={{
                              border: `2px solid var(--bs-${alertType})`,
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}>
                              <div className="d-flex align-items-start">
                                <span className="fs-2 me-3">{alertIcon}</span>
                                <div className="flex-grow-1">
                                  <h5 className="alert-heading mb-2">{alertTitle}</h5>
                                  <p className="mb-2">{alertMessage}</p>
                                  <hr />
                                  <div className="row g-3 mb-0">
                                    <div className="col-md-4">
                                      <strong>📅 Días planificados:</strong>
                                      <div className="fs-4 fw-bold text-primary">{diasEstimadosOriginal} días</div>
                                    </div>
                                    <div className="col-md-4">
                                      <strong>📊 Días reales estimados:</strong>
                                      <div className={`fs-4 fw-bold text-${alertType}`}>
                                        {diasRealesEstimados} días
                                      </div>
                                    </div>
                                    <div className="col-md-4">
                                      <strong>⏱️ Diferencia:</strong>
                                      <div className={`fs-4 fw-bold text-${alertType}`}>
                                        {diferenciaDias > 0 ? '+' : ''}{diferenciaDias} días
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Solución sugerida (solo si hay déficit) */}
                            {solucionSugerida}

                            {/* Desglose detallado */}
                            <div className="row g-3">
                              <div className="col-md-6">
                                <div className="card bg-light">
                                  <div className="card-body">
                                    <h6 className="text-muted mb-3">
                                      <i className="fas fa-file-invoice me-2"></i>
                                      Planificación Original (Presupuesto)
                                    </h6>
                                    <div className="mb-2">
                                      <strong>Jornales necesarios:</strong>
                                      <span className="badge bg-primary ms-2 fs-6">{jornalesPlanificados}</span>
                                    </div>
                                    <div className="mb-2">
                                      <strong>Días estimados:</strong>
                                      <span className="badge bg-primary ms-2 fs-6">{diasEstimadosOriginal} días</span>
                                    </div>
                                    {presupuesto.fechaProbableInicio && (
                                      <div className="mb-0">
                                        <strong>Fecha inicio:</strong>
                                        <span className="ms-2">{new Date(presupuesto.fechaProbableInicio).toLocaleDateString('es-AR')}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="col-md-6">
                                <div className="card bg-light">
                                  <div className="card-body">
                                    <h6 className="text-muted mb-3">
                                      <i className="fas fa-users me-2"></i>
                                      Asignaciones Actuales
                                    </h6>
                                    <div className="mb-2">
                                      <strong>Profesionales asignados:</strong>
                                      <span className="badge bg-secondary ms-2 fs-6">{asignaciones.length} {asignaciones.length === 1 ? 'persona' : 'personas'}</span>
                                    </div>
                                    <div className="mb-2">
                                      <strong>Capacidad total:</strong>
                                      <span className={`badge bg-${alertType} ms-2 fs-6`}>{capacidadDiaria} jornal{capacidadDiaria !== 1 ? 'es' : ''}/día</span>
                                    </div>
                                    <div className="mb-0">
                                      <strong>Días estimados:</strong>
                                      <span className={`badge bg-${alertType} ms-2 fs-6`}>{diasRealesEstimados} días</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Barra de progreso visual */}
                            <div className="mt-3">
                              <label className="form-label fw-bold">
                                Capacidad vs. Necesaria
                              </label>
                              <div className="progress" style={{ height: '30px' }}>
                                <div
                                  className={`progress-bar progress-bar-striped progress-bar-animated bg-${alertType}`}
                                  role="progressbar"
                                  style={{ width: `${Math.min(porcentajeCapacidad, 100)}%` }}
                                  aria-valuenow={porcentajeCapacidad}
                                  aria-valuemin="0"
                                  aria-valuemax="100"
                                >
                                  {porcentajeCapacidad.toFixed(1)}%
                                </div>
                              </div>
                              <small className="text-muted d-block mt-1">
                                {porcentajeCapacidad < 100 && '⬅️ Insuficiente - Necesitas más profesionales'}
                                {porcentajeCapacidad >= 100 && porcentajeCapacidad < 150 && '✅ Óptimo - Capacidad adecuada'}
                                {porcentajeCapacidad >= 150 && '➡️ Excedente - Terminarás mucho antes'}
                              </small>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-warning mb-4">
                    <div className="d-flex align-items-start">
                      <i className="fas fa-exclamation-triangle fa-2x me-3"></i>
                      <div>
                        <h6 className="alert-heading mb-2">⚠️ No se puede calcular impacto en tiempos</h6>
                        <p className="mb-2">
                          El presupuesto no tiene configurado el campo <strong>"Días Hábiles para final de Obra"</strong> (tiempoEstimadoTerminacion).
                        </p>
                        <p className="mb-0">
                          <strong>Para ver el análisis de impacto:</strong> Edita el presupuesto y completa el campo "Días Hábiles" con la cantidad de días que estimaste para terminar la obra.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Resumen de Jornales Disponibles */}
                <div className="card mb-4 border-warning">
                  <div className="card-header bg-warning text-dark">
                    <h6 className="mb-0">
                      <i className="fas fa-chart-bar me-2"></i>
                      Resumen de Jornales Disponibles
                    </h6>
                  </div>
                  <div className="card-body">
                    {presupuesto.itemsCalculadora?.filter(rubro => {
                      // Filtrar rubros duplicados/legacy
                      const esLegacyDuplicado = rubro.tipoProfesional?.toLowerCase().includes('migrado') ||
                                                rubro.tipoProfesional?.toLowerCase().includes('legacy') ||
                                                rubro.descripcion?.toLowerCase().includes('migrados desde tabla legacy');
                      return !esLegacyDuplicado;
                    }).map((rubro, idx) => {
                      const totalProfesionales = rubro.profesionales?.reduce((sum, p) => sum + (p.cantidadJornales || 0), 0) || 0;
                      const totalJornales = rubro.jornales?.reduce((sum, j) => sum + (j.cantidad || 0), 0) || 0;
                      const asignadosProfesionales = asignaciones.filter(a => a.rubroId === rubro.id && a.tipoAsignacion === 'HONORARIO')
                        .reduce((sum, a) => sum + (a.cantidadJornales || 0), 0);
                      const asignadosJornales = asignaciones.filter(a => a.rubroId === rubro.id && a.tipoAsignacion === 'JORNAL')
                        .reduce((sum, a) => sum + (a.cantidadJornales || 0), 0);

                      return (
                        <div key={idx} className="mb-3 pb-3 border-bottom">
                          <h6 className="text-primary mb-2">📋 {rubro.tipoProfesional}</h6>
                          <div className="row">
                            {rubro.profesionales && rubro.profesionales.length > 0 && (
                              <div className="col-md-6">
                                <div className="alert alert-light mb-2">
                                  <strong>👤 Profesionales:</strong>
                                  {rubro.profesionales.map((prof, pIdx) => {
                                    const asignados = asignaciones.filter(a =>
                                      a.itemId === prof.id && a.tipoAsignacion === 'HONORARIO'
                                    ).reduce((sum, a) => sum + (a.cantidadJornales || 0), 0);
                                    const disponibles = (prof.cantidadJornales || 0) - asignados;

                                    return (
                                      <div key={pIdx} className="ms-3 mt-1">
                                        • {prof.tipo}:
                                        <span className="badge bg-info ms-2">{prof.cantidadJornales || 0} totales</span>
                                        <span className="badge bg-danger ms-1">{asignados} asignados</span>
                                        <span className={`badge ms-1 ${disponibles > 0 ? 'bg-success' : 'bg-secondary'}`}>
                                          {disponibles} disponibles
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {rubro.jornales && rubro.jornales.length > 0 && (
                              <div className="col-md-6">
                                <div className="alert alert-light mb-2">
                                  <strong>📅 Jornales:</strong>
                                  {rubro.jornales.map((jornal, jIdx) => {
                                    const asignados = asignaciones.filter(a =>
                                      a.itemId === jornal.id && a.tipoAsignacion === 'JORNAL'
                                    ).reduce((sum, a) => sum + (a.cantidadJornales || 0), 0);
                                    const disponibles = (jornal.cantidad || 0) - asignados;

                                    return (
                                      <div key={jIdx} className="ms-3 mt-1">
                                        • {jornal.rol}:
                                        <span className="badge bg-info ms-2">{jornal.cantidad || 0} totales</span>
                                        <span className="badge bg-danger ms-1">{asignados} asignados</span>
                                        <span className={`badge ms-1 ${disponibles > 0 ? 'bg-success' : 'bg-secondary'}`}>
                                          {disponibles} disponibles
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Formulario de nueva asignación */}
                <div className="card mb-4 border-success">
                  <div className="card-header bg-success text-white">
                    <h6 className="mb-0">
                      <i className="fas fa-plus-circle me-2"></i>
                      Nueva Asignación
                    </h6>
                  </div>
                  <div className="card-body">
                    <div className="row g-3">
                      {/* Seleccionar Profesional */}
                      <div className="col-md-4">
                        <label className="form-label">Profesional *</label>
                        <select
                          className="form-select select-profesionales-agrupado"
                          value={nuevaAsignacion.profesionalId}
                          onChange={(e) => handleChange('profesionalId', e.target.value)}
                        >
                          <option value="">Seleccionar profesional...</option>
                          {(() => {
                            // Agrupar profesionales por tipo
                            const profesionalesPorTipo = profesionalesDisponibles
                              .filter(p => p.activo)
                              .reduce((acc, prof) => {
                                const tipo = prof.tipoProfesional || 'Sin Categoría';
                                if (!acc[tipo]) acc[tipo] = [];
                                acc[tipo].push(prof);
                                return acc;
                              }, {});

                            // Definir colores y orden para cada categoría
                            const ordenCategorias = {
                              'Oficial Albañil': { orden: 1, color: '#8B4513', emoji: '🧱' },
                              'Ayudante Albañil': { orden: 2, color: '#A0522D', emoji: '🧱' },
                              'Oficial Pintor': { orden: 3, color: '#4169E1', emoji: '🎨' },
                              'Ayudante Pintor': { orden: 4, color: '#6495ED', emoji: '🎨' },
                              'Oficial Plomero': { orden: 5, color: '#20B2AA', emoji: '🔧' },
                              'Ayudante Plomero': { orden: 6, color: '#48D1CC', emoji: '🔧' },
                              'Oficial Electricista': { orden: 7, color: '#FFD700', emoji: '⚡' },
                              'Ayudante Electricista': { orden: 8, color: '#F0E68C', emoji: '⚡' }
                            };

                            // Ordenar categorías
                            const tiposOrdenados = Object.keys(profesionalesPorTipo).sort((a, b) => {
                              const ordenA = ordenCategorias[a]?.orden || 999;
                              const ordenB = ordenCategorias[b]?.orden || 999;
                              return ordenA - ordenB;
                            });

                            return tiposOrdenados.map(tipo => {
                              const config = ordenCategorias[tipo] || { color: '#6c757d', emoji: '👷' };
                              const profesionales = profesionalesPorTipo[tipo].sort((a, b) =>
                                a.nombre.localeCompare(b.nombre)
                              );

                              return (
                                <optgroup
                                  key={tipo}
                                  label={`${config.emoji} ${tipo} (${profesionales.length})`}
                                  style={{ backgroundColor: config.color + '20', fontWeight: 'bold' }}
                                >
                                  {profesionales.map(prof => {
                                    const obras = prof.cantidadObrasAsignadas || 0;

                                    // Verificar disponibilidad por fechas
                                    const disponibilidad = verificarDisponibilidadPorFechas(
                                      prof.id,
                                      nuevaAsignacion.fechaInicio,
                                      nuevaAsignacion.fechaFin
                                    );
                                    // Si tiene obras asignadas O conflictos de fechas, no está disponible
                                    const noDisponible = !disponibilidad.disponible || obras > 0;

                                    let labelDisponibilidad;
                                    if (noDisponible) {
                                      labelDisponibilidad = '🚫 Ya tiene obra asignada';
                                    } else {
                                      labelDisponibilidad = '✅ Disponible';
                                    }

                                    return (
                                      <option
                                        key={prof.id}
                                        value={prof.id}
                                        disabled={noDisponible}
                                        style={{ color: noDisponible ? '#dc3545' : 'inherit' }}
                                      >
                                        {labelDisponibilidad} - {prof.nombre}
                                      </option>
                                    );
                                  })}
                                </optgroup>
                              );
                            });
                          })()}
                        </select>
                      </div>

                      {/* Mostrar obras asignadas del profesional seleccionado */}
                      {nuevaAsignacion.profesionalId && (
                        <div className="col-12">
                          {(() => {
                            const disponibilidad = verificarDisponibilidadPorFechas(
                              Number(nuevaAsignacion.profesionalId),
                              nuevaAsignacion.fechaInicio,
                              nuevaAsignacion.fechaFin
                            );
                            const noDisponible = !disponibilidad.disponible;

                            return (
                              <div className={`alert ${noDisponible ? 'alert-danger' : 'alert-info'} mb-0`}>
                                <div className="d-flex align-items-start">
                                  <i className={`fas ${noDisponible ? 'fa-exclamation-triangle' : 'fa-info-circle'} me-2 mt-1`}></i>
                                  <div className="flex-grow-1">
                                    {loadingObras ? (
                                      <div className="mt-2">
                                        <div className="spinner-border spinner-border-sm me-2" role="status">
                                          <span className="visually-hidden">Cargando...</span>
                                        </div>
                                        Cargando obras...
                                      </div>
                                    ) : noDisponible ? (
                                      <div>
                                        <strong className="text-danger d-block mb-2">
                                          <i className="fas fa-exclamation-triangle me-1"></i>
                                          {(() => {
                                            const prof = profesionalesDisponibles.find(p => p.id === Number(nuevaAsignacion.profesionalId));
                                            return prof ? `${prof.nombre} ya tiene una obra asignada` : 'Este profesional ya tiene una obra asignada';
                                          })()}
                                        </strong>
                                        <small className="text-danger d-block mb-2" style={{ lineHeight: '1.4' }}>
                                          Para asignar este profesional a esta obra, primero debe darlo de baja en:
                                        </small>
                                        {disponibilidad.conflictos.map((conflicto, idx) => (
                                          <div key={idx} className="mb-2 p-2 bg-danger bg-opacity-10 rounded border border-danger">
                                            <small className="text-danger d-block">
                                              <strong>• {conflicto.obraNombre}</strong>
                                              {conflicto.rubroNombre && ` - ${conflicto.rubroNombre}`}
                                            </small>
                                            <small className="text-danger d-block ms-3">
                                              {conflicto.fechaDesde && `Desde: ${new Date(conflicto.fechaDesde).toLocaleDateString('es-AR')}`}
                                              {conflicto.fechaHasta && ` hasta ${new Date(conflicto.fechaHasta).toLocaleDateString('es-AR')}`}
                                            </small>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="mt-2">
                                        <div className="p-2 bg-danger bg-opacity-10 rounded border border-danger">
                                          <small className="text-danger fw-bold d-block mb-2">
                                            <i className="fas fa-exclamation-triangle me-1"></i>
                                            Este profesional ya tiene {obrasDelProfesional.length} obra{obrasDelProfesional.length !== 1 ? 's' : ''} asignada{obrasDelProfesional.length !== 1 ? 's' : ''}
                                          </small>
                                          <small className="text-danger d-block mb-2" style={{ lineHeight: '1.4' }}>
                                            Para asignar este profesional a esta obra, primero debe darlo de baja en:
                                          </small>
                                          {obrasDelProfesional.map((asignacion, idx) => (
                                            <small key={idx} className="text-danger d-block ms-3 mb-1">
                                              <strong>• {asignacion.obraNombre || `Obra ID: ${asignacion.obraId}`}</strong>
                                              {asignacion.rubroNombre && ` - ${asignacion.rubroNombre}`}
                                              {asignacion.fechaDesde && (
                                                <span className="d-block ms-2">
                                                  Desde: {new Date(asignacion.fechaDesde).toLocaleDateString('es-AR')}
                                                  {asignacion.fechaHasta && ` hasta ${new Date(asignacion.fechaHasta).toLocaleDateString('es-AR')}`}
                                                </span>
                                              )}
                                            </small>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Seleccionar Rubro */}
                      <div className="col-md-4">
                        <label className="form-label">Rubro *</label>
                        <select
                          className="form-select"
                          value={nuevaAsignacion.rubroSelectorValue}
                          onChange={(e) => handleChange('rubroId', e.target.value)}
                        >
                          <option value="">Seleccionar rubro...</option>
                          {presupuesto.itemsCalculadora?.filter(rubro => {
                            // Filtrar rubros duplicados/legacy
                            const esLegacyDuplicado = rubro.tipoProfesional?.toLowerCase().includes('migrado') ||
                                                      rubro.tipoProfesional?.toLowerCase().includes('legacy') ||
                                                      rubro.descripcion?.toLowerCase().includes('migrados desde tabla legacy');
                            return !esLegacyDuplicado;
                          }).map((rubro, rubroIdx) => (
                            <optgroup key={rubroIdx} label={`📋 ${rubro.tipoProfesional || `Rubro ${rubroIdx + 1}`}`}>
                              {/* Encabezado y lista de profesionales */}
                              {rubro.profesionales && rubro.profesionales.length > 0 && (
                                <>
                                  <option disabled style={{fontWeight: 'bold'}}>─── PROFESIONALES ───</option>
                                  {rubro.profesionales.map((prof, profIdx) => (
                                    <option key={`prof-${rubroIdx}-${profIdx}`} value={`${rubro.id}-prof-${prof.id}`}>
                                      {'  '}👤 {prof.tipo || prof.nombre} ({prof.cantidadJornales} jornales)
                                    </option>
                                  ))}
                                </>
                              )}
                              {/* Encabezado y lista de jornales */}
                              {rubro.jornales && rubro.jornales.length > 0 && (
                                <>
                                  <option disabled style={{fontWeight: 'bold'}}>─── JORNALES ───</option>
                                  {rubro.jornales.map((jornal, jornalIdx) => (
                                    <option key={`jornal-${rubroIdx}-${jornalIdx}`} value={`${rubro.id}-jornal-${jornal.id}`}>
                                      {'  '}📅 {jornal.rol} ({jornal.cantidad} disponibles)
                                    </option>
                                  ))}
                                </>
                              )}
                            </optgroup>
                          ))}
                        </select>
                      </div>

                      {/* Tipo de Asignación - Auto-detectado */}
                      <div className="col-md-4">
                        <label className="form-label">Tipo de Asignación</label>
                        <input
                          type="text"
                          className="form-control"
                          value={nuevaAsignacion.tipoAsignacion ?
                            (nuevaAsignacion.tipoAsignacion === 'HONORARIO' ? '👤 Profesional (Honorarios)' : '📅 Jornal (Mano de Obra)')
                            : 'Seleccione un item del rubro'}
                          disabled
                          readOnly
                        />
                      </div>

                      {/* Cantidad de Jornales (solo si tipo = JORNAL) */}
                      {nuevaAsignacion.tipoAsignacion === 'JORNAL' && (
                        <div className="col-md-3">
                          <label className="form-label">Cantidad de Jornales *</label>
                          <input
                            type="number"
                            className="form-control"
                            value={nuevaAsignacion.cantidadJornales}
                            onChange={(e) => handleChange('cantidadJornales', e.target.value)}
                            min="1"
                          />
                        </div>
                      )}

                      {/* Fechas */}
                      <div className="col-md-4">
                        <label className="form-label">Fecha Inicio</label>
                        <input
                          type="date"
                          className="form-control"
                          value={nuevaAsignacion.fechaInicio}
                          onChange={(e) => handleChange('fechaInicio', e.target.value)}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Fecha Fin</label>
                        <input
                          type="date"
                          className="form-control"
                          value={nuevaAsignacion.fechaFin}
                          onChange={(e) => handleChange('fechaFin', e.target.value)}
                        />
                      </div>

                      {/* Observaciones */}
                      <div className="col-md-12">
                        <label className="form-label">Observaciones</label>
                        <textarea
                          className="form-control"
                          rows="2"
                          value={nuevaAsignacion.observaciones}
                          onChange={(e) => handleChange('observaciones', e.target.value)}
                        />
                      </div>

                      {/* Botón Agregar */}
                      <div className="col-md-12">
                        <button
                          type="button"
                          className="btn btn-success"
                          onClick={handleAgregarAsignacion}
                          disabled={loading}
                        >
                          {loading ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2"></span>
                              Asignando...
                            </>
                          ) : (
                            <>
                              <i className="fas fa-check me-2"></i>
                              Agregar Asignación
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabla de Asignaciones Actuales */}
                <div className="card border-primary">
                  <div className="card-header bg-primary text-white">
                    <h6 className="mb-0">
                      <i className="fas fa-list me-2"></i>
                      Asignaciones Actuales ({asignaciones.length})
                    </h6>
                  </div>
                  <div className="card-body p-0">
                    {asignaciones.length === 0 ? (
                      <div className="text-center text-muted py-4">
                        <i className="fas fa-inbox fa-3x mb-3"></i>
                        <p>No hay profesionales asignados a esta obra</p>
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-hover mb-0">
                          <thead className="table-light">
                            <tr>
                              <th>Profesional</th>
                              <th>Rubro</th>
                              <th>Tipo</th>
                              <th>Jornales</th>
                              <th>Fechas</th>
                              <th>Observaciones</th>
                              <th style={{ width: '80px' }}>Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {asignaciones.map(asig => (
                              <tr key={asig.id}>
                                <td>
                                  <strong>{asig.profesionalNombre}</strong>
                                  <br />
                                  <small className="text-muted">{asig.profesionalTipo}</small>
                                </td>
                                <td>{asig.rubroNombre}</td>
                                <td>
                                  <span className={`badge ${asig.tipoAsignacion === 'PROFESIONAL' ? 'bg-info' : 'bg-warning'}`}>
                                    {asig.tipoAsignacion}
                                  </span>
                                </td>
                                <td>
                                  {asig.tipoAsignacion === 'JORNAL' ? (
                                    <span className="badge bg-secondary">{asig.cantidadJornales} jornales</span>
                                  ) : (
                                    <span className="text-muted">-</span>
                                  )}
                                </td>
                                <td>
                                  {asig.fechaDesde && (
                                    <small>
                                      {new Date(asig.fechaDesde).toLocaleDateString()}
                                      {asig.fechaHasta && ` - ${new Date(asig.fechaHasta).toLocaleDateString()}`}
                                    </small>
                                  )}
                                </td>
                                <td>
                                  <small className="text-muted">{asig.observaciones || '-'}</small>
                                </td>
                                <td>
                                  <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => handleEliminarAsignacion(asig.id)}
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

                {/* Resumen de Jornales por Rubro */}
                <div className="card mt-4 border-warning">
                  <div className="card-header bg-warning">
                    <h6 className="mb-0">
                      <i className="fas fa-chart-pie me-2"></i>
                      Control de Jornales por Rubro
                    </h6>
                  </div>
                  <div className="card-body">
                    <div className="table-responsive">
                      <table className="table table-sm table-bordered mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>Rubro</th>
                            <th className="text-center">Presupuestados</th>
                            <th className="text-center">Asignados</th>
                            <th className="text-center">Disponibles</th>
                            <th className="text-end">% Utilizado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {presupuesto.rubros?.filter(r => r.cantidadJornales > 0).map((rubro, idx) => {
                            const asignados = asignaciones
                              .filter(a => String(a.rubroId) === String(rubro.id) && a.tipoAsignacion === 'JORNAL')
                              .reduce((sum, a) => sum + (a.cantidadJornales || 0), 0);
                            const disponibles = rubro.cantidadJornales - asignados;
                            const porcentaje = (asignados / rubro.cantidadJornales * 100).toFixed(1);

                            return (
                              <tr key={idx}>
                                <td><strong>{rubro.tipoProfesional}</strong></td>
                                <td className="text-center">{rubro.cantidadJornales}</td>
                                <td className="text-center">
                                  <span className="badge bg-primary">{asignados}</span>
                                </td>
                                <td className="text-center">
                                  <span className={`badge ${disponibles > 0 ? 'bg-success' : 'bg-danger'}`}>
                                    {disponibles}
                                  </span>
                                </td>
                                <td className="text-end">
                                  <div className="progress" style={{ height: '20px' }}>
                                    <div
                                      className={`progress-bar ${porcentaje > 80 ? 'bg-danger' : porcentaje > 50 ? 'bg-warning' : 'bg-success'}`}
                                      style={{ width: `${porcentaje}%` }}
                                    >
                                      {porcentaje}%
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              <i className="fas fa-times me-2"></i>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Estilos CSS para el selector agrupado
const styles = `
  .select-profesionales-agrupado optgroup {
    font-weight: bold;
    font-size: 0.95rem;
    padding: 8px 4px;
    margin: 4px 0;
  }

  .select-profesionales-agrupado option {
    padding: 6px 12px;
    font-weight: normal;
  }

  .select-profesionales-agrupado optgroup[label*="Albañil"] {
    background-color: rgba(139, 69, 19, 0.15);
    color: #654321;
  }

  .select-profesionales-agrupado optgroup[label*="Pintor"] {
    background-color: rgba(65, 105, 225, 0.15);
    color: #1e3a8a;
  }

  .select-profesionales-agrupado optgroup[label*="Plomero"] {
    background-color: rgba(32, 178, 170, 0.15);
    color: #0f5e5a;
  }

  .select-profesionales-agrupado optgroup[label*="Electricista"] {
    background-color: rgba(255, 215, 0, 0.15);
    color: #855f00;
  }
`;

// Inyectar estilos si no existen
if (typeof document !== 'undefined') {
  const styleId = 'asignar-profesional-styles';
  if (!document.getElementById(styleId)) {
    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  }
}

export default AsignarProfesionalObraModal;
