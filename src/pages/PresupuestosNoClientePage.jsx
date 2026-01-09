import React, { useEffect, useState, useContext } from 'react';
import { SidebarContext } from '../App';
import apiService from '../services/api';
import api from '../services/api';
import { useEmpresa } from '../EmpresaContext';
import PresupuestoNoClienteModal from '../components/PresupuestoNoClienteModal';
import ListarTodosPresupuestosModal from '../components/ListarTodosPresupuestosModal';
import BusquedaAvanzadaPresupuestosModal from '../components/BuscarPorDireccionModal';
import BuscarPorTipoProfesionalModal from '../components/BuscarPorTipoProfesionalModal';
import HistorialVersionesPresupuestoNoClienteModal from '../components/HistorialVersionesPresupuestoNoClienteModal';
import EnviarPresupuestoModal from '../components/EnviarPresupuestoModal';
import PlantillaPageLayout from '../components/PlantillaPageLayout';
import SidebarPresupuestosMenu from '../components/SidebarPresupuestosMenu';

const PresupuestosNoClientePage = ({ showNotification }) => {
  const { setPresupuestoControls } = useContext(SidebarContext) || {};
  const { empresaSeleccionada } = useEmpresa();
  const empresaId = empresaSeleccionada ? empresaSeleccionada.id : null;
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [cantidad, setCantidad] = useState(0);

  // ✨ Helper function para clases de badge de estado
  const getEstadoBadgeClass = (estado) => {
    switch (estado?.toUpperCase()) {
      case 'BORRADOR':
        return 'bg-secondary';
      case 'OBRA_A_CONFIRMAR':
        return 'bg-warning';
      case 'A_ENVIAR':
      case 'A ENVIAR':
        return 'bg-info';
      case 'ENVIADO':
        return 'bg-primary';
      case 'APROBADO':
        return 'bg-success';
      case 'MODIFICADO':
        return 'bg-warning';
      case 'EN_EJECUCION':
        return 'bg-primary';
      case 'TERMINADO':
        return 'bg-success';
      case 'SUSPENDIDO':
        return 'bg-secondary';
      case 'CANCELADO':
        return 'bg-danger';
      default:
        return 'bg-light text-dark';
    }
  };

  // Calcular días hábiles entre dos fechas (lunes a viernes)
  const calcularDiasHabiles = (fechaInicio, diasHabiles) => {
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
  };

  // Calcular días faltantes entre hoy y una fecha
  const calcularDiasFaltantes = (fechaObjetivo) => {
    if (!fechaObjetivo) return null;
    // Crear fecha de hoy en zona horaria local
    const hoy = new Date();
    const hoyLocal = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    let objetivoLocal = null;
    if (typeof fechaObjetivo === 'string') {
      // Parsear fecha objetivo como fecha local (YYYY-MM-DD)
      const partes = fechaObjetivo.split('-');
      if (partes.length === 3) {
        const [year, month, day] = partes.map(Number);
        objetivoLocal = new Date(year, month - 1, day);
      } else {
        // Si el string no es válido, retornar null
        return null;
      }
    } else if (fechaObjetivo instanceof Date) {
      objetivoLocal = new Date(fechaObjetivo.getFullYear(), fechaObjetivo.getMonth(), fechaObjetivo.getDate());
    } else {
      // Si es otro tipo, retornar null
      return null;
    }
    const diferencia = objetivoLocal - hoyLocal;
    const dias = Math.round(diferencia / (1000 * 60 * 60 * 24));
    return dias;
  };

  // Determinar si debe mostrar alerta de inicio próximo
  const obtenerAlertaInicio = (presupuesto) => {
    if (presupuesto.estado !== 'APROBADO' || !presupuesto.fechaProbableInicio) return null;

    const diasFaltantes = calcularDiasFaltantes(presupuesto.fechaProbableInicio);

    if (diasFaltantes === null) return null;
    if (diasFaltantes < 0) return { tipo: 'danger', mensaje: '¡Ya debió iniciar!', icono: '🚨', detalle: 'Cambió a EN EJECUCION' };
    if (diasFaltantes === 0) return { tipo: 'danger', mensaje: '¡Inicia HOY!', icono: '🚨', detalle: 'Cambiará a medianoche' };
    if (diasFaltantes <= 3) return { tipo: 'warning', mensaje: `Inicia en ${diasFaltantes} día${diasFaltantes > 1 ? 's' : ''}`, icono: '⚠️', detalle: 'Próximo cambio automático' };
    if (diasFaltantes <= 7) return { tipo: 'info', mensaje: `Inicia en ${diasFaltantes} días`, icono: '📅', detalle: 'Próximo a iniciar' };

    return null;
  };

  // Determinar si debe mostrar alerta de finalización próxima
  const obtenerAlertaFinalizacion = (presupuesto) => {
    if (presupuesto.estado !== 'EN_EJECUCION' || !presupuesto.fechaProbableInicio || !presupuesto.tiempoEstimadoTerminacion) return null;

    const fechaEstimadaFin = calcularDiasHabiles(presupuesto.fechaProbableInicio, presupuesto.tiempoEstimadoTerminacion);
    if (!fechaEstimadaFin) return null;

    const diasFaltantes = calcularDiasFaltantes(fechaEstimadaFin);

    if (diasFaltantes === null) return null;
    if (diasFaltantes < 0) return { tipo: 'danger', mensaje: '¡Ya debió terminar!', icono: '🚨', detalle: 'Cambió a TERMINADO' };
    if (diasFaltantes === 0) return { tipo: 'danger', mensaje: '¡Termina HOY!', icono: '🚨', detalle: 'Cambiará a medianoche' };
    if (diasFaltantes <= 3) return { tipo: 'warning', mensaje: `Termina en ${diasFaltantes} día${diasFaltantes > 1 ? 's' : ''}`, icono: '⏰', detalle: 'Por finalizar' };

    return null;
  };

  // Estados para modales
  const [showNuevoModal, setShowNuevoModal] = useState(false);
  const [showEditarModal, setShowEditarModal] = useState(false);
  const [showListarModal, setShowListarModal] = useState(false);
  const [showBuscarDireccionModal, setShowBuscarDireccionModal] = useState(false);
  const [showBuscarPorTipoProfesionalModal, setShowBuscarPorTipoProfesionalModal] = useState(false);
  const [showHistorialVersionesModal, setShowHistorialVersionesModal] = useState(false);
  const [showEnviarPresupuestoModal, setShowEnviarPresupuestoModal] = useState(false);
  const [presupuestoData, setPresupuestoData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [autoGenerarPDF, setAutoGenerarPDF] = useState(false);
  const [abrirWhatsAppDespuesDePDF, setAbrirWhatsAppDespuesDePDF] = useState(false);
  const [abrirEmailDespuesDePDF, setAbrirEmailDespuesDePDF] = useState(false);
  const [forzarModoLectura, setForzarModoLectura] = useState(false);
  const [mostrarModalSeleccionEnvio, setMostrarModalSeleccionEnvio] = useState(false);

  // Función para cargar filtros por defecto desde localStorage
  const cargarFiltrosPorDefecto = () => {
    try {
      const filtrosGuardados = localStorage.getItem('presupuestos_filtros_por_defecto');
      if (filtrosGuardados) {
        return JSON.parse(filtrosGuardados);
      }
    } catch (error) {
    }
    return null;
  };

  // Estados para filtros de búsqueda - cargar filtros por defecto si existen
  const filtrosVacios = {
    // Dirección de Obra
    nombreObra: '',
    direccionObraBarrio: '',
    direccionObraCalle: '',
    direccionObraAltura: '',
    direccionObraTorre: '',
    direccionObraPiso: '',
    direccionObraDepartamento: '',
    // Datos del Solicitante
    nombreSolicitante: '',
    telefono: '',
    mail: '',
    direccionParticular: '',
    // Datos del Presupuesto
    numeroPresupuesto: '',
    estado: '',
    numeroVersion: '',
    descripcion: '',
    // Fechas
    fechaEmisionDesde: '',
    fechaEmisionHasta: '',
    fechaCreacionDesde: '',
    fechaCreacionHasta: '',
    fechaProbableInicioDesde: '',
    fechaProbableInicioHasta: '',
    vencimientoDesde: '',
    vencimientoHasta: '',
    // Montos
    totalGeneralMinimo: '',
    totalGeneralMaximo: '',
    totalProfesionalesMinimo: '',
    totalProfesionalesMaximo: '',
    totalMaterialesMinimo: '',
    totalMaterialesMaximo: '',
    // Configuración
    tipoProfesionalPresupuesto: '',
    modoPresupuesto: ''
  };

  const filtrosIniciales = cargarFiltrosPorDefecto() || filtrosVacios;

  const [filtros, setFiltros] = useState(filtrosIniciales);
  const [tieneFiltrosPorDefecto, setTieneFiltrosPorDefecto] = useState(!!cargarFiltrosPorDefecto());

  const loadList = async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      // El backend filtra automáticamente con Hibernate Filter
      const datos = await apiService.presupuestosNoCliente.getAll(empresaId);

      const lista = Array.isArray(datos) ? datos : (datos.datos || datos.content || []);

      // 🆕 FILTRAR PARA MOSTRAR SOLO LA ÚLTIMA VERSIÓN DE CADA PRESUPUESTO
      // Agrupar por numeroPresupuesto
      const presupuestosPorNumero = {};
      lista.forEach(p => {
        const numPresupuesto = p.numeroPresupuesto;
        if (!presupuestosPorNumero[numPresupuesto]) {
          presupuestosPorNumero[numPresupuesto] = [];
        }
        presupuestosPorNumero[numPresupuesto].push(p);
      });

      // Para cada número de presupuesto, seleccionar solo la versión más reciente (CUALQUIER ESTADO)
      const listaFiltrada = [];
      Object.values(presupuestosPorNumero).forEach(versiones => {
        // Ordenar por versión descendente y tomar la más reciente
        versiones.sort((a, b) => {
          const versionA = a.numeroVersion || a.version || 0;
          const versionB = b.numeroVersion || b.version || 0;
          return versionB - versionA;
        });
        listaFiltrada.push(versiones[0]); // Tomar la versión más reciente
      });

      // 🔥 CARGAR itemsCalculadora para cada presupuesto (datos reales, NO hardcodeados)
      console.log('📊 Cargando datos completos para', listaFiltrada.length, 'presupuestos...');
      console.log('🔍 IDs a cargar:', listaFiltrada.map(p => ({ id: p.id, num: p.numeroPresupuesto, ver: p.numeroVersion, nombre: p.nombreObra })));

      const presupuestosCompletos = await Promise.all(
        listaFiltrada.map(async (p) => {
          try {
            console.log(`🔄 Cargando presupuesto ${p.id} (${p.nombreObra})...`);
            const completo = await apiService.presupuestosNoCliente.getById(p.id, empresaId);

            // Verificar si los datos vienen con flag de error del backend
            if (completo._errorBackend) {
              console.warn(`⚠️ Backend error en presupuesto ${p.id}, usando datos de lista`);
              return { ...p, _errorBackend: true };
            }

            console.log(`✅ Presupuesto ${p.id} cargado:`, {
              items: completo.itemsCalculadora?.length,
              totalFinal: completo.totalFinal,
              honorarios: completo.honorarios,
              mayoresCostos: completo.mayoresCostos,
              TODAS_LAS_PROPIEDADES: Object.keys(completo).sort()
            });

            // Transformar campos planos en objetos anidados
            const presupuestoConObjetos = {
              ...completo,
              honorarios: {
                materiales: {
                  activo: completo.honorariosMaterialesActivo,
                  tipo: completo.honorariosMaterialesTipo,
                  valor: completo.honorariosMaterialesValor
                },
                jornales: {
                  activo: completo.honorariosJornalesActivo,
                  tipo: completo.honorariosJornalesTipo,
                  valor: completo.honorariosJornalesValor
                },
                otrosCostos: {
                  activo: completo.honorariosOtrosCostosActivo,
                  tipo: completo.honorariosOtrosCostosTipo,
                  valor: completo.honorariosOtrosCostosValor
                },
                profesionales: {
                  activo: completo.honorariosProfesionalesActivo,
                  tipo: completo.honorariosProfesionalesTipo,
                  valor: completo.honorariosProfesionalesValor
                }
              },
              mayoresCostos: {
                materiales: {
                  activo: completo.mayoresCostosMaterialesActivo,
                  tipo: completo.mayoresCostosMaterialesTipo,
                  valor: completo.mayoresCostosMaterialesValor
                },
                jornales: {
                  activo: completo.mayoresCostosJornalesActivo,
                  tipo: completo.mayoresCostosJornalesTipo,
                  valor: completo.mayoresCostosJornalesValor
                },
                otrosCostos: {
                  activo: completo.mayoresCostosOtrosCostosActivo,
                  tipo: completo.mayoresCostosOtrosCostosTipo,
                  valor: completo.mayoresCostosOtrosCostosValor
                },
                profesionales: {
                  activo: completo.mayoresCostosProfesionalesActivo,
                  tipo: completo.mayoresCostosProfesionalesTipo,
                  valor: completo.mayoresCostosProfesionalesValor
                }
              }
            };

            return presupuestoConObjetos;
          } catch (err) {
            console.warn(`⚠️ Error cargando presupuesto ${p.id} (${p.nombreObra}):`, err.message);
            // En lugar de fallar, usar datos de la lista original
            return { ...p, _loadError: true };
          }
        })
      );

      // Ordenar por número de presupuesto (descendente)
      const listaOrdenada = presupuestosCompletos.sort((a, b) => {
        return b.numeroPresupuesto - a.numeroPresupuesto;
      });

      // Aplicar filtros de búsqueda
      const listaConFiltrosBusqueda = listaOrdenada.filter(presupuesto => {
        // Si todos los filtros están vacíos, mostrar todos
        const hayFiltros = Object.values(filtros).some(v => v && v.toString().trim() !== '');
        if (!hayFiltros) return true;

        // 📍 Filtros de Dirección de Obra
        if (filtros.nombreObra &&
            !presupuesto.nombreObra?.toLowerCase().includes(filtros.nombreObra.toLowerCase())) {
          return false;
        }
        if (filtros.direccionObraBarrio &&
            !presupuesto.direccionObraBarrio?.toLowerCase().includes(filtros.direccionObraBarrio.toLowerCase())) {
          return false;
        }
        if (filtros.direccionObraCalle &&
            !presupuesto.direccionObraCalle?.toLowerCase().includes(filtros.direccionObraCalle.toLowerCase())) {
          return false;
        }
        if (filtros.direccionObraAltura &&
            !presupuesto.direccionObraAltura?.toLowerCase().includes(filtros.direccionObraAltura.toLowerCase())) {
          return false;
        }
        if (filtros.direccionObraTorre &&
            !presupuesto.direccionObraTorre?.toLowerCase().includes(filtros.direccionObraTorre.toLowerCase())) {
          return false;
        }
        if (filtros.direccionObraPiso &&
            !presupuesto.direccionObraPiso?.toLowerCase().includes(filtros.direccionObraPiso.toLowerCase())) {
          return false;
        }
        if (filtros.direccionObraDepartamento &&
            !presupuesto.direccionObraDepartamento?.toLowerCase().includes(filtros.direccionObraDepartamento.toLowerCase())) {
          return false;
        }

        // 👤 Filtros de Solicitante
        if (filtros.nombreSolicitante &&
            !presupuesto.nombreSolicitante?.toLowerCase().includes(filtros.nombreSolicitante.toLowerCase())) {
          return false;
        }
        if (filtros.telefono &&
            !presupuesto.telefono?.toLowerCase().includes(filtros.telefono.toLowerCase())) {
          return false;
        }
        if (filtros.mail &&
            !presupuesto.mail?.toLowerCase().includes(filtros.mail.toLowerCase())) {
          return false;
        }
        if (filtros.direccionParticular &&
            !presupuesto.direccionParticular?.toLowerCase().includes(filtros.direccionParticular.toLowerCase())) {
          return false;
        }

        // 🏢 Filtros de Presupuesto
        if (filtros.numeroPresupuesto && presupuesto.numeroPresupuesto !== Number(filtros.numeroPresupuesto)) {
          return false;
        }
        if (filtros.estado && presupuesto.estado !== filtros.estado) {
          return false;
        }
        if (filtros.numeroVersion && presupuesto.numeroVersion !== Number(filtros.numeroVersion)) {
          return false;
        }
        if (filtros.descripcion &&
            !presupuesto.descripcion?.toLowerCase().includes(filtros.descripcion.toLowerCase())) {
          return false;
        }

        // 💰 Filtros de Montos
        if (filtros.totalGeneralMinimo && (presupuesto.totalPresupuestoConHonorarios || presupuesto.montoTotal || presupuesto.totalFinal || presupuesto.totalGeneral) < Number(filtros.totalGeneralMinimo)) {
          return false;
        }
        if (filtros.totalGeneralMaximo && (presupuesto.totalPresupuestoConHonorarios || presupuesto.montoTotal || presupuesto.totalFinal || presupuesto.totalGeneral) > Number(filtros.totalGeneralMaximo)) {
          return false;
        }

        // 🔧 Filtros de Configuración
        if (filtros.tipoProfesionalPresupuesto &&
            !presupuesto.tipoProfesionalPresupuesto?.toLowerCase().includes(filtros.tipoProfesionalPresupuesto.toLowerCase())) {
          return false;
        }
        if (filtros.modoPresupuesto &&
            !presupuesto.modoPresupuesto?.toLowerCase().includes(filtros.modoPresupuesto.toLowerCase())) {
          return false;
        }

        return true;
      });

      setList(listaConFiltrosBusqueda);
      setCantidad(listaConFiltrosBusqueda.length);
    } catch (err) {
      console.error('Error cargando presupuestos:', err);
      showNotification && showNotification(err.message || 'Error cargando presupuestos', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, filtros]);

  // Función para limpiar filtros por defecto
  const handleLimpiarFiltrosPorDefecto = () => {
    if (window.confirm('¿Desea eliminar la configuración de filtros por defecto?\n\nLa próxima vez que abra esta página, se cargarán todos los presupuestos.')) {
      localStorage.removeItem('presupuestos_filtros_por_defecto');
      setTieneFiltrosPorDefecto(false);
      setFiltros(filtrosVacios);
      showNotification && showNotification('✅ Configuración de filtros eliminada. Mostrando todos los presupuestos.', 'success');
    }
  };

  // Función para contar filtros activos
  const contarFiltrosActivos = () => {
    return Object.values(filtros).filter(v => v && v.toString().trim() !== '').length;
  };

  // ==================== HANDLERS DE BOTONES ====================

  const handleNuevo = () => {
    setPresupuestoData(null);
    setShowNuevoModal(true);
  };

  // 🔒 Función para verificar si un presupuesto es editable
  const esPresupuestoEditable = (presupuesto) => {
    // Solo BORRADOR y A_ENVIAR son editables
    const estadosEditables = ['BORRADOR', 'A_ENVIAR'];
    return estadosEditables.includes(presupuesto.estado);
  };

  const handleEditar = async () => {
    if (!selectedId) return;

    try {
      console.log(`🔍 Intentando cargar presupuesto ID: ${selectedId}`);
      const presupuesto = await api.presupuestosNoCliente.getById(selectedId, empresaId);
      console.log(`✅ Presupuesto cargado exitosamente:`, presupuesto);

      // Si el presupuesto NO está en BORRADOR ni A_ENVIAR, mostrar confirmación
      if (presupuesto.estado !== 'BORRADOR' && presupuesto.estado !== 'A_ENVIAR') {
        const confirmar = window.confirm(
          `⚠️ ATENCIÓN: Al editar este presupuesto se generará una NUEVA VERSIÓN.\n\n` +
          `Estado actual: ${presupuesto.estado}\n` +
          `Versión actual: ${presupuesto.numeroVersion || presupuesto.version || 1}\n\n` +
          `¿Desea continuar y crear una nueva versión?`
        );

        if (!confirmar) {
          return; // Cancelar edición
        }
      }

      // ✅ Normalizar nombres de campos (backend puede usar obraId o idObra)
      const presupuestoNormalizado = {
        ...presupuesto,
        obraId: presupuesto.obraId || presupuesto.idObra || null,
        clienteId: presupuesto.clienteId || presupuesto.idCliente || null
      };

      // Abrir modal en modo edición (SIN marcar _soloLectura)
      setPresupuestoData(presupuestoNormalizado);
      setShowEditarModal(true);

    } catch (error) {
      console.error('❌ Error al cargar presupuesto para editar:', error);
      console.error('❌ Detalles del error:', error.response?.data);

      // 🛠️ MANEJO ESPECÍFICO DE ERRORES:
      if (error.response?.status === 400) {
        const mensaje = error.response?.data?.message || error.response?.data || 'Error 400 - Bad Request';
        alert(`❌ Error al cargar el presupuesto:\n\n${mensaje}\n\n🔧 Posibles causas:\n- Datos corruptos en la base de datos\n- Cambios en la estructura del backend\n- Presupuesto creado con versión anterior\n\n💡 Solución: Contacte al administrador del sistema.`);
      } else {
        const mensaje = error.response?.data?.message || error.message || 'Error desconocido';
        alert(`❌ Error al cargar el presupuesto:\n\n${mensaje}`);
      }

      showNotification && showNotification(
        'Error al cargar el presupuesto: ' + (error.response?.data?.message || error.message),
        'error'
      );
    }
  };

  const handleListarTodos = () => {
    setShowListarModal(true);
  };

  const handleBuscarPorDireccion = () => {
    setShowBuscarDireccionModal(true);
  };

  const handleFiltrosGuardados = (nuevosFiltros) => {
    // Actualizar estado cuando se guardan filtros por defecto
    setFiltros(prev => ({...prev, ...nuevosFiltros}));
    setTieneFiltrosPorDefecto(true);
    showNotification && showNotification('✅ Filtros aplicados y guardados como configuración por defecto', 'success');
  };

  const handleResultadosFiltrados = (resultados) => {
    // Ordenar resultados igual que en loadList: por número de presupuesto descendente y versión descendente
    const resultadosOrdenados = resultados.sort((a, b) => {
      // Primero por número de presupuesto descendente (mayor primero)
      if (a.numeroPresupuesto !== b.numeroPresupuesto) {
        return b.numeroPresupuesto - a.numeroPresupuesto;
      }
      // Si es el mismo presupuesto, por versión descendente (mayor primero)
      const versionA = a.numeroVersion || a.version || 0;
      const versionB = b.numeroVersion || b.version || 0;
      return versionB - versionA;
    });

    // Actualizar la lista principal con los resultados filtrados y ordenados
    setList(resultadosOrdenados);
    showNotification && showNotification(`✅ Se encontraron ${resultadosOrdenados.length} presupuesto(s)`, 'success');
  };

  const handleBuscarPorTipoProfesional = () => {
    setShowBuscarPorTipoProfesionalModal(true);
  };

  const handleHistorialVersiones = () => {
    // Al abrir el historial, pasar el numeroPresupuesto del seleccionado
    const presupuestoSeleccionado = list.find(p => p.id === selectedId);
    if (presupuestoSeleccionado) {
      window.numeroPresupuestoHistorial = presupuestoSeleccionado.numeroPresupuesto;
    } else {
      window.numeroPresupuestoHistorial = null;
    }
    setShowHistorialVersionesModal(true);
  };

  const handleEnviarPresupuesto = async () => {
    if (!selectedId) {
      showNotification && showNotification('Por favor, seleccione un presupuesto de la tabla', 'warning');
      return;
    }

    // Mostrar modal de selección de envío
    setMostrarModalSeleccionEnvio(true);
  };

  const handleConfirmarEnvio = async (tipo) => {
    setMostrarModalSeleccionEnvio(false);

    if (!tipo) return; // Cancelado

    try {
      console.log('📤 handleConfirmarEnvio - Opción elegida:', tipo);
      // Cargar el presupuesto completo y abrir el MISMO modal de edición
      const presupuestoCompleto = await api.presupuestosNoCliente.getById(selectedId, empresaId);

      setPresupuestoData(presupuestoCompleto);

      if (tipo === 'whatsapp') {
        // ✅ ACTIVAR FLAGS PARA WHATSAPP
        setAutoGenerarPDF(true);
        setAbrirWhatsAppDespuesDePDF(true);
        setAbrirEmailDespuesDePDF(false);

        console.log('📱 Flags configurados para WhatsApp');
      } else if (tipo === 'email') {
        // ✅ ACTIVAR FLAGS PARA EMAIL
        setAutoGenerarPDF(true);
        setAbrirWhatsAppDespuesDePDF(false);
        setAbrirEmailDespuesDePDF(true);

        console.log('📧 Flags configurados para Email');
      }

      setShowEditarModal(true); // ← Abrir modal de edición con scroll a PDF
    } catch (error) {
      showNotification && showNotification('Error al cargar el presupuesto: ' + error.message, 'danger');
    }
  };

  const handleSelectPresupuestoFromBusqueda = async (presupuesto) => {
    try {
      // Cargar el presupuesto completo y abrir modal de edición
      const presupuestoCompleto = await api.presupuestosNoCliente.getById(presupuesto.id, empresaId);
      setPresupuestoData(presupuestoCompleto);
      setShowEditarModal(true);
    } catch (error) {
      showNotification && showNotification('Error al cargar el presupuesto: ' + error.message, 'danger');
    }
  };

  const handleEliminar = async () => {
    if (!selectedId) return;

    // Obtener datos del presupuesto para validar
    const presupuesto = list.find(p => p.id === selectedId);

    if (!presupuesto) {
      showNotification && showNotification('Presupuesto no encontrado', 'danger');
      return;
    }

    // ✅ MOSTRAR CONFIRMACIÓN PRIMERO (antes de activar loading)
    // Validar si está aprobado y tiene obra asociada - PERMITIR ELIMINACIÓN EN CASCADA
    if (presupuesto.estado === 'APROBADO' && presupuesto.obraId) {
      const confirmar = window.confirm(
        `⚠️ ELIMINACIÓN EN CASCADA\n\n` +
        `Este presupuesto está APROBADO y vinculado a la Obra ID: ${presupuesto.obraId}\n\n` +
        `Se eliminará:\n` +
        `✓ Todos los pagos a profesionales\n` +
        `✓ Todas las asistencias registradas\n` +
        `✓ Las asignaciones profesional-obra\n` +
        `✓ El presupuesto\n\n` +
        `NO se eliminará:\n` +
        `✗ La obra (ID: ${presupuesto.obraId})\n` +
        `✗ El cliente asociado\n` +
        `✗ La empresa\n\n` +
        `⚠️ ADVERTENCIA: La obra quedará sin presupuesto asociado.\n\n` +
        `¿Desea continuar con la eliminación en cascada?`
      );

      if (!confirmar) {
        return; // Cancelar eliminación
      }

      // Ejecutar eliminación en cascada
      await ejecutarEliminacionEnCascada(selectedId, presupuesto);
      return;
    }

    // Mensaje de confirmación para presupuestos no aprobados
    let mensaje = `¿Está seguro de eliminar este presupuesto?\n\n`;
    mensaje += `Presupuesto #${presupuesto.numeroPresupuesto} versión ${presupuesto.numeroVersion}\n`;
    mensaje += `Estado: ${presupuesto.estado}\n`;

    const confirmar = window.confirm(mensaje);
    if (!confirmar) return;

    // ✅ RECIÉN AHORA ejecutar eliminación (después de confirmación)
    try {
      await api.presupuestosNoCliente.delete(selectedId, empresaId);
      showNotification && showNotification('Presupuesto eliminado correctamente', 'success');
      setSelectedId(null);
      loadList();
    } catch (error) {
      const errorMsg = error.response?.data?.mensaje || error.response?.data?.message || error.message || 'Error desconocido';
      showNotification && showNotification('Error al eliminar: ' + errorMsg, 'danger');
    }
  };

  const ejecutarEliminacionEnCascada = async (id, presupuesto) => {
    try {

      // 1. Obtener el presupuesto completo si no lo tenemos
      const presupuestoCompleto = presupuesto.itemsCalculadora
        ? presupuesto
        : await api.presupuestosNoCliente.getById(id, empresaId);

      // 2. Obtener profesionalObraId únicos de los items de calculadora
      const profesionalObraIds = new Set();
      if (presupuestoCompleto.itemsCalculadora && Array.isArray(presupuestoCompleto.itemsCalculadora)) {
        presupuestoCompleto.itemsCalculadora.forEach(item => {
          if (item.profesionales && Array.isArray(item.profesionales)) {
            item.profesionales.forEach(prof => {
              if (prof.profesionalObraId) {
                profesionalObraIds.add(prof.profesionalObraId);
              }
            });
          }
        });
        }      let totalPagosEliminados = 0;
      let totalAsistenciasEliminadas = 0;
      let totalAsignacionesEliminadas = 0;

      // 3. Eliminar pagos de cada profesionalObraId
      for (const profesionalObraId of profesionalObraIds) {
        try {

          const { listarPagosPorProfesional, eliminarPago } = await import('../services/pagosProfesionalObraService.js');

          const pagos = await listarPagosPorProfesional(profesionalObraId, empresaId);
          const pagosArray = Array.isArray(pagos) ? pagos : [];

          for (const pago of pagosArray) {
            await eliminarPago(pago.id, empresaId);
            totalPagosEliminados++;
          }
        } catch (err) {
        }
      }

      // 4. Eliminar asistencias
      if (api.asistencias) {
        for (const profesionalObraId of profesionalObraIds) {
          try {
            const asistencias = await api.asistencias.listarAsistenciasPorProfesional(profesionalObraId);
            const asistenciasArray = Array.isArray(asistencias) ? asistencias : [];

            for (const asistencia of asistenciasArray) {
              await api.asistencias.eliminarAsistencia(asistencia.id);
              totalAsistenciasEliminadas++;
            }
          } catch (err) {
          }
        }
      }

      // 5. Eliminar asignaciones profesional-obra
      for (const profesionalObraId of profesionalObraIds) {
        try {

          if (api.profesionalesObra && api.profesionalesObra.delete) {
            await api.profesionalesObra.delete(profesionalObraId, empresaId);
            totalAsignacionesEliminadas++;
          } else {
          }
        } catch (err) {
        }
      }

      // 6. Finalmente, eliminar el presupuesto (la obra NO se elimina)
      await api.presupuestosNoCliente.delete(id, empresaId);

      const mensaje = `Presupuesto eliminado exitosamente\n` +
        `${totalPagosEliminados > 0 ? `💸 ${totalPagosEliminados} pago(s) eliminado(s)\n` : ''}` +
        `${totalAsistenciasEliminadas > 0 ? `📅 ${totalAsistenciasEliminadas} asistencia(s) eliminada(s)\n` : ''}` +
        `${totalAsignacionesEliminadas > 0 ? `👷 ${totalAsignacionesEliminadas} asignación(es) profesional-obra eliminada(s)\n` : ''}` +
        `\n⚠️ Nota: La obra asociada NO fue eliminada`;

      showNotification && showNotification(mensaje, 'success');
      setSelectedId(null);
      loadList();
    } catch (err) {
      showNotification && showNotification(err.message || 'Error al eliminar en cascada', 'danger');
    }
  };

  const handleAprobarYCrearObra = async () => {
    if (!selectedId || !empresaId) return;

    try {
      // 1. Obtener datos del presupuesto actual para validar
      const presupuestoActual = list.find(p => p.id === selectedId);

      if (!presupuestoActual) {
        showNotification && showNotification('Presupuesto no encontrado', 'danger');
        return;
      }

      // Validar que no esté ya aprobado
      if (presupuestoActual.estado === 'APROBADO') {
        showNotification && showNotification('Este presupuesto ya está aprobado', 'warning');
        return;
      }

      // ✅ LÓGICA INTELIGENTE: Detectar escenario
      const tieneObraAsociada = presupuestoActual.obraId !== null && presupuestoActual.obraId !== undefined;

      // ESCENARIO 1: Presupuesto CON obra asociada → Solo aprobar (sin crear nada)
      if (tieneObraAsociada) {
        const confirmar = window.confirm(
          `¿Aprobar presupuesto #${presupuestoActual.numeroPresupuesto} v${presupuestoActual.numeroVersion}?\n\n` +
          `Obra asociada: ID ${presupuestoActual.obraId}\n` +
          `Estado actual: ${presupuestoActual.estado}\n\n` +
          `Se cambiará el estado a APROBADO sin crear nueva obra ni cliente.`
        );

        if (!confirmar) return;

        // Llamar al mismo endpoint pero el backend detectará que ya tiene obra y solo cambiará el estado
        const response = await api.post(
          `/api/v1/presupuestos-no-cliente/${selectedId}/aprobar-y-crear-obra`,
          {},
          {
            params: { empresaId },
            headers: { 'X-Tenant-ID': empresaId, 'Content-Type': 'application/json' }
          }
        );

        showNotification && showNotification(
          `✅ Presupuesto aprobado exitosamente (Obra ID: ${presupuestoActual.obraId})`,
          'success'
        );

        loadList();
        return;
      }

      // ESCENARIO 2: Presupuesto SIN obra asociada → Aprobar y crear obra/cliente

      // Validar que tenga dirección de obra O nombre de obra
      const tieneDireccion = presupuestoActual.direccionObraCalle && presupuestoActual.direccionObraAltura;
      const tieneNombreObra = presupuestoActual.nombreObra && presupuestoActual.nombreObra.trim() !== '';

      if (!tieneDireccion && !tieneNombreObra) {
        showNotification && showNotification(
          'El presupuesto debe tener:\n- Dirección de obra completa (calle y altura), O\n- Nombre de obra',
          'warning'
        );
        return;
      }

      // Determinar si es presupuesto semanal
      const esSemanal = presupuestoActual.tipoPresupuesto === 'TRABAJOS_SEMANALES';
      const estadoActual = presupuestoActual.estado;

      // Preparar el texto de identificación de la obra
      const identificacionObra = tieneDireccion
        ? `Dirección: ${presupuestoActual.direccionObraCalle} ${presupuestoActual.direccionObraAltura}`
        : `Nombre: ${presupuestoActual.nombreObra}`;

      // Confirmar acción
      const confirmar = window.confirm(
        `¿Aprobar presupuesto #${presupuestoActual.numeroPresupuesto} v${presupuestoActual.numeroVersion} y crear obra?\n\n` +
        `${identificacionObra}\n` +
        `${esSemanal && estadoActual === 'BORRADOR' ? 'Este presupuesto SEMANAL pasará a estado APROBADO y ' : ''}` +
        `Se creará automáticamente ${presupuestoActual.clienteId ? 'la obra asociada al cliente seleccionado' : 'un nuevo cliente y obra'}.`
      );

      if (!confirmar) return;

      // 2. Llamar al endpoint del backend
      const response = await api.post(
        `/api/v1/presupuestos-no-cliente/${selectedId}/aprobar-y-crear-obra`,
        {},
        {
          params: { empresaId },
          headers: { 'X-Tenant-ID': empresaId, 'Content-Type': 'application/json' }
        }
      );

      // El backend puede devolver la respuesta en diferentes formatos
      const respuestaData = response.data || response;
      const obraId = respuestaData?.obraId || respuestaData?.id;
      const mensaje = respuestaData?.mensaje || respuestaData?.message || 'Presupuesto aprobado y obra creada exitosamente';
      const obraCreada = respuestaData?.obraCreada !== false; // true por defecto si no viene
      const presupuestosActualizados = respuestaData?.presupuestosActualizados;

      if (obraCreada && obraId) {
        showNotification && showNotification(
          mensaje || `✅ Presupuesto aprobado. Obra #${obraId} creada exitosamente.`,
          'success'
        );
      } else {
        showNotification && showNotification(
          mensaje || 'Presupuesto aprobado correctamente',
          'success'
        );
      }

      // Recargar la lista
      loadList();

    } catch (error) {

      const errorMsg = error.response?.data?.mensaje
        || error.response?.data?.message
        || error.response?.data?.error
        || error.message
        || 'Error desconocido';

      const errorDetalle = error.response?.data?.detalle
        || error.response?.data?.trace
        || error.response?.data?.details
        || '';

      const mensajeCompleto = `❌ Error al aprobar:\n\n${errorMsg}${errorDetalle ? `\n\nDetalles:\n${errorDetalle}` : ''}\n\nRevise la consola (F12) para más información.`;

      showNotification && showNotification(mensajeCompleto, 'danger');
    }
  };

  const handleDuplicar = async () => {
    if (!selectedId) return;
    if (!window.confirm('¿Desea duplicar este presupuesto?')) return;

    try {
      await api.presupuestosNoCliente.duplicar(selectedId, empresaId);
      showNotification && showNotification('Presupuesto duplicado correctamente', 'success');
      loadList();
    } catch (error) {
      showNotification && showNotification('Error al duplicar: ' + error.message, 'danger');
    }
  };

  const handleSavePresupuesto = async (presupuesto) => {
    setSaving(true);
    try {
      // ✅ CASO ESPECIAL: Edición solo de fechas (cualquier estado)
      if (presupuesto._editarSoloFechas === true) {
        console.log('🔄 FLUJO EDITAR SOLO FECHAS - Iniciando...');
        console.log('📋 Presupuesto ID:', presupuesto.id);
        console.log('📅 Nueva fechaProbableInicio:', presupuesto.fechaProbableInicio);
        console.log('⏱️ Nuevo tiempoEstimadoTerminacion:', presupuesto.tiempoEstimadoTerminacion);

        try {
          // Usar PUT completo para asegurar persistencia en BD
          // Obtener el presupuesto completo actualizado
          console.log('📥 Obteniendo presupuesto completo desde backend...');
          const presupuestoCompleto = await api.presupuestosNoCliente.getById(presupuesto.id, empresaId);
          console.log('✅ Presupuesto obtenido - Version actual:', presupuestoCompleto.numeroVersion, 'Estado:', presupuestoCompleto.estado);

          // Actualizar solo las fechas manteniendo todo lo demás igual
          const presupuestoActualizado = {
            ...presupuestoCompleto,
            fechaProbableInicio: presupuesto.fechaProbableInicio,
            tiempoEstimadoTerminacion: presupuesto.tiempoEstimadoTerminacion
          };

          console.log('📤 Enviando PUT al backend - ID:', presupuesto.id);
          await api.presupuestosNoCliente.update(presupuesto.id, presupuestoActualizado, empresaId);
          console.log('✅ PUT completado exitosamente');

          setShowEditarModal(false);
          setPresupuestoData(null);

          // Forzar recarga inmediata de la lista para actualizar los badges de alerta
          await loadList();

          showNotification && showNotification(
            `✅ Fechas actualizadas exitosamente.\nVersión y estado preservados.`,
            'success'
          );
        } catch (error) {
          const mensaje = error.response?.data?.mensaje || error.message || 'Error al actualizar fechas';
          showNotification && showNotification(
            `❌ Error al actualizar fechas:\n\n${mensaje}`,
            'danger'
          );
        } finally {
          setSaving(false);
        }
        return;
      }

      // ✅ VALIDACIÓN FLEXIBLE: Permitir items con valores nulos (campos opcionales)
      if (presupuesto.itemsCalculadora && presupuesto.itemsCalculadora.length > 0) {
        // Solo validar que tengan al menos el tipo de profesional definido
        const itemsInvalidos = presupuesto.itemsCalculadora.filter(item => {
          return !item.tipoProfesional || item.tipoProfesional.trim() === '';
        });

        if (itemsInvalidos.length > 0) {
          alert(`⚠️ ERROR: Hay ${itemsInvalidos.length} item(s) sin tipo de profesional.\n\nTodos los items deben tener al menos un tipo de profesional asignado.`);
          setSaving(false);
          return;
        }

        // ✅ Log informativo de items con valores nulos (permitidos)
        const itemsConValoresNulos = presupuesto.itemsCalculadora.filter(item => {
          const tieneJornales = item.cantidadJornales && item.importeJornal;
          const tieneMateriales = item.materiales;
          return !tieneJornales && !tieneMateriales;
        });


      }

      // Verificar si es EDICIÓN (presupuestoData tiene ID) o CREACIÓN NUEVA
      const esEdicion = presupuestoData?.id != null;

      if (esEdicion) {
        // ✅ EDICIÓN: Decidir si crear nueva versión o simplemente actualizar

        // IMPORTANTE: Usar el estado ORIGINAL del presupuesto cuando se abrió
        const estadoOriginal = presupuestoData.estado;
        const esTradicional = presupuestoData.tipoPresupuesto === 'TRADICIONAL';

        // BORRADOR y A_ENVIAR de presupuestos TRADICIONALES permite edición sin crear nueva versión
        // Presupuestos SEMANALES siempre actualizan la misma versión
        const esBorradorOListoParaEnviar = estadoOriginal === 'BORRADOR' || estadoOriginal === 'A_ENVIAR';
        const esSemanal = presupuestoData.tipoPresupuesto === 'TRABAJOS_SEMANALES';

        // Determinar si debe crear nueva versión
        // SEMANAL: nunca crea versión nueva (siempre actualiza)
        // TRADICIONAL BORRADOR o A_ENVIAR: nunca crea versión nueva (siempre actualiza)
        // TRADICIONAL otros estados (ENVIADO, APROBADO, etc.): SÍ crea versión nueva
        const debeCrearNuevaVersion = !esSemanal && !esBorradorOListoParaEnviar;

        // IMPORTANTE: Ignorar el flag _shouldCreateNewVersion del modal si estamos en BORRADOR o A_ENVIAR
        if (esBorradorOListoParaEnviar) {
          delete presupuesto._shouldCreateNewVersion;
          delete presupuesto._preservarEstado;
        }

        if (debeCrearNuevaVersion) {
          // === FLUJO ANTERIOR: Crear nueva versión ===
          const nuevaVersion = (presupuestoData.version || presupuestoData.numeroVersion || 1) + 1;

          // ✅ NUEVO: Verificar si se debe preservar el estado (solo cambios en fechas/días)
          const preservarEstado = presupuesto._preservarEstado === true;
          const estadoOriginal = presupuestoData.estado;

          // 1. PRIMERO: Cambiar el estado de la versión anterior a "MODIFICADO"

          try {
            console.log(`📝 Cambiando estado de versión ${presupuestoData.version} (ID: ${presupuestoData.id}) a MODIFICADO...`);
            await api.presupuestosNoCliente.actualizarEstado(presupuestoData.id, 'MODIFICADO', empresaId);
            console.log(`✅ Versión anterior marcada como MODIFICADO`);

            // 2. Si la versión anterior tenía una obra asociada, eliminarla
            if (presupuestoData.obraId) {
              try {
                await api.obras.delete(presupuestoData.obraId);
                console.log(`🗑️ Obra ${presupuestoData.obraId} eliminada`);

                // Limpiar el obraId del presupuesto
                await api.presupuestosNoCliente.actualizarEstado(presupuestoData.id, 'MODIFICADO', empresaId);
              } catch (errorObra) {
                console.warn('⚠️ Error al eliminar obra:', errorObra.message);
                // Continuamos aunque falle el borrado de la obra
              }
            }
          } catch (error) {
            console.error('❌ ERROR al cambiar estado de versión anterior:', error);
            showNotification && showNotification(
              `⚠️ Advertencia: No se pudo cambiar el estado de la versión anterior a MODIFICADO.\n\n${error.message}`,
              'warning'
            );
            // Continuamos con la creación de nueva versión
          }

          // 3. SEGUNDO: Crear la nueva versión con estado "A Enviar"
          presupuesto.version = nuevaVersion;
          presupuesto.numeroVersion = nuevaVersion;
          presupuesto.numeroPresupuesto = presupuestoData.numeroPresupuesto;

          // ✅ NUEVO: Preservar estado original si solo cambiaron fechas/días hábiles
          // O si se está editando un presupuesto APROBADO/EN_EJECUCION (heredar profesionales)
          if (preservarEstado) {
            presupuesto.estado = estadoOriginal;
          } else if (estadoOriginal === 'APROBADO' || estadoOriginal === 'EN_EJECUCION') {
            // Si se editó un presupuesto APROBADO/EN_EJECUCION, mantener ese estado
            // La versión anterior pasa a MODIFICADO, esta versión hereda el estado activo
            presupuesto.estado = estadoOriginal;
            console.log(`📋 Nueva versión ${nuevaVersion} hereda estado "${estadoOriginal}" de versión anterior`);
          } else {
            presupuesto.estado = 'A Enviar'; // Estado por defecto para cambios críticos
          }

          // ✅ PRESERVAR obraId y clienteId de la versión anterior (si existen)
          if (presupuestoData.obraId) {
            presupuesto.obraId = presupuestoData.obraId;
            presupuesto.idObra = presupuestoData.obraId;
          }
          if (presupuestoData.clienteId) {
            presupuesto.clienteId = presupuestoData.clienteId;
            presupuesto.idCliente = presupuestoData.clienteId;
          }

          // ✅ HEREDAR profesionalObraId de versión anterior para profesionales coincidentes
          // Esto permite que los pagos se mantengan vinculados entre versiones
          if (presupuesto.itemsCalculadora && Array.isArray(presupuesto.itemsCalculadora)) {
            const itemsAnteriores = presupuestoData.itemsCalculadora || [];

            presupuesto.itemsCalculadora.forEach((itemNuevo, itemIdx) => {
              if (itemNuevo.profesionales && Array.isArray(itemNuevo.profesionales)) {
                itemNuevo.profesionales.forEach((profNuevo, profIdx) => {
                  // Buscar profesional coincidente en versión anterior por tipo y posición relativa
                  const itemAnterior = itemsAnteriores[itemIdx];
                  if (itemAnterior?.profesionales && Array.isArray(itemAnterior.profesionales)) {
                    const profAnterior = itemAnterior.profesionales[profIdx];

                    // Si tipo y características coinciden, heredar profesionalObraId
                    if (profAnterior &&
                        profAnterior.tipo === profNuevo.tipo &&
                        profAnterior.importeJornal === profNuevo.importeJornal &&
                        profAnterior.cantidadJornales === profNuevo.cantidadJornales) {

                      // Heredar el ID para mantener vínculo con pagos
                      if (profAnterior.profesionalObraId) {
                        profNuevo.profesionalObraId = profAnterior.profesionalObraId;
                        console.log(`🔗 Heredando profesionalObraId ${profAnterior.profesionalObraId} para ${profNuevo.tipo} #${profIdx + 1}`);
                      }
                    } else if (profNuevo.tipo) {
                      console.log(`➕ Nuevo profesional detectado: ${profNuevo.tipo} #${profIdx + 1} (recibirá nuevo ID del backend)`);
                    }
                  } else if (profNuevo.tipo) {
                    console.log(`➕ Nuevo profesional detectado: ${profNuevo.tipo} #${profIdx + 1} (recibirá nuevo ID del backend)`);
                  }
                });
              }
            });
          }

          // Eliminar ID para que el backend lo cree como nuevo registro
          delete presupuesto.id;
          delete presupuesto._shouldCreateNewVersion; // Limpiar flag interno
          delete presupuesto._preservarEstado; // Limpiar flag interno

          // ✅ UX MEJORADA: Si tiene nombreObra pero falta calle/altura, usar valores genéricos
          if (presupuesto.nombreObra && presupuesto.nombreObra.trim() !== '') {
            if (!presupuesto.direccionObraCalle || presupuesto.direccionObraCalle.trim() === '') {
              presupuesto.direccionObraCalle = 'Calle genérica';
            }
            if (!presupuesto.direccionObraAltura || presupuesto.direccionObraAltura.trim() === '') {
              presupuesto.direccionObraAltura = 'S/N';
            }
          }

          console.log('🔍 DATOS COMPLETOS QUE SE ENVÍAN AL BACKEND PARA CREAR NUEVA VERSIÓN:');
          console.log('📋 Campos básicos:', {
            numeroPresupuesto: presupuesto.numeroPresupuesto,
            numeroVersion: presupuesto.numeroVersion,
            estado: presupuesto.estado,
            nombreObra: presupuesto.nombreObra,
            totalGeneral: presupuesto.totalGeneral
          });
          console.log('📦 itemsCalculadora:', presupuesto.itemsCalculadora?.length || 0, 'items');
          if (presupuesto.itemsCalculadora && presupuesto.itemsCalculadora.length > 0) {
            presupuesto.itemsCalculadora.forEach((item, idx) => {
              console.log(`  Item ${idx + 1}:`, {
                tipoProfesional: item.tipoProfesional,
                cantidadJornales: item.cantidadJornales,
                importeJornal: item.importeJornal,
                subtotal: item.subtotal
              });
            });
          }
          console.log('🧱 materialesJson:', presupuesto.materialesJson ? 'SÍ PRESENTE' : 'VACÍO/NULL');
          console.log('💰 otrosCostosJson:', presupuesto.otrosCostosJson ? 'SÍ PRESENTE' : 'VACÍO/NULL');
          console.log('📊 Jornales:', {
            honorariosJornalesActivo: presupuesto.honorariosJornalesActivo,
            honorariosJornalesTipo: presupuesto.honorariosJornalesTipo,
            honorariosJornalesValor: presupuesto.honorariosJornalesValor,
            mayoresCostosJornalesActivo: presupuesto.mayoresCostosJornalesActivo,
            mayoresCostosJornalesTipo: presupuesto.mayoresCostosJornalesTipo,
            mayoresCostosJornalesValor: presupuesto.mayoresCostosJornalesValor
          });

          const respuesta = await api.presupuestosNoCliente.create(presupuesto, empresaId);

          // Verificar si se copiaron items calculadora
          const itemsHeredados = respuesta?.itemsCalculadora?.length || presupuesto.itemsCalculadora?.length || 0;

          const mensajeObra = presupuestoData.obraId
            ? ' La obra asociada a la versión anterior fue eliminada.'
            : '';

          const mensajeItems = itemsHeredados > 0
            ? ` Se ${itemsHeredados === 1 ? 'heredó 1 grupo de tareas' : `heredaron ${itemsHeredados} grupos de tareas`} de la versión anterior.`
            : '';

          const mensajeEstado = preservarEstado
            ? ` Estado preservado: "${estadoOriginal}".`
            : ' Estado: "A Enviar".';

          showNotification && showNotification(
            `✅ Nueva versión ${nuevaVersion} creada.${mensajeEstado}${mensajeItems}${mensajeObra}`,
            'success'
          );
        } else {
          // === ACTUALIZAR SIN CREAR NUEVA VERSIÓN ===
          // SEMANAL: Siempre actualiza la misma versión (cualquier estado)
          // TRADICIONAL: Solo BORRADOR actualiza la misma versión

          // Mantener el ID y estado original
          presupuesto.id = presupuestoData.id;
          presupuesto.estado = estadoOriginal; // Mantener estado original
          presupuesto.numeroVersion = presupuestoData.numeroVersion || presupuestoData.version || 1;
          presupuesto.numeroPresupuesto = presupuestoData.numeroPresupuesto;

          delete presupuesto._shouldCreateNewVersion; // Limpiar flag interno
          delete presupuesto._preservarEstado; // Limpiar flag interno

          // ✅ UX MEJORADA: Si tiene nombreObra pero falta calle/altura, usar valores genéricos
          if (presupuesto.nombreObra && presupuesto.nombreObra.trim() !== '') {
            if (!presupuesto.direccionObraCalle || presupuesto.direccionObraCalle.trim() === '') {
              presupuesto.direccionObraCalle = 'Calle genérica';
            }
            if (!presupuesto.direccionObraAltura || presupuesto.direccionObraAltura.trim() === '') {
              presupuesto.direccionObraAltura = 'S/N';
            }
          }

          // Actualizar el presupuesto existente usando el endpoint PUT por ID
          await api.presupuestosNoCliente.update(presupuestoData.id, presupuesto, empresaId);

          showNotification && showNotification(
            `✅ Presupuesto ${esSemanal ? 'semanal' : 'tradicional'} actualizado (v${presupuesto.numeroVersion}, estado: ${estadoOriginal})`,
            'success'
          );
        }

        // Cerrar el modal después de editar
        setShowEditarModal(false);
        setPresupuestoData(null);

      } else {
        // ✅ CREACIÓN NUEVA: crear primera versión

        // Asegurar que no tenga ID (por si viene del modal con algún valor residual)
        delete presupuesto.id;

        // Asegurar que tenga tipoPresupuesto (por defecto TRADICIONAL)
        if (!presupuesto.tipoPresupuesto) {
          presupuesto.tipoPresupuesto = 'TRADICIONAL';
        }

        presupuesto.version = 1;
        presupuesto.numeroVersion = 1;

        // Determinar estado inicial según el tipo de presupuesto
        const esSemanal = presupuesto.tipoPresupuesto === 'TRABAJOS_SEMANALES';
        presupuesto.estado = esSemanal ? 'OBRA_A_CONFIRMAR' : 'BORRADOR';
        presupuesto.obraId = null; // No tiene obra asociada

        // ✅ UX MEJORADA: Si tiene nombreObra pero falta calle/altura, usar valores genéricos
        if (presupuesto.nombreObra && presupuesto.nombreObra.trim() !== '') {
          if (!presupuesto.direccionObraCalle || String(presupuesto.direccionObraCalle).trim() === '') {
            presupuesto.direccionObraCalle = 'Calle genérica';
          }
          if (!presupuesto.direccionObraAltura || String(presupuesto.direccionObraAltura).trim() === '') {
            presupuesto.direccionObraAltura = 'S/N';
          }
        }

        console.log('📤 Enviando presupuesto nuevo al backend...');
        const respuesta = await api.presupuestosNoCliente.create(presupuesto, empresaId);
        const presupuestoCreado = respuesta;

        // Para presupuestos semanales, mostrar mensaje informativo
        if (esSemanal) {
          showNotification && showNotification(
            `Presupuesto semanal creado correctamente.\nApruébalo para crear automáticamente el cliente y la obra.`,
            'success'
          );
        } else {
          showNotification && showNotification(
            `Presupuesto tradicional creado correctamente (${presupuesto.estado})`,
            'success'
          );
        }

        // Cerrar el modal de creación
        setShowNuevoModal(false);
        setShowEditarModal(false);
        setPresupuestoData(null);
      }

      // Recargar la lista para mostrar el presupuesto recién creado/modificado
      await loadList();
    } catch (error) {
      console.error('❌ ERROR AL GUARDAR PRESUPUESTO:', error);
      console.error('❌ ERROR COMPLETO:', JSON.stringify(error, null, 2));
      console.error('❌ ERROR RESPONSE:', error.response);
      console.error('❌ ERROR RESPONSE DATA:', error.response?.data);
      console.error('❌ ERROR STATUS:', error.response?.status);
      console.error('❌ ERROR HEADERS:', error.response?.headers);

      // Extraer el mensaje de error del backend
      let mensajeError = 'Error desconocido';

      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          mensajeError = error.response.data;
        } else if (error.response.data.message) {
          mensajeError = error.response.data.message;
        } else if (error.response.data.error) {
          mensajeError = error.response.data.error;
        } else {
          mensajeError = JSON.stringify(error.response.data);
        }
      } else if (error.response) {
        mensajeError = `Error ${error.response.status}: ${error.response.statusText || 'Error del servidor'}`;
      } else if (error.message) {
        mensajeError = error.message;
      }

      showNotification && showNotification(
        `❌ Error al guardar presupuesto:\n\n${mensajeError}`,
        'danger'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSeleccionarPresupuestoDelListado = (presupuesto) => {
    setPresupuestoData(presupuesto);
    setShowListarModal(false);
    setTimeout(() => {
      setShowEditarModal(true);
    }, 100);
  };

  // Marcar presupuesto como listo para enviar (BORRADOR → A_ENVIAR)
  // Solo para presupuestos TRADICIONALES
  const handleMarcarListoParaEnviar = async () => {
    if (!selectedId) {
      showNotification && showNotification('Seleccione un presupuesto primero', 'warning');
      return;
    }

    const presupuesto = list.find(p => p.id === selectedId);

    if (!presupuesto) {
      showNotification && showNotification('Presupuesto no encontrado', 'error');
      return;
    }

    // Validar que sea presupuesto TRADICIONAL
    if (presupuesto.tipoPresupuesto !== 'TRADICIONAL') {
      showNotification && showNotification(
        'Esta acción solo aplica a presupuestos TRADICIONALES',
        'warning'
      );
      return;
    }

    if (presupuesto.estado !== 'BORRADOR') {
      showNotification && showNotification(
        `Este presupuesto ya está en estado ${presupuesto.estado}`,
        'warning'
      );
      return;
    }

    try {
      await api.presupuestosNoCliente.actualizarEstado(presupuesto.id, 'A_ENVIAR', empresaId);
      showNotification && showNotification(
        '✅ Presupuesto marcado como "Listo para Enviar"', 'success'
      );
      await loadList();
    } catch (error) {
      showNotification && showNotification(
        'Error al marcar presupuesto: ' + error.message,
        'error'
      );
    }
  };

  // Ver presupuesto seleccionado en modo SOLO LECTURA
  const handleVerPresupuestoSeleccionado = async () => {
    if (!selectedId) {
      showNotification && showNotification('Seleccione un presupuesto primero', 'warning');
      return;
    }

    try {
      const presupuesto = await api.presupuestosNoCliente.getById(selectedId, empresaId);
      // FORZAR modo solo lectura mediante la propiedad _soloLectura
      presupuesto._soloLectura = true;
      setPresupuestoData(presupuesto);
      setShowEditarModal(true);
    } catch (error) {
      showNotification && showNotification(
        'Error al cargar presupuesto: ' + error.message,
        'error'
      );
    }
  };

  // Editar solo fechas (disponible para cualquier estado)
  const handleEditarSoloFechas = async () => {
    if (!selectedId) {
      showNotification && showNotification('Seleccione un presupuesto primero', 'warning');
      return;
    }

    try {
      const presupuesto = await api.presupuestosNoCliente.getById(selectedId, empresaId);

      // Marcar con flag especial para modo edición limitada
      presupuesto._editarSoloFechas = true;
      setPresupuestoData(presupuesto);
      setShowEditarModal(true);

      showNotification && showNotification(
        '📅 Modo edición de fechas: Solo puede modificar Fecha Probable de Inicio y Días Hábiles.\nLa versión y el estado se preservarán.',
        'info'
      );
    } catch (error) {
      showNotification && showNotification(
        'Error al cargar presupuesto: ' + error.message,
        'error'
      );
    }
  };

  // Enviar controles al Sidebar
  useEffect(() => {
    if (setPresupuestoControls) {
      const selectedPresupuesto = list.find(p => p.id === selectedId);

      setPresupuestoControls({
        selectedId,
        selectedPresupuesto,
        handleNuevo,
        handleEditar,
        handleListarTodos,
        handleBuscarPorDireccion,
        handleBuscarPorTipoProfesional,
        handleHistorialVersiones,
        handleEnviarPresupuesto,
        handleEliminar,
        handleAprobarYCrearObra,
        handleDuplicar,
        handleMarcarListoParaEnviar,
        handleVerPresupuestoSeleccionado,
        handleEditarSoloFechas
      });
    }

    // Cleanup al desmontar
    return () => {
      if (setPresupuestoControls) {
        setPresupuestoControls(null);
      }
    };
  }, [selectedId, setPresupuestoControls, list]);

  return (
    <div className="container-fluid fade-in" style={{padding: '0'}} onClick={() => setSelectedId(null)}>
      <div className="d-flex justify-content-between align-items-center mb-3" style={{padding: '0 15px'}}>
        <div className="d-flex align-items-center gap-3">
          <h3 className="mb-0"><i className="fas fa-file-signature me-2"></i>Presupuestos</h3>
          {tieneFiltrosPorDefecto && (
            <span
              className="badge bg-info"
              title="Hay filtros configurados por defecto"
              style={{ fontSize: '14px', padding: '8px 12px' }}
            >
              <i className="bi bi-bookmark-star-fill me-2"></i>
              {contarFiltrosActivos()} filtro{contarFiltrosActivos() !== 1 ? 's' : ''} activo{contarFiltrosActivos() !== 1 ? 's' : ''}
            </span>
          )}
          <span className="badge bg-secondary" style={{ fontSize: '14px', padding: '8px 12px' }}>
            <i className="fas fa-list me-2"></i>
            {list.length} presupuesto{list.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-primary"
            onClick={handleLimpiarFiltrosPorDefecto}
            title="Eliminar filtros y mostrar todos los presupuestos"
          >
            <i className="fas fa-list-ul me-2"></i>
            Mostrar Todos
          </button>
          <button
            className="btn btn-outline-secondary"
            onClick={() => setShowBuscarDireccionModal(true)}
            title="Abrir configuración de filtros para la carga inicial de esta página"
          >
            <i className="bi bi-gear-fill me-2"></i>
            Configurar Carga Inicial
          </button>
        </div>
      </div>

      <div className="card" onClick={(e) => e.stopPropagation()}>
        <div className="card-body" style={{padding: '0'}}>
          {loading ? (
            <div className="text-center py-4">
              <div className="spinner-border" role="status"><span className="visually-hidden">Cargando...</span></div>
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
                    <th style={{width: '120px'}} className="small">Solicitante</th>
                    <th style={{width: '130px'}} className="small">Nombre Obra</th>
                    <th className="small">Dirección</th>
                    <th style={{width: '90px'}} className="small">Inicio</th>
                    <th style={{width: '70px'}} className="small">Estado</th>
                    <th style={{width: '80px'}} className="small">Alertas</th>
                    <th style={{width: '110px'}} className="text-end small">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(row => {
                    const esEditable = esPresupuestoEditable(row);
                    const esSemanal = row.tipoPresupuesto === 'TRABAJOS_SEMANALES';
                    const alertaInicio = obtenerAlertaInicio(row);
                    const alertaFin = obtenerAlertaFinalizacion(row);
                    const rowId = row.id;
                    const isSelected = selectedId && rowId && selectedId === rowId;

                    return (
                    <tr
                      key={rowId}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Toggle: si ya está seleccionado, deseleccionar; si no, seleccionar
                        if (isSelected) {
                          setSelectedId(null);
                        } else {
                          setSelectedId(rowId);
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
                            : esSemanal
                              ? 'table-info'
                              : ''
                      }`}
                      title={esEditable
                        ? `Clic para seleccionar presupuesto ${row.numeroPresupuesto || rowId} - Editable`
                        : `Presupuesto ${row.numeroPresupuesto || rowId} - Solo lectura (${row.estado})`
                      }
                    >
                      <td className="small">
                        {isSelected && <i className="fas fa-check-circle text-success me-1" title="Seleccionado"></i>}
                        {row.numeroPresupuesto || '-'}
                        {row.tipoPresupuesto === 'TRABAJOS_SEMANALES' && <span className="badge bg-success ms-1" style={{fontSize: '0.7em', padding: '3px 5px'}} title="Trabajos Semanales">📅 Semanal</span>}
                        {row.tipoPresupuesto === 'TRADICIONAL' && <span className="badge bg-primary ms-1" style={{fontSize: '0.7em', padding: '3px 5px'}} title="Presupuesto Tradicional">🏗️ Tradicional</span>}
                      </td>
                      <td className="small text-center">{row.numeroVersion || '-'}</td>
                      <td className="small">{row.fechaEmision}</td>
                      <td className="small fw-bold text-dark">{row.nombreSolicitante || <span className="text-muted fst-italic fw-normal">Sin especificar</span>}</td>
                      <td className="small fw-bold text-dark">{row.nombreObra || <span className="text-muted fst-italic fw-normal">Sin especificar</span>}</td>
                      <td className="small" style={{minWidth: '150px', maxWidth: '250px'}}>
                        {row.direccionObraCalle ? (
                          <div>
                            <div className="fw-bold text-primary" style={{lineHeight: '1.3', wordBreak: 'break-word', fontSize: '0.9em'}}>
                              <i className="fas fa-map-marker-alt me-1"></i>
                              {row.direccionObraCalle} {row.direccionObraAltura || ''}
                              {row.direccionObraTorre && `, T${row.direccionObraTorre}`}
                              {row.direccionObraUnidad && `, U${row.direccionObraUnidad}`}
                              {row.direccionObraPiso && `, P${row.direccionObraPiso}`}
                              {row.direccionObraDepartamento && `, D${row.direccionObraDepartamento}`}
                            </div>
                            {(row.direccionObraBarrio || row.direccionObraCiudad || row.direccionObraProvincia || row.direccionObraCodigoPostal) && (
                              <div className="text-muted mt-1" style={{fontSize: '0.9em', lineHeight: '1.3'}}>
                                {[
                                  row.direccionObraBarrio,
                                  row.direccionObraCiudad,
                                  row.direccionObraProvincia,
                                  row.direccionObraCodigoPostal ? `CP ${row.direccionObraCodigoPostal}` : null
                                ].filter(Boolean).join(' • ')}
                              </div>
                            )}
                            {row.direccionObraObservaciones && (
                              <div className="text-info mt-1" style={{fontSize: '0.85em', fontStyle: 'italic'}}>
                                <i className="fas fa-info-circle me-1"></i>
                                {row.direccionObraObservaciones}
                              </div>
                            )}
                            {(row.direccionObraLatitud || row.direccionObraLongitud) && (
                              <div className="text-success mt-1" style={{fontSize: '0.8em'}}>
                                <i className="fas fa-crosshairs me-1"></i>
                                GPS: {row.direccionObraLatitud}, {row.direccionObraLongitud}
                              </div>
                            )}
                          </div>
                        ) : row.direccionParticular ? (
                          <div>
                            <div className="fw-bold text-secondary" style={{lineHeight: '1.4', wordBreak: 'break-word'}}>
                              <i className="fas fa-home me-1"></i>
                              {row.direccionParticular}
                            </div>
                          </div>
                        ) : (
                          <div className="text-muted fst-italic">
                            <i className="fas fa-question-circle me-1"></i>
                            Sin dirección especificada
                          </div>
                        )}
                      </td>
                      <td className="small text-center">{row.fechaProbableInicio || <span className="text-muted">—</span>}</td>
                      <td>
                        <span className={`badge ${getEstadoBadgeClass(row.estado)}`} style={{fontSize: '0.7em', padding: '3px 5px'}}>
                          {row.estado === 'OBRA_A_CONFIRMAR' ? (
                            <>
                              <i className="fas fa-clipboard-check me-1" title="Obra pendiente de confirmación"></i>
                              A CONFIRMAR
                            </>
                          ) : row.tipoPresupuesto === 'TRABAJOS_SEMANALES' && row.estado !== 'APROBADO' ? (
                            <>
                              <i className="fas fa-clipboard-check me-1" title="Pendiente de confirmación"></i>
                              A CONFIRMAR
                            </>
                          ) : row.estado === 'BORRADOR' ? (
                            <>
                              <i className="fas fa-pencil-alt me-1" title="En edición"></i>
                              {row.estado}
                              <i className="fas fa-arrow-right ms-1" title="Puedes marcarlo como listo"></i>
                            </>
                          ) : esPresupuestoEditable(row) ? (
                            <>
                              <i className="fas fa-edit me-1" title="Editable"></i>
                              {row.estado}
                            </>
                          ) : (
                            <>
                              <i className="fas fa-lock me-1" title="Solo lectura"></i>
                              {row.estado}
                            </>
                          )}
                        </span>
                      </td>
                      <td>
                        {alertaInicio && (
                          <div className={`badge bg-${alertaInicio.tipo} mb-1 d-block`} style={{fontSize: '0.65em', padding: '2px 4px'}} title={alertaInicio.detalle}>
                            {alertaInicio.icono} {alertaInicio.mensaje}
                          </div>
                        )}
                        {alertaFin && (
                          <div className={`badge bg-${alertaFin.tipo} d-block`} style={{fontSize: '0.65em', padding: '2px 4px'}} title={alertaFin.detalle}>
                            {alertaFin.icono} {alertaFin.mensaje}
                          </div>
                        )}
                        {!alertaInicio && !alertaFin && (row.estado === 'APROBADO' || row.estado === 'EN_EJECUCION') && !row.fechaProbableInicio && (
                          <span className="text-warning small" title="Complete la fecha de inicio para activar cambios automáticos">
                            ⚠️ Sin fecha
                          </span>
                        )}
                        {!alertaInicio && !alertaFin && !(row.estado === 'APROBADO' || row.estado === 'EN_EJECUCION') && (
                          <span className="text-muted small">—</span>
                        )}
                      </td>
                      <td className="text-end">
                        <div>
                          <div className="fw-bold text-primary">
                            {(() => {
                              // Usar el total que ya viene calculado del backend
                              const total = row.totalFinal || row.totalPresupuestoConHonorarios || row.totalGeneral || row.montoTotal || 0;

                              if (total && total > 0) {
                                return `$${Number(total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
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

      {/* Modal Nuevo Presupuesto */}
      {showNuevoModal && (
        <PresupuestoNoClienteModal
          show={showNuevoModal}
          onClose={() => {
            setShowNuevoModal(false);
            setPresupuestoData(null);
          }}
          onSave={async (presupuesto) => {
            await handleSavePresupuesto(presupuesto);
            setShowNuevoModal(false);
            setPresupuestoData(null);
            await loadList();
          }}
          initialData={null}
          saving={saving}
        />
      )}

      {/* Modal Editar Presupuesto - Solo mostrar cuando presupuestoData esté cargado */}
      {showEditarModal && presupuestoData?.id && (
        <PresupuestoNoClienteModal
          key={presupuestoData.id}
          show={showEditarModal}
          onClose={() => {
            setShowEditarModal(false);
            setPresupuestoData(null);
            setAutoGenerarPDF(false);
            setAbrirWhatsAppDespuesDePDF(false);
            setAbrirEmailDespuesDePDF(false);
            setForzarModoLectura(false);
          }}
          onSave={async (presupuesto) => {
            await handleSavePresupuesto(presupuesto);
            setShowEditarModal(false);
            setPresupuestoData(null);
            await loadList();
          }}
          initialData={presupuestoData}
          saving={saving}
          readOnly={forzarModoLectura || (presupuestoData && !esPresupuestoEditable(presupuestoData))}
          abrirWhatsAppDespuesDePDF={abrirWhatsAppDespuesDePDF}
          abrirEmailDespuesDePDF={abrirEmailDespuesDePDF}
          onPDFGenerado={() => {
            console.log('✅ PDF generado, cerrando modal de edición...');
            setAutoGenerarPDF(false);
            setAbrirWhatsAppDespuesDePDF(false);
            setAbrirEmailDespuesDePDF(false);
            setShowEditarModal(false); // Cerrar modal después de generar PDF
            setPresupuestoData(null); // Limpiar datos
            loadList(); // Recargar lista
          }}
        />
      )}

      {/* Modal Listar Todos */}
      {showListarModal && (
        <ListarTodosPresupuestosModal
          show={showListarModal}
          handleClose={() => setShowListarModal(false)}
          onSeleccionarPresupuesto={handleSeleccionarPresupuestoDelListado}
        />
      )}

      {/* Modal Búsqueda Avanzada */}
      {showBuscarDireccionModal && (
        <BusquedaAvanzadaPresupuestosModal
          show={showBuscarDireccionModal}
          onClose={() => setShowBuscarDireccionModal(false)}
          onSelectPresupuesto={handleSelectPresupuestoFromBusqueda}
          onFiltrosGuardados={handleFiltrosGuardados}
          onResultadosFiltrados={handleResultadosFiltrados}
        />
      )}

      {/* Modal Buscar por Tipo de Profesional */}
      {showBuscarPorTipoProfesionalModal && (
        <BuscarPorTipoProfesionalModal
          show={showBuscarPorTipoProfesionalModal}
          handleClose={() => setShowBuscarPorTipoProfesionalModal(false)}
          onSeleccionarPresupuesto={handleSelectPresupuestoFromBusqueda}
        />
      )}

      {/* Modal Historial de Versiones */}
      {showHistorialVersionesModal && (
        <HistorialVersionesPresupuestoNoClienteModal
          show={showHistorialVersionesModal}
          handleClose={() => setShowHistorialVersionesModal(false)}
        />
      )}

      {/* Modal Selección de Envío */}
      {mostrarModalSeleccionEnvio && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="fas fa-paper-plane me-2"></i>¿Cómo desea enviar el presupuesto?
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setMostrarModalSeleccionEnvio(false)}
                ></button>
              </div>
              <div className="modal-body text-center py-4">
                <p className="mb-4">Seleccione el método de envío:</p>
                <div className="d-grid gap-3">
                  <button
                    className="btn btn-success btn-lg"
                    onClick={() => handleConfirmarEnvio('whatsapp')}
                  >
                    <i className="fab fa-whatsapp me-2"></i>Enviar por WhatsApp
                  </button>
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={() => handleConfirmarEnvio('email')}
                  >
                    <i className="fas fa-envelope me-2"></i>Enviar por Email
                  </button>
                  <button
                    className="btn btn-secondary btn-lg"
                    onClick={() => setMostrarModalSeleccionEnvio(false)}
                  >
                    <i className="fas fa-times me-2"></i>Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Enviar Presupuesto */}
      {showEnviarPresupuestoModal && (
        <EnviarPresupuestoModal
          show={showEnviarPresupuestoModal}
          onClose={() => setShowEnviarPresupuestoModal(false)}
          presupuestoPreseleccionado={presupuestoData}
          onSuccess={() => {
            console.log('✅ Presupuesto enviado, cerrando modales y refrescando lista...');
            setShowEditarModal(false); // Cerrar modal de edición
            setPresupuestoData(null); // Limpiar datos
            fetchPresupuestos(); // Recargar lista
          }}
          onAbrirPresupuestoParaPDF={(presupuesto) => {
            console.log('📱 onAbrirPresupuestoParaPDF llamado - Configurando para WhatsApp', presupuesto.id);
            setShowEnviarPresupuestoModal(false);
            setPresupuestoData(presupuesto);
            setAutoGenerarPDF(true);
            setAbrirWhatsAppDespuesDePDF(true); // ✅ Activar flag de WhatsApp
            setAbrirEmailDespuesDePDF(false);
            console.log('📱 Estados seteados:', {
              autoGenerarPDF: true,
              abrirWhatsAppDespuesDePDF: true,
              abrirEmailDespuesDePDF: false
            });
            setShowEditarModal(true);
          }}
          onAbrirPresupuestoParaEmail={(presupuesto) => {
            setShowEnviarPresupuestoModal(false);
            setPresupuestoData(presupuesto);
            setAutoGenerarPDF(true);
            setAbrirWhatsAppDespuesDePDF(false);
            setAbrirEmailDespuesDePDF(true); // ✅ Activar flag de Email
            setShowEditarModal(true);
          }}
        />
      )}
    </div>
  );
};

export default PresupuestosNoClientePage;
