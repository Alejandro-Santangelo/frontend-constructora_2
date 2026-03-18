import React, { useState, useEffect, useMemo } from 'react';
import { Button, Form } from 'react-bootstrap';
import { useEmpresa } from '../EmpresaContext';
import api from '../services/api';
import SeleccionarProfesionalesModal from './SeleccionarProfesionalesModal';
import DetalleSemanaModal from './DetalleSemanaModal';
import { calcularSemanasParaDiasHabiles } from '../utils/feriadosArgentina';
import {
  crearAsignacionSemanal,
  obtenerAsignacionesSemanalPorObra,
  eliminarAsignacionSemanal,
  actualizarAsignacionSemanal,
  eliminarAsignacionesPorObra
} from '../services/profesionalesObraService';
import { obtenerRubrosActivosPorObra, listarJornalesPorObra as obtenerJornalesPorObra, eliminarJornalDiario } from '../services/jornalesDiariosService';

const AsignarProfesionalSemanalModal = ({
  show,
  onHide,
  obra,
  profesionalesDisponibles = [],
  onAsignar,
  configuracionObra = null, // Nueva prop para recibir configuración global
  onRefreshProfesionales = null, // Nueva prop para refrescar lista de profesionales
  onAbrirRegistrarJornales = null, // Nueva prop para abrir modal de jornales
  onAbrirHistorialJornales = null // Nueva prop para abrir modal de historial
}) => {
  // DEBUG: Track parent lifecycle
  const instanceId = React.useMemo(() => Math.random().toString(36).substr(2, 5), []);
  useEffect(() => {
    console.log(`🏰 [AsignarProfesionalSemanalModal ${instanceId}] MOUNTED`);
    return () => console.log(`🔥 [AsignarProfesionalSemanalModal ${instanceId}] UNMOUNTED`);
  }, []);

  useEffect(() => {
     console.log(`🏰 [AsignarProfesionalSemanalModal ${instanceId}] RENDERED. paso: ${paso}, mostrarModalSeleccion: ${mostrarModalSeleccion}`);
  });

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

  // Helper para obtener el número de semana ISO
  const getISOWeek = (date) => {
    const target = new Date(date.valueOf());
    const dayNr = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - target) / 604800000);
  };

  // Helper para obtener el año ISO de la semana
  const getISOWeekYear = (date) => {
    const target = new Date(date.valueOf());
    target.setDate(target.getDate() + 3 - (target.getDay() + 6) % 7);
    return target.getFullYear();
  };

  // Helper para generar semanaKey en formato ISO (YYYY-Www)
  const getSemanaKeyISO = (fecha) => {
    const year = getISOWeekYear(fecha);
    const week = getISOWeek(fecha);
    return `${year}-W${String(week).padStart(2, '0')}`;
  };

  // ✅ Helper para obtener el ID REAL de la obra (diferencia entre trabajo extra y obra normal)
  const getObraId = () => {
    if (!obra) return null;
    // ✅ FIX: Priorizar obra.obraId (ID de obra vinculada) antes que obra.id (ID de presupuesto)
    // Los botones configuran obra.obraId = 54 y obra.id = 102 para tareas leves
    return obra.obraId || obra.id;
  };

  // Estados principales
  const [profesionalesSeleccionados, setProfesionalesSeleccionados] = useState([]);
  const [mostrarModalSeleccion, setMostrarModalSeleccion] = useState(false);
  const [mostrarDetalleSemana, setMostrarDetalleSemana] = useState(false); // Estado para el nuevo modal
  const [semanaSeleccionadaParaAsignar, setSemanaSeleccionadaParaAsignar] = useState(null);
  const [modalidadAsignacion, setModalidadAsignacion] = useState(''); // 'total' o 'semanal'
  const [asignacionesPorSemana, setAsignacionesPorSemana] = useState({});
  const [cargando, setCargando] = useState(false);
  const [paso, setPaso] = useState(configuracionObra ? 2 : 1); // Si hay configuración, saltar paso 1
  const [presupuesto, setPresupuesto] = useState(null);
  const [loadingPresupuesto, setLoadingPresupuesto] = useState(false);
  const [asignacionesExistentes, setAsignacionesExistentes] = useState([]);
  const [loadingAsignaciones, setLoadingAsignaciones] = useState(false);
  
  // Estado para rubros del presupuesto de la obra
  const [rubros, setRubros] = useState([]);

  // 🚨🚨🚨 DEBUG CRÍTICO: Ver qué recibe el modal cuando se abre
  useEffect(() => {
    if (show && obra) {
      const obraIdReal = getObraId();
      const debugInfo = `
🚨 MODAL PROFESIONALES ABIERTO - DATOS RECIBIDOS:
obra.id: ${obra.id}
obra.obraId: ${obra.obraId}
obra.presupuestoId: ${obra.presupuestoId}
obra._trabajoExtraId: ${obra._trabajoExtraId}
obra._trabajoAdicionalId: ${obra._trabajoAdicionalId}
obra._obraOriginalId: ${obra._obraOriginalId}
obra._esTrabajoExtra: ${obra._esTrabajoExtra}
getObraId() retorna: ${obraIdReal}
      `;
      console.log(debugInfo);

      // Si getObraId() retorna un ID de presupuesto en lugar de obra, mostrar alert
      if (obraIdReal === 102 || obraIdReal === 101 || obraIdReal === 100) {
        alert('❌ ERROR: getObraId() retorna ID de presupuesto!\n\ngetObraId() = ' + obraIdReal + '\n\nDebería retornar el ID de la obra (ej: 54, 55, 53)\n\n' + debugInfo);
      }
    }
  }, [show, obra]);

  // Estado para tracking de asignaciones eliminadas
  const [asignacionesEliminadas, setAsignacionesEliminadas] = useState([]);

  // Estado para almacenar TODOS los profesionales de la empresa (para mapear nombres)
  const [todosProfesionales, setTodosProfesionales] = useState([]);

  // Usar configuración global si está disponible, sino usar estados locales
  const [semanasObjetivo, setSemanasObjetivo] = useState(configuracionObra?.semanasObjetivo?.toString() || '');

  // 🔥 Crear configuración actualizada con fechaProbableInicio y jornales del presupuesto más reciente
  // Obtener empresa del contexto
  const { empresaSeleccionada } = useEmpresa();

  const configuracionObraActualizada = useMemo(() => {
    if (!configuracionObra) return null;

    // Verificar si el presupuesto cargado es más reciente que el de la configuración
    const esPresupuestoMasReciente = presupuesto && configuracionObra.presupuestoSeleccionado &&
      presupuesto.version > configuracionObra.presupuestoSeleccionado.version;

    if (esPresupuestoMasReciente) {
      console.log('🔥 [PROFESIONAL SEMANAL] Detectada versión más reciente del presupuesto:', {
        versionAntigua: configuracionObra.presupuestoSeleccionado.version,
        versionNueva: presupuesto.version
      });
    }

    // Si hay presupuesto cargado, actualizar configuración
    if (presupuesto) {
      const fechaActualizada = presupuesto.fechaProbableInicio?.includes('T')
        ? presupuesto.fechaProbableInicio.split('T')[0]
        : presupuesto.fechaProbableInicio || configuracionObra.fechaInicio;

      // Obtener días hábiles del presupuesto (tiempoEstimadoTerminacion)
      let diasHabilesPresupuesto = configuracionObra.jornalesTotales;
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
        }, 0) || configuracionObra.jornalesTotales;
      }

      // 🔥 USAR días hábiles del presupuesto (fuente de verdad), NO semanasObjetivo × 5
      const diasHabiles = presupuesto.tiempoEstimadoTerminacion || configuracionObra.diasHabiles || (configuracionObra.semanasObjetivo * 5);
      // Recalcular capacidad necesaria: días del presupuesto ÷ días configurados
      const capacidadNecesaria = diasHabiles > 0 ? Math.ceil(diasHabilesPresupuesto / diasHabiles) : 0;

      return {
        ...configuracionObra,
        fechaInicio: fechaActualizada,
        jornalesTotales: diasHabilesPresupuesto, // Días del presupuesto
        diasHabiles, // Días configurados por el usuario
        capacidadNecesaria,
        presupuestoSeleccionado: presupuesto
      };
    }

    console.log('🔥 [PROFESIONAL SEMANAL] Usando configuracionObra sin cambios');
    return configuracionObra;
  }, [configuracionObra, presupuesto]);

  // 🆕 Sincronizar semanasObjetivo automáticamente cuando cambia la configuración (ej. al cargar presupuesto)
  useEffect(() => {
    if (configuracionObraActualizada?.diasHabiles) {
      const semanasCalculadas = Math.ceil(configuracionObraActualizada.diasHabiles / 5);

      // Solo actualizar si es diferente para evitar loops (aunque el string check lo maneja)
      if (semanasCalculadas.toString() !== semanasObjetivo) {
        console.log('🔄 [AUTO] Sincronizando semanasObjetivo desde días hábiles:', {
            dias: configuracionObraActualizada.diasHabiles,
            semanasCalculadas
        });
        setSemanasObjetivo(semanasCalculadas.toString());
      }
    }
  }, [configuracionObraActualizada?.diasHabiles, semanasObjetivo]);

  // Cargar rubros activos del presupuesto de la obra
  const cargarRubros = async () => {
    if (!obra?.id) return;
    const obraIdReal = getObraId();
    try {
      const lista = await obtenerRubrosActivosPorObra(obraIdReal, empresaSeleccionada.id);
      setRubros(lista);
      console.log(`✅ ${lista.length} rubros cargados para la obra ${obraIdReal}`);
    } catch (err) {
      console.warn('⚠️ No se pudieron cargar los rubros:', err);
      setRubros([]);
    }
  };

  // Handler para cambiar el rubro de un profesional seleccionado
  const handleCambiarRubroProfesional = (profesionalId, rubroId) => {
    const rubroSeleccionado = rubros.find(r => r.id === parseInt(rubroId));
    setProfesionalesSeleccionados(prev =>
      prev.map(p => p.id === profesionalId ? { 
        ...p, 
        rubroId: rubroId ? parseInt(rubroId) : null,
        rubroNombre: rubroSeleccionado ? rubroSeleccionado.nombreRubro : null
      } : p)
    );
  };

  // Cargar presupuesto cuando se abre el modal
  useEffect(() => {
    if (show && obra) {
      cargarTodosProfesionales();
      cargarPresupuestoObra();
      cargarAsignacionesExistentes();
      cargarRubros();
    } else if (!show) {
      // 🧹 Limpiar estados cuando se cierra el modal
      console.log('🧹 Limpiando estados del modal...');
      // No limpiamos profesionalesSeleccionados ni asignacionesPorSemana para mantener cambios pendientes
      // Solo limpiamos loadings y asignacionesExistentes que se recargan siempre
      setLoadingPresupuesto(false);
      setLoadingAsignaciones(false);
    }
  }, [show, obra]);

  // 🆕 Cargar profesionales seleccionados desde asignaciones existentes
  useEffect(() => {
    if (!show || !asignacionesExistentes || asignacionesExistentes.length === 0) {
      console.log('⚠️ No hay asignaciones para procesar:', { show, asignacionesLength: asignacionesExistentes?.length });
      return;
    }

    console.log('🔍 Procesando asignaciones existentes:', asignacionesExistentes);

    // Buscar asignaciones en modalidad "total" (obra completa)
    const asignacionesTotales = asignacionesExistentes.filter(a => a.modalidad === 'total');
    const asignacionesSemanales = asignacionesExistentes.filter(a => a.modalidad === 'semanal');

    console.log('📊 Asignaciones por modalidad:', {
      totales: asignacionesTotales.length,
      semanales: asignacionesSemanales.length
    });

    if (asignacionesTotales.length > 0) {
      console.log('🔍 Cargando profesionales desde asignaciones "total":', asignacionesTotales);

      // Extraer profesionales únicos
      const profesionalesUnicos = [];
      const profesionalesIds = new Set();

      asignacionesTotales.forEach(asignacion => {
        if (asignacion.profesionalId && !profesionalesIds.has(asignacion.profesionalId)) {
          profesionalesIds.add(asignacion.profesionalId);
          profesionalesUnicos.push({
            id: asignacion.profesionalId,
            nombre: asignacion.profesionalNombre,
            tipoProfesional: asignacion.profesionalTipo
          });
        }
      });

      console.log('✅ Profesionales cargados (modalidad total):', profesionalesUnicos);
      setProfesionalesSeleccionados(profesionalesUnicos);
      setModalidadAsignacion('total');
    } else if (asignacionesSemanales.length > 0) {
      console.log('🔍 Cargando profesionales desde asignaciones "semanal":', asignacionesSemanales);
      console.log('🔍 Primera asignación (estructura):', JSON.stringify(asignacionesSemanales[0], null, 2));

      // Agrupar asignaciones por semana
      const asignacionesPorSemanaTemp = {};

      asignacionesSemanales.forEach(asignacion => {
        // Cada asignación tiene un array asignacionesPorSemana
        const semanasArray = asignacion.asignacionesPorSemana || [];

        semanasArray.forEach(semanaData => {
          const semanaKey = semanaData.semanaKey;

          if (!semanaKey) {
            console.warn('⚠️ Semana sin semanaKey:', semanaData);
            return;
          }

          if (!asignacionesPorSemanaTemp[semanaKey]) {
            asignacionesPorSemanaTemp[semanaKey] = {
              profesionales: [],
              cantidadesPorDia: {},
              asignacionesDia: {}
            };
          }

          // Procesar detalles por día
          const detallesPorDia = semanaData.detallesPorDia || [];

          detallesPorDia.forEach(detalle => {
            // Agregar profesional único a esta semana
            const profesionalExiste = asignacionesPorSemanaTemp[semanaKey].profesionales.find(
              p => p.id === detalle.profesionalId
            );

            if (!profesionalExiste && detalle.profesionalId) {
              asignacionesPorSemanaTemp[semanaKey].profesionales.push({
                id: detalle.profesionalId,
                nombre: detalle.profesionalNombre,
                tipoProfesional: detalle.profesionalTipo
              });
            }

            // Agregar cantidad por día
            const fecha = detalle.fecha;
            if (fecha) {
              asignacionesPorSemanaTemp[semanaKey].cantidadesPorDia[fecha] =
                (asignacionesPorSemanaTemp[semanaKey].cantidadesPorDia[fecha] || 0) + (detalle.cantidad || 1);

              // Agregar a asignacionesDia para el modal detalle
              if (!asignacionesPorSemanaTemp[semanaKey].asignacionesDia[fecha]) {
                asignacionesPorSemanaTemp[semanaKey].asignacionesDia[fecha] = [];
              }
              asignacionesPorSemanaTemp[semanaKey].asignacionesDia[fecha].push({
                id: detalle.profesionalId,
                nombre: detalle.profesionalNombre,
                tipoProfesional: detalle.profesionalTipo
              });
            }
          });
        });
      });

      console.log('✅ Asignaciones semanales procesadas:', JSON.stringify(asignacionesPorSemanaTemp, null, 2));
      console.log('📊 Keys de semanas:', Object.keys(asignacionesPorSemanaTemp));
      setAsignacionesPorSemana(asignacionesPorSemanaTemp);
      setModalidadAsignacion('semanal');
    }
  }, [show, asignacionesExistentes]);

  // Función para cargar TODOS los profesionales de la empresa
  const cargarTodosProfesionales = async () => {
    try {
      if (!empresaSeleccionada?.id) return;

      const data = await api.get(`/api/profesionales?empresaId=${empresaSeleccionada.id}`);
      setTodosProfesionales(data || []);
      console.log('✅ Cargados todos los profesionales:', data?.length);
    } catch (error) {
      console.error('❌ Error cargando todos los profesionales:', error);
    }
  };

  const cargarAsignacionesExistentes = async () => {
    setLoadingAsignaciones(true);
    try {
      console.log('🔍 Cargando asignaciones para obra:', obra?.id, 'empresa:', empresaSeleccionada?.id);
      console.log('🔍 obra._esTrabajoExtra:', obra?._esTrabajoExtra);
      console.log('🔍 obra.asignacionesActuales:', obra?.asignacionesActuales?.length || 0);
  console.log('🟡 [DEBUG_OBRA] ID:', obra?.id, 'Nombre:', obra?.nombre, 'Dirección:', obra?.direccion);
  console.log('🟡 [DEBUG_OBRA] _esTrabajoExtra:', obra?._esTrabajoExtra, 'Tipo:', typeof obra?._esTrabajoExtra);
  console.log('🟡 [DEBUG_OBRA] asignacionesActuales:', obra?.asignacionesActuales);

      if (!empresaSeleccionada?.id) {
        console.warn('⚠️ No hay empresa seleccionada, saltando carga de asignaciones');
        setLoadingAsignaciones(false);
        return;
      }

      // 🔥 PRIORIDAD 1: SI ES TRABAJO EXTRA, CARGAR DESDE ITEMSCALCULADORA[] SIEMPRE
      // (Ignorar asignacionesActuales porque vienen en formato incorrecto)
      if (obra._esTrabajoExtra) {
        console.log('🔥 [TRABAJO EXTRA] Cargando profesionales desde itemsCalculadora[]');
        try {
          // ✅ FIX: Si el presupuesto ya viene en obra.presupuestoNoCliente, usarlo directamente
          let trabajoExtra;
          if (obra.presupuestoNoCliente) {
            console.log('📦 Usando presupuesto ya cargado desde obra.presupuestoNoCliente');
            trabajoExtra = obra.presupuestoNoCliente;
          } else {
            // Fallback: Cargar desde API usando el ID del trabajo extra
            const trabajoExtraId = obra._trabajoExtraId || obra._trabajoAdicionalId || obra.presupuestoId;
            console.log('📦 Cargando trabajo extra desde API con ID:', trabajoExtraId);
            trabajoExtra = await api.trabajosExtra.getById(trabajoExtraId, empresaSeleccionada.id);
          }
          console.log('📦 Trabajo extra obtenido:', trabajoExtra);
          console.log('📦 Items calculadora:', trabajoExtra.itemsCalculadora?.length || 0);

          // Extraer profesionales de itemsCalculadora[]
          const profesionalesDelTrabajoExtra = [];

          if (trabajoExtra.itemsCalculadora && Array.isArray(trabajoExtra.itemsCalculadora)) {
            trabajoExtra.itemsCalculadora.forEach((item, itemIdx) => {
              console.log(`  📋 Item ${itemIdx}:`, {
                id: item.id,
                tipoProfesional: item.tipoProfesional,
                descripcion: item.descripcion,
                cantidadProfesionales: item.profesionales?.length || 0,
                profesionales: item.profesionales
              });

              if (item.profesionales && Array.isArray(item.profesionales)) {
                console.log(`    ✅ Item ${itemIdx} tiene ${item.profesionales.length} profesionales`);

                item.profesionales.forEach((prof, profIdx) => {
                  console.log(`    👤 Profesional ${profIdx}:`, prof.nombreCompleto, '-', prof.rol, '- ID:', prof.id);

                  // Convertir al formato de asignación que espera el modal
                  profesionalesDelTrabajoExtra.push({
                    modalidad: 'total', // Los trabajos extra se manejan como asignación total
                    profesionalId: prof.profesionalObraId || prof.id || `temp_${Date.now()}_${Math.random()}`,
                    profesionalNombre: prof.nombreCompleto || prof.nombre || 'Sin nombre',
                    profesionalTipo: prof.rol || item.tipoProfesional || 'Profesional',
                    cantidadJornales: prof.cantidadJornales || 0,
                    valorJornal: prof.valorJornal || 0,
                    subtotal: prof.subtotal || 0,
                    observaciones: prof.observaciones || null,
                    // ⚠️ IMPORTANTE: asignacionId se usa para DELETE, debe ser el ID del profesional en itemsCalculadora
                    asignacionId: prof.id,
                    // Datos adicionales útiles
                    _fromItemsCalculadora: true,
                    _itemId: item.id,
                    _tipoProfesionalItem: item.tipoProfesional
                  });
                });
              }
            });
          }

          console.log(`✅ Profesionales extraídos de itemsCalculadora: ${profesionalesDelTrabajoExtra.length}`);
          console.log('📋 Profesionales completos:', JSON.stringify(profesionalesDelTrabajoExtra, null, 2));

          // 🔥 Para trabajos extra, SIEMPRE establecer modalidad 'total' (aunque no haya profesionales aún)
          console.log('🔵 Estableciendo modalidad = total para trabajo extra');
          setModalidadAsignacion('total');

          // Si hay profesionales, establecerlos en profesionalesSeleccionados
          if (profesionalesDelTrabajoExtra.length > 0) {
            const profesionalesParaSeleccionar = profesionalesDelTrabajoExtra.map(asig => ({
              id: asig.profesionalId,
              nombre: asig.profesionalNombre,
              tipoProfesional: asig.profesionalTipo
            }));

            console.log('✅ Estableciendo profesionales seleccionados:', profesionalesParaSeleccionar);
            setProfesionalesSeleccionados(profesionalesParaSeleccionar);
          } else {
            console.log('ℹ️ No hay profesionales en itemsCalculadora, inicializando vacío');
            setProfesionalesSeleccionados([]);
          }

          setAsignacionesExistentes(profesionalesDelTrabajoExtra);
          setLoadingAsignaciones(false);
          return;
        } catch (error) {
          console.error('❌ Error cargando trabajo extra:', error);
          // Si falla, continuar con array vacío
          setAsignacionesExistentes([]);
          setLoadingAsignaciones(false);
          return;
        }
      }

      // 🔵 PRIORIDAD 2: USAR ASIGNACIONES YA CARGADAS (solo para obras normales)
      if (obra.asignacionesActuales && Array.isArray(obra.asignacionesActuales) && obra.asignacionesActuales.length > 0) {
        console.log('✅ Usando asignaciones pre-cargadas desde obra:', obra.asignacionesActuales.length);
        setAsignacionesExistentes(obra.asignacionesActuales);
        setLoadingAsignaciones(false);
        return;
      }

      // 🟢 PRIORIDAD 3: CARGAR DESDE BACKEND (obras normales sin asignaciones pre-cargadas)
      // 1. Obtener el presupuesto con estado válido más reciente
      const presupuestoAprobado = await obtenerPresupuestoAprobadoMasReciente();
      console.log('🔍 Presupuesto con estado válido más reciente:', presupuestoAprobado);

      // 2. Obtener ASIGNACIONES SEMANALES de la obra
      const obraIdParaQuery = getObraId(); // ✅ Usa ID real de la obra

      // ✅ VALIDACIÓN: Si no hay obraId válido, no podemos cargar asignaciones
      if (!obraIdParaQuery || obraIdParaQuery === 0) {
        console.warn('⚠️ No se puede cargar asignaciones: obra sin ID válido');
        setAsignacionesExistentes([]);
        setLoadingAsignaciones(false);
        return;
      }

      let dataSemanal = [];
      try {
        const responseSemanal = await obtenerAsignacionesSemanalPorObra(obraIdParaQuery, empresaSeleccionada.id);
        console.log('🔍 Asignaciones semanales response completo:', responseSemanal);

        dataSemanal = responseSemanal.data || responseSemanal || [];
        if (dataSemanal.data && Array.isArray(dataSemanal.data)) {
          dataSemanal = dataSemanal.data;
        }
        console.log('✅ Asignaciones semanales cargadas:', dataSemanal.length, 'items');
      } catch (errorSemanal) {
        console.error('❌ Error obteniendo asignaciones semanales:', errorSemanal.message);
        console.error('   Status:', errorSemanal.response?.status);
        console.error('   Data:', errorSemanal.response?.data);
        dataSemanal = [];
      }

      // 3. Obtener ASIGNACIONES POR OBRA COMPLETA
      let dataObra = [];
      try {
        dataObra = await api.get(
          `/api/obras/${obraIdParaQuery}/asignaciones-profesionales`, // ✅ Usa ID real
          {
            headers: {
              'empresaId': empresaSeleccionada.id.toString()
            }
          }
        );
        console.log('🔍 Asignaciones por obra completa:', dataObra);
      } catch (error) {
        console.warn('⚠️ No se pudieron cargar asignaciones por obra completa:', error);
      }

      // 3.5. Obtener JORNALES DIARIOS (Asignación por Día)
      let dataJornales = [];
      try {
        const responseJornales = await obtenerJornalesPorObra(obraIdParaQuery, empresaSeleccionada.id);
        console.log('🔍 Jornales diarios response:', responseJornales);
        
        dataJornales = Array.isArray(responseJornales) ? responseJornales : (responseJornales?.data || []);
        
        // 🔄 Transformar jornales al formato de asignaciones para mostrar en la tabla
        dataJornales = dataJornales.map(jornal => ({
          tipoAsignacion: 'JORNAL_DIARIO', // ✨ Marcador para identificar jornales
          asignacionId: `jornal-${jornal.id}`, // ID único para eliminar
          jornalId: jornal.id, // ID real del jornal
          profesionalId: jornal.profesionalId,
          profesionalNombre: jornal.profesionalNombre || 'N/A',
          profesionalTipo: jornal.tipoProfesional || 'N/A',
          rubroId: jornal.rubroId,
          rubroNombre: jornal.rubroNombre || 'Sin rubro',
          fecha: jornal.fecha,
          horasTrabajadasDecimal: jornal.horasTrabajadasDecimal || 0,
          montoCobrado: jornal.montoCobrado || 0,
          observaciones: jornal.observaciones || '-'
       }));
        
        console.log('✅ Jornales diarios transformados:', dataJornales.length, 'items');
      } catch (errorJornales) {
        console.warn('⚠️ No se pudieron cargar jornales diarios:', errorJornales.message);
        dataJornales = [];
      }

      // 4. COMBINAR LOS 3 TIPOS: Semanales + Obra Completa + Jornales Diarios
      const todasLasAsignaciones = [...dataSemanal, ...dataObra, ...dataJornales];
      console.log('🔍 Total asignaciones combinadas (incluyendo jornales):', todasLasAsignaciones.length);
      console.log('   - Semanales:', dataSemanal.length);
      console.log('   - Obra Completa:', dataObra.length);
      console.log('   - Jornales Diarios:', dataJornales.length);

      // Extraer datos dependiendo de la estructura de respuesta
      let data = todasLasAsignaciones;
      console.log('🔍 Asignaciones existentes data inicial:', data);

      // Si los datos están en response.data.data (estructura del backend)
      if (data.data && Array.isArray(data.data)) {
        data = data.data;
        console.log('🔍 Asignaciones extraídas de data.data:', data);
      }

      // DEPURAR: Mostrar estructura real de los datos
      if (data.length > 0) {
        console.log('🔍 [DEBUG] Estructura real de una asignación:', data[0]);
        console.log('🔍 [DEBUG] Claves disponibles:', Object.keys(data[0]));

        // Verificar si alguna asignación tiene información de estado
        data.forEach((asignacion, index) => {
          console.log(`🔍 [DEBUG] Asignación ${index} - ID: ${asignacion.asignacionId}, tiene estado en respuesta:`, asignacion.estado !== undefined);
        });
      }

      // 3. Filtrar asignaciones para mostrar solo las del presupuesto APROBADO más reciente
      let asignacionesFiltradas = data;
      if (presupuestoAprobado && presupuestoAprobado.id) {
        asignacionesFiltradas = data.filter(asignacion => {
          // ✅ JORNALES DIARIOS: Mostrar siempre, sin filtrar por presupuesto
          if (asignacion.tipoAsignacion === 'JORNAL_DIARIO') {
            return true;
          }
          
          // Si la asignación tiene presupuestoId, filtrar por el presupuesto APROBADO
          if (asignacion.presupuestoId) {
            return asignacion.presupuestoId === presupuestoAprobado.id;
          }
          // Si no tiene presupuestoId, mostrarla (compatibilidad con versiones anteriores)
          return true;
        });
        console.log('🔍 Asignaciones filtradas por presupuesto APROBADO:', asignacionesFiltradas);
        console.log('🔍 Cantidad antes del filtro:', data.length, 'después del filtro:', asignacionesFiltradas.length);
      }

      // 4. FILTRAR SOLO ASIGNACIONES ACTIVAS
      // Como el backend no incluye campo 'estado', usamos filtro manual
      const asignacionesInactivasConocidas = [66]; // Carlos Rodriguez que sabemos está INACTIVO
      const asignacionesInactivasTotal = [...asignacionesInactivasConocidas, ...asignacionesEliminadas];

      const asignacionesActivas = asignacionesFiltradas.filter(asignacion => {
        // ✅ JORNALES DIARIOS: Mostrar siempre, nunca filtrar como inactivos
        if (asignacion.tipoAsignacion === 'JORNAL_DIARIO') {
          return true;
        }
        
        const esInactivo = asignacionesInactivasTotal.includes(asignacion.asignacionId);
        if (esInactivo) {
          console.log(`🚫 Filtrando asignación INACTIVA - ID: ${asignacion.asignacionId} (eliminada previamente)`);
        }
        return !esInactivo;
      });

      console.log('🔍 Asignaciones después de filtrar ACTIVAS:', asignacionesActivas);
      console.log('🔍 Cantidad antes del filtro ACTIVO:', asignacionesFiltradas.length, 'después del filtro ACTIVO:', asignacionesActivas.length);

      console.log('🔍 Asignaciones finales a procesar:', asignacionesActivas);
      console.log('🔍 Cantidad de asignaciones:', Array.isArray(asignacionesActivas) ? asignacionesActivas.length : 'No es array');

      // Agregar nombre de la obra a cada asignación
      const asignacionesConObra = asignacionesActivas.map(asignacion => ({
        ...asignacion,
        obraNombre: obra?.nombre || obra?.direccion || 'Obra actual'
      }));

      setAsignacionesExistentes(Array.isArray(asignacionesConObra) ? asignacionesConObra : []);
    } catch (error) {
      console.error('❌ Error cargando asignaciones existentes:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error response status:', error.response?.status);
      console.error('❌ Error response data:', error.response?.data);
      console.error('❌ Error response statusText:', error.response?.statusText);

      // Mostrar detalles específicos del error del servidor
      if (error.response) {
        console.error('❌ DETALLES DEL SERVER ERROR:');
        console.error('   - Status:', error.response.status);
        console.error('   - StatusText:', error.response.statusText);
        console.error('   - Data:', JSON.stringify(error.response.data, null, 2));
        console.error('   - URL:', error.config?.url);

        // Si es error 404, el endpoint puede no existir o la obra no tener asignaciones
        if (error.response.status === 404) {
          console.warn('⚠️ 404: Endpoint no encontrado o la obra no tiene asignaciones');
        } else if (error.response.status === 500) {
          console.error('🚨 500: Error interno del servidor');
        } else if (error.response.status === 400) {
          console.error('🚨 400: Bad Request - Parámetros incorrectos');
        }
      } else if (error.request) {
        console.error('❌ No hubo respuesta del servidor:', error.request);
      } else {
        console.error('❌ Error configurando request:', error.message);
      }

      // Si es un error de seguridad/empresaId, mostrar mensaje específico
      if (error.message?.includes('empresaId')) {
        console.warn('⚠️ Error de empresaId al cargar asignaciones. Verificando configuración...');
        console.log('🔍 EmpresaSeleccionada actual:', empresaSeleccionada);
      }

      setAsignacionesExistentes([]);
    } finally {
      setLoadingAsignaciones(false);
    }
  };

  // Función helper para obtener el presupuesto con estado válido más reciente
  const obtenerPresupuestoAprobadoMasReciente = async () => {
    try {
      // ✅ Siempre usar el ID real de la obra para buscar presupuestos vinculados
      const obraIdReal = getObraId();
      let data = await api.presupuestosNoCliente.getAll(empresaSeleccionada.id, { obraId: obraIdReal });

      if (data) {
        if (!Array.isArray(data)) {
          data = [data];
        }

        if (Array.isArray(data) && data.length > 0) {
          // Estados válidos para obras vinculadas (incluye TERMINADO y FINALIZADO para tareas leves)
          const estadosValidos = ['APROBADO', 'EN_EJECUCION', 'SUSPENDIDA', 'CANCELADA', 'TERMINADO', 'FINALIZADO'];

          // Buscar presupuestos con estado válido
          const presupuestosValidos = data.filter(p => estadosValidos.includes(p.estado));

          if (presupuestosValidos.length > 0) {
            // Ordenar por versión/fecha más reciente y tomar el primero
            const presupuestoMasReciente = presupuestosValidos.sort((a, b) => {
              // Ordenar por versión si está disponible
              if (a.version !== undefined && b.version !== undefined) {
                return b.version - a.version;
              }
              // Si no hay versión, ordenar por ID (asumiendo que IDs más altos = más recientes)
              return (b.id || 0) - (a.id || 0);
            })[0];

            console.log('✅ Presupuesto con estado válido más reciente encontrado:', presupuestoMasReciente);
            return presupuestoMasReciente;
          }
        }
      }
    } catch (err) {
      console.error('Error obteniendo presupuesto con estado válido:', err);
    }

    return null;
  };

  const cargarPresupuestoObra = async () => {
    setLoadingPresupuesto(true);
    try {
      if (!empresaSeleccionada?.id || !obra?.id) {
        console.warn('⚠️ No hay empresa u obra seleccionada, saltando carga de presupuesto');
        setLoadingPresupuesto(false);
        return;
      }

      // 🔥 BIFURCACIÓN: Trabajos extra vs Obras normales
      if (obra._esTrabajoExtra) {
        console.log('📦 TRABAJO EXTRA: Cargando presupuesto');

        // ✅ FIX: Si el presupuesto ya viene en obra.presupuestoNoCliente, usarlo directamente
        let trabajoExtra;
        if (obra.presupuestoNoCliente) {
          console.log('📦 Usando presupuesto ya cargado desde obra.presupuestoNoCliente');
          trabajoExtra = obra.presupuestoNoCliente;
        } else {
          // Fallback: Cargar desde API usando el ID del trabajo extra
          const trabajoExtraId = obra._trabajoExtraId || obra._trabajoAdicionalId || obra.presupuestoId;
          console.log('📦 Cargando trabajo extra desde API con ID:', trabajoExtraId);
          trabajoExtra = await api.trabajosExtra.getById(trabajoExtraId, empresaSeleccionada.id);
        }

        if (trabajoExtra) {
          console.log('✅ Presupuesto de trabajo extra cargado:', trabajoExtra);
          setPresupuesto(trabajoExtra);
        } else {
          console.warn('⚠️ No se pudo cargar el presupuesto del trabajo extra');
        }
      } else {
        // ✅ OBRA NORMAL: Usar el ID real de la obra para cargar presupuestos
        const obraIdReal = getObraId();
        console.log('🔍 [cargarPresupuestoObra] obraIdReal:', obraIdReal, 'esTrabajoExtra:', obra._esTrabajoExtra);
        let data = await api.presupuestosNoCliente.getAll(empresaSeleccionada.id, { obraId: obraIdReal });

        if (data) {

          if (!Array.isArray(data)) {
            data = [data];
          }

          if (Array.isArray(data) && data.length > 0) {
            // Estados válidos para obras vinculadas (incluye TERMINADO y FINALIZADO para tareas leves)
            const estadosValidos = ['APROBADO', 'EN_EJECUCION', 'SUSPENDIDA', 'CANCELADA', 'TERMINADO', 'FINALIZADO'];

            // Filtrar presupuestos con estado válido
            const presupuestosValidos = data.filter(p => estadosValidos.includes(p.estado));

            if (presupuestosValidos.length > 0) {
              // Ordenar por versión más reciente
              const presupuestoSeleccionado = presupuestosValidos.sort((a, b) => {
                if (a.version !== undefined && b.version !== undefined) {
                  return b.version - a.version;
                }
                return (b.id || 0) - (a.id || 0);
              })[0];

              setPresupuesto(presupuestoSeleccionado);
            } else {
              // Fallback: usar el más reciente sin filtrar por estado
              const presupuestoSeleccionado = data.sort((a, b) => (b.id || 0) - (a.id || 0))[0];
              setPresupuesto(presupuestoSeleccionado);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error cargando presupuesto:', err);
    } finally {
      setLoadingPresupuesto(false);
    }
  };

  // Calcular jornales totales necesarios (días hábiles para terminar la obra)
  const jornalesTotales = useMemo(() => {
    // PRIORIDAD 1: Si el presupuesto tiene tiempoEstimadoTerminacion, usar ese valor
    if (presupuesto?.tiempoEstimadoTerminacion) {
      return presupuesto.tiempoEstimadoTerminacion;
    }

    // PRIORIDAD 2: Si hay configuración global, usar esos datos
    if (configuracionObra?.jornalesTotales) {
      return configuracionObra.jornalesTotales;
    }

    // PRIORIDAD 3: Calcular desde el presupuesto sumando jornales (fallback legacy)
    if (!presupuesto || !presupuesto.itemsCalculadora) return 0;

    return presupuesto.itemsCalculadora.reduce((total, rubro) => {
      // Filtrar rubros legacy/duplicados
      const esLegacyDuplicado = rubro.tipoProfesional?.toLowerCase().includes('migrado') ||
                                rubro.tipoProfesional?.toLowerCase().includes('legacy') ||
                                rubro.descripcion?.toLowerCase().includes('migrados desde tabla legacy');

      if (esLegacyDuplicado) return total;

      // Por defecto incluir si no está definido
      const incluir = rubro.incluirEnCalculoDias !== false;
      if (!incluir) return total;

      const jornalesRubro = rubro.jornales?.reduce((sum, j) => sum + (j.cantidad || 0), 0) || 0;
      const profesionalesRubro = rubro.profesionales?.reduce((sum, p) => sum + (p.cantidadJornales || 0), 0) || 0;
      return total + jornalesRubro + profesionalesRubro;
    }, 0) || 0;
  }, [presupuesto, configuracionObra]);

  // Calcular días hábiles desde semanasObjetivo
  const diasHabilesObjetivo = useMemo(() => {
    // Si hay configuración global, usar esos datos
    if (configuracionObra?.diasHabiles) {
      return configuracionObra.diasHabiles;
    }

    // Si no, calcular desde semanasObjetivo local
    if (!semanasObjetivo || semanasObjetivo <= 0) return 0;
    return parseInt(semanasObjetivo) * 5;
  }, [semanasObjetivo, configuracionObra]);

  // Calcular capacidad necesaria
  const capacidadNecesaria = useMemo(() => {
    // 🆕 PRIORIDAD 1: Calcular desde el presupuesto vinculado
    if (configuracionObra?.presupuestoSeleccionado?.itemsCalculadora) {
      let capacidad = 0;
      configuracionObra.presupuestoSeleccionado.itemsCalculadora.forEach(rubro => {
        const incluirRubro = rubro.incluirEnCalculoDias !== false;
        if (!incluirRubro) return;

        if (rubro.jornales && Array.isArray(rubro.jornales)) {
          rubro.jornales.forEach(jornal => {
            const incluirJornal = jornal.incluirEnCalculoDias !== false;
            const cantidad = Number(jornal.cantidad || 0);
            if (incluirJornal && cantidad > 0) {
              capacidad++;
            }
          });
        }
      });

      if (capacidad > 0) {
        console.log('👥 [AsignarProfesionalSemanal] Capacidad calculada desde presupuesto:', capacidad);
        return capacidad;
      }
    }

    // PRIORIDAD 2: Si hay configuración global con capacidadNecesaria, usar esos datos
    if (configuracionObra?.capacidadNecesaria) {
      console.log('👥 [AsignarProfesionalSemanal] Capacidad desde configuración:', configuracionObra.capacidadNecesaria);
      return configuracionObra.capacidadNecesaria;
    }

    // PRIORIDAD 3: Calcular localmente (fallback)
    if (diasHabilesObjetivo === 0) return 0;
    const capacidadFallback = Math.ceil(jornalesTotales / diasHabilesObjetivo);
    console.log('👥 [AsignarProfesionalSemanal] Capacidad fallback:', capacidadFallback);
    return capacidadFallback;
  }, [jornalesTotales, diasHabilesObjetivo, configuracionObra]);

  // Calcular información de profesionales asignados
  const resumenProfesionales = useMemo(() => {
    if (!asignacionesExistentes || asignacionesExistentes.length === 0) {
      return {
        totalAsignados: 0,
        profesionalesPorRubro: {},
        profesionalesUnicos: 0,
        faltantes: capacidadNecesaria
      };
    }

    const profesionalesPorRubro = {};
    const profesionalesUnicos = new Map();
    let totalJornalesAsignados = 0;

    const asignacionesActivas = asignacionesExistentes;

    asignacionesActivas.forEach(asignacion => {
      totalJornalesAsignados += asignacion.totalJornalesAsignados || 0;

      if (asignacion.asignacionesPorSemana && Array.isArray(asignacion.asignacionesPorSemana)) {
        asignacion.asignacionesPorSemana.forEach(semana => {
          if (semana.detallesPorDia && Array.isArray(semana.detallesPorDia)) {
            semana.detallesPorDia.forEach(detalle => {
              if (detalle.profesionalId && detalle.cantidad > 0) {
                const profesionalId = detalle.profesionalId;

                if (!profesionalesUnicos.has(profesionalId)) {
                  const profesionalInfo = profesionalesDisponibles.find(p => p.id === profesionalId);

                  const profesionalNombre = profesionalInfo?.nombre || `Profesional ${profesionalId}`;
                  const profesionalRubro = profesionalInfo?.tipoProfesional || 'Sin rubro';
                  const profesionalRol = profesionalInfo?.rol || 'Trabajador';

                  profesionalesUnicos.set(profesionalId, {
                    id: profesionalId,
                    nombre: profesionalNombre,
                    rubro: profesionalRubro,
                    rol: profesionalRol
                  });

                  if (!profesionalesPorRubro[profesionalRubro]) {
                    profesionalesPorRubro[profesionalRubro] = [];
                  }

                  const yaExisteEnRubro = profesionalesPorRubro[profesionalRubro].some(p => p.id === profesionalId);
                  if (!yaExisteEnRubro) {
                    profesionalesPorRubro[profesionalRubro].push({
                      nombre: profesionalNombre,
                      rol: profesionalRol,
                      id: profesionalId
                    });
                  }
                }
              }
            });
          }
        });
      }
    });

    const profesionalesUnicosCount = profesionalesUnicos.size;
    const faltantes = Math.max(0, capacidadNecesaria - profesionalesUnicosCount);

    return {
      totalAsignados: profesionalesUnicosCount, // Cantidad de profesionales únicos
      profesionalesPorRubro,
      profesionalesUnicos: profesionalesUnicosCount,
      faltantes: Math.ceil(faltantes),
      totalJornalesAsignados
    };
  }, [asignacionesExistentes, capacidadNecesaria, diasHabilesObjetivo, profesionalesDisponibles]);

  // 🔥 NUEVA FUNCIONALIDAD: Comparar profesionales asignados vs presupuesto y calcular diferencia de tiempo
  const compararProfesionalesVsPresupuesto = useMemo(() => {
    // Obtener días hábiles estimados en el presupuesto
    const diasEstimadosOriginales = configuracionObraActualizada?.diasHabiles || diasHabilesObjetivo || 0;

    // Obtener capacidad necesaria del presupuesto (profesionales necesarios por día)
    const capacidadPresupuesto = capacidadNecesaria || 0;

    // Calcular jornales TOTALES del presupuesto (días × profesionales/día)
    const jornalesPresupuestoTotales = diasEstimadosOriginales * capacidadPresupuesto;

    // Obtener total de profesionales asignados
    const profesionalesAsignados = resumenProfesionales.totalAsignados || 0;

    if (diasEstimadosOriginales === 0 || capacidadPresupuesto === 0) {
      return {
        estado: 'sin-datos',
        mensaje: 'Configura primero la obra para ver estimaciones',
        diasDiferencia: 0,
        porcentajeDiferencia: 0
      };
    }

    if (profesionalesAsignados === 0) {
      return {
        estado: 'sin-asignacion',
        mensaje: 'Sin profesionales asignados',
        diasDiferencia: 0,
        porcentajeDiferencia: 0,
        diasEstimadosOriginales,
        capacidadPresupuesto,
        jornalesPresupuesto: jornalesPresupuestoTotales
      };
    }

    // Calcular días reales que tomará la obra con los profesionales asignados
    // Fórmula: diasReales = jornalesTotales / profesionalesAsignados
    const diasReales = Math.ceil(jornalesPresupuestoTotales / profesionalesAsignados);

    // Calcular diferencia en días
    const diasDiferencia = diasReales - diasEstimadosOriginales;

    // Calcular porcentaje de diferencia
    const porcentajeDiferencia = Math.round((diasDiferencia / diasEstimadosOriginales) * 100);

    // Determinar estado
    let estado, mensaje, emoji, color;

    if (profesionalesAsignados === capacidadPresupuesto) {
      // Misma cantidad de profesionales
      estado = 'a-tiempo';
      emoji = '✅';
      color = 'success';
      mensaje = `Perfecto: ${profesionalesAsignados} profesionales = ${capacidadPresupuesto} necesarios → Terminarás en ${diasEstimadosOriginales} días`;
    } else if (profesionalesAsignados > capacidadPresupuesto) {
      // Más profesionales (terminará antes)
      const diasMenos = Math.abs(diasDiferencia);
      const profesionalesMas = profesionalesAsignados - capacidadPresupuesto;
      estado = 'adelantado';
      emoji = '🚀';
      color = 'info';
      mensaje = `Terminarás ANTES: ${profesionalesMas} profesional${profesionalesMas !== 1 ? 'es' : ''} extra → ${diasMenos} día${diasMenos !== 1 ? 's' : ''} menos (${diasReales} días en lugar de ${diasEstimadosOriginales})`;
    } else {
      // Menos profesionales (terminará después)
      const profesionalesFaltantes = capacidadPresupuesto - profesionalesAsignados;
      estado = 'atrasado';
      emoji = '⚠️';
      color = 'warning';
      mensaje = `Terminarás DESPUÉS: Faltan ${profesionalesFaltantes} profesional${profesionalesFaltantes !== 1 ? 'es' : ''} → ${diasDiferencia} día${diasDiferencia !== 1 ? 's' : ''} más (${diasReales} días en lugar de ${diasEstimadosOriginales})`;
    }

    return {
      estado,
      mensaje,
      emoji,
      color,
      diasDiferencia,
      porcentajeDiferencia,
      diasEstimadosOriginales,
      diasReales,
      capacidadPresupuesto,
      profesionalesAsignados,
      jornalesPresupuesto: jornalesPresupuestoTotales
    };
  }, [
    configuracionObraActualizada,
    diasHabilesObjetivo,
    capacidadNecesaria,
    resumenProfesionales
  ]);

  // Calcular días hábiles reales entre fechaInicio y fechaFin
  const calcularDiasHabiles = (fechaInicio, cantidadDias) => {
    const inicio = new Date(fechaInicio);
    const dias = [];
    let diasAgregados = 0;

    // Función para calcular Pascua (algoritmo de Butcher)
    const calcularPascua = (year) => {
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
      return new Date(year, month - 1, day);
    };

    // Función para obtener el n-ésimo día de la semana de un mes
    const getNthWeekdayOfMonth = (year, month, weekday, n) => {
      const date = new Date(year, month, 1);
      let count = 0;

      while (date.getMonth() === month) {
        if (date.getDay() === weekday) {
          count++;
          if (count === n) {
            return new Date(date);
          }
        }
        date.setDate(date.getDate() + 1);
      }
      return null;
    };

    // Función para verificar si una fecha es feriado
    const esFeriado = (fecha) => {
      const year = fecha.getFullYear();
      const mes = fecha.getMonth() + 1; // 1-12
      const dia = fecha.getDate();
      const mesdia = `${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

      // Feriados fijos de Argentina
      const feriadosFijos = [
        '01-01', // Año Nuevo
        '03-24', // Día Nacional de la Memoria por la Verdad y la Justicia
        '04-02', // Día del Veterano y de los Caídos en la Guerra de Malvinas
        '05-01', // Día del Trabajador
        '05-25', // Revolución de Mayo
        '06-20', // Paso a la Inmortalidad del General Manuel Belgrano
        '07-09', // Día de la Independencia
        '12-08', // Inmaculada Concepción de María
        '12-25'  // Navidad
      ];

      if (feriadosFijos.includes(mesdia)) {
        return true;
      }

      // Feriados móviles calculados
      const pascua = calcularPascua(year);

      // Carnaval (Lunes y Martes antes de Miércoles de Ceniza, que es 47 días antes de Pascua)
      const carnavalLunes = new Date(pascua);
      carnavalLunes.setDate(pascua.getDate() - 48);
      const carnavalMartes = new Date(pascua);
      carnavalMartes.setDate(pascua.getDate() - 47);

      // Jueves Santo y Viernes Santo
      const juevesSanto = new Date(pascua);
      juevesSanto.setDate(pascua.getDate() - 3);
      const viernesSanto = new Date(pascua);
      viernesSanto.setDate(pascua.getDate() - 2);

      // Día del Respeto a la Diversidad Cultural (segundo lunes de octubre)
      const diversidadCultural = getNthWeekdayOfMonth(year, 9, 1, 2); // octubre = mes 9 (0-indexed)

      // Día de la Soberanía Nacional (cuarto lunes de noviembre)
      const soberaniaNacional = getNthWeekdayOfMonth(year, 10, 1, 4); // noviembre = mes 10

      // Paso a la Inmortalidad de San Martín (tercer lunes de agosto)
      const sanMartin = getNthWeekdayOfMonth(year, 7, 1, 3); // agosto = mes 7

      // Comparar fechas
      const compararFecha = (f1, f2) => {
        return f1 && f2 &&
               f1.getFullYear() === f2.getFullYear() &&
               f1.getMonth() === f2.getMonth() &&
               f1.getDate() === f2.getDate();
      };

      if (compararFecha(fecha, carnavalLunes) ||
          compararFecha(fecha, carnavalMartes) ||
          compararFecha(fecha, juevesSanto) ||
          compararFecha(fecha, viernesSanto) ||
          compararFecha(fecha, diversidadCultural) ||
          compararFecha(fecha, soberaniaNacional) ||
          compararFecha(fecha, sanMartin)) {
        return true;
      }

      // Feriados puente específicos por año (estos cambian cada año)
      // 2025
      if (year === 2025) {
        if (mesdia === '04-18' || // Viernes Santo
            mesdia === '05-02' || // Feriado puente
            mesdia === '06-16' || // Puente Güemes
            mesdia === '10-13' || // Feriado puente
            mesdia === '11-24') { // Feriado puente
          return true;
        }
      }

      // 2026
      if (year === 2026) {
        if (mesdia === '02-16' || // Lunes de Carnaval
            mesdia === '02-17' || // Martes de Carnaval
            mesdia === '03-23' || // Feriado puente
            mesdia === '06-15' || // Puente Güemes
            mesdia === '10-12' || // Feriado puente
            mesdia === '11-23') { // Feriado puente
          return true;
        }
      }

      // 2027
      if (year === 2027) {
        if (mesdia === '02-08' || // Lunes de Carnaval
            mesdia === '02-09' || // Martes de Carnaval
            mesdia === '03-25' || // Jueves Santo
            mesdia === '03-26' || // Viernes Santo
            mesdia === '05-24' || // Feriado puente
            mesdia === '06-21' || // Puente Güemes
            mesdia === '10-11' || // Feriado puente
            mesdia === '11-22') { // Feriado puente
          return true;
        }
      }

      // 2028
      if (year === 2028) {
        if (mesdia === '02-28' || // Lunes de Carnaval
            mesdia === '02-29' || // Martes de Carnaval
            mesdia === '04-13' || // Jueves Santo
            mesdia === '04-14' || // Viernes Santo
            mesdia === '05-26' || // Feriado puente
            mesdia === '06-19' || // Puente Güemes
            mesdia === '10-09' || // Feriado puente
            mesdia === '11-20') { // Feriado puente
          return true;
        }
      }

      return false;
    };

    let fechaActual = new Date(inicio);
    while (diasAgregados < cantidadDias) {
      const diaSemana = fechaActual.getDay();
      const esFinDeSemana = diaSemana === 0 || diaSemana === 6;
      const esFeriadoNacional = esFeriado(fechaActual);

      // Solo agregar si es día hábil (no es fin de semana ni feriado)
      if (!esFinDeSemana && !esFeriadoNacional) {
        dias.push(new Date(fechaActual));
        diasAgregados++;
      }

      fechaActual.setDate(fechaActual.getDate() + 1);
    }

    return dias;
  };

  // Calcular días hábiles según las semanas objetivo
  const diasHabilesDisponibles = useMemo(() => {
    if (!obra || !configuracionObraActualizada?.fechaInicio || diasHabilesObjetivo === 0) return [];
    return calcularDiasHabiles(parsearFechaLocal(configuracionObraActualizada.fechaInicio), diasHabilesObjetivo);
  }, [obra, configuracionObraActualizada?.fechaInicio, diasHabilesObjetivo]);

  // Función auxiliar para verificar si una fecha es feriado (reutilizando la lógica de calcularDiasHabiles)
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

  // Agrupar días por semana calendario completa (Lunes a Domingo)
  const semanas = useMemo(() => {
    if (!obra || !configuracionObraActualizada?.fechaInicio || diasHabilesObjetivo === 0) return [];

    const fechaInicio = parsearFechaLocal(configuracionObraActualizada.fechaInicio);

    const semanasPorProyecto = [];

    // Encontrar el lunes de la semana de inicio
    const primerLunes = new Date(fechaInicio);
    const diaSemana = primerLunes.getDay();
    const diasHastaLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
    primerLunes.setDate(primerLunes.getDate() + diasHastaLunes);

    // Calcular cuántas semanas necesitamos mostrar
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
        fecha.setHours(0, 0, 0, 0); // Normalizar a medianoche

        const esFinDeSemana = fecha.getDay() === 0 || fecha.getDay() === 6;
        const esFeriado = esFeriadoFn(fecha);

        // Normalizar fechaInicio para comparación precisa
        const fechaInicioNormalizada = new Date(fechaInicio);
        fechaInicioNormalizada.setHours(0, 0, 0, 0);

        const esAntesDeInicio = fecha < fechaInicioNormalizada;
        const esDespuesDelFinal = ultimoDiaHabil && fecha > ultimoDiaHabil;

        diasSemana.push({
          fecha: new Date(fecha),
          esHabil: !esFinDeSemana && !esFeriado && !esAntesDeInicio && !esDespuesDelFinal,
          esFinDeSemana,
          esFeriado,
          esAntesDeInicio,
          esDespuesDelFinal
        });
      }

      // Solo agregar la semana si tiene al menos un día hábil dentro del rango
      const tieneHabiles = diasSemana.some(d => d.esHabil);
      if (tieneHabiles) {
        const diasHabiles = diasSemana.filter(d => d.esHabil);
        const primerDiaHabil = diasHabiles[0]?.fecha;
        const ultimoDiaHabil = diasHabiles[diasHabiles.length - 1]?.fecha;

        // Generar semanaKey en formato ISO (YYYY-Www) usando el lunes de la semana
        const semanaKeyISO = getSemanaKeyISO(fechaActual);

        semanasPorProyecto.push({
          key: semanaKeyISO, // Usar formato ISO en lugar de "proyecto-semana-X"
          numeroSemana: numeroSemana,
          year: 'Proyecto',
          dias: diasSemana.filter(d => d.esHabil).map(d => d.fecha), // Solo días hábiles para compatibilidad
          diasCompletos: diasSemana, // Todos los días de la semana
          diasHabiles: diasHabiles.length,
          fechaInicio: primerDiaHabil || diasSemana[0].fecha, // Primer día hábil real
          fechaFin: ultimoDiaHabil || diasSemana[6].fecha // Último día hábil real
        });
        numeroSemana++;
      }

      // Avanzar a la siguiente semana
      fechaActual.setDate(fechaActual.getDate() + 7);
    }

    return semanasPorProyecto;
  }, [obra, configuracionObraActualizada?.fechaInicio, diasHabilesObjetivo, diasHabilesDisponibles]);

  // Resetear estados cuando se cierra el modal
  useEffect(() => {
    if (!show) {
      setProfesionalesSeleccionados([]);
      setSemanasObjetivo('');
      setModalidadAsignacion('');
      setAsignacionesPorSemana({});
      setSemanaSeleccionadaParaAsignar(null);
      setPaso(1);
      setPresupuesto(null);
    }
  }, [show]);

  // Calcular total de jornales asignados
  const totalJornalesAsignados = useMemo(() => {
    if (modalidadAsignacion === 'total') {
      // En modalidad total: cada profesional = 1 jornal/día × días hábiles
      return profesionalesSeleccionados.length * diasHabilesObjetivo;
    } else if (modalidadAsignacion === 'semanal') {
      // Sumar jornales de todas las semanas
      let total = 0;
      Object.values(asignacionesPorSemana).forEach(semana => {
        const profesionalesPorDia = semana.profesionales?.length || 0;
        Object.values(semana.cantidadesPorDia || {}).forEach(cantidad => {
          total += (parseInt(cantidad) || 0) * profesionalesPorDia;
        });
      });
      return total;
    }
    return 0;
  }, [modalidadAsignacion, profesionalesSeleccionados, asignacionesPorSemana, diasHabilesObjetivo]);

  const handleContinuarPaso1 = () => {
    if (!semanasObjetivo || semanasObjetivo <= 0) {
      alert('Por favor ingresa un número de semanas válido');
      return;
    }
    setPaso(2);
  };

  const handleSeleccionarModalidad = (modalidad) => {
    setModalidadAsignacion(modalidad);
    setPaso(3);
  };

  // Handler para eliminar todas las asignaciones de una semana
  const handleEliminarAsignacionesSemana = async (semanaKey, e) => {
    e.stopPropagation(); // Evitar que se abra el modal de edición

    if (!confirm('¿Estás seguro de eliminar todas las asignaciones de esta semana?')) {
      return;
    }

    try {
      const semana = semanas.find(s => s.key === semanaKey);
      if (!semana) {
        console.error('❌ No se encontró la semana:', semanaKey);
        return;
      }

      console.log('🗑️ Eliminando asignaciones para semana:', semanaKey, 'días:', semana.dias);

      // Buscar todas las asignaciones que pertenecen a esta semana
      const asignacionesAEliminar = [];

      asignacionesExistentes.forEach(asignacion => {
        if (asignacion.asignacionId) {
          // Verificar si la asignación tiene días en esta semana
          if (asignacion.asignacionesPorSemana && Array.isArray(asignacion.asignacionesPorSemana)) {
            asignacion.asignacionesPorSemana.forEach(asignacionSemanaData => {
              if (asignacionSemanaData.detallesPorDia && Array.isArray(asignacionSemanaData.detallesPorDia)) {
                const tieneDetallesEnEstaSemana = asignacionSemanaData.detallesPorDia.some(detalle => {
                  if (!detalle.fecha) return false;
                  const fechaDetalle = new Date(detalle.fecha).toDateString();
                  return semana.dias.some(diaSemana => {
                    const diaSemanaStr = new Date(diaSemana).toDateString();
                    return fechaDetalle === diaSemanaStr;
                  });
                });

                if (tieneDetallesEnEstaSemana) {
                  asignacionesAEliminar.push(asignacion.asignacionId);
                }
              }
            });
          }
        }
      });

      console.log('🗑️ IDs de asignaciones a eliminar:', asignacionesAEliminar);

      // Eliminar del backend
      if (asignacionesAEliminar.length > 0) {
        const eliminaciones = asignacionesAEliminar.map(asignacionId =>
          eliminarAsignacionSemanal(asignacionId, empresaSeleccionada.id)
            .then(() => {
              console.log('✅ Asignación eliminada del backend:', asignacionId);
              // Agregar a la lista de eliminadas para filtrar
              setAsignacionesEliminadas(prev => [...prev, asignacionId]);
            })
            .catch(error => {
              console.error('❌ Error eliminando asignación:', asignacionId, error);
              throw error;
            })
        );

        await Promise.all(eliminaciones);

        // Refrescar asignaciones después de eliminar todas
        await cargarAsignacionesExistentes();

        // Refrescar lista de profesionales disponibles
        if (onRefreshProfesionales) {
          await onRefreshProfesionales();
        }

        alert(`✅ Se eliminaron ${asignacionesAEliminar.length} asignación(es) de esta semana`);
      }

      // Eliminar del estado local
      setAsignacionesPorSemana(prev => {
        const nuevo = { ...prev };
        delete nuevo[semanaKey];
        return nuevo;
      });

      console.log('✅ Asignaciones de semana eliminadas:', semanaKey);
    } catch (error) {
      console.error('❌ Error eliminando asignaciones:', error);
      alert('Error al eliminar las asignaciones: ' + error.message);
    }
  };

  // Handler para abrir modal de selección de profesionales para una semana específica
  const handleAbrirSeleccionProfesionalesSemana = (semanaKey) => {
    setSemanaSeleccionadaParaAsignar(semanaKey);
    // Ahora abrimos el modal de gestión detallada
    setMostrarDetalleSemana(true);
  };

  // Handler para guardar la asignación detallada de una semana desde el nuevo modal
  const handleGuardarSemana = (semanaKey, asignacionesDia) => {
    // Calcular lista única de profesionales para la semana (para mostrar en la tarjeta de resumen)
    const profsMap = new Map();
    const cantidades = {};

    Object.entries(asignacionesDia).forEach(([fecha, lista]) => {
      // Validar fecha y cantidad
      if (lista && lista.length > 0) {
        // Asegurar formato fecha YYYY-MM-DD
        const fechaKey = fecha.includes('T') ? fecha.split('T')[0] : fecha;
        cantidades[fechaKey] = lista.length.toString();
        lista.forEach(p => profsMap.set(p.id, p));
      }
    });

    const profesionalesUnicos = Array.from(profsMap.values());

    console.log(`💾 Guardando semana ${semanaKey} con detalle diario:`, asignacionesDia);

    setAsignacionesPorSemana(prev => ({
      ...prev,
      [semanaKey]: {
        profesionales: profesionalesUnicos,
        asignacionesDia: asignacionesDia, // Estructura rica por día
        cantidadesPorDia: cantidades // Estructura simple para compatibilidad visual si es necesaria
      }
    }));

    setMostrarDetalleSemana(false);
  };

  const handleConfirmarProfesionales = React.useCallback((profesionales) => {
    if (modalidadAsignacion === 'total') {
      // Simplemente guardar los profesionales seleccionados
      // Cada profesional = 1 jornal/día automáticamente
      setProfesionalesSeleccionados(profesionales);
    } else if (modalidadAsignacion === 'semanal' && semanaSeleccionadaParaAsignar) {
      // Asignar profesionales a la semana seleccionada
      const semana = semanas.find(s => s.key === semanaSeleccionadaParaAsignar);
      if (!semana) return;

      // Pre-cargar con la cantidad de profesionales seleccionados
      const cantidadesPorDia = {};
      const cantidadProfesionales = profesionales.length.toString();

      semana.dias.forEach(dia => {
        const fechaKey = dia.toISOString().split('T')[0];
        // Pre-cargar con la cantidad de profesionales seleccionados
        cantidadesPorDia[fechaKey] = cantidadProfesionales;
      });

      // Guardar asignación de la semana
      setAsignacionesPorSemana(prev => ({
        ...prev,
        [semanaSeleccionadaParaAsignar]: {
          profesionales: profesionales,
          cantidadesPorDia: cantidadesPorDia
        }
      }));
    }
    setMostrarModalSeleccion(false);
  }, [modalidadAsignacion, semanaSeleccionadaParaAsignar, semanas]);

  const handleHideModalSeleccion = React.useCallback(() => {
    console.log('🛑 [AsignarProfesionalSemanalModal] onHide requested for SeleccionarProfesionalesModal');
    setMostrarModalSeleccion(false);
  }, []);

  const handleEliminarProfesional = (profesionalId) => {
    setProfesionalesSeleccionados(prev => prev.filter(p => p.id !== profesionalId));
  };

  const handleCantidadPorDiaChange = (semanaKey, fecha, cantidad) => {
    setAsignacionesPorSemana(prev => ({
      ...prev,
      [semanaKey]: {
        ...prev[semanaKey],
        cantidadesPorDia: {
          ...prev[semanaKey]?.cantidadesPorDia,
          [fecha]: cantidad
        }
      }
    }));
  };

  const handleEliminarProfesionalDeSemana = (semanaKey, profesionalId) => {
    setAsignacionesPorSemana(prev => {
      const semana = prev[semanaKey];
      if (!semana) return prev;

      const profesionalesActualizados = semana.profesionales.filter(p => p.id !== profesionalId);

      // Si no quedan profesionales, eliminar toda la semana
      if (profesionalesActualizados.length === 0) {
        const nuevo = { ...prev };
        delete nuevo[semanaKey];
        return nuevo;
      }

      return {
        ...prev,
        [semanaKey]: {
          ...semana,
          profesionales: profesionalesActualizados
        }
      };
    });
  };

  const handleAsignar = async (eliminarExistentes = false) => {
    // 🔥 TRABAJO EXTRA: Guardado especial con PUT a /api/v1/trabajos-extra/{id}
    if (obra._esTrabajoExtra) {
      console.log('🔥 [TRABAJO EXTRA] Iniciando guardado de profesionales...');

      // Validar que haya profesionales seleccionados
      if (!profesionalesSeleccionados || profesionalesSeleccionados.length === 0) {
        alert('⚠️ Debes seleccionar al menos un profesional');
        return;
      }

      setCargando(true);
      try {
        // 1. Obtener el trabajo extra completo actual
        console.log('📥 Obteniendo trabajo extra completo...');
        // ✅ FIX: Usar presupuesto ya cargado o ID correcto del trabajo extra
        let trabajoExtra;
        if (obra.presupuestoNoCliente) {
          console.log('📦 Usando presupuesto ya cargado desde obra.presupuestoNoCliente');
          trabajoExtra = obra.presupuestoNoCliente;
        } else {
          const trabajoExtraId = obra._trabajoExtraId || obra._trabajoAdicionalId || obra.presupuestoId;
          console.log('📦 Cargando trabajo extra desde API con ID:', trabajoExtraId);
          trabajoExtra = await api.trabajosExtra.getById(trabajoExtraId, empresaSeleccionada.id);
        }
        console.log('✅ Trabajo extra obtenido:', trabajoExtra);

        // 2. Validar que tenga itemsCalculadora con al menos un item
        if (!trabajoExtra.itemsCalculadora || trabajoExtra.itemsCalculadora.length === 0) {
          alert('❌ Error: El trabajo extra no tiene rubros (itemsCalculadora vacío)');
          setCargando(false);
          return;
        }

        const primerItem = trabajoExtra.itemsCalculadora[0];
        if (!primerItem.id) {
          alert('❌ Error: El rubro del trabajo extra no tiene ID');
          setCargando(false);
          return;
        }

        console.log('📋 Rubro a actualizar:', { id: primerItem.id, tipo: primerItem.tipoProfesional });

        // 3. Construir array de profesionales según especificación del backend
        const profesionalesPayload = profesionalesSeleccionados.map(prof => {
          // Buscar info completa del profesional en todosProfesionales
          const profComplete = todosProfesionales.find(p => p.id === prof.id) || prof;
          const cantJornales = diasHabilesObjetivo || 10;
          const valorJorn = profComplete.valorPromedio || 0;

          return {
            profesionalObraId: Number(prof.id),
            rol: profComplete.tipoProfesional || prof.tipoProfesional || 'Profesional',
            nombreCompleto: prof.nombre || profComplete.nombre || 'Sin nombre',
            cantidadJornales: cantJornales,
            valorJornal: valorJorn,
            subtotal: cantJornales * valorJorn, // ⚠️ OBLIGATORIO: calcular subtotal
            incluirEnCalculoDias: true
          };
        });

        console.log('👥 Profesionales a guardar:', profesionalesPayload);

        // 4. Calcular totales del item
        const totalJornales = profesionalesPayload.reduce((sum, p) => sum + p.cantidadJornales, 0);
        const importePromedio = profesionalesPayload.length > 0
          ? profesionalesPayload.reduce((sum, p) => sum + p.valorJornal, 0) / profesionalesPayload.length
          : 0;
        const subtotalManoObra = profesionalesPayload.reduce((sum, p) => sum + p.subtotal, 0);

        // 5. Construir payload según especificación del backend
        // ⚠️ IMPORTANTE: Debe incluir TODOS los campos obligatorios del item
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
              tipoProfesional: primerItem.tipoProfesional || 'Profesional',
              descripcion: primerItem.descripcion || 'Trabajo adicional',

              // ⚠️ CAMPOS OBLIGATORIOS DEL ITEM
              esModoManual: primerItem.esModoManual ?? false,
              esRubroVacio: primerItem.esRubroVacio ?? false,
              esGastoGeneral: primerItem.esGastoGeneral ?? false,
              incluirEnCalculoDias: primerItem.incluirEnCalculoDias ?? true,
              trabajaEnParalelo: primerItem.trabajaEnParalelo ?? true,

              // Cálculos actualizados con profesionales seleccionados
              cantidadJornales: totalJornales,
              importeJornal: importePromedio,
              subtotalManoObra: subtotalManoObra,
              total: subtotalManoObra, // Por ahora solo mano de obra (sin materiales/gastos)

              // Arrays de datos
              profesionales: profesionalesPayload,
              materialesLista: primerItem.materialesLista || [],
              gastosGenerales: primerItem.gastosGenerales || [],
              jornales: primerItem.jornales || []
            }
          ],
          dias: trabajoExtra.dias || []
        };

        console.log('📦 Payload completo a enviar:', JSON.stringify(payload, null, 2));

        // 5. Enviar PUT al backend
        // ✅ FIX: Usar ID correcto del trabajo extra
        const trabajoExtraId = obra._trabajoExtraId || obra._trabajoAdicionalId || obra.presupuestoId;
        console.log(`🌐 Enviando PUT a /api/v1/trabajos-extra/${trabajoExtraId}`);
        const resultado = await api.put(`/api/v1/trabajos-extra/${trabajoExtraId}`, payload, {
          headers: {
            'empresaId': empresaSeleccionada.id.toString()
          }
        });
        console.log('✅ Respuesta del backend:', resultado);

        // 6. Success feedback
        alert(`✅ ${profesionalesSeleccionados.length} profesional(es) asignado(s) correctamente al trabajo extra`);

        // 7. Actualizar UI
        if (onAsignar) {
          onAsignar();
        }
        if (onRefreshProfesionales) {
          onRefreshProfesionales();
        }

        setCargando(false);
        onHide();
        return; // ✅ Salir aquí, no continuar con lógica de obras normales

      } catch (error) {
        console.error('❌ Error asignando profesionales a trabajo extra:', error);
        alert(`❌ Error al guardar: ${error.message}`);
        setCargando(false);
        return;
      }
    }

    // 🔵 OBRA NORMAL: Lógica original para obras normales
    // Las asignaciones de planificación funcionan igual para obras normales y trabajos extra
    // Ambas usan tablas relacionales (asignaciones_profesional_obra, etc.)

    const tieneAsignacionesExistentes = Array.isArray(asignacionesExistentes) && asignacionesExistentes.length > 0;
    // Validaciones
    if (modalidadAsignacion === 'total') {
      if (profesionalesSeleccionados.length === 0) {
        if (tieneAsignacionesExistentes) {
          onHide();
          return;
        }
        const confirmarVacio = window.confirm('No has seleccionado ningún profesional. Al guardar, se eliminarán todas las asignaciones existentes de esta obra. ¿Estás seguro de continuar?');
        if (!confirmarVacio) {
          return;
        }
      }
      
      // Validar que todos los profesionales tengan rubro seleccionado (solo si hay rubros disponibles)
      if (rubros.length > 0) {
        const profesionalesSinRubro = profesionalesSeleccionados.filter(p => !p.rubroId);
        if (profesionalesSinRubro.length > 0) {
          const nombres = profesionalesSinRubro.map(p => p.nombre).join(', ');
          alert(`⚠️ Debes seleccionar un rubro para: ${nombres}`);
          return;
        }
      }
      
      // Ya no validamos cantidades porque cada profesional = 1 jornal/día automáticamente
    } else if (modalidadAsignacion === 'semanal') {
      if (Object.keys(asignacionesPorSemana).length === 0) {
        // Permitir guardar vacío (implica eliminar todo), pero confirmar antes
        if (tieneAsignacionesExistentes) {
          onHide();
          return;
        }
        const confirmarVacio = window.confirm('No hay profesionales asignados en ninguna semana. Al guardar, se eliminarán todas las asignaciones existentes de esta obra. ¿Estás seguro de continuar?');
        if (!confirmarVacio) {
          return;
        }
      }
    }

    setCargando(true);
    try {
      const obraIdParaQuery = getObraId(); // ✅ Usa ID real de la obra

      // ✅ VALIDACIÓN: Verificar que obraId sea válido
      if (!obraIdParaQuery || obraIdParaQuery === 0) {
        console.error('❌ Error: obraId inválido');
        console.error('   - obra recibida:', obra);
        console.error('   - obra.id:', obra?.id);
        console.error('   - obra._esTrabajoExtra:', obra?._esTrabajoExtra);
        console.error('   - getObraId() devolvió:', obraIdParaQuery);

        alert(`❌ Error: No se puede asignar profesionales.\n\nDetalles técnicos:\n- ObraId: ${obraIdParaQuery}\n- Obra ID directo: ${obra?.id}\n- Es trabajo extra: ${obra?._esTrabajoExtra}\n\nPor favor contacte al administrador con esta información.`);
        setCargando(false);
        return;
      }

      // PASO 1: Eliminar asignaciones existentes SOLO si se solicita explícitamente
      if (eliminarExistentes) {
        console.log('🗑️ [MODO REEMPLAZAR] Limpiando asignaciones existentes de la obra (bulk delete):', obraIdParaQuery);

        try {
          await eliminarAsignacionesPorObra(obraIdParaQuery, empresaSeleccionada.id);
          console.log('✅ Asignaciones eliminadas correctamente en lote');
        } catch (error) {
          console.warn('⚠️ Error en eliminación por lote (puede no haber asignaciones o endpoint no soportado):', error.message);
          console.warn('🔄 Intentando eliminación individual como fallback...');

          try {
            // Fallback: Intentar obtener asignaciones actuales y eliminar una por una
            const responseAsignaciones = await obtenerAsignacionesSemanalPorObra(obraIdParaQuery, empresaSeleccionada.id);
            console.log('📋 Respuesta completa fetch asignaciones:', responseAsignaciones);

            // Manejar posibles estructuras de respuesta (Array directo, objeto con data, Pageable con content)
            let asignacionesArray = [];
            if (Array.isArray(responseAsignaciones)) {
               asignacionesArray = responseAsignaciones;
            } else if (Array.isArray(responseAsignaciones?.data)) {
               asignacionesArray = responseAsignaciones.data;
            } else if (Array.isArray(responseAsignaciones?.data?.content)) {
               // Soporte para Spring Pageable
               asignacionesArray = responseAsignaciones.data.content;
            } else if (Array.isArray(responseAsignaciones?.content)) {
               asignacionesArray = responseAsignaciones.content;
            }

            console.log(`📋 Fallback: Encontradas ${asignacionesArray.length} asignaciones para eliminar.`);

            if (asignacionesArray.length > 0) {
              console.log(`🗑️ Iniciando eliminación secuencial de ${asignacionesArray.length} registros...`);
              let eliminadosCount = 0;

              for (const asignacion of asignacionesArray) {
                // Validar ID
                const idParaBorrar = asignacion.id || asignacion.asignacionId;

                if (idParaBorrar) {
                  try {
                    console.log(`🗑️ Eliminando asignación ID: ${idParaBorrar}...`);
                    await eliminarAsignacionSemanal(idParaBorrar, empresaSeleccionada.id);
                    console.log(`✅ Asignación ${idParaBorrar} eliminada.`);
                    eliminadosCount++;
                  } catch (error) {
                    console.warn(`⚠️ Falló eliminación de ID ${idParaBorrar}:`, error.message);

                    // Intento desesperado: probar ruta antigua por si acaso
                    try {
                        // Importar dinámicamente o usar apiClient directo si fuera posible,
                        // pero asumiremos que el error es definitivo por ahora.
                    } catch (e) {}
                  }
                } else {
                   console.warn('⚠️ Objeto asignación sin ID reconocido:', asignacion);
                }
              }
              console.log(`🏁 Proceso de eliminación finalizado. Borrados: ${eliminadosCount}/${asignacionesArray.length}`);
            } else {
              console.log('✅ No pareció haber asignaciones previas que eliminar (Array vacío o formato desconocido).');
            }
          } catch (errorFallback) {
            console.warn('⚠️ Error en fallback de eliminación:', errorFallback.message);
            // Continuar de todas formas - puede que no haya asignaciones previas
          }
        }
      } else {
        console.log('➕ [MODO AGREGAR] Conservando asignaciones existentes - agregando nuevos profesionales');
      }

      // PASO 2: Guardar profesionales adhoc (temporales) en el catálogo antes de asignar
      console.log('🔍 Verificando profesionales adhoc antes de asignar...');

      const profesionalesConIdNumerico = [];
      const mapaIdAdhocANumerico = new Map(); // adhoc_xxx → ID numérico

      for (const prof of profesionalesSeleccionados) {
        const esAdhoc = prof._esAdhoc === true || (typeof prof.id === 'string' && prof.id.startsWith('adhoc_'));

        if (esAdhoc) {
          console.log(`💾 Profesional adhoc detectado: ${prof.nombre} - Guardando en catálogo con categoría INDEPENDIENTE...`);

          try {
            const dataProfesional = {
              nombre: prof.nombre,
              tipoProfesional: prof.tipoProfesional,
              honorarioDia: prof.honorarioDia || 0,
              telefono: prof.telefono || '',
              email: prof.email || '',
              empresaId: empresaSeleccionada.id,
              activo: true,
              categoria: 'INDEPENDIENTE' // Profesional independiente (no empleado)
            };

            const response = await api.profesionales.create(dataProfesional);
            const profesionalCreado = response?.data || response;

            if (!profesionalCreado || !profesionalCreado.id) {
              throw new Error('El backend no devolvió un ID válido para el profesional adhoc');
            }

            console.log(`✅ Profesional adhoc guardado en catálogo: ${profesionalCreado.nombre} (ID: ${profesionalCreado.id})`);

            // Guardar mapeo para modalidad semanal
            mapaIdAdhocANumerico.set(prof.id, profesionalCreado.id);

            // Agregar con el ID numérico del backend
            profesionalesConIdNumerico.push({
              ...prof,
              id: profesionalCreado.id,
              _esGuardado: true,
              _eraAdhoc: true // Flag para rastrear que fue adhoc
            });

          } catch (error) {
            console.error(`❌ Error guardando profesional adhoc "${prof.nombre}":`, error);
            alert(`❌ Error: No se pudo guardar el profesional "${prof.nombre}" en el catálogo.\n\n${error.response?.data?.message || error.message}\n\nLa asignación se canceló.`);
            setCargando(false);
            return;
          }
        } else {
          // Profesional ya existe en el catálogo
          profesionalesConIdNumerico.push(prof);
        }
      }

      console.log('✅ Todos los profesionales tienen ID numérico:', profesionalesConIdNumerico.map(p => ({ id: p.id, nombre: p.nombre })));
      if (mapaIdAdhocANumerico.size > 0) {
        console.log('🔄 Mapa de conversión adhoc → numérico:', Array.from(mapaIdAdhocANumerico.entries()));
      }
      // Construir payload según el contrato del backend
      const payload = {
        obraId: Number(obraIdParaQuery), // ✅ Usa ID real de la obra
        modalidad: modalidadAsignacion,
        semanasObjetivo: parseInt(semanasObjetivo) || 0,
      };

      if (modalidadAsignacion === 'total') {
        // En modalidad total (equipo fijo), cada profesional trabaja 1 jornal/día automáticamente
        payload.profesionales = profesionalesConIdNumerico.map(prof => ({
          profesionalId: Number(prof.id),
          nombre: prof.nombre,
          rubroId: prof.rubroId || null,
          rubroNombre: prof.rubroNombre || null,
          cantidadPorDia: 1 // Número, no string
        }));

        console.log('📤 Profesionales para modalidad total:', JSON.stringify(payload.profesionales, null, 2));
      } else if (modalidadAsignacion === 'semanal') {
        // Convertir asignacionesPorSemana a formato de payload
        console.log('🔍 asignacionesPorSemana state:', JSON.stringify(asignacionesPorSemana, null, 2));

        payload.asignacionesPorSemana = Object.entries(asignacionesPorSemana).map(([semanaKey, datos]) => {
          console.log(`🔍 Procesando semana ${semanaKey}:`, datos);

          // Validar que haya profesionales
          if (!datos.profesionales || datos.profesionales.length === 0) {
            console.warn(`⚠️ Semana ${semanaKey} no tiene profesionales asignados`);
            return null;
          }

          // Validar cantidadesPorDia
          const cantidadesPorDia = datos.cantidadesPorDia || {};
          console.log(`🔍 Cantidades por día para semana ${semanaKey}:`, cantidadesPorDia);

          // Filtrar cantidades vacías o inválidas y formatear fechas correctamente
          const cantidadesLimpias = {};
          Object.entries(cantidadesPorDia).forEach(([fecha, cantidad]) => {
            const cantidadNum = parseInt(cantidad);
            if (!isNaN(cantidadNum) && cantidadNum > 0) {
              // Asegurar que la fecha esté en formato YYYY-MM-DD
              let fechaFormateada = fecha;
              if (fecha.includes('T')) {
                fechaFormateada = fecha.split('T')[0];
              }
              // Enviar como número para consistencia con 'detallesPorDia'
              cantidadesLimpias[fechaFormateada] = cantidadNum;
            }
          });

          console.log(`🔍 Cantidades limpias para semana ${semanaKey}:`, cantidadesLimpias);

          // Construir objeto de retorno.
          // IMPORTANTÍSIMO: Convertir IDs adhoc a numéricos usando el mapa
          const profesionalesValidos = (datos.profesionales || [])
            .map(prof => {
              // Si el ID es adhoc (string), convertirlo usando el mapa
              const esAdhoc = typeof prof.id === 'string' && prof.id.startsWith('adhoc_');
              const idFinal = esAdhoc ? mapaIdAdhocANumerico.get(prof.id) : prof.id;

              if (!idFinal || isNaN(Number(idFinal))) {
                console.warn(`⚠️ Profesional con ID inválido descartado:`, prof);
                return null;
              }

              return {
                profesionalId: Number(idFinal),
                nombre: prof.nombre || 'Profesional',
                rubroId: prof.rubroId || null,
                rubroNombre: prof.rubroNombre || null
              };
            })
            .filter(p => p !== null); // Eliminar nulos

          const semanaPayload = {
            semanaKey: !isNaN(parseInt(semanaKey)) ? parseInt(semanaKey) : semanaKey,
            profesionales: profesionalesValidos
          };

          let usoDetalles = false;

          // Si tenemos detalle específico por día, lo agregamos
          if (datos.asignacionesDia) {
             const detalles = [];
             Object.entries(datos.asignacionesDia).forEach(([fecha, listaProfesionales]) => {
                const fechaFormateada = fecha.includes('T') ? fecha.split('T')[0] : fecha;

                if (Array.isArray(listaProfesionales)) {
                  listaProfesionales.forEach(prof => {
                      if (prof && prof.id) {
                         // Convertir ID adhoc a numérico si es necesario
                         const esAdhoc = typeof prof.id === 'string' && prof.id.startsWith('adhoc_');
                         const idFinal = esAdhoc ? mapaIdAdhocANumerico.get(prof.id) : prof.id;

                         if (idFinal && !isNaN(Number(idFinal))) {
                           detalles.push({
                               fecha: fechaFormateada,
                               profesionalId: Number(idFinal),
                               cantidad: 1 // Por defecto 1 jornal
                           });
                         } else {
                           console.warn(`⚠️ Profesional con ID inválido en detalles descartado:`, prof);
                         }
                      }
                  });
                }
             });

             if (detalles.length > 0) {
               semanaPayload.detallesPorDia = detalles;
               usoDetalles = true;

               // ⚠️ FIX CRÍTICO: El backend SIEMPRE requiere 'cantidadesPorDia' para validar la semana.
               // Si usamos detalles, debemos generar un mapa de fechas activas, pero NO sumar la cantidad de profesionales.
               // El backend usa este valor como "cantidad por defecto por profesional", por lo que si enviamos la suma (ej. 2),
               // asignará 2 jornales a cada profesional. Debemos enviar '1' fijo para indicar actividad normal.
               const cantidadesDesdeDetalles = {};
               detalles.forEach(d => {
                   cantidadesDesdeDetalles[d.fecha] = 1;
               });

               // Sobrescribimos o asignamos las cantidades calculadas
               semanaPayload.cantidadesPorDia = cantidadesDesdeDetalles;
             }
          }

          // Si NO se usaron detalles, usamos las cantidades manuales ingresadas
          if (!usoDetalles) {
             if (Object.keys(cantidadesLimpias).length > 0) {
                semanaPayload.cantidadesPorDia = cantidadesLimpias;
             }
          }

          // Validación Crítica para Backend:
          // Debe existir cantidadesPorDia y no estar vacío
          const tieneCantidades = semanaPayload.cantidadesPorDia && Object.keys(semanaPayload.cantidadesPorDia).length > 0;

          if (!tieneCantidades) {
             console.warn(`⚠️ Semana ${semanaKey} descartada por no tener días asignados (validacion backend)`);
             return null;
          }

          return semanaPayload;
        }).filter(item => item !== null); // Filtrar semanas sin profesionales

        console.log('📤 asignacionesPorSemana procesadas:', JSON.stringify(payload.asignacionesPorSemana, null, 2));
      }

      console.log('📤 Payload a enviar:', JSON.stringify(payload, null, 2));
      console.log('🏢 EmpresaId:', empresaSeleccionada.id);

      // PASO 3: Evaluar si necesitamos llamar al backend para crear
      // Si la lista de asignaciones está vacía, significaba que queríamos borrar todo.
      // Como ya hicimos el paso de borrado en el PASO 1, no hace falta llamar a crear
      let hayDatosParaGuardar = false;

      // Debug Payload Final
      console.log('📦================ PAYLOAD FINAL POST ================📦');
      console.log(JSON.stringify(payload, null, 2));
      console.log('======================================================');

      if (modalidadAsignacion === 'total') {
        hayDatosParaGuardar = payload.profesionales && payload.profesionales.length > 0;
      } else if (modalidadAsignacion === 'semanal') {
        hayDatosParaGuardar = payload.asignacionesPorSemana && payload.asignacionesPorSemana.length > 0;
      }

      if (!hayDatosParaGuardar) {
        console.log('⚠️ No hay datos nuevos para guardar - Se asume eliminación exitosa');
        alert('✅ Asignaciones eliminadas correctamente');

        if (onAsignar) onAsignar();
        if (onRefreshProfesionales) onRefreshProfesionales();
        setCargando(false);
        onHide();
        return;
      }

      // ⚠️ VALIDACIÓN CRÍTICA: Verificar que el payload tenga estructura válida
      console.log('🔍 ================ VALIDACIÓN FINAL DE PAYLOAD ================');
      console.log('🆔 ObraId:', payload.obraId, 'Tipo:', typeof payload.obraId);
      console.log('🎯 Modalidad:', payload.modalidad);
      console.log('📅 SemanasObjetivo:', payload.semanasObjetivo);
      console.log('🏢 EmpresaId:', empresaSeleccionada.id, 'Tipo:', typeof empresaSeleccionada.id);

      if (payload.modalidad === 'total') {
        console.log('✅ Modalidad TOTAL - Profesionales:', payload.profesionales?.length || 0);
        payload.profesionales?.forEach((prof, idx) => {
          console.log(`   Profesional ${idx + 1}:`, {
            profesionalId: prof.profesionalId,
            nombre: prof.nombre,
            cantidadPorDia: prof.cantidadPorDia,
            tipo_profesionalId: typeof prof.profesionalId,
            tipo_cantidadPorDia: typeof prof.cantidadPorDia
          });
        });
      } else if (payload.modalidad === 'semanal') {
        console.log('✅ Modalidad SEMANAL - Semanas:', payload.asignacionesPorSemana?.length || 0);
        payload.asignacionesPorSemana?.forEach((semana, idx) => {
          console.log(`   Semana ${idx + 1}:`, {
            semanaKey: semana.semanaKey,
            profesionales: semana.profesionales?.length || 0,
            cantidadesPorDia: Object.keys(semana.cantidadesPorDia || {}).length,
            detallesPorDia: semana.detallesPorDia?.length || 0
          });
        });
      }

      // Verificar valores inválidos
      const errores = [];
      if (!payload.obraId || payload.obraId === 0 || isNaN(payload.obraId)) {
        errores.push(`⚠️ obraId inválido: ${payload.obraId}`);
      }
      if (!payload.modalidad || (payload.modalidad !== 'total' && payload.modalidad !== 'semanal')) {
        errores.push(`⚠️ modalidad inválida: ${payload.modalidad}`);
      }
      if (payload.modalidad === 'total') {
        if (!payload.profesionales || payload.profesionales.length === 0) {
          errores.push('⚠️ Modalidad total sin profesionales');
        }
        payload.profesionales?.forEach((prof, idx) => {
          if (!prof.profesionalId || isNaN(prof.profesionalId)) {
            errores.push(`⚠️ Profesional ${idx + 1}: profesionalId inválido (${prof.profesionalId})`);
          }
          if (!prof.cantidadPorDia || isNaN(prof.cantidadPorDia)) {
            errores.push(`⚠️ Profesional ${idx + 1}: cantidadPorDia inválido (${prof.cantidadPorDia})`);
          }
        });
      } else if (payload.modalidad === 'semanal') {
        if (!payload.asignacionesPorSemana || payload.asignacionesPorSemana.length === 0) {
          errores.push('⚠️ Modalidad semanal sin semanas asignadas');
        }
      }

      if (errores.length > 0) {
        console.error('❌ PAYLOAD INVÁLIDO - Errores encontrados:');
        errores.forEach(err => console.error(err));
        alert(`❌ Error: Datos inválidos para enviar al backend\n\n${errores.join('\n')}\n\nRevise la consola (F12) para más detalles.`);
        setCargando(false);
        return;
      }

      console.log('✅ Payload validado - Procediendo a enviar al backend...');
      console.log('==============================================================');

      // Llamar al servicio del backend (siempre POST después de eliminar)
      // NOTA: El bloqueo para trabajos extra ya se ejecutó al inicio de handleAsignar
      const response = await crearAsignacionSemanal(payload, empresaSeleccionada.id);

      // 🔍 DEBUG: Ver qué retorna exactamente el backend
      console.log('🔍 Response completo del backend:', response);
      console.log('🔍 Response.data:', response.data);
      console.log('🔍 Response.status:', response.status);
      console.log('🔍 Response keys:', Object.keys(response));
      console.log('🔍 Response prototype:', Object.getPrototypeOf(response));
      console.log('🔍 Response stringified:', JSON.stringify(response, null, 2));

      // Verificar si es una estructura de axios o algo diferente
      if (response.config && response.headers) {
        console.log('✅ Es una respuesta de axios');
      } else {
        console.log('❌ NO es una respuesta de axios estándar');
      }

      // Verificar si la respuesta es exitosa basándose en el status HTTP o estructura
      const isSuccessful = response.status === 200 ||
                          response.status === 201 ||
                          response.success === true ||  // Para responses que no son de axios
                          (response.data && response.data.success === true) ||
                          (response.data && !response.data.error && !response.data.message);

      if (isSuccessful) {
        // 🔢 Calcular estadísticas precisas desde el payload enviado (Frontend Truth)
        // Esto evita depender de cálculos del backend que pueden devolver datos confusos
        const stats = {
            jornales: 0,
            diasUnicos: new Set(),
            profesionalesUnicos: new Set()
        };

        if (payload.asignacionesPorSemana) {
           payload.asignacionesPorSemana.forEach(semana => {
               // Contar profesionales únicos
               if (semana.profesionales) {
                   semana.profesionales.forEach(p => stats.profesionalesUnicos.add(p.profesionalId));
               }

               // Contar jornales y días (Prioridad: detallesPorDia)
               if (semana.detallesPorDia && semana.detallesPorDia.length > 0) {
                   stats.jornales += semana.detallesPorDia.length;
                   semana.detallesPorDia.forEach(d => stats.diasUnicos.add(d.fecha));
               } else if (semana.cantidadesPorDia) {
                   // Fallback legacy (aunque ahora siempre normalizamos a cantidades=1)
                   const numDias = Object.keys(semana.cantidadesPorDia).length;
                   const numProfs = semana.profesionales ? semana.profesionales.length : 0;
                   stats.jornales += (numDias * numProfs);
                   Object.keys(semana.cantidadesPorDia).forEach(fecha => stats.diasUnicos.add(fecha));
               }
           });
        }

        let mensaje = '✅ Asignación creada exitosamente';
        let detalles = '';

        // Usar datos calculados si están disponibles, sino fallback al backend
        const displayJornales = stats.jornales > 0 ? stats.jornales : (response.data?.totalJornalesAsignados || 'N/A');
        const displayDias = stats.diasUnicos.size > 0 ? stats.diasUnicos.size : (response.data?.diasHabiles || 'N/A');
        const displayProfesionales = stats.profesionalesUnicos.size > 0 ? stats.profesionalesUnicos.size : (response.data?.profesionalesAsignados || 'N/A');

        detalles = `\n• Jornales asignados: ${displayJornales}\n• Días hábiles: ${displayDias}\n• Profesionales: ${displayProfesionales}`;

        if (response.data && response.data.message && !response.data.error) {
             mensaje = response.data.message;
        } else if (response.message) {
             mensaje = response.message;
        }

        alert(mensaje + detalles);

        if (onAsignar) onAsignar();
        if (onRefreshProfesionales) onRefreshProfesionales();
        setCargando(false);
        onHide();
        // Recargar página para asegurar consistencia total si se añadieron muchos datos
        window.location.reload();
        return;
      }

      // La respuesta no fue exitosa
      const errorMessage = response.data?.message || response.data?.error || response.message || response.error || `Error HTTP ${response.status || 'desconocido'}`;
      throw new Error(errorMessage);
    } catch (error) {
      console.error('Error al asignar profesionales:', error);
      console.error('Error completo:', {
        message: error.message,
        response: error.response,
        request: error.request,
        config: error.config
      });

      // Manejo de errores según el contrato del backend
      if (error.response) {
        const { status, data } = error.response;

        console.error('Response status:', status);
        console.error('Response data:', data);

        let errorMessage = '';

        if (status === 400) {
          // Error de validación
          if (data && typeof data === 'object') {
            errorMessage = `❌ Error de validación:\n${data.message || data.error || JSON.stringify(data, null, 2)}`;
          } else {
            errorMessage = `❌ Error de validación: ${data || 'Datos inválidos'}`;
          }
        } else if (status === 404) {
          errorMessage = `❌ No encontrado:\n${data.message || data.error || 'Recurso no encontrado'}`;
        } else if (status === 500) {
          // Error 500 - Error interno del servidor
          console.error('🚨 Error 500 del servidor');
          if (data && typeof data === 'object') {
            errorMessage = `❌ Error del servidor (500):\n${data.message || data.error || 'Error interno del servidor'}`;

            // Si hay stack trace o detalles adicionales
            if (data.trace) {
              console.error('Stack trace del backend:', data.trace);
            }
            if (data.path) {
              console.error('Path del error:', data.path);
            }
            if (data.timestamp) {
              console.error('Timestamp del error:', data.timestamp);
            }
          } else {
            errorMessage = `❌ Error del servidor (500): ${data || 'Error interno del servidor'}`;
          }
        } else {
          errorMessage = `❌ Error del servidor (${status}):\n${data?.message || data?.error || data || 'Error desconocido'}`;
        }

        alert(errorMessage);
      } else if (error.request) {
        // Request se hizo pero no hubo respuesta
        console.error('No response from server:', error.request);
        alert('❌ Error de conexión con el servidor\n\nVerifica que el backend esté corriendo');
      } else {
        // Error al configurar la request
        console.error('Error configurando request:', error.message);
        alert(`❌ Error: ${error.message}`);
      }
    } finally {
      setCargando(false);
    }
  };

  const formatearFecha = (fecha) => {
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return `${dias[fecha.getDay()]} ${fecha.getDate()}/${fecha.getMonth() + 1}`;
  };

  const formatearFechaCompleta = (fecha) => {
    return `${fecha.getDate()}/${fecha.getMonth() + 1}/${fecha.getFullYear()}`;
  };

  // Función para eliminar una asignación individual
  const handleEliminarAsignacion = async (asignacionId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta asignación?')) {
      return;
    }

    try {
      console.log('🗑️ Eliminando asignación:', asignacionId);

      // 🔥 BIFURCACIÓN: Trabajos extra vs Obras normales
      if (obra._esTrabajoExtra) {
        // Eliminar profesional de trabajo extra usando endpoint DELETE específico
        await api.delete(`/api/v1/trabajos-extra/profesionales/${asignacionId}`, {
          headers: {
            'empresaId': empresaSeleccionada.id.toString()
          }
        });
        console.log('✅ Profesional eliminado del trabajo extra');
      } else {
        // Obra normal: usar endpoint tradicional
        await eliminarAsignacionSemanal(asignacionId, empresaSeleccionada.id);
      }

      alert('✅ Asignación eliminada correctamente');

      // Recargar asignaciones para actualizar la vista
      await cargarAsignacionesExistentes();

      // Refrescar lista de profesionales disponibles en la página padre
      if (onRefreshProfesionales) {
        await onRefreshProfesionales();
      }

    } catch (error) {
      console.error('❌ Error eliminando asignación:', error);
      alert(`❌ Error eliminando asignación: ${error.message || error}`);
    }
  };

  // Función para eliminar jornales diarios
  const handleEliminarJornal = async (jornalId, profesionalNombre) => {
    if (!window.confirm(`¿Estás seguro de eliminar el jornal de ${profesionalNombre}?`)) {
      return;
    }

    try {
      console.log('🗑️ Eliminando jornal:', jornalId);
      
      await eliminarJornalDiario(jornalId, empresaSeleccionada.id);
      
      alert('✅ Jornal eliminado correctamente');

      // Recargar asignaciones para actualizar la vista
      await cargarAsignacionesExistentes();

      // Refrescar lista de profesionales disponibles en la página padre
      if (onRefreshProfesionales) {
        await onRefreshProfesionales();
      }

    } catch (error) {
      console.error('❌ Error eliminando jornal:', error);
      alert(`❌ Error eliminando jornal: ${error.message || error}`);
    }
  };

  // Función para eliminar todas las asignaciones de un profesional específico
  const handleEliminarProfesionalDeObra = async (profesionalId, nombreProfesional) => {
    console.log('🗑️ [DEBUG] Iniciando eliminación de profesional:', { profesionalId, nombreProfesional });
    console.log('🗑️ [DEBUG] Tipo de profesionalId:', typeof profesionalId);
    console.log('🗑️ [DEBUG] asignacionesExistentes:', asignacionesExistentes);

    if (!window.confirm(`¿Estás seguro de que quieres eliminar todas las asignaciones de ${nombreProfesional} de esta obra?`)) {
      return;
    }

    try {
      // Solo procesar asignaciones ACTIVAS (todas las que vienen del backend)
      const asignacionesActivas = asignacionesExistentes;

      console.log('🗑️ [DEBUG] asignacionesActivas filtradas:', asignacionesActivas);

      const asignacionesParaEliminar = [];

      asignacionesActivas.forEach(asignacion => {
        console.log('🗑️ [DEBUG] Revisando asignación:', asignacion);
        let tieneElProfesional = false;

        // La estructura del backend es siempre anidada
        if (asignacion.asignacionesPorSemana && Array.isArray(asignacion.asignacionesPorSemana)) {
          asignacion.asignacionesPorSemana.forEach(semana => {
            if (semana.detallesPorDia && Array.isArray(semana.detallesPorDia)) {
              semana.detallesPorDia.forEach(detalle => {
                console.log('🗑️ [DEBUG] Revisando detalle:', { detalle, profesionalIdBuscado: profesionalId, tipoDetalle: typeof detalle.profesionalId, tipoBuscado: typeof profesionalId });
                if (detalle.profesionalId === profesionalId && detalle.cantidad > 0) {
                  console.log('🗑️ [DEBUG] ¡MATCH! Encontrado en estructura anidada:', detalle.profesionalId, '===', profesionalId);
                  tieneElProfesional = true;
                } else if (parseInt(detalle.profesionalId) === parseInt(profesionalId) && detalle.cantidad > 0) {
                  console.log('🗑️ [DEBUG] ¡MATCH con parseInt! Encontrado:', detalle.profesionalId, '===', profesionalId);
                  tieneElProfesional = true;
                } else {
                  console.log('🗑️ [DEBUG] No match:', detalle.profesionalId, '!==', profesionalId, 'cantidad:', detalle.cantidad);
                }
              });
            }
          });
        }

        if (tieneElProfesional) {
          const id = asignacion.asignacionId; // Usar asignacionId que es lo que devuelve el backend
          console.log('🗑️ [DEBUG] Agregando a eliminar - ID:', id);
          if (id) {
            asignacionesParaEliminar.push(id);
          }
        }
      });

      console.log(`🗑️ [DEBUG] Total asignaciones para eliminar: ${asignacionesParaEliminar.length}`, asignacionesParaEliminar);

      if (asignacionesParaEliminar.length === 0) {
        console.log('❌ [DEBUG] No se encontraron asignaciones para eliminar');
        alert(`❌ No se encontraron asignaciones activas de ${nombreProfesional} para eliminar.`);
        return;
      }

      // Eliminar cada asignación
      let eliminadas = 0;
      for (const asignacionId of asignacionesParaEliminar) {
        try {
          console.log(`🗑️ [DEBUG] Eliminando asignación ID: ${asignacionId}`);
          const resultado = await eliminarAsignacionSemanal(asignacionId, empresaSeleccionada.id);
          console.log(`🗑️ [DEBUG] Resultado eliminación:`, resultado);
          eliminadas++;
        } catch (error) {
          console.error(`❌ Error eliminando asignación ${asignacionId}:`, error);
          console.error(`❌ Error completo:`, error.response || error.message || error);
        }
      }

      if (eliminadas > 0) {
        alert(`✅ Se marcaron como inactivas ${eliminadas} asignaciones de ${nombreProfesional}`);

        // Agregar IDs eliminados al tracking local para filtrado inmediato
        setAsignacionesEliminadas(prev => {
          const nuevasEliminadas = [...prev, ...asignacionesParaEliminar];
          console.log('🎯 [DEBUG] Agregando al tracking de eliminadas:', asignacionesParaEliminar);
          console.log('🎯 [DEBUG] Lista actualizada de eliminadas:', nuevasEliminadas);
          return nuevasEliminadas;
        });

        // Forzar recarga con delay para asegurar que el backend procese la eliminación
        setTimeout(async () => {
          console.log('🔄 [DEBUG] Iniciando recarga después de eliminar...');

          try {
            await cargarAsignacionesExistentes();
            console.log('🔄 [DEBUG] Recarga de asignaciones completada exitosamente');
          } catch (error) {
            console.error('🔄 [DEBUG] Error en recarga de asignaciones:', error);
          }

          // Refrescar lista de profesionales disponibles si está disponible
          if (onRefreshProfesionales) {
            try {
              console.log('🔄 [DEBUG] Refrescando lista de profesionales disponibles...');
              await onRefreshProfesionales();
              console.log('🔄 [DEBUG] Refresh de profesionales completado');
            } catch (error) {
              console.error('🔄 [DEBUG] Error en refresh de profesionales:', error);
            }
          }
        }, 500);
      } else {
        alert(`❌ No se pudo eliminar ninguna asignación de ${nombreProfesional}`);
      }

    } catch (error) {
      console.error('❌ Error eliminando asignaciones del profesional:', error);
      alert(`❌ Error eliminando asignaciones: ${error.message || error}`);
    }
  };

  // Memoizar semanaActual para evitar re-renders innecesarios en el modal hijo
  const semanaActualTotal = useMemo(() => {
    return modalidadAsignacion === 'total' && semanas.length > 0
      ? { dias: semanas.flatMap(s => s.dias) }
      : null;
  }, [modalidadAsignacion, semanas]);

  const fechaInicioTotal = useMemo(() => {
    return modalidadAsignacion === 'total' && diasHabilesDisponibles.length > 0
    ? diasHabilesDisponibles[0]
    : null;
  }, [modalidadAsignacion, diasHabilesDisponibles]);

  const fechaFinTotal = useMemo(() => {
    return modalidadAsignacion === 'total' && diasHabilesDisponibles.length > 0
    ? diasHabilesDisponibles[diasHabilesDisponibles.length - 1]
    : null;
  }, [modalidadAsignacion, diasHabilesDisponibles]);

  // Handler para remover profesional de una semana específica
  const handleRemoverProfesionalDeSemana = (semanaKey, profId) => {
    setAsignacionesPorSemana(prev => {
      const newState = { ...prev };

      if (!newState[semanaKey]) return prev;

      // 1. Remover de lista de profesionales
      if (newState[semanaKey].profesionales) {
        newState[semanaKey].profesionales = newState[semanaKey].profesionales.filter(p => p.id !== profId);
      }

      // 2. Remover de asignacionesDia (donde se guarda asignación día por día)
      if (newState[semanaKey].asignacionesDia) {
        Object.keys(newState[semanaKey].asignacionesDia).forEach(fecha => {
          newState[semanaKey].asignacionesDia[fecha] = newState[semanaKey].asignacionesDia[fecha].filter(p => p.id !== profId);
        });

        // Limpiar días vacíos
        Object.keys(newState[semanaKey].asignacionesDia).forEach(fecha => {
          if (newState[semanaKey].asignacionesDia[fecha].length === 0) {
            delete newState[semanaKey].asignacionesDia[fecha];
          }
        });
      }

      // 3. Si queda sin profesionales o asignaciones, evaluar eliminar la semana
      const hasProfesionales = newState[semanaKey].profesionales && newState[semanaKey].profesionales.length > 0;
      if (!hasProfesionales) {
        delete newState[semanaKey];
      }

      return newState;
    });
  };

  const renderTablaProfesionalesAsignados = () => {
    console.log('🔍 [renderTablaProfesionalesAsignados] asignacionesExistentes:', asignacionesExistentes);
    console.log('🔍 [renderTablaProfesionalesAsignados] asignacionesExistentes.length:', asignacionesExistentes?.length);

    // � PRIORIDAD 0: Separar jornales diarios de asignaciones planificadas
    const jornalesDiarios = asignacionesExistentes.filter(a => a.tipoAsignacion === 'JORNAL_DIARIO');
    const asignacionesPlanificadas = asignacionesExistentes.filter(a => a.tipoAsignacion !== 'JORNAL_DIARIO');
    
    console.log('✅ Jornales diarios encontrados:', jornalesDiarios.length);
    console.log('✅ Asignaciones planificadas encontradas:', asignacionesPlanificadas.length);

    // 🔥 PRIORIDAD 1: Si hay asignaciones en modalidad 'total', mostrarlas directamente
    const asignacionesTotales = asignacionesPlanificadas.filter(a => a.modalidad === 'total');
    console.log('🔍 [renderTablaProfesionalesAsignados] asignacionesTotales:', asignacionesTotales);
    console.log('🔍 [renderTablaProfesionalesAsignados] asignacionesTotales.length:', asignacionesTotales.length);
    if (asignacionesTotales.length > 0) {
      console.log('✅ Renderizando asignaciones en modalidad TOTAL:', asignacionesTotales);

      // Extraer profesionales únicos
      const profesionalesUnicos = [];
      const profesionalesIds = new Set();

      asignacionesTotales.forEach(asignacion => {
        if (asignacion.profesionalId && !profesionalesIds.has(asignacion.profesionalId)) {
          profesionalesIds.add(asignacion.profesionalId);
          profesionalesUnicos.push({
            id: asignacion.profesionalId,
            nombre: asignacion.profesionalNombre || `Profesional ${asignacion.profesionalId}`,
            tipoProfesional: asignacion.profesionalTipo || 'Profesional',
            cantidadJornales: asignacion.cantidadJornales,
            valorJornal: asignacion.valorJornal,
            subtotal: asignacion.subtotal
          });
        }
      });

      if (profesionalesUnicos.length > 0) {
        return (
          <div className="mt-3">
            <div className="alert alert-success mb-3">
              <i className="fas fa-check-circle me-2"></i>
              <strong>Modalidad:</strong> Asignación por Obra Completa
              <br />
              <small className="text-muted">
                {profesionalesUnicos.length} profesional(es) asignado(s) a toda la obra
              </small>
            </div>

            <div className="table-responsive">
              <table className="table table-sm table-hover table-bordered">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: '25%' }}>Profesional</th>
                    <th style={{ width: '15%' }}>Tipo</th>
                    <th style={{ width: '15%' }}>Rubro</th>
                    <th className="text-center" style={{ width: '10%' }}>Jornales</th>
                    <th className="text-end" style={{ width: '12%' }}>Valor Jornal</th>
                    <th className="text-end" style={{ width: '13%' }}>Subtotal</th>
                    <th className="text-center" style={{ width: '10%' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {profesionalesUnicos.map(prof => {
                    // Buscar la asignación completa para obtener el asignacionId y rubroNombre
                    const asignacionCompleta = asignacionesTotales.find(a => a.profesionalId === prof.id);
                    const rubroNombre = asignacionCompleta?.rubroNombre || 'Sin rubro';
                    const asignacionId = asignacionCompleta?.asignacionId || asignacionCompleta?.id;
                    
                    return (
                      <tr key={prof.id}>
                        <td>
                          <i className="fas fa-user me-2 text-primary"></i>
                          <strong>{prof.nombre}</strong>
                        </td>
                        <td>
                          <span className="badge bg-info">
                            {prof.tipoProfesional}
                          </span>
                        </td>
                        <td>
                          {rubroNombre !== 'Sin rubro' ? (
                            <span className="badge bg-secondary text-wrap" style={{ fontSize: '0.75rem' }}>
                              {rubroNombre}
                            </span>
                          ) : (
                            <small className="text-muted">Sin rubro</small>
                          )}
                        </td>
                        <td className="text-center">
                          <span className="badge bg-info">{prof.cantidadJornales || '0'}</span>
                        </td>
                        <td className="text-end">
                          {prof.valorJornal ? `$${prof.valorJornal.toLocaleString('es-AR')}` : '$0'}
                        </td>
                        <td className="text-end">
                          <strong>
                            {prof.subtotal ? `$${prof.subtotal.toLocaleString('es-AR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}` : '$0.00'}
                          </strong>
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => {
                              if (window.confirm(`¿Estás seguro de eliminar la asignación de ${prof.nombre}?`)) {
                                handleEliminarAsignacion(asignacionId);
                              }
                            }}
                            title="Eliminar asignación"
                            disabled={cargando || !asignacionId}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="table-light">
                  <tr>
                    <td colSpan="5" className="text-end fw-bold">
                      TOTAL:
                    </td>
                    <td className="text-end fw-bold text-success">
                      ${profesionalesUnicos
                        .reduce((sum, prof) => sum + (prof.subtotal || 0), 0)
                        .toLocaleString('es-AR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      }
    }

    // � PRIORIDAD 1.5: Si hay jornales diarios, mostrarlos en tabla separada o combinada
    if (jornalesDiarios.length > 0) {
      console.log('✅ Renderizando jornales diarios:', jornalesDiarios);

      // Agrupar jornales por profesional
      const jornalesPorProfesional = {};
      jornalesDiarios.forEach(jornal => {
        const profId = jornal.profesionalId;
        if (!jornalesPorProfesional[profId]) {
          jornalesPorProfesional[profId] = {
            profesionalId: profId,
            profesionalNombre: jornal.profesionalNombre,
            profesionalTipo: jornal.profesionalTipo,
            rubroNombre: jornal.rubroNombre,
            jornales: []
          };
        }
        jornalesPorProfesional[profId].jornales.push(jornal);
      });

      const profesionalesConJornales = Object.values(jornalesPorProfesional);

      return (
        <div className="mt-3">
          <div className="alert alert-info mb-3">
            <i className="fas fa-calendar-day me-2"></i>
            <strong>Modalidad:</strong> Asignación por Día
            <br />
            <small className="text-muted">
              {profesionalesConJornales.length} profesional(es) con {jornalesDiarios.length} jornal(es) registrado(s)
            </small>
          </div>

          <div className="table-responsive">
            <table className="table table-sm table-hover table-bordered">
              <thead className="table-light">
                <tr>
                  <th style={{ width: '18%' }}>Profesional</th>
                  <th style={{ width: '12%' }}>Tipo</th>
                  <th style={{ width: '12%' }}>Rubro</th>
                  <th className="text-center" style={{ width: '10%' }}>Jornales</th>
                  <th className="text-center" style={{ width: '10%' }}>Total Días</th>
                  <th className="text-end" style={{ width: '13%' }}>Total Cobrado</th>
                  <th className="text-center" style={{ width: '25%' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {profesionalesConJornales.map(prof => {
                  const totalHoras = prof.jornales.reduce((sum, j) => sum + (j.horasTrabajadasDecimal || 0), 0);
                  const totalCobrado = prof.jornales.reduce((sum, j) => sum + (j.montoCobrado || 0), 0);
                  const cantidadJornales = prof.jornales.length;

                  return (
                    <tr key={prof.profesionalId}>
                      <td>
                        <i className="fas fa-calendar-day me-2 text-success"></i>
                        <strong>{prof.profesionalNombre}</strong>
                        <br />
                        <div className="d-flex flex-wrap gap-1 mt-1">
                          {prof.jornales.map((j, idx) => {
                            const fechaFormateada = new Date(j.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
                            const fraccion = j.horasTrabajadasDecimal || 0;
                            return (
                              <span 
                                key={idx} 
                                className="badge bg-light text-dark border d-inline-flex align-items-center gap-1" 
                                style={{ fontSize: '0.75rem', paddingRight: '4px' }}
                              >
                                📅 {fechaFormateada} ({fraccion}d)
                                <button
                                  type="button"
                                  className="btn btn-sm p-0 text-danger"
                                  style={{ 
                                    border: 'none', 
                                    background: 'transparent',
                                    fontSize: '0.9rem',
                                    lineHeight: '1',
                                    width: '16px',
                                    height: '16px',
                                    marginLeft: '2px'
                                  }}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (window.confirm(`¿Eliminar jornal del ${fechaFormateada} de ${prof.profesionalNombre}?\n\nFracción: ${fraccion} días\nMonto: $${j.montoCobrado?.toLocaleString('es-AR')}`)) {
                                      setCargando(true);
                                      try {
                                        await eliminarJornalDiario(j.jornalId, empresaSeleccionada.id);
                                        alert('✅ Jornal eliminado correctamente');
                                        await cargarAsignacionesExistentes();
                                        if (onRefreshProfesionales) {
                                          await onRefreshProfesionales();
                                        }
                                      } catch(error) {
                                        console.error('Error eliminando jornal:', error);
                                        alert(`❌ Error: ${error.message || error}`);
                                      } finally {
                                        setCargando(false);
                                      }
                                    }
                                  }}
                                  title="Eliminar este jornal"
                                  disabled={cargando}
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td>
                        <span className="badge bg-info">{prof.profesionalTipo}</span>
                      </td>
                      <td>
                        {prof.rubroNombre && prof.rubroNombre !== 'Sin rubro' ? (
                          <span className="badge bg-secondary text-wrap" style={{ fontSize: '0.75rem' }}>
                            {prof.rubroNombre}
                          </span>
                        ) : (
                          <small className="text-muted">Sin rubro</small>
                        )}
                      </td>
                      <td className="text-center">
                        <span className="badge bg-success">{cantidadJornales}</span>
                      </td>
                      <td className="text-center">
                        <span className="badge bg-primary" style={{ fontSize: '0.9rem' }}>
                          {totalHoras.toFixed(2)} días
                        </span>
                      </td>
                      <td className="text-end">
                        <strong>
                          ${totalCobrado.toLocaleString('es-AR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </strong>
                      </td>
                      <td className="text-center">
                        <div className="d-flex gap-2 justify-content-center">
                          <button
                            type="button"
                            className="btn btn-sm btn-info text-white"
                            onClick={() => {
                              // Abrir historial para ver jornales individuales  
                              if (onAbrirHistorialJornales) {
                                onAbrirHistorialJornales();
                              } else {
                                alert('Ver jornales individuales en el Historial');
                              }
                            }}
                            title="Ver jornales en detalle"
                          >
                            <i className="bi bi-eye me-1"></i>
                            Ver
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={async () => {
                              if (window.confirm(`¿Eliminar TODOS los ${prof.jornales.length} jornal(es) de ${prof.profesionalNombre}?\n\nTotal: $${totalCobrado.toLocaleString('es-AR')}\n\nTambién puedes eliminar jornales individuales haciendo clic en la × de cada fecha.`)) {
                                setCargando(true);
                                try {
                                  // Eliminar todos los jornales de este profesional
                                  let eliminados = 0;
                                  for (const jornal of prof.jornales) {
                                    await eliminarJornalDiario(jornal.jornalId, empresaSeleccionada.id);
                                    eliminados++;
                                  }
                                  
                                  alert(`✅ ${eliminados} jornal(es) eliminado(s) correctamente`);
                                  
                                  // Recargar asignaciones
                                  await cargarAsignacionesExistentes();
                                  
                                  // Refrescar lista de profesionales disponibles
                                  if (onRefreshProfesionales) {
                                    await onRefreshProfesionales();
                                  }
                                } catch(error) {
                                  console.error('Error eliminando jornales:', error);
                                  alert(`❌ Error eliminando jornales: ${error.message || error}`);
                                } finally {
                                  setCargando(false);
                                }
                              }
                            }}
                            title="Eliminar todos los jornales"
                            disabled={cargando}
                          >
                            <i className="bi bi-trash me-1"></i>
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="table-light">
                <tr>
                  <td colSpan="5" className="text-end fw-bold">
                    TOTAL:
                  </td>
                  <td className="text-end fw-bold text-success">
                    ${jornalesDiarios
                      .reduce((sum, j) => sum + (j.montoCobrado || 0), 0)
                      .toLocaleString('es-AR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      );
    }

    // �🔵 OPCIÓN 2: Si no hay semanas, mostrar mensaje apropiado
    if (!semanas || semanas.length === 0) {
      // Si hay asignacionesExistentes pero no son 'total', puede ser un problema
      if (asignacionesExistentes.length > 0) {
        console.warn('⚠️ Hay asignaciones pero no se pueden renderizar:', asignacionesExistentes);
      }

      return (
        <div className="alert alert-info mb-0">
          <small>
            <i className="fas fa-info-circle me-2"></i>
            No hay profesionales asignados. Selecciona una modalidad para comenzar.
          </small>
        </div>
      );
    }

    // 🟢 OPCIÓN 3: Lógica normal para asignaciones semanales
    return (
      <div className="mt-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h6 className="mb-0">
            <i className="fas fa-users me-2"></i>
            Profesionales Asignados
          </h6>
          <small className="text-muted">
            Clic en una semana para modificar asignaciones
          </small>
        </div>

        {(() => {
          const profesionalesPorSemana = {};

          semanas.forEach(semana => {
            const asignacionSemana = asignacionesPorSemana[semana.key];
            const profesionalesNuevos = asignacionSemana?.profesionales || [];

            const profesionalesExistentes = [];
            asignacionesExistentes.forEach(asignacion => {
              if (asignacion.asignacionesPorSemana && Array.isArray(asignacion.asignacionesPorSemana)) {
                asignacion.asignacionesPorSemana.forEach(asignacionSemanaData => {
                  if (asignacionSemanaData.detallesPorDia && Array.isArray(asignacionSemanaData.detallesPorDia)) {
                    asignacionSemanaData.detallesPorDia.forEach(detalle => {
                      if (detalle.profesionalId && detalle.cantidad > 0 && detalle.fecha) {
                        const fechaDetalle = new Date(detalle.fecha);
                        const estaEnEstaSemana = semana.dias.some(diaSemana => {
                          const diaSemanaFormat = new Date(diaSemana);
                          return fechaDetalle.toDateString() === diaSemanaFormat.toDateString();
                        });

                        if (estaEnEstaSemana) {
                          const profesionalInfo = todosProfesionales.find(p => p.id === detalle.profesionalId)
                            || profesionalesDisponibles.find(p => p.id === detalle.profesionalId);
                          const yaExiste = profesionalesExistentes.some(p => p.id === detalle.profesionalId);
                          if (!yaExiste) {
                            profesionalesExistentes.push({
                              id: detalle.profesionalId,
                              nombre: profesionalInfo?.nombre || `Profesional ${detalle.profesionalId}`,
                              tipoProfesional: profesionalInfo?.tipoProfesional || profesionalInfo?.tipo_profesional || 'Trabajador',
                              asignacionId: asignacion.asignacionId
                            });
                          }
                        }
                      }
                    });
                  }
                });
              }
            });

            const todosProfesionalesSemana = [...profesionalesExistentes, ...profesionalesNuevos];
            if (todosProfesionalesSemana.length > 0) {
              profesionalesPorSemana[semana.key] = {
                semana,
                profesionales: todosProfesionalesSemana
              };
            }
          });

          const hayAsignaciones = Object.keys(profesionalesPorSemana).length > 0;

          if (!hayAsignaciones) {
            return (
              <div className="alert alert-info mb-0">
                <small>
                  <i className="fas fa-info-circle me-2"></i>
                  No hay profesionales asignados. Haz clic en cada semana para comenzar a asignar.
                </small>
              </div>
            );
          }

          return (
            <div className="table-responsive">
              <table className="table table-sm table-hover">
                <thead className="table-light">
                  <tr>
                    <th style={{width: '120px'}}>Semana</th>
                    <th>Profesional</th>
                    <th>Tipo</th>
                    <th>Días Asignados</th>
                    <th style={{width: '100px'}} className="text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(profesionalesPorSemana).map(([semanaKey, data]) => {
                    const diasPorProfesional = {};

                    data.profesionales.forEach(prof => {
                      diasPorProfesional[prof.id] = [];

                      asignacionesExistentes.forEach(asignacion => {
                        if (asignacion.asignacionesPorSemana) {
                          asignacion.asignacionesPorSemana.forEach(semanaData => {
                            if (semanaData.semanaKey === semanaKey && semanaData.detallesPorDia) {
                              semanaData.detallesPorDia.forEach(detalle => {
                                if (detalle.profesionalId === prof.id && detalle.fecha) {
                                  const fecha = parsearFechaLocal(detalle.fecha);
                                  const diaFormato = fecha.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
                                  diasPorProfesional[prof.id].push(diaFormato);
                                }
                              });
                            }
                          });
                        }
                      });

                      const asignacionLocal = asignacionesPorSemana[semanaKey];
                      if (asignacionLocal?.asignacionesDia) {
                        Object.entries(asignacionLocal.asignacionesDia).forEach(([fecha, profesionales]) => {
                          if (profesionales.some(p => p.id === prof.id)) {
                            const fechaObj = parsearFechaLocal(fecha);
                            const diaFormato = fechaObj.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
                            if (!diasPorProfesional[prof.id].includes(diaFormato)) {
                              diasPorProfesional[prof.id].push(diaFormato);
                            }
                          }
                        });
                      }
                    });

                    return data.profesionales.map((prof, idx) => (
                      <tr key={`${semanaKey}-${prof.id}-${idx}`}>
                        {idx === 0 && (
                          <td rowSpan={data.profesionales.length} className="align-middle">
                            <strong className="text-primary">Semana {data.semana.numeroSemana}</strong>
                            <br />
                            <small className="text-muted">
                              {data.semana.fechaInicio?.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                              {' - '}
                              {data.semana.fechaFin?.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                            </small>
                          </td>
                        )}
                        <td>{prof.nombre}</td>
                        <td>
                          <span className="badge bg-secondary" style={{fontSize: '0.7rem'}}>
                            {prof.tipoProfesional}
                          </span>
                        </td>
                        <td>
                          {diasPorProfesional[prof.id] && diasPorProfesional[prof.id].length > 0 ? (
                            <div className="d-flex flex-wrap gap-1">
                              {diasPorProfesional[prof.id].map((dia, diaIdx) => (
                                <span key={diaIdx} className="badge bg-info text-dark" style={{fontSize: '0.65rem'}}>
                                  {dia}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <small className="text-muted">Toda la semana</small>
                          )}
                        </td>
                        <td className="text-center">
                          {prof.asignacionId ? (
                            <button
                              className="btn btn-sm btn-outline-danger"
                              style={{padding: '2px 8px', fontSize: '0.75rem'}}
                              onClick={async (e) => {
                                e.stopPropagation();
                                // Usar handleEliminarAsignacion que soporta trabajos extra
                                await handleEliminarAsignacion(prof.asignacionId);
                              }}
                              title="Eliminar asignación"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          ) : (
                            <small className="text-muted">Nuevo</small>
                          )}
                        </td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>
    );
  };

  if (!show) return null;

  return (
    <>
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-xl" style={{ maxWidth: '90%', marginTop: '10px' }}>
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              Asignación Semanal de Profesionales - {obra?.nombre}
            </h5>
          </div>

          <div className="modal-body" style={{ minHeight: '65vh', maxHeight: '85vh', overflowY: 'auto' }}>
        {/* Paso 1: Definir semanas objetivo - Solo si no hay configuración global */}
        {paso === 1 && !configuracionObra && (
          <div>
            <h5 className="mb-4">Paso 1: Define el tiempo de ejecución</h5>

            <div className="alert alert-info">
              <strong>Información de la obra:</strong>
              <ul className="mb-0 mt-2">
                <li>Jornales totales necesarios: <strong>{jornalesTotales.toFixed(2)}</strong></li>
                {configuracionObraActualizada?.fechaInicio && (
                  <li>Fecha de inicio: <strong>{formatearFechaCompleta(new Date(configuracionObraActualizada.fechaInicio))}</strong></li>
                )}
              </ul>
            </div>

            <Form.Group className="mb-3">
              <Form.Label>¿En cuántas semanas quieres terminar la obra?</Form.Label>
              <Form.Control
                type="number"
                min="1"
                value={semanasObjetivo}
                onChange={(e) => setSemanasObjetivo(e.target.value)}
                placeholder="Ej: 4"
                autoFocus
              />
              <Form.Text className="text-muted">
                Esto equivale a {diasHabilesObjetivo} días hábiles
              </Form.Text>
            </Form.Group>

            {semanasObjetivo && (
              <div className="alert alert-success">
                <strong>Capacidad necesaria:</strong> Para terminar en {semanasObjetivo} semanas ({diasHabilesObjetivo} días hábiles),
                necesitas una capacidad de <strong>{capacidadNecesaria} jornales por día</strong>.
                <br />
                <small className="text-muted">
                  Cálculo: {jornalesTotales.toFixed(2)} jornales ÷ {diasHabilesObjetivo} días = {capacidadNecesaria} jornales/día
                </small>
              </div>
            )}

            <div className="d-flex justify-content-end mt-4">
              <Button variant="primary" onClick={handleContinuarPaso1}>
                Continuar
              </Button>
            </div>
          </div>
        )}

        {/* Paso 2: Seleccionar modalidad */}
        {paso === 2 && (
          <div>
            <h5 className="mb-4">Paso 2: Elige el tipo de asignación</h5>

            <div className="alert alert-secondary mb-4">
              <strong>Recordatorio:</strong> Necesitas {capacidadNecesaria} trabajadores/día durante {diasHabilesObjetivo} días
            </div>

            <div className="row">
              <div className="col-md-6 mb-3">
                <div
                  className={`border rounded p-4 cursor-pointer h-100 ${modalidadAsignacion === 'total' ? 'border-primary bg-light' : ''}`}
                  onClick={() => handleSeleccionarModalidad('total')}
                  style={{ cursor: 'pointer' }}
                >
                  <h6 className="text-primary">
                    <i className="bi bi-people-fill me-2"></i>
                    Asignación por Obra Completa
                  </h6>
                  <p className="text-muted mb-0">
                    Asigna los mismos profesionales a toda la obra de forma constante
                  </p>
                  <small className="text-muted">
                    Recomendado cuando el mismo equipo trabaja toda la obra
                  </small>
                </div>
              </div>

              <div className="col-md-6 mb-3">
                <div
                  className={`border rounded p-4 cursor-pointer h-100 ${modalidadAsignacion === 'semanal' ? 'border-primary bg-light' : ''}`}
                  onClick={() => handleSeleccionarModalidad('semanal')}
                  style={{ cursor: 'pointer' }}
                >
                  <h6 className="text-success">
                    <i className="bi bi-calendar-week-fill me-2"></i>
                    Asignación por Semana
                  </h6>
                  <p className="text-muted mb-0">
                    Asigna diferentes profesionales por semana según las necesidades de cada etapa
                  </p>
                  <small className="text-muted">
                    Recomendado para obras con fases diferenciadas o equipos rotativos
                  </small>
                </div>
              </div>
            </div>

            {/* Sección de profesionales ya asignados */}
            {(profesionalesSeleccionados.length > 0 || Object.keys(asignacionesPorSemana).length > 0) && (
              <div className="card mb-3 border-info">
                <div className="card-header bg-info text-white">
                  <h6 className="mb-0">
                    <i className="fas fa-users me-2"></i>
                    Profesionales Actualmente Asignados
                  </h6>
                </div>
                <div className="card-body">
                  {modalidadAsignacion === 'total' && profesionalesSeleccionados.length > 0 && (
                    <div>
                      <small className="text-muted d-block mb-2">Modalidad: Obra Completa</small>
                      <div className="d-flex flex-wrap gap-2">
                        {profesionalesSeleccionados.map(prof => (
                          <span key={prof.id} className="badge bg-primary" style={{ fontSize: '0.9rem' }}>
                            <i className="fas fa-user me-1"></i>
                            {prof.nombre} - {prof.tipoProfesional}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {modalidadAsignacion === 'semanal' && Object.keys(asignacionesPorSemana).length > 0 && (
                    <div>
                      <small className="text-muted d-block mb-2">Modalidad: Por Semana</small>
                      {Object.entries(asignacionesPorSemana).map(([semanaKey, datos], index) => {
                        // Convertir semanaKey (2026-W03) a formato legible
                        const semanaNumero = index + 1;
                        const semanaLabel = `Semana ${semanaNumero}`;

                        // Calcular días asignados por profesional para esta semana
                        const diasPorProfesional = {};
                        if (datos.profesionales) {
                          datos.profesionales.forEach(prof => {
                            diasPorProfesional[prof.id] = [];

                            // Buscar en asignaciones existentes
                            asignacionesExistentes.forEach(asignacion => {
                              if (asignacion.asignacionesPorSemana) {
                                asignacion.asignacionesPorSemana.forEach(semanaData => {
                                  if (semanaData.semanaKey === semanaKey && semanaData.detallesPorDia) {
                                    semanaData.detallesPorDia.forEach(detalle => {
                                      if (detalle.profesionalId === prof.id && detalle.fecha) {
                                        const fecha = parsearFechaLocal(detalle.fecha);
                                        const diaFormato = fecha.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
                                        diasPorProfesional[prof.id].push(diaFormato);
                                      }
                                    });
                                  }
                                });
                              }
                            });

                            // También buscar en estado local
                            if (datos.asignacionesDia) {
                              Object.entries(datos.asignacionesDia).forEach(([fecha, profesionales]) => {
                                if (profesionales.some(p => p.id === prof.id)) {
                                  const fechaObj = parsearFechaLocal(fecha);
                                  const diaFormato = fechaObj.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
                                  if (!diasPorProfesional[prof.id].includes(diaFormato)) {
                                    diasPorProfesional[prof.id].push(diaFormato);
                                  }
                                }
                              });
                            }
                          });
                        }

                        return (
                          <div key={semanaKey} className="mb-3">
                            <small className="fw-bold text-secondary">
                              <i className="fas fa-calendar-week me-1"></i>
                              {semanaLabel}:
                            </small>
                            <div className="mt-1">
                              {datos.profesionales && datos.profesionales.map(prof => (
                                <div key={prof.id} className="d-flex align-items-center gap-2 mb-2">
                                  <span className="badge bg-success" style={{ fontSize: '0.85rem', minWidth: '150px' }}>
                                    <i className="fas fa-user me-1"></i>
                                    {prof.nombre}
                                  </span>
                                  <button
                                    type="button"
                                    className="btn btn-link btn-sm text-danger p-0 px-1"
                                    onClick={() => handleRemoverProfesionalDeSemana(semanaKey, prof.id)}
                                    title="Quitar de esta semana"
                                  >
                                    <i className="fas fa-times-circle"></i>
                                  </button>
                                  {diasPorProfesional[prof.id] && diasPorProfesional[prof.id].length > 0 && (
                                    <div className="d-flex flex-wrap gap-1">
                                      {diasPorProfesional[prof.id].map((dia, idx) => (
                                        <span key={idx} className="badge bg-info text-dark" style={{ fontSize: '0.65rem' }}>
                                          {dia}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tabla de Profesionales Ya Asignados - Mostrar siempre */}
            <div className="card mb-3 border-success">
              <div className="card-header bg-success text-white">
                <h6 className="mb-0">
                  <i className="fas fa-user-check me-2"></i>
                  Profesionales Ya Asignados
                </h6>
              </div>
              <div className="card-body">
                {loadingAsignaciones ? (
                  <div className="text-center py-3">
                    <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                    <small className="text-muted">Cargando asignaciones...</small>
                  </div>
                ) : asignacionesExistentes.length > 0 || Object.keys(asignacionesPorSemana).length > 0 ? (
                  renderTablaProfesionalesAsignados()
                ) : (
                  <div className="alert alert-info mb-0">
                    <i className="fas fa-info-circle me-2"></i>
                    No hay profesionales asignados aún. <strong>Selecciona una modalidad arriba para comenzar.</strong>
                  </div>
                )}
                
                {/* Debug info */}
                {!loadingAsignaciones && asignacionesExistentes.length === 0 && (
                  <details className="mt-2">
                    <summary className="text-muted" style={{ cursor: 'pointer', fontSize: '0.8em' }}>
                      🔍 Debug: Ver estado
                    </summary>
                    <pre className="bg-light p-2 mt-2" style={{ fontSize: '0.7em', maxHeight: '200px', overflow: 'auto' }}>
                      {JSON.stringify({
                        asignacionesExistentesLength: asignacionesExistentes.length,
                        asignacionesPorSemanaKeys: Object.keys(asignacionesPorSemana),
                        loadingAsignaciones,
                        obraId: obra?.id,
                        empresaId: empresaSeleccionada?.id
                      }, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          </div>
        )} {/* Fin paso 2 */}

        {/* Paso 3: Realizar asignación */}
        {paso === 3 && (
          <div>
            <h5 className="mb-4">
              {modalidadAsignacion === 'total' ? 'Asignación por Obra Completa' : 'Asignación por Semana'}
            </h5>

            {/* Información de la obra */}
            <div className="card mb-3 border-primary">
              <div className="card-body">
                <h6 className="card-title">
                  <i className="fas fa-building me-2"></i>
                  {obra?.nombre}
                </h6>
                <div className="row">
                  <div className="col-md-3">
                    <small className="text-muted d-block">Tiempo estimado:</small>
                    <strong className="text-primary">{jornalesTotales.toFixed(0)} días hábiles</strong>
                  </div>
                  <div className="col-md-3">
                    <small className="text-muted d-block">Duración planificada:</small>
                    <strong className="text-success">
                      {configuracionObra?.diasHabiles || diasHabilesObjetivo} días (
                      {(() => {
                        // 🔥 Calcular semanas dinámicamente desde fecha de inicio y días hábiles
                        // (Logica movida para evitar log spam en render)
                        const diasHabiles = configuracionObra?.diasHabiles || diasHabilesObjetivo;
                        const fechaInicio = obra?.presupuestoNoCliente?.fechaProbableInicio;

                        if (fechaInicio && diasHabiles > 0) {
                          const fechaInicioParsed = parsearFechaLocal(fechaInicio);
                          const semanasCalculadas = Math.ceil(diasHabiles / 5); // Estimacion rapida o calculo real
                          // PREVENCION LOG SPAM: Quitamos logs de renderizado directo
                          return semanasCalculadas;
                        }

                        // Fallback: usar configuración guardada
                        return configuracionObra?.semanasObjetivo || semanasObjetivo;
                      })()} sem.)
                    </strong>
                  </div>
                  <div className="col-md-3">
                    <small className="text-muted d-block">Equipo necesario:</small>
                    <strong className="text-warning">{capacidadNecesaria} trabajadores/día</strong>
                  </div>
                  <div className="col-md-3">
                    <small className="text-muted d-block">Total semanal:</small>
                    <strong className="text-info">{(capacidadNecesaria * 5).toFixed(0)} jornales</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Asignación por Obra Completa - Mostrar botón para seleccionar profesionales */}
            {modalidadAsignacion === 'total' && (() => {
              // Obtener profesionales únicos de asignaciones existentes si no hay seleccionados
              let profesionalesMostrar = [...profesionalesSeleccionados];

              if (profesionalesMostrar.length === 0 && Object.keys(asignacionesPorSemana).length > 0) {
                // Extraer profesionales únicos de asignaciones semanales
                const profesionalesSet = new Map();
                Object.values(asignacionesPorSemana).forEach(semana => {
                  if (semana.profesionales) {
                    semana.profesionales.forEach(prof => {
                      if (!profesionalesSet.has(prof.id)) {
                        profesionalesSet.set(prof.id, prof);
                      }
                    });
                  }
                });
                profesionalesMostrar = Array.from(profesionalesSet.values());
              }

              const hayProfesionales = profesionalesMostrar.length > 0;

              return (
                <div>
                  <div className="card mb-3">
                    <div className="card-header bg-primary text-white">
                      <h6 className="mb-0">
                        <i className="fas fa-users me-2"></i>
                        Equipo Asignado a Toda la Obra
                      </h6>
                    </div>
                    <div className="card-body">
                      {/* Advertencia si cambiando modalidad */}
                      {Object.keys(asignacionesPorSemana).length > 0 && profesionalesSeleccionados.length === 0 && (
                        <div className="alert alert-warning mb-3">
                          <i className="fas fa-exclamation-triangle me-2"></i>
                          <strong>Atención:</strong> Ya tienes profesionales asignados por semana.
                          Si cambias a modalidad "Obra Completa", se eliminarán las asignaciones semanales al guardar.
                        </div>
                      )}

                      <div className="mb-3">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => setMostrarModalSeleccion(true)}
                        >
                          <i className="bi bi-person-plus me-2"></i>
                          {hayProfesionales ? 'Modificar Equipo' : 'Seleccionar Profesionales'}
                        </Button>
                      </div>

                      {/* Lista de profesionales seleccionados */}
                      {hayProfesionales ? (
                      <>
                        <div className="table-responsive mb-3">
                          <table className="table table-sm table-bordered">
                            <thead className="table-light">
                              <tr>
                                <th style={{ width: '40%' }}>Profesional</th>
                                <th style={{ width: '45%' }}>Rubro</th>
                                <th style={{ width: '15%' }} className="text-center">Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {profesionalesMostrar.map(prof => {
                                const seleccionado = profesionalesSeleccionados.find(p => p.id === prof.id);
                                return (
                                  <tr key={prof.id}>
                                    <td>
                                      <strong>{prof.nombre}</strong>
                                      {prof.tipoProfesional && (
                                        <div className="text-muted small">{prof.tipoProfesional}</div>
                                      )}
                                    </td>
                                    <td>
                                      {seleccionado ? (
                                        <Form.Select
                                          size="sm"
                                          value={seleccionado.rubroId || ''}
                                          onChange={(e) => handleCambiarRubroProfesional(prof.id, e.target.value)}
                                          className={!seleccionado.rubroId ? 'border-danger' : ''}
                                        >
                                          <option value="">-- Seleccionar Rubro --</option>
                                          {rubros.map(r => (
                                            <option key={r.id} value={r.id}>{r.nombreRubro}</option>
                                          ))}
                                        </Form.Select>
                                      ) : (
                                        <span className="text-muted small">-</span>
                                      )}
                                      {seleccionado && !seleccionado.rubroId && (
                                        <small className="text-danger d-block">
                                          ⚠️ Debe seleccionar un rubro
                                        </small>
                                      )}
                                    </td>
                                    <td className="text-center">
                                      {seleccionado && (
                                        <button
                                          type="button"
                                          className="btn btn-sm btn-outline-danger"
                                          onClick={() => handleEliminarProfesional(prof.id)}
                                          title="Eliminar profesional"
                                        >
                                          <i className="bi bi-trash"></i>
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* 🔥 NUEVO: Panel de comparación de tiempo estimado */}
                        {compararProfesionalesVsPresupuesto.estado !== 'sin-datos' && compararProfesionalesVsPresupuesto.estado !== 'sin-asignacion' && (
                          <div className={`alert alert-${compararProfesionalesVsPresupuesto.color} mb-3 border-${compararProfesionalesVsPresupuesto.color}`} style={{ borderWidth: '2px' }}>
                            <div className="d-flex align-items-start gap-2">
                              <div style={{ fontSize: '1.5rem' }}>{compararProfesionalesVsPresupuesto.emoji}</div>
                              <div className="flex-grow-1">
                                <strong className="d-block mb-2" style={{ fontSize: '1.05rem' }}>
                                  {compararProfesionalesVsPresupuesto.mensaje}
                                </strong>
                                <div className="small">
                                  <div className="mb-1">
                                    <i className="fas fa-calculator me-2"></i>
                                    <strong>Cálculo:</strong> {compararProfesionalesVsPresupuesto.jornalesPresupuesto.toFixed(0)} jornales totales ÷ {compararProfesionalesVsPresupuesto.profesionalesAsignados.toFixed(1)} profesionales/día = {compararProfesionalesVsPresupuesto.diasReales} días
                                  </div>
                                  <div>
                                    <i className="fas fa-users me-2"></i>
                                    <strong>Presupuesto:</strong> {compararProfesionalesVsPresupuesto.capacidadPresupuesto} prof/día × {compararProfesionalesVsPresupuesto.diasEstimadosOriginales} días |
                                    <strong className="ms-2">Asignado:</strong> {compararProfesionalesVsPresupuesto.profesionalesAsignados.toFixed(1)} prof/día × {compararProfesionalesVsPresupuesto.diasReales} días
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="alert alert-info mb-3">
                          <i className="fas fa-info-circle me-2"></i>
                          <strong>Asignación automática:</strong> Cada profesional trabajará <strong>1 jornal/día</strong> durante todos los {diasHabilesObjetivo} días hábiles de la obra.
                        </div>

                        <div className={`alert mb-0 ${
                          profesionalesMostrar.length === capacidadNecesaria
                            ? 'alert-success'
                            : profesionalesMostrar.length > capacidadNecesaria
                              ? 'alert-info'
                              : 'alert-warning'
                        }`}>
                          <strong>📊 Resumen de asignación:</strong>
                          <ul className="mb-0 mt-2">
                            <li><strong>{profesionalesMostrar.length} profesional(es)</strong> seleccionados</li>
                            <li><strong>{profesionalesMostrar.length} jornal(es)/día</strong> de capacidad</li>
                            <li><strong>{profesionalesMostrar.length * diasHabilesObjetivo} jornales totales</strong> ({profesionalesMostrar.length} × {diasHabilesObjetivo} días)</li>
                          </ul>
                          <hr className="my-2" />
                          <small>
                            {profesionalesMostrar.length === capacidadNecesaria
                              ? `✅ Perfecto: ${profesionalesMostrar.length} asignados = ${capacidadNecesaria} necesarios`
                              : profesionalesMostrar.length > capacidadNecesaria
                                ? `🚀 Sobran ${profesionalesMostrar.length - capacidadNecesaria} profesional(es) → Terminarás antes de tiempo`
                                : `⚠️ Faltan ${capacidadNecesaria - profesionalesMostrar.length} profesional(es) más (necesitas ${capacidadNecesaria} en total)`}
                          </small>
                        </div>
                      </>
                    ) : (
                      <div className="text-center text-muted py-3">
                        <i className="fas fa-user-plus fa-2x mb-2"></i>
                        <p className="mb-0">No hay profesionales asignados a esta obra</p>
                        <small>Haz clic en "Seleccionar Profesionales" para comenzar</small>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              );
            })()}

            {modalidadAsignacion === 'semanal' && (
              <div>
                {/* Distribución semanal con tarjetas clickeables */}
                <div className="card mb-3 border-info">
                  <div className="card-header bg-info text-white">
                    <h6 className="mb-0">
                      <i className="fas fa-calendar-week me-2"></i>
                      Distribución Semanal de Profesionales
                    </h6>
                  </div>
                  <div className="card-body">
                    {semanas.length === 0 ? (
                      <div className="alert alert-warning">
                        <h6 className="alert-heading">
                          <i className="fas fa-exclamation-triangle me-2"></i>
                          No se pueden generar las semanas
                        </h6>
                        <p className="mb-2">
                          Para poder asignar profesionales por semana, necesitas configurar primero:
                        </p>
                        <ul>
                          <li>La <strong>fecha de inicio</strong> de la obra</li>
                          <li>El número de <strong>semanas objetivo</strong> para completar la obra</li>
                        </ul>
                        <hr />
                        <div className="d-flex gap-2">
                          <button
                            className="btn btn-primary"
                            onClick={() => setPaso(1)}
                          >
                            <i className="fas fa-cog me-2"></i>
                            Configurar obra
                          </button>
                          <button
                            className="btn btn-secondary"
                            onClick={() => setModalidadAsignacion('total')}
                          >
                            <i className="fas fa-people-fill me-2"></i>
                            Cambiar a asignación por obra completa
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="row">
                        {semanas.map((semana) => {
                        // Obtener asignaciones nuevas del estado local
                        const asignacionSemana = asignacionesPorSemana[semana.key];
                        const profesionalesNuevos = asignacionSemana?.profesionales || [];

                        // Obtener asignaciones existentes para esta semana del proyecto
                        const profesionalesExistentes = [];

                        // Procesar asignaciones existentes y mapearlas a semanas del proyecto
                        asignacionesExistentes.forEach(asignacion => {
                          if (asignacion.asignacionesPorSemana && Array.isArray(asignacion.asignacionesPorSemana)) {
                            asignacion.asignacionesPorSemana.forEach(asignacionSemanaData => {
                              if (asignacionSemanaData.detallesPorDia && Array.isArray(asignacionSemanaData.detallesPorDia)) {
                                asignacionSemanaData.detallesPorDia.forEach(detalle => {
                                  if (detalle.profesionalId && detalle.cantidad > 0 && detalle.fecha) {
                                    // Verificar si la fecha del detalle está en esta semana del proyecto
                                    const fechaDetalle = new Date(detalle.fecha);
                                    const estaEnEstaSemana = semana.dias.some(diaSemana => {
                                      const diaSemanaFormat = new Date(diaSemana);
                                      return fechaDetalle.toDateString() === diaSemanaFormat.toDateString();
                                    });

                                    if (estaEnEstaSemana) {
                                      // Buscar info del profesional
                                      const profesionalInfo = profesionalesDisponibles.find(p => p.id === detalle.profesionalId);
                                      const profesionalExistente = {
                                        id: detalle.profesionalId,
                                        nombre: profesionalInfo?.nombre || `Profesional ${detalle.profesionalId}`,
                                        tipoProfesional: profesionalInfo?.tipoProfesional || 'Trabajador',
                                        cantidad: detalle.cantidad,
                                        fecha: detalle.fecha
                                      };

                                      // Evitar duplicados
                                      const yaExiste = profesionalesExistentes.some(p => p.id === detalle.profesionalId);
                                      if (!yaExiste) {
                                        profesionalesExistentes.push(profesionalExistente);
                                      }
                                    }
                                  }
                                });
                              }
                            });
                          }
                        });

                        // Combinar profesionales existentes y nuevos
                        const profesionalesAsignados = [...profesionalesExistentes, ...profesionalesNuevos];
                        const jornalesPorSemana = semana.dias.length * (capacidadNecesaria || 0);
                        const porcentajeSemana = (100 / semanas.length).toFixed(1);

                        return (
                          <div key={semana.key} className="col-md-6 col-lg-4 mb-3">
                            <div
                              className="border rounded p-3 bg-light hover-card position-relative"
                              style={{ cursor: 'pointer', transition: 'all 0.2s', minHeight: '140px' }}
                              onClick={() => handleAbrirSeleccionProfesionalesSemana(semana.key)}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#e3f2fd';
                                e.currentTarget.style.borderColor = '#2196f3';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#f8f9fa';
                                e.currentTarget.style.borderColor = '#dee2e6';
                              }}
                            >
                              {/* Botón de eliminar en la esquina superior derecha */}
                              {profesionalesAsignados.length > 0 && (
                                <button
                                  className="btn btn-sm btn-danger position-absolute"
                                  style={{ top: '8px', right: '8px', padding: '2px 6px', fontSize: '0.7rem', zIndex: 10 }}
                                  onClick={(e) => handleEliminarAsignacionesSemana(semana.key, e)}
                                  title="Eliminar asignaciones de esta semana"
                                >
                                  <i className="fas fa-trash"></i>
                                </button>
                              )}

                              <div className="d-flex justify-content-between align-items-start mb-2">
                                <strong className="text-primary">Semana {semana.numeroSemana}</strong>
                                <div className="d-flex align-items-center gap-1" style={{ marginRight: profesionalesAsignados.length > 0 ? '30px' : '0' }}>
                                  <small className="text-muted">{porcentajeSemana}%</small>
                                  <i className="fas fa-calendar-day text-primary" style={{ fontSize: '0.8rem' }}></i>
                                </div>
                              </div>

                              <small className="text-muted d-block mb-1">
                                {semana.fechaInicio?.toLocaleDateString('es-AR')}
                                {' al '}
                                {semana.fechaFin?.toLocaleDateString('es-AR')}
                              </small>

                              <small className="text-muted d-block mb-2">
                                <i className="fas fa-calendar-check me-1"></i>
                                {semana.diasHabiles} día{semana.diasHabiles !== 1 ? 's' : ''} hábil{semana.diasHabiles !== 1 ? 'es' : ''}
                              </small>

                              {profesionalesAsignados.length > 0 ? (
                                <>
                                  <small className="text-success d-block">
                                    <i className="fas fa-users me-1"></i>
                                    {profesionalesAsignados.length} profesional{profesionalesAsignados.length !== 1 ? 'es' : ''} asignado{profesionalesAsignados.length !== 1 ? 's' : ''}
                                  </small>
                                  <small className="text-info d-block mt-1">
                                    <i className="fas fa-edit me-1"></i>
                                    Clic para modificar
                                  </small>
                                </>
                              ) : (
                                <small className="text-warning d-block">
                                  <i className="fas fa-user-plus me-1"></i>
                                  Clic para asignar profesionales
                                </small>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    )}

                    {renderTablaProfesionalesAsignados()}
                  </div>
                </div>

                {/* Lista de asignaciones actuales */}
                {Object.keys(asignacionesPorSemana).length > 0 && totalJornalesAsignados > 0 && (
                  <div className="card">
                    <div className="card-header">
                      <h6 className="mb-0">
                        <i className="fas fa-list me-2"></i>
                        Resumen de Asignaciones ({Object.keys(asignacionesPorSemana).length} semanas)
                      </h6>
                    </div>
                    <div className="card-body">
                      <div className="alert alert-success mb-0">
                        <strong>Total de jornales asignados:</strong> {totalJornalesAsignados}
                        <br />
                        <small>
                          {totalJornalesAsignados >= jornalesTotales
                            ? '✅ Suficiente para completar la obra'
                            : `⚠️ Faltan ${jornalesTotales - totalJornalesAsignados} jornales`}
                        </small>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tabla de Profesionales Confirmados */}
                {asignacionesExistentes && asignacionesExistentes.length > 0 && (
                  <div className="card mt-3 border-success">
                    <div className="card-header bg-success text-white">
                      <h6 className="mb-0">
                        <i className="fas fa-user-check me-2"></i>
                        Profesionales Asignados ({asignacionesExistentes.length})
                      </h6>
                    </div>
                    <div className="card-body p-0">
                      <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        <table className="table table-sm table-hover mb-0">
                          <thead className="table-light sticky-top">
                            <tr>
                              <th>Profesional</th>
                              <th>Tipo</th>
                              <th>Semana</th>
                              <th>Jornales</th>
                            </tr>
                          </thead>
                          <tbody>
                            {asignacionesExistentes.map((asig, idx) => (
                              <tr key={idx}>
                                <td>{asig.nombre || asig.profesionalNombre || 'Sin nombre'}</td>
                                <td>
                                  <span className="badge bg-secondary" style={{fontSize: '0.7rem'}}>
                                    {asig.tipoProfesional || 'N/A'}
                                  </span>
                                </td>
                                <td>Semana {asig.numeroSemana || asig.semana || '-'}</td>
                                <td className="text-end">
                                  <strong>{asig.jornales || asig.cantidadJornales || 1}</strong>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )} {/* Fin paso 3 */}

        {/* Sección de Asignación Diaria - Asignar por día o fracción de día */}
        {(onAbrirRegistrarJornales || onAbrirHistorialJornales) && (
          <div style={{ borderTop: '2px solid #e9ecef', marginTop: '20px', paddingTop: '20px' }}>
            <h6 className="text-muted mb-3">
              <i className="fas fa-calendar-day me-2"></i>
              Asignación por Día / Fracción de Día
            </h6>
            <div className="alert alert-info mb-3" style={{ fontSize: '0.9em' }}>
              <strong>Nueva opción:</strong> Asignar profesionales por día o fracciones (0.25, 0.5, 0.75, 1.0 día)
            </div>
            <div className="row">
              {onAbrirRegistrarJornales && (
                <div className="col-md-6 mb-2">
                  <button
                    className="btn btn-outline-success w-100"
                    onClick={() => {
                      if (onAbrirRegistrarJornales) {
                        onHide(); // Cerrar este modal
                        onAbrirRegistrarJornales(); // Abrir modal de asignación diaria
                      }
                    }}
                    title="Asignar profesionales con jornadas por día o fracciones (0.25, 0.5, 0.75, 1.0)"
                  >
                    <i className="fas fa-user-plus me-2"></i>
                    Asignación Individualizada
                  </button>
                </div>
              )}
              {onAbrirHistorialJornales && (
                <div className="col-md-6 mb-2">
                  <button
                    className="btn btn-outline-info w-100"
                    onClick={() => {
                      if (onAbrirHistorialJornales) {
                        onHide(); // Cerrar este modal
                        onAbrirHistorialJornales(); // Abrir modal de historial
                      }
                    }}
                    title="Ver el historial completo de asignaciones diarias"
                  >
                    <i className="fas fa-history me-2"></i>
                    Ver Historial Diario
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        </div> {/* Cierra modal-body */}

          <div className="modal-footer" style={{ position: 'sticky', bottom: 0, backgroundColor: 'white', zIndex: 10, borderTop: '1px solid #dee2e6' }}>
            <button type="button" className="btn btn-secondary" onClick={onHide} disabled={cargando}>
              Cancelar
            </button>

            {/* Botón para REEMPLAZAR (elimina existentes y guarda nuevos) */}
            <button
              type="button"
              className="btn btn-warning"
              onClick={() => {
                if (confirm('⚠️ ¿Estás seguro de REEMPLAZAR todas las asignaciones existentes?\n\nEsto ELIMINARÁ todos los profesionales ya asignados y guardará SOLO los nuevos.\n\nSi quieres AGREGAR sin eliminar, usa el botón verde.')) {
                  handleAsignar(true);
                }
              }}
              disabled={cargando}
              title="Elimina todas las asignaciones actuales y guarda solo los nuevos profesionales seleccionados"
            >
              {cargando ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Reemplazando...
                </>
              ) : (
                <>
                  <i className="fas fa-sync-alt me-2"></i>
                  Reemplazar Todos
                </>
              )}
            </button>

            {/* Botón para AGREGAR (conserva existentes y agrega nuevos) */}
            <button
              type="button"
              className="btn btn-success"
              onClick={() => handleAsignar(false)}
              disabled={cargando}
              title="Agrega los nuevos profesionales sin eliminar los ya asignados"
            >
              {cargando ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Guardando...
                </>
              ) : (
                <>
                  <i className="fas fa-plus-circle me-2"></i>
                  Agregar Profesionales
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* Modal secundario para seleccionar profesionales */}
    <SeleccionarProfesionalesModal
      show={mostrarModalSeleccion}
      onHide={handleHideModalSeleccion}
      empresaId={empresaSeleccionada?.id}
      profesionalesDisponibles={profesionalesDisponibles}
      profesionalesSeleccionados={profesionalesSeleccionados}
      onConfirmar={handleConfirmarProfesionales}
      asignacionesExistentes={asignacionesExistentes}
      semanaActual={semanaActualTotal}
      fechaInicio={fechaInicioTotal}
      fechaFin={fechaFinTotal}
    />

    {/* Nuevo Modal para gestión detallada por día en la semana */}
    <DetalleSemanaModal
      show={mostrarDetalleSemana}
      onHide={() => setMostrarDetalleSemana(false)}
      semana={semanaSeleccionadaParaAsignar ? semanas.find(s => s.key === semanaSeleccionadaParaAsignar) : null}
      asignacionesLocalesSemana={
          semanaSeleccionadaParaAsignar && asignacionesPorSemana[semanaSeleccionadaParaAsignar]?.asignacionesDia
          ? asignacionesPorSemana[semanaSeleccionadaParaAsignar].asignacionesDia
          : {}
      }
      asignacionesGlobales={asignacionesExistentes}
      profesionalesDisponibles={profesionalesDisponibles}
      empresaId={empresaSeleccionada?.id}
      onGuardar={handleGuardarSemana}
    />
  </>
  );
};

export default React.memo(AsignarProfesionalSemanalModal, (prevProps, nextProps) => {
  // Solo re-renderizar si show u obra.id cambian
  return prevProps.show === nextProps.show &&
         prevProps.obra?.id === nextProps.obra?.id;
});
