import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { useEmpresa } from '../EmpresaContext';
import { useFinancialData } from '../context/FinancialDataContext';
import { useEstadisticasConsolidadas } from '../hooks/useEstadisticasConsolidadas';
import { useEstadisticasObrasSeleccionadas } from '../hooks/useEstadisticasObrasSeleccionadas';
import RegistrarNuevoCobroModal from '../components/RegistrarNuevoCobroModal';
import AsignarCobroDisponibleModal from '../components/AsignarCobroDisponibleModal';
import ListarCobrosObraModal from '../components/ListarCobrosObraModal';
import ListarRetirosModal from '../components/ListarRetirosModal';
import RegistrarRetiroModal from '../components/RegistrarRetiroModal';
import RegistrarPagoProfesionalModal from '../components/RegistrarPagoProfesionalModal';
import ListarPagosProfesionalModal from '../components/ListarPagosProfesionalModal';
import GestionPagosProfesionalesModal from '../components/GestionPagosProfesionalesModal';
import GestionPagosMaterialesModal from '../components/GestionPagosMaterialesModal';
import GestionPagosGastosGeneralesModal from '../components/GestionPagosGastosGeneralesModal';
import ResumenFinancieroObraModal from '../components/ResumenFinancieroObraModal';
import RegistrarPagoConsolidadoModal from '../components/RegistrarPagoConsolidadoModal';
import DarAdelantoModal from '../components/DarAdelantoModal';
import PagoCuentaModal from '../components/PagoCuentaModal';
import SistemaFinancieroConsolidadoModal from '../components/SistemaFinancieroConsolidadoModal';
import DetalleConsolidadoPorObraModal from '../components/DetalleConsolidadoPorObraModal';
import DetalleDistribucionCobrosModal from '../components/DetalleDistribucionCobrosModal';
import NotificationToast from '../components/NotificationToast';
import apiService from '../services/api';
import { getTipoProfesionalBadgeClass, ordenarPorRubro } from '../utils/badgeColors';
import { obtenerDistribucionPorObra } from '../services/cobrosEmpresaService';
import { listarEntidadesFinancieras, obtenerEstadisticasMultiples } from '../services/entidadesFinancierasService';
import * as trabajosAdicionalesService from '../services/trabajosAdicionalesService';
import eventBus, { FINANCIAL_EVENTS } from '../utils/eventBus';
import { calcularTotalConDescuentosDesdeItems } from '../utils/presupuestoDescuentosUtils';

const STORAGE_KEY = 'sistemaFinanciero_obraSeleccionada';

// Función para formatear moneda
const formatearMoneda = (valor) => {
  if (valor === null || valor === undefined || isNaN(valor)) return '$0,00';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(valor);
};

/**
 * Función helper para obtener el total correcto de un presupuesto
 * Prioriza totalConDescuentos si existe, sino lo calcula, sino usa totalPresupuestoConHonorarios
 */
const obtenerTotalPresupuesto = (presupuesto) => {
  // Si ya tiene totalConDescuentos calculado, usarlo
  if (presupuesto.totalConDescuentos != null && presupuesto.totalConDescuentos > 0) {
    return presupuesto.totalConDescuentos;
  }

  // Si tiene items y configuración de descuentos, calcular
  if (presupuesto.itemsCalculadora && Array.isArray(presupuesto.itemsCalculadora) && presupuesto.itemsCalculadora.length > 0) {
    try {
      const resultado = calcularTotalConDescuentosDesdeItems(presupuesto.itemsCalculadora, presupuesto);
      if (resultado.totalFinal > 0) {
        return resultado.totalFinal;
      }
    } catch (error) {
      console.warn(`⚠️ Error calculando descuentos para ${presupuesto.nombreObra}:`, error);
    }
  }

  // ✅ Priorizar importeTotal (valor con descuentos desde BD), luego otros campos
  return presupuesto.importeTotal || presupuesto.totalFinal || presupuesto.totalPresupuestoConHonorarios || presupuesto.montoTotal || 0;
};

/**
 * Página para probar el Sistema Financiero de Obras
 * Acceso rápido a todas las tarjetas de cobros y pagos
 */
const SistemaFinancieroPage = ({ setSidebarCollapsed: setSidebarCollapsedProp, sidebarCollapsed: sidebarCollapsedProp }) => {
  const { empresaSeleccionada } = useEmpresa();

  // 🏦 CONTEXTO FINANCIERO CENTRALIZADO
  const {
    obraActual,
    datosFinancieros,
    loading: loadingFinancial,
    error: errorFinancial,
    cargarDatosObra,
    recargarDatos,
    limpiarDatos,
    getEstadisticas
  } = useFinancialData();

  // Usar estadísticas del contexto con valores por defecto seguros - MEMOIZADO
  const estadisticas = useMemo(() => {
    return getEstadisticas() || {
      totalPresupuesto: 0,
      totalCobrado: 0,
      totalPagado: 0,
      saldoDisponible: 0,
      porcentajeCobrado: 0,
      porcentajePagado: 0,
      porcentajeDisponible: 0,
      alertas: []
    };
  }, [getEstadisticas]);
  const loadingEstadisticas = loadingFinancial;
  const errorEstadisticas = errorFinancial;

  // 🆕 Modo consolidado - siempre activo para mostrar selector de obras múltiples
  const modoConsolidado = true;

  // 🆕 Total de cobros asignados a Trabajos Adicionales y Obras Independientes
  const [totalAsignadoTAOI, setTotalAsignadoTAOI] = useState(0);
  // Estado para el bloque colapsable de otras formas de pago
  const [seccionBalanceExpandida, setSeccionBalanceExpandida] = useState(false);

  // Estado para la obra/presupuesto seleccionado - cargar desde sessionStorage
  const [obraSeleccionada, setObraSeleccionada] = useState(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error al cargar obraSeleccionada desde sessionStorage:', error);
      return null;
    }
  });

  // Estado para refrescar datos
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Estado para modal de resumen consolidado
  const [showResumenConsolidado, setShowResumenConsolidado] = useState(false);
  const [resumenConsolidado, setResumenConsolidado] = useState({
    profesionales: [],
    materiales: [],
    otrosCostos: [],
    totalProfesionales: 0,
    totalMateriales: 0,
    totalOtrosCostos: 0,
    totalGeneral: 0
  });

  // Estado para modal de lista de presupuestos
  const [showListaPresupuestos, setShowListaPresupuestos] = useState(false);
  const [loadingPresupuestos, setLoadingPresupuestos] = useState(false);

  // Estado general de la vista consolidada y feedback
  const [notification, setNotification] = useState(null);
  const [loadingObras, setLoadingObras] = useState(false);
  const [presupuestosAprobados, setPresupuestosAprobados] = useState([]);
  const [obrasDisponibles, setObrasDisponibles] = useState([]);
  const [obrasSeleccionadas, setObrasSeleccionadas] = useState(new Set());
  const [trabajosExtraSeleccionados, setTrabajosExtraSeleccionados] = useState(new Set());
  const [trabajosAdicionalesDisponibles, setTrabajosAdicionalesDisponibles] = useState([]);
  const [trabajosAdicionalesSeleccionados, setTrabajosAdicionalesSeleccionados] = useState(new Set());

  // Estados de modales y paneles
  const [showRegistrarNuevoCobro, setShowRegistrarNuevoCobro] = useState(false);
  const [showAsignarCobroDisponible, setShowAsignarCobroDisponible] = useState(false);
  const [showListarCobros, setShowListarCobros] = useState(false);
  const [showRegistrarPago, setShowRegistrarPago] = useState(false);
  const [showRegistrarPagoConsolidado, setShowRegistrarPagoConsolidado] = useState(false);
  const [showDarAdelanto, setShowDarAdelanto] = useState(false);
  const [showPagoCuenta, setShowPagoCuenta] = useState(false);
  const [showGestionPagosProfesionales, setShowGestionPagosProfesionales] = useState(false);
  const [showGestionPagosMateriales, setShowGestionPagosMateriales] = useState(false);
  const [showGestionPagosGastosGenerales, setShowGestionPagosGastosGenerales] = useState(false);
  const [showListarPagos, setShowListarPagos] = useState(false);
  const [showResumenFinanciero, setShowResumenFinanciero] = useState(false);
  const [showConsolidarPagosGeneral, setShowConsolidarPagosGeneral] = useState(false);
  const [showRegistrarRetiro, setShowRegistrarRetiro] = useState(false);
  const [showListarRetiros, setShowListarRetiros] = useState(false);
  const [showDesglose, setShowDesglose] = useState(false);
  const [desgloseTipo, setDesgloseTipo] = useState('');
  const [desgloseTitulo, setDesgloseTitulo] = useState('');
  const [showDistribucionCobros, setShowDistribucionCobros] = useState(false);

  // Estados auxiliares de UI
  const [seccionCobrosExpandida, setSeccionCobrosExpandida] = useState(true);
  const [seccionPagosExpandida, setSeccionPagosExpandida] = useState(true);
  const [accionesPagosExpandida, setAccionesPagosExpandida] = useState(false);
  const [seccionRetirosExpandida, setSeccionRetirosExpandida] = useState(true);
  const [gruposColapsadosSF, setGruposColapsadosSF] = useState({});
  const [profesionalParaAdelanto, setProfesionalParaAdelanto] = useState(null);
  const [presupuestoParaPagoCuenta, setPresupuestoParaPagoCuenta] = useState(null);

  // Estadísticas financieras consolidadas (todas las obras activas de la empresa)
  const {
    estadisticas: estadisticasConsolidadas,
    loading: loadingConsolidadas,
    error: errorConsolidadas
  } = useEstadisticasConsolidadas(
    empresaSeleccionada?.id,
    refreshTrigger,
    modoConsolidado
  );

  useEffect(() => {
    const cargarTotalTAOI = async () => {
      if (!empresaSeleccionada?.id) return;

      try {
        const todasEF = await listarEntidadesFinancieras(empresaSeleccionada.id, true);
        const efSinDist = (todasEF || []).filter(
          ef => ef.tipoEntidad === 'TRABAJO_ADICIONAL' || ef.tipoEntidad === 'OBRA_INDEPENDIENTE'
        );

        if (efSinDist.length === 0) {
          setTotalAsignadoTAOI(0);
          return;
        }

        const estadisticasEF = await obtenerEstadisticasMultiples(
          empresaSeleccionada.id,
          efSinDist.map(ef => ef.id)
        );

        const total = (estadisticasEF || []).reduce(
          (sum, entidad) => sum + parseFloat(entidad.totalCobrado || 0),
          0
        );
        setTotalAsignadoTAOI(total);
      } catch (err) {
        console.warn('⚠️ [SistemaFinanciero] Error cargando total TA/OI:', err.message);
        setTotalAsignadoTAOI(0);
      }
    };

    cargarTotalTAOI();
  }, [empresaSeleccionada?.id, refreshTrigger]);

  const presupuestosSeleccionadosArray = useMemo(() => {
    const array = [];

    // 🔧 Recorrer TODAS las obras (no solo las seleccionadas) para capturar adicionales/tareas leves
    obrasDisponibles.forEach(obra => {
      // ✅ Agregar obra principal SOLO si está seleccionada
      const obraPrincipalSeleccionada = obrasSeleccionadas.has(obra.id);

      if (obraPrincipalSeleccionada) {
        if (obra.presupuestoCompleto) {
          array.push(obra.presupuestoCompleto);
        } else if (obra.esObraIndependiente) {
          const importeOI = obra.totalPresupuesto || obra.presupuestoEstimado || 0;
          array.push({
            id: obra.id,
            obraId: obra.id,
            nombreObra: obra.nombreObra || obra.direccion || `Obra ${obra.id}`,
            direccionObraCalle: obra.direccion || '',
            direccionObraAltura: '',
            estado: obra.estado || 'APROBADO',
            totalFinal: importeOI, // 🔧 Prioridad 1 para calcularTotalPresupuestoObra
            totalPresupuesto: importeOI,
            esObraIndependiente: true,
            itemsCalculadora: [],
            profesionalesObra: [],
            materialesAsignados: [],
            gastosGeneralesAsignados: []
          });
        }
      }

      // ✅ Agregar trabajos extra (adicionales de obra) si están seleccionados (independiente de la obra principal)
      if (obra.trabajosExtra && Array.isArray(obra.trabajosExtra)) {
        obra.trabajosExtra.forEach((te, idx) => {
          const estaSeleccionado = trabajosExtraSeleccionados.has(te.id);
          if (!estaSeleccionado) return;

          if (te.presupuestoCompleto) {
            // 🔧 Para trabajos extra, usar totalConDescuentos si está disponible (es el valor real mostrado en UI)
            const presupuestoConTotal = {
              ...te.presupuestoCompleto,
              totalFinal: te.presupuestoCompleto.totalConDescuentos || te.presupuestoCompleto.totalFinal || te.totalCalculado || 0
            };
            array.push(presupuestoConTotal);
            return;
          }

          const importeTE = te.totalCalculado || te.presupuestoEstimado || te.total || 0;
          array.push({
            id: te.id,
            obraId: te.obraId,
            direccionObraId: te.obraId,
            nombreObra: te.nombre || te.descripcion || te.nombreObra || `Trabajo Extra ${te.id}`,
            direccionObraCalle: obra.direccionObraCalle || obra.direccion || '',
            direccionObraAltura: obra.direccionObraAltura || '',
            estado: te.estado || 'APROBADO',
            totalFinal: importeTE, // 🔧 Usar totalCalculado (incluye descuentos/ajustes)
            totalPresupuesto: importeTE,
            esTrabajoExtra: true,
            obraPrincipalId: obra.id,
            itemsCalculadora: [],
            profesionalesObra: [],
            materialesAsignados: [],
            gastosGeneralesAsignados: []
          });
        });
      }

      // 🆕 Agregar tareas leves si están seleccionadas (independiente de la obra principal)
      if (!obraPrincipalSeleccionada) {
        const esTareaLeve = obra.presupuestoCompleto?.tipoPresupuesto === 'TAREA_LEVE' ||
          obra.presupuestoCompleto?.tipo_presupuesto === 'TAREA_LEVE' ||
          obra.presupuestoCompleto?.tipo_origen === 'TAREA_LEVE' ||
          obra.presupuestoCompleto?.tipoOrigen === 'TAREA_LEVE' ||
          obra.tipo_origen === 'TAREA_LEVE' ||
          obra.tipoOrigen === 'TAREA_LEVE';

        if (esTareaLeve && obrasSeleccionadas.has(obra.id)) {
          if (obra.presupuestoCompleto) {
            array.push(obra.presupuestoCompleto);
          } else {
            const importeTL = obra.totalPresupuesto || obra.presupuestoEstimado || 0;
            array.push({
              id: obra.id,
              obraId: obra.id,
              nombreObra: obra.nombreObra || obra.direccion || `Tarea Leve ${obra.id}`,
              direccionObraCalle: obra.direccionObraCalle || obra.direccion || '',
              direccionObraAltura: obra.direccionObraAltura || '',
              estado: obra.estado || 'APROBADO',
              totalFinal: importeTL, // 🔧 Prioridad 1 para calcularTotalPresupuestoObra
              totalPresupuesto: importeTL,
              esTareaLeve: true,
              itemsCalculadora: [],
              profesionalesObra: [],
              materialesAsignados: [],
              gastosGeneralesAsignados: []
            });
          }
        }
      }
    });

    // ✅ Agregar trabajos adicionales seleccionados independientemente
    trabajosAdicionalesDisponibles.forEach(ta => {
      const estaSeleccionado = trabajosAdicionalesSeleccionados.has(ta.id);
      if (!estaSeleccionado) return;

      const importeTA = ta.importe || 0;
      array.push({
        id: ta.id,
        obraId: ta.obraOrigenId || ta.obra_origen_id || ta.obraPadreId,
        nombreObra: ta.nombre || ta.descripcion || `Trabajo Adicional ${ta.id}`,
        direccionObraCalle: ta.direccionObraCalle || '',
        direccionObraAltura: ta.direccionObraAltura || '',
        estado: ta.estado || 'APROBADO',
        totalFinal: importeTA, // 🔧 Prioridad 1 para calcularTotalPresupuestoObra
        totalPresupuesto: importeTA,
        esTrabajoAdicional: true,
        itemsCalculadora: [],
        profesionalesObra: [],
        materialesAsignados: [],
        gastosGeneralesAsignados: []
      });
    });

    return array;
  }, [obrasDisponibles, obrasSeleccionadas, trabajosExtraSeleccionados, trabajosAdicionalesDisponibles, trabajosAdicionalesSeleccionados]);

  const {
    profesionales: profesionalesSeleccionados,
    materiales: materialesSeleccionados,
    otrosCostos: otrosCostosSeleccionados,
    estadisticas: estadisticasSeleccionadas,
    loading: loadingSeleccionadas,
    error: errorSeleccionadas,
    refetch: refetchSeleccionadas
  } = useEstadisticasObrasSeleccionadas(
    presupuestosSeleccionadosArray,
    empresaSeleccionada?.id,
    refreshTrigger
  );

  // Estado para el modal de resumen consolidado (usando componente SistemaFinancieroConsolidadoModal)

  // 🎯 Contraer sidebar al montar esta página y restaurar al desmontar
  useLayoutEffect(() => {
    if (!setSidebarCollapsedProp) return; // Verificar que la prop existe

    // Guardar el estado actual del sidebar
    const sidebarEstadoAnterior = sidebarCollapsedProp;

    // Siempre contraer sidebar al montar (forzar contracción)
    setSidebarCollapsedProp(true);

    // Restaurar estado original al desmontar
    return () => {
      setSidebarCollapsedProp(sidebarEstadoAnterior);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 🔄 Cargar datos cuando se selecciona una obra
  useEffect(() => {
    if (obraSeleccionada && empresaSeleccionada) {
      cargarDatosObra(obraSeleccionada);
    } else if (!obraSeleccionada) {
      limpiarDatos();
    }
  }, [obraSeleccionada, empresaSeleccionada, cargarDatosObra, limpiarDatos]);

  // Función para cargar resumen consolidado de todos los presupuestos APROBADOS y EN_EJECUCION
  const cargarResumenConsolidado_DEPRECATED = async () => {
    try {
      // Cargar presupuestos APROBADOS y EN_EJECUCION
      const [responseAprobado, responseEnEjecucion] = await Promise.all([
        apiService.presupuestosNoCliente.busquedaAvanzada(
          { estado: 'APROBADO' },
          empresaSeleccionada.id
        ),
        apiService.presupuestosNoCliente.busquedaAvanzada(
          { estado: 'EN_EJECUCION' },
          empresaSeleccionada.id
        )
      ]);

      // Extraer arrays
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

      if (todosPresupuestos.length === 0) {
        console.warn('⚠️ No hay presupuestos APROBADOS o EN_EJECUCION');
        setResumenConsolidado({
          profesionales: [],
          materiales: [],
          otrosCostos: [],
          totalProfesionales: 0,
          totalMateriales: 0,
          totalOtrosCostos: 0,
          totalGeneral: 0
        });
        setShowResumenConsolidado(true);
        return;
      }

      // CARGAR PRESUPUESTOS COMPLETOS con todos los detalles
      const presupuestosCompletos = await Promise.all(
        todosPresupuestos.map(p =>
          apiService.presupuestosNoCliente.getById(p.id, empresaSeleccionada.id)
        )
      );

      // Calcular el TOTAL GENERAL de todos los presupuestos (CON HONORARIOS Y MAYORES COSTOS)
      const totalGeneral = presupuestosCompletos.reduce((sum, p) => {
        const total = p.totalPresupuestoConHonorarios ||
                     (p.totalPresupuesto + (p.totalHonorariosCalculado || 0)) ||
                     0;
        return sum + total;
      }, 0);

      // Mapas para consolidar por nombre (desglose por tipo)
      const profesionalesMap = new Map();
      const materialesMap = new Map();
      const otrosCostosMap = new Map();

      // Procesar cada presupuesto COMPLETO para el desglose
      presupuestosCompletos.forEach(presupuesto => {
        // CALCULAR FACTOR MULTIPLICADOR para este presupuesto
        // Este factor incluye honorarios + mayores costos
        let totalBaseProfesionales = 0;
        let totalBaseMateriales = 0;
        let totalBaseOtros = 0;

        // Sumar base de profesionales del presupuesto
        if (presupuesto.profesionales && Array.isArray(presupuesto.profesionales)) {
          presupuesto.profesionales.forEach(prof => {
            totalBaseProfesionales += prof.subtotal || prof.importeCalculado || 0;
          });
        }

        // Sumar base de profesionales de itemsCalculadora
        if (presupuesto.itemsCalculadora && Array.isArray(presupuesto.itemsCalculadora)) {
          presupuesto.itemsCalculadora.forEach(item => {
            if (item.profesionales && Array.isArray(item.profesionales)) {
              item.profesionales.forEach(prof => {
                totalBaseProfesionales += prof.subtotal || prof.importeCalculado || 0;
              });
            }
          });
        }

        // Sumar base de materiales del presupuesto
        if (presupuesto.materiales && Array.isArray(presupuesto.materiales)) {
          presupuesto.materiales.forEach(mat => {
            totalBaseMateriales += mat.subtotal || ((mat.cantidad || 0) * (mat.precioUnitario || 0));
          });
        }

        // Sumar base de materiales de itemsCalculadora
        if (presupuesto.itemsCalculadora && Array.isArray(presupuesto.itemsCalculadora)) {
          presupuesto.itemsCalculadora.forEach(item => {
            if (item.materialesLista && Array.isArray(item.materialesLista)) {
              item.materialesLista.forEach(mat => {
                totalBaseMateriales += mat.subtotal || ((mat.cantidad || 0) * (mat.precioUnitario || 0));
              });
            }
          });
        }

        // Sumar otros costos
        if (presupuesto.otrosCostos && Array.isArray(presupuesto.otrosCostos)) {
          presupuesto.otrosCostos.forEach(costo => {
            totalBaseOtros += costo.importe || 0;
          });
        }

        const totalBasePresupuesto = totalBaseProfesionales + totalBaseMateriales + totalBaseOtros;
        const totalConHonorarios = parseFloat(presupuesto.totalPresupuestoConHonorarios || presupuesto.totalPresupuesto || 0);

        // Factor multiplicador = total con honorarios / total base
        // Este factor incluye: 1.0 (base) + % honorarios + % mayores costos
        const factorMultiplicador = totalBasePresupuesto > 0 ? totalConHonorarios / totalBasePresupuesto : 1;

        // Profesionales del presupuesto
        if (presupuesto.profesionales && Array.isArray(presupuesto.profesionales)) {
          presupuesto.profesionales.forEach(prof => {
            const key = `${prof.tipoProfesional}_${prof.nombreProfesional}`;
            const importeBase = prof.subtotal || prof.importeCalculado || 0;
            const importeConHonorarios = importeBase * factorMultiplicador; // APLICAR FACTOR
            if (profesionalesMap.has(key)) {
              const existing = profesionalesMap.get(key);
              existing.importe += importeConHonorarios;
              existing.obras.push(presupuesto.nombreObra || `Presupuesto #${presupuesto.numeroPresupuesto}`);
            } else {
              profesionalesMap.set(key, {
                tipoProfesional: prof.tipoProfesional,
                nombreProfesional: prof.nombreProfesional,
                importe: importeConHonorarios,
                obras: [presupuesto.nombreObra || `Presupuesto #${presupuesto.numeroPresupuesto}`]
              });
            }
          });
        }

        // Profesionales de itemsCalculadora
        if (presupuesto.itemsCalculadora && Array.isArray(presupuesto.itemsCalculadora)) {
          presupuesto.itemsCalculadora.forEach(item => {
            if (item.profesionales && Array.isArray(item.profesionales)) {
              item.profesionales.forEach(prof => {
                const key = `${prof.tipoProfesional}_${prof.nombreProfesional}`;
                const importeBase = prof.subtotal || prof.importeCalculado || 0;
                const importeConHonorarios = importeBase * factorMultiplicador; // APLICAR FACTOR
                if (profesionalesMap.has(key)) {
                  const existing = profesionalesMap.get(key);
                  existing.importe += importeConHonorarios;
                  existing.obras.push(presupuesto.nombreObra || `Presupuesto #${presupuesto.numeroPresupuesto}`);
                } else {
                  profesionalesMap.set(key, {
                    tipoProfesional: prof.tipoProfesional,
                    nombreProfesional: prof.nombreProfesional,
                    importe: importeConHonorarios,
                    obras: [presupuesto.nombreObra || `Presupuesto #${presupuesto.numeroPresupuesto}`]
                  });
                }
              });
            }
          });
        }

        // Materiales del presupuesto
        if (presupuesto.materiales && Array.isArray(presupuesto.materiales)) {
          presupuesto.materiales.forEach(mat => {
            const key = mat.tipoMaterial;
            const importeBase = mat.subtotal || ((mat.cantidad || 0) * (mat.precioUnitario || 0));
            const importeConHonorarios = importeBase * factorMultiplicador; // APLICAR FACTOR
            if (materialesMap.has(key)) {
              const existing = materialesMap.get(key);
              existing.cantidad += mat.cantidad || 0;
              existing.importe += importeConHonorarios;
              existing.obras.push(presupuesto.nombreObra || `Presupuesto #${presupuesto.numeroPresupuesto}`);
            } else {
              materialesMap.set(key, {
                tipoMaterial: mat.tipoMaterial,
                cantidad: mat.cantidad || 0,
                precioUnitario: mat.precioUnitario || 0,
                importe: importeConHonorarios,
                obras: [presupuesto.nombreObra || `Presupuesto #${presupuesto.numeroPresupuesto}`]
              });
            }
          });
        }

        // Materiales de itemsCalculadora
        if (presupuesto.itemsCalculadora && Array.isArray(presupuesto.itemsCalculadora)) {
          presupuesto.itemsCalculadora.forEach(item => {
            if (item.materialesLista && Array.isArray(item.materialesLista)) {
              item.materialesLista.forEach(mat => {
                const key = mat.tipoMaterial;
                const importeBase = mat.subtotal || ((mat.cantidad || 0) * (mat.precioUnitario || 0));
                const importeConHonorarios = importeBase * factorMultiplicador; // APLICAR FACTOR
                if (materialesMap.has(key)) {
                  const existing = materialesMap.get(key);
                  existing.cantidad += mat.cantidad || 0;
                  existing.importe += importeConHonorarios;
                  existing.obras.push(presupuesto.nombreObra || `Presupuesto #${presupuesto.numeroPresupuesto}`);
                } else {
                  materialesMap.set(key, {
                    tipoMaterial: mat.tipoMaterial,
                    cantidad: mat.cantidad || 0,
                    precioUnitario: mat.precioUnitario || 0,
                    importe: importeConHonorarios,
                    obras: [presupuesto.nombreObra || `Presupuesto #${presupuesto.numeroPresupuesto}`]
                  });
                }
              });
            }
          });
        }

        // Otros costos
        if (presupuesto.otrosCostos && Array.isArray(presupuesto.otrosCostos)) {
          presupuesto.otrosCostos.forEach(costo => {
            const key = costo.descripcion || 'Sin descripción';
            const importeBase = costo.importe || 0;
            const importeConHonorarios = importeBase * factorMultiplicador; // APLICAR FACTOR
            if (otrosCostosMap.has(key)) {
              const existing = otrosCostosMap.get(key);
              existing.importe += importeConHonorarios;
              existing.obras.push(presupuesto.nombreObra || `Presupuesto #${presupuesto.numeroPresupuesto}`);
            } else {
              otrosCostosMap.set(key, {
                descripcion: costo.descripcion || 'Sin descripción',
                importe: importeConHonorarios,
                obras: [presupuesto.nombreObra || `Presupuesto #${presupuesto.numeroPresupuesto}`]
              });
            }
          });
        }
      });

      // Convertir Maps a arrays y calcular totales parciales (DESGLOSE)
      const profesionales = Array.from(profesionalesMap.values());
      const materiales = Array.from(materialesMap.values());
      const otrosCostos = Array.from(otrosCostosMap.values());

      const totalProfesionales = profesionales.reduce((sum, p) => sum + p.importe, 0);
      const totalMateriales = materiales.reduce((sum, m) => sum + m.importe, 0);
      const totalOtrosCostos = otrosCostos.reduce((sum, o) => sum + o.importe, 0);

      const totalDesglose = totalProfesionales + totalMateriales + totalOtrosCostos;

      // IMPORTANTE: El totalGeneral YA se calculó arriba usando totalPresupuestoConHonorarios
      // que incluye: base + honorarios + mayores costos
      // Los totales parciales ahora TAMBIÉN incluyen el factor multiplicador aplicado

      setResumenConsolidado({
        profesionales,
        materiales,
        otrosCostos,
        totalProfesionales,
        totalMateriales,
        totalOtrosCostos,
        totalGeneral // <- Este es el total CON HONORARIOS calculado arriba
      });

      setShowResumenConsolidado(true);
    } catch (error) {
      console.error('❌ Error cargando resumen consolidado:', error);
      setNotification({
        type: 'error',
        message: 'Error al cargar resumen consolidado'
      });
      setTimeout(() => setNotification(null), 5000);
    }
  };

  // Calcular días hábiles entre dos fechas (lunes a viernes)
  const calcularDiasHabiles = useCallback((fechaInicio, diasHabiles) => {
    if (!fechaInicio || !diasHabiles) return null;

    let fecha = new Date(fechaInicio);
    let diasContados = 0;

    while (diasContados < diasHabiles) {
      fecha.setDate(fecha.getDate() + 1);
      const diaSemana = fecha.getDay();
      // 0 = Domingo, 6 = Sábado
      if (diaSemana !== 0 && diaSemana !== 6) {
        diasContados++;
      }
    }

    return fecha;
  }, []);

  // Calcular días faltantes entre hoy y una fecha
  const calcularDiasFaltantes = useCallback((fechaObjetivo) => {
    if (!fechaObjetivo) return null;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const objetivo = new Date(fechaObjetivo);
    objetivo.setHours(0, 0, 0, 0);

    const diferencia = objetivo - hoy;
    return Math.ceil(diferencia / (1000 * 60 * 60 * 24));
  }, []);

  // Determinar si debe mostrar alerta de inicio próximo
  const obtenerAlertaInicio = useCallback((presupuesto) => {
    if (presupuesto.estado !== 'APROBADO' || !presupuesto.fechaProbableInicio) return null;

    const diasFaltantes = calcularDiasFaltantes(presupuesto.fechaProbableInicio);

    if (diasFaltantes === null) return null;
    if (diasFaltantes < 0) return { tipo: 'danger', mensaje: '¡Ya debió iniciar!', icono: '🚨', detalle: 'Cambió a EN EJECUCION' };
    if (diasFaltantes === 0) return { tipo: 'danger', mensaje: '¡Inicia HOY!', icono: '🚨', detalle: 'Cambiará a medianoche' };
    if (diasFaltantes <= 3) return { tipo: 'warning', mensaje: `Inicia en ${diasFaltantes} día${diasFaltantes > 1 ? 's' : ''}`, icono: '⚠️', detalle: 'Próximo cambio automático' };
    if (diasFaltantes <= 7) return { tipo: 'info', mensaje: `Inicia en ${diasFaltantes} días`, icono: '📅', detalle: 'Próximo a iniciar' };

    return null;
  }, [calcularDiasFaltantes]);

  // Determinar si debe mostrar alerta de finalización próxima
  const obtenerAlertaFinalizacion = useCallback((presupuesto) => {
    if (presupuesto.estado !== 'EN_EJECUCION' || !presupuesto.fechaProbableInicio || !presupuesto.tiempoEstimadoTerminacion) return null;

    const fechaEstimadaFin = calcularDiasHabiles(presupuesto.fechaProbableInicio, presupuesto.tiempoEstimadoTerminacion);
    if (!fechaEstimadaFin) return null;

    const diasFaltantes = calcularDiasFaltantes(fechaEstimadaFin);

    if (diasFaltantes === null) return null;
    if (diasFaltantes < 0) return { tipo: 'danger', mensaje: '¡Ya debió terminar!', icono: '🚨', detalle: 'Cambió a TERMINADO' };
    if (diasFaltantes === 0) return { tipo: 'danger', mensaje: '¡Termina HOY!', icono: '🚨', detalle: 'Cambiará a medianoche' };
    if (diasFaltantes <= 3) return { tipo: 'warning', mensaje: `Termina en ${diasFaltantes} día${diasFaltantes > 1 ? 's' : ''}`, icono: '⏰', detalle: 'Por finalizar' };

    return null;
  }, [calcularDiasHabiles, calcularDiasFaltantes]);

  // Cargar presupuestos APROBADOS cuando se abre el modal
  useEffect(() => {
    if (showListaPresupuestos && empresaSeleccionada?.id) {
      cargarPresupuestosAprobados();
    }
  }, [showListaPresupuestos, empresaSeleccionada?.id]);

  const cargarPresupuestosAprobados = async () => {
    try {
      setLoadingPresupuestos(true);

      // Cargar todas las obras usando el endpoint 'empresa' que trae información completa
      const response = await apiService.obras.getPorEmpresa(empresaSeleccionada.id);

      // Extraer datos
      const extractData = (response) => {
        if (Array.isArray(response)) return response;
        if (response?.datos && Array.isArray(response.datos)) return response.datos;
        if (response?.content && Array.isArray(response.content)) return response.content;
        if (response?.data && Array.isArray(response.data)) return response.data;
        return [];
      };

      const todasLasObras = extractData(response);

      // Filtrar por estado APROBADO, EN_EJECUCION o FINALIZADO (si es PRESUPUESTO_TAREA_LEVE/PRESUPUESTO_TRABAJO_DIARIO)
      // ✅ AHORA INCLUYE OBRAS INDEPENDIENTES (sin presupuesto)
      const obrasFiltradas = todasLasObras.filter(obra => {
        // Incluir obras en APROBADO o EN_EJECUCION
        if (obra.estado === 'APROBADO' || obra.estado === 'EN_EJECUCION') return true;

        // Incluir obras FINALIZADO solo si son PRESUPUESTO_TAREA_LEVE o PRESUPUESTO_TRABAJO_DIARIO
        if (obra.estado === 'FINALIZADO') {
          const esTareaLeve = obra.tipoOrigen === 'PRESUPUESTO_TAREA_LEVE' || obra.tipo_origen === 'PRESUPUESTO_TAREA_LEVE';
          const esTrabajoDiario = obra.tipoOrigen === 'PRESUPUESTO_TRABAJO_DIARIO' || obra.tipo_origen === 'PRESUPUESTO_TRABAJO_DIARIO';
          return esTareaLeve || esTrabajoDiario;
        }

        return false;
      });

      setPresupuestosAprobados(obrasFiltradas);
    } catch (err) {
      console.error('❌ Error cargando obras:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.mensaje || 'Error al cargar obras'
      });
      setTimeout(() => setNotification(null), 5000);
      setPresupuestosAprobados([]);
    } finally {
      setLoadingPresupuestos(false);
    }
  };

  // Persistir obra seleccionada en sessionStorage
  useEffect(() => {
    if (obraSeleccionada) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(obraSeleccionada));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [obraSeleccionada]);

  // 🆕 Calcular estadísticas personalizadas para obras seleccionadas (para el modal)
  const estadisticasPersonalizadas = useMemo(() => {
    const todasSeleccionadas = obrasSeleccionadas.size === obrasDisponibles.length;
    const ningunnaSeleccionada = obrasSeleccionadas.size === 0;
    const seleccionParcial = !todasSeleccionadas && !ningunnaSeleccionada;
    const usarSeleccionadas = seleccionParcial && !loadingSeleccionadas && estadisticasSeleccionadas?.totalPresupuesto > 0;
    const stats = usarSeleccionadas ? estadisticasSeleccionadas : estadisticasConsolidadas;

    if (!obrasDisponibles || obrasDisponibles.length === 0) {
      return { ...stats };
    }

    const presupuestosUnicos = new Map();
    const obrasIndependientes = new Map();
    const tareasLeves = new Map(); // 🆕 Mapa para tareas leves
    let totalTrabajosExtra = 0;
    let totalTrabajosAdicionales = 0;
    let cantidadObrasConPresupuesto = 0;
    let cantidadObrasIndependientes = 0;
    let cantidadTareasLeves = 0; // 🆕 Contador de tareas leves

    // Iterar sobre TODAS las obras para capturar trabajos extra seleccionados independientemente
    obrasDisponibles.forEach(o => {
      const obraSeleccionada = obrasSeleccionadas.has(o.id);

      // ✅ CASO 1: Obras independientes (sin presupuesto) - solo si están seleccionadas
      if (o.esObraIndependiente && obraSeleccionada) {
        if (!obrasIndependientes.has(o.id)) {
          const monto = o.totalPresupuesto || 0;
          obrasIndependientes.set(o.id, monto);
          cantidadObrasIndependientes++;
        }
        return;
      }

      // ✅ CASO 2: Tareas Leves (obras con presupuesto tipo TAREA_LEVE) - solo si están seleccionadas
      const esTareaLeve = o.presupuestoCompleto?.tipoPresupuesto === 'TAREA_LEVE' ||
                         o.presupuestoCompleto?.tipo_presupuesto === 'TAREA_LEVE' ||
                         o.presupuestoCompleto?.tipo_origen === 'TAREA_LEVE' ||
                         o.presupuestoCompleto?.tipoOrigen === 'TAREA_LEVE' ||
                         o.tipo_origen === 'TAREA_LEVE' ||
                         o.tipoOrigen === 'TAREA_LEVE';

      if (esTareaLeve && obraSeleccionada) {
        if (!tareasLeves.has(o.id)) {
          const monto = o.totalPresupuesto || 0;
          tareasLeves.set(o.id, monto);
          cantidadTareasLeves++;
        }
        return; // ⚠️ No procesar como obra principal
      }

      // ✅ CASO 3: Obras principales con presupuesto - solo si están seleccionadas
      if (obraSeleccionada) {
        const idPresupuesto = o.presupuestoCompleto?.id ?? o.presupuestoNoClienteId ?? o.presupuesto_no_cliente_id ?? o.presupuestoNoCliente?.id;
        if (idPresupuesto && !presupuestosUnicos.has(idPresupuesto)) {
          const monto = o.totalPresupuesto || 0;
          presupuestosUnicos.set(idPresupuesto, monto);
          cantidadObrasConPresupuesto++;
        }
      }

      // ✅ CASO 4: Trabajos extra de esta obra (independiente de si la obra principal está seleccionada)
      if (o.trabajosExtra && o.trabajosExtra.length > 0) {
        const trabajosExtraSeleccionadosDeEstaObra = o.trabajosExtra.filter(te =>
          trabajosExtraSeleccionados.has(te.id)
        );
        const totalTE = trabajosExtraSeleccionadosDeEstaObra.reduce((sum, t) => {
          // Usar totalConDescuentos si está disponible (es el valor real mostrado en la UI)
          const montoTE = t.presupuestoCompleto?.totalConDescuentos ||
                         t.totalCalculado ||
                         t.presupuestoCompleto?.totalFinal ||
                         0;
          return sum + montoTE;
        }, 0);
        totalTrabajosExtra += totalTE;
      }
    });

    // ✅ CASO 5: Trabajos adicionales seleccionados
    const trabajosAdicionalesSeleccionadosArray = trabajosAdicionalesDisponibles
      .filter(ta => trabajosAdicionalesSeleccionados.has(ta.id));
    totalTrabajosAdicionales = trabajosAdicionalesSeleccionadosArray.reduce((sum, ta) => sum + (ta.importe || 0), 0);

    // 🧮 SUMATORIA TOTAL
    const totalPresupuestos = Array.from(presupuestosUnicos.values()).reduce((sum, val) => sum + val, 0);
    const totalIndependientes = Array.from(obrasIndependientes.values()).reduce((sum, val) => sum + val, 0);
    const totalTareasLevesCalc = Array.from(tareasLeves.values()).reduce((sum, val) => sum + val, 0);
    const totalPresupuestosPersonalizado = totalPresupuestos + totalIndependientes + totalTareasLevesCalc + totalTrabajosExtra + totalTrabajosAdicionales;

    return {
      totalPresupuesto: totalPresupuestosPersonalizado,
      cantidadObras: cantidadObrasConPresupuesto + cantidadObrasIndependientes + cantidadTareasLeves, // ✅ Incluir tareas leves
      cantidadTrabajosExtra: trabajosExtraSeleccionados.size,
      cantidadTrabajosAdicionales: trabajosAdicionalesSeleccionados.size,
      cantidadObrasConPresupuesto,
      cantidadObrasIndependientes,
      cantidadTareasLeves, // 🆕 Agregar al objeto retornado
      // Mantener otros campos de stats para cobros, pagos, etc.
      totalCobrado: stats?.totalCobrado || 0,
      totalCobradoEmpresa: stats?.totalCobradoEmpresa || 0,
      totalPagado: stats?.totalPagado || 0,
      totalRetirado: stats?.totalRetirado || 0,
      saldoDisponible: stats?.saldoDisponible || 0,
      saldoCobradoSinAsignar: stats?.saldoCobradoSinAsignar || 0,
      porcentajeCobrado: stats?.porcentajeCobrado || 0,
      porcentajePagado: stats?.porcentajePagado || 0,
      porcentajeDisponible: stats?.porcentajeDisponible || 0,
      alertas: stats?.alertas || [],
      desglosePorObra: stats?.desglosePorObra || []
    };
  }, [
    obrasSeleccionadas,
    obrasDisponibles,
    trabajosExtraSeleccionados,
    trabajosAdicionalesSeleccionados,
    trabajosAdicionalesDisponibles,
    loadingSeleccionadas,
    estadisticasSeleccionadas,
    estadisticasConsolidadas
  ]);

  const handleSuccess = useCallback((data) => {
    setNotification({
      type: 'success',
      message: data?.mensaje || 'Operación exitosa'
    });
    setTimeout(() => setNotification(null), 5000);

    // Cerrar modal de registro para que el usuario vea la notificación
    setShowRegistrarPago(false);
    setShowRegistrarNuevoCobro(false);
    setShowAsignarCobroDisponible(false);
    setShowDarAdelanto(false);
    setShowPagoCuenta(false);

    // ✅ Recargar datos usando el contexto financiero
    recargarDatos();

    // ✅ Incrementar trigger para forzar recarga de modales Y estadísticas seleccionadas
    setRefreshTrigger(prev => prev + 1);

    // 🔥 Refrescar estadísticas de obras seleccionadas
    if (typeof refetchSeleccionadas === 'function') {
      refetchSeleccionadas();
    }

    // 🔥 Si el dashboard está abierto, forzar su actualización
    if (showResumenFinanciero) {
      // Cerrar y reabrir el dashboard para forzar recarga
      setShowResumenFinanciero(false);
      setTimeout(() => {
        setShowResumenFinanciero(true);
      }, 100);
    }
  }, [recargarDatos, showResumenFinanciero, refetchSeleccionadas]);

  const handleSelectObra = useCallback(async (obra) => {
    try {
      // 🔥 BUSCAR LA VERSIÓN MÁS RECIENTE DEL PRESUPUESTO PARA ESTA OBRA

      // Obtener todos los presupuestos de la empresa
      const todosPresupuestos = await apiService.presupuestosNoCliente.getAll(empresaSeleccionada.id);
      const presupuestosArray = Array.isArray(todosPresupuestos) ? todosPresupuestos :
                                 todosPresupuestos?.content || todosPresupuestos?.data || [];

      // Filtrar presupuestos que pertenecen a esta obra
      const presupuestosObra = presupuestosArray.filter(p => p.obraId === obra.id);

      // Ordenar por numeroVersion descendente y tomar el más reciente
      const presupuestoMasReciente = presupuestosObra.sort((a, b) => {
        const versionA = Number(a.numeroVersion || a.version || 0);
        const versionB = Number(b.numeroVersion || b.version || 0);
        return versionB - versionA;
      })[0];

      // Si no se encuentra por obraId, usar el presupuestoNoClienteId como fallback
      const presupuestoId = presupuestoMasReciente?.id || obra.presupuestoNoClienteId || obra.presupuesto_no_cliente_id || obra.presupuestoNoCliente?.id;

      // ✅ Detectar obra independiente (sin presupuesto)
      const esObraIndependiente = !presupuestoId;

      if (esObraIndependiente) {
      }

      // Crear objeto con la información de la obra
      const obraFormateada = {
        id: obra.id,
        obraId: obra.id, // ID de la obra
        presupuestoNoClienteId: presupuestoId, // Referencia al presupuesto (puede ser null para obras independientes)
        esObraIndependiente: esObraIndependiente, // ✅ Flag para identificar obras sin presupuesto
        presupuestoEstimado: obra.presupuestoEstimado || 0, // ✅ Para obras independientes
        nombreObra: obra.nombre || obra.nombreObra || 'Sin nombre',
        // Dirección completa
        direccionObra: {
          barrio: obra.direccionObraBarrio || null,
          calle: obra.direccionObraCalle || '',
          altura: obra.direccionObraAltura || '',
          torre: obra.direccionObraTorre || null,
          piso: obra.direccionObraPiso || null,
          depto: obra.direccionObraDepartamento || null,
          presupuestoNoClienteId: presupuestoId, // Puede ser null
          nombreObra: obra.nombre || obra.nombreObra || 'Sin nombre'
        },
        // Datos adicionales
        estado: obra.estado,
        clienteId: obra.clienteId || obra.idCliente,
        nombreCliente: obra.nombreCliente || obra.nombreSolicitante
      };

      setObraSeleccionada(obraFormateada);
      setShowListaPresupuestos(false);

      // ✅ Mensaje diferenciado para obras independientes
      const mensaje = esObraIndependiente
        ? `Obra Independiente seleccionada: ${obraFormateada.nombreObra} (Presupuesto estimado: $${(obra.presupuestoEstimado || 0).toLocaleString('es-AR')})`
        : `Obra seleccionada: ${obraFormateada.nombreObra} (Presupuesto v${presupuestoMasReciente?.numeroVersion || '1'})`;

      setNotification({
        type: 'success',
        message: mensaje
      });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error('❌ Error al seleccionar obra:', error);
      setNotification({
        type: 'error',
        message: 'Error al cargar el presupuesto de la obra'
      });
      setTimeout(() => setNotification(null), 5000);
    }
  }, [empresaSeleccionada]);

  const handleCambiarObra = useCallback(() => {
    // Limpiar selecciones de obras
    setObrasSeleccionadas(new Set());
    setTrabajosExtraSeleccionados(new Set());

    setNotification({
      type: 'info',
      message: 'Selección de obras limpiada'
    });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const handleVolverAtras = useCallback(() => {
    // Limpiar selecciones de obras
    setObrasSeleccionadas(new Set());
    setTrabajosExtraSeleccionados(new Set());

    setNotification({
      type: 'info',
      message: 'Selección de obras limpiada'
    });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const formatearDireccionObra = useCallback((obra) => {
    if (!obra?.direccionObra) return '';

    const dir = obra.direccionObra;
    const partes = [];

    if (dir.calle) partes.push(dir.calle);
    if (dir.altura) partes.push(dir.altura);
    if (dir.barrio) partes.push(`(${dir.barrio})`);
    if (dir.torre) partes.push(`Torre ${dir.torre}`);
    if (dir.piso) partes.push(`Piso ${dir.piso}`);
    if (dir.depto) partes.push(`Depto ${dir.depto}`);

    return partes.join(', ');
  }, []);

  // Función para abrir modal de desglose por obra
  const abrirDesglose = useCallback((tipo, titulo) => {
    if (!modoConsolidado) return;

    // Determinar qué estadísticas usar basado en la selección
    const todasSeleccionadas = obrasSeleccionadas.size === obrasDisponibles.length;
    const ningunnaSeleccionada = obrasSeleccionadas.size === 0;
    const seleccionParcial = !todasSeleccionadas && !ningunnaSeleccionada;
    const usarSeleccionadas = seleccionParcial && !loadingSeleccionadas && estadisticasSeleccionadas?.totalPresupuesto > 0;

    const estadisticasActuales = usarSeleccionadas ? estadisticasSeleccionadas : estadisticasConsolidadas;

    if (!estadisticasActuales?.desglosePorObra || estadisticasActuales.desglosePorObra.length === 0) {
      console.warn('⚠️ No hay datos de desglose disponibles');
      return;
    }

    setDesgloseTipo(tipo);
    setDesgloseTitulo(titulo);
    setShowDesglose(true);
  }, [modoConsolidado, estadisticasConsolidadas, estadisticasSeleccionadas, obrasSeleccionadas, obrasDisponibles, loadingSeleccionadas]);

  // 🆕 Cargar obras disponibles cuando se activa el modo consolidado
  useEffect(() => {
    const cargarObras = async () => {
      console.log('🔍 [SistemaFinanciero] Verificando carga de obras:', {
        modoConsolidado,
        empresaSeleccionada: empresaSeleccionada?.id,
        empresaNombre: empresaSeleccionada?.nombre
      });

      if (!modoConsolidado || !empresaSeleccionada) {
        console.warn('⚠️ [SistemaFinanciero] No se cargan obras:', {
          razon: !empresaSeleccionada ? 'No hay empresa seleccionada' : 'Modo consolidado desactivado'
        });
        return;
      }

      setLoadingObras(true);
      try {
        // 🔧 PASO 0A: Cargar TODOS los presupuestos primero (para verificar tipos)
        const response = await apiService.presupuestosNoCliente.getAll(empresaSeleccionada.id);

        const extractData = (response) => {
          if (Array.isArray(response)) return response;
          if (response?.datos && Array.isArray(response.datos)) return response.datos;
          if (response?.content && Array.isArray(response.content)) return response.content;
          if (response?.data && Array.isArray(response.data)) return response.data;
          return [];
        };

        const todosPresupuestos = extractData(response).filter(p => p.estado !== 'CANCELADO');

        // Crear mapa de presupuestos por ID para consulta rápida
        const presupuestosPorId = {};
        todosPresupuestos.forEach(p => {
          presupuestosPorId[p.id] = p;
        });

        // 🔧 PASO 0B: Cargar TODAS las obras desde /api/obras
        const obrasResponse = await apiService.obras.getPorEmpresa(empresaSeleccionada.id);
        const todasLasObras = Array.isArray(obrasResponse) ? obrasResponse : (obrasResponse?.datos || obrasResponse?.content || []);

        // Filtrar obras activas considerando tipoOrigen Y tipoPresupuesto del presupuesto asociado
        const obrasActivas = todasLasObras.filter(o => {
          if (o.estado === 'CANCELADO') return false;
          if (o.estado === 'APROBADO' || o.estado === 'EN_EJECUCION') return true;

          // Para obras TERMINADO, verificar si son PRESUPUESTO_TAREA_LEVE o PRESUPUESTO_TRABAJO_DIARIO
          if (o.estado === 'TERMINADO') {
            // Intentar identificar tipo por tipoOrigen (obras nuevas)
            let esTareaLeve = o.tipoOrigen === 'PRESUPUESTO_TAREA_LEVE' || o.tipo_origen === 'PRESUPUESTO_TAREA_LEVE';
            let esTrabajoDiario = o.tipoOrigen === 'PRESUPUESTO_TRABAJO_DIARIO' || o.tipo_origen === 'PRESUPUESTO_TRABAJO_DIARIO';

            // Si tipoOrigen es null, consultar el presupuesto asociado (obras antiguas)
            if (!esTareaLeve && !esTrabajoDiario && (o.tipoOrigen === null || o.tipo_origen === null)) {
              const presupuestoId = o.presupuestoNoClienteId || o.presupuesto_no_cliente_id;
              const presupuesto = presupuestosPorId[presupuestoId];
              if (presupuesto) {
                const tipoPresupuesto = presupuesto.tipoPresupuesto || presupuesto.tipo_presupuesto;
                esTareaLeve = tipoPresupuesto === 'TAREA_LEVE' || tipoPresupuesto === 'TRABAJO_ADICIONAL';
                esTrabajoDiario = tipoPresupuesto === 'TRABAJO_DIARIO';
              }
            }

            return esTareaLeve || esTrabajoDiario;
          }

          return false;
        });

        // 🎯 PASO 1: Separar trabajos extra ANTES de agrupar
      // 🎯 PASO 1: Separar presupuestos por tipo
      const presupuestosNormales = todosPresupuestos.filter(p => {
        // Excluir trabajos extra
        const esTE = p.esPresupuestoTrabajoExtra === true ||
                     p.esPresupuestoTrabajoExtra === 'V' ||
                     p.es_obra_trabajo_extra === true;
        if (esTE) return false;

        // Excluir TAREA_LEVE (se agrupan bajo su obra padre, no son obras principales)
        const esTareaLeve = p.tipoPresupuesto === 'TAREA_LEVE' || p.tipo_presupuesto === 'TAREA_LEVE';
        if (esTareaLeve) return false;

        return true;
      });

      const presupuestosTrabajosExtra = todosPresupuestos.filter(p => {
        const esTE = p.esPresupuestoTrabajoExtra === true ||
                     p.esPresupuestoTrabajoExtra === 'V' ||
                     p.es_obra_trabajo_extra === true;
        return esTE;
      });

      // 🎯 PASO 2: Agrupar SOLO obras normales por obraId y obtener la última versión
      const obrasPorObraId = {};

      presupuestosNormales.forEach(p => {
        const obraId = p.obraId || p.obra_id || p.direccionObraId;
        if (!obraId) return; // Saltar presupuestos sin obra asociada

        const version = p.numeroVersion || p.version || 0;
        if (!obrasPorObraId[obraId] || version > (obrasPorObraId[obraId].numeroVersion || 0)) {
          // 🔍 Calcular total correcto considerando descuentos
          const totalPresupuesto = obtenerTotalPresupuesto(p);

          obrasPorObraId[obraId] = {
            id: p.id, // El id es el del presupuesto más reciente
            obraId: obraId, // ✅ ID de la obra en tabla obras (para trabajos adicionales)
            nombreObra: p.nombreObra || `${p.direccionObraCalle} ${p.direccionObraAltura}`,
            numeroPresupuesto: p.numeroPresupuesto,
            numeroVersion: version,
            estado: p.estado,
            calle: p.direccionObraCalle || '',
            altura: p.direccionObraAltura || '',
            barrio: p.direccionObraBarrio || null,
            torre: p.direccionObraTorre || null,
            piso: p.direccionObraPiso || null,
            depto: p.direccionObraDepartamento || null,
            totalPresupuesto: totalPresupuesto,
            presupuestoCompleto: p, // ✅ Guardar presupuesto completo para el footer
            esObraIndependiente: false // Tiene presupuesto
          };
        }
      });

      // 🆕 PASO 2.5: Agregar OBRAS INDEPENDIENTES (sin presupuesto)
      obrasActivas.forEach(obra => {
        // Si la obra YA tiene presupuesto, saltarla
        if (obrasPorObraId[obra.id]) return;

        // Verificar que sea realmente independiente (sin presupuesto asociado)
        const tienePresupuesto = obra.presupuestoNoClienteId ||
                                obra.presupuesto_no_cliente_id ||
                                (obra.presupuestoNoCliente && typeof obra.presupuestoNoCliente === 'object');

        if (tienePresupuesto) return; // Saltar si tiene presupuesto

        // ✅ Es obra independiente - agregarla al mapa
        obrasPorObraId[obra.id] = {
          id: obra.id, // ID de la obra (no hay presupuesto)
          obraId: obra.id, // ✅ ID de la obra en tabla obras
          nombreObra: obra.nombre || `${obra.direccionObraCalle} ${obra.direccionObraAltura}`,
          numeroPresupuesto: null, // No tiene presupuesto
          numeroVersion: null, // No tiene versión
          estado: obra.estado,
          calle: obra.direccionObraCalle || '',
          altura: obra.direccionObraAltura || '',
          barrio: obra.direccionObraBarrio || null,
          torre: obra.direccionObraTorre || null,
          piso: obra.direccionObraPiso || null,
          depto: obra.direccionObraDepartamento || null,
          totalPresupuesto: obra.presupuestoEstimado || 0, // ✅ Usar presupuesto estimado
          cantidadSemanas: 0,
          presupuestoCompleto: null, // No tiene presupuesto
          esObraIndependiente: true // ✅ Flag para identificar
        };
      });

      // 🆕 PASO 2.6: Agregar OBRAS CON PRESUPUESTO que no fueron mapeadas en PASO 2
      // (por ejemplo, TRABAJO_DIARIO cuyo presupuesto no tiene obraId/direccionObraId actualizado)
      obrasActivas.forEach(obra => {
        // Si la obra ya fue procesada, saltarla
        if (obrasPorObraId[obra.id]) return;

        // Buscar presupuesto por tres métodos (en orden de prioridad):
        // IMPORTANTE: Buscar en TODOS los presupuestos, no solo presupuestosNormales,
        // porque puede haber inconsistencias en los datos
        let presupuesto = null;

        // Método 1: presupuesto.obraId apunta a la obra Y está APROBADO Y NO es TAREA_LEVE
        presupuesto = todosPresupuestos.find(p => {
          const esTE = p.esPresupuestoTrabajoExtra === true || p.esPresupuestoTrabajoExtra === 'V' || p.es_obra_trabajo_extra === true;
          const esTareaLeve = p.tipoPresupuesto === 'TAREA_LEVE' || p.tipo_presupuesto === 'TAREA_LEVE';
          return (p.obraId || p.obra_id) === obra.id && p.estado === 'APROBADO' && !esTE && !esTareaLeve;
        });

        // Método 2: obra.presupuestoNoClienteId apunta al presupuesto Y está APROBADO Y NO es TAREA_LEVE
        if (!presupuesto) {
          const presupuestoNoClienteId = obra.presupuestoNoClienteId || obra.presupuesto_no_cliente_id;
          if (presupuestoNoClienteId) {
            const tempPresupuesto = todosPresupuestos.find(p => p.id === presupuestoNoClienteId);
            if (tempPresupuesto && tempPresupuesto.estado === 'APROBADO') {
              const esTE = tempPresupuesto.esPresupuestoTrabajoExtra === true || tempPresupuesto.esPresupuestoTrabajoExtra === 'V' || tempPresupuesto.es_obra_trabajo_extra === true;
              const esTareaLeve = tempPresupuesto.tipoPresupuesto === 'TAREA_LEVE' || tempPresupuesto.tipo_presupuesto === 'TAREA_LEVE';
              if (!esTE && !esTareaLeve) {
                presupuesto = tempPresupuesto;
              }
            }
          }
        }

        // Método 3: Cualquier presupuesto asociado (incluso BORRADOR/ENVIADO/TERMINADO) pero NO TAREA_LEVE
        if (!presupuesto) {
          const presupuestoNoClienteId = obra.presupuestoNoClienteId || obra.presupuesto_no_cliente_id;
          if (presupuestoNoClienteId) {
            const tempPresupuesto = todosPresupuestos.find(p => p.id === presupuestoNoClienteId);
            const esTE = tempPresupuesto?.esPresupuestoTrabajoExtra === true || tempPresupuesto?.esPresupuestoTrabajoExtra === 'V' || tempPresupuesto?.es_obra_trabajo_extra === true;
            const esTareaLeve = tempPresupuesto?.tipoPresupuesto === 'TAREA_LEVE' || tempPresupuesto?.tipo_presupuesto === 'TAREA_LEVE';
            if (tempPresupuesto && !esTE && !esTareaLeve) {
              presupuesto = tempPresupuesto;
            }
          }

          if (!presupuesto) {
            presupuesto = todosPresupuestos.find(p => {
              const esTE = p.esPresupuestoTrabajoExtra === true || p.esPresupuestoTrabajoExtra === 'V' || p.es_obra_trabajo_extra === true;
              const esTareaLeve = p.tipoPresupuesto === 'TAREA_LEVE' || p.tipo_presupuesto === 'TAREA_LEVE';
              return (p.obraId || p.obra_id) === obra.id && !esTE && !esTareaLeve;
            });
          }
        }

        // Si no se encuentra el presupuesto pero es TRABAJO_DIARIO, agregar como obra independiente
        if (!presupuesto) {
          // Intentar identificar si es TRABAJO_DIARIO por tipoOrigen o por tipoPresupuesto de la obra
          let esTrabajoDiario = obra.tipoOrigen === 'PRESUPUESTO_TRABAJO_DIARIO' || obra.tipo_origen === 'PRESUPUESTO_TRABAJO_DIARIO';

          // Si tipoOrigen es null, verificar tipoPresupuesto en la obra (campo heredado)
          if (!esTrabajoDiario && (obra.tipoOrigen === null || obra.tipo_origen === null)) {
            const tipoPresupuestoObra = obra.tipoPresupuesto || obra.tipo_presupuesto;
            esTrabajoDiario = tipoPresupuestoObra === 'TRABAJO_DIARIO';
          }

          if (esTrabajoDiario) {
            obrasPorObraId[obra.id] = {
              id: obra.id,
              obraId: obra.id,
              nombreObra: obra.nombre || `${obra.direccionObraCalle} ${obra.direccionObraAltura}`,
              numeroPresupuesto: null,
              numeroVersion: null,
              estado: obra.estado,
              calle: obra.direccionObraCalle || '',
              altura: obra.direccionObraAltura || '',
              barrio: obra.direccionObraBarrio || null,
              torre: obra.direccionObraTorre || null,
              piso: obra.direccionObraPiso || null,
              depto: obra.direccionObraDepartamento || null,
              totalPresupuesto: obra.presupuestoEstimado || 0,
              cantidadSemanas: 0,
              presupuestoCompleto: null,
              esObraIndependiente: true
            };
          }
          return;
        }

        // Agregar la obra al mapa usando los datos del presupuesto
        const totalPresupuesto = obtenerTotalPresupuesto(presupuesto);
        obrasPorObraId[obra.id] = {
          id: presupuesto.id, // El id es el del presupuesto
          obraId: obra.id, // ✅ ID de la obra en tabla obras
          nombreObra: presupuesto.nombreObra || obra.nombre || `${obra.direccionObraCalle} ${obra.direccionObraAltura}`,
          numeroPresupuesto: presupuesto.numeroPresupuesto,
          numeroVersion: presupuesto.numeroVersion || presupuesto.version || 0,
          estado: presupuesto.estado,
          calle: obra.direccionObraCalle || presupuesto.direccionObraCalle || '',
          altura: obra.direccionObraAltura || presupuesto.direccionObraAltura || '',
          barrio: obra.direccionObraBarrio || presupuesto.direccionObraBarrio || null,
          torre: obra.direccionObraTorre || presupuesto.direccionObraTorre || null,
          piso: obra.direccionObraPiso || presupuesto.direccionObraPiso || null,
          depto: obra.direccionObraDepartamento || presupuesto.direccionObraDepartamento || null,
          totalPresupuesto: totalPresupuesto,
          presupuestoCompleto: presupuesto, // ✅ Guardar presupuesto completo
          esObraIndependiente: false // Tiene presupuesto
        };
      });

      // 🆕 PASO 2.7: Agregar TAREA_LEVE como obras independientes
      // Las TAREA_LEVE se agrupan bajo su obra padre en el renderizado, pero deben estar disponibles
      const presupuestosTareasLeves = todosPresupuestos.filter(p => {
        const esTE = p.esPresupuestoTrabajoExtra === true || p.esPresupuestoTrabajoExtra === 'V' || p.es_obra_trabajo_extra === true;
        const esTareaLeve = p.tipoPresupuesto === 'TAREA_LEVE' || p.tipo_presupuesto === 'TAREA_LEVE';
        return !esTE && esTareaLeve;
      });

      presupuestosTareasLeves.forEach(p => {
        const obraId = p.obraId || p.obra_id || p.direccionObraId;
        if (!obraId) return; // Saltar presupuestos sin obra asociada

        // Verificar si ya existe una obra con este obraId (puede ser la principal)
        // Si existe, no sobrescribir, crear una entrada separada con el ID del presupuesto
        const claveUnica = obrasPorObraId[obraId] ? p.id : obraId;

        const totalPresupuesto = obtenerTotalPresupuesto(p);

        obrasPorObraId[claveUnica] = {
          id: p.id, // El id es el del presupuesto de tarea leve
          obraId: obraId, // ✅ ID de la obra en tabla obras (para agrupación)
          nombreObra: p.nombreObra || `${p.direccionObraCalle} ${p.direccionObraAltura}`,
          numeroPresupuesto: p.numeroPresupuesto,
          numeroVersion: p.numeroVersion || p.version || 0,
          estado: p.estado,
          calle: p.direccionObraCalle || '',
          altura: p.direccionObraAltura || '',
          barrio: p.direccionObraBarrio || null,
          torre: p.direccionObraTorre || null,
          piso: p.direccionObraPiso || null,
          depto: p.direccionObraDepartamento || null,
          totalPresupuesto: totalPresupuesto,
          presupuestoCompleto: p, // ✅ Guardar presupuesto completo
          esObraIndependiente: false // Tiene presupuesto
        };
      });

      const obrasNormales = Object.values(obrasPorObraId);

      // 🎯 PASO 3: Agrupar trabajos extra por obraId
      const trabajosExtraPorObraId = {};

      presupuestosTrabajosExtra.forEach(p => {
        const obraId = p.obraId || p.obra_id || p.direccionObraId;
        if (!obraId) return;

        const version = p.numeroVersion || p.version || 0;
        if (!trabajosExtraPorObraId[obraId] || version > (trabajosExtraPorObraId[obraId].numeroVersion || 0)) {
          const totalPresupuesto = obtenerTotalPresupuesto(p);

          trabajosExtraPorObraId[obraId] = {
            id: p.id,
            obraId: obraId, // ✅ ID de la obra en tabla obras
            nombreObra: p.nombreObra || `${p.direccionObraCalle} ${p.direccionObraAltura}`,
            numeroPresupuesto: p.numeroPresupuesto,
            numeroVersion: version,
            estado: p.estado,
            calle: p.direccionObraCalle || '',
            altura: p.direccionObraAltura || '',
            barrio: p.direccionObraBarrio || null,
            totalPresupuesto: totalPresupuesto,
            presupuestoCompleto: p
          };
        }
      });

      const obrasTrabajoExtra = Object.values(trabajosExtraPorObraId);

      // 🔧 CARGAR trabajos extra SOLO para obras normales (NO para tareas leves)
      const obrasConTrabajosExtra = [];

      for (const obra of obrasNormales) {
        // ✅ IMPORTANTE: Las tareas leves NO deben tener trabajos extra asociados
        // Los trabajos extra solo pertenecen a la obra principal, no a sus tareas leves
        const esTareaLeve = obra.presupuestoCompleto?.tipoPresupuesto === 'TAREA_LEVE' ||
                           obra.presupuestoCompleto?.tipo_presupuesto === 'TAREA_LEVE' ||
                           obra.presupuestoCompleto?.tipo_origen === 'TAREA_LEVE' ||
                           obra.presupuestoCompleto?.tipoOrigen === 'TAREA_LEVE';

        if (esTareaLeve) {
          // Tareas leves no tienen trabajos extra
          obrasConTrabajosExtra.push({
            ...obra,
            trabajosExtra: [],
            esTrabajoExtra: false
          });
          continue;
        }

        const obraId = obra.presupuestoCompleto?.obraId || obra.presupuestoCompleto?.obra_id || obra.presupuestoCompleto?.direccionObraId;

        if (!obraId) {
          obrasConTrabajosExtra.push({
            ...obra,
            trabajosExtra: [],
            esTrabajoExtra: false
          });
          continue;
        }

        try {
          // 🎯 Buscar trabajos extra que pertenecen a esta obra usando 3 métodos:
          // 1. Por obra_origen_id (campo en presupuesto del trabajo extra)
          // 2. Por dirección (calle + altura coinciden)
          // 3. Por nombre similar

          const obraDireccion = `${obra.calle || ''} ${obra.altura || ''}`.trim().toLowerCase();

          const trabajosDeEstaObra = obrasTrabajoExtra.filter(te => {
            const teDireccion = `${te.calle || ''} ${te.altura || ''}`.trim().toLowerCase();

            // Método 1: Por obra_origen_id (ID de la obra en tabla obras) - DEPRECADO, no viene en API
            const obraIdTablaObras = obra.presupuestoCompleto?.obraId; // El obraId apunta a la fila en tabla obras
            const obraPadreId = te.presupuestoCompleto?.obraOrigenId ||
                               te.presupuestoCompleto?.obra_origen_id ||
                               te.presupuestoCompleto?.obraPadreId ||
                               te.presupuestoCompleto?.obra_padre_id;

            if (obraIdTablaObras && obraPadreId === obraIdTablaObras) {
              return true;
            }

            // Método 2: Por dirección exacta
            if (obraDireccion && teDireccion && obraDireccion === teDireccion && te.nombreObra !== obra.nombreObra) {
              return true;
            }

            // Método 3: Por nombre contenido (trabajo extra contiene nombre de obra padre)
            const obraNombreLower = obra.nombreObra?.toLowerCase() || '';
            const teNombreLower = te.nombreObra?.toLowerCase() || '';
            if (obraNombreLower && teNombreLower.includes(obraNombreLower) && teNombreLower !== obraNombreLower) {
              return true;
            }

            return false;
          });

          const trabajosConTotal = trabajosDeEstaObra.map(te => {
            // Usar función helper para calcular total correcto
            const totalCalculado = te.presupuestoCompleto
              ? obtenerTotalPresupuesto(te.presupuestoCompleto)
              : (parseFloat(te.totalPresupuesto) || 0);

            return {
              id: te.id,
              nombre: te.nombreObra,
              numeroPresupuesto: te.numeroPresupuesto,
              numeroVersion: te.numeroVersion,
              estado: te.estado,
              totalCalculado: totalCalculado,
              obraId: te.obraId, // ✅ Ya viene definido desde trabajosExtraPorObraId
              obraPadreId: te.presupuestoCompleto?.obraOrigenId || te.presupuestoCompleto?.obra_origen_id,
              esTrabajoExtra: true,
              presupuestoCompleto: te.presupuestoCompleto
            };
          });

          obrasConTrabajosExtra.push({
            ...obra,
            trabajosExtra: trabajosConTotal,
            esTrabajoExtra: false
          });

        } catch (error) {
          console.error(`❌ Error procesando obra "${obra.nombreObra}":`, error);
          obrasConTrabajosExtra.push({
            ...obra,
            trabajosExtra: [],
            esTrabajoExtra: false
          });
        }
      }

      setObrasDisponibles(obrasConTrabajosExtra);
      console.log(`✅ [SistemaFinanciero] Obras cargadas: ${obrasConTrabajosExtra.length} obras disponibles`);

      // Preservar selección existente (comienza vacío por defecto)
      setObrasSeleccionadas(prevSelected => {
        // Excluir Tareas Leves para la selección
        const obrasNormalesSinTareasLeves = obrasConTrabajosExtra.filter(o => {
          const esTareaLeve = o.presupuestoCompleto?.tipoPresupuesto === 'TAREA_LEVE' ||
                             o.presupuestoCompleto?.tipo_presupuesto === 'TAREA_LEVE' ||
                             o.presupuestoCompleto?.tipo_origen === 'TAREA_LEVE' ||
                             o.presupuestoCompleto?.tipoOrigen === 'TAREA_LEVE' ||
                             o.tipo_origen === 'TAREA_LEVE' ||
                             o.tipoOrigen === 'TAREA_LEVE';
          return !esTareaLeve;
        });

        // Si ya hay obras seleccionadas, preservar la selección
        if (prevSelected.size > 0) {
          const idsDisponibles = new Set(obrasNormalesSinTareasLeves.map(o => o.id));
          return new Set([...prevSelected].filter(id => idsDisponibles.has(id)));
        }
        // Primera carga: vacío (el usuario selecciona manualmente)
        return new Set();
      });

      // Preservar selección de trabajos extra (comienza vacío por defecto)
      setTrabajosExtraSeleccionados(prevSelected => {
        const todosLosTrabajosExtra = [];
        obrasConTrabajosExtra.forEach(obra => {
          if (obra.trabajosExtra && obra.trabajosExtra.length > 0) {
            obra.trabajosExtra.forEach(te => todosLosTrabajosExtra.push(te.id));
          }
        });

        // Si ya hay trabajos extra seleccionados, preservar la selección
        if (prevSelected.size > 0) {
          const idsDisponibles = new Set(todosLosTrabajosExtra);
          return new Set([...prevSelected].filter(id => idsDisponibles.has(id)));
        }
        // Primera carga: vacío (el usuario selecciona manualmente)
        return new Set();
      });
      } catch (err) {
        console.error('❌ Error cargando obras:', err);
      } finally {
        setLoadingObras(false);
      }
    };

    cargarObras();
  }, [modoConsolidado, empresaSeleccionada, refreshTrigger]);

  // 🔄 Event listener para refrescar obras cuando se actualiza un presupuesto
  useEffect(() => {
    const handlePresupuestoActualizado = (data) => {
      // Solo refrescar si estamos en modo consolidado y tenemos empresa seleccionada
      if (modoConsolidado && empresaSeleccionada) {

        // Forzar recarga completa de obras
        setTimeout(async () => {
          try {
            setLoadingObras(true);

            const obrasResponse = await apiService.obras.getPorEmpresa(empresaSeleccionada.id);
            const todasLasObras = Array.isArray(obrasResponse) ? obrasResponse : (obrasResponse?.datos || obrasResponse?.content || []);
            const obrasActivas = todasLasObras.filter(o => {
              if (o.estado === 'CANCELADO') return false;
              if (o.estado === 'APROBADO' || o.estado === 'EN_EJECUCION') return true;

              // Incluir obras FINALIZADO solo si son PRESUPUESTO_TAREA_LEVE o PRESUPUESTO_TRABAJO_DIARIO
              if (o.estado === 'FINALIZADO') {
                const esTareaLeve = o.tipoOrigen === 'PRESUPUESTO_TAREA_LEVE' || o.tipo_origen === 'PRESUPUESTO_TAREA_LEVE';
                const esTrabajoDiario = o.tipoOrigen === 'PRESUPUESTO_TRABAJO_DIARIO' || o.tipo_origen === 'PRESUPUESTO_TRABAJO_DIARIO';
                return esTareaLeve || esTrabajoDiario;
              }

              return false;
            });

            const response = await apiService.presupuestosNoCliente.getAll(empresaSeleccionada.id);
            const extractData = (response) => {
              if (Array.isArray(response)) return response;
              if (response?.datos && Array.isArray(response.datos)) return response.datos;
              if (response?.content && Array.isArray(response.content)) return response.content;
              if (response?.data && Array.isArray(response.data)) return response.data;
              return [];
            };

            const todosPresupuestos = extractData(response).filter(p => p.estado !== 'CANCELADO');
            const presupuestosNormales = todosPresupuestos.filter(p => {
              const esTE = p.esPresupuestoTrabajoExtra === true ||
                           p.esPresupuestoTrabajoExtra === 'V' ||
                           p.es_obra_trabajo_extra === true;
              return !esTE;
            });

            const obrasPorObraId = {};
            presupuestosNormales.forEach(p => {
              const obraId = p.obraId || p.obra_id || p.direccionObraId;
              if (!obraId) return;

              const version = p.numeroVersion || p.version || 0;
              if (!obrasPorObraId[obraId] || version > (obrasPorObraId[obraId].numeroVersion || 0)) {
                const totalPresupuesto = obtenerTotalPresupuesto(p);

                obrasPorObraId[obraId] = {
                  id: p.id,
                  obraId: obraId,
                  nombreObra: p.nombreObra || `${p.direccionObraCalle} ${p.direccionObraAltura}`,
                  numeroPresupuesto: p.numeroPresupuesto,
                  numeroVersion: version,
                  estado: p.estado,
                  calle: p.direccionObraCalle || '',
                  altura: p.direccionObraAltura || '',
                  barrio: p.direccionObraBarrio || null,
                  torre: p.direccionObraTorre || null,
                  piso: p.direccionObraPiso || null,
                  depto: p.direccionObraDepartamento || null,
                  totalPresupuesto: totalPresupuesto,
                  cantidadSemanas: p.cantidadSemanas || p.cantidad_semanas || 0,
                  presupuestoCompleto: p,
                  esObraIndependiente: false
                };
              }
            });

            // Agregar obras que no fueron mapeadas por obraId
            // Verificar si tienen presupuestoNoClienteId para buscar el presupuesto correcto
            obrasActivas.forEach(obra => {
              if (obrasPorObraId[obra.id]) return;

              // Buscar presupuesto por presupuestoNoClienteId
              const presupuestoNoClienteId = obra.presupuestoNoClienteId ||
                                              obra.presupuesto_no_cliente_id ||
                                              (obra.presupuestoNoCliente && typeof obra.presupuestoNoCliente === 'object' ? obra.presupuestoNoCliente.id : null);

              if (presupuestoNoClienteId) {
                // Buscar el presupuesto en todosPresupuestos
                const presupuesto = presupuestosNormales.find(p => p.id === presupuestoNoClienteId);

                if (presupuesto) {
                  // La obra SÍ tiene presupuesto, usar el total calculado
                  const totalPresupuesto = obtenerTotalPresupuesto(presupuesto);

                  obrasPorObraId[obra.id] = {
                    id: presupuesto.id,
                    obraId: obra.id,
                    nombreObra: presupuesto.nombreObra || obra.nombre || `${obra.direccionObraCalle} ${obra.direccionObraAltura}`,
                    numeroPresupuesto: presupuesto.numeroPresupuesto,
                    numeroVersion: presupuesto.numeroVersion || presupuesto.version || 0,
                    estado: presupuesto.estado,
                    calle: obra.direccionObraCalle || presupuesto.direccionObraCalle || '',
                    altura: obra.direccionObraAltura || presupuesto.direccionObraAltura || '',
                    barrio: obra.direccionObraBarrio || presupuesto.direccionObraBarrio || null,
                    torre: obra.direccionObraTorre || presupuesto.direccionObraTorre || null,
                    piso: obra.direccionObraPiso || presupuesto.direccionObraPiso || null,
                    depto: obra.direccionObraDepartamento || presupuesto.direccionObraDepartamento || null,
                    totalPresupuesto: totalPresupuesto,
                    cantidadSemanas: presupuesto.cantidadSemanas || presupuesto.cantidad_semanas || 0,
                    presupuestoCompleto: presupuesto,
                    esObraIndependiente: false
                  };
                  return;
                }
              }

              // Si llegamos aquí, la obra NO tiene presupuesto (es independiente)
              obrasPorObraId[obra.id] = {
                id: obra.id,
                obraId: obra.id,
                nombreObra: obra.nombre || `${obra.direccionObraCalle} ${obra.direccionObraAltura}`,
                numeroPresupuesto: null,
                numeroVersion: null,
                estado: obra.estado,
                calle: obra.direccionObraCalle || '',
                altura: obra.direccionObraAltura || '',
                barrio: obra.direccionObraBarrio || null,
                torre: obra.direccionObraTorre || null,
                piso: obra.direccionObraPiso || null,
                depto: obra.direccionObraDepartamento || null,
                totalPresupuesto: obra.presupuestoEstimado || 0,
                cantidadSemanas: 0,
                presupuestoCompleto: null,
                esObraIndependiente: true
              };
            });

            const obrasNormales = Object.values(obrasPorObraId);
            setObrasDisponibles(obrasNormales);

            setNotification({
              type: 'success',
              message: '✅ Datos actualizados por cambio en presupuesto'
            });
            setTimeout(() => setNotification(null), 3000);
          } catch (error) {
            console.error('❌ Error refrescando obras por actualización de presupuesto:', error);
          } finally {
            setLoadingObras(false);
          }
        }, 1000); // Delay de 1 segundo para asegurar sincronización
      }
    };

    // Suscribirse al evento
    const unsubscribe = eventBus.on(FINANCIAL_EVENTS.PRESUPUESTO_ACTUALIZADO, handlePresupuestoActualizado);

    // Cleanup
    return unsubscribe;
  }, [modoConsolidado, empresaSeleccionada]);

  // 🆕 Cargar trabajos adicionales cuando cambia la empresa O refreshTrigger
  useEffect(() => {
    const cargarTrabajosAdicionales = async () => {
      if (!empresaSeleccionada?.id) return;

      try {
        const trabajosAdicionales = await trabajosAdicionalesService.listarTrabajosAdicionales(empresaSeleccionada.id);
        setTrabajosAdicionalesDisponibles(trabajosAdicionales || []);

        // Primera carga: vacío (el usuario selecciona manualmente)
        setTrabajosAdicionalesSeleccionados(prevSelected => {
          if (prevSelected.size > 0) {
            const idsDisponibles = new Set(trabajosAdicionales.map(ta => ta.id));
            return new Set([...prevSelected].filter(id => idsDisponibles.has(id)));
          }
          return new Set();
        });
      } catch (error) {
        console.error('❌ Error cargando trabajos adicionales:', error);
        setTrabajosAdicionalesDisponibles([]);
      }
    };

    cargarTrabajosAdicionales();
  }, [empresaSeleccionada, refreshTrigger]);


  // 🔄 DESHABILITADO: Este useEffect causa bucle infinito y sobrescribe la lógica correcta
  // 🔄 Recargar obras cuando hay cambios financieros (cobros/pagos)
  /*
  useEffect(() => {
    if (!modoConsolidado || !empresaSeleccionada) return;

    // Recargar obras después de cambios financieros
    const recargarObrasTimeout = setTimeout(() => {
      const recargarObras = async () => {
        try {
          const [responseAprobado, responseEnEjecucion] = await Promise.all([
            apiService.presupuestosNoCliente.busquedaAvanzada({ estado: 'APROBADO' }, empresaSeleccionada.id),
            apiService.presupuestosNoCliente.busquedaAvanzada({ estado: 'EN_EJECUCION' }, empresaSeleccionada.id)
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

          // Agrupar por nombre de obra y obtener la última versión
          const obrasPorNombre = {};
          todosPresupuestos.forEach(p => {
            const nombreObra = p.nombreObra || `${p.direccionObraCalle} ${p.direccionObraAltura}`;
            const version = p.numeroVersion || p.version || 0;

            if (!obrasPorNombre[nombreObra] || version > (obrasPorNombre[nombreObra].numeroVersion || 0)) {
              const totalPresupuesto = obtenerTotalPresupuesto(p);

              obrasPorNombre[nombreObra] = {
                id: p.id,
                nombreObra: nombreObra,
                numeroPresupuesto: p.numeroPresupuesto,
                numeroVersion: version,
                estado: p.estado,
                calle: p.direccionObraCalle || '',
                altura: p.direccionObraAltura || '',
                barrio: p.direccionObraBarrio || null,
                torre: p.direccionObraTorre || null,
                piso: p.direccionObraPiso || null,
                depto: p.direccionObraDepartamento || null,
                totalPresupuesto: totalPresupuesto,
                cantidadSemanas: p.cantidadSemanas || p.cantidad_semanas || 0,
                presupuestoCompleto: p
              };
            }
          });

          const obrasArray = Object.values(obrasPorNombre);
          setObrasDisponibles(obrasArray);

          // 🔒 Preservar la selección del usuario, solo actualizar si hay obras nuevas o eliminadas
          setObrasSeleccionadas(prevSelected => {
            const idsDisponibles = new Set(obrasArray.map(o => o.id));
            // Mantener solo las obras seleccionadas que aún existen
            return new Set([...prevSelected].filter(id => idsDisponibles.has(id)));
          });
        } catch (err) {
          console.error('❌ Error recargando obras:', err);
        }
      };

      recargarObras();
    }, 500); // Pequeño delay para evitar múltiples cargas

    return () => clearTimeout(recargarObrasTimeout);
  }, [refreshTrigger, modoConsolidado, empresaSeleccionada]);
  */

  // 🔒 Ref para prevenir scroll automático - PERMANENTE
  const scrollContainerRef = useRef(null);
  const scrollPositionRef = useRef(0);
  const isTogglingRef = useRef(false);

  // 🔒 Forzar restauración del scroll después de cada render
  useLayoutEffect(() => {
    if (scrollContainerRef.current && isTogglingRef.current) {
      const targetPosition = scrollPositionRef.current;
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = targetPosition;
        }
      });
    }
  });

  // 🔒 Bloqueo AGRESIVO del scroll durante toggles
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = (e) => {
      if (isTogglingRef.current) {
        // BLOQUEAR completamente el evento de scroll
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Restaurar posición inmediatamente
        const targetPosition = scrollPositionRef.current;
        requestAnimationFrame(() => {
          if (container && isTogglingRef.current) {
            container.scrollTop = targetPosition;
          }
        });
        return false;
      } else {
        // Actualizar posición guardada solo cuando NO estamos en toggle
        scrollPositionRef.current = container.scrollTop;
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: false, capture: true });

    return () => {
      container.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, []);

  // 🆕 Funciones para manejar selección de obras
  const toggleObraSeleccion = useCallback((obraId) => {
    // Capturar posición del scroll ANTES del cambio de estado
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollTop;
      // 🔒 Activar bloqueo PERMANENTE (no se desactiva nunca hasta reload)
      isTogglingRef.current = true;
    }

    setObrasSeleccionadas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(obraId)) {
        newSet.delete(obraId);
      } else {
        newSet.add(obraId);
      }
      return newSet;
    });
  }, []);

  // 🆕 Funciones para manejar selección de trabajos extra
  const toggleTrabajoExtraSeleccion = useCallback((trabajoExtraId) => {
    // Capturar posición del scroll ANTES del cambio de estado
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollTop;
      // 🔒 Activar bloqueo PERMANENTE (no se desactiva nunca hasta reload)
      isTogglingRef.current = true;
    }

    setTrabajosExtraSeleccionados(prev => {
      const newSet = new Set(prev);
      if (newSet.has(trabajoExtraId)) {
        newSet.delete(trabajoExtraId);
      } else {
        newSet.add(trabajoExtraId);
      }
      return newSet;
    });
  }, []);

  const toggleTrabajoAdicionalSeleccion = useCallback((trabajoAdicionalId) => {
    // Capturar posición del scroll ANTES del cambio de estado
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollTop;
      // 🔒 Activar bloqueo PERMANENTE (no se desactiva nunca hasta reload)
      isTogglingRef.current = true;
    }

    setTrabajosAdicionalesSeleccionados(prev => {
      const newSet = new Set(prev);
      if (newSet.has(trabajoAdicionalId)) {
        newSet.delete(trabajoAdicionalId);
      } else {
        newSet.add(trabajoAdicionalId);
      }
      return newSet;
    });
  }, []);

  const seleccionarTodasObras = () => {
    // Capturar posición del scroll ANTES del cambio
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollTop;
      // 🔒 Activar bloqueo PERMANENTE (no se desactiva nunca hasta reload)
      isTogglingRef.current = true;
    }

    const todosLosTrabajosExtra = [];
    setObrasSeleccionadas(new Set(obrasDisponibles.map(obra => obra.id)));
    obrasDisponibles.forEach(obra => {
      if (obra.trabajosExtra && obra.trabajosExtra.length > 0) {
        obra.trabajosExtra.forEach(te => todosLosTrabajosExtra.push(te.id));
      }
    });
    setTrabajosExtraSeleccionados(new Set(todosLosTrabajosExtra));
    // Seleccionar todos los trabajos adicionales
    setTrabajosAdicionalesSeleccionados(new Set(trabajosAdicionalesDisponibles.map(ta => ta.id)));
  };

  const deseleccionarTodasObras = () => {
    // Capturar posición del scroll ANTES del cambio
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollTop;
      // 🔒 Activar bloqueo PERMANENTE (no se desactiva nunca hasta reload)
      isTogglingRef.current = true;
    }

    setObrasSeleccionadas(new Set());
    setTrabajosExtraSeleccionados(new Set());
    setTrabajosAdicionalesSeleccionados(new Set());
  };

  // 🆕 Componente inline para el selector de obras
  const ObrasSelector = () => {
    console.log('🎨 [ObrasSelector] Renderizando con:', {
      loadingObras,
      cantidadObras: obrasDisponibles.length,
      obrasSeleccionadas: obrasSeleccionadas.size
    });

    if (loadingObras) {
      return (
        <div className="card mb-3">
          <div className="card-body text-center py-4">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Cargando obras...</span>
            </div>
            <p className="mt-2 text-muted">Cargando obras disponibles...</p>
          </div>
        </div>
      );
    }

    if (obrasDisponibles.length === 0) {
      return (
        <div className="alert alert-warning">
          <i className="bi bi-exclamation-triangle me-2"></i>
          No hay obras activas (APROBADO, EN_EJECUCION o FINALIZADO de Tareas Leves)
        </div>
      );
    }

    return (
      <div className="card mb-3 border-primary">
        <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            <i className="bi bi-building me-2"></i>
            Seleccionar Obras ({obrasSeleccionadas.size + trabajosExtraSeleccionados.size + trabajosAdicionalesSeleccionados.size} seleccionadas)
            {(() => {
              // Contar obras por tipo usando el array unificado que incluye obras + trabajos extra
              // ORDEN CORRECTO: Primero verificar Tarea Leve (es la categoría más específica)
              const tareaLeves = presupuestosSeleccionadosArray.filter(p => {
                const esTareaLeve = p.tipoPresupuesto === 'TAREA_LEVE' || p.tipo_presupuesto === 'TAREA_LEVE' ||
                                   p.tipo_origen === 'TAREA_LEVE' || p.tipoOrigen === 'TAREA_LEVE' ||
                                   p.tipo === 'TAREA_LEVE';
                return esTareaLeve;
              }).length;

              const adicionalesObra = presupuestosSeleccionadosArray.filter(p => {
                // Primero verificar que NO sea Tarea Leve
                const esTareaLeve = p.tipoPresupuesto === 'TAREA_LEVE' || p.tipo_presupuesto === 'TAREA_LEVE' ||
                                   p.tipo_origen === 'TAREA_LEVE' || p.tipoOrigen === 'TAREA_LEVE' ||
                                   p.tipo === 'TAREA_LEVE';
                if (esTareaLeve) return false;

                // Luego verificar si es trabajo extra/adicional
                const esTrabajoExtra = p.esTrabajoExtra === true ||
                                      p.esPresupuestoTrabajoExtra === true ||
                                      p.esPresupuestoTrabajoExtra === 'V';
                return esTrabajoExtra;
              }).length;

              const obrasPrincipales = presupuestosSeleccionadosArray.filter(p => {
                const esTareaLeve = p.tipoPresupuesto === 'TAREA_LEVE' || p.tipo_presupuesto === 'TAREA_LEVE' ||
                                   p.tipo_origen === 'TAREA_LEVE' || p.tipoOrigen === 'TAREA_LEVE' ||
                                   p.tipo === 'TAREA_LEVE';
                const esTrabajoExtra = p.esTrabajoExtra === true ||
                                      p.esPresupuestoTrabajoExtra === true ||
                                      p.esPresupuestoTrabajoExtra === 'V';
                return !p.esObraIndependiente && !esTareaLeve && !esTrabajoExtra;
              }).length;

              const obrasIndependientes = presupuestosSeleccionadosArray.filter(p => p.esObraIndependiente).length;

              return (
                <>
                  {obrasPrincipales > 0 && (
                    <span className="ms-2 badge bg-light text-dark">
                      {obrasPrincipales} Obra{obrasPrincipales !== 1 ? 's' : ''} Principal{obrasPrincipales !== 1 ? 'es' : ''}
                    </span>
                  )}
                  {obrasIndependientes > 0 && (
                    <span className="ms-2 badge bg-secondary text-white">
                      {obrasIndependientes} Trabajo{obrasIndependientes !== 1 ? 's' : ''} Diario{obrasIndependientes !== 1 ? 's' : ''}
                    </span>
                  )}
                  {adicionalesObra > 0 && (
                    <span className="ms-2 badge bg-warning text-dark">
                      {adicionalesObra} Adicional{adicionalesObra !== 1 ? 'es' : ''} Obra
                    </span>
                  )}
                  {tareaLeves > 0 && (
                    <span className="ms-2 badge bg-info text-white">
                      {tareaLeves} Tarea{tareaLeves !== 1 ? 's' : ''} Leve{tareaLeves !== 1 ? 's' : ''}
                    </span>
                  )}
                  {trabajosAdicionalesSeleccionados.size > 0 && (
                    <span className="ms-2 badge bg-success text-white">
                      {trabajosAdicionalesSeleccionados.size} Tarea{trabajosAdicionalesSeleccionados.size !== 1 ? 's' : ''} Adicional{trabajosAdicionalesSeleccionados.size !== 1 ? 'es' : ''}
                    </span>
                  )}
                </>
              );
            })()}
          </h5>
          <div className="btn-group btn-group-sm">
            <button
              className="btn btn-light btn-sm"
              onClick={(e) => {
                e.preventDefault();
                e.target.blur();
                seleccionarTodasObras();
              }}
              title="Seleccionar todas"
            >
              <i className="bi bi-check-all"></i> Todas
            </button>
            <button
              className="btn btn-outline-light btn-sm"
              onClick={(e) => {
                e.preventDefault();
                e.target.blur();
                deseleccionarTodasObras();
              }}
              title="Deseleccionar todas"
            >
              <i className="bi bi-x"></i> Ninguna
            </button>
          </div>
        </div>
        <div className="card-body p-0">
          <div
            ref={scrollContainerRef}
            className="table-responsive"
            style={{
              maxHeight: '400px',
              overflowY: 'auto',
              scrollBehavior: 'auto',
              scrollSnapType: 'none',
              overscrollBehavior: 'none'
            }}
          >
            <table className="table table-hover mb-0">
              <thead className="table-light sticky-top">
                <tr>
                  <th style={{width: '50px'}} className="text-center">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={obrasSeleccionadas.size === obrasDisponibles.length}
                      tabIndex="-1"
                      onFocus={(e) => e.target.blur()}
                      onChange={(e) => {
                        e.preventDefault();
                        if (e.target.checked) {
                          seleccionarTodasObras();
                        } else {
                          deseleccionarTodasObras();
                        }
                      }}
                    />
                  </th>
                  <th>Obra</th>
                  <th>Dirección</th>
                  <th className="text-center">Estado</th>
                  <th className="text-center">Versión</th>
                  <th className="text-end">Presupuesto</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // 🎯 AGRUPAMIENTO igual que en ObrasPage
                  // 🔥 DEDUPLICAR obras por ID antes de procesarlas
                  const obrasDeduplicadas = obrasDisponibles.filter((obra, index, self) =>
                    index === self.findIndex((o) => o.id === obra.id)
                  );

                  // 🔧 Excluir Tareas Leves del listado de obras normales (se agrupan bajo su obra padre)
                  const obrasNormales = obrasDeduplicadas.filter(o => {
                    if (o.esTrabajoExtra) return false;
                    if (o.estado === 'CANCELADO') return false;
                    // Excluir Tareas Leves (se agrupan bajo su obra padre)
                    const esTareaLeve = o.presupuestoCompleto?.tipoPresupuesto === 'TAREA_LEVE' ||
                                       o.presupuestoCompleto?.tipo_presupuesto === 'TAREA_LEVE' ||
                                       o.presupuestoCompleto?.tipo_origen === 'TAREA_LEVE' ||
                                       o.presupuestoCompleto?.tipoOrigen === 'TAREA_LEVE' ||
                                       o.tipo_origen === 'TAREA_LEVE' ||
                                       o.tipoOrigen === 'TAREA_LEVE';
                    if (esTareaLeve) return false;
                    return true;
                  }).sort((a, b) => a.id - b.id);

                  // 🆕 Extraer Tareas Leves de obrasDeduplicadas
                  const tareasLeves = obrasDeduplicadas.filter(o => {
                    const esTareaLeve = o.presupuestoCompleto?.tipoPresupuesto === 'TAREA_LEVE' ||
                                       o.presupuestoCompleto?.tipo_presupuesto === 'TAREA_LEVE' ||
                                       o.presupuestoCompleto?.tipo_origen === 'TAREA_LEVE' ||
                                       o.presupuestoCompleto?.tipoOrigen === 'TAREA_LEVE' ||
                                       o.tipo_origen === 'TAREA_LEVE' ||
                                       o.tipoOrigen === 'TAREA_LEVE';
                    return esTareaLeve && o.estado !== 'CANCELADO';
                  });

                  const obrasCanceladas = obrasDeduplicadas.filter(o => o.estado === 'CANCELADO');

                  const listaOrdenada = [];
                  let grupoIndex = 0;

                  // Agregar obras normales CON sus trabajos extra Y tareas leves expandidos
                  obrasNormales.forEach(obra => {
                    const tieneSubObras = obra.trabajosExtra && obra.trabajosExtra.length > 0;

                    // 🆕 Buscar Tareas Leves de esta obra (usando criterios de ObrasPage)
                    const tareasLevesObra = tareasLeves.filter(tl => {
                      // Verificar si esta tarea leve pertenece a la obra padre
                      const padreIdExplicito = tl.presupuestoCompleto?.obraPadreId ||
                                              tl.presupuestoCompleto?.obra_padre_id ||
                                              tl.presupuestoCompleto?.idObraPadre;
                      const origenId = tl.presupuestoCompleto?.obraOrigenId ||
                                      tl.presupuestoCompleto?.obra_origen_id;

                      // Comparar con obra.id (ID de la obra en tabla obras)
                      if (padreIdExplicito === obra.id || origenId === obra.id) {
                        return true;
                      }

                      // Fallback: por nombre
                      const nombrePadre = (obra.nombreObra || '').trim();
                      const nombreTL = (tl.nombreObra || '').trim();
                      if (nombrePadre && nombreTL.startsWith(nombrePadre + ' ')) {
                        return true;
                      }

                      return false;
                    });

                    // Contar trabajos adicionales de la obra (NO Tareas Leves - son entidad diferente)
                    const trabajosAdicionalesObra = trabajosAdicionalesDisponibles.filter(ta => {
                      const obraOrigenId = ta.obraOrigenId || ta.obra_origen_id || ta.obraPadreId || ta.obra_padre_id;
                      const perteneceAEstaObra = obraOrigenId === obra.obraId || obraOrigenId === obra.id;
                      const noEsDeTrabajoExtra = !ta.trabajoExtraId;
                      return perteneceAEstaObra && noEsDeTrabajoExtra;
                    });

                    let totalTrabajosAdicionales = trabajosAdicionalesObra.length;

                    let totalEnGrupo = 1 + (obra.trabajosExtra?.length || 0) + trabajosAdicionalesObra.length + tareasLevesObra.length;

                    // Si hay trabajos extra, contar sus trabajos adicionales y tareas leves
                    if (tieneSubObras) {
                      obra.trabajosExtra.forEach(te => {
                        // 🔧 Buscar tareas leves vinculadas al trabajo extra
                        const tareasLevesTE = tareasLeves.filter(tl => {
                          const padreIdExplicito = tl.presupuestoCompleto?.obraPadreId ||
                                                  tl.presupuestoCompleto?.obra_padre_id ||
                                                  tl.presupuestoCompleto?.idObraPadre;
                          const origenId = tl.presupuestoCompleto?.obraOrigenId ||
                                          tl.presupuestoCompleto?.obra_origen_id;
                          return padreIdExplicito === te.id || origenId === te.id || padreIdExplicito === te.obraId || origenId === te.obraId;
                        });

                        // 🔧 Buscar trabajos adicionales del trabajo extra (si existen)
                        const trabajosAdicionalesTE = trabajosAdicionalesDisponibles.filter(ta => {
                          const obraOrigenId = ta.obraOrigenId || ta.obra_origen_id || ta.obraPadreId || ta.obra_padre_id;
                          return obraOrigenId === te.obraId || obraOrigenId === te.id;
                        });
                        totalTrabajosAdicionales += trabajosAdicionalesTE.length;
                        totalEnGrupo += trabajosAdicionalesTE.length + tareasLevesTE.length;
                      });
                    }

                    // Agregar OBRA PADRE
                    listaOrdenada.push({
                      ...obra,
                      _grupoIndex: grupoIndex,
                      _primerEnGrupo: true,
                      _ultimoEnGrupo: totalEnGrupo === 1,
                      _totalEnGrupo: totalEnGrupo,
                      _esObraPrincipal: true,
                      _esTrabajoExtra: false,
                      _esTrabajoAdicional: false
                    });

                    // Agregar TRABAJOS EXTRA como filas separadas
                    if (tieneSubObras) {
                      obra.trabajosExtra.sort((a, b) => a.id - b.id);
                      obra.trabajosExtra.forEach((trabajo, idx) => {
                        // 🔧 Buscar tareas leves vinculadas al trabajo extra
                        const trabajosAdicionalesTE = trabajosAdicionalesDisponibles.filter(ta => {
                          const obraOrigenId = ta.obraOrigenId || ta.obra_origen_id || ta.obraPadreId || ta.obra_padre_id;
                          return obraOrigenId === trabajo.obraId || obraOrigenId === trabajo.id;
                        });
                        const esUltimoTE = idx === obra.trabajosExtra.length - 1;
                        const tieneTA = trabajosAdicionalesTE.length > 0;

                        listaOrdenada.push({
                          ...trabajo,
                          obraPadreNombre: obra.nombreObra,
                          obraPadreCalle: obra.calle,
                          obraPadreAltura: obra.altura,
                          obraPadreBarrio: obra.barrio,
                          _grupoIndex: grupoIndex,
                          _primerEnGrupo: false,
                          _ultimoEnGrupo: esUltimoTE && !tieneTA && trabajosAdicionalesObra.length === 0,
                          _totalEnGrupo: totalEnGrupo,
                          _esObraPrincipal: false,
                          _esTrabajoExtra: true,
                          _esTrabajoAdicional: false
                        });

                        // Agregar trabajos adicionales de este trabajo extra
                        if (tieneTA) {
                          trabajosAdicionalesTE.forEach((ta, taIdx) => {
                            listaOrdenada.push({
                              ...ta,
                              obraPadreNombre: obra.nombreObra,
                              trabajoExtraPadreNombre: trabajo.nombre,
                              _grupoIndex: grupoIndex,
                              _primerEnGrupo: false,
                              _ultimoEnGrupo: esUltimoTE && taIdx === trabajosAdicionalesTE.length - 1 && trabajosAdicionalesObra.length === 0,
                              _totalEnGrupo: totalEnGrupo,
                              _esObraPrincipal: false,
                              _esTrabajoExtra: false,
                              _esTrabajoAdicional: true,
                              _perteneceTrabajoExtra: true
                            });
                          });
                        }
                      });
                    }

                    // Agregar trabajos adicionales de la obra (no pertenecen a trabajo extra)
                    if (trabajosAdicionalesObra.length > 0) {
                      trabajosAdicionalesObra.forEach((ta, taIdx) => {
                        listaOrdenada.push({
                          ...ta,
                          obraPadreNombre: obra.nombreObra,
                          _grupoIndex: grupoIndex,
                          _primerEnGrupo: false,
                          _ultimoEnGrupo: tareasLevesObra.length === 0 && taIdx === trabajosAdicionalesObra.length - 1,
                          _totalEnGrupo: totalEnGrupo,
                          _esObraPrincipal: false,
                          _esTrabajoExtra: false,
                          _esTrabajoAdicional: true,
                          _perteneceTrabajoExtra: false
                        });
                      });
                    }

                    // 🆕 Agregar TAREAS LEVES de la obra (se renderizan como subgrupo colapsable)
                    if (tareasLevesObra.length > 0) {
                      tareasLevesObra.forEach((tl, tlIdx) => {
                        listaOrdenada.push({
                          ...tl,
                          obraPadreNombre: obra.nombreObra,
                          _grupoIndex: grupoIndex,
                          _primerEnGrupo: false,
                          _ultimoEnGrupo: tlIdx === tareasLevesObra.length - 1,
                          _totalEnGrupo: totalEnGrupo,
                          _esObraPrincipal: false,
                          _esTrabajoExtra: false,
                          _esTrabajoAdicional: false,
                          _esTareaLeve: true,  // 🔑 Flag para identificar Tareas Leves
                          _perteneceTrabajoExtra: false
                        });
                      });
                    }

                    grupoIndex++;
                  });

                  // Agregar obras canceladas con la misma lógica
                  obrasCanceladas.forEach(oc => {
                    const tieneTrabajosExtra = oc.trabajosExtra && oc.trabajosExtra.length > 0;
                    // 🔧 Buscar por obraOrigenId o obra_origen_id (relación padre-hijo)
                    const trabajosAdicionalesObra = trabajosAdicionalesDisponibles.filter(ta => {
                      const obraOrigenId = ta.obraOrigenId || ta.obra_origen_id || ta.obraPadreId || ta.obra_padre_id;
                      const perteneceAEstaObra = obraOrigenId === oc.obraId || obraOrigenId === oc.id;
                      const noEsDeTrabajoExtra = !ta.trabajoExtraId;
                      return perteneceAEstaObra && noEsDeTrabajoExtra;
                    });

                    let totalEnGrupo = 1 + (oc.trabajosExtra?.length || 0) + trabajosAdicionalesObra.length;

                    if (tieneTrabajosExtra) {
                      oc.trabajosExtra.forEach(te => {
                        // 🔧 Buscar tareas leves vinculadas al trabajo extra
                        const trabajosAdicionalesTE = trabajosAdicionalesDisponibles.filter(ta => {
                          const obraOrigenId = ta.obraOrigenId || ta.obra_origen_id || ta.obraPadreId || ta.obra_padre_id;
                          return obraOrigenId === te.obraId || obraOrigenId === te.id;
                        });
                        totalEnGrupo += trabajosAdicionalesTE.length;
                      });
                    }

                    listaOrdenada.push({
                      ...oc,
                      _grupoIndex: grupoIndex,
                      _primerEnGrupo: true,
                      _ultimoEnGrupo: totalEnGrupo === 1,
                      _totalEnGrupo: totalEnGrupo,
                      _esObraPrincipal: true,
                      _esTrabajoExtra: false,
                      _esTrabajoAdicional: false
                    });

                    if (tieneTrabajosExtra) {
                      oc.trabajosExtra.forEach((trabajo, idx) => {
                        // 🔧 Buscar tareas leves vinculadas al trabajo extra
                        const trabajosAdicionalesTE = trabajosAdicionalesDisponibles.filter(ta => {
                          const obraOrigenId = ta.obraOrigenId || ta.obra_origen_id || ta.obraPadreId || ta.obra_padre_id;
                          return obraOrigenId === trabajo.obraId || obraOrigenId === trabajo.id;
                        });
                        const esUltimoTE = idx === oc.trabajosExtra.length - 1;
                        const tieneTA = trabajosAdicionalesTE.length > 0;

                        listaOrdenada.push({
                          ...trabajo,
                          obraPadreNombre: oc.nombreObra,
                          _grupoIndex: grupoIndex,
                          _primerEnGrupo: false,
                          _ultimoEnGrupo: esUltimoTE && !tieneTA && trabajosAdicionalesObra.length === 0,
                          _totalEnGrupo: totalEnGrupo,
                          _esObraPrincipal: false,
                          _esTrabajoExtra: true,
                          _esTrabajoAdicional: false
                        });

                        // Agregar trabajos adicionales de este trabajo extra
                        if (tieneTA) {
                          trabajosAdicionalesTE.forEach((ta, taIdx) => {
                            listaOrdenada.push({
                              ...ta,
                              obraPadreNombre: oc.nombreObra,
                              trabajoExtraPadreNombre: trabajo.nombre,
                              _grupoIndex: grupoIndex,
                              _primerEnGrupo: false,
                              _ultimoEnGrupo: esUltimoTE && taIdx === trabajosAdicionalesTE.length - 1 && trabajosAdicionalesObra.length === 0,
                              _totalEnGrupo: totalEnGrupo,
                              _esObraPrincipal: false,
                              _esTrabajoExtra: false,
                              _esTrabajoAdicional: true,
                              _perteneceTrabajoExtra: true
                            });
                          });
                        }
                      });
                    }

                    // Agregar trabajos adicionales de la obra cancelada
                    if (trabajosAdicionalesObra.length > 0) {
                      trabajosAdicionalesObra.forEach((ta, taIdx) => {
                        listaOrdenada.push({
                          ...ta,
                          obraPadreNombre: oc.nombreObra,
                          _grupoIndex: grupoIndex,
                          _primerEnGrupo: false,
                          _ultimoEnGrupo: taIdx === trabajosAdicionalesObra.length - 1,
                          _totalEnGrupo: totalEnGrupo,
                          _esObraPrincipal: false,
                          _esTrabajoExtra: false,
                          _esTrabajoAdicional: true,
                          _perteneceTrabajoExtra: false
                        });
                      });
                    }

                    grupoIndex++;
                  });

                  return listaOrdenada;
                })().map((item, index, array) => {
                  // Si es obra principal, renderizar como antes
                  // Si es trabajo extra, renderizar como sub-fila
                  // Si es trabajo adicional, renderizar como sub-sub-fila
                  const esObraPrincipal = item._esObraPrincipal;
                  const esTrabajoExtra = item._esTrabajoExtra;
                  const esTrabajoAdicional = item._esTrabajoAdicional;

                  const isSelected = esObraPrincipal
                    ? obrasSeleccionadas.has(item.id)
                    : esTrabajoExtra
                    ? trabajosExtraSeleccionados.has(item.id)
                    : esTrabajoAdicional
                    ? trabajosAdicionalesSeleccionados.has(item.id)
                    : false;
                  const direccion = esObraPrincipal
                    ? [item.calle, item.altura, item.barrio && `(${item.barrio})`].filter(Boolean).join(' ')
                    : null;

                  const presupuestoBase = esObraPrincipal
                    ? (item.totalPresupuesto || 0) // ✅ Usar totalPresupuesto que ya tiene descuentos calculados
                    : (item.totalCalculado || 0);

                  // 🎨 Determinar información de grupo para estilos visuales
                  const grupoIndex = item._grupoIndex || 0;
                  const totalEnGrupo = item._totalEnGrupo || 1;
                  const perteneceAGrupo = totalEnGrupo > 1;

                  // 🔥 Verificar si es un cambio de grupo
                  const esCambioDeGrupo = index > 0 && (
                    array[index - 1]._grupoIndex !== item._grupoIndex
                  );

                  // Colores alternados para grupos
                  const coloresGrupo = [
                    '#e9ecef', // Gris claro
                    '#d1e7ff', // Azul claro
                    '#ffe8cc', // Naranja claro
                    '#d4edda', // Verde claro
                    '#f8d7da', // Rosa claro
                    '#e7d6ff'  // Púrpura claro
                  ];

                  // 💡 Función helper para ajustar brillo
                  const adjustColorBrightness = (color, percent) => {
                    const num = parseInt(color.replace("#", ""), 16);
                    const amt = Math.round(2.55 * percent);
                    const R = (num >> 16) + amt;
                    const G = (num >> 8 & 0x00FF) + amt;
                    const B = (num & 0x0000FF) + amt;
                    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
                      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
                      (B < 255 ? B < 1 ? 0 : B : 255))
                      .toString(16).slice(1);
                  };

                  // 🎨 Color base del grupo
                  const colorBaseGrupo = coloresGrupo[grupoIndex % coloresGrupo.length];

                  // Para trabajos extra y adicionales, usar colores más oscuros
                  let colorGrupo = '#ffffff';
                  if (perteneceAGrupo) {
                    if (esObraPrincipal) {
                      colorGrupo = colorBaseGrupo;
                    } else if (esTrabajoExtra) {
                      colorGrupo = adjustColorBrightness(colorBaseGrupo, -15);
                    } else if (esTrabajoAdicional) {
                      // Trabajos adicionales aún más oscuros
                      colorGrupo = adjustColorBrightness(colorBaseGrupo, -25);
                    }
                  }

                  // KEY único para cada fila
                  const key = esObraPrincipal
                    ? `obra-${item.id}`
                    : esTrabajoExtra
                    ? `te-${item.id}-${index}`
                    : `ta-${item.id}-${index}`;

                  return (
                    <React.Fragment key={key}>
                      {/* 🎨 Separador visual entre grupos */}
                      {esCambioDeGrupo && index > 0 && (
                        <tr style={{ height: '8px', backgroundColor: '#343a40' }}>
                          <td colSpan="6" style={{
                            padding: 0,
                            height: '8px',
                            borderTop: '3px solid #212529',
                            borderBottom: '3px solid #212529',
                            backgroundColor: '#495057'
                          }}></td>
                        </tr>
                      )}

                      {/* Renderizar OBRA PRINCIPAL */}
                      {esObraPrincipal && (
                        <tr
                          className={isSelected ? 'table-active' : ''}
                          style={{
                            backgroundColor: isSelected ? undefined : colorGrupo,
                            borderBottom: perteneceAGrupo ? '1px solid rgba(253, 126, 20, 0.45)' : undefined
                          }}
                        >
                          <td className="text-center">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={isSelected}
                              style={{ cursor: 'pointer' }}
                              onChange={() => toggleObraSeleccion(item.id)}
                            />
                          </td>
                          <td>
                            <strong>{item.nombreObra}</strong>
                            <br />
                            <small className="text-muted">
                              {item.esObraIndependiente ? (
                                <span className="badge bg-warning text-dark">
                                  <i className="bi bi-hand-thumbs-up me-1"></i>
                                  Trabajo Diario
                                </span>
                              ) : (
                                `#${item.numeroPresupuesto}`
                              )}
                            </small>
                          </td>
                          <td>
                            <small>{direccion}</small>
                          </td>
                          <td className="text-center">
                            <span className={`badge ${item.estado === 'APROBADO' ? 'bg-success' : 'bg-info'}`}>
                              {item.estado}
                            </span>
                          </td>
                          <td className="text-center">
                            {item.esObraIndependiente ? (
                              <span className="badge bg-secondary text-white">
                                <i className="bi bi-asterisk"></i> Sin versión
                              </span>
                            ) : (
                              <span className="badge bg-secondary">v{item.numeroVersion}</span>
                            )}
                          </td>
                          <td className="text-end">
                            <strong>{formatearMoneda(presupuestoBase)}</strong>
                            {item.esObraIndependiente && (
                              <div>
                                <small className="text-muted">
                                  <i className="bi bi-info-circle me-1"></i>
                                  Estimado
                                </small>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}

                      {/* ══════════════════════════════════════════════════
                          SUBGRUPO COLAPSABLE: TRABAJOS EXTRA, TAREAS LEVES Y ADICIONALES
                          (sólo se renderiza desde la fila principal)
                          ══════════════════════════════════════════════════ */}
                      {esObraPrincipal && (() => {
                        const extras     = array.filter(it => it._grupoIndex === grupoIndex && it._esTrabajoExtra);
                        const adicionales = array.filter(it => it._grupoIndex === grupoIndex && it._esTrabajoAdicional);
                        const tareasLeves = array.filter(it => it._grupoIndex === grupoIndex && it._esTareaLeve);
                        if (extras.length === 0 && adicionales.length === 0 && tareasLeves.length === 0) return null;

                        const renderSubgrupo = (items, claveGrupo, titulo, headerStyle, itemBorderLeft, tipoItem) => {
                          if (items.length === 0) return null;
                          const colapsado = !!gruposColapsadosSF[claveGrupo];
                          return (
                            <>
                              {/* Header subgrupo */}
                              <tr
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.currentTarget.blur();
                                  setGruposColapsadosSF(p => ({ ...p, [claveGrupo]: !p[claveGrupo] }));
                                }}
                                style={headerStyle}
                              >
                                <td colSpan="6" className="py-1 px-3 small">
                                  <span className="fw-bold" style={{ color: headerStyle.color || '#1d4ed8' }}>
                                    <i className={`fas fa-chevron-${colapsado ? 'right' : 'down'} me-2`} style={{ fontSize: '0.75em' }}></i>
                                    {titulo}
                                    <span className="badge ms-2" style={{ fontSize: '0.7em', backgroundColor: headerStyle.badgeColor || '#1d4ed8' }}>{items.length}</span>
                                  </span>
                                  <span className="text-muted ms-3 small">Clic para {colapsado ? 'mostrar' : 'ocultar'}</span>
                                </td>
                              </tr>
                              {/* Filas */}
                              {!colapsado && items.map((subItem, si) => {
                                let subIsSelected, subMonto, toggleFunction;

                                // Determinar selección y toggle según el tipo
                                if (tipoItem === 'extra') {
                                  subIsSelected = trabajosExtraSeleccionados.has(subItem.id);
                                  subMonto = subItem.totalCalculado || 0;
                                  toggleFunction = toggleTrabajoExtraSeleccion;
                                } else if (tipoItem === 'tareaLeve') {
                                  // 🐛 DEBUG: Log para diagnosticar Casa de Paula
                                  if (subItem.nombreObra && subItem.nombreObra.includes('Paula')) {
                                    console.log('🔍 Tarea Leve Paula:', {
                                      id: subItem.id,
                                      nombreObra: subItem.nombreObra,
                                      obrasSeleccionadas: Array.from(obrasSeleccionadas),
                                      estaSeleccionada: obrasSeleccionadas.has(subItem.id),
                                      presupuestoId: subItem.presupuestoCompleto?.id,
                                      obraId: subItem.obraId || subItem.id
                                    });
                                  }
                                  subIsSelected = obrasSeleccionadas.has(subItem.id);
                                  subMonto = subItem.totalPresupuesto || 0;
                                  toggleFunction = toggleObraSeleccion;
                                } else {
                                  // adicional
                                  subIsSelected = trabajosAdicionalesSeleccionados.has(subItem.id);
                                  subMonto = subItem.importe || 0;
                                  toggleFunction = toggleTrabajoAdicionalSeleccion;
                                }

                                return (
                                  <tr
                                    key={`sub_${tipoItem}_${subItem.id}_${si}`}
                                    className={subIsSelected ? 'table-active' : ''}
                                    style={{
                                      backgroundColor: subIsSelected ? undefined : adjustColorBrightness(colorBaseGrupo, tipoItem === 'extra' ? -15 : -25),
                                      borderLeft: itemBorderLeft,
                                      borderBottom: '1px solid rgba(253, 126, 20, 0.45)'
                                    }}
                                  >
                                    <td className="text-center">
                                      <input
                                        type="checkbox"
                                        className="form-check-input"
                                        checked={subIsSelected}
                                        style={{ cursor: 'pointer' }}
                                        onChange={() => toggleFunction(subItem.id)}
                                      />
                                    </td>
                                    <td colSpan="4" className="ps-3">
                                      {tipoItem === 'extra' ? (
                                        <small><strong>{subItem.nombre}</strong></small>
                                      ) : tipoItem === 'tareaLeve' ? (
                                        <small className="text-primary"><strong>{subItem.nombreObra}</strong></small>
                                      ) : (
                                        <>
                                          <small className="text-info"><strong>{subItem.nombre}</strong></small>
                                          {subItem._perteneceTrabajoExtra && subItem.trabajoExtraPadreNombre && (
                                            <small className="text-muted ms-2">(de {subItem.trabajoExtraPadreNombre})</small>
                                          )}
                                        </>
                                      )}
                                    </td>
                                    <td className="text-end">
                                      <small><strong>{formatearMoneda(subMonto)}</strong></small>
                                    </td>
                                  </tr>
                                );
                              })}
                            </>
                          );
                        };

                        return (
                          <>
                            {renderSubgrupo(
                              extras,
                              `extra_${grupoIndex}`,
                              '📋 Adicionales Obra',
                              { backgroundColor: '#fff3cd', cursor: 'pointer', borderLeft: '5px solid #ffc107', borderBottom: '1px solid rgba(253, 126, 20, 0.45)', color: '#856404', badgeColor: '#ffc107' },
                              '5px solid #ffc107',
                              'extra'
                            )}
                            {renderSubgrupo(
                              tareasLeves,
                              `tareaLeve_${grupoIndex}`,
                              '🔧 Tareas Leves',
                              { backgroundColor: '#d1ecf1', cursor: 'pointer', borderLeft: '5px solid #17a2b8', borderBottom: '1px solid rgba(253, 126, 20, 0.45)', color: '#0c5460', badgeColor: '#17a2b8' },
                              '5px solid #17a2b8',
                              'tareaLeve'
                            )}
                            {renderSubgrupo(
                              adicionales,
                              `adic_${grupoIndex}`,
                              '⚙️ Trabajos Adicionales',
                              { backgroundColor: '#dbeafe', cursor: 'pointer', borderLeft: '5px solid #1d4ed8', borderBottom: '1px solid rgba(253, 126, 20, 0.45)', color: '#1d4ed8', badgeColor: '#1d4ed8' },
                              '7px solid #fd7e14',
                              'adicional'
                            )}
                          </>
                        );
                      })()}

                      {/* Skip: extras, tareas leves y adicionales se renderizan dentro del subgrupo de su principal */}
                      {(esTrabajoExtra || esTrabajoAdicional || item._esTareaLeve) && null}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot className="table-light">
                <tr className="fw-bold">
                  <td colSpan="5" className="text-end">Total Seleccionado:</td>
                  <td className="text-end text-primary">
                      {(() => {
                        const presupuestosUnicos = new Map();
                        const obrasIndependientes = new Map(); // ✅ Para obras sin presupuesto
                        const tareasLeves = new Map(); // 🆕 Para tareas leves
                        const debugRows = [];
                        let totalTrabajosExtra = 0;
                        let totalTrabajosAdicionales = 0;

                        // 🔧 Filtrar igual que la tabla: sin trabajos extra, sin cancelados
                        obrasDisponibles
                          .filter(o => !o.esTrabajoExtra && o.estado !== 'CANCELADO')
                          .filter(o => obrasSeleccionadas.has(o.id))
                          .forEach(o => {
                            // ✅ CASO 1: Verificar si es obra independiente
                            if (o.esObraIndependiente) {
                              // Usar el ID de la obra como identificador único
                              if (!obrasIndependientes.has(o.id)) {
                                const monto = o.totalPresupuesto || 0; // Ya tiene el presupuestoEstimado
                                obrasIndependientes.set(o.id, monto);
                                debugRows.push(`OI-${o.id}: $${monto.toLocaleString()}`);
                              }
                              return; // No tiene trabajos extra ni presupuesto detallado
                            }

                            // ✅ CASO 2: Verificar si es Tarea Leve
                            const esTareaLeve = o.presupuestoCompleto?.tipoPresupuesto === 'TAREA_LEVE' ||
                                               o.presupuestoCompleto?.tipo_presupuesto === 'TAREA_LEVE' ||
                                               o.presupuestoCompleto?.tipo_origen === 'TAREA_LEVE' ||
                                               o.presupuestoCompleto?.tipoOrigen === 'TAREA_LEVE' ||
                                               o.tipo_origen === 'TAREA_LEVE' ||
                                               o.tipoOrigen === 'TAREA_LEVE';

                            if (esTareaLeve) {
                              if (!tareasLeves.has(o.id)) {
                                const monto = o.totalPresupuesto || 0;
                                tareasLeves.set(o.id, monto);
                                debugRows.push(`TL-${o.id}: $${monto.toLocaleString()}`);
                              }
                              return; // No procesar como obra principal
                            }

                            // ✅ CASO 3: Obras con presupuesto (lógica existente)
                            const idPresupuesto = o.presupuestoCompleto?.id
                              ?? o.presupuestoNoClienteId
                              ?? o.presupuesto_no_cliente_id
                              ?? o.presupuestoNoCliente?.id;
                            if (!idPresupuesto) return;
                            if (!presupuestosUnicos.has(idPresupuesto)) {
                              // ✅ USAR totalPresupuesto que ya incluye descuentos calculados
                              const monto = o.totalPresupuesto || 0;
                              presupuestosUnicos.set(idPresupuesto, monto);
                              debugRows.push(`${idPresupuesto}: $${monto.toLocaleString()}`);
                            }

                            // Solo sumar trabajos extra que estén seleccionados
                            if (o.trabajosExtra && o.trabajosExtra.length > 0) {
                              const trabajosExtraSeleccionadosDeEstaObra = o.trabajosExtra.filter(te => trabajosExtraSeleccionados.has(te.id));
                              const totalTE = trabajosExtraSeleccionadosDeEstaObra.reduce((sum, t) => sum + (t.totalCalculado || 0), 0);
                              totalTrabajosExtra += totalTE;
                            }
                          });

                        // Sumar trabajos adicionales seleccionados
                        const trabajosAdicionalesSeleccionadosArray = trabajosAdicionalesDisponibles
                          .filter(ta => trabajosAdicionalesSeleccionados.has(ta.id));
                        totalTrabajosAdicionales = trabajosAdicionalesSeleccionadosArray.reduce((sum, ta) => sum + (ta.importe || 0), 0);

                        // ✅ Calcular totales
                        const totalPresupuestos = Array.from(presupuestosUnicos.values()).reduce((sum, val) => sum + val, 0);
                        const totalIndependientes = Array.from(obrasIndependientes.values()).reduce((sum, val) => sum + val, 0);
                        const totalTareasLevesCalc = Array.from(tareasLeves.values()).reduce((sum, val) => sum + val, 0); // 🆕 Total tareas leves
                        const totalCompleto = totalPresupuestos + totalIndependientes + totalTareasLevesCalc + totalTrabajosExtra + totalTrabajosAdicionales;

                        return (
                          <>
                            {formatearMoneda(totalCompleto)}
                            <div style={{fontSize: '0.8em', color: '#888', marginTop: 4}}>
                              <span>IDs sumados: </span>
                              {debugRows.join(' | ')}
                              {totalTrabajosExtra > 0 && ` + Adic.Obra: $${totalTrabajosExtra.toLocaleString()}`}
                              {totalTrabajosAdicionales > 0 && ` + TrabAdicionales: $${totalTrabajosAdicionales.toLocaleString()}`}
                            </div>
                          </>
                        );
                      })()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    );
  };

  if (!empresaSeleccionada) {
    return (
      <div className="container-fluid mt-4">
        <div className="alert alert-warning">
          <h4>⚠️ No hay empresa seleccionada</h4>
          <p>Por favor, selecciona una empresa para acceder al sistema financiero.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid mt-4">
      {/* Notificaciones */}
      {notification && (
        <NotificationToast
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      {/* Header */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card border-primary shadow">
            <div className="card-body">
              <h1 className="display-6 mb-3">
                💰 Pagos - Cobros
              </h1>

              <hr className="my-3" />

              {/* Modo Consolidado - Siempre Activo */}
              <>
                  <div className="alert alert-info mb-3">
                    <h5 className="alert-heading mb-2">
                      <i className="bi bi-globe me-2"></i>
                      Seleccione una, Varias o todas las Obras
                    </h5>
                  </div>

                  {/* 🆕 Selector de obras para modo consolidado */}
                  <ObrasSelector />

                  {/* Panel de Detalle deshabilitado */}

                </>
            </div>
          </div>
        </div>
      </div>

      {/* Panel de Estadísticas Consolidadas - Visible cuando está activo el modo consolidado */}
      {(() => {
        console.log('🎨 [Render] Tarjetas consolidadas:', {
          modoConsolidado,
          obrasDisponibles: obrasDisponibles.length,
          obrasSeleccionadas: obrasSeleccionadas.size,
          renderizarTarjetas: modoConsolidado
        });
        return null;
      })()}

      {modoConsolidado && (() => {
        // Definir statsFinales en el scope del render para que esté disponible en el bloque de tarjetas
        const todasSeleccionadas = obrasSeleccionadas.size === obrasDisponibles.length;
        const ningunnaSeleccionada = obrasSeleccionadas.size === 0;
        const seleccionParcial = !todasSeleccionadas && !ningunnaSeleccionada;
        const usarSeleccionadas = seleccionParcial && !loadingSeleccionadas && estadisticasSeleccionadas?.totalPresupuesto > 0;
        const stats = usarSeleccionadas ? estadisticasSeleccionadas : estadisticasConsolidadas;
        const loading = usarSeleccionadas ? loadingSeleccionadas : loadingConsolidadas;
        const error = usarSeleccionadas ? errorSeleccionadas : errorConsolidadas;
        const statsFinales = estadisticasPersonalizadas;

        return (
        <div className="row mb-4">
          <div className="col-12">
            <div className="card border-primary shadow">
              <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                  <i className="bi bi-globe me-2"></i>
                  Resumen Financiero Consolidado - {estadisticasConsolidadas.cantidadObras} Obra(s)
                </h5>
                <button
                  className="btn btn-sm btn-light"
                  onClick={() => setShowConsolidarPagosGeneral(true)}
                  title="Ver detalle consolidado completo"
                >
                  <i className="bi bi-arrows-fullscreen me-1"></i>
                  Detalle Completo
                </button>
              </div>
              <div className="card-body">
                {/* Manejo de loading y error fuera del return JSX */}
                {loading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Cargando estadísticas...</span>
                    </div>
                    <p className="text-muted mt-2 small">
                      {usarSeleccionadas
                        ? `Consolidando datos de ${obrasSeleccionadas.size} obra(s) seleccionada(s)...`
                        : 'Consolidando datos de todas las obras...'}
                    </p>
                  </div>
                ) : error ? (
                  <div className="alert alert-warning mb-0">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    {error}
                  </div>
                ) : (
                  <>
                      {/* Primera fila: 4 tarjetas principales */}
                      <div className="row g-3 text-center mb-3">
                        <div className="col-sm-6 col-xl-3">
                          <div
                            className="sf-summary-card sf-summary-card--info"
                            onClick={() => abrirDesglose('presupuestos', '📋 Desglose de Presupuestos por Obra')}
                            style={{cursor: 'pointer'}}
                          >
                            <i className="bi bi-cash-stack fs-1 text-info"></i>
                            <h6 className="text-muted mt-2 mb-1">Total Presupuestado</h6>
                            <h4 className="text-info mb-0">
                              {formatearMoneda(statsFinales.totalPresupuesto)}
                            </h4>
                            <small className="text-muted">
                              De {statsFinales.cantidadObras} obra(s)
                              {trabajosExtraSeleccionados.size > 0 ? ` + ${trabajosExtraSeleccionados.size} TE` : ''}
                              {trabajosAdicionalesSeleccionados.size > 0 ? ` + ${trabajosAdicionalesSeleccionados.size} TA` : ''}
                            </small>
                            <div className="mt-1">
                              <small className="text-info"><i className="bi bi-hand-index"></i></small>
                            </div>
                          </div>
                        </div>
                        <div className="col-sm-6 col-xl-3">
                          <div
                            className="sf-summary-card sf-summary-card--success"
                            onClick={() => abrirDesglose('cobros', '💵 Desglose de Cobros por Obra')}
                            style={{cursor: 'pointer'}}
                          >
                            <i className="bi bi-arrow-down-circle fs-1 text-success"></i>
                            <h6 className="text-muted mt-2 mb-1">Total Cobrado</h6>
                            <h4 className="text-success mb-0">
                              ${(statsFinales.totalCobradoEmpresa || statsFinales.totalCobrado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </h4>
                            <small className="text-muted">
                              {((statsFinales.totalCobradoEmpresa || statsFinales.totalCobrado || 0) / (statsFinales.totalPresupuesto || 1) * 100).toFixed(1)}% del presupuesto total
                            </small>
                            <div className="mt-1">
                              <small className="text-success"><i className="bi bi-hand-index"></i></small>
                            </div>
                          </div>
                        </div>
                        <div className="col-sm-6 col-xl-3">
                          <div
                            className="sf-summary-card sf-summary-card--danger"
                            onClick={() => abrirDesglose('pagos', '💸 Desglose de Pagos por Obra')}
                            style={{cursor: 'pointer'}}
                          >
                            <i className="bi bi-arrow-up-circle fs-1 text-danger"></i>
                            <h6 className="text-muted mt-2 mb-1">Total Pagado</h6>
                            <h4 className="text-danger mb-0">
                              ${(statsFinales.totalPagado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </h4>
                            <small className="text-muted">
                              {((statsFinales.totalPagado || 0) / (statsFinales.totalPresupuesto || 1) * 100).toFixed(1)}% del presupuesto total
                            </small>
                            <div className="mt-1">
                              <small className="text-danger"><i className="bi bi-hand-index"></i></small>
                            </div>
                          </div>
                        </div>
                        <div className="col-sm-6 col-xl-3">
                          <div
                            className="sf-summary-card sf-summary-card--warning"
                            onClick={() => setShowListarRetiros(true)}
                            style={{cursor: 'pointer'}}
                          >
                            <i className="bi bi-wallet2 fs-1 text-warning"></i>
                            <h6 className="text-muted mt-2 mb-1">Total Retirado</h6>
                            <h4 className="text-warning mb-0">
                              ${(statsFinales.totalRetirado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </h4>
                            <small className="text-muted">
                              Retiros personales
                            </small>
                            <div className="mt-1">
                              <small className="text-warning"><i className="bi bi-hand-index"></i></small>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-start align-items-lg-center gap-2 mb-3">
                        <div>
                          <h6 className="mb-1 text-dark">Balance y disponibilidad</h6>
                          <small className="text-muted">Métricas secundarias para seguimiento operativo</small>
                        </div>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-2"
                          onClick={() => setSeccionBalanceExpandida(prev => !prev)}
                        >
                          <i className={`bi bi-chevron-${seccionBalanceExpandida ? 'up' : 'down'}`}></i>
                          {seccionBalanceExpandida ? 'Ocultar balance extendido' : 'Ver balance extendido'}
                        </button>
                      </div>

                      {seccionBalanceExpandida && (
                      <div className="row g-3 text-center">
                        <div className="col-sm-6 col-xl-3">
                          <div
                            className="sf-summary-card sf-summary-card--amber"
                            onClick={() => abrirDesglose('saldoPorCobrar', '⏳ Desglose de Saldo por Cobrar por Obra')}
                            style={{cursor: 'pointer'}}
                          >
                            <i className="bi bi-hourglass-split fs-1 text-warning"></i>
                            <h6 className="text-muted mt-2 mb-1">Saldo por Cobrar</h6>
                            <h4 className="text-warning mb-0">
                              {formatearMoneda(statsFinales.totalPresupuesto - (statsFinales.totalCobradoEmpresa || statsFinales.totalCobrado || 0))}
                            </h4>
                            <small className="text-muted">
                              Falta cobrar {(
                                statsFinales.totalPresupuesto > 0
                                  ? (100 * (statsFinales.totalPresupuesto - (statsFinales.totalCobradoEmpresa || statsFinales.totalCobrado || 0)) / statsFinales.totalPresupuesto)
                                  : 0
                              ).toFixed(1)}% del presupuesto
                            </small>
                            <div className="mt-1">
                              <small className="text-warning"><i className="bi bi-hand-index"></i></small>
                            </div>
                          </div>
                        </div>
                        <div className="col-sm-6 col-xl-3">
                          <div
                            className="sf-summary-card sf-summary-card--primary"
                            onClick={() => setShowDistribucionCobros(true)}
                            style={{cursor: 'pointer'}}
                          >
                            <i className="bi bi-bank fs-1 text-info"></i>
                            <h6 className="text-muted mt-2 mb-1">Total Distribuido Obras</h6>
                            <h4 className="text-primary mb-0">
                              {formatearMoneda((statsFinales.totalAsignado || 0) + totalAsignadoTAOI)}
                            </h4>
                            <small className="text-muted">
                              Obras principales, TE, OI y TA
                            </small>
                            <div className="mt-1">
                              <small className="text-info"><i className="bi bi-hand-index"></i></small>
                            </div>
                          </div>
                        </div>
                        <div className="col-sm-6 col-xl-3">
                          <div
                            className="sf-summary-card sf-summary-card--sky"
                            onClick={() => abrirDesglose('saldoDisponible', '💰 Desglose de Saldo Disponible')}
                            style={{cursor: 'pointer'}}
                          >
                            <i className="bi bi-piggy-bank fs-1 text-primary"></i>
                            <h6 className="text-muted mt-2 mb-1">Total disponible de lo ya cobrado</h6>
                            <h4 className="mb-0 text-primary">
                              {(() => {
                                // Total cobrado menos asignado, pagado y retirado
                                if (loading) {
                                  return <span className="spinner-border spinner-border-sm" role="status"></span>;
                                }

                                // Calcular: Total Cobrado - Total Asignado - Total Pagado - Total Retirado
                                const totalCobrado = statsFinales.totalCobradoEmpresa || statsFinales.totalCobrado || 0;
                                const totalAsignado = (statsFinales.totalAsignado || 0) + totalAsignadoTAOI;
                                const totalPagado = statsFinales.totalPagado || 0;
                                const totalRetirado = statsFinales.totalRetirado || 0;
                                const saldoDisponible = totalCobrado - totalAsignado - totalPagado - totalRetirado;

                                return formatearMoneda(saldoDisponible);
                              })()}
                            </h4>
                            <small className="text-muted">Cobrado - Asignado - Pagado - Retirado</small>
                            <div className="mt-1">
                              <small className="text-primary"><i className="bi bi-hand-index"></i></small>
                            </div>
                          </div>
                        </div>
                        <div className="col-sm-6 col-xl-3">
                          <div
                            className="sf-summary-card sf-summary-card--danger-soft"
                            onClick={() => abrirDesglose('deficit', '⚠️ Desglose de Déficit por Obra')}
                            style={{cursor: 'pointer'}}
                          >
                            <i className="bi bi-exclamation-triangle fs-1 text-danger"></i>
                            <h6 className="text-muted mt-2 mb-1">Déficit</h6>
                            <h4 className="mb-0 text-danger">
                              {(() => {
                                // Usar statsFinales que ya tiene el cálculo personalizado
                                const desglose = statsFinales?.desglosePorObra || [];

                                const deficitTotal = desglose.reduce((sum, obra) => {
                                  // ✅ Solo considerar obras con cobros asignados
                                  if ((obra.totalCobrado || 0) === 0) return sum;

                                  const balance = (obra.totalCobrado || 0) - (obra.totalPagado || 0) - (obra.totalRetirado || 0);
                                  return balance < 0 ? sum + balance : sum;
                                }, 0);
                                return formatearMoneda(Math.abs(deficitTotal));
                              })()}
                            </h4>
                            <small className="text-muted">Déficit de obras individuales</small>
                            <div className="mt-1">
                              <small className="text-danger"><i className="bi bi-hand-index"></i></small>
                            </div>
                          </div>
                        </div>
                      </div>
                      )}

                      {/* COMENTADO: Sección de Alertas Financieras */}
                      {/* {statsFinales.alertas && statsFinales.alertas.length > 0 && (
                        <div className="mt-4">
                          <h6 className="text-muted mb-3">
                            <i className="bi bi-bell-fill me-2"></i>
                            Alertas {usarSeleccionadas ? 'de Obras Seleccionadas' : 'Consolidadas'} ({statsFinales.alertas.length})
                          </h6>
                          <div className="row">
                            {statsFinales.alertas.map((alerta, index) => (
                              <div key={index} className="col-md-6 mb-2">
                                <div className={`alert alert-${alerta.tipo} mb-0 py-2`}>
                                  <div className="d-flex align-items-start">
                                    <span className="fs-4 me-2">{alerta.icono}</span>
                                    <div className="flex-grow-1">
                                      <strong className="d-block">{alerta.titulo}</strong>
                                      <small className="d-block">{alerta.mensaje}</small>
                                      {alerta.accion && (
                                        <small className="d-block mt-1 fst-italic">
                                          <i className="bi bi-lightbulb me-1"></i>
                                          {alerta.accion}
                                        </small>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )} */}


                    {statsFinales.alertas && statsFinales.alertas.length === 0 && (
                      <div className="mt-3 text-center">
                        <p className="text-success small mb-0">
                          <i className="bi bi-check-circle-fill me-1"></i>
                          <strong>Todo en orden:</strong> No hay alertas financieras en este momento
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      );
      })()}

      {/* Sección de Cobros */}
      <div className="row mb-4">
        <div className="col-12">
          <div
            className="d-flex justify-content-between align-items-center mb-3 p-3 bg-light rounded cursor-pointer"
            onClick={() => setSeccionCobrosExpandida(!seccionCobrosExpandida)}
            style={{ cursor: 'pointer' }}
          >
            <h3 className="mb-0">💰 Gestión de Cobros de Obra</h3>
            <i className={`bi bi-chevron-${seccionCobrosExpandida ? 'up' : 'down'} fs-4`}></i>
          </div>
        </div>

        {seccionCobrosExpandida && (
          <>
        <div className="col-md-6 mb-3">
          <div className="card h-100 border-primary shadow-sm hover-shadow">
            <div className="card-header bg-primary text-white">
              <h5 className="mb-0">
                <i className="bi bi-cash-coin"></i> Gestión de Cobros
              </h5>
            </div>
            <div className="card-body">
              <div className="d-grid gap-2">
                <button
                  className="btn btn-info text-white"
                  onClick={() => setShowRegistrarNuevoCobro(true)}
                >
                  <i className="bi bi-plus-circle"></i> Registrar Nuevo Cobro
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowAsignarCobroDisponible(true)}
                >
                  <i className="bi bi-arrow-down-circle"></i> Asignar Saldo Disponible
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 mb-3">
          <div className="card h-100 border-info shadow-sm hover-shadow">
            <div className="card-header bg-info text-white">
              <h5 className="mb-0">
                <i className="bi bi-list-check"></i> Listar Cobros
              </h5>
            </div>
            <div className="card-footer bg-transparent">
              <button
                className="btn btn-outline-info w-100"
                onClick={() => setShowListarCobros(true)}
              >
                <i className="bi bi-list-ul"></i> Abrir Tarjeta
              </button>
            </div>
          </div>
        </div>
          </>
        )}
      </div>

      {/* Sección de Pagos */}
      <div className="row mb-4">
        <div className="col-12">
          <div
            className="d-flex justify-content-between align-items-center mb-3 p-3 bg-light rounded cursor-pointer"
            onClick={() => setSeccionPagosExpandida(!seccionPagosExpandida)}
            style={{ cursor: 'pointer' }}
          >
            <h3 className="mb-0">💸 Gestión de Pagos</h3>
            <i className={`bi bi-chevron-${seccionPagosExpandida ? 'up' : 'down'} fs-4`}></i>
          </div>
        </div>

        {seccionPagosExpandida && (
          <>
        {/* Subsección: Otras Acciones - COLAPSADA POR DEFECTO */}
        <div className="col-12">
          <div
            className="d-flex justify-content-between align-items-center mb-2 p-2 bg-white border rounded cursor-pointer"
            onClick={() => setAccionesPagosExpandida(!accionesPagosExpandida)}
            style={{ cursor: 'pointer' }}
          >
            <h5 className="mb-0 text-success">▶ Otras Acciones</h5>
            <i className={`bi bi-chevron-${accionesPagosExpandida ? 'up' : 'down'} fs-5`}></i>
          </div>
        </div>

        {accionesPagosExpandida && (
          <>
        {/* Fila 1: Registrar Pago + Dar Adelantos + Pagos a Cuenta */}
        <div className="col-md-4 mb-3">
          <div className="card h-100 border-success shadow-sm hover-shadow">
            <div className="card-header bg-success text-white">
              <h5 className="mb-0">
                <i className="bi bi-cash-coin"></i> Registrar Pago
              </h5>
            </div>
            <div className="card-footer bg-transparent">
              <button
                className="btn btn-success w-100"
                onClick={() => {
                  if (obrasSeleccionadas.size > 0) {
                    setShowRegistrarPagoConsolidado(true);
                  } else {
                    alert('Por favor seleccione al menos una obra con los checkboxes');
                  }
                }}
              >
                <i className="bi bi-plus-lg"></i> Abrir Tarjeta
              </button>
            </div>
          </div>
        </div>

        <div className="col-md-4 mb-3">
          <div className="card h-100 border-success shadow-sm hover-shadow" style={{borderLeft: '4px solid #28a745'}}>
            <div className="card-header" style={{backgroundColor: '#28a745', color: 'white'}}>
              <h5 className="mb-0">
                <i className="bi bi-cash-stack"></i> 💸 Dar Adelantos
              </h5>
            </div>
            <div className="card-footer bg-transparent">
              <button
                className="btn btn-success w-100" style={{backgroundColor: '#28a745', borderColor: '#28a745'}}
                onClick={() => {
                  setProfesionalParaAdelanto(null);
                  setShowDarAdelanto(true);
                }}
              >
                <i className="bi bi-cash-stack"></i> Abrir Tarjeta
              </button>
            </div>
          </div>
        </div>

        <div className="col-md-4 mb-3">
          <div className="card h-100 border-info shadow-sm hover-shadow" style={{borderLeft: '4px solid #17a2b8'}}>
            <div className="card-header" style={{backgroundColor: '#17a2b8', color: 'white'}}>
              <h5 className="mb-0">
                <i className="bi bi-cash-coin"></i> 💰 Pagos a Cuenta
              </h5>
            </div>
            <div className="card-body">
              <p className="text-muted mb-0">
                Registre pagos parciales sobre items de rubros (Jornales, Materiales, Gastos Generales)
              </p>
            </div>
            <div className="card-footer bg-transparent">
              <button
                className="btn btn-info w-100"
                style={{backgroundColor: '#17a2b8', borderColor: '#17a2b8', color: 'white'}}
                onClick={async () => {
                  try {
                    // Intentar usar obra seleccionada singular
                    let obraParaUsar = obraSeleccionada;

                    // Si no hay obra singular pero hay selección múltiple, usar la primera
                    if (!obraParaUsar && obrasSeleccionadas.size > 0) {
                      const primeraObraId = Array.from(obrasSeleccionadas)[0];
                      obraParaUsar = obrasDisponibles.find(o => o.id === primeraObraId);
                    }

                    if (!obraParaUsar) {
                      alert('Por favor, seleccione una obra primero');
                      return;
                    }

                    // Verificar si ya tiene el presupuesto completo (obras de obrasDisponibles)
                    let presupuestoCompleto = obraParaUsar.presupuestoCompleto;

                    // Si no tiene el objeto completo, intentar obtenerlo por ID
                    if (!presupuestoCompleto) {
                      const presupuestoId = obraParaUsar.presupuestoNoClienteId || obraParaUsar.presupuesto_no_cliente_id;

                      if (!presupuestoId) {
                        alert('Esta obra no tiene presupuesto asociado. Los pagos a cuenta solo aplican a obras con presupuesto.');
                        return;
                      }

                      // Cargar presupuesto completo con itemsCalculadora
                      presupuestoCompleto = await apiService.presupuestosNoCliente.getById(presupuestoId, empresaSeleccionada.id);
                    }

                    if (!presupuestoCompleto) {
                      alert('No se pudo cargar el presupuesto');
                      return;
                    }

                    // Agregar información de la obra al presupuesto si no la tiene
                    if (!presupuestoCompleto.nombreObra) {
                      presupuestoCompleto.nombreObra = obraParaUsar.nombreObra || obraParaUsar.nombre;
                    }
                    if (!presupuestoCompleto.obraId) {
                      presupuestoCompleto.obraId = obraParaUsar.id || obraParaUsar.obraId;
                    }

                    setPresupuestoParaPagoCuenta(presupuestoCompleto);
                    setShowPagoCuenta(true);
                  } catch (error) {
                    console.error('Error cargando presupuesto:', error);
                    alert('Error al cargar el presupuesto: ' + error.message);
                  }
                }}
                disabled={!obraSeleccionada && obrasSeleccionadas.size === 0}
              >
                <i className="bi bi-cash-coin"></i> Abrir Tarjeta
              </button>
            </div>
          </div>
        </div>
          </>
        )}

        {/* Fila 2: Listar Pagos + 3 Cards de Gestión Consolidada - SIEMPRE VISIBLE */}
        <div className="col-md-3 mb-3">
          <div className="card h-100 border-success shadow-sm hover-shadow" style={{borderLeft: '4px solid #198754'}}>
            <div className="card-header py-2" style={{backgroundColor: '#20c997', color: 'white'}}>
              <h6 className="mb-0">
                <i className="bi bi-receipt"></i> Listar / Eliminar Pagos
              </h6>
            </div>
            <div className="card-body py-2">
              <small className="text-muted">Consultar y eliminar pagos registrados</small>
            </div>
            <div className="card-footer bg-transparent py-2">
              <button
                className="btn btn-outline-success btn-sm w-100"
                onClick={() => setShowListarPagos(true)}
              >
                <i className="bi bi-list-ul"></i> Abrir
              </button>
            </div>
          </div>
        </div>

        <div className="col-md-3 mb-3">
          <div className="card h-100 border-primary shadow-sm hover-shadow" style={{borderLeft: '4px solid #0d6efd'}}>
            <div className="card-header py-2" style={{backgroundColor: '#0d6efd', color: 'white'}}>
              <h6 className="mb-0"><i className="bi bi-people-fill"></i> Pagos Profesionales</h6>
            </div>
            <div className="card-body py-2">
              <small className="text-muted">Vista de profesionales asignados con detalle financiero</small>
            </div>
            <div className="card-footer bg-transparent py-2">
              <button
                className="btn btn-primary btn-sm w-100"
                onClick={() => setShowGestionPagosProfesionales(true)}
              >
                <i className="bi bi-people-fill"></i> Abrir
              </button>
            </div>
          </div>
        </div>

        <div className="col-md-3 mb-3">
          <div className="card h-100 border-success shadow-sm hover-shadow" style={{borderLeft: '4px solid #198754'}}>
            <div className="card-header py-2" style={{backgroundColor: '#198754', color: 'white'}}>
              <h6 className="mb-0"><i className="bi bi-box-seam"></i> Pagos Materiales</h6>
            </div>
            <div className="card-body py-2">
              <small className="text-muted">Vista de materiales asignados con detalle financiero</small>
            </div>
            <div className="card-footer bg-transparent py-2">
              <button
                className="btn btn-success btn-sm w-100"
                onClick={() => setShowGestionPagosMateriales(true)}
              >
                <i className="bi bi-box-seam"></i> Abrir
              </button>
            </div>
          </div>
        </div>

        <div className="col-md-3 mb-3">
          <div className="card h-100 border-warning shadow-sm hover-shadow" style={{borderLeft: '4px solid #ffc107'}}>
            <div className="card-header py-2" style={{backgroundColor: '#ffc107', color: 'white'}}>
              <h6 className="mb-0"><i className="bi bi-receipt"></i> Pagos Gastos Generales</h6>
            </div>
            <div className="card-body py-2">
              <small className="text-muted">Vista de gastos generales con detalle financiero</small>
            </div>
            <div className="card-footer bg-transparent py-2">
              <button
                className="btn btn-warning btn-sm w-100"
                onClick={() => setShowGestionPagosGastosGenerales(true)}
              >
                <i className="bi bi-receipt"></i> Abrir
              </button>
            </div>
          </div>
        </div>
          </>
        )}
      </div>

      {/* Sección de Retiros Personales */}
      <div className="row mb-4">
        <div className="col-12">
          <div
            className="d-flex justify-content-between align-items-center mb-3 p-3 bg-light rounded cursor-pointer"
            onClick={() => setSeccionRetirosExpandida(!seccionRetirosExpandida)}
            style={{ cursor: 'pointer' }}
          >
            <h3 className="mb-0">💰 Gestión de Retiros Personales</h3>
            <i className={`bi bi-chevron-${seccionRetirosExpandida ? 'up' : 'down'} fs-4`}></i>
          </div>
        </div>

        {seccionRetirosExpandida && (
          <>
        <div className="col-md-6 mb-3">
          <div className="card h-100 border-warning shadow-sm hover-shadow">
            <div className="card-header" style={{backgroundColor: '#fd7e14', color: 'white'}}>
              <h5 className="mb-0">
                <i className="bi bi-wallet2"></i> Registrar Retiro
              </h5>
            </div>
            <div className="card-footer bg-transparent">
              <button
                className="btn w-100" style={{backgroundColor: '#fd7e14', color: 'white', borderColor: '#fd7e14'}}
                onClick={() => setShowRegistrarRetiro(true)}
              >
                <i className="bi bi-plus-lg"></i> Abrir Tarjeta
              </button>
            </div>
          </div>
        </div>

        <div className="col-md-6 mb-3">
          <div className="card h-100 border-warning shadow-sm hover-shadow">
            <div className="card-header" style={{backgroundColor: '#ff9800', color: 'white'}}>
              <h5 className="mb-0">
                <i className="bi bi-list-check"></i> Listar Retiros
              </h5>
            </div>
            <div className="card-footer bg-transparent">
              <button
                className="btn w-100" style={{backgroundColor: 'white', color: '#ff9800', borderColor: '#ff9800', border: '1px solid #ff9800'}}
                onClick={() => setShowListarRetiros(true)}
              >
                <i className="bi bi-list-ul"></i> Abrir Tarjeta
              </button>
            </div>
          </div>
        </div>
          </>
        )}
      </div>

      {/* Modales */}
      <RegistrarNuevoCobroModal
        show={showRegistrarNuevoCobro}
        onHide={() => setShowRegistrarNuevoCobro(false)}
        onSuccess={handleSuccess}
        obraDireccion={null}
        refreshTrigger={refreshTrigger}
      />

      <AsignarCobroDisponibleModal
        show={showAsignarCobroDisponible}
        onHide={() => setShowAsignarCobroDisponible(false)}
        onSuccess={handleSuccess}
        refreshTrigger={refreshTrigger}
      />

      <ListarCobrosObraModal
        show={showListarCobros}
        onHide={() => setShowListarCobros(false)}
        onSuccess={handleSuccess}
        obraDireccion={null}
        modoConsolidado={modoConsolidado}
        obrasSeleccionadas={obrasSeleccionadas}
        obrasDisponibles={obrasDisponibles}
        trabajosExtraSeleccionados={trabajosExtraSeleccionados}
        trabajosAdicionalesSeleccionados={trabajosAdicionalesSeleccionados}
        trabajosAdicionalesDisponibles={trabajosAdicionalesDisponibles}
        refreshTrigger={refreshTrigger}
      />

      <RegistrarPagoProfesionalModal
        show={showRegistrarPago}
        onHide={() => setShowRegistrarPago(false)}
        onSuccess={handleSuccess}
        obraDireccion={null}
        refreshTrigger={refreshTrigger}
      />

      <RegistrarPagoConsolidadoModal
        show={showRegistrarPagoConsolidado}
        onHide={() => setShowRegistrarPagoConsolidado(false)}
        onSuccess={handleSuccess}
        obrasSeleccionadas={presupuestosSeleccionadosArray}
        obrasOriginales={obrasDisponibles.filter(obra => obrasSeleccionadas.has(obra.id))} // ✅ Obras completas para detectar independientes
        refreshTrigger={refreshTrigger}
      />

      {/* 💸 NUEVO: Modal de Dar Adelantos */}
      <DarAdelantoModal
        show={showDarAdelanto}
        onHide={() => {
          setShowDarAdelanto(false);
          setProfesionalParaAdelanto(null);
        }}
        profesionalPreseleccionado={profesionalParaAdelanto}
        profesionalesDisponibles={profesionalesSeleccionados}
        obrasSeleccionadas={presupuestosSeleccionadosArray}
        empresaId={empresaSeleccionada?.id}
        modoMultiple={!profesionalParaAdelanto}
        onSuccess={handleSuccess}
      />

      {/* 💰 NUEVO: Modal de Pagos a Cuenta (sobre rubros del presupuesto) */}
      <PagoCuentaModal
        show={showPagoCuenta}
        onHide={() => {
          setShowPagoCuenta(false);
          setPresupuestoParaPagoCuenta(null);
        }}
        presupuesto={presupuestoParaPagoCuenta || obraSeleccionada}
        onSuccess={handleSuccess}
      />

      {/* 📊 NUEVO: Modal de Gestión Consolidada de Pagos a Profesionales */}
      <GestionPagosProfesionalesModal
        show={showGestionPagosProfesionales}
        onHide={() => setShowGestionPagosProfesionales(false)}
        onSuccess={handleSuccess}
        empresaId={empresaSeleccionada?.id}
      />

      {/* 📦 Modal de Gestión de Pagos - Materiales */}
      <GestionPagosMaterialesModal
        show={showGestionPagosMateriales}
        onHide={() => setShowGestionPagosMateriales(false)}
        onSuccess={handleSuccess}
        empresaId={empresaSeleccionada?.id}
        obrasSeleccionadas={obrasSeleccionadas}
        obrasDisponibles={obrasDisponibles}
      />

      {/* 📄 Modal de Gestión de Pagos - Gastos Generales */}
      <GestionPagosGastosGeneralesModal
        show={showGestionPagosGastosGenerales}
        onHide={() => setShowGestionPagosGastosGenerales(false)}
        onSuccess={handleSuccess}
        empresaId={empresaSeleccionada?.id}
      />

      <ListarPagosProfesionalModal
        show={showListarPagos}
        onHide={() => setShowListarPagos(false)}
        onSuccess={handleSuccess}
        obraDireccion={null}
        modoConsolidado={modoConsolidado}
        refreshTrigger={refreshTrigger}
        obrasSeleccionadas={obrasSeleccionadas}
        obrasDisponibles={obrasDisponibles}
      />

      <ResumenFinancieroObraModal
        show={showResumenFinanciero}
        onHide={() => setShowResumenFinanciero(false)}
        obraId={null}
        obraDireccion={null}
        modoConsolidado={modoConsolidado}
        refreshTrigger={refreshTrigger}
      />

      <SistemaFinancieroConsolidadoModal
        show={showConsolidarPagosGeneral}
        onHide={() => setShowConsolidarPagosGeneral(false)}
        onSuccess={handleSuccess}
        refreshTrigger={refreshTrigger}
        estadisticasExternas={estadisticasPersonalizadas}
      />

      {/* Modal de Lista de Presupuestos APROBADOS */}
      {showListaPresupuestos && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="bi bi-list-check me-2"></i>
                  Obras Disponibles - {empresaSeleccionada?.nombre}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowListaPresupuestos(false)}
                ></button>
              </div>
              <div className="modal-body">
                {loadingPresupuestos ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Cargando...</span>
                    </div>
                    <p className="mt-3 text-muted">Cargando obras disponibles...</p>
                  </div>
                ) : presupuestosAprobados.length === 0 ? (
                  <div className="alert alert-warning">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    No hay obras activas disponibles.
                    <br />
                    <small className="text-muted">
                      Las obras deben estar en estado APROBADO, EN_EJECUCION o FINALIZADO (Tareas Leves) para aparecer aquí.
                      Se incluyen obras con presupuesto detallado, obras independientes y tareas leves finalizadas.
                    </small>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover table-striped">
                      <thead className="table-dark">
                        <tr>
                          <th>ID</th>
                          <th>Nombre Obra</th>
                          <th>Dirección</th>
                          <th>Cliente</th>
                          <th>Estado</th>
                          <th>Presupuesto</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          // 🎯 ORDENAMIENTO INTELIGENTE: Agrupar obras normales y canceladas
                          const obrasNormales = presupuestosAprobados.filter(o => o.estado !== 'CANCELADO').sort((a, b) => (b.id - a.id));
                          const obrasCanceladas = presupuestosAprobados.filter(o => o.estado === 'CANCELADO');

                          const listaOrdenada = [];
                          let grupoIndex = 0;

                          // Agregar obras normales
                          obrasNormales.forEach(obra => {
                            listaOrdenada.push({
                              ...obra,
                              _grupoIndex: grupoIndex,
                              _primerEnGrupo: true,
                              _ultimoEnGrupo: true,
                              _totalEnGrupo: 1
                            });
                            grupoIndex++;
                          });

                          // Agregar obras canceladas
                          obrasCanceladas.forEach(oc => {
                            listaOrdenada.push({
                              ...oc,
                              _grupoIndex: grupoIndex,
                              _primerEnGrupo: true,
                              _ultimoEnGrupo: true,
                              _totalEnGrupo: 1
                            });
                            grupoIndex++;
                          });

                          return listaOrdenada;
                        })().map((obra, index, array) => {
                          const presupuestoId = obra.presupuestoNoClienteId || obra.presupuesto_no_cliente_id || obra.presupuestoNoCliente?.id;

                          // 🎨 Determinar información de grupo para estilos visuales
                          const grupoIndex = obra._grupoIndex || 0;

                          // 🔥 Verificar si es un cambio de grupo
                          const esCambioDeGrupo = index > 0 && (
                            array[index - 1]._grupoIndex !== obra._grupoIndex
                          );

                          // Colores alternados para grupos
                          const coloresGrupo = [
                            '#e9ecef', // Gris claro
                            '#d1e7ff', // Azul claro
                            '#ffe8cc', // Naranja claro
                            '#d4edda', // Verde claro
                            '#f8d7da', // Rosa claro
                            '#e7d6ff'  // Púrpura claro
                          ];

                          // 🎨 Color base del grupo
                          const colorGrupo = coloresGrupo[grupoIndex % coloresGrupo.length];

                          return (
                            <React.Fragment key={obra.id}>
                              {/* 🎨 Separador visual entre grupos */}
                              {esCambioDeGrupo && index > 0 && (
                                <tr style={{ height: '8px', backgroundColor: '#343a40' }}>
                                  <td colSpan="7" style={{
                                    padding: 0,
                                    height: '8px',
                                    borderTop: '3px solid #212529',
                                    borderBottom: '3px solid #212529',
                                    backgroundColor: '#495057'
                                  }}></td>
                                </tr>
                              )}
                          <tr style={{ backgroundColor: colorGrupo }}>
                            <td className="fw-bold">#{obra.id}</td>
                            <td>{obra.nombre || obra.nombreObra || 'Sin nombre'}</td>
                            <td className="text-muted small">
                              {[
                                obra.direccionObraCalle,
                                obra.direccionObraAltura,
                                obra.direccionObraBarrio ? `(${obra.direccionObraBarrio})` : null,
                                obra.direccionObraTorre ? `Torre ${obra.direccionObraTorre}` : null,
                                obra.direccionObraPiso ? `Piso ${obra.direccionObraPiso}` : null,
                                obra.direccionObraDepartamento ? `Depto ${obra.direccionObraDepartamento}` : null
                              ].filter(Boolean).join(' ') || 'Sin dirección'}
                            </td>
                            <td>{obra.nombreCliente || obra.nombreSolicitante || obra.cliente?.nombre || 'Sin cliente'}</td>
                            <td>
                              <span className="badge bg-success">
                                <i className="bi bi-check-circle me-1"></i>
                                {obra.estado}
                              </span>
                            </td>
                            <td>
                              {presupuestoId ? (
                                <span className="badge bg-primary">
                                  <i className="bi bi-file-earmark-check me-1"></i>
                                  Presupuesto ID: {presupuestoId}
                                </span>
                              ) : (
                                <div className="d-flex flex-column gap-1">
                                  <span className="badge bg-warning text-dark">
                                    <i className="bi bi-hand-thumbs-up me-1"></i>
                                    Trabajo Diario
                                  </span>
                                  <small className="text-success fw-bold">
                                    <i className="bi bi-cash me-1"></i>
                                    Estimado: ${(obra.presupuestoEstimado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                  </small>
                                </div>
                              )}
                            </td>
                            <td>
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => handleSelectObra(obra)}
                              >
                                <i className="bi bi-check2-circle me-1"></i>
                                Seleccionar
                              </button>
                            </td>
                          </tr>
                            </React.Fragment>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowListaPresupuestos(false)}
                >
                  <i className="bi bi-x-circle me-1"></i>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Resumen Consolidado - AHORA USA COMPONENTE SistemaFinancieroConsolidadoModal */}
      {false && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <i className="bi bi-calculator me-2"></i>
                  Resumen Consolidado - Obras Aprobadas y En Ejecución
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowResumenConsolidado(false)}
                ></button>
              </div>
              <div className="modal-body">
                {/* Resumen de Totales */}
                <div className="row mb-4">
                  <div className="col-md-3">
                    <div className="card bg-primary text-white">
                      <div className="card-body text-center">
                        <h6>👷 Profesionales</h6>
                        <h3>${resumenConsolidado.totalProfesionales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</h3>
                        <small>{resumenConsolidado.profesionales.length} items</small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card bg-info text-white">
                      <div className="card-body text-center">
                        <h6>🧱 Materiales</h6>
                        <h3>${resumenConsolidado.totalMateriales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</h3>
                        <small>{resumenConsolidado.materiales.length} items</small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card bg-warning text-dark">
                      <div className="card-body text-center">
                        <h6>💰 Otros Costos</h6>
                        <h3>${resumenConsolidado.totalOtrosCostos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</h3>
                        <small>{resumenConsolidado.otrosCostos.length} items</small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card bg-success text-white">
                      <div className="card-body text-center">
                        <h6>💵 TOTAL GENERAL</h6>
                        <h3>${resumenConsolidado.totalGeneral.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</h3>
                        <small>Suma total</small>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Profesionales */}
                {resumenConsolidado.profesionales.length > 0 && (
                  <div className="mb-4">
                    <h5 className="bg-primary text-white p-2 rounded">
                      <i className="bi bi-people-fill me-2"></i>
                      Profesionales ({resumenConsolidado.profesionales.length})
                    </h5>
                    <div className="table-responsive">
                      <table className="table table-striped table-hover">
                        <thead className="table-dark">
                          <tr>
                            <th>Tipo</th>
                            <th>Nombre</th>
                            <th>Obras</th>
                            <th className="text-end">Importe Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ordenarPorRubro(resumenConsolidado.profesionales).map((prof, idx) => (
                            <tr key={idx}>
                              <td><span className={`badge ${getTipoProfesionalBadgeClass(prof.tipoProfesional)}`}>{prof.tipoProfesional}</span></td>
                              <td className="fw-bold">{prof.nombreProfesional}</td>
                              <td>
                                <small className="text-muted">
                                  {Array.from(new Set(prof.obras)).join(', ')}
                                </small>
                              </td>
                              <td className="text-end">
                                <span className="badge bg-primary">
                                  ${prof.importe.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="table-secondary">
                          <tr>
                            <td colSpan="3" className="text-end fw-bold">SUBTOTAL PROFESIONALES:</td>
                            <td className="text-end fw-bold">
                              ${resumenConsolidado.totalProfesionales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* Materiales */}
                {resumenConsolidado.materiales.length > 0 && (
                  <div className="mb-4">
                    <h5 className="bg-info text-white p-2 rounded">
                      <i className="bi bi-box-seam me-2"></i>
                      Materiales ({resumenConsolidado.materiales.length})
                    </h5>
                    <div className="table-responsive">
                      <table className="table table-striped table-hover">
                        <thead className="table-dark">
                          <tr>
                            <th>Tipo de Material</th>
                            <th>Cantidad Total</th>
                            <th>Obras</th>
                            <th className="text-end">Importe Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resumenConsolidado.materiales.map((mat, idx) => (
                            <tr key={idx}>
                              <td className="fw-bold">{mat.tipoMaterial}</td>
                              <td><span className="badge bg-secondary">{mat.cantidad}</span></td>
                              <td>
                                <small className="text-muted">
                                  {Array.from(new Set(mat.obras)).join(', ')}
                                </small>
                              </td>
                              <td className="text-end">
                                <span className="badge bg-info">
                                  ${mat.importe.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="table-secondary">
                          <tr>
                            <td colSpan="3" className="text-end fw-bold">SUBTOTAL MATERIALES:</td>
                            <td className="text-end fw-bold">
                              ${resumenConsolidado.totalMateriales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* Otros Costos */}
                {resumenConsolidado.otrosCostos.length > 0 && (
                  <div className="mb-4">
                    <h5 className="bg-warning text-dark p-2 rounded">
                      <i className="bi bi-currency-dollar me-2"></i>
                      Otros Costos ({resumenConsolidado.otrosCostos.length})
                    </h5>
                    <div className="table-responsive">
                      <table className="table table-striped table-hover">
                        <thead className="table-dark">
                          <tr>
                            <th>Descripción</th>
                            <th>Obras</th>
                            <th className="text-end">Importe Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resumenConsolidado.otrosCostos.map((costo, idx) => (
                            <tr key={idx}>
                              <td className="fw-bold">{costo.descripcion}</td>
                              <td>
                                <small className="text-muted">
                                  {Array.from(new Set(costo.obras)).join(', ')}
                                </small>
                              </td>
                              <td className="text-end">
                                <span className="badge bg-warning text-dark">
                                  ${costo.importe.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="table-secondary">
                          <tr>
                            <td colSpan="2" className="text-end fw-bold">SUBTOTAL OTROS COSTOS:</td>
                            <td className="text-end fw-bold">
                              ${resumenConsolidado.totalOtrosCostos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}


                {resumenConsolidado.profesionales.length === 0 &&
                 resumenConsolidado.materiales.length === 0 &&
                 resumenConsolidado.otrosCostos.length === 0 && (
                  <div className="alert alert-info">
                    <i className="bi bi-info-circle me-2"></i>
                    No hay datos para mostrar. No existen presupuestos con estado APROBADO o EN EJECUCIÓN.
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowResumenConsolidado(false)}
                >
                  <i className="bi bi-x-circle me-1"></i>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>

      )}
      {/* Agrupar estilos y modales en un solo fragmento para evitar errores de JSX adyacente */}
      <>
        <style>{`
          .sf-summary-card {
            height: 100%;
            padding: 1rem;
            border: 1px solid rgba(13, 110, 253, 0.12);
            border-radius: 16px;
            background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
            box-shadow: 0 10px 24px rgba(16, 24, 40, 0.06);
            transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
          }
          .sf-summary-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 16px 32px rgba(16, 24, 40, 0.1);
          }
          .sf-summary-card--info {
            border-color: rgba(13, 202, 240, 0.22);
            background: linear-gradient(180deg, #f5fdff 0%, #eef9ff 100%);
          }
          .sf-summary-card--success {
            border-color: rgba(25, 135, 84, 0.2);
            background: linear-gradient(180deg, #f4fff8 0%, #ecfbf1 100%);
          }
          .sf-summary-card--danger {
            border-color: rgba(220, 53, 69, 0.18);
            background: linear-gradient(180deg, #fff6f7 0%, #fff0f2 100%);
          }
          .sf-summary-card--warning,
          .sf-summary-card--amber {
            border-color: rgba(255, 193, 7, 0.24);
            background: linear-gradient(180deg, #fffdf4 0%, #fff8e7 100%);
          }
          .sf-summary-card--primary,
          .sf-summary-card--sky {
            border-color: rgba(13, 110, 253, 0.18);
            background: linear-gradient(180deg, #f5f9ff 0%, #edf4ff 100%);
          }
          .sf-summary-card--danger-soft {
            border-color: rgba(220, 53, 69, 0.22);
            background: linear-gradient(180deg, #fff5f5 0%, #fdeeee 100%);
          }
          .hover-shadow {
            transition: all 0.3s ease;
          }
          .hover-shadow:hover {
            transform: translateY(-5px);
            box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !important;
          }
          .opacity-50 {
            opacity: 0.6;
            cursor: not-allowed;
          }

          /* 🔒 PREVENIR SCROLL AUTOMÁTICO EN LA TABLA DE OBRAS */
          .table-responsive * {
            scroll-margin-top: 0 !important;
            scroll-margin-bottom: 0 !important;
            scroll-snap-align: none !important;
          }
          .table-responsive input[type="checkbox"]:focus {
            scroll-margin-top: 0 !important;
            scroll-margin-bottom: 0 !important;
          }
        `}</style>

        {showDesglose && (() => {
          // Determinar qué datos mostrar en el modal
          const todasSeleccionadas = obrasSeleccionadas.size === obrasDisponibles.length;
          const ningunnaSeleccionada = obrasSeleccionadas.size === 0;
          const seleccionParcial = !todasSeleccionadas && !ningunnaSeleccionada;
          const usarSeleccionadas = seleccionParcial && !loadingSeleccionadas && estadisticasSeleccionadas?.totalPresupuesto > 0;

          const estadisticasActuales = usarSeleccionadas ? estadisticasSeleccionadas : estadisticasConsolidadas;
          const datosDesgloseBase = estadisticasActuales?.desglosePorObra || [];

          // ✅ Agregar obras independientes seleccionadas al desglose
          const obrasIndependientesSeleccionadas = obrasDisponibles
            .filter(obra => obra.esObraIndependiente && obrasSeleccionadas.has(obra.id))
            .map(obra => ({
              id: obra.id,
              obraId: obra.id,
              nombreObra: obra.nombreObra || obra.direccion || `Obra ${obra.id}`,
              numeroPresupuesto: null, // No tiene presupuesto
              estado: obra.estado || 'APROBADO',
              totalPresupuesto: obra.totalPresupuesto || obra.presupuestoEstimado || 0,
              esObraIndependiente: true // ✅ Flag para identificarla en el modal
            }));

          const datosDesglose = [...datosDesgloseBase, ...obrasIndependientesSeleccionadas];

          return (
            <DetalleConsolidadoPorObraModal
              show={showDesglose}
              onHide={() => setShowDesglose(false)}
              tipo={desgloseTipo}
              datos={datosDesglose}
              titulo={desgloseTitulo}
              estadisticas={estadisticasActuales}
              empresaSeleccionada={empresaSeleccionada}
            />
          );
        })()}

        {/* Modal de Registrar Retiro Personal */}
        <RegistrarRetiroModal
          show={showRegistrarRetiro}
          onHide={() => setShowRegistrarRetiro(false)}
          onSuccess={() => {
            // Recargar estadísticas cuando se registre un retiro
            setRefreshTrigger(prev => prev + 1);
            setNotification({
              message: 'Retiro registrado correctamente',
              type: 'success'
            });
            setTimeout(() => setNotification(null), 5000);
          }}
        />

        {/* Modal de Listar Retiros Personales */}
        <ListarRetirosModal
          show={showListarRetiros}
          onHide={() => setShowListarRetiros(false)}
          onSuccess={() => {
            // Recargar estadísticas cuando se modifiquen retiros
            setRefreshTrigger(prev => prev + 1);
          }}
        />

        {/* Modal de Distribución de Cobros por Obra */}
        {showDistribucionCobros && (() => {
          const todasSeleccionadas = obrasSeleccionadas.size === obrasDisponibles.length;
          const ningunnaSeleccionada = obrasSeleccionadas.size === 0;
          const seleccionParcial = !todasSeleccionadas && !ningunnaSeleccionada;
          const usarSeleccionadas = seleccionParcial && !loadingSeleccionadas && estadisticasSeleccionadas?.totalPresupuesto > 0;

          const estadisticasActuales = usarSeleccionadas ? estadisticasSeleccionadas : estadisticasConsolidadas;
          const datosDistribucion = estadisticasActuales?.desglosePorObra || [];

          return (
            <DetalleDistribucionCobrosModal
              show={showDistribucionCobros}
              onHide={() => setShowDistribucionCobros(false)}
              datos={datosDistribucion}
              estadisticas={estadisticasActuales}
              obrasDisponibles={obrasDisponibles}
            />
          );
        })()}
      </>
    </div>
  );
}; // Fin de SistemaFinancieroPage

export default SistemaFinancieroPage;
