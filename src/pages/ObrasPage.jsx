import React, { useEffect, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEmpresa } from '../EmpresaContext';
import { SidebarContext } from '../App';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { useSelector, useDispatch } from 'react-redux';
import ClienteSelector from '../components/ClienteSelector';
import EmpresaSelector from '../components/EmpresaSelector';
import AsignarProfesionalSemanalModal from '../components/AsignarProfesionalSemanalModal';
import SeleccionarProfesionalesModal from '../components/SeleccionarProfesionalesModal';
import VerAsignacionesModal from '../components/VerAsignacionesModal';
import AsignarMaterialObraModal from '../components/AsignarMaterialObraModal';
import AsignarOtroCostoObraModal from '../components/AsignarOtroCostoObraModal';
import EstadoAsignacionBadge from '../components/EstadoAsignacionBadge';
import EstadoPresupuestoBadge from '../components/EstadoPresupuestoBadge';
import PresupuestoNoClienteModal from '../components/PresupuestoNoClienteModal';
// import TrabajoExtraModal from '../components/TrabajoExtraModal'; // Ya no se usa, se usa PresupuestoNoClienteModal con modoTrabajoExtra=true
import EtapaDiariaModal from '../components/EtapaDiariaModal';
import VistaSemanalEtapas from '../components/VistaSemanalEtapas';
import ModalDetalleDia from '../components/ModalDetalleDia';
import EnviarObraManualModal from '../components/EnviarObraManualModal';
import EstadisticasObraModal from '../components/EstadisticasObraModal';
import EstadisticasTodasObrasModal from '../components/EstadisticasTodasObrasModal';
import DebugPanel from '../components/DebugPanel';
import ModalPresupuestoUnificado from '../components/ModalPresupuestoUnificado';
import api from '../services/api';
import axios from 'axios';
import { obtenerAsignacionesSemanalPorObra } from '../services/profesionalesObraService';
// ? NUEVO: Servicio unificado de presupuestos (reemplaza trabajosAdicionalesService)
import * as presupuestoService from '../services/presupuestoUnificadoService';
// ?? Todav?a necesario: COLORES_ESTADO e ICONOS_ESTADO se usan en el JSX
import trabajosAdicionalesService from '../services/trabajosAdicionalesService';
import { TIPOS_PRESUPUESTO, getConfigPresupuesto, getNivelJerarquico } from '../constants/presupuestoTypes';
import eventBus, { FINANCIAL_EVENTS } from '../utils/eventBus';
import { calcularSemanasParaDiasHabiles, convertirDiasHabilesASemanasSimple, esDiaHabil } from '../utils/feriadosArgentina';
import { calcularTotalConDescuentosDesdeItems } from '../utils/presupuestoDescuentosUtils';
import { fetchClientes } from '../store/slices/clientesSlice';
import {
  fetchTodasObras,
  fetchObrasPorEmpresa,
  fetchObrasPorCliente,
  fetchObrasPorEstado,
  fetchObrasActivas,
  createObra,
  updateObra,
  deleteObra,
  cambiarEstadoObra,
  fetchEstadisticasObras,
  fetchEstadosDisponibles,
  fetchProfesionalesAsignados,
  actualizarPorcentajeGananciaTodos,
  actualizarPorcentajeGananciaProfesional,
  setActiveTab,
  setObraSeleccionada,
  setEmpresaId,
  setEstadoFilter,
  clearError,
  clearProfesionalesAsignados,
  selectObras,
  selectObraSeleccionada,
  selectObrasLoading,
  selectObrasError,
  selectActiveTab,
  selectEmpresaId,
  selectEstadoFilter,
  selectEstadosDisponibles,
  selectProfesionalesAsignados,
  selectEstadisticas
} from '../store/slices/obrasSlice';

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

const ObrasPage = ({ showNotification }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const dispatch = useDispatch();
  const { setObrasControls } = useContext(SidebarContext) || {};

  // Redux state
  const obras = useSelector(selectObras);
  const obraSeleccionada = useSelector(selectObraSeleccionada);
  const loading = useSelector(selectObrasLoading);
  const error = useSelector(selectObrasError);
  const activeTab = useSelector(selectActiveTab);
  const { empresaSeleccionada } = useEmpresa();
  const empresaId = empresaSeleccionada ? empresaSeleccionada.id : '';
  const estadoFilter = useSelector(selectEstadoFilter);
  const estadosDisponibles = useSelector(selectEstadosDisponibles);
  const profesionalesAsignados = useSelector(selectProfesionalesAsignados);
  const estadisticas = useSelector(selectEstadisticas);

  // ? Procesamiento de obras para detectar obras independientes
  const obrasConFlags = React.useMemo(() => {
    console.log('?? [ObrasPage] Procesando obras:', obras.length);
    return obras.map(obra => {
      // Detectar si es obra independiente (sin presupuesto)
      const tienePresupuesto = obra.presupuestoId ||
                              obra.presupuestoNoClienteId ||
                              obra.presupuesto_no_cliente_id ||
                              obra.presupuestoNoCliente?.id ||
                              obra.presupuestoCompleto?.id;

      const esObraIndependiente = !tienePresupuesto;

      // ?? Debug: mostrar TODAS las obras con sus campos clave
      console.log(`?? [ObrasPage] Obra id:${obra.id}:`, {
        tienePresupuesto,
        esObraIndependiente,
        presupuestoId: obra.presupuestoId,
        presupuestoNoClienteId: obra.presupuestoNoClienteId,
        presupuesto_no_cliente_id: obra.presupuesto_no_cliente_id,
        presupuestoEstimado: obra.presupuestoEstimado,
        nombre: obra.nombre,
        nombreObra: obra.nombreObra,
        descripcion: obra.descripcion,
        direccion: obra.direccion
      });

      return {
        ...obra,
        esObraIndependiente,
        // Mantener compatibilidad con l?gica existente
        totalPresupuesto: obra.totalPresupuesto || obra.presupuestoEstimado || 0
      };
    });
  }, [obras]);

  // Estado local para controlar obra seleccionada desde tabla
  const [selectedObraId, setSelectedObraId] = React.useState(null);

  // ?? Estado para rastrear relaci?n: obra padre -> obras de trabajo extra
  const [mapObraPadre, setMapObraPadre] = React.useState({});

  // Estado para modal de presupuestos
  const [mostrarModalPresupuestos, setMostrarModalPresupuestos] = React.useState(false);
  const [obraParaPresupuestos, setObraParaPresupuestos] = React.useState(null);
  const [presupuestosObra, setPresupuestosObra] = React.useState([]);
  const [loadingPresupuestos, setLoadingPresupuestos] = React.useState(false);

  // Estado para modal de cambiar estado
  const [mostrarModalCambiarEstado, setMostrarModalCambiarEstado] = React.useState(false);
  const [nuevoEstadoSeleccionado, setNuevoEstadoSeleccionado] = React.useState('');

  // ==================== CONFIGURACI�N GLOBAL DE OBRA ====================
    const [mostrarModalConfiguracionObra, setMostrarModalConfiguracionObra] = React.useState(false);
    const [obraParaConfigurar, setObraParaConfigurar] = React.useState(null);
    // Estado global de planificaci?n por obra
    const [configuracionesPlanificacion, setConfiguracionesPlanificacion] = React.useState({});
    // Estado para advertencias en el modal de configuraci?n
    const [advertenciaConfiguracionObra, setAdvertenciaConfiguracionObra] = React.useState(null);
    // Estado local para edici?n actual
    const [configuracionObra, setConfiguracionObra] = React.useState({
      semanasObjetivo: '',
      diasHabiles: 0,
      capacidadNecesaria: 0,
      fechaInicio: '',
      fechaFinEstimada: null,
      jornalesTotales: 0,
      presupuestoSeleccionado: null,
      fechaProbableInicioInput: '',
      modalVisible: false
    });

    // Estado para forzar re-render cuando cambia configuraci?n desde BD
    const [configCargada, setConfigCargada] = React.useState(0);

  // Estado para modal de asignar profesionales
  const [mostrarModalAsignarProfesionalesSemanal, setMostrarModalAsignarProfesionalesSemanal] = React.useState(false);
  const [obraParaAsignarProfesionales, setObraParaAsignarProfesionales] = React.useState(null);

  // Estados para modal de asignar materiales
  const [mostrarModalAsignarMateriales, setMostrarModalAsignarMateriales] = React.useState(false);
  const [obraParaAsignarMateriales, setObraParaAsignarMateriales] = React.useState(null);

  // Estados para modal de asignar gastos generales
  const [mostrarModalAsignarGastos, setMostrarModalAsignarGastos] = React.useState(false);
  const [obraParaAsignarGastos, setObraParaAsignarGastos] = React.useState(null);

  // Estado para modal de detalle de presupuesto
  const [mostrarModalDetallePresupuesto, setMostrarModalDetallePresupuesto] = React.useState(false);
  const [presupuestoDetalle, setPresupuestoDetalle] = React.useState(null);

  // Estado para modal de edici?n de presupuesto
  const [mostrarModalEditarPresupuesto, setMostrarModalEditarPresupuesto] = React.useState(false);
  const [presupuestoParaEditar, setPresupuestoParaEditar] = React.useState(null);
  const [cargandoPresupuesto, setCargandoPresupuesto] = React.useState(false);

  // Estado para modal de env?o de presupuesto (sin navegar)
  const [mostrarModalEnviarPresupuesto, setMostrarModalEnviarPresupuesto] = React.useState(false);
  const [presupuestoParaEnviar, setPresupuestoParaEnviar] = React.useState(null);

  // Estados para Trabajos Extra
  const [trabajosExtra, setTrabajosExtra] = React.useState([]);
  const [loadingTrabajosExtra, setLoadingTrabajosExtra] = React.useState(false);
  const [mostrarModalTrabajoExtra, setMostrarModalTrabajoExtra] = React.useState(false);

  // Estados para Trabajo Diario (obras independientes sin presupuesto previo)
  const [mostrarModalTrabajoDiario, setMostrarModalTrabajoDiario] = React.useState(false);

  // Estados para Tarea Leve
  const [mostrarModalTareaLeve, setMostrarModalTareaLeve] = React.useState(false);
  const [obraParaTareaLeve, setObraParaTareaLeve] = React.useState(null);
  const [tareaLeveEditando, setTareaLeveEditando] = React.useState(null); // Para editar tarea existente
  const [autoGenerarPDFTrabajoExtra, setAutoGenerarPDFTrabajoExtra] = React.useState(false);
  const [abrirWhatsAppTrabajoExtra, setAbrirWhatsAppTrabajoExtra] = React.useState(false);
  const [abrirEmailTrabajoExtra, setAbrirEmailTrabajoExtra] = React.useState(false);
  const [mostrarModalSeleccionEnvioTrabajoExtra, setMostrarModalSeleccionEnvioTrabajoExtra] = React.useState(false);

  // Estados para Trabajos Adicionales
  const [mostrarModalListaTrabajosAdicionales, setMostrarModalListaTrabajosAdicionales] = React.useState(false);
  // ? NUEVO: Estado unificado para modal de presupuestos (reemplaza mostrarModalTrabajoAdicional)
  const [modalPresupuesto, setModalPresupuesto] = React.useState({
    mostrar: false,
    tipo: null,         // 'PRINCIPAL' | 'TRABAJO_DIARIO' | 'TRABAJO_EXTRA' | 'TAREA_LEVE'
    contexto: {},       // { obraId, obraNombre, trabajoExtraId, trabajoExtraNombre }
    datosIniciales: null // Para edici?n
  });
  const [obraParaTrabajosAdicionales, setObraParaTrabajosAdicionales] = React.useState(null);
  const [trabajoAdicionalEditar, setTrabajoAdicionalEditar] = React.useState(null);
  const [trabajosAdicionales, setTrabajosAdicionales] = React.useState([]);

  // ? NUEVO: Estado separado para Tareas Leves (PresupuestoNoCliente tipo TAREA_LEVE)
  const [tareasLeves, setTareasLeves] = React.useState([]);

  const [gruposColapsadosObras, setGruposColapsadosObras] = React.useState({});

  // Estados para profesionales en trabajos adicionales
  const [profesionalesDisponiblesTA, setProfesionalesDisponiblesTA] = React.useState([]);
  const [profesionalesSeleccionados, setProfesionalesSeleccionados] = React.useState([]);
  const [profesionalesAdhoc, setProfesionalesAdhoc] = React.useState([]);
  const [loadingProfesionalesTA, setLoadingProfesionalesTA] = React.useState(false);
  const [mostrarFormularioAdhoc, setMostrarFormularioAdhoc] = React.useState(false);
  const [profesionalAdhocForm, setProfesionalAdhocForm] = React.useState({
    nombre: '',
    tipoProfesional: '',
    honorarioDia: '',
    telefono: '',
    email: ''
  });
  const [guardarEnCatalogoTA, setGuardarEnCatalogoTA] = React.useState(false);
  const [guardandoProfesionalTA, setGuardandoProfesionalTA] = React.useState(false);

  // Estados para desglose de importe en trabajos adicionales
  const [usarDesglose, setUsarDesglose] = React.useState(false);
  const [importeMateriales, setImporteMateriales] = React.useState('');
  const [importeJornales, setImporteJornales] = React.useState('');
  const [importeGastosGenerales, setImporteGastosGenerales] = React.useState('');
  const [importeMayoresCostos, setImporteMayoresCostos] = React.useState('');
  const [importeTotal, setImporteTotal] = React.useState('');

  // Honorarios individuales para cada categor?a (Trabajos Adicionales)
  const [honorarioJornales, setHonorarioJornales] = React.useState('');
  const [tipoHonorarioJornales, setTipoHonorarioJornales] = React.useState('porcentaje');
  const [honorarioMateriales, setHonorarioMateriales] = React.useState('');
  const [tipoHonorarioMateriales, setTipoHonorarioMateriales] = React.useState('porcentaje');
  const [honorarioGastosGenerales, setHonorarioGastosGenerales] = React.useState('');
  const [tipoHonorarioGastosGenerales, setTipoHonorarioGastosGenerales] = React.useState('porcentaje');
  const [honorarioMayoresCostos, setHonorarioMayoresCostos] = React.useState('');
  const [tipoHonorarioMayoresCostos, setTipoHonorarioMayoresCostos] = React.useState('porcentaje');

  // Descuentos individuales para cada categor?a (Trabajos Adicionales)
  const [descuentoJornales, setDescuentoJornales] = React.useState('');
  const [tipoDescuentoJornales, setTipoDescuentoJornales] = React.useState('porcentaje');
  const [descuentoMateriales, setDescuentoMateriales] = React.useState('');
  const [tipoDescuentoMateriales, setTipoDescuentoMateriales] = React.useState('porcentaje');
  const [descuentoGastosGenerales, setDescuentoGastosGenerales] = React.useState('');
  const [tipoDescuentoGastosGenerales, setTipoDescuentoGastosGenerales] = React.useState('porcentaje');
  const [descuentoMayoresCostos, setDescuentoMayoresCostos] = React.useState('');
  const [tipoDescuentoMayoresCostos, setTipoDescuentoMayoresCostos] = React.useState('porcentaje');

  // Descuentos espec?ficos para honorarios (Trabajos Adicionales)
  const [descuentoHonorarioJornales, setDescuentoHonorarioJornales] = React.useState('');
  const [tipoDescuentoHonorarioJornales, setTipoDescuentoHonorarioJornales] = React.useState('porcentaje');
  const [descuentoHonorarioMateriales, setDescuentoHonorarioMateriales] = React.useState('');
  const [tipoDescuentoHonorarioMateriales, setTipoDescuentoHonorarioMateriales] = React.useState('porcentaje');
  const [descuentoHonorarioGastosGenerales, setDescuentoHonorarioGastosGenerales] = React.useState('');
  const [tipoDescuentoHonorarioGastosGenerales, setTipoDescuentoHonorarioGastosGenerales] = React.useState('porcentaje');
  const [descuentoHonorarioMayoresCostos, setDescuentoHonorarioMayoresCostos] = React.useState('');
  const [tipoDescuentoHonorarioMayoresCostos, setTipoDescuentoHonorarioMayoresCostos] = React.useState('porcentaje');

  // Calcular importe total cuando cambian los desgloses
  React.useEffect(() => {
    if (usarDesglose) {
      let total = 0;

      // Jornales: Base + Honorarios con descuentos por separado
      const baseJornales = parseFloat(importeJornales) || 0;
      let honorariosJ = 0;
      if (tipoHonorarioJornales === 'porcentaje') {
        honorariosJ = (baseJornales * (parseFloat(honorarioJornales) || 0)) / 100;
      } else {
        honorariosJ = parseFloat(honorarioJornales) || 0;
      }

      // Descuento sobre el importe base
      let descuentoBaseJ = 0;
      if (tipoDescuentoJornales === 'porcentaje') {
        descuentoBaseJ = (baseJornales * (parseFloat(descuentoJornales) || 0)) / 100;
      } else {
        descuentoBaseJ = parseFloat(descuentoJornales) || 0;
      }

      // Descuento sobre los honorarios
      let descuentoHonorarioJ = 0;
      if (tipoDescuentoHonorarioJornales === 'porcentaje') {
        descuentoHonorarioJ = (honorariosJ * (parseFloat(descuentoHonorarioJornales) || 0)) / 100;
      } else {
        descuentoHonorarioJ = parseFloat(descuentoHonorarioJornales) || 0;
      }

      const subtotalJ = (baseJornales - descuentoBaseJ) + (honorariosJ - descuentoHonorarioJ);
      total += subtotalJ;

      // Materiales: Base + Honorarios con descuentos por separado
      const baseMateriales = parseFloat(importeMateriales) || 0;
      let honorariosM = 0;
      if (tipoHonorarioMateriales === 'porcentaje') {
        honorariosM = (baseMateriales * (parseFloat(honorarioMateriales) || 0)) / 100;
      } else {
        honorariosM = parseFloat(honorarioMateriales) || 0;
      }

      // Descuento sobre el importe base
      let descuentoBaseM = 0;
      if (tipoDescuentoMateriales === 'porcentaje') {
        descuentoBaseM = (baseMateriales * (parseFloat(descuentoMateriales) || 0)) / 100;
      } else {
        descuentoBaseM = parseFloat(descuentoMateriales) || 0;
      }

      // Descuento sobre los honorarios
      let descuentoHonorarioM = 0;
      if (tipoDescuentoHonorarioMateriales === 'porcentaje') {
        descuentoHonorarioM = (honorariosM * (parseFloat(descuentoHonorarioMateriales) || 0)) / 100;
      } else {
        descuentoHonorarioM = parseFloat(descuentoHonorarioMateriales) || 0;
      }

      const subtotalM = (baseMateriales - descuentoBaseM) + (honorariosM - descuentoHonorarioM);
      total += subtotalM;

      // Gastos Generales: Base + Honorarios con descuentos por separado
      const baseGastosGenerales = parseFloat(importeGastosGenerales) || 0;
      let honorariosG = 0;
      if (tipoHonorarioGastosGenerales === 'porcentaje') {
        honorariosG = (baseGastosGenerales * (parseFloat(honorarioGastosGenerales) || 0)) / 100;
      } else {
        honorariosG = parseFloat(honorarioGastosGenerales) || 0;
      }

      // Descuento sobre el importe base
      let descuentoBaseG = 0;
      if (tipoDescuentoGastosGenerales === 'porcentaje') {
        descuentoBaseG = (baseGastosGenerales * (parseFloat(descuentoGastosGenerales) || 0)) / 100;
      } else {
        descuentoBaseG = parseFloat(descuentoGastosGenerales) || 0;
      }

      // Descuento sobre los honorarios
      let descuentoHonorarioG = 0;
      if (tipoDescuentoHonorarioGastosGenerales === 'porcentaje') {
        descuentoHonorarioG = (honorariosG * (parseFloat(descuentoHonorarioGastosGenerales) || 0)) / 100;
      } else {
        descuentoHonorarioG = parseFloat(descuentoHonorarioGastosGenerales) || 0;
      }

      const subtotalG = (baseGastosGenerales - descuentoBaseG) + (honorariosG - descuentoHonorarioG);
      total += subtotalG;

      // Mayores Costos: Base + Honorarios con descuentos por separado
      const baseMayoresCostos = parseFloat(importeMayoresCostos) || 0;
      let honorariosMC = 0;
      if (tipoHonorarioMayoresCostos === 'porcentaje') {
        honorariosMC = (baseMayoresCostos * (parseFloat(honorarioMayoresCostos) || 0)) / 100;
      } else {
        honorariosMC = parseFloat(honorarioMayoresCostos) || 0;
      }

      // Descuento sobre el importe base
      let descuentoBaseMC = 0;
      if (tipoDescuentoMayoresCostos === 'porcentaje') {
        descuentoBaseMC = (baseMayoresCostos * (parseFloat(descuentoMayoresCostos) || 0)) / 100;
      } else {
        descuentoBaseMC = parseFloat(descuentoMayoresCostos) || 0;
      }

      // Descuento sobre los honorarios
      let descuentoHonorarioMC = 0;
      if (tipoDescuentoHonorarioMayoresCostos === 'porcentaje') {
        descuentoHonorarioMC = (honorariosMC * (parseFloat(descuentoHonorarioMayoresCostos) || 0)) / 100;
      } else {
        descuentoHonorarioMC = parseFloat(descuentoHonorarioMayoresCostos) || 0;
      }

      const subtotalMC = (baseMayoresCostos - descuentoBaseMC) + (honorariosMC - descuentoHonorarioMC);
      total += subtotalMC;

      setImporteTotal(total > 0 ? total.toString() : '');
    }
  }, [
    usarDesglose,
    importeJornales, honorarioJornales, tipoHonorarioJornales, descuentoJornales, tipoDescuentoJornales, descuentoHonorarioJornales, tipoDescuentoHonorarioJornales,
    importeMateriales, honorarioMateriales, tipoHonorarioMateriales, descuentoMateriales, tipoDescuentoMateriales, descuentoHonorarioMateriales, tipoDescuentoHonorarioMateriales,
    importeGastosGenerales, honorarioGastosGenerales, tipoHonorarioGastosGenerales, descuentoGastosGenerales, tipoDescuentoGastosGenerales, descuentoHonorarioGastosGenerales, tipoDescuentoHonorarioGastosGenerales,
    importeMayoresCostos, honorarioMayoresCostos, tipoHonorarioMayoresCostos, descuentoMayoresCostos, tipoDescuentoMayoresCostos, descuentoHonorarioMayoresCostos, tipoDescuentoHonorarioMayoresCostos
  ]);

  // Estados para desglose de importe en obras independientes
  const [usarDesgloseObra, setUsarDesgloseObra] = React.useState(false);
  const [importeMaterialesObra, setImporteMaterialesObra] = React.useState('');
  const [importeJornalesObra, setImporteJornalesObra] = React.useState('');
  const [importeGastosGeneralesObra, setImporteGastosGeneralesObra] = React.useState('');
  const [importeMayoresCostosObra, setImporteMayoresCostosObra] = React.useState('');
  const [importeTotalObra, setImporteTotalObra] = React.useState('');

  // Ref para evitar c?lculo inmediato al alternar el desglose
  const desgloseJustToggled = React.useRef(false);

  // Estados legacy para compatibilidad (solo para reseteo)
  const [importeHonorariosObra, setImporteHonorariosObra] = React.useState('');
  const [tipoHonorariosObra, setTipoHonorariosObra] = React.useState('porcentaje');
  const [tipoMayoresCostosObra, setTipoMayoresCostosObra] = React.useState('porcentaje');

  // Honorarios individuales para cada categor?a (Obras)
  const [honorarioJornalesObra, setHonorarioJornalesObra] = React.useState('');
  const [tipoHonorarioJornalesObra, setTipoHonorarioJornalesObra] = React.useState('porcentaje');
  const [honorarioMaterialesObra, setHonorarioMaterialesObra] = React.useState('');
  const [tipoHonorarioMaterialesObra, setTipoHonorarioMaterialesObra] = React.useState('porcentaje');
  const [honorarioGastosGeneralesObra, setHonorarioGastosGeneralesObra] = React.useState('');
  const [tipoHonorarioGastosGeneralesObra, setTipoHonorarioGastosGeneralesObra] = React.useState('porcentaje');
  const [honorarioMayoresCostosObra, setHonorarioMayoresCostosObra] = React.useState('');
  const [tipoHonorarioMayoresCostosObra, setTipoHonorarioMayoresCostosObra] = React.useState('porcentaje');

  // Descuentos individuales para cada categor?a (Obras)
  const [descuentoJornalesObra, setDescuentoJornalesObra] = React.useState('');
  const [tipoDescuentoJornalesObra, setTipoDescuentoJornalesObra] = React.useState('porcentaje');
  const [descuentoMaterialesObra, setDescuentoMaterialesObra] = React.useState('');
  const [tipoDescuentoMaterialesObra, setTipoDescuentoMaterialesObra] = React.useState('porcentaje');
  const [descuentoGastosGeneralesObra, setDescuentoGastosGeneralesObra] = React.useState('');
  const [tipoDescuentoGastosGeneralesObra, setTipoDescuentoGastosGeneralesObra] = React.useState('porcentaje');
  const [descuentoMayoresCostosObra, setDescuentoMayoresCostosObra] = React.useState('');
  const [tipoDescuentoMayoresCostosObra, setTipoDescuentoMayoresCostosObra] = React.useState('porcentaje');

  // Descuentos espec?ficos para honorarios (Obras)
  const [descuentoHonorarioJornalesObra, setDescuentoHonorarioJornalesObra] = React.useState('');
  const [tipoDescuentoHonorarioJornalesObra, setTipoDescuentoHonorarioJornalesObra] = React.useState('porcentaje');
  const [descuentoHonorarioMaterialesObra, setDescuentoHonorarioMaterialesObra] = React.useState('');
  const [tipoDescuentoHonorarioMaterialesObra, setTipoDescuentoHonorarioMaterialesObra] = React.useState('porcentaje');
  const [descuentoHonorarioGastosGeneralesObra, setDescuentoHonorarioGastosGeneralesObra] = React.useState('');
  const [tipoDescuentoHonorarioGastosGeneralesObra, setTipoDescuentoHonorarioGastosGeneralesObra] = React.useState('porcentaje');
  const [descuentoHonorarioMayoresCostosObra, setDescuentoHonorarioMayoresCostosObra] = React.useState('');
  const [tipoDescuentoHonorarioMayoresCostosObra, setTipoDescuentoHonorarioMayoresCostosObra] = React.useState('porcentaje');

  // Calcular importe total para obras cuando cambian los desgloses
  React.useEffect(() => {
    // Si acabamos de hacer toggle del desglose, no ejecutar c?lculos en este render
    if (desgloseJustToggled.current) {
      desgloseJustToggled.current = false;
      return;
    }

    if (usarDesgloseObra) {
      let total = 0;

      // Jornales: Base + Honorarios con descuentos por separado
      const baseJornales = parseFloat(importeJornalesObra) || 0;
      let honorariosJ = 0;
      if (tipoHonorarioJornalesObra === 'porcentaje') {
        honorariosJ = (baseJornales * (parseFloat(honorarioJornalesObra) || 0)) / 100;
      } else {
        honorariosJ = parseFloat(honorarioJornalesObra) || 0;
      }

      // Descuento sobre el importe base
      let descuentoBaseJ = 0;
      if (tipoDescuentoJornalesObra === 'porcentaje') {
        descuentoBaseJ = (baseJornales * (parseFloat(descuentoJornalesObra) || 0)) / 100;
      } else {
        descuentoBaseJ = parseFloat(descuentoJornalesObra) || 0;
      }

      // Descuento sobre los honorarios
      let descuentoHonorarioJ = 0;
      if (tipoDescuentoHonorarioJornalesObra === 'porcentaje') {
        descuentoHonorarioJ = (honorariosJ * (parseFloat(descuentoHonorarioJornalesObra) || 0)) / 100;
      } else {
        descuentoHonorarioJ = parseFloat(descuentoHonorarioJornalesObra) || 0;
      }

      const subtotalJ = (baseJornales - descuentoBaseJ) + (honorariosJ - descuentoHonorarioJ);
      total += subtotalJ;

      // Materiales: Base + Honorarios con descuentos por separado
      const baseMateriales = parseFloat(importeMaterialesObra) || 0;
      let honorariosM = 0;
      if (tipoHonorarioMaterialesObra === 'porcentaje') {
        honorariosM = (baseMateriales * (parseFloat(honorarioMaterialesObra) || 0)) / 100;
      } else {
        honorariosM = parseFloat(honorarioMaterialesObra) || 0;
      }

      // Descuento sobre el importe base
      let descuentoBaseM = 0;
      if (tipoDescuentoMaterialesObra === 'porcentaje') {
        descuentoBaseM = (baseMateriales * (parseFloat(descuentoMaterialesObra) || 0)) / 100;
      } else {
        descuentoBaseM = parseFloat(descuentoMaterialesObra) || 0;
      }

      // Descuento sobre los honorarios
      let descuentoHonorarioM = 0;
      if (tipoDescuentoHonorarioMaterialesObra === 'porcentaje') {
        descuentoHonorarioM = (honorariosM * (parseFloat(descuentoHonorarioMaterialesObra) || 0)) / 100;
      } else {
        descuentoHonorarioM = parseFloat(descuentoHonorarioMaterialesObra) || 0;
      }

      const subtotalM = (baseMateriales - descuentoBaseM) + (honorariosM - descuentoHonorarioM);
      total += subtotalM;

      // Gastos Generales: Base + Honorarios con descuentos por separado
      const baseGastosGenerales = parseFloat(importeGastosGeneralesObra) || 0;
      let honorariosG = 0;
      if (tipoHonorarioGastosGeneralesObra === 'porcentaje') {
        honorariosG = (baseGastosGenerales * (parseFloat(honorarioGastosGeneralesObra) || 0)) / 100;
      } else {
        honorariosG = parseFloat(honorarioGastosGeneralesObra) || 0;
      }

      // Descuento sobre el importe base
      let descuentoBaseG = 0;
      if (tipoDescuentoGastosGeneralesObra === 'porcentaje') {
        descuentoBaseG = (baseGastosGenerales * (parseFloat(descuentoGastosGeneralesObra) || 0)) / 100;
      } else {
        descuentoBaseG = parseFloat(descuentoGastosGeneralesObra) || 0;
      }

      // Descuento sobre los honorarios
      let descuentoHonorarioG = 0;
      if (tipoDescuentoHonorarioGastosGeneralesObra === 'porcentaje') {
        descuentoHonorarioG = (honorariosG * (parseFloat(descuentoHonorarioGastosGeneralesObra) || 0)) / 100;
      } else {
        descuentoHonorarioG = parseFloat(descuentoHonorarioGastosGeneralesObra) || 0;
      }

      const subtotalG = (baseGastosGenerales - descuentoBaseG) + (honorariosG - descuentoHonorarioG);
      total += subtotalG;

      // Mayores Costos: Base + Honorarios con descuentos por separado
      const baseMayoresCostos = parseFloat(importeMayoresCostosObra) || 0;
      let honorariosMC = 0;
      if (tipoHonorarioMayoresCostosObra === 'porcentaje') {
        honorariosMC = (baseMayoresCostos * (parseFloat(honorarioMayoresCostosObra) || 0)) / 100;
      } else {
        honorariosMC = parseFloat(honorarioMayoresCostosObra) || 0;
      }

      // Descuento sobre el importe base
      let descuentoBaseMC = 0;
      if (tipoDescuentoMayoresCostosObra === 'porcentaje') {
        descuentoBaseMC = (baseMayoresCostos * (parseFloat(descuentoMayoresCostosObra) || 0)) / 100;
      } else {
        descuentoBaseMC = parseFloat(descuentoMayoresCostosObra) || 0;
      }

      // Descuento sobre los honorarios
      let descuentoHonorarioMC = 0;
      if (tipoDescuentoHonorarioMayoresCostosObra === 'porcentaje') {
        descuentoHonorarioMC = (honorariosMC * (parseFloat(descuentoHonorarioMayoresCostosObra) || 0)) / 100;
      } else {
        descuentoHonorarioMC = parseFloat(descuentoHonorarioMayoresCostosObra) || 0;
      }

      const subtotalMC = (baseMayoresCostos - descuentoBaseMC) + (honorariosMC - descuentoHonorarioMC);
      total += subtotalMC;

      setImporteTotalObra(total > 0 ? total.toString() : '');

      // IMPORTANTE: Solo actualizar presupuestoEstimado si hay valores en el desglose
      // Si no hay valores, mantener el que ya estaba
      const hayValoresEnDesglose = importeJornalesObra || importeMaterialesObra ||
                                    importeGastosGeneralesObra || importeMayoresCostosObra ||
                                    honorarioJornalesObra || honorarioMaterialesObra ||
                                    honorarioGastosGeneralesObra || honorarioMayoresCostosObra;

      // Solo actualizar si hay valores Y el total es mayor a 0
      // NO actualizar si no hay valores (para mantener el valor original)
      if (hayValoresEnDesglose) {
        if (total > 0) {
          setFormData(prev => ({...prev, presupuestoEstimado: total.toString()}));
        }
      }
      // Si no hay valores en el desglose, NO tocar presupuestoEstimado (mantener valor existente)
    }
  }, [
    usarDesgloseObra, // Necesario porque se usa dentro del efecto
    importeJornalesObra, honorarioJornalesObra, tipoHonorarioJornalesObra, descuentoJornalesObra, tipoDescuentoJornalesObra, descuentoHonorarioJornalesObra, tipoDescuentoHonorarioJornalesObra,
    importeMaterialesObra, honorarioMaterialesObra, tipoHonorarioMaterialesObra, descuentoMaterialesObra, tipoDescuentoMaterialesObra, descuentoHonorarioMaterialesObra, tipoDescuentoHonorarioMaterialesObra,
    importeGastosGeneralesObra, honorarioGastosGeneralesObra, tipoHonorarioGastosGeneralesObra, descuentoGastosGeneralesObra, tipoDescuentoGastosGeneralesObra, descuentoHonorarioGastosGeneralesObra, tipoDescuentoHonorarioGastosGeneralesObra,
    importeMayoresCostosObra, honorarioMayoresCostosObra, tipoHonorarioMayoresCostosObra, descuentoMayoresCostosObra, tipoDescuentoMayoresCostosObra, descuentoHonorarioMayoresCostosObra, tipoDescuentoHonorarioMayoresCostosObra
  ]);

  // Cargar profesionales cuando se abre el modal de trabajo adicional
  React.useEffect(() => {
    const cargarProfesionales = async () => {
      if (modalPresupuesto.mostrar && modalPresupuesto.tipo === TIPOS_PRESUPUESTO.TAREA_LEVE && empresaId) {
        setLoadingProfesionalesTA(true);
        try {
          const response = await api.profesionales.getAll(empresaId);
          const profesionalesData = Array.isArray(response) ? response : (response?.data || response?.resultado || []);
          setProfesionalesDisponiblesTA(profesionalesData);
          console.log('? Profesionales cargados:', profesionalesData.length);

          // Si estamos editando, restaurar desglose desde campos nativos del DTO
          if (trabajoAdicionalEditar) {
            const ta = trabajoAdicionalEditar;
            // Verificar si tiene desglose (cualquier campo de desglose presente)
            if (ta.importeJornales || ta.importeMateriales || ta.importeGastosGenerales || ta.importeMayoresCostos ||
                ta.honorarioJornales || ta.honorarioMateriales || ta.honorarioGastosGenerales || ta.honorarioMayoresCostos) {
              setUsarDesglose(true);

              // Restaurar importes base
              setImporteJornales(ta.importeJornales != null ? String(ta.importeJornales) : '');
              setImporteMateriales(ta.importeMateriales != null ? String(ta.importeMateriales) : '');
              setImporteGastosGenerales(ta.importeGastosGenerales != null ? String(ta.importeGastosGenerales) : '');
              setImporteMayoresCostos(ta.importeMayoresCostos != null ? String(ta.importeMayoresCostos) : '');

              // Restaurar honorarios de Jornales
              setHonorarioJornales(ta.honorarioJornales != null ? String(ta.honorarioJornales) : '');
              setTipoHonorarioJornales(ta.tipoHonorarioJornales || 'porcentaje');

              // Restaurar honorarios de Materiales
              setHonorarioMateriales(ta.honorarioMateriales != null ? String(ta.honorarioMateriales) : '');
              setTipoHonorarioMateriales(ta.tipoHonorarioMateriales || 'porcentaje');

              // Restaurar honorarios de Gastos Generales
              setHonorarioGastosGenerales(ta.honorarioGastosGenerales != null ? String(ta.honorarioGastosGenerales) : '');
              setTipoHonorarioGastosGenerales(ta.tipoHonorarioGastosGenerales || 'porcentaje');

              // Restaurar honorarios de Mayores Costos
              setHonorarioMayoresCostos(ta.honorarioMayoresCostos != null ? String(ta.honorarioMayoresCostos) : '');
              setTipoHonorarioMayoresCostos(ta.tipoHonorarioMayoresCostos || 'porcentaje');

              // Restaurar descuentos de Jornales
              setDescuentoJornales(ta.descuentoJornales != null ? String(ta.descuentoJornales) : '');
              setTipoDescuentoJornales(ta.tipoDescuentoJornales || 'porcentaje');

              // Restaurar descuentos de Materiales
              setDescuentoMateriales(ta.descuentoMateriales != null ? String(ta.descuentoMateriales) : '');
              setTipoDescuentoMateriales(ta.tipoDescuentoMateriales || 'porcentaje');

              // Restaurar descuentos de Gastos Generales
              setDescuentoGastosGenerales(ta.descuentoGastosGenerales != null ? String(ta.descuentoGastosGenerales) : '');
              setTipoDescuentoGastosGenerales(ta.tipoDescuentoGastosGenerales || 'porcentaje');

              // Restaurar descuentos de Mayores Costos
              setDescuentoMayoresCostos(ta.descuentoMayoresCostos != null ? String(ta.descuentoMayoresCostos) : '');
              setTipoDescuentoMayoresCostos(ta.tipoDescuentoMayoresCostos || 'porcentaje');

              // Restaurar descuentos espec?ficos para honorarios
              setDescuentoHonorarioJornales(ta.descuentoHonorarioJornales != null ? String(ta.descuentoHonorarioJornales) : '');
              setTipoDescuentoHonorarioJornales(ta.tipoDescuentoHonorarioJornales || 'porcentaje');

              setDescuentoHonorarioMateriales(ta.descuentoHonorarioMateriales != null ? String(ta.descuentoHonorarioMateriales) : '');
              setTipoDescuentoHonorarioMateriales(ta.tipoDescuentoHonorarioMateriales || 'porcentaje');

              setDescuentoHonorarioGastosGenerales(ta.descuentoHonorarioGastosGenerales != null ? String(ta.descuentoHonorarioGastosGenerales) : '');
              setTipoDescuentoHonorarioGastosGenerales(ta.tipoDescuentoHonorarioGastosGenerales || 'porcentaje');

              setDescuentoHonorarioMayoresCostos(ta.descuentoHonorarioMayoresCostos != null ? String(ta.descuentoHonorarioMayoresCostos) : '');
              setTipoDescuentoHonorarioMayoresCostos(ta.tipoDescuentoHonorarioMayoresCostos || 'porcentaje');

              console.log('?? Desglose TA restaurado desde DTO:', ta);
            } else {
              setUsarDesglose(false);
              setImporteJornales('');
              setImporteMateriales('');
              setImporteGastosGenerales('');
              setImporteMayoresCostos('');
              setHonorarioJornales('');
              setTipoHonorarioJornales('porcentaje');
              setHonorarioMateriales('');
              setTipoHonorarioMateriales('porcentaje');
              setHonorarioGastosGenerales('');
              setTipoHonorarioGastosGenerales('porcentaje');
              setHonorarioMayoresCostos('');
              setTipoHonorarioMayoresCostos('porcentaje');
              setDescuentoJornales('');
              setTipoDescuentoJornales('porcentaje');
              setDescuentoMateriales('');
              setTipoDescuentoMateriales('porcentaje');
              setDescuentoGastosGenerales('');
              setTipoDescuentoGastosGenerales('porcentaje');
              setDescuentoMayoresCostos('');
              setTipoDescuentoMayoresCostos('porcentaje');
      setDescuentoHonorarioJornales('');
      setTipoDescuentoHonorarioJornales('porcentaje');
      setDescuentoHonorarioMateriales('');
      setTipoDescuentoHonorarioMateriales('porcentaje');
      setDescuentoHonorarioGastosGenerales('');
      setTipoDescuentoHonorarioGastosGenerales('porcentaje');
      setDescuentoHonorarioMayoresCostos('');
      setTipoDescuentoHonorarioMayoresCostos('porcentaje');
          }

          // Si estamos editando, cargar los profesionales asignados
          if (trabajoAdicionalEditar && trabajoAdicionalEditar.profesionales) {
            const profRegistrados = [];
            const profAdhoc = [];

            trabajoAdicionalEditar.profesionales.forEach(prof => {
              if (prof.esRegistrado && prof.profesionalId) {
                // Buscar el profesional completo en la lista
                const profCompleto = profesionalesData.find(p => p.id === prof.profesionalId);
                if (profCompleto) {
                  profRegistrados.push(profCompleto);
                }
              } else {
                // Es ad-hoc
                profAdhoc.push({
                  id: prof.id || `adhoc_${Date.now()}_${Math.random()}`,
                  nombre: prof.nombre,
                  tipoProfesional: prof.tipoProfesional,
                  honorario_dia: prof.honorarioDia,
                  telefono: prof.telefono,
                  email: prof.email,
                  _esAdhoc: true
                });
              }
            });

            setProfesionalesSeleccionados(profRegistrados);
            setProfesionalesAdhoc(profAdhoc);
            console.log('?? Profesionales cargados para edici?n:', { registrados: profRegistrados.length, adhoc: profAdhoc.length });
          }
        }
        } catch (error) {
          console.error('? Error cargando profesionales:', error);
          showNotification('Error al cargar profesionales', 'error');
          setProfesionalesDisponiblesTA([]);
        } finally {
          setLoadingProfesionalesTA(false);
        }
      } else if (!modalPresupuesto.mostrar || modalPresupuesto.tipo !== TIPOS_PRESUPUESTO.TAREA_LEVE) {
        // Limpiar al cerrar modal
        setProfesionalesSeleccionados([]);
        setProfesionalesAdhoc([]);
        setMostrarFormularioAdhoc(false);
        setProfesionalAdhocForm({
          nombre: '',
          tipoProfesional: '',
          honorarioDia: '',
          telefono: '',
          email: ''
        });
      }
    };
    cargarProfesionales();
  }, [modalPresupuesto.mostrar, modalPresupuesto.tipo, empresaId]);

  // ?? NUEVO: Cargar TAREAS LEVES (PresupuestoNoCliente tipo TAREA_LEVE)
  React.useEffect(() => {
    const cargarTareasLeves = async () => {
      if (empresaId) {
        try {
          const todasLasTareas = await presupuestoService.listarPresupuestos(empresaId, {
            tipo: TIPOS_PRESUPUESTO.TAREA_LEVE
          });

          // Mapear campos de presupuesto a estructura esperada por el render
          const tareasMapeadas = todasLasTareas.map(presup => {
            // Construir direcci?n desde campos separados
            const direccionCompleta = presup.direccionObraCalle && presup.direccionObraAltura
              ? `${presup.direccionObraCalle} ${presup.direccionObraAltura}`.trim()
              : presup.direccionObraCalle || presup.direccion || '?';

            // Buscar la obra vinculada en el array de obras para obtener datos completos
            const obraVinculada = presup.obraId
              ? obras.find(o => o.id === presup.obraId) || presup.obra
              : presup.obra;

            const nombreClienteObra = obraVinculada?.nombreCliente || obraVinculada?.cliente?.nombre || '';
            const direccionObra = obraVinculada?.direccion || '';
            const telefonoObra = obraVinculada?.telefonoContacto || obraVinculada?.telefono || '';

            return {
              ...presup,
              nombre: presup.nombreObra || presup.nombre || 'Sin nombre',
              nombreCliente: presup.nombreSolicitante || nombreClienteObra || 'Sin especificar',
              direccion: direccionCompleta !== '?' ? direccionCompleta : (direccionObra || '?'),
              contacto: presup.telefono || telefonoObra || '?',
              importe: presup.totalConDescuentos || presup.totalFinal || presup.importe || 0,
              fechaInicio: presup.fechaProbableInicio || presup.fechaInicio,
              fechaFin: presup.fechaFinalizacion || presup.fechaFin,
              descripcion: presup.descripcion || '',
              tipoPresupuesto: presup.modoPresupuesto === 'TRADICIONAL' ? 'GLOBAL' : 'DETALLADO',
              fechaCreacion: presup.fechaCreacion || presup.createdAt,
              version: presup.numeroVersion || presup.version || 1,
              // ?? CRÍTICO: Preservar obraId para poder buscar todos los presupuestos de la obra
              obraId: presup.obraId || presup.idObra
            };
          });

          setTareasLeves(tareasMapeadas);

          // ?? IMPORTANTE: Guardar presupuestos en presupuestosObras para que estén disponibles
          // Usar OBRA ID como clave, no presupuesto ID, para que funcione con selectedObraId
          const presupuestosPorObraId = {};
          tareasMapeadas.forEach(tarea => {
            if (tarea.obraId) {
              presupuestosPorObraId[tarea.obraId] = tarea;
              console.log(`📋 Guardando presupuesto TAREA_LEVE: obra[${tarea.obraId}] = presupuesto ${tarea.id}`);
            }
          });

          setPresupuestosObras(prev => {
            const nuevo = { ...prev };
            // ⚠️ CRÍTICO: NO sobrescribir presupuestos existentes con tareas leves
            Object.entries(presupuestosPorObraId).forEach(([obraId, presupuesto]) => {
              if (!prev[obraId]) {
                nuevo[obraId] = presupuesto;
              } else {
                console.log(`⚠️ Saltando tarea leve para obra ${obraId} - ya existe presupuesto principal`);
              }
            });
            return nuevo;
          });
        } catch (error) {
          console.error('? Error al cargar tareas leves:', error);
          setTareasLeves([]);
        }
      } else {
        setTareasLeves([]);
      }
    };
    cargarTareasLeves();
  }, [empresaId, obras]);

  // NUEVO: Cargar TRABAJOS ADICIONALES (entidad TrabajoAdicional real)
  React.useEffect(() => {
    const cargarTrabajosAdicionales = async () => {
      if (!empresaId) {
        setTrabajosAdicionales([]);
        return;
      }

      try {
        const trabajos = await trabajosAdicionalesService.listarTrabajosAdicionales(empresaId);
        setTrabajosAdicionales(trabajos);
      } catch (error) {
        console.error('Error al cargar tareas leves:', error);
        setTrabajosAdicionales([]);
      }
    };
    cargarTrabajosAdicionales();
  }, [empresaId]);



  // ?? DEBUG: Exponer funci?n global para inspeccionar trabajos extra desde consola
  React.useEffect(() => {
    window.debugTrabajosExtra = () => {
      console.clear();
      console.log('%c---------------------------------------------------', 'color: #00f; font-weight: bold');
      console.log('%c ?? DEBUG TRABAJOS EXTRA - Estado Completo', 'color: #00f; font-weight: bold; font-size: 16px');
      console.log('%c---------------------------------------------------', 'color: #00f; font-weight: bold');
      console.log('');

      console.log('%c?? RESUMEN GENERAL', 'color: #f80; font-weight: bold; font-size: 14px');
      console.log('Total trabajos extra en estado:', trabajosExtra.length);
      console.log('IDs:', trabajosExtra.map(t => t.id));
      console.log('');

      trabajosExtra.forEach((trabajo, index) => {
        console.log(`%c?????????????????????????????????????????????????`, 'color: #0f0');
        console.log(`%c?? TRABAJO #${index + 1}: ${trabajo.nombreObra || trabajo.nombre}`, 'color: #0f0; font-weight: bold; font-size: 13px');
        console.log(`%c?????????????????????????????????????????????????`, 'color: #0f0');

        console.log('?? ID:', trabajo.id);
        console.log('?? Nombre:', trabajo.nombreObra || trabajo.nombre);
        console.log('');

        console.log('%c?? PROFESIONALES', 'color: #00f; font-weight: bold');
        console.log('  Array existe:', !!trabajo.profesionales);
        console.log('  Es array:', Array.isArray(trabajo.profesionales));
        console.log('  Cantidad:', trabajo.profesionales?.length || 0);
        if (trabajo.profesionales?.length > 0) {
          console.log('  Detalle:', trabajo.profesionales.map(p => ({
            id: p.id,
            nombre: p.profesional?.nombre || p.nombre || 'N/A',
            tipo: p.profesional?.tipoProfesional || p.tipoProfesional || 'N/A'
          })));
        }
        console.log('');

        console.log('%c?? MATERIALES', 'color: #f80; font-weight: bold');
        console.log('  Array existe:', !!trabajo.materiales);
        console.log('  Es array:', Array.isArray(trabajo.materiales));
        console.log('  Cantidad:', trabajo.materiales?.length || 0);
        if (trabajo.materiales?.length > 0) {
          console.log('  Detalle:', trabajo.materiales.map(m => ({
            id: m.id,
            nombre: m.material?.nombre || m.nombre || 'N/A',
            cantidad: m.cantidad || 0
          })));
        }
        console.log('');

        console.log('%c?? GASTOS GENERALES', 'color: #f00; font-weight: bold');
        console.log('  Array existe:', !!trabajo.gastosGenerales);
        console.log('  Es array:', Array.isArray(trabajo.gastosGenerales));
        console.log('  Cantidad:', trabajo.gastosGenerales?.length || 0);
        if (trabajo.gastosGenerales?.length > 0) {
          console.log('  Detalle:', trabajo.gastosGenerales.map(g => ({
            id: g.id,
            nombre: g.otroCosto?.nombre || g.nombre || 'N/A',
            monto: g.monto || 0
          })));
        }
        console.log('');

        console.log('%c?? DATOS COMPLETOS DEL OBJETO', 'color: #666; font-weight: bold');
        console.log(trabajo);
        console.log('');
      });

      console.log('%c---------------------------------------------------', 'color: #00f; font-weight: bold');
      console.log('%c? Inspecci?n completa finalizada', 'color: #0f0; font-weight: bold');
      console.log('%c---------------------------------------------------', 'color: #00f; font-weight: bold');
      console.log('');
      console.log('%cPara volver a ejecutar, escribe: debugTrabajosExtra()', 'color: #666; font-style: italic');
    };

    // ?? Funci?n para verificar asignaciones reales del backend
    window.verificarAsignacionesBackend = async (trabajoExtraId = 7) => {
      console.clear();
      console.log('%c---------------------------------------------------', 'color: #f00; font-weight: bold');
      console.log('%c ?? VERIFICACI�N BACKEND - Trabajo Extra ID: ' + trabajoExtraId, 'color: #f00; font-weight: bold; font-size: 16px');
      console.log('%c---------------------------------------------------', 'color: #f00; font-weight: bold');
      console.log('');

      const empresaId = localStorage.getItem('empresaId') || 1;
      console.log('?? Empresa ID:', empresaId);
      console.log('?? Consultando asignaciones para Trabajo Extra ID:', trabajoExtraId);

      // Buscar info del trabajo extra
      const trabajoInfo = trabajosExtra.find(t => t.id === trabajoExtraId);
      if (trabajoInfo) {
        console.log('?? Nombre:', trabajoInfo.nombreObra || trabajoInfo.nombre);
        console.log('??? Obra Padre ID:', trabajoInfo.obraId);
      }
      console.log('');

      try {
        // 1. Verificar Profesionales
        console.log('%c?? CONSULTANDO PROFESIONALES...', 'color: #00f; font-weight: bold');
        const responseProfesionales = await fetch(`/api/profesionales/asignaciones/${trabajoExtraId}`, {
          headers: {
            'empresaId': empresaId,
            'X-Tenant-ID': empresaId
          }
        });
        const profesionalesData = await responseProfesionales.json();
        console.log('  Status:', responseProfesionales.status);
        console.log('  Response cruda:', profesionalesData);

        // Procesar igual que en cargarTrabajosExtra
        let dataProfesionales = profesionalesData.data || profesionalesData;
        if (dataProfesionales.data && Array.isArray(dataProfesionales.data)) {
          dataProfesionales = dataProfesionales.data;
        }
        const asignaciones = Array.isArray(dataProfesionales) ? dataProfesionales : [];

        // Contar profesionales ?nicos como lo hace la funci?n real
        const profesionalesUnicos = new Set();
        asignaciones.forEach(asignacion => {
          if (asignacion.asignacionesPorSemana && Array.isArray(asignacion.asignacionesPorSemana)) {
            asignacion.asignacionesPorSemana.forEach(semana => {
              if (semana.detallesPorDia && Array.isArray(semana.detallesPorDia)) {
                semana.detallesPorDia.forEach(detalle => {
                  if (detalle.profesionalId && detalle.cantidad > 0) {
                    profesionalesUnicos.add(detalle.profesionalId);
                  }
                });
              }
            });
          }
        });

        const profesionales = Array.from(profesionalesUnicos).map(id => ({ profesionalId: id }));
        console.log('  Asignaciones encontradas:', asignaciones.length);
        console.log('  Profesionales ?nicos:', profesionalesUnicos.size);
        console.log('  Profesionales procesados:', profesionales);

        // ?? VERIFICAR OBRA_ID DE CADA ASIGNACI�N
        console.log('%c  ?? VERIFICANDO OBRA_ID DE ASIGNACIONES:', 'color: #ff0; font-weight: bold; background: #000; padding: 2px');
        asignaciones.forEach((asig, idx) => {
          console.log(`    Asignaci?n ${idx + 1}:`, {
            id: asig.id,
            obraId: asig.obraId,
            profesionalId: asig.profesionalId,
            esDelTrabajoExtra: asig.obraId === trabajoExtraId,
            profesional: asig.profesional?.nombre || 'N/A'
          });
        });
        console.log('');

        // 2. Verificar Materiales
        console.log('%c?? CONSULTANDO MATERIALES...', 'color: #f80; font-weight: bold');
        const responseMateriales = await fetch(`/api/obras/${trabajoExtraId}/materiales?empresaId=${empresaId}`, {
          headers: {
            'empresaId': empresaId,
            'X-Tenant-ID': empresaId
          }
        });
        const materialesData = await responseMateriales.json();
        const materiales = materialesData.data || materialesData;
        console.log('  Status:', responseMateriales.status);
        console.log('  Cantidad:', Array.isArray(materiales) ? materiales.length : 0);
        console.log('  Datos:', materiales);

        // ?? VERIFICAR OBRA_ID DE CADA MATERIAL
        console.log('%c  ?? VERIFICANDO OBRA_ID DE MATERIALES:', 'color: #ff0; font-weight: bold; background: #000; padding: 2px');
        if (Array.isArray(materiales)) {
          materiales.forEach((mat, idx) => {
            console.log(`    Material ${idx + 1}:`, {
              id: mat.id,
              obraId: mat.obraId,
              materialId: mat.materialId,
              esDelTrabajoExtra: mat.obraId === trabajoExtraId,
              material: mat.material?.nombre || 'N/A',
              cantidad: mat.cantidad
            });
          });
        }
        console.log('');

        // 3. Verificar Gastos
        console.log('%c?? CONSULTANDO GASTOS GENERALES...', 'color: #f00; font-weight: bold');
        const responseGastos = await fetch(`/api/obras/${trabajoExtraId}/otros-costos`, {
          headers: {
            'empresaId': empresaId,
            'X-Tenant-ID': empresaId,
            'Content-Type': 'application/json'
          }
        });
        const gastos = await responseGastos.json();
        console.log('  Status:', responseGastos.status);
        console.log('  Cantidad:', Array.isArray(gastos) ? gastos.length : 0);
        console.log('  Datos:', gastos);

        // ?? VERIFICAR OBRA_ID DE CADA GASTO
        console.log('%c  ?? VERIFICANDO OBRA_ID DE GASTOS:', 'color: #ff0; font-weight: bold; background: #000; padding: 2px');
        if (Array.isArray(gastos)) {
          gastos.forEach((gasto, idx) => {
            console.log(`    Gasto ${idx + 1}:`, {
              id: gasto.id,
              obraId: gasto.obraId,
              otroCostoId: gasto.otroCostoId,
              esDelTrabajoExtra: gasto.obraId === trabajoExtraId,
              gasto: gasto.otroCosto?.nombre || 'N/A',
              monto: gasto.monto
            });
          });
        }
        console.log('');

        // Resumen
        console.log('%c---------------------------------------------------', 'color: #f00; font-weight: bold');
        console.log('%c?? RESUMEN BACKEND', 'color: #0f0; font-weight: bold; font-size: 14px');
        console.log('%c---------------------------------------------------', 'color: #f00; font-weight: bold');
        console.log('? Profesionales:', Array.isArray(profesionales) ? profesionales.length : 0);
        console.log('? Materiales:', Array.isArray(materiales) ? materiales.length : 0);
        console.log('? Gastos:', Array.isArray(gastos) ? gastos.length : 0);
        console.log('');

        // VALIDACI�N DE PERTENENCIA
        console.log('%c?? VALIDACI�N DE PERTENENCIA', 'color: #f0f; font-weight: bold; font-size: 14px');
        const profDelTrabajoExtra = asignaciones.filter(a => a.obraId === trabajoExtraId).length;
        const matDelTrabajoExtra = Array.isArray(materiales) ? materiales.filter(m => m.obraId === trabajoExtraId).length : 0;
        const gastosDelTrabajoExtra = Array.isArray(gastos) ? gastos.filter(g => g.obraId === trabajoExtraId).length : 0;

        console.log(`Profesionales con obraId=${trabajoExtraId}:`, profDelTrabajoExtra, '/', asignaciones.length);
        console.log(`Materiales con obraId=${trabajoExtraId}:`, matDelTrabajoExtra, '/', (Array.isArray(materiales) ? materiales.length : 0));
        console.log(`Gastos con obraId=${trabajoExtraId}:`, gastosDelTrabajoExtra, '/', (Array.isArray(gastos) ? gastos.length : 0));

        if (profDelTrabajoExtra !== asignaciones.length) {
          console.log('%c ADVERTENCIA: Algunas asignaciones de profesionales NO pertenecen al trabajo extra', 'color: #f00; font-weight: bold; background: #ff0; padding: 5px');
        }
        if (matDelTrabajoExtra !== (Array.isArray(materiales) ? materiales.length : 0)) {
          console.log('%c ADVERTENCIA: Algunos materiales NO pertenecen al trabajo extra', 'color: #f00; font-weight: bold; background: #ff0; padding: 5px');
        }
        if (gastosDelTrabajoExtra !== (Array.isArray(gastos) ? gastos.length : 0)) {
          console.log('%c ADVERTENCIA: Algunos gastos NO pertenecen al trabajo extra', 'color: #f00; font-weight: bold; background: #ff0; padding: 5px');
        }
        console.log('');

        console.log('%c?? COMPARACI�N CON ESTADO REACT', 'color: #00f; font-weight: bold; font-size: 14px');
        const trabajoEnEstado = trabajosExtra.find(t => t.id === trabajoExtraId);
        if (trabajoEnEstado) {
          console.log('Estado React - Profesionales:', trabajoEnEstado.profesionales?.length || 0);
          console.log('Estado React - Materiales:', trabajoEnEstado.materiales?.length || 0);
          console.log('Estado React - Gastos:', trabajoEnEstado.gastosGenerales?.length || 0);
          console.log('');

          const profMatch = (trabajoEnEstado.profesionales?.length || 0) === (Array.isArray(profesionales) ? profesionales.length : 0);
          const matMatch = (trabajoEnEstado.materiales?.length || 0) === (Array.isArray(materiales) ? materiales.length : 0);
          const gastMatch = (trabajoEnEstado.gastosGenerales?.length || 0) === (Array.isArray(gastos) ? gastos.length : 0);

          console.log(profMatch ? '%c? Profesionales: CORRECTO' : '%c? Profesionales: DESINCRONIZADO', profMatch ? 'color: #0f0' : 'color: #f00; font-weight: bold');
          console.log(matMatch ? '%c? Materiales: CORRECTO' : '%c? Materiales: DESINCRONIZADO', matMatch ? 'color: #0f0' : 'color: #f00; font-weight: bold');
          console.log(gastMatch ? '%c? Gastos: CORRECTO' : '%c? Gastos: DESINCRONIZADO', gastMatch ? 'color: #0f0' : 'color: #f00; font-weight: bold');
        } else {
          console.log('%c Trabajo Extra no encontrado en el estado React', 'color: #f80; font-weight: bold');
        }
        console.log('');
        console.log('%c---------------------------------------------------', 'color: #f00; font-weight: bold');

      } catch (error) {
        console.error('%c? ERROR consultando backend:', 'color: #f00; font-weight: bold', error);
      }
    };

    console.log('%c?? DEBUG HABILITADO: Usa debugTrabajosExtra() en la consola para inspeccionar', 'color: #0ff; font-weight: bold; background: #000; padding: 5px');
    console.log('%c?? BACKEND CHECK: Usa verificarAsignacionesBackend(7) para consultar asignaciones reales', 'color: #f0f; font-weight: bold; background: #000; padding: 5px');

    return () => {
      delete window.debugTrabajosExtra;
      delete window.verificarAsignacionesBackend;
    };
  }, [trabajosExtra]);

  // Estados para Ver Asignaciones
  const [mostrarModalVerAsignaciones, setMostrarModalVerAsignaciones] = React.useState(false);
  const [obraParaVerAsignaciones, setObraParaVerAsignaciones] = React.useState(null);
  const [trabajoExtraEditar, setTrabajoExtraEditar] = React.useState(null);
  const [trabajoExtraSeleccionado, setTrabajoExtraSeleccionado] = React.useState(null);
  const [trabajoExtraExpandido, setTrabajoExtraExpandido] = React.useState(null); // Nuevo estado
  const [obraParaTrabajosExtra, setObraParaTrabajosExtra] = React.useState(null);
  const [mostrarModalSeleccionarObraTrabajosExtra, setMostrarModalSeleccionarObraTrabajosExtra] = React.useState(false);
  const [obraSeleccionadaTrabajosExtra, setObraSeleccionadaTrabajosExtra] = React.useState(null);

  // Estado para obras expandidas (acorde?n)
  const [obrasExpandidas, setObrasExpandidas] = React.useState(new Set());

  // Estado para presupuestos de obras (para calcular fechas)
  const [presupuestosObras, setPresupuestosObras] = React.useState({});

  // Estado para contadores de elementos por obra (para badges)
  const [contadoresObras, setContadoresObras] = React.useState({});

  // Estado para almacenar datos detallados de asignaciones por obra
  const [datosAsignacionesPorObra, setDatosAsignacionesPorObra] = React.useState({});

  // Estados para profesionales en formulario de creaci?n
  const [tipoProfesional, setTipoProfesional] = React.useState('LISTADO_GENERAL');
  const [profesionalSeleccionado, setProfesionalSeleccionado] = React.useState('');
  const [profesionalesAsignadosForm, setProfesionalesAsignadosForm] = React.useState([]);
  const [profesionalesDisponibles, setProfesionalesDisponibles] = React.useState([]);
  const [loadingProfesionales, setLoadingProfesionales] = React.useState(false);
  const [mostrarModalSeleccionProfesionales, setMostrarModalSeleccionProfesionales] = React.useState(false);
  const [asignacionesExistentesObra, setAsignacionesExistentesObra] = React.useState([]);

  // Estados para modo edici?n
  const [modoEdicion, setModoEdicion] = React.useState(false);
  const [obraEditando, setObraEditando] = React.useState(null);

  // Estados para ingreso manual de profesional
  const [profesionalManual, setProfesionalManual] = React.useState({
    nombre: '',
    tipoProfesional: '',
    valorHora: ''
  });

  // Estados para Etapas Diarias
  const [etapasDiarias, setEtapasDiarias] = React.useState([]);
  const [loadingEtapasDiarias, setLoadingEtapasDiarias] = React.useState(false);
  const [mostrarModalEtapaDiaria, setMostrarModalEtapaDiaria] = React.useState(false);
  const [etapaDiariaEditar, setEtapaDiariaEditar] = React.useState(null);
  const [obraParaEtapasDiarias, setObraParaEtapasDiarias] = React.useState(null);
  const [calendarioVersion, setCalendarioVersion] = React.useState(0); // Contador para forzar regeneraci?n
  const [filtroEstadoEtapa, setFiltroEstadoEtapa] = React.useState('TODAS');
  const [diaSeleccionado, setDiaSeleccionado] = React.useState(null);
  const [mostrarModalDetalleDia, setMostrarModalDetalleDia] = React.useState(false);

  // Ref para evitar actualizar el presupuesto m?ltiples veces
  const presupuestoAsignadoRef = React.useRef(new Set());

  // Ref para controlar la inicializaci?n de la p?gina
  const inicializadoRef = React.useRef(false);

  // Estado para modal de env?o de obra independiente
  const [mostrarModalEnviarObra, setMostrarModalEnviarObra] = React.useState(false);
  const [obraParaEnviar, setObraParaEnviar] = React.useState(null);

  // Estados para modales de estad?sticas
  const [mostrarModalEstadisticasObra, setMostrarModalEstadisticasObra] = React.useState(false);
  const [obraParaEstadisticas, setObraParaEstadisticas] = React.useState(null);
  const [mostrarModalEstadisticasTodasObras, setMostrarModalEstadisticasTodasObras] = React.useState(false);
  const [mostrarDropdownEstadisticas, setMostrarDropdownEstadisticas] = React.useState(false);

  // Callback memoizado para abrir modal de detalle de d?a
  const handleVerDetalleDia = React.useCallback((diaData) => {
    setDiaSeleccionado(diaData);
    setMostrarModalDetalleDia(true);
  }, []);

  // Local state para formularios
  const [formData, setFormData] = React.useState({
    nombre: '',
    direccion: '',
    estado: 'APROBADO',
    fechaInicio: '',
    fechaFin: '',
    presupuestoEstimado: '',
    idCliente: '',
    empresaId: empresaId,
    // Campos para nuevo cliente
    nombreSolicitante: '',
    telefono: '',
    direccionParticular: '',
    mail: '',
    // Campos para direcci?n detallada de la obra
    direccionObraCalle: '',
    direccionObraAltura: '',
    direccionObraBarrio: '',
    direccionObraTorre: '',
    direccionObraPiso: '',
    direccionObraDepartamento: '',
    // Campos adicionales
    descripcion: '',
    observaciones: ''
  });

  const [busquedaData, setBusquedaData] = React.useState({
    empresaId: empresaId,
    clienteId: ''
  });

  // Helper para obtener datos de Redux de clientes
  const clientes = useSelector(state => state.clientes.clientes);

  // Helper para mostrar informaci?n del cliente
  const getClienteInfo = (obra) => {
    const clienteId = obra.clienteId || obra.idCliente;
    if (!clienteId) return 'Sin cliente';

    // Buscar el cliente en el store de Redux
    const cliente = clientes.find(c => c.id == clienteId);
    if (cliente) {
      return `${cliente.nombre} (ID: ${clienteId})`;
    }

    return `Cliente ID: ${clienteId}`;
  };

  // Helper para mostrar solo el nombre del cliente
  const getClienteNombre = (obra) => {
    const clienteId = obra.clienteId || obra.idCliente;
    if (!clienteId) return '-';

    // Buscar el cliente con id_cliente (no id)
    const cliente = clientes?.find(c => c.id_cliente == clienteId);

    if (cliente) {
      return cliente.nombre || cliente.nombreCompleto || `Cliente ${clienteId}`;
    }

    return `Cliente ID: ${clienteId}`;
  };

  // Leer par?metro tab de la URL y activar pesta?a correspondiente
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && (tabParam === 'crear' || tabParam === 'trabajos-extra' || tabParam === 'listado' || tabParam === 'obras-manuales')) {
      dispatch(setActiveTab(tabParam));
      // Limpiar el par?metro de la URL despu?s de usarlo
      searchParams.delete('tab');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, dispatch, setSearchParams]);

  // Cargar datos iniciales
  useEffect(() => {
    const initializeObrasPage = async () => {
      // Evitar múltiples ejecuciones
      if (inicializadoRef.current) return;
      inicializadoRef.current = true;

      try {
        await dispatch(fetchEstadosDisponibles()).unwrap();
        await dispatch(fetchClientes({ empresaId })).unwrap();

        // Cargar profesionales disponibles usando la función centralizada
        if (empresaId) {
          await refrescarProfesionalesDisponibles();
        }
      } catch (error) {
        // Solo mostrar error si es un problema real (no estados disponibles que tiene fallback)
        console.log('ℹ️ Inicialización de obras con algunos datos por defecto');
        // No mostrar notificación ya que fetchEstadosDisponibles tiene fallback automático
      }
    };

    if (empresaId) {
      // Resetear flag si cambia la empresa
      if (!inicializadoRef.current) {
        initializeObrasPage();
      }
      setFormData(formData => ({ ...formData, empresaId }));
      setBusquedaData(busquedaData => ({ ...busquedaData, empresaId }));
    }
  }, [dispatch, empresaId]);

  // Resetear flag cuando cambia empresa
  useEffect(() => {
    inicializadoRef.current = false;
  }, [empresaId]);

  // ?? Construir mapa de relaciones obra padre -> obras trabajo extra
  useEffect(() => {
    if (!obras || obras.length === 0) {
      setMapObraPadre({});
      return;
    }

    const mapa = {};
    obras.forEach(obra => {
      if (obra.esTrabajoExtra) {
        // ?? El backend deber?a enviar obraPadreId indicando qu? obra gener? este trabajo extra
        // Este valor proviene del presupuesto que cre? esta obra (campo obraId del presupuesto)
        const obraPadreId = obra.obraPadreId || obra.obra_padre_id || obra.idObraPadre;

        if (obraPadreId) {
          if (!mapa[obraPadreId]) {
            mapa[obraPadreId] = [];
          }
          mapa[obraPadreId].push(obra.id);
          console.log(`?? Obra ${obra.id} (${obra.nombre}) es trabajo extra de obra ${obraPadreId}`);
        } else {
          console.warn(` Obra ${obra.id} (${obra.nombre}) marcada como trabajo extra pero sin obraPadreId`);
        }
      }
    });

    setMapObraPadre(mapa);
    if (Object.keys(mapa).length > 0) {
      console.log('?? Mapa de obras padre construido:', mapa);
    }
  }, [obras]);

  // Cargar obras cuando cambie el filtro de estado
  useEffect(() => {
    if (empresaId) {
      cargarObrasSegunFiltro();
    }
  }, [estadoFilter, empresaId]);

  // ?? Enriquecer obras con presupuestos completos para que el badge funcione
  useEffect(() => {
    const enriquecerObrasConPresupuestos = async () => {
      if (!obras || obras.length === 0 || !empresaId) return;

      try {
        // Obtener todos los presupuestos de la empresa CON CACHE BUST
        const todosPresupuestos = await api.presupuestosNoCliente.getAll(empresaId, { _t: Date.now() });

        console.log('?? DEBUG: Todos los presupuestos cargados:', todosPresupuestos.length);
        todosPresupuestos.forEach(p => {
          console.log(`   - Presupuesto ID: ${p.id}, Nombre: "${p.nombreObra}", obraId: ${p.obraId}, Versi?n: ${p.numeroVersion}`);
        });

        // Crear objeto con presupuestos indexados por obraId
        const presupuestosPorObra = {};
        // Para cada obra, guardar el presupuesto con la versi?n m?s alta
        todosPresupuestos.forEach(presupuesto => {
          const obraId = presupuesto.obraId || presupuesto.idObra;
          if (obraId) {
            if (!presupuestosPorObra[obraId] || (presupuesto.numeroVersion > (presupuestosPorObra[obraId].numeroVersion || 0))) {
              console.log(`?? Guardando presupuesto ID ${presupuesto.id} ("${presupuesto.nombreObra}") para obra ${obraId}`);

              // ✅ Calcular y guardar el total correcto inmediatamente
              const totalCalculado = obtenerTotalPresupuesto(presupuesto);
              presupuestosPorObra[obraId] = {
                ...presupuesto,
                totalPresupuestoCalculado: totalCalculado // Guardar total calculado
              };

              console.log(`   💰 Total calculado: $${totalCalculado.toLocaleString('es-AR')}`);
            } else {
              console.log(`   ?? Saltando presupuesto ID ${presupuesto.id} (versi?n menor o igual)`);
            }
          }
        });

        console.log('??? Diccionario presupuestosObras construido:');
        console.table(Object.entries(presupuestosPorObra).map(([obraId, p]) => ({
          ObraID: obraId,
          PresupuestoID: p.id,
          NombreObra: p.nombreObra,
          Version: p.numeroVersion
        })));

        // 🆕 PASO 2: Cargar presupuestos para obras que tienen presupuestoNoClienteId pero no fueron mapeados por obraId
        // (Esto cubre trabajos diarios cuyo presupuesto no tiene obraId configurado correctamente)
        if (obras && obras.length > 0) {
          const obrasConPresupuestoFaltante = obras.filter(obra => {
            const presupuestoId = obra.presupuestoNoClienteId || obra.presupuesto_no_cliente_id;
            // Si tiene presupuesto pero NO fue cargado en presupuestosPorObra
            return presupuestoId && !presupuestosPorObra[obra.id];
          });

          if (obrasConPresupuestoFaltante.length > 0) {
            console.log(`?? Encontradas ${obrasConPresupuestoFaltante.length} obras con presupuesto no cargado. Cargando...`);

            obrasConPresupuestoFaltante.forEach(obra => {
              const presupuestoId = obra.presupuestoNoClienteId || obra.presupuesto_no_cliente_id;
              const presupuestoEncontrado = todosPresupuestos.find(p => p.id === presupuestoId);

              if (presupuestoEncontrado) {
                console.log(`  ?? Mapeando presupuesto ${presupuestoId} a obra ${obra.id} (${obra.nombre})`);
                const totalCalculado = obtenerTotalPresupuesto(presupuestoEncontrado);
                presupuestosPorObra[obra.id] = {
                  ...presupuestoEncontrado,
                  totalPresupuestoCalculado: totalCalculado
                };
                console.log(`   ?? Total calculado: $${totalCalculado.toLocaleString('es-AR')}`);
              }
            });
          }
        }

        // Guardar en estado CON MERGE para no sobrescribir presupuestos ya cargados
        setPresupuestosObras(prev => ({
          ...prev,
          ...presupuestosPorObra
        }));
        console.log('? Presupuestos cargados:', Object.keys(presupuestosPorObra).length);
        console.log('?? Claves del diccionario:', Object.keys(presupuestosPorObra).join(', '));

      } catch (error) {
        console.warn(' No se pudieron cargar presupuestos para badges:', error);
      }
    };

    enriquecerObrasConPresupuestos();
  }, [obras?.length, empresaId]);

  // Escuchar evento de presupuesto actualizado para refrescar totales en tiempo real
  useEffect(() => {
    if (!empresaId) return;

    const handlePresupuestoActualizado = (data) => {
      const presupuestoId = data?.presupuestoId || data?.id;
      if (!presupuestoId) return;

      // Buscar en presupuestosObras qué obra tiene este presupuesto
      setPresupuestosObras(prev => {
        const obraId = Object.keys(prev).find(key => prev[key]?.id === presupuestoId);
        if (!obraId) return prev;

        // Recargar el presupuesto actualizado desde el backend
        fetch(`/api/presupuestos-no-cliente/${presupuestoId}`, {
          headers: { 'empresaId': empresaId.toString() }
        })
          .then(res => res.json())
          .then(presupuestoActualizado => {
            const totalCalculado = obtenerTotalPresupuesto(presupuestoActualizado);
            setPresupuestosObras(p => ({
              ...p,
              [obraId]: { ...presupuestoActualizado, totalPresupuestoCalculado: totalCalculado }
            }));
          })
          .catch(() => {});

        return prev;
      });
    };

    const unsubscribe = eventBus.on(FINANCIAL_EVENTS.PRESUPUESTO_ACTUALIZADO, handlePresupuestoActualizado);
    return unsubscribe;
  }, [empresaId]);

  // Cargar configuraci?n desde BD cuando cambia la obra seleccionada
  useEffect(() => {
    if (selectedObraId && empresaId) {
      // No cargar configuraci?n para tareas leves
      if (typeof selectedObraId === 'string' && selectedObraId.startsWith('ta_')) {
        console.log('?? [ObrasPage] Saltando carga de configuraci?n para tarea leve:', selectedObraId);
        return;
      }

      cargarYSincronizarConfiguracion(selectedObraId)
        .then(config => {
          if (config) {
            setConfigCargada(prev => prev + 1); // Forzar re-render
          }
        })
        .catch(err => {
          console.error('Error al cargar configuraci?n:', err);
        });
    }
  }, [selectedObraId, empresaId]);

  // ?? Refrescar presupuesto de la obra seleccionada para usar d?as h?biles actuales
  useEffect(() => {
    if (!obraParaEtapasDiarias?.id || !obraParaEtapasDiarias?.presupuestoNoCliente?.id || !empresaId) return;

    let activo = true;

    const refrescarPresupuesto = async () => {
      try {
        const presupuestoActualizado = await api.presupuestosNoCliente.getById(
          obraParaEtapasDiarias.presupuestoNoCliente.id,
          empresaId
        );

        if (!activo || !presupuestoActualizado) return;

        // ✅ Calcular y guardar el total correcto
        const totalCalculado = obtenerTotalPresupuesto(presupuestoActualizado);

        setPresupuestosObras(prev => ({
          ...prev,
          [obraParaEtapasDiarias.id]: {
            ...presupuestoActualizado,
            totalPresupuestoCalculado: totalCalculado
          }
        }));
      } catch (error) {
        console.warn(' No se pudo refrescar presupuesto de la obra seleccionada:', error);
      }
    };

    refrescarPresupuesto();

    return () => {
      activo = false;
    };
  }, [obraParaEtapasDiarias?.id, obraParaEtapasDiarias?.presupuestoNoCliente?.id, empresaId]);

  // Cargar configuraciones para todas las obras visibles
  // TEMPORALMENTE DESHABILITADO - causaba bucle infinito
  // useEffect(() => {
  //   if (obras && obras.length > 0 && empresaId) {
  //     // Cargar configuraciones en paralelo para todas las obras
  //     Promise.allSettled(
  //       obras.map(obra => cargarYSincronizarConfiguracion(obra.id))
  //     ).then(() => {
  //       setConfigCargada(prev => prev + 1); // Forzar re-render despu?s de cargar todas
  //     });
  //   }
  // }, [obras.length, empresaId]); // Solo cuando cambia la cantidad de obras o empresa


  // Cargar datos de obra en modo edici?n
  useEffect(() => {
    if (modoEdicion && obraEditando) {
      console.log('?? Cargando datos de obra en modo edici?n:', obraEditando);
      setFormData({
        nombre: obraEditando.nombre || '',
        direccion: obraEditando.direccion || '',
        estado: obraEditando.estado || 'APROBADO',
        fechaInicio: obraEditando.fechaInicio || '',
        fechaFin: obraEditando.fechaFin || '',
        presupuestoEstimado: obraEditando.presupuestoEstimado || '',
        idCliente: obraEditando.clienteId || obraEditando.idCliente || '',
        empresaId: obraEditando.empresaId || empresaId,
        // Campos para direcci?n detallada de la obra
        direccionObraCalle: obraEditando.direccionObraCalle || '',
        direccionObraAltura: obraEditando.direccionObraAltura || '',
        direccionObraBarrio: obraEditando.direccionObraBarrio || '',
        direccionObraTorre: obraEditando.direccionObraTorre || '',
        direccionObraPiso: obraEditando.direccionObraPiso || '',
        direccionObraDepartamento: obraEditando.direccionObraDepartamento || '',
        // Campos adicionales
        descripcion: obraEditando.descripcion || '',
        observaciones: obraEditando.observaciones || '',
        // Campos para nuevo cliente (vac?os en modo edici?n)
        nombreSolicitante: '',
        telefono: '',
        direccionParticular: '',
        mail: ''
      });
    }
  }, [modoEdicion, obraEditando, empresaId]);

  // Enviar controles al Sidebar
  useEffect(() => {
    // No ejecutar este efecto si estamos en modo edici?n o en el tab de crear
    if (modoEdicion || activeTab === 'crear') {
      return;
    }

    if (setObrasControls) {
      // Verificar si la obra seleccionada tiene presupuesto
      const obraSeleccionada = selectedObraId ? obras.find(o => o.id === selectedObraId) : null;
      const tienePresupuesto = obraSeleccionada && (
        (presupuestosObras[obraSeleccionada.id] && typeof presupuestosObras[obraSeleccionada.id] === 'object') ||
        (obraSeleccionada.presupuestoNoCliente && typeof obraSeleccionada.presupuestoNoCliente === 'object')
      );

      setObrasControls({
        selectedId: selectedObraId,
        handleNuevo: () => abrirModalTrabajoDiario(),
        handleBuscarPorCliente,
        handleCargarEstadisticas,
        handleVerEstadisticasObraSeleccionada,
        handleVerEstadisticasTodasObras,
        esObraManual: !tienePresupuesto, // Nuevo: indica si es obra independiente (sin presupuesto)
        handleEditar: async () => {
          if (selectedObraId) {
            // Verificar si es una tarea (ID comienza con "ta_")
            if (typeof selectedObraId === 'string' && selectedObraId.startsWith('ta_')) {
              // Extraer ID num?rico de la tarea
              const tareaId = parseInt(selectedObraId.replace('ta_', ''));

              // Buscar la tarea en trabajosAdicionales
              const tarea = trabajosAdicionales.find(ta => ta.id === tareaId);

              if (tarea) {
                console.log('?? Editando tarea leve:', tarea.nombre);

                // ? Determinar si es HIJA (tiene obraId) o NIETA (tiene trabajoExtraId)
                if (tarea.trabajoExtraId) {
                  // Es NIETA - hija de un trabajo extra
                  const trabajoExtra = trabajosExtras.find(te => te.id === tarea.trabajoExtraId);
                  const obraAbuelo = obras.find(o => o.id === tarea.obraId);

                  if (trabajoExtra && obraAbuelo) {
                    abrirModalTareaLeveNieta(obraAbuelo, trabajoExtra, tarea);
                  } else {
                    showNotification(' No se encontr? el contexto completo de esta tarea', 'warning');
                  }
                } else if (tarea.obraId) {
                  // Es HIJA - hija directa de obra
                  const obraPadre = obras.find(o => o.id === tarea.obraId);

                  if (obraPadre) {
                    // ? Abrir modal correcto con datos existentes
                    setObraParaTareaLeve(obraPadre);
                    setTareaLeveEditando(tarea);
                    setMostrarModalTareaLeve(true);
                  } else {
                    showNotification(' No se encontr? la obra padre de esta tarea', 'warning');
                  }
                }
              } else {
                showNotification('?? ? No se encontr? la tarea seleccionada', 'warning');
              }
              return;
            }
            const obra = obras.find(o => o.id === selectedObraId);
            if (obra) {
              // Verificar si tiene presupuesto
              const presupuesto = presupuestosObras[obra.id];
              const tienePresupuesto = presupuesto && typeof presupuesto === 'object';

              console.log('🔧 ========== EDITAR OBRA ==========');
              console.log('🔧 Obra seleccionada:', obra.nombre, ' (ID:', obra.id, ')');
              console.log('🔧 presupuestosObras[' + obra.id + ']:', presupuesto);
              console.log('🔧 tienePresupuesto:', tienePresupuesto);
              console.log('🔧 typeof presupuesto:', typeof presupuesto);
              if (presupuesto) {
                console.log('     +- Presupuesto ID:', presupuesto.id);
                console.log('     +- Nombre Obra:', presupuesto.nombreObra);
                console.log('     +- Tipo Presupuesto:', presupuesto.tipoPresupuesto);
                console.log('     +- Estado:', presupuesto.estado);
                console.log('     +- Versión:', presupuesto.numeroVersion);
                console.log('     +- obraId del presupuesto:', presupuesto.obraId);
              }
              console.log('🔧 =====================================');;

              if (tienePresupuesto) {
                // ?? OBRA CON PRESUPUESTO: Abrir modal de edici?n en la misma p?gina (sin navegar)
                console.log('?? Abriendo modal de edici?n para presupuesto ID:', presupuesto.id, 'de obra:', obra.nombre);
                // ? Siempre cargar datos frescos del backend (nunca usar cach? del listado)
                try {
                  const presupuestoCompleto = await api.presupuestosNoCliente.getById(presupuesto.id, empresaId);
                  const presupuestoConContexto = {
                    ...presupuestoCompleto,
                    obraId: presupuestoCompleto.obraId || presupuestoCompleto.idObra || obra.id || null,
                    clienteId: presupuestoCompleto.clienteId || presupuestoCompleto.idCliente || obra.clienteId || null
                  };
                  setPresupuestoParaEditar(presupuestoConContexto);
                  setMostrarModalEditarPresupuesto(true);
                } catch (error) {
                  console.error('? Error al cargar presupuesto completo:', error);
                  showNotification('Error al cargar el presupuesto: ' + (error.message || 'Error desconocido'), 'error');
                }
                return;
              }

              // Cargar datos de la obra en el formulario (para obras sin presupuesto / trabajos diarios)
              // Normalizar estado: mapear estados con tildes a estados v?lidos del backend
              const mapeoEstados = {
                'EN_PLANIFICACI�N': 'BORRADOR',
                'EN_PLANIFICACION': 'BORRADOR',
                'EN PLANIFICACI�N': 'BORRADOR',
                'EN_EJECUCI�N': 'EN_EJECUCION',
                'EN_EJECUCION': 'EN_EJECUCION'
              };

              const estadoOriginal = obra.estado || 'BORRADOR';
              const estadoNormalizado = mapeoEstados[estadoOriginal] || estadoOriginal;

              setFormData({
                nombre: obra.nombre || '',
                direccion: obra.direccion || '',
                estado: estadoNormalizado,
                fechaInicio: obra.fechaInicio || '',
                fechaFin: obra.fechaFin || '',
                presupuestoEstimado: obra.presupuestoEstimado || '',
                idCliente: obra.clienteId || obra.idCliente || '',
                empresaId: empresaId,
                // Campos de cliente (cargar datos actuales de la obra)
                nombreSolicitante: obra.nombreSolicitante || '',
                telefono: obra.telefono || '',
                direccionParticular: obra.direccionParticular || '',
                mail: obra.mail || '',
                // Campos de direcci?n de obra
                direccionObraCalle: obra.direccionObraCalle || '',
                direccionObraAltura: obra.direccionObraAltura || '',
                direccionObraBarrio: obra.direccionObraBarrio || '',
                direccionObraTorre: obra.direccionObraTorre || '',
                direccionObraPiso: obra.direccionObraPiso || '',
                direccionObraDepartamento: obra.direccionObraDepartamento || '',
                // Campos adicionales
                descripcion: obra.descripcion || '',
                observaciones: obra.observaciones || ''
              });

              // Restaurar desglose desde campos del DTO
              if (obra.presupuestoJornales || obra.presupuestoMateriales || obra.importeGastosGeneralesObra || obra.presupuestoMayoresCostos ||
                  obra.presupuestoHonorarios) {
                setUsarDesgloseObra(true);
                setImporteJornalesObra(obra.presupuestoJornales != null ? String(obra.presupuestoJornales) : '');
                setImporteMaterialesObra(obra.presupuestoMateriales != null ? String(obra.presupuestoMateriales) : '');
                setImporteGastosGeneralesObra(obra.importeGastosGeneralesObra != null ? String(obra.importeGastosGeneralesObra) : '');
                setImporteMayoresCostosObra(obra.presupuestoMayoresCostos != null ? String(obra.presupuestoMayoresCostos) : '');

                // Restaurar honorarios si existen
                if (obra.honorarioJornalesObra != null) {
                  setHonorarioJornalesObra(String(obra.honorarioJornalesObra));
                  setTipoHonorarioJornalesObra(obra.tipoHonorarioJornalesObra || 'porcentaje');
                }
                if (obra.honorarioMaterialesObra != null) {
                  setHonorarioMaterialesObra(String(obra.honorarioMaterialesObra));
                  setTipoHonorarioMaterialesObra(obra.tipoHonorarioMaterialesObra || 'porcentaje');
                }
                if (obra.honorarioGastosGeneralesObra != null) {
                  setHonorarioGastosGeneralesObra(String(obra.honorarioGastosGeneralesObra));
                  setTipoHonorarioGastosGeneralesObra(obra.tipoHonorarioGastosGeneralesObra || 'porcentaje');
                }
                if (obra.honorarioMayoresCostosObra != null) {
                  setHonorarioMayoresCostosObra(String(obra.honorarioMayoresCostosObra));
                  setTipoHonorarioMayoresCostosObra(obra.tipoHonorarioMayoresCostosObra || 'porcentaje');
                }

                // Restaurar descuentos base si existen
                if (obra.descuentoJornalesObra != null) {
                  setDescuentoJornalesObra(String(obra.descuentoJornalesObra));
                  setTipoDescuentoJornalesObra(obra.tipoDescuentoJornalesObra || 'porcentaje');
                }
                if (obra.descuentoMaterialesObra != null) {
                  setDescuentoMaterialesObra(String(obra.descuentoMaterialesObra));
                  setTipoDescuentoMaterialesObra(obra.tipoDescuentoMaterialesObra || 'porcentaje');
                }
                if (obra.descuentoGastosGeneralesObra != null) {
                  setDescuentoGastosGeneralesObra(String(obra.descuentoGastosGeneralesObra));
                  setTipoDescuentoGastosGeneralesObra(obra.tipoDescuentoGastosGeneralesObra || 'porcentaje');
                }
                if (obra.descuentoMayoresCostosObra != null) {
                  setDescuentoMayoresCostosObra(String(obra.descuentoMayoresCostosObra));
                  setTipoDescuentoMayoresCostosObra(obra.tipoDescuentoMayoresCostosObra || 'porcentaje');
                }

                // Restaurar descuentos sobre honorarios si existen
                if (obra.descuentoHonorarioJornalesObra != null) {
                  setDescuentoHonorarioJornalesObra(String(obra.descuentoHonorarioJornalesObra));
                  setTipoDescuentoHonorarioJornalesObra(obra.tipoDescuentoHonorarioJornalesObra || 'porcentaje');
                }
                if (obra.descuentoHonorarioMaterialesObra != null) {
                  setDescuentoHonorarioMaterialesObra(String(obra.descuentoHonorarioMaterialesObra));
                  setTipoDescuentoHonorarioMaterialesObra(obra.tipoDescuentoHonorarioMaterialesObra || 'porcentaje');
                }
                if (obra.descuentoHonorarioGastosGeneralesObra != null) {
                  setDescuentoHonorarioGastosGeneralesObra(String(obra.descuentoHonorarioGastosGeneralesObra));
                  setTipoDescuentoHonorarioGastosGeneralesObra(obra.tipoDescuentoHonorarioGastosGeneralesObra || 'porcentaje');
                }
                if (obra.descuentoHonorarioMayoresCostosObra != null) {
                  setDescuentoHonorarioMayoresCostosObra(String(obra.descuentoHonorarioMayoresCostosObra));
                  setTipoDescuentoHonorarioMayoresCostosObra(obra.tipoDescuentoHonorarioMayoresCostosObra || 'porcentaje');
                }

                console.log('?? Desglose obra restaurado desde DTO:', obra);
              } else {
                setUsarDesgloseObra(false);
                setImporteMaterialesObra('');
                setImporteJornalesObra('');
                setImporteHonorariosObra('');
                setTipoHonorariosObra('porcentaje');
                setImporteMayoresCostosObra('');
                setTipoMayoresCostosObra('porcentaje');
                setImporteTotalObra('');
              }

              // Activar modo edici?n
              setModoEdicion(true);
              setObraEditando(obra);

              // Cambiar a la pesta?a de crear/editar
              dispatch(setActiveTab('crear'));
            }
          } else {
            showNotification('Seleccione una obra para editar', 'warning');
          }
        },
        handleEliminar: () => {
          if (selectedObraId) {
            // Verificar si es una tarea (ID comienza con "ta_")
            if (typeof selectedObraId === 'string' && selectedObraId.startsWith('ta_')) {
              // Es una tarea leve - extraer ID num?rico
              const tareaIdNumerico = parseInt(selectedObraId.replace('ta_', ''));
              const tarea = trabajosAdicionales.find(ta => ta.id === tareaIdNumerico);

              if (tarea) {
                // Confirmar eliminaci?n de tarea
                const confirmar = window.confirm(`�Est? seguro de eliminar la tarea leve "${tarea.nombre}"?\n\nEsta acci?n NO se puede deshacer.`);
                if (confirmar) {
                  handleEliminarTrabajoAdicional(tareaIdNumerico, tarea.nombre);
                }
              } else {
                showNotification(' No se encontr? la tarea seleccionada', 'warning');
              }
              return;
            }

            // Es una obra normal
            handleEliminarObra(selectedObraId);
          } else {
            showNotification('Seleccione una obra para eliminar', 'warning');
          }
        },
        handleVerProfesionales: () => {
          // Si hay una obra seleccionada, mostrar solo esa obra
          if (selectedObraId) {
            // Verificar si es una tarea (ID comienza con "ta_")
            if (typeof selectedObraId === 'string' && selectedObraId.startsWith('ta_')) {
              // Es una tarea leve - extraer ID num?rico y buscar en trabajosAdicionales
              const tareaIdNumerico = parseInt(selectedObraId.replace('ta_', ''));
              const tarea = trabajosAdicionales.find(ta => ta.id === tareaIdNumerico);

              if (tarea) {
                // Crear objeto compatible con el modal usando el ID num?rico
                const tareaComoObra = {
                  ...tarea,
                  id: tareaIdNumerico, // ID num?rico para las peticiones al API
                  nombre: tarea.nombre,
                  direccion: tarea.nombre, // Usar nombre como direcci?n para el modal
                  esTareaLeve: true
                };
                setObraParaVerAsignaciones(tareaComoObra);
                setMostrarModalVerAsignaciones(true);
              } else {
                showNotification(' No se encontr? la tarea seleccionada', 'warning');
              }
            } else {
              // Es una obra normal
              const obra = obras.find(o => o.id === selectedObraId);
              if (obra) {
                setObraParaVerAsignaciones(obra);
                setMostrarModalVerAsignaciones(true);
              }
            }
          } else {
            // Si no hay obra seleccionada, mostrar todas las obras
            // Usar la primera obra como referencia o null para modo "todas las obras"
            setObraParaVerAsignaciones(null); // null indica "todas las obras"
            setMostrarModalVerAsignaciones(true);
          }
        },
        handleCambiarEstado: () => {
          if (selectedObraId) {
            // Verificar si es una tarea (no se puede cambiar estado de tareas leves)
            if (typeof selectedObraId === 'string' && selectedObraId.startsWith('ta_')) {
              showNotification(' No se puede cambiar el estado de tareas leves. Las tareas se gestionan desde su obra principal.', 'warning');
              return;
            }

            const obra = obras.find(o => o.id === selectedObraId);
            if (obra) {
              setNuevoEstadoSeleccionado(obra.estado || 'APROBADO');
              setMostrarModalCambiarEstado(true);
            }
          } else {
            showNotification('Seleccione una obra para cambiar estado', 'warning');
          }
        },
        handleTrabajosExtra: () => {
          if (selectedObraId) {
            // Verificar si es una tarea (las tareas no tienen sub-trabajos)
            if (typeof selectedObraId === 'string' && selectedObraId.startsWith('ta_')) {
              showNotification(' Las tareas leves no pueden tener trabajos adicionales. Son ellas mismas trabajos adicionales.', 'warning');
              return;
            }

            const obra = obras.find(o => o.id === selectedObraId);
            if (obra) {
              setObraParaTrabajosExtra(obra);
              cargarTrabajosExtra(obra);
              dispatch(setActiveTab('trabajos-extra'));
            }
          } else {
            showNotification('Seleccione una obra para gestionar trabajos extra', 'warning');
          }
        },
        handleEtapasDiarias: () => {
          if (selectedObraId) {
            // Verificar si es una tarea (las tareas no tienen etapas diarias complejas)
            if (typeof selectedObraId === 'string' && selectedObraId.startsWith('ta_')) {
              showNotification(' Las tareas leves no tienen cronograma de etapas diarias. Son trabajos puntuales.', 'warning');
              return;
            }

            const obra = obras.find(o => o.id === selectedObraId);
            if (obra) {
              cargarEtapasDiarias(obra);
              dispatch(setActiveTab('etapas-diarias'));
            }
          } else {
            showNotification('Seleccione una obra para ver el cronograma', 'warning');
          }
        },
        handleEnviarObra: async () => {
          if (selectedObraId) {
            // Verificar si es una tarea (ID comienza con "ta_")
            if (typeof selectedObraId === 'string' && selectedObraId.startsWith('ta_')) {
              // Extraer ID num?rico de la tarea
              const tareaId = parseInt(selectedObraId.replace('ta_', ''));

              // Buscar la tarea en trabajosAdicionales
              const tarea = trabajosAdicionales.find(ta => ta.id === tareaId);

              if (tarea) {
                // Generar PDF directamente de la tarea
                console.log('?? Generando PDF de tarea leve:', tarea.nombre);

                // Importar din?micamente las librer?as
                const html2canvas = (await import('html2canvas')).default;
                const jsPDF = (await import('jspdf')).default;

                try {
                  // Buscar la obra padre para obtener datos del cliente
                  const obraPadre = obras.find(o => o.id === tarea.obraId);

                  // Obtener profesionales asignados
                  const profesionalesTexto = tarea.profesionales && tarea.profesionales.length > 0
                    ? tarea.profesionales.map(p => `${p.nombre} (${p.tipoProfesional || 'N/A'})`).join('<br>')
                    : 'Sin profesionales asignados';

                  // Crear contenedor temporal para el PDF
                  const tempContainer = document.createElement('div');
                  tempContainer.style.position = 'absolute';
                  tempContainer.style.left = '-9999px';
                  tempContainer.style.width = '800px';
                  tempContainer.style.padding = '40px';
                  tempContainer.style.backgroundColor = 'white';
                  tempContainer.style.fontFamily = 'Arial, sans-serif';

                  tempContainer.innerHTML = `
                    <div style="max-width: 800px; margin: 0 auto;">
                      <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #8B5CF6; padding-bottom: 20px;">
                        <h1 style="color: #8B5CF6; margin: 0; font-size: 28px;">Presupuesto - Tarea Leve</h1>
                        <p style="color: #666; margin: 10px 0 0 0; font-size: 14px;">${tarea.nombre}</p>
                      </div>

                      <div style="margin-bottom: 25px;">
                        <h3 style="color: #333; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 8px;">
                          ?? Informaci?n General
                        </h3>
                        <table style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="padding: 8px; font-weight: bold; color: #555; width: 200px;">Obra Vinculada:</td>
                            <td style="padding: 8px; color: #333;">${obraPadre?.nombre || 'Sin especificar'}</td>
                          </tr>
                          <tr style="background-color: #f9f9f9;">
                            <td style="padding: 8px; font-weight: bold; color: #555;">Cliente:</td>
                            <td style="padding: 8px; color: #333;">${obraPadre?.clienteNombre || 'N/A'}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px; font-weight: bold; color: #555;">Fecha Inicio:</td>
                            <td style="padding: 8px; color: #333;">${tarea.fechaInicio || 'N/A'}</td>
                          </tr>
                          <tr style="background-color: #f9f9f9;">
                            <td style="padding: 8px; font-weight: bold; color: #555;">D?as Necesarios:</td>
                            <td style="padding: 8px; color: #333;">${tarea.diasNecesarios || 'N/A'} d?as</td>
                          </tr>
                        </table>
                      </div>

                      <div style="margin-bottom: 25px;">
                        <div style="background-color: #8B5CF6; padding: 30px; border-radius: 8px; text-align: center; color: white;">
                          <p style="margin: 0; font-size: 18px; opacity: 0.9;">PRESUPUESTO TOTAL</p>
                          <p style="margin: 15px 0 0 0; font-size: 42px; font-weight: bold;">
                            $${(tarea.importe || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>

                      <div style="margin-bottom: 25px;">
                        <h3 style="color: #333; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 8px;">
                          ?? Profesionales Asignados
                        </h3>
                        <div style="padding: 12px; background-color: #fce7f3; border-radius: 4px; border-left: 4px solid #ec4899;">
                          <p style="color: #555; line-height: 1.8; margin: 0;">${profesionalesTexto}</p>
                        </div>
                      </div>

                      ${tarea.descripcion ? `
                        <div style="margin-bottom: 25px;">
                          <h3 style="color: #333; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 8px;">
                            ?? Descripci?n
                          </h3>
                          <p style="color: #555; line-height: 1.6; margin: 0; padding: 12px; background-color: #f9f9f9; border-radius: 4px;">
                            ${tarea.descripcion}
                          </p>
                        </div>
                      ` : ''}

                      ${tarea.observaciones ? `
                        <div style="margin-bottom: 25px;">
                          <h3 style="color: #333; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 8px;">
                            ?? Observaciones
                          </h3>
                          <p style="color: #555; line-height: 1.6; margin: 0; padding: 12px; background-color: #fff9e6; border-left: 4px solid #ffa726; border-radius: 4px;">
                            ${tarea.observaciones}
                          </p>
                        </div>
                      ` : ''}

                      <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #eee; text-align: center; color: #999; font-size: 12px;">
                        <p style="margin: 0;">Documento generado el ${new Date().toLocaleDateString('es-AR')}</p>
                        <p style="margin: 5px 0 0 0;">Este presupuesto es v?lido por 30 d?as</p>
                      </div>
                    </div>
                  `;

                  document.body.appendChild(tempContainer);

                  // Generar PDF
                  const canvas = await html2canvas(tempContainer, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff'
                  });

                  document.body.removeChild(tempContainer);

                  const imgData = canvas.toDataURL('image/png');
                  const pdf = new jsPDF('p', 'mm', 'a4');
                  const pdfWidth = pdf.internal.pageSize.getWidth();
                  const pdfHeight = pdf.internal.pageSize.getHeight();
                  const imgWidth = pdfWidth - 20;
                  const imgHeight = (canvas.height * imgWidth) / canvas.width;

                  let heightLeft = imgHeight;
                  let position = 10;

                  pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
                  heightLeft -= pdfHeight;

                  while (heightLeft >= 0) {
                    position = heightLeft - imgHeight + 10;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
                    heightLeft -= pdfHeight;
                  }

                  const nombreArchivo = `Presupuesto_${tarea.nombre?.replace(/\s/g, '_') || `Tarea_${tarea.id}`}_${new Date().getTime()}.pdf`;
                  pdf.save(nombreArchivo);

                  showNotification('? PDF generado y descargado exitosamente', 'success');

                  // Preguntar si desea enviar por WhatsApp
                  if (confirm('�Desea enviar este presupuesto por WhatsApp?')) {
                    const mensaje = `
*PRESUPUESTO - TAREA LEVE*

?? *${tarea.nombre}*
${obraPadre ? `??? Obra: ${obraPadre.nombre}` : ''}

?? Inicio: ${tarea.fechaInicio || 'A definir'}
?? Duraci?n: ${tarea.diasNecesarios || 'N/A'} d?as

?? *TOTAL: $${(tarea.importe || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}*

_PDF descargado - Adj?ntalo al mensaje_
_V?lido por 30 d?as_
                    `.trim();

                    const telefono = obraPadre?.clienteTelefono?.replace(/\D/g, '') || '';
                    const url = telefono
                      ? `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`
                      : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;

                    window.open(url, '_blank');
                  }

                } catch (error) {
                  console.error('? Error generando PDF:', error);
                  showNotification('? Error al generar PDF: ' + error.message, 'error');
                }

                return;
              } else {
                showNotification(' No se encontr? la tarea seleccionada', 'warning');
                return;
              }
            }

            const obra = obras.find(o => o.id === selectedObraId);
            if (obra) {
              // Verificar si tiene presupuesto
              const presupuesto = presupuestosObras[obra.id];
              const tienePresupuesto = presupuesto && typeof presupuesto === 'object';

              if (tienePresupuesto) {
                // ?? OBRA CON PRESUPUESTO: Abrir modal en la misma p?gina (sin navegar)
                console.log('?? Abriendo modal de env?o para presupuesto ID:', presupuesto.id, 'de obra:', obra.nombre);
                setPresupuestoParaEnviar(presupuesto);
                setMostrarModalEnviarPresupuesto(true);
              } else {
                // ?? OBRA SIN PRESUPUESTO: Generar PDF directamente (Trabajo Diario)
                console.log('?? Generando PDF de Trabajo Diario:', obra.nombre);

                // Importar din?micamente las librer?as
                const html2canvas = (await import('html2canvas')).default;
                const jsPDF = (await import('jspdf')).default;

                try {
                  // Formatear direcci?n completa
                  const direccionCompleta = [
                    obra.direccionObraCalle || obra.direccionObra || obra.direccion,
                    obra.direccionObraAltura ? `N� ${obra.direccionObraAltura}` : '',
                    obra.direccionObraTorre ? `Torre ${obra.direccionObraTorre}` : '',
                    obra.direccionObraPiso ? `Piso ${obra.direccionObraPiso}` : '',
                    obra.direccionObraDepartamento ? `Depto ${obra.direccionObraDepartamento}` : ''
                  ].filter(Boolean).join(', ') + (obra.direccionObraBarrio ? `<br><small>${obra.direccionObraBarrio}</small>` : '');

                  // Crear contenedor temporal para el PDF
                  const tempContainer = document.createElement('div');
                  tempContainer.style.position = 'absolute';
                  tempContainer.style.left = '-9999px';
                  tempContainer.style.width = '800px';
                  tempContainer.style.padding = '40px';
                  tempContainer.style.backgroundColor = 'white';
                  tempContainer.style.fontFamily = 'Arial, sans-serif';

                  tempContainer.innerHTML = `
                    <div style="max-width: 800px; margin: 0 auto;">
                      <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #ffc107; padding-bottom: 20px;">
                        <h1 style="color: #ffc107; margin: 0; font-size: 28px;">Presupuesto - Trabajo Diario</h1>
                        <p style="color: #666; margin: 10px 0 0 0; font-size: 14px;">${obra.nombre}</p>
                      </div>

                      <div style="margin-bottom: 25px;">
                        <h3 style="color: #333; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 8px;">
                          ?? Informaci?n General
                        </h3>
                        <table style="width: 100%; border-collapse: collapse;">
                          ${obra.nombreSolicitante || obra.clienteNombre ? `
                          <tr>
                            <td style="padding: 8px; font-weight: bold; color: #555; width: 200px;">Cliente:</td>
                            <td style="padding: 8px; color: #333;">${obra.nombreSolicitante || obra.clienteNombre || 'N/A'}</td>
                          </tr>
                          ` : ''}
                          ${direccionCompleta && direccionCompleta !== 'undefined' ? `
                          <tr style="background-color: #f9f9f9;">
                            <td style="padding: 8px; font-weight: bold; color: #555;">Direcci?n:</td>
                            <td style="padding: 8px; color: #333;">${direccionCompleta}</td>
                          </tr>
                          ` : ''}
                          ${obra.telefono || obra.clienteTelefono ? `
                          <tr>
                            <td style="padding: 8px; font-weight: bold; color: #555;">Tel?fono:</td>
                            <td style="padding: 8px; color: #333;">${obra.telefono || obra.clienteTelefono}</td>
                          </tr>
                          ` : ''}
                          ${obra.mail || obra.clienteMail ? `
                          <tr style="background-color: #f9f9f9;">
                            <td style="padding: 8px; font-weight: bold; color: #555;">Email:</td>
                            <td style="padding: 8px; color: #333;">${obra.mail || obra.clienteMail}</td>
                          </tr>
                          ` : ''}
                          ${obra.fechaInicio ? `
                          <tr>
                            <td style="padding: 8px; font-weight: bold; color: #555;">Fecha Inicio:</td>
                            <td style="padding: 8px; color: #333;">${obra.fechaInicio}</td>
                          </tr>
                          ` : ''}
                          ${obra.dias || obra.duracionDias ? `
                          <tr style="background-color: #f9f9f9;">
                            <td style="padding: 8px; font-weight: bold; color: #555;">Duraci?n:</td>
                            <td style="padding: 8px; color: #333;">${obra.dias || obra.duracionDias} d?as</td>
                          </tr>
                          ` : ''}
                        </table>
                      </div>

                      <div style="margin-bottom: 25px;">
                        <div style="background-color: #ffc107; padding: 30px; border-radius: 8px; text-align: center; color: #333;">
                          <p style="margin: 0; font-size: 18px; opacity: 0.9; font-weight: 600;">PRESUPUESTO TOTAL</p>
                          <p style="margin: 15px 0 0 0; font-size: 42px; font-weight: bold;">
                            $${(obra.presupuestoEstimado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>

                      ${obra.descripcion ? `
                        <div style="margin-bottom: 25px;">
                          <h3 style="color: #333; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 8px;">
                            ?? Descripci?n
                          </h3>
                          <p style="color: #555; line-height: 1.6; margin: 0; padding: 12px; background-color: #f9f9f9; border-radius: 4px;">
                            ${obra.descripcion}
                          </p>
                        </div>
                      ` : ''}

                      ${obra.observaciones ? `
                        <div style="margin-bottom: 25px;">
                          <h3 style="color: #333; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 8px;">
                            ?? Observaciones
                          </h3>
                          <p style="color: #555; line-height: 1.6; margin: 0; padding: 12px; background-color: #fff9e6; border-left: 4px solid #ffa726; border-radius: 4px;">
                            ${obra.observaciones}
                          </p>
                        </div>
                      ` : ''}

                      <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #eee; text-align: center; color: #999; font-size: 12px;">
                        <p style="margin: 0;">Documento generado el ${new Date().toLocaleDateString('es-AR')}</p>
                        <p style="margin: 5px 0 0 0;">Este presupuesto es v?lido por 30 d?as</p>
                      </div>
                    </div>
                  `;

                  document.body.appendChild(tempContainer);

                  // Generar PDF
                  const canvas = await html2canvas(tempContainer, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff'
                  });

                  document.body.removeChild(tempContainer);

                  const imgData = canvas.toDataURL('image/png');
                  const pdf = new jsPDF('p', 'mm', 'a4');
                  const pdfWidth = pdf.internal.pageSize.getWidth();
                  const pdfHeight = pdf.internal.pageSize.getHeight();
                  const imgWidth = pdfWidth - 20;
                  const imgHeight = (canvas.height * imgWidth) / canvas.width;

                  let heightLeft = imgHeight;
                  let position = 10;

                  pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
                  heightLeft -= pdfHeight;

                  while (heightLeft >= 0) {
                    position = heightLeft - imgHeight + 10;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
                    heightLeft -= pdfHeight;
                  }

                  const nombreArchivo = `Presupuesto_${obra.nombre?.replace(/\s/g, '_') || `Obra_${obra.id}`}_${new Date().getTime()}.pdf`;
                  pdf.save(nombreArchivo);

                  showNotification('? PDF generado y descargado exitosamente', 'success');

                  // Preguntar si desea enviar por WhatsApp
                  if (confirm('�Desea enviar este presupuesto por WhatsApp?')) {
                    const mensaje = `
*PRESUPUESTO - TRABAJO DIARIO*

?? *${obra.nombre}*
${obra.direccionObra || obra.direccion ? `?? ${obra.direccionObra || obra.direccion}` : ''}

${obra.fechaInicio ? `?? Inicio: ${obra.fechaInicio}` : ''}
${obra.dias || obra.duracionDias ? `?? Duraci?n: ${obra.dias || obra.duracionDias} d?as` : ''}

?? *TOTAL: $${(obra.presupuestoEstimado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}*

_PDF descargado - Adj?ntalo al mensaje_
_V?lido por 30 d?as_
                    `.trim();

                    const telefono = (obra.telefono || obra.clienteTelefono || '')?.toString().replace(/\D/g, '');
                    const url = telefono
                      ? `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`
                      : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;

                    window.open(url, '_blank');
                  }

                } catch (error) {
                  console.error('? Error generando PDF:', error);
                  showNotification('? Error al generar PDF: ' + error.message, 'error');
                }
              }
            } else {
              console.error('? No se encontr? la obra con ID:', selectedObraId);
              showNotification(' No se encontr? la obra seleccionada', 'warning');
            }
          } else {
            showNotification('Seleccione una obra para enviar', 'warning');
          }
        },
        // C�DIGO ANTIGUO COMENTADO - ELIMINADO TODO EL C�DIGO DE GENERACI�N DE PDF
        handleEnviarObraOLD_BACKUP: async () => {
          if (selectedObraId) {
            // Verificar si es una tarea (ID comienza con "ta_")
            if (typeof selectedObraId === 'string' && selectedObraId.startsWith('ta_')) {
              // Extraer ID num?rico de la tarea
              const tareaId = parseInt(selectedObraId.replace('ta_', ''));

              // Buscar la tarea en trabajosAdicionales
              const tarea = trabajosAdicionales.find(ta => ta.id === tareaId);

              if (tarea) {
                // Generar PDF directamente de la tarea
                console.log('?? Generando PDF de tarea leve:', tarea.nombre);

                // Importar din?micamente las librer?as
                const html2canvas = (await import('html2canvas')).default;
                const jsPDF = (await import('jspdf')).default;

                try {
                  // Buscar la obra padre para obtener datos del cliente
                  const obraPadre = obras.find(o => o.id === tarea.obraId);

                  // Obtener profesionales asignados
                  const profesionalesTexto = tarea.profesionales && tarea.profesionales.length > 0
                    ? tarea.profesionales.map(p => `${p.nombre} (${p.tipoProfesional || 'N/A'})`).join('<br>')
                    : 'Sin profesionales asignados';

                  // Crear contenedor temporal para el PDF
                  const tempContainer = document.createElement('div');
                  tempContainer.style.position = 'absolute';
                  tempContainer.style.left = '-9999px';
                  tempContainer.style.width = '800px';
                  tempContainer.style.padding = '40px';
                  tempContainer.style.backgroundColor = 'white';
                  tempContainer.style.fontFamily = 'Arial, sans-serif';

                  tempContainer.innerHTML = `
                    <div style="max-width: 800px; margin: 0 auto;">
                      <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #8B5CF6; padding-bottom: 20px;">
                        <h1 style="color: #8B5CF6; margin: 0; font-size: 28px;">Presupuesto - Tarea Leve</h1>
                        <p style="color: #666; margin: 10px 0 0 0; font-size: 14px;">${tarea.nombre}</p>
                      </div>

                      <div style="margin-bottom: 25px;">
                        <h3 style="color: #333; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 8px;">
                          ?? Informaci?n General
                        </h3>
                        <table style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="padding: 8px; font-weight: bold; color: #555; width: 200px;">Obra Vinculada:</td>
                            <td style="padding: 8px; color: #333;">${obraPadre?.nombre || 'Sin especificar'}</td>
                          </tr>
                          <tr style="background-color: #f9f9f9;">
                            <td style="padding: 8px; font-weight: bold; color: #555;">Cliente:</td>
                            <td style="padding: 8px; color: #333;">${obraPadre?.clienteNombre || 'N/A'}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px; font-weight: bold; color: #555;">Fecha Inicio:</td>
                            <td style="padding: 8px; color: #333;">${tarea.fechaInicio || 'N/A'}</td>
                          </tr>
                          <tr style="background-color: #f9f9f9;">
                            <td style="padding: 8px; font-weight: bold; color: #555;">D?as Necesarios:</td>
                            <td style="padding: 8px; color: #333;">${tarea.diasNecesarios || 'N/A'} d?as</td>
                          </tr>
                        </table>
                      </div>

                      <div style="margin-bottom: 25px;">
                        <div style="background-color: #8B5CF6; padding: 30px; border-radius: 8px; text-align: center; color: white;">
                          <p style="margin: 0; font-size: 18px; opacity: 0.9;">PRESUPUESTO TOTAL</p>
                          <p style="margin: 15px 0 0 0; font-size: 42px; font-weight: bold;">
                            $${(tarea.importe || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>

                      <div style="margin-bottom: 25px;">
                        <h3 style="color: #333; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 8px;">
                          ?? Profesionales Asignados
                        </h3>
                        <div style="padding: 12px; background-color: #fce7f3; border-radius: 4px; border-left: 4px solid #ec4899;">
                          <p style="color: #555; line-height: 1.8; margin: 0;">${profesionalesTexto}</p>
                        </div>
                      </div>

                      ${tarea.descripcion ? `
                        <div style="margin-bottom: 25px;">
                          <h3 style="color: #333; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 8px;">
                            ?? Descripci?n
                          </h3>
                          <p style="color: #555; line-height: 1.6; margin: 0; padding: 12px; background-color: #f9f9f9; border-radius: 4px;">
                            ${tarea.descripcion}
                          </p>
                        </div>
                      ` : ''}

                      ${tarea.observaciones ? `
                        <div style="margin-bottom: 25px;">
                          <h3 style="color: #333; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 8px;">
                            ?? Observaciones
                          </h3>
                          <p style="color: #555; line-height: 1.6; margin: 0; padding: 12px; background-color: #fff9e6; border-left: 4px solid #ffa726; border-radius: 4px;">
                            ${tarea.observaciones}
                          </p>
                        </div>
                      ` : ''}

                      <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #eee; text-align: center; color: #999; font-size: 12px;">
                        <p style="margin: 0;">Documento generado el ${new Date().toLocaleDateString('es-AR')}</p>
                        <p style="margin: 5px 0 0 0;">Este presupuesto es v?lido por 30 d?as</p>
                      </div>
                    </div>
                  `;

                  document.body.appendChild(tempContainer);

                  // Generar PDF
                  const canvas = await html2canvas(tempContainer, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff'
                  });

                  document.body.removeChild(tempContainer);

                  const imgData = canvas.toDataURL('image/png');
                  const pdf = new jsPDF('p', 'mm', 'a4');
                  const pdfWidth = pdf.internal.pageSize.getWidth();
                  const pdfHeight = pdf.internal.pageSize.getHeight();
                  const imgWidth = pdfWidth - 20;
                  const imgHeight = (canvas.height * imgWidth) / canvas.width;

                  let heightLeft = imgHeight;
                  let position = 10;

                  pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
                  heightLeft -= pdfHeight;

                  while (heightLeft >= 0) {
                    position = heightLeft - imgHeight + 10;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
                    heightLeft -= pdfHeight;
                  }

                  const nombreArchivo = `Presupuesto_${tarea.nombre?.replace(/\s/g, '_') || `Tarea_${tarea.id}`}_${new Date().getTime()}.pdf`;
                  pdf.save(nombreArchivo);

                  showNotification('? PDF generado y descargado exitosamente', 'success');

                  // Preguntar si desea enviar por WhatsApp
                  if (confirm('�Desea enviar este presupuesto por WhatsApp?')) {
                    const mensaje = `
*PRESUPUESTO - TAREA LEVE*

?? *${tarea.nombre}*
${obraPadre ? `??? Obra: ${obraPadre.nombre}` : ''}

?? Inicio: ${tarea.fechaInicio || 'A definir'}
?? Duraci?n: ${tarea.diasNecesarios || 'N/A'} d?as

?? *TOTAL: $${(tarea.importe || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}*

_PDF descargado - Adj?ntalo al mensaje_
_V?lido por 30 d?as_
                    `.trim();

                    const telefono = obraPadre?.clienteTelefono?.replace(/\D/g, '') || '';
                    const url = telefono
                      ? `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`
                      : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;

                    window.open(url, '_blank');
                  }

                } catch (error) {
                  console.error('? Error generando PDF:', error);
                  showNotification('? Error al generar PDF: ' + error.message, 'error');
                }

                return;
              } else {
                showNotification(' No se encontr? la tarea seleccionada', 'warning');
                return;
              }
            }

            const obra = obras.find(o => o.id === selectedObraId);
            console.log('?? Buscando obra con ID:', selectedObraId, '| Encontrada:', !!obra);

            if (obra) {
              // Verificar si tiene presupuesto (en presupuestosObras o presupuestoNoCliente)
              const presupuesto = presupuestosObras[obra.id];
              const presupuestoNoCliente = obra.presupuestoNoCliente;

              console.log('?? ========== ENVIAR OBRA ==========');
              console.log('?? Obra:', obra.nombre, 'ID:', obra.id);
              console.log('?? Presupuesto en diccionario:', presupuesto ? 'SI (ID: ' + presupuesto.id + ')' : 'NO');
              console.log('?? presupuestoNoCliente en obra:', presupuestoNoCliente ? 'SI (ID: ' + presupuestoNoCliente.id + ')' : 'NO');
              console.log('?? =====================================');

              // Si tiene presupuesto en presupuestosObras
              if (presupuesto && typeof presupuesto === 'object') {
                console.log('? RUTA 1: Usando presupuesto del diccionario - ID:', presupuesto.id, 'Nombre:', presupuesto.nombreObra);
                setPresupuestoParaEnviar(presupuesto);
                setMostrarModalEnviarPresupuesto(true);
              }
              // Si tiene presupuestoNoCliente vinculado (Obras Principales / Adicionales)
              else if (presupuestoNoCliente && typeof presupuestoNoCliente === 'object') {
                console.log('? RUTA 2: Usando presupuestoNoCliente de la obra - ID:', presupuestoNoCliente.id);
                console.log('   - itemsCalculadora:', presupuestoNoCliente.itemsCalculadora?.length || 0, 'items');

                // Verificar si ya tiene todos los datos necesarios
                if (presupuestoNoCliente.itemsCalculadora && Array.isArray(presupuestoNoCliente.itemsCalculadora) && presupuestoNoCliente.itemsCalculadora.length > 0) {
                  console.log('? presupuestoNoCliente ya tiene itemsCalculadora completo, usando directamente');
                  setPresupuestoParaEnviar(presupuestoNoCliente);
                  setMostrarModalEnviarPresupuesto(true);
                } else if (presupuestoNoCliente.id) {
                  // Cargar el presupuesto completo desde el backend
                  console.log('?? itemsCalculadora vac?o o inexistente, cargando desde backend...');
                  try {
                    const response = await api.presupuestosNoCliente.getById(presupuestoNoCliente.id, empresaId);
                    const presupuestoCompleto = response.data;
                    console.log('? presupuestoNoCliente completo cargado del backend:');
                    console.log('   - Presupuesto ID:', presupuestoCompleto.id);
                    console.log('   - Versi?n:', presupuestoCompleto.numeroVersion);
                    console.log('   - Nombre Obra:', presupuestoCompleto.nombreObraManual);
                    console.log('   - Total General:', presupuestoCompleto.totalGeneral);
                    console.log('   - itemsCalculadora:', presupuestoCompleto.itemsCalculadora?.length || 0, 'items');
                    console.log('   - Datos completos:', presupuestoCompleto);
                    setPresupuestoParaEnviar(presupuestoCompleto);
                    setMostrarModalEnviarPresupuesto(true);
                  } catch (error) {
                    console.error('? Error cargando presupuestoNoCliente completo:', error);
                    showNotification('? Error al cargar el presupuesto: ' + (error.response?.data?.message || error.message), 'error');
                  }
                } else {
                  console.log(' presupuestoNoCliente sin ID, usando datos disponibles');
                  setPresupuestoParaEnviar(presupuestoNoCliente);
                  setMostrarModalEnviarPresupuesto(true);
                }
              } else {
                // Trabajo Diario (obra sin presupuesto) - generar PDF directamente
                console.log('?? Generando PDF de Trabajo Diario:', obra.nombre);

                // Importar din?micamente las librer?as
                const html2canvas = (await import('html2canvas')).default;
                const jsPDF = (await import('jspdf')).default;

                try {
                  // Formatear direcci?n completa
                  const direccionCompleta = [
                    obra.direccionObraCalle || obra.direccionObra || obra.direccion,
                    obra.direccionObraAltura ? `N� ${obra.direccionObraAltura}` : '',
                    obra.direccionObraTorre ? `Torre ${obra.direccionObraTorre}` : '',
                    obra.direccionObraPiso ? `Piso ${obra.direccionObraPiso}` : '',
                    obra.direccionObraDepartamento ? `Depto ${obra.direccionObraDepartamento}` : ''
                  ].filter(Boolean).join(', ') + (obra.direccionObraBarrio ? `<br><small>${obra.direccionObraBarrio}</small>` : '');

                  // Crear contenedor temporal para el PDF
                  const tempContainer = document.createElement('div');
                  tempContainer.style.position = 'absolute';
                  tempContainer.style.left = '-9999px';
                  tempContainer.style.width = '800px';
                  tempContainer.style.padding = '40px';
                  tempContainer.style.backgroundColor = 'white';
                  tempContainer.style.fontFamily = 'Arial, sans-serif';

                  tempContainer.innerHTML = `
                    <div style="max-width: 800px; margin: 0 auto;">
                      <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #ffc107; padding-bottom: 20px;">
                        <h1 style="color: #ffc107; margin: 0; font-size: 28px;">Presupuesto - Trabajo Diario</h1>
                        <p style="color: #666; margin: 10px 0 0 0; font-size: 14px;">${obra.nombre}</p>
                      </div>

                      <div style="margin-bottom: 25px;">
                        <h3 style="color: #333; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 8px;">
                          ?? Informaci?n General
                        </h3>
                        <table style="width: 100%; border-collapse: collapse;">
                          ${obra.nombreSolicitante || obra.clienteNombre ? `
                          <tr>
                            <td style="padding: 8px; font-weight: bold; color: #555; width: 200px;">Cliente:</td>
                            <td style="padding: 8px; color: #333;">${obra.nombreSolicitante || obra.clienteNombre || 'N/A'}</td>
                          </tr>
                          ` : ''}
                          ${direccionCompleta && direccionCompleta !== 'undefined' ? `
                          <tr style="background-color: #f9f9f9;">
                            <td style="padding: 8px; font-weight: bold; color: #555;">Direcci?n:</td>
                            <td style="padding: 8px; color: #333;">${direccionCompleta}</td>
                          </tr>
                          ` : ''}
                          ${obra.telefono || obra.clienteTelefono ? `
                          <tr>
                            <td style="padding: 8px; font-weight: bold; color: #555;">Tel?fono:</td>
                            <td style="padding: 8px; color: #333;">${obra.telefono || obra.clienteTelefono}</td>
                          </tr>
                          ` : ''}
                          ${obra.mail || obra.clienteMail ? `
                          <tr style="background-color: #f9f9f9;">
                            <td style="padding: 8px; font-weight: bold; color: #555;">Email:</td>
                            <td style="padding: 8px; color: #333;">${obra.mail || obra.clienteMail}</td>
                          </tr>
                          ` : ''}
                          ${obra.fechaInicio ? `
                          <tr>
                            <td style="padding: 8px; font-weight: bold; color: #555;">Fecha Inicio:</td>
                            <td style="padding: 8px; color: #333;">${obra.fechaInicio}</td>
                          </tr>
                          ` : ''}
                          ${obra.dias || obra.duracionDias ? `
                          <tr style="background-color: #f9f9f9;">
                            <td style="padding: 8px; font-weight: bold; color: #555;">Duraci?n:</td>
                            <td style="padding: 8px; color: #333;">${obra.dias || obra.duracionDias} d?as</td>
                          </tr>
                          ` : ''}
                        </table>
                      </div>

                      <div style="margin-bottom: 25px;">
                        <div style="background-color: #ffc107; padding: 30px; border-radius: 8px; text-align: center; color: #333;">
                          <p style="margin: 0; font-size: 18px; opacity: 0.9; font-weight: 600;">PRESUPUESTO TOTAL</p>
                          <p style="margin: 15px 0 0 0; font-size: 42px; font-weight: bold;">
                            $${(obra.presupuestoEstimado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>

                      ${obra.descripcion ? `
                        <div style="margin-bottom: 25px;">
                          <h3 style="color: #333; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 8px;">
                            ?? Descripci?n
                          </h3>
                          <p style="color: #555; line-height: 1.6; margin: 0; padding: 12px; background-color: #f9f9f9; border-radius: 4px;">
                            ${obra.descripcion}
                          </p>
                        </div>
                      ` : ''}

                      ${obra.observaciones ? `
                        <div style="margin-bottom: 25px;">
                          <h3 style="color: #333; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 8px;">
                            ?? Observaciones
                          </h3>
                          <p style="color: #555; line-height: 1.6; margin: 0; padding: 12px; background-color: #fff9e6; border-left: 4px solid #ffa726; border-radius: 4px;">
                            ${obra.observaciones}
                          </p>
                        </div>
                      ` : ''}

                      <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #eee; text-align: center; color: #999; font-size: 12px;">
                        <p style="margin: 0;">Documento generado el ${new Date().toLocaleDateString('es-AR')}</p>
                        <p style="margin: 5px 0 0 0;">Este presupuesto es v?lido por 30 d?as</p>
                      </div>
                    </div>
                  `;

                  document.body.appendChild(tempContainer);

                  // Generar PDF
                  const canvas = await html2canvas(tempContainer, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff'
                  });

                  document.body.removeChild(tempContainer);

                  const imgData = canvas.toDataURL('image/png');
                  const pdf = new jsPDF('p', 'mm', 'a4');
                  const pdfWidth = pdf.internal.pageSize.getWidth();
                  const pdfHeight = pdf.internal.pageSize.getHeight();
                  const imgWidth = pdfWidth - 20;
                  const imgHeight = (canvas.height * imgWidth) / canvas.width;

                  let heightLeft = imgHeight;
                  let position = 10;

                  pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
                  heightLeft -= pdfHeight;

                  while (heightLeft >= 0) {
                    position = heightLeft - imgHeight + 10;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
                    heightLeft -= pdfHeight;
                  }

                  const nombreArchivo = `Presupuesto_${obra.nombre?.replace(/\s/g, '_') || `Obra_${obra.id}`}_${new Date().getTime()}.pdf`;
                  pdf.save(nombreArchivo);

                  showNotification('? PDF generado y descargado exitosamente', 'success');

                  // Preguntar si desea enviar por WhatsApp
                  if (confirm('�Desea enviar este presupuesto por WhatsApp?')) {
                    const mensaje = `
*PRESUPUESTO - TRABAJO DIARIO*

?? *${obra.nombre}*
${obra.direccionObra || obra.direccion ? `?? ${obra.direccionObra || obra.direccion}` : ''}

${obra.fechaInicio ? `?? Inicio: ${obra.fechaInicio}` : ''}
${obra.dias || obra.duracionDias ? `?? Duraci?n: ${obra.dias || obra.duracionDias} d?as` : ''}

?? *TOTAL: $${(obra.presupuestoEstimado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}*

_PDF descargado - Adj?ntalo al mensaje_
_V?lido por 30 d?as_
                    `.trim();

                    const telefono = (obra.telefono || obra.clienteTelefono || '')?.toString().replace(/\D/g, '');
                    const url = telefono
                      ? `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`
                      : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;

                    window.open(url, '_blank');
                  }

                } catch (error) {
                  console.error('? Error generando PDF:', error);
                  showNotification('? Error al generar PDF: ' + error.message, 'error');
                }
              }
            } else {
              console.error('? No se encontr? la obra con ID:', selectedObraId);
              showNotification(' No se encontr? la obra seleccionada', 'warning');
            }
          } else {
            console.log(' No hay obra seleccionada');
            showNotification('Seleccione una obra para enviar', 'warning');
          }
        },
        handleVerObrasManuales: () => {
          // Cambiar a la vista de obras independientes
          dispatch(setActiveTab('obras-manuales'));
        },
        conteoObrasManuales: obras.filter(obra => {
          const tienePresupuesto = (presupuestosObras[obra.id] && typeof presupuestosObras[obra.id] === 'object') ||
                                  (obra.presupuestoNoCliente && typeof obra.presupuestoNoCliente === 'object');
          return !tienePresupuesto && obra.estado !== 'CANCELADO';
        }).length
      });
    }

    return () => {
      if (setObrasControls) {
        setObrasControls(null);
      }
    };
  }, [selectedObraId, setObrasControls, obras, presupuestosObras, modoEdicion, activeTab]);

  // Enviar controles de trabajos extra al Sidebar
  useEffect(() => {
    if (activeTab === 'trabajos-extra' && setObrasControls) {
      console.log('?? Configurando controles de trabajos extra, seleccionado:', trabajoExtraSeleccionado);
      setObrasControls({
        selectedId: trabajoExtraSeleccionado?.id,
        selectedPresupuesto: trabajoExtraSeleccionado,
        handleNuevo: () => {
          setTrabajoExtraEditar(null);
          setMostrarModalTrabajoExtra(true);
        },
        handleEditar: () => {
          if (trabajoExtraSeleccionado) {
            handleEditarTrabajoExtra(trabajoExtraSeleccionado);
          } else {
            showNotification('Seleccione un trabajo extra para editar', 'warning');
          }
        },
        handleEliminar: () => {
          if (trabajoExtraSeleccionado) {
            handleEliminarTrabajoExtra(trabajoExtraSeleccionado.id);
          } else {
            showNotification('Seleccione un trabajo extra para eliminar', 'warning');
          }
        },
        handleVerPresupuestoSeleccionado: () => {
          if (trabajoExtraSeleccionado) {
            // Ver en modo solo lectura
            setTrabajoExtraEditar(trabajoExtraSeleccionado);
            setMostrarModalTrabajoExtra(true);
            // TODO: Agregar flag de modo lectura
          } else {
            showNotification('Seleccione un trabajo extra para ver', 'warning');
          }
        },
        handleEditarSoloFechas: () => {
          if (trabajoExtraSeleccionado) {
            // Abrir modal con flag de editar solo fechas
            const trabajoConFlag = { ...trabajoExtraSeleccionado, _editarSoloFechas: true };
            setTrabajoExtraEditar(trabajoConFlag);
            setMostrarModalTrabajoExtra(true);
            showNotification('?? Modo edici?n de fechas: Solo puede modificar fechas.\nEl estado y versi?n se preservar?n.', 'info');
          } else {
            showNotification('Seleccione un trabajo extra para editar fechas', 'warning');
          }
        },
        handleDuplicar: () => {
          if (trabajoExtraSeleccionado) {
            // Duplicar: abrir modal con datos copiados pero sin ID
            const duplicado = { ...trabajoExtraSeleccionado, id: null };
            setTrabajoExtraEditar(duplicado);
            setMostrarModalTrabajoExtra(true);
            showNotification('Duplicando trabajo extra. Modifique los datos y guarde.', 'info');
          } else {
            showNotification('Seleccione un trabajo extra para duplicar', 'warning');
          }
        },
        handleEnviarPresupuesto: () => {
          if (trabajoExtraSeleccionado) {
            // Cambiar estado a A_ENVIAR o ENVIADO
            if (trabajoExtraSeleccionado.estado === 'BORRADOR') {
              // Actualizar estado a A_ENVIAR
              api.presupuestosNoCliente.update(trabajoExtraSeleccionado.id, {
                ...trabajoExtraSeleccionado,
                estado: 'A_ENVIAR',
                esPresupuestoTrabajoExtra: true
              }, empresaId)
                .then(() => {
                  showNotification('? Trabajo extra marcado como listo para enviar', 'success');
                  cargarTrabajosExtra(obraParaTrabajosExtra);
                  setTrabajoExtraSeleccionado(null);
                })
                .catch(error => {
                  showNotification('? Error al cambiar estado: ' + error.message, 'error');
                });
            } else {
              showNotification('El trabajo extra debe estar en estado BORRADOR para marcarlo como listo para enviar', 'warning');
            }
          } else {
            showNotification('Seleccione un trabajo extra para enviar', 'warning');
          }
        },
        // Alias para compatibilidad con sidebar
        handleMarcarListoParaEnviar: () => {
          if (trabajoExtraSeleccionado) {
            // Cambiar estado a A_ENVIAR
            if (trabajoExtraSeleccionado.estado === 'BORRADOR') {
              api.presupuestosNoCliente.update(trabajoExtraSeleccionado.id, {
                ...trabajoExtraSeleccionado,
                estado: 'A_ENVIAR',
                esPresupuestoTrabajoExtra: true
              }, empresaId)
                .then(() => {
                  showNotification('? Trabajo extra marcado como "Listo para Enviar"', 'success');
                  cargarTrabajosExtra(obraParaTrabajosExtra);
                })
                .catch(error => {
                  showNotification('? Error al marcar trabajo extra: ' + error.message, 'error');
                });
            } else {
              showNotification(`Este trabajo extra ya est? en estado ${trabajoExtraSeleccionado.estado}`, 'warning');
            }
          } else {
            showNotification('Seleccione un trabajo extra primero', 'warning');
          }
        },
        handleEnviarTrabajoExtra: () => {
          if (trabajoExtraSeleccionado) {
            // Mostrar modal de selecci?n de env?o
            setMostrarModalSeleccionEnvioTrabajoExtra(true);
          } else {
            showNotification('Seleccione un trabajo extra para enviar', 'warning');
          }
        },
        handleConfirmarEnvioTrabajoExtra: (tipo) => {
          setMostrarModalSeleccionEnvioTrabajoExtra(false);

          if (!tipo) return; // Cancelado

          // Configurar el trabajo extra seleccionado para el modal
          setTrabajoExtraEditar(trabajoExtraSeleccionado);

          if (tipo === 'whatsapp') {
            // ? ACTIVAR FLAGS PARA WHATSAPP
            setAbrirWhatsAppTrabajoExtra(true);
            setAbrirEmailTrabajoExtra(false);

            console.log('?? FLAGS ACTIVADOS para WhatsApp');
            showNotification('?? Abre el modal, genera el PDF y env?a por WhatsApp', 'info');
          } else if (tipo === 'email') {
            // ? ACTIVAR FLAGS PARA EMAIL
            setAbrirWhatsAppTrabajoExtra(false);
            setAbrirEmailTrabajoExtra(true);

            console.log('?? FLAGS ACTIVADOS para Email');
            showNotification('?? Abre el modal, genera el PDF y env?a por Email', 'info');
          }

          setMostrarModalTrabajoExtra(true);
        },
        handleAprobar: async () => {
          if (!trabajoExtraSeleccionado) {
            showNotification('Seleccione un trabajo extra para aprobar', 'warning');
            return;
          }

          if (trabajoExtraSeleccionado.estado !== 'ENVIADO' && trabajoExtraSeleccionado.estado !== 'A_ENVIAR') {
            showNotification('El trabajo extra debe estar en estado ENVIADO o A_ENVIAR para aprobarlo', 'warning');
            return;
          }

          try {
            // Usar el mismo endpoint que PresupuestosNoClientePage
            // Este endpoint en el backend hace TODO: aprobar + crear obra
            const response = await api.post(
              `/api/v1/presupuestos-no-cliente/${trabajoExtraSeleccionado.id}/aprobar-y-crear-obra`,
              {},
              {
                params: { empresaId },
                headers: { 'X-Tenant-ID': empresaId, 'Content-Type': 'application/json' }
              }
            );

            const respuestaData = response.data || response;
            const obraId = respuestaData?.obraId || respuestaData?.id;
            const mensaje = respuestaData?.mensaje || respuestaData?.message;
            const obraCreada = respuestaData?.obraCreada !== false;

            if (obraCreada && obraId) {
              showNotification(
                mensaje || `Trabajo extra aprobado. Obra #${obraId} creada exitosamente.`,
                'success'
              );
            } else {
              showNotification(
                mensaje || 'Trabajo extra aprobado exitosamente',
                'success'
              );
            }

            // Recargar datos
            await dispatch(fetchObrasPorEmpresa(empresaId));
            cargarTrabajosExtra(obraParaTrabajosExtra);
            setTrabajoExtraSeleccionado(null);

          } catch (error) {
            console.error('Error al aprobar:', error);
            showNotification('Error al aprobar: ' + error.message, 'error');
          }
        },
        esTrabajosExtra: true, // Flag para que el sidebar sepa que est? en modo trabajos extra
        nombreObra: obraParaTrabajosExtra?.nombre,
        handleVolver: () => {
          setTrabajoExtraSeleccionado(null);
          dispatch(setActiveTab('lista'));
        }
      });
    }

    // Cleanup cuando salimos de trabajos extra
    return () => {
      if (activeTab === 'trabajos-extra' && setObrasControls) {
        console.log('?? Limpiando controles de trabajos extra');
        setObrasControls(null);
      }
    };
  }, [activeTab, trabajoExtraSeleccionado, setObrasControls, obraParaTrabajosExtra, dispatch, showNotification]);

  // Enviar controles de obras independientes al Sidebar
  useEffect(() => {
    if (activeTab === 'obras-manuales' && setObrasControls) {
      const obrasManuales = obras.filter(obra => {
        const tienePresupuesto = (presupuestosObras[obra.id] && typeof presupuestosObras[obra.id] === 'object') ||
                                (obra.presupuestoNoCliente && typeof obra.presupuestoNoCliente === 'object');
        return !tienePresupuesto && obra.estado !== 'CANCELADO';
      });

      setObrasControls({
        handleNuevo: () => abrirModalTrabajoDiario(),
        handleVolver: () => {
          dispatch(setActiveTab('lista'));
        },
        esObrasIndependientes: true,
        conteoObras: obrasManuales.length,
        titulo: 'Trabajos Diarios / Nuevos Clientes'
      });
    }

    // Cleanup cuando salimos de obras independientes
    return () => {
      if (activeTab === 'obras-manuales' && setObrasControls) {
        setObrasControls(null);
      }
    };
  }, [activeTab, setObrasControls, obras, presupuestosObras, dispatch]);


  // Manejar errores
  useEffect(() => {
    if (error) {
      showNotification(`Error: ${error}`, 'error');
      dispatch(clearError());
    }
  }, [error, showNotification, dispatch]);

  // Cargar presupuestos de las obras cuando cambian (OPTIMIZADO)
  const obrasIds = React.useMemo(() => {
    return obras?.map(o => o.id).sort().join(',') || '';
  }, [obras]);

  useEffect(() => {
    const cargarPresupuestos = async () => {
      if (!obras || obras.length === 0 || !empresaId) return;

      // PRIMERO: Inicializar con presupuestos que ya vienen en las obras
      const presupuestosIniciales = {};
      obras.forEach(obra => {
        if (obra.presupuestoNoCliente && typeof obra.presupuestoNoCliente === 'object') {
          const totalCalculado = obtenerTotalPresupuesto(obra.presupuestoNoCliente);
          presupuestosIniciales[obra.id] = {
            ...obra.presupuestoNoCliente,
            totalPresupuestoCalculado: totalCalculado
          };
        }
      });

      // Establecer presupuestos iniciales INMEDIATAMENTE
      setPresupuestosObras(prev => ({
        ...prev,
        ...presupuestosIniciales
      }));

      const presupuestos = {};

      // Cargar en lotes paralelos para mejorar performance
      const batchSize = 5;
      for (let i = 0; i < obras.length; i += batchSize) {
        const batch = obras.slice(i, i + batchSize);
        const promesas = batch.map(async (obra) => {
          try {
            // Si la obra tiene presupuestoOriginalId, usar endpoint directo que trae cálculos completos
            if (obra.presupuestoOriginalId) {
              try {
                const data = await api.presupuestosNoCliente.getById(obra.presupuestoOriginalId, empresaId);
                presupuestos[obra.id] = data;
                return;
              } catch (err) {
                console.warn(`No se pudo cargar presupuesto ${obra.presupuestoOriginalId}:`, err);
              }
            }

            // Fallback: buscar por obra
            const data = await api.presupuestosNoCliente.getAll(empresaId, { obraId: obra.id });

            if (data) {
              // data ya es el JSON parseado

              // Si es array, buscar presupuesto en orden de prioridad
              if (Array.isArray(data)) {
                const presupuesto = data.find(p => p.estado === 'EN_EJECUCION') ||
                                   data.find(p => p.estado === 'APROBADO') ||
                                   data.find(p => p.estado === 'TERMINADO') ||
                                   data.find(p => p.estado === 'ENVIADO') ||
                                   data.find(p => p.estado === 'A_ENVIAR') ||
                                   data[0];

                // Si encontramos un presupuesto, obtener la versión completa
                if (presupuesto && presupuesto.id) {
                  try {
                    const completeData = await api.presupuestosNoCliente.getById(presupuesto.id, empresaId);
                    presupuestos[obra.id] = completeData;
                  } catch (err) {
                    console.warn(`Error al obtener presupuesto completo ${presupuesto.id}:`, err);
                    presupuestos[obra.id] = presupuesto;
                  }
                }
              } else if (data && data.id) {
                presupuestos[obra.id] = data;
              }
            }

            // Si no se cargó presupuesto pero la obra tiene presupuestoNoCliente, usarlo
            if (!presupuestos[obra.id] && obra.presupuestoNoCliente) {
              presupuestos[obra.id] = obra.presupuestoNoCliente;
            }
          } catch (error) {
            console.error(`Error cargando presupuesto para obra ${obra.id}:`, error);
            // Si hay error pero la obra tiene presupuestoNoCliente, usarlo
            if (obra.presupuestoNoCliente) {
              presupuestos[obra.id] = obra.presupuestoNoCliente;
            }
          }
        });

        await Promise.allSettled(promesas);
      }

      // Filtrar para SOLO incluir presupuestos válidos (no null, no undefined)
      const presupuestosValidos = Object.fromEntries(
        Object.entries(presupuestos).filter(([_, value]) => value != null && typeof value === 'object')
      );

      // MERGE inteligente: NUNCA sobrescribir un presupuesto válido con vacío
      setPresupuestosObras(prev => {
        const nuevo = { ...prev };

        Object.entries(presupuestosValidos).forEach(([obraId, presupuesto]) => {
          if (presupuesto && typeof presupuesto === 'object') {
            const totalCalculado = obtenerTotalPresupuesto(presupuesto);
            nuevo[obraId] = {
              ...presupuesto,
              totalPresupuestoCalculado: totalCalculado
            };
          }
        });

        return nuevo;
      });
    };

    cargarPresupuestos();
  }, [obrasIds, empresaId]);

  // ?? Cargar contadores autom?ticamente para todas las obras visibles (OPTIMIZADO)
  const contadoresCargadosRef = React.useRef(new Set());

  useEffect(() => {
    const cargarContadoresAutomaticamente = async () => {
      if (!obras || obras.length === 0 || !empresaId) return;

      // Filtrar solo obras que NO han sido cargadas
      const obrasPendientes = obras.filter(obra => !contadoresCargadosRef.current.has(obra.id));

      if (obrasPendientes.length === 0) return;

      // console.log('?? Cargando contadores para', obrasPendientes.length, 'obras nuevas');

      // Cargar contadores en paralelo (limitado a 5 simult?neas)
      const batchSize = 5;
      for (let i = 0; i < obrasPendientes.length; i += batchSize) {
        const batch = obrasPendientes.slice(i, i + batchSize);
        await Promise.allSettled(
         batch.map(async (obra) => {
            const obraIdReal = obra.obraId || obra.id;
            await cargarContadoresObra(obraIdReal);
            contadoresCargadosRef.current.add(obraIdReal);
          })
        );
      }

      console.log('? Contadores cargados');
    };

    cargarContadoresAutomaticamente();
  }, [obrasIds, empresaId]); // Usar obrasIds memoizado

  // ?? Cargar contadores automáticamente para trabajosExtra y tareasLeves
  useEffect(() => {
    if (!empresaId) return;

    const todasLasTareas = [...trabajosExtra, ...tareasLeves];
    if (todasLasTareas.length === 0) return;

    todasLasTareas.forEach(tarea => {
      const obraIdVinculada = tarea.id_obra || tarea.obraId || tarea.obra_id || tarea.idObra;
      if (obraIdVinculada && !contadoresCargadosRef.current.has(tarea.id)) {
        cargarContadoresObra(obraIdVinculada, tarea.id);
        contadoresCargadosRef.current.add(tarea.id);
      }
    });
  }, [trabajosExtra.length, tareasLeves.length, empresaId]);

  // ?? Cargar contadores cuando se expande una tarea leve
  useEffect(() => {
    if (!trabajoExtraExpandido) return;

    // Buscar primero en trabajosExtra (tareas leves hijas de trabajos extra)
    let trabajo = trabajosExtra.find(t => t.id === trabajoExtraExpandido);

    // Si no se encuentra, buscar en tareasLeves (tareas leves hijas de obras principales)
    if (!trabajo) {
      trabajo = tareasLeves.find(t => t.id === trabajoExtraExpandido);
    }

    if (!trabajo) return;

    // Extraer el ID de la obra vinculada
    const obraIdVinculada = trabajo.id_obra || trabajo.obraId || trabajo.obra_id || trabajo.idObra;
    if (!obraIdVinculada) return;

    cargarContadoresObra(obraIdVinculada, trabajo.id);
  }, [trabajoExtraExpandido, trabajosExtra, tareasLeves, empresaId]);

  // ?? Actualizar presupuesto de etapas diarias
  useEffect(() => {
    if (!obraParaEtapasDiarias || !obraParaEtapasDiarias.id) return;

    const presupuestoActualizado = presupuestosObras[obraParaEtapasDiarias.id];
    if (!presupuestoActualizado) return;

    const presupuestoActual = obraParaEtapasDiarias.presupuestoNoCliente;

    // Crear clave ?nica para este presupuesto
    const presupuestoKey = `${obraParaEtapasDiarias.id}-${presupuestoActualizado.fechaProbableInicio}-${presupuestoActualizado.tiempoEstimadoTerminacion}`;

    // Si ya asignamos este presupuesto exacto, no hacer nada
    if (presupuestoAsignadoRef.current.has(presupuestoKey)) {
      return;
    }

    // Si ya tiene presupuesto con los mismos datos, marcar como asignado y salir
    if (presupuestoActual &&
        presupuestoActual.fechaProbableInicio === presupuestoActualizado.fechaProbableInicio &&
        presupuestoActual.tiempoEstimadoTerminacion === presupuestoActualizado.tiempoEstimadoTerminacion) {
      presupuestoAsignadoRef.current.add(presupuestoKey);
      return;
    }

    // Asignar el presupuesto
    // ?? NO actualizar presupuesto para trabajos extra - mantener presupuesto precargado
    if (!obraParaEtapasDiarias._esTrabajoExtra) {
      presupuestoAsignadoRef.current.add(presupuestoKey);
      setObraParaEtapasDiarias(prev => ({
        ...prev,
        presupuestoNoCliente: presupuestoActualizado
      }));
    } else {
      console.log('?? [useEffect presupuestosObras] BLOQUEANDO actualizaci?n de presupuesto para TRABAJO EXTRA');
    }
  }, [presupuestosObras, obraParaEtapasDiarias?.id]);

  const cargarObrasSegunFiltro = async () => {
    try {
      if (!empresaId) {
        console.warn('No hay empresaId seleccionada, no se cargan obras');
        return;
      }



      if (estadoFilter === 'todas') {
        // Cargar obras por empresa (filtradas autom?ticamente por empresaId)
        const result = await dispatch(fetchObrasPorEmpresa(empresaId)).unwrap();
        console.log(' Obras cargadas:', result?.length || 0);
        showNotification(`${result?.length || 0} obras cargadas exitosamente`, 'success');
      } else if (estadoFilter === 'activas') {
        const result = await dispatch(fetchObrasActivas(empresaId)).unwrap();
        console.log(' Obras activas cargadas:', result?.length || 0);
        showNotification(`${result?.length || 0} obras activas cargadas exitosamente`, 'success');
      } else {
        const result = await dispatch(fetchObrasPorEstado({ estado: estadoFilter, empresaId })).unwrap();
        console.log(' Obras con estado', estadoFilter, ':', result?.length || 0);
        showNotification(`${result?.length || 0} obras en estado ${estadoFilter} cargadas exitosamente`, 'success');
      }
    } catch (error) {
      let msg = 'Error cargando obras';
      if (error && error.data) {
        msg = error.data.message || msg;
        if (error.data.validationErrors) {
          msg += ': ' + Object.entries(error.data.validationErrors).map(([k, v]) => `${k}: ${v}`).join(', ');
        }
      }
      console.error('Error cargando obras:', error);
      showNotification(msg, 'error');
    }
  };

  // Toggle para expandir/colapsar obra
  const toggleObraExpandida = (obraId, e) => {
    e.stopPropagation(); // Evitar que se seleccione la obra al expandir
    setObrasExpandidas(prev => {
      const nuevas = new Set(prev);
      const estaExpandiendo = !nuevas.has(obraId);

      if (nuevas.has(obraId)) {
        nuevas.delete(obraId);
      } else {
        nuevas.add(obraId);
        // ?? Solo cargar contadores para obras reales (no para tareas leves con id "ta_xxx")
        const esTareaLeve = typeof obraId === 'string' && obraId.startsWith('ta_');
        if (estaExpandiendo && !esTareaLeve) {
          cargarContadoresObra(obraId);
        }
      }
      return nuevas;
    });
  };

  // Funci?n para actualizar obra completa (incluye profesionales)
  const handleActualizarObraCompleta = async () => {
    console.log(' handleActualizarObraCompleta INICIADO');
    console.log('?? Obra a actualizar:', obraEditando);
    console.log('??� Datos del formulario:', formData);

    try {
      // Validar campos obligatorios
      if (!formData.direccionObraCalle || !formData.direccionObraAltura) {
        console.log(' VALIDACI�N FALLIDA: Faltan calle o altura');
        showNotification(' Los campos Calle y Altura son obligatorios', 'error');
        return;
      }

      // Detectar si salimos de SUSPENDIDA o CANCELADO
      const estadoAnterior = obraEditando.estado;
      const estadoNuevo = formData.estado || "BORRADOR";
      const saliendoDeSuspensionOCancelacion =
        (estadoAnterior === 'SUSPENDIDA' || estadoAnterior === 'CANCELADO') &&
        estadoNuevo !== estadoAnterior;

      // ?? DEBUG: Valores de variables de estado ANTES de construir payload
      console.log('?? DEBUG ESTADO DESGLOSE:');
      console.log('  usarDesgloseObra:', usarDesgloseObra);
      console.log('  importeJornalesObra:', importeJornalesObra);
      console.log('  importeMaterialesObra:', importeMaterialesObra);
      console.log('  importeGastosGeneralesObra:', importeGastosGeneralesObra);
      console.log('  importeMayoresCostosObra:', importeMayoresCostosObra);

      // Preparar datos para actualizaci?n
      const obraData = {
        id: obraEditando.id,
        nombre: formData.nombre || "",
        estado: estadoNuevo,
        fechaInicio: formData.fechaInicio || null,
        fechaFin: formData.fechaFin || null,
        presupuestoEstimado: formData.presupuestoEstimado ? parseFloat(formData.presupuestoEstimado) : null,
        descripcion: formData.descripcion || null,
        observaciones: formData.observaciones || null,
        //  MAPEO CORRECTO SEG�N ESPECIFICACI�N BACKEND
        // Desglose de presupuesto - importes base (4 categor?as)
        presupuestoJornales: usarDesgloseObra ? (parseFloat(importeJornalesObra) || null) : null,
        presupuestoMateriales: usarDesgloseObra ? (parseFloat(importeMaterialesObra) || null) : null,
        importeGastosGeneralesObra: usarDesgloseObra ? (parseFloat(importeGastosGeneralesObra) || null) : null,
        presupuestoMayoresCostos: usarDesgloseObra ? (parseFloat(importeMayoresCostosObra) || null) : null,

        // Honorarios individuales para cada categor?a (8 campos)
        honorarioJornalesObra: usarDesgloseObra ? (parseFloat(honorarioJornalesObra) || null) : null,
        tipoHonorarioJornalesObra: usarDesgloseObra ? tipoHonorarioJornalesObra : null,
        honorarioMaterialesObra: usarDesgloseObra ? (parseFloat(honorarioMaterialesObra) || null) : null,
        tipoHonorarioMaterialesObra: usarDesgloseObra ? tipoHonorarioMaterialesObra : null,
        honorarioGastosGeneralesObra: usarDesgloseObra ? (parseFloat(honorarioGastosGeneralesObra) || null) : null,
        tipoHonorarioGastosGeneralesObra: usarDesgloseObra ? tipoHonorarioGastosGeneralesObra : null,
        honorarioMayoresCostosObra: usarDesgloseObra ? (parseFloat(honorarioMayoresCostosObra) || null) : null,
        tipoHonorarioMayoresCostosObra: usarDesgloseObra ? tipoHonorarioMayoresCostosObra : null,

        // Descuentos sobre importes base (8 campos)
        descuentoJornalesObra: usarDesgloseObra ? (parseFloat(descuentoJornalesObra) || null) : null,
        tipoDescuentoJornalesObra: usarDesgloseObra ? tipoDescuentoJornalesObra : null,
        descuentoMaterialesObra: usarDesgloseObra ? (parseFloat(descuentoMaterialesObra) || null) : null,
        tipoDescuentoMaterialesObra: usarDesgloseObra ? tipoDescuentoMaterialesObra : null,
        descuentoGastosGeneralesObra: usarDesgloseObra ? (parseFloat(descuentoGastosGeneralesObra) || null) : null,
        tipoDescuentoGastosGeneralesObra: usarDesgloseObra ? tipoDescuentoGastosGeneralesObra : null,
        descuentoMayoresCostosObra: usarDesgloseObra ? (parseFloat(descuentoMayoresCostosObra) || null) : null,
        tipoDescuentoMayoresCostosObra: usarDesgloseObra ? tipoDescuentoMayoresCostosObra : null,

        // Descuentos sobre honorarios (8 campos)
        descuentoHonorarioJornalesObra: usarDesgloseObra ? (parseFloat(descuentoHonorarioJornalesObra) || null) : null,
        tipoDescuentoHonorarioJornalesObra: usarDesgloseObra ? tipoDescuentoHonorarioJornalesObra : null,
        descuentoHonorarioMaterialesObra: usarDesgloseObra ? (parseFloat(descuentoHonorarioMaterialesObra) || null) : null,
        tipoDescuentoHonorarioMaterialesObra: usarDesgloseObra ? tipoDescuentoHonorarioMaterialesObra : null,
        descuentoHonorarioGastosGeneralesObra: usarDesgloseObra ? (parseFloat(descuentoHonorarioGastosGeneralesObra) || null) : null,
        tipoDescuentoHonorarioGastosGeneralesObra: usarDesgloseObra ? tipoDescuentoHonorarioGastosGeneralesObra : null,
        descuentoHonorarioMayoresCostosObra: usarDesgloseObra ? (parseFloat(descuentoHonorarioMayoresCostosObra) || null) : null,
        tipoDescuentoHonorarioMayoresCostosObra: usarDesgloseObra ? tipoDescuentoHonorarioMayoresCostosObra : null,

        // Direcci?n de la obra
        direccionObraCalle: formData.direccionObraCalle,
        direccionObraAltura: formData.direccionObraAltura,
        direccionObraBarrio: formData.direccionObraBarrio || null,
        direccionObraTorre: formData.direccionObraTorre || null,
        direccionObraPiso: formData.direccionObraPiso || null,
        direccionObraDepartamento: formData.direccionObraDepartamento || null,

        // Cliente (mantener el existente)
        idCliente: formData.idCliente || obraEditando.clienteId || obraEditando.idCliente || null,

        // EmpresaId
        empresaId: formData.empresaId || empresaId || 1
      };

      // ?? DEBUG: Payload final a enviar
      console.log('?? PAYLOAD FINAL A ENVIAR:', JSON.stringify(obraData, null, 2));
      window.PAYLOAD_OBRA_UPDATE = obraData; // Para debugging en consola



      await dispatch(updateObra({ id: obraEditando.id, obraData })).unwrap();

      // Si salimos de SUSPENDIDA o CANCELADO, actualizar presupuesto a BORRADOR
      if (saliendoDeSuspensionOCancelacion) {
        try {
          console.log(`?? Obra sale de ${estadoAnterior} ? ${estadoNuevo}. Actualizando presupuesto a BORRADOR...`);

          // Buscar el presupuesto vinculado a esta obra
          const presupuesto = presupuestosObras[obraEditando.id];
          if (presupuesto) {
            const presupuestoActualizado = {
              ...presupuesto,
              estado: 'BORRADOR'
            };

            await api.presupuestosNoCliente.update(presupuesto.id, presupuestoActualizado, empresaId);

            // Actualizar estado local
            setPresupuestosObras(prev => ({
              ...prev,
              [obraEditando.id]: presupuestoActualizado
            }));

            console.log('? Presupuesto actualizado a BORRADOR');
          } else {
            console.warn(' No se encontr? presupuesto vinculado para actualizar');
          }
        } catch (error) {
          console.error('? Error actualizando presupuesto a BORRADOR:', error);
          showNotification(' Obra actualizada pero hubo un problema al actualizar el presupuesto', 'warning');
        }
      }

      showNotification(' Obra actualizada exitosamente', 'success');

      // Limpiar formulario y estados
      setFormData({
        nombre: '',
        direccion: '',
        estado: 'APROBADO',
        fechaInicio: '',
        fechaFin: '',
        presupuestoEstimado: '',
        idCliente: '',
        nombreSolicitante: '',
        telefono: '',
        direccionParticular: '',
        mail: '',
        direccionObraCalle: '',
        direccionObraAltura: '',
        direccionObraBarrio: '',
        direccionObraTorre: '',
        direccionObraPiso: '',
        direccionObraDepartamento: '',
        descripcion: '',
        observaciones: ''
      });

      setProfesionalesAsignadosForm([]);
      setProfesionalSeleccionado('');
      setTipoProfesional('LISTADO_GENERAL');
      setProfesionalManual({ nombre: '', tipoProfesional: '', valorHora: '' });

      // Salir del modo edici?n
      setModoEdicion(false);
      setObraEditando(null);

      // Limpiar estados del desglose de obra
      setUsarDesgloseObra(false);
      setImporteMaterialesObra('');
      setImporteJornalesObra('');
      setImporteGastosGeneralesObra('');
      setImporteMayoresCostosObra('');
      setHonorarioJornalesObra('');
      setTipoHonorarioJornalesObra('porcentaje');
      setHonorarioMaterialesObra('');
      setTipoHonorarioMaterialesObra('porcentaje');
      setHonorarioGastosGeneralesObra('');
      setTipoHonorarioGastosGeneralesObra('porcentaje');
      setHonorarioMayoresCostosObra('');
      setTipoHonorarioMayoresCostosObra('porcentaje');
      setDescuentoJornalesObra('');
      setTipoDescuentoJornalesObra('porcentaje');
      setDescuentoMaterialesObra('');
      setTipoDescuentoMaterialesObra('porcentaje');
      setDescuentoGastosGeneralesObra('');
      setTipoDescuentoGastosGeneralesObra('porcentaje');
      setDescuentoMayoresCostosObra('');
      setTipoDescuentoMayoresCostosObra('porcentaje');
      setDescuentoHonorarioJornalesObra('');
      setTipoDescuentoHonorarioJornalesObra('porcentaje');
      setDescuentoHonorarioMaterialesObra('');
      setTipoDescuentoHonorarioMaterialesObra('porcentaje');
      setDescuentoHonorarioGastosGeneralesObra('');
      setTipoDescuentoHonorarioGastosGeneralesObra('porcentaje');
      setDescuentoHonorarioMayoresCostosObra('');
      setTipoDescuentoHonorarioMayoresCostosObra('porcentaje');
      setImporteTotalObra('');

      // Cambiar a la pesta?a de lista y recargar obras
      dispatch(setActiveTab('lista'));
      await cargarObrasSegunFiltro();

    } catch (error) {
      console.error(' Error actualizando obra:', error);
      showNotification(' Error actualizando obra: ' + error, 'error');
    }
  };

  const handleCrearObra = async () => {
    console.log('?? handleCrearObra LLAMADO');
    console.log('?? modoEdicion:', modoEdicion);
    console.log('?? obraEditando:', obraEditando);

    // Si estamos en modo edici?n, usar la funci?n de actualizaci?n
    if (modoEdicion && obraEditando) {
      console.log('? Entrando en modo actualizaci?n');
      await handleActualizarObraCompleta();
      return;
    }

    console.log('? Entrando en modo creaci?n');
    // Modo CREACI�N (c?digo original)

    try {
      // Validar campos obligatorios
      if (!formData.direccionObraCalle || !formData.direccionObraAltura) {
        console.log(' VALIDACI�N FALLIDA: Faltan calle o altura');
        showNotification(' Los campos Calle y Altura son obligatorios', 'error');
        return;
      }

      // ?? Verificar si hay profesionales temporales (adhoc) que no se guardar?n
      const profesionalesAdhoc = profesionalesAsignadosForm.filter(prof =>
        typeof prof.id === 'string' && prof.id.startsWith('adhoc_')
      );

      if (profesionalesAdhoc.length > 0) {
        const nombresAdhoc = profesionalesAdhoc.map(p => p.nombre).join(', ');
        const confirmar = window.confirm(
          ` Hay ${profesionalesAdhoc.length} profesional(es) temporal(es) que NO se guardar?n con la obra:\n\n${nombresAdhoc}\n\n` +
          `Para incluirlos, debes marcar "Guardar en cat?logo permanente" al agregarlos.\n\n` +
          `�Deseas continuar creando la obra SIN estos profesionales?`
        );

        if (!confirmar) {
          return; // Cancelar creaci?n
        }
      }



      // Si no hay cliente seleccionado ni datos de nuevo cliente, crear uno gen?rico
      let nombreSolicitanteFinal = formData.nombreSolicitante;
      if (!formData.idCliente && !nombreSolicitanteFinal) {
        // Generar nombre de cliente autom?ticamente desde la direcci?n de la obra
        nombreSolicitanteFinal = `Cliente - ${formData.direccionObraCalle} ${formData.direccionObraAltura}`.trim();
        console.log('��� Cliente gen?rico creado:', nombreSolicitanteFinal);
      }

      // Preparar datos seg?n especificaci?n del backend
      const obraData = {
        // Nombre: enviar vac?o si no se ingres? (el backend lo generar? autom?ticamente)
        nombre: formData.nombre || "",
        estado: formData.estado || "BORRADOR",
        fechaInicio: formData.fechaInicio || null,
        fechaFin: formData.fechaFin || null,
        presupuestoEstimado: formData.presupuestoEstimado ? parseFloat(formData.presupuestoEstimado) : null,
        descripcion: formData.descripcion || null,
        observaciones: formData.observaciones || null,
        //  MAPEO CORRECTO SEG�N ESPECIFICACI�N BACKEND
        // Desglose de presupuesto - importes base (4 categor?as)
        presupuestoJornales: usarDesgloseObra ? (parseFloat(importeJornalesObra) || null) : null,
        presupuestoMateriales: usarDesgloseObra ? (parseFloat(importeMaterialesObra) || null) : null,
        importeGastosGeneralesObra: usarDesgloseObra ? (parseFloat(importeGastosGeneralesObra) || null) : null,
        presupuestoMayoresCostos: usarDesgloseObra ? (parseFloat(importeMayoresCostosObra) || null) : null,

        // Honorarios individuales para cada categor?a (8 campos)
        honorarioJornalesObra: usarDesgloseObra ? (parseFloat(honorarioJornalesObra) || null) : null,
        tipoHonorarioJornalesObra: usarDesgloseObra ? tipoHonorarioJornalesObra : null,
        honorarioMaterialesObra: usarDesgloseObra ? (parseFloat(honorarioMaterialesObra) || null) : null,
        tipoHonorarioMaterialesObra: usarDesgloseObra ? tipoHonorarioMaterialesObra : null,
        honorarioGastosGeneralesObra: usarDesgloseObra ? (parseFloat(honorarioGastosGeneralesObra) || null) : null,
        tipoHonorarioGastosGeneralesObra: usarDesgloseObra ? tipoHonorarioGastosGeneralesObra : null,
        honorarioMayoresCostosObra: usarDesgloseObra ? (parseFloat(honorarioMayoresCostosObra) || null) : null,
        tipoHonorarioMayoresCostosObra: usarDesgloseObra ? tipoHonorarioMayoresCostosObra : null,

        // Descuentos sobre importes base (8 campos)
        descuentoJornalesObra: usarDesgloseObra ? (parseFloat(descuentoJornalesObra) || null) : null,
        tipoDescuentoJornalesObra: usarDesgloseObra ? tipoDescuentoJornalesObra : null,
        descuentoMaterialesObra: usarDesgloseObra ? (parseFloat(descuentoMaterialesObra) || null) : null,
        tipoDescuentoMaterialesObra: usarDesgloseObra ? tipoDescuentoMaterialesObra : null,
        descuentoGastosGeneralesObra: usarDesgloseObra ? (parseFloat(descuentoGastosGeneralesObra) || null) : null,
        tipoDescuentoGastosGeneralesObra: usarDesgloseObra ? tipoDescuentoGastosGeneralesObra : null,
        descuentoMayoresCostosObra: usarDesgloseObra ? (parseFloat(descuentoMayoresCostosObra) || null) : null,
        tipoDescuentoMayoresCostosObra: usarDesgloseObra ? tipoDescuentoMayoresCostosObra : null,

        // Descuentos sobre honorarios (8 campos)
        descuentoHonorarioJornalesObra: usarDesgloseObra ? (parseFloat(descuentoHonorarioJornalesObra) || null) : null,
        tipoDescuentoHonorarioJornalesObra: usarDesgloseObra ? tipoDescuentoHonorarioJornalesObra : null,
        descuentoHonorarioMaterialesObra: usarDesgloseObra ? (parseFloat(descuentoHonorarioMaterialesObra) || null) : null,
        tipoDescuentoHonorarioMaterialesObra: usarDesgloseObra ? tipoDescuentoHonorarioMaterialesObra : null,
        descuentoHonorarioGastosGeneralesObra: usarDesgloseObra ? (parseFloat(descuentoHonorarioGastosGeneralesObra) || null) : null,
        tipoDescuentoHonorarioGastosGeneralesObra: usarDesgloseObra ? tipoDescuentoHonorarioGastosGeneralesObra : null,
        descuentoHonorarioMayoresCostosObra: usarDesgloseObra ? (parseFloat(descuentoHonorarioMayoresCostosObra) || null) : null,
        tipoDescuentoHonorarioMayoresCostosObra: usarDesgloseObra ? tipoDescuentoHonorarioMayoresCostosObra : null,

        // Direcci?n de la obra (calle y altura son obligatorios)
        direccionObraCalle: formData.direccionObraCalle,
        direccionObraAltura: formData.direccionObraAltura,
        direccionObraBarrio: formData.direccionObraBarrio || null,
        direccionObraTorre: formData.direccionObraTorre || null,
        direccionObraPiso: formData.direccionObraPiso || null,
        direccionObraDepartamento: formData.direccionObraDepartamento || null,

        // Cliente: puede ser ID existente o null (si se crea nuevo)
        idCliente: formData.idCliente || null,

        // Datos para crear nuevo cliente (usa el generado si no hay)
        nombreSolicitante: nombreSolicitanteFinal || null,
        telefono: formData.telefono || null,
        mail: formData.mail || null,
        direccionParticular: formData.direccionParticular || null,

        // EmpresaId (requerido)
        empresaId: formData.empresaId || empresaId || 1,

        // Profesionales asignados (formato espec?fico del backend)
        // ?? Filtrar profesionales adhoc (temporales) - solo enviar los guardados en BD
        profesionalesAsignadosForm: profesionalesAsignadosForm
          .filter(prof => {
            const esAdhoc = typeof prof.id === 'string' && prof.id.startsWith('adhoc_');
            return !esAdhoc; // Solo incluir profesionales con ID real
          })
          .map(prof => ({
            id: prof.esManual ? prof.id : prof.id.toString(), // String siempre
            nombre: prof.nombre,
            tipoProfesional: prof.tipoProfesional,
            valorHora: parseFloat(prof.valorHora || 0),
            esManual: prof.esManual || false
          }))
      };

      console.log('?????????????????????????????????????????????');
      console.log('?? PAYLOAD COMPLETO A ENVIAR AL BACKEND:');
      console.log('??????????????????????????????????????????????');
      console.log(JSON.stringify(obraData, null, 2));
      console.log('========================================');

      // Guardar payload en variable global
      window.PAYLOAD_OBRA = obraData;
      console.warn('========================================');
      console.warn('>>> PAYLOAD GUARDADO EN: window.PAYLOAD_OBRA <<<');
      console.warn('========================================');
      console.warn('CAMPOS PRINCIPALES:');
      console.warn('  idCliente:', obraData.idCliente);
      console.warn('  empresaId:', obraData.empresaId);
      console.warn('  direccionObraCalle:', obraData.direccionObraCalle);
      console.warn('  direccionObraAltura:', obraData.direccionObraAltura);
      console.warn('  profesionalesAsignadosForm length:', obraData.profesionalesAsignadosForm?.length);
      console.warn('========================================');

      await dispatch(createObra(obraData)).unwrap();
      showNotification(' Obra creada exitosamente', 'success');

      // Limpiar formulario
      setFormData({
        nombre: '',
        direccion: '',
        estado: 'APROBADO',
        fechaInicio: '',
        fechaFin: '',
        presupuestoEstimado: '',
        idCliente: '',
        // Campos para nuevo cliente
        nombreSolicitante: '',
        telefono: '',
        direccionParticular: '',
        mail: '',
        // Campos para direcci?n detallada de la obra
        direccionObraCalle: '',
        direccionObraAltura: '',
        direccionObraBarrio: '',
        direccionObraTorre: '',
        direccionObraPiso: '',
        direccionObraDepartamento: '',
        // Campos adicionales
        descripcion: '',
        observaciones: ''
      });
      // Limpiar profesionales asignados
      setProfesionalesAsignadosForm([]);
      setProfesionalSeleccionado('');
      setTipoProfesional('LISTADO_GENERAL');
      setProfesionalManual({ nombre: '', tipoProfesional: '', valorHora: '' });

      // Limpiar estados del desglose de obra
      setUsarDesgloseObra(false);
      setImporteMaterialesObra('');
      setImporteJornalesObra('');
      setImporteGastosGeneralesObra('');
      setImporteMayoresCostosObra('');
      setHonorarioJornalesObra('');
      setTipoHonorarioJornalesObra('porcentaje');
      setHonorarioMaterialesObra('');
      setTipoHonorarioMaterialesObra('porcentaje');
      setHonorarioGastosGeneralesObra('');
      setTipoHonorarioGastosGeneralesObra('porcentaje');
      setHonorarioMayoresCostosObra('');
      setTipoHonorarioMayoresCostosObra('porcentaje');
      setDescuentoJornalesObra('');
      setTipoDescuentoJornalesObra('porcentaje');
      setDescuentoMaterialesObra('');
      setTipoDescuentoMaterialesObra('porcentaje');
      setDescuentoGastosGeneralesObra('');
      setTipoDescuentoGastosGeneralesObra('porcentaje');
      setDescuentoMayoresCostosObra('');
      setTipoDescuentoMayoresCostosObra('porcentaje');
      setDescuentoHonorarioJornalesObra('');
      setTipoDescuentoHonorarioJornalesObra('porcentaje');
      setDescuentoHonorarioMaterialesObra('');
      setTipoDescuentoHonorarioMaterialesObra('porcentaje');
      setDescuentoHonorarioGastosGeneralesObra('');
      setTipoDescuentoHonorarioGastosGeneralesObra('porcentaje');
      setDescuentoHonorarioMayoresCostosObra('');
      setTipoDescuentoHonorarioMayoresCostosObra('porcentaje');
      setImporteTotalObra('');

      // Cambiar a la pesta?a de lista y recargar obras
      dispatch(setActiveTab('lista'));
      await cargarObrasSegunFiltro();

    } catch (error) {
      console.error(' Error creando obra:', error);

      // Mensaje espec?fico seg?nn el tipo de error
      if (error.includes('No static resource')) {
        showNotification(' No se puede crear la obra: El backend no tiene configurado el servicio de obras. Contacte al administrador.', 'error');
      } else {
        showNotification(' Error creando obra: ' + error, 'error');
      }
    }
  };

  const handleActualizarObra = async (id, data) => {
    try {
      // Limpiar datos antes de enviar
      const { fechaCreacion, cliente, ...obraData } = data;
      await dispatch(updateObra({ id, obraData })).unwrap();
      showNotification('Obra actualizada exitosamente', 'success');

      // Si cambi? fechaInicio, actualizar tambi?n el presupuesto
      if (obraData.fechaInicio && presupuestosObras[id]) {
        const presupuestoActual = presupuestosObras[id];
        if (presupuestoActual.fechaProbableInicio !== obraData.fechaInicio) {
          try {
            console.log(' Actualizando fechaProbableInicio del presupuesto...');
            const presupuestoActualizado = {
              ...presupuestoActual,
              fechaProbableInicio: obraData.fechaInicio
            };

            // Guardar en backend
            await api.presupuestosNoCliente.update(presupuestoActual.id, presupuestoActualizado, empresaId);

            // Actualizar estado local
            setPresupuestosObras(prev => ({
              ...prev,
              [id]: presupuestoActualizado
            }));

            // Si hay etapas diarias abiertas, recargarlas
            // ?? NO actualizar presupuesto para trabajos extra - mantener presupuesto precargado
            if (obraParaEtapasDiarias && obraParaEtapasDiarias.id === id && !obraParaEtapasDiarias._esTrabajoExtra) {
              const obraActualizada = { ...obraParaEtapasDiarias, presupuestoNoCliente: presupuestoActualizado };
              setObraParaEtapasDiarias(obraActualizada);
            } else if (obraParaEtapasDiarias && obraParaEtapasDiarias.id === id && obraParaEtapasDiarias._esTrabajoExtra) {
              console.log('?? [handleModificarFechaInicio] BLOQUEANDO actualizaci?n de presupuesto para TRABAJO EXTRA');
            }

            console.log(' Presupuesto actualizado con nueva fecha de inicio');
          } catch (error) {
            console.warn('�� No se pudo actualizar la fecha del presupuesto:', error);
          }
        }
      }

      // Recargar la lista de obras
      await cargarObrasSegunFiltro();
    } catch (error) {
      showNotification('Error actualizando obra', 'error');
    }
  };

  const handleEliminarObra = async (id) => {
    const obra = obras.find(o => o.id === id);

    // Contar adicionales obra (trabajos extra) vinculados
    const adicionalesVinculados = Array.isArray(trabajosExtra)
      ? trabajosExtra.filter(te => te.obraId === id)
      : [];

    // Contar tareas leve: directas a la obra + vinculadas via adicionales
    const adicionalesIds = adicionalesVinculados.map(te => te.id);
    const tareasDirectas = Array.isArray(trabajosAdicionales)
      ? trabajosAdicionales.filter(ta => ta.obraId === id && !ta.trabajoExtraId)
      : [];
    const tareasViaAdicionales = Array.isArray(trabajosAdicionales)
      ? trabajosAdicionales.filter(ta => adicionalesIds.includes(ta.trabajoExtraId))
      : [];
    const totalTareas = tareasDirectas.length + tareasViaAdicionales.length;

    let confirmMessage = `?Est? seguro de eliminar la obra "${obra?.nombre || id}"?\n\n`;
    confirmMessage += `?? ADVERTENCIA: Se eliminar?n en cascada:\n`;
    if (adicionalesVinculados.length > 0) {
      confirmMessage += ` ? ${adicionalesVinculados.length} adicional(es) de obra vinculado(s):\n`;
      adicionalesVinculados.forEach(a => { confirmMessage += `     - "${a.nombreObra || a.nombre}"\n`; });
    }
    if (totalTareas > 0) {
      confirmMessage += ` ? ${totalTareas} tarea(s) leve vinculada(s)\n`;
    }
    confirmMessage += ` ? Todos los profesionales asignados\n`;
    confirmMessage += ` ? Todos los presupuestos asociados\n`;
    confirmMessage += ` ? Todos los cobros registrados\n`;
    confirmMessage += ` ? Todos los costos de obra\n\n`;
    confirmMessage += `Esta acci?n NO se puede deshacer.`;

    if (!window.confirm(confirmMessage)) return;

    try {
      showNotification('Eliminando obra...', 'info');

      // Usar el nuevo endpoint de eliminaci?n en cascada
      const response = await fetch(`/api/obras/${id}/cascade?empresaId=${empresaId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        let errorMsg = 'Error eliminando obra';
        try {
          const errorData = await response.json();
          errorMsg = errorData.mensaje || errorData.message || errorMsg;
        } catch (e) {
          // Si no es JSON, intentar leer como texto
          const errorText = await response.text();
          errorMsg = errorText || `Error ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMsg);
      }

      const resultado = await response.json();
      console.log('Resultado de eliminaci?n:', resultado);

      // El backend ahora retorna simplemente { mensaje: "..." }
      const mensajeExito = resultado.mensaje || 'Obra eliminada exitosamente';

      showNotification(mensajeExito, 'success');

      // Recargar la lista (esto actualizar? Redux autom?ticamente)
      await cargarObrasSegunFiltro();
      setSelectedObraId(null);

    } catch (error) {
      console.error('Error eliminando obra:', error);

      // Mejorar el mensaje de error para el usuario
      let mensajeError = error.message;

      if (mensajeError.includes('integridad de datos') || mensajeError.includes('constraint')) {
        mensajeError = 'No se puede eliminar la obra porque tiene datos relacionados.\n\n' +
          'Registros relacionados:\n' +
          '- Presupuestos asociados\n' +
          '- Cobros registrados\n' +
          '- Pagos a profesionales\n' +
          '- Asignaciones de personal\n\n' +
          'Elimine primero estos registros o contacte al administrador del sistema.';
      } else if (mensajeError.includes('404')) {
        mensajeError = 'La obra no existe o ya fue eliminada.';
      }

      showNotification(mensajeError, 'error');
    }
  };

  const handleCambiarEstado = async (id, nuevoEstado) => {
    try {
      await dispatch(cambiarEstadoObra({ id, estado: nuevoEstado })).unwrap();
      showNotification(`Estado cambiado a ${nuevoEstado}`, 'success');
      setMostrarModalCambiarEstado(false);
      // Recargar obras
      cargarObrasSegunFiltro();
    } catch (error) {
      showNotification('Error cambiando estado', 'error');
    }
  };

  const confirmarCambioEstado = () => {
    if (!selectedObraId || !nuevoEstadoSeleccionado) {
      showNotification('Seleccione un estado v?lido', 'warning');
      return;
    }

    const obra = obras.find(o => o.id === selectedObraId);
    if (obra && nuevoEstadoSeleccionado !== obra.estado) {
      handleCambiarEstado(selectedObraId, nuevoEstadoSeleccionado);
    } else {
      setMostrarModalCambiarEstado(false);
      showNotification('No se realizaron cambios', 'info');
    }
  };

  const handleCargarEstadisticas = async () => {
    // Alternar mostrar dropdown de estad?sticas
    setMostrarDropdownEstadisticas(!mostrarDropdownEstadisticas);
  };

  const handleVerEstadisticasObraSeleccionada = () => {
    if (!selectedObraId) {
      showNotification('Por favor, seleccione una obra primero', 'warning');
      return;
    }

    const obra = obras.find(o => o.id === selectedObraId);
    if (obra) {
      setObraParaEstadisticas(obra);
      setMostrarModalEstadisticasObra(true);
      setMostrarDropdownEstadisticas(false);
    }
  };

  const handleVerEstadisticasTodasObras = () => {
    if (!obras || obras.length === 0) {
      showNotification('No hay obras para mostrar estad?sticas', 'warning');
      return;
    }

    setMostrarModalEstadisticasTodasObras(true);
    setMostrarDropdownEstadisticas(false);
  };

  const handleCargarProfesionales = async (obraId) => {
    try {
      await dispatch(fetchProfesionalesAsignados({ obraId, empresaId })).unwrap();
      showNotification('Profesionales asignados cargados', 'success');
    } catch (error) {
      showNotification('Error cargando profesionales asignados', 'error');
    }
  };

  const handleBuscarPorCliente = () => {
    if (busquedaData.clienteId) {
      showNotification(`Buscando obras del cliente...`, 'info');
      dispatch(fetchObrasPorCliente(busquedaData.clienteId))
        .unwrap()
        .then(obras => {
          if (!obras || obras.length === 0) {
            showNotification('No hay obras para este cliente', 'warning');
          }
        })
        .catch(error => {
          showNotification('Error buscando obras del cliente: ' + error, 'error');
        });
    } else {
      showNotification('Seleccione un cliente para buscar', 'warning');
    }
  };

  // ==================== FUNCIONES MODALES PRESUPUESTO UNIFICADO ====================

  /**
   * Cerrar modal de presupuesto unificado
   */
  const cerrarModalPresupuesto = () => {
    setModalPresupuesto({
      mostrar: false,
      tipo: null,
      contexto: {},
      datosIniciales: null
    });
    setTrabajoAdicionalEditar(null);
    // Limpiar profesionales seleccionados
    setProfesionalesSeleccionados([]);
    setProfesionalesAdhoc([]);
  };

  /**
   * Abrir modal para Obra Principal (PRINCIPAL)
   */
  const abrirModalObraPrincipal = () => {
    setModalPresupuesto({
      mostrar: true,
      tipo: TIPOS_PRESUPUESTO.PRINCIPAL,
      contexto: {},
      datosIniciales: null
    });
  };

  /**
   * Abrir modal para Trabajo Diario - Nuevo Cliente (TRABAJO_DIARIO)
   */
  const abrirModalTrabajoDiario = () => {
    setMostrarModalTrabajoDiario(true);
  };

  /**
   * Guardar trabajo diario (obra independiente sin presupuesto previo)
   */
  const handleGuardadoTrabajoDiario = async (datosPresupuesto) => {
    try {
      console.log('?? Guardando trabajo diario:', datosPresupuesto);

      const presupuestoData = {
        ...datosPresupuesto,
        esPresupuestoTrabajoExtra: false, // No es trabajo extra
        idEmpresa: empresaSeleccionada?.id || datosPresupuesto.idEmpresa
      };

      console.log('?? Creando nuevo trabajo diario');
      const response = await api.presupuestosNoCliente.create(presupuestoData, empresaSeleccionada.id);
      console.log('? Trabajo diario creado:', response);
      showNotification('? Trabajo diario creado exitosamente', 'success');

      // Cerrar modal
      setMostrarModalTrabajoDiario(false);

      // Recargar obras
      await dispatch(fetchObrasPorEmpresa(empresaId));
      cargarObrasSegunFiltro();

      // ??? AUTO-GENERAR OBRA SI EL PRESUPUESTO EST? APROBADO
      if (presupuestoData.estado === 'APROBADO') {
        console.log('??? Presupuesto APROBADO detectado - Generando obra autom?ticamente...');
        try {
          const presupuestoId = response?.data?.id || response?.id;

          const obraData = {
            nombre: presupuestoData.nombreObra || presupuestoData.nombreObraManual || `Trabajo Diario #${presupuestoId}`,
            direccion: presupuestoData.direccionObraCalle || 'Direcci?n no especificada',
            direccionObraCalle: presupuestoData.direccionObraCalle || '',
            direccionObraAltura: presupuestoData.direccionObraAltura || '',
            direccionObraBarrio: presupuestoData.direccionObraBarrio || '',
            direccionObraLocalidad: presupuestoData.direccionObraLocalidad || '',
            direccionObraProvincia: presupuestoData.direccionObraProvincia || '',
            direccionObraCodigoPostal: presupuestoData.direccionObraCodigoPostal || '',
            idEmpresa: empresaId,
            clienteId: presupuestoData.clienteId,
            estado: 'APROBADO',
            nombreSolicitante: presupuestoData.nombreSolicitante || '',
            telefono: presupuestoData.telefono || '',
            mail: presupuestoData.mail || '',
            presupuestoOriginalId: presupuestoId,
            observaciones: `Obra generada autom?ticamente desde trabajo diario aprobado #${presupuestoId}.\n${presupuestoData.observaciones || ''}`
          };

          await dispatch(createObra({ obra: obraData, empresaId })).unwrap();
          console.log('? Obra creada autom?ticamente');
          showNotification('? Presupuesto aprobado y obra creada autom?ticamente', 'success');
          await dispatch(fetchObrasPorEmpresa(empresaId));
        } catch (errorObra) {
          console.error('? Error al crear obra autom?ticamente:', errorObra);
        }
      }
    } catch (error) {
      console.error('? Error al guardar trabajo diario:', error);
      showNotification('? Error al guardar trabajo diario: ' + (error.message || 'Error desconocido'), 'error');
    }
  };

  /**
   * Abrir modal para Adicional Obra (TRABAJO_EXTRA)
   * @param {Object} obra - Obra padre
   */
  const abrirModalAdicionalObra = (obra) => {
    setModalPresupuesto({
      mostrar: true,
      tipo: TIPOS_PRESUPUESTO.TRABAJO_EXTRA,
      contexto: {
        obraId: obra.id,
        obraNombre: obra.nombre || obra.nombreObra
      },
      datosIniciales: null
    });
  };

  /**
   * Abrir modal para Tarea Leve con PresupuestoNoClienteModal (directo)
   * @param {Object} obra - Obra padre
   */
  const abrirModalTareaLeveDirecto = (obra) => {
    console.log('?? Abriendo modal Tarea Leve (PresupuestoNoClienteModal) para obra:', obra);
    setObraParaTareaLeve(obra);
    setMostrarModalTareaLeve(true);
  };

  /**
   * Guardar tarea leve (desde PresupuestoNoClienteModal)
   */
  const handleGuardadoTareaLeve = async (datosPresupuesto) => {
    try {
      console.log('?? Guardando tarea leve:', datosPresupuesto);

      // Determinar vinculaci?n seg?n el  informe del backend
      // REGLA XOR: Solo uno de (obraId, trabajoAdicionalId) debe tener valor
      const esTrabajoAdicional = obraParaTareaLeve?._esTrabajoAdicional || obraParaTareaLeve?._esTrabajoExtra;
      const trabajoAdicionalId = esTrabajoAdicional ? obraParaTareaLeve._trabajoAdicionalId || obraParaTareaLeve._trabajoExtraId : null;
      const obraId = esTrabajoAdicional ? null : (obraParaTareaLeve?.id || null);

      const presupuestoData = {
        ...datosPresupuesto,
        esPresupuestoTrabajoExtra: false,
        // Campos seg?n nueva especificaci?n del backend
        obraId: obraId,
        idObra: obraId,  // Mantener compatibilidad
        trabajoAdicionalId: trabajoAdicionalId,  // ? Nuevo campo del backend
        idEmpresa: empresaSeleccionada?.id || datosPresupuesto.idEmpresa
      };

      // ?? DEBUG: Verificar regla XOR (solo uno debe tener valor)
      console.log('?? Validaci?n XOR TAREA_LEVE:', {
        obraId: presupuestoData.obraId,
        trabajoAdicionalId: presupuestoData.trabajoAdicionalId,
        cumpleXOR: (presupuestoData.obraId != null) !== (presupuestoData.trabajoAdicionalId != null)
      });

      // ?? DEBUG: Verificar si los campos de direcci?n est?n presentes
      console.log('?? Datos de direcci?n en TAREA_LEVE:', {
        direccionObraCalle: presupuestoData.direccionObraCalle,
        direccionObraAltura: presupuestoData.direccionObraAltura,
        direccionObraBarrio: presupuestoData.direccionObraBarrio,
        nombreObra: presupuestoData.nombreObra || presupuestoData.nombreObraManual,
        vinculadoA: trabajoAdicionalId ? `TrabajoAdicional ${trabajoAdicionalId}` : `Obra ${obraId}`
      });

      let response;
      if (datosPresupuesto.id) {
        // Editar tarea leve existente
        console.log('?? Actualizando tarea leve existente:', datosPresupuesto.id);
        response = await api.presupuestosNoCliente.update(datosPresupuesto.id, presupuestoData, empresaSeleccionada.id);
        console.log('? Tarea leve actualizada:', response);
        showNotification('? Tarea leve actualizada exitosamente', 'success');
      } else {
        // Crear nueva tarea leve
        console.log('?? Creando nueva tarea leve');
        response = await api.presupuestosNoCliente.create(presupuestoData, empresaSeleccionada.id);
        console.log('? Tarea leve creada:', response);
        showNotification('? Tarea leve creada exitosamente', 'success');
      }

      // Cerrar modal
      setMostrarModalTareaLeve(false);
      setObraParaTareaLeve(null);
      setTareaLeveEditando(null);

      // Recargar obras y trabajos adicionales
      await dispatch(fetchObrasPorEmpresa(empresaId));
      cargarObrasSegunFiltro();

      // Recargar lista de trabajos adicionales si est? abierta
      if (obraParaTrabajosAdicionales) {
        await cargarTrabajosAdicionales(obraParaTrabajosAdicionales.id);
      }
    } catch (error) {
      console.error('? Error al guardar tarea leve:', error);
      showNotification('? Error al guardar tarea leve: ' + (error.message || 'Error desconocido'), 'error');
    }
  };

  /**
   * Abrir modal para Tarea Leve HIJA (de obra principal)
   * @param {Object} obra - Obra padre
   */
  const abrirModalTareaLeveHija = (obra) => {
    console.log('?? Abriendo modal Tarea Leve HIJA para obra:', obra);
    setObraParaTareaLeve(obra);
    setTareaLeveEditando(null); // Nueva tarea, sin datos existentes
    setMostrarModalTareaLeve(true);
  };

  /**
   * Abrir modal para Tarea Leve NIETA (de trabajo extra)
   * @param {Object} obra - Obra abuelo
   * @param {Object} trabajoExtra - Trabajo extra padre
   * @param {Object} tareaExistente - Tarea existente para edici?n (opcional)
   */
  const abrirModalTareaLeveNieta = (obra, trabajoExtra, tareaExistente = null) => {
    console.log(' Abriendo modal Tarea Leve NIETA para trabajo extra:', trabajoExtra, tareaExistente ? '(Editar)' : '(Nueva)');
    //  Usar PresupuestoNoClienteModal con contexto de trabajo extra
    setObraParaTareaLeve({
      ...obra,
      _esTrabajoExtra: true,
      _esTrabajoAdicional: true,  // ? Nueva nomenclatura
      _trabajoExtraId: trabajoExtra.id,  // Legacy
      _trabajoAdicionalId: trabajoExtra.id,  // ? Nuevo campo del backend
      _trabajoExtraNombre: trabajoExtra.nombre || trabajoExtra.nombreObra
    });
    setTareaLeveEditando(tareaExistente);
    setMostrarModalTareaLeve(true);
  };

  /**
   * Guardar presupuesto (crear o actualizar)
   * Handler unificado para todos los tipos de presupuesto
   */
  const handleGuardarPresupuesto = async (datos) => {
    try {
      console.log('?? Guardando presupuesto:', datos);

      const config = getConfigPresupuesto(datos.tipoPresupuesto);
      showNotification(`Guardando ${config.label}...`, 'info');

      // Usar servicio unificado
      const resultado = await presupuestoService.crearPresupuesto(
        datos,
        empresaId
      );

      console.log('? Presupuesto creado:', resultado);

      // Recargar listas
      await loadObras();
      await cargarTrabajosAdicionales();

      // Notificaci?n de ?xito
      showNotification(
        `? ${config.label} creado correctamente`,
        'success'
      );

      return resultado;
    } catch (error) {
      console.error('? Error al crear presupuesto:', error);
      const mensaje = error.response?.data?.message || error.message || 'Error desconocido';
      showNotification(`Error al guardar: ${mensaje}`, 'error');
      throw error;
    }
  };

  // ==================== FUNCIONES TRABAJOS EXTRA ====================

  /**
   * ?? Normaliza datos de trabajo extra desde BD
   * Mapea obra_id ? obraId para consistencia del frontend
   */
  const normalizarTrabajoExtra = (trabajo) => {
    if (!trabajo) return null;
    return {
      ...trabajo,
      // ?? Asegurar que tenga obraId mapeado desde obra_id si viene de BD
      obraId: trabajo.obraId ?? trabajo.obra_id ?? null,
      idObra: trabajo.idObra ?? trabajo.obra_id ?? null
    };
  };

  /**
   * ?? Extrae profesionales, materiales y gastos de itemsCalculadora[]
   * Para trabajos extra, estos datos est?n en el JSON, NO en tablas relacionales
   */
  const extraerDatosDeItemsCalculadora = (trabajo) => {
    const profesionales = [];
    const materiales = [];
    const gastosGenerales = [];

    if (!trabajo.itemsCalculadora || !Array.isArray(trabajo.itemsCalculadora)) {
      console.log(`  ?? Trabajo ${trabajo.id}: No tiene itemsCalculadora`);
      return { profesionales, materiales, gastosGenerales };
    }

    console.log(`  ?? Trabajo ${trabajo.id}: Procesando ${trabajo.itemsCalculadora.length} items de calculadora`);

    trabajo.itemsCalculadora.forEach((item, idx) => {
      // Extraer profesionales del item
      if (item.profesionales && Array.isArray(item.profesionales) && item.profesionales.length > 0) {
        console.log(`    Item ${idx}: ${item.profesionales.length} profesionales encontrados`);
        item.profesionales.forEach(prof => {
          profesionales.push({
            id: prof.profesionalObraId || prof.id || `temp_${Date.now()}_${Math.random()}`,
            profesionalObraId: prof.profesionalObraId || prof.id,
            nombreCompleto: prof.nombreCompleto || prof.nombre || 'Sin nombre',
            rol: prof.rol || item.tipoProfesional || 'Profesional',
            tipoProfesional: prof.rol || item.tipoProfesional || 'Profesional',
            cantidadJornales: prof.cantidadJornales || 0,
            valorJornal: prof.valorJornal || 0,
            subtotal: prof.subtotal || 0,
            observaciones: prof.observaciones || null
          });
        });
      }

      // Extraer materiales del item
      if (item.materialesLista && Array.isArray(item.materialesLista) && item.materialesLista.length > 0) {
        console.log(`    Item ${idx}: ${item.materialesLista.length} materiales encontrados`);
        item.materialesLista.forEach(mat => {
          materiales.push({
            id: mat.obraMaterialId || mat.id || `temp_${Date.now()}_${Math.random()}`,
            obraMaterialId: mat.obraMaterialId || mat.id,
            nombre: mat.nombre || 'Material sin nombre',
            descripcion: mat.descripcion || '',
            unidad: mat.unidad || 'unidad',
            cantidad: mat.cantidad || 0,
            precio: mat.precio || 0,
            subtotal: mat.subtotal || 0,
            observaciones: mat.observaciones || null
          });
        });
      }

      // Extraer gastos generales del item
      if (item.gastosGenerales && Array.isArray(item.gastosGenerales) && item.gastosGenerales.length > 0) {
        console.log(`    Item ${idx}: ${item.gastosGenerales.length} gastos encontrados`);
        item.gastosGenerales.forEach(gasto => {
          gastosGenerales.push({
            id: gasto.id || `temp_${Date.now()}_${Math.random()}`,
            descripcion: gasto.descripcion || 'Gasto sin descripci?n',
            cantidad: gasto.cantidad || 1,
            precioUnitario: gasto.precioUnitario || 0,
            subtotal: gasto.subtotal || 0,
            observaciones: gasto.observaciones || null
          });
        });
      }
    });

    console.log(`  ? Trabajo ${trabajo.id}: Extra?dos ${profesionales.length} profesionales, ${materiales.length} materiales, ${gastosGenerales.length} gastos`);

    return { profesionales, materiales, gastosGenerales };
  };

  const cargarTrabajosExtra = async (obra) => {
    if (!obra) {
      console.warn(' No hay obra para cargar trabajos extra');
      return;
    }

    try {
      setLoadingTrabajosExtra(true);
      // ?? Usar _obraOriginalId si estamos dentro de un trabajo extra, sino usar id directamente
      const obraIdParaAPI = obra._obraOriginalId || obra.id;
      const data = await api.presupuestosNoCliente.getAll(empresaSeleccionada.id, { obraId: obraIdParaAPI, esPresupuestoTrabajoExtra: true });

      // ✅ FILTRAR solo los que son trabajos extra (backend puede no estar filtrando correctamente)
      // ✅ EXCLUIR tareas leves que tienen esPresupuestoTrabajoExtra pero son tipo TAREA_LEVE
      const soloTrabajosExtra = (Array.isArray(data) ? data : []).filter(p =>
        (p.esPresupuestoTrabajoExtra === true || p.esPresupuestoTrabajoExtra === 'V') &&
        p.tipoPresupuesto === 'TRABAJO_EXTRA'
      );

      // ?? Normalizar datos para asegurar que tienen obraId
      const dataNormalizada = soloTrabajosExtra.map(normalizarTrabajoExtra);

      // ? EXTRAER DATOS DE ITEMSCALCULADORA para trabajos extra
      // Los trabajos extra NO usan tablas relacionales, todo est? en itemsCalculadora[]
      const trabajosEnriquecidos = await Promise.all(dataNormalizada.map(async (trabajo) => {
        try {
          // ?? EXTRAER profesionales, materiales y gastos de itemsCalculadora[]
          const { profesionales: profesionalesReales, materiales: materialesReales, gastosGenerales: gastosReales } =
            extraerDatosDeItemsCalculadora(trabajo);

          // NOTA: Para trabajos extra, NO llamamos a APIs relacionales
          // porque los datos YA EST?N en itemsCalculadora[] que viene del backend

          return {
            ...trabajo,
            profesionales: profesionalesReales,
            materiales: materialesReales,
            gastosGenerales: gastosReales,
            etapasDiarias: trabajo.etapasDiarias || [],
            dias: trabajo.dias || []
          };
        } catch (error) {
          console.error(`? Error procesando trabajo extra ${trabajo.id}:`, error);
          // En caso de error, devolver el trabajo sin asignaciones
          return {
            ...trabajo,
            profesionales: [],
            materiales: [],
            gastosGenerales: [],
            etapasDiarias: trabajo.etapasDiarias || [],
            dias: trabajo.dias || []
          };
        }
      }));

      // ?? FILTRAR: Si estamos dentro de un trabajo extra gestionando sus sub-trabajos extra,
      // excluir el trabajo extra actual de la lista para evitar que aparezca a s? mismo
      let trabajosFiltrados = trabajosEnriquecidos;

      const esTrabajoExtra = obra._esTrabajoExtra || obra.esObraTrabajoExtra || obra.es_obra_trabajo_extra || obra.esTrabajoExtra;
      const trabajoExtraId = obra._trabajoExtraId || obra._trabajoAdicionalId;

      if (esTrabajoExtra && trabajoExtraId) {
        trabajosFiltrados = trabajosEnriquecidos.filter(t => {
          // Comparar con m?ltiples campos posibles para asegurar que excluimos el trabajo extra correcto
          const excluir = t.id === trabajoExtraId ||
                         t.id_trabajo_extra === trabajoExtraId ||
                         t.obraId === trabajoExtraId ||
                         (t.presupuestoNoClienteId && t.presupuestoNoClienteId === trabajoExtraId);
          return !excluir;
        });
      }

      setTrabajosExtra(trabajosFiltrados);
      setObraParaTrabajosExtra(obra);
    } catch (error) {
      console.error('Error cargando trabajos extra:', error);
      console.error('Error status:', error.status);
      console.error('Error response:', error.response);
      console.error('Error message:', error.message);

      // Verificar si es un error 404 (endpoint no implementado)
      if (error.status === 404 || error.response?.status === 404 || error.message?.includes('404')) {
        showNotification('�� El m?dulo de Trabajos Extra a?n no est? disponible en el backend', 'warning');
      } else {
        const errorMsg = error.response?.data?.message || error.message || 'Error desconocido';
        showNotification('Error al cargar trabajos extra: ' + errorMsg, 'error');
      }

      setTrabajosExtra([]);
      setObraParaTrabajosExtra(obra);
    } finally {
      setLoadingTrabajosExtra(false);
    }
  };

  const handleNuevoTrabajoExtra = () => {
    setTrabajoExtraEditar(null);
    setMostrarModalTrabajoExtra(true);
  };

  const handleEditarTrabajoExtra = (trabajo) => {
    console.log('?? Trabajo extra a editar:', trabajo);
    console.log('?? Fechas en trabajo:', {
      createdAt: trabajo.createdAt,
      updatedAt: trabajo.updatedAt,
      fechaProbableInicio: trabajo.fechaProbableInicio,
      vencimiento: trabajo.vencimiento
    });
    setTrabajoExtraEditar(trabajo);
    setMostrarModalTrabajoExtra(true);
  };

  const handleEliminarTrabajoExtra = async (trabajoId) => {
    const tareasVinculadas = Array.isArray(trabajosAdicionales)
      ? trabajosAdicionales.filter(ta => ta.trabajoExtraId === trabajoId)
      : [];

    const trabajoExtra = Array.isArray(trabajosExtra)
      ? trabajosExtra.find(te => te.id === trabajoId)
      : null;
    const nombreAdicional = trabajoExtra?.nombreObra || trabajoExtra?.nombre || `ID ${trabajoId}`;

    let confirmMessage = `?Est? seguro de eliminar el adicional de obra "${nombreAdicional}"?`;
    if (tareasVinculadas.length > 0) {
      confirmMessage += `\n\n?? ADVERTENCIA: Se eliminar?n en cascada:\n`;
      confirmMessage += ` ? ${tareasVinculadas.length} tarea(s) leve vinculada(s):\n`;
      tareasVinculadas.forEach(t => { confirmMessage += `     - "${t.nombre}"\n`; });
      confirmMessage += `\nEsta acci?n NO se puede deshacer.`;
    } else {
      confirmMessage += `\n\nEsta acci?n NO se puede deshacer.`;
    }

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await api.presupuestosNoCliente.delete(trabajoId, empresaSeleccionada.id);
      showNotification('Trabajo extra eliminado exitosamente', 'success');
      await cargarTrabajosExtra(obraParaTrabajosExtra);
    } catch (error) {
      console.error('Error eliminando trabajo extra:', error);

      if (error.status === 404 || error.response?.status === 404 || error.message?.includes('404')) {
        showNotification('�� El m?dulo de Trabajos Extra a?n no est? disponible en el backend', 'warning');
      } else {
        showNotification('Error al eliminar el trabajo extra: ' + (error.message || 'Error desconocido'), 'error');
      }
    }
  };

  const handleGuardadoTrabajoExtra = async (datosPresupuesto) => {
    try {
      console.log('?? Guardando trabajo extra como presupuestoNoCliente:', datosPresupuesto);
      console.log('?? Trabajo extra en edici?n:', trabajoExtraEditar);

      // ? USAR EL FORMATO DE PRESUPUESTO NO CLIENTE (el modal ya lo prepara correctamente)
      // El modal PresupuestoNoClienteModal ya env?a los datos en el formato correcto
      const presupuestoData = {
        ...datosPresupuesto,
        // ?? CR�TICO: Marcar como trabajo extra
        esPresupuestoTrabajoExtra: true,
        // Asegurar que tenga obraId
        obraId: obraParaTrabajosExtra?.id || datosPresupuesto.obraId,
        idObra: obraParaTrabajosExtra?.id || datosPresupuesto.idObra,
        // Empresa
        idEmpresa: empresaSeleccionada?.id || datosPresupuesto.idEmpresa
      };

      console.log('?? ObraId vinculada al trabajo extra:', presupuestoData.obraId, '(Obra:', obraParaTrabajosExtra?.nombre || 'sin nombre', ')');
      console.log('?? Datos para presupuesto no cliente (trabajo extra):', presupuestoData);

      let response;

      // Detectar si es edici?n o creaci?n
      if (trabajoExtraEditar && trabajoExtraEditar.id) {
        // EDITAR presupuesto existente (trabajo extra)
        console.log('?? Editando presupuesto trabajo extra ID:', trabajoExtraEditar.id);
        console.log('?? Empresa seleccionada ID:', empresaSeleccionada.id);

        // ?? SOLUCI�N CR�TICA: Obtener presupuesto completo del backend primero
        console.log('?? Obteniendo presupuesto completo del backend...');
        const presupuestoCompleto = await api.presupuestosNoCliente.getById(
          trabajoExtraEditar.id,
          empresaSeleccionada.id
        );
        console.log('? Presupuesto completo obtenido');

        // Hacer merge: todos los campos + cambios del usuario
        const presupuestoFinal = {
          ...presupuestoCompleto,  // ? Todos los campos del backend
          ...presupuestoData,      // ? Cambios del usuario
          id: trabajoExtraEditar.id // ? Asegurar ID
        };

        console.log('?? Enviando PUT a /api/v1/presupuestos-no-cliente/' + trabajoExtraEditar.id);
        response = await api.presupuestosNoCliente.update(
          trabajoExtraEditar.id,
          presupuestoFinal,
          empresaSeleccionada.id
        );
        console.log('? Presupuesto trabajo extra actualizado:', response);
        showNotification('Trabajo extra actualizado exitosamente', 'success');
      } else {
        // CREAR nuevo presupuesto (trabajo extra)
        console.log('? Creando nuevo presupuesto trabajo extra');
        console.log('?? Enviando POST a /api/v1/presupuestos-no-cliente');

        response = await api.presupuestosNoCliente.create(presupuestoData, empresaSeleccionada.id);
        console.log('? Presupuesto trabajo extra creado:', response);
        showNotification('Trabajo extra creado exitosamente', 'success');
      }

      // Recargar los trabajos extra (ahora desde presupuestos-no-cliente con filtro)
      console.log('?? Recargando trabajos extra para obra:', obraParaTrabajosExtra?.id, obraParaTrabajosExtra?.nombre);
      await cargarTrabajosExtra(obraParaTrabajosExtra);
      console.log('? Trabajos extra recargados correctamente');

      // ??? AUTO-GENERAR OBRA SI EL PRESUPUESTO EST? APROBADO
      if (presupuestoData.estado === 'APROBADO') {
        console.log('??? Presupuesto APROBADO detectado - Generando obra autom?ticamente...');
        try {
          // Obtener el ID del presupuesto guardado
          const presupuestoId = response?.data?.id || response?.id || trabajoExtraEditar?.id;

          const obraData = {
            nombre: presupuestoData.nombreObra || presupuestoData.nombreObraManual || `Trabajo Extra #${presupuestoId}`,
            direccion: presupuestoData.direccionObraCalle || obraParaTrabajosExtra?.direccion || 'Direcci?n no especificada',
            direccionObraCalle: presupuestoData.direccionObraCalle || '',
            direccionObraAltura: presupuestoData.direccionObraAltura || '',
            direccionObraBarrio: presupuestoData.direccionObraBarrio || '',
            direccionObraLocalidad: presupuestoData.direccionObraLocalidad || '',
            direccionObraProvincia: presupuestoData.direccionObraProvincia || '',
            direccionObraCodigoPostal: presupuestoData.direccionObraCodigoPostal || '',
            idEmpresa: empresaId,
            clienteId: presupuestoData.clienteId || obraParaTrabajosExtra?.clienteId,
            estado: 'APROBADO', // Obra en estado aprobado, lista para ejecuci?n
            esTrabajoExtra: true, // ?? Marcar como trabajo extra
            obraPadreId: obraParaTrabajosExtra?.id, // Referencia a la obra padre
            nombreSolicitante: presupuestoData.nombreSolicitante || '',
            telefono: presupuestoData.telefono || '',
            mail: presupuestoData.mail || '',
            // Referencias para trazabilidad
            presupuestoOriginalId: presupuestoId,
            observaciones: `Obra generada autom?ticamente desde trabajo extra aprobado #${presupuestoId}.\n${presupuestoData.observaciones || ''}`
          };

          console.log('?? Creando obra autom?ticamente:', obraData);
          const obraCreada = await dispatch(createObra({ obra: obraData, empresaId })).unwrap();
          console.log('? Obra creada autom?ticamente:', obraCreada);

          showNotification('? Presupuesto aprobado y obra creada autom?ticamente', 'success');

          // Recargar lista de obras principales para mostrar la nueva obra
          await dispatch(fetchObrasPorEmpresa(empresaId));
          console.log('? Lista de obras recargada');
        } catch (errorObra) {
          console.error('? Error al crear obra autom?ticamente:', errorObra);
          showNotification(
            ' Presupuesto guardado pero error al crear obra autom?ticamente: ' + (errorObra.message || 'Error desconocido'),
            'warning'
          );
        }
      }

      // Cerrar el modal
      setMostrarModalTrabajoExtra(false);
      setTrabajoExtraEditar(null);

      return response;
    } catch (error) {
      console.error('? Error al guardar trabajo extra:', error);
      console.error('? Detalles del error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      showNotification('Error al guardar el trabajo extra: ' + (error.message || 'Error desconocido'), 'error');
      throw error;
    }
  };

  // ? Funci?n para cambiar estado de trabajo extra
  const handleCambiarEstadoTrabajoExtra = async (trabajo, nuevoEstado) => {
    try {
      if (!window.confirm(`�Est?s seguro de cambiar el estado a ${nuevoEstado}?`)) return;

      // ?? Normalizar el trabajo antes de enviar
      const trabajoNormalizado = {
        ...normalizarTrabajoExtra(trabajo),
        estado: nuevoEstado
      };

      // Normalizar campos para evitar errores de validaci?n si faltan
      if (!trabajoNormalizado.nombre) trabajoNormalizado.nombre = trabajoNormalizado.nombreObra || 'Trabajo Extra';

      const response = await api.presupuestosNoCliente.update(trabajoNormalizado.id, {
        ...trabajoNormalizado,
        esPresupuestoTrabajoExtra: true
      }, empresaId);
      showNotification(`Estado actualizado a ${nuevoEstado}`, 'success');

      // Recargar lista
      if (obraParaTrabajosExtra) {
        cargarTrabajosExtra(obraParaTrabajosExtra);
      }
    } catch (error) {
      console.error('Error cambiando estado:', error);
      showNotification('Error al cambiar el estado', 'error');
    }
  };

  // ? Funci?n para enviar trabajo extra desde la tabla (abre modal de selecci?n WhatsApp/Email)
  const handleEnviarTrabajoExtraDesdeTabla = (trabajo) => {
    console.log('?? Iniciando env?o de trabajo extra desde tabla:', trabajo);

    // Configurar el trabajo seleccionado
    setTrabajoExtraSeleccionado(trabajo);

    // Abrir modal de selecci?n de env?o
    setMostrarModalSeleccionEnvioTrabajoExtra(true);
  };

  // ? Funci?n para generar obra derivada desde trabajo extra aprobado
  const handleGenerarObraDesdeTrabajoExtra = async (trabajo) => {
    try {
      console.log('=== INICIANDO APROBACION Y CREACION DE OBRA ===');
      console.log('Presupuesto recibido:', trabajo);
      console.log('Tipo:', trabajo.tipoPresupuesto);
      console.log('ID:', trabajo.id);

      if (!window.confirm('Desea aprobar este presupuesto y generar una nueva OBRA?')) {
        console.log('Usuario cancelo la operacion');
        return;
      }

      // Obtener el presupuesto COMPLETO del backend
      console.log('Obteniendo presupuesto completo del backend...');
      const presupuestoCompleto = await api.presupuestosNoCliente.getById(trabajo.id, empresaId);
      console.log('Presupuesto completo obtenido');
      console.log('Datos completos:', JSON.stringify(presupuestoCompleto, null, 2));

      const tipoPresupuesto = presupuestoCompleto.tipoPresupuesto;
      console.log('Tipo de presupuesto:', tipoPresupuesto);

      // Verificar duplicados
      console.log('Verificando si ya existe una obra para este presupuesto...');
      const obrasExistentes = await api.obras.obtenerObras({ empresaId });
      const yaExisteObra = obrasExistentes?.data?.some(o => o.presupuestoOriginalId === trabajo.id);

      if (yaExisteObra) {
        console.log('Ya existe una obra para este presupuesto ID:', trabajo.id);
        showNotification('Ya existe una obra creada para este presupuesto', 'warning');
        return;
      }
      console.log('No hay obra duplicada, se puede crear');

      // Actualizar estado a APROBADO
      console.log('Actualizando estado del presupuesto a APROBADO...');
      const presupuestoActualizado = {
        ...presupuestoCompleto,
        estado: 'APROBADO'
      };

      await api.presupuestosNoCliente.update(trabajo.id, presupuestoActualizado, empresaId);
      console.log('Estado actualizado a APROBADO en el backend');

      // Crear la obra segun el tipo de presupuesto
      let obraData = null;

      // TRABAJO_EXTRA y TAREA_LEVE: funcionan como "Adicional Obra" (obra derivada)
      if (tipoPresupuesto === 'TRABAJO_EXTRA' || tipoPresupuesto === 'TAREA_LEVE') {
        console.log('Creando obra DERIVADA (adicional) desde tipo:', tipoPresupuesto);

        // Determinar obraPadreId
        const obraPadreIdFinal = presupuestoCompleto.idObraPadre || presupuestoCompleto.obraId || obraParaTrabajosExtra?.id;
        console.log('Obra Padre ID:', obraPadreIdFinal);

        // Obtener clienteId de la obra padre si no lo tiene
        let clienteIdFinal = presupuestoCompleto.clienteId;
        if (!clienteIdFinal && obraPadreIdFinal) {
          try {
            console.log('Obteniendo cliente de obra padre...');
            const obraPadreResponse = await api.obras.obtenerPorId(obraPadreIdFinal, empresaId);
            const obraPadre = obraPadreResponse?.data || obraPadreResponse;
            clienteIdFinal = obraPadre?.clienteId;
            console.log('Cliente obtenido de obra padre:', clienteIdFinal);
          } catch (err) {
            console.warn('No se pudo obtener cliente de obra padre:', err);
          }
        }

        obraData = {
          nombre: presupuestoCompleto.nombreObra || presupuestoCompleto.nombreObraManual || `${tipoPresupuesto} #${trabajo.id}`,
          direccion: presupuestoCompleto.direccionObraCalle || obraParaTrabajosExtra?.direccion || 'Dirección no especificada',
          direccionObraCalle: presupuestoCompleto.direccionObraCalle || '',
          direccionObraAltura: presupuestoCompleto.direccionObraAltura || '',
          direccionObraBarrio: presupuestoCompleto.direccionObraBarrio || '',
          direccionObraLocalidad: presupuestoCompleto.direccionObraLocalidad || '',
          direccionObraProvincia: presupuestoCompleto.direccionObraProvincia || '',
          direccionObraCodigoPostal: presupuestoCompleto.direccionObraCodigoPostal || '',
          fechaProbableInicio: presupuestoCompleto.fechaProbableInicio || new Date().toISOString().split('T')[0],
          idEmpresa: empresaId,
          clienteId: clienteIdFinal,
          estado: 'APROBADO',
          esTrabajoExtra: true,
          obraPadreId: obraPadreIdFinal,
          nombreSolicitante: presupuestoCompleto.nombreSolicitante || '',
          telefono: presupuestoCompleto.telefono || '',
          mail: presupuestoCompleto.mail || '',
          presupuestoOriginalId: trabajo.id,
          observaciones: `Obra generada automaticamente desde ${tipoPresupuesto} aprobado #${trabajo.id}.\n${presupuestoCompleto.observaciones || ''}`
        };

        console.log('Obra DERIVADA (tipo adicional) configurada');
      }
      // TRABAJO_DIARIO y PRINCIPAL: funcionan como "Obra Principal" (obra independiente)
      else if (tipoPresupuesto === 'TRABAJO_DIARIO' || tipoPresupuesto === 'PRINCIPAL') {
        console.log('Creando obra PRINCIPAL (independiente) desde tipo:', tipoPresupuesto);

        obraData = {
          nombre: presupuestoCompleto.nombreObra || presupuestoCompleto.nombreObraManual || `${tipoPresupuesto} #${trabajo.id}`,
          direccion: presupuestoCompleto.direccionObraCalle || 'Dirección no especificada',
          direccionObraCalle: presupuestoCompleto.direccionObraCalle || '',
          direccionObraAltura: presupuestoCompleto.direccionObraAltura || '',
          direccionObraBarrio: presupuestoCompleto.direccionObraBarrio || '',
          direccionObraLocalidad: presupuestoCompleto.direccionObraLocalidad || '',
          direccionObraProvincia: presupuestoCompleto.direccionObraProvincia || '',
          direccionObraCodigoPostal: presupuestoCompleto.direccionObraCodigoPostal || '',
          fechaProbableInicio: presupuestoCompleto.fechaProbableInicio || new Date().toISOString().split('T')[0],
          idEmpresa: empresaId,
          clienteId: presupuestoCompleto.clienteId,
          estado: 'APROBADO',
          nombreSolicitante: presupuestoCompleto.nombreSolicitante || '',
          telefono: presupuestoCompleto.telefono || '',
          mail: presupuestoCompleto.mail || '',
          presupuestoOriginalId: trabajo.id,
          observaciones: `Obra generada automaticamente desde ${tipoPresupuesto} aprobado #${trabajo.id}.\n${presupuestoCompleto.observaciones || ''}`
        };

        console.log('Obra PRINCIPAL (independiente) configurada');
      }
      else {
        console.error('Tipo de presupuesto no reconocido:', tipoPresupuesto);
        showNotification('Tipo de presupuesto no valido: ' + tipoPresupuesto, 'error');
        return;
      }

      // Validar campos obligatorios antes de crear
      console.log('Validando datos de obra antes de crear...');
      console.log('📋 Datos finales de obra:', JSON.stringify(obraData, null, 2));

      if (!obraData.nombre) {
        console.error('❌ Falta nombre de obra');
        showNotification('❌ Error: Falta nombre de obra', 'error');
        return;
      }
      if (!obraData.clienteId) {
        console.error('❌ Falta clienteId');
        showNotification('❌ Error: Falta cliente', 'error');
        return;
      }

      console.log('Validacion OK - Creando obra en el backend...');
      const obraCreada = await dispatch(createObra({ obra: obraData, empresaId })).unwrap();
      console.log('=== OBRA CREADA EXITOSAMENTE ===');
      console.log('Obra creada:', obraCreada);

      showNotification('Presupuesto aprobado y obra creada automaticamente', 'success');

      // 5️⃣ Recargar listas
      console.log('🔄 Recargando lista de obras...');
      await dispatch(fetchObrasPorEmpresa(empresaId));

      if (obraParaTrabajosExtra) {
        console.log('🔄 Recargando trabajos extra de la obra...');
        await cargarTrabajosExtra(obraParaTrabajosExtra);
      }

      console.log('✅✅✅ PROCESO COMPLETADO EXITOSAMENTE ✅✅✅');

    } catch (error) {
      console.error('❌❌❌ ERROR EN EL PROCESO ❌❌❌');
      console.error('❌ Error:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error response:', error.response);
      console.error('❌ Error response data:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);

      const mensajeError = error.response?.data?.mensaje || error.response?.data?.error || error.message || 'Error desconocido';
      showNotification('❌ Error al generar la obra: ' + mensajeError, 'error');

      alert(`ERROR DETALLADO:\n\n${mensajeError}\n\nRevise la consola (F12) para más detalles.`);
    }
  };

  const handleSeleccionarObraParaTrabajosExtra = () => {
    if (!obraSeleccionadaTrabajosExtra) {
      showNotification('Seleccione una obra', 'warning');
      return;
    }

    setMostrarModalSeleccionarObraTrabajosExtra(false);
    setObraParaTrabajosExtra(obraSeleccionadaTrabajosExtra);
    setTrabajoExtraEditar(null);
    setMostrarModalTrabajoExtra(true);
    cargarTrabajosExtra(obraSeleccionadaTrabajosExtra);
    dispatch(setActiveTab('trabajos-extra'));
    setObraSeleccionadaTrabajosExtra(null); // Limpiar la selecci?n
  };

  // ==================== FUNCIONES ETAPAS DIARIAS ====================

  // Helper para parsear fechas ISO como fechas locales (evitar problemas de zona horaria)
  const parseFechaLocal = (fechaISO) => {
    if (!fechaISO) return null;
    const [year, month, day] = fechaISO.split('T')[0].split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0); // Mediod?a para evitar problemas de zona horaria
  };

  //  Feriados Argentina 2025-2026
  const feriadosArgentina = [
    '2025-01-01', // A?o Nuevo
    '2025-02-24', // Carnaval
    '2025-02-25', // Carnaval
    '2025-03-24', // D?a Nacional de la Memoria
    '2025-04-02', // D?a del Veterano
    '2025-04-17', // Jueves Santo (puente)
    '2025-04-18', // Viernes Santo
    '2025-05-01', // D?a del Trabajador
    '2025-05-25', // Revoluci?n de Mayo
    '2025-06-16', // D?a de G��emes
    '2025-06-20', // D?a de la Bandera
    '2025-07-09', // D?a de la Independencia
    '2025-08-15', // Paso a la Inmortalidad del Gral. San Mart?n (puente)
    '2025-08-17', // Paso a la Inmortalidad del Gral. San Mart?n
    '2025-10-12', // D?a del Respeto a la Diversidad Cultural (puente)
    '2025-10-13', // D?a del Respeto a la Diversidad Cultural
    '2025-11-24', // D?a de la Soberan?a Nacional
    '2025-12-08', // Inmaculada Concepci?n
    '2025-12-25', // Navidad
    '2026-01-01', // A?o Nuevo
    '2026-02-16', // Carnaval
    '2026-02-17', // Carnaval
    '2026-03-24', // D?a Nacional de la Memoria
    '2026-04-02', // D?a del Veterano
    '2026-04-03', // Viernes Santo
    '2026-05-01', // D?a del Trabajador
    '2026-05-25', // Revoluci?n de Mayo
    '2026-06-15', // D?a de G��emes (puente)
    '2026-06-20', // D?a de la Bandera
    '2026-07-09', // D?a de la Independencia
    '2026-08-17', // Paso a la Inmortalidad del Gral. San Mart?n
    '2026-10-12', // D?a del Respeto a la Diversidad Cultural
    '2026-11-23', // D?a de la Soberan?a Nacional (puente)
    '2026-12-08', // Inmaculada Concepci?n
    '2026-12-25', // Navidad
  ];

  const esFeriado = (fecha) => {
    const fechaStr = fecha.toISOString().split('T')[0];
    return feriadosArgentina.includes(fechaStr);
  };

  // Calcular fecha de finalizaci?n estimada (solo d?as h?biles, excluyendo feriados)
  const calcularFechaFinEstimada = (obra) => {
    const presupuesto = presupuestosObras[obra.id];

    if (!presupuesto) {
      return null;
    }

    const fechaProbableInicio = presupuesto.fechaProbableInicio;
    const tiempoEstimado = presupuesto.tiempoEstimadoTerminacion;

    if (!fechaProbableInicio || !tiempoEstimado) {
      return null;
    }

    // Parsear fecha como local (evitar problemas de zona horaria)
    const [year, month, day] = fechaProbableInicio.split('T')[0].split('-').map(Number);
    let fecha = new Date(year, month - 1, day);
    let diasContados = 0;

    // Contar d?as h?biles desde la fecha de inicio (lunes-viernes, excluyendo feriados)
    while (diasContados < tiempoEstimado) {
      const diaSemana = fecha.getDay();
      // Contar solo lunes(1) a viernes(5) que NO sean feriados
      if (diaSemana >= 1 && diaSemana <= 5 && !esFeriado(fecha)) {
        diasContados++;
      }
      // Si a?n no llegamos al total, avanzar un d?a
      if (diasContados < tiempoEstimado) {
        fecha.setDate(fecha.getDate() + 1);
      }
    }

    return fecha;
  };

  // Helper para parsear fechas evitando problemas de zona horaria (igual que en otros modales)
  const parsearFechaLocal = (fechaStr) => {
    if (!fechaStr) return new Date();
    if (typeof fechaStr !== 'string') {
      console.warn('parsearFechaLocal: fechaStr no es string:', fechaStr, typeof fechaStr);
      return fechaStr instanceof Date ? fechaStr : new Date();
    }
    if (fechaStr.includes('-')) {
      const soloFecha = fechaStr.split('T')[0];
      const [year, month, day] = soloFecha.split('-');
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 7, 0, 0);
    }
    return new Date(fechaStr);
  };

  // Helper para obtener configuraci?n de obra desde localStorage (sincr?nico)
  const obtenerConfiguracionObra = (obraId) => {
    // ? REPARADO: Verificar si la obra est? configurada (tiene presupuesto con tiempoEstimadoTerminacion)
    const presupuestoObra = presupuestosObras[obraId];

    // Una obra est? configurada si tiene presupuesto con tiempoEstimadoTerminacion definido
    if (presupuestoObra?.tiempoEstimadoTerminacion && parseInt(presupuestoObra.tiempoEstimadoTerminacion) > 0) {
      return presupuestoObra; // Retornar el presupuesto como configuraci?n
    }

    // Fallback: verificar si hay configuraci?n guardada en localStorage (de llamadas anteriores)
    try {
      const configGuardada = localStorage.getItem(`configuracionObra_${obraId}`);
      if (configGuardada) {
        return JSON.parse(configGuardada);
      }
    } catch (err) {
      console.warn(` Error leyendo configuraci?n de obra ${obraId} desde localStorage:`, err);
    }

    return null;
  };

  // Helper ASYNC para cargar configuraci?n desde BD y sincronizar con localStorage
  const cargarYSincronizarConfiguracion = async (obraId) => {
    try {
      // No cargar configuraci?n para tareas leves
      if (typeof obraId === 'string' && obraId.startsWith('ta_')) {
        console.log('?? [cargarYSincronizarConfiguracion] Saltando tarea leve:', obraId);
        return null;
      }

      // Intentar obtener presupuesto de la obra primero (fuente de verdad)
      let diasHabilesReales = null;
      let semanasRealesCalculadas = null;
      const presupuestoObra = presupuestosObras[obraId];

      if (presupuestoObra?.tiempoEstimadoTerminacion) {
        diasHabilesReales = parseInt(presupuestoObra.tiempoEstimadoTerminacion);
        console.log(`?? [ObrasPage] D?as h?biles desde presupuesto: ${diasHabilesReales}`);

        // ?? Calcular semanas reales considerando feriados si hay fecha de inicio
        if (presupuestoObra.fechaProbableInicio && diasHabilesReales > 0) {
          try {
            const fechaInicio = parsearFechaLocal(presupuestoObra.fechaProbableInicio);
            semanasRealesCalculadas = calcularSemanasParaDiasHabiles(fechaInicio, diasHabilesReales);
            console.log(`?? [ObrasPage] Semanas reales calculadas con feriados: ${semanasRealesCalculadas}`);
          } catch (error) {
            console.warn(' Error calculando semanas con feriados, usando fallback simple');
            semanasRealesCalculadas = convertirDiasHabilesASemanasSimple(diasHabilesReales);
          }
        }
      }

      // ✅ Si el presupuesto es GLOBAL (tradicional), no tiene asignaciones en el presupuesto
      // Las asignaciones se crean después en "Configuración y Planificación de Obra"
      if (presupuestoObra?.modoPresupuesto === 'TRADICIONAL') {
        console.log(`📋 [ObrasPage] Presupuesto GLOBAL - No cargando asignaciones desde presupuesto`);
        return null;
      }

      // Intentar obtener desde las asignaciones de BD (solo para presupuestos DETALLADOS)
      let asignaciones = [];
      try {
        const { obtenerAsignacionesSemanalPorObra } = await import('../services/profesionalesObraService');
        const asignacionesResponse = await obtenerAsignacionesSemanalPorObra(obraId, empresaId);
        asignaciones = Array.isArray(asignacionesResponse) ? asignacionesResponse : asignacionesResponse?.data || [];
      } catch (error) {
        // ✅ Error 404 es esperado para presupuestos GLOBAL o sin asignaciones - no fallar
        console.log(`📋 [ObrasPage] No se encontraron asignaciones para obra ${obraId} (esperado para modo GLOBAL)`);
        return null;
      }

      // Extraer semanas_objetivo de la primera asignaci?n
      if (asignaciones.length > 0 && asignaciones[0].semanasObjetivo) {
        const semanasObjetivoOriginal = parseInt(asignaciones[0].semanasObjetivo);

        // ?? PRIORIDAD:
        // 1. D?as h?biles del presupuesto (fuente de verdad)
        // 2. Semanas calculadas con feriados desde presupuesto
        // 3. Semanas desde BD
        // 4. Fallback: semanas � 5
        const diasHabiles = diasHabilesReales || (semanasObjetivoOriginal * 5);
        const semanasObjetivo = semanasRealesCalculadas || semanasObjetivoOriginal;

        const config = {
          semanasObjetivo,
          diasHabiles,
          capacidadNecesaria: 0, // Se puede calcular
          fechaInicio: null,
          fechaFinEstimada: null,
          jornalesTotales: 0
        };

        // Sincronizar con localStorage para uso inmediato
        localStorage.setItem(`configuracionObra_${obraId}`, JSON.stringify(config));
        console.log(`? [ObrasPage] Configuraci?n recuperada desde BD y guardada en localStorage:`, config);

        return config;
      }

      return null;
    } catch (err) {
      console.warn(' [ObrasPage] No se pudo cargar configuraci?n desde BD:', err);
      return null;
    }
  };

  // Funci?n para refrescar profesionales disponibles
  const refrescarProfesionalesDisponibles = async () => {
    if (!empresaId) return;

    setLoadingProfesionales(true);
    try {
      // 1. Obtener todos los profesionales
      const responseProfesionales = await api.profesionales.getAll(empresaId);
      const todosProfesionales = responseProfesionales.data || responseProfesionales || [];

      // 1.5. Filtrar solo profesionales activos (no de licencia/vacaciones)
      const profesionalesActivos = todosProfesionales.filter(prof =>
        prof.activo === true || prof.activo === 1
      );

      // 2. Obtener todas las asignaciones activas de todas las obras para filtrar disponibilidad
      try {
        // Obtener todas las obras activas de esta empresa
        const responseObras = await api.obras.getAll(empresaId);
        const todasObras = responseObras.data || responseObras || [];

        // Recolectar IDs de profesionales asignados a cualquier obra activa
        // Y contar cu?ntas obras tiene cada profesional
        const profesionalesAsignados = new Set();
        const contadorObrasPorProfesional = new Map(); // profesionalId -> cantidad de obras

        // Consultar asignaciones de cada obra
        const promesasAsignaciones = todasObras.map(async (obra) => {
          try {
            const response = await obtenerAsignacionesSemanalPorObra(obra.id, empresaId);
            const asignaciones = response.data || response || [];

            // Set para evitar contar el mismo profesional m?ltiples veces en la misma obra
            const profesionalesEnEstaObra = new Set();

            // Procesar cada asignaci?n para extraer profesionales
            asignaciones.forEach(asignacion => {
              // Estructura anidada: asignacionesPorSemana -> detallesPorDia
              if (asignacion.asignacionesPorSemana && Array.isArray(asignacion.asignacionesPorSemana)) {
                asignacion.asignacionesPorSemana.forEach(semana => {
                  if (semana.detallesPorDia && Array.isArray(semana.detallesPorDia)) {
                    semana.detallesPorDia.forEach(detalle => {
                      if (detalle.profesionalId && detalle.cantidad > 0) {
                        const profId = parseInt(detalle.profesionalId);
                        profesionalesAsignados.add(profId);
                        profesionalesEnEstaObra.add(profId);
                      }
                    });
                  }
                });
              }
            });

            // Incrementar contador para cada profesional en esta obra
            profesionalesEnEstaObra.forEach(profId => {
              contadorObrasPorProfesional.set(profId, (contadorObrasPorProfesional.get(profId) || 0) + 1);
            });

          } catch (errorObra) {
            // Si una obra falla, continuar con las dem?s
            console.warn(` Error obteniendo asignaciones para obra ${obra.id}:`, errorObra.message);
          }
        });

        // Esperar a que todas las consultas terminen
        await Promise.all(promesasAsignaciones);

        // Actualizar cantidadObrasAsignadas en cada profesional
        todosProfesionales.forEach(prof => {
          prof.cantidadObrasAsignadas = contadorObrasPorProfesional.get(prof.id) || 0;
        });

        // 3. Filtrar profesionales disponibles (activos Y no asignados a ninguna obra)
        const profesionalesDisponiblesActualizados = profesionalesActivos.filter(prof =>
          !profesionalesAsignados.has(prof.id)
        );

        console.log(`?? Profesionales actualizados: ${todosProfesionales.length} total, ${profesionalesActivos.length} activos, ${profesionalesAsignados.size} asignados, ${profesionalesDisponiblesActualizados.length} disponibles`);
        console.log(`?? IDs de profesionales asignados:`, Array.from(profesionalesAsignados));
        console.log(`?? Contador de obras por profesional:`, Object.fromEntries(contadorObrasPorProfesional));

        setProfesionalesDisponibles(profesionalesDisponiblesActualizados);

        // Emitir evento para que otros componentes se actualicen
        // Crear copia profunda para asegurar que React detecte el cambio
        const profesionalesParaEvento = todosProfesionales.map(prof => ({...prof}));
        console.log(`?? Emitiendo evento PROFESIONALES_ACTUALIZADOS con ${profesionalesParaEvento.length} profesionales`);

        eventBus.emit(FINANCIAL_EVENTS.PROFESIONALES_ACTUALIZADOS, {
          profesionales: profesionalesParaEvento,
          disponibles: profesionalesDisponiblesActualizados,
          asignados: Array.from(profesionalesAsignados),
          empresaId
        });

      } catch (errorAsignaciones) {
        console.warn(' Error obteniendo asignaciones para filtrar disponibilidad:', errorAsignaciones);
        // Si falla, mostrar todos los profesionales activos como fallback
        setProfesionalesDisponibles(profesionalesActivos);
      }

    } catch (error) {
      console.error('? Error refrescando profesionales disponibles:', error);
    } finally {
      setLoadingProfesionales(false);
    }
  };

  // Generar calendario autom?tico basado en jornales del presupuesto
  const generarCalendarioAutomatico = (obra) => {

    // USAR itemsCalculadora en lugar de detalles, pero permitir continuar si no existen
    const items = obra?.presupuestoNoCliente?.itemsCalculadora || obra?.presupuestoNoCliente?.detalles;

    // Sumar TODOS los jornales de todos los items (para referencia, pero NO se usa para calendario)
    const jornalesPresupuesto = items && Array.isArray(items)
      ? items.reduce((sum, item) => sum + (parseInt(item.cantidadJornales) || 0), 0)
      : 0;

    // ? Configuraci?n: SOLO para obras normales (trabajos extra NUNCA usan configuraci?n de obra)
    const configuracion = obra._esTrabajoExtra
      ? obra.configuracionPlanificacion || null
      : obtenerConfiguracionObra(obra.id);

    // ?? PRIORIZAR presupuesto sobre configuraci?n vieja
    let totalJornales;

    if (obra.presupuestoNoCliente?.tiempoEstimadoTerminacion > 0) {
      totalJornales = parseInt(obra.presupuestoNoCliente.tiempoEstimadoTerminacion);
    } else if (!obra._esTrabajoExtra && configuracion && configuracion.diasHabiles > 0) {
      // ? Solo obras normales pueden usar configuracion.diasHabiles (NUNCA trabajos extra)
      totalJornales = parseInt(configuracion.diasHabiles);
    } else {
      totalJornales = jornalesPresupuesto || 0;
    }

    // ?? LOG SIMPLE Y CLARO: Exactamente qu? se est? generando
    if (obra._esTrabajoExtra) {
      console.log(`?? [generarCalendarioAutomatico TE] Generando TRABAJO EXTRA con ${totalJornales} d?as h?biles (${Math.ceil(totalJornales / 5)} semanas)`);
    } else {
      console.log(`?? [generarCalendarioAutomatico OBRA] Generando obra con ${totalJornales} d?as h?biles (${Math.ceil(totalJornales / 5)} semanas)`);
    }

    // Permitir generaci?n si hay fecha probable de inicio y d?as h?biles > 0
    if (!obra.presupuestoNoCliente?.fechaProbableInicio || totalJornales === 0) {
      console.warn(' Faltan datos m?nimos para generar etapas autom?ticas (fecha probable de inicio o d?as h?biles)');
      return [];
    }

    // ��� Fecha de inicio: PRIORIDAD a fechaProbableInicio del presupuesto
    let fechaInicio = new Date();

    if (obra.presupuestoNoCliente?.fechaProbableInicio) {
      const fechaStr = obra.presupuestoNoCliente.fechaProbableInicio;
      fechaInicio = parsearFechaLocal(fechaStr);
    } else if (configuracion && configuracion.fechaInicio) {
      const fechaStr = configuracion.fechaInicio;
      fechaInicio = parsearFechaLocal(fechaStr);
    } else if (obra.fechaInicio) {
      const fechaStr = obra.fechaInicio;
      fechaInicio = parsearFechaLocal(fechaStr);
    }

    //  Ajustar al siguiente lunes si la fecha de inicio cae en fin de semana o feriado
    const diaSemana = fechaInicio.getDay();

    // Si es s?bado (6) o domingo (0), avanzar al lunes siguiente
    if (diaSemana === 0) { // Domingo
      fechaInicio.setDate(fechaInicio.getDate() + 1); // Lunes siguiente
    } else if (diaSemana === 6) { // S?bado
      fechaInicio.setDate(fechaInicio.getDate() + 2); // Lunes siguiente
    }

    // Si es feriado, avanzar al siguiente d?a h?bil
    while (esFeriado(fechaInicio) || fechaInicio.getDay() === 0 || fechaInicio.getDay() === 6) {
      fechaInicio.setDate(fechaInicio.getDate() + 1);
    }

    // Generar todos los d?as h?biles (lun-vie, excluyendo feriados)
    const diasHabiles = [];
    let fecha = new Date(fechaInicio);
    let diasGenerados = 0;

    while (diasGenerados < totalJornales) {
      const diaSemana = fecha.getDay();
      const fechaStr = fecha.toISOString().split('T')[0];

      // console.log(`  Evaluando ${fechaStr} (${fecha.toLocaleDateString('es-AR', { weekday: 'long' })}) - D?a semana: ${diaSemana}`);

      // Solo lun-vie (1-5) y NO feriados
      if (diaSemana >= 1 && diaSemana <= 5) {
        if (esFeriado(fecha)) {
          // console.log(`     Es feriado, omitiendo`);
        } else {
          // console.log(`     D?a h?bil #${diasGenerados + 1} agregado`);
          diasHabiles.push({
            fecha: fechaStr,
            diaSemana: fecha.toLocaleDateString('es-AR', { weekday: 'long' }),
            diaNumero: fecha.getDate(),
            mes: fecha.toLocaleDateString('es-AR', { month: 'short' }),
            tareas: [],
            estado: 'PENDIENTE'
          });
          diasGenerados++;
        }
      } else {
        // console.log(`     Fin de semana (${diaSemana === 0 ? 'domingo' : 's?bado'}), omitiendo`);
      }

      fecha.setDate(fecha.getDate() + 1);
    }

    // console.log(' Generaci?n completa:', diasGenerados, 'd?as h?biles');

    //  Agrupar por semanas CALENDARIO (lun-vie)
    const semanas = [];
    const diasPorSemana = {};

    // Agrupar d?as por su semana calendario
    diasHabiles.forEach((dia) => {
      const fecha = new Date(dia.fecha + 'T00:00:00');

      // Encontrar el lunes de esta semana
      const diaSemana = fecha.getDay();
      const diasDesdeElLunes = diaSemana === 0 ? 6 : diaSemana - 1; // Si es domingo, son 6 d?as desde el lunes
      const lunes = new Date(fecha);
      lunes.setDate(lunes.getDate() - diasDesdeElLunes);

      // Usar la fecha del lunes como clave ?nica para la semana
      const claveSemana = lunes.toISOString().split('T')[0];

      if (!diasPorSemana[claveSemana]) {
        diasPorSemana[claveSemana] = {
          lunes: lunes,
          dias: []
        };
      }

      diasPorSemana[claveSemana].dias.push(dia);
    });

    // Convertir el objeto a array y ordenar por fecha
    const clavesOrdenadas = Object.keys(diasPorSemana).sort();

    clavesOrdenadas.forEach((clave, index) => {
        const semanaData = diasPorSemana[clave];
        const lunesDate = semanaData.lunes;

        // ��� GENERAR TODOS LOS DÃAS DE LA SEMANA (lun-vie) para visualizaci?n completa
        // PERO solo hasta el ?ltimo d?a h?bil en la ?ltima semana
        const esUltimaSemana = index === clavesOrdenadas.length - 1;
        const ultimoDiaHabil = esUltimaSemana ? diasHabiles[diasHabiles.length - 1].fecha : null;

        const diasCompletos = [];
        for (let i = 0; i < 5; i++) { // 5 d?as: lun-vie
          const fecha = new Date(lunesDate);
          fecha.setDate(fecha.getDate() + i);
          const fechaStr = fecha.toISOString().split('T')[0];

          // NO generar d?as anteriores a la fecha de inicio configurada
          const fechaInicioStr = fechaInicio.toISOString().split('T')[0];
          if (fechaStr < fechaInicioStr) {
            continue; // Saltar este d?a - no mostrar d?as antes del inicio de obra
          }

          // Si es la ?ltima semana y ya pasamos el ?ltimo d?a h?bil, no generar m?s d?as
          if (esUltimaSemana && ultimoDiaHabil && fechaStr > ultimoDiaHabil) {
            break;
          }

          // Buscar si este d?a tiene trabajo asignado (es uno de los 20 d?as h?biles)
          const diaConTrabajo = semanaData.dias.find(d => d.fecha === fechaStr);

          if (diaConTrabajo) {
            // D?a h?bil con trabajo asignado
            diasCompletos.push(diaConTrabajo);
          } else {
            // Verificar si es feriado
            const esFeriadoDia = esFeriado(fecha);
            diasCompletos.push({
              fecha: fechaStr,
              diaSemana: fecha.toLocaleDateString('es-AR', { weekday: 'long' }),
              diaNumero: fecha.getDate(),
              mes: fecha.toLocaleDateString('es-AR', { month: 'short' }),
              tareas: [],
              estado: esFeriadoDia ? 'FERIADO' : 'FIN_DE_SEMANA',
              esFeriado: esFeriadoDia
            });
          }
        }

        // Debug desactivado - genera demasiados logs (144 semanas � 5 d?as = 720+ l?neas)
        // console.log(` Semana ${index + 1}:`, diasCompletos.length, 'd?as totales');
        // diasCompletos.forEach(d => {
        //   const tipo = d.esFeriado ? ' FERIADO' : (d.estado === 'FIN_DE_SEMANA' ? ' No laborable' : ` D?a h?bil`);
        //   console.log(`  - ${d.fecha} (${d.diaSemana}) - ${tipo}`);
        // });

        const viernes = new Date(lunesDate);
        viernes.setDate(viernes.getDate() + 4); // Viernes

        semanas.push({
          numero: index + 1,
          lunes: lunesDate,
          viernes: viernes,
          dias: diasCompletos
        });
      });

    // console.log(' Total de semanas generadas:', semanas.length);

    return semanas;
  };

  // Obtener etapas diarias con calendario pre-generado usando useMemo
  const calendarioCompleto = React.useMemo(() => {
    if (!obraParaEtapasDiarias) {
      console.log('�� No hay obra seleccionada para etapas');
      return [];
    }

    // ?? Si es trabajo extra, FORZAR el uso del presupuesto precargado ORIGINAL
    // NUNCA permitir que se lea o se actualice desde presupuestosObras
    let presupuestoFinalSeguro;

    if (obraParaEtapasDiarias._esTrabajoExtra) {
      // Trabajo extra: SIEMPRE usar presupuestoNoCliente original (precargado)
      // NUNCA buscar en presupuestosObras porque podr?a estar contaminado con la obra padre
      presupuestoFinalSeguro = obraParaEtapasDiarias.presupuestoNoCliente;

      // Log de diagn?stico (sin hardcodes de valores espec?ficos)
      if (!presupuestoFinalSeguro || !presupuestoFinalSeguro.tiempoEstimadoTerminacion) {
        console.warn(' ALERTA: Presupuesto de trabajo extra incompleto', presupuestoFinalSeguro);
      }
    } else {
      // Obra normal: usar del cache si est? disponible
      const presupuestoFinal = presupuestosObras[obraParaEtapasDiarias.id] || obraParaEtapasDiarias.presupuestoNoCliente;
      presupuestoFinalSeguro = presupuestoFinal;
    }

    console.log(`?? [calendarioCompleto] ${obraParaEtapasDiarias._esTrabajoExtra ? 'TRABAJO EXTRA' : 'OBRA'} - Presupuesto final: ${presupuestoFinalSeguro?.tiempoEstimadoTerminacion} d?as (${Math.ceil((presupuestoFinalSeguro?.tiempoEstimadoTerminacion || 0) / 5)} semanas)`);
    const obraConPresupuestoFinal = {
      ...obraParaEtapasDiarias,
      presupuestoNoCliente: presupuestoFinalSeguro
    };

    const semanasGeneradas = generarCalendarioAutomatico(obraConPresupuestoFinal);

    // console.log(' Semanas generadas:', semanasGeneradas.length);

    // Merge con etapas ya guardadas
    const resultado = semanasGeneradas.map(semana => ({
      ...semana,
      dias: semana.dias.map(dia => {
        const etapaExistente = etapasDiarias.find(e => e.fecha === dia.fecha);
        if (etapaExistente) {
          if (localStorage.getItem('debug_etapa')) {
            console.log(` MERGE para ${dia.fecha}:`, {
              calendarioDia: dia,
              backendEtapa: etapaExistente,
              merged: {
                descripcion: etapaExistente.descripcion,
                horaInicio: etapaExistente.horaInicio,
                horaFin: etapaExistente.horaFin
              }
            });
          }
          // Si existe etapa guardada, usar sus datos completos
          return {
            ...dia, // Mantener info del calendario (diaSemana, diaNumero, mes)
            ...etapaExistente, // Sobrescribir con datos del backend
            id: etapaExistente.id,
            descripcion: etapaExistente.descripcion || dia.descripcion || '',
            horaInicio: etapaExistente.horaInicio || dia.horaInicio || '',
            horaFin: etapaExistente.horaFin || dia.horaFin || '',
            tareas: etapaExistente.tareas || [],
            estado: etapaExistente.estado || 'PENDIENTE',
            observaciones: etapaExistente.observaciones || dia.observaciones || ''
          };
        }
        return {
          ...dia,
          tareas: [],
          estado: 'PENDIENTE'
        };
      })
    }));

    if (localStorage.getItem('debug_etapa')) {
      console.log(' Calendario completo generado:', resultado);
    }
    return resultado;
  }, [
    obraParaEtapasDiarias?.id,
    obraParaEtapasDiarias?._esTrabajoExtra, // ?? Detectar cuando es trabajo extra
    obraParaEtapasDiarias?._trabajoExtraId,
    // Para obras normales: escuchar cambios en cache de presupuestos
    obraParaEtapasDiarias?._esTrabajoExtra ? null : presupuestosObras[obraParaEtapasDiarias?.id]?.fechaProbableInicio,
    obraParaEtapasDiarias?._esTrabajoExtra ? null : presupuestosObras[obraParaEtapasDiarias?.id]?.tiempoEstimadoTerminacion,
    // Para trabajos extra: escuchar cambios en presupuesto congelado en cache
    obraParaEtapasDiarias?._esTrabajoExtra ? presupuestosObras[`te_${obraParaEtapasDiarias?._trabajoExtraId}`]?.tiempoEstimadoTerminacion : null,
    obraParaEtapasDiarias?._esTrabajoExtra ? presupuestosObras[`te_${obraParaEtapasDiarias?._trabajoExtraId}`]?.fechaProbableInicio : null,
    // Fallback: tambi?n escuchar cambios en presupuesto pre-cargado
    obraParaEtapasDiarias?._esTrabajoExtra ? obraParaEtapasDiarias?.presupuestoNoCliente?.tiempoEstimadoTerminacion : null,
    obraParaEtapasDiarias?._esTrabajoExtra ? obraParaEtapasDiarias?.presupuestoNoCliente?.fechaProbableInicio : null,
    etapasDiarias,
    calendarioVersion // Contador que se incrementa cuando se actualiza el presupuesto o la configuraci?n
  ]); // Regenerar cuando cambie la obra, las fechas del presupuesto, las etapas guardadas, o la configuraci?n

  const cargarEtapasDiarias = async (obra) => {
    if (!obra) {
      console.error(' No se recibi? obra para cargar etapas diarias');
      return;
    }

    if (!obra.id) {
      console.error(' La obra no tiene ID');
      showNotification('Error: La obra seleccionada no tiene ID v?lido', 'error');
      return;
    }

    try {
      setLoadingEtapasDiarias(true);

      // IMPORTANTE: Cargar el presupuestoNoCliente vinculado a la obra
      let obraCompleta = { ...obra };

      // ?? CORRECCI�N: Usar obraId real en lugar de ID del trabajo extra
      const obraIdReal = obra._obraOriginalId || obra.obraId || obra.id;
      console.log('?? [cargarEtapasDiarias] obra.id:', obra.id, '| obraIdReal:', obraIdReal, '| esTrabajoExtra:', obra._esTrabajoExtra);

      // ? Si es trabajo extra y ya tiene presupuesto pre-cargado, usarlo tal cual (NO sobrescribir)
      if (obra._esTrabajoExtra && obra.presupuestoNoCliente) {
        console.log('? [Trabajo Extra] Usando presupuesto pre-cargado (no buscar en backend)');
        obraCompleta.presupuestoNoCliente = obra.presupuestoNoCliente;

        // ?? TAMBI�N: Verificar si existe presupuesto congelado en cache y usar ESE en lugar del objeto
        const presupuestoCongelado = presupuestosObras[`te_${obra._trabajoExtraId}`];
        if (presupuestoCongelado) {
          console.log('? [Trabajo Extra] USANDO presupuesto CONGELADO del cache:', presupuestoCongelado.tiempoEstimadoTerminacion);
          obraCompleta.presupuestoNoCliente = presupuestoCongelado;
        }
      } else {
        // Solo para obras normales: buscar el presupuesto de mayor versi?n (ya sea en cache o backend)
        let presupuestoMayorVersion = null;
      if (presupuestosObras[obraIdReal]) {
        presupuestoMayorVersion = presupuestosObras[obraIdReal];
      } else {
        try {
          const response = await fetch(`/api/presupuestos-no-cliente/por-obra/${obraIdReal}`, {
            headers: {
              'empresaId': empresaId.toString(),
              'Content-Type': 'application/json'
            }
          });
          if (response.ok) {
            let presupuestos = await response.json();
            if (!Array.isArray(presupuestos)) presupuestos = [presupuestos];
            // Buscar el de mayor versi?n
            presupuestoMayorVersion = presupuestos.reduce((max, curr) =>
              (curr.numeroVersion > (max?.numeroVersion || 0) ? curr : max), presupuestos[0]
            );
            if (presupuestoMayorVersion) {
              // ?? BLOQUEO TOTAL: NUNCA tocar presupuestoNoCliente si es trabajo extra
              if (!obra._esTrabajoExtra) {
                obraCompleta.presupuestoNoCliente = presupuestoMayorVersion;

                // ✅ Calcular y guardar el total correcto
                const totalCalculado = obtenerTotalPresupuesto(presupuestoMayorVersion);
                setPresupuestosObras(prev => ({
                  ...prev,
                  [obra.id]: {
                    ...presupuestoMayorVersion,
                    totalPresupuestoCalculado: totalCalculado
                  }
                }));
              } else {
                console.log('?? [cargarEtapasDiarias] TRABAJO EXTRA - BLOQUEANDO sobrescritura de presupuestoNoCliente');
              }
            }
          } else {
            console.warn('�� No se pudo cargar presupuesto (HTTP', response.status, ')');
          }
        } catch (errorPresupuesto) {
          console.warn('�� Error cargando presupuesto de la obra:', errorPresupuesto);
        }
      }
        // ?? BLOQUEO TOTAL: NUNCA tocar presupuestoNoCliente si es trabajo extra
        if (presupuestoMayorVersion && !obra._esTrabajoExtra) {
          obraCompleta.presupuestoNoCliente = presupuestoMayorVersion;
        }
      }

      const data = await api.etapasDiarias.getAll(empresaSeleccionada.id, { obraId: obra.id });

      console.log('?? DATOS DEL BACKEND:', data);
      if (data && data.length > 0) {
        console.log('?? Primera etapa del backend - tareas:', data[0].tareas?.map(t => ({ desc: t.descripcion, estado: t.estado })));
      }

      // Cargar profesionales para convertir IDs a objetos
      let profesionalesMap = new Map();
      try {
        const profesionales = await api.profesionales.getAll(empresaSeleccionada.id);
        profesionalesMap = new Map(profesionales.map(p => [p.id, p]));
      } catch (error) {
        console.warn('No se pudieron cargar profesionales:', error);
      }

      // Convertir IDs de profesionales a objetos completos
      const etapasConProfesionales = Array.isArray(data) ? data.map(etapa => ({
        ...etapa,
        tareas: etapa.tareas
          ?.map(tarea => ({
            ...tarea,
            profesionales: Array.isArray(tarea.profesionales)
              ? tarea.profesionales
                  .map(profId => {
                    const id = typeof profId === 'object' ? profId.id : profId;
                    return profesionalesMap.get(id);
                  })
                  .filter(Boolean)
              : []
          }))
          .sort((a, b) => (a.id || 0) - (b.id || 0)) || [] // Ordenar por ID para mantener consistencia
      })) : [];

      if (localStorage.getItem('debug_etapa')) {
        console.log('??� BACKEND RESPONSE - Etapas Diarias:', JSON.stringify(data, null, 2));
        console.log('� Total etapas recibidas:', Array.isArray(data) ? data.length : 0);
      }
      setEtapasDiarias(etapasConProfesionales);
      console.log('?????? [cargarEtapasDiarias] ANTES de setObraParaEtapasDiarias:', {
        obraCompletaId: obraCompleta.id,
        esTrabajoExtra: obraCompleta._esTrabajoExtra,
        presupuestoNoClienteTimepo: obraCompleta.presupuestoNoCliente?.tiempoEstimadoTerminacion,
        presupuestoNoClienteFecha: obraCompleta.presupuestoNoCliente?.fechaProbableInicio,
        OBRA_COMPLETA: obraCompleta
      });

      // ?? PROTECCI�N CR�TICA: Guardar presupuesto de trabajo extra en cache etiquetado
      // Esto PREVIENE que el presupuesto se contamine despu?s de cerrar/reabrir
      if (obraCompleta._esTrabajoExtra && obraCompleta._trabajoExtraId && obraCompleta.presupuestoNoCliente) {
        console.log('?? [cargarEtapasDiarias] CONGELANDO presupuesto de trabajo extra en cache');
        setPresupuestosObras(prev => ({
          ...prev,
          [`te_${obraCompleta._trabajoExtraId}`]: obraCompleta.presupuestoNoCliente,
          // Tambi?n guardar con clave _metadata para recuperarlo despu?s
          [`te_${obraCompleta._trabajoExtraId}_meta`]: {
            tiempoEstimadoTerminacion: obraCompleta.presupuestoNoCliente.tiempoEstimadoTerminacion,
            fechaProbableInicio: obraCompleta.presupuestoNoCliente.fechaProbableInicio,
            timestamp: Date.now()
          }
        }));
      }

      setObraParaEtapasDiarias(obraCompleta);

    } catch (error) {
      console.error('Error cargando etapas diarias:', error);

      if (error.status === 404 || error.response?.status === 404 || error.message?.includes('404')) {
        showNotification('�� El m?dulo de Etapas Diarias a?n no est? disponible en el backend', 'warning');
      } else {
        showNotification('Error al cargar etapas diarias: ' + (error.message || 'Error desconocido'), 'error');
      }

      setEtapasDiarias([]);
      // Intentar asignar la obra aunque haya error
      let obraCompleta = { ...obra };
      try {
        const response = await fetch(`/api/presupuestos-no-cliente/por-obra/${obra.id}`, {
          headers: {
            'empresaId': empresaId.toString(),
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          let presupuestos = await response.json();
          if (!Array.isArray(presupuestos)) presupuestos = [presupuestos];

          const presupuestoAprobado = presupuestos
            .filter(p => p.estado === 'APROBADO')
            .sort((a, b) => b.version - a.version)[0];

          // ?? Bloquear sobrescritura de presupuesto para trabajos extra
          if (!obraCompleta._esTrabajoExtra) {
            if (presupuestoAprobado) {
              obraCompleta.presupuestoNoCliente = presupuestoAprobado;
            } else {
              const masReciente = presupuestos.sort((a, b) => b.version - a.version)[0];
              if (masReciente) obraCompleta.presupuestoNoCliente = masReciente;
            }
          }
        }
      } catch (errorPresupuesto) {
        console.warn('�� Error cargando presupuesto tras error:', errorPresupuesto);
      }
      setObraParaEtapasDiarias(obraCompleta);

    } finally {
      setLoadingEtapasDiarias(false);
    }
  };

  const handleAbrirDia = (dia) => {
    // Si el d?a ya tiene ID, es edici?n

    // Si el d?a ya tiene ID, es edici?n
    if (dia.id) {
      setEtapaDiariaEditar(dia);
    } else {
      // Nuevo d?a, pre-cargar fecha
      setEtapaDiariaEditar({ fecha: dia.fecha, tareas: [] });
    }
    setMostrarModalEtapaDiaria(true);
  };

  const handleNuevaEtapaDiaria = () => {
    setEtapaDiariaEditar(null);
    setMostrarModalEtapaDiaria(true);
  };

  const handleEditarEtapaDiaria = (etapa) => {
    setEtapaDiariaEditar(etapa);
    setMostrarModalEtapaDiaria(true);
  };

  const handleCambiarEstadoTareaRapido = async (e, dia, tareaIndex) => {
    e.stopPropagation(); // Evitar que abra el modal del d?a



    if (!dia.id) {
      showNotification('Debe guardar el d?a antes de cambiar estados de tareas', 'warning');
      return;
    }

    const tarea = dia.tareas[tareaIndex];

    let nuevoEstado;
    if (tarea.estado === 'PENDIENTE') {
      nuevoEstado = 'EN_PROCESO';
    } else if (tarea.estado === 'EN_PROCESO') {
      nuevoEstado = 'COMPLETADA';
    } else {
      nuevoEstado = 'PENDIENTE';
    }

    try {
      // Actualizar tarea en el backend
      const tareasActualizadas = dia.tareas.map((t, i) => {
        // Convertir profesionales de objetos a solo IDs
        const profesionalesIds = Array.isArray(t.profesionales)
          ? t.profesionales.map(p => typeof p === 'object' ? p.id : p)
          : [];

        if (i === tareaIndex) {
          // Actualizar solo el estado, preservando TODO lo dem?s (incluido el ID)
          return {
            id: t.id, // �� CRÃTICO: Incluir el ID para que el backend ACTUALICE en vez de CREAR
            descripcion: t.descripcion,
            estado: nuevoEstado,
            profesionales: profesionalesIds
          };
        }
        // Mantener las dem?s tareas sin cambios, con su ID
        return {
          id: t.id,
          descripcion: t.descripcion,
          estado: t.estado,
          profesionales: profesionalesIds
        };
      });

      console.log('?? Enviando al backend:', tareasActualizadas);

      const dataActualizar = {
        obraId: dia.obraId || obraParaEtapasDiarias.id,
        fecha: dia.fecha,
        descripcion: dia.descripcion || '',
        horaInicio: dia.horaInicio || '',
        horaFin: dia.horaFin || '',
        estado: dia.estado || 'PENDIENTE',
        tareas: tareasActualizadas,
        observaciones: dia.observaciones || ''
      };

      await api.etapasDiarias.update(dia.id, dataActualizar, empresaSeleccionada.id);

      // Recargar etapas
      await cargarEtapasDiarias(obraParaEtapasDiarias);
      showNotification(`Tarea marcada como: ${nuevoEstado.replace('_', ' ')}`, 'success');
    } catch (error) {
      console.error('Error actualizando estado de tarea:', error);
      showNotification('Error al actualizar estado: ' + (error.message || 'Error desconocido'), 'error');
    }
  };

  const handleEliminarEtapaDiaria = async (etapaId) => {
    if (!window.confirm('�Est? seguro de eliminar esta etapa diaria?')) {
      return;
    }

    try {
      await api.etapasDiarias.delete(etapaId, empresaSeleccionada.id);
      showNotification('Etapa diaria eliminada exitosamente', 'success');
      await cargarEtapasDiarias(obraParaEtapasDiarias);
    } catch (error) {
      console.error('Error eliminando etapa diaria:', error);

      if (error.status === 404 || error.response?.status === 404 || error.message?.includes('404')) {
        showNotification('�� El m?dulo de Etapas Diarias a?n no est? disponible en el backend', 'warning');
      } else {
        showNotification('Error al eliminar la etapa diaria: ' + (error.message || 'Error desconocido'), 'error');
      }
    }
  };

  const handleGuardadoEtapaDiaria = async () => {
    showNotification('Etapa diaria guardada exitosamente', 'success');
    await cargarEtapasDiarias(obraParaEtapasDiarias);
  };

  const getEtapasFiltradas = () => {
    if (filtroEstadoEtapa === 'TODAS') {
      return etapasDiarias;
    }
    return etapasDiarias.filter(e => e.estado === filtroEstadoEtapa);
  };

  const getEstadoBadgeClass = (estado) => {
    switch (estado) {
      case 'BORRADOR': return 'bg-secondary';
      case 'A_ENVIAR': return 'bg-info';
      case 'ENVIADO': return 'bg-primary';
      case 'APROBADO': return 'bg-success';
      case 'EN_EJECUCION': return 'bg-warning';
      case 'TERMINADO': return 'bg-success';
      case 'SUSPENDIDO': return 'bg-secondary';
      case 'CANCELADO': return 'bg-danger';
      default: return 'bg-dark';
    }
  };

  // Funciones para contar elementos de cada categor?a por obra
  const contarPresupuestosObra = (obraId) => {
    return contadoresObras[obraId]?.presupuestos || 0;
  };

  const contarTrabajosExtraObra = (obraId) => {
    return contadoresObras[obraId]?.trabajosExtra || 0;
  };

  const contarEtapasDiariasObra = (obraId) => {
    return contadoresObras[obraId]?.etapas || 0;
  };

  const contarProfesionalesAsignados = (obraId) => {
    const profesionales = contadoresObras[obraId]?.profesionales;
    // Si es un objeto con .count, retornarlo tal cual
    if (profesionales && typeof profesionales === 'object' && 'count' in profesionales) {
      return profesionales;
    }
    // Si es un n?mero simple, convertirlo a objeto
    return { count: profesionales || 0, asignaciones: [] };
  };

  const contarMaterialesAsignados = (obraId) => {
    return contadoresObras[obraId]?.materiales || 0;
  };

  const contarGastosAsignados = (obraId) => {
    return contadoresObras[obraId]?.gastos || 0;
  };

  // ? FUNCIONES HELPER PARA IDENTIFICAR TIPOS DE ENTIDADES
  /**
   * Determina si un objeto es un PresupuestoNoCliente de tipo TAREA_LEVE
   * @param {Object} obj - Objeto a verificar
   * @returns {boolean}
   */
  const esTareaLeve = (obj) => {
    return obj &&
           obj.tipoPresupuesto === 'TAREA_LEVE' &&
           obj.hasOwnProperty('numeroPresupuesto') &&
           obj.hasOwnProperty('fechaEmision');
  };

  /**
   * Determina si un objeto es un TrabajoAdicional real (entidad diferente a TAREA_LEVE)
   * @param {Object} obj - Objeto a verificar
   * @returns {boolean}
   */
  const esTrabajoAdicional = (obj) => {
    return obj &&
           !obj.hasOwnProperty('tipoPresupuesto') &&  // TrabajoAdicional NO tiene tipoPresupuesto
           obj.hasOwnProperty('importe') &&
           obj.hasOwnProperty('obraId');
  };

  // ? Funciones helper para TAREAS LEVES (PresupuestoNoCliente tipo TAREA_LEVE)
  const contarTareasLevesObra = (obraId) => {
    if (!Array.isArray(tareasLeves)) return 0;
    // Contar tareas leves vinculadas directamente a la obra (no a trabajos adicionales)
    const tareasDirectas = tareasLeves.filter(tl =>
      tl.obraId === obraId && !tl.trabajoAdicionalId
    );
    return tareasDirectas.length;
  };

  const contarTareasLevesTrabajoAdicional = (trabajoAdicionalId) => {
    if (!Array.isArray(tareasLeves)) return 0;
    return tareasLeves.filter(tl => tl.trabajoAdicionalId === trabajoAdicionalId).length;
  };

  const obtenerTareasLevesObra = (obraId) => {
    if (!Array.isArray(tareasLeves)) return [];
    // Filtrar tareas leves vinculadas directamente a la obra
    return tareasLeves.filter(tl => tl.obraId === obraId && !tl.trabajoAdicionalId);
  };

  const obtenerTareasLevesTrabajoAdicional = (trabajoAdicionalId) => {
    if (!Array.isArray(tareasLeves)) return [];
    // Filtrar tareas leves vinculadas a un trabajo adicional espec�fico
    return tareasLeves.filter(tl => tl.trabajoAdicionalId === trabajoAdicionalId);
  };

  // Funciones helper para TRABAJOS ADICIONALES (entidad TrabajoAdicional real)
  const contarTrabajosAdicionalesObra = (obraId) => {
    if (!Array.isArray(trabajosAdicionales)) return 0;
    // Solo contar trabajos adicionales DIRECTOS de la obra (sin trabajo extra intermedio)
    const trabajosDirectos = trabajosAdicionales.filter(ta => ta.obraId === obraId && !ta.trabajoExtraId);
    return trabajosDirectos.length;
  };

  const contarTrabajosAdicionalesTrabajoExtra = (trabajoExtraId) => {
    if (!Array.isArray(trabajosAdicionales)) return 0;
    return trabajosAdicionales.filter(ta => ta.trabajoExtraId === trabajoExtraId).length;
  };

  const obtenerTrabajosAdicionalesObra = (obraId) => {
    if (!Array.isArray(trabajosAdicionales)) return [];
    // Filtra trabajos que pertenecen directamente a la obra (sin trabajo extra intermedio)
    return trabajosAdicionales.filter(ta => ta.obraId === obraId && !ta.trabajoExtraId);
  };

  const obtenerTrabajosAdicionalesTrabajoExtra = (trabajoExtraId) => {
    if (!Array.isArray(trabajosAdicionales)) return [];
    // Filtra trabajos que pertenecen a un trabajo extra espec?fico
    return trabajosAdicionales.filter(ta => ta.trabajoExtraId === trabajoExtraId);
  };

  // Devuelve TODAS las tareas de una obra para mostrar en el subgrupo
  // - Solo se muestra en la obra PADRE (sub-obras retornan vac?o)
  // - Incluye tareas propias del padre + tareas de todas sus sub-obras agrupadas
  const obtenerTareasParaSubgrupo = (obra) => {
    if (!Array.isArray(tareasLeves)) return [];
    const esSubobra = obra.esTrabajoExtra || obra._grupoTipo === 'trabajoExtra';

    // Sub-obras: no muestran subgrupo propio ? sus tareas van en el padre
    if (esSubobra) return [];

    // Tareas directas de la obra padre
    const tareasDirectas = tareasLeves.filter(tl => tl.obraId === obra.id && !tl.trabajoAdicionalId);

    // IDs de sub-obras de este padre (por campo o por detecci?n de nombre)
    const nombrePadre = (obra.nombre || '').trim();
    const subObraIds = obras
      .filter(o => {
        if (o.id === obra.id) return false;
        const padreId = o.obraPadreId || o.obra_padre_id || o.idObraPadre;
        if (padreId === obra.id) return true;
        const nombreO = (o.nombre || '').trim();
        return nombrePadre && nombreO.startsWith(nombrePadre + ' ');
      })
      .map(o => o.id);

    // Tareas de sub-obras (v?a trabajoExtraId)
    const tareasDeSubObras = subObraIds.length > 0
      ? tareasLeves.filter(tl => subObraIds.includes(tl.obraId))
      : [];

    return [...tareasDirectas, ...tareasDeSubObras];
  };

  // Obtener trabajos extra (sub-obras TRABAJO_EXTRA) para mostrar en subgrupo
  const obtenerTrabajosExtraParaSubgrupo = (obra) => {
    const esSubobra = obra.esTrabajoExtra || obra._grupoTipo === 'trabajoExtra';
    if (esSubobra) return [];

    const nombrePadre = (obra.nombre || '').trim();
    const subObras = obras.filter(o => {
      if (o.id === obra.id) return false;

      // ?? CRITERIO 1 (DEFINITIVO): obra_origen_id / obraPadreId
      const padreIdExplicito = o.obraPadreId || o.obra_padre_id || o.idObraPadre;
      const origenId = o.obraOrigenId || o.obra_origen_id;

      if (padreIdExplicito === obra.id || origenId === obra.id) {
        // ✅ Sub-obra confirmada por ID de padre/origen
        // Filtrar solo trabajos extra (NO tareas leves) - usar campo del backend
        const esTareaLeve = o.tipoPresupuesto === 'TAREA_LEVE' || o.tipo_presupuesto === 'TAREA_LEVE';
        return !esTareaLeve;
      }

      // ?? CRITERIO 2 (FALLBACK): Detección por nombre + flag esTrabajoExtra
      const nombreO = (o.nombre || '').trim();
      if (nombrePadre && nombreO.startsWith(nombrePadre + ' ')) {
        // ✅ Verificar si es tarea leve usando el campo del backend
        const esTareaLeve = o.tipoPresupuesto === 'TAREA_LEVE' || o.tipo_presupuesto === 'TAREA_LEVE';
        if (esTareaLeve) return false;

        const esTrabajoExtra = o.esTrabajoExtra || o.esObraTrabajoExtra ||
                               o.es_obra_trabajo_extra || o._esTrabajoExtra;
        return esTrabajoExtra;
      }

      return false;
    });

    return subObras;
  };

  const obtenerTareasLevesParaSubgrupo = (obra) => {
    const esSubobra = obra.esTrabajoExtra || obra._grupoTipo === 'trabajoExtra';
    if (esSubobra) return [];

    const nombrePadre = (obra.nombre || '').trim();
    const tareasLevesDeEstaObra = tareasLeves.filter(tl => {
      // Verificar si esta tarea leve pertenece a la obra padre
      const padreIdExplicito = tl.obraPadreId || tl.obra_padre_id || tl.idObraPadre;
      const origenId = tl.obraOrigenId || tl.obra_origen_id;

      if (padreIdExplicito === obra.id || origenId === obra.id) {
        return true;
      }

      // Fallback: por nombre
      const nombreTL = (tl.nombre || '').trim();
      if (nombrePadre && nombreTL.startsWith(nombrePadre + ' ')) {
        return true;
      }

      return false;
    });

    return tareasLevesDeEstaObra;
  };

  const handleEliminarTrabajoAdicional = async (trabajoAdicionalId, nombre) => {
    if (!window.confirm(`?Est? seguro de eliminar la tarea leve "${nombre}"?\n\nEsta acci?n NO se puede deshacer.`)) {
      return;
    }

    try {
      showNotification('Eliminando trabajo adicional...', 'info');
      // ? REFACTORIZADO: Usar servicio unificado
      await presupuestoService.eliminarPresupuesto(trabajoAdicionalId, empresaId);

      // Actualizar lista
      const todasLasTareas = await presupuestoService.listarPresupuestos(empresaId, {
        tipo: TIPOS_PRESUPUESTO.TAREA_LEVE
      });

      // Mapear campos de presupuesto a estructura esperada
      const tareasMapeadas = todasLasTareas.map(presup => {
        const direccionCompleta = presup.direccionObraCalle && presup.direccionObraAltura
          ? `${presup.direccionObraCalle} ${presup.direccionObraAltura}`.trim()
          : presup.direccionObraCalle || presup.direccion || '?';

        const obraVinculada = presup.obraId
          ? obras.find(o => o.id === presup.obraId) || presup.obra
          : presup.obra;

        const nombreClienteObra = obraVinculada?.nombreCliente || obraVinculada?.cliente?.nombre || '';
        const direccionObra = obraVinculada?.direccion || '';
        const telefonoObra = obraVinculada?.telefonoContacto || obraVinculada?.telefono || '';

        return {
          ...presup,
          nombre: presup.nombreObra || presup.nombre || 'Sin nombre',
          nombreCliente: presup.nombreSolicitante || nombreClienteObra || 'Sin especificar',
          direccion: direccionCompleta !== '?' ? direccionCompleta : (direccionObra || '?'),
          contacto: presup.telefono || telefonoObra || '?',
          importe: presup.totalConDescuentos || presup.totalFinal || presup.importe || 0,
          fechaInicio: presup.fechaProbableInicio || presup.fechaInicio,
          fechaFin: presup.fechaFinalizacion || presup.fechaFin,
          descripcion: presup.descripcion || '',
          tipoPresupuesto: presup.modoPresupuesto === 'TRADICIONAL' ? 'GLOBAL' : 'DETALLADO',
          fechaCreacion: presup.fechaCreacion || presup.createdAt,
          version: presup.numeroVersion || presup.version || 1
        };
      });

      setTrabajosAdicionales(tareasMapeadas);

      showNotification('? Trabajo adicional eliminado correctamente', 'success');
    } catch (error) {
      console.error('? Error al eliminar trabajo adicional:', error);
      showNotification('Error al eliminar trabajo adicional', 'error');
    }
  };

  const handleCambiarEstadoTrabajoAdicional = async (trabajoAdicionalId, nuevoEstado) => {
    try {
      showNotification(`Cambiando estado a ${nuevoEstado}...`, 'info');
      // ? REFACTORIZADO: Usar servicio unificado
      await presupuestoService.actualizarPresupuesto(trabajoAdicionalId, { estado: nuevoEstado }, empresaId);

      // Actualizar lista
      const todasLasTareas = await presupuestoService.listarPresupuestos(empresaId, {
        tipo: TIPOS_PRESUPUESTO.TAREA_LEVE
      });

      // Mapear campos de presupuesto a estructura esperada
      const tareasMapeadas = todasLasTareas.map(presup => {
        const direccionCompleta = presup.direccionObraCalle && presup.direccionObraAltura
          ? `${presup.direccionObraCalle} ${presup.direccionObraAltura}`.trim()
          : presup.direccionObraCalle || presup.direccion || '?';

        const obraVinculada = presup.obraId
          ? obras.find(o => o.id === presup.obraId) || presup.obra
          : presup.obra;

        const nombreClienteObra = obraVinculada?.nombreCliente || obraVinculada?.cliente?.nombre || '';
        const direccionObra = obraVinculada?.direccion || '';
        const telefonoObra = obraVinculada?.telefonoContacto || obraVinculada?.telefono || '';

        return {
          ...presup,
          nombre: presup.nombreObra || presup.nombre || 'Sin nombre',
          nombreCliente: presup.nombreSolicitante || nombreClienteObra || 'Sin especificar',
          direccion: direccionCompleta !== '?' ? direccionCompleta : (direccionObra || '?'),
          contacto: presup.telefono || telefonoObra || '?',
          importe: presup.totalConDescuentos || presup.totalFinal || presup.importe || 0,
          fechaInicio: presup.fechaProbableInicio || presup.fechaInicio,
          fechaFin: presup.fechaFinalizacion || presup.fechaFin,
          descripcion: presup.descripcion || '',
          tipoPresupuesto: presup.modoPresupuesto === 'TRADICIONAL' ? 'GLOBAL' : 'DETALLADO',
          fechaCreacion: presup.fechaCreacion || presup.createdAt,
          version: presup.numeroVersion || presup.version || 1
        };
      });

      setTrabajosAdicionales(tareasMapeadas);

      showNotification('? Estado actualizado correctamente', 'success');
    } catch (error) {
      console.error('? Error al cambiar estado:', error);
      showNotification('Error al cambiar estado del trabajo adicional', 'error');
    }
  };

  // ?? NUEVA FUNCIONALIDAD: Calcular estado de tiempo de la obra comparando profesionales asignados vs presupuesto
  const calcularEstadoTiempoObra = (obraId) => {
    try {
      const obra = obras.find(o => o.id === obraId);
      if (!obra || !obra.presupuestoNoCliente) {
        return { emoji: '', tooltip: '' };
      }

      const presupuesto = obra.presupuestoNoCliente;
      const config = obtenerConfiguracionObra(obraId);

      // Obtener jornales del presupuesto
      const jornalesPresupuesto = presupuesto.tiempoEstimadoTerminacion || 0;

      // Obtener d?as h?biles estimados
      const diasEstimados = config?.diasHabiles || 0;

      // Obtener capacidad necesaria
      const capacidadNecesaria = config?.capacidadNecesaria || (diasEstimados > 0 ? Math.ceil(jornalesPresupuesto / diasEstimados) : 0);

      if (jornalesPresupuesto === 0 || diasEstimados === 0 || capacidadNecesaria === 0) {
        return { emoji: '', tooltip: '' };
      }

      // Obtener datos de profesionales asignados desde contadores
      const contador = contadoresObras[obraId];
      if (!contador || !contador.profesionalesData) {
        return { emoji: '??', tooltip: 'Sin profesionales asignados a?n' };
      }

      // Calcular total de profesionales ?nicos asignados
      const profesionalesUnicos = new Set();

      contador.profesionalesData.forEach(asignacion => {
        if (asignacion.asignacionesPorSemana && Array.isArray(asignacion.asignacionesPorSemana)) {
          asignacion.asignacionesPorSemana.forEach(semana => {
            if (semana.detallesPorDia && Array.isArray(semana.detallesPorDia)) {
              semana.detallesPorDia.forEach(detalle => {
                if (detalle.profesionalId && detalle.cantidad > 0) {
                  profesionalesUnicos.add(detalle.profesionalId);
                }
              });
            }
          });
        }
      });

      const profesionalesAsignados = profesionalesUnicos.size;

      if (profesionalesAsignados === 0) {
        return { emoji: '??', tooltip: 'Sin profesionales asignados a?n' };
      }

      // Comparar profesionales asignados vs necesarios
      const diferenciaProfesionales = profesionalesAsignados - capacidadNecesaria;

      // Calcular d?as reales con los profesionales asignados
      const diasReales = Math.ceil(jornalesPresupuesto / profesionalesAsignados);
      const diasDiferencia = diasReales - diasEstimados;

      // Determinar emoji y tooltip
      if (diferenciaProfesionales === 0) {
        return {
          emoji: '?',
          tooltip: `Perfecto: ${profesionalesAsignados} profesionales asignados = ${capacidadNecesaria} necesarios ? Terminar?s en ${diasEstimados} d?as`
        };
      } else if (diferenciaProfesionales > 0) {
        const profesionalesMas = diferenciaProfesionales;
        return {
          emoji: '??',
          tooltip: `${profesionalesMas} profesional${profesionalesMas !== 1 ? 'es' : ''} extra ? Terminar?s en ${diasReales} d?as (${Math.abs(diasDiferencia)} d?a${Math.abs(diasDiferencia) !== 1 ? 's' : ''} menos)`
        };
      } else {
        const profesionalesFaltantes = Math.abs(diferenciaProfesionales);
        return {
          emoji: '',
          tooltip: `Faltan ${profesionalesFaltantes} profesional${profesionalesFaltantes !== 1 ? 'es' : ''} ? Terminar?s en ${diasReales} d?as (${diasDiferencia} d?a${diasDiferencia !== 1 ? 's' : ''} m?s)`
        };
      }
    } catch (error) {
      console.error('Error calculando estado de tiempo:', error);
      return { emoji: '', tooltip: '' };
    }
  };

  // Funci?n para cargar todos los contadores de una obra cuando se expande
  const cargarContadoresObra = async (obraId, presupuestoId = null) => {
    console.log('🔹 cargarContadoresObra llamado con:', { obraId, presupuestoId });
    try {
      // ?? Detectar si es un trabajo extra buscando en el array de obras Y trabajosExtra
      // ?? Para tareas leves: obra.id = 102 (presupuesto), obra.obraId = 54 (obra real)
      let obraEncontrada = obras.find(o => o.id === obraId || o.obraId === obraId);

      // ?? Si no se encuentra en obras, buscar en trabajosExtra (contiene trabajos adicionales Y tareas leves)
      if (!obraEncontrada) {
        const trabajo = trabajosExtra.find(t => {
          const obraIdVinculada = t.id_obra || t.obraId || t.obra_id || t.idObra;
          return obraIdVinculada === obraId || t.id === obraId;
        });

        if (trabajo) {
          // Convertir trabajo a formato obra para el resto de la función
          const obraIdReal = trabajo.id_obra || trabajo.obraId || trabajo.obra_id || trabajo.idObra;
          obraEncontrada = {
            id: trabajo.id, // ID del presupuesto (102)
            obraId: obraIdReal, // ID de la obra (54)
            presupuestoId: trabajo.id,
            _esTrabajoExtra: true,
            _esTareaLeve: true
          };
          console.log('🎯 Trabajo encontrado en trabajosExtra:', {
            presupuestoId: trabajo.id,
            obraId: obraIdReal
          });
        }
      }

      // ?? Si tampoco se encuentra en trabajosExtra, buscar en tareasLeves (tareas leves hijas de obras principales)
      if (!obraEncontrada) {
        const tarea = tareasLeves.find(t => {
          const obraIdVinculada = t.id_obra || t.obraId || t.obra_id || t.idObra;
          return obraIdVinculada === obraId || t.id === obraId;
        });

        if (tarea) {
          // Convertir tarea a formato obra para el resto de la función
          const obraIdReal = tarea.id_obra || tarea.obraId || tarea.obra_id || tarea.idObra;
          obraEncontrada = {
            id: tarea.id, // ID del presupuesto
            obraId: obraIdReal, // ID de la obra
            presupuestoId: tarea.id,
            _esTrabajoExtra: true,
            _esTareaLeve: true
          };
          console.log('🎯 Tarea leve encontrada en tareasLeves:', {
            presupuestoId: tarea.id,
            obraId: obraIdReal
          });
        }
      }

      const esTrabajoExtra = obraEncontrada?._esTrabajoExtra || false;
      const idParaConsulta = esTrabajoExtra ? obraId : obraId; // Para trabajo extra usar su propio ID

      console.log('?? cargarContadoresObra - obraId:', obraId, 'esTrabajoExtra:', esTrabajoExtra, 'obraEncontrada:', obraEncontrada?.id);

      const contadores = {
        presupuestos: 0,
        trabajosExtra: 0,
        profesionales: 0,
        materiales: 0,
        gastos: 0,
        etapas: 0
      };

      // Cargar contadores en paralelo
      const [
        presupuestos,
        trabajosExtra,
        profesionales,
        materialesData,
        gastosData,
        etapas
      ] = await Promise.all([
        // Presupuestos
        api.presupuestosNoCliente.getAll(empresaId).then(todos => {
          const count = (todos || []).filter(p => p.obraId === obraId || p.idObra === obraId).length;
          console.log('  ?? Presupuestos:', count);
          return count;
        }).catch(error => {
          console.warn('   Error cargando presupuestos:', error.message);
          return 0;
        }),

        // Trabajos Extra
        api.presupuestosNoCliente.getAll(empresaId, { obraId, esPresupuestoTrabajoExtra: true }).then(data => {
          // ✅ FILTRAR solo los que son trabajos extra (backend puede no estar filtrando correctamente)
          // ✅ EXCLUIR tareas leves que tienen esPresupuestoTrabajoExtra pero son tipo TAREA_LEVE
          let trabajosArray = (Array.isArray(data) ? data : []).filter(p =>
            (p.esPresupuestoTrabajoExtra === true || p.esPresupuestoTrabajoExtra === 'V') &&
            p.tipoPresupuesto === 'TRABAJO_EXTRA'
          );

          // ✅ FILTRAR: Si estamos dentro de un trabajo extra (obraId es un trabajo extra),
          // excluir ese trabajo extra de su propia lista
          const obraActual = obras.find(o => o.id === obraId || o.obraId === obraId);
          const esTrabajoExtra = obraActual?.esTrabajoExtra || obraActual?._esTrabajoExtra || obraActual?.esObraTrabajoExtra;
          if (esTrabajoExtra) {
            trabajosArray = trabajosArray.filter(t => {
              const excluir = t.id === obraId || t.id_trabajo_extra === obraId || t.obraId === obraId || t.presupuestoNoClienteId === obraId;
              return !excluir;
            });
          }

          const count = trabajosArray.length;

          // Guardar los datos completos de trabajos extra
          setDatosAsignacionesPorObra(prev => ({
            ...prev,
            [obraId]: {
              ...prev[obraId],
              trabajosExtra: trabajosArray
            }
          }));

          return count;
        }).catch(error => {
          console.warn('   Error cargando trabajos extra:', error.message);
          return 0;
        }),

        // Profesionales asignados - usar el servicio correcto que devuelve formato agrupado
        obtenerAsignacionesSemanalPorObra(obraId, empresaId).then(response => {
          let data = response.data || response;
          console.log('  📊 Respuesta profesionales (RAW):', response);
          console.log('  📊 Profesionales data:', data);

          // Si data tiene una propiedad data, extraerla
          if (data.data && Array.isArray(data.data)) {
            data = data.data;
          }

          // Asegurarse que data sea un array
          const asignaciones = Array.isArray(data) ? data : [];

          // Contar profesionales ?nicos
          const profesionalesUnicos = new Set();

          asignaciones.forEach(asignacion => {
            // Estructura: asignacion.asignacionesPorSemana[].detallesPorDia[].profesionalId
            if (asignacion.asignacionesPorSemana && Array.isArray(asignacion.asignacionesPorSemana)) {
              asignacion.asignacionesPorSemana.forEach(semana => {
                if (semana.detallesPorDia && Array.isArray(semana.detallesPorDia)) {
                  semana.detallesPorDia.forEach(detalle => {
                    if (detalle.profesionalId && detalle.cantidad > 0) {
                      profesionalesUnicos.add(detalle.profesionalId);
                    }
                  });
                }
              });
            }
          });

          const count = profesionalesUnicos.size;
          console.log('  ?? Total profesionales ?nicos asignados:', count);

          // Guardar los datos completos
          setDatosAsignacionesPorObra(prev => ({
            ...prev,
            [obraId]: {
              ...prev[obraId],
              asignacionesProfesionales: asignaciones
            }
          }));

          // ?? Retornar objeto con count y datos completos para el c?lculo de tiempo
          return { count, asignaciones };
        }).catch(error => {
          console.warn('   Error cargando profesionales:', error.message);
          return { count: 0, asignaciones: [] };
        }),

        // Materiales - Obtener asignaciones reales desde el backend
        (async () => {
          try {
            // ?? Tanto para obra normal como trabajo extra, consultar el endpoint de asignaciones
            const response = await axios.get(`/api/obras/${obraId}/materiales`, {
              headers: {
                empresaId: empresaId,
                'X-Tenant-ID': empresaId
              }
            });
            const data = response.data?.data || response.data || [];
            const materialesBackend = Array.isArray(data) ? data : [];
            const count = materialesBackend.length;

            console.log(`  ?? Materiales asignados ${esTrabajoExtra ? '(trabajo extra)' : ''}:`, count);

            // Guardar los datos completos de materiales
            setDatosAsignacionesPorObra(prev => ({
              ...prev,
              [obraId]: {
                ...prev[obraId],
                materiales: materialesBackend
              }
            }));

            return count;
          } catch (error) {
            console.warn('   Error cargando materiales:', error.message);
            return 0;
          }
        })(),

        // Gastos/Otros costos asignados - Obtener asignaciones reales desde el backend
        (async () => {
          try {
            // ?? Tanto para obra normal como trabajo extra, consultar el endpoint de asignaciones
            const response = await axios.get(`/api/obras/${obraId}/otros-costos`, {
              headers: {
                empresaId: empresaId,
                'X-Tenant-ID': empresaId,
                'Content-Type': 'application/json'
              }
            });
            const data = response.data || [];
            const gastos = Array.isArray(data) ? data : [];
            const count = gastos.length;

            console.log(`  ?? Gastos asignados ${esTrabajoExtra ? '(trabajo extra)' : ''}:`, count, gastos);

            // Guardar los datos completos de gastos generales
            setDatosAsignacionesPorObra(prev => ({
              ...prev,
              [obraId]: {
                ...prev[obraId],
                gastosGenerales: gastos
              }
            }));

            return count;
          } catch (error) {
            console.warn('   Error cargando gastos generales:', error.message);
            return 0;
          }
        })(),

        // Etapas diarias
        api.etapasDiarias.getAll(empresaId, { obraId }).then(data =>
          (Array.isArray(data) ? data : []).length
        ).catch(() => 0)
      ]);

      contadores.presupuestos = presupuestos;
      contadores.trabajosExtra = trabajosExtra;
      contadores.profesionales = profesionales.count || profesionales;
      contadores.profesionalesData = profesionales.asignaciones || []; // ?? Guardar datos completos
      contadores.materiales = materialesData;
      contadores.gastos = gastosData;
      contadores.etapas = etapas;

      console.log('? Contadores cargados para obra', obraId, ':', contadores);

      // Actualizar el estado con la clave del obraId
      setContadoresObras(prev => ({
        ...prev,
        [obraId]: contadores
      }));

      // ?? Si se pasó presupuestoId (tarea leve), guardar TAMBIÉN con esa clave para los badges
      if (presupuestoId && presupuestoId !== obraId) {
        console.log('✅ Guardando contadores TAMBIÉN con presupuestoId:', presupuestoId);
        setContadoresObras(prev => ({
          ...prev,
          [presupuestoId]: contadores
        }));
      }

    } catch (error) {
      console.error('? Error cargando contadores de obra:', obraId, error);
    }
  };

  // Funci?n para cargar presupuestos de una obra
  const handleVerPresupuestosObra = async (obra) => {
    try {
      setObraParaPresupuestos(obra);
      setMostrarModalPresupuestos(true);
      setLoadingPresupuestos(true);

      // ?? Si la obra ES una tarea leve (presupuesto en sí mismo), buscar su obra vinculada
      const presupuestoTareaLeve = presupuestosObras[obra.id];
      const esTareaLeve = presupuestoTareaLeve?.tipo_presupuesto === 'TAREA_LEVE' ||
                          presupuestoTareaLeve?.tipoPresupuesto === 'TAREA_LEVE' ||
                          tareasLeves.some(tl => tl.id === obra.id);

      let obraIdABuscar = obra.id;

      if (esTareaLeve && presupuestoTareaLeve?.obraId) {
        console.log('🎯 Tarea leve detectada:', {
          tareaLeveId: obra.id,
          obraVinculadaId: presupuestoTareaLeve.obraId,
          presupuesto: presupuestoTareaLeve
        });
        console.log('🔍 Buscando presupuestos de su obra vinculada:', presupuestoTareaLeve.obraId);
        obraIdABuscar = presupuestoTareaLeve.obraId;
      }

      console.log('🔍 Buscando TODOS los presupuestos con obraId:', obraIdABuscar);
      const todosPresupuestos = await api.presupuestosNoCliente.getAll(empresaId);

      console.log('?? Total presupuestos obtenidos:', todosPresupuestos?.length || 0);

      // Filtrar presupuestos que tienen esta obra vinculada
      const presupuestosFiltrados = (todosPresupuestos || []).filter(p => {
        const tieneObraVinculada = p.obraId === obraIdABuscar || p.idObra === obraIdABuscar;
        if (tieneObraVinculada) {
          console.log('? Presupuesto', p.id, 'vinculado a obra', obraIdABuscar);
        }
        return tieneObraVinculada;
      });

      console.log('? Presupuestos vinculados a obra', obraIdABuscar, ':', presupuestosFiltrados.length);

      // Ordenar presupuestos: primero por estado (APROBADO/EN_EJECUCI�N arriba), luego por versi?n DESC, luego por fecha de creaci?n DESC
      const presupuestosOrdenados = presupuestosFiltrados.sort((a, b) => {
        // Definir prioridad de estados
        const estadosPrioridad = {
          'APROBADO': 1,
          'EN_EJECUCI�N': 1,
          'EN_EJECUCION': 1, // Por si acaso hay variaci?n en el nombre
          'ENVIADO': 2,
          'BORRADOR': 3
        };

        const prioridadA = estadosPrioridad[a.estado] || 4;
        const prioridadB = estadosPrioridad[b.estado] || 4;

        // Primero ordenar por estado (menor prioridad = m?s arriba)
        if (prioridadA !== prioridadB) {
          return prioridadA - prioridadB;
        }

        // Si tienen el mismo estado, ordenar por versi?n (m?s alta primero)
        const versionA = a.numeroVersion || a.version || 1;
        const versionB = b.numeroVersion || b.version || 1;
        if (versionA !== versionB) {
          return versionB - versionA;
        }

        // Si tienen la misma versi?n y estado, ordenar por fecha de ?ltima modificaci?n (m?s reciente primero)
        const fechaA = new Date(a.fechaUltimaModificacionEstado || a.fechaCreacion || a.createdAt || 0);
        const fechaB = new Date(b.fechaUltimaModificacionEstado || b.fechaCreacion || b.createdAt || 0);
        return fechaB - fechaA;
      });

      console.log('?? Presupuestos ordenados (APROBADO/EN_EJECUCI�N primero, luego por versi?n):', presupuestosOrdenados.map(p => ({
        id: p.id,
        version: p.version,
        estado: p.estado,
        fechaCreacion: p.fechaCreacion,
        prioridad: p.estado === 'APROBADO' || p.estado === 'EN_EJECUCI�N' || p.estado === 'EN_EJECUCION' ? 'ALTA' : 'NORMAL'
      })));

      setPresupuestosObra(presupuestosOrdenados);

      // Si solo hay un presupuesto, abrirlo autom?ticamente
      if (presupuestosOrdenados.length === 1) {
        console.log('?? Solo hay un presupuesto, abri?ndolo autom?ticamente:', presupuestosOrdenados[0].id);
        setTimeout(() => {
          handleAbrirPresupuesto(presupuestosOrdenados[0]);
        }, 500); // Peque?o delay para que se vea el modal de lista primero
      }
    } catch (error) {
      console.error('? Error cargando presupuesto:', error);
      console.error('? Detalles del error:', error.message, error.response);
      showNotification('Error al cargar presupuesto de la obra: ' + (error.message || 'Error desconocido'), 'error');
      setPresupuestosObra([]);
    } finally {
      setLoadingPresupuestos(false);
    }
  };

  // ��� Funci?n para abrir presupuesto en modal de edici?n
  const handleAbrirPresupuesto = async (presupuesto) => {
    if (!empresaId) {
      showNotification('Error: No hay empresa seleccionada', 'error');
      return;
    }

    setCargandoPresupuesto(true);
    try {
      // Cargar el presupuesto completo desde el backend
      const presupuestoCompleto = await api.presupuestosNoCliente.getById(presupuesto.id, empresaId);

      // Asegurar que incluye obraId y clienteId del contexto actual
      // Usar valores de la obra actual si el presupuesto tiene NULL en BD
      const presupuestoConContexto = {
        ...presupuestoCompleto,
        obraId: presupuestoCompleto.obraId || presupuestoCompleto.idObra || obraParaPresupuestos?.id || null,
        clienteId: presupuestoCompleto.clienteId || presupuestoCompleto.idCliente || obraParaPresupuestos?.idCliente || null
      };

      setPresupuestoParaEditar(presupuestoConContexto);
      setMostrarModalEditarPresupuesto(true);
    } catch (error) {
      console.error('? Error al cargar presupuesto:', error);

      let mensajeError = 'Error al cargar el presupuesto';
      if (error.response?.data?.mensaje) {
        mensajeError = error.response.data.mensaje;
      } else if (error.message) {
        mensajeError = error.message;
      }

      showNotification(mensajeError, 'error');
    } finally {
      setCargandoPresupuesto(false);
    }
  };

  // Funci?n para editar solo las fechas de un presupuesto de obra
  const handleEditarSoloFechasObra = async (obra) => {
    if (!obra?.id || !empresaId) {
      showNotification('Error: Datos de obra inv?lidos', 'error');
      return;
    }

    try {
      // Buscar el presupuesto vinculado a esta obra
      const todosPresupuestos = await api.presupuestosNoCliente.getAll(empresaId);
      const presupuestoVinculado = (todosPresupuestos || []).find(p =>
        p.obraId === obra.id || p.idObra === obra.id
      );

      if (!presupuestoVinculado) {
        showNotification('No se encontr? un presupuesto vinculado a esta obra', 'warning');
        return;
      }

      setCargandoPresupuesto(true);

      // Cargar el presupuesto completo
      const presupuestoCompleto = await api.presupuestosNoCliente.getById(presupuestoVinculado.id, empresaId);

      // Asegurar contexto y marcar con flag especial para modo edici?n limitada
      const presupuestoConContexto = {
        ...presupuestoCompleto,
        obraId: presupuestoCompleto.obraId || presupuestoCompleto.idObra || obra.id,
        clienteId: presupuestoCompleto.clienteId || presupuestoCompleto.idCliente || obra.idCliente,
        _editarSoloFechas: true // Flag para indicar modo de edici?n limitada
      };

      console.log('?? Abriendo presupuesto en modo edici?n de fechas:', {
        presupuestoId: presupuestoConContexto.id,
        obraId: presupuestoConContexto.obraId,
        editarSoloFechas: true
      });

      setPresupuestoParaEditar(presupuestoConContexto);
      setMostrarModalEditarPresupuesto(true);

      showNotification(
        '?? Modo edici?n de fechas: Solo puede modificar Fecha Probable de Inicio y D?as H?biles. La versi?n y el estado se preservar?n.',
        'info'
      );
    } catch (error) {
      console.error('? Error al cargar presupuesto para editar fechas:', error);
      showNotification(
        'Error al cargar presupuesto: ' + (error.message || 'Error desconocido'),
        'error'
      );
    } finally {
      setCargandoPresupuesto(false);
    }
  };

  // ==================== CONFIGURACI�N GLOBAL DE OBRA ====================

  // Helper para recalcular semanas desde presupuesto (usado por badge y modal)
  const recalcularSemanasDesdePresupuesto = (presupuesto) => {
    if (!presupuesto?.tiempoEstimadoTerminacion) return 0;

    let semanasCalculadas = 0;

    if (presupuesto.fechaProbableInicio) {
      const fechaInicio = parsearFechaLocal(presupuesto.fechaProbableInicio);
      try {
        semanasCalculadas = calcularSemanasParaDiasHabiles(
          fechaInicio,
          presupuesto.tiempoEstimadoTerminacion
        );
      } catch (error) {
        semanasCalculadas = convertirDiasHabilesASemanasSimple(
          presupuesto.tiempoEstimadoTerminacion
        );
      }
    } else {
      semanasCalculadas = convertirDiasHabilesASemanasSimple(
        presupuesto.tiempoEstimadoTerminacion
      );
    }

    return semanasCalculadas;
  };

  // ?? EFECTO: Cuando se abre el modal de configuraci?n, cargar datos correctos
  React.useEffect(() => {
    if (!mostrarModalConfiguracionObra || !obraParaConfigurar) {
      return;
    }

    // ? SI ES TRABAJO EXTRA: usar presupuesto pre-cargado, NO buscar en backend
    if (obraParaConfigurar._esTrabajoExtra && obraParaConfigurar.presupuestoNoCliente) {
      console.log('? [Modal Configuraci?n TE] Es trabajo extra - usando presupuesto pre-cargado');
      const presupuesto = obraParaConfigurar.presupuestoNoCliente;

      // ?? Para trabajos extra: usar c?lculo SIMPLE de semanas (no con feriados)
      const semanasCalculadas = presupuesto.tiempoEstimadoTerminacion
        ? Math.ceil(presupuesto.tiempoEstimadoTerminacion / 5)
        : 0;

      const jornalesTotales = parseInt(presupuesto.tiempoEstimadoTerminacion) || 0;

      setConfiguracionObra({
        jornalesTotales,
        fechaInicio: presupuesto.fechaProbableInicio ? parsearFechaLocal(presupuesto.fechaProbableInicio) : new Date(),
        presupuestoSeleccionado: presupuesto,
        semanasObjetivo: semanasCalculadas > 0 ? semanasCalculadas.toString() : '',
        diasHabiles: presupuesto.tiempoEstimadoTerminacion || 0,
        capacidadNecesaria: 0,
        fechaFinEstimada: null
      });

      console.log('? [Modal Configuraci?n TE] configuracionObra inicializada:', {
        presupuestoId: presupuesto.id,
        diasHabiles: presupuesto.tiempoEstimadoTerminacion,
        semanas: semanasCalculadas
      });
      return;
    }

    // ?? SI ES OBRA NORMAL: llamar handleConfigurarObra para buscar presupuestos
    handleConfigurarObra(obraParaConfigurar);
  }, [mostrarModalConfiguracionObra, obraParaConfigurar?._esTrabajoExtra]);

  const handleConfigurarObra = async (obra) => {
    console.log('?????? INICIO handleConfigurarObra - Obra:', obra?.id, obra?.direccion);

    if (!obra?.id || !empresaSeleccionada?.id) {
      showNotification('Error: Datos inv?lidos', 'error');
      return;
    }

    // No setear obraParaConfigurar aqu? si ya est? seteado (viene de handleAbrirDia de trabajos extra)
    if (!obraParaConfigurar || obraParaConfigurar.id !== obra.id) {
      setObraParaConfigurar(obra);
    }

    console.log('?? Buscando presupuesto para configuraci?n...');

    try {
      // Buscar todos los presupuestos de la obra y elegir el de mayor versi?n
      const todosPresupuestos = await api.presupuestosNoCliente.getAll(empresaSeleccionada.id);
      console.log('?? TODOS LOS PRESUPUESTOS:', todosPresupuestos);

      // Filtrar solo los de la obra
      const presupuestosObra = (todosPresupuestos || []).filter(p =>
        p.obraId === obra.id || p.idObra === obra.id
      );

      // Elegir el de mayor versi?n
      let presupuestoVinculado = null;
      if (presupuestosObra.length > 0) {
        presupuestoVinculado = presupuestosObra.reduce((max, curr) =>
          (curr.numeroVersion > (max?.numeroVersion || 0) ? curr : max), presupuestosObra[0]
        );
      }

      console.log('?? PRESUPUESTO VINCULADO (mayor versi?n):', presupuestoVinculado);
      console.log('?? Obra ID buscada:', obra.id);

      if (presupuestoVinculado) {
        // ? VALIDACI�N IMPORTANTE: El presupuesto DEBE tener fecha y d?as estimados
        // Ahora solo mostramos advertencia, no cerramos el modal
        let advertenciaConfig = null;
        if (!presupuestoVinculado.fechaProbableInicio) {
          advertenciaConfig = ' El presupuesto no tiene fecha probable de inicio configurada. Por favor, compl?tala para poder guardar la configuraci?n.';
        } else if (!presupuestoVinculado.tiempoEstimadoTerminacion || presupuestoVinculado.tiempoEstimadoTerminacion <= 0) {
          advertenciaConfig = ' El presupuesto no tiene tiempo estimado de terminaci?n configurado. Por favor, compl?talo para poder guardar la configuraci?n.';
        }
        // Guardar advertencia en el estado para mostrarla en el modal
        setAdvertenciaConfiguracionObra(advertenciaConfig);

        // ?? Calcular semanas autom?ticamente bas?ndose en tiempoEstimadoTerminacion
        let semanasCalculadas = 0;
        let fechaInicio = null;
        const jornalesTotales = parseInt(presupuestoVinculado.tiempoEstimadoTerminacion) || 30;

        console.log('?? tiempoEstimadoTerminacion del presupuesto:', presupuestoVinculado.tiempoEstimadoTerminacion);

        if (presupuestoVinculado.tiempoEstimadoTerminacion) {
          console.log('? Hay tiempoEstimadoTerminacion, calculando semanas...');

          // Con fechaProbableInicio validada, hacer c?lculo preciso con feriados
          console.log('? Hay fechaProbableInicio, c?lculo preciso con feriados');
          fechaInicio = parsearFechaLocal(presupuestoVinculado.fechaProbableInicio);
          try {
            semanasCalculadas = calcularSemanasParaDiasHabiles(
              fechaInicio,
              presupuestoVinculado.tiempoEstimadoTerminacion
            );
            console.log('? Semanas calculadas con feriados:', semanasCalculadas);
          } catch (error) {
            console.warn(' Error al calcular semanas con feriados, usando c?lculo simple:', error);
            semanasCalculadas = convertirDiasHabilesASemanasSimple(
              presupuestoVinculado.tiempoEstimadoTerminacion
            );
            console.log('? Semanas calculadas simple (fallback):', semanasCalculadas);
          }
        } else {
          console.warn(' No hay tiempoEstimadoTerminacion');
        }

        console.log('?? DEBUG - Configurando obra:', {
          fechaProbableInicio: presupuestoVinculado.fechaProbableInicio,
          fechaInicio: fechaInicio,
          fechaInicioStr: fechaInicio ? fechaInicio.toLocaleDateString('es-AR') : 'Sin fecha',
          jornalesTotales,
          diasHabilesPresupuesto: presupuestoVinculado.tiempoEstimadoTerminacion,
          semanasCalculadas
        });

        console.log('?? ANTES DE setConfiguracionObra - semanasCalculadas:', semanasCalculadas);

        // ?? Calcular capacidad necesaria (profesionales trabajando en paralelo por d?a)
        let capacidadNecesaria = 0;
        if (presupuestoVinculado.itemsCalculadora && Array.isArray(presupuestoVinculado.itemsCalculadora)) {
          // Contar profesionales en paralelo de rubros incluidos en c?lculo de d?as
          presupuestoVinculado.itemsCalculadora.forEach(rubro => {
            // Solo rubros incluidos en c?lculo de d?as
            const incluirRubro = rubro.incluirEnCalculoDias !== false;
            if (!incluirRubro) return;

            // Contar profesionales del rubro que trabajan en paralelo
            if (rubro.jornales && Array.isArray(rubro.jornales)) {
              rubro.jornales.forEach(jornal => {
                const incluirJornal = jornal.incluirEnCalculoDias !== false;
                const cantidad = Number(jornal.cantidad || 0);
                if (incluirJornal && cantidad > 0) {
                  capacidadNecesaria++; // 1 profesional por cada l?nea de jornal
                }
              });
            }
          });
          console.log('?? Capacidad necesaria calculada:', capacidadNecesaria, 'profesionales/d?a');
        }

        setConfiguracionObra({
          jornalesTotales,
          fechaInicio: fechaInicio || new Date(),
          presupuestoSeleccionado: presupuestoVinculado,
          semanasObjetivo: semanasCalculadas > 0 ? semanasCalculadas.toString() : '',
          diasHabiles: presupuestoVinculado.tiempoEstimadoTerminacion || 0,
          capacidadNecesaria: capacidadNecesaria,
          fechaFinEstimada: null
        });

        console.log('? setConfiguracionObra ejecutado con semanasObjetivo:', semanasCalculadas > 0 ? semanasCalculadas.toString() : '');

        // ? ABRIR MODAL DE CONFIGURACI�N
        setMostrarModalConfiguracionObra(true);
      } else {
        // Fallback si no hay presupuesto vinculado
        showNotification(' No se encontr? un presupuesto vinculado a esta obra', 'warning');
        setConfiguracionObra({
          jornalesTotales: 30,
          fechaInicio: new Date(),
          presupuestoSeleccionado: null,
          semanasObjetivo: '',
          diasHabiles: 0,
          capacidadNecesaria: 0,
          fechaFinEstimada: null
        });
        // ? ABRIR MODAL INCLUSO SIN PRESUPUESTO (para que el usuario configure manualmente)
        setMostrarModalConfiguracionObra(true);
      }

    } catch (error) {
      console.error('Error:', error);
      showNotification('? Error al intentar cargar la configuraci?n: ' + error.message, 'error');
      setConfiguracionObra({
        jornalesTotales: 30,
        fechaInicio: new Date(),
        presupuestoSeleccionado: null,
        semanasObjetivo: '',
        diasHabiles: 0,
        capacidadNecesaria: 0,
        fechaFinEstimada: null
      });
      // ? ABRIR MODAL PARA QUE EL USUARIO INTENTE CONFIGURAR MANUALMENTE
      setMostrarModalConfiguracionObra(true);
    }
  };

  const handleGuardarConfiguracionObra = async () => {
    // ? OBTENER fecha probable de inicio (desde presupuesto o input)
    const fechaProbableInicio = configuracionObra.presupuestoSeleccionado?.fechaProbableInicio ||
                                configuracionObra.fechaProbableInicioInput;

    // ? VALIDACI�N: Verificar que hay fecha probable de inicio configurada o ingresada
    if (!fechaProbableInicio || fechaProbableInicio.trim() === '') {
      showNotification('? Debes configurar una fecha probable de inicio para continuar', 'error');
      return;
    }

    // Usar d?as h?biles ingresados por el usuario o del presupuesto como fallback
    const diasHabiles = configuracionObra.diasHabiles && configuracionObra.diasHabiles > 0
      ? parseInt(configuracionObra.diasHabiles)
      : configuracionObra.presupuestoSeleccionado?.tiempoEstimadoTerminacion;

    if (!diasHabiles || diasHabiles <= 0) {
      showNotification('? Debes configurar los d?as h?biles para la obra', 'error');
      return;
    }

    // ?? SI se ingres? una nueva fecha o nuevos d?as h?biles, actualizar el presupuestoNoCliente
    if ((configuracionObra.fechaProbableInicioInput &&
         configuracionObra.fechaProbableInicioInput !== configuracionObra.presupuestoSeleccionado?.fechaProbableInicio) ||
        (configuracionObra.diasHabiles && parseInt(configuracionObra.diasHabiles) !== configuracionObra.presupuestoSeleccionado?.tiempoEstimadoTerminacion)) {

      console.log('?? Actualizando presupuesto con configuraci?n del usuario:', {
        presupuestoId: configuracionObra.presupuestoSeleccionado?.id,
        fechaAnterior: configuracionObra.presupuestoSeleccionado?.fechaProbableInicio,
        fechaNueva: configuracionObra.fechaProbableInicioInput || configuracionObra.presupuestoSeleccionado?.fechaProbableInicio,
        diasHabilesAnterior: configuracionObra.presupuestoSeleccionado?.tiempoEstimadoTerminacion,
        diasHabilesNuevo: diasHabiles
      });

      try {
        await api.presupuestosNoCliente.actualizarSoloFechas(
          configuracionObra.presupuestoSeleccionado.id,
          {
            fechaProbableInicio: configuracionObra.fechaProbableInicioInput || configuracionObra.presupuestoSeleccionado?.fechaProbableInicio,
            tiempoEstimadoTerminacion: diasHabiles
          },
          empresaId
        );

        // Actualizar configuraci?n local
        setConfiguracionObra(prev => ({
          ...prev,
          presupuestoSeleccionado: {
            ...prev.presupuestoSeleccionado,
            fechaProbableInicio: configuracionObra.fechaProbableInicioInput || prev.presupuestoSeleccionado?.fechaProbableInicio,
            tiempoEstimadoTerminacion: diasHabiles
          }
        }));

        showNotification('? Presupuesto actualizado con la nueva planificaci?n', 'success');
      } catch (error) {
        console.error('Error al actualizar presupuesto:', error);
        showNotification(' Error al actualizar el presupuesto', 'warning');
        // Continuar con el guardado de configuraci?n aunque falle la actualizaci?n del presupuesto
      }
    }

    // Usar directamente los valores calculados
    const semanasCalculadas = Math.ceil(diasHabiles / 5); // Solo para c?lculos internos

    // ?? Calcular capacidad necesaria desde el presupuesto (igual que en handleConfigurarObra)
    let capacidadNecesaria = 0;

    // Si no est? calculado, intentar calcularlo desde el presupuesto
    if (capacidadNecesaria === 0 && configuracionObra.presupuestoSeleccionado?.itemsCalculadora) {
      configuracionObra.presupuestoSeleccionado.itemsCalculadora.forEach(rubro => {
        const incluirRubro = rubro.incluirEnCalculoDias !== false;
        if (!incluirRubro) return;

        if (rubro.jornales && Array.isArray(rubro.jornales)) {
          rubro.jornales.forEach(jornal => {
            const incluirJornal = jornal.incluirEnCalculoDias !== false;
            const cantidad = Number(jornal.cantidad || 0);
            if (incluirJornal && cantidad > 0) {
              capacidadNecesaria++;
            }
          });
        }
      });
    }

    // Fallback si a?n es 0: usar c?lculo simple
    if (capacidadNecesaria === 0) {
      capacidadNecesaria = Math.ceil(configuracionObra.jornalesTotales / diasHabiles);
    }



    // Calcular fecha de fin estimada considerando feriados de Argentina
    let fechaFinEstimada = null;
    if (configuracionObra.fechaInicio) {
      fechaFinEstimada = new Date(configuracionObra.fechaInicio);
      let diasContados = 0;

      console.log('?? DEBUG - Calculando fecha fin:', {
        fechaInicio: configuracionObra.fechaInicio,
        fechaInicioStr: fechaFinEstimada.toLocaleDateString('es-AR'),
        diasHabiles,
        semanasCalculadas
      });

      // Sumar d?as hasta alcanzar los d?as h?biles necesarios (considerando feriados)
      while (diasContados < diasHabiles) {
        fechaFinEstimada.setDate(fechaFinEstimada.getDate() + 1);

        // ?? Solo contar si es d?a h?bil: lunes-viernes Y no es feriado
        if (esDiaHabil(fechaFinEstimada)) {
          diasContados++;
        }
      }

      console.log('?? DEBUG - Fecha fin calculada (con feriados):', {
        fechaFin: fechaFinEstimada.toLocaleDateString('es-AR'),
        diasContados
      });
    }

    const nuevaConfiguracion = {
      ...configuracionObra,
      semanasObjetivo: semanasCalculadas,
      diasHabiles,
      capacidadNecesaria,
      fechaFinEstimada
    };

    setConfiguracionObra(nuevaConfiguracion);

    // Actualizar la obra seleccionada para etapas diarias (si existe)
    if (obraParaEtapasDiarias) {
      // ?? Para trabajos extra: actualizar tambi?n presupuestoNoCliente con los nuevos datos de fechas/d?as
      const obraActualizada = {
        ...obraParaEtapasDiarias,
        configuracionPlanificacion: nuevaConfiguracion
      };

      // Si es trabajo extra, actualizar presupuestoNoCliente con fechaProbableInicio y tiempoEstimadoTerminacion
      if (obraParaEtapasDiarias._esTrabajoExtra && obraParaEtapasDiarias.presupuestoNoCliente) {
        console.log('? [Guardada Configuraci?n TE] Actualizando presupuestoNoCliente con fechas:', {
          fechaProbableInicio: configuracionObra.presupuestoSeleccionado?.fechaProbableInicio,
          tiempoEstimadoTerminacion: diasHabiles
        });

        obraActualizada.presupuestoNoCliente = {
          ...obraParaEtapasDiarias.presupuestoNoCliente,
          fechaProbableInicio: configuracionObra.presupuestoSeleccionado?.fechaProbableInicio || obraParaEtapasDiarias.presupuestoNoCliente.fechaProbableInicio,
          tiempoEstimadoTerminacion: diasHabiles
        };
        // ?? IMPORTANTE: Tambi?n actualizar directamente en la obra para que calendarioCompleto lo vea
        obraActualizada.tiempoEstimadoTerminacion = diasHabiles;
        obraActualizada.fechaProbableInicio = configuracionObra.presupuestoSeleccionado?.fechaProbableInicio || obraParaEtapasDiarias.fechaProbableInicio;
      }

      setObraParaEtapasDiarias(obraActualizada);

      // ?? PARA TRABAJOS EXTRA: Guardar el presupuesto en cache CONGELADO
      if (obraParaEtapasDiarias._esTrabajoExtra && obraActualizada.presupuestoNoCliente) {
        console.log('?? [Guardada Configuraci?n TE] CONGELANDO presupuesto en cache:', {
          presupuestoId: obraActualizada.presupuestoNoCliente.id,
          tiempoEstimadoTerminacion: obraActualizada.presupuestoNoCliente.tiempoEstimadoTerminacion
        });
        setPresupuestosObras(prev => ({
          ...prev,
          // Guardar con KEY diferente para trabajos extra para evitar que se sobrescriba
          [`te_${obraParaEtapasDiarias._trabajoExtraId}`]: obraActualizada.presupuestoNoCliente
        }));
      }

      // Actualizar el estado global de configuraciones
      setConfiguracionesPlanificacion(prev => ({
        ...prev,
        [obraParaEtapasDiarias.id]: nuevaConfiguracion
      }));
    }

    // ?? Si el modal se abri? desde un trabajo extra (pesta?a trabajos-extra), actualizar ese trabajo en el array
    if (obraParaConfigurar?._esTrabajoExtra && obraParaConfigurar._trabajoExtraId) {
      console.log('? [Guardada TE Config] Actualizando trabajo extra en array trabajosExtra:', {
        trabajoExtraId: obraParaConfigurar._trabajoExtraId,
        tiempoEstimadoTerminacion: diasHabiles,
        fechaProbableInicio: configuracionObra.presupuestoSeleccionado?.fechaProbableInicio
      });

      setTrabajosExtra(prev => prev.map(trabajo => {
        if (trabajo.id === obraParaConfigurar._trabajoExtraId) {
          return {
            ...trabajo,
            fechaProbableInicio: configuracionObra.presupuestoSeleccionado?.fechaProbableInicio || trabajo.fechaProbableInicio,
            tiempoEstimadoTerminacion: diasHabiles
          };
        }
        return trabajo;
      }));
    }

    // Forzar regeneraci?n del calendario
    setCalendarioVersion(v => {
      console.log(' ?? Configuraci?n cambiada - Incrementando calendarioVersion:', v, ' ? ', v + 1);
      return v + 1;
    });

    setMostrarModalConfiguracionObra(false);

    // Resetear configuraci?n despu?s de guardar exitosamente
    setConfiguracionObra({
      semanasObjetivo: '',
      diasHabiles: 0,
      capacidadNecesaria: 0,
      fechaInicio: '',
      fechaFinEstimada: null,
      jornalesTotales: 0,
      presupuestoSeleccionado: null,
      fechaProbableInicioInput: '',
      modalVisible: false
    });

    showNotification(`? Planificaci?n confirmada: ${diasHabiles} d?as h?biles (${semanasCalculadas} semanas, ${capacidadNecesaria} jornales/d?a)`, 'success');

    console.log('?? Configuraci?n guardada:', nuevaConfiguracion);
  };

  // Helper para formatear direcci?n de obra
  const formatearDireccionObra = (obra) => {
    const partes = [
      obra.direccionObraCalle,
      obra.direccionObraAltura,
      obra.direccionObraTorre ? `Torre ${obra.direccionObraTorre}` : '',
      obra.direccionObraPiso ? `Piso ${obra.direccionObraPiso}` : '',
      obra.direccionObraDepartamento ? `Depto ${obra.direccionObraDepartamento}` : '',
    ].filter(Boolean);

    const direccionCompleta = partes.join(' ');
    const localidad = obra.direccionObraLocalidad || obra.direccionObraBarrio;

    if (direccionCompleta && localidad) {
      return `${direccionCompleta}, ${localidad}`;
    } else if (direccionCompleta) {
      return direccionCompleta;
    } else if (localidad) {
      return localidad;
    }
    return '-';
  };

  // Renderizar fila expandida para trabajos extra y tareas leves
  const renderFilaExpandidaObra = (obra) => {
    return (
      <tr>
        <td colSpan="13" style={{ padding: '20px', backgroundColor: '#f8f9fa', borderLeft: '5px solid #667eea' }}>
          <div className="container-fluid">
            {/* Sección de Configuración y Planificación de Obra */}
            <div className="mb-4 p-3 border rounded bg-white">
              <div className="row align-items-center">
                <div className="col-md-8">
                  <h6 className="text-primary mb-1">
                    <i className="fas fa-cog me-2"></i>
                    Configuración y Planificación de Obra
                  </h6>
                  {obra?.fechaProbableInicio && obra?.tiempoEstimadoTerminacion ? (
                    <small className="text-success">
                      ✅ Configurado: {Math.ceil((obra.tiempoEstimadoTerminacion || 0) / 5)} semanas ({obra.tiempoEstimadoTerminacion || 0} días) - {(obra.profesionales?.length || 0)} profesional{obra.profesionales?.length !== 1 ? 'es' : ''} asignado{obra.profesionales?.length !== 1 ? 's' : ''}
                    </small>
                  ) : (
                    <small className="text-danger">
                      ⚠️ No hay fecha probable de inicio configurada
                    </small>
                  )}
                </div>
                <div className="col-md-4">
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-primary btn-sm flex-grow-1"
                      title="Reconfigurar planificación de la obra"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Crear objeto para configuración de planificación
                        const obraParaConfigurar = {
                          id: obra.id,
                          nombre: obra.nombre || obra.nombreObra,
                          direccion: obra.direccion || '',
                          presupuestoNoCliente: obra,
                          fechaProbableInicio: obra.fechaProbableInicio || '',
                          tiempoEstimadoTerminacion: obra.tiempoEstimadoTerminacion || 0,
                          _esTrabajoExtra: obra.esTrabajoExtra || false,
                          _esTrabajoAdicional: obra.esTrabajoExtra || false,
                          _trabajoExtraId: obra.id,
                          _trabajoAdicionalId: obra.id,
                          _obraOriginalId: obra.obraPadreId || obra.id_obra || obra.id
                        };
                        setObraParaConfigurar(obraParaConfigurar);
                        setMostrarModalConfiguracionObra(true);
                      }}
                    >
                      <i className="fas fa-calendar-plus me-1"></i>
                      Reconfigurar
                    </button>
                    <button
                      className="btn btn-sm text-white flex-grow-1"
                      title="Editar solo Fecha Probable de Inicio y Días Hábiles"
                      style={{ backgroundColor: '#FF6F00', border: 'none', fontWeight: 'bold' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setTrabajoExtraEditar({ ...obra, _editarSoloFechas: true });
                        setMostrarModalTrabajoExtra(true);
                      }}
                    >
                      <i className="fas fa-calendar-edit me-1"></i>
                      Modificar Fechas
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="row g-3">
              {/* COLUMNA IZQUIERDA: Asignaciones */}

              {/* Profesionales */}
              <div className="col-md-6">
                <h6 className="text-muted mb-2">
                  <i className="fas fa-users-cog me-2"></i>
                  Profesionales
                </h6>
                <button
                  className={`btn btn-sm w-100 d-flex justify-content-between align-items-center ${obtenerConfiguracionObra(obra.id) ? 'btn-outline-success' : 'btn-outline-secondary'}`}
                  onClick={async (e) => {
                    e.stopPropagation();
                    const config = obtenerConfiguracionObra(obra.id);
                    if (!config) {
                      showNotification(' Primero configura la planificaci?n de la obra', 'warning');
                      return;
                    }

                    try {
                      const todosPresupuestos = await api.presupuestosNoCliente.getAll(empresaId);
                      const presupuestoCompleto = todosPresupuestos.find(p =>
                        p.obraId === obra.id || p.idObra === obra.id
                      );

                      let asignacionesActuales = [];
                      try {
                        const responseAsignaciones = await obtenerAsignacionesSemanalPorObra(obra.id, empresaId);
                        asignacionesActuales = responseAsignaciones?.data || responseAsignaciones || [];
                      } catch (error) {
                        console.warn(' No se pudieron cargar asignaciones:', error.message);
                      }

                      const obraEnriquecida = {
                        ...obra,
                        presupuestoNoCliente: presupuestoCompleto || obra.presupuestoNoCliente,
                        asignacionesActuales: asignacionesActuales
                      };

                      setObraParaAsignarProfesionales(obraEnriquecida);
                    } catch (error) {
                      console.error('Error cargando presupuesto:', error);
                      setObraParaAsignarProfesionales(obra);
                    }

                    setMostrarModalAsignarProfesionalesSemanal(true);
                  }}
                  title={obtenerConfiguracionObra(obra.id) ? "Asignar profesionales" : "Configura primero la obra"}
                  disabled={!obtenerConfiguracionObra(obra.id)}
                >
                  <span>
                    <i className="fas fa-user-plus me-1"></i>
                    Asignar Profesionales
                  </span>
                  <span className="badge bg-success d-flex align-items-center gap-1">
                    {contarProfesionalesAsignados(obra.id)?.count || 0}
                    {(() => {
                      const estado = calcularEstadoTiempoObra(obra.id);
                      return estado.emoji ? (
                        <span
                          title={estado.tooltip}
                          style={{ fontSize: '0.9rem', marginLeft: '2px' }}
                        >
                          {estado.emoji}
                        </span>
                      ) : null;
                    })()}
                  </span>
                </button>
              </div>

              {/* COLUMNA DERECHA: Otros */}

              {/* Presupuestos */}
              <div className="col-md-6">
                <h6 className="text-muted mb-2">
                  <i className="fas fa-file-invoice-dollar me-2"></i>
                  Presupuestos
                </h6>
                <button
                  className="btn btn-sm btn-outline-primary w-100 d-flex justify-content-between align-items-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleVerPresupuestosObra(obra);
                  }}
                >
                  <span>
                    <i className="fas fa-eye me-2"></i>
                    Ver Presupuestos
                  </span>
                  <span className="badge bg-primary">{contarPresupuestosObra(obra.id)}</span>
                </button>
              </div>

              {/* Materiales */}
              <div className="col-md-6">
                <h6 className="text-muted mb-2">
                  <i className="fas fa-box me-2"></i>
                  Materiales
                </h6>
                <button
                  className={`btn btn-sm w-100 d-flex justify-content-between align-items-center ${obtenerConfiguracionObra(obra.id) ? 'btn-outline-warning' : 'btn-outline-secondary'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    const config = obtenerConfiguracionObra(obra.id);
                    if (!config) {
                      showNotification(' Primero configura la planificaci?n de la obra', 'warning');
                      return;
                    }
                    setObraParaAsignarMateriales(obra);
                    setMostrarModalAsignarMateriales(true);
                  }}
                  disabled={!obtenerConfiguracionObra(obra.id)}
                >
                  <span>
                    <i className="fas fa-boxes me-2"></i>
                    Asignar Materiales
                  </span>
                  <span className="badge bg-warning text-dark">{contarMaterialesAsignados(obra.id)}</span>
                </button>
              </div>

              {/* Adicionales Obra */}
              <div className="col-md-6">
                <h6 className="text-muted mb-2">
                  <i className="fas fa-tools me-2"></i>
                  Adicionales Obra
                </h6>
                <button
                  className="btn btn-sm btn-outline-secondary w-100 d-flex justify-content-between align-items-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedObraId(obra.id);
                    setObraParaTrabajosExtra(obra);
                    cargarTrabajosExtra(obra);
                    dispatch(setActiveTab('trabajos-extra'));
                  }}
                >
                  <span>
                    <i className="fas fa-wrench me-2"></i>
                    Gestionar Adicionales Obra
                  </span>
                  <span className="badge bg-secondary">{contarTrabajosExtraObra(obra.id)}</span>
                </button>
              </div>

              {/* Gastos Generales */}
              <div className="col-md-6">
                <h6 className="text-muted mb-2">
                  <i className="fas fa-receipt me-2"></i>
                  Gastos Generales
                </h6>
                <button
                  className={`btn btn-sm w-100 d-flex justify-content-between align-items-center ${obtenerConfiguracionObra(obra.id) ? 'btn-outline-danger' : 'btn-outline-secondary'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    const config = obtenerConfiguracionObra(obra.id);
                    if (!config) {
                      showNotification(' Primero configura la planificaci?n de la obra', 'warning');
                      return;
                    }
                    setObraParaAsignarGastos(obra);
                    setMostrarModalAsignarGastos(true);
                  }}
                  disabled={!obtenerConfiguracionObra(obra.id)}
                >
                  <span>
                    <i className="fas fa-dollar-sign me-2"></i>
                    Asignar Gastos
                  </span>
                  <span className="badge bg-danger">{contarGastosAsignados(obra.id)}</span>
                </button>
              </div>

              {/* Etapas Diarias */}
              <div className="col-md-6">
                <h6 className="text-muted mb-2">
                  <i className="fas fa-calendar-alt me-2"></i>
                  Etapas Diarias
                </h6>
                <button
                  className="btn btn-sm btn-outline-info w-100 d-flex justify-content-between align-items-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedObraId(obra.id);
                    cargarEtapasDiarias(obra);
                    dispatch(setActiveTab('etapas-diarias'));
                  }}
                >
                  <span>
                    <i className="fas fa-calendar-plus me-2"></i>
                    Gestionar Etapas
                  </span>
                  <span className="badge bg-info">{contarEtapasDiariasObra(obra.id)}</span>
                </button>
              </div>

              {/* Tareas Leves */}
              <div className="col-md-6">
                <h6 className="text-muted mb-2">
                  <i className="fas fa-clipboard-list me-2"></i>
                  Tareas Leves
                </h6>
                <button
                  className="btn btn-sm btn-outline-primary w-100 d-flex justify-content-between align-items-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedObraId(obra.id);

                    if (obra.esTrabajoExtra && obra.obraPadreId) {
                      const obraConContextoTrabajoExtra = {
                        ...obra,
                        id: obra.obraPadreId,
                        _esTrabajoExtra: true,
                        _esTrabajoAdicional: true,  // ? Nueva nomenclatura
                        _trabajoExtraId: obra.id,  // Legacy
                        _trabajoAdicionalId: obra.id,  // ? Nuevo campo del backend
                        _trabajoExtraNombre: obra.nombre
                      };
                      setObraParaTrabajosAdicionales(obraConContextoTrabajoExtra);
                    } else {
                      setObraParaTrabajosAdicionales(obra);
                    }

                    abrirModalTareaLeveDirecto(obra);
                  }}
                >
                  <span>
                    <i className="fas fa-plus-square me-2"></i>
                    Gestionar Tareas Leves
                  </span>
                  <span className="badge bg-primary">
                    {obra.esTrabajoExtra
                      ? trabajosAdicionales.filter(ta => ta.trabajoExtraId === obra.id).length
                      : contarTrabajosAdicionalesObra(obra.id)}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="container-fluid" style={{padding: '0'}} onClick={() => setSelectedObraId(null)}>
      <div className="row mb-4" style={{margin: '0', padding: '0 15px'}}>
        <div className="col-12">
          <h2>
            <i className="fas fa-building me-2"></i>
            Gesti?n de Obras
          </h2>
        </div>
      </div>

      {/* Contenido seg?nn activeTab */}
      {activeTab === 'lista' && (
          <div className="row" style={{margin: '0'}}>
            <div className="col-12" style={{padding: '0'}}>
              <div className="card" style={{margin: '0', border: 'none'}} onClick={(e) => e.stopPropagation()}>
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">Lista de Obras</h5>
                  <div className="d-flex align-items-center gap-2">
                    <label className="mb-0 me-2 text-muted small">Filtrar:</label>
                    <select
                      className="form-select form-select-sm"
                      style={{width: 'auto'}}
                      value={estadoFilter}
                      onChange={(e) => dispatch(setEstadoFilter(e.target.value))}
                    >
                      <option value="todas">Todas</option>
                      <option value="activas">Solo Activas</option>
                      {estadosDisponibles.map(estado => (
                        <option key={estado} value={estado}>{estado}</option>
                      ))}
                    </select>
                    <button
                      className="btn btn-sm btn-outline-info"
                      onClick={() => {
                        // Filtrar obras creadas manualmente (sin presupuesto)
                        const obrasManuales = obras.filter(obra => {
                          const tienePresupuesto = (presupuestosObras[obra.id] && typeof presupuestosObras[obra.id] === 'object') ||
                                                  (obra.presupuestoNoCliente && typeof obra.presupuestoNoCliente === 'object');
                          return !tienePresupuesto;
                        });

                        if (obrasManuales.length === 0) {
                          showNotification('?? No hay obras independientes (sin presupuesto)', 'info');
                          return;
                        }

                        dispatch(setActiveTab('obras-manuales'));
                      }}
                      title="Ver obras independientes (sin presupuesto previo)"
                    >
                      <i className="fas fa-folder me-1"></i>
                      Obras Independientes ({obras.filter(obra => {
                        const tienePresupuesto = (presupuestosObras[obra.id] && typeof presupuestosObras[obra.id] === 'object') ||
                                                (obra.presupuestoNoCliente && typeof obra.presupuestoNoCliente === 'object');
                        return !tienePresupuesto;
                      }).length})
                    </button>
                    <button
                      className="btn btn-sm btn-outline-primary"
                      onClick={cargarObrasSegunFiltro}
                      title="Recargar obras"
                    >
                      <i className="fas fa-sync-alt"></i>
                    </button>
                  </div>
                </div>
                <div className="card-body" style={{padding: '0'}}>
                  {loading ? (
                    <div className="text-center">
                      <div className="spinner-border" role="status">
                        <span className="visually-hidden">Cargando...</span>
                      </div>
                    </div>
                  ) : error ? (
                    <div className="alert alert-danger text-center">
                      {error}
                    </div>
                  ) : obras.length === 0 ? (
                    <div className="text-center text-muted py-4">
                      <i className="fas fa-building fa-3x mb-3"></i>
                      <p>No hay obras para mostrar.</p>
                    </div>
                  ) : (
                    <>
                      {/* Estilos personalizados para hover celeste */}
                      <style>{`
                        .table-hover tbody tr:hover td {
                          background-color: #d1ecf1 !important;
                        }
                      `}</style>

                      <div className="table-responsive" style={{margin: '0'}}>
                      <table className="table table-striped table-hover" style={{marginBottom: '0'}}>
                        <thead className="table-light" onClick={(e) => { e.stopPropagation(); setSelectedObraId(null); }} style={{ cursor: 'pointer' }} title="Clic para deseleccionar">
                          <tr>
                            <th style={{ width: '25px', padding: '8px 4px' }} className="small"></th>
                            <th style={{ width: '40px' }} className="small">ID</th>
                            <th style={{ width: '140px' }} className="small">Nombre de la Obra</th>
                            <th style={{ width: '120px' }} className="small">Nombre del Solicitante</th>
                            <th className="small">Direcci?n</th>
                            <th style={{ width: '80px' }} className="small">Contacto</th>
                            <th style={{ width: '70px' }} className="small" title="Trabajos Adicionales">T. Adic.</th>
                            <th style={{ width: '80px' }} className="small">Estado</th>
                            <th style={{ width: '100px' }} className="small">Asignaciones</th>
                            <th style={{ width: '80px' }} className="small">Inicio</th>
                            <th style={{ width: '80px' }} className="small">Fin</th>
                            <th style={{ width: '90px' }} className="small">Cliente</th>
                            <th style={{ width: '110px' }} className="text-end small">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            // ?? ORDENAMIENTO INTELIGENTE: Agrupar obras de trabajo extra con sus obras padre
                            // ?? Detecci?n de subobras por NOMBRE (adem?s del flag esTrabajoExtra)
                            const todasObrasActivas = obras.filter(o => o.estado !== 'CANCELADO').sort((a, b) => a.id - b.id);
                            const obrasCanceladas = obras.filter(o => o.estado === 'CANCELADO');

                            // ?? Marcar subobras detectadas por patr?n de nombre
                            const subobrasDetectadas = new Set();
                            todasObrasActivas.forEach(posibleSubobra => {
                              todasObrasActivas.forEach(posiblePadre => {
                                if (posibleSubobra.id !== posiblePadre.id) {
                                  const nombreSubobra = (posibleSubobra.nombre || '').trim();
                                  const nombrePadre = (posiblePadre.nombre || '').trim();
                                  // Detectar si el nombre de la posible subobra empieza con el nombre del padre + espacio
                                  if (nombreSubobra && nombrePadre && nombreSubobra.startsWith(nombrePadre + ' ')) {
                                    subobrasDetectadas.add(posibleSubobra.id);
                                    // Asignar referencia de obra padre si no existe
                                    if (!posibleSubobra.obraPadreId && !posibleSubobra.obra_padre_id && !posibleSubobra.idObraPadre) {
                                      posibleSubobra._obraPadreDetectada = posiblePadre.id;
                                    }
                                  }
                                }
                              });
                            });

                            // Separar obras normales de trabajos extra (incluyendo detección automática)
                            const obrasNormales = todasObrasActivas.filter(o => {
                              const esTrabajoExtraExplicito = o.esTrabajoExtra;
                              const esSubobraDetectada = subobrasDetectadas.has(o.id);

                              return !esTrabajoExtraExplicito && !esSubobraDetectada;
                            }).sort((a, b) => a.id - b.id);

                            const obrasTrabajoExtra = todasObrasActivas.filter(o => {
                              const esTrabajoExtraExplicito = o.esTrabajoExtra;
                              const esSubobraDetectada = subobrasDetectadas.has(o.id);

                              return (esTrabajoExtraExplicito || esSubobraDetectada);
                            });

                            const listaOrdenada = [];

                            // ?? Para cada obra normal, agregar la obra y sus trabajos extra con metadatos de grupo
                            let grupoIndex = 2; // ?? Sincronizar con ?ndice de grupos de obra en p?gina de Presupuestos

                            obrasNormales.forEach(obraPadre => {
                              // Buscar trabajos extra/sub-obras de esta obra
                              const trabajosExtraDeEstaObra = obrasTrabajoExtra.filter(te => {
                                // Buscar por obra_origen_id, obraPadreId o detecci?n
                                const origenId = te.obraOrigenId || te.obra_origen_id;
                                const padreId = te.obraPadreId || te.obra_padre_id || te.idObraPadre;
                                const padreDetectado = te._obraPadreDetectada;

                                return origenId === obraPadre.id || padreId === obraPadre.id || padreDetectado === obraPadre.id;
                              });

                              const tieneSubObras = trabajosExtraDeEstaObra.length > 0;
                              const totalEnGrupo = tieneSubObras ? trabajosExtraDeEstaObra.length + 1 : 1;

                              // ?? Agregar obra PADRE primero (ARRIBA)
                              listaOrdenada.push({
                                ...obraPadre,
                                _grupoObra: tieneSubObras ? obraPadre.id : null,
                                _grupoTipo: 'obra',
                                _grupoIndex: grupoIndex,
                                _primerEnGrupo: true,
                                _ultimoEnGrupo: !tieneSubObras,
                                _totalEnGrupo: totalEnGrupo
                              });

                              if (tieneSubObras) {
                                // ?? Ordenar trabajos extra por ID ASCENDENTE (del m?s antiguo al m?s nuevo)
                                // Esto asegura que las sub-obras aparezcan DEBAJO de la obra padre
                                trabajosExtraDeEstaObra.sort((a, b) => a.id - b.id);

                                // Agregar SUB-OBRAS debajo de la obra padre
                                trabajosExtraDeEstaObra.forEach((te, idx) => {
                                  listaOrdenada.push({
                                    ...te,
                                    _grupoObra: obraPadre.id,
                                    _grupoTipo: 'trabajoExtra',
                                    _grupoIndex: grupoIndex,
                                    _primerEnGrupo: false,
                                    _ultimoEnGrupo: idx === trabajosExtraDeEstaObra.length - 1,
                                    _totalEnGrupo: totalEnGrupo
                                  });
                                });

                                grupoIndex++;
                              } else if (!tieneSubObras) {
                                grupoIndex++;
                              }
                            });

                            // ?? Crear Set con IDs de obras ya agregadas para evitar duplicados
                            const obrasYaAgregadas = new Set(listaOrdenada.map(o => o.id));

                            // Agregar trabajos extra hu?rfanos (sin obra padre Y que no fueron agregados ya)
                            const trabajosExtraHuerfanos = obrasTrabajoExtra.filter(te => {
                              // Si ya fue agregado en un grupo, excluir
                              if (obrasYaAgregadas.has(te.id)) return false;

                              const obraPadreId = te.obraPadreId || te.obra_padre_id || te.idObraPadre || te._obraPadreDetectada;
                              return !obraPadreId || !obrasNormales.find(op => op.id === obraPadreId);
                            });

                            if (trabajosExtraHuerfanos.length > 0) {
                              trabajosExtraHuerfanos.sort((a, b) => b.id - a.id);
                              trabajosExtraHuerfanos.forEach(te => {
                                listaOrdenada.push({
                                  ...te,
                                  _grupoObra: null,
                                  _grupoIndex: grupoIndex,
                                  _primerEnGrupo: true,
                                  _ultimoEnGrupo: true,
                                  _totalEnGrupo: 1
                                });
                                grupoIndex++;
                              });
                            }

                            // Agregar obras canceladas al final
                            obrasCanceladas.forEach(oc => {
                              listaOrdenada.push({
                                ...oc,
                                _grupoObra: null,
                                _grupoIndex: grupoIndex,
                                _primerEnGrupo: true,
                                _ultimoEnGrupo: true,
                                _totalEnGrupo: 1
                              });
                              grupoIndex++;
                            });

                            return listaOrdenada;
                          })()
                          .filter(obra => {
                            // ?? EXCLUIR sub-obras que ya se renderizan en subgrupos colapsables
                            // Solo excluir trabajos extra que pertenecen a un grupo (tienen obra padre)
                            const esSubobraDeGrupo = obra._grupoTipo === 'trabajoExtra' && obra._grupoObra !== null;
                            return !esSubobraDeGrupo;
                          })
                          .map((obra, index, array) => {
                            const obraId = obra.id;
                            const isSelected = selectedObraId && obraId && selectedObraId === obraId;

                            // ?? Determinar si es subobra/trabajo extra (expl?cito o detectado)
                            const esSubobra = obra.esTrabajoExtra || obra._grupoTipo === 'trabajoExtra';

                            // ?? Determinar informaci?n de grupo para estilos visuales
                            const perteneceAGrupo = obra._grupoObra !== null;
                            const esPrimerEnGrupo = obra._primerEnGrupo;
                            const esUltimoEnGrupo = obra._ultimoEnGrupo;
                            const grupoIndex = obra._grupoIndex || 0;
                            const totalEnGrupo = obra._totalEnGrupo || 1;

                            // ?? Verificar si es un cambio de grupo (comparar grupoIndex con el anterior)
                            const esCambioDeGrupo = index > 0 && (
                              array[index - 1]._grupoIndex !== obra._grupoIndex
                            );

                            // Colores alternados para grupos (m?s visibles)
                            const coloresGrupo = [
                              '#e9ecef', // Gris claro
                              '#d1e7ff', // Azul claro
                              '#ffe8cc', // Naranja claro
                              '#d4edda', // Verde claro
                              '#f8d7da', // Rosa claro
                              '#e7d6ff'  // P?rpura claro
                            ];

                            // ?? Funci?n helper para ajustar brillo (oscurecer/aclarar)
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

                            // ?? Color base del grupo
                            const colorBaseGrupo = coloresGrupo[grupoIndex % coloresGrupo.length];

                            // ?? Alternar tonalidades dentro del grupo
                            let colorGrupo = '#ffffff';

                            if (perteneceAGrupo) {
                              // M?s simple: Si es el primero del grupo -> color claro, si no -> color oscuro
                              if (obra._primerEnGrupo) {
                                colorGrupo = colorBaseGrupo;
                              } else {
                                colorGrupo = adjustColorBrightness(colorBaseGrupo, -15);
                              }
                            }

                            return (
                            <React.Fragment key={obraId}>
                              {/* ?? Separador visual entre grupos - se muestra ANTES del primer elemento del nuevo grupo */}
                              {esCambioDeGrupo && index > 0 && (
                                <tr style={{ height: '10px', backgroundColor: '#000000' }}><td colSpan="13" style={{
                                    padding: 0,
                                    height: '10px',
                                    borderTop: '4px solid #000000',
                                    borderBottom: '4px solid #000000',
                                    backgroundColor: '#212529'
                                  }}></td></tr>
                              )}

                              {/* ?? L?nea delgada entre obras del mismo grupo */}
                              {index > 0 && perteneceAGrupo &&
                               array[index - 1] &&
                               array[index - 1]._grupoIndex === obra._grupoIndex &&
                               !esCambioDeGrupo && (
                                <tr style={{ height: '5px', backgroundColor: '#fed7aa' }}>{/* Naranja m?s claro */}<td colSpan="13" style={{
                                    padding: 0,
                                    height: '5px',
                                    borderTop: '2px solid #f97316',
                                    backgroundColor: '#fed7aa'  /* Naranja m?s claro */
                                  }}></td></tr>
                              )}

                              <tr
                                onClick={(e) => {
                                  e.stopPropagation();

                                  // Toggle: si ya est? seleccionado, deseleccionar; si no, seleccionar
                                  if (isSelected) {
                                    setSelectedObraId(null);
                                  } else {
                                    setSelectedObraId(obraId);
                                  }
                                }}
                                style={{
                                  cursor: 'pointer',
                                  backgroundColor: isSelected ? '#cfe2ff' : colorGrupo,
                                  borderLeft: esSubobra
                                    ? '5px solid #ffc107'
                                    : (perteneceAGrupo ? '4px solid #6c757d' : 'none'),
                                  borderBottom: obtenerTareasParaSubgrupo(obra).length > 0
                                    ? '1px solid rgba(253, 126, 20, 0.45)'
                                    : undefined,
                                  transition: 'all 0.2s ease'
                                }}
                                className={`${perteneceAGrupo ? '' : 'hover-row'} ${isSelected ? 'table-primary' : ''}`}
                              >
                                <td
                                  onClick={(e) => toggleObraExpandida(obra.id, e)}
                                  style={{ cursor: 'pointer' }}
                                  className="text-center"
                                >
                                  <button
                                    className="btn btn-sm btn-primary rounded-circle p-0"
                                    style={{
                                      width: '30px',
                                      height: '30px',
                                      transition: 'all 0.3s ease'
                                    }}
                                    title={obrasExpandidas.has(obra.id) ? 'Ocultar detalles' : 'Ver detalles'}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                  >
                                    <i className={`fas fa-${obrasExpandidas.has(obra.id) ? 'minus' : 'plus'} text-white`}></i>
                                  </button>
                                </td>
                                <td>
                                  {perteneceAGrupo && esPrimerEnGrupo && totalEnGrupo > 1 && (
                                    <span className="text-primary me-1" title={`Grupo de ${totalEnGrupo} obra(s) (1 padre + ${totalEnGrupo - 1} sub-obra(s))`}>
                                      <i className="fas fa-building" style={{fontSize: '0.9em', fontWeight: 'bold'}}></i>
                                    </span>
                                  )}
                                  {perteneceAGrupo && !esPrimerEnGrupo && totalEnGrupo > 1 && (
                                    <span className="text-warning me-1" title="Sub-obra del grupo anterior">
                                      <i className="fas fa-level-down-alt" style={{fontSize: '0.7em'}}></i>
                                    </span>
                                  )}
                                  {esSubobra && (
                                    <span className="text-warning me-1" title="Trabajo extra de obra anterior">
                                      <i className="fas fa-level-up-alt" style={{transform: 'rotate(90deg)', fontSize: '0.8em'}}></i>
                                    </span>
                                  )}
                                  {isSelected && <i className="fas fa-check-circle text-success me-1" title="Seleccionado"></i>}
                                  {obraId}
                              </td>
                              <td>
                                {obra.nombre}
                                {(() => {
                                  // Solo mostrar badge OBRA PADRE si NO tiene presupuesto que defina el tipo
                                  const presupuesto = presupuestosObras[obra.id];
                                  const tienePresupuestoConTipo = presupuesto &&
                                    typeof presupuesto === 'object' &&
                                    (presupuesto.es_presupuesto_trabajo_extra !== undefined ||
                                     presupuesto.esPresupuestoTrabajoExtra !== undefined);

                                  return !tienePresupuestoConTipo && perteneceAGrupo && esPrimerEnGrupo && totalEnGrupo > 1 && (
                                    <div className="mt-1">
                                      <span className="badge" style={{
                                        fontSize: '0.7em',
                                        padding: '4px 8px',
                                        backgroundColor: '#17a2b8',
                                        color: '#fff',
                                        fontWeight: 'bold',
                                        border: '1px solid #138496'
                                      }}>
                                        <i className="fas fa-building me-1"></i>
                                        OBRA PADRE: {totalEnGrupo - 1} sub-obra{totalEnGrupo - 1 > 1 ? 's' : ''}
                                      </span>
                                    </div>
                                  );
                                })()}
                                {/* Badge basado en es_presupuesto_trabajo_extra */}
                                {(() => {
                                  const presupuesto = presupuestosObras[obra.id];
                                  if (presupuesto && typeof presupuesto === 'object') {
                                    const esTrabajoExtra = presupuesto.es_presupuesto_trabajo_extra === true ||
                                                          presupuesto.esPresupuestoTrabajoExtra === true ||
                                                          presupuesto.esPresupuestoTrabajoExtra === 'V';

                                    const esTareaLeve = presupuesto.tipo_presupuesto === 'TAREA_LEVE' ||
                                                       presupuesto.tipoPresupuesto === 'TAREA_LEVE';

                                    if (esTareaLeve) {
                                      return (
                                        <div className="mt-1">
                                          <span className="badge bg-info text-dark" style={{fontSize: '0.7rem', padding: '3px 8px'}}>
                                            <i className="fas fa-bolt me-1"></i>Tarea Leve
                                          </span>
                                        </div>
                                      );
                                    } else if (esTrabajoExtra) {
                                      return (
                                        <div className="mt-1">
                                          <span className="badge bg-warning text-dark" style={{fontSize: '0.7rem', padding: '3px 8px'}}>
                                            <i className="fas fa-wrench me-1"></i>Adicional Obra
                                          </span>
                                        </div>
                                      );
                                    } else {
                                      return (
                                        <div className="mt-1">
                                          <span className="badge bg-primary text-white" style={{fontSize: '0.7rem', padding: '3px 8px'}}>
                                            <i className="fas fa-building me-1"></i>Obra Principal
                                          </span>
                                        </div>
                                      );
                                    }
                                  } else {
                                    // Sin presupuesto = Trabajo Diario (obra independiente/manual)
                                    return (
                                      <div className="mt-1">
                                        <span className="badge bg-warning text-dark" style={{fontSize: '0.7rem', padding: '3px 8px'}}>
                                          <i className="fas fa-hand-paper me-1"></i>Trabajo Diario
                                        </span>
                                      </div>
                                    );
                                  }
                                })()}
                              </td>
                              <td>
                                <small className="text-muted">
                                  {obra.nombreSolicitante || '-'}
                                </small>
                              </td>
                              <td>
                                <small className="text-muted">{formatearDireccionObra(obra)}</small>
                              </td>
                              <td>
                                {(obra.nombreSolicitante || obra.telefono || obra.mail) ? (
                                  <div className="d-flex flex-column" style={{minWidth: '150px'}}>
                                    {obra.nombreSolicitante && (
                                      <small className="text-muted mb-1">
                                        <i className="fas fa-user me-1"></i>
                                        {obra.nombreSolicitante}
                                      </small>
                                    )}
                                    {obra.telefono && (
                                      <small>
                                        <a
                                          href={`https://wa.me/${obra.telefono.replace(/\D/g, '')}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-success text-decoration-none"
                                          title="Abrir WhatsApp"
                                        >
                                          <i className="fab fa-whatsapp me-1"></i>
                                          {obra.telefono}
                                        </a>
                                      </small>
                                    )}
                                    {obra.mail && (
                                      <small>
                                        <a
                                          href={`mailto:${obra.mail}`}
                                          className="text-primary text-decoration-none"
                                          title="Enviar email"
                                        >
                                          <i className="fas fa-envelope me-1"></i>
                                          {obra.mail}
                                        </a>
                                      </small>
                                    )}
                                  </div>
                                ) : (
                                  <small className="text-muted">-</small>
                                )}
                              </td>
                              <td className="text-center">
                                {(() => {
                                  // Detectar si es trabajo extra
                                  const esTrabajoExtra = obra._esTrabajoExtra || obra.esObraTrabajoExtra || obra.es_obra_trabajo_extra || obra.esTrabajoExtra;
                                  const cantidadTA = esTrabajoExtra
                                    ? contarTrabajosAdicionalesTrabajoExtra(obra.id)
                                    : contarTrabajosAdicionalesObra(obra.id);
                                  if (cantidadTA > 0) {
                                    return (
                                      <span className="badge bg-info text-dark" style={{ fontSize: '0.75rem' }} title={`${cantidadTA} trabajo${cantidadTA > 1 ? 's' : ''} adicional${cantidadTA > 1 ? 'es' : ''}`}>
                                        <i className="fas fa-tasks me-1"></i>
                                        {cantidadTA}
                                      </span>
                                    );
                                  } else {
                                    return <small className="text-muted">-</small>;
                                  }
                                })()}
                              </td>
                              <td onClick={(e) => e.stopPropagation()}>
                                <EstadoPresupuestoBadge obraId={obra.id} estadoObra={obra.estado} />
                              </td>
                              <td onClick={(e) => e.stopPropagation()}>
                                <EstadoAsignacionBadge obraId={obra.id} compact={false} />
                              </td>
                              <td>
                                <small>
                                  {(() => {
                                    const presupuesto = presupuestosObras[obra.id];
                                    const fechaInicio = presupuesto?.fechaProbableInicio;
                                    if (fechaInicio) {
                                      const fecha = parseFechaLocal(fechaInicio);
                                      return fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                    }
                                    if (obra.fechaInicio) {
                                      const fecha = parseFechaLocal(obra.fechaInicio);
                                      return fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                    }
                                    return 'N/A';
                                  })()}
                                </small>
                              </td>
                              <td>
                                <small>
                                  {(() => {
                                    const fechaFin = calcularFechaFinEstimada(obra);
                                    if (fechaFin) {
                                      return fechaFin.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                    }
                                    if (obra.fechaFin) {
                                      const fecha = parseFechaLocal(obra.fechaFin);
                                      return fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                    }
                                    return 'N/A';
                                  })()}
                                </small>
                              </td>
                              <td>
                                <small>{getClienteInfo(obra)}</small>
                              </td>
                              <td className="text-end">
                                {(() => {
                                  // Obtener presupuesto vinculado - usar ?? para no sobrescribir con null
                                  const presupuesto = presupuestosObras[obra.id] ?? obra.presupuestoNoCliente;
                                  const tienePresupuesto = presupuesto && typeof presupuesto === 'object';

                                  // Obtener total del presupuesto usando la función helper
                                  let total = 0;

                                  if (tienePresupuesto) {
                                    // ✅ CALCULAR SIEMPRE usando obtenerTotalPresupuesto() para evitar inconsistencias
                                    total = obtenerTotalPresupuesto(presupuesto);
                                  }

                                  // Si el presupuesto no tiene total o es 0, usar presupuestoEstimado de la obra (SOLO como último recurso)
                                  if (!total || total === 0) {
                                    total = Number(obra.totalPresupuesto ?? obra.presupuestoEstimado ?? 0);
                                  }

                                  if (total > 0) {
                                    // Determinar tipo de presupuesto
                                    const modoPresupuesto = presupuesto?.modoPresupuesto || presupuesto?.modo_presupuesto;
                                    const esGlobal = modoPresupuesto === 'TRADICIONAL';
                                    const tieneDescuentos = tienePresupuesto && (presupuesto.totalFinal || presupuesto.totalConDescuentos) &&
                                                           total < (presupuesto.totalPresupuestoConHonorarios || presupuesto.total_presupuesto_con_honorarios || total);

                                    return (
                                      <div>
                                        <div className="fw-bold text-primary">
                                          ${Number(total).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                          {tieneDescuentos && (
                                            <span className="ms-1" title="Incluye descuentos aplicados" style={{fontSize: '0.85em', opacity: 0.65}}>
                                              ???
                                            </span>
                                          )}
                                        </div>
                                        {tienePresupuesto && (
                                          <div className="mt-1">
                                            <span className={`badge ${esGlobal ? 'bg-secondary' : 'bg-primary'} text-white`} style={{fontSize: '0.7em'}}>
                                              <i className={`fas fa-${esGlobal ? 'globe' : 'list'} me-1`}></i>
                                              {esGlobal ? 'Global' : 'Detallado'}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  } else {
                                    return (
                                      <span className="badge bg-warning text-dark" style={{fontSize: '0.65em', padding: '3px 5px'}}>
                                        <i className="fas fa-hand-paper me-1"></i>Sin Presupuesto
                                      </span>
                                    );
                                  }
                                })()}
                              </td>
                            </tr>

                            {/* Fila expandible con detalles */}
                            {obrasExpandidas.has(obra.id) && (
                              <tr>
                                <td colSpan="11" className="p-0">
                                  <div className="bg-light p-3 border-top">
                                    {/* CONFIGURACI�N GLOBAL DE OBRA */}
                                    <div className="mb-4 p-3 border rounded bg-white">
                                      <div className="row align-items-center">
                                        <div className="col-md-8">
                                          <h6 className="text-primary mb-1">
                                            <i className="fas fa-cog me-2"></i>
                                            Configuraci?n y Planificaci?n de Obra
                                          </h6>
                                          {(() => {
                                            const config = obtenerConfiguracionObra(obra.id);
                                            const profesionalesAsignados = contarProfesionalesAsignados(obra.id)?.count || 0;
                                            const presupuesto = presupuestosObras[obra.id] || obra.presupuestoNoCliente;

                                            // ? VALIDAR: Solo mostrar configuraci?n si el presupuesto tiene fechas
                                            if (config && presupuesto?.fechaProbableInicio && presupuesto?.tiempoEstimadoTerminacion) {
                                              // ?? CALCULAR SEMANAS desde presupuesto usando funci?n centralizada
                                              const diasHabiles = config.diasHabiles || presupuesto.tiempoEstimadoTerminacion || 0;

                                              let semanasReales = config.semanasObjetivo; // Fallback

                                              if (diasHabiles > 0) {
                                                semanasReales = recalcularSemanasDesdePresupuesto(presupuesto);
                                              }

                                              // Calcular d?as h?biles aproximados basados en las semanas (5 d?as/semana)
                                              const diasHabilesAprox = semanasReales * 5;

                                              return (
                                                <small className="text-success">
                                                  ? Configurado: {semanasReales} semanas ({diasHabilesAprox} d?as)
                                                  - {profesionalesAsignados} profesional{profesionalesAsignados !== 1 ? 'es' : ''} asignado{profesionalesAsignados !== 1 ? 's' : ''}
                                                </small>
                                              );
                                            }

                                            //  Si no tiene fechas, mostrar advertencia clara
                                            if (config && presupuesto && !presupuesto?.fechaProbableInicio) {
                                              return (
                                                <small className="text-danger">
                                                   El presupuesto no tiene fecha probable de inicio configurada
                                                </small>
                                              );
                                            }

                                            return (
                                              <small className="text-muted">
                                                Define el cronograma antes de asignar recursos
                                              </small>
                                            );
                                          })()}
                                        </div>
                                        <div className="col-md-4">
                                          <div className="d-flex gap-2">
                                            <button
                                              className="btn btn-primary btn-sm flex-grow-1"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleConfigurarObra(obra);
                                              }}
                                              title={obtenerConfiguracionObra(obra.id) ? 'Reconfigurar planificaci?n de la obra' : 'Configurar planificaci?n de la obra'}
                                            >
                                              <i className="fas fa-calendar-plus me-1"></i>
                                              {obtenerConfiguracionObra(obra.id) ? 'Reconfigurar' : 'Configurar Obra'}
                                            </button>
                                            {obtenerConfiguracionObra(obra.id) && (
                                              <button
                                                className="btn btn-sm text-white flex-grow-1"
                                                style={{ backgroundColor: '#FF6F00', border: 'none', fontWeight: 'bold' }}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleEditarSoloFechasObra(obra);
                                                }}
                                                title="Editar solo Fecha Probable de Inicio y D?as H?biles (sin cambiar versi?n ni estado)"
                                              >
                                                <i className="fas fa-calendar-edit me-1"></i>
                                                Modificar Fechas
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="row g-3">
                                      {/* COLUMNA IZQUIERDA: Asignaciones */}

                                      {/* Profesionales */}
                                      <div className="col-md-6">
                                        <h6 className="text-muted mb-2">
                                          <i className="fas fa-users-cog me-2"></i>
                                          Profesionales
                                        </h6>
                                        <button
                                          className={`btn btn-sm w-100 d-flex justify-content-between align-items-center ${obtenerConfiguracionObra(obra.id) ? 'btn-outline-success' : 'btn-outline-secondary'}`}
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            const config = obtenerConfiguracionObra(obra.id);
                                            if (!config) {
                                              showNotification(' Primero configura la planificaci?n de la obra', 'warning');
                                              return;
                                            }

                                            // ??"? Enriquecer obra con presupuesto completo Y asignaciones antes de abrir modal
                                            try {
                                              const todosPresupuestos = await api.presupuestosNoCliente.getAll(empresaId);
                                              const presupuestoCompleto = todosPresupuestos.find(p =>
                                                p.obraId === obra.id || p.idObra === obra.id
                                              );

                                              // ??"? NUEVO: Obtener asignaciones actuales de profesionales
                                              let asignacionesActuales = [];
                                              try {
                                                const responseAsignaciones = await obtenerAsignacionesSemanalPorObra(obra.id, empresaId);
                                                asignacionesActuales = responseAsignaciones?.data || responseAsignaciones || [];
                                                console.log('??"? Asignaciones actuales cargadas:', asignacionesActuales.length);
                                              } catch (error) {
                                                console.warn(' No se pudieron cargar asignaciones:', error.message);
                                              }

                                              const obraEnriquecida = {
                                                ...obra,
                                                presupuestoNoCliente: presupuestoCompleto || obra.presupuestoNoCliente,
                                                asignacionesActuales: asignacionesActuales
                                              };

                                              console.log('??" DEBUG - Obra enriquecida:', {
                                                obraId: obraEnriquecida.id,
                                                tienePresupuesto: !!obraEnriquecida.presupuestoNoCliente,
                                                fechaProbableInicio: obraEnriquecida.presupuestoNoCliente?.fechaProbableInicio,
                                                asignacionesActuales: asignacionesActuales.length
                                              });

                                              setObraParaAsignarProfesionales(obraEnriquecida);
                                            } catch (error) {
                                              console.error('Error cargando presupuesto:', error);
                                              setObraParaAsignarProfesionales(obra);
                                            }

                                            setMostrarModalAsignarProfesionalesSemanal(true);
                                          }}
                                          title={obtenerConfiguracionObra(obra.id) ? "Asignar profesionales" : "Configura primero la obra"}
                                          disabled={!obtenerConfiguracionObra(obra.id)}
                                        >
                                          <span>
                                            <i className="fas fa-user-plus me-1"></i>
                                            Asignar Profesionales
                                          </span>
                                          <span className="badge bg-success d-flex align-items-center gap-1">
                                            {contarProfesionalesAsignados(obra.id)?.count || 0}
                                            {(() => {
                                              const estado = calcularEstadoTiempoObra(obra.id);
                                              return estado.emoji ? (
                                                <span
                                                  title={estado.tooltip}
                                                  style={{ fontSize: '0.9rem', marginLeft: '2px' }}
                                                >
                                                  {estado.emoji}
                                                </span>
                                              ) : null;
                                            })()}
                                          </span>
                                        </button>
                                      </div>

                                      {/* COLUMNA DERECHA: Otros */}

                                      {/* Presupuestos o Presupuesto Estimado */}
                                      <div className="col-md-6">
                                        {(() => {
                                          // Verificar si es obra independiente (sin presupuesto vinculado)
                                          const tienePresupuesto = (presupuestosObras[obra.id] && typeof presupuestosObras[obra.id] === 'object') ||
                                                                  (obra.presupuestoNoCliente && typeof obra.presupuestoNoCliente === 'object');
                                          const esObraIndependiente = !tienePresupuesto;

                                          if (esObraIndependiente) {
                                            // Mostrar presupuesto estimado para obras independientes
                                            const presupuestoEstimado = obra.presupuestoEstimado || 0;
                                            return (
                                              <>
                                                <h6 className="text-muted mb-2">
                                                  <i className="fas fa-file-invoice-dollar me-2"></i>
                                                  Presupuesto Estimado
                                                </h6>
                                                <button
                                                  className="btn btn-sm btn-outline-primary w-100 d-flex justify-content-between align-items-center"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setModoEdicion(true);
                                                    setObraEditando(obra);
                                                    dispatch(setActiveTab('crear'));
                                                  }}
                                                >
                                                  <span>
                                                    <i className="fas fa-edit me-2"></i>
                                                    Ver Presupuesto
                                                  </span>
                                                  <span className="badge bg-primary">
                                                    ${presupuestoEstimado.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                  </span>
                                                </button>
                                              </>
                                            );
                                          } else {
                                            // Mostrar bot?n ver presupuestos para obras con presupuesto
                                            return (
                                              <>
                                                <h6 className="text-muted mb-2">
                                                  <i className="fas fa-file-invoice-dollar me-2"></i>
                                                  Presupuestos
                                                </h6>
                                                <button
                                                  className="btn btn-sm btn-outline-primary w-100 d-flex justify-content-between align-items-center"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleVerPresupuestosObra(obra);
                                                  }}
                                                >
                                                  <span>
                                                    <i className="fas fa-eye me-2"></i>
                                                    Ver Presupuestos
                                                  </span>
                                                  <span className="badge bg-primary">{contarPresupuestosObra(obra.id)}</span>
                                                </button>
                                              </>
                                            );
                                          }
                                        })()}
                                      </div>

                                      {/* Materiales */}
                                      <div className="col-md-6">
                                        <h6 className="text-muted mb-2">
                                          <i className="fas fa-box me-2"></i>
                                          Materiales
                                        </h6>
                                        <button
                                          className={`btn btn-sm w-100 d-flex justify-content-between align-items-center ${obtenerConfiguracionObra(obra.id) ? 'btn-outline-warning' : 'btn-outline-secondary'}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const config = obtenerConfiguracionObra(obra.id);
                                            if (!config) {
                                              showNotification(' Primero configura la planificaci?n de la obra', 'warning');
                                              return;
                                            }
                                            setObraParaAsignarMateriales(obra);
                                            setMostrarModalAsignarMateriales(true);
                                          }}
                                          disabled={!obtenerConfiguracionObra(obra.id)}
                                        >
                                          <span>
                                            <i className="fas fa-boxes me-2"></i>
                                            Asignar Materiales
                                          </span>
                                          <span className="badge bg-warning text-dark">{contarMaterialesAsignados(obra.id)}</span>
                                        </button>
                                      </div>

                                      {/* Adicionales Obra */}
                                      <div className="col-md-6">
                                        <h6 className="text-muted mb-2">
                                          <i className="fas fa-tools me-2"></i>
                                          Adicionales Obra
                                        </h6>
                                        <button
                                          className="btn btn-sm btn-outline-secondary w-100 d-flex justify-content-between align-items-center"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedObraId(obra.id);
                                            setObraParaTrabajosExtra(obra);
                                            cargarTrabajosExtra(obra);
                                            dispatch(setActiveTab('trabajos-extra'));
                                          }}
                                        >
                                          <span>
                                            <i className="fas fa-wrench me-2"></i>
                                            Gestionar Adicionales Obra
                                          </span>
                                          <span className="badge bg-secondary">{contarTrabajosExtraObra(obra.id)}</span>
                                        </button>
                                      </div>

                                      {/* Gastos Generales */}
                                      <div className="col-md-6">
                                        <h6 className="text-muted mb-2">
                                          <i className="fas fa-receipt me-2"></i>
                                          Gastos Generales
                                        </h6>
                                        <button
                                          className={`btn btn-sm w-100 d-flex justify-content-between align-items-center ${obtenerConfiguracionObra(obra.id) ? 'btn-outline-danger' : 'btn-outline-secondary'}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const config = obtenerConfiguracionObra(obra.id);
                                            if (!config) {
                                              showNotification(' Primero configura la planificaci?n de la obra', 'warning');
                                              return;
                                            }
                                            setObraParaAsignarGastos(obra);
                                            setMostrarModalAsignarGastos(true);
                                          }}
                                          disabled={!obtenerConfiguracionObra(obra.id)}
                                        >
                                          <span>
                                            <i className="fas fa-dollar-sign me-2"></i>
                                            Asignar Gastos
                                          </span>
                                          <span className="badge bg-danger">{contarGastosAsignados(obra.id)}</span>
                                        </button>
                                      </div>

                                      {/* Etapas Diarias */}
                                      <div className="col-md-6">
                                        <h6 className="text-muted mb-2">
                                          <i className="fas fa-calendar-alt me-2"></i>
                                          Etapas Diarias
                                        </h6>
                                        <button
                                          className="btn btn-sm btn-outline-info w-100 d-flex justify-content-between align-items-center"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedObraId(obra.id);
                                            cargarEtapasDiarias(obra);
                                            dispatch(setActiveTab('etapas-diarias'));
                                          }}
                                        >
                                          <span>
                                            <i className="fas fa-calendar-plus me-2"></i>
                                            Gestionar Etapas
                                          </span>
                                          <span className="badge bg-info">{contarEtapasDiariasObra(obra.id)}</span>
                                        </button>
                                      </div>

                                      {/* Tareas Leves */}
                                      <div className="col-md-6">
                                        <h6 className="text-muted mb-2">
                                          <i className="fas fa-clipboard-list me-2"></i>
                                          Tareas Leves
                                        </h6>
                                        <button
                                          className="btn btn-sm btn-outline-primary w-100 d-flex justify-content-between align-items-center"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedObraId(obra.id);

                                            // Si la obra es un trabajo extra, configurar correctamente las propiedades
                                            if (obra.esTrabajoExtra && obra.obraPadreId) {
                                              const obraConContextoTrabajoExtra = {
                                                ...obra,
                                                id: obra.obraPadreId,  // ID de la obra padre
                                                _esTrabajoExtra: true,
                                                _esTrabajoAdicional: true,  // ? Nueva nomenclatura
                                                _trabajoExtraId: obra.id,  // ID de la obra que es trabajo extra (legacy)
                                                _trabajoAdicionalId: obra.id,  // ? Nuevo campo del backend
                                                _trabajoExtraNombre: obra.nombre
                                              };
                                              console.log('?? Obra es trabajo extra, configurando contexto:', {
                                                trabajoExtraId: obra.id,
                                                obraPadreId: obra.obraPadreId,
                                                obraConContextoTrabajoExtra
                                              });
                                              setObraParaTrabajosAdicionales(obraConContextoTrabajoExtra);
                                            } else {
                                              setObraParaTrabajosAdicionales(obra);
                                            }

                                            // Abrir directamente el modal de PresupuestoNoClienteModal
                                            abrirModalTareaLeveDirecto(obra);
                                          }}
                                        >
                                          <span>
                                            <i className="fas fa-plus-square me-2"></i>
                                            Gestionar Tareas Leves
                                          </span>
                                          <span className="badge bg-primary">
                                            {(() => {
                                              // Si es trabajo extra, buscar por trabajoExtraId, sino por obraId
                                              const count = obra.esTrabajoExtra
                                                ? trabajosAdicionales.filter(ta => ta.trabajoExtraId === obra.id).length
                                                : contarTrabajosAdicionalesObra(obra.id);
                                              console.log(`??? Badge OBRA ${obra.id} (esTE:${!!obra.esTrabajoExtra}): count=${count}, total=${trabajosAdicionales.length}`);
                                              return count;
                                            })()}
                                          </span>
                                        </button>

                                        {/* Lista de trabajos adicionales */}
                                        {obtenerTrabajosAdicionalesObra(obra.id).length > 0 && (
                                          <div className="mt-3">
                                            {obtenerTrabajosAdicionalesObra(obra.id).map((ta) => (
                                              <div key={ta.id} className="card mb-2" style={{ borderLeft: '4px solid #667eea' }}>
                                                <div className="card-body p-2">
                                                  <div className="d-flex justify-content-between align-items-start">
                                                    <div className="flex-grow-1">
                                                      <div className="d-flex align-items-center gap-2 mb-1">
                                                        <strong className="text-primary">{ta.nombre}</strong>
                                                        <span className={`badge bg-${trabajosAdicionalesService.COLORES_ESTADO[ta.estado]}`}>
                                                          <i className={`fas fa-${trabajosAdicionalesService.ICONOS_ESTADO[ta.estado]} me-1`}></i>
                                                          {ta.estado}
                                                        </span>
                                                      </div>
                                                      <div className="small text-muted">
                                                        <i className="fas fa-dollar-sign me-1"></i>
                                                        ${ta.importe?.toFixed(2) || '0.00'}
                                                        <span className="mx-2">|</span>
                                                        <i className="fas fa-calendar-day me-1"></i>
                                                        {ta.diasNecesarios} d?as
                                                        <span className="mx-2">|</span>
                                                        <i className="fas fa-users me-1"></i>
                                                        {ta.profesionales?.length || 0} profesionales
                                                      </div>
                                                    </div>
                                                    <div className="btn-group btn-group-sm">
                                                      <button
                                                        className="btn btn-outline-secondary"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          // ? Abrir modal correcto con datos existentes
                                                          setObraParaTareaLeve(obra);
                                                          setTareaLeveEditando(ta);
                                                          setMostrarModalTareaLeve(true);
                                                        }}
                                                        title="Editar"
                                                      >
                                                        <i className="fas fa-edit"></i>
                                                      </button>
                                                      <button
                                                        className="btn btn-outline-danger"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleEliminarTrabajoAdicional(ta.id, ta.nombre);
                                                        }}
                                                        title="Eliminar"
                                                      >
                                                        <i className="fas fa-trash"></i>
                                                      </button>
                                                    </div>
                                                  </div>
                                                  {ta.estado === 'PENDIENTE' && (
                                                    <div className="mt-2 d-flex gap-1">
                                                      <button
                                                        className="btn btn-xs btn-primary"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleCambiarEstadoTrabajoAdicional(ta.id, 'EN_PROGRESO');
                                                        }}
                                                      >
                                                        Iniciar
                                                      </button>
                                                    </div>
                                                  )}
                                                  {ta.estado === 'EN_PROGRESO' && (
                                                    <div className="mt-2 d-flex gap-1">
                                                      <button
                                                        className="btn btn-xs btn-success"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleCambiarEstadoTrabajoAdicional(ta.id, 'COMPLETADO');
                                                        }}
                                                      >
                                                        Completar
                                                      </button>
                                                      <button
                                                        className="btn btn-xs btn-warning"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleCambiarEstadoTrabajoAdicional(ta.id, 'CANCELADO');
                                                        }}
                                                      >
                                                        Cancelar
                                                      </button>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}

                            {/* ---------------------------------------------------
                                SUBGRUPO: ADICIONALES OBRA (TRABAJO_EXTRA)
                                ----------------------------------------------- */}
                            {(() => {
                              const trabajosExtra = obtenerTrabajosExtraParaSubgrupo(obra);
                              if (trabajosExtra.length === 0) return null;
                              // Por defecto colapsado (true)
                              const colTrabajosExtra = gruposColapsadosObras[`trabajos_extra_${obra.id}`] ?? true;
                              return (
                                <>
                                  {/* -- Subgrupo: Adicionales Obra (Trabajos Extra) -- */}
                                  {trabajosExtra.length > 0 && (
                                    <>
                                      {/* Separador antes del subgrupo */}
                                      <tr style={{ height: '6px', backgroundColor: '#dbeafe' }}>
                                        <td colSpan="13" style={{
                                          padding: 0,
                                          height: '6px',
                                          borderTop: '2px solid #3b82f6',
                                          borderBottom: '2px solid #3b82f6',
                                          backgroundColor: '#93c5fd'
                                        }}></td>
                                      </tr>
                                      {/* Header subgrupo */}
                                      <tr
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const key = `trabajos_extra_${obra.id}`;
                                          const currentValue = gruposColapsadosObras[key] ?? true;
                                          setGruposColapsadosObras(p => ({ ...p, [key]: !currentValue }));
                                        }}
                                        style={{ backgroundColor: '#dbeafe', cursor: 'pointer', borderLeft: '5px solid #1d4ed8', borderBottom: '1px solid rgba(253, 126, 20, 0.45)' }}
                                      >
                                        <td colSpan="13" className="py-1 px-3 small">
                                          <span className="fw-bold text-primary">
                                            <i className={`fas fa-chevron-${colTrabajosExtra ? 'right' : 'down'} me-2`} style={{fontSize:'0.75em'}}></i>
                                            ?? Adicionales Obra
                                            <span className="badge bg-primary ms-2" style={{fontSize:'0.7em'}}>{trabajosExtra.length}</span>
                                          </span>
                                          <span className="text-muted ms-3 small">Clic para {colTrabajosExtra ? 'mostrar' : 'ocultar'}</span>
                                        </td>
                                      </tr>
                                      {/* Filas de cada trabajo extra */}
                                      {!colTrabajosExtra && trabajosExtra.map((trabajoExtra, teIndex) => {
                                    const isSelected = selectedObraId === trabajoExtra.id;
                                    return (
                                      <React.Fragment key={trabajoExtra.id}>
                                        {/* Separador entre trabajos extra */}
                                        {teIndex > 0 && (
                                          <tr style={{ height: '3px', backgroundColor: '#fef3c7' }}>
                                            <td colSpan="13" style={{
                                              padding: 0,
                                              height: '3px',
                                              borderTop: '1px solid #fbbf24',
                                              backgroundColor: '#fef3c7'
                                            }}></td>
                                          </tr>
                                        )}
                                        {/* Fila del trabajo extra */}
                                        <tr
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedObraId(isSelected ? null : trabajoExtra.id);
                                          }}
                                          style={{
                                            backgroundColor: isSelected ? '#cfe2ff' : '#eff6ff',
                                            borderLeft: '5px solid #f59e0b',
                                            borderBottom: '1px solid rgba(253, 126, 20, 0.45)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease'
                                          }}
                                          className="hover-row"
                                        >
                                          <td className="text-center">
                                            <button
                                              className="btn btn-sm btn-primary rounded-circle p-0"
                                              onClick={(e) => toggleObraExpandida(trabajoExtra.id, e)}
                                              style={{ width: '30px', height: '30px', transition: 'all 0.3s ease' }}
                                              title={obrasExpandidas.has(trabajoExtra.id) ? 'Ocultar detalles' : 'Ver detalles'}
                                            >
                                              <i className={`fas fa-${obrasExpandidas.has(trabajoExtra.id) ? 'minus' : 'plus'} text-white`}></i>
                                            </button>
                                          </td>
                                          <td>
                                            {isSelected && <i className="fas fa-check-circle text-success me-1"></i>}
                                            <span className="text-warning me-1" title="Trabajo extra de obra"><i className="fas fa-wrench" style={{fontSize:'0.8em'}}></i></span>
                                            {trabajoExtra.id}
                                          </td>
                                          <td>
                                            {trabajoExtra.nombre}
                                            {(() => {
                                              const presupuesto = presupuestosObras[trabajoExtra.id];
                                              const esTareaLeve = presupuesto?.tipo_presupuesto === 'TAREA_LEVE' ||
                                                                 presupuesto?.tipoPresupuesto === 'TAREA_LEVE';

                                              if (esTareaLeve) {
                                                return (
                                                  <div className="mt-1">
                                                    <span className="badge bg-info text-dark" style={{fontSize:'0.7rem', padding:'3px 8px'}}>
                                                      <i className="fas fa-bolt me-1"></i>Tarea Leve
                                                    </span>
                                                  </div>
                                                );
                                              } else {
                                                return (
                                                  <div className="mt-1">
                                                    <span className="badge bg-warning text-dark" style={{fontSize:'0.7rem', padding:'3px 8px'}}>
                                                      <i className="fas fa-wrench me-1"></i>Adicional Obra
                                                    </span>
                                                  </div>
                                                );
                                              }
                                            })()}
                                          </td>
                                          <td>
                                            <small className="text-muted">
                                              {trabajoExtra.nombreSolicitante || '-'}
                                            </small>
                                          </td>
                                          <td>
                                            <small className="text-muted">{formatearDireccionObra(trabajoExtra)}</small>
                                          </td>
                                          <td>
                                            {(trabajoExtra.nombreSolicitante || trabajoExtra.telefono || trabajoExtra.mail) ? (
                                              <div className="d-flex flex-column" style={{minWidth: '150px'}}>
                                                {trabajoExtra.nombreSolicitante && (
                                                  <small className="text-muted mb-1">
                                                    <i className="fas fa-user me-1"></i>
                                                    {trabajoExtra.nombreSolicitante}
                                                  </small>
                                                )}
                                                {trabajoExtra.telefono && (
                                                  <small>
                                                    <a
                                                      href={`https://wa.me/${trabajoExtra.telefono.replace(/\D/g, '')}`}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="text-success text-decoration-none"
                                                      title="Abrir WhatsApp"
                                                    >
                                                      <i className="fab fa-whatsapp me-1"></i>
                                                      {trabajoExtra.telefono}
                                                    </a>
                                                  </small>
                                                )}
                                                {trabajoExtra.mail && (
                                                  <small>
                                                    <a
                                                      href={`mailto:${trabajoExtra.mail}`}
                                                      className="text-primary text-decoration-none"
                                                      title="Enviar email"
                                                    >
                                                      <i className="fas fa-envelope me-1"></i>
                                                      {trabajoExtra.mail}
                                                    </a>
                                                  </small>
                                                )}
                                              </div>
                                            ) : (
                                              <small className="text-muted">-</small>
                                            )}
                                          </td>
                                          <td className="text-center"><small className="text-muted">-</small></td>
                                          <td>
                                            <span className={`badge ${getEstadoBadgeClass(trabajoExtra.estado) || 'bg-secondary'}`}>
                                              {trabajoExtra.estado || '?'}
                                            </span>
                                          </td>
                                          <td>
                                            {(() => {
                                              const count = contarProfesionalesAsignados(trabajoExtra.id)?.count || 0;
                                              return count > 0 ? (
                                                <div className="badge bg-success d-inline-flex align-items-center gap-1">
                                                  <span>👷</span>
                                                  <span className="small">{count} asignados</span>
                                                </div>
                                              ) : (
                                                <div className="badge bg-warning text-dark d-inline-flex align-items-center gap-1">
                                                  <span>⚠️</span>
                                                  <span className="small">Sin profesionales asignados</span>
                                                </div>
                                              );
                                            })()}
                                          </td>
                                          <td><small>{trabajoExtra.fechaInicio || '?'}</small></td>
                                          <td><small>{trabajoExtra.fechaFin || '?'}</small></td>
                                          <td><small>{trabajoExtra.clienteId ? `Cliente ID: ${trabajoExtra.clienteId}` : '?'}</small></td>
                                          <td className="text-end">
                                            {(() => {
                                              // Obtener presupuesto vinculado
                                              const presupuesto = presupuestosObras[trabajoExtra.id] || trabajoExtra.presupuestoNoCliente;
                                              const tienePresupuesto = presupuesto && typeof presupuesto === 'object';

                                              if (tienePresupuesto) {
                                                // Obtener total del presupuesto (PRIORIDAD: totalConDescuentos > totalFinal)
                                                const total = presupuesto.totalConDescuentos ||
                                                             presupuesto.total_con_descuentos ||
                                                             presupuesto.totalFinal ||
                                                             presupuesto.total_presupuesto_con_honorarios ||
                                                             presupuesto.totalPresupuestoConHonorarios ||
                                                             presupuesto.montoTotal ||
                                                             presupuesto.totalGeneral ||
                                                             0;

                                                // Determinar tipo de presupuesto
                                                const modoPresupuesto = presupuesto.modoPresupuesto || presupuesto.modo_presupuesto;
                                                const esGlobal = modoPresupuesto === 'TRADICIONAL';

                                                return (
                                                  <div>
                                                    <div className="fw-bold text-primary small">
                                                      ${Number(total).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                                    </div>
                                                    <div className="mt-1">
                                                      <span className={`badge ${esGlobal ? 'bg-secondary' : 'bg-primary'} text-white`} style={{fontSize: '0.65em'}}>
                                                        <i className={`fas fa-${esGlobal ? 'globe' : 'list'} me-1`}></i>
                                                        {esGlobal ? 'Global' : 'Detallado'}
                                                      </span>
                                                    </div>
                                                  </div>
                                                );
                                              } else {
                                                return (
                                                  <span className="badge bg-warning text-dark" style={{fontSize: '0.6em'}}>
                                                    <i className="fas fa-hand-paper me-1"></i>Abreviado
                                                  </span>
                                                );
                                              }
                                            })()}
                                          </td>
                                        </tr>
                                        {/* Fila expandible para el trabajo extra (reutiliza la existente) */}
                                        {obrasExpandidas.has(trabajoExtra.id) && renderFilaExpandidaObra(trabajoExtra)}
                                      </React.Fragment>
                                    );
                                  })}
                                    </>
                                  )}
                                </>
                              );
                            })()}

                            {/* ---------------------------------------------------
                                SUBGRUPO: TAREAS LEVES (PRESUPUESTO_NO_CLIENTE)
                                ----------------------------------------------- */}
                            {(() => {
                              const tareasLevesObra = obtenerTareasLevesParaSubgrupo(obra);
                              if (tareasLevesObra.length === 0) return null;
                              // Por defecto colapsado (true)
                              const colTareasLeves = gruposColapsadosObras[`tareas_leves_${obra.id}`] ?? true;
                              return (
                                <>
                                  {/* Separador antes del subgrupo */}
                                  <tr style={{ height: '6px', backgroundColor: '#e0f2fe' }}>
                                    <td colSpan="13" style={{
                                      padding: 0,
                                      height: '6px',
                                      borderTop: '2px solid #0ea5e9',
                                      borderBottom: '2px solid #0ea5e9',
                                      backgroundColor: '#bae6fd'
                                    }}></td>
                                  </tr>
                                  {/* Header subgrupo colapsable */}
                                  <tr
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const key = `tareas_leves_${obra.id}`;
                                      const currentValue = gruposColapsadosObras[key] ?? true;
                                      setGruposColapsadosObras(p => ({ ...p, [key]: !currentValue }));
                                    }}
                                    style={{ backgroundColor: '#e0f2fe', cursor: 'pointer', borderLeft: '5px solid #0ea5e9', borderBottom: '1px solid rgba(14, 165, 233, 0.45)' }}
                                  >
                                    <td colSpan="13" className="py-1 px-3 small">
                                      <span className="fw-bold text-info">
                                        <i className={`fas fa-chevron-${colTareasLeves ? 'right' : 'down'} me-2`} style={{fontSize:'0.75em'}}></i>
                                        ⚡ Tareas Leves
                                        <span className="badge bg-info ms-2" style={{fontSize:'0.7em'}}>{tareasLevesObra.length}</span>
                                      </span>
                                      <span className="text-muted ms-3 small">Clic para {colTareasLeves ? 'mostrar' : 'ocultar'}</span>
                                    </td>
                                  </tr>
                                  {/* Filas de cada tarea leve */}
                                  {!colTareasLeves && tareasLevesObra.map((tareaLeve, tlIndex) => {
                                    // ✅ IMPORTANTE: Para tareas leves, usar obraId como selectedId, no el id del presupuesto
                                    const tareaLeveObraId = tareaLeve.obraId || tareaLeve.id;
                                    const isSelected = selectedObraId === tareaLeveObraId;
                                    return (
                                      <React.Fragment key={tareaLeve.id}>
                                        {/* Separador entre tareas */}
                                        {tlIndex > 0 && (
                                          <tr style={{ height: '3px', backgroundColor: '#bfdbfe' }}>
                                            <td colSpan="13" style={{
                                              padding: 0,
                                              height: '3px',
                                              borderTop: '1px solid #60a5fa',
                                              backgroundColor: '#bfdbfe'
                                            }}></td>
                                          </tr>
                                        )}
                                        {/* Fila de la tarea leve */}
                                        <tr
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedObraId(isSelected ? null : tareaLeveObraId);
                                          }}
                                          style={{
                                            backgroundColor: isSelected ? '#cfe2ff' : '#f0f9ff',
                                            borderLeft: '5px solid #0ea5e9',
                                            borderBottom: '1px solid rgba(14, 165, 233, 0.45)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease'
                                          }}
                                          className="hover-row"
                                        >
                                          <td className="text-center">
                                            <button
                                              className="btn btn-sm btn-info rounded-circle p-0"
                                              onClick={(e) => toggleObraExpandida(tareaLeve.id, e)}
                                              style={{ width: '30px', height: '30px', transition: 'all 0.3s ease' }}
                                              title={obrasExpandidas.has(tareaLeve.id) ? 'Ocultar detalles' : 'Ver detalles'}
                                            >
                                              <i className={`fas fa-${obrasExpandidas.has(tareaLeve.id) ? 'minus' : 'plus'} text-white`}></i>
                                            </button>
                                          </td>
                                          <td>
                                            {isSelected && <i className="fas fa-check-circle text-success me-1"></i>}
                                            <span className="text-info me-1" title="Tarea leve"><i className="fas fa-bolt" style={{fontSize:'0.8em'}}></i></span>
                                            {tareaLeve.id}
                                          </td>
                                          <td>
                                            {tareaLeve.nombre}
                                            <div className="mt-1">
                                              <span className="badge bg-info text-dark" style={{fontSize:'0.7rem', padding:'3px 8px'}}>
                                                <i className="fas fa-bolt me-1"></i>Tarea Leve
                                              </span>
                                            </div>
                                          </td>
                                          <td>
                                            <small className="text-muted">
                                              {tareaLeve.nombreSolicitante || '-'}
                                            </small>
                                          </td>
                                          <td>
                                            <small className="text-muted">{formatearDireccionObra(tareaLeve)}</small>
                                          </td>
                                          <td>
                                            {(tareaLeve.nombreSolicitante || tareaLeve.telefono || tareaLeve.mail) ? (
                                              <div className="d-flex flex-column" style={{minWidth: '150px'}}>
                                                {tareaLeve.nombreSolicitante && (
                                                  <small className="text-muted mb-1">
                                                    <i className="fas fa-user me-1"></i>
                                                    {tareaLeve.nombreSolicitante}
                                                  </small>
                                                )}
                                                {tareaLeve.telefono && (
                                                  <small>
                                                    <a
                                                      href={`https://wa.me/${tareaLeve.telefono.replace(/\D/g, '')}`}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="text-success text-decoration-none"
                                                      title="Abrir WhatsApp"
                                                    >
                                                      <i className="fab fa-whatsapp me-1"></i>
                                                      {tareaLeve.telefono}
                                                    </a>
                                                  </small>
                                                )}
                                                {tareaLeve.mail && (
                                                  <small>
                                                    <a
                                                      href={`mailto:${tareaLeve.mail}`}
                                                      className="text-primary text-decoration-none"
                                                      title="Enviar email"
                                                    >
                                                      <i className="fas fa-envelope me-1"></i>
                                                      {tareaLeve.mail}
                                                    </a>
                                                  </small>
                                                )}
                                              </div>
                                            ) : (
                                              <small className="text-muted">-</small>
                                            )}
                                          </td>
                                          <td className="text-center"><small className="text-muted">-</small></td>
                                          <td>
                                            <span className={`badge ${getEstadoBadgeClass(tareaLeve.estado) || 'bg-secondary'}`}>
                                              {tareaLeve.estado || '?'}
                                            </span>
                                          </td>
                                          <td>
                                            {(() => {
                                              const count = contarProfesionalesAsignados(tareaLeve.id)?.count || 0;
                                              return count > 0 ? (
                                                <div className="badge bg-success d-inline-flex align-items-center gap-1">
                                                  <span>👷</span>
                                                  <span className="small">{count} asignados</span>
                                                </div>
                                              ) : (
                                                <div className="badge bg-warning text-dark d-inline-flex align-items-center gap-1">
                                                  <span>⚠️</span>
                                                  <span className="small">Sin asignar</span>
                                                </div>
                                              );
                                            })()}
                                          </td>
                                          <td><small>{tareaLeve.fechaInicio || '?'}</small></td>
                                          <td><small>{tareaLeve.fechaFin || '?'}</small></td>
                                          <td><small>{tareaLeve.clienteId ? `Cliente ID: ${tareaLeve.clienteId}` : '?'}</small></td>
                                          <td className="text-end">
                                            {(() => {
                                              const presupuesto = presupuestosObras[tareaLeve.id] || tareaLeve.presupuestoNoCliente;
                                              const tienePresupuesto = presupuesto && typeof presupuesto === 'object';

                                              if (tienePresupuesto) {
                                                // ✅ CALCULAR SIEMPRE usando obtenerTotalPresupuesto()
                                                const total = obtenerTotalPresupuesto(presupuesto);

                                                // Determinar tipo de presupuesto
                                                const modoPresupuesto = presupuesto.modoPresupuesto || presupuesto.modo_presupuesto;
                                                const esGlobal = modoPresupuesto === 'TRADICIONAL';

                                                return (
                                                  <div>
                                                    <div className="fw-bold text-primary small">
                                                      ${Number(total).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                                    </div>
                                                    <div className="mt-1">
                                                      <span className={`badge ${esGlobal ? 'bg-secondary' : 'bg-primary'} text-white`} style={{fontSize: '0.65em'}}>
                                                        <i className={`fas fa-${esGlobal ? 'globe' : 'list'} me-1`}></i>
                                                        {esGlobal ? 'Global' : 'Detallado'}
                                                      </span>
                                                    </div>
                                                  </div>
                                                );
                                              } else if (tareaLeve.importe > 0) {
                                                return (
                                                  <div className="fw-bold text-primary">
                                                    ${Number(tareaLeve.importe).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                  </div>
                                                );
                                              } else {
                                                return <span className="text-muted small">-</span>;
                                              }
                                            })()}
                                          </td>
                                        </tr>
                                        {/* Fila expandible para la tarea leve */}
                                        {obrasExpandidas.has(tareaLeve.id) && renderFilaExpandidaObra(tareaLeve)}
                                      </React.Fragment>
                                    );
                                  })}
                                </>
                              );
                            })()}

                          </React.Fragment>
                        );
                      })}
                        </tbody>
                      </table>
                    </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Tab Crear Obra */}
      {activeTab === 'crear' && (
        <div className="row justify-content-center">
          <div className="col-md-8">
            <div className="card" onClick={(e) => e.stopPropagation()}>
                <div className="card-header">
                  <h5>
                    {modoEdicion ? (
                      <>
                        <i className="bi bi-pencil-square me-2"></i>
                        Editando Obra
                      </>
                    ) : (
                      'Crear Nuevo Trabajo Diario'
                    )}
                  </h5>
                  {modoEdicion && obraEditando && (
                    <small className="text-muted d-block mt-1">
                      ID: {obraEditando.id} | Cliente: {obraEditando.clienteId || 'Sin cliente'}
                    </small>
                  )}
                </div>
                <div className="card-body">
                  <form onSubmit={(e) => { e.preventDefault(); handleCrearObra(); }}>
                    {/* T?tulo: Presupuesto destinado a */}
                    <div className="mb-3">
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
                            {formData.nombre || '(Sin nombre de obra)'}
                          </span>
                        </h6>
                      </div>
                    </div>

                    {/* Nombre de la Obra */}
                    <div className="row mb-3">
                      <div className="col-md-12">
                        <label className="form-label fw-bold">Nombre de la Obra</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.nombre}
                          onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                          placeholder="Opcional: Si no se ingresa, se generar? autom?ticamente desde la Direcci?n"
                          style={{borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                        />
                        <small className="text-muted">Si se deja vac?o, se generar? autom?ticamente desde la Direcci?n de la obra</small>
                      </div>
                    </div>

                    {/* Direcci?n detallada de la obra */}
                    <div className="mb-3">
                      <label className="form-label fw-bold">Direcci?n de la Obra</label>
                      <div className="row g-2 mb-2">
                        <div className="col-md-2">
                          <label className="form-label fw-bold" style={{color: "#000", marginBottom: 6}}>Calle *
                            <input
                              name="direccionObraCalle"
                              className="form-control"
                              placeholder="Av. Libertador"
                              value={formData.direccionObraCalle}
                              onChange={(e) => setFormData({...formData, direccionObraCalle: e.target.value})}
                              required
                              style={{marginTop: 4, borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                            />
                          </label>
                        </div>
                        <div className="col-md-2">
                          <label className="form-label fw-bold" style={{color: "#000", marginBottom: 6}}>Altura *
                            <input
                              name="direccionObraAltura"
                              type="number"
                              className="form-control"
                              placeholder="1234"
                              min="1"
                              step="1"
                              value={formData.direccionObraAltura}
                              onChange={(e) => setFormData({...formData, direccionObraAltura: e.target.value})}
                              required
                              style={{marginTop: 4, borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                            />
                          </label>
                        </div>
                        <div className="col-md-2">
                          <label className="form-label fw-bold" style={{color: "#000", marginBottom: 6}}>Barrio
                            <input
                              name="direccionObraBarrio"
                              className="form-control"
                              value={formData.direccionObraBarrio}
                              onChange={(e) => setFormData({...formData, direccionObraBarrio: e.target.value})}
                              style={{marginTop: 4, borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                            />
                          </label>
                        </div>
                        <div className="col-md-2">
                          <label className="form-label fw-bold" style={{color: "#000", marginBottom: 6}}>Torre
                            <input
                              name="direccionObraTorre"
                              className="form-control"
                              value={formData.direccionObraTorre}
                              onChange={(e) => setFormData({...formData, direccionObraTorre: e.target.value})}
                              style={{marginTop: 4, borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                            />
                          </label>
                        </div>
                        <div className="col-md-2">
                          <label className="form-label fw-bold" style={{color: "#000", marginBottom: 6}}>Piso
                            <input
                              name="direccionObraPiso"
                              className="form-control"
                              value={formData.direccionObraPiso}
                              onChange={(e) => setFormData({...formData, direccionObraPiso: e.target.value})}
                              style={{marginTop: 4, borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                            />
                          </label>
                        </div>
                        <div className="col-md-2">
                          <label className="form-label fw-bold" style={{color: "#000", marginBottom: 6}}>Depto
                            <input
                              name="direccionObraDepartamento"
                              className="form-control"
                              value={formData.direccionObraDepartamento}
                              onChange={(e) => setFormData({...formData, direccionObraDepartamento: e.target.value})}
                              style={{marginTop: 4, borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Cliente existente */}
                    <div className="row mb-3">
                      <div className="col-md-12">
                        <label className="form-label fw-bold">Cliente (seleccionar de la lista)</label>
                        <ClienteSelector
                          value={formData.idCliente}
                          onChange={(selection) => setFormData({...formData, idCliente: selection.id})}
                          empresaId={empresaId}
                          placeholder="Seleccionar cliente..."
                        />
                      </div>
                    </div>

                    {/* Datos del nuevo cliente (si no est? en la lista) */}
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted">O crear nuevo cliente (si no est? en la lista)</label>
                      <div className="row g-2">
                        <div className="col-md-3">
                          <label className="form-label fw-bold" style={{color: "#000", marginBottom: 6}}>Nombre solicitante
                            <input
                              name="nombreSolicitante"
                              className="form-control"
                              value={formData.nombreSolicitante}
                              onChange={(e) => setFormData({...formData, nombreSolicitante: e.target.value})}
                              style={{marginTop: 4, borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                            />
                          </label>
                        </div>
                        <div className="col-md-3">
                          <label className="form-label fw-bold" style={{color: "#000", marginBottom: 6}}>Tel?fono
                            <input
                              name="telefono"
                              className="form-control"
                              value={formData.telefono}
                              onChange={(e) => setFormData({...formData, telefono: e.target.value})}
                              style={{marginTop: 4, borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                            />
                          </label>
                        </div>
                        <div className="col-md-3">
                          <label className="form-label fw-bold" style={{color: "#000", marginBottom: 6}}>Direcci?n particular
                            <input
                              name="direccionParticular"
                              className="form-control"
                              value={formData.direccionParticular}
                              onChange={(e) => setFormData({...formData, direccionParticular: e.target.value})}
                              style={{marginTop: 4, borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                            />
                          </label>
                        </div>
                        <div className="col-md-3">
                          <label className="form-label fw-bold" style={{color: "#000", marginBottom: 6}}>Mail
                            <input
                              name="mail"
                              type="email"
                              className="form-control"
                              value={formData.mail}
                              onChange={(e) => setFormData({...formData, mail: e.target.value})}
                              style={{marginTop: 4, borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="row">
                      <div className="col-md-4 mb-3">
                        <label className="form-label">Estado</label>
                        <select
                          className="form-select"
                          value={formData.estado}
                          onChange={(e) => setFormData({...formData, estado: e.target.value})}
                          style={{borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                        >
                          <option value="BORRADOR">Borrador</option>
                          <option value="A_ENVIAR">A enviar</option>
                          <option value="ENVIADO">Enviado</option>
                          <option value="MODIFICADO">Modificado</option>
                          <option value="APROBADO">Aprobado</option>
                          <option value="OBRA_A_CONFIRMAR">Obra a confirmar</option>
                          <option value="EN_EJECUCION">En ejecuci?n</option>
                          <option value="SUSPENDIDA">Suspendida</option>
                          <option value="TERMINADO">Terminado</option>
                          <option value="CANCELADO">Cancelado</option>
                        </select>
                      </div>
                      <div className="col-md-4 mb-3">
                        <label className="form-label">Fecha Inicio</label>
                        <input
                          type="date"
                          className="form-control"
                          value={formData.fechaInicio}
                          onChange={(e) => setFormData({...formData, fechaInicio: e.target.value})}
                          style={{borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                        />
                      </div>
                      <div className="col-md-4 mb-3">
                        <label className="form-label">Fecha Fin</label>
                        <input
                          type="date"
                          className="form-control"
                          value={formData.fechaFin}
                          onChange={(e) => setFormData({...formData, fechaFin: e.target.value})}
                          style={{borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                        />
                      </div>
                    </div>

                    {/* Informaci?n adicional y configuraci?n */}
                    <div className="card mb-3">
                      <div className="card-header bg-light">
                        <h6 className="mb-0"><i className="fas fa-info-circle me-2"></i>Informaci?n General</h6>
                      </div>
                      <div className="card-body">
                        <div className="row">
                          <div className="col-md-8 mb-3">
                            <label className="form-label">Descripci?n de la Obra
                              <small className="text-muted ms-2">(Ej: "Refacci?n integral" o "Construcci?n nueva")</small>
                            </label>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Ingrese una descripci?n para esta obra"
                              value={formData.descripcion || ''}
                              onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                              style={{borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                            />
                          </div>
                          <div className="col-md-4 mb-3">
                            <label className="form-label">Presupuesto Estimado</label>
                            <input
                              type="number"
                              className="form-control"
                              step="0.01"
                              placeholder="0.00"
                              value={usarDesgloseObra ? (importeTotalObra || formData.presupuestoEstimado) : formData.presupuestoEstimado}
                              onChange={(e) => setFormData({...formData, presupuestoEstimado: e.target.value})}
                              disabled={usarDesgloseObra}
                              style={{
                                borderRadius: '8px',
                                padding: '10px 12px',
                                fontSize: '0.95rem',
                                border: '3px solid #86b7fe',
                                transition: 'all 0.2s',
                                backgroundColor: usarDesgloseObra ? '#f3f4f6' : 'white',
                                cursor: usarDesgloseObra ? 'not-allowed' : 'text'
                              }}
                            />
                            {/* Toggle para desglose */}
                            <div className="mt-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => {
                                  // Marcar que estamos haciendo toggle para que el useEffect no calcule inmediatamente
                                  desgloseJustToggled.current = true;
                                  // Solo alternar la visibilidad, sin modificar valores
                                  setUsarDesgloseObra(!usarDesgloseObra);
                                }}
                                style={{ borderRadius: '8px', fontSize: '0.85rem' }}
                              >
                                <i className={`fas fa-${usarDesgloseObra ? 'calculator' : 'list'} me-2`}></i>
                                {usarDesgloseObra ? 'Usar Importe Simple' : 'Desglosar Importe'}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Secci?n Colapsable de Desglose para Obra */}
                        {usarDesgloseObra && (
                          <div className="mb-3">
                            <div className="card" style={{
                              border: '2px solid #3b82f6',
                              borderRadius: '12px',
                              backgroundColor: '#eff6ff'
                            }}>
                              <div className="card-header" style={{
                                background: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)',
                                color: 'white',
                                borderRadius: '10px 10px 0 0',
                                padding: '0.75rem 1rem'
                              }}>
                                <h6 className="mb-0" style={{ fontWeight: '600', fontSize: '0.95rem' }}>
                                  <i className="fas fa-calculator me-2"></i>
                                  Desglose del Presupuesto
                                </h6>
                                <small style={{ fontSize: '0.8rem', opacity: '0.9' }}>
                                  Especifique cada componente del costo total
                                </small>
                              </div>
                              <div className="card-body p-3">
                                <div className="row">
                                  {/* Jornales */}
                                  <div className="col-md-6 mb-4">
                                    <div className="border rounded p-3" style={{ backgroundColor: '#fffbeb', borderColor: '#f59e0b !important' }}>
                                      <label className="form-label fw-bold" style={{ color: '#92400e', fontSize: '0.95rem' }}>
                                        <i className="fas fa-user-hard-hat me-2"></i>
                                        Jornales
                                      </label>
                                      <div className="input-group mb-2">
                                        <span className="input-group-text" style={{
                                          backgroundColor: '#fef3c7',
                                          color: '#92400e',
                                          border: '1px solid #f59e0b'
                                        }}>
                                          $
                                        </span>
                                        <input
                                          type="number"
                                          className="form-control"
                                          placeholder="0.00"
                                          step="0.01"
                                          min="0"
                                          value={importeJornalesObra}
                                          onChange={(e) => setImporteJornalesObra(e.target.value)}
                                          style={{
                                            border: '1px solid #f59e0b',
                                            borderLeft: 'none'
                                          }}
                                        />
                                      </div>

                                      {/* Honorarios para Jornales */}
                                      <div className="mt-2">
                                        <label className="form-label small mb-1" style={{ color: '#6b7280' }}>
                                          <i className="fas fa-handshake me-1"></i>
                                          Honorarios
                                        </label>
                                        <div className="btn-group d-flex mb-1" role="group" style={{ borderRadius: '6px' }}>
                                          <button
                                            type="button"
                                            className={`btn btn-sm ${tipoHonorarioJornalesObra === 'fijo' ? 'btn-warning' : 'btn-outline-warning'}`}
                                            onClick={() => setTipoHonorarioJornalesObra('fijo')}
                                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                                          >
                                            $ Fijo
                                          </button>
                                          <button
                                            type="button"
                                            className={`btn btn-sm ${tipoHonorarioJornalesObra === 'porcentaje' ? 'btn-warning' : 'btn-outline-warning'}`}
                                            onClick={() => setTipoHonorarioJornalesObra('porcentaje')}
                                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                                          >
                                            % Porcentaje
                                          </button>
                                        </div>
                                        <div className="input-group input-group-sm">
                                          <span className="input-group-text" style={{
                                            backgroundColor: '#fef3c7',
                                            color: '#92400e',
                                            border: '1px solid #f59e0b',
                                            fontSize: '0.8rem'
                                          }}>
                                            {tipoHonorarioJornalesObra === 'fijo' ? '$' : '%'}
                                          </span>
                                          <input
                                            type="number"
                                            className="form-control"
                                            placeholder={tipoHonorarioJornalesObra === 'fijo' ? '0.00' : '0'}
                                            step={tipoHonorarioJornalesObra === 'fijo' ? '0.01' : '1'}
                                            min="0"
                                            max={tipoHonorarioJornalesObra === 'porcentaje' ? '100' : undefined}
                                            value={honorarioJornalesObra}
                                            onChange={(e) => setHonorarioJornalesObra(e.target.value)}
                                            style={{
                                              border: '1px solid #f59e0b',
                                              borderLeft: 'none',
                                              fontSize: '0.85rem'
                                            }}
                                          />
                                        </div>
                                        {/* C?lculo en tiempo real */}
                                        {importeJornalesObra && honorarioJornalesObra && (
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#fef3c7', borderRadius: '4px', fontSize: '0.75rem', color: '#92400e' }}>
                                            <strong>?? Importe:</strong> $
                                            {tipoHonorarioJornalesObra === 'fijo'
                                              ? parseFloat(honorarioJornalesObra || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                              : ((parseFloat(importeJornalesObra || 0) * parseFloat(honorarioJornalesObra || 0)) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                            }
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Materiales */}
                                  <div className="col-md-6 mb-4">
                                    <div className="border rounded p-3" style={{ backgroundColor: '#eff6ff', borderColor: '#3b82f6 !important' }}>
                                      <label className="form-label fw-bold" style={{ color: '#1e40af', fontSize: '0.95rem' }}>
                                        <i className="fas fa-boxes me-2"></i>
                                        Materiales
                                      </label>
                                      <div className="input-group mb-2">
                                        <span className="input-group-text" style={{
                                          backgroundColor: '#dbeafe',
                                          color: '#1e40af',
                                          border: '1px solid #3b82f6'
                                        }}>
                                          $
                                        </span>
                                        <input
                                          type="number"
                                          className="form-control"
                                          placeholder="0.00"
                                          step="0.01"
                                          min="0"
                                          value={importeMaterialesObra}
                                          onChange={(e) => setImporteMaterialesObra(e.target.value)}
                                          style={{
                                            border: '1px solid #3b82f6',
                                            borderLeft: 'none'
                                          }}
                                        />
                                      </div>

                                      {/* Honorarios para Materiales */}
                                      <div className="mt-2">
                                        <label className="form-label small mb-1" style={{ color: '#6b7280' }}>
                                          <i className="fas fa-handshake me-1"></i>
                                          Honorarios
                                        </label>
                                        <div className="btn-group d-flex mb-1" role="group" style={{ borderRadius: '6px' }}>
                                          <button
                                            type="button"
                                            className={`btn btn-sm ${tipoHonorarioMaterialesObra === 'fijo' ? 'btn-primary' : 'btn-outline-primary'}`}
                                            onClick={() => setTipoHonorarioMaterialesObra('fijo')}
                                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                                          >
                                            $ Fijo
                                          </button>
                                          <button
                                            type="button"
                                            className={`btn btn-sm ${tipoHonorarioMaterialesObra === 'porcentaje' ? 'btn-primary' : 'btn-outline-primary'}`}
                                            onClick={() => setTipoHonorarioMaterialesObra('porcentaje')}
                                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                                          >
                                            % Porcentaje
                                          </button>
                                        </div>
                                        <div className="input-group input-group-sm">
                                          <span className="input-group-text" style={{
                                            backgroundColor: '#dbeafe',
                                            color: '#1e40af',
                                            border: '1px solid #3b82f6',
                                            fontSize: '0.8rem'
                                          }}>
                                            {tipoHonorarioMaterialesObra === 'fijo' ? '$' : '%'}
                                          </span>
                                          <input
                                            type="number"
                                            className="form-control"
                                            placeholder={tipoHonorarioMaterialesObra === 'fijo' ? '0.00' : '0'}
                                            step={tipoHonorarioMaterialesObra === 'fijo' ? '0.01' : '1'}
                                            min="0"
                                            max={tipoHonorarioMaterialesObra === 'porcentaje' ? '100' : undefined}
                                            value={honorarioMaterialesObra}
                                            onChange={(e) => setHonorarioMaterialesObra(e.target.value)}
                                            style={{
                                              border: '1px solid #3b82f6',
                                              borderLeft: 'none',
                                              fontSize: '0.85rem'
                                            }}
                                          />
                                        </div>
                                        {/* C?lculo en tiempo real */}
                                        {importeMaterialesObra && honorarioMaterialesObra && (
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#dbeafe', borderRadius: '4px', fontSize: '0.75rem', color: '#1e40af' }}>
                                            <strong>?? Importe:</strong> $
                                            {tipoHonorarioMaterialesObra === 'fijo'
                                              ? parseFloat(honorarioMaterialesObra || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                              : ((parseFloat(importeMaterialesObra || 0) * parseFloat(honorarioMaterialesObra || 0)) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                            }
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="row">
                                  {/* Gastos Generales */}
                                  <div className="col-md-6 mb-4">
                                    <div className="border rounded p-3" style={{ backgroundColor: '#f0fdf4', borderColor: '#10b981 !important' }}>
                                      <label className="form-label fw-bold" style={{ color: '#065f46', fontSize: '0.95rem' }}>
                                        <i className="fas fa-file-invoice-dollar me-2"></i>
                                        Gastos Generales
                                      </label>
                                      <div className="input-group mb-2">
                                        <span className="input-group-text" style={{
                                          backgroundColor: '#d1fae5',
                                          color: '#065f46',
                                          border: '1px solid #10b981'
                                        }}>
                                          $
                                        </span>
                                        <input
                                          type="number"
                                          className="form-control"
                                          placeholder="0.00"
                                          step="0.01"
                                          min="0"
                                          value={importeGastosGeneralesObra}
                                          onChange={(e) => setImporteGastosGeneralesObra(e.target.value)}
                                          style={{
                                            border: '1px solid #10b981',
                                            borderLeft: 'none'
                                          }}
                                        />
                                      </div>

                                      {/* Honorarios para Gastos Generales */}
                                      <div className="mt-2">
                                        <label className="form-label small mb-1" style={{ color: '#6b7280' }}>
                                          <i className="fas fa-handshake me-1"></i>
                                          Honorarios
                                        </label>
                                        <div className="btn-group d-flex mb-1" role="group" style={{ borderRadius: '6px' }}>
                                          <button
                                            type="button"
                                            className={`btn btn-sm ${tipoHonorarioGastosGeneralesObra === 'fijo' ? 'btn-success' : 'btn-outline-success'}`}
                                            onClick={() => setTipoHonorarioGastosGeneralesObra('fijo')}
                                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                                          >
                                            $ Fijo
                                          </button>
                                          <button
                                            type="button"
                                            className={`btn btn-sm ${tipoHonorarioGastosGeneralesObra === 'porcentaje' ? 'btn-success' : 'btn-outline-success'}`}
                                            onClick={() => setTipoHonorarioGastosGeneralesObra('porcentaje')}
                                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                                          >
                                            % Porcentaje
                                          </button>
                                        </div>
                                        <div className="input-group input-group-sm">
                                          <span className="input-group-text" style={{
                                            backgroundColor: '#d1fae5',
                                            color: '#065f46',
                                            border: '1px solid #10b981',
                                            fontSize: '0.8rem'
                                          }}>
                                            {tipoHonorarioGastosGeneralesObra === 'fijo' ? '$' : '%'}
                                          </span>
                                          <input
                                            type="number"
                                            className="form-control"
                                            placeholder={tipoHonorarioGastosGeneralesObra === 'fijo' ? '0.00' : '0'}
                                            step={tipoHonorarioGastosGeneralesObra === 'fijo' ? '0.01' : '1'}
                                            min="0"
                                            max={tipoHonorarioGastosGeneralesObra === 'porcentaje' ? '100' : undefined}
                                            value={honorarioGastosGeneralesObra}
                                            onChange={(e) => setHonorarioGastosGeneralesObra(e.target.value)}
                                            style={{
                                              border: '1px solid #10b981',
                                              borderLeft: 'none',
                                              fontSize: '0.85rem'
                                            }}
                                          />
                                        </div>
                                        {/* C?lculo en tiempo real */}
                                        {importeGastosGeneralesObra && honorarioGastosGeneralesObra && (
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#d1fae5', borderRadius: '4px', fontSize: '0.75rem', color: '#065f46' }}>
                                            <strong>?? Importe:</strong> $
                                            {tipoHonorarioGastosGeneralesObra === 'fijo'
                                              ? parseFloat(honorarioGastosGeneralesObra || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                              : ((parseFloat(importeGastosGeneralesObra || 0) * parseFloat(honorarioGastosGeneralesObra || 0)) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                            }
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Mayores Costos */}
                                  <div className="col-md-6 mb-4">
                                    <div className="border rounded p-3" style={{ backgroundColor: '#fef2f2', borderColor: '#ef4444 !important' }}>
                                      <label className="form-label fw-bold" style={{ color: '#991b1b', fontSize: '0.95rem' }}>
                                        <i className="fas fa-chart-line me-2"></i>
                                        Mayores Costos
                                      </label>
                                      <div className="input-group mb-2">
                                        <span className="input-group-text" style={{
                                          backgroundColor: '#fee2e2',
                                          color: '#991b1b',
                                          border: '1px solid #ef4444'
                                        }}>
                                          $
                                        </span>
                                        <input
                                          type="number"
                                          className="form-control"
                                          placeholder="0.00"
                                          step="0.01"
                                          min="0"
                                          value={importeMayoresCostosObra}
                                          onChange={(e) => setImporteMayoresCostosObra(e.target.value)}
                                          style={{
                                            border: '1px solid #ef4444',
                                            borderLeft: 'none'
                                          }}
                                        />
                                      </div>

                                      {/* Honorarios para Mayores Costos */}
                                      <div className="mt-2">
                                        <label className="form-label small mb-1" style={{ color: '#6b7280' }}>
                                          <i className="fas fa-handshake me-1"></i>
                                          Honorarios
                                        </label>
                                        <div className="btn-group d-flex mb-1" role="group" style={{ borderRadius: '6px' }}>
                                          <button
                                            type="button"
                                            className={`btn btn-sm ${tipoHonorarioMayoresCostosObra === 'fijo' ? 'btn-danger' : 'btn-outline-danger'}`}
                                            onClick={() => setTipoHonorarioMayoresCostosObra('fijo')}
                                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                                          >
                                            $ Fijo
                                          </button>
                                          <button
                                            type="button"
                                            className={`btn btn-sm ${tipoHonorarioMayoresCostosObra === 'porcentaje' ? 'btn-danger' : 'btn-outline-danger'}`}
                                            onClick={() => setTipoHonorarioMayoresCostosObra('porcentaje')}
                                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                                          >
                                            % Porcentaje
                                          </button>
                                        </div>
                                        <div className="input-group input-group-sm">
                                          <span className="input-group-text" style={{
                                            backgroundColor: '#fee2e2',
                                            color: '#991b1b',
                                            border: '1px solid #ef4444',
                                            fontSize: '0.8rem'
                                          }}>
                                            {tipoHonorarioMayoresCostosObra === 'fijo' ? '$' : '%'}
                                          </span>
                                          <input
                                            type="number"
                                            className="form-control"
                                            placeholder={tipoHonorarioMayoresCostosObra === 'fijo' ? '0.00' : '0'}
                                            step={tipoHonorarioMayoresCostosObra === 'fijo' ? '0.01' : '1'}
                                            min="0"
                                            max={tipoHonorarioMayoresCostosObra === 'porcentaje' ? '100' : undefined}
                                            value={honorarioMayoresCostosObra}
                                            onChange={(e) => setHonorarioMayoresCostosObra(e.target.value)}
                                            style={{
                                              border: '1px solid #ef4444',
                                              borderLeft: 'none',
                                              fontSize: '0.85rem'
                                            }}
                                          />
                                        </div>
                                        {/* C?lculo en tiempo real */}
                                        {importeMayoresCostosObra && honorarioMayoresCostosObra && (
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#fee2e2', borderRadius: '4px', fontSize: '0.75rem', color: '#991b1b' }}>
                                            <strong>?? Importe:</strong> $
                                            {tipoHonorarioMayoresCostosObra === 'fijo'
                                              ? parseFloat(honorarioMayoresCostosObra || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                              : ((parseFloat(importeMayoresCostosObra || 0) * parseFloat(honorarioMayoresCostosObra || 0)) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                            }
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Secci?n de Descuentos */}
                                <div className="mt-4 pt-3" style={{ borderTop: '2px dashed #e5e7eb' }}>
                                  <h6 className="mb-3" style={{ fontWeight: '600', color: '#374151', fontSize: '0.95rem' }}>
                                    <i className="fas fa-percent me-2 text-danger"></i>
                                    Descuentos Aplicables
                                  </h6>

                                  <div className="row">
                                    {/* Descuento Jornales */}
                                    <div className="col-md-6 col-lg-3 mb-3">
                                      <label className="form-label small" style={{ color: '#6b7280', fontWeight: '500' }}>
                                        <i className="fas fa-tag me-1"></i>
                                        Desc. Jornales
                                      </label>
                                      {/* Importe base */}
                                      {importeJornalesObra && (
                                        <div className="mb-2 p-1" style={{ backgroundColor: '#fef3c7', borderRadius: '4px', fontSize: '0.7rem', color: '#92400e', border: '1px solid #f59e0b' }}>
                                          <strong>?? Base:</strong> ${parseFloat(importeJornalesObra || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                      )}
                                      <div className="btn-group d-flex mb-1" role="group" style={{ borderRadius: '6px' }}>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoJornalesObra === 'fijo' ? 'btn-warning' : 'btn-outline-warning'}`}
                                          onClick={() => setTipoDescuentoJornalesObra('fijo')}
                                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }}
                                        >
                                          $ Fijo
                                        </button>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoJornalesObra === 'porcentaje' ? 'btn-warning' : 'btn-outline-warning'}`}
                                          onClick={() => setTipoDescuentoJornalesObra('porcentaje')}
                                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }}
                                        >
                                          % Porcentaje
                                        </button>
                                      </div>
                                      <div className="input-group input-group-sm">
                                        <span className="input-group-text" style={{
                                          backgroundColor: '#fef3c7',
                                          color: '#92400e',
                                          border: '1px solid #f59e0b',
                                          fontSize: '0.75rem'
                                        }}>
                                          {tipoDescuentoJornalesObra === 'fijo' ? '$' : '%'}
                                        </span>
                                        <input
                                          type="number"
                                          className="form-control"
                                          placeholder="0"
                                          step={tipoDescuentoJornalesObra === 'fijo' ? '0.01' : '1'}
                                          min="0"
                                          max={tipoDescuentoJornalesObra === 'porcentaje' ? '100' : undefined}
                                          value={descuentoJornalesObra}
                                          onChange={(e) => setDescuentoJornalesObra(e.target.value)}
                                          style={{
                                            border: '1px solid #f59e0b',
                                            borderLeft: 'none',
                                            fontSize: '0.8rem'
                                          }}
                                        />
                                      </div>
                                      {/* C?lculo descuento */}
                                      {importeJornalesObra && descuentoJornalesObra && (
                                        <>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#fef3c7', borderRadius: '4px', fontSize: '0.7rem', color: '#92400e' }}>
                                            <strong>?? Descuento:</strong> $
                                            {tipoDescuentoJornalesObra === 'fijo'
                                              ? parseFloat(descuentoJornalesObra || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                              : ((parseFloat(importeJornalesObra || 0) * parseFloat(descuentoJornalesObra || 0)) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                            }
                                          </div>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#f59e0b', color: 'white', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                            ?? Total: $
                                            {(() => {
                                              const base = parseFloat(importeJornalesObra || 0);
                                              const desc = tipoDescuentoJornalesObra === 'fijo'
                                                ? parseFloat(descuentoJornalesObra || 0)
                                                : (base * parseFloat(descuentoJornalesObra || 0) / 100);
                                              return (base - desc).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            })()}
                                          </div>
                                        </>
                                      )}
                                    </div>

                                    {/* Descuento Materiales */}
                                    <div className="col-md-6 col-lg-3 mb-3">
                                      <label className="form-label small" style={{ color: '#6b7280', fontWeight: '500' }}>
                                        <i className="fas fa-tag me-1"></i>
                                        Desc. Materiales
                                      </label>
                                      {/* Importe base */}
                                      {importeMaterialesObra && (
                                        <div className="mb-2 p-1" style={{ backgroundColor: '#dbeafe', borderRadius: '4px', fontSize: '0.7rem', color: '#1e40af', border: '1px solid #3b82f6' }}>
                                          <strong>?? Base:</strong> ${parseFloat(importeMaterialesObra || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                      )}
                                      <div className="btn-group d-flex mb-1" role="group" style={{ borderRadius: '6px' }}>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoMaterialesObra === 'fijo' ? 'btn-primary' : 'btn-outline-primary'}`}
                                          onClick={() => setTipoDescuentoMaterialesObra('fijo')}
                                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }}
                                        >
                                          $ Fijo
                                        </button>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoMaterialesObra === 'porcentaje' ? 'btn-primary' : 'btn-outline-primary'}`}
                                          onClick={() => setTipoDescuentoMaterialesObra('porcentaje')}
                                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }}
                                        >
                                          % Porcentaje
                                        </button>
                                      </div>
                                      <div className="input-group input-group-sm">
                                        <span className="input-group-text" style={{
                                          backgroundColor: '#dbeafe',
                                          color: '#1e40af',
                                          border: '1px solid #3b82f6',
                                          fontSize: '0.75rem'
                                        }}>
                                          {tipoDescuentoMaterialesObra === 'fijo' ? '$' : '%'}
                                        </span>
                                        <input
                                          type="number"
                                          className="form-control"
                                          placeholder="0"
                                          step={tipoDescuentoMaterialesObra === 'fijo' ? '0.01' : '1'}
                                          min="0"
                                          max={tipoDescuentoMaterialesObra === 'porcentaje' ? '100' : undefined}
                                          value={descuentoMaterialesObra}
                                          onChange={(e) => setDescuentoMaterialesObra(e.target.value)}
                                          style={{
                                            border: '1px solid #3b82f6',
                                            borderLeft: 'none',
                                            fontSize: '0.8rem'
                                          }}
                                        />
                                      </div>
                                      {/* C?lculo descuento */}
                                      {importeMaterialesObra && descuentoMaterialesObra && (
                                        <>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#dbeafe', borderRadius: '4px', fontSize: '0.7rem', color: '#1e40af' }}>
                                            <strong>?? Descuento:</strong> $
                                            {tipoDescuentoMaterialesObra === 'fijo'
                                              ? parseFloat(descuentoMaterialesObra || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                              : ((parseFloat(importeMaterialesObra || 0) * parseFloat(descuentoMaterialesObra || 0)) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                            }
                                          </div>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#3b82f6', color: 'white', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                            ?? Total: $
                                            {(() => {
                                              const base = parseFloat(importeMaterialesObra || 0);
                                              const desc = tipoDescuentoMaterialesObra === 'fijo'
                                                ? parseFloat(descuentoMaterialesObra || 0)
                                                : (base * parseFloat(descuentoMaterialesObra || 0) / 100);
                                              return (base - desc).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            })()}
                                          </div>
                                        </>
                                      )}
                                    </div>

                                    {/* Descuento Gastos Generales */}
                                    <div className="col-md-6 col-lg-3 mb-3">
                                      <label className="form-label small" style={{ color: '#6b7280', fontWeight: '500' }}>
                                        <i className="fas fa-tag me-1"></i>
                                        Desc. Gastos Generales
                                      </label>
                                      {/* Importe base */}
                                      {importeGastosGeneralesObra && (
                                        <div className="mb-2 p-1" style={{ backgroundColor: '#d1fae5', borderRadius: '4px', fontSize: '0.7rem', color: '#065f46', border: '1px solid #10b981' }}>
                                          <strong>?? Base:</strong> ${parseFloat(importeGastosGeneralesObra || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                      )}
                                      <div className="btn-group d-flex mb-1" role="group" style={{ borderRadius: '6px' }}>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoGastosGeneralesObra === 'fijo' ? 'btn-success' : 'btn-outline-success'}`}
                                          onClick={() => setTipoDescuentoGastosGeneralesObra('fijo')}
                                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }}
                                        >
                                          $ Fijo
                                        </button>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoGastosGeneralesObra === 'porcentaje' ? 'btn-success' : 'btn-outline-success'}`}
                                          onClick={() => setTipoDescuentoGastosGeneralesObra('porcentaje')}
                                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }}
                                        >
                                          % Porcentaje
                                        </button>
                                      </div>
                                      <div className="input-group input-group-sm">
                                        <span className="input-group-text" style={{
                                          backgroundColor: '#d1fae5',
                                          color: '#065f46',
                                          border: '1px solid #10b981',
                                          fontSize: '0.75rem'
                                        }}>
                                          {tipoDescuentoGastosGeneralesObra === 'fijo' ? '$' : '%'}
                                        </span>
                                        <input
                                          type="number"
                                          className="form-control"
                                          placeholder="0"
                                          step={tipoDescuentoGastosGeneralesObra === 'fijo' ? '0.01' : '1'}
                                          min="0"
                                          max={tipoDescuentoGastosGeneralesObra === 'porcentaje' ? '100' : undefined}
                                          value={descuentoGastosGeneralesObra}
                                          onChange={(e) => setDescuentoGastosGeneralesObra(e.target.value)}
                                          style={{
                                            border: '1px solid #10b981',
                                            borderLeft: 'none',
                                            fontSize: '0.8rem'
                                          }}
                                        />
                                      </div>
                                      {/* C?lculo descuento */}
                                      {importeGastosGeneralesObra && descuentoGastosGeneralesObra && (
                                        <>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#d1fae5', borderRadius: '4px', fontSize: '0.7rem', color: '#065f46' }}>
                                            <strong>?? Descuento:</strong> $
                                            {tipoDescuentoGastosGeneralesObra === 'fijo'
                                              ? parseFloat(descuentoGastosGeneralesObra || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                              : ((parseFloat(importeGastosGeneralesObra || 0) * parseFloat(descuentoGastosGeneralesObra || 0)) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                            }
                                          </div>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#10b981', color: 'white', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                            ?? Total: $
                                            {(() => {
                                              const base = parseFloat(importeGastosGeneralesObra || 0);
                                              const desc = tipoDescuentoGastosGeneralesObra === 'fijo'
                                                ? parseFloat(descuentoGastosGeneralesObra || 0)
                                                : (base * parseFloat(descuentoGastosGeneralesObra || 0) / 100);
                                              return (base - desc).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            })()}
                                          </div>
                                        </>
                                      )}
                                    </div>

                                    {/* Descuento Mayores Costos */}
                                    <div className="col-md-6 col-lg-3 mb-3">
                                      <label className="form-label small" style={{ color: '#6b7280', fontWeight: '500' }}>
                                        <i className="fas fa-tag me-1"></i>
                                        Desc. Mayores Costos
                                      </label>
                                      {/* Importe base */}
                                      {importeMayoresCostosObra && (
                                        <div className="mb-2 p-1" style={{ backgroundColor: '#fee2e2', borderRadius: '4px', fontSize: '0.7rem', color: '#991b1b', border: '1px solid #ef4444' }}>
                                          <strong>?? Base:</strong> ${parseFloat(importeMayoresCostosObra || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                      )}
                                      <div className="btn-group d-flex mb-1" role="group" style={{ borderRadius: '6px' }}>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoMayoresCostosObra === 'fijo' ? 'btn-danger' : 'btn-outline-danger'}`}
                                          onClick={() => setTipoDescuentoMayoresCostosObra('fijo')}
                                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }}
                                        >
                                          $ Fijo
                                        </button>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoMayoresCostosObra === 'porcentaje' ? 'btn-danger' : 'btn-outline-danger'}`}
                                          onClick={() => setTipoDescuentoMayoresCostosObra('porcentaje')}
                                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }}
                                        >
                                          % Porcentaje
                                        </button>
                                      </div>
                                      <div className="input-group input-group-sm">
                                        <span className="input-group-text" style={{
                                          backgroundColor: '#fee2e2',
                                          color: '#991b1b',
                                          border: '1px solid #ef4444',
                                          fontSize: '0.75rem'
                                        }}>
                                          {tipoDescuentoMayoresCostosObra === 'fijo' ? '$' : '%'}
                                        </span>
                                        <input
                                          type="number"
                                          className="form-control"
                                          placeholder="0"
                                          step={tipoDescuentoMayoresCostosObra === 'fijo' ? '0.01' : '1'}
                                          min="0"
                                          max={tipoDescuentoMayoresCostosObra === 'porcentaje' ? '100' : undefined}
                                          value={descuentoMayoresCostosObra}
                                          onChange={(e) => setDescuentoMayoresCostosObra(e.target.value)}
                                          style={{
                                            border: '1px solid #ef4444',
                                            borderLeft: 'none',
                                            fontSize: '0.8rem'
                                          }}
                                        />
                                      </div>
                                      {/* C?lculo descuento */}
                                      {importeMayoresCostosObra && descuentoMayoresCostosObra && (
                                        <>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#fee2e2', borderRadius: '4px', fontSize: '0.7rem', color: '#991b1b' }}>
                                            <strong>?? Descuento:</strong> $
                                            {tipoDescuentoMayoresCostosObra === 'fijo'
                                              ? parseFloat(descuentoMayoresCostosObra || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                              : ((parseFloat(importeMayoresCostosObra || 0) * parseFloat(descuentoMayoresCostosObra || 0)) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                            }
                                          </div>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#ef4444', color: 'white', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                            ?? Total: $
                                            {(() => {
                                              const base = parseFloat(importeMayoresCostosObra || 0);
                                              const desc = tipoDescuentoMayoresCostosObra === 'fijo'
                                                ? parseFloat(descuentoMayoresCostosObra || 0)
                                                : (base * parseFloat(descuentoMayoresCostosObra || 0) / 100);
                                              return (base - desc).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            })()}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Secci?n de Descuentos sobre Honorarios */}
                                <div className="mt-4 pt-3" style={{ borderTop: '2px dashed #dc3545' }}>
                                  <h6 className="mb-3" style={{ fontWeight: '600', color: '#dc3545', fontSize: '0.95rem' }}>
                                    <i className="fas fa-percentage me-2 text-danger"></i>
                                    Descuentos sobre Honorarios
                                  </h6>

                                  <div className="row">
                                    {/* Descuento Honorario Jornales */}
                                    <div className="col-md-6 col-lg-3 mb-3">
                                      <label className="form-label small" style={{ color: '#6b7280', fontWeight: '500' }}>
                                        <i className="fas fa-percentage me-1"></i>
                                        Desc. Hon. Jornales
                                      </label>
                                      {/* Honorario base */}
                                      {honorarioJornalesObra && importeJornalesObra && (
                                        <div className="mb-2 p-1" style={{ backgroundColor: '#fef3c7', borderRadius: '4px', fontSize: '0.7rem', color: '#92400e', border: '1px solid #f59e0b' }}>
                                          <strong>?? Hon. Base:</strong> $
                                          {(tipoHonorarioJornalesObra === 'fijo'
                                            ? parseFloat(honorarioJornalesObra || 0)
                                            : ((parseFloat(importeJornalesObra || 0) * parseFloat(honorarioJornalesObra || 0)) / 100)
                                          ).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                      )}
                                      <div className="btn-group d-flex mb-1" role="group" style={{ borderRadius: '6px' }}>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoHonorarioJornalesObra === 'fijo' ? 'btn-outline-warning' : 'btn-outline-warning active'}`}
                                          onClick={() => setTipoDescuentoHonorarioJornalesObra('fijo')}
                                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }}
                                        >
                                          $ Fijo
                                        </button>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoHonorarioJornalesObra === 'porcentaje' ? 'btn-outline-warning active' : 'btn-outline-warning'}`}
                                          onClick={() => setTipoDescuentoHonorarioJornalesObra('porcentaje')}
                                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }}
                                        >
                                          % Porcentaje
                                        </button>
                                      </div>
                                      <div className="input-group input-group-sm">
                                        <span className="input-group-text" style={{
                                          backgroundColor: '#fef3c7',
                                          color: '#92400e',
                                          border: '1px solid #f59e0b',
                                          fontSize: '0.75rem'
                                        }}>
                                          {tipoDescuentoHonorarioJornalesObra === 'fijo' ? '$' : '%'}
                                        </span>
                                        <input
                                          type="number"
                                          className="form-control"
                                          placeholder="0"
                                          step={tipoDescuentoHonorarioJornalesObra === 'fijo' ? '0.01' : '1'}
                                          min="0"
                                          max={tipoDescuentoHonorarioJornalesObra === 'porcentaje' ? '100' : undefined}
                                          value={descuentoHonorarioJornalesObra}
                                          onChange={(e) => setDescuentoHonorarioJornalesObra(e.target.value)}
                                          style={{
                                            border: '1px solid #f59e0b',
                                            borderLeft: 'none',
                                            fontSize: '0.8rem'
                                          }}
                                        />
                                      </div>
                                      {/* C?lculo descuento sobre honorario */}
                                      {honorarioJornalesObra && descuentoHonorarioJornalesObra && (
                                        <>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#fef3c7', borderRadius: '4px', fontSize: '0.7rem', color: '#92400e' }}>
                                            <strong>?? Descuento:</strong> $
                                            {(() => {
                                              const honorario = tipoHonorarioJornalesObra === 'fijo'
                                                ? parseFloat(honorarioJornalesObra || 0)
                                                : ((parseFloat(importeJornalesObra || 0) * parseFloat(honorarioJornalesObra || 0)) / 100);
                                              const descuento = tipoDescuentoHonorarioJornalesObra === 'fijo'
                                                ? parseFloat(descuentoHonorarioJornalesObra || 0)
                                                : (honorario * parseFloat(descuentoHonorarioJornalesObra || 0) / 100);
                                              return descuento.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            })()}
                                          </div>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#f59e0b', color: 'white', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                            ?? Hon. Final: $
                                            {(() => {
                                              const honorario = tipoHonorarioJornalesObra === 'fijo'
                                                ? parseFloat(honorarioJornalesObra || 0)
                                                : ((parseFloat(importeJornalesObra || 0) * parseFloat(honorarioJornalesObra || 0)) / 100);
                                              const descuento = tipoDescuentoHonorarioJornalesObra === 'fijo'
                                                ? parseFloat(descuentoHonorarioJornalesObra || 0)
                                                : (honorario * parseFloat(descuentoHonorarioJornalesObra || 0) / 100);
                                              return (honorario - descuento).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            })()}
                                          </div>
                                        </>
                                      )}
                                    </div>

                                    {/* Descuento Honorario Materiales */}
                                    <div className="col-md-6 col-lg-3 mb-3">
                                      <label className="form-label small" style={{ color: '#6b7280', fontWeight: '500' }}>
                                        <i className="fas fa-percentage me-1"></i>
                                        Desc. Hon. Materiales
                                      </label>
                                      {/* Honorario base */}
                                      {honorarioMaterialesObra && importeMaterialesObra && (
                                        <div className="mb-2 p-1" style={{ backgroundColor: '#dbeafe', borderRadius: '4px', fontSize: '0.7rem', color: '#1e40af', border: '1px solid #3b82f6' }}>
                                          <strong>?? Hon. Base:</strong> $
                                          {(tipoHonorarioMaterialesObra === 'fijo'
                                            ? parseFloat(honorarioMaterialesObra || 0)
                                            : ((parseFloat(importeMaterialesObra || 0) * parseFloat(honorarioMaterialesObra || 0)) / 100)
                                          ).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                      )}
                                      <div className="btn-group d-flex mb-1" role="group" style={{ borderRadius: '6px' }}>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoHonorarioMaterialesObra === 'fijo' ? 'btn-outline-primary active' : 'btn-outline-primary'}`}
                                          onClick={() => setTipoDescuentoHonorarioMaterialesObra('fijo')}
                                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }}
                                        >
                                          $ Fijo
                                        </button>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoHonorarioMaterialesObra === 'porcentaje' ? 'btn-outline-primary active' : 'btn-outline-primary'}`}
                                          onClick={() => setTipoDescuentoHonorarioMaterialesObra('porcentaje')}
                                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }}
                                        >
                                          % Porcentaje
                                        </button>
                                      </div>
                                      <div className="input-group input-group-sm">
                                        <span className="input-group-text" style={{
                                          backgroundColor: '#dbeafe',
                                          color: '#1e40af',
                                          border: '1px solid #3b82f6',
                                          fontSize: '0.75rem'
                                        }}>
                                          {tipoDescuentoHonorarioMaterialesObra === 'fijo' ? '$' : '%'}
                                        </span>
                                        <input
                                          type="number"
                                          className="form-control"
                                          placeholder="0"
                                          step={tipoDescuentoHonorarioMaterialesObra === 'fijo' ? '0.01' : '1'}
                                          min="0"
                                          max={tipoDescuentoHonorarioMaterialesObra === 'porcentaje' ? '100' : undefined}
                                          value={descuentoHonorarioMaterialesObra}
                                          onChange={(e) => setDescuentoHonorarioMaterialesObra(e.target.value)}
                                          style={{
                                            border: '1px solid #3b82f6',
                                            borderLeft: 'none',
                                            fontSize: '0.8rem'
                                          }}
                                        />
                                      </div>
                                      {/* C?lculo descuento sobre honorario */}
                                      {honorarioMaterialesObra && descuentoHonorarioMaterialesObra && (
                                        <>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#dbeafe', borderRadius: '4px', fontSize: '0.7rem', color: '#1e40af' }}>
                                            <strong>?? Descuento:</strong> $
                                            {(() => {
                                              const honorario = tipoHonorarioMaterialesObra === 'fijo'
                                                ? parseFloat(honorarioMaterialesObra || 0)
                                                : ((parseFloat(importeMaterialesObra || 0) * parseFloat(honorarioMaterialesObra || 0)) / 100);
                                              const descuento = tipoDescuentoHonorarioMaterialesObra === 'fijo'
                                                ? parseFloat(descuentoHonorarioMaterialesObra || 0)
                                                : (honorario * parseFloat(descuentoHonorarioMaterialesObra || 0) / 100);
                                              return descuento.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            })()}
                                          </div>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#3b82f6', color: 'white', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                            ?? Hon. Final: $
                                            {(() => {
                                              const honorario = tipoHonorarioMaterialesObra === 'fijo'
                                                ? parseFloat(honorarioMaterialesObra || 0)
                                                : ((parseFloat(importeMaterialesObra || 0) * parseFloat(honorarioMaterialesObra || 0)) / 100);
                                              const descuento = tipoDescuentoHonorarioMaterialesObra === 'fijo'
                                                ? parseFloat(descuentoHonorarioMaterialesObra || 0)
                                                : (honorario * parseFloat(descuentoHonorarioMaterialesObra || 0) / 100);
                                              return (honorario - descuento).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            })()}
                                          </div>
                                        </>
                                      )}
                                    </div>

                                    {/* Descuento Honorario Gastos Generales */}
                                    <div className="col-md-6 col-lg-3 mb-3">
                                      <label className="form-label small" style={{ color: '#6b7280', fontWeight: '500' }}>
                                        <i className="fas fa-percentage me-1"></i>
                                        Desc. Hon. Gastos Generales
                                      </label>
                                      {/* Honorario base */}
                                      {honorarioGastosGeneralesObra && importeGastosGeneralesObra && (
                                        <div className="mb-2 p-1" style={{ backgroundColor: '#d1fae5', borderRadius: '4px', fontSize: '0.7rem', color: '#065f46', border: '1px solid #10b981' }}>
                                          <strong>?? Hon. Base:</strong> $
                                          {(tipoHonorarioGastosGeneralesObra === 'fijo'
                                            ? parseFloat(honorarioGastosGeneralesObra || 0)
                                            : ((parseFloat(importeGastosGeneralesObra || 0) * parseFloat(honorarioGastosGeneralesObra || 0)) / 100)
                                          ).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                      )}
                                      <div className="btn-group d-flex mb-1" role="group" style={{ borderRadius: '6px' }}>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoHonorarioGastosGeneralesObra === 'fijo' ? 'btn-outline-success active' : 'btn-outline-success'}`}
                                          onClick={() => setTipoDescuentoHonorarioGastosGeneralesObra('fijo')}
                                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }}
                                        >
                                          $ Fijo
                                        </button>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoHonorarioGastosGeneralesObra === 'porcentaje' ? 'btn-outline-success active' : 'btn-outline-success'}`}
                                          onClick={() => setTipoDescuentoHonorarioGastosGeneralesObra('porcentaje')}
                                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }}
                                        >
                                          % Porcentaje
                                        </button>
                                      </div>
                                      <div className="input-group input-group-sm">
                                        <span className="input-group-text" style={{
                                          backgroundColor: '#d1fae5',
                                          color: '#065f46',
                                          border: '1px solid #10b981',
                                          fontSize: '0.75rem'
                                        }}>
                                          {tipoDescuentoHonorarioGastosGeneralesObra === 'fijo' ? '$' : '%'}
                                        </span>
                                        <input
                                          type="number"
                                          className="form-control"
                                          placeholder="0"
                                          step={tipoDescuentoHonorarioGastosGeneralesObra === 'fijo' ? '0.01' : '1'}
                                          min="0"
                                          max={tipoDescuentoHonorarioGastosGeneralesObra === 'porcentaje' ? '100' : undefined}
                                          value={descuentoHonorarioGastosGeneralesObra}
                                          onChange={(e) => setDescuentoHonorarioGastosGeneralesObra(e.target.value)}
                                          style={{
                                            border: '1px solid #10b981',
                                            borderLeft: 'none',
                                            fontSize: '0.8rem'
                                          }}
                                        />
                                      </div>
                                      {/* Honorario Base */}
                                      {honorarioGastosGeneralesObra && importeGastosGeneralesObra && (
                                        <div className="mt-1 p-1" style={{ backgroundColor: '#ecfdf5', borderRadius: '4px', fontSize: '0.7rem', color: '#047857', fontWeight: 'bold' }}>
                                          ?? Hon. Base: $
                                          {(tipoHonorarioGastosGeneralesObra === 'fijo'
                                            ? parseFloat(honorarioGastosGeneralesObra || 0)
                                            : ((parseFloat(importeGastosGeneralesObra || 0) * parseFloat(honorarioGastosGeneralesObra || 0)) / 100)
                                          ).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                      )}
                                      {/* C?lculo descuento sobre honorario */}
                                      {honorarioGastosGeneralesObra && descuentoHonorarioGastosGeneralesObra && (
                                        <>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#d1fae5', borderRadius: '4px', fontSize: '0.7rem', color: '#065f46' }}>
                                            <strong>?? Descuento:</strong> $
                                            {(() => {
                                              const honorario = tipoHonorarioGastosGeneralesObra === 'fijo'
                                                ? parseFloat(honorarioGastosGeneralesObra || 0)
                                                : ((parseFloat(importeGastosGeneralesObra || 0) * parseFloat(honorarioGastosGeneralesObra || 0)) / 100);
                                              const descuento = tipoDescuentoHonorarioGastosGeneralesObra === 'fijo'
                                                ? parseFloat(descuentoHonorarioGastosGeneralesObra || 0)
                                                : (honorario * parseFloat(descuentoHonorarioGastosGeneralesObra || 0) / 100);
                                              return descuento.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            })()}
                                          </div>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#10b981', color: 'white', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                            ?? Hon. Final: $
                                            {(() => {
                                              const honorario = tipoHonorarioGastosGeneralesObra === 'fijo'
                                                ? parseFloat(honorarioGastosGeneralesObra || 0)
                                                : ((parseFloat(importeGastosGeneralesObra || 0) * parseFloat(honorarioGastosGeneralesObra || 0)) / 100);
                                              const descuento = tipoDescuentoHonorarioGastosGeneralesObra === 'fijo'
                                                ? parseFloat(descuentoHonorarioGastosGeneralesObra || 0)
                                                : (honorario * parseFloat(descuentoHonorarioGastosGeneralesObra || 0) / 100);
                                              return (honorario - descuento).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            })()}
                                          </div>
                                        </>
                                      )}
                                    </div>

                                    {/* Descuento Honorario Mayores Costos */}
                                    <div className="col-md-6 col-lg-3 mb-3">
                                      <label className="form-label small" style={{ color: '#6b7280', fontWeight: '500' }}>
                                        <i className="fas fa-percentage me-1"></i>
                                        Desc. Hon. Mayores Costos
                                      </label>
                                      {/* Honorario base */}
                                      {honorarioMayoresCostosObra && importeMayoresCostosObra && (
                                        <div className="mb-2 p-1" style={{ backgroundColor: '#fee2e2', borderRadius: '4px', fontSize: '0.7rem', color: '#991b1b', border: '1px solid #ef4444' }}>
                                          <strong>?? Hon. Base:</strong> $
                                          {(tipoHonorarioMayoresCostosObra === 'fijo'
                                            ? parseFloat(honorarioMayoresCostosObra || 0)
                                            : ((parseFloat(importeMayoresCostosObra || 0) * parseFloat(honorarioMayoresCostosObra || 0)) / 100)
                                          ).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                      )}
                                      <div className="btn-group d-flex mb-1" role="group" style={{ borderRadius: '6px' }}>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoHonorarioMayoresCostosObra === 'fijo' ? 'btn-outline-danger active' : 'btn-outline-danger'}`}
                                          onClick={() => setTipoDescuentoHonorarioMayoresCostosObra('fijo')}
                                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }}
                                        >
                                          $ Fijo
                                        </button>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoHonorarioMayoresCostosObra === 'porcentaje' ? 'btn-outline-danger active' : 'btn-outline-danger'}`}
                                          onClick={() => setTipoDescuentoHonorarioMayoresCostosObra('porcentaje')}
                                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }}
                                        >
                                          % Porcentaje
                                        </button>
                                      </div>
                                      <div className="input-group input-group-sm">
                                        <span className="input-group-text" style={{
                                          backgroundColor: '#fee2e2',
                                          color: '#991b1b',
                                          border: '1px solid #ef4444',
                                          fontSize: '0.75rem'
                                        }}>
                                          {tipoDescuentoHonorarioMayoresCostosObra === 'fijo' ? '$' : '%'}
                                        </span>
                                        <input
                                          type="number"
                                          className="form-control"
                                          placeholder="0"
                                          step={tipoDescuentoHonorarioMayoresCostosObra === 'fijo' ? '0.01' : '1'}
                                          min="0"
                                          max={tipoDescuentoHonorarioMayoresCostosObra === 'porcentaje' ? '100' : undefined}
                                          value={descuentoHonorarioMayoresCostosObra}
                                          onChange={(e) => setDescuentoHonorarioMayoresCostosObra(e.target.value)}
                                          style={{
                                            border: '1px solid #ef4444',
                                            borderLeft: 'none',
                                            fontSize: '0.8rem'
                                          }}
                                        />
                                      </div>
                                      {/* Honorario Base */}
                                      {honorarioMayoresCostosObra && importeMayoresCostosObra && (
                                        <div className="mt-1 p-1" style={{ backgroundColor: '#fef2f2', borderRadius: '4px', fontSize: '0.7rem', color: '#7f1d1d', fontWeight: 'bold' }}>
                                          ?? Hon. Base: $
                                          {(tipoHonorarioMayoresCostosObra === 'fijo'
                                            ? parseFloat(honorarioMayoresCostosObra || 0)
                                            : ((parseFloat(importeMayoresCostosObra || 0) * parseFloat(honorarioMayoresCostosObra || 0)) / 100)
                                          ).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                      )}
                                      {/* C?lculo descuento sobre honorario */}
                                      {honorarioMayoresCostosObra && descuentoHonorarioMayoresCostosObra && (
                                        <>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#fee2e2', borderRadius: '4px', fontSize: '0.7rem', color: '#991b1b' }}>
                                            <strong>?? Descuento:</strong> $
                                            {(() => {
                                              const honorario = tipoHonorarioMayoresCostosObra === 'fijo'
                                                ? parseFloat(honorarioMayoresCostosObra || 0)
                                                : ((parseFloat(importeMayoresCostosObra || 0) * parseFloat(honorarioMayoresCostosObra || 0)) / 100);
                                              const descuento = tipoDescuentoHonorarioMayoresCostosObra === 'fijo'
                                                ? parseFloat(descuentoHonorarioMayoresCostosObra || 0)
                                                : (honorario * parseFloat(descuentoHonorarioMayoresCostosObra || 0) / 100);
                                              return descuento.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            })()}
                                          </div>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#ef4444', color: 'white', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                            ?? Hon. Final: $
                                            {(() => {
                                              const honorario = tipoHonorarioMayoresCostosObra === 'fijo'
                                                ? parseFloat(honorarioMayoresCostosObra || 0)
                                                : ((parseFloat(importeMayoresCostosObra || 0) * parseFloat(honorarioMayoresCostosObra || 0)) / 100);
                                              const descuento = tipoDescuentoHonorarioMayoresCostosObra === 'fijo'
                                                ? parseFloat(descuentoHonorarioMayoresCostosObra || 0)
                                                : (honorario * parseFloat(descuentoHonorarioMayoresCostosObra || 0) / 100);
                                              return (honorario - descuento).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            })()}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Resumen del Total */}
                                {importeTotalObra && (
                                  <div className="alert alert-success mb-0 mt-2" style={{
                                    borderRadius: '8px',
                                    border: '2px solid #10b981',
                                    backgroundColor: '#ecfdf5'
                                  }}>
                                    <div className="d-flex justify-content-between align-items-center">
                                      <span className="fw-semibold">
                                        <i className="fas fa-check-circle me-2"></i>
                                        Presupuesto Total Calculado:
                                      </span>
                                      <span className="fs-5 fw-bold text-success">
                                        ${parseFloat(importeTotalObra).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                    <small className="text-muted d-block mt-2">
                                      <div className="row">
                                        <div className="col-6 mb-1">
                                          ?? <strong>Jornales:</strong> ${(parseFloat(importeJornalesObra) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                          {honorarioJornalesObra && parseFloat(honorarioJornalesObra) > 0 && (
                                            <span className="ms-1 text-success">
                                              + Hon. {tipoHonorarioJornalesObra === 'porcentaje' ? `${honorarioJornalesObra}%` : `$${(parseFloat(honorarioJornalesObra) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                                            </span>
                                          )}
                                        </div>
                                        <div className="col-6 mb-1">
                                          ?? <strong>Materiales:</strong> ${(parseFloat(importeMaterialesObra) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                          {honorarioMaterialesObra && parseFloat(honorarioMaterialesObra) > 0 && (
                                            <span className="ms-1 text-success">
                                              + Hon. {tipoHonorarioMaterialesObra === 'porcentaje' ? `${honorarioMaterialesObra}%` : `$${(parseFloat(honorarioMaterialesObra) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                                            </span>
                                          )}
                                        </div>
                                        <div className="col-6 mb-1">
                                          ?? <strong>Gastos Generales:</strong> ${(parseFloat(importeGastosGeneralesObra) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                          {honorarioGastosGeneralesObra && parseFloat(honorarioGastosGeneralesObra) > 0 && (
                                            <span className="ms-1 text-success">
                                              + Hon. {tipoHonorarioGastosGeneralesObra === 'porcentaje' ? `${honorarioGastosGeneralesObra}%` : `$${(parseFloat(honorarioGastosGeneralesObra) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                                            </span>
                                          )}
                                        </div>
                                        <div className="col-6 mb-1">
                                          ?? <strong>Mayores Costos:</strong> ${(parseFloat(importeMayoresCostosObra) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                          {honorarioMayoresCostosObra && parseFloat(honorarioMayoresCostosObra) > 0 && (
                                            <span className="ms-1 text-success">
                                              + Hon. {tipoHonorarioMayoresCostosObra === 'porcentaje' ? `${honorarioMayoresCostosObra}%` : `$${(parseFloat(honorarioMayoresCostosObra) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </small>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mb-3">
                          <label className="form-label">Observaciones</label>
                          <textarea
                            className="form-control"
                            rows="2"
                            placeholder="Observaciones generales de la obra"
                            value={formData.observaciones || ''}
                            onChange={(e) => setFormData({...formData, observaciones: e.target.value})}
                            style={{borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Profesionales Asignados */}
                    <div className="card mb-3">
                      <div className="card-header bg-light">
                        <h6 className="mb-0"><i className="fas fa-users me-2"></i>Profesionales Asignados</h6>
                      </div>
                      <div className="card-body">
                        <div className="mb-3">
                          <button
                            type="button"
                            className="btn btn-primary w-100"
                            onClick={() => setMostrarModalSeleccionProfesionales(true)}
                          >
                            <i className="bi bi-person-plus me-2"></i>
                            {profesionalesAsignadosForm.length > 0
                              ? `Modificar Equipo (${profesionalesAsignadosForm.length} seleccionados)`
                              : 'Seleccionar Profesionales'}
                          </button>
                        </div>

                        {profesionalesAsignadosForm.length === 0 ? (
                          <div className="text-center text-muted py-3">
                            <i className="fas fa-user-slash fa-2x mb-2"></i>
                            <p className="mb-0">No hay profesionales asignados</p>
                            <small>Haz clic en "Seleccionar Profesionales" para comenzar</small>
                          </div>
                        ) : (
                          <div>
                            <div className="alert alert-light mb-3">
                              <strong className="d-block mb-2">
                                <i className="fas fa-check-circle text-success me-2"></i>
                                {profesionalesAsignadosForm.length} profesional(es) seleccionado(s):
                              </strong>
                              <div className="d-flex flex-wrap gap-2">
                                {profesionalesAsignadosForm.map(prof => (
                                  <span
                                    key={prof.id}
                                    className="badge bg-primary d-flex align-items-center gap-2"
                                    style={{ fontSize: '0.9rem', padding: '0.5rem 0.75rem' }}
                                  >
                                    {prof.nombre}
                                    <button
                                      type="button"
                                      className="btn-close btn-close-white"
                                      aria-label="Eliminar"
                                      onClick={() => setProfesionalesAsignadosForm(prev => prev.filter(p => p.id !== prof.id))}
                                      style={{ fontSize: '0.6rem' }}
                                    ></button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Secci?n de Etapas Diarias - Solo en modo edici?n */}
                    {modoEdicion && obraEditando && (
                      <div className="card mt-4">
                        <div className="card-header bg-info text-white">
                          <h6 className="mb-0">
                            <i className="fas fa-calendar-alt me-2"></i>
                            Etapas Diarias de la Obra
                          </h6>
                        </div>
                        <div className="card-body">
                          {loadingEtapasDiarias ? (
                            <div className="text-center py-3">
                              <div className="spinner-border spinner-border-sm text-info" role="status">
                                <span className="visually-hidden">Cargando...</span>
                              </div>
                              <p className="text-muted mt-2 mb-0">Cargando etapas...</p>
                            </div>
                          ) : etapasDiarias && etapasDiarias.length > 0 ? (
                            <>
                              <div className="alert alert-success mb-3">
                                <i className="fas fa-check-circle me-2"></i>
                                Esta obra tiene <strong>{etapasDiarias.length}</strong> etapa{etapasDiarias.length > 1 ? 's' : ''} programada{etapasDiarias.length > 1 ? 's' : ''}
                              </div>
                              <div className="table-responsive">
                                <table className="table table-sm table-hover">
                                  <thead className="table-light">
                                    <tr>
                                      <th>DD?a</th>
                                      <th>Fecha</th>
                                      <th>Descripci?n</th>
                                      <th>Tareas</th>
                                      <th>Estado</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {etapasDiarias.map((etapa, index) => (
                                      <tr key={etapa.id || index}>
                                        <td>
                                          <span className="badge bg-secondary">
                                            DD?a {etapa.numeroDia || index + 1}
                                          </span>
                                        </td>
                                        <td>
                                          <small>{etapa.fecha || '-'}</small>
                                        </td>
                                        <td>
                                          <small>{etapa.descripcion || 'Sin descripci?n'}</small>
                                        </td>
                                        <td>
                                          {etapa.tareas && etapa.tareas.length > 0 ? (
                                            <small className="text-muted">
                                              {etapa.tareas.length} tarea(s)
                                            </small>
                                          ) : (
                                            <small className="text-muted">Sin tareas</small>
                                          )}
                                        </td>
                                        <td>
                                                                                   {etapa.estado === 'COMPLETADA' ? (
                                            <span className="badge bg-success">? Completada</span>
                                          ) : etapa.estado === 'EN_PROCESO' ? (
                                            <span className="badge bg-primary">?? En Proceso</span>
                                          ) : (
                                            <span className="badge bg-secondary">? Pendiente</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </>
                          ) : (
                            <div className="alert alert-warning mb-0">
                              <i className="fas fa-exclamation-triangle me-2"></i>
                              <strong>No hay etapas diarias programadas</strong>
                              <p className="mb-0 mt-2 small">
                                Las etapas diarias se generan autom?ticamente cuando la obra tiene un presupuesto aprobado con jornales y una fecha de inicio programada.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="d-flex gap-2 mt-3">
                      <button
                        type="button"
                        className="btn btn-secondary flex-fill"
                        onClick={() => {
                          // Limpiar modo edici?n si est? activo
                          if (modoEdicion) {
                            setModoEdicion(false);
                            setObraEditando(null);
                            setFormData({
                              nombre: '',
                              direccion: '',
                              estado: 'APROBADO',
                              fechaInicio: '',
                              fechaFin: '',
                              presupuestoEstimado: '',
                              idCliente: '',
                              nombreSolicitante: '',
                              telefono: '',
                              direccionParticular: '',
                              mail: '',
                              direccionObraCalle: '',
                              direccionObraAltura: '',
                              direccionObraBarrio: '',
                              direccionObraTorre: '',
                              direccionObraPiso: '',
                              direccionObraDepartamento: '',
                              descripcion: '',
                              observaciones: ''
                            });
                            setProfesionalesAsignadosForm([]);

                            // Limpiar estados del desglose de obra
                            setUsarDesgloseObra(false);
                            setImporteMaterialesObra('');
                            setImporteJornalesObra('');
                            setImporteGastosGeneralesObra('');
                            setImporteMayoresCostosObra('');
                            setHonorarioJornalesObra('');
                            setTipoHonorarioJornalesObra('porcentaje');
                            setHonorarioMaterialesObra('');
                            setTipoHonorarioMaterialesObra('porcentaje');
                            setHonorarioGastosGeneralesObra('');
                            setTipoHonorarioGastosGeneralesObra('porcentaje');
                            setHonorarioMayoresCostosObra('');
                            setTipoHonorarioMayoresCostosObra('porcentaje');
                            setDescuentoJornalesObra('');
                            setTipoDescuentoJornalesObra('porcentaje');
                            setDescuentoMaterialesObra('');
                            setTipoDescuentoMaterialesObra('porcentaje');
                            setDescuentoGastosGeneralesObra('');
                            setTipoDescuentoGastosGeneralesObra('porcentaje');
                            setDescuentoMayoresCostosObra('');
                            setTipoDescuentoMayoresCostosObra('porcentaje');
                            setImporteTotalObra('');
                          }
                          dispatch(setActiveTab('lista'));
                        }}
                      >
                        <i className="fas fa-times me-2"></i>
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary flex-fill"
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2"></span>
                            {modoEdicion ? 'Actualizando...' : 'Creando...'}
                          </>
                        ) : (
                          <>
                            <i className={`fas ${modoEdicion ? 'fa-save' : 'fa-plus'} me-2`}></i>
                            {modoEdicion ? 'Actualizar Obra' : 'Crear Obra'}
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Tab B?squeda */}
      {activeTab === 'busqueda' && (
        <div className="row">
          <div className="col-md-12">
            <div className="card">
              <div className="card-header">
                <h5>B?squeda por Cliente</h5>
              </div>
              <div className="card-body">
                <div className="d-flex gap-2 mb-3">
                  <div className="flex-grow-1">
                    <ClienteSelector
                      value={busquedaData.clienteId}
                      onChange={(selection) => setBusquedaData({...busquedaData, clienteId: selection.id})}
                      empresaId={empresaId}
                      placeholder="Seleccionar cliente..."
                    />
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={handleBuscarPorCliente}
                    disabled={!busquedaData.clienteId}
                  >
                    <i className="fas fa-search me-1"></i>Buscar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Profesionales */}
      {activeTab === 'profesionales' && (
        <div className="row">
          <div className="col-12">
            <div className="card" onClick={(e) => e.stopPropagation()}>
              <div className="card-header d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center">
                  <button
                    className="btn btn-outline-primary me-3"
                    onClick={() => {
                      if (obraParaEtapasDiarias?._esTrabajoExtra && obraParaEtapasDiarias?._obraOriginalId) {
                        setObraParaTrabajosExtra(obras.find(o => o.id === obraParaEtapasDiarias._obraOriginalId));
                        setObraParaEtapasDiarias(null);
                        dispatch(setActiveTab('trabajos-extra'));
                      } else {
                        dispatch(setActiveTab('lista'));
                      }
                    }}
                    title="Volver a la lista de obras"
                  >
                    <i className="fas fa-arrow-left me-1"></i>Volver a Obras
                  </button>
                  <h5 className="mb-0">Profesionales Asignados</h5>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => dispatch(clearProfesionalesAsignados())}
                >
                  <i className="fas fa-times me-1"></i>Limpiar
                </button>
              </div>
              <div className="card-body">
                {profesionalesAsignados.length === 0 ? (
                  <div className="text-center text-muted py-4">
                    <i className="fas fa-users fa-3x mb-3"></i>
                    <p>No hay profesionales asignados cargados</p>
                    <p className="small">Haga clic en el bot?n <i className="fas fa-users"></i> de una obra para cargar sus profesionales</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-striped">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Nombre</th>
                          <th>Especialidad</th>
                          <th>Email</th>
                          <th>Porcentaje Ganancia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profesionalesAsignados.map(profesional => (
                          <tr key={profesional.id}>
                            <td>{profesional.id}</td>
                            <td>{profesional.nombre}</td>
                            <td>{profesional.especialidad}</td>
                            <td>{profesional.email}</td>
                            <td>{profesional.porcentajeGanancia}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Obras Independientes - Obras creadas sin presupuesto previo */}
      {activeTab === 'obras-manuales' && (
        <div className="row" style={{margin: '0'}}>
          <div className="col-12" style={{padding: '0'}}>
            <div className="card" style={{margin: '0', border: 'none'}}>
              <div className="card-header d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-3">
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    type="button"
                    onClick={() => {
                      console.log('🔙 Navegando a Presupuestos No Cliente');
                      navigate('/presupuestos-no-cliente');
                    }}
                    title="Volver a Presupuestos No Cliente"
                  >
                    <i className="fas fa-arrow-left me-1"></i>Volver
                  </button>
                  <h5 className="mb-0">
                    <i className="fas fa-folder-open me-2"></i>
                    Trabajos Diarios / Nuevos Clientes
                  </h5>
                  <span className="badge bg-info text-dark">
                    {obras.filter(obra => {
                      const tienePresupuesto = (presupuestosObras[obra.id] && typeof presupuestosObras[obra.id] === 'object') ||
                                              (obra.presupuestoNoCliente && typeof obra.presupuestoNoCliente === 'object');
                      return !tienePresupuesto && obra.estado !== 'CANCELADO';
                    }).length} obras
                  </span>
                </div>
              </div>
              <div className="card-body" style={{padding: '0'}}>
                {(() => {
                  const obrasManuales = obras.filter(obra => {
                    const tienePresupuesto = (presupuestosObras[obra.id] && typeof presupuestosObras[obra.id] === 'object') ||
                                            (obra.presupuestoNoCliente && typeof obra.presupuestoNoCliente === 'object');
                    return !tienePresupuesto && obra.estado !== 'CANCELADO';
                  });

                  if (obrasManuales.length === 0) {
                    return (
                      <div className="text-center text-muted py-5">
                        <i className="fas fa-folder-open fa-4x mb-3 opacity-50"></i>
                        <h5>No hay obras independientes</h5>
                        <p>Las obras independientes son aquellas creadas directamente sin un presupuesto previo.</p>
                        <button
                          className="btn btn-primary mt-3"
                          onClick={abrirModalTrabajoDiario}
                        >
                          <i className="fas fa-plus me-2"></i>
                          Crear Primer Trabajo Diario
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="table-responsive" style={{margin: '0'}}>
                      <table className="table table-striped table-hover mb-0">
                        <thead className="table-light">
                          <tr>
                            <th className="small" style={{width: '40px'}}>ID</th>
                            <th className="small">Nombre de la Obra</th>
                            <th className="small" style={{width: '120px'}}>Nombre del Cliente</th>
                            <th className="small">Direcci?n</th>
                            <th className="small" style={{width: '100px'}}>Estado</th>
                            <th className="small" style={{width: '80px'}}>Inicio</th>
                            <th className="small" style={{width: '80px'}}>Fin</th>
                            <th className="small" style={{width: '90px'}}>Cliente</th>
                            <th className="small text-center" style={{width: '120px'}}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {obrasManuales.map((obra) => {
                            const isSelected = selectedObraId === obra.id;
                            return (
                              <tr
                                key={obra.id}
                                onClick={() => setSelectedObraId(isSelected ? null : obra.id)}
                                style={{
                                  cursor: 'pointer',
                                  backgroundColor: isSelected ? '#cfe2ff' : 'white',
                                  transition: 'all 0.2s ease'
                                }}
                                className="hover-row"
                              >
                                <td>
                                  {isSelected && <i className="fas fa-check-circle text-success me-1"></i>}
                                  {obra.id}
                                </td>
                                <td>
                                  {obra.nombre || '(Sin nombre)'}
                                  {(() => {
                                    const presupuesto = presupuestosObras[obra.id];
                                    if (presupuesto && typeof presupuesto === 'object') {
                                      const esTrabajoExtra = presupuesto.es_presupuesto_trabajo_extra === true ||
                                                            presupuesto.esPresupuestoTrabajoExtra === true ||
                                                            presupuesto.esPresupuestoTrabajoExtra === 'V';

                                      const esTareaLeve = presupuesto.tipo_presupuesto === 'TAREA_LEVE' ||
                                                         presupuesto.tipoPresupuesto === 'TAREA_LEVE';

                                      if (esTareaLeve) {
                                        return (
                                          <div className="mt-1">
                                            <span className="badge bg-info text-dark" style={{fontSize: '0.7rem'}}>
                                              <i className="fas fa-bolt me-1"></i>Tarea Leve
                                            </span>
                                          </div>
                                        );
                                      } else if (esTrabajoExtra) {
                                        return (
                                          <div className="mt-1">
                                            <span className="badge bg-warning text-dark" style={{fontSize: '0.7rem'}}>
                                              <i className="fas fa-wrench me-1"></i>Adicional Obra
                                            </span>
                                          </div>
                                        );
                                      } else {
                                        return (
                                          <div className="mt-1">
                                            <span className="badge bg-primary text-white" style={{fontSize: '0.7rem'}}>
                                              <i className="fas fa-building me-1"></i>Obra Principal
                                            </span>
                                          </div>
                                        );
                                      }
                                    } else {
                                      // Sin presupuesto - es un Trabajo Diario
                                      return (
                                        <div className="mt-1">
                                          <span className="badge bg-warning text-dark" style={{fontSize: '0.7rem'}}>
                                            <i className="fas fa-hand-paper me-1"></i>Trabajo Diario
                                          </span>
                                        </div>
                                      );
                                    }
                                  })()}
                                </td>
                                <td>
                                  <small className="text-muted">
                                    {getClienteNombre(obra)}
                                  </small>
                                </td>
                                <td><small className="text-muted">{formatearDireccionObra(obra)}</small></td>
                                <td onClick={(e) => e.stopPropagation()}>
                                  <EstadoPresupuestoBadge obraId={obra.id} estadoObra={obra.estado} />
                                </td>
                                <td>
                                  <small>
                                    {obra.fechaInicio ? parseFechaLocal(obra.fechaInicio).toLocaleDateString('es-AR') : 'N/A'}
                                  </small>
                                </td>
                                <td>
                                  <small>
                                    {obra.fechaFin ? parseFechaLocal(obra.fechaFin).toLocaleDateString('es-AR') : 'N/A'}
                                  </small>
                                </td>
                                <td><small>{getClienteInfo(obra)}</small></td>
                                <td className="text-center" onClick={(e) => e.stopPropagation()}>
                                  <div className="btn-group btn-group-sm">
                                    <button
                                      className="btn btn-outline-primary btn-sm"
                                      onClick={() => {
                                        setSelectedObraId(obra.id);
                                        const tienePresupuesto = (presupuestosObras[obra.id] && typeof presupuestosObras[obra.id] === 'object') ||
                                                                (obra.presupuestoNoCliente && typeof obra.presupuestoNoCliente === 'object');

                                        if (tienePresupuesto) {
                                          showNotification(' No se puede editar una obra creada desde presupuesto', 'warning');
                                          return;
                                        }

                                        // Cargar datos en formulario
                                        const mapeoEstados = {
                                          'EN_PLANIFICACI�N': 'BORRADOR',
                                          'EN_PLANIFICACION': 'BORRADOR',
                                          'EN PLANIFICACI�N': 'BORRADOR',
                                          'EN_EJECUCI�N': 'EN_EJECUCION',
                                          'EN_EJECUCION': 'EN_EJECUCION'
                                        };

                                        const estadoOriginal = obra.estado || 'BORRADOR';
                                        const estadoNormalizado = mapeoEstados[estadoOriginal] || estadoOriginal;

                                        setFormData({
                                          nombre: obra.nombre || '',
                                          direccion: obra.direccion || '',
                                          estado: estadoNormalizado,
                                          fechaInicio: obra.fechaInicio || '',
                                          fechaFin: obra.fechaFin || '',
                                          presupuestoEstimado: obra.presupuestoEstimado || '',
                                          idCliente: obra.clienteId || obra.idCliente || '',
                                          empresaId: empresaId,
                                          nombreSolicitante: obra.nombreSolicitante || '',
                                          telefono: obra.telefono || '',
                                          direccionParticular: obra.direccionParticular || '',
                                          mail: obra.mail || '',
                                          direccionObraCalle: obra.direccionObraCalle || '',
                                          direccionObraAltura: obra.direccionObraAltura || '',
                                          direccionObraBarrio: obra.direccionObraBarrio || '',
                                          direccionObraTorre: obra.direccionObraTorre || '',
                                          direccionObraPiso: obra.direccionObraPiso || '',
                                          direccionObraDepartamento: obra.direccionObraDepartamento || '',
                                          descripcion: obra.descripcion || '',
                                          observaciones: obra.observaciones || ''
                                        });

                                        // Restaurar desglose desde campos nativos del DTO
                                        if (obra.presupuestoJornales || obra.presupuestoMateriales || obra.importeGastosGeneralesObra || obra.presupuestoMayoresCostos ||
                                            obra.presupuestoHonorarios) {
                                          setUsarDesgloseObra(true);
                                          setImporteJornalesObra(obra.presupuestoJornales != null ? String(obra.presupuestoJornales) : '');
                                          setImporteMaterialesObra(obra.presupuestoMateriales != null ? String(obra.presupuestoMateriales) : '');
                                          setImporteGastosGeneralesObra(obra.importeGastosGeneralesObra != null ? String(obra.importeGastosGeneralesObra) : '');
                                          setImporteMayoresCostosObra(obra.presupuestoMayoresCostos != null ? String(obra.presupuestoMayoresCostos) : '');

                                          // Restaurar honorarios si existen
                                          if (obra.honorarioJornalesObra != null) {
                                            setHonorarioJornalesObra(String(obra.honorarioJornalesObra));
                                            setTipoHonorarioJornalesObra(obra.tipoHonorarioJornalesObra || 'porcentaje');
                                          }
                                          if (obra.honorarioMaterialesObra != null) {
                                            setHonorarioMaterialesObra(String(obra.honorarioMaterialesObra));
                                            setTipoHonorarioMaterialesObra(obra.tipoHonorarioMaterialesObra || 'porcentaje');
                                          }
                                          if (obra.honorarioGastosGeneralesObra != null) {
                                            setHonorarioGastosGeneralesObra(String(obra.honorarioGastosGeneralesObra));
                                            setTipoHonorarioGastosGeneralesObra(obra.tipoHonorarioGastosGeneralesObra || 'porcentaje');
                                          }
                                          if (obra.honorarioMayoresCostosObra != null) {
                                            setHonorarioMayoresCostosObra(String(obra.honorarioMayoresCostosObra));
                                            setTipoHonorarioMayoresCostosObra(obra.tipoHonorarioMayoresCostosObra || 'porcentaje');
                                          }

                                          // Restaurar descuentos base si existen
                                          if (obra.descuentoJornalesObra != null) {
                                            setDescuentoJornalesObra(String(obra.descuentoJornalesObra));
                                            setTipoDescuentoJornalesObra(obra.tipoDescuentoJornalesObra || 'porcentaje');
                                          }
                                          if (obra.descuentoMaterialesObra != null) {
                                            setDescuentoMaterialesObra(String(obra.descuentoMaterialesObra));
                                            setTipoDescuentoMaterialesObra(obra.tipoDescuentoMaterialesObra || 'porcentaje');
                                          }
                                          if (obra.descuentoGastosGeneralesObra != null) {
                                            setDescuentoGastosGeneralesObra(String(obra.descuentoGastosGeneralesObra));
                                            setTipoDescuentoGastosGeneralesObra(obra.tipoDescuentoGastosGeneralesObra || 'porcentaje');
                                          }
                                          if (obra.descuentoMayoresCostosObra != null) {
                                            setDescuentoMayoresCostosObra(String(obra.descuentoMayoresCostosObra));
                                            setTipoDescuentoMayoresCostosObra(obra.tipoDescuentoMayoresCostosObra || 'porcentaje');
                                          }

                                          // Restaurar descuentos sobre honorarios si existen
                                          if (obra.descuentoHonorarioJornalesObra != null) {
                                            setDescuentoHonorarioJornalesObra(String(obra.descuentoHonorarioJornalesObra));
                                            setTipoDescuentoHonorarioJornalesObra(obra.tipoDescuentoHonorarioJornalesObra || 'porcentaje');
                                          }
                                          if (obra.descuentoHonorarioMaterialesObra != null) {
                                            setDescuentoHonorarioMaterialesObra(String(obra.descuentoHonorarioMaterialesObra));
                                            setTipoDescuentoHonorarioMaterialesObra(obra.tipoDescuentoHonorarioMaterialesObra || 'porcentaje');
                                          }
                                          if (obra.descuentoHonorarioGastosGeneralesObra != null) {
                                            setDescuentoHonorarioGastosGeneralesObra(String(obra.descuentoHonorarioGastosGeneralesObra));
                                            setTipoDescuentoHonorarioGastosGeneralesObra(obra.tipoDescuentoHonorarioGastosGeneralesObra || 'porcentaje');
                                          }
                                          if (obra.descuentoHonorarioMayoresCostosObra != null) {
                                            setDescuentoHonorarioMayoresCostosObra(String(obra.descuentoHonorarioMayoresCostosObra));
                                            setTipoDescuentoHonorarioMayoresCostosObra(obra.tipoDescuentoHonorarioMayoresCostosObra || 'porcentaje');
                                          }

                                          console.log('?? Desglose obra restaurado desde DTO (tabla):', obra);
                                        } else {
                                          setUsarDesgloseObra(false);
                                          setImporteMaterialesObra('');
                                          setImporteJornalesObra('');
                                          setImporteHonorariosObra('');
                                          setTipoHonorariosObra('porcentaje');
                                          setImporteMayoresCostosObra('');
                                          setTipoMayoresCostosObra('porcentaje');
                                          setImporteTotalObra('');
                                        }

                                        setModoEdicion(true);
                                        setObraEditando(obra);
                                        dispatch(setActiveTab('crear'));
                                      }}
                                      title="Editar obra"
                                    >
                                      <i className="fas fa-edit"></i>
                                    </button>
                                    <button
                                      className="btn btn-outline-danger btn-sm"
                                      onClick={() => handleEliminarObra(obra.id)}
                                      title="Eliminar obra"
                                    >
                                      <i className="fas fa-trash"></i>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Trabajos Extra - Copia exacta de Presupuestos No Cliente */}
      {activeTab === 'trabajos-extra' && (
        <div className="container-fluid fade-in" style={{padding: '0'}} onClick={() => setTrabajoExtraSeleccionado(null)}>
          <div className="d-flex justify-content-between align-items-center mb-3" style={{padding: '0 15px'}}>
            <div className="d-flex align-items-center gap-3">
              <button
                className="btn btn-outline-secondary"
                onClick={() => {
                  dispatch(setActiveTab('lista'));
                  setObraParaTrabajosExtra(null);
                }}
                title="Volver al listado de obras"
              >
                <i className="fas fa-arrow-left me-2"></i>
                Volver
              </button>
              <h3 className="mb-0">
                <i className="fas fa-tools me-2"></i>
                Adicionales Obra - {obraParaTrabajosExtra?.nombre}
              </h3>
              <span className="badge bg-secondary" style={{ fontSize: '14px', padding: '8px 12px' }}>
                <i className="fas fa-list me-2"></i>
                {trabajosExtra.length} adicional{trabajosExtra.length !== 1 ? 'es' : ''}
              </span>
            </div>
          </div>

          <div className="card" onClick={(e) => e.stopPropagation()}>
            <div className="card-body" style={{padding: '0'}}>
              {loadingTrabajosExtra ? (
                <div className="text-center py-4">
                  <div className="spinner-border" role="status"><span className="visually-hidden">Cargando...</span></div>
                </div>
              ) : trabajosExtra.length === 0 ? (
                null
              ) : (
                <>
                  <div className="table-responsive" style={{margin: '0'}}>
                  <table className="table table-striped table-hover" style={{marginBottom: '0'}}>
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: '25px', padding: '8px 4px' }} className="small"></th>
                        <th style={{width: '50px'}} className="small">Nro.</th>
                        <th style={{width: '140px'}} className="small">Nombre</th>
                        <th className="small">Direcci?n</th>
                        <th style={{width: '100px'}} className="small">Contacto</th>
                        <th style={{width: '70px'}} className="small">Estado</th>
                        <th style={{width: '80px'}} className="small">Tipo</th>
                        <th style={{width: '100px'}} className="small">Asignaciones</th>
                        <th style={{width: '90px'}} className="small">Inicio</th>
                        <th style={{width: '90px'}} className="small">Fin</th>
                        <th style={{width: '110px'}} className="text-end small">Total</th>
                        <th style={{width: '180px'}} className="text-center small">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trabajosExtra.map(row => {
                        const esEditable = row.estado === 'BORRADOR' || row.estado === 'A_ENVIAR';
                        const rowId = row.id;
                        const isSelected = trabajoExtraSeleccionado && rowId && trabajoExtraSeleccionado.id === rowId;
                        // Incluir contador de trabajos adicionales en la key para forzar re-render
                        const trabajosAdicionalesCount = contarTrabajosAdicionalesTrabajoExtra(rowId);

                        return (
                          <React.Fragment key={`${rowId}-ta-${trabajosAdicionalesCount}`}>
                            <tr
                              onClick={(e) => {
                                e.stopPropagation();

                                // Mantener la selecci?n para edici?n
                                if (isSelected) {
                                  setTrabajoExtraSeleccionado(null);
                                } else {
                                  setTrabajoExtraSeleccionado(row);
                                }
                              }}
                              style={{
                                cursor: 'pointer',
                                ...((isSelected && { backgroundColor: '#cfe2ff !important' }))
                              }}
                              className={`${
                                isSelected
                                  ? 'table-primary'
                                  : !esEditable
                                      ? 'table-secondary opacity-75'
                                      : ''
                              }`}
                              title="Clic para seleccionar"
                            >
                              <td
                                className="small text-center align-middle"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTrabajoExtraExpandido(rowId === trabajoExtraExpandido ? null : rowId);
                                }}
                                style={{ cursor: 'pointer' }}
                              >
                                <button
                                  className="btn btn-sm btn-primary rounded-circle p-0"
                                  title={rowId === trabajoExtraExpandido ? "Ocultar detalles" : "Ver detalles y configuraci?n"}
                                  style={{
                                    width: '30px',
                                    height: '30px',
                                    transition: 'all 0.3s ease'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    console.log('🔴 CLICK BOTON EXPANDIR - ANTES:', { rowId, trabajoExtraExpandido });
                                    setTrabajoExtraExpandido(rowId === trabajoExtraExpandido ? null : rowId);
                                    console.log('🔴 CLICK BOTON EXPANDIR - DESPUES setear a:', rowId === trabajoExtraExpandido ? 'null' : rowId);
                                  }}
                                >
                                  <i className={`fas fa-${rowId === trabajoExtraExpandido ? 'minus' : 'plus'} text-white`}></i>
                                </button>
                                {isSelected && <i className="fas fa-check-circle text-success ms-1" title="Seleccionado para editar"></i>}
                              </td>
                              <td className="small align-middle">{row.numeroPresupuesto || row.id || '-'}</td>
                              <td className="small fw-bold text-dark">
                                {row.nombreObra || row.nombre || <span className="text-muted fst-italic fw-normal">Sin especificar</span>}
                                {row.esTrabajoExtra && (
                                  <span className="badge bg-warning text-dark ms-2" style={{fontSize: '0.65rem', padding: '2px 6px'}}>
                                    ?? EXTRA
                                  </span>
                                )}
                              </td>
                              <td className="small text-muted">{formatearDireccionObra(obraParaTrabajosExtra)}</td>
                              <td className="small">
                                {(obraParaTrabajosExtra.nombreSolicitante || obraParaTrabajosExtra.telefono || obraParaTrabajosExtra.mail) ? (
                                  <div className="d-flex flex-column" style={{ minWidth: '150px' }}>
                                    {obraParaTrabajosExtra.nombreSolicitante && (
                                      <small className="text-muted mb-1">
                                        <i className="fas fa-user me-1"></i>
                                        {obraParaTrabajosExtra.nombreSolicitante}
                                      </small>
                                    )}
                                    {obraParaTrabajosExtra.telefono && (
                                      <small>
                                        <a href={`https://wa.me/${obraParaTrabajosExtra.telefono.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-success text-decoration-none" title="Abrir WhatsApp">
                                          <i className="fab fa-whatsapp me-1"></i>
                                          {obraParaTrabajosExtra.telefono}
                                        </a>
                                      </small>
                                    )}
                                  </div>
                                ) : <small className="text-muted">-</small>}
                              </td>
                              <td>
                                <span className={`badge ${
                                  row.estado === 'BORRADOR' ? 'bg-secondary' :
                                  row.estado === 'A_ENVIAR' ? 'bg-info' :
                                  row.estado === 'ENVIADO' ? 'bg-primary' :
                                  row.estado === 'APROBADO' ? 'bg-success' :
                                  row.estado === 'MODIFICADO' ? 'bg-warning' :
                                  'bg-light text-dark'
                                }`} style={{ fontSize: '0.7em', padding: '3px 5px' }}>
                                  {row.estado === 'BORRADOR' ? (
                                    <>
                                      <i className="fas fa-pencil-alt me-1" title="En edici?n"></i>
                                      {row.estado}
                                      <i className="fas fa-arrow-right ms-1" title="Puedes marcarlo como listo"></i>
                                    </>
                                  ) : esEditable ? (
                                    <>
                                      <i className="fas fa-edit me-1" title="Editable"></i>
                                      {row.estado}
                                    </>
                                  ) : (
                                    <>
                                      <i className="fas fa-lock me-1" title="Solo lectura"></i>
                                      {row.estado || 'BORRADOR'}
                                    </>
                                  )}
                                </span>
                              </td>
                              <td className="small">
                                {(() => {
                                  // Detectar si es Global o Detallado bas?ndose en nombres de elementos
                                  // GLOBAL: Nombres gen?ricos como "Presupuesto Global", "Para la obra", "Materiales para..."
                                  // DETALLADO: Nombres espec?ficos como "Hercal", "Escalera", "Oficial Alba?il"

                                  let tieneElementosGlobales = false;
                                  let tieneElementosEspecificos = false;

                                  if (row.itemsCalculadora && row.itemsCalculadora.length > 0) {
                                    row.itemsCalculadora.forEach(item => {
                                      // Revisar jornales
                                      if (item.jornales && item.jornales.length > 0) {
                                        item.jornales.forEach(j => {
                                          const rol = (j.rol || '').toUpperCase();
                                          if (rol.includes('PRESUPUESTO GLOBAL') || rol.includes('PARA LA OBRA')) {
                                            tieneElementosGlobales = true;
                                          } else {
                                            tieneElementosEspecificos = true;
                                          }
                                        });
                                      }

                                      // Revisar materiales
                                      if (item.materialesLista && item.materialesLista.length > 0) {
                                        item.materialesLista.forEach(m => {
                                          const nombre = (m.nombre || m.descripcion || '').toLowerCase();
                                          if (nombre.includes('para la') || nombre.includes('para el') ||
                                              nombre.includes('presupuesto global') || nombre.includes('materiales para')) {
                                            tieneElementosGlobales = true;
                                          } else {
                                            tieneElementosEspecificos = true;
                                          }
                                        });
                                      }

                                      // Revisar gastos generales
                                      if (item.gastosGenerales && item.gastosGenerales.length > 0) {
                                        item.gastosGenerales.forEach(g => {
                                          const desc = (g.descripcion || '').toLowerCase();
                                          if (desc.includes('para la') || desc.includes('para el') ||
                                              desc.includes('presupuesto global') || (desc.includes('gastos') && desc.includes('para'))) {
                                            tieneElementosGlobales = true;
                                          } else {
                                            tieneElementosEspecificos = true;
                                          }
                                        });
                                      }

                                      // Revisar otros costos
                                      if (item.otrosCostosLista && item.otrosCostosLista.length > 0) {
                                        item.otrosCostosLista.forEach(o => {
                                          const desc = (o.descripcion || '').toLowerCase();
                                          if (desc.includes('para la') || desc.includes('para el') ||
                                              desc.includes('presupuesto global')) {
                                            tieneElementosGlobales = true;
                                          } else {
                                            tieneElementosEspecificos = true;
                                          }
                                        });
                                      }
                                    });
                                  }

                                  // Si tiene elementos globales y NO tiene elementos espec?ficos ? GLOBAL
                                  // Si tiene elementos espec?ficos ? DETALLADO
                                  const esGlobal = tieneElementosGlobales && !tieneElementosEspecificos;

                                  return esGlobal ? (
                                    <span className="badge bg-secondary text-white" style={{ fontSize: '0.7em' }}>
                                      <i className="fas fa-globe me-1"></i>
                                      Global
                                    </span>
                                  ) : (tieneElementosEspecificos || tieneElementosGlobales) ? (
                                    <span className="badge bg-info text-white" style={{ fontSize: '0.7em' }}>
                                      <i className="fas fa-list me-1"></i>
                                      Detallado
                                    </span>
                                  ) : (
                                    <span className="badge bg-light text-dark" style={{ fontSize: '0.7em' }}>
                                      <i className="fas fa-question me-1"></i>
                                      Sin items
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className="small">
                                <span className="badge bg-warning text-dark border border-warning">
                                  <i className="fas fa-exclamation-triangle me-1"></i>
                                  Pendiente
                                </span>
                              </td>
                              <td className="small text-center">{row.fechaProbableInicio || <span className="text-muted">?</span>}</td>
                              <td className="small text-center">
                                {(() => {
                                  const fechaInicioStr = row.fechaProbableInicio;
                                  const tiempoEstimado = row.tiempoEstimadoTerminacion || row.plazoEjecucionDias;

                                  if (!fechaInicioStr || !tiempoEstimado) {
                                    return <span className="text-muted">?</span>;
                                  }

                                  try {
                                    // Parsear fecha, asegurando formato YYYY-MM-DD
                                    const fechaClean = fechaInicioStr.includes('T') ? fechaInicioStr.split('T')[0] : fechaInicioStr;
                                    const [year, month, day] = fechaClean.split('-').map(Number);

                                    // Validar que la fecha sea v?lida
                                    if (!year || !month || !day) return <span className="text-muted">?</span>;

                                    let fecha = new Date(year, month - 1, day);
                                    let diasContados = 0;

                                    // Contar d?as h?biles
                                    while (diasContados < tiempoEstimado) {
                                      const diaSemana = fecha.getDay();
                                      // Lunes(1) a Viernes(5) y no feriado
                                      if (diaSemana >= 1 && diaSemana <= 5 && !esFeriado(fecha)) {
                                        diasContados++;
                                      }
                                      // Si no terminamos, avanzar al siguiente d?a natural
                                      if (diasContados < tiempoEstimado) {
                                        fecha.setDate(fecha.getDate() + 1);
                                      }
                                    }

                                    return fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                  } catch (err) {
                                    return <span className="text-muted">?</span>;
                                  }
                                })()}
                              </td>
                              <td className="text-end">
                                <div>
                                  <div className="fw-bold text-primary">
                                    {(() => {
                                      // Calcular total igual que en presupuestos
                                      if (!row.itemsCalculadora || row.itemsCalculadora.length === 0) {
                                        // Fallback para trabajos extra sin itemsCalculadora
                                        const totalProfesionales = (row.profesionales || []).reduce((sum, prof) => {
                                          const importe = parseFloat(prof.importe) || 0;
                                          const dias = row.dias?.length || 0;
                                          return sum + (importe * dias);
                                        }, 0);

                                        const totalTareas = (row.tareas || []).reduce((sum, t) => {
                                          return sum + (parseFloat(t.importe) || 0);
                                        }, 0);

                                        // ✅ PRIORIDAD CORRECTA: totalConDescuentos (con descuentos) → totalFinal (sin descuentos) → otros
                                        const totalGeneral = row.totalConDescuentos || row.totalFinal || row.montoTotal || (totalProfesionales + totalTareas) || 0;

                                        if (totalGeneral && totalGeneral > 0) {
                                          return `$${Number(totalGeneral).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
                                        }
                                        return <span className="text-muted">Sin datos</span>;
                                      }

                                      const totalFinal = (() => {
                                        if (!row.itemsCalculadora || row.itemsCalculadora.length === 0) return 0;

                                        // 1. Calcular Bases Agregadas (Iterando hijos para asegurar datos, con fallback a subtotales)
                                        let totalProf = 0;
                                        let totalMat = 0;
                                        let totalOtros = 0; // Gastos Generales
                                        let totalCalculadora = 0; // Items sin desglose
                                        let totalJornales = 0;

                                        row.itemsCalculadora.forEach(item => {
                                          const tieneJornales = item.jornales && item.jornales.length > 0;

                                          // 1. Profesionales
                                          if (item.profesionales && item.profesionales.length > 0) {
                                            item.profesionales.forEach(p => totalProf += Number(p.subtotal) || 0);
                                          } else if (!tieneJornales) {
                                            // ?? FIX: Si hay jornales, NO usar item.subtotalManoObra como fallback
                                            // porque el backend lo calcula incluyendo jornales ? doble conteo
                                            totalProf += Number(item.subtotalManoObra) || 0;
                                          }

                                          // 2. Materiales
                                          if (item.materialesLista && item.materialesLista.length > 0) {
                                            item.materialesLista.forEach(m => totalMat += Number(m.subtotal) || 0);
                                          } else {
                                            totalMat += Number(item.subtotalMateriales) || 0;
                                          }

                                          // 3. Jornales - siempre recalcular desde cant ? val (nunca usar j.subtotal contaminado)
                                          if (tieneJornales) {
                                            item.jornales.forEach(j => {
                                              const cant = Number(j.cantidadJornales || j.cantidad || 0);
                                              const val = Number(j.importeJornal || j.valorUnitario || 0);
                                              totalJornales += (cant * val);
                                            });
                                          } else {
                                            // Solo si NO hay array de jornales, intentar deducir desde item.total
                                            // (item.subtotalJornales del backend puede estar contaminado)
                                            const totalBase = Number(item.total) || 0;
                                            const subtotalProf = (item.profesionales && item.profesionales.length > 0)
                                              ? item.profesionales.reduce((s, p) => s + (Number(p.subtotal) || 0), 0)
                                              : (Number(item.subtotalManoObra) || 0);
                                            const subtotalMat = (item.materialesLista && item.materialesLista.length > 0)
                                              ? item.materialesLista.reduce((s, m) => s + (Number(m.subtotal) || 0), 0)
                                              : (Number(item.subtotalMateriales) || 0);
                                            const subtotalGastos = Number(item.subtotalGastosGenerales) || 0;
                                            const deducido = totalBase - subtotalProf - subtotalMat - subtotalGastos;
                                            totalJornales += Math.max(0, deducido);
                                          }

                                          // 4. Gastos Generales y otros
                                          const esGastoGeneral = item.esGastoGeneral === true ||
                                            (item.tipoProfesional?.toLowerCase().includes('gasto') &&
                                              item.tipoProfesional?.toLowerCase().includes('general'));

                                          if (item.gastosGenerales && item.gastosGenerales.length > 0) {
                                            item.gastosGenerales.forEach(g => totalOtros += Number(g.subtotal) || 0);
                                          } else if (esGastoGeneral) {
                                            totalOtros += Number(item.total) || 0;
                                          } else {
                                            if (item.subtotalGastosGenerales > 0) {
                                              totalOtros += Number(item.subtotalGastosGenerales) || 0;
                                            }
                                          }

                                          // 5. Calculadora / Manual (Fallbacks)
                                          const tieneChildren = (item.profesionales?.length > 0) || (item.materialesLista?.length > 0) || (item.jornales?.length > 0) || (item.gastosGenerales?.length > 0);
                                          const tieneSubtotals = (item.subtotalManoObra > 0) || (item.subtotalMateriales > 0) || (item.subtotalJornales > 0) || (item.subtotalGastosGenerales > 0);

                                          if (!tieneChildren && !tieneSubtotals && !esGastoGeneral) {
                                            const totalItem = Number(item.totalManual) || Number(item.total) || 0;
                                            if (totalItem > 0) {
                                              totalCalculadora += totalItem;
                                            }
                                          }
                                        });

                                        // Helpers
                                        const getConfigHonorarios = (categoria) => {
                                          if (row.honorarios && row.honorarios[categoria]) return row.honorarios[categoria];
                                          const capitulizada = categoria.charAt(0).toUpperCase() + categoria.slice(1);
                                          const activo = row[`honorarios${capitulizada}Activo`];
                                          const valor = row[`honorarios${capitulizada}Valor`];
                                          const tipo = row[`honorarios${capitulizada}Tipo`] || 'porcentaje';
                                          if (activo !== undefined || valor !== undefined) return { activo: !!activo, valor, tipo };
                                          return null;
                                        };

                                        const getConfigMayoresCostos = (categoria) => {
                                          if (row.mayoresCostos && row.mayoresCostos[categoria]) return row.mayoresCostos[categoria];
                                          const capitulizada = categoria.charAt(0).toUpperCase() + categoria.slice(1);
                                          const activo = row[`mayoresCostos${capitulizada}Activo`];
                                          const valor = row[`mayoresCostos${capitulizada}Valor`];
                                          const tipo = row[`mayoresCostos${capitulizada}Tipo`] || 'porcentaje';
                                          if (activo !== undefined || valor !== undefined) return { activo: !!activo, valor, tipo };
                                          return null;
                                        };

                                        const calcularExtra = (base, config) => {
                                          if (!config?.activo || !config?.valor) return 0;
                                          const val = Number(config.valor);
                                          return config.tipo === 'porcentaje' ? (base * val) / 100 : val;
                                        };

                                        // 2. Calcular Honorarios
                                        const honProf = calcularExtra(totalProf, getConfigHonorarios('profesionales'));
                                        const honMat = calcularExtra(totalMat, getConfigHonorarios('materiales'));
                                        const honOtros = calcularExtra(totalOtros, getConfigHonorarios('otrosCostos'));
                                        const honJornales = calcularExtra(totalJornales, getConfigHonorarios('jornales'));
                                        const honCalc = calcularExtra(totalCalculadora, getConfigHonorarios('configuracionPresupuesto'));

                                        const totalHonorarios = honProf + honMat + honOtros + honJornales + honCalc;

                                        // 3. Calcular Mayores Costos (Sobre Bases - la misma l?gica que Modal)
                                        const mcProf = calcularExtra(totalProf, getConfigMayoresCostos('profesionales'));
                                        const mcMat = calcularExtra(totalMat, getConfigMayoresCostos('materiales'));
                                        const mcOtros = calcularExtra(totalOtros, getConfigMayoresCostos('otrosCostos'));
                                        // Mayores Costos NO suele aplicar a Jornales directamente en el modal, pero si existe config lo calculamos
                                        const mcJornales = calcularExtra(totalJornales, getConfigMayoresCostos('jornales'));
                                        const mcCalc = calcularExtra(totalCalculadora, getConfigMayoresCostos('configuracionPresupuesto'));

                                        // 4. Calcular Mayores Costos sobre Honorarios
                                        const mcHonorarios = calcularExtra(totalHonorarios, getConfigMayoresCostos('honorarios'));

                                        // 5. Total Final
                                        return totalProf + totalMat + totalOtros + totalJornales + totalCalculadora +
                                          totalHonorarios +
                                          mcProf + mcMat + mcOtros + mcJornales + mcCalc +
                                          mcHonorarios;
                                      })();

                                      if (totalFinal && totalFinal > 0) {
                                        return `$${Number(totalFinal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
                                      }

                                      return <span className="text-muted">Sin datos</span>;
                                    })()}
                                  </div>
                                </div>
                              </td>
                              <td className="text-center" onClick={(e) => e.stopPropagation()}>
                                {/* ?? BOTONES DE GESTI?N DE CICLO DE VIDA */}
                                <div className="btn-group btn-group-sm" role="group">
                                  {/* BORRADOR ? Bot?n para marcar como "Listo para Enviar" */}
                                  {(!row.estado || row.estado === 'BORRADOR') && (
                                    <button
                                      className="btn btn-success btn-sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCambiarEstadoTrabajoExtra(row, 'A_ENVIAR');
                                      }}
                                      title="Marcar como listo para enviar"
                                      style={{ fontSize: '0.75em', padding: '4px 8px' }}
                                    >
                                      <i className="fas fa-check me-1"></i>
                                      Terminar Edici?n
                                    </button>
                                  )}

                                  {/* A_ENVIAR ? Botones para volver a borrador o enviar */}
                                  {row.estado === 'A_ENVIAR' && (
                                    <>
                                      <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCambiarEstadoTrabajoExtra(row, 'BORRADOR');
                                        }}
                                        title="Volver a modo edici?n"
                                        style={{ fontSize: '0.75em', padding: '4px 8px' }}
                                      >
                                        <i className="fas fa-undo me-1"></i>
                                        Volver
                                      </button>
                                      <button
                                        className="btn btn-primary btn-sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEnviarTrabajoExtraDesdeTabla(row);
                                        }}
                                        title="Enviar a cliente por WhatsApp o Email"
                                        style={{ fontSize: '0.75em', padding: '4px 8px' }}
                                      >
                                        <i className="fas fa-paper-plane me-1"></i>
                                        Enviar Cliente
                                      </button>
                                    </>
                                  )}

                                  {/* ENVIADO ? Botones para cancelar env?o o aprobar */}
                                  {row.estado === 'ENVIADO' && (
                                    <>
                                      <button
                                        className="btn btn-warning btn-sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCambiarEstadoTrabajoExtra(row, 'A_ENVIAR');
                                        }}
                                        title="Cancelar env?o y volver a estado anterior"
                                        style={{ fontSize: '0.75em', padding: '4px 8px' }}
                                      >
                                        <i className="fas fa-undo me-1"></i>
                                        Cancelar
                                      </button>
                                      <button
                                        className="btn btn-success btn-sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleGenerarObraDesdeTrabajoExtra(row);
                                        }}
                                        title="Aprobar trabajo extra y crear obra derivada"
                                        style={{ fontSize: '0.75em', padding: '4px 8px' }}
                                      >
                                        <i className="fas fa-check-circle me-1"></i>
                                        Aprobar
                                      </button>
                                    </>
                                  )}

                                  {/* APROBADO ? Ver obra derivada */}
                                  {row.estado === 'APROBADO' && (
                                    <button
                                      className="btn btn-info btn-sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Aqu? podr?as navegar a la obra derivada o mostrar detalles
                                        showNotification(
                                          `Trabajo extra aprobado. Obra derivada creada.`,
                                          'info'
                                        );
                                      }}
                                      title="Trabajo extra aprobado - Obra creada"
                                      style={{ fontSize: '0.75em', padding: '4px 8px' }}
                                    >
                                      <i className="fas fa-check-circle me-1"></i>
                                      Aprobado
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* FILA EXPANDIDA CON DETALLES DE PLANIFICACI�N */}
                            {trabajoExtraExpandido === rowId && (
                              <>
                                <tr className="bg-light" key={`trabajo-extra-expandido-${rowId}-${row.profesionales?.length || 0}-${row.materiales?.length || 0}-${row.gastosGenerales?.length || 0}`}>
                                  <td colSpan="12" className="p-0">
                                    <div className="bg-light p-3 border-top">
                                      <div className="mb-4 p-3 border rounded bg-white">
                                        <div className="row align-items-center">
                                          <div className="col-md-8">
                                            <h6 className="text-primary mb-1">
                                              <i className="fas fa-cog me-2"></i>
                                              Configuraci?n y Planificaci?n de Obra
                                            </h6>
                                          {row?.fechaProbableInicio && row?.tiempoEstimadoTerminacion ? (
                                            <small className="text-success">
                                              ? Configurado: {Math.ceil((row.tiempoEstimadoTerminacion || 0) / 5)} semanas ({row.tiempoEstimadoTerminacion || 0} d?as) - {(row.profesionales?.length || 0)} profesional{row.profesionales?.length !== 1 ? 'es' : ''} asignado{row.profesionales?.length !== 1 ? 's' : ''}
                                            </small>
                                          ) : (
                                            <small className="text-danger">
                                              ?? No hay fecha probable de inicio configurada
                                            </small>
                                          )}
                                        </div>
                                        <div className="col-md-4">
                                          <div className="d-flex gap-2">
                                            <button
                                              className="btn btn-primary btn-sm flex-grow-1"
                                              title="Reconfigurar planificaci?n del trabajo extra"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                // ?? PRIMERO: buscar el trabajo extra actualizado en el estado local
                                                const trabajoExtraActualizado = trabajosExtra.find(t => t.id === row.id) || row;

                                                console.log('? [Reconfigurar TE] Usando trabajo extra actualizado:', {
                                                  rowId: row.id,
                                                  tiempoEnRow: row.tiempoEstimadoTerminacion,
                                                  tiempoEnEstado: trabajoExtraActualizado.tiempoEstimadoTerminacion,
                                                  fechaEnRow: row.fechaProbableInicio,
                                                  fechaEnEstado: trabajoExtraActualizado.fechaProbableInicio
                                                });

                                                // Crear objeto con presupuesto completo para configuraci?n de planificaci?n
                                                const trabajoParaConfigurar = {
                                                  id: `te_${trabajoExtraActualizado.id}`,
                                                  nombre: trabajoExtraActualizado.nombreObra || trabajoExtraActualizado.nombre,
                                                  direccion: obraParaTrabajosExtra?.direccion || '',
                                                  // ? Usar el trabajo extra ACTUALIZADO del estado local (NO el row del backend)
                                                  presupuestoNoCliente: trabajoExtraActualizado,
                                                  fechaProbableInicio: trabajoExtraActualizado.fechaProbableInicio || '',
                                                  tiempoEstimadoTerminacion: trabajoExtraActualizado.tiempoEstimadoTerminacion || 0,
                                                  _esTrabajoExtra: true,
                                                  _esTrabajoAdicional: true,
                                                  _trabajoExtraId: trabajoExtraActualizado.id,  // Legacy
                                                  _trabajoAdicionalId: trabajoExtraActualizado.id,
                                                  // Usar _obraOriginalId si existe (trabajo extra dentro de trabajo extra),
                                                  // sino usar id directamente
                                                  _obraOriginalId: obraParaTrabajosExtra._obraOriginalId || obraParaTrabajosExtra.id
                                                };
                                                setObraParaConfigurar(trabajoParaConfigurar);
                                                setMostrarModalConfiguracionObra(true);
                                              }}
                                            >
                                              <i className="fas fa-calendar-plus me-1"></i>
                                              Reconfigurar
                                            </button>
                                            <button
                                              className="btn btn-sm text-white flex-grow-1"
                                              title="Editar solo Fecha Probable de Inicio y D?as H?biles"
                                              style={{ backgroundColor: '#FF6F00', border: 'none', fontWeight: 'bold' }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setTrabajoExtraEditar({ ...row, _editarSoloFechas: true });
                                                setMostrarModalTrabajoExtra(true);
                                              }}
                                            >
                                              <i className="fas fa-calendar-edit me-1"></i>
                                              Modificar Fechas
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="row g-3">
                                      {/* Presupuesto */}
                                      <div className="col-md-6">
                                        <h6 className="text-muted mb-2">
                                          <i className="fas fa-file-invoice-dollar me-2"></i>
                                          Presupuesto Detallado
                                        </h6>
                                        <button
                                          className="btn btn-sm btn-outline-primary w-100 d-flex justify-content-between align-items-center"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setTrabajoExtraEditar(row);
                                            setMostrarModalTrabajoExtra(true);
                                          }}
                                        >
                                          <span>
                                            <i className="fas fa-eye me-2"></i>
                                            Ver Detalle
                                          </span>
                                          <span className="badge bg-primary">1</span>
                                        </button>
                                      </div>

                                      {/* Trabajos Extra */}
                                      <div className="col-md-6">
                                        <h6 className="text-muted mb-2">
                                          <i className="fas fa-tools me-2"></i>
                                          Adicionales Obra
                                        </h6>
                                        <button
                                          className="btn btn-sm btn-outline-secondary w-100 d-flex justify-content-between align-items-center"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            // Crear objeto de trabajo extra como si fuera una obra para gestionar sus sub-trabajos
                                            // ?? CR�TICO: Obtener el ID num?rico de la obra original (nunca usar IDs tipo "te_X")
                                            const obraOriginalIdNumerico = obraParaTrabajosExtra._obraOriginalId ||
                                              (typeof obraParaTrabajosExtra.id === 'number' ? obraParaTrabajosExtra.id : null);

                                            if (!obraOriginalIdNumerico) {
                                              console.error('? No se pudo determinar el ID de la obra original');
                                              showNotification('Error: No se pudo determinar la obra original', 'error');
                                              return;
                                            }

                                            // ?? CR�TICO: Usar el ID correcto del trabajo extra (puede venir como id_trabajo_extra o id)
                                            const trabajoExtraIdReal = row.id_trabajo_extra || row.presupuestoNoClienteId || row.id;

                                            const trabajoComoObra = {
                                              ...obraParaTrabajosExtra,
                                              id: `te_${trabajoExtraIdReal}`,
                                              nombre: row.nombreObra || row.nombre,
                                              _esTrabajoExtra: true,
                                              _esTrabajoAdicional: true,
                                              _trabajoExtraId: trabajoExtraIdReal,
                                              _trabajoAdicionalId: trabajoExtraIdReal,
                                              _obraOriginalId: obraOriginalIdNumerico
                                            };
                                            console.log('?? Gestionar trabajos extra del trabajo extra:', {
                                              trabajoExtraId: trabajoExtraIdReal,
                                              obraOriginalId: obraOriginalIdNumerico,
                                              row,
                                              trabajoComoObra
                                            });
                                            setSelectedObraId(trabajoComoObra.id);
                                            setObraParaTrabajosExtra(trabajoComoObra);
                                            cargarTrabajosExtra(trabajoComoObra);
                                            dispatch(setActiveTab('trabajos-extra'));
                                          }}
                                        >
                                          <span>
                                            <i className="fas fa-wrench me-2"></i>
                                            Gestionar Adicionales Obra
                                          </span>
                                          <span className="badge bg-secondary">{contarTrabajosExtraObra(`te_${row.id}`)}</span>
                                        </button>
                                      </div>

                                      {/* Profesionales */}
                                      <div className="col-md-6">
                                        <h6 className="text-muted mb-2">
                                          <i className="fas fa-users-cog me-2"></i>
                                          Profesionales
                                        </h6>
                                        <button
                                          className={`btn btn-sm w-100 d-flex justify-content-between align-items-center btn-outline-success`}
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            console.log('🚨🚨🚨 CLICK en Asignar Profesionales - TAREA LEVE');
                                            console.log('🚨 Presupuesto ID:', row.id);

                                            try {
                                              // ? CARGAR EL PRESUPUESTO COMPLETO DEL TRABAJO EXTRA
                                              console.log('?? Cargando presupuesto completo del trabajo extra ID:', row.id);
                                              const presupuestoCompleto = await api.presupuestosNoCliente.getById(row.id, empresaId);
                                              console.log('? Presupuesto completo cargado:', presupuestoCompleto);
                                              console.log('🚨 DEBUG - Campos de obra en presupuesto:', {
                                                obraId: presupuestoCompleto.obraId,
                                                obra_id: presupuestoCompleto.obra_id,
                                                idObra: presupuestoCompleto.idObra,
                                                id_obra: presupuestoCompleto.id_obra
                                              });

                                              // ?? CRÍTICO: Extraer el ID de la obra vinculada al presupuesto
                                              // Intentar con el nombre de la BD primero (id_obra), luego camelCase
                                              const obraIdVinculada = presupuestoCompleto.id_obra || presupuestoCompleto.obraId || presupuestoCompleto.obra_id || presupuestoCompleto.idObra;

                                              if (!obraIdVinculada) {
                                                console.error('? No se encontró obraId en el presupuesto:', presupuestoCompleto);
                                                showNotification('Error: El presupuesto no tiene una obra asociada', 'error');
                                                return;
                                              }

                                              console.log('🚨🚨🚨 OBRA VINCULADA EXTRAÍDA:', obraIdVinculada);
                                              console.log('🚨🚨🚨 CONFIGURANDO trabajoComoObra.id =', obraIdVinculada);

                                              // ? BUSCAR trabajo extra actualizado del estado (con asignaciones reales)
                                              const trabajoActualizado = trabajosExtra.find(t => t.id === row.id) || row;
                                              console.log('?? Usando asignaciones actualizadas:', trabajoActualizado.profesionales?.length || 0);
                                              const asignaciones = trabajoActualizado.profesionales || [];

                                              // Usar el presupuesto completo como si fuera una obra
                                              // ?? IMPORTANTE: id debe ser el ID de la OBRA vinculada para que las asignaciones funcionen
                                              const trabajoComoObra = {
                                                id: obraIdVinculada, // ? ID de la obra vinculada - USADO POR EL MODAL
                                                obraId: obraIdVinculada, // ? ID de la obra vinculada
                                                presupuestoId: row.id, // ? ID del presupuesto para referencia
                                                nombre: row.nombreObra || row.nombre,
                                                presupuestoNoCliente: presupuestoCompleto, // ? Presupuesto completo cargado
                                                fechaProbableInicio: presupuestoCompleto.fechaProbableInicio || row.fechaProbableInicio,
                                                tiempoEstimadoTerminacion: presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion,
                                                diasHabiles: presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion,
                                                semanas: Math.ceil((presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion || 0) / 5),
                                                // Configuraci?n ya establecida (para ir directo a Paso 2)
                                                configuracionPlanificacion: {
                                                  semanas: Math.ceil((presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion || 0) / 5),
                                                  diasHabiles: presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion,
                                                  fechaInicio: presupuestoCompleto.fechaProbableInicio || row.fechaProbableInicio,
                                                  jornalesTotales: presupuestoCompleto.jornalesTotales || row.jornalesTotales || 0,
                                                  semanasObjetivo: Math.ceil((presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion || 0) / 5)
                                                },
                                                // ? Asignaciones reales cargadas del backend
                                                asignacionesActuales: asignaciones,
                                                profesionales: asignaciones,
                                                _esTrabajoExtra: true,
                                                _esTrabajoAdicional: true,
                                                _trabajoExtraId: row.id,  // Legacy
                                                _trabajoAdicionalId: row.id,
                                                // ✅ FIX: Usar obraIdVinculada extraída del presupuesto, NO obraParaTrabajosExtra
                                                _obraOriginalId: obraIdVinculada
                                              };

                                              console.log('?? DEBUG - Trabajo Extra para profesionales:', {
                                                id: trabajoComoObra.id,
                                                presupuesto: !!trabajoComoObra.presupuestoNoCliente,
                                                items: trabajoComoObra.presupuestoNoCliente?.itemsCalculadora?.length || 0,
                                                asignaciones: trabajoComoObra.asignacionesActuales.length,
                                                configurado: !!trabajoComoObra.configuracionPlanificacion
                                              });

                                              setObraParaAsignarProfesionales(trabajoComoObra);
                                              setMostrarModalAsignarProfesionalesSemanal(true);
                                            } catch (error) {
                                              console.error('? Error cargando presupuesto del trabajo extra:', error);
                                              showNotification('Error al cargar el presupuesto del trabajo extra', 'error');
                                            }
                                          }}
                                        >
                                          <span>
                                            <i className="fas fa-user-plus me-1"></i>
                                            Asignar Profesionales
                                          </span>
                                          <span className="badge bg-success d-flex align-items-center gap-1">
                                            {row.profesionales?.length || 0}
                                          </span>
                                        </button>
                                      </div>

                                      {/* Materiales */}
                                      <div className="col-md-6">
                                        <h6 className="text-muted mb-2">
                                          <i className="fas fa-box me-2"></i>
                                          Materiales
                                        </h6>
                                        <button
                                          className={`btn btn-sm w-100 d-flex justify-content-between align-items-center btn-outline-warning`}
                                          onClick={async (e) => {
                                            e.stopPropagation();

                                            try {
                                              // ? CARGAR EL PRESUPUESTO COMPLETO DEL TRABAJO EXTRA
                                              console.log('?? Cargando presupuesto completo del trabajo extra ID:', row.id);
                                              const presupuestoCompleto = await api.presupuestosNoCliente.getById(row.id, empresaId);
                                              console.log('? Presupuesto completo cargado:', presupuestoCompleto);

                                              console.log('🚨 DEBUG - Campos de obra en presupuesto (MATERIALES):', {
                                                obraId: presupuestoCompleto.obraId,
                                                obra_id: presupuestoCompleto.obra_id,
                                                idObra: presupuestoCompleto.idObra,
                                                id_obra: presupuestoCompleto.id_obra
                                              });

                                              // ?? CRÍTICO: Extraer el ID de la obra vinculada al presupuesto
                                              const obraIdVinculada = presupuestoCompleto.id_obra || presupuestoCompleto.obraId || presupuestoCompleto.obra_id || presupuestoCompleto.idObra;

                                              if (!obraIdVinculada) {
                                                console.error('? No se encontró obraId en el presupuesto:', presupuestoCompleto);
                                                showNotification('Error: El presupuesto no tiene una obra asociada', 'error');
                                                return;
                                              }

                                              console.log('?? Obra vinculada ID extraído:', obraIdVinculada, '(Presupuesto ID:', row.id, ')');

                                              // Usar el presupuesto completo como si fuera una obra
                                              // ?? IMPORTANTE: id debe ser el ID de la OBRA vinculada para que las asignaciones funcionen
                                              const trabajoParaMateriales = {
                                                id: obraIdVinculada, // ? ID de la obra vinculada - USADO POR EL MODAL
                                                obraId: obraIdVinculada, // ? ID de la obra vinculada
                                                presupuestoId: row.id, // ? ID del presupuesto para referencia
                                                nombre: row.nombreObra || row.nombre,
                                                presupuestoNoCliente: presupuestoCompleto, // ? Presupuesto completo cargado
                                                fechaProbableInicio: presupuestoCompleto.fechaProbableInicio || row.fechaProbableInicio,
                                                tiempoEstimadoTerminacion: presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion,
                                                diasHabiles: presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion,
                                                semanas: Math.ceil((presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion || 0) / 5),
                                                // Configuraci?n establecida
                                                configuracionPlanificacion: {
                                                  semanas: Math.ceil((presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion || 0) / 5),
                                                  diasHabiles: presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion,
                                                  fechaInicio: presupuestoCompleto.fechaProbableInicio || row.fechaProbableInicio,
                                                  jornalesTotales: presupuestoCompleto.jornalesTotales || row.jornalesTotales || 0,
                                                  semanasObjetivo: Math.ceil((presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion || 0) / 5)
                                                },
                                                // Materiales del presupuesto completo
                                                materiales: presupuestoCompleto.materiales || [],
                                                _esTrabajoExtra: true,
                                                _esTrabajoAdicional: true,
                                                _trabajoExtraId: row.id,  // Legacy
                                                _trabajoAdicionalId: row.id,
                                                // ✅ FIX: Usar obraIdVinculada extraída del presupuesto, NO obraParaTrabajosExtra
                                                _obraOriginalId: obraIdVinculada
                                              };
                                              setObraParaAsignarMateriales(trabajoParaMateriales);
                                              setMostrarModalAsignarMateriales(true);
                                            } catch (error) {
                                              console.error('? Error cargando presupuesto del trabajo extra:', error);
                                              showNotification('Error al cargar el presupuesto del trabajo extra', 'error');
                                            }
                                          }}
                                        >
                                          <span>
                                            <i className="fas fa-boxes me-2"></i>
                                            Asignar Materiales
                                          </span>
                                          <span className="badge bg-warning text-dark">
                                            {row.materiales?.length || 0}
                                          </span>
                                        </button>
                                      </div>

                                      {/* Gastos Generales */}
                                      <div className="col-md-6">
                                        <h6 className="text-muted mb-2">
                                          <i className="fas fa-receipt me-2"></i>
                                          Gastos Generales
                                        </h6>
                                        <button
                                          className={`btn btn-sm w-100 d-flex justify-content-between align-items-center btn-outline-danger`}
                                          onClick={async (e) => {
                                            e.stopPropagation();

                                            try {
                                              // ? CARGAR EL PRESUPUESTO COMPLETO DEL TRABAJO EXTRA
                                              console.log('?? Cargando presupuesto completo del trabajo extra ID:', row.id);
                                              const presupuestoCompleto = await api.presupuestosNoCliente.getById(row.id, empresaId);
                                              console.log('? Presupuesto completo cargado:', presupuestoCompleto);

                                              console.log('🚨 DEBUG - Campos de obra en presupuesto (GASTOS):', {
                                                obraId: presupuestoCompleto.obraId,
                                                obra_id: presupuestoCompleto.obra_id,
                                                idObra: presupuestoCompleto.idObra,
                                                id_obra: presupuestoCompleto.id_obra
                                              });

                                              // ?? CRÍTICO: Extraer el ID de la obra vinculada al presupuesto
                                              const obraIdVinculada = presupuestoCompleto.id_obra || presupuestoCompleto.obraId || presupuestoCompleto.obra_id || presupuestoCompleto.idObra;

                                              if (!obraIdVinculada) {
                                                console.error('? No se encontró obraId en el presupuesto:', presupuestoCompleto);
                                                showNotification('Error: El presupuesto no tiene una obra asociada', 'error');
                                                return;
                                              }

                                              console.log('?? Obra vinculada ID extraído:', obraIdVinculada, '(Presupuesto ID:', row.id, ')');

                                              // Usar el presupuesto completo como si fuera una obra
                                              // ?? IMPORTANTE: id debe ser el ID de la OBRA vinculada para que las asignaciones funcionen
                                              const trabajoParaGastos = {
                                                id: obraIdVinculada, // ? ID de la obra vinculada - USADO POR EL MODAL
                                                obraId: obraIdVinculada, // ? ID de la obra vinculada
                                                presupuestoId: row.id, // ? ID del presupuesto para referencia
                                                nombre: row.nombreObra || row.nombre,
                                                presupuestoNoCliente: presupuestoCompleto, // ? Presupuesto completo cargado
                                                fechaProbableInicio: presupuestoCompleto.fechaProbableInicio || row.fechaProbableInicio,
                                                tiempoEstimadoTerminacion: presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion,
                                                diasHabiles: presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion,
                                                semanas: Math.ceil((presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion || 0) / 5),
                                                // Configuraci?n establecida
                                                configuracionPlanificacion: {
                                                  semanas: Math.ceil((presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion || 0) / 5),
                                                  diasHabiles: presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion,
                                                  fechaInicio: presupuestoCompleto.fechaProbableInicio || row.fechaProbableInicio,
                                                  jornalesTotales: presupuestoCompleto.jornalesTotales || row.jornalesTotales || 0,
                                                  semanasObjetivo: Math.ceil((presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion || 0) / 5)
                                                },
                                                // Gastos del presupuesto completo
                                                otrosCostos: presupuestoCompleto.otrosCostos || [],
                                                gastosGenerales: presupuestoCompleto.gastosGenerales || [],
                                                _esTrabajoExtra: true,
                                                _esTrabajoAdicional: true,
                                                _trabajoExtraId: row.id,  // Legacy
                                                _trabajoAdicionalId: row.id,
                                                // ✅ FIX: Usar obraIdVinculada extraída del presupuesto, NO obraParaTrabajosExtra
                                                _obraOriginalId: obraIdVinculada
                                              };
                                              setObraParaAsignarGastos(trabajoParaGastos);
                                              setMostrarModalAsignarGastos(true);
                                            } catch (error) {
                                              console.error('? Error cargando presupuesto del trabajo extra:', error);
                                              showNotification('Error al cargar el presupuesto del trabajo extra', 'error');
                                            }
                                          }}
                                        >
                                          <span>
                                            <i className="fas fa-dollar-sign me-2"></i>
                                            Asignar Gastos
                                          </span>
                                          <span className="badge bg-danger">
                                            {row.gastosGenerales?.length || row.otrosCostos?.length || 0}
                                          </span>
                                        </button>
                                      </div>

                                      {/* Etapas Diarias */}
                                      <div className="col-md-6">
                                        <h6 className="text-muted mb-2">
                                          <i className="fas fa-calendar-alt me-2"></i>
                                          Etapas Diarias
                                        </h6>
                                        <button
                                          className="btn btn-sm btn-outline-info w-100 d-flex justify-content-between align-items-center"
                                          onClick={async (e) => {
                                            e.stopPropagation();

                                            try {
                                              // ?? PRIMERO: buscar el trabajo extra actualizado en el estado local
                                              const trabajoExtraEnEstado = trabajosExtra.find(t => t.id === row.id);
                                              const tiempoActualizado = trabajoExtraEnEstado?.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion;
                                              const fechaActualizada = trabajoExtraEnEstado?.fechaProbableInicio || row.fechaProbableInicio;

                                              console.log('?? [Cronograma TE] Buscando trabajo extra con configuraci?n actualizada:', {
                                                rowId: row.id,
                                                trabajoEnEstado: !!trabajoExtraEnEstado,
                                                tiempoEnEstado: trabajoExtraEnEstado?.tiempoEstimadoTerminacion,
                                                tiempoFinal: tiempoActualizado
                                              });

                                              // Si el trabajo extra en estado tiene datos diferentes a row, usarlos sin cargar del backend
                                              let presupuestoCompleto;

                                              // ?? PASO 1: Buscar en cache etiquetado para trabajos extra (m?s confiable)
                                              const presupuestoCacheado = presupuestosObras[`te_${row.id}`];

                                              if (presupuestoCacheado && presupuestoCacheado.tiempoEstimadoTerminacion) {
                                                console.log('? [Cronograma TE] RECUPERANDO presupuesto del cache etiquetado (congelado)');
                                                presupuestoCompleto = presupuestoCacheado;
                                              } else if (trabajoExtraEnEstado && (trabajoExtraEnEstado.tiempoEstimadoTerminacion !== row.tiempoEstimadoTerminacion || trabajoExtraEnEstado.fechaProbableInicio !== row.fechaProbableInicio)) {
                                                console.log('? [Cronograma TE] Usando trabajo extra actualizado del estado (NO cargar del backend)');
                                                presupuestoCompleto = { ...row, ...trabajoExtraEnEstado };
                                              } else {
                                                console.log('?? [Cronograma TE] Cargando presupuesto completo del trabajo extra ID:', row.id);
                                                presupuestoCompleto = await api.presupuestosNoCliente.getById(row.id, empresaId);
                                              }

                                              console.log('? [Cronograma TE] Presupuesto resuelto:', {
                                                tiempoEstimadoTerminacion: presupuestoCompleto.tiempoEstimadoTerminacion,
                                                fechaProbableInicio: presupuestoCompleto.fechaProbableInicio
                                              });

                                              // Crear objeto independiente para trabajo extra
                                              const trabajoParaEtapas = {
                                                // Usar _obraOriginalId si existe (trabajo extra dentro de trabajo extra),
                                                // sino verificar row.obraId, sino obraParaTrabajosExtra.id
                                                id: row.obraId || obraParaTrabajosExtra._obraOriginalId || obraParaTrabajosExtra.id,
                                                _idVisualizacion: `te_${row.id}`, // ID ?nico para visualizaci?n
                                                nombre: row.nombreObra || row.nombre,
                                                fechaProbableInicio: presupuestoCompleto.fechaProbableInicio || row.fechaProbableInicio,
                                                tiempoEstimadoTerminacion: presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion,
                                                diasHabiles: presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion,
                                                semanas: Math.ceil((presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion || 0) / 5),
                                                // Configuraci?n establecida
                                                configuracionPlanificacion: {
                                                  semanas: Math.ceil((presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion || 0) / 5),
                                                  diasHabiles: presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion,
                                                  fechaInicio: presupuestoCompleto.fechaProbableInicio || row.fechaProbableInicio
                                                },
                                                _esTrabajoExtra: true,
                                                _esTrabajoAdicional: true,
                                                _trabajoExtraId: row.id,  // Legacy
                                                _trabajoAdicionalId: row.id,
                                                _trabajoExtraPresupuestoId: row.id, // ID del presupuesto del trabajo extra
                                                _obraOriginalId: row.obraId || obraParaTrabajosExtra._obraOriginalId || obraParaTrabajosExtra.id,
                                                _trabajoExtraNombre: row.nombreObra || row.nombre,
                                                obraId: row.obraId || obraParaTrabajosExtra._obraOriginalId || obraParaTrabajosExtra.id,
                                                // ?? IMPORTANTE: Usar el presupuesto actualizado (puede ser del estado o del backend)
                                                presupuestoNoCliente: presupuestoCompleto
                                              };
                                              console.log('?? [Gestionar Etapa TE] Usando presupuesto con', presupuestoCompleto.tiempoEstimadoTerminacion, 'd?as h?biles');
                                              console.log('?????? [Gestionar Etapa TE] TRABAJO_PARA_ETAPAS COMPLETO:', {
                                                id: trabajoParaEtapas.id,
                                                presupuestoNoClienteTiempo: trabajoParaEtapas.presupuestoNoCliente?.tiempoEstimadoTerminacion,
                                                presupuestoNoClienteFecha: trabajoParaEtapas.presupuestoNoCliente?.fechaProbableInicio,
                                                TRABAJO_PARA_ETAPAS_COMPLETO: trabajoParaEtapas
                                              });
                                              setSelectedObraId(trabajoParaEtapas.id);
                                              cargarEtapasDiarias(trabajoParaEtapas);
                                              dispatch(setActiveTab('etapas-diarias'));
                                            } catch (error) {
                                              console.error('? Error cargando presupuesto del trabajo extra:', error);
                                              showNotification('Error al cargar el presupuesto del trabajo extra', 'error');
                                            }
                                          }}
                                        >
                                          <span>
                                            <i className="fas fa-calendar-plus me-2"></i>
                                            Gestionar Etapas
                                          </span>
                                          <span className="badge bg-info">{(row.etapasDiarias?.length || 0)}</span>
                                        </button>
                                      </div>

                                      {/* Trabajos Adicionales */}
                                      <div className="col-md-6">
                                        <h6 className="text-muted mb-2">
                                          <i className="fas fa-clipboard-list me-2"></i>
                                          Tareas Leves
                                        </h6>
                                        <button
                                          className="btn btn-sm btn-outline-primary w-100 d-flex justify-content-between align-items-center"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            // Configurar el trabajo extra como obra para trabajos adicionales
                                            const trabajoExtraComoObra = {
                                              ...row,
                                              id: row.obraId || obraParaTrabajosExtra.id, // ID de la obra padre
                                              _esTrabajoExtra: true,
                                              _esTrabajoAdicional: true,
                                              _trabajoExtraId: row.id,
                                              _trabajoAdicionalId: row.id,
                                              _trabajoExtraNombre: row.nombreObra || row.nombre
                                            };
                                            setObraParaTrabajosAdicionales(trabajoExtraComoObra);
                                            // Abrir directamente el modal de PresupuestoNoClienteModal
                                            abrirModalTareaLeveDirecto(trabajoExtraComoObra);
                                          }}
                                        >
                                          <span>
                                            <i className="fas fa-plus-square me-2"></i>
Gestionar Tareas Leves
                                          </span>
                                          <span className="badge bg-primary">
                                            {trabajosAdicionales.filter(ta => ta.trabajoExtraId === row.id).length}
                                          </span>
                                        </button>

                                        {/* Lista de trabajos adicionales */}
                                        {obtenerTrabajosAdicionalesTrabajoExtra(row.id).length > 0 && (
                                          <div className="mt-3">
                                            {obtenerTrabajosAdicionalesTrabajoExtra(row.id).map((ta) => (
                                              <div key={ta.id} className="card mb-2" style={{ borderLeft: '4px solid #ff9800' }}>
                                                <div className="card-body p-2">
                                                  <div className="d-flex justify-content-between align-items-start">
                                                    <div className="flex-grow-1">
                                                      <div className="d-flex align-items-center gap-2 mb-1">
                                                        <strong className="text-warning">{ta.nombre}</strong>
                                                        <span className={`badge bg-${trabajosAdicionalesService.COLORES_ESTADO[ta.estado]}`}>
                                                          <i className={`fas fa-${trabajosAdicionalesService.ICONOS_ESTADO[ta.estado]} me-1`}></i>
                                                          {ta.estado}
                                                        </span>
                                                      </div>
                                                      <div className="small text-muted">
                                                        <i className="fas fa-dollar-sign me-1"></i>
                                                        ${ta.importe?.toFixed(2) || '0.00'}
                                                        <span className="mx-2">|</span>
                                                        <i className="fas fa-calendar-day me-1"></i>
                                                        {ta.diasNecesarios} d?as
                                                        <span className="mx-2">|</span>
                                                        <i className="fas fa-users me-1"></i>
                                                        {ta.profesionales?.length || 0} profesionales
                                                      </div>
                                                    </div>
                                                    <div className="btn-group btn-group-sm">
                                                      <button
                                                        className="btn btn-outline-secondary"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          // ? Editar tarea NIETA (hija de trabajo extra)
                                                          const trabajoExtra = trabajosExtras.find(te => te.id === row.id);
                                                          const obraAbuelo = obras.find(o => o.id === row.obraId || o.id === obraParaTrabajosExtra.id);

                                                          if (trabajoExtra && obraAbuelo) {
                                                            abrirModalTareaLeveNieta(obraAbuelo, trabajoExtra, ta);
                                                          }
                                                        }}
                                                        title="Editar"
                                                      >
                                                        <i className="fas fa-edit"></i>
                                                      </button>
                                                      <button
                                                        className="btn btn-outline-danger"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleEliminarTrabajoAdicional(ta.id, ta.nombre);
                                                        }}
                                                        title="Eliminar"
                                                      >
                                                        <i className="fas fa-trash"></i>
                                                      </button>
                                                    </div>
                                                  </div>
                                                  {ta.estado === 'PENDIENTE' && (
                                                    <div className="mt-2 d-flex gap-1">
                                                      <button
                                                        className="btn btn-xs btn-primary"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleCambiarEstadoTrabajoAdicional(ta.id, 'EN_PROGRESO');
                                                        }}
                                                      >
                                                        Iniciar
                                                      </button>
                                                    </div>
                                                  )}
                                                  {ta.estado === 'EN_PROGRESO' && (
                                                    <div className="mt-2 d-flex gap-1">
                                                      <button
                                                        className="btn btn-xs btn-success"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleCambiarEstadoTrabajoAdicional(ta.id, 'COMPLETADO');
                                                        }}
                                                      >
                                                        Completar
                                                      </button>
                                                      <button
                                                        className="btn btn-xs btn-warning"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleCambiarEstadoTrabajoAdicional(ta.id, 'CANCELADO');
                                                        }}
                                                      >
                                                        Cancelar
                                                      </button>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>

                                      {/* NUEVA SECCI�N: GESTI�N DE ESTADO Y CICLO DE VIDA */}
                                      <div className="col-12 mt-4">
                                        <div className="card border-primary">
                                            <div className="card-header bg-primary text-white py-2">
                                                <h6 className="mb-0"><i className="fas fa-tasks me-2"></i>Gesti?n de Ciclo de Vida</h6>
                                            </div>
                                            <div className="card-body bg-light p-3">
                                                <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                                                    <div className="d-flex align-items-center">
                                                        <span className="fw-bold me-2">Estado Actual:</span>
                                                        <span className={`badge ${
                                                            row.estado === 'BORRADOR' ? 'bg-secondary' :
                                                            row.estado === 'A_ENVIAR' ? 'bg-info' :
                                                            row.estado === 'ENVIADO' ? 'bg-primary' :
                                                            row.estado === 'APROBADO' ? 'bg-success' :
                                                            row.estado === 'MODIFICADO' ? 'bg-warning' :
                                                            'bg-light text-dark'
                                                        } px-3 py-2 fs-6`}>
                                                            {row.estado || 'BORRADOR'}
                                                        </span>
                                                    </div>

                                                    <div className="d-flex gap-2">
                                                        {(!row.estado || row.estado === 'BORRADOR') && (
                                                            <button
                                                                className="btn btn-success text-white"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleCambiarEstadoTrabajoExtra(row, 'A_ENVIAR');
                                                                }}
                                                            >
                                                                <i className="fas fa-check me-2"></i>Terminar Edici?n
                                                            </button>
                                                        )}

                                                        {row.estado === 'A_ENVIAR' && (
                                                            <>
                                                                <button
                                                                    className="btn btn-secondary me-2"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleCambiarEstadoTrabajoExtra(row, 'BORRADOR');
                                                                    }}
                                                                >
                                                                    <i className="fas fa-undo me-2"></i>Volver a Borrador
                                                                </button>
                                                                <button
                                                                    className="btn btn-primary"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleEnviarTrabajoExtraDesdeTabla(row);
                                                                    }}
                                                                >
                                                                    <i className="fas fa-paper-plane me-2"></i>Enviar Cliente
                                                                </button>
                                                            </>
                                                        )}

                                                        {row.estado === 'ENVIADO' && (
                                                            <>
                                                                <button
                                                                    className="btn btn-secondary me-2"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleCambiarEstadoTrabajoExtra(row, 'A_ENVIAR');
                                                                    }}
                                                                >
                                                                    <i className="fas fa-undo me-2"></i>Cancelar Env?o
                                                                </button>
                                                                <button
                                                                    className="btn btn-success text-white"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleGenerarObraDesdeTrabajoExtra(row);
                                                                    }}
                                                                >
                                                                    <i className="fas fa-check-circle me-2"></i>Aprobar y Crear Obra
                                                                </button>
                                                            </>
                                                        )}

                                                        {row.estado === 'APROBADO' && (
                                                            <>
                                                                <button
                                                                    className="btn btn-outline-secondary me-2"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleCambiarEstadoTrabajoExtra(row, 'ENVIADO');
                                                                    }}
                                                                >
                                                                    <i className="fas fa-undo me-2"></i>Deshacer Aprobaci?n
                                                                </button>
                                                                <button
                                                                    className="btn btn-lg btn-success shadow-sm"
                                                                    style={{border: '2px solid #198754'}}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleGenerarObraDesdeTrabajoExtra(row);
                                                                    }}
                                                                >
                                                                    <i className="fas fa-building me-2"></i>Generar Obra Derivada
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                              </>
                            )}
                          </React.Fragment>
                        );
                      })}
                      </tbody>
                  </table>
                </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab Etapas Diarias */}
      {activeTab === 'etapas-diarias' && (
        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center">
                  <button
                    className="btn btn-outline-primary me-3"
                    onClick={() => {
                      console.log('?? DEBUG Volver:', {
                        esTrabajoExtra: obraParaEtapasDiarias?._esTrabajoExtra,
                        obraOriginalId: obraParaEtapasDiarias?._obraOriginalId,
                        obraCompleta: obraParaEtapasDiarias
                      });
                      if (obraParaEtapasDiarias?._esTrabajoExtra && obraParaEtapasDiarias?._obraOriginalId) {
                        console.log('? Es trabajo extra, volviendo a trabajos-extra');
                        const obraOriginal = obras.find(o => o.id === obraParaEtapasDiarias._obraOriginalId);
                        setObraParaTrabajosExtra(obraOriginal);
                        setObraParaEtapasDiarias(null);
                        cargarTrabajosExtra(obraOriginal); // ?? Recargar los trabajos extra
                        dispatch(setActiveTab('trabajos-extra'));
                      } else {
                        console.log(' No es trabajo extra, volviendo a lista');
                        dispatch(setActiveTab('lista'));
                      }
                    }}
                    title="Volver a la lista de obras"
                  >
                    <i className="fas fa-arrow-left me-1"></i>Volver a Obras
                  </button>
                  <div>
                    <h5 className="mb-0">
                      <i className="fas fa-calendar-check me-2"></i>
                      {obraParaEtapasDiarias?._esTrabajoExtra
                        ? `Cronograma de Trabajo Extra - ${obraParaEtapasDiarias?._trabajoExtraNombre || obraParaEtapasDiarias?.nombre}`
                        : `Cronograma de Obra - ${obraParaEtapasDiarias?.nombre}`}
                    </h5>
                    {obraParaEtapasDiarias && (
                      <small className="text-muted">
                        <i className="fas fa-map-marker-alt me-1"></i>
                        {obraParaEtapasDiarias.direccion || 'Sin direcci?n'}
                      </small>
                    )}
                  </div>
                </div>
                <div className="d-flex gap-2 align-items-center">
                  <select
                    className="form-select form-select-sm"
                    value={filtroEstadoEtapa}
                    onChange={(e) => setFiltroEstadoEtapa(e.target.value)}
                    style={{ width: 'auto' }}
                  >
                    <option value="TODAS">Todas</option>
                    <option value="TERMINADA"> Terminadas</option>
                    <option value="EN_PROCESO"> En Proceso</option>
                    <option value="SUSPENDIDA"> Suspendidas</option>
                    <option value="MODIFICADA"> Modificadas</option>
                    <option value="CANCELADA"> Canceladas</option>
                  </select>
                </div>
              </div>
              <div className="card-body">
                {loadingEtapasDiarias ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Cargando...</span>
                    </div>
                    <p className="mt-2 text-muted">Cargando calendario...</p>
                  </div>
                ) : (() => {
                    // ?? Si es trabajo extra, usar SOLO su presupuesto pre-cargado (no buscar en cache)
                    const presupuestoActualizado = obraParaEtapasDiarias?._esTrabajoExtra
                      ? obraParaEtapasDiarias?.presupuestoNoCliente
                      : (presupuestosObras[obraParaEtapasDiarias?.id] || obraParaEtapasDiarias?.presupuestoNoCliente);

                    // ?? DEBUG: Ver qu? presupuesto se est? usando
                    console.log('?? [CRONOGRAMA JSX] presupuestoActualizado:', {
                      esTrabajoExtra: obraParaEtapasDiarias?._esTrabajoExtra,
                      obraId: obraParaEtapasDiarias?.id,
                      tiempoEstimado: presupuestoActualizado?.tiempoEstimadoTerminacion,
                      version: presupuestoActualizado?.numeroVersion,
                      itemsCount: presupuestoActualizado?.itemsCalculadora?.length
                    });

                    if (!presupuestoActualizado || !presupuestoActualizado?.id) {
                      return (
                        <div className="text-center text-muted py-5">
                          <i className="fas fa-exclamation-triangle fa-4x mb-3 text-warning"></i>
                          <p className="fs-5">Esta obra no tiene un presupuesto vinculado</p>
                          <p className="text-muted">
                            Para generar el calendario autom?tico, la obra debe tener un presupuesto (PresupuestoNoCliente) con jornales.
                          </p>
                        </div>
                      );
                    }

                    if (calendarioCompleto.length === 0) {
                      return (
                        <div className="text-center text-muted py-5">
                          <i className="fas fa-calendar-times fa-4x mb-3"></i>
                          <p className="fs-5">No se pudieron generar etapas autom?ticas</p>
                          <p className="text-muted">
                            El presupuesto debe incluir un ?tem de "jornales"
                          </p>
                        </div>
                      );
                    }

                    return (
                  <>
                    {/* RESUMEN */}
                    <div className="alert alert-info mb-3">
                      <div className="row text-center">
                        <div className="col-3">
                          <h5>
                            {/* ? USAR MISMA L�GICA QUE L�NEA 5181*/}
                            {obraParaEtapasDiarias?.tiempoEstimadoTerminacion || obraParaEtapasDiarias?.presupuestoNoCliente?.tiempoEstimadoTerminacion || 0}
                          </h5>
                          <small>D?as</small>
                        </div>
                        <div className="col-3">
                          <h5>
                            {/* ? CALCULAR SEMANAS CONSIDERANDO FERIADOS */}
                            {(() => {
                              const diasHabiles = obraParaEtapasDiarias?.tiempoEstimadoTerminacion || obraParaEtapasDiarias?.presupuestoNoCliente?.tiempoEstimadoTerminacion || 0;
                              const fechaInicio = obraParaEtapasDiarias?.fechaProbableInicio || obraParaEtapasDiarias?.presupuestoNoCliente?.fechaProbableInicio;

                              if (fechaInicio && diasHabiles > 0) {
                                try {
                                  // Usar funci?n que calcula semanas considerando feriados
                                  return calcularSemanasParaDiasHabiles(parsearFechaLocal(fechaInicio), diasHabiles);
                                } catch (error) {
                                  console.warn(' Error calculando semanas con feriados, usando fallback:', error);
                                  return Math.ceil(diasHabiles / 5);
                                }
                              } else {
                                // Si no hay fecha de inicio, usar c?lculo simple
                                return Math.ceil(diasHabiles / 5);
                              }
                            })()}
                          </h5>
                          <small>Semanas</small>
                        </div>
                        <div className="col-3">
                          <h5 className="text-success">
                            {etapasDiarias.filter(e => e.estado === 'TERMINADA').length}
                          </h5>
                          <small>Completados</small>
                        </div>
                        <div className="col-3">
                          <h5 className="text-primary">
                            {Math.round((etapasDiarias.filter(e => e.estado === 'TERMINADA').length /
                              calendarioCompleto.reduce((acc, s) => acc + s.dias.length, 0)) * 100) || 0}%
                          </h5>
                          <small>Progreso</small>
                        </div>
                      </div>
                    </div>

                    {/* CALENDARIO */}
                    {calendarioCompleto.map((semana) => {
                      // Calcular el rango de d?as laborables de la semana (lun-vie)
                      const fechasLaborables = semana.dias.filter(d =>
                        d.estado !== 'FERIADO' && d.estado !== 'FIN_DE_SEMANA'
                      );

                      if (fechasLaborables.length === 0) {
                        // Fallback si no hay d?as laborables
                        return null;
                      }

                      const primerDiaLaboral = parsearFechaLocal(fechasLaborables[0].fecha);

                      // El ?ltimo d?a laboral de la semana es el viernes (d?a 5) de esa semana calendario
                      // Encontrar el viernes de la semana del primer d?a laboral
                      const primerLunes = new Date(primerDiaLaboral);
                      const diasHastaLunes = (primerDiaLaboral.getDay() + 6) % 7; // D?as desde el lunes anterior
                      primerLunes.setDate(primerDiaLaboral.getDate() - diasHastaLunes);

                      const viernesDeEsaSemana = new Date(primerLunes);
                      viernesDeEsaSemana.setDate(primerLunes.getDate() + 4); // Lunes + 4 d?as = Viernes

                      // Si hay d?as laborables que llegan hasta viernes, usar viernes. Si no, usar el ?ltimo d?a laboral disponible
                      const ultimaFechaLaboral = parsearFechaLocal(fechasLaborables[fechasLaborables.length - 1].fecha);
                      const ultimoDiaLaboral = ultimaFechaLaboral <= viernesDeEsaSemana ? ultimaFechaLaboral : viernesDeEsaSemana;

                      return (
                        <div key={semana.numero} className="card mb-3">
                          <div className="card-header bg-primary text-white">
                            <strong>Semana {semana.numero}</strong>
                            <small className="ms-2">
                              (
                                {primerDiaLaboral.getDate()}/{primerDiaLaboral.toLocaleDateString('es-AR', { month: 'short' })} - {' '}
                                {ultimoDiaLaboral.getDate()}/{ultimoDiaLaboral.toLocaleDateString('es-AR', { month: 'short' })}
                              )
                            </small>
                          </div>
                        <div className="table-responsive">
                          <table className="table table-hover mb-0">
                            <thead className="table-light">
                              <tr>
                                <th width="12%">Fecha</th>
                                <th width="60%">Tareas</th>
                                <th width="18%" className="text-center">Profesionales</th>
                                <th width="10%" className="text-center">Acci?n</th>
                              </tr>
                            </thead>
                            <tbody>
                              {semana.dias.map((dia) => {
                                if (dia.esFeriado || dia.estado === 'FERIADO') {
                                  // Mostrar celda de feriado (NO cuenta como d?a h?bil)
                                  return (
                                    <tr key={dia.fecha} className="table-warning">
                                      <td>
                                        <strong>{dia.diaSemana.substring(0, 3)}</strong>
                                        <br/><small className="text-muted">{dia.diaNumero}/{dia.mes}</small>
                                      </td>
                                      <td colSpan="3" className="text-center text-muted fst-italic">
                                        ?? Feriado - No laborable
                                      </td>
                                    </tr>
                                  );
                                } else if (dia.estado === 'FIN_DE_SEMANA') {
                                  // D?a que cae en la semana pero no es d?a h?bil
                                  return (
                                    <tr key={dia.fecha} className="table-light">
                                      <td>
                                        <strong>{dia.diaSemana.substring(0, 3)}</strong>
                                        <br/><small className="text-muted">{dia.diaNumero}/{dia.mes}</small>
                                      </td>
                                      <td colSpan="3" className="text-center text-muted fst-italic">
                                        ?? No laborable
                                      </td>
                                    </tr>
                                  );
                                } else {
                                  // D?a h?bil normal
                                  const totalProf = dia.tareas?.reduce((acc, t) => acc + (t.profesionales?.length || 0), 0) || 0;

                                  return (
                                    <tr key={dia.fecha} className="hover-row" style={{ cursor: 'pointer' }} onClick={() => handleAbrirDia(dia)}>
                                      <td>
                                        <strong>{dia.diaSemana.substring(0, 3)}</strong>
                                        <br/><small className="text-muted">{dia.diaNumero}/{dia.mes}</small>
                                      </td>
                                      <td>
                                        {dia.descripcion && (
                                          <div className="small mb-2">
                                            <i className="fas fa-info-circle me-1 text-primary"></i>
                                            <strong>{dia.descripcion}</strong>
                                          </div>
                                        )}
                                        {dia.tareas?.length > 0 ? (
                                          <div className="row g-2">
                                            {dia.tareas.map((t, i) => (
                                              <div key={t.id || `tarea-${dia.fecha}-${i}`} className="col-6">
                                                <div
                                                  className="small d-flex align-items-center"
                                                  style={{ cursor: 'pointer', padding: '2px 0' }}
                                                  onClick={(e) => handleCambiarEstadoTareaRapido(e, dia, i)}
                                                  title="Click para cambiar estado"
                                                >
                                                  {t.estado === 'COMPLETADA' ? (
                                                    <span className="badge bg-success me-1" style={{ fontSize: '8px' }}>? Completada</span>
                                                  ) : t.estado === 'EN_PROCESO' ? (
                                                    <span className="badge bg-primary me-1" style={{ fontSize: '8px' }}>?? En Proceso</span>
                                                  ) : (
                                                    <span className="badge bg-secondary me-1" style={{ fontSize: '8px' }}>? Pendiente</span>
                                                  )}
                                                  <span style={{ fontSize: '11px' }}>{t.descripcion}</span>
                                                </div>
                                                {t.profesionales && t.profesionales.length > 0 && (
                                                  <div className="text-muted" style={{ fontSize: '9px', marginLeft: '20px' }}>
                                                    ?? {t.profesionales.map(p =>
                                                      typeof p === 'object' ? p.nombre : p
                                                    ).join(', ')}
                                                  </div>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <span className="text-muted small">
                                            <i className="fas fa-plus me-1"></i>Agregar tareas
                                          </span>
                                        )}
                                      </td>
                                      <td className="text-center">
                                        {totalProf > 0 ? (
                                          <span className="badge bg-info">{totalProf}</span>
                                        ) : (
                                          <span className="text-muted">-</span>
                                        )}
                                      </td>
                                      <td className="text-center">
                                        <button className="btn btn-sm btn-outline-primary" onClick={(e) => { e.stopPropagation(); handleAbrirDia(dia); }}>
                                          <i className="fas fa-edit"></i>
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                }
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  </div>
)}

      {/* Modal de edici?n eliminado - se usa el mismo formulario de creaci?n */}

      {/* Mostrar estad?sticas si est?n disponibles */}
      {estadisticas && (
        <div className="row mt-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h5>Estad?sticas de Obras</h5>
              </div>
              <div className="card-body">
                {/* Tabla visual */}
                {estadisticas.estados && (
                  <div className="mb-4">
                    <h6 className="mb-3">Cantidad de obras por estado</h6>
                    <table className="table table-bordered table-striped">
                      <thead>
                        <tr>
                          <th>Estado</th>
                          <th>Cantidad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {estadisticas.estados.map((item, idx) => (
                          <tr key={idx}>
                            <td>{item.estado}</td>
                            <td>{item.cantidad}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Gr?fico de barras */}
                {estadisticas.estados && (
                  <div className="row">
                    <div className="col-md-7 mb-4">
                      <h6 className="mb-2">Gr?fico de barras</h6>
                      <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer>
                          <BarChart data={estadisticas.estados} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="estado" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="cantidad" fill="#007bff" name="Cantidad" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="col-md-5 mb-4">
                      <h6 className="mb-2">Gr?fico de torta</h6>
                      <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie
                              data={estadisticas.estados}
                              dataKey="cantidad"
                              nameKey="estado"
                              cx="50%"
                              cy="50%"
                              outerRadius={90}
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            >
                              {estadisticas.estados.map((entry, idx) => (
                                <Cell key={`cell-${idx}`} fill={['#007bff','#28a745','#ffc107','#dc3545','#6c757d','#6610f2','#20c997'][idx % 7]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}

                {/* Si hay otros datos, mostrar en tabla adicional */}
                {estadisticas.otros && (
                  <div className="mt-4">
                    <h6>Otros datos</h6>
                    <table className="table table-bordered">
                      <tbody>
                        {Object.entries(estadisticas.otros).map(([key, value], idx) => (
                          <tr key={idx}>
                            <td>{key}</td>
                            <td>{value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para ver presupuestos de la obra */}
      {mostrarModalPresupuestos && obraParaPresupuestos && (
        <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="fas fa-file-invoice-dollar me-2"></i>
                  Presupuestos de: {obraParaPresupuestos.nombre}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setMostrarModalPresupuestos(false);
                    setObraParaPresupuestos(null);
                    setPresupuestosObra([]);
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <small className="text-muted">
                    <i className="fas fa-map-marker-alt me-1"></i>
                    {formatearDireccionObra(obraParaPresupuestos)}
                  </small>
                </div>

                {loadingPresupuestos ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Cargando presupuestos...</span>
                    </div>
                    <p className="mt-2 text-muted">Cargando presupuestos...</p>
                  </div>
                ) : presupuestosObra.length === 0 ? (
                  <div className="alert alert-info">
                    <i className="fas fa-info-circle me-2"></i>
                    No hay presupuestos asociados a esta obra.
                  </div>
                ) : (
                  <>
                    {/* Bot?n para abrir la versi?n m?s reciente directamente */}
                    <div className="mb-3">
                      <button
                        className="btn btn-success"
                        onClick={() => handleAbrirPresupuesto(presupuestosObra[0])}
                        disabled={cargandoPresupuesto}
                      >
                        {cargandoPresupuesto ? (
                          <span className="spinner-border spinner-border-sm me-2"></span>
                        ) : (
                          <i className="fas fa-eye me-2"></i>
                        )}
                        Abrir �ltima Versi?n (v{presupuestosObra[0].numeroVersion || presupuestosObra[0].version || 1})
                      </button>
                      <small className="text-muted ms-3">
                        �ltima modificaci?n: {presupuestosObra[0].fechaUltimaModificacionEstado ?
                          new Date(presupuestosObra[0].fechaUltimaModificacionEstado).toLocaleDateString() :
                          (presupuestosObra[0].fechaCreacion ? new Date(presupuestosObra[0].fechaCreacion).toLocaleDateString() : 'N/A')}
                      </small>
                    </div>

                    <div className="table-responsive">
                    <table className="table table-hover table-striped">
                      <thead className="table-light">
                        <tr>
                          <th>ID</th>
                          <th>Versi?n</th>
                          <th>Estado</th>
                          <th>Fecha Creaci?n</th>
                          <th>Total</th>
                          <th>Cliente</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {presupuestosObra.map((presupuesto, index) => {
                          const esPresupuestoActivo = presupuesto.estado === 'APROBADO' || presupuesto.estado === 'EN_EJECUCI�N' || presupuesto.estado === 'EN_EJECUCION';
                          const esElPrimero = index === 0;

                          return (
                            <tr
                              key={presupuesto.id}
                              className={esPresupuestoActivo ? 'table-success' : esElPrimero ? 'table-info' : ''}
                              style={esPresupuestoActivo || esElPrimero ? { fontWeight: '500' } : {}}
                            >
                              <td>
                                {presupuesto.id}
                                {esPresupuestoActivo && (
                                  <span className="badge bg-success ms-2" style={{ fontSize: '0.7em' }}>
                                    ACTIVO
                                  </span>
                                )}
                                {esElPrimero && !esPresupuestoActivo && (
                                  <span className="badge bg-info ms-2" style={{ fontSize: '0.7em' }}>
                                    PRINCIPAL
                                  </span>
                                )}
                              </td>
                              <td>
                                <span className={`badge ${esPresupuestoActivo ? 'bg-success' : esElPrimero ? 'bg-info' : 'bg-secondary'}`}>
                                  v{presupuesto.numeroVersion || presupuesto.version || 1}
                                </span>
                              </td>
                            <td>
                              <span className={`badge ${
                                presupuesto.estado === 'APROBADO' ? 'bg-success' :
                                presupuesto.estado === 'ENVIADO' ? 'bg-primary' :
                                presupuesto.estado === 'BORRADOR' ? 'bg-secondary' :
                                'bg-warning'
                              }`}>
                                {presupuesto.estado}
                              </span>
                            </td>
                            <td>
                              <small>
                                {presupuesto.fechaCreacion ?
                                  new Date(presupuesto.fechaCreacion).toLocaleDateString() :
                                  'N/A'}
                              </small>
                            </td>
                            <td>
                              <strong>
                                ${(presupuesto.totalConDescuentos || presupuesto.totalFinal || presupuesto.total || 0).toLocaleString()}
                              </strong>
                            </td>
                            <td>
                              <small>{presupuesto.nombreCliente || 'Sin cliente'}</small>
                            </td>
                            <td>
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => handleAbrirPresupuesto(presupuesto)}
                                disabled={cargandoPresupuesto}
                                title="Abrir presupuesto para editar"
                              >
                                {cargandoPresupuesto ? (
                                  <span className="spinner-border spinner-border-sm me-1"></span>
                                ) : (
                                  <i className="fas fa-edit me-1"></i>
                                )}
                                Abrir
                              </button>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarModalPresupuestos(false);
                    setObraParaPresupuestos(null);
                    setPresupuestosObra([]);
                  }}
                >
                  <i className="fas fa-times me-2"></i>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para cambiar estado de obra */}
      {mostrarModalCambiarEstado && (
        <div
          className="modal fade show"
          style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}
          tabIndex="-1"
          onClick={() => setMostrarModalCambiarEstado(false)}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="fas fa-exchange-alt me-2"></i>
                  Cambiar Estado de Obra
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setMostrarModalCambiarEstado(false)}
                ></button>
              </div>
              <div className="modal-body">
                {selectedObraId && (() => {
                  const obra = obras.find(o => o.id === selectedObraId);
                  return (
                    <>
                      <div className="mb-3">
                        <p className="mb-2"><strong>Obra:</strong> {obra?.nombre || 'Sin nombre'}</p>
                        <p className="mb-2"><strong>Direcci?n:</strong> {obra?.direccion || 'Sin direcci?n'}</p>
                        <p className="mb-3">
                          <strong>Estado actual:</strong>{' '}
                          <span className={`badge ${
                            obra?.estado === 'BORRADOR' ? 'bg-warning' :
                            obra?.estado === 'EN OBRA' ? 'bg-primary' :
                            obra?.estado === 'FINALIZADA' ? 'bg-success' :
                            obra?.estado === 'CANCELADA' ? 'bg-danger' :
                            obra?.estado === 'SUSPENDIDA' ? 'bg-secondary' :
                            'bg-info'
                          }`}>
                            {obra?.estado || 'N/A'}
                          </span>
                        </p>
                      </div>

                      <div className="mb-3">
                        <label htmlFor="nuevoEstado" className="form-label">
                          <strong>Seleccione el nuevo estado:</strong>
                        </label>
                        <select
                          id="nuevoEstado"
                          className="form-select form-select-lg"
                          value={nuevoEstadoSeleccionado}
                          onChange={(e) => setNuevoEstadoSeleccionado(e.target.value)}
                        >
                          <option value="BORRADOR">Borrador</option>
                          <option value="A_ENVIAR">A enviar</option>
                          <option value="ENVIADO">Enviado</option>
                          <option value="MODIFICADO">Modificado</option>
                          <option value="APROBADO">Aprobado</option>
                          <option value="OBRA_A_CONFIRMAR">Obra a confirmar</option>
                          <option value="EN_EJECUCION">En ejecuci?n</option>
                          <option value="SUSPENDIDA">Suspendida</option>
                          <option value="TERMINADO">Terminado</option>
                          <option value="CANCELADO">Cancelado</option>
                        </select>
                      </div>

                      <div className="alert alert-info mb-0">
                        <i className="fas fa-info-circle me-2"></i>
                        El estado de la obra se actualizar? inmediatamente al confirmar.
                      </div>
                    </>
                  );
                })()}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setMostrarModalCambiarEstado(false)}
                >
                  <i className="fas fa-times me-2"></i>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={confirmarCambioEstado}
                >
                  <i className="fas fa-check me-2"></i>
                  Confirmar Cambio
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Asignar Profesionales */}
      {mostrarModalAsignarProfesionalesSemanal && obraParaAsignarProfesionales && (
        <AsignarProfesionalSemanalModal
          show={mostrarModalAsignarProfesionalesSemanal}
          onHide={() => {
            setMostrarModalAsignarProfesionalesSemanal(false);
            setObraParaAsignarProfesionales(null);
          }}
          obra={obraParaAsignarProfesionales}
          profesionalesDisponibles={profesionalesDisponibles}
          configuracionObra={
            // Si es trabajo extra, usar la configuraci?n que viene en el objeto
            // Si es obra regular, buscar en la base de datos
            obraParaAsignarProfesionales._esTrabajoExtra
              ? obraParaAsignarProfesionales.configuracionPlanificacion
              : obtenerConfiguracionObra(obraParaAsignarProfesionales.id)
          }
          onRefreshProfesionales={refrescarProfesionalesDisponibles}
          onAsignar={async (asignacionData) => {
            // Backend integrado - recargar obras despu?s de asignaci?n exitosa
            console.log('Asignaci?n semanal guardada:', asignacionData);

            // ?? Si es trabajo extra, recargar trabajos extra; si es obra normal, recargar contadores
            if (obraParaAsignarProfesionales?._esTrabajoExtra && obraParaTrabajosExtra) {
              console.log('?? [Profesionales] Recargando trabajos extra para actualizar badges...', {
                trabajoExtraId: obraParaAsignarProfesionales.id,
                // Si estamos dentro de un trabajo extra, usar el ID de la obra original
                obraId: obraParaTrabajosExtra._obraOriginalId || obraParaTrabajosExtra.id
              });
              await cargarTrabajosExtra(obraParaTrabajosExtra);
              console.log('? [Profesionales] Trabajos extra recargados');
            } else if (obraParaAsignarProfesionales?.id) {
              const obraIdReal = obraParaAsignarProfesionales.obraId || obraParaAsignarProfesionales.id;
              cargarContadoresObra(obraIdReal);
            }

            cargarObrasSegunFiltro();

            // Refrescar lista de profesionales disponibles para que el asignado no aparezca m?s
            await refrescarProfesionalesDisponibles();
          }}
        />
      )}

      {/* Modal de Asignar Materiales a Obra */}
      {mostrarModalAsignarMateriales && obraParaAsignarMateriales && (
        <AsignarMaterialObraModal
          show={mostrarModalAsignarMateriales}
          onClose={async () => {
            console.log('?? Cerrando modal de materiales - recargando contadores...');
            // ?? Si es trabajo extra, recargar trabajos extra ANTES de cerrar
            if (obraParaAsignarMateriales?._esTrabajoExtra && obraParaTrabajosExtra) {
              console.log('?? [Materiales] Recargando trabajos extra para actualizar badges...', {
                trabajoExtraId: obraParaAsignarMateriales.id,
                // Si estamos dentro de un trabajo extra, usar el ID de la obra original
                obraId: obraParaTrabajosExtra._obraOriginalId || obraParaTrabajosExtra.id
              });
              await cargarTrabajosExtra(obraParaTrabajosExtra);
              console.log('? [Materiales] Trabajos extra recargados');
            } else if (obraParaAsignarMateriales?.id) {
              const obraIdReal = obraParaAsignarMateriales.obraId || obraParaAsignarMateriales.id;
              cargarContadoresObra(obraIdReal);
            }
            setMostrarModalAsignarMateriales(false);
            setObraParaAsignarMateriales(null);
          }}
          obra={obraParaAsignarMateriales}
          configuracionObra={
            // Si es trabajo extra, usar la configuraci?n que viene en el objeto
            // Si es obra regular, buscar en la base de datos
            obraParaAsignarMateriales._esTrabajoExtra
              ? obraParaAsignarMateriales.configuracionPlanificacion
              : obtenerConfiguracionObra(obraParaAsignarMateriales?.id)
          }
          onAsignacionExitosa={async () => {
            showNotification('? Materiales asignados correctamente', 'success');
            // ?? Si es trabajo extra, recargar trabajos extra; si es obra normal, recargar contadores
            if (obraParaAsignarMateriales?._esTrabajoExtra && obraParaTrabajosExtra) {
              console.log('?? [Materiales Success] Recargando trabajos extra para actualizar badges...', {
                trabajoExtraId: obraParaAsignarMateriales.id,
                // Si estamos dentro de un trabajo extra, usar el ID de la obra original
                obraId: obraParaTrabajosExtra._obraOriginalId || obraParaTrabajosExtra.id
              });
              await cargarTrabajosExtra(obraParaTrabajosExtra);
              console.log('? [Materiales Success] Trabajos extra recargados');
            } else if (obraParaAsignarMateriales?.id) {
              const obraIdReal = obraParaAsignarMateriales.obraId || obraParaAsignarMateriales.id;
              cargarContadoresObra(obraIdReal);
            }
            cargarObrasSegunFiltro();
          }}
        />
      )}

      {/* Modal de Asignar Gastos Generales a Obra */}
      {mostrarModalAsignarGastos && obraParaAsignarGastos && (
        <AsignarOtroCostoObraModal
          show={mostrarModalAsignarGastos}
          onClose={async () => {
            // ?? Si es trabajo extra, recargar trabajos extra ANTES de cerrar
            if (obraParaAsignarGastos?._esTrabajoExtra && obraParaTrabajosExtra) {
              console.log('?? [Gastos] Recargando trabajos extra para actualizar badges...', {
                trabajoExtraId: obraParaAsignarGastos.id,
                // Si estamos dentro de un trabajo extra, usar el ID de la obra original
                obraId: obraParaTrabajosExtra._obraOriginalId || obraParaTrabajosExtra.id
              });
              await cargarTrabajosExtra(obraParaTrabajosExtra);
              console.log('? [Gastos] Trabajos extra recargados');
            }
            setMostrarModalAsignarGastos(false);
            setObraParaAsignarGastos(null);
          }}
          obra={obraParaAsignarGastos}
          configuracionObra={
            // Si es trabajo extra, usar la configuraci?n que viene en el objeto
            // Si es obra regular, buscar en la base de datos
            obraParaAsignarGastos._esTrabajoExtra
              ? obraParaAsignarGastos.configuracionPlanificacion
              : obtenerConfiguracionObra(obraParaAsignarGastos?.id)
          }
          onAsignacionExitosa={async () => {
            showNotification('? Gastos generales asignados correctamente', 'success');
            // ?? Si es trabajo extra, recargar trabajos extra; si es obra normal, recargar contadores
            if (obraParaAsignarGastos?._esTrabajoExtra && obraParaTrabajosExtra) {
              console.log('?? [Gastos Success] Recargando trabajos extra para actualizar badges...', {
                trabajoExtraId: obraParaAsignarGastos.id,
                // Si estamos dentro de un trabajo extra, usar el ID de la obra original
                obraId: obraParaTrabajosExtra._obraOriginalId || obraParaTrabajosExtra.id
              });
              await cargarTrabajosExtra(obraParaTrabajosExtra);
              console.log('? [Gastos Success] Trabajos extra recargados');
            } else if (obraParaAsignarGastos?.id) {
              const obraIdReal = obraParaAsignarGastos.obraId || obraParaAsignarGastos.id;
              cargarContadoresObra(obraIdReal);
            }
            cargarObrasSegunFiltro();
          }}
        />
      )}

      {/* Modal Editar Presupuesto */}
      {mostrarModalEditarPresupuesto && presupuestoParaEditar && (
        <PresupuestoNoClienteModal
          show={mostrarModalEditarPresupuesto}
          tituloPersonalizado={(() => {
            const tipo = presupuestoParaEditar.tipoPresupuesto;
            const nombreObra = presupuestoParaEditar.nombreObra || presupuestoParaEditar.nombreObraManual || 'Obra';

            if (tipo === 'TRABAJO_DIARIO') {
              return `Editar Presupuesto para Trabajo Diario -- ${nombreObra}`;
            } else if (tipo === 'TAREA_LEVE') {
              return `Editar Tarea Leve para: ${nombreObra}`;
            } else if (tipo === 'TRABAJO_EXTRA') {
              return `Editar Presupuesto para Adicional Obra -- ${nombreObra}`;
            } else {
              return `Editar Presupuesto para Obra Principal`;
            }
          })()}
          onClose={() => {
            setMostrarModalEditarPresupuesto(false);
            setPresupuestoParaEditar(null);
          }}
          onSave={async (presupuesto) => {
            console.log('?? Presupuesto guardado desde modal edici?n:', presupuesto);

            // Si es un presupuesto APROBADO y tiene obraId, buscar la versi?n anterior y marcarla como MODIFICADO
            if (
              presupuesto &&
              (presupuesto.estado === 'APROBADO' || presupuesto.estado === 'EN_EJECUCI�N' || presupuesto.estado === 'EN_EJECUCION') &&
              presupuesto.obraId &&
              (presupuesto.numeroVersion || presupuesto.version) > 1
            ) {
              try {
                // Buscar la versi?n anterior en el estado local
                const versionesObra = Object.values(presupuestosObras).filter(
                  p => (p.obraId === presupuesto.obraId || p.idObra === presupuesto.obraId)
                );
                const versionActual = presupuesto.numeroVersion || presupuesto.version;
                const anterior = versionesObra.find(
                  p => (p.numeroVersion || p.version) === versionActual - 1
                );
                if (anterior && anterior.id) {
                  console.log('?? Marcando versi?n anterior como MODIFICADO:', anterior.id);
                  await api.presupuestosNoCliente.actualizarEstado(anterior.id, 'MODIFICADO', empresaId);
                }
              } catch (err) {
                console.warn(' No se pudo marcar la versi?n anterior como MODIFICADO:', err);
              }
            }

            try {
              // ? CASO ESPECIAL: Edici?n solo de fechas (cualquier estado)
              if (presupuesto._editarSoloFechas === true) {
                console.log('?? FLUJO EDITAR SOLO FECHAS - Iniciando desde ObrasPage...');
                console.log('?? Presupuesto ID:', presupuesto.id);
                console.log('?? Nueva fechaProbableInicio:', presupuesto.fechaProbableInicio);
                console.log('?? Nuevo tiempoEstimadoTerminacion:', presupuesto.tiempoEstimadoTerminacion);

                try {
                  // ? Usar endpoint espec?fico para actualizar solo fechas (PATCH /fechas)
                  const datosActualizarFechas = {
                    fechaProbableInicio: presupuesto.fechaProbableInicio,
                    tiempoEstimadoTerminacion: presupuesto.tiempoEstimadoTerminacion
                  };

                  console.log('?? Enviando PATCH /fechas al backend - ID:', presupuesto.id);
                  await api.presupuestosNoCliente.actualizarSoloFechas(presupuesto.id, datosActualizarFechas, empresaId);
                  console.log('? PATCH /fechas completado exitosamente');

                  showNotification(
                    '? Fechas actualizadas exitosamente.\nVersi?n y estado preservados.',
                    'success'
                  );
                } catch (error) {
                  const mensaje = error.response?.data?.mensaje || error.message || 'Error al actualizar fechas';
                  showNotification(
                    `? Error al actualizar fechas:\n\n${mensaje}`,
                    'error'
                  );
                  return; // Salir sin cerrar el modal si hay error
                }
              } else {
                // Guardado normal (actualizar presupuesto completo)
                console.log('?? FLUJO GUARDADO NORMAL - Actualizando presupuesto completo...');

                try {
                  // ?? ACTUALIZADO: Ya NO crear nuevas versiones, siempre actualizar la existente
                  // Esto mantiene consistencia y evita problemas de datos vac?os
                  console.log('?? Actualizando presupuesto sin crear nueva versi?n...');
                  await api.presupuestosNoCliente.update(presupuesto.id, presupuesto, empresaId);
                  console.log(`? Presupuesto v${presupuesto.numeroVersion || presupuesto.version || 1} actualizado exitosamente`);

                  showNotification('? Presupuesto guardado exitosamente - Todos los datos se mantuvieron', 'success');

                  // ?? Recargar obras - Usar fetchObrasPorEmpresa en lugar de funci?n no definida
                  // await dispatch(fetchPresupuestosObras(empresaId)); // ? No existe
                  await dispatch(fetchObrasPorEmpresa(empresaId));
                  console.log('? Obras recargadas exitosamente');
                } catch (error) {
                  console.error('? Error guardando presupuesto:', error);
                  console.error('? Error response:', error.response?.data);
                  console.error('? Error status:', error.response?.status);
                  console.error('? Error message:', error.message);

                  let mensajeError = 'Error desconocido';
                  if (error.response?.data?.mensaje) {
                    mensajeError = error.response.data.mensaje;
                  } else if (error.response?.data?.error) {
                    mensajeError = error.response.data.error;
                  } else if (error.message) {
                    mensajeError = error.message;
                  }

                  showNotification(`? Error al guardar presupuesto: ${mensajeError}`, 'error');
                  return; // Salir sin cerrar el modal si hay error
                }

                // AUTO-GENERAR OBRA SI EL PRESUPUESTO ESTA APROBADO
                if (presupuesto.estado === 'APROBADO') {
                  console.log('=== PRESUPUESTO APROBADO DETECTADO ===');
                  console.log('Tipo presupuesto:', presupuesto.tipoPresupuesto);
                  console.log('esPresupuestoTrabajoExtra:', presupuesto.esPresupuestoTrabajoExtra);
                  console.log('Presupuesto ID:', presupuesto.id);

                  try {
                    // Buscar si ya existe una obra con este presupuestoOriginalId
                    const obrasExistentes = await api.obras.obtenerObras({ empresaId });
                    const yaExisteObra = obrasExistentes?.data?.some(o => o.presupuestoOriginalId === presupuesto.id);

                    if (!yaExisteObra) {
                      console.log('✅ No existe obra para este presupuesto - Creando automáticamente...');

                      let obraData = null;

                      // 🎯 TRABAJO_EXTRA o TAREA_LEVE: Crear obra derivada de obra padre
                      if (presupuesto.tipoPresupuesto === 'TRABAJO_EXTRA' || presupuesto.tipoPresupuesto === 'TAREA_LEVE') {
                        console.log('📦 Creando obra desde ' + presupuesto.tipoPresupuesto);

                        // Obtener información de la obra padre si está disponible
                        let clienteIdFinal = presupuesto.clienteId;
                        if (!clienteIdFinal && presupuesto.idObraPadre) {
                          try {
                            const obraPadre = await api.obras.obtenerPorId(presupuesto.idObraPadre, empresaId);
                            clienteIdFinal = obraPadre?.data?.clienteId || obraPadre?.clienteId;
                            console.log('🔗 Cliente obtenido de obra padre:', clienteIdFinal);
                          } catch (err) {
                            console.warn('⚠️ No se pudo obtener cliente de obra padre:', err);
                          }
                        }

                        obraData = {
                          nombre: presupuesto.nombreObra || presupuesto.nombreObraManual || `${presupuesto.tipoPresupuesto} #${presupuesto.id}`,
                          direccion: presupuesto.direccionObraCalle || 'Dirección no especificada',
                          direccionObraCalle: presupuesto.direccionObraCalle || '',
                          direccionObraAltura: presupuesto.direccionObraAltura || '',
                          direccionObraBarrio: presupuesto.direccionObraBarrio || '',
                          direccionObraLocalidad: presupuesto.direccionObraLocalidad || '',
                          direccionObraProvincia: presupuesto.direccionObraProvincia || '',
                          direccionObraCodigoPostal: presupuesto.direccionObraCodigoPostal || '',
                          fechaProbableInicio: presupuesto.fechaProbableInicio || new Date().toISOString().split('T')[0],
                          idEmpresa: empresaId,
                          clienteId: clienteIdFinal,
                          estado: 'APROBADO',
                          esTrabajoExtra: true,
                          obraPadreId: presupuesto.idObraPadre || presupuesto.obraId,
                          nombreSolicitante: presupuesto.nombreSolicitante || '',
                          telefono: presupuesto.telefono || '',
                          mail: presupuesto.mail || '',
                          presupuestoOriginalId: presupuesto.id,
                          observaciones: `Obra generada automáticamente desde ${presupuesto.tipoPresupuesto} aprobado #${presupuesto.id}.\n${presupuesto.observaciones || ''}`
                        };
                      }
                      // 🎯 PRINCIPAL o TRABAJO_DIARIO: Crear obra nueva independiente
                      else if (presupuesto.tipoPresupuesto === 'PRINCIPAL' || presupuesto.tipoPresupuesto === 'TRABAJO_DIARIO') {
                        console.log('📦 Creando obra desde ' + presupuesto.tipoPresupuesto);

                        obraData = {
                          nombre: presupuesto.nombreObra || presupuesto.nombreObraManual || `${presupuesto.tipoPresupuesto} #${presupuesto.id}`,
                          direccion: presupuesto.direccionObraCalle || 'Dirección no especificada',
                          direccionObraCalle: presupuesto.direccionObraCalle || '',
                          direccionObraAltura: presupuesto.direccionObraAltura || '',
                          direccionObraBarrio: presupuesto.direccionObraBarrio || '',
                          direccionObraLocalidad: presupuesto.direccionObraLocalidad || '',
                          direccionObraProvincia: presupuesto.direccionObraProvincia || '',
                          direccionObraCodigoPostal: presupuesto.direccionObraCodigoPostal || '',
                          fechaProbableInicio: presupuesto.fechaProbableInicio || new Date().toISOString().split('T')[0],
                          idEmpresa: empresaId,
                          clienteId: presupuesto.clienteId,
                          estado: 'APROBADO',
                          nombreSolicitante: presupuesto.nombreSolicitante || '',
                          telefono: presupuesto.telefono || '',
                          mail: presupuesto.mail || '',
                          presupuestoOriginalId: presupuesto.id,
                          observaciones: `Obra generada automáticamente desde ${presupuesto.tipoPresupuesto} aprobado #${presupuesto.id}.\n${presupuesto.observaciones || ''}`
                        };
                      }

                      if (obraData) {
                        console.log('🏗️ Datos de obra a crear:', obraData);
                        const obraCreada = await dispatch(createObra({ obra: obraData, empresaId })).unwrap();
                        console.log('✅ Obra creada automáticamente:', obraCreada);

                        showNotification('✅ Presupuesto aprobado y obra creada automáticamente', 'success');

                        // Recargar obras
                        await dispatch(fetchObrasPorEmpresa(empresaId));
                      } else {
                        console.warn('⚠️ Tipo de presupuesto no reconocido para crear obra:', presupuesto.tipoPresupuesto);
                      }
                    } else {
                      console.log('ℹ️ Ya existe una obra para este presupuesto - No se crea duplicada');
                    }
                  } catch (errorObra) {
                    console.error('❌ Error al crear obra automáticamente:', errorObra);
                    showNotification(
                      '⚠️ Presupuesto guardado pero error al crear obra: ' + (errorObra.message || 'Error desconocido'),
                      'warning'
                    );
                  }
                }
              }

              setMostrarModalEditarPresupuesto(false);
              setPresupuestoParaEditar(null);
            } catch (error) {
              console.error('? Error en onSave:', error);
              showNotification('Error al guardar presupuesto: ' + (error.message || 'Error desconocido'), 'error');
              return;
            }

            // Actualizar el presupuesto en el estado local
            if (presupuesto && presupuesto.obraId) {
              console.log('?? Actualizando presupuestosObras para obra:', presupuesto.obraId);
              setPresupuestosObras(prev => {
                const nuevo = {
                  ...prev,
                  [presupuesto.obraId]: presupuesto
                };
                console.log('� presupuestosObras actualizado:', nuevo);
                return nuevo;
              });

              // Si hay etapas diarias abiertas de esta obra, actualizar inmediatamente
              if (obraParaEtapasDiarias && obraParaEtapasDiarias.id === presupuesto.obraId && !obraParaEtapasDiarias._esTrabajoExtra) {
                console.log(' Etapas diarias abiertas (OBRA NORMAL), actualizando presupuesto en el estado...');
                setObraParaEtapasDiarias(prev => {
                  const actualizada = {
                    ...prev,
                    presupuestoNoCliente: presupuesto
                  };
                  console.log(' ObraParaEtapasDiarias actualizada:', actualizada);
                  return actualizada;
                });
                // Incrementar contador para forzar regeneraci?n del calendario
                setCalendarioVersion(v => {
                  console.log(' Incrementando calendarioVersion:', v, '���', v + 1);
                  return v + 1;
                });
              } else if (obraParaEtapasDiarias && obraParaEtapasDiarias.id === presupuesto.obraId && obraParaEtapasDiarias._esTrabajoExtra) {
                console.log('?? [eventBus] BLOQUEANDO actualizaci?n de presupuesto para TRABAJO EXTRA - manteniendo presupuestoNoCliente intacto');
              }
            } else {
              console.warn('�� Presupuesto sin obraId:', presupuesto);
            }

            // Recargar la lista de presupuestos de la obra si est? abierta
            if (obraParaPresupuestos) {
              await handleVerPresupuestosObra(obraParaPresupuestos);
            }
          }}
          initialData={presupuestoParaEditar}
          saving={false}
          readOnly={false}
        />
      )}

      {/* Modal Detalle de Presupuesto */}
      {mostrarModalDetallePresupuesto && presupuestoDetalle && (
        <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-xl">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="fas fa-file-invoice-dollar me-2"></i>
                  Detalle del Presupuesto #{presupuestoDetalle.numeroPresupuesto} v{presupuestoDetalle.numeroVersion || presupuestoDetalle.version || 1}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => {
                    setMostrarModalDetallePresupuesto(false);
                    setPresupuestoDetalle(null);
                  }}
                />
              </div>
              <div className="modal-body">
                {/* Informaci?n General */}
                <div className="row mb-4">
                  <div className="col-md-6">
                    <div className="card">
                      <div className="card-header bg-light">
                        <h6 className="mb-0"><i className="fas fa-info-circle me-2"></i>Informaci?n General</h6>
                      </div>
                      <div className="card-body">
                        <table className="table table-sm">
                          <tbody>
                            <tr>
                              <td className="fw-bold">N?mero Presupuesto:</td>
                              <td>{presupuestoDetalle.numeroPresupuesto}</td>
                            </tr>
                            <tr>
                              <td className="fw-bold">Versi?n:</td>
                              <td>
                                <span className="badge bg-info">
                                  v{presupuestoDetalle.numeroVersion || presupuestoDetalle.version || 1}
                                </span>
                              </td>
                            </tr>
                            <tr>
                              <td className="fw-bold">Estado:</td>
                              <td>
                                <span className={`badge ${
                                  presupuestoDetalle.estado === 'APROBADO' ? 'bg-success' :
                                  presupuestoDetalle.estado === 'MODIFICADO' ? 'bg-dark' :
                                  presupuestoDetalle.estado === 'ENVIADO' ? 'bg-primary' :
                                  'bg-secondary'
                                }`}>
                                  {presupuestoDetalle.estado}
                                </span>
                              </td>
                            </tr>
                            <tr>
                              <td className="fw-bold">Fecha Emisi?n:</td>
                              <td>{presupuestoDetalle.fechaEmision ? new Date(presupuestoDetalle.fechaEmision).toLocaleDateString() : 'N/A'}</td>
                            </tr>
                            <tr>
                              <td className="fw-bold">Vencimiento:</td>
                              <td>{presupuestoDetalle.vencimiento ? new Date(presupuestoDetalle.vencimiento).toLocaleDateString() : 'N/A'}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="card">
                      <div className="card-header bg-light">
                        <h6 className="mb-0"><i className="fas fa-building me-2"></i>Obra y Cliente</h6>
                      </div>
                      <div className="card-body">
                        <table className="table table-sm">
                          <tbody>
                            <tr>
                              <td className="fw-bold">Obra:</td>
                              <td>{presupuestoDetalle.nombreObra || 'N/A'}</td>
                            </tr>
                            <tr>
                              <td className="fw-bold">Direcci?n:</td>
                              <td>
                                {presupuestoDetalle.direccionObraCalle && presupuestoDetalle.direccionObraAltura
                                  ? `${presupuestoDetalle.direccionObraCalle} ${presupuestoDetalle.direccionObraAltura}`
                                  : 'N/A'}
                              </td>
                            </tr>
                            <tr>
                              <td className="fw-bold">Cliente:</td>
                              <td>{presupuestoDetalle.nombreCliente || 'Sin cliente'}</td>
                            </tr>
                            <tr>
                              <td className="fw-bold">Tiempo Estimado:</td>
                              <td>
                                {presupuestoDetalle.tiempoEstimadoTerminacion
                                  ? `${presupuestoDetalle.tiempoEstimadoTerminacion} d?as`
                                  : 'No especificado'}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Totales */}
                <div className="card mb-3">
                  <div className="card-header bg-success text-white">
                    <h6 className="mb-0"><i className="fas fa-dollar-sign me-2"></i>Totales</h6>
                  </div>
                  <div className="card-body">
                    <div className="row text-center">
                      <div className="col-md-3">
                        <h6 className="text-muted small">Total General</h6>
                        <h4 className="text-success">${(presupuestoDetalle.totalGeneral || 0).toLocaleString()}</h4>
                      </div>
                      <div className="col-md-3">
                        <h6 className="text-muted small">Materiales</h6>
                        <h5>${(presupuestoDetalle.totalMateriales || 0).toLocaleString()}</h5>
                      </div>
                      <div className="col-md-3">
                        <h6 className="text-muted small">Profesionales</h6>
                        <h5>${(presupuestoDetalle.totalProfesionales || 0).toLocaleString()}</h5>
                      </div>
                      <div className="col-md-3">
                        <h6 className="text-muted small">Honorarios</h6>
                        <h5>${(presupuestoDetalle.totalHonorariosCalculado || 0).toLocaleString()}</h5>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Observaciones */}
                {presupuestoDetalle.observaciones && (
                  <div className="card">
                    <div className="card-header bg-light">
                      <h6 className="mb-0"><i className="fas fa-sticky-note me-2"></i>Observaciones</h6>
                    </div>
                    <div className="card-body">
                      <p className="mb-0">{presupuestoDetalle.observaciones}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarModalDetallePresupuesto(false);
                    setPresupuestoDetalle(null);
                  }}
                >
                  <i className="fas fa-times me-2"></i>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Enviar Presupuesto (sin navegar de p?gina) */}
      {mostrarModalEnviarPresupuesto && presupuestoParaEnviar && (
        <PresupuestoNoClienteModal
          show={mostrarModalEnviarPresupuesto}
          onClose={() => {
            setMostrarModalEnviarPresupuesto(false);
            setPresupuestoParaEnviar(null);
          }}
          onSave={async (presupuesto) => {
            console.log('?? Presupuesto enviado:', presupuesto);
            setMostrarModalEnviarPresupuesto(false);
            setPresupuestoParaEnviar(null);
            showNotification('? Presupuesto enviado exitosamente', 'success');

            // Recargar obras para actualizar estados
            cargarObrasSegunFiltro();
          }}
          initialData={presupuestoParaEnviar}
          showDownloadPdfButton={true}  // ?? Mostrar bot?n "Descargar PDF" y auto-scroll
        />
      )}

      {/* Modal Trabajo Extra */}
      {mostrarModalTrabajoExtra && obraParaTrabajosExtra && (
        <PresupuestoNoClienteModal
          show={mostrarModalTrabajoExtra}
          onClose={() => {
            setMostrarModalTrabajoExtra(false);
            setTrabajoExtraEditar(null);
            setAutoGenerarPDFTrabajoExtra(false);
            setAbrirWhatsAppTrabajoExtra(false);
            setAbrirEmailTrabajoExtra(false);
          }}
          modoTrabajoExtra={true}
          tituloPersonalizado={`${trabajoExtraEditar?.id ? 'Editar' : 'Nuevo'} Presupuesto para Adicional Obra -- ${trabajoExtraEditar?.nombreObra || trabajoExtraEditar?.nombre || obraParaTrabajosExtra.nombre || obraParaTrabajosExtra.nombreObra || 'Obra'}`}
          autoGenerarPDF={autoGenerarPDFTrabajoExtra}
          abrirWhatsAppDespuesDePDF={abrirWhatsAppTrabajoExtra}
          abrirEmailDespuesDePDF={abrirEmailTrabajoExtra}
          onPDFGenerado={() => {
            console.log('? PDF generado para trabajo extra, cerrando modal...');
            console.log('?? Iniciando recarga de trabajos extra despu?s del env?o...');

            //  NO actualizar el estado aqu? - ya lo hace marcarTrabajoExtraComoEnviado() dentro del modal
            // Si se hace aqu?, sobrescribe el cambio de estado con el objeto viejo (estado A_ENVIAR)

            showNotification('? Trabajo extra enviado exitosamente', 'success');

            setAutoGenerarPDFTrabajoExtra(false);
            setAbrirWhatsAppTrabajoExtra(false);
            setAbrirEmailTrabajoExtra(false);
            setMostrarModalTrabajoExtra(false);
            setTrabajoExtraEditar(null);

            // Recargar trabajos extra para reflejar el cambio de estado
            console.log('?? Llamando cargarTrabajosExtra para refrescar despu?s del env?o...');
            cargarTrabajosExtra(obraParaTrabajosExtra);
            console.log('? Recarga de trabajos extra completada');
          }}
          initialData={{
            // ? Pasar TODOS los datos del trabajo extra (para incluir campos planos como los de honorarios)
            ...(trabajoExtraEditar || {}),

            // Usar el id propio del PresupuestoNoCliente (id_trabajo_extra puede apuntar a un
            // presupuesto distinto, como el de la obra principal, causando el bug de mostrar el
            // presupuesto incorrecto)
            id: trabajoExtraEditar?.id || null,

            // IDs y empresa
            // Si estamos dentro de un trabajo extra, usar el ID de la obra original
            obraId: obraParaTrabajosExtra._obraOriginalId || obraParaTrabajosExtra.id,
            idObra: obraParaTrabajosExtra._obraOriginalId || obraParaTrabajosExtra.id,
            clienteId: obraParaTrabajosExtra.clienteId || null,
            idEmpresa: empresaSeleccionada.id,
            nombreEmpresa: empresaSeleccionada.nombreEmpresa,

            // ?? CR�TICO: Marcar como trabajo extra
            esPresupuestoTrabajoExtra: true,

            // ?? Si estamos creando un trabajo extra dentro de otro trabajo extra (subobra),
            // pasar el ID del trabajo extra padre para excluirlo de la lista
            _trabajoExtraPadreId: obraParaTrabajosExtra._trabajoExtraId || null,

            // Si est? editando, usar datos del trabajo extra; si no, usar datos de la obra
            nombreObraManual: trabajoExtraEditar?.nombreObra || trabajoExtraEditar?.nombre || obraParaTrabajosExtra.nombre || '',
            nombreObra: trabajoExtraEditar?.nombreObra || trabajoExtraEditar?.nombre || obraParaTrabajosExtra.nombre || '',
            descripcion: '',
            observaciones: trabajoExtraEditar?.observaciones || '',

            // Direcci?n completa de la obra
            direccionObraCalle: obraParaTrabajosExtra.direccionObraCalle || 'Calle gen?rica',
            direccionObraAltura: obraParaTrabajosExtra.direccionObraAltura || 'S/N',
            direccionObraBarrio: obraParaTrabajosExtra.direccionObraBarrio || '',
            direccionObraTorre: obraParaTrabajosExtra.direccionObraTorre || '',
            direccionObraPiso: obraParaTrabajosExtra.direccionObraPiso || '',
            direccionObraDepartamento: obraParaTrabajosExtra.direccionObraDepartamento || '',
            direccionObraLocalidad: obraParaTrabajosExtra.direccionObraLocalidad || '',
            direccionObraProvincia: obraParaTrabajosExtra.direccionObraProvincia || '',
            direccionObraCodigoPostal: obraParaTrabajosExtra.direccionObraCodigoPostal || '',

            // Datos del solicitante (si existen en la obra)
            nombreSolicitante: obraParaTrabajosExtra.nombreSolicitante || '',
            telefono: obraParaTrabajosExtra.telefono || '',
            direccionParticular: obraParaTrabajosExtra.direccionParticular || '',
            mail: obraParaTrabajosExtra.mail || '',

            // Fechas - usar las del trabajo extra si est? editando, sino las actuales
            fechaCreacion: trabajoExtraEditar?.fechaCreacion?.split('T')[0] || new Date().toISOString().slice(0, 10),
            fechaEmision: trabajoExtraEditar?.fechaCreacion?.split('T')[0] || new Date().toISOString().slice(0, 10),
            vencimiento: new Date().toISOString().slice(0, 10),
            fechaProbableInicio: trabajoExtraEditar?.fechaProbableInicio?.split('T')[0] || '',

            // Estado y versi?n - usar el del trabajo extra si existe, sino BORRADOR por defecto
            estado: trabajoExtraEditar?.estado || 'BORRADOR',
            version: trabajoExtraEditar?.version || 1,

            // Tiempo estimado - usar el del trabajo extra si existe
            tiempoEstimadoTerminacion: trabajoExtraEditar?.tiempoEstimadoTerminacion || null,
            calculoAutomaticoDiasHabiles: false,

            // Tipo de presupuesto
            tipoPresupuesto: trabajoExtraEditar?.tipoPresupuesto || 'TRABAJO_EXTRA',

            // Si est? editando, pasar TODOS los datos del trabajo extra
            ...(trabajoExtraEditar && {
              // ? Pasar itemsCalculadora directamente desde el trabajo extra (incluye rubros con jornales)
              itemsCalculadora: trabajoExtraEditar.itemsCalculadora || [],

              // ? Pasar honorarios si existen
              honorarios: trabajoExtraEditar.honorarios || undefined,

              // ? Pasar mayores costos si existen
              mayoresCostos: trabajoExtraEditar.mayoresCostos || undefined,

              // ? Pasar profesionales legacy si existen (compatibilidad)
              profesionales: trabajoExtraEditar.profesionales || [],

              // ? Pasar materiales si existen
              materiales: trabajoExtraEditar.materiales || [],

              // ? Pasar otros costos si existen
              otrosCostos: trabajoExtraEditar.otrosCostos || []
            })
          }}
          onSave={handleGuardadoTrabajoExtra}
        />
      )}

      {/* Modal Seleccionar Obra para Trabajos Extra */}
      {mostrarModalSeleccionarObraTrabajosExtra && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="fas fa-tools me-2"></i>Seleccionar Obra para Trabajos Extra
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setMostrarModalSeleccionarObraTrabajosExtra(false);
                    setObraSeleccionadaTrabajosExtra(null);
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Empresa</label>
                  <input
                    type="text"
                    className="form-control"
                    value={empresaSeleccionada?.nombreEmpresa || empresaSeleccionada?.nombre || ''}
                    disabled
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Obra *</label>
                  <select
                    className="form-select"
                    value={obraSeleccionadaTrabajosExtra?.id || ''}
                    onChange={(e) => {
                      const obra = obras.find(o => o.id === Number(e.target.value));
                      setObraSeleccionadaTrabajosExtra(obra || null);
                    }}
                  >
                    <option value="">
                      {obras.length === 0 ? 'No hay obras disponibles' : 'Seleccione una obra...'}
                    </option>
                    {obras.map((obra) => (
                      <option key={obra.id} value={obra.id}>
                        {obra.nombre || obra.direccion || `Obra #${obra.id}`}
                      </option>
                    ))}
                  </select>
                </div>

                {obraSeleccionadaTrabajosExtra && (
                  <div className="alert alert-info">
                    <strong>Obra seleccionada:</strong><br/>
                    <strong>Nombre:</strong> {obraSeleccionadaTrabajosExtra.nombre}<br/>
                    <strong>Direcci?n:</strong> {obraSeleccionadaTrabajosExtra.direccion}<br/>
                    <strong>Estado:</strong> {obraSeleccionadaTrabajosExtra.estado}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarModalSeleccionarObraTrabajosExtra(false);
                    setObraSeleccionadaTrabajosExtra(null);
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSeleccionarObraParaTrabajosExtra}
                  disabled={!obraSeleccionadaTrabajosExtra}
                >
                  <i className="fas fa-check me-2"></i>Continuar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Etapa Diaria */}
      {mostrarModalEtapaDiaria && obraParaEtapasDiarias && (
        <EtapaDiariaModal
          show={mostrarModalEtapaDiaria}
          onClose={() => {
            setMostrarModalEtapaDiaria(false);
            setEtapaDiariaEditar(null);
          }}
          obra={obraParaEtapasDiarias}
          configuracionObra={
            obraParaEtapasDiarias._esTrabajoExtra && obraParaEtapasDiarias.configuracionPlanificacion
              ? obraParaEtapasDiarias.configuracionPlanificacion
              : obtenerConfiguracionObra(obraParaEtapasDiarias.id)
          }
          etapaDiariaInicial={etapaDiariaEditar}
          onGuardado={handleGuardadoEtapaDiaria}
          etapasExistentes={etapasDiarias}
        />
      )}

      {/* Panel de Debug - Solo en desarrollo */}
      {false && obraParaEtapasDiarias && (
        <DebugPanel
          title="Etapas Diarias Debug"
          data={{
            obraId: obraParaEtapasDiarias.id,
            obraNombre: obraParaEtapasDiarias.direccion,
            totalEtapas: etapasDiarias.length,
            etapas: etapasDiarias.map(e => ({
              id: e.id,
              fecha: e.fecha,
              descripcion: e.descripcion,
              estado: e.estado,
              tareas: e.tareas?.map(t => ({
                id: t.id,
                descripcion: t.descripcion,
                estado: t.estado,
                profesionales: t.profesionales || [] // Mostrar array completo en vez de solo el count
              })) || []
            }))
          }}
        />
      )}

      {/* Modal Detalle D?a */}
      {mostrarModalDetalleDia && diaSeleccionado && (
        <ModalDetalleDia
          show={mostrarModalDetalleDia}
          onClose={() => {
            setMostrarModalDetalleDia(false);
            setDiaSeleccionado(null);
          }}
          diaData={diaSeleccionado}
          obra={obraParaEtapasDiarias}
          onActualizar={() => {
            // Recargar las etapas despu?s de actualizar
            if (obraParaEtapasDiarias) {
              cargarEtapasDiarias(obraParaEtapasDiarias);
            }
          }}
        />
      )}

      {/* Modal de Configuraci?n Global de Obra */}
      {mostrarModalConfiguracionObra && obraParaConfigurar && (
        <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="fas fa-calendar-plus me-2"></i>
                  Configurar Planificaci?n de Obra
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => {
                    setMostrarModalConfiguracionObra(false);
                    setObraParaConfigurar(null);
                    // Resetear configuraci?n cuando se cierre el modal
                    setConfiguracionObra({
                      semanasObjetivo: '',
                      diasHabiles: 0,
                      capacidadNecesaria: 0,
                      fechaInicio: '',
                      fechaFinEstimada: null,
                      jornalesTotales: 0,
                      presupuestoSeleccionado: null,
                      fechaProbableInicioInput: '',
                      modalVisible: false
                    });
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <h6 className="text-primary">
                    <i className="fas fa-building me-2"></i>
                    {obraParaConfigurar.nombre}
                  </h6>
                  <small className="text-muted">
                    <i className="fas fa-map-marker-alt me-1"></i>
                    {formatearDireccionObra(obraParaConfigurar)}
                  </small>
                </div>

                <div className="alert alert-info">
                  <strong>?? Informaci?n del presupuesto:</strong>
                  {configuracionObra.presupuestoSeleccionado && (
                    <div className="mb-2 mt-2">
                      <small className="text-info d-block">
                        <strong>Presupuesto #{configuracionObra.presupuestoSeleccionado.id}</strong>
                        {' '}(Estado: {configuracionObra.presupuestoSeleccionado.estado}, v{configuracionObra.presupuestoSeleccionado.version || configuracionObra.presupuestoSeleccionado.numeroVersion || 1})
                      </small>
                    </div>
                  )}
                  <ul className="mb-0 mt-2">
                    <li>Jornales totales necesarios: <strong>{configuracionObra.jornalesTotales?.toFixed(2) || '0.00'}</strong></li>
                    <li>Fecha de inicio: <strong>
                      {configuracionObra.fechaInicio ?
                        parsearFechaLocal(configuracionObra.fechaInicio).toLocaleDateString('es-AR') :
                        'No definida'}
                    </strong></li>
                    {configuracionObra.presupuestoSeleccionado?.totalFinal && (
                      <li>Total del presupuesto: <strong>${(configuracionObra.presupuestoSeleccionado.totalConDescuentos || configuracionObra.presupuestoSeleccionado.totalFinal).toLocaleString()}</strong></li>
                    )}
                    {configuracionObra.presupuestoSeleccionado?.tiempoEstimadoTerminacion && (
                      <li>Tiempo estimado (d?as): <strong>{configuracionObra.presupuestoSeleccionado.tiempoEstimadoTerminacion} d?as</strong></li>
                    )}
                  </ul>
                </div>

                {/* Campo para editar fecha probable de inicio */}
                {(!configuracionObra.presupuestoSeleccionado?.fechaProbableInicio || configuracionObra.presupuestoSeleccionado?.fechaProbableInicio === '') && (
                  <div className="alert alert-warning">
                    <h6 className="text-warning mb-2">
                      <i className="fas fa-exclamation-triangle me-2"></i>
                      Configurar Fecha de Inicio
                    </h6>
                    <p className="mb-2">El presupuesto no tiene fecha probable de inicio. Config?rala para continuar:</p>
                    <div className="row">
                      <div className="col-md-6">
                        <label className="form-label">
                          <i className="fas fa-calendar-alt me-2"></i>
                          Fecha probable de inicio
                        </label>
                        <input
                          type="date"
                          className="form-control"
                          value={configuracionObra.fechaProbableInicioInput || ''}
                          onChange={(e) => setConfiguracionObra(prev => ({
                            ...prev,
                            fechaProbableInicioInput: e.target.value
                          }))}
                        />
                        <small className="text-muted">Esta fecha se guardar? en el presupuesto</small>
                      </div>
                    </div>
                  </div>
                )}

                {/* Configuraci?n de duraci?n de la obra */}
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">
                      <i className="fas fa-calendar-day me-2"></i>
                      D?as h?biles para finalizar la obra
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      min="1"
                      placeholder="Ej: 20 d?as h?biles"
                      value={configuracionObra.diasHabiles > 0 ? configuracionObra.diasHabiles : ''}
                      onChange={(e) => setConfiguracionObra(prev => ({
                        ...prev,
                        diasHabiles: e.target.value ? parseInt(e.target.value) || 0 : 0
                      }))}
                    />
                    {configuracionObra.presupuestoSeleccionado?.tiempoEstimadoTerminacion && (
                      <small className="text-info form-text">
                        <i className="fas fa-info-circle me-1"></i>
                        El presupuesto estima {configuracionObra.presupuestoSeleccionado.tiempoEstimadoTerminacion} d?as h?biles. Puedes ajustarlo seg?n las condiciones reales.
                      </small>
                    )}
                  </div>

                  {configuracionObra.diasHabiles > 0 && (
                    <div className="col-md-6">
                      <label className="form-label text-success">
                        <i className="fas fa-calculator me-2"></i>
                        Resumen de planificaci?n
                      </label>
                      <div className="bg-light p-3 rounded">
                        <div className="row text-center">
                          <div className="col-4">
                            <div className="h6 text-primary mb-0">{configuracionObra.diasHabiles}</div>
                            <small className="text-muted">D?as h?biles</small>
                          </div>
                          <div className="col-4">
                            <div className="h6 text-info mb-0">{Math.ceil(configuracionObra.diasHabiles / 5)}</div>
                            <small className="text-muted">Semanas aprox.</small>
                          </div>
                          <div className="col-4">
                            <div className="h6 text-success mb-0">
                              {configuracionObra.jornalesTotales > 0 ?
                                Math.ceil(configuracionObra.jornalesTotales / configuracionObra.diasHabiles) :
                                0
                              }
                            </div>
                            <small className="text-muted">Trabajadores/d?a</small>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Resumen autom?tico basado en el presupuesto */}
                {configuracionObra.diasHabiles > 0 && (
                  <div className="alert alert-success mt-3">
                    <strong>? Configuraci?n de obra:</strong>
                    <ul className="mb-0 mt-2">
                      <li><strong>{configuracionObra.diasHabiles} d?as h?biles</strong> de trabajo efectivo</li>
                      <li><strong>{Math.ceil(configuracionObra.diasHabiles / 5)} semanas</strong> aproximadas de duraci?n</li>
                      {configuracionObra.jornalesTotales > 0 && (
                        <li><strong>{Math.ceil(configuracionObra.jornalesTotales / configuracionObra.diasHabiles)} trabajadores/d?a</strong> promedio necesarios</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setMostrarModalConfiguracionObra(false);
                    setObraParaConfigurar(null);
                    // Resetear configuraci?n cuando se cancele
                    setConfiguracionObra({
                      semanasObjetivo: '',
                      diasHabiles: 0,
                      capacidadNecesaria: 0,
                      fechaInicio: '',
                      fechaFinEstimada: null,
                      jornalesTotales: 0,
                      presupuestoSeleccionado: null,
                      fechaProbableInicioInput: '',
                      modalVisible: false
                    });
                  }}
                >
                  <i className="fas fa-times me-2"></i>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleGuardarConfiguracionObra}
                  disabled={
                    (!configuracionObra.presupuestoSeleccionado?.fechaProbableInicio && !configuracionObra.fechaProbableInicioInput) ||
                    !configuracionObra.diasHabiles ||
                    configuracionObra.diasHabiles <= 0
                  }
                >
                  <i className="fas fa-save me-2"></i>
                  Confirmar Planificaci?n
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para enviar obra independiente */}
      {mostrarModalEnviarObra && obraParaEnviar && (
        <EnviarObraManualModal
          show={mostrarModalEnviarObra}
          onClose={() => {
            setMostrarModalEnviarObra(false);
            setObraParaEnviar(null);
          }}
          obra={obraParaEnviar}
          empresaId={empresaId}
          showNotification={showNotification}
        />
      )}

      {/* Modal para seleccionar profesionales en creaci?n de obra */}
      <SeleccionarProfesionalesModal
        show={mostrarModalSeleccionProfesionales}
        onHide={() => setMostrarModalSeleccionProfesionales(false)}
        profesionalesDisponibles={profesionalesDisponibles}
        profesionalesSeleccionados={profesionalesAsignadosForm}
        onConfirmar={(seleccionados) => {
          setProfesionalesAsignadosForm(seleccionados);
          setMostrarModalSeleccionProfesionales(false);
        }}
        asignacionesExistentes={asignacionesExistentesObra}
        semanaActual={null}
        fechaInicio={null}
        fechaFin={null}
        empresaId={empresaId}
        showNotification={showNotification}
        onNuevoProfesional={async () => {
          await refrescarProfesionalesDisponibles();
        }}
      />

      {/* Modal de estad?sticas de obra seleccionada */}
      {mostrarModalEstadisticasObra && obraParaEstadisticas && (
        <EstadisticasObraModal
          obra={obraParaEstadisticas}
          empresaId={empresaId}
          onClose={() => {
            setMostrarModalEstadisticasObra(false);
            setObraParaEstadisticas(null);
          }}
          showNotification={showNotification}
        />
      )}

      {/* Modal de estad?sticas de todas las obras */}
      {mostrarModalEstadisticasTodasObras && (
        <EstadisticasTodasObrasModal
          obras={obrasConFlags} // ? Usar obras procesadas con flags
          empresaId={empresaId}
          empresaSeleccionada={empresaSeleccionada}
          onClose={() => setMostrarModalEstadisticasTodasObras(false)}
          showNotification={showNotification}
          obrasDisponibles={obrasConFlags} // ? Pasar obras con flags esObraIndependiente
          obrasSeleccionadas={new Set()} // ? Sin selecci?n espec?fica (mostrar todas)
          trabajosExtraSeleccionados={new Set()} // ? Sin filtro de trabajos extra
          trabajosAdicionalesDisponibles={trabajosAdicionales} // ? Pasar TAs ya cargados
        />
      )}

      {/* Modal para ver asignaciones */}
      {mostrarModalVerAsignaciones && (
        <VerAsignacionesModal
          show={mostrarModalVerAsignaciones}
          onHide={() => {
            setMostrarModalVerAsignaciones(false);
            setObraParaVerAsignaciones(null);
          }}
          obra={obraParaVerAsignaciones}
          obras={obras}
          empresaId={empresaId}
          datosAsignacionesPorObra={datosAsignacionesPorObra}
        />
      )}

      {/* Modal Selecci?n de Env?o para Trabajos Extra */}
      {mostrarModalSeleccionEnvioTrabajoExtra && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="fas fa-paper-plane me-2"></i>�C?mo desea enviar el trabajo extra?
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setMostrarModalSeleccionEnvioTrabajoExtra(false)}
                ></button>
              </div>
              <div className="modal-body text-center py-4">
                <p className="mb-4">Seleccione el m?todo de env?o:</p>
                <div className="d-grid gap-3">
                  <button
                    className="btn btn-success btn-lg"
                    onClick={() => {
                      setMostrarModalSeleccionEnvioTrabajoExtra(false);

                      if (!trabajoExtraSeleccionado) {
                        showNotification('Seleccione un trabajo extra para enviar', 'warning');
                        return;
                      }

                      // Configurar el trabajo extra seleccionado para el modal
                      setTrabajoExtraEditar(trabajoExtraSeleccionado);

                      // ? ACTIVAR FLAGS PARA WHATSAPP
                      setAbrirWhatsAppTrabajoExtra(true);
                      setAbrirEmailTrabajoExtra(false);

                      console.log('?? FLAGS ACTIVADOS para WhatsApp');
                      showNotification('?? Generando PDF para WhatsApp...', 'info');

                      setMostrarModalTrabajoExtra(true);
                    }}
                  >
                    <i className="fab fa-whatsapp me-2"></i>Enviar por WhatsApp
                  </button>
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={() => {
                      setMostrarModalSeleccionEnvioTrabajoExtra(false);

                      if (!trabajoExtraSeleccionado) {
                        showNotification('Seleccione un trabajo extra para enviar', 'warning');
                        return;
                      }

                      // Configurar el trabajo extra seleccionado para el modal
                      setTrabajoExtraEditar(trabajoExtraSeleccionado);

                      // ? ACTIVAR FLAGS PARA EMAIL
                      setAbrirWhatsAppTrabajoExtra(false);
                      setAbrirEmailTrabajoExtra(true);

                      console.log('?? FLAGS ACTIVADOS para Email');
                      showNotification('?? Generando PDF para Email...', 'info');

                      setMostrarModalTrabajoExtra(true);
                    }}
                  >
                    <i className="fas fa-envelope me-2"></i>Enviar por Email
                  </button>
                  <button
                    className="btn btn-secondary btn-lg"
                    onClick={() => setMostrarModalSeleccionEnvioTrabajoExtra(false)}
                  >
                    <i className="fas fa-times me-2"></i>Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Lista de Trabajos Adicionales */}
      {mostrarModalListaTrabajosAdicionales && obraParaTrabajosAdicionales && (
        <div
          className="modal fade show"
          style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.6)' }}
          tabIndex="-1"
          onClick={() => setMostrarModalListaTrabajosAdicionales(false)}
        >
          <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content" style={{ borderRadius: '15px', overflow: 'hidden', boxShadow: '0 10px 50px rgba(0,0,0,0.3)' }}>
              {/* Header */}
              <div className="modal-header text-white" style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderBottom: '3px solid #5a67d8',
                padding: '1.5rem'
              }}>
                <div>
                  <h5 className="modal-title mb-1">
                    <i className="fas fa-tasks me-2"></i>
                    Tareas Leves
                  </h5>
                  <p className="mb-0 small opacity-90">
                    {obraParaTrabajosAdicionales._esTrabajoExtra
                      ? `Trabajo Extra: ${obraParaTrabajosAdicionales._trabajoExtraNombre}`
                      : `Obra: ${obraParaTrabajosAdicionales.direccionObra || obraParaTrabajosAdicionales.nombre}`
                    }
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setMostrarModalListaTrabajosAdicionales(false)}
                ></button>
              </div>

              {/* Body */}
              <div className="modal-body p-4">
                {/* Bot?n crear nuevo */}
                <div className="d-flex justify-content-end mb-3">
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      console.log('?? Click en Nueva Tarea Leve desde modal de lista:', {
                        obraParaTrabajosAdicionales,
                        _esTrabajoExtra: obraParaTrabajosAdicionales._esTrabajoExtra,
                        _trabajoExtraId: obraParaTrabajosAdicionales._trabajoExtraId
                      });
                      setTrabajoAdicionalEditar(null);

                      // ? Usar funci?n helper seg?n contexto
                      if (obraParaTrabajosAdicionales._esTrabajoExtra) {
                        // Es NIETA (hija de trabajo extra)
                        const trabajoExtra = {
                          id: obraParaTrabajosAdicionales._trabajoExtraId,
                          nombre: obraParaTrabajosAdicionales._trabajoExtraNombre
                        };
                        const obraAbuelo = obras.find(o => o.id === obraParaTrabajosAdicionales.id);
                        abrirModalTareaLeveNieta(obraAbuelo || obraParaTrabajosAdicionales, trabajoExtra);
                      } else {
                        // Es HIJA (hija directa de obra)
                        abrirModalTareaLeveHija(obraParaTrabajosAdicionales);
                      }
                    }}
                  >
                    <i className="fas fa-plus me-2"></i>
                    Nueva Tarea Leve
                  </button>
                </div>

                {/* Lista de trabajos adicionales */}
                {(() => {
                  const trabajosFiltrados = obraParaTrabajosAdicionales._esTrabajoExtra
                    ? obtenerTrabajosAdicionalesTrabajoExtra(obraParaTrabajosAdicionales._trabajoExtraId)
                    : obtenerTrabajosAdicionalesObra(obraParaTrabajosAdicionales.id);

                  console.log('?? DEBUG Modal Trabajos Adicionales:', {
                    esTrabajoExtra: obraParaTrabajosAdicionales._esTrabajoExtra,
                    trabajoExtraId: obraParaTrabajosAdicionales._trabajoExtraId,
                    obraId: obraParaTrabajosAdicionales.id,
                    totalTrabajosAdicionales: trabajosAdicionales.length,
                    trabajosAdicionalesCompleto: trabajosAdicionales,
                    trabajosFiltrados: trabajosFiltrados
                  });

                  if (trabajosFiltrados.length === 0) {
                    return (
                      <div className="text-center py-5">
                        <i className="fas fa-inbox fa-3x text-muted mb-3"></i>
                        <p className="text-muted">No hay tareas leves registradas</p>
                        <p className="small text-muted">Haga clic en "Nueva Tarea Leve" para crear una</p>
                      </div>
                    );
                  }

                  return (
                    <div className="row g-3">
                      {trabajosFiltrados.map((ta) => (
                        <div key={ta.id} className="col-12">
                          <div className="card" style={{
                            borderLeft: `4px solid ${obraParaTrabajosAdicionales._esTrabajoExtra ? '#ff9800' : '#667eea'}`,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                          }}>
                            <div className="card-body">
                              <div className="row align-items-start">
                                {/* Informaci?n principal */}
                                <div className="col-md-8">
                                  <div className="d-flex align-items-center gap-2 mb-2">
                                    <h5 className="mb-0 text-primary">{ta.nombre}</h5>
                                    <span className={`badge bg-${trabajosAdicionalesService.COLORES_ESTADO[ta.estado]}`}>
                                      <i className={`fas fa-${trabajosAdicionalesService.ICONOS_ESTADO[ta.estado]} me-1`}></i>
                                      {ta.estado}
                                    </span>
                                  </div>

                                  <div className="row g-2 mb-2">
                                    <div className="col-auto">
                                      <small className="text-muted">
                                        <i className="fas fa-dollar-sign me-1"></i>
                                        <strong>Importe:</strong> ${ta.importe?.toFixed(2) || '0.00'}
                                      </small>
                                    </div>
                                    <div className="col-auto">
                                      <small className="text-muted">
                                        <i className="fas fa-calendar-day me-1"></i>
                                        <strong>D?as:</strong> {ta.diasNecesarios}
                                      </small>
                                    </div>
                                    <div className="col-auto">
                                      <small className="text-muted">
                                        <i className="fas fa-users me-1"></i>
                                        <strong>Profesionales:</strong> {ta.profesionales?.length || 0}
                                      </small>
                                    </div>
                                    {ta.fechaInicio && (
                                      <div className="col-auto">
                                        <small className="text-muted">
                                          <i className="fas fa-calendar-alt me-1"></i>
                                          <strong>Inicio:</strong> {new Date(ta.fechaInicio).toLocaleDateString()}
                                        </small>
                                      </div>
                                    )}
                                  </div>

                                  {ta.descripcion && (
                                    <p className="small text-muted mb-0">
                                      <i className="fas fa-info-circle me-1"></i>
                                      {ta.descripcion}
                                    </p>
                                  )}
                                </div>

                                {/* Acciones */}
                                <div className="col-md-4 text-end">
                                  <div className="btn-group btn-group-sm mb-2 w-100" role="group">
                                    <button
                                      className="btn btn-outline-primary"
                                      onClick={() => {
                                        // ? Editar tarea desde modal de lista
                                        // El contexto ya est? en obraParaTrabajosAdicionales
                                        if (obraParaTrabajosAdicionales._esTrabajoExtra) {
                                          // Es NIETA
                                          const trabajoExtra = {
                                            id: obraParaTrabajosAdicionales._trabajoExtraId,
                                            nombre: obraParaTrabajosAdicionales._trabajoExtraNombre
                                          };
                                          const obraAbuelo = obras.find(o => o.id === obraParaTrabajosAdicionales.id);
                                          abrirModalTareaLeveNieta(obraAbuelo || obraParaTrabajosAdicionales, trabajoExtra, ta);
                                        } else {
                                          // Es HIJA - ? Abrir modal correcto con datos existentes
                                          setObraParaTareaLeve(obraParaTrabajosAdicionales);
                                          setTareaLeveEditando(ta);
                                          setMostrarModalTareaLeve(true);
                                        }
                                      }}
                                      title="Editar"
                                    >
                                      <i className="fas fa-edit me-1"></i>
                                      Editar
                                    </button>
                                    <button
                                      className="btn btn-outline-danger"
                                      onClick={() => handleEliminarTrabajoAdicional(ta.id, ta.nombre)}
                                      title="Eliminar"
                                    >
                                      <i className="fas fa-trash me-1"></i>
                                      Eliminar
                                    </button>
                                  </div>

                                  {/* Botones de cambio de estado */}
                                  {ta.estado === 'PENDIENTE' && (
                                    <button
                                      className="btn btn-sm btn-primary w-100"
                                      onClick={() => handleCambiarEstadoTrabajoAdicional(ta.id, 'EN_PROGRESO')}
                                    >
                                      <i className="fas fa-play me-1"></i>
                                      Iniciar Tarea
                                    </button>
                                  )}
                                  {ta.estado === 'EN_PROGRESO' && (
                                    <div className="d-flex gap-1">
                                      <button
                                        className="btn btn-sm btn-success flex-grow-1"
                                        onClick={() => handleCambiarEstadoTrabajoAdicional(ta.id, 'COMPLETADO')}
                                      >
                                        <i className="fas fa-check me-1"></i>
                                        Completar
                                      </button>
                                      <button
                                        className="btn btn-sm btn-warning flex-grow-1"
                                        onClick={() => handleCambiarEstadoTrabajoAdicional(ta.id, 'CANCELADO')}
                                      >
                                        <i className="fas fa-times me-1"></i>
                                        Cancelar
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Lista de profesionales */}
                              {ta.profesionales && ta.profesionales.length > 0 && (
                                <div className="mt-3 pt-3 border-top">
                                  <h6 className="small text-muted mb-2">
                                    <i className="fas fa-hard-hat me-1"></i>
                                    Profesionales Asignados:
                                  </h6>
                                  <div className="d-flex flex-wrap gap-2">
                                    {ta.profesionales.map((prof, idx) => (
                                      <span
                                        key={idx}
                                        className={`badge ${prof.esRegistrado ? 'bg-info' : 'bg-secondary'}`}
                                        style={{ fontSize: '0.85rem' }}
                                      >
                                        {prof.nombre} - {prof.tipoProfesional}
                                        {prof.honorarioDia && <> (${parseFloat(prof.honorarioDia).toFixed(2)}/d?a)</>}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Footer */}
              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setMostrarModalListaTrabajosAdicionales(false)}
                >
                  <i className="fas fa-save me-2"></i>
                  Guardar y Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Trabajo Diario (obras independientes - Nuevo Cliente) */}
      {mostrarModalTrabajoDiario && (
        <PresupuestoNoClienteModal
          show={mostrarModalTrabajoDiario}
          onClose={() => {
            setMostrarModalTrabajoDiario(false);
          }}
          onSave={handleGuardadoTrabajoDiario}
          tituloPersonalizado="Nuevo Presupuesto para Trabajo Diario -- Nuevos Clientes"
          initialData={{
            idEmpresa: empresaSeleccionada?.id,
            nombreEmpresa: empresaSeleccionada?.nombreEmpresa,
            esPresupuestoTrabajoExtra: false,
            estado: 'BORRADOR',
            version: 1,
            tipoPresupuesto: 'PRINCIPAL',
            fechaEmision: new Date().toISOString().slice(0, 10),
            vencimiento: new Date().toISOString().slice(0, 10),
            calculoAutomaticoDiasHabiles: false
          }}
        />
      )}

      {/* Modal Tarea Leve (vinculada a obra) */}
      {mostrarModalTareaLeve && obraParaTareaLeve && (
        <PresupuestoNoClienteModal
          show={mostrarModalTareaLeve}
          onClose={() => {
            setMostrarModalTareaLeve(false);
            setObraParaTareaLeve(null);
            setTareaLeveEditando(null);
          }}
          onSave={handleGuardadoTareaLeve}
          tituloPersonalizado={
            tareaLeveEditando
              ? `Editar Tarea Leve: ${tareaLeveEditando.nombre || 'Sin nombre'}`
              : obraParaTareaLeve?._esTrabajoExtra
                ? `Nueva Tarea Leve para Trabajo Extra: ${obraParaTareaLeve._trabajoExtraNombre || 'Sin nombre'}`
                : `Nueva Tarea Leve para: ${obraParaTareaLeve?.nombre || obraParaTareaLeve?.nombreObra || 'Obra'}`
          }
          initialData={
            tareaLeveEditando || {
              idEmpresa: empresaSeleccionada?.id,
              nombreEmpresa: empresaSeleccionada?.nombreEmpresa,
              esPresupuestoTrabajoExtra: false,
              obraId: obraParaTareaLeve?._esTrabajoExtra ? null : (obraParaTareaLeve?.id || null),
              idObra: obraParaTareaLeve?._esTrabajoExtra ? null : (obraParaTareaLeve?.id || null),
              trabajoExtraId: obraParaTareaLeve?._esTrabajoExtra ? obraParaTareaLeve._trabajoExtraId : null,
              estado: 'BORRADOR',
              version: 1,
              tipoPresupuesto: 'TAREA_LEVE',
              nombreObraManual: obraParaTareaLeve?._esTrabajoExtra
                ? obraParaTareaLeve._trabajoExtraNombre
                : (obraParaTareaLeve?.nombre || obraParaTareaLeve?.nombreObra || ''),
              // ?? HEREDAR DIRECCI?N DE LA OBRA PADRE (campos obligatorios para crear obra)
              direccionObraCalle: obraParaTareaLeve?.direccionObraCalle || obraParaTareaLeve?.direccion || '',
              direccionObraAltura: obraParaTareaLeve?.direccionObraAltura || '',
              direccionObraBarrio: obraParaTareaLeve?.direccionObraBarrio || obraParaTareaLeve?.barrio || '',
              direccionObraPiso: obraParaTareaLeve?.direccionObraPiso || obraParaTareaLeve?.piso || '',
              direccionObraDepartamento: obraParaTareaLeve?.direccionObraDepartamento || obraParaTareaLeve?.departamento || '',
              direccionObraTorre: obraParaTareaLeve?.direccionObraTorre || '',
              direccionObraLocalidad: obraParaTareaLeve?.direccionObraLocalidad || obraParaTareaLeve?.localidad || '',
              direccionObraProvincia: obraParaTareaLeve?.direccionObraProvincia || obraParaTareaLeve?.provincia || '',
              direccionObraCodigoPostal: obraParaTareaLeve?.direccionObraCodigoPostal || obraParaTareaLeve?.codigoPostal || '',
              fechaEmision: new Date().toISOString().slice(0, 10),
              vencimiento: new Date().toISOString().slice(0, 10),
              calculoAutomaticoDiasHabiles: false
            }
          }
        />
      )}

      {/* ? MODAL UNIFICADO DE PRESUPUESTOS */}
      <ModalPresupuestoUnificado
        mostrar={modalPresupuesto.mostrar}
        tipoPresupuesto={modalPresupuesto.tipo}
        contexto={modalPresupuesto.contexto}
        datosIniciales={modalPresupuesto.datosIniciales}
        onCerrar={cerrarModalPresupuesto}
        onGuardar={handleGuardarPresupuesto}
        profesionalesDisponibles={profesionalesDisponibles}
        empresaId={empresaId}
        showNotification={showNotification}
        onRefrescarProfesionales={refrescarProfesionalesDisponibles}
      />

      <style>{`
        .hover-row:hover {
          background-color: #f5f5f5 !important;
        }

        /* Botones extra peque?os para acciones de trabajos adicionales */
        .btn-xs {
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
          line-height: 1.2;
          border-radius: 0.2rem;
        }

        /* Animaci?n suave para cards de trabajos adicionales */
        .card[style*="borderLeft"] {
          transition: box-shadow 0.2s ease;
        }

        .card[style*="borderLeft"]:hover {
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
      `}</style>
    </div>
  );
};

export default ObrasPage;
