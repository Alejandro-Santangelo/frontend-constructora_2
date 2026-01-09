import React, { useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
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
import eventBus, { FINANCIAL_EVENTS } from '../utils/eventBus';
import { calcularSemanasParaDiasHabiles, convertirDiasHabilesASemanasSimple, esDiaHabil } from '../utils/feriadosArgentina';
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

  // Estado local para controlar obra seleccionada desde tabla
  const [selectedObraId, setSelectedObraId] = React.useState(null);

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
  const [configuracionObra, setConfiguracionObra] = React.useState({
    semanasObjetivo: '',
    diasHabiles: 0,
    capacidadNecesaria: 0,
    jornalesTotales: 0,
    fechaInicio: null,
    fechaFinEstimada: null,
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

  // Estados para Ver Asignaciones
  const [mostrarModalVerAsignaciones, setMostrarModalVerAsignaciones] = React.useState(false);
  const [obraParaVerAsignaciones, setObraParaVerAsignaciones] = React.useState(null);
  const [trabajoExtraEditar, setTrabajoExtraEditar] = React.useState(null);
  const [trabajoExtraSeleccionado, setTrabajoExtraSeleccionado] = React.useState(null);
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

  // Estado para modal de envío de obra manual
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

  // Flag para controlar carga inicial
  const inicializadoRef = React.useRef(false);

  // Cargar datos iniciales
  useEffect(() => {
    const initializeObrasPage = async () => {
      // Evitar múltiples ejecuciones
      if (inicializadoRef.current) return;
      inicializadoRef.current = true;

      try {
        await dispatch(fetchEstadosDisponibles()).unwrap();

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
        // Obtener todos los presupuestos de la empresa
        const todosPresupuestos = await api.presupuestosNoCliente.getAll(empresaId);

        // Crear objeto con presupuestos indexados por obraId
        const presupuestosPorObra = {};
        todosPresupuestos.forEach(presupuesto => {
          const obraId = presupuesto.obraId || presupuesto.idObra;
          if (obraId) {
            presupuestosPorObra[obraId] = presupuesto;
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
        esObraManual: !tienePresupuesto, // Nuevo: indica si es obra manual (sin presupuesto)
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
                // Campos de cliente (mantener vacíos si estamos editando)
                nombreSolicitante: '',
                telefono: '',
                direccionParticular: '',
                mail: '',
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
              // Verificar que sea obra manual (sin presupuesto)
              const tienePresupuesto = (presupuestosObras[obra.id] && typeof presupuestosObras[obra.id] === 'object') ||
                                      (obra.presupuestoNoCliente && typeof obra.presupuestoNoCliente === 'object');

              if (tienePresupuesto) {
                showNotification('⚠️ Solo se pueden enviar obras manuales (sin presupuesto asociado)', 'warning');
                return;
              }

              setObraParaEnviar(obra);
              setMostrarModalEnviarObra(true);
            }
          } else {
            showNotification('Seleccione una obra manual para enviar', 'warning');
          }
        }
      });
    }

    return () => {
      if (setObrasControls) {
        setObrasControls(null);
      }
    };
  }, [selectedObraId, setObrasControls, obras, presupuestosObras]);

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
              api.trabajosExtra.update(trabajoExtraSeleccionado.id, {
                ...trabajoExtraSeleccionado,
                estado: 'A_ENVIAR'
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
              api.trabajosExtra.update(trabajoExtraSeleccionado.id, {
                ...trabajoExtraSeleccionado,
                estado: 'APROBADO'
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

    presupuestoAsignadoRef.current.add(presupuestoKey);
    setObraParaEtapasDiarias(prev => ({
      ...prev,
      presupuestoNoCliente: presupuestoActualizado
    }));
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
        profesionalesAsignadosForm: profesionalesAsignadosForm.map(prof => ({
          id: prof.esManual ? prof.id : prof.id.toString(), // String siempre
          nombre: prof.nombre,
          tipoProfesional: prof.tipoProfesional,
          valorHora: parseFloat(prof.valorHora || 0),
          esManual: prof.esManual || false
        }))
      };

      console.log('📝¤ Enviando obra al backend:', obraData);

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
            if (obraParaEtapasDiarias && obraParaEtapasDiarias.id === id) {
              const obraActualizada = { ...obraParaEtapasDiarias, presupuestoNoCliente: presupuestoActualizado };
              setObraParaEtapasDiarias(obraActualizada);
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
  const cargarTrabajosExtra = async (obra) => {
    console.log('📥 cargarTrabajosExtra llamado con obra:', obra?.id, obra?.nombre);

    if (!obra) {
      console.warn('⚠️ No hay obra para cargar trabajos extra');
      return;
    }

    try {
      setLoadingTrabajosExtra(true);
      console.log('🔍 Llamando a API con empresaId:', empresaSeleccionada.id, 'obraId:', obra.id);
      const data = await api.trabajosExtra.getAll(empresaSeleccionada.id, { obraId: obra.id });
      console.log('📦 Trabajos extra recibidos:', data?.length || 0, data);
      setTrabajosExtra(Array.isArray(data) ? data : []);
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
      await api.trabajosExtra.delete(trabajoId, empresaSeleccionada.id);
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
      console.log('💾 Guardando trabajo extra (presupuesto completo recibido):', datosPresupuesto);
      console.log('📝 Trabajo extra en edición:', trabajoExtraEditar);

      // NO TRANSFORMAR - Enviar el presupuesto completo tal cual
      // Solo agregar campos obligatorios si faltan
      const trabajoExtraData = {
        ...datosPresupuesto,
        // Asegurar que tenga los campos mínimos requeridos
        nombre: datosPresupuesto.nombreObra || datosPresupuesto.nombreObraManual || 'Trabajo Extra',
        // Marcar como trabajo extra si el backend necesita diferenciarlo
        esTrabajExtra: true
      };

      console.log('📦 Datos completos para trabajo extra:', trabajoExtraData);
      console.log('� Items calculadora a enviar:', trabajoExtraData.itemsCalculadora?.length || 0, trabajoExtraData.itemsCalculadora);
      console.log('📅 Fechas incluidas:', {
        fechaProbableInicio: trabajoExtraData.fechaProbableInicio,
        tiempoEstimadoTerminacion: trabajoExtraData.tiempoEstimadoTerminacion,
        fechaCreacion: trabajoExtraData.fechaCreacion,
        vencimiento: trabajoExtraData.vencimiento
      });

      let response;

      // Detectar si es edición o creación
      if (trabajoExtraEditar && trabajoExtraEditar.id) {
        // EDITAR trabajo extra existente
        console.log('✏️ Editando trabajo extra ID:', trabajoExtraEditar.id);
        console.log('🔑 Empresa seleccionada ID:', empresaSeleccionada.id);
        console.log('📤 Enviando PUT a /api/v1/trabajos-extra/' + trabajoExtraEditar.id);

        // 🔍 LOG DETALLADO DE DATOS QUE SE ENVÍAN
        console.log('📦 DATOS COMPLETOS A ENVIAR:', JSON.stringify(trabajoExtraData, null, 2));
        console.log('📋 ItemsCalculadora estructurados:', trabajoExtraData.itemsCalculadora?.map(item => ({
          tipoProfesional: item.tipoProfesional,
          jornalesCount: item.jornales?.length || 0,
          materialesCount: item.materialesLista?.length || 0,
          gastosGeneralesCount: item.gastosGenerales?.length || 0,
          profesionalesCount: item.profesionales?.length || 0
        })));

        response = await api.trabajosExtra.update(
          trabajoExtraEditar.id,
          trabajoExtraData,
          empresaSeleccionada.id
        );
        console.log('✅ Trabajo extra actualizado:', response);
        console.log('📅 Fechas en respuesta:', {
          fechaProbableInicio: response?.fechaProbableInicio,
          tiempoEstimadoTerminacion: response?.tiempoEstimadoTerminacion
        });
        showNotification('Trabajo extra actualizado exitosamente', 'success');
      } else {
        // CREAR nuevo trabajo extra
        console.log('➕ Creando nuevo trabajo extra');
        response = await api.trabajosExtra.create(trabajoExtraData, empresaSeleccionada.id);
        console.log('✅ Trabajo extra creado:', response);
        showNotification('Trabajo extra creado exitosamente', 'success');
      }

      // Recargar los trabajos extra
      console.log('🔄 Recargando trabajos extra para obra:', obraParaTrabajosExtra?.id, obraParaTrabajosExtra?.nombre);
      console.log('🔑 empresaSeleccionada:', empresaSeleccionada?.id);
      console.log('📍 Llamando a cargarTrabajosExtra...');
      await cargarTrabajosExtra(obraParaTrabajosExtra);
      console.log('✅ Trabajos extra recargados correctamente');
      console.log('📊 Total de trabajos extra después de recargar:', trabajosExtra.length);

      // Cerrar el modal
      setMostrarModalTrabajoExtra(false);
      setTrabajoExtraEditar(null);

      return response; // Retornar la respuesta para el modal
    } catch (error) {
      console.error('❌ Error al guardar trabajo extra:', error);
      console.error('❌ Detalles del error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      showNotification('Error al guardar el trabajo extra: ' + (error.message || 'Error desconocido'), 'error');
      throw error; // Re-lanzar para que el modal lo maneje
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
    const configGuardada = localStorage.getItem(`configuracionObra_${obraId}`);
    if (!configGuardada) return null;

    try {
      const config = JSON.parse(configGuardada);
      return config;
    } catch (error) {
      console.error('Error parsing configuración:', error);
      localStorage.removeItem(`configuracionObra_${obraId}`);
      return null;
    }
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

    //  €¢ USAR itemsCalculadora en lugar de detalles
    const items = obra?.presupuestoNoCliente?.itemsCalculadora || obra?.presupuestoNoCliente?.detalles;

    if (!items || !Array.isArray(items) || items.length === 0) {
      console.warn(' No hay items en el presupuesto');
      console.warn(' Verificar estructura del presupuesto en el backend');
      return [];
    }

    console.log(' DEBUG - Buscando jornales en presupuesto');
    console.log('📋 Items del presupuesto:', items);
    console.log('📋 Cantidad de items:', items.length);

    // Mostrar todos los items para ver qué nombres tienen
    items.forEach((item, index) => {
      console.log(`  ${index + 1}. Tipo: "${item.tipoProfesional}" | cantidadJornales: ${item.cantidadJornales} | descripción: "${item.descripcion}"`);
    });

    //  €¢ Sumar TODOS los jornales de todos los items (para referencia, pero NO se usa para calendario)
    const jornalesPresupuesto = items.reduce((sum, item) => sum + (parseInt(item.cantidadJornales) || 0), 0);

    console.log('  Jornales del presupuesto:', jornalesPresupuesto);

    // Verificar si existe configuración de la obra
    const configuracion = obtenerConfiguracionObra(obra.id);
    // console.log('🔧 Configuración de la obra:', configuracion);
    // console.log('🔧 configuracion.fechaInicio:', configuracion?.fechaInicio);
    // console.log('🔧 configuracion.diasHabiles:', configuracion?.diasHabiles);

    // PRIORIZAR configuración de la obra sobre tiempoEstimadoTerminacion del presupuesto
    let totalJornales;

    if (configuracion && configuracion.diasHabiles > 0) {
      totalJornales = parseInt(configuracion.diasHabiles);
    } else {
      totalJornales = parseInt(obra.presupuestoNoCliente.tiempoEstimadoTerminacion) || jornalesPresupuesto || 0;
    }

    if (totalJornales === 0) {
      console.warn(' El total de días hábiles es 0');
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

    const presupuestoActualizado = presupuestosObras[obraParaEtapasDiarias.id] || obraParaEtapasDiarias.presupuestoNoCliente;
    const obraConPresupuestoActualizado = {
      ...obraParaEtapasDiarias,
      presupuestoNoCliente: presupuestoActualizado
    };

    // console.log(' Regenerando calendario - Obra:', obraParaEtapasDiarias.id);
    // console.log(' Tiene presupuesto?', !!presupuestoActualizado);
    // console.log('fechaProbableInicio reactiva:', presupuestoActualizado?.fechaProbableInicio);

    if (presupuestoActualizado) {
      console.log('📋 Presupuesto con fecha:', {
        fechaProbableInicio: presupuestoActualizado.fechaProbableInicio,
        tiempoEstimado: presupuestoActualizado.tiempoEstimadoTerminacion
      });
    }

    const semanasGeneradas = generarCalendarioAutomatico(obraConPresupuestoActualizado);

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
    presupuestosObras[obraParaEtapasDiarias?.id]?.fechaProbableInicio, // 🔥 REACTIVO
    presupuestosObras[obraParaEtapasDiarias?.id]?.tiempoEstimadoTerminacion, // 🔥 REACTIVO
    etapasDiarias,
    calendarioVersion // Contador que se incrementa cuando se actualiza el presupuesto o la configuración
  ]); // Regenerar cuando cambie la obra, las fechas del presupuesto (REACTIVO desde presupuestosObras), las etapas guardadas, o la configuración

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

      // Primero verificar si hay presupuesto en el cache
      if (presupuestosObras[obra.id]) {
        obraCompleta.presupuestoNoCliente = presupuestosObras[obra.id];
      } else {
        // Si no está en cache, cargar del backend
        try {
          const response = await fetch(`/api/presupuestos-no-cliente/por-obra/${obra.id}`, {
            headers: {
              'empresaId': empresaId.toString(),
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            let presupuestos = await response.json();

            // Convertir a array si no lo es
            if (!Array.isArray(presupuestos)) {
              presupuestos = [presupuestos];
            }

            console.log('📋 Presupuestos encontrados:', presupuestos);

            // Buscar el presupuesto APROBADO más reciente
            const presupuestoAprobado = presupuestos
              .filter(p => p.estado === 'APROBADO')
              .sort((a, b) => b.version - a.version)[0];

            if (presupuestoAprobado) {
              console.log(' Presupuesto APROBADO encontrado:', presupuestoAprobado);
              obraCompleta.presupuestoNoCliente = presupuestoAprobado;
              // Actualizar el cache
              setPresupuestosObras(prev => ({...prev, [obra.id]: presupuestoAprobado}));
            } else {
              console.warn(' ⚠️ No se encontró presupuesto APROBADO, usando el más reciente');
              // Si no hay aprobado, usar el más reciente
              const masReciente = presupuestos.sort((a, b) => b.version - a.version)[0];
              if (masReciente) {
                obraCompleta.presupuestoNoCliente = masReciente;
                setPresupuestosObras(prev => ({...prev, [obra.id]: masReciente}));
              }
            }
          } else {
            console.warn(' ⚠️ No se pudo cargar presupuesto (HTTP', response.status, ')');
          }
        } catch (errorPresupuesto) {
          console.warn(' ⚠️ Error cargando presupuesto de la obra:', errorPresupuesto);
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

          if (presupuestoAprobado) {
            obraCompleta.presupuestoNoCliente = presupuestoAprobado;
          } else {
            const masReciente = presupuestos.sort((a, b) => b.version - a.version)[0];
            if (masReciente) obraCompleta.presupuestoNoCliente = masReciente;
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
        api.trabajosExtra.getAll(empresaId, { obraId }).then(data => {
          const trabajosArray = Array.isArray(data) ? data : [];
          const count = trabajosArray.length;
          console.log('  📊 Trabajos Extra:', count);

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

        // Materiales - Obtener los materiales asignados desde el backend
        axios.get(`/api/obras/${obraId}/materiales`, {
          headers: {
            empresaId: empresaId,
            'X-Tenant-ID': empresaId
          }
        }).then(response => {
          const data = response.data?.data || response.data || [];
          const materiales = Array.isArray(data) ? data : [];
          const count = materiales.length;
          console.log('  📊 Materiales asignados:', count, materiales);

          // Guardar los datos completos de materiales
          setDatosAsignacionesPorObra(prev => ({
            ...prev,
            [obraId]: {
              ...prev[obraId],
              materiales: materiales
            }
          }));

          return count;
        }).catch(error => {
          console.warn('  ⚠️ Error cargando materiales:', error.message);
          return 0;
        }),

        // Gastos/Otros costos asignados
        axios.get(`/api/obras/${obraId}/otros-costos`, {
          headers: {
            empresaId: empresaId,
            'X-Tenant-ID': empresaId
          },
          params: { empresaId }
        }).then(response => {
          const data = response.data || [];
          const gastos = Array.isArray(data) ? data : [];
          const count = gastos.length;
          console.log('  📊 Gastos Generales:', count, gastos);

          // Guardar los datos completos de gastos generales
          setDatosAsignacionesPorObra(prev => ({
            ...prev,
            [obraId]: {
              ...prev[obraId],
              gastosGenerales: gastos
            }
          }));

          return count;
        }).catch(error => {
          console.warn('  ⚠️ Error cargando gastos generales:', error.message);
          return 0;
        }),

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

  const handleConfigurarObra = async (obra) => {
    console.log('🚀🚀🚀 INICIO handleConfigurarObra - Obra:', obra?.id, obra?.direccion);

    if (!obra?.id || !empresaSeleccionada?.id) {
      showNotification('Error: Datos inválidos', 'error');
      return;
    }

    setObraParaConfigurar(obra);
    setMostrarModalConfiguracionObra(true);

    console.log('🚀 Modal abierto, comenzando cálculos...');

    try {
      // Buscar presupuesto vinculado
      const todosPresupuestos = await api.presupuestosNoCliente.getAll(empresaSeleccionada.id);
      console.log('🔍 TODOS LOS PRESUPUESTOS:', todosPresupuestos);

      const presupuestoVinculado = (todosPresupuestos || []).find(p =>
        p.obraId === obra.id || p.idObra === obra.id
      );

      console.log('🔍 PRESUPUESTO VINCULADO ENCONTRADO:', presupuestoVinculado);
      console.log('🔍 Obra ID buscada:', obra.id);

      if (presupuestoVinculado) {
        // 🆕 Calcular semanas automáticamente basándose en tiempoEstimadoTerminacion
        let semanasCalculadas = 0;
        let fechaInicio = null;
        const jornalesTotales = parseInt(presupuestoVinculado.tiempoEstimadoTerminacion) || 30;

        console.log('📋 tiempoEstimadoTerminacion del presupuesto:', presupuestoVinculado.tiempoEstimadoTerminacion);

        if (presupuestoVinculado.tiempoEstimadoTerminacion) {
          console.log('✅ Hay tiempoEstimadoTerminacion, calculando semanas...');

          // Si hay fechaProbableInicio, intentar cálculo preciso con feriados
          if (presupuestoVinculado.fechaProbableInicio) {
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
            // Sin fechaProbableInicio, usar cálculo simple directamente
            console.log('⚠️ No hay fechaProbableInicio, usando cálculo simple');
            semanasCalculadas = convertirDiasHabilesASemanasSimple(
              presupuestoVinculado.tiempoEstimadoTerminacion
            );
            console.log('✅ Semanas calculadas simple:', semanasCalculadas);
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
      } else {
        // Fallback si no hay presupuesto vinculado
        setConfiguracionObra({
          jornalesTotales: 30,
          fechaInicio: new Date(),
          presupuestoSeleccionado: null,
          semanasObjetivo: '',
          diasHabiles: 0,
          capacidadNecesaria: 0,
          fechaFinEstimada: null
        });
      }

    } catch (error) {
      console.error('Error:', error);
      setConfiguracionObra({
        jornalesTotales: 30,
        fechaInicio: new Date(),
        presupuestoSeleccionado: null,
        semanasObjetivo: '',
        diasHabiles: 0,
        capacidadNecesaria: 0,
        fechaFinEstimada: null
      });
    }
  };

  const handleGuardarConfiguracionObra = () => {
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

    // Guardar en localStorage para persistencia
    localStorage.setItem(`configuracionObra_${obraParaConfigurar.id}`, JSON.stringify(nuevaConfiguracion));

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
                    <div className="table-responsive" style={{margin: '0'}}>
                      <table className="table table-striped table-hover" style={{marginBottom: '0'}}>
                        <thead className="table-light" onClick={(e) => { e.stopPropagation(); setSelectedObraId(null); }} style={{ cursor: 'pointer' }} title="Clic para deseleccionar">
                          <tr>
                            <th style={{ width: '25px', padding: '8px 4px' }} className="small"></th>
                            <th style={{ width: '40px' }} className="small">ID</th>
                            <th style={{ width: '140px' }} className="small">Nombre</th>
                            <th className="small">Dirección</th>
                            <th style={{ width: '80px' }} className="small">Contacto</th>
                            <th style={{ width: '80px' }} className="small">Estado</th>
                            <th style={{ width: '100px' }} className="small">Asignaciones</th>
                            <th style={{ width: '80px' }} className="small">Inicio</th>
                            <th style={{ width: '80px' }} className="small">Fin</th>
                            <th style={{ width: '90px' }} className="small">Cliente</th>
                            <th style={{ width: '90px' }} className="small">Tipo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {obras.map(obra => {
                            const obraId = obra.id;
                            const isSelected = selectedObraId && obraId && selectedObraId === obraId;

                            return (
                            <React.Fragment key={obraId}>
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
                                style={{ cursor: 'pointer' }}
                                className={`hover-row ${isSelected ? 'table-primary' : ''}`}
                              >
                                <td
                                  onClick={(e) => toggleObraExpandida(obra.id, e)}
                                  style={{ cursor: 'pointer' }}
                                  className="text-center"
                                >
                                  {(() => {
                                    // Solo mostrar botón de expandir si tiene presupuesto detallado
                                    const tienePresupuesto = (presupuestosObras[obra.id] && typeof presupuestosObras[obra.id] === 'object') ||
                                                            (obra.presupuestoNoCliente && typeof obra.presupuestoNoCliente === 'object');

                                    if (!tienePresupuesto) {
                                      return <span className="text-muted">-</span>;
                                    }

                                    return (
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
                                    );
                                  })()}
                                </td>
                                <td>
                                  {isSelected && <i className="fas fa-check-circle text-success me-1" title="Seleccionado"></i>}
                                  {obraId}
                              </td>
                              <td>{obra.nombre}</td>
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
                                        Sin Presupuesto Detallado
                                      </span>
                                    );
                                  }
                                })()}
                              </td>
                            </tr>

                            {/* Fila expandible con detalles - Solo para obras con presupuesto detallado */}
                            {(() => {
                              const tienePresupuesto = (presupuestosObras[obra.id] && typeof presupuestosObras[obra.id] === 'object') ||
                                                      (obra.presupuestoNoCliente && typeof obra.presupuestoNoCliente === 'object');

                              if (!tienePresupuesto) return null;

                              return obrasExpandidas.has(obra.id) && (
                                <tr>
                                  <td colSpan="10" className="p-0">
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

                                            if (config) {
                                              // 🔥 CALCULAR SEMANAS desde presupuesto usando función centralizada
                                              const diasHabiles = config.diasHabiles || 0;
                                              const presupuesto = presupuestosObras[obra.id] || obra.presupuestoNoCliente;

                                              let semanasReales = config.semanasObjetivo; // Fallback

                                              if (diasHabiles > 0 && presupuesto?.fechaProbableInicio) {
                                                semanasReales = recalcularSemanasDesdePresupuesto(presupuesto);
                                              }

                                              return (
                                                <small className="text-success">
                                                  ✅ Configurado: {semanasReales} semanas ({diasHabiles} días hábiles)
                                                  - {profesionalesAsignados} profesional{profesionalesAsignados !== 1 ? 'es' : ''} asignado{profesionalesAsignados !== 1 ? 's' : ''}
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

                                            // 🔥 Enriquecer obra con presupuesto completo antes de abrir modal
                                            try {
                                              const todosPresupuestos = await api.presupuestosNoCliente.getAll(empresaId);
                                              const presupuestoCompleto = todosPresupuestos.find(p =>
                                                p.obraId === obra.id || p.idObra === obra.id
                                              );

                                              const obraEnriquecida = {
                                                ...obra,
                                                presupuestoNoCliente: presupuestoCompleto || obra.presupuestoNoCliente
                                              };

                                              console.log('🔍 DEBUG - Obra enriquecida:', {
                                                obraId: obraEnriquecida.id,
                                                tienePresupuesto: !!obraEnriquecida.presupuestoNoCliente,
                                                fechaProbableInicio: obraEnriquecida.presupuestoNoCliente?.fechaProbableInicio
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
                                    </div>
                                  </div>
                                </td>
                              </tr>
                              );
                            })()}
                          </React.Fragment>
                          );
                          })}
                        </tbody>
                      </table>
                    </div>
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
                              value={formData.presupuestoEstimado}
                              onChange={(e) => setFormData({...formData, presupuestoEstimado: e.target.value})}
                              style={{borderRadius: '8px', padding: '10px 12px', fontSize: '0.95rem', border: '3px solid #86b7fe', transition: 'all 0.2s'}}
                            />
                          </div>
                        </div>
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
                                            <span className="badge bg-success">œ… Completada</span>
                                          ) : etapa.estado === 'EN_PROCESO' ? (
                                            <span className="badge bg-primary">ðŸ”„ En Proceso</span>
                                          ) : (
                                            <span className="badge bg-secondary">³ Pendiente</span>
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
                    onClick={() => dispatch(setActiveTab('lista'))}
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

      {/* Tab Trabajos Extra - Copia exacta de Presupuestos No Cliente */}
      {activeTab === 'trabajos-extra' && (
        <div className="container-fluid fade-in" style={{padding: '0'}} onClick={() => setTrabajoExtraSeleccionado(null)}>
          <div className="d-flex justify-content-between align-items-center mb-3" style={{padding: '0 15px'}}>
            <div className="d-flex align-items-center gap-3">
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
                <div className="text-center py-4">
                  <p className="text-muted">
                    <i className="fas fa-info-circle me-2"></i>
                    No hay trabajos extra registrados. Usa el botón "Nuevo Trabajo Extra" en el sidebar para crear uno.
                  </p>
                </div>
              ) : (
                <>
                  <div className="table-responsive" style={{margin: '0'}}>
                  <table className="table table-hover" style={{marginBottom: '0'}}>
                    <thead className="table-light">
                      <tr>
                        <th style={{width: '50px'}} className="small">Nro.</th>
                        <th style={{width: '30px'}} className="small">Ver.</th>
                        <th style={{width: '90px'}} className="small">Fecha</th>
                        <th style={{width: '130px'}} className="small">Nombre Trabajo</th>
                        <th className="small">Descripción</th>
                        <th style={{width: '90px'}} className="small">Inicio</th>
                        <th style={{width: '70px'}} className="small">Estado</th>
                        <th style={{width: '110px'}} className="text-end small">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trabajosExtra.map(row => {
                        const esEditable = row.estado === 'BORRADOR' || row.estado === 'A_ENVIAR';
                        const rowId = row.id;
                        const isSelected = trabajoExtraSeleccionado && rowId && trabajoExtraSeleccionado.id === rowId;

                        return (
                        <tr
                          key={rowId}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Toggle: si ya está seleccionado, deseleccionar; si no, seleccionar
                            if (isSelected) {
                              setTrabajoExtraSeleccionado(null);
                            } else {
                              setTrabajoExtraSeleccionado(row);
                            }
                          }}
                          style={{
                            cursor: 'pointer',
                            ...(isSelected && { backgroundColor: '#cfe2ff !important' })
                          }}
                          className={`${
                            isSelected
                              ? 'table-primary'
                              : !esEditable
                                ? 'table-secondary opacity-75'
                                : ''
                          }`}
                          title={esEditable
                            ? `Clic para seleccionar trabajo extra ${row.numeroPresupuesto || rowId} - Editable`
                            : `Trabajo extra ${row.numeroPresupuesto || rowId} - Solo lectura (${row.estado})`
                          }
                        >
                          <td className="small">
                            {isSelected && <i className="fas fa-check-circle text-success me-1" title="Seleccionado"></i>}
                            {row.numeroPresupuesto || row.id || '-'}
                          </td>
                          <td className="small text-center">{row.numeroVersion || '1'}</td>
                          <td className="small">{row.fechaEmision || (row.fechaCreacion ? new Date(row.fechaCreacion).toLocaleDateString('es-AR') : '-')}</td>
                          <td className="small fw-bold text-dark">{row.nombreObra || row.nombre || <span className="text-muted fst-italic fw-normal">Sin especificar</span>}</td>
                          <td className="small" style={{maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                            {row.descripcion || row.observaciones || <span className="text-muted fst-italic">Sin descripción</span>}
                          </td>
                          <td className="small text-center">{row.fechaProbableInicio || <span className="text-muted">—</span>}</td>
                          <td>
                            <span className={`badge ${
                              row.estado === 'BORRADOR' ? 'bg-secondary' :
                              row.estado === 'A_ENVIAR' ? 'bg-info' :
                              row.estado === 'ENVIADO' ? 'bg-primary' :
                              row.estado === 'APROBADO' ? 'bg-success' :
                              row.estado === 'MODIFICADO' ? 'bg-warning' :
                              'bg-light text-dark'
                            }`} style={{fontSize: '0.7em', padding: '3px 5px'}}>
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
                                    // El modal no parece tener `mayorCostoJornales` explícito en `calcularMayoresCostos` return,
                                    // pero podría estar bajo 'profesionales' o 'configuracionPresupuesto' dependiendo de la implementación.
                                    // Asumiremos que sigue la estructura estándar si existe la config.
                                    const mcJornales = calcularExtra(totalJornales, getConfigMayoresCostos('jornales'));
                                    const mcCalc = calcularExtra(totalCalculadora, getConfigMayoresCostos('configuracionPresupuesto'));

                                    // 4. Calcular Mayores Costos sobre Honorarios
                                    // IMPORTANTE: El modal calcula esto sobre el TOTAL de honorarios
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
                    onClick={() => dispatch(setActiveTab('lista'))}
                    title="Volver a la lista de obras"
                  >
                    <i className="fas fa-arrow-left me-1"></i>Volver a Obras
                  </button>
                  <div>
                    <h5 className="mb-0">
                      <i className="fas fa-calendar-check me-2"></i>
                      Cronograma de Obra - {obraParaEtapasDiarias?.nombre}
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

                  {/* Botón de consolidación */}
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => {
                      // Solo cierra/vuelve atrás para dar sensación de guardado
                      dispatch(setActiveTab('lista'));
                      setObraParaEtapasDiarias(null);
                    }}
                  >
                    <i className="fas fa-check-circle me-2"></i>
                    Guardar y Cerrar
                  </button>
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
                    // 🔥 Obtener presupuesto actualizado desde presupuestosObras (reactivo)
                    const presupuestoActualizado = presupuestosObras[obraParaEtapasDiarias?.id] || obraParaEtapasDiarias?.presupuestoNoCliente;

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
                            {(() => {
                              // ✅ USAR CONFIGURACIÓN DE LA OBRA si existe
                              const configuracion = obtenerConfiguracionObra(obraParaEtapasDiarias.id);
                              if (configuracion?.diasHabiles) {
                                return configuracion.diasHabiles;
                              }

                              // Fallback: usar tiempoEstimadoTerminacion del backend
                              const tiempoEstimado = presupuestoActualizado?.tiempoEstimadoTerminacion;
                              if (tiempoEstimado) return tiempoEstimado;

                              // Último fallback: sumar jornales
                              const items = presupuestoActualizado?.itemsCalculadora ||
                                           presupuestoActualizado?.detalles || [];
                              return items.reduce((sum, item) => sum + (parseInt(item.cantidadJornales) || 0), 0);
                            })()}
                          </h5>
                          <small>Días Hábiles</small>
                        </div>
                        <div className="col-3">
                          <h5>
                            {calendarioCompleto.length}
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
          configuracionObra={obtenerConfiguracionObra(obraParaAsignarProfesionales.id)}
          onRefreshProfesionales={refrescarProfesionalesDisponibles}
          onAsignar={async (asignacionData) => {
            // Backend integrado - recargar obras después de asignación exitosa
            console.log('Asignación semanal guardada:', asignacionData);

            // Recargar contadores de esta obra específica
            if (obraParaAsignarProfesionales?.id) {
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
          onClose={() => {
            setMostrarModalAsignarMateriales(false);
            setObraParaAsignarMateriales(null);
          }}
          obra={obraParaAsignarMateriales}
          configuracionObra={obtenerConfiguracionObra(obraParaAsignarMateriales?.id)}
          onAsignacionExitosa={() => {
            showNotification('✓ Materiales asignados correctamente', 'success');
            // Recargar contadores de esta obra específica
            if (obraParaAsignarMateriales?.id) {
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
          onClose={() => {
            setMostrarModalAsignarGastos(false);
            setObraParaAsignarGastos(null);
          }}
          obra={obraParaAsignarGastos}
          configuracionObra={obtenerConfiguracionObra(obraParaAsignarGastos?.id)}
          onAsignacionExitosa={() => {
            showNotification('✓ Gastos generales asignados correctamente', 'success');
            // Recargar contadores de esta obra específica
            if (obraParaAsignarGastos?.id) {
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
              if (obraParaEtapasDiarias && obraParaEtapasDiarias.id === presupuesto.obraId) {
                console.log(' Etapas diarias abiertas, actualizando presupuesto en el estado...');
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
            setAutoGenerarPDFTrabajoExtra(false);
            setAbrirWhatsAppTrabajoExtra(false);
            setAbrirEmailTrabajoExtra(false);
            setMostrarModalTrabajoExtra(false);
            setTrabajoExtraEditar(null);
            cargarTrabajosExtra(obraParaTrabajosExtra);
          }}
          initialData={{
            // ✅ Pasar TODOS los datos del trabajo extra (para incluir campos planos como los de honorarios)
            ...(trabajoExtraEditar || {}),

            // Usar id_trabajo_extra del backend (si está editando) o null si es nuevo
            id: trabajoExtraEditar?.id_trabajo_extra || trabajoExtraEditar?.id || null,

            // IDs y empresa
            obraId: obraParaTrabajosExtra.id,
            idObra: obraParaTrabajosExtra.id,
            clienteId: obraParaTrabajosExtra.clienteId || null,
            idEmpresa: empresaSeleccionada.id,
            nombreEmpresa: empresaSeleccionada.nombreEmpresa,

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
          configuracionObra={obtenerConfiguracionObra(obraParaEtapasDiarias.id)}
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
                      className="form-control"
                      min="1"
                      placeholder="Ej: 8 semanas"
                      value={configuracionObra.semanasObjetivo}
                      onChange={(e) => setConfiguracionObra(prev => ({
                        ...prev,
                        semanasObjetivo: e.target.value
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
                          <div className="col-12 mb-2">
                            <div className="h5 text-primary mb-0">
                              {configuracionObra.capacidadNecesaria || Math.ceil(configuracionObra.jornalesTotales / (parseInt(configuracionObra.semanasObjetivo) * 5))}
                            </div>
                            <small className="text-muted">Jornales/día necesarios</small>
                          </div>
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

      {/* Modal para enviar obra manual */}
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
          obras={obras}
          empresaId={empresaId}
          empresaSeleccionada={empresaSeleccionada}
          onClose={() => setMostrarModalEstadisticasTodasObras(false)}
          showNotification={showNotification}
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

      <style>{`
        .hover-row:hover {
          background-color: #f5f5f5 !important;
        }
      `}</style>
    </div>
  );
};

export default ObrasPage;



