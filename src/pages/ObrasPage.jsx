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
import api from '../services/api';
import axios from 'axios';
import { obtenerAsignacionesSemanalPorObra } from '../services/profesionalesObraService';
import * as trabajosAdicionalesService from '../services/trabajosAdicionalesService';
import eventBus, { FINANCIAL_EVENTS } from '../utils/eventBus';
import { calcularSemanasParaDiasHabiles, convertirDiasHabilesASemanasSimple, esDiaHabil } from '../utils/feriadosArgentina';
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

  // ✅ Procesamiento de obras para detectar obras independientes
  const obrasConFlags = React.useMemo(() => {
    console.log('🔍 [ObrasPage] Procesando obras:', obras.length);
    return obras.map(obra => {
      // Detectar si es obra independiente (sin presupuesto)
      const tienePresupuesto = obra.presupuestoId ||
                              obra.presupuestoNoClienteId ||
                              obra.presupuestoNoCliente?.id ||
                              obra.presupuestoCompleto?.id;

      const esObraIndependiente = !tienePresupuesto;

      // 🔍 Debug: mostrar TODAS las obras con sus campos clave
      console.log(`🔍 [ObrasPage] Obra id:${obra.id}:`, {
        tienePresupuesto,
        esObraIndependiente,
        presupuestoId: obra.presupuestoId,
        presupuestoNoClienteId: obra.presupuestoNoClienteId,
        presupuestoEstimado: obra.presupuestoEstimado,
        nombre: obra.nombre,
        nombreObra: obra.nombreObra,
        descripcion: obra.descripcion,
        direccion: obra.direccion
      });

      return {
        ...obra,
        esObraIndependiente,
        // Mantener compatibilidad con lógica existente
        totalPresupuesto: obra.totalPresupuesto || obra.presupuestoEstimado || 0
      };
    });
  }, [obras]);

  // Estado local para controlar obra seleccionada desde tabla
  const [selectedObraId, setSelectedObraId] = React.useState(null);

  // 🔧 Estado para rastrear relación: obra padre -> obras de trabajo extra
  const [mapObraPadre, setMapObraPadre] = React.useState({});

  // Estado para modal de presupuestos
  const [mostrarModalPresupuestos, setMostrarModalPresupuestos] = React.useState(false);
  const [obraParaPresupuestos, setObraParaPresupuestos] = React.useState(null);
  const [presupuestosObra, setPresupuestosObra] = React.useState([]);
  const [loadingPresupuestos, setLoadingPresupuestos] = React.useState(false);

  // Estado para modal de cambiar estado
  const [mostrarModalCambiarEstado, setMostrarModalCambiarEstado] = React.useState(false);
  const [nuevoEstadoSeleccionado, setNuevoEstadoSeleccionado] = React.useState('');

  // ==================== CONFIGURACIÓN GLOBAL DE OBRA ====================
    const [mostrarModalConfiguracionObra, setMostrarModalConfiguracionObra] = React.useState(false);
    const [obraParaConfigurar, setObraParaConfigurar] = React.useState(null);
    // Estado global de planificación por obra
    const [configuracionesPlanificacion, setConfiguracionesPlanificacion] = React.useState({});
    // Estado para advertencias en el modal de configuración
    const [advertenciaConfiguracionObra, setAdvertenciaConfiguracionObra] = React.useState(null);
    // Estado local para edición actual
    const [configuracionObra, setConfiguracionObra] = React.useState({
      semanasObjetivo: '',
      diasHabiles: 0,
      capacidadNecesaria: 0,
      fechaInicio: '',
      fechaFinEstimada: null,
      jornalesTotales: 0,
      presupuestoSeleccionado: null
    });

    // Estado para forzar re-render cuando cambia configuración desde BD
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

  // Estado para modal de edición de presupuesto
  const [mostrarModalEditarPresupuesto, setMostrarModalEditarPresupuesto] = React.useState(false);
  const [presupuestoParaEditar, setPresupuestoParaEditar] = React.useState(null);
  const [cargandoPresupuesto, setCargandoPresupuesto] = React.useState(false);

  // Estados para Trabajos Extra
  const [trabajosExtra, setTrabajosExtra] = React.useState([]);
  const [loadingTrabajosExtra, setLoadingTrabajosExtra] = React.useState(false);
  const [mostrarModalTrabajoExtra, setMostrarModalTrabajoExtra] = React.useState(false);
  const [autoGenerarPDFTrabajoExtra, setAutoGenerarPDFTrabajoExtra] = React.useState(false);
  const [abrirWhatsAppTrabajoExtra, setAbrirWhatsAppTrabajoExtra] = React.useState(false);
  const [abrirEmailTrabajoExtra, setAbrirEmailTrabajoExtra] = React.useState(false);
  const [mostrarModalSeleccionEnvioTrabajoExtra, setMostrarModalSeleccionEnvioTrabajoExtra] = React.useState(false);

  // Estados para Trabajos Adicionales
  const [mostrarModalListaTrabajosAdicionales, setMostrarModalListaTrabajosAdicionales] = React.useState(false);
  const [mostrarModalTrabajoAdicional, setMostrarModalTrabajoAdicional] = React.useState(false);
  const [obraParaTrabajosAdicionales, setObraParaTrabajosAdicionales] = React.useState(null);
  const [trabajoAdicionalEditar, setTrabajoAdicionalEditar] = React.useState(null);
  const [trabajosAdicionales, setTrabajosAdicionales] = React.useState([]);

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

  // Honorarios individuales para cada categoría (Trabajos Adicionales)
  const [honorarioJornales, setHonorarioJornales] = React.useState('');
  const [tipoHonorarioJornales, setTipoHonorarioJornales] = React.useState('fijo');
  const [honorarioMateriales, setHonorarioMateriales] = React.useState('');
  const [tipoHonorarioMateriales, setTipoHonorarioMateriales] = React.useState('fijo');
  const [honorarioGastosGenerales, setHonorarioGastosGenerales] = React.useState('');
  const [tipoHonorarioGastosGenerales, setTipoHonorarioGastosGenerales] = React.useState('fijo');
  const [honorarioMayoresCostos, setHonorarioMayoresCostos] = React.useState('');
  const [tipoHonorarioMayoresCostos, setTipoHonorarioMayoresCostos] = React.useState('fijo');

  // Descuentos individuales para cada categoría (Trabajos Adicionales)
  const [descuentoJornales, setDescuentoJornales] = React.useState('');
  const [tipoDescuentoJornales, setTipoDescuentoJornales] = React.useState('fijo');
  const [descuentoMateriales, setDescuentoMateriales] = React.useState('');
  const [tipoDescuentoMateriales, setTipoDescuentoMateriales] = React.useState('fijo');
  const [descuentoGastosGenerales, setDescuentoGastosGenerales] = React.useState('');
  const [tipoDescuentoGastosGenerales, setTipoDescuentoGastosGenerales] = React.useState('fijo');
  const [descuentoMayoresCostos, setDescuentoMayoresCostos] = React.useState('');
  const [tipoDescuentoMayoresCostos, setTipoDescuentoMayoresCostos] = React.useState('fijo');

  // Descuentos específicos para honorarios (Trabajos Adicionales)
  const [descuentoHonorarioJornales, setDescuentoHonorarioJornales] = React.useState('');
  const [tipoDescuentoHonorarioJornales, setTipoDescuentoHonorarioJornales] = React.useState('fijo');
  const [descuentoHonorarioMateriales, setDescuentoHonorarioMateriales] = React.useState('');
  const [tipoDescuentoHonorarioMateriales, setTipoDescuentoHonorarioMateriales] = React.useState('fijo');
  const [descuentoHonorarioGastosGenerales, setDescuentoHonorarioGastosGenerales] = React.useState('');
  const [tipoDescuentoHonorarioGastosGenerales, setTipoDescuentoHonorarioGastosGenerales] = React.useState('fijo');
  const [descuentoHonorarioMayoresCostos, setDescuentoHonorarioMayoresCostos] = React.useState('');
  const [tipoDescuentoHonorarioMayoresCostos, setTipoDescuentoHonorarioMayoresCostos] = React.useState('fijo');

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

  // Ref para evitar cálculo inmediato al alternar el desglose
  const desgloseJustToggled = React.useRef(false);

  // Estados legacy para compatibilidad (solo para reseteo)
  const [importeHonorariosObra, setImporteHonorariosObra] = React.useState('');
  const [tipoHonorariosObra, setTipoHonorariosObra] = React.useState('fijo');
  const [tipoMayoresCostosObra, setTipoMayoresCostosObra] = React.useState('fijo');

  // Honorarios individuales para cada categoría (Obras)
  const [honorarioJornalesObra, setHonorarioJornalesObra] = React.useState('');
  const [tipoHonorarioJornalesObra, setTipoHonorarioJornalesObra] = React.useState('fijo');
  const [honorarioMaterialesObra, setHonorarioMaterialesObra] = React.useState('');
  const [tipoHonorarioMaterialesObra, setTipoHonorarioMaterialesObra] = React.useState('fijo');
  const [honorarioGastosGeneralesObra, setHonorarioGastosGeneralesObra] = React.useState('');
  const [tipoHonorarioGastosGeneralesObra, setTipoHonorarioGastosGeneralesObra] = React.useState('fijo');
  const [honorarioMayoresCostosObra, setHonorarioMayoresCostosObra] = React.useState('');
  const [tipoHonorarioMayoresCostosObra, setTipoHonorarioMayoresCostosObra] = React.useState('fijo');

  // Descuentos individuales para cada categoría (Obras)
  const [descuentoJornalesObra, setDescuentoJornalesObra] = React.useState('');
  const [tipoDescuentoJornalesObra, setTipoDescuentoJornalesObra] = React.useState('fijo');
  const [descuentoMaterialesObra, setDescuentoMaterialesObra] = React.useState('');
  const [tipoDescuentoMaterialesObra, setTipoDescuentoMaterialesObra] = React.useState('fijo');
  const [descuentoGastosGeneralesObra, setDescuentoGastosGeneralesObra] = React.useState('');
  const [tipoDescuentoGastosGeneralesObra, setTipoDescuentoGastosGeneralesObra] = React.useState('fijo');
  const [descuentoMayoresCostosObra, setDescuentoMayoresCostosObra] = React.useState('');
  const [tipoDescuentoMayoresCostosObra, setTipoDescuentoMayoresCostosObra] = React.useState('fijo');

  // Descuentos específicos para honorarios (Obras)
  const [descuentoHonorarioJornalesObra, setDescuentoHonorarioJornalesObra] = React.useState('');
  const [tipoDescuentoHonorarioJornalesObra, setTipoDescuentoHonorarioJornalesObra] = React.useState('fijo');
  const [descuentoHonorarioMaterialesObra, setDescuentoHonorarioMaterialesObra] = React.useState('');
  const [tipoDescuentoHonorarioMaterialesObra, setTipoDescuentoHonorarioMaterialesObra] = React.useState('fijo');
  const [descuentoHonorarioGastosGeneralesObra, setDescuentoHonorarioGastosGeneralesObra] = React.useState('');
  const [tipoDescuentoHonorarioGastosGeneralesObra, setTipoDescuentoHonorarioGastosGeneralesObra] = React.useState('fijo');
  const [descuentoHonorarioMayoresCostosObra, setDescuentoHonorarioMayoresCostosObra] = React.useState('');
  const [tipoDescuentoHonorarioMayoresCostosObra, setTipoDescuentoHonorarioMayoresCostosObra] = React.useState('fijo');

  // Calcular importe total para obras cuando cambian los desgloses
  React.useEffect(() => {
    // Si acabamos de hacer toggle del desglose, no ejecutar cálculos en este render
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
      if (mostrarModalTrabajoAdicional && empresaId) {
        setLoadingProfesionalesTA(true);
        try {
          const response = await api.profesionales.getAll(empresaId);
          const profesionalesData = Array.isArray(response) ? response : (response?.data || response?.resultado || []);
          setProfesionalesDisponiblesTA(profesionalesData);
          console.log('✅ Profesionales cargados:', profesionalesData.length);

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
              setTipoHonorarioJornales(ta.tipoHonorarioJornales || 'fijo');

              // Restaurar honorarios de Materiales
              setHonorarioMateriales(ta.honorarioMateriales != null ? String(ta.honorarioMateriales) : '');
              setTipoHonorarioMateriales(ta.tipoHonorarioMateriales || 'fijo');

              // Restaurar honorarios de Gastos Generales
              setHonorarioGastosGenerales(ta.honorarioGastosGenerales != null ? String(ta.honorarioGastosGenerales) : '');
              setTipoHonorarioGastosGenerales(ta.tipoHonorarioGastosGenerales || 'fijo');

              // Restaurar honorarios de Mayores Costos
              setHonorarioMayoresCostos(ta.honorarioMayoresCostos != null ? String(ta.honorarioMayoresCostos) : '');
              setTipoHonorarioMayoresCostos(ta.tipoHonorarioMayoresCostos || 'fijo');

              // Restaurar descuentos de Jornales
              setDescuentoJornales(ta.descuentoJornales != null ? String(ta.descuentoJornales) : '');
              setTipoDescuentoJornales(ta.tipoDescuentoJornales || 'fijo');

              // Restaurar descuentos de Materiales
              setDescuentoMateriales(ta.descuentoMateriales != null ? String(ta.descuentoMateriales) : '');
              setTipoDescuentoMateriales(ta.tipoDescuentoMateriales || 'fijo');

              // Restaurar descuentos de Gastos Generales
              setDescuentoGastosGenerales(ta.descuentoGastosGenerales != null ? String(ta.descuentoGastosGenerales) : '');
              setTipoDescuentoGastosGenerales(ta.tipoDescuentoGastosGenerales || 'fijo');

              // Restaurar descuentos de Mayores Costos
              setDescuentoMayoresCostos(ta.descuentoMayoresCostos != null ? String(ta.descuentoMayoresCostos) : '');
              setTipoDescuentoMayoresCostos(ta.tipoDescuentoMayoresCostos || 'fijo');

              // Restaurar descuentos específicos para honorarios
              setDescuentoHonorarioJornales(ta.descuentoHonorarioJornales != null ? String(ta.descuentoHonorarioJornales) : '');
              setTipoDescuentoHonorarioJornales(ta.tipoDescuentoHonorarioJornales || 'fijo');

              setDescuentoHonorarioMateriales(ta.descuentoHonorarioMateriales != null ? String(ta.descuentoHonorarioMateriales) : '');
              setTipoDescuentoHonorarioMateriales(ta.tipoDescuentoHonorarioMateriales || 'fijo');

              setDescuentoHonorarioGastosGenerales(ta.descuentoHonorarioGastosGenerales != null ? String(ta.descuentoHonorarioGastosGenerales) : '');
              setTipoDescuentoHonorarioGastosGenerales(ta.tipoDescuentoHonorarioGastosGenerales || 'fijo');

              setDescuentoHonorarioMayoresCostos(ta.descuentoHonorarioMayoresCostos != null ? String(ta.descuentoHonorarioMayoresCostos) : '');
              setTipoDescuentoHonorarioMayoresCostos(ta.tipoDescuentoHonorarioMayoresCostos || 'fijo');

              console.log('📂 Desglose TA restaurado desde DTO:', ta);
            } else {
              setUsarDesglose(false);
              setImporteJornales('');
              setImporteMateriales('');
              setImporteGastosGenerales('');
              setImporteMayoresCostos('');
              setHonorarioJornales('');
              setTipoHonorarioJornales('fijo');
              setHonorarioMateriales('');
              setTipoHonorarioMateriales('fijo');
              setHonorarioGastosGenerales('');
              setTipoHonorarioGastosGenerales('fijo');
              setHonorarioMayoresCostos('');
              setTipoHonorarioMayoresCostos('fijo');
              setDescuentoJornales('');
              setTipoDescuentoJornales('fijo');
              setDescuentoMateriales('');
              setTipoDescuentoMateriales('fijo');
              setDescuentoGastosGenerales('');
              setTipoDescuentoGastosGenerales('fijo');
              setDescuentoMayoresCostos('');
              setTipoDescuentoMayoresCostos('fijo');
      setDescuentoHonorarioJornales('');
      setTipoDescuentoHonorarioJornales('fijo');
      setDescuentoHonorarioMateriales('');
      setTipoDescuentoHonorarioMateriales('fijo');
      setDescuentoHonorarioGastosGenerales('');
      setTipoDescuentoHonorarioGastosGenerales('fijo');
      setDescuentoHonorarioMayoresCostos('');
      setTipoDescuentoHonorarioMayoresCostos('fijo');
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
            console.log('📋 Profesionales cargados para edición:', { registrados: profRegistrados.length, adhoc: profAdhoc.length });
          }
        }
        } catch (error) {
          console.error('❌ Error cargando profesionales:', error);
          showNotification('Error al cargar profesionales', 'error');
          setProfesionalesDisponiblesTA([]);
        } finally {
          setLoadingProfesionalesTA(false);
        }
      } else if (!mostrarModalTrabajoAdicional) {
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
  }, [mostrarModalTrabajoAdicional, empresaId]);

  // Cargar trabajos adicionales al montar o cuando cambia la empresa
  React.useEffect(() => {
    const cargarTrabajosAdicionales = async () => {
      if (empresaId) {
        try {
          const todosLosTrabajosAdicionales = await trabajosAdicionalesService.listarTrabajosAdicionales(empresaId);
          const trabajosArray = Array.isArray(todosLosTrabajosAdicionales) ? todosLosTrabajosAdicionales : [];
          setTrabajosAdicionales(trabajosArray);
        } catch (error) {
          console.error('❌ Error al cargar trabajos adicionales:', error);
          setTrabajosAdicionales([]);
        }
      } else {
        setTrabajosAdicionales([]);
      }
    };
    cargarTrabajosAdicionales();
  }, [empresaId]);



  // 🐛 DEBUG: Exponer función global para inspeccionar trabajos extra desde consola
  React.useEffect(() => {
    window.debugTrabajosExtra = () => {
      console.clear();
      console.log('%c═══════════════════════════════════════════════════', 'color: #00f; font-weight: bold');
      console.log('%c 🔍 DEBUG TRABAJOS EXTRA - Estado Completo', 'color: #00f; font-weight: bold; font-size: 16px');
      console.log('%c═══════════════════════════════════════════════════', 'color: #00f; font-weight: bold');
      console.log('');

      console.log('%c📊 RESUMEN GENERAL', 'color: #f80; font-weight: bold; font-size: 14px');
      console.log('Total trabajos extra en estado:', trabajosExtra.length);
      console.log('IDs:', trabajosExtra.map(t => t.id));
      console.log('');

      trabajosExtra.forEach((trabajo, index) => {
        console.log(`%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'color: #0f0');
        console.log(`%c📋 TRABAJO #${index + 1}: ${trabajo.nombreObra || trabajo.nombre}`, 'color: #0f0; font-weight: bold; font-size: 13px');
        console.log(`%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'color: #0f0');

        console.log('🆔 ID:', trabajo.id);
        console.log('📝 Nombre:', trabajo.nombreObra || trabajo.nombre);
        console.log('');

        console.log('%c👥 PROFESIONALES', 'color: #00f; font-weight: bold');
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

        console.log('%c📦 MATERIALES', 'color: #f80; font-weight: bold');
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

        console.log('%c💰 GASTOS GENERALES', 'color: #f00; font-weight: bold');
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

        console.log('%c🔧 DATOS COMPLETOS DEL OBJETO', 'color: #666; font-weight: bold');
        console.log(trabajo);
        console.log('');
      });

      console.log('%c═══════════════════════════════════════════════════', 'color: #00f; font-weight: bold');
      console.log('%c✅ Inspección completa finalizada', 'color: #0f0; font-weight: bold');
      console.log('%c═══════════════════════════════════════════════════', 'color: #00f; font-weight: bold');
      console.log('');
      console.log('%cPara volver a ejecutar, escribe: debugTrabajosExtra()', 'color: #666; font-style: italic');
    };

    // 🔍 Función para verificar asignaciones reales del backend
    window.verificarAsignacionesBackend = async (trabajoExtraId = 7) => {
      console.clear();
      console.log('%c═══════════════════════════════════════════════════', 'color: #f00; font-weight: bold');
      console.log('%c 🌐 VERIFICACIÓN BACKEND - Trabajo Extra ID: ' + trabajoExtraId, 'color: #f00; font-weight: bold; font-size: 16px');
      console.log('%c═══════════════════════════════════════════════════', 'color: #f00; font-weight: bold');
      console.log('');

      const empresaId = localStorage.getItem('empresaId') || 1;
      console.log('🏢 Empresa ID:', empresaId);
      console.log('🆔 Consultando asignaciones para Trabajo Extra ID:', trabajoExtraId);

      // Buscar info del trabajo extra
      const trabajoInfo = trabajosExtra.find(t => t.id === trabajoExtraId);
      if (trabajoInfo) {
        console.log('📋 Nombre:', trabajoInfo.nombreObra || trabajoInfo.nombre);
        console.log('🏗️ Obra Padre ID:', trabajoInfo.obraId);
      }
      console.log('');

      try {
        // 1. Verificar Profesionales
        console.log('%c👥 CONSULTANDO PROFESIONALES...', 'color: #00f; font-weight: bold');
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

        // Contar profesionales únicos como lo hace la función real
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
        console.log('  Profesionales únicos:', profesionalesUnicos.size);
        console.log('  Profesionales procesados:', profesionales);

        // 🔍 VERIFICAR OBRA_ID DE CADA ASIGNACIÓN
        console.log('%c  🔍 VERIFICANDO OBRA_ID DE ASIGNACIONES:', 'color: #ff0; font-weight: bold; background: #000; padding: 2px');
        asignaciones.forEach((asig, idx) => {
          console.log(`    Asignación ${idx + 1}:`, {
            id: asig.id,
            obraId: asig.obraId,
            profesionalId: asig.profesionalId,
            esDelTrabajoExtra: asig.obraId === trabajoExtraId,
            profesional: asig.profesional?.nombre || 'N/A'
          });
        });
        console.log('');

        // 2. Verificar Materiales
        console.log('%c📦 CONSULTANDO MATERIALES...', 'color: #f80; font-weight: bold');
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

        // 🔍 VERIFICAR OBRA_ID DE CADA MATERIAL
        console.log('%c  🔍 VERIFICANDO OBRA_ID DE MATERIALES:', 'color: #ff0; font-weight: bold; background: #000; padding: 2px');
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
        console.log('%c💰 CONSULTANDO GASTOS GENERALES...', 'color: #f00; font-weight: bold');
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

        // 🔍 VERIFICAR OBRA_ID DE CADA GASTO
        console.log('%c  🔍 VERIFICANDO OBRA_ID DE GASTOS:', 'color: #ff0; font-weight: bold; background: #000; padding: 2px');
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
        console.log('%c═══════════════════════════════════════════════════', 'color: #f00; font-weight: bold');
        console.log('%c📊 RESUMEN BACKEND', 'color: #0f0; font-weight: bold; font-size: 14px');
        console.log('%c═══════════════════════════════════════════════════', 'color: #f00; font-weight: bold');
        console.log('✅ Profesionales:', Array.isArray(profesionales) ? profesionales.length : 0);
        console.log('✅ Materiales:', Array.isArray(materiales) ? materiales.length : 0);
        console.log('✅ Gastos:', Array.isArray(gastos) ? gastos.length : 0);
        console.log('');

        // VALIDACIÓN DE PERTENENCIA
        console.log('%c🎯 VALIDACIÓN DE PERTENENCIA', 'color: #f0f; font-weight: bold; font-size: 14px');
        const profDelTrabajoExtra = asignaciones.filter(a => a.obraId === trabajoExtraId).length;
        const matDelTrabajoExtra = Array.isArray(materiales) ? materiales.filter(m => m.obraId === trabajoExtraId).length : 0;
        const gastosDelTrabajoExtra = Array.isArray(gastos) ? gastos.filter(g => g.obraId === trabajoExtraId).length : 0;

        console.log(`Profesionales con obraId=${trabajoExtraId}:`, profDelTrabajoExtra, '/', asignaciones.length);
        console.log(`Materiales con obraId=${trabajoExtraId}:`, matDelTrabajoExtra, '/', (Array.isArray(materiales) ? materiales.length : 0));
        console.log(`Gastos con obraId=${trabajoExtraId}:`, gastosDelTrabajoExtra, '/', (Array.isArray(gastos) ? gastos.length : 0));

        if (profDelTrabajoExtra !== asignaciones.length) {
          console.log('%c⚠️ ADVERTENCIA: Algunas asignaciones de profesionales NO pertenecen al trabajo extra', 'color: #f00; font-weight: bold; background: #ff0; padding: 5px');
        }
        if (matDelTrabajoExtra !== (Array.isArray(materiales) ? materiales.length : 0)) {
          console.log('%c⚠️ ADVERTENCIA: Algunos materiales NO pertenecen al trabajo extra', 'color: #f00; font-weight: bold; background: #ff0; padding: 5px');
        }
        if (gastosDelTrabajoExtra !== (Array.isArray(gastos) ? gastos.length : 0)) {
          console.log('%c⚠️ ADVERTENCIA: Algunos gastos NO pertenecen al trabajo extra', 'color: #f00; font-weight: bold; background: #ff0; padding: 5px');
        }
        console.log('');

        console.log('%c🔍 COMPARACIÓN CON ESTADO REACT', 'color: #00f; font-weight: bold; font-size: 14px');
        const trabajoEnEstado = trabajosExtra.find(t => t.id === trabajoExtraId);
        if (trabajoEnEstado) {
          console.log('Estado React - Profesionales:', trabajoEnEstado.profesionales?.length || 0);
          console.log('Estado React - Materiales:', trabajoEnEstado.materiales?.length || 0);
          console.log('Estado React - Gastos:', trabajoEnEstado.gastosGenerales?.length || 0);
          console.log('');

          const profMatch = (trabajoEnEstado.profesionales?.length || 0) === (Array.isArray(profesionales) ? profesionales.length : 0);
          const matMatch = (trabajoEnEstado.materiales?.length || 0) === (Array.isArray(materiales) ? materiales.length : 0);
          const gastMatch = (trabajoEnEstado.gastosGenerales?.length || 0) === (Array.isArray(gastos) ? gastos.length : 0);

          console.log(profMatch ? '%c✅ Profesionales: CORRECTO' : '%c❌ Profesionales: DESINCRONIZADO', profMatch ? 'color: #0f0' : 'color: #f00; font-weight: bold');
          console.log(matMatch ? '%c✅ Materiales: CORRECTO' : '%c❌ Materiales: DESINCRONIZADO', matMatch ? 'color: #0f0' : 'color: #f00; font-weight: bold');
          console.log(gastMatch ? '%c✅ Gastos: CORRECTO' : '%c❌ Gastos: DESINCRONIZADO', gastMatch ? 'color: #0f0' : 'color: #f00; font-weight: bold');
        } else {
          console.log('%c⚠️ Trabajo Extra no encontrado en el estado React', 'color: #f80; font-weight: bold');
        }
        console.log('');
        console.log('%c═══════════════════════════════════════════════════', 'color: #f00; font-weight: bold');

      } catch (error) {
        console.error('%c❌ ERROR consultando backend:', 'color: #f00; font-weight: bold', error);
      }
    };

    console.log('%c🐛 DEBUG HABILITADO: Usa debugTrabajosExtra() en la consola para inspeccionar', 'color: #0ff; font-weight: bold; background: #000; padding: 5px');
    console.log('%c🌐 BACKEND CHECK: Usa verificarAsignacionesBackend(7) para consultar asignaciones reales', 'color: #f0f; font-weight: bold; background: #000; padding: 5px');

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

  // Estado para obras expandidas (acordeón)
  const [obrasExpandidas, setObrasExpandidas] = React.useState(new Set());

  // Estado para presupuestos de obras (para calcular fechas)
  const [presupuestosObras, setPresupuestosObras] = React.useState({});

  // Estado para contadores de elementos por obra (para badges)
  const [contadoresObras, setContadoresObras] = React.useState({});

  // Estado para almacenar datos detallados de asignaciones por obra
  const [datosAsignacionesPorObra, setDatosAsignacionesPorObra] = React.useState({});

  // Estados para profesionales en formulario de creación
  const [tipoProfesional, setTipoProfesional] = React.useState('LISTADO_GENERAL');
  const [profesionalSeleccionado, setProfesionalSeleccionado] = React.useState('');
  const [profesionalesAsignadosForm, setProfesionalesAsignadosForm] = React.useState([]);
  const [profesionalesDisponibles, setProfesionalesDisponibles] = React.useState([]);
  const [loadingProfesionales, setLoadingProfesionales] = React.useState(false);
  const [mostrarModalSeleccionProfesionales, setMostrarModalSeleccionProfesionales] = React.useState(false);
  const [asignacionesExistentesObra, setAsignacionesExistentesObra] = React.useState([]);

  // Estados para modo edición
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
  const [calendarioVersion, setCalendarioVersion] = React.useState(0); // Contador para forzar regeneración
  const [filtroEstadoEtapa, setFiltroEstadoEtapa] = React.useState('TODAS');
  const [diaSeleccionado, setDiaSeleccionado] = React.useState(null);
  const [mostrarModalDetalleDia, setMostrarModalDetalleDia] = React.useState(false);

  // Ref para evitar actualizar el presupuesto múltiples veces
  const presupuestoAsignadoRef = React.useRef(new Set());

  // Ref para controlar la inicialización de la página
  const inicializadoRef = React.useRef(false);

  // Estado para modal de envío de obra independiente
  const [mostrarModalEnviarObra, setMostrarModalEnviarObra] = React.useState(false);
  const [obraParaEnviar, setObraParaEnviar] = React.useState(null);

  // Estados para modales de estadísticas
  const [mostrarModalEstadisticasObra, setMostrarModalEstadisticasObra] = React.useState(false);
  const [obraParaEstadisticas, setObraParaEstadisticas] = React.useState(null);
  const [mostrarModalEstadisticasTodasObras, setMostrarModalEstadisticasTodasObras] = React.useState(false);
  const [mostrarDropdownEstadisticas, setMostrarDropdownEstadisticas] = React.useState(false);

  // Callback memoizado para abrir modal de detalle de día
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
    // Campos para dirección detallada de la obra
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

  // Helper para mostrar información del cliente
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

  // Leer parámetro tab de la URL y activar pestaña correspondiente
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && (tabParam === 'crear' || tabParam === 'trabajos-extra' || tabParam === 'listado' || tabParam === 'obras-manuales')) {
      dispatch(setActiveTab(tabParam));
      // Limpiar el parámetro de la URL después de usarlo
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
        console.error('Error cargando estados disponibles:', error);
        if (error.includes('No static resource')) {
          showNotification('Backend: El controlador de obras no está disponible. Verifique la configuración del servicio IObraService.', 'warning');
        } else {
          showNotification('Error conectando con el backend de obras', 'error');
        }
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

  // 🔧 Construir mapa de relaciones obra padre -> obras trabajo extra
  useEffect(() => {
    if (!obras || obras.length === 0) {
      setMapObraPadre({});
      return;
    }

    const mapa = {};
    obras.forEach(obra => {
      if (obra.esTrabajoExtra) {
        // 🔍 El backend debería enviar obraPadreId indicando qué obra generó este trabajo extra
        // Este valor proviene del presupuesto que creó esta obra (campo obraId del presupuesto)
        const obraPadreId = obra.obraPadreId || obra.obra_padre_id || obra.idObraPadre;

        if (obraPadreId) {
          if (!mapa[obraPadreId]) {
            mapa[obraPadreId] = [];
          }
          mapa[obraPadreId].push(obra.id);
          console.log(`🔗 Obra ${obra.id} (${obra.nombre}) es trabajo extra de obra ${obraPadreId}`);
        } else {
          console.warn(`⚠️ Obra ${obra.id} (${obra.nombre}) marcada como trabajo extra pero sin obraPadreId`);
        }
      }
    });

    setMapObraPadre(mapa);
    if (Object.keys(mapa).length > 0) {
      console.log('📊 Mapa de obras padre construido:', mapa);
    }
  }, [obras]);

  // Cargar obras cuando cambie el filtro de estado
  useEffect(() => {
    if (empresaId) {
      cargarObrasSegunFiltro();
    }
  }, [estadoFilter, empresaId]);

  // 🆕 Enriquecer obras con presupuestos completos para que el badge funcione
  useEffect(() => {
    const enriquecerObrasConPresupuestos = async () => {
      if (!obras || obras.length === 0 || !empresaId) return;

      try {
        // Obtener todos los presupuestos de la empresa CON CACHE BUST
        const todosPresupuestos = await api.presupuestosNoCliente.getAll(empresaId, { _t: Date.now() });

        // Crear objeto con presupuestos indexados por obraId
        const presupuestosPorObra = {};
        // Para cada obra, guardar el presupuesto con la versión más alta
        todosPresupuestos.forEach(presupuesto => {
          const obraId = presupuesto.obraId || presupuesto.idObra;
          if (obraId) {
            if (!presupuestosPorObra[obraId] || (presupuesto.numeroVersion > (presupuestosPorObra[obraId].numeroVersion || 0))) {
              presupuestosPorObra[obraId] = presupuesto;
              console.log(`📦 Presupuesto obra ${obraId}: versión ${presupuesto.numeroVersion}, ${presupuesto.tiempoEstimadoTerminacion} días`);
            }
          }
        });

        // Guardar en estado para que el badge pueda acceder
        setPresupuestosObras(presupuestosPorObra);
        console.log('✅ Presupuestos cargados:', Object.keys(presupuestosPorObra).length);

      } catch (error) {
        console.warn('⚠️ No se pudieron cargar presupuestos para badges:', error);
      }
    };

    enriquecerObrasConPresupuestos();
  }, [obras?.length, empresaId]);

  // Cargar configuración desde BD cuando cambia la obra seleccionada
  useEffect(() => {
    if (selectedObraId && empresaId) {
      cargarYSincronizarConfiguracion(selectedObraId)
        .then(config => {
          if (config) {
            setConfigCargada(prev => prev + 1); // Forzar re-render
          }
        })
        .catch(err => {
          console.error('Error al cargar configuración:', err);
        });
    }
  }, [selectedObraId, empresaId]);

  // 🔄 Refrescar presupuesto de la obra seleccionada para usar días hábiles actuales
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

        setPresupuestosObras(prev => ({
          ...prev,
          [obraParaEtapasDiarias.id]: presupuestoActualizado
        }));
      } catch (error) {
        console.warn('⚠️ No se pudo refrescar presupuesto de la obra seleccionada:', error);
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
  //       setConfigCargada(prev => prev + 1); // Forzar re-render después de cargar todas
  //     });
  //   }
  // }, [obras.length, empresaId]); // Solo cuando cambia la cantidad de obras o empresa


  // Enviar controles al Sidebar
  useEffect(() => {
    // No ejecutar este efecto si estamos en modo edición o en el tab de crear
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
        handleNuevo: () => dispatch(setActiveTab('crear')),
        handleBuscarPorCliente,
        handleCargarEstadisticas,
        handleVerEstadisticasObraSeleccionada,
        handleVerEstadisticasTodasObras,
        esObraManual: !tienePresupuesto, // Nuevo: indica si es obra independiente (sin presupuesto)
        handleEditar: () => {
          if (selectedObraId) {
            const obra = obras.find(o => o.id === selectedObraId);
            if (obra) {
              // Verificar si tiene presupuesto
              const tienePresupuesto = (presupuestosObras[obra.id] && typeof presupuestosObras[obra.id] === 'object') ||
                                      (obra.presupuestoNoCliente && typeof obra.presupuestoNoCliente === 'object');

              if (tienePresupuesto) {
                showNotification('⚠️ No se puede editar una obra creada desde presupuesto', 'warning');
                return;
              }

              // Cargar datos de la obra en el formulario
              // Normalizar estado: mapear estados con tildes a estados válidos del backend
              const mapeoEstados = {
                'EN_PLANIFICACIÓN': 'BORRADOR',
                'EN_PLANIFICACION': 'BORRADOR',
                'EN PLANIFICACIÓN': 'BORRADOR',
                'EN_EJECUCIÓN': 'EN_EJECUCION',
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
                // Campos de dirección de obra
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
                  setTipoHonorarioJornalesObra(obra.tipoHonorarioJornalesObra || 'fijo');
                }
                if (obra.honorarioMaterialesObra != null) {
                  setHonorarioMaterialesObra(String(obra.honorarioMaterialesObra));
                  setTipoHonorarioMaterialesObra(obra.tipoHonorarioMaterialesObra || 'fijo');
                }
                if (obra.honorarioGastosGeneralesObra != null) {
                  setHonorarioGastosGeneralesObra(String(obra.honorarioGastosGeneralesObra));
                  setTipoHonorarioGastosGeneralesObra(obra.tipoHonorarioGastosGeneralesObra || 'fijo');
                }
                if (obra.honorarioMayoresCostosObra != null) {
                  setHonorarioMayoresCostosObra(String(obra.honorarioMayoresCostosObra));
                  setTipoHonorarioMayoresCostosObra(obra.tipoHonorarioMayoresCostosObra || 'fijo');
                }

                // Restaurar descuentos base si existen
                if (obra.descuentoJornalesObra != null) {
                  setDescuentoJornalesObra(String(obra.descuentoJornalesObra));
                  setTipoDescuentoJornalesObra(obra.tipoDescuentoJornalesObra || 'fijo');
                }
                if (obra.descuentoMaterialesObra != null) {
                  setDescuentoMaterialesObra(String(obra.descuentoMaterialesObra));
                  setTipoDescuentoMaterialesObra(obra.tipoDescuentoMaterialesObra || 'fijo');
                }
                if (obra.descuentoGastosGeneralesObra != null) {
                  setDescuentoGastosGeneralesObra(String(obra.descuentoGastosGeneralesObra));
                  setTipoDescuentoGastosGeneralesObra(obra.tipoDescuentoGastosGeneralesObra || 'fijo');
                }
                if (obra.descuentoMayoresCostosObra != null) {
                  setDescuentoMayoresCostosObra(String(obra.descuentoMayoresCostosObra));
                  setTipoDescuentoMayoresCostosObra(obra.tipoDescuentoMayoresCostosObra || 'fijo');
                }

                // Restaurar descuentos sobre honorarios si existen
                if (obra.descuentoHonorarioJornalesObra != null) {
                  setDescuentoHonorarioJornalesObra(String(obra.descuentoHonorarioJornalesObra));
                  setTipoDescuentoHonorarioJornalesObra(obra.tipoDescuentoHonorarioJornalesObra || 'fijo');
                }
                if (obra.descuentoHonorarioMaterialesObra != null) {
                  setDescuentoHonorarioMaterialesObra(String(obra.descuentoHonorarioMaterialesObra));
                  setTipoDescuentoHonorarioMaterialesObra(obra.tipoDescuentoHonorarioMaterialesObra || 'fijo');
                }
                if (obra.descuentoHonorarioGastosGeneralesObra != null) {
                  setDescuentoHonorarioGastosGeneralesObra(String(obra.descuentoHonorarioGastosGeneralesObra));
                  setTipoDescuentoHonorarioGastosGeneralesObra(obra.tipoDescuentoHonorarioGastosGeneralesObra || 'fijo');
                }
                if (obra.descuentoHonorarioMayoresCostosObra != null) {
                  setDescuentoHonorarioMayoresCostosObra(String(obra.descuentoHonorarioMayoresCostosObra));
                  setTipoDescuentoHonorarioMayoresCostosObra(obra.tipoDescuentoHonorarioMayoresCostosObra || 'fijo');
                }

                console.log('📂 Desglose obra restaurado desde DTO:', obra);
              } else {
                setUsarDesgloseObra(false);
                setImporteMaterialesObra('');
                setImporteJornalesObra('');
                setImporteHonorariosObra('');
                setTipoHonorariosObra('fijo');
                setImporteMayoresCostosObra('');
                setTipoMayoresCostosObra('fijo');
                setImporteTotalObra('');
              }

              // Activar modo edición
              setModoEdicion(true);
              setObraEditando(obra);

              // Cambiar a la pestaña de crear/editar
              dispatch(setActiveTab('crear'));
            }
          } else {
            showNotification('Seleccione una obra para editar', 'warning');
          }
        },
        handleEliminar: () => {
          if (selectedObraId) {
            handleEliminarObra(selectedObraId);
          } else {
            showNotification('Seleccione una obra para eliminar', 'warning');
          }
        },
        handleVerProfesionales: () => {
          // Si hay una obra seleccionada, mostrar solo esa obra
          if (selectedObraId) {
            const obra = obras.find(o => o.id === selectedObraId);
            if (obra) {
              setObraParaVerAsignaciones(obra);
              setMostrarModalVerAsignaciones(true);
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
            const obra = obras.find(o => o.id === selectedObraId);
            if (obra) {
              cargarEtapasDiarias(obra);
              dispatch(setActiveTab('etapas-diarias'));
            }
          } else {
            showNotification('Seleccione una obra para ver el cronograma', 'warning');
          }
        },
        handleEnviarObra: () => {
          if (selectedObraId) {
            const obra = obras.find(o => o.id === selectedObraId);
            if (obra) {
              // Verificar que sea obra independiente (sin presupuesto)
              const tienePresupuesto = (presupuestosObras[obra.id] && typeof presupuestosObras[obra.id] === 'object') ||
                                      (obra.presupuestoNoCliente && typeof obra.presupuestoNoCliente === 'object');

              if (tienePresupuesto) {
                showNotification('⚠️ Solo se pueden enviar obras independientes (sin presupuesto asociado)', 'warning');
                return;
              }

              setObraParaEnviar(obra);
              setMostrarModalEnviarObra(true);
            }
          } else {
            showNotification('Seleccione una obra independiente para enviar', 'warning');
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
      console.log('🔧 Configurando controles de trabajos extra, seleccionado:', trabajoExtraSeleccionado);
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
            showNotification('📅 Modo edición de fechas: Solo puede modificar fechas.\nEl estado y versión se preservarán.', 'info');
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
                  showNotification('✅ Trabajo extra marcado como listo para enviar', 'success');
                  cargarTrabajosExtra(obraParaTrabajosExtra);
                  setTrabajoExtraSeleccionado(null);
                })
                .catch(error => {
                  showNotification('❌ Error al cambiar estado: ' + error.message, 'error');
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
                  showNotification('✅ Trabajo extra marcado como "Listo para Enviar"', 'success');
                  cargarTrabajosExtra(obraParaTrabajosExtra);
                })
                .catch(error => {
                  showNotification('❌ Error al marcar trabajo extra: ' + error.message, 'error');
                });
            } else {
              showNotification(`Este trabajo extra ya está en estado ${trabajoExtraSeleccionado.estado}`, 'warning');
            }
          } else {
            showNotification('Seleccione un trabajo extra primero', 'warning');
          }
        },
        handleEnviarTrabajoExtra: () => {
          if (trabajoExtraSeleccionado) {
            // Mostrar modal de selección de envío
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
            // ✅ ACTIVAR FLAGS PARA WHATSAPP
            setAbrirWhatsAppTrabajoExtra(true);
            setAbrirEmailTrabajoExtra(false);

            console.log('📱 FLAGS ACTIVADOS para WhatsApp');
            showNotification('📱 Abre el modal, genera el PDF y envía por WhatsApp', 'info');
          } else if (tipo === 'email') {
            // ✅ ACTIVAR FLAGS PARA EMAIL
            setAbrirWhatsAppTrabajoExtra(false);
            setAbrirEmailTrabajoExtra(true);

            console.log('📧 FLAGS ACTIVADOS para Email');
            showNotification('📧 Abre el modal, genera el PDF y envía por Email', 'info');
          }

          setMostrarModalTrabajoExtra(true);
        },
        handleAprobar: () => {
          if (trabajoExtraSeleccionado) {
            // Cambiar estado a APROBADO
            if (trabajoExtraSeleccionado.estado === 'ENVIADO' || trabajoExtraSeleccionado.estado === 'A_ENVIAR') {
              api.presupuestosNoCliente.update(trabajoExtraSeleccionado.id, {
                ...trabajoExtraSeleccionado,
                estado: 'APROBADO',
                esPresupuestoTrabajoExtra: true
              }, empresaId)
                .then(() => {
                  showNotification('✅ Trabajo extra aprobado exitosamente', 'success');
                  cargarTrabajosExtra(obraParaTrabajosExtra);
                  setTrabajoExtraSeleccionado(null);
                })
                .catch(error => {
                  showNotification('❌ Error al aprobar: ' + error.message, 'error');
                });
            } else {
              showNotification('El trabajo extra debe estar en estado ENVIADO o A_ENVIAR para aprobarlo', 'warning');
            }
          } else {
            showNotification('Seleccione un trabajo extra para aprobar', 'warning');
          }
        },
        esTrabajosExtra: true, // Flag para que el sidebar sepa que está en modo trabajos extra
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
        console.log('🧹 Limpiando controles de trabajos extra');
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
        handleNuevo: () => dispatch(setActiveTab('crear')),
        handleVolver: () => {
          dispatch(setActiveTab('lista'));
        },
        esObrasIndependientes: true,
        conteoObras: obrasManuales.length,
        titulo: 'Obras Independientes'
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

      const presupuestos = {};

      // Cargar en lotes paralelos para mejorar performance
      const batchSize = 5;
      for (let i = 0; i < obras.length; i += batchSize) {
        const batch = obras.slice(i, i + batchSize);
        const promesas = batch.map(async (obra) => {
          try {
            const response = await fetch(
              `http://localhost:8080/api/presupuestos-no-cliente/por-obra/${obra.id}`,
              {
                headers: {
                  'empresaId': empresaId.toString(),
                  'Content-Type': 'application/json'
                }
              }
            );

            if (response.ok) {
              let data = await response.json();

              // Si es array, buscar presupuesto aprobado o en ejecución
              if (Array.isArray(data)) {
                const presupuesto = data.find(p => p.estado === 'EN_EJECUCION') ||
                                   data.find(p => p.estado === 'APROBADO');
                presupuestos[obra.id] = presupuesto || null;
              } else if (data && data.id) {
                presupuestos[obra.id] = data;
              } else {
                presupuestos[obra.id] = null;
              }
            } else if (response.status === 404) {
              presupuestos[obra.id] = null;
            }
          } catch (error) {
            console.error(`Error cargando presupuesto para obra ${obra.id}:`, error);
            presupuestos[obra.id] = null;
          }
        });

        await Promise.allSettled(promesas);
      }

      setPresupuestosObras(presupuestos);
    };

    cargarPresupuestos();
  }, [obrasIds, empresaId]);

  // 🔄 Cargar contadores automáticamente para todas las obras visibles (OPTIMIZADO)
  const contadoresCargadosRef = React.useRef(new Set());

  useEffect(() => {
    const cargarContadoresAutomaticamente = async () => {
      if (!obras || obras.length === 0 || !empresaId) return;

      // Filtrar solo obras que NO han sido cargadas
      const obrasPendientes = obras.filter(obra => !contadoresCargadosRef.current.has(obra.id));

      if (obrasPendientes.length === 0) return;

      // console.log('🔄 Cargando contadores para', obrasPendientes.length, 'obras nuevas');

      // Cargar contadores en paralelo (limitado a 5 simultáneas)
      const batchSize = 5;
      for (let i = 0; i < obrasPendientes.length; i += batchSize) {
        const batch = obrasPendientes.slice(i, i + batchSize);
        await Promise.allSettled(
          batch.map(async (obra) => {
            await cargarContadoresObra(obra.id);
            contadoresCargadosRef.current.add(obra.id);
          })
        );
      }

      console.log('✅ Contadores cargados');
    };

    cargarContadoresAutomaticamente();
  }, [obrasIds, empresaId]); // Usar obrasIds memoizado

  // Detectar cambios en presupuesto de la obra con modal de etapas abierto
  useEffect(() => {
    if (!obraParaEtapasDiarias || !obraParaEtapasDiarias.id) return;

    const presupuestoActualizado = presupuestosObras[obraParaEtapasDiarias.id];
    if (!presupuestoActualizado) return;

    const presupuestoActual = obraParaEtapasDiarias.presupuestoNoCliente;

    // Crear clave única para este presupuesto
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
    // 🔒 NO actualizar presupuesto para trabajos extra - mantener presupuesto precargado
    if (!obraParaEtapasDiarias._esTrabajoExtra) {
      presupuestoAsignadoRef.current.add(presupuestoKey);
      setObraParaEtapasDiarias(prev => ({
        ...prev,
        presupuestoNoCliente: presupuestoActualizado
      }));
    } else {
      console.log('🔒 [useEffect presupuestosObras] BLOQUEANDO actualización de presupuesto para TRABAJO EXTRA');
    }
  }, [presupuestosObras, obraParaEtapasDiarias?.id]);

  const cargarObrasSegunFiltro = async () => {
    try {
      if (!empresaId) {
        console.warn('No hay empresaId seleccionada, no se cargan obras');
        return;
      }



      if (estadoFilter === 'todas') {
        // Cargar obras por empresa (filtradas automáticamente por empresaId)
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
        // Cargar contadores cuando se expande
        if (estaExpandiendo) {
          cargarContadoresObra(obraId);
        }
      }
      return nuevas;
    });
  };

  // Función para actualizar obra completa (incluye profesionales)
  const handleActualizarObraCompleta = async () => {
    console.log(' handleActualizarObraCompleta INICIADO');
    console.log('📋 Obra a actualizar:', obraEditando);
    console.log('📝 Datos del formulario:', formData);

    try {
      // Validar campos obligatorios
      if (!formData.direccionObraCalle || !formData.direccionObraAltura) {
        console.log(' VALIDACIÓN FALLIDA: Faltan calle o altura');
        showNotification(' Los campos Calle y Altura son obligatorios', 'error');
        return;
      }

      // Detectar si salimos de SUSPENDIDA o CANCELADO
      const estadoAnterior = obraEditando.estado;
      const estadoNuevo = formData.estado || "BORRADOR";
      const saliendoDeSuspensionOCancelacion =
        (estadoAnterior === 'SUSPENDIDA' || estadoAnterior === 'CANCELADO') &&
        estadoNuevo !== estadoAnterior;

      // 🔍 DEBUG: Valores de variables de estado ANTES de construir payload
      console.log('🔍 DEBUG ESTADO DESGLOSE:');
      console.log('  usarDesgloseObra:', usarDesgloseObra);
      console.log('  importeJornalesObra:', importeJornalesObra);
      console.log('  importeMaterialesObra:', importeMaterialesObra);
      console.log('  importeGastosGeneralesObra:', importeGastosGeneralesObra);
      console.log('  importeMayoresCostosObra:', importeMayoresCostosObra);

      // Preparar datos para actualización
      const obraData = {
        id: obraEditando.id,
        nombre: formData.nombre || "",
        estado: estadoNuevo,
        fechaInicio: formData.fechaInicio || null,
        fechaFin: formData.fechaFin || null,
        presupuestoEstimado: formData.presupuestoEstimado ? parseFloat(formData.presupuestoEstimado) : null,
        descripcion: formData.descripcion || null,
        observaciones: formData.observaciones || null,
        // ⚠️ MAPEO CORRECTO SEGÚN ESPECIFICACIÓN BACKEND
        // Desglose de presupuesto - importes base (4 categorías)
        presupuestoJornales: usarDesgloseObra ? (parseFloat(importeJornalesObra) || null) : null,
        presupuestoMateriales: usarDesgloseObra ? (parseFloat(importeMaterialesObra) || null) : null,
        importeGastosGeneralesObra: usarDesgloseObra ? (parseFloat(importeGastosGeneralesObra) || null) : null,
        presupuestoMayoresCostos: usarDesgloseObra ? (parseFloat(importeMayoresCostosObra) || null) : null,

        // Honorarios individuales para cada categoría (8 campos)
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

        // Dirección de la obra
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

      // 📦 DEBUG: Payload final a enviar
      console.log('📦 PAYLOAD FINAL A ENVIAR:', JSON.stringify(obraData, null, 2));
      window.PAYLOAD_OBRA_UPDATE = obraData; // Para debugging en consola



      await dispatch(updateObra({ id: obraEditando.id, obraData })).unwrap();

      // Si salimos de SUSPENDIDA o CANCELADO, actualizar presupuesto a BORRADOR
      if (saliendoDeSuspensionOCancelacion) {
        try {
          console.log(`🔄 Obra sale de ${estadoAnterior} → ${estadoNuevo}. Actualizando presupuesto a BORRADOR...`);

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

            console.log('✅ Presupuesto actualizado a BORRADOR');
          } else {
            console.warn('⚠️ No se encontró presupuesto vinculado para actualizar');
          }
        } catch (error) {
          console.error('❌ Error actualizando presupuesto a BORRADOR:', error);
          showNotification('⚠️ Obra actualizada pero hubo un problema al actualizar el presupuesto', 'warning');
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

      // Salir del modo edición
      setModoEdicion(false);
      setObraEditando(null);

      // Limpiar estados del desglose de obra
      setUsarDesgloseObra(false);
      setImporteMaterialesObra('');
      setImporteJornalesObra('');
      setImporteGastosGeneralesObra('');
      setImporteMayoresCostosObra('');
      setHonorarioJornalesObra('');
      setTipoHonorarioJornalesObra('fijo');
      setHonorarioMaterialesObra('');
      setTipoHonorarioMaterialesObra('fijo');
      setHonorarioGastosGeneralesObra('');
      setTipoHonorarioGastosGeneralesObra('fijo');
      setHonorarioMayoresCostosObra('');
      setTipoHonorarioMayoresCostosObra('fijo');
      setDescuentoJornalesObra('');
      setTipoDescuentoJornalesObra('fijo');
      setDescuentoMaterialesObra('');
      setTipoDescuentoMaterialesObra('fijo');
      setDescuentoGastosGeneralesObra('');
      setTipoDescuentoGastosGeneralesObra('fijo');
      setDescuentoMayoresCostosObra('');
      setTipoDescuentoMayoresCostosObra('fijo');
      setDescuentoHonorarioJornalesObra('');
      setTipoDescuentoHonorarioJornalesObra('fijo');
      setDescuentoHonorarioMaterialesObra('');
      setTipoDescuentoHonorarioMaterialesObra('fijo');
      setDescuentoHonorarioGastosGeneralesObra('');
      setTipoDescuentoHonorarioGastosGeneralesObra('fijo');
      setDescuentoHonorarioMayoresCostosObra('');
      setTipoDescuentoHonorarioMayoresCostosObra('fijo');
      setImporteTotalObra('');

      // Cambiar a la pestaña de lista y recargar obras
      dispatch(setActiveTab('lista'));
      await cargarObrasSegunFiltro();

    } catch (error) {
      console.error(' Error actualizando obra:', error);
      showNotification(' Error actualizando obra: ' + error, 'error');
    }
  };

  const handleCrearObra = async () => {
    console.log('🔵 handleCrearObra LLAMADO');
    console.log('🔵 modoEdicion:', modoEdicion);
    console.log('🔵 obraEditando:', obraEditando);

    // Si estamos en modo edición, usar la función de actualización
    if (modoEdicion && obraEditando) {
      console.log('✅ Entrando en modo actualización');
      await handleActualizarObraCompleta();
      return;
    }

    console.log('✅ Entrando en modo creación');
    // Modo CREACIÓN (código original)

    try {
      // Validar campos obligatorios
      if (!formData.direccionObraCalle || !formData.direccionObraAltura) {
        console.log(' VALIDACIÓN FALLIDA: Faltan calle o altura');
        showNotification(' Los campos Calle y Altura son obligatorios', 'error');
        return;
      }

      // 🔍 Verificar si hay profesionales temporales (adhoc) que no se guardarán
      const profesionalesAdhoc = profesionalesAsignadosForm.filter(prof =>
        typeof prof.id === 'string' && prof.id.startsWith('adhoc_')
      );

      if (profesionalesAdhoc.length > 0) {
        const nombresAdhoc = profesionalesAdhoc.map(p => p.nombre).join(', ');
        const confirmar = window.confirm(
          `⚠️ Hay ${profesionalesAdhoc.length} profesional(es) temporal(es) que NO se guardarán con la obra:\n\n${nombresAdhoc}\n\n` +
          `Para incluirlos, debes marcar "Guardar en catálogo permanente" al agregarlos.\n\n` +
          `¿Deseas continuar creando la obra SIN estos profesionales?`
        );

        if (!confirmar) {
          return; // Cancelar creación
        }
      }



      // Si no hay cliente seleccionado ni datos de nuevo cliente, crear uno genérico
      let nombreSolicitanteFinal = formData.nombreSolicitante;
      if (!formData.idCliente && !nombreSolicitanteFinal) {
        // Generar nombre de cliente automáticamente desde la dirección de la obra
        nombreSolicitanteFinal = `Cliente - ${formData.direccionObraCalle} ${formData.direccionObraAltura}`.trim();
        console.log(' €¢ Cliente genérico creado:', nombreSolicitanteFinal);
      }

      // Preparar datos según especificación del backend
      const obraData = {
        // Nombre: enviar vacío si no se ingresó (el backend lo generará automáticamente)
        nombre: formData.nombre || "",
        estado: formData.estado || "BORRADOR",
        fechaInicio: formData.fechaInicio || null,
        fechaFin: formData.fechaFin || null,
        presupuestoEstimado: formData.presupuestoEstimado ? parseFloat(formData.presupuestoEstimado) : null,
        descripcion: formData.descripcion || null,
        observaciones: formData.observaciones || null,
        // ⚠️ MAPEO CORRECTO SEGÚN ESPECIFICACIÓN BACKEND
        // Desglose de presupuesto - importes base (4 categorías)
        presupuestoJornales: usarDesgloseObra ? (parseFloat(importeJornalesObra) || null) : null,
        presupuestoMateriales: usarDesgloseObra ? (parseFloat(importeMaterialesObra) || null) : null,
        importeGastosGeneralesObra: usarDesgloseObra ? (parseFloat(importeGastosGeneralesObra) || null) : null,
        presupuestoMayoresCostos: usarDesgloseObra ? (parseFloat(importeMayoresCostosObra) || null) : null,

        // Honorarios individuales para cada categoría (8 campos)
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

        // Dirección de la obra (calle y altura son obligatorios)
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

        // Profesionales asignados (formato específico del backend)
        // 🚫 Filtrar profesionales adhoc (temporales) - solo enviar los guardados en BD
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

      console.log('�🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢');
      console.log('📤 PAYLOAD COMPLETO A ENVIAR AL BACKEND:');
      console.log('🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢');
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
        // Campos para dirección detallada de la obra
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
      setTipoHonorarioJornalesObra('fijo');
      setHonorarioMaterialesObra('');
      setTipoHonorarioMaterialesObra('fijo');
      setHonorarioGastosGeneralesObra('');
      setTipoHonorarioGastosGeneralesObra('fijo');
      setHonorarioMayoresCostosObra('');
      setTipoHonorarioMayoresCostosObra('fijo');
      setDescuentoJornalesObra('');
      setTipoDescuentoJornalesObra('fijo');
      setDescuentoMaterialesObra('');
      setTipoDescuentoMaterialesObra('fijo');
      setDescuentoGastosGeneralesObra('');
      setTipoDescuentoGastosGeneralesObra('fijo');
      setDescuentoMayoresCostosObra('');
      setTipoDescuentoMayoresCostosObra('fijo');
      setDescuentoHonorarioJornalesObra('');
      setTipoDescuentoHonorarioJornalesObra('fijo');
      setDescuentoHonorarioMaterialesObra('');
      setTipoDescuentoHonorarioMaterialesObra('fijo');
      setDescuentoHonorarioGastosGeneralesObra('');
      setTipoDescuentoHonorarioGastosGeneralesObra('fijo');
      setDescuentoHonorarioMayoresCostosObra('');
      setTipoDescuentoHonorarioMayoresCostosObra('fijo');
      setImporteTotalObra('');

      // Cambiar a la pestaña de lista y recargar obras
      dispatch(setActiveTab('lista'));
      await cargarObrasSegunFiltro();

    } catch (error) {
      console.error(' Error creando obra:', error);

      // Mensaje específico segúnn el tipo de error
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

      // Si cambió fechaInicio, actualizar también el presupuesto
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
            // 🔒 NO actualizar presupuesto para trabajos extra - mantener presupuesto precargado
            if (obraParaEtapasDiarias && obraParaEtapasDiarias.id === id && !obraParaEtapasDiarias._esTrabajoExtra) {
              const obraActualizada = { ...obraParaEtapasDiarias, presupuestoNoCliente: presupuestoActualizado };
              setObraParaEtapasDiarias(obraActualizada);
            } else if (obraParaEtapasDiarias && obraParaEtapasDiarias.id === id && obraParaEtapasDiarias._esTrabajoExtra) {
              console.log('🔒 [handleModificarFechaInicio] BLOQUEANDO actualización de presupuesto para TRABAJO EXTRA');
            }

            console.log(' Presupuesto actualizado con nueva fecha de inicio');
          } catch (error) {
            console.warn(' ⚠️ No se pudo actualizar la fecha del presupuesto:', error);
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
    const confirmMessage = `¿está seguro de eliminar la obra "${obra?.nombre || id}"?\n\n` +
      ` ⚠️ ADVERTENCIA: Se eliminarán en cascada:\n` +
      ` Todos los profesionales asignados\n` +
      ` Todos los presupuestos asociados\n` +
      ` Todos los cobros registrados\n` +
      ` Todos los costos de obra\n` +
      ` Todos los honorarios\n` +
      ` Todos los pedidos de pago\n\n` +
      `Esta acción NO se puede deshacer.`;

    if (!window.confirm(confirmMessage)) return;

    try {
      showNotification('Eliminando obra...', 'info');

      // Usar el nuevo endpoint de eliminación en cascada
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
      console.log('Resultado de eliminación:', resultado);

      // El backend ahora retorna simplemente { mensaje: "..." }
      const mensajeExito = resultado.mensaje || 'Obra eliminada exitosamente';

      showNotification(mensajeExito, 'success');

      // Recargar la lista (esto actualizará Redux automáticamente)
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
      showNotification('Seleccione un estado válido', 'warning');
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
    // Alternar mostrar dropdown de estadísticas
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
      showNotification('No hay obras para mostrar estadísticas', 'warning');
      return;
    }

    setMostrarModalEstadisticasTodasObras(true);
    setMostrarDropdownEstadisticas(false);
  };

  const handleCargarProfesionales = async (obraId) => {
    try {
      await dispatch(fetchProfesionalesAsignados(obraId)).unwrap();
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

  // ==================== FUNCIONES TRABAJOS EXTRA ====================

  /**
   * 🔑 Normaliza datos de trabajo extra desde BD
   * Mapea obra_id → obraId para consistencia del frontend
   */
  const normalizarTrabajoExtra = (trabajo) => {
    if (!trabajo) return null;
    return {
      ...trabajo,
      // 🔑 Asegurar que tenga obraId mapeado desde obra_id si viene de BD
      obraId: trabajo.obraId ?? trabajo.obra_id ?? null,
      idObra: trabajo.idObra ?? trabajo.obra_id ?? null
    };
  };

  /**
   * 🔑 Extrae profesionales, materiales y gastos de itemsCalculadora[]
   * Para trabajos extra, estos datos están en el JSON, NO en tablas relacionales
   */
  const extraerDatosDeItemsCalculadora = (trabajo) => {
    const profesionales = [];
    const materiales = [];
    const gastosGenerales = [];

    if (!trabajo.itemsCalculadora || !Array.isArray(trabajo.itemsCalculadora)) {
      console.log(`  📋 Trabajo ${trabajo.id}: No tiene itemsCalculadora`);
      return { profesionales, materiales, gastosGenerales };
    }

    console.log(`  📋 Trabajo ${trabajo.id}: Procesando ${trabajo.itemsCalculadora.length} items de calculadora`);

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
            descripcion: gasto.descripcion || 'Gasto sin descripción',
            cantidad: gasto.cantidad || 1,
            precioUnitario: gasto.precioUnitario || 0,
            subtotal: gasto.subtotal || 0,
            observaciones: gasto.observaciones || null
          });
        });
      }
    });

    console.log(`  ✅ Trabajo ${trabajo.id}: Extraídos ${profesionales.length} profesionales, ${materiales.length} materiales, ${gastosGenerales.length} gastos`);

    return { profesionales, materiales, gastosGenerales };
  };

  const cargarTrabajosExtra = async (obra) => {
    if (!obra) {
      console.warn('⚠️ No hay obra para cargar trabajos extra');
      return;
    }

    try {
      setLoadingTrabajosExtra(true);
      // 🔧 Usar _obraOriginalId si estamos dentro de un trabajo extra, sino usar id directamente
      const obraIdParaAPI = obra._obraOriginalId || obra.id;
      const data = await api.presupuestosNoCliente.getAll(empresaSeleccionada.id, { obraId: obraIdParaAPI, esPresupuestoTrabajoExtra: true });

      // 🔧 FILTRAR solo los que son trabajos extra (backend puede no estar filtrando correctamente)
      const soloTrabajosExtra = (Array.isArray(data) ? data : []).filter(p =>
        p.esPresupuestoTrabajoExtra === true || p.esPresupuestoTrabajoExtra === 'V'
      );

      // 🔑 Normalizar datos para asegurar que tienen obraId
      const dataNormalizada = soloTrabajosExtra.map(normalizarTrabajoExtra);

      // ✅ EXTRAER DATOS DE ITEMSCALCULADORA para trabajos extra
      // Los trabajos extra NO usan tablas relacionales, todo está en itemsCalculadora[]
      const trabajosEnriquecidos = await Promise.all(dataNormalizada.map(async (trabajo) => {
        try {
          // 🔑 EXTRAER profesionales, materiales y gastos de itemsCalculadora[]
          const { profesionales: profesionalesReales, materiales: materialesReales, gastosGenerales: gastosReales } =
            extraerDatosDeItemsCalculadora(trabajo);

          // NOTA: Para trabajos extra, NO llamamos a APIs relacionales
          // porque los datos YA ESTÁN en itemsCalculadora[] que viene del backend

          return {
            ...trabajo,
            profesionales: profesionalesReales,
            materiales: materialesReales,
            gastosGenerales: gastosReales,
            etapasDiarias: trabajo.etapasDiarias || [],
            dias: trabajo.dias || []
          };
        } catch (error) {
          console.error(`❌ Error procesando trabajo extra ${trabajo.id}:`, error);
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

      // 🔧 FILTRAR: Si estamos dentro de un trabajo extra gestionando sus sub-trabajos extra,
      // excluir el trabajo extra actual de la lista para evitar que aparezca a sí mismo
      let trabajosFiltrados = trabajosEnriquecidos;

      const esTrabajoExtra = obra._esTrabajoExtra || obra.esObraTrabajoExtra || obra.es_obra_trabajo_extra || obra.esTrabajoExtra;

      if (esTrabajoExtra && trabajoExtraId) {
        trabajosFiltrados = trabajosEnriquecidos.filter(t => {
          // Comparar con múltiples campos posibles para asegurar que excluimos el trabajo extra correcto
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
        showNotification(' ⚠️ El módulo de Trabajos Extra aún no está disponible en el backend', 'warning');
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
    console.log('🔍 Trabajo extra a editar:', trabajo);
    console.log('📅 Fechas en trabajo:', {
      createdAt: trabajo.createdAt,
      updatedAt: trabajo.updatedAt,
      fechaProbableInicio: trabajo.fechaProbableInicio,
      vencimiento: trabajo.vencimiento
    });
    setTrabajoExtraEditar(trabajo);
    setMostrarModalTrabajoExtra(true);
  };

  const handleEliminarTrabajoExtra = async (trabajoId) => {
    if (!window.confirm('¿Está seguro de eliminar este trabajo extra?')) {
      return;
    }

    try {
      await api.presupuestosNoCliente.delete(trabajoId, empresaSeleccionada.id);
      showNotification('Trabajo extra eliminado exitosamente', 'success');
      await cargarTrabajosExtra(obraParaTrabajosExtra);
    } catch (error) {
      console.error('Error eliminando trabajo extra:', error);

      if (error.status === 404 || error.response?.status === 404 || error.message?.includes('404')) {
        showNotification(' ⚠️ El módulo de Trabajos Extra aún no está disponible en el backend', 'warning');
      } else {
        showNotification('Error al eliminar el trabajo extra: ' + (error.message || 'Error desconocido'), 'error');
      }
    }
  };

  const handleGuardadoTrabajoExtra = async (datosPresupuesto) => {
    try {
      console.log('💾 Guardando trabajo extra como presupuestoNoCliente:', datosPresupuesto);
      console.log('📝 Trabajo extra en edición:', trabajoExtraEditar);

      // ✅ USAR EL FORMATO DE PRESUPUESTO NO CLIENTE (el modal ya lo prepara correctamente)
      // El modal PresupuestoNoClienteModal ya envía los datos en el formato correcto
      const presupuestoData = {
        ...datosPresupuesto,
        // 🔧 CRÍTICO: Marcar como trabajo extra
        esPresupuestoTrabajoExtra: true,
        // Asegurar que tenga obraId
        obraId: obraParaTrabajosExtra?.id || datosPresupuesto.obraId,
        idObra: obraParaTrabajosExtra?.id || datosPresupuesto.idObra,
        // Empresa
        idEmpresa: empresaSeleccionada?.id || datosPresupuesto.idEmpresa
      };

      console.log('🔗 ObraId vinculada al trabajo extra:', presupuestoData.obraId, '(Obra:', obraParaTrabajosExtra?.nombre || 'sin nombre', ')');
      console.log('📦 Datos para presupuesto no cliente (trabajo extra):', presupuestoData);

      let response;

      // Detectar si es edición o creación
      if (trabajoExtraEditar && trabajoExtraEditar.id) {
        // EDITAR presupuesto existente (trabajo extra)
        console.log('✏️ Editando presupuesto trabajo extra ID:', trabajoExtraEditar.id);
        console.log('🔑 Empresa seleccionada ID:', empresaSeleccionada.id);
        console.log('📤 Enviando PUT a /api/v1/presupuestos-no-cliente/' + trabajoExtraEditar.id);

        response = await api.presupuestosNoCliente.update(
          trabajoExtraEditar.id,
          presupuestoData,
          empresaSeleccionada.id
        );
        console.log('✅ Presupuesto trabajo extra actualizado:', response);
        showNotification('Trabajo extra actualizado exitosamente', 'success');
      } else {
        // CREAR nuevo presupuesto (trabajo extra)
        console.log('➕ Creando nuevo presupuesto trabajo extra');
        console.log('📤 Enviando POST a /api/v1/presupuestos-no-cliente');

        response = await api.presupuestosNoCliente.create(presupuestoData, empresaSeleccionada.id);
        console.log('✅ Presupuesto trabajo extra creado:', response);
        showNotification('Trabajo extra creado exitosamente', 'success');
      }

      // Recargar los trabajos extra (ahora desde presupuestos-no-cliente con filtro)
      console.log('🔄 Recargando trabajos extra para obra:', obraParaTrabajosExtra?.id, obraParaTrabajosExtra?.nombre);
      await cargarTrabajosExtra(obraParaTrabajosExtra);
      console.log('✅ Trabajos extra recargados correctamente');

      // 🏗️ AUTO-GENERAR OBRA SI EL PRESUPUESTO ESTÁ APROBADO
      if (presupuestoData.estado === 'APROBADO') {
        console.log('🏗️ Presupuesto APROBADO detectado - Generando obra automáticamente...');
        try {
          // Obtener el ID del presupuesto guardado
          const presupuestoId = response?.data?.id || response?.id || trabajoExtraEditar?.id;

          const obraData = {
            nombre: presupuestoData.nombreObra || presupuestoData.nombreObraManual || `Trabajo Extra #${presupuestoId}`,
            direccion: presupuestoData.direccionObraCalle || obraParaTrabajosExtra?.direccion || 'Dirección no especificada',
            direccionObraCalle: presupuestoData.direccionObraCalle || '',
            direccionObraAltura: presupuestoData.direccionObraAltura || '',
            direccionObraBarrio: presupuestoData.direccionObraBarrio || '',
            direccionObraLocalidad: presupuestoData.direccionObraLocalidad || '',
            direccionObraProvincia: presupuestoData.direccionObraProvincia || '',
            direccionObraCodigoPostal: presupuestoData.direccionObraCodigoPostal || '',
            idEmpresa: empresaId,
            clienteId: presupuestoData.clienteId || obraParaTrabajosExtra?.clienteId,
            estado: 'APROBADO', // Obra en estado aprobado, lista para ejecución
            esTrabajoExtra: true, // 🔧 Marcar como trabajo extra
            obraPadreId: obraParaTrabajosExtra?.id, // Referencia a la obra padre
            nombreSolicitante: presupuestoData.nombreSolicitante || '',
            telefono: presupuestoData.telefono || '',
            mail: presupuestoData.mail || '',
            // Referencias para trazabilidad
            presupuestoOriginalId: presupuestoId,
            observaciones: `Obra generada automáticamente desde trabajo extra aprobado #${presupuestoId}.\n${presupuestoData.observaciones || ''}`
          };

          console.log('📤 Creando obra automáticamente:', obraData);
          const obraCreada = await dispatch(createObra({ obra: obraData, empresaId })).unwrap();
          console.log('✅ Obra creada automáticamente:', obraCreada);

          showNotification('✅ Presupuesto aprobado y obra creada automáticamente', 'success');

          // Recargar lista de obras principales para mostrar la nueva obra
          await dispatch(fetchObrasPorEmpresa(empresaId));
          console.log('✅ Lista de obras recargada');
        } catch (errorObra) {
          console.error('❌ Error al crear obra automáticamente:', errorObra);
          showNotification(
            '⚠️ Presupuesto guardado pero error al crear obra automáticamente: ' + (errorObra.message || 'Error desconocido'),
            'warning'
          );
        }
      }

      // Cerrar el modal
      setMostrarModalTrabajoExtra(false);
      setTrabajoExtraEditar(null);

      return response;
    } catch (error) {
      console.error('❌ Error al guardar trabajo extra:', error);
      console.error('❌ Detalles del error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      showNotification('Error al guardar el trabajo extra: ' + (error.message || 'Error desconocido'), 'error');
      throw error;
    }
  };

  // ✅ Función para cambiar estado de trabajo extra
  const handleCambiarEstadoTrabajoExtra = async (trabajo, nuevoEstado) => {
    try {
      if (!window.confirm(`¿Estás seguro de cambiar el estado a ${nuevoEstado}?`)) return;

      // 🔑 Normalizar el trabajo antes de enviar
      const trabajoNormalizado = {
        ...normalizarTrabajoExtra(trabajo),
        estado: nuevoEstado
      };

      // Normalizar campos para evitar errores de validación si faltan
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

  // ✅ Función para generar obra derivada desde trabajo extra aprobado
  const handleGenerarObraDesdeTrabajoExtra = async (trabajo) => {
    try {
      if (!window.confirm('¿Desea generar una nueva OBRA a partir de este trabajo extra aprobado?')) return;

      const obraData = {
        nombre: trabajo.nombre || `Trabajo Extra #${trabajo.id} - ${obraParaTrabajosExtra?.nombre || 'Obra Padre'}`,
        direccion: trabajo.direccionObraCalle || obraParaTrabajosExtra?.direccion || 'Dirección de obra padre',
        idEmpresa: empresaId,
        clienteId: trabajo.clienteId || obraParaTrabajosExtra?.clienteId,
        estado: 'EN_EJECUCION',
        // Referencias para trazabilidad
        presupuestoOriginalId: trabajo.id,
        observaciones: `Obra derivada del trabajo extra #${trabajo.id} de la obra ${obraParaTrabajosExtra?.nombre}. \n${trabajo.observaciones || ''}`
      };

      await dispatch(createObra({ obra: obraData, empresaId })).unwrap();
      showNotification('Obra derivada creada exitosamente', 'success');

      // Recargar lista de obras principales
      dispatch(fetchObrasPorEmpresa(empresaId));

    } catch (error) {
       console.error('Error generando obra derivada:', error);
       showNotification('Error al generar la obra derivada', 'error');
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
    setObraSeleccionadaTrabajosExtra(null); // Limpiar la selección
  };

  // ==================== FUNCIONES ETAPAS DIARIAS ====================

  // Helper para parsear fechas ISO como fechas locales (evitar problemas de zona horaria)
  const parseFechaLocal = (fechaISO) => {
    if (!fechaISO) return null;
    const [year, month, day] = fechaISO.split('T')[0].split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0); // Mediodía para evitar problemas de zona horaria
  };

  //  Feriados Argentina 2025-2026
  const feriadosArgentina = [
    '2025-01-01', // Año Nuevo
    '2025-02-24', // Carnaval
    '2025-02-25', // Carnaval
    '2025-03-24', // Día Nacional de la Memoria
    '2025-04-02', // Día del Veterano
    '2025-04-17', // Jueves Santo (puente)
    '2025-04-18', // Viernes Santo
    '2025-05-01', // Día del Trabajador
    '2025-05-25', // Revolución de Mayo
    '2025-06-16', // Día de Gü¼emes
    '2025-06-20', // Día de la Bandera
    '2025-07-09', // Día de la Independencia
    '2025-08-15', // Paso a la Inmortalidad del Gral. San Martín (puente)
    '2025-08-17', // Paso a la Inmortalidad del Gral. San Martín
    '2025-10-12', // Día del Respeto a la Diversidad Cultural (puente)
    '2025-10-13', // Día del Respeto a la Diversidad Cultural
    '2025-11-24', // Día de la Soberanía Nacional
    '2025-12-08', // Inmaculada Concepción
    '2025-12-25', // Navidad
    '2026-01-01', // Año Nuevo
    '2026-02-16', // Carnaval
    '2026-02-17', // Carnaval
    '2026-03-24', // Día Nacional de la Memoria
    '2026-04-02', // Día del Veterano
    '2026-04-03', // Viernes Santo
    '2026-05-01', // Día del Trabajador
    '2026-05-25', // Revolución de Mayo
    '2026-06-15', // Día de Gü¼emes (puente)
    '2026-06-20', // Día de la Bandera
    '2026-07-09', // Día de la Independencia
    '2026-08-17', // Paso a la Inmortalidad del Gral. San Martín
    '2026-10-12', // Día del Respeto a la Diversidad Cultural
    '2026-11-23', // Día de la Soberanía Nacional (puente)
    '2026-12-08', // Inmaculada Concepción
    '2026-12-25', // Navidad
  ];

  const esFeriado = (fecha) => {
    const fechaStr = fecha.toISOString().split('T')[0];
    return feriadosArgentina.includes(fechaStr);
  };

  // Calcular fecha de finalización estimada (solo días hábiles, excluyendo feriados)
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

    // Contar días hábiles desde la fecha de inicio (lunes-viernes, excluyendo feriados)
    while (diasContados < tiempoEstimado) {
      const diaSemana = fecha.getDay();
      // Contar solo lunes(1) a viernes(5) que NO sean feriados
      if (diaSemana >= 1 && diaSemana <= 5 && !esFeriado(fecha)) {
        diasContados++;
      }
      // Si aún no llegamos al total, avanzar un día
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

  // Helper para obtener configuración de obra desde localStorage (sincrónico)
  const obtenerConfiguracionObra = (obraId) => {
    // ✅ REPARADO: Verificar si la obra está configurada (tiene presupuesto con tiempoEstimadoTerminacion)
    const presupuestoObra = presupuestosObras[obraId];

    // Una obra está configurada si tiene presupuesto con tiempoEstimadoTerminacion definido
    if (presupuestoObra?.tiempoEstimadoTerminacion && parseInt(presupuestoObra.tiempoEstimadoTerminacion) > 0) {
      return presupuestoObra; // Retornar el presupuesto como configuración
    }

    // Fallback: verificar si hay configuración guardada en localStorage (de llamadas anteriores)
    try {
      const configGuardada = localStorage.getItem(`configuracionObra_${obraId}`);
      if (configGuardada) {
        return JSON.parse(configGuardada);
      }
    } catch (err) {
      console.warn(`⚠️ Error leyendo configuración de obra ${obraId} desde localStorage:`, err);
    }

    return null;
  };

  // Helper ASYNC para cargar configuración desde BD y sincronizar con localStorage
  const cargarYSincronizarConfiguracion = async (obraId) => {
    try {
      // Intentar obtener presupuesto de la obra primero (fuente de verdad)
      let diasHabilesReales = null;
      let semanasRealesCalculadas = null;
      const presupuestoObra = presupuestosObras[obraId];

      if (presupuestoObra?.tiempoEstimadoTerminacion) {
        diasHabilesReales = parseInt(presupuestoObra.tiempoEstimadoTerminacion);
        console.log(`📋 [ObrasPage] Días hábiles desde presupuesto: ${diasHabilesReales}`);

        // 🔥 Calcular semanas reales considerando feriados si hay fecha de inicio
        if (presupuestoObra.fechaProbableInicio && diasHabilesReales > 0) {
          try {
            const fechaInicio = parsearFechaLocal(presupuestoObra.fechaProbableInicio);
            semanasRealesCalculadas = calcularSemanasParaDiasHabiles(fechaInicio, diasHabilesReales);
            console.log(`📅 [ObrasPage] Semanas reales calculadas con feriados: ${semanasRealesCalculadas}`);
          } catch (error) {
            console.warn('⚠️ Error calculando semanas con feriados, usando fallback simple');
            semanasRealesCalculadas = convertirDiasHabilesASemanasSimple(diasHabilesReales);
          }
        }
      }

      // Intentar obtener desde las asignaciones de BD
      const { obtenerAsignacionesSemanalPorObra } = await import('../services/profesionalesObraService');
      const asignacionesResponse = await obtenerAsignacionesSemanalPorObra(obraId, empresaId);
      const asignaciones = Array.isArray(asignacionesResponse) ? asignacionesResponse : asignacionesResponse?.data || [];

      // Extraer semanas_objetivo de la primera asignación
      if (asignaciones.length > 0 && asignaciones[0].semanasObjetivo) {
        const semanasObjetivoOriginal = parseInt(asignaciones[0].semanasObjetivo);

        // 🔥 PRIORIDAD:
        // 1. Días hábiles del presupuesto (fuente de verdad)
        // 2. Semanas calculadas con feriados desde presupuesto
        // 3. Semanas desde BD
        // 4. Fallback: semanas × 5
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
        console.log(`✅ [ObrasPage] Configuración recuperada desde BD y guardada en localStorage:`, config);

        return config;
      }

      return null;
    } catch (err) {
      console.warn('⚠️ [ObrasPage] No se pudo cargar configuración desde BD:', err);
      return null;
    }
  };

  // Función para refrescar profesionales disponibles
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
        // Y contar cuántas obras tiene cada profesional
        const profesionalesAsignados = new Set();
        const contadorObrasPorProfesional = new Map(); // profesionalId -> cantidad de obras

        // Consultar asignaciones de cada obra
        const promesasAsignaciones = todasObras.map(async (obra) => {
          try {
            const response = await obtenerAsignacionesSemanalPorObra(obra.id, empresaId);
            const asignaciones = response.data || response || [];

            // Set para evitar contar el mismo profesional múltiples veces en la misma obra
            const profesionalesEnEstaObra = new Set();

            // Procesar cada asignación para extraer profesionales
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
            // Si una obra falla, continuar con las demás
            console.warn(`⚠️ Error obteniendo asignaciones para obra ${obra.id}:`, errorObra.message);
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

        console.log(`🔄 Profesionales actualizados: ${todosProfesionales.length} total, ${profesionalesActivos.length} activos, ${profesionalesAsignados.size} asignados, ${profesionalesDisponiblesActualizados.length} disponibles`);
        console.log(`🔍 IDs de profesionales asignados:`, Array.from(profesionalesAsignados));
        console.log(`📊 Contador de obras por profesional:`, Object.fromEntries(contadorObrasPorProfesional));

        setProfesionalesDisponibles(profesionalesDisponiblesActualizados);

        // Emitir evento para que otros componentes se actualicen
        // Crear copia profunda para asegurar que React detecte el cambio
        const profesionalesParaEvento = todosProfesionales.map(prof => ({...prof}));
        console.log(`📡 Emitiendo evento PROFESIONALES_ACTUALIZADOS con ${profesionalesParaEvento.length} profesionales`);

        eventBus.emit(FINANCIAL_EVENTS.PROFESIONALES_ACTUALIZADOS, {
          profesionales: profesionalesParaEvento,
          disponibles: profesionalesDisponiblesActualizados,
          asignados: Array.from(profesionalesAsignados),
          empresaId
        });

      } catch (errorAsignaciones) {
        console.warn('⚠️ Error obteniendo asignaciones para filtrar disponibilidad:', errorAsignaciones);
        // Si falla, mostrar todos los profesionales activos como fallback
        setProfesionalesDisponibles(profesionalesActivos);
      }

    } catch (error) {
      console.error('❌ Error refrescando profesionales disponibles:', error);
    } finally {
      setLoadingProfesionales(false);
    }
  };

  // Generar calendario automático basado en jornales del presupuesto
  const generarCalendarioAutomatico = (obra) => {

    // USAR itemsCalculadora en lugar de detalles, pero permitir continuar si no existen
    const items = obra?.presupuestoNoCliente?.itemsCalculadora || obra?.presupuestoNoCliente?.detalles;

    // Sumar TODOS los jornales de todos los items (para referencia, pero NO se usa para calendario)
    const jornalesPresupuesto = items && Array.isArray(items)
      ? items.reduce((sum, item) => sum + (parseInt(item.cantidadJornales) || 0), 0)
      : 0;

    // ✅ Configuración: SOLO para obras normales (trabajos extra NUNCA usan configuración de obra)
    const configuracion = obra._esTrabajoExtra
      ? obra.configuracionPlanificacion || null
      : obtenerConfiguracionObra(obra.id);

    // 🔥 PRIORIZAR presupuesto sobre configuración vieja
    let totalJornales;

    if (obra.presupuestoNoCliente?.tiempoEstimadoTerminacion > 0) {
      totalJornales = parseInt(obra.presupuestoNoCliente.tiempoEstimadoTerminacion);
    } else if (!obra._esTrabajoExtra && configuracion && configuracion.diasHabiles > 0) {
      // ✅ Solo obras normales pueden usar configuracion.diasHabiles (NUNCA trabajos extra)
      totalJornales = parseInt(configuracion.diasHabiles);
    } else {
      totalJornales = jornalesPresupuesto || 0;
    }

    // 🔥 LOG SIMPLE Y CLARO: Exactamente qué se está generando
    if (obra._esTrabajoExtra) {
      console.log(`🎯 [generarCalendarioAutomatico TE] Generando TRABAJO EXTRA con ${totalJornales} días hábiles (${Math.ceil(totalJornales / 5)} semanas)`);
    } else {
      console.log(`🎯 [generarCalendarioAutomatico OBRA] Generando obra con ${totalJornales} días hábiles (${Math.ceil(totalJornales / 5)} semanas)`);
    }

    // Permitir generación si hay fecha probable de inicio y días hábiles > 0
    if (!obra.presupuestoNoCliente?.fechaProbableInicio || totalJornales === 0) {
      console.warn(' Faltan datos mínimos para generar etapas automáticas (fecha probable de inicio o días hábiles)');
      return [];
    }

    //  €¢ Fecha de inicio: PRIORIDAD a fechaProbableInicio del presupuesto
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

    // Si es sábado (6) o domingo (0), avanzar al lunes siguiente
    if (diaSemana === 0) { // Domingo
      fechaInicio.setDate(fechaInicio.getDate() + 1); // Lunes siguiente
    } else if (diaSemana === 6) { // Sábado
      fechaInicio.setDate(fechaInicio.getDate() + 2); // Lunes siguiente
    }

    // Si es feriado, avanzar al siguiente día hábil
    while (esFeriado(fechaInicio) || fechaInicio.getDay() === 0 || fechaInicio.getDay() === 6) {
      fechaInicio.setDate(fechaInicio.getDate() + 1);
    }

    // Generar todos los días hábiles (lun-vie, excluyendo feriados)
    const diasHabiles = [];
    let fecha = new Date(fechaInicio);
    let diasGenerados = 0;

    while (diasGenerados < totalJornales) {
      const diaSemana = fecha.getDay();
      const fechaStr = fecha.toISOString().split('T')[0];

      // console.log(`  Evaluando ${fechaStr} (${fecha.toLocaleDateString('es-AR', { weekday: 'long' })}) - Día semana: ${diaSemana}`);

      // Solo lun-vie (1-5) y NO feriados
      if (diaSemana >= 1 && diaSemana <= 5) {
        if (esFeriado(fecha)) {
          // console.log(`     Es feriado, omitiendo`);
        } else {
          // console.log(`     Día hábil #${diasGenerados + 1} agregado`);
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
        // console.log(`     Fin de semana (${diaSemana === 0 ? 'domingo' : 'sábado'}), omitiendo`);
      }

      fecha.setDate(fecha.getDate() + 1);
    }

    // console.log(' Generación completa:', diasGenerados, 'días hábiles');

    //  Agrupar por semanas CALENDARIO (lun-vie)
    const semanas = [];
    const diasPorSemana = {};

    // Agrupar días por su semana calendario
    diasHabiles.forEach((dia) => {
      const fecha = new Date(dia.fecha + 'T00:00:00');

      // Encontrar el lunes de esta semana
      const diaSemana = fecha.getDay();
      const diasDesdeElLunes = diaSemana === 0 ? 6 : diaSemana - 1; // Si es domingo, son 6 días desde el lunes
      const lunes = new Date(fecha);
      lunes.setDate(lunes.getDate() - diasDesdeElLunes);

      // Usar la fecha del lunes como clave única para la semana
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

        //  €¢ GENERAR TODOS LOS DÃƒÂAS DE LA SEMANA (lun-vie) para visualización completa
        // PERO solo hasta el último día hábil en la última semana
        const esUltimaSemana = index === clavesOrdenadas.length - 1;
        const ultimoDiaHabil = esUltimaSemana ? diasHabiles[diasHabiles.length - 1].fecha : null;

        const diasCompletos = [];
        for (let i = 0; i < 5; i++) { // 5 días: lun-vie
          const fecha = new Date(lunesDate);
          fecha.setDate(fecha.getDate() + i);
          const fechaStr = fecha.toISOString().split('T')[0];

          // NO generar días anteriores a la fecha de inicio configurada
          const fechaInicioStr = fechaInicio.toISOString().split('T')[0];
          if (fechaStr < fechaInicioStr) {
            continue; // Saltar este día - no mostrar días antes del inicio de obra
          }

          // Si es la última semana y ya pasamos el último día hábil, no generar más días
          if (esUltimaSemana && ultimoDiaHabil && fechaStr > ultimoDiaHabil) {
            break;
          }

          // Buscar si este día tiene trabajo asignado (es uno de los 20 días hábiles)
          const diaConTrabajo = semanaData.dias.find(d => d.fecha === fechaStr);

          if (diaConTrabajo) {
            // Día hábil con trabajo asignado
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

        // Debug desactivado - genera demasiados logs (144 semanas × 5 días = 720+ líneas)
        // console.log(` Semana ${index + 1}:`, diasCompletos.length, 'días totales');
        // diasCompletos.forEach(d => {
        //   const tipo = d.esFeriado ? ' FERIADO' : (d.estado === 'FIN_DE_SEMANA' ? ' No laborable' : ` Día hábil`);
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
      console.log(' ⚠️ No hay obra seleccionada para etapas');
      return [];
    }

    // 🔥 Si es trabajo extra, FORZAR el uso del presupuesto precargado ORIGINAL
    // NUNCA permitir que se lea o se actualice desde presupuestosObras
    let presupuestoFinalSeguro;

    if (obraParaEtapasDiarias._esTrabajoExtra) {
      // Trabajo extra: SIEMPRE usar presupuestoNoCliente original (precargado)
      // NUNCA buscar en presupuestosObras porque podría estar contaminado con la obra padre
      presupuestoFinalSeguro = obraParaEtapasDiarias.presupuestoNoCliente;

      // Log de diagnóstico (sin hardcodes de valores específicos)
      if (!presupuestoFinalSeguro || !presupuestoFinalSeguro.tiempoEstimadoTerminacion) {
        console.warn('⚠️ ALERTA: Presupuesto de trabajo extra incompleto', presupuestoFinalSeguro);
      }
    } else {
      // Obra normal: usar del cache si está disponible
      const presupuestoFinal = presupuestosObras[obraParaEtapasDiarias.id] || obraParaEtapasDiarias.presupuestoNoCliente;
      presupuestoFinalSeguro = presupuestoFinal;
    }

    console.log(`🎯 [calendarioCompleto] ${obraParaEtapasDiarias._esTrabajoExtra ? 'TRABAJO EXTRA' : 'OBRA'} - Presupuesto final: ${presupuestoFinalSeguro?.tiempoEstimadoTerminacion} días (${Math.ceil((presupuestoFinalSeguro?.tiempoEstimadoTerminacion || 0) / 5)} semanas)`);
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
    obraParaEtapasDiarias?._esTrabajoExtra, // 🔥 Detectar cuando es trabajo extra
    obraParaEtapasDiarias?._trabajoExtraId,
    // Para obras normales: escuchar cambios en cache de presupuestos
    obraParaEtapasDiarias?._esTrabajoExtra ? null : presupuestosObras[obraParaEtapasDiarias?.id]?.fechaProbableInicio,
    obraParaEtapasDiarias?._esTrabajoExtra ? null : presupuestosObras[obraParaEtapasDiarias?.id]?.tiempoEstimadoTerminacion,
    // Para trabajos extra: escuchar cambios en presupuesto congelado en cache
    obraParaEtapasDiarias?._esTrabajoExtra ? presupuestosObras[`te_${obraParaEtapasDiarias?._trabajoExtraId}`]?.tiempoEstimadoTerminacion : null,
    obraParaEtapasDiarias?._esTrabajoExtra ? presupuestosObras[`te_${obraParaEtapasDiarias?._trabajoExtraId}`]?.fechaProbableInicio : null,
    // Fallback: también escuchar cambios en presupuesto pre-cargado
    obraParaEtapasDiarias?._esTrabajoExtra ? obraParaEtapasDiarias?.presupuestoNoCliente?.tiempoEstimadoTerminacion : null,
    obraParaEtapasDiarias?._esTrabajoExtra ? obraParaEtapasDiarias?.presupuestoNoCliente?.fechaProbableInicio : null,
    etapasDiarias,
    calendarioVersion // Contador que se incrementa cuando se actualiza el presupuesto o la configuración
  ]); // Regenerar cuando cambie la obra, las fechas del presupuesto, las etapas guardadas, o la configuración

  const cargarEtapasDiarias = async (obra) => {
    if (!obra) {
      console.error(' No se recibió obra para cargar etapas diarias');
      return;
    }

    if (!obra.id) {
      console.error(' La obra no tiene ID');
      showNotification('Error: La obra seleccionada no tiene ID válido', 'error');
      return;
    }

    try {
      setLoadingEtapasDiarias(true);

      // IMPORTANTE: Cargar el presupuestoNoCliente vinculado a la obra
      let obraCompleta = { ...obra };

      // 🔥 CORRECCIÓN: Usar obraId real en lugar de ID del trabajo extra
      const obraIdReal = obra._obraOriginalId || obra.obraId || obra.id;
      console.log('🔍 [cargarEtapasDiarias] obra.id:', obra.id, '| obraIdReal:', obraIdReal, '| esTrabajoExtra:', obra._esTrabajoExtra);

      // ✅ Si es trabajo extra y ya tiene presupuesto pre-cargado, usarlo tal cual (NO sobrescribir)
      if (obra._esTrabajoExtra && obra.presupuestoNoCliente) {
        console.log('✅ [Trabajo Extra] Usando presupuesto pre-cargado (no buscar en backend)');
        obraCompleta.presupuestoNoCliente = obra.presupuestoNoCliente;

        // 🔥 TAMBIÉN: Verificar si existe presupuesto congelado en cache y usar ESE en lugar del objeto
        const presupuestoCongelado = presupuestosObras[`te_${obra._trabajoExtraId}`];
        if (presupuestoCongelado) {
          console.log('✅ [Trabajo Extra] USANDO presupuesto CONGELADO del cache:', presupuestoCongelado.tiempoEstimadoTerminacion);
          obraCompleta.presupuestoNoCliente = presupuestoCongelado;
        }
      } else {
        // Solo para obras normales: buscar el presupuesto de mayor versión (ya sea en cache o backend)
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
            // Buscar el de mayor versión
            presupuestoMayorVersion = presupuestos.reduce((max, curr) =>
              (curr.numeroVersion > (max?.numeroVersion || 0) ? curr : max), presupuestos[0]
            );
            if (presupuestoMayorVersion) {
              // 🔥 BLOQUEO TOTAL: NUNCA tocar presupuestoNoCliente si es trabajo extra
              if (!obra._esTrabajoExtra) {
                obraCompleta.presupuestoNoCliente = presupuestoMayorVersion;
                setPresupuestosObras(prev => ({...prev, [obra.id]: presupuestoMayorVersion}));
              } else {
                console.log('🔒 [cargarEtapasDiarias] TRABAJO EXTRA - BLOQUEANDO sobrescritura de presupuestoNoCliente');
              }
            }
          } else {
            console.warn(' ⚠️ No se pudo cargar presupuesto (HTTP', response.status, ')');
          }
        } catch (errorPresupuesto) {
          console.warn(' ⚠️ Error cargando presupuesto de la obra:', errorPresupuesto);
        }
      }
        // 🔥 BLOQUEO TOTAL: NUNCA tocar presupuestoNoCliente si es trabajo extra
        if (presupuestoMayorVersion && !obra._esTrabajoExtra) {
          obraCompleta.presupuestoNoCliente = presupuestoMayorVersion;
        }
      }

      const data = await api.etapasDiarias.getAll(empresaSeleccionada.id, { obraId: obra.id });

      console.log('🔍 DATOS DEL BACKEND:', data);
      if (data && data.length > 0) {
        console.log('🔍 Primera etapa del backend - tareas:', data[0].tareas?.map(t => ({ desc: t.descripcion, estado: t.estado })));
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
        console.log('📝¦ BACKEND RESPONSE - Etapas Diarias:', JSON.stringify(data, null, 2));
        console.log('  Total etapas recibidas:', Array.isArray(data) ? data.length : 0);
      }
      setEtapasDiarias(etapasConProfesionales);
      console.log('🔥🔥🔥 [cargarEtapasDiarias] ANTES de setObraParaEtapasDiarias:', {
        obraCompletaId: obraCompleta.id,
        esTrabajoExtra: obraCompleta._esTrabajoExtra,
        presupuestoNoClienteTimepo: obraCompleta.presupuestoNoCliente?.tiempoEstimadoTerminacion,
        presupuestoNoClienteFecha: obraCompleta.presupuestoNoCliente?.fechaProbableInicio,
        OBRA_COMPLETA: obraCompleta
      });

      // 🔥 PROTECCIÓN CRÍTICA: Guardar presupuesto de trabajo extra en cache etiquetado
      // Esto PREVIENE que el presupuesto se contamine después de cerrar/reabrir
      if (obraCompleta._esTrabajoExtra && obraCompleta._trabajoExtraId && obraCompleta.presupuestoNoCliente) {
        console.log('🔒 [cargarEtapasDiarias] CONGELANDO presupuesto de trabajo extra en cache');
        setPresupuestosObras(prev => ({
          ...prev,
          [`te_${obraCompleta._trabajoExtraId}`]: obraCompleta.presupuestoNoCliente,
          // También guardar con clave _metadata para recuperarlo después
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
        showNotification(' ⚠️ El módulo de Etapas Diarias aún no está disponible en el backend', 'warning');
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

          // 🔒 Bloquear sobrescritura de presupuesto para trabajos extra
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
        console.warn(' ⚠️ Error cargando presupuesto tras error:', errorPresupuesto);
      }
      setObraParaEtapasDiarias(obraCompleta);

    } finally {
      setLoadingEtapasDiarias(false);
    }
  };

  const handleAbrirDia = (dia) => {
    // Si el día ya tiene ID, es edición

    // Si el día ya tiene ID, es edición
    if (dia.id) {
      setEtapaDiariaEditar(dia);
    } else {
      // Nuevo día, pre-cargar fecha
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
    e.stopPropagation(); // Evitar que abra el modal del día



    if (!dia.id) {
      showNotification('Debe guardar el día antes de cambiar estados de tareas', 'warning');
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
          // Actualizar solo el estado, preservando TODO lo demás (incluido el ID)
          return {
            id: t.id, //  ⚠️ CRÃƒÂTICO: Incluir el ID para que el backend ACTUALICE en vez de CREAR
            descripcion: t.descripcion,
            estado: nuevoEstado,
            profesionales: profesionalesIds
          };
        }
        // Mantener las demás tareas sin cambios, con su ID
        return {
          id: t.id,
          descripcion: t.descripcion,
          estado: t.estado,
          profesionales: profesionalesIds
        };
      });

      console.log('📤 Enviando al backend:', tareasActualizadas);

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
    if (!window.confirm('¿Está seguro de eliminar esta etapa diaria?')) {
      return;
    }

    try {
      await api.etapasDiarias.delete(etapaId, empresaSeleccionada.id);
      showNotification('Etapa diaria eliminada exitosamente', 'success');
      await cargarEtapasDiarias(obraParaEtapasDiarias);
    } catch (error) {
      console.error('Error eliminando etapa diaria:', error);

      if (error.status === 404 || error.response?.status === 404 || error.message?.includes('404')) {
        showNotification(' ⚠️ El módulo de Etapas Diarias aún no está disponible en el backend', 'warning');
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

  // Funciones para contar elementos de cada categoría por obra
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
    // Si es un número simple, convertirlo a objeto
    return { count: profesionales || 0, asignaciones: [] };
  };

  const contarMaterialesAsignados = (obraId) => {
    return contadoresObras[obraId]?.materiales || 0;
  };

  const contarGastosAsignados = (obraId) => {
    return contadoresObras[obraId]?.gastos || 0;
  };

  // Funciones helper para trabajos adicionales
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
    // Filtra trabajos que pertenecen a un trabajo extra específico
    return trabajosAdicionales.filter(ta => ta.trabajoExtraId === trabajoExtraId);
  };

  const handleEliminarTrabajoAdicional = async (trabajoAdicionalId, nombre) => {
    if (!window.confirm(`¿Está seguro de eliminar el trabajo adicional "${nombre}"?`)) {
      return;
    }

    try {
      showNotification('Eliminando trabajo adicional...', 'info');
      await trabajosAdicionalesService.eliminarTrabajoAdicional(trabajoAdicionalId);

      // Actualizar lista
      const todosLosTrabajosAdicionales = await trabajosAdicionalesService.listarTrabajosAdicionales(empresaId);
      const trabajosArray = Array.isArray(todosLosTrabajosAdicionales) ? todosLosTrabajosAdicionales : [];
      setTrabajosAdicionales(trabajosArray);

      showNotification('✅ Trabajo adicional eliminado correctamente', 'success');
    } catch (error) {
      console.error('❌ Error al eliminar trabajo adicional:', error);
      showNotification('Error al eliminar trabajo adicional', 'error');
    }
  };

  const handleCambiarEstadoTrabajoAdicional = async (trabajoAdicionalId, nuevoEstado) => {
    try {
      showNotification(`Cambiando estado a ${nuevoEstado}...`, 'info');
      await trabajosAdicionalesService.actualizarEstadoTrabajoAdicional(trabajoAdicionalId, nuevoEstado);

      // Actualizar lista
      const todosLosTrabajosAdicionales = await trabajosAdicionalesService.listarTrabajosAdicionales(empresaId);
      const trabajosArray = Array.isArray(todosLosTrabajosAdicionales) ? todosLosTrabajosAdicionales : [];
      setTrabajosAdicionales(trabajosArray);

      showNotification('✅ Estado actualizado correctamente', 'success');
    } catch (error) {
      console.error('❌ Error al cambiar estado:', error);
      showNotification('Error al cambiar estado del trabajo adicional', 'error');
    }
  };

  // 🔥 NUEVA FUNCIONALIDAD: Calcular estado de tiempo de la obra comparando profesionales asignados vs presupuesto
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

      // Obtener días hábiles estimados
      const diasEstimados = config?.diasHabiles || 0;

      // Obtener capacidad necesaria
      const capacidadNecesaria = config?.capacidadNecesaria || (diasEstimados > 0 ? Math.ceil(jornalesPresupuesto / diasEstimados) : 0);

      if (jornalesPresupuesto === 0 || diasEstimados === 0 || capacidadNecesaria === 0) {
        return { emoji: '', tooltip: '' };
      }

      // Obtener datos de profesionales asignados desde contadores
      const contador = contadoresObras[obraId];
      if (!contador || !contador.profesionalesData) {
        return { emoji: '⏱️', tooltip: 'Sin profesionales asignados aún' };
      }

      // Calcular total de profesionales únicos asignados
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
        return { emoji: '⏱️', tooltip: 'Sin profesionales asignados aún' };
      }

      // Comparar profesionales asignados vs necesarios
      const diferenciaProfesionales = profesionalesAsignados - capacidadNecesaria;

      // Calcular días reales con los profesionales asignados
      const diasReales = Math.ceil(jornalesPresupuesto / profesionalesAsignados);
      const diasDiferencia = diasReales - diasEstimados;

      // Determinar emoji y tooltip
      if (diferenciaProfesionales === 0) {
        return {
          emoji: '✅',
          tooltip: `Perfecto: ${profesionalesAsignados} profesionales asignados = ${capacidadNecesaria} necesarios → Terminarás en ${diasEstimados} días`
        };
      } else if (diferenciaProfesionales > 0) {
        const profesionalesMas = diferenciaProfesionales;
        return {
          emoji: '🚀',
          tooltip: `${profesionalesMas} profesional${profesionalesMas !== 1 ? 'es' : ''} extra → Terminarás en ${diasReales} días (${Math.abs(diasDiferencia)} día${Math.abs(diasDiferencia) !== 1 ? 's' : ''} menos)`
        };
      } else {
        const profesionalesFaltantes = Math.abs(diferenciaProfesionales);
        return {
          emoji: '⚠️',
          tooltip: `Faltan ${profesionalesFaltantes} profesional${profesionalesFaltantes !== 1 ? 'es' : ''} → Terminarás en ${diasReales} días (${diasDiferencia} día${diasDiferencia !== 1 ? 's' : ''} más)`
        };
      }
    } catch (error) {
      console.error('Error calculando estado de tiempo:', error);
      return { emoji: '', tooltip: '' };
    }
  };

  // Función para cargar todos los contadores de una obra cuando se expande
  const cargarContadoresObra = async (obraId) => {
    // console.log('🔄 Cargando contadores para obra:', obraId);
    try {
      // 🔥 Detectar si es un trabajo extra buscando en el array de obras
      const obraEncontrada = obras.find(o => o.id === obraId);
      const esTrabajoExtra = obraEncontrada?._esTrabajoExtra || false;
      const idParaConsulta = esTrabajoExtra ? obraId : obraId; // Para trabajo extra usar su propio ID

      console.log('🔍 cargarContadoresObra - obraId:', obraId, 'esTrabajoExtra:', esTrabajoExtra);

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
          console.log('  📊 Presupuestos:', count);
          return count;
        }).catch(error => {
          console.warn('  ⚠️ Error cargando presupuestos:', error.message);
          return 0;
        }),

        // Trabajos Extra
        api.presupuestosNoCliente.getAll(empresaId, { obraId, esPresupuestoTrabajoExtra: true }).then(data => {
          // 🔧 FILTRAR solo los que son trabajos extra (backend puede no estar filtrando correctamente)
          let trabajosArray = (Array.isArray(data) ? data : []).filter(p =>
            p.esPresupuestoTrabajoExtra === true || p.esPresupuestoTrabajoExtra === 'V'
          );

          // 🔧 FILTRAR: Si estamos dentro de un trabajo extra (obraId es un trabajo extra),
          // excluir ese trabajo extra de su propia lista
          const obraActual = obras.find(o => o.id === obraId);
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
          console.warn('  ⚠️ Error cargando trabajos extra:', error.message);
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

          // Contar profesionales únicos
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
          console.log('  📊 Total profesionales únicos asignados:', count);

          // Guardar los datos completos
          setDatosAsignacionesPorObra(prev => ({
            ...prev,
            [obraId]: {
              ...prev[obraId],
              asignacionesProfesionales: asignaciones
            }
          }));

          // 🔥 Retornar objeto con count y datos completos para el cálculo de tiempo
          return { count, asignaciones };
        }).catch(error => {
          console.warn('  ⚠️ Error cargando profesionales:', error.message);
          return { count: 0, asignaciones: [] };
        }),

        // Materiales - Obtener asignaciones reales desde el backend
        (async () => {
          try {
            // 🔥 Tanto para obra normal como trabajo extra, consultar el endpoint de asignaciones
            const response = await axios.get(`/api/obras/${obraId}/materiales`, {
              headers: {
                empresaId: empresaId,
                'X-Tenant-ID': empresaId
              }
            });
            const data = response.data?.data || response.data || [];
            const materialesBackend = Array.isArray(data) ? data : [];
            const count = materialesBackend.length;

            console.log(`  📊 Materiales asignados ${esTrabajoExtra ? '(trabajo extra)' : ''}:`, count);

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
            console.warn('  ⚠️ Error cargando materiales:', error.message);
            return 0;
          }
        })(),

        // Gastos/Otros costos asignados - Obtener asignaciones reales desde el backend
        (async () => {
          try {
            // 🔥 Tanto para obra normal como trabajo extra, consultar el endpoint de asignaciones
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

            console.log(`  📊 Gastos asignados ${esTrabajoExtra ? '(trabajo extra)' : ''}:`, count, gastos);

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
            console.warn('  ⚠️ Error cargando gastos generales:', error.message);
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
      contadores.profesionalesData = profesionales.asignaciones || []; // 🔥 Guardar datos completos
      contadores.materiales = materialesData;
      contadores.gastos = gastosData;
      contadores.etapas = etapas;

      console.log('✅ Contadores cargados para obra', obraId, ':', contadores);

      // Actualizar el estado
      setContadoresObras(prev => ({
        ...prev,
        [obraId]: contadores
      }));

    } catch (error) {
      console.error('❌ Error cargando contadores de obra:', obraId, error);
    }
  };

  // Función para cargar presupuestos de una obra
  const handleVerPresupuestosObra = async (obra) => {
    try {
      setObraParaPresupuestos(obra);
      setMostrarModalPresupuestos(true);
      setLoadingPresupuestos(true);

      console.log('🔍 Buscando TODOS los presupuestos con obraId:', obra.id);

      // Obtener TODOS los presupuestos (IMPORTANTE: pasar empresaId)
      console.log('📡 Llamando a getAll con empresaId:', empresaId);
      const todosPresupuestos = await api.presupuestosNoCliente.getAll(empresaId);

      console.log('📦 Total presupuestos obtenidos:', todosPresupuestos?.length || 0);

      // Filtrar presupuestos que tienen esta obra vinculada
      const presupuestosFiltrados = (todosPresupuestos || []).filter(p => {
        const tieneObraVinculada = p.obraId === obra.id || p.idObra === obra.id;
        if (tieneObraVinculada) {
          console.log('✅ Presupuesto', p.id, 'vinculado a obra', obra.id);
        }
        return tieneObraVinculada;
      });

      console.log('✅ Presupuestos vinculados a obra', obra.id, ':', presupuestosFiltrados.length);

      // Ordenar presupuestos: primero por estado (APROBADO/EN_EJECUCIÓN arriba), luego por versión DESC, luego por fecha de creación DESC
      const presupuestosOrdenados = presupuestosFiltrados.sort((a, b) => {
        // Definir prioridad de estados
        const estadosPrioridad = {
          'APROBADO': 1,
          'EN_EJECUCIÓN': 1,
          'EN_EJECUCION': 1, // Por si acaso hay variación en el nombre
          'ENVIADO': 2,
          'BORRADOR': 3
        };

        const prioridadA = estadosPrioridad[a.estado] || 4;
        const prioridadB = estadosPrioridad[b.estado] || 4;

        // Primero ordenar por estado (menor prioridad = más arriba)
        if (prioridadA !== prioridadB) {
          return prioridadA - prioridadB;
        }

        // Si tienen el mismo estado, ordenar por versión (más alta primero)
        const versionA = a.numeroVersion || a.version || 1;
        const versionB = b.numeroVersion || b.version || 1;
        if (versionA !== versionB) {
          return versionB - versionA;
        }

        // Si tienen la misma versión y estado, ordenar por fecha de última modificación (más reciente primero)
        const fechaA = new Date(a.fechaUltimaModificacionEstado || a.fechaCreacion || a.createdAt || 0);
        const fechaB = new Date(b.fechaUltimaModificacionEstado || b.fechaCreacion || b.createdAt || 0);
        return fechaB - fechaA;
      });

      console.log('📋 Presupuestos ordenados (APROBADO/EN_EJECUCIÓN primero, luego por versión):', presupuestosOrdenados.map(p => ({
        id: p.id,
        version: p.version,
        estado: p.estado,
        fechaCreacion: p.fechaCreacion,
        prioridad: p.estado === 'APROBADO' || p.estado === 'EN_EJECUCIÓN' || p.estado === 'EN_EJECUCION' ? 'ALTA' : 'NORMAL'
      })));

      setPresupuestosObra(presupuestosOrdenados);

      // Si solo hay un presupuesto, abrirlo automáticamente
      if (presupuestosOrdenados.length === 1) {
        console.log('🚀 Solo hay un presupuesto, abriéndolo automáticamente:', presupuestosOrdenados[0].id);
        setTimeout(() => {
          handleAbrirPresupuesto(presupuestosOrdenados[0]);
        }, 500); // Pequeño delay para que se vea el modal de lista primero
      }
    } catch (error) {
      console.error('❌ Error cargando presupuesto:', error);
      console.error('❌ Detalles del error:', error.message, error.response);
      showNotification('Error al cargar presupuesto de la obra: ' + (error.message || 'Error desconocido'), 'error');
      setPresupuestosObra([]);
    } finally {
      setLoadingPresupuestos(false);
    }
  };

  //  €¢ Función para abrir presupuesto en modal de edición
  const handleAbrirPresupuesto = async (presupuesto) => {
    if (!empresaId) {
      showNotification('Error: No hay empresa seleccionada', 'error');
      return;
    }

    setCargandoPresupuesto(true);
    try {
      // Cargar el presupuesto completo desde el backend
      const presupuestoCompleto = await api.presupuestosNoCliente.getById(presupuesto.id, empresaId);

      //  Asegurar que incluye obraId y clienteId del contexto actual
      // Usar valores de la obra actual si el presupuesto tiene NULL en BD
      const presupuestoConContexto = {
        ...presupuestoCompleto,
        obraId: presupuestoCompleto.obraId || presupuestoCompleto.idObra || obraParaPresupuestos?.id || null,
        clienteId: presupuestoCompleto.clienteId || presupuestoCompleto.idCliente || obraParaPresupuestos?.idCliente || null
      };

      console.log('📋 Presupuesto cargado con contexto:', {
        id: presupuestoConContexto.id,
        obraId: presupuestoConContexto.obraId,
        clienteId: presupuestoConContexto.clienteId,
        nombreObra: presupuestoConContexto.nombreObra,
        DEBUG_presupuestoCompletoBD: {
          obraId: presupuestoCompleto.obraId,
          idObra: presupuestoCompleto.idObra,
          clienteId: presupuestoCompleto.clienteId,
          idCliente: presupuestoCompleto.idCliente
        },
        DEBUG_obraContexto: {
          id: obraParaPresupuestos?.id,
          idCliente: obraParaPresupuestos?.idCliente
        }
      });

      setPresupuestoParaEditar(presupuestoConContexto);
      setMostrarModalEditarPresupuesto(true);
    } catch (error) {
      console.error(' Error completo al cargar presupuesto:', error);
      console.error(' Error.message:', error.message);
      console.error(' Error.response:', error.response);
      console.error(' Error.status:', error.status);

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

  // Función para editar solo las fechas de un presupuesto de obra
  const handleEditarSoloFechasObra = async (obra) => {
    if (!obra?.id || !empresaId) {
      showNotification('Error: Datos de obra inválidos', 'error');
      return;
    }

    try {
      // Buscar el presupuesto vinculado a esta obra
      const todosPresupuestos = await api.presupuestosNoCliente.getAll(empresaId);
      const presupuestoVinculado = (todosPresupuestos || []).find(p =>
        p.obraId === obra.id || p.idObra === obra.id
      );

      if (!presupuestoVinculado) {
        showNotification('No se encontró un presupuesto vinculado a esta obra', 'warning');
        return;
      }

      setCargandoPresupuesto(true);

      // Cargar el presupuesto completo
      const presupuestoCompleto = await api.presupuestosNoCliente.getById(presupuestoVinculado.id, empresaId);

      // Asegurar contexto y marcar con flag especial para modo edición limitada
      const presupuestoConContexto = {
        ...presupuestoCompleto,
        obraId: presupuestoCompleto.obraId || presupuestoCompleto.idObra || obra.id,
        clienteId: presupuestoCompleto.clienteId || presupuestoCompleto.idCliente || obra.idCliente,
        _editarSoloFechas: true // Flag para indicar modo de edición limitada
      };

      console.log('📅 Abriendo presupuesto en modo edición de fechas:', {
        presupuestoId: presupuestoConContexto.id,
        obraId: presupuestoConContexto.obraId,
        editarSoloFechas: true
      });

      setPresupuestoParaEditar(presupuestoConContexto);
      setMostrarModalEditarPresupuesto(true);

      showNotification(
        '📅 Modo edición de fechas: Solo puede modificar Fecha Probable de Inicio y Días Hábiles. La versión y el estado se preservarán.',
        'info'
      );
    } catch (error) {
      console.error('❌ Error al cargar presupuesto para editar fechas:', error);
      showNotification(
        'Error al cargar presupuesto: ' + (error.message || 'Error desconocido'),
        'error'
      );
    } finally {
      setCargandoPresupuesto(false);
    }
  };

  // ==================== CONFIGURACIÓN GLOBAL DE OBRA ====================

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

  // 🔥 EFECTO: Cuando se abre el modal de configuración, cargar datos correctos
  React.useEffect(() => {
    if (!mostrarModalConfiguracionObra || !obraParaConfigurar) {
      return;
    }

    // ✅ SI ES TRABAJO EXTRA: usar presupuesto pre-cargado, NO buscar en backend
    if (obraParaConfigurar._esTrabajoExtra && obraParaConfigurar.presupuestoNoCliente) {
      console.log('✅ [Modal Configuración TE] Es trabajo extra - usando presupuesto pre-cargado');
      const presupuesto = obraParaConfigurar.presupuestoNoCliente;

      // 🔥 Para trabajos extra: usar cálculo SIMPLE de semanas (no con feriados)
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

      console.log('✅ [Modal Configuración TE] configuracionObra inicializada:', {
        presupuestoId: presupuesto.id,
        diasHabiles: presupuesto.tiempoEstimadoTerminacion,
        semanas: semanasCalculadas
      });
      return;
    }

    // 🔥 SI ES OBRA NORMAL: llamar handleConfigurarObra para buscar presupuestos
    handleConfigurarObra(obraParaConfigurar);
  }, [mostrarModalConfiguracionObra, obraParaConfigurar?._esTrabajoExtra]);

  const handleConfigurarObra = async (obra) => {
    console.log('🚀🚀🚀 INICIO handleConfigurarObra - Obra:', obra?.id, obra?.direccion);

    if (!obra?.id || !empresaSeleccionada?.id) {
      showNotification('Error: Datos inválidos', 'error');
      return;
    }

    // No setear obraParaConfigurar aquí si ya está seteado (viene de handleAbrirDia de trabajos extra)
    if (!obraParaConfigurar || obraParaConfigurar.id !== obra.id) {
      setObraParaConfigurar(obra);
    }

    console.log('🚀 Buscando presupuesto para configuración...');

    try {
      // Buscar todos los presupuestos de la obra y elegir el de mayor versión
      const todosPresupuestos = await api.presupuestosNoCliente.getAll(empresaSeleccionada.id);
      console.log('🔍 TODOS LOS PRESUPUESTOS:', todosPresupuestos);

      // Filtrar solo los de la obra
      const presupuestosObra = (todosPresupuestos || []).filter(p =>
        p.obraId === obra.id || p.idObra === obra.id
      );

      // Elegir el de mayor versión
      let presupuestoVinculado = null;
      if (presupuestosObra.length > 0) {
        presupuestoVinculado = presupuestosObra.reduce((max, curr) =>
          (curr.numeroVersion > (max?.numeroVersion || 0) ? curr : max), presupuestosObra[0]
        );
      }

      console.log('🔍 PRESUPUESTO VINCULADO (mayor versión):', presupuestoVinculado);
      console.log('🔍 Obra ID buscada:', obra.id);

      if (presupuestoVinculado) {
        // ✅ VALIDACIÓN IMPORTANTE: El presupuesto DEBE tener fecha y días estimados
        // Ahora solo mostramos advertencia, no cerramos el modal
        let advertenciaConfig = null;
        if (!presupuestoVinculado.fechaProbableInicio) {
          advertenciaConfig = '⚠️ El presupuesto no tiene fecha probable de inicio configurada. Por favor, complétala para poder guardar la configuración.';
        } else if (!presupuestoVinculado.tiempoEstimadoTerminacion || presupuestoVinculado.tiempoEstimadoTerminacion <= 0) {
          advertenciaConfig = '⚠️ El presupuesto no tiene tiempo estimado de terminación configurado. Por favor, complétalo para poder guardar la configuración.';
        }
        // Guardar advertencia en el estado para mostrarla en el modal
        setAdvertenciaConfiguracionObra(advertenciaConfig);

        // 🆕 Calcular semanas automáticamente basándose en tiempoEstimadoTerminacion
        let semanasCalculadas = 0;
        let fechaInicio = null;
        const jornalesTotales = parseInt(presupuestoVinculado.tiempoEstimadoTerminacion) || 30;

        console.log('📋 tiempoEstimadoTerminacion del presupuesto:', presupuestoVinculado.tiempoEstimadoTerminacion);

        if (presupuestoVinculado.tiempoEstimadoTerminacion) {
          console.log('✅ Hay tiempoEstimadoTerminacion, calculando semanas...');

          // Con fechaProbableInicio validada, hacer cálculo preciso con feriados
          console.log('✅ Hay fechaProbableInicio, cálculo preciso con feriados');
          fechaInicio = parsearFechaLocal(presupuestoVinculado.fechaProbableInicio);
          try {
            semanasCalculadas = calcularSemanasParaDiasHabiles(
              fechaInicio,
              presupuestoVinculado.tiempoEstimadoTerminacion
            );
            console.log('✅ Semanas calculadas con feriados:', semanasCalculadas);
          } catch (error) {
            console.warn('⚠️ Error al calcular semanas con feriados, usando cálculo simple:', error);
            semanasCalculadas = convertirDiasHabilesASemanasSimple(
              presupuestoVinculado.tiempoEstimadoTerminacion
            );
            console.log('✅ Semanas calculadas simple (fallback):', semanasCalculadas);
          }
        } else {
          console.warn('⚠️ No hay tiempoEstimadoTerminacion');
        }

        console.log('🔍 DEBUG - Configurando obra:', {
          fechaProbableInicio: presupuestoVinculado.fechaProbableInicio,
          fechaInicio: fechaInicio,
          fechaInicioStr: fechaInicio ? fechaInicio.toLocaleDateString('es-AR') : 'Sin fecha',
          jornalesTotales,
          diasHabilesPresupuesto: presupuestoVinculado.tiempoEstimadoTerminacion,
          semanasCalculadas
        });

        console.log('📝 ANTES DE setConfiguracionObra - semanasCalculadas:', semanasCalculadas);

        // 🆕 Calcular capacidad necesaria (profesionales trabajando en paralelo por día)
        let capacidadNecesaria = 0;
        if (presupuestoVinculado.itemsCalculadora && Array.isArray(presupuestoVinculado.itemsCalculadora)) {
          // Contar profesionales en paralelo de rubros incluidos en cálculo de días
          presupuestoVinculado.itemsCalculadora.forEach(rubro => {
            // Solo rubros incluidos en cálculo de días
            const incluirRubro = rubro.incluirEnCalculoDias !== false;
            if (!incluirRubro) return;

            // Contar profesionales del rubro que trabajan en paralelo
            if (rubro.jornales && Array.isArray(rubro.jornales)) {
              rubro.jornales.forEach(jornal => {
                const incluirJornal = jornal.incluirEnCalculoDias !== false;
                const cantidad = Number(jornal.cantidad || 0);
                if (incluirJornal && cantidad > 0) {
                  capacidadNecesaria++; // 1 profesional por cada línea de jornal
                }
              });
            }
          });
          console.log('👥 Capacidad necesaria calculada:', capacidadNecesaria, 'profesionales/día');
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

        console.log('✅ setConfiguracionObra ejecutado con semanasObjetivo:', semanasCalculadas > 0 ? semanasCalculadas.toString() : '');

        // ✅ ABRIR MODAL DE CONFIGURACIÓN
        setMostrarModalConfiguracionObra(true);
      } else {
        // Fallback si no hay presupuesto vinculado
        showNotification('⚠️ No se encontró un presupuesto vinculado a esta obra', 'warning');
        setConfiguracionObra({
          jornalesTotales: 30,
          fechaInicio: new Date(),
          presupuestoSeleccionado: null,
          semanasObjetivo: '',
          diasHabiles: 0,
          capacidadNecesaria: 0,
          fechaFinEstimada: null
        });
        // ✅ ABRIR MODAL INCLUSO SIN PRESUPUESTO (para que el usuario configure manualmente)
        setMostrarModalConfiguracionObra(true);
      }

    } catch (error) {
      console.error('Error:', error);
      showNotification('❌ Error al intentar cargar la configuración: ' + error.message, 'error');
      setConfiguracionObra({
        jornalesTotales: 30,
        fechaInicio: new Date(),
        presupuestoSeleccionado: null,
        semanasObjetivo: '',
        diasHabiles: 0,
        capacidadNecesaria: 0,
        fechaFinEstimada: null
      });
      // ✅ ABRIR MODAL PARA QUE EL USUARIO INTENTE CONFIGURAR MANUALMENTE
      setMostrarModalConfiguracionObra(true);
    }
  };

  const handleGuardarConfiguracionObra = () => {
    // ✅ VALIDACIÓN: Verificar que el presupuesto tiene fechas configuradas
    if (!configuracionObra.presupuestoSeleccionado?.fechaProbableInicio) {
      showNotification('❌ El presupuesto debe tener una fecha probable de inicio configurada', 'error');
      return;
    }

    if (!configuracionObra.diasHabiles || configuracionObra.diasHabiles <= 0) {
      showNotification('❌ El presupuesto debe tener días hábiles configurados (tiempoEstimadoTerminacion)', 'error');
      return;
    }

    if (!configuracionObra.semanasObjetivo || configuracionObra.semanasObjetivo <= 0) {
      showNotification('Por favor ingresa un número de semanas válido', 'warning');
      return;
    }

    const semanas = parseInt(configuracionObra.semanasObjetivo);
    // 🔥 USAR días hábiles del presupuesto, NO semanas×5
    const diasHabiles = configuracionObra.diasHabiles || configuracionObra.presupuestoSeleccionado?.tiempoEstimadoTerminacion || (semanas * 5);

    // 🆕 Calcular capacidad necesaria desde el presupuesto (igual que en handleConfigurarObra)
    let capacidadNecesaria = configuracionObra.capacidadNecesaria || 0;

    // Si no está calculado, intentar calcularlo desde el presupuesto
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

    // Fallback si aún es 0: usar cálculo simple
    if (capacidadNecesaria === 0) {
      capacidadNecesaria = Math.ceil(configuracionObra.jornalesTotales / diasHabiles);
    }



    // Calcular fecha de fin estimada considerando feriados de Argentina
    let fechaFinEstimada = null;
    if (configuracionObra.fechaInicio) {
      fechaFinEstimada = new Date(configuracionObra.fechaInicio);
      let diasContados = 0;

      console.log('🔍 DEBUG - Calculando fecha fin:', {
        fechaInicio: configuracionObra.fechaInicio,
        fechaInicioStr: fechaFinEstimada.toLocaleDateString('es-AR'),
        diasHabiles,
        semanas
      });

      // Sumar días hasta alcanzar los días hábiles necesarios (considerando feriados)
      while (diasContados < diasHabiles) {
        fechaFinEstimada.setDate(fechaFinEstimada.getDate() + 1);

        // 🔥 Solo contar si es día hábil: lunes-viernes Y no es feriado
        if (esDiaHabil(fechaFinEstimada)) {
          diasContados++;
        }
      }

      console.log('🔍 DEBUG - Fecha fin calculada (con feriados):', {
        fechaFin: fechaFinEstimada.toLocaleDateString('es-AR'),
        diasContados
      });
    }

    const nuevaConfiguracion = {
      ...configuracionObra,
      semanasObjetivo: semanas,
      diasHabiles,
      capacidadNecesaria,
      fechaFinEstimada
    };

    setConfiguracionObra(nuevaConfiguracion);

    // Actualizar la obra seleccionada para etapas diarias (si existe)
    if (obraParaEtapasDiarias) {
      // 🔥 Para trabajos extra: actualizar también presupuestoNoCliente con los nuevos datos de fechas/días
      const obraActualizada = {
        ...obraParaEtapasDiarias,
        configuracionPlanificacion: nuevaConfiguracion
      };

      // Si es trabajo extra, actualizar presupuestoNoCliente con fechaProbableInicio y tiempoEstimadoTerminacion
      if (obraParaEtapasDiarias._esTrabajoExtra && obraParaEtapasDiarias.presupuestoNoCliente) {
        console.log('✅ [Guardada Configuración TE] Actualizando presupuestoNoCliente con fechas:', {
          fechaProbableInicio: configuracionObra.presupuestoSeleccionado?.fechaProbableInicio,
          tiempoEstimadoTerminacion: diasHabiles
        });

        obraActualizada.presupuestoNoCliente = {
          ...obraParaEtapasDiarias.presupuestoNoCliente,
          fechaProbableInicio: configuracionObra.presupuestoSeleccionado?.fechaProbableInicio || obraParaEtapasDiarias.presupuestoNoCliente.fechaProbableInicio,
          tiempoEstimadoTerminacion: diasHabiles
        };
        // 🔥 IMPORTANTE: También actualizar directamente en la obra para que calendarioCompleto lo vea
        obraActualizada.tiempoEstimadoTerminacion = diasHabiles;
        obraActualizada.fechaProbableInicio = configuracionObra.presupuestoSeleccionado?.fechaProbableInicio || obraParaEtapasDiarias.fechaProbableInicio;
      }

      setObraParaEtapasDiarias(obraActualizada);

      // 🔥 PARA TRABAJOS EXTRA: Guardar el presupuesto en cache CONGELADO
      if (obraParaEtapasDiarias._esTrabajoExtra && obraActualizada.presupuestoNoCliente) {
        console.log('🔥 [Guardada Configuración TE] CONGELANDO presupuesto en cache:', {
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

    // 🔥 Si el modal se abrió desde un trabajo extra (pestaña trabajos-extra), actualizar ese trabajo en el array
    if (obraParaConfigurar?._esTrabajoExtra && obraParaConfigurar._trabajoExtraId) {
      console.log('✅ [Guardada TE Config] Actualizando trabajo extra en array trabajosExtra:', {
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

    // Forzar regeneración del calendario
    setCalendarioVersion(v => {
      console.log(' 🔄 Configuración cambiada - Incrementando calendarioVersion:', v, ' → ', v + 1);
      return v + 1;
    });

    setMostrarModalConfiguracionObra(false);
    showNotification(`✅ Configuración guardada: ${semanas} semanas (${diasHabiles} días hábiles, ${capacidadNecesaria} jornales/día)`, 'success');

    console.log('💾 Configuración guardada:', nuevaConfiguracion);
  };

  // Helper para formatear dirección de obra
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

  return (
    <div className="container-fluid" style={{padding: '0'}} onClick={() => setSelectedObraId(null)}>
      <div className="row mb-4" style={{margin: '0', padding: '0 15px'}}>
        <div className="col-12">
          <h2>
            <i className="fas fa-building me-2"></i>
            Gestión de Obras
          </h2>
        </div>
      </div>

      {/* Contenido segúnn activeTab */}
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
                          showNotification('ℹ️ No hay obras independientes (sin presupuesto)', 'info');
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
                            <th className="small">Dirección</th>
                            <th style={{ width: '80px' }} className="small">Contacto</th>
                            <th style={{ width: '70px' }} className="small" title="Trabajos Adicionales">T. Adic.</th>
                            <th style={{ width: '80px' }} className="small">Estado</th>
                            <th style={{ width: '100px' }} className="small">Asignaciones</th>
                            <th style={{ width: '80px' }} className="small">Inicio</th>
                            <th style={{ width: '80px' }} className="small">Fin</th>
                            <th style={{ width: '90px' }} className="small">Cliente</th>
                            <th style={{ width: '90px' }} className="small">Tipo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            // 🎯 ORDENAMIENTO INTELIGENTE: Agrupar obras de trabajo extra con sus obras padre
                            // 🔍 Detección de subobras por NOMBRE (además del flag esTrabajoExtra)
                            const todasObrasActivas = obras.filter(o => o.estado !== 'CANCELADO').sort((a, b) => a.id - b.id);
                            const obrasCanceladas = obras.filter(o => o.estado === 'CANCELADO');

                            // 🔍 Marcar subobras detectadas por patrón de nombre
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
                              return esTrabajoExtraExplicito || esSubobraDetectada;
                            });

                            const listaOrdenada = [];

                            // 🎨 Para cada obra normal, agregar la obra y sus trabajos extra con metadatos de grupo
                            let grupoIndex = 2; // 🎨 Sincronizar con índice de grupos de obra en página de Presupuestos

                            obrasNormales.forEach(obraPadre => {
                              // Buscar trabajos extra de esta obra (por ID o por detección de nombre)
                              const trabajosExtraDeEstaObra = obrasTrabajoExtra.filter(te => {
                                const obraPadreId = te.obraPadreId || te.obra_padre_id || te.idObraPadre || te._obraPadreDetectada;
                                return obraPadreId === obraPadre.id;
                              });

                              const tieneSubObras = trabajosExtraDeEstaObra.length > 0;
                              const totalEnGrupo = tieneSubObras ? trabajosExtraDeEstaObra.length + 1 : 1;

                              // 🏢 Agregar obra PADRE primero (ARRIBA)
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
                                // 🔧 Ordenar trabajos extra por ID ASCENDENTE (del más antiguo al más nuevo)
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

                            // Agregar trabajos extra huérfanos (sin obra padre)
                            const trabajosExtraHuerfanos = obrasTrabajoExtra.filter(te => {
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
                          })().map((obra, index, array) => {
                            const obraId = obra.id;
                            const isSelected = selectedObraId && obraId && selectedObraId === obraId;

                            // 🔍 Determinar si es subobra/trabajo extra (explícito o detectado)
                            const esSubobra = obra.esTrabajoExtra || obra._grupoTipo === 'trabajoExtra';

                            // 🎨 Determinar información de grupo para estilos visuales
                            const perteneceAGrupo = obra._grupoObra !== null;
                            const esPrimerEnGrupo = obra._primerEnGrupo;
                            const esUltimoEnGrupo = obra._ultimoEnGrupo;
                            const grupoIndex = obra._grupoIndex || 0;
                            const totalEnGrupo = obra._totalEnGrupo || 1;

                            // 🔥 Verificar si es un cambio de grupo (comparar grupoIndex con el anterior)
                            const esCambioDeGrupo = index > 0 && (
                              array[index - 1]._grupoIndex !== obra._grupoIndex
                            );

                            // Colores alternados para grupos (más visibles)
                            const coloresGrupo = [
                              '#e9ecef', // Gris claro
                              '#d1e7ff', // Azul claro
                              '#ffe8cc', // Naranja claro
                              '#d4edda', // Verde claro
                              '#f8d7da', // Rosa claro
                              '#e7d6ff'  // Púrpura claro
                            ];

                            // 💡 Función helper para ajustar brillo (oscurecer/aclarar)
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

                            // 🎨 Alternar tonalidades dentro del grupo
                            let colorGrupo = '#ffffff';

                            if (perteneceAGrupo) {
                              // Más simple: Si es el primero del grupo -> color claro, si no -> color oscuro
                              if (obra._primerEnGrupo) {
                                colorGrupo = colorBaseGrupo;
                              } else {
                                colorGrupo = adjustColorBrightness(colorBaseGrupo, -15);
                              }
                            }

                            return (
                            <React.Fragment key={obraId}>
                              {/* 🎨 Separador visual entre grupos - se muestra ANTES del primer elemento del nuevo grupo */}
                              {esCambioDeGrupo && index > 0 && (
                                <tr style={{ height: '8px', backgroundColor: '#343a40' }}><td colSpan="11" style={{
                                    padding: 0,
                                    height: '8px',
                                    borderTop: '3px solid #212529',
                                    borderBottom: '3px solid #212529',
                                    backgroundColor: '#495057'
                                  }}></td></tr>
                              )}

                              {/* 🔴 Línea delgada entre obras del mismo grupo */}
                              {index > 0 && perteneceAGrupo &&
                               array[index - 1] &&
                               array[index - 1]._grupoIndex === obra._grupoIndex &&
                               !esCambioDeGrupo && (
                                <tr style={{ height: '6px', backgroundColor: '#ffcc99' }}>{/* Naranja suave */}<td colSpan="11" style={{
                                    padding: 0,
                                    height: '6px',
                                    borderTop: '2px solid #dc3545',
                                    backgroundColor: '#ffcc99'  /* Naranja suave */
                                  }}></td></tr>
                              )}

                              <tr
                                onClick={(e) => {
                                  e.stopPropagation();

                                  // Toggle: si ya está seleccionado, deseleccionar; si no, seleccionar
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
                                {perteneceAGrupo && esPrimerEnGrupo && totalEnGrupo > 1 && (
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
                                )}
                                {esSubobra && (
                                  <div className="mt-1">
                                    <span className="badge bg-warning text-dark" style={{fontSize: '0.7rem', padding: '3px 8px'}}>
                                      🔧 TRABAJO EXTRA{(() => {
                                        const obraPadreId = obra.obraPadreId || obra.obra_padre_id || obra.idObraPadre || obra._obraPadreDetectada;
                                        return obraPadreId ? ` de #${obraPadreId}` : '';
                                      })()}
                                    </span>
                                  </div>
                                )}
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
                              <td>
                                {(() => {
                                  // Verificar si tiene presupuesto cargado (no null, sino objeto válido)
                                  const tienePresupuesto = (presupuestosObras[obra.id] && typeof presupuestosObras[obra.id] === 'object') ||
                                                          (obra.presupuestoNoCliente && typeof obra.presupuestoNoCliente === 'object');

                                  if (tienePresupuesto) {
                                    return (
                                      <span className="badge bg-success" title="Obra creada desde presupuesto aprobado">
                                        <i className="fas fa-file-invoice me-1"></i>
                                        Desde Presupuesto
                                      </span>
                                    );
                                  } else {
                                    return (
                                      <span className="badge bg-info text-dark" title="Obra creada sin presupuesto detallado">
                                        <i className="fas fa-hand-pointer me-1"></i>
                                        Presupuesto Abreviado
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
                                    {/* CONFIGURACIÓN GLOBAL DE OBRA */}
                                    <div className="mb-4 p-3 border rounded bg-white">
                                      <div className="row align-items-center">
                                        <div className="col-md-8">
                                          <h6 className="text-primary mb-1">
                                            <i className="fas fa-cog me-2"></i>
                                            Configuración de Planificación
                                          </h6>
                                          {(() => {
                                            const config = obtenerConfiguracionObra(obra.id);
                                            const profesionalesAsignados = contarProfesionalesAsignados(obra.id)?.count || 0;
                                            const presupuesto = presupuestosObras[obra.id] || obra.presupuestoNoCliente;

                                            // ✅ VALIDAR: Solo mostrar configuración si el presupuesto tiene fechas
                                            if (config && presupuesto?.fechaProbableInicio && presupuesto?.tiempoEstimadoTerminacion) {
                                              // 🔥 CALCULAR SEMANAS desde presupuesto usando función centralizada
                                              const diasHabiles = config.diasHabiles || presupuesto.tiempoEstimadoTerminacion || 0;

                                              let semanasReales = config.semanasObjetivo; // Fallback

                                              if (diasHabiles > 0) {
                                                semanasReales = recalcularSemanasDesdePresupuesto(presupuesto);
                                              }

                                              // Calcular días hábiles aproximados basados en las semanas (5 días/semana)
                                              const diasHabilesAprox = semanasReales * 5;

                                              return (
                                                <small className="text-success">
                                                  ✅ Configurado: {semanasReales} semanas ({diasHabilesAprox} días)
                                                  - {profesionalesAsignados} profesional{profesionalesAsignados !== 1 ? 'es' : ''} asignado{profesionalesAsignados !== 1 ? 's' : ''}
                                                </small>
                                              );
                                            }

                                            // ⚠️ Si no tiene fechas, mostrar advertencia clara
                                            if (config && presupuesto && !presupuesto?.fechaProbableInicio) {
                                              return (
                                                <small className="text-danger">
                                                  ⚠️ El presupuesto no tiene fecha probable de inicio configurada
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
                                              title={obtenerConfiguracionObra(obra.id) ? 'Reconfigurar planificación de la obra' : 'Configurar planificación de la obra'}
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
                                                title="Editar solo Fecha Probable de Inicio y Días Hábiles (sin cambiar versión ni estado)"
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
                                                <div className="card bg-light border-0">
                                                  <div className="card-body text-center py-3">
                                                    <div className="mb-1">
                                                      <i className="fas fa-dollar-sign text-success me-2"></i>
                                                      <span className="h5 mb-0 text-success fw-bold">
                                                        ${presupuestoEstimado.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                      </span>
                                                    </div>
                                                    <small className="text-muted">
                                                      <i className="fas fa-info-circle me-1"></i>
                                                      Presupuesto Abreviado
                                                    </small>
                                                  </div>
                                                </div>
                                              </>
                                            );
                                          } else {
                                            // Mostrar botón ver presupuestos para obras con presupuesto
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

                                      {/* Trabajos Extra */}
                                      <div className="col-md-6">
                                        <h6 className="text-muted mb-2">
                                          <i className="fas fa-tools me-2"></i>
                                          Trabajos Extra
                                        </h6>
                                        <button
                                          className="btn btn-sm btn-outline-secondary w-100 d-flex justify-content-between align-items-center"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            console.log('🔍 Click en Gestionar Trabajos Extra - Objeto obra:', obra);
                                            console.log('🔍 Propiedades de trabajo extra:', {
                                              esObraTrabajoExtra: obra.esObraTrabajoExtra,
                                              es_obra_trabajo_extra: obra.es_obra_trabajo_extra,
                                              id: obra.id
                                            });
                                            setSelectedObraId(obra.id);
                                            setObraParaTrabajosExtra(obra);
                                            cargarTrabajosExtra(obra);
                                            dispatch(setActiveTab('trabajos-extra'));
                                          }}
                                        >
                                          <span>
                                            <i className="fas fa-wrench me-2"></i>
                                            Gestionar Trabajos Extra
                                          </span>
                                          <span className="badge bg-secondary">{contarTrabajosExtraObra(obra.id)}</span>
                                        </button>
                                      </div>

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
                                              showNotification('⚠️ Primero configura la planificación de la obra', 'warning');
                                              return;
                                            }

                                            // 🔥 Enriquecer obra con presupuesto completo Y asignaciones antes de abrir modal
                                            try {
                                              const todosPresupuestos = await api.presupuestosNoCliente.getAll(empresaId);
                                              const presupuestoCompleto = todosPresupuestos.find(p =>
                                                p.obraId === obra.id || p.idObra === obra.id
                                              );

                                              // 🔥 NUEVO: Obtener asignaciones actuales de profesionales
                                              let asignacionesActuales = [];
                                              try {
                                                const responseAsignaciones = await obtenerAsignacionesSemanalPorObra(obra.id, empresaId);
                                                asignacionesActuales = responseAsignaciones?.data || responseAsignaciones || [];
                                                console.log('📋 Asignaciones actuales cargadas:', asignacionesActuales.length);
                                              } catch (error) {
                                                console.warn('⚠️ No se pudieron cargar asignaciones:', error.message);
                                              }

                                              const obraEnriquecida = {
                                                ...obra,
                                                presupuestoNoCliente: presupuestoCompleto || obra.presupuestoNoCliente,
                                                asignacionesActuales: asignacionesActuales
                                              };

                                              console.log('🔍 DEBUG - Obra enriquecida:', {
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
                                              showNotification('⚠️ Primero configura la planificación de la obra', 'warning');
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
                                              showNotification('⚠️ Primero configura la planificación de la obra', 'warning');
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

                                      {/* Trabajos Adicionales */}
                                      <div className="col-md-6">
                                        <h6 className="text-muted mb-2">
                                          <i className="fas fa-clipboard-list me-2"></i>
                                          Trabajos Adicionales
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
                                                _trabajoExtraId: obra.id,  // ID de la obra que es trabajo extra
                                                _trabajoExtraNombre: obra.nombre
                                              };
                                              console.log('🔵 Obra es trabajo extra, configurando contexto:', {
                                                trabajoExtraId: obra.id,
                                                obraPadreId: obra.obraPadreId,
                                                obraConContextoTrabajoExtra
                                              });
                                              setObraParaTrabajosAdicionales(obraConContextoTrabajoExtra);
                                            } else {
                                              setObraParaTrabajosAdicionales(obra);
                                            }

                                            setMostrarModalListaTrabajosAdicionales(true);
                                          }}
                                        >
                                          <span>
                                            <i className="fas fa-plus-square me-2"></i>
                                            Gestionar Trabajos Adicionales
                                          </span>
                                          <span className="badge bg-primary">
                                            {(() => {
                                              // Si es trabajo extra, buscar por trabajoExtraId, sino por obraId
                                              const count = obra.esTrabajoExtra
                                                ? trabajosAdicionales.filter(ta => ta.trabajoExtraId === obra.id).length
                                                : contarTrabajosAdicionalesObra(obra.id);
                                              console.log(`🏗️ Badge OBRA ${obra.id} (esTE:${!!obra.esTrabajoExtra}): count=${count}, total=${trabajosAdicionales.length}`);
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
                                                        {ta.diasNecesarios} días
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
                                                          setTrabajoAdicionalEditar(ta);
                                                          setObraParaTrabajosAdicionales(obra);
                                                          setMostrarModalTrabajoAdicional(true);
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
                      'Crear Nueva Obra'
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
                    {/* Título: Presupuesto destinado a */}
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
                          placeholder="Opcional: Si no se ingresa, se generará automáticamente desde la Dirección"
                          style={{borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                        />
                        <small className="text-muted">Si se deja vacío, se generará automáticamente desde la Dirección de la obra</small>
                      </div>
                    </div>

                    {/* Dirección detallada de la obra */}
                    <div className="mb-3">
                      <label className="form-label fw-bold">Dirección de la Obra</label>
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

                    {/* Datos del nuevo cliente (si no está en la lista) */}
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted">O crear nuevo cliente (si no está en la lista)</label>
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
                          <label className="form-label fw-bold" style={{color: "#000", marginBottom: 6}}>Teléfono
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
                          <label className="form-label fw-bold" style={{color: "#000", marginBottom: 6}}>Dirección particular
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
                          <option value="EN_EJECUCION">En ejecución</option>
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

                    {/* Información adicional y configuración */}
                    <div className="card mb-3">
                      <div className="card-header bg-light">
                        <h6 className="mb-0"><i className="fas fa-info-circle me-2"></i>Información General</h6>
                      </div>
                      <div className="card-body">
                        <div className="row">
                          <div className="col-md-8 mb-3">
                            <label className="form-label">Descripción de la Obra
                              <small className="text-muted ms-2">(Ej: "Refacción integral" o "Construcción nueva")</small>
                            </label>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Ingrese una descripción para esta obra"
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

                        {/* Sección Colapsable de Desglose para Obra */}
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
                                        {/* Cálculo en tiempo real */}
                                        {importeJornalesObra && honorarioJornalesObra && (
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#fef3c7', borderRadius: '4px', fontSize: '0.75rem', color: '#92400e' }}>
                                            <strong>💰 Importe:</strong> $
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
                                        {/* Cálculo en tiempo real */}
                                        {importeMaterialesObra && honorarioMaterialesObra && (
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#dbeafe', borderRadius: '4px', fontSize: '0.75rem', color: '#1e40af' }}>
                                            <strong>💰 Importe:</strong> $
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
                                        {/* Cálculo en tiempo real */}
                                        {importeGastosGeneralesObra && honorarioGastosGeneralesObra && (
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#d1fae5', borderRadius: '4px', fontSize: '0.75rem', color: '#065f46' }}>
                                            <strong>💰 Importe:</strong> $
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
                                        {/* Cálculo en tiempo real */}
                                        {importeMayoresCostosObra && honorarioMayoresCostosObra && (
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#fee2e2', borderRadius: '4px', fontSize: '0.75rem', color: '#991b1b' }}>
                                            <strong>💰 Importe:</strong> $
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

                                {/* Sección de Descuentos */}
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
                                          <strong>📊 Base:</strong> ${parseFloat(importeJornalesObra || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                                      {/* Cálculo descuento */}
                                      {importeJornalesObra && descuentoJornalesObra && (
                                        <>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#fef3c7', borderRadius: '4px', fontSize: '0.7rem', color: '#92400e' }}>
                                            <strong>💰 Descuento:</strong> $
                                            {tipoDescuentoJornalesObra === 'fijo'
                                              ? parseFloat(descuentoJornalesObra || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                              : ((parseFloat(importeJornalesObra || 0) * parseFloat(descuentoJornalesObra || 0)) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                            }
                                          </div>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#f59e0b', color: 'white', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                            💵 Total: $
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
                                          <strong>📊 Base:</strong> ${parseFloat(importeMaterialesObra || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                                      {/* Cálculo descuento */}
                                      {importeMaterialesObra && descuentoMaterialesObra && (
                                        <>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#dbeafe', borderRadius: '4px', fontSize: '0.7rem', color: '#1e40af' }}>
                                            <strong>💰 Descuento:</strong> $
                                            {tipoDescuentoMaterialesObra === 'fijo'
                                              ? parseFloat(descuentoMaterialesObra || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                              : ((parseFloat(importeMaterialesObra || 0) * parseFloat(descuentoMaterialesObra || 0)) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                            }
                                          </div>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#3b82f6', color: 'white', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                            💵 Total: $
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
                                          <strong>📊 Base:</strong> ${parseFloat(importeGastosGeneralesObra || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                                      {/* Cálculo descuento */}
                                      {importeGastosGeneralesObra && descuentoGastosGeneralesObra && (
                                        <>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#d1fae5', borderRadius: '4px', fontSize: '0.7rem', color: '#065f46' }}>
                                            <strong>💰 Descuento:</strong> $
                                            {tipoDescuentoGastosGeneralesObra === 'fijo'
                                              ? parseFloat(descuentoGastosGeneralesObra || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                              : ((parseFloat(importeGastosGeneralesObra || 0) * parseFloat(descuentoGastosGeneralesObra || 0)) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                            }
                                          </div>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#10b981', color: 'white', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                            💵 Total: $
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
                                          <strong>📊 Base:</strong> ${parseFloat(importeMayoresCostosObra || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                                      {/* Cálculo descuento */}
                                      {importeMayoresCostosObra && descuentoMayoresCostosObra && (
                                        <>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#fee2e2', borderRadius: '4px', fontSize: '0.7rem', color: '#991b1b' }}>
                                            <strong>💰 Descuento:</strong> $
                                            {tipoDescuentoMayoresCostosObra === 'fijo'
                                              ? parseFloat(descuentoMayoresCostosObra || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                              : ((parseFloat(importeMayoresCostosObra || 0) * parseFloat(descuentoMayoresCostosObra || 0)) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                            }
                                          </div>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#ef4444', color: 'white', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                            💵 Total: $
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

                                {/* Sección de Descuentos sobre Honorarios */}
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
                                          <strong>📊 Hon. Base:</strong> $
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
                                      {/* Cálculo descuento sobre honorario */}
                                      {honorarioJornalesObra && descuentoHonorarioJornalesObra && (
                                        <>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#fef3c7', borderRadius: '4px', fontSize: '0.7rem', color: '#92400e' }}>
                                            <strong>💰 Descuento:</strong> $
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
                                            💵 Hon. Final: $
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
                                          <strong>📊 Hon. Base:</strong> $
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
                                      {/* Cálculo descuento sobre honorario */}
                                      {honorarioMaterialesObra && descuentoHonorarioMaterialesObra && (
                                        <>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#dbeafe', borderRadius: '4px', fontSize: '0.7rem', color: '#1e40af' }}>
                                            <strong>💰 Descuento:</strong> $
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
                                            💵 Hon. Final: $
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
                                          <strong>📊 Hon. Base:</strong> $
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
                                          📊 Hon. Base: $
                                          {(tipoHonorarioGastosGeneralesObra === 'fijo'
                                            ? parseFloat(honorarioGastosGeneralesObra || 0)
                                            : ((parseFloat(importeGastosGeneralesObra || 0) * parseFloat(honorarioGastosGeneralesObra || 0)) / 100)
                                          ).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                      )}
                                      {/* Cálculo descuento sobre honorario */}
                                      {honorarioGastosGeneralesObra && descuentoHonorarioGastosGeneralesObra && (
                                        <>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#d1fae5', borderRadius: '4px', fontSize: '0.7rem', color: '#065f46' }}>
                                            <strong>💰 Descuento:</strong> $
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
                                            💵 Hon. Final: $
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
                                          <strong>📊 Hon. Base:</strong> $
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
                                          📊 Hon. Base: $
                                          {(tipoHonorarioMayoresCostosObra === 'fijo'
                                            ? parseFloat(honorarioMayoresCostosObra || 0)
                                            : ((parseFloat(importeMayoresCostosObra || 0) * parseFloat(honorarioMayoresCostosObra || 0)) / 100)
                                          ).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                      )}
                                      {/* Cálculo descuento sobre honorario */}
                                      {honorarioMayoresCostosObra && descuentoHonorarioMayoresCostosObra && (
                                        <>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#fee2e2', borderRadius: '4px', fontSize: '0.7rem', color: '#991b1b' }}>
                                            <strong>💰 Descuento:</strong> $
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
                                            💵 Hon. Final: $
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
                                          ⚒️ <strong>Jornales:</strong> ${(parseFloat(importeJornalesObra) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                          {honorarioJornalesObra && parseFloat(honorarioJornalesObra) > 0 && (
                                            <span className="ms-1 text-success">
                                              + Hon. {tipoHonorarioJornalesObra === 'porcentaje' ? `${honorarioJornalesObra}%` : `$${(parseFloat(honorarioJornalesObra) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                                            </span>
                                          )}
                                        </div>
                                        <div className="col-6 mb-1">
                                          📦 <strong>Materiales:</strong> ${(parseFloat(importeMaterialesObra) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                          {honorarioMaterialesObra && parseFloat(honorarioMaterialesObra) > 0 && (
                                            <span className="ms-1 text-success">
                                              + Hon. {tipoHonorarioMaterialesObra === 'porcentaje' ? `${honorarioMaterialesObra}%` : `$${(parseFloat(honorarioMaterialesObra) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                                            </span>
                                          )}
                                        </div>
                                        <div className="col-6 mb-1">
                                          💼 <strong>Gastos Generales:</strong> ${(parseFloat(importeGastosGeneralesObra) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                          {honorarioGastosGeneralesObra && parseFloat(honorarioGastosGeneralesObra) > 0 && (
                                            <span className="ms-1 text-success">
                                              + Hon. {tipoHonorarioGastosGeneralesObra === 'porcentaje' ? `${honorarioGastosGeneralesObra}%` : `$${(parseFloat(honorarioGastosGeneralesObra) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                                            </span>
                                          )}
                                        </div>
                                        <div className="col-6 mb-1">
                                          📈 <strong>Mayores Costos:</strong> ${(parseFloat(importeMayoresCostosObra) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
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

                    {/* Sección de Etapas Diarias - Solo en modo edición */}
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
                                      <th>DDía</th>
                                      <th>Fecha</th>
                                      <th>Descripción</th>
                                      <th>Tareas</th>
                                      <th>Estado</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {etapasDiarias.map((etapa, index) => (
                                      <tr key={etapa.id || index}>
                                        <td>
                                          <span className="badge bg-secondary">
                                            DDía {etapa.numeroDia || index + 1}
                                          </span>
                                        </td>
                                        <td>
                                          <small>{etapa.fecha || '-'}</small>
                                        </td>
                                        <td>
                                          <small>{etapa.descripcion || 'Sin descripción'}</small>
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
                                            <span className="badge bg-success">✅ Completada</span>
                                          ) : etapa.estado === 'EN_PROCESO' ? (
                                            <span className="badge bg-primary">🔄 En Proceso</span>
                                          ) : (
                                            <span className="badge bg-secondary">⏳ Pendiente</span>
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
                                Las etapas diarias se generan automáticamente cuando la obra tiene un presupuesto aprobado con jornales y una fecha de inicio programada.
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
                          // Limpiar modo edición si está activo
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
                            setTipoHonorarioJornalesObra('fijo');
                            setHonorarioMaterialesObra('');
                            setTipoHonorarioMaterialesObra('fijo');
                            setHonorarioGastosGeneralesObra('');
                            setTipoHonorarioGastosGeneralesObra('fijo');
                            setHonorarioMayoresCostosObra('');
                            setTipoHonorarioMayoresCostosObra('fijo');
                            setDescuentoJornalesObra('');
                            setTipoDescuentoJornalesObra('fijo');
                            setDescuentoMaterialesObra('');
                            setTipoDescuentoMaterialesObra('fijo');
                            setDescuentoGastosGeneralesObra('');
                            setTipoDescuentoGastosGeneralesObra('fijo');
                            setDescuentoMayoresCostosObra('');
                            setTipoDescuentoMayoresCostosObra('fijo');
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

      {/* Tab Búsqueda */}
      {activeTab === 'busqueda' && (
        <div className="row">
          <div className="col-md-12">
            <div className="card">
              <div className="card-header">
                <h5>Búsqueda por Cliente</h5>
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
                    <p className="small">Haga clic en el botón <i className="fas fa-users"></i> de una obra para cargar sus profesionales</p>
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
            <div className="card" style={{margin: '0', border: 'none'}} onClick={(e) => e.stopPropagation()}>
              <div className="card-header d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-3">
                  <h5 className="mb-0">
                    <i className="fas fa-folder-open me-2"></i>
                    Obras Independientes
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
                          onClick={() => dispatch(setActiveTab('crear'))}
                        >
                          <i className="fas fa-plus me-2"></i>
                          Crear Primera Obra Independiente
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
                            <th className="small">Dirección</th>
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
                                  <div className="mt-1">
                                    <span className="badge bg-warning text-dark" style={{fontSize: '0.7rem'}}>
                                      <i className="fas fa-hand-paper me-1"></i>Obra Independiente
                                    </span>
                                  </div>
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
                                          showNotification('⚠️ No se puede editar una obra creada desde presupuesto', 'warning');
                                          return;
                                        }

                                        // Cargar datos en formulario
                                        const mapeoEstados = {
                                          'EN_PLANIFICACIÓN': 'BORRADOR',
                                          'EN_PLANIFICACION': 'BORRADOR',
                                          'EN PLANIFICACIÓN': 'BORRADOR',
                                          'EN_EJECUCIÓN': 'EN_EJECUCION',
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
                                            setTipoHonorarioJornalesObra(obra.tipoHonorarioJornalesObra || 'fijo');
                                          }
                                          if (obra.honorarioMaterialesObra != null) {
                                            setHonorarioMaterialesObra(String(obra.honorarioMaterialesObra));
                                            setTipoHonorarioMaterialesObra(obra.tipoHonorarioMaterialesObra || 'fijo');
                                          }
                                          if (obra.honorarioGastosGeneralesObra != null) {
                                            setHonorarioGastosGeneralesObra(String(obra.honorarioGastosGeneralesObra));
                                            setTipoHonorarioGastosGeneralesObra(obra.tipoHonorarioGastosGeneralesObra || 'fijo');
                                          }
                                          if (obra.honorarioMayoresCostosObra != null) {
                                            setHonorarioMayoresCostosObra(String(obra.honorarioMayoresCostosObra));
                                            setTipoHonorarioMayoresCostosObra(obra.tipoHonorarioMayoresCostosObra || 'fijo');
                                          }

                                          // Restaurar descuentos base si existen
                                          if (obra.descuentoJornalesObra != null) {
                                            setDescuentoJornalesObra(String(obra.descuentoJornalesObra));
                                            setTipoDescuentoJornalesObra(obra.tipoDescuentoJornalesObra || 'fijo');
                                          }
                                          if (obra.descuentoMaterialesObra != null) {
                                            setDescuentoMaterialesObra(String(obra.descuentoMaterialesObra));
                                            setTipoDescuentoMaterialesObra(obra.tipoDescuentoMaterialesObra || 'fijo');
                                          }
                                          if (obra.descuentoGastosGeneralesObra != null) {
                                            setDescuentoGastosGeneralesObra(String(obra.descuentoGastosGeneralesObra));
                                            setTipoDescuentoGastosGeneralesObra(obra.tipoDescuentoGastosGeneralesObra || 'fijo');
                                          }
                                          if (obra.descuentoMayoresCostosObra != null) {
                                            setDescuentoMayoresCostosObra(String(obra.descuentoMayoresCostosObra));
                                            setTipoDescuentoMayoresCostosObra(obra.tipoDescuentoMayoresCostosObra || 'fijo');
                                          }

                                          // Restaurar descuentos sobre honorarios si existen
                                          if (obra.descuentoHonorarioJornalesObra != null) {
                                            setDescuentoHonorarioJornalesObra(String(obra.descuentoHonorarioJornalesObra));
                                            setTipoDescuentoHonorarioJornalesObra(obra.tipoDescuentoHonorarioJornalesObra || 'fijo');
                                          }
                                          if (obra.descuentoHonorarioMaterialesObra != null) {
                                            setDescuentoHonorarioMaterialesObra(String(obra.descuentoHonorarioMaterialesObra));
                                            setTipoDescuentoHonorarioMaterialesObra(obra.tipoDescuentoHonorarioMaterialesObra || 'fijo');
                                          }
                                          if (obra.descuentoHonorarioGastosGeneralesObra != null) {
                                            setDescuentoHonorarioGastosGeneralesObra(String(obra.descuentoHonorarioGastosGeneralesObra));
                                            setTipoDescuentoHonorarioGastosGeneralesObra(obra.tipoDescuentoHonorarioGastosGeneralesObra || 'fijo');
                                          }
                                          if (obra.descuentoHonorarioMayoresCostosObra != null) {
                                            setDescuentoHonorarioMayoresCostosObra(String(obra.descuentoHonorarioMayoresCostosObra));
                                            setTipoDescuentoHonorarioMayoresCostosObra(obra.tipoDescuentoHonorarioMayoresCostosObra || 'fijo');
                                          }

                                          console.log('📂 Desglose obra restaurado desde DTO (tabla):', obra);
                                        } else {
                                          setUsarDesgloseObra(false);
                                          setImporteMaterialesObra('');
                                          setImporteJornalesObra('');
                                          setImporteHonorariosObra('');
                                          setTipoHonorariosObra('fijo');
                                          setImporteMayoresCostosObra('');
                                          setTipoMayoresCostosObra('fijo');
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
                Trabajos Extra - {obraParaTrabajosExtra?.nombre}
              </h3>
              <span className="badge bg-secondary" style={{ fontSize: '14px', padding: '8px 12px' }}>
                <i className="fas fa-list me-2"></i>
                {trabajosExtra.length} trabajo{trabajosExtra.length !== 1 ? 's' : ''}
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
                        <th className="small">Dirección</th>
                        <th style={{width: '100px'}} className="small">Contacto</th>
                        <th style={{width: '70px'}} className="small">Estado</th>
                        <th style={{width: '80px'}} className="small">Tipo</th>
                        <th style={{width: '100px'}} className="small">Asignaciones</th>
                        <th style={{width: '90px'}} className="small">Inicio</th>
                        <th style={{width: '90px'}} className="small">Fin</th>
                        <th style={{width: '110px'}} className="text-end small">Total</th>
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

                                // Mantener la selección para edición
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
                                  title={rowId === trabajoExtraExpandido ? "Ocultar detalles" : "Ver detalles y configuración"}
                                  style={{
                                    width: '30px',
                                    height: '30px',
                                    transition: 'all 0.3s ease'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTrabajoExtraExpandido(rowId === trabajoExtraExpandido ? null : rowId);
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
                                    🔧 EXTRA
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
                                      <i className="fas fa-pencil-alt me-1" title="En edición"></i>
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
                                  // Detectar si es Global o Detallado basándose en nombres de elementos
                                  // GLOBAL: Nombres genéricos como "Presupuesto Global", "Para la obra", "Materiales para..."
                                  // DETALLADO: Nombres específicos como "Hercal", "Escalera", "Oficial Albañil"

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

                                  // Si tiene elementos globales y NO tiene elementos específicos → GLOBAL
                                  // Si tiene elementos específicos → DETALLADO
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
                              <td className="small text-center">{row.fechaProbableInicio || <span className="text-muted">—</span>}</td>
                              <td className="small text-center">
                                {(() => {
                                  const fechaInicioStr = row.fechaProbableInicio;
                                  const tiempoEstimado = row.tiempoEstimadoTerminacion || row.plazoEjecucionDias;

                                  if (!fechaInicioStr || !tiempoEstimado) {
                                    return <span className="text-muted">—</span>;
                                  }

                                  try {
                                    // Parsear fecha, asegurando formato YYYY-MM-DD
                                    const fechaClean = fechaInicioStr.includes('T') ? fechaInicioStr.split('T')[0] : fechaInicioStr;
                                    const [year, month, day] = fechaClean.split('-').map(Number);

                                    // Validar que la fecha sea válida
                                    if (!year || !month || !day) return <span className="text-muted">—</span>;

                                    let fecha = new Date(year, month - 1, day);
                                    let diasContados = 0;

                                    // Contar días hábiles
                                    while (diasContados < tiempoEstimado) {
                                      const diaSemana = fecha.getDay();
                                      // Lunes(1) a Viernes(5) y no feriado
                                      if (diaSemana >= 1 && diaSemana <= 5 && !esFeriado(fecha)) {
                                        diasContados++;
                                      }
                                      // Si no terminamos, avanzar al siguiente día natural
                                      if (diasContados < tiempoEstimado) {
                                        fecha.setDate(fecha.getDate() + 1);
                                      }
                                    }

                                    return fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                  } catch (err) {
                                    return <span className="text-muted">—</span>;
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

                                        const totalGeneral = row.totalFinal || row.montoTotal || (totalProfesionales + totalTareas) || 0;

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
                                          // 1. Profesionales
                                          if (item.profesionales && item.profesionales.length > 0) {
                                            item.profesionales.forEach(p => totalProf += Number(p.subtotal) || 0);
                                          } else {
                                            totalProf += Number(item.subtotalManoObra) || 0;
                                          }

                                          // 2. Materiales
                                          if (item.materialesLista && item.materialesLista.length > 0) {
                                            item.materialesLista.forEach(m => totalMat += Number(m.subtotal) || 0);
                                          } else {
                                            totalMat += Number(item.subtotalMateriales) || 0;
                                          }

                                          // 3. Jornales
                                          if (item.jornales && item.jornales.length > 0) {
                                            item.jornales.forEach(j => totalJornales += Number(j.subtotal) || 0);
                                          } else {
                                            totalJornales += Number(item.subtotalJornales) || 0;
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

                                        // 3. Calcular Mayores Costos (Sobre Bases - la misma lógica que Modal)
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
                            </tr>

                            {/* FILA EXPANDIDA CON DETALLES DE PLANIFICACIÓN */}
                            {trabajoExtraExpandido === rowId && (
                              <tr className="bg-light" key={`trabajo-extra-expandido-${rowId}-${row.profesionales?.length || 0}-${row.materiales?.length || 0}-${row.gastosGenerales?.length || 0}`}>
                                <td colSpan="8" className="p-0">
                                  <div className="bg-light p-3 border-top">
                                    <div className="mb-4 p-3 border rounded bg-white">
                                      <div className="row align-items-center">
                                        <div className="col-md-8">
                                          <h6 className="text-primary mb-1">
                                            <i className="fas fa-cog me-2"></i>
                                            Configuración de Planificación
                                          </h6>
                                          {row?.fechaProbableInicio && row?.tiempoEstimadoTerminacion ? (
                                            <small className="text-success">
                                              ✅ Configurado: {Math.ceil((row.tiempoEstimadoTerminacion || 0) / 5)} semanas ({row.tiempoEstimadoTerminacion || 0} días) - {(row.profesionales?.length || 0)} profesional{row.profesionales?.length !== 1 ? 'es' : ''} asignado{row.profesionales?.length !== 1 ? 's' : ''}
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
                                              title="Reconfigurar planificación del trabajo extra"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                // 🔥 PRIMERO: buscar el trabajo extra actualizado en el estado local
                                                const trabajoExtraActualizado = trabajosExtra.find(t => t.id === row.id) || row;

                                                console.log('✅ [Reconfigurar TE] Usando trabajo extra actualizado:', {
                                                  rowId: row.id,
                                                  tiempoEnRow: row.tiempoEstimadoTerminacion,
                                                  tiempoEnEstado: trabajoExtraActualizado.tiempoEstimadoTerminacion,
                                                  fechaEnRow: row.fechaProbableInicio,
                                                  fechaEnEstado: trabajoExtraActualizado.fechaProbableInicio
                                                });

                                                // Crear objeto con presupuesto completo para configuración de planificación
                                                const trabajoParaConfigurar = {
                                                  id: `te_${trabajoExtraActualizado.id}`,
                                                  nombre: trabajoExtraActualizado.nombreObra || trabajoExtraActualizado.nombre,
                                                  direccion: obraParaTrabajosExtra?.direccion || '',
                                                  // ✅ Usar el trabajo extra ACTUALIZADO del estado local (NO el row del backend)
                                                  presupuestoNoCliente: trabajoExtraActualizado,
                                                  fechaProbableInicio: trabajoExtraActualizado.fechaProbableInicio || '',
                                                  tiempoEstimadoTerminacion: trabajoExtraActualizado.tiempoEstimadoTerminacion || 0,
                                                  _esTrabajoExtra: true,
                                                  _trabajoExtraId: trabajoExtraActualizado.id,
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
                                              title="Editar solo Fecha Probable de Inicio y Días Hábiles"
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
                                          Trabajos Extra
                                        </h6>
                                        <button
                                          className="btn btn-sm btn-outline-secondary w-100 d-flex justify-content-between align-items-center"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            // Crear objeto de trabajo extra como si fuera una obra para gestionar sus sub-trabajos
                                            // 🔧 CRÍTICO: Obtener el ID numérico de la obra original (nunca usar IDs tipo "te_X")
                                            const obraOriginalIdNumerico = obraParaTrabajosExtra._obraOriginalId ||
                                              (typeof obraParaTrabajosExtra.id === 'number' ? obraParaTrabajosExtra.id : null);

                                            if (!obraOriginalIdNumerico) {
                                              console.error('❌ No se pudo determinar el ID de la obra original');
                                              showNotification('Error: No se pudo determinar la obra original', 'error');
                                              return;
                                            }

                                            // 🔧 CRÍTICO: Usar el ID correcto del trabajo extra (puede venir como id_trabajo_extra o id)
                                            const trabajoExtraIdReal = row.id_trabajo_extra || row.presupuestoNoClienteId || row.id;

                                            const trabajoComoObra = {
                                              ...obraParaTrabajosExtra,
                                              id: `te_${trabajoExtraIdReal}`,
                                              nombre: row.nombreObra || row.nombre,
                                              _esTrabajoExtra: true,
                                              _trabajoExtraId: trabajoExtraIdReal,
                                              _obraOriginalId: obraOriginalIdNumerico
                                            };
                                            console.log('🔍 Gestionar trabajos extra del trabajo extra:', {
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
                                            Gestionar Trabajos Extra
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
                                            console.log('🎯 CLICK en Asignar Profesionales - Trabajo Extra ID:', row.id);

                                            try {
                                              // ✅ CARGAR EL PRESUPUESTO COMPLETO DEL TRABAJO EXTRA
                                              console.log('🔍 Cargando presupuesto completo del trabajo extra ID:', row.id);
                                              const presupuestoCompleto = await api.presupuestosNoCliente.getById(row.id, empresaId);
                                              console.log('✅ Presupuesto completo cargado:', presupuestoCompleto);

                                              // ✅ BUSCAR trabajo extra actualizado del estado (con asignaciones reales)
                                              const trabajoActualizado = trabajosExtra.find(t => t.id === row.id) || row;
                                              console.log('🔍 Usando asignaciones actualizadas:', trabajoActualizado.profesionales?.length || 0);
                                              const asignaciones = trabajoActualizado.profesionales || [];

                                              // Usar el presupuesto completo como si fuera una obra
                                              // 🔑 IMPORTANTE: Para trabajos extra, id y obraId deben ser el ID del TRABAJO EXTRA,
                                              // no del obra padre. Esto asegura que las asignaciones se guarden correctamente.
                                              const trabajoComoObra = {
                                                id: row.id, // ✅ ID del trabajo extra - USADO POR EL MODAL PARA GUARDAR
                                                obraId: row.id, // ✅ ID del trabajo extra (NO de la obra padre)
                                                nombre: row.nombreObra || row.nombre,
                                                presupuestoNoCliente: presupuestoCompleto, // ✅ Presupuesto completo cargado
                                                fechaProbableInicio: presupuestoCompleto.fechaProbableInicio || row.fechaProbableInicio,
                                                tiempoEstimadoTerminacion: presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion,
                                                diasHabiles: presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion,
                                                semanas: Math.ceil((presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion || 0) / 5),
                                                // Configuración ya establecida (para ir directo a Paso 2)
                                                configuracionPlanificacion: {
                                                  semanas: Math.ceil((presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion || 0) / 5),
                                                  diasHabiles: presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion,
                                                  fechaInicio: presupuestoCompleto.fechaProbableInicio || row.fechaProbableInicio,
                                                  jornalesTotales: presupuestoCompleto.jornalesTotales || row.jornalesTotales || 0,
                                                  semanasObjetivo: Math.ceil((presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion || 0) / 5)
                                                },
                                                // ✅ Asignaciones reales cargadas del backend
                                                asignacionesActuales: asignaciones,
                                                profesionales: asignaciones,
                                                _esTrabajoExtra: true,
                                                _trabajoExtraId: row.id,
                                                // Usar _obraOriginalId si existe (cuando estamos dentro de un trabajo extra),
                                                // sino usar id directamente
                                                _obraOriginalId: obraParaTrabajosExtra._obraOriginalId || obraParaTrabajosExtra.id
                                              };

                                              console.log('🔍 DEBUG - Trabajo Extra para profesionales:', {
                                                id: trabajoComoObra.id,
                                                presupuesto: !!trabajoComoObra.presupuestoNoCliente,
                                                items: trabajoComoObra.presupuestoNoCliente?.itemsCalculadora?.length || 0,
                                                asignaciones: trabajoComoObra.asignacionesActuales.length,
                                                configurado: !!trabajoComoObra.configuracionPlanificacion
                                              });

                                              setObraParaAsignarProfesionales(trabajoComoObra);
                                              setMostrarModalAsignarProfesionalesSemanal(true);
                                            } catch (error) {
                                              console.error('❌ Error cargando presupuesto del trabajo extra:', error);
                                              showNotification('Error al cargar el presupuesto del trabajo extra', 'error');
                                            }
                                          }}
                                        >
                                          <span>
                                            <i className="fas fa-user-plus me-1"></i>
                                            Asignar Profesionales
                                          </span>
                                          <span className="badge bg-success d-flex align-items-center gap-1">
                                            {(() => {
                                              const trabajoActualizado = trabajosExtra.find(t => t.id === row.id);
                                              return trabajoActualizado?.profesionales?.length || 0;
                                            })()}
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
                                              // ✅ CARGAR EL PRESUPUESTO COMPLETO DEL TRABAJO EXTRA
                                              console.log('🔍 Cargando presupuesto completo del trabajo extra ID:', row.id);
                                              const presupuestoCompleto = await api.presupuestosNoCliente.getById(row.id, empresaId);
                                              console.log('✅ Presupuesto completo cargado:', presupuestoCompleto);

                                              // Usar el presupuesto completo como si fuera una obra
                                              // 🔑 IMPORTANTE: Para trabajos extra, id y obraId deben ser el ID del TRABAJO EXTRA,
                                              // no del obra padre. Esto asegura que las asignaciones se guarden correctamente.
                                              const trabajoParaMateriales = {
                                                id: row.id, // ✅ ID del trabajo extra - USADO POR EL MODAL PARA GUARDAR
                                                obraId: row.id, // ✅ ID del trabajo extra (NO de la obra padre)
                                                nombre: row.nombreObra || row.nombre,
                                                presupuestoNoCliente: presupuestoCompleto, // ✅ Presupuesto completo cargado
                                                fechaProbableInicio: presupuestoCompleto.fechaProbableInicio || row.fechaProbableInicio,
                                                tiempoEstimadoTerminacion: presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion,
                                                diasHabiles: presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion,
                                                semanas: Math.ceil((presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion || 0) / 5),
                                                // Configuración establecida
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
                                                _trabajoExtraId: row.id,
                                                // Usar _obraOriginalId si existe (cuando estamos dentro de un trabajo extra),
                                                // sino usar id directamente
                                                _obraOriginalId: obraParaTrabajosExtra._obraOriginalId || obraParaTrabajosExtra.id
                                              };
                                              setObraParaAsignarMateriales(trabajoParaMateriales);
                                              setMostrarModalAsignarMateriales(true);
                                            } catch (error) {
                                              console.error('❌ Error cargando presupuesto del trabajo extra:', error);
                                              showNotification('Error al cargar el presupuesto del trabajo extra', 'error');
                                            }
                                          }}
                                        >
                                          <span>
                                            <i className="fas fa-boxes me-2"></i>
                                            Asignar Materiales
                                          </span>
                                          <span className="badge bg-warning text-dark">
                                            {(() => {
                                              const trabajoActualizado = trabajosExtra.find(t => t.id === row.id);
                                              return trabajoActualizado?.materiales?.length || 0;
                                            })()}
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
                                              // ✅ CARGAR EL PRESUPUESTO COMPLETO DEL TRABAJO EXTRA
                                              console.log('🔍 Cargando presupuesto completo del trabajo extra ID:', row.id);
                                              const presupuestoCompleto = await api.presupuestosNoCliente.getById(row.id, empresaId);
                                              console.log('✅ Presupuesto completo cargado:', presupuestoCompleto);

                                              // Usar el presupuesto completo como si fuera una obra
                                              // 🔑 IMPORTANTE: Para trabajos extra, id y obraId deben ser el ID del TRABAJO EXTRA,
                                              // no del obra padre. Esto asegura que las asignaciones se guarden correctamente.
                                              const trabajoParaGastos = {
                                                id: row.id, // ✅ ID del trabajo extra - USADO POR EL MODAL PARA GUARDAR
                                                obraId: row.id, // ✅ ID del trabajo extra (NO de la obra padre)
                                                nombre: row.nombreObra || row.nombre,
                                                presupuestoNoCliente: presupuestoCompleto, // ✅ Presupuesto completo cargado
                                                fechaProbableInicio: presupuestoCompleto.fechaProbableInicio || row.fechaProbableInicio,
                                                tiempoEstimadoTerminacion: presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion,
                                                diasHabiles: presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion,
                                                semanas: Math.ceil((presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion || 0) / 5),
                                                // Configuración establecida
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
                                                _trabajoExtraId: row.id,
                                                // Usar _obraOriginalId si existe (cuando estamos dentro de un trabajo extra),
                                                // sino usar id directamente
                                                _obraOriginalId: obraParaTrabajosExtra._obraOriginalId || obraParaTrabajosExtra.id
                                              };
                                              setObraParaAsignarGastos(trabajoParaGastos);
                                              setMostrarModalAsignarGastos(true);
                                            } catch (error) {
                                              console.error('❌ Error cargando presupuesto del trabajo extra:', error);
                                              showNotification('Error al cargar el presupuesto del trabajo extra', 'error');
                                            }
                                          }}
                                        >
                                          <span>
                                            <i className="fas fa-dollar-sign me-2"></i>
                                            Asignar Gastos
                                          </span>
                                          <span className="badge bg-danger">
                                            {(() => {
                                              const trabajoActualizado = trabajosExtra.find(t => t.id === row.id);
                                              return trabajoActualizado?.gastosGenerales?.length || 0;
                                            })()}
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
                                              // 🔥 PRIMERO: buscar el trabajo extra actualizado en el estado local
                                              const trabajoExtraEnEstado = trabajosExtra.find(t => t.id === row.id);
                                              const tiempoActualizado = trabajoExtraEnEstado?.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion;
                                              const fechaActualizada = trabajoExtraEnEstado?.fechaProbableInicio || row.fechaProbableInicio;

                                              console.log('🔍 [Cronograma TE] Buscando trabajo extra con configuración actualizada:', {
                                                rowId: row.id,
                                                trabajoEnEstado: !!trabajoExtraEnEstado,
                                                tiempoEnEstado: trabajoExtraEnEstado?.tiempoEstimadoTerminacion,
                                                tiempoFinal: tiempoActualizado
                                              });

                                              // Si el trabajo extra en estado tiene datos diferentes a row, usarlos sin cargar del backend
                                              let presupuestoCompleto;

                                              // 🔒 PASO 1: Buscar en cache etiquetado para trabajos extra (más confiable)
                                              const presupuestoCacheado = presupuestosObras[`te_${row.id}`];

                                              if (presupuestoCacheado && presupuestoCacheado.tiempoEstimadoTerminacion) {
                                                console.log('✅ [Cronograma TE] RECUPERANDO presupuesto del cache etiquetado (congelado)');
                                                presupuestoCompleto = presupuestoCacheado;
                                              } else if (trabajoExtraEnEstado && (trabajoExtraEnEstado.tiempoEstimadoTerminacion !== row.tiempoEstimadoTerminacion || trabajoExtraEnEstado.fechaProbableInicio !== row.fechaProbableInicio)) {
                                                console.log('✅ [Cronograma TE] Usando trabajo extra actualizado del estado (NO cargar del backend)');
                                                presupuestoCompleto = { ...row, ...trabajoExtraEnEstado };
                                              } else {
                                                console.log('🔍 [Cronograma TE] Cargando presupuesto completo del trabajo extra ID:', row.id);
                                                presupuestoCompleto = await api.presupuestosNoCliente.getById(row.id, empresaId);
                                              }

                                              console.log('✅ [Cronograma TE] Presupuesto resuelto:', {
                                                tiempoEstimadoTerminacion: presupuestoCompleto.tiempoEstimadoTerminacion,
                                                fechaProbableInicio: presupuestoCompleto.fechaProbableInicio
                                              });

                                              // Crear objeto independiente para trabajo extra
                                              const trabajoParaEtapas = {
                                                // Usar _obraOriginalId si existe (trabajo extra dentro de trabajo extra),
                                                // sino verificar row.obraId, sino obraParaTrabajosExtra.id
                                                id: row.obraId || obraParaTrabajosExtra._obraOriginalId || obraParaTrabajosExtra.id,
                                                _idVisualizacion: `te_${row.id}`, // ID único para visualización
                                                nombre: row.nombreObra || row.nombre,
                                                fechaProbableInicio: presupuestoCompleto.fechaProbableInicio || row.fechaProbableInicio,
                                                tiempoEstimadoTerminacion: presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion,
                                                diasHabiles: presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion,
                                                semanas: Math.ceil((presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion || 0) / 5),
                                                // Configuración establecida
                                                configuracionPlanificacion: {
                                                  semanas: Math.ceil((presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion || 0) / 5),
                                                  diasHabiles: presupuestoCompleto.tiempoEstimadoTerminacion || row.tiempoEstimadoTerminacion,
                                                  fechaInicio: presupuestoCompleto.fechaProbableInicio || row.fechaProbableInicio
                                                },
                                                _esTrabajoExtra: true,
                                                _trabajoExtraId: row.id,
                                                _trabajoExtraPresupuestoId: row.id, // ID del presupuesto del trabajo extra
                                                _obraOriginalId: row.obraId || obraParaTrabajosExtra._obraOriginalId || obraParaTrabajosExtra.id,
                                                _trabajoExtraNombre: row.nombreObra || row.nombre,
                                                obraId: row.obraId || obraParaTrabajosExtra._obraOriginalId || obraParaTrabajosExtra.id,
                                                // 🔥 IMPORTANTE: Usar el presupuesto actualizado (puede ser del estado o del backend)
                                                presupuestoNoCliente: presupuestoCompleto
                                              };
                                              console.log('🎯 [Gestionar Etapa TE] Usando presupuesto con', presupuestoCompleto.tiempoEstimadoTerminacion, 'días hábiles');
                                              console.log('🎯🎯🎯 [Gestionar Etapa TE] TRABAJO_PARA_ETAPAS COMPLETO:', {
                                                id: trabajoParaEtapas.id,
                                                presupuestoNoClienteTiempo: trabajoParaEtapas.presupuestoNoCliente?.tiempoEstimadoTerminacion,
                                                presupuestoNoClienteFecha: trabajoParaEtapas.presupuestoNoCliente?.fechaProbableInicio,
                                                TRABAJO_PARA_ETAPAS_COMPLETO: trabajoParaEtapas
                                              });
                                              setSelectedObraId(trabajoParaEtapas.id);
                                              cargarEtapasDiarias(trabajoParaEtapas);
                                              dispatch(setActiveTab('etapas-diarias'));
                                            } catch (error) {
                                              console.error('❌ Error cargando presupuesto del trabajo extra:', error);
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
                                          Trabajos Adicionales
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
                                              _trabajoExtraId: row.id,
                                              _trabajoExtraNombre: row.nombreObra || row.nombre
                                            };
                                            setObraParaTrabajosAdicionales(trabajoExtraComoObra);
                                            setMostrarModalListaTrabajosAdicionales(true);
                                          }}
                                        >
                                          <span>
                                            <i className="fas fa-plus-square me-2"></i>
Gestionar Trabajos Adicionales
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
                                                        {ta.diasNecesarios} días
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
                                                          const trabajoExtraComoObra = {
                                                            ...row,
                                                            id: row.obraId || obraParaTrabajosExtra.id,
                                                            _esTrabajoExtra: true,
                                                            _trabajoExtraId: row.id,
                                                            _trabajoExtraNombre: row.nombreObra || row.nombre
                                                          };
                                                          setTrabajoAdicionalEditar(ta);
                                                          setObraParaTrabajosAdicionales(trabajoExtraComoObra);
                                                          setMostrarModalTrabajoAdicional(true);
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

                                      {/* NUEVA SECCIÓN: GESTIÓN DE ESTADO Y CICLO DE VIDA */}
                                      <div className="col-12 mt-4">
                                        <div className="card border-primary">
                                            <div className="card-header bg-primary text-white py-2">
                                                <h6 className="mb-0"><i className="fas fa-tasks me-2"></i>Gestión de Ciclo de Vida</h6>
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
                                                                <i className="fas fa-check me-2"></i>Terminar Edición
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
                                                                        handleCambiarEstadoTrabajoExtra(row, 'ENVIADO');
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
                                                                    <i className="fas fa-undo me-2"></i>Cancelar Envío
                                                                </button>
                                                                <button
                                                                    className="btn btn-success text-white"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleCambiarEstadoTrabajoExtra(row, 'APROBADO');
                                                                    }}
                                                                >
                                                                    <i className="fas fa-check-double me-2"></i>Aprobar Presupuesto
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
                                                                    <i className="fas fa-undo me-2"></i>Deshacer Aprobación
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
                      console.log('🔍 DEBUG Volver:', {
                        esTrabajoExtra: obraParaEtapasDiarias?._esTrabajoExtra,
                        obraOriginalId: obraParaEtapasDiarias?._obraOriginalId,
                        obraCompleta: obraParaEtapasDiarias
                      });
                      if (obraParaEtapasDiarias?._esTrabajoExtra && obraParaEtapasDiarias?._obraOriginalId) {
                        console.log('✅ Es trabajo extra, volviendo a trabajos-extra');
                        const obraOriginal = obras.find(o => o.id === obraParaEtapasDiarias._obraOriginalId);
                        setObraParaTrabajosExtra(obraOriginal);
                        setObraParaEtapasDiarias(null);
                        cargarTrabajosExtra(obraOriginal); // 🔥 Recargar los trabajos extra
                        dispatch(setActiveTab('trabajos-extra'));
                      } else {
                        console.log('⚠️ No es trabajo extra, volviendo a lista');
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
                        {obraParaEtapasDiarias.direccion || 'Sin dirección'}
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
                    // 🔥 Si es trabajo extra, usar SOLO su presupuesto pre-cargado (no buscar en cache)
                    const presupuestoActualizado = obraParaEtapasDiarias?._esTrabajoExtra
                      ? obraParaEtapasDiarias?.presupuestoNoCliente
                      : (presupuestosObras[obraParaEtapasDiarias?.id] || obraParaEtapasDiarias?.presupuestoNoCliente);

                    // 🔍 DEBUG: Ver qué presupuesto se está usando
                    console.log('🔍 [CRONOGRAMA JSX] presupuestoActualizado:', {
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
                            Para generar el calendario automático, la obra debe tener un presupuesto (PresupuestoNoCliente) con jornales.
                          </p>
                        </div>
                      );
                    }

                    if (calendarioCompleto.length === 0) {
                      return (
                        <div className="text-center text-muted py-5">
                          <i className="fas fa-calendar-times fa-4x mb-3"></i>
                          <p className="fs-5">No se pudieron generar etapas automáticas</p>
                          <p className="text-muted">
                            El presupuesto debe incluir un ítem de "jornales"
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
                            {/* ✅ USAR MISMA LÓGICA QUE LÍNEA 5181*/}
                            {obraParaEtapasDiarias?.tiempoEstimadoTerminacion || obraParaEtapasDiarias?.presupuestoNoCliente?.tiempoEstimadoTerminacion || 0}
                          </h5>
                          <small>Días</small>
                        </div>
                        <div className="col-3">
                          <h5>
                            {/* ✅ CALCULAR SEMANAS CONSIDERANDO FERIADOS */}
                            {(() => {
                              const diasHabiles = obraParaEtapasDiarias?.tiempoEstimadoTerminacion || obraParaEtapasDiarias?.presupuestoNoCliente?.tiempoEstimadoTerminacion || 0;
                              const fechaInicio = obraParaEtapasDiarias?.fechaProbableInicio || obraParaEtapasDiarias?.presupuestoNoCliente?.fechaProbableInicio;

                              if (fechaInicio && diasHabiles > 0) {
                                try {
                                  // Usar función que calcula semanas considerando feriados
                                  return calcularSemanasParaDiasHabiles(parsearFechaLocal(fechaInicio), diasHabiles);
                                } catch (error) {
                                  console.warn('⚠️ Error calculando semanas con feriados, usando fallback:', error);
                                  return Math.ceil(diasHabiles / 5);
                                }
                              } else {
                                // Si no hay fecha de inicio, usar cálculo simple
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
                      // Calcular el rango de días laborables de la semana (lun-vie)
                      const fechasLaborables = semana.dias.filter(d =>
                        d.estado !== 'FERIADO' && d.estado !== 'FIN_DE_SEMANA'
                      );

                      if (fechasLaborables.length === 0) {
                        // Fallback si no hay días laborables
                        return null;
                      }

                      const primerDiaLaboral = parsearFechaLocal(fechasLaborables[0].fecha);

                      // El último día laboral de la semana es el viernes (día 5) de esa semana calendario
                      // Encontrar el viernes de la semana del primer día laboral
                      const primerLunes = new Date(primerDiaLaboral);
                      const diasHastaLunes = (primerDiaLaboral.getDay() + 6) % 7; // Días desde el lunes anterior
                      primerLunes.setDate(primerDiaLaboral.getDate() - diasHastaLunes);

                      const viernesDeEsaSemana = new Date(primerLunes);
                      viernesDeEsaSemana.setDate(primerLunes.getDate() + 4); // Lunes + 4 días = Viernes

                      // Si hay días laborables que llegan hasta viernes, usar viernes. Si no, usar el último día laboral disponible
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
                                <th width="10%" className="text-center">Acción</th>
                              </tr>
                            </thead>
                            <tbody>
                              {semana.dias.map((dia) => {
                                if (dia.esFeriado || dia.estado === 'FERIADO') {
                                  // Mostrar celda de feriado (NO cuenta como día hábil)
                                  return (
                                    <tr key={dia.fecha} className="table-warning">
                                      <td>
                                        <strong>{dia.diaSemana.substring(0, 3)}</strong>
                                        <br/><small className="text-muted">{dia.diaNumero}/{dia.mes}</small>
                                      </td>
                                      <td colSpan="3" className="text-center text-muted fst-italic">
                                        🎊 Feriado - No laborable
                                      </td>
                                    </tr>
                                  );
                                } else if (dia.estado === 'FIN_DE_SEMANA') {
                                  // Día que cae en la semana pero no es día hábil
                                  return (
                                    <tr key={dia.fecha} className="table-light">
                                      <td>
                                        <strong>{dia.diaSemana.substring(0, 3)}</strong>
                                        <br/><small className="text-muted">{dia.diaNumero}/{dia.mes}</small>
                                      </td>
                                      <td colSpan="3" className="text-center text-muted fst-italic">
                                        ⏸️ No laborable
                                      </td>
                                    </tr>
                                  );
                                } else {
                                  // Día hábil normal
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
                                                    <span className="badge bg-success me-1" style={{ fontSize: '8px' }}>✓ Completada</span>
                                                  ) : t.estado === 'EN_PROCESO' ? (
                                                    <span className="badge bg-primary me-1" style={{ fontSize: '8px' }}>🔄 En Proceso</span>
                                                  ) : (
                                                    <span className="badge bg-secondary me-1" style={{ fontSize: '8px' }}>○ Pendiente</span>
                                                  )}
                                                  <span style={{ fontSize: '11px' }}>{t.descripcion}</span>
                                                </div>
                                                {t.profesionales && t.profesionales.length > 0 && (
                                                  <div className="text-muted" style={{ fontSize: '9px', marginLeft: '20px' }}>
                                                    👤 {t.profesionales.map(p =>
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

      {/* Modal de edición eliminado - se usa el mismo formulario de creación */}

      {/* Mostrar estadísticas si están disponibles */}
      {estadisticas && (
        <div className="row mt-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h5>Estadísticas de Obras</h5>
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

                {/* Gráfico de barras */}
                {estadisticas.estados && (
                  <div className="row">
                    <div className="col-md-7 mb-4">
                      <h6 className="mb-2">Gráfico de barras</h6>
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
                      <h6 className="mb-2">Gráfico de torta</h6>
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
                    {/* Botón para abrir la versión más reciente directamente */}
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
                        Abrir Última Versión (v{presupuestosObra[0].numeroVersion || presupuestosObra[0].version || 1})
                      </button>
                      <small className="text-muted ms-3">
                        Última modificación: {presupuestosObra[0].fechaUltimaModificacionEstado ?
                          new Date(presupuestosObra[0].fechaUltimaModificacionEstado).toLocaleDateString() :
                          (presupuestosObra[0].fechaCreacion ? new Date(presupuestosObra[0].fechaCreacion).toLocaleDateString() : 'N/A')}
                      </small>
                    </div>

                    <div className="table-responsive">
                    <table className="table table-hover table-striped">
                      <thead className="table-light">
                        <tr>
                          <th>ID</th>
                          <th>Versión</th>
                          <th>Estado</th>
                          <th>Fecha Creación</th>
                          <th>Total</th>
                          <th>Cliente</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {presupuestosObra.map((presupuesto, index) => {
                          const esPresupuestoActivo = presupuesto.estado === 'APROBADO' || presupuesto.estado === 'EN_EJECUCIÓN' || presupuesto.estado === 'EN_EJECUCION';
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
                                ${(presupuesto.totalFinal || presupuesto.total || 0).toLocaleString()}
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
                        <p className="mb-2"><strong>Dirección:</strong> {obra?.direccion || 'Sin dirección'}</p>
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
                          <option value="EN_EJECUCION">En ejecución</option>
                          <option value="SUSPENDIDA">Suspendida</option>
                          <option value="TERMINADO">Terminado</option>
                          <option value="CANCELADO">Cancelado</option>
                        </select>
                      </div>

                      <div className="alert alert-info mb-0">
                        <i className="fas fa-info-circle me-2"></i>
                        El estado de la obra se actualizará inmediatamente al confirmar.
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
            // Si es trabajo extra, usar la configuración que viene en el objeto
            // Si es obra regular, buscar en la base de datos
            obraParaAsignarProfesionales._esTrabajoExtra
              ? obraParaAsignarProfesionales.configuracionPlanificacion
              : obtenerConfiguracionObra(obraParaAsignarProfesionales.id)
          }
          onRefreshProfesionales={refrescarProfesionalesDisponibles}
          onAsignar={async (asignacionData) => {
            // Backend integrado - recargar obras después de asignación exitosa
            console.log('Asignación semanal guardada:', asignacionData);

            // 🔥 Si es trabajo extra, recargar trabajos extra; si es obra normal, recargar contadores
            if (obraParaAsignarProfesionales?._esTrabajoExtra && obraParaTrabajosExtra) {
              console.log('🔄 [Profesionales] Recargando trabajos extra para actualizar badges...', {
                trabajoExtraId: obraParaAsignarProfesionales.id,
                // Si estamos dentro de un trabajo extra, usar el ID de la obra original
                obraId: obraParaTrabajosExtra._obraOriginalId || obraParaTrabajosExtra.id
              });
              await cargarTrabajosExtra(obraParaTrabajosExtra);
              console.log('✅ [Profesionales] Trabajos extra recargados');
            } else if (obraParaAsignarProfesionales?.id) {
              cargarContadoresObra(obraParaAsignarProfesionales.id);
            }

            cargarObrasSegunFiltro();

            // Refrescar lista de profesionales disponibles para que el asignado no aparezca más
            await refrescarProfesionalesDisponibles();
          }}
        />
      )}

      {/* Modal de Asignar Materiales a Obra */}
      {mostrarModalAsignarMateriales && obraParaAsignarMateriales && (
        <AsignarMaterialObraModal
          show={mostrarModalAsignarMateriales}
          onClose={async () => {
            console.log('🔄 Cerrando modal de materiales - recargando contadores...');
            // 🔥 Si es trabajo extra, recargar trabajos extra ANTES de cerrar
            if (obraParaAsignarMateriales?._esTrabajoExtra && obraParaTrabajosExtra) {
              console.log('🔄 [Materiales] Recargando trabajos extra para actualizar badges...', {
                trabajoExtraId: obraParaAsignarMateriales.id,
                // Si estamos dentro de un trabajo extra, usar el ID de la obra original
                obraId: obraParaTrabajosExtra._obraOriginalId || obraParaTrabajosExtra.id
              });
              await cargarTrabajosExtra(obraParaTrabajosExtra);
              console.log('✅ [Materiales] Trabajos extra recargados');
            } else if (obraParaAsignarMateriales?.id) {
              cargarContadoresObra(obraParaAsignarMateriales.id);
            }
            setMostrarModalAsignarMateriales(false);
            setObraParaAsignarMateriales(null);
          }}
          obra={obraParaAsignarMateriales}
          configuracionObra={
            // Si es trabajo extra, usar la configuración que viene en el objeto
            // Si es obra regular, buscar en la base de datos
            obraParaAsignarMateriales._esTrabajoExtra
              ? obraParaAsignarMateriales.configuracionPlanificacion
              : obtenerConfiguracionObra(obraParaAsignarMateriales?.id)
          }
          onAsignacionExitosa={async () => {
            showNotification('✓ Materiales asignados correctamente', 'success');
            // 🔥 Si es trabajo extra, recargar trabajos extra; si es obra normal, recargar contadores
            if (obraParaAsignarMateriales?._esTrabajoExtra && obraParaTrabajosExtra) {
              console.log('🔄 [Materiales Success] Recargando trabajos extra para actualizar badges...', {
                trabajoExtraId: obraParaAsignarMateriales.id,
                // Si estamos dentro de un trabajo extra, usar el ID de la obra original
                obraId: obraParaTrabajosExtra._obraOriginalId || obraParaTrabajosExtra.id
              });
              await cargarTrabajosExtra(obraParaTrabajosExtra);
              console.log('✅ [Materiales Success] Trabajos extra recargados');
            } else if (obraParaAsignarMateriales?.id) {
              cargarContadoresObra(obraParaAsignarMateriales.id);
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
            // 🔥 Si es trabajo extra, recargar trabajos extra ANTES de cerrar
            if (obraParaAsignarGastos?._esTrabajoExtra && obraParaTrabajosExtra) {
              console.log('🔄 [Gastos] Recargando trabajos extra para actualizar badges...', {
                trabajoExtraId: obraParaAsignarGastos.id,
                // Si estamos dentro de un trabajo extra, usar el ID de la obra original
                obraId: obraParaTrabajosExtra._obraOriginalId || obraParaTrabajosExtra.id
              });
              await cargarTrabajosExtra(obraParaTrabajosExtra);
              console.log('✅ [Gastos] Trabajos extra recargados');
            }
            setMostrarModalAsignarGastos(false);
            setObraParaAsignarGastos(null);
          }}
          obra={obraParaAsignarGastos}
          configuracionObra={
            // Si es trabajo extra, usar la configuración que viene en el objeto
            // Si es obra regular, buscar en la base de datos
            obraParaAsignarGastos._esTrabajoExtra
              ? obraParaAsignarGastos.configuracionPlanificacion
              : obtenerConfiguracionObra(obraParaAsignarGastos?.id)
          }
          onAsignacionExitosa={async () => {
            showNotification('✓ Gastos generales asignados correctamente', 'success');
            // 🔥 Si es trabajo extra, recargar trabajos extra; si es obra normal, recargar contadores
            if (obraParaAsignarGastos?._esTrabajoExtra && obraParaTrabajosExtra) {
              console.log('🔄 [Gastos Success] Recargando trabajos extra para actualizar badges...', {
                trabajoExtraId: obraParaAsignarGastos.id,
                // Si estamos dentro de un trabajo extra, usar el ID de la obra original
                obraId: obraParaTrabajosExtra._obraOriginalId || obraParaTrabajosExtra.id
              });
              await cargarTrabajosExtra(obraParaTrabajosExtra);
              console.log('✅ [Gastos Success] Trabajos extra recargados');
            } else if (obraParaAsignarGastos?.id) {
              cargarContadoresObra(obraParaAsignarGastos.id);
            }
            cargarObrasSegunFiltro();
          }}
        />
      )}

      {/* Modal Editar Presupuesto */}
      {mostrarModalEditarPresupuesto && presupuestoParaEditar && (
        <PresupuestoNoClienteModal
          show={mostrarModalEditarPresupuesto}
          onClose={() => {
            setMostrarModalEditarPresupuesto(false);
            setPresupuestoParaEditar(null);
          }}
          onSave={async (presupuesto) => {
            console.log('💾 Presupuesto guardado desde modal edición:', presupuesto);

            // Si es un presupuesto APROBADO y tiene obraId, buscar la versión anterior y marcarla como MODIFICADO
            if (
              presupuesto &&
              (presupuesto.estado === 'APROBADO' || presupuesto.estado === 'EN_EJECUCIÓN' || presupuesto.estado === 'EN_EJECUCION') &&
              presupuesto.obraId &&
              (presupuesto.numeroVersion || presupuesto.version) > 1
            ) {
              try {
                // Buscar la versión anterior en el estado local
                const versionesObra = Object.values(presupuestosObras).filter(
                  p => (p.obraId === presupuesto.obraId || p.idObra === presupuesto.obraId)
                );
                const versionActual = presupuesto.numeroVersion || presupuesto.version;
                const anterior = versionesObra.find(
                  p => (p.numeroVersion || p.version) === versionActual - 1
                );
                if (anterior && anterior.id) {
                  console.log('🔄 Marcando versión anterior como MODIFICADO:', anterior.id);
                  await api.presupuestosNoCliente.actualizarEstado(anterior.id, 'MODIFICADO', empresaId);
                }
              } catch (err) {
                console.warn('⚠️ No se pudo marcar la versión anterior como MODIFICADO:', err);
              }
            }

            try {
              // ✅ CASO ESPECIAL: Edición solo de fechas (cualquier estado)
              if (presupuesto._editarSoloFechas === true) {
                console.log('🔄 FLUJO EDITAR SOLO FECHAS - Iniciando desde ObrasPage...');
                console.log('📋 Presupuesto ID:', presupuesto.id);
                console.log('📅 Nueva fechaProbableInicio:', presupuesto.fechaProbableInicio);
                console.log('⏱️ Nuevo tiempoEstimadoTerminacion:', presupuesto.tiempoEstimadoTerminacion);

                try {
                  // ✅ Usar endpoint específico para actualizar solo fechas (PATCH /fechas)
                  const datosActualizarFechas = {
                    fechaProbableInicio: presupuesto.fechaProbableInicio,
                    tiempoEstimadoTerminacion: presupuesto.tiempoEstimadoTerminacion
                  };

                  console.log('📤 Enviando PATCH /fechas al backend - ID:', presupuesto.id);
                  await api.presupuestosNoCliente.actualizarSoloFechas(presupuesto.id, datosActualizarFechas, empresaId);
                  console.log('✅ PATCH /fechas completado exitosamente');

                  showNotification(
                    '✅ Fechas actualizadas exitosamente.\nVersión y estado preservados.',
                    'success'
                  );
                } catch (error) {
                  const mensaje = error.response?.data?.mensaje || error.message || 'Error al actualizar fechas';
                  showNotification(
                    `❌ Error al actualizar fechas:\n\n${mensaje}`,
                    'error'
                  );
                  return; // Salir sin cerrar el modal si hay error
                }
              } else {
                // Guardado normal (sin flag de editar solo fechas)
                showNotification('✅ Presupuesto guardado exitosamente', 'success');

                // 🏗️ AUTO-GENERAR OBRA SI ES TRABAJO EXTRA APROBADO
                if (presupuesto.esPresupuestoTrabajoExtra && presupuesto.estado === 'APROBADO' && presupuesto.obraId) {
                  console.log('🏗️ Trabajo Extra APROBADO detectado - Verificando si necesita crear obra...');
                  try {
                    // Buscar si ya existe una obra con este presupuestoOriginalId
                    const obrasExistentes = await api.obras.obtenerObras({ empresaId });
                    const yaExisteObra = obrasExistentes?.data?.some(o => o.presupuestoOriginalId === presupuesto.id);

                    if (!yaExisteObra) {
                      console.log('📤 No existe obra para este presupuesto - Creando automáticamente...');

                      const obraData = {
                        nombre: presupuesto.nombreObra || presupuesto.nombreObraManual || `Trabajo Extra #${presupuesto.id}`,
                        direccion: presupuesto.direccionObraCalle || 'Dirección no especificada',
                        direccionObraCalle: presupuesto.direccionObraCalle || '',
                        direccionObraAltura: presupuesto.direccionObraAltura || '',
                        direccionObraBarrio: presupuesto.direccionObraBarrio || '',
                        direccionObraLocalidad: presupuesto.direccionObraLocalidad || '',
                        direccionObraProvincia: presupuesto.direccionObraProvincia || '',
                        direccionObraCodigoPostal: presupuesto.direccionObraCodigoPostal || '',
                        idEmpresa: empresaId,
                        clienteId: presupuesto.clienteId,
                        estado: 'APROBADO',
                        esTrabajoExtra: true,
                        obraPadreId: presupuesto.obraId,
                        nombreSolicitante: presupuesto.nombreSolicitante || '',
                        telefono: presupuesto.telefono || '',
                        mail: presupuesto.mail || '',
                        presupuestoOriginalId: presupuesto.id,
                        observaciones: `Obra generada automáticamente desde trabajo extra aprobado #${presupuesto.id}.\n${presupuesto.observaciones || ''}`
                      };

                      await dispatch(createObra({ obra: obraData, empresaId })).unwrap();
                      console.log('✅ Obra creada automáticamente desde presupuesto aprobado');

                      showNotification('✅ Presupuesto aprobado y obra creada automáticamente', 'success');

                      // Recargar obras
                      await dispatch(fetchObrasPorEmpresa(empresaId));
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
              console.error('❌ Error en onSave:', error);
              showNotification('Error al guardar presupuesto: ' + (error.message || 'Error desconocido'), 'error');
              return;
            }

            // Actualizar el presupuesto en el estado local
            if (presupuesto && presupuesto.obraId) {
              console.log('📋 Actualizando presupuestosObras para obra:', presupuesto.obraId);
              setPresupuestosObras(prev => {
                const nuevo = {
                  ...prev,
                  [presupuesto.obraId]: presupuesto
                };
                console.log('  presupuestosObras actualizado:', nuevo);
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
                // Incrementar contador para forzar regeneración del calendario
                setCalendarioVersion(v => {
                  console.log(' Incrementando calendarioVersion:', v, ' €™', v + 1);
                  return v + 1;
                });
              } else if (obraParaEtapasDiarias && obraParaEtapasDiarias.id === presupuesto.obraId && obraParaEtapasDiarias._esTrabajoExtra) {
                console.log('🔒 [eventBus] BLOQUEANDO actualización de presupuesto para TRABAJO EXTRA - manteniendo presupuestoNoCliente intacto');
              }
            } else {
              console.warn(' ⚠️ Presupuesto sin obraId:', presupuesto);
            }

            // Recargar la lista de presupuestos de la obra si está abierta
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
                {/* Información General */}
                <div className="row mb-4">
                  <div className="col-md-6">
                    <div className="card">
                      <div className="card-header bg-light">
                        <h6 className="mb-0"><i className="fas fa-info-circle me-2"></i>Información General</h6>
                      </div>
                      <div className="card-body">
                        <table className="table table-sm">
                          <tbody>
                            <tr>
                              <td className="fw-bold">Número Presupuesto:</td>
                              <td>{presupuestoDetalle.numeroPresupuesto}</td>
                            </tr>
                            <tr>
                              <td className="fw-bold">Versión:</td>
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
                              <td className="fw-bold">Fecha Emisión:</td>
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
                              <td className="fw-bold">Dirección:</td>
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
                                  ? `${presupuestoDetalle.tiempoEstimadoTerminacion} días`
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
          autoGenerarPDF={autoGenerarPDFTrabajoExtra}
          abrirWhatsAppDespuesDePDF={abrirWhatsAppTrabajoExtra}
          abrirEmailDespuesDePDF={abrirEmailTrabajoExtra}
          onPDFGenerado={() => {
            console.log('✅ PDF generado para trabajo extra, cerrando modal...');
            console.log('📥 Iniciando recarga de trabajos extra después del envío...');

            // ⚠️ NO actualizar el estado aquí - ya lo hace marcarTrabajoExtraComoEnviado() dentro del modal
            // Si se hace aquí, sobrescribe el cambio de estado con el objeto viejo (estado A_ENVIAR)

            showNotification('✅ Trabajo extra enviado exitosamente', 'success');

            setAutoGenerarPDFTrabajoExtra(false);
            setAbrirWhatsAppTrabajoExtra(false);
            setAbrirEmailTrabajoExtra(false);
            setMostrarModalTrabajoExtra(false);
            setTrabajoExtraEditar(null);

            // Recargar trabajos extra para reflejar el cambio de estado
            console.log('🔄 Llamando cargarTrabajosExtra para refrescar después del envío...');
            cargarTrabajosExtra(obraParaTrabajosExtra);
            console.log('✅ Recarga de trabajos extra completada');
          }}
          initialData={{
            // ✅ Pasar TODOS los datos del trabajo extra (para incluir campos planos como los de honorarios)
            ...(trabajoExtraEditar || {}),

            // Usar id_trabajo_extra del backend (si está editando) o null si es nuevo
            id: trabajoExtraEditar?.id_trabajo_extra || trabajoExtraEditar?.id || null,

            // IDs y empresa
            // Si estamos dentro de un trabajo extra, usar el ID de la obra original
            obraId: obraParaTrabajosExtra._obraOriginalId || obraParaTrabajosExtra.id,
            idObra: obraParaTrabajosExtra._obraOriginalId || obraParaTrabajosExtra.id,
            clienteId: obraParaTrabajosExtra.clienteId || null,
            idEmpresa: empresaSeleccionada.id,
            nombreEmpresa: empresaSeleccionada.nombreEmpresa,

            // 🔧 CRÍTICO: Marcar como trabajo extra
            esPresupuestoTrabajoExtra: true,

            // 🆕 Si estamos creando un trabajo extra dentro de otro trabajo extra (subobra),
            // pasar el ID del trabajo extra padre para excluirlo de la lista
            _trabajoExtraPadreId: obraParaTrabajosExtra._trabajoExtraId || null,

            // Si está editando, usar datos del trabajo extra; si no, usar datos de la obra
            nombreObraManual: trabajoExtraEditar?.nombre || obraParaTrabajosExtra.nombre || '',
            nombreObra: trabajoExtraEditar?.nombre || obraParaTrabajosExtra.nombre || '',
            descripcion: '',
            observaciones: trabajoExtraEditar?.observaciones || '',

            // Dirección completa de la obra
            direccionObraCalle: obraParaTrabajosExtra.direccionObraCalle || 'Calle genérica',
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

            // Fechas - usar las del trabajo extra si está editando, sino las actuales
            fechaCreacion: trabajoExtraEditar?.fechaCreacion?.split('T')[0] || new Date().toISOString().slice(0, 10),
            fechaEmision: trabajoExtraEditar?.fechaCreacion?.split('T')[0] || new Date().toISOString().slice(0, 10),
            vencimiento: new Date().toISOString().slice(0, 10),
            fechaProbableInicio: trabajoExtraEditar?.fechaProbableInicio?.split('T')[0] || '',

            // Estado y versión - usar el del trabajo extra si existe, sino BORRADOR por defecto
            estado: trabajoExtraEditar?.estado || 'BORRADOR',
            version: trabajoExtraEditar?.version || 1,

            // Tiempo estimado - usar el del trabajo extra si existe
            tiempoEstimadoTerminacion: trabajoExtraEditar?.tiempoEstimadoTerminacion || null,
            calculoAutomaticoDiasHabiles: false,

            // Tipo de presupuesto
            tipoPresupuesto: 'TRADICIONAL',

            // Si está editando, pasar TODOS los datos del trabajo extra
            ...(trabajoExtraEditar && {
              // ✅ Pasar itemsCalculadora directamente desde el trabajo extra (incluye rubros con jornales)
              itemsCalculadora: trabajoExtraEditar.itemsCalculadora || [],

              // ✅ Pasar honorarios si existen
              honorarios: trabajoExtraEditar.honorarios || undefined,

              // ✅ Pasar mayores costos si existen
              mayoresCostos: trabajoExtraEditar.mayoresCostos || undefined,

              // ✅ Pasar profesionales legacy si existen (compatibilidad)
              profesionales: trabajoExtraEditar.profesionales || [],

              // ✅ Pasar materiales si existen
              materiales: trabajoExtraEditar.materiales || [],

              // ✅ Pasar otros costos si existen
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
                    <strong>Dirección:</strong> {obraSeleccionadaTrabajosExtra.direccion}<br/>
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

      {/* Modal Detalle Día */}
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
            // Recargar las etapas después de actualizar
            if (obraParaEtapasDiarias) {
              cargarEtapasDiarias(obraParaEtapasDiarias);
            }
          }}
        />
      )}

      {/* Modal de Configuración Global de Obra */}
      {mostrarModalConfiguracionObra && obraParaConfigurar && (
        <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="fas fa-calendar-plus me-2"></i>
                  Configurar Planificación de Obra
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => {
                    setMostrarModalConfiguracionObra(false);
                    setObraParaConfigurar(null);
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
                  <strong>📊 Información del presupuesto:</strong>
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
                      <li>Total del presupuesto: <strong>${configuracionObra.presupuestoSeleccionado.totalFinal.toLocaleString()}</strong></li>
                    )}
                    {configuracionObra.presupuestoSeleccionado?.tiempoEstimadoTerminacion && (
                      <li>Tiempo estimado (días): <strong>{configuracionObra.presupuestoSeleccionado.tiempoEstimadoTerminacion} días</strong></li>
                    )}
                  </ul>
                </div>

                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">
                      <i className="fas fa-calendar-week me-2"></i>
                      ¿En cuántas semanas quieres terminar la obra?
                    </label>
                    <input
                      type="number"
                      className="form-control mb-2"
                      min="1"
                      placeholder="Ej: 8 semanas"
                      value={configuracionObra.semanasObjetivo}
                      onChange={(e) => setConfiguracionObra(prev => ({
                        ...prev,
                        semanasObjetivo: e.target.value
                      }))}
                    />
                    <label className="form-label mt-2">
                      <i className="fas fa-calendar-day me-2"></i>
                      ¿Cuántos días hábiles necesitas?
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      min="1"
                      placeholder="Ej: 20 días hábiles"
                      value={configuracionObra.diasHabiles}
                      onChange={(e) => setConfiguracionObra(prev => ({
                        ...prev,
                        diasHabiles: e.target.value
                      }))}
                    />
                    <small className="text-muted form-text">
                      El presupuesto requiere {configuracionObra.diasHabiles || 0} días hábiles de trabajo
                    </small>
                    {configuracionObra.presupuestoSeleccionado?.tiempoEstimadoTerminacion && configuracionObra.semanasObjetivo && (
                      <small className="text-success form-text d-block mt-1">
                        <i className="fas fa-info-circle me-1"></i>
                        Calculado automáticamente desde el presupuesto ({configuracionObra.presupuestoSeleccionado.tiempoEstimadoTerminacion} días hábiles). Puedes editarlo si lo necesitas.
                      </small>
                    )}
                  </div>

                  {configuracionObra.semanasObjetivo && (
                    <div className="col-md-6">
                      <label className="form-label text-success">
                        <i className="fas fa-calculator me-2"></i>
                        Cálculos automáticos
                      </label>
                      <div className="bg-light p-3 rounded">
                        <div className="row text-center">
                          {/* Eliminado: Jornales/día necesarios */}
                          <div className="col-6">
                            <div className="h6 text-info mb-0">{configuracionObra.diasHabiles || 0}</div>
                            <small className="text-muted">Días hábiles</small>
                          </div>
                          <div className="col-6">
                            <div className="h6 text-success mb-0">{configuracionObra.semanasObjetivo}</div>
                            <small className="text-muted">Semanas</small>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {configuracionObra.semanasObjetivo && (
                  <div className="alert alert-success mt-3">
                    <strong>✅ Configuración prevista:</strong>
                    <ul className="mb-0 mt-2">
                      <li><strong>{configuracionObra.semanasObjetivo} semanas</strong> de plazo calendario</li>
                      <li><strong>{configuracionObra.diasHabiles || 0} días hábiles</strong> de trabajo efectivo</li>
                      <li><strong>{configuracionObra.capacidadNecesaria || 0} trabajadores/día</strong> promedio necesarios</li>
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
                  }}
                >
                  <i className="fas fa-times me-2"></i>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleGuardarConfiguracionObra}
                  disabled={!configuracionObra.semanasObjetivo || configuracionObra.semanasObjetivo <= 0}
                >
                  <i className="fas fa-save me-2"></i>
                  Guardar Configuración
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

      {/* Modal para seleccionar profesionales en creación de obra */}
      <SeleccionarProfesionalesModal
        show={mostrarModalSeleccionProfesionales}
        onHide={() => setMostrarModalSeleccionProfesionales(false)}
        profesionalesDisponibles={profesionalesAsignadosForm}
        profesionalesSeleccionados={profesionalesAsignadosForm}
        onConfirmar={(seleccionados) => {
          setProfesionalesAsignadosForm(seleccionados);
          setMostrarModalSeleccionProfesionales(false);
        }}
        asignacionesExistentes={asignacionesExistentesObra}
        semanaActual={null}
        fechaInicio={null}
        fechaFin={null}
        empresaSeleccionada={{ id: empresaId }}
        multiplesSeleccion={true}
      />

      {/* Modal de estadísticas de obra seleccionada */}
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

      {/* Modal de estadísticas de todas las obras */}
      {mostrarModalEstadisticasTodasObras && (
        <EstadisticasTodasObrasModal
          obras={obrasConFlags} // ✅ Usar obras procesadas con flags
          empresaId={empresaId}
          empresaSeleccionada={empresaSeleccionada}
          onClose={() => setMostrarModalEstadisticasTodasObras(false)}
          showNotification={showNotification}
          obrasDisponibles={obrasConFlags} // ✅ Pasar obras con flags esObraIndependiente
          obrasSeleccionadas={new Set()} // ✅ Sin selección específica (mostrar todas)
          trabajosExtraSeleccionados={new Set()} // ✅ Sin filtro de trabajos extra
          trabajosAdicionalesDisponibles={trabajosAdicionales} // ✅ Pasar TAs ya cargados
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

      {/* Modal Selección de Envío para Trabajos Extra */}
      {mostrarModalSeleccionEnvioTrabajoExtra && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="fas fa-paper-plane me-2"></i>¿Cómo desea enviar el trabajo extra?
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setMostrarModalSeleccionEnvioTrabajoExtra(false)}
                ></button>
              </div>
              <div className="modal-body text-center py-4">
                <p className="mb-4">Seleccione el método de envío:</p>
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

                      // ✅ ACTIVAR FLAGS PARA WHATSAPP
                      setAbrirWhatsAppTrabajoExtra(true);
                      setAbrirEmailTrabajoExtra(false);

                      console.log('📱 FLAGS ACTIVADOS para WhatsApp');
                      showNotification('📱 Generando PDF para WhatsApp...', 'info');

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

                      // ✅ ACTIVAR FLAGS PARA EMAIL
                      setAbrirWhatsAppTrabajoExtra(false);
                      setAbrirEmailTrabajoExtra(true);

                      console.log('📧 FLAGS ACTIVADOS para Email');
                      showNotification('📧 Generando PDF para Email...', 'info');

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
                    Trabajos Adicionales
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
                {/* Botón crear nuevo */}
                <div className="d-flex justify-content-end mb-3">
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      console.log('🟢 Click en Nuevo Trabajo Adicional desde modal de lista:', {
                        obraParaTrabajosAdicionales,
                        _esTrabajoExtra: obraParaTrabajosAdicionales._esTrabajoExtra,
                        _trabajoExtraId: obraParaTrabajosAdicionales._trabajoExtraId
                      });
                      setTrabajoAdicionalEditar(null);
                      setMostrarModalTrabajoAdicional(true);
                    }}
                  >
                    <i className="fas fa-plus me-2"></i>
                    Nuevo Trabajo Adicional
                  </button>
                </div>

                {/* Lista de trabajos adicionales */}
                {(() => {
                  const trabajosFiltrados = obraParaTrabajosAdicionales._esTrabajoExtra
                    ? obtenerTrabajosAdicionalesTrabajoExtra(obraParaTrabajosAdicionales._trabajoExtraId)
                    : obtenerTrabajosAdicionalesObra(obraParaTrabajosAdicionales.id);

                  console.log('🔍 DEBUG Modal Trabajos Adicionales:', {
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
                        <p className="text-muted">No hay trabajos adicionales registrados</p>
                        <p className="small text-muted">Haga clic en "Nuevo Trabajo Adicional" para crear uno</p>
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
                                {/* Información principal */}
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
                                        <strong>Días:</strong> {ta.diasNecesarios}
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
                                        setTrabajoAdicionalEditar(ta);
                                        setMostrarModalTrabajoAdicional(true);
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
                                      Iniciar Trabajo
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
                                        {prof.honorarioDia && <> (${parseFloat(prof.honorarioDia).toFixed(2)}/día)</>}
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

      {/* Modal Trabajos Adicionales */}
      {mostrarModalTrabajoAdicional && obraParaTrabajosAdicionales && (
        <div
          className="modal fade show"
          style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.7)' }}
          tabIndex="-1"
          onClick={() => {
            setMostrarModalTrabajoAdicional(false);
            setGuardarEnCatalogoTA(false);
            setGuardandoProfesionalTA(false);
            // Resetear estados de desglose
            setUsarDesglose(false);
            setImporteMateriales('');
            setImporteJornales('');
            setImporteHonorarios('');
            setTipoHonorarios('fijo');
            setImporteMayoresCostos('');
            setTipoMayoresCostos('fijo');
            setImporteTotal('');
            setProfesionalAdhocForm({
              nombre: '',
              tipoProfesional: '',
              honorarioDia: '',
              telefono: '',
              email: ''
            });
            // No cerrar el modal de lista, solo el de crear/editar
          }}
        >
          <div className="modal-dialog modal-xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content" style={{ borderRadius: '15px', overflow: 'hidden', boxShadow: '0 10px 50px rgba(0,0,0,0.3)' }}>
              {/* Header con gradiente */}
              <div className="modal-header text-white" style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderBottom: '3px solid #5a67d8',
                padding: '1.5rem'
              }}>
                <div>
                  <h4 className="modal-title mb-0" style={{ fontWeight: '600' }}>
                    <i className="fas fa-clipboard-list me-3" style={{ fontSize: '1.5rem' }}></i>
                    {trabajoAdicionalEditar ? 'Editar Trabajo Adicional' : 'Nuevo Trabajo Adicional'}
                  </h4>
                  <small className="text-white-50 ms-5">Complete la información del trabajo adicional</small>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => {
                    setMostrarModalTrabajoAdicional(false);
                    setTrabajoAdicionalEditar(null);
                    setGuardarEnCatalogoTA(false);
                    setGuardandoProfesionalTA(false);
                    // Resetear estados de desglose
                    setUsarDesglose(false);
                    setImporteMateriales('');
                    setImporteJornales('');
                    setImporteHonorarios('');
                    setTipoHonorarios('fijo');
                    setImporteMayoresCostos('');
                    setTipoMayoresCostos('fijo');
                    setImporteTotal('');
                    setProfesionalAdhocForm({
                      nombre: '',
                      tipoProfesional: '',
                      honorarioDia: '',
                      telefono: '',
                      email: ''
                    });
                  }}
                  style={{ fontSize: '1.2rem' }}
                ></button>
              </div>

              {/* Body */}
              <div className="modal-body" style={{ padding: '2rem', backgroundColor: '#f8f9fa' }}>
                {/* Información de la obra/trabajo extra vinculado */}
                <div className="card mb-4" style={{
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  background: obraParaTrabajosAdicionales._esTrabajoExtra
                    ? 'linear-gradient(135deg, #fff5e6 0%, #ffe0b2 100%)'
                    : 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)'
                }}>
                  <div className="card-body py-3">
                    <div className="d-flex align-items-center">
                      <div className="me-3" style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '12px',
                        background: obraParaTrabajosAdicionales._esTrabajoExtra ? '#ff9800' : '#2196f3',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}>
                        <i className={`fas fa-${obraParaTrabajosAdicionales._esTrabajoExtra ? 'wrench' : 'building'} text-white`} style={{ fontSize: '1.5rem' }}></i>
                      </div>
                      <div>
                        <div className="fw-bold text-dark" style={{ fontSize: '0.9rem', marginBottom: '2px' }}>
                          <i className="fas fa-link me-2 text-muted"></i>
                          Vinculado a:
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#333' }}>
                          {obraParaTrabajosAdicionales._esTrabajoExtra
                            ? obraParaTrabajosAdicionales._trabajoExtraNombre
                            : obraParaTrabajosAdicionales.nombre}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Formulario */}
                <form
                  id="formTrabajoAdicional"
                  onSubmit={(e) => {
                    e.preventDefault();
                    // El submit se maneja desde el botón de guardar
                  }}
                >
                  {/* Sección 1: Información General */}
                  <div className="card mb-4" style={{ border: 'none', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                    <div className="card-header" style={{
                      background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)',
                      color: 'white',
                      borderRadius: '12px 12px 0 0',
                      padding: '1rem 1.5rem'
                    }}>
                      <h6 className="mb-0" style={{ fontWeight: '600' }}>
                        <i className="fas fa-info-circle me-2"></i>
                        Información General
                      </h6>
                    </div>
                    <div className="card-body p-4">
                      {/* Nombre de la tarea */}
                      <div className="mb-4">
                        <label className="form-label" style={{ fontWeight: '600', color: '#374151', fontSize: '0.95rem' }}>
                          <i className="fas fa-tasks me-2 text-primary"></i>
                          Nombre de la Tarea Adicional
                          <span className="text-danger ms-1">*</span>
                        </label>
                        <input
                          type="text"
                          name="nombre"
                          className="form-control form-control-lg"
                          placeholder="Ej: Instalación de sistema eléctrico adicional"
                          defaultValue={trabajoAdicionalEditar?.nombre || ''}
                          required
                          style={{
                            borderRadius: '10px',
                            border: '2px solid #e5e7eb',
                            padding: '0.75rem 1rem',
                            fontSize: '1rem'
                          }}
                        />
                      </div>

                      <div className="row">
                        {/* Importe */}
                        <div className="col-md-4 mb-4">
                          <label className="form-label" style={{ fontWeight: '600', color: '#374151', fontSize: '0.95rem' }}>
                            <i className="fas fa-dollar-sign me-2 text-success"></i>
                            Importe Total
                            <span className="text-danger ms-1">*</span>
                          </label>
                          <div className="input-group" style={{ borderRadius: '10px', overflow: 'hidden' }}>
                            <span className="input-group-text" style={{
                              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              color: 'white',
                              border: 'none',
                              fontWeight: '600'
                            }}>
                              $
                            </span>
                            <input
                              type="number"
                              name="importe"
                              className="form-control form-control-lg"
                              placeholder="0.00"
                              step="0.01"
                              min="0"
                              value={usarDesglose ? importeTotal : undefined}
                              defaultValue={!usarDesglose ? (trabajoAdicionalEditar?.importe || '') : undefined}
                              onChange={(e) => !usarDesglose && setImporteTotal(e.target.value)}
                              readOnly={usarDesglose}
                              required
                              style={{
                                border: '2px solid #e5e7eb',
                                borderLeft: 'none',
                                fontSize: '1rem',
                                backgroundColor: usarDesglose ? '#f3f4f6' : 'white',
                                cursor: usarDesglose ? 'not-allowed' : 'text'
                              }}
                            />
                          </div>

                          {/* Toggle para desglose */}
                          <div className="mt-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => {
                                setUsarDesglose(!usarDesglose);
                                // Limpiar todos los campos al activar/desactivar
                                setImporteMateriales('');
                                setImporteJornales('');
                                setImporteGastosGenerales('');
                                setImporteMayoresCostos('');
                                setHonorarioJornales('');
                                setTipoHonorarioJornales('fijo');
                                setHonorarioMateriales('');
                                setTipoHonorarioMateriales('fijo');
                                setHonorarioGastosGenerales('');
                                setTipoHonorarioGastosGenerales('fijo');
                                setHonorarioMayoresCostos('');
                                setTipoHonorarioMayoresCostos('fijo');
                                setDescuentoJornales('');
                                setTipoDescuentoJornales('fijo');
                                setDescuentoMateriales('');
                                setTipoDescuentoMateriales('fijo');
                                setDescuentoGastosGenerales('');
                                setTipoDescuentoGastosGenerales('fijo');
                                setDescuentoMayoresCostos('');
                                setTipoDescuentoMayoresCostos('fijo');
                                setImporteTotal('');
                              }}
                              style={{ borderRadius: '8px', fontSize: '0.85rem' }}
                            >
                              <i className={`fas fa-${usarDesglose ? 'calculator' : 'list'} me-2`}></i>
                              {usarDesglose ? 'Usar Importe Simple' : 'Desglosar Importe'}
                            </button>
                          </div>
                        </div>

                        {/* Sección Colapsable de Desglose */}
                        {usarDesglose && (
                          <div className="col-12 mb-4">
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
                                  Desglose del Importe
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
                                          value={importeJornales}
                                          onChange={(e) => setImporteJornales(e.target.value)}
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
                                            className={`btn btn-sm ${tipoHonorarioJornales === 'fijo' ? 'btn-warning' : 'btn-outline-warning'}`}
                                            onClick={() => setTipoHonorarioJornales('fijo')}
                                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                                          >
                                            $ Fijo
                                          </button>
                                          <button
                                            type="button"
                                            className={`btn btn-sm ${tipoHonorarioJornales === 'porcentaje' ? 'btn-warning' : 'btn-outline-warning'}`}
                                            onClick={() => setTipoHonorarioJornales('porcentaje')}
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
                                            {tipoHonorarioJornales === 'fijo' ? '$' : '%'}
                                          </span>
                                          <input
                                            type="number"
                                            className="form-control"
                                            placeholder={tipoHonorarioJornales === 'fijo' ? '0.00' : '0'}
                                            step={tipoHonorarioJornales === 'fijo' ? '0.01' : '1'}
                                            min="0"
                                            max={tipoHonorarioJornales === 'porcentaje' ? '100' : undefined}
                                            value={honorarioJornales}
                                            onChange={(e) => setHonorarioJornales(e.target.value)}
                                            style={{
                                              border: '1px solid #f59e0b',
                                              borderLeft: 'none',
                                              fontSize: '0.85rem'
                                            }}
                                          />
                                        </div>
                                        {honorarioJornales && importeJornales && (
                                          <div className="mt-1 p-1 text-center" style={{
                                            backgroundColor: '#fef3c7',
                                            borderRadius: '4px',
                                            border: '1px solid #f59e0b',
                                            fontSize: '0.75rem',
                                            color: '#92400e',
                                            fontWeight: '600'
                                          }}>
                                            {`Honorario: $${(() => {
                                              const importe = parseFloat(importeJornales);
                                              const hon = parseFloat(honorarioJornales);
                                              const montoHon = tipoHonorarioJornales === 'fijo' ? hon : (importe * hon / 100);
                                              return montoHon.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            })()}`}
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
                                          value={importeMateriales}
                                          onChange={(e) => setImporteMateriales(e.target.value)}
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
                                            className={`btn btn-sm ${tipoHonorarioMateriales === 'fijo' ? 'btn-primary' : 'btn-outline-primary'}`}
                                            onClick={() => setTipoHonorarioMateriales('fijo')}
                                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                                          >
                                            $ Fijo
                                          </button>
                                          <button
                                            type="button"
                                            className={`btn btn-sm ${tipoHonorarioMateriales === 'porcentaje' ? 'btn-primary' : 'btn-outline-primary'}`}
                                            onClick={() => setTipoHonorarioMateriales('porcentaje')}
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
                                            {tipoHonorarioMateriales === 'fijo' ? '$' : '%'}
                                          </span>
                                          <input
                                            type="number"
                                            className="form-control"
                                            placeholder={tipoHonorarioMateriales === 'fijo' ? '0.00' : '0'}
                                            step={tipoHonorarioMateriales === 'fijo' ? '0.01' : '1'}
                                            min="0"
                                            max={tipoHonorarioMateriales === 'porcentaje' ? '100' : undefined}
                                            value={honorarioMateriales}
                                            onChange={(e) => setHonorarioMateriales(e.target.value)}
                                            style={{
                                              border: '1px solid #3b82f6',
                                              borderLeft: 'none',
                                              fontSize: '0.85rem'
                                            }}
                                          />
                                        </div>
                                        {honorarioMateriales && importeMateriales && (
                                          <div className="mt-1 p-1 text-center" style={{
                                            backgroundColor: '#dbeafe',
                                            borderRadius: '4px',
                                            border: '1px solid #3b82f6',
                                            fontSize: '0.75rem',
                                            color: '#1e40af',
                                            fontWeight: '600'
                                          }}>
                                            {`Honorario: $${(() => {
                                              const importe = parseFloat(importeMateriales);
                                              const hon = parseFloat(honorarioMateriales);
                                              const montoHon = tipoHonorarioMateriales === 'fijo' ? hon : (importe * hon / 100);
                                              return montoHon.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            })()}`}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>

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
                                          value={importeGastosGenerales}
                                          onChange={(e) => setImporteGastosGenerales(e.target.value)}
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
                                            className={`btn btn-sm ${tipoHonorarioGastosGenerales === 'fijo' ? 'btn-success' : 'btn-outline-success'}`}
                                            onClick={() => setTipoHonorarioGastosGenerales('fijo')}
                                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                                          >
                                            $ Fijo
                                          </button>
                                          <button
                                            type="button"
                                            className={`btn btn-sm ${tipoHonorarioGastosGenerales === 'porcentaje' ? 'btn-success' : 'btn-outline-success'}`}
                                            onClick={() => setTipoHonorarioGastosGenerales('porcentaje')}
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
                                            {tipoHonorarioGastosGenerales === 'fijo' ? '$' : '%'}
                                          </span>
                                          <input
                                            type="number"
                                            className="form-control"
                                            placeholder={tipoHonorarioGastosGenerales === 'fijo' ? '0.00' : '0'}
                                            step={tipoHonorarioGastosGenerales === 'fijo' ? '0.01' : '1'}
                                            min="0"
                                            max={tipoHonorarioGastosGenerales === 'porcentaje' ? '100' : undefined}
                                            value={honorarioGastosGenerales}
                                            onChange={(e) => setHonorarioGastosGenerales(e.target.value)}
                                            style={{
                                              border: '1px solid #10b981',
                                              borderLeft: 'none',
                                              fontSize: '0.85rem'
                                            }}
                                          />
                                        </div>
                                        {honorarioGastosGenerales && importeGastosGenerales && (
                                          <div className="mt-1 p-1 text-center" style={{
                                            backgroundColor: '#d1fae5',
                                            borderRadius: '4px',
                                            border: '1px solid #10b981',
                                            fontSize: '0.75rem',
                                            color: '#065f46',
                                            fontWeight: '600'
                                          }}>
                                            {`Honorario: $${(() => {
                                              const importe = parseFloat(importeGastosGenerales);
                                              const hon = parseFloat(honorarioGastosGenerales);
                                              const montoHon = tipoHonorarioGastosGenerales === 'fijo' ? hon : (importe * hon / 100);
                                              return montoHon.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            })()}`}
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
                                          value={importeMayoresCostos}
                                          onChange={(e) => setImporteMayoresCostos(e.target.value)}
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
                                            className={`btn btn-sm ${tipoHonorarioMayoresCostos === 'fijo' ? 'btn-danger' : 'btn-outline-danger'}`}
                                            onClick={() => setTipoHonorarioMayoresCostos('fijo')}
                                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                                          >
                                            $ Fijo
                                          </button>
                                          <button
                                            type="button"
                                            className={`btn btn-sm ${tipoHonorarioMayoresCostos === 'porcentaje' ? 'btn-danger' : 'btn-outline-danger'}`}
                                            onClick={() => setTipoHonorarioMayoresCostos('porcentaje')}
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
                                            {tipoHonorarioMayoresCostos === 'fijo' ? '$' : '%'}
                                          </span>
                                          <input
                                            type="number"
                                            className="form-control"
                                            placeholder={tipoHonorarioMayoresCostos === 'fijo' ? '0.00' : '0'}
                                            step={tipoHonorarioMayoresCostos === 'fijo' ? '0.01' : '1'}
                                            min="0"
                                            max={tipoHonorarioMayoresCostos === 'porcentaje' ? '100' : undefined}
                                            value={honorarioMayoresCostos}
                                            onChange={(e) => setHonorarioMayoresCostos(e.target.value)}
                                            style={{
                                              border: '1px solid #ef4444',
                                              borderLeft: 'none',
                                              fontSize: '0.85rem'
                                            }}
                                          />
                                        </div>
                                        {honorarioMayoresCostos && importeMayoresCostos && (
                                          <div className="mt-1 p-1 text-center" style={{
                                            backgroundColor: '#fee2e2',
                                            borderRadius: '4px',
                                            border: '1px solid #ef4444',
                                            fontSize: '0.75rem',
                                            color: '#991b1b',
                                            fontWeight: '600'
                                          }}>
                                            {`Honorario: $${(() => {
                                              const importe = parseFloat(importeMayoresCostos);
                                              const hon = parseFloat(honorarioMayoresCostos);
                                              const montoHon = tipoHonorarioMayoresCostos === 'fijo' ? hon : (importe * hon / 100);
                                              return montoHon.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            })()}`}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Sección de Descuentos */}
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
                                      {/* Mostrar Base */}
                                      {importeJornales && (
                                        <div className="mb-1 p-1 text-center" style={{
                                          backgroundColor: '#fef3c7',
                                          borderRadius: '4px',
                                          border: '1px solid #f59e0b',
                                          fontSize: '0.75rem',
                                          color: '#92400e',
                                          fontWeight: '500'
                                        }}>
                                          📊 Base: ${parseFloat(importeJornales).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                      )}
                                      <div className="btn-group d-flex mb-1" role="group" style={{ borderRadius: '6px' }}>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoJornales === 'fijo' ? 'btn-warning' : 'btn-outline-warning'}`}
                                          onClick={() => setTipoDescuentoJornales('fijo')}
                                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }}
                                        >
                                          $ Fijo
                                        </button>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoJornales === 'porcentaje' ? 'btn-warning' : 'btn-outline-warning'}`}
                                          onClick={() => setTipoDescuentoJornales('porcentaje')}
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
                                          {tipoDescuentoJornales === 'fijo' ? '$' : '%'}
                                        </span>
                                        <input
                                          type="number"
                                          className="form-control"
                                          placeholder="0"
                                          step={tipoDescuentoJornales === 'fijo' ? '0.01' : '1'}
                                          min="0"
                                          max={tipoDescuentoJornales === 'porcentaje' ? '100' : undefined}
                                          value={descuentoJornales}
                                          onChange={(e) => setDescuentoJornales(e.target.value)}
                                          style={{
                                            border: '1px solid #f59e0b',
                                            borderLeft: 'none',
                                            fontSize: '0.8rem'
                                          }}
                                        />
                                      </div>
                                      {/* Mostrar Descuento y Total */}
                                      {descuentoJornales && importeJornales && (
                                        <>
                                          <div className="mt-1 p-1 text-center" style={{
                                            backgroundColor: '#fed7aa',
                                            borderRadius: '4px',
                                            border: '1px solid #ea580c',
                                            fontSize: '0.75rem',
                                            color: '#7c2d12',
                                            fontWeight: '600'
                                          }}>
                                            💰 Descuento: ${(() => {
                                              const base = parseFloat(importeJornales);
                                              const desc = parseFloat(descuentoJornales);
                                              const montoDesc = tipoDescuentoJornales === 'fijo' ? desc : (base * desc / 100);
                                              return montoDesc.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            })()}
                                          </div>
                                          <div className="mt-1 p-1 text-center" style={{
                                            backgroundColor: '#dcfce7',
                                            borderRadius: '4px',
                                            border: '1px solid #16a34a',
                                            fontSize: '0.75rem',
                                            color: '#14532d',
                                            fontWeight: '700'
                                          }}>
                                            💵 Total: ${(() => {
                                              const base = parseFloat(importeJornales);
                                              const desc = parseFloat(descuentoJornales);
                                              const montoDesc = tipoDescuentoJornales === 'fijo' ? desc : (base * desc / 100);
                                              const total = base - montoDesc;
                                              return total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
                                      {/* Mostrar Base */}
                                      {importeMateriales && (
                                        <div className="mb-1 p-1 text-center" style={{
                                          backgroundColor: '#dbeafe',
                                          borderRadius: '4px',
                                          border: '1px solid #3b82f6',
                                          fontSize: '0.75rem',
                                          color: '#1e40af',
                                          fontWeight: '500'
                                        }}>
                                          📊 Base: ${parseFloat(importeMateriales).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                      )}
                                      <div className="btn-group d-flex mb-1" role="group" style={{ borderRadius: '6px' }}>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoMateriales === 'fijo' ? 'btn-primary' : 'btn-outline-primary'}`}
                                          onClick={() => setTipoDescuentoMateriales('fijo')}
                                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }}
                                        >
                                          $ Fijo
                                        </button>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoMateriales === 'porcentaje' ? 'btn-primary' : 'btn-outline-primary'}`}
                                          onClick={() => setTipoDescuentoMateriales('porcentaje')}
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
                                          {tipoDescuentoMateriales === 'fijo' ? '$' : '%'}
                                        </span>
                                        <input
                                          type="number"
                                          className="form-control"
                                          placeholder="0"
                                          step={tipoDescuentoMateriales === 'fijo' ? '0.01' : '1'}
                                          min="0"
                                          max={tipoDescuentoMateriales === 'porcentaje' ? '100' : undefined}
                                          value={descuentoMateriales}
                                          onChange={(e) => setDescuentoMateriales(e.target.value)}
                                          style={{
                                            border: '1px solid #3b82f6',
                                            borderLeft: 'none',
                                            fontSize: '0.8rem'
                                          }}
                                        />
                                      </div>
                                      {/* Mostrar Descuento y Total */}
                                      {descuentoMateriales && importeMateriales && (
                                        <>
                                          <div className="mt-1 p-1 text-center" style={{
                                            backgroundColor: '#bfdbfe',
                                            borderRadius: '4px',
                                            border: '1px solid #2563eb',
                                            fontSize: '0.75rem',
                                            color: '#1e3a8a',
                                            fontWeight: '600'
                                          }}>
                                            💰 Descuento: ${(() => {
                                              const base = parseFloat(importeMateriales);
                                              const desc = parseFloat(descuentoMateriales);
                                              const montoDesc = tipoDescuentoMateriales === 'fijo' ? desc : (base * desc / 100);
                                              return montoDesc.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            })()}
                                          </div>
                                          <div className="mt-1 p-1 text-center" style={{
                                            backgroundColor: '#dcfce7',
                                            borderRadius: '4px',
                                            border: '1px solid #16a34a',
                                            fontSize: '0.75rem',
                                            color: '#14532d',
                                            fontWeight: '700'
                                          }}>
                                            💵 Total: ${(() => {
                                              const base = parseFloat(importeMateriales);
                                              const desc = parseFloat(descuentoMateriales);
                                              const montoDesc = tipoDescuentoMateriales === 'fijo' ? desc : (base * desc / 100);
                                              const total = base - montoDesc;
                                              return total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
                                      {/* Mostrar Base */}
                                      {importeGastosGenerales && (
                                        <div className="mb-1 p-1 text-center" style={{
                                          backgroundColor: '#d1fae5',
                                          borderRadius: '4px',
                                          border: '1px solid #10b981',
                                          fontSize: '0.75rem',
                                          color: '#065f46',
                                          fontWeight: '500'
                                        }}>
                                          📊 Base: ${parseFloat(importeGastosGenerales).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                      )}
                                      <div className="btn-group d-flex mb-1" role="group" style={{ borderRadius: '6px' }}>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoGastosGenerales === 'fijo' ? 'btn-success' : 'btn-outline-success'}`}
                                          onClick={() => setTipoDescuentoGastosGenerales('fijo')}
                                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }}
                                        >
                                          $ Fijo
                                        </button>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoGastosGenerales === 'porcentaje' ? 'btn-success' : 'btn-outline-success'}`}
                                          onClick={() => setTipoDescuentoGastosGenerales('porcentaje')}
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
                                          {tipoDescuentoGastosGenerales === 'fijo' ? '$' : '%'}
                                        </span>
                                        <input
                                          type="number"
                                          className="form-control"
                                          placeholder="0"
                                          step={tipoDescuentoGastosGenerales === 'fijo' ? '0.01' : '1'}
                                          min="0"
                                          max={tipoDescuentoGastosGenerales === 'porcentaje' ? '100' : undefined}
                                          value={descuentoGastosGenerales}
                                          onChange={(e) => setDescuentoGastosGenerales(e.target.value)}
                                          style={{
                                            border: '1px solid #10b981',
                                            borderLeft: 'none',
                                            fontSize: '0.8rem'
                                          }}
                                        />
                                      </div>
                                      {/* Mostrar Descuento y Total */}
                                      {descuentoGastosGenerales && importeGastosGenerales && (
                                        <>
                                          <div className="mt-1 p-1 text-center" style={{
                                            backgroundColor: '#a7f3d0',
                                            borderRadius: '4px',
                                            border: '1px solid #059669',
                                            fontSize: '0.75rem',
                                            color: '#064e3b',
                                            fontWeight: '600'
                                          }}>
                                            💰 Descuento: ${(() => {
                                              const base = parseFloat(importeGastosGenerales);
                                              const desc = parseFloat(descuentoGastosGenerales);
                                              const montoDesc = tipoDescuentoGastosGenerales === 'fijo' ? desc : (base * desc / 100);
                                              return montoDesc.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            })()}
                                          </div>
                                          <div className="mt-1 p-1 text-center" style={{
                                            backgroundColor: '#dcfce7',
                                            borderRadius: '4px',
                                            border: '1px solid #16a34a',
                                            fontSize: '0.75rem',
                                            color: '#14532d',
                                            fontWeight: '700'
                                          }}>
                                            💵 Total: ${(() => {
                                              const base = parseFloat(importeGastosGenerales);
                                              const desc = parseFloat(descuentoGastosGenerales);
                                              const montoDesc = tipoDescuentoGastosGenerales === 'fijo' ? desc : (base * desc / 100);
                                              const total = base - montoDesc;
                                              return total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
                                      {/* Mostrar Base */}
                                      {importeMayoresCostos && (
                                        <div className="mb-1 p-1 text-center" style={{
                                          backgroundColor: '#fee2e2',
                                          borderRadius: '4px',
                                          border: '1px solid #ef4444',
                                          fontSize: '0.75rem',
                                          color: '#991b1b',
                                          fontWeight: '500'
                                        }}>
                                          📊 Base: ${parseFloat(importeMayoresCostos).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                      )}
                                      <div className="btn-group d-flex mb-1" role="group" style={{ borderRadius: '6px' }}>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoMayoresCostos === 'fijo' ? 'btn-danger' : 'btn-outline-danger'}`}
                                          onClick={() => setTipoDescuentoMayoresCostos('fijo')}
                                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }}
                                        >
                                          $ Fijo
                                        </button>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoMayoresCostos === 'porcentaje' ? 'btn-danger' : 'btn-outline-danger'}`}
                                          onClick={() => setTipoDescuentoMayoresCostos('porcentaje')}
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
                                          {tipoDescuentoMayoresCostos === 'fijo' ? '$' : '%'}
                                        </span>
                                        <input
                                          type="number"
                                          className="form-control"
                                          placeholder="0"
                                          step={tipoDescuentoMayoresCostos === 'fijo' ? '0.01' : '1'}
                                          min="0"
                                          max={tipoDescuentoMayoresCostos === 'porcentaje' ? '100' : undefined}
                                          value={descuentoMayoresCostos}
                                          onChange={(e) => setDescuentoMayoresCostos(e.target.value)}
                                          style={{
                                            border: '1px solid #ef4444',
                                            borderLeft: 'none',
                                            fontSize: '0.8rem'
                                          }}
                                        />
                                      </div>
                                      {/* Mostrar Descuento y Total */}
                                      {descuentoMayoresCostos && importeMayoresCostos && (
                                        <>
                                          <div className="mt-1 p-1 text-center" style={{
                                            backgroundColor: '#fecaca',
                                            borderRadius: '4px',
                                            border: '1px solid #dc2626',
                                            fontSize: '0.75rem',
                                            color: '#7f1d1d',
                                            fontWeight: '600'
                                          }}>
                                            💰 Descuento: ${(() => {
                                              const base = parseFloat(importeMayoresCostos);
                                              const desc = parseFloat(descuentoMayoresCostos);
                                              const montoDesc = tipoDescuentoMayoresCostos === 'fijo' ? desc : (base * desc / 100);
                                              return montoDesc.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            })()}
                                          </div>
                                          <div className="mt-1 p-1 text-center" style={{
                                            backgroundColor: '#dcfce7',
                                            borderRadius: '4px',
                                            border: '1px solid #16a34a',
                                            fontSize: '0.75rem',
                                            color: '#14532d',
                                            fontWeight: '700'
                                          }}>
                                            💵 Total: ${(() => {
                                              const base = parseFloat(importeMayoresCostos);
                                              const desc = parseFloat(descuentoMayoresCostos);
                                              const montoDesc = tipoDescuentoMayoresCostos === 'fijo' ? desc : (base * desc / 100);
                                              const total = base - montoDesc;
                                              return total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            })()}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Sección de Descuentos sobre Honorarios */}
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
                                      {honorarioJornales && importeJornales && (
                                        <div className="mb-2 p-1" style={{ backgroundColor: '#fef3c7', borderRadius: '4px', fontSize: '0.7rem', color: '#92400e', border: '1px solid #f59e0b' }}>
                                          <strong>📊 Hon. Base:</strong> $
                                          {(tipoHonorarioJornales === 'fijo'
                                            ? parseFloat(honorarioJornales || 0)
                                            : ((parseFloat(importeJornales || 0) * parseFloat(honorarioJornales || 0)) / 100)
                                          ).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                      )}
                                      <div className="btn-group d-flex mb-1" role="group" style={{ borderRadius: '6px' }}>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoHonorarioJornales === 'fijo' ? 'btn-outline-warning active' : 'btn-outline-warning'}`}
                                          onClick={() => setTipoDescuentoHonorarioJornales('fijo')}
                                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }}
                                        >
                                          $ Fijo
                                        </button>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoHonorarioJornales === 'porcentaje' ? 'btn-outline-warning active' : 'btn-outline-warning'}`}
                                          onClick={() => setTipoDescuentoHonorarioJornales('porcentaje')}
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
                                          {tipoDescuentoHonorarioJornales === 'fijo' ? '$' : '%'}
                                        </span>
                                        <input
                                          type="number"
                                          className="form-control"
                                          placeholder="0"
                                          step={tipoDescuentoHonorarioJornales === 'fijo' ? '0.01' : '1'}
                                          min="0"
                                          max={tipoDescuentoHonorarioJornales === 'porcentaje' ? '100' : undefined}
                                          value={descuentoHonorarioJornales}
                                          onChange={(e) => setDescuentoHonorarioJornales(e.target.value)}
                                          style={{
                                            border: '1px solid #f59e0b',
                                            borderLeft: 'none',
                                            fontSize: '0.8rem'
                                          }}
                                        />
                                      </div>
                                      {/* Honorario Base */}
                                      {honorarioJornales && importeJornales && (
                                        <div className="mt-1 p-1" style={{ backgroundColor: '#fef3c7', borderRadius: '4px', fontSize: '0.7rem', color: '#78350f', fontWeight: 'bold' }}>
                                          📊 Hon. Base: $
                                          {(tipoHonorarioJornales === 'fijo'
                                            ? parseFloat(honorarioJornales || 0)
                                            : ((parseFloat(importeJornales || 0) * parseFloat(honorarioJornales || 0)) / 100)
                                          ).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                      )}
                                      {/* Cálculo descuento sobre honorario */}
                                      {honorarioJornales && descuentoHonorarioJornales && (
                                        <>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#fef3c7', borderRadius: '4px', fontSize: '0.7rem', color: '#92400e' }}>
                                            <strong>💰 Descuento:</strong> $
                                            {(() => {
                                              const honorario = tipoHonorarioJornales === 'fijo'
                                                ? parseFloat(honorarioJornales || 0)
                                                : ((parseFloat(importeJornales || 0) * parseFloat(honorarioJornales || 0)) / 100);
                                              const descuento = tipoDescuentoHonorarioJornales === 'fijo'
                                                ? parseFloat(descuentoHonorarioJornales || 0)
                                                : (honorario * parseFloat(descuentoHonorarioJornales || 0) / 100);
                                              return descuento.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            })()}
                                          </div>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#f59e0b', color: 'white', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                            💵 Hon. Final: $
                                            {(() => {
                                              const honorario = tipoHonorarioJornales === 'fijo'
                                                ? parseFloat(honorarioJornales || 0)
                                                : ((parseFloat(importeJornales || 0) * parseFloat(honorarioJornales || 0)) / 100);
                                              const descuento = tipoDescuentoHonorarioJornales === 'fijo'
                                                ? parseFloat(descuentoHonorarioJornales || 0)
                                                : (honorario * parseFloat(descuentoHonorarioJornales || 0) / 100);
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
                                      {honorarioMateriales && importeMateriales && (
                                        <div className="mb-2 p-1" style={{ backgroundColor: '#dbeafe', borderRadius: '4px', fontSize: '0.7rem', color: '#1e40af', border: '1px solid #3b82f6' }}>
                                          <strong>📊 Hon. Base:</strong> $
                                          {(tipoHonorarioMateriales === 'fijo'
                                            ? parseFloat(honorarioMateriales || 0)
                                            : ((parseFloat(importeMateriales || 0) * parseFloat(honorarioMateriales || 0)) / 100)
                                          ).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                      )}
                                      <div className="btn-group d-flex mb-1" role="group" style={{ borderRadius: '6px' }}>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoHonorarioMateriales === 'fijo' ? 'btn-outline-primary active' : 'btn-outline-primary'}`}
                                          onClick={() => setTipoDescuentoHonorarioMateriales('fijo')}
                                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }}
                                        >
                                          $ Fijo
                                        </button>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoHonorarioMateriales === 'porcentaje' ? 'btn-outline-primary active' : 'btn-outline-primary'}`}
                                          onClick={() => setTipoDescuentoHonorarioMateriales('porcentaje')}
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
                                          {tipoDescuentoHonorarioMateriales === 'fijo' ? '$' : '%'}
                                        </span>
                                        <input
                                          type="number"
                                          className="form-control"
                                          placeholder="0"
                                          step={tipoDescuentoHonorarioMateriales === 'fijo' ? '0.01' : '1'}
                                          min="0"
                                          max={tipoDescuentoHonorarioMateriales === 'porcentaje' ? '100' : undefined}
                                          value={descuentoHonorarioMateriales}
                                          onChange={(e) => setDescuentoHonorarioMateriales(e.target.value)}
                                          style={{
                                            border: '1px solid #3b82f6',
                                            borderLeft: 'none',
                                            fontSize: '0.8rem'
                                          }}
                                        />
                                      </div>
                                      {/* Honorario Base */}
                                      {honorarioMateriales && importeMateriales && (
                                        <div className="mt-1 p-1" style={{ backgroundColor: '#eff6ff', borderRadius: '4px', fontSize: '0.7rem', color: '#1e3a8a', fontWeight: 'bold' }}>
                                          📊 Hon. Base: $
                                          {(tipoHonorarioMateriales === 'fijo'
                                            ? parseFloat(honorarioMateriales || 0)
                                            : ((parseFloat(importeMateriales || 0) * parseFloat(honorarioMateriales || 0)) / 100)
                                          ).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                      )}
                                      {/* Cálculo descuento sobre honorario */}
                                      {honorarioMateriales && descuentoHonorarioMateriales && (
                                        <>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#dbeafe', borderRadius: '4px', fontSize: '0.7rem', color: '#1e40af' }}>
                                            <strong>💰 Descuento:</strong> $
                                            {(() => {
                                              const honorario = tipoHonorarioMateriales === 'fijo'
                                                ? parseFloat(honorarioMateriales || 0)
                                                : ((parseFloat(importeMateriales || 0) * parseFloat(honorarioMateriales || 0)) / 100);
                                              const descuento = tipoDescuentoHonorarioMateriales === 'fijo'
                                                ? parseFloat(descuentoHonorarioMateriales || 0)
                                                : (honorario * parseFloat(descuentoHonorarioMateriales || 0) / 100);
                                              return descuento.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            })()}
                                          </div>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#3b82f6', color: 'white', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                            💵 Hon. Final: $
                                            {(() => {
                                              const honorario = tipoHonorarioMateriales === 'fijo'
                                                ? parseFloat(honorarioMateriales || 0)
                                                : ((parseFloat(importeMateriales || 0) * parseFloat(honorarioMateriales || 0)) / 100);
                                              const descuento = tipoDescuentoHonorarioMateriales === 'fijo'
                                                ? parseFloat(descuentoHonorarioMateriales || 0)
                                                : (honorario * parseFloat(descuentoHonorarioMateriales || 0) / 100);
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
                                      {honorarioGastosGenerales && importeGastosGenerales && (
                                        <div className="mb-2 p-1" style={{ backgroundColor: '#d1fae5', borderRadius: '4px', fontSize: '0.7rem', color: '#065f46', border: '1px solid #10b981' }}>
                                          <strong>📊 Hon. Base:</strong> $
                                          {(tipoHonorarioGastosGenerales === 'fijo'
                                            ? parseFloat(honorarioGastosGenerales || 0)
                                            : ((parseFloat(importeGastosGenerales || 0) * parseFloat(honorarioGastosGenerales || 0)) / 100)
                                          ).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                      )}
                                      <div className="btn-group d-flex mb-1" role="group" style={{ borderRadius: '6px' }}>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoHonorarioGastosGenerales === 'fijo' ? 'btn-outline-success active' : 'btn-outline-success'}`}
                                          onClick={() => setTipoDescuentoHonorarioGastosGenerales('fijo')}
                                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }}
                                        >
                                          $ Fijo
                                        </button>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoHonorarioGastosGenerales === 'porcentaje' ? 'btn-outline-success active' : 'btn-outline-success'}`}
                                          onClick={() => setTipoDescuentoHonorarioGastosGenerales('porcentaje')}
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
                                          {tipoDescuentoHonorarioGastosGenerales === 'fijo' ? '$' : '%'}
                                        </span>
                                        <input
                                          type="number"
                                          className="form-control"
                                          placeholder="0"
                                          step={tipoDescuentoHonorarioGastosGenerales === 'fijo' ? '0.01' : '1'}
                                          min="0"
                                          max={tipoDescuentoHonorarioGastosGenerales === 'porcentaje' ? '100' : undefined}
                                          value={descuentoHonorarioGastosGenerales}
                                          onChange={(e) => setDescuentoHonorarioGastosGenerales(e.target.value)}
                                          style={{
                                            border: '1px solid #10b981',
                                            borderLeft: 'none',
                                            fontSize: '0.8rem'
                                          }}
                                        />
                                      </div>
                                      {/* Honorario Base */}
                                      {honorarioGastosGenerales && importeGastosGenerales && (
                                        <div className="mt-1 p-1" style={{ backgroundColor: '#ecfdf5', borderRadius: '4px', fontSize: '0.7rem', color: '#047857', fontWeight: 'bold' }}>
                                          📊 Hon. Base: $
                                          {(tipoHonorarioGastosGenerales === 'fijo'
                                            ? parseFloat(honorarioGastosGenerales || 0)
                                            : ((parseFloat(importeGastosGenerales || 0) * parseFloat(honorarioGastosGenerales || 0)) / 100)
                                          ).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                      )}
                                      {/* Cálculo descuento sobre honorario */}
                                      {honorarioGastosGenerales && descuentoHonorarioGastosGenerales && (
                                        <>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#d1fae5', borderRadius: '4px', fontSize: '0.7rem', color: '#065f46' }}>
                                            <strong>💰 Descuento:</strong> $
                                            {(() => {
                                              const honorario = tipoHonorarioGastosGenerales === 'fijo'
                                                ? parseFloat(honorarioGastosGenerales || 0)
                                                : ((parseFloat(importeGastosGenerales || 0) * parseFloat(honorarioGastosGenerales || 0)) / 100);
                                              const descuento = tipoDescuentoHonorarioGastosGenerales === 'fijo'
                                                ? parseFloat(descuentoHonorarioGastosGenerales || 0)
                                                : (honorario * parseFloat(descuentoHonorarioGastosGenerales || 0) / 100);
                                              return descuento.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            })()}
                                          </div>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#10b981', color: 'white', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                            💵 Hon. Final: $
                                            {(() => {
                                              const honorario = tipoHonorarioGastosGenerales === 'fijo'
                                                ? parseFloat(honorarioGastosGenerales || 0)
                                                : ((parseFloat(importeGastosGenerales || 0) * parseFloat(honorarioGastosGenerales || 0)) / 100);
                                              const descuento = tipoDescuentoHonorarioGastosGenerales === 'fijo'
                                                ? parseFloat(descuentoHonorarioGastosGenerales || 0)
                                                : (honorario * parseFloat(descuentoHonorarioGastosGenerales || 0) / 100);
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
                                      {honorarioMayoresCostos && importeMayoresCostos && (
                                        <div className="mb-2 p-1" style={{ backgroundColor: '#fee2e2', borderRadius: '4px', fontSize: '0.7rem', color: '#991b1b', border: '1px solid #ef4444' }}>
                                          <strong>📊 Hon. Base:</strong> $
                                          {(tipoHonorarioMayoresCostos === 'fijo'
                                            ? parseFloat(honorarioMayoresCostos || 0)
                                            : ((parseFloat(importeMayoresCostos || 0) * parseFloat(honorarioMayoresCostos || 0)) / 100)
                                          ).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                      )}
                                      <div className="btn-group d-flex mb-1" role="group" style={{ borderRadius: '6px' }}>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoHonorarioMayoresCostos === 'fijo' ? 'btn-outline-danger active' : 'btn-outline-danger'}`}
                                          onClick={() => setTipoDescuentoHonorarioMayoresCostos('fijo')}
                                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }}
                                        >
                                          $ Fijo
                                        </button>
                                        <button
                                          type="button"
                                          className={`btn btn-sm ${tipoDescuentoHonorarioMayoresCostos === 'porcentaje' ? 'btn-outline-danger active' : 'btn-outline-danger'}`}
                                          onClick={() => setTipoDescuentoHonorarioMayoresCostos('porcentaje')}
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
                                          {tipoDescuentoHonorarioMayoresCostos === 'fijo' ? '$' : '%'}
                                        </span>
                                        <input
                                          type="number"
                                          className="form-control"
                                          placeholder="0"
                                          step={tipoDescuentoHonorarioMayoresCostos === 'fijo' ? '0.01' : '1'}
                                          min="0"
                                          max={tipoDescuentoHonorarioMayoresCostos === 'porcentaje' ? '100' : undefined}
                                          value={descuentoHonorarioMayoresCostos}
                                          onChange={(e) => setDescuentoHonorarioMayoresCostos(e.target.value)}
                                          style={{
                                            border: '1px solid #ef4444',
                                            borderLeft: 'none',
                                            fontSize: '0.8rem'
                                          }}
                                        />
                                      </div>
                                      {/* Honorario Base */}
                                      {honorarioMayoresCostos && importeMayoresCostos && (
                                        <div className="mt-1 p-1" style={{ backgroundColor: '#fef2f2', borderRadius: '4px', fontSize: '0.7rem', color: '#7f1d1d', fontWeight: 'bold' }}>
                                          📊 Hon. Base: $
                                          {(tipoHonorarioMayoresCostos === 'fijo'
                                            ? parseFloat(honorarioMayoresCostos || 0)
                                            : ((parseFloat(importeMayoresCostos || 0) * parseFloat(honorarioMayoresCostos || 0)) / 100)
                                          ).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                      )}
                                      {/* Cálculo descuento sobre honorario */}
                                      {honorarioMayoresCostos && descuentoHonorarioMayoresCostos && (
                                        <>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#fee2e2', borderRadius: '4px', fontSize: '0.7rem', color: '#991b1b' }}>
                                            <strong>💰 Descuento:</strong> $
                                            {(() => {
                                              const honorario = tipoHonorarioMayoresCostos === 'fijo'
                                                ? parseFloat(honorarioMayoresCostos || 0)
                                                : ((parseFloat(importeMayoresCostos || 0) * parseFloat(honorarioMayoresCostos || 0)) / 100);
                                              const descuento = tipoDescuentoHonorarioMayoresCostos === 'fijo'
                                                ? parseFloat(descuentoHonorarioMayoresCostos || 0)
                                                : (honorario * parseFloat(descuentoHonorarioMayoresCostos || 0) / 100);
                                              return descuento.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            })()}
                                          </div>
                                          <div className="mt-1 p-1" style={{ backgroundColor: '#ef4444', color: 'white', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                            💵 Hon. Final: $
                                            {(() => {
                                              const honorario = tipoHonorarioMayoresCostos === 'fijo'
                                                ? parseFloat(honorarioMayoresCostos || 0)
                                                : ((parseFloat(importeMayoresCostos || 0) * parseFloat(honorarioMayoresCostos || 0)) / 100);
                                              const descuento = tipoDescuentoHonorarioMayoresCostos === 'fijo'
                                                ? parseFloat(descuentoHonorarioMayoresCostos || 0)
                                                : (honorario * parseFloat(descuentoHonorarioMayoresCostos || 0) / 100);
                                              return (honorario - descuento).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                            })()}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Resumen del Total */}
                                {importeTotal && (
                                  <div className="alert alert-success mb-0 mt-2" style={{
                                    borderRadius: '8px',
                                    border: '2px solid #10b981',
                                    backgroundColor: '#ecfdf5'
                                  }}>
                                    <div className="d-flex justify-content-between align-items-center">
                                      <span className="fw-semibold">
                                        <i className="fas fa-check-circle me-2"></i>
                                        Importe Total Calculado:
                                      </span>
                                      <span className="fs-5 fw-bold text-success">
                                        ${parseFloat(importeTotal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                    <small className="text-muted d-block mt-2">
                                      <div className="row">
                                        <div className="col-6 mb-1">
                                          ⚒️ <strong>Jornales:</strong> ${(parseFloat(importeJornales) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                          {honorarioJornales && parseFloat(honorarioJornales) > 0 && (
                                            <span className="ms-1 text-success">
                                              + Hon. {tipoHonorarioJornales === 'porcentaje' ? `${honorarioJornales}%` : `$${(parseFloat(honorarioJornales) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                                            </span>
                                          )}
                                        </div>
                                        <div className="col-6 mb-1">
                                          📦 <strong>Materiales:</strong> ${(parseFloat(importeMateriales) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                          {honorarioMateriales && parseFloat(honorarioMateriales) > 0 && (
                                            <span className="ms-1 text-success">
                                              + Hon. {tipoHonorarioMateriales === 'porcentaje' ? `${honorarioMateriales}%` : `$${(parseFloat(honorarioMateriales) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                                            </span>
                                          )}
                                        </div>
                                        <div className="col-6 mb-1">
                                          💼 <strong>Gastos Generales:</strong> ${(parseFloat(importeGastosGenerales) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                          {honorarioGastosGenerales && parseFloat(honorarioGastosGenerales) > 0 && (
                                            <span className="ms-1 text-success">
                                              + Hon. {tipoHonorarioGastosGenerales === 'porcentaje' ? `${honorarioGastosGenerales}%` : `$${(parseFloat(honorarioGastosGenerales) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                                            </span>
                                          )}
                                        </div>
                                        <div className="col-6 mb-1">
                                          📈 <strong>Mayores Costos:</strong> ${(parseFloat(importeMayoresCostos) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                          {honorarioMayoresCostos && parseFloat(honorarioMayoresCostos) > 0 && (
                                            <span className="ms-1 text-success">
                                              + Hon. {tipoHonorarioMayoresCostos === 'porcentaje' ? `${honorarioMayoresCostos}%` : `$${(parseFloat(honorarioMayoresCostos) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
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


                        {/* Días/Jornales necesarios */}
                        <div className="col-md-4 mb-4">
                          <label className="form-label" style={{ fontWeight: '600', color: '#374151', fontSize: '0.95rem' }}>
                            <i className="fas fa-calendar-day me-2 text-warning"></i>
                            Días/Jornales
                            <span className="text-danger ms-1">*</span>
                          </label>
                          <div className="input-group" style={{ borderRadius: '10px', overflow: 'hidden' }}>
                            <span className="input-group-text" style={{
                              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                              color: 'white',
                              border: 'none'
                            }}>
                              <i className="fas fa-business-time"></i>
                            </span>
                            <input
                              type="number"
                              name="diasNecesarios"
                              className="form-control form-control-lg"
                              placeholder="5"
                              min="1"
                              defaultValue={trabajoAdicionalEditar?.diasNecesarios || ''}
                              required
                              style={{
                                border: '2px solid #e5e7eb',
                                borderLeft: 'none',
                                fontSize: '1rem'
                              }}
                            />
                          </div>
                        </div>

                        {/* Fecha de Inicio */}
                        <div className="col-md-4 mb-4">
                          <label className="form-label" style={{ fontWeight: '600', color: '#374151', fontSize: '0.95rem' }}>
                            <i className="fas fa-calendar-alt me-2 text-info"></i>
                            Fecha de Inicio
                            <span className="text-danger ms-1">*</span>
                          </label>
                          <div className="input-group" style={{ borderRadius: '10px', overflow: 'hidden' }}>
                            <span className="input-group-text" style={{
                              background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                              color: 'white',
                              border: 'none'
                            }}>
                              <i className="fas fa-clock"></i>
                            </span>
                            <input
                              type="date"
                              name="fechaInicio"
                              className="form-control form-control-lg"
                              defaultValue={trabajoAdicionalEditar?.fechaInicio || ''}
                              required
                              style={{
                                border: '2px solid #e5e7eb',
                                borderLeft: 'none',
                                fontSize: '1rem'
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sección 2: Profesionales */}
                  <div className="card mb-4" style={{ border: 'none', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                    <div className="card-header" style={{
                      background: 'linear-gradient(90deg, #ec4899 0%, #db2777 100%)',
                      color: 'white',
                      borderRadius: '12px 12px 0 0',
                      padding: '1rem 1.5rem'
                    }}>
                      <div className="d-flex justify-content-between align-items-center">
                        <h6 className="mb-0" style={{ fontWeight: '600' }}>
                          <i className="fas fa-users me-2"></i>
                          Profesionales Asignados
                        </h6>
                        <span className="badge bg-white text-dark" style={{ fontSize: '0.85rem' }}>
                          {profesionalesSeleccionados.length + profesionalesAdhoc.length} seleccionados
                        </span>
                      </div>
                    </div>
                    <div className="card-body p-4">
                      {/* Tabs para seleccionar origen */}
                      <ul className="nav nav-pills mb-3" style={{ gap: '0.5rem' }}>
                        <li className="nav-item">
                          <button
                            className={`nav-link ${!mostrarFormularioAdhoc ? 'active' : ''}`}
                            onClick={() => setMostrarFormularioAdhoc(false)}
                            style={{
                              borderRadius: '8px',
                              fontWeight: '600',
                              fontSize: '0.9rem',
                              background: !mostrarFormularioAdhoc
                                ? 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)'
                                : '#f3f4f6',
                              color: !mostrarFormularioAdhoc ? 'white' : '#6b7280',
                              border: 'none'
                            }}
                          >
                            <i className="fas fa-list me-2"></i>
                            Seleccionar de Lista
                          </button>
                        </li>
                        <li className="nav-item">
                          <button
                            className={`nav-link ${mostrarFormularioAdhoc ? 'active' : ''}`}
                            onClick={() => setMostrarFormularioAdhoc(true)}
                            style={{
                              borderRadius: '8px',
                              fontWeight: '600',
                              fontSize: '0.9rem',
                              background: mostrarFormularioAdhoc
                                ? 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)'
                                : '#f3f4f6',
                              color: mostrarFormularioAdhoc ? 'white' : '#6b7280',
                              border: 'none'
                            }}
                          >
                            <i className="fas fa-user-plus me-2"></i>
                            Agregar Manualmente
                          </button>
                        </li>
                      </ul>

                      {/* Contenido según tab seleccionado */}
                      {!mostrarFormularioAdhoc ? (
                        // TAB 1: Seleccionar de lista
                        <>
                          <div className="alert alert-light border-0 mb-3" style={{ borderRadius: '10px', backgroundColor: '#f9fafb' }}>
                            <small className="text-muted d-flex align-items-center">
                              <i className="fas fa-info-circle me-2 text-primary"></i>
                              Seleccione profesionales de su catálogo registrado
                            </small>
                          </div>

                          {loadingProfesionalesTA ? (
                            <div className="text-center py-5">
                              <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Cargando...</span>
                              </div>
                              <p className="mt-2 text-muted">Cargando profesionales...</p>
                            </div>
                          ) : profesionalesDisponiblesTA.length === 0 ? (
                            <div className="text-muted text-center py-5">
                              <i className="fas fa-users-slash mb-3" style={{ fontSize: '3rem', opacity: 0.3 }}></i>
                              <p className="mb-0">No hay profesionales registrados</p>
                              <small className="text-muted">Use la pestaña "Agregar Manualmente" para añadir nuevos</small>
                            </div>
                          ) : (
                            <div className="border rounded-3" style={{
                              maxHeight: '300px',
                              overflowY: 'auto',
                              backgroundColor: 'white'
                            }}>
                              <table className="table table-hover mb-0">
                                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 1 }}>
                                  <tr>
                                    <th style={{ width: '50px' }}></th>
                                    <th>Nombre</th>
                                    <th>Tipo</th>
                                    <th>Honorario/Día</th>
                                  </tr>
                                </thead>
                                <tbody>{profesionalesDisponiblesTA.map((prof) => {
                                    const estaSeleccionado = profesionalesSeleccionados.some(p => p.id === prof.id);
                                    return (
                                      <tr
                                        key={prof.id}
                                        style={{
                                          backgroundColor: estaSeleccionado ? '#fce7f3' : 'transparent',
                                          cursor: 'pointer'
                                        }}
                                        onClick={() => {
                                          if (estaSeleccionado) {
                                            setProfesionalesSeleccionados(prev => prev.filter(p => p.id !== prof.id));
                                          } else {
                                            setProfesionalesSeleccionados(prev => [...prev, prof]);
                                          }
                                        }}
                                      >
                                        <td className="text-center">
                                          <input
                                            type="checkbox"
                                            className="form-check-input"
                                            checked={estaSeleccionado}
                                            onChange={() => {}}
                                            style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                                          />
                                        </td>
                                        <td>
                                          <div className="fw-semibold">{prof.nombre}</div>
                                          {prof.telefono && (
                                            <small className="text-muted">
                                              <i className="fas fa-phone me-1"></i>
                                              {prof.telefono}
                                            </small>
                                          )}
                                        </td>
                                        <td>
                                          <span className="badge bg-primary" style={{ fontSize: '0.75rem' }}>
                                            {prof.tipoProfesional || 'Sin especificar'}
                                          </span>
                                        </td>
                                        <td className="fw-semibold text-success">
                                          ${prof.honorario_dia ? parseFloat(prof.honorario_dia).toFixed(2) : '0.00'}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </>
                      ) : (
                        // TAB 2: Agregar manualmente
                        <>
                          <div className="alert alert-info border-0 mb-3" style={{ borderRadius: '10px' }}>
                            <small className="d-flex align-items-center">
                              <i className="fas fa-lightbulb me-2"></i>
                              Puede crear profesionales temporales o guardarlos en el catálogo para uso futuro
                            </small>
                          </div>

                          <div className="card" style={{ border: '2px dashed #e5e7eb', borderRadius: '10px' }}>
                            <div className="card-body p-3">
                              <div className="row">
                                <div className="col-md-6 mb-3">
                                  <label className="form-label fw-semibold" style={{ fontSize: '0.9rem' }}>
                                    <i className="fas fa-user me-1"></i>
                                    Nombre Completo *
                                  </label>
                                  <input
                                    type="text"
                                    className="form-control"
                                    value={profesionalAdhocForm.nombre}
                                    onChange={(e) => setProfesionalAdhocForm({ ...profesionalAdhocForm, nombre: e.target.value })}
                                    placeholder="Ej: Juan Pérez"
                                    style={{ borderRadius: '8px' }}
                                  />
                                </div>
                                <div className="col-md-6 mb-3">
                                  <label className="form-label fw-semibold" style={{ fontSize: '0.9rem' }}>
                                    <i className="fas fa-hard-hat me-1"></i>
                                    Tipo/Especialidad *
                                  </label>
                                  <input
                                    type="text"
                                    className="form-control"
                                    value={profesionalAdhocForm.tipoProfesional}
                                    onChange={(e) => setProfesionalAdhocForm({ ...profesionalAdhocForm, tipoProfesional: e.target.value })}
                                    placeholder="Ej: Electricista, Plomero, etc."
                                    style={{ borderRadius: '8px' }}
                                  />
                                </div>
                                <div className="col-md-4 mb-3">
                                  <label className="form-label fw-semibold" style={{ fontSize: '0.9rem' }}>
                                    <i className="fas fa-dollar-sign me-1"></i>
                                    Honorario/Día
                                  </label>
                                  <input
                                    type="number"
                                    className="form-control"
                                    value={profesionalAdhocForm.honorarioDia}
                                    onChange={(e) => setProfesionalAdhocForm({ ...profesionalAdhocForm, honorarioDia: e.target.value })}
                                    placeholder="0.00"
                                    step="0.01"
                                    min="0"
                                    style={{ borderRadius: '8px' }}
                                  />
                                </div>
                                <div className="col-md-4 mb-3">
                                  <label className="form-label fw-semibold" style={{ fontSize: '0.9rem' }}>
                                    <i className="fas fa-phone me-1"></i>
                                    Teléfono
                                  </label>
                                  <input
                                    type="tel"
                                    className="form-control"
                                    value={profesionalAdhocForm.telefono}
                                    onChange={(e) => setProfesionalAdhocForm({ ...profesionalAdhocForm, telefono: e.target.value })}
                                    placeholder="Ej: +54 9 11 1234-5678"
                                    style={{ borderRadius: '8px' }}
                                  />
                                </div>
                                <div className="col-md-4 mb-3">
                                  <label className="form-label fw-semibold" style={{ fontSize: '0.9rem' }}>
                                    <i className="fas fa-envelope me-1"></i>
                                    Email
                                  </label>
                                  <input
                                    type="email"
                                    className="form-control"
                                    value={profesionalAdhocForm.email}
                                    onChange={(e) => setProfesionalAdhocForm({ ...profesionalAdhocForm, email: e.target.value })}
                                    placeholder="ejemplo@correo.com"
                                    style={{ borderRadius: '8px' }}
                                  />
                                </div>
                              </div>

                              {/* 🆕 Checkbox para guardar en catálogo */}
                              <div className="mt-3 mb-3">
                                <div className="card bg-light border-primary">
                                  <div className="card-body py-2">
                                    <div className="form-check">
                                      <input
                                        type="checkbox"
                                        className="form-check-input"
                                        id="guardarEnCatalogoTA"
                                        checked={guardarEnCatalogoTA}
                                        onChange={(e) => setGuardarEnCatalogoTA(e.target.checked)}
                                      />
                                      <label className="form-check-label" htmlFor="guardarEnCatalogoTA">
                                        <strong>
                                          <i className="fas fa-save me-2 text-primary"></i>
                                          Guardar en catálogo permanente
                                        </strong>
                                        <small className="d-block text-muted mt-1">
                                          {guardarEnCatalogoTA
                                            ? '✅ Este profesional se guardará como INDEPENDIENTE y estará disponible para futuras asignaciones'
                                            : '⚠️ Solo se agregará temporalmente a este trabajo adicional (no se guardará en el catálogo)'}
                                        </small>
                                      </label>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                className="btn btn-primary w-100"
                                disabled={guardandoProfesionalTA}
                                onClick={async () => {
                                  if (!profesionalAdhocForm.nombre || !profesionalAdhocForm.tipoProfesional) {
                                    showNotification('Complete al menos el nombre y tipo de profesional', 'warning');
                                    return;
                                  }

                                  setGuardandoProfesionalTA(true);

                                  try {
                                    let nuevoProfesional;

                                    // Si está marcado "Guardar en catálogo", crear en la BD
                                    if (guardarEnCatalogoTA) {
                                      if (!empresaId) {
                                        throw new Error('No se puede guardar: falta empresaId');
                                      }

                                      const dataProfesional = {
                                        nombre: profesionalAdhocForm.nombre.trim(),
                                        tipoProfesional: profesionalAdhocForm.tipoProfesional.trim(),
                                        honorarioDia: profesionalAdhocForm.honorarioDia ? parseFloat(profesionalAdhocForm.honorarioDia) : 0,
                                        telefono: profesionalAdhocForm.telefono.trim() || null,
                                        email: profesionalAdhocForm.email.trim() || null,
                                        empresaId: empresaId,
                                        activo: true,
                                        categoria: 'INDEPENDIENTE'
                                      };

                                      const response = await api.profesionales.create(dataProfesional);

                                      // Manejar diferentes estructuras de respuesta del backend
                                      const profesionalCreado = response?.data || response;

                                      if (!profesionalCreado || !profesionalCreado.id) {
                                        throw new Error('El backend no devolvió un profesional válido');
                                      }

                                      nuevoProfesional = {
                                        id: profesionalCreado.id,
                                        nombre: profesionalCreado.nombre || profesionalAdhocForm.nombre,
                                        tipoProfesional: profesionalCreado.tipoProfesional || profesionalAdhocForm.tipoProfesional,
                                        honorario_dia: profesionalCreado.honorarioDia || profesionalCreado.honorario_dia || profesionalAdhocForm.honorarioDia || 0,
                                        telefono: profesionalCreado.telefono || profesionalAdhocForm.telefono,
                                        email: profesionalCreado.email || profesionalAdhocForm.email,
                                        activo: profesionalCreado.activo !== undefined ? profesionalCreado.activo : true,
                                        categoria: profesionalCreado.categoria || 'INDEPENDIENTE',
                                        _esGuardado: true
                                      };

                                      // Actualizar lista de profesionales disponibles
                                      setProfesionalesDisponiblesTA(prev => [...prev, nuevoProfesional]);
                                      showNotification('✅ Profesional guardado en catálogo permanente', 'success');
                                    } else {
                                      // Crear profesional temporal
                                      nuevoProfesional = {
                                        id: `adhoc_${Date.now()}`,
                                        nombre: profesionalAdhocForm.nombre,
                                        tipoProfesional: profesionalAdhocForm.tipoProfesional,
                                        honorario_dia: profesionalAdhocForm.honorarioDia || '0',
                                        telefono: profesionalAdhocForm.telefono,
                                        email: profesionalAdhocForm.email,
                                        _esAdhoc: true
                                      };
                                      showNotification('Profesional temporal agregado', 'success');
                                    }

                                    setProfesionalesAdhoc(prev => [...prev, nuevoProfesional]);
                                    setProfesionalAdhocForm({
                                      nombre: '',
                                      tipoProfesional: '',
                                      honorarioDia: '',
                                      telefono: '',
                                      email: ''
                                    });
                                    setGuardarEnCatalogoTA(false);

                                  } catch (error) {
                                    console.error('Error al agregar profesional:', error);
                                    showNotification(
                                      `❌ Error: ${error.response?.data?.message || error.message || 'No se pudo guardar el profesional'}`,
                                      'error'
                                    );
                                  } finally {
                                    setGuardandoProfesionalTA(false);
                                  }
                                }}
                                style={{
                                  borderRadius: '8px',
                                  fontWeight: '600'
                                }}
                              >
                                {guardandoProfesionalTA ? (
                                  <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                    Guardando...
                                  </>
                                ) : (
                                  <>
                                    <i className="fas fa-plus-circle me-2"></i>
                                    {guardarEnCatalogoTA ? 'Guardar en Catálogo' : 'Agregar a Lista Temporal'}
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Resumen de profesionales seleccionados */}
                      {(profesionalesSeleccionados.length > 0 || profesionalesAdhoc.length > 0) && (
                        <div className="mt-4">
                          <hr />
                          <h6 className="fw-bold mb-3" style={{ color: '#374151' }}>
                            <i className="fas fa-check-circle me-2 text-success"></i>
                            Profesionales que se asignarán ({profesionalesSeleccionados.length + profesionalesAdhoc.length})
                          </h6>

                          <div className="row g-2">
                            {profesionalesSeleccionados.map((prof) => (
                              <div key={prof.id} className="col-md-6">
                                <div className="card border-0" style={{
                                  backgroundColor: '#fce7f3',
                                  borderRadius: '8px'
                                }}>
                                  <div className="card-body p-2 d-flex justify-content-between align-items-center">
                                    <div>
                                      <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>
                                        {prof.nombre}
                                      </div>
                                      <small className="text-muted">
                                        <i className="fas fa-hard-hat me-1"></i>
                                        {prof.tipoProfesional}
                                      </small>
                                    </div>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-danger"
                                      onClick={() => setProfesionalesSeleccionados(prev => prev.filter(p => p.id !== prof.id))}
                                      style={{ borderRadius: '6px' }}
                                    >
                                      <i className="fas fa-times"></i>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {profesionalesAdhoc.map((prof) => (
                              <div key={prof.id} className="col-md-6">
                                <div className="card border-0" style={{
                                  backgroundColor: prof._esGuardado ? '#d1fae5' : '#fef3c7',
                                  borderRadius: '8px',
                                  border: prof._esGuardado ? '2px solid #10b981' : '2px dashed #f59e0b'
                                }}>
                                  <div className="card-body p-2 d-flex justify-content-between align-items-center">
                                    <div>
                                      <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>
                                        {prof.nombre}
                                        {prof._esGuardado ? (
                                          <span className="badge bg-success ms-2" style={{ fontSize: '0.65rem' }}>
                                            <i className="fas fa-check-circle me-1"></i>
                                            CATÁLOGO
                                          </span>
                                        ) : (
                                          <span className="badge bg-warning text-dark ms-2" style={{ fontSize: '0.65rem' }}>
                                            <i className="fas fa-clock me-1"></i>
                                            TEMPORAL
                                          </span>
                                        )}
                                      </div>
                                      <small className="text-muted">
                                        <i className="fas fa-hard-hat me-1"></i>
                                        {prof.tipoProfesional}
                                      </small>
                                    </div>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-danger"
                                      onClick={() => setProfesionalesAdhoc(prev => prev.filter(p => p.id !== prof.id))}
                                      style={{ borderRadius: '6px' }}
                                    >
                                      <i className="fas fa-times"></i>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sección 3: Detalles y Observaciones */}
                  <div className="card mb-0" style={{ border: 'none', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                    <div className="card-header" style={{
                      background: 'linear-gradient(90deg, #14b8a6 0%, #0d9488 100%)',
                      color: 'white',
                      borderRadius: '12px 12px 0 0',
                      padding: '1rem 1.5rem'
                    }}>
                      <h6 className="mb-0" style={{ fontWeight: '600' }}>
                        <i className="fas fa-file-alt me-2"></i>
                        Detalles y Observaciones
                      </h6>
                    </div>
                    <div className="card-body p-4">
                      {/* Descripción */}
                      <div className="mb-4">
                        <label className="form-label" style={{ fontWeight: '600', color: '#374151', fontSize: '0.95rem' }}>
                          <i className="fas fa-align-left me-2 text-primary"></i>
                          Descripción
                        </label>
                        <textarea
                          name="descripcion"
                          className="form-control"
                          rows="4"
                          placeholder="Describa los detalles del trabajo adicional..."
                          defaultValue={trabajoAdicionalEditar?.descripcion || ''}
                          style={{
                            borderRadius: '10px',
                            border: '2px solid #e5e7eb',
                            padding: '1rem',
                            fontSize: '0.95rem',
                            resize: 'none'
                          }}
                        ></textarea>
                      </div>

                      {/* Observaciones */}
                      <div className="mb-0">
                        <label className="form-label" style={{ fontWeight: '600', color: '#374151', fontSize: '0.95rem' }}>
                          <i className="fas fa-comment-dots me-2 text-warning"></i>
                          Observaciones
                        </label>
                        <textarea
                          name="observaciones"
                          className="form-control"
                          rows="3"
                          placeholder="Notas adicionales, restricciones, etc..."
                          defaultValue={trabajoAdicionalEditar?.observaciones || ''}
                          style={{
                            borderRadius: '10px',
                            border: '2px solid #e5e7eb',
                            padding: '1rem',
                            fontSize: '0.95rem',
                            resize: 'none'
                          }}
                        ></textarea>
                      </div>
                    </div>
                  </div>
                </form>
              </div>

              {/* Footer */}
              <div className="modal-footer" style={{
                padding: '1.5rem 2rem',
                backgroundColor: '#f8f9fa',
                borderTop: '2px solid #e5e7eb'
              }}>
                <button
                  type="button"
                  className="btn btn-light btn-lg"
                  onClick={() => {
                    setMostrarModalTrabajoAdicional(false);
                    setTrabajoAdicionalEditar(null);
                  }}
                  style={{
                    borderRadius: '10px',
                    padding: '0.75rem 2rem',
                    fontWeight: '600',
                    border: '2px solid #d1d5db'
                  }}
                >
                  <i className="fas fa-times me-2"></i>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-lg text-white"
                  onClick={async () => {
                    // Validar campos requeridos
                    const form = document.querySelector('#formTrabajoAdicional');
                    if (!form.checkValidity()) {
                      form.reportValidity();
                      return;
                    }

                    // Recopilar datos del formulario
                    const formData = new FormData(form);
                    const todosLosProfesionales = [
                      ...profesionalesSeleccionados.map(p => ({
                        profesionalId: p.id,
                        nombre: p.nombre,
                        tipoProfesional: p.tipoProfesional,
                        honorarioDia: p.honorario_dia,
                        telefono: p.telefono,
                        email: p.email,
                        esRegistrado: true
                      })),
                      ...profesionalesAdhoc.map(p => ({
                        profesionalId: null,
                        nombre: p.nombre,
                        tipoProfesional: p.tipoProfesional,
                        honorarioDia: p.honorario_dia,
                        telefono: p.telefono,
                        email: p.email,
                        esRegistrado: false
                      }))
                    ];

                    console.log('🟡 Preparando datos antes de enviar:', {
                      obraParaTrabajosAdicionales,
                      esTrabajoExtra: obraParaTrabajosAdicionales._esTrabajoExtra,
                      trabajoExtraId: obraParaTrabajosAdicionales._trabajoExtraId,
                      obraId: obraParaTrabajosAdicionales.id
                    });

                    const datosTrabajoAdicional = {
                      nombre: formData.get('nombre'),
                      importe: parseFloat(formData.get('importe')),
                      diasNecesarios: parseInt(formData.get('diasNecesarios')),
                      fechaInicio: formData.get('fechaInicio'),
                      descripcion: formData.get('descripcion') || null,
                      observaciones: formData.get('observaciones') || null,
                      // Desglose de importe - importes base
                      importeJornales: usarDesglose ? (parseFloat(importeJornales) || null) : null,
                      importeMateriales: usarDesglose ? (parseFloat(importeMateriales) || null) : null,
                      importeGastosGenerales: usarDesglose ? (parseFloat(importeGastosGenerales) || null) : null,
                      importeMayoresCostos: usarDesglose ? (parseFloat(importeMayoresCostos) || null) : null,
                      // Honorarios individuales para cada categoría
                      honorarioJornales: usarDesglose ? (parseFloat(honorarioJornales) || null) : null,
                      tipoHonorarioJornales: usarDesglose ? tipoHonorarioJornales : null,
                      honorarioMateriales: usarDesglose ? (parseFloat(honorarioMateriales) || null) : null,
                      tipoHonorarioMateriales: usarDesglose ? tipoHonorarioMateriales : null,
                      honorarioGastosGenerales: usarDesglose ? (parseFloat(honorarioGastosGenerales) || null) : null,
                      tipoHonorarioGastosGenerales: usarDesglose ? tipoHonorarioGastosGenerales : null,
                      honorarioMayoresCostos: usarDesglose ? (parseFloat(honorarioMayoresCostos) || null) : null,
                      tipoHonorarioMayoresCostos: usarDesglose ? tipoHonorarioMayoresCostos : null,
                      // Descuentos individuales para cada categoría
                      descuentoJornales: usarDesglose ? (parseFloat(descuentoJornales) || null) : null,
                      tipoDescuentoJornales: usarDesglose ? tipoDescuentoJornales : null,
                      descuentoMateriales: usarDesglose ? (parseFloat(descuentoMateriales) || null) : null,
                      tipoDescuentoMateriales: usarDesglose ? tipoDescuentoMateriales : null,
                      descuentoGastosGenerales: usarDesglose ? (parseFloat(descuentoGastosGenerales) || null) : null,
                      tipoDescuentoGastosGenerales: usarDesglose ? tipoDescuentoGastosGenerales : null,
                      descuentoMayoresCostos: usarDesglose ? (parseFloat(descuentoMayoresCostos) || null) : null,
                      tipoDescuentoMayoresCostos: usarDesglose ? tipoDescuentoMayoresCostos : null,
                      // Descuentos específicos para honorarios
                      descuentoHonorarioJornales: usarDesglose ? (parseFloat(descuentoHonorarioJornales) || null) : null,
                      tipoDescuentoHonorarioJornales: usarDesglose ? tipoDescuentoHonorarioJornales : null,
                      descuentoHonorarioMateriales: usarDesglose ? (parseFloat(descuentoHonorarioMateriales) || null) : null,
                      tipoDescuentoHonorarioMateriales: usarDesglose ? tipoDescuentoHonorarioMateriales : null,
                      descuentoHonorarioGastosGenerales: usarDesglose ? (parseFloat(descuentoHonorarioGastosGenerales) || null) : null,
                      tipoDescuentoHonorarioGastosGenerales: usarDesglose ? tipoDescuentoHonorarioGastosGenerales : null,
                      descuentoHonorarioMayoresCostos: usarDesglose ? (parseFloat(descuentoHonorarioMayoresCostos) || null) : null,
                      tipoDescuentoHonorarioMayoresCostos: usarDesglose ? tipoDescuentoHonorarioMayoresCostos : null,
                      profesionales: todosLosProfesionales,
                      // Vinculación: SIEMPRE envía el ID de la obra padre
                      obraId: obraParaTrabajosAdicionales.id, // ID de la obra padre (siempre presente)
                      trabajoExtraId: obraParaTrabajosAdicionales._esTrabajoExtra ? obraParaTrabajosAdicionales._trabajoExtraId : null,
                      empresaId: parseInt(empresaId)
                    };

                    console.log('📋 Datos del trabajo adicional:', datosTrabajoAdicional);

                    try {
                      let resultado;

                      if (trabajoAdicionalEditar) {
                        // Actualizar trabajo adicional existente
                        showNotification('Actualizando trabajo adicional...', 'info');
                        resultado = await trabajosAdicionalesService.actualizarTrabajoAdicional(
                          trabajoAdicionalEditar.id,
                          datosTrabajoAdicional
                        );
                        showNotification('✅ Trabajo adicional actualizado correctamente', 'success');
                      } else {
                        // Crear nuevo trabajo adicional
                        showNotification('Guardando trabajo adicional...', 'info');
                        resultado = await trabajosAdicionalesService.crearTrabajoAdicional(datosTrabajoAdicional);
                        showNotification('✅ Trabajo adicional creado correctamente', 'success');
                      }

                      console.log('✅ Respuesta del servidor:', resultado);

                      // Actualizar lista de trabajos adicionales
                      const todosLosTrabajosAdicionales = await trabajosAdicionalesService.listarTrabajosAdicionales(empresaId);
                      const trabajosArray = Array.isArray(todosLosTrabajosAdicionales) ? todosLosTrabajosAdicionales : [];
                      setTrabajosAdicionales(trabajosArray);
                      // Cerrar modal y limpiar
                      setMostrarModalTrabajoAdicional(false);
                      setTrabajoAdicionalEditar(null);

                    } catch (error) {
                      console.error('❌ Error al guardar trabajo adicional:', error);

                      // Manejo de errores específicos
                      if (error.response) {
                        const status = error.response.status;
                        const mensaje = error.response.data?.message || error.response.data?.error || 'Error desconocido';

                        if (status === 400) {
                          showNotification(`Error de validación: ${mensaje}`, 'error');
                        } else if (status === 404) {
                          showNotification(`No encontrado: ${mensaje}`, 'error');
                        } else if (status === 409) {
                          showNotification(`Conflicto: ${mensaje}`, 'error');
                        } else {
                          showNotification(`Error ${status}: ${mensaje}`, 'error');
                        }
                      } else {
                        showNotification('Error al guardar trabajo adicional. Revise la consola.', 'error');
                      }
                    }
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '0.75rem 2.5rem',
                    fontWeight: '600',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
                  }}
                >
                  <i className="fas fa-save me-2"></i>
                  {trabajoAdicionalEditar ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .hover-row:hover {
          background-color: #f5f5f5 !important;
        }

        /* Botones extra pequeños para acciones de trabajos adicionales */
        .btn-xs {
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
          line-height: 1.2;
          border-radius: 0.2rem;
        }

        /* Animación suave para cards de trabajos adicionales */
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
