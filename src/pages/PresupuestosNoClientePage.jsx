import React, { useEffect, useState, useContext } from 'react';
import { useLocation } from 'react-router-dom';
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
import { calcularTotalConDescuentosDesdeItems } from '../utils/presupuestoDescuentosUtils';


const PresupuestosNoClientePage = ({ showNotification }) => {
  const location = useLocation();
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

  // 🎨 Función para ajustar brillo de un color (oscurecer/aclarar)
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
  const [showDownloadPdfButton, setShowDownloadPdfButton] = useState(false); // 🔥 Nuevo: para mostrar botón descarga PDF
  const [mostrarModalSeleccionEnvio, setMostrarModalSeleccionEnvio] = useState(false);
  // Estado para almacenar nombres de obras vinculadas a trabajos extra
  const [nombresObras, setNombresObras] = useState({});
  // Estado para almacenar relación obraId -> numeroPresupuesto padre
  const [mapObraAPresupuesto, setMapObraAPresupuesto] = useState({});
  // Mapa: extra.obraId -> obraOrigenId (obra padre) — para vincular sub-obras al presupuesto principal
  const [obraOrigenIdMap, setObraOrigenIdMap] = useState({});

  // Colapso de subgrupos de Adicionales Obra por presupuesto: { 'adicionales_ID': bool }
  const [gruposColapsados, setGruposColapsados] = useState({});

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

  // Mapa: presupuestoId (principal) -> { adicionalesObra }
  // Adicionales Obra = presupuestosNoCliente con esPresupuestoTrabajoExtra=true
  // Vinculo en orden de prioridad:
  //   1) mismo obraId directo
  //   2) obraOrigenIdMap[extra.obraId] == principal.obraId  (campo backend si está disponible)
  //   3) nombre del extra empieza con nombre del principal + espacio  (igual que ObrasPage)
  //   4) mismo clienteId como fallback final
  const { gruposMap, extrasEnSubgrupoIds } = React.useMemo(() => {
    const map = {};
    const cubiertos = new Set();
    const extras = list.filter(p => p.esPresupuestoTrabajoExtra);
    const principals = list.filter(p => !p.esPresupuestoTrabajoExtra);

    principals.forEach(principal => {
      // 1. Match directo por obraId (mismo presupuesto aprobó la misma obra)
      const porObraDirecta = principal.obraId
        ? extras.filter(e => !cubiertos.has(e.id) && Number(e.obraId) === Number(principal.obraId))
        : [];
      porObraDirecta.forEach(e => cubiertos.add(e.id));

      // 2. Match via obraOrigenIdMap (campo backend, cuando esté disponible)
      const porObraOrigen = principal.obraId
        ? extras.filter(e => {
            if (cubiertos.has(e.id)) return false;
            const origenId = obraOrigenIdMap[e.obraId];
            return origenId != null && Number(origenId) === Number(principal.obraId);
          })
        : [];
      porObraOrigen.forEach(e => cubiertos.add(e.id));

      // 3. Match por nombre: igual que ObrasPage
      //    si nombreExtra empieza con nombrePrincipal + ' ' → es sub-obra
      const nombrePrincipal = (principal.nombreObra || '').trim();
      const porNombre = nombrePrincipal
        ? extras.filter(e => {
            if (cubiertos.has(e.id)) return false;
            const nombreExtra = (e.nombreObra || '').trim();
            return nombreExtra.startsWith(nombrePrincipal + ' ');
          })
        : [];
      porNombre.forEach(e => cubiertos.add(e.id));

      // 4. Match por clienteId como fallback
      const porClienteId = principal.clienteId
        ? extras.filter(e =>
            !cubiertos.has(e.id) &&
            Number(e.clienteId) === Number(principal.clienteId)
          )
        : [];
      porClienteId.forEach(e => cubiertos.add(e.id));

      map[principal.id] = { adicionalesObra: [...porObraDirecta, ...porObraOrigen, ...porNombre, ...porClienteId] };
    });
    return { gruposMap: map, extrasEnSubgrupoIds: cubiertos };
  }, [list, obraOrigenIdMap]);

  const loadList = async (forceNoCache = false) => {
    if (!empresaId) return;
    setLoading(true);
    try {
      // El backend filtra automáticamente con Hibernate Filter
      // Si forceNoCache=true, agregar timestamp para evitar caché del navegador
      const filtrosCache = forceNoCache ? { _t: Date.now() } : null;
      const datos = await apiService.presupuestosNoCliente.getAll(empresaId, filtrosCache);
      console.log('📊 DATOS RECIBIDOS DEL BACKEND:', {
        tipoDatos: typeof datos,
        esArray: Array.isArray(datos),
        cantidad: Array.isArray(datos) ? datos.length : 'No es array',
        tieneContent: datos?.content ? true : false,
        cantidadContent: datos?.content?.length || 0,
        tieneDatos: datos?.datos ? true : false,
        cantidadDatos: datos?.datos?.length || 0
      });

      const lista = Array.isArray(datos) ? datos : (datos.datos || datos.content || []);
      console.log('📋 LISTA DE PRESUPUESTOS EXTRAÍDA:', lista.length, 'presupuestos');
      console.table(lista.map(p => ({
        ID: p.id,
        Numero: p.numeroPresupuesto,
        Version: p.numeroVersion || p.version || 1,
        Estado: p.estado
      })));

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
      console.log('🔢 PRESUPUESTOS AGRUPADOS POR NÚMERO:', Object.keys(presupuestosPorNumero).length, 'grupos');

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
      console.log('✅ LISTA FILTRADA (solo últimas versiones):', listaFiltrada.length, 'presupuestos');

      // 🔧 Recuperar clienteId perdido en versiones más recientes
      // A veces versiones nuevas tienen clienteId=null aunque versiones anteriores lo tenían.
      // Construimos un mapa numeroPresupuesto → clienteId a partir de TODAS las versiones.
      const clienteIdPorNumero = {};
      lista.forEach(p => {
        if (p.numeroPresupuesto != null && p.clienteId) {
          clienteIdPorNumero[p.numeroPresupuesto] = p.clienteId;
        }
      });
      // Aplicar la recuperación a la lista filtrada
      listaFiltrada.forEach((p, i) => {
        if (!p.clienteId && clienteIdPorNumero[p.numeroPresupuesto]) {
          listaFiltrada[i] = { ...p, clienteId: clienteIdPorNumero[p.numeroPresupuesto] };
        }
      });

      // 🔧 Cargar todas las obras de la empresa (una sola llamada)
      // Usamos getAll porque el endpoint /obras/todas retorna campos completos incluyendo obraOrigenId
      const obrasIds = listaFiltrada
        .filter(p => p.esPresupuestoTrabajoExtra && p.obraId)
        .map(p => p.obraId);

      const mapObraAPresupuesto = {};
      const obraOrigenIdMapTemp = {}; // Mapa: extra.obraId -> obraOrigenId (obra padre)

      if (obrasIds.length > 0) {
        try {
          const todasLasObras = await apiService.obras.getAll(empresaId);
          const obrasArray = Array.isArray(todasLasObras) ? todasLasObras : (todasLasObras?.datos || todasLasObras?.content || []);

          const nombresObrasTemp = {};
          obrasArray.forEach(obra => {
            const obraId = obra.id || obra.obraId;
            if (!obrasIds.includes(obraId)) return;

            nombresObrasTemp[obraId] = obra.nombre || obra.nombreObra || `Obra #${obraId}`;

            // Capturar obraOrigenId para construir el vínculo con el principal
            const origenId = obra.obraOrigenId || obra.obra_origen_id || obra.obraOrigen?.id || null;
            if (origenId) {
              obraOrigenIdMapTemp[obraId] = Number(origenId);
            }
          });

          console.log('🗺️ obraOrigenIdMap (getAll):', obraOrigenIdMapTemp);
          setNombresObras(nombresObrasTemp);
          setObraOrigenIdMap(obraOrigenIdMapTemp);
        } catch (error) {
          console.warn('⚠️ No se pudieron cargar obras:', error);
        }
      }

      const presupuestosCompletos = await Promise.all(
        listaFiltrada.map(async (p) => {
          try {
            const completo = await apiService.presupuestosNoCliente.getById(p.id, empresaId, forceNoCache);

            // Verificar si los datos vienen con flag de error del backend
            if (completo._errorBackend) {
              return { ...p, _errorBackend: true };
            }

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
            // En lugar de fallar, usar datos de la lista original
            return { ...p, _loadError: true };
          }
        })
      );
      console.log('📦 PRESUPUESTOS COMPLETOS CARGADOS:', presupuestosCompletos.length);
      console.log('⚠️ PRESUPUESTOS CON ERRORES:', presupuestosCompletos.filter(p => p._loadError || p._errorBackend).length);

      // 🎯 AGRUPACIÓN INTELIGENTE: Agrupar por obra_id (presupuestos aprobados + trabajos extra) O por cliente_id
      console.log('🎯 INICIANDO AGRUPACIÓN de', presupuestosCompletos.length, 'presupuestos');
      console.table(presupuestosCompletos.map(p => ({
        ID: p.id,
        Numero: p.numeroPresupuesto,
        Nombre: p.nombreObra,
        TrabajoExtra: p.esPresupuestoTrabajoExtra ? 'SÍ' : 'NO',
        ObraId: p.obraId,
        ObraOrigenId: p.obraOrigenId || p.obra_origen_id || null,
        ClienteId: p.clienteId
      })));

      // 1. Agrupar presupuestos por obraId o por clienteId
      const gruposPorCliente = {};
      const gruposPorObra = {}; // 🆕 Para agrupar por obra (presupuestos aprobados + trabajos extra)
      const presupuestosSinCliente = [];

      // � Agrupar presupuestos
      // 🔧 Agrupar presupuestos - VERSIÓN CORREGIDA
      presupuestosCompletos.forEach(p => {
        // 🔧 Si tiene obraId (presupuesto aprobado que creó la obra, NO trabajo extra)
        if (p.obraId && !p.esPresupuestoTrabajoExtra) {
          const keyObra = `obra_${p.obraId}`;
          if (!gruposPorObra[keyObra]) {
            gruposPorObra[keyObra] = {
              tipo: 'obra',
              obraId: p.obraId,
              presupuestos: []
            };
          }
          gruposPorObra[keyObra].presupuestos.push(p);
        }
        // 🔧 Si NO tiene obraId, agrupar por clienteId
        else if (p.clienteId && !p.esPresupuestoTrabajoExtra) {
          if (!gruposPorCliente[p.clienteId]) {
            gruposPorCliente[p.clienteId] = {
              tipo: 'cliente',
              clienteId: p.clienteId,
              presupuestos: []
            };
          }
          gruposPorCliente[p.clienteId].presupuestos.push(p);
        }
        // 🆕 Si NO tiene ni obraId ni clienteId (presupuesto huérfano), agregar a sin cliente
        else if (!p.esPresupuestoTrabajoExtra) {
          presupuestosSinCliente.push(p);
        }
      });

      // 🆕 SEGUNDO PASO: Agregar trabajos extra a los grupos existentes
      presupuestosCompletos.forEach(p => {
        if (p.esPresupuestoTrabajoExtra) {
          let agregado = false;

          // Buscar grupo por obraId si existe
          if (p.obraId) {
            const keyObra = `obra_${p.obraId}`;
            if (gruposPorObra[keyObra]) {
              gruposPorObra[keyObra].presupuestos.push(p);
              agregado = true;
              return;
            }
          }

          // Si no encontró por obraId, buscar por clienteId
          if (!agregado && p.clienteId) {
            // Buscar un presupuesto padre del mismo cliente que tenga obra
            const presupuestoPadre = presupuestosCompletos.find(pp =>
              !pp.esPresupuestoTrabajoExtra && pp.clienteId === p.clienteId && pp.obraId
            );

            if (presupuestoPadre) {
              const keyObra = `obra_${presupuestoPadre.obraId}`;
              if (gruposPorObra[keyObra]) {
                gruposPorObra[keyObra].presupuestos.push(p);
                agregado = true;
                return;
              }
            }

            // Si no encuentra presupuesto padre con obra, agrupar por cliente
            if (gruposPorCliente[p.clienteId]) {
              gruposPorCliente[p.clienteId].presupuestos.push(p);
              agregado = true;
            } else {
              // Crear grupo de cliente si no existe
              gruposPorCliente[p.clienteId] = {
                tipo: 'cliente',
                clienteId: p.clienteId,
                presupuestos: [p]
              };
              agregado = true;
            }
          }

          // 🛡️ SEGURIDAD: Si el trabajo extra no se agregó a ningún grupo (huérfano sin obra ni cliente),
          // agregarlo a presupuestosSinCliente para que no se pierda
          if (!agregado) {
            console.warn('⚠️ Trabajo extra huérfano sin grupo:', {
              id: p.id,
              numero: p.numeroPresupuesto,
              nombre: p.nombreObra,
              obraId: p.obraId,
              clienteId: p.clienteId
            });
            presupuestosSinCliente.push(p);
          }
        }
      });

      console.log('📊 RESULTADO AGRUPACIÓN:');
      console.log('  - Grupos por Obra:', Object.keys(gruposPorObra).length, '→', Object.values(gruposPorObra).map(g => g.presupuestos.length));
      console.log('  - Grupos por Cliente:', Object.keys(gruposPorCliente).length, '→', Object.values(gruposPorCliente).map(g => g.presupuestos.length));
      console.log('  - Sin Cliente:', presupuestosSinCliente.length);
      const totalAgrupados =
        Object.values(gruposPorObra).reduce((sum, g) => sum + g.presupuestos.length, 0) +
        Object.values(gruposPorCliente).reduce((sum, g) => sum + g.presupuestos.length, 0) +
        presupuestosSinCliente.length;
      console.log('  - TOTAL AGRUPADOS:', totalAgrupados, 'de', presupuestosCompletos.length);
      if (totalAgrupados !== presupuestosCompletos.length) {
        console.error('❌ SE PERDIERON', presupuestosCompletos.length - totalAgrupados, 'PRESUPUESTOS EN LA AGRUPACIÓN');

        // Identificar cuáles se perdieron
        const agrupados = new Set();
        Object.values(gruposPorObra).forEach(g => g.presupuestos.forEach(p => agrupados.add(p.id)));
        Object.values(gruposPorCliente).forEach(g => g.presupuestos.forEach(p => agrupados.add(p.id)));
        presupuestosSinCliente.forEach(p => agrupados.add(p.id));

        const perdidos = presupuestosCompletos.filter(p => !agrupados.has(p.id));
        console.error('🚨 PRESUPUESTOS PERDIDOS:', perdidos.map(p => ({
          ID: p.id,
          Numero: p.numeroPresupuesto,
          Nombre: p.nombreObra,
          TrabajoExtra: p.esPresupuestoTrabajoExtra,
          ObraId: p.obraId,
          ClienteId: p.clienteId
        })));
      }

      // 2. Ordenar presupuestos dentro de cada grupo
      // IMPORTANTE: Presupuesto padre (NO trabajo extra) arriba, trabajos extra abajo
      Object.values(gruposPorCliente).forEach(grupo => {
        grupo.presupuestos.sort((a, b) => b.numeroPresupuesto - a.numeroPresupuesto);
      });
      Object.values(gruposPorObra).forEach(grupo => {
        grupo.presupuestos.sort((a, b) => {
          // Prioridad 1: Presupuestos padre (NO trabajo extra) primero
          if (!a.esPresupuestoTrabajoExtra && b.esPresupuestoTrabajoExtra) return -1;
          if (a.esPresupuestoTrabajoExtra && !b.esPresupuestoTrabajoExtra) return 1;
          // Prioridad 2: Si ambos son del mismo tipo, ordenar por número descendente
          return b.numeroPresupuesto - a.numeroPresupuesto;
        });
      });

      // 3. Ordenar grupos por el número de presupuesto más alto de cada grupo
      const gruposOrdenadosClientes = Object.entries(gruposPorCliente)
        .map(([clienteId, grupo]) => ({
          ...grupo,
          clienteId,
          maxNumeroPresupuesto: Math.max(...grupo.presupuestos.map(p => p.numeroPresupuesto || 0))
        }))
        .sort((a, b) => b.maxNumeroPresupuesto - a.maxNumeroPresupuesto);

      const gruposOrdenadosObras = Object.entries(gruposPorObra)
        .map(([keyObra, grupo]) => ({
          ...grupo,
          maxNumeroPresupuesto: Math.max(...grupo.presupuestos.map(p => p.numeroPresupuesto || 0))
        }))
        .sort((a, b) => b.maxNumeroPresupuesto - a.maxNumeroPresupuesto);

      // 4. Construir lista final con información de grupo
      const listaOrdenada = [];
      let grupoIndex = 0;

      // 🔧 Procesar grupos de clientes
      gruposOrdenadosClientes.forEach(grupo => {
        grupo.presupuestos.forEach((presupuesto, indexEnGrupo) => {
          // Agregar metadatos del grupo al presupuesto
          listaOrdenada.push({
            ...presupuesto,
            _grupoCliente: grupo.clienteId,
            _grupoTipo: 'cliente',
            _grupoIndex: grupoIndex,
            _primerEnGrupo: indexEnGrupo === 0,
            _ultimoEnGrupo: indexEnGrupo === grupo.presupuestos.length - 1,
            _totalEnGrupo: grupo.presupuestos.length
          });
        });

        grupoIndex++;
      });

      // 🔧 Procesar grupos de obras (trabajos extra)
      gruposOrdenadosObras.forEach(grupo => {
        grupo.presupuestos.forEach((presupuesto, indexEnGrupo) => {
          // Agregar metadatos del grupo al presupuesto
          listaOrdenada.push({
            ...presupuesto,
            _grupoObra: grupo.obraId,
            _grupoTipo: 'obra',
            _grupoIndex: grupoIndex + 2, // 🎨 Offset para sincronizar colores con página de Obras
            _primerEnGrupo: indexEnGrupo === 0,
            _ultimoEnGrupo: indexEnGrupo === grupo.presupuestos.length - 1,
            _totalEnGrupo: grupo.presupuestos.length
          });
        });

        grupoIndex++;
      });

      // 5. Agregar presupuestos sin cliente al final
      if (presupuestosSinCliente.length > 0) {
        presupuestosSinCliente.sort((a, b) => b.numeroPresupuesto - a.numeroPresupuesto);
        presupuestosSinCliente.forEach(p => {
          listaOrdenada.push({
            ...p,
            _grupoCliente: null,
            _grupoIndex: grupoIndex,
            _primerEnGrupo: true,
            _ultimoEnGrupo: true,
            _totalEnGrupo: 1
          });
          grupoIndex++;
        });
      }

      // Aplicar filtros de búsqueda
      console.log('🔍 ANTES DE FILTRAR - Lista ordenada:', listaOrdenada.length, 'presupuestos');
      console.table(listaOrdenada.map(p => ({
        ID: p.id,
        Numero: p.numeroPresupuesto,
        Version: p.numeroVersion || p.version || 1,
        Estado: p.estado,
        Nombre: p.nombreObra
      })));

      const listaConFiltrosBusqueda = listaOrdenada.filter(presupuesto => {
        // Si todos los filtros están vacíos, mostrar todos
        const hayFiltros = Object.values(filtros).some(v => v && v.toString().trim() !== '');
        console.log('🔍 Filtros activos:', hayFiltros, filtros);
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

  // ==================== AUTO-ABRIR PRESUPUESTO DESDE OBRAS ====================
  useEffect(() => {
    // Detectar si se navegó desde página de obras con un presupuesto para abrir
    if (location.state?.presupuestoId && location.state?.autoOpen && empresaId) {
      const presupuestoId = location.state.presupuestoId;
      const showDownloadPdf = location.state?.showDownloadPdf || false; // 🔥 Capturar flag
      console.log('🔗 Auto-abriendo presupuesto desde obras, ID:', presupuestoId, 'showDownloadPdf:', showDownloadPdf);

      // Guardar flag para mostrar botón descarga
      setShowDownloadPdfButton(showDownloadPdf);

      // Cargar y abrir el presupuesto automáticamente
      const cargarYAbrirPresupuesto = async () => {
        try {
          console.log('🔗 Auto-cargando presupuesto ID:', presupuestoId, 'sin caché...');
          const presupuesto = await api.presupuestosNoCliente.getById(presupuestoId, empresaId, true);

          console.log('📦 PRESUPUESTO AUTO-CARGADO:', {
            id: presupuesto.id,
            items_count: presupuesto.itemsCalculadoraJson?.length || 0,
            totalFinal: presupuesto.totalFinal
          });

          // Normalizar campos
          const presupuestoNormalizado = {
            ...presupuesto,
            obraId: presupuesto.obraId || presupuesto.idObra || null,
            clienteId: presupuesto.esPresupuestoTrabajoExtra ? null : (presupuesto.clienteId || presupuesto.idCliente || null)
          };

          // Seleccionar y abrir el modal de edición
          setSelectedId(presupuestoId);
          setPresupuestoData(presupuestoNormalizado);
          setShowEditarModal(true);
          console.log('✅ Presupuesto cargado y abierto automáticamente');
        } catch (error) {
          console.error('❌ Error al cargar presupuesto:', error);
          showNotification && showNotification(
            'Error al cargar el presupuesto: ' + (error.response?.data?.message || error.message),
            'error'
          );
        }
      };

      cargarYAbrirPresupuesto();

      // Limpiar el state para evitar re-aperturas al recargar
      window.history.replaceState({}, document.title);
    }
  }, [location.state, empresaId]);

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
      console.log('🔄 Cargando presupuesto ID:', selectedId, 'sin caché...');
      const presupuesto = await api.presupuestosNoCliente.getById(selectedId, empresaId, true);

      console.log('📦 PRESUPUESTO RECIBIDO DEL BACKEND:', {
        id: presupuesto.id,
        itemsCalculadoraJson_length: presupuesto.itemsCalculadoraJson?.length || 0,
        totales: {
          jornales: presupuesto.totalJornales,
          materiales: presupuesto.totalMateriales,
          honorarios: presupuesto.totalHonorarios,
          final: presupuesto.totalFinal
        },
        descuentos: presupuesto.descuentos,
        timestamp: new Date().toISOString()
      });

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
      // 🔧 Si es trabajo extra, NO cargar clienteId (solo debe tener obraId)
      const presupuestoNormalizado = {
        ...presupuesto,
        obraId: presupuesto.obraId || presupuesto.idObra || null,
        clienteId: presupuesto.esPresupuestoTrabajoExtra ? null : (presupuesto.clienteId || presupuesto.idCliente || null)
      };

      const debugNormalizado = {
        id: presupuestoNormalizado.id,
        obraId: presupuestoNormalizado.obraId,
        clienteId: presupuestoNormalizado.clienteId,
        esPresupuestoTrabajoExtra: presupuestoNormalizado.esPresupuestoTrabajoExtra,
        timestamp: new Date().toISOString()
      };
      window.DEBUG_PRESUPUESTO_NORMALIZADO = debugNormalizado;

      // Abrir modal en modo edición (SIN marcar _soloLectura)
      console.log('🚀 Abriendo modal con datos normalizados:', {
        id: presupuestoNormalizado.id,
        obraId: presupuestoNormalizado.obraId,
        clienteId: presupuestoNormalizado.clienteId,
        has_itemsCalculadoraJson: !!presupuestoNormalizado.itemsCalculadoraJson,
        items_count: presupuestoNormalizado.itemsCalculadoraJson?.length || 0
      });
      setPresupuestoData(presupuestoNormalizado);
      setShowEditarModal(true);

    } catch (error) {
      console.error('❌ Error al cargar presupuesto:', error.response?.data || error.message);

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

  const handleRecargarSinCache = () => {
    console.log('🔄 Recargando presupuestos SIN CACHÉ...');
    loadList(true);
    showNotification && showNotification('🔄 Recargando datos sin caché...', 'info');
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
      // Opción de envío elegida: tipo
      // Cargar el presupuesto completo y abrir el MISMO modal de edición
      const presupuestoCompleto = await api.presupuestosNoCliente.getById(selectedId, empresaId);

      // 🔧 Normalizar: Si es trabajo extra, NO cargar clienteId
      const presupuestoNormalizado = {
        ...presupuestoCompleto,
        obraId: presupuestoCompleto.obraId || presupuestoCompleto.idObra || null,
        clienteId: presupuestoCompleto.esPresupuestoTrabajoExtra ? null : (presupuestoCompleto.clienteId || presupuestoCompleto.idCliente || null)
      };

      setPresupuestoData(presupuestoNormalizado);

      if (tipo === 'whatsapp') {
        // ✅ ACTIVAR FLAGS PARA WHATSAPP
        setAutoGenerarPDF(true);
        setAbrirWhatsAppDespuesDePDF(true);
        setAbrirEmailDespuesDePDF(false);

        // Flags configurados para WhatsApp
      } else if (tipo === 'email') {
        // ✅ ACTIVAR FLAGS PARA EMAIL
        setAutoGenerarPDF(true);
        setAbrirWhatsAppDespuesDePDF(false);
        setAbrirEmailDespuesDePDF(true);

        // Flags configurados para Email
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

      // 🔧 Normalizar: Si es trabajo extra, NO cargar clienteId
      const presupuestoNormalizado = {
        ...presupuestoCompleto,
        obraId: presupuestoCompleto.obraId || presupuestoCompleto.idObra || null,
        clienteId: presupuestoCompleto.esPresupuestoTrabajoExtra ? null : (presupuestoCompleto.clienteId || presupuestoCompleto.idCliente || null)
      };

      setPresupuestoData(presupuestoNormalizado);
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
      const esTrabajoExtra = presupuestoActual.esPresupuestoTrabajoExtra === true ||
                             presupuestoActual.esPresupuestoTrabajoExtra === 'V' ||
                             presupuestoActual.esPresupuestoTrabajoExtra === 1;

      // 🔧 ESCENARIO ESPECIAL: TRABAJO EXTRA
      // Los trabajos extra SIEMPRE crean una nueva SUB-OBRA, incluso si ya tienen obraId (obra padre)
      // Ejemplo: Obra Padre "Cabañas de Tomas" → Trabajo Extra 1 crea Obra "Cabaña 1"
      //          Obra Padre "Cabañas de Tomas" → Trabajo Extra 2 crea Obra "Cabaña 2"
      if (esTrabajoExtra && tieneObraAsociada) {
        // Validar que tenga nombre de obra
        const tieneNombreObra = presupuestoActual.nombreObra && presupuestoActual.nombreObra.trim() !== '';

        if (!tieneNombreObra) {
          showNotification && showNotification(
            '⚠️ Error: El trabajo extra debe tener un NOMBRE DE OBRA\n\n' +
            'Ejemplo: "Cabaña 1", "Cabaña 2", "Ampliación Norte", etc.\n\n' +
            'Este nombre se usará para crear la sub-obra dentro de la obra padre.',
            'warning'
          );
          return;
        }

        const confirmar = window.confirm(
          `🔧 APROBAR TRABAJO EXTRA y CREAR SUB-OBRA\n\n` +
          `Presupuesto: #${presupuestoActual.numeroPresupuesto} v${presupuestoActual.numeroVersion}\n` +
          `Nombre de sub-obra: "${presupuestoActual.nombreObra}"\n` +
          `Obra padre: ID ${presupuestoActual.obraId}\n` +
          `Monto: $${(presupuestoActual.totalFinal || presupuestoActual.montoTotal || 0).toLocaleString('es-AR')}\n\n` +
          `Se creará una NUEVA OBRA vinculada a la obra padre.\n` +
          `Esta sub-obra tendrá sus propios:\n` +
          `  ✓ Profesionales y jornales\n` +
          `  ✓ Materiales\n` +
          `  ✓ Gastos generales\n` +
          `  ✓ Control de costos independiente\n\n` +
          `¿Desea continuar?`
        );

        if (!confirmar) return;

        // Llamar al endpoint - el backend debe crear SUB-OBRA
        const response = await api.post(
          `/api/v1/presupuestos-no-cliente/${selectedId}/aprobar-y-crear-obra`,
          {},
          {
            params: { empresaId },
            headers: { 'X-Tenant-ID': empresaId, 'Content-Type': 'application/json' }
          }
        );

        const respuestaData = response.data || response;
        const nuevaObraId = respuestaData?.obraId || respuestaData?.id;
        const mensaje = respuestaData?.mensaje || respuestaData?.message;

        showNotification && showNotification(
          mensaje || `✅ Trabajo Extra aprobado\n🏗️ Sub-obra "${presupuestoActual.nombreObra}" creada (ID: ${nuevaObraId})\n📎 Vinculada a obra padre ID: ${presupuestoActual.obraId}`,
          'success'
        );

        loadList();
        return;
      }

      // ESCENARIO 1: Presupuesto normal CON obra ya asignada → Solo aprobar (sin crear nada)
      // Esto aplica SOLO para presupuestos que NO son trabajos extra
      if (tieneObraAsociada && !esTrabajoExtra) {
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

    // 🔍 DEBUG CRÍTICO: Verificar datos que llegan
    console.log('🔴🔴🔴 [handleSavePresupuesto] DIAGNÓSTICO CRÍTICO 🔴🔴🔴');
    console.log('🔍 presupuesto.id:', presupuesto.id);
    console.log('🔍 presupuestoData?.id:', presupuestoData?.id);
    console.log('🔍 esEdicion será:', presupuestoData?.id != null);
    console.log('🔍 Campos críticos del presupuesto:', {
      id: presupuesto.id,
      version: presupuesto.version,
      numeroVersion: presupuesto.numeroVersion,
      estado: presupuesto.estado,
      totalPresupuesto: presupuesto.totalPresupuesto,
      cantidadItems: presupuesto.itemsCalculadora?.length
    });
    console.log('🔴🔴🔴 [FIN DIAGNÓSTICO] 🔴🔴🔴');

    try {
      // ✅ CASO ESPECIAL: Edición solo de fechas (cualquier estado)
      if (presupuesto._editarSoloFechas === true) {
        // FLUJO EDITAR SOLO FECHAS

        try {
          // Usar PUT completo para asegurar persistencia en BD
          // Obtener el presupuesto completo actualizado
          const presupuestoCompleto = await api.presupuestosNoCliente.getById(presupuesto.id, empresaId);

          // Actualizar solo las fechas manteniendo todo lo demás igual
          const presupuestoActualizado = {
            ...presupuestoCompleto,
            fechaProbableInicio: presupuesto.fechaProbableInicio,
            tiempoEstimadoTerminacion: presupuesto.tiempoEstimadoTerminacion
          };

          await api.presupuestosNoCliente.update(presupuesto.id, presupuestoActualizado, empresaId);

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
        // ✅ EDICIÓN: Simplemente actualizar la versión existente sin crear nuevas versiones
        // NUEVO COMPORTAMIENTO: Todos los estados se actualizan sin crear versiones nuevas
        // Esto evita problemas de datos vacíos y mantiene la consistencia

        const estadoOriginal = presupuestoData.estado;
        const esSemanal = presupuestoData.tipoPresupuesto === 'TRABAJOS_SEMANALES';

        // 🔥 CAMBIO CRÍTICO: Ya NO creamos nuevas versiones automáticamente
        // Simplemente actualizamos la versión existente para evitar problemas de datos vacíos
        console.log(`📝 Actualizando presupuesto ID ${presupuestoData.id} (v${presupuestoData.version || 1}) - Estado: ${estadoOriginal}`);

        // === ACTUALIZAR SIN CREAR NUEVA VERSIÓN ===
        // TODOS los estados ahora actualizan la misma versión (sin crear nuevas)

        // Mantener el ID y estado original
        presupuesto.id = presupuestoData.id;
        presupuesto.estado = estadoOriginal; // Mantener estado original
        presupuesto.numeroVersion = presupuestoData.numeroVersion || presupuestoData.version || 1;
        presupuesto.numeroPresupuesto = presupuestoData.numeroPresupuesto;

        // 🔧 CRÍTICO: Preservar esPresupuestoTrabajoExtra e idObra del presupuesto original
        if (presupuestoData.esPresupuestoTrabajoExtra) {
          presupuesto.esPresupuestoTrabajoExtra = true;
        }
        if (presupuestoData.idObra || presupuestoData.obraId) {
          presupuesto.idObra = presupuestoData.idObra || presupuestoData.obraId;
          presupuesto.obraId = presupuestoData.idObra || presupuestoData.obraId;
        }

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

        // 🔥 SOLUCIÓN CRÍTICA: El backend requiere el objeto COMPLETO
        // Obtener primero el presupuesto completo del backend y hacer merge
        console.log(`📥 Obteniendo presupuesto completo del backend antes de actualizar...`);
        const presupuestoCompleto = await api.presupuestosNoCliente.getById(presupuestoData.id, empresaId);
        console.log(`✅ Presupuesto completo obtenido:`, presupuestoCompleto);

        // Hacer merge: presupuestoCompleto (todos los campos) + presupuesto (cambios del usuario)
        const presupuestoFinal = {
          ...presupuestoCompleto,  // ← Todos los campos existentes del backend
          ...presupuesto,          // ← Cambios del usuario (sobrescribe solo lo que cambió)
          id: presupuestoData.id,  // ← Asegurar que el ID se mantiene
          numeroVersion: presupuestoCompleto.numeroVersion || presupuestoCompleto.version || 1,
          estado: presupuestoCompleto.estado // ← Preservar el estado a menos que se haya cambiado explícitamente
        };

        console.log(`📤 Enviando presupuesto COMPLETO con merge al backend:`, {
          id: presupuestoFinal.id,
          cantidadCampos: Object.keys(presupuestoFinal).length,
          totalPresupuesto: presupuestoFinal.totalPresupuesto,
          cantidadItems: presupuestoFinal.itemsCalculadora?.length
        });

        // Actualizar el presupuesto existente usando el endpoint PUT por ID
        await api.presupuestosNoCliente.update(presupuestoData.id, presupuestoFinal, empresaId);

        showNotification && showNotification(
          `✅ Presupuesto actualizado correctamente (v${presupuesto.numeroVersion}) - Todos los datos se mantuvieron`,
          'success'
        );

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

        // 🔧 IMPORTANTE: NO anular obraId si es trabajo extra (debe preservarse)
        // Solo anularlo si NO es trabajo extra
        if (!presupuesto.esPresupuestoTrabajoExtra) {
          presupuesto.obraId = null; // No tiene obra asociada (presupuesto normal)
        }
        // Si ES trabajo extra, mantener el obraId que viene del form

        // ✅ UX MEJORADA: Si tiene nombreObra pero falta calle/altura, usar valores genéricos
        if (presupuesto.nombreObra && presupuesto.nombreObra.trim() !== '') {
          if (!presupuesto.direccionObraCalle || String(presupuesto.direccionObraCalle).trim() === '') {
            presupuesto.direccionObraCalle = 'Calle genérica';
          }
          if (!presupuesto.direccionObraAltura || String(presupuesto.direccionObraAltura).trim() === '') {
            presupuesto.direccionObraAltura = 'S/N';
          }
        }

        console.log('� [CREATE] Campos trabajo extra que se envían:', {
          esPresupuestoTrabajoExtra: presupuesto.esPresupuestoTrabajoExtra,
          idObra: presupuesto.idObra,
          obraId: presupuesto.obraId
        });

        console.log('�📤 Enviando presupuesto nuevo al backend...');
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
      console.error('❌ ERROR AL GUARDAR PRESUPUESTO:', error.response?.data || error.message);

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
    // 🔧 Normalizar: Si es trabajo extra, NO cargar clienteId
    const presupuestoNormalizado = {
      ...presupuesto,
      obraId: presupuesto.obraId || presupuesto.idObra || null,
      clienteId: presupuesto.esPresupuestoTrabajoExtra ? null : (presupuesto.clienteId || presupuesto.idCliente || null)
    };

    setPresupuestoData(presupuestoNormalizado);
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
  // Abrir un presupuesto adicional (trabajo extra) en el modal de edición
  // Sirve para abrir Adicionales Obra (presupuestosNoCliente con esPresupuestoTrabajoExtra=true)
  const handleAbrirAdicionalObra = async (presupuestoId) => {
    if (!presupuestoId) {
      showNotification && showNotification('Este ítem no tiene presupuesto vinculado', 'warning');
      return;
    }
    try {
      const presupuesto = await api.presupuestosNoCliente.getById(presupuestoId, empresaId);
      const presupuestoNormalizado = {
        ...presupuesto,
        obraId: presupuesto.obraId || presupuesto.idObra || null,
        clienteId: presupuesto.esPresupuestoTrabajoExtra ? null : (presupuesto.clienteId || presupuesto.idCliente || null)
      };
      setPresupuestoData(presupuestoNormalizado);
      setForzarModoLectura(false);
      setShowEditarModal(true);
    } catch (error) {
      showNotification && showNotification('Error al cargar presupuesto: ' + error.message, 'error');
    }
  };

  const handleVerPresupuestoSeleccionado = async () => {
    if (!selectedId) {
      showNotification && showNotification('Seleccione un presupuesto primero', 'warning');
      return;
    }

    try {
      console.log('👁️ Cargando presupuesto (solo lectura) ID:', selectedId, 'sin caché...');
      const presupuesto = await api.presupuestosNoCliente.getById(selectedId, empresaId, true);

      console.log('📦 PRESUPUESTO CARGADO (vista):', {
        id: presupuesto.id,
        items_count: presupuesto.itemsCalculadoraJson?.length || 0,
        totalFinal: presupuesto.totalFinal
      });

      // 🔧 Normalizar: Si es trabajo extra, NO cargar clienteId
      const presupuestoNormalizado = {
        ...presupuesto,
        obraId: presupuesto.obraId || presupuesto.idObra || null,
        clienteId: presupuesto.esPresupuestoTrabajoExtra ? null : (presupuesto.clienteId || presupuesto.idCliente || null),
        _soloLectura: true // FORZAR modo solo lectura
      };

      setPresupuestoData(presupuestoNormalizado);
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
      console.log('📅 Cargando presupuesto (editar fechas) ID:', selectedId, 'sin caché...');
      const presupuesto = await api.presupuestosNoCliente.getById(selectedId, empresaId, true);

      // 🔧 Normalizar: Si es trabajo extra, NO cargar clienteId
      const presupuestoNormalizado = {
        ...presupuesto,
        obraId: presupuesto.obraId || presupuesto.idObra || null,
        clienteId: presupuesto.esPresupuestoTrabajoExtra ? null : (presupuesto.clienteId || presupuesto.idCliente || null),
        _editarSoloFechas: true // Marcar con flag especial para modo edición limitada
      };

      setPresupuestoData(presupuestoNormalizado);
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
    <>
      {/* Estilos personalizados para hover celeste */}
      <style>{`
        .table-hover tbody tr:hover td {
          background-color: #d1ecf1 !important;
        }
      `}</style>

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
            className="btn btn-outline-success"
            onClick={handleRecargarSinCache}
            title="Recargar datos sin usar caché del navegador"
          >
            <i className="fas fa-sync-alt me-2"></i>
            Recargar sin Caché
          </button>
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
                    <th style={{width: '80px'}} className="small">Tipo</th>
                    <th style={{width: '80px'}} className="small">Alertas</th>
                    <th style={{width: '110px'}} className="text-end small">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {list.filter(row => !row.esPresupuestoTrabajoExtra || !extrasEnSubgrupoIds.has(row.id)).map((row, index) => {
                    const esEditable = esPresupuestoEditable(row);
                    const esSemanal = row.tipoPresupuesto === 'TRABAJOS_SEMANALES';
                    const alertaInicio = obtenerAlertaInicio(row);
                    const alertaFin = obtenerAlertaFinalizacion(row);
                    const rowId = row.id;
                    const isSelected = selectedId && rowId && selectedId === rowId;

                    // Determinar información de grupo para estilos visuales
                    const perteneceAGrupo = (row._grupoCliente !== null || row._grupoObra !== null) && row._totalEnGrupo > 1;
                    const esPrimerEnGrupo = row._primerEnGrupo;
                    const esUltimoEnGrupo = row._ultimoEnGrupo;
                    const grupoIndex = row._grupoIndex || 0;
                    const totalEnGrupo = row._totalEnGrupo || 1;
                    const grupoTipo = row._grupoTipo || null;

                    // Colores alternados para grupos (más visibles)
                    const coloresGrupo = [
                      '#e9ecef', // Gris claro
                      '#d1e7ff', // Azul claro
                      '#ffe8cc', // Naranja claro
                      '#d4edda', // Verde claro
                      '#f8d7da', // Rosa claro
                      '#e7d6ff'  // Púrpura claro
                    ];

                    // 🎨 Color base del grupo
                    const colorBaseGrupo = coloresGrupo[grupoIndex % coloresGrupo.length];

                    // 🎨 Alternar tonalidades - cada elemento del grupo con color diferente
                    let colorGrupo = '#ffffff'; // Default: fondo blanco

                    if (perteneceAGrupo) {
                      // Calcular índice dentro del grupo específico
                      const elementosDelMismoGrupo = list.filter((item, idx) =>
                        idx <= index &&
                        item._grupoIndex === row._grupoIndex &&
                        (item._grupoCliente !== null || item._grupoObra !== null) &&
                        item._totalEnGrupo > 1
                      );
                      const indexEnGrupo = elementosDelMismoGrupo.length - 1;

                      // Aplicar diferentes tonalidades según posición en el grupo
                      const porcentajeOscurecimiento = indexEnGrupo * -12; // -0%, -12%, -24%, etc.
                      colorGrupo = adjustColorBrightness(colorBaseGrupo, porcentajeOscurecimiento);
                    }
                    // Si NO pertenece a grupo, mantener fondo blanco

                    // Determinar la relación con el presupuesto anterior (para trabajos extra)
                    let tipoRelacion = null;
                    let presupuestoRelacionado = null;
                    if (row.esPresupuestoTrabajoExtra && index > 0) {
                      const presupuestoAnterior = list[index - 1];

                      // Verificar relación por obra-presupuesto
                      const numeroPresupuestoPadre = mapObraAPresupuesto[row.obraId];
                      if (numeroPresupuestoPadre === presupuestoAnterior.numeroPresupuesto) {
                        tipoRelacion = 'obra';
                        presupuestoRelacionado = presupuestoAnterior;
                      }
                      // Verificar relación por cliente_id
                      else if (row.clienteId && presupuestoAnterior.clienteId && row.clienteId === presupuestoAnterior.clienteId) {
                        tipoRelacion = 'cliente';
                        presupuestoRelacionado = presupuestoAnterior;
                      }
                    }

                    return (
                    <React.Fragment key={rowId}>
                      {/* Separador visual entre grupos */}
                      {index > 0 && (
                        <tr style={{ height: '8px', backgroundColor: '#343a40' }}>
                          <td colSpan="11" style={{
                            padding: 0,
                            height: '8px',
                            borderTop: '3px solid #212529',
                            borderBottom: '3px solid #212529',
                            backgroundColor: '#495057'
                          }}></td>
                        </tr>
                      )}

                    <tr
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
                        backgroundColor: isSelected ? '#cfe2ff' : colorGrupo,
                        borderLeft: row.esPresupuestoTrabajoExtra
                          ? '5px solid #ffc107'
                          : (perteneceAGrupo ? '4px solid #6c757d' : 'none'),
                        borderBottom: (gruposMap[row.id]?.adicionalesObra?.length > 0)
                          ? '1px solid rgba(253, 126, 20, 0.45)'
                          : undefined,
                        transition: 'all 0.2s ease'
                      }}
                      className={`${
                        isSelected
                          ? 'table-primary'
                          : perteneceAGrupo
                            ? '' // NO aplicar clases de color cuando pertenece a grupo
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
                        {perteneceAGrupo && esPrimerEnGrupo && totalEnGrupo > 1 && grupoTipo === 'cliente' && (
                          <span className="text-primary me-1" title={`Grupo de ${totalEnGrupo} presupuesto(s) del mismo cliente`}>
                            <i className="fas fa-users" style={{fontSize: '0.9em', fontWeight: 'bold'}}></i>
                          </span>
                        )}
                        {perteneceAGrupo && !esPrimerEnGrupo && totalEnGrupo > 1 && grupoTipo === 'cliente' && (
                          <span className="text-info me-1" title="Mismo cliente que el presupuesto anterior">
                            <i className="fas fa-level-down-alt" style={{fontSize: '0.7em'}}></i>
                          </span>
                        )}
                        {perteneceAGrupo && esPrimerEnGrupo && totalEnGrupo > 1 && grupoTipo === 'obra' && (
                          <span className="text-warning me-1" title={`Grupo de ${totalEnGrupo} trabajo(s) extra de la misma obra`}>
                            <i className="fas fa-building" style={{fontSize: '0.9em', fontWeight: 'bold'}}></i>
                          </span>
                        )}
                        {perteneceAGrupo && !esPrimerEnGrupo && totalEnGrupo > 1 && grupoTipo === 'obra' && (
                          <span className="text-warning me-1" title="Trabajo extra de la misma obra que el anterior">
                            <i className="fas fa-level-down-alt" style={{fontSize: '0.7em'}}></i>
                          </span>
                        )}
                        {row.esPresupuestoTrabajoExtra && (
                          <span className="text-warning me-1" title="Trabajo extra">
                            <i className="fas fa-wrench" style={{fontSize: '0.8em'}}></i>
                          </span>
                        )}
                        {isSelected && <i className="fas fa-check-circle text-success me-1" title="Seleccionado"></i>}
                        {row.numeroPresupuesto || '-'}
                        {row.tipoPresupuesto === 'TRABAJOS_SEMANALES' && <span className="badge bg-success ms-1" style={{fontSize: '0.7em', padding: '3px 5px'}} title="Trabajos Semanales">📅 Semanal</span>}
                        {row.tipoPresupuesto === 'TRADICIONAL' && <span className="badge bg-primary ms-1" style={{fontSize: '0.7em', padding: '3px 5px'}} title="Presupuesto Tradicional">🏗️ Tradicional</span>}
                      </td>
                      <td className="small text-center">{row.numeroVersion || '-'}</td>
                      <td className="small">{row.fechaEmision}</td>
                      <td className="small fw-bold text-dark">{row.nombreSolicitante || <span className="text-muted fst-italic fw-normal">Sin especificar</span>}</td>
                      <td className="small fw-bold text-dark">
                        {row.nombreObra || <span className="text-muted fst-italic fw-normal">Sin especificar</span>}
                        {perteneceAGrupo && esPrimerEnGrupo && totalEnGrupo > 1 && grupoTipo === 'cliente' && (
                          <div className="mt-1">
                            <span className="badge" style={{
                              fontSize: '0.7em',
                              padding: '4px 8px',
                              backgroundColor: '#6c757d',
                              color: 'white',
                              fontWeight: 'bold',
                              border: '1px solid #495057'
                            }}>
                              <i className="fas fa-users me-1"></i>
                              GRUPO: {row.nombreSolicitante} ({totalEnGrupo} presupuesto{totalEnGrupo > 1 ? 's' : ''})
                            </span>
                          </div>
                        )}
                        {perteneceAGrupo && esPrimerEnGrupo && totalEnGrupo > 1 && grupoTipo === 'obra' && (
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
                              OBRA: {nombresObras[row.obraId] || `ID ${row.obraId}`} ({totalEnGrupo} presupuesto{totalEnGrupo > 1 ? 's' : ''})
                            </span>
                          </div>
                        )}
                        {row.esPresupuestoTrabajoExtra && (
                          <div className="mt-1">
                            {tipoRelacion === 'obra' && presupuestoRelacionado && (
                              <span className="badge bg-warning text-dark" style={{fontSize: '0.7em', padding: '3px 6px'}}>
                                🔧 TRABAJO EXTRA de #{presupuestoRelacionado.numeroPresupuesto}
                              </span>
                            )}
                            {tipoRelacion === 'cliente' && presupuestoRelacionado && (
                              <span className="badge bg-info text-dark" style={{fontSize: '0.7em', padding: '3px 6px'}}>
                                🔧 TRABAJO EXTRA (mismo cliente)
                              </span>
                            )}
                            {!tipoRelacion && (
                              <span className="badge bg-warning text-dark" style={{fontSize: '0.7em', padding: '3px 6px'}}>
                                🔧 TRABAJO EXTRA
                              </span>
                            )}
                            {row.obraId && (
                              <div className="text-muted mt-1" style={{fontSize: '0.75em'}}>
                                <i className="fas fa-link me-1"></i>
                                Obra: {nombresObras[row.obraId] || `ID ${row.obraId}`}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
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
                      <td className="small">
                        {/* Determinar modo basado en itemsCalculadora */}
                        {(() => {
                          // Si no tiene items, mostrar "Sin items"
                          if (!row.itemsCalculadora || row.itemsCalculadora.length === 0) {
                            return (
                              <span className="badge bg-light text-dark" style={{ fontSize: '0.7em' }}>
                                <i className="fas fa-question me-1"></i>
                                Sin items
                              </span>
                            );
                          }

                          // Verificar si hay elementos con indicadores de modo global
                          let esGlobal = false;

                          row.itemsCalculadora.forEach(item => {
                            // Revisar jornales
                            if (item.jornales && item.jornales.length > 0) {
                              item.jornales.forEach(j => {
                                const rol = (j.rol || '').toUpperCase();
                                if (rol.includes('PRESUPUESTO GLOBAL') || rol.includes('PARA LA OBRA')) {
                                  esGlobal = true;
                                }
                              });
                            }

                            // Revisar materiales
                            if (item.materialesLista && item.materialesLista.length > 0) {
                              item.materialesLista.forEach(m => {
                                const nombre = (m.nombre || m.descripcion || '').toLowerCase();
                                if (nombre.includes('presupuesto global') || nombre.includes('para la obra') ||
                                    nombre.includes('materiales para la')) {
                                  esGlobal = true;
                                }
                              });
                            }

                            // Revisar gastos
                            if (item.gastosGenerales && item.gastosGenerales.length > 0) {
                              item.gastosGenerales.forEach(g => {
                                const desc = (g.descripcion || '').toLowerCase();
                                if (desc.includes('presupuesto global') || desc.includes('para la obra')) {
                                  esGlobal = true;
                                }
                              });
                            }
                          });

                          if (esGlobal) {
                            return (
                              <span className="badge bg-secondary text-white" style={{ fontSize: '0.7em' }}>
                                <i className="fas fa-globe me-1"></i>
                                Global
                              </span>
                            );
                          } else {
                            return (
                              <span className="badge bg-info text-white" style={{ fontSize: '0.7em' }}>
                                <i className="fas fa-list me-1"></i>
                                Detallado
                              </span>
                            );
                          }
                        })()}
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
                              // 1. Backend ya calculó el total con descuentos → usar directamente
                              if (row.totalConDescuentos != null && Number(row.totalConDescuentos) > 0) {
                                return (
                                  <>
                                    {`$${Number(row.totalConDescuentos).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                                    <span className="ms-1" title="Incluye descuentos aplicados" style={{fontSize:'0.85em', opacity:0.65}}>🏷️</span>
                                  </>
                                );
                              }

                              // 2. Recalcular desde itemsCalculadora con la utilidad compartida
                              const items = row.itemsCalculadora;
                              if (items && Array.isArray(items) && items.length > 0) {
                                const { totalFinal, totalDescuentos } = calcularTotalConDescuentosDesdeItems(items, row);
                                if (totalFinal > 0) {
                                  return (
                                    <>
                                      {`$${totalFinal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                                      {totalDescuentos > 0 && (
                                        <span className="ms-1" title="Incluye descuentos aplicados" style={{fontSize:'0.85em', opacity:0.65}}>🏷️</span>
                                      )}
                                    </>
                                  );
                                }
                              }

                              // 3. Fallback final: priorizar el campo que incluye honorarios + mayores costos
                              const total = row.totalPresupuestoConHonorarios || row.totalGeneral || row.montoTotal || row.totalFinal || 0;
                              if (total > 0) return `$${Number(total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

                              return <span className="text-muted">Sin datos</span>;
                            })()}
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* ══════════════════════════════════════════════════
                        SUBGRUPOS DEL PRESUPUESTO PRINCIPAL
                        ══════════════════════════════════════════════════ */}
                    {(() => {
                      const { adicionalesObra = [] } = gruposMap[row.id] || {};
                      if (adicionalesObra.length === 0) return null;
                      const colAd = !!gruposColapsados[`adicionales_${row.id}`];
                      return (
                        <>
                          {/* ── Subgrupo: Adicionales Obra ── */}
                          {adicionalesObra.length > 0 && (
                            <>
                              {/* Header subgrupo Adicionales */}
                              <tr
                                onClick={(e) => { e.stopPropagation(); setGruposColapsados(p => ({ ...p, [`adicionales_${row.id}`]: !p[`adicionales_${row.id}`] })); }}
                                style={{ backgroundColor: '#dbeafe', cursor: 'pointer', borderLeft: '5px solid #1d4ed8', borderBottom: '1px solid rgba(253, 126, 20, 0.45)' }}
                              >
                                <td colSpan="11" className="py-1 px-3 small">
                                  <span className="fw-bold text-primary">
                                    <i className={`fas fa-chevron-${colAd ? 'right' : 'down'} me-2`} style={{fontSize:'0.75em'}}></i>
                                    📋 Adicionales Obra
                                    <span className="badge bg-primary ms-2" style={{fontSize:'0.7em'}}>{adicionalesObra.length}</span>
                                  </span>
                                  <span className="text-muted ms-3 small">Clic para {colAd ? 'mostrar' : 'ocultar'}</span>
                                </td>
                              </tr>
                              {!colAd && adicionalesObra.map(adic => {
                                const adicSel = selectedId === adic.id;
                                const adicTotal = adic.totalConDescuentos || adic.totalPresupuestoConHonorarios || adic.totalGeneral || adic.montoTotal || adic.totalFinal || 0;
                                const adicDir = [adic.direccionObraCalle, adic.direccionObraAltura].filter(Boolean).join(' ');
                                return (
                                  <tr
                                    key={`adic_${adic.id}`}
                                    onClick={(e) => { e.stopPropagation(); setSelectedId(adicSel ? null : adic.id); }}
                                    onDoubleClick={(e) => { e.stopPropagation(); handleAbrirAdicionalObra(adic.id); }}
                                    title="Clic para seleccionar • Doble clic para abrir"
                                    style={{ backgroundColor: adicSel ? '#cfe2ff' : '#eff6ff', borderLeft: '5px solid #ffc107', borderBottom: '1px solid rgba(253, 126, 20, 0.45)', cursor: 'pointer' }}
                                  >
                                    <td className="small ps-4">
                                      {adicSel
                                        ? <i className="fas fa-check-circle text-success me-1" title="Seleccionado"></i>
                                        : <i className="fas fa-wrench text-warning me-1" style={{fontSize:'0.75em'}}></i>
                                      }
                                      {adic.numeroPresupuesto || '-'}
                                    </td>
                                    <td className="small text-center">{adic.numeroVersion || '-'}</td>
                                    <td className="small">{adic.fechaEmision || '—'}</td>
                                    <td className="small">{adic.nombreSolicitante || '—'}</td>
                                    <td className="small">{adic.nombreObra || '—'}</td>
                                    <td className="small">{adicDir || '—'}</td>
                                    <td className="small">{adic.fechaProbableInicio || '—'}</td>
                                    <td>
                                      <span className={`badge ${getEstadoBadgeClass(adic.estado)}`} style={{fontSize:'0.65em', padding:'3px 5px'}}>
                                        {adic.estado || '—'}
                                      </span>
                                    </td>
                                    <td>
                                      <span className="badge bg-warning text-dark" style={{fontSize:'0.65em', padding:'3px 5px'}}>
                                        🔧 Adicional
                                      </span>
                                    </td>
                                    <td></td>
                                    <td className="text-end fw-bold text-primary small">
                                      {adicTotal > 0
                                        ? `$${Number(adicTotal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                                        : <span className="text-muted">—</span>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </>
                          )}
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
            setShowDownloadPdfButton(false); // 🔥 Resetear flag
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
          showDownloadPdfButton={showDownloadPdfButton} // 🔥 Nuevo prop
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
            setShowEnviarPresupuestoModal(false);

            // 🔧 Normalizar: Si es trabajo extra, NO cargar clienteId
            const presupuestoNormalizado = {
              ...presupuesto,
              obraId: presupuesto.obraId || presupuesto.idObra || null,
              clienteId: presupuesto.esPresupuestoTrabajoExtra ? null : (presupuesto.clienteId || presupuesto.idCliente || null)
            };

            setPresupuestoData(presupuestoNormalizado);
            setAutoGenerarPDF(true);
            setAbrirWhatsAppDespuesDePDF(true); // ✅ Activar flag de WhatsApp
            setAbrirEmailDespuesDePDF(false);
            setShowEditarModal(true);
          }}
          onAbrirPresupuestoParaEmail={(presupuesto) => {
            setShowEnviarPresupuestoModal(false);

            // 🔧 Normalizar: Si es trabajo extra, NO cargar clienteId
            const presupuestoNormalizado = {
              ...presupuesto,
              obraId: presupuesto.obraId || presupuesto.idObra || null,
              clienteId: presupuesto.esPresupuestoTrabajoExtra ? null : (presupuesto.clienteId || presupuesto.idCliente || null)
            };

            setPresupuestoData(presupuestoNormalizado);
            setAutoGenerarPDF(true);
            setAbrirWhatsAppDespuesDePDF(false);
            setAbrirEmailDespuesDePDF(true); // ✅ Activar flag de Email
            setShowEditarModal(true);
          }}
        />
      )}

      </div>
    </>
  );
};

export default PresupuestosNoClientePage;
