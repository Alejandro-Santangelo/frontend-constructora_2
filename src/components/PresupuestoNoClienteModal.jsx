import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useEmpresa } from '../EmpresaContext';
import ObraSelector from './ObraSelector';
import ClienteSelector from './ClienteSelector';
import ConfiguracionPresupuestoSection from './ConfiguracionPresupuestoSection';
import { handlePrint, exportToExcel, exportToCSV, exportToJSON, prepararDatosPresupuesto, compartirPorWhatsApp, compartirPorEmail, generarResumenTexto, capturarYExportarVisual, exportarAPDFReal } from '../utils/exportUtils';
import apiService from '../services/api';
import { validarTipoItem, agregarNuevoProfesional } from '../utils/validacionProfesionalesMateriales';
import { crearGastoGeneral } from '../services/gastosGeneralesService';
import usePromedioHonorarios from '../hooks/usePromedioHonorarios';
import { useDetectarModoPresupuesto, BadgeModoPresupuesto } from '../hooks/useDetectarModoPresupuesto.jsx';
import { ROLES_PROFESIONALES, ROLES_ENUM, generarOpcionesRoles, getRolPorDefecto } from '../constants/rolesProfesionales';

const PresupuestoNoClienteModal = ({ show, onClose, onSave, initialData = {}, tiposProfesional = [], autoGenerarPDF = false, onPDFGenerado = null, abrirWhatsAppDespuesDePDF = false, abrirEmailDespuesDePDF = false, modoTrabajoExtra = false }) => {

  // 🔍 DEBUG: Ver qué props recibe el modal
  console.log('🎯 PresupuestoNoClienteModal - Props recibidos:', {
    show,
    autoGenerarPDF,
    abrirWhatsAppDespuesDePDF,
    abrirEmailDespuesDePDF,
    initialDataId: initialData?.id
  });

  const { empresaSeleccionada } = useEmpresa();
  const modalContentRef = useRef(null);
  const guardarPDFButtonRef = useRef(null);

  const safeInitial = initialData || {};

  const normalizeModoCarga = (valor, defaultMode) => {
    if (valor === undefined || valor === null || valor === '') return defaultMode;
    if (typeof valor === 'string') {
      const normal = valor.toLowerCase();
      if (normal === 'global' || normal === 'detalle') return normal;
    }
    if (typeof valor === 'boolean') return valor ? 'global' : 'detalle';
    return defaultMode;
  };

  const soloLectura = safeInitial._soloLectura === true;
  const editarSoloFechas = safeInitial._editarSoloFechas === true;

  const today = (new Date()).toISOString().slice(0,10);
  const [form, setForm] = useState(() => ({
    id: safeInitial.id || null,

    idEmpresa: safeInitial.idEmpresa || empresaSeleccionada?.id || null,
    nombreEmpresa: safeInitial.nombreEmpresa || empresaSeleccionada?.nombreEmpresa || '',

  nombreSolicitante: safeInitial.nombreSolicitante || '',
  direccionParticular: safeInitial.direccionParticular || '',
  telefono: safeInitial.telefono || '',
  mail: safeInitial.mail || '',

    direccionObraBarrio: safeInitial.direccionObraBarrio || '',
    direccionObraCalle: safeInitial.direccionObraCalle || '',
    direccionObraAltura: safeInitial.direccionObraAltura || '',
    direccionObraTorre: safeInitial.direccionObraTorre || '',
    direccionObraPiso: safeInitial.direccionObraPiso || '',
    direccionObraDepartamento: safeInitial.direccionObraDepartamento || '',
    direccionObraLocalidad: safeInitial.direccionObraLocalidad || '',
    direccionObraProvincia: safeInitial.direccionObraProvincia || '',
    direccionObraCodigoPostal: safeInitial.direccionObraCodigoPostal || '',

    descripcion: safeInitial.descripcion || '',
    observaciones: safeInitial.observaciones || '',

    fechaProbableInicio: safeInitial.fechaProbableInicio || '',
    vencimiento: safeInitial.vencimiento ?? today,
    fechaCreacion: safeInitial.fechaCreacion ?? today,
    fechaEmision: safeInitial.fechaEmision ?? today,
    tiempoEstimadoTerminacion: safeInitial.tiempoEstimadoTerminacion ?? '',
    calculoAutomaticoDiasHabiles: (safeInitial.calculoAutomaticoDiasHabiles === true) ? true : false, // ✨ Modo MANUAL por defecto (false), solo true si es explícitamente true

    version: safeInitial.version || safeInitial.numeroVersion || 1,
    numeroPresupuesto: safeInitial.numeroPresupuesto ?? null,
    estado: safeInitial.estado ?? 'BORRADOR',
    tipoPresupuesto: safeInitial.tipoPresupuesto || 'TRADICIONAL',

    honorarioSeleccion: safeInitial.honorarioSeleccion || '',
    honorarioDireccionValorFijo: safeInitial.honorarioDireccionValorFijo ?? '',
    honorarioDireccionPorcentaje: safeInitial.honorarioDireccionPorcentaje ?? '',
    honorarioDireccionImporte: safeInitial.honorarioDireccionImporte ?? '',

    honorarios: safeInitial.honorarios || { jornales: { activo: true } }, // ✅ Forzar activo por defecto
    mayoresCostos: (() => {
      const mc = safeInitial.mayoresCostos || {};
      return {
        generalImportado: mc.generalImportado || false,
        rubroImportado: mc.rubroImportado || false,
        nombreRubroImportado: mc.nombreRubroImportado || '',
        explicacion: mc.explicacion || '',
        profesionales: mc.profesionales || { activo: true, tipo: 'porcentaje', valor: '' },
        materiales: mc.materiales || { activo: true, tipo: 'porcentaje', valor: '' },
        otrosCostos: mc.otrosCostos || { activo: true, tipo: 'porcentaje', valor: '' },
        configuracionPresupuesto: mc.configuracionPresupuesto || { activo: true, tipo: 'porcentaje', valor: '' },
        honorarios: mc.honorarios || { activo: true, tipo: 'porcentaje', valor: '' },
        jornales: {
          activo: (mc.jornales?.activo === false) ? false : true, // ✅ true por defecto, false solo si está explícitamente desmarcado
          tipo: mc.jornales?.tipo || 'porcentaje',
          valor: mc.jornales?.valor || '',
          modoAplicacion: mc.jornales?.modoAplicacion || 'todos',
          porRol: mc.jornales?.porRol || {}
        }
      };
    })(), // ✅ Forzar jornales.activo = true por defecto

    profesionales: safeInitial.profesionales || [],
    materiales: safeInitial.materiales || [],
    otrosCostos: safeInitial.otrosCostos || [],

    jornales: safeInitial.jornales || [],

    totalHonorariosProfesionales: safeInitial.totalHonorariosProfesionales ?? 0,
    totalMateriales: safeInitial.totalMateriales ?? 0,
    totalHonorariosDireccionObra: safeInitial.totalHonorariosDireccionObra ?? 0,
    montoTotal: safeInitial.montoTotal ?? 0,

    // 🔑 Mapear obraId desde obra_id si viene de BD (normalización)
    obraId: safeInitial.obraId ?? safeInitial.obra_id ?? null,
    clienteId: safeInitial.clienteId || null, // ✨ Nuevo: ID del cliente seleccionado
    nombreObraManual: safeInitial.nombreObraManual || safeInitial.nombreObra || '',
    obraSeleccionadaParaCopiar: null, // ✨ Flag para distinguir si se seleccionó obra (sin vincular, solo copiar datos)

    // 🆕 Modos de carga (global/detalle) - Siempre iniciar en 'global' (Modo Global)
    modoCargaJornales: normalizeModoCarga(safeInitial.modoCargaJornales, 'global'),
    modoCargaMateriales: normalizeModoCarga(safeInitial.modoCargaMateriales, 'global'),
    modoCargaGastos: normalizeModoCarga(safeInitial.modoCargaGastos, 'global'),
  }));

  // Estado para guardar el valor protegido del nombre de obra
  // SOLO se protege cuando se selecciona una obra existente en el selector
  // NO se protege cuando se carga un presupuesto existente o se escribe manualmente
  const [nombreObraProtegido, setNombreObraProtegido] = useState('');

  // Estados para mostrar nombres en lugar de IDs en modo edición
  const [nombreClienteVinculado, setNombreClienteVinculado] = useState('');
  const [nombreObraVinculado, setNombreObraVinculado] = useState('');

  const [errors, setErrors] = useState({});

  // Helper para calcular fecha estimada de finalización
  // 🇦🇷 Feriados Argentina 2025-2026
  const feriadosArgentina = [
    '2025-01-01', '2025-02-24', '2025-02-25', '2025-03-24', '2025-04-02',
    '2025-04-17', '2025-04-18', '2025-05-01', '2025-05-25', '2025-06-16',
    '2025-06-20', '2025-07-09', '2025-08-15', '2025-08-17', '2025-10-12',
    '2025-10-13', '2025-11-24', '2025-12-08', '2025-12-25',
    '2026-01-01', '2026-02-16', '2026-02-17', '2026-03-24', '2026-04-02',
    '2026-04-03', '2026-05-01', '2026-05-25', '2026-06-15', '2026-06-20',
    '2026-07-09', '2026-08-17', '2026-10-12', '2026-11-23', '2026-12-08',
    '2026-12-25'
  ];

  const esFeriado = (fecha) => {
    const fechaStr = fecha.toISOString().split('T')[0];
    return feriadosArgentina.includes(fechaStr);
  };

  const calcularFechaFinEstimada = () => {
    if (!form.fechaProbableInicio || !form.tiempoEstimadoTerminacion) return null;

    // ✅ Crear fecha en zona horaria local para evitar problemas de offset UTC
    const [year, month, day] = form.fechaProbableInicio.split('-').map(Number);
    let fecha = new Date(year, month - 1, day);
    let diasContados = 0;

    while (diasContados < form.tiempoEstimadoTerminacion) {
      fecha.setDate(fecha.getDate() + 1);
      const diaSemana = fecha.getDay();
      // Contar solo días hábiles (lun-vie) que NO sean feriados
      if (diaSemana >= 1 && diaSemana <= 5 && !esFeriado(fecha)) {
        diasContados++;
      }
    }

    // ✅ Convertir a YYYY-MM-DD sin usar UTC
    const year_fin = fecha.getFullYear();
    const month_fin = String(fecha.getMonth() + 1).padStart(2, '0');
    const day_fin = String(fecha.getDate()).padStart(2, '0');
    return `${year_fin}-${month_fin}-${day_fin}`;
  };

  // Helper para calcular días faltantes hasta fecha de inicio
  const calcularDiasFaltantesInicio = () => {
    if (!form.fechaProbableInicio) return null;

    // Crear fecha de hoy en zona horaria local
    const hoy = new Date();
    const hoyLocal = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

    // Parsear fecha objetivo como fecha local (YYYY-MM-DD)
    const [year, month, day] = form.fechaProbableInicio.split('-').map(Number);
    const fechaInicioLocal = new Date(year, month - 1, day);

    const diferencia = fechaInicioLocal - hoyLocal;
    const dias = Math.round(diferencia / (1000 * 60 * 60 * 24));

    return dias;
  };

  // Helper para obtener alerta de inicio
  const obtenerAlertaInicio = () => {
    if (form.estado !== 'APROBADO' || !form.fechaProbableInicio) return null;

    const diasFaltantes = calcularDiasFaltantesInicio();

    if (diasFaltantes === null) return null;
    if (diasFaltantes < 0) return { tipo: 'danger', mensaje: '¡Ya debió iniciar!', icono: '🚨' };
    if (diasFaltantes === 0) return { tipo: 'danger', mensaje: '¡Inicia HOY!', icono: '🚨' };
    if (diasFaltantes <= 3) return { tipo: 'warning', mensaje: `Inicia en ${diasFaltantes} día${diasFaltantes > 1 ? 's' : ''}`, icono: '⚠️' };
    if (diasFaltantes <= 7) return { tipo: 'info', mensaje: `Inicia en ${diasFaltantes} días`, icono: '📅' };

    return null;
  };

  const [tiempoPlaceholderVisible, setTiempoPlaceholderVisible] = useState(true);
  const [obrasDisponibles, setObrasDisponibles] = useState([]); // Estado para almacenar las obras
  const [newProfesional, setNewProfesional] = useState({
    tipoProfesional: '',
    nombreProfesional: '',
    telefonoProfesional: '',
    importeXHora: '',
    cantidadHoras: '',
    cantidadJornales: '', // Campo adicional para cuando se usa "horas"
    importeCalculado: 0,
    tipoUnidad: 'jornales' // 'jornales' o 'horas'
  });
  const [showAddProfesional, setShowAddProfesional] = useState(false);
  const [newMaterial, setNewMaterial] = useState({
    tipoMaterial: '',
    cantidad: '',
    precioUnitario: ''
  });
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [newOtroCosto, setNewOtroCosto] = useState({
    importe: '',
    descripcion: '',
    fecha: new Date().toISOString().split('T')[0]
  });
  const [showAddOtroCosto, setShowAddOtroCosto] = useState(false);
  const [showAddCalculadora, setShowAddCalculadora] = useState(false); // Estado para mostrar/ocultar formulario de calculadora

  const [errorValidacionMaterial, setErrorValidacionMaterial] = useState(null);
  const [errorValidacionProfesional, setErrorValidacionProfesional] = useState(null);

  const handleAgregarProfesionales = () => {
    if (form.profesionales.length > 0) {
      alert('Los profesionales han sido agregados al presupuesto.');
      setShowAddProfesional(false);
    }
  };

  const handleAgregarMateriales = () => {
    if (form.materiales.length > 0) {
      alert('Los materiales han sido agregados al presupuesto.');
      setShowAddMaterial(false);
    }
  };

  const [mostrarProfesionales, setMostrarProfesionales] = useState(false); // Cerrado por defecto
  const [mostrarMateriales, setMostrarMateriales] = useState(false); // Cerrado por defecto
  const [mostrarOtrosCostos, setMostrarOtrosCostos] = useState(false); // Cerrado por defecto
  const [mostrarConfiguracionPresupuesto, setMostrarConfiguracionPresupuesto] = useState(false);  // Contraído por defecto
  const [mostrarMetrosCuadrados, setMostrarMetrosCuadrados] = useState(false); // Estado para expandir/contraer Metros Cuadrados
  const [mostrarItemsPresupuesto, setMostrarItemsPresupuesto] = useState(false); // Estado para expandir/contraer Items del Presupuesto - CERRADO POR DEFECTO
  const [mostrarCalculadora, setMostrarCalculadora] = useState(false); // Estado para expandir/contraer Calculadora - CERRADO POR DEFECTO
  const [mostrarItemsIndividuales, setMostrarItemsIndividuales] = useState(false); // Estado para expandir/contraer secciones de items individuales
  const [mostrarImportarItems, setMostrarImportarItems] = useState(false); // Estado para expandir/contraer Importar Items
  const [ocultarConfiguracionEnPDF, setOcultarConfiguracionEnPDF] = useState(true); // NUEVO: Ocultar Configuración en PDF por defecto

  // 🎯 Detectar modo del presupuesto usando hook reutilizable
  const modoPresupuestoDetectado = useDetectarModoPresupuesto(safeInitial, show);

  const costosInicialesData = safeInitial.costoInicial || safeInitial.costosIniciales; // Soportar ambos nombres
  const [metrosCuadradosInicial, setMetrosCuadradosInicial] = useState(costosInicialesData?.metrosCuadrados || '');
  const [importePorMetroInicial, setImportePorMetroInicial] = useState(costosInicialesData?.importePorMetro || '');
  const [porcentajeProfesionales, setPorcentajeProfesionales] = useState(costosInicialesData?.porcentajeProfesionales || '');
  const [porcentajeMateriales, setPorcentajeMateriales] = useState(costosInicialesData?.porcentajeMateriales || '');
  const [porcentajeOtrosCostos, setPorcentajeOtrosCostos] = useState(costosInicialesData?.porcentajeOtrosCostos || '');

  const [aumentoImporteFijo, setAumentoImporteFijo] = useState('');
  const [aumentoPorcentaje, setAumentoPorcentaje] = useState('');

  const [tipoProfesionalCalc, setTipoProfesionalCalc] = useState('');
  const [subrubroGastoGeneral, setSubrubroGastoGeneral] = useState(''); // Para rubros personalizados en Gastos Generales
  const [cantidadJornalesCalc, setCantidadJornalesCalc] = useState('');
  const [importeJornalCalc, setImporteJornalCalc] = useState('');
  const [importeMaterialesCalc, setImporteMaterialesCalc] = useState('');
  const [totalManualCalc, setTotalManualCalc] = useState('');

  const [descripcionCalc, setDescripcionCalc] = useState('');
  const [observacionesCalc, setObservacionesCalc] = useState('');

  const [descripcionMateriales, setDescripcionMateriales] = useState('');
  const [observacionesMateriales, setObservacionesMateriales] = useState('');

  const [descripcionTotalManual, setDescripcionTotalManual] = useState('');
  const [observacionesTotalManual, setObservacionesTotalManual] = useState('');

  const [descripcionProfesionales, setDescripcionProfesionales] = useState('');
  const [observacionesProfesionales, setObservacionesProfesionales] = useState('');

  // Estados para Jornales
  const [jornalesCalc, setJornalesCalc] = useState([]);
  const [jornalActualCalc, setJornalActualCalc] = useState({
    rol: getRolPorDefecto(),
    rolPersonalizado: '',
    cantidadJornales: '',
    importeJornal: ''
  });
  const [mostrarInputRolPersonalizado, setMostrarInputRolPersonalizado] = useState(false);
  const [descripcionJornales, setDescripcionJornales] = useState('');
  const [observacionesJornales, setObservacionesJornales] = useState('');

  // Estado para lista de profesionales (para autocompletar honorarios)
  const [listaProfesionales, setListaProfesionales] = useState([]);

  // Hook para cálculo de promedios por rubro y rol
  const { calcularPromedioHonorariosPorRubroYRol, getRubrosDisponibles, getRolesPorRubro } = usePromedioHonorarios(empresaSeleccionada?.id);

  const [profesionalesCalc, setProfesionalesCalc] = useState([]);
  const [profesionalActualCalc, setProfesionalActualCalc] = useState({
    tipo: '',
    nombre: '',
    telefono: '',
    unidad: 'jornales',
    cantidadJornales: '',
    importeJornal: ''
  });

  const [materialesCalc, setMaterialesCalc] = useState([]);
  const [materialActualCalc, setMaterialActualCalc] = useState({
    descripcion: '',
    cantidad: '',
    precioUnitario: '',
    unidad: 'unidad' // Valor por defecto
  });

  const [gastosGeneralesCalc, setGastosGeneralesCalc] = useState([]);
  const [gastoGeneralActual, setGastoGeneralActual] = useState({
    descripcion: '',
    cantidad: '',
    precioUnitario: ''
  });
  const [rubroGastoGeneral, setRubroGastoGeneral] = useState('General'); // Rubro seleccionado para gastos generales
  const [descripcionGastosGenerales, setDescripcionGastosGenerales] = useState('');
  const [observacionesGastosGenerales, setObservacionesGastosGenerales] = useState('');

  // 📦 Estados para integración con sistema de stock
  const [gastosGeneralesStock, setGastosGeneralesStock] = useState([]);
  const [cargandoGastosStock, setCargandoGastosStock] = useState(false);

  const [totalManualTempCalc, setTotalManualTempCalc] = useState('');

  const [itemsCalculadora, setItemsCalculadoraRaw] = useState([]);

  const setItemsCalculadora = (value) => {
    setItemsCalculadoraRaw(prevState => {
      // Interceptar y preservar trabajaEnParalelo automáticamente
      const nuevoValor = typeof value === 'function' ? value(prevState) : value;

      // 🔒 PRESERVAR trabajaEnParalelo: fusionar con estado actual
      const nuevoValorConCampoPreservado = (Array.isArray(nuevoValor) ? nuevoValor : []).map(nuevoItem => {
        const itemAnterior = prevState.find(i => i.id === nuevoItem.id);
        if (itemAnterior && itemAnterior.trabajaEnParalelo !== undefined && nuevoItem.trabajaEnParalelo === undefined) {
          // Si el nuevo item no tiene trabajaEnParalelo pero el anterior sí, preservar el anterior
          return { ...nuevoItem, trabajaEnParalelo: itemAnterior.trabajaEnParalelo };
        }
        return nuevoItem;
      });

      return nuevoValorConCampoPreservado;
    });
  };
  const [itemEditandoId, setItemEditandoId] = useState(null);
  const itemEditandoIdRef = useRef(null);

  // 🚫 Flag para evitar loops infinitos durante el guardado
  const estaGuardandoRef = useRef(false);

  // 🚫 Flag para evitar loops durante la carga inicial
  const estaCargandoInicialRef = useRef(false);

  // 🔇 Helper para logs condicionales (no loguear durante carga inicial)
  const logCondicional = (...args) => {
    if (!estaCargandoInicialRef.current) {
      console.log(...args);
    }
  };

  // Estados de colapso: false = expandido/abierto, true = colapsado/cerrado
  const [jornalesAgregados, setJornalesAgregados] = useState(false); // Expandida
  const [profesionalesAgregados, setProfesionalesAgregados] = useState(true); // Colapsada
  const [materialesAgregados, setMaterialesAgregados] = useState(false); // Expandida
  const [gastosGeneralesAgregados, setGastosGeneralesAgregados] = useState(false); // Expandida
  const [manoObraMaterialesAgregados, setManoObraMaterialesAgregados] = useState(true); // Colapsada

  // Modificar useEffect principal de inicialización para asegurar que las secciones arranquen colapsadas
  useEffect(() => {
    console.log('🚩 [useEffect-380] Ejecutado');
    // Si es un nuevo presupuesto o carga inicial, asegurar colapsado
    setProfesionalesAgregados(true);
    setManoObraMaterialesAgregados(true);
  }, [show, form.id]); // trigger al abrir modal o cargar id
  const [rubroCreado, setRubroCreado] = useState(false);

  // 🆕 Estados para mini-modales de edición de elementos individuales
  const [showEditProfesionalModal, setShowEditProfesionalModal] = useState(false);
  const [profesionalEditando, setProfesionalEditando] = useState(null);
  const [itemIdProfesionalEditando, setItemIdProfesionalEditando] = useState(null);

  const [showEditMaterialModal, setShowEditMaterialModal] = useState(false);
  const [materialEditando, setMaterialEditando] = useState(null);
  const [itemIdMaterialEditando, setItemIdMaterialEditando] = useState(null);

  const [showEditJornalModal, setShowEditJornalModal] = useState(false);
  const [jornalEditando, setJornalEditando] = useState(null);
  const [itemIdJornalEditando, setItemIdJornalEditando] = useState(null);

  // ✨ NUEVOS ESTADOS: Modos de Carga (Detalle vs Global)

  const [modoCargaJornales, setModoCargaJornales] = useState(normalizeModoCarga(safeInitial.modoCargaJornales, 'global'));
  const [globalJornales, setGlobalJornales] = useState({ descripcion: 'Presupuesto Global Mano de Obra', importe: '' });
  const [modoCargaMateriales, setModoCargaMateriales] = useState(normalizeModoCarga(safeInitial.modoCargaMateriales, 'global'));
  const [globalMateriales, setGlobalMateriales] = useState({ descripcion: 'Presupuesto Global Materiales', importe: '' });
  const [modoCargaGastos, setModoCargaGastos] = useState(normalizeModoCarga(safeInitial.modoCargaGastos, 'global'));
  const [globalGastos, setGlobalGastos] = useState({ descripcion: 'Presupuesto Global Gastos Grales.', importe: '' });

  // Sincronizar switches con el valor inicial del formulario cada vez que se abre el modal o cambia el presupuesto
  useEffect(() => {
    console.log('🚩 [useEffect-410] Ejecutado');
    // Inicialización robusta de switches modoCarga
    // Si hay initialData y tiene id, usar sus valores; si no, usar 'global' por defecto
    const modoJornales = initialData && initialData.id
      ? normalizeModoCarga(initialData.modoCargaJornales, 'global')
      : 'global';
    const modoMateriales = initialData && initialData.id
      ? normalizeModoCarga(initialData.modoCargaMateriales, 'global')
      : 'global';
    const modoGastos = initialData && initialData.id
      ? normalizeModoCarga(initialData.modoCargaGastos, 'global')
      : 'global';
    setModoCargaJornales(modoJornales);
    setModoCargaMateriales(modoMateriales);
    setModoCargaGastos(modoGastos);
    console.log('🟢 Switches modoCarga inicializados:', { modoJornales, modoMateriales, modoGastos });
  }, [show, form.id]);

  // 🆕 NUEVOS ESTADOS: Selectores de Catálogo vs Entrada Manual
  const [modoEntradaMaterial, setModoEntradaMaterial] = useState('catalogo'); // 'catalogo' | 'manual'
  const [modoEntradaJornal, setModoEntradaJornal] = useState('catalogo'); // 'catalogo' | 'manual'
  const [modoEntradaGasto, setModoEntradaGasto] = useState('catalogo'); // 'catalogo' | 'manual'

  // 📚 Estados para almacenar catálogos cargados desde backend
  const [catalogoMateriales, setCatalogoMateriales] = useState([]);
  const [catalogoJornales, setCatalogoJornales] = useState([]);
  const [catalogoGastos, setCatalogoGastos] = useState([]);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(false);

  // Estados para los selectores de catálogo
  const [selectorMaterial, setSelectorMaterial] = useState('');
  const [selectorJornal, setSelectorJornal] = useState('');
  const [selectorGasto, setSelectorGasto] = useState('');

  const [showEditGastoModal, setShowEditGastoModal] = useState(false);
  const [gastoEditando, setGastoEditando] = useState(null);
  const [itemIdGastoEditando, setItemIdGastoEditando] = useState(null);

  // 🔽 Estados para colapsar visualmente las secciones dentro del rubro (Jornales, Materiales, Gastos)
  const [jornalesSectionOpen, setJornalesSectionOpen] = useState(false);
  const [materialesSectionOpen, setMaterialesSectionOpen] = useState(false);
  const [gastosSectionOpen, setGastosSectionOpen] = useState(false);

  // useEffect para actualizar form cuando cambian los initialData (al abrir para editar)
  useEffect(() => {
    console.log('🚩 [useEffect-442] Ejecutado');
    if (!initialData || !initialData.id) return;

    // 🚫 BLOQUEAR todos los useEffect durante la carga inicial
    estaCargandoInicialRef.current = true;
    console.log('🚫 BLOQUEANDO useEffects - cargando initialData');

    const safeData = initialData || {};
    const today = (new Date()).toISOString().slice(0,10);

    // 🔍 DEBUG: Ver qué jornales vienen del backend
    if (safeData.jornales && Array.isArray(safeData.jornales)) {
      console.log('🔍 JORNALES RECIBIDOS DEL BACKEND:', safeData.jornales.length);
      const jornalesPorRubro = {};
      safeData.jornales.forEach(j => {
        const rubro = j.tipoProfesional || 'Sin rubro';
        if (!jornalesPorRubro[rubro]) jornalesPorRubro[rubro] = [];
        jornalesPorRubro[rubro].push({
          id: j.id,
          rol: j.rol,
          presupuestoNoClienteId: j.presupuestoNoClienteId
        });
      });
      console.log('📊 Jornales agrupados por rubro:', jornalesPorRubro);

      // Detectar duplicados por ID
      const idsVistos = new Set();
      const duplicados = [];
      safeData.jornales.forEach(j => {
        if (idsVistos.has(j.id)) {
          duplicados.push(j.id);
        } else {
          idsVistos.add(j.id);
        }
      });
      if (duplicados.length > 0) {
        console.error('⚠️⚠️⚠️ JORNALES DUPLICADOS DETECTADOS EN BACKEND:', duplicados);

        // 🛠️ FIX: Eliminar duplicados del backend (quedarnos solo con el primero de cada ID)
        const idsUnicos = new Set();
        const jornalesLimpios = [];
        safeData.jornales.forEach(j => {
          if (!idsUnicos.has(j.id)) {
            idsUnicos.add(j.id);
            jornalesLimpios.push(j);
          } else {
            console.warn('🗑️ Eliminando jornal duplicado ID:', j.id, j.rol);
          }
        });
        safeData.jornales = jornalesLimpios;
        console.log('✅ Jornales después de limpiar duplicados:', safeData.jornales.length);
      }
    }



    setForm({
      id: safeData.id || null,
      idEmpresa: safeData.idEmpresa || empresaSeleccionada?.id || null,
      nombreEmpresa: safeData.nombreEmpresa || empresaSeleccionada?.nombreEmpresa || '',
      nombreSolicitante: safeData.nombreSolicitante || '',
      direccionParticular: safeData.direccionParticular || '',
      telefono: safeData.telefono || '',
      mail: safeData.mail || '',
      direccionObraBarrio: safeData.direccionObraBarrio || '',
      direccionObraCalle: safeData.direccionObraCalle || '',
      direccionObraAltura: safeData.direccionObraAltura || '',
      direccionObraTorre: safeData.direccionObraTorre || '',
      direccionObraPiso: safeData.direccionObraPiso || '',
      direccionObraDepartamento: safeData.direccionObraDepartamento || '',
      direccionObraLocalidad: safeData.direccionObraLocalidad || '',
      direccionObraProvincia: safeData.direccionObraProvincia || '',
      direccionObraCodigoPostal: safeData.direccionObraCodigoPostal || '',
      descripcion: safeData.descripcion || '',
      observaciones: safeData.observaciones || '',
      fechaProbableInicio: safeData.fechaProbableInicio || '',
      vencimiento: safeData.vencimiento ?? today,
      fechaCreacion: safeData.fechaCreacion ?? today,
      fechaEmision: safeData.fechaEmision ?? today,
      tiempoEstimadoTerminacion: (() => {
        console.log('⏱️ CARGANDO tiempoEstimadoTerminacion desde BD:', safeData.tiempoEstimadoTerminacion);
        return safeData.tiempoEstimadoTerminacion ?? '';
      })(),
      calculoAutomaticoDiasHabiles: (() => {
        console.log('🔍 VALOR RAW DE BD - calculoAutomaticoDiasHabiles:', safeData.calculoAutomaticoDiasHabiles, 'tipo:', typeof safeData.calculoAutomaticoDiasHabiles);

        // Si viene explícitamente de la BD, respetarlo
        if (safeData.calculoAutomaticoDiasHabiles !== null && safeData.calculoAutomaticoDiasHabiles !== undefined) {
          const valorBooleano = safeData.calculoAutomaticoDiasHabiles === true || safeData.calculoAutomaticoDiasHabiles === 'true' || safeData.calculoAutomaticoDiasHabiles === 1;
          console.log('✅ USANDO VALOR DE BD:', valorBooleano, '(verde=true/automático, azul=false/manual)');
          return valorBooleano;
        }
        // Solo si es null/undefined, usar false como default (MANUAL)
        console.log('⚠️ NO ENCONTRADO EN BD, usando default: false (MANUAL/azul)');
        return false;
      })(),
      version: safeData.version || safeData.numeroVersion || 1,
      numeroPresupuesto: safeData.numeroPresupuesto ?? null,
      estado: safeData.estado ?? 'BORRADOR',
      tipoPresupuesto: safeData.tipoPresupuesto || 'TRADICIONAL',
      honorarioSeleccion: safeData.honorarioSeleccion || '',
      honorarioDireccionValorFijo: safeData.honorarioDireccionValorFijo ?? '',
      honorarioDireccionPorcentaje: safeData.honorarioDireccionPorcentaje ?? '',
      honorarioDireccionImporte: safeData.honorarioDireccionImporte ?? '',
      honorarios: safeData.honorarios || (() => {
        // ✅ Reconstruir desde campos individuales si no viene el objeto completo
        console.log('🔧 RECONSTRUYENDO HONORARIOS desde BD');

        // ✅ CRÍTICO: El backend puede devolver honorarios con dos formatos:
        // 1. Presupuestos: honorariosJornalesActivo, honorariosJornalesValor, etc.
        // 2. Trabajos Extra: jornalesActivo, jornalesValor, etc. (dentro del objeto honorarios)

        const tieneHonorariosObjeto = safeData.honorarios && typeof safeData.honorarios === 'object';

        if (tieneHonorariosObjeto) {
          // Formato de trabajos extra: ya viene en objeto honorarios con nombres cortos
          console.log('✅ Usando formato de honorarios de trabajo extra');
          return {
            aplicarATodos: safeData.honorarios.aplicarATodos || false,
            valorGeneral: safeData.honorarios.valorGeneral || '',
            tipoGeneral: safeData.honorarios.tipoGeneral || 'porcentaje',
            profesionales: {
              activo: safeData.honorarios.profesionalesActivo ?? true,
              tipo: safeData.honorarios.profesionalesTipo || 'porcentaje',
              valor: safeData.honorarios.profesionalesValor || ''
            },
            materiales: {
              activo: safeData.honorarios.materialesActivo ?? true,
              tipo: safeData.honorarios.materialesTipo || 'porcentaje',
              valor: safeData.honorarios.materialesValor || ''
            },
            otrosCostos: {
              activo: safeData.honorarios.otrosCostosActivo ?? true,
              tipo: safeData.honorarios.otrosCostosTipo || 'porcentaje',
              valor: safeData.honorarios.otrosCostosValor || ''
            },
            configuracionPresupuesto: {
              activo: safeData.honorarios.configuracionPresupuestoActivo ?? true,
              tipo: safeData.honorarios.configuracionPresupuestoTipo || 'porcentaje',
              valor: safeData.honorarios.configuracionPresupuestoValor || ''
            },
            jornales: {
              activo: safeData.honorarios.jornalesActivo ?? false,
              tipo: safeData.honorarios.jornalesTipo || 'porcentaje',
              valor: safeData.honorarios.jornalesValor ?? '',
              modoAplicacion: 'todos',
              porRol: {}
            }
          };
        }

        // Formato de presupuestos: campos individuales con prefijo honorarios
        console.log('✅ Usando formato de honorarios de presupuesto');
        console.log('📊 Honorarios Jornales desde BD:', {
          activo: safeData.honorariosJornalesActivo,
          tipo: safeData.honorariosJornalesTipo,
          valor: safeData.honorariosJornalesValor
        });

        const honorariosReconstruido = {
          aplicarATodos: safeData.honorariosAplicarATodos || false,
          valorGeneral: safeData.honorariosValorGeneral || '',
          tipoGeneral: safeData.honorariosTipoGeneral || 'porcentaje',
          profesionales: {
            activo: safeData.honorariosProfesionalesActivo ?? true,
            tipo: safeData.honorariosProfesionalesTipo || 'porcentaje',
            valor: safeData.honorariosProfesionalesValor || ''
          },
          materiales: {
            activo: safeData.honorariosMaterialesActivo ?? true,
            tipo: safeData.honorariosMaterialesTipo || 'porcentaje',
            valor: safeData.honorariosMaterialesValor || ''
          },
          otrosCostos: {
            activo: safeData.honorariosOtrosCostosActivo ?? true,
            tipo: safeData.honorariosOtrosCostosTipo || 'porcentaje',
            valor: safeData.honorariosOtrosCostosValor || ''
          },
          configuracionPresupuesto: {
            activo: safeData.honorariosConfiguracionPresupuestoActivo ?? true,
            tipo: safeData.honorariosConfiguracionPresupuestoTipo || 'porcentaje',
            valor: safeData.honorariosConfiguracionPresupuestoValor || ''
          },
          jornales: {
            activo: safeData.honorariosJornalesActivo ?? false,
            tipo: safeData.honorariosJornalesTipo || 'porcentaje',
            valor: safeData.honorariosJornalesValor ?? '',
            modoAplicacion: 'todos',
            porRol: {}
          }
        };

        // 🆕 CARGA DE VALORES POR DEFECTO (si es presupuesto nuevo)
        if (!safeData.id) {
            try {
                const ultimosValores = JSON.parse(localStorage.getItem('ultimosValoresPresupuesto') || 'null');
                if (ultimosValores && ultimosValores.honorarios) {
                    console.log('📥 Cargando últimos valores de Honorarios usados:', ultimosValores.honorarios);
                    const hLast = ultimosValores.honorarios;

                    // Solo sobrescribir si existen en el storage
                    if (hLast.valorGeneral) honorariosReconstruido.valorGeneral = hLast.valorGeneral;
                    if (hLast.tipoGeneral) honorariosReconstruido.tipoGeneral = hLast.tipoGeneral;

                    if (hLast.jornales) {
                        honorariosReconstruido.jornales.activo = hLast.jornales.activo ?? honorariosReconstruido.jornales.activo;
                        honorariosReconstruido.jornales.tipo = hLast.jornales.tipo || honorariosReconstruido.jornales.tipo;
                        honorariosReconstruido.jornales.valor = hLast.jornales.valor || honorariosReconstruido.jornales.valor;
                    }
                    if (hLast.profesionales) {
                        honorariosReconstruido.profesionales.activo = hLast.profesionales.activo ?? honorariosReconstruido.profesionales.activo;
                        honorariosReconstruido.profesionales.tipo = hLast.profesionales.tipo || honorariosReconstruido.profesionales.tipo;
                        honorariosReconstruido.profesionales.valor = hLast.profesionales.valor || honorariosReconstruido.profesionales.valor;
                    }
                    if (hLast.materiales) {
                        honorariosReconstruido.materiales.activo = hLast.materiales.activo ?? honorariosReconstruido.materiales.activo;
                        honorariosReconstruido.materiales.tipo = hLast.materiales.tipo || honorariosReconstruido.materiales.tipo;
                        honorariosReconstruido.materiales.valor = hLast.materiales.valor || honorariosReconstruido.materiales.valor;
                    }
                    if (hLast.otrosCostos) {
                        honorariosReconstruido.otrosCostos.activo = hLast.otrosCostos.activo ?? honorariosReconstruido.otrosCostos.activo;
                        honorariosReconstruido.otrosCostos.tipo = hLast.otrosCostos.tipo || honorariosReconstruido.otrosCostos.tipo;
                        honorariosReconstruido.otrosCostos.valor = hLast.otrosCostos.valor || honorariosReconstruido.otrosCostos.valor;
                    }
                    if (hLast.configuracionPresupuesto) {
                        honorariosReconstruido.configuracionPresupuesto.activo = hLast.configuracionPresupuesto.activo ?? honorariosReconstruido.configuracionPresupuesto.activo;
                        honorariosReconstruido.configuracionPresupuesto.tipo = hLast.configuracionPresupuesto.tipo || honorariosReconstruido.configuracionPresupuesto.tipo;
                        honorariosReconstruido.configuracionPresupuesto.valor = hLast.configuracionPresupuesto.valor || honorariosReconstruido.configuracionPresupuesto.valor;
                    }
                }
            } catch (e) {
                console.warn('Error cargando defaults honorarios:', e);
            }
        }

        console.log('✅ Honorarios reconstruidos - Jornales:', honorariosReconstruido.jornales);
        console.log('✅ Honorarios reconstruidos COMPLETO:', honorariosReconstruido);

        return honorariosReconstruido;
      })(),
      mayoresCostos: (() => {
        // ✅ Reconstruir MAYORES COSTOS desde campos individuales (igual que honorarios)
        console.log('🔧 RECONSTRUYENDO MAYORES COSTOS desde BD');

        // Verificar si hay algún dato de mayores costos plano, PERO dar prioridad al objeto si existe
        if (safeData.mayoresCostos && typeof safeData.mayoresCostos === 'object') {
           // Si ya viene como objeto, asegurarse de que jornales.activo tenga default true
           const mayoresObj = { ...safeData.mayoresCostos };
           if (!mayoresObj.jornales) {
             mayoresObj.jornales = { activo: true, tipo: 'porcentaje', valor: '', modoAplicacion: 'todos', porRol: {} };
           } else {
             // ✅ FORCE TRUE: Asegurar que Jornales arranque activo SIEMPRE por defecto
             mayoresObj.jornales = {
               ...mayoresObj.jornales,
               activo: (mayoresObj.jornales.activo === false) ? false : true, // true por defecto, false solo si está explícito
               modoAplicacion: mayoresObj.jornales.modoAplicacion || 'todos',
               porRol: mayoresObj.jornales.porRol || {}
             };
           }
           return mayoresObj;
        }

        const mayoresCostosReconstruido = {
          aplicarValorGeneral: safeData.mayoresCostosAplicarValorGeneral ?? false,
          valorGeneral: safeData.mayoresCostosValorGeneral || '',
          tipoGeneral: safeData.mayoresCostosTipoGeneral || 'porcentaje',

          profesionales: {
            activo: (safeData.mayoresCostosProfesionalesActivo === false) ? false : true,
            tipo: safeData.mayoresCostosProfesionalesTipo || 'porcentaje',
            valor: safeData.mayoresCostosProfesionalesValor || ''
          },
          materiales: {
            activo: (safeData.mayoresCostosMaterialesActivo === false) ? false : true,
            tipo: safeData.mayoresCostosMaterialesTipo || 'porcentaje',
            valor: safeData.mayoresCostosMaterialesValor || ''
          },
          otrosCostos: {
            activo: (safeData.mayoresCostosOtrosCostosActivo === false) ? false : true,
            tipo: safeData.mayoresCostosOtrosCostosTipo || 'porcentaje',
            valor: safeData.mayoresCostosOtrosCostosValor || ''
          },
          configuracionPresupuesto: {
            activo: (safeData.mayoresCostosConfiguracionPresupuestoActivo === false) ? false : true,
            tipo: safeData.mayoresCostosConfiguracionPresupuestoTipo || 'porcentaje',
            valor: safeData.mayoresCostosConfiguracionPresupuestoValor || ''
          },
          jornales: {
            activo: (safeData.mayoresCostosJornalesActivo === false) ? false : true, // ✅ true por defecto, false solo si está explícito
            tipo: safeData.mayoresCostosJornalesTipo || 'porcentaje',
            valor: safeData.mayoresCostosJornalesValor || '',
            modoAplicacion: 'todos',
            porRol: {}
          },
          honorarios: {
            activo: (safeData.mayoresCostosHonorariosActivo === false) ? false : true,
            tipo: safeData.mayoresCostosHonorariosTipo || 'porcentaje',
            valor: safeData.mayoresCostosHonorariosValor || ''
          },

          // Campos adicionales de importación
          generalImportado: safeData.mayoresCostosGeneralImportado || null,
          rubroImportado: safeData.mayoresCostosRubroImportado === 'true' || safeData.mayoresCostosRubroImportado === true,
          nombreRubroImportado: safeData.mayoresCostosNombreRubroImportado || '',
          explicacion: safeData.mayoresCostosExplicacion || ''
        };

        // 🆕 CARGA DE VALORES POR DEFECTO (si es presupuesto nuevo)
        // Sobrescribe los valores vacíos con lo último usado
        if (!safeData.id) {
            try {
                const ultimosValores = JSON.parse(localStorage.getItem('ultimosValoresPresupuesto') || 'null');
                if (ultimosValores && ultimosValores.mayoresCostos) {
                    console.log('📥 Cargando últimos valores de Mayores Costos usados:', ultimosValores.mayoresCostos);
                    const mcLast = ultimosValores.mayoresCostos;

                    if (mcLast.valorGeneral) mayoresCostosReconstruido.valorGeneral = mcLast.valorGeneral;
                    if (mcLast.tipoGeneral) mayoresCostosReconstruido.tipoGeneral = mcLast.tipoGeneral;

                    if (mcLast.jornales) {
                        // ✅ NO cargar activo desde localStorage - siempre arrancar en true por defecto
                        mayoresCostosReconstruido.jornales.tipo = mcLast.jornales.tipo || mayoresCostosReconstruido.jornales.tipo;
                        mayoresCostosReconstruido.jornales.valor = mcLast.jornales.valor || mayoresCostosReconstruido.jornales.valor;
                    }
                    if (mcLast.profesionales) {
                        // ✅ NO cargar activo desde localStorage - siempre arrancar en true por defecto
                        mayoresCostosReconstruido.profesionales.tipo = mcLast.profesionales.tipo || mayoresCostosReconstruido.profesionales.tipo;
                        mayoresCostosReconstruido.profesionales.valor = mcLast.profesionales.valor || mayoresCostosReconstruido.profesionales.valor;
                    }
                    if (mcLast.materiales) {
                        // ✅ NO cargar activo desde localStorage - siempre arrancar en true por defecto
                        mayoresCostosReconstruido.materiales.tipo = mcLast.materiales.tipo || mayoresCostosReconstruido.materiales.tipo;
                        mayoresCostosReconstruido.materiales.valor = mcLast.materiales.valor || mayoresCostosReconstruido.materiales.valor;
                    }
                    if (mcLast.otrosCostos) {
                        // ✅ NO cargar activo desde localStorage - siempre arrancar en true por defecto
                        mayoresCostosReconstruido.otrosCostos.tipo = mcLast.otrosCostos.tipo || mayoresCostosReconstruido.otrosCostos.tipo;
                        mayoresCostosReconstruido.otrosCostos.valor = mcLast.otrosCostos.valor || mayoresCostosReconstruido.otrosCostos.valor;
                    }
                    if (mcLast.configuracionPresupuesto) {
                        // ✅ NO cargar activo desde localStorage - siempre arrancar en true por defecto
                        mayoresCostosReconstruido.configuracionPresupuesto.tipo = mcLast.configuracionPresupuesto.tipo || mayoresCostosReconstruido.configuracionPresupuesto.tipo;
                        mayoresCostosReconstruido.configuracionPresupuesto.valor = mcLast.configuracionPresupuesto.valor || mayoresCostosReconstruido.configuracionPresupuesto.valor;
                    }
                    if (mcLast.honorarios) {
                        // ✅ NO cargar activo desde localStorage - siempre arrancar en true por defecto
                        mayoresCostosReconstruido.honorarios.tipo = mcLast.honorarios.tipo || mayoresCostosReconstruido.honorarios.tipo;
                        mayoresCostosReconstruido.honorarios.valor = mcLast.honorarios.valor || mayoresCostosReconstruido.honorarios.valor;
                    }
                }
            } catch (e) {
                console.warn('Error cargando defaults mayoresCostos:', e);
            }
        }

        console.log('✅ Mayores Costos reconstruidos:', mayoresCostosReconstruido);
        return mayoresCostosReconstruido;
      })(),
      profesionales: safeData.profesionales || [],
      materiales: safeData.materiales || [],
      otrosCostos: safeData.otrosCostos || [],
      totalHonorariosProfesionales: safeData.totalHonorariosProfesionales ?? 0,
      totalMateriales: safeData.totalMateriales ?? 0,
      totalHonorariosDireccionObra: safeData.totalHonorariosDireccionObra ?? 0,
      montoTotal: safeData.montoTotal ?? 0,
      obraId: safeData.obraId || safeData.idObra || safeData.obra_id || null,
      clienteId: safeData.clienteId || safeData.idCliente || safeData.cliente_id || null,
      nombreObraManual: safeData.nombreObraManual || safeData.nombreObra || safeData.nombre_obra || '',
      obraSeleccionadaParaCopiar: null,

      // 🆕 Modos de carga (global/detalle) - Persistencia de UI
      modoCargaJornales: normalizeModoCarga(safeData.modoCargaJornales, safeData.id ? 'detalle' : 'global'),
      modoCargaMateriales: normalizeModoCarga(safeData.modoCargaMateriales, safeData.id ? 'detalle' : 'global'),
      modoCargaGastos: normalizeModoCarga(safeData.modoCargaGastos, safeData.id ? 'detalle' : 'global'),
    });

    // Colapsar secciones automáticamente si ya tienen items agregados (modo edición)
    // -----------------------------------------------------------------------------
    // 🆕 LÓGICA DE CARGA DE ITEMS y DETECCIÓN DE MODO GLOBAL
    // -----------------------------------------------------------------------------

    // 1. JORNALES
    if (safeData.jornales && Array.isArray(safeData.jornales) && safeData.jornales.length > 0) {
      // Filtrar duplicados por ID para evitar errores de React key
      const idsJornales = new Set();
      const jornalesUnicos = [];
      safeData.jornales.forEach(j => {
        if (!idsJornales.has(j.id)) {
          idsJornales.add(j.id);
          jornalesUnicos.push(j);
        }
      });

      setJornalesCalc(jornalesUnicos);
      setJornalesAgregados(true); // Mostrar sección (aunque luego el useEffect de colapso lo cierre, es importante tener los datos)

      // Detectar Modo Global (1 item + rol especial o flag)
      const esGlobal = jornalesUnicos.length === 1 && (
        (jornalesUnicos[0].rol && jornalesUnicos[0].rol.includes('PRESUPUESTO GLOBAL')) ||
        jornalesUnicos[0].esGlobal === true
      );

      if (esGlobal) {
        console.log('🌍 MODO GLOBAL DETECTADO EN JORNALES');
        setModoCargaJornales('global');
        setGlobalJornales({
          descripcion: jornalesUnicos[0].rolPersonalizado || 'Presupuesto Global Mano de Obra',
          importe: jornalesUnicos[0].importeJornal || jornalesUnicos[0].valorUnitario || jornalesUnicos[0].subtotal
        });
      } else {
        // Usar valor guardado si existe, si no, 'global'
        const modoGuardado = normalizeModoCarga(safeData.modoCargaJornales, 'global');
        setModoCargaJornales(modoGuardado);
      }
    } else {
      setJornalesCalc([]);
      // Usar valor guardado si existe, si no, 'global'
      const modoGuardado = normalizeModoCarga(safeData.modoCargaJornales, 'global');
      setModoCargaJornales(modoGuardado);
    }

    // 2. MATERIALES
    if (safeData.materiales && Array.isArray(safeData.materiales) && safeData.materiales.length > 0) {
      setMaterialesCalc(safeData.materiales);
      setMaterialesAgregados(true);

      // Detectar Modo Global
      // 🔍 Buscamos por flag explícito, unidad 'global' (fix reciente) o keywords en descripción
      const mat = safeData.materiales[0];
      const esGlobal = safeData.materiales.length === 1 && (
        mat.esGlobal === true ||
        mat.unidad === 'global' ||
        (mat.descripcion && mat.descripcion.toLowerCase().includes('global'))
      );

      if (esGlobal) {
        console.log('🌍 MODO GLOBAL DETECTADO EN MATERIALES');
        setModoCargaMateriales('global');
        setGlobalMateriales({
          descripcion: mat.descripcion || mat.nombre || 'Presupuesto Global Materiales',
          importe: mat.precioUnitario || mat.precio || mat.subtotal || ''
        });
      } else {
        // Usar valor guardado si existe, si no, 'global'
        const modoGuardado = normalizeModoCarga(safeData.modoCargaMateriales, 'global');
        setModoCargaMateriales(modoGuardado);
      }
    } else {
      setMaterialesCalc([]);
      // Usar valor guardado si existe, si no, 'global'
      const modoGuardado = normalizeModoCarga(safeData.modoCargaMateriales, 'global');
      setModoCargaMateriales(modoGuardado);
    }

    // 3. GASTOS GENERALES (Otros Costos)
    if (safeData.otrosCostos && Array.isArray(safeData.otrosCostos) && safeData.otrosCostos.length > 0) {
      setGastosGeneralesCalc(safeData.otrosCostos);
      setGastosGeneralesAgregados(true);

      // Detectar Modo Global
      const gasto = safeData.otrosCostos[0];
      const esGlobal = safeData.otrosCostos.length === 1 && (
        gasto.esGlobal === true ||
        gasto.unidad === 'global' ||
        (gasto.descripcion && gasto.descripcion.toLowerCase().includes('global'))
      );

      if (esGlobal) {
        console.log('🌍 MODO GLOBAL DETECTADO EN GASTOS');
        setModoCargaGastos('global');
        setGlobalGastos({
          descripcion: gasto.descripcion || 'Presupuesto Global Gastos Grales.',
          importe: gasto.precioUnitario || gasto.precio || gasto.subtotal || ''
        });
      } else {
        // Usar valor guardado si existe, si no, 'global'
        const modoGuardado = normalizeModoCarga(safeData.modoCargaGastos, 'global');
        setModoCargaGastos(modoGuardado);
      }
    } else {
      setGastosGeneralesCalc([]);
      // Usar valor guardado si existe, si no, 'global'
      const modoGuardado = normalizeModoCarga(safeData.modoCargaGastos, 'global');
      setModoCargaGastos(modoGuardado);
    }


    // Profesionales y Mano de Obra/Materiales SIEMPRE colapsadas - REFORZAR ESTADO
    setProfesionalesAgregados(true);
    setManoObraMaterialesAgregados(true);

    // Datos cargados correctamente desde initialData

    console.log('📋 Estado del form después de cargar:', {
      honorariosJornalesActivo: form.honorariosJornalesActivo,
      honorariosMaterialesActivo: form.honorariosMaterialesActivo,
      honorariosGastosActivo: form.honorariosGastosActivo,
      honorariosJornalesValor: form.honorariosJornalesValor,
      honorariosMaterialesValor: form.honorariosMaterialesValor,
      honorariosGastosValor: form.honorariosGastosValor
    });

    // ✅ DESBLOQUEAR useEffects después de un delay más largo (permitir que React termine TODOS los renders)
    setTimeout(() => {
      estaCargandoInicialRef.current = false;
      console.log('✅ DESBLOQUEANDO useEffects - carga inicial completada');
    }, 2000); // Aumentado a 2 segundos para evitar loops de logs

  }, [initialData?.id]);

  // useEffect para cargar obras disponibles cuando se abre el modal
  useEffect(() => {
    console.log('🚩 [useEffect-948] Ejecutado');
    if (show && form.idEmpresa && !soloLectura) {
      fetch(`/api/obras/empresa/${form.idEmpresa}`)
        .then(res => res.json())
        .then(data => {
          const obras = Array.isArray(data) ? data : [];
          setObrasDisponibles(obras);
        })
        .catch(error => {
          console.error('❌ Error cargando obras:', error);
          setObrasDisponibles([]);
        });
    }
  }, [show, form.idEmpresa, soloLectura]);

  // 📚 useEffect para cargar catálogos (Materiales, Jornales, Gastos) cuando se abre el modal
  useEffect(() => {
    console.log('🚩 [useEffect-964] Ejecutado');
    const cargarCatalogos = async () => {
      if (!show || !empresaSeleccionada?.id) {
        return;
      }

      setCargandoCatalogos(true);
      try {
        const headers = {
          'Content-Type': 'application/json',
          'empresaId': empresaSeleccionada.id.toString()
        };

        // Cargar catálogos en paralelo
        const [materialesRes, jornalesRes, gastosRes] = await Promise.all([
          fetch(`/api/materiales?empresaId=${empresaSeleccionada.id}`, { headers }).catch(() => ({ ok: false })),
          fetch(`/api/jornales/empresa/${empresaSeleccionada.id}`, { headers }).catch(() => ({ ok: false })),
          fetch(`/api/gastos-generales?empresaId=${empresaSeleccionada.id}`, { headers }).catch(() => ({ ok: false }))
        ]);

        // Procesar materiales
        if (materialesRes.ok) {
          const materiales = await materialesRes.json();
          console.log('📦 RAW Response materiales:', materiales);
          console.log('📦 Es Array?:', Array.isArray(materiales));
          console.log('📦 Tiene data?:', materiales?.data);

          // Intentar extraer el array de diferentes estructuras posibles
          let materialesArray = [];
          if (Array.isArray(materiales)) {
            materialesArray = materiales;
          } else if (materiales?.data && Array.isArray(materiales.data)) {
            materialesArray = materiales.data;
          } else if (materiales?.materiales && Array.isArray(materiales.materiales)) {
            materialesArray = materiales.materiales;
          }

          setCatalogoMateriales(materialesArray);
          console.log('📦 Catálogo de materiales cargado:', materialesArray.length);
          if (materialesArray.length > 0) {
            console.log('📦 Primer material:', materialesArray[0]);
          }
        } else {
          console.error('❌ Error cargando materiales:', materialesRes.status, materialesRes.statusText);
        }

        // Procesar jornales
        if (jornalesRes.ok) {
          const jornales = await jornalesRes.json();
          setCatalogoJornales(Array.isArray(jornales) ? jornales : []);
          console.log('👷 Catálogo de jornales cargado:', jornales.length);
        }

        // Procesar gastos
        if (gastosRes.ok) {
          const gastos = await gastosRes.json();
          setCatalogoGastos(Array.isArray(gastos) ? gastos : []);
          console.log('💰 Catálogo de gastos cargado:', gastos.length);
        }

      } catch (error) {
        console.error('❌ Error cargando catálogos:', error);
      } finally {
        setCargandoCatalogos(false);
      }
    };

    cargarCatalogos();
  }, [show, empresaSeleccionada?.id]);

  // useEffect para cargar nombres de cliente y obra vinculados (modo edición)
  useEffect(() => {
    console.log('🚩 [useEffect-1035] Ejecutado');
    if (show && (form.id || initialData?.id)) {
      // Usar form o initialData como fuente
      const clienteId = form.clienteId || initialData?.clienteId || initialData?.cliente_id;
      const obraId = form.obraId || initialData?.obraId || initialData?.obra_id;

      // Cargar nombre del cliente si existe clienteId
      if (clienteId) {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
        fetch(`${apiUrl}/api/clientes/${clienteId}?empresaId=${empresaSeleccionada?.id}`)
          .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          })
          .then(cliente => {
            // Intentar múltiples formatos de nombre
            const nombreCompleto = `${cliente.nombre || ''} ${cliente.apellido || ''}`.trim();
            const razonSocial = cliente.razonSocial?.trim();
            const cuit = cliente.cuit ? `CUIT: ${cliente.cuit}` : '';
            const email = cliente.email?.trim();

            // Prioridad de fallbacks
            const nombre = nombreCompleto ||
                          razonSocial ||
                          email ||
                          cuit ||
                          `Cliente ID: ${clienteId}`;

            setNombreClienteVinculado(nombre);
          })
          .catch(error => {
            console.error('Error cargando cliente:', error);
            setNombreClienteVinculado(`Cliente ID: ${clienteId}`);
          });
      }

      // Cargar nombre de la obra si existe obraId
      if (obraId) {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
        fetch(`${apiUrl}/api/obras/${obraId}?empresaId=${empresaSeleccionada?.id}`)
          .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          })
          .then(obra => {
            const nombreManual = obra.nombreObraManual?.trim();
            const direccion = `${obra.direccionObraCalle || ''} ${obra.direccionObraAltura || ''}`.trim();
            const descripcion = obra.descripcion?.trim();

            // Prioridad de fallbacks
            const nombre = nombreManual ||
                          direccion ||
                          descripcion ||
                          `Obra ID: ${obraId}`;

            setNombreObraVinculado(nombre);
          })
          .catch(error => {
            console.error('Error cargando obra:', error);
            setNombreObraVinculado(`Obra ID: ${obraId}`);
          });
      }
    }
  }, [show, form.id, form.clienteId, form.obraId, initialData?.id, initialData?.clienteId, initialData?.obraId]);

  // useEffect para cargar lista de profesionales (para autocompletar honorarios)
  useEffect(() => {
    if (show && empresaSeleccionada?.id) {
      fetch(`http://localhost:8080/api/profesionales?empresaId=${empresaSeleccionada.id}`)
        .then(res => res.json())
        .then(data => {
          const profesionales = Array.isArray(data) ? data : (data?.resultado || data?.data || []);
          setListaProfesionales(profesionales);
        })
        .catch(error => {
          console.error('❌ Error cargando profesionales:', error);
          setListaProfesionales([]);
        });
    }
  }, [show, empresaSeleccionada]);

  // useEffect para cambiar estado automáticamente cuando se selecciona TRABAJOS_SEMANALES
  useEffect(() => {
    // NO aplicar cambio automático de estado en modo trabajo extra
    if (modoTrabajoExtra) {
      return;
    }

    // Solo para presupuestos nuevos (sin id)
    if (!form.id) {
      if (form.tipoPresupuesto === 'TRABAJOS_SEMANALES' && form.estado === 'BORRADOR') {
        setForm(prev => ({ ...prev, estado: 'OBRA_A_CONFIRMAR' }));
      } else if (form.tipoPresupuesto === 'TRADICIONAL' && form.estado === 'OBRA_A_CONFIRMAR') {
        setForm(prev => ({ ...prev, estado: 'BORRADOR' }));
      }
    }
  }, [form.tipoPresupuesto, form.id, modoTrabajoExtra]);

  // Función para manejar el cambio de obra vinculada
  const handleObraChange = async (obraId) => {
    console.log('🔄 handleObraChange llamado - obraId:', obraId, 'form.id:', form.id);

    // ✅ Si es modo EDICIÓN (form.id existe), NO hacer nada - mantener valores originales
    if (form.id) {
      console.log('ℹ️ Modo edición detectado - no modificar obraId/clienteId');
      return;
    }

    // Si no hay obraId, limpiar
    if (!obraId) {
      setForm(f => ({ ...f, clienteId: null, obraId: null, obraSeleccionadaParaCopiar: null }));
      return;
    }

    // Buscar la obra seleccionada
    const obraSeleccionada = obrasDisponibles.find(o => o.id === parseInt(obraId));

    // Intentar obtener el clienteId de la obra
    let clienteIdDeObra = obraSeleccionada?.clienteId || obraSeleccionada?.cliente_id || obraSeleccionada?.idCliente;

    // Si no viene en los datos del selector, consultar al backend
    if (!clienteIdDeObra && empresaSeleccionada?.id) {
      try {
        console.log('🔍 Consultando clienteId de la obra al backend...');
        const obraCompleta = await apiService.obras.getById(obraId, empresaSeleccionada.id);
        clienteIdDeObra = obraCompleta?.clienteId || obraCompleta?.cliente_id || obraCompleta?.idCliente;
        console.log('✅ Cliente ID obtenido de la obra:', clienteIdDeObra);
      } catch (error) {
        console.warn('⚠️ No se pudo obtener el clienteId de la obra:', error);
      }
    }

    if (obraSeleccionada) {
      console.log('✅ Datos de la obra seleccionada:', obraSeleccionada);

      // Obtener el nombre de la obra que se va a proteger
      const nombreObraParaProteger = obraSeleccionada.nombreObra || obraSeleccionada.nombre_obra || obraSeleccionada.nombre || '';

      // Rellenar campos de dirección con los datos de la obra
      setForm(f => ({
        ...f,
        // ✅ Si es un presupuesto existente con obraId, mantenerlo. Si es nuevo, copiar datos sin vincular
        obraId: f.id && f.obraId ? f.obraId : null,
        clienteId: f.id && f.clienteId ? f.clienteId : (clienteIdDeObra || null),
        obraSeleccionadaParaCopiar: f.id ? null : obraId, // Solo marcar si es nuevo
        direccionObraCalle: obraSeleccionada.direccion_obra_calle || obraSeleccionada.direccionObraCalle || obraSeleccionada.calle || f.direccionObraCalle,
        direccionObraAltura: obraSeleccionada.direccion_obra_altura || obraSeleccionada.direccionObraAltura || obraSeleccionada.altura || f.direccionObraAltura,
        direccionObraBarrio: obraSeleccionada.direccion_obra_barrio || obraSeleccionada.direccionObraBarrio || obraSeleccionada.barrio || f.direccionObraBarrio,
        direccionObraTorre: obraSeleccionada.direccion_obra_torre || obraSeleccionada.direccionObraTorre || obraSeleccionada.torre || f.direccionObraTorre,
        direccionObraPiso: obraSeleccionada.direccion_obra_piso || obraSeleccionada.direccionObraPiso || obraSeleccionada.piso || f.direccionObraPiso,
        direccionObraDepartamento: obraSeleccionada.direccion_obra_departamento || obraSeleccionada.direccionObraDepartamento || obraSeleccionada.departamento || obraSeleccionada.depto || f.direccionObraDepartamento,
        // También cargar nombre de obra si existe (como referencia)
        nombreObraManual: nombreObraParaProteger
      }));

      // Actualizar el valor protegido
      setNombreObraProtegido(nombreObraParaProteger);

      console.log('✅ Dirección y clienteId cargados automáticamente desde la obra');
      console.log('ℹ️ obraId NO asignado - se creará obra nueva al aprobar');
    }
  };

  useEffect(() => {
    itemEditandoIdRef.current = itemEditandoId;

    // Al abrir un item (o cambiar de item), colapsar las secciones por defecto para mejorar UX
    if (itemEditandoId) {
       setJornalesSectionOpen(false);
       setMaterialesSectionOpen(false);
       setGastosSectionOpen(false);
    }
  }, [itemEditandoId]);

  useEffect(() => {
    // 🛡️ VALIDACIÓN: Verificar si initialData viene con error
    if (initialData && initialData._error) {
      console.error('❌ Error al cargar datos del presupuesto:', initialData._error);
      alert(`❌ Error al cargar el presupuesto:\n\n${initialData._error}\n\nSe usarán valores por defecto.`);
      return;
    }

    if (initialData && initialData.itemsCalculadora && initialData.itemsCalculadora.length > 0) {

      // 🔍 DEBUG: Ver el JSON RAW completo
      console.log('📦 DATOS RAW COMPLETOS initialData:', JSON.stringify(initialData.itemsCalculadora[0], null, 2));

      if (itemsCalculadora.length > 0 && initialData.itemsCalculadora.length === itemsCalculadora.length) {
        console.log('⏭️ Saltando carga - items ya cargados');
        return;
      }


      console.log('🔍 ITEMS DESDE BACKEND:', initialData.itemsCalculadora.length);
      initialData.itemsCalculadora.forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item.tipoProfesional}:`);
        console.log(`     - trabajaEnParalelo: ${item.trabajaEnParalelo} (tipo: ${typeof item.trabajaEnParalelo})`); // ← CHECKBOX
        console.log(`     - jornales: ${item.jornales?.length || 0}`);
        console.log(`     - profesionales: ${item.profesionales?.length || 0}`);
        console.log(`     - materiales: ${item.materialesLista?.length || 0}`);
        console.log(`     - subtotalMateriales: ${item.subtotalMateriales || 0}`);
        console.log(`     - incluirEnCalculoDias: ${item.incluirEnCalculoDias}`); // ← RUBRO

        // 🔍 DEBUG: Ver jornales individuales CON DETALLE COMPLETO
        if (item.jornales && item.jornales.length > 0) {
          console.log(`📥 JORNALES DESDE BACKEND - ${item.tipoProfesional}:`, item.jornales);
          item.jornales.forEach((j, jIdx) => {
            console.log(`       ${jIdx + 1}. ${j.rol}:`, {
              incluirEnCalculoDias: j.incluirEnCalculoDias,
              tipo: typeof j.incluirEnCalculoDias,
              valorOriginal: j.incluirEnCalculoDias,
              seraConvertidoA: j.incluirEnCalculoDias !== undefined ? j.incluirEnCalculoDias : item.incluirEnCalculoDias,
              OBJETO_COMPLETO: j
            });
          });
        }
      });

      const itemsValidados = initialData.itemsCalculadora.map(item => {
        // 🔄 MIGRACIÓN AUTOMÁTICA: Agregar campos faltantes a jornales
        const jornalesMigrados = item.jornales ? item.jornales.map(j => {
          // 🎯 LÓGICA CORREGIDA: Heredar del checkbox del rubro si no existe en el jornal individual
          let incluirEnCalculo;
          if (j.incluirEnCalculoDias !== undefined) {
            // Si el jornal tiene su propio valor, usarlo
            incluirEnCalculo = j.incluirEnCalculoDias;
            console.log(`     🔄 Jornal ${j.rol}: usando valor propio = ${incluirEnCalculo}`);
          } else if (item.incluirEnCalculoDias !== undefined) {
            // Si el jornal no tiene valor pero el rubro sí, heredar del rubro
            incluirEnCalculo = item.incluirEnCalculoDias;
            console.log(`     🔄 Jornal ${j.rol}: heredando del rubro = ${incluirEnCalculo}`);
          } else {
            // Si ni el jornal ni el rubro tienen valor, usar true por defecto
            incluirEnCalculo = true;
            console.log(`     🔄 Jornal ${j.rol}: usando por defecto = ${incluirEnCalculo}`);
          }

          return {
            ...j,
            // ✅ Usar la lógica corregida para heredar del rubro:
            incluirEnCalculoDias: incluirEnCalculo,
            esModoManual: j.esModoManual !== undefined ? j.esModoManual : false,
            tipoProfesional: j.tipoProfesional || j.rol || '',
            total: j.total !== undefined ? j.total : (j.subtotal || 0),
            empresaId: j.empresaId !== undefined ? j.empresaId : Number(empresaSeleccionada?.id || 3),
            presupuestoNoClienteId: j.presupuestoNoClienteId !== undefined ? j.presupuestoNoClienteId : (form.id || null),
            observaciones: j.observaciones !== undefined ? j.observaciones : null,
            // ✅ Agregar aliases para compatibilidad:
            cantidad: j.cantidad !== undefined ? j.cantidad : (j.cantidadJornales || 0),
            valorUnitario: j.valorUnitario !== undefined ? j.valorUnitario : (j.importeJornal || 0)
          };
        }) : [];

        // 🛠️ FIX: Eliminar jornales duplicados por ID dentro de cada item
        const idsJornalesVistos = new Set();
        const jornalesSinDuplicados = [];
        jornalesMigrados.forEach(j => {
          if (!idsJornalesVistos.has(j.id)) {
            idsJornalesVistos.add(j.id);
            jornalesSinDuplicados.push(j);
          } else {
            console.warn(`🗑️ Eliminando jornal duplicado en item ${item.tipoProfesional}: ID=${j.id} rol="${j.rol}"`);
          }
        });
        const jornalesFinales = jornalesSinDuplicados;

        // Calcular subtotal de jornales si existen
        const subtotalJornales = jornalesFinales.reduce((sum, j) => sum + (j.subtotal || 0), 0);

        // ✅ UNIFICACIÓN DE GASTOS PREVIA (para recálculo correcto)
        const gastosRaw = (item.gastosGenerales && item.gastosGenerales.length > 0)
          ? item.gastosGenerales
          : (item.otrosCostos && item.otrosCostos.length > 0 ? item.otrosCostos : []);

        // 🔥 WORKAROUND: El backend NO guarda esGlobal, detectarlo por patrón de descripción
        const gastosUnificados = gastosRaw.map(gasto => {
          let esGlobalDetectado = false;

          // Si viene del backend (sin esGlobal), detectar por descripción
          if (gasto.esGlobal === undefined || gasto.esGlobal === null || gasto.esGlobal === false) {
            const desc = (gasto.descripcion || '').toLowerCase();
            esGlobalDetectado = desc.includes('presupuesto global') ||
                                desc.includes('gastos grales.') ||
                                desc.includes('gastos generales global');

            if (esGlobalDetectado) {
              console.log('🔥 GASTO GLOBAL DETECTADO POR PATRÓN:', gasto.descripcion);
            }
          } else {
            esGlobalDetectado = gasto.esGlobal;
          }

          return {
            ...gasto,
            esGlobal: esGlobalDetectado,
            unidad: esGlobalDetectado ? 'global' : (gasto.unidad || null)
          };
        });

        const subtotalGastosCalc = gastosUnificados.reduce((sum, g) => sum + (Number(g.subtotal) || 0), 0);
        const subtotalGastosFinal = item.subtotalGastosGenerales || subtotalGastosCalc;

        console.log(`🔄 MIGRACIÓN - ${item.tipoProfesional}:`, {
          jornalesOriginales: item.jornales?.length || 0,
          jornalesMigrados: jornalesFinales.length,
          rubroIncluir: item.incluirEnCalculoDias,
          camposAgregados: jornalesFinales.map(j => ({
            rol: j.rol,
            incluirOriginal: j.incluirEnCalculoDias,
            incluirFinal: j.incluirEnCalculoDias,
            heredadoDeRubro: j.incluirEnCalculoDias === item.incluirEnCalculoDias
          }))
        });



        // Recalcular total si es null/undefined O si es 0 pero hay jornales
        const necesitaRecalculo =
          item.total === null ||
          item.total === undefined ||
          (item.total === 0 && subtotalJornales > 0);

        if (necesitaRecalculo) {
          const totalCalculado = (item.subtotalManoObra || 0) +
                                (item.subtotalMateriales || 0) +
                                subtotalGastosFinal +
                                (item.totalManual || 0) +
                                subtotalJornales;
          const itemActualizado = {
            ...item,
            gastosGenerales: gastosUnificados, // ✅ Asegurar visualización
            otrosCostos: gastosUnificados,     // ✅ Asegurar persistencia legacy
            subtotalGastosGenerales: subtotalGastosFinal,
            total: totalCalculado,
            jornales: jornalesFinales, // ✅ Usar jornales sin duplicados
            subtotalJornales: subtotalJornales,
            incluirEnCalculoDias: item.incluirEnCalculoDias ?? true, // ✅ PRESERVAR o usar true por defecto
            trabajaEnParalelo: item.trabajaEnParalelo ?? true // ✅ PRESERVAR o usar true por defecto (ahora el backend lo guarda)
          };

          // DEBUG: Ver qué valor tiene después de validar
          if (item.tipoProfesional?.toLowerCase().includes('albañil')) {
            console.log('🔧 DESPUÉS DE VALIDAR Albañileria - incluirEnCalculoDias:', itemActualizado.incluirEnCalculoDias, 'original:', item.incluirEnCalculoDias);
          }

          return itemActualizado;
        }

        // Ya calculamos gastosUnificados arriba, simplemente los retornamos aquí si no hubo recálculo
        return {
          ...item,
          gastosGenerales: gastosUnificados, // Asegurar visualización
          otrosCostos: gastosUnificados, // Asegurar persistencia legacy
          subtotalGastosGenerales: subtotalGastosFinal,
          jornales: jornalesFinales, // ✅ Usar jornales sin duplicados
          incluirEnCalculoDias: item.incluirEnCalculoDias ?? true, // ✅ PRESERVAR o usar true por defecto
          trabajaEnParalelo: item.trabajaEnParalelo ?? true // ✅ PRESERVAR o usar true por defecto (ahora el backend lo guarda)
        };
      });

      // ✅ NO FILTRAR rubros vacíos - permitir trabajo en cascada
      // Los rubros vacíos son válidos y se pueden completar después
      const itemsFiltrados = itemsValidados;

      // Solo loguear si hay rubros vacíos (para debug)
      itemsValidados.forEach(item => {
        const tieneGastos = item.gastosGenerales && item.gastosGenerales.length > 0;
        const tieneProfesionales = item.profesionales && item.profesionales.length > 0;
        const tieneMateriales = item.materialesLista && item.materialesLista.length > 0;
        const tieneTotalManual = item.totalManual && item.totalManual > 0;
        const tieneJornales = item.jornales && item.jornales.length > 0;
        const tieneContenido = tieneGastos || tieneProfesionales || tieneMateriales || tieneTotalManual || tieneJornales;

        if (!tieneContenido) {
          console.log(`  ℹ️ Rubro vacío (se completará después): ${item.tipoProfesional}`);
        }
      });

      // DEBUG: Ver qué tiene itemsFiltrados ANTES de setear el estado
      console.log('🎯 itemsFiltrados[0] (Albañileria):', {
        tipoProfesional: itemsFiltrados[0]?.tipoProfesional,
        incluirEnCalculoDias: itemsFiltrados[0]?.incluirEnCalculoDias,
        tipo: typeof itemsFiltrados[0]?.incluirEnCalculoDias
      });

      // ✅ HACER COPIA PROFUNDA para evitar mutaciones
      const itemsConCampoPreservado = itemsFiltrados.map(item => ({
        ...item,
        incluirEnCalculoDias: item.incluirEnCalculoDias,
        trabajaEnParalelo: item.trabajaEnParalelo // ✅ PRESERVAR checkbox de inclusión en cálculo
      }));

      console.log('🚀 ANTES DE SETEAR - itemsConCampoPreservado[0]:', {
        tipoProfesional: itemsConCampoPreservado[0]?.tipoProfesional,
        incluirEnCalculoDias: itemsConCampoPreservado[0]?.incluirEnCalculoDias,
        trabajaEnParalelo: itemsConCampoPreservado[0]?.trabajaEnParalelo,
        keys: Object.keys(itemsConCampoPreservado[0] || {}).filter(k => k.includes('incluir') || k.includes('paralelo'))
      });

      console.log('📍 SETITEMSCA LCULADORA #1 - Desde initialData');
      setItemsCalculadora(itemsConCampoPreservado);

      // 💡 INFO: Si se migraron campos faltantes, se aplicarán al guardar el presupuesto
      const seMigraron = itemsConCampoPreservado.some(item =>
        item.jornales && item.jornales.some(j => j.incluirEnCalculoDias !== undefined)
      );

      if (seMigraron) {
        console.log('✅ Datos migrados exitosamente. Los nuevos campos se guardarán al actualizar el presupuesto.');
      }

      // DEBUG: Ver qué quedó después del set (en el próximo render)
      setTimeout(() => {
        console.log('⏰ DESPUÉS DE SET - itemsCalculadora[0]:', {
          tipoProfesional: itemsConCampoPreservado[0]?.tipoProfesional,
          incluirEnCalculoDias: itemsConCampoPreservado[0]?.incluirEnCalculoDias
        });
      }, 100);
    }
  }, [initialData]); // Ejecutar cuando cambian los datos iniciales

  // 🆕 useEffect para sincronizar modoCargaJornales con el formulario
  useEffect(() => {
    if (estaGuardandoRef.current || estaCargandoInicialRef.current) return;
    setForm(prev => ({ ...prev, modoCargaJornales }));
  }, [modoCargaJornales]);

  // 🆕 useEffect para sincronizar modoCargaMateriales con el formulario
  useEffect(() => {
    if (estaGuardandoRef.current || estaCargandoInicialRef.current) return;
    setForm(prev => ({ ...prev, modoCargaMateriales }));
  }, [modoCargaMateriales]);

  // 🆕 useEffect para sincronizar modoCargaGastos con el formulario
  useEffect(() => {
    if (estaGuardandoRef.current || estaCargandoInicialRef.current) return;
    setForm(prev => ({ ...prev, modoCargaGastos }));
  }, [modoCargaGastos]);

  // useEffect para hacer scroll automático a la sección de exportación cuando viene desde "Enviar" (WhatsApp o Email)
  useEffect(() => {
    console.log('🔍 useEffect de auto-envío ejecutado:', {
      show,
      abrirWhatsAppDespuesDePDF,
      abrirEmailDespuesDePDF,
      modoTrabajoExtra,
      condicion: show && (abrirWhatsAppDespuesDePDF || abrirEmailDespuesDePDF)
    });

    if (show && (abrirWhatsAppDespuesDePDF || abrirEmailDespuesDePDF)) {
      console.log('✅ Condición cumplida - Iniciando proceso de auto-envío');
      console.log('📜 Haciendo scroll a sección de exportación...', {
        whatsapp: abrirWhatsAppDespuesDePDF,
        email: abrirEmailDespuesDePDF,
        refExiste: !!guardarPDFButtonRef.current
      });
      const timer = setTimeout(() => {
        if (guardarPDFButtonRef.current) {
          console.log('✅ Ejecutando scroll hacia la sección de exportación');
          guardarPDFButtonRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // 🚀 AUTO-CLICK en el botón de PDF después del scroll
          setTimeout(() => {
            console.log('🚀 AUTO-GENERANDO PDF para envío por WhatsApp/Email...');
            if (guardarPDFButtonRef.current) {
              console.log('✅ Ref disponible, haciendo click en botón PDF...');
              guardarPDFButtonRef.current.click();
            } else {
              console.warn('⚠️ No se pudo hacer auto-click, botón no disponible');
            }
          }, 800); // Esperar 800ms después del scroll
        } else {
          console.warn('⚠️ Ref guardarPDFButtonRef no está disponible todavía');
        }
      }, 1200); // Aumentado a 1200ms para asegurar que el modal esté completamente renderizado
      return () => clearTimeout(timer);
    } else {
      console.log('❌ Condición NO cumplida - No se ejecutará auto-envío');
    }
  }, [show, abrirWhatsAppDespuesDePDF, abrirEmailDespuesDePDF]);

  // 📦 useEffect para cargar gastos generales desde el stock del backend
  useEffect(() => {
    console.log('🚩 [useEffect-1517] Ejecutado');
    const cargarGastosGeneralesStock = async () => {
      // No cargar gastos generales en modo trabajo extra
      if (modoTrabajoExtra) {
        return;
      }

      if (!form.id || !empresaSeleccionada?.id) {
        return; // Solo cargar si hay presupuesto y empresa
      }

      setCargandoGastosStock(true);
      try {
        const response = await apiService.get(
          `/api/v1/presupuestos-no-cliente/${form.id}/gastos-generales`,
          {
            headers: {
              'empresaId': empresaSeleccionada.id.toString()
            }
          }
        );

        if (response.data && Array.isArray(response.data)) {
          // Filtrar solo los activos y disponibles
          const gastosDisponibles = response.data.filter(gasto =>
            gasto.estadoStock === 'DISPONIBLE' && gasto.cantidadDisponible > 0
          );

          setGastosGeneralesStock(gastosDisponibles);
          console.log('📦 Gastos Generales cargados desde stock:', gastosDisponibles.length);
        } else {
          console.warn('📦 Respuesta inesperada del endpoint gastos generales:', response.data);
          setGastosGeneralesStock([]);
        }
      } catch (error) {
        console.error('❌ Error cargando gastos generales del stock:', error);
        setGastosGeneralesStock([]);

        // Solo mostrar error si no es un 404 (puede ser normal si no hay stock configurado)
        if (error.response?.status !== 404) {
          console.warn(`⚠️ Problema cargando gastos generales: ${error.response?.data?.message || error.message}`);
        }
      } finally {
        setCargandoGastosStock(false);
      }
    };

    cargarGastosGeneralesStock();
  }, [form.id, empresaSeleccionada?.id]);

  // ========== FUNCIONES PARA JORNALES ==========
  const agregarJornalCalc = () => {
    // Determinar el rol final
    let rolFinal = '';
    let rolBase = '';

    if (jornalActualCalc.rol === 'Otro') {
      // Si es "Otro", usar el rol personalizado
      if (!jornalActualCalc.rolPersonalizado || !jornalActualCalc.rolPersonalizado.trim()) {
        alert('⚠️ Debe especificar el nombre del rol personalizado completo.');
        return;
      }
      rolFinal = jornalActualCalc.rolPersonalizado.trim();
      rolBase = rolFinal; // Para rol personalizado, base y final son iguales
    } else {
      // Si es un rol predefinido, concatenar con el gentilicio del rubro
      rolBase = jornalActualCalc.rol;

      if (!rolBase || !rolBase.trim()) {
        alert('⚠️ Debe seleccionar un rol (ej: "Oficial", "Ayudante", etc.).');
        return;
      }

      // Concatenar el rol con el gentilicio del rubro
      if (tipoProfesionalCalc && tipoProfesionalCalc.trim()) {
        const gentilicio = convertirRubroAGentilicio(tipoProfesionalCalc.trim());
        rolFinal = `${rolBase} ${gentilicio}`;
      } else {
        rolFinal = rolBase;
      }
    }

    const cantidadJornales = Number(jornalActualCalc.cantidadJornales) || 0;
    const importeJornal = Number(jornalActualCalc.importeJornal) || 0;
    const subtotal = cantidadJornales * importeJornal;

    const nuevoJornal = {
      id: Date.now(),
      rol: rolFinal, // Ej: "Oficial Albañil", "Ayudante Pintor", "Aprendiz Electricista"
      rolBase: rolBase, // Ej: "Oficial" (para poder editar después)
      cantidadJornales: cantidadJornales,
      cantidad: cantidadJornales, // Alias para compatibilidad
      importeJornal: importeJornal,
      valorUnitario: importeJornal, // Alias para compatibilidad
      subtotal: subtotal,
      total: subtotal, // Alias para compatibilidad
      sinCantidad: !jornalActualCalc.cantidadJornales,
      sinImporte: !jornalActualCalc.importeJornal,
      // ✅ CAMPOS OBLIGATORIOS PARA BACKEND:
      incluirEnCalculoDias: true, // Por defecto incluir en cálculo
      esModoManual: false,
      tipoProfesional: rolFinal,
      empresaId: Number(empresaSeleccionada?.id || 3),
      presupuestoNoClienteId: form.id || null,
      observaciones: null
    };

    const nuevaLista = [...jornalesCalc, nuevoJornal];
    setJornalesCalc(nuevaLista);

    // ✅ NO limpiar campos al agregar - permitir agregar múltiples jornales similares rápidamente
    // Los campos solo se limpian con el botón "Limpiar" (fa-eraser)
  };

  const limpiarCamposJornal = () => {
    setJornalActualCalc({
      rol: '',
      rolPersonalizado: '',
      cantidadJornales: '',
      importeJornal: ''
    });
    setMostrarInputRolPersonalizado(false);
  };

  const eliminarJornalCalc = (id) => {
    setJornalesCalc(jornalesCalc.filter(j => j.id !== id));
  };

  const editarJornalCalc = (jornal) => {
    // Usar el rolBase si existe, sino intentar extraerlo del rol completo
    const rolBase = jornal.rolBase || jornal.rol.split(' ')[0]; // Tomar solo la primera palabra como base
    const esRolPredefinido = ROLES_PROFESIONALES.includes(rolBase);

    setJornalActualCalc({
      rol: esRolPredefinido ? rolBase : 'Otro',
      rolPersonalizado: esRolPredefinido ? '' : (jornal.rolBase || jornal.rol),
      cantidadJornales: jornal.cantidadJornales || '',
      importeJornal: jornal.importeJornal || ''
    });

    setMostrarInputRolPersonalizado(!esRolPredefinido);

    setJornalesCalc(jornalesCalc.filter(j => j.id !== jornal.id));

    alert(`💡 Jornal "${jornal.rol}" cargado en el formulario.\n\nComplete los datos y haga clic en "+" para actualizar.`);
  };

  const handleRubroChange = (e) => {
    const nuevoRubro = e.target.value;

    // Resetear el rol cuando cambia el rubro
    setJornalActualCalc({
      ...jornalActualCalc,
      rol: getRolPorDefecto(),
      rolPersonalizado: '',
      importeJornal: '' // Limpiar importe para que se recalcule
    });

    setTipoProfesionalCalc(nuevoRubro);
    setProfesionalesAgregados(false);
    setMaterialesAgregados(false);
    setGastosGeneralesAgregados(false);
    setManoObraMaterialesAgregados(true);
    setMostrarInputRolPersonalizado(false);

    // 🔧 LIMPIAR ARRAYS TEMPORALES cuando cambias manualmente de rubro
    // Esto previene que se acumulen datos de rubros diferentes
    setJornalesCalc([]);
    setProfesionalesCalc([]);
    setMaterialesCalc([]);
    setGastosGeneralesCalc([]);
    setItemEditandoId(null);
    itemEditandoIdRef.current = null;
    window.currentEditingItemId = null;

    // Limpiar descripciones y observaciones
    setDescripcionJornales('');
    setObservacionesJornales('');
    setDescripcionProfesionales('');
    setObservacionesProfesionales('');
    setDescripcionMateriales('');
    setObservacionesMateriales('');
    setDescripcionGastosGenerales('');
    setObservacionesGastosGenerales('');
  };

  const handleRolPersonalizadoChange = (e) => {
    const nuevoRolPersonalizado = e.target.value;

    // Calcular promedio usando el rol personalizado ingresado
    const promedioHonorarios = calcularPromedioHonorariosPorRubroYRol(tipoProfesionalCalc, nuevoRolPersonalizado);

    setJornalActualCalc({
      ...jornalActualCalc,
      rolPersonalizado: nuevoRolPersonalizado,
      importeJornal: promedioHonorarios || jornalActualCalc.importeJornal // Mantener el valor actual si no hay promedio
    });
  };

  const handleRolChange = (e) => {
    const valorSeleccionado = e.target.value;

    // Calcular promedio de honorarios usando el nuevo hook
    const promedioHonorarios = calcularPromedioHonorariosPorRubroYRol(tipoProfesionalCalc, valorSeleccionado);

    setJornalActualCalc({
      ...jornalActualCalc,
      rol: valorSeleccionado,
      rolPersonalizado: '',
      importeJornal: promedioHonorarios || jornalActualCalc.importeJornal // Mantener el valor actual si no hay promedio
    });
    setMostrarInputRolPersonalizado(valorSeleccionado === 'Otro');
  };

  const handleTipoProfesionalChange = (e) => {
    const valorSeleccionado = e.target.value;

    // Calcular promedio de honorarios usando el nuevo hook
    const promedioHonorarios = calcularPromedioHonorariosPorRubroYRol(tipoProfesionalCalc, valorSeleccionado);

    setProfesionalActualCalc({
      ...profesionalActualCalc,
      tipo: valorSeleccionado,
      importeJornal: promedioHonorarios || profesionalActualCalc.importeJornal // Mantener el valor actual si no hay promedio
    });
  };

  // Función para convertir rubros a gentilicios intuitivos
  const convertirRubroAGentilicio = (rubro) => {
    if (!rubro) return '';

    const rubroLower = rubro.toLowerCase().trim();

    // Diccionario de conversiones específicas (ampliado)
    const conversiones = {
      // Albañilería y mampostería
      'albañilería': 'Albañil',
      'albañileria': 'Albañil',
      'albanileria': 'Albañil',
      'lbañileria': 'Albañil', // Fix: error de tipeo común (falta la A)
      'lbañilería': 'Albañil', // Fix: error de tipeo común (falta la A)
      'mampostería': 'Mampostero',
      'mamposteria': 'Mampostero',
      'ladrillero': 'Ladrillero',
      'bloquero': 'Bloquero',

      // Pintura y revestimientos
      'pintura': 'Pintor',
      'pinturería': 'Pintor',
      'pintureria': 'Pintor',
      'revoque': 'Revocador',
      'revestimiento': 'Revestidor',
      'enduido': 'Enduidor',
      'enchape': 'Enchapador',
      'empapelado': 'Empapelador',
      'estucado': 'Estucador',
      'yesería': 'Yesero',
      'yeseria': 'Yesero',

      // Electricidad
      'electricidad': 'Electricista',
      'eléctrico': 'Electricista',
      'electrico': 'Electricista',
      'instalación eléctrica': 'Electricista',
      'instalacion electrica': 'Electricista',

      // Plomería y gas
      'plomería': 'Plomero',
      'plomeria': 'Plomero',
      'gasfitería': 'Gasfiter',
      'gasfiteria': 'Gasfiter',
      'gasista': 'Gasista',
      'cloaca': 'Cloacista',
      'sanitario': 'Sanitarista',
      'desagüe': 'Plomero',
      'desague': 'Plomero',

      // Carpintería y madera
      'carpintería': 'Carpintero',
      'carpinteria': 'Carpintero',
      'madera': 'Carpintero',
      'ebanistería': 'Ebanista',
      'ebanisteria': 'Ebanista',
      'mueblería': 'Mueblero',
      'muebleria': 'Mueblero',
      'parquet': 'Parquetista',
      'deck': 'Deckista',

      // Herrería y metalurgia
      'herrería': 'Herrero',
      'herreria': 'Herrero',
      'soldadura': 'Soldador',
      'estructuras metálicas': 'Herrero',
      'estructuras metalicas': 'Herrero',
      'forjado': 'Forjador',
      'calderería': 'Calderero',
      'caldereria': 'Calderero',

      // Vidrios y aberturas
      'cristalería': 'Cristalero',
      'cristaleria': 'Cristalero',
      'vidriería': 'Vidriero',
      'vidrieria': 'Vidriero',
      'aberturas': 'Aberturista',
      'ventanas': 'Ventanista',
      'aluminio': 'Aluminiero',
      'pvc': 'Instalador PVC',

      // Cerrajería y seguridad
      'cerrajería': 'Cerrajero',
      'cerrajeria': 'Cerrajero',
      'portones': 'Portonero',
      'rejas': 'Rejero',

      // Techos y cubiertas
      'techado': 'Techista',
      'techo': 'Techista',
      'tejado': 'Techista',
      'cubierta': 'Techista',
      'impermeabilización': 'Impermeabilizador',
      'impermeabilizacion': 'Impermeabilizador',
      'membrana': 'Membranista',
      'chapa': 'Chapista',

      // Pisos y revestimientos
      'pisos': 'Colocador',
      'porcelanato': 'Colocador',
      'cerámica': 'Ceramista',
      'ceramica': 'Ceramista',
      'mosaico': 'Mosaiquista',
      'mármol': 'Marmolista',
      'marmol': 'Marmolista',
      'granito': 'Granitero',
      'piso flotante': 'Colocador',
      'vinílico': 'Colocador',
      'vinilico': 'Colocador',
      'baldosa': 'Baldosista',
      'calcáreo': 'Colocador',
      'calcareo': 'Colocador',

      // Drywall y placas
      'durlock': 'Durlockista',
      'drywall': 'Drywallista',
      'placa de yeso': 'Yesero',
      'cielorraso': 'Cielorrasista',
      'tabiquería': 'Tabiquero',
      'tabiqueria': 'Tabiquero',

      // Jardinería y exterior
      'jardinería': 'Jardinero',
      'jardineria': 'Jardinero',
      'paisajismo': 'Paisajista',
      'parquización': 'Parquizador',
      'parquizacion': 'Parquizador',
      'vivero': 'Viverista',
      'poda': 'Podador',
      'riego': 'Riegista',

      // Limpieza y acabados
      'limpieza': 'Limpiador',
      'demolición': 'Demoledor',
      'demolicion': 'Demoledor',
      'escombro': 'Escombrero',
      'excavación': 'Excavador',
      'excavacion': 'Excavador',
      'movimiento de suelos': 'Excavador',
      'zanjeo': 'Zanjeador',
      'nivelación': 'Nivelador',
      'nivelacion': 'Nivelador',

      // Instalaciones especiales
      'aire acondicionado': 'Instalador',
      'climatización': 'Climatizador',
      'climatizacion': 'Climatizador',
      'calefacción': 'Calefaccionista',
      'calefaccion': 'Calefaccionista',
      'ventilación': 'Ventilador',
      'ventilacion': 'Ventilador',
      'ascensor': 'Ascensorista',
      'montacargas': 'Montacargista',

      // Terminaciones
      'colocación': 'Colocador',
      'colocacion': 'Colocador',
      'instalación': 'Instalador',
      'instalacion': 'Instalador',
      'montaje': 'Montador',
      'acabado': 'Acabador',
      'terminación': 'Terminador',
      'terminacion': 'Terminador',
      'pulido': 'Pulidor',
      'lustrado': 'Lustrador',
      'hidrolaqueado': 'Hidrolaqueador',

      // Hormigón y estructuras
      'hormigón': 'Hormigonero',
      'hormigon': 'Hormigonero',
      'encofrado': 'Encofrador',
      'ferralla': 'Ferrallista',
      'hierro': 'Fierrero',
      'columnas': 'Hormigonero',
      'losa': 'Encofrador',
      'fundación': 'Fundador',
      'fundacion': 'Fundador',
      'viga': 'Hormigonero',

      // Aislaciones
      'aislación': 'Aislador',
      'aislacion': 'Aislador',
      'aislamiento térmico': 'Aislador',
      'aislamiento termico': 'Aislador',
      'telgopor': 'Aislador',
      'lana de vidrio': 'Aislador',

      // Otros oficios
      'tapicería': 'Tapicero',
      'tapiceria': 'Tapicero',
      'cortinado': 'Cortinadista',
      'toldo': 'Toldista',
      'marquesina': 'Marquinista',
      'pérgola': 'Pergolista',
      'pergola': 'Pergolista',
      'parrilla': 'Parrillero',
      'barbacoa': 'Barbaquero',
      'fogón': 'Fogonero',
      'fogon': 'Fogonero',
      'chimenea': 'Chimenero',
      'estufa': 'Estufista',
      'piscina': 'Piscinero',
      'natatorio': 'Natatorista',
      'sound system': 'Sonidista',
      'domótica': 'Domotista',
      'domotica': 'Domotista',
      'seguridad': 'Segurista',
      'alarma': 'Alarmista',
      'cctv': 'Instalador CCTV',
      'cámara': 'Instalador',
      'camara': 'Instalador'
    };

    // Buscar coincidencia exacta primero
    if (conversiones[rubroLower]) {
      return conversiones[rubroLower];
    }

    // Reglas generales si no hay coincidencia exacta
    if (rubroLower.endsWith('ería') || rubroLower.endsWith('eria')) {
      // Eliminar el sufijo -ería/-eria (quitar 'ia' = 2 caracteres)
      // Ejemplo: "Plomería" (8) → slice(0, -2) → "Plomer" (6) ✓
      // Ejemplo: "Carpintería" (11) → slice(0, -2) → "Carpinter" (9) ✓
      const sinSufijo = rubro.slice(0, -2);
      // Capitalizar primera letra
      return sinSufijo.charAt(0).toUpperCase() + sinSufijo.slice(1);
    }

    if (rubroLower.endsWith('ción') || rubroLower.endsWith('cion')) {
      // instalación -> Instalador
      return rubro.slice(0, -4) + 'dor';
    }

    if (rubroLower.endsWith('dad')) {
      // electricidad -> Electricista
      return rubro.slice(0, -3) + 'ista';
    }

    // Si no hay regla, devolver el rubro tal cual
    return rubro;
  };

  // ========== FUNCIONES PARA PROFESIONALES ==========
  const agregarProfesionalCalc = () => {

    if (!profesionalActualCalc.tipo || !profesionalActualCalc.tipo.trim()) {
      alert('⚠️ Complete al menos el campo "Tipo de Profesional" (ej: "oficial pintor").\n\n💡 Tip: Puede agregar cantidad y precio después editando el rubro.');
      return;
    }

    const cantidadJornales = Number(profesionalActualCalc.cantidadJornales) || 0;
    const importeJornal = Number(profesionalActualCalc.importeJornal) || 0;
    const subtotal = cantidadJornales * importeJornal;

    const nuevoProfesional = {
      id: Date.now(),
      tipo: profesionalActualCalc.tipo.trim(),
      nombre: profesionalActualCalc.nombre?.trim() || null,
      telefono: profesionalActualCalc.telefono?.trim() || null,
      unidad: profesionalActualCalc.unidad || 'jornales',
      cantidadJornales: cantidadJornales,
      importeJornal: importeJornal,
      subtotal: subtotal,
      sinCantidad: !profesionalActualCalc.cantidadJornales,
      sinImporte: !profesionalActualCalc.importeJornal
    };


    const nuevaLista = [...profesionalesCalc, nuevoProfesional];
    setProfesionalesCalc(nuevaLista);

    // Limpiar campos
    setProfesionalActualCalc({
      tipo: '',
      nombre: '',
      telefono: '',
      unidad: 'jornales',
      cantidadJornales: '',
      importeJornal: ''
    });
  };

  const limpiarCamposProfesional = () => {
    setProfesionalActualCalc({
      tipo: '',
      nombre: '',
      telefono: '',
      unidad: 'jornales',
      cantidadJornales: '',
      importeJornal: ''
    });
  };

  const eliminarProfesionalCalc = (id) => {
    setProfesionalesCalc(profesionalesCalc.filter(p => p.id !== id));
  };

  // 🆕 FUNCIÓN: Manejar selección de material desde catálogo
  const handleSeleccionMaterialCatalogo = (e) => {
    const valor = e.target.value;

    if (valor === 'manual') {
      // Usuario seleccionó "Agregar Manualmente"
      setModoEntradaMaterial('manual');
      setMaterialActualCalc({ descripcion: '', cantidad: '', precioUnitario: '', unidad: 'unidad' });
    } else if (valor === '') {
      // Opción vacía (placeholder)
      setMaterialActualCalc({ descripcion: '', cantidad: '', precioUnitario: '', unidad: 'unidad' });
    } else {
      // Usuario seleccionó un material del catálogo
      const materialSeleccionado = catalogoMateriales.find(m => m.id === parseInt(valor));
      if (materialSeleccionado) {
        setMaterialActualCalc({
          descripcion: materialSeleccionado.nombre || materialSeleccionado.descripcion || '',
          cantidad: '',
          precioUnitario: materialSeleccionado.precioUnitario || materialSeleccionado.precio || '',
          unidad: materialSeleccionado.unidadMedida || materialSeleccionado.unidad || 'unidad'
        });
        console.log('✅ Material seleccionado del catálogo:', materialSeleccionado.nombre);
      }
    }
  };

  // 🆕 FUNCIÓN: Manejar selección de jornal desde catálogo
  const handleSeleccionJornalCatalogo = (e) => {
    const valor = e.target.value;

    if (valor === 'manual') {
      setModoEntradaJornal('manual');
      setJornalActualCalc({ rol: '', rolPersonalizado: '', cantidadJornales: '', importeJornal: '' });
    } else if (valor === '') {
      setJornalActualCalc({ rol: '', rolPersonalizado: '', cantidadJornales: '', importeJornal: '' });
    } else {
      const jornalSeleccionado = catalogoJornales.find(j => j.id === parseInt(valor));
      if (jornalSeleccionado) {
        // Determinar el rol basándose en si tiene nombre o no
        let rolFinal = jornalSeleccionado.rol || jornalSeleccionado.tipoProfesional || '';

        setJornalActualCalc({
          rol: rolFinal.includes('Otro') ? 'Otro' : rolFinal,
          rolPersonalizado: rolFinal.includes('Otro') ? rolFinal : '',
          cantidadJornales: '',
          importeJornal: jornalSeleccionado.valorUnitario || jornalSeleccionado.precio || '',
          nombreProfesional: jornalSeleccionado.nombreProfesional || null
        });
        console.log('✅ Jornal seleccionado del catálogo:', jornalSeleccionado.rol);
      }
    }
  };

  // 🆕 FUNCIÓN: Manejar selección de gasto desde catálogo
  const handleSeleccionGastoCatalogo = (e) => {
    const valor = e.target.value;

    if (valor === 'manual') {
      setModoEntradaGasto('manual');
      setGastoGeneralActual({ descripcion: '', cantidad: '', precioUnitario: '' });
    } else if (valor === '') {
      setGastoGeneralActual({ descripcion: '', cantidad: '', precioUnitario: '' });
    } else {
      const gastoSeleccionado = catalogoGastos.find(g => g.id === parseInt(valor));
      if (gastoSeleccionado) {
        setGastoGeneralActual({
          descripcion: gastoSeleccionado.nombre || gastoSeleccionado.descripcion || '',
          cantidad: '',
          precioUnitario: gastoSeleccionado.precioUnitario || gastoSeleccionado.precio || ''
        });
        console.log('✅ Gasto seleccionado del catálogo:', gastoSeleccionado.nombre);
      }
    }
  };

  const editarProfesionalCalc = (profesional) => {

    setProfesionalActualCalc({
      tipo: profesional.tipo || '',
      nombre: profesional.nombre || '',
      telefono: profesional.telefono || '',
      unidad: profesional.unidad || 'jornales',
      cantidadJornales: profesional.cantidadJornales || '',
      importeJornal: profesional.importeJornal || ''
    });

    setProfesionalesCalc(profesionalesCalc.filter(p => p.id !== profesional.id));

    alert(`💡 Profesional "${profesional.tipo}" cargado en el formulario.\n\nComplete los datos y haga clic en "+" para actualizar.`);
  };

  const agregarMaterialCalc = () => {
    if (!materialActualCalc.descripcion || !materialActualCalc.descripcion.trim()) {
      alert('⚠️ El campo "Descripción/Nombre" del material es obligatorio (ej: "pintura latex").');
      return;
    }

    const unidad = materialActualCalc.unidad || 'unidad';

    const cantidad = Number(materialActualCalc.cantidad) || 0;
    const precioUnitario = Number(materialActualCalc.precioUnitario) || 0;
    const subtotal = cantidad * precioUnitario;

    const nuevoMaterial = {
      id: Date.now(),
      nombre: materialActualCalc.descripcion.trim(), // Backend requiere 'nombre'
      descripcion: materialActualCalc.descripcion.trim(), // Mantener compatibilidad
      unidad: unidad, // Backend requiere 'unidad'
      cantidad: cantidad,
      precioUnitario: precioUnitario, // Frontend usa este nombre
      subtotal: subtotal,
      sinCantidad: !materialActualCalc.cantidad,
      sinPrecio: !materialActualCalc.precioUnitario
    };

    setMaterialesCalc([...materialesCalc, nuevoMaterial]);
    setMaterialActualCalc({ descripcion: '', cantidad: '', precioUnitario: '', unidad: 'unidad' });
  };

  const eliminarMaterialCalc = (id) => {
    setMaterialesCalc(materialesCalc.filter(m => m.id !== id));
  };

  const editarMaterialCalc = (material) => {

    setMaterialActualCalc({
      descripcion: material.descripcion || '',
      cantidad: material.cantidad || '',
      precioUnitario: material.precioUnitario || ''
    });

    setMaterialesCalc(materialesCalc.filter(m => m.id !== material.id));

    alert(`💡 Material "${material.descripcion}" cargado en el formulario.\n\nComplete los datos y haga clic en "+" para actualizar.`);
  };

  const detectarPatronCantidad = (descripcion) => {

    const patrones = [
      /(\d+(?:\.\d+)?)\s*[×x]\s*\d+(?:\.\d+)?\s*\w+/i, // "1 × 20 litros", "2 x 50 kg"
      /(\d+(?:\.\d+)?)\s*[×x]\s*\d+/i,                   // "1 × 20", "2 x 50"
    ];

    for (const patron of patrones) {
      const match = descripcion.match(patron);
      if (match) {
        const cantidadDetectada = parseFloat(match[1]);
        return {
          detectado: true,
          cantidad: cantidadDetectada,
          descripcionOriginal: descripcion
        };
      }
    }

    return { detectado: false, cantidad: null };
  };

  const handleDescripcionMaterialChange = (nuevaDescripcion) => {

    const patron = detectarPatronCantidad(nuevaDescripcion);

    if (patron.detectado) {
      setMaterialActualCalc({
        ...materialActualCalc,
        descripcion: nuevaDescripcion,
        cantidad: patron.cantidad.toString()
      });


      setTimeout(() => {
        const input = document.getElementById('cantidadMaterialInput');
        if (input) {
          input.style.backgroundColor = '#d4edda';
          input.style.borderColor = '#28a745';
          input.style.boxShadow = '0 0 0 0.2rem rgba(40, 167, 69, 0.25)';
          setTimeout(() => {
            input.style.backgroundColor = '';
            input.style.borderColor = '';
            input.style.boxShadow = '';
          }, 3000);
        }
      }, 100);

    } else {
      setMaterialActualCalc({...materialActualCalc, descripcion: nuevaDescripcion});
    }
  };

  const agregarGastoGeneral = () => {
    // Validación de descripción
    if (!gastoGeneralActual.descripcion || !gastoGeneralActual.descripcion.trim()) {
      alert('⚠️ La descripción del gasto es obligatoria.');
      return;
    }

    // Validar que no sea solo "PERSONALIZADO"
    if (gastoGeneralActual.descripcion === 'PERSONALIZADO') {
      alert('⚠️ Debe escribir el nombre del gasto personalizado.');
      return;
    }

    const cantidad = Number(gastoGeneralActual.cantidad) || 0;
    const precioUnitario = Number(gastoGeneralActual.precioUnitario) || 0;
    const subtotal = cantidad * precioUnitario;

    // Validar límite de stock si es un gasto del stock
    const gastoDelStock = gastosGeneralesStock.find(g => g.nombre === gastoGeneralActual.descripcion);
    if (gastoDelStock && cantidad > gastoDelStock.cantidadDisponible) {
      alert(`⚠️ Cantidad solicitada (${cantidad}) supera el stock disponible (${gastoDelStock.cantidadDisponible}) para "${gastoDelStock.nombre}".`);
      return;
    }

    if (subtotal === 0) {
      alert('⚠️ El subtotal no puede ser cero. Ingrese cantidad e importe.');
      return;
    }

    // Crear nuevo gasto
    const nuevoGasto = {
      id: Date.now(),
      descripcion: gastoGeneralActual.descripcion.trim(),
      cantidad: cantidad,
      precioUnitario: precioUnitario,
      subtotal: subtotal,
      sinCantidad: false,
      sinPrecio: false,
      // 📦 Información del stock si corresponde
      ...(gastoDelStock && {
        stockId: gastoDelStock.id,
        categoria: gastoDelStock.categoria,
        esDelStock: true,
        cantidadDisponibleOriginal: gastoDelStock.cantidadDisponible
      })
    };

    // Agregar a lista temporal (igual que profesionales y materiales)
    setGastosGeneralesCalc(prevGastos => [...prevGastos, nuevoGasto]);

    // Limpiar el formulario
    setGastoGeneralActual({ descripcion: '', cantidad: '', precioUnitario: '', cantidadMaxima: null });
  };

  const eliminarGastoGeneralLocal = (id) => {
    console.log('🗑️ TEMPORAL: Eliminando gasto con ID:', id);
    console.log('📋 TEMPORAL: Gastos antes de eliminar:', gastosGeneralesCalc);
    console.log('⚠️ TEMPORAL: Este es un gasto NO guardado aún en itemsCalculadora');

    // Eliminar del estado local (no del backend)
    setGastosGeneralesCalc(prevGastos => {
      const nuevosGastos = prevGastos.filter(g => g.id !== id);
      console.log('📋 TEMPORAL: Gastos después de eliminar:', nuevosGastos);
      return nuevosGastos;
    });

    alert('✅ Gasto TEMPORAL eliminado de la lista.');
  };

  const editarGastoGeneralLocal = (gasto) => {
    // Cargar en el formulario para edición
    setGastoGeneralActual({
      id: gasto.id, // Mantener el ID para identificarlo al actualizar
      descripcion: gasto.descripcion || '',
      cantidad: gasto.cantidad || '',
      precioUnitario: gasto.precioUnitario || ''
    });

    // Remover temporalmente de la lista (se volverá a agregar al hacer clic en +)
    setGastosGeneralesCalc(prevGastos => prevGastos.filter(g => g.id !== gasto.id));

    alert(`💡 Gasto "${gasto.descripcion}" cargado en el formulario.\n\nComplete los datos y haga clic en "+" para actualizar.`);
  };

  // ✨ Nueva función para eliminar gastos generales de un rubro ya guardado
  const eliminarGastoDeRubro = (itemId, gastoId) => {
    console.log('🗑️ Eliminando gasto:', { itemId, gastoId });

    if (!itemId || !gastoId) {
      console.error('❌ IDs inválidos');
      alert('❌ Error: No se pudo eliminar el gasto. IDs inválidos.');
      return;
    }

    // ✅ Si el item está en edición, también actualizar gastosGeneralesCalc
    const esElItemEnEdicion = String(itemEditandoId) === String(itemId);
    if (esElItemEnEdicion) {
      setGastosGeneralesCalc(prevGastos =>
        prevGastos.filter(g => String(g.id) !== String(gastoId))
      );
    }

    let gastoEliminado = false;

    setItemsCalculadora(prevItems => {
      // 🔍 Buscar el gasto en TODOS los items (pueden estar consolidados)
      return prevItems.map(item => {
        if (!item.gastosGenerales || item.gastosGenerales.length === 0) {
          return item;
        }

        const gastoIdStr = String(gastoId);
        const tieneGasto = item.gastosGenerales.some(g => String(g.id) === gastoIdStr);

        if (!tieneGasto) {
          return item;
        }

        console.log('✅ Gasto encontrado en item:', item.tipoProfesional);

        const nuevosGastos = item.gastosGenerales.filter(g => {
          const match = String(g.id) !== gastoIdStr;
          if (!match) {
            console.log('🗑️ Eliminando gasto:', g.descripcion || g.id);
            gastoEliminado = true;
          }
          return match;
        });

        const nuevoSubtotalGastos = nuevosGastos.reduce((sum, g) => sum + (Number(g.subtotal) || 0), 0);

        const nuevoTotal = (item.subtotalManoObra || 0) +
                          (item.subtotalMateriales || 0) +
                          nuevoSubtotalGastos +
                          (item.subtotalJornales || 0) +
                          (item.totalManual || 0);

        return {
          ...item,
          gastosGenerales: nuevosGastos,
          subtotalGastosGenerales: nuevoSubtotalGastos,
          total: nuevoTotal
        };
      });
    });

    if (gastoEliminado) {
      alert('✅ Gasto general eliminado del rubro.');
      // 💾 Guardar cambios en el backend
      setTimeout(() => {
        handleSubmit();
      }, 100);
    } else {
      alert('⚠️ No se encontró el gasto a eliminar.');
    }
  };

  const eliminarJornalDeRubro = (itemId, jornalId) => {
    console.log('🗑️ INICIO eliminarJornalDeRubro:', { itemId, jornalId });

    if (!itemId || !jornalId) {
      console.error('❌ IDs inválidos');
      alert('❌ Error: No se pudo eliminar el jornal. IDs inválidos.');
      return;
    }

    console.log('📋 Estado actual de itemsCalculadora:', itemsCalculadora.length, 'items');

    // ✅ Si el item está en edición, también actualizar jornalesCalc
    const esElItemEnEdicion = String(itemEditandoId) === String(itemId);
    console.log('🔍 ¿Está en edición?', esElItemEnEdicion, 'itemEditandoId:', itemEditandoId);

    if (esElItemEnEdicion) {
      console.log('✏️ Actualizando jornalesCalc temporal');
      setJornalesCalc(prevJornales =>
        prevJornales.filter(j => String(j.id) !== String(jornalId))
      );
    }

    // DEBUG: Ver qué jornales hay ANTES de intentar eliminar
    console.log('🔍 ANTES DE ELIMINAR - itemsCalculadora:', itemsCalculadora.length, 'items');
    itemsCalculadora.forEach((item, idx) => {
      if (item.jornales && item.jornales.length > 0) {
        console.log(`  Item ${idx} "${item.tipoProfesional}" (id=${item.id}): ${item.jornales.length} jornales`);
        item.jornales.forEach((j, jIdx) => {
          console.log(`    ${jIdx}. ID=${j.id} (${typeof j.id}) rol="${j.rol}"`);
        });
      }
    });
    console.log('🔍 Intentando eliminar: itemId=', itemId, '(', typeof itemId, ') jornalId=', jornalId, '(', typeof jornalId, ')');

    // ✅ Variable para detectar si se eliminó (debe estar fuera del setState pero actualizada dentro)
    let jornalFueEliminado = false;

    setItemsCalculadora(prevItems => {
      // 🔍 Buscar el jornal en TODOS los items (pueden estar consolidados)
      return prevItems.map(item => {
        if (!item.jornales || item.jornales.length === 0) {
          return item;
        }

        const jornalIdStr = String(jornalId);
        const tieneJornal = item.jornales.some(j => String(j.id) === jornalIdStr);

        if (!tieneJornal) {
          return item;
        }

        console.log('✅ Jornal encontrado en item:', item.tipoProfesional, '(id:', item.id, ')');

        // ✅ MANTENER los jornales que NO coinciden con el ID (filtrar = eliminar el que coincide)
        const nuevosJornales = item.jornales.filter(j => {
          const esElJornalAEliminar = String(j.id) === jornalIdStr;

          if (esElJornalAEliminar) {
            console.log('🗑️ ELIMINANDO jornal:', j.rol, 'ID:', j.id);
            jornalFueEliminado = true; // ✅ Actualizar flag
            return false; // ❌ NO mantener este jornal
          }

          return true; // ✅ Mantener los demás jornales
        });

        console.log('📊 Jornales después del filtro:', nuevosJornales.length);

        const nuevoSubtotalJornales = nuevosJornales.reduce((sum, j) => sum + (Number(j.subtotal) || 0), 0);

        const nuevoTotal = (item.subtotalManoObra || 0) +
                          (item.subtotalMateriales || 0) +
                          (item.subtotalGastosGenerales || 0) +
                          nuevoSubtotalJornales +
                          (item.totalManual || 0);

        return {
          ...item,
          jornales: nuevosJornales,
          subtotalJornales: nuevoSubtotalJornales,
          total: nuevoTotal
        };
      });
    });

    // ✅ Usar setTimeout para verificar el resultado
    setTimeout(() => {
      if (jornalFueEliminado) {
        console.log('✅ Jornal eliminado exitosamente del estado local');
        alert('✅ Jornal eliminado del rubro.\n\n⚠️ IMPORTANTE: Debe hacer clic en el botón "Guardar Presupuesto" al final del formulario para que los cambios se guarden en la base de datos.');
      } else {
        console.log('❌ No se encontró el jornal para eliminar');
        alert('⚠️ No se encontró el jornal a eliminar.');
      }
    }, 100);
  };

  // 🆕 Función para eliminar materiales individuales de un rubro guardado
  const eliminarMaterialDeRubro = (itemId, materialId) => {
    console.log('🗑️ Eliminando material:', { itemId, materialId });

    if (!itemId || !materialId) {
      console.error('❌ IDs inválidos');
      alert('❌ Error: No se pudo eliminar el material. IDs inválidos.');
      return;
    }

    // ✅ Si el item está en edición, también actualizar materialesCalc
    const esElItemEnEdicion = String(itemEditandoId) === String(itemId);
    if (esElItemEnEdicion) {
      setMaterialesCalc(prevMats =>
        prevMats.filter(m => String(m.id) !== String(materialId))
      );
    }

    let materialEliminado = false;

    setItemsCalculadora(prevItems => {
      // 🔍 Buscar el material en TODOS los items (pueden estar consolidados)
      return prevItems.map(item => {
        if (!item.materialesLista || item.materialesLista.length === 0) {
          return item;
        }

        const materialIdStr = String(materialId);
        const tieneMaterial = item.materialesLista.some(m => String(m.id) === materialIdStr);

        if (!tieneMaterial) {
          return item;
        }

        console.log('✅ Material encontrado en item:', item.tipoProfesional);

        const materialesActuales = item.materialesLista || item.materiales || [];

        const nuevosMateriales = materialesActuales.filter(m => {
          const match = String(m.id) !== String(materialId);
          if (!match) {
            console.log('🗑️ Eliminando material:', m.descripcion || m.id);
            materialEliminado = true;
          }
          return match;
        });

        const nuevoSubtotalMateriales = nuevosMateriales.reduce((sum, m) => sum + (Number(m.subtotal) || 0), 0);

        const nuevoTotal = (item.subtotalManoObra || 0) +
                          nuevoSubtotalMateriales +
                          (item.subtotalGastosGenerales || 0) +
                          (item.subtotalJornales || 0) +
                          (item.totalManual || 0);

        return {
          ...item,
          materialesLista: nuevosMateriales,
          subtotalMateriales: nuevoSubtotalMateriales,
          total: nuevoTotal
        };
      });
    });

    if (materialEliminado) {
      alert('✅ Material eliminado del rubro.');
      // 💾 Guardar cambios en el backend
      setTimeout(() => {
        handleSubmit();
      }, 100);
    } else {
      alert('⚠️ No se encontró el material a eliminar.');
    }
  };

  const guardarEdicionProfesional = () => {
    if (!itemIdProfesionalEditando || !profesionalEditando) return;

    setItemsCalculadora(prevItems => {
      return prevItems.map(item => {
        if (item.id == itemIdProfesionalEditando || item.tipoProfesional === itemIdProfesionalEditando) {
          const profesionalesActualizados = (item.profesionales || []).map(p => {
            if (p.id == profesionalEditando.id) {
              // Recalcular subtotal
              const cantidadJornales = Number(profesionalEditando.cantidadJornales) || 0;
              const importeJornal = Number(profesionalEditando.importeJornal) || 0;
              const nuevoSubtotal = cantidadJornales * importeJornal;

              return {
                ...profesionalEditando,
                subtotal: nuevoSubtotal
              };
            }
            return p;
          });

          const nuevoSubtotalProfesionales = profesionalesActualizados.reduce((sum, p) => sum + (Number(p.subtotal) || 0), 0);
          const nuevoTotal = nuevoSubtotalProfesionales +
                            (item.subtotalMateriales || 0) +
                            (item.subtotalGastosGenerales || 0) +
                            (item.subtotalJornales || 0) +
                            (item.totalManual || 0);

          return {
            ...item,
            profesionales: profesionalesActualizados,
            subtotalManoObra: nuevoSubtotalProfesionales,
            total: nuevoTotal
          };
        }
        return item;
      });
    });

    setShowEditProfesionalModal(false);
    setProfesionalEditando(null);
    setItemIdProfesionalEditando(null);
    alert('✅ Profesional actualizado correctamente.');
  };

  const editarMaterialDeRubro = (itemId, material) => {
    setItemIdMaterialEditando(itemId);
    setMaterialEditando({...material});
    setShowEditMaterialModal(true);
  };

  const guardarEdicionMaterial = () => {
    if (!itemIdMaterialEditando || !materialEditando) return;

    setItemsCalculadora(prevItems => {
      return prevItems.map(item => {
        if (item.id == itemIdMaterialEditando || item.tipoProfesional === itemIdMaterialEditando) {
          const materialesActualizados = (item.materialesLista || []).map(m => {
            if (m.id == materialEditando.id) {
              // Recalcular subtotal
              const cantidad = Number(materialEditando.cantidad) || 0;
              const precioUnitario = Number(materialEditando.precioUnitario) || 0;
              const nuevoSubtotal = cantidad * precioUnitario;

              return {
                ...materialEditando,
                subtotal: nuevoSubtotal
              };
            }
            return m;
          });

          const nuevoSubtotalMateriales = materialesActualizados.reduce((sum, m) => sum + (Number(m.subtotal) || 0), 0);
          const nuevoTotal = (item.subtotalManoObra || 0) +
                            nuevoSubtotalMateriales +
                            (item.subtotalGastosGenerales || 0) +
                            (item.subtotalJornales || 0) +
                            (item.totalManual || 0);

          return {
            ...item,
            materialesLista: materialesActualizados,
            subtotalMateriales: nuevoSubtotalMateriales,
            total: nuevoTotal
          };
        }
        return item;
      });
    });

    setShowEditMaterialModal(false);
    setMaterialEditando(null);
    setItemIdMaterialEditando(null);
    alert('✅ Material actualizado correctamente.');
  };

  const editarJornalDeRubro = (itemId, jornal) => {
    setItemIdJornalEditando(itemId);
    setJornalEditando({...jornal});
    setShowEditJornalModal(true);
  };

  const guardarEdicionJornal = () => {
    if (!itemIdJornalEditando || !jornalEditando) return;

    setItemsCalculadora(prevItems => {
      return prevItems.map(item => {
        if (item.id == itemIdJornalEditando || item.tipoProfesional === itemIdJornalEditando) {
          const jornalesActualizados = (item.jornales || []).map(j => {
            if (j.id == jornalEditando.id) {
              // Recalcular subtotal
              const cantidadJornales = Number(jornalEditando.cantidadJornales || jornalEditando.cantidad) || 0;
              const importeJornal = Number(jornalEditando.importeJornal || jornalEditando.valorUnitario) || 0;
              const nuevoSubtotal = cantidadJornales * importeJornal;

              return {
                ...jornalEditando,
                subtotal: nuevoSubtotal
              };
            }
            return j;
          });

          const nuevoSubtotalJornales = jornalesActualizados.reduce((sum, j) => sum + (Number(j.subtotal) || 0), 0);
          const nuevoTotal = (item.subtotalManoObra || 0) +
                            (item.subtotalMateriales || 0) +
                            (item.subtotalGastosGenerales || 0) +
                            nuevoSubtotalJornales +
                            (item.totalManual || 0);

          return {
            ...item,
            jornales: jornalesActualizados,
            subtotalJornales: nuevoSubtotalJornales,
            total: nuevoTotal
          };
        }
        return item;
      });
    });

    setShowEditJornalModal(false);
    setJornalEditando(null);
    setItemIdJornalEditando(null);
    alert('✅ Jornal actualizado correctamente.');
  };

  const editarGastoDeRubro = (itemId, gasto) => {
    setItemIdGastoEditando(itemId);
    setGastoEditando({...gasto});
    setShowEditGastoModal(true);
  };

  const guardarEdicionGasto = () => {
    if (!itemIdGastoEditando || !gastoEditando) return;

    setItemsCalculadora(prevItems => {
      return prevItems.map(item => {
        if (item.id == itemIdGastoEditando || item.tipoProfesional === itemIdGastoEditando) {
          const gastosActualizados = (item.gastosGenerales || []).map(g => {
            if (g.id == gastoEditando.id) {
              // Recalcular subtotal
              const cantidad = Number(gastoEditando.cantidad) || 0;
              const precioUnitario = Number(gastoEditando.precioUnitario) || 0;
              const nuevoSubtotal = cantidad * precioUnitario;

              return {
                ...gastoEditando,
                subtotal: nuevoSubtotal
              };
            }
            return g;
          });

          const nuevoSubtotalGastos = gastosActualizados.reduce((sum, g) => sum + (Number(g.subtotal) || 0), 0);
          const nuevoTotal = (item.subtotalManoObra || 0) +
                            (item.subtotalMateriales || 0) +
                            nuevoSubtotalGastos +
                            (item.subtotalJornales || 0) +
                            (item.totalManual || 0);

          return {
            ...item,
            gastosGenerales: gastosActualizados,
            subtotalGastosGenerales: nuevoSubtotalGastos,
            total: nuevoTotal
          };
        }
        return item;
      });
    });

    setShowEditGastoModal(false);
    setGastoEditando(null);
    setItemIdGastoEditando(null);
    alert('✅ Gasto actualizado correctamente.');
  };

  const guardarCambiosRubro = () => {
    if (!itemEditandoId) return;

    const itemsActualizados = itemsCalculadora.map(item => {
      if (item.id === itemEditandoId) {
        return {
          ...item,
          descripcion: descripcionCalc || null,
          observaciones: observacionesCalc || null
        };
      }
      return item;
    });

    setItemsCalculadora(itemsActualizados);

    alert('✅ Descripción y observaciones guardadas correctamente');
  };

  const actualizarRubrosConDescripciones = () => {
    const itemsActualizados = itemsCalculadora.map(item => {
      if (item.descripcion || item.observaciones) {
        return item; // Ya tiene datos, no modificar
      }

      let descripcionPorDefecto = '';
      let observacionesPorDefecto = '';

      const tipo = item.tipoProfesional?.toLowerCase() || '';

      if (tipo.includes('pintura')) {
        descripcionPorDefecto = 'Trabajos de pintura integral';
        observacionesPorDefecto = 'Incluye preparación de superficies y aplicación';
      } else if (tipo.includes('electricidad')) {
        descripcionPorDefecto = 'Instalación eléctrica completa';
        observacionesPorDefecto = 'Según normas eléctricas vigentes';
      } else if (tipo.includes('plomeria')) {
        descripcionPorDefecto = 'Instalación sanitaria y pluvial';
        observacionesPorDefecto = 'Materiales de primera calidad';
      }

      return {
        ...item,
        descripcion: descripcionPorDefecto,
        observaciones: observacionesPorDefecto
      };
    });

    setItemsCalculadora(itemsActualizados);
  };

  const crearRubroVacio = () => {
    if (!tipoProfesionalCalc.trim()) {
      alert('⚠️ Debe ingresar el nombre del rubro antes de crearlo');
      return;
    }

    const rubroExistente = itemsCalculadora.find(item =>
      item.tipoProfesional?.toLowerCase() === tipoProfesionalCalc.toLowerCase().trim()
    );

    if (rubroExistente) {
      alert(`⚠️ Ya existe un rubro llamado "${tipoProfesionalCalc}". Use "Editar" para modificarlo o elija otro nombre.`);
      return;
    }

    const nombreRubro = tipoProfesionalCalc.trim();

    const rubroVacio = {
      id: Date.now(),
      tipoProfesional: nombreRubro,
      profesionales: [],
      materialesLista: [],
      cantidadJornales: null,
      importeJornal: null,
      subtotalManoObra: 0,
      subtotalMateriales: 0,
      materialesTotal: null,
      totalManual: null,
      total: 0, // Rubro vacío = $0
      esModoManual: false,
      esRubroVacio: true, // Flag para identificar rubros vacíos
      descripcion: descripcionCalc || null,
      observaciones: observacionesCalc || null
    };

    setItemsCalculadora([...itemsCalculadora, rubroVacio]);

      // ✅ Limpiar todos los campos después de crear el rubro, excepto el input de rubro
      // setTipoProfesionalCalc(''); // No limpiar el input de rubro
    setCantidadJornalesCalc('');
    setImporteJornalCalc('');
    setImporteMaterialesCalc('');
    setTotalManualCalc('');
    setDescripcionCalc('');
    setObservacionesCalc('');
    setDescripcionMateriales('');
    setObservacionesMateriales('');
    setDescripcionTotalManual('');
    setObservacionesTotalManual('');
    setDescripcionProfesionales('');
    setObservacionesProfesionales('');
    setDescripcionGastosGenerales('');
    setObservacionesGastosGenerales('');

    setProfesionalesCalc([]);
    setMaterialesCalc([]);
    setGastosGeneralesCalc([]);
    setJornalesCalc([]);

    setProfesionalActualCalc({ tipo: '', nombre: '', telefono: '', unidad: 'jornales', cantidadJornales: '', importeJornal: '' });
    setMaterialActualCalc({ descripcion: '', cantidad: '', precioUnitario: '', unidad: 'unidad' });
    setGastoGeneralActual({ descripcion: '', cantidad: '', precioUnitario: '' });

    setProfesionalesAgregados(false);
    setMaterialesAgregados(false);
    setGastosGeneralesAgregados(false);
    setJornalesAgregados(false);
    setRubroCreado(false);

    alert(`✅ Rubro "${nombreRubro}" creado exitosamente. Los campos se han limpiado para crear un nuevo rubro.`);

  };

  // ========== CÁLCULOS DE SUBTOTALES ==========
  const subtotalJornales = jornalesCalc.reduce((sum, j) => sum + j.subtotal, 0);

  // --- LOG ANTES DE DECISIÓN JORNALES ---
  // Ejemplo de uso en el bloque de decisión de jornales
  // console.log('🔎 [Jornales] safeData:', safeData, 'esGlobal:', esGlobal, 'jornalesUnicos:', jornalesUnicos);

  const subtotalManoObraProfesionales = profesionalesCalc.reduce((sum, p) => sum + p.subtotal, 0);

  // --- LOG ANTES DE DECISIÓN MATERIALES ---
  // Ejemplo de uso en el bloque de decisión de materiales
  // console.log('🔎 [Materiales] safeData:', safeData, 'esGlobal:', esGlobal, 'mat:', mat);

  const subtotalMaterialesLista = materialesCalc.reduce((sum, m) => sum + m.subtotal, 0);

  // --- LOG ANTES DE DECISIÓN GASTOS ---
  // Ejemplo de uso en el bloque de decisión de gastos
  // console.log('🔎 [Gastos] safeData:', safeData, 'esGlobal:', esGlobal, 'gasto:', gasto);

  const subtotalManoObraCalc = cantidadJornalesCalc && importeJornalCalc
    ? (Number(cantidadJornalesCalc) * Number(importeJornalCalc))
    : 0;

  const totalMaterialesCalc = materialesCalc.length > 0
    ? subtotalMaterialesLista
    : (Number(importeMaterialesCalc) || 0);

  const totalCalculadoCalc = (subtotalManoObraCalc + subtotalJornales + subtotalManoObraProfesionales) + totalMaterialesCalc;

  const aceptarItemCalculadora = () => {

    const tieneValores = profesionalesCalc.length > 0 || materialesCalc.length > 0 || cantidadJornalesCalc || importeJornalCalc || importeMaterialesCalc || totalManualCalc;
    const tieneRubro = tipoProfesionalCalc && tipoProfesionalCalc.trim();

    const esModoEdicion = itemEditandoId !== null;

    let tipoFinal = tipoProfesionalCalc;
    if (esModoEdicion) {
      const itemExistente = itemsCalculadora.find(item => item.id === itemEditandoId);
      tipoFinal = tipoProfesionalCalc || window.tipoParaEdicionActiva || itemExistente?.tipoProfesional;
    }


    if (!tipoFinal || !tipoFinal.trim()) {
      alert('⚠️ Debe especificar el nombre del rubro (ej: "Pintura", "Electricidad", etc.)');
      return;
    }



    let totalFinal = 0;
    if (profesionalesCalc.length > 0 || materialesCalc.length > 0 || (cantidadJornalesCalc && importeJornalCalc) || importeMaterialesCalc) {
      totalFinal = totalCalculadoCalc;
    } else if (totalManualCalc) {
      totalFinal = Number(totalManualCalc);
    }


    const tieneJornales = cantidadJornalesCalc || importeJornalCalc || profesionalesCalc.length > 0;
    const tieneMateriales = importeMaterialesCalc || materialesCalc.length > 0;
    const esModoManual = !tieneJornales && !tieneMateriales && totalManualCalc;

    if (itemEditandoId !== null) {

      const itemExistente = itemsCalculadora.find(item => item.id === itemEditandoId);
      if (!itemExistente) {
        setCantidadJornalesCalc('');
        setImporteJornalCalc('');
        setImporteMaterialesCalc('');
        setTotalManualCalc('');
        setDescripcionCalc('');
        setObservacionesCalc('');
        setDescripcionMateriales('');
        setObservacionesMateriales('');
        setDescripcionTotalManual('');
        setObservacionesTotalManual('');
        setDescripcionProfesionales('');
        setObservacionesProfesionales('');
        setProfesionalesCalc([]);
        setMaterialesCalc([]);
        setGastosGeneralesCalc([]);
        setMaterialActualCalc({ descripcion: '', cantidad: '', precioUnitario: '', unidad: 'unidad' });
        setProfesionalActualCalc({ tipo: '', nombre: '', telefono: '', unidad: 'jornales', cantidadJornales: '', importeJornal: '' });
        setGastoGeneralActual({ descripcion: '', cantidad: '', precioUnitario: '' });
        return;
      }


      const totalManoObraFinal = subtotalManoObraCalc + subtotalManoObraProfesionales;
      const totalMaterialesFinal = totalMaterialesCalc;
      const totalCalculadoFinal = totalManoObraFinal + totalMaterialesFinal;

      const itemActualizado = {
        ...itemExistente, // Mantener metadatos
        id: itemEditandoId, // Mantener el mismo ID
        tipoProfesional: tipoFinal || itemExistente.tipoProfesional || 'Sin especificar',
        profesionales: [...profesionalesCalc],
        materialesLista: [...materialesCalc],
        jornales: jornalesAgregados.length > 0 ? [...jornalesAgregados] : (itemExistente.jornales || []),
        subtotalJornales: subtotalJornales || itemExistente.subtotalJornales || 0,
        subtotalManoObra: totalManoObraFinal,
        subtotalMateriales: totalMaterialesFinal,
        cantidadJornales: cantidadJornalesCalc || null,
        importeJornal: importeJornalCalc || null,
        materialesTotal: importeMaterialesCalc || null,
        totalManual: totalManualCalc || null,
        total: esModoManual
          ? (totalManualCalc ? Number(totalManualCalc) : 0)
          : (totalCalculadoFinal || 0),
        esModoManual: esModoManual || itemExistente.esModoManual,
        descripcion: descripcionCalc || itemExistente.descripcion,
        observaciones: observacionesCalc || itemExistente.observaciones,
        descripcionJornales: descripcionJornales || itemExistente.descripcionJornales,
        observacionesJornales: observacionesJornales || itemExistente.observacionesJornales,
        descripcionMateriales: descripcionMateriales || itemExistente.descripcionMateriales,
        observacionesMateriales: observacionesMateriales || itemExistente.observacionesMateriales,
        descripcionTotalManual: descripcionTotalManual || itemExistente.descripcionTotalManual,
        observacionesTotalManual: observacionesTotalManual || itemExistente.observacionesTotalManual,
        esRubroVacio: false,
        incluirEnCalculoDias: itemExistente.incluirEnCalculoDias // ✅ PRESERVAR campo
      };


      const nuevosItems = itemsCalculadora.map(item =>
        item.id === itemEditandoId ? itemActualizado : item
      );

      setItemsCalculadora(nuevosItems);

      const totalProfs = itemActualizado.profesionales?.length || 0;
      const totalMats = itemActualizado.materialesLista?.length || 0;

      alert(`✅ Rubro "${itemExistente.tipoProfesional}" ACTUALIZADO exitosamente:\n\n📊 CONTENIDO FINAL:\n• Profesionales: ${totalProfs}\n• Materiales: ${totalMats}\n• Total: $${itemActualizado.total.toLocaleString('es-AR')}\n\n💡 Los datos fueron reemplazados con las modificaciones realizadas`);

      setItemEditandoId(null);
    } else {
      const nuevoItem = {
        id: Date.now(), // ID único basado en timestamp
        tipoProfesional: tipoFinal || 'Sin especificar',
        profesionales: [...profesionalesCalc], // ✨ Lista de profesionales agregados
        jornales: jornalesAgregados.length > 0 ? [...jornalesAgregados] : [],
        materialesLista: [...materialesCalc], // ✨ Lista de materiales agregados (desglosados)
        cantidadJornales: cantidadJornalesCalc || null,
        importeJornal: importeJornalCalc || null,
        subtotalJornales: subtotalJornales || 0,
        subtotalManoObra: subtotalManoObraCalc + subtotalManoObraProfesionales,
        subtotalMateriales: totalMaterialesCalc, // Total de materiales (desglosado o general)
        materialesTotal: importeMaterialesCalc || null, // Total general sin desglose
        totalManual: totalManualCalc || null,
        total: totalFinal,
        esModoManual: esModoManual,
        descripcion: descripcionCalc || null,
        observaciones: observacionesCalc || null,
        descripcionJornales: descripcionJornales || null,
        observacionesJornales: observacionesJornales || null,
        descripcionMateriales: descripcionMateriales || null,
        observacionesMateriales: observacionesMateriales || null,
        descripcionTotalManual: descripcionTotalManual || null,
        observacionesTotalManual: observacionesTotalManual || null,
        incluirEnCalculoDias: true // ✅ Por defecto incluir en cálculo de días
      };


      const nuevosItems = [...itemsCalculadora, nuevoItem];

      setItemsCalculadora(nuevosItems);

      alert('✅ Nuevo item creado y agregado al presupuesto');
    }

    setCantidadJornalesCalc('');
    setImporteJornalCalc('');
    setImporteMaterialesCalc('');
    setTotalManualCalc('');
    setDescripcionCalc('');
    setObservacionesCalc('');
    setDescripcionJornales('');
    setObservacionesJornales('');
    setDescripcionMateriales('');
    setObservacionesMateriales('');
    setDescripcionTotalManual('');
    setObservacionesTotalManual('');
    setDescripcionProfesionales('');
    setObservacionesProfesionales('');
    setProfesionalesCalc([]); // ✨ Limpiar lista de profesionales
    setJornalesAgregados([]); // ✨ Limpiar lista de jornales
    setProfesionalActualCalc({ tipo: '', nombre: '', telefono: '', unidad: 'jornales', cantidadJornales: '', importeJornal: '' });
    setMaterialesCalc([]); // ✨ Limpiar lista de materiales
    setMaterialActualCalc({ descripcion: '', cantidad: '', precioUnitario: '', unidad: 'unidad' });
  };


  const agregarProfesionalCalculadora = () => {
    const tieneProfesionales = profesionalesCalc.length > 0 || (cantidadJornalesCalc && importeJornalCalc);
    const tieneAlMenosUnDato = profesionalesCalc.length > 0 || cantidadJornalesCalc || importeJornalCalc;

    if (!tieneAlMenosUnDato) {
      alert('⚠️ Debe agregar al menos un profesional O ingresar cantidad de jornales O importe de jornal para esta sección.\n\n💡 Tip: Puede agregar datos parciales y completar después editando el rubro.');
      return;
    }

    const totalManoObra = subtotalManoObraCalc + subtotalManoObraProfesionales;


    const itemData = {
      tipoProfesional: tipoProfesionalCalc || 'Sin especificar',
      profesionales: [...profesionalesCalc],
      materialesLista: [], // Sin materiales
      cantidadJornales: cantidadJornalesCalc || null,
      importeJornal: importeJornalCalc || null,
      subtotalManoObra: totalManoObra,
      subtotalMateriales: 0, // Sin materiales
      materialesTotal: null,
      totalManual: null, // No es manual
      total: totalManoObra,
      esModoManual: false,
      incluirEnCalculoDias: true, // ✅ NUEVO: Por defecto se incluye en cálculo de días

      descripcionProfesionales: descripcionProfesionales?.trim() || null,
      observacionesProfesionales: observacionesProfesionales?.trim() || null,

      descripcion: descripcionCalc?.trim() || null,
      observaciones: observacionesCalc?.trim() || null
    };

    const currentEditingId = itemEditandoId || itemEditandoIdRef.current || window.currentEditingItemId;

    let itemExistente = null;
    if (currentEditingId !== null && currentEditingId !== undefined) {
      itemExistente = itemsCalculadora.find(item => item.id === currentEditingId);
      if (itemExistente) {
      }
    }

    if (!itemExistente && tipoProfesionalCalc && tipoProfesionalCalc.trim()) {
      itemExistente = itemsCalculadora.find(item =>
        item.tipoProfesional?.toLowerCase() === tipoProfesionalCalc.toLowerCase()
      );
      if (itemExistente) {
      }
    }

    if (itemExistente) {

      const profesionalesCompletos = profesionalesCalc;

      const subtotalManoObraCompleto = profesionalesCompletos.reduce((sum, p) => sum + (p.subtotal || 0), 0);

      // ✅ Calcular subtotal de jornales
      const subtotalJornales = (itemExistente.jornales || []).reduce((sum, j) => {
          const cant = Number(j.cantidadJornales || j.cantidad || 0);
          const val = Number(j.importeJornal || j.valorUnitario || 0);
          const sub = Number(j.subtotal) || (cant * val);
          return sum + sub;
      }, 0);

      const itemActualizado = {
        ...itemExistente, // Mantener todo el contenido existente
        profesionales: profesionalesCompletos,
        cantidadJornales: cantidadJornalesCalc || itemExistente.cantidadJornales,
        importeJornal: importeJornalCalc || itemExistente.importeJornal,
        subtotalManoObra: subtotalManoObraCompleto,
        total: subtotalJornales + subtotalManoObraCompleto + (itemExistente.subtotalMateriales || 0) + (itemExistente.subtotalGastosGenerales || 0) + (itemExistente.totalManual || 0),

        descripcionProfesionales: descripcionProfesionales?.trim() || itemExistente.descripcionProfesionales,
        observacionesProfesionales: observacionesProfesionales?.trim() || itemExistente.observacionesProfesionales,

        descripcion: descripcionCalc || itemExistente.descripcion,
        observaciones: observacionesCalc || itemExistente.observaciones,
        esRubroVacio: false,
        incluirEnCalculoDias: itemExistente.incluirEnCalculoDias !== undefined ? itemExistente.incluirEnCalculoDias : true // ✅ PRESERVAR campo
      };

      setItemsCalculadora(currentItems =>
        currentItems.map(item => {
          // Solo actualizar el item específico por ID, NO por nombre para evitar duplicaciones
          const esElItem = item.id === itemExistente.id;
          return esElItem ? itemActualizado : item;
        })
      );

      alert(`✅ Profesionales agregados al rubro "${itemExistente.tipoProfesional}". Total profesionales: ${itemActualizado.profesionales.length}`);

      setProfesionalesAgregados(true);

      // ⚠️ NO limpiar profesionalesCalc aquí - se necesitan para futuras ediciones del mismo item
      // Los arrays temporales solo se limpian al cancelar edición o iniciar nuevo rubro
      // setProfesionalesCalc([]);
      setProfesionalActualCalc({ tipo: '', nombre: '', telefono: '', unidad: 'jornales', cantidadJornales: '', importeJornal: '' });
      // setCantidadJornalesCalc('');
      // setImporteJornalCalc('');
      setDescripcionProfesionales('');
      setObservacionesProfesionales('');

    } else {
      const nuevoId = Date.now();
      const nuevoItem = {
        ...itemData,
        id: nuevoId
      };

      setItemsCalculadora([...itemsCalculadora, nuevoItem]);

      setItemEditandoId(nuevoId);
      itemEditandoIdRef.current = nuevoId;
      window.currentEditingItemId = nuevoId;

      alert(`✅ Nuevo rubro "${itemData.tipoProfesional}" creado.\n\nAhora puede seguir agregando materiales y gastos generales a este rubro.`);

      setProfesionalesAgregados(true);
    }

    setCantidadJornalesCalc('');
    setImporteJornalCalc('');
    setDescripcionCalc('');
    setObservacionesCalc('');
    setDescripcionMateriales('');
    setObservacionesMateriales('');
    setDescripcionTotalManual('');
    setObservacionesTotalManual('');
    setDescripcionProfesionales('');
    setObservacionesProfesionales('');
    setProfesionalesCalc([]);
    setProfesionalActualCalc({ tipo: '', nombre: '', telefono: '', unidad: 'jornales', cantidadJornales: '', importeJornal: '' });
  };

  const agregarJornalCalculadora = () => {
    const tieneJornales = jornalesCalc.length > 0;

    if (!tieneJornales) {
      alert('⚠️ Debe agregar al menos un jornal (rol) para esta sección.\n\n💡 Tip: Puede agregar datos parciales (ej: solo "Oficial") y completar cantidad/importe después editando el rubro.');
      return;
    }

    const totalJornales = subtotalJornales;

    const itemData = {
      tipoProfesional: tipoProfesionalCalc || 'Sin especificar',
      jornales: [...jornalesCalc], // Nueva propiedad para jornales
      profesionales: [], // Sin profesionales
      materialesLista: [], // Sin materiales
      cantidadJornales: null,
      importeJornal: null,
      subtotalJornales: totalJornales, // Nueva propiedad
      subtotalManoObra: 0,
      subtotalMateriales: 0,
      materialesTotal: null,
      totalManual: null,
      total: totalJornales,
      esModoManual: false,
      incluirEnCalculoDias: true, // ✅ NUEVO: Por defecto se incluye en cálculo de días

      descripcionJornales: descripcionJornales?.trim() || null,
      observacionesJornales: observacionesJornales?.trim() || null,

      descripcion: descripcionCalc?.trim() || null,
      observaciones: observacionesCalc?.trim() || null
    };

    const currentEditingId = itemEditandoId || itemEditandoIdRef.current || window.currentEditingItemId;

    let itemExistente = null;
    if (currentEditingId !== null && currentEditingId !== undefined) {
      itemExistente = itemsCalculadora.find(item => item.id === currentEditingId);
    }

    if (!itemExistente && tipoProfesionalCalc && tipoProfesionalCalc.trim()) {
      itemExistente = itemsCalculadora.find(item =>
        item.tipoProfesional?.toLowerCase() === tipoProfesionalCalc.toLowerCase()
      );
    }

    if (itemExistente) {
      const jornalesCompletos = jornalesCalc;
      const subtotalJornalesCompleto = jornalesCompletos.reduce((sum, j) => sum + (j.subtotal || 0), 0);

      const itemActualizado = {
        ...itemExistente,
        jornales: jornalesCompletos,
        subtotalJornales: subtotalJornalesCompleto,
        total: subtotalJornalesCompleto + (itemExistente.subtotalManoObra || 0) + (itemExistente.subtotalMateriales || 0) + (itemExistente.subtotalGastosGenerales || 0) + (itemExistente.totalManual || 0),

        descripcionJornales: descripcionJornales?.trim() || itemExistente.descripcionJornales,
        observacionesJornales: observacionesJornales?.trim() || itemExistente.observacionesJornales,

        descripcion: descripcionCalc || itemExistente.descripcion,
        observaciones: observacionesCalc || itemExistente.observaciones,
        esRubroVacio: false
      };

      setItemsCalculadora(currentItems =>
        currentItems.map(item => {
          // Solo actualizar el item específico por ID, NO por nombre para evitar duplicaciones
          const esElItem = item.id === itemExistente.id;
          return esElItem ? itemActualizado : item;
        })
      );

      alert(`✅ Jornales agregados al rubro "${itemExistente.tipoProfesional}". Total jornales: ${itemActualizado.jornales.length}`);

      setJornalesAgregados(true);

      // ⚠️ NO limpiar jornalesCalc aquí - se necesitan para futuras ediciones del mismo item
      // Los arrays temporales solo se limpian al cancelar edición o iniciar nuevo rubro
      // setJornalesCalc([]);
      setJornalActualCalc({ rol: getRolPorDefecto(), cantidadJornales: '', importeJornal: '' });
      setDescripcionJornales('');
      setObservacionesJornales('');

    } else {
      const nuevoId = Date.now();
      const nuevoItem = {
        ...itemData,
        id: nuevoId
      };

      setItemsCalculadora([...itemsCalculadora, nuevoItem]);

      setItemEditandoId(nuevoId);
      itemEditandoIdRef.current = nuevoId;
      window.currentEditingItemId = nuevoId;

      alert(`✅ Nuevo rubro "${itemData.tipoProfesional}" creado con jornales.\n\nAhora puede seguir agregando profesionales, materiales y gastos generales a este rubro.`);

      setJornalesAgregados(true);
    }

    // Limpiar campos
    setJornalesCalc([]);
    setJornalActualCalc({ rol: getRolPorDefecto(), cantidadJornales: '', importeJornal: '' });
    setDescripcionJornales('');
    setObservacionesJornales('');
  };

  const agregarMaterialCalculadora = () => {
    const rubroDestino = tipoProfesionalCalc || window.tipoParaEdicionActiva;
    if (!rubroDestino || !rubroDestino.trim()) {
      alert('⚠️ Debe especificar el rubro donde agregar los materiales.\n\n💡 Tip: Escriba el nombre de un rubro existente o cree uno nuevo.');
      return;
    }

    const tieneMateriales = materialesCalc.length > 0 || importeMaterialesCalc;
    const tieneAlMenosUnDato = materialesCalc.length > 0 || importeMaterialesCalc;

    if (!tieneAlMenosUnDato) {
      alert('⚠️ Debe agregar al menos un material O ingresar un total de materiales para esta sección.\n\n💡 Tip: Puede agregar datos parciales (ej: solo "pintura latex") y completar después editando el rubro.');
      return;
    }

    const totalMateriales = totalMaterialesCalc || Number(importeMaterialesCalc) || 0;


    const itemData = {
      tipoProfesional: tipoProfesionalCalc || 'Sin especificar',
      profesionales: [], // Sin profesionales
      materialesLista: [...materialesCalc],
      cantidadJornales: null,
      importeJornal: null,
      subtotalManoObra: 0, // Sin mano de obra
      subtotalMateriales: totalMateriales,
      materialesTotal: importeMaterialesCalc || null,
      totalManual: null, // No es manual
      total: totalMateriales,
      esModoManual: false,
      descripcionMateriales: descripcionMateriales || null,
      observacionesMateriales: observacionesMateriales || null,

      descripcion: descripcionCalc?.trim() || null,
      observaciones: observacionesCalc?.trim() || null
    };

    const currentEditingId = itemEditandoId || itemEditandoIdRef.current || window.currentEditingItemId;

    let itemExistente = null;
    if (currentEditingId !== null && currentEditingId !== undefined) {
      itemExistente = itemsCalculadora.find(item => item.id === currentEditingId);
      if (itemExistente) {
      }
    }

    if (!itemExistente && tipoProfesionalCalc && tipoProfesionalCalc.trim()) {
      itemExistente = itemsCalculadora.find(item =>
        item.tipoProfesional?.toLowerCase() === tipoProfesionalCalc.toLowerCase()
      );
      if (itemExistente) {
      }
    }

    if (itemExistente) {

      const materialesCompletos = materialesCalc;

      const subtotalMaterialesCompleto = materialesCompletos.reduce((sum, m) => {
        let valorItem = 0;
        if (m.subtotal !== undefined && m.subtotal !== null && Number(m.subtotal) > 0) {
            valorItem = Number(m.subtotal);
        } else {
            // Fallback para items importados/antiguos
            const precio = Number(m.precioUnitario || m.presupuestoTotal || m.precio || 0);
            const cantidad = Number(m.cantidad || 1);
            valorItem = precio * cantidad;
        }
        return sum + valorItem;
      }, 0);

      // ✅ Calcular subtotal de jornales
      const subtotalJornales = (itemExistente.jornales || []).reduce((sum, j) => {
          const cant = Number(j.cantidadJornales || j.cantidad || 0);
          const val = Number(j.importeJornal || j.valorUnitario || 0);
          const sub = Number(j.subtotal) || (cant * val);
          return sum + sub;
      }, 0);

      const itemActualizado = {
        ...itemExistente, // Mantener todo el contenido existente
        materialesLista: materialesCompletos,
        subtotalMateriales: subtotalMaterialesCompleto,
        materialesTotal: importeMaterialesCalc || itemExistente.materialesTotal,
        total: subtotalJornales + (itemExistente.subtotalManoObra || 0) + subtotalMaterialesCompleto + (itemExistente.subtotalGastosGenerales || 0) + (itemExistente.totalManual || 0),
        descripcionMateriales: descripcionMateriales || itemExistente.descripcionMateriales,
        observacionesMateriales: observacionesMateriales || itemExistente.observacionesMateriales,

        descripcion: descripcionCalc || itemExistente.descripcion,
        observaciones: observacionesCalc || itemExistente.observaciones,
        esRubroVacio: false
      };

      setItemsCalculadora(currentItems =>
        currentItems.map(item => {
          // Solo actualizar el item específico por ID, NO por nombre para evitar duplicaciones
          const esElItem = item.id === itemExistente.id;
          return esElItem ? itemActualizado : item;
        })
      );

      alert(`✅ Materiales agregados al rubro "${itemExistente.tipoProfesional}". Total materiales: ${itemActualizado.materialesLista.length}`);

      setMaterialesAgregados(true); // ✅ Marcar como agregado

      // ⚠️ NO limpiar materialesCalc aquí - se necesitan para futuras ediciones del mismo item
      // Los arrays temporales solo se limpian al cancelar edición o iniciar nuevo rubro
      // setMaterialesCalc([]);
      setMaterialActualCalc({ descripcion: '', cantidad: '', unidad: 'unidad', importeUnitario: '' });
      // setImporteMaterialesCalc('');
      setDescripcionMateriales('');
      setObservacionesMateriales('');

    } else {
      const rubroDestino = tipoProfesionalCalc.trim();
      const rubroExistente = itemsCalculadora.find(item =>
        item.tipoProfesional.toLowerCase() === rubroDestino.toLowerCase()
      );

      if (rubroExistente) {
        const materialesCompletos = [
          ...(rubroExistente.materialesLista || []),
          ...materialesCalc
        ];

        const subtotalMaterialesCompleto = materialesCompletos.reduce((sum, m) => {
          let valorItem = 0;
          if (m.subtotal !== undefined && m.subtotal !== null && Number(m.subtotal) > 0) {
              valorItem = Number(m.subtotal);
          } else {
              // Fallback para items importados/antiguos
              const precio = Number(m.precioUnitario || m.presupuestoTotal || m.precio || 0);
              const cantidad = Number(m.cantidad || 1);
              valorItem = precio * cantidad;
          }
          return sum + valorItem;
        }, 0);

        const itemActualizado = {
          ...rubroExistente,
          materialesLista: materialesCompletos,
          subtotalMateriales: subtotalMaterialesCompleto,
          total: (rubroExistente.subtotalManoObra || 0) + subtotalMaterialesCompleto + (rubroExistente.totalManual || 0),
          descripcionMateriales: descripcionMateriales || rubroExistente.descripcionMateriales,
          observacionesMateriales: observacionesMateriales || rubroExistente.observacionesMateriales,
          esRubroVacio: false
        };

        setItemsCalculadora(itemsCalculadora.map(item =>
          item.id === rubroExistente.id ? itemActualizado : item
        ));

        alert(`✅ Materiales agregados al rubro "${rubroDestino}". Total materiales: ${materialesCompletos.length}`);

        setMaterialesAgregados(true);
      } else {
        const nuevoId = Date.now();
        const nuevoItem = {
          ...itemData,
          id: nuevoId,
          tipoProfesional: rubroDestino
        };

        setItemsCalculadora([...itemsCalculadora, nuevoItem]);

        setItemEditandoId(nuevoId);
        itemEditandoIdRef.current = nuevoId;
        window.currentEditingItemId = nuevoId;

        alert(`✅ Nuevo rubro "${rubroDestino}" creado con ${materialesCalc.length} materiales.\n\nAhora puede seguir agregando profesionales y gastos generales a este rubro.`);

        setMaterialesAgregados(true);
      }
    }

    setImporteMaterialesCalc('');
    setMaterialesCalc([]);
    setMaterialActualCalc({ descripcion: '', cantidad: '', precioUnitario: '', unidad: 'unidad' });
    setDescripcionMateriales('');
    setObservacionesMateriales('');
  };

  const agregarGastosGeneralesCalculadora = () => {
    if (gastosGeneralesCalc.length === 0) {
      alert('⚠️ Debe agregar al menos un gasto general antes de guardar.');
      return;
    }

    const subtotalGastosGeneralesCompleto = gastosGeneralesCalc.reduce((sum, m) => {
      let valorItem = 0;
      if (m.subtotal !== undefined && m.subtotal !== null && Number(m.subtotal) > 0) {
          valorItem = Number(m.subtotal);
      } else {
          // Fallback para items importados/antiguos
          const precio = Number(m.precioUnitario || m.presupuestoTotal || m.precio || 0);
          const cantidad = Number(m.cantidad || 1);
          valorItem = precio * cantidad;
      }
      return sum + valorItem;
    }, 0);

    const currentEditingId = itemEditandoId || itemEditandoIdRef.current || window.currentEditingItemId;

    let itemExistente = null;
    if (currentEditingId !== null && currentEditingId !== undefined) {
      itemExistente = itemsCalculadora.find(item => item.id === currentEditingId);
    }

    if (!itemExistente && tipoProfesionalCalc && tipoProfesionalCalc.trim()) {
      itemExistente = itemsCalculadora.find(item =>
        item.tipoProfesional?.toLowerCase() === tipoProfesionalCalc.toLowerCase()
      );
    }

    if (itemExistente) {
      // REEMPLAZAR gastos (igual que profesionales y materiales)
      const gastosGeneralesCompletos = gastosGeneralesCalc;

      const subtotalGastosGeneralesCompleto = gastosGeneralesCompletos.reduce((sum, m) => {
        let valorItem = 0;
        if (m.subtotal !== undefined && m.subtotal !== null && Number(m.subtotal) > 0) {
            valorItem = Number(m.subtotal);
        } else {
            // Fallback para items importados/antiguos
            const precio = Number(m.precioUnitario || m.presupuestoTotal || m.precio || 0);
            const cantidad = Number(m.cantidad || 1);
            valorItem = precio * cantidad;
        }
        return sum + valorItem;
      }, 0);

      // ✅ Calcular subtotal de jornales
      const subtotalJornales = (itemExistente.jornales || []).reduce((sum, j) => {
          const cant = Number(j.cantidadJornales || j.cantidad || 0);
          const val = Number(j.importeJornal || j.valorUnitario || 0);
          const sub = Number(j.subtotal) || (cant * val);
          return sum + sub;
      }, 0);

      const itemActualizado = {
        ...itemExistente, // Mantener todo el contenido existente
        gastosGenerales: gastosGeneralesCompletos, // REEMPLAZAR, no acumular
        subtotalGastosGenerales: subtotalGastosGeneralesCompleto,
        total: subtotalJornales + (itemExistente.subtotalManoObra || 0) + (itemExistente.subtotalMateriales || 0) + subtotalGastosGeneralesCompleto + (itemExistente.totalManual || 0),
        descripcionGastosGenerales: descripcionGastosGenerales?.trim() || itemExistente.descripcionGastosGenerales,
        observacionesGastosGenerales: observacionesGastosGenerales?.trim() || itemExistente.observacionesGastosGenerales,

        descripcion: descripcionCalc || itemExistente.descripcion,
        observaciones: observacionesCalc || itemExistente.observaciones,
        esRubroVacio: false,
        otrosCostos: gastosGeneralesCompletos // 🔥 Sincronizar campo heredado para persistencia
      };

      setItemsCalculadora(currentItems =>
        currentItems.map(item => {
          // Solo actualizar el item específico por ID, NO por nombre para evitar duplicaciones
          const esElItem = item.id === itemExistente.id;
          return esElItem ? itemActualizado : item;
        })
      );

      alert(`✅ Gastos generales agregados al rubro "${itemExistente.tipoProfesional}". Total gastos: ${itemActualizado.gastosGenerales.length}`);

      setGastosGeneralesAgregados(true);

      // ⚠️ NO limpiar gastosGeneralesCalc aquí - se necesitan para futuras ediciones del mismo item
      // Los arrays temporales solo se limpian al cancelar edición o iniciar nuevo rubro
      // setGastosGeneralesCalc([]);
      setGastoGeneralActual({ descripcion: '', cantidad: '', precioUnitario: '' });
      setDescripcionGastosGenerales('');
      setObservacionesGastosGenerales('');

    } else {
      // No se encontró item existente, crear uno nuevo
      const rubroDestino = tipoProfesionalCalc.trim();
      const nuevoId = Date.now();
      const nuevoItem = {
        tipoProfesional: rubroDestino,
        profesionales: [],
        materialesLista: [],
        gastosGenerales: [...gastosGeneralesCalc],
        cantidadJornales: null,
        importeJornal: null,
        subtotalManoObra: 0,
        subtotalMateriales: 0,
        subtotalGastosGenerales: subtotalGastosGeneralesCompleto,
        materialesTotal: null,
        totalManual: null,
        total: subtotalGastosGeneralesCompleto,
        esModoManual: false,
        descripcionGastosGenerales: descripcionGastosGenerales || null,
        observacionesGastosGenerales: observacionesGastosGenerales || null,
        descripcion: descripcionCalc?.trim() || null,
        observaciones: observacionesCalc?.trim() || null,
        id: nuevoId,
        otrosCostos: [...gastosGeneralesCalc] // 🔥 Sincronizar campo heredado para persistencia
      };

      setItemsCalculadora([...itemsCalculadora, nuevoItem]);

      setItemEditandoId(nuevoId);
      itemEditandoIdRef.current = nuevoId;
      window.currentEditingItemId = nuevoId;

      alert(`✅ Nuevo rubro "${rubroDestino}" creado con ${gastosGeneralesCalc.length} gastos.\n\nAhora puede seguir agregando profesionales y materiales a este rubro.`);

      setGastosGeneralesAgregados(true);
    }

    setGastosGeneralesCalc([]);
    setGastoGeneralActual({ descripcion: '', cantidad: '', precioUnitario: '' });
    setDescripcionGastosGenerales('');
    setObservacionesGastosGenerales('');
  };

  const agregarTotalManualCalculadora = () => {
    if (!totalManualCalc) {
      alert('⚠️ Debe ingresar un total general para esta sección');
      return;
    }

    const itemData = {
      tipoProfesional: tipoProfesionalCalc || 'Sin especificar',
      profesionales: [],
      materialesLista: [],
      cantidadJornales: null,
      importeJornal: null,
      subtotalManoObra: null,
      subtotalMateriales: null,
      materialesTotal: null,
      totalManual: Number(totalManualCalc),
      total: Number(totalManualCalc),
      esModoManual: true,
      descripcionTotalManual: descripcionTotalManual || null,
      observacionesTotalManual: observacionesTotalManual || null
    };

    const currentEditingId = itemEditandoId || itemEditandoIdRef.current || window.currentEditingItemId;

    if (currentEditingId !== null && currentEditingId !== undefined) {

      let itemExistente = itemsCalculadora.find(item => item.id === currentEditingId);

      // Si no se encuentra por ID, buscar por tipoProfesional (backup)
      if (!itemExistente && tipoProfesionalCalc) {
        itemExistente = itemsCalculadora.find(item =>
          item.tipoProfesional?.toLowerCase() === tipoProfesionalCalc.toLowerCase()
        );
      }

      if (!itemExistente) {
        // Si aún no existe, crear uno nuevo en lugar de dar error
        const nuevoItem = {
          ...itemData,
          id: Date.now()
        };

        setItemsCalculadora([...itemsCalculadora, nuevoItem]);
        alert(`✅ Rubro "${itemData.tipoProfesional}" creado con Total Manual de $${Number(totalManualCalc).toLocaleString('es-AR')}`);

        setTotalManualCalc('');
        setDescripcionTotalManual('');
        setObservacionesTotalManual('');
        return;
      }

      console.log('📊 ANTES DE ACTUALIZAR:');
      console.log('itemExistente:', itemExistente);
      console.log('totalManualCalc:', totalManualCalc);
      console.log('descripcionTotalManual:', descripcionTotalManual);
      console.log('observacionesTotalManual:', observacionesTotalManual);

      const itemActualizado = {
        ...itemExistente, // Mantener todo el contenido existente (profesionales, materiales, etc.)
        totalManual: Number(totalManualCalc),
        total: (itemExistente.subtotalManoObra || 0) +
               (itemExistente.subtotalMateriales || 0) +
               (itemExistente.subtotalGastosGenerales || 0) +
               Number(totalManualCalc), // Sumar el total manual al resto
        esModoManual: true,
        descripcionTotalManual: descripcionTotalManual || itemExistente.descripcionTotalManual,
        observacionesTotalManual: observacionesTotalManual || itemExistente.observacionesTotalManual,
        esRubroVacio: false
      };

      console.log('📊 DESPUÉS DE CREAR itemActualizado:');
      console.log('itemActualizado:', itemActualizado);

      setItemsCalculadora(currentItems => {
        console.log('📊 ITEMS ANTES DE MAPEAR:', currentItems);
        const nuevosItems = currentItems.map(item => {
          if (item.id === currentEditingId) {
            console.log('✅ ENCONTRADO! Reemplazando item con id:', currentEditingId);
            return itemActualizado;
          }
          return item;
        });
        console.log('📊 ITEMS DESPUÉS DE MAPEAR:', nuevosItems);
        return nuevosItems;
      });

      alert(`✅ Total manual actualizado en rubro "${itemExistente.tipoProfesional}": $${Number(totalManualCalc).toLocaleString('es-AR')}`);

    } else {
      const nuevoItem = {
        ...itemData,
        id: Date.now()
      };

      setItemsCalculadora([...itemsCalculadora, nuevoItem]);
      alert('✅ Total manual agregado como nuevo rubro');
    }

    setTotalManualCalc('');
    if (itemEditandoId === null) { // Solo limpiar si NO estamos en modo edición
    }
    setDescripcionCalc('');
    setObservacionesCalc('');
    setDescripcionTotalManual('');
    setObservacionesTotalManual('');
    setDescripcionProfesionales('');
    setObservacionesProfesionales('');
  };

  const eliminarItemCalculadora = (idOrTipo) => {
    if (!idOrTipo) {
      return;
    }


    const esId = typeof idOrTipo === 'number' || !isNaN(Number(idOrTipo));

    if (esId) {
      const itemAEliminar = itemsCalculadora.find(item => item.id === idOrTipo);
      if (itemAEliminar) {
        if (window.confirm(`¿Está seguro que desea eliminar el rubro "${itemAEliminar.tipoProfesional}"?\n\nEsta acción no se puede deshacer.`)) {
          const nuevosItems = itemsCalculadora.filter(item => item.id !== idOrTipo);
          setItemsCalculadora(nuevosItems);

          // 💾 Guardar cambios en el backend
          setTimeout(() => {
            handleSubmit();
          }, 100);
        }
      } else {
      }
    } else {
      const itemsDelRubro = itemsCalculadora.filter(item =>
        item.tipoProfesional?.toLowerCase() === idOrTipo.toLowerCase()
      );

      if (itemsDelRubro.length > 0) {
        const mensaje = itemsDelRubro.length === 1
          ? `¿Está seguro que desea eliminar el rubro "${idOrTipo}"?`
          : `¿Está seguro que desea eliminar el rubro "${idOrTipo}" y todos sus items (${itemsDelRubro.length} items)?`;

        const totalJornales = itemsDelRubro.reduce((sum, i) => sum + (i.jornales?.length || 0), 0);
        const totalProfesionales = itemsDelRubro.reduce((sum, i) => sum + (i.profesionales?.length || 0), 0);
        const totalMateriales = itemsDelRubro.reduce((sum, i) => sum + (i.materialesLista?.length || 0), 0);
        const totalGastos = itemsDelRubro.reduce((sum, i) => sum + (i.gastosGenerales?.length || 0), 0);

        if (window.confirm(`${mensaje}\n\nEsta acción eliminará:\n- ${totalJornales} jornales\n- ${totalProfesionales} profesionales\n- ${totalMateriales} materiales\n- ${totalGastos} gastos generales\n\nEsta acción no se puede deshacer.`)) {
          const nuevosItems = itemsCalculadora.filter(item =>
            item.tipoProfesional?.toLowerCase() !== idOrTipo.toLowerCase()
          );

          console.log('🗑️ Eliminando rubro:', idOrTipo);
          console.log('📊 Items antes:', itemsCalculadora.length);
          console.log('📊 Items después:', nuevosItems.length);

          // Actualizar estado
          setItemsCalculadora(nuevosItems);

          // NO guardar automáticamente - dejar que el usuario guarde manualmente
          // El estado ya se actualizó en pantalla
          console.log('✅ Rubro eliminado. Recuerde guardar el presupuesto.');
        }
      } else {
        alert(`No se encontraron items del rubro "${idOrTipo}"`);
      }
    }
  };

  // 🎯 NUEVA FUNCIÓN: Calcular días hábiles automáticamente desde jornales de rubros marcados
  const calcularDiasHabilesAutomatico = useCallback(() => {
    if (!itemsCalculadora || itemsCalculadora.length === 0) {
      return { total: 0, desglose: [] };
    }

    let totalDiasHabiles = 0;
    const desglose = [];

    // 🎯 Array para rubros incluidos en el cálculo
    const rubrosSimultaneos = [];

    // Iterar sobre cada rubro y calcular días por rubro (MÁXIMO de jornales de oficiales dentro del rubro)
    itemsCalculadora.forEach(item => {
      // ✅ FILTRAR rubros duplicados/legacy
      const esLegacyDuplicado = item.tipoProfesional?.toLowerCase().includes('migrado') ||
                                item.tipoProfesional?.toLowerCase().includes('legacy') ||
                                item.descripcion?.toLowerCase().includes('migrados desde tabla legacy');

      if (esLegacyDuplicado) {
        console.warn('⚠️ Saltando rubro legacy en cálculo de días:', item.tipoProfesional);
        return;
      }

      // DEBUG específico para Pintura
      if (item.tipoProfesional?.toLowerCase().includes('pintura')) {
        console.log('🎨 DEBUG PINTURA - Estado completo:', {
          tipoProfesional: item.tipoProfesional,
          incluirEnCalculoDias: item.incluirEnCalculoDias,
          trabajaEnParalelo: item.trabajaEnParalelo,
          jornales: item.jornales?.length || 0,
          cantidadJornales: item.cantidadJornales
        });
      }

      // 🔥 LÓGICA: Tomar el MÁXIMO de jornales de TODOS los roles del rubro
      // Todos los roles trabajan EN PARALELO (simultáneamente)
      // Solo cuenta el rol que tiene más días
      let jornalesRubro = 0;
      let detallePorRol = [];

      // Solo loguear si NO estamos en carga inicial (para evitar spam de 859 mensajes)
      if (!estaCargandoInicialRef.current) {
        console.log(`🔍 Calculando días para rubro: ${item.tipoProfesional}`, {
          jornales: item.jornales,
          cantidadJornales: item.cantidadJornales,
          incluirEnCalculoDias: item.incluirEnCalculoDias
        });
      }

      // Analizar jornales del array de jornales (por rol) - PRIORIDAD
      if (item.jornales && Array.isArray(item.jornales) && item.jornales.length > 0) {
        if (!estaCargandoInicialRef.current) {
          console.log(`  📋 Procesando ${item.jornales.length} jornales del array...`);
        }

        let todosLosJornalesIncluidos = []; // Array para almacenar días de TODOS los roles marcados

        item.jornales.forEach((j, index) => {
          const cantidadJornal = Number(j.cantidad || j.cantidadJornales || 0);

          // Verificar si este jornal específico está incluido en el cálculo (usar true por defecto si undefined)
          const incluirJornal = j.incluirEnCalculoDias !== undefined ? j.incluirEnCalculoDias : true;

          if (!estaCargandoInicialRef.current) {
            console.log(`    🔹 Jornal ${index + 1}:`, {
              rol: j.tipoProfesional || j.rol,
              cantidad: cantidadJornal,
              incluido: incluirJornal
            });
          }

          if (cantidadJornal > 0) {
            detallePorRol.push({
              rol: j.tipoProfesional || j.rol || 'Rol sin nombre',
              cantidad: cantidadJornal,
              incluido: incluirJornal
            });

            // 🎯 Si está marcado para incluir, agregarlo al array
            if (incluirJornal) {
              todosLosJornalesIncluidos.push(cantidadJornal);
              if (!estaCargandoInicialRef.current) {
                console.log(`      ✅ ${j.tipoProfesional || j.rol} - ${cantidadJornal} días agregado`);
              }
            } else {
              if (!estaCargandoInicialRef.current) {
                console.log(`      ❌ Excluido del cálculo de días`);
              }
            }
          }
        });

        // 🎯 Tomar el MÁXIMO de jornales de TODOS los roles (trabajan en paralelo)
        if (todosLosJornalesIncluidos.length > 0) {
          jornalesRubro = Math.max(...todosLosJornalesIncluidos);
          if (!estaCargandoInicialRef.current) {
            console.log(`      📊 MÁXIMO de todos los roles: ${jornalesRubro} días (de ${todosLosJornalesIncluidos.join(', ')})`);
          }
        }
      }
      // Solo usar campo legacy si NO hay array de jornales
      else if (item.cantidadJornales) {
        const cantidadLegacy = Number(item.cantidadJornales) || 0;
        if (!estaCargandoInicialRef.current) {
          console.log(`  📋 Usando campo legacy cantidadJornales: ${cantidadLegacy}`);
        }
        // Para legacy, usar el checkbox del rubro (usar true por defecto si undefined)
        const incluirLegacy = item.incluirEnCalculoDias !== undefined ? item.incluirEnCalculoDias : true;
        if (cantidadLegacy > 0) {
          detallePorRol.push({
            rol: 'Legacy',
            cantidad: cantidadLegacy,
            esOficial: true, // Legacy se considera como oficial para mantener compatibilidad
            incluido: incluirLegacy
          });

          if (incluirLegacy) {
            jornalesRubro = cantidadLegacy; // Para legacy, usar el valor directamente
            if (!estaCargandoInicialRef.current) {
              console.log(`      ✅ Usando legacy ${cantidadLegacy} días`);
            }
          } else {
            if (!estaCargandoInicialRef.current) {
              console.log(`      ❌ Legacy excluido del cálculo`);
            }
          }
        }
      }

      if (!estaCargandoInicialRef.current) {
        console.log(`  🎯 Total días del rubro ${item.tipoProfesional}: ${jornalesRubro}`);
      }

      // 🎯 Verificar checkbox "Incluir rubro en cálculo días" del RUBRO
      // Por defecto true si no está definido (compatibilidad con datos legacy)
      const incluirRubroEnCalculo = item.incluirEnCalculoDias !== false;

      if (!estaCargandoInicialRef.current) {
        console.log(`  📋 Checkbox del rubro "${item.tipoProfesional}" - incluirEnCalculoDias: ${incluirRubroEnCalculo}`);
      }

      if (jornalesRubro > 0 && incluirRubroEnCalculo) {
        const rolesIncluidos = detallePorRol.filter(r => r.incluido);
        const rolesExcluidos = detallePorRol.filter(r => !r.incluido);

        let explicacion = '';
        if (rolesIncluidos.length > 0) {
          if (rolesIncluidos.length === 1) {
            explicacion = `${rolesIncluidos[0].rol}: ${rolesIncluidos[0].cantidad} días`;
          } else {
            const dias = rolesIncluidos.map(r => r.cantidad);
            const max = Math.max(...dias);
            explicacion = `MÁXIMO: ${rolesIncluidos.map(r => `${r.rol}(${r.cantidad}d${r.cantidad === max ? '⭐' : ''})`).join(', ')} → ${max} días`;
          }
          if (rolesExcluidos.length > 0) {
            explicacion += ` | Excluidos: ${rolesExcluidos.map(r => `${r.rol}(${r.cantidad}d)`).join(', ')}`;
          }
        }

        const rubroInfo = {
          rubro: item.tipoProfesional || 'Sin nombre',
          jornales: jornalesRubro,
          detallePorRol: detallePorRol,
          explicacion: explicacion || 'Sin oficiales marcados',
          trabajaEnParalelo: true // Si llegó aquí, está incluido
        };

        // Todos los rubros incluidos se tratan como SIMULTÁNEOS
        // (la funcionalidad secuencial se implementará en una futura versión si se necesita)
        rubrosSimultaneos.push(rubroInfo);
      } else if (jornalesRubro > 0 && !incluirRubroEnCalculo) {
        // 🚫 Rubro EXCLUIDO del cálculo (checkbox destildado)
        if (!estaCargandoInicialRef.current) {
          console.log(`⏭️ Rubro EXCLUIDO del cálculo: ${item.tipoProfesional} (${jornalesRubro} días no se suman)`);
        }

        // Agregar al desglose como excluido para que el usuario vea por qué no suma
        desglose.push({
          rubro: item.tipoProfesional || 'Sin nombre',
          jornales: jornalesRubro,
          detallePorRol: detallePorRol,
          explicacion: `❌ EXCLUIDO - No suma al total`,
          trabajaEnParalelo: false,
          modo: 'excluido'
        });
      }
    });

    // 🔥 CALCULAR DÍAS FINALES:
    // Rubros incluidos trabajan en SECUENCIA (se SUMAN)
    // Dentro de cada rubro se usó MAX (oficiales del mismo rubro trabajan en paralelo)

    let diasFinales = 0;

    if (rubrosSimultaneos.length > 0) {
      // SUMA de días de todos los rubros incluidos (trabajan en secuencia)
      diasFinales = rubrosSimultaneos.reduce((sum, r) => sum + r.jornales, 0);

      if (!estaCargandoInicialRef.current) {
        console.log(`📊 Rubros INCLUIDOS (SUMA SECUENCIAL): ${diasFinales} días`, rubrosSimultaneos.map(r => `${r.rubro}(${r.jornales}d)`));
      }

      // Agregar desglose de incluidos
      rubrosSimultaneos.forEach(r => {
        desglose.push({
          ...r,
          modo: 'incluido',
          explicacion: `✅ INCLUIDO: ${r.explicacion}`
        });
      });
    }

    if (!estaCargandoInicialRef.current) {
      console.log(`🏁 TOTAL DÍAS HÁBILES: ${diasFinales}`);
      console.log(`📊 Desglose completo:`, desglose);
    }

    return { total: diasFinales, desglose };
  }, [itemsCalculadora]);

  // 🔄 useEffect: Actualizar automáticamente el campo tiempoEstimadoTerminacion cuando cambian los rubros o checkboxes
  useEffect(() => {
    console.log('🚩 [useEffect-4020] Ejecutado');
    // 🚫 NO EJECUTAR si el modo automático está desactivado
    if (form.calculoAutomaticoDiasHabiles === false) {
      return;
    }
  console.log('🚩 [useEffect-4511] Ejecutado');
    // 🚫 NO EJECUTAR si estamos cargando initialData (evitar loop infinito)
    if (estaCargandoInicialRef.current) {
      return;
    }

    // 🚫 NO EJECUTAR si estamos guardando (evitar loop infinito)
    if (estaGuardandoRef.current) {
      return;
    }

    // 🚫 NO EJECUTAR si estamos cargando un presupuesto existente (tiene ID) Y es la primera carga
    if (form.id && itemsCalculadora.length === 0) {
      return;
    }

    if (!itemsCalculadora || itemsCalculadora.length === 0) {
      // Si no hay items, limpiar el campo solo si NO es un presupuesto existente
      if (!form.id && form.tiempoEstimadoTerminacion !== 0 && form.tiempoEstimadoTerminacion !== '') {
        setForm(prev => ({
          ...prev,
          tiempoEstimadoTerminacion: 0
        }));
      }
      return;
    }

    const { total } = calcularDiasHabilesAutomatico();

    // Actualizar SIEMPRE automáticamente (incluso si el usuario modificó el valor)
    const valorActual = Number(form.tiempoEstimadoTerminacion) || 0;
    if (total !== valorActual) {
      setForm(prev => ({
        ...prev,
        tiempoEstimadoTerminacion: total
      }));
    }
  }, [itemsCalculadora, calcularDiasHabilesAutomatico, form.calculoAutomaticoDiasHabiles, form.id, form.tiempoEstimadoTerminacion]);

  const iniciarNuevoRubro = () => {

    setItemEditandoId(null);
    itemEditandoIdRef.current = null;
    window.currentEditingItemId = null;

    setProfesionalesAgregados(false);
    setMaterialesAgregados(false);
    setGastosGeneralesAgregados(false);
    setRubroCreado(false);

    setTipoProfesionalCalc('');
    setCantidadJornalesCalc('');
    setImporteJornalCalc('');
    setImporteMaterialesCalc('');
    setTotalManualCalc('');
    setDescripcionCalc('');
    setObservacionesCalc('');
    setDescripcionMateriales('');
    setObservacionesMateriales('');
    setDescripcionTotalManual('');
    setObservacionesTotalManual('');
    setDescripcionProfesionales('');
    setObservacionesProfesionales('');
    setDescripcionGastosGenerales('');
    setObservacionesGastosGenerales('');

    setProfesionalesCalc([]);
    setMaterialesCalc([]);
    setGastosGeneralesCalc([]);
    setJornalesCalc([]); // ✅ LIMPIAR JORNALES TAMBIÉN
    setJornalesAgregados(false); // ✅ RESETEAR ESTADO DE JORNALES

    setProfesionalActualCalc({ tipo: '', nombre: '', telefono: '', unidad: 'jornales', cantidadJornales: '', importeJornal: '' });
    setMaterialActualCalc({ descripcion: '', cantidad: '', precioUnitario: '', unidad: 'unidad' });
    setGastoGeneralActual({ descripcion: '', cantidad: '', precioUnitario: '' });

    setRubroGastoGeneral('General');
    setItemEditandoId(null); // 🔧 Salir del modo edición

  };

  const guardarRubroCompletoyLimpiar = () => {
    const hayJornales = jornalesCalc.length > 0;
    const hayProfesionales = profesionalesCalc.length > 0 || (cantidadJornalesCalc && importeJornalCalc);
    const hayMateriales = materialesCalc.length > 0 || importeMaterialesCalc;
    const hayGastosGenerales = gastosGeneralesCalc.length > 0;
    const hayTotalManual = totalManualCalc;

    // ✅ PERMITIR guardar rubro vacío para completar en cascada (modo edición iterativa)
    // Solo validar que NO haya datos si es un rubro completamente nuevo (sin ID)
    const esRubroNuevo = !itemEditandoId;
    const tieneAlgunDato = hayJornales || hayProfesionales || hayMateriales || hayGastosGenerales || hayTotalManual;

    if (esRubroNuevo && !tieneAlgunDato) {
      const confirmar = window.confirm(
        '⚠️ Está guardando un rubro sin datos (solo con nombre).\n\n' +
        '¿Desea continuar? Podrá agregar jornales, materiales, etc. después editando el rubro.'
      );
      if (!confirmar) return;
    }

    if (!tipoProfesionalCalc?.trim()) {
      alert('⚠️ Debe especificar un nombre para el rubro antes de guardarlo.');
      return;
    }

    const subtotalProfesionales = hayProfesionales
      ? profesionalesCalc.reduce((sum, p) => sum + (p.subtotal || 0), 0) + (cantidadJornalesCalc && importeJornalCalc ? cantidadJornalesCalc * importeJornalCalc : 0)
      : 0;

    const subtotalMateriales = hayMateriales
      ? materialesCalc.reduce((sum, m) => sum + (m.subtotal || 0), 0) + (importeMaterialesCalc ? parseFloat(importeMaterialesCalc) : 0)
      : 0;

    const subtotalGG = hayGastosGenerales
      ? gastosGeneralesCalc.reduce((sum, g) => sum + (g.subtotal || 0), 0)
      : 0;

    const totalManual = hayTotalManual ? parseFloat(totalManualCalc) : 0;

    const totalCompleto = subtotalProfesionales + subtotalMateriales + subtotalGG + totalManual;

    const rubroCompleto = {
      id: itemEditandoId || `item_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      tipoProfesional: tipoProfesionalCalc.trim(),

      descripcionProfesionales: descripcionProfesionales?.trim() || null,
      observacionesProfesionales: observacionesProfesionales?.trim() || null,
      descripcionMateriales: descripcionMateriales?.trim() || null,
      observacionesMateriales: observacionesMateriales?.trim() || null,
      descripcionGastosGenerales: descripcionGastosGenerales?.trim() || null,
      observacionesGastosGenerales: observacionesGastosGenerales?.trim() || null,
      descripcionTotalManual: descripcionTotalManual?.trim() || null,
      observacionesTotalManual: observacionesTotalManual?.trim() || null,

      profesionales: hayProfesionales ? [...profesionalesCalc] : [],
      jornales: jornalesCalc.length > 0 ? [...jornalesCalc] : [], // ✅ GUARDAR JORNALES
      cantidadJornales: cantidadJornalesCalc || null,
      importeJornal: importeJornalCalc || null,
      subtotalManoObra: subtotalProfesionales,

      materialesLista: hayMateriales ? [...materialesCalc] : [],
      materialesTotal: importeMaterialesCalc ? parseFloat(importeMaterialesCalc) : null,
      subtotalMateriales: subtotalMateriales,

      gastosGenerales: hayGastosGenerales ? [...gastosGeneralesCalc] : [],
      subtotalGastosGenerales: subtotalGG,

      totalManual: totalManual || null,
      esModoManual: hayTotalManual,

      total: totalCompleto,

      esRubroVacio: false,
      incluirEnCalculoDias: true // ✅ Por defecto incluir nuevos rubros en cálculo
    };

    console.log('🎯🎯 GUARDAR RUBRO - rubroCompleto creado:', {
      tipoProfesional: rubroCompleto.tipoProfesional,
      incluirEnCalculoDias: rubroCompleto.incluirEnCalculoDias,
      tieneKey: Object.keys(rubroCompleto).includes('incluirEnCalculoDias'),
      itemEditandoId: itemEditandoId
    });

      if (itemEditandoId) {
      console.log('🔀 RAMA: Actualizando item existente');
      setItemsCalculadora(currentItems =>
        currentItems.map(item => {
          if (item.id === itemEditandoId) {
            const itemExistente = item;

            console.log('🔍 ACTUALIZANDO ITEM en guardarRubro - itemExistente:', {
              tipoProfesional: itemExistente.tipoProfesional,
              incluirEnCalculoDias: itemExistente.incluirEnCalculoDias,
              tieneKey: Object.keys(itemExistente).includes('incluirEnCalculoDias')
            });

            // ✅ REEMPLAZAR SIEMPRE: Los arrays temporales reflejan el estado actual completo
            // Los arrays fueron cargados al hacer clic en "Editar" con los datos existentes
            // Si el usuario agregó/eliminó items, esos cambios están reflejados en los arrays temporales
            const itemActualizado = {
              ...itemExistente, // Preservar todo lo existente
              tipoProfesional: tipoProfesionalCalc.trim(), // Actualizar nombre del rubro

              descripcionProfesionales: descripcionProfesionales?.trim() || itemExistente.descripcionProfesionales || null,
              observacionesProfesionales: observacionesProfesionales?.trim() || itemExistente.observacionesProfesionales || null,
              descripcionJornales: descripcionJornales?.trim() || itemExistente.descripcionJornales || null,
              observacionesJornales: observacionesJornales?.trim() || itemExistente.observacionesJornales || null,
              descripcionMateriales: descripcionMateriales?.trim() || itemExistente.descripcionMateriales || null,
              observacionesMateriales: observacionesMateriales?.trim() || itemExistente.observacionesMateriales || null,
              descripcionGastosGenerales: descripcionGastosGenerales?.trim() || itemExistente.descripcionGastosGenerales || null,
              observacionesGastosGenerales: observacionesGastosGenerales?.trim() || itemExistente.observacionesGastosGenerales || null,
              descripcionTotalManual: descripcionTotalManual?.trim() || itemExistente.descripcionTotalManual || null,
              observacionesTotalManual: observacionesTotalManual?.trim() || itemExistente.observacionesTotalManual || null,

              // ✅ SIEMPRE REEMPLAZAR: Los arrays temporales son la fuente de verdad en modo edición
              profesionales: [...profesionalesCalc],
              jornales: [...jornalesCalc],
              materialesLista: [...materialesCalc],
              gastosGenerales: [...gastosGeneralesCalc],

              // Recalcular subtotales basados en los arrays temporales
              cantidadJornales: cantidadJornalesCalc || itemExistente.cantidadJornales,
              importeJornal: importeJornalCalc || itemExistente.importeJornal,
              subtotalManoObra: profesionalesCalc.reduce((sum, p) => sum + (p.subtotal || 0), 0),
              subtotalJornales: jornalesCalc.reduce((sum, j) => sum + (j.subtotal || 0), 0),
              subtotalMateriales: materialesCalc.reduce((sum, m) => sum + (m.subtotal || 0), 0),
              subtotalGastosGenerales: gastosGeneralesCalc.reduce((sum, g) => sum + (g.subtotal || 0), 0),

              materialesTotal: importeMaterialesCalc ? parseFloat(importeMaterialesCalc) : itemExistente.materialesTotal,
              totalManual: totalManual || itemExistente.totalManual || null,
              esModoManual: hayTotalManual || itemExistente.esModoManual,

              // Calcular total sumando todos los subtotales recalculados
              total: profesionalesCalc.reduce((sum, p) => sum + (p.subtotal || 0), 0) +
                     jornalesCalc.reduce((sum, j) => sum + (j.subtotal || 0), 0) +
                     materialesCalc.reduce((sum, m) => sum + (m.subtotal || 0), 0) +
                     gastosGeneralesCalc.reduce((sum, g) => sum + (g.subtotal || 0), 0) +
                     (totalManual || 0),

              esRubroVacio: false,
              incluirEnCalculoDias: itemExistente.incluirEnCalculoDias !== undefined ? itemExistente.incluirEnCalculoDias : true // ✅ PRESERVAR campo
            };

            return itemActualizado;
          }
          return item; // Otros items sin cambios
        })
      );
    } else {
      console.log('🔀 RAMA: Agregando nuevo rubro');
      console.log('➕ AGREGANDO NUEVO RUBRO - rubroCompleto:', {
        tipoProfesional: rubroCompleto.tipoProfesional,
        incluirEnCalculoDias: rubroCompleto.incluirEnCalculoDias,
        tieneKey: Object.keys(rubroCompleto).includes('incluirEnCalculoDias')
      });
      setItemsCalculadora(currentItems => [...currentItems, rubroCompleto]);
    }

    iniciarNuevoRubro();

    alert(`✅ Rubro "${rubroCompleto.tipoProfesional}" guardado exitosamente.\n\n📋 Datos guardados:\n${hayProfesionales ? '• Profesionales\n' : ''}${hayMateriales ? '• Materiales\n' : ''}${hayGastosGenerales ? '• Gastos Generales\n' : ''}${hayTotalManual ? '• Total Manual\n' : ''}${rubroCompleto.descripcionProfesionales || rubroCompleto.descripcionMateriales || rubroCompleto.descripcionGastosGenerales || rubroCompleto.descripcionTotalManual ? '• Descripción/Observaciones\n' : ''}\n💰 Total: $${totalCompleto.toLocaleString('es-AR')}`);
  };

  const editarItemCalculadora = useCallback((item) => {
    // console.log('🔵 EDITANDO RUBRO:', item.tipoProfesional);
    // console.log('  - Jornales actuales en rubro:', item.jornales?.length || 0);
    // console.log('  - Profesionales actuales:', item.profesionales?.length || 0);
    // console.log('  - Materiales actuales:', item.materialesLista?.length || 0);
    // console.log('  - Gastos actuales:', item.gastosGenerales?.length || 0);

    const itemId = item.id || `temp_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    setItemEditandoId(itemId);
    itemEditandoIdRef.current = itemId;
    window.currentEditingItemId = itemId;

    if (!item.id) {
      setItemsCalculadora(currentItems => {
        const itemsActualizados = currentItems.map(i =>
          i.tipoProfesional === item.tipoProfesional &&
          i.descripcion === item.descripcion &&
          i.total === item.total
            ? { ...i, id: itemId, incluirEnCalculoDias: i.incluirEnCalculoDias } // ✅ Preservar campo
            : i
        );
        return itemsActualizados;
      });
    }

    setMostrarCalculadora(true);  // Expandir sección de calculadora
    setMostrarItemsPresupuesto(true);  // Expandir Items del Presupuesto si estaba cerrado

    const tipoParaEditar = item.tipoProfesional || '';
    setTipoProfesionalCalc(tipoParaEditar);

    window.tipoParaEdicionActiva = tipoParaEditar;

    setTimeout(() => {
    }, 100);

    setCantidadJornalesCalc('');
    setImporteJornalCalc('');
    setImporteMaterialesCalc('');
    setTotalManualCalc('');

    setDescripcionCalc(item.descripcion || '');
    setObservacionesCalc(item.observaciones || '');

    setDescripcionJornales(item.descripcionJornales || '');
    setObservacionesJornales(item.observacionesJornales || '');
    setDescripcionProfesionales(item.descripcionProfesionales || '');
    setObservacionesProfesionales(item.observacionesProfesionales || '');
    setDescripcionMateriales(item.descripcionMateriales || '');
    setObservacionesMateriales(item.observacionesMateriales || '');
    setDescripcionGastosGenerales(item.descripcionGastosGenerales || '');
    setObservacionesGastosGenerales(item.observacionesGastosGenerales || '');
    setDescripcionTotalManual(item.descripcionTotalManual || '');
    setObservacionesTotalManual(item.observacionesTotalManual || '');

    // 🔧 CARGAR ARRAYS TEMPORALES (se REEMPLAZARÁN al guardar, NO se acumularán)
    // ✅ Los botones de eliminar individuales DENTRO de la edición usan eliminarXXXCalc
    // ✅ Los botones de eliminar en la tabla guardada usan eliminarXXXDeRubro

    // ⚠️ IMPORTANTE: Estos arrays se CARGAN para edición, y al hacer clic en "Finalizar"
    // se REEMPLAZAN completamente (no se agregan a los existentes)

    // Cargar profesionales
    const profesionalesOriginales = item.profesionales && item.profesionales.length > 0 ? [...item.profesionales] : [];
    setProfesionalesCalc(profesionalesOriginales);
    // console.log('  ✅ Profesionales cargados en temporal:', profesionalesOriginales.length);

    // Cargar jornales
    const jornalesOriginales = item.jornales && item.jornales.length > 0 ? [...item.jornales] : [];
    setJornalesCalc(jornalesOriginales);
    // console.log('  ✅ Jornales cargados en temporal:', jornalesOriginales.length);

    // Cargar materiales
    const materialesParaEditar = item.materialesLista || item.materiales || item.materialesList || [];
    const materialesOriginales = materialesParaEditar.length > 0 ? [...materialesParaEditar] : [];
    setMaterialesCalc(materialesOriginales);
    // console.log('  ✅ Materiales cargados en temporal:', materialesOriginales.length);

    // Cargar gastos generales
    const gastosOriginales = (item.gastosGenerales && item.gastosGenerales.length > 0) ? [...item.gastosGenerales] :
                             ((item.otrosCostos && item.otrosCostos.length > 0) ? [...item.otrosCostos] : []);
    setGastosGeneralesCalc(gastosOriginales);
    // console.log('  ✅ Gastos cargados en temporal:', gastosOriginales.length);

    // Colapsar secciones que YA tienen datos (mantenerlas cerradas en modo edición)
    setProfesionalesAgregados(true); // SIEMPRE colapsada
    setManoObraMaterialesAgregados(true); // SIEMPRE colapsada
    setJornalesAgregados(jornalesOriginales.length > 0);
    setMaterialesAgregados(materialesOriginales.length > 0);
    setGastosGeneralesAgregados(gastosOriginales.length > 0);

    if (item.cantidadJornales) {
      setCantidadJornalesCalc(item.cantidadJornales);
    }
    if (item.importeJornal) {
      setImporteJornalCalc(item.importeJornal);
    }
    if (item.materialesTotal) {
      setImporteMaterialesCalc(item.materialesTotal);
    }
    if (item.totalManual) {
      setTotalManualCalc(item.totalManual);
    }


    setItemEditandoId(item.id);


    const esGastoGeneral = tipoParaEditar.toLowerCase().includes('gasto');

    if (esGastoGeneral) {
      setTimeout(() => {
        const seccionNaranja = document.getElementById('seccion-gastos-generales-naranja');
        if (seccionNaranja) {
          seccionNaranja.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
        }
      }, 1500); // Aumentado a 1.5 segundos
    } else {
      setTimeout(() => {
        const calculadoraSection = document.querySelector('[data-section="calculadora"]');
        if (calculadoraSection) {
          calculadoraSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
    }
  }, [itemsCalculadora, profesionalesCalc, setTipoProfesionalCalc]); // Dependencias necesarias para el callback

  const [datosMetrosCuadradosGuardados, setDatosMetrosCuadradosGuardados] = useState(
    costosInicialesData ? {
      metrosCuadrados: costosInicialesData.metrosCuadrados,
      importePorMetro: costosInicialesData.importePorMetro,
      totalEstimado: costosInicialesData.totalEstimado,
      porcentajeProfesionales: costosInicialesData.porcentajeProfesionales,
      porcentajeMateriales: costosInicialesData.porcentajeMateriales,
      porcentajeOtrosCostos: costosInicialesData.porcentajeOtrosCostos,
      montoProfesionales: costosInicialesData.montoProfesionales,
      montoMateriales: costosInicialesData.montoMateriales,
      montoOtrosCostos: costosInicialesData.montoOtrosCostos,
      fechaGuardado: costosInicialesData.fechaGuardado
    } : null
  );

  const [mostrarPrevisualizacion, setMostrarPrevisualizacion] = useState(false);
  const [datosParaEnviar, setDatosParaEnviar] = useState(null);
  const [saving, setSaving] = useState(false);

  const [mostrarAlertCalculoAutomatico, setMostrarAlertCalculoAutomatico] = useState(false);
  const [datosCalculoAutomatico, setDatosCalculoAutomatico] = useState(null);

  const [valoresPresupuesto, setValoresPresupuesto] = useState({
    tipoProfesional: safeInitial.tipoProfesionalPresupuesto || '',
    importeHora: safeInitial.importeHora || '',
    importeDia: safeInitial.importeDia || '',
    importeSemana: safeInitial.importeSemana || '',
    importeMes: safeInitial.importeMes || '',
    cantidadHoras: safeInitial.cantidadHoras || '',
    cantidadDias: safeInitial.cantidadDias || '',
    cantidadSemanas: safeInitial.cantidadSemanas || '',
    cantidadMeses: safeInitial.cantidadMeses || '',
    modoSeleccionado: safeInitial.modoPresupuesto || null // 'hora', 'dia', 'semana', 'mes'
  });

  const [configsProfesionales, setConfigsProfesionales] = useState([]);
  const [configsMateriales, setConfigsMateriales] = useState([]);
  const [configsOtros, setConfigsOtros] = useState([]);

  const handleConfigsChange = (configs) => {
    setConfigsProfesionales(configs.profesionales || []);
    setConfigsMateriales(configs.materiales || []);
    setConfigsOtros(configs.otros || []);
  };

  const guardarDatosMetrosCuadrados = () => {
    if (!metrosCuadradosInicial || !importePorMetroInicial) {
      alert('⚠️ Debe ingresar metros cuadrados e importe por m² para guardar.\n\n💡 Sugerencia: Si agregó items en configuración, use "Calcular desde Items".');
      return;
    }

    let totalEstimado = Number(metrosCuadradosInicial) * Number(importePorMetroInicial);

    if (aumentoImporteFijo) {
      totalEstimado += Number(aumentoImporteFijo);
    } else if (aumentoPorcentaje) {
      totalEstimado += (totalEstimado * Number(aumentoPorcentaje)) / 100;
    }

    const totalPorcentaje = (Number(porcentajeProfesionales) || 0) + (Number(porcentajeMateriales) || 0) + (Number(porcentajeOtrosCostos) || 0);

    let porcentajesProfCalculado = porcentajeProfesionales;
    let porcentajesMatCalculado = porcentajeMateriales;
    let porcentajesOtrosCalculado = porcentajeOtrosCostos;

    if (totalPorcentaje === 0) {
      const totalProfesionales = (form.profesionales || []).reduce((sum, p) => sum + (Number(p.importeCalculado) || 0), 0);
      const totalMateriales = (form.materiales || []).reduce((sum, m) => sum + ((Number(m.cantidad) || 0) * (Number(m.precioUnitario) || 0)), 0);
      const totalOtrosCostos = (form.otrosCostos || []).reduce((sum, o) => sum + (Number(o.importe) || 0), 0);
      const totalReal = totalProfesionales + totalMateriales + totalOtrosCostos;

      if (totalReal > 0) {
        porcentajesProfCalculado = ((totalProfesionales / totalReal) * 100).toFixed(2);
        porcentajesMatCalculado = ((totalMateriales / totalReal) * 100).toFixed(2);
        porcentajesOtrosCalculado = ((totalOtrosCostos / totalReal) * 100).toFixed(2);
      }
    }

    const datosGuardados = {
      metrosCuadrados: metrosCuadradosInicial,
      importePorMetro: importePorMetroInicial,
      totalEstimado: totalEstimado,
      porcentajeProfesionales: porcentajesProfCalculado || 0,
      porcentajeMateriales: porcentajesMatCalculado || 0,
      porcentajeOtrosCostos: porcentajesOtrosCalculado || 0,
      totalPorcentaje: Number(porcentajesProfCalculado || 0) + Number(porcentajesMatCalculado || 0) + Number(porcentajesOtrosCalculado || 0),
      montoProfesionales: porcentajesProfCalculado ? (totalEstimado * Number(porcentajesProfCalculado)) / 100 : 0,
      montoMateriales: porcentajesMatCalculado ? (totalEstimado * Number(porcentajesMatCalculado)) / 100 : 0,
      montoOtrosCostos: porcentajesOtrosCalculado ? (totalEstimado * Number(porcentajesOtrosCalculado)) / 100 : 0,
      fechaGuardado: new Date().toISOString(), // Solo para display, no se envía al backend
      calculadoInverso: true, // Flag para indicar que fue calculado desde items
      aumentoAplicado: aumentoImporteFijo || aumentoPorcentaje ? true : false
    };

    setDatosMetrosCuadradosGuardados(datosGuardados);

    let mensaje = '✅ Datos guardados exitosamente';
    if (totalPorcentaje === 0) mensaje += '\n📊 Porcentajes calculados automáticamente desde items agregados';
    if (aumentoImporteFijo) mensaje += `\n💰 Aumento aplicado: +$${Number(aumentoImporteFijo).toLocaleString()}`;
    if (aumentoPorcentaje) mensaje += `\n💰 Aumento aplicado: +${aumentoPorcentaje}%`;

    alert(mensaje);
  };

  const limpiarDatosMetrosCuadrados = () => {
    setDatosMetrosCuadradosGuardados(null);
    setMetrosCuadradosInicial('');
    setImportePorMetroInicial('');
    setPorcentajeProfesionales('');
    setPorcentajeMateriales('');
    setPorcentajeOtrosCostos('');
  };

  useEffect(() => {

    const parseIfString = (v) => {
      if (!v) return [];
      if (typeof v === 'string') {
        try { return JSON.parse(v); } catch (e) { return []; }
      }
      if (Array.isArray(v)) return v;
      return [];
    };

    const separarDireccion = (calle, altura, piso, depto) => {
      let calleResult = calle || '';
      let alturaResult = altura || '';
      let pisoResult = piso || '';
      let deptoResult = depto || '';

      if (calleResult && !alturaResult) {
        const matchCompleto = calleResult.match(/^(.+?)\s+(\d+)(?:\s+(?:Piso|piso|PISO)\s+(\w+))?(?:\s+(?:Depto|depto|DEPTO|Dpto|dpto)\s*(\w+))?/i);
        if (matchCompleto) {
          calleResult = matchCompleto[1].trim();
          alturaResult = matchCompleto[2];
          pisoResult = matchCompleto[3] || piso || '';
          deptoResult = matchCompleto[4] || depto || '';
          return { calle: calleResult, altura: alturaResult, piso: pisoResult, depto: deptoResult };
        }

        const matchSimple = calleResult.match(/^(.+?)\s+(\d+)\s*$/);
        if (matchSimple) {
          calleResult = matchSimple[1].trim();
          alturaResult = matchSimple[2];
          return { calle: calleResult, altura: alturaResult, piso: pisoResult, depto: deptoResult };
        }

        const matchConTexto = calleResult.match(/^(.+?)\s+(\d+)\s+\D/);
        if (matchConTexto) {
          calleResult = matchConTexto[1].trim();
          alturaResult = matchConTexto[2];
          return { calle: calleResult, altura: alturaResult, piso: pisoResult, depto: deptoResult };
        }
      }

      return { calle: calleResult, altura: alturaResult, piso: pisoResult, depto: deptoResult };
    };

    const si = safeInitial;


    const { calle, altura, piso, depto } = separarDireccion(
      si.direccionObraCalle,
      si.direccionObraAltura,
      si.direccionObraPiso,
      si.direccionObraDepartamento
    );

    setForm({
      id: si.id || null,

      idEmpresa: si.idEmpresa || empresaSeleccionada?.id || null,
      nombreEmpresa: si.nombreEmpresa || empresaSeleccionada?.nombreEmpresa || '',

      nombreSolicitante: si.nombreSolicitante || '',
      direccionParticular: si.direccionParticular || '',
      telefono: si.telefono || '',
      mail: si.mail || '',

      direccionObraBarrio: si.direccionObraBarrio || '',
      direccionObraCalle: calle,
      direccionObraAltura: altura,
      direccionObraTorre: si.direccionObraTorre || '',
      direccionObraPiso: piso,
      direccionObraDepartamento: depto,
      direccionObraLocalidad: si.direccionObraLocalidad || '',
      direccionObraProvincia: si.direccionObraProvincia || '',
      direccionObraCodigoPostal: si.direccionObraCodigoPostal || '',
  nombreObra: si.nombreObra || '',

      descripcion: si.descripcion || '',
      observaciones: si.observaciones || '',

      fechaProbableInicio: si.fechaProbableInicio || '',
      vencimiento: si.vencimiento ?? today,
      fechaCreacion: si.fechaCreacion ?? today,
      fechaEmision: si.fechaEmision ?? today,
      tiempoEstimadoTerminacion: si.tiempoEstimadoTerminacion ?? '',
      calculoAutomaticoDiasHabiles: (si.calculoAutomaticoDiasHabiles === true) ? true : false, // ✨ Preservar modo de cálculo, por defecto MANUAL

      version: si.version || si.numeroVersion || 1,
      numeroPresupuesto: si.numeroPresupuesto ?? null,
      estado: si.estado ?? 'A enviar',

      honorarioSeleccion: si.honorarioSeleccion || '',
      honorarioDireccionValorFijo: si.honorarioDireccionValorFijo ?? '',
      honorarioDireccionPorcentaje: si.honorarioDireccionPorcentaje ?? '',
      honorarioDireccionImporte: si.honorarioDireccionImporte ?? '',

      honorarios: {
        valorGeneral: si.honorariosValorGeneral ?? si.honorarios_valor_general ?? '',
        tipoGeneral: si.honorariosTipoGeneral ?? si.honorarios_tipo_general ?? 'porcentaje',
        profesionales: {
          activo: si.honorariosProfesionalesActivo ?? si.honorarios_profesionales_activo ?? true,
          tipo: si.honorariosProfesionalesTipo ?? si.honorarios_profesionales_tipo ?? 'porcentaje',
          valor: si.honorariosProfesionalesValor ?? si.honorarios_profesionales_valor ?? ''
        },
        materiales: {
          activo: si.honorariosMaterialesActivo ?? si.honorarios_materiales_activo ?? true,
          tipo: si.honorariosMaterialesTipo ?? si.honorarios_materiales_tipo ?? 'porcentaje',
          valor: si.honorariosMaterialesValor ?? si.honorarios_materiales_valor ?? ''
        },
        otrosCostos: {
          activo: si.honorariosOtrosCostosActivo ?? si.honorarios_otros_costos_activo ?? true,
          tipo: si.honorariosOtrosCostosTipo ?? si.honorarios_otros_costos_tipo ?? 'porcentaje',
          valor: si.honorariosOtrosCostosValor ?? si.honorarios_otros_costos_valor ?? ''
        },
        configuracionPresupuesto: {
          activo: si.honorariosConfiguracionPresupuestoActivo ?? si.honorarios_configuracion_presupuesto_activo ?? true,
          tipo: si.honorariosConfiguracionPresupuestoTipo ?? si.honorarios_configuracion_presupuesto_tipo ?? 'porcentaje',
          valor: si.honorariosConfiguracionPresupuestoValor ?? si.honorarios_configuracion_presupuesto_valor ?? ''
        },
        jornales: {
          activo: si.honorariosJornalesActivo ?? si.honorarios_jornales_activo ?? true,
          tipo: si.honorariosJornalesTipo ?? si.honorarios_jornales_tipo ?? 'porcentaje',
          valor: si.honorariosJornalesValor ?? si.honorarios_jornales_valor ?? '',
          modoAplicacion: si.honorariosJornalesModoAplicacion ?? si.honorarios_jornales_modo_aplicacion ?? 'todos',
          porRol: si.honorariosJornalesPorRol ?? si.honorarios_jornales_por_rol ?? {}
        }
      },

      mayoresCostos: (() => {

        if (si.mayoresCostosProfesionalesActivo !== undefined ||
            si.mayores_costos_profesionales_activo !== undefined ||
            si.mayoresCostosProfesionalesValor !== undefined ||
            si.mayoresCostosMaterialesValor !== undefined ||
            si.mayoresCostosOtrosCostosValor !== undefined ||
            si.mayoresCostosHonorariosValor !== undefined) {

          const config = {
            aplicarValorGeneral: si.mayoresCostosAplicarValorGeneral ?? si.mayores_costos_aplicar_valor_general ?? false,
            valorGeneral: si.mayoresCostosValorGeneral ?? si.mayores_costos_valor_general ?? '',
            tipoGeneral: si.mayoresCostosTipoGeneral ?? si.mayores_costos_tipo_general ?? 'porcentaje',
            generalImportado: si.mayoresCostosGeneralImportado ?? si.mayores_costos_general_importado ?? false,
            rubroImportado: si.mayoresCostosRubroImportado ?? si.mayores_costos_rubro_importado ?? null,
            nombreRubroImportado: si.mayoresCostosNombreRubroImportado ?? si.mayores_costos_nombre_rubro_importado ?? null,
            profesionales: {
              activo: si.mayoresCostosProfesionalesActivo ?? si.mayores_costos_profesionales_activo ?? true,
              tipo: si.mayoresCostosProfesionalesTipo ?? si.mayores_costos_profesionales_tipo ?? 'porcentaje',
              valor: si.mayoresCostosProfesionalesValor ?? si.mayores_costos_profesionales_valor ?? ''
            },
            materiales: {
              activo: si.mayoresCostosMaterialesActivo ?? si.mayores_costos_materiales_activo ?? true,
              tipo: si.mayoresCostosMaterialesTipo ?? si.mayores_costos_materiales_tipo ?? 'porcentaje',
              valor: si.mayoresCostosMaterialesValor ?? si.mayores_costos_materiales_valor ?? ''
            },
            otrosCostos: {
              activo: si.mayoresCostosOtrosCostosActivo ?? si.mayores_costos_otros_costos_activo ?? true,
              tipo: si.mayoresCostosOtrosCostosTipo ?? si.mayores_costos_otros_costos_tipo ?? 'porcentaje',
              valor: si.mayoresCostosOtrosCostosValor ?? si.mayores_costos_otros_costos_valor ?? ''
            },
            configuracionPresupuesto: {
              activo: si.mayoresCostosConfiguracionPresupuestoActivo ?? si.mayores_costos_configuracion_presupuesto_activo ?? true,
              tipo: si.mayoresCostosConfiguracionPresupuestoTipo ?? si.mayores_costos_configuracion_presupuesto_tipo ?? 'porcentaje',
              valor: si.mayoresCostosConfiguracionPresupuestoValor ?? si.mayores_costos_configuracion_presupuesto_valor ?? ''
            },
            honorarios: {
              activo: si.mayoresCostosHonorariosActivo ?? si.mayores_costos_honorarios_activo ?? true,
              tipo: si.mayoresCostosHonorariosTipo ?? si.mayores_costos_honorarios_tipo ?? 'porcentaje',
              valor: si.mayoresCostosHonorariosValor ?? si.mayores_costos_honorarios_valor ?? ''
            },
            jornales: {
              activo: si.mayoresCostosJornalesActivo ?? si.mayores_costos_jornales_activo ?? true,
              tipo: si.mayoresCostosJornalesTipo ?? si.mayores_costos_jornales_tipo ?? 'porcentaje',
              valor: si.mayoresCostosJornalesValor ?? si.mayores_costos_jornales_valor ?? '',
              modoAplicacion: si.mayoresCostosJornalesModoAplicacion ?? si.mayores_costos_jornales_modo_aplicacion ?? 'todos',
              porRol: si.mayoresCostosJornalesPorRol ?? si.mayores_costos_jornales_por_rol ?? {}
            }
          };

          return config;
        }

        return null;
      })(),

      profesionales: parseIfString(si.profesionales || si.profesionalesJson).map(p => {
        const importeXHora = Number(p.importeXHora || p.importe_hora || p.importeHora || 0);
        const importeXDia = Number(p.importeXDia || p.importe_dia || p.importeDia || 0);
        const importeXSemana = Number(p.importeXSemana || p.importe_semana || p.importeSemana || 0);
        const importeXMes = Number(p.importeXMes || p.importe_mes || p.importeMes || 0);
        const importeXObra = Number(p.importeXObra || p.importe_obra || p.importeObra || 0);
        const cantidadHoras = Number(p.cantidadHoras || p.cantidad_horas || 0);
        const cantidadDias = Number(p.cantidadDias || p.cantidad_dias || 0);
        const cantidadSemanas = Number(p.cantidadSemanas || p.cantidad_semanas || 0);
        const cantidadMeses = Number(p.cantidadMeses || p.cantidad_meses || 0);
        const tipoUnidad = p.tipoUnidad || p.tipo_unidad || 'jornales';
        const cantidadJornales = Number(p.cantidadJornales || p.cantidad_jornales || 0);

        let importeCalculado = 0;
        if (importeXHora && cantidadHoras) {
          const jornales = cantidadJornales > 0 ? cantidadJornales : 1;
          importeCalculado = importeXHora * cantidadHoras * jornales;
        } else if (importeXDia && cantidadDias) {
          importeCalculado = importeXDia * cantidadDias;
        } else if (importeXSemana && cantidadSemanas) {
          importeCalculado = importeXSemana * cantidadSemanas;
        } else if (importeXMes && cantidadMeses) {
          importeCalculado = importeXMes * cantidadMeses;
        } else if (importeXObra) {
          importeCalculado = importeXObra;
        }


        return {
          ...p,
          tipoProfesional: p.tipoProfesional || p.tipo_profesional || '',
          nombreProfesional: p.nombreProfesional || p.nombre_profesional || null,
          telefonoProfesional: p.telefonoProfesional || p.telefono_profesional || null,
          tipoUnidad,
          cantidadJornales,
          importeXHora,
          importeXDia,
          importeXSemana,
          importeXMes,
          importeXObra,
          cantidadHoras,
          cantidadDias,
          cantidadSemanas,
          cantidadMeses,
          importeCalculado
        };
      }),
      materiales: parseIfString(si.materialesList || si.materialesJson || si.materiales).map(m => {
        const materialMapeado = {
          tipoMaterial: m.tipoMaterial || m.tipo_material || m.nombreMaterial || m.nombre_material || '',
          cantidad: Number(m.cantidad) || 0,
          precioUnitario: Number(m.precioUnitario || m.precio_unitario || m.preciounitario) || 0
        };
        return materialMapeado;
      }),
      otrosCostos: parseIfString(si.otrosCostos),

      totalHonorariosProfesionales: si.totalHonorariosProfesionales ?? 0,
      totalMateriales: si.totalMateriales ?? 0,
      totalHonorariosDireccionObra: si.totalHonorariosDireccionObra ?? 0,
      montoTotal: si.montoTotal ?? 0,

      obraId: si.obraId || null,
      nombreObraManual: si.nombreObraManual || si.nombreObra || '',
    });


    const profsCargados = parseIfString(si.profesionales || si.profesionalesJson);
    if (profsCargados.length > 0) {
    }


    if (si.profesionales && Array.isArray(si.profesionales) && si.profesionales.length > 0) {
      const configsProf = si.profesionales.map(p => ({
        tipoProfesional: p.tipoProfesional || '',
        importeHora: p.importeHora || '',
        importeDia: p.importeDia || '',
        importeSemana: p.importeSemana || '',
        importeMes: p.importeMes || '',
        cantidadHoras: p.cantidadHoras || '',
        cantidadDias: p.cantidadDias || '',
        cantidadSemanas: p.cantidadSemanas || '',
        cantidadMeses: p.cantidadMeses || '',
        modoSeleccionado: p.importeHora ? 'hora' : p.importeDia ? 'dia' : p.importeSemana ? 'semana' : 'mes',
        esGeneral: !p.tipoProfesional || p.tipoProfesional === '',
        subtotal: p.subtotal
      }));
      setConfigsProfesionales(configsProf);
    } else {
    }

    if (si.materiales && Array.isArray(si.materiales) && si.materiales.length > 0) {
      const configsMat = si.materiales.map(m => ({
        tipoMaterial: m.nombreMaterial || '',
        categoria: m.categoria || '',
        cantidad: m.cantidad || '',
        unidadMedida: m.unidadMedida || '',
        presupuestoTotal: m.precioUnitario || '',
        esGeneral: !m.nombreMaterial || m.nombreMaterial === '',
        subtotal: m.subtotal
      }));
      setConfigsMateriales(configsMat);
    } else {
    }

    if (si.otrosCostos && Array.isArray(si.otrosCostos) && si.otrosCostos.length > 0) {
      const configsOtros = si.otrosCostos.map(o => ({
        descripcion: o.descripcion || '',
        categoria: o.categoria || '',
        presupuestoTotal: o.importe || '',
        esGeneral: !o.descripcion || o.descripcion === ''
      }));
      setConfigsOtros(configsOtros);
    } else {
      const configPorDefecto = {
        descripcion: 'Otros Costos',
        categoria: '',
        presupuestoTotal: '',
        esGeneral: true
      };
      setConfigsOtros([configPorDefecto]);
    }

    if (si.itemsCalculadora && Array.isArray(si.itemsCalculadora) && si.itemsCalculadora.length > 0) {

      const itemsFiltrados = si.itemsCalculadora.filter(item => {
        const esVariosVacio = item.tipoProfesional === 'Varios' &&
                             (item.total === 0 || item.total === null) &&
                             (!item.profesionales || item.profesionales.length === 0) &&
                             (!item.materialesLista || item.materialesLista.length === 0) &&
                             (!item.gastosGenerales || item.gastosGenerales.length === 0);

        if (esVariosVacio) {
          return false;
        }
        return true;
      });

      itemsFiltrados.forEach((item, idx) => {
      });

      const itemsCargados = itemsFiltrados.map((item, index) => {

        if (item.esGastoGeneral === true || item.tipoProfesional?.toLowerCase().includes('gasto')) {

          if (item.gastosGenerales && item.gastosGenerales.length > 0) {
            item.gastosGenerales.forEach((gasto, gIdx) => {
            });
          } else {
          }
        }

        const subtotalManoObraBackend = Number(item.subtotalManoObra || 0);
        const subtotalMaterialesBackend = Number(item.subtotalMateriales || 0);
        const subtotalGastosGeneralesBackend = Number(item.subtotalGastosGenerales || 0);

        const profesionalesBase = item.profesionales || [];
        const materialesBase = item.materialesLista || [];
        const gastosGeneralesBase = item.gastosGenerales || [];

        const subtotalManoObraBase = profesionalesBase.reduce((sum, prof) => sum + (Number(prof.subtotal) || 0), 0);
        const subtotalMaterialesBase = materialesBase.reduce((sum, mat) => sum + (Number(mat.subtotal) || 0), 0);
        const subtotalGastosGeneralesBase = gastosGeneralesBase.reduce((sum, gasto) => sum + (Number(gasto.subtotal) || 0), 0);

        const factorMO = subtotalManoObraBase > 0 ? subtotalManoObraBackend / subtotalManoObraBase : 1;
        const factorMat = subtotalMaterialesBase > 0 ? subtotalMaterialesBackend / subtotalMaterialesBase : 1;
        const factorGG = subtotalGastosGeneralesBase > 0 ? subtotalGastosGeneralesBackend / subtotalGastosGeneralesBase : 1;

        const profesionalesActualizados = profesionalesBase.map(prof => ({
          ...prof,
          subtotal: Number(prof.subtotal || 0) * factorMO
        }));

        const materialesActualizados = materialesBase.map(mat => ({
          ...mat,
          precio: mat.precio || mat.precioUnitario,
          precioUnitario: mat.precio || mat.precioUnitario,
          descripcion: mat.descripcion || mat.nombre,
          subtotal: Number(mat.subtotal || 0) * factorMat
        }));

        const gastosGeneralesActualizados = gastosGeneralesBase.map(gasto => ({
          ...gasto,
          subtotal: Number(gasto.subtotal || 0) * factorGG
        }));


        const itemMapeado = {
          id: item.id || `item_${Date.now()}_${Math.floor(Math.random() * 10000)}`, // Garantizar ID único y descriptivo
          tipoProfesional: item.tipoProfesional || '',
          descripcion: item.descripcion || '',
          observaciones: item.observaciones || '',
          descripcionProfesionales: item.descripcionProfesionales || '',
          observacionesProfesionales: item.observacionesProfesionales || '',
          descripcionMateriales: item.descripcionMateriales || '',
          observacionesMateriales: item.observacionesMateriales || '',
          descripcionGastosGenerales: item.descripcionGastosGenerales || '',
          observacionesGastosGenerales: item.observacionesGastosGenerales || '',
          cantidadJornales: item.cantidadJornales,
          importeJornal: item.importeJornal,
          jornales: item.jornales || [], // ✅ INCLUIR ARRAY DE JORNALES
          subtotalManoObra: subtotalManoObraBackend,
          materiales: item.materiales,
          materialesTotal: item.materialesTotal || item.materiales,
          subtotalMateriales: subtotalMaterialesBackend,
          totalManual: item.totalManual,
          total: Number(item.total || 0),
          esModoManual: item.esModoManual || false,
          esRubroVacio: item.esRubroVacio || false,
          profesionales: profesionalesActualizados, // 🔥 Usar profesionales con subtotales actualizados
          materialesLista: materialesActualizados, // 🔥 Usar materiales con subtotales actualizados
          gastosGenerales: gastosGeneralesActualizados, // 🔥 Usar gastos con subtotales actualizados
          subtotalGastosGenerales: subtotalGastosGeneralesBackend,
          esGastoGeneral: item.esGastoGeneral || false,
          incluirEnCalculoDias: item.incluirEnCalculoDias // ✅ PRESERVAR campo para cálculo de días
        };

        if (itemMapeado.esGastoGeneral && itemMapeado.total === 0 && itemMapeado.gastosGenerales.length > 0) {
          const totalCalculado = itemMapeado.gastosGenerales.reduce((sum, g) => sum + (parseFloat(g.subtotal) || 0), 0);
          itemMapeado.total = totalCalculado;
          itemMapeado.subtotalGastosGenerales = totalCalculado;
        }

        if ((!itemMapeado.gastosGenerales || itemMapeado.gastosGenerales.length === 0) && itemMapeado.subtotalGastosGenerales > 0) {

          itemMapeado.gastosGenerales = [{
            id: Date.now() + Math.random(),
            descripcion: itemMapeado.descripcionGastosGenerales || 'Gastos Generales',
            cantidad: 1,
            precioUnitario: itemMapeado.subtotalGastosGenerales,
            subtotal: itemMapeado.subtotalGastosGenerales,
            observaciones: itemMapeado.observacionesGastosGenerales || ''
          }];

        }

        if (itemMapeado.gastosGenerales && itemMapeado.gastosGenerales.length > 0) {
          const subtotalCalculado = itemMapeado.gastosGenerales.reduce((sum, g) => sum + (parseFloat(g.subtotal) || 0), 0);

          if (Math.abs(itemMapeado.subtotalGastosGenerales - subtotalCalculado) > 0.01) {
            itemMapeado.subtotalGastosGenerales = subtotalCalculado;
          }

          const totalEsperado = (itemMapeado.subtotalManoObra || 0) + (itemMapeado.subtotalMateriales || 0) + subtotalCalculado;

          if (Math.abs((itemMapeado.total || 0) - totalEsperado) > 0.01) {
            itemMapeado.total = totalEsperado;
          }
        }

        return itemMapeado;
      });

      setItemsCalculadora(itemsCargados);

      const itemsConCero = itemsCargados.filter(i => !i.total || i.total === 0);
      if (itemsConCero.length > 0) {
      }
    } else {
      setItemsCalculadora([]);
    }
  }, [initialData?.id, empresaSeleccionada?.id]); // Solo re-ejecutar si cambian los IDs específicos

  // useEffect para recalcular y persistir automáticamente el total consolidado (incluyendo mayores costos y jornales)
  useEffect(() => {
    if (!initialData?.id || !empresaSeleccionada?.id) return;
    if (!itemsCalculadora || itemsCalculadora.length === 0) return;

    // 🚨 PREVENIR actualizaciones automáticas en presupuestos problemáticos conocidos
    if (initialData._errorBackend || [668, 653].includes(initialData.id)) {
      console.warn(`⚠️ Saltando actualización automática para presupuesto problemático ${initialData.id}`);
      return;
    }

    // Recalcular el total consolidado sumando todos los rubros
    const totalBase = itemsCalculadora.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);

    // Calcular mayores costos si existen
    let totalMayoresCostos = 0;
    if (initialData.mayoresCostos && initialData.mayoresCostos.jornales && initialData.mayoresCostos.jornales.activo) {
      const tipo = initialData.mayoresCostos.jornales.tipo || 'porcentaje';
      const valor = parseFloat(initialData.mayoresCostos.jornales.valor) || 0;
      if (tipo === 'porcentaje') {
        totalMayoresCostos = (totalBase * valor) / 100;
      } else {
        totalMayoresCostos = valor;
      }
    }

    // Calcular honorarios
    const honorariosCalculados = calcularHonorarios();
    const totalHonorariosEsperado = honorariosCalculados.total;

    // Total final consolidado
    const totalPresupuestoConHonorarios = totalBase + totalHonorariosEsperado + totalMayoresCostos;

    // 🚫 NO EJECUTAR si estamos cargando initialData (evitar loop infinito)
    if (estaCargandoInicialRef.current) {
      console.log('⏭️ Saltando actualización de totales - cargando initialData');
      return;
    }

    // 🚫 NO EJECUTAR si estamos guardando (evitar loop infinito)
    if (estaGuardandoRef.current) {
      console.log('⏭️ Saltando actualización de totales - guardando en backend');
      return;
    }

    // Solo persistir si hay diferencia
    const diferencia = Math.abs((initialData.totalPresupuestoConHonorarios || 0) - totalPresupuestoConHonorarios);
    const tolerancia = totalPresupuestoConHonorarios * 0.01;
    if (diferencia > tolerancia) {
      const updatePayload = {
        totalPresupuesto: totalBase,
        totalHonorarios: totalHonorariosEsperado,
        totalMayoresCostos: totalMayoresCostos,
        totalPresupuestoConHonorarios: totalPresupuestoConHonorarios,
        montoTotal: totalPresupuestoConHonorarios,
        totalFinal: totalPresupuestoConHonorarios,
        totalGeneral: totalPresupuestoConHonorarios
      };

      // Función async para actualizar totales
      const actualizarTotales = async () => {
        try {
          const response = await apiService.put(
            `/api/v1/presupuestos-no-cliente/${initialData.id}`,
            updatePayload,
            { params: { empresaId: empresaSeleccionada.id } }
          );

          // Si la respuesta indica que se omitió la actualización
          if (response._skipped) {
            console.info(`✅ Actualización omitida para presupuesto ${initialData.id} - problema conocido del backend`);
          } else {
            console.info(`✅ Totales actualizados para presupuesto ${initialData.id}`);
          }
        } catch (error) {
          // Manejar errores sin interrumpir la funcionalidad del modal
          if (error.status === 400 || error._isKnownIssue) {
            console.warn(`⚠️ No se pudo actualizar automáticamente los totales del presupuesto ${initialData.id} - problema conocido del backend`);
          } else {
            console.error('❌ Error al actualizar totales:', error);
          }
        }
      };

      // ⚠️ DESHABILITADO TEMPORALMENTE - Causaba loop infinito
      // Ejecutar la función async
      // actualizarTotales();

      console.log('ℹ️ Actualización automática de totales deshabilitada - use el botón "Guardar Presupuesto"');

      // Actualizar el objeto local para reflejar el nuevo total
      initialData.totalPresupuesto = totalBase;
      initialData.totalHonorarios = totalHonorariosEsperado;
      initialData.totalMayoresCostos = totalMayoresCostos;
      initialData.totalPresupuestoConHonorarios = totalPresupuestoConHonorarios;
      initialData.montoTotal = totalPresupuestoConHonorarios;
    }
  }, [itemsCalculadora, initialData?.id, empresaSeleccionada?.id]);

  const calcularDesdeItems = () => {
    const totalProfesionales = (form.profesionales || []).reduce((sum, p) => sum + (Number(p.importeCalculado) || 0), 0);
    const totalMateriales = (form.materiales || []).reduce((sum, m) => sum + ((Number(m.cantidad) || 0) * (Number(m.precioUnitario) || 0)), 0);
    const totalOtrosCostos = (form.otrosCostos || []).reduce((sum, o) => sum + (Number(o.importe) || 0), 0);
    const totalObra = totalProfesionales + totalMateriales + totalOtrosCostos;

    if (totalObra === 0) {
      alert('⚠️ No hay items agregados. Primero agregue profesionales, materiales u otros costos en "Configuración del Presupuesto".');
      return;
    }

    const importeEstandar = 1200000; // Valor promedio estándar
    const metrosCalculados = totalObra / importeEstandar;

    setMetrosCuadradosInicial(metrosCalculados.toFixed(2));
    setImportePorMetroInicial(importeEstandar.toString());


    setDatosCalculoAutomatico({
      metrosCalculados: metrosCalculados.toFixed(2),
      importeEstandar,
      totalObra
    });
    setMostrarAlertCalculoAutomatico(true);
  };


  /**
   * Auto-crea o actualiza configuración de profesional cuando se agrega uno nuevo
   * NO crea configuración automática si existe una configuración GENERAL del mismo modo
   */
  const autoCrearConfigProfesional = (profesional) => {
    const tipoProfesional = profesional.tipoProfesional?.trim();
    if (!tipoProfesional) return;

    let modoSeleccionado = null;
    if (profesional.importeXHora) modoSeleccionado = 'hora';
    else if (profesional.importeXDia) modoSeleccionado = 'dia';
    else if (profesional.importeXSemana) modoSeleccionado = 'semana';
    else if (profesional.importeXMes) modoSeleccionado = 'mes';

    if (!modoSeleccionado) return; // No tiene modo seleccionado

    const existeConfigGeneral = configsProfesionales.find(
      c => c.esGeneral === true && c.modoSeleccionado === modoSeleccionado
    );

    if (existeConfigGeneral) {
      return; // La configuración general ya cubre este profesional
    }

    const configExistente = configsProfesionales.find(
      c => c.tipoProfesional?.toLowerCase() === tipoProfesional.toLowerCase() &&
           c.modoSeleccionado === modoSeleccionado
    );

    if (configExistente) {
      const configsActualizadas = configsProfesionales.map(c => {
        if (c.tipoProfesional?.toLowerCase() === tipoProfesional.toLowerCase() &&
            c.modoSeleccionado === modoSeleccionado) {
          const nuevaCantidad =
            modoSeleccionado === 'hora' ? Number(c.cantidadHoras || 0) + Number(profesional.cantidadHoras || 0) :
            modoSeleccionado === 'dia' ? Number(c.cantidadDias || 0) + Number(profesional.cantidadDias || 0) :
            modoSeleccionado === 'semana' ? Number(c.cantidadSemanas || 0) + Number(profesional.cantidadSemanas || 0) :
            Number(c.cantidadMeses || 0) + Number(profesional.cantidadMeses || 0);

          const propNombre =
            modoSeleccionado === 'hora' ? 'cantidadHoras' :
            modoSeleccionado === 'dia' ? 'cantidadDias' :
            modoSeleccionado === 'semana' ? 'cantidadSemanas' : 'cantidadMeses';

          return {
            ...c,
            [propNombre]: nuevaCantidad
          };
        }
        return c;
      });
      setConfigsProfesionales(configsActualizadas);
    } else {
      const nuevaConfig = {
        tipoProfesional,
        modoSeleccionado,
        importeHora: modoSeleccionado === 'hora' ? profesional.importeXHora : '',
        importeDia: modoSeleccionado === 'dia' ? profesional.importeXDia : '',
        importeSemana: modoSeleccionado === 'semana' ? profesional.importeXSemana : '',
        importeMes: modoSeleccionado === 'mes' ? profesional.importeXMes : '',
        cantidadHoras: modoSeleccionado === 'hora' ? profesional.cantidadHoras : '',
        cantidadDias: modoSeleccionado === 'dia' ? profesional.cantidadDias : '',
        cantidadSemanas: modoSeleccionado === 'semana' ? profesional.cantidadSemanas : '',
        cantidadMeses: modoSeleccionado === 'mes' ? profesional.cantidadMeses : ''
      };
      setConfigsProfesionales(prev => [...prev, nuevaConfig]);
    }
  };

  /**
   * Auto-crea o actualiza configuración de material cuando se agrega uno nuevo
   */
  const autoCrearConfigMaterial = (material) => {
    const tipoMaterial = material.tipoMaterial?.trim();
    if (!tipoMaterial) return;

    const cantidad = Number(material.cantidad || 0);
    const precioUnitario = Number(material.precioUnitario || 0);
    const totalMaterial = cantidad * precioUnitario;

    if (totalMaterial <= 0) return;

    const configExistente = configsMateriales.find(
      c => c.tipoMaterial?.toLowerCase() === tipoMaterial.toLowerCase()
    );

    if (configExistente) {
      const configsActualizadas = configsMateriales.map(c => {
        if (c.tipoMaterial?.toLowerCase() === tipoMaterial.toLowerCase()) {
          return {
            ...c,
            presupuestoTotal: Number(c.presupuestoTotal || 0) + totalMaterial
          };
        }
        return c;
      });
      setConfigsMateriales(configsActualizadas);
    } else {
      const nuevaConfig = {
        tipoMaterial,
        presupuestoTotal: totalMaterial
      };
      setConfigsMateriales(prev => [...prev, nuevaConfig]);
    }
  };

  /**
   * Auto-crea o actualiza configuración de otros costos cuando se agrega uno nuevo
   */
  const autoCrearConfigOtro = (otroCosto) => {
    const descripcion = otroCosto.descripcion?.trim();
    if (!descripcion) return;

    const importe = Number(otroCosto.importe || 0);
    if (importe <= 0) return;

    const configExistente = configsOtros.find(
      c => c.descripcion?.toLowerCase() === descripcion.toLowerCase()
    );

    if (configExistente) {
      const configsActualizadas = configsOtros.map(c => {
        if (c.descripcion?.toLowerCase() === descripcion.toLowerCase()) {
          return {
            ...c,
            presupuestoTotal: Number(c.presupuestoTotal || 0) + importe
          };
        }
        return c;
      });
      setConfigsOtros(configsActualizadas);
    } else {
      const nuevaConfig = {
        descripcion,
        presupuestoTotal: importe
      };
      setConfigsOtros(prev => [...prev, nuevaConfig]);
    }
  };

  const addProfesional = () => {
    setShowAddProfesional(true);
    setMostrarProfesionales(true); // Asegura que la sección esté expandida
  };

  const acceptProfesional = () => {
    if (!newProfesional.tipoProfesional.trim()) {
      alert('Debe ingresar el tipo de profesional');
      return;
    }

    const validacion = validarTipoItem(newProfesional.tipoProfesional, 'profesional');
    if (!validacion.esValido) {
      alert(validacion.mensaje);
      return;
    }


    setForm(prev => ({ ...prev, profesionales: [...prev.profesionales, { ...newProfesional }] }));

    autoCrearConfigProfesional(newProfesional);

    setNewProfesional({
      tipoProfesional: '',
      nombreProfesional: '',
      telefonoProfesional: '',
      importeXHora: '',
      cantidadHoras: '',
      importeCalculado: 0
    });
    setErrorValidacionProfesional(null); // Limpiar error después de agregar exitosamente
  };

  const cancelAddProfesional = () => {
    setNewProfesional({
      tipoProfesional: '',
      nombreProfesional: '',
      telefonoProfesional: '',
      importeXHora: '',
      cantidadHoras: '',
      importeCalculado: 0
    });
    setShowAddProfesional(false);
  };

  const updateValorPresupuesto = (key, value) => {
    setValoresPresupuesto(prev => ({ ...prev, [key]: value }));
  };

  const selectModoPresupuesto = (modo) => {
    if (valoresPresupuesto.modoSeleccionado === modo) {
      setValoresPresupuesto(prev => ({ ...prev, modoSeleccionado: null }));
    } else {
      setValoresPresupuesto(prev => ({
        ...prev,
        modoSeleccionado: modo,
        importeHora: modo === 'hora' ? prev.importeHora : '',
        importeDia: modo === 'dia' ? prev.importeDia : '',
        importeSemana: modo === 'semana' ? prev.importeSemana : '',
        importeMes: modo === 'mes' ? prev.importeMes : '',
        cantidadHoras: modo === 'hora' ? prev.cantidadHoras : '',
        cantidadDias: modo === 'dia' ? prev.cantidadDias : '',
        cantidadSemanas: modo === 'semana' ? prev.cantidadSemanas : '',
        cantidadMeses: modo === 'mes' ? prev.cantidadMeses : '',
      }));
    }
  };

  const updateNewProfesional = (key, value) => {
    setNewProfesional(prev => {
      const updated = { ...prev, [key]: value };
      const importe = Number(updated.importeXHora) || 0;
      const cantidad = Number(updated.cantidadHoras) || 0;
      const jornales = Number(updated.cantidadJornales) || 0;
      updated.importeCalculado = importe * cantidad * (jornales > 0 ? jornales : 1);
      return updated;
    });

    if (key === 'tipoProfesional' && value.trim().length > 2) {
      const validacion = validarTipoItem(value, 'profesional');
      if (!validacion.esValido) {
        setErrorValidacionProfesional(validacion.mensaje);
      } else {
        setErrorValidacionProfesional(null);
        if (validacion.similitud < 0.6) {
          agregarNuevoProfesional(value);
        }
      }
    } else if (key === 'tipoProfesional') {
      setErrorValidacionProfesional(null);
    }
  };

  const removeProfesional = (idx) => {
    setForm(prev => ({ ...prev, profesionales: prev.profesionales.filter((_, i) => i !== idx) }));
  };
  const updateProfesional = (idx, key, value) => {
    setForm(prev => {
      const updated = { ...prev, profesionales: prev.profesionales.map((p, i) => {
        if (i === idx) {
          const newProf = { ...p, [key]: value };
          return newProf;
        }
        return p;
      })};
      return updated;
    });
  };

  const addMaterial = () => {
    setShowAddMaterial(true);
  };

  const acceptMaterial = () => {
    if (!newMaterial.tipoMaterial.trim()) {
      alert('Debe ingresar el tipo de material');
      return;
    }

    const validacion = validarTipoItem(newMaterial.tipoMaterial, 'material');
    if (!validacion.esValido) {
      alert(validacion.mensaje);
      return;
    }

    setForm(prev => ({ ...prev, materiales: [...prev.materiales, { ...newMaterial }] }));

    autoCrearConfigMaterial(newMaterial);

    setNewMaterial({
      tipoMaterial: '',
      cantidad: '',
      precioUnitario: ''
    });
    setErrorValidacionMaterial(null);
  };

  const cancelAddMaterial = () => {
    setNewMaterial({
      tipoMaterial: '',
      cantidad: '',
      precioUnitario: ''
    });
    setShowAddMaterial(false);
  };

  const updateNewMaterial = (key, value) => {
    setNewMaterial(prev => ({ ...prev, [key]: value }));

    if (key === 'tipoMaterial' && value.trim().length > 2) {
      const validacion = validarTipoItem(value, 'material');
      if (!validacion.esValido) {
        setErrorValidacionMaterial(validacion.mensaje);
      } else {
        setErrorValidacionMaterial(null);
      }
    } else if (key === 'tipoMaterial') {
      setErrorValidacionMaterial(null);
    }
  };

  const removeMaterial = (idx) => {
    setForm(prev => ({ ...prev, materiales: prev.materiales.filter((_, i) => i !== idx) }));
  };
  const updateMaterial = (idx, key, value) => {
    setForm(prev => ({ ...prev, materiales: prev.materiales.map((m, i) => i === idx ? { ...m, [key]: value } : m) }));
  };

  const addOtroCosto = () => {
    setShowAddOtroCosto(true);
  };

  const acceptOtroCosto = () => {
    if (!newOtroCosto.descripcion.trim()) {
      alert('Debe ingresar una descripción');
      return;
    }
    setForm(prev => ({
      ...prev,
      otrosCostos: [...(prev.otrosCostos || []), { ...newOtroCosto }]
    }));

    autoCrearConfigOtro(newOtroCosto);

    setNewOtroCosto({
      importe: '',
      descripcion: '',
      fecha: new Date().toISOString().split('T')[0]
    });
  };

  const cancelAddOtroCosto = () => {
    setNewOtroCosto({
      importe: '',
      descripcion: '',
      fecha: new Date().toISOString().split('T')[0]
    });
    setShowAddOtroCosto(false);
  };

  const updateNewOtroCosto = (key, value) => {
    setNewOtroCosto(prev => ({ ...prev, [key]: value }));
  };

  const removeOtroCosto = (idx) => {
    setForm(prev => ({
      ...prev,
      otrosCostos: (prev.otrosCostos || []).filter((_, i) => i !== idx)
    }));
  };
  const updateOtroCosto = (idx, key, value) => {
    setForm(prev => ({
      ...prev,
      otrosCostos: (prev.otrosCostos || []).map((o, i) => i === idx ? { ...o, [key]: value } : o)
    }));
  };

  const calcularHonorarios = () => {
    if (!form.honorarios) return { profesionales: 0, materiales: 0, otrosCostos: 0, configuracionPresupuesto: 0, jornales: 0, total: 0 };

    const totalProf = (form.profesionales || []).reduce((sum, p) => sum + (Number(p.importeCalculado) || 0), 0);
    const totalMat = (form.materiales || []).reduce((sum, m) => sum + ((Number(m.cantidad) || 0) * (Number(m.precioUnitario) || 0)), 0);
    const totalOtros = (form.otrosCostos || []).reduce((sum, oc) => sum + (Number(oc.importe) || 0), 0);

    let totalProfCalculadora = 0;
    let totalMatCalculadora = 0;
    let totalGastosGeneralesCalculadora = 0;
    let totalSinDesgloseCalculadora = 0;
    let totalJornalesCalculadora = 0;

    // ✅ FILTRAR ITEMS LEGACY antes de calcular honorarios
    const itemsValidosParaHonorarios = (itemsCalculadora || []).filter(item => {
      const esLegacy = item.tipoProfesional?.toLowerCase().includes('migrado') ||
                       item.tipoProfesional?.toLowerCase().includes('legacy') ||
                       item.descripcion?.toLowerCase().includes('migrados desde tabla legacy');
      return !esLegacy;
    });

    itemsValidosParaHonorarios.forEach(item => {
      const esGastoGeneral = item.esGastoGeneral === true ||
                            (item.tipoProfesional?.toLowerCase().includes('gasto') &&
                             item.tipoProfesional?.toLowerCase().includes('general'));

      if (esGastoGeneral) {
        totalGastosGeneralesCalculadora += parseFloat(item.total) || 0;
      } else {
        totalProfCalculadora += parseFloat(item.subtotalManoObra) || 0;
        totalMatCalculadora += parseFloat(item.subtotalMateriales) || 0;

        // ✅ CALCULAR TOTAL DE JORNALES
        if (item.jornales && item.jornales.length > 0) {
          const subtotalJornales = item.jornales.reduce((sum, j) => {
              const cant = Number(j.cantidadJornales || j.cantidad || 0);
              const val = Number(j.importeJornal || j.valorUnitario || 0);
              const sub = Number(j.subtotal) || (cant * val);
              return sum + sub;
          }, 0);
          totalJornalesCalculadora += subtotalJornales;
        } else if (item.subtotalJornales && item.subtotalJornales > 0) {
          totalJornalesCalculadora += parseFloat(item.subtotalJornales) || 0;
        }

        if (item.subtotalGastosGenerales && item.subtotalGastosGenerales > 0) {
          totalGastosGeneralesCalculadora += parseFloat(item.subtotalGastosGenerales) || 0;
        }

        const tieneProfesionales = (item.subtotalManoObra && item.subtotalManoObra > 0) ||
                                   (item.profesionales?.length > 0);
        const tieneMateriales = (item.subtotalMateriales && item.subtotalMateriales > 0) ||
                               (item.materialesLista?.length > 0);

        if (!tieneProfesionales && !tieneMateriales && item.total && item.total > 0) {
          totalSinDesgloseCalculadora += parseFloat(item.total) || 0;
        }
      }
    });

    // ✅ AGREGAR JORNALES DEL FORM DIRECTOS (si existen)
    if (form.jornales && form.jornales.length > 0) {
      const subtotalJornalesDirectos = form.jornales.reduce((sum, j) => sum + (Number(j.subtotal) || 0), 0);
      totalJornalesCalculadora += subtotalJornalesDirectos;
    }

    const totalProfCompleto = totalProf + totalProfCalculadora;
    const totalMatCompleto = totalMat + totalMatCalculadora;
    const totalOtrosCompleto = totalOtros + totalGastosGeneralesCalculadora;
    const totalCalculadora = totalSinDesgloseCalculadora;

    let honorarioProf = 0;
    let honorarioMat = 0;
    let honorarioOtros = 0;
    let honorarioCalculadora = 0;
    let honorarioJornales = 0;

    if (form.honorarios.profesionales?.activo && form.honorarios.profesionales?.valor) {
      const valor = Number(form.honorarios.profesionales.valor);
      if (form.honorarios.profesionales.tipo === 'porcentaje') {
        honorarioProf = (totalProfCompleto * valor) / 100;
      } else {
        honorarioProf = valor;
      }
    }
    if (form.honorarios.materiales?.activo && form.honorarios.materiales?.valor) {
      const valor = Number(form.honorarios.materiales.valor);
      if (form.honorarios.materiales.tipo === 'porcentaje') {
        honorarioMat = (totalMatCompleto * valor) / 100;
      } else {
        honorarioMat = valor;
      }
    }
    if (form.honorarios.otrosCostos?.activo && form.honorarios.otrosCostos?.valor) {
      const valor = Number(form.honorarios.otrosCostos.valor);
      if (form.honorarios.otrosCostos.tipo === 'porcentaje') {
        honorarioOtros = (totalOtrosCompleto * valor) / 100;
      } else {
        honorarioOtros = valor;
      }
    }
    if (form.honorarios.configuracionPresupuesto?.activo && form.honorarios.configuracionPresupuesto?.valor) {
      const valor = Number(form.honorarios.configuracionPresupuesto.valor);
      if (form.honorarios.configuracionPresupuesto.tipo === 'porcentaje') {
        honorarioCalculadora = (totalCalculadora * valor) / 100;
      } else {
        honorarioCalculadora = valor;
      }
    }

    // ✅ CALCULAR HONORARIOS DE JORNALES
    if (form.honorarios.jornales?.activo) {
      const configJornales = form.honorarios.jornales;

      // Modo "porRol" - calcular honorarios por cada jornal según su rol
      if (configJornales.modoAplicacion === 'porRol' && configJornales.porRol) {
        // Jornales de itemsCalculadora
        (itemsCalculadora || []).forEach(item => {
          if (item.jornales && item.jornales.length > 0) {
            item.jornales.forEach(jornal => {
              const configRol = configJornales.porRol[jornal.rol];
              if (configRol) {
                const subtotalJornal = Number(jornal.subtotal) || 0;
                if (configRol.tipo === 'porcentaje') {
                  honorarioJornales += (subtotalJornal * Number(configRol.valor)) / 100;
                } else {
                  honorarioJornales += Number(configRol.valor);
                }
              }
            });
          }
        });

        // Jornales directos del form
        if (form.jornales && form.jornales.length > 0) {
          form.jornales.forEach(jornal => {
            const configRol = configJornales.porRol[jornal.rol];
            if (configRol) {
              const subtotalJornal = Number(jornal.subtotal) || 0;
              if (configRol.tipo === 'porcentaje') {
                honorarioJornales += (subtotalJornal * Number(configRol.valor)) / 100;
              } else {
                honorarioJornales += Number(configRol.valor);
              }
            }
          });
        }
      }
      // Modo "todos" - aplicar el mismo porcentaje/valor a todos los jornales
      else if (configJornales.modoAplicacion === 'todos' && configJornales.valor) {
        const valor = Number(configJornales.valor);
        if (configJornales.tipo === 'porcentaje') {
          honorarioJornales = (totalJornalesCalculadora * valor) / 100;
        } else {
          honorarioJornales = valor;
        }
      }
      // Retrocompatibilidad - si no hay modoAplicacion definido
      else if (!configJornales.modoAplicacion && configJornales.valor) {
        const valor = Number(configJornales.valor);
        if (configJornales.tipo === 'porcentaje') {
          honorarioJornales = (totalJornalesCalculadora * valor) / 100;
        }
      }
    }

    return {
      profesionales: honorarioProf,
      materiales: honorarioMat,
      otrosCostos: honorarioOtros,
      configuracionPresupuesto: honorarioCalculadora,
      jornales: honorarioJornales,
      total: honorarioProf + honorarioMat + honorarioOtros + honorarioCalculadora + honorarioJornales
    };
  };

  const calcularMayoresCostos = () => {
    if (!form.mayoresCostos) return { profesionales: 0, materiales: 0, otrosCostos: 0, configuracionPresupuesto: 0, honorarios: 0, total: 0 };

    const totalProf = (form.profesionales || []).reduce((sum, p) => sum + (Number(p.importeCalculado) || 0), 0);
    const totalMat = (form.materiales || []).reduce((sum, m) => sum + ((Number(m.cantidad) || 0) * (Number(m.precioUnitario) || 0)), 0);
    const totalOtros = (form.otrosCostos || []).reduce((sum, oc) => sum + (Number(oc.importe) || 0), 0);

    let totalProfCalculadora = 0;
    let totalMatCalculadora = 0;
    let totalGastosGeneralesCalculadora = 0;
    let totalSinDesgloseCalculadora = 0;
    let totalJornalesCalculadora = 0; // ✅ NUEVO

    // ✅ FILTRAR ITEMS LEGACY antes de calcular mayores costos
    const itemsValidosParaMayoresCostos = (itemsCalculadora || []).filter(item => {
      const esLegacy = item.tipoProfesional?.toLowerCase().includes('migrado') ||
                       item.tipoProfesional?.toLowerCase().includes('legacy') ||
                       item.descripcion?.toLowerCase().includes('migrados desde tabla legacy');
      return !esLegacy;
    });

    itemsValidosParaMayoresCostos.forEach(item => {
      const esGastoGeneral = item.esGastoGeneral === true ||
                            (item.tipoProfesional?.toLowerCase().includes('gasto') &&
                             item.tipoProfesional?.toLowerCase().includes('general'));

      if (esGastoGeneral) {
        totalGastosGeneralesCalculadora += parseFloat(item.total) || 0;
      } else {
        totalProfCalculadora += parseFloat(item.subtotalManoObra) || 0;
        totalMatCalculadora += parseFloat(item.subtotalMateriales) || 0;

        // ✅ CALCULAR TOTAL DE JORNALES PARA MAYORES COSTOS
        if (item.jornales && item.jornales.length > 0) {
          const subtotalJornales = item.jornales.reduce((sum, j) => {
              const cant = Number(j.cantidadJornales || j.cantidad || 0);
              const val = Number(j.importeJornal || j.valorUnitario || 0);
              const sub = Number(j.subtotal) || (cant * val);
              return sum + sub;
          }, 0);
          totalJornalesCalculadora += subtotalJornales;
        } else if (item.subtotalJornales && item.subtotalJornales > 0) {
          totalJornalesCalculadora += parseFloat(item.subtotalJornales) || 0;
        }

        if (item.subtotalGastosGenerales && item.subtotalGastosGenerales > 0) {
          totalGastosGeneralesCalculadora += parseFloat(item.subtotalGastosGenerales) || 0;
        }

        const tieneProfesionales = (item.subtotalManoObra && item.subtotalManoObra > 0) ||
                                   (item.profesionales?.length > 0);
        const tieneMateriales = (item.subtotalMateriales && item.subtotalMateriales > 0) ||
                               (item.materialesLista?.length > 0);

        if (!tieneProfesionales && !tieneMateriales && item.total && item.total > 0) {
          totalSinDesgloseCalculadora += parseFloat(item.total) || 0;
        }
      }
    });

    // ✅ AGREGAR JORNALES DEL FORM DIRECTOS (si existen)
    if (form.jornales && form.jornales.length > 0) {
      const subtotalJornalesDirectos = form.jornales.reduce((sum, j) => sum + (Number(j.subtotal) || 0), 0);
      totalJornalesCalculadora += subtotalJornalesDirectos;
    }

    const totalProfCompleto = totalProf + totalProfCalculadora;
    const totalMatCompleto = totalMat + totalMatCalculadora;
    const totalOtrosCompleto = totalOtros + totalGastosGeneralesCalculadora;
    const totalCalculadora = totalSinDesgloseCalculadora;

    let mayorCostoProf = 0;
    let mayorCostoMat = 0;
    let mayorCostoOtros = 0;
    let mayorCostoCalculadora = 0;
    let mayorCostoJornales = 0; // ✅ NUEVO

    if (form.mayoresCostos.profesionales?.activo && form.mayoresCostos.profesionales?.valor) {
      const valor = Number(form.mayoresCostos.profesionales.valor);
      if (form.mayoresCostos.profesionales.tipo === 'porcentaje') {
        mayorCostoProf = (totalProfCompleto * valor) / 100;
      } else {
        mayorCostoProf = valor;
      }
    }
    if (form.mayoresCostos.materiales?.activo && form.mayoresCostos.materiales?.valor) {
      const valor = Number(form.mayoresCostos.materiales.valor);
      if (form.mayoresCostos.materiales.tipo === 'porcentaje') {
        mayorCostoMat = (totalMatCompleto * valor) / 100;
      } else {
        mayorCostoMat = valor;
      }
    }
    if (form.mayoresCostos.otrosCostos?.activo && form.mayoresCostos.otrosCostos?.valor) {
      const valor = Number(form.mayoresCostos.otrosCostos.valor);
      if (form.mayoresCostos.otrosCostos.tipo === 'porcentaje') {
        mayorCostoOtros = (totalOtrosCompleto * valor) / 100;
      } else {
        mayorCostoOtros = valor;
      }
    }
    if (form.mayoresCostos.configuracionPresupuesto?.activo && form.mayoresCostos.configuracionPresupuesto?.valor) {
      const valor = Number(form.mayoresCostos.configuracionPresupuesto.valor);
      if (form.mayoresCostos.configuracionPresupuesto.tipo === 'porcentaje') {
        mayorCostoCalculadora = (totalCalculadora * valor) / 100;
      } else {
        mayorCostoCalculadora = valor;
      }
    }

    // ✅ CALCULAR MAYORES COSTOS DE JORNALES
    if (form.mayoresCostos.jornales?.activo) {
      const configJornales = form.mayoresCostos.jornales;

      // Modo "porRol"
      if (configJornales.modoAplicacion === 'porRol' && configJornales.porRol) {
        // Jornales de itemsCalculadora
        (itemsCalculadora || []).forEach(item => {
          if (item.jornales && item.jornales.length > 0) {
            item.jornales.forEach(jornal => {
              const configRol = configJornales.porRol[jornal.rol];
              if (configRol) {
                const cant = Number(jornal.cantidadJornales || jornal.cantidad || 0);
                const val = Number(jornal.importeJornal || jornal.valorUnitario || 0);
                const sub = Number(jornal.subtotal) || (cant * val);

                if (configRol.tipo === 'porcentaje') {
                  mayorCostoJornales += (sub * Number(configRol.valor)) / 100;
                } else {
                  mayorCostoJornales += Number(configRol.valor);
                }
              }
            });
          }
        });

        // Jornales directos del form
        if (form.jornales && form.jornales.length > 0) {
          form.jornales.forEach(jornal => {
            const configRol = configJornales.porRol[jornal.rol];
            if (configRol) {
              const cant = Number(jornal.cantidadJornales || jornal.cantidad || 0);
              const val = Number(jornal.importeJornal || jornal.valorUnitario || 0);
              const sub = Number(jornal.subtotal) || (cant * val);

              if (configRol.tipo === 'porcentaje') {
                mayorCostoJornales += (sub * Number(configRol.valor)) / 100;
              } else {
                mayorCostoJornales += Number(configRol.valor);
              }
            }
          });
        }
      }
      // Modo "todos"
      else if (configJornales.modoAplicacion === 'todos' && configJornales.valor) {
        const valor = Number(configJornales.valor);
        if (configJornales.tipo === 'porcentaje') {
          mayorCostoJornales = (totalJornalesCalculadora * valor) / 100;
        } else {
          mayorCostoJornales = valor;
        }
      }
      // Retrocompatibilidad
      else if (!configJornales.modoAplicacion && configJornales.valor) {
        const valor = Number(configJornales.valor);
        if (configJornales.tipo === 'porcentaje') {
          mayorCostoJornales = (totalJornalesCalculadora * valor) / 100;
        }
      }
    }

    const honorariosBase = calcularHonorarios();
    let mayorCostoHonorarios = 0;

    if (form.mayoresCostos.honorarios?.activo && form.mayoresCostos.honorarios?.valor) {
      const valor = Number(form.mayoresCostos.honorarios.valor);
      if (form.mayoresCostos.honorarios.tipo === 'porcentaje') {
        mayorCostoHonorarios = (honorariosBase.total * valor) / 100;
      } else {
        mayorCostoHonorarios = valor;
      }
    }

    return {
      profesionales: mayorCostoProf,
      materiales: mayorCostoMat,
      otrosCostos: mayorCostoOtros,
      configuracionPresupuesto: mayorCostoCalculadora,
      honorarios: mayorCostoHonorarios,
      jornales: mayorCostoJornales, // ✅ NUEVO
      total: mayorCostoProf + mayorCostoMat + mayorCostoOtros + mayorCostoCalculadora + mayorCostoHonorarios + mayorCostoJornales
    };
  };



  const totalBaseProfesionales = (form.profesionales || []).reduce((sum, p) => sum + (Number(p.importeCalculado) || 0), 0);
  const totalBaseMateriales = (form.materiales || []).reduce((sum, m) => sum + ((Number(m.cantidad) || 0) * (Number(m.precioUnitario) || 0)), 0);
  const totalBaseOtrosCostos = (form.otrosCostos || []).reduce((sum, o) => sum + (Number(o.importe) || 0), 0);
  const totalBaseCalculadora = (itemsCalculadora || []).reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);

  const mayoresCostosActuales = calcularMayoresCostos();

  const totalFinalProfesionales = totalBaseProfesionales + mayoresCostosActuales.profesionales;
  const totalFinalMateriales = totalBaseMateriales + mayoresCostosActuales.materiales;
  const totalFinalOtrosCostos = totalBaseOtrosCostos + mayoresCostosActuales.otrosCostos;
  const totalFinalCalculadora = totalBaseCalculadora + mayoresCostosActuales.configuracionPresupuesto;

  const totalGeneralBase = totalBaseProfesionales + totalBaseMateriales + totalBaseOtrosCostos + totalBaseCalculadora;

  const honorariosActuales = calcularHonorarios();

  const totalFinalConTodo = totalGeneralBase + honorariosActuales.total + mayoresCostosActuales.total;

  const itemsCalculadoraConsolidados = React.useMemo(() => {

    if (!itemsCalculadora || itemsCalculadora.length === 0) {
      return [];
    }

    // DEBUG: Ver qué tiene itemsCalculadora al inicio del useMemo
    if (!estaCargandoInicialRef.current) {
      console.log('🧮 INICIO CONSOLIDACIÓN - itemsCalculadora[0]:', {
        tipoProfesional: itemsCalculadora[0]?.tipoProfesional,
        incluirEnCalculoDias: itemsCalculadora[0]?.incluirEnCalculoDias,
        tipo: typeof itemsCalculadora[0]?.incluirEnCalculoDias,
        keys: Object.keys(itemsCalculadora[0] || {}).filter(k => k.includes('incluir'))
      });
    }

    // ✅ FILTRAR rubros duplicados o legacy que ya están incluidos en otros rubros
    const itemsFiltrados = itemsCalculadora.filter(item => {
      // Filtrar el rubro "Jornales Migrados (Legacy)" porque sus jornales ya están en otros rubros
      const esLegacyDuplicado = item.tipoProfesional?.toLowerCase().includes('migrado') ||
                                item.tipoProfesional?.toLowerCase().includes('legacy') ||
                                item.descripcion?.toLowerCase().includes('migrados desde tabla legacy');

      if (esLegacyDuplicado) {
        if (!estaCargandoInicialRef.current) {
          console.warn('⚠️ Filtrando rubro duplicado/legacy:', item.tipoProfesional, item.descripcion);
        }
        return false;
      }

      return true;
    });

    const agrupados = Object.values(
      itemsFiltrados.reduce((acc, item) => {
        const key = item.tipoProfesional?.trim().toLowerCase();
        if (!key) return acc;

        // DEBUG: Log del valor ANTES de consolidar
        if (item.tipoProfesional?.toLowerCase().includes('albañil') && !estaCargandoInicialRef.current) {
          console.log('🟢 CONSOLIDANDO Albañileria - incluirEnCalculoDias:', item.incluirEnCalculoDias, 'tipo:', typeof item.incluirEnCalculoDias);
        }

        if (!acc[key]) {
          acc[key] = {
            id: item.id, // ✨ Guardar el ID del primer item de este tipo
            tipoProfesional: item.tipoProfesional,
            profesionales: [],
            jornales: [],
            materialesLista: [],
            gastosGenerales: [],
            subtotalJornales: 0,
            subtotalManoObra: 0,
            subtotalMateriales: 0,
            subtotalGastosGenerales: 0,
            totalManual: 0,
            total: 0,
            incluirEnCalculoDias: item.incluirEnCalculoDias, // ✅ Preservar el valor exacto del backend
            trabajaEnParalelo: item.trabajaEnParalelo, // ✅ Preservar checkbox de inclusión en cálculo de días
            descripcion: item.descripcion,
            observaciones: item.observaciones,
            descripcionJornales: item.descripcionJornales,
            observacionesJornales: item.observacionesJornales,
            descripcionProfesionales: item.descripcionProfesionales,
            observacionesProfesionales: item.observacionesProfesionales,
            descripcionMateriales: item.descripcionMateriales,
            observacionesMateriales: item.observacionesMateriales,
            descripcionGastosGenerales: item.descripcionGastosGenerales,
            observacionesGastosGenerales: item.observacionesGastosGenerales,
            descripcionTotalManual: item.descripcionTotalManual,
            observacionesTotalManual: item.observacionesTotalManual,
            esModoManual: item.esModoManual,
            esGastoGeneral: item.esGastoGeneral,
            nombreObra: item.nombreObra || '',
          };
        }
        acc[key].profesionales = acc[key].profesionales.concat(item.profesionales || []);
        acc[key].jornales = acc[key].jornales.concat(item.jornales || []);
        acc[key].materialesLista = acc[key].materialesLista.concat(item.materialesLista || []);
        acc[key].gastosGenerales = acc[key].gastosGenerales.concat(item.gastosGenerales || []);

        // Calcular subtotales desde los arrays si no vienen del backend
        const subtotalJornalesCalculado = item.jornales ? item.jornales.reduce((sum, j) => sum + (Number(j.subtotal) || (Number(j.cantidadJornales || j.cantidad || 0) * Number(j.importeJornal || j.valorUnitario || 0)) || 0), 0) : 0;
        const subtotalProfesionalesCalculado = item.profesionales ? item.profesionales.reduce((sum, p) => sum + (Number(p.subtotal) || 0), 0) : 0;
        const subtotalMaterialesCalculado = item.materialesLista ? item.materialesLista.reduce((sum, m) => sum + (Number(m.subtotal) || Number(m.total) || (Number(m.cantidad || 0) * Number(m.precio || 0)) || 0), 0) : 0;
        const subtotalGastosGeneralesCalculado = item.gastosGenerales ? item.gastosGenerales.reduce((sum, g) => sum + (Number(g.subtotal) || 0), 0) : 0;

        // ✅ CORREGIDO: Usar siempre los valores calculados desde los arrays
        acc[key].subtotalJornales += subtotalJornalesCalculado || Number(item.subtotalJornales || 0);
        acc[key].subtotalManoObra += subtotalProfesionalesCalculado || Number(item.subtotalManoObra || 0);
        acc[key].subtotalMateriales += subtotalMaterialesCalculado || Number(item.subtotalMateriales || 0);
        acc[key].subtotalGastosGenerales += subtotalGastosGeneralesCalculado || Number(item.subtotalGastosGenerales || 0);

        if (item.descripcion && item.descripcion.trim()) {
          acc[key].descripcion = item.descripcion;
        }
        if (item.observaciones && item.observaciones.trim()) {
          acc[key].observaciones = item.observaciones;
        }

        if (item.descripcionJornales && item.descripcionJornales.trim()) {
          acc[key].descripcionJornales = item.descripcionJornales;
        }
        if (item.observacionesJornales && item.observacionesJornales.trim()) {
          acc[key].observacionesJornales = item.observacionesJornales;
        }

        if (item.descripcionProfesionales && item.descripcionProfesionales.trim()) {
          acc[key].descripcionProfesionales = item.descripcionProfesionales;
        }
        if (item.observacionesProfesionales && item.observacionesProfesionales.trim()) {
          acc[key].observacionesProfesionales = item.observacionesProfesionales;
        }
        if (item.descripcionMateriales && item.descripcionMateriales.trim()) {
          acc[key].descripcionMateriales = item.descripcionMateriales;
        }
        if (item.observacionesMateriales && item.observacionesMateriales.trim()) {
          acc[key].observacionesMateriales = item.observacionesMateriales;
        }
        if (item.descripcionGastosGenerales && item.descripcionGastosGenerales.trim()) {
          acc[key].descripcionGastosGenerales = item.descripcionGastosGenerales;
        } else if (item.descripcionGastosGenerales === null) {
          acc[key].descripcionGastosGenerales = null;
        }
        if (item.observacionesGastosGenerales && item.observacionesGastosGenerales.trim()) {
          acc[key].observacionesGastosGenerales = item.observacionesGastosGenerales;
        } else if (item.observacionesGastosGenerales === null) {
          acc[key].observacionesGastosGenerales = null;
        }

        // Agregar descripción y observaciones de Total Manual
        if (item.descripcionTotalManual && item.descripcionTotalManual.trim()) {
          acc[key].descripcionTotalManual = item.descripcionTotalManual;
        }
        if (item.observacionesTotalManual && item.observacionesTotalManual.trim()) {
          acc[key].observacionesTotalManual = item.observacionesTotalManual;
        }

        // Calcular el total base incluyendo totalManual
        // ✅ CORREGIDO: Usar valores calculados desde arrays, NO desde campos del backend
        const baseItem = subtotalJornalesCalculado +
                        subtotalProfesionalesCalculado +
                        subtotalMaterialesCalculado +
                        subtotalGastosGeneralesCalculado +
                        Number(item.totalManual || 0);
        acc[key].total += baseItem;

        // Acumular totalManual también
        if (item.totalManual && Number(item.totalManual) > 0) {
          acc[key].totalManual = (acc[key].totalManual || 0) + Number(item.totalManual);
        }

        if (item.tipoProfesional?.toLowerCase() === 'plomeria') {
        }

        return acc;
      }, {})
    );


    if (form.honorarios) {
      agrupados.forEach(rubro => {
        let honorariosRubro = 0;
        let honorariosJornales = 0;
        let honorariosManoObra = 0;
        let honorariosMateriales = 0;
        let honorariosGastosGenerales = 0;
        let honorariosTotalManual = 0;

        if (form.honorarios.aplicarATodos && form.honorarios.valorGeneral) {
          const valor = Number(form.honorarios.valorGeneral);
          if (form.honorarios.tipoGeneral === 'porcentaje') {
            honorariosJornales = (rubro.subtotalJornales * valor) / 100;
            honorariosManoObra = (rubro.subtotalManoObra * valor) / 100;
            honorariosMateriales = (rubro.subtotalMateriales * valor) / 100;
            honorariosGastosGenerales = (rubro.subtotalGastosGenerales * valor) / 100;
            // Aplicar honorarios al Total Manual también
            if (rubro.totalManual && rubro.totalManual > 0) {
              honorariosTotalManual = (rubro.totalManual * valor) / 100;
            }
            honorariosRubro = honorariosJornales + honorariosManoObra + honorariosMateriales + honorariosGastosGenerales + honorariosTotalManual;
          }
        } else {
          // 🔄 HONORARIOS DE JORNALES - Considerar modo de aplicación
          if (form.honorarios.jornales?.activo) {
            const configJornales = form.honorarios.jornales;

            // Modo "porRol" - calcular honorarios por cada jornal según su rol
            if (configJornales.modoAplicacion === 'porRol' && configJornales.porRol && rubro.jornales) {
              rubro.jornales.forEach(jornal => {
                const configRol = configJornales.porRol[jornal.rol];
                if (configRol) {
                  const subtotalJornal = Number(jornal.subtotal) || 0;
                  if (configRol.tipo === 'porcentaje') {
                    honorariosJornales += (subtotalJornal * Number(configRol.valor)) / 100;
                  } else { // monto fijo
                    honorariosJornales += Number(configRol.valor);
                  }
                }
              });
              honorariosRubro += honorariosJornales;
            }
            // Modo "todos" - aplicar el mismo porcentaje/valor a todos los jornales
            else if (configJornales.modoAplicacion === 'todos' && configJornales.valor) {
              const valor = Number(configJornales.valor);
              if (configJornales.tipo === 'porcentaje') {
                honorariosJornales = (rubro.subtotalJornales * valor) / 100;
                honorariosRubro += honorariosJornales;
              } else { // monto fijo
                honorariosJornales = valor;
                honorariosRubro += honorariosJornales;
              }
            }
            // Retrocompatibilidad - si no hay modoAplicacion definido
            else if (!configJornales.modoAplicacion && configJornales.valor) {
              const valor = Number(configJornales.valor);
              if (configJornales.tipo === 'porcentaje') {
                honorariosJornales = (rubro.subtotalJornales * valor) / 100;
                honorariosRubro += honorariosJornales;
              }
            }
          }

          if (form.honorarios.profesionales?.activo && form.honorarios.profesionales?.valor) {
            const valor = Number(form.honorarios.profesionales.valor);
            if (form.honorarios.profesionales.tipo === 'porcentaje') {
              honorariosManoObra = (rubro.subtotalManoObra * valor) / 100;
              honorariosRubro += honorariosManoObra;
            }
          }

          if (form.honorarios.materiales?.activo && form.honorarios.materiales?.valor) {
            const valor = Number(form.honorarios.materiales.valor);
            if (form.honorarios.materiales.tipo === 'porcentaje') {
              honorariosMateriales = (rubro.subtotalMateriales * valor) / 100;
              honorariosRubro += honorariosMateriales;
            }
          }

          if (form.honorarios.otrosCostos?.activo && form.honorarios.otrosCostos?.valor) {
            const valor = Number(form.honorarios.otrosCostos.valor);
            if (form.honorarios.otrosCostos.tipo === 'porcentaje') {
              honorariosGastosGenerales = (rubro.subtotalGastosGenerales * valor) / 100;
              honorariosRubro += honorariosGastosGenerales;
            }
          }

          // Aplicar honorarios de "configuracionPresupuesto" al Total Manual
          if (rubro.totalManual && rubro.totalManual > 0 &&
              form.honorarios.configuracionPresupuesto?.activo &&
              form.honorarios.configuracionPresupuesto?.valor) {
            const valor = Number(form.honorarios.configuracionPresupuesto.valor);
            if (form.honorarios.configuracionPresupuesto.tipo === 'porcentaje') {
              honorariosTotalManual = (rubro.totalManual * valor) / 100;
              honorariosRubro += honorariosTotalManual;
            }
          }
        }

        rubro.honorariosJornales = honorariosJornales;
        rubro.honorariosManoObra = honorariosManoObra;
        rubro.honorariosMateriales = honorariosMateriales;
        rubro.honorariosGastosGenerales = honorariosGastosGenerales;
        rubro.honorariosTotalManual = honorariosTotalManual;

        rubro.subtotalJornalesConHonorarios = rubro.subtotalJornales + honorariosJornales;
        rubro.subtotalManoObraConHonorarios = rubro.subtotalManoObra + honorariosManoObra;
        rubro.subtotalMaterialesConHonorarios = rubro.subtotalMateriales + honorariosMateriales;
        rubro.subtotalGastosGeneralesConHonorarios = rubro.subtotalGastosGenerales + honorariosGastosGenerales;
        rubro.totalManualConHonorarios = (rubro.totalManual || 0) + honorariosTotalManual;


        rubro.total += honorariosRubro;
        rubro.honorariosAplicados = honorariosRubro;
      });
    }

    if (form.mayoresCostos) {
      agrupados.forEach(rubro => {

        let mayoresCostosRubro = 0;
        let mayoresCostosJornales = 0;
        let mayoresCostosManoObra = 0;
        let mayoresCostosMateriales = 0;
        let mayoresCostosGastosGenerales = 0;
        let mayoresCostosHonorarios = 0;

        if (form.mayoresCostos.jornales?.activo) {
          const configJornales = form.mayoresCostos.jornales;

          // Modo "porRol" - calcular mayores costos por cada jornal según su rol
          if (configJornales.modoAplicacion === 'porRol' && configJornales.porRol && rubro.jornales) {
            rubro.jornales.forEach(jornal => {
              const configRol = configJornales.porRol[jornal.rol];
              if (configRol) {
                const baseJornal = (Number(jornal.subtotal) || 0) + (rubro.honorariosJornales || 0) / rubro.jornales.length;
                if (configRol.tipo === 'porcentaje') {
                  mayoresCostosJornales += (baseJornal * Number(configRol.valor)) / 100;
                } else { // monto fijo
                  mayoresCostosJornales += Number(configRol.valor);
                }
              }
            });
            mayoresCostosRubro += mayoresCostosJornales;
          }
          // Modo "todos" - aplicar el mismo porcentaje/valor a todos los jornales
          else if (configJornales.modoAplicacion === 'todos' && configJornales.valor) {
            const valor = Number(configJornales.valor);
            if (configJornales.tipo === 'porcentaje') {
              // Aplicar solo sobre el base, NO sobre el base+honorarios
              mayoresCostosJornales = (rubro.subtotalJornales * valor) / 100;
              mayoresCostosRubro += mayoresCostosJornales;
            } else { // monto fijo
              mayoresCostosJornales = valor;
              mayoresCostosRubro += mayoresCostosJornales;
            }
          }
          // Retrocompatibilidad - si no hay modoAplicacion definido
          else if (!configJornales.modoAplicacion && configJornales.valor) {
            const valor = Number(configJornales.valor);
            if (configJornales.tipo === 'porcentaje') {
              mayoresCostosJornales = (rubro.subtotalJornales * valor) / 100;
              mayoresCostosRubro += mayoresCostosJornales;
            }
          }
        }

        if (form.mayoresCostos.profesionales?.activo && form.mayoresCostos.profesionales?.valor) {
          const valor = Number(form.mayoresCostos.profesionales.valor);
          if (form.mayoresCostos.profesionales.tipo === 'porcentaje') {
            // ✅ CORREGIDO: Aplicar sobre la base SIN honorarios (consistente con UI de Mayores Costos)
            mayoresCostosManoObra = (rubro.subtotalManoObra * valor) / 100;
            mayoresCostosRubro += mayoresCostosManoObra;
          } else {
            mayoresCostosRubro += valor;
          }
        }

        if (form.mayoresCostos.materiales?.activo && form.mayoresCostos.materiales?.valor) {
          const valor = Number(form.mayoresCostos.materiales.valor);
          if (form.mayoresCostos.materiales.tipo === 'porcentaje') {
            // ✅ CORREGIDO: Aplicar sobre la base SIN honorarios (consistente con UI de Mayores Costos)
            mayoresCostosMateriales = (rubro.subtotalMateriales * valor) / 100;
            mayoresCostosRubro += mayoresCostosMateriales;
          } else {
            mayoresCostosRubro += valor;
          }
        }

        if (form.mayoresCostos.otrosCostos?.activo && form.mayoresCostos.otrosCostos?.valor) {
          const valor = Number(form.mayoresCostos.otrosCostos.valor);
          if (form.mayoresCostos.otrosCostos.tipo === 'porcentaje') {
            // ✅ CORREGIDO: Aplicar sobre la base SIN honorarios (consistente con UI de Mayores Costos)
            mayoresCostosGastosGenerales = (rubro.subtotalGastosGenerales * valor) / 100;
            mayoresCostosRubro += mayoresCostosGastosGenerales;
          } else {
            mayoresCostosRubro += valor;
          }
        }

        // Aplicar mayores costos al Total Manual
        let mayoresCostosTotalManual = 0;
        if (rubro.totalManual && rubro.totalManual > 0 &&
            form.mayoresCostos.configuracionPresupuesto?.activo &&
            form.mayoresCostos.configuracionPresupuesto?.valor) {
          const valor = Number(form.mayoresCostos.configuracionPresupuesto.valor);
          if (form.mayoresCostos.configuracionPresupuesto.tipo === 'porcentaje') {
            // ✅ CORREGIDO: Aplicar sobre la base SIN honorarios (consistente con UI de Mayores Costos)
            mayoresCostosTotalManual = (rubro.totalManual * valor) / 100;
            mayoresCostosRubro += mayoresCostosTotalManual;
          }
        }

        // Aplicar mayores costos a los Honorarios totales
        let mcHonJornales = 0;
        let mcHonManoObra = 0;
        let mcHonMateriales = 0;
        let mcHonGastosGenerales = 0;

        if (form.mayoresCostos.honorarios?.activo && form.mayoresCostos.honorarios?.valor) {
          const valor = Number(form.mayoresCostos.honorarios.valor);
          if (form.mayoresCostos.honorarios.tipo === 'porcentaje') {
            // Calcular honorarios individuales para distribuir proporcionalmente
            const hJornales = rubro.honorariosJornales || 0;
            const hManoObra = rubro.honorariosManoObra || 0;
            const hMateriales = rubro.honorariosMateriales || 0;
            const hGastosGenerales = rubro.honorariosGastosGenerales || 0;

            mcHonJornales = (hJornales * valor) / 100;
            mcHonManoObra = (hManoObra * valor) / 100;
            mcHonMateriales = (hMateriales * valor) / 100;
            mcHonGastosGenerales = (hGastosGenerales * valor) / 100;

            const honorariosSinTotalManual = hJornales + hManoObra + hMateriales + hGastosGenerales;

            if (honorariosSinTotalManual > 0) {
              mayoresCostosHonorarios = mcHonJornales + mcHonManoObra + mcHonMateriales + mcHonGastosGenerales;
              mayoresCostosRubro += mayoresCostosHonorarios;
            }
          }
        }

        rubro.mayoresCostosJornales = mayoresCostosJornales;
        rubro.mayoresCostosManoObra = mayoresCostosManoObra;
        rubro.mayoresCostosMateriales = mayoresCostosMateriales;
        rubro.mayoresCostosGastosGenerales = mayoresCostosGastosGenerales;
        rubro.mayoresCostosTotalManual = mayoresCostosTotalManual;
        rubro.mayoresCostosHonorarios = mayoresCostosHonorarios;

        // Total Final = Base + Honorarios + MC(Base) + MC(Honorarios)
        rubro.subtotalJornalesFinal = rubro.subtotalJornalesConHonorarios + mayoresCostosJornales + mcHonJornales;
        rubro.subtotalManoObraFinal = rubro.subtotalManoObraConHonorarios + mayoresCostosManoObra + mcHonManoObra;
        rubro.subtotalMaterialesFinal = rubro.subtotalMaterialesConHonorarios + mayoresCostosMateriales + mcHonMateriales;
        rubro.subtotalGastosGeneralesFinal = rubro.subtotalGastosGeneralesConHonorarios + mayoresCostosGastosGenerales + mcHonGastosGenerales;

        rubro.total += mayoresCostosRubro;
        rubro.mayoresCostosAplicados = mayoresCostosRubro;
      });
    }

    const totalConsolidado = agrupados.reduce((sum, r) => sum + r.total, 0);

    return agrupados;
  }, [
    itemsCalculadora,
    form.honorarios,
    form.mayoresCostos
  ]);

  // 🎯 Modo de presupuesto detectado con hook reutilizable (ver línea ~237)

  useEffect(() => {
    console.log('🚩 [useEffect-6262] Ejecutado');
    if (show) {
      setTimeout(() => {
        const modalContent = document.querySelector('.modal-body');
        if (modalContent) {
          modalContent.scrollTop = 0;
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    }
  }, [show]);

  if (!show) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'direccionObraBarrio' || name === 'direccionObraTorre') {
    }

    // Si cambia el tipo de presupuesto a TRABAJOS_SEMANALES, establecer estado OBRA_A_CONFIRMAR
    if (name === 'tipoPresupuesto') {
      if (value === 'TRABAJOS_SEMANALES') {
        setForm(prev => ({ ...prev, [name]: value, estado: 'OBRA_A_CONFIRMAR' }));
      } else {
        setForm(prev => ({ ...prev, [name]: value }));
      }
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }

    setErrors(prev => ({ ...prev, [name]: undefined }));
  };

  /**
   * Sincroniza los datos del solicitante con el cliente genérico/asociado
   * Se ejecuta automáticamente cuando se editan campos del solicitante
   */
  const sincronizarCliente = async () => {
    if (!form.nombreSolicitante && !form.telefono && !form.mail && !form.direccionParticular) {
      return;
    }

    try {

      const empresaId = form.idEmpresa || empresaSeleccionada?.id;
      if (!empresaId) return;

      const clientesResponse = await apiService.clientes.getAllSimple(empresaId);
      const listaClientes = Array.isArray(clientesResponse) ? clientesResponse : (clientesResponse.datos || clientesResponse.content || []);

      let clienteExistente = listaClientes.find(c =>
        c.nombre?.toLowerCase().includes('genérico') ||
        c.nombre?.toLowerCase().includes('sin cliente') ||
        c.cuit === '00-00000000-0' ||
        (form.nombreSolicitante && c.nombre?.toLowerCase() === form.nombreSolicitante.toLowerCase())
      );

      const datosCliente = {
        nombre: form.nombreSolicitante || 'Cliente Genérico',
        telefono: form.telefono || 'N/A',
        email: form.mail || 'generico@sistema.com',
        direccion: form.direccionParticular || '',
        activo: true
      };

      if (clienteExistente) {
        const clienteId = clienteExistente.id_cliente || clienteExistente.id || clienteExistente.idCliente;
        await apiService.clientes.update(clienteId, datosCliente);
      } else {
        datosCliente.cuit = '00-00000000-0'; // CUIT genérico
        await apiService.clientes.create(datosCliente, empresaId);
      }
    } catch (error) {
    }
  };

  /**
   * Detecta si hubo cambios en campos "críticos" que justifican crear una nueva versión.
   * Campos críticos: fechas, estado, tiempoEstimadoTerminacion, descripcion, observaciones,
   * profesionales, materiales, otrosCostos, configuraciones.
   *
   * Campos NO críticos (NO crean versión): nombreSolicitante, telefono, mail, direccionParticular
   */
  // Detecta si SOLO cambiaron fechaProbableInicio o tiempoEstimadoTerminacion
  const detectSoloCambiosFechasDias = () => {
    if (!safeInitial.id) {
      return false;
    }

    const normalize = (val) => val === null || val === undefined || val === '' ? '' : String(val).trim();

    // Verificar si cambiaron fechaProbableInicio o tiempoEstimadoTerminacion
    const fechaProbableCambiada = normalize(form.fechaProbableInicio) !== normalize(safeInitial.fechaProbableInicio);
    const tiempoCambiado = normalize(form.tiempoEstimadoTerminacion) !== normalize(safeInitial.tiempoEstimadoTerminacion);

    // Si no cambiaron estos campos, no es solo cambio de fechas/días
    if (!fechaProbableCambiada && !tiempoCambiado) {
      return false;
    }

    // Verificar que NO hayan cambiado otros campos críticos
    const otrasFechasCambiadas = (
      normalize(form.vencimiento) !== normalize(safeInitial.vencimiento) ||
      normalize(form.fechaCreacion) !== normalize(safeInitial.fechaCreacion)
    );

    const estadoCambiado = normalize(form.estado) !== normalize(safeInitial.estado);

    const descripcionCambiada = (
      normalize(form.descripcion) !== normalize(safeInitial.descripcion) ||
      normalize(form.observaciones) !== normalize(safeInitial.observaciones)
    );

    const direccionObraCambiada = (
      normalize(form.direccionObraBarrio) !== normalize(safeInitial.direccionObraBarrio) ||
      normalize(form.direccionObraCalle) !== normalize(safeInitial.direccionObraCalle) ||
      normalize(form.direccionObraAltura) !== normalize(safeInitial.direccionObraAltura) ||
      normalize(form.direccionObraTorre) !== normalize(safeInitial.direccionObraTorre) ||
      normalize(form.direccionObraPiso) !== normalize(safeInitial.direccionObraPiso) ||
      normalize(form.direccionObraDepartamento) !== normalize(safeInitial.direccionObraDepartamento)
    );

    const arraysIguales = (arr1, arr2) => {
      if (arr1.length !== arr2.length) return false;
      const sorted1 = JSON.stringify([...arr1].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
      const sorted2 = JSON.stringify([...arr2].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
      return sorted1 === sorted2;
    };

    const profesionalesInitial = safeInitial.profesionales || [];
    const profesionalesCambiados = !arraysIguales(form.profesionales, profesionalesInitial);

    const materialesInitial = safeInitial.materiales || [];
    const materialesCambiados = !arraysIguales(form.materiales, materialesInitial);

    const otrosCostosInitial = safeInitial.otrosCostos || [];
    const otrosCostosCambiados = !arraysIguales(form.otrosCostos, otrosCostosInitial);

    const parseIfString = (v) => {
      if (!v) return [];
      if (typeof v === 'string') {
        try { return JSON.parse(v); } catch (e) { return []; }
      }
      if (Array.isArray(v)) return v;
      return [];
    };

    const configsProfesionalesInitial = parseIfString(safeInitial.configuracionesProfesionales);
    const configsMaterialesInitial = parseIfString(safeInitial.configuracionesMateriales);
    const configsOtrosInitial = parseIfString(safeInitial.configuracionesOtros);

    const configsCambiadas = (
      !arraysIguales(configsProfesionales, configsProfesionalesInitial) ||
      !arraysIguales(configsMateriales, configsMaterialesInitial) ||
      !arraysIguales(configsOtros, configsOtrosInitial)
    );

    const itemsCalculadoraInitial = safeInitial.itemsCalculadora || [];

    const normalizarItem = (item) => ({
      id: item.id,
      tipoProfesional: normalize(item.tipoProfesional),
      cantidadJornales: item.cantidadJornales || 0,
      importeJornal: item.importeJornal || 0,
      subtotalManoObra: item.subtotalManoObra || 0,
      materiales: item.materiales || 0,
      totalManual: item.totalManual,
      total: item.total || 0,
      esModoManual: item.esModoManual || false,
      profesionales: item.profesionales || [],
      materialesLista: item.materialesLista || []
    });

    const itemsActualesNormalizados = itemsCalculadora.map(normalizarItem);
    const itemsInicialesNormalizados = itemsCalculadoraInitial.map(normalizarItem);

    const itemsCalculadoraCambiados = !arraysIguales(itemsActualesNormalizados, itemsInicialesNormalizados);

    // Si cambiaron otros campos críticos, NO es solo cambio de fechas/días
    const otrosCambiosCriticos =
      otrasFechasCambiadas ||
      estadoCambiado ||
      descripcionCambiada ||
      direccionObraCambiada ||
      profesionalesCambiados ||
      materialesCambiados ||
      otrosCostosCambiados ||
      configsCambiadas ||
      itemsCalculadoraCambiados;

    // Retorna true solo si cambiaron fechaProbableInicio/tiempoEstimadoTerminacion y NO otros campos
    return !otrosCambiosCriticos;
  };

  const detectCriticalChanges = () => {
    if (!safeInitial.id) {
      return true;
    }

    const normalize = (val) => val === null || val === undefined || val === '' ? '' : String(val).trim();

    const fechaCambiada = (
      normalize(form.fechaProbableInicio) !== normalize(safeInitial.fechaProbableInicio) ||
      normalize(form.vencimiento) !== normalize(safeInitial.vencimiento) ||
      normalize(form.fechaCreacion) !== normalize(safeInitial.fechaCreacion)
    );

    const estadoCambiado = normalize(form.estado) !== normalize(safeInitial.estado);
    const tiempoCambiado = normalize(form.tiempoEstimadoTerminacion) !== normalize(safeInitial.tiempoEstimadoTerminacion);

    const descripcionCambiada = (
      normalize(form.descripcion) !== normalize(safeInitial.descripcion) ||
      normalize(form.observaciones) !== normalize(safeInitial.observaciones)
    );

    const direccionObraCambiada = (
      normalize(form.direccionObraBarrio) !== normalize(safeInitial.direccionObraBarrio) ||
      normalize(form.direccionObraCalle) !== normalize(safeInitial.direccionObraCalle) ||
      normalize(form.direccionObraAltura) !== normalize(safeInitial.direccionObraAltura) ||
      normalize(form.direccionObraTorre) !== normalize(safeInitial.direccionObraTorre) ||
      normalize(form.direccionObraPiso) !== normalize(safeInitial.direccionObraPiso) ||
      normalize(form.direccionObraDepartamento) !== normalize(safeInitial.direccionObraDepartamento)
    );

    const arraysIguales = (arr1, arr2) => {
      if (arr1.length !== arr2.length) return false;
      const sorted1 = JSON.stringify([...arr1].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
      const sorted2 = JSON.stringify([...arr2].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
      return sorted1 === sorted2;
    };

    const profesionalesInitial = safeInitial.profesionales || [];
    const profesionalesCambiados = !arraysIguales(form.profesionales, profesionalesInitial);

    const materialesInitial = safeInitial.materiales || [];
    const materialesCambiados = !arraysIguales(form.materiales, materialesInitial);

    const otrosCostosInitial = safeInitial.otrosCostos || [];
    const otrosCostosCambiados = !arraysIguales(form.otrosCostos, otrosCostosInitial);

    const parseIfString = (v) => {
      if (!v) return [];
      if (typeof v === 'string') {
        try { return JSON.parse(v); } catch (e) { return []; }
      }
      if (Array.isArray(v)) return v;
      return [];
    };

    const configsProfesionalesInitial = parseIfString(safeInitial.configuracionesProfesionales);
    const configsMaterialesInitial = parseIfString(safeInitial.configuracionesMateriales);
    const configsOtrosInitial = parseIfString(safeInitial.configuracionesOtros);

    const configsCambiadas = (
      !arraysIguales(configsProfesionales, configsProfesionalesInitial) ||
      !arraysIguales(configsMateriales, configsMaterialesInitial) ||
      !arraysIguales(configsOtros, configsOtrosInitial)
    );

    const itemsCalculadoraInitial = safeInitial.itemsCalculadora || [];

    const normalizarItem = (item) => ({
      id: item.id,
      tipoProfesional: normalize(item.tipoProfesional),
      cantidadJornales: item.cantidadJornales || 0,
      importeJornal: item.importeJornal || 0,
      subtotalManoObra: item.subtotalManoObra || 0,
      materiales: item.materiales || 0,
      totalManual: item.totalManual,
      total: item.total || 0,
      esModoManual: item.esModoManual || false,
      profesionales: item.profesionales || [],
      materialesLista: item.materialesLista || []
    });

    const itemsActualesNormalizados = itemsCalculadora.map(normalizarItem);
    const itemsInicialesNormalizados = itemsCalculadoraInitial.map(normalizarItem);

    const itemsCalculadoraCambiados = !arraysIguales(itemsActualesNormalizados, itemsInicialesNormalizados);

    const hayCambiosCriticos =
      fechaCambiada ||
      estadoCambiado ||
      tiempoCambiado ||
      descripcionCambiada ||
      direccionObraCambiada ||
      profesionalesCambiados ||
      materialesCambiados ||
      otrosCostosCambiados ||
      configsCambiadas ||
      itemsCalculadoraCambiados;

    if (hayCambiosCriticos) {
    }

    return hayCambiosCriticos;
  };

  // Función para marcar presupuesto como ENVIADO
  const marcarComoEnviado = async () => {
    console.log('🔍 marcarComoEnviado - Iniciando...', {
      formId: form.id,
      empresaId: empresaSeleccionada?.id,
      estadoActual: form.estado
    });

    if (!form.id || !empresaSeleccionada?.id) {
      console.warn('⚠️ No se puede marcar como ENVIADO: presupuesto sin ID o sin empresa');
      alert('⚠️ Error: No se puede marcar como ENVIADO sin ID de presupuesto o empresa');
      return;
    }

    // ✅ Solo cambiar a ENVIADO si el estado actual es A_ENVIAR
    if (form.estado !== 'A_ENVIAR') {
      console.log(`ℹ️ No se marca como ENVIADO porque el estado actual es "${form.estado}" (solo se cambia desde A_ENVIAR)`);
      return;
    }

    try {
      console.log('🌐 Llamando a actualizarEstado con:', {
        presupuestoId: form.id,
        nuevoEstado: 'ENVIADO',
        empresaId: empresaSeleccionada.id
      });

      // Actualizar solo el estado del presupuesto a ENVIADO usando el endpoint específico
      const response = await apiService.presupuestosNoCliente.actualizarEstado(form.id, 'ENVIADO', empresaSeleccionada.id);
      console.log('✅ Respuesta del servidor:', response);
      console.log('✅ Estado actualizado en BD a ENVIADO');

      // Actualizar el form local
      setForm(prev => ({ ...prev, estado: 'ENVIADO' }));
      console.log('✅ Estado local actualizado a ENVIADO');

      // Notificar al componente padre para refrescar la lista (solo si onSuccess existe)
      if (typeof onSuccess === 'function') {
        console.log('📡 Notificando al componente padre...');
        try {
          onSuccess();
        } catch (callbackError) {
          console.warn('⚠️ Error al ejecutar onSuccess callback:', callbackError);
        }
      } else {
        console.log('ℹ️ No hay callback onSuccess definido');
      }

      console.log('✅ marcarComoEnviado completado exitosamente');

    } catch (error) {
      console.error('❌ Error al marcar como ENVIADO:', error);
      console.error('❌ Detalles del error:', error.response?.data);
      console.error('❌ Stack trace:', error.stack);
      alert(`❌ Error al actualizar estado a ENVIADO: ${error.response?.data?.message || error.message}`);
    }
  };

  // Función para marcar trabajo extra como ENVIADO
  const marcarTrabajoExtraComoEnviado = async () => {
    console.log('🔍 marcarTrabajoExtraComoEnviado - Iniciando...', {
      formId: form.id,
      empresaId: empresaSeleccionada?.id,
      estadoActual: form.estado
    });

    if (!form.id || !empresaSeleccionada?.id) {
      console.warn('⚠️ No se puede marcar trabajo extra como ENVIADO: sin ID o empresa');
      alert('⚠️ Error: No se puede marcar como ENVIADO sin ID de trabajo extra o empresa');
      return;
    }

    const estadoNormalizado = String(form.estado || '').toUpperCase().replace(/\s+/g, '_');
    if (estadoNormalizado !== 'A_ENVIAR') {
      console.log(`ℹ️ Trabajo extra no pasa a ENVIADO porque estado actual es "${form.estado}" (normalizado: "${estadoNormalizado}")`);
      return;
    }

    try {
      console.log('🌐 Actualizando trabajo extra a ENVIADO...');

      // 1. Primero obtener el trabajo extra completo actual
      console.log('📥 GET trabajo extra completo...');
      const trabajoExtraActual = await apiService.trabajosExtra.getById(
        form.id,
        empresaSeleccionada.id
      );

      console.log('✅ Trabajo extra obtenido del backend:', {
        id: trabajoExtraActual.id,
        estado: trabajoExtraActual.estado,
        nombre: trabajoExtraActual.nombre,
        keys: Object.keys(trabajoExtraActual)
      });

      // 2. Actualizar solo el estado en el objeto completo
      const trabajoExtraActualizado = {
        ...trabajoExtraActual,
        estado: 'ENVIADO'
      };

      console.log('📦 Enviando trabajo extra completo con estado actualizado...', {
        endpoint: `/api/v1/trabajos-extra/${form.id}`,
        headers: { empresaId: empresaSeleccionada.id },
        estadoAnterior: trabajoExtraActual.estado,
        estadoNuevo: trabajoExtraActualizado.estado,
        payloadSize: JSON.stringify(trabajoExtraActualizado).length
      });

      // 3. Enviar PUT con el objeto completo
      const response = await apiService.trabajosExtra.update(
        form.id,
        trabajoExtraActualizado,
        empresaSeleccionada.id
      );

      console.log('✅ Respuesta del backend:', {
        status: response?.status || 'N/A',
        statusText: response?.statusText || 'N/A',
        estadoDevuelto: response?.data?.estado,
        responseKeys: response?.data ? Object.keys(response.data) : []
      });

      // 🔍 VERIFICACIÓN ADICIONAL: Hacer GET para confirmar que el estado se persistió correctamente
      console.log('🔍 Verificando que el estado se persistió correctamente...');
      const trabajoExtraVerificacion = await apiService.trabajosExtra.getById(
        form.id,
        empresaSeleccionada.id
      );

      console.log('🔍 Estado después del PUT:', {
        estadoAnterior: trabajoExtraActual.estado,
        estadoEsperado: 'ENVIADO',
        estadoActual: trabajoExtraVerificacion.estado,
        persistido: trabajoExtraVerificacion.estado === 'ENVIADO' ? '✅ SÍ' : '❌ NO'
      });

      if (trabajoExtraVerificacion.estado !== 'ENVIADO') {
        console.error('❌ EL BACKEND NO PERSISTIÓ EL CAMBIO DE ESTADO');
        alert('⚠️ Error: El backend no guardó el cambio de estado. El trabajo extra sigue en estado: ' + trabajoExtraVerificacion.estado);
        return;
      }

      setForm(prev => ({ ...prev, estado: 'ENVIADO' }));
      console.log('✅ Estado trabajo extra actualizado localmente a ENVIADO');
    } catch (error) {
      console.error('❌ Error al marcar trabajo extra como ENVIADO:', error);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error stack:', error.stack);
      alert(`❌ Error al actualizar estado del trabajo extra: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Si estamos en modo editarSoloFechas, solo validar las fechas
    if (editarSoloFechas) {
      const datosParaActualizar = {
        id: form.id,
        fechaProbableInicio: form.fechaProbableInicio,
        tiempoEstimadoTerminacion: Number(form.tiempoEstimadoTerminacion) || 0,
        calculoAutomaticoDiasHabiles: form.calculoAutomaticoDiasHabiles ?? false, // ✨ Incluir modo de cálculo, por defecto MANUAL
        _editarSoloFechas: true, // Flag para indicar que solo se actualizan fechas
        _preservarEstado: true,   // Flag para preservar el estado actual
        _preservarVersion: true   // Flag para preservar la versión actual
      };

      estaGuardandoRef.current = true; // 🚫 Evitar loops
      setSaving(true);
      try {
        await onSave(datosParaActualizar);
      } catch (error) {
        alert('Error al guardar las fechas. Revise la consola para más detalles.');
      } finally {
        setSaving(false);
        estaGuardandoRef.current = false; // ✅ Reactivar effects
      }
      return;
    }

    await sincronizarCliente();

    // ✅ UX MEJORADA: Validación flexible - calle/altura obligatorios solo si NO hay nombreObra
    const tieneNombreObra = form.nombreObra && form.nombreObra.trim() !== '';

    const nextErrors = {};
    if (!tieneNombreObra) {
      // Solo validar calle/altura si NO hay nombre de obra
      if (!form.direccionObraCalle) nextErrors.direccionObraCalle = 'La calle es obligatoria';
      if (!form.direccionObraAltura) nextErrors.direccionObraAltura = 'La altura es obligatoria';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      alert('Por favor complete los campos obligatorios: ' + Object.values(nextErrors).join(', '));
      return;
    }

    const datosCompletos = prepararDatosParaEnvio();

    // 🔍 DEBUG: Ver datos que se envían al backend
    console.log('📤 DATOS COMPLETOS A ENVIAR:');
    console.log('🔧 MAYORES COSTOS - mayoresCostosRubroImportado:', datosCompletos.mayoresCostosRubroImportado, 'tipo:', typeof datosCompletos.mayoresCostosRubroImportado);
    console.log('� HONORARIOS EN FORM:', form.honorarios);
    console.log('💰 HONORARIOS EN PAYLOAD:', {
      honorariosJornalesActivo: datosCompletos.honorariosJornalesActivo,
      honorariosJornalesTipo: datosCompletos.honorariosJornalesTipo,
      honorariosJornalesValor: datosCompletos.honorariosJornalesValor,
      honorariosMaterialesActivo: datosCompletos.honorariosMaterialesActivo,
      honorariosMaterialesTipo: datosCompletos.honorariosMaterialesTipo,
      honorariosMaterialesValor: datosCompletos.honorariosMaterialesValor,
      honorariosOtrosCostosActivo: datosCompletos.honorariosOtrosCostosActivo,
      honorariosOtrosCostosTipo: datosCompletos.honorariosOtrosCostosTipo,
      honorariosOtrosCostosValor: datosCompletos.honorariosOtrosCostosValor
    });
    console.log('�📋 ITEMS CALCULADORA EN ENVÍO:', datosCompletos.itemsCalculadora?.length || 0);
    datosCompletos.itemsCalculadora?.forEach((item, idx) => {
      console.log(`  📦 Item ${idx + 1}: ${item.descripcion}`);
      if (item.jornales && item.jornales.length > 0) {
        console.log(`    👷 Jornales (${item.jornales.length}):`);
        item.jornales.forEach((j, jIdx) => {
          console.log(`      ${jIdx + 1}. ${j.rol}:`, {
            incluir: j.incluirEnCalculoDias,
            cantidad: j.cantidad,
            valorUnitario: j.valorUnitario,
            esModoManual: j.esModoManual,
            tipoProfesional: j.tipoProfesional,
            total: j.total,
            empresaId: j.empresaId,
            presupuestoNoClienteId: j.presupuestoNoClienteId
          });
        });
      }
    });

    estaGuardandoRef.current = true; // 🚫 Evitar loops
    setSaving(true);
    console.log('📦 PAYLOAD COMPLETO JSON:', JSON.stringify(datosCompletos, null, 2));
    try {
      const resultado = await onSave(datosCompletos);

      // � Guardar configuración de valores por defecto en localStorage para futuros presupuestos
      try {
        const configAGuardar = {
          honorarios: {
            valorGeneral: datosCompletos.honorariosValorGeneral,
            tipoGeneral: datosCompletos.honorariosTipoGeneral,
            jornales: {
              activo: datosCompletos.honorariosJornalesActivo,
              tipo: datosCompletos.honorariosJornalesTipo,
              valor: datosCompletos.honorariosJornalesValor
            },
            profesionales: {
              activo: datosCompletos.honorariosProfesionalesActivo,
              tipo: datosCompletos.honorariosProfesionalesTipo,
              valor: datosCompletos.honorariosProfesionalesValor
            },
            materiales: {
              activo: datosCompletos.honorariosMaterialesActivo,
              tipo: datosCompletos.honorariosMaterialesTipo,
              valor: datosCompletos.honorariosMaterialesValor
            },
            otrosCostos: {
              activo: datosCompletos.honorariosOtrosCostosActivo,
              tipo: datosCompletos.honorariosOtrosCostosTipo,
              valor: datosCompletos.honorariosOtrosCostosValor
            },
            configuracionPresupuesto: {
              activo: datosCompletos.honorariosConfiguracionPresupuestoActivo,
              tipo: datosCompletos.honorariosConfiguracionPresupuestoTipo,
              valor: datosCompletos.honorariosConfiguracionPresupuestoValor
            }
          },
          mayoresCostos: {
            valorGeneral: datosCompletos.mayoresCostosValorGeneral,
            tipoGeneral: datosCompletos.mayoresCostosTipoGeneral,
            jornales: {
              activo: true, // Siempre forzar true
              tipo: datosCompletos.mayoresCostosJornalesTipo,
              valor: datosCompletos.mayoresCostosJornalesValor
            },
            profesionales: {
              activo: datosCompletos.mayoresCostosProfesionalesActivo,
              tipo: datosCompletos.mayoresCostosProfesionalesTipo,
              valor: datosCompletos.mayoresCostosProfesionalesValor
            },
            materiales: {
              activo: datosCompletos.mayoresCostosMaterialesActivo,
              tipo: datosCompletos.mayoresCostosMaterialesTipo,
              valor: datosCompletos.mayoresCostosMaterialesValor
            },
            otrosCostos: {
              activo: datosCompletos.mayoresCostosOtrosCostosActivo,
              tipo: datosCompletos.mayoresCostosOtrosCostosTipo,
              valor: datosCompletos.mayoresCostosOtrosCostosValor
            },
            configuracionPresupuesto: {
              activo: datosCompletos.mayoresCostosConfiguracionPresupuestoActivo,
              tipo: datosCompletos.mayoresCostosConfiguracionPresupuestoTipo,
              valor: datosCompletos.mayoresCostosConfiguracionPresupuestoValor
            },
            honorarios: {
               activo: datosCompletos.mayoresCostosHonorariosActivo,
               tipo: datosCompletos.mayoresCostosHonorariosTipo,
               valor: datosCompletos.mayoresCostosHonorariosValor
            }
          }
        };
        localStorage.setItem('ultimosValoresPresupuesto', JSON.stringify(configAGuardar));
        console.log('💾 Valores por defecto guardados para futuros presupuestos:', configAGuardar);
      } catch (err) {
        console.warn('⚠️ No se pudieron guardar los valores por defecto en localStorage:', err);
      }

      // �🔍 DEBUG: Ver qué viene del backend
      console.log('📥 RESPUESTA DEL BACKEND DESPUÉS DE GUARDAR:');
      console.log('🔍 calculoAutomaticoDiasHabiles en respuesta:', resultado?.calculoAutomaticoDiasHabiles, 'tipo:', typeof resultado?.calculoAutomaticoDiasHabiles);
      console.log('📋 Objeto completo:', resultado);
      console.log('📄 JSON completo del backend:', JSON.stringify(resultado, null, 2));
      console.log('🎯 Honorarios en respuesta:', resultado?.honorarios);
      console.log('🔑 Campos honorarios individuales en respuesta:', {
        honorariosJornalesActivo: resultado?.honorariosJornalesActivo,
        honorariosJornalesTipo: resultado?.honorariosJornalesTipo,
        honorariosJornalesValor: resultado?.honorariosJornalesValor,
        honorariosMaterialesActivo: resultado?.honorariosMaterialesActivo,
        honorariosMaterialesTipo: resultado?.honorariosMaterialesTipo,
        honorariosMaterialesValor: resultado?.honorariosMaterialesValor,
        honorariosOtrosCostosActivo: resultado?.honorariosOtrosCostosActivo,
        honorariosOtrosCostosTipo: resultado?.honorariosOtrosCostosTipo,
        honorariosOtrosCostosValor: resultado?.honorariosOtrosCostosValor
      });

// 📦 INFORMAR sobre elementos extraídos para catálogo
      if (datosCompletos.elementosParaCatalogo && datosCompletos.elementosParaCatalogo.length > 0) {
        const cantMateriales = datosCompletos.elementosParaCatalogo.filter(e => e.tipo === 'MATERIAL').length;
        const cantGastos = datosCompletos.elementosParaCatalogo.filter(e => e.tipo === 'GASTO_GENERAL').length;
        const cantJornales = datosCompletos.elementosParaCatalogo.filter(e => e.tipo === 'JORNAL').length;
        const cantProfesionales = datosCompletos.elementosParaCatalogo.filter(e => e.tipo === 'PROFESIONAL').length;

        let mensajeElementos = '✅ Presupuesto guardado exitosamente.\n\n';
        mensajeElementos += '📚 ELEMENTOS AGREGADOS AL CATÁLOGO (disponibles para reutilizar):\n\n';

        if (cantMateriales > 0) {
          mensajeElementos += `   📦 ${cantMateriales} Material(es) individual(es)\n`;
        }
        if (cantGastos > 0) {
          mensajeElementos += `   💰 ${cantGastos} Gasto(s) general(es)\n`;
        }
        if (cantJornales > 0) {
          mensajeElementos += `   👷 ${cantJornales} Jornal(es)\n`;
        }
        if (cantProfesionales > 0) {
          mensajeElementos += `   👨‍💼 ${cantProfesionales} Profesional(es)\n`;
        }

        mensajeElementos += '\n💡 Cada elemento está guardado con cantidad 1 y su precio unitario.';
        mensajeElementos += '\n   Ya están disponibles en el catálogo para usarlos en futuros presupuestos.';

        console.log(mensajeElementos);
        // Opcional: mostrar alerta al usuario
        // alert(mensajeElementos);
      }

    } catch (error) {
      console.error('❌ ERROR AL GUARDAR:', error);
      console.error('❌ ERROR RESPONSE:', error.response?.data);
      const mensajeError = error.response?.data?.message || error.response?.data || error.message || 'Error desconocido';
      alert(`Error al guardar el presupuesto:\n\n${mensajeError}\n\nRevise la consola para más detalles.`);
    } finally {
      setSaving(false);
      estaGuardandoRef.current = false; // ✅ Reactivar effects
    }
  };

  const prepararDatosParaEnvio = () => {
    const payload = { ...form, idEmpresa: form.idEmpresa || empresaSeleccionada?.id || null };

    // ✅ Normalizar tiempoEstimadoTerminacion según modo (manual/automático)
    if (form.calculoAutomaticoDiasHabiles === true) {
      const { total } = calcularDiasHabilesAutomatico();
      payload.tiempoEstimadoTerminacion = total || 0;
    } else {
      payload.tiempoEstimadoTerminacion = Number(form.tiempoEstimadoTerminacion) || 0;
    }

    // 🔍 DEBUG: Verificar fechaProbableInicio antes de procesar
    console.log('🔍 PREPARAR DATOS - fechaProbableInicio en form:', form.fechaProbableInicio);
    console.log('🔍 PREPARAR DATOS - fechaProbableInicio en payload inicial:', payload.fechaProbableInicio);

    // ✨ NUEVO: Incluir idCliente si existe (para vinculación con cliente)
    if (form.clienteId) {
      // Extraer solo el ID numérico si es un objeto, o usar directamente si es número
      const clienteIdNumerico = typeof form.clienteId === 'object' && form.clienteId !== null
        ? (form.clienteId.id ? parseInt(form.clienteId.id, 10) : null)
        : (typeof form.clienteId === 'string' ? parseInt(form.clienteId, 10) : form.clienteId);

      console.log('✅ idCliente incluido en payload:', clienteIdNumerico, 'tipo:', typeof clienteIdNumerico);
      payload.idCliente = clienteIdNumerico;
      payload.clienteId = clienteIdNumerico; // ✅ Incluir ambos formatos para compatibilidad
    }

    // ✅ INCLUIR idObra si existe (para vincular presupuesto con obra)
    if (form.obraId) {
      // Extraer solo el ID numérico si es un objeto, o usar directamente si es número
      const obraIdNumerico = typeof form.obraId === 'object' && form.obraId !== null
        ? (form.obraId.id ? parseInt(form.obraId.id, 10) : null)
        : (typeof form.obraId === 'string' ? parseInt(form.obraId, 10) : form.obraId);

      console.log('✅ idObra incluido en payload:', obraIdNumerico, 'tipo:', typeof obraIdNumerico);
      payload.idObra = obraIdNumerico;
      payload.obraId = obraIdNumerico; // ✅ Incluir ambos formatos para compatibilidad
    } else {
      console.log('ℹ️ idObra NO presente en form - se creará obra nueva al aprobar');
    }

    payload.direccionObraBarrio = payload.direccionObraBarrio || '';
    payload.direccionObraTorre = payload.direccionObraTorre || '';
    payload.direccionObraCalle = payload.direccionObraCalle || '';
    payload.direccionObraAltura = payload.direccionObraAltura || '';
    payload.direccionObraPiso = payload.direccionObraPiso || '';
    payload.direccionObraDepartamento = payload.direccionObraDepartamento || '';
    payload.direccionObraLocalidad = payload.direccionObraLocalidad || '';
    payload.direccionObraProvincia = payload.direccionObraProvincia || '';
    payload.direccionObraCodigoPostal = payload.direccionObraCodigoPostal || '';

    // SIEMPRE mapear nombreObraManual a nombreObra (el backend lo requiere)
    // Si el usuario lo completó, usar ese valor
    // Si está vacío, generar automáticamente desde la dirección
    if (form.nombreObraManual && form.nombreObraManual.trim() !== '') {
      payload.nombreObra = form.nombreObraManual.trim();
      console.log('✅ nombreObra asignado desde nombreObraManual:', payload.nombreObra);
    } else {
      // Generar nombre automáticamente desde la dirección
      const partes = [];
      if (payload.direccionObraBarrio) partes.push(`(${payload.direccionObraBarrio})`);
      if (payload.direccionObraCalle) partes.push(payload.direccionObraCalle);
      if (payload.direccionObraAltura) partes.push(payload.direccionObraAltura);
      if (payload.direccionObraTorre) partes.push(`Torre ${payload.direccionObraTorre}`);
      if (payload.direccionObraPiso) partes.push(`Piso ${payload.direccionObraPiso}`);
      if (payload.direccionObraDepartamento) partes.push(`Depto ${payload.direccionObraDepartamento}`);

      payload.nombreObra = partes.join(' ').trim() || 'Obra sin nombre';
      console.log('✅ nombreObra generado automáticamente:', payload.nombreObra);
    }

    payload.profesionales = payload.profesionales.map(p => {
      return {
        tipoProfesional: p.tipoProfesional || '',
        nombreProfesional: p.nombreProfesional || null,
        telefonoProfesional: p.telefonoProfesional || null,
        tipoUnidad: p.tipoUnidad || 'jornales',
        cantidadJornales: p.cantidadJornales === '' || p.cantidadJornales == null ? null : Number(p.cantidadJornales),
        unidadActiva: 'horas',
        cantidad: p.cantidadHoras === '' || p.cantidadHoras == null ? null : Number(p.cantidadHoras),
        importePorUnidad: p.importeXHora === '' || p.importeXHora == null ? null : Number(p.importeXHora),
        importeXHora: p.importeXHora === '' || p.importeXHora == null ? null : Number(p.importeXHora),
        importeXDia: null,
        importeXSemana: null,
        importeXMes: null,
        importeXObra: null,
        cantidadHoras: p.cantidadHoras === '' || p.cantidadHoras == null ? null : Number(p.cantidadHoras),
        cantidadDias: null,
        cantidadSemanas: null,
        cantidadMeses: null,
        importeCalculado: p.importeCalculado ? Number(p.importeCalculado) : null
      };
    });


    payload.materialesList = payload.materiales.map(m => ({
      tipoMaterial: m.tipoMaterial || '',
      nombre: m.nombre || m.tipoMaterial || 'Material sin nombre', // ✅ CRÍTICO: campo obligatorio en BD
      cantidad: Number(m.cantidad) || 0,
      precioUnitario: Number(m.precioUnitario) || 0,
      unidad: m.unidad || m.unidadMedida || 'unidad' // ✅ CRÍTICO: campo obligatorio en BD
    }));
    delete payload.materiales; // Eliminar el campo antiguo


    if (payload.honorarioDireccionValorFijo === '' || payload.honorarioDireccionValorFijo == null) {
      payload.honorarioDireccionValorFijo = null;
    } else {
      payload.honorarioDireccionValorFijo = Number(payload.honorarioDireccionValorFijo);
    }
    if (payload.honorarioDireccionPorcentaje === '' || payload.honorarioDireccionPorcentaje == null) {
      payload.honorarioDireccionPorcentaje = null;
    } else {
      payload.honorarioDireccionPorcentaje = Number(payload.honorarioDireccionPorcentaje);
    }

    if (payload.tiempoEstimadoTerminacion === '' || payload.tiempoEstimadoTerminacion == null) {
      payload.tiempoEstimadoTerminacion = null;
    } else {
      payload.tiempoEstimadoTerminacion = parseInt(payload.tiempoEstimadoTerminacion, 10);
      if (Number.isNaN(payload.tiempoEstimadoTerminacion)) payload.tiempoEstimadoTerminacion = null;
    }

    // ✅ CORREGIDO: Solo convertir a null si es undefined, no si es string vacío
    ['fechaProbableInicio', 'vencimiento', 'fechaCreacion', 'fechaEmision'].forEach(f => {
      if (payload[f] === undefined || payload[f] === null) {
        payload[f] = null;
      }
      // Si es string vacío '', mantenerlo (el backend lo manejará)
    });

    // 🔍 DEBUG: Verificar fechaProbableInicio después de procesamiento de fechas
    console.log('🔍 DESPUÉS DE PROCESAR FECHAS - fechaProbableInicio:', payload.fechaProbableInicio);

    // Normalizar estado a enum válido del backend
    if (payload.estado === '' || payload.estado === 'A enviar' || payload.estado === 'a enviar') {
      payload.estado = 'ENVIADO'; // Convertir "A enviar" al enum correcto
    }
    if (!payload.estado) {
      payload.estado = 'BORRADOR'; // Estado por defecto si está vacío
    }

    // Asegurar que TRABAJOS_SEMANALES siempre tenga estado OBRA_A_CONFIRMAR (si no está aprobado)
    if (payload.tipoPresupuesto === 'TRABAJOS_SEMANALES' && payload.estado !== 'APROBADO') {
      payload.estado = 'OBRA_A_CONFIRMAR';
    }

    if (payload.version === '' || payload.version == null) {
      payload.version = 1;
    } else {
      payload.version = parseInt(payload.version, 10);
      if (Number.isNaN(payload.version) || payload.version < 1) payload.version = 1;
    }

    payload.tipoProfesionalPresupuesto = valoresPresupuesto.tipoProfesional || null;
    payload.modoPresupuesto = valoresPresupuesto.modoSeleccionado || null;
    payload.importeHora = valoresPresupuesto.importeHora ? Number(valoresPresupuesto.importeHora) : null;
    payload.importeDia = valoresPresupuesto.importeDia ? Number(valoresPresupuesto.importeDia) : null;
    payload.importeSemana = valoresPresupuesto.importeSemana ? Number(valoresPresupuesto.importeSemana) : null;
    payload.importeMes = valoresPresupuesto.importeMes ? Number(valoresPresupuesto.importeMes) : null;
    payload.cantidadHoras = valoresPresupuesto.cantidadHoras ? Number(valoresPresupuesto.cantidadHoras) : null;
    payload.cantidadDias = valoresPresupuesto.cantidadDias ? Number(valoresPresupuesto.cantidadDias) : null;
    payload.cantidadSemanas = valoresPresupuesto.cantidadSemanas ? Number(valoresPresupuesto.cantidadSemanas) : null;
    payload.cantidadMeses = valoresPresupuesto.cantidadMeses ? Number(valoresPresupuesto.cantidadMeses) : null;

    payload.configuracionesProfesionales = configsProfesionales.length > 0
      ? configsProfesionales.map(config => {
          let subtotal = config.subtotal;
          if (!subtotal) {
            const modo = config.modoSeleccionado || 'hora';
            const importe = modo === 'hora' ? config.importeHora :
                           modo === 'dia' ? config.importeDia :
                           modo === 'semana' ? config.importeSemana :
                           config.importeMes;
            const cantidad = modo === 'hora' ? config.cantidadHoras :
                            modo === 'dia' ? config.cantidadDias :
                            modo === 'semana' ? config.cantidadSemanas :
                            config.cantidadMeses;
            subtotal = (Number(importe) || 0) * (Number(cantidad) || 0);
          }

          return {
            tipoProfesional: config.tipoProfesional || '',
            importeHora: config.importeHora ? Number(config.importeHora) : null,
            importeDia: config.importeDia ? Number(config.importeDia) : null,
            importeSemana: config.importeSemana ? Number(config.importeSemana) : null,
            importeMes: config.importeMes ? Number(config.importeMes) : null,
            cantidadHoras: config.cantidadHoras ? Number(config.cantidadHoras) : null,
            cantidadDias: config.cantidadDias ? Number(config.cantidadDias) : null,
            cantidadSemanas: config.cantidadSemanas ? Number(config.cantidadSemanas) : null,
            cantidadMeses: config.cantidadMeses ? Number(config.cantidadMeses) : null,
            subtotal: Number(subtotal) || 0
          };
        })
      : [];

    payload.configuracionesMateriales = configsMateriales.length > 0
      ? configsMateriales.map(config => {
          const subtotal = config.subtotal ||
                          ((Number(config.cantidad) || 0) * (Number(config.presupuestoTotal) || 0));

          return {
            nombreMaterial: config.tipoMaterial || '',
            categoria: config.categoria || '',
            cantidad: config.cantidad ? Number(config.cantidad) : 0,
            unidadMedida: config.unidadMedida || '',
            precioUnitario: config.presupuestoTotal ? Number(config.presupuestoTotal) : 0,
            subtotal: Number(subtotal) || 0
          };
        })
      : [];

    payload.configuracionesOtros = configsOtros.length > 0
      ? configsOtros.map(config => ({
          descripcion: config.descripcion || '',
          categoria: config.categoria || '',
          importe: config.presupuestoTotal ? Number(config.presupuestoTotal) : 0
        }))
      : [];


    if (payload.configuracionesProfesionales.length > 0) {
    }

    if (payload.configuracionesMateriales.length > 0) {
    }

    if (payload.configuracionesOtros.length > 0) {
    }

    // ❌ DESHABILITADO: La detección de cambios críticos se maneja en la página principal
    // No necesitamos detectar cambios críticos aquí porque la lógica de versionado
    // está en PresupuestosNoClientePage basada en el estado del presupuesto
    payload._shouldCreateNewVersion = false;
    payload._preservarEstado = false;

    const totalPresupuestoProfesionales = payload.configuracionesProfesionales.reduce((sum, c) => sum + (Number(c.subtotal) || 0), 0);
    const totalPresupuestoMateriales = payload.configuracionesMateriales.reduce((sum, c) => sum + (Number(c.subtotal) || 0), 0);
    const totalPresupuestoOtros = payload.configuracionesOtros.reduce((sum, c) => sum + (Number(c.importe) || 0), 0);

    let totalHonorarios = 0;
    let honorariosDesglosados = null;

    if (form.honorarios) {
      honorariosDesglosados = calcularHonorarios();
      totalHonorarios = honorariosDesglosados.total;

    } else {
      const totalGastos = payload.montoTotal || 0;

      if (payload.honorarioDireccionValorFijo && Number(payload.honorarioDireccionValorFijo) > 0) {
        totalHonorarios = Number(payload.honorarioDireccionValorFijo);
      } else if (payload.honorarioDireccionPorcentaje && Number(payload.honorarioDireccionPorcentaje) > 0) {
        totalHonorarios = (totalGastos * Number(payload.honorarioDireccionPorcentaje)) / 100;
      }

    }


    const totalProfItemsBase = form.profesionales.reduce((sum, p) => {
      if (p.importeCalculado) return sum + Number(p.importeCalculado);
      const cantJornales = Number(p.cantidadJornales) || 0;
      return sum + ((Number(p.cantidadHoras) || 0) * (cantJornales > 0 ? cantJornales : 1) * (Number(p.importeXHora) || 0));
    }, 0);
    const totalMatItemsBase = form.materiales.reduce((sum, m) => sum + ((Number(m.cantidad) || 0) * (Number(m.precioUnitario) || 0)), 0);
    const totalOtrosItemsBase = form.otrosCostos.reduce((sum, oc) => sum + (Number(oc.importe) || 0), 0);

    const totalCalculadoraBase = itemsCalculadora.reduce((sum, item) => sum + (Number(item.total) || 0), 0);

    const totalManoObraCalculadora = itemsCalculadora.reduce((sum, item) => {
      if (item.esModoManual) return sum;
      return sum + (Number(item.subtotalManoObra) || 0);
    }, 0);
    const totalMaterialesCalculadora = itemsCalculadora.reduce((sum, item) => {
      if (item.esModoManual) return sum;
      return sum + (Number(item.subtotalMateriales) || 0);
    }, 0);

    const totalOtrosCalculadora = itemsCalculadora.reduce((sum, item) => {
      const esGastoGeneral = item.esGastoGeneral === true ||
                            (item.tipoProfesional?.toLowerCase().includes('gasto') &&
                             item.tipoProfesional?.toLowerCase().includes('general'));
      if (esGastoGeneral) {
        return sum + (Number(item.total) || 0);
      }

      if (item.subtotalGastosGenerales && item.subtotalGastosGenerales > 0) {
        return sum + (Number(item.subtotalGastosGenerales) || 0);
      }

      return sum;
    }, 0);

    const totalManualesCalculadora = itemsCalculadora.reduce((sum, item) => {
      const esManual = item.esModoManual || item.totalManual ||
                      (item.total && !item.subtotalManoObra && !item.subtotalMateriales && !item.esGastoGeneral);
      if (esManual) {
        return sum + (Number(item.totalManual) || Number(item.total) || 0);
      }
      return sum;
    }, 0);

    const totalGlobalProf = totalProfItemsBase + totalManoObraCalculadora;
    const totalGlobalMat = totalMatItemsBase + totalMaterialesCalculadora;
    const totalGlobalOtros = totalOtrosItemsBase + totalOtrosCalculadora;
    const totalGlobalManuales = totalManualesCalculadora;

    const totalBase = totalGlobalProf + totalGlobalMat + totalGlobalOtros + totalGlobalManuales;

    const totalMayoresCostos = itemsCalculadoraConsolidados?.reduce((sum, item) => {
      return sum + (item.mayoresCostosAplicados || 0);
    }, 0) || 0;

    payload.totalPresupuesto = totalBase;
    payload.totalHonorarios = totalHonorarios;
    payload.totalMayoresCostos = totalMayoresCostos;
    payload.totalMateriales = totalGlobalMat; // ← Total de materiales
    payload.honorarioDireccionImporte = totalHonorarios; // ← Guardar el importe calculado
    payload.totalPresupuestoConHonorarios = totalBase + totalHonorarios + totalMayoresCostos;

    payload.honorariosDesglosados = honorariosDesglosados;


    payload.empresaNombre = payload.nombreEmpresa || empresaSeleccionada?.nombreEmpresa || 'Sin empresa';

    // 🆕 PERSISTENCIA DE MODOS DE CARGA (para mantener UI al reabrir)
    payload.modoCargaJornales = modoCargaJornales;
    payload.modoCargaMateriales = modoCargaMateriales;
    payload.modoCargaGastos = modoCargaGastos;

    if (form.honorarios) {
      const honorariosConfig = form.honorarios;


      payload.honorariosAplicarATodos = honorariosConfig.aplicarATodos ?? null;
      payload.honorariosValorGeneral = honorariosConfig.valorGeneral && honorariosConfig.valorGeneral !== '' ? Number(honorariosConfig.valorGeneral) : null;
      payload.honorariosTipoGeneral = honorariosConfig.tipoGeneral || null;

      // JORNALES
      payload.honorariosJornalesActivo = honorariosConfig.jornales?.activo ?? null;
      payload.honorariosJornalesTipo = honorariosConfig.jornales?.tipo || null;
      payload.honorariosJornalesValor = (honorariosConfig.jornales?.valor !== null && honorariosConfig.jornales?.valor !== undefined && honorariosConfig.jornales?.valor !== '')
        ? Number(honorariosConfig.jornales.valor)
        : null;

      // PROFESIONALES
      payload.honorariosProfesionalesActivo = honorariosConfig.profesionales?.activo ?? null;
      payload.honorariosProfesionalesTipo = honorariosConfig.profesionales?.tipo || null;
      payload.honorariosProfesionalesValor = honorariosConfig.profesionales?.valor && honorariosConfig.profesionales.valor !== '' ? Number(honorariosConfig.profesionales.valor) : null;

      // MATERIALES
      payload.honorariosMaterialesActivo = honorariosConfig.materiales?.activo ?? null;
      payload.honorariosMaterialesTipo = honorariosConfig.materiales?.tipo || null;
      payload.honorariosMaterialesValor = honorariosConfig.materiales?.valor && honorariosConfig.materiales.valor !== '' ? Number(honorariosConfig.materiales.valor) : null;

      // OTROS COSTOS
      payload.honorariosOtrosCostosActivo = honorariosConfig.otrosCostos?.activo ?? null;
      payload.honorariosOtrosCostosTipo = honorariosConfig.otrosCostos?.tipo || null;
      payload.honorariosOtrosCostosValor = honorariosConfig.otrosCostos?.valor && honorariosConfig.otrosCostos.valor !== '' ? Number(honorariosConfig.otrosCostos.valor) : null;

      // CONFIGURACIÓN PRESUPUESTO
      payload.honorariosConfiguracionPresupuestoActivo = honorariosConfig.configuracionPresupuesto?.activo ?? null;
      payload.honorariosConfiguracionPresupuestoTipo = honorariosConfig.configuracionPresupuesto?.tipo || null;
      payload.honorariosConfiguracionPresupuestoValor = honorariosConfig.configuracionPresupuesto?.valor && honorariosConfig.configuracionPresupuesto.valor !== '' ? Number(honorariosConfig.configuracionPresupuesto.valor) : null;
    } else {
      payload.honorariosAplicarATodos = null;
      payload.honorariosValorGeneral = null;
      payload.honorariosTipoGeneral = null;
      payload.honorariosJornalesActivo = null;
      payload.honorariosJornalesTipo = null;
      payload.honorariosJornalesValor = null;
      payload.honorariosProfesionalesActivo = null;
      payload.honorariosProfesionalesTipo = null;
      payload.honorariosProfesionalesValor = null;
      payload.honorariosMaterialesActivo = null;
      payload.honorariosMaterialesTipo = null;
      payload.honorariosMaterialesValor = null;
      payload.honorariosOtrosCostosActivo = null;
      payload.honorariosOtrosCostosTipo = null;
      payload.honorariosOtrosCostosValor = null;
      payload.honorariosConfiguracionPresupuestoActivo = null;
      payload.honorariosConfiguracionPresupuestoTipo = null;
      payload.honorariosConfiguracionPresupuestoValor = null;
    }

    if (form.mayoresCostos) {
      const mayoresCostosConfig = form.mayoresCostos;

      console.log('⚠️ MAYORES COSTOS CONFIG:', mayoresCostosConfig);
      console.log('⚠️ rubroImportado:', mayoresCostosConfig.rubroImportado, 'tipo:', typeof mayoresCostosConfig.rubroImportado);

      payload.mayoresCostosAplicarValorGeneral = mayoresCostosConfig.aplicarValorGeneral ?? null;
      payload.mayoresCostosValorGeneral = mayoresCostosConfig.valorGeneral && mayoresCostosConfig.valorGeneral !== '' ? Number(mayoresCostosConfig.valorGeneral) : null;
      payload.mayoresCostosTipoGeneral = mayoresCostosConfig.tipoGeneral || null;
      payload.mayoresCostosGeneralImportado = mayoresCostosConfig.generalImportado ?? null;
      // ✅ Convertir boolean a string para el backend
      payload.mayoresCostosRubroImportado = mayoresCostosConfig.rubroImportado != null ? String(mayoresCostosConfig.rubroImportado) : null;
      console.log('🔍 DEBUG mayoresCostosRubroImportado:', {
        original: mayoresCostosConfig.rubroImportado,
        tipo_original: typeof mayoresCostosConfig.rubroImportado,
        convertido: payload.mayoresCostosRubroImportado,
        tipo_convertido: typeof payload.mayoresCostosRubroImportado
      });
      payload.mayoresCostosNombreRubroImportado = mayoresCostosConfig.nombreRubroImportado || null;
      payload.mayoresCostosExplicacion = mayoresCostosConfig.explicacion || null;

      // JORNALES
      payload.mayoresCostosJornalesActivo = mayoresCostosConfig.jornales?.activo ?? true;
      payload.mayoresCostosJornalesTipo = mayoresCostosConfig.jornales?.tipo || null;
      payload.mayoresCostosJornalesValor = (mayoresCostosConfig.jornales?.valor !== null && mayoresCostosConfig.jornales?.valor !== undefined && mayoresCostosConfig.jornales?.valor !== '')
        ? Number(mayoresCostosConfig.jornales.valor)
        : null;

      // PROFESIONALES
      payload.mayoresCostosProfesionalesActivo = mayoresCostosConfig.profesionales?.activo ?? null;
      payload.mayoresCostosProfesionalesTipo = mayoresCostosConfig.profesionales?.tipo || null;
      payload.mayoresCostosProfesionalesValor = mayoresCostosConfig.profesionales?.valor && mayoresCostosConfig.profesionales.valor !== '' ? Number(mayoresCostosConfig.profesionales.valor) : null;

      // MATERIALES
      payload.mayoresCostosMaterialesActivo = mayoresCostosConfig.materiales?.activo ?? null;
      payload.mayoresCostosMaterialesTipo = mayoresCostosConfig.materiales?.tipo || null;
      payload.mayoresCostosMaterialesValor = mayoresCostosConfig.materiales?.valor && mayoresCostosConfig.materiales.valor !== '' ? Number(mayoresCostosConfig.materiales.valor) : null;

      // OTROS COSTOS
      payload.mayoresCostosOtrosCostosActivo = mayoresCostosConfig.otrosCostos?.activo ?? null;
      payload.mayoresCostosOtrosCostosTipo = mayoresCostosConfig.otrosCostos?.tipo || null;
      payload.mayoresCostosOtrosCostosValor = mayoresCostosConfig.otrosCostos?.valor && mayoresCostosConfig.otrosCostos.valor !== '' ? Number(mayoresCostosConfig.otrosCostos.valor) : null;

      // CONFIGURACIÓN PRESUPUESTO
      payload.mayoresCostosConfiguracionPresupuestoActivo = mayoresCostosConfig.configuracionPresupuesto?.activo ?? null;
      payload.mayoresCostosConfiguracionPresupuestoTipo = mayoresCostosConfig.configuracionPresupuesto?.tipo || null;
      payload.mayoresCostosConfiguracionPresupuestoValor = mayoresCostosConfig.configuracionPresupuesto?.valor && mayoresCostosConfig.configuracionPresupuesto.valor !== '' ? Number(mayoresCostosConfig.configuracionPresupuesto.valor) : null;

      // HONORARIOS
      payload.mayoresCostosHonorariosActivo = mayoresCostosConfig.honorarios?.activo ?? null;
      payload.mayoresCostosHonorariosTipo = mayoresCostosConfig.honorarios?.tipo || null;
      payload.mayoresCostosHonorariosValor = mayoresCostosConfig.honorarios?.valor && mayoresCostosConfig.honorarios.valor !== '' ? Number(mayoresCostosConfig.honorarios.valor) : null;
    } else {
      payload.mayoresCostosAplicarValorGeneral = null;
      payload.mayoresCostosValorGeneral = null;
      payload.mayoresCostosTipoGeneral = null;
      payload.mayoresCostosGeneralImportado = null;
      payload.mayoresCostosRubroImportado = null;
      payload.mayoresCostosNombreRubroImportado = null;
      payload.mayoresCostosExplicacion = null;
      payload.mayoresCostosJornalesActivo = null;
      payload.mayoresCostosJornalesTipo = null;
      payload.mayoresCostosJornalesValor = null;
      payload.mayoresCostosProfesionalesActivo = null;
      payload.mayoresCostosProfesionalesTipo = null;
      payload.mayoresCostosProfesionalesValor = null;
      payload.mayoresCostosMaterialesActivo = null;
      payload.mayoresCostosMaterialesTipo = null;
      payload.mayoresCostosMaterialesValor = null;
      payload.mayoresCostosOtrosCostosActivo = null;
      payload.mayoresCostosOtrosCostosTipo = null;
      payload.mayoresCostosOtrosCostosValor = null;
      payload.mayoresCostosConfiguracionPresupuestoActivo = null;
      payload.mayoresCostosConfiguracionPresupuestoTipo = null;
      payload.mayoresCostosConfiguracionPresupuestoValor = null;
      payload.mayoresCostosHonorariosActivo = null;
      payload.mayoresCostosHonorariosTipo = null;
      payload.mayoresCostosHonorariosValor = null;
    }

    // ========================================
    // JORNALES - CONVERSIÓN AL FORMATO BACKEND
    // ========================================
    // ⚠️ CRÍTICO: En trabajos extra, los jornales SIEMPRE van dentro de itemsCalculadora
    // NO consolidar en payload.jornales porque causaría duplicación (error 409)

    // ✅ Para TRABAJOS EXTRA: NO enviar payload.jornales (ya están en itemsCalculadora)
    // ✅ Para PRESUPUESTOS: Consolidar jornales en payload.jornales si NO están en itemsCalculadora

    const esTrabajoExtra = modoTrabajoExtra === true; // Detectar si estamos en modo trabajo extra
    let jornalesConsolidados = [];

    if (!esTrabajoExtra) {
      // SOLO para presupuestos normales: consolidar jornales

      // 1. Jornales directos del form (si existen)
      if (form.jornales && form.jornales.length > 0) {
        console.warn('⚠️ form.jornales tiene', form.jornales.length, 'jornales - IGNORANDO porque ya están en itemsCalculadora');
        // NO agregamos: jornalesConsolidados = [...form.jornales];
      }

      // 2. Jornales dentro de itemsCalculadora (USAR ESTADO REAL, NO CONSOLIDADO)
      if (itemsCalculadora && itemsCalculadora.length > 0) {
        console.log('📦 Procesando itemsCalculadora:', itemsCalculadora.length, 'items');
        itemsCalculadora.forEach((item, idx) => {
          if (item.jornales && item.jornales.length > 0) {
            console.log(`  Item ${idx + 1} (${item.tipoProfesional}): ${item.jornales.length} jornales`);
            // ✅ FILTRAR duplicados por ID antes de agregar
            const jornalesUnicos = item.jornales.filter(jornal => {
              // Verificar si ya existe un jornal con este ID
              const yaExiste = jornalesConsolidados.some(j => j.id === jornal.id);
              if (yaExiste) {
                console.warn('⚠️ Jornal duplicado detectado - NO se agregará:', jornal.id, jornal.rol);
                return false;
              }
              return true;
            });
            console.log(`    → Jornales únicos agregados: ${jornalesUnicos.length}`);
            jornalesConsolidados.push(...jornalesUnicos);
          }
        });
      }

      console.log('📊 TOTAL jornales consolidados (sin duplicados):', jornalesConsolidados.length);
    } else {
      console.log('🚫 TRABAJO EXTRA detectado - NO consolidar jornales (ya están en itemsCalculadora)');
    }

    // Mapear al formato que espera el backend
    if (jornalesConsolidados.length > 0 && !esTrabajoExtra) {
      console.log('🔍 JORNALES CONSOLIDADOS ANTES DE MAPEAR:', jornalesConsolidados.length);
      jornalesConsolidados.forEach((j, idx) => {
        console.log(`  Jornal ${idx + 1}:`, {
          id: j.id,
          rol: j.rol,
          cantidad: j.cantidadJornales || j.cantidad,
          valorUnitario: j.importeJornal || j.valorUnitario,
          empresaId: j.empresaId,
          presupuestoNoClienteId: j.presupuestoNoClienteId
        });
      });

      // ✅ FILTRAR jornales con datos inválidos antes de mapear
      const jornalesValidos = jornalesConsolidados.filter(jornal => {
        const tieneRol = jornal.rol && jornal.rol.trim() !== '';
        const tieneCantidad = (jornal.cantidadJornales || jornal.cantidad) != null;
        const tieneValor = (jornal.importeJornal || jornal.valorUnitario) != null;

        if (!tieneRol || !tieneCantidad || !tieneValor) {
          console.warn('⚠️ JORNAL CON DATOS INVÁLIDOS - NO SE ENVIARÁ:', {
            id: jornal.id,
            rol: jornal.rol,
            cantidad: jornal.cantidadJornales || jornal.cantidad,
            valor: jornal.importeJornal || jornal.valorUnitario,
            razon: !tieneRol ? 'Sin rol' : !tieneCantidad ? 'Sin cantidad' : 'Sin valor'
          });
          return false;
        }
        return true;
      });

      console.log(`✅ Jornales válidos: ${jornalesValidos.length} de ${jornalesConsolidados.length}`);

      payload.jornales = jornalesValidos.map(jornal => {
        // IDs de DB son números pequeños < 1000000
        // IDs temporales son timestamps > 1000000000000
        const esIdDeBaseDeDatos = jornal.id && jornal.id < 1000000;

        const jornalMapeado = {
          id: esIdDeBaseDeDatos ? jornal.id : null,
          rol: jornal.rol || '',
          cantidad: Number(jornal.cantidadJornales || jornal.cantidad) || 0,
          valorUnitario: Number(jornal.importeJornal || jornal.valorUnitario) || 0,
          subtotal: Number(jornal.subtotal) || (Number(jornal.cantidadJornales || jornal.cantidad) * Number(jornal.importeJornal || jornal.valorUnitario)),
          observaciones: jornal.observaciones || null,
          // ✅ PRESERVAR CAMPOS OBLIGATORIOS PARA BACKEND
          incluirEnCalculoDias: jornal.incluirEnCalculoDias ?? true,
          esModoManual: jornal.esModoManual ?? false,
          tipoProfesional: jornal.tipoProfesional || jornal.rol || '',
          empresaId: jornal.empresaId || Number(empresaSeleccionada?.id || 3),
          presupuestoNoClienteId: jornal.presupuestoNoClienteId || form.id || null
        };

        console.log('  ✅ Jornal mapeado:', jornalMapeado);
        return jornalMapeado;
      });
    } else if (esTrabajoExtra) {
      console.log('🚫 TRABAJO EXTRA - payload.jornales = [] (jornales están en itemsCalculadora)');
      payload.jornales = []; // ✅ CRÍTICO: Vacío para trabajos extra
    } else {
      console.log('ℹ️ NO hay jornales consolidados');
      payload.jornales = [];
    }

    // HONORARIOS DE JORNALES
    if (form.honorarios?.jornales) {
      const configJornales = form.honorarios.jornales;

      // Guardar configuración en localStorage SIEMPRE (para ambos modos: todos y porRol)
      if (form.id) {
        const localStorageKey = `presupuesto_${form.id}_honorarios_jornales`;
        try {
          localStorage.setItem(localStorageKey, JSON.stringify(configJornales));
          console.log('💾 Guardando en localStorage:', localStorageKey, configJornales);
        } catch (e) {
          console.error('❌ Error guardando en localStorage:', e);
        }
      }

      // Si el modo es "porRol", calcular el total y enviarlo como "fijo"
      if (configJornales.modoAplicacion === 'porRol' && configJornales.porRol) {
        let totalHonorariosJornales = 0;

        // Calcular honorarios por cada jornal según su rol
        (form.jornales || []).forEach(jornal => {
          const configRol = configJornales.porRol[jornal.rol];
          if (configRol) {
            const subtotalJornal = Number(jornal.subtotal) || (Number(jornal.cantidad) * Number(jornal.valorUnitario));

            if (configRol.tipo === 'porcentaje') {
              totalHonorariosJornales += (subtotalJornal * Number(configRol.valor)) / 100;
            } else { // monto fijo
              totalHonorariosJornales += Number(configRol.valor);
            }
          }
        });

        // Enviar como "monto_fijo" con el total calculado
        payload.honorariosJornalesActivo = configJornales.activo ?? false;
        payload.honorariosJornalesTipo = 'monto_fijo';
        payload.honorariosJornalesValor = totalHonorariosJornales;
      } else {
        // Modo "todos" - enviar tal cual
        payload.honorariosJornalesActivo = configJornales.activo ?? false;
        payload.honorariosJornalesTipo = configJornales.tipo === 'porcentaje' ? 'porcentaje' : 'monto_fijo';
        payload.honorariosJornalesValor = configJornales.valor && configJornales.valor !== '' ? Number(configJornales.valor) : 0;
      }
    } else {
      payload.honorariosJornalesActivo = false;
      payload.honorariosJornalesTipo = null;
      payload.honorariosJornalesValor = null;
    }

    // MAYORES COSTOS DE JORNALES
    if (form.mayoresCostos?.jornales) {
      const configJornales = form.mayoresCostos.jornales;

      // Guardar configuración en localStorage si es modo porRol
      if (form.id && configJornales.modoAplicacion === 'porRol' && configJornales.porRol) {
        const localStorageKey = `presupuesto_${form.id}_mayoresCostos_jornales`;
        try {
          localStorage.setItem(localStorageKey, JSON.stringify(configJornales));
        } catch (e) {
          // Error guardando en localStorage
        }
      }

      // Si el modo es "porRol", calcular el total y enviarlo como "fijo"
      if (configJornales.modoAplicacion === 'porRol' && configJornales.porRol) {
        let totalMayoresCostosJornales = 0;

        // Primero calcular honorarios de cada jornal
        (form.jornales || []).forEach(jornal => {
          const subtotalJornal = Number(jornal.subtotal) || (Number(jornal.cantidad) * Number(jornal.valorUnitario));

          // Calcular honorario de este jornal
          let honorarioJornal = 0;
          if (form.honorarios?.jornales?.activo) {
            const honorariosConfig = form.honorarios.jornales;
            if (honorariosConfig.modoAplicacion === 'porRol' && honorariosConfig.porRol?.[jornal.rol]) {
              const configRolHon = honorariosConfig.porRol[jornal.rol];
              if (configRolHon.tipo === 'porcentaje') {
                honorarioJornal = (subtotalJornal * Number(configRolHon.valor)) / 100;
              } else {
                honorarioJornal = Number(configRolHon.valor);
              }
            } else if (honorariosConfig.modoAplicacion === 'todos') {
              if (honorariosConfig.tipo === 'porcentaje') {
                honorarioJornal = (subtotalJornal * Number(honorariosConfig.valor)) / 100;
              } else {
                honorarioJornal = Number(honorariosConfig.valor);
              }
            }
          }

          // Base para mayores costos = subtotal + honorarios
          const baseJornal = subtotalJornal + honorarioJornal;

          // Aplicar mayores costos según configuración del rol
          const configRolMC = configJornales.porRol[jornal.rol];
          if (configRolMC) {
            if (configRolMC.tipo === 'porcentaje') {
              totalMayoresCostosJornales += (baseJornal * Number(configRolMC.valor)) / 100;
            } else {
              totalMayoresCostosJornales += Number(configRolMC.valor);
            }
          }
        });

        // Enviar como "monto_fijo" con el total calculado
        payload.mayoresCostosJornalesActivo = configJornales.activo ?? true;
        payload.mayoresCostosJornalesTipo = 'monto_fijo';
        payload.mayoresCostosJornalesValor = totalMayoresCostosJornales;
      } else {
        // Modo "todos" - enviar tal cual
        payload.mayoresCostosJornalesActivo = configJornales.activo ?? true;
        payload.mayoresCostosJornalesTipo = configJornales.tipo === 'porcentaje' ? 'porcentaje' : 'monto_fijo';
        payload.mayoresCostosJornalesValor = Number(configJornales.valor) || 0;
      }
    } else {
      payload.mayoresCostosJornalesActivo = false;
      payload.mayoresCostosJornalesTipo = null;
      payload.mayoresCostosJornalesValor = null;
    }

    if (datosMetrosCuadradosGuardados) {
      let fechaFormateada = null;
      if (datosMetrosCuadradosGuardados.fechaGuardado) {
        const fecha = new Date(datosMetrosCuadradosGuardados.fechaGuardado);
        fechaFormateada = fecha.getFullYear() + '-' +
                         String(fecha.getMonth() + 1).padStart(2, '0') + '-' +
                         String(fecha.getDate()).padStart(2, '0') + 'T' +
                         String(fecha.getHours()).padStart(2, '0') + ':' +
                         String(fecha.getMinutes()).padStart(2, '0') + ':' +
                         String(fecha.getSeconds()).padStart(2, '0');
      }

      payload.costosIniciales = {
        metrosCuadrados: Number(datosMetrosCuadradosGuardados.metrosCuadrados),
        importePorMetro: Number(datosMetrosCuadradosGuardados.importePorMetro),
        totalEstimado: Number(datosMetrosCuadradosGuardados.totalEstimado),
        porcentajeProfesionales: Number(datosMetrosCuadradosGuardados.porcentajeProfesionales),
        porcentajeMateriales: Number(datosMetrosCuadradosGuardados.porcentajeMateriales),
        porcentajeOtrosCostos: Number(datosMetrosCuadradosGuardados.porcentajeOtrosCostos),
        montoProfesionales: Number(datosMetrosCuadradosGuardados.montoProfesionales),
        montoMateriales: Number(datosMetrosCuadradosGuardados.montoMateriales),
        montoOtrosCostos: Number(datosMetrosCuadradosGuardados.montoOtrosCostos)
      };

    } else {
      payload.costosIniciales = null;
    }



    const totalProfesionalesEnviados = payload.itemsCalculadora?.reduce((total, item) =>
      total + (item.profesionales?.length || 0), 0) || 0;

    if (totalProfesionalesEnviados > 0) {
    } else {
    }


    itemsCalculadoraConsolidados?.forEach((item, idx) => {
    });
    const totalConsolidadoFinal = itemsCalculadoraConsolidados?.reduce((sum, item) => sum + (item.total || 0), 0) || 0;

    // ✅ USAR itemsCalculadora SIN CONSOLIDAR para evitar duplicación de jornales/profesionales/materiales/gastos
    // itemsCalculadoraConsolidados es SOLO para MOSTRAR en UI, NO para guardar
    if (itemsCalculadora && itemsCalculadora.length > 0) {
      let itemsParaEnviar = [...itemsCalculadora];

      console.log('📦 ITEMS A ENVIAR AL BACKEND (itemsCalculadora SIN consolidar):');
      itemsParaEnviar.forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item.tipoProfesional} (ID: ${item.id}): ${item.jornales?.length || 0} jornales, ${item.profesionales?.length || 0} profesionales`);
      });

      payload.itemsCalculadora = itemsParaEnviar.map(item => {
        const tieneProfesionalesDesglosados = item.profesionales && item.profesionales.length > 0;
        const tieneMaterialesDesglosados = item.materialesLista && item.materialesLista.length > 0;

        let cantidadJornalesParaBackend = item.cantidadJornales ? Number(item.cantidadJornales) : null;
        let importeJornalParaBackend = item.importeJornal ? Number(item.importeJornal) : null;

        if (!cantidadJornalesParaBackend && tieneProfesionalesDesglosados && item.subtotalManoObra) {
          const numProfesionales = item.profesionales.length;
          const subtotal = Number(item.subtotalManoObra);
          cantidadJornalesParaBackend = numProfesionales;
          importeJornalParaBackend = subtotal / numProfesionales;
        }

        let materialesParaBackend = item.materialesTotal ? Number(item.materialesTotal) : null;
        if (!materialesParaBackend && tieneMaterialesDesglosados && item.subtotalMateriales) {
          materialesParaBackend = Number(item.subtotalMateriales);
        }

        const profesionalesParaEnviar = item.profesionales || [];

        if (profesionalesParaEnviar.length > 0) {
        } else {
        }

        return {
          // ✅ CRÍTICO: Al editar trabajos extra, NO enviar ID del rubro (causaría error 409)
          id: esTrabajoExtra && payload.id ? null : (item.id || null),
          tipoProfesional: item.tipoProfesional || '',
          descripcion: item.descripcion || null,
          observaciones: item.observaciones || null,

          descripcionProfesionales: item.descripcionProfesionales || null,
          observacionesProfesionales: item.observacionesProfesionales || null,
          descripcionMateriales: item.descripcionMateriales || null,
          observacionesMateriales: item.observacionesMateriales || null,
          descripcionGastosGenerales: item.descripcionGastosGenerales || null,
          observacionesGastosGenerales: item.observacionesGastosGenerales || null,
          descripcionTotalManual: item.descripcionTotalManual || null,
          observacionesTotalManual: item.observacionesTotalManual || null,

          incluirEnCalculoDias: item.incluirEnCalculoDias ?? true, // ✅ Preservar valor exacto, por defecto true
          trabajaEnParalelo: item.trabajaEnParalelo ?? true, // ✅ Preservar checkbox de incluir en cálculo días (preserva false)

          cantidadJornales: Number(cantidadJornalesParaBackend ?? 0),
          importeJornal: Number(importeJornalParaBackend ?? 0),
          subtotalJornales: (item.jornales || []).reduce((sum, j) => {
              const cant = Number(j.cantidadJornales || j.cantidad || 0);
              const val = Number(j.importeJornal || j.valorUnitario || 0);
              const sub = Number(j.subtotal) || (cant * val);
              return sum + sub;
          }, 0),
          subtotalManoObra: (item.profesionales || []).reduce((sum, p) => sum + (Number(p.subtotal) || 0), 0),
          materiales: Number(materialesParaBackend ?? 0),
          subtotalMateriales: (item.materialesLista || []).reduce((sum, m) => sum + (Number(m.subtotal) || Number(m.total) || 0), 0),
          subtotalGastosGenerales: (item.gastosGenerales || []).reduce((sum, g) => sum + (Number(g.subtotal) || 0), 0),
          totalManual: Number(item.totalManual ?? 0),
          total: (() => {
            // ✅ RECALCULAR total desde TODOS los arrays, NO desde campos del backend
            const subtotalJornales = (item.jornales || []).reduce((sum, j) => {
                const cant = Number(j.cantidadJornales || j.cantidad || 0);
                const val = Number(j.importeJornal || j.valorUnitario || 0);
                const sub = Number(j.subtotal) || (cant * val);
                return sum + sub;
            }, 0);
            const subtotalProfesionales = (item.profesionales || []).reduce((sum, p) => sum + (Number(p.subtotal) || 0), 0);
            const subtotalMateriales = (item.materialesLista || []).reduce((sum, m) => sum + (Number(m.subtotal) || Number(m.total) || 0), 0);
            const subtotalGastos = (item.gastosGenerales || []).reduce((sum, g) => sum + (Number(g.subtotal) || 0), 0);

            const totalCalculado = subtotalJornales +
                                   subtotalProfesionales +
                                   subtotalMateriales +
                                   subtotalGastos +
                                   Number(item.totalManual ?? 0);

            console.log(`🔢 TOTAL ITEM "${item.tipoProfesional}":`, {
              jornales: subtotalJornales,
              profesionales: subtotalProfesionales,
              materiales: subtotalMateriales,
              gastos: subtotalGastos,
              totalCalculado: totalCalculado
            });

            return totalCalculado;
          })(),
          esModoManual: Boolean(item.esModoManual ?? false),
          esRubroVacio: Boolean(item.esRubroVacio ?? false),
          profesionales: profesionalesParaEnviar.map(prof => ({
            id: prof.id || Date.now(),  // ID único del frontend
            tipo: prof.tipo || '',      // Tipo de profesional (requerido)
            nombre: prof.nombre || null, // Nombre del profesional
            telefono: prof.telefono || null, // Teléfono de contacto
            unidad: prof.unidad || 'jornales', // Unidad de medida (ej: "jornales")
            cantidadJornales: Number(prof.cantidadJornales || 0), // Cantidad numérica
            importeJornal: Number(prof.importeJornal || 0), // Precio por jornal
            subtotal: Number(prof.subtotal || 0), // Resultado automático (cantidadJornales × importeJornal)
            sinCantidad: Boolean(prof.sinCantidad || false), // Boolean para casos sin cantidad
            sinImporte: Boolean(prof.sinImporte || false) // Boolean para casos sin importe
          })),
          jornales: (item.jornales || []).map(jornal => {
            console.log(`📤 ENVIANDO JORNAL de "${item.tipoProfesional}":`, {
              rol: jornal.rol,
              incluirOriginal: jornal.incluirEnCalculoDias,
              incluirTipo: typeof jornal.incluirEnCalculoDias,
              incluirFinal: jornal.incluirEnCalculoDias !== undefined ? jornal.incluirEnCalculoDias : true
            });

            const valorFinalIncluir = jornal.incluirEnCalculoDias !== undefined ? jornal.incluirEnCalculoDias : true;
            console.log(`🔥 PERSISTENCIA DEBUG - ${jornal.rol}:`, {
              valorOriginal: jornal.incluirEnCalculoDias,
              valorFinal: valorFinalIncluir,
              esUndefined: jornal.incluirEnCalculoDias === undefined,
              esFalse: jornal.incluirEnCalculoDias === false,
              esTrue: jornal.incluirEnCalculoDias === true,
              tipoOriginal: typeof jornal.incluirEnCalculoDias
            });

            return {
              // ✅ CRÍTICO: Al editar trabajos extra, NO enviar IDs (causaría error 409 por duplicación)
              // El backend eliminará los jornales viejos y creará nuevos
              id: esTrabajoExtra && payload.id ? null : (jornal.id && jornal.id < 1000000 ? jornal.id : null),
              rol: jornal.rol || '',
              cantidad: Number(jornal.cantidadJornales || jornal.cantidad || 0),
              valorUnitario: Number(jornal.importeJornal || jornal.valorUnitario || 0),
              subtotal: Number(jornal.subtotal || 0),
              observaciones: jornal.observaciones || null,
              incluirEnCalculoDias: valorFinalIncluir, // ✅ CHECKBOX - usar valor calculado
              // ✅ CAMPOS OBLIGATORIOS FALTANTES:
              esModoManual: jornal.esModoManual || false,
              tipoProfesional: jornal.tipoProfesional || jornal.rol || '',
              total: Number(jornal.subtotal || (jornal.cantidad || jornal.cantidadJornales || 0) * (jornal.valorUnitario || jornal.importeJornal || 0)),
              empresaId: Number(payload.idEmpresa || empresaSeleccionada?.id || 3),
              // ✅ CRÍTICO: En trabajos extra, NO enviar presupuestoNoClienteId (causaría error 409)
              presupuestoNoClienteId: esTrabajoExtra ? null : (payload.id || null)
            };
          }),
          materialesLista: (item.materialesLista || []).map(material => {
            // 🔍 Detectar material global por flag o patrón de descripción
            let esGlobalDetectado = false;

            if (material.esGlobal === undefined || material.esGlobal === null || material.esGlobal === false) {
              const desc = (material.descripcion || '').toLowerCase();
              esGlobalDetectado = desc.includes('presupuesto global') ||
                                  desc.includes('materiales global') ||
                                  desc.includes('global materiales');

              if (esGlobalDetectado) {
                console.log('🔥 [MAPEO GUARDADO] Detectado material global:', material.descripcion);
              }
            } else {
              esGlobalDetectado = material.esGlobal;
            }

            return {
              // ✅ Al editar trabajos extra, NO enviar IDs para evitar conflictos 409
              id: esTrabajoExtra && payload.id ? null : (material.id && material.id < 1000000 ? material.id : null),
              nombre: material.nombre || material.descripcion || 'Material sin nombre', // ✅ CRÍTICO: campo obligatorio en BD
              descripcion: material.descripcion || material.nombre,
              cantidad: Number(material.cantidad ?? 0),
              precioUnitario: Number(material.precioUnitario ?? 0),
              subtotal: Number(material.subtotal ?? material.total ?? 0),
              sinCantidad: Boolean(material.sinCantidad ?? false),
              sinPrecio: Boolean(material.sinPrecio ?? false),
              esGlobal: Boolean(esGlobalDetectado),
              unidad: esGlobalDetectado ? 'global' : (material.unidad || material.unidadMedida || 'unidad') // ✅ CRÍTICO: campo obligatorio en BD
            };
          }),
          gastosGenerales: (item.gastosGenerales || []).map(gasto => {
            // � WORKAROUND: Detectar gasto global por patrón de descripción
            let esGlobalDetectado = false;

            if (gasto.esGlobal === undefined || gasto.esGlobal === null || gasto.esGlobal === false) {
              const desc = (gasto.descripcion || '').toLowerCase();
              esGlobalDetectado = desc.includes('presupuesto global') ||
                                  desc.includes('gastos grales.') ||
                                  desc.includes('gastos generales global');

              if (esGlobalDetectado) {
                console.log('🔥 [MAPEO GUARDADO] Detectado gasto global:', gasto.descripcion);
              }
            } else {
              esGlobalDetectado = gasto.esGlobal;
            }

            // 🔍 DEBUG: Ver valor original de esGlobal ANTES de mapear
            console.log('🔍 [DEBUG MAPEO] Gasto original:', {
              descripcion: gasto.descripcion,
              esGlobal_original: gasto.esGlobal,
              esGlobal_detectado: esGlobalDetectado,
              esGlobal_tipo: typeof gasto.esGlobal,
              esGlobal_undefined: gasto.esGlobal === undefined,
              esGlobal_null: gasto.esGlobal === null,
              unidad: gasto.unidad
            });

            return {
              // ✅ Al editar trabajos extra, NO enviar IDs para evitar conflictos 409
              id: esTrabajoExtra && payload.id ? null : (gasto.id && gasto.id < 1000000 ? gasto.id : null),
              descripcion: gasto.descripcion,
              cantidad: Number(gasto.cantidad ?? 0),
              precioUnitario: Number(gasto.precioUnitario ?? 0),
              subtotal: Number(gasto.subtotal ?? 0),
              sinCantidad: Boolean(gasto.sinCantidad ?? false),
              sinPrecio: Boolean(gasto.sinPrecio ?? false),
              esGlobal: Boolean(esGlobalDetectado), // 🔥 USAR EL VALOR DETECTADO
              unidad: esGlobalDetectado ? 'global' : (gasto.unidad || gasto.unidadMedida || null) // 🔥 Asignar 'global' si es detectado
            };
          }),
          esGastoGeneral: Boolean(item.esGastoGeneral ?? false)
        };
      });

      // 🔍 DEBUG: Verificar que trabajaEnParalelo se está enviando correctamente
      console.log('🚀 PAYLOAD itemsCalculadora - campo trabajaEnParalelo:',
        payload.itemsCalculadora.map(item => ({
          tipoProfesional: item.tipoProfesional,
          trabajaEnParalelo: item.trabajaEnParalelo,
          tipo: typeof item.trabajaEnParalelo
        }))
      );

      payload.itemsCalculadora = payload.itemsCalculadora.filter(item => {
        const esGastoGeneral =
          item.tipoProfesional?.toLowerCase().includes('gasto') &&
          item.tipoProfesional?.toLowerCase().includes('general');

        if (!esGastoGeneral) return true; // No es Gastos Generales, mantener

        const tieneGastos = item.gastosGenerales && item.gastosGenerales.length > 0;
        const tieneProfesionales = item.profesionales && item.profesionales.length > 0;
        const tieneMateriales = item.materialesLista && item.materialesLista.length > 0;
        const tieneTotalManual = item.totalManual && item.totalManual > 0;

        const tieneContenido = tieneGastos || tieneProfesionales || tieneMateriales || tieneTotalManual;

        if (!tieneContenido) {
          return false; // No incluir este item en el guardado
        }
        return true; // Incluir todos los demás items
      });


      payload.itemsCalculadora.forEach((item, idx) => {
        if (item.profesionales && item.profesionales.length > 0) {
        }
      });

      payload.itemsCalculadora.forEach((item, idx) => {
        const camposNumericos = {
          cantidadJornales: item.cantidadJornales,
          importeJornal: item.importeJornal,
          subtotalManoObra: item.subtotalManoObra,
          materiales: item.materiales,
          subtotalMateriales: item.subtotalMateriales,
          totalManual: item.totalManual,
          total: item.total,
          subtotalGastosGenerales: item.subtotalGastosGenerales
        };

        const camposConNull = Object.entries(camposNumericos).filter(([key, val]) => val === null || val === undefined);

        if (camposConNull.length > 0) {
        }
      });

      const itemsConTotalNull = payload.itemsCalculadora.filter(item => item.total === null || item.total === undefined);
      if (itemsConTotalNull.length > 0) {
        alert(`⚠️ ERROR: Hay ${itemsConTotalNull.length} item(s) sin total calculado. Revisa la consola para más detalles.`);
      }

      const itemsConGastosGenerales = payload.itemsCalculadora.filter(item =>
        item.gastosGenerales && item.gastosGenerales.length > 0
      );

      const itemsInvalidos = payload.itemsCalculadora.filter(item => {
        return !item.tipoProfesional || item.tipoProfesional.trim() === '';
      });

      if (itemsInvalidos.length > 0) {
        alert(`⚠️ ERROR: Hay ${itemsInvalidos.length} item(s) sin tipo de profesional definido.\n\nTodos los items deben tener al menos un tipo de profesional asignado.`);
        throw new Error('Items sin tipo de profesional');
      }

      const itemsConValoresNulos = payload.itemsCalculadora.filter(item => {
        const tieneJornales = item.cantidadJornales && item.importeJornal;
        const tieneMateriales = item.materiales;
        return !tieneJornales && !tieneMateriales;
      });

      if (itemsConValoresNulos.length > 0) {
      }

    } else {
      payload.itemsCalculadora = [];
    }

    // 🔥 CONSOLIDAR GASTOS GENERALES: Extraer de itemsCalculadora y agregar a otrosCostos
    // IMPORTANTE: Hacer esto DESPUÉS de procesar itemsCalculadora
    const gastosConsolidados = [];

    // Extraer gastos de todos los items en itemsCalculadora que ya está procesado
    if (payload.itemsCalculadora && payload.itemsCalculadora.length > 0) {
      payload.itemsCalculadora.forEach(item => {
        if (item.gastosGenerales && item.gastosGenerales.length > 0) {
          item.gastosGenerales.forEach(gasto => {
            console.log('💰 [CONSOLIDAR] Gasto encontrado:', {
              descripcion: gasto.descripcion,
              esGlobal: gasto.esGlobal,
              unidad: gasto.unidad,
              subtotal: gasto.subtotal
            });

            gastosConsolidados.push({
              importe: Number(gasto.subtotal) || (Number(gasto.cantidad || 1) * Number(gasto.precioUnitario || 0)),
              descripcion: gasto.descripcion || '',
              cantidad: Number(gasto.cantidad) || 1,
              precioUnitario: Number(gasto.precioUnitario) || 0,
              subtotal: Number(gasto.subtotal) || (Number(gasto.cantidad || 1) * Number(gasto.precioUnitario || 0)),
              unidad: gasto.unidad || null,
              esGlobal: Boolean(gasto.esGlobal) // 🔥 CRÍTICO: Preservar esGlobal
            });
          });
        }
      });
    }

    // Asignar gastos consolidados al payload (reemplaza cualquier valor anterior)
    payload.otrosCostos = gastosConsolidados;

    console.log('💰 [CONSOLIDACIÓN FINAL] Total gastos consolidados:', gastosConsolidados.length);
    console.log('💰 [CONSOLIDACIÓN FINAL] Detalles:', gastosConsolidados);

    // ℹ️ NOTA IMPORTANTE:
    // - 'gastosConsolidados' (arriba) → Elementos INDIVIDUALES de gastos a guardar en este presupuesto
    // - 'elementosConsolidadosPorRubro' (más abajo) → Elementos CONSOLIDADOS POR RUBRO para el catálogo
    //   Estos últimos se crean automáticamente para tenerlos disponibles en futuros presupuestos

    // ✅ RECALCULAR totalPresupuesto desde payload.itemsCalculadora (FILTRANDO LEGACY)
    const itemsValidosParaTotal = (payload.itemsCalculadora || []).filter(item => {
      const esLegacy = item.tipoProfesional?.toLowerCase().includes('migrado') ||
                       item.tipoProfesional?.toLowerCase().includes('legacy') ||
                       item.descripcion?.toLowerCase().includes('migrados desde tabla legacy');
      return !esLegacy;
    });

    const totalCalculadoraRecalculado = itemsValidosParaTotal.reduce((sum, item) => sum + (Number(item.total) || 0), 0);

    console.log('💰 Total calculado (filtrando legacy):', totalCalculadoraRecalculado, 'de', payload.itemsCalculadora?.length, 'items (', itemsValidosParaTotal.length, 'válidos)');

    payload.totalPresupuesto = totalProfItemsBase + totalMatItemsBase + totalOtrosItemsBase + totalCalculadoraRecalculado;
    // Recalcular totalFinal antes de guardar
    const totalFinalCalculado = payload.totalPresupuesto + totalHonorarios + totalMayoresCostos;
    payload.totalPresupuestoConHonorarios = totalFinalCalculado;
    payload.montoTotal = totalFinalCalculado;
    payload.totalFinal = totalFinalCalculado;
    payload.totalGeneral = totalFinalCalculado;

    console.log('💵 TOTAL FINAL CALCULADO A GUARDAR:', totalFinalCalculado.toLocaleString('es-AR'));

    payload.descripcionProfesionales = descripcionProfesionales || null;
    payload.observacionesProfesionales = observacionesProfesionales || null;

    // ✨ NUEVO: Incluir el modo de cálculo automático de días hábiles
    payload.calculoAutomaticoDiasHabiles = form.calculoAutomaticoDiasHabiles;

// 🆕 NUEVA FUNCIONALIDAD: Extraer elementos INDIVIDUALES para catálogo
    // Objetivo: Guardar cada material, jornal y gasto como elemento separado (1 unidad)
    // para que estén disponibles en el catálogo de futuros presupuestos
    const elementosParaCatalogo = [];

    if (payload.itemsCalculadora && payload.itemsCalculadora.length > 0) {
      payload.itemsCalculadora.forEach(item => {
        const nombreRubro = item.tipoProfesional?.trim() || '';

        // 1️⃣ EXTRAER CADA MATERIAL INDIVIDUAL
        if (item.materialesLista && item.materialesLista.length > 0) {
          item.materialesLista.forEach(material => {
            // Solo agregar si tiene descripción y precio unitario válido
            if (material.descripcion && material.descripcion.trim() !== '' && material.precioUnitario > 0) {
              elementosParaCatalogo.push({
                tipo: 'MATERIAL',
                nombre: material.descripcion.trim(), // Ej: "Cemento", "Cal", "Ladrillos"
                descripcion: material.descripcion.trim(),
                categoria: nombreRubro || 'Sin categoría', // El rubro como categoría
                cantidad: 1, // SIEMPRE 1 unidad para el catálogo
                precioUnitario: Number(material.precioUnitario), // Precio por unidad
                unidadMedida: material.unidad || 'unidad',
                rubroOrigen: nombreRubro
              });

              console.log(`📦 Material para catálogo: "${material.descripcion}" - $${material.precioUnitario} (${nombreRubro})`);
            }
          });
        }

        // 2️⃣ EXTRAER CADA GASTO GENERAL INDIVIDUAL
        if (item.gastosGenerales && item.gastosGenerales.length > 0) {
          item.gastosGenerales.forEach(gasto => {
            // Solo agregar si tiene descripción y precio válido
            if (gasto.descripcion && gasto.descripcion.trim() !== '' && gasto.precioUnitario > 0) {
              elementosParaCatalogo.push({
                tipo: 'GASTO_GENERAL',
                nombre: gasto.descripcion.trim(), // Ej: "Transporte", "Herramientas"
                descripcion: gasto.descripcion.trim(),
                categoria: nombreRubro || 'Sin categoría',
                cantidad: 1, // SIEMPRE 1 unidad para el catálogo
                precioUnitario: Number(gasto.precioUnitario), // Precio por unidad
                unidadMedida: gasto.unidad || 'unidad',
                rubroOrigen: nombreRubro
              });

              console.log(`💰 Gasto para catálogo: "${gasto.descripcion}" - $${gasto.precioUnitario} (${nombreRubro})`);
            }
          });
        }

        // 3️⃣ EXTRAER CADA JORNAL/PROFESIONAL INDIVIDUAL
        if (item.jornales && item.jornales.length > 0) {
          item.jornales.forEach(jornal => {
            // Determinar el nombre: Si tiene nombre de profesional, usarlo; si no, usar el rol/tipo
            let nombreJornal = '';

            // Si el jornal tiene un nombre de profesional asociado (ej: "Juan Pérez")
            if (jornal.nombreProfesional && jornal.nombreProfesional.trim() !== '') {
              nombreJornal = `${jornal.nombreProfesional} - ${jornal.rol || jornal.tipoProfesional}`;
              // Resultado: "Juan Pérez - Oficial Albañil"
            } else {
              // Si NO tiene nombre, usar solo el rol/tipo
              nombreJornal = jornal.rol || jornal.tipoProfesional || 'Profesional';
              // Resultado: "Oficial Albañil"
            }

            // Solo agregar si tiene precio válido
            if (nombreJornal.trim() !== '' && jornal.valorUnitario > 0) {
              elementosParaCatalogo.push({
                tipo: 'JORNAL',
                nombre: nombreJornal.trim(),
                rol: jornal.rol || jornal.tipoProfesional || '',
                nombreProfesional: jornal.nombreProfesional || null,
                categoria: nombreRubro || 'Sin categoría',
                cantidad: 1, // SIEMPRE 1 jornal para el catálogo
                valorUnitario: Number(jornal.valorUnitario), // Precio por jornal
                rubroOrigen: nombreRubro
              });

              console.log(`👷 Jornal para catálogo: "${nombreJornal}" - $${jornal.valorUnitario}/jornal (${nombreRubro})`);
            }
          });
        }

        // 4️⃣ TAMBIÉN EXTRAER PROFESIONALES (si existen)
        if (item.profesionales && item.profesionales.length > 0) {
          item.profesionales.forEach(profesional => {
            let nombreProfesional = '';

            // Si tiene nombre propio
            if (profesional.nombre && profesional.nombre.trim() !== '') {
              nombreProfesional = `${profesional.nombre} - ${profesional.tipo || 'Profesional'}`;
            } else {
              // Si NO tiene nombre, usar solo el tipo
              nombreProfesional = profesional.tipo || 'Profesional';
            }

            // Solo agregar si tiene precio válido
            if (nombreProfesional.trim() !== '' && profesional.importeJornal > 0) {
              elementosParaCatalogo.push({
                tipo: 'PROFESIONAL',
                nombre: nombreProfesional.trim(),
                tipoProfesional: profesional.tipo || '',
                nombreProfesional: profesional.nombre || null,
                telefono: profesional.telefono || null,
                categoria: nombreRubro || 'Sin categoría',
                cantidad: 1, // SIEMPRE 1 unidad
                valorUnitario: Number(profesional.importeJornal),
                unidad: profesional.unidad || 'jornales',
                rubroOrigen: nombreRubro
              });

              console.log(`👨‍💼 Profesional para catálogo: "${nombreProfesional}" - $${profesional.importeJornal} (${nombreRubro})`);
            }
          });
        }
      });
    }

    // Agregar los elementos al payload
    payload.elementosParaCatalogo = elementosParaCatalogo;

    console.log(`\n📚 ELEMENTOS EXTRAÍDOS PARA CATÁLOGO: ${elementosParaCatalogo.length} elementos individuales`);

    // Resumen por tipo
    const cantMateriales = elementosParaCatalogo.filter(e => e.tipo === 'MATERIAL').length;
    const cantGastos = elementosParaCatalogo.filter(e => e.tipo === 'GASTO_GENERAL').length;
    const cantJornales = elementosParaCatalogo.filter(e => e.tipo === 'JORNAL').length;
    const cantProfesionales = elementosParaCatalogo.filter(e => e.tipo === 'PROFESIONAL').length;

    console.log(`   📦 Materiales: ${cantMateriales}`);
    console.log(`   💰 Gastos Generales: ${cantGastos}`);
    console.log(`   👷 Jornales: ${cantJornales}`);
    console.log(`   👨‍💼 Profesionales: ${cantProfesionales}`);

    console.log('🔄 MODO DE CÁLCULO GUARDADO:', {
      valorEnForm: form.calculoAutomaticoDiasHabiles,
      tipoValorEnForm: typeof form.calculoAutomaticoDiasHabiles,
      valorEnPayload: payload.calculoAutomaticoDiasHabiles,
      tipoValorEnPayload: typeof payload.calculoAutomaticoDiasHabiles,
      tiempoEstimadoTerminacion: payload.tiempoEstimadoTerminacion
    });

    console.log('📦 PAYLOAD FINAL A ENVIAR:', JSON.stringify(payload, null, 2));

    // 🚨 VERIFICACIÓN CRÍTICA: HONORARIOS JORNALES
    if (payload.honorariosJornalesActivo !== undefined) {
      console.log('💰 HONORARIOS JORNALES → Backend:', {
        activo: payload.honorariosJornalesActivo,
        tipo: payload.honorariosJornalesTipo,
        valor: payload.honorariosJornalesValor
      });
    }

    return payload;
  };

  const guardarSolamente = async () => {
    estaGuardandoRef.current = true; // 🚫 Evitar loops
    setSaving(true);
    try {
      console.log('💾 GUARDANDO - onSave se está llamando...');
      const resultado = await onSave(datosParaEnviar);

      console.log('📥 RESULTADO COMPLETO DEL BACKEND:', resultado);
      console.log('📥 ¿Tiene itemsCalculadora?', !!resultado?.itemsCalculadora, 'Cantidad:', resultado?.itemsCalculadora?.length);

      // 🔄 Actualizar estado local con datos frescos del backend
      if (resultado && resultado.itemsCalculadora) {
        console.log('🔄 Actualizando items con IDs de base de datos');
        console.log('📥 ITEMS RECIBIDOS DEL BACKEND - trabajaEnParalelo:',
          resultado.itemsCalculadora.map(item => ({
            tipoProfesional: item.tipoProfesional,
            trabajaEnParalelo: item.trabajaEnParalelo,
            tipo: typeof item.trabajaEnParalelo
          }))
        );
        setItemsCalculadora(resultado.itemsCalculadora);
      }

      setMostrarPrevisualizacion(false);
      setDatosParaEnviar(null);
    } catch (error) {
      alert('Error al guardar el presupuesto. Revise la consola para más detalles.');
    } finally {
      setSaving(false);
      estaGuardandoRef.current = false; // ✅ Reactivar effects
    }
  };

  const enviarYGuardar = async (metodo) => {
    estaGuardandoRef.current = true; // 🚫 Evitar loops
    setSaving(true);
    try {
      const resultado = await onSave(datosParaEnviar);

      // 🔄 Actualizar estado local con datos frescos del backend
      if (resultado && resultado.itemsCalculadora) {
        console.log('🔄 Actualizando items con IDs de base de datos');
        console.log('📥 ITEMS RECIBIDOS DEL BACKEND - trabajaEnParalelo:',
          resultado.itemsCalculadora.map(item => ({
            tipoProfesional: item.tipoProfesional,
            trabajaEnParalelo: item.trabajaEnParalelo,
            tipo: typeof item.trabajaEnParalelo
          }))
        );
        setItemsCalculadora(resultado.itemsCalculadora);
      }

      if (metodo === 'whatsapp' && form.telefono) {
        const mensaje = generarResumenTexto(datosParaEnviar);
        const numeroLimpio = form.telefono.replace(/\D/g, '');
        const url = `https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`;
        window.open(url, '_blank');
      } else if (metodo === 'email' && form.mail) {
        const asunto = `Presupuesto ${datosParaEnviar.numeroPresupuesto || 'Nuevo'} - ${datosParaEnviar.empresaNombre}`;
        const cuerpo = generarResumenTexto(datosParaEnviar);
        const mailtoLink = `mailto:${form.mail}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
        window.location.href = mailtoLink;
      }

      setMostrarPrevisualizacion(false);
      setDatosParaEnviar(null);
    } catch (error) {
      alert('Error al guardar el presupuesto. Revise la consola para más detalles.');
    } finally {
      setSaving(false);
      estaGuardandoRef.current = false; // ✅ Reactivar effects
    }
  };

  const volverAEditar = () => {
    setMostrarPrevisualizacion(false);
  };

  const setImporteMode = (idx, mode) => {
    setForm(prev => {
      const profes = prev.profesionales.map((p, i) => {
        if (i !== idx) return p;
        const cleared = {
          ...p,
          importeMode: mode,
          importePorUnidad: mode === 'porUnidad' ? p.importePorUnidad : '',
          importeXHora: mode === 'hora' ? p.importeXHora : '',
          importeXDia: mode === 'dia' ? p.importeXDia : '',
          importeXSemana: mode === 'semana' ? p.importeXSemana : '',
          importeXMes: mode === 'mes' ? p.importeXMes : '',
          importeXObra: mode === 'obra' ? p.importeXObra : '',
        };
        return cleared;
      });
      return { ...prev, profesionales: profes };
    });
    setTimeout(() => recalcProfesional(idx), 0);
  };

  const recalcProfesional = (idx, override) => {
    setForm(prev => {
      const profes = prev.profesionales.map((p, i) => {
        if (i !== idx) return p;

        const merged = override ? { ...p, ...override } : p;

        const importeXHora = Number(merged.importeXHora || 0);
        const cantidadHoras = Number(merged.cantidadHoras || 0);

        const importeCalculado = importeXHora * cantidadHoras;

        return {
          ...p,
          ...override,
          importeCalculado
        };
      });
      return { ...prev, profesionales: profes };
    });
  };
  return (
    <>
      <div className="modal show d-block" style={{ zIndex: 9999 }}>
      <div className="modal-dialog" style={{ marginTop: '150px', maxWidth: 'calc(100vw - 48px)', width: '100%' }}>
        <div className="modal-content" style={{ padding: '14px' }}>
          <div className="modal-header d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center gap-3 flex-grow-1">
                <h5 className="modal-title mb-0">
                  {modoTrabajoExtra ? (
                    'Trabajos Extra'
                  ) : soloLectura ? (
                    <>
                      <i className="fas fa-lock me-2 text-warning"></i>
                      Ver Presupuesto - Solo Lectura
                    </>
                  ) : (
                    initialData && initialData.id
                      ? (form.tipoPresupuesto === 'TRABAJOS_SEMANALES' ? 'Editar Trabajos Semanales' : 'Editar Presupuesto')
                      : (form.tipoPresupuesto === 'TRABAJOS_SEMANALES' ? 'Nuevo Trabajos Semanales' : 'Nuevo Presupuesto')
                  )}
                </h5>

                {/* 🎯 Badge de Tipo de Presupuesto */}
                {modoTrabajoExtra && (
                  <>
                    <span
                      className="badge bg-warning text-dark"
                      style={{ fontSize: '0.85rem', padding: '6px 10px' }}
                      title="Este es un Trabajo Extra vinculado a una obra"
                    >
                      <i className="fas fa-tools me-1"></i>
                      TRABAJO EXTRA
                    </span>

                    {/* 🎯 Badge de Modo de Presupuesto (GLOBAL/DETALLE/MIXTO) */}
                    <BadgeModoPresupuesto modo={modoPresupuestoDetectado} />
                  </>
                )}

                {!modoTrabajoExtra && form.tipoPresupuesto === 'TRABAJOS_SEMANALES' && (
                  <span
                    className="badge bg-primary"
                    style={{ fontSize: '0.85rem', padding: '6px 10px' }}
                    title="Presupuesto con asignaciones semanales"
                  >
                    <i className="fas fa-calendar-week me-1"></i>
                    SEMANAL
                  </span>
                )}

                {!modoTrabajoExtra && form.tipoPresupuesto === 'TRADICIONAL' && (
                  <span
                    className="badge bg-success"
                    style={{ fontSize: '0.85rem', padding: '6px 10px' }}
                    title="Presupuesto tradicional completo"
                  >
                    <i className="fas fa-building me-1"></i>
                    TRADICIONAL
                  </span>
                )}

                {/* 🎯 Badge de Modo de Presupuesto para presupuestos normales */}
                {!modoTrabajoExtra && (
                  <BadgeModoPresupuesto modo={modoPresupuestoDetectado} />
                )}

                {!soloLectura && !modoTrabajoExtra && (
                  <div style={{minWidth: '200px'}}>
                    <select
                      name="tipoPresupuesto"
                      className="form-select form-select-sm"
                      value={form.tipoPresupuesto || 'TRADICIONAL'}
                      onChange={handleChange}
                      style={{fontSize: '0.9rem'}}
                    >
                      <option value="TRADICIONAL">🏗️ Tradicional</option>
                      <option value="TRABAJOS_SEMANALES">📅 Semanal</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={onClose}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleSubmit}
                  disabled={saving}
                >
                  Guardar
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={onClose}
                  title="Cerrar sin guardar cambios"
                >
                  <i className="fas fa-times me-1"></i>
                  Cerrar sin Guardar
                </button>
              </div>
            </div>
            <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto', paddingTop: '6rem' }}>
            <form ref={modalContentRef} onSubmit={handleSubmit} style={{ padding: '8px 10px' }}>
              <div className="row g-2">
                    {/* Eliminado label de Fecha creación fuera del bloque de fechas */}

                {/* Título: Presupuesto destinado a */}
                <div className="col-12 mb-3">
                  <div className="alert alert-light border" style={{
                    backgroundColor: '#f8f9fa',
                    borderLeft: '5px solid #0d6efd',
                    padding: '12px 20px'
                  }}>
                    <h6 className="mb-0" style={{
                      color: '#0d6efd',
                      fontSize: '1.1rem',
                      fontWeight: 'bold',
                      letterSpacing: '0.5px'
                    }}>
                      <i className="fas fa-building me-2"></i>
                      Presupuesto destinado a:
                      <span className="ms-2" style={{
                        color: '#212529',
                        fontSize: '1.15rem',
                        fontWeight: 'bold'
                      }}>
                        {form.nombreObraManual || '(Sin nombre de obra)'}
                      </span>
                    </h6>
                  </div>
                </div>

                {/* Nombre de la obra - ANTES de Vincular a Cliente */}
                <div className="col-12 mb-3">
                  <label className="form-label fw-bold w-100" style={{color: "#000", marginBottom: 6}}>Nombre de la obra
                    <input
                      type="text"
                      name="nombreObraManual"
                      className="form-control mt-1"
                      placeholder="Ingrese el nombre de la obra"
                      value={form.nombreObraManual || ''}
                      style={{marginTop: 4, borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                      onChange={e => {
                        const nuevoValor = e.target.value;
                        // Proteger el valor inicial SOLO si NO es un presupuesto semanal
                        // Los presupuestos semanales crean obra nueva, así que el nombre es libre
                        if (form.tipoPresupuesto !== 'TRABAJOS_SEMANALES' && nombreObraProtegido && !nuevoValor.startsWith(nombreObraProtegido)) {
                          // Si intenta borrar parte del texto protegido, restaurarlo
                          return;
                        }

                        // ✅ UX MEJORADA: Si escribe nombre de obra y calle/altura están vacíos, autocompletar
                        const actualizacion = { nombreObraManual: nuevoValor };
                        if (nuevoValor.trim() !== '') {
                          if (!form.direccionObraCalle || String(form.direccionObraCalle).trim() === '') {
                            actualizacion.direccionObraCalle = 'Calle genérica';
                          }
                          if (!form.direccionObraAltura || String(form.direccionObraAltura).trim() === '') {
                            actualizacion.direccionObraAltura = 'S/N';
                          }
                        }

                        setForm(f => ({ ...f, ...actualizacion }));

                        // Limpiar errores de calle/altura si se autocompletaron
                        if (actualizacion.direccionObraCalle || actualizacion.direccionObraAltura) {
                          setErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors.direccionObraCalle;
                            delete newErrors.direccionObraAltura;
                            return newErrors;
                          });
                        }
                      }}
                      disabled={soloLectura}
                    />
                    {nombreObraProtegido && form.tipoPresupuesto !== 'TRABAJOS_SEMANALES' && (
                      <small className="text-muted d-block mt-1">
                        💡 Puedes agregar texto adicional, pero no borrar: "{nombreObraProtegido}"
                      </small>
                    )}
                  </label>
                </div>

                {/* Primera fila: 5 columnas iguales, agregando Nombre de obra */}
                <div className="col-12">
                  {/* Primera fila: Nombre de obra (ancho completo) */}
                  <div className="row g-2 mb-2">
                    <div className="col-12">
                          {/* Si es modo EDICIÓN y tiene vinculación, mostrar solo label de solo lectura */}
                          {(form.id || initialData?.id) && (form.clienteId || initialData?.clienteId || form.obraId || initialData?.obraId) ? (
                            <div className="alert alert-info mb-3" style={{backgroundColor: '#e7f3ff', borderLeft: '4px solid #0d6efd'}}>
                              <h6 className="fw-bold mb-3" style={{color: '#0d6efd'}}>
                                <i className="fas fa-link me-2"></i>
                                Presupuesto Vinculado
                              </h6>
                              {(form.clienteId || initialData?.clienteId) && (
                                <div className="mb-2 p-2 bg-white rounded">
                                  <i className="fas fa-user me-2 text-primary"></i>
                                  <strong>Cliente:</strong>
                                  <span className="ms-2" style={{fontSize: '1.05em'}}>
                                    {nombreClienteVinculado || `Cargando...`}
                                  </span>
                                </div>
                              )}
                              {(form.obraId || initialData?.obraId) && (
                                <div className="mb-2 p-2 bg-white rounded">
                                  <i className="fas fa-building me-2 text-success"></i>
                                  <strong>Obra:</strong>
                                  <span className="ms-2" style={{fontSize: '1.05em'}}>
                                    {nombreObraVinculado || `Cargando...`}
                                  </span>
                                </div>
                              )}
                              <small className="text-muted d-block mt-2">
                                <i className="fas fa-lock me-1"></i>
                                La vinculación no es editable una vez creado el presupuesto
                              </small>
                            </div>
                          ) : (
                            /* Si es NUEVO presupuesto, mostrar selectores */
                            <>
                              {!modoTrabajoExtra && (
                              <label className="form-label fw-bold w-100" style={{color: "#000", marginBottom: 8}}>
                                Vincular a Cliente Existente

                                {/* Selector de Cliente */}
                                <div className="mb-2">
                                  <label className="form-label fw-bold" style={{color: "#000", marginBottom: 6}}>
                                    Cliente existente:
                                  </label>
                                  <div className="d-flex gap-2 align-items-center">
                                    <ClienteSelector
                                  empresaId={form.idEmpresa}
                                  value={form.clienteId ? String(form.clienteId) : ''}
                                  onClick={() => {
                                    // Al hacer clic en el selector de cliente, limpiar la obra si había una seleccionada
                                    if (form.obraSeleccionadaParaCopiar) {
                                      console.log('🔄 Limpiando obra porque se hizo clic en ClienteSelector');
                                      setForm(f => ({ ...f, obraSeleccionadaParaCopiar: null }));
                                    }
                                  }}
                                  onChange={(clienteId) => {
                                    console.log('🔵 ClienteSelector onChange - clienteId recibido:', clienteId, 'tipo:', typeof clienteId);
                                    setForm(f => ({
                                      ...f,
                                      clienteId: clienteId, // Ahora es numérico directamente
                                      obraId: null, // Limpiar obra al seleccionar cliente
                                      obraSeleccionadaParaCopiar: null // Limpiar flag de obra copiada
                                    }));
                                  }}
                                  className="form-select"
                                  placeholder="Seleccionar cliente..."
                                  disabled={soloLectura || !!form.obraSeleccionadaParaCopiar}
                                  style={{
                                    opacity: form.obraSeleccionadaParaCopiar ? 0.5 : 1,
                                    backgroundColor: form.obraSeleccionadaParaCopiar ? '#f8f9fa' : 'white',
                                    cursor: form.obraSeleccionadaParaCopiar ? 'not-allowed' : 'pointer',
                                    borderRadius: '8px',
                                    padding: '10px 12px',
                                    fontSize: '0.95rem',
                                    border: '3px solid #86b7fe',
                                    transition: 'all 0.2s'
                                  }}
                                />
                                {form.clienteId && !form.obraSeleccionadaParaCopiar && (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => setForm(f => ({ ...f, clienteId: null }))}
                                    title="Limpiar cliente seleccionado"
                                    disabled={soloLectura}
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                              {form.clienteId && !form.obraSeleccionadaParaCopiar && (
                                <small className="text-success d-block mt-1">
                                  ✅ Cliente seleccionado - Se creará un Presupuesto nuevo asociado a este Cliente
                                </small>
                              )}
                              {form.obraSeleccionadaParaCopiar && (
                                <small className="text-muted d-block mt-1" style={{fontStyle: 'italic'}}>
                                  🔒 Deshabilitado (hay una obra seleccionada abajo)
                                </small>
                              )}
                            </div>

                            {/* Selector de Obra */}
                            <div className="mb-2">
                              <label className="form-label fw-bold" style={{color: "#000", marginBottom: 6}}>
                                Vincular a Obra Existente:
                              </label>
                              <div className="d-flex gap-2 align-items-center">
                                <ObraSelector
                                  empresaId={form.idEmpresa}
                                  value={(form.obraId || form.obraSeleccionadaParaCopiar) ? String(form.obraId || form.obraSeleccionadaParaCopiar) : ''}
                                  onClick={() => {
                                    // Al hacer clic en el selector de obra, limpiar el cliente si había uno seleccionado
                                    if (form.clienteId) {
                                      console.log('🔄 Limpiando cliente porque se hizo clic en ObraSelector');
                                      setForm(f => ({ ...f, clienteId: null }));
                                    }
                                  }}
                                  onChange={handleObraChange}
                                  className="form-select"
                                  placeholder="Seleccionar obra para copiar datos..."
                                  disabled={soloLectura || !!form.clienteId}
                                  style={{
                                    opacity: form.clienteId ? 0.5 : 1,
                                    backgroundColor: form.clienteId ? '#f8f9fa' : 'white',
                                    cursor: form.clienteId ? 'not-allowed' : 'pointer',
                                    borderRadius: '8px',
                                    padding: '10px 12px',
                                    fontSize: '0.95rem',
                                    border: '3px solid #86b7fe',
                                    transition: 'all 0.2s'
                                  }}
                                />
                                {(form.obraId || form.obraSeleccionadaParaCopiar) && (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => {
                                      console.log('🔄 Limpiando obra manualmente');
                                      setForm(f => ({ ...f, obraId: null, obraSeleccionadaParaCopiar: null, clienteId: null }));
                                    }}
                                    title="Limpiar obra seleccionada"
                                    disabled={soloLectura}
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                              {(form.obraId || form.obraSeleccionadaParaCopiar) && (
                                <small className="text-success d-block mt-1">
                                  ✅ Obra {form.obraId ? 'vinculada' : 'seleccionada'} - {form.obraId ? 'Este presupuesto está asociado a esta Obra' : 'Se creará un nuevo Presupuesto asociado a esta Obra'}
                                </small>
                              )}
                            </div>
                          </label>
                              )}
                          </>
                          )}
                    </div>
                  </div>

                  {/* Segunda fila: Dirección completa de la obra (6 campos) */}
                  {!modoTrabajoExtra && (
                  <div className="row g-2 mb-2">
                    <div className="col-md-2">
                      <label className="form-label fw-bold" style={{color: "#000", marginBottom: 6}}>Calle *
                        <input
                          name="direccionObraCalle"
                          className={`form-control ${errors.direccionObraCalle ? 'is-invalid' : ''}`}
                          value={form.direccionObraCalle}
                          onChange={handleChange}
                          placeholder="Av. Libertador"
                          required
                          disabled={soloLectura}
                          style={{marginTop: 4, borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                        />
                        {errors.direccionObraCalle && <div className="invalid-feedback">{errors.direccionObraCalle}</div>}
                      </label>
                    </div>
                    <div className="col-md-2">
                      <label className="form-label fw-bold" style={{color: "#000", marginBottom: 6}}>Altura *
                        <input
                          name="direccionObraAltura"
                          type="number"
                          className={`form-control ${errors.direccionObraAltura ? 'is-invalid' : ''}`}
                          value={form.direccionObraAltura}
                          onChange={handleChange}
                          placeholder="1234"
                          min="1"
                          step="1"
                          required
                          disabled={soloLectura}
                          style={{marginTop: 4, borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                        />
                        {errors.direccionObraAltura && <div className="invalid-feedback">{errors.direccionObraAltura}</div>}
                      </label>
                    </div>
                    <div className="col-md-2">
                      <label className="form-label fw-bold" style={{color: "#000", marginBottom: 6}}>Barrio
                        <input
                          name="direccionObraBarrio"
                          className="form-control"
                          value={form.direccionObraBarrio}
                          onChange={handleChange}
                          disabled={soloLectura}
                          style={{marginTop: 4, borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                        />
                      </label>
                    </div>
                    <div className="col-md-2">
                      <label className="form-label fw-bold" style={{color: "#000", marginBottom: 6}}>Torre
                        <input
                          name="direccionObraTorre"
                          className="form-control"
                          value={form.direccionObraTorre}
                          onChange={handleChange}
                          disabled={soloLectura}
                          style={{marginTop: 4, borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                        />
                      </label>
                    </div>
                    <div className="col-md-2">
                      <label className="form-label fw-bold" style={{color: "#000", marginBottom: 6}}>Piso
                        <input
                          name="direccionObraPiso"
                          className="form-control"
                          value={form.direccionObraPiso}
                          onChange={handleChange}
                          disabled={soloLectura}
                          style={{marginTop: 4, borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                        />
                      </label>
                    </div>
                    <div className="col-md-2">
                      <label className="form-label fw-bold" style={{color: "#000", marginBottom: 6}}>Depto
                        <input
                          name="direccionObraDepartamento"
                          className="form-control"
                          value={form.direccionObraDepartamento || ''}
                          onChange={handleChange}
                          disabled={soloLectura}
                          style={{marginTop: 4, borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                        />
                      </label>
                    </div>
                  </div>
                  )}

                  {/* Tercera fila: Datos del solicitante */}
                  {!modoTrabajoExtra && (
                  <div className="row g-2">
                    <div className="col-md-3">
                      <label className="form-label fw-bold" style={{color: "#000", marginBottom: 6}}>Nombre solicitante
                        <input name="nombreSolicitante" className="form-control" value={form.nombreSolicitante} onChange={handleChange} disabled={soloLectura || editarSoloFechas} style={{marginTop: 4, borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}} />
                      </label>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label fw-bold" style={{color: "#000", marginBottom: 6}}>Teléfono
                        <input name="telefono" className="form-control" value={form.telefono} onChange={handleChange} disabled={soloLectura || editarSoloFechas} style={{marginTop: 4, borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}} />
                      </label>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label fw-bold" style={{color: "#000", marginBottom: 6}}>Dirección particular
                        <input name="direccionParticular" className="form-control" value={form.direccionParticular} onChange={handleChange} disabled={soloLectura || editarSoloFechas} style={{marginTop: 4, borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}} />
                      </label>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label fw-bold" style={{color: "#000", marginBottom: 6}}>Mail
                        <input name="mail" type="email" className="form-control" value={form.mail} onChange={handleChange} disabled={soloLectura || editarSoloFechas} style={{marginTop: 4, borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}} />
                      </label>
                    </div>
                  </div>
                  )}

                {/* ...otras subsecciones y campos... */}
                {/* ...sección de Items agregados... */}
                {/* Botón único al pie de la sección 'Items agregados' */}
                {/* Botón 'Finalizar carga de este Rubro' eliminado por solicitud del usuario */}
              </div> {/* cierre del div.row g-2 principal */}

                {/* Row adicional con fechas y estado (alineados) */}
                <div className="col-12 mt-2">
                  <div className="row g-2 align-items-end" style={{marginBottom: '56px'}}>
                    <div className="col-md-2 d-flex flex-column justify-content-center align-items-center" style={{gap: '4px'}}>
                      <label className="form-label fw-bold w-100 text-center mb-1" style={{color: "#000"}} title="La obra cambiará automáticamente a EN EJECUCION en esta fecha (proceso diario a las 00:00)">
                        Fecha probable inicio
                        <i className="bi bi-info-circle ms-1 text-primary" style={{fontSize: '0.9em'}}></i>
                      </label>
                      <input
                        name="fechaProbableInicio"
                        className="form-control text-center"
                        type="date"
                        value={form.fechaProbableInicio || ''}
                        onChange={handleChange}
                        onBlur={async (e) => {
                          // ✨ HABILITADO PARA TRABAJOS EXTRA TAMBIÉN
                          // El usuario solicitó explícitamente poder configurar la planificación en Trabajos Extra

                          if (form.id && e.target.value !== initialData?.fechaProbableInicio) {
                            console.log('🔄 Guardando fechaProbableInicio automáticamente...');
                            console.log('   Valor anterior:', initialData?.fechaProbableInicio);
                            console.log('   Valor nuevo:', e.target.value);

                            // ✅ Usar endpoint específico PATCH /fechas
                            const datosActualizarFechas = {
                              fechaProbableInicio: e.target.value,
                              tiempoEstimadoTerminacion: form.tiempoEstimadoTerminacion || 0
                            };
                            try {
                              const resultado = await apiService.presupuestosNoCliente.actualizarSoloFechas(
                                form.id,
                                datosActualizarFechas,
                                empresaSeleccionada?.id
                              );
                              console.log('✅ fechaProbableInicio guardada automáticamente:', e.target.value);
                              console.log('✅ Respuesta del backend:', resultado);

                              // Verificar que se guardó correctamente haciendo una petición GET
                              setTimeout(async () => {
                                try {
                                  const verificacion = await fetch(`http://localhost:8080/api/presupuestos-no-cliente/${form.id}?empresaId=${empresaSeleccionada?.id}&_t=${Date.now()}`, {
                                    headers: {
                                      'Cache-Control': 'no-cache, no-store, must-revalidate',
                                      'Pragma': 'no-cache',
                                      'Expires': '0'
                                    }
                                  });
                                  const datos = await verificacion.json();
                                  console.log('🔍 VERIFICACIÓN: fechaProbableInicio en backend después de guardar:', datos.fechaProbableInicio);
                                  if (datos.fechaProbableInicio && datos.fechaProbableInicio.split('T')[0] === e.target.value) {
                                    console.log('✅✅✅ CONFIRMADO: La fecha se guardó correctamente en el backend');
                                  } else {
                                    console.error('❌❌❌ ERROR: La fecha NO se guardó correctamente en el backend');
                                    console.error('   Esperado:', e.target.value);
                                    console.error('   Recibido:', datos.fechaProbableInicio);
                                  }
                                } catch (err) {
                                  console.error('❌ Error al verificar guardado:', err);
                                }
                              }, 500);
                            } catch (error) {
                              console.error('❌ Error al guardar fechaProbableInicio:', error);
                            }
                          }
                        }}
                        disabled={soloLectura}
                        style={{marginTop: 0, backgroundColor: editarSoloFechas ? '#fff3cd' : 'white', fontWeight: editarSoloFechas ? 'bold' : 'normal', borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                        title="La obra cambiará automáticamente a EN EJECUCION en esta fecha"
                      />
                      {obtenerAlertaInicio() && (
                        <div className={`badge bg-${obtenerAlertaInicio().tipo} mt-1`} style={{fontSize: '0.75em'}}>
                          {obtenerAlertaInicio().icono} {obtenerAlertaInicio().mensaje}
                        </div>
                      )}
                    </div>
                    <div className="col-md-2 d-flex flex-column justify-content-center align-items-center" style={{gap: '4px'}}>
                      <label className="form-label fw-bold w-100 text-center mb-1" style={{color: "#000"}}>Vencimiento de este presupuesto</label>
                      <input name="vencimiento" className="form-control text-center" type="date" value={form.vencimiento || ''} onChange={handleChange} disabled={soloLectura || editarSoloFechas} style={{marginTop: 0, borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}} />
                    </div>
                    {/* Fecha creación mudado al final del bloque */}
                    <div className="col-md-2 d-flex flex-column justify-content-center align-items-center" style={{gap: '4px'}}>
                      <label className="form-label fw-bold w-100 text-center mb-1" style={{color: "#000", marginBottom: 0, marginTop: '32px'}}>Fecha creación<br />
                        <span style={{display: 'inline-block', padding: '6px 12px', background: '#f5f5f5', borderRadius: '4px', fontWeight: 'normal', border: '1px solid #ddd', marginTop: 0}}>{form.fechaCreacion}</span>
                      </label>
                    </div>
                    <div className="col-md-1 d-flex flex-column justify-content-center align-items-center" style={{gap: '4px'}}>
                      <label className="form-label fw-bold w-100 text-center mb-1" style={{color: "#000", marginTop: '32px'}}>Versión</label>
                      <input name="version" readOnly className="form-control form-control-sm text-center" style={{ width: '64px', marginTop: 0, borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s' }} value={form.version ?? 1} />
                    </div>
                    {form.tipoPresupuesto === 'TRABAJOS_SEMANALES' ? (
                      <div className="col-md-3 d-flex flex-column justify-content-center align-items-center" style={{gap: '4px'}}>
                        <label className="form-label fw-bold w-100 text-center mb-1" style={{color: "#000", marginTop: '32px'}}>Estado</label>
                        {form.estado === 'APROBADO' ? (
                          <div className="form-control text-center d-flex align-items-center justify-content-center" style={{marginTop: 0, background: '#d4edda', color: '#155724', fontWeight: 'bold'}}>
                            ✅ Aprobado
                          </div>
                        ) : (
                          <div className="form-control text-center d-flex align-items-center justify-content-center" style={{marginTop: 0, background: '#fff3cd', color: '#856404', fontWeight: 'bold'}}>
                            📋 OBRA A CONFIRMAR
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="col-md-3 d-flex flex-column justify-content-center align-items-center" style={{gap: '4px'}}>
                        <label className="form-label fw-bold w-100 text-center mb-1" style={{color: "#000", marginTop: '32px'}}>Estado</label>
                        <input name="estado" className="form-control text-center" type="text" value={form.estado || ''} onChange={handleChange} disabled={soloLectura || editarSoloFechas} style={{marginTop: 0, borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}} />
                      </div>
                    )}
                    <div className="col-md-2 d-flex flex-column justify-content-center align-items-center" style={{gap: '4px'}}>
                      <label className="form-label fw-bold w-100 text-center mb-1" style={{color: "#000"}} title="La obra cambiará automáticamente a TERMINADO al cumplirse este plazo (solo días hábiles: lunes a viernes)">
                        Días Hábiles para final de Obra
                        <i className="bi bi-info-circle ms-1 text-primary" style={{fontSize: '0.9em'}}></i>
                      </label>
                      {/* ✨ Switch para activar/desactivar cálculo automático */}
                      <div className="mb-2 d-flex align-items-center justify-content-center gap-2" style={{paddingLeft: 0}}>
                        <label
                          className="small fw-bold mb-0"
                          htmlFor="calculoAutomaticoSwitch"
                          style={{
                            cursor: soloLectura ? 'not-allowed' : 'pointer',
                            color: '#28a745', // Verde siempre
                            fontSize: '0.85em'
                          }}
                        >
                          🤖 Automático
                        </label>
                        <div className="form-check form-switch mb-0">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="calculoAutomaticoSwitch"
                            checked={!(form.calculoAutomaticoDiasHabiles ?? true)}
                            onChange={(e) => {
                              const nuevoValor = !e.target.checked;
                              setForm(prev => ({
                                ...prev,
                                calculoAutomaticoDiasHabiles: nuevoValor
                              }));

                              // Si se activa el cálculo automático, actualizar inmediatamente
                              if (nuevoValor) {
                                const { total } = calcularDiasHabilesAutomatico();
                                setForm(prev => ({
                                  ...prev,
                                  calculoAutomaticoDiasHabiles: nuevoValor,
                                  tiempoEstimadoTerminacion: total
                                }));
                              }
                            }}
                            disabled={soloLectura}
                            style={{
                              cursor: soloLectura ? 'not-allowed' : 'pointer',
                              transform: 'scale(1.2)'
                            }}
                          />
                          <style>{`
                            #calculoAutomaticoSwitch:checked {
                              background-color: #0d6efd !important;
                              border-color: #0d6efd !important;
                              background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='3' fill='%23fff'/%3e%3c/svg%3e") !important;
                            }
                            #calculoAutomaticoSwitch:not(:checked) {
                              background-color: #28a745 !important;
                              border-color: #28a745 !important;
                              background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='3' fill='%23fff'/%3e%3c/svg%3e") !important;
                            }
                          `}</style>
                        </div>
                        <label
                          className="small fw-bold mb-0"
                          htmlFor="calculoAutomaticoSwitch"
                          style={{
                            cursor: soloLectura ? 'not-allowed' : 'pointer',
                            color: '#0d6efd', // Azul siempre
                            fontSize: '0.85em'
                          }}
                        >
                          ✏️ Manual
                        </label>
                      </div>
                      <input
                        name="tiempoEstimadoTerminacion"
                        className="form-control form-control-sm text-center"
                        type="number"
                        min="0"
                        step="1"
                        value={(() => {
                          console.log('🔍 INPUT VALUE - calculoAutomaticoDiasHabiles:', form.calculoAutomaticoDiasHabiles, 'tipo:', typeof form.calculoAutomaticoDiasHabiles);
                          // 🎯 Si está en modo automático, mostrar siempre el valor calculado
                          if (form.calculoAutomaticoDiasHabiles === true) {
                            const { total } = calcularDiasHabilesAutomatico();
                            return total || '';
                          }
                          // 🎯 Si está en modo manual, mostrar el valor del estado
                          return form.tiempoEstimadoTerminacion ?? '';
                        })()}
                        onChange={(e) => {
                          if (form.calculoAutomaticoDiasHabiles !== true) {
                            setTiempoPlaceholderVisible(false);
                            handleChange(e);
                          }
                        }}
                        onFocus={(e) => {
                          // Prevenir focus si está en modo automático
                          if (form.calculoAutomaticoDiasHabiles === true) {
                            e.target.blur();
                            return;
                          }
                          setTiempoPlaceholderVisible(false);
                        }}
                        onClick={(e) => {
                          // Prevenir clicks si está en modo automático
                          if (form.calculoAutomaticoDiasHabiles === true) {
                            e.preventDefault();
                            return false;
                          }
                        }}
                        onBlur={async (e) => {
                          if (e.target.value === '' || e.target.value == null) {
                            setTiempoPlaceholderVisible(true);
                          }

                          // ✅ Guardar automáticamente si cambió el valor Y está en modo manual
                          // ✨ HABILITADO PARA TRABAJOS EXTRA TAMBIÉN
                          // El usuario solicitó explícitamente poder configurar la planificación en Trabajos Extra

                          if (form.calculoAutomaticoDiasHabiles !== true && form.id && e.target.value && e.target.value !== String(initialData?.tiempoEstimadoTerminacion)) {
                            console.log('🔄 Guardando tiempoEstimadoTerminacion automáticamente...');
                            console.log('   Valor anterior:', initialData?.tiempoEstimadoTerminacion);
                            console.log('   Valor nuevo:', e.target.value);

                            // ✅ Usar endpoint específico PATCH /fechas
                            const datosActualizarFechas = {
                              fechaProbableInicio: form.fechaProbableInicio,
                              tiempoEstimadoTerminacion: parseInt(e.target.value, 10)
                            };
                            try {
                              const resultado = await apiService.presupuestosNoCliente.actualizarSoloFechas(
                                form.id,
                                datosActualizarFechas,
                                empresaSeleccionada?.id
                              );
                              console.log('✅ tiempoEstimadoTerminacion guardado automáticamente:', e.target.value);
                              console.log('✅ Respuesta del backend:', resultado);
                            } catch (error) {
                              console.error('❌ Error al guardar tiempoEstimadoTerminacion:', error);
                              console.error('❌ Detalle:', error.response?.data);
                            }
                          }
                        }}
                        placeholder={tiempoPlaceholderVisible ? 'Tiempo en días' : ''}
                        style={{
                          maxWidth: '160px',
                          marginTop: 0,
                          backgroundColor: (form.calculoAutomaticoDiasHabiles === true) ? '#e9f7ef' : (editarSoloFechas ? '#fff3cd' : '#e7f3ff'),
                          fontWeight: editarSoloFechas ? 'bold' : 'normal',
                          border: (form.calculoAutomaticoDiasHabiles === true) ? '3px solid #28a745' : '3px solid #0d6efd',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          fontSize: '0.95rem',
                          transition: 'all 0.2s',
                          cursor: (soloLectura || form.calculoAutomaticoDiasHabiles === true) ? 'not-allowed' : 'text',
                          pointerEvents: (form.calculoAutomaticoDiasHabiles === true) ? 'none' : 'auto'
                        }}
                        disabled={soloLectura || (form.calculoAutomaticoDiasHabiles === true)}
                        readOnly={form.calculoAutomaticoDiasHabiles === true}
                        title={(form.calculoAutomaticoDiasHabiles === true) ? '🤖 Calculado automáticamente desde jornales marcados' : '✏️ Ingrese manualmente los días hábiles'}
                      />
                      {calcularFechaFinEstimada() && (
                        <div className="small text-success mt-1" style={{fontSize: '0.85em'}}>
                          🏁 Finaliza: {new Date(calcularFechaFinEstimada()).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </div>
                      )}
                      {/* 🎯 NUEVO: Mostrar desglose de cálculo automático */}
                      {(() => {
                        const { total, desglose } = calcularDiasHabilesAutomatico();
                        if (total > 0 && desglose.length > 0) {
                          return (
                            <div className="small text-muted mt-1" style={{fontSize: '0.75em'}}>
                              <div
                                className={`badge ${form.calculoAutomaticoDiasHabiles ? 'bg-success' : 'bg-info'} text-white`}
                                style={{cursor: 'help', fontSize: '0.8em'}}
                                title={`Suma de jornales marcados:\n${desglose.map(d => `• ${d.rubro}: ${d.jornales} días\n  ${d.explicacion}`).join('\n')}`}
                              >
                                <i className="fas fa-calculator me-1"></i>
                                Calculado: {total} días
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </div>

                {/* Badge informativo sobre cambios automáticos de estado */}
                {(form.estado === 'APROBADO' || form.estado === 'EN_EJECUCION') && form.fechaProbableInicio && (
                  <div className="col-12 mt-2">
                    <div className="alert alert-info py-2 mb-0" style={{fontSize: '0.9em'}}>
                      <i className="bi bi-clock-history me-2"></i>
                      <strong>Cambios automáticos:</strong>
                      {form.estado === 'APROBADO' && (
                        <span> Esta obra cambiará automáticamente a <strong>EN EJECUCION</strong> el {(() => {
                          const [year, month, day] = form.fechaProbableInicio.split('-').map(Number);
                          const fecha = new Date(year, month - 1, day);
                          return fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                        })()} a las 00:00.</span>
                      )}
                      {form.estado === 'EN_EJECUCION' && form.tiempoEstimadoTerminacion && calcularFechaFinEstimada() && (
                        <span> Esta obra cambiará automáticamente a <strong>TERMINADO</strong> el {new Date(calcularFechaFinEstimada()).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })} a las 00:00.</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="col-12 mt-1">
                  <div className="row g-0">
                    <div className="col-12">
                      <label className="form-label fw-bold w-100" style={{color: "#000", marginBottom: 6}}>Descripción
                        <textarea name="descripcion" className="form-control w-100" value={form.descripcion} onChange={handleChange} rows={2} style={{ minHeight: '50px', marginTop: 4, borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s' }} disabled={soloLectura}></textarea>
                      </label>
                    </div>
                  </div>
                  <div className="row g-0 mt-2">
                    <div className="col-12">
                      <label className="form-label fw-bold w-100" style={{color: "#000", marginBottom: 6}}>Observaciones
                        <textarea name="observaciones" className="form-control w-100" value={form.observaciones} onChange={handleChange} rows={2} style={{ minHeight: '50px', marginTop: 4, borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s' }} disabled={soloLectura}></textarea>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Separador visual */}
                <hr className="my-5" style={{border: '3px solid #6c757d'}} />

                {/* ========== CÁLCULO INICIAL DE METROS CUADRADOS ========== */}
                {/* Sección de importación desde items existentes */}
                {false && !soloLectura && (
                  <div className="mt-4 border-top pt-3">
                    <div className="border rounded p-3" style={{backgroundColor: '#f5e6d3'}}>
                      <h6
                        className="mb-3"
                        style={{color: '#8b4513', fontWeight: 'bold', cursor: 'pointer'}}
                        onClick={() => setMostrarImportarItems(!mostrarImportarItems)}
                      >
                        <i className="fas fa-upload me-2"></i>
                        📥 Configuración para importar Profesionales, Materiales, Gastos Generales Existentes
                        <span className="ms-2 small">{mostrarImportarItems ? '▼' : '▶'}</span>
                      </h6>

                      {mostrarImportarItems && (
                        <>
                          <p className="small text-muted mb-3">
                            Si ya agregó profesionales, materiales o gastos generales, puede calcular automáticamente el presupuesto base a partir de esos datos.
                          </p>
                          <button
                            type="button"
                            className="btn btn-warning w-100"
                            onClick={calcularDesdeItems}
                          >
                            <i className="fas fa-calculator me-2"></i>
                            Calcular desde Profesionales, Materiales y Gastos Generales
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Sección de cálculo manual por metros cuadrados */}
                {false && !soloLectura && (
                  <div className="mt-4 border rounded p-3" style={{backgroundColor: '#d4edda'}}>
                    <h6
                      className="mb-3 text-success"
                      style={{cursor: 'pointer', fontWeight: 'bold'}}
                      onClick={() => setMostrarMetrosCuadrados(!mostrarMetrosCuadrados)}
                    >
                      <i className="fas fa-calculator me-2"></i>
                      📐 Configuración de Cálculo Inicial por Metros Cuadrados
                      <span className="ms-2 small">{mostrarMetrosCuadrados ? '▼' : '▶'}</span>
                    </h6>

                    {mostrarMetrosCuadrados && (
                        <>
                          <div className="text-center mb-3">
                            <span className="badge bg-secondary">Ingrese manualmente:</span>
                          </div>

                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label fw-bold">Metros Cuadrados (m²)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-control"
                            value={metrosCuadradosInicial}
                            onChange={(e) => setMetrosCuadradosInicial(e.target.value)}
                            placeholder="Ej: 50.00"
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label fw-bold">Importe Promedio por m²</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-control"
                            value={importePorMetroInicial}
                            onChange={(e) => setImportePorMetroInicial(e.target.value)}
                            placeholder="Ej: 1200000"
                          />
                        </div>
                      </div>

                      {/* Distribución por porcentajes - SIEMPRE DESPUÉS DE METROS CUADRADOS */}
                      <div className="mt-4 pt-3 border-top">
                        <h6 className="mb-3 text-primary">
                          <i className="fas fa-percentage me-2"></i>
                          Distribución por Porcentajes
                        </h6>
                        <div className="row g-3">
                          <div className="col-md-4">
                            <label className="form-label fw-bold">% Profesionales</label>
                            <div className="input-group">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                className="form-control"
                                value={porcentajeProfesionales}
                                onChange={(e) => setPorcentajeProfesionales(e.target.value)}
                                onFocus={(e) => {
                                  if (e.target.value === '0' || e.target.value === '0.00') {
                                    setPorcentajeProfesionales('');
                                  }
                                }}
                                placeholder="0"
                              />
                              <span className="input-group-text">%</span>
                            </div>
                            {metrosCuadradosInicial && importePorMetroInicial && porcentajeProfesionales && (
                              <small className="text-muted d-block mt-1">
                                💼 ${((Number(metrosCuadradosInicial) * Number(importePorMetroInicial) * Number(porcentajeProfesionales)) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </small>
                            )}
                          </div>
                          <div className="col-md-4">
                            <label className="form-label fw-bold">% Materiales</label>
                            <div className="input-group">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                className="form-control"
                                value={porcentajeMateriales}
                                onChange={(e) => setPorcentajeMateriales(e.target.value)}
                                onFocus={(e) => {
                                  if (e.target.value === '0' || e.target.value === '0.00') {
                                    setPorcentajeMateriales('');
                                  }
                                }}
                                placeholder="0"
                              />
                              <span className="input-group-text">%</span>
                            </div>
                            {metrosCuadradosInicial && importePorMetroInicial && porcentajeMateriales && (
                              <small className="text-muted d-block mt-1">
                                🧱 ${((Number(metrosCuadradosInicial) * Number(importePorMetroInicial) * Number(porcentajeMateriales)) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </small>
                            )}
                          </div>
                          <div className="col-md-4">
                            <label className="form-label fw-bold">% Gastos Generales</label>
                            <div className="input-group">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                className="form-control"
                                value={porcentajeOtrosCostos}
                                onChange={(e) => setPorcentajeOtrosCostos(e.target.value)}
                                onFocus={(e) => {
                                  if (e.target.value === '0' || e.target.value === '0.00') {
                                    setPorcentajeOtrosCostos('');
                                  }
                                }}
                                placeholder="0"
                              />
                              <span className="input-group-text">%</span>
                            </div>
                            {metrosCuadradosInicial && importePorMetroInicial && porcentajeOtrosCostos && (
                              <small className="text-muted d-block mt-1">
                                📦 ${((Number(metrosCuadradosInicial) * Number(importePorMetroInicial) * Number(porcentajeOtrosCostos)) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </small>
                            )}
                          </div>
                        </div>
                        {porcentajeProfesionales && porcentajeMateriales && porcentajeOtrosCostos && (
                          <div className="mt-2">
                            {(() => {
                              const suma = Number(porcentajeProfesionales || 0) + Number(porcentajeMateriales || 0) + Number(porcentajeOtrosCostos || 0);
                              const diferencia = Math.abs(100 - suma);
                              if (suma === 100) {
                                return <small className="text-success">✅ Suma total: 100%</small>;
                              } else if (suma > 100) {
                                return <small className="text-danger">⚠️ La suma excede el 100% ({suma.toFixed(2)}%)</small>;
                              } else {
                                return <small className="text-warning">⚠️ Falta {diferencia.toFixed(2)}% para llegar al 100%</small>;
                              }
                            })()}
                          </div>
                        )}
                      </div>

                      {/* Total estimado */}
                      {metrosCuadradosInicial && importePorMetroInicial && (
                        <div className="alert alert-success mt-3">
                          <strong>💰 Total Estimado Base:</strong> ${(Number(metrosCuadradosInicial || 0) * Number(importePorMetroInicial || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      )}

                      {/* Botones de acción */}
                      <div className="mt-4 d-flex gap-2 justify-content-end">
                        {datosMetrosCuadradosGuardados && (
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            onClick={limpiarDatosMetrosCuadrados}
                          >
                            🗑️ Limpiar
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-success btn-sm"
                          onClick={guardarDatosMetrosCuadrados}
                          disabled={!metrosCuadradosInicial || !importePorMetroInicial}
                        >
                          {datosMetrosCuadradosGuardados ? '💾 Actualizar' : '✓ Aceptar y Guardar'}
                        </button>
                      </div>

                      {/* Resumen de datos guardados */}
                      {datosMetrosCuadradosGuardados && (
                        <div className="mt-3 alert alert-info">
                          <strong>📋 Datos Guardados:</strong>
                          <div className="small mt-2">
                            <div>📐 {datosMetrosCuadradosGuardados.metrosCuadrados} m² × ${Number(datosMetrosCuadradosGuardados.importePorMetro).toLocaleString('es-AR', { minimumFractionDigits: 2 })}/m² = <strong>${datosMetrosCuadradosGuardados.totalEstimado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong></div>
                            {datosMetrosCuadradosGuardados.porcentajeProfesionales > 0 && (
                              <div className="mt-1">💼 Profesionales ({datosMetrosCuadradosGuardados.porcentajeProfesionales}%): ${datosMetrosCuadradosGuardados.montoProfesionales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                            )}
                            {datosMetrosCuadradosGuardados.porcentajeMateriales > 0 && (
                              <div className="mt-1">🧱 Materiales ({datosMetrosCuadradosGuardados.porcentajeMateriales}%): ${datosMetrosCuadradosGuardados.montoMateriales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                            )}
                            {datosMetrosCuadradosGuardados.porcentajeOtrosCostos > 0 && (
                              <div className="mt-1">💼 Gastos Generales ({datosMetrosCuadradosGuardados.porcentajeOtrosCostos}%): ${datosMetrosCuadradosGuardados.montoOtrosCostos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Indicadores de consumo y disponibilidad */}
                      {datosMetrosCuadradosGuardados && (
                        <div className="mt-3">
                          <h6 className="mb-3">📊 Control de Presupuesto</h6>

                          {/* Profesionales */}
                          {datosMetrosCuadradosGuardados.porcentajeProfesionales > 0 && (() => {
                            const presupuestado = datosMetrosCuadradosGuardados.montoProfesionales;
                            const consumido = totalFinalProfesionales + honorariosActuales.profesionales;
                            const disponible = presupuestado - consumido;
                            const porcentajeConsumido = presupuestado > 0 ? (consumido / presupuestado) * 100 : 0;

                            return (
                              <div className="mb-3">
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                  <span className="fw-bold">💼 Profesionales</span>
                                  <span className="small">
                                    <span className={disponible >= 0 ? 'text-success' : 'text-danger'}>
                                      Disponible: ${disponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                    </span>
                                  </span>
                                </div>
                                <div className="progress" style={{height: '25px'}}>
                                  <div
                                    className={`progress-bar ${porcentajeConsumido > 100 ? 'bg-danger' : porcentajeConsumido > 80 ? 'bg-warning' : 'bg-success'}`}
                                    style={{width: `${Math.min(porcentajeConsumido, 100)}%`}}
                                  >
                                    {porcentajeConsumido.toFixed(1)}%
                                  </div>
                                </div>
                                <div className="d-flex justify-content-between small text-muted mt-1">
                                  <span>Consumido: ${consumido.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                  <span>Presupuestado: ${presupuestado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Materiales */}
                          {datosMetrosCuadradosGuardados.porcentajeMateriales > 0 && (() => {
                            const presupuestado = datosMetrosCuadradosGuardados.montoMateriales;
                            const consumido = totalFinalMateriales + honorariosActuales.materiales;
                            const disponible = presupuestado - consumido;
                            const porcentajeConsumido = presupuestado > 0 ? (consumido / presupuestado) * 100 : 0;

                            return (
                              <div className="mb-3">
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                  <span className="fw-bold">🧱 Materiales</span>
                                  <span className="small">
                                    <span className={disponible >= 0 ? 'text-success' : 'text-danger'}>
                                      Disponible: ${disponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                    </span>
                                  </span>
                                </div>
                                <div className="progress" style={{height: '25px'}}>
                                  <div
                                    className={`progress-bar ${porcentajeConsumido > 100 ? 'bg-danger' : porcentajeConsumido > 80 ? 'bg-warning' : 'bg-success'}`}
                                    style={{width: `${Math.min(porcentajeConsumido, 100)}%`}}
                                  >
                                    {porcentajeConsumido.toFixed(1)}%
                                  </div>
                                </div>
                                <div className="d-flex justify-content-between small text-muted mt-1">
                                  <span>Consumido: ${consumido.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                  <span>Presupuestado: ${presupuestado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Gastos Generales */}
                          {datosMetrosCuadradosGuardados.porcentajeOtrosCostos > 0 && (() => {
                            const presupuestado = datosMetrosCuadradosGuardados.montoOtrosCostos;
                            const consumido = totalFinalOtrosCostos + honorariosActuales.otrosCostos;
                            const disponible = presupuestado - consumido;
                            const porcentajeConsumido = presupuestado > 0 ? (consumido / presupuestado) * 100 : 0;

                            return (
                              <div className="mb-3">
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                  <span className="fw-bold">💼 Gastos Generales</span>
                                  <span className="small">
                                    <span className={disponible >= 0 ? 'text-success' : 'text-danger'}>
                                      Disponible: ${disponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                    </span>
                                  </span>
                                </div>
                                <div className="progress" style={{height: '25px'}}>
                                  <div
                                    className={`progress-bar ${porcentajeConsumido > 100 ? 'bg-danger' : porcentajeConsumido > 80 ? 'bg-warning' : 'bg-success'}`}
                                    style={{width: `${Math.min(porcentajeConsumido, 100)}%`}}
                                  >
                                    {porcentajeConsumido.toFixed(1)}%
                                  </div>
                                </div>
                                <div className="d-flex justify-content-between small text-muted mt-1">
                                  <span>Consumido: ${consumido.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                  <span>Presupuestado: ${presupuestado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Resumen total */}
                          {(() => {
                            const totalPresupuestado = datosMetrosCuadradosGuardados.totalEstimado;
                            const totalConsumidoProfesionales = totalFinalProfesionales;
                            const totalConsumidoMateriales = totalFinalMateriales;
                            const totalConsumidoOtros = totalFinalOtrosCostos;
                            const totalConsumido = totalFinalConTodo; // Incluye base + mayor costos + honorarios
                            const totalDisponible = totalPresupuestado - totalConsumido;
                            const porcentajeTotalConsumido = totalPresupuestado > 0 ? (totalConsumido / totalPresupuestado) * 100 : 0;

                            return (
                              <div className="border-top pt-3 mt-3">
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                  <span className="fw-bold fs-6">🎯 TOTAL GENERAL</span>
                                  <span className="fw-bold">
                                    <span className={totalDisponible >= 0 ? 'text-success' : 'text-danger'}>
                                      Disponible: ${totalDisponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                    </span>
                                  </span>
                                </div>
                                <div className="progress" style={{height: '30px'}}>
                                  <div
                                    className={`progress-bar ${porcentajeTotalConsumido > 100 ? 'bg-danger' : porcentajeTotalConsumido > 80 ? 'bg-warning' : 'bg-success'}`}
                                    style={{width: `${Math.min(porcentajeTotalConsumido, 100)}%`}}
                                  >
                                    <strong>{porcentajeTotalConsumido.toFixed(1)}%</strong>
                                  </div>
                                </div>
                                <div className="d-flex justify-content-between small mt-1">
                                  <span className="fw-bold">Consumido: ${totalConsumido.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                  <span className="fw-bold">Presupuestado: ${totalPresupuestado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                        </>
                      )}
                  </div>
                )}

                {/* Contenedor flex para reordenar visualmente las secciones */}
                <div style={{display: 'flex', flexDirection: 'column'}}>

                {/* Bloque unificado de Items del Presupuesto */}
                {/* ===ITEMS_MOVIDOS_AQUI=== */}

                {/* ===MARCADOR_TEMPORAL_FIN_MAYORES_COSTOS=== */}

                {/* Configuración del Presupuesto (solo presupuestos, sin honorarios) */}
                {false && (
                <div className="mt-4 border rounded p-3" style={{backgroundColor: '#e7d4f5'}}>
                  <h6
                    className="mb-2"
                    style={{cursor: 'pointer', fontWeight: 'bold', color: '#7b2cbf'}}
                    onClick={() => setMostrarConfiguracionPresupuesto(!mostrarConfiguracionPresupuesto)}
                  >
                    <i className="fas fa-cog me-2"></i>
                    Configuración de Presupuesto Global para Profesionales, Materiales, Otros Costos
                    <span className="ms-2 small">{mostrarConfiguracionPresupuesto ? '▼' : '▶'}</span>
                  </h6>

                  {mostrarConfiguracionPresupuesto && (
                      <ConfiguracionPresupuestoSection
                        configsProfesionales={configsProfesionales}
                        configsMateriales={configsMateriales}
                        configsOtros={configsOtros}
                        profesionalesAgregados={form.profesionales}
                        materialesAgregados={form.materiales}
                        otrosCostosAgregados={form.otrosCostos}
                        onConfigsChange={handleConfigsChange}
                        soloLectura={soloLectura}
                        mostrarSolo="presupuestos"
                        presupuestoSugeridoProfesionales={metrosCuadradosInicial && importePorMetroInicial && porcentajeProfesionales ?
                          (Number(metrosCuadradosInicial) * Number(importePorMetroInicial) * Number(porcentajeProfesionales)) / 100 : null}
                        presupuestoSugeridoMateriales={metrosCuadradosInicial && importePorMetroInicial && porcentajeMateriales ?
                          (Number(metrosCuadradosInicial) * Number(importePorMetroInicial) * Number(porcentajeMateriales)) / 100 : null}
                        presupuestoSugeridoOtros={metrosCuadradosInicial && importePorMetroInicial && porcentajeOtrosCostos ?
                          (Number(metrosCuadradosInicial) * Number(importePorMetroInicial) * Number(porcentajeOtrosCostos)) / 100 : null}
                      />
                    )}
                </div>
                )}

                {/* ===BLOQUE_ITEMS_ORIGINAL_ELIMINAR=== */}
                {/* Bloque unificado de Items del Presupuesto */}
                <div className={`mt-3 border rounded p-3 ${ocultarConfiguracionEnPDF ? 'ocultar-en-pdf' : ''}`} style={{ backgroundColor: '#fff3cd', order: 1 }}>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6
                      className="mb-0"
                      style={{cursor: 'pointer', fontWeight: 'bold', color: '#ff8c42'}}
                      onClick={() => setMostrarItemsPresupuesto(!mostrarItemsPresupuesto)}
                    >
                      <i className="fas fa-list-ul me-2"></i>
                      Configuración de Presupuesto por Jornales, Materiales, Otros Costos
                      <span className="ms-2 small">{mostrarItemsPresupuesto ? '▼' : '▶'}</span>
                    </h6>

                    {/* Checkbox para ocultar en PDF */}
                    <div className="form-check form-switch" onClick={(e) => e.stopPropagation()}>
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="ocultarConfiguracionEnPDF"
                        checked={ocultarConfiguracionEnPDF}
                        onChange={(e) => setOcultarConfiguracionEnPDF(e.target.checked)}
                        title="Si está marcado, esta sección NO aparecerá en el PDF"
                      />
                      <label className="form-check-label small text-muted" htmlFor="ocultarConfiguracionEnPDF" title="Si está marcado, esta sección NO aparecerá en el PDF">
                        🔒 Ocultar en PDF
                      </label>
                    </div>
                  </div>

                {mostrarItemsPresupuesto && (
                  <>
                {/* NUEVA SECCIÓN: Calculadora de Presupuesto */}
                <div className="mb-3 border rounded p-3 shadow-sm seccion-rubro" style={{backgroundColor: '#d4edda', borderColor: '#c3e6cb'}} data-section="calculadora">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6
                      className="mb-0"
                      style={{cursor: 'pointer', fontWeight: 'bold', color: '#155724'}}
                      onClick={() => {
                        setMostrarCalculadora(!mostrarCalculadora);
                      }}
                    >
                      <i className="fas fa-calculator me-2"></i>
                      Agregar Rubro con Jornales - Materiales - Gastos Generales
                      <span className="ms-2 small">{mostrarCalculadora ? '▼' : '▶'}</span>
                    </h6>
                  </div>

                  {mostrarCalculadora && (
                  <>
                  {/* Formulario de calculadora */}
                  <div className="border rounded p-3 bg-light">
                    <div className="row g-2">

                      {/* 📝 SECCIÓN: Información Básica del Rubro */}
                      <div className="col-md-12">
                        <div className="border rounded p-3 mb-3" style={{backgroundColor: '#f0f8f0', borderColor: '#a8d8a8'}}>
                          <h6 className="mb-3 small" style={{fontWeight: 'bold', color: '#0f5132'}}>
                            <i className="fas fa-info-circle me-2"></i>
                            Información Básica del Rubro
                            {tipoProfesionalCalc && (
                              <span className="ms-2" style={{fontSize: '1.2rem', fontWeight: 'bold'}}>
                                - {tipoProfesionalCalc}
                              </span>
                            )}
                          </h6>

                          {/* Rubro */}
                          <div className="mb-3">
                            <label className="form-label small mb-1 fw-bold">Rubro</label>
                            <div className="input-group">
                              {itemEditandoId && (
                                <span className="input-group-text bg-warning text-dark">
                                  <i className="fas fa-edit"></i>
                                </span>
                              )}
                              <input
                                type="text"
                                className={`form-control form-control-sm ${itemEditandoId ? 'bg-warning bg-opacity-10' : ''}`}
                                value={tipoProfesionalCalc}
                                onChange={handleRubroChange}
                                onFocus={() => {
                                  setProfesionalesAgregados(false);
                                  setMaterialesAgregados(false);
                                  setGastosGeneralesAgregados(false);
                                }}
                                placeholder={itemEditandoId ? "Editando rubro existente..." : "Ej: Mampostería, Excavación, Instalación eléctrica..."}
                                disabled={itemEditandoId && tipoProfesionalCalc?.toLowerCase().includes('gasto general')}
                              />

                              {itemEditandoId && (
                                <button
                                  type="button"
                                  className="btn btn-outline-primary btn-sm"
                                  onClick={iniciarNuevoRubro}
                                  title="Limpiar formulario para crear un nuevo rubro"
                                >
                                  <i className="fas fa-file me-1"></i>
                                  Nuevo Rubro
                                </button>
                              )}
                            </div>
                            <div className="small text-muted mt-1">
                              <i className="fas fa-info-circle me-1"></i>
                              {itemEditandoId && tipoProfesionalCalc?.toLowerCase().includes('gasto general')
                                ? 'Use la sección "Gastos Generales" más abajo para agregar gastos'
                                : 'Cree rubros vacíos primero, después edítelos para agregar detalles'}
                            </div>
                          </div>

                          {/* Descripción Detallada */}
                          <div className="mb-3">
                            <label className="form-label small mb-1 fw-bold">Descripción Detallada</label>
                            <textarea
                              name="descripcion"
                              className="form-control w-100"
                              rows="2"
                              style={{minHeight: '50px'}}
                              value={descripcionCalc}
                              onChange={(e) => setDescripcionCalc(e.target.value)}
                              placeholder="Detalle específico del trabajo a realizar..."
                            />
                          </div>

                          {/* Observaciones */}
                          <div className="mb-3">
                            <label className="form-label fw-bold w-100" style={{color: 'rgb(0, 0, 0)'}}>
                              Observaciones
                              <textarea
                                name="observaciones"
                                className="form-control w-100"
                                rows="2"
                                style={{minHeight: '50px'}}
                                value={observacionesCalc}
                                onChange={(e) => setObservacionesCalc(e.target.value)}
                                placeholder="Observaciones especiales, consideraciones adicionales..."
                              />
                            </label>
                          </div>

                          {/* Botón dual: Crear Rubro / Guardar Cambios */}
                          <div className="d-flex gap-2 mb-2">
                            <button
                              type="button"
                              className={`btn btn-sm ${itemEditandoId ? 'btn-success' : (rubroCreado ? 'btn-success' : 'btn-outline-success')}`}
                              onClick={itemEditandoId ? guardarCambiosRubro : crearRubroVacio}
                              title={itemEditandoId ? 'Guardar cambios en descripción y observaciones' : (rubroCreado ? 'Rubro creado exitosamente' : 'Crear rubro vacío para estructurar el presupuesto')}
                              disabled={!tipoProfesionalCalc.trim() || (rubroCreado && !itemEditandoId)}
                            >
                              <i className={`fas ${itemEditandoId ? 'fa-save' : (rubroCreado ? 'fa-check' : 'fa-plus-circle')} me-1`}></i>
                              {itemEditandoId ? 'Guardar Cambios' : (rubroCreado ? '✓ Rubro Creado' : 'Crear Rubro')}
                            </button>
                            {itemEditandoId && (
                              <button
                                type="button"
                                className="btn btn-outline-primary btn-sm"
                                onClick={iniciarNuevoRubro}
                                title="Limpiar formulario para crear un nuevo rubro"
                              >
                                <i className="fas fa-file me-1"></i>
                                Nuevo Rubro
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* ✨ NUEVA SECCIÓN: Jornales */}
                      {!itemsCalculadora.find(i => i.id === itemEditandoId)?.esGastoGeneral && (
                      <div className="col-md-12">
                        <div className="border rounded p-3 mt-2" style={{backgroundColor: '#fff9e6', borderColor: '#ffd966'}}>
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <div
                              className="d-flex align-items-center"
                              style={{cursor: 'pointer'}}
                              onClick={() => setJornalesSectionOpen(!jornalesSectionOpen)}
                            >
                              <i className={`fas fa-chevron-${jornalesSectionOpen ? 'down' : 'right'} me-2`}></i>
                              <h6 className="mb-0 small" style={{fontWeight: 'bold', color: '#8b6914'}}>
                                <i className="fas fa-hard-hat me-2"></i>
                                Jornales
                                {tipoProfesionalCalc && (
                                  <span className="ms-2" style={{fontSize: '1.2rem', fontWeight: 'bold'}}>
                                    - {tipoProfesionalCalc}
                                  </span>
                                )}
                              </h6>
                            </div>

                            {/* SWITCH DE MODO DE CARGA (Visible solo si está expandido) */}
                            {jornalesSectionOpen && (
                            <div className="form-check form-switch custom-switch-presupuesto">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id="switchModoCargaJornales"
                                checked={modoCargaJornales === 'global'}
                                onChange={(e) => {
                                  if (jornalesCalc.length > 0 && confirm('Cambiar de modo borrará los jornales ya ingresados. ¿Desea continuar?')) {
                                    setJornalesCalc([]);
                                    setModoCargaJornales(e.target.checked ? 'global' : 'detalle');
                                  } else if (jornalesCalc.length === 0) {
                                    setModoCargaJornales(e.target.checked ? 'global' : 'detalle');
                                  }
                                }}
                                disabled={jornalesAgregados}
                              />
                              <label className="form-check-label small fw-bold text-muted ps-1" htmlFor="switchModoCargaJornales">
                                {modoCargaJornales === 'global' ? 'Modo Global (Un solo importe)' : 'Modo Detallado (Por Item)'}
                              </label>
                            </div>
                            )}
                          </div>

                          {/* CONTENIDO COLAPSABLE */}
                          {jornalesSectionOpen && (
                          <div>
                            {/* Mensaje cuando ya se agregaron jornales */}
                            {jornalesAgregados && (
                              <div className="alert alert-success d-flex justify-content-between align-items-center mb-3">
                                <span><i className="fas fa-check-circle me-2"></i>Jornales agregados correctamente ({modoCargaJornales === 'global' ? 'Global' : 'Detallado'})</span>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => setJornalesAgregados(false)}
                                >
                                  <i className="fas fa-edit me-1"></i>Modificar Jornales
                                </button>
                              </div>
                            )}

                            {/* Formulario para agregar jornal */}
                            {!jornalesAgregados && (
                            <div className="border rounded p-3 mb-2 bg-light">

                              {/* Selector de Catálogo - Solo en modo DETALLE */}
                              {modoCargaJornales === 'detalle' && (
                              <div className="border rounded p-3 mb-2 bg-light">
                                <div>
                                  <div className="mb-3">
                                    <label className="form-label small fw-bold mb-1">📚 Seleccionar del Catálogo</label>
                                    <select
                                      className="form-select form-select-sm"
                                      value={selectorJornal}
                                      onChange={(e) => {
                                        const valor = e.target.value;
                                        setSelectorJornal(valor);

                                        if (valor && valor !== 'manual') {
                                          const jornalSeleccionado = catalogoJornales.find(j => j.id === parseInt(valor));
                                          if (jornalSeleccionado) {
                                            setJornalFormCalc({
                                              rol: jornalSeleccionado.nombre || jornalSeleccionado.descripcion,
                                              cantidadJornales: '1',
                                              importeJornal: jornalSeleccionado.precio || jornalSeleccionado.importe || ''
                                            });
                                          }
                                        }
                                      }}
                                    >
                                      <option value="">-- Seleccione un jornal --</option>
                                      {catalogoJornales.map(jornal => (
                                        <option key={jornal.id} value={jornal.id}>
                                          {jornal.nombre || jornal.descripcion} - ${(jornal.precio || jornal.importe || 0).toLocaleString('es-AR')}
                                        </option>
                                      ))}
                                      <option value="manual" style={{borderTop: '2px solid #ddd', fontWeight: 'bold'}}>➕ Agregar Manualmente</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                              )}

                              {/* CONDICIONAL: MODO GLOBAL vs MODO DETALLE */}
                              {modoCargaJornales === 'global' ? (
                                <div className="d-flex flex-row align-items-end gap-3 flex-wrap">
                                  <div style={{minWidth: '350px', flex: 1}}>
                                    <label className="form-label small mb-1">Descripción Global</label>
                                    <input
                                      type="text"
                                      className="form-control form-control-sm"
                                      value={globalJornales.descripcion}
                                      onChange={(e) => setGlobalJornales({...globalJornales, descripcion: e.target.value})}
                                      placeholder="Ej: Mano de obra global estimada para albañilería"
                                    />
                                  </div>
                                  <div style={{minWidth: '200px', maxWidth: '200px'}}>
                                    <label className="form-label small mb-1">Importe Total Estimado</label>
                                    <div className="input-group input-group-sm">
                                      <span className="input-group-text">$</span>
                                      <input
                                        type="number"
                                        className="form-control form-control-sm"
                                        value={globalJornales.importe}
                                        onChange={(e) => setGlobalJornales({...globalJornales, importe: e.target.value})}
                                        placeholder="0.00"
                                        min="0"
                                      />
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    className="btn btn-success btn-sm"
                                    onClick={() => {
                                      // Agregar item ficticio global a jornalesCalc
                                      if (!globalJornales.importe || Number(globalJornales.importe) <= 0) {
                                        alert('Debe ingresar un importe válido.');
                                        return;
                                      }

                                      const jornalGlobal = {
                                        id: Date.now(),
                                        rol: 'PRESUPUESTO GLOBAL - JORNALES',
                                        rolPersonalizado: globalJornales.descripcion,
                                        unidad: 'global',
                                        cantidadJornales: 1,
                                        cantidad: 1,
                                        importeJornal: Number(globalJornales.importe),
                                        valorUnitario: Number(globalJornales.importe),
                                        subtotal: Number(globalJornales.importe),
                                        sinCantidad: false,
                                        sinImporte: false,
                                        esGlobal: true // Marca para identificarlo
                                      };

                                      setJornalesCalc([jornalGlobal]);
                                      // setJornalesAgregados(true); // Opcional: auto-confirmar
                                    }}
                                    title="Establecer importe global"
                                    disabled={jornalesCalc.length > 0} // Solo permite un item global
                                  >
                                    <i className="fas fa-check"></i> Establecer
                                  </button>

                                  {jornalesCalc.length > 0 && (
                                     <button type="button" className="btn btn-warning btn-sm" onClick={() => setJornalesCalc([])} title="Limpiar importe global">
                                       <i className="fas fa-eraser"></i>
                                     </button>
                                  )}
                                </div>
                              ) : (
                                <div className="d-flex flex-row align-items-end gap-3 flex-wrap">
                                <div style={{minWidth: '200px', maxWidth: '200px'}}>
                                  <label className="form-label small mb-1">Rol *</label>
                                  <select
                                    className="form-select form-select-sm"
                                    value={jornalActualCalc.rol}
                                    onChange={handleRolChange}
                                  >
                                    <option value="">Seleccione un rol...</option>
                                    {(() => {
                                      const nombreRubro = tipoProfesionalCalc?.trim() || '';
                                      const gentilicio = convertirRubroAGentilicio(nombreRubro);
                                      const opcionesRoles = generarOpcionesRoles(gentilicio);

                                      return opcionesRoles.map(rol => (
                                        <option key={rol.value} value={rol.value}>
                                          {rol.label}
                                        </option>
                                      ));
                                    })()}
                                    <option value="Otro">Otro (personalizado)</option>
                                  </select>
                                </div>

                                {/* Input condicional para rol personalizado */}
                                {mostrarInputRolPersonalizado && (
                                  <div style={{minWidth: '200px', maxWidth: '200px'}}>
                                    <label className="form-label small mb-1">Nombre del Rol Completo *</label>
                                    <input
                                      type="text"
                                      className="form-control form-control-sm"
                                      value={jornalActualCalc.rolPersonalizado}
                                      onChange={handleRolPersonalizadoChange}
                                      placeholder={tipoProfesionalCalc ? `Ej: Oficial ${tipoProfesionalCalc}` : "Ej: Oficial Plomero"}
                                      maxLength="100"
                                    />
                                  </div>
                                )}

                                <div style={{minWidth: '100px', maxWidth: '100px'}}>
                                  <label className="form-label small mb-1">Cantidad de Jornales</label>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={jornalActualCalc.cantidadJornales}
                                    onChange={(e) => setJornalActualCalc({...jornalActualCalc, cantidadJornales: e.target.value})}
                                    placeholder="0"
                                    min="0"
                                    step="0.5"
                                  />
                                </div>
                                <div style={{minWidth: '120px', maxWidth: '120px'}}>
                                  <label className="form-label small mb-1">
                                    Importe x Jornal
                                    {jornalActualCalc.importeJornal && jornalActualCalc.importeJornal > 0 && (
                                      <span className="text-success ms-1" title="Autocompletado con promedio">
                                        <i className="fas fa-magic"></i>
                                      </span>
                                    )}
                                  </label>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={jornalActualCalc.importeJornal}
                                    onChange={(e) => setJornalActualCalc({...jornalActualCalc, importeJornal: e.target.value})}
                                    placeholder="0.00"
                                    min="0"
                                  />
                                </div>
                                <div style={{minWidth: '100px', maxWidth: '100px'}}>
                                  <label className="form-label small mb-1">Subtotal</label>
                                  <div className="form-control-plaintext small fw-bold text-success">
                                    ${((Number(jornalActualCalc.cantidadJornales) || 0) * (Number(jornalActualCalc.importeJornal) || 0)).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                  </div>
                                </div>
                          {/* Botón para agregar */}
                          <button type="button" className="btn btn-success btn-sm" onClick={agregarJornalCalc} title="Agregar este jornal a la lista del rubro">
                            <i className="fas fa-plus"></i>
                          </button>

                          {/* Botón para limpiar */}
                          <button type="button" className="btn btn-warning btn-sm" onClick={limpiarCamposJornal} title="Limpiar los campos del jornal">
                            <i className="fas fa-eraser"></i>
                          </button>
                        </div>
                              )}
                            </div>
                            )}

                            {/* Lista de jornales agregados */}
                            {jornalesCalc.length > 0 && (
                              <div className="table-responsive">
                                <table className="table table-sm table-bordered mb-0">
                                  <thead className="table-light">
                                    <tr key="jornales-header">
                                      <th className="small">Rol</th>
                                      <th className="small text-center">Cantidad</th>
                                      <th className="small text-end">Importe</th>
                                      <th className="small text-end">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {jornalesCalc.map((jornal) => (
                                      <tr key={jornal.id} className={jornal.sinCantidad || jornal.sinImporte ? 'table-warning' : ''}>
                                        <td className="small">
                                          {jornal.rol}
                                          {(jornal.sinCantidad || jornal.sinImporte) && (
                                            <div className="small text-warning mt-1">
                                              <i className="fas fa-exclamation-triangle me-1"></i>
                                              Datos incompletos
                                            </div>
                                          )}
                                        </td>
                                        <td className="small text-center">
                                          {jornal.sinCantidad ? (
                                            <span className="text-warning">
                                              <i className="fas fa-question-circle me-1"></i>Pendiente
                                            </span>
                                          ) : (
                                            jornal.cantidadJornales || jornal.cantidad
                                          )}
                                        </td>
                                        <td className="small text-end">
                                          {jornal.sinImporte ? (
                                            <span className="text-warning">
                                              <i className="fas fa-question-circle me-1"></i>Pendiente
                                            </span>
                                          ) : (
                                            `$${Number(jornal.importeJornal || jornal.valorUnitario).toLocaleString('es-AR', {minimumFractionDigits: 2})}`
                                          )}
                                        </td>
                                        <td className="small text-end fw-bold">
                                          {jornal.subtotal === 0 ? (
                                            <span className="text-muted">$0,00</span>
                                          ) : (
                                            `$${jornal.subtotal.toLocaleString('es-AR', {minimumFractionDigits: 2})}`
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                    <tr key="jornales-subtotal" className="table-warning">
                                      <td colSpan="3" className="small fw-bold text-end">SUBTOTAL JORNALES:</td>
                                      <td className="small fw-bold text-end">${subtotalJornales.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {/* Campos de descripción y observaciones para Jornales */}
                            <div className="row mt-3">
                              <div className="col-md-6">
                                <div className="mb-2">
                                  <label className="form-label small fw-bold text-muted mb-1">
                                    <i className="fas fa-align-left me-1"></i>
                                    Descripción
                                  </label>
                                  <textarea
                                    className="form-control form-control-sm"
                                    rows="3"
                                    placeholder="Descripción de los jornales..."
                                    value={descripcionJornales}
                                    onChange={(e) => setDescripcionJornales(e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="col-md-6">
                                <div className="mb-2">
                                  <label className="form-label small fw-bold text-muted mb-1">
                                    <i className="fas fa-sticky-note me-1"></i>
                                    Observaciones
                                  </label>
                                  <textarea
                                    className="form-control form-control-sm"
                                    rows="3"
                                    placeholder="Observaciones de los jornales..."
                                    value={observacionesJornales}
                                    onChange={(e) => setObservacionesJornales(e.target.value)}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Botón para agregar jornales al presupuesto */}
                            <div className="text-end mt-2">
                              <button
                                type="button"
                                className={`btn btn-sm ${jornalesAgregados ? 'btn-success' : 'btn-primary'}`}
                                onClick={() => {
                                  setTimeout(() => {
                                    agregarJornalCalculadora();
                                  }, 10);
                                }}
                                disabled={jornalesCalc.length === 0}
                              >
                                <i className={`fas ${jornalesAgregados ? 'fa-check' : 'fa-plus'} me-1`}></i>
                                {jornalesAgregados ? '✓ Jornales Agregados Correctamente' : 'Agregar Jornales al Presupuesto'}
                              </button>
                            </div>
                          </div>
                          )}
                        </div>
                      </div>
                      )}

                      {/* ✨ NUEVA SECCIÓN: Materiales */}
                      {!itemsCalculadora.find(i => i.id === itemEditandoId)?.esGastoGeneral && (
                      <div className="col-md-12">
                        <div className="border rounded p-3 mt-2" style={{backgroundColor: '#fff0f8', borderColor: '#f5a3d0'}}>
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <div
                              className="d-flex align-items-center"
                              style={{cursor: 'pointer'}}
                              onClick={() => setMaterialesSectionOpen(!materialesSectionOpen)}
                            >
                                <i className={`fas fa-chevron-${materialesSectionOpen ? 'down' : 'right'} me-2`}></i>
                                <h6 className="mb-0 small" style={{fontWeight: 'bold', color: '#6b2c5c'}}>
                                  <i className="fas fa-boxes me-2"></i>
                                  Materiales
                                  {tipoProfesionalCalc && (
                                    <span className="ms-2" style={{fontSize: '1.2rem', fontWeight: 'bold'}}>
                                      - {tipoProfesionalCalc}
                                    </span>
                                  )}
                                </h6>
                            </div>

                            {/* SWITCH DE MODO DE CARGA (Visible solo si está expandido) */}
                            {materialesSectionOpen && (
                            <div className="form-check form-switch custom-switch-presupuesto">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id="switchModoCargaMateriales"
                                checked={modoCargaMateriales === 'global'}
                                onChange={(e) => {
                                  if (materialesCalc.length > 0 && confirm('Cambiar de modo borrará los materiales ya ingresados. ¿Desea continuar?')) {
                                    setMaterialesCalc([]);
                                    setModoCargaMateriales(e.target.checked ? 'global' : 'detalle');
                                  } else if (materialesCalc.length === 0) {
                                    setModoCargaMateriales(e.target.checked ? 'global' : 'detalle');
                                  }
                                }}
                                disabled={materialesAgregados}
                              />
                              <label className="form-check-label small fw-bold text-muted ps-1" htmlFor="switchModoCargaMateriales">
                                {modoCargaMateriales === 'global' ? 'Modo Global (Un solo importe)' : 'Modo Detallado (Por Item)'}
                              </label>
                            </div>
                            )}
                          </div>

                          {/* CONTENIDO COLAPSABLE */}
                          {materialesSectionOpen && (
                          <div>
                            {/* Mensaje cuando ya se agregaron materiales */}
                            {materialesAgregados && (
                              <div className="alert alert-success d-flex justify-content-between align-items-center mb-3">
                                <span><i className="fas fa-check-circle me-2"></i>Materiales agregados correctamente ({modoCargaMateriales === 'global' ? 'Global' : 'Detallado'})</span>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => setMaterialesAgregados(false)}
                                >
                                  <i className="fas fa-edit me-1"></i>Modificar Materiales
                                </button>
                              </div>
                            )}

                            {/* Formulario para agregar material */}
                            {!materialesAgregados && (
                            <div className="border rounded p-3 mb-2 bg-light">

                              {/* CONDICIONAL: MODO GLOBAL vs MODO DETALLE */}
                              {modoCargaMateriales === 'global' ? (
                                <div className="d-flex flex-row align-items-end gap-3 flex-wrap">
                                  <div style={{minWidth: '350px', flex: 1}}>
                                    <label className="form-label small mb-1">Descripción Global</label>
                                    <input
                                      type="text"
                                      className="form-control form-control-sm"
                                      value={globalMateriales.descripcion}
                                      onChange={(e) => setGlobalMateriales({...globalMateriales, descripcion: e.target.value})}
                                      placeholder="Ej: Materiales gruesos y finos globales estimados"
                                    />
                                  </div>
                                  <div style={{minWidth: '200px', maxWidth: '200px'}}>
                                    <label className="form-label small mb-1">Importe Total Estimado</label>
                                    <div className="input-group input-group-sm">
                                      <span className="input-group-text">$</span>
                                      <input
                                        type="number"
                                        className="form-control form-control-sm"
                                        value={globalMateriales.importe}
                                        onChange={(e) => setGlobalMateriales({...globalMateriales, importe: e.target.value})}
                                        placeholder="0.00"
                                        min="0"
                                      />
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    className="btn btn-success btn-sm"
                                    onClick={() => {
                                      // Agregar item ficticio global a materialesCalc
                                      if (!globalMateriales.importe || Number(globalMateriales.importe) <= 0) {
                                        alert('Debe ingresar un importe válido.');
                                        return;
                                      }

                                      const materialGlobal = {
                                        id: Date.now(),
                                        descripcion: globalMateriales.descripcion,
                                        unidad: 'global', // ✅ Agregado para cumplir constraint NOT NULL
                                        cantidad: 1,
                                        precioUnitario: Number(globalMateriales.importe),
                                        subtotal: Number(globalMateriales.importe),
                                        sinCantidad: false,
                                        sinPrecio: false,
                                        esGlobal: true // Marca para identificarlo
                                      };

                                      setMaterialesCalc([materialGlobal]);
                                      // setMaterialesAgregados(true); // Opcional
                                    }}
                                    title="Establecer importe global"
                                    disabled={materialesCalc.length > 0} // Solo permite un item global
                                  >
                                    <i className="fas fa-check"></i> Establecer
                                  </button>

                                  {materialesCalc.length > 0 && (
                                     <button type="button" className="btn btn-warning btn-sm" onClick={() => setMaterialesCalc([])} title="Limpiar importe global">
                                       <i className="fas fa-eraser"></i>
                                     </button>
                                  )}
                                </div>
                              ) : (
                              <div>
                                {/* SELECTOR: Catálogo o Manual */}
                                {modoEntradaMaterial === 'catalogo' ? (
                                  <div className="mb-3">
                                    <label className="form-label small fw-bold mb-1">
                                      📚 Seleccionar del Catálogo
                                      {cargandoCatalogos && <span className="ms-2 small text-muted">(cargando...)</span>}
                                      {!cargandoCatalogos && catalogoMateriales.length === 0 && (
                                        <span className="ms-2 small text-danger">(Sin materiales en el catálogo)</span>
                                      )}
                                    </label>
                                    <select
                                      className="form-select form-select-sm"
                                      onChange={handleSeleccionMaterialCatalogo}
                                      disabled={cargandoCatalogos}
                                    >
                                      <option value="">
                                        {catalogoMateriales.length === 0
                                          ? '-- No hay materiales disponibles --'
                                          : '-- Seleccione un material --'}
                                      </option>
                                      {catalogoMateriales.map(material => (
                                        <option key={material.id} value={material.id}>
                                          {material.nombre || material.descripcion} - ${Number(material.precioUnitario || material.precio || 0).toLocaleString('es-AR')}
                                          {material.categoria ? ` (${material.categoria})` : ''}
                                        </option>
                                      ))}
                                      <option value="manual" style={{borderTop: '2px solid #ddd', fontWeight: 'bold'}}>
                                        ➕ Agregar Manualmente
                                      </option>
                                    </select>
                                  </div>
                                ) : null}

                                {/* Inputs para cantidad y precio (siempre visibles si hay algo seleccionado o en modo manual) */}
                                {(materialActualCalc.descripcion || modoEntradaMaterial === 'manual') && (
                                <div className="d-flex flex-row align-items-end gap-2 flex-wrap">
                                  {/* Input de descripción (solo en modo manual) */}
                                  {modoEntradaMaterial === 'manual' && (
                                    <div style={{minWidth: '250px', flex: 1}}>
                                      <label className="form-label small mb-1">Material</label>
                                      <input
                                        type="text"
                                        className="form-control form-control-sm"
                                        value={materialActualCalc.descripcion}
                                        onChange={(e) => handleDescripcionMaterialChange(e.target.value)}
                                        placeholder="Ej: Cemento Portland"
                                      />
                                    </div>
                                  )}

                                  {/* Mostrar nombre del material seleccionado en modo catálogo */}
                                  {modoEntradaMaterial === 'catalogo' && materialActualCalc.descripcion && (
                                    <div style={{minWidth: '250px', flex: 1}}>
                                      <label className="form-label small mb-1">Material Seleccionado</label>
                                      <div className="form-control form-control-sm bg-light">
                                        ✅ {materialActualCalc.descripcion}
                                      </div>
                                    </div>
                                  )}

                                  <div style={{minWidth: '100px', maxWidth: '100px'}}>
                                    <label className="form-label small mb-1">Cantidad</label>
                                    <input
                                      type="number"
                                      className="form-control form-control-sm"
                                      value={materialActualCalc.cantidad}
                                      onChange={(e) => setMaterialActualCalc({...materialActualCalc, cantidad: e.target.value})}
                                      placeholder="0"
                                      min="0"
                                      step="0.01"
                                      id="cantidadMaterialInput"
                                    />
                                  </div>
                                  <div style={{minWidth: '120px', maxWidth: '120px'}}>
                                    <label className="form-label small mb-1">Precio Unitario</label>
                                    <input
                                      type="number"
                                      className="form-control form-control-sm"
                                      value={materialActualCalc.precioUnitario}
                                      onChange={(e) => setMaterialActualCalc({...materialActualCalc, precioUnitario: e.target.value})}
                                      placeholder="0.00"
                                      min="0"
                                      step="0.01"
                                    />
                                  </div>
                                  <div style={{minWidth: '100px', maxWidth: '100px'}}>
                                    <label className="form-label small mb-1">Subtotal</label>
                                    <div className="form-control-plaintext small fw-bold text-success">
                                      ${((Number(materialActualCalc.cantidad) || 0) * (Number(materialActualCalc.precioUnitario) || 0)).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    className="btn btn-success btn-sm"
                                    onClick={agregarMaterialCalc}
                                    title="Agregar este material a la lista del rubro"
                                  >
                                    <i className="fas fa-plus"></i>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-warning btn-sm"
                                    onClick={() => {
                                      setMaterialActualCalc({ descripcion: '', cantidad: '', precioUnitario: '', unidad: 'unidad' });
                                      setModoEntradaMaterial('catalogo');
                                    }}
                                    title="Cancelar y volver al selector"
                                  >
                                    <i className="fas fa-times"></i>
                                  </button>
                                </div>
                                )}
                              </div>
                              )}
                            </div>
                            )}

                                {/* Lista de materiales agregados */}
                                {materialesCalc.length > 0 && (
                                  <div className="table-responsive">
                                    <table className="table table-sm table-bordered mb-0">
                                      <thead className="table-light">
                                        <tr key="materiales-header">
                                          <th className="small">Material</th>
                                          <th className="small text-center">Cantidad</th>
                                          <th className="small text-end">$ Unitario</th>
                                          <th className="small text-end">Subtotal</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {materialesCalc.map((mat) => (
                                          <tr key={mat.id} className={mat.sinCantidad || mat.sinPrecio ? 'table-warning' : ''}>
                                            <td className="small">
                                              {mat.descripcion}
                                              {(mat.sinCantidad || mat.sinPrecio) && (
                                                <div className="small text-warning mt-1">
                                                  <i className="fas fa-exclamation-triangle me-1"></i>
                                                  Datos incompletos
                                                </div>
                                              )}
                                            </td>
                                            <td className="small text-center">
                                              {mat.sinCantidad ? (
                                                <span className="text-warning">
                                                  <i className="fas fa-question-circle me-1"></i>Pendiente
                                                </span>
                                              ) : (
                                                mat.cantidad
                                              )}
                                            </td>
                                            <td className="small text-end">
                                              {mat.sinPrecio ? (
                                                <span className="text-warning">
                                                  <i className="fas fa-question-circle me-1"></i>Pendiente
                                                </span>
                                              ) : (
                                                `$${Number(mat.precioUnitario).toLocaleString('es-AR', {minimumFractionDigits: 2})}`
                                              )}
                                            </td>
                                            <td className="small text-end fw-bold">
                                              {mat.subtotal === 0 ? (
                                                <span className="text-muted">$0,00</span>
                                              ) : (
                                                `$${mat.subtotal.toLocaleString('es-AR', {minimumFractionDigits: 2})}`
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                        <tr key="materiales-subtotal" className="table-success">
                                          <td colSpan="3" className="small fw-bold text-end">SUBTOTAL MATERIALES:</td>
                                          <td className="small fw-bold text-end">${subtotalMaterialesLista.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                )}

                            {/* Campos de descripción y observaciones para Materiales */}
                            <div className="row mt-3">
                              <div className="col-md-6">
                                <div className="mb-2">
                                  <label className="form-label small fw-bold text-muted mb-1">
                                    <i className="fas fa-align-left me-1"></i>
                                    Descripción
                                  </label>
                                  <textarea
                                    className="form-control form-control-sm"
                                    rows="3"
                                    placeholder="Descripción del rubro de materiales..."
                                    value={descripcionMateriales}
                                    onChange={(e) => setDescripcionMateriales(e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="col-md-6">
                                <div className="mb-2">
                                  <label className="form-label small fw-bold text-muted mb-1">
                                    <i className="fas fa-sticky-note me-1"></i>
                                    Observaciones
                                  </label>
                                  <textarea
                                    className="form-control form-control-sm"
                                    rows="3"
                                    placeholder="Observaciones del rubro de materiales..."
                                    value={observacionesMateriales}
                                    onChange={(e) => setObservacionesMateriales(e.target.value)}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Botón para agregar solo materiales */}
                            <div className="text-end mt-2">
                              <button
                                type="button"
                                className={`btn btn-sm ${materialesAgregados ? 'btn-success' : 'btn-success'}`}
                                onClick={() => {
                                  setTimeout(() => {
                                    agregarMaterialCalculadora();
                                  }, 10);
                                }}
                                disabled={materialesCalc.length === 0 && !importeMaterialesCalc}
                              >
                                <i className={`fas ${materialesAgregados ? 'fa-check' : 'fa-plus'} me-1`}></i>
                                {materialesAgregados ? '✓ Materiales Agregados Correctamente' : 'Agregar Materiales al Presupuesto'}
                              </button>
                            </div>
                          </div>
                          )}
                        </div>
                      </div>
                      )}

                      {/* ✨ NUEVA SECCIÓN: Agregar Gastos Generales */}
                      {/* Mostrar SIEMPRE esta sección naranja */}
                      <div className="col-md-12" data-section="gastos-generales">
                        <div id="seccion-gastos-generales-naranja" className="border rounded p-3 mt-2" style={{backgroundColor: '#ffe8d6', borderColor: '#ffb380'}}>
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <div
                                className="d-flex align-items-center"
                                style={{cursor: 'pointer'}}
                                onClick={() => setGastosSectionOpen(!gastosSectionOpen)}
                            >
                                <i className={`fas fa-chevron-${gastosSectionOpen ? 'down' : 'right'} me-2`}></i>
                                <h6 className="mb-0 small" style={{fontWeight: 'bold', color: '#d84315'}}>
                                  <i className="fas fa-receipt me-2"></i>
                                  Gastos Generales
                                  {tipoProfesionalCalc && (
                                    <span className="ms-2" style={{fontSize: '1.2rem', fontWeight: 'bold'}}>
                                      - {tipoProfesionalCalc}
                                    </span>
                                  )}
                                </h6>
                            </div>

                            {/* SWITCH DE MODO DE CARGA (Visible solo si está expandido) */}
                            {gastosSectionOpen && (
                              <div className="form-check form-switch custom-switch-presupuesto">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  id="switchModoCargaGastos"
                                  checked={modoCargaGastos === 'global'}
                                  onChange={(e) => {
                                    if (gastosGeneralesCalc.length > 0 && confirm('Cambiar de modo borrará los gastos ya ingresados. ¿Desea continuar?')) {
                                      setGastosGeneralesCalc([]);
                                      setModoCargaGastos(e.target.checked ? 'global' : 'detalle');
                                    } else if (gastosGeneralesCalc.length === 0) {
                                      setModoCargaGastos(e.target.checked ? 'global' : 'detalle');
                                    }
                                  }}
                                  disabled={gastosGeneralesAgregados}
                                />
                                <label className="form-check-label small fw-bold text-muted ps-1" htmlFor="switchModoCargaGastos">
                                  {modoCargaGastos === 'global' ? 'Modo Global (Un solo importe)' : 'Modo Detallado (Por Item)'}
                                </label>
                              </div>
                            )}
                          </div>

                          {gastosSectionOpen && (
                            <div>
                              {/* Mensaje cuando ya se agregaron gastos generales */}
                              {gastosGeneralesAgregados && (
                                <div className="alert alert-success d-flex justify-content-between align-items-center mb-3">
                                  <span><i className="fas fa-check-circle me-2"></i>Gastos Generales agregados correctamente ({modoCargaGastos === 'global' ? 'Global' : 'Detallado'})</span>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => setGastosGeneralesAgregados(false)}
                                  >
                                    <i className="fas fa-edit me-1"></i>Modificar Gastos Generales
                                  </button>
                                </div>
                              )}

                              {/* Formulario para agregar gasto general */}
                              {!gastosGeneralesAgregados && (
                              <div className="border rounded p-3 mb-2 bg-light">

                                {/* Selector de Catálogo - Solo en modo DETALLE */}
                                {modoCargaGastos === 'detalle' && (
                                <div className="border rounded p-3 mb-2 bg-light">
                                  <div>
                                    <div className="mb-3">
                                      <label className="form-label small fw-bold mb-1">📚 Seleccionar del Catálogo</label>
                                      <select
                                        className="form-select form-select-sm"
                                        value={selectorGasto}
                                        onChange={(e) => {
                                          const valor = e.target.value;
                                          setSelectorGasto(valor);

                                          if (valor && valor !== 'manual') {
                                            const gastoSeleccionado = catalogoGastos.find(g => g.id === parseInt(valor));
                                            if (gastoSeleccionado) {
                                              setGastoGeneralFormCalc({
                                                descripcion: gastoSeleccionado.nombre || gastoSeleccionado.descripcion,
                                                unidad: gastoSeleccionado.unidadMedida || gastoSeleccionado.unidad || '',
                                                cantidad: '1',
                                                precioUnitario: gastoSeleccionado.precio || gastoSeleccionado.precioUnitario || ''
                                              });
                                            }
                                          }
                                        }}
                                      >
                                        <option value="">-- Seleccione un gasto general --</option>
                                        {catalogoGastos.map(gasto => (
                                          <option key={gasto.id} value={gasto.id}>
                                            {gasto.nombre || gasto.descripcion} - ${(gasto.precio || gasto.precioUnitario || 0).toLocaleString('es-AR')}
                                          </option>
                                        ))}
                                        <option value="manual" style={{borderTop: '2px solid #ddd', fontWeight: 'bold'}}>➕ Agregar Manualmente</option>
                                      </select>
                                    </div>
                                  </div>
                                </div>
                                )}

                                {/* CONDICIONAL: MODO GLOBAL vs MODO DETALLE */}
                                {modoCargaGastos === 'global' ? (
                                  <div className="d-flex flex-row align-items-end gap-3 flex-wrap">
                                    <div style={{minWidth: '350px', flex: 1}}>
                                      <label className="form-label small mb-1">Descripción Global</label>
                                      <input
                                        type="text"
                                        className="form-control form-control-sm"
                                        value={globalGastos.descripcion}
                                        onChange={(e) => setGlobalGastos({...globalGastos, descripcion: e.target.value})}
                                        placeholder="Ej: Gastos operativos, transporte y permisos globales estimados"
                                      />
                                    </div>
                                    <div style={{minWidth: '200px', maxWidth: '200px'}}>
                                      <label className="form-label small mb-1">Importe Total Estimado</label>
                                      <div className="input-group input-group-sm">
                                        <span className="input-group-text">$</span>
                                        <input
                                          type="number"
                                          className="form-control form-control-sm"
                                          value={globalGastos.importe}
                                          onChange={(e) => setGlobalGastos({...globalGastos, importe: e.target.value})}
                                          placeholder="0.00"
                                          min="0"
                                        />
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      className="btn btn-success btn-sm"
                                      onClick={() => {
                                        // Agregar item ficticio global a gastosGeneralesCalc
                                        if (!globalGastos.importe || Number(globalGastos.importe) <= 0) {
                                          alert('Debe ingresar un importe válido.');
                                          return;
                                        }

                                        const importeNumber = Number(globalGastos.importe);
                                        const gastoGlobal = {
                                          id: Date.now(),
                                          descripcion: globalGastos.descripcion,
                                          unidad: 'global', // ✅ Agregado preventivamente
                                          cantidad: 1, // ✅ Necesario para la tabla
                                          precioUnitario: importeNumber, // ✅ Necesario para la tabla (Precio Unit.)
                                          subtotal: importeNumber, // ✅ Necesario para la tabla (Subtotal)
                                          cantidadMaxima: null,
                                          sinCantidad: false,
                                          sinPrecio: false,
                                          esGlobal: true // Marca para identificarlo
                                        };

                                        setGastosGeneralesCalc([gastoGlobal]);
                                        // setGastosGeneralesAgregados(true); // Opcional
                                      }}
                                      title="Establecer importe global"
                                      disabled={gastosGeneralesCalc.length > 0} // Solo permite un item global
                                    >
                                      <i className="fas fa-check"></i> Establecer
                                    </button>

                                    {gastosGeneralesCalc.length > 0 && (
                                       <button type="button" className="btn btn-warning btn-sm" onClick={() => setGastosGeneralesCalc([])} title="Limpiar importe global">
                                         <i className="fas fa-eraser"></i>
                                       </button>
                                    )}
                                  </div>
                                ) : (
                                <div className="d-flex flex-row align-items-end gap-3 flex-wrap">
                                  <div style={{minWidth: '200px', flex: 1}}>
                                    <label className="form-label small mb-1">
                                      Descripción del Gasto
                                      {cargandoGastosStock && (
                                        <span className="ms-2">
                                          <i className="fas fa-spinner fa-spin text-muted"></i>
                                        </span>
                                      )}
                                    </label>
                                    {gastosGeneralesStock.length > 0 ? (
                                      <select
                                        className="form-control form-control-sm"
                                        value={gastoGeneralActual.descripcion}
                                        onChange={(e) => {
                                          const gastoSeleccionado = gastosGeneralesStock.find(g => g.nombre === e.target.value);
                                          setGastoGeneralActual({
                                            ...gastoGeneralActual,
                                            descripcion: e.target.value,
                                            // Prellenar cantidad máxima disponible
                                            cantidadMaxima: gastoSeleccionado?.cantidadDisponible || 0
                                          });
                                        }}
                                      >
                                        <option value="">Seleccione un gasto del stock...</option>
                                        {gastosGeneralesStock.map((gasto, idx) => (
                                          <option key={`${gasto.id}-${idx}`} value={gasto.nombre}>
                                            {gasto.nombre} - {gasto.categoria} (Disponible: {gasto.cantidadDisponible})
                                          </option>
                                        ))}
                                        <option value="PERSONALIZADO">✏️ Escribir gasto personalizado</option>
                                      </select>
                                    ) : (
                                      <input
                                        type="text"
                                        className="form-control form-control-sm"
                                        value={gastoGeneralActual.descripcion}
                                        onChange={(e) => setGastoGeneralActual({...gastoGeneralActual, descripcion: e.target.value})}
                                        placeholder={cargandoGastosStock ? "Cargando gastos del stock..." : "Ej: Transporte, herramientas, permisos..."}
                                        disabled={cargandoGastosStock}
                                      />
                                    )}
                                    {/* Input adicional para gastos personalizados */}
                                    {gastoGeneralActual.descripcion === 'PERSONALIZADO' && (
                                      <input
                                        type="text"
                                        className="form-control form-control-sm mt-2"
                                        placeholder="Escriba el nombre del gasto personalizado..."
                                        onChange={(e) => setGastoGeneralActual({
                                          ...gastoGeneralActual,
                                          descripcion: e.target.value || 'PERSONALIZADO',
                                          cantidadMaxima: null // Sin límite para personalizados
                                        })}
                                      />
                                    )}
                                  </div>
                                  <div style={{minWidth: '80px', maxWidth: '80px'}}>
                                    <label className="form-label small mb-1">
                                      Cantidad
                                      {gastoGeneralActual.cantidadMaxima && (
                                        <div className="text-muted small">
                                          Máx: {gastoGeneralActual.cantidadMaxima}
                                        </div>
                                      )}
                                    </label>
                                    <input
                                      type="number"
                                      className="form-control form-control-sm"
                                      value={gastoGeneralActual.cantidad}
                                      onChange={(e) => {
                                        const valorIngresado = Number(e.target.value) || 0;
                                        const cantidadMaxima = gastoGeneralActual.cantidadMaxima;

                                        // Validar límite de stock si aplica
                                        if (cantidadMaxima && valorIngresado > cantidadMaxima) {
                                          alert(`⚠️ Cantidad máxima disponible en stock: ${cantidadMaxima}`);
                                          return;
                                        }

                                        setGastoGeneralActual({...gastoGeneralActual, cantidad: e.target.value});
                                      }}
                                      placeholder="0"
                                      min="0"
                                      max={gastoGeneralActual.cantidadMaxima || undefined}
                                      step="0.01"
                                    />
                                    {gastoGeneralActual.cantidadMaxima && Number(gastoGeneralActual.cantidad) > gastoGeneralActual.cantidadMaxima && (
                                      <div className="small text-danger mt-1">
                                        <i className="fas fa-exclamation-triangle me-1"></i>
                                        Supera stock disponible
                                      </div>
                                    )}
                                  </div>
                                  <div style={{minWidth: '110px', maxWidth: '110px'}}>
                                    <label className="form-label small mb-1">Precio Unitario</label>
                                    <input
                                      type="number"
                                      className="form-control form-control-sm"
                                      value={gastoGeneralActual.precioUnitario}
                                      onChange={(e) => setGastoGeneralActual({...gastoGeneralActual, precioUnitario: e.target.value})}
                                      placeholder="0.00"
                                      min="0"
                                      step="0.01"
                                    />
                                  </div>
                                  <div style={{minWidth: '90px', maxWidth: '90px'}}>
                                    <label className="form-label small mb-1">Subtotal</label>
                                    <div className="form-control-plaintext small fw-bold">
                                      ${((gastoGeneralActual.cantidad || 0) * (gastoGeneralActual.precioUnitario || 0)).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    className="btn btn-success btn-sm"
                                    onClick={agregarGastoGeneral}
                                    title="Agregar gasto a la lista"
                                  >
                                    <i className="fas fa-plus"></i>
                                  </button>
                                </div>
                                )}
                              </div>
                              )}

                              {/* Tabla de gastos generales agregados */}
                              {gastosGeneralesCalc.length > 0 && (
                                <div className="table-responsive mt-2">
                                  <table className="table table-sm table-bordered mb-0">
                                    <thead className="table-light">
                                      <tr key="gastos-header">
                                        <th className="small">Descripción</th>
                                        <th className="small text-center">Cantidad</th>
                                        <th className="small text-center">Categoría</th>
                                        <th className="small text-end">Precio Unit.</th>
                                        <th className="small text-end">Subtotal</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {gastosGeneralesCalc.map((gasto) => (
                                        <tr key={gasto.id} className={(gasto.sinCantidad || gasto.sinPrecio) ? 'table-warning' : ''}>
                                          <td className="small">
                                            {gasto.descripcion}
                                            {gasto.esDelStock && (
                                              <div className="small text-success mt-1">
                                                <i className="fas fa-box me-1"></i>
                                                Stock disponible: {(gasto.cantidadDisponibleOriginal - gasto.cantidad)}
                                              </div>
                                            )}
                                            {(gasto.sinCantidad || gasto.sinPrecio) && (
                                              <div className="small text-warning mt-1">
                                                <i className="fas fa-exclamation-triangle me-1"></i>
                                                Datos incompletos
                                              </div>
                                            )}
                                          </td>
                                          <td className="small text-center">
                                            {gasto.sinCantidad ? (
                                              <span className="text-warning">
                                                <i className="fas fa-question-circle me-1"></i>Pendiente
                                              </span>
                                            ) : (
                                              <>
                                                {gasto.cantidad}
                                                {gasto.esDelStock && (
                                                  <div className="small text-muted">
                                                    de {gasto.cantidadDisponibleOriginal}
                                                  </div>
                                                )}
                                              </>
                                            )}
                                          </td>
                                          <td className="small text-center">
                                            {gasto.categoria ? (
                                              <span className="badge bg-secondary">{gasto.categoria}</span>
                                            ) : (
                                              <span className="text-muted small">Personalizado</span>
                                            )}
                                          </td>
                                          <td className="small text-end">
                                            {gasto.sinPrecio ? (
                                              <span className="text-warning">
                                                <i className="fas fa-question-circle me-1"></i>Pendiente
                                              </span>
                                            ) : (
                                              `$${Number(gasto.precioUnitario).toLocaleString('es-AR', {minimumFractionDigits: 2})}`
                                            )}
                                          </td>
                                          <td className="small text-end fw-bold">
                                            {(!gasto.subtotal || gasto.subtotal === 0) ? (
                                              <span className="text-muted">$0,00</span>
                                            ) : (
                                              `$${Number(gasto.subtotal).toLocaleString('es-AR', {minimumFractionDigits: 2})}`
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                      <tr key="gastos-subtotal" className="table-warning">
                                        <td colSpan="4" className="small fw-bold text-end">SUBTOTAL GASTOS GENERALES:</td>
                                        <td className="small fw-bold text-end">
                                          ${gastosGeneralesCalc.reduce((sum, g) => sum + Number(g.subtotal || 0), 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {/* Campos de descripción y observaciones para Gastos Generales */}
                              <div className="row mt-3">
                                <div className="col-md-6">
                                  <div className="mb-2">
                                    <label className="form-label small fw-bold text-muted mb-1">
                                      <i className="fas fa-align-left me-1"></i>
                                      Descripción
                                    </label>
                                    <textarea
                                      className="form-control form-control-sm"
                                      rows="3"
                                      placeholder="Descripción de los gastos generales..."
                                      value={descripcionGastosGenerales}
                                      onChange={(e) => setDescripcionGastosGenerales(e.target.value)}
                                    />
                                  </div>
                                </div>
                                <div className="col-md-6">
                                  <div className="mb-2">
                                    <label className="form-label small fw-bold text-muted mb-1">
                                      <i className="fas fa-sticky-note me-1"></i>
                                      Observaciones
                                    </label>
                                    <textarea
                                      className="form-control form-control-sm"
                                      rows="3"
                                      placeholder="Observaciones de los gastos generales..."
                                      value={observacionesGastosGenerales}
                                      onChange={(e) => setObservacionesGastosGenerales(e.target.value)}
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Botón para agregar gastos generales al presupuesto */}
                              <div className="text-end mt-3">
                                {gastosGeneralesCalc.length === 0 && !gastosGeneralesAgregados && (
                                  <div className="alert alert-info py-2 small mb-2">
                                    <i className="fas fa-info-circle me-2"></i>
                                    Agregue al menos un gasto usando el botón verde <i className="fas fa-plus mx-1"></i> para habilitar este botón
                                  </div>
                                )}
                                <button
                                  type="button"
                                  className={`btn btn-sm ${gastosGeneralesAgregados ? 'btn-success' : ''}`}
                                  style={gastosGeneralesAgregados ? {} : {backgroundColor: '#ff9800', borderColor: '#ff9800', color: '#fff'}}
                                  onClick={() => {
                                    setTimeout(() => {
                                      agregarGastosGeneralesCalculadora();
                                    }, 10);
                                  }}
                                  disabled={gastosGeneralesCalc.length === 0}
                                  title={gastosGeneralesCalc.length === 0 ? 'Primero agregue gastos usando el formulario de arriba' : ''}
                                >
                                  <i className={`fas ${gastosGeneralesAgregados ? 'fa-check' : 'fa-plus'} me-1`}></i>
                                  {gastosGeneralesAgregados ? '✓ Gastos Generales Agregados Correctamente' : 'Agregar Gastos Generales al Presupuesto'}
                                </button>
                              </div>
                            </div>
                            )}
                          </div>
                        </div>

                      {/* ✨ NUEVA SECCIÓN: Agregar Profesionales */}
                      {/* SECCION OCULTA A PEDIDO DEL CLIENTE */}
                      {false && !itemsCalculadora.find(i => i.id === itemEditandoId)?.esGastoGeneral && (
                      <div className="col-md-12">
                        <div className="border rounded p-3 mt-2" style={{backgroundColor: '#e8f4fd', borderColor: '#7db8e8'}}>
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <h6 className="mb-0 small" style={{fontWeight: 'bold', color: '#0c5460'}}>
                              <i className="fas fa-users me-2"></i>
                              Profesionales
                              {tipoProfesionalCalc && (
                                <span className="ms-2" style={{fontSize: '1.2rem', fontWeight: 'bold'}}>
                                  - {tipoProfesionalCalc}
                                </span>
                              )}
                            </h6>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => setProfesionalesAgregados(!profesionalesAgregados)}
                            >
                              {profesionalesAgregados ? 'Modificar' : 'Cerrar'}
                            </button>
                          </div>
                          {!profesionalesAgregados && (
                          <div>
                            {/* Formulario para agregar profesional */}
                            <div className="border rounded p-3 mb-2 bg-light">
                              <div className="d-flex flex-row align-items-end gap-3 flex-wrap">
                                <div style={{minWidth: '180px', maxWidth: '180px'}}>
                                  <label className="form-label small mb-1">Rol / Tipo *</label>
                                  <select
                                    className="form-select form-select-sm"
                                    value={profesionalActualCalc.tipo}
                                    onChange={handleTipoProfesionalChange}
                                  >
                                    <option value="">Seleccione un rol...</option>
                                    {(() => {
                                      const nombreRubro = tipoProfesionalCalc?.trim() || '';
                                      const gentilicio = convertirRubroAGentilicio(nombreRubro);
                                      const opcionesRoles = generarOpcionesRoles(gentilicio);

                                      return opcionesRoles.map(rol => (
                                        <option key={rol.value} value={rol.value}>
                                          {rol.label}
                                        </option>
                                      ));
                                    })()}
                                    <option value="Otro">Otro (personalizado)</option>
                                  </select>
                                </div>
                                <div style={{minWidth: '120px', maxWidth: '120px'}}>
                                  <label className="form-label small mb-1">
                                    Nombre <span className="text-muted">(opcional)</span>
                                  </label>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={profesionalActualCalc.nombre || ''}
                                    onChange={(e) => setProfesionalActualCalc({...profesionalActualCalc, nombre: e.target.value})}
                                    placeholder="Ej: Juan Pérez"
                                    maxLength="100"
                                  />
                                </div>
                                <div style={{minWidth: '110px', maxWidth: '110px'}}>
                                  <label className="form-label small mb-1">
                                    Teléfono <span className="text-muted">(opcional)</span>
                                  </label>
                                  <input
                                    type="tel"
                                    className="form-control form-control-sm"
                                    value={profesionalActualCalc.telefono || ''}
                                    onChange={(e) => setProfesionalActualCalc({...profesionalActualCalc, telefono: e.target.value})}
                                    placeholder="351-5555555"
                                    maxLength="20"
                                  />
                                </div>
                                <div style={{minWidth: '100px', maxWidth: '100px'}}>
                                  <label className="form-label small mb-1">Unidad</label>
                                  <select
                                    className="form-select form-select-sm"
                                    value={profesionalActualCalc.unidad || 'jornales'}
                                    onChange={(e) => setProfesionalActualCalc({...profesionalActualCalc, unidad: e.target.value})}
                                  >
                                    <option value="jornales">Jornales</option>
                                    <option value="horas">Horas</option>
                                  </select>
                                </div>
                                <div style={{minWidth: '75px', maxWidth: '75px'}}>
                                  <label className="form-label small mb-1">
                                    {profesionalActualCalc.unidad === 'horas' ? 'Horas' : 'Jornales'}
                                  </label>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={profesionalActualCalc.cantidadJornales}
                                    onChange={(e) => setProfesionalActualCalc({...profesionalActualCalc, cantidadJornales: e.target.value})}
                                    placeholder="0.00"
                                    min="0"
                                  />
                                </div>
                                <div style={{minWidth: '100px', maxWidth: '100px'}}>
                                  <label className="form-label small mb-1">
                                    Importe x {profesionalActualCalc.unidad === 'horas' ? 'Hora' : 'Jornal'}
                                    {profesionalActualCalc.importeJornal && (
                                      <span className="text-success ms-1" title="Autocompletado con promedio">
                                        <i className="fas fa-magic"></i>
                                      </span>
                                    )}
                                  </label>
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={profesionalActualCalc.importeJornal}
                                    onChange={(e) => setProfesionalActualCalc({...profesionalActualCalc, importeJornal: e.target.value})}
                                    placeholder="0.00"
                                    min="0"
                                  />
                                  {profesionalActualCalc.tipo && profesionalActualCalc.importeJornal && (
                                    <small className="text-muted d-block">
                                      <i className="fas fa-info-circle me-1"></i>Promedio del rol
                                    </small>
                                  )}
                                </div>
                                <div style={{minWidth: '70px', maxWidth: '70px'}}>
                                  <label className="form-label small mb-1">Subtotal</label>
                                  <div className="form-control-plaintext small">
                                    {((profesionalActualCalc.cantidadJornales || 0) * (profesionalActualCalc.importeJornal || 0)).toFixed(2)}
                                  </div>
                                </div>
                          {/* Botón para agregar */}
                          <button type="button" className="btn btn-success btn-sm" onClick={agregarProfesionalCalc} title="Agregar este profesional a la lista del rubro">
                            <i className="fas fa-plus"></i>
                          </button>

                          {/* Botón para limpiar */}
                          <button type="button" className="btn btn-warning btn-sm" onClick={limpiarCamposProfesional} title="Limpiar los campos del profesional">
                            <i className="fas fa-eraser"></i>
                          </button>
                        </div>
                            </div>

                            {/* Lista de profesionales agregados */}
                            {profesionalesCalc.length > 0 && (
                              <div className="table-responsive">
                                <table className="table table-sm table-bordered mb-0">
                                  <thead className="table-light">
                                    <tr key="profesionales-header">
                                      <th className="small">Tipo</th>
                                      <th className="small">Nombre</th>
                                      <th className="small">Teléfono</th>
                                      <th className="small text-center">Unidad</th>
                                      <th className="small text-center">Cantidad</th>
                                      <th className="small text-end">Importe</th>
                                      <th className="small text-end">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {profesionalesCalc.map((prof) => (
                                      <tr key={prof.id} className={prof.sinCantidad || prof.sinImporte ? 'table-warning' : ''}>
                                        <td className="small">
                                          {prof.tipo}
                                          {(prof.sinCantidad || prof.sinImporte) && (
                                            <div className="small text-warning mt-1">
                                              <i className="fas fa-exclamation-triangle me-1"></i>
                                              Datos incompletos
                                            </div>
                                          )}
                                        </td>
                                        <td className="small">{prof.nombre || <span className="text-muted">-</span>}</td>
                                        <td className="small">{prof.telefono || <span className="text-muted">-</span>}</td>
                                        <td className="small text-center">{prof.unidad === 'horas' ? 'Horas' : 'Jornales'}</td>
                                        <td className="small text-center">
                                          {prof.sinCantidad ? (
                                            <span className="text-warning">
                                              <i className="fas fa-question-circle me-1"></i>Pendiente
                                            </span>
                                          ) : (
                                            prof.cantidadJornales
                                          )}
                                        </td>
                                        <td className="small text-end">
                                          {prof.sinImporte ? (
                                            <span className="text-warning">
                                              <i className="fas fa-question-circle me-1"></i>Pendiente
                                            </span>
                                          ) : (
                                            `$${Number(prof.importeJornal).toLocaleString('es-AR', {minimumFractionDigits: 2})}`
                                          )}
                                        </td>
                                        <td className="small text-end fw-bold">
                                          {prof.subtotal === 0 ? (
                                            <span className="text-muted">$0,00</span>
                                          ) : (
                                            `$${prof.subtotal.toLocaleString('es-AR', {minimumFractionDigits: 2})}`
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                    <tr key="profesionales-subtotal" className="table-info">
                                      <td colSpan="6" className="small fw-bold text-end">SUBTOTAL MANO DE OBRA:</td>
                                      <td className="small fw-bold text-end">${subtotalManoObraProfesionales.toLocaleString('es-AR', {minimumFractionDigits: 2})}</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {/* Campos de descripción y observaciones para Profesionales - ANTES del botón */}
                            <div className="row mt-3">
                              <div className="col-md-6">
                                <div className="mb-2">
                                  <label className="form-label small fw-bold text-muted mb-1">
                                    <i className="fas fa-align-left me-1"></i>
                                    Descripción
                                  </label>
                                  <textarea
                                    className="form-control form-control-sm"
                                    rows="3"
                                    placeholder="Descripción del rubro de profesionales..."
                                    value={descripcionProfesionales}
                                    onChange={(e) => setDescripcionProfesionales(e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="col-md-6">
                                <div className="mb-2">
                                  <label className="form-label small fw-bold text-muted mb-1">
                                    <i className="fas fa-sticky-note me-1"></i>
                                    Observaciones
                                  </label>
                                  <textarea
                                    className="form-control form-control-sm"
                                    rows="3"
                                    placeholder="Observaciones del rubro de profesionales..."
                                    value={observacionesProfesionales}
                                    onChange={(e) => setObservacionesProfesionales(e.target.value)}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Botón para agregar solo profesionales */}
                            <div className="text-end mt-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-success"
                                onClick={() => {
                                  setTimeout(() => {
                                    agregarProfesionalCalculadora();
                                  }, 10);
                                }}
                                disabled={profesionalesCalc.length === 0 && (!cantidadJornalesCalc || !importeJornalCalc)}
                              >
                                <i className="fas fa-check me-1"></i>
                                Confirmar Profesionales
                              </button>
                            </div>
                          </div>
                          )}
                        </div>
                      </div>
                      )}

                      {/* Total Mano de Obra + Materiales (todo junto) */}
                      {/* SECCION OCULTA A PEDIDO DEL CLIENTE */}
                      {false && !itemsCalculadora.find(i => i.id === itemEditandoId)?.esGastoGeneral && (
                      <div className="col-md-12">
                        <div className="border rounded p-3 mt-2" style={{backgroundColor: '#fff8e1', borderColor: '#ffcc80'}}>
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <h6 className="mb-0 small" style={{fontWeight: 'bold', color: '#8a6914'}}>
                              <i className="fas fa-calculator me-2"></i>
                              Mano de Obra y Materiales incluidos
                              {tipoProfesionalCalc && (
                                <span className="ms-2" style={{fontSize: '1.2rem', fontWeight: 'bold'}}>
                                  - {tipoProfesionalCalc}
                                </span>
                              )}
                            </h6>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => setManoObraMaterialesAgregados(!manoObraMaterialesAgregados)}
                            >
                              {manoObraMaterialesAgregados ? 'Modificar' : 'Cerrar'}
                            </button>
                          </div>
                          {!manoObraMaterialesAgregados && (
                          <div>
                            <div className="row g-2 mb-2">
                              <div className="col-md-8">
                                <label className="form-label small mb-1">
                                  Ingrese el total general (mano de obra + materiales sin desglose)
                                </label>
                                <input
                                  type="number"
                                  className="form-control form-control-sm"
                                  value={totalManualTempCalc}
                                  onChange={(e) => setTotalManualTempCalc(e.target.value)}
                                  placeholder="$ Total general"
                                  min="0"
                                  step="0.01"
                                />
                              </div>
                              <div className="col-md-4 d-flex align-items-end">
                                <button
                                  type="button"
                                  className="btn btn-success btn-sm"
                                  onClick={() => {
                                    if (!totalManualTempCalc || Number(totalManualTempCalc) <= 0) {
                                      alert('⚠️ Debe ingresar un monto válido');
                                      return;
                                    }
                                    // Solo confirmar el total, no agregar al presupuesto todavía
                                    setTotalManualCalc(totalManualTempCalc);
                                  }}
                                >
                                  Aceptar
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm ms-2"
                                  onClick={() => {
                                    setTotalManualTempCalc('');
                                    setTotalManualCalc('');
                                  }}
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>

                            {totalManualCalc && (
                              <div className="alert alert-info py-2 mb-0">
                                <div className="d-flex justify-content-between align-items-center">
                                  <small className="fw-bold">Total confirmado:</small>
                                  <strong className="text-info">
                                    ${Number(totalManualCalc).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                  </strong>
                                </div>
                              </div>
                            )}

                            {/* Campos de descripción y observaciones para Total Manual */}
                            <div className="row mt-3">
                              <div className="col-md-6">
                                <div className="mb-2">
                                  <label className="form-label small fw-bold text-muted mb-1">
                                    <i className="fas fa-align-left me-1"></i>
                                    Descripción
                                  </label>
                                  <textarea
                                    className="form-control form-control-sm"
                                    rows="3"
                                    placeholder="Descripción del trabajo total..."
                                    value={descripcionTotalManual}
                                    onChange={(e) => setDescripcionTotalManual(e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="col-md-6">
                                <div className="mb-2">
                                  <label className="form-label small fw-bold text-muted mb-1">
                                    <i className="fas fa-sticky-note me-1"></i>
                                    Observaciones
                                  </label>
                                  <textarea
                                    className="form-control form-control-sm"
                                    rows="3"
                                    placeholder="Observaciones del trabajo total..."
                                    value={observacionesTotalManual}
                                    onChange={(e) => setObservacionesTotalManual(e.target.value)}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Botón para agregar solo total manual */}
                            {totalManualCalc && (
                              <div className="text-end mt-2">
                                <button
                                  type="button"
                                  className="btn btn-info btn-sm"
                                  onClick={agregarTotalManualCalculadora}
                                >
                                  <i className="fas fa-plus me-1"></i>
                                  Agregar Total Manual al Presupuesto
                                </button>
                              </div>
                            )}
                          </div>
                          )}
                        </div>
                      </div>
                      )}
                    </div>

                    {/* Resultado Final */}
                    <div className="alert alert-success py-2 mb-0 mt-2">
                      <div className="d-flex justify-content-between align-items-center">
                        <small className="fw-bold">💰 TOTAL FINAL:</small>
                        <strong className="text-success">
                          ${(() => {
                            if (cantidadJornalesCalc && importeJornalCalc) {
                              return totalCalculadoCalc.toLocaleString('es-AR', { minimumFractionDigits: 2 });
                            }
                            if (totalManualCalc) {
                              return Number(totalManualCalc).toLocaleString('es-AR', { minimumFractionDigits: 2 });
                            }
                            if (importeMaterialesCalc) {
                              return Number(importeMaterialesCalc).toLocaleString('es-AR', { minimumFractionDigits: 2 });
                            }
                            return '0,00';
                          })()}
                        </strong>
                      </div>
                      {/* Desglose */}
                      <small className="text-muted d-block mt-1">
                        {/* Caso 1: Hay profesionales múltiples o materiales múltiples */}
                        {(profesionalesCalc.length > 0 || materialesCalc.length > 0) && (
                          <div>
                            {/* Mano de Obra */}
                            {profesionalesCalc.length > 0 && (
                              <>
                                <div className="fw-bold text-primary mb-1">Mano de Obra:</div>
                                {profesionalesCalc.map((prof) => (
                                  <div key={prof.id} className="ms-2">
                                    • {prof.tipo}: {prof.cantidadJornales} × ${Number(prof.importeJornal).toLocaleString('es-AR')} = ${prof.subtotal.toLocaleString('es-AR')}
                                  </div>
                                ))}
                                <div className="fw-bold mt-1">Subtotal M.O.: ${subtotalManoObraProfesionales.toLocaleString('es-AR')}</div>
                              </>
                            )}

                            {/* Materiales Desglosados */}
                            {materialesCalc.length > 0 && (
                              <>
                                <div className="fw-bold text-success mb-1 mt-2">Materiales:</div>
                                {materialesCalc.map((mat) => {
                                  let subtotalBase = Number(mat.subtotal || 0);
                                  let subtotalFinal = subtotalBase;

                                  // Aplicar honorarios de materiales
                                  if (form.honorarios?.materiales?.activo && form.honorarios?.materiales?.valor) {
                                    const valorHonorario = Number(form.honorarios.materiales.valor);
                                    if (form.honorarios.materiales.tipo === 'porcentaje') {
                                      subtotalFinal += (subtotalBase * valorHonorario) / 100;
                                    }
                                  }

                                  // Aplicar mayores costos
                                  if (form.mayoresCostos?.activo && form.mayoresCostos?.valor) {
                                    const valorMayorCosto = Number(form.mayoresCostos.valor);
                                    if (form.mayoresCostos.tipo === 'porcentaje') {
                                      subtotalFinal += (subtotalFinal * valorMayorCosto) / 100;
                                    }
                                  }

                                  // SIMPLE: Precio unitario = Total final / Cantidad
                                  const precioUnitarioFinal = mat.cantidad > 0 ? subtotalFinal / Number(mat.cantidad) : 0;
                                  const precioDisplay = precioUnitarioFinal.toLocaleString('es-AR');

                                  return (
                                    <div key={mat.id} className="ms-2">
                                      • {mat.descripcion}: {mat.cantidad} × ${precioDisplay} = ${subtotalFinal.toLocaleString('es-AR')}
                                    </div>
                                  );
                                })}
                                <div className="fw-bold mt-1">Subtotal Materiales: ${subtotalMaterialesLista.toLocaleString('es-AR')}</div>
                              </>
                            )}

                            {/* Materiales Total General */}
                            {materialesCalc.length === 0 && importeMaterialesCalc && (
                              <div className="mt-2">+ Materiales (total): ${Number(importeMaterialesCalc).toLocaleString('es-AR')}</div>
                            )}

                            {/* Gastos Generales Desglosados */}
                            {gastosGeneralesCalc.length > 0 && (
                              <>
                                <div className="fw-bold text-warning mb-1 mt-2">Gastos Generales:</div>
                                {gastosGeneralesCalc.map((gasto) => {
                                  const subtotalBase = Number(gasto.subtotal || 0);
                                  const cantidad = Number(gasto.cantidad || 0);
                                  const precioUnitario = cantidad > 0 ? subtotalBase / cantidad : 0;

                                  return (
                                    <div key={gasto.id} className="ms-2">
                                      • {gasto.descripcion}: {gasto.cantidad} × ${precioUnitario.toLocaleString('es-AR')} = ${subtotalBase.toLocaleString('es-AR')}
                                    </div>
                                  );
                                })}
                                <div className="fw-bold mt-1">
                                  Subtotal Gastos Generales: ${gastosGeneralesCalc.reduce((sum, g) => sum + Number(g.subtotal || 0), 0).toLocaleString('es-AR')}
                                </div>
                              </>
                            )}
                          </div>
                        )}

                        {/* Caso 2: Cálculo automático simple (jornales × jornal) */}
                        {profesionalesCalc.length === 0 && subtotalManoObraCalc > 0 && (
                          <>
                            {tipoProfesionalCalc && `${tipoProfesionalCalc}: `}
                            Mano de Obra: {cantidadJornalesCalc} × ${Number(importeJornalCalc).toLocaleString('es-AR')} = ${subtotalManoObraCalc.toLocaleString('es-AR')}
                            {importeMaterialesCalc && ` + Materiales: $${Number(importeMaterialesCalc).toLocaleString('es-AR')}`}
                          </>
                        )}

                        {/* Caso 3: Solo total manual (sin jornales ni jornal ni profesionales) */}
                        {profesionalesCalc.length === 0 && !subtotalManoObraCalc && totalManualCalc && (
                          <>
                            {tipoProfesionalCalc ? `${tipoProfesionalCalc}, incluye mano de obra y materiales` : 'Total manual ingresado'}
                          </>
                        )}

                        {/* Caso 4: Solo materiales (sin mano de obra ni total manual ni profesionales) */}
                        {profesionalesCalc.length === 0 && !subtotalManoObraCalc && !totalManualCalc && importeMaterialesCalc && (
                          <>
                            Materiales: ${Number(importeMaterialesCalc).toLocaleString('es-AR')}
                          </>
                        )}

                        {/* Caso 5: Nada ingresado */}
                        {profesionalesCalc.length === 0 && !subtotalManoObraCalc && !totalManualCalc && !importeMaterialesCalc && (
                          <span className="text-muted">Sin datos ingresados</span>
                        )}
                      </small>
                    </div>

                    {/* Botón Combinado (mantiene funcionalidad original) */}
                    <div className="mt-2 text-end">
                      <div className="alert alert-info py-2 px-3 mb-2 small">
                        <i className="fas fa-lightbulb me-2"></i>
                        <strong>✨ EDICIÓN INTELIGENTE:</strong> Al hacer clic en "Editar", los datos se pre-cargan para modificar. Puedes agregar parciales (ej: solo "oficial pintor") y completar después.
                      </div>
                      <small className="text-muted d-block mb-2">
                        💡 <strong>Tip:</strong> Usa los botones específicos de cada sección para agregar datos paso a paso
                      </small>
                      {itemEditandoId && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm ms-2"
                          onClick={() => {
                            setItemEditandoId(null);
                            setTipoProfesionalCalc('');
                            setCantidadJornalesCalc('');
                            setImporteJornalCalc('');
                            setImporteMaterialesCalc('');
                            setTotalManualCalc('');
                            setDescripcionCalc('');
                            setObservacionesCalc('');
                            setDescripcionMateriales('');
                            setObservacionesMateriales('');
                            setDescripcionTotalManual('');
                            setObservacionesTotalManual('');
                            setDescripcionProfesionales('');
                            setObservacionesProfesionales('');
                            setProfesionalesCalc([]);
                            setProfesionalActualCalc({ tipo: '', nombre: '', telefono: '', unidad: 'jornales', cantidadJornales: '', importeJornal: '' });
                            setMaterialesCalc([]);
                            setMaterialActualCalc({ descripcion: '', cantidad: '', precioUnitario: '' });
                          }}
                        >
                          <i className="fas fa-times me-1"></i>
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Botón eliminado para moverlo debajo de Items agregados */}
                  </>
                  )}

                  {/* Lista de items guardados - siempre visible FUERA del expandible */}
                  {(() => {
                    console.log('🔴🔴🔴 ANTES DE LA TABLA - itemsCalculadora.length:', itemsCalculadora.length);
                    console.log('🔴🔴🔴 ANTES DE LA TABLA - itemsCalculadoraConsolidados.length:', itemsCalculadoraConsolidados.length);
                    return null;
                  })()}
                  <div className="mt-3 border rounded p-3" style={{backgroundColor: '#f3e8ff', borderColor: '#c084fc'}}>
                    <h6 className="mb-3 small" style={{fontWeight: 'bold', color: '#6b21a8'}}>
                      <i className="fas fa-list me-2"></i>
                      Items agregados ({itemsCalculadora.length})
                    </h6>
                    <div className="table-responsive">
                      <table className="table table-sm table-bordered table-hover mb-0">
                        <thead className="table-light">
                          <tr key="items-header">

                            <th style={{width: '25%'}}>Descripción</th>
                            <th style={{width: '16%'}} className="text-center">Detalle</th>
                            <th style={{width: '18%'}} className="text-center">
                              <div className="d-flex flex-column align-items-center" style={{gap: '2px'}}>
                                <span style={{fontSize: '0.9em', fontWeight: 'bold'}}>
                                  <i className="fas fa-calendar-check me-1"></i>
                                  Incluir en cálculo
                                </span>
                                <small style={{fontSize: '0.75em', fontWeight: 'normal', color: 'white'}}>
                                  de días hábiles
                                </small>
                              </div>
                            </th>
                            <th style={{width: '13%'}} className="text-center">
                              <div className="d-flex flex-column align-items-center" style={{gap: '2px'}}>
                                <span style={{fontSize: '0.9em', fontWeight: 'bold'}}>
                                  <i className="fas fa-check-circle me-1"></i>
                                  Incluir rubro
                                </span>
                                <small style={{fontSize: '0.75em', fontWeight: 'normal', color: 'white'}}>
                                  en cálculo días
                                </small>
                              </div>
                            </th>
                            <th style={{width: '18%'}} className="text-end">Total</th>
                            <th style={{width: '10%'}} className="text-center">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            if (!estaCargandoInicialRef.current) {
                              console.log('🟡 RENDERIZANDO TABLA - Total items:', itemsCalculadoraConsolidados.length);
                              console.log('🟡 Items con jornales:', itemsCalculadoraConsolidados.filter(i => i.jornales && i.jornales.length > 0).length);
                            }
                            return null;
                          })()}
                          {itemsCalculadoraConsolidados.length > 0 ? (
                            <>
                            {itemsCalculadora.map((item) => {
                              console.log('🟦 RENDER TABLA - Item:', item.tipoProfesional, {
                                jornales: item.jornales,
                                cantidadJornales: item.jornales?.length,
                                materialesLista: item.materialesLista?.length,
                                profesionales: item.profesionales?.length,
                                total: item.total
                              });
                              return (
                              <tr key={item.id} className={item.esRubroVacio ? 'table-warning' : ''}>

                                <td>
                                  <div className="d-flex align-items-center">
                                    <strong style={{fontSize: '1.1rem'}}>{item.tipoProfesional}</strong>
                                    {item.esRubroVacio && (
                                      <span className="badge bg-warning text-dark ms-2 small">
                                        <i className="fas fa-pencil-alt me-1"></i>Pendiente
                                      </span>
                                    )}
                                  </div>
                                  {/* ✨ MOSTRAR LISTA DE PROFESIONALES SI EXISTEN */}
                                  {item.profesionales && item.profesionales.length > 0 && (
                                    <div className="mt-1">
                                      <div className="small fw-bold text-primary">Profesionales:</div>
                                      {item.profesionales.map((prof) => (
                                        <div key={prof.id} className="small text-muted ms-2" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px'}}>
                                          <span>
                                            <i className="fas fa-user me-1"></i>
                                            {(() => {
                                              const subtotalBase = Number(prof.subtotal);
                                              let subtotalFinal = subtotalBase;

                                              if (form.honorarios?.profesionales?.activo && form.honorarios?.profesionales?.valor) {
                                                const valorHonorario = Number(form.honorarios.profesionales.valor);
                                                if (form.honorarios.profesionales.tipo === 'porcentaje') {
                                                  subtotalFinal += (subtotalBase * valorHonorario) / 100;
                                                }
                                              }

                                              if (form.mayoresCostos?.activo && form.mayoresCostos?.valor) {
                                                const valorMayorCosto = Number(form.mayoresCostos.valor);
                                                if (form.mayoresCostos.tipo === 'porcentaje') {
                                                  subtotalFinal += (subtotalFinal * valorMayorCosto) / 100;
                                                }
                                              }

                                              const cantidadJornales = Number(prof.cantidadJornales || 0);
                                              const importeJornalFinal = cantidadJornales > 0 ? subtotalFinal / cantidadJornales : 0;

                                              return `${prof.tipo}: ${cantidadJornales} × $${importeJornalFinal.toLocaleString('es-AR')} = $${subtotalFinal.toLocaleString('es-AR', {minimumFractionDigits: 2})}`;
                                            })()}
                                          </span>
                                          <div style={{display: 'flex', gap: '4px'}}>
                                            <button
                                              type="button"
                                              className="btn btn-sm btn-warning"
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (soloLectura) {
                                                  alert('⚠️ No se puede editar en modo solo lectura');
                                                  return;
                                                }
                                                editarProfesionalDeRubro(item.id, prof);
                                              }}
                                              title="Editar este profesional"
                                              style={{padding: '2px 8px', fontSize: '12px'}}
                                            >
                                              <i className="fas fa-edit"></i>
                                            </button>
                                            <button
                                              type="button"
                                              className="btn btn-sm btn-danger"
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (soloLectura) {
                                                  alert('⚠️ No se puede eliminar en modo solo lectura');
                                                  return;
                                                }
                                                console.log('🗑️ Eliminando profesional:', prof.id);
                                                eliminarProfesionalDeRubro(item.id, prof.id);
                                              }}
                                              title="Eliminar este profesional"
                                              style={{padding: '2px 8px', fontSize: '12px'}}
                                            >
                                              <i className="fas fa-trash-alt"></i>
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {/* ✨ MOSTRAR LISTA DE MATERIALES SI EXISTEN */}
                                  {item.materialesLista && item.materialesLista.length > 0 && (
                                    <div className="mt-1">
                                      <div className="small fw-bold text-success">Materiales:</div>
                                      {item.materialesLista.map((mat) => (
                                        <div key={mat.id} className="small text-muted ms-2" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px'}}>
                                          <span>
                                            <i className="fas fa-box me-1"></i>
                                            {(() => {
                                              const subtotalBase = Number(mat.subtotal || 0);
                                              let subtotalFinal = subtotalBase;
                                              let honorarios = 0;
                                              let mayoresCostosBase = 0;
                                              let mayoresCostosHonorarios = 0;

                                              // Calcular honorarios
                                              if (form.honorarios?.materiales?.activo && form.honorarios?.materiales?.valor) {
                                                const valorHonorario = Number(form.honorarios.materiales.valor);
                                                if (form.honorarios.materiales.tipo === 'porcentaje') {
                                                  honorarios = (subtotalBase * valorHonorario) / 100;
                                                }
                                              }

                                              // Calcular mayores costos sobre la base
                                              if (form.mayoresCostos?.materiales?.activo && form.mayoresCostos?.materiales?.valor) {
                                                const valorMayorCosto = Number(form.mayoresCostos.materiales.valor);
                                                if (form.mayoresCostos.materiales.tipo === 'porcentaje') {
                                                  mayoresCostosBase = (subtotalBase * valorMayorCosto) / 100;
                                                }
                                              }

                                              // Calcular mayores costos sobre honorarios
                                              if (honorarios > 0 && form.mayoresCostos?.honorarios?.activo && form.mayoresCostos?.honorarios?.valor) {
                                                const valorMCHon = Number(form.mayoresCostos.honorarios.valor);
                                                if (form.mayoresCostos.honorarios.tipo === 'porcentaje') {
                                                  mayoresCostosHonorarios = (honorarios * valorMCHon) / 100;
                                                }
                                              }

                                              subtotalFinal = subtotalBase + honorarios + mayoresCostosBase + mayoresCostosHonorarios;
                                              const precioUnitarioFinal = mat.cantidad > 0 ? subtotalFinal / Number(mat.cantidad) : 0;
                                              const precioDisplay = precioUnitarioFinal.toLocaleString('es-AR');

                                              return `${mat.descripcion}: ${mat.cantidad} × $${precioDisplay} = $${subtotalFinal.toLocaleString('es-AR', {minimumFractionDigits: 2})}`;
                                            })()}
                                          </span>
                                          <div style={{display: 'flex', gap: '4px'}}>
                                            <button
                                              type="button"
                                              className="btn btn-sm btn-warning"
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (soloLectura) {
                                                  alert('⚠️ No se puede editar en modo solo lectura');
                                                  return;
                                                }
                                                editarMaterialDeRubro(item.id, mat);
                                              }}
                                              title="Editar este material"
                                              style={{padding: '2px 8px', fontSize: '12px'}}
                                            >
                                              <i className="fas fa-edit"></i>
                                            </button>
                                            <button
                                              type="button"
                                              className="btn btn-sm btn-danger"
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (soloLectura) {
                                                  alert('⚠️ No se puede eliminar en modo solo lectura');
                                                  return;
                                                }
                                                console.log('🗑️ Eliminando material:', mat.id);
                                                eliminarMaterialDeRubro(item.id, mat.id);
                                              }}
                                              title="Eliminar este material"
                                              style={{padding: '2px 8px', fontSize: '12px'}}
                                            >
                                              <i className="fas fa-trash-alt"></i>
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {/* ✨ MOSTRAR LISTA DE GASTOS GENERALES SI EXISTEN */}
                                  {item.gastosGenerales && item.gastosGenerales.length > 0 && (
                                    <div className="mt-1">
                                      <div className="small fw-bold text-warning">Gastos Generales:</div>
                                      {item.gastosGenerales.map((gasto) => {
                                        const subtotalBase = Number(gasto.subtotal || 0);
                                        let subtotalFinal = subtotalBase;
                                        let honorarios = 0;
                                        let mayoresCostosBase = 0;
                                        let mayoresCostosHonorarios = 0;

                                        // Calcular honorarios
                                        if (form.honorarios?.otrosCostos?.activo && form.honorarios?.otrosCostos?.valor) {
                                          const valorHonorario = Number(form.honorarios.otrosCostos.valor);
                                          if (form.honorarios.otrosCostos.tipo === 'porcentaje') {
                                            honorarios = (subtotalBase * valorHonorario) / 100;
                                          }
                                        }

                                        // Calcular mayores costos sobre la base
                                        if (form.mayoresCostos?.otrosCostos?.activo && form.mayoresCostos?.otrosCostos?.valor) {
                                          const valorMayorCosto = Number(form.mayoresCostos.otrosCostos.valor);
                                          if (form.mayoresCostos.otrosCostos.tipo === 'porcentaje') {
                                            mayoresCostosBase = (subtotalBase * valorMayorCosto) / 100;
                                          }
                                        }

                                        // Calcular mayores costos sobre honorarios
                                        if (honorarios > 0 && form.mayoresCostos?.honorarios?.activo && form.mayoresCostos?.honorarios?.valor) {
                                          const valorMCHon = Number(form.mayoresCostos.honorarios.valor);
                                          if (form.mayoresCostos.honorarios.tipo === 'porcentaje') {
                                            mayoresCostosHonorarios = (honorarios * valorMCHon) / 100;
                                          }
                                        }

                                        subtotalFinal = subtotalBase + honorarios + mayoresCostosBase + mayoresCostosHonorarios;
                                        const cantidad = Number(gasto.cantidad || 0);
                                        const precioUnitarioFinal = cantidad > 0 ? subtotalFinal / cantidad : 0;

                                        return (
                                          <div key={gasto.id || Math.random()} className="small text-muted ms-2" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                            <span>
                                              <i className="fas fa-receipt me-1"></i>
                                              {gasto.descripcion}: {cantidad} × ${precioUnitarioFinal.toLocaleString('es-AR')} = ${subtotalFinal.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                            </span>
                                            <div style={{display: 'flex', gap: '4px'}}>
                                              <button
                                                type="button"
                                                className="btn btn-sm btn-warning py-0 px-1"
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  if (soloLectura) {
                                                    alert('⚠️ No se puede editar en modo solo lectura');
                                                    return;
                                                  }
                                                  editarGastoDeRubro(item.id, gasto);
                                                }}
                                                title="Editar este gasto"
                                                style={{fontSize: '10px'}}
                                              >
                                                <i className="fas fa-edit" style={{fontSize: '9px'}}></i>
                                              </button>
                                              <button
                                                type="button"
                                                className="btn btn-sm btn-danger py-0 px-1"
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  console.log('🔴 Click en botón eliminar gasto del rubro');
                                                  console.log('  - soloLectura:', soloLectura);
                                                  console.log('  - item.id:', item.id);
                                                  console.log('  - gasto:', gasto);
                                                  if (soloLectura) {
                                                    alert('⚠️ No se puede eliminar en modo solo lectura');
                                                    return;
                                                  }
                                                  eliminarGastoDeRubro(item.id, gasto.id);
                                                }}
                                                title="Eliminar este gasto del rubro"
                                                style={{fontSize: '10px'}}
                                              >
                                                <i className="fas fa-trash-alt" style={{fontSize: '9px'}}></i>
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* ✨ MOSTRAR LISTA DE JORNALES SI EXISTEN */}
                                  {item.jornales && item.jornales.length > 0 && (
                                    <div className="mt-1">
                                      <div className="small fw-bold text-primary">Jornales:</div>
                                      {item.jornales.map((jornal) => {
                                        const cantidad = Number(jornal.cantidadJornales || jornal.cantidad || 0);
                                        const valorUnitarioBase = Number(jornal.importeJornal || jornal.valorUnitario || 0);
                                        const subtotalBase = Number(jornal.subtotal || (cantidad * valorUnitarioBase));

                                        let honorarios = 0;
                                        let mayoresCostosBase = 0;
                                        let mayoresCostosHonorarios = 0;

                                        // Calcular honorarios para jornales
                                        if (form.honorarios?.jornales?.activo) {
                                          const configJornales = form.honorarios.jornales;
                                          // Modo porRol
                                          if (configJornales.modoAplicacion === 'porRol' && configJornales.porRol) {
                                            const configRol = configJornales.porRol[jornal.rol];
                                            if (configRol) {
                                              if (configRol.tipo === 'porcentaje') {
                                                honorarios = (subtotalBase * Number(configRol.valor)) / 100;
                                              } else {
                                                honorarios = Number(configRol.valor);
                                              }
                                            }
                                          }
                                          // Modo todos
                                          else if (configJornales.modoAplicacion === 'todos' && configJornales.valor) {
                                            const valor = Number(configJornales.valor);
                                            if (configJornales.tipo === 'porcentaje') {
                                              honorarios = (subtotalBase * valor) / 100;
                                            } else {
                                              honorarios = valor;
                                            }
                                          }
                                        }

                                        // Calcular mayores costos sobre la base
                                        if (form.mayoresCostos?.jornales?.activo) {
                                          const configJornales = form.mayoresCostos.jornales;
                                          // Modo porRol
                                          if (configJornales.modoAplicacion === 'porRol' && configJornales.porRol) {
                                            const configRol = configJornales.porRol[jornal.rol];
                                            if (configRol) {
                                              if (configRol.tipo === 'porcentaje') {
                                                mayoresCostosBase = (subtotalBase * Number(configRol.valor)) / 100;
                                              } else {
                                                mayoresCostosBase = Number(configRol.valor);
                                              }
                                            }
                                          }
                                          // Modo todos
                                          else if (configJornales.modoAplicacion === 'todos' && configJornales.valor) {
                                            const valor = Number(configJornales.valor);
                                            if (configJornales.tipo === 'porcentaje') {
                                              mayoresCostosBase = (subtotalBase * valor) / 100;
                                            } else {
                                              mayoresCostosBase = valor;
                                            }
                                          }
                                        }

                                        // Calcular mayores costos sobre honorarios
                                        if (honorarios > 0 && form.mayoresCostos?.honorarios?.activo && form.mayoresCostos?.honorarios?.valor) {
                                          const valorMCHon = Number(form.mayoresCostos.honorarios.valor);
                                          if (form.mayoresCostos.honorarios.tipo === 'porcentaje') {
                                            mayoresCostosHonorarios = (honorarios * valorMCHon) / 100;
                                          }
                                        }

                                        const subtotalFinal = subtotalBase + honorarios + mayoresCostosBase + mayoresCostosHonorarios;
                                        const valorUnitarioFinal = cantidad > 0 ? subtotalFinal / cantidad : 0;
                                        const subtotal = subtotalFinal;

                                        // ✨ Los checkboxes SIEMPRE empiezan destildados, el usuario debe tildarlos explícitamente
                                        const esModoManual = form.calculoAutomaticoDiasHabiles === false;
                                        const valorCheckbox = jornal.incluirEnCalculoDias === true ? true : false; // Solo true si fue explícitamente marcado

                                        return (
                                          <div key={jornal.id || Math.random()} className="small text-muted ms-2" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                            <span style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                              {/* 🆕 CHECKBOX INDIVIDUAL POR JORNAL */}
                                              <input
                                                type="checkbox"
                                                checked={valorCheckbox}
                                                onChange={(e) => {
                                                  console.log('🔄 Cambiando checkbox jornal:', {
                                                    jornal: jornal.rol || jornal.tipoProfesional,
                                                    nuevoValor: e.target.checked,
                                                    itemId: item.id
                                                  });
                                                  // Actualizar solo este jornal específico
                                                  const nuevosItems = itemsCalculadora.map(i =>
                                                    i.id === item.id
                                                      ? {
                                                          ...i,
                                                          jornales: (i.jornales || []).map(j =>
                                                            (j.id === jornal.id || j.rol === jornal.rol)
                                                              ? { ...j, incluirEnCalculoDias: e.target.checked }
                                                              : j
                                                          )
                                                        }
                                                      : i
                                                  );
                                                  console.log('🔄 Items actualizados:', nuevosItems.find(i => i.id === item.id));
                                                  setItemsCalculadora(nuevosItems);
                                                }}
                                                disabled={soloLectura || esModoManual} // ✨ Deshabilitar en modo manual
                                                className="form-check-input"
                                                style={{
                                                  cursor: (soloLectura || esModoManual) ? 'not-allowed' : 'pointer',
                                                  transform: 'scale(1.2)',
                                                  margin: '0 8px 0 0',
                                                  accentColor: esModoManual ? '#6c757d' : '#007bff',
                                                  opacity: esModoManual ? 0.5 : 1
                                                }}
                                                title={esModoManual
                                                  ? `🔒 Modo manual activo - Este checkbox está deshabilitado`
                                                  : (valorCheckbox
                                                    ? `✅ ${jornal.rol || jornal.tipoProfesional}: Incluido en cálculo de días hábiles`
                                                    : `❌ ${jornal.rol || jornal.tipoProfesional}: Excluido del cálculo de días hábiles`)
                                                }
                                              />
                                              <span>
                                                <i className="fas fa-user-clock me-1"></i>
                                                {jornal.rol}: {cantidad} × ${valorUnitarioFinal.toLocaleString('es-AR')} = ${subtotal.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                              </span>
                                            </span>
                                            <div style={{display: 'flex', gap: '4px'}}>
                                              <button
                                                type="button"
                                                className="btn btn-sm btn-warning py-0 px-1"
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  if (soloLectura) {
                                                    alert('⚠️ No se puede editar en modo solo lectura');
                                                    return;
                                                  }
                                                  editarJornalDeRubro(item.id, jornal);
                                                }}
                                                title="Editar este jornal"
                                                style={{fontSize: '10px'}}
                                              >
                                                <i className="fas fa-edit" style={{fontSize: '9px'}}></i>
                                              </button>
                                              <button
                                                type="button"
                                                className="btn btn-sm btn-danger py-0 px-1"
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  console.log('🔴 Click en botón eliminar jornal del rubro');
                                                  console.log('  - soloLectura:', soloLectura);
                                                  console.log('  - item.id:', item.id);
                                                  console.log('  - jornal:', jornal);
                                                  if (soloLectura) {
                                                    alert('⚠️ No se puede eliminar en modo solo lectura');
                                                    return;
                                                  }
                                                  eliminarJornalDeRubro(item.id, jornal.id);
                                                }}
                                                title="Eliminar este jornal del rubro"
                                                style={{fontSize: '10px'}}
                                              >
                                                <i className="fas fa-trash-alt" style={{fontSize: '9px'}}></i>
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* ✨ MOSTRAR DESCRIPCIÓN DEL RUBRO SI EXISTE */}
                                  {(item.descripcion || item.observaciones ||
                                    item.descripcionProfesionales || item.observacionesProfesionales ||
                                    item.descripcionMateriales || item.observacionesMateriales ||
                                    item.descripcionGastosGenerales || item.observacionesGastosGenerales) && (
                                    <div className="mt-2 pt-2" style={{borderTop: '1px dashed #ddd'}}>
                                      {/* Descripción y Observaciones Generales */}
                                      {item.descripcion && (
                                        <div className="mb-1">
                                          <div className="small fw-bold text-info">
                                            <i className="fas fa-file-alt me-1"></i>Descripción General:
                                          </div>
                                          <div className="small text-muted ms-2" style={{fontStyle: 'italic'}}>
                                            {item.descripcion}
                                          </div>
                                        </div>
                                      )}
                                      {item.observaciones && (
                                        <div className="mb-2">
                                          <div className="small fw-bold text-secondary">
                                            <i className="fas fa-sticky-note me-1"></i>Observaciones Generales:
                                          </div>
                                          <div className="small text-muted ms-2" style={{fontStyle: 'italic'}}>
                                            {item.observaciones}
                                          </div>
                                        </div>
                                      )}

                                      {/* Descripciones y Observaciones por Categoría */}
                                      {(item.descripcionProfesionales || item.observacionesProfesionales) && (
                                        <div className="mb-2">
                                          <div className="small fw-bold text-primary">
                                            <i className="fas fa-users me-1"></i>Profesionales:
                                          </div>
                                          {item.descripcionProfesionales && (
                                            <div className="small text-muted ms-3">
                                              <strong>Descripción:</strong> <span style={{fontStyle: 'italic'}}>{item.descripcionProfesionales}</span>
                                            </div>
                                          )}
                                          {item.observacionesProfesionales && (
                                            <div className="small text-muted ms-3">
                                              <strong>Observaciones:</strong> <span style={{fontStyle: 'italic'}}>{item.observacionesProfesionales}</span>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {(item.descripcionMateriales || item.observacionesMateriales) && (
                                        <div className="mb-2">
                                          <div className="small fw-bold text-success">
                                            <i className="fas fa-box me-1"></i>Materiales:
                                          </div>
                                          {item.descripcionMateriales && (
                                            <div className="small text-muted ms-3">
                                              <strong>Descripción:</strong> <span style={{fontStyle: 'italic'}}>{item.descripcionMateriales}</span>
                                            </div>
                                          )}
                                          {item.observacionesMateriales && (
                                            <div className="small text-muted ms-3">
                                              <strong>Observaciones:</strong> <span style={{fontStyle: 'italic'}}>{item.observacionesMateriales}</span>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {(item.descripcionGastosGenerales || item.observacionesGastosGenerales) && (
                                        <div>
                                          <div className="small fw-bold text-warning">
                                            <i className="fas fa-receipt me-1"></i>Gastos Generales:
                                          </div>
                                          {item.descripcionGastosGenerales && (
                                            <div className="small text-muted ms-3">
                                              <strong>Descripción:</strong> <span style={{fontStyle: 'italic'}}>{item.descripcionGastosGenerales}</span>
                                            </div>
                                          )}
                                          {item.observacionesGastosGenerales && (
                                            <div className="small text-muted ms-3">
                                              <strong>Observaciones:</strong> <span style={{fontStyle: 'italic'}}>{item.observacionesGastosGenerales}</span>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {(item.descripcionTotalManual || item.observacionesTotalManual) && (
                                        <div>
                                          <div className="small fw-bold text-secondary">
                                            <i className="fas fa-calculator me-1"></i>Total Manual:
                                          </div>
                                          {item.descripcionTotalManual && (
                                            <div className="small text-muted ms-3">
                                              <strong>Descripción:</strong> <span style={{fontStyle: 'italic'}}>{item.descripcionTotalManual}</span>
                                            </div>
                                          )}
                                          {item.observacionesTotalManual && (
                                            <div className="small text-muted ms-3">
                                              <strong>Observaciones:</strong> <span style={{fontStyle: 'italic'}}>{item.observacionesTotalManual}</span>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td className="small">
                                  {item.esRubroVacio ? (
                                    <div className="text-center">
                                      <span className="badge bg-warning text-dark">
                                        <i className="fas fa-hourglass-half me-1"></i>Sin contenido
                                      </span>
                                      <div className="small text-muted mt-1">
                                        Haga clic en "Editar" para agregar profesionales y materiales
                                      </div>
                                    </div>
                                  ) : item.esModoManual ? (
                                    <span className="badge bg-secondary">Manual</span>
                                  ) : (
                                    <>
                                      {(item.profesionales && item.profesionales.length > 0) || (item.materialesLista && item.materialesLista.length > 0) || (item.gastosGenerales && item.gastosGenerales.length > 0) || (item.jornales && item.jornales.length > 0) ? (
                                        <div>
                                          {(() => {
                                            // ✅ CALCULAR BADGES CON LA MISMA LÓGICA QUE LA COLUMNA DE DETALLES
                                            let materialesFinal = 0;
                                            let gastosGeneralesFinal = 0;
                                            let jornalesFinal = 0;

                                            // MATERIALES - Calcular individualmente cada material
                                            if (item.materialesLista && item.materialesLista.length > 0) {
                                              item.materialesLista.forEach(mat => {
                                                const subtotalBase = Number(mat.subtotal || 0);
                                                let honorarios = 0;
                                                let mayoresCostosBase = 0;
                                                let mayoresCostosHonorarios = 0;

                                                if (form.honorarios?.materiales?.activo && form.honorarios?.materiales?.valor) {
                                                  const valorHonorario = Number(form.honorarios.materiales.valor);
                                                  if (form.honorarios.materiales.tipo === 'porcentaje') {
                                                    honorarios = (subtotalBase * valorHonorario) / 100;
                                                  }
                                                }

                                                if (form.mayoresCostos?.materiales?.activo && form.mayoresCostos?.materiales?.valor) {
                                                  const valorMayorCosto = Number(form.mayoresCostos.materiales.valor);
                                                  if (form.mayoresCostos.materiales.tipo === 'porcentaje') {
                                                    mayoresCostosBase = (subtotalBase * valorMayorCosto) / 100;
                                                  }
                                                }

                                                if (honorarios > 0 && form.mayoresCostos?.honorarios?.activo && form.mayoresCostos?.honorarios?.valor) {
                                                  const valorMCHon = Number(form.mayoresCostos.honorarios.valor);
                                                  if (form.mayoresCostos.honorarios.tipo === 'porcentaje') {
                                                    mayoresCostosHonorarios = (honorarios * valorMCHon) / 100;
                                                  }
                                                }

                                                materialesFinal += subtotalBase + honorarios + mayoresCostosBase + mayoresCostosHonorarios;
                                              });
                                            }

                                            // GASTOS GENERALES - Calcular individualmente cada gasto
                                            if (item.gastosGenerales && item.gastosGenerales.length > 0) {
                                              item.gastosGenerales.forEach(gasto => {
                                                const subtotalBase = Number(gasto.subtotal || 0);
                                                let honorarios = 0;
                                                let mayoresCostosBase = 0;
                                                let mayoresCostosHonorarios = 0;

                                                if (form.honorarios?.otrosCostos?.activo && form.honorarios?.otrosCostos?.valor) {
                                                  const valorHonorario = Number(form.honorarios.otrosCostos.valor);
                                                  if (form.honorarios.otrosCostos.tipo === 'porcentaje') {
                                                    honorarios = (subtotalBase * valorHonorario) / 100;
                                                  }
                                                }

                                                if (form.mayoresCostos?.otrosCostos?.activo && form.mayoresCostos?.otrosCostos?.valor) {
                                                  const valorMayorCosto = Number(form.mayoresCostos.otrosCostos.valor);
                                                  if (form.mayoresCostos.otrosCostos.tipo === 'porcentaje') {
                                                    mayoresCostosBase = (subtotalBase * valorMayorCosto) / 100;
                                                  }
                                                }

                                                if (honorarios > 0 && form.mayoresCostos?.honorarios?.activo && form.mayoresCostos?.honorarios?.valor) {
                                                  const valorMCHon = Number(form.mayoresCostos.honorarios.valor);
                                                  if (form.mayoresCostos.honorarios.tipo === 'porcentaje') {
                                                    mayoresCostosHonorarios = (honorarios * valorMCHon) / 100;
                                                  }
                                                }

                                                gastosGeneralesFinal += subtotalBase + honorarios + mayoresCostosBase + mayoresCostosHonorarios;
                                              });
                                            }

                                            // JORNALES - Calcular individualmente cada jornal
                                            if (item.jornales && item.jornales.length > 0) {
                                              item.jornales.forEach(jornal => {
                                                const cantidad = Number(jornal.cantidadJornales || jornal.cantidad || 0);
                                                const valorUnitarioBase = Number(jornal.importeJornal || jornal.valorUnitario || 0);
                                                const subtotalBase = Number(jornal.subtotal || (cantidad * valorUnitarioBase));

                                                let honorarios = 0;
                                                let mayoresCostosBase = 0;
                                                let mayoresCostosHonorarios = 0;

                                                if (form.honorarios?.jornales?.activo) {
                                                  const configJornales = form.honorarios.jornales;
                                                  if (configJornales.modoAplicacion === 'porRol' && configJornales.porRol) {
                                                    const configRol = configJornales.porRol[jornal.rol];
                                                    if (configRol) {
                                                      if (configRol.tipo === 'porcentaje') {
                                                        honorarios = (subtotalBase * Number(configRol.valor)) / 100;
                                                      } else {
                                                        honorarios = Number(configRol.valor);
                                                      }
                                                    }
                                                  } else if (configJornales.modoAplicacion === 'todos' && configJornales.valor) {
                                                    const valor = Number(configJornales.valor);
                                                    if (configJornales.tipo === 'porcentaje') {
                                                      honorarios = (subtotalBase * valor) / 100;
                                                    } else {
                                                      honorarios = valor;
                                                    }
                                                  }
                                                }

                                                if (form.mayoresCostos?.jornales?.activo) {
                                                  const configJornales = form.mayoresCostos.jornales;
                                                  if (configJornales.modoAplicacion === 'porRol' && configJornales.porRol) {
                                                    const configRol = configJornales.porRol[jornal.rol];
                                                    if (configRol) {
                                                      if (configRol.tipo === 'porcentaje') {
                                                        mayoresCostosBase = (subtotalBase * Number(configRol.valor)) / 100;
                                                      } else {
                                                        mayoresCostosBase = Number(configRol.valor);
                                                      }
                                                    }
                                                  } else if (configJornales.modoAplicacion === 'todos' && configJornales.valor) {
                                                    const valor = Number(configJornales.valor);
                                                    if (configJornales.tipo === 'porcentaje') {
                                                      mayoresCostosBase = (subtotalBase * valor) / 100;
                                                    } else {
                                                      mayoresCostosBase = valor;
                                                    }
                                                  }
                                                }

                                                if (honorarios > 0 && form.mayoresCostos?.honorarios?.activo && form.mayoresCostos?.honorarios?.valor) {
                                                  const valorMCHon = Number(form.mayoresCostos.honorarios.valor);
                                                  if (form.mayoresCostos.honorarios.tipo === 'porcentaje') {
                                                    mayoresCostosHonorarios = (honorarios * valorMCHon) / 100;
                                                  }
                                                }

                                                jornalesFinal += subtotalBase + honorarios + mayoresCostosBase + mayoresCostosHonorarios;
                                              });
                                            }

                                            return (
                                              <>
                                                {materialesFinal > 0 && <><br/><span className="badge bg-success mt-1">Mat: ${materialesFinal.toLocaleString('es-AR')}</span></>}
                                                {gastosGeneralesFinal > 0 && <><br/><span className="badge bg-warning text-dark mt-1">G.G.: ${gastosGeneralesFinal.toLocaleString('es-AR')}</span></>}
                                                {jornalesFinal > 0 && <><br/><span className="badge bg-primary mt-1">Jornales: ${jornalesFinal.toLocaleString('es-AR')}</span></>}
                                              </>
                                            );
                                          })()}
                                        </div>
                                      ) : (
                                        <>
                                          {item.cantidadJornales && `${item.cantidadJornales} × $${Number(item.importeJornal).toLocaleString('es-AR')}`}
                                          {item.materialesTotal && <><br/>+ Mat: ${Number(item.materialesTotal).toLocaleString('es-AR')}</>}
                                        </>
                                      )}
                                    </>
                                  )}
                                </td>
                                {/* ✅ MEJORADA: Columna de checkboxes para incluir en cálculo de días */}
                                <td className="text-center" style={{padding: '8px'}}>
                                  {(() => {
                                    // Si tiene jornales individuales, mostrar checkboxes por cada uno
                                    if (item.jornales && Array.isArray(item.jornales) && item.jornales.length > 0) {
                                      return (
                                        <div className="d-flex flex-column align-items-center" style={{gap: '6px'}}>
                                          <div className="small text-muted fw-bold" style={{fontSize: '0.75em'}}>
                                            Por rol:
                                          </div>
                                          {item.jornales.map((jornal, index) => {
                                            const cantidad = Number(jornal.cantidad || jornal.cantidadJornales || 0);
                                            if (cantidad === 0) return null;

                                            // ✨ Los checkboxes SIEMPRE empiezan destildados, el usuario debe tildarlos explícitamente
                                            const esModoManual = form.calculoAutomaticoDiasHabiles === false;
                                            const valorCheckbox = jornal.incluirEnCalculoDias === true ? true : false; // Solo true si fue explícitamente marcado

                                            return (
                                              <div key={jornal.id || index} className="d-flex align-items-center" style={{gap: '6px', fontSize: '0.8em'}}>
                                                <input
                                                  type="checkbox"
                                                  checked={valorCheckbox}
                                                  onChange={(e) => {
                                                    const nuevosItems = itemsCalculadora.map(i =>
                                                      i.id === item.id
                                                        ? {
                                                            ...i,
                                                            jornales: (i.jornales || []).map(j =>
                                                              (j.id === jornal.id || j.rol === jornal.rol)
                                                                ? { ...j, incluirEnCalculoDias: e.target.checked }
                                                                : j
                                                            )
                                                          }
                                                        : i
                                                    );
                                                    setItemsCalculadora(nuevosItems);
                                                  }}
                                                  disabled={soloLectura || esModoManual} // ✨ Deshabilitar en modo manual
                                                  className="form-check-input"
                                                  style={{
                                                    cursor: (soloLectura || esModoManual) ? 'not-allowed' : 'pointer',
                                                    transform: 'scale(1.1)',
                                                    accentColor: esModoManual ? '#6c757d' : '#007bff',
                                                    margin: 0,
                                                    opacity: esModoManual ? 0.5 : 1
                                                  }}
                                                  title={esModoManual
                                                    ? `🔒 Modo manual activo - Este checkbox está deshabilitado`
                                                    : `${valorCheckbox ? '✅' : '❌'} ${jornal.rol || jornal.tipoProfesional}: ${cantidad} días`}
                                                />
                                                <span className="badge bg-info small" style={{fontSize: '0.7em', padding: '2px 6px'}}>
                                                  {cantidad}d
                                                </span>
                                                <span className="small text-truncate" style={{maxWidth: '60px'}} title={jornal.rol || jornal.tipoProfesional}>
                                                  {(jornal.rol || jornal.tipoProfesional || '').split(' ').slice(-1)[0]}
                                                </span>
                                              </div>
                                            );
                                          })}
                                          <div className="small text-muted mt-1" style={{fontSize: '0.7em', borderTop: '1px solid #dee2e6', paddingTop: '4px'}}>
                                            Total oficiales: {(() => {
                                              // ✨ Sumar SOLO OFICIALES marcados con checkbox
                                              return item.jornales.reduce((sum, j) => {
                                                if (j.incluirEnCalculoDias === true) {
                                                  const rolJornal = (j.tipoProfesional || j.rol || '').toLowerCase();
                                                  const esOficial = rolJornal.includes('oficial') && !rolJornal.includes('medio');
                                                  if (esOficial) {
                                                    return sum + (Number(j.cantidad || j.cantidadJornales || 0));
                                                  }
                                                }
                                                return sum;
                                              }, 0);
                                            })()} días
                                          </div>
                                        </div>
                                      );
                                    }

                                    // Si tiene campo legacy cantidadJornales
                                    if (item.cantidadJornales) {
                                      const cantidad = Number(item.cantidadJornales) || 0;
                                      if (cantidad > 0) {
                                        return (
                                          <div className="d-flex flex-column align-items-center" style={{gap: '4px'}}>
                                            <input
                                              type="checkbox"
                                              checked={true} // Legacy siempre incluido
                                              disabled={true}
                                              className="form-check-input"
                                              style={{transform: 'scale(1.1)', accentColor: '#007bff'}}
                                              title="✅ Campo legacy: siempre incluido"
                                            />
                                            <span className="badge bg-secondary small" style={{fontSize: '0.7rem'}}>
                                              {cantidad} días
                                            </span>
                                          </div>
                                        );
                                      }
                                    }

                                    // Si no tiene jornales
                                    return <span className="text-muted small">—</span>;
                                  })()}
                                </td>

                                {/* 🆕 Columna: Trabaja en Paralelo */}
                                <td className="text-center" style={{padding: '8px', verticalAlign: 'middle'}}>
                                  <div className="d-flex flex-column align-items-center" style={{gap: '4px'}}>
                                    {(() => {
                                      // 🔍 Buscar el item ORIGINAL en itemsCalculadora (sin consolidar) para leer el valor correcto
                                      const itemOriginal = itemsCalculadora.find(i => i.id === item.id);
                                      const trabajaEnParaleloReal = itemOriginal?.trabajaEnParalelo;
                                      const valorCheckbox = trabajaEnParaleloReal !== false; // TRUE si es true o undefined (default)

                                      return (
                                        <input
                                          type="checkbox"
                                          checked={valorCheckbox}
                                          onChange={(e) => {
                                            const isChecked = e.target.checked;
                                            console.log('🔄 Checkbox simultaneidad cambiado:', item.tipoProfesional, 'Nuevo valor:', isChecked);

                                            const nuevosItems = itemsCalculadora.map(i =>
                                              i.id === item.id
                                                ? { ...i, trabajaEnParalelo: isChecked }
                                                : i
                                            );

                                            console.log('📦 Actualizando itemsCalculadora con nuevosItems. Total items:', nuevosItems.length);
                                            setItemsCalculadora(nuevosItems);

                                            // ✅ El useEffect se encargará automáticamente del recálculo
                                            // No necesitamos setTimeout porque el useEffect ya tiene itemsCalculadora como dependencia
                                          }}
                                          disabled={soloLectura || form.calculoAutomaticoDiasHabiles === false}
                                          className="form-check-input"
                                          style={{
                                            cursor: (soloLectura || form.calculoAutomaticoDiasHabiles === false) ? 'not-allowed' : 'pointer',
                                            transform: 'scale(1.3)',
                                          }}
                                        />
                                      );
                                    })()}
                                    {(() => {
                                      // 🔍 Usar el mismo valor del checkbox
                                      const itemOriginal = itemsCalculadora.find(i => i.id === item.id);
                                      const trabajaEnParaleloReal = itemOriginal?.trabajaEnParalelo;
                                      const incluido = trabajaEnParaleloReal !== false;

                                      return (
                                        <span
                                          className="badge small"
                                          style={{
                                            fontSize: '0.65rem',
                                            backgroundColor: incluido ? '#28a745' : '#dc3545',
                                            color: 'white'
                                          }}
                                        >
                                          {incluido ? 'Incluido' : 'Excluido'}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                </td>

                                {/* Columna del Total */}
                                <td className="text-end">
                                  {(() => {
                                    // ✅ USAR EL MISMO itemsCalculadoraConsolidados PARA GARANTIZAR CONSISTENCIA
                                    const itemConsolidado = itemsCalculadoraConsolidados.find(
                                      ic => ic.tipoProfesional?.toLowerCase() === item.tipoProfesional?.toLowerCase()
                                    );

                                    if (itemConsolidado && itemConsolidado.total) {
                                      return <strong>${Number(itemConsolidado.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>;
                                    }

                                    // FALLBACK: Si no se encuentra en consolidados, usar el total del item directo
                                    const totalFallback = Number(item.total || 0);
                                    return <strong>${totalFallback.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>;
                                  })()}
                                </td>
                                <td className="text-center">
                                  {!soloLectura && (
                                    <>
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-success me-1"
                                        onClick={() => editarItemCalculadora(item)}
                                        title="Agregar más elementos a este rubro"
                                      >
                                        <i className="fas fa-plus"></i>
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={() => eliminarItemCalculadora(item.tipoProfesional)}
                                        title="Eliminar rubro completo"
                                      >
                                        <i className="fas fa-trash"></i>
                                      </button>
                                    </>
                                  )}
                                </td>
                              </tr>
                            );
                            })}

                            {/* ✨ FILA ESPECIAL: GASTOS GENERALES (de configsOtros) */}
                            {(() => {
                              const gastosGenerales = configsOtros.filter(c => c.rubro === 'Gastos Generales');

                              if (gastosGenerales.length === 0) return null;

                              const totalGastosGenerales = gastosGenerales.reduce((sum, g) => {
                                return sum + Number(g.presupuestoTotal || 0);
                              }, 0);

                              if (totalGastosGenerales === 0) return null;

                              return (
                                <tr className="table-warning">
                                  <td>
                                    <div className="d-flex align-items-center">
                                      <strong>
                                        <i className="fas fa-receipt me-2"></i>
                                        Gastos Generales
                                      </strong>
                                      <span className="badge bg-warning text-dark ms-2 small">
                                        <i className="fas fa-info-circle me-1"></i>
                                        {gastosGenerales.length} config{gastosGenerales.length > 1 ? 's' : ''}
                                      </span>
                                    </div>
                                    <div className="mt-1">
                                      <div className="small fw-bold text-secondary">Configuraciones:</div>
                                      {gastosGenerales.map((gasto, idx) => (
                                        <div key={idx} className="small text-muted ms-2">
                                          <i className="fas fa-circle me-1" style={{fontSize: '6px'}}></i>
                                          {gasto.descripcion || 'Sin descripción'}: ${Number(gasto.presupuestoTotal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="small text-center">
                                    <span className="badge bg-warning text-dark">
                                      <i className="fas fa-wallet me-1"></i>
                                      {gastosGenerales.length} item{gastosGenerales.length > 1 ? 's' : ''}
                                    </span>
                                  </td>
                                  <td className="text-center">
                                    <span className="text-muted">—</span>
                                  </td>
                                  <td className="text-end">
                                    <strong>${totalGastosGenerales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                                  </td>
                                  <td className="text-center">
                                    <small className="text-muted">
                                      <i className="fas fa-cog"></i>
                                    </small>
                                  </td>
                                </tr>
                              );
                            })()}

                            <tr className="table-info">
                              <td colSpan="2" className="text-end fw-bold">TOTAL FINAL:</td>
                              <td></td>
                              <td className="text-end fw-bold">
                                {(() => {
                                  // Suma el campo total de cada rubro consolidado
                                  const totalFinal = itemsCalculadoraConsolidados.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
                                  return `$${totalFinal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
                                })()}
                              </td>
                              <td></td>
                            </tr>
                            </>
                          ) : (
                            <tr key="empty-items">
                              <td colSpan="5" className="text-center text-muted small py-3">
                                📋 No hay tareas agregadas
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {/* Botón al pie de la sección Items agregados */}
                  <div className="mt-4 text-end">
                    {/* DESHABILITADO: Usar botones individuales en su lugar */}
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-lg"
                      disabled
                      title="Use los botones individuales (Agregar Jornal, Agregar Profesional, Agregar Material, etc.) para agregar elementos al rubro"
                    >
                      <i className="fas fa-info-circle me-2"></i>
                      Use los Botones Individuales para agregar elementos
                    </button>
                  </div>
                </div>

                <div className="my-3" style={{height: '2px', background: 'linear-gradient(to right, transparent, #dee2e6, transparent)'}}></div>

                {/* SECCION DESHABILITADA: Items Individuales por Categoria */}
                {false && (
                <>
                <div className="mb-3 border rounded p-3 shadow-sm" style={{backgroundColor: '#cce7ff', borderColor: '#99d1ff'}}>
                  <div className="d-flex justify-content-between align-items-center">
                    <h6
                      className="mb-0"
                      style={{cursor: 'pointer', fontWeight: 'bold', color: '#004085'}}
                      onClick={() => setMostrarItemsIndividuales(!mostrarItemsIndividuales)}
                    >
                      <i className="fas fa-layer-group me-2"></i>
                      Items Individuales por Categoría
                      <span className="ms-2 small">{mostrarItemsIndividuales ? '▼' : '▶'}</span>
                    </h6>
                  </div>
                </div>

                {mostrarItemsIndividuales && (
                <>

                <div className="mb-3 border rounded p-3" style={{backgroundColor: '#f0f8ff'}}>
                  <h6
                    className="mb-2"
                    style={{cursor: 'pointer', fontWeight: 'bold', color: '#0d6efd'}}
                    onClick={() => setMostrarProfesionales(!mostrarProfesionales)}
                  >
                    <i className="fas fa-users me-2"></i>
                    Profesionales
                    <span className="ms-2 small">{mostrarProfesionales ? '▼' : '▶'}</span>
                  </h6>

                  {mostrarProfesionales && (
                    <>
                      {/* Formulario temporal para nuevo profesional */}
                      {!soloLectura && (
                    <div className="border rounded p-3 mb-2 bg-light">
                      {/* Mensaje de error de validación */}
                      {errorValidacionProfesional && (
                        <div className="alert alert-warning alert-dismissible fade show mb-2" role="alert">
                          <i className="fas fa-info-circle me-2"></i>
                          <div style={{ whiteSpace: 'pre-line' }}>{errorValidacionProfesional}</div>
                          <button type="button" className="btn-close" onClick={() => setErrorValidacionProfesional(null)}></button>
                        </div>
                      )}

                      {/* Campos de entrada simplificados */}
                      <div className="d-flex flex-row align-items-end gap-3 flex-wrap">
                        <div style={{minWidth: 130, maxWidth: 130}}>
                          <label className="form-label small mb-1">Profesional / Tipo</label>
                          <input
                            className={`form-control form-control-sm ${errorValidacionProfesional ? 'is-invalid' : ''}`}
                            value={newProfesional.tipoProfesional}
                            onChange={e => updateNewProfesional('tipoProfesional', e.target.value)}
                          />
                        </div>
                        <div style={{minWidth: 120, maxWidth: 120}}>
                          <label className="form-label small mb-1">Nombre <span className="text-muted">(opcional)</span></label>
                          <input
                            className="form-control form-control-sm"
                            placeholder="Ej: Juan Pérez"
                            maxLength="100"
                            value={newProfesional.nombreProfesional || ''}
                            onChange={e => updateNewProfesional('nombreProfesional', e.target.value)}
                          />
                        </div>
                        <div style={{minWidth: 110, maxWidth: 110}}>
                          <label className="form-label small mb-1">Teléfono <span className="text-muted">(opcional)</span></label>
                          <input
                            type="tel"
                            className="form-control form-control-sm"
                            placeholder="351-5555555"
                            maxLength="20"
                            value={newProfesional.telefonoProfesional || ''}
                            onChange={e => updateNewProfesional('telefonoProfesional', e.target.value)}
                          />
                        </div>
                        <div style={{minWidth: 100, maxWidth: 100}}>
                          <label className="form-label small mb-1">Unidad</label>
                          <select
                            className="form-select form-select-sm"
                            value={newProfesional.tipoUnidad || 'jornales'}
                            onChange={e => updateNewProfesional('tipoUnidad', e.target.value)}
                          >
                            <option value="jornales">Jornales</option>
                            <option value="horas">Horas</option>
                          </select>
                        </div>
                        <div style={{minWidth: 75, maxWidth: 75}}>
                          <label className="form-label small mb-1">
                            {newProfesional.tipoUnidad === 'horas' ? 'Horas' : 'Jornales'}
                          </label>
                          <input
                            type="number"
                            min="0"
                            className="form-control form-control-sm"
                            value={newProfesional.cantidadHoras}
                            onChange={e => updateNewProfesional('cantidadHoras', e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                        {newProfesional.tipoUnidad === 'horas' && (
                          <div style={{minWidth: 85, maxWidth: 85}}>
                            <label className="form-label small mb-1">
                              Jornales <span className="text-muted">(opcional)</span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              className="form-control form-control-sm"
                              value={newProfesional.cantidadJornales || ''}
                              onChange={e => updateNewProfesional('cantidadJornales', e.target.value)}
                              placeholder="0"
                              title="Cantidad de días/jornales en los que se distribuyen las horas"
                            />
                          </div>
                        )}
                        <div style={{minWidth: 100, maxWidth: 100}}>
                          <label className="form-label small mb-1">
                            {newProfesional.tipoUnidad === 'horas' ? 'Importe x Hora' : 'Importe x Jornal'}
                          </label>
                          <input
                            type="number"
                            min="0"
                            className="form-control form-control-sm"
                            value={newProfesional.importeXHora}
                            onChange={e => updateNewProfesional('importeXHora', e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                        <div style={{minWidth: 70, maxWidth: 70}}>
                          <label className="form-label small mb-1">Total</label>
                          <div className="form-control-plaintext small">{Number(newProfesional.importeCalculado || 0).toFixed(2)}</div>
                        </div>
                        <button type="button" className="btn btn-success btn-sm" onClick={acceptProfesional}>Aceptar</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={cancelAddProfesional}>Cancelar</button>
                      </div>
                    </div>
                      )}
                    </>
                  )}

                  {/* Tabla de profesionales - siempre visible FUERA del expandible */}
                  <div className="mt-2">
                    <h6 className="mb-2 small text-muted">
                      <i className="fas fa-list me-1"></i>
                      Items agregados ({form.profesionales?.length || 0})
                    </h6>
                    <div className="table-responsive">
                      <table className="table table-sm table-bordered table-hover mb-0">
                        <thead className="table-light">
                          <tr key="profesionales-items-header">
                            <th style={{width: '35%'}}>Descripción</th>
                            <th style={{width: '20%'}} className="text-center">Detalle</th>
                            <th style={{width: '20%'}} className="text-end">Total</th>
                            <th style={{width: '10%'}} className="text-center">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {form.profesionales && form.profesionales.length > 0 ? (
                            <>
                            {form.profesionales.map((p, idx) => {
                              const cantJornales = Number(p.cantidadJornales) || 0;
                              const totalBase = (Number(p.cantidadHoras) || 0) * (cantJornales > 0 ? cantJornales : 1) * (Number(p.importeXHora) || 0);

                              const honorariosActuales = calcularHonorarios();
                              const mayoresCostosActuales = { profesionales: 0, materiales: 0, otrosCostos: 0, honorarios: 0, configuracionPresupuesto: 0, total: 0 };

                              const totalBaseProfesionales = (form.profesionales || []).reduce((sum, prof) => {
                                const cantJ = Number(prof.cantidadJornales) || 0;
                                return sum + ((Number(prof.cantidadHoras) || 0) * (cantJ > 0 ? cantJ : 1) * (Number(prof.importeXHora) || 0));
                              }, 0);

                              const proporcionHonorarios = totalBaseProfesionales > 0
                                ? (totalBase / totalBaseProfesionales) * honorariosActuales.profesionales
                                : 0;

                              const totalFinal = totalBase + proporcionHonorarios;

                              return (
                                <tr key={idx}>
                                  <td>
                                    <strong>{p.tipoProfesional}</strong>
                                    {p.nombreProfesional && <><br/><small className="text-muted">{p.nombreProfesional}</small></>}
                                  </td>
                                  <td className="small text-center">
                                    {p.cantidadHoras} {p.tipoUnidad === 'horas' ? 'h' : 'jornales'}
                                    {cantJornales > 0 && <> × {cantJornales} jornales</>}
                                    {' × $'}{Number(p.importeXHora || 0).toLocaleString('es-AR')}
                                    {p.telefonoProfesional && <><br/><small className="text-muted">☎ {p.telefonoProfesional}</small></>}
                                  </td>
                                  <td className="text-end">
                                    <strong>${totalFinal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                                  </td>
                                  <td className="text-center">
                                    {!soloLectura && (
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={() => removeProfesional(idx)}
                                        title="Eliminar"
                                      >
                                        <i className="fas fa-trash"></i>
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                            <tr className="table-info">
                              <td colSpan="2" className="text-end fw-bold">TOTAL GENERAL:</td>
                              <td className="text-end fw-bold">
                                ${form.profesionales.reduce((sum, p) => {
                                  const cantJornales = Number(p.cantidadJornales) || 0;
                                  return sum + ((Number(p.cantidadHoras) || 0) * (cantJornales > 0 ? cantJornales : 1) * (Number(p.importeXHora) || 0));
                                }, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </td>
                              <td></td>
                            </tr>
                            </>
                          ) : (
                            <tr key="empty-profesionales">
                              <td colSpan="4" className="text-center text-muted small py-3">
                                📋 No hay profesionales agregados
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Formulario detallado cuando se está editando */}
                  {form.profesionales && form.profesionales.map((p, idx) => (
                    <div key={idx} className="row g-2 align-items-center mb-2">
                      <div className="col-md-3">
                        <label className="form-label fw-bold" style={{color: "#000"}}>Profesional / Tipo
                          <input className="form-control" value={p.tipoProfesional || ''} onChange={e => updateProfesional(idx, 'tipoProfesional', e.target.value)} disabled={soloLectura} />
                        </label>
                      </div>
                      <div className="col-md-2">
                        <label className="form-label fw-bold" style={{color: "#000"}}>Nombre <span className="text-muted">(opcional)</span>
                          <input
                            className="form-control"
                            placeholder="Ej: Juan Pérez"
                            maxLength="100"
                            value={p.nombreProfesional || ''}
                            onChange={e => updateProfesional(idx, 'nombreProfesional', e.target.value)}
                            disabled={soloLectura}
                          />
                        </label>
                      </div>
                      <div className="col-md-2">
                        <label className="form-label fw-bold" style={{color: "#000"}}>Teléfono <span className="text-muted">(opcional)</span>
                          <input
                            type="tel"
                            className="form-control"
                            placeholder="351-5555555"
                            maxLength="20"
                            value={p.telefonoProfesional || ''}
                            onChange={e => updateProfesional(idx, 'telefonoProfesional', e.target.value)}
                            disabled={soloLectura}
                          />
                        </label>
                      </div>
                      <div className="col-md-1">
                        <label className="form-label fw-bold" style={{color: "#000"}}>Unidad
                          <select
                            className="form-select"
                            value={p.tipoUnidad || 'jornales'}
                            onChange={e => updateProfesional(idx, 'tipoUnidad', e.target.value)}
                            disabled={soloLectura}
                          >
                            <option value="jornales">Jornales</option>
                            <option value="horas">Horas</option>
                          </select>
                        </label>
                      </div>
                      <div className="col-md-2">
                        <label className="form-label fw-bold" style={{color: "#000"}}>
                          {p.tipoUnidad === 'horas' ? 'Horas' : 'Jornales'}
                          <input
                            type="number"
                            min="0"
                            className="form-control"
                            value={p.cantidadHoras ?? 0}
                            onChange={e => updateProfesional(idx, 'cantidadHoras', e.target.value)}
                            disabled={soloLectura}
                          />
                        </label>
                      </div>
                      {p.tipoUnidad === 'horas' && (
                        <div className="col-md-2">
                          <label
                            className="form-label fw-bold"
                            style={{color: "#000"}}
                            title="Para inspecciones o control: cuántas jornadas/días se distribuyen las horas"
                          >
                            Jornales (opcional)
                            <input
                              type="number"
                              min="0"
                              className="form-control"
                              style={{minWidth: "85px", maxWidth: "85px"}}
                              placeholder="0"
                              value={p.cantidadJornales ?? ''}
                              onChange={e => updateProfesional(idx, 'cantidadJornales', e.target.value)}
                              disabled={soloLectura}
                            />
                          </label>
                        </div>
                      )}
                      <div className="col-md-2">
                        <label className="form-label fw-bold" style={{color: "#000"}}>
                          {p.tipoUnidad === 'horas' ? 'Importe x Hora' : 'Importe x Jornal'}
                          <input
                            type="number"
                            min="0"
                            step="any"
                            className="form-control"
                            value={p.importeXHora ?? 0}
                            onChange={e => updateProfesional(idx, 'importeXHora', e.target.value)}
                            disabled={soloLectura}
                          />
                        </label>
                      </div>
                      {!soloLectura && (
                        <div className="col-md-1 d-flex">
                          <button type="button" className="btn btn-sm btn-danger ms-auto" onClick={() => removeProfesional(idx)}>Eliminar</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <hr className="my-3" style={{border: '1px solid #dee2e6'}} />

                {/* Sección Materiales dinámicos */}
                <div className="mb-3 border rounded p-3" style={{backgroundColor: '#f0fff0'}}>
                  <h6
                    className="mb-2"
                    style={{cursor: 'pointer', fontWeight: 'bold', color: '#198754'}}
                    onClick={() => setMostrarMateriales(!mostrarMateriales)}
                  >
                    <i className="fas fa-boxes me-2"></i>
                    Materiales
                    <span className="ms-2 small">{mostrarMateriales ? '▼' : '▶'}</span>
                  </h6>

                  {mostrarMateriales && (
                    <>
                      {/* Formulario temporal para nuevo material */}
                      {!soloLectura && (
                    <div className="border rounded p-2 mb-2 bg-light">
                      {/* Mensaje de error de validación */}
                      {errorValidacionMaterial && (
                        <div className="alert alert-danger alert-dismissible fade show mb-2" role="alert">
                          <i className="fas fa-exclamation-triangle me-2"></i>
                          <div style={{ whiteSpace: 'pre-line' }}>{errorValidacionMaterial}</div>
                          <button type="button" className="btn-close" onClick={() => setErrorValidacionMaterial(null)}></button>
                        </div>
                      )}

                      <div className="d-flex flex-row align-items-end gap-3">
                        <div style={{minWidth: 200}}>
                          <label className="form-label small mb-1">Tipo material</label>
                          <input
                            className={`form-control form-control-sm ${errorValidacionMaterial ? 'is-invalid' : ''}`}
                            value={newMaterial.tipoMaterial}
                            onChange={e => updateNewMaterial('tipoMaterial', e.target.value)}
                          />
                        </div>
                        <div style={{minWidth: 100}}>
                          <label className="form-label small mb-1">Cantidad</label>
                          <input type="number" min="0" step="any" className="form-control form-control-sm" value={newMaterial.cantidad} onChange={e => updateNewMaterial('cantidad', e.target.value)} />
                        </div>
                        <div style={{minWidth: 120}}>
                          <label className="form-label small mb-1">Precio unitario</label>
                          <input type="number" min="0" step="any" className="form-control form-control-sm" value={newMaterial.precioUnitario} onChange={e => updateNewMaterial('precioUnitario', e.target.value)} />
                        </div>
                        <button type="button" className="btn btn-success btn-sm" onClick={acceptMaterial}>Aceptar</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={cancelAddMaterial}>Cancelar</button>
                      </div>
                    </div>
                      )}
                    </>
                  )}

                  {/* Tabla de materiales - siempre visible FUERA del expandible */}
                  <div className="mt-2">
                    <h6 className="mb-2 small text-muted">
                      <i className="fas fa-list me-1"></i>
                      Items agregados ({form.materiales?.length || 0})
                    </h6>
                    <div className="table-responsive">
                      <table className="table table-sm table-bordered table-hover mb-0">
                        <thead className="table-light">
                          <tr key="materiales-items-header">
                            <th style={{width: '35%'}}>Descripción</th>
                            <th style={{width: '20%'}} className="text-center">Detalle</th>
                            <th style={{width: '20%'}} className="text-end">Total</th>
                            <th style={{width: '10%'}} className="text-center">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {form.materiales && form.materiales.length > 0 ? (
                            <>
                            {form.materiales.map((m, idx) => {
                              const totalBase = (Number(m.cantidad) || 0) * (Number(m.precioUnitario) || 0);

                              const honorariosActuales = calcularHonorarios();
                              const mayoresCostosActuales = { profesionales: 0, materiales: 0, otrosCostos: 0, honorarios: 0, configuracionPresupuesto: 0, total: 0 };

                              const totalBaseMateriales = (form.materiales || []).reduce((sum, mat) =>
                                sum + ((Number(mat.cantidad) || 0) * (Number(mat.precioUnitario) || 0)), 0
                              );

                              const proporcionHonorarios = totalBaseMateriales > 0
                                ? (totalBase / totalBaseMateriales) * honorariosActuales.materiales
                                : 0;

                              const totalFinal = totalBase + proporcionHonorarios;

                              return (
                                <tr key={idx}>
                                  <td>
                                    <strong>{m.tipoMaterial}</strong>
                                  </td>
                                  <td className="small text-center">
                                    {m.cantidad} × ${Number(m.precioUnitario || 0).toLocaleString('es-AR')}
                                  </td>
                                  <td className="text-end">
                                    <strong>${totalFinal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                                  </td>
                                  <td className="text-center">
                                    {!soloLectura && (
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={() => removeMaterial(idx)}
                                        title="Eliminar"
                                      >
                                        <i className="fas fa-trash"></i>
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                            <tr className="table-info">
                              <td colSpan="2" className="text-end fw-bold">TOTAL GENERAL:</td>
                              <td className="text-end fw-bold">
                                ${form.materiales.reduce((sum, m) => sum + ((Number(m.cantidad) || 0) * (Number(m.precioUnitario) || 0)), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </td>
                              <td></td>
                            </tr>
                            </>
                          ) : (
                            <tr key="empty-materiales">
                              <td colSpan="4" className="text-center text-muted small py-3">
                                📋 No hay materiales agregados
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Formulario detallado cuando se está editando */}
                  {showAddMaterial && form.materiales && form.materiales.map((m, idx) => (
                    <div key={idx} className="row g-2 align-items-center mb-2">
                      <div className="col-md-6">
                        <label className="form-label fw-bold" style={{color: "#000"}}>Tipo material
                          <input className="form-control" value={m.tipoMaterial || ''} onChange={(e) => updateMaterial(idx, 'tipoMaterial', e.target.value)} disabled={soloLectura} />
                        </label>
                      </div>
                      <div className="col-md-3">
                        <label className="form-label fw-bold" style={{color: "#000"}}>Cantidad
                          <input type="number" min="0" step="any" className="form-control" value={m.cantidad ?? 0} onChange={(e) => updateMaterial(idx, 'cantidad', e.target.value)} disabled={soloLectura} />
                        </label>
                      </div>
                      <div className="col-md-2">
                        <label className="form-label fw-bold" style={{color: "#000"}}>Precio unitario
                          <input type="number" min="0" step="any" className="form-control" value={m.precioUnitario ?? 0} onChange={(e) => updateMaterial(idx, 'precioUnitario', e.target.value)} disabled={soloLectura} />
                        </label>
                      </div>
                      {!soloLectura && (
                        <div className="col-md-1 d-flex">
                          <button type="button" className="btn btn-sm btn-danger ms-auto" onClick={() => removeMaterial(idx)}>Eliminar</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <hr className="my-3" style={{border: '1px solid #dee2e6'}} />

                {/* Sección Otros Costos dinámicos */}
                <div className="mb-3 border rounded p-3" style={{backgroundColor: '#fffbf0'}}>
                  <h6
                    className="mb-2"
                    style={{cursor: 'pointer', fontWeight: 'bold', color: '#ffc107'}}
                    onClick={() => setMostrarOtrosCostos(!mostrarOtrosCostos)}
                  >
                    <i className="fas fa-receipt me-2"></i>
                    Otros Costos
                    <span className="ms-2 small">{mostrarOtrosCostos ? '▼' : '▶'}</span>
                  </h6>

                  {mostrarOtrosCostos && (
                    <>
                      {/* Formulario temporal para nuevo otro costo */}
                  {!soloLectura && (
                    <div className="border rounded p-2 mb-2 bg-light">
                      <div className="d-flex flex-row align-items-end gap-3">
                        <div style={{minWidth: 120}}>
                          <label className="form-label small mb-1">Importe</label>
                          <input type="number" min="0" step="any" className="form-control form-control-sm" value={newOtroCosto.importe} onChange={e => updateNewOtroCosto('importe', e.target.value)} />
                        </div>
                        <div style={{minWidth: 250}}>
                          <label className="form-label small mb-1">Descripción</label>
                          <input className="form-control form-control-sm" value={newOtroCosto.descripcion} onChange={e => updateNewOtroCosto('descripcion', e.target.value)} />
                        </div>
                        <div style={{minWidth: 150}}>
                          <label className="form-label small mb-1">Fecha</label>
                          <input type="date" className="form-control form-control-sm" value={newOtroCosto.fecha} onChange={e => updateNewOtroCosto('fecha', e.target.value)} />
                        </div>
                        <button type="button" className="btn btn-success btn-sm" onClick={acceptOtroCosto}>Aceptar</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={cancelAddOtroCosto}>Cancelar</button>
                      </div>
                    </div>
                      )}
                    </>
                  )}

                  {/* Tabla de otros costos - siempre visible FUERA del expandible */}
                  <div className="mt-2">
                    <h6 className="mb-2 small text-muted">
                      <i className="fas fa-list me-1"></i>
                      Items agregados ({form.otrosCostos?.length || 0})
                    </h6>
                    <div className="table-responsive">
                      <table className="table table-sm table-bordered table-hover mb-0">
                        <thead className="table-light">
                          <tr key="otros-costos-header">
                            <th style={{width: '35%'}}>Descripción</th>
                            <th style={{width: '20%'}} className="text-center">Detalle</th>
                            <th style={{width: '20%'}} className="text-end">Total</th>
                            <th style={{width: '10%'}} className="text-center">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {form.otrosCostos && form.otrosCostos.length > 0 ? (
                            <>
                            {form.otrosCostos.map((o, idx) => {
                              const totalBase = Number(o.importe || 0);

                              const honorariosActuales = calcularHonorarios();
                              const mayoresCostosActuales = { profesionales: 0, materiales: 0, otrosCostos: 0, honorarios: 0, configuracionPresupuesto: 0, total: 0 };

                              const totalBaseOtrosCostos = (form.otrosCostos || []).reduce((sum, oc) =>
                                sum + (Number(oc.importe) || 0), 0
                              );

                              const proporcionHonorarios = totalBaseOtrosCostos > 0
                                ? (totalBase / totalBaseOtrosCostos) * honorariosActuales.otrosCostos
                                : 0;

                              const totalFinal = totalBase + proporcionHonorarios;

                              return (
                                <tr key={idx}>
                                  <td>
                                    <strong>{o.descripcion}</strong>
                                  </td>
                                  <td className="small text-center">
                                    {o.fecha && (
                                      <span className="badge bg-secondary">{new Date(o.fecha).toLocaleDateString('es-AR')}</span>
                                    )}
                                  </td>
                                  <td className="text-end">
                                    <strong>${totalFinal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                                  </td>
                                  <td className="text-center">
                                    {!soloLectura && (
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={() => removeOtroCosto(idx)}
                                        title="Eliminar"
                                      >
                                        <i className="fas fa-trash"></i>
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                            <tr className="table-info">
                              <td colSpan="2" className="text-end fw-bold">TOTAL GENERAL:</td>
                              <td className="text-end fw-bold">
                                ${form.otrosCostos.reduce((sum, o) => sum + (Number(o.importe) || 0), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </td>
                              <td></td>
                            </tr>
                            </>
                          ) : (
                            <tr key="empty-otros-costos">
                              <td colSpan="4" className="text-center text-muted small py-3">
                                📋 No hay otros costos agregados
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Formulario detallado cuando se está editando */}
                  {showAddOtroCosto && form.otrosCostos && form.otrosCostos.map((o, idx) => (
                    <div key={idx} className="row g-2 align-items-center mb-2">
                      <div className="col-md-3">
                        <label className="form-label fw-bold" style={{color: "#000"}}>Importe
                          <input type="number" min="0" step="any" className="form-control" value={o.importe ?? 0} onChange={(e) => updateOtroCosto(idx, 'importe', e.target.value)} disabled={soloLectura} />
                        </label>
                      </div>
                      <div className="col-md-5">
                        <label className="form-label fw-bold" style={{color: "#000"}}>Descripción
                          <input className="form-control" value={o.descripcion || ''} onChange={(e) => updateOtroCosto(idx, 'descripcion', e.target.value)} disabled={soloLectura} />
                        </label>
                      </div>
                      <div className="col-md-3">
                        <label className="form-label fw-bold" style={{color: "#000"}}>Fecha
                          <input type="date" className="form-control" value={o.fecha || ''} onChange={(e) => updateOtroCosto(idx, 'fecha', e.target.value)} disabled={soloLectura} />
                        </label>
                      </div>
                      {!soloLectura && (
                        <div className="col-md-1 d-flex">
                          <button type="button" className="btn btn-sm btn-danger ms-auto" onClick={() => removeOtroCosto(idx)}>Eliminar</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                </>
                )}
                </>
                )}
                </>
                )}
                {/* FIN SECCION DESHABILITADA */}

                </div> {/* Cierre del bloque unificado de Items del Presupuesto */}
              {/* ===FIN_BLOQUE_ITEMS_ORIGINAL_ELIMINAR=== */}

              <hr className="my-5" style={{border: '3px solid #6c757d', order: 2}} />

              {/* Configuración de Honorarios (solo honorarios, sin presupuestos) */}
              <div style={{order: 3}}>
              <ConfiguracionPresupuestoSection
                configsProfesionales={configsProfesionales}
                configsMateriales={configsMateriales}
                configsOtros={configsOtros}
                profesionalesAgregados={form.profesionales}
                materialesAgregados={form.materiales}
                otrosCostosAgregados={form.otrosCostos}
                itemsCalculadora={itemsCalculadora}
                onConfigsChange={handleConfigsChange}
                soloLectura={soloLectura}
                mostrarSolo="honorarios"
                honorarios={(() => {
                  if (!estaCargandoInicialRef.current) {
                    console.log('🚨 PASANDO HONORARIOS AL COMPONENTE:', form.honorarios);
                    console.log('🚨 form.honorarios.jornales:', form.honorarios?.jornales);
                  }
                  return form.honorarios;
                })()}
                onHonorariosChange={(nuevoHonorarios) => {
                  setForm(prev => ({ ...prev, honorarios: nuevoHonorarios }));
                }}
              />
              </div>

              <hr className="my-5" style={{border: '3px solid #6c757d', order: 4}} />

              {/* Configuración de Mayores Costos (clon exacto de Honorarios) */}
              <div style={{order: 5}}>
              <ConfiguracionPresupuestoSection
                configsProfesionales={configsProfesionales}
                configsMateriales={configsMateriales}
                configsOtros={configsOtros}
                profesionalesAgregados={form.profesionales}
                materialesAgregados={form.materiales}
                otrosCostosAgregados={form.otrosCostos}
                itemsCalculadora={itemsCalculadora}
                onConfigsChange={handleConfigsChange}
                soloLectura={soloLectura}
                mostrarSolo="mayoresCostos"
                honorarios={form.honorarios}
                mayoresCostos={form.mayoresCostos}
                onMayoresCostosChange={(nuevoMayoresCostos) => {
                  setForm(prev => ({ ...prev, mayoresCostos: nuevoMayoresCostos }));
                }}
              />
              </div>

              {/* ===MARCADOR_TEMPORAL_INSERTAR_MAYORES_COSTOS_AQUI=== */}

              </div> {/* Cierre del contenedor flex para reordenar */}

              <hr className="my-5" style={{border: '3px solid #6c757d'}} />

              {/* Botones de Imprimir y Exportar */}
              <div className="mt-4">
                <div className="row g-2">
                  <div className="col-12">
                    <h6 className="mb-2 text-dark fw-bold">Acciones de Exportación y Compartir</h6>
                    <p className="small mb-3 fw-bold" style={{ color: '#0AAD0A' }}>
                      📤 Para enviar este presupuesto, guárdalo en alguno de los formatos disponibles
                    </p>
                  </div>

                  {/* Botón Imprimir */}
                  <div className="col-md-3">
                    <button
                      ref={guardarPDFButtonRef}
                      type="button"
                      className="btn btn-outline-primary w-100 btn-sm"
                      onClick={async () => {
                        try {
                          // Construir nombre: NombreObra - Dirección
                          let nombreArchivo = '';

                          // 1. Nombre de la obra
                          if (form.nombreObra && form.nombreObra.trim()) {
                            nombreArchivo = form.nombreObra.trim().replace(/\s+/g, '_');
                          } else {
                            nombreArchivo = 'Presupuesto';
                          }

                          // 2. Dirección de la obra
                          const direccion = [];
                          if (form.direccionObraCalle) direccion.push(form.direccionObraCalle);
                          if (form.direccionObraAltura) direccion.push(form.direccionObraAltura);

                          if (direccion.length > 0) {
                            nombreArchivo += ` - ${direccion.join(' ').replace(/\s+/g, '_')}`;
                          }

                          // 3. Número y versión (opcional)
                          if (form.numeroPresupuesto) {
                            nombreArchivo += `_N${form.numeroPresupuesto}`;
                          }
                          if (form.version) {
                            nombreArchivo += `_v${form.version}`;
                          }

                          nombreArchivo = nombreArchivo.replace(/[^a-zA-Z0-9_\-]/g, '_');

                          const pdfBlob = await exportarAPDFReal(modalContentRef.current, nombreArchivo);


                          const url = window.URL.createObjectURL(pdfBlob);
                          const link = document.createElement('a');
                          link.href = url;
                          const archivoConExtension = nombreArchivo.endsWith('.pdf') ? nombreArchivo : `${nombreArchivo}.pdf`;
                          link.download = archivoConExtension;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          window.URL.revokeObjectURL(url);


                          // 🎯 IMPORTANTE: En modo trabajo extra, continuar con WhatsApp/Email aunque no tenga ID
                          if (!form.id && !modoTrabajoExtra) {
                            alert(`✅ PDF generado y descargado\n\nArchivo: ${archivoConExtension}\n\n⚠️ No se guardó en BD: presupuesto sin ID`);

                            // 📱 Pero si viene con flag de WhatsApp/Email, abrir la aplicación de todos modos
                            if (abrirWhatsAppDespuesDePDF || abrirEmailDespuesDePDF) {
                              // Saltar al código de WhatsApp/Email más abajo
                            } else {
                              return;
                            }
                          }

                          const maxSize = 50 * 1024 * 1024; // 50MB
                          if (pdfBlob.size > maxSize) {
                            alert(`✅ PDF generado y descargado\n\nArchivo: ${archivoConExtension}\n\n⚠️ No se guardó en BD: archivo muy grande (máximo 50MB)`);

                            // 📱 Pero si viene con flag de WhatsApp/Email, abrir la aplicación de todos modos
                            if (abrirWhatsAppDespuesDePDF || abrirEmailDespuesDePDF) {
                              // Continuar con WhatsApp/Email
                            } else {
                              return;
                            }
                          }

                          // Solo guardar en BD si tiene ID y tamaño correcto
                          if (form.id && pdfBlob.size <= maxSize) {
                            const formData = new FormData();
                            formData.append('file', pdfBlob, archivoConExtension);
                            formData.append('nombre_archivo', archivoConExtension);

                            if (!modoTrabajoExtra) {
                              formData.append('version_presupuesto', form.version || 1);
                              formData.append('incluye_honorarios', String(!ocultarHonorariosEnPDF));
                              formData.append('incluye_configuracion', String(!ocultarConfiguracionEnPDF));
                            }

                            // 🔄 Usar endpoint correcto según el modo
                            const endpoint = modoTrabajoExtra
                              ? `/api/v1/trabajos-extra/${form.id}/pdf`
                              : `/api/v1/presupuestos-no-cliente/${form.id}/pdf`;

                            const response = await apiService.post(
                              endpoint,
                              formData,
                              modoTrabajoExtra
                                ? { headers: { empresaId: empresaSeleccionada.id } }
                                : { params: { empresaId: empresaSeleccionada.id } }
                            );

                            if (response.data && response.data.id) {
                              const mensaje = modoTrabajoExtra
                                ? `✅ PDF generado, descargado Y guardado en la base de datos\n\nArchivo: ${archivoConExtension}\nID en BD: ${response.data.id}\nFecha: ${new Date(response.data.fechaGeneracion).toLocaleString('es-AR')}`
                                : `✅ PDF generado, descargado Y guardado en la base de datos\n\nArchivo: ${archivoConExtension}\nID en BD: ${response.data.id}\nFecha: ${new Date(response.data.fechaGeneracion).toLocaleString('es-AR')}`;
                              alert(mensaje);
                            } else {
                              alert(`✅ PDF generado, descargado Y guardado en la base de datos\n\nArchivo: ${archivoConExtension}\nEstado: ${response.status || 'OK'}`);
                            }

                            // Marcar como ENVIADO segun tipo
                            if (modoTrabajoExtra) {
                              await marcarTrabajoExtraComoEnviado();
                            } else {
                              await marcarComoEnviado();
                            }
                          }

                          // 📱 IMPORTANTE: Abrir WhatsApp/Email SIEMPRE que los flags estén activos (independiente de si se guardó en BD)
                          // Si viene desde WhatsApp, abrir WhatsApp Web después de generar el PDF
                          console.log('🔍 Verificando apertura de WhatsApp:', {
                            abrirWhatsAppDespuesDePDF,
                            telefono: form.telefono
                          });

                          if (abrirWhatsAppDespuesDePDF) {
                            console.log('✅ SÍ abrirWhatsAppDespuesDePDF - Preparando apertura de WhatsApp...');
                            setTimeout(() => {
                              console.log('📱 Abriendo WhatsApp Web...');

                              // Si hay teléfono, abrir chat directo, sino solo WhatsApp Web
                              if (form.telefono) {
                                const numeroLimpio = form.telefono.replace(/\D/g, '');
                                const mensaje = `Presupuesto N° ${form.numeroPresupuesto || 'Nuevo'}`;
                                const url = `https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`;
                                console.log('📱 Abriendo chat con teléfono:', url);
                                window.open(url, '_blank');
                              } else {
                                console.log('📱 Abriendo WhatsApp Web general (sin teléfono)');
                                window.open('https://web.whatsapp.com/', '_blank');
                              }

                              const mensaje = `Presupuesto N° ${form.numeroPresupuesto || 'Nuevo'}`;
                              navigator.clipboard.writeText(mensaje);
                              console.log('📋 Mensaje copiado al portapapeles:', mensaje);

                              if (onPDFGenerado) {
                                onPDFGenerado();
                              }
                            }, 500);
                          } else {
                            console.log('❌ NO abrirWhatsAppDespuesDePDF - WhatsApp NO se abrirá');
                          }

                          // Si viene desde Email, abrir Gmail Web después de generar el PDF
                          if (abrirEmailDespuesDePDF) {
                            setTimeout(() => {
                              const emailDestino = form.mail || '';
                              const asunto = `Presupuesto ${form.empresaNombre || 'Sin empresa'} - N° ${form.numeroPresupuesto || 'Nuevo'}`;
                              const cuerpo =
                                `Estimado/a,\n\n` +
                                `Adjunto encontrará el presupuesto solicitado.\n\n` +
                                `Empresa: ${form.empresaNombre || 'Sin empresa'}\n` +
                                `Presupuesto N°: ${form.numeroPresupuesto || 'Nuevo'}\n` +
                                `Versión: ${form.version || 1}\n` +
                                `Obra: ${form.direccionObraCalle || ''} ${form.direccionObraAltura || ''}\n\n` +
                                `Saludos cordiales.`;

                              // Abrir Gmail Web con el formulario prellenado
                              const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emailDestino)}&su=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
                              window.open(gmailUrl, '_blank');

                              alert('Gmail Web abierto.\n\n📎 Haz clic en el icono de ADJUNTAR (clip) en Gmail\n📄 Selecciona el PDF descargado\n📧 Envía el email\n\nDestinatario: ' + (emailDestino || '(sin email configurado)'));

                              if (onPDFGenerado) {
                                onPDFGenerado();
                              }
                            }, 500);
                          }

                        } catch (error) {
                          if (error.response) {
                            alert(`❌ Error del servidor: ${error.response.data?.message || error.message}`);
                          } else {
                            alert('❌ Error al generar el PDF: ' + error.message);
                          }
                        }
                      }}
                      title="Guardar como PDF con texto seleccionable y almacenar en BD"
                    >
                      <i className="fas fa-file-pdf me-1"></i>
                      Guardar PDF
                    </button>
                  </div>

                  {/* Eliminado botón duplicado 'Guardar PDF' (placeholder) para evitar duplicados en la UI */}

                  <div className="col-md-3">
                    <button
                      type="button"
                      className="btn btn-outline-secondary w-100 btn-sm"
                      onClick={async () => {
                        // Construir nombre: NombreObra - Dirección
                        let nombreArchivo = '';

                        // 1. Nombre de la obra
                        if (form.nombreObra && form.nombreObra.trim()) {
                          nombreArchivo = form.nombreObra.trim().replace(/\s+/g, '_');
                        } else {
                          nombreArchivo = 'Presupuesto';
                        }

                        // 2. Dirección de la obra
                        const direccion = [];
                        if (form.direccionObraCalle) direccion.push(form.direccionObraCalle);
                        if (form.direccionObraAltura) direccion.push(form.direccionObraAltura);

                        if (direccion.length > 0) {
                          nombreArchivo += ` - ${direccion.join(' ').replace(/\s+/g, '_')}`;
                        }

                        // 3. Número y versión (opcional)
                        if (form.numeroPresupuesto) {
                          nombreArchivo += `_N${form.numeroPresupuesto}`;
                        }
                        if (form.version) {
                          nombreArchivo += `_v${form.version}`;
                        }

                        // Exportar el contenido del modal como HTML para Word
                        const contenido = modalContentRef.current;
                        if (!contenido) {
                          alert('No se pudo obtener el contenido del presupuesto');
                          return;
                        }

                        const htmlContent = `
                          <!DOCTYPE html>
                          <html>
                          <head>
                            <meta charset="utf-8">
                            <title>${nombreArchivo}</title>
                            <style>
                              body { font-family: Arial, sans-serif; margin: 20px; }
                              table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
                              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                              th { background-color: #f2f2f2; }
                              .card { border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; }
                              h1, h2, h3, h4, h5, h6 { color: #333; }
                            </style>
                          </head>
                          <body>
                            ${contenido.innerHTML}
                          </body>
                          </html>
                        `;

                        const blob = new Blob([htmlContent], { type: 'application/msword' });
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `${nombreArchivo}.doc`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);

                        // Marcar presupuesto como ENVIADO
                        await marcarComoEnviado();

                        alert(`✅ Documento Word descargado\n\nArchivo: ${nombreArchivo}.doc`);
                      }}
                      title="Guardar como Word (.doc) - se puede editar en Microsoft Word"
                    >
                      <i className="fas fa-file-word me-1"></i>Guardar DOC
                    </button>
                  </div>

                  <div className="col-md-3">
                    <button
                      type="button"
                      className="btn btn-outline-success w-100 btn-sm"
                      onClick={() => {
                        const totalProf = form.profesionales.reduce((sum, p) => sum + (Number(p.importeCalculado) || 0), 0);
                        const totalMat = form.materiales.reduce((sum, m) => sum + ((Number(m.cantidad) || 0) * (Number(m.precioUnitario) || 0)), 0);
                        const totalOtros = form.otrosCostos.reduce((sum, oc) => sum + (Number(oc.importe) || 0), 0);
                        const totalBase = totalProf + totalMat + totalOtros;
                        const honorariosDesglosados = calcularHonorarios();
                        const mayoresCostosDesglosados = calcularMayoresCostos();
                        const totalConHonorarios = totalBase + (honorariosDesglosados?.total || 0) + (mayoresCostosDesglosados?.total || 0);
                        const datosCompletos = {
                          ...form,
                          incluirProfesionales: mostrarProfesionales,
                          incluirMateriales: mostrarMateriales,
                          incluirOtrosCostos: mostrarOtrosCostos,
                          incluirConfiguracion: mostrarConfiguracionPresupuesto,
                          configsProfesionales: mostrarConfiguracionPresupuesto ? configsProfesionales : [],
                          configsMateriales: mostrarConfiguracionPresupuesto ? configsMateriales : [],
                          configsOtros: mostrarConfiguracionPresupuesto ? configsOtros : [],
                          profesionales: form.profesionales || [],
                          materiales: form.materiales || [],
                          otrosCostos: form.otrosCostos || [],
                          totalProfesionales: totalProf,
                          totalMateriales: totalMat,
                          totalOtrosCostos: totalOtros,
                          montoTotal: totalConHonorarios,
                          honorariosTotal: honorariosDesglosados?.total || 0,
                          mayoresCostosTotal: mayoresCostosDesglosados?.total || 0
                        };
                        const datos = prepararDatosPresupuesto(datosCompletos);
                        const filename = `Presupuesto_${form.numeroPresupuesto || 'nuevo'}_v${form.version}`;
                        exportToExcel(datos, filename, 'Presupuesto');
                      }}
                      title="Exportar a Excel con datos estructurados"
                    >
                      <i className="fas fa-file-excel me-1"></i>
                      Exportar Excel
                    </button>
                  </div>
                </div>
              </div>

              {/* Cálculo de Base (suma de todos los items agregados) */}
              {/* Espaciador para mejorar paginación en PDF */}
              <div className="espaciador-pdf" style={{ height: '60px' }}></div>

              <div className="row mb-3 seccion-base-presupuesto">
                <div className="col-12">
                  <div className="card border-success">
                    <div className="card-body">
                      {(() => {
                        const honorariosActuales = calcularHonorarios();
                        const mayoresCostosActuales = { profesionales: 0, materiales: 0, otrosCostos: 0, honorarios: 0, configuracionPresupuesto: 0, total: 0 };

                        const totalProfItemsBase = form.profesionales.reduce((sum, p) => {
                          if (p.importeCalculado) return sum + Number(p.importeCalculado);
                          const cantJornales = Number(p.cantidadJornales) || 0;
                          return sum + ((Number(p.cantidadHoras) || 0) * (cantJornales > 0 ? cantJornales : 1) * (Number(p.importeXHora) || 0));
                        }, 0);
                        const totalMatItemsBase = form.materiales.reduce((sum, m) => sum + ((Number(m.cantidad) || 0) * (Number(m.precioUnitario) || 0)), 0);
                        const totalOtrosItemsBase = form.otrosCostos.reduce((sum, oc) => sum + (Number(oc.importe) || 0), 0);

                        const totalCalculadoraBase = itemsCalculadora.reduce((sum, item) => sum + (Number(item.total) || 0), 0);

                        let totalProfCalculadoraBase = 0;
                        let totalMatCalculadoraBase = 0;
                        let totalGastosGeneralesCalculadoraBase = 0;

                        itemsCalculadora.forEach(item => {
                          const esGastoGeneral = item.esGastoGeneral === true ||
                                                (item.tipoProfesional?.toLowerCase().includes('gasto') &&
                                                 item.tipoProfesional?.toLowerCase().includes('general'));

                          if (esGastoGeneral) {
                            totalGastosGeneralesCalculadoraBase += parseFloat(item.total) || 0;
                          } else {
                            totalProfCalculadoraBase += parseFloat(item.subtotalManoObra) || 0;
                            totalMatCalculadoraBase += parseFloat(item.subtotalMateriales) || 0;
                          }
                        });

                        const totalProfItems = totalProfItemsBase + honorariosActuales.profesionales + mayoresCostosActuales.profesionales;
                        const totalMatItems = totalMatItemsBase + honorariosActuales.materiales + mayoresCostosActuales.materiales;
                        const totalOtrosItems = totalOtrosItemsBase + honorariosActuales.otrosCostos + mayoresCostosActuales.otrosCostos;

                        const totalCalculadora = totalCalculadoraBase;

                        const totalManoObraCalculadora = itemsCalculadora.reduce((sum, item) => {
                          if (item.esModoManual) return sum;
                          return sum + (Number(item.subtotalManoObra) || 0);
                        }, 0);
                        const totalMaterialesCalculadora = itemsCalculadora.reduce((sum, item) => {
                          if (item.esModoManual) return sum;
                          return sum + (Number(item.subtotalMateriales) || 0);
                        }, 0);
                        const totalManualesCalculadora = itemsCalculadora.reduce((sum, item) => {
                          if (!item.esModoManual) return sum;
                          return sum + (Number(item.totalManual) || 0);
                        }, 0);

                        let totalProf = totalProfItems + totalManoObraCalculadora;
                        let totalMat = totalMatItems + totalMaterialesCalculadora;
                        let totalOtros = totalOtrosItems;
                        let totalManuales = totalManualesCalculadora;

                        if (datosMetrosCuadradosGuardados) {
                          totalProf = (datosMetrosCuadradosGuardados.montoProfesionales || 0) + totalManoObraCalculadora;
                          totalMat = (datosMetrosCuadradosGuardados.montoMateriales || 0) + totalMaterialesCalculadora;
                          totalOtros = datosMetrosCuadradosGuardados.montoOtrosCostos || 0;
                        }

                        let totalCalculadoraCompleto = 0;
                        let totalBaseCalculadora = 0;
                        let totalHonorariosCalculadora = 0;
                        let totalMayoresCostosCalculadora = 0;

                        itemsCalculadoraConsolidados.forEach(item => {
                          // ✅ USAR EL TOTAL YA CALCULADO EN itemsCalculadoraConsolidados
                          // Este total YA incluye: base + honorarios + mayores costos
                          totalCalculadoraCompleto += (item.total || 0);
                        });

                        totalCalculadoraCompleto = itemsCalculadoraConsolidados.reduce((sum, item) => sum + (item.total || 0), 0);

                        // 🔍 DEBUG: Ver detalle del total
                        if (itemsCalculadoraConsolidados.length > 0 && !estaCargandoInicialRef.current) {
                          const item = itemsCalculadoraConsolidados[0];
                          console.log('🔍 TOTAL FINAL DEBUG:', {
                            nombreItem: item.tipoProfesional,
                            subtotalJornales: item.subtotalJornales,
                            honorariosJornales: item.honorariosJornales,
                            mayoresCostosJornales: item.mayoresCostosJornales,
                            totalDelItem: item.total,
                            totalCalculado: totalCalculadoraCompleto
                          });
                        }

                        const totalFinal = totalCalculadoraCompleto;
                        const totalGlobalConHonorarios = totalCalculadoraCompleto;

                        return (
                          <>
                            {/* 📊 COMPOSICIÓN DEL PRESUPUESTO - Versión simplificada */}
                            <div className="mb-3">
                              <h6 className="mb-2 text-muted">
                                <i className="fas fa-clipboard-list me-2"></i>
                                Composición del Presupuesto
                                {/* Indicador si es versión con items heredados */}
                                {form.version > 1 && itemsCalculadora.length > 0 && (
                                  <span className="badge bg-info ms-2" title="Items heredados de versión anterior">
                                    <i className="fas fa-copy me-1"></i>
                                    v{form.version}
                                  </span>
                                )}
                              </h6>

                              {/* Mensaje informativo para versiones con items heredados */}
                              {form.version > 1 && itemsCalculadora.length > 0 && (
                                <div className="alert alert-info py-2 px-3 mb-3" role="alert">
                                  <small>
                                    <i className="fas fa-info-circle me-2"></i>
                                    <strong>Grupos heredados:</strong> Esta versión incluye {itemsCalculadora.length}
                                    {itemsCalculadora.length === 1 ? ' grupo de tareas' : ' grupos de tareas'} copiado(s)
                                    de la versión anterior. Puede editarlos o agregar nuevos grupos.
                                  </small>
                                </div>
                              )}

                              {/* Grupos de Tareas (Calculadora) */}
                              {itemsCalculadora.length > 0 && (
                                <div className="mb-3">
                                  <div className="d-flex justify-content-between align-items-center bg-light p-2 rounded">
                                    <span className="fw-bold text-info">
                                      <i className="fas fa-calculator me-2"></i>
                                      Grupos de Tareas ({itemsCalculadora.length})
                                    </span>
                                    <span className="fw-bold text-info">
                                      {`$${itemsCalculadoraConsolidados.reduce((sum, item) => sum + (item.total || 0), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                                    </span>
                                  </div>

                                  {/* Detalle de cada grupo */}
                                  <div className="ms-3 mt-2" style={{borderLeft: '3px solid #17a2b8', paddingLeft: '12px'}}>
                                    {itemsCalculadoraConsolidados.map((item, idx) => (
                                        <div key={idx} className="mb-2 pb-2" style={{borderBottom: idx < itemsCalculadoraConsolidados.length - 1 ? '1px dashed #dee2e6' : 'none'}}>
                                          <div className="d-flex justify-content-between align-items-start">
                                            <div className="flex-grow-1">
                                              <div className="fw-bold text-dark mb-1" style={{fontSize: '1.1rem'}}>
                                                {idx + 1}. {item.tipoProfesional || item.descripcion || `Tarea ${idx + 1}`}
                                                {/* Mostrar descripción si existe y es diferente del tipo */}
                                                {item.descripcion && item.descripcion !== item.tipoProfesional && (
                                                  <span className="text-muted fw-normal"> - {item.descripcion}</span>
                                                )}
                                              </div>
                                              {/* Subtotales por categoría */}
                                              <div className="small text-muted">
                                                {item.jornales && item.jornales.length > 0 && (
                                                  <div className="mb-1">
                                                    <div className="fw-semibold text-info">
                                                      <i className="fas fa-hard-hat me-2"></i>Jornales: ${(item.subtotalJornalesFinal || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                                    </div>
                                                  </div>
                                                )}
                                                {item.profesionales && item.profesionales.length > 0 && (
                                                  <div className="mb-1">
                                                    <div className="fw-semibold text-primary">
                                                      <i className="fas fa-users me-2"></i>Mano de Obra: ${(item.subtotalManoObraFinal || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                                    </div>
                                                  </div>
                                                )}
                                                {((item.materialesLista && item.materialesLista.length > 0) || (item.materiales && item.materiales.length > 0)) && (
                                                  <div className="mb-1">
                                                    <div className="fw-semibold text-success">
                                                      <i className="fas fa-box me-2"></i>Materiales: ${(item.subtotalMaterialesFinal || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                                    </div>
                                                  </div>
                                                )}
                                                {item.gastosGenerales && item.gastosGenerales.length > 0 && (
                                                  <div className="mb-1">
                                                    <div className="fw-semibold text-warning">
                                                      <i className="fas fa-receipt me-2"></i>Gastos Generales: ${(item.subtotalGastosGeneralesFinal || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                            {/* Mostrar total del grupo: SOLO el campo total consolidado, sin recalcular ni sumar mayores costos nuevamente */}
                                            <div className="ms-3 text-end">
                                              <span className="fw-bold text-dark">
                                                ${Number(item.total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                              </span>
                                            </div>
                                          </div>
                                          {/* ✨ MOSTRAR DESCRIPCIÓN Y OBSERVACIONES DEL RUBRO SI EXISTEN */}
                                          {(item.descripcion || item.observaciones ||
                                            item.descripcionJornales || item.observacionesJornales ||
                                            item.descripcionProfesionales || item.observacionesProfesionales ||
                                            item.descripcionMateriales || item.observacionesMateriales ||
                                            item.descripcionGastosGenerales || item.observacionesGastosGenerales ||
                                            item.descripcionTotalManual || item.observacionesTotalManual) && (
                                            <div className="mt-2 pt-2" style={{borderTop: '1px dashed #dee2e6'}}>
                                              {/* Descripción y Observaciones Generales del Rubro */}
                                              {item.descripcion && (
                                                <div className="mb-1">
                                                <div className="small fw-bold text-info">
                                                  <i className="fas fa-file-alt me-1"></i>Descripción General:
                                                </div>
                                                <div className="small text-muted ms-2" style={{fontStyle: 'italic'}}>
                                                  {item.descripcion}
                                                </div>
                                              </div>
                                            )}
                                            {item.observaciones && (
                                              <div className="mb-2">
                                                <div className="small fw-bold text-secondary">
                                                  <i className="fas fa-sticky-note me-1"></i>Observaciones Generales:
                                                </div>
                                                <div className="small text-muted ms-2" style={{fontStyle: 'italic'}}>
                                                  {item.observaciones}
                                                </div>
                                              </div>
                                            )}

                                            {/* Descripciones y Observaciones por Categoría */}
                                            {(item.descripcionJornales || item.observacionesJornales) && (
                                              <div className="mb-2">
                                                <div className="small fw-bold text-info">
                                                  <i className="fas fa-hard-hat me-1"></i>Jornales:
                                                </div>
                                                {item.descripcionJornales && (
                                                  <div className="small text-muted ms-3">
                                                    <strong>Descripción:</strong> <span style={{fontStyle: 'italic'}}>{item.descripcionJornales}</span>
                                                  </div>
                                                )}
                                                {item.observacionesJornales && (
                                                  <div className="small text-muted ms-3">
                                                    <strong>Observaciones:</strong> <span style={{fontStyle: 'italic'}}>{item.observacionesJornales}</span>
                                                  </div>
                                                )}
                                              </div>
                                            )}

                                            {(item.descripcionProfesionales || item.observacionesProfesionales) && (
                                              <div className="mb-2">
                                                <div className="small fw-bold text-primary">
                                                  <i className="fas fa-users me-1"></i>Profesionales:
                                                </div>
                                                {item.descripcionProfesionales && (
                                                  <div className="small text-muted ms-3">
                                                    <strong>Descripción:</strong> <span style={{fontStyle: 'italic'}}>{item.descripcionProfesionales}</span>
                                                  </div>
                                                )}
                                                {item.observacionesProfesionales && (
                                                  <div className="small text-muted ms-3">
                                                    <strong>Observaciones:</strong> <span style={{fontStyle: 'italic'}}>{item.observacionesProfesionales}</span>
                                                  </div>
                                                )}
                                              </div>
                                            )}

                                            {(item.descripcionMateriales || item.observacionesMateriales) && (
                                              <div className="mb-2">
                                                <div className="small fw-bold text-success">
                                                  <i className="fas fa-box me-1"></i>Materiales:
                                                </div>
                                                {item.descripcionMateriales && (
                                                  <div className="small text-muted ms-3">
                                                    <strong>Descripción:</strong> <span style={{fontStyle: 'italic'}}>{item.descripcionMateriales}</span>
                                                  </div>
                                                )}
                                                {item.observacionesMateriales && (
                                                  <div className="small text-muted ms-3">
                                                    <strong>Observaciones:</strong> <span style={{fontStyle: 'italic'}}>{item.observacionesMateriales}</span>
                                                  </div>
                                                )}
                                              </div>
                                            )}

                                            {(item.descripcionGastosGenerales || item.observacionesGastosGenerales) && (
                                              <div className="mb-2">
                                                <div className="small fw-bold text-warning">
                                                  <i className="fas fa-receipt me-1"></i>Gastos Generales:
                                                </div>
                                                {item.descripcionGastosGenerales && (
                                                  <div className="small text-muted ms-3">
                                                    <strong>Descripción:</strong> <span style={{fontStyle: 'italic'}}>{item.descripcionGastosGenerales}</span>
                                                  </div>
                                                )}
                                                {item.observacionesGastosGenerales && (
                                                  <div className="small text-muted ms-3">
                                                    <strong>Observaciones:</strong> <span style={{fontStyle: 'italic'}}>{item.observacionesGastosGenerales}</span>
                                                  </div>
                                                )}
                                              </div>
                                            )}

                                            {/* Descripciones y Observaciones para Modo Manual (Mano de obra y materiales) */}
                                            {(item.descripcionTotalManual || item.observacionesTotalManual) && (
                                              <div>
                                                <div className="small fw-bold text-dark">
                                                  <i className="fas fa-hand-holding-usd me-1"></i>Mano de Obra y Materiales:
                                                </div>
                                                {item.descripcionTotalManual && (
                                                  <div className="small text-muted ms-3">
                                                    <strong>Descripción:</strong> <span style={{fontStyle: 'italic'}}>{item.descripcionTotalManual}</span>
                                                  </div>
                                                )}
                                                {item.observacionesTotalManual && (
                                                  <div className="small text-muted ms-3">
                                                    <strong>Observaciones:</strong> <span style={{fontStyle: 'italic'}}>{item.observacionesTotalManual}</span>
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* 💼 DESGLOSE POR CATEGORÍA - Mano de Obra, Materiales, Honorarios, Mayores Costos */}
                              <div className="mb-3">
                                <h6 className="mb-2 text-muted small">
                                  <i className="fas fa-list-ul me-2"></i>
                                  Desglose por Categoría
                                </h6>
                                {/* Mostrar cada rubro exactamente como en la tabla de composición */}
                                {itemsCalculadoraConsolidados.map((item, idx) => (
                                  <div key={idx} className="d-flex justify-content-between align-items-center p-2 bg-light mb-2 rounded">
                                    <span>
                                      {item.tipoProfesional === 'Jornales' && <span className="text-primary"><i className="fas fa-hard-hat me-2"></i>Jornales</span>}
                                      {item.tipoProfesional === 'Profesionales' && <span className="text-info"><i className="fas fa-users me-2"></i>Profesionales</span>}
                                      {item.tipoProfesional === 'Materiales' && <span className="text-success"><i className="fas fa-box me-2"></i>Materiales</span>}
                                      {item.tipoProfesional === 'Honorarios' && <span className="text-warning"><i className="fas fa-briefcase me-2"></i>Honorarios</span>}
                                      {item.tipoProfesional === 'Mayores Costos' && <span className="text-danger"><i className="fas fa-exclamation-triangle me-2"></i>Mayores Costos</span>}
                                      {/* Otros rubros personalizados */}
                                      {!['Jornales','Profesionales','Materiales','Honorarios','Mayores Costos'].includes(item.tipoProfesional) && <span className="text-secondary"><i className="fas fa-cube me-2"></i>{item.tipoProfesional}</span>}
                                    </span>
                                    <span className="fw-bold">
                                      ${Number(item.total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              {/* Subtotal Base (solo si NO hay calculadora Y NO hay items manuales) */}
                              {itemsCalculadora.length === 0 && totalProfItemsBase === 0 && totalMatItemsBase === 0 && totalOtrosItemsBase === 0 && (
                                <div className="d-flex justify-content-between align-items-center p-2 border-top">
                                  <span className="fw-bold">Subtotal Base</span>
                                  <span className="fw-bold text-success">
                                    ${totalCalculadoraCompleto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* 💰 TOTAL FINAL - Destacado (honorarios ya incluidos en subtotales) */}
                            <div className="pt-3 border-top border-2 border-success">
                              <div className="bg-success bg-opacity-10 rounded p-3">
                                <div className="d-flex justify-content-between align-items-center">
                                  <div>
                                    <h5 className="mb-0 fw-bold text-success">
                                      <i className="fas fa-money-bill-wave me-2"></i>
                                      TOTAL FINAL
                                    </h5>
                                  </div>
                                  <h3 className="mb-0 fw-bold text-success">
                                    {(() => {
                                      // Sumar solo el campo total de cada rubro, sin duplicar mayores costos ni honorarios
                                      // El campo 'total' de cada item ya debe incluir base + honorarios + mayores costos
                                      const totalFinal = itemsCalculadoraConsolidados.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
                                      return `$${totalFinal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
                                    })()}
                                  </h3>
                                </div>
                                <div className="mt-2">
                                  <small className="text-muted">
                                    Incluye todos los rubros: mano de obra, materiales, jornales, honorarios.
                                  </small>
                                </div>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
              </div> {/* Cierre de div className="row g-2" de línea 1761 */}



              <div className="mt-3 d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
                  {soloLectura ? 'Cerrar' : 'Cancelar'}
                </button>
                {!soloLectura && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={saving}
                    onClick={(e) => handleSubmit(e)}
                  >
                    {saving ? (<><i className="fas fa-spinner fa-spin me-2" />Guardando...</>) : 'Guardar'}
                  </button>
                )}
                {!soloLectura && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={onClose}
                    title="Cerrar sin guardar cambios"
                  >
                    <i className="fas fa-times me-1"></i>
                    Cerrar sin Guardar
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>

    {/* Modal de Previsualización antes de Enviar */}
    {mostrarPrevisualizacion && (datosParaEnviar || form) && (() => {
      const datos = form;

  return (
  <div className="modal show d-block" style={{ zIndex: 10000, backgroundColor: 'rgba(0,0,0,0.7)' }}>
        <div className="modal-dialog modal-fullscreen-md-down modal-xl">
          <div className="modal-content">
            <div className="modal-header bg-primary text-white">
              <h5 className="modal-title">
                <i className="fas fa-eye me-2"></i>
                Previsualización - Confirme antes de enviar
              </h5>
              <button
                type="button"
                className="btn btn-light btn-sm ms-auto"
                onClick={volverAEditar}
                disabled={saving}
              >
                Cerrar
              </button>
            </div>

            <div className="modal-body p-0" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Contenido Responsive */}
              <div className="container-fluid p-3 p-md-4">

                {/* Header con información clave */}
                <div className="row mb-4">
                  <div className="col-12">
                    <div className="card border-primary">
                      <div className="card-body">
                        <div className="row g-3">
                          <div className="col-12 col-md-6">
                            <h4 className="text-primary mb-3">
                              <i className="fas fa-building me-2"></i>
                              {datos.nombreEmpresa || 'Sin empresa'}
                            </h4>
                            <p className="mb-1">
                              <strong>Presupuesto Nº:</strong> {datos.numeroPresupuesto || 'Nuevo'}
                            </p>
                            <p className="mb-1">
                              <strong>Versión:</strong> {datos.version || 1}
                            </p>
                            <p className="mb-0">
                              <strong>Estado:</strong>{' '}
                              <span className={`badge ${
                                datos.estado === 'A_ENVIAR' ? 'bg-success' :
                                datos.estado === 'MODIFICADO' ? 'bg-warning' :
                                datos.estado === 'BORRADOR' ? 'bg-secondary' :
                                'bg-info'
                              }`}>
                                {datos.estado?.replace('_', ' ') || 'Borrador'}
                              </span>
                            </p>
                          </div>
                          <div className="col-12 col-md-6">
                            <p className="mb-1">
                              <strong>Solicitante:</strong> {datos.nombreSolicitante || '-'}
                            </p>
                            <p className="mb-1">
                              <strong>Teléfono:</strong> {datosParaEnviar.telefono || '-'}
                            </p>
                            <p className="mb-1">
                              <strong>Email:</strong> {datosParaEnviar.mail || '-'}
                            </p>
                            <p className="mb-0">
                              <strong>Fecha Emisión:</strong> {datosParaEnviar.fechaEmision ? new Date(datosParaEnviar.fechaEmision).toLocaleDateString('es-AR') : '-'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dirección de Obra */}
                <div className="row mb-4">
                  <div className="col-12">
                    <h5 className="text-secondary border-bottom pb-2 mb-3">
                      <i className="fas fa-map-marker-alt me-2"></i>
                      Dirección de Obra
                    </h5>
                    <div className="row g-2">
                      <div className="col-6 col-md-4 col-lg-3">
                        <small className="text-muted d-block">Barrio</small>
                        <strong>{datosParaEnviar.direccionObraBarrio || '-'}</strong>
                      </div>
                      <div className="col-6 col-md-4 col-lg-3">
                        <small className="text-muted d-block">Calle</small>
                        <strong>{datosParaEnviar.direccionObraCalle || '-'}</strong>
                      </div>
                      <div className="col-6 col-md-4 col-lg-2">
                        <small className="text-muted d-block">Altura</small>
                        <strong>{datosParaEnviar.direccionObraAltura || '-'}</strong>
                      </div>
                      <div className="col-6 col-md-4 col-lg-2">
                        <small className="text-muted d-block">Torre</small>
                        <strong>{datosParaEnviar.direccionObraTorre || '-'}</strong>
                      </div>
                      <div className="col-6 col-md-4 col-lg-2">
                        <small className="text-muted d-block">Piso / Depto</small>
                        <strong>{datosParaEnviar.direccionObraPiso || '-'} / {datosParaEnviar.direccionObraDepartamento || '-'}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fechas */}
                <div className="row mb-4">
                  <div className="col-12">
                    <h5 className="text-secondary border-bottom pb-2 mb-3">
                      <i className="fas fa-calendar me-2"></i>
                      Fechas y Plazos
                    </h5>
                    <div className="row g-2">
                      <div className="col-6 col-md-4">
                        <small className="text-muted d-block">Probable Inicio</small>
                        <strong>{datosParaEnviar.fechaProbableInicio ? (() => {
                          const [year, month, day] = datosParaEnviar.fechaProbableInicio.split('-').map(Number);
                          const fecha = new Date(year, month - 1, day);
                          return fecha.toLocaleDateString('es-AR');
                        })() : '-'}</strong>
                      </div>
                      <div className="col-6 col-md-4">
                        <small className="text-muted d-block">Vencimiento</small>
                        <strong>{datosParaEnviar.vencimiento ? new Date(datosParaEnviar.vencimiento).toLocaleDateString('es-AR') : '-'}</strong>
                      </div>
                      <div className="col-6 col-md-4">
                        <small className="text-muted d-block">Tiempo Estimado</small>
                        <strong>{datosParaEnviar.tiempoEstimadoTerminacion ? `${datosParaEnviar.tiempoEstimadoTerminacion} días` : '-'}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Configuraciones de Presupuesto */}
                {(datosParaEnviar.configuracionesProfesionales?.length > 0 ||
                  datosParaEnviar.configuracionesMateriales?.length > 0 ||
                  datosParaEnviar.configuracionesOtros?.length > 0) && (
                  <div className="row mb-4">
                    <div className="col-12">
                      <h5 className="text-secondary border-bottom pb-2 mb-3">
                        <i className="fas fa-cog me-2"></i>
                        Configuración del Presupuesto
                      </h5>

                      {/* Profesionales Config */}
                      {datosParaEnviar.configuracionesProfesionales?.length > 0 && (
                        <div className="mb-3">
                          <h6 className="text-primary">
                            <i className="fas fa-user-tie me-2"></i>
                            Profesionales ({datosParaEnviar.configuracionesProfesionales.length})
                          </h6>
                          <div className="table-responsive">
                            <table className="table table-sm table-bordered">
                              <thead className="table-light">
                                <tr key="preview-profesionales-header">
                                  <th className="d-none d-md-table-cell">Tipo</th>
                                  <th>Detalle</th>
                                  <th className="text-end">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {datosParaEnviar.configuracionesProfesionales.map((config, idx) => {
                                  const modo = config.importeHora ? 'Hora' :
                                              config.importeDia ? 'Día' :
                                              config.importeSemana ? 'Semana' : 'Mes';
                                  const importe = config.importeHora || config.importeDia || config.importeSemana || config.importeMes || 0;
                                  const cantidad = config.cantidadHoras || config.cantidadDias || config.cantidadSemanas || config.cantidadMeses || 0;

                                  return (
                                    <tr key={idx}>
                                      <td className="d-none d-md-table-cell">{config.tipoProfesional || '<General>'}</td>
                                      <td>
                                        <div className="d-md-none mb-1">
                                          <strong>{config.tipoProfesional || '<General>'}</strong>
                                        </div>
                                        <small>Por {modo}: ${importe.toLocaleString('es-AR')} × {cantidad}</small>
                                      </td>
                                      <td className="text-end">
                                        <strong>${config.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                                      </td>
                                    </tr>
                                  );
                                })}
                                <tr className="table-info">
                                  <td colSpan="2" className="text-end"><strong>Total Profesionales:</strong></td>
                                  <td className="text-end">
                                    <strong>
                                      {
                                        (() => {
                                          // Sumar base + mayor costo para cada profesional, sin duplicar
                                          return datosParaEnviar.configuracionesProfesionales.reduce((sum, c) => {
                                            const base = Number(c.base || c.subtotal || 0);
                                            const mayorCosto = Number(c.mayorCosto || 0);
                                            return sum + base + mayorCosto;
                                          }, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });
                                        })()
                                      }
                                    </strong>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Materiales Config */}
                      {datosParaEnviar.configuracionesMateriales?.length > 0 && (
                        <div className="mb-3">
                          <h6 className="text-success">
                            <i className="fas fa-boxes me-2"></i>
                            Materiales ({datosParaEnviar.configuracionesMateriales.length})
                          </h6>
                          <div className="table-responsive">
                            <table className="table table-sm table-bordered">
                              <thead className="table-light">
                                <tr key="preview-materiales-header">
                                  <th className="d-none d-md-table-cell">Material</th>
                                  <th>Detalle</th>
                                  <th className="text-end">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {datosParaEnviar.configuracionesMateriales.map((config, idx) => (
                                  <tr key={idx}>
                                    <td className="d-none d-md-table-cell">{config.nombreMaterial || '<General>'}</td>
                                    <td>
                                      <div className="d-md-none mb-1">
                                        <strong>{config.nombreMaterial || '<General>'}</strong>
                                      </div>
                                      <small>
                                        {config.cantidad} {config.unidadMedida} × ${config.precioUnitario.toLocaleString('es-AR')}
                                      </small>
                                    </td>
                                    <td className="text-end">
                                      <strong>${config.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                                    </td>
                                  </tr>
                                ))}
                                <tr className="table-success">
                                  <td colSpan="2" className="text-end"><strong>Total Materiales:</strong></td>
                                  <td className="text-end">
                                    <strong>
                                      ${datosParaEnviar.configuracionesMateriales.reduce((sum, c) => sum + Number(c.subtotal || 0), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                    </strong>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Otros Costos Config */}
                      {datosParaEnviar.configuracionesOtros?.length > 0 && (
                        <div className="mb-3">
                          <h6 className="text-warning">
                            <i className="fas fa-dollar-sign me-2"></i>
                            Otros Costos ({datosParaEnviar.configuracionesOtros.length})
                          </h6>
                          <div className="table-responsive">
                            <table className="table table-sm table-bordered">
                              <thead className="table-light">
                                <tr key="preview-otros-costos-header">
                                  <th>Descripción</th>
                                  <th className="text-end">Importe</th>
                                </tr>
                              </thead>
                              <tbody>
                                {datosParaEnviar.configuracionesOtros.map((config, idx) => (
                                  <tr key={idx}>
                                    <td>{config.descripcion || '<General>'}</td>
                                    <td className="text-end">
                                      <strong>${config.importe.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                                    </td>
                                  </tr>
                                ))}
                                <tr className="table-warning">
                                  <td className="text-end"><strong>Total Otros:</strong></td>
                                  <td className="text-end">
                                    <strong>
                                      ${datosParaEnviar.configuracionesOtros.reduce((sum, c) => sum + Number(c.importe || 0), 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                    </strong>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Profesionales Detallados */}
                {datosParaEnviar.profesionales?.length > 0 && (
                  <div className="row mb-4">
                    <div className="col-12">
                      <h5 className="text-secondary border-bottom pb-2 mb-3">
                        <i className="fas fa-users me-2"></i>
                        Profesionales Asignados ({datosParaEnviar.profesionales.length})
                      </h5>
                      <div className="table-responsive">
                        <table className="table table-sm table-hover">
                          <thead className="table-primary">
                            <tr key="assigned-profesionales-header">
                              <th className="d-none d-md-table-cell">#</th>
                              <th>Tipo</th>
                              <th className="d-none d-lg-table-cell">Modalidad</th>
                              <th className="text-end">Importe</th>
                            </tr>
                          </thead>
                          <tbody>
                            {datosParaEnviar.profesionales.map((prof, idx) => {
                              const modo = prof.unidadActiva === 'horas' ? 'Hora' :
                                          prof.unidadActiva === 'dias' ? 'Día' :
                                          prof.unidadActiva === 'semanas' ? 'Semana' :
                                          prof.unidadActiva === 'meses' ? 'Mes' : 'Obra';
                              const importe = prof.importeCalculado || 0;

                              return (
                                <tr key={idx}>
                                  <td className="d-none d-md-table-cell">{idx + 1}</td>
                                  <td>
                                    {prof.tipoProfesional || '-'}
                                    <div className="d-lg-none">
                                      <small className="text-muted">Por {modo}</small>
                                    </div>
                                  </td>
                                  <td className="d-none d-lg-table-cell">
                                    <small>Por {modo}</small>
                                  </td>
                                  <td className="text-end">
                                    ${importe.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Materiales Detallados */}
                {datosParaEnviar.materialesList?.length > 0 && (
                  <div className="row mb-4">
                    <div className="col-12">
                      <h5 className="text-secondary border-bottom pb-2 mb-3">
                        <i className="fas fa-box me-2"></i>
                        Materiales ({datosParaEnviar.materialesList.length})
                      </h5>
                      <div className="table-responsive">
                        <table className="table table-sm table-hover">
                          <thead className="table-success">
                            <tr key="assigned-materiales-header">
                              <th className="d-none d-md-table-cell">#</th>
                              <th>Material</th>
                              <th className="text-end d-none d-lg-table-cell">Cantidad</th>
                              <th className="text-end">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {datosParaEnviar.materialesList.map((mat, idx) => (
                              <tr key={idx}>
                                <td className="d-none d-md-table-cell">{idx + 1}</td>
                                <td>
                                  {mat.tipoMaterial || '-'}
                                  <div className="d-lg-none">
                                    <small className="text-muted">Cant: {mat.cantidad}</small>
                                  </div>
                                </td>
                                <td className="text-end d-none d-lg-table-cell">
                                  {mat.cantidad}
                                </td>
                                <td className="text-end">
                                  ${((mat.cantidad || 0) * (mat.precioUnitario || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Otros Costos Detallados */}
                {datosParaEnviar.otrosCostos?.length > 0 && (
                  <div className="row mb-4">
                    <div className="col-12">
                      <h5 className="text-secondary border-bottom pb-2 mb-3">
                        <i className="fas fa-coins me-2"></i>
                        Otros Costos ({datosParaEnviar.otrosCostos.length})
                      </h5>
                      <div className="table-responsive">
                        <table className="table table-sm table-hover">
                          <thead className="table-warning">
                            <tr key="assigned-otros-costos-header">
                              <th className="d-none d-md-table-cell">#</th>
                              <th>Descripción</th>
                              <th className="text-end">Importe</th>
                            </tr>
                          </thead>
                          <tbody>
                            {datosParaEnviar.otrosCostos.map((costo, idx) => (
                              <tr key={idx}>
                                <td className="d-none d-md-table-cell">{idx + 1}</td>
                                <td>{costo.descripcion || '-'}</td>
                                <td className="text-end">
                                  ${(costo.importe || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Totales: Gastado vs Presupuestado */}
                <div className="row g-3 mb-3">
                  {/* Total Gastado */}
                  <div className="col-12 col-lg-4">
                    <div className="card bg-primary text-white h-100">
                      <div className="card-body text-center py-3">
                        <h6 className="text-white-50 mb-2">
                          <i className="fas fa-receipt me-2"></i>
                          Total Gastado
                        </h6>
                        <h4 className="mb-0">
                          ${(datosMetrosCuadradosGuardados
                            ? (datosMetrosCuadradosGuardados.montoProfesionales + datosMetrosCuadradosGuardados.montoMateriales + datosMetrosCuadradosGuardados.montoOtrosCostos)
                            : (datosParaEnviar.montoTotal || 0)
                          ).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </h4>
                      </div>
                    </div>
                  </div>

                  {/* Total Honorarios */}
                  <div className="col-12 col-lg-4">
                    <div className="card bg-info text-white h-100">
                      <div className="card-body text-center py-3">
                        <h6 className="text-white-50 mb-2">
                          <i className="fas fa-briefcase me-2"></i>
                          Honorarios Dirección
                        </h6>
                        <h4 className="mb-0">
                          ${datosParaEnviar.totalHonorarios?.toLocaleString('es-AR', { minimumFractionDigits: 2 }) || '0,00'}
                        </h4>
                        {datosParaEnviar.honorariosDesglosados && (
                          <div className="mt-2" style={{ fontSize: '0.75rem' }}>
                            {datosParaEnviar.honorariosDesglosados.profesionales > 0 && (
                              <div>👷 Prof: ${datosParaEnviar.honorariosDesglosados.profesionales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                            )}
                            {datosParaEnviar.honorariosDesglosados.materiales > 0 && (
                              <div>🧱 Mat: ${datosParaEnviar.honorariosDesglosados.materiales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                            )}
                            {datosParaEnviar.honorariosDesglosados.otrosCostos > 0 && (
                              <div>💼 Otros: ${datosParaEnviar.honorariosDesglosados.otrosCostos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                            )}
                          </div>
                        )}
                        {!datosParaEnviar.honorariosDesglosados && datosParaEnviar.honorarioDireccionPorcentaje > 0 && (
                          <small className="d-block mt-1">
                            ({datosParaEnviar.honorarioDireccionPorcentaje}% del total)
                          </small>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Total Presupuestado */}
                  <div className="col-12 col-lg-4">
                    <div className={`card h-100 ${
                      (() => {
                        const totalGastado = datosMetrosCuadradosGuardados
                          ? (datosMetrosCuadradosGuardados.montoProfesionales + datosMetrosCuadradosGuardados.montoMateriales + datosMetrosCuadradosGuardados.montoOtrosCostos)
                          : (datosParaEnviar.montoTotal || 0);
                        const totalPresupuesto = datosMetrosCuadradosGuardados
                          ? datosMetrosCuadradosGuardados.totalEstimado
                          : (datosParaEnviar.totalPresupuesto || 0);
                        return totalPresupuesto > 0
                          ? (totalGastado <= totalPresupuesto ? 'bg-success' : 'bg-danger')
                          : 'bg-secondary';
                      })()
                    } text-white`}>
                      <div className="card-body text-center py-3">
                        <h6 className="text-white-50 mb-2">
                          <i className="fas fa-chart-line me-2"></i>
                          Presupuestado
                        </h6>
                        <h4 className="mb-0">
                          ${(datosMetrosCuadradosGuardados
                            ? datosMetrosCuadradosGuardados.totalEstimado
                            : (datosParaEnviar.totalPresupuesto || 0)
                          ).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </h4>
                        {(() => {
                          const totalGastado = datosMetrosCuadradosGuardados
                            ? (datosMetrosCuadradosGuardados.montoProfesionales + datosMetrosCuadradosGuardados.montoMateriales + datosMetrosCuadradosGuardados.montoOtrosCostos)
                            : (datosParaEnviar.montoTotal || 0);
                          const totalPresupuesto = datosMetrosCuadradosGuardados
                            ? datosMetrosCuadradosGuardados.totalEstimado
                            : (datosParaEnviar.totalPresupuesto || 0);

                          return totalPresupuesto > 0 && (
                            <small className="d-block mt-1">
                              {totalGastado <= totalPresupuesto ? (
                                <>
                                  <i className="fas fa-check-circle me-1"></i>
                                  Disponible: ${(totalPresupuesto - totalGastado).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </>
                              ) : (
                                <>
                                  <i className="fas fa-exclamation-triangle me-1"></i>
                                  Excedido: ${(totalGastado - totalPresupuesto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </>
                              )}
                            </small>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Total Final con Honorarios */}
                {(() => {
                  const totalPresupuesto = datosMetrosCuadradosGuardados
                    ? datosMetrosCuadradosGuardados.totalEstimado
                    : (datosParaEnviar.totalPresupuesto || 0);
                  const totalHonorarios = datosParaEnviar.totalHonorarios || 0;
                  const totalGastado = datosMetrosCuadradosGuardados
                    ? (datosMetrosCuadradosGuardados.montoProfesionales + datosMetrosCuadradosGuardados.montoMateriales + datosMetrosCuadradosGuardados.montoOtrosCostos)
                    : (datosParaEnviar.montoTotal || 0);

                  return (totalPresupuesto > 0 || totalHonorarios > 0) && (
                    <div className="row">
                      <div className="col-12">
                        <div className="card bg-dark text-white">
                          <div className="card-body text-center py-4">
                            <h5 className="text-white-50 mb-2">TOTAL GENERAL (Presupuesto + Honorarios)</h5>
                            <h2 className="mb-0">
                              <i className="fas fa-dollar-sign me-2"></i>
                              ${(totalPresupuesto + totalHonorarios).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </h2>
                            {(totalPresupuesto + totalHonorarios) > 0 && totalGastado > 0 && (
                              <div className="mt-2">
                                <small>
                                  {totalGastado <= (totalPresupuesto + totalHonorarios) ? (
                                    <>
                                      <i className="fas fa-check-circle me-1"></i>
                                      Saldo disponible: ${((totalPresupuesto + totalHonorarios) - totalGastado).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                    </>
                                  ) : (
                                    <>
                                      <i className="fas fa-exclamation-triangle me-1"></i>
                                      Exceso total: ${(totalGastado - (totalPresupuesto + totalHonorarios)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                    </>
                                  )}
                                </small>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

              </div>
            </div>

            <div className="modal-footer">
              <div className="d-flex flex-column flex-md-row gap-2 w-100">
                {/* Botón 1: Editar */}
                <button
                  type="button"
                  className="btn btn-outline-secondary flex-fill"
                  onClick={volverAEditar}
                  disabled={saving}
                >
                  <i className="fas fa-edit me-2"></i>
                  Editar
                </button>

                {/* Botón 2: Enviar (WhatsApp o Email según disponibilidad) */}
                {(form.telefono || form.mail) && (
                  <button
                    type="button"
                    className="btn btn-success flex-fill"
                    onClick={() => enviarYGuardar(form.telefono ? 'whatsapp' : 'email')}
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <i className="fas fa-spinner fa-spin me-2"></i>
                        Enviando...
                      </>
                    ) : (
                      <>
                        {form.telefono ? (
                          <>
                            <i className="fab fa-whatsapp me-2"></i>
                            Enviar por WhatsApp
                          </>
                        ) : (
                          <>
                            <i className="fas fa-envelope me-2"></i>
                            Enviar por Email
                          </>
                        )}
                      </>
                    )}
                  </button>
                )}

                {/* Botón 3: Cancelar */}
                <button
                  type="button"
                  className="btn btn-danger flex-fill"
                  onClick={() => {
                    setMostrarPrevisualizacion(false);
                    setDatosParaEnviar(null);
                    onClose();
                  }}
                  disabled={saving}
                >
                  <i className="fas fa-times me-2"></i>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      );
    })()}

    {/* Modal de Alert para Cálculo Automático */}
    {mostrarAlertCalculoAutomatico && datosCalculoAutomatico && (
      <div
        className="modal fade show"
        style={{display: 'block', backgroundColor: 'rgba(0,0,0,0.5)'}}
        onClick={() => {
          setMostrarAlertCalculoAutomatico(false);
          setDatosCalculoAutomatico(null);
        }}
      >
        <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header bg-success text-white">
              <h5 className="modal-title">
                <i className="fas fa-check-circle me-2"></i>
                Calculado automáticamente desde items agregados
              </h5>
            </div>
            <div className="modal-body">
              <div className="alert alert-info mb-3">
                <div className="d-flex align-items-center mb-2">
                  <i className="fas fa-ruler-combined me-2 fs-4"></i>
                  <div>
                    <strong>Metros cuadrados:</strong>
                    <div className="fs-5 text-primary">{datosCalculoAutomatico.metrosCalculados} m²</div>
                  </div>
                </div>
              </div>

              <div className="alert alert-success mb-3">
                <div className="d-flex align-items-center mb-2">
                  <i className="fas fa-dollar-sign me-2 fs-4"></i>
                  <div>
                    <strong>Importe por m²:</strong>
                    <div className="fs-5 text-success">${datosCalculoAutomatico.importeEstandar.toLocaleString('es-AR')}</div>
                  </div>
                </div>
              </div>

              <div className="alert alert-warning mb-3">
                <div className="fw-bold mb-1">Resumen de Mayores Costos</div>
                {(() => {
                  const mayoresCostos = calcularMayoresCostos();
                  return (
                    <>
                      <div>Profesionales: <strong>${mayoresCostos.profesionales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong></div>
                      <div>Materiales: <strong>${mayoresCostos.materiales.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong></div>
                      <div>Otros Costos: <strong>${mayoresCostos.otrosCostos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong></div>
                      <div>Configuración Presupuesto: <strong>${mayoresCostos.configuracionPresupuesto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong></div>
                      <div>Honorarios: <strong>${mayoresCostos.honorarios.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong></div>
                      <div className="mt-2">Total Mayores Costos: <strong>${mayoresCostos.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong></div>
                    </>
                  );
                })()}
              </div>

              <div className="text-muted small text-center">
                <i className="fas fa-info-circle me-1"></i>
                (Usando valor estándar de mercado: $1.200.000/m²)
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setMostrarAlertCalculoAutomatico(false);
                  setDatosCalculoAutomatico(null);
                }}
              >
                <i className="fas fa-times me-2"></i>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setMostrarAlertCalculoAutomatico(false);
                  setDatosCalculoAutomatico(null);
                }}
              >
                <i className="fas fa-check me-2"></i>
                Aceptar
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>

  {/* 🆕 MINI-MODAL EDITAR PROFESIONAL */}
  {showEditProfesionalModal && profesionalEditando && (
    <div className="modal show d-block" tabIndex="-1" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header bg-warning text-white">
            <h5 className="modal-title"><i className="fas fa-edit me-2"></i>Editar Profesional</h5>
            <button type="button" className="btn btn-light btn-sm ms-auto" onClick={() => setShowEditProfesionalModal(false)}>
              Cerrar
            </button>
          </div>
          <div className="modal-body">
            <div className="mb-3">
              <label className="form-label fw-bold">Tipo de Profesional</label>
              <input
                type="text"
                className="form-control"
                value={profesionalEditando.tipo || ''}
                onChange={(e) => setProfesionalEditando({...profesionalEditando, tipo: e.target.value})}
              />
            </div>
            <div className="mb-3">
              <label className="form-label fw-bold">Cantidad de Jornales</label>
              <input
                type="number"
                className="form-control"
                value={profesionalEditando.cantidadJornales || ''}
                onChange={(e) => setProfesionalEditando({...profesionalEditando, cantidadJornales: e.target.value})}
              />
            </div>
            <div className="mb-3">
              <label className="form-label fw-bold">Importe por Jornal ($)</label>
              <input
                type="number"
                className="form-control"
                value={profesionalEditando.importeJornal || ''}
                onChange={(e) => setProfesionalEditando({...profesionalEditando, importeJornal: e.target.value})}
              />
            </div>
            <div className="alert alert-info">
              <strong>Subtotal:</strong> ${((Number(profesionalEditando.cantidadJornales) || 0) * (Number(profesionalEditando.importeJornal) || 0)).toLocaleString('es-AR')}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setShowEditProfesionalModal(false)}>
              <i className="fas fa-times me-2"></i>Cancelar
            </button>
            <button className="btn btn-warning" onClick={guardarEdicionProfesional}>
              <i className="fas fa-save me-2"></i>Guardar Cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  )}

  {/* 🆕 MINI-MODAL EDITAR MATERIAL */}
  {showEditMaterialModal && materialEditando && (
    <div className="modal show d-block" tabIndex="-1" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header bg-warning text-white">
            <h5 className="modal-title"><i className="fas fa-edit me-2"></i>Editar Material</h5>
            <button type="button" className="btn btn-light btn-sm ms-auto" onClick={() => setShowEditMaterialModal(false)}>
              Cerrar
            </button>
          </div>
          <div className="modal-body">
            <div className="mb-3">
              <label className="form-label fw-bold">Descripción del Material</label>
              <input
                type="text"
                className="form-control"
                value={materialEditando.descripcion || ''}
                onChange={(e) => setMaterialEditando({...materialEditando, descripcion: e.target.value})}
              />
            </div>
            <div className="mb-3">
              <label className="form-label fw-bold">Cantidad</label>
              <input
                type="number"
                className="form-control"
                value={materialEditando.cantidad || ''}
                onChange={(e) => setMaterialEditando({...materialEditando, cantidad: e.target.value})}
              />
            </div>
            <div className="mb-3">
              <label className="form-label fw-bold">Precio Unitario ($)</label>
              <input
                type="number"
                className="form-control"
                value={materialEditando.precioUnitario || ''}
                onChange={(e) => setMaterialEditando({...materialEditando, precioUnitario: e.target.value})}
              />
            </div>
            <div className="alert alert-info">
              <strong>Subtotal:</strong> ${((Number(materialEditando.cantidad) || 0) * (Number(materialEditando.precioUnitario) || 0)).toLocaleString('es-AR')}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setShowEditMaterialModal(false)}>
              <i className="fas fa-times me-2"></i>Cancelar
            </button>
            <button className="btn btn-warning" onClick={guardarEdicionMaterial}>
              <i className="fas fa-save me-2"></i>Guardar Cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  )}

  {/* 🆕 MINI-MODAL EDITAR JORNAL */}
  {showEditJornalModal && jornalEditando && (
    <div className="modal show d-block" tabIndex="-1" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header bg-warning text-white">
            <h5 className="modal-title"><i className="fas fa-edit me-2"></i>Editar Jornal</h5>
            <button type="button" className="btn btn-light btn-sm ms-auto" onClick={() => setShowEditJornalModal(false)}>
              Cerrar
            </button>
          </div>
          <div className="modal-body">
            <div className="mb-3">
              <label className="form-label fw-bold">Rol</label>
              <input
                type="text"
                className="form-control"
                value={jornalEditando.rol || ''}
                onChange={(e) => setJornalEditando({...jornalEditando, rol: e.target.value})}
              />
            </div>
            <div className="mb-3">
              <label className="form-label fw-bold">Cantidad de Jornales</label>
              <input
                type="number"
                className="form-control"
                value={jornalEditando.cantidadJornales || jornalEditando.cantidad || ''}
                onChange={(e) => setJornalEditando({...jornalEditando, cantidadJornales: e.target.value, cantidad: e.target.value})}
              />
            </div>
            <div className="mb-3">
              <label className="form-label fw-bold">Importe por Jornal ($)</label>
              <input
                type="number"
                className="form-control"
                value={jornalEditando.importeJornal || jornalEditando.valorUnitario || ''}
                onChange={(e) => setJornalEditando({...jornalEditando, importeJornal: e.target.value, valorUnitario: e.target.value})}
              />
            </div>
            <div className="alert alert-info">
              <strong>Subtotal:</strong> ${((Number(jornalEditando.cantidadJornales || jornalEditando.cantidad) || 0) * (Number(jornalEditando.importeJornal || jornalEditando.valorUnitario) || 0)).toLocaleString('es-AR')}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setShowEditJornalModal(false)}>
              <i className="fas fa-times me-2"></i>Cancelar
            </button>
            <button className="btn btn-warning" onClick={guardarEdicionJornal}>
              <i className="fas fa-save me-2"></i>Guardar Cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  )}

  {/* 🆕 MINI-MODAL EDITAR GASTO */}
  {showEditGastoModal && gastoEditando && (
    <div className="modal show d-block" tabIndex="-1" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header bg-warning text-white">
            <h5 className="modal-title"><i className="fas fa-edit me-2"></i>Editar Gasto General</h5>
            <button type="button" className="btn btn-light btn-sm ms-auto" onClick={() => setShowEditGastoModal(false)}>
              Cerrar
            </button>
          </div>
          <div className="modal-body">
            <div className="mb-3">
              <label className="form-label fw-bold">Descripción del Gasto</label>
              <input
                type="text"
                className="form-control"
                value={gastoEditando.descripcion || ''}
                onChange={(e) => setGastoEditando({...gastoEditando, descripcion: e.target.value})}
              />
            </div>
            <div className="mb-3">
              <label className="form-label fw-bold">Cantidad</label>
              <input
                type="number"
                className="form-control"
                value={gastoEditando.cantidad || ''}
                onChange={(e) => setGastoEditando({...gastoEditando, cantidad: e.target.value})}
              />
            </div>
            <div className="mb-3">
              <label className="form-label fw-bold">Precio Unitario ($)</label>
              <input
                type="number"
                className="form-control"
                value={gastoEditando.precioUnitario || ''}
                onChange={(e) => setGastoEditando({...gastoEditando, precioUnitario: e.target.value})}
              />
            </div>
            <div className="alert alert-info">
              <strong>Subtotal:</strong> ${((Number(gastoEditando.cantidad) || 0) * (Number(gastoEditando.precioUnitario) || 0)).toLocaleString('es-AR')}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setShowEditGastoModal(false)}>
              <i className="fas fa-times me-2"></i>Cancelar
            </button>
            <button className="btn btn-warning" onClick={guardarEdicionGasto}>
              <i className="fas fa-save me-2"></i>Guardar Cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  )}

  </>
);
};

export default PresupuestoNoClienteModal;
