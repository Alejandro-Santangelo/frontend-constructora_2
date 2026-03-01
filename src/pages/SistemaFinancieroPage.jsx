import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
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
import ResumenFinancieroObraModal from '../components/ResumenFinancieroObraModal';
import RegistrarPagoConsolidadoModal from '../components/RegistrarPagoConsolidadoModal';
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
        console.log(`📊 Total calculado con descuentos para ${presupuesto.nombreObra}:`, {
          totalSinDescuento: resultado.totalSinDescuento,
          totalDescuentos: resultado.totalDescuentos,
          totalFinal: resultado.totalFinal
        });
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

  // 🆕 Total de cobros asignados a Trabajos Adicionales y Obras Independientes
  const [totalAsignadoTAOI, setTotalAsignadoTAOI] = useState(0);

  // Estado para la obra/presupuesto seleccionado - cargar desde sessionStorage
  const [obraSeleccionada, setObraSeleccionada] = useState(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const obra = JSON.parse(stored);
        // ✅ Permitir obras independientes (sin presupuesto)
        // Ya no validamos presupuestoNoClienteId
        return obra;
      }
      return null;
    } catch (e) {
      console.error('Error cargando obra desde sessionStorage:', e);
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
  });
  const [showListaPresupuestos, setShowListaPresupuestos] = useState(false);
  const [presupuestosAprobados, setPresupuestosAprobados] = useState([]);
  const [loadingPresupuestos, setLoadingPresupuestos] = useState(false);

  // Estado para modo consolidado (TODAS las obras) - Siempre activo
  const [modoConsolidado, setModoConsolidado] = useState(true);

  // 🆕 Estados para selección de obras en modo consolidado
  const [obrasDisponibles, setObrasDisponibles] = useState([]);
  const [obrasSeleccionadas, setObrasSeleccionadas] = useState(new Set());
  const [trabajosExtraSeleccionados, setTrabajosExtraSeleccionados] = useState(new Set());
  const [gruposColapsadosSF, setGruposColapsadosSF] = useState({});
  const [trabajosAdicionalesDisponibles, setTrabajosAdicionalesDisponibles] = useState([]);
  const [trabajosAdicionalesSeleccionados, setTrabajosAdicionalesSeleccionados] = useState(new Set());
  const [loadingObras, setLoadingObras] = useState(false);
  const [tipoGastoSeleccionado, setTipoGastoSeleccionado] = useState('PROFESIONALES'); // PROFESIONALES, MATERIALES, OTROS_COSTOS

  // Estados para modales
  const [showRegistrarNuevoCobro, setShowRegistrarNuevoCobro] = useState(false);
  const [showAsignarCobroDisponible, setShowAsignarCobroDisponible] = useState(false);
  const [showListarCobros, setShowListarCobros] = useState(false);
  const [showListarRetiros, setShowListarRetiros] = useState(false);
  const [showRegistrarRetiro, setShowRegistrarRetiro] = useState(false);
  const [showRegistrarPago, setShowRegistrarPago] = useState(false);
  const [showRegistrarPagoConsolidado, setShowRegistrarPagoConsolidado] = useState(false);
  const [showListarPagos, setShowListarPagos] = useState(false);
  const [showResumenFinanciero, setShowResumenFinanciero] = useState(false);
  const [showConsolidarPagosGeneral, setShowConsolidarPagosGeneral] = useState(false);

  // Estados para modal de desglose por obra
  const [showDesglose, setShowDesglose] = useState(false);
  const [desgloseTipo, setDesgloseTipo] = useState('');
  const [desgloseTitulo, setDesgloseTitulo] = useState('');

  // Estado para modal de distribución de cobros
  const [showDistribucionCobros, setShowDistribucionCobros] = useState(false);

  // 🆕 Estado para distribución real de cobros por obra
  const [distribucionPorObra, setDistribucionPorObra] = useState([]);

  // Estados para colapsar/expandir secciones (por defecto expandidas)
  const [seccionCobrosExpandida, setSeccionCobrosExpandida] = useState(true);
  const [seccionPagosExpandida, setSeccionPagosExpandida] = useState(true);
  const [seccionRetirosExpandida, setSeccionRetirosExpandida] = useState(true);
  const [seccionCajaChicaExpandida, setSeccionCajaChicaExpandida] = useState(true);

  // Estado para notificaciones
  const [notification, setNotification] = useState(null);

  // Estado para forzar recarga de modales
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Hook de estadísticas consolidadas para TODAS las obras
  const {
    estadisticas: estadisticasConsolidadas,
    loading: loadingConsolidadas,
    error: errorConsolidadas
  } = useEstadisticasConsolidadas(
    empresaSeleccionada?.id,
    refreshTrigger,
    modoConsolidado
  );

  // 🆕 Cargar cobros de TA y OI para la tarjeta "Total disponible de lo ya cobrado"
  useEffect(() => {
    const cargarTotalTAOI = async () => {
      if (!empresaSeleccionada?.id) return;
      try {
        const todasEF = await listarEntidadesFinancieras(empresaSeleccionada.id, true);
        const efSinDist = (todasEF || []).filter(
          ef => ef.tipoEntidad === 'TRABAJO_ADICIONAL' || ef.tipoEntidad === 'OBRA_INDEPENDIENTE'
        );
        if (efSinDist.length === 0) { setTotalAsignadoTAOI(0); return; }
        const estadisticasEF = await obtenerEstadisticasMultiples(
          empresaSeleccionada.id,
          efSinDist.map(ef => ef.id)
        );
        const total = (estadisticasEF || []).reduce((sum, e) => sum + parseFloat(e.totalCobrado || 0), 0);
        setTotalAsignadoTAOI(total);
      } catch (err) {
        console.warn('⚠️ [SistemaFinanciero] Error cargando total TA/OI:', err.message);
        setTotalAsignadoTAOI(0);
      }
    };
    cargarTotalTAOI();
  }, [empresaSeleccionada?.id, refreshTrigger]);

  // 🆕 Cargar distribución real de cobros por obra
  useEffect(() => {
    const cargarDistribucion = async () => {
      if (!empresaSeleccionada?.id) return;

      try {
        const distribucion = await obtenerDistribucionPorObra(empresaSeleccionada.id);
        const distribucionUnica = Array.isArray(distribucion)
          ? distribucion.filter((obra, index, self) =>
              index === self.findIndex(o => o.obraId === obra.obraId)
            )
          : [];
        setDistribucionPorObra(distribucionUnica);
      } catch (error) {
        console.error('Error cargando distribución:', error);
        setDistribucionPorObra([]);
      }
    };

    cargarDistribucion();
  }, [empresaSeleccionada?.id, refreshTrigger]);

  // 🆕 Hook para estadísticas de OBRAS SELECCIONADAS (con checkboxes)
  const presupuestosSeleccionadosArray = useMemo(() => {
    // ✅ Incluir TODAS las obras seleccionadas (con presupuesto Y obras independientes)
    const array = obrasDisponibles
      .filter(obra => obrasSeleccionadas.has(obra.id))
      .map(obra => {
        // Si tiene presupuesto, usar presupuestoCompleto
        if (obra.presupuestoCompleto) {
          return obra.presupuestoCompleto;
        }
        // Si es obra independiente, crear estructura compatible
        if (obra.esObraIndependiente) {
          return {
            id: obra.id,
            obraId: obra.id,
            nombreObra: obra.nombreObra || obra.direccion || `Obra ${obra.id}`,
            direccionObraCalle: obra.direccion || '',
            direccionObraAltura: '',
            estado: obra.estado || 'APROBADO',
            totalPresupuesto: obra.totalPresupuesto || obra.presupuestoEstimado || 0,
            esObraIndependiente: true, // ✅ Flag para identificar en modal
            // Campos mínimos para compatibilidad
            itemsCalculadora: [],
            profesionalesObra: [],
            materialesAsignados: [],
            gastosGeneralesAsignados: []
          };
        }
        return null;
      })
      .filter(Boolean); // Filtrar nulls/undefined

    console.log('📊 [SistemaFinanciero] Presupuestos seleccionados (incluyendo obras independientes):', array.length, 'de', obrasDisponibles.length);
    console.log('📊 Desglose:', {
      conPresupuesto: array.filter(p => !p.esObraIndependiente).length,
      obrasIndependientes: array.filter(p => p.esObraIndependiente).length
    });
    return array;
  }, [obrasDisponibles, obrasSeleccionadas]);

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

        console.log(`📊 Presupuesto #${presupuesto.numeroPresupuesto}:`, {
          totalBase: totalBasePresupuesto,
          totalConHonorarios: totalConHonorarios,
          factorMultiplicador: factorMultiplicador.toFixed(4)
        });

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

      console.log(`📊 DESGLOSE CONSOLIDADO (CON HONORARIOS APLICADOS):`, {
        totalProfesionales: `$${totalProfesionales.toLocaleString()}`,
        totalMateriales: `$${totalMateriales.toLocaleString()}`,
        totalOtrosCostos: `$${totalOtrosCostos.toLocaleString()}`,
        sumaDesglose: `$${totalDesglose.toLocaleString()}`,
        totalGeneral: `$${totalGeneral.toLocaleString()}`,
        diferencia: `$${(totalGeneral - totalDesglose).toLocaleString()}`
      });

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

      // Filtrar por estado APROBADO, EN_EJECUCION o FINALIZADO (si es TAREA_LEVE)
      // ✅ AHORA INCLUYE OBRAS INDEPENDIENTES (sin presupuesto)
      const obrasFiltradas = todasLasObras.filter(obra => {
        // Incluir obras en APROBADO o EN_EJECUCION
        if (obra.estado === 'APROBADO' || obra.estado === 'EN_EJECUCION') return true;

        // Incluir obras FINALIZADO solo si son TAREA_LEVE
        if (obra.estado === 'FINALIZADO') {
          const esTareaLeve = obra.tipo_origen === 'TAREA_LEVE' || obra.tipoOrigen === 'TAREA_LEVE';
          return esTareaLeve;
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
    let totalTrabajosExtra = 0;
    let totalTrabajosAdicionales = 0;
    let cantidadObrasConPresupuesto = 0;
    let cantidadObrasIndependientes = 0;

    obrasDisponibles
      .filter(o => obrasSeleccionadas.has(o.id))
      .forEach(o => {
        if (o.esObraIndependiente) {
          if (!obrasIndependientes.has(o.id)) {
            const monto = o.totalPresupuesto || 0;
            obrasIndependientes.set(o.id, monto);
            cantidadObrasIndependientes++;
          }
          return;
        }

        const idPresupuesto = o.presupuestoCompleto?.id ?? o.presupuestoNoClienteId ?? o.presupuestoNoCliente?.id;
        if (!idPresupuesto) return;
        if (!presupuestosUnicos.has(idPresupuesto)) {
          const monto = o.totalPresupuesto || 0;
          presupuestosUnicos.set(idPresupuesto, monto);
          cantidadObrasConPresupuesto++;
        }

        if (o.trabajosExtra && o.trabajosExtra.length > 0) {
          const trabajosExtraSeleccionadosDeEstaObra = o.trabajosExtra.filter(te =>
            trabajosExtraSeleccionados.has(te.id)
          );
          const totalTE = trabajosExtraSeleccionadosDeEstaObra.reduce((sum, t) =>
            sum + (t.totalCalculado || 0), 0
          );
          totalTrabajosExtra += totalTE;
        }
      });

    const trabajosAdicionalesSeleccionadosArray = trabajosAdicionalesDisponibles
      .filter(ta => trabajosAdicionalesSeleccionados.has(ta.id));
    totalTrabajosAdicionales = trabajosAdicionalesSeleccionadosArray.reduce((sum, ta) => sum + (ta.importe || 0), 0);

    const totalPresupuestos = Array.from(presupuestosUnicos.values()).reduce((sum, val) => sum + val, 0);
    const totalIndependientes = Array.from(obrasIndependientes.values()).reduce((sum, val) => sum + val, 0);
    const totalPresupuestosPersonalizado = totalPresupuestos + totalIndependientes + totalTrabajosExtra + totalTrabajosAdicionales;

    return {
      totalPresupuesto: totalPresupuestosPersonalizado,
      cantidadObras: cantidadObrasConPresupuesto + cantidadObrasIndependientes,
      cantidadTrabajosExtra: trabajosExtraSeleccionados.size,
      cantidadTrabajosAdicionales: trabajosAdicionalesSeleccionados.size,
      cantidadObrasConPresupuesto,
      cantidadObrasIndependientes,
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

    // ✅ Recargar datos usando el contexto financiero
    recargarDatos();

    // ✅ Incrementar trigger para forzar recarga de modales Y estadísticas seleccionadas
    setRefreshTrigger(prev => prev + 1);

    // 🔥 Refrescar estadísticas de obras seleccionadas
    if (typeof refetchSeleccionadas === 'function') {
      console.log('🔄 Refrescando estadísticas de obras seleccionadas...');
      refetchSeleccionadas();
    }

    // 🔥 Si el dashboard está abierto, forzar su actualización
    if (showResumenFinanciero) {
      console.log('🔄 Dashboard abierto - Forzando actualización...');
      // Cerrar y reabrir el dashboard para forzar recarga
      setShowResumenFinanciero(false);
      setTimeout(() => {
        setShowResumenFinanciero(true);
      }, 100);
    }
  }, [recargarDatos, showResumenFinanciero, refetchSeleccionadas]);

  const handleSelectObra = useCallback(async (obra) => {
    console.log('🏗️ Obra seleccionada COMPLETA:', JSON.stringify(obra, null, 2));

    try {
      // 🔥 BUSCAR LA VERSIÓN MÁS RECIENTE DEL PRESUPUESTO PARA ESTA OBRA
      console.log('🔍 Buscando versión más reciente del presupuesto para obra ID:', obra.id);

      // Obtener todos los presupuestos de la empresa
      const todosPresupuestos = await apiService.presupuestosNoCliente.getAll(empresaSeleccionada.id);
      const presupuestosArray = Array.isArray(todosPresupuestos) ? todosPresupuestos :
                                 todosPresupuestos?.content || todosPresupuestos?.data || [];

      console.log('📦 Total presupuestos en empresa:', presupuestosArray.length);

      // Filtrar presupuestos que pertenecen a esta obra
      const presupuestosObra = presupuestosArray.filter(p => p.obraId === obra.id);

      console.log('📋 Presupuestos para esta obra:', presupuestosObra.map(p => ({
        id: p.id,
        numeroPresupuesto: p.numeroPresupuesto,
        numeroVersion: p.numeroVersion,
        estado: p.estado
      })));

      // Ordenar por numeroVersion descendente y tomar el más reciente
      const presupuestoMasReciente = presupuestosObra.sort((a, b) => {
        const versionA = Number(a.numeroVersion || a.version || 0);
        const versionB = Number(b.numeroVersion || b.version || 0);
        return versionB - versionA;
      })[0];

      // Si no se encuentra por obraId, usar el presupuestoNoClienteId como fallback
      const presupuestoId = presupuestoMasReciente?.id || obra.presupuestoNoClienteId || obra.presupuestoNoCliente?.id;

      // ✅ Detectar obra independiente (sin presupuesto)
      const esObraIndependiente = !presupuestoId;

      if (esObraIndependiente) {
        console.log('✅ Obra Independiente seleccionada (sin presupuesto detallado):', {
          id: obra.id,
          nombre: obra.nombre,
          presupuestoEstimado: obra.presupuestoEstimado
        });
      } else {
        console.log('✅ Presupuesto seleccionado:', {
          id: presupuestoId,
          metodo: presupuestoMasReciente ? 'VERSION_MAS_RECIENTE' : 'FALLBACK_OBRA',
          version: presupuestoMasReciente?.numeroVersion,
          numeroPresupuesto: presupuestoMasReciente?.numeroPresupuesto
        });
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

      console.log('✅ Obra formateada para sistema financiero:', obraFormateada);

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
      if (!modoConsolidado || !empresaSeleccionada) return;

      setLoadingObras(true);
      try {
        // 🔧 PASO 0: Cargar TODAS las obras desde /api/obras (incluye obras independientes)
        const obrasResponse = await apiService.obras.getPorEmpresa(empresaSeleccionada.id);
        const todasLasObras = Array.isArray(obrasResponse) ? obrasResponse : (obrasResponse?.datos || obrasResponse?.content || []);

        // Filtrar obras activas: APROBADO, EN_EJECUCION o FINALIZADO (si es TAREA_LEVE)
        const obrasActivas = todasLasObras.filter(o => {
          if (o.estado === 'CANCELADO') return false;
          if (o.estado === 'APROBADO' || o.estado === 'EN_EJECUCION') return true;

          // Incluir obras FINALIZADO solo si son TAREA_LEVE
          if (o.estado === 'FINALIZADO') {
            const esTareaLeve = o.tipo_origen === 'TAREA_LEVE' || o.tipoOrigen === 'TAREA_LEVE';
            return esTareaLeve;
          }

          return false;
        });

        console.log('✅ Obras activas cargadas:', obrasActivas.length);

        // 🔧 PASO 1: Obtener TODOS los presupuestos
        const response = await apiService.presupuestosNoCliente.getAll(empresaSeleccionada.id);

        const extractData = (response) => {
          if (Array.isArray(response)) return response;
          if (response?.datos && Array.isArray(response.datos)) return response.datos;
          if (response?.content && Array.isArray(response.content)) return response.content;
          if (response?.data && Array.isArray(response.data)) return response.data;
          return [];
        };

        // Filtrar CANCELADO
        const todosPresupuestos = extractData(response).filter(p => p.estado !== 'CANCELADO');

        // 🎯 PASO 1: Separar trabajos extra ANTES de agrupar
      const presupuestosNormales = todosPresupuestos.filter(p => {
        const esTE = p.esPresupuestoTrabajoExtra === true ||
                     p.esPresupuestoTrabajoExtra === 'V' ||
                     p.es_obra_trabajo_extra === true;
        return !esTE;
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
        const obraId = p.obraId || p.direccionObraId;
        if (!obraId) return; // Saltar presupuestos sin obra asociada

        const version = p.numeroVersion || p.version || 0;
        if (!obrasPorObraId[obraId] || version > (obrasPorObraId[obraId].numeroVersion || 0)) {
          // 🔍 Calcular total correcto considerando descuentos
          const totalPresupuesto = obtenerTotalPresupuesto(p);

          console.log(`💰 [${p.nombreObra}] Total calculado: $${totalPresupuesto.toLocaleString('es-AR')}`);

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

        console.log('✅ Obra Independiente agregada:', obra.nombre, '- Estimado:', obra.presupuestoEstimado);
      });

      const obrasNormales = Object.values(obrasPorObraId);

      // 🎯 PASO 3: Convertir trabajos extra a formato simplificado (última versión por obraId)
      const trabajosExtraPorObraId = {};
      presupuestosTrabajosExtra.forEach(p => {
        const obraId = p.obraId || p.direccionObraId;
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

      // 🔧 CARGAR trabajos extra SOLO para obras normales
      const obrasConTrabajosExtra = [];

      for (const obra of obrasNormales) {
        const obraId = obra.presupuestoCompleto?.obraId || obra.presupuestoCompleto?.direccionObraId;

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
              obraId: te.presupuestoCompleto?.obraId || te.presupuestoCompleto?.direccionObraId,
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
      // Seleccionar todas por defecto SOLO en la primera carga
      setObrasSeleccionadas(prevSelected => {
        // Si ya hay obras seleccionadas, preservar la selección
        if (prevSelected.size > 0) {
          const idsDisponibles = new Set(obrasConTrabajosExtra.map(o => o.id));
          return new Set([...prevSelected].filter(id => idsDisponibles.has(id)));
        }
        // Primera carga: seleccionar todas
        return new Set(obrasConTrabajosExtra.map(o => o.id));
      });

      // 🆕 Seleccionar todos los trabajos extra por defecto
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
        // Primera carga: seleccionar todos
        return new Set(todosLosTrabajosExtra);
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
      console.log('🔄 Recibido evento PRESUPUESTO_ACTUALIZADO:', data);
      // Solo refrescar si estamos en modo consolidado y tenemos empresa seleccionada
      if (modoConsolidado && empresaSeleccionada) {
        console.log('🔄 Refrescando obras por actualización de presupuesto...');

        // Forzar recarga completa de obras
        setTimeout(async () => {
          try {
            setLoadingObras(true);

            const obrasResponse = await apiService.obras.getPorEmpresa(empresaSeleccionada.id);
            const todasLasObras = Array.isArray(obrasResponse) ? obrasResponse : (obrasResponse?.datos || obrasResponse?.content || []);
            const obrasActivas = todasLasObras.filter(o => {
              if (o.estado === 'CANCELADO') return false;
              if (o.estado === 'APROBADO' || o.estado === 'EN_EJECUCION') return true;

              // Incluir obras FINALIZADO solo si son TAREA_LEVE
              if (o.estado === 'FINALIZADO') {
                const esTareaLeve = o.tipo_origen === 'TAREA_LEVE' || o.tipoOrigen === 'TAREA_LEVE';
                return esTareaLeve;
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
              const obraId = p.obraId || p.direccionObraId;
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

            // Agregar obras independientes
            obrasActivas.forEach(obra => {
              if (obrasPorObraId[obra.id]) return;

              const tienePresupuesto = obra.presupuestoNoClienteId ||
                                      (obra.presupuestoNoCliente && typeof obra.presupuestoNoCliente === 'object');
              if (tienePresupuesto) return;

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

        // Seleccionar todos por defecto en la primera carga
        setTrabajosAdicionalesSeleccionados(prevSelected => {
          if (prevSelected.size > 0) {
            const idsDisponibles = new Set(trabajosAdicionales.map(ta => ta.id));
            return new Set([...prevSelected].filter(id => idsDisponibles.has(id)));
          }
          return new Set(trabajosAdicionales.map(ta => ta.id));
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

          console.log(`🔄 Obras actualizadas: ${obrasArray.length}`);
        } catch (err) {
          console.error('❌ Error recargando obras:', err);
        }
      };

      recargarObras();
    }, 500); // Pequeño delay para evitar múltiples cargas

    return () => clearTimeout(recargarObrasTimeout);
  }, [refreshTrigger, modoConsolidado, empresaSeleccionada]);
  */

  // 🆕 Funciones para manejar selección de obras
  const toggleObraSeleccion = (obraId) => {
    setObrasSeleccionadas(prev => {
      const newSet = new Set(prev);
      const obraInfo = obrasDisponibles.find(o => o.id === obraId);
      if (newSet.has(obraId)) {
        console.log('❌ Deseleccionando obra:', obraInfo?.nombreObra, 'ID:', obraId);
        newSet.delete(obraId);
      } else {
        console.log('✅ Seleccionando obra:', obraInfo?.nombreObra, 'ID:', obraId);
        newSet.add(obraId);
      }
      console.log('📋 Estado actual de selección:', [...newSet].map(id => {
        const obra = obrasDisponibles.find(o => o.id === id);
        return { id, nombre: obra?.nombreObra };
      }));
      return newSet;
    });
  };

  // 🆕 Funciones para manejar selección de trabajos extra
  const toggleTrabajoExtraSeleccion = (trabajoExtraId) => {
    setTrabajosExtraSeleccionados(prev => {
      const newSet = new Set(prev);
      if (newSet.has(trabajoExtraId)) {
        console.log('❌ Deseleccionando trabajo extra ID:', trabajoExtraId);
        newSet.delete(trabajoExtraId);
      } else {
        console.log('✅ Seleccionando trabajo extra ID:', trabajoExtraId);
        newSet.add(trabajoExtraId);
      }
      return newSet;
    });
  };

  const toggleTrabajoAdicionalSeleccion = (trabajoAdicionalId) => {
    setTrabajosAdicionalesSeleccionados(prev => {
      const newSet = new Set(prev);
      if (newSet.has(trabajoAdicionalId)) {
        newSet.delete(trabajoAdicionalId);
      } else {
        newSet.add(trabajoAdicionalId);
      }
      return newSet;
    });
  };

  const seleccionarTodasObras = () => {
    setObrasSeleccionadas(new Set(obrasDisponibles.map(o => o.id)));
    // Seleccionar todos los trabajos extra también
    const todosLosTrabajosExtra = [];
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
    setObrasSeleccionadas(new Set());
    setTrabajosExtraSeleccionados(new Set());
    setTrabajosAdicionalesSeleccionados(new Set());
  };

  // 🆕 Componente inline para el selector de obras
  const ObrasSelector = () => {
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
            Seleccionar Obras ({obrasSeleccionadas.size} de {obrasDisponibles.length})
            {trabajosExtraSeleccionados.size > 0 && (
              <span className="ms-2 badge bg-light text-dark">
                + {trabajosExtraSeleccionados.size} Adicional{trabajosExtraSeleccionados.size !== 1 ? 'es' : ''} Obra
              </span>
            )}
            {trabajosAdicionalesSeleccionados.size > 0 && (
              <span className="ms-2 badge bg-info text-white">
                + {trabajosAdicionalesSeleccionados.size} Tarea{trabajosAdicionalesSeleccionados.size !== 1 ? 's' : ''} Leve{trabajosAdicionalesSeleccionados.size !== 1 ? 's' : ''}
              </span>
            )}
          </h5>
          <div className="btn-group btn-group-sm">
            <button
              className="btn btn-light btn-sm"
              onClick={seleccionarTodasObras}
              title="Seleccionar todas"
            >
              <i className="bi bi-check-all"></i> Todas
            </button>
            <button
              className="btn btn-outline-light btn-sm"
              onClick={deseleccionarTodasObras}
              title="Deseleccionar todas"
            >
              <i className="bi bi-x"></i> Ninguna
            </button>
          </div>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive" style={{maxHeight: '400px', overflowY: 'auto'}}>
            <table className="table table-hover mb-0">
              <thead className="table-light sticky-top">
                <tr>
                  <th style={{width: '50px'}} className="text-center">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={obrasSeleccionadas.size === obrasDisponibles.length}
                      onChange={(e) => {
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
                  console.log('🔍 obrasDisponibles COMPLETO:', obrasDisponibles.map(o => ({id: o.id, obraId: o.obraId, nombre: o.nombreObra, esTrabajoExtra: o.esTrabajoExtra, estado: o.estado})));

                  // 🔥 DEDUPLICAR obras por ID antes de procesarlas
                  const obrasDeduplicadas = obrasDisponibles.filter((obra, index, self) =>
                    index === self.findIndex((o) => o.id === obra.id)
                  );

                  if (obrasDisponibles.length !== obrasDeduplicadas.length) {
                    console.warn(`⚠️ Se encontraron ${obrasDisponibles.length - obrasDeduplicadas.length} obras duplicadas en obrasDisponibles. Se eliminaron.`);
                  }

                  const obrasNormales = obrasDeduplicadas.filter(o => !o.esTrabajoExtra && o.estado !== 'CANCELADO').sort((a, b) => a.id - b.id);
                  const obrasCanceladas = obrasDeduplicadas.filter(o => o.estado === 'CANCELADO');

                  const listaOrdenada = [];
                  let grupoIndex = 0;

                  console.log('🔍 trabajosAdicionalesDisponibles:', trabajosAdicionalesDisponibles);
                  console.log('🔍 Cantidad de TA disponibles:', trabajosAdicionalesDisponibles.length);
                  console.log('🔍 obrasNormales:', obrasNormales.map(o => ({id: o.id, obraId: o.obraId, nombre: o.nombreObra, esTrabajoExtra: o.esTrabajoExtra})));

                  // Agregar obras normales CON sus trabajos extra Y trabajos adicionales expandidos
                  obrasNormales.forEach(obra => {
                    console.log(`🔍 Procesando obra: ${obra.nombreObra} (presupuestoId: ${obra.id}, obraId: ${obra.obraId})`);
                    const tieneSubObras = obra.trabajosExtra && obra.trabajosExtra.length > 0;

                    // Contar trabajos adicionales de la obra y de sus trabajos extra
                    const trabajosAdicionalesObra = trabajosAdicionalesDisponibles.filter(ta => ta.obraId === obra.obraId && !ta.trabajoExtraId);
                    console.log(`🔍 Obra ${obra.nombreObra} (obraId: ${obra.obraId}) - TA directos:`, trabajosAdicionalesObra);
                    let totalTrabajosAdicionales = trabajosAdicionalesObra.length;

                    let totalEnGrupo = 1 + (obra.trabajosExtra?.length || 0) + trabajosAdicionalesObra.length;

                    // Si hay trabajos extra, contar sus trabajos adicionales
                    if (tieneSubObras) {
                      obra.trabajosExtra.forEach(te => {
                        const trabajosAdicionalesTE = trabajosAdicionalesDisponibles.filter(ta => ta.trabajoExtraId === te.obraId);
                        totalTrabajosAdicionales += trabajosAdicionalesTE.length;
                        totalEnGrupo += trabajosAdicionalesTE.length;
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
                      console.log(`🔍 Obra ${obra.nombreObra} (obraId ${obra.obraId}) - Trabajos Extra:`, obra.trabajosExtra.map(te => ({id: te.id, obraId: te.obraId, nombre: te.nombre})));
                      obra.trabajosExtra.sort((a, b) => a.id - b.id);
                      obra.trabajosExtra.forEach((trabajo, idx) => {
                        const trabajosAdicionalesTE = trabajosAdicionalesDisponibles.filter(ta => ta.trabajoExtraId === trabajo.obraId);
                        console.log(`🔍 Trabajo Extra ${trabajo.nombre} (presupuestoId ${trabajo.id}, obraId ${trabajo.obraId}) - TA encontrados:`, trabajosAdicionalesTE);
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

                  // Agregar obras canceladas con la misma lógica
                  obrasCanceladas.forEach(oc => {
                    const tieneTrabajosExtra = oc.trabajosExtra && oc.trabajosExtra.length > 0;
                    const trabajosAdicionalesObra = trabajosAdicionalesDisponibles.filter(ta => ta.obraId === oc.obraId && !ta.trabajoExtraId);

                    let totalEnGrupo = 1 + (oc.trabajosExtra?.length || 0) + trabajosAdicionalesObra.length;

                    if (tieneTrabajosExtra) {
                      oc.trabajosExtra.forEach(te => {
                        const trabajosAdicionalesTE = trabajosAdicionalesDisponibles.filter(ta => ta.trabajoExtraId === te.obraId);
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
                        const trabajosAdicionalesTE = trabajosAdicionalesDisponibles.filter(ta => ta.trabajoExtraId === trabajo.obraId);
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

                  console.log('🔍 LISTA ORDENADA:', listaOrdenada);
                  console.log('🔍 Trabajos Adicionales en lista:', listaOrdenada.filter(item => item._esTrabajoAdicional));
                  console.log('🔍 Total items en lista:', listaOrdenada.length);

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
                            cursor: 'pointer',
                            backgroundColor: isSelected ? undefined : colorGrupo,
                            borderBottom: perteneceAGrupo ? '1px solid rgba(253, 126, 20, 0.45)' : undefined
                          }}
                          onClick={() => toggleObraSeleccion(item.id)}
                        >
                          <td className="text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleObraSeleccion(item.id);
                              }}
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
                          SUBGRUPO COLAPSABLE: TRABAJOS EXTRA Y ADICIONALES
                          (sólo se renderiza desde la fila principal)
                          ══════════════════════════════════════════════════ */}
                      {esObraPrincipal && (() => {
                        const extras     = array.filter(it => it._grupoIndex === grupoIndex && it._esTrabajoExtra);
                        const adicionales = array.filter(it => it._grupoIndex === grupoIndex && it._esTrabajoAdicional);
                        if (extras.length === 0 && adicionales.length === 0) return null;

                        const renderSubgrupo = (items, claveGrupo, titulo, headerStyle, itemBorderLeft, isExtra) => {
                          if (items.length === 0) return null;
                          const colapsado = !!gruposColapsadosSF[claveGrupo];
                          return (
                            <>
                              {/* Header subgrupo */}
                              <tr
                                onClick={() => setGruposColapsadosSF(p => ({ ...p, [claveGrupo]: !p[claveGrupo] }))}
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
                                const subIsSelected = isExtra
                                  ? trabajosExtraSeleccionados.has(subItem.id)
                                  : trabajosAdicionalesSeleccionados.has(subItem.id);
                                const subMonto = isExtra ? (subItem.totalCalculado || 0) : (subItem.importe || 0);
                                return (
                                  <tr
                                    key={`sub_${isExtra ? 'te' : 'ta'}_${subItem.id}_${si}`}
                                    className={subIsSelected ? 'table-active' : ''}
                                    style={{
                                      backgroundColor: subIsSelected ? undefined : adjustColorBrightness(colorBaseGrupo, isExtra ? -15 : -25),
                                      cursor: 'pointer',
                                      borderLeft: itemBorderLeft,
                                      borderBottom: '1px solid rgba(253, 126, 20, 0.45)'
                                    }}
                                    onClick={() => isExtra ? toggleTrabajoExtraSeleccion(subItem.id) : toggleTrabajoAdicionalSeleccion(subItem.id)}
                                  >
                                    <td className="text-center" onClick={(e) => e.stopPropagation()}>
                                      <input
                                        type="checkbox"
                                        className="form-check-input"
                                        checked={subIsSelected}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          isExtra ? toggleTrabajoExtraSeleccion(subItem.id) : toggleTrabajoAdicionalSeleccion(subItem.id);
                                        }}
                                      />
                                    </td>
                                    <td colSpan="4" className="ps-3">
                                      {isExtra ? (
                                        <small><strong>{subItem.nombre}</strong></small>
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
                              true
                            )}
                            {renderSubgrupo(
                              adicionales,
                              `adic_${grupoIndex}`,
                              '🔧 Tareas Leves / Mantenimiento',
                              { backgroundColor: '#dbeafe', cursor: 'pointer', borderLeft: '5px solid #1d4ed8', borderBottom: '1px solid rgba(253, 126, 20, 0.45)', color: '#1d4ed8', badgeColor: '#1d4ed8' },
                              '7px solid #fd7e14',
                              false
                            )}
                          </>
                        );
                      })()}

                      {/* Skip: extras y adicionales se renderizan dentro del subgrupo de su principal */}
                      {(esTrabajoExtra || esTrabajoAdicional) && null}
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
                        const debugRows = [];
                        let totalTrabajosExtra = 0;
                        let totalTrabajosAdicionales = 0;

                        // 🔧 Filtrar igual que la tabla: sin trabajos extra, sin cancelados
                        obrasDisponibles
                          .filter(o => !o.esTrabajoExtra && o.estado !== 'CANCELADO')
                          .filter(o => obrasSeleccionadas.has(o.id))
                          .forEach(o => {
                            // ✅ Verificar si es obra independiente
                            if (o.esObraIndependiente) {
                              // Usar el ID de la obra como identificador único
                              if (!obrasIndependientes.has(o.id)) {
                                const monto = o.totalPresupuesto || 0; // Ya tiene el presupuestoEstimado
                                obrasIndependientes.set(o.id, monto);
                                debugRows.push(`OI-${o.id}: $${monto.toLocaleString()}`);
                              }
                              return; // No tiene trabajos extra ni presupuesto detallado
                            }

                            // Obras con presupuesto (lógica existente)
                            const idPresupuesto = o.presupuestoCompleto?.id
                              ?? o.presupuestoNoClienteId
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
                        const totalCompleto = totalPresupuestos + totalIndependientes + totalTrabajosExtra + totalTrabajosAdicionales;

                        return (
                          <>
                            {formatearMoneda(totalCompleto)}
                            <div style={{fontSize: '0.8em', color: '#888', marginTop: 4}}>
                              <span>IDs sumados: </span>
                              {debugRows.join(' | ')}
                              {totalTrabajosExtra > 0 && ` + Adic.Obra: $${totalTrabajosExtra.toLocaleString()}`}
                              {totalTrabajosAdicionales > 0 && ` + TareasLeves: $${totalTrabajosAdicionales.toLocaleString()}`}
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

                  {/* Panel de Detalle: Obras Agrupadas (cada obra como bloque separado) */}
                  {obrasSeleccionadas.size > 0 && (
                    <>
                      <div className="row mb-4 mt-4">
                        <div className="col-12">

                          {/* Iterar por cada obra seleccionada y mostrar sus datos */}
                          {presupuestosSeleccionadosArray.map((obra, obraIndex) => {
                            // Filtrar datos de esta obra específica
                            const profesionalesObra = profesionalesSeleccionados.filter(p => p.nombreObra === obra.nombreObra);
                            const materialesObra = materialesSeleccionados.filter(m => m.nombreObra === obra.nombreObra);
                            const gastosObra = otrosCostosSeleccionados.filter(g => g.nombreObra === obra.nombreObra);

                            // No mostrar obras sin datos según el tipo seleccionado
                            if (tipoGastoSeleccionado === 'PROFESIONALES' && profesionalesObra.length === 0) {
                              return null;
                            }
                            if (tipoGastoSeleccionado === 'MATERIALES' && materialesObra.length === 0) {
                              return null;
                            }
                            if (tipoGastoSeleccionado === 'OTROS_COSTOS' && gastosObra.length === 0) {
                              return null;
                            }

                            return (
                              <div key={`${obra.tipoEntidad || 'obra'}_${obra.id}`} className="card border-primary shadow mb-4">
                                <div className="card-header bg-primary text-white">
                                  <div className="d-flex justify-content-between align-items-center">
                                    <div>
                                      <h5 className="mb-1">
                                        <i className="bi bi-building me-2"></i>
                                        {obra.nombreObra}
                                      </h5>
                                      <small className="text-white-50">
                                        <i className="bi bi-geo-alt me-1"></i>
                                        {[obra.calle, obra.altura, obra.barrio && `(${obra.barrio})`].filter(Boolean).join(' ')}
                                        {' • '}
                                        <span className="badge bg-light text-dark ms-1">{obra.estado}</span>
                                      </small>
                                    </div>
                                  </div>
                                </div>
                                <div className="card-body">
                                  {/* Vista de Profesionales de esta obra */}
                                  {tipoGastoSeleccionado === 'PROFESIONALES' && (
                                    <div className="table-responsive">
                                      <table className="table table-hover table-striped">
                                        <thead className="table-dark">
                                          <tr>
                                            <th>#</th>
                                            <th>Tipo</th>
                                            <th>Nombre</th>
                                            <th>Jornales</th>
                                            <th>Precio/Jornal</th>
                                            <th className="text-end">Total</th>
                                            <th className="text-end">Pagado</th>
                                            <th className="text-end">Saldo</th>
                                            <th className="text-center">Estado</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {profesionalesObra.map((prof, index) => (
                                                <tr key={`prof_${prof.id}_${index}`}>
                                                  <td className="fw-bold">{index + 1}</td>
                                                  <td>
                                                    <span className={`badge ${getTipoProfesionalBadgeClass(prof.tipoProfesional)}`}>
                                                      {prof.tipoProfesional}
                                                    </span>
                                                  </td>
                                                  <td className="fw-bold">{prof.nombre}</td>
                                                  <td className="text-center">
                                                    <span className="badge bg-secondary">{prof.cantidadJornales}</span>
                                                  </td>
                                                  <td className="text-end">
                                                    ${prof.precioJornal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                  </td>
                                                  <td className="text-end fw-bold">
                                                    ${prof.precioTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                  </td>
                                                  <td className="text-end text-success">
                                                    ${prof.totalPagado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                  </td>
                                                  <td className="text-end text-warning">
                                                    ${prof.saldoPendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                  </td>
                                                  <td className="text-center">
                                                    {prof.porcentajePagado >= 100 ? (
                                                      <span className="badge bg-success">
                                                        <i className="bi bi-check-circle me-1"></i>
                                                        Pagado
                                                      </span>
                                                    ) : prof.porcentajePagado > 0 ? (
                                                      <span className="badge bg-warning text-dark">
                                                        <i className="bi bi-hourglass-split me-1"></i>
                                                        {prof.porcentajePagado.toFixed(0)}%
                                                      </span>
                                                    ) : (
                                                      <span className="badge bg-danger">
                                                        <i className="bi bi-x-circle me-1"></i>
                                                        Pendiente
                                                      </span>
                                                    )}
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                            <tfoot className="table-secondary">
                                              <tr>
                                                <td colSpan="5" className="text-end fw-bold">TOTAL:</td>
                                                <td className="text-end fw-bold">
                                                  ${profesionalesObra.reduce((sum, p) => sum + p.precioTotal, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="text-end fw-bold text-success">
                                                  ${profesionalesObra.reduce((sum, p) => sum + p.totalPagado, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="text-end fw-bold text-warning">
                                                  ${profesionalesObra.reduce((sum, p) => sum + p.saldoPendiente, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td></td>
                                              </tr>
                                            </tfoot>
                                          </table>
                                        </div>
                                  )}

                                  {/* Vista de Materiales de esta obra */}
                                  {tipoGastoSeleccionado === 'MATERIALES' && (
                                    <div className="table-responsive">
                                      <table className="table table-hover table-striped">
                                        <thead className="table-dark">
                                          <tr>
                                            <th>#</th>
                                            <th>Material</th>
                                            <th>Cantidad</th>
                                            <th>Precio/Unidad</th>
                                            <th className="text-end">Total</th>
                                            <th className="text-end">Pagado</th>
                                            <th className="text-end">Saldo</th>
                                            <th className="text-center">Estado</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {materialesObra.map((mat, index) => (
                                                <tr key={`mat_${mat.id}_${index}`}>
                                                  <td className="fw-bold">{index + 1}</td>
                                                  <td className="fw-bold">{mat.nombre}</td>
                                                  <td className="text-center">
                                                    <span className="badge bg-secondary">{mat.cantidadUnidades}</span>
                                                  </td>
                                                  <td className="text-end">
                                                    ${mat.precioUnidad.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                  </td>
                                                  <td className="text-end fw-bold">
                                                    ${mat.precioTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                  </td>
                                                  <td className="text-end text-success">
                                                    ${mat.totalPagado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                  </td>
                                                  <td className="text-end text-warning">
                                                    ${mat.saldoPendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                  </td>
                                                  <td className="text-center">
                                                    {mat.pagado ? (
                                                      <span className="badge bg-success">
                                                        <i className="bi bi-check-circle me-1"></i>
                                                        Pagado
                                                      </span>
                                                    ) : (
                                                      <span className="badge bg-danger">
                                                        <i className="bi bi-x-circle me-1"></i>
                                                        Pendiente
                                                      </span>
                                                    )}
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                            <tfoot className="table-secondary">
                                              <tr>
                                                <td colSpan="4" className="text-end fw-bold">TOTAL:</td>
                                                <td className="text-end fw-bold">
                                                  ${materialesObra.reduce((sum, m) => sum + m.precioTotal, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="text-end fw-bold text-success">
                                                  ${materialesObra.reduce((sum, m) => sum + m.totalPagado, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="text-end fw-bold text-warning">
                                                  ${materialesObra.reduce((sum, m) => sum + m.saldoPendiente, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td></td>
                                              </tr>
                                            </tfoot>
                                          </table>
                                        </div>
                                  )}

                                  {/* Vista de Gastos Generales de esta obra */}
                                  {tipoGastoSeleccionado === 'OTROS_COSTOS' && (
                                    <div className="table-responsive">
                                      <table className="table table-hover table-striped">
                                        <thead className="table-dark">
                                          <tr>
                                            <th>#</th>
                                            <th>Descripción</th>
                                            <th className="text-end">Total</th>
                                            <th className="text-end">Pagado</th>
                                            <th className="text-end">Saldo</th>
                                            <th className="text-center">Estado</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {gastosObra.map((costo, index) => (
                                                <tr key={`costo_${costo.id}_${index}`}>
                                                  <td className="fw-bold">{index + 1}</td>
                                                  <td className="fw-bold">{costo.descripcion}</td>
                                                  <td className="text-end fw-bold">
                                                    ${costo.precioTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                  </td>
                                                  <td className="text-end text-success">
                                                    ${costo.totalPagado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                  </td>
                                                  <td className="text-end text-warning">
                                                    ${costo.saldoPendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                  </td>
                                                  <td className="text-center">
                                                    {costo.pagado ? (
                                                      <span className="badge bg-success">
                                                        <i className="bi bi-check-circle me-1"></i>
                                                        Pagado
                                                      </span>
                                                    ) : (
                                                      <span className="badge bg-danger">
                                                        <i className="bi bi-x-circle me-1"></i>
                                                        Pendiente
                                                      </span>
                                                    )}
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                            <tfoot className="table-secondary">
                                              <tr>
                                                <td colSpan="2" className="text-end fw-bold">TOTAL:</td>
                                                <td className="text-end fw-bold">
                                                  ${gastosObra.reduce((sum, c) => sum + c.precioTotal, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="text-end fw-bold text-success">
                                                  ${gastosObra.reduce((sum, c) => sum + c.totalPagado, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="text-end fw-bold text-warning">
                                                  ${gastosObra.reduce((sum, c) => sum + c.saldoPendiente, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td></td>
                                              </tr>
                                            </tfoot>
                                          </table>
                                        </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </>
            </div>
          </div>
        </div>
      </div>

      {/* Panel de Estadísticas Consolidadas - Visible cuando está activo el modo consolidado */}
      {modoConsolidado && (
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
                {(() => {
                  // 🎯 Usar la misma lógica que el modal para consistencia
                  const todasSeleccionadas = obrasSeleccionadas.size === obrasDisponibles.length;
                  const ningunnaSeleccionada = obrasSeleccionadas.size === 0;
                  const seleccionParcial = !todasSeleccionadas && !ningunnaSeleccionada;

                  // Solo usar estadísticas seleccionadas si hay selección PARCIAL
                  const usarSeleccionadas = seleccionParcial && !loadingSeleccionadas && estadisticasSeleccionadas?.totalPresupuesto > 0;
                  const stats = usarSeleccionadas ? estadisticasSeleccionadas : estadisticasConsolidadas;
                  const loading = usarSeleccionadas ? loadingSeleccionadas : loadingConsolidadas;
                  const error = usarSeleccionadas ? errorSeleccionadas : errorConsolidadas;

                  // Usar estadísticas personalizadas calculadas en useMemo
                  const statsFinales = estadisticasPersonalizadas;

                  if (loading) {
                    return (
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
                    );
                  }

                  if (error) {
                    return (
                      <div className="alert alert-warning mb-0">
                        <i className="bi bi-exclamation-triangle me-2"></i>
                        {error}
                      </div>
                    );
                  }

                  return (
                    <>
                      {/* Primera fila: 4 tarjetas principales */}
                      <div className="row text-center mb-3">
                        <div className="col-md-3 mb-3 mb-md-0">
                          <div
                            className="border rounded p-3 bg-light"
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
                        <div className="col-md-3 mb-3 mb-md-0">
                          <div
                            className="border rounded p-3 bg-light"
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
                        <div className="col-md-3 mb-3 mb-md-0">
                          <div
                            className="border rounded p-3 bg-light"
                            onClick={() => abrirDesglose('pagos', '💸 Desglose de Pagos por Obra')}
                            style={{cursor: 'pointer'}}
                          >
                            <i className="bi bi-arrow-up-circle fs-1 text-danger"></i>
                            <h6 className="text-muted mt-2 mb-1">Total Pagado</h6>
                            <h4 className="text-danger mb-0">
                              ${statsFinales.totalPagado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </h4>
                            <small className="text-muted">
                              {statsFinales.porcentajePagado.toFixed(1)}% del presupuesto total
                            </small>
                            <div className="mt-1">
                              <small className="text-danger"><i className="bi bi-hand-index"></i></small>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-3 mb-3 mb-md-0">
                          <div
                            className="border rounded p-3 bg-light"
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

                      {/* Segunda fila: 4 tarjetas de balance */}
                      <div className="row text-center">
                        <div className="col-md-3 mb-3 mb-md-0">
                          <div
                            className="border rounded p-3 bg-light"
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
                        <div className="col-md-3 mb-3 mb-md-0">
                          <div
                            className="border rounded p-3 bg-light"
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
                        <div className="col-md-3 mb-3 mb-md-0">
                          <div
                            className="border rounded p-3 bg-light"
                            onClick={() => abrirDesglose('saldoDisponible', '💰 Desglose de Saldo Disponible')}
                            style={{cursor: 'pointer'}}
                          >
                            <i className="bi bi-piggy-bank fs-1 text-primary"></i>
                            <h6 className="text-muted mt-2 mb-1">Total disponible de lo ya cobrado</h6>
                            <h4 className="mb-0 text-primary">
                              {(() => {
                                // Total cobrado menos total distribuido a ítems
                                if (loading) {
                                  return <span className="spinner-border spinner-border-sm" role="status"></span>;
                                }

                                // Calcular: Total Cobrado - Total Asignado a obras (incluyendo TA y OI)
                                const totalCobrado = statsFinales.totalCobradoEmpresa || statsFinales.totalCobrado || 0;
                                const totalAsignado = (statsFinales.totalAsignado || 0) + totalAsignadoTAOI;
                                const saldoDisponible = totalCobrado - totalAsignado;

                                return formatearMoneda(saldoDisponible);
                              })()}
                            </h4>
                            <small className="text-muted">Cobrado - Asignado</small>
                            <div className="mt-1">
                              <small className="text-primary"><i className="bi bi-hand-index"></i></small>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-3">
                          <div
                            className="border rounded p-3 bg-danger bg-opacity-10"
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
                      )}

                      {statsFinales.alertas && statsFinales.alertas.length === 0 && (
                        <div className="mt-3 text-center">
                          <p className="text-success small mb-0">
                            <i className="bi bi-check-circle-fill me-1"></i>
                            <strong>Todo en orden:</strong> No hay alertas financieras en este momento
                          </p>
                        </div>
                      )} */}

                      {/* Top 10 Obras por Presupuesto */}
                      {(() => {
                        // 🆕 Agrupar obras con sus subobras
                        const todasLasObras = statsFinales.desglosePorObra || [];
                        const obrasConSubobras = [];
                        const subobrasYaAgregadas = new Set();

                        // Ordenar primero por presupuesto para mantener el ranking
                        const obrasSorted = [...todasLasObras].sort((a, b) => b.totalPresupuesto - a.totalPresupuesto);

                        obrasSorted.forEach(obra => {
                          if (subobrasYaAgregadas.has(obra.id)) return;

                          // Buscar subobras: obras cuyo nombre empiece con el nombre de esta obra
                          const subobras = obrasSorted.filter(posibleSubobra => {
                            if (posibleSubobra.id === obra.id) return false;
                            // Detectar si es subobra: el nombre incluye el nombre de la obra padre
                            const esSubobra = posibleSubobra.nombreObra?.startsWith(obra.nombreObra + ' ') ||
                                            posibleSubobra.nombreObra?.includes(obra.nombreObra + ' ');
                            return esSubobra;
                          });

                          // Marcar subobras como ya procesadas
                          subobras.forEach(sub => subobrasYaAgregadas.add(sub.id));

                          obrasConSubobras.push({
                            ...obra,
                            subobras
                          });
                        });

                        const topObras = obrasConSubobras.slice(0, 10);

                        if (topObras.length === 0) return null;

                        // Calcular posiciones globales antes del render
                        let posicionActual = 0;
                        const obrasConPosicion = topObras.map(obra => {
                          const posicionObra = posicionActual++;
                          const subobrasMapeadas = (obra.subobras || []).map(subobra => ({
                            ...subobra,
                            posicion: posicionActual++
                          }));

                          return {
                            ...obra,
                            posicion: posicionObra,
                            subobras: subobrasMapeadas
                          };
                        });

                        return (
                          <div className="mt-4">
                            <div className="card">
                              <div className="card-header bg-light">
                                <h6 className="mb-0">
                                  <i className="fas fa-trophy me-2"></i>
                                  Top 10 Obras por Presupuesto {usarSeleccionadas ? '(Seleccionadas)' : ''}
                                </h6>
                              </div>
                              <div className="card-body">
                                <div className="table-responsive">
                                  <table className="table table-sm table-hover">
                                    <thead className="table-light">
                                      <tr>
                                        <th>Posición</th>
                                        <th>Obra</th>
                                        <th className="text-end">Presupuesto</th>
                                        <th className="text-end">Asignado</th>
                                        <th className="text-end">Pagado</th>
                                        <th className="text-end">Retirado</th>
                                        <th className="text-end">Disponible</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {obrasConPosicion.map((obra, index) => {
                                        const totalTrabajosExtra = obra.trabajosExtra?.reduce((sum, t) => sum + (t.totalCalculado || 0), 0) || 0;
                                        const presupuestoConTE = obra.totalPresupuesto + totalTrabajosExtra;

                                        return (
                                          <React.Fragment key={obra.id || index}>
                                            {/* Obra Principal */}
                                            <tr>
                                              <td>
                                                <span className={`badge ${obra.posicion === 0 ? 'bg-warning' : obra.posicion === 1 ? 'bg-secondary' : obra.posicion === 2 ? 'bg-info' : 'bg-light text-dark'}`}>
                                                  {obra.posicion === 0 ? '🥇' : obra.posicion === 1 ? '🥈' : obra.posicion === 2 ? '🥉' : `${obra.posicion + 1}°`}
                                                </span>
                                              </td>
                                              <td className="fw-bold">{obra.nombreObra}</td>
                                              <td className="text-end">{formatearMoneda(obra.totalPresupuesto)}</td>
                                              <td className="text-end">{formatearMoneda(obra.totalCobrado)}</td>
                                              <td className="text-end">{formatearMoneda(obra.totalPagado)}</td>
                                              <td className="text-end">{formatearMoneda(obra.totalRetirado || 0)}</td>
                                              <td className="text-end text-primary fw-bold">{formatearMoneda(obra.saldoDisponible)}</td>
                                            </tr>

                                            {/* Subobras */}
                                            {obra.subobras && obra.subobras.map((subobra, sIdx) => (
                                              <tr key={`${obra.id}-subobra-${sIdx}`} className="table-secondary bg-opacity-25">
                                                <td className="ps-3">
                                                  <span className="badge bg-light text-dark">
                                                    {subobra.posicion === 0 ? '🥇' : subobra.posicion === 1 ? '🥈' : subobra.posicion === 2 ? '🥉' : `${subobra.posicion + 1}°`}
                                                  </span>
                                                </td>
                                                <td className="ps-4">
                                                  <i className="bi bi-diagram-3 me-2 text-primary"></i>
                                                  <strong>{subobra.nombreObra}</strong>
                                                </td>
                                                <td className="text-end"><strong>{formatearMoneda(subobra.totalPresupuesto)}</strong></td>
                                                <td className="text-end"><strong>{formatearMoneda(subobra.totalCobrado)}</strong></td>
                                                <td className="text-end"><strong>{formatearMoneda(subobra.totalPagado)}</strong></td>
                                                <td className="text-end"><strong>{formatearMoneda(subobra.totalRetirado || 0)}</strong></td>
                                                <td className="text-end text-primary"><strong>{formatearMoneda(subobra.saldoDisponible)}</strong></td>
                                              </tr>
                                            ))}

                                            {/* Trabajos Extra */}
                                            {obra.trabajosExtra && obra.trabajosExtra.map((trabajo, tIdx) => (
                                              <tr key={`${obra.id}-trabajo-${tIdx}`} className="table-active">
                                                <td></td>
                                                <td className="ps-4">
                                                  <span className="badge bg-warning text-dark me-2" style={{fontSize: '0.7em'}}>📋 Adicional Obra</span>
                                                  <small><strong>{trabajo.nombre}</strong></small>
                                                </td>
                                                <td className="text-end">
                                                  <small><strong>{formatearMoneda(trabajo.totalCalculado || 0)}</strong></small>
                                                </td>
                                                <td className="text-end"><small>-</small></td>
                                                <td className="text-end"><small>-</small></td>
                                                <td className="text-end"><small>-</small></td>
                                                <td className="text-end"><small>-</small></td>
                                              </tr>
                                            ))}

                                            {/* Separador entre grupos */}
                                            {index < obrasConPosicion.length - 1 && (
                                              <tr>
                                                <td colSpan="7" className="p-0" style={{borderBottom: '3px solid #000 !important', borderTop: '3px solid #000 !important', height: '3px', backgroundColor: '#000'}}></td>
                                              </tr>
                                            )}
                                          </React.Fragment>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

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
          <div className="card h-100 border-success shadow-sm hover-shadow">
            <div className="card-header bg-success text-white">
              <h5 className="mb-0">
                <i className="bi bi-cash-coin"></i> Gestión de Cobros
              </h5>
            </div>
            <div className="card-body">
              <div className="d-grid gap-2">
                <button
                  className="btn btn-primary"
                  onClick={() => setShowRegistrarNuevoCobro(true)}
                >
                  <i className="bi bi-plus-circle"></i> Registrar Nuevo Cobro
                </button>
                <button
                  className="btn btn-info text-white"
                  onClick={() => setShowAsignarCobroDisponible(true)}
                >
                  <i className="bi bi-arrow-down-circle"></i> Asignar Saldo Disponible
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6 mb-3">
          <div className="card h-100 border-success shadow-sm hover-shadow">
            <div className="card-header bg-success text-white">
              <h5 className="mb-0">
                <i className="bi bi-list-check"></i> Listar Cobros
              </h5>
            </div>
            <div className="card-footer bg-transparent">
              <button
                className="btn btn-outline-success w-100"
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
        <div className="col-md-6 mb-3">
          <div className="card h-100 border-primary shadow-sm hover-shadow">
            <div className="card-header bg-primary text-white">
              <h5 className="mb-0">
                <i className="bi bi-cash-coin"></i> Registrar Pago
              </h5>
            </div>
            <div className="card-footer bg-transparent">
              <button
                className="btn btn-primary w-100"
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

        <div className="col-md-6 mb-3">
          <div className="card h-100 border-primary shadow-sm hover-shadow">
            <div className="card-header bg-primary text-white">
              <h5 className="mb-0">
                <i className="bi bi-receipt"></i> Listar Pagos
              </h5>
            </div>
            <div className="card-footer bg-transparent">
              <button
                className="btn btn-outline-primary w-100"
                onClick={() => setShowListarPagos(true)}
              >
                <i className="bi bi-list-ul"></i> Abrir Tarjeta
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
            <div className="card-header bg-warning text-dark">
              <h5 className="mb-0">
                <i className="bi bi-wallet2"></i> Registrar Retiro
              </h5>
            </div>
            <div className="card-footer bg-transparent">
              <button
                className="btn btn-warning w-100"
                onClick={() => setShowRegistrarRetiro(true)}
              >
                <i className="bi bi-plus-lg"></i> Abrir Tarjeta
              </button>
            </div>
          </div>
        </div>

        <div className="col-md-6 mb-3">
          <div className="card h-100 border-warning shadow-sm hover-shadow">
            <div className="card-header bg-warning text-dark">
              <h5 className="mb-0">
                <i className="bi bi-list-check"></i> Listar Retiros
              </h5>
            </div>
            <div className="card-footer bg-transparent">
              <button
                className="btn btn-outline-warning w-100"
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
                          const presupuestoId = obra.presupuestoNoClienteId || obra.presupuestoNoCliente?.id;

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

      <style>{`
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
      `}</style>

      {/* Modal de Desglose por Obra */}
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
    </div>
  );
};

export default SistemaFinancieroPage;
